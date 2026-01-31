import argparse
import os
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input image folder")
    parser.add_argument("--output", required=True, help="Output .glb path")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_glb = Path(args.output)
    output_glb.parent.mkdir(parents=True, exist_ok=True)

    cmd_template = os.environ.get("SEG3D_CMD")
    if not cmd_template:
        raise SystemExit(
            "SEG3D_CMD is not set. Example: "
            "SEG3D_CMD=\"python /path/to/run_seg3d.py --input {input_dir} --output {output_glb}\""
        )

    cmd = cmd_template.format(input_dir=str(input_dir), output_glb=str(output_glb))
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        raise SystemExit("Seg3D command failed")


if __name__ == "__main__":
    main()
