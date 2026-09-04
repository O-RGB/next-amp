class VideoZoomer {
  constructor() {
    this.scale = 1.0;
    this.translateY = 0;
    this.translateX = 0; // [NEW] Add X axis
    this.rotate = 0;
    this.observedElements = new WeakSet();

    this.setupMessageListener();
    this.setupStorageListener();
    this.setupPersistence();
  }

  setupStorageListener() {
    // Listen to storage changes directly from background / offscreen
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      let changed = false;
      if (changes.videoZoom !== undefined) {
        this.scale = parseFloat(changes.videoZoom.newValue || 1.0);
        changed = true;
      }
      if (changes.videoRotate !== undefined) {
        this.rotate = parseFloat(changes.videoRotate.newValue || 0);
        changed = true;
      }
      if (changes.videoPosX !== undefined) {
        this.translateX = parseFloat(changes.videoPosX.newValue || 0);
        changed = true;
      }
      if (changes.videoPosY !== undefined) {
        this.translateY = parseFloat(changes.videoPosY.newValue || 0);
        changed = true;
      }
      if (changed) this.applyZoom();
    });

    // Load initial values from storage on start
    chrome.storage.local.get(["videoZoom", "videoRotate", "videoPosX", "videoPosY"], (res) => {
      if (res) {
        if (res.videoZoom !== undefined) this.scale = parseFloat(res.videoZoom);
        if (res.videoRotate !== undefined) this.rotate = parseFloat(res.videoRotate);
        if (res.videoPosX !== undefined) this.translateX = parseFloat(res.videoPosX);
        if (res.videoPosY !== undefined) this.translateY = parseFloat(res.videoPosY);
        if (this.shouldApply()) this.applyZoom();
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "SET_VIDEO_ZOOM") {
        if (message.scale !== undefined) this.scale = parseFloat(message.scale);

        // [NEW] Receive Position X and Y
        if (message.translateY !== undefined)
          this.translateY = parseFloat(message.translateY);
        if (message.translateX !== undefined)
          this.translateX = parseFloat(message.translateX);

        if (message.rotate !== undefined)
          this.rotate = parseFloat(message.rotate);

        this.applyZoom();
      } else if (message.type === "GET_VIDEO_ZOOM") {
      }
    });
  }

  setupPersistence() {
    const handleFullscreen = () => {
      setTimeout(() => this.applyZoom(), 200);
    };

    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("webkitfullscreenchange", handleFullscreen);
  }

  applyZoom() {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      this.attachObserver(video);
      this.updateVideoStyle(video);
    });
  }

  attachObserver(video) {
    if (this.observedElements.has(video)) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const currentStyle = video.getAttribute("style") || "";

          if (
            this.shouldApply() &&
            !currentStyle.includes(`rotate(${this.rotate}deg)`)
          ) {
            this.updateVideoStyle(video);
          }
        }
      }
    });

    observer.observe(video, { attributes: true, attributeFilter: ["style"] });
    this.observedElements.add(video);
  }

  shouldApply() {
    // [NEW] Check translateX as well
    return !(
      this.scale === 1.0 &&
      this.translateY === 0 &&
      this.translateX === 0 &&
      this.rotate === 0
    );
  }

  updateVideoStyle(video) {
    if (!this.shouldApply()) {
      if (video.style.transform) {
        video.style.transform = "";
        video.style.transformOrigin = "";
      }
      return;
    }

    let autoFitScale = 1.0;
    const r = Math.abs(this.rotate % 360);

    const isVertical = Math.abs(r - 90) < 0.1 || Math.abs(r - 270) < 0.1;

    if (isVertical && video.videoWidth && video.videoHeight) {
      autoFitScale = video.videoHeight / video.videoWidth;
    }

    const finalScale = this.scale * autoFitScale;

    // [NEW] Add translate(${this.translateX}%, ${this.translateY}%)
    const transformValue = `scale(${finalScale}) translate(${this.translateX}%, ${this.translateY}%) rotate(${this.rotate}deg)`;

    if (video.style.transform !== transformValue) {
      video.style.transform = transformValue;
      video.style.transformOrigin = "center center";
    }
  }
}

const videoZoomer = new VideoZoomer();
