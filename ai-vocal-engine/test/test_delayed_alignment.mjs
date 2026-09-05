import assert from 'node:assert/strict';
import fs from 'node:fs';

const wasmBytes = fs.readFileSync(new URL('../dist/stft_simd.wasm', import.meta.url));
const FRAMES = 15;
const HOP = 512;
const CHUNK = FRAMES * HOP;
const TAIL = 1536;
const BINS = 1024;
const CHUNKS = 6;

async function createState() {
  const { instance } = await WebAssembly.instantiate(wasmBytes, { env: {} });
  const exp = instance.exports;
  exp.stft_init();
  return {
    exp,
    mem: new Float32Array(exp.memory.buffer),
    inPtrs: [exp.stft_get_input_ptr(0) / 4, exp.stft_get_input_ptr(1) / 4],
    outPtrs: [exp.stft_get_output_ptr(0) / 4, exp.stft_get_output_ptr(1) / 4],
    maskPtrs: [exp.stft_get_mask_ptr(0) / 4, exp.stft_get_mask_ptr(1) / 4],
    histories: [new Float32Array(TAIL), new Float32Array(TAIL)],
    tails: [new Float32Array(TAIL), new Float32Array(TAIL)]
  };
}

function makeRaw(chunk, channel) {
  return Float32Array.from({ length: CHUNK }, (_, i) => {
    const t = (chunk * CHUNK + i) / 44100;
    const tone = Math.sin(2 * Math.PI * (channel ? 330 : 220) * t) * 0.3;
    const transient = i === 2048 + (chunk % 3) * 256 ? 0.7 : 0;
    return tone + transient;
  });
}

function setMask(state, value) {
  for (const ptr of state.maskPtrs) state.mem.fill(value, ptr, ptr + FRAMES * BINS);
}

function render(state, raw, maskValue, delay) {
  for (let ch = 0; ch < 2; ch++) {
    const ptr = state.inPtrs[ch];
    state.mem.set(state.histories[ch], ptr);
    state.mem.set(raw[ch], ptr + TAIL);
    state.histories[ch].set(raw[ch].subarray(CHUNK - TAIL));
  }
  state.exp.stft_forward(FRAMES);
  setMask(state, maskValue);
  state.exp.stft_apply_mask_delayed(delay, FRAMES, 1, 1);
  state.exp.stft_backward(FRAMES);

  const result = [0, 1].map(ch => {
    const ptr = state.outPtrs[ch];
    const output = new Float32Array(CHUNK);
    for (let i = 0; i < TAIL; i++) state.mem[ptr + i] += state.tails[ch][i];
    output.set(state.mem.subarray(ptr, ptr + CHUNK));
    state.tails[ch].set(state.mem.subarray(ptr + CHUNK, ptr + CHUNK + TAIL));
    return output;
  });
  return result;
}

function renderDirect(state, raw, maskValue) {
  for (let ch = 0; ch < 2; ch++) {
    const ptr = state.inPtrs[ch];
    state.mem.set(state.histories[ch], ptr);
    state.mem.set(raw[ch], ptr + TAIL);
    state.histories[ch].set(raw[ch].subarray(CHUNK - TAIL));
  }
  state.exp.stft_forward(FRAMES);
  setMask(state, maskValue);
  state.exp.stft_apply_mask(FRAMES, 1, 1);
  state.exp.stft_backward(FRAMES);

  return [0, 1].map(ch => {
    const ptr = state.outPtrs[ch];
    const output = new Float32Array(CHUNK);
    for (let i = 0; i < TAIL; i++) state.mem[ptr + i] += state.tails[ch][i];
    output.set(state.mem.subarray(ptr, ptr + CHUNK));
    state.tails[ch].set(state.mem.subarray(ptr + CHUNK, ptr + CHUNK + TAIL));
    return output;
  });
}

const raw = Array.from({ length: CHUNKS }, (_, chunk) => [makeRaw(chunk, 0), makeRaw(chunk, 1)]);
const maskForChunk = chunk => 0.25 + chunk * 0.1;

for (let delay = 0; delay < 4; delay++) {
  const direct = await createState();
  const delayed = await createState();
  const directOutputs = [];
  const delayedOutputs = [];
  for (let chunk = 0; chunk < CHUNKS; chunk++) {
    directOutputs.push(renderDirect(direct, raw[chunk], maskForChunk(chunk)));
    const target = chunk - delay;
    delayedOutputs.push(render(delayed, raw[chunk], target >= 0 ? maskForChunk(target) : 0, delay));
  }

  let maxError = 0;
  for (let chunk = delay; chunk < CHUNKS; chunk++) {
    for (let ch = 0; ch < 2; ch++) {
      for (let i = 0; i < CHUNK; i++) {
        maxError = Math.max(maxError, Math.abs(delayedOutputs[chunk][ch][i] - directOutputs[chunk - delay][ch][i]));
      }
    }
  }
  assert.ok(maxError <= 1e-6, `delay ${delay}: max PCM error ${maxError}`);
  console.log(JSON.stringify({ delayChunks: delay, depth: delay + 1, frames: FRAMES, maxPcmError: maxError }));
}

console.log('Delayed complex-spectrum alignment passed for depth 1-4.');
