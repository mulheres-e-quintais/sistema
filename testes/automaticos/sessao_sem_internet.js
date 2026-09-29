const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
const MIN = 60000;
(async () => { const b = await chromium.launch();
  for (const perfil of ['agente', 'bolsista', 'coord_geral']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.clock.install();
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
    await p.evaluate(pf => { document.querySelector(`button[data-p=${pf}]`).click(); }, perfil); await p.clock.runFor(800); await p.evaluate(() => MQ.ui.fecharPainel());
    await ctx.setOffline(true);
    await p.clock.runFor(14 * MIN);
    ok(`${perfil}: sem internet, aos 14 min não mostra aviso`, !(await p.$('.sessao-aviso')));
    await p.clock.runFor(40 * MIN);
    ok(`${perfil}: sem internet, 54 min parada e continua dentro`, await p.evaluate(() => !MQ.ui.S.verEntrada));
    await ctx.setOffline(false); await p.clock.runFor(1500);
    ok(`${perfil}: o sinal volta e ela continua parada → sai e explica`, await p.evaluate(() => !!MQ.ui.S.verEntrada) && /15 minutos sem uso/.test(await p.textContent('body')));
    // de novo: trabalha sem internet e o sinal volta
    await p.evaluate(pf => { document.querySelector(`button[data-p=${pf}]`).click(); }, perfil); await p.clock.runFor(800); await p.evaluate(() => MQ.ui.fecharPainel());
    await ctx.setOffline(true); await p.clock.runFor(30 * MIN); await p.mouse.click(200, 300); await p.clock.runFor(2 * MIN);
    await ctx.setOffline(false); await p.clock.runFor(1500);
    ok(`${perfil}: usou sem internet há 2 min e o sinal volta → continua dentro`, await p.evaluate(() => !MQ.ui.S.verEntrada));
    ok(`${perfil}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
