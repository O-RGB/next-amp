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

## Create a zero-runtime-cost calibration candidate

Only run this after a licensed validation corpus has selected a scalar and the
metric/listening gates in the main plan pass. The command copies the model to a
new directory and changes only the final output-head FP16 values:

```bash
node training/bake_output_head_calibration.mjs \
  --model /absolute/path/to/model.json \
  --scale 1.03 \
  --candidate-id eco-logit-calibration-103 \
  --output-dir /absolute/path/robotic-candidates/eco-logit-calibration-103
```

The accepted range is deliberately limited to `0.95..1.10`. The script fails
if the final head cannot be proven to be `[1,1,32,2]` FP16 storage, preserves
the original model, writes `CALIBRATION.json`, and never deploys the output.
The scalar is not a quality setting; it must come from validation data.

## Head-only fine-tuning

Create a private manifest first. Each row must identify one complete song and
point to three matching 44.1 kHz WAV files:

```json
[
  {
    "id": "owned-song-001",
    "mixture": "/private/audio/owned-song-001-mixture.wav",
    "vocal": "/private/audio/owned-song-001-vocal.wav",
    "instrumental": "/private/audio/owned-song-001-instrumental.wav"
  }
]
```

Prepare train and validation caches separately:

```bash
python training/prepare_stem_examples.py \
  --manifest /private/manifests/train.json \
  --output /private/robotic-work/train.npz
python training/prepare_stem_examples.py \
  --manifest /private/manifests/validation.json \
  --output /private/robotic-work/validation.npz
```

Then run the conservative head-only training. It freezes the full backbone,
trains only `out/kernel`, keeps the full `[1,1024,64,2]` input contract, and
writes a candidate SavedModel outside the repository:

```bash
python training/head_only_finetune.py \
  --train /private/robotic-work/train.npz \
  --validation /private/robotic-work/validation.npz \
  --model work/saved_model \
  --output-dir /private/robotic-candidates/head-only-001
```

The candidate is not production-ready. It must still be converted through the
normal builder, compared against the baseline on unseen songs, and pass all
listening, latency, memory, and long-run gates before any deploy is considered.

## Aggregate quality gate

Use a separate song-level evaluation manifest for unseen licensed songs. The
evaluator rejects a candidate unless average vocal residue improves by at least
`0.3 dB`, instrumental SI-SDR does not regress by more than `0.1 dB`, no clip
crosses the damage limit, and the spectral distance is not worse. These are
conservative defaults and can be made stricter; they are not permission to
relax the listening gate.

```bash
python evaluation/evaluate_candidate.py \
  --manifest /private/manifests/test.json \
  --baseline-model /private/baseline/saved_model \
  --candidate-model /private/robotic-candidates/head-only-001/saved_model \
  --output /private/robotic-candidates/head-only-001/QUALITY-GATE.json
```

An exit code of `0` means only the offline quality gate passed. It does not
measure WebGPU latency, Windows 1050 Ti stability, queue underruns, memory
growth, or 30-minute long-run behavior. Those must still be run on the actual
Extension build.
