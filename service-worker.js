const CONFIRMAE_CACHE_NAME = "confirmae-cache-v3";

const CONFIRMAE_CORE_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./master.html",
  "./convite.html",
  "./portaria.html",
  "./manual.html",
  "./checkout.html",
  "./pagamento.html",
  "./manifest.webmanifest",
  "./assets/css/style.css",
  "./assets/js/theme.js",
  "./assets/js/firebase-config.js",
  "./assets/js/app.js",
  "./assets/js/admin.js",
  "./assets/js/master.js",
  "./assets/js/portaria.js",
  "./assets/js/pwa.js",
  "./assets/js/animations.js",
  "./assets/img/confirmae-icon.png",
  "./assets/img/confirmae-logo.png",
  "./assets/img/confirmae-logo-horizontal.png",
  "./assets/img/vidal-design-logo.png",
  "./assets/img/pwa-icon-192.png",
  "./assets/img/pwa-icon-512.png",
  "./assets/img/mockup-painel.png",
  "./assets/img/mockup-convite.png",
  "./assets/img/mockup-portaria.png",
  "./assets/img/mockup-checkout.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CONFIRMAE_CACHE_NAME)
      .then((cache) => cache.addAll(CONFIRMAE_CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CONFIRMAE_CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "manifest"
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CONFIRMAE_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return caches.match("./index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CONFIRMAE_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}
