/**
 * NextAmp AI Vocal Processor (AudioWorklet)
 * High-performance real-time vocal separation processor running on the audio rendering thread.
 * Integrates with stft_simd.wasm and ONNX Runtime WebGPU.
 */

class AIVocalProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.wasmInstance = null;
    this.exports = null;
    this.f32Mem = null;

    // Pointers into WASM memory
    this.inPtr0 = 0;
    this.inPtr1 = 0;
    this.outPtr0 = 0;
    this.outPtr1 = 0;
    this.magPtr0 = 0;
    this.magPtr1 = 0;
    this.maskPtr0 = 0;
    this.maskPtr1 = 0;

    // Audio DSP constants
    this.fftSize = 2048;
    this.hopSize = 512;
    this.numFrames = 16;
    this.chunkSamples = this.numFrames * this.hopSize; // 8192 samples

    // Ring buffers for stream accumulation
    this.ringInL = new Float32Array(this.chunkSamples + this.fftSize);
    this.ringInR = new Float32Array(this.chunkSamples + this.fftSize);
    this.ringOutL = new Float32Array(this.chunkSamples + this.fftSize);
    this.ringOutR = new Float32Array(this.chunkSamples + this.fftSize);

    this.inWritePos = 0;
    this.outReadPos = 0;
    this.bufferedSamples = 0;

    // Controls
    this.mode = 2; // 0 = Karaoke, 1 = Acapella, 2 = Bypass
    this.strength = 1.0;
    this.isReady = false;

    // Message handler from main thread / WebGPU controller
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(data) {
    if (data.type === "INIT_WASM") {
      this.initWasm(data.wasmBytes);
    } else if (data.type === "SET_MODE") {
      this.mode = data.mode; // 0: Karaoke, 1: Acapella, 2: Bypass
    } else if (data.type === "SET_STRENGTH") {
      this.strength = Math.max(0, Math.min(1, data.strength));
    } else if (data.type === "APPLY_MASK") {
      this.receiveMask(data.maskL, data.maskR);
    }
  }

  async initWasm(wasmBytes) {
    try {
      const { instance } = await WebAssembly.instantiate(wasmBytes, { env: {} });
      this.wasmInstance = instance;
      this.exports = instance.exports;
      this.f32Mem = new Float32Array(this.exports.memory.buffer);

      this.exports.stft_init();

      this.inPtr0 = this.exports.stft_get_input_ptr(0) / 4;
      this.inPtr1 = this.exports.stft_get_input_ptr(1) / 4;
      this.outPtr0 = this.exports.stft_get_output_ptr(0) / 4;
      this.outPtr1 = this.exports.stft_get_output_ptr(1) / 4;
      this.magPtr0 = this.exports.stft_get_magnitudes_ptr(0) / 4;
      this.magPtr1 = this.exports.stft_get_magnitudes_ptr(1) / 4;
      this.maskPtr0 = this.exports.stft_get_mask_ptr(0) / 4;
      this.maskPtr1 = this.exports.stft_get_mask_ptr(1) / 4;

      this.isReady = true;
      this.port.postMessage({ type: "READY" });
    } catch (err) {
      this.port.postMessage({ type: "ERROR", message: err.toString() });
    }
  }

  receiveMask(maskL, maskR) {
    if (!this.isReady || !this.f32Mem) return;
    if (maskL) this.f32Mem.set(maskL, this.maskPtr0);
    if (maskR) this.f32Mem.set(maskR, this.maskPtr1);
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const numSamples = inL.length; // 128 samples per AudioWorklet tick

    // If bypassed or Wasm not ready, pass audio through cleanly
    if (!this.isReady || this.mode === 2) {
      outL.set(inL);
      outR.set(inR);
      return true;
    }

    // Push into accumulation ring buffer
    for (let i = 0; i < numSamples; i++) {
      this.ringInL[this.inWritePos] = inL[i];
      this.ringInR[this.inWritePos] = inR[i];
      this.inWritePos = (this.inWritePos + 1) % this.ringInL.length;
    }
    this.bufferedSamples += numSamples;

    // When we have accumulated 1 chunk of samples (chunkSamples = 8192)
    if (this.bufferedSamples >= this.chunkSamples) {
      // 1. Copy linear chunk to WASM input buffer
      const readStart = (this.inWritePos - this.bufferedSamples + this.ringInL.length) % this.ringInL.length;
      for (let i = 0; i < this.chunkSamples + this.fftSize; i++) {
        const idx = (readStart + i) % this.ringInL.length;
        this.f32Mem[this.inPtr0 + i] = this.ringInL[idx];
        this.f32Mem[this.inPtr1 + i] = this.ringInR[idx];
      }

      // 2. Run Forward STFT in C++ WASM
      this.exports.stft_forward(this.numFrames);

      // 3. Send magnitudes to WebGPU ONNX runner (if needed for AI prediction)
      const magsL = this.f32Mem.subarray(this.magPtr0, this.magPtr0 + this.numFrames * 1024);
      const magsR = this.f32Mem.subarray(this.magPtr1, this.magPtr1 + this.numFrames * 1024);
      this.port.postMessage({
        type: "PREDICT_MASK",
        magsL: magsL.slice(),
        magsR: magsR.slice(),
        numFrames: this.numFrames
      });

      // 4. Apply current spectral mask and synthesize output with iSTFT
      this.exports.stft_apply_mask(this.numFrames, this.mode, this.strength);
      this.exports.stft_backward(this.numFrames);

      // 5. Read synthesized output back into output buffer
      for (let i = 0; i < this.chunkSamples; i++) {
        this.ringOutL[i] = this.f32Mem[this.outPtr0 + i];
        this.ringOutR[i] = this.f32Mem[this.outPtr1 + i];
      }

      this.bufferedSamples -= this.chunkSamples;
      this.outReadPos = 0;
    }

    // Output playback from ringOut buffer (or pass through if not enough ready)
    if (this.outReadPos + numSamples <= this.ringOutL.length) {
      for (let i = 0; i < numSamples; i++) {
        outL[i] = this.ringOutL[this.outReadPos + i];
        outR[i] = this.ringOutR[this.outReadPos + i];
      }
      this.outReadPos += numSamples;
    } else {
      outL.set(inL);
      outR.set(inR);
    }

    return true;
  }
}

registerProcessor("ai-vocal-processor", AIVocalProcessor);
