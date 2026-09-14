#!/usr/bin/env python3
import argparse
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn
from torch.nn.utils.fusion import fuse_conv_bn_eval

from uvr_v4_torch import get_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fold_batch_norm_and_round_fp16(model: nn.Module) -> None:
    """Match the established Go model's compact weight representation.

    ONNX Runtime still receives FLOAT tensors for broad DirectML/CoreML/CPU
    compatibility, but each folded parameter is rounded through IEEE FP16
    first. This mirrors the browser model without adding runtime casts.
    """
    model.eval()
    for module in model.modules():
        if not isinstance(module, nn.Sequential):
            continue
        children = list(module.children())
        if len(children) >= 3 and isinstance(children[0], nn.Conv2d) and isinstance(children[1], nn.BatchNorm2d):
            module[0] = fuse_conv_bn_eval(children[0], children[1])
            module[1] = nn.Identity()
        elif len(children) >= 4 and isinstance(children[1], nn.Conv2d) and isinstance(children[2], nn.BatchNorm2d):
            module[1] = fuse_conv_bn_eval(children[1], children[2])
            module[2] = nn.Identity()

    for module in model.modules():
        if isinstance(module, nn.Conv2d):
            module.weight.data.copy_(module.weight.data.to(torch.float16).to(torch.float32))
            if module.bias is not None:
                module.bias.data.copy_(module.bias.data.to(torch.float16).to(torch.float32))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default="config/mgm-main-v4.json")
    parser.add_argument("--checkpoint", type=str, default="source/MGM_MAIN_v4.pth")
    parser.add_argument("--output_dir", type=str, default="dist/mgm-main-v4/onnx")
    args = parser.parse_args()

    with open(args.config, "r") as f:
        config = json.load(f)

    # 1. Load PyTorch model
    logger.info("Loading PyTorch model...")
    # The Go runtime applies sigmoid only to the active output window, so the
    # ONNX artifact must expose logits (the same contract as the browser model).
    pt_model = get_model(args.checkpoint, output_logits=True)
    pt_model.eval()
    reference_model = get_model(args.checkpoint)
    reference_model.eval()
    fold_batch_norm_and_round_fp16(pt_model)

    # 2. Export to ONNX
    output_path = Path(args.output_dir) / "model.onnx"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Exporting ONNX to {output_path}...")
    torch.manual_seed(20260913)
    dummy_input = torch.randn(*config["architecture"]["input_shape"])

    torch.onnx.export(
        pt_model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=config["export"]["onnx"]["opset"],
        do_constant_folding=True,
        input_names=["input"],
        output_names=[config["export"]["onnx"]["output_name"]],
        dynamic_axes=None,  # We use fully static shapes as per plan
        dynamo=False,
        external_data=False,
        training=torch.onnx.TrainingMode.EVAL,
    )

    # 3. Check model
    logger.info("Checking ONNX model...")
    onnx_model = onnx.load(str(output_path))
    onnx.checker.check_model(onnx_model)

    # 4. Parity verification
    logger.info("Verifying parity with ONNXRuntime...")
    ort_session = ort.InferenceSession(str(output_path), providers=["CPUExecutionProvider"])

    rng = np.random.default_rng(20260913)
    dummy_np = rng.uniform(-1, 1, size=config["architecture"]["input_shape"]).astype(np.float32)

    with torch.no_grad():
        reference_mask = reference_model(torch.from_numpy(dummy_np)).numpy()

    ort_inputs = {ort_session.get_inputs()[0].name: dummy_np}
    ort_out = ort_session.run(None, ort_inputs)[0]

    # Compare the effective masks, not raw logits. Tiny backend differences on
    # saturated logits are inaudible after sigmoid and can look arbitrarily
    # large in raw-logit space.
    ort_mask = 1.0 / (1.0 + np.exp(-np.clip(ort_out, -80.0, 80.0)))
    diff = np.abs(reference_mask - ort_mask)
    mae = np.mean(diff)
    max_err = np.max(diff)
    cosine = np.dot(reference_mask.ravel(), ort_mask.ravel()) / (
        np.linalg.norm(reference_mask.ravel()) * np.linalg.norm(ort_mask.ravel())
    )

    logger.info(f"Parity MAE: {mae:.2e} (Threshold: {config['parity_thresholds']['onnx_vs_pytorch_mae']:.2e})")
    logger.info(f"Parity Max: {max_err:.2e} (Threshold: {config['parity_thresholds']['onnx_vs_pytorch_max']:.2e})")
    logger.info(f"Parity Cosine: {cosine:.8f} (Threshold: {config['parity_thresholds']['onnx_vs_pytorch_cosine_sim']:.8f})")

    if (mae > config['parity_thresholds']['onnx_vs_pytorch_mae'] or
            max_err > config['parity_thresholds']['onnx_vs_pytorch_max'] or
            cosine < config['parity_thresholds']['onnx_vs_pytorch_cosine_sim']):
        logger.error("ONNX parity verification failed!")
        sys.exit(1)

    logger.info("ONNX export complete.")

if __name__ == "__main__":
    main()
