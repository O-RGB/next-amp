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
let isVocalOn = false;
let currentVocalMode = "bypass";
let aiEngineType = "webgl"; // "webgl" or "go_native"

let isNormalizeOn = false;
let currentEqValues = [...PRESETS.flat];
let visualMode = 0;
let isRecording = false;
let db = new DBManager();
let isTabReady = true;
let currentTabId = null;

let sessionManager;
let settingsModal;

async function checkTabStatus(tab) {
  if (!tab || !tab.id) {
    return { ok: false, reason: "no_tab" };
  }

  if (!tab.url) {
    return { ok: false, reason: "unsupported", tabId: tab.id };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(tab.url);
  } catch (e) {
    return { ok: false, reason: "unsupported", tabId: tab.id };
  }

  const isHttpOrHttps =
    parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  const isRestricted =
    parsedUrl.hostname === "chrome.google.com" ||
    parsedUrl.hostname === "chromewebstore.google.com" ||
    parsedUrl.protocol.startsWith("chrome") ||
    parsedUrl.protocol.startsWith("edge") ||
    parsedUrl.protocol.startsWith("about");

  if (!isHttpOrHttps || isRestricted) {
    return { ok: false, reason: "unsupported", tabId: tab.id, url: tab.url };
  }

  // Ping content script to verify if tab was loaded before extension was installed/reloaded
  const hasContentScript = await new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.pong) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      setTimeout(() => resolve(false), 300);
    } catch (e) {
      resolve(false);
    }
  });

  if (!hasContentScript) {
    return { ok: false, reason: "needs_reload", tabId: tab.id };
  }

  return { ok: true, tabId: tab.id };
}

function showTabStatusModal(status, tab) {
  const overlay = $("#tab-status-overlay");
  if (!overlay) return;

  const titleText = $("#tab-status-title-text");
  const titleIcon = $("#tab-status-title-icon");
  const icon = $("#tab-status-icon");
  const desc = $("#tab-status-desc");
  const btnAction = $("#btn-tab-status-action");
  const btnActionText = $("#btn-tab-status-action-text");
  const btnActionIcon = $("#btn-tab-status-action-icon");
  const btnDismiss = $("#btn-tab-status-dismiss");
  const btnClose = $("#btn-close-tab-status");

  if (status.reason === "unsupported") {
    if (titleText) titleText.textContent = "OPEN A MEDIA TAB";
    if (titleIcon)
      titleIcon.className = "ph-bold ph-monitor-play text-yellow-400";
    if (icon) icon.className = "ph-bold ph-monitor-play";
    if (desc)
      desc.textContent =
        "To get started with Next-Amp, please open a music or video website like YouTube.";
    if (btnActionText) btnActionText.textContent = "OPEN YOUTUBE";
    if (btnActionIcon) btnActionIcon.className = "ph-bold ph-monitor-play";
    if (btnAction) {
      btnAction.onclick = () => {
        chrome.tabs.create({ url: "https://www.youtube.com/" });
        window.close();
      };
    }
  } else {
    if (titleText) titleText.textContent = "TAB RELOAD REQUIRED";
    if (titleIcon)
      titleIcon.className = "ph-bold ph-arrows-clockwise text-yellow-400";
    if (icon) icon.className = "ph-bold ph-arrows-clockwise";
    if (desc)
      desc.textContent =
        "Kindly refresh the tab after installation to ensure Next-Amp audio capture and video controls work smoothly.";
    if (btnActionText) btnActionText.textContent = "REFRESH THE TAB";
    if (btnActionIcon) btnActionIcon.className = "ph-bold ph-arrows-clockwise";
    if (btnAction) {
      btnAction.onclick = () => {
        if (tab && tab.id) chrome.tabs.reload(tab.id);
        window.close();
      };
    }
  }

  const dismissModal = () => {
    overlay.classList.remove("active");
    isTabReady = true;
    if (isAudioMasterOn && currentTabId) {
      initCapture(sessionManager.sessionMode);
    }
    checkFirstLaunchModal();
  };

  if (btnDismiss) btnDismiss.onclick = dismissModal;
  if (btnClose) btnClose.onclick = dismissModal;

  overlay.classList.add("active");
}

async function checkFirstLaunchModal() {
  const data = await chrome.storage.local.get(["hasSeenWelcomeDonateModal"]);
  if (!data.hasSeenWelcomeDonateModal) {
    const overlay = $("#first-launch-overlay");
    if (!overlay) return;

    const btnDonate = $("#btn-first-launch-donate");
    const btnDismiss = $("#btn-first-launch-dismiss");
    const btnClose = $("#btn-close-first-launch");

    const dismissDonate = (openLink = false) => {
      chrome.storage.local.set({ hasSeenWelcomeDonateModal: true });
      overlay.classList.remove("active");
      if (openLink) {
        chrome.tabs.create({ url: "https://ganknow.com/nextfeeder/tip" });
      }
    };

    if (btnDonate) btnDonate.onclick = () => dismissDonate(true);
    if (btnDismiss) btnDismiss.onclick = () => dismissDonate(false);
    if (btnClose) btnClose.onclick = () => dismissDonate(false);

    overlay.classList.add("active");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) currentTabId = tab.id;

  // Check tab status (Tab reload check like in ai remove)
  const tabStatus = await checkTabStatus(tab);
  if (!tabStatus.ok) {
    isTabReady = false;
    showTabStatusModal(tabStatus, tab);
  } else {
    isTabReady = true;
    checkFirstLaunchModal();
  }

  sessionManager = new SessionManager(currentTabId);
  settingsModal = new SettingsModal(db, {
    onThemeChange: applyTheme,
    onSettingChange: (obj) => {
      sessionManager.setSetting(obj);
      if (obj.sampleRate !== undefined || obj.latencyHint !== undefined) {
        if (isAudioMasterOn && currentTabId && isTabReady) {
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
    "isVocalOn",
    "aiEngineType",
  ]);
  if (savedToggles.isAudioMasterOn !== undefined)
    isAudioMasterOn = savedToggles.isAudioMasterOn;
  if (savedToggles.isVideoMasterOn !== undefined)
    isVideoMasterOn = savedToggles.isVideoMasterOn;
  if (savedToggles.isEqOn !== undefined) isEqOn = savedToggles.isEqOn;
  if (savedToggles.isVocalOn !== undefined) isVocalOn = savedToggles.isVocalOn;
  if (savedToggles.aiEngineType !== undefined) aiEngineType = savedToggles.aiEngineType;
  updateAiEngineUI();
  checkGoEngineHealth();

  if (sessionManager.sessionMode === "shared") {
    // [NEW] Add videoPosX and videoPosY to load
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
      if (sharedParams.isVocalOn !== undefined) {
        isVocalOn = sharedParams.isVocalOn;
      }
      if (sharedParams.vocalMode) {
        updateVocalUI(sharedParams.vocalMode);
      } else {
        updateVocalMasterUI();
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
    if (isAudioMasterOn && isTabReady) {
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
          sendParam("isVocalOn", isVocalOn);
          sendParam("vocalMode", currentVocalMode);
          sendParam("aiEngineType", aiEngineType);
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
  } else if (msg.type === "AI_HARDWARE_WARNING") {
    showAiSlowModal(msg.benchmarkMs, msg.deviceLabel);
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
  if (changes.aiHardwareWarning && changes.aiHardwareWarning.newValue) {
    const val = changes.aiHardwareWarning.newValue;
    if (val && val.benchmarkMs > 185) {
      showAiSlowModal(val.benchmarkMs, val.deviceLabel);
    }
  }
});

function showAiSlowModal(benchmarkMs, deviceLabel) {
  const overlay = $("#ai-slow-overlay");
  if (!overlay) return;
  const txtDevice = $("#txt-ai-slow-device");
  const txtMs = $("#txt-ai-slow-ms");
  if (txtDevice) txtDevice.textContent = deviceLabel || "GPU";
  if (txtMs) txtMs.textContent = `${benchmarkMs}ms / chunk`;
  overlay.classList.add("active");
}

function updateVocalUI(mode) {
  currentVocalMode = mode || "bypass";
  const btnBypass = $("#btn-vocal-bypass");
  const btnKaraoke = $("#btn-vocal-karaoke");
  const btnAcapella = $("#btn-vocal-acapella");
  const txtStatus = $("#txt-vocal-status");

  if (!btnBypass || !btnKaraoke || !btnAcapella) return;

  [btnBypass, btnKaraoke, btnAcapella].forEach((btn) => {
    btn.classList.remove("pressed");
    btn.classList.add("text-black", "font-bold");
  });

  if (currentVocalMode === "karaoke") {
    btnKaraoke.classList.add("pressed");
    if (txtStatus) txtStatus.textContent = "KARAOKE";
  } else if (currentVocalMode === "acapella") {
    btnAcapella.classList.add("pressed");
    if (txtStatus) txtStatus.textContent = "ACAPELLA";
  } else {
    btnBypass.classList.add("pressed");
    if (txtStatus) txtStatus.textContent = "ORIGINAL";
  }

  updateVocalMasterUI();
}

function updateVocalMasterUI() {
  const btnToggle = $("#btn-toggle-vocal");
  const vocalArea = $("#vocal-controls-area");
  const txtStatus = $("#txt-vocal-status");

  if (btnToggle) {
    if (isVocalOn) {
      btnToggle.textContent = "ON";
      btnToggle.classList.add("pressed", "text-white");
      btnToggle.classList.remove("text-gray-500");
    } else {
      btnToggle.textContent = "OFF";
      btnToggle.classList.remove("pressed", "text-white");
      btnToggle.classList.add("text-gray-500");
    }
  }

  if (vocalArea) {
    if (!isVocalOn) {
      vocalArea.style.opacity = "0.4";
      vocalArea.style.filter = "grayscale(100%)";
      vocalArea.style.pointerEvents = "none";
    } else {
      vocalArea.style.opacity = "1";
      vocalArea.style.filter = "none";
      vocalArea.style.pointerEvents = "auto";
    }
  }

  if (txtStatus) {
    if (!isVocalOn) {
      txtStatus.classList.remove("text-yellow-300");
      txtStatus.classList.add("text-gray-500");
    } else {
      txtStatus.classList.remove("text-gray-500");
      txtStatus.classList.add("text-yellow-300");
    }
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
  } else if (key === "isVocalOn") {
    isVocalOn = value;
    updateVocalMasterUI();
  } else if (key === "vocalMode") {
    updateVocalUI(value);
  } else if (key === "vocalDiff") {
    updateDiffUI(value);
  } else if (key === "aiEngineType") {
    aiEngineType = value;
    updateAiEngineUI();
  }
}

function updateAiEngineUI() {
  const btnToggle = $("#btn-engine-toggle");
  const selEngine = $("#sel-ai-engine");
  const isGo = (aiEngineType === "go_native");

  if (btnToggle) {
    if (isGo) {
      btnToggle.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mr-0.5"></span>GO`;
      btnToggle.className = "win-btn h-3 px-1 text-[7px] font-bold text-cyan-300 border border-cyan-500 cursor-pointer flex items-center";
      btnToggle.title = "Go Turbo Engine Active (Click to open Go Manager)";
    } else {
      btnToggle.innerHTML = `WEB`;
      btnToggle.className = "win-btn h-3 px-1 text-[7px] font-bold text-gray-400 cursor-pointer";
      btnToggle.title = "Browser WebGL Engine (Click to open Go Manager)";
    }
  }
  if (selEngine) {
    selEngine.value = aiEngineType;
  }
}

async function checkGoEngineHealth() {
  const dot = $("#go-dot-indicator");
  const txtStatus = $("#go-status-text");
  const txtDevice = $("#txt-go-device");
  const txtPing = $("#txt-go-ping");
  const btnSwitch = $("#btn-go-switch-mode");

  try {
    const t0 = performance.now();
    const res = await fetch("http://127.0.0.1:41919/health", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const pingMs = Math.round((performance.now() - t0) * 10) / 10;

      if (dot) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block";
      }
      if (txtStatus) {
        txtStatus.className = "text-[9px] font-bold font-pixel text-emerald-400";
        txtStatus.textContent = "ONLINE (Connected to Go Core)";
      }
      if (txtDevice) txtDevice.textContent = data.engine || "Go Native Core";
      if (txtPing) txtPing.textContent = `${pingMs} ms`;
      if (btnSwitch) {
        btnSwitch.textContent = (aiEngineType === "go_native") ? "SWITCH TO BROWSER WEBGL" : "ACTIVATE GO ENGINE ⚡";
      }
      return { ok: true, pingMs };
    }
  } catch (_) {}

  if (dot) {
    dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 inline-block";
  }
  if (txtStatus) {
    txtStatus.className = "text-[9px] font-bold font-pixel text-red-400";
    txtStatus.textContent = "OFFLINE (Not Running)";
  }
  if (txtPing) txtPing.textContent = "Offline";
  if (btnSwitch) {
    btnSwitch.textContent = (aiEngineType === "go_native") ? "SWITCH TO BROWSER WEBGL" : "ACTIVATE GO ENGINE ⚡";
  }
  return { ok: false };
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
    isVocalOn = !isVocalOn;
    updateVocalMasterUI();
    sessionManager.setSetting({ isVocalOn });
    sendParam("isVocalOn", isVocalOn);
  });
  $("#btn-vocal-bypass")?.addEventListener("click", () => {
    sendParam("vocalMode", "bypass");
    updateVocalUI("bypass");
  });
  $("#btn-vocal-karaoke")?.addEventListener("click", () => {
    chrome.storage.local.get("aiHardwareWarning").then((res) => {
      if (res?.aiHardwareWarning?.benchmarkMs > 185) {
        showAiSlowModal(res.aiHardwareWarning.benchmarkMs, res.aiHardwareWarning.deviceLabel);
      }
    }).catch(() => {});
    sendParam("vocalMode", "karaoke");
    updateVocalUI("karaoke");
  });
  $("#btn-vocal-acapella")?.addEventListener("click", () => {
    chrome.storage.local.get("aiHardwareWarning").then((res) => {
      if (res?.aiHardwareWarning?.benchmarkMs > 185) {
        showAiSlowModal(res.aiHardwareWarning.benchmarkMs, res.aiHardwareWarning.deviceLabel);
      }
    }).catch(() => {});
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

  // AI Engine Switcher & Modal
  $("#btn-engine-toggle")?.addEventListener("click", () => {
    $("#go-engine-overlay")?.classList.add("active");
    checkGoEngineHealth();
  });

  $("#sel-ai-engine")?.addEventListener("change", (e) => {
    aiEngineType = e.target.value;
    updateAiEngineUI();
    sessionManager.setSetting({ aiEngineType });
    sendParam("aiEngineType", aiEngineType);
  });

  $("#btn-go-modal-close")?.addEventListener("click", () => {
    $("#go-engine-overlay")?.classList.remove("active");
  });

  $("#btn-go-test-ping")?.addEventListener("click", async () => {
    const btn = $("#btn-go-test-ping");
    if (btn) btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-[10px]"></i> <span>Pinging...</span>`;
    const res = await checkGoEngineHealth();
    if (btn) {
      btn.innerHTML = res.ok
        ? `<i class="ph-bold ph-check text-emerald-400 text-[10px]"></i> <span class="text-emerald-300">ONLINE (${res.pingMs}ms)</span>`
        : `<i class="ph-bold ph-x text-red-400 text-[10px]"></i> <span class="text-red-400">OFFLINE - OPEN APP FIRST</span>`;
      setTimeout(() => {
        btn.innerHTML = `<i class="ph-bold ph-arrows-clockwise text-[10px]"></i> <span>TEST / RE-CHECK CONNECTION</span>`;
      }, 2500);
    }
  });

  $("#btn-go-switch-mode")?.addEventListener("click", () => {
    aiEngineType = (aiEngineType === "go_native") ? "webgl" : "go_native";
    updateAiEngineUI();
    sessionManager.setSetting({ aiEngineType });
    sendParam("aiEngineType", aiEngineType);
    checkGoEngineHealth();
  });

  // AI Slow Hardware Modal buttons
  $("#btn-ai-slow-close")?.addEventListener("click", () => {
    $("#ai-slow-overlay")?.classList.remove("active");
  });
  $("#btn-ai-slow-continue")?.addEventListener("click", () => {
    $("#ai-slow-overlay")?.classList.remove("active");
  });
  $("#btn-ai-slow-bypass")?.addEventListener("click", () => {
    $("#ai-slow-overlay")?.classList.remove("active");
    currentVocalMode = "bypass";
    sendParam("vocalMode", "bypass");
    updateVocalUI("bypass");
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
  $("#btn-ai-diagnostics")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("debug-ai.html") });
  });

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

  const openCoffeeDonation = () => {
    chrome.tabs.create({ url: "https://ganknow.com/nextfeeder/tip" });
  };
  const buyCoffeeBtn = $("#btn-buy-coffee");
  if (buyCoffeeBtn) buyCoffeeBtn.addEventListener("click", openCoffeeDonation);
  const donateAboutBtn = $("#btn-donate-about");
  if (donateAboutBtn) donateAboutBtn.addEventListener("click", openCoffeeDonation);
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

  const vocalBlock = $("#block-vocal");
  if (isAudioMasterOn) {
    if (vocalBlock) vocalBlock.style.pointerEvents = "auto";
    updateVocalUI(currentVocalMode);
  } else {
    if (vocalBlock) {
      vocalBlock.style.opacity = "0.4";
      vocalBlock.style.pointerEvents = "none";
    }
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
  if (state.isVocalOn !== undefined) {
    isVocalOn = state.isVocalOn;
  }
  if (state.vocalMode) {
    updateVocalUI(state.vocalMode);
  } else {
    updateVocalMasterUI();
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

let barPeaks = [];

function drawVisualizer(data, mode) {
  const cvs = $("#visualizer");
  if (!cvs) return;
  const ctx = cvs.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = cvs.clientWidth,
    h = cvs.clientHeight;
  if (!w || !h) return;

  if (cvs.width !== Math.floor(w * dpr) || cvs.height !== Math.floor(h * dpr)) {
    cvs.width = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Top limit margin so bars and waveforms never obscure the VISUALIZER label (with comfortable padding)
  const topMargin = 18;
  const maxBarH = Math.max(1, h - topMargin);

  // Draw subtle retro limit line
  ctx.save();
  ctx.strokeStyle = "rgba(255, 60, 60, 0.45)";
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, topMargin - 0.5);
  ctx.lineTo(w, topMargin - 0.5);
  ctx.stroke();
  ctx.restore();

  if (mode === 0) {
    // Mode 0: Spectrum Bars with vertical gradient (Green at bottom -> Yellow in middle -> Red at top)
    const gradient = ctx.createLinearGradient(0, h, 0, topMargin);
    gradient.addColorStop(0.0, "#00e640");  // Bottom: bright green
    gradient.addColorStop(0.55, "#38ef7d"); // Mid-low: lime green
    gradient.addColorStop(0.72, "#ffea00"); // Mid: rich yellow
    gradient.addColorStop(0.88, "#ff8800"); // Mid-high: amber orange
    gradient.addColorStop(1.0, "#ff2222");  // Top peak: red

    ctx.fillStyle = gradient;

    // Reduce bar count slightly (e.g. 20 bars instead of 32) for wider, punchier retro EQ look
    const numBars = Math.min(20, data.length);
    if (barPeaks.length !== numBars) {
      barPeaks = new Array(numBars).fill(0);
    }

    const barW = w / numBars;
    let x = 0;
    for (let i = 0; i < numBars; i++) {
      // Average frequency bins in this bar's range
      const start = Math.floor((i * data.length) / numBars);
      const end = Math.max(start + 1, Math.floor(((i + 1) * data.length) / numBars));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += data[j];
        count++;
      }
      const v = sum / count;
      const barH = (v / 255) * maxBarH;

      // Update peak hold decay
      if (!barPeaks[i] || barPeaks[i] < barH) {
        barPeaks[i] = barH;
      } else {
        barPeaks[i] = Math.max(0, barPeaks[i] - 0.7);
      }

      if (barH > 0) {
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 0.5, h - barH, Math.max(1, barW - 1.5), barH);
      }

      // Draw peak hold cap at the top of the bar
      if (barPeaks[i] > 1) {
        const peakY = h - barPeaks[i];
        const peakColor =
          peakY <= topMargin + 2
            ? "#ff3333"
            : peakY <= h - 0.65 * maxBarH
            ? "#ffea00"
            : "#00ff66";
        ctx.fillStyle = peakColor;
        ctx.fillRect(x + 0.5, peakY - 1, Math.max(1, barW - 1.5), 1);
      }

      x += barW;
    }
  } else if (mode === 1) {
    // Mode 1: Frequency Wave line with Green -> Yellow -> Red vertical gradient
    const gradient = ctx.createLinearGradient(0, h, 0, topMargin);
    gradient.addColorStop(0.0, "#00e640");
    gradient.addColorStop(0.65, "#ffea00");
    gradient.addColorStop(1.0, "#ff2222");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceW = w / data.length;
    let x = 0;
    data.forEach((v, i) => {
      const y = h - (v / 255) * maxBarH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.stroke();
  } else if (mode === 2) {
    // Mode 2: Oscilloscope Waveform centered within available safe height
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceW = w / data.length;
    let x = 0;
    const centerY = topMargin + maxBarH / 2;
    data.forEach((v, i) => {
      const offset = ((v - 128) / 128) * (maxBarH / 2);
      const y = centerY + offset;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.stroke();
  }
}
