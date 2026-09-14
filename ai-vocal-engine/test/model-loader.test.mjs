import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createVocalModelLoader } from '../../nextsona-extension/modules/ai-vocal/model-optimizer.mjs';

const base = new URL('../../nextsona-extension/model/', import.meta.url);
const json = JSON.parse(fs.readFileSync(new URL('model.json', base)));
const bytes = fs.readFileSync(new URL('group1-shard1of1.bin', base));
const artifacts = {
  ...json,
  weightSpecs: json.weightsManifest[0].weights,
  weightData: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
};
const metadata = artifacts.userDefinedMetadata?.nextsonaModelOptimization;
const source = { load: async () => artifacts };

test('browser IO loads the prebuilt graph and can select its embedded compatibility topology', async () => {
  assert.ok(metadata?.fallback?.modelTopology);
  const tf = { loadGraphModel: async handler => handler.load() };
  const loader = createVocalModelLoader(tf, source);
  const optimized = await loader.load();
  assert.equal(loader.foldedCount, 12);
  assert.equal(loader.explicitPadCount, 16);
  assert.deepEqual(loader.outputHead, metadata.outputHead);
  assert.equal(optimized.modelTopology.node.filter(n => n.op === 'SpaceToBatchND').length, 0);

  loader.disableOptimization();
  const fallback = await loader.load();
  assert.equal(loader.foldedCount, 0);
  assert.equal(loader.explicitPadCount, 0);
  assert.equal(loader.outputHead, null);
  assert.equal(fallback.modelTopology, metadata.fallback.modelTopology);
  assert.equal(fallback.signature, metadata.fallback.signature);
  assert.equal(fallback.weightData, artifacts.weightData);
});

test('safe projection-only output head is exposed from verified build metadata', async () => {
  const tf = { loadGraphModel: async handler => handler.load() };
  const loader = createVocalModelLoader(tf, source);
  const optimized = await loader.load();
  assert.deepEqual(loader.outputHead, {
    start: 34,
    frames: 15,
    bins: 1024,
    inputFrames: 64,
    activation: 'sigmoid',
    layout: '[2,frames,bins]',
    decoderRoi: { start: 34, frames: 15, inputFrames: 64, channels: 32 },
    decoderLayerRoi: null
  });
  assert.equal(optimized.signature.outputs.output_0.tensorShape.dim[0].size, '2');
  assert.equal(optimized.signature.outputs.output_0.tensorShape.dim[1].size, '15');
  assert.equal(optimized.signature.outputs.output_0.tensorShape.dim[2].size, '1024');
});

test('a prebuilt graph-load failure retries the embedded compatibility graph', async () => {
  const calls = [];
  const tf = { loadGraphModel: async handler => {
    const loaded = await handler.load();
    calls.push(loaded.modelTopology);
    if (loaded.modelTopology === artifacts.modelTopology) {
      throw new Error('Simulated unsupported optimized graph');
    }
    return loaded;
  } };
  const loader = createVocalModelLoader(tf, source);
  const fallback = await loader.load();
  assert.equal(fallback.modelTopology, metadata.fallback.modelTopology);
  assert.equal(calls.length, 2);
  assert.equal(loader.foldedCount, 0);
  assert.equal(loader.explicitPadCount, 0);
  assert.equal(loader.outputHead, null);
  assert.equal((await loader.load()).modelTopology, metadata.fallback.modelTopology);
});

test('source failure propagates instead of reporting a loaded model', async () => {
  const offlineSource = { load: async () => { throw new Error('Offline'); } };
  const loader = createVocalModelLoader({ loadGraphModel: async handler => handler.load() }, offlineSource);
  await assert.rejects(loader.load(), /Offline/);
});

test('URL-only IO remains supported', async () => {
  const loader = createVocalModelLoader({ loadGraphModel: async url => url }, '/model.json');
  assert.equal(await loader.load(), '/model.json');
  assert.equal(loader.foldedCount, 0);
  assert.equal(loader.explicitPadCount, 0);
});
