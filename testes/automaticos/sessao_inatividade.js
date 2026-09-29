const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
const MIN = 60000;
(async () => { const b = await chromium.launch();
  for (const perfil of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.clock.install();
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
    await p.click(`button[data-p=${perfil}]`); await p.clock.runFor(800); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel());
    await p.clock.runFor(12 * MIN);
    ok(`${perfil}: aos 12 min ainda sem aviso`, !(await p.$('.sessao-aviso')));
    await p.clock.runFor(1.5 * MIN);
    ok(`${perfil}: aos 13,5 min aparece o aviso com contagem`, !!(await p.$('.sessao-aviso')) && /\d:\d\d/.test(await p.textContent('.sessao-aviso')));
    await p.click('[data-acao=sessao-continuar]'); await p.clock.runFor(1000);
    ok(`${perfil}: "Continuar usando" some o aviso e zera o tempo`, !(await p.$('.sessao-aviso')));
    await p.clock.runFor(14 * MIN);
    ok(`${perfil}: 14 min depois de continuar, ainda dentro`, await p.evaluate(() => !MQ.ui.S.verEntrada));
    await p.mouse.click(200, 400); await p.clock.runFor(10 * MIN);
    ok(`${perfil}: um toque também conta como uso`, await p.evaluate(() => !MQ.ui.S.verEntrada) && !(await p.$('.sessao-aviso')));
    await p.clock.runFor(6 * MIN);
    ok(`${perfil}: aos 15 min sem uso sai sozinho e explica`, await p.evaluate(() => !!MQ.ui.S.verEntrada) && /15 minutos sem uso/.test(await p.textContent('body')));
    ok(`${perfil}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
