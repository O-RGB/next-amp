// next-amp-extension/background.js

let creating;

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
      // 1. Reset Delay
      chrome.tabs
        .sendMessage(msg.tabId, { type: "SET_VIDEO_DELAY", value: 0 })
        .catch(() => {});
      // 2. Reset Quality
      chrome.tabs
        .sendMessage(msg.tabId, { type: "SET_VIDEO_QUALITY", value: "max" })
        .catch(() => {});
      // 3. [เพิ่ม] Reset Zoom & Rotate (ROI) ให้กลับเป็นค่าเริ่มต้น
      chrome.tabs
        .sendMessage(msg.tabId, {
          type: "SET_VIDEO_ZOOM",
          scale: 1,
          translateY: 0,
          rotate: 0,
        })
        .catch(() => {});
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
  chrome.runtime
    .sendMessage({ type: "STOP_CAPTURE", tabId: tabId })
    .catch(() => {});
});
