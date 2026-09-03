/**
 * NextAmp AI Vocal Separator Controller
 * Coordinates the AudioWorklet DSP processor and ONNX Runtime WebGPU AI inference.
 */

export class VocalSeparator {
  constructor(options = {}) {
    this.audioContext = null;
    this.workletNode = null;
    this.onnxSession = null;

    this.mode = options.mode || "bypass"; // "karaoke", "acapella", "bypass"
    this.strength = options.strength ?? 1.0;
    this.isReady = false;

    this.wasmPath = options.wasmPath || chrome.runtime.getURL("modules/ai-vocal/stft_simd.wasm");
    this.workletPath = options.workletPath || chrome.runtime.getURL("modules/ai-vocal/vocal-processor.worklet.js");
    this.modelPath = options.modelPath || chrome.runtime.getURL("modules/ai-vocal/model.onnx");
  }

  /**
   * Initializes the AudioWorklet and loads the WASM module.
   */
  async init(audioContext) {
    if (this.isReady) return;
    this.audioContext = audioContext;

    // 1. Add AudioWorklet module
    await this.audioContext.audioWorklet.addModule(this.workletPath);

    // 2. Create the AudioWorkletNode
    this.workletNode = new AudioWorkletNode(this.audioContext, "ai-vocal-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });

    // 3. Load WASM bytes and send to AudioWorklet
    const response = await fetch(this.wasmPath);
    const wasmBytes = await response.arrayBuffer();

    await new Promise((resolve, reject) => {
      this.workletNode.port.onmessage = (e) => {
        if (e.data.type === "READY") {
          this.isReady = true;
          this.setMode(this.mode);
          this.setStrength(this.strength);
          resolve();
        } else if (e.data.type === "ERROR") {
          reject(new Error(e.data.message));
        } else if (e.data.type === "PREDICT_MASK") {
          this.handlePrediction(e.data);
        }
      };

      this.workletNode.port.postMessage({
        type: "INIT_WASM",
        wasmBytes: wasmBytes
      });
    });

    console.log("[NextAmp AI] Vocal Separator initialized successfully.");
  }

  /**
   * Sets separation mode:
   * "karaoke": Cuts vocals, keeps instruments (0)
   * "acapella": Isolates vocals, removes instruments (1)
   * "bypass": Passes audio through unchanged (2)
   */
  setMode(mode) {
    this.mode = mode;
    if (!this.workletNode) return;
    const modeCode = mode === "karaoke" ? 0 : mode === "acapella" ? 1 : 2;
    this.workletNode.port.postMessage({ type: "SET_MODE", mode: modeCode });
  }

  /**
   * Sets vocal cut / isolation intensity (0.0 to 1.0)
   */
  setStrength(val) {
    this.strength = Math.max(0, Math.min(1, val));
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type: "SET_STRENGTH", strength: this.strength });
  }

  /**
   * Connects the processor into the audio graph
   */
  connect(source, destination) {
    if (!this.workletNode) throw new Error("VocalSeparator not initialized");
    source.disconnect();
    source.connect(this.workletNode);
    this.workletNode.connect(destination);
  }

  /**
   * Disconnects processor from audio graph
   */
  disconnect() {
    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch (_) {}
    }
  }

  /**
   * Run ONNX WebGPU inference on incoming spectral magnitudes
   */
  async handlePrediction(data) {
    if (!this.onnxSession) return;
    // When ONNX model is loaded, predict mask and send back to worklet:
    // this.workletNode.port.postMessage({ type: "APPLY_MASK", maskL, maskR });
  }
}
