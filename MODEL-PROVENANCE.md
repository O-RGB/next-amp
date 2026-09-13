# NextStudio AI Model Provenance

## Distributed model

NextStudio distributes a TensorFlow.js GraphModel consisting of:

| Artifact | SHA-256 |
| --- | --- |
| `model.json` | `4bbf00c984124db90a5d1add0eb438516180acec2c555d939dff7de897f0c922` |
| `group1-shard1of1.bin` | `d15138d4eedc24664a266fdd43ff3bbc3eeb6c281ac79c00be0e80a28c3d6f08` |

The graph accepts and returns `[1, 1024, 64, 2]`. Its manifest has 161
FP16-quantized floating-point tensors and 137 integer graph constants.

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
- UVR registry hash (MD5 of the final 10 MiB):
  `5a6e24c1b530f2dab045a522ef89b751`

The UVR registry maps that model hash to the `1band_sr44100_hl512`
configuration and an Instrumental primary stem.

## Verification performed

The official upstream `MGM_MAIN_v4.pth` was compared to the distributed
TensorFlow.js artifacts without relying on filenames or descriptive metadata.

- The graph structure matches the public v4 `CascadedASPPNet` architecture.
- All 12 depthwise convolution tensors and the final output tensor match after
  the required PyTorch OIHW-to-TensorFlow HWIO transpose and FP16 quantization.
- All 148 convolution/bias tensors match after standard BatchNorm folding,
  layout transpose and FP16 quantization.
- This accounts for all 161 floating-point tensors in the GraphModel.

The conversion is therefore numerically attributable to the official
`MGM_MAIN_v4` weights.

## Licensing and attribution

The Ultimate Vocal Remover README states that the project is MIT-licensed and
that third-party applications using UVR models should honor the MIT terms and
credit UVR and its developers. The original `vocal-remover` architecture is
also MIT-licensed.

The model notice and MIT attribution are preserved in every model directory
and copied into the Store package as `MODEL-LICENSE.txt`.

## Provenance limitation

The current TensorFlow.js serialization is byte-identical to a conversion
distributed by the PerfectBrain Vocal Remover extension. The numerical model
content has been independently traced to the MIT-licensed UVR upstream, but
this repository does not yet contain a reproducible converter that rebuilds
the complete GraphModel serialization from the official `.pth` file.

For the strongest chain of custody, regenerate the GraphModel from the
official UVR download using only the public MIT-licensed architecture, record
the converter source and tool versions, and archive its build log and hashes.
Until that is done, do not describe the current serialization as an
independently generated conversion.

