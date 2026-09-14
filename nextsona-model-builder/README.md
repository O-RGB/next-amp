# NextSona Model Builder

This directory contains the automated pipeline for reproducing the `MGM_MAIN_v4` model from the Ultimate Vocal Remover (UVR) repository, converting it to TensorFlow.js and ONNX, and deploying it to the Extension and Go engines.

## Features
- Reproducible conversion from the official `MGM_MAIN_v4.pth` checkpoint
- No dependency on existing production models (`ai remove/`)
- Exact architecture definition matching `CascadedASPPNet v4`
- Folds PyTorch BatchNorm operations into Convolution/Dense weights
- Exports to TensorFlow SavedModel, TensorFlow.js FP16, and ONNX
- Executes PyTorch, SavedModel, TensorFlow.js and ONNX parity tests before deploy
- Atomic deployment pipeline

The generated files are not expected to have the same byte hash as a model
serialized by a different TensorFlow version. Verification compares the
effective mask produced from deterministic input. The browser artifact also
has to stay within the same FP16 error envelope as the previous production
model.

## Usage

You can run these scripts via npm from this directory, or from the root repository:

```bash
# 1. Fetch source
npm run model:fetch

# 2. Build the model (creates SavedModel, TFJS, ONNX in dist/)
npm run model:build

# 3. Verify the model
npm run model:verify

# 4. Deploy to Extension and Go Engine
npm run model:deploy

# Or all at once
npm run model:build:deploy
```

## Structure
- `src/` - Python scripts for conversion and weight mapping
- `scripts/` - Bash scripts for build/verify/deploy automation
- `source/` - Contains the downloaded `.pth` and `SOURCE.json`
- `config/` - Model architecture parameters and parity thresholds
- `dist/` - Generated build artifacts
- `work/` - Temporary files during build

See [NEXTSONA-MODEL-BUILDER-PLAN.md](NEXTSONA-MODEL-BUILDER-PLAN.md) for full details.
