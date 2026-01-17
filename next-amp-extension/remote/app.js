const urlParams = new URLSearchParams(window.location.search);
const HOST_ID = urlParams.get("id");
const SESSION_TOKEN = urlParams.get("token");

const FREQUENCIES = [
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

const els = {
  overlay: document.getElementById("conn-overlay"),
  msg: document.getElementById("conn-msg"),
  status: document.getElementById("status-indicator"),
  vol: document.getElementById("remote-vol"),
  pan: document.getElementById("remote-pan"),
  pitch: document.getElementById("remote-pitch"),
  verb: document.getElementById("remote-verb"),
  delay: document.getElementById("remote-delay"),
  zoom: document.getElementById("remote-zoom"),
  rotate: document.getElementById("remote-rotate"),
  videoQuality: document.getElementById("remote-video-quality"),
  eqPreset: document.getElementById("remote-eq-preset"),
  eqToggle: document.getElementById("btn-eq-toggle"),
  eqContainer: document.getElementById("remote-eq-container"),
  btnVideo: document.getElementById("btn-video-toggle"),
  btnDyn: document.getElementById("btn-dyn-toggle"),
  txtVol: document.getElementById("txt-vol"),
  txtPan: document.getElementById("txt-pan"),
  txtPitch: document.getElementById("txt-pitch"),
  txtVerb: document.getElementById("txt-verb"),
  txtDelay: document.getElementById("txt-delay"),
  txtZoom: document.getElementById("txt-zoom"),
  txtRotate: document.getElementById("txt-rotate"),
};

let conn = null;
let peer = null;
let isProgrammaticUpdate = false;

if (!HOST_ID || !SESSION_TOKEN) {
  els.msg.textContent = "Error: Invalid Link";
} else {
  peer = new Peer(null);
  peer.on("open", connectToHost);
  peer.on("error", (err) => (els.msg.textContent = "Error: " + err.type));
}

function connectToHost() {
  els.msg.textContent = "Connecting to Host...";
  conn = peer.connect(HOST_ID, { reliable: true });

  conn.on("open", () => {
    els.msg.textContent = "Verifying...";
    conn.send({ type: "HANDSHAKE", token: SESSION_TOKEN });
  });

  conn.on("data", (data) => {
    if (data.type === "SYNC_STATE") {
      els.overlay.classList.add("hidden");
      els.status.classList.remove("bg-red-600");
      els.status.classList.add("bg-[#00ff00]");
      applyState(data.state);
    } else if (data.type === "UPDATE_PARAM") {
      if (document.hidden) return;
      updateSingleUI(data.key, data.value, data.index);
    }
  });

  conn.on("close", () => {
    els.overlay.classList.remove("hidden");
    els.msg.textContent = "Connection Lost...";
    els.status.classList.add("bg-red-600");
    setTimeout(connectToHost, 3000);
  });
}

function sendParam(key, value, index = null) {
  if (isProgrammaticUpdate) return;
  if (conn && conn.open) conn.send({ type: "SET_PARAM", key, value, index });
}

function applyState(s) {
  isProgrammaticUpdate = true;
  updateSingleUI("volume", s.volume);
  updateSingleUI("pan", s.pan);
  updateSingleUI("pitch", s.pitch);
  updateSingleUI("reverb", s.reverb);
  updateSingleUI("videoDelay", s.videoDelay);
  updateSingleUI("videoZoom", s.videoZoom);
  updateSingleUI("videoRotate", s.videoRotate);
  updateSingleUI("videoQuality", s.videoQuality);
  updateSingleUI("eqPreset", s.eqPreset);
  updateSingleUI("isEqOn", s.isEqOn);
  updateSingleUI("isVideoMasterOn", s.isVideoMasterOn ?? true);
  updateSingleUI("normalize", s.normalize ?? false);
  if (s.eq) s.eq.forEach((v, i) => updateSingleUI("eq", v, i));
  isProgrammaticUpdate = false;
}

function updateSingleUI(key, val, idx) {
  isProgrammaticUpdate = true;
  switch (key) {
    case "eq":
      const slider = document.querySelector(
        `.eq-range-hidden[data-idx="${idx}"]`
      );
      if (slider) slider.value = val;
      updateEQVisual(idx, val);
      break;
    default:
      handleStandardUI(key, val);
      break;
  }
  isProgrammaticUpdate = false;
}

function handleStandardUI(key, val) {
  let el = null;
  let txtEl = null;
  let format = (v) => v;

  if (key === "volume") {
    el = els.vol;
    txtEl = els.txtVol;
    format = (v) => Math.round(v * 100) + "%";
  } else if (key === "pan") {
    el = els.pan;
    txtEl = els.txtPan;
    format = (v) => (v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C");
  } else if (key === "pitch") {
    el = els.pitch;
    txtEl = els.txtPitch;
    format = (v) => (v > 0 ? "+" : "") + v;
  } else if (key === "reverb") {
    el = els.verb;
    txtEl = els.txtVerb;
    format = (v) => parseFloat(v).toFixed(1);
  } else if (key === "videoDelay") {
    el = els.delay;
    txtEl = els.txtDelay;
    format = (v) => parseFloat(v).toFixed(2);
  } else if (key === "videoZoom") {
    el = els.zoom;
    txtEl = els.txtZoom;
    format = (v) => Math.round(v * 100) + "%";
  } else if (key === "videoRotate") {
    el = els.rotate;
    txtEl = els.txtRotate;
    format = (v) => v + "°";
  } else if (key === "videoQuality") {
    el = els.videoQuality;
  } else if (key === "eqPreset") {
    el = els.eqPreset;
  } else if (key === "isEqOn") {
    setBtnState(
      els.eqToggle,
      val,
      "ON",
      "OFF",
      "bg-[#e0ffe0]",
      "text-green-900"
    );
    return;
  } else if (key === "isVideoMasterOn") {
    setBtnState(
      els.btnVideo,
      val,
      "VIDEO ON",
      "VIDEO OFF",
      "bg-[#e0f0ff]",
      "text-blue-900"
    );
    return;
  } else if (key === "normalize") {
    setBtnState(
      els.btnDyn,
      val,
      "DYN ON",
      "DYN OFF",
      "bg-[#00ff00]",
      "text-black"
    );
    return;
  }

  if (el) {
    if (el.type === "range" || el.tagName === "SELECT") el.value = val;
    if (txtEl) txtEl.textContent = format(val);
  }
}

function updateEQVisual(idx, val) {
  const percent = ((val + 12) / 24) * 100;
  const mask = document.getElementById(`mask-visual-${idx}`);
  const thumb = document.getElementById(`thumb-visual-${idx}`);
  if (mask) mask.style.height = `${100 - percent}%`;
  if (thumb) thumb.style.bottom = `${percent}%`;
}

function setBtnState(el, isActive, textOn, textOff, activeBg, activeText) {
  if (isActive) {
    el.textContent = textOn;
    el.className = `win-btn pressed ${activeBg} ${activeText}`;
    el.style.borderTop = "3px solid #000";
    el.style.borderLeft = "3px solid #000";
    el.style.borderBottom = "3px solid #fff";
    el.style.borderRight = "3px solid #fff";
  } else {
    el.textContent = textOff;
    el.className = "win-btn bg-[#c0c0c0] text-gray-600";
    el.style.borderTop = "";
    el.style.borderLeft = "";
    el.style.borderBottom = "";
    el.style.borderRight = "";
  }
}

(function generateEQ() {
  els.eqContainer.innerHTML = "";
  FREQUENCIES.forEach((f, i) => {
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = `
            <div class="eq-bar-wrapper">
                <div class="eq-bar-mask" id="mask-visual-${i}"></div>
                <div class="eq-thumb-visual" id="thumb-visual-${i}" style="bottom: 50%"></div>
            </div>
            <input type="range" class="eq-range-hidden" min="-12" max="12" step="1" value="0" data-idx="${i}">
            <div class="eq-label">${f}</div>
        `;
    els.eqContainer.appendChild(col);

    const inp = col.querySelector("input");
    inp.oninput = (e) => {
      const val = parseFloat(e.target.value);
      updateEQVisual(i, val);
      sendParam("eq", val, i);
      els.eqPreset.value = "custom";
      sendParam("eqPreset", "custom");
    };
    inp.ondblclick = () => {
      inp.value = 0;
      updateEQVisual(i, 0);
      sendParam("eq", 0, i);
    };
  });
})();

[
  els.vol,
  els.pan,
  els.pitch,
  els.verb,
  els.delay,
  els.zoom,
  els.rotate,
].forEach((el) => {
  el.oninput = (e) => {
    let key = "";
    let val = parseFloat(e.target.value);
    if (el === els.vol) key = "volume";
    if (el === els.pan) key = "pan";
    if (el === els.pitch) {
      key = "pitch";
      val = parseInt(val);
    }
    if (el === els.verb) key = "reverb";
    if (el === els.delay) key = "videoDelay";
    if (el === els.zoom) key = "videoZoom";
    if (el === els.rotate) {
      key = "videoRotate";
      val = parseInt(val);
    }
    handleStandardUI(key, val);
    sendParam(key, val);
  };
});

els.btnVideo.onclick = () => {
  const newState = !els.btnVideo.className.includes("pressed");
  updateSingleUI("isVideoMasterOn", newState);
  sendParam("isVideoMasterOn", newState);
};
els.btnDyn.onclick = () => {
  const newState = !els.btnDyn.className.includes("pressed");
  updateSingleUI("normalize", newState);
  sendParam("normalize", newState);
};
els.eqToggle.onclick = () => {
  const newState = !els.eqToggle.className.includes("pressed");
  updateSingleUI("isEqOn", newState);
  sendParam("isEqOn", newState);
};
els.videoQuality.onchange = (e) => sendParam("videoQuality", e.target.value);
els.eqPreset.onchange = (e) => {
  const preset = e.target.value;
  const values = PRESETS[preset] || PRESETS.flat;
  values.forEach((v, i) => {
    updateSingleUI("eq", v, i);
    sendParam("eq", v, i);
  });
  sendParam("eqPreset", preset);
};

// --- New Stepper Logic ---
function setupStepper(sliderId, minusId, plusId) {
  const slider = document.getElementById(sliderId);
  const btnMinus = document.getElementById(minusId);
  const btnPlus = document.getElementById(plusId);

  if (!slider || !btnMinus || !btnPlus) return;

  const update = (increment) => {
    const step = parseFloat(slider.step) || 1;
    const current = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);

    let newValue = current + (increment ? step : -step);

    // Clamp values
    if (newValue < min) newValue = min;
    if (newValue > max) newValue = max;

    // Fix floating point precision
    if (step < 1) {
      const decimals = step.toString().split(".")[1]?.length || 2;
      newValue = parseFloat(newValue.toFixed(decimals));
    }

    slider.value = newValue;
    slider.dispatchEvent(new Event("input"));
  };

  btnMinus.onclick = () => update(false);
  btnPlus.onclick = () => update(true);
}

// Setup steppers for all controls
setupStepper("remote-vol", "btn-vol-minus", "btn-vol-plus");
setupStepper("remote-pan", "btn-pan-minus", "btn-pan-plus");
setupStepper("remote-pitch", "btn-pitch-minus", "btn-pitch-plus");
setupStepper("remote-verb", "btn-verb-minus", "btn-verb-plus");
setupStepper("remote-delay", "btn-delay-minus", "btn-delay-plus");
setupStepper("remote-zoom", "btn-zoom-minus", "btn-zoom-plus");
setupStepper("remote-rotate", "btn-rotate-minus", "btn-rotate-plus");
