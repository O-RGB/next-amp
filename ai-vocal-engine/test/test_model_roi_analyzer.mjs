import assert from 'node:assert/strict';
import { analyzeVocalModelRoi } from '../tools/model-roi-analyzer.mjs';

const detail = analyzeVocalModelRoi({ start: 32, frames: 32 });
const smooth = analyzeVocalModelRoi({ start: 34, frames: 15 });

for (const result of [detail, smooth]) {
  assert.equal(result.inputRequirement.start, 0);
  assert.equal(result.inputRequirement.end, 64);
  assert.equal(result.inputUsesFullWindow, true);
  assert.deepEqual(result.unsupportedOps, []);
  assert.ok(result.convolutionCount > 0);
  assert.ok(result.fullMacs > 0);
  assert.equal(result.statefulFeasibility.inputContextIsFull, true);
  assert.equal(result.statefulFeasibility.exactActivationReuse, false);
  assert.ok(result.statefulFeasibility.resizeGeometryBarriers.length > 0);
  assert.equal(result.verdict, 'Full 64-frame input context is required; keep only the existing final-output crop.');
}

console.log(JSON.stringify({
  detail: {
    input: detail.inputRequirement,
    convolutionCount: detail.convolutionCount,
    theoreticalMacReduction: detail.theoreticalMacReduction,
    stateful: detail.statefulFeasibility,
    verdict: detail.verdict
  },
  smooth: {
    input: smooth.inputRequirement,
    convolutionCount: smooth.convolutionCount,
    theoreticalMacReduction: smooth.theoreticalMacReduction,
    stateful: smooth.statefulFeasibility,
    verdict: smooth.verdict
  }
}, null, 2));
