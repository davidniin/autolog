// Service worker mínimo: la app abre aunque no haya cobertura (p. ej. en una gasolinera). La API (/v1) nunca se cachea aquí:
// los datos sin red los guarda la propia app en localStorage (src/store.js).
const CACHE = 'autolog-v4';
// Motor del lector de facturas (onnxruntime-web, versión fija): se guarda para poder escanear sin cobertura.
// Los modelos del lector los guarda la propia librería en su caché (runonweb-ppocrv6), que aquí no se toca.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@';
const ORT_CACHE = 'autolog-ort';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // Solo se borran las cachés antiguas de la app (autolog-vN), nunca las de los modelos
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => /^autolog-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'GET' && url.href.startsWith(ORT)) {
    e.respondWith(caches.open(ORT_CACHE).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }))));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/v1/')) return;
  // Páginas: red primero (para tener siempre la última versión), caché si no hay red
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r; })
      .catch(() => caches.match('/')));
    return;
  }
  // assets/ (nombre con hash), iconos: caché primero
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});

// ------------------------------------------------------------ notificaciones push (avisos de ITV, aceite...)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'AutoLog', {
    body: d.body || '',
    tag: d.tag, // el mismo aviso sustituye al anterior en vez de acumularse
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: d.url || '/' },
  }));
});

// Tocar la notificación abre la app (o la trae al frente si ya estaba abierta)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => new URL(c.url).origin === location.origin);
    return w ? w.focus() : self.clients.openWindow(url);
  }));
});
