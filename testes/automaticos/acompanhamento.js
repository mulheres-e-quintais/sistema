/* Perfis de acompanhamento (MDA e MPA): o que veem, o que NÃO veem, e o cadastro pela coordenação geral
   (aplicativo real no navegador, modo demonstração, com a política de conteúdo ligada).
   Uso: node acompanhamento.js <caminho do playwright>   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(!!c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 170) : '')); };
(async () => { const b = await chromium.launch();
  const novo = async vp => { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOGO: ' + d.message()); d.dismiss(); });
    p.on('console', m => { if (m.type() === 'error' && /Content Security|Refused|Erro na ação/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo'); await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
    const como = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(600); };
    return { ctx, p, errs, como, txt: sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' '), sel) }; };
  let { ctx, p, errs, como, txt } = await novo({ width: 1280, height: 900 });
  // o que NÃO pode aparecer: tirado dos próprios dados de demonstração
  const segredos = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mq-demo-v4')); const s = new Set();
    d.fichas.forEach(f => { [f.nome, f.cpf, f.endereco, f.celular, f.nis, f.testemunha_nome].forEach(x => { if (x && String(x).length >= 6) s.add(String(x)); }); s.add(String(f.nome).replace(/ \(exemplo\)/, '')); });
    d.equipe.forEach(m => { [m.nome, m.cpf, m.email, m.telefone, m.pix_chave, m.conta, m.agencia].forEach(x => { if (x && String(x).length >= 6) s.add(String(x)); }); });
    return [...s].filter(x => !/^(Marta Lima|Paulo Rocha)/.test(x)); });
  ok('há dados pessoais nos dados de exemplo para procurar', segredos.length > 20, segredos.length);

  for (const [pf, sigla, titulo] of [['obs_mda', 'MDA', 'O projeto em números'], ['obs_mpa', 'MPA', 'Andamento no território']]) {
    await como(pf); await p.waitForSelector('.ac-kpis');
    const html = await p.content(); const texto = await txt('body');
    ok(sigla + ': abre a tela própria, com o título certo', (await txt('main h1')).includes(titulo) && /Dados ao vivo/.test(texto));
    ok(sigla + ': nenhum dado pessoal da equipe ou das mulheres em nenhum ponto da página', segredos.every(x => !html.includes(x)), segredos.filter(x => html.includes(x)).slice(0, 3).join(' | '));
    ok(sigla + ': nenhuma parte financeira (bolsa, pagamento, orçamento, R$)', !/bolsa|pagamento|orçamento|execução financeira|saldo|ajuda de custo/i.test(texto.replace(/não traz nome, CPF, endereço, foto nem dado bancário de ninguém/, '')) && (pf === 'obs_mpa' ? !/R\$/.test(texto) : true), (texto.match(/.{0,30}(bolsa|pagamento|orçamento|saldo|ajuda de custo).{0,30}/i) || [''])[0]);
    ok(sigla + ': não há abas, menu da equipe, botão de ajuda da equipe, Meus dados nem formulário', await p.evaluate(() => !document.querySelector('.abas, [data-acao=aba], [data-acao=meus-dados], [data-acao=ajuda], form, #painel, .btn.pri, [data-acao^=ficha], [data-acao^=campo], [data-acao^=pag]')));
    ok(sigla + ': só existem ações de leitura na tela', await p.evaluate(() => [...document.querySelectorAll('main [data-acao]')].every(e => /^acomp-(atualizar|imprimir)$/.test(e.dataset.acao))), await p.evaluate(() => [...new Set([...document.querySelectorAll('main [data-acao]')].map(e => e.dataset.acao))].join(',')));
    const mem = await p.evaluate(() => { const S = MQ.ui.S; return { eq: (S.equipe || []).length, fi: (S.fichas || []).length, vi: (S.visitas || []).length, dg: (S.diagnosticos || []).length, aud: (S.aud || []).length, sol: (S.solic || []).length, obs: !!S.eu.observador, papel: S.eu.papel }; });
    ok(sigla + ': o navegador não guarda equipe, fichas, visitas, diagnósticos nem histórico', mem.eq + mem.fi + mem.vi + mem.dg + mem.aud === 0 && mem.obs, JSON.stringify(mem));
    ok(sigla + ': não guarda cópia de dados da equipe no aparelho', await p.evaluate(() => !Object.keys(localStorage).some(k => /^mq-cache-obs/.test(k))));
    const bloqueios = await p.evaluate(async () => { const a = MQ.ui.S.api; const r = {};
      for (const [n, f] of [['listarObservadores', () => a.listarObservadores()], ['salvarObservador', () => a.salvarObservador({ nome: 'Colega Indevido', email: 'x@y.br', orgao: 'mda' })], ['gerarCodigoObservador', () => a.gerarCodigoObservador('x')], ['salvarKitItem', () => a.salvarKitItem({ item: 'Arame', unidade: 'm', valor_ref: 2 })], ['dadosAcompanhamento(outro)', async () => { const d = await a.dadosAcompanhamento(MQ.ui.S.eu.orgao === 'mda' ? 'mpa' : 'mda'); if (d.orgao !== MQ.ui.S.eu.orgao) throw new Error('trocou'); return 'recusa-ok'; }]])
        { try { const v = await f(); r[n] = v === 'recusa-ok' ? 'ok' : 'ACEITOU'; } catch (e) { r[n] = 'ok'; } }
      r.fichas = (await a.listarFichas().catch(() => [])).length; r.equipe = (await a.listarEquipe().catch(() => [])).filter(m => m.cpf || m.pix_chave).length; return r; });
    ok(sigla + ': não cadastra, não lista colegas, não gera código, não altera preço e não troca de órgão', ['listarObservadores', 'salvarObservador', 'gerarCodigoObservador', 'salvarKitItem', 'dadosAcompanhamento(outro)'].every(k => bloqueios[k] === 'ok'), JSON.stringify(bloqueios));
    const dados = await p.evaluate(() => MQ.ui.S.acomp);
    ok(sigla + ': os números recebidos são só contagens (nenhum texto além de estado, município e mês)', Object.keys(dados).every(k => ['orgao', 'gerado_em', 'hoje', 'por_uf', 'municipios', 'mensal', 'perfil', 'impacto', 'formacao'].includes(k)) && dados.por_uf.every(u => Object.entries(u).every(([k, v]) => k === 'uf' || typeof v === 'number')));
    ok(sigla + ': a soma dos estados aparece nos números grandes', (await txt('.ac-kpis')).startsWith(String(dados.por_uf.reduce((t, u) => t + u.selecionadas, 0))), (await txt('.ac-kpis')).slice(0, 40));
    ok(sigla + ': mapa, tabela por estado e evolução por mês estão na tela', await p.evaluate(() => !!document.querySelector('.ac-mapa svg') && document.querySelectorAll('#ac-mapa .ac-tab tbody tr').length >= 5 && !!document.querySelector('#ac-evolucao')));
    ok(sigla + ': o gráfico tem descrição para leitor de tela e tabela com os mesmos números', await p.evaluate(() => { const s = document.querySelector('.ac-svg'); return !s || (s.getAttribute('role') === 'img' && /Visitas feitas por mês/.test(s.getAttribute('aria-label')) && !!document.querySelector('#ac-evolucao table')); }));
    ok(sigla + ': toda barra de progresso diz o valor em texto', await p.evaluate(() => [...document.querySelectorAll('main .medidor')].every(m => m.getAttribute('aria-hidden') === 'true' || (m.getAttribute('role') === 'img' && /\d/.test(m.getAttribute('aria-label') || '')))));
    ok(sigla + ': há link para o guia do perfil', await p.locator(`a[href="manuais/guia-${pf.slice(4)}.pdf"]`).count() === 1);
    // atualizar agora
    const antes = dados.gerado_em; await p.waitForTimeout(1100); await p.click('[data-acao=acomp-atualizar]'); await p.waitForTimeout(700);
    ok(sigla + ': Atualizar agora busca os números de novo', await p.evaluate(a => MQ.ui.S.acomp.gerado_em !== a, antes));
    // imprimir
    ok(sigla + ': Imprimir chama a impressão do navegador', await p.evaluate(async () => { let n = 0; const o = window.print; window.print = () => { n++; }; document.querySelector('[data-acao=acomp-imprimir]').click(); await new Promise(r => setTimeout(r, 200)); window.print = o; return n === 1; }));
    // erro de rede
    await p.evaluate(async () => { const S = MQ.ui.S; S._orig = S.api.dadosAcompanhamento; S.api.dadosAcompanhamento = async () => { const e = new Error('sem internet'); e.semRede = true; throw e; }; document.querySelector('[data-acao=acomp-atualizar]').click(); await new Promise(r => setTimeout(r, 500)); });
    ok(sigla + ': sem internet, avisa e mantém os últimos números na tela', /Sem internet/.test(await txt('main')) && await p.locator('.ac-kpis').count() >= 1 && await p.locator('.ac-sec').count() >= 5);
    await p.evaluate(async () => { const S = MQ.ui.S; S.api.dadosAcompanhamento = S._orig; document.querySelector('[data-acao=acomp-atualizar]').click(); await new Promise(r => setTimeout(r, 500)); });
    ok(sigla + ': com a internet de volta, o aviso some', !/Não foi possível carregar/.test(await txt('main')));
    if (pf === 'obs_mda') {
      ok('MDA: tem caminho do quintal, metas, perfil e impacto; não tem formação nem equipe por estado', await p.evaluate(() => ['caminho', 'metas', 'perfil', 'impacto'].every(k => document.querySelector('#ac-' + k)) && !document.querySelector('#ac-formacao, #ac-estados, #ac-parado')));
      ok('MDA: as 3 metas físicas aparecem com situação escrita', await p.locator('.ac-meta .st-chip').count() === 3);
      ok('MDA: com menos de 5 selecionadas o perfil não aparece', /menos de 5 mulheres selecionadas/.test(await txt('#ac-perfil')) || await p.evaluate(() => MQ.ui.S.acomp.perfil.base >= 5));
    } else {
      ok('MPA: tem estado por estado, o que pede atenção e formação; não tem perfil nem impacto', await p.evaluate(() => ['estados', 'parado', 'formacao'].every(k => document.querySelector('#ac-' + k)) && !document.querySelector('#ac-perfil, #ac-impacto, #ac-metas')));
      ok('MPA: um cartão por estado, com equipe e comunidades', await p.locator('.ac-uf').count() === 5 && /bolsista/.test(await txt('.ac-ufs')));
    }
  }
  // perfil com mais gente: aparece em percentuais, com grupo pequeno escondido
  await como('obs_mda'); await p.waitForSelector('.ac-kpis');
  await p.evaluate(() => { const a = JSON.parse(JSON.stringify(MQ.ui.S.acomp)); a.perfil = { base: 40, sustento: 30, cadunico: 22, sem_ater: 12, raca_povo: -1, jovem: 0, grupo: 9, caf: 40, faixas: { '18 a 29': -1, '30 a 44': 20, '45 a 59': 15, '60 ou mais': 5 } };
    a.impacto = { base_n: 40, renda_quintal_media: 132.5, final_n: 12, produz: { sim: 9, em_parte: -1, nao: 0 }, ebia_final: { seguranca: 6, leve: 5, moderada: -1, grave: 0 } }; MQ.ui.S.acomp = a; MQ.ui.render(); });
  const perf = await txt('#ac-perfil'), imp = await txt('#ac-impacto');
  ok('MDA: perfil mostra número e percentual (30 de 40 = 75%)', /Responsáveis pelo sustento da família\s*30 · 75%/.test(perf), perf.slice(0, 160));
  ok('MDA: grupo de 1 a 4 mulheres aparece como "menos de 5", sem número', /povo tradicional\s*menos de 5/.test(perf) && /18 a 29 anos\s*menos de 5/.test(perf) && !/-1/.test(perf));
  ok('MDA: impacto mostra a linha de base e a avaliação final, com grupo pequeno escondido', /40 famílias com diagnóstico/.test(imp) && /132,50/.test(imp) && /12 quintais já avaliados/.test(imp) && /Produzindo em parte\s*menos de 5/.test(imp) && !/-1/.test(imp), imp.slice(0, 200));
  // trocar para um perfil da equipe e voltar não deixa resto
  await como('bolsista'); ok('voltar a um perfil da equipe traz a tela normal', await p.evaluate(() => !document.querySelector('.ac-kpis') && MQ.ui.S.fichas.length > 0 && !MQ.ui.S.eu.observador));
  await como('obs_mpa'); await p.waitForSelector('.ac-kpis'); ok('e voltar ao acompanhamento limpa de novo os dados da equipe', await p.evaluate(() => MQ.ui.S.fichas.length + MQ.ui.S.equipe.length === 0));

  // ---------- coordenação geral: cadastro, código e prévia ----------
  await como('coord_geral'); await p.evaluate(() => { MQ.ui.fecharPainel(); MQ.ui.S.aba = 'equipe'; MQ.ui.render(); }); await p.waitForSelector('#ac-coord');
  const fm = 'form[data-form="acomp-pessoa"]';
  const tudo = async () => (await txt('#ac-coord')) + ' ' + (await p.locator('#painel').count() ? await txt('#painel') : '');
  const cartoes = () => p.locator('#ac-coord .vagabtn[data-acao=acomp-editar]');
  const abre = async nome => { await p.evaluate(() => MQ.ui.fecharPainel()); await cartoes().filter({ hasText: nome }).click(); await p.waitForSelector('#painel ' + fm); };
  const grava = async (nome, email, orgao, cargo) => { if (!await p.locator('#painel ' + fm).count()) { await p.click('#ac-coord [data-acao=acomp-novo][data-o=mda]'); await p.waitForSelector('#painel ' + fm); }
    await p.fill('#ac-nome', nome); await p.fill('#ac-email', email); await p.selectOption('#ac-orgao', orgao); await p.fill('#ac-cargo', cargo || ''); await p.click(fm + ' button[type=submit]'); await p.waitForTimeout(800); return tudo(); };
  ok('coordenação: o cadastro abre no painel lateral, como os demais da aba Equipe', await p.locator('#painel').count() === 0 && await p.locator('#ac-coord form').count() === 0 && await p.locator('#ac-coord .ag-quadro .ag-tr').count() === 2);
  ok('coordenação: e-mail inválido é recusado', /Confira o e-mail/.test(await grava('Fulana de Tal', 'sem-arroba', 'mda')));
  ok('coordenação: sem órgão é recusado', /Escolha o órgão/.test(await grava('Fulana de Tal', 'fulana@mda.exemplo', '')));
  const emailEq = await p.evaluate(() => MQ.ui.S.equipe.find(m => m.email).email);
  ok('coordenação: e-mail de alguém da equipe é recusado', /já é de uma pessoa da equipe/.test(await grava('Pessoa da Equipe', emailEq.toUpperCase(), 'mda')));
  ok('coordenação: nada foi gravado nas recusas', await cartoes().count() === 0);
  await grava('Marta Observadora', 'Marta@MDA.exemplo', 'mda', '<b>Analista</b>');
  ok('coordenação: ao gravar, o painel fecha', await p.locator('#painel').count() === 0);
  await grava('Paulo Parceiro Silva', 'paulo@mpa.exemplo', 'mpa');
  ok('coordenação: as duas pessoas entram na lista, cada uma no seu órgão, com "Sem código"', await cartoes().count() === 2 && await p.locator('#ac-coord .ag-tr').nth(0).locator('.vagabtn').count() === 1 && /Paulo Parceiro/.test(await p.locator('#ac-coord .ag-tr').nth(1).textContent()) && /Sem código/.test(await txt('#ac-coord')));
  ok('coordenação: código embutido no cargo aparece como texto', await p.evaluate(() => !document.querySelector('#ac-coord .vagabtn b') && /<b>Analista<\/b>/.test(document.querySelector('#ac-coord .ag-lista').textContent)));
  ok('coordenação: e-mail repetido é recusado', /já está cadastrado/.test(await grava('Outra Marta', 'marta@mda.exemplo', 'mpa')));
  await abre('Marta Observadora'); await p.click('#painel [data-acao=acomp-codigo]'); await p.waitForTimeout(700);
  const cod = await txt('#ac-coord .ac-cod');
  ok('coordenação: gera o código de primeiro acesso no formato XXXX-XXXX e explica o que fazer', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(cod.trim()) && /Primeiro acesso/.test(await txt('#ac-coord')) && await p.locator('#painel').count() === 0 && /Código gerado/.test(await txt('#ac-coord')), cod);
  ok('coordenação: o código não fica guardado nos dados (só a validade)', await p.evaluate(c => !localStorage.getItem('mq-demo-v4').includes(c.replace('-', '')) && !localStorage.getItem('mq-demo-v4').includes(c), cod.trim()));
  // quem já tem senha: pede confirmação antes de liberar novo acesso
  await p.evaluate(async () => { const d = JSON.parse(localStorage.getItem('mq-demo-v4')); d.observadores.find(o => /paulo/.test(o.email)).tem_senha = true; localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await MQ.ui.S.api.reler(); await MQ.ui.carregar(); MQ.ui.render(); }); await p.waitForTimeout(400);
  await abre('Paulo Parceiro'); await p.click('#painel form [data-acao=acomp-codigo]'); await p.waitForTimeout(400);
  ok('coordenação: novo acesso de quem já tem senha pede confirmação antes', /Liberar um novo primeiro acesso para Paulo Parceiro Silva/.test(await txt('#ac-coord')) && await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).observadores.find(o => /paulo/.test(o.email)).tem_senha === true));
  await p.click('[data-acao=acomp-codigo-nao]'); await p.waitForTimeout(300);
  ok('coordenação: Cancelar não gera código', !/Liberar um novo primeiro acesso para/.test(await tudo()) && await p.locator('.ac-cod').count() === 0);
  await abre('Paulo Parceiro'); await p.click('#painel form [data-acao=acomp-codigo]'); await p.waitForTimeout(300); await p.click('[data-acao=acomp-codigo][data-confirmado="1"]'); await p.waitForTimeout(700);
  ok('coordenação: confirmando, a senha antiga deixa de valer e sai um código novo', await p.locator('#ac-coord .ac-cod').count() === 1 && await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).observadores.find(o => /paulo/.test(o.email)).tem_senha === false));
  // desativar
  await abre('Marta Observadora');
  ok('coordenação: tocar na pessoa carrega os dados dela no formulário', await p.inputValue('#ac-email') === 'marta@mda.exemplo' && await p.inputValue('#ac-orgao') === 'mda');
  await p.uncheck(fm + ' [name=ativo]'); await p.click(fm + ' button[type=submit]'); await p.waitForTimeout(800);
  const lm = await cartoes().filter({ hasText: 'Marta Observadora' }).textContent(); await abre('Marta Observadora'); const semCod = await p.locator('#painel form [data-acao=acomp-codigo]').count() === 0; await p.evaluate(() => MQ.ui.fecharPainel());
  ok('coordenação: desativar tira o botão de código e marca a pessoa', /Desativado/.test(lm) && semCod);
  ok('coordenação: cadastro, alteração e código ficam no histórico, sem o código', await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('mq-demo-v4')).auditoria.filter(x => x.tabela === 'observadores'); return ['INSERT', 'UPDATE', 'CODIGO', 'NOVO_ACESSO'].every(k => a.some(x => x.acao === k)) && !JSON.stringify(a).match(/[A-Z2-9]{4}-[A-Z2-9]{4}/); }));
  // prévia
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.click('#ac-coord [data-acao=acomp-previa][data-o=mda]'); await p.waitForSelector('#painel .ac-previa');
  ok('coordenação: a prévia abre numa janela no meio da tela, com a tela do MDA e os números de agora', /O caminho de cada quintal/.test(await txt('.ac-previa')) && !/Estado por estado/.test(await txt('.ac-previa')) && await p.evaluate(() => { const r = document.querySelector('aside.painel.centro').getBoundingClientRect(); const w = document.documentElement.clientWidth; return Math.abs((r.left + r.right) / 2 - w / 2) < 10 && r.left >= 0 && r.right <= w; }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); ok('coordenação: Esc fecha a prévia', await p.locator('.ac-previa').count() === 0);
  await p.click('#ac-coord [data-acao=acomp-previa][data-o=mpa]'); await p.waitForSelector('#painel .ac-previa');
  ok('coordenação: e a do MPA', /Estado por estado/.test(await txt('.ac-previa')) && !/Quem são as mulheres/.test(await txt('.ac-previa')));
  await p.click('#painel .fechar'); await p.waitForTimeout(300); ok('coordenação: fechar a prévia', await p.locator('.ac-previa').count() === 0);
  // outros perfis da equipe não veem o bloco nem alcançam as funções
  for (const pf of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) { await como(pf); await p.evaluate(() => MQ.ui.fecharPainel());
    const r = await p.evaluate(async () => { const a = MQ.ui.S.api; const t = async f => { try { await f(); return 'ACEITOU'; } catch (e) { return 'ok'; } };
      return { bloco: !!document.querySelector('#ac-coord'), lista: await t(() => a.listarObservadores()), grava: await t(() => a.salvarObservador({ nome: 'Colega Indevido', email: 'c@d.br', orgao: 'mda' })), cod: await t(() => a.gerarCodigoObservador('x')),
        numeros: MQ.ui.S.eu.papel === 'coord_tecnico' ? 'ok' : await t(() => a.dadosAcompanhamento('mda')) }; });
    ok('perfil ' + pf + ': não vê o cadastro de acompanhamento nem alcança as funções', !r.bloco && r.lista === 'ok' && r.grava === 'ok' && r.cod === 'ok' && r.numeros === 'ok', JSON.stringify(r)); }
  ok('nenhum erro de página, alerta ou bloqueio da política de conteúdo (computador)', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // ---------- celular ----------
  for (const larg of [320, 390]) { ({ ctx, p, errs, como, txt } = await novo({ width: larg, height: 780 }));
    for (const pf of ['obs_mda', 'obs_mpa']) { await como(pf); await p.waitForSelector('.ac-kpis');
      const c = await p.evaluate(() => { const de = document.documentElement; const bt = [...document.querySelectorAll('main .btn, main a.btn')].filter(e => e.offsetParent);
        const fonte = Math.min(...[...document.querySelectorAll('main *')].filter(e => e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize)));
        return { rolagem: de.scrollWidth - de.clientWidth, baixos: bt.filter(e => e.getBoundingClientRect().height < 39.5).length, fonte }; });
      ok(`celular ${larg} px, ${pf.slice(4).toUpperCase()}: não rola para o lado, botões com 40 px ou mais, texto de 12 px ou mais`, c.rolagem <= 1 && c.baixos === 0 && c.fonte >= 12, JSON.stringify(c)); }
    ok(`celular ${larg} px: nenhum erro de página`, errs.length === 0, errs.join(' | ')); await ctx.close(); }
  console.log('\n' + R.filter(Boolean).length + ' passou, ' + R.filter(x => !x).length + ' falhou'); await b.close(); process.exit(R.some(x => !x) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
