// Zaino Smart: tutto l'occorrente resta sul dispositivo, così l'app funziona anche senza internet.
// APP = la pagina (cambia a ogni aggiornamento), LIB = librerie e caratteri (grandi, si scaricano una volta sola).
const APP = 'zaino-app-v8';
const LIB = 'zaino-lib-1';
const BASE = ['./', 'index.html', 'manifest.json', 'icon.svg', 'lib/fonts.css'];
const LIBS = [
  'lib/tesseract.min.js', 'lib/worker.min.js', 'lib/tesseract-core-lstm.wasm.js', 'lib/tesseract-core-simd-lstm.wasm.js', 'lib/ita.traineddata.gz',
  'lib/pdf.min.js', 'lib/pdf.worker.min.js', 'lib/mammoth.browser.min.js',
  'lib/fonts/Lexend-400.woff2', 'lib/fonts/AtkinsonHyperlegible-400.woff2', 'lib/fonts/AtkinsonHyperlegible-700.woff2', 'lib/fonts/AtkinsonHyperlegibleMono-400.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(APP)).addAll(BASE);
    const lib = await caches.open(LIB);
    // una libreria che non arriva non blocca l'installazione: la pagina la riprova da Opzioni
    await Promise.all(LIBS.map(async u => { if (!await lib.match(u)) try { await lib.add(u); } catch (_) {} }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== LIB).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// rete con tempo massimo: con internet lento o assente si usa subito la copia salvata
const conTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('lento')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/lib/')){
    e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(r => {
      if (r.ok){ const copy = r.clone(); caches.open(LIB).then(c => c.put(req, copy)); }
      return r;
    })));
    return;
  }
  e.respondWith(conTimeout(fetch(req), 4000).then(r => {
    if (r.ok){ const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); }
    return r;
  }).catch(async () => (await caches.match(req, {ignoreSearch: true})) || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list.length ? list[0].focus() : self.clients.openWindow('./index.html#compiti')));
});
