// Compare the models through the app's actual WASM normalization, delayed
// spectrum masks and cross-chunk overlap-add, without live playback timing.
export async function compareStreamingModels(tf, models, numFrames = 15) {
  const chunkSamples = numFrames * 512;
  const historySamples = 1536;
  const sliceBase = numFrames === 15 ? 49 : 48;
  const bytes = await (await fetch('../../next-amp-extension/modules/ai-vocal/stft_simd.wasm')).arrayBuffer();
  const states = await Promise.all(models.map(async () => {
    const { instance } = await WebAssembly.instantiate(bytes, { env: {} });
    const exp = instance.exports;
    exp.stft_init();
    return { exp, mem: new Float32Array(exp.memory.buffer),
      history: [new Float32Array(1536), new Float32Array(1536)],
      tails: [new Float32Array(1536), new Float32Array(1536)], peaks: [] };
  }));
  const results = [];
  for (let delay = 0; delay < 4; delay++) {
    for (const state of states) {
      state.exp.stft_reset();
      state.history.forEach(x => x.fill(0));
      state.tails.forEach(x => x.fill(0));
      state.peaks = [];
    }
    let maxPcmError = 0;
    for (let chunk = 0; chunk < 6; chunk++) {
      const raw = [0, 1].map(ch => Float32Array.from({ length: chunkSamples }, (_, i) => {
        if (chunk === 3) return 0;
        const t = (chunk * chunkSamples + i) / 44100;
        const envelope = 0.35 + 0.25 * Math.sin(2 * Math.PI * 2.3 * t);
        return envelope * (0.3 * Math.sin(2 * Math.PI * (ch ? 330 : 220) * t) +
          0.2 * Math.sin(2 * Math.PI * 110 * t) + 0.1 * Math.sin(2 * Math.PI * 1760 * t)) +
          (i < 20 ? 0.2 : 0);
      }));
      const rendered = [];
      for (let index = 0; index < states.length; index++) {
        const { exp, mem, history, tails, peaks } = states[index];
        for (let ch = 0; ch < 2; ch++) {
          const ptr = exp.stft_get_input_ptr(ch) / 4;
          mem.set(history[ch], ptr);
          mem.set(raw[ch], ptr + historySamples);
          history[ch].set(raw[ch].subarray(chunkSamples - historySamples));
        }
        exp.stft_forward(numFrames);
        peaks.push(exp.stft_get_chunk_peak());
        if (peaks.length > 4) peaks.shift();
        exp.stft_prepare_norm_input(1 / Math.max(...peaks, 1e-4));
        const ptr = exp.stft_get_norm_input_ptr() / 4;
        const mask = tf.tidy(() => models[index]
          .execute(tf.tensor4d(mem.subarray(ptr, ptr + 1024 * 64 * 2), [1, 1024, 64, 2]))
          .slice([0, 0, sliceBase - numFrames * delay, 0], [1, 1024, numFrames, 2])
          .transpose([0, 3, 2, 1]).reshape([2, numFrames, 1024]).sigmoid());
        let values;
        try { values = await mask.data(); } finally { mask.dispose(); }
        for (let ch = 0; ch < 2; ch++) {
          const channelSize = numFrames * 1024;
          mem.set(values.subarray(ch * channelSize, (ch + 1) * channelSize), exp.stft_get_mask_ptr(ch) / 4);
        }
        exp.stft_apply_mask_delayed(delay, numFrames, 1, 1);
        exp.stft_backward(numFrames);
        rendered.push([0, 1].map(ch => {
          const ptr = exp.stft_get_output_ptr(ch) / 4;
          for (let i = 0; i < historySamples; i++) mem[ptr + i] += tails[ch][i];
          tails[ch].set(mem.subarray(ptr + chunkSamples, ptr + chunkSamples + historySamples));
          return mem.slice(ptr, ptr + chunkSamples);
        }));
      }
      for (let ch = 0; ch < 2; ch++) for (let i = 0; i < chunkSamples; i++) {
        const a = rendered[0][ch][i], b = rendered[1][ch][i];
        if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Non-finite PCM');
        maxPcmError = Math.max(maxPcmError, Math.abs(a - b));
      }
    }
    if (maxPcmError > 1e-6) throw new Error(`PCM mismatch at delay ${delay}: ${maxPcmError}`);
    results.push({ depth: delay + 1, frames: numFrames, samples: chunkSamples, chunks: 6, maxPcmError });
  }
  return results;
}

// Diagnostic-only experiment for mask continuity. It compares the same future
// frame predicted from two adjacent rolling windows; it does not alter the
// production mask or apply smoothing.
export async function measureFrameIndexedContinuity(tf, model, {
  numFrames = 15,
  chunks = 6,
  boundaryFrames = 3
} = {}) {
  const WINDOW = 64;
  const BINS = 1024;
  const CHANNELS = 2;
  const windowResults = [];
  const feature = (frame, bin, channel) => {
    if (frame < 0) return 0;
    const phase = frame * 0.173 + bin * 0.031 + channel * 0.47;
    return 0.001 + 0.35 * Math.abs(Math.sin(phase) * Math.cos(phase * 0.37));
  };
  const sigmoid = value => 1 / (1 + Math.exp(-value));

  for (let chunk = 0; chunk < chunks; chunk++) {
    const startFrame = chunk * numFrames - 49;
    const values = new Float32Array(WINDOW * BINS * CHANNELS);
    let p = 0;
    for (let bin = 0; bin < BINS; bin++) {
      for (let frame = 0; frame < WINDOW; frame++) {
        const absoluteFrame = startFrame + frame;
        values[p++] = feature(absoluteFrame, bin, 0);
        values[p++] = feature(absoluteFrame, bin, 1);
      }
    }
    const input = tf.tensor4d(values, [1, BINS, WINDOW, CHANNELS]);
    const output = model.execute(input);
    try {
      windowResults.push({ startFrame, values: await output.data() });
    } finally {
      output.dispose();
      input.dispose();
    }
  }

  const boundaries = [];
  for (let chunk = 0; chunk + 1 < windowResults.length; chunk++) {
    const left = windowResults[chunk];
    const right = windowResults[chunk + 1];
    // The previous window ends at chunk*numFrames + 14; the next window
    // predicts those same first frames at its sliceStart (index 34).
    const boundaryFrame = chunk * numFrames;
    const comparisons = [];
    for (let offset = 0; offset < boundaryFrames; offset++) {
      const absoluteFrame = boundaryFrame + offset;
      const leftFrame = absoluteFrame - left.startFrame;
      const rightFrame = absoluteFrame - right.startFrame;
      let maxMaskError = 0;
      let squaredMaskError = 0;
      let count = 0;
      for (let bin = 0; bin < BINS; bin++) {
        for (let channel = 0; channel < CHANNELS; channel++) {
          const leftIndex = (bin * WINDOW + leftFrame) * CHANNELS + channel;
          const rightIndex = (bin * WINDOW + rightFrame) * CHANNELS + channel;
          const error = Math.abs(sigmoid(left.values[leftIndex]) - sigmoid(right.values[rightIndex]));
          maxMaskError = Math.max(maxMaskError, error);
          squaredMaskError += error * error;
          count++;
        }
      }
      comparisons.push({
        absoluteFrame,
        maxMaskError,
        rmsMaskError: Math.sqrt(squaredMaskError / count)
      });
    }
    boundaries.push({ boundaryFrame, comparisons });
  }

  return {
    numFrames,
    chunks,
    comparedFrames: boundaries.length * boundaryFrames,
    boundaries
  };
}
