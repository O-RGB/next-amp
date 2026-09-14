# NextSona AI Model Provenance

## Distributed model

NextSona distributes a TensorFlow.js GraphModel consisting of:

| Artifact | SHA-256 |
| --- | --- |
| `model.json` | `77b9dc9b7a8c3cebd98a04bcb80b6d27eed710cb433bca0f2e8d4d1eb7d3e44b` |
| `group1-shard1of1.bin` | `13cafca89123ac168bf2d45adbd916b2d67bbbdc7cfeee56ed03947f7421f135` |

The browser graph accepts the complete `[1, 1024, 64, 2]` context and returns
the 15-frame ECO mask as `[2, 15, 1024]`. Its manifest has 161 FP16-quantized
floating-point tensors and 121 integer graph constants. A conservative full
output topology is embedded as compatibility metadata and shares the same
weight shard; it does not require a second model download.

## Upstream identity

The model weights are an FP16-quantized conversion of
`MGM_MAIN_v4.pth` from the Ultimate Vocal Remover project.

- Project: <https://github.com/Anjok07/ultimatevocalremovergui>
- Official model registry:
  <https://github.com/Anjok07/ultimatevocalremovergui/blob/master/gui_data/model_manual_download.json>
- Original architecture:
  <https://github.com/tsurumeso/vocal-remover>
- Original `MGM_MAIN_v4.pth` SHA-256:
  `0e6f0c0592333a3b215f61ac1e01f6c24c059f903f0789cf634e92daffae1dce`
- UVR registry hash (MD5 of the final 10,000 KiB, matching UVR's code):
  `5a6e24c1b530f2dab045a522ef89b751`

The UVR registry maps that model hash to the `1band_sr44100_hl512`
configuration and an Instrumental primary stem.

## Verification performed

The checked-in `nextsona-model-builder` downloads the official upstream
`MGM_MAIN_v4.pth`, verifies both source hashes, recreates CascadedASPPNet from
the public MIT architecture and maps the checkpoint without reading the local
`ai remove/` project or the production model.

- PyTorch -> TensorFlow FP32 mask parity: MAE `2.77e-7`, max `3.54e-4`.
- TensorFlow.js FP16 -> PyTorch parity: MAE `2.01e-4`, cosine similarity
  `0.9999896`; this matches the established production FP16 error envelope.
- ONNX -> PyTorch parity: MAE `2.01e-4`, cosine similarity `0.9999896`.
- Build-time graph folding removes converter-only reordering and standalone
  padding nodes. Only the frame-independent final 1x1 projection is restricted
  to ECO's 15 output frames; the decoder and its 64-frame input context remain
  complete.
- A deterministic fixture produced exactly the same active ECO mask as the
  conservative full-output graph (`MAE 0`, max error 0), which in turn matches
  the established production model.
- Two clean consecutive builds produced identical hashes for the TFJS metadata,
  TFJS weight shard and ONNX model.

The distributed artifacts are therefore independently generated and
numerically attributable to the official `MGM_MAIN_v4` weights.

## Licensing and attribution

The Ultimate Vocal Remover README states that the project is MIT-licensed and
that third-party applications using UVR models should honor the MIT terms and
credit UVR and its developers. The original `vocal-remover` architecture is
also MIT-licensed.

The model notice and MIT attribution for the UVR weights, plus the separate MIT
attribution for tsurumeso's original architecture, are preserved in every
model directory and copied into the Store package as `MODEL-LICENSE.txt`.

## Build command

Run `npm run model:build:deploy`. Build output is staged under
`nextsona-model-builder/dist/`, executable parity tests must pass before
deployment, and the Go artifact is repacked from the verified ONNX model.
