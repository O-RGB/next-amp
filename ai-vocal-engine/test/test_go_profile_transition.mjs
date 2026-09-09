import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../../next-amp-extension/modules/ai-vocal/ai-vocal-manager.js', import.meta.url),
  'utf8'
)
  .replace('import { GoEngineClient } from "./go-engine-client.js";\n', '')
  .replace('import { createVocalModelLoader } from "./model-optimizer.mjs";\n', '')
  .replace('import { createProtectedModelSource, loadProtectedAsset } from "./web-protected-assets.mjs";\n', '')
  .replace('import { applyOverlapConsensusToMask } from "./overlap-consensus.mjs";\n', '')
  .replace('export class AIVocalManager', 'const applyOverlapConsensusToMask = () => false;\n\nclass AIVocalManager') +
  '\nthis.AIVocalManager = AIVocalManager;';

class StubGoEngineClient {
  constructor() {
    this.resetCalls = 0;
    this.pendingChunks = new Map();
  }

  resetStream() {
    this.resetCalls++;
  }

  getPendingCount() {
    return this.pendingChunks.size;
  }
}

let now = 1000;
const context = {
  Array,
  Date,
  Float32Array,
  Float64Array,
  Int32Array,
  Map,
  Math,
  Number,
  Object,
  performance: { now: () => now },
  console,
  GoEngineClient: StubGoEngineClient
};
vm.runInNewContext(source, context);

const manager = new context.AIVocalManager({ sampleRate: 44100 });
manager.engineType = 'go_native';
manager.currentMode = 'karaoke';
manager.workletNode = {
  port: {
    messages: [],
    postMessage(message) {
      this.messages.push(message);
    }
  }
};

manager.setVocalProfile('balanced');
assert.equal(manager.goClient.resetCalls, 1,
  'GO profile switch must reset native STFT/lookahead state');
assert.equal(manager.workletNode.port.messages.at(-1).type, 'SET_PROFILE');
assert.equal(manager.workletNode.port.messages.at(-1).profile, 'balanced');

manager.setVocalProfile('ai_remove');
assert.equal(manager.goClient.resetCalls, 2,
  'switching back to the production default must reset the native stream again');
assert.equal(manager.workletNode.port.messages.at(-1).profile, 'ai_remove');

manager.setVocalProfile('ai_remove');
assert.equal(manager.goClient.resetCalls, 2,
  'reselecting the active profile must not reset an active stream');

const webQueueManager = new context.AIVocalManager({ sampleRate: 44100 });
webQueueManager.enqueueChunk({ chunkIndex: 10 });
webQueueManager.enqueueChunk({ chunkIndex: 11 });
assert.equal(webQueueManager.chunkQueueSize, 2);
assert.equal(webQueueManager.enqueueChunk({ chunkIndex: 12 }), false,
  'Web queue must refuse growth past its bounded capacity');
webQueueManager.replaceChunkQueue({ chunkIndex: 12 });
assert.equal(webQueueManager.chunkQueueSize, 1);
assert.equal(webQueueManager.dequeueChunk().chunkIndex, 12,
  'latest-wins replacement must keep only the newest Web chunk');

for (let i = 0; i < 9; i++) webQueueManager.recordChunkPeak(i, i / 10);
assert.ok(Math.abs(webQueueManager.getChunkPeak(8) - 0.8) < 1e-6,
  'fixed peak history must preserve Float32 values');
assert.equal(webQueueManager.getChunkPeak(0), undefined,
  'fixed peak history must evict entries outside the lookahead window');

const statusManager = new context.AIVocalManager({ sampleRate: 44100 });
statusManager.engineType = 'go_native';
statusManager.currentMode = 'karaoke';
statusManager.goClient.onChunkProcessed(0, new Float32Array(1), new Float32Array(1), 10, new ArrayBuffer(8));
const firstStatus = statusManager.getStatus();
now = 1200;
statusManager.goClient.onChunkProcessed(1, new Float32Array(1), new Float32Array(1), 20, new ArrayBuffer(8));
assert.equal(statusManager.getStatus(), firstStatus,
  'GO status/UI updates must be throttled between cadence windows');
assert.equal(statusManager.lastInferMs, 20,
  'GO latency telemetry must still update on every processed response');
now = 1600;
statusManager.goClient.onChunkProcessed(2, new Float32Array(1), new Float32Array(1), 30, new ArrayBuffer(8));
assert.notEqual(statusManager.getStatus(), firstStatus,
  'GO status/UI must refresh after the throttle interval');

const latencyManager = new context.AIVocalManager({ sampleRate: 44100 });
latencyManager.engineType = 'go_native';
latencyManager.workletNode = { port: { postMessage() {} } };
for (let i = 0; i < 24; i++) latencyManager.observeGoLatency(20 + i);
assert.equal(latencyManager.goLatencySampleCount, 24,
  'GO adaptive latency window must stay fixed at 24 samples');
latencyManager.observeGoLatency(99);
assert.equal(latencyManager.goLatencySampleCount, 24,
  'GO adaptive latency window must not grow after reaching capacity');
assert.equal(latencyManager.getDiagnostics().goAdaptive.samples, 24,
  'GO diagnostics must report the fixed latency window count');

console.log(JSON.stringify({
  profileResets: manager.goClient.resetCalls,
  profileMessages: manager.workletNode.port.messages.length,
  finalProfile: manager.vocalProfile,
  goStatusCadenceMs: 500,
  goLatencyWindow: latencyManager.goLatencySampleCount
}));
console.log('GO profile transition boundary guard passed.');
