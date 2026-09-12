(function () {
  "use strict";

  const protocol = window.NextStudioRemoteProtocol;
  const byId = (id) => document.getElementById(id);
  const fragment = protocol.readFragment();
  const els = {
    badge: byId("connection-badge"), label: byId("connection-label"), error: byId("remote-error"), errorTitle: byId("error-title"), errorMessage: byId("error-message"), retry: byId("retry-button"),
    session: byId("session-label"), detail: byId("session-detail"), status: byId("status-state"), mark: byId("connection-mark"), rtt: byId("rtt-value"), vocalState: byId("vocal-state"), profile: byId("vocal-profile")
  };
  let peer = null;
  let connection = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let pingTimer = null;
  let connected = false;
  let lastState = {};
  let closedByUser = false;

  const translations = {
    en: {
      "remote.skip": "Skip to controls", "remote.brand": "REMOTE", "remote.eyebrow": "SESSION CONTROL", "remote.title": "Your session, within reach.", "remote.description": "Connect to an active NextStudio session to control the sound and picture from another device.", "remote.session": "SESSION", "remote.waiting": "Waiting for link", "remote.tokenHint": "The secure session token stays in this page.", "remote.errorTitle": "Unable to connect", "remote.errorMessage": "Check the Remote link and try again.", "remote.retry": "Try again", "remote.voiceMode": "Voice mode", "remote.original": "Original", "remote.karaoke": "Karaoke", "remote.acapella": "Acapella", "remote.aiVocal": "AI vocal", "remote.aiVocalHint": "Enable processing on the active session", "remote.aiProfile": "AI profile", "remote.aiProfileHint": "Use the active Extension profile", "remote.shapeSound": "Shape the sound", "remote.volume": "Volume", "remote.balance": "Balance", "remote.pitch": "Pitch", "remote.reverb": "Reverb", "remote.keepSync": "Keep it in sync", "remote.delay": "Delay", "remote.zoom": "Zoom", "remote.rotation": "Rotation", "remote.videoQuality": "Video quality", "remote.videoQualityHint": "Leave the active quality unchanged", "remote.connection": "Connection", "remote.state": "STATE", "remote.roundTrip": "ROUND TRIP", "remote.protocol": "PROTOCOL", "remote.privacyHint": "Remote sends control values only. Audio stays with the active NextStudio session.", "remote.disconnect": "Disconnect", "remote.privacy": "Privacy", "remote.footer": "NextStudio Remote · No audio stream", "remote.support": "Support"
    },
    th: {
      "remote.skip": "ข้ามไปยังส่วนควบคุม", "remote.brand": "รีโมต", "remote.eyebrow": "ควบคุม SESSION", "remote.title": "ควบคุม session ได้ใกล้มือ", "remote.description": "เชื่อมต่อกับ NextStudio ที่กำลังทำงาน เพื่อควบคุมเสียงและภาพจากอุปกรณ์อีกเครื่อง", "remote.session": "SESSION", "remote.waiting": "รอลิงก์", "remote.tokenHint": "token ของ session จะอยู่เฉพาะในหน้านี้", "remote.errorTitle": "เชื่อมต่อไม่ได้", "remote.errorMessage": "ตรวจสอบลิงก์ Remote แล้วลองใหม่", "remote.retry": "ลองใหม่", "remote.voiceMode": "โหมดเสียงร้อง", "remote.original": "เสียงต้นฉบับ", "remote.karaoke": "Karaoke", "remote.acapella": "Acapella", "remote.aiVocal": "AI vocal", "remote.aiVocalHint": "เปิดการประมวลผลใน session ปัจจุบัน", "remote.aiProfile": "โปรไฟล์ AI", "remote.aiProfileHint": "ใช้โปรไฟล์จาก Extension ปัจจุบัน", "remote.shapeSound": "ปรับเสียง", "remote.volume": "ความดัง", "remote.balance": "สมดุลซ้ายขวา", "remote.pitch": "คีย์เสียง", "remote.reverb": "รีเวิร์บ", "remote.keepSync": "ซิงก์ภาพและเสียง", "remote.delay": "ดีเลย์", "remote.zoom": "ซูม", "remote.rotation": "หมุนภาพ", "remote.videoQuality": "คุณภาพวิดีโอ", "remote.videoQualityHint": "คงค่าคุณภาพที่ใช้อยู่", "remote.connection": "การเชื่อมต่อ", "remote.state": "สถานะ", "remote.roundTrip": "ไปกลับ", "remote.protocol": "โปรโตคอล", "remote.privacyHint": "Remote ส่งเฉพาะคำสั่งควบคุม เสียงยังอยู่กับ NextStudio session ปัจจุบัน", "remote.disconnect": "ตัดการเชื่อมต่อ", "remote.privacy": "ความเป็นส่วนตัว", "remote.footer": "NextStudio Remote · ไม่มี audio stream", "remote.support": "ติดต่อ"
    }
  };
  function applyLanguage(language) {
    const lang = translations[language] ? language : "en";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((element) => { const value = translations[lang][element.dataset.i18n]; if (value) element.textContent = value; });
    document.querySelectorAll("[data-language]").forEach((button) => { const active = button.dataset.language === lang; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    try { localStorage.setItem("nextstudio-language", lang); } catch (_) {}
  }

  const ranges = ["volume", "pan", "pitch", "reverb", "videoDelay", "videoZoom", "videoRotate"];
  const rangeElements = Object.fromEntries(ranges.map((key) => [key, document.querySelector(`[data-param="${key}"]`)]));

  function setConnectionState(kind, label, detail) {
    els.badge.className = `connection-badge is-${kind}`;
    els.label.textContent = label;
    els.status.textContent = label;
    els.mark.textContent = kind === "connected" ? "●" : kind === "error" ? "!" : "…";
    if (detail) els.detail.textContent = detail;
  }

  function showError(title, message) { els.errorTitle.textContent = title; els.errorMessage.textContent = message; els.error.hidden = false; }
  function hideError() { els.error.hidden = true; }
  function enableControls(enabled) { document.querySelectorAll("[data-param], #quality-select").forEach((element) => { element.disabled = !enabled; }); }
  function displayNumber(key, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (key === "volume") return `${Math.round(n * 100)}%`;
    if (key === "pan") return n === 0 ? "CENTER" : n > 0 ? `R ${Math.round(n * 100)}%` : `L ${Math.round(Math.abs(n) * 100)}%`;
    if (key === "pitch") return n > 0 ? `+${Math.round(n)}` : String(Math.round(n));
    if (key === "reverb") return n.toFixed(1);
    if (key === "videoDelay") return `${n.toFixed(2)} s`;
    if (key === "videoZoom") return `${Math.round(n * 100)}%`;
    if (key === "videoRotate") return `${Math.round(n)}°`;
    return String(value);
  }
  function updateParamView(key, value) {
    const input = rangeElements[key];
    if (input) { input.value = String(value); const output = byId(`${key === "videoDelay" ? "delay" : key === "videoZoom" ? "zoom" : key === "videoRotate" ? "rotate" : key}-output`); if (output) output.textContent = displayNumber(key, value); }
    if (key === "videoQuality") byId("quality-select").value = value;
    if (key === "isVocalOn") { const toggle = document.querySelector(`[data-param="${key}"]`); setToggle(toggle, value, "ON", "OFF"); }
    if (key === "isVideoMasterOn") { const toggle = document.querySelector(`[data-param="${key}"]`); setSmallSwitch(toggle, value, "VIDEO ON", "VIDEO OFF"); }
    if (key === "vocalMode") { document.querySelectorAll("[data-param=\"vocalMode\"]").forEach((button) => button.classList.toggle("is-active", button.dataset.value === value)); els.vocalState.textContent = value === "karaoke" ? "KARAOKE" : value === "acapella" ? "ACAPELLA" : "ORIGINAL"; }
    if (key === "aiPowerMode") els.profile.textContent = String(value || "eco").toUpperCase();
  }
  function setToggle(element, active, on, off) { if (!element) return; element.classList.toggle("is-active", !!active); element.setAttribute("aria-pressed", String(!!active)); const label = element.querySelector("b"); if (label) label.textContent = active ? on : off; }
  function setSmallSwitch(element, active, on, off) { if (!element) return; element.classList.toggle("is-active", !!active); element.setAttribute("aria-pressed", String(!!active)); element.textContent = active ? on : off; }
  function applyState(state) { if (!state || typeof state !== "object") return; lastState = { ...lastState, ...state }; Object.entries(state).forEach(([key, value]) => { if (protocol.ALLOWED_KEYS.includes(key) || ["aiPowerMode", "vocalProfile"].includes(key)) updateParamView(key, value); }); }
  function sendParam(key, rawValue, index = null) { if (!connected || !connection || !connection.open) return; const value = protocol.validateParam(key, rawValue, index); if (value === null) return; connection.send({ type: "SET_PARAM", key, value, ...(index === null ? {} : { index }) }); updateParamView(key, value); }
  function sendPing() { if (!connected || !connection || !connection.open) return; const ts = Date.now(); connection.send({ type: "PING", ts }); }
  function stopTimers() { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }
  function closePeer() { stopTimers(); if (connection) { try { connection.close(); } catch (_) {} } connection = null; if (peer) { try { peer.destroy(); } catch (_) {} } peer = null; }

  function handleData(data) {
    if (!protocol.isMessage(data) || JSON.stringify(data).length > protocol.MAX_MESSAGE_BYTES) return;
    if (data.type === "SYNC_STATE" && data.state) { connected = true; reconnectAttempt = 0; hideError(); setConnectionState("connected", "Connected", "Live session"); els.session.textContent = "Active session"; applyState(data.state); return; }
    if (data.type === "UPDATE_PARAM" && protocol.ALLOWED_KEYS.includes(data.key)) { updateParamView(data.key, data.value); lastState[data.key] = data.value; return; }
    if (data.type === "PONG" && Number.isFinite(Number(data.ts))) { els.rtt.textContent = `${Math.max(0, Date.now() - Number(data.ts))} ms`; }
  }
  function scheduleReconnect() { if (closedByUser || reconnectTimer) return; const delay = Math.min(10000, 1000 * Math.max(1, reconnectAttempt)); reconnectAttempt += 1; reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay); }
  function connect() {
    if (!fragment.host || !fragment.token) { enableControls(false); setConnectionState("error", "No session", "Missing Remote link"); showError("Remote link required", "Open this page from the Remote link generated by NextStudio."); return; }
    if (typeof window.Peer !== "function") { enableControls(false); setConnectionState("error", "Unavailable", "PeerJS failed to load"); showError("Remote is unavailable", "The local connection library did not load. Check the page files and try again."); return; }
    closedByUser = false; connected = false; enableControls(false); hideError(); setConnectionState("loading", "Connecting", "Contacting active session");
    try { peer = new window.Peer(null, { debug: 0 }); } catch (error) { setConnectionState("error", "Error", "Peer initialization failed"); showError("Could not initialize Remote", "Reload this page and try again."); scheduleReconnect(); return; }
    peer.on("open", () => { connection = peer.connect(fragment.host, { reliable: true }); connection.on("open", () => { connection.send({ type: "HANDSHAKE", token: fragment.token, protocolVersion: protocol.VERSION, needUI: false }); connection.send({ type: "GET_STATE" }); }); connection.on("data", handleData); connection.on("close", handleDisconnect); connection.on("error", handleDisconnect); });
    peer.on("error", () => { if (!connected) { setConnectionState("error", "Not found", "Session unavailable"); showError("Could not reach this session", "The link may have expired or the host may be offline."); } handleDisconnect(); });
  }
  function handleDisconnect() { if (closedByUser) return; if (connected) showError("Connection lost", "Trying to reconnect to the active session."); connected = false; enableControls(false); setConnectionState("loading", "Reconnecting", "Waiting for active session"); stopTimers(); scheduleReconnect(); }
  function disconnect() { closedByUser = true; if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } closePeer(); connected = false; enableControls(false); setConnectionState("error", "Disconnected", "Session ended by you"); showError("Remote disconnected", "Reconnect when the NextStudio session is ready."); }

  document.querySelectorAll("input[data-param]").forEach((input) => input.addEventListener("input", () => sendParam(input.dataset.param, input.value)));
  document.querySelectorAll("button[data-param][data-value]").forEach((button) => button.addEventListener("click", () => sendParam(button.dataset.param, button.dataset.value)));
  document.querySelectorAll("button[data-param]:not([data-value])").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.param; sendParam(key, !(lastState[key] ?? button.getAttribute("aria-pressed") === "true")); }));
  byId("quality-select").addEventListener("change", (event) => sendParam("videoQuality", event.target.value));
  byId("retry-button").addEventListener("click", () => { if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } closePeer(); reconnectAttempt = 0; connect(); });
  byId("disconnect-button").addEventListener("click", disconnect);
  document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => applyLanguage(button.dataset.language)));
  window.addEventListener("pagehide", closePeer, { once: true });

  // Remove the token from the visible address bar after parsing it. The session
  // remains in memory for this page, but a refresh requires a new Remote link.
  if (window.location.hash) { try { window.history.replaceState(null, document.title, window.location.pathname + window.location.search); } catch (_) {} }
  enableControls(false);
  let initialLanguage = "en";
  try { initialLanguage = localStorage.getItem("nextstudio-language") || "en"; } catch (_) {}
  applyLanguage(initialLanguage);
  connect();
  pingTimer = setInterval(sendPing, 5000);
})();
