// Conservative rolling-window mask calibration.
// The model already predicts the next active window as the tail of the current
// 64-frame context. Reusing that tail avoids another inference pass while
// allowing two independent contexts to agree before suppressing more vocal
// leakage. The current prediction remains the fallback for every disagreement.

export const OVERLAP_CONSENSUS_DELTA = 0.08;
export const OVERLAP_CONSENSUS_BLEND = 0.35;

/**
 * Merge the previous window's tail into the current mask in-place.
 *
 * maskData layout: [channel][headFrame][frequencyBin]
 * previousTail layout: [channel][activeFrame][frequencyBin]
 *
 * The network mask is the accompaniment mask. For Karaoke, a lower mask means
 * stronger vocal evidence. We only move the current mask toward that lower
 * value when the previous context agrees by a meaningful margin. Acapella and
 * uncertain/disagreeing bins keep the exact current baseline.
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
          const delta = current - previous;
          if (delta > OVERLAP_CONSENSUS_DELTA) {
            maskData[currentFrame + bin] = current - (delta * OVERLAP_CONSENSUS_BLEND);
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
