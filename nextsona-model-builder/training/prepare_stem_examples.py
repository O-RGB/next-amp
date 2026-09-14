#!/usr/bin/env python3
"""Prepare private, licensed stem examples for ECO head-only training.

Input is a JSON manifest containing objects with `id`, `mixture`, `vocal`, and
`instrumental` WAV paths. Output is a local NPZ cache under `work/` by default;
it must not be committed. Splitting is done by manifest before this command is
run, so clips from one song cannot leak between train/validation/test.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

BUILDER_ROOT = Path(__file__).resolve().parents[1]
if str(BUILDER_ROOT) not in sys.path:
    sys.path.insert(0, str(BUILDER_ROOT))

from evaluation.robotic_residual import (  # noqa: E402
    ACTIVE_FRAMES,
    CHUNK_SAMPLES,
    CONTEXT_FRAMES,
    HISTORY_SAMPLES,
    MODEL_BINS,
    _as_stereo,
    _chunk,
    read_wav,
    stft_chunk,
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_manifest(path: Path) -> list[dict]:
    try:
        records = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read manifest {path}: {exc}") from exc
    if not isinstance(records, list) or not records:
        raise ValueError("manifest must be a non-empty JSON array")
    required = {"id", "mixture", "vocal", "instrumental"}
    for record in records:
        if not isinstance(record, dict) or not required.issubset(record):
            raise ValueError(f"each manifest row must contain {sorted(required)}")
    ids = [str(record["id"]) for record in records]
    if len(set(ids)) != len(ids):
        raise ValueError("manifest IDs must be unique")
    return records


def build_examples(record: dict) -> dict:
    paths = {key: Path(record[key]).expanduser().resolve() for key in ("mixture", "vocal", "instrumental")}
    loaded = {key: read_wav(path)[0] for key, path in paths.items()}
    stereo = {key: _as_stereo(value) for key, value in loaded.items()}
    length = max(len(value) for value in stereo.values())
    stereo = {key: np.pad(value, ((0, length - len(value)), (0, 0))) for key, value in stereo.items()}
    chunk_count = max(1, int(np.ceil(length / CHUNK_SAMPLES)))

    context = np.zeros((CONTEXT_FRAMES, MODEL_BINS, 2), dtype=np.float32)
    history = np.zeros((HISTORY_SAMPLES, 2), dtype=np.float32)
    peaks: list[float] = []
    contexts = []
    target_masks = []
    mixture_real = []
    mixture_imag = []
    instrumental_real = []
    instrumental_imag = []
    vocal_real = []
    vocal_imag = []

    for index in range(chunk_count):
        mixture_chunk, _ = _chunk(stereo["mixture"], index)
        vocal_chunk, _ = _chunk(stereo["vocal"], index)
        instrumental_chunk, _ = _chunk(stereo["instrumental"], index)
        mixture_spectrum = stft_chunk(np.concatenate((history, mixture_chunk), axis=0))
        vocal_spectrum = stft_chunk(np.concatenate((history, vocal_chunk), axis=0))
        instrumental_spectrum = stft_chunk(np.concatenate((history, instrumental_chunk), axis=0))

        magnitudes = np.abs(mixture_spectrum).astype(np.float32)
        context = np.concatenate((context[ACTIVE_FRAMES:], magnitudes), axis=0)
        peaks.append(float(np.max(magnitudes, initial=1.0e-5)))
        scale = max(1.0e-4, *peaks[-4:])
        contexts.append((context / scale).transpose(1, 0, 2).astype(np.float32))

        # The ideal ratio mask is only a supervised target. Runtime still uses
        # mixture phase and the unchanged ECO output equation.
        ideal = np.abs(instrumental_spectrum) / (
            np.abs(instrumental_spectrum) + np.abs(vocal_spectrum) + 1.0e-7
        )
        target_masks.append(ideal.astype(np.float32))
        for destination, source in (
            (mixture_real, mixture_spectrum.real),
            (mixture_imag, mixture_spectrum.imag),
            (instrumental_real, instrumental_spectrum.real),
            (instrumental_imag, instrumental_spectrum.imag),
            (vocal_real, vocal_spectrum.real),
            (vocal_imag, vocal_spectrum.imag),
        ):
            destination.append((source / scale).astype(np.float32))
        history = mixture_chunk[-HISTORY_SAMPLES:].copy()

    return {
        "contexts": np.stack(contexts),
        "target_masks": np.stack(target_masks),
        "mixture_real": np.stack(mixture_real),
        "mixture_imag": np.stack(mixture_imag),
        "instrumental_real": np.stack(instrumental_real),
        "instrumental_imag": np.stack(instrumental_imag),
        "vocal_real": np.stack(vocal_real),
        "vocal_imag": np.stack(vocal_imag),
        "clip_ids": np.asarray([str(record["id"])] * chunk_count),
        "source_hashes": np.asarray([file_sha256(path) for path in paths.values()]),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, help="private JSON manifest")
    parser.add_argument("--output", required=True, help="private .npz output path")
    args = parser.parse_args(argv)
    manifest_path = Path(args.manifest).expanduser().resolve()
    records = load_manifest(manifest_path)
    batches = [build_examples(record) for record in records]

    arrays = {}
    for key in batches[0]:
        if key == "source_hashes":
            continue
        arrays[key] = np.concatenate([batch[key] for batch in batches], axis=0)
    source_hashes = [batch["source_hashes"].tolist() for batch in batches]
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(output, **arrays)
    metadata = {
        "manifest": str(manifest_path),
        "manifest_sha256": file_sha256(manifest_path),
        "clip_count": len(records),
        "example_count": int(len(arrays["contexts"])),
        "shape": {
            "contexts": list(arrays["contexts"].shape),
            "target_masks": list(arrays["target_masks"].shape),
        },
        "contract": {
            "context_frames": CONTEXT_FRAMES,
            "active_frames": ACTIVE_FRAMES,
            "model_bins": MODEL_BINS,
        },
        "source_hashes": source_hashes,
        "warning": "Private licensed data; this cache must stay outside Git.",
    }
    metadata_path = output.with_suffix(".json")
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "metadata": str(metadata_path), "examples": metadata["example_count"]}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
