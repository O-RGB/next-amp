const CACHE_NAME = "nextamp-v1";
// รายชื่อไฟล์ที่ต้องการให้ใช้งานแบบ Offline ได้
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./assets/libs/mjs/SignalsmithStretch.mjs",
  "./assets/logo/logo.png",
  "./assets/sounds/startup.mp3",
  "./assets/sounds/allow-sound.mp3",
];

// ติดตั้ง Service Worker และเก็บไฟล์ลง Cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// จัดการการดึงข้อมูล (Fetch) โดยให้ดูใน Cache ก่อน ถ้าไม่มีค่อยไปโหลดจากเน็ต
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
