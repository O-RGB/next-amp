/**
 * NextAmp AI Vocal Manager
 * Coordinates the AudioWorklet and the WebGL Web Worker.
 */

export class AIVocalManager {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.workletNode = null;
    this.worker = null;
    this.isReady = false;
    this.currentMode = "bypass";
    this.currentStatus = "ORIGINAL";
    this.onStatusChange = null;
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

  async init() {
    try {
      // 1. Add AudioWorklet module
      const workletUrl = chrome.runtime.getURL("modules/ai-vocal/vocal-worklet.js");
      await this.audioCtx.audioWorklet.addModule(workletUrl);

      // 2. Create AudioWorkletNode
      this.workletNode = new AudioWorkletNode(this.audioCtx, "nextamp-ai-vocal-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      // 3. Spawn Web Worker for WebGL inference
      const workerUrl = chrome.runtime.getURL("modules/ai-vocal/vocal-worker.js");
      this.worker = new Worker(workerUrl);

      this.worker.onerror = (err) => {
        console.error("[NextAmp AI] Worker uncaught exception:", err);
        this.setStatus("ERR: Worker");
      };

      // 4. Wire worklet -> worker and worker -> worklet
      this.workletNode.port.onmessage = (e) => {
        const data = e.data;
        if (data.type === "PROCESS_CHUNK") {
          if (this.isReady && this.worker) {
            this.worker.postMessage(
              {
                type: "PROCESS_CHUNK",
                chunkIndex: data.chunkIndex,
                rawL: data.rawL,
                rawR: data.rawR,
                mode: data.mode
              },
              [data.rawL.buffer, data.rawR.buffer]
            );
          }
        } else if (data.type === "WORKLET_STATUS") {
          if (data.mode === "bypass") {
            this.setStatus("ORIGINAL");
          } else if (data.fadeVal < 0.85) {
            this.setStatus(`Preparing AI: ${data.bufferedSec}s / 0.8s`);
          } else {
            this.setStatus(data.mode === "karaoke" ? "KARAOKE (CUT)" : "ACAPELLA (ISO)");
          }
        }
      };

      this.worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === "READY") {
          console.log("[NextAmp AI] Web Worker Ready with backend:", data.backend);
          this.isReady = true;
          this.workletNode.port.postMessage({ type: "WORKER_READY" });
          if (this.currentMode === "bypass") this.setStatus("ORIGINAL");
        } else if (data.type === "CHUNK_PROCESSED") {
          this.workletNode.port.postMessage(
            {
              type: "CHUNK_PROCESSED",
              outL: data.outL,
              outR: data.outR
            },
            [data.outL.buffer, data.outR.buffer]
          );
        } else if (data.type === "STATUS") {
          if (this.currentMode !== "bypass") {
            this.setStatus(data.status);
          }
        } else if (data.type === "ERROR") {
          console.error("[NextAmp AI] Worker reported error:", data.error);
          this.setStatus("ERR: " + (data.error || "Unknown"));
        }
      };

      // Start initialization in worker with absolute URLs
      this.worker.postMessage({
        type: "INIT",
        wasmUrl: chrome.runtime.getURL("modules/ai-vocal/stft_simd.wasm"),
        modelUrl: chrome.runtime.getURL("model/model.json")
      });

      return this.workletNode;
    } catch (err) {
      console.error("[NextAmp AI] Initialization failed:", err);
      this.setStatus("ERR: Init");
      return null;
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    if (this.worker && mode !== "bypass") {
      this.worker.postMessage({ type: "RESET" });
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
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch (_) {}
      this.workletNode = null;
    }
  }
}
