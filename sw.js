// Service worker: aplikace funguje offline. BUILD nahrazuje deploy workflow.
const BUILD = '__BUILD__';
const SHELL = `albert-shell-${BUILD}`;
const AUDIO = 'albert-audio';
const FONTS = 'albert-fonts';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/storage.js', 'js/srs.js', 'js/audio.js', 'js/exercises.js', 'js/albert.js',
  'data/items.json', 'data/albert.json', 'audio/manifest.json',
  'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('albert-shell-') && k !== SHELL).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // písma a nahrávky: nejdřív cache
  if (url.hostname.includes('fonts.g') || /\/audio\/[0-9a-f]+\.mp3$/.test(url.pathname)) {
    const name = url.pathname.endsWith('.mp3') ? AUDIO : FONTS;
    e.respondWith(caches.open(name).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // vlastní soubory: síť, při výpadku cache
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
