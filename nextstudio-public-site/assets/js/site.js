(function () {
  "use strict";

  const translations = {
    en: {
      skip: "Skip to content",
      "nav.features": "Features", "nav.compatibility": "Compatibility", "nav.remote": "Remote", "nav.privacy": "Privacy", "nav.getStarted": "View features",
      "hero.eyebrow": "BROWSER AUDIO TOOLS", "hero.title": "Audio tools for your browser.",
      "hero.lede": "Adjust pitch, AI vocal modes, video sync and recording from a browser extension.",
      "hero.primary": "View features", "hero.microcopy": "AI vocal processing loads only when enabled.",
      "proof.realtime": "Pitch", "proof.aiVocal": "AI Vocal", "proof.remote": "Remote", "strip.label": "Available features",
      "features.eyebrow": "FEATURES", "features.title": "Tools for listening,\npractice and recording.", "features.lede": "Use the controls you need to adjust audio, video and recordings in your browser.",
      "feature.ai.kicker": "AI VOCAL CONTROL", "feature.ai.title": "AI vocal\nmodes.", "feature.ai.body": "Enable Karaoke or Acapella when you need vocal separation. ECO and FULL profiles are available for different devices.",
      "feature.pitch.kicker": "MUSICAL CONTROL", "feature.pitch.title": "Pitch and\neffects.", "feature.pitch.body": "Change pitch, adjust reverb and manage levels with simple controls.",
      "feature.video.kicker": "VISUAL SYNC", "feature.video.title": "Video and\nsync settings.", "feature.video.body": "Adjust delay, zoom, rotation and quality for the current media tab.",
      "feature.remote.kicker": "REMOTE + RECORDING", "feature.remote.title": "Remote control\nand recording.", "feature.remote.body": "Control an active session from another device, or record a take locally for playback, download and delete.",
      "hardware.eyebrow": "COMPATIBILITY", "hardware.title": "Browser and\ndevice support.", "hardware.body": "NextStudio uses the browser capabilities available on your device. AI is optional, and lighter processing is available when a machine has less headroom.", "hardware.link": "Read the privacy policy",
      "hardware.webgpu.title": "WebGPU / WebGL", "hardware.webgpu.body": "Browser acceleration selected by the device", "hardware.native.title": "Optional Go engine", "hardware.native.body": "A native path for supported Windows workflows", "hardware.mode.title": "ECO / FULL profiles", "hardware.mode.body": "Choose a lighter or higher-quality AI profile", "hardware.foot": "Acceleration depends on the browser and available hardware.", "hardware.status": "CONFIGURABLE",
      "workflow.eyebrow": "WORKFLOW", "workflow.title": "Use only the\ntools you need.", "workflow.body": "Open a supported media tab, select a feature and continue working. AI stays off until you enable a vocal mode.", "workflow.one.title": "Choose a source", "workflow.one.body": "Open your music or video in a supported browser tab.", "workflow.two.title": "Choose a feature", "workflow.two.body": "Adjust pitch, vocal mode, effects and video timing.", "workflow.three.title": "Listen or record", "workflow.three.body": "Use the session as it is, or save a take locally.",
      "faq.eyebrow": "QUESTIONS", "faq.title": "Frequently\nasked.", "faq.ai.q": "When does AI load?", "faq.ai.a": "Only after you turn on an AI vocal mode. The public page never preloads the model.", "faq.remote.q": "What does Remote control?", "faq.remote.a": "Remote sends validated control values such as volume, pitch, vocal mode and video timing. It does not carry the audio stream.", "faq.data.q": "Where are recordings stored?", "faq.data.a": "Recordings and preferences are designed to stay in the local browser or Extension storage. You can play, download or delete your own takes.", "faq.compat.q": "Will every GPU perform the same?", "faq.compat.a": "No. Browser acceleration depends on the browser, driver, operating system and available hardware. NextStudio exposes lighter options for constrained devices.",
      "cta.eyebrow": "NEXTSTUDIO", "cta.title": "Audio tools for\neveryday use.", "cta.primary": "View features", "cta.contact": "Contact the team", "footer.tagline": "Browser audio tools by NextFeeder Labs.", "footer.contact": "Contact", "footer.support": "Support the project", "footer.built": "Developed by NextFeeder Labs.",
      "policy.label": "PRIVACY & TRUST", "policy.title": "Privacy Policy", "policy.intro": "A clear description of how NextStudio handles information.", "policy.effective": "Effective date: September 12, 2026", "policy.version": "Version 1.0"
    },
    th: {
      skip: "ข้ามไปยังเนื้อหา", "nav.features": "ฟีเจอร์", "nav.compatibility": "อุปกรณ์ที่รองรับ", "nav.remote": "รีโมต", "nav.privacy": "ความเป็นส่วนตัว", "nav.getStarted": "ดูฟีเจอร์",
      "hero.eyebrow": "เครื่องมือเสียงบน BROWSER", "hero.title": "เครื่องมือเสียงสำหรับ BROWSER",
      "hero.lede": "ปรับคีย์ โหมดเสียงร้อง เอฟเฟกต์ วิดีโอ และบันทึกเสียงจาก browser extension",
      "hero.primary": "ดูฟีเจอร์", "hero.microcopy": "AI vocal จะโหลดเมื่อเปิดใช้เท่านั้น", "proof.realtime": "Pitch", "proof.aiVocal": "AI Vocal", "proof.remote": "Remote", "strip.label": "ฟีเจอร์ที่มีให้ใช้",
      "features.eyebrow": "ฟีเจอร์", "features.title": "เครื่องมือสำหรับฟัง\nซ้อม และบันทึกเสียง", "features.lede": "ใช้การควบคุมที่ต้องการเพื่อปรับเสียง วิดีโอ และเสียงบันทึกใน browser",
      "feature.ai.kicker": "ควบคุมเสียงร้องด้วย AI", "feature.ai.title": "โหมด AI vocal", "feature.ai.body": "เปิด Karaoke หรือ Acapella เมื่อต้องการแยกเสียงร้อง พร้อมโปรไฟล์ ECO และ FULL สำหรับอุปกรณ์ที่ต่างกัน",
      "feature.pitch.kicker": "ควบคุมทางดนตรี", "feature.pitch.title": "Pitch และเอฟเฟกต์", "feature.pitch.body": "เปลี่ยนคีย์ ปรับ reverb และจัดการระดับเสียงด้วยปุ่มที่เข้าใจง่าย",
      "feature.video.kicker": "ซิงก์ภาพและเสียง", "feature.video.title": "วิดีโอและการตั้งค่า sync", "feature.video.body": "ปรับ delay, zoom, rotation และ quality ให้เหมาะกับแท็บสื่อปัจจุบัน",
      "feature.remote.kicker": "รีโมต + บันทึกเสียง", "feature.remote.title": "รีโมตและบันทึกเสียง", "feature.remote.body": "ควบคุม session จากอุปกรณ์อื่น หรือบันทึกเทคไว้ในเครื่องเพื่อเล่น ดาวน์โหลด หรือลบ",
      "hardware.eyebrow": "อุปกรณ์ที่รองรับ", "hardware.title": "การรองรับของ browser\nและอุปกรณ์", "hardware.body": "NextStudio ใช้ความสามารถของ browser และอุปกรณ์ที่มี AI เป็นตัวเลือก และมีการประมวลผลที่เบาลงสำหรับเครื่องที่มีทรัพยากรจำกัด", "hardware.link": "อ่านนโยบายความเป็นส่วนตัว",
      "hardware.webgpu.title": "WebGPU / WebGL", "hardware.webgpu.body": "การเร่งผลของ browser ตามอุปกรณ์", "hardware.native.title": "Go engine เสริม", "hardware.native.body": "เส้นทาง native สำหรับ workflow บน Windows ที่รองรับ", "hardware.mode.title": "โปรไฟล์ ECO / FULL", "hardware.mode.body": "เลือกโปรไฟล์ที่เบากว่าหรือคุณภาพสูงกว่า", "hardware.foot": "การเร่งผลขึ้นกับ browser และฮาร์ดแวร์ที่มี", "hardware.status": "ตั้งค่าได้",
      "workflow.eyebrow": "เวิร์กโฟลว์", "workflow.title": "ใช้เฉพาะ\nเครื่องมือที่ต้องการ", "workflow.body": "เปิดแท็บสื่อที่รองรับ เลือกฟีเจอร์ แล้วใช้งานต่อ AI จะปิดอยู่จนกว่าจะเปิดโหมด vocal", "workflow.one.title": "เลือกแหล่งเสียง", "workflow.one.body": "เปิดเพลงหรือวิดีโอในแท็บ browser ที่รองรับ", "workflow.two.title": "เลือกฟีเจอร์", "workflow.two.body": "ปรับคีย์ โหมดเสียงร้อง เอฟเฟกต์ หรือการตั้งค่าวิดีโอ", "workflow.three.title": "ฟังหรือบันทึก", "workflow.three.body": "ใช้งาน session ต่อ หรือบันทึกเทคไว้ในเครื่อง",
      "faq.eyebrow": "คำถาม", "faq.title": "คำถามที่\nพบบ่อย", "faq.ai.q": "AI จะโหลดเมื่อไหร่?", "faq.ai.a": "หลังจากคุณเปิดโหมด AI vocal เท่านั้น หน้าเว็บสาธารณะจะไม่โหลดโมเดลล่วงหน้า", "faq.remote.q": "Remote ควบคุมอะไรได้บ้าง?", "faq.remote.a": "Remote ส่งค่าที่ตรวจสอบแล้ว เช่น volume, pitch, vocal mode และ video timing โดยไม่ส่ง audio stream", "faq.data.q": "เสียงที่บันทึกเก็บไว้ที่ไหน?", "faq.data.a": "เสียงที่บันทึกและการตั้งค่าจะอยู่ใน browser หรือ Extension storage ในเครื่อง คุณเล่น ดาวน์โหลด หรือลบเทคของตัวเองได้", "faq.compat.q": "GPU ทุกเครื่องทำงานเหมือนกันไหม?", "faq.compat.a": "ไม่เหมือนกัน การเร่งผลขึ้นกับ browser, driver, ระบบปฏิบัติการ และฮาร์ดแวร์ NextStudio จึงมีตัวเลือกที่เบากว่าสำหรับเครื่องที่จำกัด",
      "cta.eyebrow": "NEXTSTUDIO", "cta.title": "เครื่องมือเสียง\nสำหรับใช้งานทุกวัน", "cta.primary": "ดูฟีเจอร์", "cta.contact": "ติดต่อทีม", "footer.tagline": "เครื่องมือเสียงบน browser โดย NextFeeder Labs", "footer.contact": "ติดต่อ", "footer.support": "สนับสนุนโปรเจกต์", "footer.built": "พัฒนาโดย NextFeeder Labs",
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
