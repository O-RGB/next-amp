#!/usr/bin/env python3
"""Offline ECO diagnostic for low-level robotic vocal residue.

This is intentionally not a training script and is not connected to the
production deploy path. It mirrors the current 15-frame/64-frame-context
timeline closely enough to separate four likely causes:

* model-mask leakage,
* temporal mask modulation,
* mixture-phase/STFT limitations, and
* realtime-only state or scheduling problems.

The tool uses only local WAV files supplied by the caller. It does not read
`ai remove/`, YouTube, or any network location.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import numpy as np


SAMPLE_RATE = 44100
FFT_SIZE = 2048
HOP_SIZE = 512
MODEL_BINS = 1024
CONTEXT_FRAMES = 64
ACTIVE_FRAMES = 15
SLICE_START = 34
CHUNK_SAMPLES = ACTIVE_FRAMES * HOP_SIZE
HISTORY_SAMPLES = FFT_SIZE - HOP_SIZE
DELAY_CHUNKS = 1
EPSILON = 1.0e-12


def _fail(message: str) -> "NoReturn":
    raise ValueError(message)


def _read_pcm24(raw: bytes) -> np.ndarray:
    if len(raw) % 3:
        _fail("24-bit WAV data is not aligned to complete samples")
    values = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
    result = values[:, 0] | (values[:, 1] << 8) | (values[:, 2] << 16)
    result = np.where(result & 0x800000, result - 0x1000000, result)
    return result.astype(np.float32) / 8388608.0


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    """Read PCM/IEEE-float WAV into [samples, channels] float32."""
    try:
        with wave.open(str(path), "rb") as handle:
            channels = handle.getnchannels()
            sample_rate = handle.getframerate()
            sample_width = handle.getsampwidth()
            frame_count = handle.getnframes()
            encoding = handle.getcomptype()
            raw = handle.readframes(frame_count)
    except (OSError, wave.Error) as exc:
        _fail(f"Cannot read WAV {path}: {exc}")

    if sample_rate != SAMPLE_RATE:
        _fail(f"{path}: expected 44100 Hz, got {sample_rate} Hz")
    if channels not in (1, 2):
        _fail(f"{path}: expected mono or stereo, got {channels} channels")
    if encoding != "NONE" and not (encoding == "NONE" and sample_width == 4):
        _fail(f"{path}: unsupported WAV compression {encoding}")

    if sample_width == 1:
        values = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
        values = (values - 128.0) / 128.0
    elif sample_width == 2:
        values = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif sample_width == 3:
        values = _read_pcm24(raw)
    elif sample_width == 4:
        # wave does not expose the format tag. Interpret a 32-bit file as
        # float only when the PCM integer interpretation is clearly invalid;
        # ordinary signed PCM32 remains supported.
        integer = np.frombuffer(raw, dtype="<i4").astype(np.float64)
        float_values = np.frombuffer(raw, dtype="<f4").astype(np.float32)
        if np.isfinite(float_values).all() and np.max(np.abs(float_values), initial=0.0) <= 4.0:
            values = float_values
        else:
            values = integer.astype(np.float32) / 2147483648.0
    else:
        _fail(f"{path}: unsupported sample width {sample_width} bytes")

    if values.size % channels:
        _fail(f"{path}: sample payload is not divisible by channel count")
    audio = values.reshape(-1, channels)
    if not np.isfinite(audio).all():
        _fail(f"{path}: WAV contains NaN or infinity")
    return np.ascontiguousarray(audio, dtype=np.float32), sample_rate


def write_float_wav(path: Path, audio: np.ndarray) -> None:
    """Write a float32 IEEE WAV for listening without changing internal metrics."""
    if audio.ndim != 2 or audio.shape[1] not in (1, 2):
        _fail("output audio must have shape [samples, 1|2]")
    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = np.clip(audio, -1.0, 1.0).astype("<f4", copy=False)
    channels = clipped.shape[1]
    payload = clipped.tobytes(order="C")
    block_align = channels * 4
    byte_rate = SAMPLE_RATE * block_align
    fmt = struct.pack("<HHIIHH", 3, channels, SAMPLE_RATE, byte_rate, block_align, 32)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(4)
        handle.setframerate(SAMPLE_RATE)
        # wave writes a PCM-style header for setcomptype NONE. Replace the
        # format tag with IEEE float after writing, retaining the valid chunks.
        handle.writeframes(payload)
    data = bytearray(path.read_bytes())
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE" and data[12:16] == b"fmt ":
        data[20:22] = struct.pack("<H", 3)
        data[16:36] = struct.pack("<I", 16) + fmt
        path.write_bytes(data)


def analysis_window() -> np.ndarray:
    window = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(FFT_SIZE) / FFT_SIZE))
    for offset in range(HOP_SIZE):
        indices = np.arange(offset, FFT_SIZE, HOP_SIZE)
        energy = float(np.sum(window[indices] ** 2))
        if energy <= EPSILON:
            _fail("invalid STFT window normalization")
        window[indices] /= math.sqrt(energy)
    return window.astype(np.float32)


WINDOW = analysis_window()


def stft_chunk(samples: np.ndarray) -> np.ndarray:
    """Return [frames, bins, channels], matching the C runtime's 1024 bins."""
    if samples.shape != (HISTORY_SAMPLES + CHUNK_SAMPLES, 2):
        _fail(f"STFT chunk must be [{HISTORY_SAMPLES + CHUNK_SAMPLES}, 2]")
    result = np.empty((ACTIVE_FRAMES, MODEL_BINS, 2), dtype=np.complex64)
    for frame in range(ACTIVE_FRAMES):
        start = frame * HOP_SIZE
        for channel in range(2):
            spectrum = np.fft.rfft(samples[start:start + FFT_SIZE, channel] * WINDOW, FFT_SIZE)
            # The runtime deliberately stores bins 0..1023 and sets Nyquist
            # bin 1024 to zero when synthesizing the Hermitian spectrum.
            result[frame, :, channel] = spectrum[:MODEL_BINS]
    return result


def istft_chunk(spectra: np.ndarray) -> np.ndarray:
    """Inverse the runtime's 1024-bin real-valued spectrum into [samples, 2]."""
    if spectra.shape != (ACTIVE_FRAMES, MODEL_BINS, 2):
        _fail(f"ISTFT chunk must be {ACTIVE_FRAMES, MODEL_BINS, 2}")
    total = CHUNK_SAMPLES + HISTORY_SAMPLES
    output = np.zeros((total, 2), dtype=np.float32)
    for frame in range(ACTIVE_FRAMES):
        for channel in range(2):
            half = np.zeros(FFT_SIZE // 2 + 1, dtype=np.complex64)
            half[:MODEL_BINS] = spectra[frame, :, channel]
            time = np.fft.irfft(half, FFT_SIZE).astype(np.float32)
            start = frame * HOP_SIZE
            output[start:start + FFT_SIZE, channel] += time * WINDOW
    return output


def _sigmoid(values: np.ndarray) -> np.ndarray:
    values = np.clip(values, -80.0, 80.0)
    return 1.0 / (1.0 + np.exp(-values))


def normalize_model_output(output: np.ndarray) -> np.ndarray:
    """Normalize supported SavedModel layouts to [frames, bins, channels]."""
    array = np.asarray(output)
    if array.shape == (1, MODEL_BINS, CONTEXT_FRAMES, 2):
        return _sigmoid(array[0, :, SLICE_START:SLICE_START + ACTIVE_FRAMES, :]).transpose(1, 0, 2)
    if array.shape == (MODEL_BINS, CONTEXT_FRAMES, 2):
        return _sigmoid(array[:, SLICE_START:SLICE_START + ACTIVE_FRAMES, :]).transpose(1, 0, 2)
    if array.shape == (2, ACTIVE_FRAMES, MODEL_BINS):
        # Compact artifacts already contain sigmoid output. This is accepted
        # only for diagnostics; the baseline contract remains full context.
        return np.transpose(array, (1, 2, 0)).astype(np.float32)
    if array.shape == (1, 2, ACTIVE_FRAMES, MODEL_BINS):
        return np.transpose(array[0], (1, 2, 0)).astype(np.float32)
    _fail(
        "unsupported model output shape {}; expected [1,1024,64,2] or a known "
        "diagnostic compact layout. The production context must remain 64 frames."
        .format(tuple(array.shape))
    )


class SavedModelMaskPredictor:
    def __init__(self, model_path: Path):
        try:
            import tensorflow as tf
        except ImportError as exc:
            _fail(f"TensorFlow is required for model rendering: {exc}")
        try:
            self.model = tf.saved_model.load(str(model_path))
            self.signature = self.model.signatures["serving_default"]
        except Exception as exc:  # TensorFlow errors vary by version.
            _fail(f"cannot load SavedModel {model_path}: {exc}")
        self.tf = tf

    def __call__(self, normalized_context: np.ndarray) -> np.ndarray:
        if normalized_context.shape != (MODEL_BINS, CONTEXT_FRAMES, 2):
            _fail(f"model context must have shape {(MODEL_BINS, CONTEXT_FRAMES, 2)}")
        tensor = self.tf.convert_to_tensor(normalized_context[None], dtype=self.tf.float32)
        try:
            result = self.signature(input=tensor)
        except Exception as exc:
            _fail(f"SavedModel inference failed: {exc}")
        if not result:
            _fail("SavedModel returned no outputs")
        output = next(iter(result.values()))
        return normalize_model_output(output.numpy())


@dataclass
class RenderResult:
    audio: np.ndarray
    masks: np.ndarray
    padded_samples: int
    model_calls: int


def _as_stereo(audio: np.ndarray) -> np.ndarray:
    if audio.ndim != 2 or audio.shape[1] not in (1, 2):
        _fail("audio must have shape [samples, 1|2]")
    if audio.shape[1] == 1:
        return np.repeat(audio, 2, axis=1)
    return np.ascontiguousarray(audio, dtype=np.float32)


def _chunk(audio: np.ndarray, index: int) -> tuple[np.ndarray, int]:
    start = index * CHUNK_SAMPLES
    part = audio[start:start + CHUNK_SAMPLES]
    missing = max(0, CHUNK_SAMPLES - len(part))
    if missing:
        part = np.pad(part, ((0, missing), (0, 0)))
    return np.ascontiguousarray(part, dtype=np.float32), missing


def render_eco(
    audio: np.ndarray,
    mask_provider: Callable[[np.ndarray, np.ndarray], np.ndarray],
) -> RenderResult:
    """Render a delayed ECO stream using a caller-provided mask provider.

    `mask_provider(context, current_spectrum)` returns [15,1024,2]. The
    current mask is intentionally applied to the spectrum one chunk behind,
    matching `stft_apply_mask_delayed(1, ...)` in the runtime.
    """
    source = _as_stereo(audio)
    chunk_count = max(1, math.ceil(len(source) / CHUNK_SAMPLES))
    total_padded = chunk_count * CHUNK_SAMPLES
    history = np.zeros((HISTORY_SAMPLES, 2), dtype=np.float32)
    context = np.zeros((CONTEXT_FRAMES, MODEL_BINS, 2), dtype=np.float32)
    peak_history: list[float] = []
    spectra_queue: list[np.ndarray] = []
    mask_queue: list[np.ndarray] = []
    output_chunks: list[np.ndarray] = []
    mask_history: list[np.ndarray] = []
    padded_samples = 0

    def process(current: np.ndarray, missing: int) -> None:
        nonlocal history, context, padded_samples
        padded_samples += missing
        window = np.concatenate((history, current), axis=0)
        current_spectrum = stft_chunk(window)
        magnitudes = np.abs(current_spectrum).astype(np.float32)
        context = np.concatenate((context[ACTIVE_FRAMES:], magnitudes), axis=0)
        peak_history.append(float(np.max(magnitudes, initial=1.0e-5)))
        global_max = max(1.0e-4, *peak_history[-4:])
        # The rolling cache is kept time-major to mirror the queue operation;
        # the SavedModel input contract is frequency-major [1024,64,2].
        normalized = (context / global_max).transpose(1, 0, 2).astype(np.float32)
        current_mask = np.clip(mask_provider(normalized, current_spectrum), 0.0, 1.0)
        if current_mask.shape != (ACTIVE_FRAMES, MODEL_BINS, 2):
            _fail(f"mask provider returned {current_mask.shape}, expected {(ACTIVE_FRAMES, MODEL_BINS, 2)}")
        spectra_queue.append(current_spectrum)
        mask_queue.append(current_mask)
        mask_history.append(current_mask.copy())

        if len(spectra_queue) <= DELAY_CHUNKS:
            target = np.zeros_like(current_spectrum)
        else:
            target = spectra_queue[-DELAY_CHUNKS - 1] * mask_queue[-1]
        rendered = istft_chunk(target)
        if output_chunks:
            rendered[:HISTORY_SAMPLES] += output_chunks[-1][CHUNK_SAMPLES:CHUNK_SAMPLES + HISTORY_SAMPLES]
        output_chunks.append(rendered)
        history = current[-HISTORY_SAMPLES:].copy()

    for index in range(chunk_count):
        current, missing = _chunk(source, index)
        process(current, missing)

    # Flush the final queued target. The zero chunk is not part of the report's
    # input; it only lets the one-chunk-lookahead stream emit the final source
    # chunk instead of silently dropping it.
    process(np.zeros((CHUNK_SAMPLES, 2), dtype=np.float32), 0)

    # The first output is the one-chunk warm-up silence. Keep exactly the
    # padded source duration after removing it.
    rendered = np.concatenate(output_chunks[1:], axis=0)[:total_padded]
    masks = np.stack(mask_history[:chunk_count], axis=0)
    return RenderResult(rendered, masks, padded_samples, chunk_count + 1)


def model_provider(predictor: SavedModelMaskPredictor) -> Callable[[np.ndarray, np.ndarray], np.ndarray]:
    def provide(context: np.ndarray, _current_spectrum: np.ndarray) -> np.ndarray:
        return predictor(context)
    return provide


def raw_model_provider(predictor: SavedModelMaskPredictor) -> Callable[[np.ndarray, np.ndarray], np.ndarray]:
    return model_provider(predictor)


def oracle_provider() -> Callable[[np.ndarray, np.ndarray], np.ndarray]:
    def provide(_context: np.ndarray, current_spectrum: np.ndarray) -> np.ndarray:
        # This provider is replaced by the stem-aware renderer below. Keeping
        # the callable here makes accidental use without stems fail loudly.
        _fail("oracle provider requires vocal and instrumental stems")
    return provide


def render_oracle(audio: np.ndarray, vocal: np.ndarray, instrumental: np.ndarray) -> RenderResult:
    mixture = _as_stereo(audio)
    vocal = _as_stereo(vocal)
    instrumental = _as_stereo(instrumental)
    length = max(len(mixture), len(vocal), len(instrumental))
    mixture = np.pad(mixture, ((0, length - len(mixture)), (0, 0)))
    vocal = np.pad(vocal, ((0, length - len(vocal)), (0, 0)))
    instrumental = np.pad(instrumental, ((0, length - len(instrumental)), (0, 0)))
    ratio_masks: dict[int, np.ndarray] = {}

    def provide(_context: np.ndarray, current_spectrum: np.ndarray) -> np.ndarray:
        # The provider is called once per chunk. The spectrum is the current
        # mixture chunk, while the ideal mask uses the same local stem chunk.
        index = len(ratio_masks)
        start = index * CHUNK_SAMPLES
        current, _ = _chunk(instrumental, index)
        vocal_chunk, _ = _chunk(vocal, index)
        history_start = max(0, start - HISTORY_SAMPLES)
        # Boundary padding mirrors the runtime's zero-filled initial history.
        i_history = instrumental[history_start:start]
        v_history = vocal[history_start:start]
        if len(i_history) < HISTORY_SAMPLES:
            i_history = np.pad(i_history, ((HISTORY_SAMPLES - len(i_history), 0), (0, 0)))
            v_history = np.pad(v_history, ((HISTORY_SAMPLES - len(v_history), 0), (0, 0)))
        i_spec = stft_chunk(np.concatenate((i_history, current), axis=0))
        v_spec = stft_chunk(np.concatenate((v_history, vocal_chunk), axis=0))
        mask = np.abs(i_spec) / (np.abs(i_spec) + np.abs(v_spec) + 1.0e-7)
        ratio_masks[index] = mask.astype(np.float32)
        return ratio_masks[index]

    result = render_eco(mixture, provide)
    return RenderResult(result.audio, np.stack(list(ratio_masks.values()), axis=0), result.padded_samples, result.model_calls)


def rms(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(audio, dtype=np.float64)) + EPSILON))


def db(value: float) -> float:
    return float(20.0 * np.log10(max(value, 1.0e-12)))


def si_sdr(estimate: np.ndarray, target: np.ndarray) -> float:
    estimate = estimate.reshape(-1).astype(np.float64)
    target = target.reshape(-1).astype(np.float64)
    length = min(len(estimate), len(target))
    estimate = estimate[:length] - np.mean(estimate[:length])
    target = target[:length] - np.mean(target[:length])
    scale = np.dot(estimate, target) / max(np.dot(target, target), EPSILON)
    projected = scale * target
    noise = estimate - projected
    return float(10.0 * np.log10(max(np.sum(projected ** 2), EPSILON) / max(np.sum(noise ** 2), EPSILON)))


def spectral_distance(left: np.ndarray, right: np.ndarray) -> float:
    """Small multi-resolution magnitude distance, not a replacement for listening."""
    values = []
    for size in (512, 1024, 2048):
        hop = size // 4
        window = np.hanning(size).astype(np.float32)
        count = max(1, (min(len(left), len(right)) - size) // hop + 1)
        total = 0.0
        used = 0
        for index in range(count):
            start = index * hop
            if start + size > len(left) or start + size > len(right):
                break
            a = np.abs(np.fft.rfft(left[start:start + size] * window))
            b = np.abs(np.fft.rfft(right[start:start + size] * window))
            total += float(np.mean(np.abs(np.log1p(a) - np.log1p(b))))
            used += 1
        values.append(total / max(used, 1))
    return float(np.mean(values))


def delayed_reference(audio: np.ndarray, length: int) -> np.ndarray:
    reference = _as_stereo(audio)
    delayed = np.zeros((length, 2), dtype=np.float32)
    offset = CHUNK_SAMPLES
    copy_length = min(len(reference), max(0, length - offset))
    delayed[offset:offset + copy_length] = reference[:copy_length]
    return delayed


def mask_metrics(masks: np.ndarray) -> dict:
    if len(masks) < 2:
        delta = 0.0
    else:
        delta = float(np.mean(np.abs(np.diff(masks, axis=0))))
    left_right = float(np.mean(np.abs(masks[:, :, :, 0] - masks[:, :, :, 1])))
    return {
        "mean": float(np.mean(masks)),
        "p05": float(np.quantile(masks, 0.05)),
        "p50": float(np.quantile(masks, 0.50)),
        "p95": float(np.quantile(masks, 0.95)),
        "frame_to_frame_mean_abs_delta": delta,
        "left_right_mean_abs_difference": left_right,
    }


def audio_metrics(output: np.ndarray, instrumental: Optional[np.ndarray]) -> dict:
    metrics = {
        "rms_db": db(rms(output)),
        "peak_db": db(float(np.max(np.abs(output), initial=0.0))),
    }
    if instrumental is not None:
        reference = delayed_reference(instrumental, len(output))
        residual = output - reference
        metrics.update({
            "instrumental_reference_si_sdr_db": si_sdr(output, reference),
            "residual_rms_db": db(rms(residual)),
            "instrumental_error_rms_db": db(rms(residual)),
            "multi_resolution_spectral_distance": spectral_distance(output[:, 0], reference[:, 0]),
            "stereo_correlation": float(np.corrcoef(output[:, 0], output[:, 1])[0, 1])
            if len(output) > 1 else 1.0,
        })
    return metrics


def infer_root_cause(report: dict) -> list[str]:
    if not report.get("has_stems"):
        return ["not_decided: provide licensed vocal/instrumental stems for Phase A"]
    model = report["renders"]["current_model_raw"]
    oracle = report["renders"]["oracle_ideal_ratio_mask"]
    if oracle["residual_rms_db"] - model["residual_rms_db"] > 3.0:
        return ["model-mask leakage is plausible"]
    if oracle["residual_rms_db"] > -35.0:
        return ["mixture-phase/STFT limitation is plausible"]
    if model["mask"]["frame_to_frame_mean_abs_delta"] > 0.08:
        return ["temporal mask modulation is plausible"]
    return ["no single model root cause established; inspect realtime capture/state"]


def build_report(args: argparse.Namespace) -> dict:
    input_audio, _ = read_wav(Path(args.input))
    vocal = instrumental = None
    if args.vocal or args.instrumental:
        if not (args.vocal and args.instrumental):
            _fail("--vocal and --instrumental must be provided together")
        vocal, _ = read_wav(Path(args.vocal))
        instrumental, _ = read_wav(Path(args.instrumental))

    predictor = SavedModelMaskPredictor(Path(args.model))
    current = render_eco(input_audio, model_provider(predictor))
    control = render_eco(input_audio, raw_model_provider(predictor))
    renders = {
        "current_model_raw": {
            "mask": mask_metrics(current.masks),
            **audio_metrics(current.audio, instrumental),
            "model_calls": current.model_calls,
        },
        "raw_model_control": {
            "mask": mask_metrics(control.masks),
            **audio_metrics(control.audio, instrumental),
            "model_calls": control.model_calls,
        },
    }
    oracle = None
    if vocal is not None and instrumental is not None:
        oracle = render_oracle(input_audio, vocal, instrumental)
        renders["oracle_ideal_ratio_mask"] = {
            "mask": mask_metrics(oracle.masks),
            **audio_metrics(oracle.audio, instrumental),
            "model_calls": oracle.model_calls,
        }
        reference_audio = delayed_reference(instrumental, len(current.audio))
        renders["ground_truth_instrumental_reference"] = audio_metrics(reference_audio, instrumental)

    report = {
        "status": "diagnostic_only",
        "has_stems": vocal is not None and instrumental is not None,
        "contract": {
            "sample_rate": SAMPLE_RATE,
            "fft_size": FFT_SIZE,
            "hop_size": HOP_SIZE,
            "context_frames": CONTEXT_FRAMES,
            "active_frames": ACTIVE_FRAMES,
            "slice_start": SLICE_START,
            "chunk_samples": CHUNK_SAMPLES,
            "delay_chunks": DELAY_CHUNKS,
        },
        "input": {
            "path": str(Path(args.input).resolve()),
            "samples": int(len(input_audio)),
            "padded_to_samples": int(current.audio.shape[0]),
            "padded_samples": int(current.padded_samples),
        },
        "model": {
            "path": str(Path(args.model).resolve()),
            "output_contract": "[1,1024,64,2] logits -> sigmoid -> frames 34..48",
        },
        "renders": renders,
    }
    report["likely_root_cause"] = infer_root_cause(report)
    return report


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="licensed 44.1 kHz mono/stereo mixture WAV")
    parser.add_argument("--model", required=True, help="SavedModel directory")
    parser.add_argument("--vocal", help="licensed vocal stem WAV")
    parser.add_argument("--instrumental", help="licensed instrumental stem WAV")
    parser.add_argument("--output-dir", required=True, help="report directory outside Git")
    args = parser.parse_args(argv)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    input_audio, _ = read_wav(Path(args.input))
    predictor = SavedModelMaskPredictor(Path(args.model))
    current = render_eco(input_audio, model_provider(predictor))
    control = render_eco(input_audio, raw_model_provider(predictor))
    write_float_wav(output_dir / "current-model-raw.wav", current.audio)
    write_float_wav(output_dir / "raw-model-control.wav", control.audio)

    # Re-run report construction so all optional stem checks and metrics stay
    # in one auditable code path. The second model pass is deliberate and only
    # used by this diagnostic command; it never runs in Extension/GO runtime.
    report = build_report(args)
    if args.vocal and args.instrumental:
        vocal, _ = read_wav(Path(args.vocal))
        instrumental, _ = read_wav(Path(args.instrumental))
        oracle = render_oracle(input_audio, vocal, instrumental)
        write_float_wav(output_dir / "oracle-ideal-ratio-mask.wav", oracle.audio)
        write_float_wav(output_dir / "ground-truth-instrumental-reference.wav", delayed_reference(instrumental, len(current.audio)))
    report["outputs"] = {
        "current_model_raw": "current-model-raw.wav",
        "raw_model_control": "raw-model-control.wav",
        "oracle_ideal_ratio_mask": "oracle-ideal-ratio-mask.wav" if args.vocal else None,
        "ground_truth_instrumental_reference": "ground-truth-instrumental-reference.wav" if args.instrumental else None,
    }
    (output_dir / "REPORT.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(output_dir / "REPORT.json"), "likely_root_cause": report["likely_root_cause"]}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
