import { DBManager } from "./db-manager.js";
import { $, $$, sendMessageWithRetry } from "./assets/js/utils.js";
import { SessionManager } from "./modules/session-manager.js";
import { SettingsModal } from "./modules/settings-modal.js";
import { normalizeAiPowerMode } from "./modules/ai-vocal/ai-power-mode.mjs";
import { GO_ENGINE_ENABLED } from "./modules/ai-vocal/build-feature-flags.js";
import {
  ENGINE_TYPE,
  ENGINE_DISPLAY_NAME,
  ENGINE_API,
  ENGINE_HEALTH_URL,
  ENGINE_SWITCH_TO_BROWSER_LABEL,
  ENGINE_ACTIVATE_LABEL,
} from "./modules/ai-vocal/engine-client-runtime.js";

const ITTY_BITTY_HASH =
  "NextStudio-DOS/data:text/html;charset=utf-8;bxze64,XQAAAAT//////////wAeCEUG0O+oKBdZ2an16qclPsVsA9xArjEo+v7wdal3CixLBEPHLcIzaUfd4rHDA96EUaUbN8xgO88V1nWuPHTJAT30mqe22aETjAjkKm7CDRGF4aGhQ0NkqnT/kL37L7aI0sM4OjGdhO8NAaFjkioW34hausZMUfjJLza1N0HOoIY8wnC8dTF40XRkphO0Sesb4hMUrasRKV6GRyPHgvMEQgIFj3Cbu47BKfEPq2hT7wk9ka47eBeE7iwEt8fqIe3jIjxD6D+2SOsMHwTxfPvb+qKFmmwLZTjig94ZB8qEVrg+eea8HyV/eiCBfokMp5s0hB5T3upm0dL0nUq38LQK1RIVti3XFSGmaZwIwvQz/Gi8tS+NllFNg+2fASDEDeQdwVwvVYxZ0UZmezrKB6i466x1BeSCpxWS0ik5S5a87wpw27Ly9Ze7qRFIgdJLROqpTkBGobx0LPC5naRHaZe0OoKG+sDeSPT9fyrHlKKiDIplfK0yBbPQBkiz2nDLsNVoKvXafSK/oOtfyUcchc4PtO05Y/zhIjsq1/q4bWLmTuXhnqBJZezpH0VEgt1ljRnyixAFss01KM0otiNncA501guCWoeUMT72Wl39sepeF/tt8gq5mwSADe/RF1F26Jl0e0ITLxGQZ0v7n2LNd0v5yhf6peS3Bb5CZWbU8qxcP1h4X5w8aJUzjhDolUg20kpN/dPlj5+FRtLGbRMuqsQVTUxOoBP9SEwulOb/3PSqCFNPk/g1QdajAYIJWVx1XceP5aJXjht4sLkJmx4k3hjM8sMTjqoufv4TN18gXl7YXN0g0wizRh7MCSMvp58QINpgljoPmLndJ4XvwohbriVbhNzKUDoWulc1MkXzGpovm1xuhu6StYvFhFFVRU157ELnIeO8wjMFX9M5iQFqa2VJe08zO66Ns0+ZoLGmZhrbO9EQhlOxTEImlKY46H5HBaJAjol19/azMfx7ztF+g8bL+45fVc7Ga4EXa9bEKF+K+5uTusvEKYoqfOl8uiIyxiIH1ospAab0ZcZXF8kfWgCqrYpfZTKkPWDaFJHHCYkLPQyFTR9MZbyinMI56tfnM4gQDf2b3MCS6q/V8kNkRQNiWnwUcZWz15a55jbopwPW1V1kmKW5xA2iwXcdAKSH/j/h9Lu8Fk1/FUdOwYa0wDfBm05b1u3VB5EwvmBfXN8eX6ZE3vK2j092pYzqhaTJ82/hvFqxJsMYi8be2WnQ1ZzCIZbA56wf15aIDtWH/IYMd90OpNSUz/oqiZgP+qlKb04wY9i728z0ow/OtmDhsm86YF97oCXOqd25cKKuT6mKe6gL2Upbr2OM7l47DHYiAGY4TsDAWFDtIDortyMiE5jxctCze6jY4O98/XiDe0uw5QyRKjGBFTcp0zwK2zWQZdrOrP43wA+yPk+YuxSV/XGNk5YQ9HfOfA9NGVrVHtS24pZEEcoIXak/AiNUpB7dP1j7FpQZyUL0SUOvX/WcJm2QPA6IG9pauSjytFxSFWzLVgD7LCEZi7CQvgzfMB6az+nlc9ngn8aoff+fOvk6rg2I1ng7HNpYsCWI0y7eDRrukAOBAp/j7EYYSnZo6vfY7n7om9w0kcLAUot+LHGHT76yZdnQgQmADmLXAK+hrkLe87HtZ/PblGDlg2xk9CWmOvSbhl12U3zXNAUq4mDyfXhoiv/4eYIyBWlKzkRHIujB/1Ke4Nia7PSPLyE5+u8puyXiM0yBHVODN++pIf97NNOfIWU+cVkyKiduFLkGsYdVOLipeQt+eFBoV/N0G4DD1lFyxVH8vX1DcjdNRHJ2H2ErVZrLX5l+R/ivNAFbwjCCfQZya6iz4OLY72nt7JM4ys3jgRerRABMrw1fZ9AJNb7fh/WN8zniuOBam5vkxZjfKnWQLpoGr0+VyVzXCpuDPJkWUzDhD/djqbrBZSE31FurZau9Wa2xzhv8+nhLOHd+yOqBu01r+HM0IYT//nl5MP581QlmCeB9DAntqvy6nhdd9MklgU5cJ49Bo6WSu9stKpscY5uEBXe036nd8/eEOT0/2tYSCSp7WKZtNAPHe1JvEffsZlKosslSGUrlYZSt2uHj9RzH2eNf3mDWJNXHSYjJWdKRWCCxrcvYoVkrp0dJAEHin1HnCHNASNVlBYVjoG+aoV5WgBihTZ/tpTV65Da6Q1g2zx5BeYbMz+LpY/UFoaW6g308gfJ70RTCFqBz9yn5QpJqTB32QNWoFIzAAaMNb+aqOo+ZwIsZFjeFUyx1PD/a7b++QLWWlIpj0ydTtsGMEUQZezaWT1lrR0S4PWV3/vqDRndxD3v7deW6yV+wDgaxxtK8GEguFDMH023LxnUaibne8rCmvWxOhRto3PpZ+oGAgkcjKSmUNYnvne2+7Ocz8AEBXVRIl6DloDz5Ko7Bk2Tqpu6GXBrcxS+TRnIol4f+51ZRDMAPN899jsUB7VcknR23v7n8XG97o9k7X1ZyXeMXWKZ92sY594v0Uyo3nvwCWJCv04p37YAkOtU8XMDaCp9FriflSYIm4C+q543VuCJXMn+4wHwPEf/2XiZJfbCJ6bt1KOuL//xulkt7Ax90LfiVIEtVN456U+4iWkfyqMVnpaFWxVE8Nhk0OA0O63XThDnXfuW7Hh4PHODyQjUvEz+SWjGiZFZqesR7LoocPXVGFgHjiQ00uSD1so2x/Gkclm6TLPctGw7IN/pPZNJpDRCjtq5EO6tx3/62jmzuHEmceDh1aoIrwT3EkSXaUT/HW29CEZ5yD40oUgvQ3WO1LHKycvB2aSKq46muoL9Rp3bksdQltYs9qUwYCYCVJJs+UlAUAOhSvvbjL/qcXTxlJVUEIuWDDjCOb8rpLjal6T1EP6nLlQ6FYSt4693uCWR4W+7FybdbmpUV+e2b4K1pcyYOEAv0M/PHoduaQqz6A3bZZ0bkrSTtYPwFeHZkLzV3Gryz21RFIYXW3mzEVLqc5Ch2dGStZ5BWBxmqDrNbq8f5O1c/5DZ5NHQk1/vvTL+b78bNyaoRx4sF9epv8idPqfKcTpfTfjR8UywuU1TKst0FB5xIGJQ7ktgBYGEkaH17ASwG4Dit2GRwBSCLdB4HTadh8wRFTmoQKBCDJ/TF6zbRy7+eMBRw7w4SZg1J0nTLI1ahGdDX30hlJNz8ze/Hnge8so06v0O474D81B/lFU2QpVfRegTkH2wRTmS51z+2cykqx05Q3igwFNSu/x78jskk6IwYHu91oAFSSkntuzl3hFtSrYdO05wJ7qVyZWCCmocAjy9SuJ9jpGxY+KgprTkALvSR97cKXU+QGwKIuMu6K+Nr/dUaexV9f10JjQSGuWuNsbcy1pkU6uxaC7uOXsOpxemcfnaEctbjBVRyn8hvKJmn5ceN3dLjS6ATY4vP1L0P2vHZeSLYpJtBbc+KBGP/cOdqnPxz7SvboAL/nT5x8TmQfoJHFpXvvQXlPmedLndx4D8h3/7YVB+E/FJMgktX4jVq6/w39xKUMsTXzAj68HG+0X/HabmKRxqyDgARD1cJfKxo5tszJdlNfo6FHIegv6cACqD1hJHZEKRSYJgMzQxCqHEyN9Hi653SIPNXy52VNKsy2pZiZ6lJxdze2hBRoqk9vbC3bsbcB6+aCkGpnKBkkFPaMch39jEaU3roSpru2xkazCVH2Bk6YKwFj9kvCY9iRxRNf7875rrEj6a/TZuH3Tox02dB701lpXSchkzw8XHXcPbF4i4kACwchw9VTZqOGwjaNHCLjiWUQxqDX1UTXExA1O6jGbp8asSqLwecDm1bzv1AS9j6B0WuS/1Z5qOe33V8d3X/98uy6w==";
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
const AI_WARNING_MAX_AGE_MS = 10 * 60 * 1000;
const DONATION_URL = "https://ganknow.com/nextfeederlabs/tip";
const DONATION_MIN_USAGE_MS = 30 * 60 * 1000;
const DONATION_MIN_SESSIONS = 3;
const DONATION_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const DONATION_MAX_PROMPTS = 3;
const AI_VOCAL_INFO_SEEN_KEY = "hasSeenAiVocalInfoModal";
const REMOTE_PUBLIC_URL = "https://studio.nextfeeder.com/remote";
// Version the cache so links generated by older builds can never be restored.
const REMOTE_LINK_CACHE_KEY = "remoteLinkCacheV2";

let isAudioMasterOn = true;
let isVideoMasterOn = true;

let isEqOn = true;
let isVocalOn = false;
let currentVocalMode = "bypass";
let aiEngineType = "webgl";
let aiPowerMode = "eco"; // "eco" or "quality"; WEB AI only
// Detail is the single production profile. Keep experimental profiles
// internal and do not expose a profile selector.
let currentVocalProfile = "ai_remove";
let currentVocalDevice = "";
let currentVocalDeviceRaw = "";
let currentVocalApi = "WEBGL";
let currentVocalStatus = "ORIGINAL";

let isNormalizeOn = false;
let currentEqValues = [...PRESETS.flat];
let visualMode = 0;
let isRecording = false;
let db = new DBManager();
let isTabReady = true;
let currentTabId = null;
let captureRequestId = 0;

let sessionManager;
let settingsModal;
let extensionReadyPromise = null;
const ACTION_NOTIFICATION_DELAY_MS = 280;
const actionNotificationTimers = new Map();

function showActionNotification(message, { source = "local", tone = "success", icon = "ph-check-circle" } = {}) {
  if (!message) return;

  // Notifications live on the media page, not inside this popup. Remote
  // commands are relayed by the offscreen host when the popup is closed.
  if (source !== "remote" && currentTabId) {
    chrome.tabs.sendMessage(currentTabId, {
      type: "SHOW_ACTION_NOTIFICATION",
      message,
      icon,
      tone,
    }).catch(() => {});
  }
}

function scheduleActionNotification(group, messageFactory, options = {}) {
  const oldTimer = actionNotificationTimers.get(group);
  if (oldTimer) clearTimeout(oldTimer);
  const timer = setTimeout(() => {
    actionNotificationTimers.delete(group);
    const message = typeof messageFactory === "function" ? messageFactory() : messageFactory;
    showActionNotification(message, options);
  }, ACTION_NOTIFICATION_DELAY_MS);
  actionNotificationTimers.set(group, timer);
}

function formatSignedValue(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  const formatted = decimals > 0 ? number.toFixed(decimals) : String(Math.round(number));
  return number > 0 ? `+${formatted}` : formatted;
}

function getActionNotification(key, value) {
  switch (key) {
    case "isAudioMasterOn":
      return { message: `AUDIO ${value ? "ON" : "OFF"}`, icon: value ? "ph-speaker-high" : "ph-speaker-slash" };
    case "pitch":
      return { group: "pitch", message: `KEY ${formatSignedValue(value)}`, icon: "ph-music-note" };
    case "reverb":
      return { group: "reverb", message: `REVERB ${Number(value).toFixed(1)}`, icon: "ph-waveform" };
    case "isEqOn":
      return { message: `EQ ${value ? "ON" : "OFF"}`, icon: value ? "ph-equalizer" : "ph-speaker-slash" };
    case "normalize":
      return { message: `DYN ${value ? "ON" : "OFF"}`, icon: value ? "ph-arrows-in" : "ph-arrows-out" };
    case "isVocalOn":
      return { message: `AI VOCAL ${value ? "ON" : "OFF"}`, icon: value ? "ph-sparkle" : "ph-sparkle-slash" };
    case "vocalMode": {
      const labels = { karaoke: "KARAOKE", acapella: "ACAPELLA", bypass: "ORIGINAL" };
      return {
        message: `${labels[value] || String(value).toUpperCase()} ACTIVE`,
        icon: value === "karaoke" ? "ph-microphone-slash" : "ph-speaker-high",
        tone: "loading",
      };
    }
    case "vocalProfile":
      return { message: `AI PROFILE ${String(value).replace(/_/g, " ").toUpperCase()}`, icon: "ph-sliders" };
    case "aiPowerMode":
      return { message: `AI ${normalizeAiPowerMode(value).toUpperCase()}`, icon: normalizeAiPowerMode(value) === "eco" ? "ph-leaf" : "ph-sparkle" };
    case "aiEngineType":
      return { message: `AI ENGINE ${GO_ENGINE_ENABLED && value === ENGINE_TYPE ? "GO" : "WEB"}`, icon: GO_ENGINE_ENABLED && value === ENGINE_TYPE ? "ph-lightning" : "ph-globe" };
    case "videoQuality":
      return { message: `VIDEO ${String(value).toUpperCase()}`, icon: "ph-monitor-play" };
    case "videoDelay":
      return { group: "videoDelay", message: `VIDEO DELAY ${Number(value).toFixed(2)}s`, icon: "ph-clock-countdown" };
    case "videoTransform":
      return {
        group: "videoTransform",
        message: () => `VIDEO ${Math.round(Number($("#video-zoom")?.value || 1) * 100)}% / ${Number($("#video-rotate")?.value || 0)}°`,
        icon: "ph-crop",
      };
    case "isVideoMasterOn":
      return { message: `VIDEO ${value ? "ON" : "OFF"}`, icon: value ? "ph-monitor-play" : "ph-monitor-slash" };
    case "videoPosition":
      return {
        group: "videoPosition",
        message: () => `VIDEO POS ${$("#video-pos-x")?.value || 0},${$("#video-pos-y")?.value || 0}`,
        icon: "ph-arrows-out-cardinal",
      };
    default:
      return null;
  }
}

function notifyAction(key, value, { source = "local", immediate = false, groupOverride = null } = {}) {
  const config = getActionNotification(key, value);
  if (!config) return;
  const options = { source, tone: config.tone, icon: config.icon };
  const group = groupOverride || config.group;
  if (!immediate && group) {
    scheduleActionNotification(group, config.message, options);
  } else {
    const message = typeof config.message === "function" ? config.message() : config.message;
    showActionNotification(message, options);
  }
}

async function checkFirstLaunchModal() {
  const data = await chrome.storage.local.get(["hasSeenWelcomeDonateModal"]);
  if (!data.hasSeenWelcomeDonateModal) {
    const overlay = $("#first-launch-overlay");
    if (!overlay) return;

    const btnDonate = $("#btn-first-launch-donate");
    const btnDismiss = $("#btn-first-launch-dismiss");
    const btnClose = $("#btn-close-first-launch");

    const dismissDonate = (openLink = false) => {
      chrome.storage.local.set({ hasSeenWelcomeDonateModal: true });
      overlay.classList.remove("active");
      if (openLink) {
        chrome.tabs.create({ url: DONATION_URL });
      }
    };

    if (btnDonate) btnDonate.onclick = () => dismissDonate(true);
    if (btnDismiss) btnDismiss.onclick = () => dismissDonate(false);
    if (btnClose) btnClose.onclick = () => dismissDonate(false);

    overlay.classList.add("active");
  }
}

async function maybeShowUsageDonateModal(audioState) {
  // Never cover a live audio session or another status/error dialog.
  if (!isTabReady || isAudioMasterOn || audioState?.isAudioActive) return;

  const overlay = $("#usage-donate-overlay");
  if (!overlay || overlay.classList.contains("active")) return;

  const data = await chrome.storage.local.get([
    "hasSeenWelcomeDonateModal",
    "donationUsage",
  ]);
  if (!data.hasSeenWelcomeDonateModal) return;

  const usage = data.donationUsage || {};
  const usageMs = Number(usage.usageMs) || 0;
  const completedSessions = Number(usage.completedSessions) || 0;
  const promptCount = Number(usage.promptCount) || 0;
  const now = Date.now();

  if (usage.dismissedForever || promptCount >= DONATION_MAX_PROMPTS) return;
  if (Number(usage.snoozeUntil) > now) return;
  if (Number(usage.lastPromptAt) && now - Number(usage.lastPromptAt) < DONATION_COOLDOWN_MS) return;
  if (usageMs < DONATION_MIN_USAGE_MS && completedSessions < DONATION_MIN_SESSIONS) return;

  // Reserve this prompt before displaying it so reopening the popup cannot
  // show the same request repeatedly if the user closes it immediately.
  await chrome.storage.local.set({
    donationUsage: {
      ...usage,
      promptCount: promptCount + 1,
      lastPromptAt: now,
    },
  });

  const close = () => overlay.classList.remove("active");
  const updatePromptState = (extra = {}) =>
    chrome.storage.local.set({
      donationUsage: {
        ...usage,
        promptCount: promptCount + 1,
        lastPromptAt: now,
        ...extra,
      },
    });
  const openDonation = () => {
    updatePromptState({ dismissedForever: true });
    close();
    chrome.tabs.create({ url: DONATION_URL });
  };
  const later = () => {
    updatePromptState({ snoozeUntil: now + DONATION_COOLDOWN_MS });
    close();
  };
  const dismissForever = () => {
    updatePromptState({ dismissedForever: true });
    close();
  };

  $("#btn-usage-donate").onclick = openDonation;
  $("#btn-usage-later").onclick = later;
  $("#btn-usage-dismiss").onclick = dismissForever;
  $("#btn-close-usage-donate").onclick = later;
  overlay.classList.add("active");
}

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) currentTabId = tab.id;

  // Audio capture is not limited to media websites. Let the capture request
  // decide whether the current tab is supported instead of blocking on a
  // YouTube/media-tab gate or requiring a content-script ping.
  isTabReady = true;
  const videoContentScriptsReady = ensureVideoContentScripts(currentTabId);
  checkFirstLaunchModal();

  sessionManager = new SessionManager(currentTabId);
  settingsModal = new SettingsModal(db, {
    onThemeChange: applyTheme,
    onSettingChange: (obj) => {
      sessionManager.setSetting(obj);
      if (obj.sampleRate !== undefined || obj.latencyHint !== undefined) {
        if (isAudioMasterOn && currentTabId && isTabReady) {
          initCapture(sessionManager.sessionMode);
        }
      }
    },
    onReset: handleReset,
    onSendParam: (k, v) => sendParam(k, v),
    onToggleRecord: toggleRecording,
  });

  renderNewEQSystem();
  setupListeners();
  setupStorageListener();
  setupRemoteUI();

  extensionReadyPromise = sessionManager.init(async () => {
    settingsModal.init();
    await videoContentScriptsReady;
    await finalizeInitialization();
  });
  await extensionReadyPromise;
});

async function finalizeInitialization() {
  await loadUserPreferences();
  try {
    await db.open();
    settingsModal.renderRecordingList();
  } catch (e) {}

  const savedToggles = await sessionManager.getSetting([
    "isAudioMasterOn",
    "isVideoMasterOn",
    "isEqOn",
    "isVocalOn",
    "vocalMode",
    "aiEngineType",
    "vocalProfile",
    "aiPowerMode",
  ]);
  if (savedToggles.isAudioMasterOn !== undefined)
    isAudioMasterOn = savedToggles.isAudioMasterOn;
  if (savedToggles.isVideoMasterOn !== undefined)
    isVideoMasterOn = savedToggles.isVideoMasterOn;
  if (savedToggles.isEqOn !== undefined) isEqOn = savedToggles.isEqOn;
  if (savedToggles.isVocalOn !== undefined) isVocalOn = savedToggles.isVocalOn;
  if (["bypass", "karaoke", "acapella"].includes(savedToggles.vocalMode)) {
    currentVocalMode = savedToggles.vocalMode;
  }
  if (savedToggles.aiEngineType !== undefined) {
    aiEngineType = GO_ENGINE_ENABLED && savedToggles.aiEngineType === ENGINE_TYPE
      ? ENGINE_TYPE
      : "webgl";
    if (!GO_ENGINE_ENABLED && savedToggles.aiEngineType === ENGINE_TYPE) {
      await sessionManager.setSetting({ aiEngineType: "webgl" });
    }
  }
  // ECO is the only user-facing production mode. Migrate any older FULL or
  // legacy value so reopening the popup cannot silently restore a hidden mode.
  aiPowerMode = "eco";
  if (savedToggles.aiPowerMode !== aiPowerMode) {
    await sessionManager.setSetting({ aiPowerMode });
  }
  currentVocalProfile = "ai_remove";
  await sessionManager.setSetting({ vocalProfile: currentVocalProfile });
  updateVocalProfileUI(currentVocalProfile);
  updateAiPowerModeUI(aiPowerMode);
  updateAiEngineUI();
  if (GO_ENGINE_ENABLED) checkGoEngineHealth();

  if (sessionManager.sessionMode === "shared") {
    // [NEW] Add videoPosX and videoPosY to load
    const sharedParams = await chrome.storage.local.get([
      "volume",
      "pan",
      "pitch",
      "reverb",
      "eq",
      "eqPreset",
      "normalize",
      "videoZoom",
      "videoRotate",
      "videoDelay",
      "videoPosX",
      "videoPosY",
      "isEqOn",
      "isVocalOn",
      "vocalMode",
      "reverbTime",
      "reverbDecay",
      "dynBoost",
      "dynLimit",
      "vocalProfile",
      "aiPowerMode",
    ]);

    if (Object.keys(sharedParams).length > 0) {
      if (sharedParams.volume !== undefined) {
        updateSlider(
          "#main-vol",
          "#txt-vol",
          sharedParams.volume,
          (v) => Math.round(v * 100) + "%"
        );
      }
      if (sharedParams.pan !== undefined) {
        updateSlider("#main-pan", "#txt-pan", sharedParams.pan, (v) =>
          v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C"
        );
      }
      if (sharedParams.pitch !== undefined) {
        updateSlider(
          "#main-pitch",
          "#txt-pitch",
          sharedParams.pitch,
          (v) => (v > 0 ? "+" : "") + v
        );
      }
      if (sharedParams.reverb !== undefined) {
        updateSlider("#main-verb", "#txt-verb", sharedParams.reverb, (v) =>
          v.toFixed(1)
        );
      }
      if (sharedParams.eqPreset) {
        $("#eq-preset").value = sharedParams.eqPreset;
      }
      if (sharedParams.eq) {
        currentEqValues = sharedParams.eq;
        $$(".eq-slider").forEach((inp, i) => {
          inp.value = currentEqValues[i];
        });
        updateEQVisuals();
      }
      if (sharedParams.normalize !== undefined) {
        isNormalizeOn = sharedParams.normalize;
        updateNormalizeButton();
      }
      if (sharedParams.isVocalOn !== undefined) {
        isVocalOn = sharedParams.isVocalOn;
      }
      if (sharedParams.vocalMode) {
        updateVocalUI(sharedParams.vocalMode);
      } else {
        updateVocalMasterUI();
      }
      if (sharedParams.vocalProfile) updateVocalProfileUI("ai_remove");
      // Keep the hidden power-mode control on the single production default.
      aiPowerMode = "eco";
      updateAiPowerModeUI(aiPowerMode);

      if (sharedParams.reverbTime)
        $("#adv-rev-time").value = sharedParams.reverbTime;
      if (sharedParams.reverbDecay)
        $("#adv-rev-decay").value = sharedParams.reverbDecay;
      if (sharedParams.dynBoost)
        $("#adv-dyn-boost").value = sharedParams.dynBoost;
      if (sharedParams.dynLimit)
        $("#adv-dyn-limit").value = sharedParams.dynLimit;

      if (sharedParams.videoZoom)
        $("#video-zoom").value = sharedParams.videoZoom;
      if (sharedParams.videoRotate)
        $("#video-rotate").value = sharedParams.videoRotate;

      // [NEW] Load Position
      if (sharedParams.videoPosX)
        $("#video-pos-x").value = sharedParams.videoPosX;
      if (sharedParams.videoPosY)
        $("#video-pos-y").value = sharedParams.videoPosY;

      if (sharedParams.videoDelay) {
        $("#video-delay").value = sharedParams.videoDelay;
        $("#num-video-delay").value = parseFloat(
          sharedParams.videoDelay
        ).toFixed(2);
      }
      syncVideoTransform();
    }
  } else if (sessionManager.sessionMode === "temp") {
    $("#video-zoom").value = sessionManager.tempStorage.videoZoom || 1;
    $("#video-rotate").value = sessionManager.tempStorage.videoRotate || 0;
    $("#video-pos-x").value = sessionManager.tempStorage.videoPosX || 0;
    $("#video-pos-y").value = sessionManager.tempStorage.videoPosY || 0;
    syncVideoTransform();
  }

  const state = await sendMessageWithRetry({
    type: "GET_STATE",
    tabId: currentTabId,
  });

  if (state && state.isAudioActive) {
    loadAudioState(state);
    isAudioMasterOn = true;
    // The popup is recreated every time it is reopened. Restore the recorder
    // state from the offscreen session instead of trusting the new popup's
    // default (false) value. Otherwise a still-recording MediaRecorder looks
    // like REC locally, and the next START_RECORDING is rejected as busy.
    syncRecordingUI(state.isRecording === true);
  } else {
    syncRecordingUI(false);
    if (isAudioMasterOn && isTabReady) {
      initCapture(sessionManager.sessionMode);
    }
  }

  updateMasterTogglesUI();
  updateEqToggleButton();

  let frameCount = 0;
  const loop = () => {
    drawEQGraph(currentEqValues);
    frameCount++;
    if (frameCount < 60) requestAnimationFrame(loop);
  };
  loop();

  // Check only when the user opens the popup and the audio session is idle.
  // It never interrupts playback or model loading.
  maybeShowUsageDonateModal(state).catch(() => {});
}

async function ensureVideoContentScripts(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return false;
  const result = await sendMessageWithRetry({
    type: "ENSURE_VIDEO_CONTENT_SCRIPTS",
    tabId,
  });
  return result?.success === true;
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (
      namespace === "local" &&
      sessionManager &&
      sessionManager.sessionMode === "shared"
    ) {
      if (changes.volume) {
        const v = changes.volume.newValue;
        $("#main-vol").value = v;
        $("#txt-vol").textContent = Math.round(v * 100) + "%";
      }
      if (changes.pan) {
        const v = changes.pan.newValue;
        $("#main-pan").value = v;
        $("#txt-pan").textContent =
          v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
      }
      if (changes.pitch) {
        const v = changes.pitch.newValue;
        $("#main-pitch").value = v;
        $("#txt-pitch").textContent = (v > 0 ? "+" : "") + v;
      }
      if (changes.reverb) {
        const v = changes.reverb.newValue;
        $("#main-verb").value = v;
        $("#txt-verb").textContent = v.toFixed(1);
      }
      if (changes.eqPreset) {
        $("#eq-preset").value = changes.eqPreset.newValue;
      }
      if (changes.eq) {
        currentEqValues = changes.eq.newValue;
        $$(".eq-slider").forEach((inp, i) => {
          inp.value = currentEqValues[i];
        });
        updateEQVisuals();
      }
      if (changes.isEqOn) {
        isEqOn = changes.isEqOn.newValue;
        updateEqToggleButton();
      }
      if (changes.aiPowerMode) {
        aiPowerMode = "eco";
        updateAiPowerModeUI(aiPowerMode);
        if (changes.aiPowerMode.newValue !== aiPowerMode) {
          chrome.storage.local.set({ aiPowerMode }).catch(() => {});
        }
      }
    }
  });
}

function buildPublicRemoteUrl(hostId, token) {
  const url = new URL(REMOTE_PUBLIC_URL);
  url.hash = new URLSearchParams({ host: hostId, token }).toString();
  return url.toString();
}

async function getCachedRemoteLink(tabId, hostId, token) {
  if (!tabId || !hostId || !token) return null;
  try {
    const data = await chrome.storage.session.get(REMOTE_LINK_CACHE_KEY);
    const cached = data[REMOTE_LINK_CACHE_KEY]?.[String(tabId)];
    if (
      cached?.hostId === hostId &&
      cached?.token === token &&
      typeof cached.finalUrl === "string" &&
      cached.finalUrl.length > 0
    ) {
      return cached;
    }
  } catch (e) {
    // Link caching is an enhancement; remote generation still works if the
    // session storage area is unavailable.
  }
  return null;
}

async function cacheRemoteLink(tabId, hostId, token, finalUrl) {
  if (!tabId || !hostId || !token || !finalUrl) return;
  try {
    const data = await chrome.storage.session.get(REMOTE_LINK_CACHE_KEY);
    const cache = data[REMOTE_LINK_CACHE_KEY] || {};
    cache[String(tabId)] = {
      hostId,
      token,
      finalUrl,
      savedAt: Date.now(),
    };
    await chrome.storage.session.set({ [REMOTE_LINK_CACHE_KEY]: cache });
  } catch (e) {
    // A cache miss on the next popup open is safe and will regenerate the
    // link for the still-active remote token.
  }
}

async function setupRemoteUI() {
  const btnConnect = $("#btn-remote-connect");
  const qrOverlay = $("#qr-overlay");
  const qrImage = $("#qr-image");
  const qrLoading = $("#qr-loading");
  const qrLoadingText = $("#qr-loading-text");
  const urlDisplay = $("#remote-url-display");
  const btnCloseQr = $("#btn-close-qr");
  const btnCopyUrl = $("#btn-copy-url");
  let qrRequestUrl = "";
  let qrRetryCount = 0;
  let qrLoadGeneration = 0;

  const setQrLoading = (message) => {
    if (qrLoading) qrLoading.classList.remove("hidden");
    if (qrLoadingText) qrLoadingText.textContent = message;
    if (qrImage) {
      qrImage.classList.add("hidden");
    }
  };

  const loadQrImage = (url) => {
    qrRequestUrl = url;
    qrRetryCount = 0;
    qrLoadGeneration += 1;
    const generation = qrLoadGeneration;
    setQrLoading("LOADING QR...");
    if (qrImage) {
      qrImage.dataset.qrGeneration = String(generation);
      qrImage.src = `${url}&_=${Date.now()}`;
    }
  };

  const getRemoteTokenWhenReady = async (tabId) => {
    let response = null;
    // Popup setup and START_CAPTURE are asynchronous. Give the offscreen
    // session a short window to publish its session before showing an error.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      response = await sendMessageWithRetry({ type: "GET_REMOTE_TOKEN", tabId });
      if (response?.hostId && response?.token) return response;
      if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return response;
  };

  qrImage?.addEventListener("load", () => {
    if (qrImage.dataset.qrGeneration !== String(qrLoadGeneration)) return;
    if (qrLoading) qrLoading.classList.add("hidden");
    qrImage.classList.remove("hidden");
  });

  qrImage?.addEventListener("error", () => {
    if (qrImage.dataset.qrGeneration !== String(qrLoadGeneration)) return;
    if (qrRetryCount < 2 && qrRequestUrl) {
      qrRetryCount += 1;
      setQrLoading(`RETRYING QR ${qrRetryCount}/2...`);
      setTimeout(() => {
        if (qrImage && qrImage.dataset.qrGeneration === String(qrLoadGeneration)) {
          qrImage.src = `${qrRequestUrl}&_=${Date.now()}`;
        }
      }, 500);
    } else {
      setQrLoading("QR SERVER UNAVAILABLE");
    }
  });

  btnConnect.addEventListener("click", async () => {
    qrLoadGeneration += 1;
    qrRequestUrl = "";
    qrRetryCount = 0;
    setQrLoading("CONNECTING REMOTE...");
    qrOverlay.classList.remove("hidden");
    try {
      let hasOffscreen = await sendMessageWithRetry({
        type: "CHECK_OFFSCREEN",
      });
      if (!hasOffscreen) {
        await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
        await new Promise((r) => setTimeout(r, 500));
      }

      if (extensionReadyPromise) {
        try { await extensionReadyPromise; } catch (_) {}
      }

      const res = await getRemoteTokenWhenReady(currentTabId);

      if (res && res.hostId && res.token) {
        const elId = $("#remote-id-display");
        const elTok = $("#remote-token-display");
        if (elId) elId.textContent = res.hostId;
        if (elTok) elTok.textContent = res.token;

        // The offscreen audio session owns the remote token. Reuse the same
        // generated link while that session is alive so reopening the popup
        // does not create a new public Remote URL every time.
        const cachedLink = await getCachedRemoteLink(
          currentTabId,
          res.hostId,
          res.token
        );
        let finalUrl = cachedLink?.finalUrl;

        if (finalUrl) {
          setQrLoading("RESTORING REMOTE...");
        } else {
          urlDisplay.value = "Generating remote...";
          setQrLoading("GENERATING QR LINK...");

          finalUrl = buildPublicRemoteUrl(res.hostId, res.token);
          await cacheRemoteLink(currentTabId, res.hostId, res.token, finalUrl);
        }

        urlDisplay.value = finalUrl;
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
          finalUrl
        )}`;
        loadQrImage(qrApi);
      } else {
        setQrLoading("REMOTE ID NOT READY");
        alert("Remote ID not ready. Please turn Audio Master ON first.");
      }
    } catch (e) {
      console.error(e);
      setQrLoading("REMOTE ERROR — TRY AGAIN");
      alert("Failed to connect remote.");
    }
  });

  btnCloseQr.addEventListener("click", () => {
    qrOverlay.classList.add("hidden");
  });

  btnCopyUrl.addEventListener("click", () => {
    urlDisplay.select();
    document.execCommand("copy");
    const oldText = btnCopyUrl.textContent;
    btnCopyUrl.textContent = "COPIED!";
    setTimeout(() => (btnCopyUrl.textContent = oldText), 1000);
  });
}

function updateSlider(selector, textSelector, value, textFormatter) {
  const el = $(selector);
  if (el) {
    el.value = value;
    $(textSelector).textContent = textFormatter(value);
  }
}

async function loadUserPreferences() {
  const data = await sessionManager.getSetting([
    "theme",
    "startupVol",
    "latencyHint",
    "sampleRate",
    "showStats",
  ]);
  if (data.theme) applyTheme(data.theme);
  settingsModal.setValues(data);
}

function applyTheme(colorCode) {
  if (!colorCode) return;
  let winColor, textColor, textSec;
  if (colorCode === "blue") {
    winColor = "#000080";
    textColor = "#00ff00";
    textSec = "#ffcc00";
  } else if (colorCode === "red") {
    winColor = "#800000";
    textColor = "#ff0000";
    textSec = "#ffaaaa";
  } else if (colorCode === "green") {
    winColor = "#005000";
    textColor = "#00ff00";
    textSec = "#aaffaa";
  }
  if (winColor) {
    const r = document.documentElement;
    r.style.setProperty("--theme-window", winColor);
    r.style.setProperty("--theme-text", textColor);
    r.style.setProperty("--theme-text-sec", textSec);
    $$(".theme-box").forEach(
      (b) =>
        (b.style.border =
          b.dataset.theme === colorCode ? "2px solid white" : "1px solid #666")
    );
    updateNormalizeButton();
  }
}

async function initCapture(mode) {
  if (!currentTabId) return;
  const requestId = ++captureRequestId;
  let hasOffscreen = await sendMessageWithRetry({ type: "CHECK_OFFSCREEN" });
  if (requestId !== captureRequestId) return;
  if (!hasOffscreen) {
    await sendMessageWithRetry({ type: "INIT_OFFSCREEN" });
    await new Promise((r) => setTimeout(r, 1000));
    if (requestId !== captureRequestId) return;
  }
  const latencyHint = $("#sel-latency")?.value || "balanced";
  const sampleRate = $("#sel-sample-rate")?.value || "44100";
  const preset = $("#eq-preset").value || "flat";

  chrome.tabCapture.getMediaStreamId(
    { targetTabId: currentTabId },
    (streamId) => {
      if (requestId !== captureRequestId) return;
      if (chrome.runtime.lastError || !streamId) return;
      chrome.runtime
        .sendMessage({
          type: "START_CAPTURE",
          streamId,
          tabId: currentTabId,
          latencyHint: latencyHint,
          sampleRate: sampleRate,
          mode: mode,
          initialPreset: preset,
          aiPowerMode: aiPowerMode,
        })
        .then((res) => {
          if (requestId !== captureRequestId || !res?.success) return;
          if (res && res.sampleRate) {
            settingsModal.updateActiveSampleRate(res.sampleRate);
          }
          sendParam("volume", parseFloat($("#main-vol").value));
          sendParam("pan", parseFloat($("#main-pan").value));
          sendParam("pitch", parseInt($("#main-pitch").value));
          sendParam("reverb", parseFloat($("#main-verb").value));
          sendParam("normalize", isNormalizeOn);
          sendParam("eqPreset", preset);
          sendParam("isEqOn", isEqOn);
          currentEqValues.forEach((val, i) => sendParam("eq", val, i));
          sendParam("reverbTime", parseFloat($("#adv-rev-time").value));
          sendParam("reverbDecay", parseFloat($("#adv-rev-decay").value));
          sendParam("dynBoost", parseFloat($("#adv-dyn-boost").value));
          sendParam("dynLimit", parseFloat($("#adv-dyn-limit").value));
          sendParam("videoDelay", parseFloat($("#video-delay")?.value || 0));
          sendParam("videoZoom", parseFloat($("#video-zoom")?.value || 1));
          sendParam("videoRotate", parseFloat($("#video-rotate")?.value || 0));
          sendParam("videoQuality", $("#video-quality")?.value || "max");
          sendParam("isVideoMasterOn", isVideoMasterOn);
          sendParam("isVocalOn", isVocalOn);
          sendParam("vocalMode", currentVocalMode);
          sendParam("vocalProfile", currentVocalProfile);
          sendParam("aiPowerMode", aiPowerMode);
          sendParam("aiEngineType", aiEngineType);
        })
        .catch((e) => console.warn(e));
    }
  );
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PARAM_UPDATE") {
    if (currentTabId && msg.tabId === currentTabId) {
      updateUIFromExternal(msg.key, msg.value, msg.index);
    }
  } else if (msg.type === "VISUALIZER_DATA") {
    if (currentTabId && msg.tabId === currentTabId)
      drawVisualizer(msg.data, msg.mode);
  } else if (msg.type === "AI_VOCAL_STATUS") {
    updateVocalRuntimeStatus(msg.status);
    updateVocalRuntimeUI(
      msg.engine,
      msg.hardwareDevice || msg.device,
      msg.api,
      msg.hardwareDeviceRaw || msg.device
    );
  } else if (msg.type === "RECORDING_SAVED") {
    handleRecordingSaved();
  } else if (msg.type === "AI_HARDWARE_WARNING") {
    if (msg.active === false || msg.reason === "recovered") {
      hideAiSlowModal();
    } else if (isCurrentAiWarning(msg)) {
      showAiSlowModal(msg.liveP95Ms || msg.benchmarkMs, msg.deviceLabel);
    }
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.aiHardwareWarning && changes.aiHardwareWarning.newValue) {
    const val = changes.aiHardwareWarning.newValue;
    if (isCurrentAiWarning(val)) {
      showAiSlowModal(val.liveP95Ms || val.benchmarkMs, val.deviceLabel);
    } else if (val?.active === false || val?.reason === "recovered") {
      hideAiSlowModal();
    }
  }
});

function isCurrentAiWarning(value) {
  if (!value || value.active !== true) return false;
  if (!Number.isFinite(value.timestamp)) return false;
  if (Date.now() - value.timestamp > AI_WARNING_MAX_AGE_MS) return false;
  return value.reason !== "recovered";
}

function hideAiSlowModal() {
  $("#ai-slow-overlay")?.classList.remove("active");
}

function showAiSlowModal(benchmarkMs, deviceLabel) {
  const overlay = $("#ai-slow-overlay");
  if (!overlay) return;
  const txtDevice = $("#txt-ai-slow-device");
  const txtMs = $("#txt-ai-slow-ms");
  if (txtDevice) txtDevice.textContent = deviceLabel || "GPU";
  if (txtMs) txtMs.textContent = `${benchmarkMs}ms / chunk`;
  overlay.classList.add("active");
}

async function maybeShowAiVocalInfoModal() {
  if (maybeShowAiVocalInfoModal.hasShown) return;
  const data = await chrome.storage.local.get(AI_VOCAL_INFO_SEEN_KEY);
  if (data[AI_VOCAL_INFO_SEEN_KEY]) {
    maybeShowAiVocalInfoModal.hasShown = true;
    return;
  }

  const overlay = $("#ai-vocal-info-overlay");
  if (!overlay) return;
  maybeShowAiVocalInfoModal.hasShown = true;
  chrome.storage.local.set({ [AI_VOCAL_INFO_SEEN_KEY]: true }).catch(() => {});

  const close = () => overlay.classList.remove("active");
  $("#btn-close-ai-vocal-info")?.addEventListener("click", close, { once: true });
  $("#btn-confirm-ai-vocal-info")?.addEventListener("click", close, { once: true });
  overlay.classList.add("active");
}

function updateVocalUI(mode) {
  currentVocalMode = mode || "bypass";
  const btnBypass = $("#btn-vocal-bypass");
  const btnKaraoke = $("#btn-vocal-karaoke");
  const btnAcapella = $("#btn-vocal-acapella");

  if (!btnBypass || !btnKaraoke || !btnAcapella) return;

  [btnBypass, btnKaraoke, btnAcapella].forEach((btn) => {
    btn.classList.remove("pressed");
    btn.classList.add("text-black", "font-bold");
  });

  if (currentVocalMode === "karaoke") {
    btnKaraoke.classList.add("pressed");
    updateVocalRuntimeStatus("KARAOKE");
  } else if (currentVocalMode === "acapella") {
    btnAcapella.classList.add("pressed");
    updateVocalRuntimeStatus("ACAPELLA");
  } else {
    btnBypass.classList.add("pressed");
    updateVocalRuntimeStatus("ORIGINAL");
  }

  updateVocalMasterUI();
}

function updateVocalMasterUI() {
  const btnToggle = $("#btn-toggle-vocal");
  const vocalArea = $("#vocal-controls-area");

  if (btnToggle) {
    if (isVocalOn) {
      btnToggle.textContent = "ON";
      btnToggle.classList.add("pressed", "text-white");
      btnToggle.classList.remove("text-gray-500");
    } else {
      btnToggle.textContent = "OFF";
      btnToggle.classList.remove("pressed", "text-white");
      btnToggle.classList.add("text-gray-500");
    }
  }

  if (vocalArea) {
    if (!isVocalOn) {
      vocalArea.style.opacity = "0.4";
      vocalArea.style.filter = "grayscale(100%)";
      vocalArea.style.pointerEvents = "none";
    } else {
      vocalArea.style.opacity = "1";
      vocalArea.style.filter = "none";
      vocalArea.style.pointerEvents = "auto";
    }
  }

}

function updateVocalProfileUI(profile) {
  // Profile controls are intentionally hidden. Detail is the only profile
  // selected by the popup.
  const selected = "ai_remove";
  currentVocalProfile = selected;
  $$(".btn-vocal-profile").forEach((btn) => {
    if (btn.dataset.profile === selected) {
      btn.classList.add("pressed");
    } else {
      btn.classList.remove("pressed");
    }
  });
}

function updateAiPowerModeUI(mode = aiPowerMode) {
  // The power-mode selector is intentionally hidden. Keep ECO as the only
  // production value even when an older popup/session sends another value.
  aiPowerMode = "eco";
  const isEco = aiPowerMode === "eco";
  const ecoButton = $("#btn-ai-mode-eco");
  const fullButton = $("#btn-ai-mode-full");
  [ecoButton, fullButton].forEach((button) => {
    if (!button) return;
    const active = (button === ecoButton) === isEco;
    button.classList.toggle("pressed", active);
    button.classList.toggle("ai-mode-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function selectAiPowerMode(mode) {
  const nextMode = "eco";
  aiPowerMode = nextMode;
  sessionManager.setSetting({ aiPowerMode: nextMode });
  sendParam("aiPowerMode", nextMode);
  updateAiPowerModeUI(nextMode);
  notifyAction("aiPowerMode", nextMode, { immediate: true });
}

function updateVocalRuntimeStatus(status) {
  const runtimeText = $("#txt-vocal-runtime");
  if (status !== undefined && status !== null && String(status).trim()) {
    currentVocalStatus = String(status).trim();
  }
  if (runtimeText) {
    runtimeText.textContent = currentVocalStatus || "ORIGINAL";
    runtimeText.title = `AI Vocal operation: ${currentVocalStatus || "ORIGINAL"}`;
  }
}

function updateVocalRuntimeUI(engine = aiEngineType, device, api, rawDevice) {
  const runtimeText = $("#txt-vocal-runtime");
  const runtimeDot = $("#vocal-runtime-dot");
  const deviceText = $("#txt-vocal-device");
  const apiText = $("#txt-vocal-api");
  const runtimePanel = $("#vocal-runtime-status");
  const normalizedEngine = GO_ENGINE_ENABLED && engine === ENGINE_TYPE ? ENGINE_TYPE : "webgl";

  if (device !== undefined && device !== null && String(device).trim()) {
    currentVocalDevice = String(device).trim();
  } else if (normalizedEngine === ENGINE_TYPE) {
    currentVocalDevice = ENGINE_DISPLAY_NAME;
  } else if (!currentVocalDevice) {
    currentVocalDevice = "Detecting GPU...";
  }
  if (rawDevice !== undefined && rawDevice !== null && String(rawDevice).trim()) {
    currentVocalDeviceRaw = String(rawDevice).trim();
  } else if (!currentVocalDeviceRaw || normalizedEngine === ENGINE_TYPE) {
    currentVocalDeviceRaw = currentVocalDevice;
  }
  if (api !== undefined && api !== null && String(api).trim()) {
    currentVocalApi = String(api).trim().toUpperCase();
  } else if (normalizedEngine === ENGINE_TYPE) {
    currentVocalApi = ENGINE_API;
  } else if (!currentVocalApi) {
    currentVocalApi = "WEBGL";
  }

  const deviceLabel = currentVocalDevice || (normalizedEngine === ENGINE_TYPE ? ENGINE_DISPLAY_NAME : "Detecting GPU...");
  const visibleDevice = deviceLabel.replace(/\s*\(DirectML\s+Device\s+#\d+\)\s*$/i, "").trim();
  const apiLabel = currentVocalApi || (normalizedEngine === ENGINE_TYPE ? ENGINE_API : "WEBGL");
  const fullHardware = currentVocalDeviceRaw || deviceLabel;
  const isCpu = /cpu|swiftshader|software|loopback/i.test(deviceLabel);
  const isOffline = /offline|unavailable|lost|error/i.test(deviceLabel);
  if (runtimeText) {
    runtimeText.textContent = currentVocalStatus || "ORIGINAL";
    runtimeText.title = `AI Vocal operation: ${currentVocalStatus || "ORIGINAL"}`;
  }
  if (runtimeDot) {
    runtimeDot.className = `ph-fill ph-circle text-[4px] ${isOffline ? "text-red-500" : (isCpu ? "text-amber-400" : "text-emerald-400")}`;
  }
  if (deviceText) {
    deviceText.textContent = `HW: ${visibleDevice}`;
    deviceText.title = `Hardware Device: ${fullHardware}`;
  }
  if (apiText) {
    apiText.textContent = `API: ${apiLabel}`;
    apiText.title = `AI API: ${apiLabel}`;
  }
  if (runtimePanel) {
    runtimePanel.title = `Hardware Device: ${fullHardware}; API: ${apiLabel}`;
  }
}

function updateUIFromExternal(key, value, index) {
  if (key === "volume") {
    updateSlider(
      "#main-vol",
      "#txt-vol",
      value,
      (v) => Math.round(v * 100) + "%"
    );
  } else if (key === "pan") {
    updateSlider("#main-pan", "#txt-pan", value, (v) =>
      v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C"
    );
  } else if (key === "pitch") {
    updateSlider(
      "#main-pitch",
      "#txt-pitch",
      value,
      (v) => (v > 0 ? "+" : "") + v
    );
  } else if (key === "reverb") {
    updateSlider("#main-verb", "#txt-verb", value, (v) =>
      parseFloat(v).toFixed(1)
    );
  } else if (key === "eq" && index !== null) {
    currentEqValues[index] = value;
    const slider = document.querySelector(`.eq-slider[data-idx="${index}"]`);
    if (slider) slider.value = value;
    updateEQVisuals();
  } else if (key === "eqPreset") {
    $("#eq-preset").value = value;
  } else if (key === "isEqOn") {
    isEqOn = value;
    updateEqToggleButton();
  } else if (key === "videoDelay") {
    $("#video-delay").value = value;
    $("#num-video-delay").value = parseFloat(value).toFixed(2);
  } else if (key === "videoZoom") {
    $("#video-zoom").value = value;
    $("#txt-zoom").textContent = Math.round(value * 100) + "%";
  } else if (key === "videoRotate") {
    $("#video-rotate").value = value;
    $("#txt-rotate").textContent = value + "°";
  } else if (key === "videoPosX") {
    // [NEW] Update UI from Remote
    $("#video-pos-x").value = value;
    syncVideoTransform();
  } else if (key === "videoPosY") {
    // [NEW] Update UI from Remote
    $("#video-pos-y").value = value;
    syncVideoTransform();
  } else if (key === "videoQuality") {
    const el = $("#video-quality");
    if (el) el.value = value;
  } else if (key === "isVideoMasterOn") {
    isVideoMasterOn = value;
    updateMasterTogglesUI();
  } else if (key === "normalize") {
    isNormalizeOn = value;
    updateNormalizeButton();
  } else if (key === "isVocalOn") {
    isVocalOn = value;
    updateVocalMasterUI();
  } else if (key === "vocalMode") {
    updateVocalUI(value);
  } else if (key === "vocalProfile") {
    updateVocalProfileUI(value);
  } else if (key === "aiPowerMode") {
    aiPowerMode = normalizeAiPowerMode(value);
    updateAiPowerModeUI(aiPowerMode);
  } else if (key === "aiEngineType") {
    aiEngineType = GO_ENGINE_ENABLED && value === ENGINE_TYPE ? ENGINE_TYPE : "webgl";
    updateAiEngineUI();
  }
}

function updateAiEngineUI() {
  const btnToggle = $("#btn-engine-toggle");
  const selEngine = $("#sel-ai-engine");
  const isGo = GO_ENGINE_ENABLED && aiEngineType === ENGINE_TYPE;

  if (btnToggle) {
    if (isGo) {
      btnToggle.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mr-0.5"></span>GO`;
      btnToggle.className = "win-btn h-3 px-1 text-[7px] font-bold text-cyan-300 border border-cyan-500 cursor-pointer flex items-center";
      btnToggle.title = "Go Turbo Engine Active (Click to open Go Manager)";
    } else {
      btnToggle.innerHTML = `WEB`;
      btnToggle.className = "win-btn h-3 px-1 text-[7px] font-bold text-gray-400 cursor-pointer";
      btnToggle.title = "Browser WebGL Engine (Click to open Go Manager)";
    }
  }
  if (selEngine) {
    selEngine.value = aiEngineType;
  }
  currentVocalDevice = isGo ? ENGINE_DISPLAY_NAME : "Detecting GPU...";
  currentVocalDeviceRaw = currentVocalDevice;
  currentVocalApi = isGo ? ENGINE_API : "WEBGL";
  updateVocalRuntimeUI(aiEngineType);
}

async function checkGoEngineHealth() {
  const dot = $("#go-dot-indicator");
  const txtStatus = $("#go-status-text");
  const txtDevice = $("#txt-go-device");
  const txtPing = $("#txt-go-ping");
  const btnSwitch = $("#btn-go-switch-mode");

  try {
    const t0 = performance.now();
    if (!ENGINE_HEALTH_URL) return { ok: false, disabled: true };
    const res = await fetch(ENGINE_HEALTH_URL, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const pingMs = Math.round((performance.now() - t0) * 10) / 10;

      if (dot) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block";
      }
      if (txtStatus) {
        txtStatus.className = "text-[9px] font-bold font-pixel text-emerald-400";
        txtStatus.textContent = "ONLINE (Connected to Go Core)";
      }
      if (txtDevice) txtDevice.textContent = data.engine || ENGINE_DISPLAY_NAME;
      if (txtPing) txtPing.textContent = `${pingMs} ms`;
      if (btnSwitch) {
        btnSwitch.textContent = (aiEngineType === ENGINE_TYPE) ? ENGINE_SWITCH_TO_BROWSER_LABEL : ENGINE_ACTIVATE_LABEL;
      }
      return { ok: true, pingMs };
    }
  } catch (_) {}

  if (dot) {
    dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 inline-block";
  }
  if (txtStatus) {
    txtStatus.className = "text-[9px] font-bold font-pixel text-red-400";
    txtStatus.textContent = "OFFLINE (Not Running)";
  }
  if (txtPing) txtPing.textContent = "Offline";
  if (btnSwitch) {
    btnSwitch.textContent = (aiEngineType === ENGINE_TYPE) ? ENGINE_SWITCH_TO_BROWSER_LABEL : ENGINE_ACTIVATE_LABEL;
  }
  return { ok: false };
}
function sendParam(key, value, index = null) {
  const isShared = sessionManager.sessionMode === "shared";
  chrome.runtime
    .sendMessage({
      type: "SET_PARAM",
      key,
      value,
      index,
      tabId: currentTabId,
      isShared: isShared,
    })
    .catch(() => {});
  if (isShared) {
    if (key === "eq" && index !== null) {
      currentEqValues[index] = value;
      chrome.storage.local.set({ eq: currentEqValues });
    } else {
      chrome.storage.local.set({ [key]: value });
    }
  }
}

async function toggleRecording() {
  if (!isRecording) {
    const success = await sendMessageWithRetry({
      type: "START_RECORDING",
      tabId: currentTabId,
    });
    if (success) {
      syncRecordingUI(true);
    } else {
      // Recover from a stale popup state (for example, the popup was closed
      // while recording). If the offscreen recorder is still active, switch
      // this popup to STOP instead of issuing more START requests.
      const state = await sendMessageWithRetry({
        type: "GET_STATE",
        tabId: currentTabId,
      });
      if (state?.isRecording === true) syncRecordingUI(true);
    }
  } else {
    syncRecordingUI(false);
    await sendMessageWithRetry({
      type: "STOP_RECORDING",
      tabId: currentTabId,
    });
  }
}

function syncRecordingUI(active) {
  isRecording = Boolean(active);
  settingsModal?.updateRecordStatus(isRecording);

  const btnRecTop = $("#btn-rec-top");
  const recIndicator = $("#rec-indicator");
  if (btnRecTop) {
    btnRecTop.textContent = isRecording ? "STOP" : "REC";
    btnRecTop.classList.toggle("bg-red-600", isRecording);
    btnRecTop.classList.toggle("text-white", isRecording);
    btnRecTop.classList.toggle("text-red-900", !isRecording);
    btnRecTop.setAttribute("aria-label", isRecording ? "Stop recording" : "Start recording");
  }
  if (recIndicator) recIndicator.classList.toggle("hidden", !isRecording);
}

async function handleRecordingSaved() {
  syncRecordingUI(false);
  await settingsModal.renderRecordingList();
  settingsModal.showRecordingSaved();
}

function setupListeners() {
  $("#btn-toggle-audio").addEventListener("click", () => {
    isAudioMasterOn = !isAudioMasterOn;
    updateMasterTogglesUI();
    sessionManager.setSetting({ isAudioMasterOn });

    if (isAudioMasterOn) {
      initCapture(sessionManager.sessionMode);
    } else {
      captureRequestId++;
      if (currentTabId) {
        sendMessageWithRetry({ type: "STOP_CAPTURE", tabId: currentTabId });

        chrome.runtime.sendMessage({
          type: "BG_RESET_DELAY",
          tabId: currentTabId,
        });
      }
    }
    notifyAction("isAudioMasterOn", isAudioMasterOn, { immediate: true });
    updateEQVisuals();
  });

  $("#btn-toggle-video").addEventListener("click", () => {
    isVideoMasterOn = !isVideoMasterOn;
    updateMasterTogglesUI();
    sessionManager.setSetting({ isVideoMasterOn });
    sendParam("isVideoMasterOn", isVideoMasterOn);
    notifyAction("isVideoMasterOn", isVideoMasterOn, { immediate: true });
    if (isVideoMasterOn) {
      syncVideoTransform();
      const d = parseFloat($("#video-delay").value);
      if (currentTabId)
        chrome.tabs
          .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: d })
          .catch(() => {});
    } else {
      if (currentTabId) {
        chrome.tabs
          .sendMessage(currentTabId, {
            type: "SET_VIDEO_ZOOM",
            scale: 1,
            rotate: 0,
            translateX: 0, // [NEW] Reset X
            translateY: 0, // [NEW] Reset Y
          })
          .catch(() => {});
        chrome.tabs
          .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: 0 })
          .catch(() => {});
      }
    }
  });

  $("#btn-open-player").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_PLAYER_TAB",
      sourceTabId: currentTabId,
    });
  });

  $("#btn-eq-toggle").addEventListener("click", () => {
    if (!isAudioMasterOn) return;
    isEqOn = !isEqOn;
    sessionManager.setSetting({ isEqOn });
    updateEqToggleButton();
    sendParam("isEqOn", isEqOn);
    notifyAction("isEqOn", isEqOn, { immediate: true });
    updateEQVisuals();
  });

  $("#main-vol").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseFloat(e.target.value);
    $("#txt-vol").textContent = Math.round(v * 100) + "%";
    sendParam("volume", v);
  });
  $("#main-pan").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseFloat(e.target.value);
    $("#txt-pan").textContent =
      v > 0 ? "R " + v : v < 0 ? "L " + Math.abs(v) : "C";
    sendParam("pan", v);
  });
  $("#main-pitch").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseInt(e.target.value);
    $("#txt-pitch").textContent = (v > 0 ? "+" : "") + v;
    sendParam("pitch", v);
    notifyAction("pitch", v);
  });
  $("#main-verb").addEventListener("input", (e) => {
    if (!isAudioMasterOn) return;
    const v = parseFloat(e.target.value);
    $("#txt-verb").textContent = v.toFixed(1);
    sendParam("reverb", v);
    notifyAction("reverb", v);
  });

  $("#btn-normalize")?.addEventListener("click", () => {
    isNormalizeOn = !isNormalizeOn;
    updateNormalizeButton();
    sendParam("normalize", isNormalizeOn);
    notifyAction("normalize", isNormalizeOn, { immediate: true });
  });

  // --- AI VOCAL SEPARATOR CONTROLS ---
  $("#btn-toggle-vocal")?.addEventListener("click", () => {
    isVocalOn = !isVocalOn;
    updateVocalMasterUI();
    sessionManager.setSetting({ isVocalOn });
    sendParam("isVocalOn", isVocalOn);
    notifyAction("isVocalOn", isVocalOn, { immediate: true });
    if (isVocalOn) maybeShowAiVocalInfoModal().catch(() => {});
  });
  $("#btn-vocal-bypass")?.addEventListener("click", () => {
    sendParam("vocalMode", "bypass");
    updateVocalUI("bypass");
    notifyAction("vocalMode", "bypass", { immediate: true });
  });
  $("#btn-vocal-karaoke")?.addEventListener("click", () => {
    chrome.storage.local.get("aiHardwareWarning").then((res) => {
      if (isCurrentAiWarning(res?.aiHardwareWarning)) {
        const warning = res.aiHardwareWarning;
        showAiSlowModal(warning.liveP95Ms || warning.benchmarkMs, warning.deviceLabel);
      }
    }).catch(() => {});
    sendParam("vocalMode", "karaoke");
    updateVocalUI("karaoke");
    notifyAction("vocalMode", "karaoke", { immediate: true });
  });
  $("#btn-vocal-acapella")?.addEventListener("click", () => {
    chrome.storage.local.get("aiHardwareWarning").then((res) => {
      if (isCurrentAiWarning(res?.aiHardwareWarning)) {
        const warning = res.aiHardwareWarning;
        showAiSlowModal(warning.liveP95Ms || warning.benchmarkMs, warning.deviceLabel);
      }
    }).catch(() => {});
    sendParam("vocalMode", "acapella");
    updateVocalUI("acapella");
    notifyAction("vocalMode", "acapella", { immediate: true });
  });
  $$(".btn-vocal-profile").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const profile = e.currentTarget.dataset.profile === "balanced"
        ? "balanced"
        : "ai_remove";
      currentVocalProfile = profile;
      sessionManager.setSetting({ vocalProfile: profile });
      sendParam("vocalProfile", profile);
      updateVocalProfileUI(profile);
      notifyAction("vocalProfile", profile, { immediate: true });
    });
  });
  $("#btn-ai-mode-eco")?.addEventListener("click", () => selectAiPowerMode("eco"));
  $("#btn-ai-mode-full")?.addEventListener("click", () => selectAiPowerMode("quality"));

  // AI Engine Switcher & Modal
  $("#btn-engine-toggle")?.addEventListener("click", () => {
    $("#go-engine-overlay")?.classList.add("active");
    checkGoEngineHealth();
  });

  $("#sel-ai-engine")?.addEventListener("change", (e) => {
    aiEngineType = e.target.value;
    updateAiEngineUI();
    sessionManager.setSetting({ aiEngineType });
    sendParam("aiEngineType", aiEngineType);
    notifyAction("aiEngineType", aiEngineType, { immediate: true });
  });

  $("#btn-go-modal-close")?.addEventListener("click", () => {
    $("#go-engine-overlay")?.classList.remove("active");
  });

  $("#btn-go-test-ping")?.addEventListener("click", async () => {
    const btn = $("#btn-go-test-ping");
    if (btn) btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-[10px]"></i> <span>Pinging...</span>`;
    const res = await checkGoEngineHealth();
    if (btn) {
      btn.innerHTML = res.ok
        ? `<i class="ph-bold ph-check text-emerald-400 text-[10px]"></i> <span class="text-emerald-300">ONLINE (${res.pingMs}ms)</span>`
        : `<i class="ph-bold ph-x text-red-400 text-[10px]"></i> <span class="text-red-400">OFFLINE - OPEN APP FIRST</span>`;
      setTimeout(() => {
        btn.innerHTML = `<i class="ph-bold ph-arrows-clockwise text-[10px]"></i> <span>TEST / RE-CHECK CONNECTION</span>`;
      }, 2500);
    }
  });

  $("#btn-go-switch-mode")?.addEventListener("click", () => {
    aiEngineType = (aiEngineType === ENGINE_TYPE) ? "webgl" : ENGINE_TYPE;
    updateAiEngineUI();
    sessionManager.setSetting({ aiEngineType });
    sendParam("aiEngineType", aiEngineType);
    checkGoEngineHealth();
  });

  // AI Slow Hardware Modal buttons
  $("#btn-ai-slow-close")?.addEventListener("click", () => {
    $("#ai-slow-overlay")?.classList.remove("active");
  });
  $("#btn-ai-slow-continue")?.addEventListener("click", () => {
    $("#ai-slow-overlay")?.classList.remove("active");
  });
  $("#btn-ai-slow-bypass")?.addEventListener("click", () => {
    $("#ai-slow-overlay")?.classList.remove("active");
    currentVocalMode = "bypass";
    sendParam("vocalMode", "bypass");
    updateVocalUI("bypass");
  });


  $("#eq-preset").addEventListener("change", (e) => {
    if (!isAudioMasterOn) return;
    const presetName = e.target.value;
    const values = PRESETS[presetName] || PRESETS.flat;

    currentEqValues = [...values];
    $$(".eq-slider").forEach((inp, i) => {
      inp.value = values[i];
      sendParam("eq", values[i], i);
    });

    sendParam("eqPreset", presetName);
    updateEQVisuals();
  });

  $("#btn-reset").addEventListener("click", handleReset);

  $("#btn-close").addEventListener("click", async () => {
    captureRequestId++;
    if (currentTabId) {
      try {
        await sendMessageWithRetry({
          type: "STOP_CAPTURE",
          tabId: currentTabId,
        });
        chrome.runtime.sendMessage({
          type: "BG_RESET_DELAY",
          tabId: currentTabId,
        });
      } catch (e) {}
    }
    window.close();
  });

  $("#visualizer").parentElement.addEventListener("click", () => {
    visualMode = (visualMode + 1) % 3;
    sendParam("visualMode", visualMode);
  });

  const syncDelay = (val) => {
    if (!isVideoMasterOn) return;
    let v = parseFloat(val);
    if (isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 9.99) v = 9.99;
    $("#video-delay").value = v;
    $("#num-video-delay").value = v.toFixed(2);
    sessionManager.setSetting({ videoDelay: v });
    sendParam("videoDelay", v);
    if (currentTabId)
      chrome.tabs
        .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: v })
        .catch(() => {});
    notifyAction("videoDelay", v);
  };
  $("#video-delay").addEventListener("input", (e) => syncDelay(e.target.value));
  $("#num-video-delay").addEventListener("change", (e) =>
    syncDelay(e.target.value)
  );
  $("#btn-delay-minus").addEventListener("click", () => {
    if (!isVideoMasterOn) return;
    syncDelay(parseFloat($("#num-video-delay").value) - 0.1);
  });
  $("#btn-delay-plus").addEventListener("click", () => {
    if (!isVideoMasterOn) return;
    syncDelay(parseFloat($("#num-video-delay").value) + 0.1);
  });
  $("#video-quality")?.addEventListener("change", (e) => {
    const val = e.target.value;
    sendParam("videoQuality", val);
    notifyAction("videoQuality", val, { immediate: true });
    if (currentTabId)
      chrome.tabs
        .sendMessage(currentTabId, { type: "SET_VIDEO_QUALITY", value: val })
        .catch(() => {});
  });

  const handleTransform = () => {
    if (isVideoMasterOn) {
      syncVideoTransform();
      notifyAction("videoTransform", null);
    }
  };
  $("#video-zoom").addEventListener("input", handleTransform);
  $("#video-rotate").addEventListener("input", handleTransform);

  // [NEW] Add Listeners for Position
  $("#video-pos-x").addEventListener("input", (e) => {
    if (isVideoMasterOn) {
      syncVideoTransform();
      sendParam("videoPosX", parseFloat(e.target.value));
      notifyAction("videoPosition", null);
    }
  });
  $("#video-pos-y").addEventListener("input", (e) => {
    if (isVideoMasterOn) {
      syncVideoTransform();
      sendParam("videoPosY", parseFloat(e.target.value));
      notifyAction("videoPosition", null);
    }
  });

  // [NEW] Reset Position Button
  $("#btn-pos-reset").addEventListener("click", () => {
    $("#video-pos-x").value = 0;
    $("#video-pos-y").value = 0;
    handleTransform();
    sendParam("videoPosX", 0);
    sendParam("videoPosY", 0);
    notifyAction("videoPosition", null, { immediate: true });
  });

  $("#btn-zoom-fit").addEventListener("click", () => {
    $("#video-zoom").value = 1.0;
    handleTransform();
    sendParam("videoZoom", 1.0);
  });
  $("#btn-zoom-ultra").addEventListener("click", () => {
    $("#video-zoom").value = 1.34;
    handleTransform();
    sendParam("videoZoom", 1.34);
  });
  $("#btn-zoom-fill").addEventListener("click", () => {
    $("#video-zoom").value = 1.5;
    handleTransform();
    sendParam("videoZoom", 1.5);
  });
  $("#btn-rotate-0").addEventListener("click", () => {
    $("#video-rotate").value = 0;
    handleTransform();
    sendParam("videoRotate", 0);
  });
  $("#btn-rotate-90").addEventListener("click", () => {
    let n = parseFloat($("#video-rotate").value) + 90;
    if (n >= 360) n = 0;
    $("#video-rotate").value = n;
    handleTransform();
    sendParam("videoRotate", n);
  });

  $("#btn-rec-top").onclick = toggleRecording;

  const openCoffeeDonation = () => {
    chrome.tabs.create({ url: DONATION_URL });
  };
  const buyCoffeeBtn = $("#btn-buy-coffee");
  if (buyCoffeeBtn) buyCoffeeBtn.addEventListener("click", openCoffeeDonation);
  const donateAboutBtn = $("#btn-donate-about");
  if (donateAboutBtn) donateAboutBtn.addEventListener("click", openCoffeeDonation);
}

function updateEqToggleButton() {
  const btn = $("#btn-eq-toggle");
  const span = $("#btn-eq-toggle span:last-child");
  const eqContainer = $("#eq-container");

  if (isEqOn && isAudioMasterOn) {
    span.textContent = "ON";
    span.classList.add("text-white");
    btn.classList.add("pressed");
    eqContainer.classList.remove("eq-off");
  } else {
    span.textContent = "OFF";
    span.classList.remove("text-white");
    btn.classList.remove("pressed");
    eqContainer.classList.add("eq-off");
  }
}

function updateMasterTogglesUI() {
  const btnAudio = $("#btn-toggle-audio");
  const audioArea = $("#audio-controls-area");
  const eqArea = $("#eq-controls-area");
  const eqContainer = $("#eq-container");

  if (isAudioMasterOn) {
    btnAudio.textContent = "ON";
    btnAudio.classList.add("pressed", "text-white");
    btnAudio.classList.remove("text-gray-500");
    audioArea.style.opacity = "1";
    audioArea.style.pointerEvents = "auto";
    eqArea.style.opacity = "1";
    eqArea.style.pointerEvents = "auto";
    updateEqToggleButton();
  } else {
    btnAudio.textContent = "OFF";
    btnAudio.classList.remove("pressed", "text-white");
    btnAudio.classList.add("text-gray-500");
    audioArea.style.opacity = "0.4";
    audioArea.style.pointerEvents = "none";
    eqArea.style.opacity = "0.4";
    eqArea.style.pointerEvents = "none";
    eqContainer.classList.add("eq-off");
    const btn = $("#btn-eq-toggle");
    const span = $("#btn-eq-toggle span:last-child");
    span.textContent = "OFF";
    span.classList.remove("text-white");
    btn.classList.remove("pressed");
  }
  drawEQGraph(currentEqValues);

  const btnVideo = $("#btn-toggle-video");
  const videoArea = $("#video-controls-area");
  if (isVideoMasterOn) {
    btnVideo.textContent = "ON";
    btnVideo.classList.add("pressed", "text-white");
    btnVideo.classList.remove("text-gray-500");
    videoArea.style.opacity = "1";
    videoArea.style.pointerEvents = "auto";
  } else {
    btnVideo.textContent = "OFF";
    btnVideo.classList.remove("pressed", "text-white");
    btnVideo.classList.add("text-gray-500");
    videoArea.style.opacity = "0.4";
    videoArea.style.pointerEvents = "none";
  }

  const vocalBlock = $("#block-vocal");
  if (isAudioMasterOn) {
    if (vocalBlock) vocalBlock.style.pointerEvents = "auto";
    updateVocalUI(currentVocalMode);
  } else {
    if (vocalBlock) {
      vocalBlock.style.opacity = "0.4";
      vocalBlock.style.pointerEvents = "none";
    }
  }
}

function syncVideoTransform() {
  let zoomVal = parseFloat($("#video-zoom").value);
  let rotateVal = parseFloat($("#video-rotate").value);

  // [NEW] Get Position Values
  let posX = parseFloat($("#video-pos-x").value);
  let posY = parseFloat($("#video-pos-y").value);

  $("#txt-zoom").textContent = Math.round(zoomVal * 100) + "%";
  $("#txt-rotate").textContent = rotateVal + "°";
  // [NEW] Update Pos Text
  $("#txt-pos").textContent = `${posX},${posY}`;

  // [NEW] Save Params
  sessionManager.setSetting({
    videoZoom: zoomVal,
    videoRotate: rotateVal,
    videoPosX: posX,
    videoPosY: posY,
  });
  sendParam("videoZoom", zoomVal);
  sendParam("videoRotate", rotateVal);
  sendParam("videoPosX", posX);
  sendParam("videoPosY", posY);

  if (currentTabId)
    chrome.tabs
      .sendMessage(currentTabId, {
        type: "SET_VIDEO_ZOOM",
        scale: zoomVal,
        translateX: posX, // [NEW] Send X
        translateY: posY, // [NEW] Send Y
        rotate: rotateVal,
      })
      .catch(() => {});
}

async function handleReset() {
  $("#main-pitch").value = 0;
  $("#txt-pitch").textContent = "0";
  $("#main-verb").value = 0;
  $("#txt-verb").textContent = "0.0";
  $("#main-pan").value = 0;
  $("#txt-pan").textContent = "C";
  $("#main-vol").value = 1;
  $("#txt-vol").textContent = "100%";
  isNormalizeOn = false;
  updateNormalizeButton();
  sendParam("reset", true);

  currentEqValues = PRESETS.flat.map(() => 0);
  $$(".eq-slider").forEach((i) => (i.value = 0));
  $("#eq-preset").value = "flat";
  sendParam("eqPreset", "flat");

  isEqOn = true;
  updateEqToggleButton();
  sendParam("isEqOn", true);
  updateEQVisuals();

  $("#video-delay").value = 0;
  $("#num-video-delay").value = "0.00";
  $("#video-zoom").value = 1;
  $("#txt-zoom").textContent = "100%";
  $("#video-rotate").value = 0;
  $("#txt-rotate").textContent = "0°";

  // [NEW] Reset Position UI
  $("#video-pos-x").value = 0;
  $("#video-pos-y").value = 0;
  $("#txt-pos").textContent = "0,0";

  sessionManager.setSetting({
    videoZoom: 1,
    videoRotate: 0,
    videoPosX: 0,
    videoPosY: 0,
  });

  if (currentTabId) {
    chrome.tabs
      .sendMessage(currentTabId, { type: "SET_VIDEO_DELAY", value: 0 })
      .catch(() => {});
    chrome.tabs
      .sendMessage(currentTabId, {
        type: "SET_VIDEO_ZOOM",
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotate: 0,
      })
      .catch(() => {});
  }
}

// ... (Rest of functions like updateNormalizeButton, renderNewEQSystem, etc. remain unchanged) ...
function updateNormalizeButton() {
  const btn = $("#btn-normalize");
  const indicator = $("#norm-indicator");
  if (!btn || !indicator) return;
  if (isNormalizeOn) {
    btn.className =
      "win-btn w-full h-full border text-[7px] font-bold flex items-center justify-center gap-0.5 border-[#00ff00] text-[#00ff00] bg-black";
    indicator.className =
      "w-1 h-1 rounded-full bg-[#00ff00] shadow-[0_0_5px_#00ff00]";
  } else {
    btn.className =
      "win-btn w-full h-full border text-[7px] font-bold flex items-center justify-center gap-0.5 border-gray-500 text-gray-300 bg-gray-700";
    indicator.className = "w-1 h-1 rounded-full bg-gray-400";
  }
}

function renderNewEQSystem() {
  const container = $("#eq-container");
  container.innerHTML = "";
  FREQUENCIES.forEach((f, i) => {
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = `<div class="eq-bar-wrapper"><div class="eq-bar-mask" id="mask-visual-${i}"></div><div class="eq-thumb" id="thumb-visual-${i}" style="bottom: 50%"></div></div><div class="eq-label">${LABELS[i]}</div><input type="range" class="v-input eq-slider" min="-12" max="12" step="1" value="0" data-idx="${i}">`;
    container.appendChild(col);
    const inp = col.querySelector("input");
    inp.oninput = (e) => {
      if (!isAudioMasterOn) return;
      const val = parseFloat(e.target.value);
      currentEqValues[i] = val;
      sendParam("eq", val, i);

      $("#eq-preset").value = "custom";
      sendParam("eqPreset", "custom");

      updateEQVisuals();
    };
    inp.ondblclick = () => {
      if (!isAudioMasterOn) return;
      inp.value = 0;
      currentEqValues[i] = 0;
      sendParam("eq", 0, i);
      updateEQVisuals();
    };
  });
}

function updateEQVisuals() {
  $$(".eq-slider").forEach((slider, idx) => {
    const val = parseFloat(slider.value);
    const percent = ((val + 12) / 24) * 100;
    const thumb = $(`#thumb-visual-${idx}`);
    if (thumb) thumb.style.bottom = `${percent}%`;
    const mask = $(`#mask-visual-${idx}`);
    if (mask) mask.style.height = `${100 - percent}%`;
  });
  drawEQGraph(currentEqValues);
}

function drawEQGraph(values) {
  const cvs = document.getElementById("eq-graph");
  if (!cvs) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = cvs.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  if (cvs.width !== rect.width * dpr || cvs.height !== rect.height * dpr) {
    cvs.width = rect.width * dpr;
    cvs.height = rect.height * dpr;
  }

  const ctx = cvs.getContext("2d");
  const drawW = rect.width;
  const drawH = rect.height;

  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, drawW, drawH);
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, drawW, drawH);

  ctx.strokeStyle = "#222";
  ctx.beginPath();
  ctx.moveTo(0, drawH / 2);
  ctx.lineTo(drawW, drawH / 2);
  ctx.stroke();

  const active = isAudioMasterOn && isEqOn;
  ctx.strokeStyle = active ? "#00ff00" : "#555";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = active ? 4 : 0;
  ctx.shadowColor = "rgba(0,255,0,0.4)";
  ctx.beginPath();

  const stepX = drawW / (values.length - 1);
  const drawVals = active ? values : values.map(() => 0);
  const points = drawVals.map((v, i) => ({
    x: i * stepX,
    y: drawH / 2 - (v / 14) * (drawH / 2 - 2),
  }));

  if (points.length > 0) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function loadAudioState(state) {
  const vol = state.volume ?? 1.0;
  const pan = state.pan ?? 0;
  const pitch = state.pitch ?? 0;
  const reverb = state.reverb ?? 0;
  $("#main-vol").value = vol;
  $("#txt-vol").textContent = Math.round(vol * 100) + "%";
  $("#main-pan").value = pan;
  $("#txt-pan").textContent =
    pan > 0 ? "R " + pan : pan < 0 ? "L " + Math.abs(pan) : "C";
  $("#main-pitch").value = pitch;
  $("#txt-pitch").textContent = (pitch > 0 ? "+" : "") + pitch;
  $("#main-verb").value = reverb;
  $("#txt-verb").textContent = parseFloat(reverb).toFixed(1);
  if (state.videoQuality) $("#video-quality").value = state.videoQuality;

  if (state.eqPreset) {
    $("#eq-preset").value = state.eqPreset;
  } else {
    $("#eq-preset").value = "flat";
  }

  settingsModal.setValues(state);
  if (state.currentSampleRate) {
    settingsModal.updateActiveSampleRate(state.currentSampleRate);
  }
  isNormalizeOn = state.normalize || false;
  updateNormalizeButton();
  if (state.isVocalOn !== undefined) {
    isVocalOn = state.isVocalOn;
  }
  if (state.vocalMode) {
    updateVocalUI(state.vocalMode);
  } else {
    updateVocalMasterUI();
  }
  updateVocalProfileUI("ai_remove");
  if (state.vocalProfile !== "ai_remove") {
    sendParam("vocalProfile", "ai_remove");
  }
  if (state.aiPowerMode !== "eco") {
    sendParam("aiPowerMode", "eco");
  }
  aiPowerMode = "eco";
  updateAiPowerModeUI(aiPowerMode);
  if (state.aiVocalDiagnostics) {
    updateVocalRuntimeUI(
      state.aiVocalDiagnostics.engine || aiEngineType,
      state.aiVocalDiagnostics.hardwareDevice || state.aiVocalDiagnostics.backend || "",
      state.aiVocalDiagnostics.api,
      state.aiVocalDiagnostics.hardwareDeviceRaw || state.aiVocalDiagnostics.backend || ""
    );
  } else {
    updateVocalRuntimeUI(aiEngineType);
  }
  updateVocalRuntimeStatus(state.vocalStatus || currentVocalStatus);

  if (state.eq && state.eq.length > 0) {
    currentEqValues = state.eq;
    $$(".eq-slider").forEach((inp, i) => (inp.value = currentEqValues[i] || 0));
  }
  if (state.isEqOn !== undefined) {
    isEqOn = state.isEqOn;
  }

  // [NEW] Load Position State from Remote/Background
  if (state.videoPosX !== undefined) $("#video-pos-x").value = state.videoPosX;
  if (state.videoPosY !== undefined) $("#video-pos-y").value = state.videoPosY;

  updateEqToggleButton();
  updateEQVisuals();

  // Trigger UI Update for Position
  syncVideoTransform();
}

let barPeaks = [];

function drawVisualizer(data, mode) {
  const cvs = $("#visualizer");
  if (!cvs) return;
  const ctx = cvs.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = cvs.clientWidth,
    h = cvs.clientHeight;
  if (!w || !h) return;

  if (cvs.width !== Math.floor(w * dpr) || cvs.height !== Math.floor(h * dpr)) {
    cvs.width = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Top limit margin so bars and waveforms never obscure the VISUALIZER label (with comfortable padding)
  const topMargin = 18;
  const maxBarH = Math.max(1, h - topMargin);

  // Draw subtle retro limit line
  ctx.save();
  ctx.strokeStyle = "rgba(255, 60, 60, 0.45)";
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, topMargin - 0.5);
  ctx.lineTo(w, topMargin - 0.5);
  ctx.stroke();
  ctx.restore();

  if (mode === 0) {
    // Mode 0: Spectrum Bars with vertical gradient (Green at bottom -> Yellow in middle -> Red at top)
    const gradient = ctx.createLinearGradient(0, h, 0, topMargin);
    gradient.addColorStop(0.0, "#00e640");  // Bottom: bright green
    gradient.addColorStop(0.55, "#38ef7d"); // Mid-low: lime green
    gradient.addColorStop(0.72, "#ffea00"); // Mid: rich yellow
    gradient.addColorStop(0.88, "#ff8800"); // Mid-high: amber orange
    gradient.addColorStop(1.0, "#ff2222");  // Top peak: red

    ctx.fillStyle = gradient;

    // Reduce bar count slightly (e.g. 20 bars instead of 32) for wider, punchier retro EQ look
    const numBars = Math.min(20, data.length);
    if (barPeaks.length !== numBars) {
      barPeaks = new Array(numBars).fill(0);
    }

    const barW = w / numBars;
    let x = 0;
    for (let i = 0; i < numBars; i++) {
      // Average frequency bins in this bar's range
      const start = Math.floor((i * data.length) / numBars);
      const end = Math.max(start + 1, Math.floor(((i + 1) * data.length) / numBars));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += data[j];
        count++;
      }
      const v = sum / count;
      const barH = (v / 255) * maxBarH;

      // Update peak hold decay
      if (!barPeaks[i] || barPeaks[i] < barH) {
        barPeaks[i] = barH;
      } else {
        barPeaks[i] = Math.max(0, barPeaks[i] - 0.7);
      }

      if (barH > 0) {
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 0.5, h - barH, Math.max(1, barW - 1.5), barH);
      }

      // Draw peak hold cap at the top of the bar
      if (barPeaks[i] > 1) {
        const peakY = h - barPeaks[i];
        const peakColor =
          peakY <= topMargin + 2
            ? "#ff3333"
            : peakY <= h - 0.65 * maxBarH
            ? "#ffea00"
            : "#00ff66";
        ctx.fillStyle = peakColor;
        ctx.fillRect(x + 0.5, peakY - 1, Math.max(1, barW - 1.5), 1);
      }

      x += barW;
    }
  } else if (mode === 1) {
    // Mode 1: Frequency Wave line with Green -> Yellow -> Red vertical gradient
    const gradient = ctx.createLinearGradient(0, h, 0, topMargin);
    gradient.addColorStop(0.0, "#00e640");
    gradient.addColorStop(0.65, "#ffea00");
    gradient.addColorStop(1.0, "#ff2222");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceW = w / data.length;
    let x = 0;
    data.forEach((v, i) => {
      const y = h - (v / 255) * maxBarH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.stroke();
  } else if (mode === 2) {
    // Mode 2: Oscilloscope Waveform centered within available safe height
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceW = w / data.length;
    let x = 0;
    const centerY = topMargin + maxBarH / 2;
    data.forEach((v, i) => {
      const offset = ((v - 128) / 128) * (maxBarH / 2);
      const y = centerY + offset;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.stroke();
  }
}
