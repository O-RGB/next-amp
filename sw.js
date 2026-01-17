const CACHE_VERSION = "v2026-01-17-8501";
const CACHE_NAME = `nextamp-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./assets/libs/mjs/SignalsmithStretch.mjs",
  "./assets/libs/js/obfuscator.js",
  "./assets/libs/js/lame.min.js",
  "./assets/libs/worker/mp3-worker.js",
  "./assets/logo/logo.png",
  "./assets/sounds/startup.mp3",
  "./assets/sounds/allow-sound.mp3",
  "./assets/libs/js/tailwindcss.js",
  "https://unpkg.com/@phosphor-icons/web",
  "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Inter:wght@300;400;600&family=Sarabun:wght@300;400;600&display=swap",
];

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );

  self.skipWaiting(); // 🔥 บังคับใช้ SW ใหม่ทันที
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // 🔥 ลบ cache เก่า
          }
        })
      )
    )
  );

  self.clients.claim(); // 🔥 คุมหน้าเดี๋ยวนี้
});

// ===== FETCH =====
self.addEventListener("fetch", (event) => {
  // HTML → network first (เพื่อ update)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ไฟล์อื่น → cache first
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy));
          return res;
        })
    )
  );
});
