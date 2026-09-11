/**
 * Runtime-only AI Vocal power presets.
 *
 * All modes intentionally point at the same model asset and model input
 * shape. ECO/MEDIUM select the same tested shorter browser cadence, but never
 * select another model or duplicate the audio processing pipeline.
 */

export const AI_POWER_MODE_ECO = "eco";
export const AI_POWER_MODE_MEDIUM = "medium";
export const AI_POWER_MODE_QUALITY = "quality";
export const DEFAULT_AI_POWER_MODE = AI_POWER_MODE_QUALITY;

export const AI_POWER_MODES = Object.freeze({
  [AI_POWER_MODE_ECO]: Object.freeze({
    id: AI_POWER_MODE_ECO,
    // ECO is intentionally the same tested preset as MEDIUM. Keep the
    // public mode for compatibility, but do not create a second cadence or
    // lower-quality model path just for ECO.
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
  [AI_POWER_MODE_MEDIUM]: Object.freeze({
    id: AI_POWER_MODE_MEDIUM,
    // Keep this frozen as the compatibility name for the same tested
    // 50-55 ms balanced preset used by ECO.
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
  if (value === AI_POWER_MODE_ECO) return AI_POWER_MODE_ECO;
  if (value === AI_POWER_MODE_MEDIUM) return AI_POWER_MODE_MEDIUM;
  return AI_POWER_MODE_QUALITY;
}

export function getAiPowerModeConfig(value) {
  return AI_POWER_MODES[normalizeAiPowerMode(value)];
}

export function shouldPreferWebGlForPowerMode(value) {
  return getAiPowerModeConfig(value).backendPolicy === "prefer_webgl_f16";
}
