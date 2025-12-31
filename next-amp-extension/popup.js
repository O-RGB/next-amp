// popup.js
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

  // [แก้ไข 1] โหลดค่า UI เสมอ ไม่ว่า Audio จะ Active หรือไม่ เพื่อให้ UI ไม่ Reset เป็น 0
  if (state) {
    loadState(state);
  }

  // ตรวจสอบ Tab ปัจจุบัน
  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const isAudioActive = state && state.isAudioActive;
  const activeTabId = state ? state.activeTabId : null;

  // [แก้ไข 2] Logic การแย่ง Tab (Force Switch)
  // ถ้าไม่มีเสียงเล่น หรือ มีเสียงเล่นอยู่แต่เป็นคนละ Tab กับที่เราเปิดอยู่ -> เริ่มใหม่ที่นี่เลย
  if (!isAudioActive || (currentTab && activeTabId !== currentTab.id)) {
    console.log("Starting capture on new tab or restarting...");
    initCapture();
  }

  setTimeout(() => drawEQGraph(currentEqValues), 50);
});

function loadState(state) {
  // Volume
  $("#main-vol").value = state.volume;
  $("#txt-vol").textContent = Math.round(state.volume * 100) + "%";

  // Pan
  $("#main-pan").value = state.pan;
  updatePanText(state.pan);

  // Pitch
  $("#main-pitch").value = state.pitch;
  $("#txt-pitch").textContent = (state.pitch > 0 ? "+" : "") + state.pitch;

  // Reverb
  $("#main-verb").value = state.reverb;
  $("#txt-verb").textContent = parseFloat(state.reverb).toFixed(1);

  // EQ / Visuals
  isEqOn = state.isEqOn;
  updateEqToggleButton();
  visualMode = state.visualMode;

  // EQ Gains (เช็คทั้ง eqGains จาก Node และ params.eq ที่จำไว้)
  // ใช้ params.eq เป็นหลักถ้ามี เพราะมันคือค่าที่ User ตั้งไว้
  const savedEq = state.eq || state.eqGains;
  if (savedEq && savedEq.length > 0) {
    currentEqValues = savedEq;
    document.querySelectorAll(".eq-slider").forEach((inp, i) => {
      inp.value = currentEqValues[i] || 0;
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
      if (chrome.runtime.lastError) {
        // บางที error เพราะสิทธิ์ Tab เก่ายังไม่หลุด ให้ลองอีกครั้งหรือแจ้งเตือน
        console.error("Capture Error:", chrome.runtime.lastError.message);
        return;
      }
      if (!streamId) {
        console.error("No stream ID found");
        return;
      }
      // ส่ง tabId ไปด้วย เพื่อบอก Offscreen ว่านี่คือ Tab ใหม่
      chrome.runtime
        .sendMessage({
          type: "START_CAPTURE",
          streamId: streamId,
          tabId: tab.id,
        })
        .catch((e) => {
          console.warn("Start capture response error:", e);
        });
    });
  } catch (e) {
    console.error("Init Error:", e);
  }
}

// ... (ส่วนที่เหลือของ popup.js เหมือนเดิม) ...
function updatePanText(v) {
  const t = $("#txt-pan");
  if (t) t.textContent = v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
}

function setupListeners() {
  // ... (Listeners เดิมทั้งหมด) ...
  // ใส่โค้ดส่วน setupListeners เดิมของคุณลงที่นี่
  // (โค้ดส่วนนี้ไม่ได้เปลี่ยนแปลง Logic แต่ต้องมีเพื่อให้ทำงานได้)
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
    visualMode = (visualMode + 1) % 3;
    sendParam("visualMode", visualMode);
  });

  const btnCopyId = $("#btn-copy-id");
  if (btnCopyId) {
    btnCopyId.addEventListener("click", async () => {
      try {
        const id = chrome.runtime.id;
        await navigator.clipboard.writeText(id);
        const originalText = btnCopyId.innerText;
        btnCopyId.innerText = "OK";
        btnCopyId.style.backgroundColor = "#4ade80";
        setTimeout(() => {
          btnCopyId.innerText = originalText;
          btnCopyId.style.backgroundColor = "";
        }, 1000);
      } catch (err) {
        console.error("Failed to copy ID", err);
      }
    });
  }
}

// ... (ฟังก์ชันอื่น ๆ เช่น updateEqToggleButton, renderNewEQSystem, updateEQVisuals, drawEQGraph, sendParam, Visualizer Code คงเดิม) ...
// Copy ฟังก์ชันที่เหลือจาก popup.js เดิมของคุณมาใส่ต่อท้ายได้เลยครับ
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
    }
  }
});
