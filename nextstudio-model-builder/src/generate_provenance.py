#!/usr/bin/env python3
"""Generate PROVENANCE.json recording the build environment and source lineage.

License: NextFeeder Labs (converter tooling only)
"""

import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BUILDER_ROOT = Path(__file__).resolve().parent.parent


def get_package_version(name: str) -> str:
    """Get installed Python package version."""
    try:
        import importlib.metadata
        return importlib.metadata.version(name)
    except Exception:
        return "not installed"


def get_git_hash() -> str:
    """Get current git commit hash."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, cwd=BUILDER_ROOT
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def main() -> None:
    source_json_path = BUILDER_ROOT / "source" / "SOURCE.json"
    source_info = {}
    if source_json_path.exists():
        with open(source_json_path) as f:
            source_info = json.load(f)

    provenance = {
        "builder": "nextstudio-model-builder",
        "builder_version": "1.0.0",
        "built_at": datetime.now(timezone.utc).isoformat(),
        "built_by": "NextFeeder Labs",
        "environment": {
            "os": platform.system(),
            "os_version": platform.version(),
            "arch": platform.machine(),
            "python": platform.python_version(),
            "node": subprocess.getoutput("node --version 2>/dev/null").strip() or "not available",
        },
        "dependencies": {
            "torch": get_package_version("torch"),
            "numpy": get_package_version("numpy"),
            "tensorflow": get_package_version("tensorflow"),
            "tensorflowjs": get_package_version("tensorflowjs"),
            "onnx": get_package_version("onnx"),
            "onnxruntime": get_package_version("onnxruntime"),
            "protobuf": get_package_version("protobuf"),
        },
        "source": {
            "model_id": source_info.get("model_id", "mgm-main-v4"),
            "source_url": source_info.get("source_url", ""),
            "sha256": source_info.get("sha256", ""),
            "uvr_md5_last_10000_kib": source_info.get("uvr_md5_last_10000_kib", ""),
            "file_size_bytes": source_info.get("file_size_bytes", 0),
        },
        "git_commit": get_git_hash(),
        "notes": [
            "Model weights are MIT-licensed by Anjok07, aufr33 (UVR) and tsurumeso (vocal-remover).",
            "Conversion tooling by NextFeeder Labs.",
            "This build does not modify model weights; it converts format only.",
        ],
    }

    dist_dir = BUILDER_ROOT / "dist" / "mgm-main-v4"
    dist_dir.mkdir(parents=True, exist_ok=True)
    out_path = dist_dir / "PROVENANCE.json"
    with open(out_path, "w") as f:
        json.dump(provenance, f, indent=2)

    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
