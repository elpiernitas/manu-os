// Offline shell: every file of the app is cached.
const VERSION = "manuos-v101";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "core/text.js", "core/money.js", "core/modes.js", "core/assistant.js",
  "core/inbox.js", "core/refuge.js", "core/storage.js", "core/notify.js", "core/intake.js", "core/weather.js", "core/bank.js", "core/night.js", "core/life.js", "core/gcal.js", "core/google.js", "core/ai.js", "core/crypto.js", "core/spotify.js", "core/hub.js", "core/insights.js", "core/converse.js", "core/imagestore.js", "core/links.js", "core/projects.js", "core/scene.js", "core/gmail.js", "core/archive.js", "core/archivestore.js", "core/recall.js", "core/diary.js", "core/buzon.js", "core/backup-manager.js", "core/briefing.js", "core/budget.js", "core/find.js", "core/now.js", "core/captures.js", "core/autofile.js", "core/zipwrite.js", "core/contacts.js", "core/closing.js", "core/lowmode.js", "core/clock.js", "core/sync.js", "core/nudges.js", "core/commands.js", "core/split.js", "core/bankshot.js", "core/review.js", "core/docs.js", "core/library.js", "core/quickmoney.js", "core/bahia.js", "core/bahia-draw.js", "core/bahia-svg.js", "core/brain.js", "core/learn.js", "core/proposals.js", "core/conocernos.js", "core/voice.js", "core/memchat.js", "core/memview.js", "core/style.js", "core/topics.js", "core/capabilities.js", "core/cloudprivacy.js", "core/push.js", "core/bankcallback.js", "core/enablebanking.js", "core/bank-ais-view.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // «reload»: skip the browser's HTTP cache (GitHub Pages says max-age=600),
  // or a new version could store the previous files (WEB-66).
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      // Only MANU's old caches: other apps on the same origin keep theirs (QA #7).
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("manuos-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so updates arrive; cache when offline.
// QA ChatGPT 2026-10 (#4, #7):
// - a URL with ?query (old Shortcut links ?di=…, Spotify's ?code=…) is never
//   stored under its own URL: pages are kept under one fixed key, so dictated
//   text or OAuth codes do not end up in Cache Storage;
// - offline, only a page navigation falls back to index.html; a script, image
//   or file that is missing fails as such instead of receiving HTML.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const page = req.mode === "navigate";
  // Only the app itself is cached as a page. Other pages (the bank's return with ?code=, the
  // legal pages) go straight to the network: never stored, never served as the app.
  const scope = new URL(self.registration.scope).pathname;
  if (page && url.pathname !== scope && url.pathname !== `${scope}index.html`) return;
  if (url.pathname.startsWith(`${scope}banco/`)) return;
  const key = page ? "index.html" : url.search ? null : req;
  event.respondWith(
    // «no-cache»: always ask the server (a cheap 304 if nothing changed), so
    // a new version arrives at once instead of up to 10 minutes later (WEB-66).
    fetch(req, { cache: "no-cache" })
      .then((response) => {
        if (response.ok && key) { const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(key, copy)); }
        return response;
      })
      .catch(() => (page ? caches.match("index.html") : key ? caches.match(key) : Promise.resolve(undefined)).then((hit) => hit ?? Response.error())),
  );
});

// WEB-77: a tap opens MANU where the notice points («hoy», «tu/habitos»…).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const go = /^[a-z]+(\/[a-z]+)?$/.test(event.notification.data?.go ?? "") ? event.notification.data.go : "hoy";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => {
    if (list[0]) { list[0].postMessage({ go }); return list[0].focus(); }
    return self.clients.openWindow(`./#ir=${go}`);
  }));
});

// WEB-99: a push from MANU's server (Declarative Web Push JSON). iOS 18.4+ may show it by itself;
// otherwise the worker shows it here. Every push must show a notice (userVisibleOnly), so a
// payload that cannot be read still shows the generic one. Never the server's text unless Manu
// turned «Mostrar el texto» on (the server only has it then).
self.addEventListener("push", (event) => {
  let n = null;
  try { n = event.data?.json()?.notification ?? null; } catch {}
  const body = typeof n?.body === "string" && n.body.trim() ? n.body.slice(0, 160) : "Tienes un recordatorio en MANU";
  const tag = typeof n?.tag === "string" ? n.tag.slice(0, 80) : "manu-push";
  event.waitUntil(self.registration.showNotification("MANU", { body, tag, icon: "icons/icon-192.png", data: { go: "hoy" } }));
});
