import SignalsmithStretch from "../mjs/SignalsmithStretch.mjs";

(function () {
  const allowedDomains = [
    "next-amp-player.vercel.app",
    // "localhost",
    // "127.0.0.1",
  ];
  const currentDomain = window.location.hostname;

  if (!allowedDomains.includes(currentDomain)) {
    document.body.innerHTML = "<h1>Unauthorized Copy</h1>";
    throw new Error("Piracy detected!");
  }
})();

(function () {
  const isDirectAccess = window.location.pathname.endsWith("app.html");
  const hasNoToken = sessionStorage.getItem("access_allowed") !== "true";
  if (isDirectAccess || hasNoToken) {
    window.location.replace("index.html");
    throw new Error("Access Denied");
  }
})();

document.addEventListener("contextmenu", (event) => event.preventDefault());

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const STORAGE_KEY = "nextamp_settings_v9_stable";

const worker = new Worker("/assets/libs/worker/mp3-worker.js");

const savedSettingsRaw = localStorage.getItem(STORAGE_KEY);
let savedSettings = savedSettingsRaw ? JSON.parse(savedSettingsRaw) : {};

const audioOptions = {};
if (
  savedSettings.audioSampleRate &&
  savedSettings.audioSampleRate !== "default"
) {
  audioOptions.sampleRate = parseInt(savedSettings.audioSampleRate);
}
if (savedSettings.audioLatency) {
  audioOptions.latencyHint = savedSettings.audioLatency;
}

let audioContext;
try {
  audioContext = new AudioContext(audioOptions);
} catch (e) {
  console.warn("Custom sample rate failed, falling back", e);
  audioContext = new AudioContext();
}

const defaultTheme = {
  window: "#000080",
  text: "#00ff00",
  textSec: "#ffcc00",
  highlight: "#000080",
  eq1: "#00ff00",
  eq2: "#ffff00",
  eq3: "#ff0000",
};
let currentTheme = { ...defaultTheme };

let reverbNode = audioContext.createConvolver();
let reverbGain = audioContext.createGain();
reverbGain.gain.value = 0;
let isReverbOn = false;

function applyThemeToDOM(t) {
  const r = document.documentElement;
  r.style.setProperty("--theme-window", t.window);
  r.style.setProperty("--theme-text", t.text);
  r.style.setProperty("--theme-text-sec", t.textSec);
  r.style.setProperty("--theme-highlight", t.highlight);
  r.style.setProperty("--eq-col-1", t.eq1);
  r.style.setProperty("--eq-col-2", t.eq2);
  r.style.setProperty("--eq-col-3", t.eq3);
}

window.customAlert = (msg) => {
  $("#modal-generic-msg").textContent = msg;
  const btns = $("#modal-generic-btns");
  btns.innerHTML = "";
  const ok = document.createElement("button");
  ok.className = "win-btn w-20 h-6 text-[10px]";
  ok.textContent = "OK";
  ok.onclick = () => $("#modal-generic").classList.add("hidden");
  btns.appendChild(ok);
  $("#modal-generic").classList.remove("hidden");
};

window.customConfirm = (msg, callback) => {
  $("#modal-generic-msg").textContent = msg;
  const btns = $("#modal-generic-btns");
  btns.innerHTML = "";
  const no = document.createElement("button");
  no.className = "win-btn w-20 h-6 text-[10px]";
  no.textContent = "NO";
  no.onclick = () => {
    $("#modal-generic").classList.add("hidden");
  };
  const yes = document.createElement("button");
  yes.className = "win-btn w-20 h-6 text-[10px]";
  yes.textContent = "YES";
  yes.onclick = () => {
    $("#modal-generic").classList.add("hidden");
    callback();
  };
  btns.appendChild(no);
  btns.appendChild(yes);
  $("#modal-generic").classList.remove("hidden");
};

window.switchSettingsTab = (tabName) => {
  ["audio", "appearance"].forEach((t) => {
    if (t === tabName) {
      $(`#tab-content-${t}`).classList.remove("hidden");
      $(`#tab-btn-${t}`).classList.add("active");
    } else {
      $(`#tab-content-${t}`).classList.add("hidden");
      $(`#tab-btn-${t}`).classList.remove("active");
    }
  });
};

window.openSettingsModal = () => {
  $("#modal-settings").classList.remove("hidden");

  $("#set-theme-window").value = currentTheme.window;
  $("#set-theme-text").value = currentTheme.text;
  $("#set-theme-high").value = currentTheme.highlight;
  $("#set-eq-1").value = currentTheme.eq1;
  $("#set-eq-2").value = currentTheme.eq2;
  $("#set-eq-3").value = currentTheme.eq3;

  $("#set-audio-sr").value = savedSettings.audioSampleRate || "default";
  $("#set-audio-latency").value = savedSettings.audioLatency || "interactive";

  $("#disp-rev-gain").textContent = savedSettings.reverbGain || "0.0";

  previewTheme();
};

window.closeSettingsModal = () => {
  $("#modal-settings").classList.add("hidden");

  applyThemeToDOM(currentTheme);
};

window.previewTheme = () => {
  const w = $("#set-theme-window").value;
  const t = $("#set-theme-text").value;
  const bg = $("#theme-preview-box");
  const txt = $("#theme-preview-text");
  bg.style.backgroundColor = w;
  txt.style.color = t;

  document.documentElement.style.setProperty("--theme-window", w);
  document.documentElement.style.setProperty("--theme-text", t);
  document.documentElement.style.setProperty(
    "--theme-highlight",
    $("#set-theme-high").value
  );
  document.documentElement.style.setProperty(
    "--eq-col-1",
    $("#set-eq-1").value
  );
  document.documentElement.style.setProperty(
    "--eq-col-2",
    $("#set-eq-2").value
  );
  document.documentElement.style.setProperty(
    "--eq-col-3",
    $("#set-eq-3").value
  );
};

window.applyThemeSettings = () => {
  currentTheme.window = $("#set-theme-window").value;
  currentTheme.text = $("#set-theme-text").value;
  currentTheme.highlight = $("#set-theme-high").value;
  currentTheme.eq1 = $("#set-eq-1").value;
  currentTheme.eq2 = $("#set-eq-2").value;
  currentTheme.eq3 = $("#set-eq-3").value;
  applyThemeToDOM(currentTheme);
  saveSettings();

  $("#modal-settings").classList.add("hidden");
};

window.saveAudioSettings = () => {
  savedSettings.audioSampleRate = $("#set-audio-sr").value;
  savedSettings.audioLatency = $("#set-audio-latency").value;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSettings));

  customConfirm("Audio settings saved. Reload to apply changes?", () => {
    location.reload();
  });
};

window.resetTheme = () => {
  currentTheme = { ...defaultTheme };
  applyThemeToDOM(currentTheme);
  saveSettings();
  $("#modal-settings").classList.add("hidden");
};

const tooltip = $("#slider-tooltip");
const hideTooltip = () => {
  tooltip.style.display = "none";
};

function attachTooltips() {
  $$('input[type="range"]').forEach((el) => {
    el.oninput = (e) => {
      const val = parseFloat(e.target.value);
      let text = val;
      const type = el.dataset.tooltipType || "raw";
      if (type === "time") text = formatTime(val);
      else if (type === "percent") text = Math.round(val * 100) + "%";
      else if (type === "balance")
        text =
          val === 0 ? "CENTER" : val < 0 ? "L " + Math.abs(val) : "R " + val;
      else if (type === "x") text = val + "x";
      else if (type === "val") text = val;
      else if (type === "db") text = val + " dB";

      if (el.dataset.idx) {
        handleEqInput(el.dataset.idx, val, el);
        text = val + " dB";
      } else {
        if (el.id === "main-vol") {
          masterGainNode.gain.value = val;
          $("#txt-vol").textContent = Math.round(val * 100) + "%";
          saveSettings();
        } else if (el.id === "main-bal") {
          pannerNode.pan.value = val;
          saveSettings();
        } else if (el.dataset.key === "rate") {
          controlValues.rate = val;
          $("#val-rate").textContent = val.toFixed(2);
          controlsChanged();
          saveSettings();
        } else if (el.dataset.key === "semitones") {
          controlValues.semitones = val;
          $("#val-pitch").textContent = val;
          controlsChanged();
          saveSettings();
        } else if (el.id === "main-reverb") {
          reverbGain.gain.value = val;
          $("#val-reverb").textContent = val.toFixed(2);
          saveSettings();
        } else if (el.id === "playback" && stretch) {
          stretch.schedule({ input: val, rate: 0 });
        }
      }
      const rect = el.getBoundingClientRect();
      tooltip.textContent = text;
      tooltip.style.display = "block";
      if (el.classList.contains("vertical")) {
        tooltip.style.left = rect.right + 5 + "px";
        const min = parseFloat(el.min),
          max = parseFloat(el.max),
          percent = (val - min) / (max - min);
        const topPos = rect.bottom - rect.height * percent;
        tooltip.style.top = topPos - 10 + "px";
      } else {
        tooltip.style.top = rect.top - 25 + "px";
        const min = parseFloat(el.min),
          max = parseFloat(el.max),
          percent = (val - min) / (max - min);
        const leftPos = rect.left + rect.width * percent;
        tooltip.style.left = leftPos - tooltip.offsetWidth / 2 + "px";
      }
    };
  });
}

window.addEventListener("mouseup", hideTooltip);
window.addEventListener("touchend", hideTooltip);
window.formatTime = (t) => {
  t = parseFloat(t);
  if (isNaN(t)) return "00:00";
  return `${Math.floor(t / 60)}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
};

function createImpulseResponse(duration = 3.0, decay = 2.0, preDelay = 0.02) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  const preDelaySamples = Math.floor(preDelay * sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);

    let lastOut = 0;
    const alpha = 0.12;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;

      lastOut = lastOut + alpha * (white - lastOut);
      const noise = lastOut;

      if (i < preDelaySamples) {
        data[i] = 0;
      } else {
        const t = (i - preDelaySamples) / (length - preDelaySamples);

        const envelope = Math.exp(-decay * t);

        const wobble = 1 + 0.1 * Math.sin(t * 20);

        data[i] = noise * envelope * wobble;
      }
    }

    const reflections = [
      { delay: 0.01, gain: 0.6 },
      { delay: 0.03, gain: 0.4 },
      { delay: 0.07, gain: 0.2 },
      { delay: 0.12, gain: 0.1 },
    ];

    for (const ref of reflections) {
      const delSamples = Math.floor(ref.delay * sampleRate);
      const spread = 40;

      if (delSamples < length) {
        for (let k = 0; k < spread; k++) {
          if (delSamples + k < length) {
            data[delSamples + k] +=
              (Math.random() * 2 - 1) * ref.gain * 0.1 * (1 - k / spread);
          }
        }
      }
    }
  }

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let maxPeak = 0;
    for (let i = 0; i < length; i++)
      maxPeak = Math.max(maxPeak, Math.abs(data[i]));
    if (maxPeak > 0) {
      for (let i = 0; i < length; i++) data[i] /= maxPeak;
      for (let i = 0; i < length; i++) data[i] *= 0.8;
    }
  }

  return impulse;
}
reverbNode.buffer = createImpulseResponse();

function updateReverbConnection() {
  const btn = $("#btn-reverb-toggle");
  try {
    reverbNode.disconnect();
  } catch (e) {}
  try {
    reverbGain.disconnect();
  } catch (e) {}

  if (isReverbOn && eqNodes.length > 0) {
    const lastEqNode = eqNodes[eqNodes.length - 1];
    lastEqNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(analyser);

    btn.textContent = "ON";
    btn.classList.add("theme-text-main");
    btn.classList.remove("text-gray-500");
  } else {
    btn.textContent = "OFF";
    btn.classList.remove("theme-text-main");
    btn.classList.add("text-gray-500");
  }
}

function saveSettings() {
  const currentGains = Array.from(
    document.querySelectorAll("input[data-idx]")
  ).map((inp) => parseFloat(inp.value));
  window.savedEqGains = currentGains;

  const settings = {
    ...savedSettings,
    vol: $("#main-vol").value,
    bal: $("#main-bal").value,
    rate: controlValues.rate,
    pitch: controlValues.semitones,
    isShuffle: isShuffle,
    repeatMode: repeatMode,
    isEqOn: isEqOn,
    playlistId: currentPlaylistId,
    eqGains: currentGains,
    eqPreset: $("#eq-preset-select").value,
    isMono: isMono,
    theme: currentTheme,

    reverbGain: $("#main-reverb").value,
  };

  savedSettings = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const s = savedSettings;
  if (!s) {
    applyThemeToDOM(defaultTheme);
    updateReverbConnection();
    return;
  }
  if (s.vol) {
    $("#main-vol").value = s.vol;
    masterGainNode.gain.value = parseFloat(s.vol);
    $("#txt-vol").textContent = Math.round(s.vol * 100) + "%";
  }
  if (s.bal) {
    $("#main-bal").value = s.bal;
    pannerNode.pan.value = parseFloat(s.bal);
  }
  if (s.rate) {
    controlValues.rate = parseFloat(s.rate);
    $('input[data-key="rate"]').value = s.rate;
    $("#val-rate").textContent = s.rate.toFixed(2);
  }
  if (s.pitch) {
    controlValues.semitones = parseFloat(s.pitch);
    $('input[data-key="semitones"]').value = s.pitch;
    $("#val-pitch").textContent = s.pitch;
  }
  if (s.isShuffle) {
    isShuffle = true;
    $("#tog-shuffle").classList.add("active");
  }
  if (s.repeatMode !== undefined) repeatMode = s.repeatMode;
  updateRepeatBtn();
  if (s.isMono !== undefined) isMono = s.isMono;
  updateMonoStereoState();
  isEqOn = s.isEqOn !== undefined ? s.isEqOn : true;
  $("#txt-eq-status").textContent = isEqOn ? "ON" : "OFF";
  $("#btn-eq-toggle").classList.toggle("pressed", isEqOn);
  if (s.playlistId) currentPlaylistId = s.playlistId;
  if (s.theme) {
    currentTheme = s.theme;
    applyThemeToDOM(currentTheme);
  } else {
    applyThemeToDOM(defaultTheme);
  }

  if (s.reverbGain !== undefined) {
    $("#main-reverb").value = s.reverbGain;
    reverbGain.gain.value = parseFloat(s.reverbGain);
    $("#val-reverb").textContent = parseFloat(s.reverbGain).toFixed(2);
  }

  window.savedEqGains = s.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (s.eqPreset) {
    $("#eq-preset-select").value = s.eqPreset;
  }

  FREQUENCIES.forEach((_, i) => {
    const bg = $(`#eq-bg-${i}`);
    if (bg) {
      if (isEqOn) bg.classList.add("eq-bar-active");
      else bg.classList.remove("eq-bar-active");
    }
  });

  updateReverbConnection();
}

let isEngineHot = false;
const audioStartup = $("#audio-startup"),
  audioLoop = $("#audio-loop");
const loopSource = audioContext.createMediaElementSource(audioLoop);
loopSource.connect(audioContext.destination);

const initAudioEngine = async () => {
  if (isEngineHot) return;
  try {
    if (audioContext.state === "suspended") await audioContext.resume();
    isEngineHot = true;
    audioStartup.volume = 0.5;
    audioLoop.volume = 0.05;
    await audioStartup.play();
    audioLoop.play().catch((e) => {});

    $("#engine-status").style.backgroundColor = "#00ff00";
    $("#engine-status").style.boxShadow = "0 0 4px #0f0";
    $("#marquee").textContent = "Ready.";
  } catch (e) {
    console.error("Init failed", e);
  }
};

document.addEventListener("click", initAudioEngine, { once: true });
document.addEventListener("touchstart", initAudioEngine, { once: true });

const checkAndResumeAudioContext = () => {
  if (
    isEngineHot &&
    (audioContext.state === "suspended" || audioContext.state === "interrupted")
  )
    audioContext.resume();
  if (isEngineHot && audioLoop.paused) audioLoop.play().catch((e) => {});
  if (stretch && controlValues.active && !isChangingTrack) {
    const t = stretch.inputTime || 0;
    if (t >= audioDuration - 0.5) {
      console.log("Auto-Next (Background Check)");
      handleNextTrack(true);
    }
  }
};
setInterval(checkAndResumeAudioContext, 1000);
["visibilitychange", "touchstart", "click"].forEach((evt) =>
  document.addEventListener(evt, checkAndResumeAudioContext)
);

let stretch = null,
  eqNodes = [],
  analyser = audioContext.createAnalyser();
let masterGainNode = audioContext.createGain(),
  pannerNode = audioContext.createStereoPanner();

let stereoPath = audioContext.createGain();
let monoPath = audioContext.createGain();

monoPath.channelCount = 1;
monoPath.channelCountMode = "explicit";
monoPath.channelInterpretation = "speakers";

let isMono = false,
  audioDuration = 1,
  isChangingTrack = false,
  playDebounceTimer = null;

analyser.connect(stereoPath);
analyser.connect(monoPath);
stereoPath.connect(pannerNode);
monoPath.connect(pannerNode);

pannerNode.connect(masterGainNode);
masterGainNode.connect(audioContext.destination);
masterGainNode.gain.value = 0.8;
analyser.fftSize = 64;

const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  pop: [-1, 1, 3, 3, 1, -1, -2, -2, -1, -1],
  jazz: [3, 2, 0, -2, -2, 0, 2, 3, 4, 4],
  fullbass: [6, 6, 5, 2, 0, -2, -4, -5, -6, -6],
};
let controlValues = { active: false, rate: 1, semitones: 0 },
  isEqOn = true;

function initEQ() {
  eqNodes.forEach((n) => {
    try {
      n.disconnect();
    } catch (e) {}
  });
  eqNodes = [];
  let prev = null,
    first = null;
  FREQUENCIES.forEach((freq, i) => {
    const f = audioContext.createBiquadFilter();
    f.type = "peaking";
    f.frequency.value = freq;
    f.Q.value = 1.4;

    let targetVal =
      window.savedEqGains && window.savedEqGains[i] !== undefined
        ? window.savedEqGains[i]
        : 0;

    const slider = document.querySelector(`input[data-idx="${i}"]`);
    if (slider) {
      slider.value = targetVal;
      updateThumb(slider, `thumb-${i}`);
    }

    f.gain.value = isEqOn ? targetVal : 0;
    eqNodes.push(f);
    if (prev) prev.connect(f);
    else first = f;
    prev = f;
  });
  return { input: first, output: prev };
}

async function loadAudioEngine(arrayBuffer, trackObj) {
  if (!isEngineHot) await initAudioEngine();
  checkAndResumeAudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioDuration = audioBuffer.duration;
  const channelBuffers = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; ++c)
    channelBuffers.push(audioBuffer.getChannelData(c));
  if (stretch) {
    stretch.stop();
    stretch.disconnect();
  }
  stretch = await SignalsmithStretch(audioContext);
  const eqChain = initEQ();
  stretch.connect(eqChain.input);
  eqChain.output.connect(analyser);

  updateReverbConnection();

  await stretch.addBuffers(channelBuffers);
  controlValues.active = true;
  controlsChanged();
  isChangingTrack = false;
  updateMediaSession(trackObj.name);
  $("#info-samplerate").textContent = audioBuffer.sampleRate / 1000 + " khz";
  if (trackObj.blob && trackObj.blob.size) {
    const kbps = Math.round((trackObj.blob.size * 8) / audioDuration / 1000);
    $("#info-bitrate").textContent = kbps + " k";
  } else {
    $("#info-bitrate").textContent = "N/A";
  }
  attachTooltips();
  drawEQCurve();
}

function controlsChanged(scheduleAhead) {
  $("#btn-play").classList.toggle("pressed", controlValues.active);
  if (stretch) {
    let obj = Object.assign(
      { output: audioContext.currentTime + (scheduleAhead || 0) },
      controlValues
    );
    stretch.schedule(obj);
  }
  updatePositionState();
}

function updateMediaSession(trackName) {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: trackName,
      artist: "Nextamp Player",
      artwork: [
        {
          src: "https://next-amp-player.vercel.app/assets/logo/logo.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () =>
      $("#btn-play").click()
    );
    navigator.mediaSession.setActionHandler("pause", () =>
      $("#btn-pause").click()
    );
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      $("#btn-prev").click()
    );
    navigator.mediaSession.setActionHandler("nexttrack", () =>
      $("#btn-next").click()
    );
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && stretch) {
        stretch.schedule({ input: details.seekTime });
        updatePositionState();
      }
    });
    updatePositionState();
  }
}

function updatePositionState() {
  if ("mediaSession" in navigator && stretch) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audioDuration || 0,
        playbackRate: controlValues.active ? controlValues.rate : 0,
        position: stretch.inputTime || 0,
      });
    } catch (e) {}
  }
}

let LIBRARY = [],
  playlists = { main: { name: "Main Library", trackIds: [] } },
  currentPlaylistId = "main",
  currentTrackIndex = -1,
  selectedIndices = new Set(),
  lastSelectedIndex = -1;
const DB_NAME = "NextampUltimateDB",
  dbReq = indexedDB.open(DB_NAME, 8);
dbReq.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains("library"))
    db.createObjectStore("library", { keyPath: "id" });
  if (!db.objectStoreNames.contains("playlists"))
    db.createObjectStore("playlists", { keyPath: "id" });
};
dbReq.onsuccess = async (e) => {
  await loadLibraryFromDB();
  await loadPlaylistsFromDB();
  loadSettings();
  renderPlaylistSelect();
  renderPlaylistUI();
  initEQ();
  drawEQCurve();
  attachTooltips();
};
async function saveTrackToLib(track) {
  const db = dbReq.result;
  const tx = db.transaction("library", "readwrite");
  tx.objectStore("library").put(track);
}
async function deleteTrackFromLib(id) {
  const db = dbReq.result;
  const tx = db.transaction("library", "readwrite");
  tx.objectStore("library").delete(id);
}
async function savePlaylistsToDB(plObj) {
  const db = dbReq.result;
  const tx = db.transaction("playlists", "readwrite");
  tx.objectStore("playlists").put(plObj);
}
async function loadLibraryFromDB() {
  return new Promise((resolve) => {
    const db = dbReq.result;
    const tx = db.transaction("library", "readonly");
    const req = tx.objectStore("library").getAll();
    req.onsuccess = () => {
      LIBRARY = req.result || [];
      resolve();
    };
  });
}
async function loadPlaylistsFromDB() {
  return new Promise((resolve) => {
    const db = dbReq.result;
    const tx = db.transaction("playlists", "readonly");
    const req = tx.objectStore("playlists").getAll();
    req.onsuccess = () => {
      if (req.result) req.result.forEach((p) => (playlists[p.id] = p));
      resolve();
    };
  });
}
const getTrackById = (id) => LIBRARY.find((t) => t.id === id);
function getCurrentDisplayList() {
  if (currentPlaylistId === "main") return LIBRARY;
  return playlists[currentPlaylistId].trackIds
    .map((id) => getTrackById(id))
    .filter((t) => t);
}

async function playTrack(idx) {
  if (!isEngineHot) await initAudioEngine();
  if (playDebounceTimer) clearTimeout(playDebounceTimer);
  isChangingTrack = true;
  let list = getCurrentDisplayList();
  if (idx < 0 || idx >= list.length) {
    isChangingTrack = false;
    return;
  }
  currentTrackIndex = idx;
  renderPlaylistUI();
  const t = list[idx];
  $("#marquee").textContent = `${idx + 1}. ${t.name} (Loading...)`;
  playDebounceTimer = setTimeout(async () => {
    checkAndResumeAudioContext();
    try {
      const buf = await t.blob.arrayBuffer();
      await loadAudioEngine(buf, t);
      $("#marquee").textContent = `${idx + 1}. ${t.name}`;
    } catch (e) {
      console.error("Play Error:", e);
      $("#marquee").textContent = "Error loading file.";
      isChangingTrack = false;

      t.hasError = true;
      await saveTrackToLib(t);
      renderPlaylistUI();
    }
  }, 200);
}

function handleNextTrack(auto = false) {
  let list = getCurrentDisplayList();
  if (list.length === 0) return;
  let next;
  if (auto && repeatMode === 2) {
    next = currentTrackIndex;
  } else if (isShuffle) {
    if (list.length > 1) {
      do {
        next = Math.floor(Math.random() * list.length);
      } while (next === currentTrackIndex);
    } else next = 0;
  } else {
    next = currentTrackIndex + 1;
  }
  if (next < list.length) {
    playTrack(next);
  } else {
    if (repeatMode === 1) {
      playTrack(0);
    } else {
      $("#btn-stop").click();
    }
  }
}

function handlePrevTrack() {
  let list = getCurrentDisplayList();
  if (list.length === 0) return;
  let prev = isShuffle
    ? Math.floor(Math.random() * list.length)
    : currentTrackIndex - 1;
  if (prev < 0) prev = repeatMode === 1 ? list.length - 1 : 0;
  playTrack(prev);
}

$("#btn-play").onclick = async () => {
  if (!isEngineHot) await initAudioEngine();
  checkAndResumeAudioContext();
  const list = getCurrentDisplayList();
  if (!stretch && list.length > 0) playTrack(Math.max(0, currentTrackIndex));
  else if (stretch) {
    controlValues.active = !controlValues.active;
    controlsChanged(0.1);
  }
};
$("#btn-pause").onclick = () => {
  controlValues.active = false;
  controlsChanged();
};
$("#btn-stop").onclick = () => {
  controlValues.active = false;
  if (stretch) stretch.stop();
  $("#playback").value = 0;
  $("#time-display").textContent = "00:00";
  $("#btn-play").classList.remove("pressed");
  $("#marquee").textContent = "Stopped.";
  isChangingTrack = false;
  updatePositionState();
};
$("#btn-next").onclick = () => handleNextTrack(false);
$("#btn-prev").onclick = () => handlePrevTrack();

const eqContainer = $("#eq-container"),
  eqCanvas = $("#eq-graph"),
  eqCtx = eqCanvas.getContext("2d");

$("#btn-eq-toggle").onclick = () => {
  isEqOn = !isEqOn;
  $("#txt-eq-status").textContent = isEqOn ? "ON" : "OFF";
  $("#btn-eq-toggle").classList.toggle("pressed", isEqOn);
  $$("input[data-idx]").forEach((inp, i) => updateEqBand(i, inp.value));
  saveSettings();
};

FREQUENCIES.forEach((f, i) => {
  const div = document.createElement("div");

  div.className =
    "flex flex-col items-center h-full flex-1 group relative py-3";

  div.innerHTML = `<div class="relative h-full w-full flex justify-center"><div class="eq-bar-bg ${
    isEqOn ? "eq-bar-active" : ""
  }" id="eq-bg-${i}"></div><div class="eq-thumb " style="top: 50%" id="thumb-${i}"></div><input type="range" class="vertical" style="height: 120%; top: -10%;" min="-12" max="12" step="0.5" value="0" data-idx="${i}" data-tooltip-type="db"></div><div class="absolute -bottom-1 text-[7px] theme-text-main font-pixel tracking-tighter pointer-events-none">${
    f >= 1000 ? f / 1000 + "k" : f
  }</div>`;
  div.querySelector("input").ondblclick = (e) => {
    e.target.value = 0;
    handleEqInput(i, 0, e.target);
  };
  eqContainer.appendChild(div);
});

window.handleEqInput = (idx, val, el) => {
  if ($("#eq-preset-select").value !== "custom") {
    $("#eq-preset-select").value = "custom";
  }
  updateEqBand(idx, val);
  updateThumb(el, `thumb-${idx}`);
};

window.updateThumb = (input, thumbId) => {
  const min = parseFloat(input.min),
    max = parseFloat(input.max),
    val = parseFloat(input.value),
    percent = ((val - min) / (max - min)) * 100;
  const thumb = $(`#${thumbId}`);
  if (thumb) thumb.style.top = `${100 - percent}%`;
};

window.updateEqBand = (idx, val) => {
  if (eqNodes[idx]) eqNodes[idx].gain.value = isEqOn ? parseFloat(val) : 0;
  const bg = $(`#eq-bg-${idx}`);
  if (bg) {
    if (isEqOn) bg.classList.add("eq-bar-active");
    else bg.classList.remove("eq-bar-active");
  }
  drawEQCurve();
  saveSettings();
};

function drawEQCurve() {
  eqCtx.clearRect(0, 0, eqCanvas.width, eqCanvas.height);
  eqCtx.strokeStyle = "#333";
  eqCtx.lineWidth = 1;
  eqCtx.beginPath();
  eqCtx.moveTo(0, 15);
  eqCtx.lineTo(180, 15);
  eqCtx.stroke();
  if (!isEqOn) return;
  eqCtx.strokeStyle = currentTheme.text;
  eqCtx.lineWidth = 2;
  eqCtx.beginPath();
  const stepX = eqCanvas.width / (FREQUENCIES.length - 1),
    points = [];
  FREQUENCIES.forEach((_, i) => {
    let gain = 0;
    if (eqNodes[i]) gain = eqNodes[i].gain.value;
    else {
      const inp = $(`input[data-idx="${i}"]`);
      gain = inp ? parseFloat(inp.value) : 0;
    }
    points.push({ x: i * stepX, y: 15 - gain * (15 / 14) });
  });
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
  eqCtx.stroke();
}

$("#eq-preset-select").onchange = (e) => {
  const val = e.target.value;
  if (PRESETS[val]) {
    PRESETS[val].forEach((v, i) => {
      const inp = $(`input[data-idx="${i}"]`);
      if (inp) {
        inp.value = v;
        updateThumb(inp, `thumb-${i}`);
        if (eqNodes[i]) eqNodes[i].gain.value = isEqOn ? v : 0;
      }
    });
    drawEQCurve();
    saveSettings();
  }
};

const cvs = $("#visualizer"),
  ctx = cvs.getContext("2d");
const visualModeNames = ["BAR", "LINE", "WAVE", "OFF"];
let visualMode = 0;

$("#visualizer-container").onclick = () => {
  visualMode = (visualMode + 1) % 4;
  const indicator = $("#v-status-indicator");
  indicator.textContent = `${visualModeNames[visualMode]}`;
  indicator.style.opacity = visualMode === 3 ? "0.5" : "1";
};

function resizeCvs() {
  const r = cvs.parentElement.getBoundingClientRect();
  cvs.width = r.width;
  cvs.height = r.height;
}
window.addEventListener("resize", resizeCvs);
setTimeout(resizeCvs, 500);

let lastUpdateTime = 0;
let lastFrameTime = 0;
const targetFPS = 60;

function draw(time) {
  requestAnimationFrame(draw);
  if (time - lastFrameTime < 1000 / targetFPS) return;
  lastFrameTime = time;
  if (time - lastUpdateTime > 1000) {
    updatePositionState();
    lastUpdateTime = time;
  }
  if (stretch && !holding) {
    const pb = $("#playback");
    pb.max = audioDuration;
    const t = stretch.inputTime || 0;
    pb.value = t;
    $("#time-display").textContent = formatTime(t);
    if (controlValues.active && t >= audioDuration - 0.2 && !isChangingTrack) {
      handleNextTrack(true);
    }
  }
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  if (visualMode === 3) return;
  const bufferLength = analyser.frequencyBinCount,
    dataArray = new Uint8Array(bufferLength);
  if (visualMode === 0) {
    analyser.getByteFrequencyData(dataArray);
    const visualHeight = cvs.height * 0.7;
    const baseY = cvs.height;
    const barWidth = (cvs.width / bufferLength) * 2.5;
    const gradient = ctx.createLinearGradient(
      0,
      baseY,
      0,
      baseY - visualHeight
    );
    gradient.addColorStop(0, currentTheme.eq1);
    gradient.addColorStop(0.6, currentTheme.eq2);
    gradient.addColorStop(1, currentTheme.eq3);
    ctx.fillStyle = gradient;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i] / 255;
      const barHeight = value * visualHeight;
      if (barHeight > 0)
        ctx.fillRect(x, baseY - barHeight, barWidth - 1, barHeight);
      x += barWidth;
    }
  } else if (visualMode === 1) {
    analyser.getByteFrequencyData(dataArray);
    const visualHeight = cvs.height * 0.7;
    const baseY = cvs.height;
    ctx.lineWidth = 2;
    ctx.strokeStyle = currentTheme.text;
    ctx.beginPath();
    const sliceWidth = cvs.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 255;
      const y = baseY - v * visualHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
  } else if (visualMode === 2) {
    analyser.getByteTimeDomainData(dataArray);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#00ffff";
    ctx.beginPath();
    const sliceWidth = (cvs.width * 1.0) / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = cvs.height / 2 + (v - 1) * (cvs.height / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
  }
}
requestAnimationFrame(draw);

$("#pl-box").onclick = (e) => {
  if (e.target.id === "pl-box" || e.target.classList.contains("text-center")) {
    selectedIndices.clear();
    renderPlaylistUI();
  }
};

window.renderPlaylistUI = () => {
  const box = $("#pl-box");
  box.innerHTML = "";
  let displayList = getCurrentDisplayList();
  if (displayList.length === 0)
    box.innerHTML = `<div class="text-gray-500 text-center mt-10 text-[10px] pointer-events-none">${
      currentPlaylistId === "main"
        ? "Drop files or Click ADD..."
        : "Playlist empty."
    }</div>`;
  else {
    displayList.forEach((t, i) => {
      const d = document.createElement("div");

      if (selectedIndices.has(i)) {
        d.classList.add("theme-highlight-bg");
      } else {
        if (t.hasError) {
          d.className += " text-red-500 hover:bg-[#222]";
        } else {
          d.className += " theme-text-main hover:bg-[#222]";
        }
      }

      let textClass = i === currentTrackIndex ? "font-bold text-white" : "";
      d.className += ` cursor-pointer px-1 flex justify-between select-none ${textClass}`;
      d.draggable = true;
      d.innerHTML = `<div class="flex truncate w-full pointer-events-none"><span class="w-6 text-right mr-2 flex-shrink-0">${
        i + 1
      }.</span><span class="truncate">${t.name}</span></div>`;
      d.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", i);
        d.classList.add("dragging");
      };
      d.ondragend = () => d.classList.remove("dragging");
      d.ondragover = (e) => {
        e.preventDefault();
        d.classList.add("drag-over");
      };
      d.ondragleave = () => d.classList.remove("drag-over");
      d.ondrop = (e) => {
        e.preventDefault();
        d.classList.remove("drag-over");
        handleDragDrop(parseInt(e.dataTransfer.getData("text/plain")), i);
      };
      let lastTapTime = 0;
      d.ontouchend = (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0) {
          e.preventDefault();
          playTrack(i);
        }
        lastTapTime = currentTime;
      };
      d.onclick = (e) => {
        e.stopPropagation();
        if (e.shiftKey && lastSelectedIndex !== -1) {
          const start = Math.min(lastSelectedIndex, i);
          const end = Math.max(lastSelectedIndex, i);
          selectedIndices.clear();
          for (let k = start; k <= end; k++) selectedIndices.add(k);
        } else if (e.ctrlKey || e.metaKey) {
          selectedIndices.has(i)
            ? selectedIndices.delete(i)
            : selectedIndices.add(i);
          lastSelectedIndex = i;
        } else {
          selectedIndices.clear();
          selectedIndices.add(i);
          lastSelectedIndex = i;
        }
        renderPlaylistUI();
      };
      d.ondblclick = () => playTrack(i);
      box.appendChild(d);
    });
  }
  $("#pl-count").textContent = `${displayList.length} TRACKS`;
  const hasSel = selectedIndices.size > 0;
  const toggleDisableStyle = (btnId, isDisabled) => {
    const btn = $(btnId);
    btn.disabled = isDisabled;
    if (isDisabled) {
      btn.classList.add("text-gray-500", "cursor-default");
      btn.classList.remove("text-red-900", "text-black", "cursor-pointer");
    } else {
      btn.classList.remove("text-gray-500", "cursor-default");
      btn.classList.add("cursor-pointer");
      if (btnId === "#btn-del-track") btn.classList.add("text-red-900");
      else btn.classList.add("text-black");
    }
  };
  toggleDisableStyle("#btn-del-track", !hasSel);
  toggleDisableStyle("#btn-move-up", !hasSel);
  toggleDisableStyle("#btn-move-down", !hasSel);
  $("#btn-del-pl").style.display =
    currentPlaylistId === "main" ? "none" : "block";
};

window.moveTrack = (dir) => {
  if (selectedIndices.size !== 1) return;
  const idx = Array.from(selectedIndices)[0];
  handleDragDrop(idx, idx + dir);
};

window.handleDragDrop = async (srcIdx, targetIdx) => {
  let list = getCurrentDisplayList();
  if (targetIdx < 0 || targetIdx >= list.length || srcIdx === targetIdx) return;
  const item = list.splice(srcIdx, 1)[0];
  list.splice(targetIdx, 0, item);
  if (currentTrackIndex === srcIdx) currentTrackIndex = targetIdx;
  else if (currentTrackIndex === targetIdx && srcIdx > targetIdx)
    currentTrackIndex++;
  else if (currentTrackIndex === targetIdx && srcIdx < targetIdx)
    currentTrackIndex--;
  if (currentPlaylistId !== "main") {
    playlists[currentPlaylistId].trackIds = list.map((t) => t.id);
    await savePlaylistsToDB(playlists[currentPlaylistId]);
  }
  selectedIndices.clear();
  selectedIndices.add(targetIdx);
  renderPlaylistUI();
};

window.handleDeleteTracks = async () => {
  if (selectedIndices.size === 0) return;
  customConfirm(
    `Remove ${selectedIndices.size} selected track(s)?`,
    async () => {
      const indices = Array.from(selectedIndices).sort((a, b) => b - a);
      if (currentPlaylistId === "main") {
        const list = getCurrentDisplayList();
        for (let i of indices) {
          await deleteTrackFromLib(list[i].id);
          LIBRARY.splice(i, 1);
        }
      } else {
        const pl = playlists[currentPlaylistId];
        for (let i of indices) pl.trackIds.splice(i, 1);
        await savePlaylistsToDB(pl);
      }
      selectedIndices.clear();
      renderPlaylistUI();
    }
  );
};

window.handleDeletePlaylist = () => {
  if (currentPlaylistId === "main") return;
  customConfirm(
    `Delete playlist "${playlists[currentPlaylistId].name}"?`,
    () => {
      delete playlists[currentPlaylistId];
      const db = dbReq.result;
      const tx = db.transaction("playlists", "readwrite");
      tx.objectStore("playlists").delete(currentPlaylistId);
      switchPlaylist("main");
      renderPlaylistSelect();
    }
  );
};

const fileInput = $("#upload-file");
$("#btn-pl-add").onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFiles(e.target.files);
document.body.ondragover = (e) => e.preventDefault();
document.body.ondrop = (e) => {
  e.preventDefault();
  handleFiles(e.dataTransfer.files);
};

async function handleFiles(files) {
  if (!isEngineHot) await initAudioEngine();
  checkAndResumeAudioContext();
  if (!isEngineHot) await audioContext.resume();
  for (const f of files) {
    const id = "t_" + Date.now() + Math.random();
    const obj = { id, name: f.name, blob: f };
    LIBRARY.push(obj);
    await saveTrackToLib(obj);
    if (currentPlaylistId !== "main") {
      playlists[currentPlaylistId].trackIds.push(id);
      await savePlaylistsToDB(playlists[currentPlaylistId]);
    }
  }
  renderPlaylistUI();
}

window.openNewPlaylistModal = () => {
  $("#new-playlist-name").value = "";
  $("#modal-new-playlist").classList.remove("hidden");
  $("#new-playlist-name").focus();
};
window.closeNewPlaylistModal = () =>
  $("#modal-new-playlist").classList.add("hidden");
window.confirmNewPlaylist = () => {
  const n = $("#new-playlist-name").value;
  if (n && n.trim().length > 0) {
    createNewPlaylist(n.trim());
    closeNewPlaylistModal();
  }
};
window.createNewPlaylist = (name) => {
  const id = "pl_" + Date.now();
  playlists[id] = { id, name: name, trackIds: [] };
  savePlaylistsToDB(playlists[id]);
  renderPlaylistSelect();
  switchPlaylist(id);
};
window.switchPlaylist = (id) => {
  currentPlaylistId = id;
  $("#playlist-select").value = id;
  selectedIndices.clear();
  renderPlaylistUI();
  saveSettings();
};
window.renderPlaylistSelect = () => {
  const s = $("#playlist-select");
  s.innerHTML = '<option value="main">Main Library</option>';
  Object.keys(playlists)
    .filter((k) => k !== "main")
    .forEach((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = playlists[k].name;
      s.appendChild(o);
    });
  s.value = currentPlaylistId;
};
$("#playlist-select").onchange = (e) => switchPlaylist(e.target.value);

window.openAddToModal = () => {
  if (!selectedIndices.size) return customAlert("Select tracks first");
  const d = $("#modal-list");
  d.innerHTML = "";
  Object.keys(playlists)
    .filter((k) => k !== "main")
    .forEach((k) => {
      const b = document.createElement("button");
      b.className =
        "w-full text-left px-2 py-1 text-[10px] text-gray-300 hover:bg-win-green hover:text-black font-pixel border border-gray-600 mb-1";
      b.textContent = playlists[k].name;
      b.onclick = () => {
        const list = getCurrentDisplayList();
        const ids = Array.from(selectedIndices).map((i) => list[i].id);
        playlists[k].trackIds.push(...ids);
        savePlaylistsToDB(playlists[k]);
        closeAddToModal();
        selectedIndices.clear();
        renderPlaylistUI();
      };
      d.appendChild(b);
    });
  $("#modal-add-to").classList.remove("hidden");
};
window.closeAddToModal = () => $("#modal-add-to").classList.add("hidden");

let isShuffle = false,
  repeatMode = 0;
$("#tog-shuffle").onclick = function () {
  isShuffle = !isShuffle;
  this.classList.toggle("active", isShuffle);
  saveSettings();
};
const updateRepeatBtn = () => {
  const btn = $("#tog-repeat");
  btn.classList.remove("active", "active-gold");
  if (repeatMode === 0) btn.textContent = "REPEAT";
  else if (repeatMode === 1) {
    btn.classList.add("active");
    btn.textContent = "REP ALL";
  } else if (repeatMode === 2) {
    btn.classList.add("active-gold");
    btn.textContent = "REP 1";
  }
};
$("#tog-repeat").onclick = function () {
  repeatMode = (repeatMode + 1) % 3;
  updateRepeatBtn();
  saveSettings();
};

const updateMonoStereoState = () => {
  if (isMono) {
    stereoPath.gain.value = 0;
    monoPath.gain.value = 1;
    $("#btn-mono-stereo").textContent = "MONO";
    $("#btn-mono-stereo").classList.remove("theme-text-main");
    $("#btn-mono-stereo").classList.add("theme-text-sec");
  } else {
    stereoPath.gain.value = 1;
    monoPath.gain.value = 0;
    $("#btn-mono-stereo").textContent = "STEREO";
    $("#btn-mono-stereo").classList.add("theme-text-main");
    $("#btn-mono-stereo").classList.remove("theme-text-sec");
  }
};

$("#btn-mono-stereo").onclick = async () => {
  if (audioContext.state === "suspended") await audioContext.resume();
  isMono = !isMono;
  updateMonoStereoState();
  saveSettings();
};

$("#btn-reverb-toggle").onclick = () => {
  isReverbOn = !isReverbOn;
  updateReverbConnection();
  saveSettings();
};

window.toggleSection = (id) => $(`#${id}`).classList.toggle("hidden");
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#btn-install-pwa").classList.remove("hidden");
});
$("#btn-install-pwa").onclick = async () => {
  $("#btn-install-pwa").classList.add("hidden");
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt = null;
  }
};

const pb = $("#playback");
let holding = false;
pb.onmousedown = pb.ontouchstart = () => (holding = true);
pb.onmouseup = pb.ontouchend = () => {
  holding = false;
  if (stretch) {
    stretch.schedule({
      input: parseFloat(pb.value),
      rate: controlValues.rate,
      semitones: controlValues.semitones,
    });
    updatePositionState();
  }
};
pb.oninput = () => {
  if (!stretch) return;
  stretch.schedule({ input: parseFloat(pb.value), rate: 0 });
};

$("#main-vol").oninput = (e) => {
  masterGainNode.gain.value = parseFloat(e.target.value);
  $("#txt-vol").textContent = Math.round(e.target.value * 100) + "%";
  saveSettings();
};
$("#main-bal").oninput = (e) => {
  pannerNode.pan.value = parseFloat(e.target.value);
  saveSettings();
};
$('[data-key="rate"]').oninput = (e) => {
  controlValues.rate = parseFloat(e.target.value);
  $("#val-rate").textContent = controlValues.rate.toFixed(2);
  controlsChanged();
  saveSettings();
};
$('[data-key="semitones"]').oninput = (e) => {
  controlValues.semitones = parseFloat(e.target.value);
  $("#val-pitch").textContent = controlValues.semitones;
  controlsChanged();
  saveSettings();
};

function audioBufferToWav(buffer, opt) {
  opt = opt || {};
  var numChannels = buffer.numberOfChannels;
  var sampleRate = buffer.sampleRate;
  var format = opt.float32 ? 3 : 1;
  var bitDepth = format === 3 ? 32 : 16;

  var result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
}

function interleave(inputL, inputR) {
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);
  var index = 0;
  var inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8;
  var blockAlign = numChannels * bytesPerSample;

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);

  if (format === 1) {
    floatTo16BitPCM(view, 44, samples);
  } else {
    floatTo32BitPCM(view, 44, samples);
  }

  return new Blob([view], { type: "audio/wav" });
}

function floatTo16BitPCM(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function floatTo32BitPCM(output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true);
  }
}

function writeString(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function createOfflineImpulseResponse(ctx, duration = 3.0, decay = 2.0) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = lastOut + 0.12 * (white - lastOut);
      const t = i / length;
      const envelope = Math.exp(-decay * t * (duration / 3));
      data[i] = lastOut * envelope;
    }
  }
  return impulse;
}

window.exportCurrentTrackWav = async () => {
  const list = getCurrentDisplayList();
  if (currentTrackIndex < 0 || !list[currentTrackIndex]) {
    customAlert("No track loaded to export.");
    return;
  }

  const track = list[currentTrackIndex];
  const originalRate = controlValues.rate || 1.0;

  $("#marquee").textContent = "Preparing Export...";
  const arrayBuffer = await track.blob.arrayBuffer();

  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const newDuration = audioBuffer.duration / originalRate;

  const LIMIT_MINUTES = 10;
  if (newDuration > LIMIT_MINUTES * 60) {
    customConfirm(
      `Output is very long (${(newDuration / 60).toFixed(
        1
      )} mins). It may freeze your device. Continue?`,
      () => startRenderingProcess(audioBuffer, newDuration, track.name)
    );
  } else {
    startRenderingProcess(audioBuffer, newDuration, track.name);
  }
};
function updateExportButtonState(isLoading) {
  const btn = $("#btn-export");
  if (!btn) return;

  if (isLoading) {
    btn.disabled = true;
    btn.classList.add("pressed");

    btn.innerHTML =
      '<i class="ph-bold ph-hourglass animate-hourglass text-sm"></i>';

    document.body.style.cursor = "wait";
  } else {
    btn.disabled = false;
    btn.classList.remove("pressed");
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk text-sm"></i>';

    document.body.style.cursor = "default";

    btn.classList.remove("btn-working-analog");
    btn.classList.remove("text-win-green", "border-win-green");
    btn.classList.add("text-win-green");
  }
}

async function startRenderingProcess(sourceBuffer, duration, filename) {
  const btn = $("#btn-export");
  if (btn.disabled) return;

  updateExportButtonState(true);
  $("#marquee").textContent = "Processing Audio... 0%";

  let mp3Worker = null;

  try {
    const extraTail = isReverbOn ? 2 : 0;

    const offlineCtx = new OfflineAudioContext(
      2,
      (duration + extraTail) * 44100,
      44100
    );

    const offStretch = await SignalsmithStretch(offlineCtx);
    const channelBuffers = [];
    for (let c = 0; c < sourceBuffer.numberOfChannels; c++) {
      channelBuffers.push(sourceBuffer.getChannelData(c));
    }
    await offStretch.addBuffers(channelBuffers);

    offStretch.schedule({
      active: true,
      input: 0,
      rate: controlValues.rate,
      semitones: controlValues.semitones,
    });

    let outputNode = offStretch;

    const currentEqGains = Array.from(
      document.querySelectorAll("input[data-idx]")
    ).map((inp) => parseFloat(inp.value));

    if (isEqOn) {
      let prev = offStretch;
      FREQUENCIES.forEach((freq, i) => {
        const f = offlineCtx.createBiquadFilter();
        f.type = "peaking";
        f.frequency.value = freq;
        f.Q.value = 1.4;
        f.gain.value = currentEqGains[i] || 0;
        prev.connect(f);
        prev = f;
      });
      outputNode = prev;
    }

    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = parseFloat($("#main-vol").value);
    outputNode.connect(masterGain);
    masterGain.connect(offlineCtx.destination);

    if (isReverbOn) {
      const revNode = offlineCtx.createConvolver();
      revNode.buffer = createOfflineImpulseResponse(offlineCtx);
      const revGain = offlineCtx.createGain();
      revGain.gain.value = parseFloat($("#main-reverb").value);
      outputNode.connect(revNode);
      revNode.connect(revGain);
      revGain.connect(offlineCtx.destination);
    }

    $("#marquee").textContent = "Rendering Effects... (Please wait)";

    const renderedBuffer = await offlineCtx.startRendering();

    $("#marquee").textContent = "Encoding MP3... (0%)";

    return new Promise((resolve, reject) => {
      mp3Worker = new Worker("/assets/libs/worker/mp3-worker.js");

      const channels = 2;
      const channelData = [
        renderedBuffer.getChannelData(0),
        renderedBuffer.numberOfChannels > 1
          ? renderedBuffer.getChannelData(1)
          : renderedBuffer.getChannelData(0),
      ];

      mp3Worker.postMessage({
        channelData: channelData,
        sampleRate: renderedBuffer.sampleRate,
        channels: channels,
      });

      mp3Worker.onmessage = function (e) {
        if (e.data.type === "progress") {
          const percent = Math.round(e.data.value * 100);
          $("#marquee").textContent = `Encoding MP3... (${percent}%)`;
        } else if (e.data.type === "done") {
          const url = URL.createObjectURL(e.data.blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          const cleanName = filename.replace(/\.[^/.]+$/, "");
          a.download = `Remix_${cleanName}.mp3`;
          document.body.appendChild(a);
          a.click();

          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            $("#marquee").textContent = "Export Complete.";
            updateExportButtonState(false);

            if (mp3Worker) mp3Worker.terminate();
            resolve();
          }, 100);
        }
      };

      mp3Worker.onerror = function (error) {
        console.error(error);
        customAlert("Worker Error: " + error.message);
        updateExportButtonState(false);

        if (mp3Worker) mp3Worker.terminate();
        reject(error);
      };
    });
  } catch (e) {
    console.error(e);
    customAlert("Export Failed: " + e.message);
    $("#marquee").textContent = "Error.";
    updateExportButtonState(false);

    if (mp3Worker) mp3Worker.terminate();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === " ") {
    const activeTag = document.activeElement.tagName.toLowerCase();
    const activeType = document.activeElement.type;

    if (
      activeTag === "textarea" ||
      (activeTag === "input" && activeType === "text")
    ) {
      return;
    }

    e.preventDefault();

    if (controlValues.active) {
      $("#btn-pause").click();
    } else {
      $("#btn-play").click();
    }
  }
});
