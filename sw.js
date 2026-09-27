const CACHE_NAME = "studenthub-shell-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./admin.js",
  "./debug.js",
  "./manifest.json",
  "./assets/studenthub-mark.svg",
  "./assets/studenthub-logo.svg",
  "./assets/studenthub-favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Navigation requests prefer the live site so deployments are picked up.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Application code stays fresh: use network-first for JS/CSS/manifest,\n  // then fall back to the cached copy when offline.\n  const pathname = new URL(request.url).pathname;\n  const isAppCode = /\\.(?:js|css)$/.test(pathname) || pathname.endsWith("/manifest.json");\n\n  if (isAppCode) {\n    event.respondWith(\n      fetch(request)\n        .then((response) => {\n          if (response && response.ok) {\n            const copy = response.clone();\n            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));\n          }\n          return response;\n        })\n        .catch(() => caches.match(request))\n    );\n    return;\n  }\n\n  // Images and other static assets use cache-first for fast repeat loads.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
