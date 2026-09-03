// video-delay.js

class Monitor {
  constructor() {
    this.videoCallbacks = new Map();
    this.delayedVideos = new Map();
    this.delay = 0;
    this.quality = "max";
    this.enabled = true;
    this.startMonitor();
  }

  startMonitor() {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response && response.videoDelay) {
        const globalDelay = parseFloat(response.videoDelay) * 1000;
        if (globalDelay > 0) {
          this.delay = globalDelay;
          this.setupVideoListeners();
          document.querySelectorAll("video").forEach((v) => this.waitForVideoFrameRefresh(v));
        }
      } else {
        chrome.storage.local.get(["videoDelay"], (res) => {
          if (res.videoDelay) {
            const globalDelay = parseFloat(res.videoDelay) * 1000;
            if (globalDelay > 0) {
              this.delay = globalDelay;
              this.setupVideoListeners();
              document.querySelectorAll("video").forEach((v) => this.waitForVideoFrameRefresh(v));
            }
          }
        });
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SET_VIDEO_DELAY") {
        const newDelay = parseFloat(message.value) * 1000;
        const wasDisabled = this.delay <= 0;
        this.delay = newDelay;
        if (this.delay > 0) {
          if (wasDisabled) {
            this.setupVideoListeners();
            document.querySelectorAll("video").forEach((v) => this.waitForVideoFrameRefresh(v));
          } else {
            this.updateDelays();
          }
        } else {
          this.updateDelays();
        }
      } else if (message.type === "GET_VIDEO_DELAY") {
        sendResponse({ value: this.delay / 1000 });
      } else if (message.type === "SET_VIDEO_QUALITY") {
        this.quality = message.value;
        this.delayedVideos.forEach((dv) => dv.updateQuality(this.quality));
      }
      return true;
    });

    // Directly listen to storage changes from background / offscreen
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.videoDelay !== undefined) {
        const newDelay = parseFloat(changes.videoDelay.newValue || 0) * 1000;
        const wasDisabled = this.delay <= 0;
        this.delay = newDelay;
        if (this.delay > 0) {
          if (wasDisabled) {
            this.setupVideoListeners();
            document.querySelectorAll("video").forEach((v) => this.waitForVideoFrameRefresh(v));
          } else {
            this.updateDelays();
          }
        } else {
          this.updateDelays();
        }
      }
      if (changes.videoQuality !== undefined) {
        this.quality = changes.videoQuality.newValue;
        this.delayedVideos.forEach((dv) => dv.updateQuality(this.quality));
      }
    });

    this.setupVideoListeners();
  }

  updateDelays() {
    this.delayedVideos.forEach((dv) => dv.updateDelay(this.delay));
    if (this.delay <= 0) {
      this.delayedVideos.forEach((dv) => dv.destroy());
      this.delayedVideos.clear();
    }
  }

  setupVideoListeners() {
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    this.clearVideoCallbacks();
    const checkAndAttach = (video) => this.waitForVideoFrameRefresh(video);
    document.querySelectorAll("video").forEach(checkAndAttach);
    this.observer = new MutationObserver((mutations) => {
      if (this.delay <= 0) return;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === "VIDEO") checkAndAttach(node);
          else if (node.querySelectorAll) node.querySelectorAll("video").forEach(checkAndAttach);
        });
      });
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  clearVideoCallbacks() {
    this.videoCallbacks.forEach((callbackId, video) => {
      if ("cancelVideoFrameCallback" in HTMLVideoElement.prototype) {
        try { video.cancelVideoFrameCallback(callbackId); } catch {}
      }
    });
    this.videoCallbacks.clear();
  }

  waitForVideoFrameRefresh(video) {
    if (this.delay <= 0) return;
    if (
      video.closest(".video-delay-container") ||
      this.videoCallbacks.has(video) ||
      this.delayedVideos.has(video)
    ) return;
    const requestFrameCallback = () => {
      if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
        const callbackId = video.requestVideoFrameCallback(() => {
          this.videoCallbacks.delete(video);
          if (video.paused) return;
          this.delayVideo(video);
        });
        this.videoCallbacks.set(video, callbackId);
      }
    };
    requestFrameCallback();
    const onPlay = () => {
      if (!video.paused && !this.videoCallbacks.has(video) && !this.delayedVideos.has(video) && this.delay > 0) {
        requestFrameCallback();
      }
    };
    video.addEventListener("play", onPlay);
  }

  delayVideo(video) {
    if (this.delay <= 0) return;
    const dv = new DelayedVideo(video, this.delay, this.quality);
    this.delayedVideos.set(video, dv);
  }

  stopVideoDelay(video) {
    if (this.delayedVideos.has(video)) {
      this.delayedVideos.get(video).destroy();
      this.delayedVideos.delete(video);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DelayedVideo
//
// Init flow (async, safe):
//   1. Create DOM canvas elements (no rendering context yet)
//   2. Send PING to Worker → wait for READY (max 500ms)
//      ✓ Worker responded → transferControlToOffscreen() → Worker does all WebGL
//      ✗ Timeout / error  → fallback: getContext("webgl2") on intact canvas
//   3. Start capture loop (requestVideoFrameCallback)
//
// Worker path:  VideoFrame (GPU-resident) → zero-copy postMessage → Worker renders
// Fallback path: createImageBitmap → requestAnimationFrame render loop
// ─────────────────────────────────────────────────────────────────────────────

class DelayedVideo {
  constructor(video, delay, quality = "max") {
    this.video = video;
    this.delay = delay;
    this.quality = quality;

    this.isActive = true;
    this.isTabVisible = !document.hidden;
    this.lastRenderedSubtitleHash = "";

    // Fallback-path state (main-thread GL)
    this.frameQueue = [];
    this.gl = null;
    this.renderLoopId = null;

    // Worker-path state
    this.worker = null;

    this.subtitleElements = [];
    this.hiddenSubtitleElements = [];
    this.styleObserver = null;
    this._captureCallbackId = null;

    // Store bound functions once — avoids allocating a new Function object every frame
    this._boundCaptureFrame = this._captureFrame.bind(this);
    this._boundRenderLoop = this.renderLoop.bind(this);

    // Subtitle cache — updated by MutationObserver, not by DOM query every frame
    this._cachedSubtitles = [];

    this.init();
  }

  updateQuality(newQuality) {
    this.quality = newQuality;
    this.resize();
  }

  // ── Async init ──────────────────────────────────────────────────────────────

  async init() {
    // Step 1: create DOM canvas elements (no rendering context committed yet)
    this._createDOMCanvases();
    this.determineSubtitlePlayer();
    this._setupSubtitleCache(); // start watching subtitles via MutationObserver
    this.addEventListeners();

    // Step 2: try Worker with handshake
    const workerReady = await this._tryInitWorker();

    if (workerReady) {
      // Worker confirmed alive → safe to transfer canvas now
      const offscreen = this.videoCanvas.transferControlToOffscreen();
      this.worker.postMessage(
        { type: "ATTACH", canvas: offscreen, delay: this.delay },
        [offscreen]
      );
      // Switch to real message handler (handshake handler was temporary)
      this.worker.onmessage = ({ data }) => this._onWorkerMessage(data);
      this.worker.onerror = () => {
        // Worker crashed mid-session — canvas already transferred, can't recover
        if (this.isActive) this.destroy();
      };
    } else {
      // Worker unavailable → canvas is still intact, init main-thread WebGL
      this._initMainThreadGL();
      if (!this.gl) return; // WebGL not supported, destroy() already called
    }

    // Step 3: hide original video and start capturing
    setTimeout(() => {
      if (this.isActive && this.video) {
        this.video.style.setProperty("opacity", "0", "important");
      }
    }, 50);
    this.resize();
    this._scheduleCapture();
  }

  // ── DOM canvas creation (no GL context yet) ─────────────────────────────────

  _createDOMCanvases() {
    const cssText = "pointer-events: none !important; position: absolute !important; object-fit: contain !important;";
    this.videoCanvas = document.createElement("canvas");
    this.videoCanvas.style.cssText = cssText;
    this.subtitleCanvas = document.createElement("canvas");
    this.subtitleCanvas.style.cssText = cssText;
    if (this.video.parentNode) {
      this.video.parentNode.insertBefore(this.videoCanvas, this.video.nextSibling);
      this.video.parentNode.insertBefore(this.subtitleCanvas, this.videoCanvas.nextSibling);
    }
    this.subCtx = this.subtitleCanvas.getContext("2d");
  }

  // ── Worker: PING/READY handshake ────────────────────────────────────────────
  // Returns Promise<boolean>: true = worker ready, false = use fallback

  _tryInitWorker() {
    // Quick feature check before even trying
    if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined") {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };

      let timer;
      try {
        this.worker = new Worker(chrome.runtime.getURL("video-delay-worker.js"));
      } catch (e) {
        this.worker = null;
        return settle(false);
      }

      // If worker doesn't reply within 500ms, give up and use fallback
      timer = setTimeout(() => {
        if (this.worker) { try { this.worker.terminate(); } catch {} this.worker = null; }
        settle(false);
      }, 500);

      // Temporary handlers just for the handshake phase
      this.worker.onerror = () => {
        if (this.worker) { try { this.worker.terminate(); } catch {} this.worker = null; }
        settle(false);
      };
      this.worker.onmessage = ({ data }) => {
        if (data.type === "READY") settle(true);
      };

      // Ask worker if it is alive
      this.worker.postMessage({ type: "PING" });
    });
  }

  // ── Worker: message handler (post-handshake) ────────────────────────────────

  _onWorkerMessage(data) {
    switch (data.type) {
      case "DRAW_SUBTITLES":
        // Worker rendered a video frame; sync subtitles on main thread
        this.drawSubtitles(data.subtitles);
        break;
      case "WEBGL_ERROR":
        // Worker couldn't get a GL context after ATTACH — give up
        if (this.isActive) this.destroy();
        break;
    }
  }

  // ── Fallback: main-thread WebGL ─────────────────────────────────────────────

  _initMainThreadGL() {
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
    this.gl = this.videoCanvas.getContext("webgl2", opts) || this.videoCanvas.getContext("webgl", opts);
    if (!this.gl) {
      console.error("[VideoDelay] WebGL not supported");
      this.destroy();
      return;
    }
    this._setupGL();
    this.renderLoopId = requestAnimationFrame(this._boundRenderLoop);
  }

  _setupGL() {
    const gl = this.gl;
    const vs = `attribute vec2 p;attribute vec2 t;varying vec2 v;void main(){gl_Position=vec4(p,0,1);v=t;}`;
    const fs = `precision mediump float;uniform sampler2D u;varying vec2 v;void main(){gl_FragColor=texture2D(u,v);}`;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const pL = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(pL); gl.vertexAttribPointer(pL, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1,1,1,0,0,1,0]), gl.STATIC_DRAW);
    const tL = gl.getAttribLocation(prog, "t"); gl.enableVertexAttribArray(tL); gl.vertexAttribPointer(tL, 2, gl.FLOAT, false, 0, 0);

    this.renderTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  // ── Capture (main thread, always) ──────────────────────────────────────────

  _scheduleCapture() {
    if (!this.isActive) return;
    this._captureCallbackId = this.video.requestVideoFrameCallback(this._boundCaptureFrame);
  }

  async _captureFrame(now, metadata) {
    if (!this.isActive) return;
    this._scheduleCapture();
    if (this.delay <= 0 || !this.isTabVisible) return;

    const captureTimestamp = performance.now();
    const subtitles = this.captureSubtitleSnapshot();

    if (this.worker) {
      // ── Worker path: VideoFrame → zero-copy transfer (no CPU decode)
      if (typeof VideoFrame !== "undefined") {
        try {
          const frame = new VideoFrame(this.video, { timestamp: metadata.mediaTime * 1e6 });
          this.worker.postMessage(
            { type: "FRAME", frame, timestamp: captureTimestamp, subtitles },
            [frame]
          );
          return;
        } catch (e) {
          // VideoFrame failed (cross-origin taint?) → fall through to ImageBitmap
        }
      }
      // ImageBitmap is also Transferable → still zero-copy
      try {
        const bitmap = await createImageBitmap(this.video);
        if (!this.isActive) { bitmap.close(); return; }
        this.worker.postMessage(
          { type: "FRAME", frame: bitmap, timestamp: captureTimestamp, subtitles },
          [bitmap]
        );
      } catch (e) {}

    } else if (this.gl) {
      // ── Fallback path: createImageBitmap → main-thread queue
      try {
        const bitmap = await createImageBitmap(this.video);
        if (!this.isActive) { bitmap.close(); return; }
        this.frameQueue.push({ bitmap, timestamp: captureTimestamp, subtitles });
        // Smart cap
        const maxFrames = Math.ceil(this.delay / 16) + 60;
        while (this.frameQueue.length > maxFrames) {
          const dropped = this.frameQueue.shift();
          if (dropped.bitmap) dropped.bitmap.close();
        }
      } catch (e) {}
    }
  }

  // ── Fallback render loop (RAF, main-thread only) ────────────────────────────

  renderLoop() {
    if (!this.isActive) return;
    this.renderLoopId = requestAnimationFrame(this._boundRenderLoop);
    if (this.frameQueue.length === 0 || !this.isTabVisible) return;

    const now = performance.now();
    const slot = this.frameQueue[0];
    if (now - slot.timestamp >= this.delay) {
      const toRender = this.frameQueue.shift();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.renderTexture);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, toRender.bitmap);
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      this.drawSubtitles(toRender.subtitles);
      toRender.bitmap.close();
      while (this.frameQueue.length > 0 && now - this.frameQueue[0].timestamp > this.delay + 100) {
        const dropped = this.frameQueue.shift();
        if (dropped.bitmap) dropped.bitmap.close();
      }
    }
  }

  // ── Subtitles ───────────────────────────────────────────────────────────────

  // captureSubtitleSnapshot returns the cached value — no DOM query in the hot path.
  // The cache is kept fresh by _setupSubtitleCache (MutationObserver).
  captureSubtitleSnapshot() {
    return this._cachedSubtitles;
  }

  // Watch the subtitle container with MutationObserver so we only re-read the DOM
  // when text actually changes, not on every video frame (was 60 querySelectorAll/s).
  _setupSubtitleCache() {
    const refresh = () => {
      if (!this.isActive) return;
      if (this.subtitleType === "jwp") {
        this._cachedSubtitles = this.subtitleElements.map((el) => el.innerHTML);
      } else {
        this._cachedSubtitles = Array.from(
          document.querySelectorAll(".ytp-caption-segment"),
          (el) => ({ text: el.textContent })
        );
      }
    };

    // Do an initial read
    refresh();

    // Watch the closest stable subtitle container for DOM changes
    const target =
      this.subtitleType === "jwp"
        ? this.subtitleElements[0]
        : document.querySelector(".ytp-captions-text") ||
          document.querySelector(".caption-window") ||
          document.querySelector(".ytp-caption-window-container");

    if (target) {
      this._subtitleMutationObserver = new MutationObserver(refresh);
      this._subtitleMutationObserver.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  drawSubtitles(subtitleData) {
    const currentHash = JSON.stringify(subtitleData);
    if (currentHash === this.lastRenderedSubtitleHash) return;
    this.lastRenderedSubtitleHash = currentHash;
    this.subCtx.clearRect(0, 0, this.subtitleCanvas.width, this.subtitleCanvas.height);
    if (!subtitleData || subtitleData.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = this.subtitleCanvas.width / dpr;
    const h = this.subtitleCanvas.height / dpr;
    const fontSize = h * 0.05;

    this.subCtx.save();
    this.subCtx.scale(dpr, dpr);
    this.subCtx.font = `bold ${fontSize}px Arial`;
    this.subCtx.textAlign = "center";
    this.subCtx.fillStyle = "white";
    this.subCtx.strokeStyle = "black";
    this.subCtx.lineWidth = 3;
    let yPos = h * 0.9;
    subtitleData.forEach((line) => {
      const text = typeof line === "string" ? line.replace(/<[^>]*>?/gm, "") : line.text;
      if (text) {
        this.subCtx.strokeText(text, w / 2, yPos);
        this.subCtx.fillText(text, w / 2, yPos);
        yPos -= fontSize + 5;
      }
    });
    this.subCtx.restore();
  }

  // ── Subtitle player detection ───────────────────────────────────────────────

  determineSubtitlePlayer() {
    const jw = document.querySelector(".jw-captions");
    if (jw) {
      this.subtitleType = "jwp";
      this.subtitleElements = [jw];
      jw.style.opacity = "0";
      this.hiddenSubtitleElements.push({ el: jw, prop: "opacity", val: "" });
    } else {
      const style = document.createElement("style");
      style.textContent = ".ytp-caption-window-bottom, .ytp-caption-window-rollup { opacity: 0 !important; }";
      document.head.appendChild(style);
      this.hideSubtitlesStyle = style;
    }
  }

  // ── Delay / resize ──────────────────────────────────────────────────────────

  updateDelay(newDelay) {
    this.delay = newDelay;
    if (this.worker) this.worker.postMessage({ type: "SET_DELAY", value: newDelay });
  }

  addEventListeners() {
    // Debounce resize — ResizeObserver can fire many times per second during drag/fullscreen
    this._resizeTimer = null;
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.resize(), 100);
    });
    this.resizeObserver.observe(this.video);
    if (this.video.parentNode) this.resizeObserver.observe(this.video.parentNode);

    this.styleObserver = new MutationObserver(() => this.syncStyle());
    this.styleObserver.observe(this.video, { attributes: true, attributeFilter: ["style"] });

    this.fullscreenHandler = () => setTimeout(() => this.resize(), 100);
    document.addEventListener("fullscreenchange", this.fullscreenHandler);

    // On visibility change: pause capture entirely when tab is hidden (zero GPU work),
    // resume immediately when visible again.
    this.visHandler = () => {
      this.isTabVisible = !document.hidden;
      if (this.isTabVisible) {
        // Resume: re-register vFC (only if not already pending)
        if (this._captureCallbackId == null) this._scheduleCapture();
      } else {
        // Pause: cancel pending vFC callback
        if (this._captureCallbackId != null && "cancelVideoFrameCallback" in HTMLVideoElement.prototype) {
          try { this.video.cancelVideoFrameCallback(this._captureCallbackId); } catch {}
          this._captureCallbackId = null;
        }
      }
    };
    document.addEventListener("visibilitychange", this.visHandler);

    this.emptyHandler = () => monitor.stopVideoDelay(this.video);
    this.video.addEventListener("emptied", this.emptyHandler);
  }

  resize() {
    if (!this.videoCanvas || !this.video) return;
    const rect = this.video.getBoundingClientRect();
    const originalWidth = this.video.videoWidth || rect.width;
    const originalHeight = this.video.videoHeight || rect.height;
    let renderWidth = originalWidth;
    let renderHeight = originalHeight;

    if (this.quality && this.quality !== "max") {
      let targetH = originalHeight;
      if (this.quality === "low") targetH = 320;
      else if (this.quality === "mid") targetH = 720;
      else if (this.quality === "high") targetH = 1080;
      if (originalHeight > targetH) {
        renderHeight = targetH;
        renderWidth = targetH * (originalWidth / originalHeight);
      }
    }

    if (this.worker) {
      // Worker owns the OffscreenCanvas pixel dimensions
      this.worker.postMessage({ type: "RESIZE", width: renderWidth, height: renderHeight });
    } else {
      // Fallback: main thread owns the canvas
      this.videoCanvas.width = renderWidth;
      this.videoCanvas.height = renderHeight;
      if (this.gl) this.gl.viewport(0, 0, renderWidth, renderHeight);
    }

    const dpr = window.devicePixelRatio || 1;
    this.subtitleCanvas.width = rect.width * dpr;
    this.subtitleCanvas.height = rect.height * dpr;

    this.syncStyle();
    this.lastRenderedSubtitleHash = "";
  }

  syncStyle() {
    if (!this.videoCanvas || !this.video) return;
    const style = window.getComputedStyle(this.video);
    ["width", "height", "top", "left", "transform", "transformOrigin"].forEach((p) => {
      this.videoCanvas.style[p] = style[p];
      this.subtitleCanvas.style[p] = style[p];
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy() {
    this.isActive = false;

    if (this.renderLoopId) cancelAnimationFrame(this.renderLoopId);

    if (this._captureCallbackId != null && "cancelVideoFrameCallback" in HTMLVideoElement.prototype) {
      try { this.video.cancelVideoFrameCallback(this._captureCallbackId); } catch {}
    }

    if (this.worker) {
      this.worker.postMessage({ type: "DESTROY" });
      setTimeout(() => { try { this.worker.terminate(); } catch {} }, 300);
      this.worker = null;
    }

    if (this.styleObserver) this.styleObserver.disconnect();
    if (this._subtitleMutationObserver) this._subtitleMutationObserver.disconnect();
    clearTimeout(this._resizeTimer);
    if (this.video) {
      this.video.style.removeProperty("opacity");
      this.video.removeEventListener("emptied", this.emptyHandler);
    }
    document.removeEventListener("visibilitychange", this.visHandler);
    document.removeEventListener("fullscreenchange", this.fullscreenHandler);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.hideSubtitlesStyle) this.hideSubtitlesStyle.remove();
    this.hiddenSubtitleElements.forEach((item) => (item.el.style[item.prop] = item.val));

    if (this.gl) {
      const ext = this.gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }
    if (this.videoCanvas) this.videoCanvas.remove();
    if (this.subtitleCanvas) this.subtitleCanvas.remove();

    while (this.frameQueue.length > 0) {
      const f = this.frameQueue.shift();
      if (f.bitmap) f.bitmap.close();
    }
  }
}

const monitor = new Monitor();
