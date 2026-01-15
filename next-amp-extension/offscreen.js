import { PitchProcessor } from "./pitch-processor.js";
import { AudioEffects } from "./audio-effects.js";
import { DBManager } from "./db-manager.js";
import { RTCServer } from "./modules/rtc-server.js";

const sessions = new Map();
const db = new DBManager();
const rtcServer = new RTCServer();

const createDefaultParams = () => ({
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
  eqPreset: "flat",
  reverbTime: 3.0,
  reverbDecay: 2.0,
  dynBoost: 40,
  dynLimit: 60,
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = msg.tabId;

  if (msg.type === "START_CAPTURE") {
    startAudio(
      msg.streamId,
      tabId,
      msg.latencyHint,
      msg.mode,
      msg.initialPreset,
      sendResponse
    );
    return true;
  } else if (msg.type === "START_RECORDING") {
    console.log(
      `[Message Received] Requesting START_RECORDING for Tab: ${tabId}`
    );

    const result = startRecording(tabId);

    if (result.success) {
      console.log("[Status] Recording Started Successfully");
      sendResponse(true);
    } else {
      console.error("[Error] Failed to start recording:", result.reason);

      sendResponse(false);
    }
    return true;
  } else if (msg.type === "STOP_RECORDING") {
    stopRecording(tabId);
    sendResponse(true);
  } else if (msg.type === "SET_PARAM") {
    if (msg.key === "reset") resetParams(tabId, msg.isShared);
    else updateParams(msg);
  } else if (msg.type === "SET_MODE") {
    const session = sessions.get(tabId);
    if (session) {
      session.mode = msg.mode;
      sendResponse(true);
    }
  } else if (msg.type === "GET_STATE") {
    const session = sessions.get(tabId);
    if (session) {
      const currentEq = session.effects
        ? session.effects.getEQNodes().map((n) => n.gain.value)
        : session.params.eq;

      const isRec =
        session.mediaRecorder && session.mediaRecorder.state === "recording";

      sendResponse({
        ...session.params,
        eqGains: currentEq,
        isAudioActive: true,
        activeTabId: tabId,
        isRecording: isRec,
        mode: session.mode,
      });
    } else {
      sendResponse({
        isAudioActive: false,
        ...createDefaultParams(),
        mode: null,
      });
    }
  } else if (msg.type === "STOP_CAPTURE") {
    stopAudio(tabId);
    sendResponse({ success: true });
  } else if (msg.type === "CHECK_ACTIVE_SESSIONS") {
    const otherSessions = Array.from(sessions.keys()).filter(
      (id) => id !== msg.currentTabId
    );
    sendResponse({
      hasActiveSession: otherSessions.length > 0,
      count: otherSessions.length,
      activeTabs: otherSessions,
    });
  } else if (msg.type === "START_WEBRTC_STREAM") {
    startWebRTC(msg.sourceTabId, msg.playerTabId);
  } else if (msg.type === "STOP_WEBRTC_STREAM") {
    rtcServer.stopSession(msg.sourceTabId);

    unmuteLocal(msg.sourceTabId);
  } else if (msg.type === "RTC_ANSWER") {
    rtcServer.handleAnswer(msg.sourceTabId, msg.answer);
  } else if (msg.type === "RTC_CANDIDATE") {
    rtcServer.handleCandidate(msg.sourceTabId, msg.candidate);
  }
});

async function startWebRTC(sourceTabId, playerTabId) {
  const session = sessions.get(sourceTabId);
  if (!session) return;

  await rtcServer.startSession(
    sourceTabId,
    playerTabId,
    session.recordingStreamDest.stream,
    session.audioCtx
  );

  if (session.masterNode) {
    try {
      session.masterNode.disconnect(session.audioCtx.destination);
    } catch (e) {}

    session.masterNode.connect(session.recordingStreamDest);
    session.masterNode.connect(session.analyser);
  }
}

function unmuteLocal(tabId) {
  const session = sessions.get(tabId);
  if (session && session.masterNode && session.audioCtx) {
    try {
      session.masterNode.connect(session.audioCtx.destination);
    } catch (e) {}
  }
}

async function startAudio(
  streamId,
  tabId,
  latencyHint = "interactive",
  initialMode = "shared",
  initialPreset = "flat",
  sendResponse
) {
  if (sessions.has(tabId)) {
    stopAudio(tabId);
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
      },
    });

    const audioCtx = new AudioContext({ latencyHint: latencyHint });
    const source = audioCtx.createMediaStreamSource(stream);
    const pitchProc = new PitchProcessor(audioCtx);
    await pitchProc.init();
    const effects = new AudioEffects(audioCtx);

    let head = source;
    if (pitchProc.getNode()) {
      source.connect(pitchProc.getNode());
      head = pitchProc.getNode();
    }
    effects.setInput(head);

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const master = effects.getMasterNode();
    master.connect(analyser);
    master.connect(audioCtx.destination);

    const recordingStreamDest = audioCtx.createMediaStreamDestination();
    recordingStreamDest.channelCount = 2;

    master.connect(recordingStreamDest);

    const defaultP = createDefaultParams();
    defaultP.eqPreset = initialPreset;

    const newSession = {
      audioCtx,
      stream,
      pitchProc,
      effects,
      analyser,
      recordingStreamDest,
      masterNode: master,
      mediaRecorder: null,
      recordedChunks: [],
      params: defaultP,
      visualLoopId: null,
      mode: initialMode,
    };

    setupRecorder(newSession, recordingStreamDest.stream);
    sessions.set(tabId, newSession);

    applyAllParams(newSession);

    startVisualizerLoop(tabId);
    sendResponse({ success: true });
  } catch (e) {
    console.error(`[Tab ${tabId}] Start Error:`, e);
    sendResponse({ success: false, error: e.message });
  }
}
function setupRecorder(session, stream) {
  try {
    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 256000 }
      : {};
    const mediaRecorder = new MediaRecorder(stream, options);
    session.mediaRecorder = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        session.recordedChunks.push(e.data);
        console.log(`[Recorder] Chunk received: ${e.data.size} bytes`);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log(
        `[Recorder] Stopping. Total chunks: ${session.recordedChunks.length}`
      );

      const blob = new Blob(session.recordedChunks, { type: "audio/webm" });
      console.log(
        `[Recorder] Blob created. Size: ${blob.size}, Type: ${blob.type}`
      );

      session.recordedChunks = [];
      try {
        if (blob.size === 0) {
          console.error("[Recorder Error] Blob size is 0. Nothing recorded.");
          return;
        }
        await db.saveRecording(blob);
        console.log("[Recorder] Saved to DB successfully");
        chrome.runtime.sendMessage({ type: "RECORDING_SAVED" }).catch(() => {});
      } catch (err) {
        console.error("Save Error:", err);
      }
    };
  } catch (e) {
    console.error("Recorder Setup Failed:", e);
  }
}
function startRecording(tabId) {
  console.log(`[Function] startRecording called for tab ${tabId}`);

  const session = sessions.get(tabId);

  if (!session) {
    console.warn(
      `[Fail] No session found for tab ${tabId}. Did you start Audio Capture?`
    );
    return { success: false, reason: "NO_SESSION" };
  }

  if (!session.mediaRecorder) {
    console.warn(`[Fail] MediaRecorder not initialized for tab ${tabId}`);
    return { success: false, reason: "NO_RECORDER" };
  }

  if (session.mediaRecorder.state !== "inactive") {
    console.warn(
      `[Fail] Recorder is busy. State: ${session.mediaRecorder.state}`
    );
    return { success: false, reason: "RECORDER_BUSY" };
  }

  try {
    session.recordedChunks = [];
    session.mediaRecorder.start(1000);
    console.log(`[Success] MediaRecorder started with 1000ms timeslice`);
    return { success: true };
  } catch (e) {
    console.error("[Exception] Error starting MediaRecorder:", e);
    return { success: false, reason: e.message };
  }
}

function stopRecording(tabId) {
  const session = sessions.get(tabId);
  if (
    session &&
    session.mediaRecorder &&
    session.mediaRecorder.state === "recording"
  ) {
    session.mediaRecorder.stop();
  }
}

function stopAudio(tabId) {
  rtcServer.stopSession(tabId);

  const session = sessions.get(tabId);
  if (!session) return;

  chrome.runtime
    .sendMessage({ type: "BG_RESET_DELAY", tabId: tabId })
    .catch(() => {});
  if (session.visualLoopId) clearTimeout(session.visualLoopId);
  if (session.stream)
    session.stream.getTracks().forEach((track) => track.stop());
  if (session.audioCtx) {
    try {
      session.audioCtx.close();
    } catch (e) {}
  }
  sessions.delete(tabId);
}

function updateParams(msg) {
  const { key, value, index, tabId, isShared } = msg;
  if (isShared) {
    sessions.forEach((session) => {
      if (session.mode === "shared")
        applyParamToSession(session, key, value, index);
    });
  } else {
    const session = sessions.get(tabId);
    if (session) applyParamToSession(session, key, value, index);
  }
}

function applyParamToSession(session, key, value, index) {
  const { params, effects, pitchProc } = session;
  if (key === "eq" && index !== null) params.eq[index] = value;
  else if (key in params) params[key] = value;

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
    case "eqPreset":
      params.eqPreset = value;
      break;
    case "reverbTime":
      params.reverbTime = value;
      effects.setReverbParams(params.reverbTime, params.reverbDecay);
      break;
    case "reverbDecay":
      params.reverbDecay = value;
      effects.setReverbParams(params.reverbTime, params.reverbDecay);
      break;
    case "dynBoost":
      params.dynBoost = value;
      effects.setDynamicsParams(params.dynBoost, params.dynLimit);
      break;
    case "dynLimit":
      params.dynLimit = value;
      effects.setDynamicsParams(params.dynBoost, params.dynLimit);
      break;
    case "visualMode":
      params.visualMode = value;
      break;
  }
}

function applyAllParams(session) {
  const { params, effects, pitchProc } = session;
  if (!effects) return;
  effects.setVolume(params.volume);
  effects.setPan(params.pan);
  effects.setReverb(params.reverb);
  effects.updateNormalize(params.normalize);
  params.eq.forEach((val, i) => effects.setEQ(i, val));
  effects.setEQEnabled(params.isEqOn);
  effects.setReverbParams(params.reverbTime, params.reverbDecay);
  effects.setDynamicsParams(params.dynBoost, params.dynLimit);
  if (pitchProc) pitchProc.setPitch(params.pitch);
}

function resetParams(tabId, isShared) {
  if (isShared) {
    sessions.forEach((session) => {
      if (session.mode === "shared") {
        session.params = createDefaultParams();
        applyAllParams(session);
      }
    });
  } else {
    const session = sessions.get(tabId);
    if (!session) return;
    session.params = createDefaultParams();
    applyAllParams(session);
  }
}

function startVisualizerLoop(tabId) {
  const loop = () => {
    const session = sessions.get(tabId);
    if (!session) return;
    const { analyser, params, audioCtx } = session;
    if (params.visualMode !== 3 && audioCtx.state === "running") {
      const data = new Uint8Array(analyser.frequencyBinCount);
      if (params.visualMode === 2) analyser.getByteTimeDomainData(data);
      else analyser.getByteFrequencyData(data);
      chrome.runtime
        .sendMessage({
          type: "VISUALIZER_DATA",
          data: Array.from(data),
          mode: params.visualMode,
          tabId: tabId,
        })
        .catch(() => {});
    }
    session.visualLoopId = setTimeout(loop, 30);
  };
  loop();
}
