/**
 * getmi.ai — Service Worker
 * Cache-first para assets estáticos.
 * Network-first para HTML e APIs externas.
 *
 * Bump CACHE_VERSION ao fazer deploy com breaking changes nos assets.
 */

const CACHE_VERSION  = 'v1';
const CACHE_NAME     = 'getmi-' + CACHE_VERSION;
const CACHE_OFFLINE  = 'getmi-offline-' + CACHE_VERSION;

/* Assets que serão pré-cacheados no install */
const PRECACHE_ASSETS = [
  /* Libs */
  '/lib/jquery.min.js',
  '/lib/bootstrap.min.css',
  '/lib/bootstrap.bundle.min.js',
  '/lib/slick.min.js',
  '/lib/slick.min.css',
  '/lib/slick-theme.min.css',
  '/lib/qr-code-styling.min.js',
  '/lib/clipboard.min.js',
  /* App CSS */
  '/css/landing.css',
  '/css/auth.css',
  '/css/linkpage.css',
  '/admin/css/admin.css',
  '/admin/css/links.css',
  '/admin/css/design.css',
  /* App JS */
  '/js/sw-register.js',
  '/js/analytics.js',
  '/js/auth.js',
  '/js/linkpage.js',
  '/admin/js/admin-links.js',
  '/admin/js/admin-design.js',
  /* HTML admin (offline-first) */
  '/admin/',
  '/admin/links.html',
  '/admin/design.html',
  /* Fallback pages */
  '/login.html',
  '/404.html',
  /* Manifest */
  '/manifest.json',
];

/* ─── INSTALL ────────────────────────────────────────────────────────────── */
self.addEventListener('install', function (e) {
  self.skipWaiting();

  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(
        PRECACHE_ASSETS.map(function (url) {
          return new Request(url, { cache: 'reload' });
        })
      );
    })
  );
});

/* ─── ACTIVATE ───────────────────────────────────────────────────────────── */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME && k !== CACHE_OFFLINE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ─── FETCH ──────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);

  /* Ignore non-GET, non-http(s) and cross-origin except Google Fonts */
  if (req.method !== 'GET') return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  /* External: Google Fonts — stale-while-revalidate */
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  /* External: Firebase SDK, Firebase APIs — network-only */
  if (url.hostname.includes('firebasejs') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return; /* let browser handle it */
  }

  /* Same-origin only from here */
  if (url.origin !== self.location.origin) return;

  var path = url.pathname;

  /* HTML documents — network-first (always get fresh content) */
  if (req.destination === 'document' ||
      path.endsWith('.html') ||
      path === '/' ||
      path.endsWith('/admin/') ||
      path.endsWith('/admin')) {
    e.respondWith(networkFirst(req));
    return;
  }

  /* Static assets (/lib/, /css/, /js/, /img/, /admin/css/, /admin/js/)
     — cache-first (versioned filenames; bump CACHE_VERSION to invalidate) */
  if (path.startsWith('/lib/') ||
      path.startsWith('/css/') ||
      path.startsWith('/js/') ||
      path.startsWith('/img/') ||
      path.startsWith('/admin/css/') ||
      path.startsWith('/admin/js/')) {
    e.respondWith(cacheFirst(req));
    return;
  }

  /* Everything else — network-first */
  e.respondWith(networkFirst(req));
});

/* ─── STRATEGIES ─────────────────────────────────────────────────────────── */

function cacheFirst(req) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(req).then(function (cached) {
      if (cached) return cached;

      return fetch(req).then(function (res) {
        if (res && res.status === 200) {
          cache.put(req, res.clone());
        }
        return res;
      });
    });
  });
}

function networkFirst(req) {
  return fetch(req)
    .then(function (res) {
      if (res && res.status === 200) {
        caches.open(CACHE_NAME).then(function (c) { c.put(req, res.clone()); });
      }
      return res;
    })
    .catch(function () {
      return caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cached) {
          return cached || cache.match('/404.html');
        });
      });
    });
}

function staleWhileRevalidate(req) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var networkFetch = fetch(req).then(function (res) {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      });
      return cached || networkFetch;
    });
  });
}
