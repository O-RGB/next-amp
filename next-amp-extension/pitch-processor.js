import SignalsmithStretch from "./assets/libs/mjs/SignalsmithStretch.mjs";

export class PitchProcessor {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.stretch = null;
    this.isLoaded = false;
  }

  async init() {
    try {
      if (!SignalsmithStretch.wasLoaded) {
        SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
          "assets/libs/mjs/SignalsmithStretch.mjs"
        );
        SignalsmithStretch.wasLoaded = true;
      }

      // Init with library defaults (no extra options — proven safe)
      this.stretch = await SignalsmithStretch(this.audioCtx);

      // ① "cheaper" preset via configure() — the correct API for this library version.
      //    processorOptions at AudioWorkletNode creation is NOT supported here;
      //    the preset must be sent via the worklet message channel after init.
      //    Reduces internal FFT block/interval sizes → significant CPU reduction.
      if (typeof this.stretch.configure === "function") {
        this.stretch.configure({ preset: "cheaper" });
      }

      // ② Suppress inputTime update callbacks.
      //    Default: fires every render quantum (~2.9ms ≈ 344 calls/sec).
      //    Setting 999ms → fires ~1 call/sec, eliminating JS message overhead.
      if (typeof this.stretch.setUpdateInterval === "function") {
        this.stretch.setUpdateInterval(999);
      }

      this.isLoaded = true;
      return this.stretch;
    } catch (err) {
      console.error("Stretch Load Error:", err);
      return null;
    }
  }

  setPitch(semitones) {
    if (!this.stretch) return;
    this.stretch.schedule({ active: true, rate: 1.0, semitones: semitones });
  }

  getNode() {
    return this.stretch;
  }
}
