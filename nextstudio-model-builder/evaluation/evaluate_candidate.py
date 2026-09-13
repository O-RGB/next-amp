#!/usr/bin/env python3
"""Evaluate a candidate SavedModel against the current ECO baseline.

This command is an offline quality gate. It requires a song-level manifest with
licensed mixture/vocal/instrumental stems and deliberately refuses to call a
candidate "better" when it only suppresses more sound. Runtime latency,
WebGPU stability, and long-run behavior remain separate gates.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

BUILDER_ROOT = Path(__file__).resolve().parents[1]
if str(BUILDER_ROOT) not in sys.path:
    sys.path.insert(0, str(BUILDER_ROOT))

from evaluation.robotic_residual import (  # noqa: E402
    SavedModelMaskPredictor,
    audio_metrics,
    mask_metrics,
    model_provider,
    read_wav,
    render_eco,
)
from training.prepare_stem_examples import load_manifest  # noqa: E402


def evaluate_clip(record: dict, baseline_predictor: SavedModelMaskPredictor, candidate_predictor: SavedModelMaskPredictor) -> dict:
    mixture, _ = read_wav(Path(record["mixture"]).expanduser().resolve())
    # Read all three files before inference so malformed or mismatched inputs
    # fail before a partial quality report is written.
    read_wav(Path(record["vocal"]).expanduser().resolve())
    instrumental, _ = read_wav(Path(record["instrumental"]).expanduser().resolve())
    baseline = render_eco(mixture, model_provider(baseline_predictor))
    candidate = render_eco(mixture, model_provider(candidate_predictor))
    baseline_audio = audio_metrics(baseline.audio, instrumental)
    candidate_audio = audio_metrics(candidate.audio, instrumental)
    baseline_mask = mask_metrics(baseline.masks)
    candidate_mask = mask_metrics(candidate.masks)

    def delta(key: str) -> float | None:
        left = candidate_audio.get(key)
        right = baseline_audio.get(key)
        if left is None or right is None:
            return None
        return float(left - right)

    return {
        "id": str(record["id"]),
        "baseline": {"audio": baseline_audio, "mask": baseline_mask},
        "candidate": {"audio": candidate_audio, "mask": candidate_mask},
        "delta_candidate_minus_baseline": {
            "residual_rms_db": delta("residual_rms_db"),
            "instrumental_error_rms_db": delta("instrumental_error_rms_db"),
            "instrumental_reference_si_sdr_db": delta("instrumental_reference_si_sdr_db"),
            "multi_resolution_spectral_distance": delta("multi_resolution_spectral_distance"),
            "stereo_correlation": delta("stereo_correlation"),
            "mask_frame_to_frame_mean_abs_delta": candidate_mask["frame_to_frame_mean_abs_delta"] - baseline_mask["frame_to_frame_mean_abs_delta"],
        },
    }


def aggregate_clip_results(results: list[dict], max_instrument_regression_db: float, min_vocal_improvement_db: float) -> dict:
    if not results:
        raise ValueError("at least one clip is required")
    deltas = [row["delta_candidate_minus_baseline"] for row in results]

    def mean(key: str) -> float:
        values = [float(row[key]) for row in deltas if row.get(key) is not None]
        return float(np.mean(values)) if values else float("nan")

    vocal_delta = mean("residual_rms_db")
    instrument_delta = mean("instrumental_reference_si_sdr_db")
    spectral_delta = mean("multi_resolution_spectral_distance")
    damaged = [
        row["id"] for row in results
        if row["delta_candidate_minus_baseline"].get("instrumental_reference_si_sdr_db", 0.0) < -max_instrument_regression_db
    ]
    vocal_improved = np.isfinite(vocal_delta) and vocal_delta <= -min_vocal_improvement_db
    instruments_preserved = np.isfinite(instrument_delta) and instrument_delta >= -max_instrument_regression_db
    spectral_not_worse = np.isfinite(spectral_delta) and spectral_delta <= max_instrument_regression_db / 10.0
    passed = bool(vocal_improved and instruments_preserved and spectral_not_worse and not damaged)
    return {
        "clip_count": len(results),
        "mean_delta": {
            "residual_rms_db": vocal_delta,
            "instrumental_reference_si_sdr_db": instrument_delta,
            "multi_resolution_spectral_distance": spectral_delta,
            "stereo_correlation": mean("stereo_correlation"),
            "mask_frame_to_frame_mean_abs_delta": mean("mask_frame_to_frame_mean_abs_delta"),
        },
        "thresholds": {
            "minimum_vocal_improvement_db": min_vocal_improvement_db,
            "maximum_instrument_regression_db": max_instrument_regression_db,
        },
        "checks": {
            "vocal_improvement": bool(vocal_improved),
            "instrument_preservation": bool(instruments_preserved),
            "spectral_not_worse": bool(spectral_not_worse),
            "no_critical_instrument_damage": not damaged,
            "runtime_latency": "not measured by offline evaluator",
            "long_run_stability": "not measured by offline evaluator",
        },
        "damaged_clips": damaged,
        "passed": passed,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, help="private licensed evaluation manifest")
    parser.add_argument("--baseline-model", required=True, help="baseline SavedModel")
    parser.add_argument("--candidate-model", required=True, help="candidate SavedModel")
    parser.add_argument("--output", required=True, help="report JSON outside Git")
    parser.add_argument("--minimum-vocal-improvement-db", type=float, default=0.3)
    parser.add_argument("--maximum-instrument-regression-db", type=float, default=0.1)
    args = parser.parse_args(argv)
    if args.minimum_vocal_improvement_db < 0 or args.maximum_instrument_regression_db < 0:
        raise ValueError("quality thresholds must be non-negative")

    records = load_manifest(Path(args.manifest).expanduser().resolve())
    baseline = Path(args.baseline_model).expanduser().resolve()
    candidate = Path(args.candidate_model).expanduser().resolve()
    baseline_predictor = SavedModelMaskPredictor(baseline)
    candidate_predictor = SavedModelMaskPredictor(candidate)
    results = [evaluate_clip(record, baseline_predictor, candidate_predictor) for record in records]
    summary = aggregate_clip_results(results, args.maximum_instrument_regression_db, args.minimum_vocal_improvement_db)
    report = {
        "status": "passed" if summary["passed"] else "rejected",
        "baseline_model": str(baseline),
        "candidate_model": str(candidate),
        "manifest": str(Path(args.manifest).expanduser().resolve()),
        "summary": summary,
        "clips": results,
        "warning": "Offline quality does not prove Apple/Windows latency or long-run stability.",
    }
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "clips": len(results), "output": str(output)}, indent=2))
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
