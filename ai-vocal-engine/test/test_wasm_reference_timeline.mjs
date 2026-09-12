import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BINS = 1024;
const CONTEXT_FRAMES = 64;
const HOP = 512;
const FFT = 2048;
const NEW_FRAMES = 16;
const ANALYSIS_FRAMES = 18;
const RAW_SAMPLES = NEW_FRAMES * HOP;
const HISTORY_SAMPLES = 512;
const INPUT_SAMPLES = HISTORY_SAMPLES + RAW_SAMPLES + FFT;

function instantiate(name) {
  const bytes = fs.readFileSync(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)));
  return WebAssembly.instantiate(bytes, { env: {} }).then(({ instance }) => instance);
}

async function check(name) {
  const instance = await instantiate(name);
  const exp = instance.exports;
  assert.equal(typeof exp.stft_forward_reference, 'function', `${name}: reference forward export missing`);
  assert.equal(typeof exp.stft_get_rolling_max, 'function', `${name}: rolling max export missing`);

  exp.stft_init();
  const memory = new Float32Array(exp.memory.buffer);
  const inputL = exp.stft_get_input_ptr(0) / 4;
  const inputR = exp.stft_get_input_ptr(1) / 4;
  const magL = exp.stft_get_magnitudes_ptr(0) / 4;
  const magR = exp.stft_get_magnitudes_ptr(1) / 4;
  const referenceMagL = exp.stft_get_reference_magnitudes_ptr() / 4;
  const referenceMagR = exp.stft_get_reference_magnitudes_ptr(1) / 4;
  const normalized = exp.stft_get_norm_input_ptr() / 4;

  const rolling = new Float32Array(BINS * CONTEXT_FRAMES * 2);
  const previousTailL = new Float32Array(HISTORY_SAMPLES);
  const previousTailR = new Float32Array(HISTORY_SAMPLES);
  let worstRollingError = 0;
  let worstNormalizedError = 0;

  for (let chunk = 0; chunk < 8; chunk++) {
    const rawL = new Float32Array(RAW_SAMPLES);
    const rawR = new Float32Array(RAW_SAMPLES);
    for (let i = 0; i < RAW_SAMPLES; i++) {
      const t = (chunk * RAW_SAMPLES + i) / 44100;
      rawL[i] = 0.21 * Math.sin(2 * Math.PI * 211 * t) +
        0.06 * Math.sin(2 * Math.PI * 1433 * t);
      rawR[i] = 0.27 * Math.cos(2 * Math.PI * 317 * t) +
        0.04 * Math.sin(2 * Math.PI * 877 * t);
    }

    // This is the same byte-offset layout used by the reference bundle:
    // 2,048 bytes (512 samples) of rewind history, followed by 7,680 new
    // samples, with deterministic zero padding for the final FFT boundaries.
    memory.set(previousTailL, inputL);
    memory.set(rawL, inputL + HISTORY_SAMPLES);
    memory.fill(0, inputL + HISTORY_SAMPLES + RAW_SAMPLES, inputL + INPUT_SAMPLES);
    memory.set(previousTailR, inputR);
    memory.set(rawR, inputR + HISTORY_SAMPLES);
    memory.fill(0, inputR + HISTORY_SAMPLES + RAW_SAMPLES, inputR + INPUT_SAMPLES);

    exp.stft_forward_reference();

    // The reference model receives 16 fresh magnitudes while the synthesis
    // side keeps 18 spectra. The C API exposes those 16 frames compactly.
    const nextRolling = new Float32Array(rolling.length);
    for (let k = 0; k < BINS; k++) {
      const base = k * CONTEXT_FRAMES * 2;
      nextRolling.set(
        rolling.subarray(base + 15 * 2, base + CONTEXT_FRAMES * 2),
        base
      );
      for (let f = 0; f < NEW_FRAMES; f++) {
        nextRolling[base + (CONTEXT_FRAMES - NEW_FRAMES + f) * 2] = memory[referenceMagL + f * BINS + k];
        nextRolling[base + (CONTEXT_FRAMES - NEW_FRAMES + f) * 2 + 1] = memory[referenceMagR + f * BINS + k];
      }
    }
    rolling.set(nextRolling);

    let expectedMax = 1e-4;
    for (const value of rolling) expectedMax = Math.max(expectedMax, value);
    assert.ok(Math.abs(exp.stft_get_rolling_max() - expectedMax) <= 2e-5,
      `${name}: rolling max mismatch at chunk ${chunk}`);
    exp.stft_prepare_norm_input(1 / expectedMax);

    for (let i = 0; i < rolling.length; i++) {
      const expected = rolling[i] / expectedMax;
      const actual = memory[normalized + i];
      worstRollingError = Math.max(worstRollingError, Math.abs(actual * expectedMax - rolling[i]));
      worstNormalizedError = Math.max(worstNormalizedError, Math.abs(actual - expected));
      assert.ok(Math.abs(actual - expected) <= 2e-6,
        `${name}: normalized context mismatch at chunk ${chunk}, offset ${i}`);
    }

    previousTailL.set(rawL.subarray(RAW_SAMPLES - HISTORY_SAMPLES));
    previousTailR.set(rawR.subarray(RAW_SAMPLES - HISTORY_SAMPLES));
  }

  // The delayed synthesis entry must accept all 18 reference frames and
  // produce finite PCM without touching memory outside the output window.
  const maskL = exp.stft_get_mask_ptr(0) / 4;
  const maskR = exp.stft_get_mask_ptr(1) / 4;
  memory.fill(0, maskL, maskL + ANALYSIS_FRAMES * BINS);
  memory.fill(0, maskR, maskR + ANALYSIS_FRAMES * BINS);
  exp.stft_backward_masked(0, ANALYSIS_FRAMES, 2, 0);
  const outputL = exp.stft_get_output_ptr(0) / 4;
  const outputR = exp.stft_get_output_ptr(1) / 4;
  for (const offset of [384, 384 + RAW_SAMPLES - 1]) {
    assert.ok(Number.isFinite(memory[outputL + offset]), `${name}: non-finite reference output L`);
    assert.ok(Number.isFinite(memory[outputR + offset]), `${name}: non-finite reference output R`);
  }

  return { name, chunks: 8, worstRollingError, worstNormalizedError };
}

const results = [];
for (const name of ['stft_simd.wasm', 'stft_scalar.wasm']) results.push(await check(name));
console.log(JSON.stringify(results));
console.log('Reference 18-spectrum / 16-magnitude timeline passed for SIMD and scalar WASM.');
