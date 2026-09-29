const { chromium } = require(process.argv[2]); const volume = require('./volume');
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const log = (...a) => { R.push(a.join(' | ')); console.log(a.join(' | ')); };
async function nova(b, { lento = true, largura = 390 } = {}) {
  const ctx = await b.newContext({ viewport: { width: largura, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
  if (lento) { await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  return { ctx, p, cdp, errs };
}
(async () => { const b = await chromium.launch();
  // 1) primeira abertura em celular fraco + 3G (sem cache)
  { const { ctx, p, errs } = await nova(b); let bytes = 0, js = 0, css = 0, n = 0;
    p.on('response', async r => { try { const l = +(r.headers()['content-length'] || 0) || (await r.body()).length; bytes += l; n++; if (/\.js/.test(r.url())) js += l; if (/\.css/.test(r.url())) css += l; } catch (e) {} });
    const t0 = Date.now(); await p.goto('http://localhost:8766/', { waitUntil: 'load' }); const load = Date.now() - t0; await p.waitForSelector('main'); const pronto = Date.now() - t0;
    const m = await p.evaluate(() => { const f = performance.getEntriesByName('first-contentful-paint')[0]; return { fcp: f && Math.round(f.startTime) }; });
    log('1ª abertura (celular fraco, 3G, sem cache)', `pronto p/ usar ${pronto} ms`, `1º desenho ${m.fcp} ms`, `${n} arquivos`, `${Math.round(bytes / 1024)} KB (JS ${Math.round(js / 1024)} KB, CSS ${Math.round(css / 1024)} KB)`);
    // 2) segunda abertura (cache do navegador)
    const t1 = Date.now(); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('main'); log('2ª abertura (com cache)', `pronto ${Date.now() - t1} ms`);
    if (errs.length) log('ERROS', errs.join(';')); await ctx.close(); }
  // 2b) como no celular de verdade: com o armazenamento offline (service worker) ligado
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.waitForSelector('main'); await p.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
    await p.reload(); await p.waitForSelector('main');
    const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t = Date.now(); await p.reload(); await p.waitForSelector('main'); log('Abertura seguinte com armazenamento offline (celular fraco, 3G)', `pronto ${Date.now() - t} ms`);
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const t2 = Date.now(); await p.reload(); await p.waitForSelector('main'); log('Abertura sem internet (celular fraco)', `pronto ${Date.now() - t2} ms`);
    await ctx.close(); }
  // 3) volume do fim do projeto: cada perfil, cada aba, celular fraco
  { const { ctx, p, cdp, errs } = await nova(b, { lento: false }); await p.goto('http://localhost:8766/'); await p.waitForSelector('main'); const vol = await volume(p); log('Volume injetado', JSON.stringify(vol));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
      let t = Date.now(); await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf);
      await p.waitForFunction(pf => MQ.ui.S.eu && ({ coord_geral: 'coord_geral', coord_tecnico: 'coord_tecnico', bolsista: 'articulacao', agente: 'agente', professor: 'professor_fic', auxiliar: 'auxiliar_adm' })[pf] === MQ.ui.S.eu.papel, pf);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))); const entrar = Date.now() - t;
      const abas = await p.evaluate(() => [...document.querySelectorAll('nav.abas [data-aba]')].map(x => x.dataset.aba)); const tempos = [];
      for (const a of abas) { const ms = await p.evaluate(a => { const el = document.querySelector(`[data-aba=${a}]`); if (!el) return -1; const t = performance.now(); el.click(); return Math.round(performance.now() - t); }, a); if (ms >= 0) tempos.push(a + ' ' + ms); }
      const piorAba = abas.length ? Math.max(...tempos.map(x => +x.split(' ')[1])) : 0;
      log(`Perfil ${pf}`, `entrar+desenhar ${entrar} ms`, abas.length ? `abas: ${tempos.join(', ')} ms` : 'tela única', `pior aba ${piorAba} ms`);
    }
    // busca na Seleção digitando
    await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=coord_tecnico]').click(); }); await p.waitForSelector('[data-aba=selecao]', { state: 'attached' });
    await p.evaluate(() => document.querySelector('[data-aba=selecao]').click());
    const campoBusca = await p.$('input[type=search], input[data-acao*=busca], input[name=busca], #f-busca');
    if (campoBusca) { const t = Date.now(); await campoBusca.type('Mulher Teste 1', { delay: 30 }); await p.waitForTimeout(400); log('Busca na Seleção (200 fichas, digitando)', `${Date.now() - t - 400} ms para 13 letras`); }
    // 4) memória: 60 trocas de aba e perfil
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
    await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=coord_geral]').click(); }); await p.waitForTimeout(200);
    const h0 = await heap();
    for (let i = 0; i < 60; i++) await p.evaluate(i => { const a = [...document.querySelectorAll('nav.abas [data-aba]')]; a[i % a.length].click(); }, i);
    const h1 = await heap(); for (let i = 0; i < 60; i++) await p.evaluate(i => { const a = [...document.querySelectorAll('nav.abas [data-aba]')]; a[i % a.length].click(); }, i); const h2 = await heap();
    log('Memória (coord. geral, volume cheio)', `início ${(h0 / 1e6).toFixed(1)} MB`, `após 60 trocas ${(h1 / 1e6).toFixed(1)} MB`, `após 120 ${(h2 / 1e6).toFixed(1)} MB`, (h2 - h1) / h1 < 0.1 ? 'estável (sem vazamento)' : 'CRESCENDO');
    // 5) parado: o relógio da sessão não pesa
    const c0 = await cdp.send('Performance.enable').then(() => cdp.send('Performance.getMetrics')); await p.waitForTimeout(10000); const c1 = await cdp.send('Performance.getMetrics');
    const tsk = m => m.metrics.find(x => x.name === 'TaskDuration').value; log('10 s parado na tela', `processamento ${Math.round((tsk(c1) - tsk(c0)) * 1000)} ms em 10.000 ms`);
    if (errs.length) log('ERROS', errs.join(';')); await ctx.close(); }
  await b.close(); require('fs').writeFileSync('/tmp/claude-0/pw/nf/desempenho.txt', R.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
