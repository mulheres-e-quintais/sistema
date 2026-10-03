/* Política de conteúdo (CSP) da página: a 2ª barreira contra código injetado.
   Confere que (1) a página declara a política, (2) código injetado não roda mesmo se entrar no HTML,
   (3) nenhuma tela do sistema viola a política e (4) as janelas de impressão continuam funcionando.
   Uso: node politica_conteudo.js <caminho do playwright>   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d ? ' | ' + d : '')); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 850 } }); const viol = [], errs = [];
  const escuta = p => { p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text().slice(0, 200)); }); p.on('pageerror', e => errs.push(e.message)); };
  ctx.on('page', escuta); const p = await ctx.newPage();
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '/* fontes */' }));
  await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo');
  const pol = await p.evaluate(() => (document.querySelector('meta[http-equiv=Content-Security-Policy]') || {}).content || '');
  ok('a página declara a política de conteúdo', /script-src 'self'/.test(pol) && /object-src 'none'/.test(pol));
  ok('a política não libera código embutido nem eval', !/script-src[^;]*unsafe-inline|unsafe-eval/.test(pol));
  ok('as fontes entram sem código embutido', await p.evaluate(() => document.querySelector('link[data-fontes]').media) === 'all');
  const rodou = await p.evaluate(() => new Promise(fim => { window.__x = 0; const d = document.createElement('div'); d.innerHTML = '<img src=x onerror="window.__x=1"><a id="jx" href="javascript:window.__x=3">x</a>'; document.body.appendChild(d);
    const s = document.createElement('script'); s.textContent = 'window.__x=2'; document.body.appendChild(s); try { d.querySelector('#jx').click(); } catch (e) {} setTimeout(() => { d.remove(); fim(window.__x); }, 500); }));
  ok('código injetado no HTML não roda (onerror, <script>, javascript:)', rodou === 0, 'valor ' + rodou);
  viol.length = 0;
  for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel());
    const abas = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-aba]')].map(x => x.dataset.aba))]);
    for (const a of (abas.length ? abas : [null])) { if (a) { await p.evaluate(a => { MQ.ui.S.aba = a; MQ.ui.render(); }, a); await p.waitForTimeout(250); }
      const n = await p.evaluate(() => document.querySelectorAll('main [data-acao]').length);
      for (let i = 0; i < Math.min(n, 6); i++) { await p.evaluate(i => { const e = [...document.querySelectorAll('main [data-acao]')].filter(x => !/sair|imprimir|csv|baixar|perfil/i.test(x.dataset.acao))[i]; if (e) e.click(); }, i); await p.waitForTimeout(200); await p.evaluate(() => MQ.ui.fecharPainel()); } }
    await p.evaluate(() => document.querySelector('.btn-meus').click()); await p.waitForTimeout(250); await p.evaluate(() => MQ.ui.fecharPainel()); }
  ok('nenhuma tela dos 6 perfis viola a política', viol.length === 0, [...new Set(viol)].slice(0, 3).join(' || '));
  await p.evaluate(() => document.querySelector('button[data-p=bolsista]').click()); await p.waitForTimeout(500); await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('[data-acao=ficha-nova]').click(); }); await p.waitForTimeout(500);
  const [w] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(() => document.querySelector('#painel [data-acao=imp-form]').click())]); await w.waitForTimeout(700);
  await w.evaluate(() => { window.print = () => { window.__imp = 1; }; }); await w.click('[data-jan=imprimir]');
  ok('janela de impressão: Imprimir funciona', await w.evaluate(() => window.__imp === 1));
  const fechou = new Promise(r => w.on('close', () => r(true))); await w.click('[data-jan=fechar]').catch(() => {});   // a janela fecha no meio do clique: o navegador de teste pode acusar "página fechada", que é o resultado esperado
  ok('janela de impressão: Fechar funciona', await Promise.race([fechou, new Promise(r => setTimeout(() => r(false), 1500))]));
  ok('nenhuma violação nas janelas de impressão', viol.length === 0, [...new Set(viol)].slice(0, 2).join(' || '));
  ok('nenhum erro de página', errs.length === 0, errs[0] || '');
  const f = R.filter(x => x[0] === 'FALHOU').length; console.log('TOTAL ' + R.length + ' FALHAS ' + f); await b.close(); process.exit(f ? 1 : 0); })();
