// next-amp-extension/assets/js/utils.js

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);

export async function sendMessageWithRetry(msg, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (i === maxRetries - 1) return null;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
