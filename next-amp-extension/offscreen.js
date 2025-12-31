// offscreen.js

import SignalsmithStretch from "./assets/libs/mjs/SignalsmithStretch.mjs";

let audioCtx, source, stretch;
let reverbNode, reverbGain, panNode, masterGain;
let eqNodes = [];
let analyser;
let globalStream = null;
let currentTabId = null; // [เพิ่ม] ตัวแปรเก็บ Tab ID ปัจจุบัน

const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
// ค่าเริ่มต้น
let params = {
  pitch: 0,
  reverb: 0,
  pan: 0,
  volume: 1.0,
  visualMode: 0,
  isEqOn: true,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_CAPTURE") {
    // [แก้ไข] รับ tabId มาด้วยเพื่อบันทึกว่ากำลังเล่น Tab ไหน
    startAudio(msg.streamId, msg.tabId);
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
      activeTabId: currentTabId, // [เพิ่ม] ส่ง Tab ID กลับไปเช็ค
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
  // เรียก update เพื่อรีเซ็ตค่าใน Audio Node ด้วย
  updateParams({ key: "pitch", value: 0 });
  updateParams({ key: "reverb", value: 0 });
  updateParams({ key: "pan", value: 0 });
  updateParams({ key: "volume", value: 1.0 });
  if (eqNodes.length) eqNodes.forEach((n) => (n.gain.value = 0));
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
  // ไม่ reset params.visualMode เพื่อให้ UI คงสถานะเดิม
  currentTabId = null;
}

async function startAudio(streamId, tabId) {
  // [เพิ่ม] ปิดของเก่าให้หมดก่อนเริ่มใหม่เสมอ (Force Switch)
  if (audioCtx || globalStream) {
    stopAudio();
  }

  currentTabId = tabId; // [เพิ่ม] จำ Tab ID

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });

    globalStream = stream;
    audioCtx = new AudioContext();
    source = audioCtx.createMediaStreamSource(stream);

    masterGain = audioCtx.createGain();
    reverbGain = audioCtx.createGain();
    panNode = audioCtx.createStereoPanner();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    eqNodes = FREQUENCIES.map((f) => {
      const n = audioCtx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.gain.value = 0; // เดี๋ยวจะถูก set ใหม่ตาม params ด้านล่าง
      return n;
    });

    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createImpulseResponse(3.0, 2.0);

    // [สำคัญ] ตั้งค่าเริ่มต้นจาก params ที่จำไว้ (Persistence)
    masterGain.gain.value = params.volume;
    reverbGain.gain.value = params.reverb;
    panNode.pan.value = params.pan;

    try {
      if (!SignalsmithStretch.wasLoaded) {
        SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
          "assets/libs/mjs/SignalsmithStretch.mjs"
        );
        SignalsmithStretch.wasLoaded = true;
      }
      stretch = await SignalsmithStretch(audioCtx);
      // ตั้งค่า Pitch จากที่จำไว้ทันที
      stretch.schedule({ active: true, rate: 1.0, semitones: params.pitch });
    } catch (err) {
      console.error("Stretch Load Error:", err);
    }

    // เชื่อมต่อ Nodes
    let lastNode = source;
    if (stretch) {
      source.connect(stretch);
      lastNode = stretch;
    }
    eqNodes.forEach((n, i) => {
      // Apply EQ จากที่จำไว้
      if (params.eq && params.eq[i] !== undefined) {
        n.gain.value = params.eq[i];
      }
      lastNode.connect(n);
      lastNode = n;
    });

    lastNode.connect(panNode);
    panNode.connect(masterGain);

    eqNodes[eqNodes.length - 1].connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    masterGain.connect(analyser);
    masterGain.connect(audioCtx.destination);

    // ถ้ามีการเซ็ต Visual mode ไว้ ให้เริ่ม loop
    setTimeout(loopVisualizer, 30);
  } catch (e) {
    console.error("Audio Engine Error:", e);
    currentTabId = null;
  }
}

function loopVisualizer() {
  if (!audioCtx || !analyser) return;
  if (params.visualMode === 3) return; // 3 = closed/stop

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
  // [สำคัญ] บันทึกค่าลง params เสมอ ไม่ว่า audioCtx จะมีหรือไม่
  if (key === "pitch") params.pitch = value;
  if (key === "reverb") params.reverb = value;
  if (key === "pan") params.pan = value;
  if (key === "volume") params.volume = value;
  if (key === "visualMode") params.visualMode = value;
  if (key === "isEqOn") params.isEqOn = value;
  if (key === "eq") {
    if (!params.eq) params.eq = new Array(10).fill(0);
    params.eq[index] = value;
  }

  // ถ้า Audio Engine ทำงานอยู่ ก็ให้ปรับค่า Node ด้วย
  if (!audioCtx) return;

  if (key === "pitch" && stretch) {
    updateStretch();
  }
  if (key === "reverb") {
    reverbGain.gain.value = value;
  }
  if (key === "pan") {
    panNode.pan.value = value;
  }
  if (key === "volume") {
    masterGain.gain.value = value;
  }
  if (key === "eq") {
    if (eqNodes[index]) eqNodes[index].gain.value = value;
  }
}

function updateStretch() {
  if (stretch) {
    stretch.schedule({ active: true, rate: 1.0, semitones: params.pitch });
  }
}

function createImpulseResponse(duration, decay) {
  if (!audioCtx) return null; // Safety check
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
    }
  }
  return impulse;
}
