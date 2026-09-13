(function () {
  "use strict";

  const protocol = window.NextStudioRemoteProtocol;
  const byId = (id) => document.getElementById(id);
  const fragment = protocol.readFragment();

  const els = {
    reconBar: byId("recon-bar"),
    reconMessage: byId("recon-msg"),
    retry: byId("retry-button"),
    ping: byId("txt-ping"),
    badge: byId("badge-status"),
    audioBody: byId("body-audio"),
    eqBody: byId("body-eq"),
    vocalBody: byId("body-vocal"),
    videoBody: byId("body-video"),
    vocalStatus: byId("txt-vocal-status"),
    eqPreset: byId("eq-preset"),
    videoQuality: byId("video-quality")
  };

  let peer = null;
  let connection = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let heartbeatTimer = null;
  let lastPong = 0;
  let connected = false;
  let closedByUser = false;
  let state = { eq: new Array(10).fill(0) };
  let continuousFrame = null;
  const pendingContinuous = new Map();

  const translations = {
    en: {
      "remote.skip": "Skip to controls",
      "remote.masterAudio": "MASTER AUDIO",
      "remote.volumeShort": "VOL",
      "remote.balanceShort": "BAL",
      "remote.pitchShort": "PITCH",
      "remote.reverbShort": "REVERB",
      "remote.dyn": "DYN",
      "remote.mute": "MUTE",
      "remote.equalizer": "EQUALIZER",
      "remote.aiVocalTitle": "AI VOCAL",
      "remote.mode": "MODE",
      "remote.origShort": "ORIG",
      "remote.karaokeShort": "KARAOKE",
      "remote.acapellaShort": "ACAPELLA",
      "remote.videoSync": "VIDEO & SYNC",
      "remote.btDelay": "BT AUDIO DELAY",
      "remote.lipSync": "LIP-SYNC TIMECODE",
      "remote.offset": "OFFSET",
      "remote.zoom": "ZOOM",
      "remote.fill": "FILL",
      "remote.aspectRatio": "ASPECT RATIO",
      "remote.magnify": "MAGNIFY",
      "remote.rotation": "ROTATION",
      "remote.rotate90": "ROTATE +90°",
      "remote.anglePreset": "ANGLE PRESET",
      "remote.retry": "Retry",
      "remote.donate": "Support NextStudio",
      "remote.privacy": "Privacy",
      "remote.support": "Support",
      "remote.noAudio": "No audio stream"
    },
    th: {
      "remote.skip": "ข้ามไปยังส่วนควบคุม",
      "remote.masterAudio": "เสียงหลัก",
      "remote.volumeShort": "ความดัง",
      "remote.balanceShort": "ซ้ายขวา",
      "remote.pitchShort": "คีย์เสียง",
      "remote.reverbShort": "รีเวิร์บ",
      "remote.dyn": "DYN",
      "remote.mute": "ปิดเสียง",
      "remote.equalizer": "อีควอไลเซอร์",
      "remote.aiVocalTitle": "AI VOCAL",
      "remote.mode": "โหมด",
      "remote.origShort": "ต้นฉบับ",
      "remote.karaokeShort": "คาราโอเกะ",
      "remote.acapellaShort": "เสียงร้อง",
      "remote.videoSync": "วิดีโอและซิงก์",
      "remote.btDelay": "ดีเลย์เสียง BT",
      "remote.lipSync": "ไทม์โค้ดซิงก์",
      "remote.offset": "ชดเชย",
      "remote.zoom": "ซูม",
      "remote.fill": "เต็มจอ",
      "remote.aspectRatio": "อัตราส่วนภาพ",
      "remote.magnify": "ขยาย",
      "remote.rotation": "หมุนภาพ",
      "remote.rotate90": "หมุน +90°",
      "remote.anglePreset": "มุมสำเร็จรูป",
      "remote.retry": "ลองใหม่",
      "remote.donate": "สนับสนุน NextStudio",
      "remote.privacy": "ความเป็นส่วนตัว",
      "remote.support": "ติดต่อ",
      "remote.noAudio": "ไม่มี audio stream"
    }
  };

  const presetValues = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
    rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
    pop: [2, 1, 3, 2, 1, 0, 1, 2, 2, 1],
    voice: [-2, -1, 0, 2, 4, 4, 3, 1, 0, 0]
  };
  const frequencies = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

  function applyLanguage(language) {
    const lang = translations[language] ? language : "en";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = translations[lang][element.dataset.i18n];
      if (value) element.textContent = value;
    });
    try { localStorage.setItem("nextstudio-language", lang); } catch (_) {}
  }

  function normalizeIncoming(key, value) {
    if (key === "videoQuality" && value === "medium") return "mid";
    return value;
  }

  function displayNumber(key, value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    if (key === "volume") return `${Math.round(number * 100)}%`;
    if (key === "pan") return number === 0 ? "CENTER" : number > 0 ? `R ${Math.round(number * 100)}%` : `L ${Math.round(Math.abs(number) * 100)}%`;
    if (key === "pitch") return number === 0 ? "0 ST (Normal)" : `${number > 0 ? "+" : ""}${Math.round(number)} ST`;
    if (key === "reverb") return `${number.toFixed(1)}s`;
    if (key === "videoDelay") return `${number.toFixed(2)}s`;
    if (key === "videoZoom") return `${Math.round(number * 100)}%`;
    if (key === "videoRotate") return `${Math.round(number)}°`;
    return String(value);
  }

  function showReconnect(show, message) {
    if (!els.reconBar) return;
    els.reconBar.hidden = !show;
    if (message && els.reconMessage) els.reconMessage.textContent = message;
  }

  function setBadge(kind, text) {
    if (!els.badge) return;
    els.badge.className = "site-button site-button-small status-button";
    if (kind === "connected") els.badge.classList.add("is-active");
    if (kind === "loading") els.badge.classList.add("is-loading");
    if (kind === "error") els.badge.classList.add("is-error");
    els.badge.textContent = text;
  }

  function setButtonState(id, active, label) {
    const button = byId(id);
    if (!button) return;
    button.classList.toggle("is-active", !!active);
    button.classList.toggle("is-off", !active);
    button.setAttribute("aria-pressed", String(!!active));
    if (label) button.textContent = active ? "ON" : "OFF";
  }

  function updatePanelStates() {
    const audioOn = state.isAudioMasterOn !== false;
    const eqOn = state.isEqOn !== false;
    const vocalOn = state.isVocalOn !== false;
    const videoOn = state.isVideoMasterOn !== false;
    els.audioBody?.classList.toggle("panel-disabled", !audioOn);
    els.eqBody?.classList.toggle("panel-disabled", !(audioOn && eqOn));
    els.vocalBody?.classList.toggle("panel-disabled", !(audioOn && vocalOn));
    if (els.eqPreset) els.eqPreset.disabled = !connected || !(audioOn && eqOn);
    if (els.videoQuality) els.videoQuality.disabled = !connected || !videoOn;
  }

  function updateBandView(index, value) {
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? Math.max(-12, Math.min(12, numeric)) : 0;
    const pct = ((safe + 12) / 24) * 100;
    const mask = byId(`eq-mask-${index}`);
    const thumb = byId(`eq-thumb-${index}`);
    const badge = byId(`eq-value-${index}`);
    const input = byId(`eq-input-${index}`);
    if (mask) mask.style.height = `${100 - pct}%`;
    if (thumb) thumb.style.top = `${100 - pct}%`;
    if (badge) badge.textContent = `${safe > 0 ? "+" : ""}${Number.isInteger(safe) ? safe : safe.toFixed(1)}dB`;
    if (input) input.value = String(safe);
  }

  function updateVocalMode(mode) {
    const safeMode = ["bypass", "karaoke", "acapella"].includes(mode) ? mode : "bypass";
    document.querySelectorAll(".mode-button").forEach((button) => {
      const active = button.dataset.value === safeMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (els.vocalStatus) {
      els.vocalStatus.textContent = safeMode === "karaoke" ? "KARAOKE" : safeMode === "acapella" ? "ACAPELLA" : "ORIGINAL";
      els.vocalStatus.className = `panel-state state-${safeMode === "bypass" ? "original" : safeMode}`;
    }
  }

  function updateParamView(key, rawValue, index = null) {
    const value = normalizeIncoming(key, rawValue);
    if (key === "eq") {
      if (index !== null && index !== undefined) {
        if (!Array.isArray(state.eq)) state.eq = new Array(10).fill(0);
        state.eq[index] = value;
        updateBandView(index, value);
      } else if (Array.isArray(value)) {
        state.eq = value.slice(0, 10);
        state.eq.forEach((band, bandIndex) => updateBandView(bandIndex, band));
      }
      return;
    }

    state[key] = value;
    if (key === "volume" || key === "pan" || key === "pitch" || key === "reverb" || key === "videoDelay" || key === "videoZoom") {
      const ids = { volume: "main-vol", pan: "main-pan", pitch: "main-pitch", reverb: "main-verb", videoDelay: "video-delay", videoZoom: "video-zoom" };
      const outputIds = { volume: "txt-vol", pan: "txt-pan", pitch: "txt-pitch", reverb: "txt-verb", videoDelay: "txt-video-delay", videoZoom: "txt-video-zoom" };
      const input = byId(ids[key]);
      const output = byId(outputIds[key]);
      if (input) input.value = String(value);
      if (output) output.textContent = displayNumber(key, value);
      if (key === "videoZoom") {
        const zoom = Number(value);
        [["btn-zoom-1", 1], ["btn-zoom-wide", 1.35], ["btn-zoom-fill", 1.7]].forEach(([id, preset]) => {
          byId(id)?.classList.toggle("is-active", Math.abs(zoom - preset) < 0.04);
        });
      }
    } else if (key === "videoRotate") {
      const degrees = ((Math.round(Number(value)) % 360) + 360) % 360;
      state.videoRotate = degrees;
      if (byId("txt-video-rotate")) byId("txt-video-rotate").textContent = `${degrees}°`;
      [0, 90, 180, 270].forEach((angle) => byId(`btn-rot-${angle}`)?.classList.toggle("is-active", Math.abs(degrees - angle) < 5));
    } else if (key === "videoQuality") {
      if (els.videoQuality) els.videoQuality.value = value;
    } else if (key === "normalize") {
      const active = !!value;
      const button = byId("btn-normalize");
      button?.classList.toggle("is-active", active);
      button?.setAttribute("aria-pressed", String(active));
      byId("norm-indicator")?.classList.toggle("is-on", active);
    } else if (key === "isAudioMasterOn") {
      const active = value !== false;
      setButtonState("btn-toggle-audio", active, true);
      setButtonState("btn-mute", active, false);
      updatePanelStates();
    } else if (key === "isEqOn") {
      setButtonState("btn-eq-toggle", value !== false, true);
      updatePanelStates();
    } else if (key === "isVocalOn") {
      setButtonState("btn-toggle-vocal", value !== false, true);
      updatePanelStates();
    } else if (key === "isVideoMasterOn") {
      setButtonState("btn-toggle-video", value !== false, true);
      els.videoBody?.classList.toggle("panel-disabled", value === false);
      if (els.videoQuality) els.videoQuality.disabled = !connected || value === false;
    } else if (key === "eqPreset") {
      if (els.eqPreset) els.eqPreset.value = value;
    } else if (key === "vocalMode") {
      updateVocalMode(value);
    }
  }

  function applyState(nextState) {
    if (!nextState || typeof nextState !== "object") return;
    if (Array.isArray(nextState.eq)) updateParamView("eq", nextState.eq);
    Object.entries(nextState).forEach(([key, value]) => {
      if (key !== "eq" && protocol.ALLOWED_KEYS.includes(key)) updateParamView(key, value);
    });
  }

  function sendParam(key, rawValue, index = null) {
    const normalized = normalizeIncoming(key, rawValue);
    const value = protocol.validateParam(key, normalized, index);
    if (value === null) return false;

    updateParamView(key, value, index);
    if (!connected || !connection || !connection.open) return false;
    const message = { type: "SET_PARAM", key, value };
    if (index !== null && index !== undefined) message.index = index;
    connection.send(message);
    return true;
  }

  function continuousKey(key, index) {
    return `${key}:${index === null || index === undefined ? "" : index}`;
  }

  function flushContinuous(key = null, index = null) {
    if (!connection || !connection.open || !connected) {
      if (key === null) pendingContinuous.clear();
      else pendingContinuous.delete(continuousKey(key, index));
      return;
    }
    const keys = key === null ? [...pendingContinuous.keys()] : [continuousKey(key, index)];
    keys.forEach((pendingKey) => {
      const pending = pendingContinuous.get(pendingKey);
      if (!pending) return;
      const message = { type: "SET_PARAM", key: pending.key, value: pending.value };
      if (pending.index !== null && pending.index !== undefined) message.index = pending.index;
      connection.send(message);
      pendingContinuous.delete(pendingKey);
    });
  }

  function scheduleContinuousFlush() {
    if (continuousFrame !== null) return;
    const flush = () => {
      continuousFrame = null;
      flushContinuous();
    };
    continuousFrame = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(flush) : window.setTimeout(flush, 16);
  }

  function queueContinuousParam(key, rawValue, index = null) {
    const normalized = normalizeIncoming(key, rawValue);
    const value = protocol.validateParam(key, normalized, index);
    if (value === null) return false;
    updateParamView(key, value, index);
    if (!connected || !connection || !connection.open) return false;
    pendingContinuous.set(continuousKey(key, index), { key, value, index });
    scheduleContinuousFlush();
    return true;
  }

  function setEqBand(index, value) {
    const changed = queueContinuousParam("eq", value, index);
    if (changed && state.eqPreset !== "custom") sendParam("eqPreset", "custom");
  }

  function setupEqBands() {
    const container = byId("eq-container");
    if (!container) return;
    container.replaceChildren();
    frequencies.forEach((frequency, index) => {
      const column = document.createElement("div");
      column.className = "eq-col";
      column.innerHTML = `<span class="eq-value" id="eq-value-${index}">0dB</span><div class="eq-track"><div class="eq-mask" id="eq-mask-${index}"></div><div class="eq-thumb" id="eq-thumb-${index}"></div></div><span class="eq-label">${frequency}</span><input class="eq-input" id="eq-input-${index}" type="range" min="-12" max="12" step="0.5" value="0" aria-label="${frequency} Hz equalizer band" />`;
      container.appendChild(column);
      const input = byId(`eq-input-${index}`);
      input.addEventListener("input", () => setEqBand(index, input.value));
      input.addEventListener("pointerdown", () => column.classList.add("is-dragging"));
      input.addEventListener("pointerup", () => column.classList.remove("is-dragging"));
      input.addEventListener("pointercancel", () => column.classList.remove("is-dragging"));
    });
  }

  function nudgeDelay(amount) {
    const current = Number(state.videoDelay) || 0;
    const value = Math.max(0, Math.min(5, Math.round((current + amount) * 100) / 100));
    sendParam("videoDelay", value);
  }

  function resetVideo() {
    sendParam("videoZoom", 1);
    sendParam("videoRotate", 0);
    sendParam("videoDelay", 0);
  }

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    lastPong = Date.now();
    heartbeatTimer = setInterval(() => {
      if (!connected || !connection || !connection.open) return;
      if (Date.now() - lastPong > 15000) {
        handleDisconnect(connection);
        return;
      }
      connection.send({ type: "PING", ts: Date.now() });
    }, 5000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function closePeer() {
    stopHeartbeat();
    const oldConnection = connection;
    connection = null;
    if (oldConnection) {
      try { oldConnection.close(); } catch (_) {}
    }
    const oldPeer = peer;
    peer = null;
    if (oldPeer) {
      try { oldPeer.destroy(); } catch (_) {}
    }
  }

  function scheduleReconnect() {
    if (closedByUser || reconnectTimer) return;
    reconnectAttempt += 1;
    let countdown = Math.min(6, Math.max(2, reconnectAttempt * 2));
    showReconnect(true, `Link dropped. Reconnecting in ${countdown}s...`);
    reconnectTimer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
        connect();
      } else {
        showReconnect(true, `Link dropped. Reconnecting in ${countdown}s...`);
      }
    }, 1000);
  }

  function handleDisconnect(sourceConnection) {
    if (sourceConnection && sourceConnection !== connection) return;
    if (closedByUser) return;
    connected = false;
    stopHeartbeat();
    enableControls(false);
    setBadge("loading", "RECONNECTING");
    scheduleReconnect();
  }

  function bindConnection(nextConnection) {
    connection = nextConnection;
    nextConnection.on("open", () => {
      if (nextConnection !== connection) return;
      nextConnection.send({ type: "HANDSHAKE", token: fragment.token, protocolVersion: protocol.VERSION, needUI: false });
      nextConnection.send({ type: "GET_STATE" });
    });
    nextConnection.on("data", (data) => {
      if (nextConnection !== connection) return;
      let size = 0;
      try { size = JSON.stringify(data).length; } catch (_) { return; }
      if (!protocol.isMessage(data) || size > protocol.MAX_MESSAGE_BYTES) return;
      if (data.type === "SYNC_STATE" && data.state) {
        connected = true;
        reconnectAttempt = 0;
        enableControls(true);
        setBadge("connected", "ONLINE");
        showReconnect(false);
        applyState(data.state);
        startHeartbeat();
      } else if (data.type === "UPDATE_PARAM" && protocol.ALLOWED_KEYS.includes(data.key)) {
        updateParamView(data.key, data.value, data.index);
      } else if (data.type === "PONG" && Number.isFinite(Number(data.ts))) {
        lastPong = Date.now();
        if (els.ping) els.ping.textContent = `${Math.max(1, Date.now() - Number(data.ts))} ms`;
      }
    });
    nextConnection.on("close", () => handleDisconnect(nextConnection));
    nextConnection.on("error", () => handleDisconnect(nextConnection));
  }

  function connect() {
    if (closedByUser) return;
    if (!fragment.host || !fragment.token) {
      enableControls(false);
      setBadge("error", "NO LINK");
      showReconnect(true, "Open this page from the Remote link generated by NextStudio.");
      return;
    }
    if (typeof window.Peer !== "function") {
      enableControls(false);
      setBadge("error", "UNAVAILABLE");
      showReconnect(true, "PeerJS failed to load. Check the page assets and try again.");
      return;
    }

    closePeer();
    connected = false;
    enableControls(false);
    setBadge("loading", "CONNECTING");
    showReconnect(true, "Contacting active session...");

    let nextPeer;
    try { nextPeer = new window.Peer(null, { debug: 0 }); } catch (_) {
      setBadge("error", "ERROR");
      scheduleReconnect();
      return;
    }
    peer = nextPeer;
    nextPeer.on("open", () => {
      if (nextPeer !== peer) return;
      try { bindConnection(nextPeer.connect(fragment.host, { reliable: true })); } catch (_) { handleDisconnect(); }
    });
    nextPeer.on("error", () => {
      if (nextPeer !== peer) return;
      setBadge("error", "NOT FOUND");
      handleDisconnect();
    });
  }

  function enableControls(enabled) {
    document.querySelectorAll("[data-param], .eq-input, #eq-preset, #video-quality, #btn-video-reset, #delay-minus-005, #delay-minus-001, #delay-reset, #delay-plus-001, #delay-plus-005, #btn-zoom-1, #btn-zoom-wide, #btn-zoom-fill, #btn-rotate-action, .angle-button").forEach((element) => {
      element.disabled = !enabled;
    });
  }

  function bindControls() {
    document.querySelectorAll("input[data-param]").forEach((input) => {
      input.addEventListener("input", () => queueContinuousParam(input.dataset.param, input.value));
      input.addEventListener("change", () => flushContinuous(input.dataset.param));
      input.addEventListener("pointerup", () => flushContinuous(input.dataset.param));
      input.addEventListener("pointercancel", () => flushContinuous(input.dataset.param));
    });
    document.querySelectorAll(".eq-input").forEach((input) => {
      const index = Number(input.id.replace("eq-input-", ""));
      input.addEventListener("change", () => flushContinuous("eq", index));
      input.addEventListener("pointerup", () => flushContinuous("eq", index));
      input.addEventListener("pointercancel", () => flushContinuous("eq", index));
    });
    document.querySelectorAll("button[data-param][data-value]").forEach((button) => button.addEventListener("click", () => sendParam(button.dataset.param, button.dataset.value)));
    document.querySelectorAll("button[data-param]:not([data-value])").forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.param;
      sendParam(key, !(state[key] ?? button.getAttribute("aria-pressed") === "true"));
    }));

    els.eqPreset?.addEventListener("change", () => {
      const values = presetValues[els.eqPreset.value];
      if (!values) return;
      values.forEach((value, index) => sendParam("eq", value, index));
      sendParam("eqPreset", els.eqPreset.value);
    });
    els.videoQuality?.addEventListener("change", () => sendParam("videoQuality", els.videoQuality.value));
    byId("btn-video-reset")?.addEventListener("click", resetVideo);

    byId("delay-minus-005")?.addEventListener("click", () => nudgeDelay(-0.05));
    byId("delay-minus-001")?.addEventListener("click", () => nudgeDelay(-0.01));
    byId("delay-reset")?.addEventListener("click", () => sendParam("videoDelay", 0));
    byId("delay-plus-001")?.addEventListener("click", () => nudgeDelay(0.01));
    byId("delay-plus-005")?.addEventListener("click", () => nudgeDelay(0.05));

    byId("btn-zoom-1")?.addEventListener("click", () => sendParam("videoZoom", 1));
    byId("btn-zoom-wide")?.addEventListener("click", () => sendParam("videoZoom", 1.35));
    byId("btn-zoom-fill")?.addEventListener("click", () => sendParam("videoZoom", 1.7));
    byId("btn-rotate-action")?.addEventListener("click", () => {
      const angles = [0, 90, 180, 270];
      const current = angles.indexOf(Number(state.videoRotate) || 0);
      sendParam("videoRotate", angles[(current + 1) % angles.length]);
    });
    [0, 90, 180, 270].forEach((angle) => byId(`btn-rot-${angle}`)?.addEventListener("click", () => sendParam("videoRotate", angle)));
    els.retry?.addEventListener("click", () => {
      if (reconnectTimer) clearInterval(reconnectTimer);
      reconnectTimer = null;
      reconnectAttempt = 0;
      closePeer();
      connect();
    });
  }

  setupEqBands();
  bindControls();
  let initialLanguage = "en";
  try { initialLanguage = localStorage.getItem("nextstudio-language") || "en"; } catch (_) {}
  applyLanguage(initialLanguage);
  enableControls(false);
  if (window.location.hash) {
    try { window.history.replaceState(null, document.title, window.location.pathname + window.location.search); } catch (_) {}
  }
  connect();
})();
