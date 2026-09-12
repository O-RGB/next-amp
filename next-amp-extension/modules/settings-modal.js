// next-amp-extension/modules/settings-modal.js
import { $, $$ } from "../assets/js/utils.js";

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

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
            <div class="hidden flex items-center gap-1">
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
            <div class="text-[10px] font-bold text-white">NEXTSTUDIO EXTENSION</div>
            <div class="text-[7px] text-cyan-300">NextStudio - Pitch Shifter, AI Vocal &amp; Video Sync</div>
            <div class="text-[8px] text-gray-400">Version 1.0</div>
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

    <div id="record-delete-overlay" class="record-delete-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="record-delete-title">
      <div class="win-border-out session-dialog shadow-2xl">
        <div class="theme-bar">
          <span class="flex items-center gap-1" id="record-delete-title">
            <i class="ph-bold ph-trash text-red-400"></i>
            <span>DELETE RECORDING</span>
          </span>
          <button id="btn-record-delete-close" class="win-btn text-red-900 font-bold bg-[#e0e0e0]" aria-label="Close">X</button>
        </div>
        <div class="bg-[#222] p-3 flex flex-col gap-3 items-center text-center">
          <p id="record-delete-message" class="text-[9px] text-gray-300 leading-tight m-0"></p>
          <div class="flex gap-2 w-full">
            <button id="btn-record-delete-cancel" class="win-btn flex-1 h-5 text-[8px] font-bold">CANCEL</button>
            <button id="btn-record-delete-confirm" class="win-btn flex-1 h-5 text-[8px] font-bold text-white bg-red-800">DELETE</button>
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
    this.audioPlayerUrl = null;
    this.activeRecordingId = null;
    this.pendingDeleteRecording = null;
    this.playbackGeneration = 0;
  }

  init() {
    try {
      // Inject HTML if not already present in DOM
      let overlay = $("#modal-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "modal-overlay";
        overlay.innerHTML = MODAL_HTML;
        document.body.appendChild(overlay);
      }

      this.setupListeners();

      // Set Extension ID
      try {
        const extId = chrome.runtime.id;
        const txtExtId = $("#txt-ext-id");
        if (extId && txtExtId) txtExtId.value = extId;
      } catch (e) {}
    } catch (err) {
      console.error("[SettingsModal] Init error:", err);
    }
  }

  toggle(show) {
    const overlay = $("#modal-overlay");
    if (overlay) overlay.classList.toggle("active", show);
    if (!show) this.closeDeleteConfirm();
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
    const btnSettings = $("#btn-settings");
    if (btnSettings) {
      btnSettings.onclick = () => {
        this.toggle(true);
        this.switchTab("tab-general");
      };
    }
    const btnClose = $("#btn-modal-close");
    if (btnClose) {
      btnClose.onclick = () => this.toggle(false);
    }
    if (overlay) {
      overlay.onclick = (e) => {
        if (e.target === overlay) this.toggle(false);
      };
    }

    $$(".tab-btn").forEach(
      (btn) => (btn.onclick = () => this.switchTab(btn.dataset.tab))
    );

    // Donate / Support
    const donateAboutBtn = $("#btn-donate-about");
    if (donateAboutBtn) {
      donateAboutBtn.onclick = () => {
        chrome.tabs.create({ url: "https://ganknow.com/nextfeederlabs/tip" });
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
    const selStartupVol = $("#sel-startup-vol");
    if (selStartupVol) {
      selStartupVol.onchange = (e) =>
        this.callbacks.onSettingChange({ startupVol: e.target.value });
    }
    const selLatency = $("#sel-latency");
    if (selLatency) {
      selLatency.onchange = (e) =>
        this.callbacks.onSettingChange({ latencyHint: e.target.value });
    }
    const selSampleRate = $("#sel-sample-rate");
    if (selSampleRate) {
      selSampleRate.onchange = (e) =>
        this.callbacks.onSettingChange({ sampleRate: e.target.value });
    }
    const chkStats = $("#chk-show-stats");
    if (chkStats) {
      chkStats.onchange = (e) => {
        this.callbacks.onSettingChange({ showStats: e.target.checked });
      };
    }

    // Advanced Settings (Reverb/Dyn)
    $("#adv-rev-time")?.addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      const txt = $("#txt-rev-time");
      if (txt) txt.textContent = v + "s";
      this.callbacks.onSendParam("reverbTime", v);
    });
    $("#adv-rev-decay")?.addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      const txt = $("#txt-rev-decay");
      if (txt) txt.textContent = v;
      this.callbacks.onSendParam("reverbDecay", v);
    });
    $("#adv-dyn-boost")?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value);
      const txt = $("#txt-dyn-boost");
      if (txt) txt.textContent = v + "%";
      this.callbacks.onSendParam("dynBoost", v);
    });
    $("#adv-dyn-limit")?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value);
      const txt = $("#txt-dyn-limit");
      if (txt) txt.textContent = v + "%";
      this.callbacks.onSendParam("dynLimit", v);
    });

    // Utilities
    const btnCopy = $("#btn-copy-id");
    if (btnCopy) {
      btnCopy.onclick = () => {
        const input = $("#txt-ext-id");
        if (input) {
          input.select();
          navigator.clipboard.writeText(input.value);
        }
      };
    }
    $("#btn-reset")?.addEventListener("click", this.callbacks.onReset);

    // Recording
    const btnRecAction = $("#btn-rec-action");
    if (btnRecAction) {
      btnRecAction.onclick = this.callbacks.onToggleRecord;
    }

    const deleteOverlay = $("#record-delete-overlay");
    $("#btn-record-delete-close")?.addEventListener("click", () =>
      this.closeDeleteConfirm()
    );
    $("#btn-record-delete-cancel")?.addEventListener("click", () =>
      this.closeDeleteConfirm()
    );
    $("#btn-record-delete-confirm")?.addEventListener("click", () =>
      this.confirmDeleteRecording()
    );
    deleteOverlay?.addEventListener("click", (e) => {
      if (e.target === deleteOverlay) this.closeDeleteConfirm();
    });
  }

  async renderRecordingList() {
    const listContainer = $("#rec-list");
    if (!listContainer) return;
    const recordings = await this.db.getAllRecordings();

    // If the currently playing recording was deleted elsewhere, release its
    // object URL before rebuilding the list.
    if (
      this.activeRecordingId !== null &&
      !recordings.some((rec) => rec.id === this.activeRecordingId)
    ) {
      this.stopRecordingPlayback();
    }

    listContainer.innerHTML = "";
    if (recordings.length === 0) {
      listContainer.innerHTML = `<div class="text-[8px] text-gray-600 text-center py-4">No recordings yet</div>`;
      return;
    }
    recordings.forEach((rec) => {
      const el = document.createElement("div");
      el.className = "rec-item";
      el.dataset.recordingId = String(rec.id);
      el.innerHTML = `
            <i class="ph-fill ph-music-note-simple rec-icon text-[10px] mr-1"></i>
            <div class="rec-info flex-1 min-w-0 mr-1">
                <span class="text-[9px] text-white leading-none block truncate">${escapeHtml(rec.name)}</span>
                <span class="text-[8px] text-gray-500">${rec.size}MB - ${rec.date}</span>
            </div>
            <div class="flex gap-1">
                <button class="win-btn w-6 h-5 text-[10px] btn-play text-green-400 border border-gray-600" title="Play" aria-label="Play recording"><i class="ph-bold ph-play"></i></button>
                <button class="win-btn w-7 h-5 text-[8px] btn-dl text-blue-400 border border-gray-600" title="Download" aria-label="Download recording">DL</button>
                <button class="win-btn w-6 h-5 text-[10px] btn-del text-red-500 font-bold border border-gray-600" title="Delete" aria-label="Delete recording"><i class="ph-bold ph-trash"></i></button>
            </div>
        `;
      el.querySelector(".btn-play").onclick = () =>
        this.playRecording(rec);
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
        this.requestDeleteRecording(rec);
      };
      listContainer.appendChild(el);
    });

    this.updateRecordingPlaybackUI();
  }

  updateRecordingPlaybackUI() {
    const listContainer = $("#rec-list");
    if (!listContainer) return;

    const isPlaying = this.audioPlayer && !this.audioPlayer.paused;
    listContainer.querySelectorAll(".rec-item").forEach((item) => {
      const isActive =
        item.dataset.recordingId === String(this.activeRecordingId);
      const playButton = item.querySelector(".btn-play");
      item.classList.toggle("is-playing", Boolean(isActive && isPlaying));

      if (playButton) {
        playButton.innerHTML =
          isActive && isPlaying
            ? '<i class="ph-bold ph-pause"></i>'
            : '<i class="ph-bold ph-play"></i>';
        playButton.title = isActive && isPlaying ? "Pause" : "Play";
        playButton.setAttribute(
          "aria-label",
          isActive && isPlaying ? "Pause recording" : "Play recording"
        );
      }
    });
  }

  stopRecordingPlayback() {
    const player = this.audioPlayer;
    const url = this.audioPlayerUrl;

    // Invalidate any play() promise that may still be resolving.
    this.playbackGeneration += 1;
    this.audioPlayer = null;
    this.audioPlayerUrl = null;
    this.activeRecordingId = null;

    if (player) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
    if (url) URL.revokeObjectURL(url);
    this.updateRecordingPlaybackUI();
  }

  async playRecording(recording) {
    if (!recording?.blob) return;

    // Clicking the active row toggles pause/play. Clicking another row first
    // stops the old player, so two recordings can never overlap.
    if (this.audioPlayer && this.activeRecordingId === recording.id) {
      if (this.audioPlayer.paused) {
        try {
          await this.audioPlayer.play();
        } catch (err) {
          console.warn("[SettingsModal] Unable to resume recording:", err);
        }
      } else {
        this.audioPlayer.pause();
      }
      this.updateRecordingPlaybackUI();
      return;
    }

    this.stopRecordingPlayback();

    const url = URL.createObjectURL(recording.blob);
    const player = new Audio(url);
    const generation = ++this.playbackGeneration;
    this.audioPlayer = player;
    this.audioPlayerUrl = url;
    this.activeRecordingId = recording.id;
    player.preload = "auto";

    const cleanup = () => {
      if (this.audioPlayer !== player) {
        URL.revokeObjectURL(url);
        return;
      }
      this.audioPlayer = null;
      this.audioPlayerUrl = null;
      this.activeRecordingId = null;
      URL.revokeObjectURL(url);
      this.updateRecordingPlaybackUI();
    };

    player.addEventListener("play", () => this.updateRecordingPlaybackUI());
    player.addEventListener("pause", () => this.updateRecordingPlaybackUI());
    player.addEventListener("ended", cleanup, { once: true });
    player.addEventListener("error", cleanup, { once: true });

    try {
      await player.play();
      if (generation !== this.playbackGeneration || this.audioPlayer !== player) {
        player.pause();
        return;
      }
      this.updateRecordingPlaybackUI();
    } catch (err) {
      cleanup();
      console.warn("[SettingsModal] Unable to play recording:", err);
    }
  }

  requestDeleteRecording(recording) {
    this.pendingDeleteRecording = recording;
    const message = $("#record-delete-message");
    if (message) message.textContent = `Delete “${recording.name}”?`;
    $("#record-delete-overlay")?.classList.remove("hidden");
  }

  closeDeleteConfirm() {
    this.pendingDeleteRecording = null;
    $("#record-delete-overlay")?.classList.add("hidden");
  }

  async confirmDeleteRecording() {
    const recording = this.pendingDeleteRecording;
    this.closeDeleteConfirm();
    if (!recording) return;

    if (this.activeRecordingId === recording.id) {
      this.stopRecordingPlayback();
    }

    try {
      await this.db.deleteRecording(recording.id);
      await this.renderRecordingList();
    } catch (err) {
      console.error("[SettingsModal] Failed to delete recording:", err);
    }
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
    try {
      if (state.reverbTime !== undefined) {
        const el = $("#adv-rev-time");
        if (el) el.value = state.reverbTime;
        const txt = $("#txt-rev-time");
        if (txt) txt.textContent = state.reverbTime + "s";
      }
      if (state.reverbDecay !== undefined) {
        const el = $("#adv-rev-decay");
        if (el) el.value = state.reverbDecay;
        const txt = $("#txt-rev-decay");
        if (txt) txt.textContent = state.reverbDecay;
      }
      if (state.dynBoost !== undefined) {
        const el = $("#adv-dyn-boost");
        if (el) el.value = state.dynBoost;
        const txt = $("#txt-dyn-boost");
        if (txt) txt.textContent = state.dynBoost + "%";
      }
      if (state.dynLimit !== undefined) {
        const el = $("#adv-dyn-limit");
        if (el) el.value = state.dynLimit;
        const txt = $("#txt-dyn-limit");
        if (txt) txt.textContent = state.dynLimit + "%";
      }
      if (state.startupVol && $("#sel-startup-vol")) $("#sel-startup-vol").value = state.startupVol;
      if (state.latencyHint && $("#sel-latency")) $("#sel-latency").value = state.latencyHint;
      if (state.sampleRate && $("#sel-sample-rate")) $("#sel-sample-rate").value = state.sampleRate;
      if (state.currentSampleRate) this.updateActiveSampleRate(state.currentSampleRate);
      if (state.showStats !== undefined && $("#chk-show-stats")) {
        $("#chk-show-stats").checked = state.showStats;
      }
    } catch (err) {
      console.warn("[SettingsModal] setValues warning:", err);
    }
  }

  updateActiveSampleRate(sr) {
    const el = $("#txt-active-sr");
    if (el) el.textContent = sr ? `[${sr}Hz]` : "";
  }
}
