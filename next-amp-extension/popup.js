const $ = (s) => document.querySelector(s);
const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

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
  eqCanvas = $("#eq-graph");
  eqCtx = eqCanvas.getContext("2d");

  await loadSettings(); // โหลดค่าเก่าก่อน
  renderEQ();
  drawEQCurve();
  updateEqUIState();
  setupListeners();

  // Init Offscreen
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

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
    });
  } catch (e) {
    console.error(e);
  }
});

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
    currentSettings.pan = v;
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
    $("#main-vol").value = 1;
    $("#txt-vol").textContent = "100%";
    $("#eq-preset").value = "flat";

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
  });
}

function renderEQ() {
  const container = $("#eq-container");
  container.innerHTML = "";
  FREQUENCIES.forEach((f, i) => {
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
    });

    inp.addEventListener("dblclick", (e) => {
      e.target.value = 0;
      eqValues[i] = 0;
      sendEqParam(i, 0);
      drawEQCurve();
      saveSettings();
    });
  });
}

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
}

function sendParam(key, value, index = null) {
  chrome.runtime
    .sendMessage({ type: "SET_PARAM", key, value, index })
    .catch(() => {});
}

// --- VISUALIZER FIX: เพิ่มสีแดง (Green -> Yellow -> Red) ---
const cvs = $("#visualizer");
const ctx = cvs.getContext("2d");
cvs.width = 300;
cvs.height = 80;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VISUALIZER_DATA") {
    const data = msg.data;
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
    }
  }
});
