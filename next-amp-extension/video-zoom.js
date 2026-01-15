class VideoZoomer {
  constructor() {
    this.scale = 1.0;
    this.translateY = 0;
    this.rotate = 0;
    this.observedElements = new WeakSet();

    this.setupMessageListener();
    this.setupPersistence();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "SET_VIDEO_ZOOM") {
        if (message.scale !== undefined) this.scale = parseFloat(message.scale);
        if (message.translateY !== undefined)
          this.translateY = parseFloat(message.translateY);
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
    return !(this.scale === 1.0 && this.translateY === 0 && this.rotate === 0);
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

    const transformValue = `scale(${finalScale}) translateY(${this.translateY}%) rotate(${this.rotate}deg)`;

    if (video.style.transform !== transformValue) {
      video.style.transform = transformValue;
      video.style.transformOrigin = "center center";
    }
  }
}

const videoZoomer = new VideoZoomer();
