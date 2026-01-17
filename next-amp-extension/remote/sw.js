const CACHE_NAME = "nextamp-remote-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "../assets/js/tailwindcss.js",
  "../assets/js/peerjs.min.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching assets");
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return (
        response ||
        fetch(e.request).then((fetchRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            if (e.request.url.startsWith("http")) {
              cache.put(e.request, fetchRes.clone());
            }
            return fetchRes;
          });
        })
      );
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
});
