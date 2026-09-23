import assert from "node:assert/strict";
import {
  estimateOutputLatency,
  selectFastWebGpuOutputTarget
} from "../../nextsona-extension/modules/ai-vocal/output-latency-estimator.mjs";

const fast = selectFastWebGpuOutputTarget({
  backendType: "webgpu",
  powerMode: "eco",
  benchmarkMs: 46,
  chunkSamples: 7680,
  sampleRate: 44100
});
assert.equal(fast.enabled, true);
assert.equal(fast.readyThreshold, 1);
assert.equal(fast.fallbackReadyThreshold, 2);
assert.equal(fast.startupHoldSamples % 128, 0);
assert.ok(fast.startupHoldMs >= 58 && fast.startupHoldMs < 59);

for (const rejected of [
  { backendType: "webgl", powerMode: "eco", benchmarkMs: 46 },
  { backendType: "webgpu", powerMode: "quality", benchmarkMs: 46 },
  { backendType: "webgpu", powerMode: "eco", benchmarkMs: 80 }
]) {
  const target = selectFastWebGpuOutputTarget({
    ...rejected,
    chunkSamples: 7680,
    sampleRate: 44100
  });
  assert.equal(target.enabled, false);
  assert.equal(target.readyThreshold, 2);
  assert.equal(target.startupHoldSamples, 0);
}

const candidateLatency = estimateOutputLatency({
  chunkSamples: 7680,
  sampleRate: 44100,
  delayChunks: 1,
  readyThreshold: fast.readyThreshold,
  processingMs: 46,
  startupHoldSamples: fast.startupHoldSamples
});
const stableLatency = estimateOutputLatency({
  chunkSamples: 7680,
  sampleRate: 44100,
  delayChunks: 1,
  readyThreshold: 2,
  processingMs: 46
});
assert.ok(candidateLatency.totalMs > 452 && candidateLatency.totalMs < 453);
assert.ok(stableLatency.totalMs > 568 && stableLatency.totalMs < 569);
assert.ok(stableLatency.totalMs - candidateLatency.totalMs > 115);

const withOutputChain = estimateOutputLatency({
  chunkSamples: 7680,
  sampleRate: 44100,
  delayChunks: 1,
  readyThreshold: 1,
  processingMs: 46,
  startupHoldSamples: fast.startupHoldSamples,
  audioContextBaseLatencySeconds: 0.02,
  audioContextOutputLatencySeconds: 0.01,
  pitchLatencySeconds: 0.04,
  dynamicsLatencyMs: 12
});
assert.ok(Math.abs(withOutputChain.totalMs - (candidateLatency.totalMs + 82)) < 0.001);

const bypassLatency = estimateOutputLatency({
  chunkSamples: 7680,
  sampleRate: 44100,
  delayChunks: 1,
  readyThreshold: 1,
  processingMs: 46,
  startupHoldSamples: fast.startupHoldSamples,
  includeAi: false,
  audioContextBaseLatencySeconds: 0.02,
  audioContextOutputLatencySeconds: 0.01,
  pitchLatencySeconds: 0.04,
  dynamicsLatencyMs: 12
});
assert.ok(Math.abs(bypassLatency.totalMs - 82) < 0.001);
assert.equal(bypassLatency.aiMs, 0);

console.log("Fast WebGPU gate selection and output-latency estimation passed.");
