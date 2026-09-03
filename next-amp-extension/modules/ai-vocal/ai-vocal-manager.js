/**
 * NextAmp AI Vocal Engine - Direct Offscreen Orchestrator
 * Runs directly in offscreen.html context with hardware-accelerated WebGL/WebGPU.
 * Eliminates Web Worker fragility, importScripts path issues, and multi-hop serialization.
 */

const A = 16;       // 16 magnitude frames per chunk
const _ = 1024;     // 1024 frequency bins
const F = 8192;     // 8,192 samples per chunk (16 hops of 512)
const TAIL = 1536;  // 1,536 samples overlap tail (3 hops of 512)
const VOCAL_ENERGY_THRESHOLD = 0.005;

export class AIVocalManager {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.workletNode = null;
    this.isReady = false;
    this.currentMode = "bypass";
    this.currentStatus = "ORIGINAL";
    this.onStatusChange = null;
    this.lastError = null;

    // DSP WASM
    this.wasmInstance = null;
    this.exp = null;
    this.mem = null;
    this.model = null;
    this.rollingMags = null;

    this.inPtr0 = 0;
    this.inPtr1 = 0;
    this.outPtr0 = 0;
    this.outPtr1 = 0;
    this.magPtr0 = 0;
    this.magPtr1 = 0;
    this.maskPtr0 = 0;
    this.maskPtr1 = 0;

    this.inHistoryL = new Float32Array(TAIL);
    this.inHistoryR = new Float32Array(TAIL);
    this.outTailL = new Float32Array(TAIL);
    this.outTailR = new Float32Array(TAIL);
  }

  setStatus(status) {
    this.currentStatus = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  getStatus() {
    return this.currentStatus;
  }

  resetState() {
    if (this.rollingMags) {
      try { this.rollingMags.dispose(); } catch (_) {}
    }
    if (typeof tf !== "undefined") {
      this.rollingMags = tf.zeros([1, _, 64, 2]);
    }
    this.inHistoryL.fill(0);
    this.inHistoryR.fill(0);
    this.outTailL.fill(0);
    this.outTailR.fill(0);
    if (this.exp && this.exp.stft_reset) {
      this.exp.stft_reset();
    }
  }

  async init() {
    try {
      this.setStatus("Loading DSP...");

      // 1. Load our in-house stft_simd.wasm (with scalar fallback)
      let wasmRes;
      const simdUrl = chrome.runtime.getURL("modules/ai-vocal/stft_simd.wasm");
      try {
        wasmRes = await fetch(simdUrl);
      } catch (_) {
        const scalarUrl = chrome.runtime.getURL("modules/ai-vocal/stft_scalar.wasm");
        wasmRes = await fetch(scalarUrl);
      }
      const wasmBuf = await wasmRes.arrayBuffer();

      const { instance } = await WebAssembly.instantiate(wasmBuf, { env: {} });
      this.wasmInstance = instance;
      this.exp = instance.exports;
      this.mem = new Float32Array(this.exp.memory.buffer);

      // Initialize DSP tables
      this.exp.stft_init();

      // Cache buffer pointers (byte offset / 4)
      this.inPtr0 = this.exp.stft_get_input_ptr(0) / 4;
      this.inPtr1 = this.exp.stft_get_input_ptr(1) / 4;
      this.outPtr0 = this.exp.stft_get_output_ptr(0) / 4;
      this.outPtr1 = this.exp.stft_get_output_ptr(1) / 4;
      this.magPtr0 = this.exp.stft_get_magnitudes_ptr(0) / 4;
      this.magPtr1 = this.exp.stft_get_magnitudes_ptr(1) / 4;
      this.maskPtr0 = this.exp.stft_get_mask_ptr(0) / 4;
      this.maskPtr1 = this.exp.stft_get_mask_ptr(1) / 4;

      this.setStatus("Starting GPU...");

      // 2. Hardware-Accelerated Backend Selection (WebGPU -> WebGL Packed -> CPU Fallback)
      let activeBackend = "webgl";
      try {
        if (typeof navigator !== "undefined" && navigator.gpu) {
          await tf.setBackend("webgpu");
          activeBackend = "webgpu";
        }
      } catch (_) {
        activeBackend = "webgl";
      }

      if (activeBackend === "webgl") {
        try {
          await tf.setBackend("webgl");
          tf.env().set("WEBGL_PACK", true);
          tf.env().set("WEBGL_PACK_BINARY_OPERATIONS", true);
          tf.env().set("WEBGL_PACK_NORMALIZATION", true);
          tf.env().set("WEBGL_CPU_FORWARD", false);
          tf.env().set("WEBGL_FORCE_F16_TEXTURES", true);
          tf.env().set("PROD", true);
        } catch (webglErr) {
          console.warn("[NextAmp AI] WebGL failed, falling back to CPU:", webglErr);
          await tf.setBackend("cpu");
          activeBackend = "cpu";
        }
      }
      await tf.ready();

      // 3. Register custom IO handler for chrome-extension:// scheme
      if (tf.io && tf.io.registerLoadRouter) {
        tf.io.registerLoadRouter((url) => {
          if (typeof url === "string" && (url.startsWith("chrome-extension://") || url.startsWith("./") || url.startsWith("../"))) {
            return tf.io.browserHTTPRequest(url);
          }
          return null;
        });
      }

      this.setStatus("Loading Model...");

      const modelUrl = chrome.runtime.getURL("model/model.json");
      const ioHandler = (tf.io && tf.io.browserHTTPRequest)
        ? tf.io.browserHTTPRequest(modelUrl)
        : modelUrl;

      this.model = await tf.loadGraphModel(ioHandler);
      this.resetState();

      console.log(`[NextAmp AI] In-page engine ready with backend: ${activeBackend.toUpperCase()}`);

      // 4. Load AudioWorklet module & create AudioWorkletNode
      const workletUrl = chrome.runtime.getURL("modules/ai-vocal/vocal-worklet.js");
      await this.audioCtx.audioWorklet.addModule(workletUrl);

      this.workletNode = new AudioWorkletNode(this.audioCtx, "nextamp-ai-vocal-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      // 5. Wire Worklet <-> Engine
      this.workletNode.port.onmessage = async (e) => {
        const data = e.data;
        if (data.type === "PROCESS_CHUNK") {
          if (this.isReady) {
            await this.processChunk(data.chunkIndex, data.rawL, data.rawR, data.mode);
          }
        } else if (data.type === "WORKLET_STATUS") {
          this.handleWorkletStatus(data);
        }
      };

      this.isReady = true;
      this.workletNode.port.postMessage({ type: "WORKER_READY" });
      this.setStatus("ORIGINAL");

      return this.workletNode;
    } catch (err) {
      console.error("[NextAmp AI] Initialization failed:", err);
      this.lastError = err.message || err.toString();
      this.setStatus("ERR: " + this.lastError.substring(0, 18));
      return null;
    }
  }

  handleWorkletStatus(data) {
    if (this.lastError) {
      this.setStatus("ERR: " + this.lastError.substring(0, 16));
      return;
    }
    if (!this.isReady) {
      this.setStatus("Loading AI...");
      return;
    }
    if (data.mode === "bypass") {
      this.setStatus("ORIGINAL");
    } else if (data.fadeVal < 0.85) {
      this.setStatus(`Preparing AI: ${data.bufferedSec}s / 0.8s`);
    } else {
      this.setStatus(data.mode === "karaoke" ? "KARAOKE (CUT)" : "ACAPELLA (ISO)");
    }
  }

  async processChunk(chunkIndex, rawL, rawR, mode, strength = 1.0) {
    if (!this.exp || !this.model || !this.workletNode) return;

    const tStart = performance.now();

    try {
      if (this.mem.buffer !== this.exp.memory.buffer) {
        this.mem = new Float32Array(this.exp.memory.buffer);
      }

      // 1. Zero-Copy Input Sliding: 1,536 history + 8,192 current = 9,728 samples
      this.mem.subarray(this.inPtr0, this.inPtr0 + TAIL).set(this.inHistoryL);
      this.mem.subarray(this.inPtr0 + TAIL, this.inPtr0 + TAIL + F).set(rawL);
      this.inHistoryL.set(rawL.subarray(F - TAIL, F));

      this.mem.subarray(this.inPtr1, this.inPtr1 + TAIL).set(this.inHistoryR);
      this.mem.subarray(this.inPtr1 + TAIL, this.inPtr1 + TAIL + F).set(rawR);
      this.inHistoryR.set(rawR.subarray(F - TAIL, F));

      // 2. SIMD128 Forward STFT: computes 16 frames & stores to C circular ring buffer
      this.exp.stft_forward(A);

      const modeCode = mode === "acapella" ? 1 : mode === "karaoke" ? 0 : 2;

      // 3. Smart Vocal Activity Detection (VAD) / Instrumental Gating
      const vocalEnergy = this.exp.stft_get_vocal_energy(A);
      const isInstrumentalSilence = (vocalEnergy < VOCAL_ENERGY_THRESHOLD && mode === "karaoke");

      if (isInstrumentalSilence) {
        this.exp.stft_apply_mask_delayed(1, A, 2, 0.0);
      } else {
        // 4. Update 64-frame rolling magnitudes tensor [1, 1024, 64, 2]
        const mags0 = this.mem.subarray(this.magPtr0, this.magPtr0 + A * _);
        const mags1 = this.mem.subarray(this.magPtr1, this.magPtr1 + A * _);

        const [newRolling, normInput] = tf.tidy(() => {
          const newMags = tf.stack([
            tf.tensor2d(mags0, [A, _]),
            tf.tensor2d(mags1, [A, _])
          ]).transpose([2, 1, 0]).reshape([1, _, A, 2]);

          const rolled = this.rollingMags.slice([0, 0, 16, 0], [1, _, 48, 2]).concat(newMags, 2);
          return [rolled, rolled.divNoNan(rolled.max())];
        });

        // 5. Hardware-Accelerated U-Net Inference
        const outTensor = this.model.execute(normInput);
        normInput.dispose();

        // 6. Slicing mask centered at Frame 31 (Peak Receptive Field Fidelity)
        const maskTensor = tf.tidy(() => {
          const transposed = outTensor.transpose([0, 3, 2, 1]).reshape([2, 64, _]);
          outTensor.dispose();
          return transposed.slice([0, 31, 0], [2, A, _]).sigmoid();
        });

        const maskData = await maskTensor.data();
        maskTensor.dispose();

        if (this.rollingMags) this.rollingMags.dispose();
        this.rollingMags = newRolling;

        // 7. Write mask directly into WASM mask buffer
        this.mem.subarray(this.maskPtr0, this.maskPtr0 + A * _).set(maskData.subarray(0, A * _));
        this.mem.subarray(this.maskPtr1, this.maskPtr1 + A * _).set(maskData.subarray(A * _, 2 * A * _));

        // 8. Zero-Copy C/WASM Mask Application to Delayed Spectrum (1 chunk lookahead)
        this.exp.stft_apply_mask_delayed(1, A, modeCode, strength);
      }

      // 9. Inverse STFT with SIMD128
      this.exp.stft_backward(A);

      // 10. Overlap-Add synthesis: add previous tail to first 1,536 samples
      const synthL = this.mem.subarray(this.outPtr0, this.outPtr0 + F + TAIL);
      const synthR = this.mem.subarray(this.outPtr1, this.outPtr1 + F + TAIL);

      for (let i = 0; i < TAIL; i++) {
        synthL[i] += this.outTailL[i];
        synthR[i] += this.outTailR[i];
      }

      // Extract exactly 8,192 continuous samples
      const outL = new Float32Array(synthL.subarray(0, F));
      const outR = new Float32Array(synthR.subarray(0, F));

      // Save overlap tail for next chunk
      this.outTailL.set(synthL.subarray(F, F + TAIL));
      this.outTailR.set(synthR.subarray(F, F + TAIL));

      // Deliver processed chunk to AudioWorklet
      this.workletNode.port.postMessage(
        {
          type: "CHUNK_PROCESSED",
          outL: outL,
          outR: outR
        },
        [outL.buffer, outR.buffer]
      );
    } catch (err) {
      console.error("[NextAmp AI] processChunk error:", err);
      this.lastError = err.message || err.toString();
      this.setStatus("ERR: " + this.lastError.substring(0, 16));
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    if (mode !== "bypass") {
      this.resetState();
      if (!this.isReady) {
        this.setStatus("Loading AI...");
      } else {
        this.setStatus("Buffering...");
      }
    } else {
      this.setStatus("ORIGINAL");
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "SET_MODE", mode });
    }
  }

  getNode() {
    return this.workletNode;
  }

  destroy() {
    this.resetState();
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch (_) {}
      this.workletNode = null;
    }
  }
}
