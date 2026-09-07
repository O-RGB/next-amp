import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createVocalModelLoader } from '../../next-amp-extension/modules/ai-vocal/model-optimizer.mjs';

const base = new URL('../../next-amp-extension/model/', import.meta.url);
const json = JSON.parse(fs.readFileSync(new URL('model.json', base)));
const bytes = fs.readFileSync(new URL('group1-shard1of1.bin', base));
const artifacts = { ...json, weightSpecs: json.weightsManifest[0].weights,
  weightData: [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)] };
const source = { load: async () => artifacts };

test('browser IO loads optimized topology and can reload original after a driver warmup failure', async () => {
  const tf = { loadGraphModel: async handler => handler.load() };
  const loader = createVocalModelLoader(tf, source);
  const optimized = await loader.load();
  assert.equal(loader.foldedCount, 12);
  assert.equal(loader.explicitPadCount, 16);
  assert.equal(optimized.weightData, artifacts.weightData);
  assert.equal(optimized.modelTopology.node.filter(n => n.op === 'SpaceToBatchND').length, 0);
  loader.disableOptimization();
  assert.equal(await loader.load(), artifacts);
  assert.equal(loader.foldedCount, 0);
  assert.equal(loader.explicitPadCount, 0);
});

test('exact Web output head is exposed and can be disabled with the original graph', async () => {
  const tf = { loadGraphModel: async handler => handler.load() };
  const loader = createVocalModelLoader(tf, source, {
    outputHead: { start: 32, frames: 32, bins: 1024 }
  });
  const optimized = await loader.load();
  assert.deepEqual(loader.outputHead, {
    start: 32,
    frames: 32,
    bins: 1024,
    inputFrames: 64,
    activation: 'sigmoid',
    layout: '[2,frames,bins]'
  });
  assert.equal(optimized.signature.outputs.output_0.tensorShape.dim[1].size, '32');
  loader.disableOptimization();
  assert.equal(loader.outputHead, null);
  assert.equal(await loader.load(), artifacts);
});

test('a graph-load failure retries the original IO source and keeps it for subsequent loads', async () => {
  const calls = [];
  const tf = { loadGraphModel: async handler => {
    calls.push(handler);
    const loaded = await handler.load();
    if (loaded !== artifacts) throw new Error('Simulated unsupported graph');
    return loaded;
  } };
  const loader = createVocalModelLoader(tf, source);
  assert.equal(await loader.load(), artifacts);
  assert.equal(await loader.load(), artifacts);
  assert.equal(loader.foldedCount, 0);
  assert.equal(loader.explicitPadCount, 0);
  assert.equal(calls[1], source);
  assert.equal(calls[2], source);
});

test('original-source failure propagates instead of reporting a loaded model', async () => {
  const loader = createVocalModelLoader({ loadGraphModel: async () => { throw new Error('Offline'); } }, source);
  await assert.rejects(loader.load(), /Offline/);
});

test('URL-only IO remains supported without graph rewriting', async () => {
  const loader = createVocalModelLoader({ loadGraphModel: async url => url }, '/model.json');
  assert.equal(await loader.load(), '/model.json');
  assert.equal(loader.foldedCount, 0);
  assert.equal(loader.explicitPadCount, 0);
});
