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

      // Init with library cheaper preset (tested & lightweight)
      this.stretch = await SignalsmithStretch(this.audioCtx, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { preset: "cheaper" }
      });

      // ① "cheaper" preset
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
