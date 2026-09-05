/**
 * NextAmp AI Vocal Engine - Direct Offscreen Orchestrator
 * Runs directly in offscreen.html context with hardware-accelerated WebGL/WebGPU.
 * Non-blocking async architecture: Worklet connects instantly in 2ms, model streams in background.
 */

import { GoEngineClient } from "./go-engine-client.js";

const A = 16;       // 16 magnitude frames per chunk
const _ = 1024;     // 1024 frequency bins
const F = 8192;     // 8,192 samples per chunk (16 hops of 512)
const TAIL = 1536;  // 1,536 samples overlap tail (3 hops of 512)
// stft_core adds 1e-9 before sqrt() when calculating magnitudes, so a truly
// empty chunk is approximately 3.16e-5. Only bypass inference at that floor;
// quiet but audible material still follows the original model path.
const DIGITAL_SILENCE_PEAK = 3.25e-5;
const WEBGPU_BACKEND_ASSET = "assets/libs/js/tf-backend-webgpu.min.js";
let webGpuBackendPromise = null;

async function ensureWebGpuBackend() {
  if (typeof tf === "undefined" || typeof document === "undefined") return false;

  try {
    if (tf.findBackendFactory && tf.findBackendFactory("webgpu")) return true;
  } catch (_) {}

  if (!webGpuBackendPromise) {
    webGpuBackendPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = chrome.runtime.getURL(WEBGPU_BACKEND_ASSET);
      script.onload = () => {
        try { resolve(!!tf.findBackendFactory && !!tf.findBackendFactory("webgpu")); }
        catch (_) { resolve(false); }
      };
      script.onerror = () => {
        webGpuBackendPromise = null;
        resolve(false);
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }
  return webGpuBackendPromise;
}

export class AIVocalManager {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.workletNode = null;
    this.isReady = false;
    this.engineLoading = false;
    this.currentMode = "bypass";
    this.currentStatus = "ORIGINAL";
    this.onStatusChange = null;
    this.lastError = null;

    // Separation Settings (1=Soft/Fast, 2=Standard/Optimal, 3=Deep, 4=Ultra)
    this.diffLevel = 2;
    this.strength = 1.0;

    // Engine Selection: "webgl" (Browser in-app) or "go_native" (Desktop engine)
    this.engineType = "webgl";
    this.goClient = new GoEngineClient();
    this.goClient.onStatusChange = (status) => {
      if (this.engineType === "go_native") {
        this.setStatus(status);
      }
    };
    this.goClient.onChunkProcessed = (chunkIndex, outL, outR, rttMs, buf) => {
      // A sustained silence marks a new audio stream/song. Ignore responses
      // that were already in flight from the previous stream boundary.
      if (this.streamChunkFloor !== null && chunkIndex < this.streamChunkFloor) {
        return;
      }
      if (this.workletNode) {
        this.workletNode.port.postMessage(
          {
            type: "CHUNK_PROCESSED",
            chunkIndex,
            outL: outL,
            outR: outR
          },
          buf ? [buf] : [outL.buffer, outR.buffer]
        );
      }
      this.lastInferMs = rttMs;
      if (this.currentMode !== "bypass") {
        const modeLabel = this.currentMode === "karaoke" ? "KARAOKE (GO)" : "ACAPELLA (GO)";
        this.setStatus(`${modeLabel} [${rttMs}ms]`);
      }
    };

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
    this.interleavedPtr = 0;

    this.inHistoryL = new Float32Array(TAIL);
    this.inHistoryR = new Float32Array(TAIL);
    this.outTailL = new Float32Array(TAIL);
    this.outTailR = new Float32Array(TAIL);

    // High-efficiency pre-allocated buffer for zero-overhead typed array ingestion
    this.interleavedMags = new Float32Array(_ * A * 2);

    // Concurrency Lock & Latency Ceiling: Prevents GPU backlog and WASM memory collision
    this.isBusy = false;
    this.chunkQueue = [];
    this.chunkPeakHistory = new Map();
    this.streamChunkFloor = null;
    this.maxHistory = [1e-4, 1e-4, 1e-4, 1e-4];

    this.lastInferMs = 0;
    this.backendName = "GPU";
    this.benchmarkMs = 0;
    this.isHardwareSlow = false;
  }

  setStatus(status) {
    if (this.currentStatus === status) return;
    this.currentStatus = status;

    // Only write to chrome.storage.local on significant state transitions,
    // NOT on high-frequency (90ms) buffering progress, preventing tab IPC flooding.
    const shouldPersist = (status.startsWith("ERR") ||
                          status.startsWith("⚠️") ||
                          status === "ORIGINAL" || 
                          status.startsWith("ORIGINAL") || 
                          status === "KARAOKE" ||
                          status === "ACAPELLA" ||
                          status.startsWith("Loading")) && !status.includes("[");
    if (shouldPersist) {
      try {
        chrome.storage.local.set({ aiVocalStatus: status }).catch(() => {});
      } catch (_) {}
    }

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
      this.rollingMags = null;
    }
    // The production path keeps the rolling window in WASM
    // (stft_prepare_norm_input). Do not allocate a second GPU copy here;
    // the JS tensor is only created by the legacy fallback path below.
    this.inHistoryL.fill(0);
    this.inHistoryR.fill(0);
    this.outTailL.fill(0);
    this.outTailR.fill(0);
    this.chunkQueue = [];
    this.chunkPeakHistory.clear();
    this.maxHistory = [1e-4, 1e-4, 1e-4, 1e-4];
    if (this.exp && this.exp.stft_reset) {
      this.exp.stft_reset();
    }
  }

  /**
   * Fast Non-Blocking Init:
   * 1. Creates AudioWorkletNode immediately (2ms) so audio flows without delay
   * 2. Starts engine loading asynchronously in background
   */
  async init() {
    try {
      // 1. Load AudioWorklet module & create AudioWorkletNode
      const workletUrl = chrome.runtime.getURL("modules/ai-vocal/vocal-worklet.js");
      await this.audioCtx.audioWorklet.addModule(workletUrl);

      this.workletNode = new AudioWorkletNode(this.audioCtx, "nextamp-ai-vocal-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      // 2. Wire Worklet <-> Engine
      this.workletNode.port.onmessage = (e) => {
        const data = e.data;
        if (data.type === "PROCESS_CHUNK") {
          if (this.currentMode === "bypass") return;

          if (this.engineType === "go_native") {
            const depth = Math.max(1, Math.min(4, Number(this.diffLevel) || 2));
            const delayChunks = depth - 1;
            const ok = this.goClient.sendChunk(data.chunkIndex, data.rawL, data.rawR, data.mode, delayChunks);
            if (!ok && this.workletNode) {
              // Fallback pass-through so audio never starves if Go is offline
              this.workletNode.port.postMessage(
                {
                  type: "CHUNK_PROCESSED",
                  outL: data.rawL,
                  outR: data.rawR
                },
                [data.rawL.buffer, data.rawR.buffer]
              );
            }
          } else {
            if (this.isReady) {
              this.chunkQueue.push(data);
              if (this.chunkQueue.length > 8) {
                // Tab was suspended or heavily lagged; keep newest chunks to avoid backlog
                this.chunkQueue = this.chunkQueue.slice(-3);
              }
              if (!this.isBusy) {
                this.runChunkQueue();
              }
            }
          }
        } else if (data.type === "WORKLET_STATUS") {
          this.handleWorkletStatus(data);
        } else if (data.type === "STREAM_RESET") {
          // Flush the browser-side scheduler immediately. Then reset the
          // native DSP after all packets already sent before this marker.
          this.streamChunkFloor = Number.isInteger(data.nextChunkIndex)
            ? data.nextChunkIndex
            : null;
          this.chunkQueue = [];
          if (this.engineType === "go_native") {
            this.goClient.resetStream();
          } else {
            this.resetState();
          }
        }
      };

      this.setStatus("ORIGINAL");

      // Truly Lazy: DO NOT load 15MB model or start GPU on startup if in bypass (OFF)!
      if (this.currentMode !== "bypass") {
        this.loadEngine().catch((err) => {
          console.error("[NextAmp AI] Background engine load error:", err);
        });
      }

      return this.workletNode;
    } catch (err) {
      console.error("[NextAmp AI] Worklet creation failed:", err);
      this.lastError = err.message || err.toString();
      this.setStatus("ERR: Worklet");
      return null;
    }
  }

  async runChunkQueue() {
    if (this.isBusy || this.currentMode === "bypass" || !this.isReady) return;
    this.isBusy = true;
    try {
      while (this.chunkQueue.length > 0 && this.currentMode !== "bypass") {
        const chunk = this.chunkQueue.shift();
        await this.processChunk(chunk.chunkIndex, chunk.rawL, chunk.rawR, chunk.mode);
        // Yield momentarily to event loop without Windows timer quantization penalty
        if (this.chunkQueue.length > 0) {
          await new Promise((resolve) => queueMicrotask(resolve));
        }
      }
    } catch (err) {
      console.error("[NextAmp AI] Queue processing error:", err);
    } finally {
      this.isBusy = false;
    }
  }

  async loadEngine() {
    if (this.isReady || this.engineLoading) return;
    this.engineLoading = true;
    try {
      this.setStatus("Loading DSP...");

      // 0. Load in-house STFT WASM (SIMD128 with robust Scalar fallback)
      let instance;
      try {
        const simdUrl = chrome.runtime.getURL("modules/ai-vocal/stft_simd.wasm");
        const wasmRes = await fetch(simdUrl);
        const wasmBuf = await wasmRes.arrayBuffer();
        const instantiated = await WebAssembly.instantiate(wasmBuf, { env: {} });
        instance = instantiated.instance;
        console.log("[NextAmp AI] Loaded SIMD STFT WASM");
      } catch (simdErr) {
        console.warn("[NextAmp AI] SIMD WASM failed, falling back to scalar:", simdErr);
        const scalarUrl = chrome.runtime.getURL("modules/ai-vocal/stft_scalar.wasm");
        const wasmRes = await fetch(scalarUrl);
        const wasmBuf = await wasmRes.arrayBuffer();
        const instantiated = await WebAssembly.instantiate(wasmBuf, { env: {} });
        instance = instantiated.instance;
        console.log("[NextAmp AI] Loaded Scalar STFT WASM fallback");
      }
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
      this.interleavedPtr = this.exp.stft_get_interleaved_mags_ptr ? (this.exp.stft_get_interleaved_mags_ptr() / 4) : 0;
      this.normInputPtr = this.exp.stft_get_norm_input_ptr ? (this.exp.stft_get_norm_input_ptr() / 4) : 0;

      this.setStatus("Starting GPU...");

      // 1. Prefer WebGPU when the bundled backend and browser adapter are
      // available. It uses the same float32 model and tensor shapes as WebGL,
      // but avoids much of the ANGLE/DirectX11 shader overhead on Windows and
      // the legacy WebGL translation layer on Apple.
      const configureWebGL = async () => {
        try {
          tf.env().set("WEBGL_PACK", true);
          tf.env().set("WEBGL_PACK_BINARY_OPERATIONS", true);
          tf.env().set("WEBGL_CPU_FORWARD", false);
          tf.env().set("WEBGL_LAZILY_UNPACK", true);
          // Keep textures pooled: deleting/recreating them every chunk is
          // substantially more expensive on older Windows drivers.
          tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", -1);
          tf.env().set("PROD", true);

          // Try WebGL 2 first; some older Windows drivers only expose WebGL 1.
          try {
            tf.env().set("WEBGL_VERSION", 2);
            await tf.setBackend("webgl");
            await tf.ready();
          } catch (e2) {
            console.warn("[NextAmp AI] WebGL 2 failed, falling back to WebGL 1:", e2);
            tf.env().set("WEBGL_VERSION", 1);
            await tf.setBackend("webgl");
            await tf.ready();
          }
        } catch (webglErr) {
          console.warn("[NextAmp AI] WebGL failed completely, falling back to CPU:", webglErr);
          await tf.setBackend("cpu");
          await tf.ready();
        }
        return tf.getBackend() || "webgl";
      };

      let currentBackend = "";
      try {
        const hasWebGpu = typeof navigator !== "undefined" && navigator.gpu && await ensureWebGpuBackend();
        if (hasWebGpu && typeof tf.setBackend === "function") {
          // Keep the model's small post-processing ops on the same device;
          // CPU handoffs introduce synchronization and extra power draw.
          tf.env().set("WEBGPU_CPU_FORWARD", false);
          const selected = await tf.setBackend("webgpu");
          if (selected && tf.getBackend() === "webgpu") {
            await tf.ready();
            currentBackend = "webgpu";
          }
        }
      } catch (webgpuErr) {
        console.warn("[NextAmp AI] WebGPU unavailable, using WebGL:", webgpuErr);
      }
      if (currentBackend !== "webgpu") {
        currentBackend = await configureWebGL();
      }

      // Detect GPU hardware device label early before loading model
      currentBackend = tf.getBackend() || currentBackend || "webgl";
      let deviceLabel = currentBackend.toUpperCase();
      try {
        const gl = tf.backend()?.gpgpu?.gl;
        if (gl) {
          const dbg = gl.getExtension("WEBGL_debug_renderer_info");
          if (dbg) {
            const unmasked = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
            if (unmasked.includes("SwiftShader")) deviceLabel = "SwiftShader (CPU)";
            else if (unmasked.includes("GeForce") || unmasked.includes("NVIDIA")) {
              const m = unmasked.match(/NVIDIA GeForce [^,)]+/);
              deviceLabel = m ? m[0] : "NVIDIA";
            } else if (unmasked.includes("Intel")) {
              const m = unmasked.match(/Intel\(R\) [^,)]+/);
              deviceLabel = m ? m[0] : "Intel HD";
            } else if (unmasked.includes("AMD") || unmasked.includes("Radeon")) {
              const m = unmasked.match(/(AMD|Radeon) [^,)]+/);
              deviceLabel = m ? m[0] : "AMD";
            } else if (unmasked.includes("Apple")) {
              deviceLabel = "Apple GPU";
            }
          }
        }
      } catch (_) {}
      this.backendName = deviceLabel;

      // Early fast check before loading model:
      // If software CPU / SwiftShader is used, or if cached benchmark says slow, alert user immediately!
      if (currentBackend === "cpu" || deviceLabel.includes("SwiftShader")) {
        console.warn("[NextAmp AI] Software rendering detected (CPU / SwiftShader)");
        this.isHardwareSlow = true;
        this.benchmarkMs = 2500;
        this.broadcastHardwareWarning(2500, deviceLabel);
        // Do not upload the 15MB model or start a CPU inference loop that
        // cannot meet real-time audio. The caller remains in a safe bypass.
        this.engineLoading = false;
        this.setStatus("⚠️ CPU SLOW (No GPU)");
        return;
      } else {
        try {
          const cached = (await chrome.storage.local.get("cachedGpuBenchmark"))?.cachedGpuBenchmark;
          if (cached && cached.deviceLabel === deviceLabel && cached.isHardwareSlow) {
            this.isHardwareSlow = true;
            this.benchmarkMs = cached.benchmarkMs;
            this.broadcastHardwareWarning(cached.benchmarkMs, cached.deviceLabel);
          }
        } catch (_) {}
      }

      // 2. Register custom IO handler for chrome-extension:// scheme
      if (tf.io && tf.io.registerLoadRouter) {
        tf.io.registerLoadRouter((url) => {
          if (typeof url === "string" && (url.startsWith("chrome-extension://") || url.startsWith("./") || url.startsWith("../"))) {
            return tf.io.browserHTTPRequest(url);
          }
          return null;
        });
      }

      this.setStatus("Loading Model (15MB)...");

      const modelUrl = chrome.runtime.getURL("model/model.json");
      const ioHandler = (tf.io && tf.io.browserHTTPRequest)
        ? tf.io.browserHTTPRequest(modelUrl)
        : modelUrl;

      const runWarmup = async () => {
        const dummyInput = tf.zeros([1, _, 64, 2]);
        let outTensor = null;
        let maskTensor = null;
        try {
          outTensor = this.model.execute(dummyInput);
          maskTensor = tf.tidy(() => {
            const sliced = outTensor.slice([0, 0, 32, 0], [1, _, A, 2]);
            return sliced.transpose([0, 3, 2, 1]).reshape([2, A, _]).sigmoid();
          });
          // Flush the accelerator pipeline and compile the readback path too.
          await maskTensor.data();
        } finally {
          if (maskTensor) maskTensor.dispose();
          if (outTensor) outTensor.dispose();
          dummyInput.dispose();
        }
      };

      const fallbackToWebGL = async () => {
        if (currentBackend !== "webgpu") return false;
        console.warn("[NextAmp AI] WebGPU model path failed; retrying with WebGL");
        if (this.model) {
          try { this.model.dispose(); } catch (_) {}
          this.model = null;
        }
        currentBackend = await configureWebGL();
        deviceLabel = currentBackend.toUpperCase();
        this.backendName = deviceLabel;
        if (currentBackend === "cpu") {
          throw new Error("WebGPU unavailable and WebGL fell back to CPU");
        }
        this.setStatus("Loading Model (15MB)...");
        this.model = await tf.loadGraphModel(ioHandler);
        this.resetState();
        this.setStatus("Warming up GPU...");
        await runWarmup();
        return true;
      };

      this.model = await tf.loadGraphModel(ioHandler);

      // Check if cancelled/unloaded while downloading/loading model
      if (!this.engineLoading) {
        if (this.model) {
          try { this.model.dispose(); } catch (_) {}
          this.model = null;
        }
        return;
      }

      this.resetState();

      // Accelerator Pre-Compilation (Warm-Up):
      // Pre-compiles all kernels (conv2d, depthwise, resize, concat, slice,
      // transpose, sigmoid) using the exact runtime dimensions.
      // using the exact graph and dimensions of runtime processChunk to prevent initial JIT compilation freezes!
      this.setStatus("Warming up GPU...");
      try {
        await runWarmup();
        console.log(`[NextAmp AI] ${currentBackend.toUpperCase()} pipeline pre-warmed`);
      } catch (warmErr) {
        if (!(await fallbackToWebGL())) {
          console.warn("[NextAmp AI] Warmup pass error:", warmErr);
        }
      }

      // 3. One-Time 1-Chunk Hardware Benchmark: Measure actual steady-state latency
      let benchmarkMs = 0;
      try {
        const tBench0 = performance.now();
        const benchIn = tf.zeros([1, _, 64, 2]);
        const benchOut = this.model.execute(benchIn);
        benchIn.dispose();
        const benchMask = tf.tidy(() => {
          const sliced = benchOut.slice([0, 0, 32, 0], [1, _, A, 2]);
          return sliced.transpose([0, 3, 2, 1]).reshape([2, A, _]).sigmoid();
        });
        benchOut.dispose();
        await benchMask.data();
        benchMask.dispose();
        benchmarkMs = Math.round(performance.now() - tBench0);
        this.benchmarkMs = benchmarkMs;
        console.log(`[NextAmp AI] Hardware benchmark 1-chunk: ${benchmarkMs}ms on ${this.backendName}`);

        if (benchmarkMs > 185) {
          this.isHardwareSlow = true;
          this.broadcastHardwareWarning(benchmarkMs, this.backendName);
        } else {
          this.isHardwareSlow = false;
        }

        try {
          chrome.storage.local.set({
            cachedGpuBenchmark: {
              deviceLabel: this.backendName,
              benchmarkMs: benchmarkMs,
              isHardwareSlow: this.isHardwareSlow,
              timestamp: Date.now()
            }
          }).catch(() => {});
        } catch (_) {}
      } catch (benchErr) {
        console.warn("[NextAmp AI] Benchmark test error:", benchErr);
      }

      console.log(`[NextAmp AI] Engine ready with hardware: ${this.backendName}`);
      this.isReady = true;
      this.engineLoading = false;

      if (this.workletNode) {
        this.workletNode.port.postMessage({ type: "WORKER_READY" });
      }

      if (this.currentMode === "bypass") {
        this.setStatus(this.isHardwareSlow ? `⚠️ GPU SLOW (${this.benchmarkMs}ms)` : "ORIGINAL (AI Ready)");
      } else {
        if (this.isHardwareSlow) {
          this.setStatus(`⚠️ GPU SLOW (${this.benchmarkMs}ms)`);
        } else {
          this.setStatus("Buffering...");
        }
      }
    } catch (err) {
      this.engineLoading = false;
      console.error("[NextAmp AI] Engine load failed:", err);
      this.lastError = err.message || err.toString();
      this.setStatus("ERR: " + this.lastError.substring(0, 18));
    }
  }

  handleWorkletStatus(data) {
    if (this.lastError) {
      this.setStatus("ERR: " + this.lastError.substring(0, 16));
      return;
    }
    if (data.mode === "bypass") {
      this.setStatus("ORIGINAL");
      return;
    }
    if (!this.isReady) {
      this.setStatus("Loading Model (15MB)...");
      return;
    }
    const backend = this.backendName || "GPU";
    const msStr = this.lastInferMs ? ` (${backend} ${this.lastInferMs}ms)` : ` [${backend}]`;
    if (!data.isAiReady) {
      const targetSec = ((data.readyThreshold || 5) * 8192 / 44100).toFixed(1);
      if (parseFloat(data.bufferedSec) === 0 && this.lastInferMs === 0) {
        const modeLabel = data.mode === "karaoke" ? "KARAOKE" : "ACAPELLA";
        this.setStatus(`${modeLabel} (Ready - Play audio) [${backend}]`);
      } else {
        this.setStatus(`Buffering AI: ${data.bufferedSec}s / ${targetSec}s [${backend}]`);
      }
    } else {
      this.setStatus(data.mode === "karaoke" ? `KARAOKE (CUT)${msStr}` : `ACAPELLA (ISO)${msStr}`);
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

      const modeCode = mode === "karaoke" ? 1 : mode === "acapella" ? 0 : 2;

      // Lookahead Depth & Exact Time Alignment
      // diffLevel: 1=Soft (0 delay, real-time), 2=Standard (1 chunk delay), 3=Deep (2 chunks), 4=Ultra (3 chunks)
      const depth = Math.max(1, Math.min(4, Number(this.diffLevel) || 2));
      const delayChunks = depth - 1;
      const sliceStart = 48 - 16 * delayChunks; // Level 2 (Standard) = Frame 32 (100% time-aligned to Chunk N-1!)

      // 3. Peak Tracking and Global Normalization Factor
      let chunkPeak = 1e-5;
      if (this.exp.stft_get_chunk_peak) {
        chunkPeak = this.exp.stft_get_chunk_peak();
      }
      this.chunkPeakHistory.set(chunkIndex, chunkPeak);
      // Chunk indexes restart when the worklet changes mode. Keep only the
      // small lookahead window needed for deciding whether an output chunk is
      // truly silent.
      for (const oldIndex of this.chunkPeakHistory.keys()) {
        if (oldIndex < chunkIndex - 8) this.chunkPeakHistory.delete(oldIndex);
      }
      this.maxHistory.push(chunkPeak);
      if (this.maxHistory.length > 4) this.maxHistory.shift();
      const globalMax = Math.max(...this.maxHistory, 1e-4);
      const invMax = 1.0 / globalMax;

      // The delayed spectrum is the actual output target. Only bypass model
      // inference when that target is known to be digital silence; checking
      // the current input alone would be wrong at the lookahead boundary.
      const targetChunkIndex = chunkIndex - delayChunks;
      const targetPeak = targetChunkIndex < 0
        ? 0
        : this.chunkPeakHistory.get(targetChunkIndex);
      const targetIsDigitalSilence = targetPeak !== undefined && targetPeak <= DIGITAL_SILENCE_PEAK;
      if (targetIsDigitalSilence) {
        this.exp.stft_apply_mask_delayed(delayChunks, A, 2, 0.0);
      } else {
        // 4. Zero-GPU-Overhead Rolling Window & Ingestion
        let normInput;
        if (this.normInputPtr && this.exp.stft_prepare_norm_input) {
          // Native compiled C SIMD slides 48 frames and normalizes 131,072 floats in 0.02ms!
          // Eliminates GPU slice, GPU concat, GPU mul, and GPU texture allocations completely!
          this.exp.stft_prepare_norm_input(invMax);
          normInput = tf.tensor4d(
            this.mem.subarray(this.normInputPtr, this.normInputPtr + _ * 64 * 2),
            [1, _, 64, 2]
          );
        } else {
          const mags0 = this.mem.subarray(this.magPtr0, this.magPtr0 + A * _);
          const mags1 = this.mem.subarray(this.magPtr1, this.magPtr1 + A * _);
          let p = 0;
          for (let k = 0; k < _; k++) {
            for (let f = 0; f < A; f++) {
              this.interleavedMags[p++] = mags0[f * _ + k];
              this.interleavedMags[p++] = mags1[f * _ + k];
            }
          }
          if (!this.rollingMags) this.rollingMags = tf.zeros([1, _, 64, 2]);
          const [newRolling, nIn] = tf.tidy(() => {
            const newMags = tf.tensor4d(this.interleavedMags, [1, _, A, 2]);
            const rolled = this.rollingMags.slice([0, 0, 16, 0], [1, _, 48, 2]).concat(newMags, 2);
            return [rolled, rolled.mul(invMax)];
          });
          if (this.rollingMags) this.rollingMags.dispose();
          this.rollingMags = newRolling;
          normInput = nIn;
        }

        // 5. Hardware-Accelerated U-Net Inference (Single GPU Shader Pipeline)
        const outTensor = this.model.execute(normInput);
        normInput.dispose(); // Free normalized input immediately

        // 6. Slice time-aligned window & compute sigmoid mask in tidy
        const maskTensor = tf.tidy(() => {
          const sliced = outTensor.slice([0, 0, sliceStart, 0], [1, _, A, 2]);
          outTensor.dispose(); // Free large 64-frame output tensor from GPU immediately!
          return sliced.transpose([0, 3, 2, 1]).reshape([2, A, _]).sigmoid();
        });

        const maskData = await maskTensor.data();
        maskTensor.dispose(); // Free mask tensor immediately!

        // 7. Write pure neural network mask directly into WASM mask buffer
        this.mem.subarray(this.maskPtr0, this.maskPtr0 + A * _).set(maskData.subarray(0, A * _));
        this.mem.subarray(this.maskPtr1, this.maskPtr1 + A * _).set(maskData.subarray(A * _, 2 * A * _));

        // 8. Pure Mask Application via C/WASM
        this.exp.stft_apply_mask_delayed(delayChunks, A, modeCode, this.strength);
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

      this.lastInferMs = Math.round(performance.now() - tStart);

      // Chunk 0 primes the WASM lookahead ring buffer (reads from uninitialized delay slot)
      // Discard Chunk 0 so it never injects 185ms of digital silence into the playback stream!
      if (chunkIndex === 0) {
        return;
      }

      // Deliver real processed chunk to AudioWorklet
      this.workletNode.port.postMessage(
        {
          type: "CHUNK_PROCESSED",
          chunkIndex,
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

  setDiffLevel(level) {
    this.diffLevel = Math.max(1, Math.min(4, Number(level) || 2));
    this.strength = 1.0;
  }

  broadcastHardwareWarning(benchmarkMs, deviceLabel) {
    try {
      chrome.storage.local.set({
        aiHardwareWarning: {
          benchmarkMs: benchmarkMs,
          deviceLabel: deviceLabel,
          timestamp: Date.now()
        }
      }).catch(() => {});
      chrome.runtime.sendMessage({
        type: "AI_HARDWARE_WARNING",
        benchmarkMs: benchmarkMs,
        deviceLabel: deviceLabel
      }).catch(() => {});
    } catch (_) {}
  }

  async preloadEngine() {
    if (this.isReady || this.engineLoading) return;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "SET_MODE", mode: "bypass" });
    }
    this.setStatus("ORIGINAL (Loading AI...)");
    await this.loadEngine();
  }

  unloadEngine() {
    this.isReady = false;
    this.engineLoading = false;
    this.chunkQueue = [];
    this.resetState();
    if (this.model) {
      try {
        this.model.dispose();
      } catch (_) {}
      this.model = null;
    }
    if (typeof tf !== "undefined") {
      try {
        tf.disposeVariables();
      } catch (_) {}
    }
    this.currentMode = "bypass";
    this.setStatus("ORIGINAL");
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "SET_MODE", mode: "bypass" });
    }
    console.log("[NextAmp AI] Model unloaded & GPU memory freed");
  }

  setEngineType(type) {
    const valid = (type === "go_native") ? "go_native" : "webgl";
    this.engineType = valid;
    this.streamChunkFloor = null;
    console.log("[NextAmp AI] Switched engine to:", this.engineType);

    if (this.engineType === "go_native") {
      this.goClient.enable();
      if (this.currentMode !== "bypass") {
        this.setStatus("⚡ GO ENGINE (Active)");
        if (this.workletNode) {
          this.workletNode.port.postMessage({ type: "WORKER_READY" });
        }
      }
    } else {
      this.goClient.disable();
      if (this.currentMode !== "bypass") {
        if (!this.isReady && !this.engineLoading) {
          this.loadEngine().catch(() => {});
        } else {
          this.setStatus(this.isReady ? "Buffering..." : "Loading Model (15MB)...");
        }
      }
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    this.streamChunkFloor = null;
    this.chunkQueue = [];
    this.resetState();
    if (mode !== "bypass") {
      if (this.engineType === "go_native") {
        this.goClient.enable();
        this.setStatus("⚡ GO ENGINE (Loopback)");
        if (this.workletNode) {
          this.workletNode.port.postMessage({ type: "WORKER_READY" });
        }
      } else {
        if (this.isHardwareSlow) {
          this.broadcastHardwareWarning(this.benchmarkMs, this.backendName);
        }
        if (!this.isReady) {
          this.setStatus("Loading Model (15MB)...");
          if (!this.engineLoading) {
            this.loadEngine().catch((err) => {
              console.error("[NextAmp AI] Lazy engine load error:", err);
            });
          }
        } else {
          this.setStatus(this.isHardwareSlow ? `⚠️ GPU SLOW (${this.benchmarkMs}ms)` : "Buffering...");
        }
      }
    } else {
      if (this.engineType === "go_native") {
        this.setStatus(this.goClient.isConnected ? "⚡ GO (Ready)" : "ORIGINAL");
      } else {
        this.setStatus(this.isReady ? (this.isHardwareSlow ? `⚠️ GPU SLOW (${this.benchmarkMs}ms)` : "ORIGINAL (AI Ready)") : "ORIGINAL");
      }
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
