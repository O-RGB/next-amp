const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

export class AudioEffects {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.nodes = {};

    this.isEqOn = true;
    this.isNormalizeOn = false;

    this.revDuration = 3.0;
    this.revDecay = 2.0;
    this.dynBoost = 40;
    this.dynLimit = 60;

    this.setupNodes();
  }

  setupNodes() {
    const ctx = this.ctx;

    this.nodes.input = ctx.createGain();
    this.nodes.masterGain = ctx.createGain();

    this.nodes.eq = FREQUENCIES.map((f) => {
      const n = ctx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.gain.value = 0;
      return n;
    });

    this.nodes.pan = ctx.createStereoPanner();

    this.nodes.reverbConv = ctx.createConvolver();
    this.nodes.reverbConv.buffer = this.createImpulseResponse(3.0, 2.0);
    this.nodes.reverbGain = ctx.createGain();

    this.nodes.compressor = ctx.createDynamicsCompressor();
    this.nodes.makeup = ctx.createGain();
    this.nodes.limiter = ctx.createDynamicsCompressor();

    this.refreshEQChain();
    this.refreshOutputChain();
    // ConvolverNode is off by default — disconnect it immediately so it doesn't
    // waste CPU doing FFT convolution before the user turns reverb on.
    this.setReverb(0);
  }

  refreshEQChain() {
    this.nodes.input.disconnect();
    this.nodes.eq.forEach((n) => n.disconnect());

    if (!this.isEqOn) {
      this.nodes.input.connect(this.nodes.pan);
      return;
    }

    const activeEQs = this.nodes.eq.filter(
      (n) => Math.abs(n.gain.value) > 0.01
    );

    if (activeEQs.length === 0) {
      this.nodes.input.connect(this.nodes.pan);
    } else {
      let currentNode = this.nodes.input;
      activeEQs.forEach((eqNode) => {
        currentNode.connect(eqNode);
        currentNode = eqNode;
      });
      currentNode.connect(this.nodes.pan);
    }
  }

  refreshOutputChain() {
    this.nodes.pan.disconnect();
    this.nodes.reverbGain.disconnect();
    this.nodes.compressor.disconnect();
    this.nodes.makeup.disconnect();
    this.nodes.limiter.disconnect();

    // Only wire ConvolverNode when reverb is active.
    // If reverb=0, it was disconnected by setReverb() and must stay out of the graph.
    const reverbActive = this.nodes.reverbGain.gain.value > 0;
    this.isReverbConnected = reverbActive;
    if (reverbActive) {
      this.nodes.pan.connect(this.nodes.reverbConv);
      this.nodes.reverbConv.connect(this.nodes.reverbGain);
    }

    if (this.isNormalizeOn) {
      this.nodes.pan.connect(this.nodes.compressor);
      if (reverbActive) this.nodes.reverbGain.connect(this.nodes.compressor);

      this.nodes.compressor.connect(this.nodes.makeup);
      this.nodes.makeup.connect(this.nodes.limiter);
      this.nodes.limiter.connect(this.nodes.masterGain);
    } else {
      this.nodes.pan.connect(this.nodes.masterGain);
      if (reverbActive) this.nodes.reverbGain.connect(this.nodes.masterGain);
    }
  }

  setInput(sourceNode) {
    sourceNode.connect(this.nodes.input);
  }

  // Expose the internal input GainNode so callers can bypass SignalsmithStretch
  // by connecting source directly when pitch=0.
  getInputNode() {
    return this.nodes.input;
  }

  connectOutput(destinationNode) {
    this.nodes.masterGain.connect(destinationNode);
  }

  setVolume(val) {
    this.nodes.masterGain.gain.value = val;
  }

  setPan(val) {
    this.nodes.pan.pan.value = val;
  }

  setReverb(val) {
    this.nodes.reverbGain.gain.value = val;

    // ConvolverNode is very expensive (FFT convolution every render quantum).
    // Disconnect it entirely when reverb=0 so the browser stops scheduling it.
    if (val === 0) {
      if (this.isReverbConnected) {
        try { this.nodes.pan.disconnect(this.nodes.reverbConv); } catch (_) {}
        this.isReverbConnected = false;
      }
    } else {
      if (!this.isReverbConnected) {
        try { this.nodes.pan.connect(this.nodes.reverbConv); } catch (_) {}
        this.isReverbConnected = true;
      }
    }
  }

  setEQEnabled(enabled) {
    if (this.isEqOn !== enabled) {
      this.isEqOn = enabled;
      this.refreshEQChain();
    }
  }

  setEQ(index, val) {
    if (this.nodes.eq[index]) {
      const oldVal = this.nodes.eq[index].gain.value;
      this.nodes.eq[index].gain.value = val;

      const wasActive = Math.abs(oldVal) > 0.01;
      const isActive = Math.abs(val) > 0.01;

      if (wasActive !== isActive && this.isEqOn) {
        this.refreshEQChain();
      }
    }
  }

  setReverbParams(duration, decay) {
    this.revDuration = duration;
    this.revDecay = decay;
    const newBuffer = this.createImpulseResponse(duration, decay);
    this.nodes.reverbConv.buffer = newBuffer;
  }

  setDynamicsParams(boost, limit) {
    this.dynBoost = boost;
    this.dynLimit = limit;
    if (this.isNormalizeOn) {
      this.applyDynamicsValues();
    }
  }

  applyDynamicsValues() {
    const now = this.ctx.currentTime;
    const { compressor, makeup, limiter } = this.nodes;

    const threshold = -10 - this.dynBoost * 0.4;

    const mkGain = 1.0 + this.dynBoost * 0.01;

    const ratio = 1 + this.dynLimit * 0.19;

    compressor.threshold.setTargetAtTime(threshold, now, 0.1);
    compressor.ratio.setTargetAtTime(ratio, now, 0.1);
    compressor.knee.setTargetAtTime(5, now, 0.1);

    makeup.gain.setTargetAtTime(mkGain, now, 0.1);

    limiter.threshold.setTargetAtTime(-1.0, now, 0.05);
    limiter.ratio.setTargetAtTime(20, now, 0.05);
  }

  updateNormalize(isNormalizeOn) {
    this.isNormalizeOn = isNormalizeOn;
    const now = this.ctx.currentTime;
    const { compressor, makeup, limiter } = this.nodes;

    if (isNormalizeOn) {
      this.applyDynamicsValues();
    } else {
      compressor.threshold.setTargetAtTime(0, now, 0.1);
      compressor.ratio.setTargetAtTime(1, now, 0.1);
      makeup.gain.setTargetAtTime(1.0, now, 0.1);
      limiter.threshold.setTargetAtTime(0, now, 0.1);
    }
    this.refreshOutputChain();
  }

  createImpulseResponse(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = lastOut + 0.12 * (white - lastOut);
        data[i] = lastOut * Math.exp(-decay * (i / length) * (duration / 2));
      }
    }
    return impulse;
  }

  getMasterNode() {
    return this.nodes.masterGain;
  }

  getEQNodes() {
    return this.nodes.eq;
  }
}
