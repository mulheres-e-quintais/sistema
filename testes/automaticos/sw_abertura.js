/* 23/10/2026 (teste de desempenho): o service worker abre a página NA HORA com a cópia do aparelho, mesmo com o sinal fraco
   (antes esperava a internet até 3 s a cada abertura), abre sem internet, e versão nova continua chegando (com o aviso).
   O teste sobe o próprio servidor, lento de propósito (o atraso da rede vale também para o service worker, ao contrário
   da simulação de rede do navegador), numa cópia do site, para poder publicar uma "versão nova" no meio.
   Uso: node testes/automaticos/sw_abertura.js <caminho do playwright> */
const { chromium } = require(process.argv[2]);
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const R = []; const ok = (n, c, d = '') => { R.push(c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
const origem = path.join(__dirname, '../..'), raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mq-sw-'));
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'assets']) fs.cpSync(path.join(origem, f), path.join(raiz, f), { recursive: true });
let atraso = 0, desligado = false;
const TIPO = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  if (desligado) { q.socket.destroy(); return; }
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  setTimeout(() => {
    if (u === '/js/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end("window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:''};"); }
    fs.readFile(path.join(raiz, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPO[path.extname(u)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); r.end(d); });
  }, atraso);
});
(async () => {
  await new Promise(ok => srv.listen(0, ok)); const U = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const abriu = () => p.waitForFunction(() => !!window.MQ && !!MQ.ui, null, { timeout: 60000 });
  await p.goto(U); await abriu();
  await p.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
  await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  ok('1. o service worker assume a página', true);
  atraso = 2500; const ts = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await p.reload({ waitUntil: 'domcontentloaded' }); await abriu(); ts.push(Date.now() - t); }
  ok('2. sinal fraco (2,5 s por resposta): a página abre na hora com a cópia do aparelho (menos de 1,5 s)', Math.max(...ts) < 1500, ts.join(', ') + ' ms');
  atraso = 0; desligado = true;
  { const t = Date.now(); await p.reload({ waitUntil: 'domcontentloaded' }); await abriu(); ok('3. sem internet: abre com a cópia do aparelho', true, (Date.now() - t) + ' ms'); }
  { await p.goto(U + '?c=codigo-do-link', { waitUntil: 'domcontentloaded' }); await abriu(); ok('4. sem internet: link com parâmetro (cadastro pelo link) também abre', true); }
  desligado = false;
  // versão nova publicada: muda o sw.js (VERSAO) e a página
  fs.writeFileSync(path.join(raiz, 'sw.js'), fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8').replace(/mq-v\d+/, 'mq-v99999'));
  fs.writeFileSync(path.join(raiz, 'index.html'), fs.readFileSync(path.join(raiz, 'index.html'), 'utf8').replace('</head>', '<meta name="versao-teste" content="nova">\n</head>'));
  await p.reload(); await abriu();
  ok('5. versão nova: aparece "Há uma versão nova. Toque para atualizar"', await p.waitForSelector('#versao-nova', { timeout: 20000 }).then(() => true).catch(() => false));
  const guardada = await p.evaluate(async () => { const c = await caches.open('mq-v99999'); const r = await c.match('index.html'); return !!r && /versao-teste/.test(await r.text()); });
  ok('6. versão nova: a página guardada no aparelho já é a nova (abre a nova na próxima vez)', guardada);
  await p.reload(); await abriu();
  ok('7. na abertura seguinte, a página servida é a nova', await p.evaluate(() => !!document.querySelector('meta[name=versao-teste]')));
  ok('sem erro de página', !errs.length, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close(); fs.rmSync(raiz, { recursive: true, force: true });
  const f = R.filter(x => !x).length; console.log(`TOTAL ${R.length} FALHAS ${f}`); process.exit(f ? 1 : 0);
})();
