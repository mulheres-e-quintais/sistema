/* Relatar problema: do botão (rodapé e ajuda) até a lista da coordenação geral, com e sem internet
   (aplicativo real no navegador, modo demonstração). Uso: node relatos.js <caminho do playwright> */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(!!c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 170) : '')); };
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 820 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOGO: ' + d.message()); d.dismiss(); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo, .dx-topo, .eq-kpis'); await p.evaluate(async () => { localStorage.removeItem('mq-relatos-pendentes'); await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo, .dx-topo, .eq-kpis');
  const como = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(700); };
  const txt = sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' '), sel);
  const fm = '#painel form[data-form="relato-novo"]';
  // ---- todo perfil da equipe tem o botão no rodapé de toda aba ----
  for (const pf of ['bolsista', 'agente', 'professor', 'auxiliar', 'coord_tecnico', 'coord_geral']) { await como(pf); ok(pf + ': o rodapé tem "Relatar problema"', await p.locator('footer [data-acao=relato-abrir], .rodape-lgpd [data-acao=relato-abrir]').count() === 1); }
  const abas = await p.evaluate(() => [...document.querySelectorAll('nav.abas [data-aba], nav.abas button')].map(e => e.dataset.aba).filter(Boolean));
  let faltou = []; for (const a of [...new Set(abas)]) { await p.evaluate(a => { MQ.ui.irParaAba(a); MQ.ui.render(); }, a); await p.waitForTimeout(150); if (await p.locator('[data-acao=relato-abrir]').count() < 1) faltou.push(a); }
  ok('coordenação geral: o botão está em todas as abas (' + new Set(abas).size + ')', new Set(abas).size >= 8 && !faltou.length, faltou.join(','));
  for (const pf of ['obs_mda', 'obs_mpa']) { await como(pf); ok(pf + ': quem acompanha de fora não tem o botão', await p.locator('[data-acao=relato-abrir]').count() === 0); }
  // ---- relatar pela ajuda ----
  await como('bolsista'); await p.click('.btn-ajuda[data-acao=ajuda], [data-acao=ajuda]'); await p.waitForSelector('#painel .rl-botao'); await p.click('#painel .rl-botao'); await p.waitForSelector(fm);
  ok('a ajuda leva ao formulário de relato', /Relatar problema/.test(await txt('#painel')) && /Não vai foto da tela/.test(await txt('#painel')));
  await p.fill(fm + ' textarea', 'travou'); await p.click(fm + ' [type=submit]'); await p.waitForTimeout(400);
  ok('relato curto é recusado, com a explicação', /mais de detalhe/.test(await txt('#painel')) && await p.locator(fm).count() === 1);
  await p.fill(fm + ' textarea', 'Toquei em Salvar na ficha e nada aconteceu <b>duas vezes</b>'); await p.click(fm + ' [type=submit]'); await p.waitForTimeout(900);
  ok('relato bom é enviado e o painel fecha', await p.locator('#painel').count() === 0 && /Relato enviado/.test(await txt('.toast')), await txt('.toast'));
  ok('o relato guarda tela, versão (quando há) e aparelho, sem dado digitado a mais', await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('mq-demo-v4')).relatos[0]; return r.papel && typeof r.tela === 'string' && /\d+x\d+/.test(r.aparelho || '') && Object.keys(r).length === 12; }));
  // ---- sem internet: fica guardado e sobe depois ----
  await p.click('.rodape-relato'); await p.waitForSelector(fm); await ctx.setOffline(true);
  await p.fill(fm + ' textarea', 'Sem sinal no quintal, a foto não carregou na tela'); await p.click(fm + ' [type=submit]'); await p.waitForTimeout(900);
  ok('sem internet: o relato fica guardado no aparelho e a pessoa é avisada', /ficou guardado/.test(await txt('.toast')) && await p.evaluate(() => JSON.parse(localStorage.getItem('mq-relatos-pendentes') || '[]').length === 1 && JSON.parse(localStorage.getItem('mq-demo-v4')).relatos.length === 1));
  await p.click('.rodape-relato'); await p.waitForSelector(fm); ok('o formulário avisa que há relato esperando internet', /1 relato guardado/.test(await txt('#painel'))); await p.evaluate(() => MQ.ui.fecharPainel());
  await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(1500);
  ok('quando o sinal volta, o relato guardado sobe sozinho', await p.evaluate(() => !localStorage.getItem('mq-relatos-pendentes') && JSON.parse(localStorage.getItem('mq-demo-v4')).relatos.length === 2));
  // ---- coordenação geral: lista, resolver, reabrir ----
  await como('coord_geral'); await p.evaluate(() => { MQ.ui.irParaAba('historico'); MQ.ui.render(); }); await p.waitForSelector('#relatos .rl-item');
  ok('coordenação geral vê os 2 relatos no Histórico, com quem relatou', await p.locator('#relatos .rl-item').count() === 2 && /2 relatos abertos/.test(await txt('#relatos')));
  ok('o código escrito no relato aparece como texto', await p.evaluate(() => !document.querySelector('#relatos .rl-texto b') && /<b>duas vezes<\/b>/.test(document.querySelector('#relatos').textContent)));
  await p.locator('#relatos .rl-item').first().locator('input[name=nota]').fill('Corrigido na versão seguinte'); await p.locator('#relatos .rl-item').first().locator('[type=submit]').click(); await p.waitForTimeout(900);
  ok('marcar como resolvido: guarda a anotação e o relato vai para o fim', /1 relato aberto/.test(await txt('#relatos')) && /Corrigido na versão seguinte/.test(await p.locator('#relatos .rl-item').nth(1).textContent()) && /Resolvido/.test(await p.locator('#relatos .rl-item').nth(1).textContent()));
  await p.click('#relatos [data-acao=relato-reabrir]'); await p.waitForTimeout(900); ok('reabrir devolve o relato para os abertos', /2 relatos abertos/.test(await txt('#relatos')));
  const cel = await p.evaluate(() => ({ rol: document.documentElement.scrollWidth - document.documentElement.clientWidth, baixos: [...document.querySelectorAll('#relatos button, #relatos input:not([type=hidden])')].filter(e => e.getBoundingClientRect().height < 40).length }));
  ok('celular 390 px: a lista não rola para o lado e os botões têm 40 px ou mais', cel.rol <= 0 && cel.baixos === 0, JSON.stringify(cel));
  await como('coord_tecnico'); await p.evaluate(() => { MQ.ui.irParaAba('equipe'); MQ.ui.render(); }); ok('coordenação técnica não tem a lista de relatos', await p.locator('#relatos').count() === 0);
  ok('nenhum erro de página', errs.length === 0, errs.join(' | '));
  console.log('\n' + R.filter(Boolean).length + ' passou, ' + R.filter(x => !x).length + ' falhou'); await b.close(); process.exit(R.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('FALHOU | erro no teste | ' + e.message.slice(0, 300)); process.exit(1); });
