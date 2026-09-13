#!/usr/bin/env python3
"""Verify the deployable, self-contained ONNX artifact."""

import json
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    with open(ROOT / "config" / "mgm-main-v4.json") as f:
        config = json.load(f)
    model_path = ROOT / "dist" / "mgm-main-v4" / "onnx" / "model.onnx"
    graph = onnx.load(str(model_path), load_external_data=False)
    onnx.checker.check_model(graph)
    if any(t.data_location == onnx.TensorProto.EXTERNAL for t in graph.graph.initializer):
        print("ONNX model contains external weights and cannot be embedded by Go", file=sys.stderr)
        return 1
    if [x.name for x in graph.graph.output] != [config["export"]["onnx"]["output_name"]]:
        print("ONNX output name does not match the Go runtime contract", file=sys.stderr)
        return 1

    shape = tuple(config["architecture"]["input_shape"])
    fixture_dir = ROOT / "work" / "fixtures"
    source_input = np.fromfile(fixture_dir / "input.f32", dtype=np.float32).reshape(shape)
    expected = np.fromfile(fixture_dir / "expected-mask.f32", dtype=np.float32).reshape(shape)
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    logits = session.run(None, {session.get_inputs()[0].name: source_input})[0]
    actual = 1.0 / (1.0 + np.exp(-np.clip(logits, -80.0, 80.0)))
    diff = np.abs(expected - actual)
    mae = float(diff.mean())
    max_err = float(diff.max())
    cosine = float(np.dot(expected.ravel(), actual.ravel()) /
                   (np.linalg.norm(expected.ravel()) * np.linalg.norm(actual.ravel())))
    print(f"ONNX parity: MAE={mae:.8g}, max={max_err:.8g}, cosine={cosine:.10f}")
    limits = config["parity_thresholds"]
    return 0 if (mae <= limits["onnx_vs_pytorch_mae"] and
                 max_err <= limits["onnx_vs_pytorch_max"] and
                 cosine >= limits["onnx_vs_pytorch_cosine_sim"]) else 1


if __name__ == "__main__":
    sys.exit(main())
