import assert from 'node:assert/strict';
import {
  WebGpuReadbackTimeoutError,
  WebGpuRecoveryCoordinator,
  calculateWebGpuReadbackTimeout,
  clampRecoveryTimeout,
  settleWithDeadline
} from '../../next-amp-extension/modules/ai-vocal/webgpu-recovery-controller.mjs';

assert.equal(clampRecoveryTimeout(1500, 1000, 2000), 1500);
assert.equal(clampRecoveryTimeout(500, 1000, 2000), 1000);
assert.equal(clampRecoveryTimeout(2500, 1000, 2000), 2000);
assert.equal(calculateWebGpuReadbackTimeout({
  chunkMs: 185.8,
  p95Ms: 110,
  minMs: 1000,
  maxMs: 2000
}), 1000);
assert.equal(calculateWebGpuReadbackTimeout({
  chunkMs: 185.8,
  p95Ms: 300,
  minMs: 1000,
  maxMs: 2000
}), 2000);

const successful = await settleWithDeadline(Promise.resolve('ok'), 50);
assert.deepEqual(successful, { status: 'fulfilled', value: 'ok' });

const rejected = await settleWithDeadline(Promise.reject(new Error('readback failed')), 50);
assert.equal(rejected.status, 'rejected');
assert.equal(rejected.error.message, 'readback failed');

let lateEvent = null;
const timedOut = await settleWithDeadline(
  new Promise(resolve => setTimeout(() => resolve('late tensor'), 25)),
  5,
  { onLateSettle: event => { lateEvent = event; } }
);
assert.equal(timedOut.status, 'timeout');
assert.ok(timedOut.error instanceof WebGpuReadbackTimeoutError);
await new Promise(resolve => setTimeout(resolve, 35));
assert.equal(lateEvent.status, 'fulfilled');
assert.equal(lateEvent.value, 'late tensor');

const coordinator = new WebGpuRecoveryCoordinator();
const calls = [];
const managerA = {
  canRecoverWebGpu: () => true,
  beginWebGpuRecovery: async reason => calls.push(`begin-a:${reason}`),
  finishWebGpuRecovery: async info => {
    calls.push(`finish-a:${info.backendEpoch}`);
    return { ok: true };
  }
};
const managerB = {
  canRecoverWebGpu: () => true,
  beginWebGpuRecovery: async reason => calls.push(`begin-b:${reason}`),
  finishWebGpuRecovery: async info => {
    calls.push(`finish-b:${info.backendEpoch}`);
    return { ok: true };
  }
};
coordinator.register(managerA);
coordinator.register(managerB);
const oldTf = globalThis.tf;
let backendRemoves = 0;
globalThis.tf = {
  getBackend: () => 'webgpu',
  removeBackend: name => {
    assert.equal(name, 'webgpu');
    backendRemoves++;
  }
};
const recoveryA = coordinator.request(managerA, 'readback-timeout');
const recoveryB = coordinator.request(managerB, 'device-lost');
assert.equal(recoveryA, recoveryB, 'concurrent requests must share one recovery');
await recoveryA;
assert.equal(backendRemoves, 1, 'shared backend must be removed once');
assert.deepEqual(calls, [
  'begin-a:readback-timeout',
  'begin-b:readback-timeout',
  'finish-a:1',
  'finish-b:1'
]);
globalThis.tf = oldTf;

console.log('WebGPU recovery timeout and coordinator tests passed.');
