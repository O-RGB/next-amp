import { PitchProcessor } from "./pitch-processor.js";
import { AudioEffects } from "./audio-effects.js";
import { DBManager } from "./db-manager.js";

let audioCtx;
let globalStream = null;
let currentTabId = null;

let pitchProc = null;
let effects = null;
let analyser = null;

let mediaRecorder = null;
let recordedChunks = [];
let recordingStreamDest = null;
const db = new DBManager();

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
    startAudio(msg.streamId, msg.tabId, msg.latencyHint, sendResponse);
    return true;
  } else if (msg.type === "START_RECORDING") {
    startRecording();
    sendResponse(true);
  } else if (msg.type === "STOP_RECORDING") {
    stopRecording();
    sendResponse(true);
  } else if (msg.type === "SET_PARAM") {
    if (msg.key === "reset") resetParams();
    else updateParams(msg);
  } else if (msg.type === "GET_STATE") {
    const currentEq = effects
      ? effects.getEQNodes().map((n) => n.gain.value)
      : params.eq;
    const isRec = mediaRecorder && mediaRecorder.state === "recording";
    sendResponse({
      ...params,
      eqGains: currentEq,
      isAudioActive: !!audioCtx,
      activeTabId: currentTabId,
      isRecording: isRec,
    });
  } else if (msg.type === "STOP_CAPTURE") {
    stopAudio();
    sendResponse({ success: true });
  }
});

async function startAudio(
  streamId,
  tabId,
  latencyHint = "interactive",
  sendResponse
) {
  if (audioCtx || globalStream) stopAudio();
  currentTabId = tabId;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
      },
    });

    globalStream = stream;

    audioCtx = new AudioContext({ latencyHint: latencyHint });
    const source = audioCtx.createMediaStreamSource(stream);

    pitchProc = new PitchProcessor(audioCtx);
    await pitchProc.init();
    effects = new AudioEffects(audioCtx);

    let head = source;
    if (pitchProc.getNode()) {
      source.connect(pitchProc.getNode());
      head = pitchProc.getNode();
    }
    effects.setInput(head);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const master = effects.getMasterNode();

    master.connect(analyser);
    master.connect(audioCtx.destination);

    recordingStreamDest = audioCtx.createMediaStreamDestination();
    master.connect(recordingStreamDest);
    setupRecorder(recordingStreamDest.stream);

    applyAllParams();
    if (pitchProc) pitchProc.setPitch(params.pitch);
    setTimeout(loopVisualizer, 30);

    sendResponse({ success: true });
  } catch (e) {
    console.error("Engine Start Error:", e);
    currentTabId = null;
    sendResponse({ success: false, error: e.message });
  }
}

function setupRecorder(stream) {
  try {
    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus" }
      : {};

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      recordedChunks = [];

      try {
        await db.saveRecording(blob);
        chrome.runtime.sendMessage({ type: "RECORDING_SAVED" }).catch(() => {});
      } catch (err) {
        console.error("Save Error:", err);
      }
    };
  } catch (e) {
    console.error("Recorder Setup Failed:", e);
  }
}

function startRecording() {
  if (mediaRecorder && mediaRecorder.state === "inactive") {
    recordedChunks = [];
    mediaRecorder.start();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

function stopAudio() {
  if (currentTabId) {
    chrome.runtime
      .sendMessage({
        type: "BG_RESET_DELAY",
        tabId: currentTabId,
      })
      .catch(() => {});
  }

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
  mediaRecorder = null;
  recordingStreamDest = null;
}

function updateParams({ key, value, index }) {
  if (key === "eq" && index !== null) params.eq[index] = value;
  else if (key in params) params[key] = value;
  if (!audioCtx || !effects) return;
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
  if (params.visualMode === 3) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  if (params.visualMode === 2) analyser.getByteTimeDomainData(data);
  else analyser.getByteFrequencyData(data);
  chrome.runtime
    .sendMessage({
      type: "VISUALIZER_DATA",
      data: Array.from(data),
      mode: params.visualMode,
    })
    .catch(() => {});
  setTimeout(loopVisualizer, 30);
}
