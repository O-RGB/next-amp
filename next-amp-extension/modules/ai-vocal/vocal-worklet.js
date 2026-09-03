/**
 * NextAmp AI Vocal Separator - Real-time AudioWorkletProcessor
 * Handles real-time sample buffering, seamless bypass, and jitter-free streaming.
 */

const CHUNK_SIZE = 8192; // 16 frames * 512 hop (64 Web Audio blocks)
const FADE_LEN = 1024;    // ~23ms smooth crossfade

class AIVocalWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.mode = "bypass"; // "bypass", "karaoke", "acapella"
    this.targetMode = "bypass";

    // Input accumulator
    this.inAccumL = new Float32Array(CHUNK_SIZE);
    this.inAccumR = new Float32Array(CHUNK_SIZE);
    this.inAccumPos = 0;

    // Output playback queue (array of Float32Array chunks)
    this.outQueueL = [];
    this.outQueueR = [];
    this.currChunkL = null;
    this.currChunkR = null;
    this.currChunkPos = 0;

    // Crossfade engine (0.0 = fully original, 1.0 = fully AI)
    this.fadeVal = 0.0;
    this.fadeSpeed = 1.0 / FADE_LEN;

    this.chunkSeq = 0;
    this.isWorkerReady = false;

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data.type === "SET_MODE") {
        if (this.targetMode !== data.mode) {
          this.targetMode = data.mode;
          if (data.mode !== "bypass") {
            // Clear old mode output chunks so no old audio bleeds
            this.outQueueL = [];
            this.outQueueR = [];
            this.currChunkL = null;
            this.currChunkR = null;
            this.currChunkPos = 0;
          }
        }
      } else if (data.type === "CHUNK_PROCESSED") {
        this.outQueueL.push(new Float32Array(data.outL));
        this.outQueueR.push(new Float32Array(data.outR));
      } else if (data.type === "WORKER_READY") {
        this.isWorkerReady = true;
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

    // 1. Accumulate input for AI worker whenever AI is requested
    if (this.targetMode !== "bypass") {
      let offset = 0;
      while (offset < len) {
        const toCopy = Math.min(len - offset, CHUNK_SIZE - this.inAccumPos);
        this.inAccumL.set(inL.subarray(offset, offset + toCopy), this.inAccumPos);
        this.inAccumR.set(inR.subarray(offset, offset + toCopy), this.inAccumPos);
        this.inAccumPos += toCopy;
        offset += toCopy;

        if (this.inAccumPos >= CHUNK_SIZE) {
          // Send 7,680 sample chunk to offscreen -> worker
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

    // 2. Determine target crossfade state
    // AI audio is considered ready if we have >= 1 chunk buffered in queue
    const hasAiAudio = (this.currChunkL !== null) || (this.outQueueL.length >= 1);
    const targetFade = (this.targetMode !== "bypass" && hasAiAudio) ? 1.0 : 0.0;

    // 3. Playback with smooth crossfading
    for (let i = 0; i < len; i++) {
      // Smooth fade transition
      if (this.fadeVal < targetFade) {
        this.fadeVal = Math.min(targetFade, this.fadeVal + this.fadeSpeed);
      } else if (this.fadeVal > targetFade) {
        this.fadeVal = Math.max(targetFade, this.fadeVal - this.fadeSpeed);
      }

      let aiSampleL = inL[i];
      let aiSampleR = inR[i];

      if (this.fadeVal > 0.0) {
        // Fetch sample from AI output buffer
        if (!this.currChunkL || this.currChunkPos >= this.currChunkL.length) {
          if (this.outQueueL.length > 0) {
            this.currChunkL = this.outQueueL.shift();
            this.currChunkR = this.outQueueR.shift();
            this.currChunkPos = 0;
          } else {
            this.currChunkL = null;
            this.currChunkR = null;
          }
        }

        if (this.currChunkL) {
          aiSampleL = this.currChunkL[this.currChunkPos];
          aiSampleR = this.currChunkR[this.currChunkPos];
          this.currChunkPos++;
        }
      }

      // Equal-power crossfade (or linear when close)
      const origGain = 1.0 - this.fadeVal;
      const aiGain = this.fadeVal;

      outL[i] = origGain * inL[i] + aiGain * aiSampleL;
      outR[i] = origGain * inR[i] + aiGain * aiSampleR;
    }

    return true;
  }
}

registerProcessor("nextamp-ai-vocal-processor", AIVocalWorkletProcessor);
