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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_OFFSCREEN") {
    chrome.offscreen.hasDocument().then((has) => sendResponse(has));
    return true;
  }
  if (msg.type === "INIT_OFFSCREEN") {
    setupOffscreen().then(() => sendResponse(true));
    return true;
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
          console.error("Error getting stream ID:", chrome.runtime.lastError);
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
  } else if (msg.type === "STOP_CAPTURE" || msg.type === "SET_PARAM") {
    chrome.runtime.sendMessage(msg);
    sendResponse({ success: true });
  } else if (msg.type === "GET_STATE") {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      sendResponse(response || {});
    });
    return true;
  }
});
