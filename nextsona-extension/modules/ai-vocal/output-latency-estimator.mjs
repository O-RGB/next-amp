const DEFAULT_RENDER_QUANTUM = 128;
const FAST_WEBGPU_MAX_DEADLINE_RATIO = 0.4;
const FAST_WEBGPU_HOLD_PADDING_MS = 12;
const FAST_WEBGPU_HOLD_MIN_MS = 32;
const FAST_WEBGPU_HOLD_MAX_MS = 80;

function finitePositive(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Select a lower-latency output gate without changing model inference.
 *
 * The normal browser path waits for two complete processed chunks. A fast
 * WebGPU provider can instead wait for one processed chunk plus a short,
 * sample-accurate hold. The hold is deliberately based on measured model
 * time so the next result has deadline margin before playback consumes the
 * current result.
 */
export function selectFastWebGpuOutputTarget({
  backendType,
  powerMode,
  benchmarkMs,
  chunkSamples,
  sampleRate,
  renderQuantum = DEFAULT_RENDER_QUANTUM
}) {
  const samples = finitePositive(chunkSamples);
  const rate = finitePositive(sampleRate);
  const measuredMs = finitePositive(benchmarkMs);
  const quantum = Math.max(1, Math.floor(finitePositive(renderQuantum, DEFAULT_RENDER_QUANTUM)));
  const chunkMs = samples > 0 && rate > 0 ? (samples / rate) * 1000 : 0;
  const eligible = String(backendType).toLowerCase() === "webgpu" &&
    String(powerMode).toLowerCase() === "eco" &&
    measuredMs > 0 && chunkMs > 0 &&
    measuredMs <= chunkMs * FAST_WEBGPU_MAX_DEADLINE_RATIO;

  if (!eligible) {
    return Object.freeze({
      enabled: false,
      readyThreshold: 2,
      fallbackReadyThreshold: 2,
      startupHoldSamples: 0,
      startupHoldMs: 0,
      chunkMs
    });
  }

  const holdMs = clamp(
    measuredMs + FAST_WEBGPU_HOLD_PADDING_MS,
    FAST_WEBGPU_HOLD_MIN_MS,
    FAST_WEBGPU_HOLD_MAX_MS
  );
  const unalignedSamples = Math.ceil((holdMs / 1000) * rate);
  const startupHoldSamples = Math.ceil(unalignedSamples / quantum) * quantum;

  return Object.freeze({
    enabled: true,
    readyThreshold: 1,
    fallbackReadyThreshold: 2,
    startupHoldSamples,
    startupHoldMs: (startupHoldSamples / rate) * 1000,
    chunkMs
  });
}

/**
 * Best browser-side estimate of input-timeline to speaker output latency.
 * Browser capture and physical device latency are not fully observable, so
 * callers must present this value as an estimate rather than a measurement.
 */
export function estimateOutputLatency({
  chunkSamples,
  sampleRate,
  delayChunks,
  readyThreshold,
  processingMs,
  startupHoldSamples = 0,
  includeAi = true,
  audioContextBaseLatencySeconds = 0,
  audioContextOutputLatencySeconds = 0,
  pitchLatencySeconds = 0,
  dynamicsLatencyMs = 0
}) {
  const samples = finitePositive(chunkSamples);
  const rate = finitePositive(sampleRate);
  if (samples <= 0 || rate <= 0) return null;

  const lookaheadChunks = Math.max(0, Math.floor(Number(delayChunks) || 0));
  const aiActive = includeAi !== false;
  const queueChunks = aiActive ? Math.max(1, Math.floor(Number(readyThreshold) || 1)) : 0;
  const holdSamples = aiActive ? Math.max(0, Math.floor(Number(startupHoldSamples) || 0)) : 0;
  const modelMs = aiActive ? Math.max(0, Number(processingMs) || 0) : 0;
  const aiSamples = aiActive ? (lookaheadChunks + queueChunks) * samples + holdSamples : 0;
  const aiBufferMs = (aiSamples / rate) * 1000;
  const contextMs = (
    Math.max(0, Number(audioContextBaseLatencySeconds) || 0) +
    Math.max(0, Number(audioContextOutputLatencySeconds) || 0)
  ) * 1000;
  const pitchMs = Math.max(0, Number(pitchLatencySeconds) || 0) * 1000;
  const dynamicsMs = Math.max(0, Number(dynamicsLatencyMs) || 0);

  return Object.freeze({
    estimated: true,
    totalMs: aiBufferMs + modelMs + contextMs + pitchMs + dynamicsMs,
    aiMs: aiBufferMs + modelMs,
    aiBufferMs,
    processingMs: modelMs,
    audioContextMs: contextMs,
    pitchMs,
    dynamicsMs,
    readyThreshold: queueChunks,
    startupHoldSamples: holdSamples
  });
}
