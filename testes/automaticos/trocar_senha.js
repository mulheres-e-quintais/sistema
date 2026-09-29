const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  for (const w of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    for (const pf of ['coord_geral', 'agente']) {
      await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500);
      await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'meus-dados' })); await p.waitForTimeout(300);
      ok(`${w} ${pf}: Meus dados tem "Trocar minha senha" recolhido`, !!(await p.$('#painel details.trocar-senha:not([open])')));
      await p.click('#painel details.trocar-senha summary');
      await p.click('form[data-form=trocar-senha] button[type=submit]'); await p.waitForTimeout(200);
      ok(`${w} ${pf}: vazio pede a senha atual e a nova`, (await p.$$eval('form[data-form=trocar-senha] .tem-erro', l => l.length)) >= 2);
      await p.fill('#ts-atual', 'senhaVelha1'); await p.fill('#ts-nova', 'somenteletras'); await p.click('form[data-form=trocar-senha] button[type=submit]'); await p.waitForTimeout(200);
      ok(`${w} ${pf}: nova sem número é recusada`, /Misture letras e números/.test(await p.textContent('form[data-form=trocar-senha]')));
      await p.fill('#ts-nova', 'senhaNova22'); await p.fill('#ts-nova2', 'senhaNova23'); await p.click('form[data-form=trocar-senha] button[type=submit]'); await p.waitForTimeout(200);
      ok(`${w} ${pf}: repetição diferente é recusada`, /não são iguais/.test(await p.textContent('form[data-form=trocar-senha]')));
      await p.fill('#ts-nova2', 'senhaNova22'); await p.click('form[data-form=trocar-senha] button[type=submit]'); await p.waitForTimeout(400);
      ok(`${w} ${pf}: tudo certo troca e avisa`, /Senha trocada/.test(await p.textContent('body')) && !(await p.$('#painel details.trocar-senha[open]')));
    }
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
