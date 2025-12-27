// popup.js
const $ = (s) => document.querySelector(s);
const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

// EQ Presets Data
const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  pop: [2, 1, 3, 2, 1, 0, 1, 2, 2, 1],
  voice: [-2, -1, 0, 2, 4, 4, 3, 1, 0, 0],
};

// Helper: Send message with retry
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
  renderEQ();
  setupListeners();

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      console.error("No active tab found");
      return;
    }

    // Attempt to wake up Service Worker
    let hasOffscreen = false;
    try {
      hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
    } catch (e) {
      console.warn("SW wake up failed, trying INIT anyway...");
    }

    if (!hasOffscreen) {
      try {
        await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
        await new Promise((r) => setTimeout(r, 1000)); // Wait for offscreen
      } catch (err) {
        console.error("Failed to init offscreen:", err);
        return;
      }
    }

    // Get Stream
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        console.error("Capture failed:", chrome.runtime.lastError);
        return;
      }

      console.log("Got streamId:", streamId);

      chrome.runtime.sendMessage({
        type: "START_CAPTURE",
        streamId: streamId,
      });
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
    const presetName = e.target.value;
    const values = PRESETS[presetName] || PRESETS.flat;
    document.querySelectorAll(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      sendParam("eq", values[i], i);
    });
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
  });
}

function renderEQ() {
  const container = $("#eq-container");
  container.innerHTML = "";
  FREQUENCIES.forEach((f, i) => {
    const div = document.createElement("div");
    div.className = "flex flex-col items-center h-full flex-1";
    div.innerHTML = `<input type="range" class="eq-slider" min="-12" max="12" step="1" value="0" data-idx="${i}">`;
    container.appendChild(div);
    const inp = div.querySelector("input");
    inp.addEventListener("input", (e) => {
      sendParam("eq", parseFloat(e.target.value), i);
      $("#eq-preset").value = "custom";
    });
    inp.addEventListener("dblclick", (e) => {
      e.target.value = 0;
      sendParam("eq", 0, i);
    });
  });
}

function sendParam(key, value, index = null) {
  chrome.runtime
    .sendMessage({ type: "SET_PARAM", key, value, index })
    .catch(() => {});
}

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
    for (let i = 0; i < data.length; i++) {
      const h = (data[i] / 255) * cvs.height;
      const r = data[i] > 200 ? 255 : 0;
      const g = data[i] + 50;
      ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
      ctx.fillRect(x, cvs.height - h, barW - 1, h);
      x += barW;
    }
  }
});
