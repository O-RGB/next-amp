# NextStudio AI Model Provenance

## Distributed model

NextStudio distributes a TensorFlow.js GraphModel consisting of:

| Artifact | SHA-256 |
| --- | --- |
| `model.json` | `f55cdb7f1803358392a90cec64286c8fce9cae8479f315a9fc454fee73d5ad88` |
| `group1-shard1of1.bin` | `678f41db6d50f3938f9e2264c98b21a240ade43554097ce32c9fb05789be491e` |

The graph accepts and returns `[1, 1024, 64, 2]`. Its manifest has 161
FP16-quantized floating-point tensors and 116 integer graph constants.

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

The checked-in `nextstudio-model-builder` downloads the official upstream
`MGM_MAIN_v4.pth`, verifies both source hashes, recreates CascadedASPPNet from
the public MIT architecture and maps the checkpoint without reading the local
`ai remove/` project or the production model.

- PyTorch -> TensorFlow FP32 mask parity: MAE `2.77e-7`, max `3.54e-4`.
- TensorFlow.js FP16 -> PyTorch parity: MAE `2.01e-4`, cosine similarity
  `0.9999896`; this matches the established production FP16 error envelope.
- ONNX -> PyTorch parity: MAE `2.01e-4`, cosine similarity `0.9999896`.
- A deterministic fixture produced exactly the same TensorFlow.js mask as the
  previous production model (`MAE 0`, max error 0).
- Two clean consecutive builds produced identical hashes for the TFJS metadata,
  TFJS weight shard and ONNX model.

The distributed artifacts are therefore independently generated and
numerically attributable to the official `MGM_MAIN_v4` weights.

## Licensing and attribution

The Ultimate Vocal Remover README states that the project is MIT-licensed and
that third-party applications using UVR models should honor the MIT terms and
credit UVR and its developers. The original `vocal-remover` architecture is
also MIT-licensed.

The model notice and MIT attribution are preserved in every model directory
and copied into the Store package as `MODEL-LICENSE.txt`.

## Build command

Run `npm run model:build:deploy`. Build output is staged under
`nextstudio-model-builder/dist/`, executable parity tests must pass before
deployment, and the Go artifact is repacked from the verified ONNX model.
