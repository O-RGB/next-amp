import assert from 'node:assert/strict';
import { AIVocalManager } from '../../next-amp-extension/modules/ai-vocal/ai-vocal-manager.js';

const oldTf = globalThis.tf;
let backendRemoves = 0;
globalThis.tf = {
  getBackend: () => 'webgpu',
  removeBackend: name => {
    assert.equal(name, 'webgpu');
    backendRemoves++;
  },
  disposeVariables: () => {}
};

function makeManager() {
  const manager = new AIVocalManager({ sampleRate: 44100 });
  manager.workletNode = {
    port: { messages: [], postMessage(message) { this.messages.push(message); } },
    disconnect() {}
  };
  manager.backendType = 'webgpu';
  manager.engineType = 'webgl';
  manager.currentMode = 'karaoke';
  manager.isReady = true;
  manager.model = { dispose() {} };
  return manager;
}

const manager = makeManager();
let loadCalls = 0;
manager.loadEngine = async () => {
  loadCalls++;
  manager.isReady = true;
  manager.engineLoading = false;
  manager.backendType = 'webgpu';
};

await manager.requestWebGpuRecovery('readback-timeout');
assert.equal(backendRemoves, 1);
assert.equal(loadCalls, 1);
assert.equal(manager.isReady, true);
assert.equal(manager.queueFaulted, false);
assert.equal(manager.recoveryState, 'idle');
assert.equal(manager.awaitingRecoveryFirstChunk, true);
assert.equal(manager.diagnostics.webGpuRecoveriesSucceeded, 1);
assert.ok(manager.workletNode.port.messages.some(message => message.type === 'RESYNC'));

const firstEpoch = manager.engineEpoch;
manager.destroy();
assert.equal(manager.destroyed, true);
assert.ok(manager.engineEpoch > firstEpoch);
assert.equal(manager.model, null);

const fallbackManager = makeManager();
let fallbackLoadCalls = 0;
fallbackManager.loadEngine = async () => {
  fallbackLoadCalls++;
  if (fallbackLoadCalls === 1) {
    fallbackManager.isReady = false;
    fallbackManager.engineLoading = false;
    throw new Error('simulated WebGPU rebuild failure');
  }
  fallbackManager.isReady = true;
  fallbackManager.engineLoading = false;
  fallbackManager.backendType = 'webgl';
};
await fallbackManager.requestWebGpuRecovery('device-lost');
assert.equal(fallbackLoadCalls, 2, 'failed WebGPU recovery must have one bounded WebGL retry');
assert.equal(fallbackManager.forceWebGlForSession, true);
assert.equal(fallbackManager.backendType, 'webgl');
assert.equal(fallbackManager.recoveryState, 'idle');
fallbackManager.destroy();

const healthManager = makeManager();
healthManager.backendType = 'webgpu';
healthManager.browserLatencySampleCount = 8;
healthManager.browserLatencySamples.fill(190);
healthManager.observeLiveGpuHealth(190);
healthManager.observeLiveGpuHealth(190);
healthManager.observeLiveGpuHealth(190);
assert.equal(healthManager.liveGpuWarningActive, true);
assert.equal(healthManager.isHardwareSlow, true);
healthManager.browserLatencySamples.fill(100);
for (let i = 0; i < 8; i++) healthManager.observeLiveGpuHealth(100);
assert.equal(healthManager.liveGpuWarningActive, false);
assert.equal(healthManager.isHardwareSlow, false);
healthManager.destroy();

globalThis.tf = oldTf;
console.log('AIVocalManager WebGPU stall recovery lifecycle passed.');
