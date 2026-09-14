let creating;
const videoContentScriptTasks = new Map();

// The toolbar action icon is the one place Chrome can show extension runtime
// status without injecting UI into a website. Draw the indicator on top of
// the packaged logo so the Store build keeps one reviewed icon asset.
const ACTION_ACTIVITY_STORAGE_KEY = "actionActivityByTab";
const ACTION_ICON_SIZES = [16, 32, 48, 128];
const actionActivityByTab = new Map();
const actionIconRevisions = new Map();
let actionIconBitmapPromise = null;

function getNumericTabId(tabId) {
  const numericTabId = Number(tabId);
  return Number.isInteger(numericTabId) && numericTabId >= 0
    ? numericTabId
    : null;
}

async function getActionIconBitmap() {
  if (!actionIconBitmapPromise) {
    actionIconBitmapPromise = fetch(chrome.runtime.getURL("assets/logo.png"))
      .then((response) => {
        if (!response.ok) throw new Error(`Icon request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => createImageBitmap(blob))
      .catch((error) => {
        actionIconBitmapPromise = null;
        throw error;
      });
  }
  return actionIconBitmapPromise;
}

function drawActionIcon(bitmap, indicatorColor, size) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.drawImage(bitmap, 0, 0, size, size);

  if (indicatorColor) {
    const radius = Math.max(2, size * 0.15);
    const center = size - radius - Math.max(1, size * 0.06);
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.fillStyle = indicatorColor;
    context.fill();
    context.lineWidth = Math.max(1, size * 0.06);
    context.strokeStyle = "#161616";
    context.stroke();
  }

  return context.getImageData(0, 0, size, size);
}

function getActionIndicatorColor(activity) {
  if (activity?.audio === true) return "#ff5a36";
  if (activity?.video === true) return "#4da6ff";
  return null;
}

function normalizeActionActivity(activity) {
  return {
    audio: activity?.audio === true,
    video: activity?.video === true,
  };
}

async function updateActionIcon(tabId, activity) {
  const numericTabId = getNumericTabId(tabId);
  if (numericTabId === null) return;
  const indicatorColor = getActionIndicatorColor(activity);

  const revision = (actionIconRevisions.get(numericTabId) || 0) + 1;
  actionIconRevisions.set(numericTabId, revision);

  try {
    if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") {
      // Chrome 116+ supports OffscreenCanvas. Keep a visible fallback for an
      // unusual embedded Chromium runtime instead of failing silently.
      await chrome.action.setBadgeText({
        tabId: numericTabId,
        text: indicatorColor ? "●" : "",
      });
      if (indicatorColor) {
        await chrome.action.setBadgeBackgroundColor({
          tabId: numericTabId,
          color: indicatorColor,
        });
      }
      return;
    }

    const bitmap = await getActionIconBitmap();
    if (actionIconRevisions.get(numericTabId) !== revision) return;

    const imageData = {};
    for (const size of ACTION_ICON_SIZES) {
      imageData[size] = drawActionIcon(bitmap, indicatorColor, size);
    }
    await chrome.action.setIcon({ tabId: numericTabId, imageData });
    await chrome.action.setBadgeText({ tabId: numericTabId, text: "" });
  } catch (error) {
    // Status decoration must never affect audio capture or popup startup.
    console.warn("NextSona: action status icon update failed", error);
  }
}

async function persistActionActivity() {
  const state = Object.fromEntries(actionActivityByTab);
  try {
    await chrome.storage.session.set({ [ACTION_ACTIVITY_STORAGE_KEY]: state });
  } catch (_) {
    // The icon still works for the current worker lifetime if session storage
    // is temporarily unavailable.
  }
}

async function setActionActivity(tabId, active) {
  const numericTabId = getNumericTabId(tabId);
  if (numericTabId === null) return;

  const activity = normalizeActionActivity(active);
  if (activity.audio || activity.video) actionActivityByTab.set(numericTabId, activity);
  else actionActivityByTab.delete(numericTabId);

  await Promise.all([
    persistActionActivity(),
    updateActionIcon(numericTabId, activity),
  ]);
}

async function setActionActivityChannel(tabId, channel, active) {
  const numericTabId = getNumericTabId(tabId);
  if (numericTabId === null || !["audio", "video"].includes(channel)) return;

  const current = normalizeActionActivity(await getActionActivity(numericTabId));
  current[channel] = active === true;
  await setActionActivity(numericTabId, current);
}

async function getActionActivity(tabId) {
  const numericTabId = getNumericTabId(tabId);
  if (numericTabId === null) return { audio: false, video: false };
  if (actionActivityByTab.has(numericTabId)) {
    return actionActivityByTab.get(numericTabId);
  }

  try {
    const stored = await chrome.storage.session.get(ACTION_ACTIVITY_STORAGE_KEY);
    const activity = normalizeActionActivity(
      stored[ACTION_ACTIVITY_STORAGE_KEY]?.[String(numericTabId)]
    );
    if (activity.audio || activity.video) actionActivityByTab.set(numericTabId, activity);
    return activity;
  } catch (_) {
    return { audio: false, video: false };
  }
}

async function ensureVideoContentScripts(tabId) {
  const numericTabId = Number(tabId);
  if (!Number.isInteger(numericTabId) || numericTabId < 0) {
    return { success: false, error: "Invalid tab" };
  }

  const existingTask = videoContentScriptTasks.get(numericTabId);
  if (existingTask) return existingTask;

  const task = (async () => {
    // Content scripts are not retroactively injected into a tab that was
    // already open when the extension was installed. Check the main frame
    // first so reopening the popup never creates duplicate handlers.
    try {
      const response = await chrome.tabs.sendMessage(numericTabId, {
        type: "PING",
      });
      if (response?.pong) return { success: true, injected: false };
    } catch (_) {
      // No video content script is present yet. Inject it below.
    }

    try {
      await chrome.scripting.executeScript({
        // The notification and normal video controls live in the top frame.
        // Injecting the fallback into every frame can fail on pages with a
        // restricted/embed frame even when the main page is scriptable.
        target: { tabId: numericTabId, allFrames: false },
        files: ["video-delay.js", "video-zoom.js"],
      });
      return { success: true, injected: true };
    } catch (error) {
      // Restricted pages (for example chrome:// pages) cannot accept scripts.
      // Audio capture can still work there when Chrome permits it, so this is
      // a non-fatal video capability result.
      console.warn("NextSona: video content script injection failed", error);
      return { success: false, error: error?.message || "Injection failed" };
    }
  })();

  videoContentScriptTasks.set(numericTabId, task);
  try {
    return await task;
  } finally {
    videoContentScriptTasks.delete(numericTabId);
  }
}

// Open a small first-run welcome page after a real installation. Chrome only
// emits reason="install" once for an extension install, so normal popup use,
// service-worker wakeups, and extension reloads do not interrupt the user.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});

async function setMap(playerTabId, sourceTabId) {
  const data = await chrome.storage.session.get("playerMap");
  const map = data.playerMap || {};
  map[playerTabId] = sourceTabId;
  await chrome.storage.session.set({ playerMap: map });
}

async function getSourceId(playerTabId) {
  const data = await chrome.storage.session.get("playerMap");
  const map = data.playerMap || {};
  return map[playerTabId];
}

async function removeMap(playerTabId) {
  const data = await chrome.storage.session.get("playerMap");
  const map = data.playerMap || {};
  if (map[playerTabId]) {
    const sourceTabId = map[playerTabId];
    delete map[playerTabId];
    await chrome.storage.session.set({ playerMap: map });
    return sourceTabId;
  }
  return null;
}

async function setupOffscreen() {
  const path = "offscreen.html";
  if (await chrome.offscreen.hasDocument()) return;

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ["USER_MEDIA"],
      justification: "Audio processing",
    });
    await creating;
    creating = null;
  }
}

async function checkOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return contexts.length > 0;
}

async function setupOffscreenDocument(path) {
  if (await checkOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ["AUDIO_PLAYBACK", "USER_MEDIA"],
    justification: "Recording and processing tab audio",
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_VIDEO_ACTIVITY") {
    setActionActivityChannel(msg.tabId, "video", msg.active === true);
  } else if (msg.type === "SET_ACTION_ACTIVITY") {
    setActionActivity(msg.tabId, {
      // `active` remains accepted for compatibility with an older internal
      // build, but new senders provide the two channels independently.
      audio: msg.audioActive === true || msg.active === true,
      video: msg.videoActive === true,
    });
  } else if (msg.type === "ENSURE_VIDEO_CONTENT_SCRIPTS") {
    ensureVideoContentScripts(msg.tabId).then(sendResponse);
    return true;
  } else if (msg.type === "CHECK_OFFSCREEN") {
    checkOffscreenDocument().then((has) => sendResponse(has));
    return true;
  } else if (msg.type === "INIT_OFFSCREEN") {
    setupOffscreenDocument(msg.path || "offscreen.html").then(() =>
      sendResponse(true)
    );
    return true;
  } else if (msg.type === "BG_RESET_DELAY") {
    if (msg.tabId) {
      chrome.tabs
        .sendMessage(msg.tabId, { type: "SET_VIDEO_DELAY", value: 0 })
        .catch(() => {});
      chrome.tabs
        .sendMessage(msg.tabId, { type: "SET_VIDEO_QUALITY", value: "max" })
        .catch(() => {});
      chrome.tabs
        .sendMessage(msg.tabId, {
          type: "SET_VIDEO_ZOOM",
          scale: 1,
          translateY: 0,
          rotate: 0,
        })
        .catch(() => {});
    }
  } else if (msg.type === "OPEN_PLAYER_TAB") {
    const sourceTabId = msg.sourceTabId;
    chrome.tabs.create({ url: `player.html?source=${sourceTabId}` });
  } else if (msg.type === "PLAYER_READY") {
    if (sender.tab) {
      const playerTabId = sender.tab.id;
      const sourceTabId = parseInt(msg.sourceTabId);

      if (!isNaN(sourceTabId)) {
        setMap(playerTabId, sourceTabId).then(() => {
          chrome.runtime.sendMessage({
            type: "START_WEBRTC_STREAM",
            sourceTabId: sourceTabId,
            playerTabId: playerTabId,
          });
        });
      }
    }
  } else if (msg.type === "BG_RELAY_TO_TAB") {
    // New handler for Remote Control to Content Script Relay
    if (msg.tabId && msg.payload) {
      ensureVideoContentScripts(msg.tabId)
        .catch(() => {})
        .finally(() => {
          chrome.tabs.sendMessage(Number(msg.tabId), msg.payload).catch(() => {});
        });
    }
  } else if (
    msg.type === "RTC_OFFER" ||
    msg.type === "RTC_ANSWER" ||
    msg.type === "RTC_CANDIDATE"
  ) {
    if (msg.target === "PLAYER") {
      if (msg.playerTabId) {
        chrome.tabs.sendMessage(msg.playerTabId, msg).catch(() => {});
      }
    } else if (msg.target === "OFFSCREEN") {
      (async () => {
        const playerTabId = sender.tab ? sender.tab.id : null;
        const sourceTabId = await getSourceId(playerTabId);

        if (sourceTabId) {
          msg.sourceTabId = sourceTabId;
          chrome.runtime.sendMessage(msg).catch(() => {});
        }
      })();
    }
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  getActionActivity(tabId).then((activity) => updateActionIcon(tabId, activity));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  actionActivityByTab.delete(tabId);
  actionIconRevisions.delete(tabId);
  persistActionActivity();
  removeMap(tabId).then((sourceTabId) => {
    if (sourceTabId) {
      chrome.runtime
        .sendMessage({ type: "STOP_WEBRTC_STREAM", sourceTabId: sourceTabId })
        .catch(() => {});
    }
  });

  chrome.runtime
    .sendMessage({ type: "STOP_CAPTURE", tabId: tabId })
    .catch(() => {});
});
