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
      this.stretch = await SignalsmithStretch(this.audioCtx);
      this.isLoaded = true;
      return this.stretch;
    } catch (err) {
      console.error("Stretch Load Error:", err);
      return null;
    }
  }

  setPitch(semitones) {
    if (this.stretch) {
      this.stretch.schedule({ active: true, rate: 1.0, semitones: semitones });
    }
  }

  getNode() {
    return this.stretch;
  }
}
