/* FLAP service worker */
var BUILD = "__BUILD__";
var CACHE = "flap-v3-" + BUILD;
var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.webmanifest",
  "./icon-192.svg",
  "./icon-512.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./og-image.png",
  "./404.html",
  "./robots.txt",
  "./sitemap.xml",
];

function sameOrigin(url) {
  try {
    return new URL(url, self.location.href).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function cacheOk(req, res) {
  try {
    if (!res || res.status !== 200 || req.method !== "GET" || !sameOrigin(req.url)) return;
    if (res.type === "opaque") return;
    var copy = res.clone();
    caches
      .open(CACHE)
      .then(function (c) {
        return c.put(req, copy);
      })
      .catch(function () {});
  } catch (e) {}
}

function offlinePage(navigation) {
  if (!navigation) {
    return Promise.resolve(
      new Response("FLAP is offline.", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
  return caches.match("./index.html").then(function (page) {
    return (
      page ||
      new Response("FLAP is offline.", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          ASSETS.map(function (url) {
            return cache.add(url).catch(function () {});
          })
        );
      })
      .then(function () {
        if (!self.registration.active) return self.skipWaiting();
      })
      .catch(function () {
        if (!self.registration.active) return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== CACHE && key.indexOf("flap-") === 0) return caches.delete(key);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("message", function (event) {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (!req || req.method !== "GET") return;
  if (!sameOrigin(req.url)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          cacheOk(req, res);
          return res;
        })
        .catch(function () {
          return caches.match(req, { ignoreSearch: true }).then(function (hit) {
            return hit || offlinePage(true);
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req)
        .then(function (res) {
          cacheOk(req, res);
          return res;
        })
        .catch(function () {
          if (hit) return hit;
          return offlinePage(false);
        });
      if (hit) {
        event.waitUntil(
          net
            .then(function () {})
            .catch(function () {})
        );
        return hit;
      }
      return net;
    })
  );
});
