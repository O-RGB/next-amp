import assert from 'node:assert/strict';
import fs from 'node:fs';

const wasmPaths = {
  simd: new URL('../dist/stft_simd.wasm', import.meta.url),
  scalar: new URL('../dist/stft_scalar.wasm', import.meta.url)
};
const FFT_SIZE = 2048;
const HOP_SIZE = 512;
const CHUNK_FRAMES = 16;
const NUM_BINS = 1024;
const TOTAL_INPUT = FFT_SIZE + CHUNK_FRAMES * HOP_SIZE;
const TOTAL_OUTPUT = CHUNK_FRAMES * HOP_SIZE + FFT_SIZE - HOP_SIZE;

async function runVariant(path, mode) {
  const bytes = fs.readFileSync(path);
  const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
  const { exports: exp } = instance;
  const f32 = new Float32Array(exp.memory.buffer);
  const inPtrL = exp.stft_get_input_ptr(0) / 4;
  const inPtrR = exp.stft_get_input_ptr(1) / 4;
  const outPtrL = exp.stft_get_output_ptr(0) / 4;
  const outPtrR = exp.stft_get_output_ptr(1) / 4;
  const magPtrL = exp.stft_get_magnitudes_ptr(0) / 4;
  const maskPtrL = exp.stft_get_mask_ptr(0) / 4;
  const maskPtrR = exp.stft_get_mask_ptr(1) / 4;

  exp.stft_init();
  exp.stft_reset();
  for (let i = 0; i < TOTAL_INPUT; i++) {
    const t = i / 44100;
    const noise = (((i * 1103515245 + 12345) >>> 8) % 10000) / 10000 - 0.5;
    f32[inPtrL + i] = 0.42 * Math.sin(2 * Math.PI * 233 * t) + 0.13 * noise;
    f32[inPtrR + i] = 0.31 * Math.cos(2 * Math.PI * 419 * t) - 0.09 * noise;
  }
  for (let i = 0; i < CHUNK_FRAMES * NUM_BINS; i++) {
    const mask = 0.05 + 0.9 * (((i * 37) % 1000) / 1000);
    f32[maskPtrL + i] = mask;
    f32[maskPtrR + i] = 0.95 - mask * 0.7;
  }

  exp.stft_forward(CHUNK_FRAMES);
  const magnitudes = Float32Array.from(f32.subarray(magPtrL, magPtrL + CHUNK_FRAMES * NUM_BINS));
  exp.stft_apply_mask(CHUNK_FRAMES, mode, 0.83);
  exp.stft_backward(CHUNK_FRAMES);

  return {
    magnitudes,
    outputL: Float32Array.from(f32.subarray(outPtrL, outPtrL + TOTAL_OUTPUT)),
    outputR: Float32Array.from(f32.subarray(outPtrR, outPtrR + TOTAL_OUTPUT))
  };
}

function compare(a, b) {
  let maxError = 0;
  let signalPower = 0;
  let errorPower = 0;
  for (let i = 0; i < a.length; i++) {
    const error = a[i] - b[i];
    maxError = Math.max(maxError, Math.abs(error));
    signalPower += a[i] * a[i];
    errorPower += error * error;
  }
  return {
    maxError,
    snrDb: 10 * Math.log10(signalPower / Math.max(errorPower, 1e-30))
  };
}

for (const mode of [0, 1, 2]) {
  const simd = await runVariant(wasmPaths.simd, mode);
  const scalar = await runVariant(wasmPaths.scalar, mode);
  const magnitudeDiff = compare(simd.magnitudes, scalar.magnitudes);
  const leftDiff = compare(simd.outputL, scalar.outputL);
  const rightDiff = compare(simd.outputR, scalar.outputR);
  assert.ok(leftDiff.snrDb > 120 && rightDiff.snrDb > 120,
    `SIMD/scalar PCM divergence in mode ${mode}: ${leftDiff.snrDb}/${rightDiff.snrDb} dB`);
  console.log(JSON.stringify({ mode, magnitudeDiff, leftDiff, rightDiff }));
}

console.log('WASM SIMD/scalar numerical equivalence passed (>120 dB PCM SNR).');
