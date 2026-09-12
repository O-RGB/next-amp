/**
 * Runtime-only AI Vocal power presets.
 *
 * All modes intentionally point at the same model asset and model input
 * shape. ECO selects the tested shorter browser cadence, while FULL keeps
 * the quality cadence and processing features.
 */

export const AI_POWER_MODE_ECO = "eco";
export const AI_POWER_MODE_QUALITY = "quality";
export const DEFAULT_AI_POWER_MODE = AI_POWER_MODE_ECO;

export const AI_POWER_MODES = Object.freeze({
  [AI_POWER_MODE_ECO]: Object.freeze({
    id: AI_POWER_MODE_ECO,
    profile: "balanced",
    processingProfile: "balanced",
    backendPolicy: "auto_webgpu_first",
    webglF16: false,
    webglPackNormalization: false,
    webglPackDepthwiseConv: false,
    webgpuDeferredSubmitBatchSize: 15,
    attenuationFloor: false,
    asymmetricSmoothing: false,
    transientGate: false,
    overlapConsensus: false,
    adaptiveQueue: false
  }),
  [AI_POWER_MODE_QUALITY]: Object.freeze({
    id: AI_POWER_MODE_QUALITY,
    profile: "ai_remove",
    processingProfile: "ai_remove",
    backendPolicy: "auto_webgpu_first",
    webglF16: true,
    webglPackNormalization: true,
    webglPackDepthwiseConv: true,
    webgpuDeferredSubmitBatchSize: 0,
    attenuationFloor: false,
    asymmetricSmoothing: true,
    transientGate: true,
    overlapConsensus: false,
    adaptiveQueue: true
  })
});

export function normalizeAiPowerMode(value) {
  if (value === AI_POWER_MODE_QUALITY) return AI_POWER_MODE_QUALITY;
  // "medium" and missing/unknown values are legacy or first-run values.
  return AI_POWER_MODE_ECO;
}

export function getAiPowerModeConfig(value) {
  return AI_POWER_MODES[normalizeAiPowerMode(value)];
}

export function shouldPreferWebGlForPowerMode(value) {
  return getAiPowerModeConfig(value).backendPolicy === "prefer_webgl_f16";
}
