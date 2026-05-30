const CACHE = 'matchpro-v8.0.0';
const ASSETS = [
  '/matchpro/dashboard',
  '/matchpro/manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.includes('/api/')) {
    // network first for API
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    // cache first for shell
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
