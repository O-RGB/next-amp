export const REMOTE_UI = {
  css: `
@import url("https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@400;600&display=swap");
@import url("https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/bold/style.css");
@import url("https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/regular/style.css");

:root {
  --theme-window: #000080;
  --theme-text: #00ff00;
  --theme-text-sec: #ffcc00;
  --eq-col-1: #00ff00;
  --eq-col-2: #ffff00;
  --eq-col-3: #ff0000;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

body {
  background: #111;
  color: #e0e0e0;
  font-family: "Chakra Petch", "Inter", sans-serif;
  margin: 0;
  padding: 12px 10px 36px;
  min-height: 100vh;
  user-select: none;
  -webkit-user-select: none;
}

.remote-app {
  max-width: 440px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* AUTHENTIC WIN98 RETRO 3D BORDERS */
.win-border-out {
  background: #292929;
  border-top: 2px solid #888;
  border-left: 2px solid #888;
  border-right: 2px solid #000;
  border-bottom: 2px solid #000;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.win-border-in {
  border: 1px solid #444;
  border-right: 1px solid #777;
  border-bottom: 1px solid #777;
  box-shadow: inset 1px 1px 0 #000;
  background: #181818;
}

.theme-bar {
  background: linear-gradient(90deg, #000080 0%, #1044a0 100%);
  color: white;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 34px;
  transition: background 0.2s ease, color 0.2s ease;
}

.theme-bar.theme-bar-off {
  background: linear-gradient(90deg, #3a3a3a 0%, #4a4a4a 100%) !important;
  color: #888888 !important;
}

/* DISABLED / OFF PANEL STATES */
.panel-disabled {
  opacity: 0.28 !important;
  pointer-events: none !important;
  filter: grayscale(0.85);
  transition: opacity 0.2s ease, filter 0.2s ease;
}

/* BUTTONS */
.win-btn {
  background-color: #c0c0c0;
  color: #000;
  border-top: 2px solid #fff;
  border-left: 2px solid #fff;
  border-right: 2px solid #000;
  border-bottom: 2px solid #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  font-family: "Chakra Petch", sans-serif;
  font-weight: bold;
  font-size: 12px;
  line-height: 1;
  height: 34px;
  padding: 0 10px;
  border-radius: 2px;
  touch-action: manipulation;
  transition: transform 0.05s ease, background-color 0.1s ease;
}

.win-btn-sm {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  gap: 4px;
}

.win-btn:active,
.win-btn.pressed {
  border-top: 2px solid #000;
  border-left: 2px solid #000;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  background-color: #a0a0a0;
  transform: translateY(1.5px);
}

.win-btn.active-green {
  background-color: #008833 !important;
  color: #fff !important;
  border-color: #00ff66 !important;
}

/* ACTIVE ACCENT THEMES (Zoom: Blue, Rotate: Purple) */
.win-btn.active-blue {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border-top: 2px solid #0369a1 !important;
  border-left: 2px solid #0369a1 !important;
  border-right: 2px solid #38bdf8 !important;
  border-bottom: 2px solid #38bdf8 !important;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
}

.win-btn.active-purple {
  background-color: #7e22ce !important;
  color: #ffffff !important;
  border-top: 2px solid #581c87 !important;
  border-left: 2px solid #581c87 !important;
  border-right: 2px solid #c084fc !important;
  border-bottom: 2px solid #c084fc !important;
  box-shadow: 0 0 10px rgba(192, 132, 252, 0.5);
}

.btn-rotate-action:active {
  background-color: #7e22ce !important;
  color: #ffffff !important;
  border-color: #c084fc !important;
}

.theme-text-main {
  color: var(--theme-text);
  text-shadow: 0 0 4px rgba(0, 255, 0, 0.4);
}

.theme-text-sec {
  color: var(--theme-text-sec);
  text-shadow: 0 0 4px rgba(255, 204, 0, 0.4);
}

/* SLIDERS */
.slider-wrap {
  width: 100%;
  margin-top: 6px;
  margin-bottom: 4px;
}

input[type="range"].h-slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  height: 28px;
  width: 100%;
  margin: 0;
  cursor: pointer;
  touch-action: manipulation;
}

input[type="range"].h-slider:focus {
  outline: none;
}

input[type="range"].h-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 9px;
  background: #000;
  border: 1px solid #333;
  border-bottom: 1px solid #555;
  border-radius: 3px;
}

input[type="range"].h-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 26px;
  width: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #c0c0c0 100%);
  border-top: 2px solid #fff;
  border-left: 2px solid #fff;
  border-right: 2px solid #000;
  border-bottom: 2px solid #000;
  cursor: pointer;
  margin-top: -9px;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
}

input[type="range"].h-slider:active::-webkit-slider-thumb {
  background: #00ff00;
  border-color: #008800;
  box-shadow: 0 0 8px #00ff00;
}

/* 10-BAND EQ (AUTO-FIT NO SCROLL) */
.eq-scroll-wrapper {
  overflow: hidden;
  width: 100%;
  padding: 4px 0 2px;
}

#eq-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 6px 3px 4px;
  height: 140px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: #050505;
  border: 1px solid #000;
  border-right: 1px solid #444;
  border-bottom: 1px solid #444;
  gap: 1px;
}

.eq-col {
  position: relative;
  height: 100%;
  flex: 1 1 0;
  min-width: 0;
  width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.eq-bar-wrapper {
  width: 6px;
  max-width: 8px;
  flex: 1;
  position: relative;
  margin: 0 auto;
  border-radius: 1px;
  background: linear-gradient(
    to top,
    var(--eq-col-1) 0%,
    var(--eq-col-2) 50%,
    var(--eq-col-3) 100%
  );
}

.eq-bar-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: #222;
  pointer-events: none;
  transition: height 0.05s linear;
  border-radius: 1px 1px 0 0;
  z-index: 10;
}

.eq-thumb {
  height: 10px;
  width: 16px;
  max-width: 90%;
  background: #c0c0c0;
  border-top: 1.5px solid #fff;
  border-left: 1.5px solid #fff;
  border-right: 1.5px solid #000;
  border-bottom: 1.5px solid #000;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 40;
  margin-bottom: -5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.eq-label {
  font-family: "Chakra Petch", sans-serif;
  font-size: 8px;
  color: #888;
  text-align: center;
  width: 100%;
  margin-top: 4px;
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.3px;
}

.eq-val-badge {
  font-size: 8px;
  font-family: monospace;
  color: #ffcc00;
  margin-bottom: 2px;
  letter-spacing: -0.3px;
  white-space: nowrap;
}

input[type="range"].v-input {
  -webkit-appearance: none;
  appearance: none;
  writing-mode: vertical-lr;
  direction: rtl;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  margin: 0;
  z-index: 50;
  cursor: pointer;
  touch-action: pan-y;
}

/* RECONNECT NOTIFICATION */
#recon-bar {
  display: none;
  padding: 8px 12px;
  background: #332200;
  border: 1.5px solid #ffaa00;
  color: #ffcc00;
  font-size: 12px;
  font-weight: bold;
  align-items: center;
  justify-content: space-between;
  border-radius: 2px;
}

/* RETRO VCR TIMECODE DISPLAY */
.delay-display-box {
  background: #070a07;
  border: 2px solid #000;
  border-right: 1px solid #444;
  border-bottom: 1px solid #444;
  padding: 6px 12px;
  border-radius: 2px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.9);
}

.delay-digits {
  color: #ffcc00;
  font-family: Consolas, "Courier New", monospace;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
}

/* VIDEO 2-COLUMN GRID */
.video-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 360px) {
  .video-grid {
    grid-template-columns: 1fr;
  }
}

/* FLEX & SPACING UTILITIES */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.justify-between { justify-content: space-between; }
.items-center { align-items: center; }
.flex-1 { flex: 1; }
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
.gap-1 { gap: 6px; }
.gap-1-5 { gap: 8px; }
.gap-2 { gap: 10px; }
.gap-3 { gap: 14px; }
.p-2 { padding: 10px; }
.p-2-5 { padding: 11px; }
.p-3 { padding: 12px; }
.w-full { width: 100%; }
.font-pixel { font-family: "Chakra Petch", monospace; }

.section-label {
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 5px;
}

.sub-header-label {
  font-size: 9px;
  color: #888;
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.dot-ind {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #555;
  margin-left: 2px;
}

select {
  background: #000;
  color: #00ff00;
  border: 1.5px solid #555;
  padding: 3px 8px;
  font-family: "Chakra Petch", monospace;
  font-size: 11px;
  height: 26px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
`,

  html: `
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<div class="remote-app">
  <!-- RECONNECT BANNER -->
  <div id="recon-bar" class="win-border-out">
    <span id="recon-msg" class="flex items-center gap-2">
      <i class="ph-bold ph-warning text-yellow-400"></i> Link dropped. Reconnecting...
    </span>
    <button class="win-btn win-btn-sm" style="background:#ffaa00;color:#000;font-weight:bold" onclick="manualReconnect()">
      <i class="ph-bold ph-arrow-clockwise"></i> RETRY
    </button>
  </div>

  <!-- BLOCK 1: AUDIO MASTER -->
  <div class="win-border-out" id="block-audio">
    <div id="bar-audio" class="theme-bar">
      <div class="flex items-center gap-2">
        <button id="btn-toggle-audio" class="win-btn win-btn-sm pressed" style="min-width:48px">ON</button>
        <div class="flex items-center gap-1.5">
          <i class="ph-bold ph-speaker-high"></i>
          <span>MASTER AUDIO</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span id="txt-ping" class="flex items-center gap-1" style="font-family:monospace;color:#80d0ff;font-size:11px">
          <i class="ph-bold ph-wifi-high"></i> --ms
        </span>
        <button id="badge-status" class="win-btn win-btn-sm active-green" onclick="handleBadgeClick()">ONLINE</button>
      </div>
    </div>

    <div id="body-audio" class="p-2 flex flex-col gap-2" style="background:#222">
      <!-- Volume & Balance Card -->
      <div class="win-border-in p-3 flex flex-col gap-3" style="background:#181818">
        <!-- Master Volume -->
        <div class="flex flex-col">
          <div class="flex justify-between items-center font-pixel theme-text-main" style="margin-bottom:4px">
            <div class="flex items-center gap-2">
              <span class="section-label"><i class="ph-bold ph-speaker-high"></i> VOL</span>
              <button id="btn-normalize" class="win-btn win-btn-sm">
                <i class="ph-bold ph-wave-sawtooth"></i>
                <span>DYN</span>
                <span id="norm-indicator" class="dot-ind"></span>
              </button>
              <button id="btn-mute" class="win-btn win-btn-sm">
                <i class="ph-bold ph-speaker-slash"></i>
                <span id="txt-mute-label">MUTE</span>
              </button>
            </div>
            <span id="txt-vol" style="font-size:15px;font-family:monospace;font-weight:bold">100%</span>
          </div>
          <div class="slider-wrap">
            <input type="range" id="main-vol" min="0" max="1" step="0.02" value="1.0" class="h-slider" />
          </div>
        </div>

        <!-- Stereo Balance -->
        <div class="flex flex-col" style="border-top:1px solid #333; padding-top:10px">
          <div class="flex justify-between items-center font-pixel theme-text-sec" style="margin-bottom:4px">
            <span class="section-label"><i class="ph-bold ph-arrows-left-right"></i> BAL</span>
            <span id="txt-pan" style="font-size:14px;font-family:monospace;font-weight:bold">CENTER</span>
          </div>
          <div class="slider-wrap">
            <input type="range" id="main-pan" min="-1" max="1" step="0.1" value="0" class="h-slider" />
          </div>
        </div>
      </div>

      <!-- Pitch & Verb Card -->
      <div class="win-border-in p-3 flex flex-col gap-3" style="background:#181818">
        <!-- Pitch Shifter -->
        <div class="flex flex-col">
          <div class="flex justify-between items-center font-pixel" style="color:#bbb; margin-bottom:4px">
            <span class="section-label"><i class="ph-bold ph-music-notes"></i> PITCH</span>
            <span id="txt-pitch" class="theme-text-sec" style="font-size:14px;font-family:monospace;font-weight:bold">0 ST (Normal)</span>
          </div>
          <div class="slider-wrap">
            <input type="range" id="main-pitch" min="-12" max="12" step="1" value="0" class="h-slider" />
          </div>
        </div>

        <!-- Reverb -->
        <div class="flex flex-col" style="border-top:1px solid #333; padding-top:10px">
          <div class="flex justify-between items-center font-pixel" style="color:#bbb; margin-bottom:4px">
            <span class="section-label"><i class="ph-bold ph-waveform"></i> REVERB</span>
            <span id="txt-verb" class="theme-text-main" style="font-size:14px;font-family:monospace;font-weight:bold">0.0s</span>
          </div>
          <div class="slider-wrap">
            <input type="range" id="main-verb" min="0" max="2" step="0.1" value="0" class="h-slider" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- BLOCK 2: EQUALIZER (10 BANDS) -->
  <div class="win-border-out" id="block-eq">
    <div id="bar-eq" class="theme-bar">
      <div class="flex items-center gap-2">
        <button id="btn-eq-toggle" class="win-btn win-btn-sm pressed" style="min-width:48px">ON</button>
        <div class="flex items-center gap-1.5">
          <i class="ph-bold ph-sliders-horizontal"></i>
          <span>EQUALIZER</span>
        </div>
      </div>
      <select id="eq-preset" onchange="onPresetChange(this.value)">
        <option value="flat">FLAT</option>
        <option value="bass">BASS</option>
        <option value="rock">ROCK</option>
        <option value="pop">POP</option>
        <option value="voice">VOICE</option>
        <option value="custom">USER</option>
      </select>
    </div>

    <div id="body-eq" class="p-2 flex flex-col" style="background:#222">
      <div class="eq-scroll-wrapper">
        <div id="eq-container" class="win-border-in">
          <!-- 10 Vertical Bands -->
        </div>
      </div>
    </div>
  </div>

  <!-- BLOCK: AI VOCAL / KARAOKE -->
  <div class="win-border-out" id="block-vocal">
    <div id="bar-vocal" class="theme-bar">
      <div class="flex items-center gap-2">
        <button id="btn-toggle-vocal" class="win-btn win-btn-sm" style="min-width:48px">ON</button>
        <div class="flex items-center gap-1.5">
          <i class="ph-bold ph-microphone-stage"></i>
          <span>AI VOCAL</span>
        </div>
      </div>
      <span id="txt-vocal-status" style="font-family:monospace;font-size:12px;color:#ffff00;font-weight:bold">ORIGINAL</span>
    </div>

    <div id="body-vocal" class="p-2 flex flex-col gap-2" style="background:#222">
      <div class="win-border-in p-3 flex flex-col gap-3" style="background:#181818">
        <!-- Separation Modes -->
        <div class="flex flex-col">
          <div class="flex justify-between items-center font-pixel" style="color:#bbb;margin-bottom:6px">
            <span class="section-label"><i class="ph-bold ph-waveform"></i> SEPARATION MODE</span>
          </div>
          <div class="grid grid-cols-3 gap-1-5">
            <button id="btn-vocal-bypass" class="win-btn win-btn-sm pressed">ORIG</button>
            <button id="btn-vocal-karaoke" class="win-btn win-btn-sm">KARAOKE</button>
            <button id="btn-vocal-acapella" class="win-btn win-btn-sm">ACAPELLA</button>
          </div>
        </div>

        <!-- Diff Level 1-4 -->
        <div class="flex flex-col" style="border-top:1px solid #333;padding-top:10px">
          <div class="flex justify-between items-center font-pixel" style="color:#bbb;margin-bottom:6px">
            <span class="section-label"><i class="ph-bold ph-gauge"></i> DIFF LEVEL</span>
            <span id="txt-diff-desc" style="font-size:12px;font-family:monospace;color:#80d0ff;font-weight:bold">2: STD (1.0x)</span>
          </div>
          <div class="grid grid-cols-4 gap-1">
            <button class="win-btn win-btn-sm btn-remote-diff" data-level="1">1: SOFT</button>
            <button class="win-btn win-btn-sm btn-remote-diff pressed" data-level="2">2: STD</button>
            <button class="win-btn win-btn-sm btn-remote-diff" data-level="3">3: DEEP</button>
            <button class="win-btn win-btn-sm btn-remote-diff" data-level="4">4: ULTRA</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- BLOCK 3: VIDEO & BLUETOOTH SYNC -->
  <div class="win-border-out" id="block-video">
    <div id="bar-video" class="theme-bar">
      <div class="flex items-center gap-2">
        <button id="btn-toggle-video" class="win-btn win-btn-sm pressed" style="min-width:48px">ON</button>
        <div class="flex items-center gap-1.5">
          <i class="ph-bold ph-monitor-play"></i>
          <span>VIDEO & SYNC</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <select id="video-quality" onchange="setQual(this.value)">
          <option value="max">ORIGINAL (MAX)</option>
          <option value="high">1080P HD</option>
          <option value="mid">720P HD</option>
          <option value="low">320P SAVER</option>
        </select>
        <button class="win-btn win-btn-sm" style="color:#f87171" title="Reset Video Settings" onclick="resetVideoFull()">
          <i class="ph-bold ph-arrow-counter-clockwise"></i>
        </button>
      </div>
    </div>

    <div id="body-video" class="p-2 flex flex-col gap-2.5" style="background:#222">
      <!-- 1. BT Audio Delay (Precision Timecode Form Factor) -->
      <div class="win-border-in p-3 flex flex-col gap-2" style="background:#181818">
        <div class="flex justify-between items-center font-pixel">
          <span class="section-label" style="color:#ffcc00">
            <i class="ph-bold ph-clock-countdown"></i> BT AUDIO DELAY
          </span>
          <span style="font-size:9px; color:#777; font-family:monospace; letter-spacing:0.5px">LIP-SYNC TIMECODE</span>
        </div>

        <!-- Retro VCR-style Digital Timecode Readout -->
        <div class="delay-display-box flex items-center justify-between">
          <span class="sub-header-label" style="color:#888">OFFSET</span>
          <div id="txt-video-delay" class="delay-digits">0.00s</div>
        </div>

        <div class="slider-wrap" style="margin:2px 0 4px">
          <input type="range" id="video-delay" min="0" max="5.0" step="0.05" value="0" class="h-slider" />
        </div>

        <!-- Step nudge buttons -->
        <div class="flex justify-between gap-1 items-center">
          <button class="win-btn win-btn-sm flex-1" onclick="nudgeDelay(-0.05)">-0.05s</button>
          <button class="win-btn win-btn-sm flex-1" onclick="nudgeDelay(-0.01)">-0.01s</button>
          <button class="win-btn win-btn-sm flex-1 text-green-400" onclick="resetDelay()">
            <i class="ph-bold ph-arrow-counter-clockwise"></i> 0s
          </button>
          <button class="win-btn win-btn-sm flex-1" onclick="nudgeDelay(0.01)">+0.01s</button>
          <button class="win-btn win-btn-sm flex-1" onclick="nudgeDelay(0.05)">+0.05s</button>
        </div>
      </div>

      <!-- 2 & 3. Split 2-Column Grid: ZOOM (Screen framing) vs ROTATION (Quadrant Switch) -->
      <div class="video-grid">
        <!-- LEFT: ZOOM & RATIO -->
        <div class="win-border-in p-3 flex flex-col justify-between gap-3" style="background:#181818">
          <div class="flex justify-between items-center font-pixel">
            <span class="section-label" style="color:#38bdf8">
              <i class="ph-bold ph-magnifying-glass-plus"></i> ZOOM
            </span>
            <span id="txt-video-zoom" class="font-pixel" style="color:#38bdf8;font-size:14px;font-weight:bold">100%</span>
          </div>

          <!-- Aspect Ratio Presets -->
          <div class="flex flex-col gap-1.5">
            <span class="sub-header-label" style="color:#7dd3fc">ASPECT RATIO</span>
            <div class="flex gap-1.5">
              <button id="btn-zoom-1" class="win-btn win-btn-sm flex-1 pressed active-blue" onclick="setZoom(1.0)">
                <i class="ph-bold ph-frame-corners"></i> 1:1
              </button>
              <button id="btn-zoom-wide" class="win-btn win-btn-sm flex-1" onclick="setZoom(1.35)">
                <i class="ph-bold ph-corners-out"></i> 21:9
              </button>
              <button id="btn-zoom-fill" class="win-btn win-btn-sm flex-1" onclick="setZoom(1.7)">
                <i class="ph-bold ph-arrows-out"></i> FILL
              </button>
            </div>
          </div>

          <!-- Magnification Slider -->
          <div class="flex flex-col gap-1.5" style="border-top:1px solid #333; padding-top:10px; margin-top:2px">
            <span class="sub-header-label" style="color:#7dd3fc">MAGNIFY</span>
            <div class="slider-wrap" style="margin:4px 0 2px 0">
              <input type="range" id="video-zoom" min="1" max="3" step="0.05" value="1" class="h-slider" />
            </div>
          </div>
        </div>

        <!-- RIGHT: ROTATION & ORIENTATION -->
        <div class="win-border-in p-3 flex flex-col justify-between gap-3" style="background:#181818">
          <div class="flex justify-between items-center font-pixel">
            <span class="section-label" style="color:#c084fc">
              <i class="ph-bold ph-arrows-clockwise"></i> ROTATION
            </span>
            <span id="txt-video-rotate" class="font-pixel" style="color:#c084fc;font-size:14px;font-weight:bold">0°</span>
          </div>

          <!-- Big Direct Rotate Action -->
          <button class="win-btn flex items-center justify-center gap-2 w-full btn-rotate-action" style="height:34px" onclick="rotateVideo()">
            <i class="ph-bold ph-arrow-clockwise" style="font-size:15px"></i>
            <span>ROTATE +90°</span>
          </button>

          <!-- 4-Quadrant Angle Selector Pads in 2x2 Grid -->
          <div class="flex flex-col gap-1.5" style="border-top:1px solid #333; padding-top:10px; margin-top:2px">
            <span class="sub-header-label" style="color:#e9d5ff">ANGLE PRESET</span>
            <div class="grid grid-cols-2 gap-1.5">
              <button id="btn-rot-0" class="win-btn win-btn-sm pressed active-purple" onclick="rotateTo(0)">0° Normal</button>
              <button id="btn-rot-90" class="win-btn win-btn-sm" onclick="rotateTo(90)">90° Right</button>
              <button id="btn-rot-270" class="win-btn win-btn-sm" onclick="rotateTo(270)">270° Left</button>
              <button id="btn-rot-180" class="win-btn win-btn-sm" onclick="rotateTo(180)">180° Flip</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`,

  js: `
// Dynamically ensure Phosphor web font stylesheet is injected
if (!document.getElementById("ph-icons")) {
  const link = document.createElement("link");
  link.id = "ph-icons";
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/bold/style.css";
  document.head.appendChild(link);
}

const G = id => document.getElementById(id);
let state = Object.assign({}, initState || {});
let isProg = false;
let currentConn = conn;
let pingInterval = null;
let reconTimer = null;
let lastPong = Date.now();

function vib(ms = 15) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

function snd(key, value, index = null) {
  if (isProg) return;
  if (key === "eq" && index !== null) {
    if (!state.eq || !Array.isArray(state.eq)) state.eq = new Array(10).fill(0);
    state.eq[index] = value;
    updateBandView(index, value);
  } else {
    state[key] = value;
    syncView(key, value, index);
  }
  if (currentConn && currentConn.open) {
    currentConn.send({ type: "SET_PARAM", key, value, index });
  }
}

// 10-BAND EQ FREQUENCIES
const FREQS = ["32","64","125","250","500","1k","2k","4k","8k","16k"];
function setupEqBands() {
  const container = G("eq-container");
  if (!container) return;
  container.innerHTML = "";
  FREQS.forEach((freq, idx) => {
    const col = document.createElement("div");
    col.className = "eq-col";
    col.innerHTML = \`
      <span class="eq-val-badge" id="t-eq-\${idx}">0dB</span>
      <div class="eq-bar-wrapper">
        <div class="eq-bar-mask" id="eq-mask-\${idx}" style="height:50%"></div>
        <div class="eq-thumb" id="eq-thumb-\${idx}" style="top:calc(50% - 6px)"></div>
      </div>
      <span class="eq-label">\${freq}</span>
      <input type="range" class="v-input" id="eq-input-\${idx}" min="-12" max="12" step="0.5" value="0">
    \`;
    container.appendChild(col);

    col.querySelector("input").oninput = function() {
      const val = +this.value;
      updateBandView(idx, val);
      if (!state.eq || !Array.isArray(state.eq)) state.eq = new Array(10).fill(0);
      state.eq[idx] = val;
      state.eqPreset = "custom";
      if (G("eq-preset")) G("eq-preset").value = "custom";
      snd("eq", val, idx);
    };
  });
}

function updateBandView(idx, val) {
  const mask = G("eq-mask-" + idx);
  const thumb = G("eq-thumb-" + idx);
  const badge = G("t-eq-" + idx);
  const inp = G("eq-input-" + idx);
  if (inp) inp.value = val;
  // -12 to +12 dB -> percent 0% to 100%
  const pct = Math.max(0, Math.min(100, ((val + 12) / 24) * 100));
  const maskHeight = 100 - pct;
  if (mask) mask.style.height = maskHeight + "%";
  if (thumb) thumb.style.top = "calc(" + maskHeight + "% - 6px)";
  if (badge) badge.textContent = (val > 0 ? "+" : "") + Math.round(val) + "dB";
}

setupEqBands();

// PITCH NOTE STRINGS
const PITCH_LABELS = [
  "-12 (C)","-11 (C#)","-10 (D)","-9 (Eb)","-8 (E)","-7 (F)","-6 (F#)","-5 (G)","-4 (G#)","-3 (A)","-2 (Bb)","-1 (B)",
  "0 ST (Normal)",
  "+1 (C#)","+2 (D)","+3 (Eb)","+4 (E)","+5 (F)","+6 (F#)","+7 (G)","+8 (G#)","+9 (A)","+10 (Bb)","+11 (B)","+12 (C)"
];

function syncView(k, v, index = null) {
  if (k === "volume") {
    G("main-vol").value = v;
    G("txt-vol").textContent = Math.round(v * 100) + "%";
  } else if (k === "pan") {
    G("main-pan").value = v;
    G("txt-pan").textContent = v === 0 ? "CENTER" : v > 0 ? "R " + Math.round(v * 100) + "%" : "L " + Math.round(Math.abs(v) * 100) + "%";
  } else if (k === "pitch") {
    G("main-pitch").value = v;
    G("txt-pitch").textContent = PITCH_LABELS[v + 12] || (v + " ST");
  } else if (k === "reverb") {
    G("main-verb").value = v;
    G("txt-verb").textContent = (+v).toFixed(1) + "s";
  } else if (k === "videoDelay") {
    G("video-delay").value = v;
    G("txt-video-delay").textContent = (+v).toFixed(2) + "s";
  } else if (k === "videoZoom") {
    G("video-zoom").value = v;
    G("txt-video-zoom").textContent = Math.round(v * 100) + "%";
    const is1 = Math.abs(v - 1.0) < 0.04;
    const isWide = Math.abs(v - 1.35) < 0.04;
    const isFill = Math.abs(v - 1.7) < 0.04;
    if (G("btn-zoom-1")) {
      G("btn-zoom-1").classList.toggle("pressed", is1);
      G("btn-zoom-1").classList.toggle("active-blue", is1);
    }
    if (G("btn-zoom-wide")) {
      G("btn-zoom-wide").classList.toggle("pressed", isWide);
      G("btn-zoom-wide").classList.toggle("active-blue", isWide);
    }
    if (G("btn-zoom-fill")) {
      G("btn-zoom-fill").classList.toggle("pressed", isFill);
      G("btn-zoom-fill").classList.toggle("active-blue", isFill);
    }
  } else if (k === "videoRotate") {
    const deg = ((Math.round(v) % 360) + 360) % 360;
    G("txt-video-rotate").textContent = deg + "°";
    [0, 90, 180, 270].forEach(d => {
      const btn = G("btn-rot-" + d);
      if (btn) {
        const isMatch = Math.abs(deg - d) < 5;
        btn.classList.toggle("pressed", isMatch);
        btn.classList.toggle("active-purple", isMatch);
      }
    });
  } else if (k === "videoQuality") {
    G("video-quality").value = v;
  } else if (k === "isAudioMasterOn") {
    const on = !!v;
    const btn = G("btn-toggle-audio");
    if (btn) {
      btn.className = "win-btn win-btn-sm" + (on ? " pressed active-green" : "");
      btn.textContent = on ? "ON" : "OFF";
    }
    const bar = G("bar-audio");
    if (bar) bar.classList.toggle("theme-bar-off", !on);
    const muteBtn = G("btn-mute");
    if (muteBtn) {
      muteBtn.className = "win-btn win-btn-sm" + (on ? "" : " pressed");
      const mLabel = G("txt-mute-label");
      if (mLabel) mLabel.textContent = on ? "MUTE" : "MUTED";
    }
    const bodyA = G("body-audio");
    if (bodyA) bodyA.classList.toggle("panel-disabled", !on);
    updateEqState();
  } else if (k === "isVideoMasterOn") {
    const on = !!v;
    const btn = G("btn-toggle-video");
    if (btn) {
      btn.className = "win-btn win-btn-sm" + (on ? " pressed active-green" : "");
      btn.textContent = on ? "ON" : "OFF";
    }
    const bar = G("bar-video");
    if (bar) bar.classList.toggle("theme-bar-off", !on);
    const bodyV = G("body-video");
    if (bodyV) bodyV.classList.toggle("panel-disabled", !on);
    if (G("video-quality")) G("video-quality").disabled = !on;
  } else if (k === "isEqOn") {
    const on = !!v;
    const btn = G("btn-eq-toggle");
    if (btn) {
      btn.className = "win-btn win-btn-sm" + (on ? " pressed active-green" : "");
      btn.textContent = on ? "ON" : "OFF";
    }
    const bar = G("bar-eq");
    if (bar) bar.classList.toggle("theme-bar-off", !on);
    updateEqState();
  } else if (k === "normalize") {
    const ind = G("norm-indicator");
    if (ind) ind.style.background = v ? "#00ff00" : "#555";
  } else if (k === "eq") {
    if (index !== null) {
      updateBandView(index, v);
    } else if (Array.isArray(v)) {
      v.forEach((val, i) => updateBandView(i, val));
    }
  } else if (k === "eqPreset") {
    if (G("eq-preset")) G("eq-preset").value = v;
  } else if (k === "vocalMode") {
    const mode = v || "bypass";
    const btnBypass = G("btn-vocal-bypass");
    const btnKaraoke = G("btn-vocal-karaoke");
    const btnAcapella = G("btn-vocal-acapella");
    const btnToggle = G("btn-toggle-vocal");
    const txtStatus = G("txt-vocal-status");

    [btnBypass, btnKaraoke, btnAcapella].forEach((b) => b && b.classList.remove("pressed"));
    const on = (mode !== "bypass");
    const bar = G("bar-vocal");
    const bodyV = G("body-vocal");

    if (mode === "karaoke") {
      if (btnKaraoke) btnKaraoke.classList.add("pressed");
      if (txtStatus) txtStatus.textContent = "KARAOKE (CUT)";
    } else if (mode === "acapella") {
      if (btnAcapella) btnAcapella.classList.add("pressed");
      if (txtStatus) txtStatus.textContent = "ACAPELLA (ISO)";
    } else {
      if (btnBypass) btnBypass.classList.add("pressed");
      if (txtStatus) txtStatus.textContent = "ORIGINAL";
    }

    if (btnToggle) {
      btnToggle.className = "win-btn win-btn-sm" + (on ? " pressed active-green" : "");
      btnToggle.textContent = on ? "ON" : "OFF";
    }
    if (bar) bar.classList.toggle("theme-bar-off", !on);
    if (bodyV) bodyV.classList.toggle("panel-disabled", !on);
  } else if (k === "vocalDiff") {
    const lvl = Number(v) || 2;
    const descs = {
      1: "1: SOFT (0.8x)",
      2: "2: STD (1.0x)",
      3: "3: DEEP (1.3x)",
      4: "4: ULTRA (1.6x)"
    };
    if (G("txt-diff-desc")) G("txt-diff-desc").textContent = descs[lvl] || "2: STD (1.0x)";
    document.querySelectorAll(".btn-remote-diff").forEach((b) => {
      if (Number(b.dataset.level) === lvl) {
        b.classList.add("pressed");
      } else {
        b.classList.remove("pressed");
      }
    });
  }
}

function updateEqState() {
  const eqOn = !!(state.isEqOn ?? true);
  const audioOn = !!(state.isAudioMasterOn ?? true);
  const active = eqOn && audioOn;
  const bodyE = G("body-eq");
  if (bodyE) bodyE.classList.toggle("panel-disabled", !active);
  if (G("eq-preset")) G("eq-preset").disabled = !active;
}

function applyFull(s) {
  isProg = true;
  for (let k in s) syncView(k, s[k]);
  isProg = false;
}

// BIND CONTROLS
G("main-vol").oninput = function() { snd("volume", +this.value); };
G("main-pan").oninput = function() { snd("pan", +this.value); };
G("main-pitch").oninput = function() { snd("pitch", +this.value); };
G("main-verb").oninput = function() { snd("reverb", +this.value); };
G("video-delay").oninput = function() { snd("videoDelay", +this.value); };
G("video-zoom").oninput = function() { snd("videoZoom", +this.value); };

G("btn-toggle-audio").onclick = function() {
  vib(18);
  snd("isAudioMasterOn", !(state.isAudioMasterOn ?? true));
};
G("btn-toggle-video").onclick = function() {
  vib(18);
  snd("isVideoMasterOn", !(state.isVideoMasterOn ?? true));
};
G("btn-eq-toggle").onclick = function() {
  vib(18);
  snd("isEqOn", !(state.isEqOn ?? true));
};
G("btn-mute").onclick = function() {
  vib(18);
  snd("isAudioMasterOn", !(state.isAudioMasterOn ?? true));
};
G("btn-normalize").onclick = function() {
  vib(18);
  snd("normalize", !(state.normalize ?? false));
};

if (G("btn-toggle-vocal")) {
  G("btn-toggle-vocal").onclick = function() {
    vib(18);
    const isPressed = this.classList.contains("pressed");
    const next = isPressed ? "bypass" : "karaoke";
    snd("vocalMode", next);
  };
}
if (G("btn-vocal-bypass")) {
  G("btn-vocal-bypass").onclick = function() {
    vib(15);
    snd("vocalMode", "bypass");
  };
}
if (G("btn-vocal-karaoke")) {
  G("btn-vocal-karaoke").onclick = function() {
    vib(15);
    snd("vocalMode", "karaoke");
  };
}
if (G("btn-vocal-acapella")) {
  G("btn-vocal-acapella").onclick = function() {
    vib(15);
    snd("vocalMode", "acapella");
  };
}
document.querySelectorAll(".btn-remote-diff").forEach((b) => {
  b.onclick = function() {
    vib(15);
    const lvl = Number(this.dataset.level) || 2;
    snd("vocalDiff", lvl);
  };
});

window.setVol = v => { vib(12); snd("volume", v); };
window.setPan = v => { vib(12); snd("pan", v); };
window.setZoom = z => { vib(12); snd("videoZoom", z); };
window.rotateTo = deg => { vib(15); snd("videoRotate", deg); };

window.nudgeDelay = d => {
  vib(15);
  const cur = state.videoDelay || 0;
  snd("videoDelay", Math.max(0, Math.min(5, Math.round((cur + d) * 100) / 100)));
};
window.resetDelay = () => { vib(20); snd("videoDelay", 0); };
window.setQual = q => { vib(12); snd("videoQuality", q); };

const ROTS = [0, 90, 180, 270];
window.rotateVideo = () => {
  vib(18);
  const cur = state.videoRotate || 0;
  const next = ROTS[(ROTS.indexOf(cur) + 1) % 4];
  snd("videoRotate", next);
};
window.resetVideoFull = () => {
  vib(20);
  snd("videoZoom", 1);
  snd("videoRotate", 0);
  snd("videoDelay", 0);
};

const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  pop: [2, 1, 3, 2, 1, 0, 1, 2, 2, 1],
  voice: [-2, -1, 0, 2, 4, 4, 3, 1, 0, 0]
};

window.onPresetChange = function(name) {
  vib(18);
  const p = PRESETS[name];
  if (!p) return;
  state.eq = [...p];
  state.eqPreset = name;
  if (G("eq-preset")) G("eq-preset").value = name;
  
  p.forEach((val, idx) => {
    updateBandView(idx, val);
  });

  if (currentConn && currentConn.open) {
    p.forEach((val, idx) => {
      currentConn.send({ type: "SET_PARAM", key: "eq", value: val, index: idx });
    });
    currentConn.send({ type: "SET_PARAM", key: "eqPreset", value: name, index: null });
  }
};

// HEARTBEAT & HEALTH WATCHDOG
let isReconnecting = false;

function stopHeartbeat() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function clearReconTimer() {
  if (reconTimer) {
    clearInterval(reconTimer);
    reconTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  lastPong = Date.now();
  pingInterval = setInterval(() => {
    if (currentConn && currentConn.open) {
      currentConn.send({ type: "PING", ts: Date.now() });
      if (Date.now() - lastPong > 8000) {
        onConnDown("Heartbeat timeout");
      }
    } else {
      onConnDown("Channel closed");
    }
  }, 3500);
}

function onConnDown(reason) {
  stopHeartbeat();
  setOnlineBadge(false);
  showReconBar(true);
  scheduleAutoReconnect();
}

function setOnlineBadge(online) {
  const b = G("badge-status");
  const txt = G("txt-ping");
  if (!b) return;
  if (online) {
    b.className = "win-btn win-btn-sm active-green";
    b.textContent = "ONLINE";
  } else {
    b.className = "win-btn win-btn-sm pressed";
    b.textContent = "RETRY";
    if (txt) txt.innerHTML = '<i class="ph-bold ph-wifi-slash"></i> --ms';
  }
}

function showReconBar(show, msg = null) {
  const bar = G("recon-bar");
  if (!bar) return;
  bar.style.display = show ? "flex" : "none";
  if (msg) G("recon-msg").innerHTML = '<i class="ph-bold ph-warning"></i> ' + msg;
}

let reconCount = 0;
function scheduleAutoReconnect() {
  clearReconTimer();
  reconCount++;
  let countdown = Math.min(6, Math.max(2, reconCount * 2));
  showReconBar(true, "Link dropped. Reconnecting in " + countdown + "s...");
  
  reconTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearReconTimer();
      performReconnect();
    } else {
      showReconBar(true, "Link dropped. Reconnecting in " + countdown + "s...");
    }
  }, 1000);
}

window.handleBadgeClick = function() {
  vib(15);
  if (currentConn && currentConn.open) {
    // Already online: refresh state and ping without breaking connection
    currentConn.send({ type: "GET_STATE" });
    currentConn.send({ type: "PING", ts: Date.now() });
    const b = G("badge-status");
    if (b) {
      b.textContent = "SYNCED";
      setTimeout(() => {
        if (currentConn && currentConn.open) {
          b.textContent = "ONLINE";
        }
      }, 700);
    }
  } else {
    manualReconnect();
  }
};

window.manualReconnect = function() {
  vib(20);
  isReconnecting = false;
  clearReconTimer();
  performReconnect();
};

function performReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  clearReconTimer();
  stopHeartbeat();
  showReconBar(true, "Contacting Host...");

  // Safely detach listeners so closing old connection does not trigger onConnDown
  if (currentConn) {
    try {
      currentConn.off("close");
      currentConn.off("error");
      currentConn.off("data");
      currentConn.close();
    } catch (_) {}
    currentConn = null;
  }

  // Ensure client peer is ready
  if (peer && peer.disconnected) {
    try { peer.reconnect(); } catch (_) {}
  }

  try {
    const nextConn = peer.connect(H, { reliable: true });
    bindConnEvents(nextConn);
  } catch (e) {
    isReconnecting = false;
    scheduleAutoReconnect();
  }
}

function bindConnEvents(c) {
  currentConn = c;

  c.on("open", () => {
    isReconnecting = false;
    clearReconTimer();
    reconCount = 0;
    setOnlineBadge(true);
    showReconBar(false);
    c.send({ type: "HANDSHAKE", token: T, needUI: false });
    c.send({ type: "GET_STATE" });
    startHeartbeat();
  });

  c.on("data", data => {
    if (data.type === "PONG") {
      lastPong = Date.now();
      const ping = lastPong - (data.ts || lastPong);
      const txt = G("txt-ping");
      if (txt) txt.innerHTML = '<i class="ph-bold ph-wifi-high"></i> ' + Math.max(1, ping) + "ms";
    } else if (data.type === "SYNC_STATE") {
      state = Object.assign(state, data.state || {});
      applyFull(state);
      setOnlineBadge(true);
      showReconBar(false);
    } else if (data.type === "UPDATE_PARAM") {
      if (data.key === "eq" && data.index !== null) {
        if (!state.eq || !Array.isArray(state.eq)) state.eq = new Array(10).fill(0);
        state.eq[data.index] = data.value;
        updateBandView(data.index, data.value);
      } else if (data.key === "eqPreset") {
        state.eqPreset = data.value;
        syncView("eqPreset", data.value);
      } else {
        state[data.key] = data.value;
        syncView(data.key, data.value);
      }
    }
  });

  c.on("close", () => {
    if (c !== currentConn) return; // Ignore old connection close events
    isReconnecting = false;
    onConnDown("Closed");
  });

  c.on("error", () => {
    if (c !== currentConn) return; // Ignore old connection errors
    isReconnecting = false;
    onConnDown("Error");
  });
}

// BOOT INITIALIZATION
bindConnEvents(conn);
applyFull(state);
startHeartbeat();
if (conn && conn.open) {
  conn.send({ type: "GET_STATE" });
}
`
};
