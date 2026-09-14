#!/usr/bin/env python3
"""Fine-tune only the MGM output head on private prepared stem examples.

The loaded SavedModel is kept at the original architecture. Only the variable
with shape [1,1,32,2] and name containing `out/kernel` receives gradients.
The script writes a candidate SavedModel and a report to a separate directory;
it never touches production TFJS/ONNX assets or calls deploy scripts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

import numpy as np


def require_tensorflow():
    try:
        import tensorflow as tf
    except ImportError as exc:
        raise RuntimeError(f"TensorFlow is required for head-only training: {exc}") from exc
    return tf


def load_npz(path: Path) -> dict[str, np.ndarray]:
    required = {
        "contexts", "target_masks", "mixture_real", "mixture_imag",
        "instrumental_real", "instrumental_imag", "vocal_real", "vocal_imag",
    }
    with np.load(path, allow_pickle=False) as loaded:
        missing = required.difference(loaded.files)
        if missing:
            raise ValueError(f"{path}: missing arrays {sorted(missing)}")
        arrays = {key: np.asarray(loaded[key], dtype=np.float32) for key in required}
    expected = arrays["contexts"].shape[0]
    if arrays["contexts"].shape[1:] != (1024, 64, 2):
        raise ValueError(f"contexts must be [N,1024,64,2], got {arrays['contexts'].shape}")
    if arrays["target_masks"].shape[1:] != (15, 1024, 2):
        raise ValueError(f"target_masks must be [N,15,1024,2], got {arrays['target_masks'].shape}")
    for key, value in arrays.items():
        if value.shape[0] != expected:
            raise ValueError(f"{key} has {value.shape[0]} examples; expected {expected}")
        if not np.isfinite(value).all():
            raise ValueError(f"{path}: {key} contains NaN or infinity")
    return arrays


def find_output_kernel(model):
    candidates = []
    for operation in getattr(model, "_operations", []):
        variable = getattr(operation, "_kernel", None)
        if variable is None:
            continue
        shape = tuple(int(size) for size in variable.shape)
        name = str(getattr(variable, "name", ""))
        if shape == (1, 1, 32, 2):
            candidates.append((name, variable))
    named = [candidate for candidate in candidates if "out/kernel" in candidate[0]]
    if len(named) == 1:
        return named[0][1]
    if len(candidates) == 1:
        return candidates[0][1]
    raise RuntimeError(f"expected one final output kernel [1,1,32,2], found {[name for name, _ in candidates]}")


def output_active_logits(tf, signature, inputs):
    result = signature(input=tf.convert_to_tensor(inputs, dtype=tf.float32))
    if not result:
        raise RuntimeError("SavedModel returned no output")
    output = next(iter(result.values()))
    if tuple(output.shape) != (inputs.shape[0], 1024, 64, 2):
        raise RuntimeError(f"SavedModel output must be [N,1024,64,2], got {output.shape}")
    # Keep the same active ECO slice as the Extension, then use [N,15,1024,2].
    return tf.transpose(output[:, :, 34:49, :], [0, 2, 1, 3])


def loss_components(tf, predicted, target, arrays, baseline, weights):
    mix = tf.complex(arrays["mixture_real"], arrays["mixture_imag"])
    instrumental = tf.complex(arrays["instrumental_real"], arrays["instrumental_imag"])
    vocal = tf.complex(arrays["vocal_real"], arrays["vocal_imag"])
    predicted_complex = mix * tf.cast(predicted, tf.complex64)
    target_complex = mix * tf.cast(target, tf.complex64)

    reconstruction = tf.reduce_mean(tf.abs(predicted_complex - instrumental))
    target_mask_loss = tf.reduce_mean(tf.abs(predicted - target))
    # Explicitly penalize vocal energy left in the estimated instrumental.
    leakage = tf.reduce_mean(tf.abs(predicted_complex - instrumental)) + 0.25 * tf.reduce_mean(
        tf.abs(tf.cast(1.0 - predicted, tf.complex64) * vocal)
    )
    trust_region = tf.reduce_mean(tf.square(predicted - tf.stop_gradient(baseline)))
    temporal = tf.reduce_mean(tf.abs(
        (predicted[:, 1:] - predicted[:, :-1]) - (target[:, 1:] - target[:, :-1])
    ))
    stereo = tf.reduce_mean(tf.abs(
        (predicted[:, :, :, 0] - predicted[:, :, :, 1]) -
        (target[:, :, :, 0] - target[:, :, :, 1])
    ))
    total = (
        weights["reconstruction"] * reconstruction +
        weights["target_mask"] * target_mask_loss +
        weights["leakage"] * leakage +
        weights["trust_region"] * trust_region +
        weights["temporal"] * temporal +
        weights["stereo"] * stereo
    )
    return total, {
        "reconstruction": reconstruction,
        "target_mask": target_mask_loss,
        "leakage": leakage,
        "trust_region": trust_region,
        "temporal": temporal,
        "stereo": stereo,
    }


def batches(arrays, batch_size):
    count = arrays["contexts"].shape[0]
    for start in range(0, count, batch_size):
        end = min(count, start + batch_size)
        yield {key: value[start:end] for key, value in arrays.items()}


def evaluate(tf, signature, arrays, original_kernel, kernel, weights, batch_size):
    current = kernel.numpy().copy()
    total = {"total": 0.0, "reconstruction": 0.0, "target_mask": 0.0, "leakage": 0.0, "trust_region": 0.0, "temporal": 0.0, "stereo": 0.0}
    examples = 0
    for batch in batches(arrays, batch_size):
        baseline = None
        kernel.assign(original_kernel)
        baseline = tf.sigmoid(output_active_logits(tf, signature, batch["contexts"]))
        kernel.assign(current)
        predicted = tf.sigmoid(output_active_logits(tf, signature, batch["contexts"]))
        tensors = {key: tf.convert_to_tensor(value) for key, value in batch.items()}
        total_loss, parts = loss_components(tf, predicted, tensors["target_masks"], tensors, baseline, weights)
        size = len(batch["contexts"])
        total["total"] += float(total_loss) * size
        for key, value in parts.items():
            total[key] += float(value) * size
        examples += size
    kernel.assign(current)
    return {key: value / max(examples, 1) for key, value in total.items()}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", required=True, help="prepared private train .npz")
    parser.add_argument("--validation", required=True, help="prepared private validation .npz")
    parser.add_argument("--model", required=True, help="baseline SavedModel directory")
    parser.add_argument("--output-dir", required=True, help="private candidate output directory")
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--learning-rate", type=float, default=1.0e-4)
    parser.add_argument("--seed", type=int, default=20260913)
    args = parser.parse_args(argv)
    if args.epochs <= 0 or args.batch_size <= 0 or not (0 < args.learning_rate <= 1.0e-2):
        raise ValueError("epochs/batch-size must be positive and learning-rate must be in (0,0.01]")

    tf = require_tensorflow()
    random.seed(args.seed)
    np.random.seed(args.seed)
    tf.random.set_seed(args.seed)
    train = load_npz(Path(args.train).expanduser().resolve())
    validation = load_npz(Path(args.validation).expanduser().resolve())
    model_path = Path(args.model).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    if output_dir.exists():
        raise ValueError(f"refusing to overwrite existing candidate directory: {output_dir}")
    output_dir.mkdir(parents=True)

    model = tf.saved_model.load(str(model_path))
    signature = model.signatures["serving_default"]
    kernel = find_output_kernel(model)
    original_kernel = kernel.numpy().copy()
    weights = {
        "reconstruction": 1.0,
        "target_mask": 0.50,
        "leakage": 0.75,
        "trust_region": 0.25,
        "temporal": 0.20,
        "stereo": 0.10,
    }
    optimizer = tf.keras.optimizers.Adam(learning_rate=args.learning_rate)
    best_kernel = original_kernel.copy()
    best_validation = None
    history = []

    for epoch in range(args.epochs):
        order = np.arange(len(train["contexts"]))
        rng = np.random.default_rng(args.seed + epoch)
        rng.shuffle(order)
        shuffled = {key: value[order] for key, value in train.items()}
        train_totals = {key: 0.0 for key in ("total", "reconstruction", "target_mask", "leakage", "trust_region", "temporal", "stereo")}
        train_examples = 0
        for batch in batches(shuffled, args.batch_size):
            tensors = {key: tf.convert_to_tensor(value) for key, value in batch.items()}
            current_kernel = kernel.numpy().copy()
            kernel.assign(original_kernel)
            baseline = tf.stop_gradient(tf.sigmoid(output_active_logits(tf, signature, tensors["contexts"])))
            kernel.assign(current_kernel)
            with tf.GradientTape() as tape:
                predicted = tf.sigmoid(output_active_logits(tf, signature, tensors["contexts"]))
                total_loss, parts = loss_components(tf, predicted, tensors["target_masks"], tensors, baseline, weights)
            gradients = tape.gradient(total_loss, [kernel])
            if gradients[0] is None or not tf.reduce_all(tf.math.is_finite(gradients[0])):
                raise RuntimeError("final output head produced no finite gradient")
            optimizer.apply_gradients(zip(gradients, [kernel]))
            size = len(batch["contexts"])
            train_examples += size
            train_totals["total"] += float(total_loss) * size
            for key, value in parts.items():
                train_totals[key] += float(value) * size

        train_report = {key: value / max(train_examples, 1) for key, value in train_totals.items()}
        validation_report = evaluate(tf, signature, validation, original_kernel, kernel, weights, args.batch_size)
        row = {"epoch": epoch + 1, "train": train_report, "validation": validation_report}
        history.append(row)
        score = validation_report["total"]
        if best_validation is None or score < best_validation:
            best_validation = score
            best_kernel = kernel.numpy().copy()

    kernel.assign(best_kernel)
    saved_model_dir = output_dir / "saved_model"
    tf.saved_model.save(model, str(saved_model_dir), signatures={"serving_default": signature})
    np.save(output_dir / "out_kernel.npy", best_kernel)
    report = {
        "status": "candidate_only",
        "training_scope": "final output head only",
        "baseline_model": str(model_path),
        "baseline_model_variables_sha256": sha256_file(model_path / "variables" / "variables.data-00000-of-00001"),
        "train_file": str(Path(args.train).expanduser().resolve()),
        "validation_file": str(Path(args.validation).expanduser().resolve()),
        "seed": args.seed,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "train_examples": int(len(train["contexts"])),
        "validation_examples": int(len(validation["contexts"])),
        "trainable_variable": str(kernel.name),
        "trainable_shape": list(kernel.shape),
        "runtime_contract": {
            "architecture_changed": False,
            "input_shape": [1, 1024, 64, 2],
            "active_frames": [34, 48],
            "runtime_ops_added": 0,
            "deploy_performed": False,
        },
        "loss_weights": weights,
        "history": history,
        "outputs": {
            "saved_model": str(saved_model_dir),
            "out_kernel": str(output_dir / "out_kernel.npy"),
        },
        "warning": "No quality claim until unseen licensed test songs and Apple/Windows gates pass.",
    }
    (output_dir / "TRAINING.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "candidate": str(output_dir), "best_validation": best_validation}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
