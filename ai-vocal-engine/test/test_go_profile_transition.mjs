import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../../next-amp-extension/modules/ai-vocal/ai-vocal-manager.js', import.meta.url),
  'utf8'
)
  .replace('import { GoEngineClient } from "./go-engine-client.js";\n', '')
  .replace('import { createVocalModelLoader } from "./model-optimizer.mjs";\n', '')
  .replace('export class AIVocalManager', 'class AIVocalManager') +
  '\nthis.AIVocalManager = AIVocalManager;';

class StubGoEngineClient {
  constructor() {
    this.resetCalls = 0;
    this.pendingChunks = new Map();
  }

  resetStream() {
    this.resetCalls++;
  }
}

const context = {
  Array,
  Date,
  Float32Array,
  Int32Array,
  Map,
  Math,
  Number,
  Object,
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

manager.setVocalProfile('ai_remove');
assert.equal(manager.goClient.resetCalls, 1,
  'GO profile switch must reset native STFT/lookahead state');
assert.equal(manager.workletNode.port.messages.at(-1).type, 'SET_PROFILE');
assert.equal(manager.workletNode.port.messages.at(-1).profile, 'ai_remove');

manager.setVocalProfile('balanced');
assert.equal(manager.goClient.resetCalls, 2,
  'switching back must reset the native stream again');
assert.equal(manager.workletNode.port.messages.at(-1).profile, 'balanced');

manager.setVocalProfile('balanced');
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

console.log(JSON.stringify({
  profileResets: manager.goClient.resetCalls,
  profileMessages: manager.workletNode.port.messages.length,
  finalProfile: manager.vocalProfile
}));
console.log('GO profile transition boundary guard passed.');
