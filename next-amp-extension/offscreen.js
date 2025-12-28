// offscreen.js
import SignalsmithStretch from "./assets/libs/mjs/SignalsmithStretch.mjs";

let audioCtx, source, stretch;
let reverbNode, reverbGain, panNode, masterGain;
let eqNodes = [];
let analyser;
let globalStream = null;

const FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
let params = {
  pitch: 0,
  reverb: 0,
  pan: 0,
  volume: 1.0,
  visualMode: 0,
  isEqOn: true,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_CAPTURE") {
    startAudio(msg.streamId);
  } else if (msg.type === "SET_PARAM") {
    if (msg.key === "reset") {
      resetParams();
    } else {
      updateParams(msg);
    }
  } else if (msg.type === "GET_STATE") {
    const currentEq = eqNodes.length ? eqNodes.map((n) => n.gain.value) : [];
    const isActive = audioCtx && audioCtx.state === "running";
    sendResponse({
      ...params,
      eqGains: currentEq,
      isAudioActive: isActive, // บอก Popup ว่า Audio ทำงานอยู่หรือไม่
    });
  } else if (msg.type === "STOP_CAPTURE") {
    stopAudio();
  }
  return true;
});

function resetParams() {
  params = {
    pitch: 0,
    reverb: 0,
    pan: 0,
    volume: 1.0,
    visualMode: 0,
    isEqOn: true,
  };
  updateParams({ key: "pitch", value: 0 });
  updateParams({ key: "reverb", value: 0 });
  updateParams({ key: "pan", value: 0 });
  updateParams({ key: "volume", value: 1.0 });
  eqNodes.forEach((n) => (n.gain.value = 0));
}

function stopAudio() {
  if (globalStream) {
    globalStream.getTracks().forEach((track) => track.stop()); // หยุด Stream จริงๆ
    globalStream = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch (e) {}
    audioCtx = null;
  }
  params.visualMode = 3; // Off logic
}

async function startAudio(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    });

    if (audioCtx) await audioCtx.close();

    globalStream = stream;
    audioCtx = new AudioContext();
    source = audioCtx.createMediaStreamSource(stream);

    masterGain = audioCtx.createGain();
    reverbGain = audioCtx.createGain();
    panNode = audioCtx.createStereoPanner();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    eqNodes = FREQUENCIES.map((f) => {
      const n = audioCtx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = f;
      n.gain.value = 0;
      return n;
    });

    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createImpulseResponse(3.0, 2.0);
    reverbGain.gain.value = 0;

    try {
      if (!SignalsmithStretch.wasLoaded) {
        SignalsmithStretch.moduleUrl = chrome.runtime.getURL(
          "assets/libs/mjs/SignalsmithStretch.mjs"
        );
        SignalsmithStretch.wasLoaded = true;
      }
      stretch = await SignalsmithStretch(audioCtx);
    } catch (err) {
      console.error("Stretch Load Error:", err);
    }

    let lastNode = source;
    if (stretch) {
      source.connect(stretch);
      lastNode = stretch;
    }
    eqNodes.forEach((n) => {
      lastNode.connect(n);
      lastNode = n;
    });

    lastNode.connect(panNode);
    panNode.connect(masterGain);

    eqNodes[eqNodes.length - 1].connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    masterGain.connect(analyser);
    masterGain.connect(audioCtx.destination);

    if (stretch) updateStretch();

    // บังคับเปิด Visualizer กลับมา
    params.visualMode = 0;
    requestAnimationFrame(loopVisualizer);
  } catch (e) {
    console.error("Audio Engine Error:", e);
  }
}

function loopVisualizer() {
  if (!audioCtx || !analyser) return;

  const data = new Uint8Array(analyser.frequencyBinCount);

  if (params.visualMode === 2) {
    analyser.getByteTimeDomainData(data);
  } else {
    analyser.getByteFrequencyData(data);
  }

  chrome.runtime
    .sendMessage({
      type: "VISUALIZER_DATA",
      data: Array.from(data),
      mode: params.visualMode,
    })
    .catch(() => {});

  setTimeout(() => requestAnimationFrame(loopVisualizer), 40);
}

function updateParams({ key, value, index }) {
  if (!audioCtx) return;

  if (key === "pitch" && stretch) {
    params.pitch = value;
    updateStretch();
  }
  if (key === "reverb") {
    params.reverb = value;
    reverbGain.gain.value = value;
  }
  if (key === "pan") {
    params.pan = value;
    panNode.pan.value = value;
  }
  if (key === "volume") {
    params.volume = value;
    masterGain.gain.value = value;
  }
  if (key === "visualMode") {
    params.visualMode = value;
  }
  if (key === "isEqOn") {
    params.isEqOn = value;
  }
  if (key === "eq") {
    if (eqNodes[index]) eqNodes[index].gain.value = value;
  }
}

function updateStretch() {
  if (stretch) {
    stretch.schedule({ active: true, rate: 1.0, semitones: params.pitch });
  }
}

function createImpulseResponse(duration, decay) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = lastOut + 0.12 * (white - lastOut);
      data[i] = lastOut * Math.exp(-decay * (i / length) * (duration / 2));
    }
  }
  return impulse;
}
