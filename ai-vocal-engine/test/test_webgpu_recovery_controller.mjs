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
const transitionOrder = [];
const transitionA = coordinator.runBackendTransition(async () => {
  transitionOrder.push('start-a');
  await new Promise(resolve => setTimeout(resolve, 5));
  transitionOrder.push('end-a');
  return 'a';
});
const transitionB = coordinator.runBackendTransition(async () => {
  transitionOrder.push('start-b');
  transitionOrder.push('end-b');
  return 'b';
});
assert.equal(await transitionA, 'a');
assert.equal(await transitionB, 'b');
assert.deepEqual(transitionOrder, ['start-a', 'end-a', 'start-b', 'end-b']);

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
let backendRegisters = 0;
const webGpuFactory = () => ({ backend: 'webgpu' });
let registeredFactory = webGpuFactory;
globalThis.tf = {
  getBackend: () => 'webgpu',
  findBackendFactory: name => name === 'webgpu' ? registeredFactory : null,
  removeBackend: name => {
    assert.equal(name, 'webgpu');
    backendRemoves++;
    registeredFactory = null;
  },
  registerBackend: (name, factory, priority) => {
    assert.equal(name, 'webgpu');
    assert.equal(factory, webGpuFactory);
    assert.equal(priority, 3);
    registeredFactory = factory;
    backendRegisters++;
    return true;
  },
};
const recoveryA = coordinator.request(managerA, 'readback-timeout');
const recoveryB = coordinator.request(managerB, 'device-lost');
assert.equal(recoveryA, recoveryB, 'concurrent requests must share one recovery');
await recoveryA;
assert.equal(backendRemoves, 1, 'shared backend must be removed once');
assert.equal(backendRegisters, 1, 'shared backend factory must be restored after disposal');
assert.equal(registeredFactory, webGpuFactory, 'WebGPU must remain available for the next session');
assert.deepEqual(calls, [
  'begin-a:readback-timeout',
  'begin-b:readback-timeout',
  'finish-a:1',
  'finish-b:1'
]);
assert.equal(coordinator.releaseBackendIfUnused(), true,
  'closing the last session must dispose the backend instance');
assert.equal(backendRemoves, 2);
assert.equal(backendRegisters, 2);
assert.equal(registeredFactory, webGpuFactory,
  'closing and reopening must retain a usable WebGPU provider factory');
globalThis.tf = oldTf;

console.log('WebGPU recovery timeout and coordinator tests passed.');
