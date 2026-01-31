# Seg3D Local API

Runs Seg3D locally and serves the `.glb` result to the frontend.

## Setup
```bash
cd /mnt/c/Code/ColinFirth5566.github.io/seg3D_exp/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configure Seg3D command
Set `SEG3D_CMD` so the server can run your Seg3D pipeline:

```bash
export SEG3D_CMD="python /path/to/run_seg3d.py --input {input_dir} --output {output_glb}"
```

- `{input_dir}` = folder containing uploaded JPG/PNG files
- `{output_glb}` = path to write the `.glb`

## Run the API
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

## API
- `POST /run` (multipart)
  - `images`: one or more files
  - returns `{ job_id, status_url }`
- `GET /status/{job_id}`
  - returns `{ status, message, mesh_url }`

## Notes
- Results are served at `http://localhost:8000/results/<job_id>.glb`
- CORS is enabled for `https://yfcosmos.com` and `https://colinfirth5566.github.io`
- If you open the frontend on `https://yfcosmos.com`, browsers may block `http://localhost` (mixed content). Run the frontend locally or use an HTTPS tunnel (ngrok, Cloudflare Tunnel).
