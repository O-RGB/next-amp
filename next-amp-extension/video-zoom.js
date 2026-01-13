// next-amp-extension/video-zoom.js

class VideoZoomer {
  constructor() {
    this.scale = 1.0;
    this.translateY = 0;
    this.rotate = 0;
    this.observedElements = new WeakSet(); // [เพิ่ม] ใช้ตรวจสอบว่า video นี้ถูกเฝ้าดูหรือยัง

    this.setupMessageListener();
    this.setupPersistence(); // [เพิ่ม] ระบบป้องกันค่าหาย
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
        // Optional: ส่งค่ากลับไปถ้า Popup ต้องการ
      }
    });
  }

  setupPersistence() {
    // [เพิ่ม] ดักจับ Event การเข้า/ออก Fullscreen เพราะเว็บชอบล้างค่าตอนนี้
    const handleFullscreen = () => {
      // รอสักนิดให้เว็บปรับ layout เสร็จก่อน แล้วค่อยบังคับค่าเราทับลงไป
      setTimeout(() => this.applyZoom(), 200);
    };

    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("webkitfullscreenchange", handleFullscreen); // เผื่อ Browser เก่า
  }

  applyZoom() {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      this.attachObserver(video); // สั่งเฝ้าระวัง video นี้
      this.updateVideoStyle(video); // อัปเดตค่าทันที
    });
  }

  attachObserver(video) {
    if (this.observedElements.has(video)) return;

    // [เพิ่ม] MutationObserver: คอยดูว่า style ของ video เปลี่ยนหรือไม่
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          // ถ้ามีการเปลี่ยน style และค่า rotate ของเราหายไป -> ให้ใส่กลับ
          const currentStyle = video.getAttribute("style") || "";

          // เช็คเพื่อป้องกัน Infinite Loop: ถ้า style ปัจจุบันตรงกับที่เราอยากได้แล้ว ก็ไม่ต้องทำอะไร
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
    // ถ้าค่าเป็น Default (ไม่หมุน ไม่ซูม) ก็ไม่ต้องซีเรียสมาก
    return !(this.scale === 1.0 && this.translateY === 0 && this.rotate === 0);
  }

  updateVideoStyle(video) {
    if (!this.shouldApply()) {
      // ถ้าเป็นค่า Default ให้ล้าง style ออก เพื่อไม่ให้ตีกับ Player ของเว็บ
      if (video.style.transform) {
        video.style.transform = "";
        video.style.transformOrigin = "";
      }
      return;
    }

    // [เพิ่ม] Logic คำนวณ Scale อัตโนมัติ (Auto-Fit)
    let autoFitScale = 1.0;
    const r = Math.abs(this.rotate % 360);
    // ตรวจสอบว่าเป็นแนวตั้งหรือไม่ (90 หรือ 270 องศา)
    const isVertical = Math.abs(r - 90) < 0.1 || Math.abs(r - 270) < 0.1;

    if (isVertical && video.videoWidth && video.videoHeight) {
      // สูตร: เอาความสูงวิดีโอ (ที่จะกลายเป็นความกว้าง) หารด้วยความกว้างเดิม
      // เพื่อย่อส่วนสูงให้ลงมาพอดีกับความสูงของกรอบ Player
      // เช่น วิดีโอ 1920x1080 (16:9) หมุนแล้วสูง 1920 แต่จอมันสูงแค่ 1080
      // ต้องย่อลง 1080/1920 = 0.5625 เท่า
      autoFitScale = video.videoHeight / video.videoWidth;
    }

    // เอาค่า Scale ที่ user ปรับ คูณกับค่า Auto-Fit
    const finalScale = this.scale * autoFitScale;

    // สร้าง string transform
    const transformValue = `scale(${finalScale}) translateY(${this.translateY}%) rotate(${this.rotate}deg)`;

    // อัปเดตค่าลง DOM (เช็คก่อนเพื่อลดการกระตุก)
    if (video.style.transform !== transformValue) {
      video.style.transform = transformValue;
      video.style.transformOrigin = "center center";
    }
  }
}

const videoZoomer = new VideoZoomer();
