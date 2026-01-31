import os
import uuid
import threading
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
RUNS_DIR = BASE_DIR / "runs"
RESULTS_DIR = BASE_DIR / "results"
RUNS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Seg3D Local API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://yfcosmos.com",
        "https://colinfirth5566.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/results", StaticFiles(directory=RESULTS_DIR), name="results")

jobs = {}


def run_seg3d(job_id: str, input_dir: Path, output_path: Path) -> None:
    jobs[job_id]["status"] = "running"
    try:
        cmd_template = os.environ.get("SEG3D_CMD")
        if not cmd_template:
            raise RuntimeError(
                "SEG3D_CMD is not set. Example: "
                "SEG3D_CMD=\"python /path/to/run_seg3d.py --input {input_dir} --output {output_glb}\""
            )

        cmd = cmd_template.format(input_dir=str(input_dir), output_glb=str(output_path))
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr or result.stdout or "Seg3D command failed")

        if not output_path.exists():
            raise RuntimeError("Output .glb was not created")

        jobs[job_id].update(
            status="done",
            mesh_url=f"/results/{output_path.name}",
            message="Completed",
        )
    except Exception as exc:  # noqa: BLE001
        jobs[job_id].update(status="failed", message=str(exc))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run")
async def run(
    images: Optional[List[UploadFile]] = File(None),
    image: Optional[UploadFile] = File(None),
):
    files = []
    if images:
        files.extend(images)
    if image:
        files.append(image)

    if not files:
        raise HTTPException(status_code=400, detail="No images uploaded")

    job_id = uuid.uuid4().hex[:10]
    job_dir = RUNS_DIR / job_id
    input_dir = job_dir / "images"
    input_dir.mkdir(parents=True, exist_ok=True)

    for upload in files:
        target = input_dir / (upload.filename or f"image_{uuid.uuid4().hex}.jpg")
        with target.open("wb") as buffer:
            buffer.write(await upload.read())

    output_path = RESULTS_DIR / f"{job_id}.glb"
    jobs[job_id] = {
        "status": "queued",
        "message": "Queued",
        "mesh_url": None,
    }

    thread = threading.Thread(
        target=run_seg3d,
        args=(job_id, input_dir, output_path),
        daemon=True,
    )
    thread.start()

    return {
        "job_id": job_id,
        "status_url": f"/status/{job_id}",
    }


@app.get("/status/{job_id}")
def status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    payload = {
        "job_id": job_id,
        "status": job.get("status"),
        "message": job.get("message"),
        "mesh_url": job.get("mesh_url"),
    }
    if payload["mesh_url"]:
        payload["mesh_url"] = f"http://localhost:8000{payload['mesh_url']}"
    return payload
