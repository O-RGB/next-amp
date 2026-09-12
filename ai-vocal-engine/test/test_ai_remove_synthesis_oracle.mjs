import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FFT = 2048;
const HOP = 512;
const BINS = 1024;
const FRAMES = 18;
const RAW_SAMPLES = 7680;
const HISTORY_SAMPLES = 512;
const OUTPUT_OFFSET_SAMPLES = 384;

function makeWindow() {
  const window = new Float32Array(FFT);
  for (let i = 0; i < window.length; i++) {
    const denominator = FFT + (1 - (i % 2)) - 1;
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denominator);
  }
  for (let offset = 0; offset < HOP; offset++) {
    let energy = 0;
    for (let i = offset; i < window.length; i += HOP) energy += window[i] * window[i];
    const scale = 1 / Math.sqrt(energy);
    for (let i = offset; i < window.length; i += HOP) window[i] *= scale;
  }
  return window;
}

function makeSignal() {
  const signal = new Float32Array(RAW_SAMPLES);
  for (let i = 0; i < signal.length; i++) {
    signal[i] = 0.23 * Math.sin((2 * Math.PI * 211 * i) / 44100) +
      0.07 * Math.sin((2 * Math.PI * 1433 * i) / 44100) +
      0.025 * Math.cos((2 * Math.PI * 5873 * i) / 44100);
  }
  return signal;
}

function stats(values) {
  let sumSquares = 0;
  let peak = 0;
  for (const value of values) {
    sumSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  return { rms: Math.sqrt(sumSquares / values.length), peak };
}

function compare(actual, expected) {
  let maxError = 0;
  let sumError = 0;
  let dot = 0;
  let actualEnergy = 0;
  let expectedEnergy = 0;
  for (let i = 0; i < actual.length; i++) {
    const error = Math.abs(actual[i] - expected[i]);
    maxError = Math.max(maxError, error);
    sumError += error;
    dot += actual[i] * expected[i];
    actualEnergy += actual[i] * actual[i];
    expectedEnergy += expected[i] * expected[i];
  }
  return {
    maxError,
    meanError: sumError / actual.length,
    correlation: dot / Math.sqrt(actualEnergy * expectedEnergy)
  };
}

async function instantiateReference() {
  const bytes = fs.readFileSync(new URL('../../ai remove/stft.wasm', import.meta.url));
  const { instance } = await WebAssembly.instantiate(bytes, {
    a: { a: () => {}, b: () => {} }
  });
  const exp = instance.exports;
  exp.l();
  const memory = new Float32Array(exp.c.buffer);
  const window = makeWindow();
  memory.set(window, exp.g(0) / 4);
  memory.set(window, exp.h(0) / 4);
  return { exp, memory };
}

async function runReference(maskValue, mode) {
  const { exp, memory } = await instantiateReference();
  const signal = makeSignal();
  const inputPtr = exp.e(0) / 4;
  const maskPtr = exp.j(0) / 4;
  exp.n();
  memory.set(signal, inputPtr + HISTORY_SAMPLES);
  exp.o();
  memory.fill(maskValue, maskPtr, maskPtr + FRAMES * BINS);
  exp.p(mode);
  exp.q();
  const outputPtr = exp.f(0) / 4;
  return memory.slice(
    outputPtr + OUTPUT_OFFSET_SAMPLES,
    outputPtr + OUTPUT_OFFSET_SAMPLES + RAW_SAMPLES
  );
}

async function runOwnBypass() {
  const bytes = fs.readFileSync(fileURLToPath(new URL('../dist/stft_simd.wasm', import.meta.url)));
  const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
  const exp = instance.exports;
  exp.stft_init();
  const memory = new Float32Array(exp.memory.buffer);
  const signal = makeSignal();
  const inputPtr = exp.stft_get_input_ptr(0) / 4;
  memory.set(signal, inputPtr + HISTORY_SAMPLES);
  exp.stft_forward_reference();
  exp.stft_backward_masked(0, FRAMES, 2, 0);
  const outputPtr = exp.stft_get_output_ptr(0) / 4;
  return memory.slice(
    outputPtr + OUTPUT_OFFSET_SAMPLES,
    outputPtr + OUTPUT_OFFSET_SAMPLES + RAW_SAMPLES
  );
}

const signal = makeSignal();
const ownBypass = await runOwnBypass();
const cases = {};
for (const mode of [0, 1]) {
  for (const mask of [0, 1]) {
    const output = await runReference(mask, mode);
    cases[`mode${mode}Mask${mask}`] = {
      ...stats(output),
      vsSignal: compare(output, signal),
      vsOwnBypass: compare(output, ownBypass)
    };
  }
}

assert.ok(cases.mode0Mask0.rms <= 1e-12, 'reference mode 0 must multiply by the mask');
assert.ok(cases.mode1Mask1.rms <= 1e-12, 'reference mode 1 must multiply by the inverse mask');
assert.ok(cases.mode0Mask1.vsOwnBypass.maxError <= 2e-6,
  'NextStudio bypass reconstruction must match reference direct-mask reconstruction');
assert.ok(cases.mode1Mask0.vsOwnBypass.maxError <= 2e-6,
  'reference inverse-mask bypass must match NextStudio reconstruction');

function makeChunk(chunk, channel) {
  const output = new Float32Array(RAW_SAMPLES);
  for (let i = 0; i < output.length; i++) {
    const sample = chunk * RAW_SAMPLES + i;
    const phase = channel === 0 ? 0.13 : 0.71;
    output[i] = 0.19 * Math.sin((2 * Math.PI * 173 * sample) / 44100 + phase) +
      0.09 * Math.sin((2 * Math.PI * 997 * sample) / 44100 + phase * 0.5) +
      0.03 * Math.cos((2 * Math.PI * 4211 * sample) / 44100 + phase * 1.7);
  }
  return output;
}

function fillMask(view, chunk, channel) {
  for (let frame = 0; frame < FRAMES; frame++) {
    for (let bin = 0; bin < BINS; bin++) {
      // Deliberately vary by chunk, frame, bin and channel. Any queue,
      // frame or channel permutation produces a large PCM mismatch.
      view[frame * BINS + bin] =
        0.05 + 0.9 * (((chunk * 17 + frame * 11 + bin * 7 + channel * 23) % 101) / 100);
    }
  }
}

async function compareDelayedTimeline() {
  const reference = await instantiateReference();
  const ownBytes = fs.readFileSync(fileURLToPath(new URL('../dist/stft_simd.wasm', import.meta.url)));
  const { instance: ownInstance } = await WebAssembly.instantiate(ownBytes, { env: {} });
  const ownExp = ownInstance.exports;
  ownExp.stft_init();
  const ownMemory = new Float32Array(ownExp.memory.buffer);

  const referenceInput = [
    new Float32Array(reference.memory.buffer, reference.exp.e(0) + 2048, RAW_SAMPLES),
    new Float32Array(reference.memory.buffer, reference.exp.e(1) + 2048, RAW_SAMPLES)
  ];
  const referenceOutput = [
    new Float32Array(reference.memory.buffer, reference.exp.f(0) + 1536, RAW_SAMPLES),
    new Float32Array(reference.memory.buffer, reference.exp.f(1) + 1536, RAW_SAMPLES)
  ];
  const referenceMask = [
    new Float32Array(reference.memory.buffer, reference.exp.j(0), FRAMES * BINS),
    new Float32Array(reference.memory.buffer, reference.exp.j(1), FRAMES * BINS)
  ];
  const referenceSpectrum = [
    new Float32Array(reference.memory.buffer, reference.exp.k(0), FRAMES * BINS * 2),
    new Float32Array(reference.memory.buffer, reference.exp.k(1), FRAMES * BINS * 2)
  ];
  const ownInputPtr = [ownExp.stft_get_input_ptr(0) / 4, ownExp.stft_get_input_ptr(1) / 4];
  const ownOutputPtr = [ownExp.stft_get_output_ptr(0) / 4, ownExp.stft_get_output_ptr(1) / 4];
  const ownMaskPtr = [ownExp.stft_get_mask_ptr(0) / 4, ownExp.stft_get_mask_ptr(1) / 4];
  const previousTail = [new Float32Array(HISTORY_SAMPLES), new Float32Array(HISTORY_SAMPLES)];
  const spectra = [[], []];
  const zeroSpectrum = new Float32Array(FRAMES * BINS * 2);
  let worst = { maxError: 0, meanError: 0, correlation: 1, chunk: -1, channel: -1 };

  for (let chunk = 0; chunk < 7; chunk++) {
    reference.exp.n();
    for (let channel = 0; channel < 2; channel++) {
      const raw = makeChunk(chunk, channel);
      referenceInput[channel].set(raw);
      ownMemory.set(previousTail[channel], ownInputPtr[channel]);
      ownMemory.set(raw, ownInputPtr[channel] + HISTORY_SAMPLES);
      const requiredSamples = ((FRAMES - 1) * HOP) + FFT;
      ownMemory.fill(
        0,
        ownInputPtr[channel] + HISTORY_SAMPLES + RAW_SAMPLES,
        ownInputPtr[channel] + requiredSamples
      );
      previousTail[channel].set(raw.subarray(raw.length - HISTORY_SAMPLES));
    }

    reference.exp.o();
    ownExp.stft_forward_reference();
    for (let channel = 0; channel < 2; channel++) {
      spectra[channel].push(referenceSpectrum[channel].slice());
      referenceSpectrum[channel].set(chunk === 0 ? zeroSpectrum : spectra[channel][chunk - 1]);
      fillMask(referenceMask[channel], chunk, channel);
      const ownMask = ownMemory.subarray(ownMaskPtr[channel], ownMaskPtr[channel] + FRAMES * BINS);
      fillMask(ownMask, chunk, channel);
    }

    // Reference mode 0 and NextStudio mode 1 are both direct-mask modes.
    reference.exp.p(0);
    reference.exp.q();
    ownExp.stft_backward_masked(1, FRAMES, 1, 1);

    for (let channel = 0; channel < 2; channel++) {
      const ownOutput = ownMemory.subarray(
        ownOutputPtr[channel] + OUTPUT_OFFSET_SAMPLES,
        ownOutputPtr[channel] + OUTPUT_OFFSET_SAMPLES + RAW_SAMPLES
      );
      const result = compare(ownOutput, referenceOutput[channel]);
      if (result.maxError > worst.maxError) worst = { ...result, chunk, channel };
    }
  }
  return worst;
}

const delayedTimeline = await compareDelayedTimeline();
assert.ok(delayedTimeline.maxError <= 2e-6,
  `delayed mask/spectrum PCM mismatch: ${delayedTimeline.maxError}`);
assert.ok(delayedTimeline.correlation >= 0.999999,
  `delayed mask/spectrum correlation mismatch: ${delayedTimeline.correlation}`);

console.log(JSON.stringify({
  reconstructionMaxError: cases.mode0Mask1.vsOwnBypass.maxError,
  delayedTimeline
}));
console.log('AI Remove synthesis/mask/delayed-spectrum oracle passed.');
