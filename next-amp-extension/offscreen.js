import { PitchProcessor } from "./pitch-processor.js";
import { AudioEffects } from "./audio-effects.js";

let audioCtx;
let globalStream = null;
let currentTabId = null;

// Modules
let pitchProc = null;
let effects = null;
let analyser = null;

let params = {
  pitch: 0,
  reverb: 0,
  pan: 0,
  volume: 1.0,
  visualMode: 0,
  isEqOn: true,
  videoDelay: 0,
  videoQuality: "max",
  normalize: false,
  eq: new Array(10).fill(0),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_CAPTURE") {
    startAudio(msg.streamId, msg.tabId, sendResponse);
    return true;
  } else if (msg.type === "SET_PARAM") {
    if (msg.key === "reset") {
      resetParams();
    } else {
      updateParams(msg);
    }
  } else if (msg.type === "GET_STATE") {
    const currentEq = effects
      ? effects.getEQNodes().map((n) => n.gain.value)
      : params.eq;
    const isActive = audioCtx && audioCtx.state === "running";
    sendResponse({
      ...params,
      eqGains: currentEq,
      isAudioActive: isActive,
      activeTabId: currentTabId,
    });
  } else if (msg.type === "STOP_CAPTURE") {
    stopAudio();
    sendResponse({ success: true });
  }
});

async function startAudio(streamId, tabId, sendResponse) {
  if (audioCtx || globalStream) stopAudio();
  currentTabId = tabId;

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
    const source = audioCtx.createMediaStreamSource(stream);

    // 1. Init Modules
    pitchProc = new PitchProcessor(audioCtx);
    await pitchProc.init();

    effects = new AudioEffects(audioCtx);

    // 2. Connect Graph: Source -> Stretch -> Effects -> Dest
    let head = source;

    // ต่อ Pitch Shift (ถ้าโหลดผ่าน)
    if (pitchProc.getNode()) {
      source.connect(pitchProc.getNode());
      head = pitchProc.getNode(); // เปลี่ยนหัวขบวนเป็น Stretch Node
    }

    // ต่อเข้า Effects Chain
    effects.setInput(head);

    // ต่อ Analyzer (สำหรับ Visualizer)
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    // Master -> Analyzer -> Destination
    const master = effects.getMasterNode();
    master.connect(analyser);
    master.connect(audioCtx.destination);

    // 3. Apply Initial Params
    applyAllParams();

    // Start Loops
    if (pitchProc) pitchProc.setPitch(params.pitch);
    setTimeout(loopVisualizer, 30);

    sendResponse({ success: true });
  } catch (e) {
    console.error("Audio Engine Error:", e);
    currentTabId = null;
    sendResponse({ success: false, error: e.message });
  }
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
  pitchProc = null;
  effects = null;
  currentTabId = null;
}
// ในฟังก์ชัน updateParams ของ offscreen.js

function updateParams({ key, value, index }) {
  // Update local state
  if (key === "eq" && index !== null) params.eq[index] = value;
  else if (key in params) params[key] = value;

  if (!audioCtx || !effects) return;

  // Delegate to modules
  switch (key) {
    case "pitch":
      if (pitchProc) pitchProc.setPitch(value);
      break;
    case "volume":
      effects.setVolume(value);
      break;
    case "pan":
      effects.setPan(value);
      break;
    case "reverb":
      effects.setReverb(value);
      break;
    case "normalize":
      effects.updateNormalize(value);
      break;
    case "eq":
      effects.setEQ(index, value);
      break;
    case "isEqOn":
      effects.setEQEnabled(value);
      break;
  }
}

function applyAllParams() {
  if (!effects) return;
  effects.setVolume(params.volume);
  effects.setPan(params.pan);
  effects.setReverb(params.reverb);
  effects.updateNormalize(params.normalize);
  params.eq.forEach((val, i) => effects.setEQ(i, val));
}

function resetParams() {
  // Reset state object
  params = {
    pitch: 0,
    reverb: 0,
    pan: 0,
    volume: 1.0,
    visualMode: 0,
    isEqOn: true,
    videoDelay: 0,
    videoQuality: "max",
    normalize: false,
    eq: new Array(10).fill(0),
  };
  applyAllParams();
  if (pitchProc) pitchProc.setPitch(0);
}

function loopVisualizer() {
  if (!audioCtx || !analyser) return;
  if (params.visualMode === 3) return; // Mode ปิด

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
