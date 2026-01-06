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

// Listener สำหรับข้อความภายใน Extension (จาก Popup)
// ใช้เพื่อตรวจสอบและสร้าง Offscreen Document เท่านั้น
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CHECK_OFFSCREEN") {
    chrome.offscreen.hasDocument().then((has) => sendResponse(has));
    return true;
  }
  if (msg.type === "INIT_OFFSCREEN") {
    setupOffscreen().then(() => sendResponse(true));
    return true;
  }
  // หมายเหตุ: START_CAPTURE จะถูกจัดการโดย offscreen.js โดยตรง
  // background.js ไม่ต้องรับผิดชอบ message นี้
});

// Listener สำหรับข้อความจากภายนอก (จากหน้าเว็บ localhost หรือ next-cast.vercel.app)
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

    // กรณีสั่ง Start จากหน้าเว็บ ให้ Background ขอ Stream ID แล้วส่งต่อให้ Offscreen
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

        // ส่งต่อให้ Offscreen เริ่มทำงาน
        chrome.runtime.sendMessage({
          type: "START_CAPTURE",
          streamId: streamId,
          tabId: sender.tab.id,
        });

        sendResponse({ success: true });
      }
    );
    return true; // แจ้งว่าเป็น Async response
  } else if (msg.type === "STOP_CAPTURE" || msg.type === "SET_PARAM") {
    // ส่งต่อคำสั่งไปยัง Offscreen
    chrome.runtime.sendMessage(msg);
    sendResponse({ success: true });
  } else if (msg.type === "GET_STATE") {
    // ถามสถานะจาก Offscreen แล้วตอบกลับหน้าเว็บ
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      sendResponse(response || {});
    });
    return true;
  }
});
