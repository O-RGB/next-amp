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

async function sendMessageWithRetry(msg, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderNewEQSystem();
  setupListeners();
  updateEQVisuals();

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    let hasOffscreen = false;
    try {
      hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
    } catch (e) {
      console.warn("SW wake up failed, trying INIT anyway...");
    }

    if (!hasOffscreen) {
      try {
        await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error("Failed to init offscreen:", err);
        return;
      }
    }

    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) return;
      chrome.runtime.sendMessage({ type: "START_CAPTURE", streamId: streamId });
    });
  } catch (e) {
    console.error("Init Error:", e);
  }
});

function setupListeners() {
  $("#main-vol").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    $("#txt-vol").textContent = Math.round(v * 100) + "%";
    sendParam("volume", v);
  });

  $("#main-pan").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    sendParam("pan", v > 0 ? "R" + v : v < 0 ? "L" + Math.abs(v) : "C");
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
    document.querySelectorAll(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      sendParam("eq", values[i], i);
    });
    updateEQVisuals();
  });

  $("#btn-reset").addEventListener("click", () => {
    $("#main-pitch").value = 0;
    $("#txt-pitch").textContent = "0";
    $("#main-verb").value = 0;
    $("#txt-verb").textContent = "0.0";
    $("#main-pan").value = 0;
    $("#main-vol").value = 1;
    $("#txt-vol").textContent = "100%";
    $("#eq-preset").value = "flat";
    document.querySelectorAll(".eq-slider").forEach((inp) => (inp.value = 0));

    sendParam("pitch", 0);
    sendParam("reverb", 0);
    sendParam("pan", 0);
    sendParam("volume", 1.0);
    for (let i = 0; i < 10; i++) sendParam("eq", 0, i);
    updateEQVisuals();
  });
}

function renderNewEQSystem() {
  const container = $("#eq-container");
  if (!container) return;
  container.innerHTML = "";

  FREQUENCIES.forEach((f, i) => {
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = `
      <div class="eq-bar-bg"></div>
      <div class="eq-bar-active" id="bar-visual-${i}" style="height: 50%"></div>
      <div class="eq-thumb" id="thumb-visual-${i}" style="bottom: 50%"></div>
      <input type="range" class="v-input eq-slider" min="-12" max="12" step="1" value="0" data-idx="${i}">
    `;
    container.appendChild(col);

    const inp = col.querySelector("input");
    inp.addEventListener("input", (e) => {
      sendParam("eq", parseFloat(e.target.value), i);
      if ($("#eq-preset").value !== "custom") $("#eq-preset").value = "custom";
      updateEQVisuals();
    });
    inp.addEventListener("dblclick", (e) => {
      e.target.value = 0;
      sendParam("eq", 0, i);
      updateEQVisuals();
    });
  });
}

function updateEQVisuals() {
  const sliders = document.querySelectorAll(".eq-slider");
  const values = [];
  sliders.forEach((slider, idx) => {
    const val = parseInt(slider.value);
    values.push(val);
    const percent = ((val + 12) / 24) * 100;
    const bar = document.getElementById(`bar-visual-${idx}`);
    const thumb = document.getElementById(`thumb-visual-${idx}`);
    if (bar && thumb) {
      bar.style.height = `${percent}%`;
      thumb.style.bottom = `${percent}%`;
    }
  });
  drawEQGraph(values);
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

  // Grid
  ctxEq.strokeStyle = "#222";
  ctxEq.beginPath();
  ctxEq.moveTo(0, h / 2);
  ctxEq.lineTo(w, h / 2);
  ctxEq.stroke();

  // Curve
  ctxEq.strokeStyle = "#00ff00";
  ctxEq.lineWidth = 1.5;
  ctxEq.shadowBlur = 4;
  ctxEq.shadowColor = "rgba(0, 255, 0, 0.4)";
  ctxEq.beginPath();

  const step = w / (values.length - 1);
  for (let i = 0; i < values.length; i++) {
    const x = i * step;
    const y = h / 2 - (values[i] / 12) * (h / 2 - 2);
    if (i === 0) ctxEq.moveTo(x, y);
    else {
      const prevX = (i - 1) * step;
      const prevY = h / 2 - (values[i - 1] / 12) * (h / 2 - 2);
      const cpX = (prevX + x) / 2;
      ctxEq.quadraticCurveTo(cpX, prevY, x, y);
    }
  }
  ctxEq.stroke();
  ctxEq.shadowBlur = 0;
}

function sendParam(key, value, index = null) {
  chrome.runtime
    .sendMessage({ type: "SET_PARAM", key, value, index })
    .catch(() => {});
}

// Visualizer
const cvs = $("#visualizer");
const ctx = cvs ? cvs.getContext("2d") : null;
if (cvs) {
  cvs.width = 300;
  cvs.height = 80;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VISUALIZER_DATA" && ctx) {
    const data = msg.data;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    const barW = cvs.width / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const h = (data[i] / 255) * cvs.height;
      const r = data[i] > 180 ? 255 : data[i] > 100 ? (data[i] - 100) * 2 : 0;
      ctx.fillStyle = `rgb(${r}, 255, 0)`;
      ctx.fillRect(x, cvs.height - h, barW - 1, h);
      x += barW;
    }
  }
});
