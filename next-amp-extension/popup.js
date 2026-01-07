import { DBManager } from "./db-manager.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

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

let isEqOn = true;
let isNormalizeOn = false;
let currentEqValues = [...PRESETS.flat];
let visualMode = 0;
let isRecording = false;
let audioPlayer = null;
let db = new DBManager();

document.addEventListener("DOMContentLoaded", async () => {
  renderNewEQSystem();
  setupListeners();
  setupModalSystem();

  await loadUserPreferences();

  try {
    await db.open();
    renderRecordingList();
  } catch (e) {
    console.error("DB Init Fail", e);
  }

  const state = await sendMessageWithRetry({ type: "GET_STATE" });
  if (state) {
    loadAudioState(state);
  } else {
    checkStartupVolume();
    updateNormalizeButton();
  }

  try {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (currentTab) {
      chrome.tabs.sendMessage(
        currentTab.id,
        { type: "GET_VIDEO_DELAY" },
        (res) => {
          if (!chrome.runtime.lastError && res?.value) {
            $("#video-delay").value = res.value;
            $("#num-video-delay").value = res.value.toFixed(2);
          }
        }
      );
    }

    const isAudioActive = state && state.isAudioActive;
    if (!isAudioActive) {
      initCapture();
    }
  } catch (e) {
    console.error("Popup Init Error:", e);
  }

  setTimeout(() => drawEQGraph(currentEqValues), 50);
});

async function loadUserPreferences() {
  const data = await chrome.storage.local.get([
    "theme",
    "startupVol",
    "latencyHint",
    "showStats",
  ]);

  if (data.theme) applyTheme(data.theme);

  if (data.startupVol) $("#sel-startup-vol").value = data.startupVol;
  if (data.latencyHint) $("#sel-latency").value = data.latencyHint;
  if (data.showStats !== undefined) {
    $("#chk-show-stats").checked = data.showStats;
    toggleStats(data.showStats);
  }
}

function checkStartupVolume() {
  const startupVol = $("#sel-startup-vol").value;
  const vol = parseFloat(startupVol);
  $("#main-vol").value = vol;
  $("#txt-vol").textContent = Math.round(vol * 100) + "%";
}

function applyTheme(colorCode) {
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

    $$(".theme-box").forEach((b) => {
      b.style.border =
        b.dataset.theme === colorCode ? "2px solid white" : "1px solid #666";
    });

    updateNormalizeButton();
  }
}

function toggleStats(show) {}

async function sendMessageWithRetry(msg, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (i === maxRetries - 1) return null;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function initCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  let hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
  if (!hasOffscreen) {
    await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
    await new Promise((r) => setTimeout(r, 1000));
  }

  const latencyHint = $("#sel-latency").value || "interactive";

  chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
    if (chrome.runtime.lastError || !streamId) return;

    chrome.runtime
      .sendMessage({
        type: "START_CAPTURE",
        streamId,
        tabId: tab.id,
        latencyHint: latencyHint,
      })
      .then(() => {
        const startVol = parseFloat($("#sel-startup-vol").value);
        sendParam("volume", startVol);
      })
      .catch((e) => console.warn(e));
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VISUALIZER_DATA") {
    drawVisualizer(msg.data, msg.mode);
  } else if (msg.type === "RECORDING_SAVED") {
    handleRecordingSaved();
  }
});

async function toggleRecording() {
  const btnRecAction = $("#btn-rec-action");
  const btnRecTop = $("#btn-rec-top");
  const recStatus = $("#rec-status");
  const recIndicator = $("#rec-indicator");

  if (!isRecording) {
    const success = await sendMessageWithRetry({ type: "START_RECORDING" });
    if (success) {
      isRecording = true;
      recStatus.textContent = "RECORDING...";
      recStatus.className = "text-red-500 font-bold animate-pulse";

      btnRecAction.innerHTML = `<div class="w-2 h-2 rounded-sm bg-white"></div><span>STOP</span>`;
      btnRecAction.classList.add("bg-red-900", "text-white");

      btnRecTop.textContent = "STOP";
      btnRecTop.classList.remove("text-red-900");
      btnRecTop.classList.add("bg-red-600", "text-white");

      if (recIndicator) recIndicator.classList.remove("hidden");
    }
  } else {
    isRecording = false;
    recStatus.textContent = "PROCESSING...";
    recStatus.className = "text-yellow-500 font-bold";
    if (recIndicator) recIndicator.classList.add("hidden");

    await sendMessageWithRetry({ type: "STOP_RECORDING" });

    btnRecTop.textContent = "REC";
    btnRecTop.classList.remove("bg-red-600", "text-white");
    btnRecTop.classList.add("text-red-900");
  }
}

async function handleRecordingSaved() {
  const btnRecAction = $("#btn-rec-action");
  const btnRecTop = $("#btn-rec-top");
  const recStatus = $("#rec-status");
  const recIndicator = $("#rec-indicator");

  recStatus.textContent = "READY";
  recStatus.className = "text-gray-400";

  if (btnRecAction) {
    btnRecAction.innerHTML = `<div class="w-1.5 h-1.5 rounded-full bg-red-600"></div><span>REC</span>`;
    btnRecAction.classList.remove("bg-red-900", "text-white");
  }

  if (btnRecTop) {
    btnRecTop.textContent = "REC";
    btnRecTop.classList.remove("bg-red-600", "text-white");
    btnRecTop.classList.add("text-red-900");
  }

  if (recIndicator) recIndicator.classList.add("hidden");

  await renderRecordingList();

  const modalOverlay = $("#modal-overlay");
  modalOverlay.classList.add("active");
  switchTab("tab-record");

  isRecording = false;
}

async function renderRecordingList() {
  const listContainer = $("#rec-list");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const recordings = await db.getAllRecordings();

  if (recordings.length === 0) {
    listContainer.innerHTML = `<div class="text-[8px] text-gray-600 text-center py-4">No recordings yet</div>`;
    return;
  }

  recordings.forEach((rec) => {
    const el = document.createElement("div");
    el.className = "rec-item";
    el.innerHTML = `
        <i class="ph-fill ph-music-note-simple rec-icon text-[10px] mr-1"></i>
        <div class="rec-info flex-1 min-w-0 mr-1">
            <span class="text-[9px] text-white leading-none block truncate">${rec.name}</span>
            <span class="text-[8px] text-gray-500">${rec.size}MB - ${rec.date}</span>
        </div>
        <div class="flex gap-1">
            <button class="win-btn w-4 h-4 text-[9px] btn-play text-green-400 border border-gray-600" title="Play">P</button>
            <button class="win-btn w-4 h-4 text-[9px] btn-dl text-blue-400 border border-gray-600" title="Download">DL</button>
            <button class="win-btn w-4 h-4 text-[9px] btn-del text-red-500 font-bold border border-gray-600" title="Delete">D</button>
        </div>
    `;

    el.querySelector(".btn-play").onclick = () => playRecording(rec.blob);

    el.querySelector(".btn-dl").onclick = () => {
      const url = URL.createObjectURL(rec.blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${rec.name}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };

    el.querySelector(".btn-del").onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${rec.name}?`)) {
        await db.deleteRecording(rec.id);
        renderRecordingList();
      }
    };

    listContainer.appendChild(el);
  });
}

function playRecording(blob) {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
  const url = URL.createObjectURL(blob);
  audioPlayer = new Audio(url);
  audioPlayer.play();
  audioPlayer.onended = () => {
    URL.revokeObjectURL(url);
  };
}

function setupListeners() {
  $("#main-vol").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("#txt-vol").textContent = Math.round(v * 100) + "%";
    sendParam("volume", v);
  });

  $("#main-pan").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("#txt-pan").textContent =
      v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
    sendParam("pan", v);
  });

  $("#main-pitch").addEventListener("input", (e) => {
    const v = parseInt(e.target.value);
    $("#txt-pitch").textContent = (v > 0 ? "+" : "") + v;
    sendParam("pitch", v);
  });
  $("#main-verb").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("#txt-verb").textContent = v.toFixed(1);
    sendParam("reverb", v);
  });

  $("#btn-normalize")?.addEventListener("click", () => {
    isNormalizeOn = !isNormalizeOn;
    updateNormalizeButton();
    sendParam("normalize", isNormalizeOn);
  });

  $("#btn-eq-toggle").addEventListener("click", () => {
    isEqOn = !isEqOn;
    updateEqToggleButton();
    sendParam("isEqOn", isEqOn);
    currentEqValues.forEach((val, i) => sendParam("eq", val, i));
    updateEQVisuals();
  });

  $("#eq-preset").addEventListener("change", (e) => {
    const values = PRESETS[e.target.value] || PRESETS.flat;
    currentEqValues = [...values];
    $$(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      if (isEqOn) sendParam("eq", values[i], i);
    });
    updateEQVisuals();
  });

  $("#btn-reset").addEventListener("click", handleReset);
  $("#btn-close").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab) {
        chrome.tabs
          .sendMessage(tab.id, { type: "SET_VIDEO_DELAY", value: 0 })
          .catch(() => {});
        chrome.tabs
          .sendMessage(tab.id, { type: "SET_VIDEO_QUALITY", value: "max" })
          .catch(() => {});
      }
    } catch (e) {
      console.error("Error sending to tab:", e);
    }

    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, () => resolve());
      });
    } catch (e) {}

    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, () => resolve());
      });
    } catch (e) {}

    setTimeout(() => {
      window.close();
    }, 100);
  });
  $("#visualizer").parentElement.addEventListener("click", () => {
    visualMode = (visualMode + 1) % 3;
    sendParam("visualMode", visualMode);
  });

  const syncDelay = async (val) => {
    let v = parseFloat(val);
    if (isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 9.99) v = 9.99;

    $("#video-delay").value = v;
    $("#num-video-delay").value = v.toFixed(2);
    sendParam("videoDelay", v);

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab)
      chrome.tabs
        .sendMessage(tab.id, { type: "SET_VIDEO_DELAY", value: v })
        .catch(() => {});
  };

  $("#video-delay").addEventListener("input", (e) => syncDelay(e.target.value));
  $("#num-video-delay").addEventListener("change", (e) =>
    syncDelay(e.target.value)
  );
  $("#btn-delay-minus").addEventListener("click", () =>
    syncDelay(parseFloat($("#num-video-delay").value) - 0.1)
  );
  $("#btn-delay-plus").addEventListener("click", () =>
    syncDelay(parseFloat($("#num-video-delay").value) + 0.1)
  );
  $("#video-quality")?.addEventListener("change", async (e) => {
    const val = e.target.value;
    sendParam("videoQuality", val);
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab)
      chrome.tabs
        .sendMessage(tab.id, { type: "SET_VIDEO_QUALITY", value: val })
        .catch(() => {});
  });
}

function switchTab(id) {
  $$(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === id)
  );
  $$(".tab-content").forEach((c) => c.classList.toggle("active", c.id === id));
}

function setupModalSystem() {
  const modalOverlay = $("#modal-overlay");
  const toggleModal = (show) => modalOverlay.classList.toggle("active", show);

  $("#btn-settings").onclick = () => {
    toggleModal(true);
    switchTab("tab-general");
  };

  $("#btn-rec-top").onclick = toggleRecording;

  $("#btn-modal-close").onclick = () => toggleModal(false);
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) toggleModal(false);
  };

  $$(".tab-btn").forEach(
    (btn) => (btn.onclick = () => switchTab(btn.dataset.tab))
  );

  $$(".theme-box").forEach((box) => {
    box.onclick = () => {
      const t = box.dataset.theme;
      applyTheme(t);
      chrome.storage.local.set({ theme: t });
    };
  });

  $("#sel-startup-vol").onchange = (e) =>
    chrome.storage.local.set({ startupVol: e.target.value });
  $("#sel-latency").onchange = (e) =>
    chrome.storage.local.set({ latencyHint: e.target.value });
  $("#chk-show-stats").onchange = (e) => {
    chrome.storage.local.set({ showStats: e.target.checked });
    toggleStats(e.target.checked);
  };

  $("#btn-rec-action").onclick = toggleRecording;
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
  updateEQVisuals();

  $("#video-delay").value = 0;
  $("#num-video-delay").value = "0.00";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs
      .sendMessage(tab.id, { type: "SET_VIDEO_DELAY", value: 0 })
      .catch(() => {});
    chrome.tabs
      .sendMessage(tab.id, { type: "SET_VIDEO_QUALITY", value: "max" })
      .catch(() => {});
  }
}

function sendParam(key, value, index = null) {
  chrome.runtime
    .sendMessage({ type: "SET_PARAM", key, value, index })
    .catch(() => {});
}

function updateNormalizeButton() {
  const btn = $("#btn-normalize");
  const indicator = $("#norm-indicator");
  if (isNormalizeOn) {
    btn.className =
      "win-btn w-full h-full border text-[7px] font-bold transition-colors duration-200 flex items-center justify-center gap-0.5 border-[#00ff00] text-[#00ff00] bg-black";
    indicator.className =
      "w-1 h-1 rounded-full bg-[#00ff00] shadow-[0_0_5px_#00ff00]";
  } else {
    btn.className =
      "win-btn w-full h-full border text-[7px] font-bold transition-colors duration-200 flex items-center justify-center gap-0.5 border-gray-500 text-gray-300 bg-gray-700";
    indicator.className = "w-1 h-1 rounded-full bg-gray-400";
  }
}

function updateEqToggleButton() {
  const span = $("#btn-eq-toggle span:last-child");
  const btn = $("#btn-eq-toggle");
  const eqContainer = $("#eq-container");
  if (isEqOn) {
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
  drawEQGraph(currentEqValues);
}
function renderNewEQSystem() {
  const container = $("#eq-container");
  container.innerHTML = "";
  FREQUENCIES.forEach((f, i) => {
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = `
            <div class="eq-bar-wrapper"><div class="eq-bar-mask" id="mask-visual-${i}"></div><div class="eq-thumb" id="thumb-visual-${i}" style="bottom: 50%"></div></div>
            <div class="eq-label">${LABELS[i]}</div>
            <input type="range" class="v-input eq-slider" min="-12" max="12" step="1" value="0" data-idx="${i}">`;
    container.appendChild(col);
    const inp = col.querySelector("input");
    inp.oninput = (e) => {
      const val = parseFloat(e.target.value);
      currentEqValues[i] = val;
      if (isEqOn) sendParam("eq", val, i);
      $("#eq-preset").value = "custom";
      updateEQVisuals();
    };
    inp.ondblclick = () => {
      inp.value = 0;
      currentEqValues[i] = 0;
      if (isEqOn) sendParam("eq", 0, i);
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
  const ctx = cvs.getContext("2d");
  const w = cvs.width,
    h = cvs.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#222";
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.strokeStyle = isEqOn ? "#00ff00" : "#555";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = isEqOn ? 4 : 0;
  ctx.shadowColor = "rgba(0,255,0,0.4)";
  ctx.beginPath();
  const stepX = w / (values.length - 1);
  const drawVals = isEqOn ? values : values.map(() => 0);
  const points = drawVals.map((v, i) => ({
    x: i * stepX,
    y: h / 2 - (v / 14) * (h / 2 - 2),
  }));
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}
function loadAudioState(state) {
  $("#main-vol").value = state.volume;
  $("#txt-vol").textContent = Math.round(state.volume * 100) + "%";
  $("#main-pan").value = state.pan;
  $("#txt-pan").textContent =
    state.pan > 0
      ? "R " + state.pan
      : state.pan < 0
      ? "L " + Math.abs(state.pan)
      : "C";
  $("#main-pitch").value = state.pitch;
  $("#txt-pitch").textContent = (state.pitch > 0 ? "+" : "") + state.pitch;
  $("#main-verb").value = state.reverb;
  $("#txt-verb").textContent = parseFloat(state.reverb).toFixed(1);
  if (state.videoQuality) $("#video-quality").value = state.videoQuality;
  isNormalizeOn = state.normalize || false;
  updateNormalizeButton();
  isEqOn = state.isEqOn;
  updateEqToggleButton();
  visualMode = state.visualMode;
  if (state.eq && state.eq.length > 0) {
    currentEqValues = state.eq;
    $$(".eq-slider").forEach((inp, i) => (inp.value = currentEqValues[i] || 0));
  }
  updateEQVisuals();
  if (state.isRecording) {
    isRecording = true;

    const btnRecAction = $("#btn-rec-action");
    const btnRecTop = $("#btn-rec-top");
    const recStatus = $("#rec-status");
    const recIndicator = $("#rec-indicator");

    if (recStatus) {
      recStatus.textContent = "RECORDING...";
      recStatus.className = "text-red-500 font-bold animate-pulse";
    }

    if (btnRecAction) {
      btnRecAction.innerHTML = `<div class="w-2 h-2 rounded-sm bg-white"></div><span>STOP</span>`;
      btnRecAction.classList.add("bg-red-900", "text-white");
    }

    if (btnRecTop) {
      btnRecTop.textContent = "STOP";
      btnRecTop.classList.remove("text-red-900");
      btnRecTop.classList.add("bg-red-600", "text-white");
    }

    if (recIndicator) recIndicator.classList.remove("hidden");
  }
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
