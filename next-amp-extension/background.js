// next-amp-extension/background.js

let creating;

// ฟังก์ชันช่วยจัดการข้อมูลใน storage session
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
  if (msg.type === "CHECK_OFFSCREEN") {
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
        // [FIX] ใช้ storage แทน Map
        setMap(playerTabId, sourceTabId).then(() => {
          chrome.runtime.sendMessage({
            type: "START_WEBRTC_STREAM",
            sourceTabId: sourceTabId,
            playerTabId: playerTabId,
          });
        });
      }
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
      // [FIX] ดึงค่าจาก storage แบบ Async
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

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PING") {
    sendResponse({
      status: "PONG",
      version: chrome.runtime.getManifest().version,
    });
    return false;
  }

  if (msg.type === "START_CAPTURE") {
    if (!sender || !sender.tab) {
      sendResponse({ success: false, error: "No sender tab" });
      return false;
    }

    chrome.tabCapture.getMediaStreamId(
      { targetTabId: sender.tab.id },
      (streamId) => {
        if (chrome.runtime.lastError || !streamId) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError?.message,
          });
          return;
        }
        chrome.runtime.sendMessage({
          type: "START_CAPTURE",
          streamId: streamId,
          tabId: sender.tab.id,
        });
        sendResponse({ success: true });
      }
    );
    return true;
  } else if (msg.type === "STOP_CAPTURE") {
    chrome.runtime.sendMessage(msg);
    sendResponse({ success: true });
  } else if (msg.type === "SET_PARAM") {
    chrome.runtime.sendMessage(msg);
    sendResponse({ success: true });
  } else if (msg.type === "GET_STATE") {
    chrome.runtime.sendMessage(msg, (response) => {
      sendResponse(response || {});
    });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // [FIX] ใช้ removeMap เพื่อลบข้อมูลจาก storage และคืนค่า sourceTabId
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
