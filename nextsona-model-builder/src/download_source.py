#!/usr/bin/env python3
"""Download MGM_MAIN_v4.pth from the official UVR repository and verify integrity.

This script downloads the model weights from the official Ultimate Vocal Remover
model repository and verifies both the full-file SHA-256 hash and the UVR-style
MD5 hash of the final 10,000 KiB.

It will NEVER fall back to reading from ai remove/ or existing production model files.

License: NextFeeder Labs (converter tooling only)
Model weights are MIT-licensed by Anjok07, aufr33, and tsurumeso.
"""

import hashlib
import json
import logging
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BUILDER_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = BUILDER_ROOT / "config" / "mgm-main-v4.json"
SOURCE_DIR = BUILDER_ROOT / "source"
SOURCE_JSON = SOURCE_DIR / "SOURCE.json"


def load_config() -> dict:
    """Load and validate the model configuration."""
    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    required = ["url", "sha256", "uvr_md5_last_10000_kib", "allowed_hosts"]
    for key in required:
        if key not in config["source"]:
            raise ValueError(f"Missing required config key: source.{key}")
    return config


def verify_host(url: str, allowed_hosts: list[str]) -> None:
    """Reject downloads from unauthorized domains."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.hostname not in allowed_hosts:
        raise ValueError(
            f"Download host '{parsed.hostname}' is not in allowed list: {allowed_hosts}"
        )


def compute_sha256(filepath: Path) -> str:
    """Compute SHA-256 hash of the entire file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(1 << 20)  # 1 MiB
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def compute_uvr_md5(filepath: Path, tail_bytes: int = 10000 * 1024) -> str:
    """Compute MD5 of the final 10,000 KiB (UVR model hash convention)."""
    file_size = filepath.stat().st_size
    offset = max(0, file_size - tail_bytes)
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        f.seek(offset)
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest: Path, allowed_hosts: list[str]) -> None:
    """Download a file with host verification and progress reporting."""
    verify_host(url, allowed_hosts)

    logger.info(f"Downloading from {url}")
    logger.info(f"Destination: {dest}")

    # Custom opener that checks redirects
    class HostCheckRedirectHandler(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            verify_host(newurl, allowed_hosts)
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    opener = urllib.request.build_opener(HostCheckRedirectHandler)
    request = urllib.request.Request(url, headers={"User-Agent": "NextSona-Model-Builder/1.0"})

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest = dest.with_suffix(".tmp")

    try:
        with opener.open(request) as response:
            total = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            with open(tmp_dest, "wb") as f:
                while True:
                    chunk = response.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 // total
                        mb = downloaded / (1024 * 1024)
                        total_mb = total / (1024 * 1024)
                        print(f"\r  {mb:.1f} / {total_mb:.1f} MiB ({pct}%)", end="", flush=True)
            print()

        tmp_dest.rename(dest)
        logger.info(f"Downloaded {downloaded} bytes")

    except Exception:
        if tmp_dest.exists():
            tmp_dest.unlink()
        raise


def verify_hashes(filepath: Path, expected_sha256: str, expected_uvr_md5: str) -> dict:
    """Verify both SHA-256 and UVR MD5 hashes."""
    logger.info("Verifying SHA-256...")
    actual_sha256 = compute_sha256(filepath)
    sha256_ok = actual_sha256 == expected_sha256
    if sha256_ok:
        logger.info(f"  SHA-256 OK: {actual_sha256}")
    else:
        logger.error(f"  SHA-256 MISMATCH!")
        logger.error(f"    Expected: {expected_sha256}")
        logger.error(f"    Actual:   {actual_sha256}")

    logger.info("Verifying UVR MD5 (last 10,000 KiB)...")
    actual_uvr_md5 = compute_uvr_md5(filepath)
    uvr_md5_ok = actual_uvr_md5 == expected_uvr_md5
    if uvr_md5_ok:
        logger.info(f"  UVR MD5 OK: {actual_uvr_md5}")
    else:
        logger.error(f"  UVR MD5 MISMATCH!")
        logger.error(f"    Expected: {expected_uvr_md5}")
        logger.error(f"    Actual:   {actual_uvr_md5}")

    return {
        "sha256": actual_sha256,
        "sha256_ok": sha256_ok,
        "uvr_md5": actual_uvr_md5,
        "uvr_md5_ok": uvr_md5_ok,
        "file_size": filepath.stat().st_size,
    }


def write_source_json(
    url: str, filepath: Path, hashes: dict, config: dict
) -> None:
    """Write SOURCE.json with download metadata."""
    downloaded_at = datetime.now(timezone.utc).isoformat()
    if SOURCE_JSON.exists():
        try:
            with open(SOURCE_JSON) as existing_file:
                existing = json.load(existing_file)
            if existing.get("sha256") == hashes["sha256"]:
                downloaded_at = existing.get("downloaded_at", downloaded_at)
        except (OSError, ValueError, TypeError):
            pass
    record = {
        "model_id": config["model_id"],
        "source_url": url,
        "downloaded_at": downloaded_at,
        "file_name": filepath.name,
        "file_size_bytes": hashes["file_size"],
        "sha256": hashes["sha256"],
        "sha256_verified": hashes["sha256_ok"],
        "uvr_md5_last_10000_kib": hashes["uvr_md5"],
        "uvr_md5_verified": hashes["uvr_md5_ok"],
        "expected_sha256": config["source"]["sha256"],
        "expected_uvr_md5": config["source"]["uvr_md5_last_10000_kib"],
    }
    SOURCE_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(SOURCE_JSON, "w") as f:
        json.dump(record, f, indent=2)
    logger.info(f"Wrote {SOURCE_JSON}")


def main() -> int:
    config = load_config()
    src = config["source"]
    url = src["url"]
    dest = SOURCE_DIR / "MGM_MAIN_v4.pth"

    # Skip download if file already exists and hash matches
    if dest.exists():
        logger.info(f"File already exists: {dest}")
        hashes = verify_hashes(dest, src["sha256"], src["uvr_md5_last_10000_kib"])
        if hashes["sha256_ok"] and hashes["uvr_md5_ok"]:
            logger.info("Existing file passes all integrity checks. Skipping download.")
            write_source_json(url, dest, hashes, config)
            return 0
        else:
            logger.warning("Existing file failed integrity check. Re-downloading.")
            dest.unlink()

    download_file(url, dest, src["allowed_hosts"])
    hashes = verify_hashes(dest, src["sha256"], src["uvr_md5_last_10000_kib"])
    write_source_json(url, dest, hashes, config)

    if not hashes["sha256_ok"] or not hashes["uvr_md5_ok"]:
        logger.error("INTEGRITY CHECK FAILED — refusing to proceed.")
        return 1

    logger.info("Source download and verification complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
