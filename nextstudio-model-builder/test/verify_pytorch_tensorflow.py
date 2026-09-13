#!/usr/bin/env python3
"""Verify the built SavedModel against the independent PyTorch fixture."""

import json
import sys
from pathlib import Path

import numpy as np
import tensorflow as tf

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    with open(ROOT / "config" / "mgm-main-v4.json") as f:
        config = json.load(f)
    fixture_dir = ROOT / "work" / "fixtures"
    shape = tuple(config["architecture"]["input_shape"])
    source_input = np.fromfile(fixture_dir / "input.f32", dtype=np.float32).reshape(shape)
    expected = np.fromfile(fixture_dir / "expected-mask.f32", dtype=np.float32).reshape(shape)

    loaded = tf.saved_model.load(str(ROOT / "work" / "saved_model"))
    result = loaded.signatures["serving_default"](tf.constant(source_input))
    logits = result["output_0"]
    actual = tf.math.sigmoid(logits).numpy()
    if not np.isfinite(actual).all() or actual.min() < 0.0 or actual.max() > 1.0:
        print("SavedModel produced an invalid mask", file=sys.stderr)
        return 1

    diff = np.abs(expected - actual)
    mae = float(diff.mean())
    max_err = float(diff.max())
    print(f"SavedModel parity: MAE={mae:.8g}, max={max_err:.8g}")
    limits = config["parity_thresholds"]
    return 0 if mae <= limits["tf_vs_pytorch_mae"] and max_err <= limits["tf_vs_pytorch_max"] else 1


if __name__ == "__main__":
    sys.exit(main())
