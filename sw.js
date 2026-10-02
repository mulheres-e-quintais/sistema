/* Guarda o sistema no aparelho para abrir e preencher fichas sem internet.
   Os dados vão para o servidor pela fila do próprio app quando a conexão volta. */
const VERSAO = 'mq-v177';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/tudo.js',
  'assets/logo-claro.svg', 'assets/isotipo.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
const EXTERNOS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// cada versão nova baixa tudo de novo, sem passar pelo cache do navegador (senão podia guardar arquivo velho)
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO)
  .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const guardar = (req, r) => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); } return r; };
// internet com prazo: se não responder em ms milissegundos, usa a cópia do aparelho (se houver)
const comPrazo = (req, ms) => new Promise((ok, falha) => {
  let feito = false; const t = setTimeout(() => caches.match(req).then(r => { if (r && !feito) { feito = true; ok(r); } }), ms);
  fetch(req).then(r => { clearTimeout(t); guardar(req, r); if (!feito) { feito = true; ok(r); } })
    .catch(() => { clearTimeout(t); caches.match(req).then(r => { if (!feito) { feito = true; r ? ok(r) : falha(); } }); });
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const proprio = u.origin === location.origin;
  if (!proprio && !EXTERNOS.includes(u.hostname)) return;   // API do Supabase passa direto
  // a página: internet com prazo de 3 s (para pegar versão nova); sem sinal, abre a guardada
  if (e.request.mode === 'navigate') {
    e.respondWith(comPrazo(e.request, 3000).catch(() => caches.match('index.html')));
    return;
  }
  // arquivos do sistema, biblioteca e fontes: abre do aparelho na hora; o que não estiver guardado vem da internet
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => guardar(e.request, x)))
    .catch(() => proprio ? caches.match(e.request) : Response.error()));
});
