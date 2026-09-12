import assert from "node:assert/strict";
import {
  AI_POWER_MODE_ECO,
  AI_POWER_MODE_QUALITY,
  AI_POWER_MODES,
  DEFAULT_AI_POWER_MODE,
  getAiPowerModeConfig,
  normalizeAiPowerMode,
  shouldPreferWebGlForPowerMode
} from "../../next-amp-extension/modules/ai-vocal/ai-power-mode.mjs";

assert.equal(DEFAULT_AI_POWER_MODE, AI_POWER_MODE_ECO);
assert.equal(normalizeAiPowerMode(AI_POWER_MODE_ECO), AI_POWER_MODE_ECO);
assert.equal(normalizeAiPowerMode("medium"), AI_POWER_MODE_ECO);
assert.equal(normalizeAiPowerMode("invalid"), AI_POWER_MODE_ECO);
assert.equal(normalizeAiPowerMode(undefined), AI_POWER_MODE_ECO);

assert.equal(getAiPowerModeConfig("eco"), AI_POWER_MODES.eco);
assert.equal(getAiPowerModeConfig("medium"), AI_POWER_MODES.eco);
assert.equal(getAiPowerModeConfig("quality"), AI_POWER_MODES.quality);
assert.equal(shouldPreferWebGlForPowerMode("eco"), false);
assert.equal(shouldPreferWebGlForPowerMode("medium"), false);
assert.equal(shouldPreferWebGlForPowerMode("quality"), false);

for (const mode of [AI_POWER_MODE_ECO, AI_POWER_MODE_QUALITY]) {
  const config = getAiPowerModeConfig(mode);
  assert.equal(config.profile, mode === "quality" ? "ai_remove" : "balanced");
  assert.equal(config.processingProfile, mode === "quality" ? "ai_remove" : "balanced");
  assert.equal(config.webglF16, mode === "quality");
  assert.equal(config.webglPackNormalization, mode === "quality");
  assert.equal(config.webglPackDepthwiseConv, mode === "quality");
  assert.equal(config.webgpuDeferredSubmitBatchSize, mode === "quality" ? 0 : 15);
  assert.equal(config.asymmetricSmoothing, mode === "quality");
  assert.equal(config.transientGate, mode === "quality");
  assert.equal(config.adaptiveQueue, mode === "quality");
  assert.equal(config.overlapConsensus, false);
  assert.equal(Object.isFrozen(config), true);
}

assert.equal(AI_POWER_MODES.eco.backendPolicy, "auto_webgpu_first");
assert.equal(AI_POWER_MODES.eco.processingProfile, "balanced");
assert.equal(Object.hasOwn(AI_POWER_MODES, "medium"), false);

console.log("AI power mode preset tests passed.");
