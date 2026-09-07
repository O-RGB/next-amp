// Conservative rolling-window mask calibration.
// The model already predicts the next active window as the tail of the current
// 64-frame context. Reusing that tail avoids another inference pass while
// allowing two independent contexts to agree before suppressing more vocal
// leakage. The current prediction remains the fallback for every disagreement.

export const OVERLAP_CONSENSUS_VOCAL_MAX = 0.45;
export const OVERLAP_CONSENSUS_AGREEMENT = 0.12;
export const OVERLAP_CONSENSUS_BLEND = 0.35;
export const OVERLAP_CONSENSUS_LOGIT_MAX_DELTA = 0.35;
export const OVERLAP_CONSENSUS_LOGIT_BLEND = 0.20;

function mergeAgreedVocalMask(current, previous) {
  const rawDelta = current - previous;
  if (!Number.isFinite(current) || !Number.isFinite(previous) ||
      rawDelta === 0 ||
      current > OVERLAP_CONSENSUS_VOCAL_MAX ||
      previous > OVERLAP_CONSENSUS_VOCAL_MAX ||
      Math.abs(rawDelta) > OVERLAP_CONSENSUS_AGREEMENT) {
    return current;
  }

  // Keep the existing conservative bias against a small upward mask jump:
  // lower accompaniment mask means stronger vocal evidence in Karaoke mode.
  let adjusted = current;
  if (rawDelta > 0) {
    adjusted -= rawDelta * OVERLAP_CONSENSUS_BLEND;
  }

  // Interpolate in logit space so the same transition strength behaves
  // consistently near both ends of the sigmoid, without hard thresholding.
  const epsilon = 1e-5;
  const boundedCurrent = Math.min(1 - epsilon, Math.max(epsilon, adjusted));
  const boundedPrevious = Math.min(1 - epsilon, Math.max(epsilon, previous));
  const currentLogit = Math.log(boundedCurrent / (1 - boundedCurrent));
  const previousLogit = Math.log(boundedPrevious / (1 - boundedPrevious));
  const logitDelta = Math.max(
    -OVERLAP_CONSENSUS_LOGIT_MAX_DELTA,
    Math.min(OVERLAP_CONSENSUS_LOGIT_MAX_DELTA, currentLogit - previousLogit)
  );
  return 1 / (1 + Math.exp(-(currentLogit - (logitDelta * OVERLAP_CONSENSUS_LOGIT_BLEND))));
}

/**
 * Merge the previous window's tail into the current mask in-place.
 *
 * maskData layout: [channel][headFrame][frequencyBin]
 * previousTail layout: [channel][activeFrame][frequencyBin]
 *
 * The network mask is the accompaniment mask. For Karaoke, a lower mask means
 * stronger vocal evidence. We only move the current mask slightly toward the
 * previous value when both contexts are already in the vocal-evidence range
 * and agree closely. Instrument/high-mask bins and disagreements keep the
 * exact current baseline.
 */
export function applyOverlapConsensusToMask(
  maskData,
  headFrames,
  localStart,
  activeFrames,
  previousTail,
  previousTailValid,
  modeCode,
  bins = 1024
) {
  if (!(maskData instanceof Float32Array) ||
      !(previousTail instanceof Float32Array) ||
      !Number.isInteger(headFrames) || !Number.isInteger(localStart) ||
      !Number.isInteger(activeFrames) || headFrames <= 0 ||
      localStart < 0 || activeFrames <= 0 ||
      localStart + (activeFrames * 2) > headFrames ||
      maskData.length < headFrames * bins * 2 ||
      previousTail.length < activeFrames * bins * 2) {
    return false;
  }

  const currentOffset = localStart * bins;
  const tailOffset = (localStart + activeFrames) * bins;
  const channelStride = headFrames * bins;
  const tailStride = activeFrames * bins;
  let changed = false;

  for (let channel = 0; channel < 2; channel++) {
    const currentBase = channel * channelStride;
    const previousBase = channel * tailStride;
    for (let frame = 0; frame < activeFrames; frame++) {
      const currentFrame = currentBase + currentOffset + frame * bins;
      const tailFrame = currentBase + tailOffset + frame * bins;
      const previousFrame = previousBase + frame * bins;
      for (let bin = 0; bin < bins; bin++) {
        const current = maskData[currentFrame + bin];
        if (modeCode === 1 && previousTailValid) {
          const previous = previousTail[previousFrame + bin];
          const merged = mergeAgreedVocalMask(current, previous);
          if (merged !== current) {
            maskData[currentFrame + bin] = merged;
            changed = true;
          }
        }
        // Cache the unmodified future prediction. It becomes the baseline for
        // the next chunk and must not inherit this chunk's calibration.
        previousTail[previousFrame + bin] = maskData[tailFrame + bin];
      }
    }
  }

  return changed;
}
