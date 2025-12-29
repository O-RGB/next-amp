<<<<<<< HEAD
import SignalsmithStretch from "./assets/libs/mjs/signalsmith-stretch.mjs";
=======
import SignalsmithStretch from "./assets/libs/mjs/SignalsmithStretch.mjs";
>>>>>>> rollback

let audioCtx, source, stretch;
let reverbNode, reverbGain, panNode, masterGain;
let eqNodes = [];
let analyser;
let globalStream = null;

// ความถี่สำหรับ EQ 10 แบนด์
const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
<<<<<<< HEAD
=======
let params = {
  pitch: 0,
  reverb: 0,
  pan: 0,
  volume: 1.0,
  visualMode: 0,
  isEqOn: true,
};
>>>>>>> rollback

// ตัวแปรเก็บค่าพารามิเตอร์ปัจจุบัน
let params = {
  pitch: 0,
  reverb: 0,
  pan: 0,
  volume: 1.0,
  eq: Array(10).fill(0),
};

// รับข้อความจาก Background หรือ Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_CAPTURE") {
    startAudio(msg.streamId);
  } else if (msg.type === "SET_PARAM") {
    if (msg.key === "reset") {
      resetParams();
    } else {
      updateParams(msg);
    }
  } else if (msg.type === "GET_STATE") {
    const currentEq = eqNodes.length ? eqNodes.map((n) => n.gain.value) : [];
    const isActive = audioCtx && audioCtx.state === "running";
    sendResponse({
      ...params,
      eqGains: currentEq,
      isAudioActive: isActive,
    });
  } else if (msg.type === "STOP_CAPTURE") {
    stopAudio();
  }
  return true;
});

function resetParams() {
  params = {
    pitch: 0,
    reverb: 0,
    pan: 0,
    volume: 1.0,
    visualMode: 0,
    isEqOn: true,
  };
  updateParams({ key: "pitch", value: 0 });
  updateParams({ key: "reverb", value: 0 });
  updateParams({ key: "pan", value: 0 });
  updateParams({ key: "volume", value: 1.0 });
  eqNodes.forEach((n) => (n.gain.value = 0));
}

function stopAudio() {
  if (globalStream) {
    globalStream.getTracks().forEach((track) => track.stop());
    globalStream = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch (e) {}
    audioCtx = null;
  }
  params.visualMode = 3;
}

async function startAudio(streamId) {
  try {
<<<<<<< HEAD
    // 1. ขอ Stream เสียงจาก Tab
=======
>>>>>>> rollback
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });

<<<<<<< HEAD
    // ปิด Context เก่าถ้ามี
    if (audioCtx) await audioCtx.close();

    // 2. สร้าง AudioContext
    audioCtx = new AudioContext();
    source = audioCtx.createMediaStreamSource(stream);

    // 3. เตรียม Node พื้นฐาน
=======
    if (audioCtx) await audioCtx.close();

    globalStream = stream;
    audioCtx = new AudioContext();
    source = audioCtx.createMediaStreamSource(stream);

>>>>>>> rollback
    masterGain = audioCtx.createGain();
    masterGain.gain.value = params.volume;

    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = params.reverb;

    panNode = audioCtx.createStereoPanner();
    panNode.pan.value = params.pan;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

<<<<<<< HEAD
    // สร้าง EQ
    eqNodes = FREQUENCIES.map((f, i) => {
=======
    eqNodes = FREQUENCIES.map((f) => {
>>>>>>> rollback
      const n = audioCtx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.Q.value = 1.4;
      n.gain.value = params.eq[i] || 0;
      return n;
    });

    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createImpulseResponse(3.0, 2.0);
<<<<<<< HEAD

    // 4. ตั้งค่า Signalsmith Stretch (Pitch Shifter)
    try {
      // --- จุดสำคัญ: แก้ไข Path ให้ตรงกับไฟล์ที่คุณระบุ ---
      // ระบุตำแหน่งของไฟล์ .mjs ให้ชัดเจน เพื่อให้มันหา .wasm ที่อยู่คู่กันเจอ
      SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
        "./assets/libs/mjs/signalsmith-stretch.mjs"
      );

      // สร้าง Instance ของ Stretch
=======
    reverbGain.gain.value = 0;

    try {
      if (!SignalsmithStretch.wasLoaded) {
        SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
          "assets/libs/mjs/SignalsmithStretch.mjs"
        );
        SignalsmithStretch.wasLoaded = true;
      }
>>>>>>> rollback
      stretch = await SignalsmithStretch(audioCtx);

      // ตั้งค่าเริ่มต้น: Rate 1.0 (ปกติ) แต่เปลี่ยน Semitones ตามค่า Pitch
      stretch.schedule({
        active: true,
        rate: 1.0,
        semitones: params.pitch,
      });
    } catch (err) {
<<<<<<< HEAD
      console.error("Stretch Engine Load Failed:", err);
    }

    // 5. เชื่อมต่อระบบเสียง (Audio Graph)
    // ลำดับ: Source -> [Stretch] -> [EQs] -> Pan -> Master

=======
      console.error("Stretch Load Error:", err);
    }

>>>>>>> rollback
    let lastNode = source;
    if (stretch) {
      lastNode.connect(stretch);
      lastNode = stretch;
    }
<<<<<<< HEAD

    // ต่อ EQ
=======
>>>>>>> rollback
    eqNodes.forEach((n) => {
      lastNode.connect(n);
      lastNode = n;
    });

<<<<<<< HEAD
    // ต่อ Reverb (Send Effect)
    lastNode.connect(reverbNode);
=======
    lastNode.connect(panNode);
    panNode.connect(masterGain);

    eqNodes[eqNodes.length - 1].connect(reverbNode);
>>>>>>> rollback
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    // ต่อสัญญาณหลัก (Dry)
    lastNode.connect(panNode);
    panNode.connect(masterGain);

    // Output
    masterGain.connect(analyser);
    masterGain.connect(audioCtx.destination);

<<<<<<< HEAD
    // 6. ลูปส่งข้อมูล Visualizer
    setInterval(() => {
      if (!analyser || audioCtx.state === "suspended") return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      chrome.runtime
        .sendMessage({ type: "VISUALIZER_DATA", data: Array.from(data) })
        .catch(() => {}); // ป้องกัน error ถ้า popup ปิดอยู่
    }, 50);
=======
    if (stretch) updateStretch();

    params.visualMode = 0;
    setTimeout(loopVisualizer, 30);
>>>>>>> rollback
  } catch (e) {
    console.error("Audio Engine Error:", e);
  }
}
function loopVisualizer() {
  if (!audioCtx || !analyser) return;

  if (params.visualMode === 3) return;

  const data = new Uint8Array(analyser.frequencyBinCount);

  if (params.visualMode === 2) {
    analyser.getByteTimeDomainData(data);
  } else {
    analyser.getByteFrequencyData(data);
  }

  chrome.runtime
    .sendMessage({
      type: "VISUALIZER_DATA",
      data: Array.from(data),
      mode: params.visualMode,
    })
    .catch(() => {});

  setTimeout(loopVisualizer, 30);
}

function updateParams({ key, value, index }) {
  // อัปเดตค่าในตัวแปร
  if (key === "eq") params.eq[index] = value;
  else params[key] = value;

  if (!audioCtx) return;

  // อัปเดต Pitch
  if (key === "pitch" && stretch) {
    stretch.schedule({
      active: true,
      rate: 1.0, // ย้ำว่า Rate ต้องเป็น 1.0 เสมอสำหรับ Live Stream
      semitones: value, // เปลี่ยนระดับเสียง
    });
  }
<<<<<<< HEAD
=======
  if (key === "reverb") {
    params.reverb = value;
    reverbGain.gain.value = value;
  }
  if (key === "pan") {
    params.pan = value;
    panNode.pan.value = value;
  }
  if (key === "volume") {
    params.volume = value;
    masterGain.gain.value = value;
  }
  if (key === "visualMode") {
    params.visualMode = value;
  }
  if (key === "isEqOn") {
    params.isEqOn = value;
  }
  if (key === "eq") {
    if (eqNodes[index]) eqNodes[index].gain.value = value;
  }
}
>>>>>>> rollback

  // อัปเดต Effect อื่นๆ
  if (key === "reverb" && reverbGain) {
    reverbGain.gain.setTargetAtTime(value, audioCtx.currentTime, 0.1);
  }
  if (key === "pan" && panNode) {
    panNode.pan.setTargetAtTime(value, audioCtx.currentTime, 0.1);
  }
  if (key === "volume" && masterGain) {
    masterGain.gain.setTargetAtTime(value, audioCtx.currentTime, 0.1);
  }
  if (key === "eq" && eqNodes[index]) {
    eqNodes[index].gain.setTargetAtTime(value, audioCtx.currentTime, 0.1);
  }
}

<<<<<<< HEAD
// ฟังก์ชันสร้างเสียงก้อง (Reverb Impulse)
function createImpulseResponse(duration = 3.0, decay = 2.0, preDelay = 0.02) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const preDelaySamples = Math.floor(preDelay * sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lastOut = 0;
    const alpha = 0.12;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = lastOut + alpha * (white - lastOut);
      const noise = lastOut;
      if (i < preDelaySamples) {
        data[i] = 0;
      } else {
        const t = (i - preDelaySamples) / (length - preDelaySamples);
        const envelope = Math.exp(-decay * t);
        const wobble = 1 + 0.1 * Math.sin(t * 20);
        data[i] = noise * envelope * wobble;
      }
=======
function createImpulseResponse(duration, decay) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = lastOut + 0.12 * (white - lastOut);
      data[i] = lastOut * Math.exp(-decay * (i / length) * (duration / 2));
>>>>>>> rollback
    }
  }
  return impulse;
}
