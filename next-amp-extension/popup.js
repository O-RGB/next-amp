const $ = (s) => document.querySelector(s);
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
  jazz: [3, 2, 0, -2, -2, 0, 2, 3, 4, 4],
  fullbass: [6, 6, 5, 2, 0, -2, -4, -5, -6, -6],
};

let isEqOn = true;
let eqCanvas, eqCtx;
let eqValues = new Array(10).fill(0);
let currentSettings = {
  volume: 1.0,
  pan: 0,
  pitch: 0,
  reverb: 0,
  eq: new Array(10).fill(0),
  eqPreset: "flat",
  isEqOn: true,
};

<<<<<<< HEAD
=======
let isEqOn = true;
let currentEqValues = [...PRESETS.flat];
let visualMode = 0;

>>>>>>> rollback
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

// --- SAVE / LOAD SETTINGS ---
function saveSettings() {
  currentSettings.eq = [...eqValues];
  chrome.storage.local.set({ nextamp_settings: currentSettings });
}

async function loadSettings() {
  const result = await chrome.storage.local.get("nextamp_settings");
  if (result.nextamp_settings) {
    currentSettings = { ...currentSettings, ...result.nextamp_settings };

    // Apply to UI
    $("#main-vol").value = currentSettings.volume;
    $("#txt-vol").textContent = Math.round(currentSettings.volume * 100) + "%";

    $("#main-pan").value = currentSettings.pan;

    $("#main-pitch").value = currentSettings.pitch;
    $("#txt-pitch").textContent = currentSettings.pitch;

    $("#main-verb").value = currentSettings.reverb;
    $("#txt-verb").textContent = currentSettings.reverb.toFixed(2);

    $("#eq-preset").value = currentSettings.eqPreset;

    eqValues = currentSettings.eq;
    isEqOn = currentSettings.isEqOn;

    // Apply EQ Toggle UI
    const btn = $("#btn-eq-toggle");
    const status = $("#txt-eq-status");
    if (isEqOn) {
      btn.classList.add("pressed");
      status.textContent = "ON";
    } else {
      btn.classList.remove("pressed");
      status.textContent = "OFF";
    }
  }
}

async function applyAllSettings() {
  sendParam("volume", currentSettings.volume);
  sendParam("pan", currentSettings.pan);
  sendParam("pitch", currentSettings.pitch);
  sendParam("reverb", currentSettings.reverb);
  eqValues.forEach((val, i) => {
    const v = isEqOn ? val : 0;
    sendParam("eq", v, i);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
<<<<<<< HEAD
  eqCanvas = $("#eq-graph");
  eqCtx = eqCanvas.getContext("2d");

  await loadSettings(); // โหลดค่าเก่าก่อน
  renderEQ();
  drawEQCurve();
  updateEqUIState();
  setupListeners();

  // Init Offscreen
=======
  renderNewEQSystem();
  setupListeners();

  const state = await sendMessageWithRetry({ type: "GET_STATE" });
  const isAudioActive = state && state.isAudioActive;

  if (state && isAudioActive) {
    loadState(state);
  } else {
    initCapture();
  }

  setTimeout(() => drawEQGraph(currentEqValues), 50);
});

function loadState(state) {
  $("#main-vol").value = state.volume;
  $("#txt-vol").textContent = Math.round(state.volume * 100) + "%";
  $("#main-pan").value = state.pan;
  updatePanText(state.pan);
  $("#main-pitch").value = state.pitch;
  $("#txt-pitch").textContent = (state.pitch > 0 ? "+" : "") + state.pitch;
  $("#main-verb").value = state.reverb;
  $("#txt-verb").textContent = parseFloat(state.reverb).toFixed(1);

  isEqOn = state.isEqOn;
  updateEqToggleButton();

  visualMode = state.visualMode;

  if (state.eqGains) {
    currentEqValues = state.eqGains;
    document.querySelectorAll(".eq-slider").forEach((inp, i) => {
      inp.value = currentEqValues[i];
    });
  }
  updateEQVisuals();
}

async function initCapture() {
>>>>>>> rollback
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

<<<<<<< HEAD
    let hasOffscreen = false;
    try {
      hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
    } catch (e) {}

    if (!hasOffscreen) {
      try {
        await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        return;
      }
    }

    // Capture & Apply Settings
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (!streamId) return;
      chrome.runtime.sendMessage({ type: "START_CAPTURE", streamId: streamId });
      setTimeout(applyAllSettings, 500); // ส่งค่าที่โหลดมาไปให้ Audio Engine
=======
    let hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
    if (!hasOffscreen) {
      await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
      await new Promise((r) => setTimeout(r, 500));
    }

    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (chrome.runtime.lastError) {
        console.error("Capture Error:", chrome.runtime.lastError.message);
        return;
      }
      if (!streamId) {
        console.error("No stream ID found");
        return;
      }
      chrome.runtime
        .sendMessage({ type: "START_CAPTURE", streamId: streamId })
        .catch((e) => {
          console.warn("Start capture response error:", e);
        });
>>>>>>> rollback
    });
  } catch (e) {
    console.error(e);
  }
}

function updatePanText(v) {
  const t = $("#txt-pan");
  if (t) t.textContent = v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
}

function setupListeners() {
  $("#main-vol").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("#txt-vol").textContent = Math.round(v * 100) + "%";
    currentSettings.volume = v;
    sendParam("volume", v);
    saveSettings();
  });

  $("#main-pan").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
<<<<<<< HEAD
    currentSettings.pan = v;
=======
    updatePanText(v);
>>>>>>> rollback
    sendParam("pan", v);
    saveSettings();
  });

  $("#main-pitch").addEventListener("input", (e) => {
    const v = parseInt(e.target.value);
    $("#txt-pitch").textContent = v;
    currentSettings.pitch = v;
    sendParam("pitch", v);
    saveSettings();
  });

  $("#main-verb").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("#txt-verb").textContent = v.toFixed(2);
    currentSettings.reverb = v;
    sendParam("reverb", v);
    saveSettings();
  });

  $("#eq-preset").addEventListener("change", (e) => {
<<<<<<< HEAD
    const presetName = e.target.value;
    const values = PRESETS[presetName] || PRESETS.flat;
    document.querySelectorAll(".vertical").forEach((inp, i) => {
      inp.value = values[i];
      eqValues[i] = values[i];
      sendEqParam(i, values[i]);
    });
    currentSettings.eqPreset = presetName;
    drawEQCurve();
    saveSettings();
  });

  $("#btn-eq-toggle").addEventListener("click", () => {
    isEqOn = !isEqOn;
    currentSettings.isEqOn = isEqOn;
    const btn = $("#btn-eq-toggle");
    const status = $("#txt-eq-status");

    if (isEqOn) {
      btn.classList.add("pressed");
      status.textContent = "ON";
    } else {
      btn.classList.remove("pressed");
      status.textContent = "OFF";
    }

    updateEqUIState();
    eqValues.forEach((val, i) => sendEqParam(i, val));
    drawEQCurve();
    saveSettings();
  });

=======
    const values = PRESETS[e.target.value] || PRESETS.flat;
    currentEqValues = [...values];
    document.querySelectorAll(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      if (isEqOn) sendParam("eq", values[i], i);
    });
    updateEQVisuals();
  });

>>>>>>> rollback
  $("#btn-reset").addEventListener("click", () => {
    // Reset Values
    currentSettings = {
      volume: 1.0,
      pan: 0,
      pitch: 0,
      reverb: 0,
      eq: new Array(10).fill(0),
      eqPreset: "flat",
      isEqOn: true,
    };

    $("#main-pitch").value = 0;
    $("#txt-pitch").textContent = "0";
    $("#main-verb").value = 0;
    $("#txt-verb").textContent = "0.00";
    $("#main-pan").value = 0;
    updatePanText(0);
    $("#main-vol").value = 1;
    $("#txt-vol").textContent = "100%";
    $("#eq-preset").value = "flat";
<<<<<<< HEAD

    eqValues.fill(0);
    document.querySelectorAll(".vertical").forEach((inp) => (inp.value = 0));

    isEqOn = true;
    $("#btn-eq-toggle").classList.add("pressed");
    $("#txt-eq-status").textContent = "ON";

    updateEqUIState();
    applyAllSettings();
    drawEQCurve();
    saveSettings();
  });
}

function updateEqUIState() {
  document.querySelectorAll(".vertical").forEach((inp) => {
    if (isEqOn) {
      inp.classList.add("eq-bar-active");
      inp.style.opacity = "1";
    } else {
      inp.classList.remove("eq-bar-active");
      inp.style.opacity = "0.5";
    }
=======
    currentEqValues = PRESETS.flat.map(() => 0);
    document.querySelectorAll(".eq-slider").forEach((inp) => (inp.value = 0));

    sendParam("reset", true);

    isEqOn = true;
    updateEqToggleButton();
    updateEQVisuals();
  });

  $("#btn-eq-toggle").addEventListener("click", () => {
    isEqOn = !isEqOn;
    updateEqToggleButton();
    sendParam("isEqOn", isEqOn);
    currentEqValues.forEach((val, i) => sendParam("eq", val, i));
    updateEQVisuals();
  });

  $("#btn-close").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
    window.close();
  });

  $("#visualizer").parentElement.addEventListener("click", () => {
    visualMode = (visualMode + 1) % 3;
    sendParam("visualMode", visualMode);
>>>>>>> rollback
  });
}

function updateEqToggleButton() {
  const span = $("#btn-eq-toggle span:last-child");
  const btn = $("#btn-eq-toggle");
  const eqContainer = $("#eq-container");

  if (isEqOn) {
    span.textContent = "ON";
    span.classList.add("text-white");
    span.classList.remove("text-gray-500", "theme-text-main");
    btn.classList.add("pressed");
    eqContainer.classList.remove("eq-off");
  } else {
    span.textContent = "OFF";
    span.classList.remove("text-white", "theme-text-main");
    span.classList.add("text-gray-500");
    btn.classList.remove("pressed");
    eqContainer.classList.add("eq-off");
  }
  drawEQGraph(currentEqValues);
}

function renderNewEQSystem() {
  const container = $("#eq-container");
  if (!container) return;
  container.innerHTML = "";

  FREQUENCIES.forEach((f, i) => {
<<<<<<< HEAD
    const div = document.createElement("div");
    div.className =
      "flex flex-col items-center justify-center h-full flex-1 min-w-[24px]";
    div.innerHTML = `
      <div class="relative w-full flex justify-center h-[90px] items-center">
         <input type="range" class="vertical eq-bar-active" min="-12" max="12" step="1" value="${
           eqValues[i]
         }" data-idx="${i}">
      </div>
      <span class="text-[7px] text-gray-500 mt-0 font-pixel tracking-tighter text-center w-full">
        ${f >= 1000 ? f / 1000 + "k" : f}
      </span>
    `;
    container.appendChild(div);
    const inp = div.querySelector("input");

    inp.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      eqValues[i] = val;
      $("#eq-preset").value = "custom";
      currentSettings.eqPreset = "custom";
      sendEqParam(i, val);
      drawEQCurve();
      saveSettings();
=======
    const col = document.createElement("div");
    col.className = "eq-col";
    // เปลี่ยนโครงสร้าง: ใช้ mask แทน active bar
    col.innerHTML = `
      <div class="eq-bar-wrapper">
          <div class="eq-bar-mask" id="mask-visual-${i}"></div>
          <div class="eq-thumb" id="thumb-visual-${i}" style="bottom: 50%"></div>
      </div>
      <div class="eq-label">${LABELS[i]}</div>
      <input type="range" class="v-input eq-slider" min="-12" max="12" step="1" value="0" data-idx="${i}">
    `;
    container.appendChild(col);

    const inp = col.querySelector("input");
    inp.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      currentEqValues[i] = val;
      if (isEqOn) sendParam("eq", val, i);
      if ($("#eq-preset").value !== "custom") $("#eq-preset").value = "custom";
      updateEQVisuals();
>>>>>>> rollback
    });

    inp.addEventListener("dblclick", (e) => {
      e.target.value = 0;
<<<<<<< HEAD
      eqValues[i] = 0;
      sendEqParam(i, 0);
      drawEQCurve();
      saveSettings();
=======
      currentEqValues[i] = 0;
      if (isEqOn) sendParam("eq", 0, i);
      updateEQVisuals();
>>>>>>> rollback
    });
  });
}

<<<<<<< HEAD
function drawEQCurve() {
  if (!eqCtx) return;
  const w = eqCanvas.width;
  const h = eqCanvas.height;
  eqCtx.clearRect(0, 0, w, h);

  eqCtx.strokeStyle = "#333";
  eqCtx.lineWidth = 1;
  eqCtx.beginPath();
  eqCtx.moveTo(0, h / 2);
  eqCtx.lineTo(w, h / 2);
  eqCtx.stroke();

  if (!isEqOn) return;

  eqCtx.strokeStyle = "#00ff00";
  eqCtx.lineWidth = 2;
  eqCtx.beginPath();

  const stepX = w / (FREQUENCIES.length - 1);
  const points = [];
  eqValues.forEach((val, i) => {
    const y = h / 2 - val * (h / 24);
    points.push({ x: i * stepX, y: y });
  });

  if (points.length > 0) {
    eqCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 2; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      eqCtx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    eqCtx.quadraticCurveTo(
      points[points.length - 2].x,
      points[points.length - 2].y,
      points[points.length - 1].x,
      points[points.length - 1].y
    );
  }
  eqCtx.stroke();
}

function sendEqParam(index, val) {
  const valueToSend = isEqOn ? val : 0;
  sendParam("eq", valueToSend, index);
=======
function updateEQVisuals() {
  const sliders = document.querySelectorAll(".eq-slider");
  sliders.forEach((slider, idx) => {
    const val = parseFloat(slider.value);
    const percent = ((val + 12) / 24) * 100;

    // อัปเดตตำแหน่ง Thumb (เหมือนเดิม)
    const thumb = document.getElementById(`thumb-visual-${idx}`);
    if (thumb) {
      thumb.style.bottom = `${percent}%`;
    }

    // อัปเดต Mask สีเทา (Height คือส่วนที่เหลือจากด้านบน)
    const mask = document.getElementById(`mask-visual-${idx}`);
    if (mask) {
      // ถ้าค่าเต็ม (100%) -> mask สูง 0%
      // ถ้าค่าน้อยสุด (0%) -> mask สูง 100%
      mask.style.height = `${100 - percent}%`;
    }
  });
  drawEQGraph(currentEqValues);
}

function drawEQGraph(values) {
  const canvas = document.getElementById("eq-graph");
  if (!canvas) return;
  const ctxEq = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctxEq.clearRect(0, 0, w, h);
  ctxEq.fillStyle = "#080808";
  ctxEq.fillRect(0, 0, w, h);

  ctxEq.strokeStyle = "#222";
  ctxEq.beginPath();
  ctxEq.moveTo(0, h / 2);
  ctxEq.lineTo(w, h / 2);
  ctxEq.stroke();

  ctxEq.strokeStyle = isEqOn ? "#00ff00" : "#555";
  ctxEq.lineWidth = 1.5;
  ctxEq.shadowBlur = isEqOn ? 4 : 0;
  ctxEq.shadowColor = "rgba(0, 255, 0, 0.4)";

  ctxEq.beginPath();
  const stepX = w / (values.length - 1);
  const drawValues = isEqOn ? values : values.map(() => 0);

  const points = drawValues.map((v, i) => ({
    x: i * stepX,
    y: h / 2 - (v / 14) * (h / 2 - 2),
  }));

  ctxEq.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctxEq.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctxEq.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctxEq.stroke();
  ctxEq.shadowBlur = 0;
>>>>>>> rollback
}

function sendParam(key, value, index = null) {
  chrome.runtime
    .sendMessage({ type: "SET_PARAM", key, value, index })
    .catch(() => {});
}

<<<<<<< HEAD
// --- VISUALIZER FIX: เพิ่มสีแดง (Green -> Yellow -> Red) ---
=======
// ---------------- VISUALIZER SYSTEM ---------------- //
>>>>>>> rollback
const cvs = $("#visualizer");
const ctx = cvs ? cvs.getContext("2d") : null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VISUALIZER_DATA" && ctx && cvs) {
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    const neededWidth = Math.floor(rect.width * dpr);
    const neededHeight = Math.floor(rect.height * dpr);

    if (
      neededWidth > 0 &&
      neededHeight > 0 &&
      (cvs.width !== neededWidth || cvs.height !== neededHeight)
    ) {
      cvs.width = neededWidth;
      cvs.height = neededHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const w = cvs.width / dpr;
    const h = cvs.height / dpr;

    if (w === 0 || h === 0) return;

    const data = msg.data;
<<<<<<< HEAD
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    const barW = cvs.width / data.length;
    let x = 0;

    // สร้าง Gradient เหมือน Nextamp Original
    const gradient = ctx.createLinearGradient(0, cvs.height, 0, 0);
    gradient.addColorStop(0, "#00ff00"); // ล่าง: เขียว
    gradient.addColorStop(0.6, "#ffff00"); // กลาง: เหลือง
    gradient.addColorStop(1.0, "#ff0000"); // บน: แดง
    ctx.fillStyle = gradient;

    for (let i = 0; i < data.length; i++) {
      const h = (data[i] / 255) * cvs.height;
      ctx.fillRect(x, cvs.height - h, barW - 1, h);
      x += barW;
=======
    const mode = msg.mode;

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
      ctx.beginPath();
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      const sliceW = w / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const y = h - (data[i] / 255) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
    } else if (mode === 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      const sliceW = w / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
>>>>>>> rollback
    }
  }
});
