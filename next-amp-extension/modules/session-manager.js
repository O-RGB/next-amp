// next-amp-extension/modules/session-manager.js
import { $, sendMessageWithRetry } from "../assets/js/utils.js";

const OVERLAY_HTML = `
  <div class="win-border-out session-dialog shadow-2xl">
    <div class="theme-bar justify-center mb-2">
      <span>MULTIPLE SESSIONS DETECTED</span>
    </div>
    <div class="bg-[#222] p-4 flex flex-col gap-4 text-center">
      <p class="text-white text-[10px] font-pixel">
        Another session detected in another tab.<br />
        Please choose session mode:
      </p>
      <div class="flex flex-col gap-2">
        <button id="btn-mode-shared" class="win-btn h-8 bg-blue-900 text-white border-blue-400 hover:bg-blue-800 cursor-pointer pointer-events-auto">
          <div class="flex flex-col items-center pointer-events-none">
            <span class="text-[9px]">SHARED MODE</span>
            <span class="text-[7px] text-gray-300 font-normal">Sync all settings</span>
          </div>
        </button>
        <button id="btn-mode-temp" class="win-btn h-8 bg-gray-700 text-white hover:bg-gray-600 cursor-pointer pointer-events-auto">
          <div class="flex flex-col items-center pointer-events-none">
            <span class="text-[9px]">TEMPORARY MODE</span>
            <span class="text-[7px] text-gray-300 font-normal">Independent (temporary)</span>
          </div>
        </button>
      </div>
    </div>
  </div>
`;

export class SessionManager {
  constructor(currentTabId) {
    this.currentTabId = currentTabId;
    this.sessionMode = "shared";
    this.tempStorage = {};
    this.initialized = false;
  }

  async init(callback) {
    console.log("SessionManager: Initializing...");

    // Create overlay and inject into body
    const overlay = document.createElement("div");
    overlay.id = "session-mode-overlay";
    overlay.className = "z-[100000]";
    overlay.innerHTML = OVERLAY_HTML;
    document.body.appendChild(overlay);

    // Check offscreen document
    const hasOffscreen = await sendMessageWithRetry({
      type: "CHECK_OFFSCREEN",
    });

    if (!hasOffscreen) {
      console.log(
        "SessionManager: No offscreen detected, defaulting to shared."
      );
      this.finalize("shared", callback);
      return;
    }

    // Check current state
    const state = await sendMessageWithRetry({
      type: "GET_STATE",
      tabId: this.currentTabId,
    });

    if (state && state.mode) {
      console.log("SessionManager: Existing state found:", state.mode);
      this.finalize(state.mode, callback);
      return;
    }

    // Check multiple active sessions
    const result = await sendMessageWithRetry({
      type: "CHECK_ACTIVE_SESSIONS",
      currentTabId: this.currentTabId,
    });

    if (result && result.hasActiveSession) {
      console.log(
        "SessionManager: Multiple sessions detected. Showing overlay."
      );
      overlay.classList.add("active");

      // Bind click events safely
      const btnShared = overlay.querySelector("#btn-mode-shared");
      const btnTemp = overlay.querySelector("#btn-mode-temp");

      if (btnShared) {
        btnShared.addEventListener("click", () => {
          console.log("SessionManager: Shared mode selected.");
          overlay.classList.remove("active");
          this.finalize("shared", callback);
        });
      } else {
        console.error("SessionManager: Shared button not found!");
      }

      if (btnTemp) {
        btnTemp.addEventListener("click", () => {
          console.log("SessionManager: Temp mode selected.");
          this.tempStorage = {
            theme: "blue",
            startupVol: "1.0",
            latencyHint: "interactive",
            showStats: false,
            videoZoom: 1.0,
            videoRotate: 0,
          };
          overlay.classList.remove("active");
          this.finalize("temp", callback);
        });
      } else {
        console.error("SessionManager: Temp button not found!");
      }
    } else {
      console.log("SessionManager: No active session conflict.");
      this.finalize("shared", callback);
    }
  }

  finalize(mode, callback) {
    this.sessionMode = mode;
    this.initialized = true;

    // Remove or hide overlay
    const overlay = document.getElementById("session-mode-overlay");
    if (overlay) overlay.classList.remove("active");

    if (callback) {
      try {
        callback();
      } catch (e) {
        console.error("SessionManager: Error in callback execution", e);
      }
    }
  }

  async getSetting(keys) {
    if (this.sessionMode === "temp") {
      const res = {};
      if (Array.isArray(keys)) {
        keys.forEach((k) => (res[k] = this.tempStorage[k]));
      } else {
        res[keys] = this.tempStorage[keys];
      }
      return res;
    }
    return await chrome.storage.local.get(keys);
  }

  setSetting(obj) {
    if (this.sessionMode === "temp") {
      Object.assign(this.tempStorage, obj);
    } else {
      chrome.storage.local.set(obj);
    }
  }
}
