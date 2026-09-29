const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
const MIN = 60000;
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.clock.install();
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=bolsista]').click(); }); await p.clock.runFor(800); await p.evaluate(() => MQ.ui.fecharPainel());
  await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.clock.runFor(300);
  await p.fill('#fi-nome', 'Maria Rascunho da Silva'); await p.fill('#fi-cpf', '529.982.247-25'); await p.fill('#fi-pess', '4');
  const radio = await p.$('form[data-form=ficha] input[type=radio][value=sim]'); const nomeRadio = await radio.getAttribute('name');
  await radio.evaluate(r => { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.clock.runFor(16 * MIN);
  ok('Sai sozinho com a ficha aberta', await p.evaluate(() => !!MQ.ui.S.verEntrada) && !(await p.$('#painel')));
  ok('Rascunho guardado no aparelho, sem arquivo/senha', await p.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('mq-rascunho-painel-'))));
  // outra pessoa entra no mesmo aparelho: não vê o rascunho
  await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=agente]').click(); }); await p.clock.runFor(800); await p.evaluate(() => MQ.ui.fecharPainel());
  const temNova = await p.$('[data-acao=ficha-nova]');
  if (temNova) { await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.clock.runFor(300); }
  ok('Outra pessoa no mesmo aparelho não recebe o rascunho', !temNova || (await p.inputValue('#fi-nome')) === '');
  await p.evaluate(() => MQ.ui.fecharPainel());
  // a mesma bolsista volta
  await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=bolsista]').click(); }); await p.clock.runFor(800); await p.evaluate(() => MQ.ui.fecharPainel());
  await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.clock.runFor(300);
  ok('A mesma bolsista abre Nova ficha e o que digitou volta', (await p.inputValue('#fi-nome')) === 'Maria Rascunho da Silva' && (await p.inputValue('#fi-cpf')) === '529.982.247-25' && (await p.inputValue('#fi-pess')) === '4');
  ok('A escolha Autorizo volta marcada', await p.isChecked(`form[data-form=ficha] input[name="${nomeRadio}"][value=sim]`));
  ok('Aviso "Recuperamos o que você tinha digitado"', /Recuperamos o que você tinha digitado/.test(await p.textContent('#painel')));
  ok('Rascunho apagado depois de usado', await p.evaluate(() => !Object.keys(localStorage).some(k => k.startsWith('mq-rascunho-painel-'))));
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.clock.runFor(300);
  ok('Abrir de novo: ficha em branco (não repete)', (await p.inputValue('#fi-nome')) === '');
  // botão Sair (escolha da pessoa) não guarda rascunho
  await p.fill('#fi-nome', 'Outra Pessoa Teste'); await p.evaluate(() => MQ.ui.fecharPainel && 0);
  await p.evaluate(async () => { const b = document.querySelector('[data-acao=sair]'); if (b) b.click(); }); await p.clock.runFor(500);
  ok('Botão Sair não guarda rascunho', await p.evaluate(() => !Object.keys(localStorage).some(k => k.startsWith('mq-rascunho-painel-'))));
  ok('Sem erro de página', errs.length === 0, errs.join('|'));
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
