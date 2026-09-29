// Offline shell: every file of the app is cached; data never leaves the device.
const VERSION = "manuos-v14";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "core/text.js", "core/money.js", "core/modes.js", "core/assistant.js",
  "core/inbox.js", "core/refuge.js", "core/storage.js", "core/notify.js", "core/intake.js", "core/weather.js", "core/bank.js", "core/night.js", "core/life.js", "core/gcal.js", "core/google.js", "core/ai.js", "core/crypto.js", "core/spotify.js", "core/hub.js", "core/insights.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so updates arrive; cache when offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("index.html"))),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow("./"))));
});
