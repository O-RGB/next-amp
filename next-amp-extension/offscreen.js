import SignalsmithStretch from "./assets/libs/mjs/signalsmith-stretch.mjs";

let audioCtx, source, stretch;
let reverbNode, reverbGain, panNode, masterGain;
let eqNodes = [];
let analyser;

// ความถี่สำหรับ EQ 10 แบนด์
const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

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
    updateParams(msg);
  }
});

async function startAudio(streamId) {
  try {
    // 1. ขอ Stream เสียงจาก Tab
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });

    // ปิด Context เก่าถ้ามี
    if (audioCtx) await audioCtx.close();

    // 2. สร้าง AudioContext
    audioCtx = new AudioContext();
    source = audioCtx.createMediaStreamSource(stream);

    // 3. เตรียม Node พื้นฐาน
    masterGain = audioCtx.createGain();
    masterGain.gain.value = params.volume;

    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = params.reverb;

    panNode = audioCtx.createStereoPanner();
    panNode.pan.value = params.pan;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    // สร้าง EQ
    eqNodes = FREQUENCIES.map((f, i) => {
      const n = audioCtx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.Q.value = 1.4;
      n.gain.value = params.eq[i] || 0;
      return n;
    });

    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createImpulseResponse(3.0, 2.0);

    // 4. ตั้งค่า Signalsmith Stretch (Pitch Shifter)
    try {
      // --- จุดสำคัญ: แก้ไข Path ให้ตรงกับไฟล์ที่คุณระบุ ---
      // ระบุตำแหน่งของไฟล์ .mjs ให้ชัดเจน เพื่อให้มันหา .wasm ที่อยู่คู่กันเจอ
      SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
        "./assets/libs/mjs/signalsmith-stretch.mjs"
      );

      // สร้าง Instance ของ Stretch
      stretch = await SignalsmithStretch(audioCtx);

      // ตั้งค่าเริ่มต้น: Rate 1.0 (ปกติ) แต่เปลี่ยน Semitones ตามค่า Pitch
      stretch.schedule({
        active: true,
        rate: 1.0,
        semitones: params.pitch,
      });
    } catch (err) {
      console.error("Stretch Engine Load Failed:", err);
    }

    // 5. เชื่อมต่อระบบเสียง (Audio Graph)
    // ลำดับ: Source -> [Stretch] -> [EQs] -> Pan -> Master

    let lastNode = source;

    if (stretch) {
      lastNode.connect(stretch);
      lastNode = stretch;
    }

    // ต่อ EQ
    eqNodes.forEach((n) => {
      lastNode.connect(n);
      lastNode = n;
    });

    // ต่อ Reverb (Send Effect)
    lastNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    // ต่อสัญญาณหลัก (Dry)
    lastNode.connect(panNode);
    panNode.connect(masterGain);

    // Output
    masterGain.connect(analyser);
    masterGain.connect(audioCtx.destination);

    // 6. ลูปส่งข้อมูล Visualizer
    setInterval(() => {
      if (!analyser || audioCtx.state === "suspended") return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      chrome.runtime
        .sendMessage({ type: "VISUALIZER_DATA", data: Array.from(data) })
        .catch(() => {}); // ป้องกัน error ถ้า popup ปิดอยู่
    }, 50);
  } catch (e) {
    console.error("Audio Engine Error:", e);
  }
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
    }
  }
  return impulse;
}
