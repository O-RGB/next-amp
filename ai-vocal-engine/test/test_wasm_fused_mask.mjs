import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const wasmPath = fileURLToPath(new URL('../dist/stft_simd.wasm', import.meta.url));
const wasmBytes = fs.readFileSync(wasmPath);
const wasmModule = await WebAssembly.compile(wasmBytes);

const FFT_INPUT = 8192 + 1536;
const NUM_BINS = 1024;
const FRAMES = 16;
const HOP = 512;

async function createState() {
  const instance = await WebAssembly.instantiate(wasmModule, { env: {} });
  const exp = instance.exports;
  exp.stft_init();
  const f32 = new Float32Array(exp.memory.buffer);
  return {
    exp,
    f32,
    inL: exp.stft_get_input_ptr(0) / 4,
    inR: exp.stft_get_input_ptr(1) / 4,
    outL: exp.stft_get_output_ptr(0) / 4,
    outR: exp.stft_get_output_ptr(1) / 4,
    maskL: exp.stft_get_mask_ptr(0) / 4,
    maskR: exp.stft_get_mask_ptr(1) / 4
  };
}

function fillInput(state, offset) {
  for (let i = 0; i < FFT_INPUT; i++) {
    const t = (i + offset * HOP) / 44100;
    state.f32[state.inL + i] = 0.31 * Math.sin(2 * Math.PI * 227 * t) +
      0.08 * Math.sin(2 * Math.PI * 1731 * t) + (i < 13 ? 0.2 : 0);
    state.f32[state.inR + i] = 0.27 * Math.sin(2 * Math.PI * 331 * t) +
      0.11 * Math.cos(2 * Math.PI * 941 * t) + (i < 29 ? -0.15 : 0);
  }
}

function fillMask(state, mode) {
  for (let i = 0; i < FRAMES * NUM_BINS; i++) {
    const value = 0.04 + 0.9 * ((i * 17 + mode * 31) % 101) / 100;
    state.f32[state.maskL + i] = value;
    state.f32[state.maskR + i] = 1 - value * 0.71;
  }
}

function render(state, fused, delay, mode) {
  state.exp.stft_reset();
  fillInput(state, 0);
  state.exp.stft_forward(FRAMES);
  fillInput(state, 1);
  state.exp.stft_forward(FRAMES);
  fillMask(state, mode);
  if (fused) {
    state.exp.stft_backward_masked(delay, FRAMES, mode, 0.87);
  } else {
    state.exp.stft_apply_mask_delayed(delay, FRAMES, mode, 0.87);
    state.exp.stft_backward(FRAMES);
  }
  return [
    state.f32.slice(state.outL, state.outL + FRAMES * HOP),
    state.f32.slice(state.outR, state.outR + FRAMES * HOP)
  ];
}

const reference = await createState();
const fused = await createState();
let worstError = 0;
for (const delay of [0, 1, 2]) {
  for (const mode of [0, 1, 2]) {
    const expected = render(reference, false, delay, mode);
    const actual = render(fused, true, delay, mode);
    for (let channel = 0; channel < 2; channel++) {
      for (let i = 0; i < expected[channel].length; i++) {
        const error = Math.abs(expected[channel][i] - actual[channel][i]);
        worstError = Math.max(worstError, error);
        assert.ok(error <= 1e-6, `fused mask mismatch delay=${delay} mode=${mode} channel=${channel} sample=${i}: ${error}`);
      }
    }
  }
}

console.log(JSON.stringify({ delays: 3, modes: 3, worstError }));
console.log('Fused delayed-mask/iSTFT path is PCM-equivalent to the reference path.');
