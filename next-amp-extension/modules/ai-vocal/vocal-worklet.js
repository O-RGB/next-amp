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
const BROWSER_CHUNK_SIZE = 7680; // 15 hops * 512 (~174.1ms), ai remove cadence
const MAX_CHUNK_SIZE = GO_CHUNK_SIZE;
const FADE_OUT_SPEED = 1.0 / 256;  // ~5.8ms fast, click-free mute
const FADE_IN_SPEED = 1.0 / 1024;  // ~23ms smooth fade-in
const READY_QUEUE_THRESHOLD = 2;   // 2 browser chunks (~348ms) cushion against latency spikes
const MAX_QUEUE_THRESHOLD = 5;     // 5 browser chunks (~871ms) latency ceiling prevents delay accumulation
const GO_READY_QUEUE_THRESHOLD = 5; // Native GO gets a deeper cushion for OS scheduling spikes
const GO_MAX_QUEUE_THRESHOLD = 8;   // ~1.48s ceiling before stale native output is discarded
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

    // Output playback queue
    this.outQueueL = [];
    this.outQueueR = [];
    this.outQueueIndex = [];
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

    this.chunkSeq = 0;
    this.statusCount = 0;
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
        if (data.engineType === "go_native" || data.engineType === "webgl") {
          this.engineType = data.engineType;
          this.setChunkSizeForEngine(this.engineType);
        }
        if (this.targetMode !== data.mode) {
          this.diagnostics.modeTransitions++;
          this.targetMode = data.mode;
          // Purge all audio queues and state on ANY mode transition
          this.isAiReady = false;
          this.readyThreshold = this.engineType === "go_native"
            ? GO_READY_QUEUE_THRESHOLD : READY_QUEUE_THRESHOLD;
          this.maxQueueThreshold = this.engineType === "go_native"
            ? GO_MAX_QUEUE_THRESHOLD : MAX_QUEUE_THRESHOLD;
          this.outQueueL = [];
          this.outQueueR = [];
          this.outQueueIndex = [];
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
        if (this.engineType !== nextEngine) {
          this.engineType = nextEngine;
          this.setChunkSizeForEngine(this.engineType);
          this.isAiReady = false;
          this.outQueueL = [];
          this.outQueueR = [];
          this.outQueueIndex = [];
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
      } else if (data.type === "RESYNC") {
        // The browser-side inference queue dropped old work. Flush every
        // processed buffer so the next result starts at the newest live chunk
        // instead of replaying audio from before the scheduling interruption.
        const nextChunkIndex = Number.isInteger(data.nextChunkIndex)
          ? data.nextChunkIndex : null;
        this.diagnostics.resyncs++;
        this.isAiReady = false;
        this.readyThreshold = 1;
        this.outQueueL = [];
        this.outQueueR = [];
        this.outQueueIndex = [];
        this.currChunkL = null;
        this.currChunkR = null;
        this.currChunkIndex = null;
        this.currChunkPos = 0;
        this.concealGain = 0.0;
        this.playbackChunkIndex = nextChunkIndex;
        this.playbackSamples = 0;
      } else if (data.type === "CHUNK_PROCESSED") {
        this.handleProcessedChunk(data);
      }
    };
  }

  setChunkSizeForEngine(engineType) {
    const nextSize = engineType === "go_native" ? GO_CHUNK_SIZE : BROWSER_CHUNK_SIZE;
    if (this.chunkSize === nextSize) return;
    this.chunkSize = nextSize;
    // A partial packet belongs to the previous cadence. Drop it so a mode
    // switch cannot produce a mixed-size packet.
    this.inAccumPos = 0;
    this.chunkPeak = 0.0;
  }

  handleProcessedChunk(data) {
    if (this.targetMode === "bypass" || !data || !data.outL || !data.outR) return;

    const chunkIndex = Number.isInteger(data.chunkIndex) ? data.chunkIndex : null;
    // Do not allow a browser result that is already far behind live audio to
    // enter the playback queue. Playing it would create a delayed vocal/music
    // jump after a tab switch or a CPU-heavy page update.
    if (this.engineType !== "go_native" &&
        chunkIndex !== null &&
        this.latestInputChunkIndex !== null &&
        chunkIndex < this.latestInputChunkIndex - BROWSER_MAX_LAG_CHUNKS) {
      this.diagnostics.staleDrops++;
      return;
    }

    // If the same response is delivered twice, do not replay it after the
    // current chunk. This is cheap because the queue is intentionally small.
    if (chunkIndex !== null && this.playbackChunkIndex !== null && chunkIndex < this.playbackChunkIndex) {
      this.diagnostics.staleDrops++;
      return;
    }
    if (chunkIndex !== null &&
        (chunkIndex === this.currChunkIndex || this.outQueueIndex.includes(chunkIndex))) {
      this.diagnostics.duplicateDrops++;
      return;
    }

    this.outQueueL.push(data.outL instanceof Float32Array ? data.outL : new Float32Array(data.outL));
    this.outQueueR.push(data.outR instanceof Float32Array ? data.outR : new Float32Array(data.outR));
    this.outQueueIndex.push(chunkIndex);
    while (this.outQueueL.length > this.maxQueueThreshold) {
      this.outQueueL.shift();
      this.outQueueR.shift();
      this.outQueueIndex.shift();
    }
  }

  resetForStreamBoundary(nextChunkIndex) {
    this.inAccumPos = 0;
    this.chunkPeak = 0.0;
    this.isAiReady = false;
    this.readyThreshold = this.engineType === "go_native"
      ? GO_READY_QUEUE_THRESHOLD : READY_QUEUE_THRESHOLD;
    this.outQueueL = [];
    this.outQueueR = [];
    this.outQueueIndex = [];
    this.currChunkL = null;
    this.currChunkR = null;
    this.currChunkIndex = null;
    this.currChunkPos = 0;
    this.concealGain = 1.0;
    this.aiGain = 0.0;
    this.playbackChunkIndex = null;
    this.playbackSamples = 0;
    this.latestInputChunkIndex = null;
    // Keep chunkSeq monotonic so late responses from the previous song can
    // be rejected without colliding with the new song's chunk indexes.
        this.port.postMessage({
          type: "STREAM_RESET",
          nextChunkIndex,
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
          const rawL = new Float32Array(this.inAccumL.subarray(0, this.chunkSize));
          const rawR = new Float32Array(this.inAccumR.subarray(0, this.chunkSize));
          const chunkIndex = this.chunkSeq++;
          const chunkPeak = this.chunkPeak;
          this.chunkPeak = 0.0;
          const processMessage = {
            type: "PROCESS_CHUNK",
            chunkIndex,
            rawL: rawL,
            rawR: rawR,
            mode: this.targetMode
          };
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
      if (this.targetMode !== "bypass" && this.outQueueL.length >= this.readyThreshold) {
        this.isAiReady = true;
      }
    }

    // Target gains:
    // If bypass: targetLive = 1.0, targetAi = 0.0
    // If AI & ready: targetLive = 0.0, targetAi = 1.0 (stable gain, no jitter flapping)
    // If AI & preparing: targetLive = 0.0, targetAi = 0.0 (MUTED SILENCE!)
    const targetLive = (this.targetMode === "bypass") ? 1.0 : 0.0;
    const targetAi = (this.targetMode !== "bypass" && this.isAiReady) ? 1.0 : 0.0;

    // Report status telemetry to manager every ~100ms
    this.statusCount++;
    if (this.statusCount >= 32) {
      this.statusCount = 0;
      const totalBuffered = this.outQueueL.length * this.chunkSize + (this.currChunkL ? this.currChunkL.length - this.currChunkPos : 0);
      const bufferedSec = (totalBuffered / WORKLET_SAMPLE_RATE).toFixed(1);
      this.port.postMessage({
        type: "WORKLET_STATUS",
        mode: this.targetMode,
        isAiReady: this.isAiReady,
        readyThreshold: this.readyThreshold,
        aiGain: this.aiGain,
        bufferedSec: bufferedSec,
        queueLen: this.outQueueL.length,
        chunkSize: this.chunkSize,
        sampleRate: WORKLET_SAMPLE_RATE,
        inputFrame: this.latestInputChunkIndex === null
          ? null : this.latestInputChunkIndex * (this.chunkSize / 512),
        playbackFrame: this.playbackChunkIndex === null
          ? null : this.playbackChunkIndex * (this.chunkSize / 512),
        diagnostics: { ...this.diagnostics }
      });
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
          // Discard responses that refer to audio already covered by the
          // playback cursor. This prevents a delayed response from replaying
          // old audio after a tab-switch scheduling hiccup.
          while (this.outQueueL.length > 0 &&
                 this.playbackChunkIndex !== null &&
                 this.outQueueIndex[0] !== null &&
                 this.outQueueIndex[0] < this.playbackChunkIndex) {
            this.outQueueL.shift();
            this.outQueueR.shift();
            this.outQueueIndex.shift();
          }

          if (this.outQueueL.length > 0) {
            this.currChunkL = this.outQueueL.shift();
            this.currChunkR = this.outQueueR.shift();
            this.currChunkIndex = this.outQueueIndex.shift();
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
            // Recover as soon as the next processed chunk arrives. During an
            // underrun conceal with silence; raw input contains vocals.
            this.readyThreshold = 1;
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
    if (this.targetMode === "bypass" && this.aiGain <= 0.0 && this.outQueueL.length > 0) {
      this.outQueueL = [];
      this.outQueueR = [];
      this.outQueueIndex = [];
      this.currChunkL = null;
      this.currChunkR = null;
      this.currChunkIndex = null;
      this.currChunkPos = 0;
      this.playbackChunkIndex = null;
      this.playbackSamples = 0;
    }

    return true;
  }
}

registerProcessor("nextamp-ai-vocal-processor", AIVocalWorkletProcessor);
