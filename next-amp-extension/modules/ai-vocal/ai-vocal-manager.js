/**
 * NextAmp AI Vocal Engine - Direct Offscreen Orchestrator
 * Runs directly in offscreen.html context with hardware-accelerated WebGL/WebGPU.
 * Non-blocking async architecture: Worklet connects instantly in 2ms, model streams in background.
 */

import { GoEngineClient } from "./go-engine-client.js";
import { createVocalModelLoader } from "./model-optimizer.mjs";

const _ = 1024;     // 1024 frequency bins
const TAIL = 1536;  // 1,536 samples overlap tail (3 hops of 512)
const MAX_BROWSER_FRAMES = 16;
const DEFAULT_VOCAL_PROFILE = "balanced";
const VOCAL_PROFILES = Object.freeze({
  // Current production candidate: the cadence that was tested as the
  // smoothest on Apple and Windows GTX 1050 Ti.
  balanced: Object.freeze({
    frames: 15,
    chunkSamples: 7680,
    sliceStart: 34,
    delayChunks: 1
  }),
  // Closest safe full-processing profile available in this app. It restores
  // the original 16-hop app cadence and alignment while keeping the proven
  // optimized graph. The external AI Remove bundle uses a different WASM
  // timeline and cannot be reproduced exactly without its source artifacts.
  ai_remove: Object.freeze({
    frames: 16,
    chunkSamples: 8192,
    sliceStart: 32,
    delayChunks: 1
  })
});
// stft_core adds 1e-9 before sqrt() when calculating magnitudes, so a truly
// empty chunk is approximately 3.16e-5. Only bypass inference at that floor;
// quiet but audible material still follows the original model path.
const DIGITAL_SILENCE_PEAK = 3.25e-5;
const WEBGPU_BACKEND_ASSET = "assets/libs/js/tf-backend-webgpu.min.js";
const MAX_BROWSER_PENDING_CHUNKS = 2; // Keep at most ~348ms pending; drop stale work under interruption.
const DIAGNOSTIC_SAMPLE_LIMIT = 120;
let webGpuBackendPromise = null;

function pushDiagnosticSample(samples, value) {
  if (!Number.isFinite(value) || value <= 0) return;
  if (samples.length >= DIAGNOSTIC_SAMPLE_LIMIT) samples.shift();
  samples.push(value);
}

function summarizeDiagnosticSamples(samples) {
  if (!samples.length) return { count: 0, p50Ms: null, p95Ms: null, p99Ms: null, maxMs: null };
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = ratio => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
  return {
    count: samples.length,
    p50Ms: Number(percentile(0.50).toFixed(2)),
    p95Ms: Number(percentile(0.95).toFixed(2)),
    p99Ms: Number(percentile(0.99).toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

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

    // Former DIFF=2 behavior is now fixed: one chunk of lookahead.
    this.vocalProfile = DEFAULT_VOCAL_PROFILE;
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
      // Only tune from results that belong to the current stream. A late
      // response from the previous song must not make the next song choose a
      // wrong queue target.
      this.observeGoLatency(rttMs);
      if (this.workletNode) {
        this.workletNode.port.postMessage(
          {
            type: "CHUNK_PROCESSED",
            chunkIndex,
            generation: this.streamGeneration,
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
    this.interleavedMags = new Float32Array(_ * MAX_BROWSER_FRAMES * 2);

    // Concurrency Lock & Latency Ceiling: Prevents GPU backlog and WASM memory collision
    this.isBusy = false;
    this.chunkQueue = new Array(MAX_BROWSER_PENDING_CHUNKS).fill(null);
    this.chunkQueueSize = 0;
    this.queueNeedsResync = false;
    this.resyncChunkIndex = null;
    this.streamGeneration = 0;
    // Fixed-size histories keep the Web hot path allocation-free. Eight
    // entries cover the current lookahead plus resync margin without Map
    // churn; the four-slot max history preserves the original normalization.
    this.chunkPeakHistoryIndex = new Int32Array(8).fill(-1);
    this.chunkPeakHistoryValues = new Float32Array(8);
    this.chunkPeakHistoryPos = 0;
    this.streamChunkFloor = null;
    this.maxHistory = new Float32Array([1e-4, 1e-4, 1e-4, 1e-4]);
    this.maxHistoryPos = 0;

    this.lastInferMs = 0;
    this.backendName = "GPU";
    this.backendType = "unknown";
    this.benchmarkMs = 0;
    this.isHardwareSlow = false;
    this.modelGraphFoldedBranches = 0;
    this.modelGraphExplicitPads = 0;
    this.goLatencySamples = [];
    this.goBufferTarget = null;
    this.diagnostics = {
      startedAt: Date.now(),
      enabled: false,
      inputChunks: 0,
      goChunks: 0,
      queuedChunks: 0,
      processedChunks: 0,
      intentionalWarmupDrops: 0,
      staleWorkDrops: 0,
      staleResultDrops: 0,
      generationDrops: 0,
      resyncs: 0,
      streamResets: 0,
      processErrors: 0,
      maxPendingQueue: 0,
      lastInputChunkIndex: null,
      lastProcessed: null,
      lastWorkletStatus: null,
      timings: {
        stftForward: [],
        normalization: [],
        modelLaunch: [],
        modelReadback: [],
        inference: [],
        synthesis: [],
        total: []
      }
    };
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

  getProcessingConfig() {
    return VOCAL_PROFILES[this.vocalProfile] || VOCAL_PROFILES[DEFAULT_VOCAL_PROFILE];
  }

  resetGoBufferTuning() {
    this.goLatencySamples = [];
    this.goBufferTarget = null;
  }

  observeGoLatency(rttMs) {
    if (!Number.isFinite(rttMs) || rttMs <= 0) return;
    if (this.goLatencySamples.length >= 24) this.goLatencySamples.shift();
    this.goLatencySamples.push(rttMs);
    if (this.goLatencySamples.length < 8 || this.engineType !== "go_native" || !this.workletNode) return;

    const sorted = [...this.goLatencySamples].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
    const chunkMs = 8192 / (this.audioCtx?.sampleRate || 44100) * 1000;
    // Only lower startup buffering after measured deadline margin exists. On
    // a slower provider, retain a larger ceiling for short OS/GPU spikes while
    // the in-flight cap still prevents latency from growing without bound.
    const readyThreshold = p95 <= chunkMs * 0.70 ? 2 : (p95 <= chunkMs ? 3 : 4);
    const maxQueueThreshold = Math.max(readyThreshold + 1, 4);
    const target = `${readyThreshold}/${maxQueueThreshold}`;
    if (this.goBufferTarget === target) return;
    this.goBufferTarget = target;
    this.workletNode.port.postMessage({
      type: "SET_QUEUE_TARGET",
      engineType: "go_native",
      readyThreshold,
      maxQueueThreshold,
      p95Ms: Math.round(p95 * 10) / 10
    });
  }

  setVocalProfile(profile) {
    const nextProfile = profile === "ai_remove" ? "ai_remove" : DEFAULT_VOCAL_PROFILE;
    if (nextProfile === this.vocalProfile) return;

    this.vocalProfile = nextProfile;
    // A profile changes the browser packet cadence. Invalidate work already
    // in flight so an old 15-hop result can never enter the new 16-hop stream.
    this.streamGeneration++;
    this.streamChunkFloor = null;
    this.resetState();
    // A profile switch is a new audio timeline even on native GO. The
    // Worklet flush alone is not enough: native STFT/lookahead state and
    // in-flight responses must cross the same boundary or Smooth/Detail can
    // start with mismatched chunks and temporarily produce silence.
    if (this.engineType === "go_native") {
      this.goClient.resetStream();
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_PROFILE",
        profile: this.vocalProfile,
        browserChunkSize: this.getProcessingConfig().chunkSamples,
        engineType: this.engineType,
        generation: this.streamGeneration
      });
    }
    if (this.currentMode !== "bypass") this.setStatus("Buffering...");
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
    this.clearChunkQueue();
    this.queueNeedsResync = false;
    this.resyncChunkIndex = null;
    this.chunkPeakHistoryIndex.fill(-1);
    this.chunkPeakHistoryValues.fill(0);
    this.chunkPeakHistoryPos = 0;
    this.maxHistory.fill(1e-4);
    this.maxHistoryPos = 0;
    if (this.exp && this.exp.stft_reset) {
      this.exp.stft_reset();
    }
  }

  recordChunkPeak(chunkIndex, chunkPeak) {
    const slot = this.chunkPeakHistoryPos;
    this.chunkPeakHistoryIndex[slot] = chunkIndex;
    this.chunkPeakHistoryValues[slot] = chunkPeak;
    this.chunkPeakHistoryPos = (slot + 1) & 7;
  }

  getChunkPeak(chunkIndex) {
    for (let i = 0; i < this.chunkPeakHistoryIndex.length; i++) {
      if (this.chunkPeakHistoryIndex[i] === chunkIndex) {
        return this.chunkPeakHistoryValues[i];
      }
    }
    return undefined;
  }

  clearChunkQueue() {
    for (let i = 0; i < MAX_BROWSER_PENDING_CHUNKS; i++) {
      this.chunkQueue[i] = null;
    }
    this.chunkQueueSize = 0;
  }

  replaceChunkQueue(chunk) {
    this.clearChunkQueue();
    this.chunkQueue[0] = chunk;
    this.chunkQueueSize = 1;
  }

  enqueueChunk(chunk) {
    if (this.chunkQueueSize >= MAX_BROWSER_PENDING_CHUNKS) return false;
    this.chunkQueue[this.chunkQueueSize++] = chunk;
    return true;
  }

  dequeueChunk() {
    if (this.chunkQueueSize <= 0) return null;
    const chunk = this.chunkQueue[0];
    for (let i = 1; i < this.chunkQueueSize; i++) {
      this.chunkQueue[i - 1] = this.chunkQueue[i];
    }
    this.chunkQueue[--this.chunkQueueSize] = null;
    return chunk;
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
          this.diagnostics.inputChunks++;
          this.diagnostics.lastInputChunkIndex = data.chunkIndex;

          if (this.engineType === "go_native") {
            this.diagnostics.goChunks++;
            // DIFF is fixed at its proven former level 2: one chunk of
            // lookahead. Profile selection only changes the browser path.
            // Keep the native bridge bounded. If the server cannot keep up,
            // discard stale in-flight work, reset both DSP timelines, and
            // continue from this newest chunk instead of building latency.
            if (!this.goClient.canSendChunk()) {
              const staleInFlight = this.goClient.pendingChunks.size;
              this.diagnostics.staleWorkDrops += staleInFlight;
              this.diagnostics.resyncs++;
              this.streamGeneration++;
              this.streamChunkFloor = data.chunkIndex;
              this.goClient.resetStream();
              if (this.workletNode) {
                this.workletNode.port.postMessage({
                  type: "RESYNC",
                  nextChunkIndex: data.chunkIndex,
                  generation: this.streamGeneration
                });
              }
            }
            this.goClient.sendChunk(data.chunkIndex, data.rawL, data.rawR, data.mode, 1);
            // Never feed raw audio back into the GO path when the bridge is
            // unavailable. The worklet's GO concealment path will mute the
            // brief underrun instead of leaking the original vocal signal.
          } else {
            if (this.isReady) {
              // Under a tab switch/page load, inference can temporarily stop
              // while the worklet keeps collecting audio. Once that happens,
              // processing every old chunk only creates growing latency. Keep
              // the newest chunk and restart DSP state at that point.
              if (this.queueNeedsResync) {
                this.diagnostics.staleWorkDrops += this.chunkQueueSize;
                this.replaceChunkQueue(data);
                this.resyncChunkIndex = data.chunkIndex;
              } else if (this.chunkQueueSize >= MAX_BROWSER_PENDING_CHUNKS) {
                this.diagnostics.staleWorkDrops += this.chunkQueueSize;
                this.replaceChunkQueue(data);
                this.queueNeedsResync = true;
                this.resyncChunkIndex = data.chunkIndex;
              } else {
                this.enqueueChunk(data);
              }
              this.diagnostics.queuedChunks++;
              this.diagnostics.maxPendingQueue = Math.max(
                this.diagnostics.maxPendingQueue, this.chunkQueueSize
              );
              if (!this.isBusy) {
                this.runChunkQueue();
              }
            }
          }
        } else if (data.type === "WORKLET_STATUS") {
          this.diagnostics.lastWorkletStatus = {
            mode: data.mode,
            generation: data.generation,
            isAiReady: !!data.isAiReady,
            bufferedSec: data.bufferedSec,
            queueLen: data.queueLen,
            chunkSize: data.chunkSize,
            sampleRate: data.sampleRate,
            inputFrame: data.inputFrame,
            playbackFrame: data.playbackFrame,
            diagnostics: data.diagnostics || null
          };
          this.handleWorkletStatus(data);
        } else if (data.type === "STREAM_RESET") {
          // Flush the browser-side scheduler immediately. Then reset the
          // native DSP after all packets already sent before this marker.
          this.streamGeneration++;
          this.diagnostics.streamResets++;
          this.streamChunkFloor = Number.isInteger(data.nextChunkIndex)
            ? data.nextChunkIndex
            : null;
          this.clearChunkQueue();
          this.queueNeedsResync = false;
          this.resyncChunkIndex = null;
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
      while (this.chunkQueueSize > 0 && this.currentMode !== "bypass") {
        const chunk = this.dequeueChunk();
        if (this.queueNeedsResync) {
          const nextChunkIndex = Number.isInteger(this.resyncChunkIndex)
            ? this.resyncChunkIndex : chunk.chunkIndex;
          this.queueNeedsResync = false;
          this.diagnostics.resyncs++;
          this.resyncChunkIndex = null;
          this.resetState();
          if (this.workletNode) {
            this.workletNode.port.postMessage({
              type: "RESYNC",
              nextChunkIndex
            });
          }
        }
        const generation = this.streamGeneration;
        await this.processChunk(
          chunk.chunkIndex,
          chunk.rawL,
          chunk.rawR,
          chunk.mode,
          1.0,
          generation
        );
        // Yield momentarily to event loop without Windows timer quantization penalty
        if (this.chunkQueueSize > 0) {
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
      this.backendType = currentBackend;
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
      const modelLoader = createVocalModelLoader(tf, ioHandler);

      const runWarmup = async () => {
        const processing = this.getProcessingConfig();
        const frames = processing.frames;
        const dummyInput = tf.zeros([1, _, 64, 2]);
        let outTensor = null;
        let maskTensor = null;
        try {
          outTensor = this.model.execute(dummyInput);
          maskTensor = tf.tidy(() => {
            const sliced = outTensor.slice([0, 0, processing.sliceStart, 0], [1, _, frames, 2]);
            return sliced.transpose([0, 3, 2, 1]).reshape([2, frames, _]).sigmoid();
          });
          // Flush the accelerator pipeline and compile the readback path too.
          await maskTensor.data();
        } finally {
          if (maskTensor) maskTensor.dispose();
          if (outTensor) outTensor.dispose();
          dummyInput.dispose();
        }
      };

      const warmupWithOriginalFallback = async () => {
        try {
          await runWarmup();
        } catch (error) {
          if (!modelLoader.foldedCount) throw error;
          console.warn("[NextAmp AI] Native dilation warmup failed; retrying original graph", error);
          if (this.model) this.model.dispose();
          this.model = null;
          modelLoader.disableOptimization();
          this.model = await modelLoader.load();
          this.modelGraphFoldedBranches = modelLoader.foldedCount;
          this.modelGraphExplicitPads = modelLoader.explicitPadCount;
          await runWarmup();
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
        this.backendType = currentBackend;
        deviceLabel = currentBackend.toUpperCase();
        this.backendName = deviceLabel;
        if (currentBackend === "cpu") {
          throw new Error("WebGPU unavailable and WebGL fell back to CPU");
        }
        this.setStatus("Loading Model (15MB)...");
        this.model = await modelLoader.load();
        this.modelGraphFoldedBranches = modelLoader.foldedCount;
        this.modelGraphExplicitPads = modelLoader.explicitPadCount;
        this.resetState();
        this.setStatus("Warming up GPU...");
        await warmupWithOriginalFallback();
        return true;
      };

      this.model = await modelLoader.load();
      this.modelGraphFoldedBranches = modelLoader.foldedCount;
      this.modelGraphExplicitPads = modelLoader.explicitPadCount;
      if (modelLoader.foldedCount || modelLoader.explicitPadCount) {
        console.log(`[NextAmp AI] Optimized model graph: removed ${modelLoader.foldedCount * 2} data-reordering nodes and ${modelLoader.explicitPadCount} standalone padding nodes (unchanged weights)`);
      }

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
        await warmupWithOriginalFallback();
        console.log(`[NextAmp AI] ${currentBackend.toUpperCase()} pipeline pre-warmed`);
      } catch (warmErr) {
        if (!(await fallbackToWebGL())) {
          throw warmErr;
        }
      }

      // 3. One-Time 1-Chunk Hardware Benchmark: Measure actual steady-state latency
      let benchmarkMs = 0;
      try {
        const tBench0 = performance.now();
        const processing = this.getProcessingConfig();
        const frames = processing.frames;
        const benchIn = tf.zeros([1, _, 64, 2]);
        const benchOut = this.model.execute(benchIn);
        benchIn.dispose();
        const benchMask = tf.tidy(() => {
          const sliced = benchOut.slice([0, 0, processing.sliceStart, 0], [1, _, frames, 2]);
          return sliced.transpose([0, 3, 2, 1]).reshape([2, frames, _]).sigmoid();
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
      const targetSec = ((data.readyThreshold || 5) * (data.chunkSize || this.getProcessingConfig().chunkSamples) / 44100).toFixed(1);
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

  async processChunk(chunkIndex, rawL, rawR, mode, strength = 1.0, generation = this.streamGeneration) {
    if (!this.exp || !this.model || !this.workletNode) return;
    if (generation !== this.streamGeneration || this.currentMode === "bypass" || mode !== this.currentMode) {
      this.diagnostics.generationDrops++;
      return;
    }

    const tStart = performance.now();
    const processing = this.getProcessingConfig();
    const frames = processing.frames;
    const chunkSamples = processing.chunkSamples;
    const diagnosticsEnabled = this.diagnostics.enabled;
    let stftForwardMs = 0;
    let normalizationMs = 0;
    let modelLaunchMs = 0;
    let modelReadbackMs = 0;
    let inferenceMs = 0;
    let synthesisStart = 0;

    try {
      if (this.mem.buffer !== this.exp.memory.buffer) {
        this.mem = new Float32Array(this.exp.memory.buffer);
      }

      // 1. Zero-Copy Input Sliding: history + profile-sized current chunk.
      this.mem.subarray(this.inPtr0, this.inPtr0 + TAIL).set(this.inHistoryL);
      this.mem.subarray(this.inPtr0 + TAIL, this.inPtr0 + TAIL + chunkSamples).set(rawL);
      this.inHistoryL.set(rawL.subarray(chunkSamples - TAIL, chunkSamples));

      this.mem.subarray(this.inPtr1, this.inPtr1 + TAIL).set(this.inHistoryR);
      this.mem.subarray(this.inPtr1 + TAIL, this.inPtr1 + TAIL + chunkSamples).set(rawR);
      this.inHistoryR.set(rawR.subarray(chunkSamples - TAIL, chunkSamples));

      // 2. SIMD128 Forward STFT: profile-sized frame batch.
      const stftStart = diagnosticsEnabled ? performance.now() : 0;
      this.exp.stft_forward(frames);
      if (diagnosticsEnabled) stftForwardMs = performance.now() - stftStart;

      const modeCode = mode === "karaoke" ? 1 : mode === "acapella" ? 0 : 2;

      // Former DIFF=2 behavior is fixed: one chunk of lookahead.
      const delayChunks = processing.delayChunks;
      const sliceStart = processing.sliceStart;

      // 3. Peak Tracking and Global Normalization Factor
      let chunkPeak = 1e-5;
      if (this.exp.stft_get_chunk_peak) {
        chunkPeak = this.exp.stft_get_chunk_peak();
      }
      // Chunk indexes restart when the Worklet changes mode. Keep only the
      // small lookahead window needed for deciding whether an output chunk is
      // truly silent, without Map allocation/cleanup in the hot path.
      this.recordChunkPeak(chunkIndex, chunkPeak);
      this.maxHistory[this.maxHistoryPos] = chunkPeak;
      this.maxHistoryPos = (this.maxHistoryPos + 1) & 3;
      let globalMax = 1e-4;
      for (let i = 0; i < this.maxHistory.length; i++) {
        if (this.maxHistory[i] > globalMax) globalMax = this.maxHistory[i];
      }
      const invMax = 1.0 / globalMax;

      // The delayed spectrum is the actual output target. Only bypass model
      // inference when that target is known to be digital silence; checking
      // the current input alone would be wrong at the lookahead boundary.
      const targetChunkIndex = chunkIndex - delayChunks;
      const targetPeak = targetChunkIndex < 0
        ? 0
        : this.getChunkPeak(targetChunkIndex);
      const targetIsDigitalSilence = targetPeak !== undefined && targetPeak <= DIGITAL_SILENCE_PEAK;
      if (targetIsDigitalSilence) {
        this.exp.stft_apply_mask_delayed(delayChunks, frames, 2, 0.0);
      } else {
        // 4. Zero-GPU-Overhead Rolling Window & Ingestion
        const normalizationStart = diagnosticsEnabled ? performance.now() : 0;
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
          const mags0 = this.mem.subarray(this.magPtr0, this.magPtr0 + frames * _);
          const mags1 = this.mem.subarray(this.magPtr1, this.magPtr1 + frames * _);
          let p = 0;
          for (let k = 0; k < _; k++) {
            for (let f = 0; f < frames; f++) {
              this.interleavedMags[p++] = mags0[f * _ + k];
              this.interleavedMags[p++] = mags1[f * _ + k];
            }
          }
          if (!this.rollingMags) this.rollingMags = tf.zeros([1, _, 64, 2]);
          const [newRolling, nIn] = tf.tidy(() => {
            const newMags = tf.tensor4d(
              this.interleavedMags.subarray(0, _ * frames * 2),
              [1, _, frames, 2]
            );
            const rolled = this.rollingMags
              .slice([0, 0, frames, 0], [1, _, 64 - frames, 2])
              .concat(newMags, 2);
            return [rolled, rolled.mul(invMax)];
          });
          if (this.rollingMags) this.rollingMags.dispose();
          this.rollingMags = newRolling;
          normInput = nIn;
        }
        if (diagnosticsEnabled) normalizationMs = performance.now() - normalizationStart;

        // 5. Hardware-Accelerated U-Net Inference (Single GPU Shader Pipeline)
        const modelStart = diagnosticsEnabled ? performance.now() : 0;
        const outTensor = this.model.execute(normInput);
        if (diagnosticsEnabled) modelLaunchMs = performance.now() - modelStart;
        normInput.dispose(); // Free normalized input immediately

        // 6. Slice time-aligned window & compute sigmoid mask in tidy
        const maskTensor = tf.tidy(() => {
          const sliced = outTensor.slice([0, 0, sliceStart, 0], [1, _, frames, 2]);
          outTensor.dispose(); // Free large 64-frame output tensor from GPU immediately!
          return sliced.transpose([0, 3, 2, 1]).reshape([2, frames, _]).sigmoid();
        });

        const readbackStart = diagnosticsEnabled ? performance.now() : 0;
        const maskData = await maskTensor.data();
        if (diagnosticsEnabled) {
          modelReadbackMs = performance.now() - readbackStart;
          inferenceMs = performance.now() - modelStart;
        }
        maskTensor.dispose(); // Free mask tensor immediately!

        // A mode/song/engine switch can happen while GPU readback is pending.
        // Do not let that old inference mutate the new stream or emit stale audio.
        if (generation !== this.streamGeneration || this.currentMode === "bypass" || mode !== this.currentMode) {
          this.diagnostics.staleResultDrops++;
          return;
        }

        // 7. Write pure neural network mask directly into WASM mask buffer
        this.mem.subarray(this.maskPtr0, this.maskPtr0 + frames * _).set(maskData.subarray(0, frames * _));
        this.mem.subarray(this.maskPtr1, this.maskPtr1 + frames * _).set(maskData.subarray(frames * _, 2 * frames * _));

        // 8. Pure Mask Application via C/WASM
        this.exp.stft_apply_mask_delayed(delayChunks, frames, modeCode, this.strength);
      }

      // 9. Inverse STFT with SIMD128
      synthesisStart = diagnosticsEnabled ? performance.now() : 0;
      this.exp.stft_backward(frames);

      // 10. Overlap-Add synthesis: add previous tail to first 1,536 samples
      const synthL = this.mem.subarray(this.outPtr0, this.outPtr0 + chunkSamples + TAIL);
      const synthR = this.mem.subarray(this.outPtr1, this.outPtr1 + chunkSamples + TAIL);

      for (let i = 0; i < TAIL; i++) {
        synthL[i] += this.outTailL[i];
        synthR[i] += this.outTailR[i];
      }

      // Extract exactly one browser cadence: 7,680 continuous samples
      const outL = new Float32Array(synthL.subarray(0, chunkSamples));
      const outR = new Float32Array(synthR.subarray(0, chunkSamples));

      // Save overlap tail for next chunk
      this.outTailL.set(synthL.subarray(chunkSamples, chunkSamples + TAIL));
      this.outTailR.set(synthR.subarray(chunkSamples, chunkSamples + TAIL));

      this.diagnostics.processedChunks++;
      if (diagnosticsEnabled) {
        this.diagnostics.lastProcessed = {
          inputChunkIndex: chunkIndex,
          generation,
          profile: this.vocalProfile,
          inputFrame: chunkIndex * frames,
          targetChunkIndex,
          targetFrame: targetChunkIndex * frames,
          depth: delayChunks + 1,
          chunkSamples,
          digitalSilenceBypass: targetIsDigitalSilence
        };
        pushDiagnosticSample(this.diagnostics.timings.stftForward, stftForwardMs);
        pushDiagnosticSample(this.diagnostics.timings.normalization, normalizationMs);
        pushDiagnosticSample(this.diagnostics.timings.modelLaunch, modelLaunchMs);
        pushDiagnosticSample(this.diagnostics.timings.modelReadback, modelReadbackMs);
        pushDiagnosticSample(this.diagnostics.timings.inference, inferenceMs);
        pushDiagnosticSample(this.diagnostics.timings.synthesis, performance.now() - synthesisStart);
        pushDiagnosticSample(this.diagnostics.timings.total, performance.now() - tStart);
      }

      this.lastInferMs = Math.round(performance.now() - tStart);

      if (generation !== this.streamGeneration || this.currentMode === "bypass" || mode !== this.currentMode) {
        return;
      }

      // Chunk 0 primes the WASM lookahead ring buffer (reads from uninitialized delay slot)
      // Discard Chunk 0 so it never injects one cadence of digital silence into playback.
      if (chunkIndex === 0) {
        this.diagnostics.intentionalWarmupDrops++;
        return;
      }

      // Deliver real processed chunk to AudioWorklet
      this.workletNode.port.postMessage(
        {
          type: "CHUNK_PROCESSED",
          chunkIndex,
          generation,
          outL: outL,
          outR: outR
        },
        [outL.buffer, outR.buffer]
      );
    } catch (err) {
      this.diagnostics.processErrors++;
      console.error("[NextAmp AI] processChunk error:", err);
      this.lastError = err.message || err.toString();
      this.setStatus("ERR: " + this.lastError.substring(0, 16));
    }
  }

  setDiffLevel() {
    // Backward-compatible API for old remote clients. DIFF is intentionally
    // fixed at the former level 2 (one chunk of lookahead).
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
      this.workletNode.port.postMessage({
        type: "SET_MODE",
        mode: "bypass",
        profile: this.vocalProfile,
        browserChunkSize: this.getProcessingConfig().chunkSamples,
        engineType: this.engineType,
        generation: this.streamGeneration
      });
    }
    this.setStatus("ORIGINAL (Loading AI...)");
    await this.loadEngine();
  }

  unloadEngine() {
    this.isReady = false;
    this.engineLoading = false;
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
      this.workletNode.port.postMessage({
        type: "SET_MODE",
        mode: "bypass",
        profile: this.vocalProfile,
        browserChunkSize: this.getProcessingConfig().chunkSamples,
        engineType: this.engineType,
        generation: this.streamGeneration
      });
    }
    console.log("[NextAmp AI] Model unloaded & GPU memory freed");
  }

  setEngineType(type) {
    const valid = (type === "go_native") ? "go_native" : "webgl";
    if (this.engineType !== valid) {
      this.streamGeneration++;
      this.resetState();
    }
    this.engineType = valid;
    this.resetGoBufferTuning();
    this.streamChunkFloor = null;
    console.log("[NextAmp AI] Switched engine to:", this.engineType);
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_ENGINE",
        engineType: this.engineType,
        browserChunkSize: this.getProcessingConfig().chunkSamples,
        generation: this.streamGeneration
      });
    }

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
    this.streamGeneration++;
    this.currentMode = mode;
    this.resetGoBufferTuning();
    this.streamChunkFloor = null;
    this.clearChunkQueue();
    this.resetState();
    // Start native DSP and the Worklet on the same stream boundary. This is
    // important for the first bypass -> Karaoke click and for mode changes.
    if (this.engineType === "go_native") {
      this.goClient.resetStream();
    }
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
      this.workletNode.port.postMessage({
        type: "SET_MODE",
        mode,
        engineType: this.engineType,
        profile: this.vocalProfile,
        browserChunkSize: this.getProcessingConfig().chunkSamples,
        generation: this.streamGeneration
      });
    }
  }

  getNode() {
    return this.workletNode;
  }

  enableDiagnostics() {
    this.diagnostics.enabled = true;
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "SET_DIAGNOSTICS",
        enabled: true
      });
    }
    return this.getDiagnostics();
  }

  getDiagnostics() {
    const timingMs = {};
    for (const [name, samples] of Object.entries(this.diagnostics.timings)) {
      timingMs[name] = summarizeDiagnosticSamples(samples);
    }
    let tensorCount = null;
    try { tensorCount = typeof tf !== "undefined" ? tf.memory().numTensors : null; } catch (_) {}
    let texturePrecision = null;
    try {
      texturePrecision = typeof tf !== "undefined" && this.backendType === "webgl"
        ? { forceF16: !!tf.env().get("WEBGL_FORCE_F16_TEXTURES") }
        : null;
    } catch (_) {}
    const processing = this.getProcessingConfig();
    const chunkSamples = this.engineType === "go_native" ? 8192 : processing.chunkSamples;
    const sampleRate = this.audioCtx?.sampleRate || 44100;
    let goAdaptiveP95Ms = null;
    if (this.goLatencySamples.length > 0) {
      const sortedGoLatency = [...this.goLatencySamples].sort((a, b) => a - b);
      const p95Index = Math.min(
        sortedGoLatency.length - 1,
        Math.ceil(sortedGoLatency.length * 0.95) - 1
      );
      goAdaptiveP95Ms = Number(sortedGoLatency[p95Index].toFixed(1));
    }
    return {
      version: 1,
      enabled: this.diagnostics.enabled,
      engine: this.engineType,
      backendType: this.backendType,
      backend: this.backendName,
      sampleRate,
      texturePrecision,
      profile: this.vocalProfile,
      modelGraphFoldedBranches: this.modelGraphFoldedBranches,
      modelGraphExplicitPads: this.modelGraphExplicitPads,
      cadence: {
        chunkSamples,
        frames: this.engineType === "go_native" ? 16 : processing.frames,
        hopSamples: 512,
        chunkMs: Number((chunkSamples / sampleRate * 1000).toFixed(2))
      },
      queue: {
        pending: this.chunkQueueSize,
        maxPending: this.diagnostics.maxPendingQueue,
        staleWorkDrops: this.diagnostics.staleWorkDrops,
        resyncs: this.diagnostics.resyncs
      },
      goBridge: {
        pending: this.goClient.pendingChunks.size,
        maxInFlight: this.goClient.maxInFlightChunks,
        backpressureDrops: this.goClient.backpressureDrops
      },
      goAdaptive: {
        samples: this.goLatencySamples.length,
        p95Ms: goAdaptiveP95Ms,
        target: this.goBufferTarget
      },
      stream: {
        generation: this.streamGeneration,
        resets: this.diagnostics.streamResets,
        generationDrops: this.diagnostics.generationDrops,
        staleResultDrops: this.diagnostics.staleResultDrops,
        lastInputChunkIndex: this.diagnostics.lastInputChunkIndex,
        lastProcessed: this.diagnostics.lastProcessed
      },
      chunks: {
        input: this.diagnostics.inputChunks,
        go: this.diagnostics.goChunks,
        processed: this.diagnostics.processedChunks,
        intentionalWarmupDrops: this.diagnostics.intentionalWarmupDrops,
        errors: this.diagnostics.processErrors
      },
      timingMs,
      tensorCount,
      worklet: this.diagnostics.lastWorkletStatus
    };
  }

  destroy() {
    this.resetState();
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch (_) {}
      this.workletNode = null;
    }
  }
}
