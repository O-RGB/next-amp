const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

export class AudioEffects {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.nodes = {};

    // สถานะเริ่มต้น
    this.isEqOn = true;
    this.isNormalizeOn = false;

    // Default Values
    this.revDuration = 3.0;
    this.revDecay = 2.0;
    this.dynBoost = 40; // Default matches 40% UI
    this.dynLimit = 60; // Default matches 60% UI

    this.setupNodes();
  }

  setupNodes() {
    const ctx = this.ctx;

    // 1. Input/Output Gains
    this.nodes.input = ctx.createGain();
    this.nodes.masterGain = ctx.createGain();

    // 2. EQ Nodes (สร้างไว้รอ แต่ยังไม่เชื่อมต่อสาย)
    this.nodes.eq = FREQUENCIES.map((f) => {
      const n = ctx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.gain.value = 0;
      return n;
    });

    // 3. Pan
    this.nodes.pan = ctx.createStereoPanner();

    // 4. Reverb
    this.nodes.reverbConv = ctx.createConvolver();
    this.nodes.reverbConv.buffer = this.createImpulseResponse(3.0, 2.0);
    this.nodes.reverbGain = ctx.createGain();

    // 5. Normalize System
    this.nodes.compressor = ctx.createDynamicsCompressor();
    this.nodes.makeup = ctx.createGain();
    this.nodes.limiter = ctx.createDynamicsCompressor();

    // --- เริ่มต้นการเชื่อมต่อสาย (Initial Wiring) ---
    this.refreshEQChain(); // จัดการช่วง Input -> EQ -> Pan
    this.refreshOutputChain(); // จัดการช่วง Pan -> Output
  }

  // --- ฟังก์ชันหัวใจหลักสำหรับการสลับสาย (Routing) ---

  // 1. จัดการสายช่วง EQ
  refreshEQChain() {
    // ตัดการเชื่อมต่อเก่าทั้งหมดก่อน
    this.nodes.input.disconnect();
    this.nodes.eq.forEach((n) => n.disconnect());

    // ถ้าปิด EQ อยู่ หรือ ไม่มี EQ ตัวไหนถูกปรับเลย ให้ต่อตรงเข้า Pan
    // (ถือว่า EQ เป็น 0 คือไม่ใช้งาน เพื่อลดภาระ CPU)
    if (!this.isEqOn) {
      this.nodes.input.connect(this.nodes.pan);
      return;
    }

    // หาเฉพาะ Node ที่มีการใช้งาน (Gain != 0)
    const activeEQs = this.nodes.eq.filter(
      (n) => Math.abs(n.gain.value) > 0.01
    );

    if (activeEQs.length === 0) {
      // ถ้าเปิด EQ แต่ทุกตัวเป็น 0 ก็ต่อตรงเช่นกัน
      this.nodes.input.connect(this.nodes.pan);
    } else {
      // ต่อสายเรียงกันเฉพาะตัวที่ใช้งาน: Input -> EQ1 -> EQ2 -> ... -> Pan
      let currentNode = this.nodes.input;
      activeEQs.forEach((eqNode) => {
        currentNode.connect(eqNode);
        currentNode = eqNode;
      });
      currentNode.connect(this.nodes.pan);
    }
  }

  // 2. จัดการสายช่วง Output (Normalize/Master)
  refreshOutputChain() {
    // ตัดสายช่วง Output เดิม
    this.nodes.pan.disconnect();
    this.nodes.reverbGain.disconnect();
    this.nodes.compressor.disconnect();
    this.nodes.makeup.disconnect();
    this.nodes.limiter.disconnect();

    // Reverb Wiring: Pan แยกเข้า Reverb เสมอ (Wet Path)
    this.nodes.pan.connect(this.nodes.reverbConv);
    this.nodes.reverbConv.connect(this.nodes.reverbGain);

    if (this.isNormalizeOn) {
      // ถ้าเปิด Normalize: เข้า Compressor Chain
      // Dry & Wet -> Compressor
      this.nodes.pan.connect(this.nodes.compressor);
      this.nodes.reverbGain.connect(this.nodes.compressor);

      // Chain: Compressor -> Makeup -> Limiter -> Master
      this.nodes.compressor.connect(this.nodes.makeup);
      this.nodes.makeup.connect(this.nodes.limiter);
      this.nodes.limiter.connect(this.nodes.masterGain);
    } else {
      // ถ้าปิด Normalize: ต่อตรงเข้า Master (True Bypass)
      this.nodes.pan.connect(this.nodes.masterGain);
      this.nodes.reverbGain.connect(this.nodes.masterGain);
    }
  }

  // --- Public Methods ---

  setInput(sourceNode) {
    sourceNode.connect(this.nodes.input);
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
  }

  // เปิด-ปิด EQ (Global Toggle)
  setEQEnabled(enabled) {
    if (this.isEqOn !== enabled) {
      this.isEqOn = enabled;
      this.refreshEQChain(); // สลับสายทันทีเมื่อกดปุ่ม
    }
  }

  // ปรับค่า EQ แต่ละตัว
  setEQ(index, val) {
    if (this.nodes.eq[index]) {
      const oldVal = this.nodes.eq[index].gain.value;
      this.nodes.eq[index].gain.value = val;

      // เช็คว่าค่าเปลี่ยนจาก 0 หรือกลับเป็น 0 หรือไม่?
      // ถ้าใช่ ต้องสลับสายใหม่ (เพื่อดีด node ออก หรือเอา node เข้า)
      const wasActive = Math.abs(oldVal) > 0.01;
      const isActive = Math.abs(val) > 0.01;

      // ถ้าสถานะการ active เปลี่ยน หรือเรากำลังเปิด EQ อยู่แล้วมีตัวใดตัวหนึ่งเปลี่ยน
      // (เรียก refreshEQChain บ่อยหน่อยเพื่อความชัวร์ หรือจะเช็ค condition ละเอียดก็ได้)
      if (wasActive !== isActive && this.isEqOn) {
        this.refreshEQChain();
      }
    }
  }

  // -- NEW Methods --

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

    // คำนวณค่าจาก 0-100% ให้ครอบคลุมช่วงที่ต้องการ
    // Boost 40% (ค่าเริ่มต้น) จะได้ Threshold ~ -26dB, Gain ~ 1.4x (ใกล้เคียงมาตรฐานเดิม)
    // Limit 60% (ค่าเริ่มต้น) จะได้ Ratio ~ 12.4 (ใกล้เคียงมาตรฐานเดิม)

    // Threshold: -10 (เบา) ไปถึง -50 (หนัก)
    const threshold = -10 - this.dynBoost * 0.4;

    // Makeup Gain: 1.0 (ปกติ) ไปถึง 2.0 (คูณสอง)
    const mkGain = 1.0 + this.dynBoost * 0.01;

    // Ratio: 1 (ไม่กด) ไปถึง 20 (กดหนัก)
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
      // Reset เป็นค่า Bypass
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
