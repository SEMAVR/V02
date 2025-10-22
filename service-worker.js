// service-worker.js
const CACHE_NAME = "mayak-finder-cache-v3";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css", 
  "./script.js",
  "./history-manager.js",
  "./settings.js",
  "./ble-manager-compatible.js",
  "./manifest.json",
  "./offline.html",
  "./icon-192.png",
  "./icon-512.png",
  "https://unpkg.com/leaflet/dist/leaflet.css",
  "https://unpkg.com/leaflet/dist/leaflet.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Кеш открыт");
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error("Ошибка кеширования:", error);
      })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log("Удаление старого кеша:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", event => {
  // Не кешируем внешние карты и API
  if (event.request.url.includes('google') || 
      event.request.url.includes('yandex') ||
      event.request.url.includes('2gis') ||
      event.request.url.includes('bluetooth')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Кешируем только GET запросы и локальные ресурсы
            if (event.request.method === 'GET' && 
                event.request.url.startsWith(self.location.origin)) {
              return caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, fetchResponse.clone());
                  return fetchResponse;
                });
            }
            return fetchResponse;
          })
          .catch(() => {
            // При ошибке сети показываем офлайн-страницу
            if (event.request.destination === 'document') {
              return caches.match('./offline.html');
            }
          });
      })
  );
});
