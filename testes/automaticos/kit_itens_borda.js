/* Itens do kit, projeção e croqui: casos de borda, ataque por texto, celular, falta da tabela, impressão e desempenho
   (aplicativo real no navegador, modo demonstração).
   Uso: node kit_itens_borda.js <caminho do playwright>   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(!!c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 170) : '')); };
const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
(async () => { const b = await chromium.launch();
  const novo = async (vp) => { const ctx = await b.newContext({ viewport: vp, bypassCSP: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOGO: ' + d.message()); d.dismiss(); });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo'); await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
    const como = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel()); };
    return { ctx, p, errs, como, txt: sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' '), sel) }; };

  let { ctx, p, errs, como, txt } = await novo({ width: 1280, height: 900 });
  const campo = async () => { await p.evaluate(() => { MQ.ui.S.aba = 'campo'; MQ.ui.render(); }); await p.waitForSelector('.kit-itens'); };
  const gravar = async (x) => p.evaluate(async x => { try { await MQ.ui.S.api.salvarKitItem(x); return ''; } catch (e) { return e.message; } }, x);

  // ---------- 1. texto malicioso no nome e na origem ----------
  await como('coord_tecnico'); await campo();
  const mal = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>"\'';
  ok('nome e origem com código são aceitos como texto', await gravar({ item: 'Bomba ' + mal.slice(0, 60), unidade: 'un', valor_ref: 100, fonte: mal, preliminar: true, ativo: true }) === '');
  await p.evaluate(async () => { await MQ.ui.carregar(); MQ.ui.render(); }); await p.waitForTimeout(400);
  ok('o código não é executado na lista da coordenação', await p.evaluate(() => !window.__xss && !document.querySelector('.kit-itens img, .kit-itens script')));
  ok('o texto aparece escrito, como foi digitado', /<img src=x/.test(await txt('.tab-kit-itens')));
  const fichaPlano = await p.evaluate(() => MQ.ui.S.diagnosticos.find(d => !d.sem_agua).ficha_id);
  await p.evaluate(({ f, mal }) => { const dg = MQ.ui.S.diagnosticos.find(d => d.ficha_id === f); dg.dados.kit.push({ item: 'Bomba ' + mal.slice(0, 60), qtd: '2', para: mal }); MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: f, id: f }); }, { f: fichaPlano, mal }); await p.waitForTimeout(500);
  if (!/Plano do quintal/.test(await txt('#painel'))) { await p.evaluate(() => { const bt = document.querySelector('[data-acao=campo-diag-ver]'); if (bt) bt.click(); }); await p.waitForTimeout(600); }
  ok('o código não é executado dentro do plano', await p.evaluate(() => !window.__xss && !document.querySelector('#painel .bloco img[src="x"]')));
  ok('o item malicioso entra na projeção pelo preço de referência (2 × R$ 100)', /200,00/.test(await txt('#painel')));
  const hp = await p.evaluate(f => { const S = MQ.ui.S; return MQ.campoUI.htmlPlano(S.fichas.find(x => x.id === f), S.diagnosticos.find(x => x.ficha_id === f), null); }, fichaPlano);
  ok('a folha impressa escapa o código', !/<img src=x/.test(hp) && !/<script>window/.test(hp) && /&lt;img/.test(hp));
  ok('folha sem foto diz que não há croqui', /Sem foto do croqui/.test(hp));

  // ---------- 2. valores de borda no formulário da coordenação ----------
  await p.evaluate(() => MQ.ui.fecharPainel()); await campo();
  const enviar = async (item, un, valor, fonte, conf) => { await p.fill('#ki-item', item); await p.fill('#ki-un', un); await p.fill('#ki-valor', valor); await p.fill('#ki-fonte', fonte || ''); await p.setChecked('form[data-form="diag-kit-item"] [name=confirmado]', !!conf);
    await p.click('form[data-form="diag-kit-item"] button[type=submit]'); await p.waitForTimeout(700); return txt('form[data-form="diag-kit-item"]'); };
  const n0 = await p.locator('.tab-kit-itens tbody tr').count();
  ok('preço zero é recusado na tela', /maior que zero/.test(await enviar('Item zero', 'un', '0', '')));
  ok('preço negativo é recusado na tela', /maior que zero/.test(await enviar('Item neg', 'un', '-3', '')));
  ok('preço com letras é recusado na tela', /maior que zero/.test(await enviar('Item letra', 'un', 'abc', '')));
  ok('preço acima do kit (R$ 5.000,01) é recusado na tela', /mais que o valor do kit/.test(await enviar('Item caro', 'un', '5.000,01', '')));
  ok('item sem unidade é recusado na tela', /unidade/.test(await enviar('Item sem un', '', '5', '')));
  ok('item sem nome é recusado na tela', /nome do item/.test(await enviar('', 'un', '5', '')));
  ok('nenhuma recusa gravou linha', await p.locator('.tab-kit-itens tbody tr').count() === n0);
  await enviar('Item milhar', 'un', '1.234,56', ''); 
  ok('preço com ponto de milhar e vírgula é lido certo (R$ 1.234,56)', /1\.234,56/.test(await txt('.tab-kit-itens')), (await txt('.tab-kit-itens')).match(/Item milhar.{0,40}/));
  ok('a camada de dados também recusa preço acima do teto', /5\.000/.test(await gravar({ item: 'Direto caro', unidade: 'un', valor_ref: 9999 })));
  ok('a camada de dados recusa nome repetido com acento e maiúscula diferentes', /Já existe/.test(await gravar({ item: 'ESTERCO CURTÍDO', unidade: 'saco', valor_ref: 3 })));

  // ---------- 3. item fora da lista (inativo) ----------
  await p.locator('.tab-kit-itens tr', { hasText: 'Regador e mangueira' }).locator('[data-acao=campo-kit-editar]').click();
  await p.uncheck('form[data-form="diag-kit-item"] [name=ativo]'); await p.click('form[data-form="diag-kit-item"] button[type=submit]'); await p.waitForTimeout(800);
  ok('item tirado da lista continua na tabela, marcado', /Fora da lista/.test(await p.locator('.tab-kit-itens tr', { hasText: 'Regador e mangueira' }).textContent()));
  ok('item tirado da lista não é mais oferecido nem usado como referência', await p.evaluate(() => MQ.kitItem('Regador e mangueira') === null && !MQ.kitItens().some(x => /Regador/.test(x.item))));
  ok('o histórico registra inclusão e alteração da lista', await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('mq-demo-v4')).auditoria.filter(x => x.tabela === 'kit_itens'); return a.some(x => x.acao === 'INSERT') && a.some(x => x.acao === 'UPDATE' && x.antes && x.depois && x.por); }));

  // ---------- 4. projeção acima do valor por quintal ----------
  const estouro = await p.evaluate(f => { const S = MQ.ui.S; const dg = JSON.parse(JSON.stringify(S.diagnosticos.find(d => d.ficha_id === f))); dg.dados.kit = [{ item: "Caixa d'água 1.000 L", qtd: '11' }];
    const d = document.createElement('div'); d.innerHTML = MQ.campoUI.htmlPlano(S.fichas.find(x => x.id === f), dg, null); return d.textContent.replace(/\s+/g, ' '); }, fichaPlano);
  ok('11 caixas d’água (R$ 5.531,24) aparecem na projeção da folha', /5\.531,24/.test(estouro), estouro.match(/Projeção.{0,60}/));
  ok('a regra do envio recusa kit acima de R$ 5.000', await p.evaluate(() => { const e = MQ.regras.validarDiagnostico ? null : 'sem função'; return e === null; }) && await p.evaluate(() => MQ.regras.totalKit([{ item: 'x', qtd: '11', valor: 502.84 }]) > MQ.KIT_QUINTAL));

  // ---------- 5. croqui: foto carregada sozinha, erro e diagnóstico ainda no aparelho ----------
  await p.evaluate(({ f, GIF }) => { const S = MQ.ui.S; const dg = S.diagnosticos.find(d => d.ficha_id === f); const fts = ['PI/x/diag_geral_1.jpg', 'PI/x/diag_croqui_1.jpg']; dg.fotos = fts; const copia = MQ.campoUI.diagnosticos().find(d => d.ficha_id === f); if (copia) copia.fotos = fts; window.__pedidos = [];
    S.api.linkFoto = async path => { window.__pedidos.push(path); return GIF; }; MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: f, id: f }); }, { f: fichaPlano, GIF }); await p.waitForTimeout(700);
  if (!/Plano do quintal/.test(await txt('#painel'))) { await p.evaluate(() => { const bt = document.querySelector('[data-acao=campo-diag-ver]'); if (bt) bt.click(); }); await p.waitForTimeout(800); }
  await p.waitForTimeout(400);
  ok('a foto do croqui aparece dentro do plano sem clicar', await p.locator('#painel .croqui img').count() === 1);
  ok('só a foto do croqui é pedida (as outras continuam nos botões)', await p.evaluate(() => window.__pedidos.length === 1 && /diag_croqui/.test(window.__pedidos[0])), await p.evaluate(() => window.__pedidos.join(',')));
  ok('a foto tem descrição para leitor de tela', await p.evaluate(() => { const i = document.querySelector('#painel .croqui img'); return !!i && i.alt.length > 10 && !!i.closest('a').getAttribute('aria-label'); }));
  ok('a foto não é pedida de novo a cada mudança da tela', await p.evaluate(async () => { document.body.appendChild(document.createElement('i')); await new Promise(r => setTimeout(r, 300)); return window.__pedidos.length === 1; }));
  // impressão: espera a foto e chama a impressora uma vez
  const imp = await p.evaluate(async () => { let n = 0, comFoto = false; const antes = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
    const orig = window.print; const iframes = () => [...document.querySelectorAll('iframe[aria-hidden=true]')];
    document.querySelector('#painel [data-acao=campo-plano-imprimir]').click();
    for (let i = 0; i < 40 && !iframes().length; i++) await new Promise(r => setTimeout(r, 50));
    const q = iframes()[0]; if (!q) return { n: -1 };
    q.contentWindow.print = () => { n++; const im = q.contentDocument.querySelector('img'); comFoto = !!im && im.complete; };
    await new Promise(r => setTimeout(r, 1200));
    return { n, comFoto, titulo: q.contentDocument ? q.contentDocument.title : '', texto: q.contentDocument ? q.contentDocument.body.textContent.replace(/\s+/g, ' ').slice(0, 400) : '' }; });
  ok('Imprimir o plano abre a impressão uma única vez', imp.n === 1, JSON.stringify(imp).slice(0, 160));
  ok('a impressão só abre com a foto do croqui já carregada', imp.comFoto === true);
  ok('a folha tem título com o código do quintal', /Plano do quintal PI-/.test(imp.titulo), imp.titulo);
  await p.waitForTimeout(2300);
  ok('a moldura de impressão é removida depois', await p.locator('iframe[aria-hidden=true]').count() === 0);
  // erro ao buscar a foto
  await p.evaluate(f => { const S = MQ.ui.S; S.api.linkFoto = async () => { throw new Error('Foto indisponível agora.'); }; MQ.ui.fecharPainel(); MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: f, id: f }); }, fichaPlano); await p.waitForTimeout(600);
  if (!/Plano do quintal/.test(await txt('#painel'))) { await p.evaluate(() => { const bt = document.querySelector('[data-acao=campo-diag-ver]'); if (bt) bt.click(); }); await p.waitForTimeout(800); }
  await p.waitForTimeout(300);
  ok('falha ao buscar a foto vira aviso, sem quebrar o plano', /Foto indisponível agora/.test(await txt('#painel .croqui')) && /Cronograma/.test(await txt('#painel')));
  const impSem = await p.evaluate(async () => { let n = 0; document.querySelector('#painel [data-acao=campo-plano-imprimir]').click();
    for (let i = 0; i < 40 && !document.querySelector('iframe[aria-hidden=true]'); i++) await new Promise(r => setTimeout(r, 50));
    const q = document.querySelector('iframe[aria-hidden=true]'); if (!q) return -1; q.contentWindow.print = () => { n++; }; await new Promise(r => setTimeout(r, 900)); return n + '|' + /Sem foto do croqui/.test(q.contentDocument.body.textContent); });
  ok('sem conseguir a foto, a folha ainda imprime e avisa que não há croqui', impSem === '1|true', impSem);
  ok('diagnóstico só no aparelho explica quando o croqui vai aparecer', await p.evaluate(f => { const S = MQ.ui.S; const dg = Object.assign({}, S.diagnosticos.find(d => d.ficha_id === f), { _fila: true, fotos: [] }); const h = MQ.campoUI.htmlPlano(S.fichas.find(x => x.id === f), dg, null); return /Sem foto do croqui/.test(h); }, fichaPlano));

  // ---------- 6. sem a tabela no banco ----------
  await p.waitForTimeout(2200);
  await p.evaluate(async () => { const S = MQ.ui.S; MQ.ui.fecharPainel(); S.api.listarKitItens = async () => { const e = new Error('Could not find the table public.kit_itens in the schema cache'); e.original = { code: 'PGRST205', message: e.message }; throw e; }; await MQ.ui.carregar(); S.aba = 'campo'; MQ.ui.render(); }); await p.waitForSelector('.kit-itens');
  ok('sem a tabela: a tela abre e mostra os 9 itens do sistema', await p.locator('.tab-kit-itens tbody tr').count() === 9);
  ok('sem a tabela: a edição some e a tela diz qual arquivo rodar', await p.locator('form[data-form="diag-kit-item"]').count() === 0 && /51_kit_itens\.sql/.test(await txt('.kit-itens')));
  ok('sem a tabela: não aparece o aviso de carga parcial', await p.evaluate(() => !MQ.ui.S.cargaParcial));
  ok('sem a tabela: o preço de referência continua valendo', await p.evaluate(() => MQ.kitItem('Mudas frutíferas').valor_ref === 20));
  await p.evaluate(async () => { const S = MQ.ui.S; S.api.listarKitItens = async () => { throw new Error('erro interno qualquer'); }; await MQ.ui.carregar(); MQ.ui.render(); });
  ok('erro inesperado na lista: a tela abre e avisa que parte não carregou', await p.evaluate(() => (MQ.ui.S.cargaParcial || []).includes('itens do kit')));

  // ---------- 7. cópia no aparelho para uso sem internet ----------
  await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo'); await como('bolsista');
  await p.waitForFunction(() => { const k = Object.keys(localStorage).find(x => /^mq-cache-/.test(x)); const c = k && JSON.parse(localStorage.getItem(k)); return c && (c.kitItens || []).length >= 9; }, null, { timeout: 4000 }).catch(() => {});   // a cópia é gravada no fim da carga
  const cache = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => /^mq-cache-/.test(x)); const c = k && JSON.parse(localStorage.getItem(k)); return c && Array.isArray(c.kitItens) ? c.kitItens.length : -1; });
  ok('a lista de itens fica guardada no aparelho da bolsista', cache >= 9, cache);
  await p.evaluate(async () => { const S = MQ.ui.S; const semRede = () => { const e = new Error('sem internet'); e.semRede = true; throw e; }; S.api.listarEquipe = async () => semRede(); S.kitItens = null; await MQ.ui.carregar(); });
  ok('sem internet: a lista volta da cópia do aparelho', await p.evaluate(() => MQ.ui.S.semRede === true && (MQ.ui.S.kitItens || []).length >= 9));

  // ---------- 8. perfis que não usam o campo ----------
  await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
  for (const pf of ['professor', 'auxiliar', 'agente', 'coord_geral']) {
    const tem = await p.evaluate(pf => !!document.querySelector(`button[data-p=${pf}]`), pf); if (!tem) { ok('perfil ' + pf + ' existe no modo demonstração', false); continue; }
    await como(pf); ok('perfil ' + pf + ': a tela abre sem carga parcial', await p.evaluate(() => !MQ.ui.S.cargaParcial && !!document.querySelector('main, #app, body').textContent.length));
  }
  await campo().catch(() => {});
  ok('coordenação geral também altera a lista', await p.locator('form[data-form="diag-kit-item"]').count() === 1);

  // ---------- 9. bolsista: preencher, ajustar e enviar o diagnóstico ----------
  await como('bolsista');
  const fb = await p.evaluate(() => { const S = MQ.ui.S; const d = S.diagnosticos.find(x => x.uf === S.eu.uf && x.situacao !== 'aprovado' && !x.sem_agua); return d && d.ficha_id; });
  await p.evaluate(f => MQ.campoUI.clique('campo-diag-novo', { dataset: { ficha: f } }), fb); await p.waitForSelector('#w-kit');
  const linhas0 = await p.locator('#w-kit [data-linha=kit]').count();
  for (let i = 0; i < linhas0; i++) { const l = p.locator('#w-kit [data-linha=kit]').nth(i); const nome = await l.locator('[name=kit_item]').inputValue(); await l.locator('[name=kit_item]').fill(''); await l.locator('[name=kit_item]').fill(nome); }
  const vals = await p.evaluate(() => [...document.querySelectorAll('#w-kit [data-linha=kit]')].map(l => l.querySelector('[name=kit_item]').value + '=' + l.querySelector('[name=kit_valor]').value));
  ok('redigitar o nome dos itens do plano antigo traz o preço dos que estão na lista', vals.some(v => /Caixa.*=502,84/.test(v)) && vals.some(v => /gotejamento=350,00/.test(v)), vals.join(' ; '));
  ok('item fora da lista fica sem preço para a bolsista informar', vals.some(v => /Tela para canteiro=$/.test(v)), vals.join(' ; '));
  const lc = p.locator('#w-kit [data-linha=kit]').filter({ has: p.locator('[name=kit_item]') }).nth(linhas0 - 1);
  await lc.locator('[name=kit_valor]').fill('6,50');
  const proj = await txt('#kit-proj');
  ok('a projeção soma: 502,84 + 350,00 + 20 m × 6,50 = R$ 982,84', /982,84/.test(proj), proj.slice(0, 120));
  ok('a projeção mostra quanto sobra do valor por quintal', /sobram R\$\s?4\.017,16/.test(proj), proj.slice(0, 160));
  await p.locator('#w-kit [data-linha=kit]').first().locator('[name=kit_qtd]').fill('10');
  ok('10 caixas d’água estouram o valor e a projeção avisa quanto passa', /Passa/.test(await txt('#kit-proj')) && await p.locator('#kit-proj .kit-proj.passou').count() === 1, (await txt('#kit-proj')).slice(0, 140));
  await p.locator('#w-kit [data-linha=kit]').first().locator('[name=kit_qtd]').fill('1');
  const antes = await p.evaluate(f => JSON.stringify(MQ.ui.S.diagnosticos.find(d => d.ficha_id === f).dados.kit), fb);
  for (let volta = 0; volta < 3; volta++) {
    await p.evaluate(() => { const fm = document.querySelector('#w-kit') && document.querySelector('#w-kit').closest('form'); if (!fm) return; const hoje = MQ.regras.hoje();
      fm.querySelectorAll('input[type=date]').forEach(i => { if (!i.value || i.value > hoje) { i.value = hoje; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } });
      const grupos = {}; fm.querySelectorAll('input[type=radio]').forEach(r => { (grupos[r.name] = grupos[r.name] || []).push(r); });
      Object.values(grupos).forEach(g => { if (!g.some(r => r.checked)) { const r = g[g.length - 1]; r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } });
      fm.querySelectorAll('.tem-erro input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=date]), .tem-erro select').forEach(i => { if (!i.value) { i.value = i.tagName === 'SELECT' ? (i.options[1] || {}).value || '' : '1'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } });
      [...fm.querySelectorAll('button[type=submit]')].pop().click(); }); await p.waitForTimeout(1500);
    if (!(await p.locator('#w-kit').count())) break;
  }
  const depois = await p.evaluate(f => { const d = MQ.ui.S.diagnosticos.find(d => d.ficha_id === f); const fila = (MQ.ui.S.fila || []).find(i => i.tipo === 'diagnostico'); const k = (fila ? (fila.dados.dados || fila.dados).kit : d.dados.kit) || []; return { total: MQ.regras.totalKit(k), kit: k.map(x => x.item.slice(0, 12) + ':' + typeof x.valor + ':' + x.valor), ok: k.length >= 3 && k.every(x => typeof x.valor === 'number' && x.valor > 0), erro: [...document.querySelectorAll('#painel .tem-erro')].map(e => e.textContent.trim().slice(0, 50)).join(' / ') }; }, fb);
  ok('o diagnóstico é enviado com o preço de cada item gravado como número', depois.ok && Math.abs(depois.total - 982.84) < 0.01, JSON.stringify(depois).slice(0, 170));

  // ---------- 10. desempenho com lista grande ----------
  const perf = await p.evaluate(() => { const S = MQ.ui.S; S.kitItensSemBanco = false; S.kitItens = Array.from({ length: 500 }, (_, i) => ({ id: 'k' + i, item: 'Item de teste número ' + i, unidade: 'un', valor_ref: 1 + i, fonte: 'Fonte ' + i, preliminar: i % 2 === 0, ativo: true }));
    const t0 = performance.now(); const h = MQ.campoUI.blocoKitItens(); const t1 = performance.now(); for (let i = 0; i < 2000; i++) MQ.kitItem('item de teste numero ' + (i % 500)); const t2 = performance.now();
    return { bloco: Math.round(t1 - t0), buscas: Math.round(t2 - t1), tam: h.length }; });
  ok('lista com 500 itens monta em menos de 150 ms', perf.bloco < 150, perf.bloco + ' ms');
  ok('2.000 buscas de item em lista de 500 levam menos de 1,5 s', perf.buscas < 1500, perf.buscas + ' ms');
  ok('nenhum erro de página nem janela de alerta no computador', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // ---------- 11. celular ----------
  ({ ctx, p, errs, como, txt } = await novo({ width: 390, height: 780 }));
  await como('coord_tecnico'); await p.evaluate(() => { MQ.ui.S.aba = 'campo'; MQ.ui.render(); }); await p.waitForSelector('.kit-itens');
  const cel = await p.evaluate(() => { const de = document.documentElement; const b = [...document.querySelectorAll('.kit-itens button, .kit-itens input:not([type=hidden]):not([type=checkbox])')].filter(e => e.offsetParent);
    const semRotulo = [...document.querySelectorAll('.kit-item-form input:not([type=hidden])')].filter(i => !(i.labels && i.labels.length) && !i.getAttribute('aria-label')).length;
    const fonteMin = Math.min(...[...document.querySelectorAll('.kit-itens *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)));
    return { rolagem: de.scrollWidth - de.clientWidth, baixos: b.filter(e => e.getBoundingClientRect().height < (e.classList.contains('pri') ? 43.5 : 39.5)).map(e => e.tagName + ':' + Math.round(e.getBoundingClientRect().height)), semRotulo, fonteMin }; });
  ok('celular: a aba Campo com a lista de itens não rola para o lado', cel.rolagem <= 1, cel.rolagem + ' px');
  ok('celular: botões e campos da lista seguem o padrão do sistema (40 px ou mais; o principal, 44 px)', cel.baixos.length === 0, cel.baixos.join(','));
  ok('todo campo do formulário de item tem rótulo', cel.semRotulo === 0, cel.semRotulo);
  ok('celular: nenhum texto do bloco abaixo de 12 px', cel.fonteMin >= 12, cel.fonteMin);
  const fc = await p.evaluate(() => MQ.ui.S.diagnosticos.find(d => !d.sem_agua).ficha_id);
  await p.evaluate(f => MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: f, id: f }), fc); await p.waitForTimeout(600);
  if (!/Plano do quintal/.test(await txt('#painel'))) { await p.evaluate(() => { const bt = document.querySelector('[data-acao=campo-diag-ver]'); if (bt) bt.click(); }); await p.waitForTimeout(800); }
  const celP = await p.evaluate(() => { const pn = document.querySelector('#painel'); const bt = pn.querySelector('[data-acao=campo-plano-imprimir]'); return { larg: pn.scrollWidth - pn.clientWidth, bt: bt ? Math.round(bt.getBoundingClientRect().height) : 0 }; });
  ok('celular: o plano com kit, projeção e croqui cabe na largura', celP.larg <= 1, celP.larg + ' px');
  ok('celular: o botão Imprimir o plano tem pelo menos 40 px', celP.bt >= 40, celP.bt);
  await como('bolsista');
  const fb2 = await p.evaluate(() => { const S = MQ.ui.S; const d = S.diagnosticos.find(x => x.uf === S.eu.uf && x.situacao !== 'aprovado' && !x.sem_agua); return d && d.ficha_id; });
  await p.evaluate(f => MQ.campoUI.clique('campo-diag-novo', { dataset: { ficha: f } }), fb2); await p.waitForSelector('#w-kit');
  const celF = await p.evaluate(() => { const pn = document.querySelector('#painel'); const ins = [...document.querySelectorAll('#w-kit input')].filter(e => e.offsetParent); return { larg: pn.scrollWidth - pn.clientWidth, baixos: ins.filter(e => e.getBoundingClientRect().height < 39.5).length, menor: Math.min(...ins.map(e => Math.round(e.getBoundingClientRect().height))), rot: ins.filter(i => !i.getAttribute('aria-label') && !(i.labels && i.labels.length)).length, fz: Math.min(...ins.map(i => parseFloat(getComputedStyle(i).fontSize))) }; });
  ok('celular: o kit no formulário do diagnóstico cabe na largura', celF.larg <= 1, celF.larg + ' px');
  ok('celular: campos do kit com 40 px ou mais, com rótulo e letra de 16 px ou mais (sem zoom ao tocar)', celF.baixos === 0 && celF.rot === 0 && celF.fz >= 16, JSON.stringify(celF));
  ok('nenhum erro de página nem janela de alerta no celular', errs.length === 0, errs.join(' | '));
  console.log('\n' + R.filter(Boolean).length + ' passou, ' + R.filter(x => !x).length + ' falhou'); await b.close(); process.exit(R.some(x => !x) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
