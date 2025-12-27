// background.js
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
