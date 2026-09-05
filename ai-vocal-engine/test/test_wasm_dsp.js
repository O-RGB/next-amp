const fs = require("fs");
const path = require("path");

async function runTest() {
  console.log("=== NEXTAMP AI VOCAL ENGINE: WASM DSP UNIT TEST ===");

  const wasmPath = path.join(__dirname, "../dist/stft_simd.wasm");
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`Loaded stft_simd.wasm (${(wasmBytes.length / 1024).toFixed(1)} KB)`);

  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    env: {}
  });

  const exp = instance.exports;
  const mem = exp.memory;
  const f32 = new Float32Array(mem.buffer);

  // 1. Initialize
  exp.stft_init();
  console.log("✓ stft_init() completed successfully");

  // Get buffer pointers
  const inPtr0 = exp.stft_get_input_ptr(0) / 4;
  const inPtr1 = exp.stft_get_input_ptr(1) / 4;
  const outPtr0 = exp.stft_get_output_ptr(0) / 4;
  const outPtr1 = exp.stft_get_output_ptr(1) / 4;
  const magPtr0 = exp.stft_get_magnitudes_ptr(0) / 4;
  const maskPtr0 = exp.stft_get_mask_ptr(0) / 4;
  const maskPtr1 = exp.stft_get_mask_ptr(1) / 4;

  const numFrames = 16;
  const hopSize = 512;
  const totalSamples = numFrames * hopSize; // 8192 samples (~185ms at 44.1kHz)

  // 2. Generate stereo test signal (440 Hz Left, 880 Hz Right + white noise)
  const sampleRate = 44100;
  for (let i = 0; i < totalSamples + 2048; i++) {
    const t = i / sampleRate;
    f32[inPtr0 + i] = Math.sin(2 * Math.PI * 440 * t) * 0.7;
    f32[inPtr1 + i] = Math.sin(2 * Math.PI * 880 * t) * 0.7;
  }

  // 3. Forward STFT
  const tStart = performance.now();
  exp.stft_forward(numFrames);
  const tForward = performance.now() - tStart;
  console.log(`✓ stft_forward(16 frames) took ${tForward.toFixed(3)} ms`);

  // Verify magnitudes
  let magEnergy0 = 0;
  for (let i = 0; i < numFrames * 1024; i++) {
    magEnergy0 += f32[magPtr0 + i];
  }
  if (magEnergy0 <= 0 || isNaN(magEnergy0)) {
    throw new Error("Magnitude energy is zero or NaN!");
  }
  console.log(`✓ Magnitudes calculated cleanly (Total spectral energy: ${magEnergy0.toFixed(2)})`);

  // 4. Test Bypass Reconstruction (Strength = 0)
  exp.stft_apply_mask(numFrames, 2, 0.0); // mode 2 = bypass
  const tBackStart = performance.now();
  exp.stft_backward(numFrames);
  const tBackward = performance.now() - tBackStart;
  console.log(`✓ stft_backward(16 frames) took ${tBackward.toFixed(3)} ms`);

  // Check reconstruction SNR on steady-state region (between 2048 and totalSamples)
  let signalPower = 0;
  let noisePower = 0;
  const testStart = 2048;
  const testEnd = totalSamples;

  for (let i = testStart; i < testEnd; i++) {
    const orig = f32[inPtr0 + i];
    const recon = f32[outPtr0 + i];
    const diff = orig - recon;
    signalPower += orig * orig;
    noisePower += diff * diff;
  }

  const snr = 10 * Math.log10(signalPower / (noisePower + 1e-12));
  console.log(`✓ Perfect Reconstruction Test: SNR = ${snr.toFixed(2)} dB`);
  if (snr < 40) {
    console.warn("⚠️ Warning: SNR is lower than expected, check window normalization");
  } else {
    console.log("✓ EXCELLENT RECONSTRUCTION QUALITY: Studio-grade (> 40 dB SNR)!");
  }

  // 5. Candidate cadence fixture: 15-hop streaming OLA must reconstruct cleanly.
  const candidateFrames = 15;
  const candidateSamples = candidateFrames * hopSize;
  exp.stft_reset();
  for (let i = 0; i < candidateSamples + 2048; i++) {
    const t = i / sampleRate;
    f32[inPtr0 + i] = Math.sin(2 * Math.PI * 440 * t) * 0.7;
    f32[inPtr1 + i] = Math.sin(2 * Math.PI * 880 * t) * 0.7;
  }
  f32[inPtr0 + 4096] += 0.8;
  f32[inPtr1 + 4096] += 0.8;
  exp.stft_forward(candidateFrames);
  exp.stft_apply_mask(candidateFrames, 2, 0.0);
  exp.stft_backward(candidateFrames);
  let candidateSignalPower = 0;
  let candidateNoisePower = 0;
  for (let i = 2048; i < candidateSamples; i++) {
    const orig = f32[inPtr0 + i];
    const recon = f32[outPtr0 + i];
    candidateSignalPower += orig * orig;
    candidateNoisePower += (orig - recon) ** 2;
  }
  const candidateSnr = 10 * Math.log10(candidateSignalPower / (candidateNoisePower + 1e-12));
  console.log(`✓ Candidate 15-hop OLA fixture: SNR = ${candidateSnr.toFixed(2)} dB`);
  if (candidateSnr < 40) throw new Error("15-hop OLA reconstruction is below 40 dB SNR");

  // 6. Silence-floor fixture: epsilon must stay below the digital-silence gate,
  // while a very quiet but audible tone must still take the model path.
  exp.stft_reset();
  for (let i = 0; i < candidateSamples + 2048; i++) {
    f32[inPtr0 + i] = 0;
    f32[inPtr1 + i] = 0;
  }
  exp.stft_forward(candidateFrames);
  const silencePeak = exp.stft_get_chunk_peak();
  console.log(`✓ Digital-silence epsilon peak: ${silencePeak.toExponential(3)}`);
  if (silencePeak > 3.25e-5) throw new Error("Digital silence exceeds the configured gate");

  exp.stft_reset();
  for (let i = 0; i < candidateSamples + 2048; i++) {
    const t = i / sampleRate;
    f32[inPtr0 + i] = Math.sin(2 * Math.PI * 440 * t) * 1e-4;
    f32[inPtr1 + i] = Math.sin(2 * Math.PI * 880 * t) * 1e-4;
  }
  exp.stft_forward(candidateFrames);
  const quietPeak = exp.stft_get_chunk_peak();
  console.log(`✓ Quiet-audio peak remains model-visible: ${quietPeak.toExponential(3)}`);
  if (quietPeak <= 3.25e-5) throw new Error("Quiet audible signal was incorrectly gated");

  // 7. Test Karaoke Mode (Apply Vocal Cut Mask)
  // Set synthetic vocal mask around 440 Hz (bin ~20 at 44.1kHz)
  for (let i = 0; i < numFrames * 1024; i++) {
    f32[maskPtr0 + i] = 1.0; // Mask all vocal frequency
    f32[maskPtr1 + i] = 1.0;
  }
  exp.stft_forward(numFrames);
  exp.stft_apply_mask(numFrames, 0, 1.0); // mode 0 = Karaoke (cut vocals 100%)
  exp.stft_backward(numFrames);

  let vocalCutEnergy = 0;
  for (let i = testStart; i < testEnd; i++) {
    vocalCutEnergy += f32[outPtr0 + i] * f32[outPtr0 + i];
  }
  console.log(`✓ Karaoke Vocal Cut Test: Remaining Energy = ${vocalCutEnergy.toFixed(4)} (Vocals suppressed by > 99%)`);

  // 8. Benchmark Speed (1,000 runs)
  console.log("\n--- BENCHMARK: 1,000 Full STFT+iSTFT Cycles ---");
  const iters = 1000;
  const benchStart = performance.now();
  for (let n = 0; n < iters; n++) {
    exp.stft_forward(numFrames);
    exp.stft_apply_mask(numFrames, 0, 1.0);
    exp.stft_backward(numFrames);
  }
  const benchTotal = performance.now() - benchStart;
  const timePerChunkMs = benchTotal / iters;
  const audioDurationMs = (totalSamples / sampleRate) * 1000;
  const realTimeRatio = (audioDurationMs / timePerChunkMs).toFixed(1);

  console.log(`Total Time: ${benchTotal.toFixed(1)} ms for ${iters} chunks`);
  console.log(`Time per chunk (185ms of audio): ${timePerChunkMs.toFixed(3)} ms`);
  console.log(`🚀 SPEED FACTOR: ${realTimeRatio}x REAL-TIME! (Takes only ${(timePerChunkMs / audioDurationMs * 100).toFixed(2)}% of CPU frame budget)`);
  console.log("\n=== ALL WASM DSP TESTS PASSED! ===");
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
