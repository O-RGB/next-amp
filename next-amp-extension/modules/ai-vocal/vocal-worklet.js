/**
 * NextAmp AI Vocal Separator - Real-time AudioWorkletProcessor
 * 
 * Clean Mute-Until-Ready Architecture:
 * - When switching to Karaoke / Acapella, output mutes immediately (smooth ~5.8ms micro-fade).
 * - Remains completely silent while AI model primes and buffers 2 real chunks (~0.35s in browser mode).
 * - Smoothly fades in directly to isolated Karaoke music once buffer is ready.
 * - Resets stream state at genuine song boundaries so old audio cannot leak
 *   into the next song.
 */

const GO_CHUNK_SIZE = 8192; // 16 frames * 512 hop (GO wire protocol)
const BROWSER_CHUNK_SIZE = 7680; // 15 hops * 512 (~174.1ms), smooth profile
const MAX_CHUNK_SIZE = GO_CHUNK_SIZE;
const FADE_OUT_SPEED = 1.0 / 256;  // ~5.8ms fast, click-free mute
const FADE_IN_SPEED = 1.0 / 1024;  // ~23ms smooth fade-in
const READY_QUEUE_THRESHOLD = 2;   // 2 browser chunks (~348ms) cushion against latency spikes
const MAX_QUEUE_THRESHOLD = 5;     // 5 browser chunks (~871ms) latency ceiling prevents delay accumulation
const GO_READY_QUEUE_THRESHOLD = 3; // Native GO cushion without the old ~1s startup delay
const GO_MAX_QUEUE_THRESHOLD = 4;   // ~743ms ceiling before stale native output is discarded
const OUTPUT_QUEUE_CAPACITY = MAX_QUEUE_THRESHOLD + 1;
const TRANSFER_BUFFER_POOL_CAPACITY = 3; // active + bounded pending work
const MESSAGE_POOL_CAPACITY = 3;
const BROWSER_MAX_LAG_CHUNKS = 3;   // Drop browser results that are already too far behind live audio
const CONCEAL_FADE_OUT_SPEED = 1.0 / 256; // hide an unavoidable GO underrun without a click
const CONCEAL_FADE_IN_SPEED = 1.0 / 512;  // restore processed audio smoothly after recovery
const BOUNDARY_SILENCE_PEAK = 0.0003; // matches the native engine's near-silence floor
const SILENCE_RESET_CHUNKS = 2;       // ~348ms in browser mode at 44.1kHz
const MISSING_INPUT_RESET_BLOCKS = 128; // ~371ms when the source stops providing buffers
const WORKLET_SAMPLE_RATE = typeof sampleRate === "number" ? sampleRate : 44100;

class AIVocalWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.mode = "bypass"; // "bypass", "karaoke", "acapella"
    this.targetMode = "bypass";
    this.engineType = "webgl";
    this.vocalProfile = "balanced";
    this.chunkSize = BROWSER_CHUNK_SIZE;
    this.readyThreshold = READY_QUEUE_THRESHOLD;
    this.maxQueueThreshold = MAX_QUEUE_THRESHOLD;

    // Input accumulator
    this.inAccumL = new Float32Array(MAX_CHUNK_SIZE);
    this.inAccumR = new Float32Array(MAX_CHUNK_SIZE);
    this.inAccumPos = 0;
    this.chunkPeak = 0.0;
    this.silentChunks = 0;
    this.inSilenceBoundary = false;
    this.missingInputBlocks = 0;

    // One active chunk plus the two bounded pending chunks can be in flight.
    // Returned buffers are transferred back from the manager after it copies
    // the input into WASM. The fallback is only for an abnormal backlog race.
    this.inputBufferPools = {
      [BROWSER_CHUNK_SIZE]: { rawL: [], rawR: [] },
      [GO_CHUNK_SIZE]: { rawL: [], rawR: [] }
    };
    for (const size of [BROWSER_CHUNK_SIZE, GO_CHUNK_SIZE]) {
      for (let i = 0; i < TRANSFER_BUFFER_POOL_CAPACITY; i++) {
        this.inputBufferPools[size].rawL.push(new Float32Array(size));
        this.inputBufferPools[size].rawR.push(new Float32Array(size));
      }
    }
    this.processMessages = new Array(MESSAGE_POOL_CAPACITY);
    this.processMessagePos = 0;
    this.outputReturnMessages = new Array(MESSAGE_POOL_CAPACITY);
    this.outputReturnMessagePos = 0;
    for (let i = 0; i < MESSAGE_POOL_CAPACITY; i++) {
      this.processMessages[i] = {
        type: "PROCESS_CHUNK",
        chunkIndex: 0,
        generation: 0,
        rawL: null,
        rawR: null,
        mode: "bypass"
      };
      this.outputReturnMessages[i] = {
        type: "RETURN_OUTPUT_BUFFERS",
        outL: null,
        outR: null
      };
    }

    // Output playback queue. Keep the storage fixed so normal audio status
    // and response delivery never call shift()/push() on a growing array.
    this.outQueueL = new Array(OUTPUT_QUEUE_CAPACITY).fill(null);
    this.outQueueR = new Array(OUTPUT_QUEUE_CAPACITY).fill(null);
    this.outQueueIndex = new Array(OUTPUT_QUEUE_CAPACITY).fill(null);
    this.outQueueHead = 0;
    this.outQueueSize = 0;
    this.currChunkL = null;
    this.currChunkR = null;
    this.currChunkIndex = null;
    this.currChunkPos = 0;

    // Audio state:
    // When in bypass: liveGain = 1.0, aiGain = 0.0
    // When preparing AI: liveGain = 0.0, aiGain = 0.0 (MUTED)
    // When AI ready: liveGain = 0.0, aiGain = 1.0
    this.liveGain = 1.0;
    this.aiGain = 0.0;
    this.isAiReady = false;
    this.concealGain = 1.0;
    this.playbackChunkIndex = null;
    this.playbackSamples = 0;
    this.latestInputChunkIndex = null;
    this.streamGeneration = 0;

    this.chunkSeq = 0;
    this.statusCount = 0;
    this.diagnosticsEnabled = false;
    this.diagnostics = {
      chunksSent: 0,
      staleDrops: 0,
      duplicateDrops: 0,
      resyncs: 0,
      streamResets: 0,
      modeTransitions: 0,
      underrunBlocks: 0,
      lastInputChunkIndex: null,
      lastPlaybackChunkIndex: null
    };

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === "SET_MODE") {
        const modeChanged = this.targetMode !== data.mode;
        const nextGeneration = Number.isInteger(data.generation)
          ? data.generation : this.streamGeneration + (modeChanged ? 1 : 0);
        const generationChanged = nextGeneration !== this.streamGeneration;
        this.streamGeneration = nextGeneration;
        if (data.engineType === "go_native" || data.engineType === "webgl") {
          this.engineType = data.engineType;
          this.setChunkSizeForEngine(this.engineType, data.browserChunkSize);
        }
        if (data.profile === "balanced" || data.profile === "ai_remove") {
          this.vocalProfile = data.profile;
        }
        if (this.targetMode !== data.mode || generationChanged) {
          this.diagnostics.modeTransitions++;
          this.targetMode = data.mode;
          // Purge all audio queues and state on ANY mode transition
          this.isAiReady = false;
          this.readyThreshold = this.engineType === "go_native"
            ? GO_READY_QUEUE_THRESHOLD : READY_QUEUE_THRESHOLD;
          this.maxQueueThreshold = this.engineType === "go_native"
            ? GO_MAX_QUEUE_THRESHOLD : MAX_QUEUE_THRESHOLD;
          this.releaseCurrentChunk();
          this.clearOutputQueue();
          this.currChunkL = null;
          this.currChunkR = null;
          this.currChunkIndex = null;
          this.currChunkPos = 0;
          this.concealGain = 1.0;
          this.playbackChunkIndex = null;
          this.playbackSamples = 0;
          this.latestInputChunkIndex = null;
          this.chunkPeak = 0.0;
          this.silentChunks = 0;
          this.inSilenceBoundary = false;
          this.missingInputBlocks = 0;
          this.inAccumPos = 0;
          this.chunkSeq = 0;
          if (data.mode !== "bypass") {
            this.aiGain = 0.0;
          }
        }
      } else if (data.type === "SET_ENGINE") {
        const nextEngine = data.engineType === "go_native" ? "go_native" : "webgl";
        if (Number.isInteger(data.generation)) this.streamGeneration = data.generation;
        if (this.engineType !== nextEngine) {
          this.engineType = nextEngine;
          this.setChunkSizeForEngine(this.engineType, data.browserChunkSize);
          this.isAiReady = false;
          this.releaseCurrentChunk();
          this.clearOutputQueue();
          this.currChunkL = null;
          this.currChunkR = null;
          this.currChunkIndex = null;
          this.currChunkPos = 0;
          this.concealGain = 1.0;
          this.playbackChunkIndex = null;
          this.playbackSamples = 0;
          this.latestInputChunkIndex = null;
          this.inAccumPos = 0;
          this.chunkPeak = 0.0;
          this.aiGain = 0.0;
        }
        this.readyThreshold = this.engineType === "go_native"
          ? GO_READY_QUEUE_THRESHOLD : READY_QUEUE_THRESHOLD;
        this.maxQueueThreshold = this.engineType === "go_native"
          ? GO_MAX_QUEUE_THRESHOLD : MAX_QUEUE_THRESHOLD;
      } else if (data.type === "SET_PROFILE") {
        const nextProfile = data.profile === "ai_remove" ? "ai_remove" : "balanced";
        const nextGeneration = Number.isInteger(data.generation)
          ? data.generation : this.streamGeneration + 1;
        const generationChanged = nextGeneration !== this.streamGeneration;
        const profileChanged = nextProfile !== this.vocalProfile;
        this.streamGeneration = nextGeneration;
        this.vocalProfile = nextProfile;
        this.setChunkSizeForEngine(this.engineType, data.browserChunkSize);

        if (profileChanged || generationChanged) {
          this.isAiReady = false;
          this.readyThreshold = this.engineType === "go_native"
            ? GO_READY_QUEUE_THRESHOLD : READY_QUEUE_THRESHOLD;
          this.maxQueueThreshold = this.engineType === "go_native"
            ? GO_MAX_QUEUE_THRESHOLD : MAX_QUEUE_THRESHOLD;
          this.releaseCurrentChunk();
          this.clearOutputQueue();
          this.currChunkL = null;
          this.currChunkR = null;
          this.currChunkIndex = null;
          this.currChunkPos = 0;
          this.concealGain = 1.0;
          this.playbackChunkIndex = null;
          this.playbackSamples = 0;
          this.latestInputChunkIndex = null;
          this.chunkPeak = 0.0;
          this.silentChunks = 0;
          this.inSilenceBoundary = false;
          this.missingInputBlocks = 0;
          this.inAccumPos = 0;
          this.chunkSeq = 0;
          if (this.targetMode !== "bypass") this.aiGain = 0.0;
        }
      } else if (data.type === "RESYNC") {
        // The browser-side inference queue dropped old work. Flush every
        // processed buffer so the next result starts at the newest live chunk
        // instead of replaying audio from before the scheduling interruption.
        const nextChunkIndex = Number.isInteger(data.nextChunkIndex)
          ? data.nextChunkIndex : null;
        if (Number.isInteger(data.generation)) {
          this.streamGeneration = data.generation;
        }
        this.diagnostics.resyncs++;
        this.isAiReady = false;
        // Preserve the configured/adaptive cushion across a resync. Dropping
        // to one chunk here makes a brief interruption recover too eagerly,
        // then immediately underrun again when the OS/GPU is still busy.
        this.releaseCurrentChunk();
        this.clearOutputQueue();
        this.currChunkL = null;
        this.currChunkR = null;
        this.currChunkIndex = null;
        this.currChunkPos = 0;
        this.concealGain = 0.0;
        this.playbackChunkIndex = nextChunkIndex;
        this.playbackSamples = 0;
        this.inAccumPos = 0;
        this.chunkPeak = 0.0;
        this.silentChunks = 0;
        this.inSilenceBoundary = false;
      } else if (data.type === "SET_QUEUE_TARGET") {
        if (data.engineType !== "go_native" || this.engineType !== "go_native") return;
        const ready = Number(data.readyThreshold);
        const max = Number(data.maxQueueThreshold);
        if (!Number.isFinite(ready) || !Number.isFinite(max)) return;
        this.readyThreshold = Math.max(
          1,
          Math.min(GO_MAX_QUEUE_THRESHOLD, Math.floor(ready))
        );
        this.maxQueueThreshold = Math.max(
          this.readyThreshold + 1,
          Math.min(GO_MAX_QUEUE_THRESHOLD + 1, Math.floor(max))
        );
      } else if (data.type === "SET_DIAGNOSTICS") {
        this.diagnosticsEnabled = data.enabled === true;
      } else if (data.type === "RETURN_INPUT_BUFFERS") {
        const rawL = data.rawL;
        const rawR = data.rawR;
        const size = rawL instanceof Float32Array ? rawL.length : 0;
        const pool = this.inputBufferPools[size];
        if (!pool || !(rawR instanceof Float32Array) || rawR.length !== size ||
            rawL.byteOffset !== 0 || rawR.byteOffset !== 0 ||
            rawL.byteLength !== rawL.buffer.byteLength ||
            rawR.byteLength !== rawR.buffer.byteLength ||
            pool.rawL.length >= TRANSFER_BUFFER_POOL_CAPACITY) return;
        pool.rawL.push(rawL);
        pool.rawR.push(rawR);
      } else if (data.type === "CHUNK_PROCESSED") {
        this.handleProcessedChunk(data);
      }
    };
  }

  setChunkSizeForEngine(engineType, browserChunkSize = BROWSER_CHUNK_SIZE) {
    const requestedSize = Number(browserChunkSize);
    const browserSize = requestedSize === GO_CHUNK_SIZE ? GO_CHUNK_SIZE : BROWSER_CHUNK_SIZE;
    const nextSize = engineType === "go_native" ? GO_CHUNK_SIZE : browserSize;
    if (this.chunkSize === nextSize) return;
    this.chunkSize = nextSize;
    // A partial packet belongs to the previous cadence. Drop it so a mode
    // switch cannot produce a mixed-size packet.
    this.inAccumPos = 0;
    this.chunkPeak = 0.0;
  }

  clearOutputQueue() {
    for (let i = 0; i < OUTPUT_QUEUE_CAPACITY; i++) {
      if (this.outQueueL[i]) this.returnOutputBuffers(this.outQueueL[i], this.outQueueR[i]);
      this.outQueueL[i] = null;
      this.outQueueR[i] = null;
      this.outQueueIndex[i] = null;
    }
    this.outQueueHead = 0;
    this.outQueueSize = 0;
  }

  dropOldestOutputChunk() {
    if (this.outQueueSize <= 0) return;
    this.returnOutputBuffers(this.outQueueL[this.outQueueHead], this.outQueueR[this.outQueueHead]);
    this.outQueueL[this.outQueueHead] = null;
    this.outQueueR[this.outQueueHead] = null;
    this.outQueueIndex[this.outQueueHead] = null;
    this.outQueueHead = (this.outQueueHead + 1) % OUTPUT_QUEUE_CAPACITY;
    this.outQueueSize--;
  }

  hasQueuedChunkIndex(chunkIndex) {
    for (let i = 0; i < this.outQueueSize; i++) {
      const slot = (this.outQueueHead + i) % OUTPUT_QUEUE_CAPACITY;
      if (this.outQueueIndex[slot] === chunkIndex) return true;
    }
    return false;
  }

  enqueueOutputChunk(outL, outR, chunkIndex) {
    // The configured threshold is below this capacity. Keep this guard so a
    // future target change still drops the oldest result rather than growing
    // the queue or replaying stale audio.
    if (this.outQueueSize >= OUTPUT_QUEUE_CAPACITY) {
      this.dropOldestOutputChunk();
    }
    const slot = (this.outQueueHead + this.outQueueSize) % OUTPUT_QUEUE_CAPACITY;
    this.outQueueL[slot] = outL;
    this.outQueueR[slot] = outR;
    this.outQueueIndex[slot] = chunkIndex;
    this.outQueueSize++;
    while (this.outQueueSize > this.maxQueueThreshold) {
      this.dropOldestOutputChunk();
    }
  }

  releaseCurrentChunk() {
    if (!this.currChunkL || !this.currChunkR) return;
    this.returnOutputBuffers(this.currChunkL, this.currChunkR);
    this.currChunkL = null;
    this.currChunkR = null;
    this.currChunkIndex = null;
    this.currChunkPos = 0;
  }

  returnOutputBuffers(outL, outR) {
    // GO returns two views into one WebSocket packet; that packet cannot be
    // pooled by the manager. Only return Web output buffers that own their
    // complete, separate ArrayBuffers.
    if (!(outL instanceof Float32Array) || !(outR instanceof Float32Array) ||
        outL.byteOffset !== 0 || outR.byteOffset !== 0 ||
        outL.byteLength !== outL.buffer.byteLength ||
        outR.byteLength !== outR.buffer.byteLength ||
        outL.buffer === outR.buffer) return;
    const message = this.outputReturnMessages[this.outputReturnMessagePos];
    this.outputReturnMessagePos = (this.outputReturnMessagePos + 1) % MESSAGE_POOL_CAPACITY;
    message.outL = outL;
    message.outR = outR;
    this.port.postMessage(message, [outL.buffer, outR.buffer]);
  }

  handleProcessedChunk(data) {
    if (!data || !data.outL || !data.outR) return;
    if (this.targetMode === "bypass") {
      this.returnOutputBuffers(data.outL, data.outR);
      return;
    }

    if (Number.isInteger(data.generation) && data.generation !== this.streamGeneration) {
      this.diagnostics.staleDrops++;
      this.returnOutputBuffers(data.outL, data.outR);
      return;
    }

    const chunkIndex = Number.isInteger(data.chunkIndex) ? data.chunkIndex : null;
    // Do not allow a browser result that is already far behind live audio to
    // enter the playback queue. Playing it would create a delayed vocal/music
    // jump after a tab switch or a CPU-heavy page update.
    if (this.engineType !== "go_native" &&
        chunkIndex !== null &&
        this.latestInputChunkIndex !== null &&
        chunkIndex < this.latestInputChunkIndex - BROWSER_MAX_LAG_CHUNKS) {
      this.diagnostics.staleDrops++;
      this.returnOutputBuffers(data.outL, data.outR);
      return;
    }

    // If the same response is delivered twice, do not replay it after the
    // current chunk. This is cheap because the queue is intentionally small.
    if (chunkIndex !== null && this.playbackChunkIndex !== null && chunkIndex < this.playbackChunkIndex) {
      this.diagnostics.staleDrops++;
      this.returnOutputBuffers(data.outL, data.outR);
      return;
    }
    if (chunkIndex !== null &&
        (chunkIndex === this.currChunkIndex || this.hasQueuedChunkIndex(chunkIndex))) {
      this.diagnostics.duplicateDrops++;
      this.returnOutputBuffers(data.outL, data.outR);
      return;
    }

    this.enqueueOutputChunk(
      data.outL instanceof Float32Array ? data.outL : new Float32Array(data.outL),
      data.outR instanceof Float32Array ? data.outR : new Float32Array(data.outR),
      chunkIndex
    );
  }

  resetForStreamBoundary(nextChunkIndex) {
    this.inAccumPos = 0;
    this.chunkPeak = 0.0;
    this.isAiReady = false;
    this.readyThreshold = this.engineType === "go_native"
      ? GO_READY_QUEUE_THRESHOLD : READY_QUEUE_THRESHOLD;
    this.releaseCurrentChunk();
    this.clearOutputQueue();
    this.concealGain = 1.0;
    this.aiGain = 0.0;
    this.playbackChunkIndex = null;
    this.playbackSamples = 0;
    this.latestInputChunkIndex = null;
    this.streamGeneration++;
    // Keep chunkSeq monotonic so late responses from the previous song can
    // be rejected without colliding with the new song's chunk indexes.
    this.port.postMessage({
      type: "STREAM_RESET",
      nextChunkIndex,
      generation: this.streamGeneration,
      reason: "sustained-silence"
    });
    this.diagnostics.streamResets++;
  }

  observeChunkBoundary(chunkPeak, chunkIndex) {
    if (chunkPeak <= BOUNDARY_SILENCE_PEAK) {
      this.silentChunks++;
      if (!this.inSilenceBoundary && this.silentChunks >= SILENCE_RESET_CHUNKS) {
        this.inSilenceBoundary = true;
        this.resetForStreamBoundary(chunkIndex + 1);
      }
    } else {
      this.silentChunks = 0;
      this.inSilenceBoundary = false;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) {
      this.missingInputBlocks++;
      if (this.targetMode !== "bypass" &&
          !this.inSilenceBoundary &&
          this.missingInputBlocks >= MISSING_INPUT_RESET_BLOCKS) {
        this.inSilenceBoundary = true;
        this.resetForStreamBoundary(this.chunkSeq);
      }
      if (output && output[0]) {
        output[0].fill(0);
        if (output[1]) output[1].fill(0);
      }
      return true;
    }

    this.missingInputBlocks = 0;

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const len = inL.length; // 128 samples

    // Exact bypass fast path. Once the fade has completed, copying the input
    // is all that is needed; avoid the per-sample gain/queue loop while AI is
    // off. This does not alter samples or timing.
    if (this.targetMode === "bypass" && this.liveGain === 1.0 && this.aiGain === 0.0) {
      this.inAccumPos = 0;
      outL.set(inL);
      if (outR !== outL) outR.set(inR);
      return true;
    }

    // 1. Accumulate input for AI whenever AI is requested
    if (this.targetMode !== "bypass") {
      for (let i = 0; i < len; i++) {
        const peakL = Math.abs(inL[i]);
        const peakR = Math.abs(inR[i]);
        if (peakL > this.chunkPeak) this.chunkPeak = peakL;
        if (peakR > this.chunkPeak) this.chunkPeak = peakR;
      }

      let offset = 0;
      while (offset < len) {
        const toCopy = Math.min(len - offset, this.chunkSize - this.inAccumPos);
        this.inAccumL.set(inL.subarray(offset, offset + toCopy), this.inAccumPos);
        this.inAccumR.set(inR.subarray(offset, offset + toCopy), this.inAccumPos);
        this.inAccumPos += toCopy;
        offset += toCopy;

        if (this.inAccumPos >= this.chunkSize) {
          const pool = this.inputBufferPools[this.chunkSize];
          let rawL;
          let rawR;
          if (pool && pool.rawL.length > 0 && pool.rawR.length > 0) {
            rawL = pool.rawL.pop();
            rawR = pool.rawR.pop();
          } else {
            rawL = new Float32Array(this.chunkSize);
            rawR = new Float32Array(this.chunkSize);
          }
          rawL.set(this.inAccumL.subarray(0, this.chunkSize));
          rawR.set(this.inAccumR.subarray(0, this.chunkSize));
          const chunkIndex = this.chunkSeq++;
          const chunkPeak = this.chunkPeak;
          this.chunkPeak = 0.0;
          const processMessage = this.processMessages[this.processMessagePos];
          this.processMessagePos = (this.processMessagePos + 1) % MESSAGE_POOL_CAPACITY;
          processMessage.chunkIndex = chunkIndex;
          processMessage.generation = this.streamGeneration;
          processMessage.rawL = rawL;
          processMessage.rawR = rawR;
          processMessage.mode = this.targetMode;
          const transfer = [rawL.buffer, rawR.buffer];
          this.latestInputChunkIndex = chunkIndex;
          this.diagnostics.chunksSent++;
          this.diagnostics.lastInputChunkIndex = chunkIndex;
          this.port.postMessage(processMessage, transfer);
          this.inAccumPos = 0;
          this.observeChunkBoundary(chunkPeak, chunkIndex);
        }
      }
    } else {
      this.inAccumPos = 0;
      this.chunkPeak = 0.0;
      this.silentChunks = 0;
      this.inSilenceBoundary = false;
    }

    // 2. Check if AI queue has reached threshold to start playing
    if (!this.isAiReady) {
      if (this.targetMode !== "bypass" && this.outQueueSize >= this.readyThreshold) {
        this.isAiReady = true;
      }
    }

    // Target gains:
    // If bypass: targetLive = 1.0, targetAi = 0.0
    // If AI & ready: targetLive = 0.0, targetAi = 1.0 (stable gain, no jitter flapping)
    // If AI & preparing: targetLive = 0.0, targetAi = 0.0 (MUTED SILENCE!)
    const targetLive = (this.targetMode === "bypass") ? 1.0 : 0.0;
    const targetAi = (this.targetMode !== "bypass" && this.isAiReady) ? 1.0 : 0.0;

    // Report quickly while priming/recovering, but keep the steady-state
    // MessagePort traffic near 2.7 Hz. The audio callback remains sample
    // accurate; only UI telemetry is less chatty once the queue is healthy.
    this.statusCount++;
    const statusInterval = this.isAiReady ? 128 : 32;
    if (this.statusCount >= statusInterval) {
      this.statusCount = 0;
      const totalBuffered = this.outQueueSize * this.chunkSize + (this.currChunkL ? this.currChunkL.length - this.currChunkPos : 0);
      const bufferedSec = (totalBuffered / WORKLET_SAMPLE_RATE).toFixed(1);
      const status = {
        type: "WORKLET_STATUS",
        mode: this.targetMode,
        generation: this.streamGeneration,
        isAiReady: this.isAiReady,
        readyThreshold: this.readyThreshold,
        aiGain: this.aiGain,
        bufferedSec: bufferedSec,
        queueLen: this.outQueueSize,
        chunkSize: this.chunkSize,
        sampleRate: WORKLET_SAMPLE_RATE,
        inputFrame: this.latestInputChunkIndex === null
          ? null : this.latestInputChunkIndex * (this.chunkSize / 512),
        playbackFrame: this.playbackChunkIndex === null
          ? null : this.playbackChunkIndex * (this.chunkSize / 512)
      };
      // Diagnostics are debug-only. Avoid cloning the full counters object on
      // every status message during normal playback; enabling the diagnostics
      // panel opts back into the detailed payload explicitly.
      if (this.diagnosticsEnabled) {
        status.diagnostics = { ...this.diagnostics };
      }
      this.port.postMessage(status);
    }

    // Stable processed playback is an exact copy operation. Avoid the
    // per-sample gain/concealment branch while a full native/browser chunk is
    // available; the slower loop below remains responsible for fades,
    // underruns and chunk-boundary transitions.
    if (this.isAiReady &&
        this.liveGain === 0.0 && this.aiGain === 1.0 && this.concealGain === 1.0 &&
        this.currChunkL && this.currChunkPos + len <= this.currChunkL.length) {
      const start = this.currChunkPos;
      this.currChunkPos += len;
      outL.set(this.currChunkL.subarray(start, this.currChunkPos));
      if (outR !== outL) {
        outR.set(this.currChunkR.subarray(start, this.currChunkPos));
      }
      this.playbackSamples += len;
      if (this.playbackSamples >= this.chunkSize) {
        this.playbackSamples = 0;
        if (this.playbackChunkIndex !== null) this.playbackChunkIndex++;
      }
      this.diagnostics.lastPlaybackChunkIndex = this.playbackChunkIndex;
      return true;
    }

    // 3. Playback with clean mute-and-fade
    for (let i = 0; i < len; i++) {
      // Ramp live gain
      if (this.liveGain < targetLive) {
        this.liveGain = Math.min(targetLive, this.liveGain + FADE_IN_SPEED);
      } else if (this.liveGain > targetLive) {
        this.liveGain = Math.max(targetLive, this.liveGain - FADE_OUT_SPEED);
      }

      // Ramp AI gain
      if (this.aiGain < targetAi) {
        this.aiGain = Math.min(targetAi, this.aiGain + FADE_IN_SPEED);
      } else if (this.aiGain > targetAi) {
        this.aiGain = Math.max(targetAi, this.aiGain - FADE_OUT_SPEED);
      }

      let aiSampleL = 0;
      let aiSampleR = 0;

      // Consume from AI queue only if AI is ready / playing
      if (this.isAiReady) {
        if (!this.currChunkL || this.currChunkPos >= this.currChunkL.length) {
          this.releaseCurrentChunk();
          // Discard responses that refer to audio already covered by the
          // playback cursor. This prevents a delayed response from replaying
          // old audio after a tab-switch scheduling hiccup.
          while (this.outQueueSize > 0 &&
                 this.playbackChunkIndex !== null &&
                 this.outQueueIndex[this.outQueueHead] !== null &&
                 this.outQueueIndex[this.outQueueHead] < this.playbackChunkIndex) {
            this.dropOldestOutputChunk();
          }

          if (this.outQueueSize > 0) {
            const slot = this.outQueueHead;
            this.currChunkL = this.outQueueL[slot];
            this.currChunkR = this.outQueueR[slot];
            this.currChunkIndex = this.outQueueIndex[slot];
            this.outQueueL[slot] = null;
            this.outQueueR[slot] = null;
            this.outQueueIndex[slot] = null;
            this.outQueueHead = (this.outQueueHead + 1) % OUTPUT_QUEUE_CAPACITY;
            this.outQueueSize--;
            this.currChunkPos = 0;
            if (this.playbackChunkIndex === null && this.currChunkIndex !== null) {
              this.playbackChunkIndex = this.currChunkIndex;
            } else if (this.currChunkIndex !== null &&
                       this.playbackChunkIndex !== null &&
                       this.currChunkIndex > this.playbackChunkIndex) {
              // A resync may intentionally skip chunks. Move the cursor to
              // the first fresh result rather than assigning it an old time.
              this.playbackChunkIndex = this.currChunkIndex;
              this.playbackSamples = 0;
            }
          } else {
            this.currChunkL = null;
            this.currChunkR = null;
            this.currChunkIndex = null;
            // Recover as soon as the next processed chunk arrives. Keep the
            // configured/adaptive startup threshold intact so one transient
            // underrun cannot permanently force the stream into a one-chunk
            // jitter buffer and make the next CPU/GPU spike flap again.
          }
        }

        let concealTarget = 1.0;
        if (this.currChunkL) {
          aiSampleL = this.currChunkL[this.currChunkPos];
          aiSampleR = this.currChunkR[this.currChunkPos];
          this.currChunkPos++;
        } else {
            // Never expose raw input during an AI underrun: karaoke raw input
            // contains vocals. A short click-free mute is preferable to vocal
            // leakage and avoids replaying stale audio while the model catches up.
            concealTarget = 0.0;
            aiSampleL = 0.0;
            aiSampleR = 0.0;
            this.diagnostics.underrunBlocks++;
          }

        if (this.concealGain < concealTarget) {
          this.concealGain = Math.min(concealTarget, this.concealGain + CONCEAL_FADE_IN_SPEED);
        } else if (this.concealGain > concealTarget) {
          this.concealGain = Math.max(concealTarget, this.concealGain - CONCEAL_FADE_OUT_SPEED);
        }

        this.playbackSamples++;
        if (this.playbackSamples >= this.chunkSize) {
          this.playbackSamples = 0;
          if (this.playbackChunkIndex !== null) this.playbackChunkIndex++;
        }
        this.diagnostics.lastPlaybackChunkIndex = this.playbackChunkIndex;
      }

      outL[i] = this.liveGain * inL[i] + this.aiGain * this.concealGain * aiSampleL;
      outR[i] = this.liveGain * inR[i] + this.aiGain * this.concealGain * aiSampleR;
    }

    // Cleanup queue once completely switched back to bypass
    if (this.targetMode === "bypass" && this.aiGain <= 0.0 &&
        (this.currChunkL || this.outQueueSize > 0)) {
      this.releaseCurrentChunk();
      this.clearOutputQueue();
      this.playbackChunkIndex = null;
      this.playbackSamples = 0;
    }

    return true;
  }
}

registerProcessor("nextamp-ai-vocal-processor", AIVocalWorkletProcessor);
