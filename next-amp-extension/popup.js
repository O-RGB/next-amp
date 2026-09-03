import { DBManager } from "./db-manager.js";
import { $, $$, sendMessageWithRetry } from "./assets/js/utils.js";
import { SessionManager } from "./modules/session-manager.js";
import { SettingsModal } from "./modules/settings-modal.js";

const ITTY_BITTY_HASH =
  "NextAmp-DOS/data:text/html;charset=utf-8;bxze64,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";
const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const LABELS = [
  "60",
  "170",
  "310",
  "600",
  "1k",
  "3k",
  "6k",
  "12k",
  "14k",
  "16k",
];
const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  pop: [2, 1, 3, 2, 1, 0, 1, 2, 2, 1],
  voice: [-2, -1, 0, 2, 4, 4, 3, 1, 0, 0],
};

let isAudioMasterOn = true;
let isVideoMasterOn = true;

let isEqOn = true;

let isNormalizeOn = false;
let currentEqValues = [...PRESETS.flat];
let visualMode = 0;
let isRecording = false;
let db = new DBManager();
let currentTabId = null;

let sessionManager;
let settingsModal;

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) currentTabId = tab.id;

  sessionManager = new SessionManager(currentTabId);
  settingsModal = new SettingsModal(db, {
    onThemeChange: applyTheme,
    onSettingChange: (obj) => {
      sessionManager.setSetting(obj);
      if (obj.sampleRate !== undefined || obj.latencyHint !== undefined) {
        if (isAudioMasterOn && currentTabId) {
          initCapture(sessionManager.sessionMode);
        }
      }
    },
    onReset: handleReset,
    onSendParam: (k, v) => sendParam(k, v),
    onToggleRecord: toggleRecording,
  });

  renderNewEQSystem();
  setupListeners();
  setupStorageListener();
  setupRemoteUI();

  await sessionManager.init(async () => {
    settingsModal.init();
    await finalizeInitialization();
  });
});

async function finalizeInitialization() {
  await loadUserPreferences();
  try {
    await db.open();
    settingsModal.renderRecordingList();
  } catch (e) {}

  const savedToggles = await sessionManager.getSetting([
    "isAudioMasterOn",
    "isVideoMasterOn",
    "isEqOn",
  ]);
  if (savedToggles.isAudioMasterOn !== undefined)
    isAudioMasterOn = savedToggles.isAudioMasterOn;
  if (savedToggles.isVideoMasterOn !== undefined)
    isVideoMasterOn = savedToggles.isVideoMasterOn;
  if (savedToggles.isEqOn !== undefined) isEqOn = savedToggles.isEqOn;

  if (sessionManager.sessionMode === "shared") {
    // [NEW] เพิ่ม videoPosX และ videoPosY ในการโหลด
    const sharedParams = await chrome.storage.local.get([
      "volume",
      "pan",
      "pitch",
      "reverb",
      "eq",
      "eqPreset",
      "normalize",
      "videoZoom",
      "videoRotate",
      "videoDelay",
      "videoPosX",
      "videoPosY",
      "isEqOn",
      "reverbTime",
      "reverbDecay",
      "dynBoost",
      "dynLimit",
    ]);

    if (Object.keys(sharedParams).length > 0) {
      if (sharedParams.volume !== undefined) {
        updateSlider(
          "#main-vol",
          "#txt-vol",
          sharedParams.volume,
          (v) => Math.round(v * 100) + "%"
        );
      }
      if (sharedParams.pan !== undefined) {
        updateSlider("#main-pan", "#txt-pan", sharedParams.pan, (v) =>
          v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C"
        );
      }
      if (sharedParams.pitch !== undefined) {
        updateSlider(
          "#main-pitch",
          "#txt-pitch",
          sharedParams.pitch,
          (v) => (v > 0 ? "+" : "") + v
        );
      }
      if (sharedParams.reverb !== undefined) {
        updateSlider("#main-verb", "#txt-verb", sharedParams.reverb, (v) =>
          v.toFixed(1)
        );
      }
      if (sharedParams.eqPreset) {
        $("#eq-preset").value = sharedParams.eqPreset;
      }
      if (sharedParams.eq) {
        currentEqValues = sharedParams.eq;
        $$(".eq-slider").forEach((inp, i) => {
          inp.value = currentEqValues[i];
        });
        updateEQVisuals();
      }
      if (sharedParams.normalize !== undefined) {
        isNormalizeOn = sharedParams.normalize;
        updateNormalizeButton();
      }
      if (sharedParams.vocalMode) {
        updateVocalUI(sharedParams.vocalMode);
      }

      if (sharedParams.reverbTime)
        $("#adv-rev-time").value = sharedParams.reverbTime;
      if (sharedParams.reverbDecay)
        $("#adv-rev-decay").value = sharedParams.reverbDecay;
      if (sharedParams.dynBoost)
        $("#adv-dyn-boost").value = sharedParams.dynBoost;
      if (sharedParams.dynLimit)
        $("#adv-dyn-limit").value = sharedParams.dynLimit;

      if (sharedParams.videoZoom)
        $("#video-zoom").value = sharedParams.videoZoom;
      if (sharedParams.videoRotate)
        $("#video-rotate").value = sharedParams.videoRotate;

      // [NEW] Load Position
      if (sharedParams.videoPosX)
        $("#video-pos-x").value = sharedParams.videoPosX;
      if (sharedParams.videoPosY)
        $("#video-pos-y").value = sharedParams.videoPosY;

      if (sharedParams.videoDelay) {
        $("#video-delay").value = sharedParams.videoDelay;
        $("#num-video-delay").value = parseFloat(
          sharedParams.videoDelay
        ).toFixed(2);
      }
      syncVideoTransform();
    }
  } else if (sessionManager.sessionMode === "temp") {
    $("#video-zoom").value = sessionManager.tempStorage.videoZoom || 1;
    $("#video-rotate").value = sessionManager.tempStorage.videoRotate || 0;
    $("#video-pos-x").value = sessionManager.tempStorage.videoPosX || 0;
    $("#video-pos-y").value = sessionManager.tempStorage.videoPosY || 0;
    syncVideoTransform();
  }

  const state = await sendMessageWithRetry({
    type: "GET_STATE",
    tabId: currentTabId,
  });

  if (state && state.isAudioActive) {
    loadAudioState(state);
    isAudioMasterOn = true;
  } else {
    if (isAudioMasterOn) {
      initCapture(sessionManager.sessionMode);
    }
  }

  updateMasterTogglesUI();
  updateEqToggleButton();

  let frameCount = 0;
  const loop = () => {
    drawEQGraph(currentEqValues);
    frameCount++;
    if (frameCount < 60) requestAnimationFrame(loop);
  };
  loop();
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (
      namespace === "local" &&
      sessionManager &&
      sessionManager.sessionMode === "shared"
    ) {
      if (changes.volume) {
        const v = changes.volume.newValue;
        $("#main-vol").value = v;
        $("#txt-vol").textContent = Math.round(v * 100) + "%";
      }
      if (changes.pan) {
        const v = changes.pan.newValue;
        $("#main-pan").value = v;
        $("#txt-pan").textContent =
          v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
      }
      if (changes.pitch) {
        const v = changes.pitch.newValue;
        $("#main-pitch").value = v;
        $("#txt-pitch").textContent = (v > 0 ? "+" : "") + v;
      }
      if (changes.reverb) {
        const v = changes.reverb.newValue;
        $("#main-verb").value = v;
        $("#txt-verb").textContent = v.toFixed(1);
      }
      if (changes.eqPreset) {
        $("#eq-preset").value = changes.eqPreset.newValue;
      }
      if (changes.eq) {
        currentEqValues = changes.eq.newValue;
        $$(".eq-slider").forEach((inp, i) => {
          inp.value = currentEqValues[i];
        });
        updateEQVisuals();
      }
      if (changes.isEqOn) {
        isEqOn = changes.isEqOn.newValue;
        updateEqToggleButton();
      }
    }
  });
}

async function shortenUrl(longUrl) {
  // 1. Try spoo.me (instant 302 redirect, no interstitial warning)
  try {
    const res = await fetch("https://spoo.me/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ url: longUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.short_url) {
        return data.short_url.replace(/^http:\/\//, "https://");
      }
    }
  } catch (e) {
    console.warn("spoo.me failed, trying fallback:", e);
  }

  // 2. Fallback: da.gd
  try {
    const res = await fetch("https://da.gd/s", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url: longUrl }),
    });
    if (res.ok) {
      const short = (await res.text()).trim();
      if (short.startsWith("http")) return short;
    }
  } catch (e) {
    console.warn("da.gd fallback failed:", e);
  }

  // 3. If shortening fails, return raw URL
  return longUrl;
}

async function buildMicroBootloaderUrl(hostId, token) {
  const bootloader = `Loading...<script src=https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js></script><script>let H=${JSON.stringify(hostId)},T=${JSON.stringify(token)},p=new Peer(),c;p.on('open',()=>{c=p.connect(H,{reliable:1});c.on('open',()=>c.send({type:'HANDSHAKE',token:T,needUI:1}));c.on('data',d=>{if(d.type==='MOUNT_UI'){if(d.css)document.head.appendChild(document.createElement('style')).textContent=d.css;document.body.innerHTML=d.html;if(d.js)(new Function('conn','initState','H','T','peer',d.js))(c,d.state,H,T,p);}});});<\/script>`;

  // Compress using native browser CompressionStream("deflate")
  const stream = new Blob([bootloader]).stream().pipeThrough(new CompressionStream("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);

  return `https://itty.bitty.site/#NextAmp/data:text/html;charset=utf-8;format=gz;base64,${b64}`;
}

async function setupRemoteUI() {
  const btnConnect = $("#btn-remote-connect");
  const qrOverlay = $("#qr-overlay");
  const qrImage = $("#qr-image");
  const urlDisplay = $("#remote-url-display");
  const btnCloseQr = $("#btn-close-qr");
  const btnCopyUrl = $("#btn-copy-url");

  btnConnect.addEventListener("click", async () => {
    try {
      let hasOffscreen = await sendMessageWithRetry({
        type: "CHECK_OFFSCREEN",
      });
      if (!hasOffscreen) {
        await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
        await new Promise((r) => setTimeout(r, 500));
      }

      const res = await sendMessageWithRetry({
        type: "GET_REMOTE_TOKEN",
        tabId: currentTabId,
      });

      if (res && res.hostId && res.token) {
        const elId = $("#remote-id-display");
        const elTok = $("#remote-token-display");
        if (elId) elId.textContent = res.hostId;
        if (elTok) elTok.textContent = res.token;

        urlDisplay.value = "Generating remote...";
        qrOverlay.classList.remove("hidden");

        const fullUrl = await buildMicroBootloaderUrl(res.hostId, res.token);
        urlDisplay.value = "Shortening link...";
        const finalUrl = await shortenUrl(fullUrl);

        urlDisplay.value = finalUrl;
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
          finalUrl
        )}`;
        qrImage.src = qrApi;
      } else {
        alert("Remote ID not ready. Please turn Audio Master ON first.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to connect remote.");
    }
  });

  btnCloseQr.addEventListener("click", () => {
    qrOverlay.classList.add("hidden");
  });

  btnCopyUrl.addEventListener("click", () => {
    urlDisplay.select();
    document.execCommand("copy");
    const oldText = btnCopyUrl.textContent;
    btnCopyUrl.textContent = "COPIED!";
    setTimeout(() => (btnCopyUrl.textContent = oldText), 1000);
  });
}

function updateSlider(selector, textSelector, value, textFormatter) {
  const el = $(selector);
  if (el) {
    el.value = value;
    $(textSelector).textContent = textFormatter(value);
  }
}

async function loadUserPreferences() {
  const data = await sessionManager.getSetting([
    "theme",
    "startupVol",
    "latencyHint",
    "sampleRate",
    "showStats",
  ]);
  if (data.theme) applyTheme(data.theme);
  settingsModal.setValues(data);
}

function applyTheme(colorCode) {
  if (!colorCode) return;
  let winColor, textColor, textSec;
  if (colorCode === "blue") {
    winColor = "#000080";
    textColor = "#00ff00";
    textSec = "#ffcc00";
  } else if (colorCode === "red") {
    winColor = "#800000";
    textColor = "#ff0000";
    textSec = "#ffaaaa";
  } else if (colorCode === "green") {
    winColor = "#005000";
    textColor = "#00ff00";
    textSec = "#aaffaa";
  }
  if (winColor) {
    const r = document.documentElement;
    r.style.setProperty("--theme-window", winColor);
    r.style.setProperty("--theme-text", textColor);
    r.style.setProperty("--theme-text-sec", textSec);
    $$(".theme-box").forEach(
      (b) =>
        (b.style.border =
          b.dataset.theme === colorCode ? "2px solid white" : "1px solid #666")
    );
    updateNormalizeButton();
  }
}

async function initCapture(mode) {
  if (!currentTabId) return;
  let hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
  if (!hasOffscreen) {
    await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
    await new Promise((r) => setTimeout(r, 1000));
  }
  const latencyHint = $("#sel-latency")?.value || "balanced";
  const sampleRate = $("#sel-sample-rate")?.value || "44100";
  const preset = $("#eq-preset").value || "flat";

  chrome.tabCapture.getMediaStreamId(
    { targetTabId: currentTabId },
    (streamId) => {
      if (chrome.runtime.lastError || !streamId) return;
      chrome.runtime
        .sendMessage({
          type: "START_CAPTURE",
          streamId,
          tabId: currentTabId,
          latencyHint: latencyHint,
          sampleRate: sampleRate,
          mode: mode,
          initialPreset: preset,
        })
        .then((res) => {
          if (res && res.sampleRate) {
            settingsModal.updateActiveSampleRate(res.sampleRate);
          }
          sendParam("volume", parseFloat($("#main-vol").value));
          sendParam("pan", parseFloat($("#main-pan").value));
          sendParam("pitch", parseInt($("#main-pitch").value));
          sendParam("reverb", parseFloat($("#main-verb").value));
          sendParam("normalize", isNormalizeOn);
          sendParam("eqPreset", preset);
          sendParam("isEqOn", isEqOn);
          currentEqValues.forEach((val, i) => sendParam("eq", val, i));
          sendParam("reverbTime", parseFloat($("#adv-rev-time").value));
          sendParam("reverbDecay", parseFloat($("#adv-rev-decay").value));
          sendParam("dynBoost", parseFloat($("#adv-dyn-boost").value));
          sendParam("dynLimit", parseFloat($("#adv-dyn-limit").value));
          sendParam("videoDelay", parseFloat($("#video-delay")?.value || 0));
          sendParam("videoZoom", parseFloat($("#video-zoom")?.value || 1));
          sendParam("videoRotate", parseFloat($("#video-rotate")?.value || 0));
          sendParam("videoQuality", $("#video-quality")?.value || "max");
          sendParam("isVideoMasterOn", isVideoMasterOn);
        })
        .catch((e) => console.warn(e));
    }
  );
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PARAM_UPDATE") {
    if (currentTabId && msg.tabId === currentTabId) {
      updateUIFromExternal(msg.key, msg.value, msg.index);
    }
  } else if (msg.type === "VISUALIZER_DATA") {
    if (currentTabId && msg.tabId === currentTabId)
      drawVisualizer(msg.data, msg.mode);
  } else if (msg.type === "AI_VOCAL_STATUS") {
    const txtStatus = $("#txt-vocal-status");
    if (txtStatus) {
      txtStatus.textContent = msg.status;
      txtStatus.title = "AI Vocal: " + msg.status;
    }
  } else if (msg.type === "RECORDING_SAVED") {
    handleRecordingSaved();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.aiVocalStatus && changes.aiVocalStatus.newValue) {
    const txtStatus = $("#txt-vocal-status");
    if (txtStatus) {
      txtStatus.textContent = changes.aiVocalStatus.newValue;
      txtStatus.title = "AI Vocal: " + changes.aiVocalStatus.newValue;
    }
  }
});

function updateVocalUI(mode) {
  const btnBypass = $("#btn-vocal-bypass");
  const btnKaraoke = $("#btn-vocal-karaoke");
  const btnAcapella = $("#btn-vocal-acapella");
  const btnToggle = $("#btn-toggle-vocal");

  if (!btnBypass || !btnKaraoke || !btnAcapella) return;

  [btnBypass, btnKaraoke, btnAcapella].forEach((btn) => {
    btn.classList.remove("pressed");
    btn.classList.add("text-black", "font-bold");
  });

  if (mode === "karaoke") {
    btnKaraoke.classList.add("pressed");
    if (btnToggle) btnToggle.classList.add("pressed");
  } else if (mode === "acapella") {
    btnAcapella.classList.add("pressed");
    if (btnToggle) btnToggle.classList.add("pressed");
  } else {
    btnBypass.classList.add("pressed");
    if (btnToggle) btnToggle.classList.remove("pressed");
  }
}

function updateDiffUI(level) {
  const lvl = Number(level) || 2;
  $$(".btn-diff").forEach((btn) => {
    if (Number(btn.dataset.level) === lvl) {
      btn.classList.add("pressed");
    } else {
      btn.classList.remove("pressed");
    }
  });
}

function updateUIFromExternal(key, value, index) {
  if (key === "volume") {
    updateSlider(
      "#main-vol",
      "#txt-vol",
      value,
      (v) => Math.round(v * 100) + "%"
    );
  } else if (key === "pan") {
    updateSlider("#main-pan", "#txt-pan", value, (v) =>
      v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C"
    );
  } else if (key === "pitch") {
    updateSlider(
      "#main-pitch",
      "#txt-pitch",
      value,
      (v) => (v > 0 ? "+" : "") + v
    );
  } else if (key === "reverb") {
    updateSlider("#main-verb", "#txt-verb", value, (v) =>
      parseFloat(v).toFixed(1)
    );
  } else if (key === "eq" && index !== null) {
    currentEqValues[index] = value;
    const slider = document.querySelector(`.eq-slider[data-idx="${index}"]`);
    if (slider) slider.value = value;
    updateEQVisuals();
  } else if (key === "eqPreset") {
    $("#eq-preset").value = value;
  } else if (key === "isEqOn") {
    isEqOn = value;
    updateEqToggleButton();
  } else if (key === "videoDelay") {
    $("#video-delay").value = value;
    $("#num-video-delay").value = parseFloat(value).toFixed(2);
  } else if (key === "videoZoom") {
    $("#video-zoom").value = value;
    $("#txt-zoom").textContent = Math.round(value * 100) + "%";
  } else if (key === "videoRotate") {
    $("#video-rotate").value = value;
    $("#txt-rotate").textContent = value + "°";
  } else if (key === "videoPosX") {
    // [NEW] Update UI from Remote
    $("#video-pos-x").value = value;
    syncVideoTransform();
  } else if (key === "videoPosY") {
    // [NEW] Update UI from Remote
    $("#video-pos-y").value = value;
    syncVideoTransform();
  } else if (key === "videoQuality") {
    const el = $("#video-quality");
    if (el) el.value = value;
  } else if (key === "isVideoMasterOn") {
    isVideoMasterOn = value;
    updateMasterTogglesUI();
  } else if (key === "normalize") {
    isNormalizeOn = value;
    updateNormalizeButton();
  } else if (key === "vocalMode") {
    updateVocalUI(value);
  } else if (key === "vocalDiff") {
    updateDiffUI(value);
  }
}
function sendParam(key, value, index = null) {
  const isShared = sessionManager.sessionMode === "shared";
  chrome.runtime
    .sendMessage({
      type: "SET_PARAM",
      key,
      value,
      index,
      tabId: currentTabId,
      isShared: isShared,
    })
    .catch(() => {});
  if (isShared) {
    if (key === "eq" && index !== null) {
      currentEqValues[index] = value;
      chrome.storage.local.set({ eq: currentEqValues });
    } else {
      chrome.storage.local.set({ [key]: value });
    }
  }
}

async function toggleRecording() {
  const btnRecTop = $("#btn-rec-top");
  const recIndicator = $("#rec-indicator");
  if (!isRecording) {
    const success = await sendMessageWithRetry({
      type: "START_RECORDING",
      tabId: currentTabId,
    });
    if (success) {
      isRecording = true;
      settingsModal.updateRecordStatus(true);
      btnRecTop.textContent = "STOP";
      btnRecTop.classList.remove("text-red-900");
      btnRecTop.classList.add("bg-red-600", "text-white");
      if (recIndicator) recIndicator.classList.remove("hidden");
    }
  } else {
    isRecording = false;
    settingsModal.updateRecordStatus(false);
    if (recIndicator) recIndicator.classList.add("hidden");

    await sendMessageWithRetry({
      type: "STOP_RECORDING",
      tabId: currentTabId,
    });
    btnRecTop.textContent = "REC";
    btnRecTop.classList.remove("bg-red-600", "text-white");
    btnRecTop.classList.add("text-red-900");
  }
}

async function handleRecordingSaved() {
  const btnRecTop = $("#btn-rec-top");
  const recIndicator = $("#rec-indicator");
  settingsModal.updateRecordStatus(false);
  if (btnRecTop) {
    btnRecTop.textContent = "REC";
    btnRecTop.classList.remove("bg-red-600", "text-white");
    btnRecTop.classList.add("text-red-900");
  }
  if (recIndicator) recIndicator.classList.add("hidden");
  await settingsModal.renderRecordingList();
  settingsModal.showRecordingSaved();
  isRecording = false;
}

function setupListeners() {
  $("#btn-toggle-audio").addEventListener("click", () => {
    isAudioMasterOn = !isAudioMasterOn;
    updateMasterTogglesUI();
    sessionManager.setSetting({ isAudioMasterOn });

    if (isAudioMasterOn) {
      initCapture(sessionManager.sessionMode);
    } else {
      if (currentTabId) {
        sendMessageWithRetry({ type: "STOP_CAPTURE", tabId: currentTabId });

        chrome.runtime.sendMessage({
          type: "BG_RESET_DELAY",
          tabId: currentTabId,
        });
      }
    }
    updateEQVisuals();
  });

  $("#btn-toggle-video").addEventListener("click", () => {
    isVideoMasterOn = !isVideoMasterOn;
    updateMasterTogglesUI();
    sessionManager.setSetting({ isVideoMasterOn });
    sendParam("isVideoMasterOn", isVideoMasterOn);
    if (isVideoMasterOn) {
      syncVideoTransform();
      const d = parseFloat($("#video-delay").value);
      if (currentTabId)
        chrome.tabs
          .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: d })
          .catch(() => {});
    } else {
      if (currentTabId) {
        chrome.tabs
          .sendMessage(currentTabId, {
            type: "SET_VIDEO_ZOOM",
            scale: 1,
            rotate: 0,
            translateX: 0, // [NEW] Reset X
            translateY: 0, // [NEW] Reset Y
          })
          .catch(() => {});
        chrome.tabs
          .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: 0 })
          .catch(() => {});
      }
    }
  });

  $("#btn-open-player").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_PLAYER_TAB",
      sourceTabId: currentTabId,
    });
  });

  $("#btn-eq-toggle").addEventListener("click", () => {
    if (!isAudioMasterOn) return;
    isEqOn = !isEqOn;
    sessionManager.setSetting({ isEqOn });
    updateEqToggleButton();
    sendParam("isEqOn", isEqOn);
    updateEQVisuals();
  });

  $("#main-vol").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseFloat(e.target.value);
    $("#txt-vol").textContent = Math.round(v * 100) + "%";
    sendParam("volume", v);
  });
  $("#main-pan").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseFloat(e.target.value);
    $("#txt-pan").textContent =
      v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
    sendParam("pan", v);
  });
  $("#main-pitch").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseInt(e.target.value);
    $("#txt-pitch").textContent = (v > 0 ? "+" : "") + v;
    sendParam("pitch", v);
  });
  $("#main-verb").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseFloat(e.target.value);
    $("#txt-verb").textContent = v.toFixed(1);
    sendParam("reverb", v);
  });

  $("#btn-normalize")?.addEventListener("click", () => {
    isNormalizeOn = !isNormalizeOn;
    updateNormalizeButton();
    sendParam("normalize", isNormalizeOn);
  });

  // --- AI VOCAL SEPARATOR CONTROLS ---
  $("#btn-toggle-vocal")?.addEventListener("click", () => {
    const isPressed = $("#btn-toggle-vocal").classList.contains("pressed");
    const nextMode = isPressed ? "bypass" : "karaoke";
    sendParam("vocalMode", nextMode);
    updateVocalUI(nextMode);
  });
  $("#txt-vocal-status")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("debug-ai.html") });
  });
  $("#btn-vocal-diag")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("debug-ai.html") });
  });
  $("#btn-vocal-bypass")?.addEventListener("click", () => {
    sendParam("vocalMode", "bypass");
    updateVocalUI("bypass");
  });
  $("#btn-vocal-karaoke")?.addEventListener("click", () => {
    sendParam("vocalMode", "karaoke");
    updateVocalUI("karaoke");
  });
  $("#btn-vocal-acapella")?.addEventListener("click", () => {
    sendParam("vocalMode", "acapella");
    updateVocalUI("acapella");
  });
  $$(".btn-diff").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const lvl = Number(e.currentTarget.dataset.level) || 2;
      sendParam("vocalDiff", lvl);
      updateDiffUI(lvl);
    });
  });


  $("#eq-preset").addEventListener("change", (e) => {
    if (!isAudioMasterOn) return;
    const presetName = e.target.value;
    const values = PRESETS[presetName] || PRESETS.flat;

    currentEqValues = [...values];
    $$(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      sendParam("eq", values[i], i);
    });

    sendParam("eqPreset", presetName);
    updateEQVisuals();
  });

  $("#btn-reset").addEventListener("click", handleReset);

  $("#btn-close").addEventListener("click", async () => {
    if (currentTabId) {
      try {
        await sendMessageWithRetry({
          type: "STOP_CAPTURE",
          tabId: currentTabId,
        });
        chrome.runtime.sendMessage({
          type: "BG_RESET_DELAY",
          tabId: currentTabId,
        });
      } catch (e) {}
    }
    window.close();
  });

  $("#visualizer").parentElement.addEventListener("click", () => {
    visualMode = (visualMode + 1) % 3;
    sendParam("visualMode", visualMode);
  });

  const syncDelay = (val) => {
    if (!isVideoMasterOn) return;
    let v = parseFloat(val);
    if (isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 9.99) v = 9.99;
    $("#video-delay").value = v;
    $("#num-video-delay").value = v.toFixed(2);
    sessionManager.setSetting({ videoDelay: v });
    sendParam("videoDelay", v);
    if (currentTabId)
      chrome.tabs
        .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: v })
        .catch(() => {});
  };
  $("#video-delay").addEventListener("input", (e) => syncDelay(e.target.value));
  $("#num-video-delay").addEventListener("change", (e) =>
    syncDelay(e.target.value)
  );
  $("#btn-delay-minus").addEventListener("click", () => {
    if (!isVideoMasterOn) return;
    syncDelay(parseFloat($("#num-video-delay").value) - 0.1);
  });
  $("#btn-delay-plus").addEventListener("click", () => {
    if (!isVideoMasterOn) return;
    syncDelay(parseFloat($("#num-video-delay").value) + 0.1);
  });
  $("#video-quality")?.addEventListener("change", (e) => {
    const val = e.target.value;
    sendParam("videoQuality", val);
    if (currentTabId)
      chrome.tabs
        .sendMessage(currentTabId, { type: "SET_VIDEO_QUALITY", value: val })
        .catch(() => {});
  });

  const handleTransform = () => {
    if (isVideoMasterOn) syncVideoTransform();
  };
  $("#video-zoom").addEventListener("input", handleTransform);
  $("#video-rotate").addEventListener("input", handleTransform);

  // [NEW] Add Listeners for Position
  $("#video-pos-x").addEventListener("input", (e) => {
    if (isVideoMasterOn) {
      syncVideoTransform();
      sendParam("videoPosX", parseFloat(e.target.value));
    }
  });
  $("#video-pos-y").addEventListener("input", (e) => {
    if (isVideoMasterOn) {
      syncVideoTransform();
      sendParam("videoPosY", parseFloat(e.target.value));
    }
  });

  // [NEW] Reset Position Button
  $("#btn-pos-reset").addEventListener("click", () => {
    $("#video-pos-x").value = 0;
    $("#video-pos-y").value = 0;
    handleTransform();
    sendParam("videoPosX", 0);
    sendParam("videoPosY", 0);
  });

  $("#btn-zoom-fit").addEventListener("click", () => {
    $("#video-zoom").value = 1.0;
    handleTransform();
    sendParam("videoZoom", 1.0);
  });
  $("#btn-zoom-ultra").addEventListener("click", () => {
    $("#video-zoom").value = 1.34;
    handleTransform();
    sendParam("videoZoom", 1.34);
  });
  $("#btn-zoom-fill").addEventListener("click", () => {
    $("#video-zoom").value = 1.5;
    handleTransform();
    sendParam("videoZoom", 1.5);
  });
  $("#btn-rotate-0").addEventListener("click", () => {
    $("#video-rotate").value = 0;
    handleTransform();
    sendParam("videoRotate", 0);
  });
  $("#btn-rotate-90").addEventListener("click", () => {
    let n = parseFloat($("#video-rotate").value) + 90;
    if (n >= 360) n = 0;
    $("#video-rotate").value = n;
    handleTransform();
    sendParam("videoRotate", n);
  });

  $("#btn-rec-top").onclick = toggleRecording;
}

function updateEqToggleButton() {
  const btn = $("#btn-eq-toggle");
  const span = $("#btn-eq-toggle span:last-child");
  const eqContainer = $("#eq-container");

  if (isEqOn && isAudioMasterOn) {
    span.textContent = "ON";
    span.classList.add("text-white");
    btn.classList.add("pressed");
    eqContainer.classList.remove("eq-off");
  } else {
    span.textContent = "OFF";
    span.classList.remove("text-white");
    btn.classList.remove("pressed");
    eqContainer.classList.add("eq-off");
  }
}

function updateMasterTogglesUI() {
  const btnAudio = $("#btn-toggle-audio");
  const audioArea = $("#audio-controls-area");
  const eqArea = $("#eq-controls-area");
  const eqContainer = $("#eq-container");

  if (isAudioMasterOn) {
    btnAudio.textContent = "ON";
    btnAudio.classList.add("pressed", "text-white");
    btnAudio.classList.remove("text-gray-500");
    audioArea.style.opacity = "1";
    audioArea.style.pointerEvents = "auto";
    eqArea.style.opacity = "1";
    eqArea.style.pointerEvents = "auto";
    updateEqToggleButton();
  } else {
    btnAudio.textContent = "OFF";
    btnAudio.classList.remove("pressed", "text-white");
    btnAudio.classList.add("text-gray-500");
    audioArea.style.opacity = "0.4";
    audioArea.style.pointerEvents = "none";
    eqArea.style.opacity = "0.4";
    eqArea.style.pointerEvents = "none";
    eqContainer.classList.add("eq-off");
    const btn = $("#btn-eq-toggle");
    const span = $("#btn-eq-toggle span:last-child");
    span.textContent = "OFF";
    span.classList.remove("text-white");
    btn.classList.remove("pressed");
  }
  drawEQGraph(currentEqValues);

  const btnVideo = $("#btn-toggle-video");
  const videoArea = $("#video-controls-area");
  if (isVideoMasterOn) {
    btnVideo.textContent = "ON";
    btnVideo.classList.add("pressed", "text-white");
    btnVideo.classList.remove("text-gray-500");
    videoArea.style.opacity = "1";
    videoArea.style.pointerEvents = "auto";
  } else {
    btnVideo.textContent = "OFF";
    btnVideo.classList.remove("pressed", "text-white");
    btnVideo.classList.add("text-gray-500");
    videoArea.style.opacity = "0.4";
    videoArea.style.pointerEvents = "none";
  }
}

function syncVideoTransform() {
  let zoomVal = parseFloat($("#video-zoom").value);
  let rotateVal = parseFloat($("#video-rotate").value);

  // [NEW] Get Position Values
  let posX = parseFloat($("#video-pos-x").value);
  let posY = parseFloat($("#video-pos-y").value);

  $("#txt-zoom").textContent = Math.round(zoomVal * 100) + "%";
  $("#txt-rotate").textContent = rotateVal + "°";
  // [NEW] Update Pos Text
  $("#txt-pos").textContent = `${posX},${posY}`;

  // [NEW] Save Params
  sessionManager.setSetting({
    videoZoom: zoomVal,
    videoRotate: rotateVal,
    videoPosX: posX,
    videoPosY: posY,
  });
  sendParam("videoZoom", zoomVal);
  sendParam("videoRotate", rotateVal);
  sendParam("videoPosX", posX);
  sendParam("videoPosY", posY);

  if (currentTabId)
    chrome.tabs
      .sendMessage(currentTabId, {
        type: "SET_VIDEO_ZOOM",
        scale: zoomVal,
        translateX: posX, // [NEW] Send X
        translateY: posY, // [NEW] Send Y
        rotate: rotateVal,
      })
      .catch(() => {});
}

async function handleReset() {
  $("#main-pitch").value = 0;
  $("#txt-pitch").textContent = "0";
  $("#main-verb").value = 0;
  $("#txt-verb").textContent = "0.0";
  $("#main-pan").value = 0;
  $("#txt-pan").textContent = "C";
  $("#main-vol").value = 1;
  $("#txt-vol").textContent = "100%";
  isNormalizeOn = false;
  updateNormalizeButton();
  sendParam("reset", true);

  currentEqValues = PRESETS.flat.map(() => 0);
  $$(".eq-slider").forEach((i) => (i.value = 0));
  $("#eq-preset").value = "flat";
  sendParam("eqPreset", "flat");

  isEqOn = true;
  updateEqToggleButton();
  sendParam("isEqOn", true);
  updateEQVisuals();

  $("#video-delay").value = 0;
  $("#num-video-delay").value = "0.00";
  $("#video-zoom").value = 1;
  $("#txt-zoom").textContent = "100%";
  $("#video-rotate").value = 0;
  $("#txt-rotate").textContent = "0°";

  // [NEW] Reset Position UI
  $("#video-pos-x").value = 0;
  $("#video-pos-y").value = 0;
  $("#txt-pos").textContent = "0,0";

  sessionManager.setSetting({
    videoZoom: 1,
    videoRotate: 0,
    videoPosX: 0,
    videoPosY: 0,
  });

  if (currentTabId) {
    chrome.tabs
      .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: 0 })
      .catch(() => {});
    chrome.tabs
      .sendMessage(currentTabId, {
        type: "SET_VIDEO_ZOOM",
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotate: 0,
      })
      .catch(() => {});
  }
}

// ... (Rest of functions like updateNormalizeButton, renderNewEQSystem, etc. remain unchanged) ...
function updateNormalizeButton() {
  const btn = $("#btn-normalize");
  const indicator = $("#norm-indicator");
  if (!btn || !indicator) return;
  if (isNormalizeOn) {
    btn.className =
      "win-btn w-full h-full border text-[7px] font-bold flex items-center justify-center gap-0.5 border-[#00ff00] text-[#00ff00] bg-black";
    indicator.className =
      "w-1 h-1 rounded-full bg-[#00ff00] shadow-[0_0_5px_#00ff00]";
  } else {
    btn.className =
      "win-btn w-full h-full border text-[7px] font-bold flex items-center justify-center gap-0.5 border-gray-500 text-gray-300 bg-gray-700";
    indicator.className = "w-1 h-1 rounded-full bg-gray-400";
  }
}

function renderNewEQSystem() {
  const container = $("#eq-container");
  container.innerHTML = "";
  FREQUENCIES.forEach((f, i) => {
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = `<div class="eq-bar-wrapper"><div class="eq-bar-mask" id="mask-visual-${i}"></div><div class="eq-thumb" id="thumb-visual-${i}" style="bottom: 50%"></div></div><div class="eq-label">${LABELS[i]}</div><input type="range" class="v-input eq-slider" min="-12" max="12" step="1" value="0" data-idx="${i}">`;
    container.appendChild(col);
    const inp = col.querySelector("input");
    inp.oninput = (e) => {
      if (!isAudioMasterOn) return;
      const val = parseFloat(e.target.value);
      currentEqValues[i] = val;
      sendParam("eq", val, i);

      $("#eq-preset").value = "custom";
      sendParam("eqPreset", "custom");

      updateEQVisuals();
    };
    inp.ondblclick = () => {
      if (!isAudioMasterOn) return;
      inp.value = 0;
      currentEqValues[i] = 0;
      sendParam("eq", 0, i);
      updateEQVisuals();
    };
  });
}

function updateEQVisuals() {
  $$(".eq-slider").forEach((slider, idx) => {
    const val = parseFloat(slider.value);
    const percent = ((val + 12) / 24) * 100;
    const thumb = $(`#thumb-visual-${idx}`);
    if (thumb) thumb.style.bottom = `${percent}%`;
    const mask = $(`#mask-visual-${idx}`);
    if (mask) mask.style.height = `${100 - percent}%`;
  });
  drawEQGraph(currentEqValues);
}

function drawEQGraph(values) {
  const cvs = document.getElementById("eq-graph");
  if (!cvs) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = cvs.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  if (cvs.width !== rect.width * dpr || cvs.height !== rect.height * dpr) {
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
  }

  const ctx = cvs.getContext("2d");
  const drawW = rect.width;
  const drawH = rect.height;

  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, drawW, drawH);
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, drawW, drawH);

  ctx.strokeStyle = "#222";
  ctx.beginPath();
  ctx.moveTo(0, drawH / 2);
  ctx.lineTo(drawW, drawH / 2);
  ctx.stroke();

  const active = isAudioMasterOn && isEqOn;
  ctx.strokeStyle = active ? "#00ff00" : "#555";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = active ? 4 : 0;
  ctx.shadowColor = "rgba(0,255,0,0.4)";
  ctx.beginPath();

  const stepX = drawW / (values.length - 1);
  const drawVals = active ? values : values.map(() => 0);
  const points = drawVals.map((v, i) => ({
    x: i * stepX,
    y: drawH / 2 - (v / 14) * (drawH / 2 - 2),
  }));

  if (points.length > 0) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function loadAudioState(state) {
  const vol = state.volume ?? 1.0;
  const pan = state.pan ?? 0;
  const pitch = state.pitch ?? 0;
  const reverb = state.reverb ?? 0;
  $("#main-vol").value = vol;
  $("#txt-vol").textContent = Math.round(vol * 100) + "%";
  $("#main-pan").value = pan;
  $("#txt-pan").textContent =
    pan > 0 ? "R " + pan : pan < 0 ? "L " + Math.abs(pan) : "C";
  $("#main-pitch").value = pitch;
  $("#txt-pitch").textContent = (pitch > 0 ? "+" : "") + pitch;
  $("#main-verb").value = reverb;
  $("#txt-verb").textContent = parseFloat(reverb).toFixed(1);
  if (state.videoQuality) $("#video-quality").value = state.videoQuality;

  if (state.eqPreset) {
    $("#eq-preset").value = state.eqPreset;
  } else {
    $("#eq-preset").value = "flat";
  }

  settingsModal.setValues(state);
  if (state.currentSampleRate) {
    settingsModal.updateActiveSampleRate(state.currentSampleRate);
  }
  isNormalizeOn = state.normalize || false;
  updateNormalizeButton();
  if (state.vocalMode) {
    updateVocalUI(state.vocalMode);
  }
  if (state.vocalDiff !== undefined) {
    updateDiffUI(state.vocalDiff);
  }
  if (state.vocalStatus) {
    const txtStatus = $("#txt-vocal-status");
    if (txtStatus) {
      txtStatus.textContent = state.vocalStatus;
      txtStatus.title = "AI Vocal: " + state.vocalStatus;
    }
  }

  if (state.eq && state.eq.length > 0) {
    currentEqValues = state.eq;
    $$(".eq-slider").forEach((inp, i) => (inp.value = currentEqValues[i] || 0));
  }
  if (state.isEqOn !== undefined) {
    isEqOn = state.isEqOn;
  }

  // [NEW] Load Position State from Remote/Background
  if (state.videoPosX !== undefined) $("#video-pos-x").value = state.videoPosX;
  if (state.videoPosY !== undefined) $("#video-pos-y").value = state.videoPosY;

  updateEqToggleButton();
  updateEQVisuals();

  // Trigger UI Update for Position
  syncVideoTransform();
}

function drawVisualizer(data, mode) {
  const cvs = $("#visualizer");
  if (!cvs) return;
  const ctx = cvs.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = cvs.clientWidth,
    h = cvs.clientHeight;
  cvs.width = w * dpr;
  cvs.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (mode === 0) {
    const barW = w / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      const barH = (v / 255) * h;
      const r = v > 180 ? 255 : v > 100 ? (v - 100) * 2 : 0;
      const g = v > 180 ? 255 - (v - 180) * 2 : 255;
      ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
      ctx.fillRect(x, h - barH, barW - 0.5, barH);
      x += barW;
    }
  } else if (mode === 1) {
    ctx.strokeStyle = "#00ff00";
    ctx.beginPath();
    const sliceW = w / data.length;
    let x = 0;
    data.forEach((v, i) => {
      const y = h - (v / 255) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.stroke();
  } else if (mode === 2) {
    ctx.strokeStyle = "#00ffff";
    ctx.beginPath();
    const sliceW = w / data.length;
    let x = 0;
    data.forEach((v, i) => {
      const y = ((v / 128) * h) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.stroke();
  }
}
