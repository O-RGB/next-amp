const pc = new RTCPeerConnection();
const statusText = document.getElementById("status-text");
const visualizer = document.getElementById("visualizer");
const audioElement = document.getElementById("main-audio");
const outputSelect = document.getElementById("audio-output-select");

const urlParams = new URLSearchParams(window.location.search);
const sourceTabId = urlParams.get("source");

const bars = [];

for (let i = 0; i < 40; i++) {
  const d = document.createElement("div");
  d.className = "bar";
  visualizer.appendChild(d);
  bars.push(d);
}

async function initAudioDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

    outputSelect.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "default";
    defaultOption.text = "SYSTEM DEFAULT";
    outputSelect.appendChild(defaultOption);

    if (audioOutputs.length > 0) {
      audioOutputs.forEach((device) => {
        if (device.deviceId === "default") return;

        const option = document.createElement("option");
        option.value = device.deviceId;

        let label = device.label || `Device ${outputSelect.length}`;
        label = label.replace(/Default - /gi, "").toUpperCase();

        option.text = label;
        outputSelect.appendChild(option);
      });
    } else {
      const option = document.createElement("option");
      option.text = "NO DEVICES FOUND";
      option.disabled = true;
      outputSelect.appendChild(option);
    }

    outputSelect.addEventListener("change", async (e) => {
      const deviceId = e.target.value;
      try {
        if (typeof audioElement.setSinkId !== "undefined") {
          await audioElement.setSinkId(deviceId);
          console.log(`Audio output set to ${deviceId}`);

          const originalText = statusText.textContent;
          statusText.textContent = "OUTPUT SWITCHED";
          statusText.style.color = "#fff";
          setTimeout(() => {
            statusText.textContent = originalText;
            statusText.style.color = "#00ff00";
          }, 1000);
        } else {
          console.warn("Browser does not support setSinkId");
        }
      } catch (err) {
        console.error("Error setting audio output:", err);
      }
    });
  } catch (e) {
    console.error("Error enumerating devices:", e);
    outputSelect.innerHTML = "<option>ERROR LOADING DEVICES</option>";
  }
}

initAudioDevices();

function hackSdpToHighQualityStereo(sdp) {
  const opusMapId = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
  if (!opusMapId) return sdp;
  const payload = opusMapId[1];
  const fmtpLineRegex = new RegExp(`a=fmtp:${payload} (.*)`);
  const newParams =
    "stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1;useinbandfec=1";
  if (sdp.match(fmtpLineRegex)) {
    return sdp.replace(fmtpLineRegex, `a=fmtp:${payload} ${newParams}`);
  } else {
    return sdp.replace(
      opusMapId[0],
      `${opusMapId[0]}\r\na=fmtp:${payload} ${newParams}`
    );
  }
}

pc.ontrack = (event) => {
  statusText.textContent = `LINKED: TAB ${sourceTabId}`;
  statusText.classList.add("connected");

  audioElement.srcObject = event.streams[0];

  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(event.streams[0]);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 32;
  src.connect(analyser);

  const buffer = new Uint8Array(analyser.frequencyBinCount);
  const draw = () => {
    analyser.getByteFrequencyData(buffer);
    bars.forEach((bar, i) => {
      const index = Math.floor(i * (buffer.length / bars.length));
      const val = buffer[index] || 0;

      const h = Math.max(2, val);
      bar.style.height = (h / 255) * 100 + "%";
      bar.style.background = `rgb(0, ${val + 50}, 0)`;
    });
    requestAnimationFrame(draw);
  };
  draw();
};

pc.onicecandidate = (event) => {
  if (event.candidate) {
    chrome.runtime.sendMessage({
      type: "RTC_CANDIDATE",
      target: "OFFSCREEN",
      candidate: event.candidate,
    });
  }
};

chrome.tabs.getCurrent((tab) => {
  if (!tab) {
    console.error("Cannot get current tab info");
    return;
  }

  const myTabId = tab.id;
  console.log("Player Tab ID:", myTabId);

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.playerTabId && msg.playerTabId !== myTabId) {
      return;
    }

    if (msg.type === "RTC_OFFER") {
      statusText.textContent = "NEGOTIATING...";
      statusText.classList.remove("connected");

      await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await pc.createAnswer();
      answer.sdp = hackSdpToHighQualityStereo(answer.sdp);
      await pc.setLocalDescription(answer);

      chrome.runtime.sendMessage({
        type: "RTC_ANSWER",
        target: "OFFSCREEN",
        answer: answer,

        playerTabId: myTabId,
      });
    } else if (msg.type === "RTC_CANDIDATE") {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  });

  chrome.runtime.sendMessage({
    type: "PLAYER_READY",
    sourceTabId: sourceTabId,
  });
});
