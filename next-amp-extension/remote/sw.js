const CACHE_VERSION = "v2026-01-17-1811";
const CACHE_NAME = `nextamp-${CACHE_VERSION}`;

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
      console.log(`[SW] Installing new version: ${CACHE_VERSION}`);
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log(`[SW] Deleting old cache: ${key}`);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log(`[SW] ${CACHE_VERSION} is now controlling the page.`);
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", (e) => {
  if (!e.request.url.startsWith("http")) return;

  e.respondWith(
    caches.match(e.request).then((response) => {
      return (
        response ||
        fetch(e.request).then((fetchRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, fetchRes.clone());
            return fetchRes;
          });
        })
      );
    })
  );
});
