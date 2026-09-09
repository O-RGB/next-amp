import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIVocalManager } from '../../next-amp-extension/modules/ai-vocal/ai-vocal-manager.js';
import { applyOverlapConsensusToMask } from '../../next-amp-extension/modules/ai-vocal/overlap-consensus.mjs';

const BINS = 2;
const HEAD_FRAMES = 32;
const ACTIVE_FRAMES = 16;

function makeMask(current, tail) {
  const data = new Float32Array(2 * HEAD_FRAMES * BINS);
  for (let channel = 0; channel < 2; channel++) {
    const base = channel * HEAD_FRAMES * BINS;
    for (let frame = 0; frame < ACTIVE_FRAMES; frame++) {
      data[base + frame * BINS] = current;
      data[base + (ACTIVE_FRAMES + frame) * BINS] = tail;
    }
  }
  return data;
}

test('overlap consensus only moves Karaoke masks toward agreed vocal evidence', () => {
  const mask = makeMask(0.8, 0.4);
  const previousTail = new Float32Array(2 * ACTIVE_FRAMES * BINS).fill(0.3);

  const changed = applyOverlapConsensusToMask(
    mask, HEAD_FRAMES, 0, ACTIVE_FRAMES, previousTail, true, 1, BINS
  );

  assert.equal(changed, false);
  assert.ok(Math.abs(mask[0] - 0.8) < 1e-6);
  assert.ok(Math.abs(mask[ACTIVE_FRAMES * BINS] - 0.4) < 1e-6);
  assert.ok(Math.abs(previousTail[0] - 0.4) < 1e-6);

  const agreedMask = makeMask(0.4, 0.4);
  const agreedTail = new Float32Array(2 * ACTIVE_FRAMES * BINS).fill(0.3);
  assert.equal(
    applyOverlapConsensusToMask(agreedMask, HEAD_FRAMES, 0, ACTIVE_FRAMES, agreedTail, true, 1, BINS),
    true
  );
  assert.ok(Math.abs(agreedMask[0] - 0.365) < 1e-6);

  const fallingMask = makeMask(0.3, 0.4);
  const fallingTail = new Float32Array(2 * ACTIVE_FRAMES * BINS).fill(0.4);
  assert.equal(
    applyOverlapConsensusToMask(fallingMask, HEAD_FRAMES, 0, ACTIVE_FRAMES, fallingTail, true, 1, BINS),
    false
  );
  // A lower current mask already means stronger vocal suppression. It must
  // never be raised by overlap calibration, or vocal residue becomes audible.
  assert.ok(Math.abs(fallingMask[0] - 0.3) < 1e-6);
});

test('uncertain, acapella, and first-window masks preserve the baseline', () => {
  const mask = makeMask(0.8, 0.4);
  const original = mask.slice();
  const previousTail = new Float32Array(2 * ACTIVE_FRAMES * BINS).fill(0.3);

  assert.equal(
    applyOverlapConsensusToMask(mask, HEAD_FRAMES, 0, ACTIVE_FRAMES, previousTail, false, 1, BINS),
    false
  );
  assert.deepEqual(mask, original);

  const disagreement = makeMask(0.8, 0.4);
  assert.equal(
    applyOverlapConsensusToMask(disagreement, HEAD_FRAMES, 0, ACTIVE_FRAMES, previousTail, true, 1, BINS),
    false
  );
  assert.ok(Math.abs(disagreement[0] - 0.8) < 1e-6);

  const acapella = makeMask(0.8, 0.4);
  assert.equal(
    applyOverlapConsensusToMask(acapella, HEAD_FRAMES, 0, ACTIVE_FRAMES, previousTail, true, 0, BINS),
    false
  );
  assert.ok(Math.abs(acapella[0] - 0.8) < 1e-6);
});

test('Detail candidate reads the existing full-model tail without compact output head', () => {
  const manager = new AIVocalManager({ sampleRate: 44100 });
  assert.equal(manager.overlapConsensusEnabled, true);
  manager.modelOutputHead = null;

  const calls = [];
  const result = { kind: 'sigmoid-mask' };
  const reshaped = {
    sigmoid() {
      calls.push(['sigmoid']);
      return result;
    }
  };
  const transposed = {
    reshape(shape) {
      calls.push(['reshape', shape]);
      return reshaped;
    }
  };
  const sliced = {
    transpose(order) {
      calls.push(['transpose', order]);
      return transposed;
    }
  };
  const output = {
    slice(begin, size) {
      calls.push(['slice', begin, size]);
      return sliced;
    }
  };

  const previousTf = globalThis.tf;
  globalThis.tf = { tidy: callback => callback() };
  try {
    const mask = manager.extractModelMask(output, {
      frames: 16,
      maskFrames: 16,
      sliceStart: 32
    }, true);
    assert.equal(mask, result);
  } finally {
    globalThis.tf = previousTf;
  }

  assert.deepEqual(calls, [
    ['slice', [0, 0, 32, 0], [1, 1024, 32, 2]],
    ['transpose', [0, 3, 2, 1]],
    ['reshape', [2, 32, 1024]],
    ['sigmoid']
  ]);
});
