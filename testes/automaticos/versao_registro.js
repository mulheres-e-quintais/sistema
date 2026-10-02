/* 47 · versão do registro na tela (modo demonstração, que espelha o banco):
   outra pessoa altera o registro enquanto o formulário está aberto -> o envio é recusado, o formulário reabre com o dado
   novo e o que foi digitado volta; salvar duas vezes seguidas; editar sem internet duas vezes e enviar; edição na fila e
   a coordenação decide antes do envio.
   Uso: node versao_registro.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
const MSG = /alterado por outra pessoa enquanto você editava/;
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=bolsista]').click(); }); await p.waitForTimeout(900); await p.evaluate(() => MQ.ui.fecharPainel());
  const espera = ms => p.waitForTimeout(ms);
  const enviar = async sel => { await p.evaluate(s => document.querySelector(s).requestSubmit(), sel); await espera(700); };

  /* ---------- visita: outra pessoa remarca enquanto o formulário está aberto ---------- */
  const vid = await p.evaluate(() => { const S = MQ.ui.S; const v = (S.visitas || []).find(x => x.situacao === 'prevista' && x.uf === S.eu.uf && x.data_prevista >= MQ.regras.hoje()); return v && v.id; });
  ok('Há visita prevista para o teste', !!vid);
  if (vid) {
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), vid); await espera(200);
    await p.fill('#vi-o', 'Levar mudas de coentro');
    await espera(5);
    await p.evaluate(async id => { const v = MQ.ui.S.visitas.find(x => x.id === id); await MQ.apiDemo.salvarVisita(Object.assign({}, v, { obs: 'Outra pessoa mexeu' }), {}); }, vid);
    await enviar('form[data-form=visita]');
    ok('Recusado: o formulário continua aberto', !!(await p.$('form[data-form=visita]')));
    ok('Aviso de que outra pessoa alterou aparece no formulário', MSG.test(await p.textContent('#painel')));
    ok('O que foi digitado voltou para o campo', (await p.inputValue('#vi-o')) === 'Levar mudas de coentro', await p.inputValue('#vi-o'));
    ok('O servidor não foi alterado pelo envio recusado', await p.evaluate(async id => (await MQ.apiDemo.listarVisitas()).find(x => x.id === id).obs === 'Outra pessoa mexeu', vid));
    ok('Nada ficou preso na fila do aparelho', await p.evaluate(async () => (await MQ.fila.listar(MQ.ui.S.eu.id)).length === 0));
    await enviar('form[data-form=visita]');
    ok('Conferiu e salvou de novo: gravado, painel fechado', !(await p.$('form[data-form=visita]')) && await p.evaluate(async id => (await MQ.apiDemo.listarVisitas()).find(x => x.id === id).obs === 'Levar mudas de coentro', vid));
    // salvar duas vezes seguidas
    for (const txt of ['Primeira vez', 'Segunda vez']) {
      await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), vid); await espera(200);
      await p.fill('#vi-o', txt); await enviar('form[data-form=visita]');
      ok('Salvar duas vezes seguidas: "' + txt + '" gravou sem aviso de conflito', !(await p.$('form[data-form=visita]')) && await p.evaluate(async ([id, t]) => (await MQ.apiDemo.listarVisitas()).find(x => x.id === id).obs === t, [vid, txt]));
    }
  }

  /* ---------- ficha: sem internet, editar duas vezes e enviar ---------- */
  const fid = await p.evaluate(() => { const S = MQ.ui.S; const f = (S.fichas || []).find(x => x.uf === S.eu.uf && x.situacao !== 'aprovada'); return f && f.id; });
  ok('Há ficha não aprovada para o teste', !!fid);
  const abrirFicha = async () => { await p.evaluate(id => { const b = document.querySelector('[data-acao=ficha-corrigir][data-id="' + id + '"]'); if (b) b.click();
    else { const S = MQ.ui.S; const it = S.fila.find(i => i.id === id); const f = Object.assign({}, S.fichas.find(x => x.id === id), it ? it.dados : {}); MQ.ui.abrirPainel({ tipo: 'ficha-form', dados: f }); } }, fid); await espera(300); };
  if (fid) {
    await ctx.setOffline(true);
    await abrirFicha(); await p.fill('form[data-form=ficha] [name=comunidade]', 'Comunidade editada 1'); await enviar('form[data-form=ficha]');
    const erro1 = await p.evaluate(() => { const f = document.querySelector('form[data-form=ficha]'); return f ? f.innerText.slice(0, 0) + [...f.querySelectorAll('.erro,[data-erro]:not([hidden])')].map(x => x.textContent).join(' | ') : ''; });
    ok('Sem internet: a ficha editada fica guardada no aparelho', await p.evaluate(async id => (await MQ.fila.listar(MQ.ui.S.eu.id)).some(i => i.id === id && i.marca), fid), erro1);
    await abrirFicha(); await p.fill('form[data-form=ficha] [name=ponto_referencia]', 'Perto da escola'); await enviar('form[data-form=ficha]');
    const it = await p.evaluate(async id => { const i = (await MQ.fila.listar(MQ.ui.S.eu.id)).find(x => x.id === id); const f = MQ.ui.S.fichas.find(x => x.id === id); return i && { marca: i.marca, lida: f.atualizado_em, com: i.dados.comunidade, pr: i.dados.ponto_referencia }; }, fid);
    ok('Segunda edição sem internet: um item só, com a marca da primeira leitura e as duas mudanças', !!it && it.marca === it.lida && it.com === 'Comunidade editada 1' && it.pr === 'Perto da escola', JSON.stringify(it));
    await ctx.setOffline(false); await p.evaluate(() => MQ.ui.sincronizar(false)); await espera(700);
    ok('Voltou a internet: enviado, fila vazia, as duas mudanças no servidor', await p.evaluate(async id => { const f = (await MQ.apiDemo.listarFichas()).find(x => x.id === id);
      return (await MQ.fila.listar(MQ.ui.S.eu.id)).length === 0 && f.comunidade === 'Comunidade editada 1' && f.ponto_referencia === 'Perto da escola'; }, fid));

    /* ---------- ficha na fila e a coordenação decide antes do envio ---------- */
    await ctx.setOffline(true);
    await abrirFicha(); await p.fill('form[data-form=ficha] [name=comunidade]', 'Editada na fila'); await enviar('form[data-form=ficha]');
    await espera(5);
    await p.evaluate(async id => { await MQ.apiDemo.trocarPerfil('coord_tecnico'); await MQ.apiDemo.decidirFicha(id, 'devolvida', 'Falta a foto do termo'); await MQ.apiDemo.trocarPerfil('bolsista'); }, fid);
    await ctx.setOffline(false); await p.evaluate(() => MQ.ui.sincronizar(false)); await espera(700);
    const c = await p.evaluate(async id => { const i = (await MQ.fila.listar(MQ.ui.S.eu.id)).find(x => x.id === id); const f = (await MQ.apiDemo.listarFichas()).find(x => x.id === id);
      return { conflito: i && i.conflito, erro: i && i.erro, dig: i && i.dados.comunidade, serv: f.comunidade, sit: f.situacao }; }, fid);
    ok('Coordenação decidiu antes: envio recusado, item continua no aparelho com o que foi digitado', c.conflito === true && MSG.test(c.erro || '') && c.dig === 'Editada na fila' && c.serv === 'Comunidade editada 1' && c.sit === 'devolvida', JSON.stringify(c));
    ok('A lista mostra "Não enviada: corrigir"', /Não enviada: corrigir/.test(await p.textContent('#app')));
    await abrirFicha();
    ok('Reabrindo: o que ela digitou está no formulário', (await p.inputValue('form[data-form=ficha] [name=comunidade]')) === 'Editada na fila');
    await enviar('form[data-form=ficha]');
    ok('Conferiu e enviou de novo: gravado, fila vazia', await p.evaluate(async id => { const f = (await MQ.apiDemo.listarFichas()).find(x => x.id === id);
      return (await MQ.fila.listar(MQ.ui.S.eu.id)).length === 0 && f.comunidade === 'Editada na fila'; }, fid));
  }
  ok('Sem erro de página', errs.length === 0, errs.join('|'));
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
