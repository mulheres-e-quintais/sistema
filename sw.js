/* Guarda as telas do sistema no aparelho para abrir sem internet.
   Os dados continuam vindo do servidor; formulários offline entram na próxima etapa. */
const VERSAO = 'mq-v1';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/dados.js', 'js/regras.js',
  'js/api-demo.js', 'js/api-supabase.js', 'js/app.js', 'assets/logo-claro.svg', 'assets/isotipo.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // API do Supabase passa direto
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
