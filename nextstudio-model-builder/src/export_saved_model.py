#!/usr/bin/env python3
import argparse
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np
import tensorflow as tf
import torch

from uvr_v4_tensorflow import create_cascaded_aspp_net
from uvr_v4_torch import get_model
from weight_mapping import apply_weight_mapping

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="config/mgm-main-v4.json")
    parser.add_argument("--checkpoint", type=str, default="source/MGM_MAIN_v4.pth")
    parser.add_argument("--output_dir", type=str, default="work/saved_model")
    parser.add_argument("--fixture_dir", type=str, default="work/fixtures")
    args = parser.parse_args()

    with open(args.config, "r") as f:
        config = json.load(f)

    # 1. Load PyTorch model and weights
    logger.info("Loading PyTorch model...")
    pt_model = get_model(args.checkpoint)
    state_dict = torch.load(args.checkpoint, map_location='cpu')

    # 2. Create TensorFlow model
    logger.info("Creating TensorFlow model...")
    tf_model = create_cascaded_aspp_net(
        input_shape=tuple(config["architecture"]["input_shape"][1:]), # omit batch

    )

    # 3. Apply weight mapping
    logger.info("Mapping weights...")
    unused_keys = apply_weight_mapping(tf_model, state_dict)
    expected_unused = {"aux1_out.weight", "aux2_out.weight"}
    if set(unused_keys) != expected_unused:
        logger.error("Unexpected state-dict coverage: unused=%s", sorted(unused_keys))
        sys.exit(1)

    # 4. Parity verification on deterministic data.  The TensorFlow graph
    # intentionally exports logits because the runtimes apply sigmoid only to
    # the selected output window.  Compare masks here so both sides represent
    # the same public model output.
    logger.info("Verifying parity...")
    rng = np.random.default_rng(20260913)
    dummy_input = rng.uniform(-1, 1, size=config["architecture"]["input_shape"]).astype(np.float32)

    # PT inference
    with torch.no_grad():
        pt_out = pt_model(torch.from_numpy(dummy_input)).numpy()

    # TF inference
    tf_logits = tf_model(dummy_input, training=False)
    tf_out = tf.math.sigmoid(tf_logits).numpy()

    mae = np.mean(np.abs(pt_out - tf_out))
    max_err = np.max(np.abs(pt_out - tf_out))

    logger.info(f"Parity MAE: {mae:.2e} (Threshold: {config['parity_thresholds']['tf_vs_pytorch_mae']:.2e})")
    logger.info(f"Parity Max: {max_err:.2e} (Threshold: {config['parity_thresholds']['tf_vs_pytorch_max']:.2e})")

    if mae > config['parity_thresholds']['tf_vs_pytorch_mae'] or max_err > config['parity_thresholds']['tf_vs_pytorch_max']:
        logger.error("Parity verification failed!")
        sys.exit(1)

    fixture_dir = Path(args.fixture_dir)
    fixture_dir.mkdir(parents=True, exist_ok=True)
    dummy_input.tofile(fixture_dir / "input.f32")
    pt_out.astype(np.float32, copy=False).tofile(fixture_dir / "expected-mask.f32")
    with open(fixture_dir / "metadata.json", "w") as f:
        json.dump({
            "seed": 20260913,
            "shape": config["architecture"]["input_shape"],
            "element_count": int(dummy_input.size),
            "tf_vs_pytorch_mae": float(mae),
            "tf_vs_pytorch_max": float(max_err),
        }, f, indent=2)

    # 5. Export SavedModel
    logger.info(f"Exporting SavedModel to {args.output_dir}...")

    # We export with signature serving_default
    @tf.function(input_signature=[tf.TensorSpec(shape=config["architecture"]["input_shape"], dtype=tf.float32, name="input")])
    def serving_fn(input):
        return {"output_0": tf_model(input, training=False)}

    tf.saved_model.save(
        tf_model,
        args.output_dir,
        signatures={"serving_default": serving_fn}
    )
    logger.info("SavedModel export complete.")

if __name__ == "__main__":
    main()
