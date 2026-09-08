import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const NUM_BINS = 1024;
const MAX_FRAMES = 64;
const FRAMES = 15;
const HOP = 512;
const INPUT_SAMPLES = FRAMES * HOP + 2048;
const wasmPaths = ['stft_simd.wasm', 'stft_scalar.wasm'];

async function checkWasm(name) {
  const bytes = fs.readFileSync(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)));
  const module = await WebAssembly.compile(bytes);
  const instance = await WebAssembly.instantiate(module, { env: {} });
  const exp = instance.exports;
  exp.stft_init();
  const f32 = new Float32Array(exp.memory.buffer);
  const inL = exp.stft_get_input_ptr(0) / 4;
  const inR = exp.stft_get_input_ptr(1) / 4;
  const magL = exp.stft_get_magnitudes_ptr(0) / 4;
  const magR = exp.stft_get_magnitudes_ptr(1) / 4;
  const norm = exp.stft_get_norm_input_ptr() / 4;
  const history = new Float32Array(NUM_BINS * MAX_FRAMES * 2);
  const maxHistory = new Float32Array([1e-4, 1e-4, 1e-4, 1e-4]);
  let maxPos = 0;
  let worstError = 0;

  for (let chunk = 0; chunk < 8; chunk++) {
    for (let i = 0; i < INPUT_SAMPLES; i++) {
      const t = (i + chunk * FRAMES * HOP) / 44100;
      f32[inL + i] = 0.23 * Math.sin(2 * Math.PI * 211 * t) +
        0.07 * Math.sin(2 * Math.PI * 1433 * t) + (i < 17 ? 0.1 : 0);
      f32[inR + i] = 0.29 * Math.cos(2 * Math.PI * 317 * t) +
        0.05 * Math.sin(2 * Math.PI * 877 * t) + (i < 31 ? -0.08 : 0);
    }
    exp.stft_forward(FRAMES);
    const chunkPeak = exp.stft_get_chunk_peak();
    maxHistory[maxPos] = chunkPeak;
    maxPos = (maxPos + 1) & 3;

    // Reference implementation of the former linear rolling window. Its
    // frame/channel order is the model input order [bin][frame][stereo].
    const next = new Float32Array(history.length);
    for (let k = 0; k < NUM_BINS; k++) {
      const base = k * MAX_FRAMES * 2;
      next.set(history.subarray(base + FRAMES * 2, base + MAX_FRAMES * 2), base);
      for (let f = 0; f < FRAMES; f++) {
        next[base + (MAX_FRAMES - FRAMES + f) * 2] = f32[magL + f * NUM_BINS + k];
        next[base + (MAX_FRAMES - FRAMES + f) * 2 + 1] = f32[magR + f * NUM_BINS + k];
      }
    }
    history.set(next);

    let globalMax = 1e-4;
    for (const value of maxHistory) globalMax = Math.max(globalMax, value);
    const invMax = 1 / globalMax;
    exp.stft_prepare_norm_input(invMax);
    for (let i = 0; i < history.length; i++) {
      const error = Math.abs(f32[norm + i] - history[i] * invMax);
      worstError = Math.max(worstError, error);
      assert.ok(error <= 2e-6, `${name}: rolling input mismatch chunk=${chunk} offset=${i}: ${error}`);
    }
  }

  return { name, chunks: 8, worstError };
}

const results = [];
for (const name of wasmPaths) results.push(await checkWasm(name));
console.log(JSON.stringify(results));
console.log('Circular rolling model input matches the former linear-window reference.');
