/* Guarda o sistema no aparelho para abrir e preencher fichas sem internet.
   Os dados vão para o servidor pela fila do próprio app quando a conexão volta. */
const VERSAO = 'mq-v313';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/tudo.js',
  'assets/logo-claro.svg', 'assets/isotipo.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
const EXTERNOS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// cada versão nova confere cada arquivo com o servidor ("no-cache": pergunta se mudou; se não mudou, não baixa de novo).
// 13/10/2026: era "reload", que baixava tudo de novo logo no primeiro acesso (cerca de 600 KB a mais no 3G). Continua sem
// o risco de guardar arquivo velho do cache do navegador, porque "no-cache" sempre confirma com o servidor.
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO)
  .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting())));
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
  if (proprio && u.pathname.includes('/manuais/')) return;   // manuais em PDF: direto da internet, sem guardar no aparelho (são grandes)
  /* a página: 23/10/2026 (teste de desempenho) abre NA HORA com a cópia do aparelho e confere a internet por trás.
     Antes esperava a internet até 3 s a cada abertura: no sinal fraco do campo, toda abertura demorava. A página guardada
     não fica velha: versão nova do sistema chega por este arquivo (VERSAO), que guarda tudo de novo e mostra
     "Há uma versão nova. Toque para atualizar". Página que não está guardada (simulação, primeira visita) vem da internet. */
  if (e.request.mode === 'navigate') {
    const rede = comPrazo(e.request, 3000);
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => { if (r) { rede.catch(() => {}); return r; } return rede; })
      .catch(() => caches.match('index.html')));
    e.waitUntil(rede.catch(() => {}));
    return;
  }
  // arquivos do sistema, biblioteca e fontes: abre do aparelho na hora; o que não estiver guardado vem da internet
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => guardar(e.request, x)))
    .catch(() => proprio ? caches.match(e.request) : Response.error()));
});
