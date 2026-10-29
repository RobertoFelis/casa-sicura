// Service worker: fa funzionare l'app anche senza connessione.
// Cambiare VERSION a ogni rilascio per aggiornare la copia salvata.
const VERSION = 'shk-v4';
const CORE = [
  './', 'index.html', 'content.js', 'pages.js', 'house3d.js', 'account.js', 'privacy.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  'vendor/three.min.js', 'vendor/supabase.min.js', 'fonts/fredoka-latin.woff2', 'fonts/fredoka-latin-ext.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Prima la rete (così gli aggiornamenti arrivano subito), poi la copia salvata se si è offline.
// Le chiamate al database non si salvano mai: contengono dati personali.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
