import assert from 'node:assert/strict';
import fs from 'node:fs';

const BYTES_PER_FLOAT = 4;
const RAW_SAMPLES = 7680;
const INPUT_HISTORY_SAMPLES = 512;
const MAGNITUDE_FRAMES = 16;
const MASK_FRAMES = 18;
const BINS = 1024;
const SPECTRUM_FRAMES = 18;

const bytes = fs.readFileSync(new URL('../../ai remove/stft.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes, {
  a: { a: () => {}, b: () => {} }
});
const exp = instance.exports;

// The reference bundle supplies the analysis/synthesis windows from JS after
// _init(). Reproduce that setup here so this remains a black-box timeline
// oracle rather than accidentally testing the zero-initialized window.
const window = new Float32Array(2048);
for (let i = 0; i < window.length; i++) {
  const denominator = 2048 + (1 - (i % 2)) - 1;
  window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denominator);
}
for (let offset = 0; offset < 512; offset++) {
  let energy = 0;
  for (let i = offset; i < window.length; i += 512) energy += window[i] * window[i];
  const scale = 1 / Math.sqrt(energy);
  for (let i = offset; i < window.length; i += 512) window[i] *= scale;
}

exp.l();
const memory = new Float32Array(exp.c.buffer);
const inputPtr = exp.e(0);
const outputPtr = exp.f(0);
const magnitudesPtr = exp.i(0);
const maskPtr = exp.j(0);
const spectrumPtr = exp.k(0);
memory.set(window, exp.g(0) / BYTES_PER_FLOAT);
memory.set(window, exp.h(0) / BYTES_PER_FLOAT);

const inputView = new Float32Array(memory.buffer, inputPtr + 2048, RAW_SAMPLES);
const outputView = new Float32Array(memory.buffer, outputPtr + 1536, RAW_SAMPLES);
const magnitudesView = new Float32Array(memory.buffer, magnitudesPtr + 2048, MAGNITUDE_FRAMES * BINS);
const maskView = new Float32Array(memory.buffer, maskPtr, MASK_FRAMES * BINS);
const spectrumView = new Float32Array(memory.buffer, spectrumPtr, SPECTRUM_FRAMES * BINS * 2);

assert.equal(inputView.byteOffset - inputPtr, 2048, 'reference input rewind offset changed');
assert.equal(outputView.byteOffset - outputPtr, 1536, 'reference output crop offset changed');
assert.equal(magnitudesView.byteOffset - magnitudesPtr, 2048, 'reference magnitude offset changed');
assert.equal(inputView.length, RAW_SAMPLES);
assert.equal(outputView.length, RAW_SAMPLES);
assert.equal(magnitudesView.length, MAGNITUDE_FRAMES * BINS);
assert.equal(maskView.length, MASK_FRAMES * BINS);
assert.equal(spectrumView.length, SPECTRUM_FRAMES * BINS * 2);

exp.n();
for (let i = 0; i < RAW_SAMPLES; i++) {
  inputView[i] = 0.2 * Math.sin((2 * Math.PI * 211 * i) / 44100) +
    0.04 * Math.sin((2 * Math.PI * 1433 * i) / 44100);
}
exp.o();

let spectrumPeak = 0;
for (const value of spectrumView) spectrumPeak = Math.max(spectrumPeak, Math.abs(value));
let magnitudePeak = 0;
for (const value of magnitudesView) magnitudePeak = Math.max(magnitudePeak, value);
assert.ok(spectrumPeak > 0, 'reference forward produced no spectrum');
assert.ok(magnitudePeak > 0, 'reference forward produced no model magnitudes');

// _rewind() is a one-hop boundary copy: the next input window begins with
// the previous chunk's final 512 samples. This is the key timing fact that is
// easy to mistake for a 2,048-sample history when reading byte offsets.
const previousTail = inputView.slice(RAW_SAMPLES - INPUT_HISTORY_SAMPLES);
exp.n();
assert.deepEqual(Array.from(memory.slice(inputPtr / 4, inputPtr / 4 + INPUT_HISTORY_SAMPLES)),
  Array.from(previousTail), 'reference rewind prefix must contain the previous 512 samples');

for (const value of maskView) assert.equal(value, 0);
exp.p(0);
exp.q();
for (const value of outputView) assert.ok(Number.isFinite(value), 'reference backward produced non-finite PCM');

console.log(JSON.stringify({
  inputHistorySamples: INPUT_HISTORY_SAMPLES,
  rawSamples: RAW_SAMPLES,
  magnitudeFrames: MAGNITUDE_FRAMES,
  maskFrames: MASK_FRAMES,
  spectrumFrames: SPECTRUM_FRAMES,
  spectrumPeak,
  magnitudePeak
}));
console.log('AI Remove reference WASM timeline oracle passed.');
