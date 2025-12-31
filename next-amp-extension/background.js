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
  if (
    msg.type === "SET_PARAM" ||
    msg.type === "START_CAPTURE" ||
    msg.type === "STOP_CAPTURE"
  ) {
    chrome.runtime.sendMessage(msg);
    sendResponse({ success: true });
  } else if (msg.type === "GET_STATE") {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      sendResponse(response);
    });
    return true;
  }
});
