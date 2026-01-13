// next-amp-extension/video-delay.js
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
          document
            .querySelectorAll("video")
            .forEach((v) => this.waitForVideoFrameRefresh(v));
        }
      } else {
        // Fallback: ดูใน Storage เผื่อ Popup ปิดอยู่และ Audio OFF แต่ User ตั้ง Delay ไว้
        chrome.storage.local.get(["videoDelay"], (res) => {
          if (res.videoDelay) {
            const globalDelay = parseFloat(res.videoDelay) * 1000;
            if (globalDelay > 0) {
              this.delay = globalDelay;
              this.setupVideoListeners();
              document
                .querySelectorAll("video")
                .forEach((v) => this.waitForVideoFrameRefresh(v));
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
            document
              .querySelectorAll("video")
              .forEach((v) => this.waitForVideoFrameRefresh(v));
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
        this.delayedVideos.forEach((delayedVideo) =>
          delayedVideo.updateQuality(this.quality)
        );
      }
      return true;
    });

    this.setupVideoListeners();
  }

  updateDelays() {
    this.delayedVideos.forEach((delayedVideo) =>
      delayedVideo.updateDelay(this.delay)
    );
    if (this.delay <= 0) {
      this.delayedVideos.forEach((delayedVideo) => delayedVideo.destroy());
      this.delayedVideos.clear();
    }
  }

  setupVideoListeners() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearVideoCallbacks();

    const checkAndAttach = (video) => this.waitForVideoFrameRefresh(video);
    document.querySelectorAll("video").forEach(checkAndAttach);

    this.observer = new MutationObserver((mutations) => {
      if (this.delay <= 0) return;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === "VIDEO") checkAndAttach(node);
          else if (node.querySelectorAll)
            node.querySelectorAll("video").forEach(checkAndAttach);
        });
      });
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  clearVideoCallbacks() {
    this.videoCallbacks.forEach((callbackId, video) => {
      if ("cancelVideoFrameCallback" in HTMLVideoElement.prototype) {
        try {
          video.cancelVideoFrameCallback(callbackId);
        } catch {}
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
    )
      return;

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
      if (
        !video.paused &&
        !this.videoCallbacks.has(video) &&
        !this.delayedVideos.has(video) &&
        this.delay > 0
      ) {
        requestFrameCallback();
      }
    };
    video.addEventListener("play", onPlay);
  }

  delayVideo(video) {
    if (this.delay <= 0) return;

    const delayedVideo = new DelayedVideo(video, this.delay, this.quality);
    this.delayedVideos.set(video, delayedVideo);
  }

  stopVideoDelay(video) {
    if (this.delayedVideos.has(video)) {
      this.delayedVideos.get(video).destroy();
      this.delayedVideos.delete(video);
    }
  }
}

class DelayedVideo {
  constructor(video, delay, quality = "max") {
    this.video = video;
    this.delay = delay;
    this.quality = quality;

    this.isActive = true;
    this.isTabVisible = !document.hidden;
    this.lastRenderedSubtitleHash = "";

    this.frameQueue = [];
    this.subtitleElements = [];
    this.hiddenSubtitleElements = [];

    // เพิ่ม styleObserver เพื่อจับการเปลี่ยนแปลง Zoom/Rotate ของ Video ต้นฉบับ
    this.styleObserver = null;

    this.init();
  }

  updateQuality(newQuality) {
    this.quality = newQuality;
    this.resize();
  }

  async init() {
    this.createCanvases();
    this.determineSubtitlePlayer();
    this.addEventListeners();

    this.video.requestVideoFrameCallback(this.onVideoFrame.bind(this));
    this.renderLoopId = requestAnimationFrame(this.renderLoop.bind(this));
  }

  createCanvases() {
    const cssText =
      "pointer-events: none !important; position: absolute !important; object-fit: contain !important;";
    this.videoCanvas = document.createElement("canvas");
    this.videoCanvas.style.cssText = cssText;
    this.subtitleCanvas = document.createElement("canvas");
    this.subtitleCanvas.style.cssText = cssText;

    if (this.video.parentNode) {
      this.video.parentNode.insertBefore(
        this.videoCanvas,
        this.video.nextSibling
      );
      this.video.parentNode.insertBefore(
        this.subtitleCanvas,
        this.videoCanvas.nextSibling
      );
    }

    this.gl =
      this.videoCanvas.getContext("webgl2") ||
      this.videoCanvas.getContext("webgl");
    this.subCtx = this.subtitleCanvas.getContext("2d");

    if (!this.gl) {
      console.error("WebGL not supported");
      this.destroy();
      return;
    }

    this.setupWebGL();

    setTimeout(() => {
      if (this.video) this.video.style.setProperty("opacity", "0", "important");
    }, 50);
    this.resize();
  }

  setupWebGL() {
    const gl = this.gl;

    const vsSource = `attribute vec2 p; attribute vec2 t; varying vec2 v; void main(){gl_Position=vec4(p,0,1);v=t;}`;
    const fsSource = `precision mediump float; uniform sampler2D u; varying vec2 v; void main(){gl_FragColor=texture2D(u,v);}`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
      gl.STATIC_DRAW
    );
    const texLoc = gl.getAttribLocation(prog, "t");
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    this.renderTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  async onVideoFrame(now, metadata) {
    if (!this.isActive) return;
    this.video.requestVideoFrameCallback(this.onVideoFrame.bind(this));
    if (!this.gl || this.delay <= 0) return;

    try {
      const bitmap = await createImageBitmap(this.video);

      this.frameQueue.push({
        bitmap: bitmap,
        timestamp: performance.now(),
        subtitles: this.captureSubtitleSnapshot(),
      });

      if (this.frameQueue.length > 1000) {
        const dropped = this.frameQueue.shift();
        if (dropped && dropped.bitmap) dropped.bitmap.close();
      }
    } catch (e) {}
  }

  renderLoop() {
    if (!this.isActive) return;
    this.renderLoopId = requestAnimationFrame(this.renderLoop.bind(this));

    if (this.frameQueue.length === 0 || !this.isTabVisible) return;

    const now = performance.now();

    const slot = this.frameQueue[0];

    const timeSinceCapture = now - slot.timestamp;

    if (timeSinceCapture >= this.delay) {
      const frameToRender = this.frameQueue.shift();

      this.drawFrame(frameToRender);

      frameToRender.bitmap.close();

      while (
        this.frameQueue.length > 0 &&
        now - this.frameQueue[0].timestamp > this.delay + 100
      ) {
        const dropped = this.frameQueue.shift();
        if (dropped.bitmap) dropped.bitmap.close();
      }
    }
  }

  drawFrame(slot) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.renderTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      slot.bitmap
    );

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.drawSubtitles(slot.subtitles);
  }

  captureSubtitleSnapshot() {
    let snapshot = [];
    if (this.subtitleType === "jwp") {
      this.subtitleElements.forEach((el) => snapshot.push(el.innerHTML));
    } else {
      const yt = document.querySelectorAll(".ytp-caption-segment");
      yt.forEach((el) => snapshot.push({ text: el.textContent }));
    }
    return snapshot;
  }

  drawSubtitles(subtitleData) {
    const currentHash = JSON.stringify(subtitleData);
    if (currentHash === this.lastRenderedSubtitleHash) return;
    this.lastRenderedSubtitleHash = currentHash;

    this.subCtx.clearRect(
      0,
      0,
      this.subtitleCanvas.width,
      this.subtitleCanvas.height
    );
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
      const text =
        typeof line === "string" ? line.replace(/<[^>]*>?/gm, "") : line.text;
      if (text) {
        this.subCtx.strokeText(text, w / 2, yPos);
        this.subCtx.fillText(text, w / 2, yPos);
        yPos -= fontSize + 5;
      }
    });
    this.subCtx.restore();
  }

  determineSubtitlePlayer() {
    const jw = document.querySelector(".jw-captions");
    if (jw) {
      this.subtitleType = "jwp";
      this.subtitleElements = [jw];
      jw.style.opacity = "0";
      this.hiddenSubtitleElements.push({ el: jw, prop: "opacity", val: "" });
    } else {
      const style = document.createElement("style");
      style.textContent =
        ".ytp-caption-window-bottom, .ytp-caption-window-rollup { opacity: 0 !important; }";
      document.head.appendChild(style);
      this.hideSubtitlesStyle = style;
    }
  }

  updateDelay(newDelay) {
    this.delay = newDelay;
  }

  addEventListeners() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.video);
    if (this.video.parentNode)
      this.resizeObserver.observe(this.video.parentNode);

    // [แก้ไข] เพิ่ม Observer จับการเปลี่ยน Style (Zoom/Rotate)
    this.styleObserver = new MutationObserver(() => this.syncStyle());
    this.styleObserver.observe(this.video, {
      attributes: true,
      attributeFilter: ["style"],
    });

    document.addEventListener("fullscreenchange", () =>
      setTimeout(() => this.resize(), 100)
    );

    this.visHandler = () => {
      this.isTabVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", this.visHandler);

    this.emptyHandler = () => monitor.stopVideoDelay(this.video);
    this.video.addEventListener("emptied", this.emptyHandler);
  }

  // [แก้ไข] แยก Logic การ Resize
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
        const ratio = originalWidth / originalHeight;
        renderHeight = targetH;
        renderWidth = targetH * ratio;
      }
    }

    this.videoCanvas.width = renderWidth;
    this.videoCanvas.height = renderHeight;

    const dpr = window.devicePixelRatio || 1;
    this.subtitleCanvas.width = rect.width * dpr;
    this.subtitleCanvas.height = rect.height * dpr;

    if (this.gl) this.gl.viewport(0, 0, renderWidth, renderHeight);

    // เรียก syncStyle เพื่ออัปเดตตำแหน่งและ Transform
    this.syncStyle();
    this.lastRenderedSubtitleHash = "";
  }

  // [แก้ไข] ฟังก์ชันใหม่สำหรับ Sync Style (Transform)
  syncStyle() {
    if (!this.videoCanvas || !this.video) return;
    const style = window.getComputedStyle(this.video);

    // Copy ตำแหน่งและ Transform (Zoom/Rotate)
    this.videoCanvas.style.width = style.width;
    this.videoCanvas.style.height = style.height;
    this.videoCanvas.style.top = style.top;
    this.videoCanvas.style.left = style.left;
    this.videoCanvas.style.transform = style.transform; // สำคัญ: Copy transform
    this.videoCanvas.style.transformOrigin = style.transformOrigin;

    this.subtitleCanvas.style.width = style.width;
    this.subtitleCanvas.style.height = style.height;
    this.subtitleCanvas.style.top = style.top;
    this.subtitleCanvas.style.left = style.left;
    this.subtitleCanvas.style.transform = style.transform; // สำคัญ: Copy transform
    this.subtitleCanvas.style.transformOrigin = style.transformOrigin;
  }

  destroy() {
    this.isActive = false;
    cancelAnimationFrame(this.renderLoopId);

    // [แก้ไข] Cleanup styleObserver
    if (this.styleObserver) this.styleObserver.disconnect();

    if (this.video) {
      this.video.style.removeProperty("opacity");
      this.video.removeEventListener("emptied", this.emptyHandler);
    }
    document.removeEventListener("visibilitychange", this.visHandler);
    if (this.resizeObserver) this.resizeObserver.disconnect();

    if (this.hideSubtitlesStyle) this.hideSubtitlesStyle.remove();
    this.hiddenSubtitleElements.forEach(
      (item) => (item.el.style[item.prop] = item.val)
    );

    if (this.gl) {
      const ext = this.gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }

    if (this.videoCanvas) this.videoCanvas.remove();
    if (this.subtitleCanvas) this.subtitleCanvas.remove();

    while (this.frameQueue.length > 0) {
      const frame = this.frameQueue.shift();
      if (frame.bitmap) frame.bitmap.close();
    }
  }
}

const monitor = new Monitor();
