const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  for (const largura of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: largura, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
    const perfil = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel()); };
    const pedir = () => p.evaluate(async () => { const d = new Date(Date.now() + 50 * 864e5).toISOString().slice(0, 10);
      const id = await MQ.apiDemo.salvarPedido(null, 'passagem', 'Intercâmbio em Juazeiro', d, { finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] });
      await MQ.ui.carregar(); MQ.ui.render(); return id; });
    // com técnica
    await perfil('bolsista'); const id1 = await pedir();
    await perfil('auxiliar');
    ok(`${largura}: com técnica, auxiliar NÃO vê "Passagens e eventos para conferir"`, !/Passagens e eventos para conferir/.test(await p.textContent('main')));
    // desliga a técnica
    await perfil('coord_geral');
    await p.evaluate(async () => { const m = MQ.ui.S.equipe.find(x => x.papel === 'coord_tecnico' && x.status === 'ativa');
      await MQ.apiDemo.atualizar(m.id, { status: 'desligada', data_fim: [MQ.regras.hoje(), m.data_inicio].sort().pop(), motivo_desligamento: 'Vaga aberta para teste.' }); });
    await perfil('bolsista');
    ok(`${largura}: bolsista vê "Com o auxiliar administrativo"`, /Com o auxiliar administrativo/.test(await p.textContent('main')));
    await perfil('auxiliar');
    ok(`${largura}: auxiliar vê a seção e o atalho`, /Passagens e eventos para conferir/.test(await p.textContent('main')) && !!(await p.$('[data-alvo="#t-conf"]')));
    await p.click('[data-alvo="#t-conf"]'); await p.waitForTimeout(300);
    await p.click(`#t-conf ~ * [data-acao=viag-ver], section[aria-labelledby=t-conf] [data-acao=viag-ver]`); await p.waitForTimeout(300);
    ok(`${largura}: auxiliar abre o pedido e vê as passageiras`, /Maria das Dores/.test(await p.textContent('#painel')));
    ok(`${largura}: auxiliar não vê "Autorizar" nem texto da FUNCERN`, !/Autorizar e mandar/.test(await p.textContent('#painel')) && !(await p.$('#painel .viag-copia')));
    await p.click('#painel form[data-form=viag-mover] button[value=conferir]'); await p.waitForTimeout(500);
    ok(`${largura}: auxiliar confere pela tela`, await p.evaluate(id => MQ.ui.S.pedidos.find(x => x.id === id).situacao === 'conferido', id1));
    await perfil('coord_geral'); await p.evaluate(() => document.querySelector('[data-aba=viagens]').click()); await p.waitForTimeout(300);
    ok(`${largura}: geral vê o aviso do auxiliar e 1 esperando`, /quem confere os pedidos é o auxiliar administrativo/.test(await p.textContent('main')));
    await p.click('main [data-acao=viag-ver]'); await p.waitForTimeout(300);
    ok(`${largura}: painel mostra quem conferiu`, /Conferido/.test(await p.textContent('#painel')));
    await p.click('#painel form[data-form=viag-mover] button[value=autorizar]'); await p.waitForTimeout(500);
    ok(`${largura}: geral autoriza pela tela`, await p.evaluate(id => MQ.ui.S.pedidos.find(x => x.id === id).situacao === 'autorizado', id1));
    // geral não confere pedido novo
    await perfil('bolsista'); const id2 = await pedir(); await perfil('coord_geral'); await p.evaluate(() => document.querySelector('[data-aba=viagens]').click()); await p.waitForTimeout(300);
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'viag-ver', id }), id2); await p.waitForTimeout(200);
    const tx = await p.textContent('#painel');
    ok(`${largura}: geral não tem botão de conferir pedido novo (só recusar)`, /Quem confere este pedido é o auxiliar administrativo/.test(tx) && !(await p.$('#painel button[value=conferir]')) && !!(await p.$('#painel button[value=recusar]')));
    ok(`${largura}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
