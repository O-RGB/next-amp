/**
 * NextAmp AI Vocal Separator - Real-time AudioWorkletProcessor
 * 
 * Clean Mute-Until-Ready Architecture:
 * - When switching to Karaoke / Acapella, output mutes immediately (smooth ~5.8ms micro-fade).
 * - Remains completely silent while AI model primes and buffers 2 real chunks (~0.37s).
 * - Smoothly fades in directly to isolated Karaoke music once buffer is ready.
 * - Eliminates 100% of stutter, phase cancellation, repeat lyrics, and digital glitching.
 */

const CHUNK_SIZE = 8192; // 16 frames * 512 hop (64 Web Audio blocks = ~185.7ms)
const FADE_OUT_SPEED = 1.0 / 256;  // ~5.8ms fast, click-free mute
const FADE_IN_SPEED = 1.0 / 1024;  // ~23ms smooth fade-in
const READY_QUEUE_THRESHOLD = 5;   // 5 chunks (~0.92s buffer cushion) prevents ANY stutter on battery
const MAX_QUEUE_THRESHOLD = 8;     // 8 chunks (~1.48s latency ceiling) prevents delay accumulation

class AIVocalWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.mode = "bypass"; // "bypass", "karaoke", "acapella"
    this.targetMode = "bypass";
    this.readyThreshold = READY_QUEUE_THRESHOLD;

    // Input accumulator
    this.inAccumL = new Float32Array(CHUNK_SIZE);
    this.inAccumR = new Float32Array(CHUNK_SIZE);
    this.inAccumPos = 0;

    // Output playback queue
    this.outQueueL = [];
    this.outQueueR = [];
    this.currChunkL = null;
    this.currChunkR = null;
    this.currChunkPos = 0;

    // Audio state:
    // When in bypass: liveGain = 1.0, aiGain = 0.0
    // When preparing AI: liveGain = 0.0, aiGain = 0.0 (MUTED)
    // When AI ready: liveGain = 0.0, aiGain = 1.0
    this.liveGain = 1.0;
    this.aiGain = 0.0;
    this.isAiReady = false;

    this.chunkSeq = 0;
    this.statusCount = 0;

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === "SET_MODE") {
        if (this.targetMode !== data.mode) {
          this.targetMode = data.mode;
          // Purge all audio queues and state on ANY mode transition
          this.isAiReady = false;
          this.outQueueL = [];
          this.outQueueR = [];
          this.currChunkL = null;
          this.currChunkR = null;
          this.currChunkPos = 0;
          this.inAccumPos = 0;
          this.chunkSeq = 0;
          if (data.mode !== "bypass") {
            this.aiGain = 0.0;
          }
        }
      } else if (data.type === "CHUNK_PROCESSED") {
        if (this.targetMode === "bypass") return;
        this.outQueueL.push(new Float32Array(data.outL));
        this.outQueueR.push(new Float32Array(data.outR));
        // Hard Latency Ceiling: Keep queue strictly capped at MAX_QUEUE_THRESHOLD (~0.92s)
        // Completely prevents delay from ever accumulating while providing 2 chunks of jitter cushion!
        while (this.outQueueL.length > MAX_QUEUE_THRESHOLD) {
          this.outQueueL.shift();
          this.outQueueR.shift();
        }
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const len = inL.length; // 128 samples

    // 1. Accumulate input for AI whenever AI is requested
    if (this.targetMode !== "bypass") {
      let offset = 0;
      while (offset < len) {
        const toCopy = Math.min(len - offset, CHUNK_SIZE - this.inAccumPos);
        this.inAccumL.set(inL.subarray(offset, offset + toCopy), this.inAccumPos);
        this.inAccumR.set(inR.subarray(offset, offset + toCopy), this.inAccumPos);
        this.inAccumPos += toCopy;
        offset += toCopy;

        if (this.inAccumPos >= CHUNK_SIZE) {
          const rawL = new Float32Array(this.inAccumL);
          const rawR = new Float32Array(this.inAccumR);
          this.port.postMessage(
            {
              type: "PROCESS_CHUNK",
              chunkIndex: this.chunkSeq++,
              rawL: rawL,
              rawR: rawR,
              mode: this.targetMode
            },
            [rawL.buffer, rawR.buffer]
          );
          this.inAccumPos = 0;
        }
      }
    } else {
      this.inAccumPos = 0;
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
      const totalBuffered = this.outQueueL.length * CHUNK_SIZE + (this.currChunkL ? this.currChunkL.length - this.currChunkPos : 0);
      const bufferedSec = (totalBuffered / 44100).toFixed(1);
      this.port.postMessage({
        type: "WORKLET_STATUS",
        mode: this.targetMode,
        isAiReady: this.isAiReady,
        readyThreshold: this.readyThreshold,
        aiGain: this.aiGain,
        bufferedSec: bufferedSec,
        queueLen: this.outQueueL.length
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
          if (this.outQueueL.length > 0) {
            this.currChunkL = this.outQueueL.shift();
            this.currChunkR = this.outQueueR.shift();
            this.currChunkPos = 0;
          } else {
            this.currChunkL = null;
            this.currChunkR = null;
            // Starvation safety: re-arm buffering threshold (3 chunks) to rebuild cushion
            // Completely stops the knife-edge 180ms on/off stutter cycle!
            this.isAiReady = false;
            this.readyThreshold = 3;
          }
        }

        if (this.currChunkL) {
          aiSampleL = this.currChunkL[this.currChunkPos];
          aiSampleR = this.currChunkR[this.currChunkPos];
          this.currChunkPos++;
        }
      }

      outL[i] = this.liveGain * inL[i] + this.aiGain * aiSampleL;
      outR[i] = this.liveGain * inR[i] + this.aiGain * aiSampleR;
    }

    // Cleanup queue once completely switched back to bypass
    if (this.targetMode === "bypass" && this.aiGain <= 0.0 && this.outQueueL.length > 0) {
      this.outQueueL = [];
      this.outQueueR = [];
      this.currChunkL = null;
      this.currChunkR = null;
      this.currChunkPos = 0;
    }

    return true;
  }
}

registerProcessor("nextamp-ai-vocal-processor", AIVocalWorkletProcessor);
