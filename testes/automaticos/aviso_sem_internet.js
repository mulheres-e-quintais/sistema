/* 22/10/2026: faixa "sem internet" (âmbar, própria, presa no alto, com a contagem do que está guardado) e aviso verde quando volta.
   Uso: node testes/automaticos/aviso_sem_internet.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
(async () => {
  const b = await chromium.launch();
  for (const w of [1280, 360]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('button[data-p]');
    await p.evaluate(() => document.querySelector('button[data-p=bolsista]').click()); await p.waitForTimeout(900); await p.evaluate(() => MQ.ui.fecharPainel());
    ok(`${w}: com internet, sem faixa`, !(await p.$('[data-rede]')));
    await ctx.setOffline(true); await p.waitForTimeout(500);
    const f = await p.evaluate(() => { const e = document.querySelector('[data-rede]'); if (!e) return null; const cs = getComputedStyle(e);
      return { cls: e.className, demo: e.classList.contains('demo'), pos: cs.position, bg: cs.backgroundColor, txt: e.textContent.replace(/\s+/g, ' '), ic: !!e.querySelector('svg') }; });
    ok(`${w}: sem internet, faixa própria (não é a da demonstração), presa no alto, com ícone`, f && /rede-off/.test(f.cls) && !f.demo && f.pos === 'sticky' && f.ic, f);
    ok(`${w}: diz que pode continuar usando e que guarda no aparelho`, f && /Sem internet\./.test(f.txt) && /Pode continuar usando/.test(f.txt) && /guardado neste aparelho/.test(f.txt), f && f.txt);
    await p.evaluate(async () => MQ.fila.salvar({ id: 'teste-rede-1', dono: MQ.ui.S.eu.id, tipo: 'teste', dados: {} })); await p.waitForTimeout(400);
    const n = await p.evaluate(() => (document.querySelector('[data-rede] .rede-n') || {}).textContent || '');
    ok(`${w}: guardou um registro: a faixa mostra a contagem`, /1 registro guardado aqui/.test(n), n);
    await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(200);
    const topo = await p.evaluate(() => Math.round(document.querySelector('[data-rede]').getBoundingClientRect().top));
    ok(`${w}: rolando a página, a faixa continua visível no alto`, topo === 0, topo);
    await ctx.setOffline(false); await p.waitForTimeout(600);
    const t = await p.evaluate(() => { const e = document.getElementById('toast'); return e ? { txt: e.textContent, ok: e.classList.contains('ok') } : null; });
    ok(`${w}: a internet voltou: a faixa sai e aparece o aviso verde`, !(await p.$('[data-rede]')) && t && /Internet de volta/.test(t.txt), t);
    ok(`${w}: rolagem lateral`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    ok(`${w}: sem erro de página`, !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); const f = R.filter(x => x[0] === 'FALHOU').length; console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
