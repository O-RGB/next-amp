# Robotic-residual offline evaluation

This directory contains diagnostic-only tools for the ECO vocal-separation
experiment. They never write to `next-amp-extension/model/`, never change the
runtime DSP, and never deploy a candidate.

## Requirements

- Python 3.10+
- NumPy
- TensorFlow only when running a model render
- A 44.1 kHz mono/stereo PCM WAV that you own or are licensed to evaluate
- The locally generated SavedModel at `work/saved_model`, or another
  reproducible MGM_MAIN_v4 SavedModel with the same input/output contract

Do not put songs or stems in Git. Keep them outside the repository and pass
absolute paths on the command line.

## Run a model diagnostic

```bash
cd nextstudio-model-builder
.venv/bin/python3 evaluation/robotic_residual.py \
  --input /absolute/path/mixture.wav \
  --model work/saved_model \
  --output-dir /absolute/path/robotic-report
```

For an oracle comparison, provide the matching vocal and instrumental stems:

```bash
.venv/bin/python3 evaluation/robotic_residual.py \
  --input /absolute/path/mixture.wav \
  --vocal /absolute/path/vocal.wav \
  --instrumental /absolute/path/instrumental.wav \
  --model work/saved_model \
  --output-dir /absolute/path/robotic-report
```

The tool produces `REPORT.json` and WAV files for the current raw-model path,
an unfiltered duplicate used as a control, an ideal ratio-mask upper-bound,
and a delayed ground-truth instrumental reference when stems are supplied.
The upper-bound is not a candidate model; it only answers whether mixture
phase/STFT alone can explain the artifact.

The tool rejects other sample rates, more than two channels, malformed WAV
files, missing model signatures, and model output shapes that do not match the
64-frame production contract. It pads only the final analysis chunk, and it
records that fact in the report.
