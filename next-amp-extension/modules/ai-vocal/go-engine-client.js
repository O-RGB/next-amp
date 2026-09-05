/**
 * NextAmp Go Native Engine Client
 * 
 * High-performance WebSocket bridge connecting Next-Amp Extension
 * to the standalone Go Native Desktop Engine (ws://127.0.0.1:41919/ws).
 */

export class GoEngineClient {
  constructor() {
    this.ws = null;
    this.url = "ws://127.0.0.1:41919/ws";
    this.isConnected = false;
    this.isConnecting = false;
    this.enabled = false;
    this.lastRtt = 0;
    this.deviceInfo = "Go Native Core";

    this.pendingChunks = new Map();
    this.reconnectTimer = null;

    this.onStatusChange = null;
    this.onChunkProcessed = null;

    // The AudioWorklet and Go DSP both use exactly 8,192 samples per packet.
    // Keeping the bridge buffer at that size makes the normal path genuinely
    // allocation-free; a mismatched capacity would copy/allocate every chunk.
    this.sendCapacity = 8192;
    this.sendBuffer = new ArrayBuffer(8 + (this.sendCapacity * 8));
    this.sendView = new DataView(this.sendBuffer);
    this.sendFloatL = new Float32Array(this.sendBuffer, 8, this.sendCapacity);
    this.sendFloatR = new Float32Array(this.sendBuffer, 8 + (this.sendCapacity * 4), this.sendCapacity);
  }

  enable() {
    this.enabled = true;
    if (!this.isConnected && !this.isConnecting) {
      this.connect();
    }
  }

  disable() {
    this.enabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.pendingChunks.clear();
  }

  connect() {
    if (!this.enabled || this.isConnecting || this.isConnected) return;
    this.isConnecting = true;

    if (this.onStatusChange) {
      this.onStatusChange("Connecting to Go Engine...");
    }

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        console.log("[NextAmp Go Engine] Connected to", this.url);
        if (this.onStatusChange) {
          this.onStatusChange("⚡ GO ENGINE (Connected)");
        }
      };

      this.ws.onmessage = (e) => {
        this.handleMessage(e);
      };

      this.ws.onerror = (err) => {
        // Suppress noisy error object in console
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;
        this.pendingChunks.clear();

        if (this.enabled) {
          if (this.onStatusChange) {
            this.onStatusChange(wasConnected ? "⚠️ GO ENGINE (Lost)" : "⚠️ GO ENGINE (Offline)");
          }
          // Schedule auto-reconnect
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect();
            }, 3000);
          }
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      if (this.enabled && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 3000);
      }
    }
  }

  handleMessage(e) {
    if (typeof e.data === "string") {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "READY") {
          this.deviceInfo = msg.device || "Go Native Core";
          console.log("[NextAmp Go Engine] Handshake READY:", msg);
          if (this.onStatusChange) {
            this.onStatusChange(`⚡ GO ENGINE (${this.deviceInfo})`);
          }
        }
      } catch (_) {}
      return;
    }

    if (e.data instanceof ArrayBuffer) {
      const buf = e.data;
      if (buf.byteLength < 8) return;

      const view = new DataView(buf);
      const chunkIndex = view.getUint32(0, true);

      const sendTime = this.pendingChunks.get(chunkIndex);
      if (sendTime) {
        this.lastRtt = Math.round((performance.now() - sendTime) * 10) / 10;
        this.pendingChunks.delete(chunkIndex);
      }

      // Zero-Copy sub-array views (no buf.slice, no duplicate ArrayBuffer allocation)
      const numSamples = (buf.byteLength - 8) / 8;
      const byteLen = numSamples * 4;

      const outL = new Float32Array(buf, 8, numSamples);
      const outR = new Float32Array(buf, 8 + byteLen, numSamples);

      if (this.onChunkProcessed) {
        this.onChunkProcessed(chunkIndex, outL, outR, this.lastRtt, buf);
      }
    }
  }

  resetStream() {
    this.pendingChunks.clear();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      // WebSocket preserves ordering: packets sent before this marker are
      // completed by GO before it resets its STFT/overlap state.
      this.ws.send(JSON.stringify({ type: "RESET_STREAM" }));
    } catch (_) {}
  }

  sendChunk(chunkIndex, rawL, rawR, mode, delayChunks = 1) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const CHUNK_SIZE = rawL.length;
    const modeCode = mode === "karaoke" ? 1 : (mode === "acapella" ? 2 : 0);

    let bufferToSend;
    if (CHUNK_SIZE === this.sendCapacity) {
      // Ultra-Fast Zero-Allocation Path: re-use preallocated send buffer
      this.sendView.setUint32(0, chunkIndex, true);
      this.sendView.setUint8(4, modeCode);
      this.sendView.setUint8(5, delayChunks);
      this.sendView.setUint8(6, 0);
      this.sendFloatL.set(rawL);
      this.sendFloatR.set(rawR);
      bufferToSend = this.sendBuffer;
    } else {
      // Fallback if chunk size ever differs
      const totalBytes = 8 + (CHUNK_SIZE * 8);
      const packet = new Uint8Array(totalBytes);
      const view = new DataView(packet.buffer);
      view.setUint32(0, chunkIndex, true);
      view.setUint8(4, modeCode);
      view.setUint8(5, delayChunks);
      view.setUint8(6, 0);
      const rawLBytes = new Uint8Array(rawL.buffer, rawL.byteOffset, rawL.byteLength);
      const rawRBytes = new Uint8Array(rawR.buffer, rawR.byteOffset, rawR.byteLength);
      packet.set(rawLBytes, 8);
      packet.set(rawRBytes, 8 + (CHUNK_SIZE * 4));
      bufferToSend = packet.buffer;
    }

    this.pendingChunks.set(chunkIndex, performance.now());
    try {
      this.ws.send(bufferToSend);
      return true;
    } catch (_) {
      // The socket can close between readyState checking and send(). Do not
      // pass raw audio to the worklet; GO concealment will cover the gap.
      this.pendingChunks.delete(chunkIndex);
      return false;
    }
  }
}
