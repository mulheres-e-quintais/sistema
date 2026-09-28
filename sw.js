/* Guarda o sistema no aparelho para abrir e preencher fichas sem internet.
   Os dados vão para o servidor pela fila do próprio app quando a conexão volta. */
const VERSAO = 'mq-v77';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/dados.js', 'js/regras.js',
  'js/api-demo.js', 'js/api-supabase.js', 'js/fila.js', 'js/fichas.js', 'js/geo.js', 'js/painel.js', 'js/campo.js', 'js/vitrine.js', 'js/custos.js', 'js/fic.js', 'js/pagamentos.js', 'js/impacto.js', 'js/convites.js', 'js/banco.js', 'js/pendencias.js', 'js/ajuda.js', 'js/mascaras.js', 'js/sugestao.js', 'js/app.js',
  'assets/logo-claro.svg', 'assets/isotipo.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
const EXTERNOS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const proprio = u.origin === location.origin;
  if (!proprio && !EXTERNOS.includes(u.hostname)) return;   // API do Supabase passa direto
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSAO).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || (proprio ? caches.match('index.html') : Response.error()))));
});
