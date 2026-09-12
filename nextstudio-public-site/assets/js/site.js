(function () {
  "use strict";

  const translations = {
    en: {
      skip: "Skip to content",
      "nav.features": "Features", "nav.compatibility": "Compatibility", "nav.remote": "Remote", "nav.privacy": "Privacy", "nav.getStarted": "Get started",
      "hero.eyebrow": "LOCAL-FIRST AUDIO TOOL", "hero.title": "Shape the sound.\nKeep the moment.",
      "hero.lede": "NextStudio brings pitch shifting, AI vocal control, video sync and recording into one focused browser studio for practice, performance and play.",
      "hero.primary": "Explore the studio", "hero.secondary": "Open Remote", "hero.microcopy": "AI loads only when you turn it on. No model preload on the landing page.",
      "proof.realtime": "Real-time", "proof.aiVocal": "AI Vocal", "proof.remote": "Remote-ready", "strip.label": "A compact studio for",
      "features.eyebrow": "ONE CONTROL SURFACE", "features.title": "Less friction between\nyou and the music.", "features.lede": "Each tool stays close to the moment you need it. Tune a song, remove vocals, align the visual and keep a take — without turning your browser into a control room.",
      "feature.ai.kicker": "AI VOCAL CONTROL", "feature.ai.title": "Make space for\nyour voice.", "feature.ai.body": "Karaoke and Acapella modes run when you choose them, with ECO and FULL profiles so you can balance clarity, latency and the hardware in front of you.",
      "feature.pitch.kicker": "MUSICAL CONTROL", "feature.pitch.title": "Find the key\nthat fits.", "feature.pitch.body": "Shift pitch, shape the room with reverb, and keep levels comfortable with simple controls.",
      "feature.video.kicker": "VISUAL SYNC", "feature.video.title": "Hear it and\nsee it together.", "feature.video.body": "Control delay, zoom, rotation and quality so the picture follows the performance.",
      "feature.remote.kicker": "REMOTE + RECORDING", "feature.remote.title": "Keep your hands\nwhere they belong.", "feature.remote.body": "Use a second device as a focused remote, or capture a take locally for playback, download and delete.",
      "hardware.eyebrow": "BUILT AROUND REAL HARDWARE", "hardware.title": "Use the power\nyou already have.", "hardware.body": "NextStudio adapts its audio path to the environment available to it. Use browser acceleration where it helps, or pair the Extension with the optional Go engine on supported Windows setups.", "hardware.link": "See the privacy model",
      "hardware.webgpu.title": "WebGPU / WebGL", "hardware.webgpu.body": "Browser acceleration selected by the device", "hardware.native.title": "Optional Go engine", "hardware.native.body": "A native path for supported Windows workflows", "hardware.mode.title": "ECO / FULL profiles", "hardware.mode.body": "Choose a lighter or higher-quality AI profile", "hardware.foot": "No performance promise is hidden behind a number.", "hardware.status": "READY TO ADAPT",
      "workflow.eyebrow": "A QUIET WORKFLOW", "workflow.title": "Open it when\nyou need it.", "workflow.body": "AI stays out of the way until you ask for it. Your settings and recordings remain on your device in normal use, while Remote only carries the controls needed for the session.", "workflow.one.title": "Choose a source", "workflow.one.body": "Open your music or video in a supported browser tab.", "workflow.two.title": "Shape the session", "workflow.two.body": "Adjust pitch, vocal mode, effects and video timing.", "workflow.three.title": "Perform or record", "workflow.three.body": "Keep the session simple, then save the take locally if you want it.",
      "faq.eyebrow": "GOOD TO KNOW", "faq.title": "The short\nversion.", "faq.ai.q": "When does AI load?", "faq.ai.a": "Only after you turn on an AI vocal mode. The public page never preloads the model.", "faq.remote.q": "What does Remote control?", "faq.remote.a": "Remote sends validated control values such as volume, pitch, vocal mode and video timing. It does not carry the audio stream.", "faq.data.q": "Where are recordings stored?", "faq.data.a": "Recordings and preferences are designed to stay in the local browser or Extension storage. You can play, download or delete your own takes.", "faq.compat.q": "Will every GPU perform the same?", "faq.compat.a": "No. Browser acceleration depends on the browser, driver, operating system and available hardware. NextStudio exposes lighter options for constrained devices.",
      "cta.eyebrow": "MAKE THE NEXT TAKE YOURS", "cta.title": "A smaller distance\nto better practice.", "cta.primary": "Get started", "cta.contact": "Contact the team", "footer.tagline": "A focused browser studio by NextFeeder Labs.", "footer.contact": "Contact", "footer.support": "Support the project", "footer.built": "Made for the next session.",
      "policy.label": "PRIVACY & TRUST", "policy.title": "Privacy Policy", "policy.intro": "A clear description of how NextStudio handles information.", "policy.effective": "Effective date: September 12, 2026", "policy.version": "Version 1.0"
    },
    th: {
      skip: "ข้ามไปยังเนื้อหา", "nav.features": "ฟีเจอร์", "nav.compatibility": "อุปกรณ์ที่รองรับ", "nav.remote": "รีโมต", "nav.privacy": "ความเป็นส่วนตัว", "nav.getStarted": "เริ่มใช้งาน",
      "hero.eyebrow": "เครื่องมือเสียงที่ประมวลผลในเครื่อง", "hero.title": "ปรับเสียงให้ใช่\nแล้วอยู่กับเพลงต่อ",
      "hero.lede": "NextStudio รวมการเปลี่ยนคีย์ ควบคุมเสียงร้องด้วย AI ซิงก์วิดีโอ และบันทึกเสียงไว้ใน browser studio เดียว สำหรับซ้อม เล่น และสร้างผลงาน",
      "hero.primary": "ดูความสามารถ", "hero.secondary": "เปิดรีโมต", "hero.microcopy": "AI จะโหลดเมื่อคุณเปิดใช้เท่านั้น หน้าเว็บนี้ไม่โหลดโมเดลล่วงหน้า", "proof.realtime": "เรียลไทม์", "proof.aiVocal": "AI Vocal", "proof.remote": "พร้อมใช้รีโมต", "strip.label": "สตูดิโอขนาดกะทัดรัดสำหรับ",
      "features.eyebrow": "ควบคุมจากหน้าจอเดียว", "features.title": "ลดระยะห่างระหว่าง\nคุณกับเสียงเพลง", "features.lede": "แต่ละเครื่องมืออยู่ใกล้จังหวะที่คุณต้องใช้ ปรับเพลง ตัดเสียงร้อง จัดภาพให้ตรง และเก็บเทคได้ โดยไม่ทำให้ browser กลายเป็นห้องควบคุมที่วุ่นวาย",
      "feature.ai.kicker": "ควบคุมเสียงร้องด้วย AI", "feature.ai.title": "เปิดพื้นที่ให้\nเสียงของคุณ", "feature.ai.body": "ใช้โหมด Karaoke และ Acapella เมื่อเลือก พร้อมโปรไฟล์ ECO และ FULL เพื่อสมดุลระหว่างความชัด latency และฮาร์ดแวร์ของคุณ",
      "feature.pitch.kicker": "ควบคุมทางดนตรี", "feature.pitch.title": "หาคีย์ที่\nเข้ากับคุณ", "feature.pitch.body": "เปลี่ยนคีย์ เติมบรรยากาศด้วย reverb และควบคุมระดับเสียงด้วยปุ่มที่เข้าใจง่าย",
      "feature.video.kicker": "ซิงก์ภาพและเสียง", "feature.video.title": "ฟังและ\nเห็นไปพร้อมกัน", "feature.video.body": "ควบคุม delay, zoom, rotation และ quality ให้ภาพตามการแสดงของคุณ",
      "feature.remote.kicker": "รีโมต + บันทึกเสียง", "feature.remote.title": "ให้มือของคุณ\nอยู่กับสิ่งที่เล่น", "feature.remote.body": "ใช้อุปกรณ์อีกเครื่องเป็นรีโมต หรืออัดเทคไว้ในเครื่องเพื่อเล่น ดาวน์โหลด หรือลบได้",
      "hardware.eyebrow": "ออกแบบจากฮาร์ดแวร์ที่มีจริง", "hardware.title": "ใช้พลังจาก\nเครื่องที่คุณมี", "hardware.body": "NextStudio ปรับเส้นทางเสียงตามสภาพแวดล้อมที่มี ใช้ browser acceleration เมื่อเหมาะสม หรือใช้ Go engine เสริมบน Windows ที่รองรับ", "hardware.link": "ดูแนวทางความเป็นส่วนตัว",
      "hardware.webgpu.title": "WebGPU / WebGL", "hardware.webgpu.body": "เลือกการเร่งผลด้วย browser ตามอุปกรณ์", "hardware.native.title": "Go engine เสริม", "hardware.native.body": "เส้นทาง native สำหรับ workflow บน Windows ที่รองรับ", "hardware.mode.title": "โปรไฟล์ ECO / FULL", "hardware.mode.body": "เลือกระหว่าง AI ที่เบากว่าหรือคุณภาพสูงกว่า", "hardware.foot": "ไม่ซ่อนคำสัญญาด้านประสิทธิภาพไว้หลังตัวเลข", "hardware.status": "พร้อมปรับตามเครื่อง",
      "workflow.eyebrow": "เวิร์กโฟลว์ที่ไม่รบกวน", "workflow.title": "เปิดใช้เมื่อ\nคุณต้องการ", "workflow.body": "AI จะไม่เข้ามารบกวนจนกว่าคุณจะเรียกใช้ การตั้งค่าและเสียงที่บันทึกจะอยู่ในเครื่องตามการใช้งานปกติ ส่วนรีโมตส่งเฉพาะคำสั่งที่จำเป็นต่อ session", "workflow.one.title": "เลือกแหล่งเสียง", "workflow.one.body": "เปิดเพลงหรือวิดีโอในแท็บ browser ที่รองรับ", "workflow.two.title": "ปรับ session", "workflow.two.body": "ปรับคีย์ โหมดเสียงร้อง เอฟเฟกต์ และจังหวะวิดีโอ", "workflow.three.title": "เล่นหรือบันทึก", "workflow.three.body": "ทำให้ session เรียบง่าย แล้วบันทึกเทคไว้ในเครื่องเมื่อพร้อม",
      "faq.eyebrow": "เรื่องที่ควรรู้", "faq.title": "สรุป\nสั้น ๆ", "faq.ai.q": "AI จะโหลดเมื่อไหร่?", "faq.ai.a": "หลังจากคุณเปิดโหมด AI vocal เท่านั้น หน้าเว็บสาธารณะจะไม่โหลดโมเดลล่วงหน้า", "faq.remote.q": "Remote ควบคุมอะไรได้บ้าง?", "faq.remote.a": "Remote ส่งค่าที่ตรวจสอบแล้ว เช่น volume, pitch, vocal mode และ video timing โดยไม่ส่ง audio stream", "faq.data.q": "เสียงที่บันทึกเก็บไว้ที่ไหน?", "faq.data.a": "เสียงที่บันทึกและการตั้งค่าจะอยู่ใน browser หรือ Extension storage ในเครื่อง คุณเล่น ดาวน์โหลด หรือลบเทคของตัวเองได้", "faq.compat.q": "GPU ทุกเครื่องทำงานเหมือนกันไหม?", "faq.compat.a": "ไม่เหมือนกัน การเร่งผลขึ้นกับ browser, driver, ระบบปฏิบัติการ และฮาร์ดแวร์ NextStudio จึงมีตัวเลือกที่เบากว่าสำหรับเครื่องที่จำกัด",
      "cta.eyebrow": "ทำให้เทคต่อไปเป็นของคุณ", "cta.title": "ลดระยะห่าง\nสู่การซ้อมที่ดีขึ้น", "cta.primary": "เริ่มใช้งาน", "cta.contact": "ติดต่อทีม", "footer.tagline": "browser studio ที่โฟกัสกับเสียง โดย NextFeeder Labs", "footer.contact": "ติดต่อ", "footer.support": "สนับสนุนโปรเจกต์", "footer.built": "สร้างไว้สำหรับ session ถัดไป",
      "policy.label": "ความเป็นส่วนตัวและความไว้วางใจ", "policy.title": "นโยบายความเป็นส่วนตัว", "policy.intro": "คำอธิบายที่ชัดเจนว่า NextStudio จัดการข้อมูลอย่างไร", "policy.effective": "วันที่มีผล: 12 กันยายน 2026", "policy.version": "ฉบับ 1.0"
    }
  };

  function applyLanguage(language) {
    const lang = translations[language] ? language : "en";
    const dictionary = translations[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = dictionary[element.dataset.i18n];
      if (typeof value === "string") element.textContent = value;
    });
    document.querySelectorAll("[data-language]").forEach((button) => {
      const active = button.dataset.language === lang;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try { localStorage.setItem("nextstudio-language", lang); } catch (_) {}
  }

  document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => applyLanguage(button.dataset.language)));
  let initial = "en";
  try { initial = localStorage.getItem("nextstudio-language") || "en"; } catch (_) {}
  applyLanguage(initial);
  const policyPanels = document.querySelectorAll("[data-language-panel]");
  if (policyPanels.length) {
    const updatePolicyLanguage = (language) => policyPanels.forEach((panel) => { panel.hidden = panel.dataset.languagePanel !== language; });
    updatePolicyLanguage(initial === "th" ? "th" : "en");
    document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => updatePolicyLanguage(button.dataset.language)));
  }
  if (location.pathname === "/" || location.pathname.endsWith("/index.html")) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "NextStudio",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Chrome, Chromium, macOS, Windows",
      description: "A local-first browser studio for pitch shifting, AI vocal control, video sync and recording.",
      author: { "@type": "Organization", name: "NextFeeder Labs", email: "nextfeeder.ts@gmail.com" },
      url: `${location.origin}/`
    };
    const schemaNode = document.createElement("script");
    schemaNode.type = "application/ld+json";
    schemaNode.textContent = JSON.stringify(schema);
    document.head.appendChild(schemaNode);
  }
  document.querySelectorAll("[data-current-year]").forEach((element) => { element.textContent = String(new Date().getFullYear()); });
})();
