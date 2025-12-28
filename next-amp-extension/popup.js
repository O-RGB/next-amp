// popup.js
const $ = (s) => document.querySelector(s);
const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  pop: [2, 1, 3, 2, 1, 0, 1, 2, 2, 1],
  voice: [-2, -1, 0, 2, 4, 4, 3, 1, 0, 0],
};

let isEqOn = true;
let currentEqValues = [...PRESETS.flat];
let visualMode = 0;

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

document.addEventListener("DOMContentLoaded", async () => {
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
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    let hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
    if (!hasOffscreen) {
      await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
      await new Promise((r) => setTimeout(r, 500));
    }

    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) return;
      chrome.runtime.sendMessage({ type: "START_CAPTURE", streamId: streamId });
    });
  } catch (e) {
    console.error("Init Error:", e);
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
    sendParam("volume", v);
  });

  $("#main-pan").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    updatePanText(v);
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

  $("#eq-preset").addEventListener("change", (e) => {
    const values = PRESETS[e.target.value] || PRESETS.flat;
    currentEqValues = [...values];
    document.querySelectorAll(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      if (isEqOn) sendParam("eq", values[i], i);
    });
    updateEQVisuals();
  });

  $("#btn-reset").addEventListener("click", () => {
    $("#main-pitch").value = 0;
    $("#txt-pitch").textContent = "0";
    $("#main-verb").value = 0;
    $("#txt-verb").textContent = "0.0";
    $("#main-pan").value = 0;
    updatePanText(0);
    $("#main-vol").value = 1;
    $("#txt-vol").textContent = "100%";
    $("#eq-preset").value = "flat";
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
    visualMode = (visualMode + 1) % 3; // 0, 1, 2
    sendParam("visualMode", visualMode);
  });
}

function updateEqToggleButton() {
  const span = $("#btn-eq-toggle span:last-child");
  const btn = $("#btn-eq-toggle");
  const eqContainer = $("#eq-container");

  if (isEqOn) {
    span.textContent = "ON";
    span.classList.add("theme-text-main");
    span.classList.remove("text-gray-500");
    btn.classList.add("pressed");
    eqContainer.classList.remove("eq-off");
  } else {
    span.textContent = "OFF";
    span.classList.remove("theme-text-main");
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
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = `
      <div class="eq-bar-wrapper">
          <div class="eq-bar-active" id="bar-visual-${i}"></div>
          <div class="eq-thumb" id="thumb-visual-${i}" style="bottom: 50%"></div>
      </div>
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
    });
    inp.addEventListener("dblclick", (e) => {
      e.target.value = 0;
      currentEqValues[i] = 0;
      if (isEqOn) sendParam("eq", 0, i);
      updateEQVisuals();
    });
  });
}

function updateEQVisuals() {
  const sliders = document.querySelectorAll(".eq-slider");
  sliders.forEach((slider, idx) => {
    const val = parseFloat(slider.value);
    const percent = ((val + 12) / 24) * 100;
    const thumb = document.getElementById(`thumb-visual-${idx}`);
    if (thumb) {
      thumb.style.bottom = `${percent}%`;
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
}

function sendParam(key, value, index = null) {
  chrome.runtime
    .sendMessage({ type: "SET_PARAM", key, value, index })
    .catch(() => {});
}

// ---------------- VISUALIZER SYSTEM ---------------- //
const cvs = $("#visualizer");
const ctx = cvs ? cvs.getContext("2d") : null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VISUALIZER_DATA" && ctx && cvs) {
    // 1. ตรวจสอบขนาดพื้นที่แสดงผลจริง
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    const neededWidth = Math.floor(rect.width * dpr);
    const neededHeight = Math.floor(rect.height * dpr);

    // 2. ถ้าขนาด Canvas ไม่ตรงกับขนาดที่ควรจะเป็น ให้ปรับใหม่ทันที (Auto Resize)
    // เงื่อนไข neededWidth > 0 เพื่อป้องกันกรณีปิดหน้าจอแล้วได้ค่า 0
    if (
      neededWidth > 0 &&
      neededHeight > 0 &&
      (cvs.width !== neededWidth || cvs.height !== neededHeight)
    ) {
      cvs.width = neededWidth;
      cvs.height = neededHeight;
      // Reset Transform และ Scale ให้ตรงกับ dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    // 3. ใช้ขนาด Logical ในการวาด (เพราะเรา scale ctx ไว้แล้ว)
    const w = cvs.width / dpr;
    const h = cvs.height / dpr;

    // ถ้าขนาดยังไม่ถูกต้อง (เช่น เป็น 0) ให้ข้ามการวาดไปก่อน
    if (w === 0 || h === 0) return;

    const data = msg.data;
    const mode = msg.mode;

    ctx.clearRect(0, 0, w, h);

    if (mode === 0) {
      // BAR
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
      // LINE
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
      // WAVE (Visualizer ที่คุณต้องการ)
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
    }
  }
});
