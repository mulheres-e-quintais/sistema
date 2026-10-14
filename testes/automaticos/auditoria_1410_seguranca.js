/* Auditoria de segurança do lado do navegador (14/10/2026). Cada caso diz o comportamento SEGURO esperado; FALHOU = achado.
   Uso: node auditoria_1410_seguranca.js <caminho do playwright>
   (servidor de teste em http://localhost:8766 — o mesmo dos outros testes automáticos; o caso do iframe sobe sozinho
   uma página "de fora" em http://127.0.0.1:8767) */
const fs = require('fs'); const path = require('path'); const http = require('http');
const RAIZ = path.join(__dirname, '..', '..'); const JS = path.join(RAIZ, 'js');
const R = []; const ok = (n, c, d = '') => { R.push(c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d ? ' | ' + d : '')); };
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const fontes = fs.readdirSync(JS).filter(f => f.endsWith('.js') && f !== 'tudo.js').map(f => ['js/' + f, ler('js/' + f)]);

// ===== estáticos =====
// 1. link que abre outra aba sem rel=noopener (a página aberta controlaria esta pela window.opener)
{ const ruins = [];
  for (const [f, t] of fontes.concat([['index.html', ler('index.html')]])) {
    const re = /<a\b[^>]*target=\\?["']_blank\\?["'][^>]*>/gi; let m;
    while ((m = re.exec(t))) if (!/noopener|noreferrer/.test(m[0])) ruins.push(f + ': ' + m[0].slice(0, 80));
  }
  ok('1. todo link target=_blank tem rel=noopener', !ruins.length, ruins.slice(0, 3).join(' || ')); }

// 2. planilhas (.csv): célula que começa com = + - @ TAB CR sai como texto (sem fórmula no Excel/LibreOffice)
{ const achar = (f, nome) => { const t = ler(f); const m = new RegExp('const ' + nome + ' = (\\w+|\\(\\w+\\)) => \\{[^\\n]*\\};').exec(t); return m ? m[0] : null; };
  const defs = [['js/fichas.js', 'celCSV'], ['js/custos.js', 'celCSV'], ['js/app.js', 'cel']];
  const venenos = ['=HYPERLINK("http://x.exemplo","clique")', '+55 86 99999-0000', '-2+3', '@SUM(A1)', '\t=1+1', '\r=1+1', '=cmd|\' /C calc\'!A0'];
  for (const [f, nome] of defs) {
    const src = achar(f, nome);
    if (!src) { ok(`2. ${f}: função ${nome} encontrada`, false, 'não achou a função de célula'); continue; }
    const fn = new Function(src.replace('const ' + nome + ' =', 'return'))();
    const ruins = venenos.filter(v => { const c = fn(v).replace(/^"|"$/g, ''); return /^[=+\-@\t\r]/.test(c); });
    ok(`2. ${f}: ${nome}() neutraliza fórmula no início da célula`, !ruins.length, ruins.map(JSON.stringify).join(', '));
    if (f !== 'js/app.js') ok(`2. ${f}: ${nome}() mantém número negativo como número`, fn('-12,5').replace(/"/g, '') === '-12,5');   // o histórico não tem coluna de número
  }
  // todo arquivo que monta .csv passa pela função de célula
  const csvs = fontes.filter(([, t]) => /text\/csv/.test(t)).map(([f]) => f);
  ok('2. só fichas, custos e histórico geram .csv (nenhum gerador novo sem a proteção)', csvs.every(f => ['js/fichas.js', 'js/custos.js', 'js/app.js'].includes(f)), csvs.join(', ')); }

// 3. sair do sistema tira do aparelho a cópia dos dados e a chave de login
{ const api = ler('js/api-supabase.js'); const app = ler('js/app.js');
  const sair = (/async sair\(\) \{[\s\S]*?\n    \},/.exec(api) || [''])[0];
  ok('3. sair() apaga mq-eu e mq-cache-* do aparelho', /mq-eu/.test(sair) && /mq-cache-/.test(sair));
  ok('3. sair() apaga a chave de login do Supabase mesmo sem internet', /sb-\.\*-auth-token/.test(sair));
  ok('3. saída por inatividade também apaga a cópia dos dados (cache)', /localStorage\.removeItem\(chaveCache\(\)\)/.test(app)); }

// 4. CSP: as diretivas que a meta consegue aplicar
{ const csp = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(ler('index.html')) || [])[1] || '';
  ok('4. CSP: sem unsafe-inline/unsafe-eval em script-src, object-src none, base-uri self', /script-src 'self';/.test(csp) && !/script-src[^;]*unsafe/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp));
  ok('4. CSP: form-action self (formulário não posta para fora)', /form-action 'self'/.test(csp)); }

// ===== dinâmico: a página aberta dentro de um iframe de OUTRO site (clickjacking) =====
(async () => {
  let chromium; try { ({ chromium } = require(process.argv[2])); } catch (e) { ok('5. playwright disponível', false, 'passe o caminho do playwright'); return fim(); }
  const fora = http.createServer((q, s) => { s.writeHeader(200, { 'Content-Type': 'text/html' });
    s.end('<!doctype html><title>site de fora</title><p>Site de terceiros</p><iframe id="f" src="http://localhost:8766/" width="1200" height="800" style="opacity:.5"></iframe>'); }).listen(8767);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('https://fonts.g*/**', r => r.abort());
  // controle: a página abre normal fora de iframe
  const p0 = await ctx.newPage(); await p0.goto('http://localhost:8766/'); const abriu = await p0.waitForSelector('main', { timeout: 8000 }).then(() => true).catch(() => false);
  ok('5. controle: o sistema abre normalmente na própria aba', abriu);
  const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8767/'); await p.waitForTimeout(2500);
  const fr = p.frames().find(f => /localhost:8766/.test(f.url()));
  const visivel = fr ? await fr.evaluate(() => { const m = document.querySelector('main'); if (!m) return false; const r = m.getBoundingClientRect(); const cs = getComputedStyle(document.documentElement);
    return r.height > 50 && cs.display !== 'none' && cs.visibility !== 'hidden' && !document.documentElement.hidden && document.querySelectorAll('button').length > 0; }).catch(() => false) : false;
  const saiu = p.url().startsWith('http://localhost:8766');   // quebra-moldura levou a aba para o sistema
  // SEG-6: a meta CSP não aceita frame-ancestors e o GitHub Pages não manda X-Frame-Options: só o próprio JS pode recusar a moldura
  ok('5. [SEG-6] o sistema NÃO funciona dentro de iframe de outro site (clickjacking)', !visivel || saiu, visivel ? 'telas e botões renderizados dentro do iframe de 127.0.0.1:8767' : '');
  await b.close(); fora.close(); fim();
})().catch(e => { console.error(e); ok('execução', false, e.message); fim(); });
function fim() { const f = R.filter(x => !x).length; console.log(`TOTAL ${R.length} FALHAS ${f}`); process.exitCode = f ? 1 : 0; }
