/* Registro Rápido N1 · service worker
   Cache-first para el shell de la app. Nunca cachea Graph, Gmail ni el login. */

const CACHE = "rrn1-shell-v11";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];
const CDN_MSAL = "https://alcdn.msauth.net/";

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;

  // La librería de Microsoft se guarda al vuelo para que la app abra sin red.
  if (!mismoOrigen && req.url.indexOf(CDN_MSAL) === 0) {
    ev.respondWith(
      caches.match(req).then((hit) => {
        const red = fetch(req).then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        }).catch(() => hit);
        return hit || red;
      })
    );
    return;
  }

  // Todo lo demás fuera del origen (Graph, Gmail, login) va directo a la red.
  if (!mismoOrigen) return;

  // La configuración central se pide siempre a la red: es la que manda.
  // El caché queda solo como respaldo para cuando no hay señal.
  if (url.pathname.endsWith("/config.json")) {
    ev.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === "navigate") {
    ev.respondWith(
      caches.match("./index.html").then((hit) => hit || fetch(req))
    );
    return;
  }

  ev.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      });
    })
  );
});
