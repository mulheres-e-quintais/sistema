/* Etapa 69 (21/10/2026): cancelar pedido de pagamento, desligamento com bolsa aprovada, cancelar ou ajustar passagem e evento autorizados.
   Mesmas regras do supabase/69_cancelamentos.sql, vistas na tela (modo demonstração).
   Uso: node testes/automaticos/cancelamentos.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
const REL = 'Em outubro fiz 3 reuniões com as comunidades, apliquei 4 fichas de indicação e acompanhei a agente nas visitas.';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOGO: ' + d.message()); d.dismiss(); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('button[data-p]');
  await p.evaluate(() => { window.demo = () => JSON.parse(localStorage.getItem('mq-demo-v4')); window.demoGrava = async d => { localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await MQ.apiDemo.reler(); }; });
  const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(700); await p.evaluate(() => MQ.ui.fecharPainel()); };
  const recarregar = () => p.evaluate(async () => { await MQ.ui.carregar(); MQ.ui.render(); });
  const erroDe = sel => p.evaluate(sel => { const f = document.querySelector(sel); if (!f) return ''; const e = f.querySelector('[data-erro]'); const c = [...f.querySelectorAll('.campo .erro')].map(x => x.textContent).join(' ');
    return ((e && !e.hidden ? e.textContent : '') + ' ' + c).trim(); }, sel);
  const solic = id => p.evaluate(id => (demo().solicitacoes || []).find(s => s.id === id), id);
  const abrirPag = async id => { await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'pag-ver', id }), id); await p.waitForTimeout(400); };
  const temCancelar = () => p.evaluate(() => !!document.querySelector('#painel [data-pag-cancelar] form[data-form=pag-cancelar]'));
  const cancelar = async motivo => {
    await p.evaluate(() => { const d = document.querySelector('#painel [data-pag-cancelar]'); d.open = true; });
    await p.fill('#painel form[data-form=pag-cancelar] textarea[name=motivo]', motivo || '');
    await p.click('#painel form[data-form=pag-cancelar] button[type=submit]'); await p.waitForTimeout(700);
  };
  const mes = await p.evaluate(() => MQ.regras.hoje().slice(0, 7));

  /* ---------- 1. a própria pessoa cancela a bolsa sem aval, e pede de novo ---------- */
  await entrar('bolsista');
  const euB = await p.evaluate(() => MQ.ui.S.eu.id);
  const idB = await p.evaluate(async (a) => { await MQ.ui.S.api.solicitarPagamento('bolsa', a.mes + '-01', MQ.PAPEIS[MQ.ui.S.eu.papel].bolsa, a.REL, [], {}); await MQ.ui.carregar(); MQ.ui.render();
    return (MQ.ui.S.solic || []).find(s => s.tipo === 'bolsa' && s.equipe_id === MQ.ui.S.eu.id).id; }, { mes, REL });
  const link = await p.evaluate(id => !!document.querySelector(`.pag-c [data-acao=pag-ver][data-id="${id}"]`), idB);
  ok('1.1 no cartão da bolsa aguardando aval aparece "Ver o pedido ou cancelar"', link);
  await abrirPag(idB);
  ok('1.2 o painel do próprio pedido tem "Cancelar este pedido" (fechado)', await temCancelar() && await p.evaluate(() => !document.querySelector('#painel [data-pag-cancelar]').open));
  await cancelar('');
  let s = await solic(idB);
  ok('1.3 a própria pessoa cancela sem motivo (motivo padrão)', s.situacao === 'cancelada' && s.motivo_cancelamento === 'Cancelado por quem pediu.' && s.cancelado_por === euB, s && [s.situacao, s.motivo_cancelamento]);
  const cartao = await p.evaluate(() => { const f = document.querySelector('form[data-form=pag-bolsa]'); return f ? f.textContent.replace(/\s+/g, ' ') : ''; });
  ok('1.4 o cartão mostra "Cancelada", o motivo e o botão para pedir de novo', /Cancelada/.test(cartao) && /Cancelado por quem pediu/.test(cartao) && /Pedir de novo a bolsa/.test(cartao), cartao.slice(0, 200));
  await p.click('form[data-form=pag-bolsa] button[type=submit]'); await p.waitForTimeout(700);
  s = await solic(idB);
  ok('1.5 pedir de novo volta o mesmo registro para "aguardando aval", sem os dados do cancelamento', s.situacao === 'solicitada' && !s.motivo_cancelamento && !s.cancelado_em, [s.situacao, s.motivo_cancelamento]);

  /* ---------- 2. coordenação técnica: motivo obrigatório; com aval, só a geral ---------- */
  await entrar('coord_tecnico');
  await abrirPag(idB);
  ok('2.1 a técnica vê "Cancelar este pedido" na bolsa aguardando o aval dela', await temCancelar());
  await cancelar('abc');
  ok('2.2 sem motivo (ou com menos de 5 letras): barrado na tela', /motivo/i.test(await erroDe('#painel form[data-form=pag-cancelar]')) && (await solic(idB)).situacao === 'solicitada', await erroDe('#painel form[data-form=pag-cancelar]'));
  await p.evaluate(id => MQ.ui.S.api.avalizarPagamento(id, true, '', null), idB); await recarregar(); await abrirPag(idB);
  ok('2.3 com aval, a técnica não vê mais o cancelamento', !(await temCancelar()));
  const tecComAval = await p.evaluate(id => MQ.ui.S.api.cancelarPagamento(id, 'Mês sem atividade').then(() => 'gravou', e => e.message), idB);
  ok('2.4 com aval, a técnica é recusada também pela regra (servidor)', /só a coordenação geral/.test(tecComAval), tecComAval);
  await entrar('coord_geral');
  await abrirPag(idB);
  ok('2.5 a coordenação geral vê o cancelamento no pedido com aval (antes do Arlo)', await temCancelar());
  await cancelar('Mês sem atividade comprovada');
  s = await solic(idB);
  ok('2.6 a coordenação geral cancela o pedido com aval, com o motivo', s.situacao === 'cancelada' && s.motivo_cancelamento === 'Mês sem atividade comprovada', [s.situacao, s.motivo_cancelamento]);
  await p.evaluate(() => { MQ.ui.fecharPainel(); MQ.ui.S.aba = 'pagamentos'; MQ.ui.render(); }); await p.waitForTimeout(400);
  ok('2.7 a aba Pagamentos tem a lista "Canceladas"', await p.evaluate(() => /Canceladas \(1\)/.test((document.querySelector('[data-pag-canceladas] summary') || {}).textContent || '')));

  /* ---------- 3. ajuda de custo: visitas livres; lançado no Arlo não se cancela ---------- */
  await entrar('agente');
  const idA = await p.evaluate(async (mes) => {
    const d = demo(); const eu = MQ.ui.S.eu; const v = d.visitas.find(x => x.executor_id === eu.id) || d.visitas[0];
    Object.assign(v, { executor_id: eu.id, situacao: 'realizada', data_realizada: mes + '-02' }); await demoGrava(d);
    await MQ.ui.carregar();
    await MQ.ui.S.api.solicitarPagamento('ajuda_custo', mes + '-01', 120, null, [v.id], { visitas: [{ id: v.id, total: 120 }], total: 120 });
    await MQ.ui.carregar(); MQ.ui.render();
    return { s: (MQ.ui.S.solic || []).find(s => s.tipo === 'ajuda_custo' && s.equipe_id === eu.id).id, v: v.id };
  }, mes);
  await entrar('coord_tecnico');
  await abrirPag(idA.s); await cancelar('Visita registrada em dobro');
  const livre = await p.evaluate(v => !(demo().solic_visitas || {})[v], idA.v);
  ok('3.1 a técnica cancela a ajuda de custo com motivo e a visita fica livre para um pedido novo', (await solic(idA.s)).situacao === 'cancelada' && livre, (await solic(idA.s)).situacao);
  await entrar('agente');
  const novo = await p.evaluate(async (a) => { await MQ.ui.S.api.solicitarPagamento('ajuda_custo', a.mes + '-01', 120, null, [a.v], { visitas: [{ id: a.v, total: 120 }], total: 120 });
    const l = demo().solicitacoes.filter(s => s.tipo === 'ajuda_custo' && s.equipe_id === MQ.ui.S.eu.id && s.situacao === 'solicitada'); return l.map(s => !!(s.detalhe || {}).complementar); }, { mes, v: idA.v });
  ok('3.2 a visita liberada entra num pedido novo, que não é "complementar"', novo.length === 1 && novo[0] === false, novo);
  await entrar('coord_tecnico');
  const idA2 = await p.evaluate(() => demo().solicitacoes.find(s => s.tipo === 'ajuda_custo' && s.situacao === 'solicitada').id);
  await p.evaluate(id => MQ.ui.S.api.avalizarPagamento(id, true, '', null), idA2);
  await entrar('auxiliar'); await p.evaluate(id => MQ.ui.S.api.registrarNoArlo(id, 'P-1'), idA2);
  await entrar('coord_geral'); await abrirPag(idA2);
  ok('3.3 lançado no Arlo: nem a coordenação geral vê o cancelamento', !(await temCancelar()));
  const lanc = await p.evaluate(id => MQ.ui.S.api.cancelarPagamento(id, 'Pago a mais').then(() => 'gravou', e => e.message), idA2);
  ok('3.4 lançado no Arlo: recusado também pela regra', /lançada no Arlo/.test(lanc), lanc);

  /* ---------- 4. desligamento com data antes de bolsa com aval ---------- */
  await entrar('bolsista');
  await p.evaluate(async (a) => { await MQ.ui.S.api.solicitarPagamento('bolsa', a.mes + '-01', MQ.PAPEIS[MQ.ui.S.eu.papel].bolsa, a.REL, [], {}); }, { mes, REL });
  await entrar('coord_tecnico');
  await p.evaluate(eu => { const s = demo().solicitacoes.find(x => x.tipo === 'bolsa' && x.equipe_id === eu && x.situacao === 'solicitada'); return MQ.ui.S.api.avalizarPagamento(s.id, true, '', null); }, euB);
  await entrar('coord_geral');
  const antes = await p.evaluate(async (a) => { const [y, m] = a.mes.split('-').map(Number); const ult = new Date(y, m - 1, 0); const df = ult.getFullYear() + '-' + String(ult.getMonth() + 1).padStart(2, '0') + '-' + String(ult.getDate()).padStart(2, '0');
    return MQ.ui.S.api.desligar(a.eu, df, 'Saiu do projeto no mês anterior', null).then(() => 'desligou', e => e.message); }, { mes, eu: euB });
  ok('4.1 a data de saída não fica antes de bolsa com aval (mensagem diz o mês e o que fazer)', /antes de bolsa já aprovada/.test(antes) && /com aval/.test(antes) && /cancela o aval/.test(antes), antes);
  ok('4.2 ela continua ativa', await p.evaluate(eu => demo().equipe.find(x => x.id === eu).status === 'ativa', euB));

  /* ---------- 5. passagem ou evento autorizado ---------- */
  await entrar('bolsista');
  const idP = await p.evaluate(async () => { const dt = MQ.regras.somaDias(MQ.regras.hoje(), 60);
    return MQ.ui.S.api.salvarPedido(null, 'evento', 'Encontro estadual de teste 69', dt, { valor_estimado: 2000, local: 'Teresina', publico: 40, itens: 'Almoço' }, null); }).catch(e => 'ERRO ' + e.message);
  await p.evaluate(async id => { const d = demo(); const x = d.pedidos.find(y => y.id === id); Object.assign(x, { situacao: 'autorizado', valor_autorizado: 2000, decidido_em: new Date().toISOString() }); await demoGrava(d); }, idP);
  await entrar('coord_tecnico');
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'viag-ver', id }), idP); await p.waitForTimeout(400);
  ok('5.1 a técnica não vê "Ajustar o valor ou cancelar" no autorizado', !(await p.$('#painel [data-viag-autorizado]')));
  await entrar('coord_geral');
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'viag-ver', id }), idP); await p.waitForTimeout(400);
  ok('5.2 a coordenação geral vê "Ajustar o valor ou cancelar" (fechado)', await p.evaluate(() => { const d = document.querySelector('#painel [data-viag-autorizado]'); return !!d && !d.open; }));
  await p.evaluate(() => { document.querySelector('#painel [data-viag-autorizado]').open = true; });
  const F = '#painel form[data-form=viag-autorizado]';
  await p.fill(F + ' [name=valor]', '7000'); await p.fill(F + ' [name=motivo]', 'Nota fiscal');
  await p.click(F + ' button[value=ajustar]'); await p.waitForTimeout(500);
  ok('5.3 ajuste acima do teto: barrado na tela', /teto/i.test(await erroDe(F)), await erroDe(F));
  await p.fill(F + ' [name=valor]', '2300'); await p.fill(F + ' [name=motivo]', '');
  await p.click(F + ' button[value=ajustar]'); await p.waitForTimeout(500);
  ok('5.4 ajuste sem motivo: barrado na tela', /motivo/i.test(await erroDe(F)), await erroDe(F));
  await p.fill(F + ' [name=motivo]', 'Valor da nota fiscal'); await p.click(F + ' button[value=ajustar]'); await p.waitForTimeout(700);
  let ped = await p.evaluate(id => demo().pedidos.find(y => y.id === id), idP);
  ok('5.5 a coordenação geral ajusta o valor; o ajuste fica na observação', +ped.valor_autorizado === 2300 && /Valor ajustado de .*2\.000,00 para .*2\.300,00.*Valor da nota fiscal/.test(ped.obs || ''), [ped.valor_autorizado, ped.obs]);
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'viag-ver', id }), idP); await p.waitForTimeout(400);
  await p.evaluate(() => { document.querySelector('#painel [data-viag-autorizado]').open = true; });
  await p.fill(F + ' [name=motivo]', 'Evento adiado para 2027'); await p.click(F + ' button[value=cancelar]'); await p.waitForTimeout(700);
  ped = await p.evaluate(id => demo().pedidos.find(y => y.id === id), idP);
  ok('5.6 a coordenação geral cancela o autorizado, com o motivo', ped.situacao === 'cancelado' && /Cancelado depois de autorizado .*Evento adiado para 2027/.test(ped.obs || ''), [ped.situacao, ped.obs]);
  const saldo = await p.evaluate(async () => (await MQ.ui.S.api.saldoPedidos()).evento_usado);
  ok('5.7 o valor do cancelado volta ao saldo do teto', !(saldo || {})[ped.uf], saldo);

  ok('sem erro de página', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  const f = R.filter(r => r[0] === 'FALHOU').length;
  console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
