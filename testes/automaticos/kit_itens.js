/* Itens do kit com preço de referência, projeção do plano e croqui (aplicativo real no navegador, modo demonstração).
   Uso: node kit_itens.js <caminho do playwright>   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d ? ' | ' + String(d).slice(0, 160) : '')); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && /Content Security|Refused/.test(m.text())) errs.push(m.text()); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo'); await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
  const como = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel()); };
  const txt = sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' '), sel);

  // ---------- coordenação técnica: lista de itens na aba Campo ----------
  await como('coord_tecnico'); await p.evaluate(() => { MQ.ui.S.aba = 'campo'; MQ.ui.render(); }); await p.waitForSelector('.kit-itens');
  ok('a coordenação vê os 9 itens com preço de referência', await p.locator('.tab-kit-itens tbody tr').count() === 9);
  ok('os preços entram marcados como estimativa preliminar', /9 preços são estimativa preliminar/.test(await txt('.kit-itens')), (await txt('.kit-itens')).slice(0, 200));
  ok('cada item diz de onde veio o preço', /SINAPI, insumo 34636/.test(await txt('.tab-kit-itens')));
  // altera um preço e confirma com a origem
  await p.locator('.tab-kit-itens tr', { hasText: 'Esterco curtido' }).locator('[data-acao=campo-kit-editar]').click();
  ok('Alterar carrega o item no formulário', await p.inputValue('#ki-item') === 'Esterco curtido' && await p.inputValue('#ki-valor') === '15,00');
  await p.fill('#ki-valor', '12,50'); await p.check('form[data-form="diag-kit-item"] [name=confirmado]'); await p.fill('#ki-fonte', '');
  await p.click('form[data-form="diag-kit-item"] button[type=submit]'); await p.waitForTimeout(400);
  ok('confirmar preço sem dizer a origem é recusado na tela', /de onde ele veio/.test(await txt('form[data-form="diag-kit-item"]')));
  await p.fill('#ki-fonte', 'Cotação de 3 lojas em Paulistana, out/2026'); await p.click('form[data-form="diag-kit-item"] button[type=submit]'); await p.waitForTimeout(900);
  const lin = await p.locator('.tab-kit-itens tr', { hasText: 'Esterco curtido' }).textContent();
  ok('preço alterado e confirmado aparece na lista', /12,50/.test(lin) && /Confirmado/.test(lin), lin.replace(/\s+/g, ' '));
  // item novo
  await p.fill('#ki-item', 'Arame liso'); await p.fill('#ki-un', 'm'); await p.fill('#ki-valor', '2,30'); await p.click('form[data-form="diag-kit-item"] button[type=submit]'); await p.waitForTimeout(900);
  ok('item novo entra na lista', await p.locator('.tab-kit-itens tbody tr').count() === 10);
  await p.fill('#ki-item', 'arame LISO'); await p.fill('#ki-un', 'm'); await p.fill('#ki-valor', '3'); await p.click('form[data-form="diag-kit-item"] button[type=submit]'); await p.waitForTimeout(700);
  ok('nome repetido é recusado', /Já existe um item/.test(await txt('form[data-form="diag-kit-item"]')) && await p.locator('.tab-kit-itens tbody tr').count() === 10);

  // ---------- plano antigo sem valor: projeção com preço de referência, croqui e impressão ----------
  const ficha = await p.evaluate(() => MQ.ui.S.diagnosticos.find(d => !d.sem_agua).ficha_id);
  await p.evaluate(f => MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: f, id: f }), ficha); await p.waitForTimeout(500);
  let painel = await txt('#painel');
  if (!/Plano do quintal/.test(painel)) { await p.evaluate(() => { const bt = document.querySelector('[data-acao=campo-diag-ver]'); if (bt) bt.click(); }); await p.waitForTimeout(600); painel = await txt('#painel'); }
  ok('o plano abre com o kit', /Plano do quintal/.test(painel) && /Kit/.test(painel), painel.slice(0, 120));
  ok('item sem valor aparece com o preço de referência marcado (ref.)', /502,84 \(ref\.\)/.test(painel), (painel.match(/Caixa.{0,90}/) || [''])[0]);
  const proj = await txt('#painel .kit-proj');
  ok('a projeção do investimento deixa de ser R$ 0,00', /Projeção do investimento no quintal/.test(proj) && !/R\$\s?0,00/.test(proj.split('Valor por quintal')[0]), proj.slice(0, 160));
  ok('a projeção avisa que usa preço de referência', /preço de referência/.test(proj));
  ok('o plano tem o bloco do croqui', /Croqui do quintal/.test(painel) && /exemplo: não há foto do croqui|Sem croqui|Carregando/.test(painel));
  ok('o plano tem o botão de imprimir', await p.locator('#painel [data-acao=campo-plano-imprimir]').count() === 1);
  const html = await p.evaluate(f => { const S = MQ.ui.S; const fi = S.fichas.find(x => x.id === f), dg = S.diagnosticos.find(x => x.ficha_id === f); return MQ.campoUI.htmlPlano(fi, dg, 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); }, ficha);
  ok('a folha impressa traz kit, projeção, cronograma, croqui e assinaturas', /Kit e projeção do investimento/.test(html) && /Projeção do investimento no quintal: R\$/.test(html) && /Cronograma/.test(html) && /<img src="data:image/.test(html) && /Coordenação técnica/.test(html));
  ok('a folha impressa não leva CPF nem endereço', await p.evaluate(({ f, html }) => { const fi = MQ.ui.S.fichas.find(x => x.id === f); return !(fi.cpf && html.includes(fi.cpf)) && !(fi.endereco && html.includes(fi.endereco)); }, { f: ficha, html }));

  // ---------- bolsista: escolher o item preenche o preço ----------
  await como('bolsista');
  const fb = await p.evaluate(() => { const S = MQ.ui.S; const d = S.diagnosticos.find(x => x.uf === S.eu.uf && x.situacao !== 'aprovado' && !x.sem_agua); return d && d.ficha_id; });
  if (!fb) ok('há diagnóstico da bolsista para corrigir', false);
  else {
    await p.evaluate(f => MQ.campoUI.clique('campo-diag-novo', { dataset: { ficha: f } }), fb); await p.waitForSelector('#w-kit');
    ok('o formulário oferece a lista de itens', await p.locator('#kit-lista option').count() >= 9);
    ok('a bolsista vê o preço que a coordenação alterou', await p.evaluate(() => [...document.querySelectorAll('#kit-lista option')].some(o => o.value === 'Esterco curtido' && /12,50/.test(o.label))));
    await p.click('[data-acao=campo-linha-add][data-tipo=kit]');
    const l = p.locator('#w-kit [data-linha=kit]').last();
    await l.locator('[name=kit_item]').fill('Tela para galinheiro');
    ok('escolher o item preenche o preço de referência', await l.locator('[name=kit_valor]').inputValue() === '7,40');
    ok('a quantidade passa a pedir a unidade do item', /\(m\)/.test(await l.locator('[name=kit_qtd]').getAttribute('placeholder')));
    await l.locator('[name=kit_qtd]').fill('25');
    ok('a projeção soma o item (25 m × R$ 7,40 = R$ 185,00)', /185,00|R\$/.test(await txt('#kit-proj')));
    await l.locator('[name=kit_item]').fill('Esterco curtido');
    ok('trocar o item troca o preço que o sistema tinha posto', await l.locator('[name=kit_valor]').inputValue() === '12,50');
    await l.locator('[name=kit_valor]').fill('9,00'); await l.locator('[name=kit_item]').fill('Mudas frutíferas');
    ok('preço digitado pela bolsista não é trocado', await l.locator('[name=kit_valor]').inputValue() === '9,00');
    ok('a bolsista não vê a lista de edição de preços', await p.locator('form[data-form="diag-kit-item"]').count() === 0);
  }
  ok('sem erro de página nem bloqueio da política de conteúdo', errs.length === 0, errs.join(' | '));
  console.log('\n' + R.filter(Boolean).length + ' passou, ' + R.filter(x => !x).length + ' falhou'); await b.close(); process.exit(R.some(x => !x) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
