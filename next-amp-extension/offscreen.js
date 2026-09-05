import { PitchProcessor } from "./pitch-processor.js";
import { AudioEffects } from "./audio-effects.js";
import { DBManager } from "./db-manager.js";
import { RTCServer } from "./modules/rtc-server.js";
import { REMOTE_UI } from "./remote/remote-ui-bundle.js";
import { AIVocalManager } from "./modules/ai-vocal/ai-vocal-manager.js";
import "./assets/js/peerjs.min.js";

const sessions = new Map();
const db = new DBManager();
const rtcServer = new RTCServer();

// --- PEERJS SETUP ---
let hostPeer = null;
let hostPeerId = null;

function initHostPeer() {
  if (hostPeer) return;
  hostPeer = new Peer(null, { debug: 1 });

  hostPeer.on("open", (id) => {
    console.log("[PeerJS] Host Ready. ID:", id);
    hostPeerId = id;
  });

  hostPeer.on("connection", (conn) => {
    conn.on("data", (data) => {
      if (data.type === "HANDSHAKE" && data.token) {
        mapConnectionToSession(conn, data.token, data.needUI);
      } else {
        handleRemoteCommand(conn, data);
      }
    });
    conn.on("close", () => cleanupConnection(conn));
    conn.on("error", () => cleanupConnection(conn));
  });
}

function mapConnectionToSession(conn, token, needUI = false) {
  for (const [tabId, session] of sessions.entries()) {
    if (session.remoteToken === token) {
      if (!session.remoteConns) session.remoteConns = [];
      session.remoteConns.push(conn);
      conn._targetTabId = tabId;

      if (needUI) {
        const currentEq = session.effects
          ? session.effects.getEQNodes().map((n) => n.gain.value)
          : session.params.eq;
        conn.send({
          type: "MOUNT_UI",
          css: REMOTE_UI.css,
          html: REMOTE_UI.html,
          js: REMOTE_UI.js,
          state: { ...session.params, eq: currentEq },
        });
      } else {
        syncStateToRemote(session, conn);
      }
      return;
    }
  }
  conn.close();
}

function cleanupConnection(conn) {
  if (conn._targetTabId) {
    const session = sessions.get(conn._targetTabId);
    if (session && session.remoteConns) {
      session.remoteConns = session.remoteConns.filter((c) => c !== conn);
    }
  }
}

function handleRemoteCommand(conn, data) {
  const tabId = conn._targetTabId;
  if (!tabId || !sessions.has(tabId)) return;

  if (data.type === "SET_PARAM") {
    // Update Params and Broadcast
    updateParams({
      ...data,
      tabId: tabId,
      isShared: false,
      source: "remote",
    });
  } else if (data.type === "GET_STATE") {
    const session = sessions.get(tabId);
    if (session) syncStateToRemote(session, conn);
  } else if (data.type === "PING") {
    conn.send({ type: "PONG", ts: data.ts });
  }
}

function syncStateToRemote(session, conn) {
  if (!session || !conn.open) return;
  const currentEq = session.effects
    ? session.effects.getEQNodes().map((n) => n.gain.value)
    : session.params.eq;

  conn.send({
    type: "SYNC_STATE",
    state: { ...session.params, eq: currentEq },
  });
}

// --- AUDIO LOGIC ---

const createDefaultParams = () => ({
  pitch: 0,
  reverb: 0,
  pan: 0,
  volume: 1.0,
  visualMode: 0,
  isEqOn: true,
  isAudioMasterOn: true, // Master status
  isVideoMasterOn: true, // Video status
  videoDelay: 0,
  videoQuality: "max",
  videoZoom: 1.0, // Zoom value
  videoRotate: 0, // Rotate value
  normalize: false,
  eq: new Array(10).fill(0),
  eqPreset: "flat",
  reverbTime: 3.0,
  reverbDecay: 2.0,
  dynBoost: 40,
  dynLimit: 60,
  isVocalOn: false,
  vocalMode: "bypass", // "bypass", "karaoke", "acapella"
  vocalDiff: 2,        // 1, 2, 3, 4
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = msg.tabId;

  if (msg.type === "START_CAPTURE") {
    initHostPeer();
    startAudio(
      msg.streamId,
      tabId,
      msg.latencyHint,
      msg.mode,
      msg.initialPreset,
      sendResponse,
      msg.sampleRate
    );
    return true;
  } else if (msg.type === "START_RECORDING") {
    const result = startRecording(tabId);
    sendResponse(result.success);
    return true;
  } else if (msg.type === "STOP_RECORDING") {
    stopRecording(tabId);
    sendResponse(true);
  } else if (msg.type === "SET_PARAM") {
    if (msg.key === "reset") resetParams(tabId, msg.isShared);
    else updateParams({ ...msg, source: "popup" });
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
        currentSampleRate: session.audioCtx ? session.audioCtx.sampleRate : null,
        vocalStatus: session.aiVocal ? session.aiVocal.getStatus() : "ORIGINAL",
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
    });
  } else if (msg.type === "GET_REMOTE_TOKEN") {
    const session = sessions.get(tabId);
    if (session && hostPeerId) {
      if (!session.remoteToken) {
        session.remoteToken = `tab-${tabId}-${Date.now().toString(36)}`;
      }
      sendResponse({ hostId: hostPeerId, token: session.remoteToken });
    } else {
      sendResponse({ error: "Session not ready" });
    }
    return true;
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
  latencyHint,
  initialMode,
  initialPreset,
  sendResponse,
  requestedSampleRate
) {
  if (sessions.has(tabId)) stopAudio(tabId);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
      },
    });

    // "interactive" latencyHint = tiny ~3ms buffers → audio thread runs 300+ times/sec.
    // "balanced" = ~20ms buffers → ~50 times/sec. Same perceived quality for pitch shift use case.
    // Cap at "balanced" minimum — "playback" is fine too but user-chosen; never allow "interactive".
    const safeLatency = latencyHint === "interactive" ? "balanced" : (latencyHint || "balanced");

    const ctxOptions = { latencyHint: safeLatency };
    if (requestedSampleRate && requestedSampleRate !== "auto") {
      const sr = parseInt(requestedSampleRate, 10);
      if (sr && !isNaN(sr) && sr > 0) {
        ctxOptions.sampleRate = sr;
      }
    } else if (!requestedSampleRate) {
      // Default to 44100 if unspecified (CD quality / lower CPU)
      ctxOptions.sampleRate = 44100;
    }
    // If requestedSampleRate === "auto", sampleRate is omitted so browser uses system default.

    const audioCtx = new AudioContext(ctxOptions);
    const source = audioCtx.createMediaStreamSource(stream);

    // NextAmp AI Vocal Separator (UVR-MDX-Net WebGL)
    const aiVocal = new AIVocalManager(audioCtx);
    aiVocal.onStatusChange = (status) => {
      chrome.runtime.sendMessage({
        type: "AI_VOCAL_STATUS",
        tabId: tabId,
        status: status
      }).catch(() => {});
    };
    const aiVocalNode = await aiVocal.init();

    const pitchProc = new PitchProcessor(audioCtx);
    await pitchProc.init();
    const effects = new AudioEffects(audioCtx);
    const effectsInput = effects.getInputNode(); // the GainNode at the start of the effects chain

    const defaultP = createDefaultParams();
    defaultP.eqPreset = initialPreset;

    // Initial graph:
    // source -> [aiVocalNode] -> [stretchNode] -> effectsInput
    const isPitchBypassed = defaultP.pitch === 0;
    const stretchNode = pitchProc.getNode();

    let prePitchNode = source;
    if (aiVocalNode) {
      source.connect(aiVocalNode);
      prePitchNode = aiVocalNode;
    }

    if (stretchNode && !isPitchBypassed) {
      prePitchNode.connect(stretchNode);
      stretchNode.connect(effectsInput);
    } else {
      prePitchNode.connect(effectsInput);
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const master = effects.getMasterNode();
    master.connect(analyser);
    master.connect(audioCtx.destination);

    const recordingStreamDest = audioCtx.createMediaStreamDestination();
    recordingStreamDest.channelCount = 2;
    master.connect(recordingStreamDest);

    const newSession = {
      audioCtx,
      stream,
      source,        // needed for pitch bypass rewiring
      aiVocal,       // AI Vocal Separator Manager
      effectsInput,  // the GainNode at the start of effects chain
      isPitchBypassed,
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
      remoteToken: null,
      remoteConns: [],
    };

    setupRecorder(newSession, recordingStreamDest.stream);
    sessions.set(tabId, newSession);

    applyAllParams(newSession);
    startVisualizerLoop(tabId);
    sendResponse({ success: true, sampleRate: audioCtx.sampleRate });
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
      if (e.data.size > 0) session.recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(session.recordedChunks, { type: "audio/webm" });
      session.recordedChunks = [];
      if (blob.size > 0) {
        await db.saveRecording(blob);
        chrome.runtime.sendMessage({ type: "RECORDING_SAVED" }).catch(() => {});
      }
    };
  } catch (e) {}
}

function startRecording(tabId) {
  const session = sessions.get(tabId);
  if (!session || !session.mediaRecorder)
    return { success: false, reason: "NO_RECORDER" };
  if (session.mediaRecorder.state !== "inactive")
    return { success: false, reason: "RECORDER_BUSY" };
  try {
    session.recordedChunks = [];
    session.mediaRecorder.start(1000);
    return { success: true };
  } catch (e) {
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
  if (session.remoteConns) session.remoteConns.forEach((c) => c.close());

  chrome.runtime
    .sendMessage({ type: "BG_RESET_DELAY", tabId: tabId })
    .catch(() => {});
  if (session.aiVocal) {
    try { session.aiVocal.destroy(); } catch (_) {}
  }
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
  const { key, value, index, tabId, isShared, source } = msg;
  const numTabId = Number(tabId);
  const session = sessions.get(tabId) || sessions.get(numTabId) || (sessions.size === 1 ? sessions.values().next().value : null);
  if (isShared) {
    let applied = false;
    sessions.forEach((s) => {
      if (s.mode === "shared") {
        applyParamToSession(s, key, value, index, source);
        applied = true;
      }
    });
    if (!applied && session) {
      applyParamToSession(session, key, value, index, source);
    }
  } else if (session) {
    applyParamToSession(session, key, value, index, source);
  }
}

function getKeyByValue(map, searchValue) {
  for (let [key, value] of map.entries()) {
    if (value === searchValue) return key;
  }
  return null;
}

function applyParamToSession(session, key, value, index, source) {
  const { params, effects, pitchProc } = session;
  if (key === "eq" && index !== null) params.eq[index] = value;
  else if (key in params) params[key] = value;

  // -- VIDEO TRANSFORM MERGE LOGIC --
  // (Resolves zoom override or rotate resetting zoom issue)
  const tId = getKeyByValue(sessions, session);

  if (key === "videoZoom" || key === "videoRotate") {
    try {
      chrome.storage.local.set({
        videoZoom: params.videoZoom,
        videoRotate: params.videoRotate,
      });
    } catch (_) {}
    if (tId && params.isVideoMasterOn) {
      chrome.runtime.sendMessage({
        type: "BG_RELAY_TO_TAB",
        tabId: Number(tId),
        payload: {
          type: "SET_VIDEO_ZOOM",
          scale: params.videoZoom,
          rotate: params.videoRotate,
          translateY: 0,
        },
      });
    }
  } else if (key === "videoDelay") {
    try {
      chrome.storage.local.set({ videoDelay: params.videoDelay });
    } catch (_) {}
    if (tId && params.isVideoMasterOn) {
      chrome.runtime.sendMessage({
        type: "BG_RELAY_TO_TAB",
        tabId: Number(tId),
        payload: { type: "SET_VIDEO_DELAY", value: params.videoDelay },
      });
    }
  } else if (key === "videoQuality") {
    try {
      chrome.storage.local.set({ videoQuality: params.videoQuality });
    } catch (_) {}
    if (tId) {
      chrome.runtime.sendMessage({
        type: "BG_RELAY_TO_TAB",
        tabId: Number(tId),
        payload: { type: "SET_VIDEO_QUALITY", value: params.videoQuality },
      });
    }
  }

  // -- AUDIO & TOGGLES --
  switch (key) {
    case "pitch":
      if (pitchProc && session.effectsInput) {
        const stretchNode = pitchProc.getNode();
        const inputNode = session.aiVocal && session.aiVocal.getNode() ? session.aiVocal.getNode() : session.source;

        if (value === 0) {
          // TRUE BYPASS: remove SignalsmithStretch from the render graph.
          // Browser stops scheduling the WASM worklet → CPU for pitch ≈ 0%.
          if (!session.isPitchBypassed) {
            session.isPitchBypassed = true;
            try { inputNode.disconnect(stretchNode); } catch (_) {}
            try { stretchNode.disconnect(session.effectsInput); } catch (_) {}
            try { inputNode.connect(session.effectsInput); } catch (_) {}
          }
        } else {
          // Restore path through pitch node
          if (session.isPitchBypassed) {
            session.isPitchBypassed = false;
            try { inputNode.disconnect(session.effectsInput); } catch (_) {}
            try { inputNode.connect(stretchNode); } catch (_) {}
            try { stretchNode.connect(session.effectsInput); } catch (_) {}
          }
          pitchProc.setPitch(value);
        }
      }
      break;
    case "isVocalOn":
      params.isVocalOn = !!value;
      if (session.aiVocal) {
        if (!params.isVocalOn) {
          session.aiVocal.unloadEngine();
        } else {
          if (params.vocalMode && params.vocalMode !== "bypass") {
            session.aiVocal.setMode(params.vocalMode);
          } else {
            session.aiVocal.preloadEngine();
          }
        }
      }
      break;
    case "vocalMode":
      params.vocalMode = value;
      if (session.aiVocal) {
        if (!params.isVocalOn) {
          session.aiVocal.setMode("bypass");
        } else {
          session.aiVocal.setMode(value);
        }
      }
      break;
    case "vocalDiff":
      params.vocalDiff = value;
      if (session.aiVocal) {
        session.aiVocal.setDiffLevel(value);
      }
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
    // Master On/Off = Mute/Unmute output (Keeps session alive while muting audio)
    case "isAudioMasterOn":
      if (value) {
        // Unmute: resume AudioContext (restarts all audio processing) then reconnect output
        session.audioCtx.resume().catch(() => {});
        try {
          session.masterNode.connect(session.audioCtx.destination);
        } catch (e) {}
      } else {
        // Mute: disconnect output first, then suspend AudioContext entirely.
        // suspend() stops the Web Audio render thread → CPU ≈ 0% for all audio nodes.
        try {
          session.masterNode.disconnect(session.audioCtx.destination);
        } catch (e) {}
        session.audioCtx.suspend().catch(() => {});
      }
      break;
    // Video On/Off = Reset Transform / Restore
    case "isVideoMasterOn":
      try { chrome.storage.local.set({ isVideoMasterOn: !!value }); } catch (_) {}
      if (tId) {
        const targetTab = Number(tId);
        if (value) {
          // Restore Values
          try {
            chrome.storage.local.set({
              videoZoom: params.videoZoom,
              videoRotate: params.videoRotate,
              videoDelay: params.videoDelay,
            });
          } catch (_) {}
          chrome.runtime.sendMessage({
            type: "BG_RELAY_TO_TAB",
            tabId: targetTab,
            payload: {
              type: "SET_VIDEO_ZOOM",
              scale: params.videoZoom,
              rotate: params.videoRotate,
              translateY: 0,
            },
          });
          chrome.runtime.sendMessage({
            type: "BG_RELAY_TO_TAB",
            tabId: targetTab,
            payload: { type: "SET_VIDEO_DELAY", value: params.videoDelay },
          });
        } else {
          // Reset but don't clear params
          try {
            chrome.storage.local.set({
              videoZoom: 1,
              videoRotate: 0,
              videoDelay: 0,
            });
          } catch (_) {}
          chrome.runtime.sendMessage({
            type: "BG_RELAY_TO_TAB",
            tabId: targetTab,
            payload: {
              type: "SET_VIDEO_ZOOM",
              scale: 1,
              rotate: 0,
              translateY: 0,
            },
          });
          chrome.runtime.sendMessage({
            type: "BG_RELAY_TO_TAB",
            tabId: targetTab,
            payload: { type: "SET_VIDEO_DELAY", value: 0 },
          });
        }
      }
      break;
  }

  // --- BROADCAST ---
  // 1. Popup
  if (source !== "popup") {
    if (tId) {
      chrome.runtime
        .sendMessage({
          type: "PARAM_UPDATE",
          tabId: tId,
          key,
          value,
          index,
        })
        .catch(() => {});
    }
  }
  // 2. Remote
  if (session.remoteConns && session.remoteConns.length > 0) {
    const updateMsg = { type: "UPDATE_PARAM", key, value, index };
    session.remoteConns.forEach((conn) => {
      if (conn.open) conn.send(updateMsg);
    });
  }
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

  // Apply pitch with bypass: same logic as applyParamToSession("pitch")
  if (pitchProc && session.effectsInput) {
    const stretchNode = pitchProc.getNode();
    const inputNode = session.aiVocal && session.aiVocal.getNode() ? session.aiVocal.getNode() : session.source;
    if (stretchNode) {
      if (params.pitch === 0) {
        if (!session.isPitchBypassed) {
          session.isPitchBypassed = true;
          try { inputNode.disconnect(stretchNode); } catch (_) {}
          try { stretchNode.disconnect(session.effectsInput); } catch (_) {}
          try { inputNode.connect(session.effectsInput); } catch (_) {}
        }
      } else {
        if (session.isPitchBypassed) {
          session.isPitchBypassed = false;
          try { inputNode.disconnect(session.effectsInput); } catch (_) {}
          try { inputNode.connect(stretchNode); } catch (_) {}
          try { stretchNode.connect(session.effectsInput); } catch (_) {}
        }
        pitchProc.setPitch(params.pitch);
      }
    }
  } else if (pitchProc) {
    pitchProc.setPitch(params.pitch);
  }

  // Apply AI Vocal parameters
  if (session.aiVocal) {
    if (params.vocalDiff) session.aiVocal.setDiffLevel(params.vocalDiff);
    if (!params.isVocalOn) {
      session.aiVocal.unloadEngine();
    } else {
      if (params.vocalMode && params.vocalMode !== "bypass") {
        session.aiVocal.setMode(params.vocalMode);
      } else {
        session.aiVocal.preloadEngine();
      }
    }
  }
}

function startVisualizerLoop(tabId) {
  // Track consecutive sendMessage failures — if popup is closed, back off to avoid
  // wasting CPU on 33 failed IPC calls/second.
  let failStreak = 0;
  const FAIL_LIMIT = 3;         // failures before backing off
  const BACKOFF_MS = 3000;      // pause duration when popup appears closed

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
        .then(() => {
          failStreak = 0; // popup is open, reset
          session.visualLoopId = setTimeout(loop, 30);
        })
        .catch(() => {
          failStreak++;
          if (failStreak >= FAIL_LIMIT) {
            // Popup appears closed — back off for 3s then retry
            failStreak = 0;
            session.visualLoopId = setTimeout(loop, BACKOFF_MS);
          } else {
            session.visualLoopId = setTimeout(loop, 30);
          }
        });
    } else {
      // visualMode=3 (off) or audioCtx not running — idle, check again in 500ms
      session.visualLoopId = setTimeout(loop, 500);
    }
  };
  loop();
}

