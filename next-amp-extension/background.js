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

// รับ Message จากภายใน Extension (Popup -> Background)
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

// *** ส่วนที่เพิ่ม: รับ Message จากหน้าเว็บ (Host.js) ***
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // ส่งต่อไปให้ Offscreen ประมวลผล
  if (
    msg.type === "SET_PARAM" ||
    msg.type === "START_CAPTURE" ||
    msg.type === "STOP_CAPTURE"
  ) {
    chrome.runtime.sendMessage(msg);
    sendResponse({ success: true });
  }
  // ดึงค่าปัจจุบันส่งคืน Host
  else if (msg.type === "GET_STATE") {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      sendResponse(response);
    });
    return true; // บอก Chrome ว่าจะ sendResponse แบบ async
  }
});
