const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  for (const w of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    const email = await p.evaluate(async () => (await MQ.apiDemo.listarEquipe()).find(x => x.papel === 'agente' && x.status === 'ativa').email);
    await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=entrada], button[data-p=tela], [data-p]:last-child').click(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { MQ.ui.S.verEntrada = true; MQ.ui.S.modoLogin = 'entrar'; MQ.ui.render(); });
    await p.fill('#l-email', email); await p.click('.ent-esqueci'); await p.waitForTimeout(300);
    ok(`${w}: "Esqueci a senha" abre o pedido já com o e-mail digitado`, (await p.inputValue('#e-email')) === email);
    await p.fill('#e-email', 'errado'); await p.click('form[data-form=esqueci] button[type=submit]'); await p.waitForTimeout(200);
    ok(`${w}: e-mail inválido pede correção`, /Digite o e-mail/.test(await p.textContent('form[data-form=esqueci]')));
    await p.fill('#e-email', email); await p.click('form[data-form=esqueci] button[type=submit]'); await p.waitForTimeout(400);
    ok(`${w}: confirmação mostrada`, /Pedido enviado/.test(await p.textContent('main')));
    await p.click('text=Já recebi o código'); await p.waitForTimeout(300);
    ok(`${w}: "Já recebi o código" vai para Primeiro acesso`, !!(await p.$('#l-cod')));
    await p.evaluate(() => { MQ.ui.S.verEntrada = false; document.querySelector('button[data-p=coord_geral]').click(); }); await p.waitForTimeout(600); await p.evaluate(() => MQ.ui.fecharPainel());
    await p.evaluate(() => document.querySelector('[data-aba=equipe]').click()); await p.waitForTimeout(300);
    ok(`${w}: geral vê o pedido na Equipe`, /Pedidos de novo acesso/.test(await p.textContent('main')));
    await p.click('.pedido-acesso [data-acao=ver]'); await p.waitForTimeout(300);
    ok(`${w}: ficha mostra "pediu novo acesso"`, /pediu (novo )?acesso na tela de entrada/.test(await p.textContent('#painel')));
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
