import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { optimizeVocalModelArtifacts } from '../../next-amp-extension/modules/ai-vocal/model-optimizer.mjs';

const require = createRequire(import.meta.url);
const tf = require('../../next-amp-extension/assets/libs/js/tf.min.js');
const modelDir = new URL('../../next-amp-extension/model/', import.meta.url);
const json = JSON.parse(fs.readFileSync(new URL('model.json', modelDir)));
const bytes = fs.readFileSync(new URL('group1-shard1of1.bin', modelDir));
const original = {
  ...json,
  weightSpecs: json.weightsManifest.flatMap(group => group.weights),
  weightData: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
};
const before = JSON.stringify(original.modelTopology);
const { artifacts: optimized, foldedCount, explicitPadCount } = optimizeVocalModelArtifacts(original);
const outputHeadResult = optimizeVocalModelArtifacts(original, {
  outputHead: { start: 32, frames: 17, bins: 1024 }
});
assert.equal(foldedCount, 12);
assert.equal(explicitPadCount, 16);
assert.deepEqual(outputHeadResult.outputHead, {
  start: 32,
  frames: 17,
  bins: 1024,
  inputFrames: 64,
  activation: 'sigmoid',
  layout: '[2,frames,bins]'
});
assert.equal(outputHeadResult.artifacts.weightData.byteLength, original.weightData.byteLength + 76);
assert.equal(optimized.modelTopology.node.length, original.modelTopology.node.length - 40);
assert.equal(optimized.weightData, original.weightData);
assert.equal(optimized.weightSpecs, original.weightSpecs);
assert.equal(JSON.stringify(original.modelTopology), before, 'optimizer mutated original graph');
assert.equal(optimizeVocalModelArtifacts(optimized).foldedCount, 0);
assert.equal(optimizeVocalModelArtifacts(optimized).explicitPadCount, 0);
assert.equal(optimizeVocalModelArtifacts({ ...original, weightData: [original.weightData] }).foldedCount, 12);
assert.equal(optimizeVocalModelArtifacts({ ...original, weightData: [original.weightData] }).explicitPadCount, 16);

// An incompatible export must keep its original branch intact.
const incompatible = structuredClone(original);
const firstConv = incompatible.modelTopology.node.find(node => node.op === 'DepthwiseConv2dNative');
firstConv.attr.strides.list.i = ['1', '2', '2', '1'];
assert.equal(optimizeVocalModelArtifacts(incompatible).foldedCount, 11);
const incompatiblePad = structuredClone(original);
const firstPad = incompatiblePad.modelTopology.node.find(node => node.op === 'Pad');
const firstPadConv = incompatiblePad.modelTopology.node.find(node => node.input?.[0] === firstPad.name);
firstPadConv.attr.strides.list.i = ['1', '1', '1', '1'];
const padResult = optimizeVocalModelArtifacts(incompatiblePad);
assert.equal(padResult.foldedCount, 12);
assert.equal(padResult.explicitPadCount, 15);
assert.equal(optimizeVocalModelArtifacts({}).foldedCount, 0);

await tf.setBackend('cpu');
const load = artifacts => tf.loadGraphModel({ load: async () => artifacts });
const models = [await load(original), await load(optimized)];
const outputHeadModel = await load(outputHeadResult.artifacts);
let seed = 0x51a7;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
try {
  for (const kind of ['silence', 'sparse', 'dense']) {
    const values = Float32Array.from({ length: 1024 * 64 * 2 }, () =>
      kind === 'silence' ? 0 : kind === 'sparse' ? (random() < 0.02 ? random() : 0.0001) : random());
    const input = tf.tensor4d(values, [1, 1024, 64, 2]);
    const outputs = [];
    const times = [];
    for (const model of models) {
      const start = performance.now();
      const out = model.execute(input);
      outputs.push(await out.data());
      times.push(performance.now() - start);
      out.dispose();
    }
    input.dispose();
    let maxError = 0;
    for (let i = 0; i < outputs[0].length; i++) {
      assert.ok(Number.isFinite(outputs[0][i]) && Number.isFinite(outputs[1][i]));
      maxError = Math.max(maxError, Math.abs(outputs[0][i] - outputs[1][i]));
    }
    assert.ok(maxError <= 1e-5, `${kind}: logit mismatch ${maxError}`);
    console.log(JSON.stringify({ kind, foldedCount, maxLogitError: maxError, milliseconds: times }));
  }
  const headInput = tf.tensor4d(Float32Array.from({ length: 1024 * 64 * 2 }, () => random()), [1, 1024, 64, 2]);
  const fullOutput = models[0].execute(headInput);
  const headOutput = outputHeadModel.execute(headInput);
  const fullData = await fullOutput.data();
  const headData = await headOutput.data();
  let maxHeadError = 0;
  for (let bin = 0; bin < 1024; bin++) {
    for (let frame = 0; frame < 17; frame++) {
      for (let channel = 0; channel < 2; channel++) {
        const fullIndex = ((bin * 64) + frame + 32) * 2 + channel;
        const headIndex = (channel * 17 + frame) * 1024 + bin;
        const expected = 1 / (1 + Math.exp(-fullData[fullIndex]));
        maxHeadError = Math.max(maxHeadError, Math.abs(expected - headData[headIndex]));
      }
    }
  }
  const outputHeadShape = headOutput.shape;
  fullOutput.dispose();
  headOutput.dispose();
  headInput.dispose();
  assert.ok(maxHeadError <= 2e-6, `output head mismatch ${maxHeadError}`);
  console.log(JSON.stringify({ outputHeadShape, maxHeadError }));
} finally {
  models.forEach(model => model.dispose());
  outputHeadModel.dispose();
}
assert.equal(tf.memory().numTensors, 0, 'model validation leaked tensors');
