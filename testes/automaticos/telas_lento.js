const { chromium } = require(process.argv[2]);
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.addInitScript(() => { const t = setInterval(() => { if (window.MQ && MQ.ui && MQ.ui.S && MQ.ui.S.api) { const api = MQ.ui.S.api; if (!api || api.__lento) return; api.__lento = 1;
    for (const f of ['lerParametros', 'listarCustos']) { const o = api[f].bind(api); api[f] = async (...a) => { window.__lentas = (window.__lentas || 0) + 1; await new Promise(r => setTimeout(r, 1500)); return o(...a); }; } clearInterval(t); } }, 5); });
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  await p.click('button[data-p=coord_geral]'); await p.waitForTimeout(100); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel());
  for (const cenario of ['logo depois de entrar', 'depois do carregamento']) {
    if (cenario === 'depois do carregamento') { await p.evaluate(() => document.querySelector('[data-aba=visao]').click()); await p.waitForTimeout(2000); }
    await p.evaluate(() => { window.__cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { window.__cls += e.value; })).observe({ type: 'layout-shift' }); });
    await p.evaluate(() => document.querySelector('[data-aba=custos]').click());
    const tops = []; for (let i = 0; i < 25; i++) { tops.push(await p.evaluate(() => { const h = document.querySelector('main h1'); return h ? h.textContent + '@' + Math.round(h.getBoundingClientRect().top) : '-'; })); await p.waitForTimeout(100); }
    console.log(cenario, '| CLS', (await p.evaluate(() => window.__cls)).toFixed(3), '|', [...new Set(tops)].join(' → '));
  }
  console.log('chamadas lentas', await p.evaluate(() => window.__lentas), 'errs', errs); await b.close(); })();
