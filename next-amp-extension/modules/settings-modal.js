// next-amp-extension/modules/settings-modal.js
import { $, $$ } from "../assets/js/utils.js";

const MODAL_HTML = `
  <div class="win-border-out modal-window shadow-2xl">
    <div class="theme-bar">
      <span>SETTINGS & TOOLS</span>
      <button id="btn-modal-close" class="win-btn text-red-900 font-bold bg-[#e0e0e0]">X</button>
    </div>

    <div class="tab-header">
      <button class="tab-btn active" data-tab="tab-general">GENERAL</button>
      <button class="tab-btn" data-tab="tab-advanced">ADVANCED</button>
      <button class="tab-btn" data-tab="tab-record">RECORDER</button>
      <button class="tab-btn" data-tab="tab-about">ABOUT</button>
    </div>

    <div class="win-border-in flex-1 m-2 flex flex-col min-h-0">
      <div id="tab-general" class="tab-content active">
        <div class="setting-row">
          <span>Startup Volume</span>
          <select id="sel-startup-vol" class="bg-black border border-gray-600 text-[8px] text-green-500 h-4 outline-none">
            <option value="1.0">100%</option>
            <option value="0.8">80%</option>
            <option value="0.5">50%</option>
            <option value="0.3">30%</option>
          </select>
        </div>
        <div class="setting-row">
          <span>Theme Color</span>
          <div class="flex gap-1">
            <div class="w-3 h-3 bg-[#000080] border border-white cursor-pointer theme-box" data-theme="blue" title="Classic Blue"></div>
            <div class="w-3 h-3 bg-[#800000] border border-gray-600 cursor-pointer theme-box" data-theme="red" title="Crimson Red"></div>
            <div class="w-3 h-3 bg-[#005000] border border-gray-600 cursor-pointer theme-box" data-theme="green" title="Matrix Green"></div>
          </div>
        </div>
        <div class="setting-row">
          <span>Audio Latency Hint</span>
          <select id="sel-latency" class="bg-black border border-gray-600 text-[8px] text-white h-4 outline-none">
            <option value="interactive">Interactive (Low)</option>
            <option value="balanced">Balanced</option>
            <option value="playback">Playback (High)</option>
          </select>
        </div>
        <div class="setting-row">
          <div class="flex items-center gap-1">
            <span>Sample Rate</span>
            <span id="txt-active-sr" class="text-[7px] text-green-400 font-pixel"></span>
          </div>
          <select id="sel-sample-rate" class="bg-black border border-gray-600 text-[8px] text-white h-4 outline-none">
            <option value="44100">44,100 Hz (Low CPU)</option>
            <option value="48000">48,000 Hz (Standard)</option>
            <option value="auto">Auto (Device Default)</option>
          </select>
        </div>
        <div class="setting-row">
          <span>Show FPS / Stats</span>
          <input type="checkbox" id="chk-show-stats" class="accent-green-500" />
        </div>
      </div>

      <div id="tab-advanced" class="tab-content">
        <div class="text-[9px] font-bold text-green-500 mb-0.5 border-b border-gray-700">REVERB SETTINGS</div>
        <div class="setting-row flex-col items-start gap-0.5 py-0.5">
          <div class="w-full flex justify-between leading-none">
            <span class="text-[8px]">Duration (Time)</span><span id="txt-rev-time" class="text-[8px]">3.0s</span>
          </div>
          <input type="range" id="adv-rev-time" min="0.1" max="10" step="0.1" value="3.0" class="h-slider w-full" style="height: 12px; margin: 0" />
        </div>
        <div class="setting-row flex-col items-start gap-0.5 py-0.5">
          <div class="w-full flex justify-between leading-none">
            <span class="text-[8px]">Decay (Damp)</span><span id="txt-rev-decay" class="text-[8px]">2.0</span>
          </div>
          <input type="range" id="adv-rev-decay" min="0.1" max="10" step="0.1" value="2.0" class="h-slider w-full" style="height: 12px; margin: 0" />
        </div>
        <div class="text-[9px] font-bold text-yellow-500 mb-0.5 mt-1 border-b border-gray-700">DYNAMICS (COMPRESSOR)</div>
        <div class="setting-row flex-col items-start gap-0.5 py-0.5">
          <div class="w-full flex justify-between leading-none">
            <span class="text-[8px]">Boost Low (Quiet -> Loud)</span><span id="txt-dyn-boost" class="text-[8px]">40%</span>
          </div>
          <input type="range" id="adv-dyn-boost" min="0" max="100" step="1" value="40" class="h-slider w-full" style="height: 12px; margin: 0" />
        </div>
        <div class="setting-row flex-col items-start gap-0.5 py-0.5">
          <div class="w-full flex justify-between leading-none">
            <span class="text-[8px]">Limit High (Suppress Loud)</span><span id="txt-dyn-limit" class="text-[8px]">60%</span>
          </div>
          <input type="range" id="adv-dyn-limit" min="0" max="100" step="1" value="60" class="h-slider w-full" style="height: 12px; margin: 0" />
        </div>
        <div class="text-[9px] font-bold text-blue-400 mb-0.5 mt-1 border-b border-gray-700">UTILITIES</div>
        <div class="flex flex-col gap-1 mt-0.5">
          <div class="flex items-center gap-1">
            <span class="text-[8px] text-gray-500 w-8">ID:</span>
            <input type="text" id="txt-ext-id" class="flex-1 bg-[#111] border border-gray-600 text-[8px] text-gray-400 px-1 h-4 outline-none cursor-default" readonly value="Loading..." />
            <button id="btn-copy-id" class="win-btn w-8 h-4 text-[8px]" title="Copy ID">CPY</button>
          </div>
          <button id="btn-reset" class="win-btn w-full py-0.5 text-red-900 font-bold bg-[#e0e0e0]">FACTORY RESET</button>
        </div>
      </div>

      <div id="tab-record" class="tab-content">
        <div class="flex justify-between items-center mb-2 p-1 bg-black border border-gray-700">
          <span class="text-[9px] font-pixel text-gray-400">STATUS: <span id="rec-status">READY</span></span>
          <button id="btn-rec-action" class="win-btn w-12 h-4 text-[8px] flex items-center justify-center gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-red-600"></div>
            <span>REC</span>
          </button>
        </div>
        <div class="text-[8px] text-gray-500 mb-1 font-bold">SAVED RECORDINGS</div>
        <div class="flex flex-col gap-1" id="rec-list"></div>
      </div>

      <div id="tab-about" class="tab-content">
        <div class="flex flex-col items-center justify-center h-full text-center gap-2">
          <div class="w-12 h-12 bg-gray-800 border border-white flex items-center justify-center p-1">
            <img src="./assets/logo.png" alt="Logo" class="w-full h-full object-contain" />
          </div>
          <div>
            <div class="text-[10px] font-bold text-white">NEXTAMP EXTENSION</div>
            <div class="text-[8px] text-gray-400">Version 4.5.1</div>
          </div>
          <p class="text-[8px] text-gray-500 px-4">Advanced audio processing, real-time visualizer, and in-browser audio recording.</p>
          <div class="win-border-in bg-[#1e1e1e] p-2 mt-1 w-[90%] flex flex-col items-center gap-1 border border-gray-700">
            <div class="text-[9px] font-bold text-yellow-400 flex items-center gap-1">
              <i class="ph-bold ph-coffee text-amber-400 text-[10px]"></i>
              <span>SUPPORT THE PROJECT</span>
            </div>
            <p class="text-[7.5px] text-gray-400 leading-tight">
              Support ongoing development and future feature updates.
            </p>
            <button
              id="btn-donate-about"
              class="win-btn h-5 px-2 text-[8px] font-bold text-[#4a2810] bg-gradient-to-b from-[#ffd966] to-[#f1c232] hover:from-[#ffe599] hover:to-[#ffd966] active:scale-95 flex items-center justify-center gap-1 border border-[#b48608] shadow cursor-pointer mt-0.5"
            >
              <i class="ph-bold ph-coffee text-[9px]"></i>
              <span>BUY ME A COFFEE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

export class SettingsModal {
  constructor(
    dbManager,
    callbacks = {
      onThemeChange: () => {},
      onSettingChange: () => {},
      onReset: () => {},
      onSendParam: () => {},
      onToggleRecord: () => {},
    }
  ) {
    this.db = dbManager;
    this.callbacks = callbacks;
    this.audioPlayer = null;
  }

  init() {
    // Inject HTML
    const overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.innerHTML = MODAL_HTML;
    document.body.appendChild(overlay);

    this.setupListeners();

    // Set Extension ID
    try {
      const extId = chrome.runtime.id;
      if (extId) $("#txt-ext-id").value = extId;
    } catch (e) {}
  }

  toggle(show) {
    const overlay = $("#modal-overlay");
    overlay.classList.toggle("active", show);
  }

  switchTab(id) {
    $$(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === id)
    );
    $$(".tab-content").forEach((c) =>
      c.classList.toggle("active", c.id === id)
    );
  }

  setupListeners() {
    const overlay = $("#modal-overlay");
    $("#btn-settings").onclick = () => {
      this.toggle(true);
      this.switchTab("tab-general");
    };
    $("#btn-modal-close").onclick = () => this.toggle(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) this.toggle(false);
    };

    $$(".tab-btn").forEach(
      (btn) => (btn.onclick = () => this.switchTab(btn.dataset.tab))
    );

    // Donate / Support
    const donateAboutBtn = $("#btn-donate-about");
    if (donateAboutBtn) {
      donateAboutBtn.onclick = () => {
        chrome.tabs.create({ url: "https://ganknow.com/nextfeeder/tip" });
      };
    }

    // Theme Logic
    $$(".theme-box").forEach((box) => {
      box.onclick = () => {
        const t = box.dataset.theme;
        this.callbacks.onThemeChange(t);
        this.callbacks.onSettingChange({ theme: t });
      };
    });

    // General Settings
    $("#sel-startup-vol").onchange = (e) =>
      this.callbacks.onSettingChange({ startupVol: e.target.value });
    $("#sel-latency").onchange = (e) =>
      this.callbacks.onSettingChange({ latencyHint: e.target.value });
    $("#sel-sample-rate").onchange = (e) =>
      this.callbacks.onSettingChange({ sampleRate: e.target.value });
    $("#chk-show-stats").onchange = (e) => {
      this.callbacks.onSettingChange({ showStats: e.target.checked });
      // toggleStats logic if needed
    };

    // Advanced Settings (Reverb/Dyn)
    $("#adv-rev-time").addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      $("#txt-rev-time").textContent = v + "s";
      this.callbacks.onSendParam("reverbTime", v);
    });
    $("#adv-rev-decay").addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      $("#txt-rev-decay").textContent = v;
      this.callbacks.onSendParam("reverbDecay", v);
    });
    $("#adv-dyn-boost").addEventListener("input", (e) => {
      const v = parseInt(e.target.value);
      $("#txt-dyn-boost").textContent = v + "%";
      this.callbacks.onSendParam("dynBoost", v);
    });
    $("#adv-dyn-limit").addEventListener("input", (e) => {
      const v = parseInt(e.target.value);
      $("#txt-dyn-limit").textContent = v + "%";
      this.callbacks.onSendParam("dynLimit", v);
    });

    // Utilities
    $("#btn-copy-id").onclick = () => {
      const input = $("#txt-ext-id");
      input.select();
      navigator.clipboard.writeText(input.value);
    };
    $("#btn-reset").addEventListener("click", this.callbacks.onReset);

    // Recording
    $("#btn-rec-action").onclick = this.callbacks.onToggleRecord;
  }

  async renderRecordingList() {
    const listContainer = $("#rec-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    const recordings = await this.db.getAllRecordings();
    if (recordings.length === 0) {
      listContainer.innerHTML = `<div class="text-[8px] text-gray-600 text-center py-4">No recordings yet</div>`;
      return;
    }
    recordings.forEach((rec) => {
      const el = document.createElement("div");
      el.className = "rec-item";
      el.innerHTML = `
            <i class="ph-fill ph-music-note-simple rec-icon text-[10px] mr-1"></i>
            <div class="rec-info flex-1 min-w-0 mr-1">
                <span class="text-[9px] text-white leading-none block truncate">${rec.name}</span>
                <span class="text-[8px] text-gray-500">${rec.size}MB - ${rec.date}</span>
            </div>
            <div class="flex gap-1">
                <button class="win-btn w-4 h-4 text-[9px] btn-play text-green-400 border border-gray-600" title="Play">P</button>
                <button class="win-btn w-4 h-4 text-[9px] btn-dl text-blue-400 border border-gray-600" title="Download">DL</button>
                <button class="win-btn w-4 h-4 text-[9px] btn-del text-red-500 font-bold border border-gray-600" title="Delete">D</button>
            </div>
        `;
      el.querySelector(".btn-play").onclick = () =>
        this.playRecording(rec.blob);
      el.querySelector(".btn-dl").onclick = () => {
        const url = URL.createObjectURL(rec.blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${rec.name}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      };
      el.querySelector(".btn-del").onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${rec.name}?`)) {
          await this.db.deleteRecording(rec.id);
          this.renderRecordingList();
        }
      };
      listContainer.appendChild(el);
    });
  }

  playRecording(blob) {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer = null;
    }
    const url = URL.createObjectURL(blob);
    this.audioPlayer = new Audio(url);
    this.audioPlayer.play();
    this.audioPlayer.onended = () => {
      URL.revokeObjectURL(url);
    };
  }

  updateRecordStatus(isRecording) {
    const btnRecAction = $("#btn-rec-action");
    const recStatus = $("#rec-status");
    if (isRecording) {
      recStatus.textContent = "RECORDING...";
      recStatus.className = "text-red-500 font-bold animate-pulse";
      if (btnRecAction) {
        btnRecAction.innerHTML = `<div class="w-2 h-2 rounded-sm bg-white"></div><span>STOP</span>`;
        btnRecAction.classList.add("bg-red-900", "text-white");
      }
    } else {
      recStatus.textContent = "READY";
      recStatus.className = "text-gray-400";
      if (btnRecAction) {
        btnRecAction.innerHTML = `<div class="w-1.5 h-1.5 rounded-full bg-red-600"></div><span>REC</span>`;
        btnRecAction.classList.remove("bg-red-900", "text-white");
      }
    }
  }

  showRecordingSaved() {
    this.toggle(true);
    this.switchTab("tab-record");
  }

  setValues(state) {
    if (state.reverbTime !== undefined) {
      $("#adv-rev-time").value = state.reverbTime;
      $("#txt-rev-time").textContent = state.reverbTime + "s";
    }
    if (state.reverbDecay !== undefined) {
      $("#adv-rev-decay").value = state.reverbDecay;
      $("#txt-rev-decay").textContent = state.reverbDecay;
    }
    if (state.dynBoost !== undefined) {
      $("#adv-dyn-boost").value = state.dynBoost;
      $("#txt-dyn-boost").textContent = state.dynBoost + "%";
    }
    if (state.dynLimit !== undefined) {
      $("#adv-dyn-limit").value = state.dynLimit;
      $("#txt-dyn-limit").textContent = state.dynLimit + "%";
    }
    if (state.startupVol) $("#sel-startup-vol").value = state.startupVol;
    if (state.latencyHint) $("#sel-latency").value = state.latencyHint;
    if (state.sampleRate) $("#sel-sample-rate").value = state.sampleRate;
    if (state.currentSampleRate) this.updateActiveSampleRate(state.currentSampleRate);
    if (state.showStats !== undefined) {
      $("#chk-show-stats").checked = state.showStats;
    }
  }

  updateActiveSampleRate(sr) {
    const el = $("#txt-active-sr");
    if (el) el.textContent = sr ? `[${sr}Hz]` : "";
  }
}
