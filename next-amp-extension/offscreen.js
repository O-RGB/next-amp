// offscreen.js
// ตรวจสอบ Path นี้ให้ดี! ต้องตรงกับโครงสร้างโฟลเดอร์จริง
import SignalsmithStretch from "./assets/libs/mjs/SignalsmithStretch.mjs";

let audioCtx, source, stretch;
let reverbNode, reverbGain, panNode, masterGain;
let eqNodes = [];
let analyser;

const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
let params = { pitch: 0, reverb: 0, pan: 0, volume: 1.0 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_CAPTURE") {
    console.log("Offscreen received START_CAPTURE", msg.streamId);
    startAudio(msg.streamId);
  } else if (msg.type === "SET_PARAM") {
    updateParams(msg);
  }
});

async function startAudio(streamId) {
  try {
    // ใช้ getUserMedia ดึงเสียงจาก Tab ผ่าน streamId
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });

    if (audioCtx) audioCtx.close();
    audioCtx = new AudioContext();
    source = audioCtx.createMediaStreamSource(stream);

    // สร้าง Nodes
    masterGain = audioCtx.createGain();
    reverbGain = audioCtx.createGain();
    panNode = audioCtx.createStereoPanner();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;

    // EQ Nodes
    eqNodes = FREQUENCIES.map((f) => {
      const n = audioCtx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.gain.value = 0;
      return n;
    });

    // Reverb & Stretch
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createImpulse();
    reverbGain.gain.value = 0;

    // โหลด Library Stretch
    try {
      // --- เพิ่มบรรทัดนี้: บอก path ของไฟล์ SignalsmithStretch.mjs ให้ Library รู้ ---
      SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
        "assets/libs/mjs/SignalsmithStretch.mjs"
      );

      stretch = await SignalsmithStretch(audioCtx);
    } catch (err) {
      console.error("Failed to load SignalsmithStretch:", err);
    }

    // --- เชื่อมต่อสายสัญญาณ (Audio Routing) ---
    let lastNode = source;

    if (stretch) {
      source.connect(stretch);
      lastNode = stretch;
    }

    // EQ Chain
    eqNodes.forEach((n) => {
      lastNode.connect(n);
      lastNode = n;
    });

    // Pan & Reverb
    lastNode.connect(panNode);
    panNode.connect(masterGain);

    // Aux Send to Reverb
    panNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    masterGain.connect(analyser);
    masterGain.connect(audioCtx.destination); // ออกลำโพง

    if (stretch) updateStretch();

    // Loop ส่งค่า Visualizer กลับไป Popup
    setInterval(() => {
      if (!analyser) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      // ส่งข้อมูลกลับไปหา Popup (ถ้า Popup ปิดอยู่ จะ error ก็ช่างมัน)
      chrome.runtime
        .sendMessage({ type: "VISUALIZER_DATA", data: Array.from(data) })
        .catch(() => {});
    }, 50);
  } catch (e) {
    console.error("Audio Engine Error:", e);
  }
}

function updateParams({ key, value, index }) {
  if (!audioCtx) return;

  if (key === "pitch" && stretch) {
    params.pitch = value;
    updateStretch();
  }
  if (key === "reverb") reverbGain.gain.value = value;
  if (key === "pan") panNode.pan.value = value;
  if (key === "volume") masterGain.gain.value = value;
  if (key === "eq" && eqNodes[index]) eqNodes[index].gain.value = value;
}

function updateStretch() {
  if (stretch) {
    stretch.schedule({ active: true, rate: 1.0, semitones: params.pitch });
  }
}

function createImpulse() {
  const len = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  }
  return buf;
}
