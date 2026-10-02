/* 02/10/2026 — regras decididas (supabase/46_regras_decididas.sql): o modo demonstração e as telas recusam o mesmo que o banco.
   Etapas do campo, pedido complementar de ajuda de custo, teto de passagens por finalidade, bolsa da coordenação geral
   e travas do banco que a tela antecipa. Datas sempre relativas a hoje. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { montar, texto } = require('./telas');
const { carregar, diaMais } = require('./ambiente');

async function editarDemo(T, fn) { const ls = T.janela.localStorage; const d = JSON.parse(ls.getItem('mq-demo-v4')); fn(d); ls.setItem('mq-demo-v4', JSON.stringify(d)); await T.api.reler(); }
const lerDemo = T => JSON.parse(T.janela.localStorage.getItem('mq-demo-v4'));
const fonte = arq => fs.readFileSync(path.join(__dirname, '..', '..', 'js', arq), 'utf8');

/* ---------- 1. etapas do campo ---------- */
test('etapas: MQ.etapaMotivo diz por que a etapa ainda não pode (sem água, plano, ordem e data)', () => {
  const { MQ } = carregar(['dados.js']);
  const vis = (etapa, sit, data) => ({ id: etapa + sit, ficha_id: 'f1', etapa, situacao: sit, data_realizada: data });
  const dg = (o = {}) => Object.assign({ ficha_id: 'f1', situacao: 'aprovado', sem_agua: false }, o);
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', { visitas: [], diagnosticos: [dg({ sem_agua: true })] }), MQ.MSG_ETAPA.semAgua);
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', { visitas: [], diagnosticos: [dg({ situacao: 'enviado' })] }), MQ.MSG_ETAPA.plano);
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', { visitas: [], diagnosticos: [] }, { veTudo: true }), MQ.MSG_ETAPA.plano, 'quem vê tudo e não acha o diagnóstico: sem plano');
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', { visitas: [], diagnosticos: [] }), null, 'quem não vê o diagnóstico (agente) não é travada pela tela: o servidor decide');
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', { visitas: [], diagnosticos: [dg()] }), null);
  const base = { visitas: [vis('diagnostico', 'realizada', diaMais(-5))], diagnosticos: [dg()] };
  assert.match(MQ.etapaMotivo('implantacao', 'f1', base, { data: diaMais(-6) }), /A implantação não pode ter data anterior à do diagnóstico/);
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', base, { data: diaMais(-5) }), null, 'no mesmo dia pode');
  assert.equal(MQ.etapaMotivo('acompanhamento', 'f1', { visitas: [vis('implantacao', 'prevista')], diagnosticos: [dg()] }), MQ.MSG_ETAPA.acompanhamento);
  const comImp = { visitas: [vis('implantacao', 'realizada', diaMais(-3))], diagnosticos: [dg()] };
  assert.equal(MQ.etapaMotivo('acompanhamento', 'f1', comImp), null);
  assert.match(MQ.etapaMotivo('acompanhamento', 'f1', comImp, { data: diaMais(-4) }), /O acompanhamento não pode ter data anterior à da implantação/);
  assert.match(MQ.etapaMotivo('avaliacao', 'f1', comImp, { data: diaMais(-4) }), /A avaliação não pode ter data anterior à da implantação/);
  assert.equal(MQ.etapaMotivo('diagnostico', 'f1', comImp, { data: diaMais(-40) }), null);
  // registro antigo: só a data (a etapa já estava agendada antes da regra)
  assert.equal(MQ.etapaMotivo('implantacao', 'f1', { visitas: [], diagnosticos: [dg({ situacao: 'enviado' })] }, { soData: true }), null);
});

async function campoPI() {
  const T = await montar('bolsista'); const { MQ, S } = T; const R = MQ.regras; const eu = S.eu;
  const f = S.fichas.find(x => x.uf === eu.uf && x.resultado === 'selecionada' && x.situacao === 'aprovada');
  return { T, MQ, S, R, eu, f };
}
test('etapas na demonstração: implantação só com plano aprovado e com água; acompanhamento só depois da implantação feita', async () => {
  const { T, R, eu, f } = await campoPI(); const hoje = R.hoje();
  const vd = { id: 'vd1', ficha_id: f.id, uf: eu.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: hoje, data_realizada: diaMais(-2), situacao: 'realizada' };
  const dg = o => Object.assign({ id: 'dg1', ficha_id: f.id, visita_id: 'vd1', uf: eu.uf, data_visita: diaMais(-2), situacao: 'enviado', sem_agua: false, dados: {} }, o);
  const imp = { id: 'vi1', ficha_id: f.id, etapa: 'implantacao', executor_id: eu.id, data_prevista: diaMais(3), situacao: 'prevista' };
  await editarDemo(T, d => { d.visitas = [vd]; d.diagnosticos = [dg()]; });
  await T.trocar('coord_tecnico');
  await assert.rejects(() => T.api.salvarVisita(imp), /O plano deste quintal ainda não foi aprovado/);
  await editarDemo(T, d => { d.diagnosticos = [dg({ sem_agua: true, situacao: 'aprovado' })]; });
  await assert.rejects(() => T.api.salvarVisita(imp), /sem água/i);
  await editarDemo(T, d => { d.diagnosticos = [dg({ situacao: 'aprovado' })]; });
  await T.api.salvarVisita(imp);   // com o plano aprovado, agenda
  const ac = { id: 'va1', ficha_id: f.id, etapa: 'acompanhamento', executor_id: eu.id, data_prevista: diaMais(10), situacao: 'prevista' };
  await assert.rejects(() => T.api.salvarVisita(ac), /acompanhamento é feito depois da implantação/);
  const rel = 'Implantamos os canteiros e montamos o gotejamento.';
  await assert.rejects(() => T.api.salvarVisita(Object.assign({}, imp, { situacao: 'realizada', data_realizada: diaMais(-3), relato: rel })), /não pode ter data anterior à do diagnóstico/);
  await T.api.salvarVisita(Object.assign({}, imp, { situacao: 'realizada', data_realizada: diaMais(-1), relato: rel }));
  await T.api.salvarVisita(ac);   // agora o acompanhamento entra
});
test('etapas: registro antigo (implantação agendada sem plano aprovado) continua podendo mudar de data e ser cancelado', async () => {
  const { T, eu, f } = await campoPI();
  await editarDemo(T, d => { d.diagnosticos = [];
    d.visitas = [{ id: 'vant', ficha_id: f.id, uf: eu.uf, etapa: 'implantacao', executor_id: eu.id, data_prevista: diaMais(2), situacao: 'prevista' }]; });
  await T.trocar('coord_tecnico');
  const v = lerDemo(T).visitas[0];
  await T.api.salvarVisita(Object.assign({}, v, { data_prevista: diaMais(9) }));
  assert.equal(lerDemo(T).visitas[0].data_prevista, diaMais(9));
  await assert.rejects(() => T.api.salvarVisita(Object.assign({}, v, { data_prevista: diaMais(9), situacao: 'realizada', data_realizada: diaMais(0), relato: 'Implantamos os canteiros e o gotejamento.' })), /plano deste quintal/,
    'marcar como feita é que exige o plano');
  await T.api.salvarVisita(Object.assign({}, v, { data_prevista: diaMais(9), situacao: 'cancelada' }));
  assert.equal(lerDemo(T).visitas[0].situacao, 'cancelada');
});
test('etapas na tela: no lugar de "Registrar visita feita" aparece o motivo; com o plano aprovado, volta o botão', async () => {
  const { T, R, eu, f } = await campoPI();
  const dg = sit => ({ id: 'dg1', ficha_id: f.id, visita_id: 'vd1', uf: eu.uf, data_visita: diaMais(-2), situacao: sit, sem_agua: false, dados: {} });
  const monta = sit => editarDemo(T, d => { d.diagnosticos = [dg(sit)];
    d.visitas = [{ id: 'vd1', ficha_id: f.id, uf: eu.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: diaMais(-2), data_realizada: diaMais(-2), situacao: 'realizada' },
      { id: 'vi1', ficha_id: f.id, uf: eu.uf, etapa: 'implantacao', executor_id: eu.id, data_prevista: R.hoje(), situacao: 'prevista' }]; });
  await monta('enviado'); await T.trocar('bolsista');
  let h = T.aba();
  assert.ok(h.includes('data-etapa-trava'), 'mostra a trava'); assert.ok(texto(h).includes('O plano deste quintal ainda não foi aprovado'));
  assert.ok(!/data-acao="campo-feita" data-id="vi1"/.test(h), 'não oferece o botão');
  await monta('aprovado'); await T.trocar('bolsista'); h = T.aba();
  assert.ok(/data-acao="campo-feita" data-id="vi1"/.test(h), 'com o plano aprovado, oferece');
});

/* ---------- 2. pedido complementar de ajuda de custo ---------- */
async function comVisitasFeitas() {
  const T = await montar('bolsista'); const { MQ, S } = T; const hoje = MQ.regras.hoje(); const eu = S.eu;
  await editarDemo(T, d => { const f = d.fichas.find(x => x.uf === eu.uf && x.resultado === 'selecionada' && x.situacao === 'aprovada');
    d.visitas = ['c1', 'c2', 'c3'].map(id => ({ id, ficha_id: f.id, uf: eu.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: hoje, data_realizada: hoje, situacao: 'realizada' }));
    d.solicitacoes = []; d.solic_visitas = {}; d.equipe.find(m => m.id === eu.id).data_inicio = hoje.slice(0, 8) + '01'; });
  await T.trocar('bolsista');
  return { T, MQ, S, hoje, eu };
}
test('ajuda de custo: segundo pedido no mês entra como complementar; a mesma visita não entra em dois; a bolsa continua uma por mês', async () => {
  const { T, hoje } = await comVisitasFeitas();
  const p1 = await T.api.solicitarPagamento('ajuda_custo', hoje, 100, null, ['c1'], { total: 100, complementar: true });
  const p2 = await T.api.solicitarPagamento('ajuda_custo', hoje, 80, null, ['c2'], { total: 80 });
  const sol = id => lerDemo(T).solicitacoes.find(s => s.id === id);
  assert.notEqual(p1, p2);
  assert.ok(!sol(p1).detalhe.complementar, 'o primeiro pedido não é complementar, mesmo que a tela mande a marca');
  assert.equal(sol(p2).detalhe.complementar, true, 'o segundo é');
  await assert.rejects(() => T.api.solicitarPagamento('ajuda_custo', hoje, 50, null, ['c1'], { total: 50 }), /já foi solicitada/);
  await assert.rejects(() => T.api.solicitarPagamento('ajuda_custo', hoje, 50, null, ['c3', 'c3'], { total: 50 }), /mesma visita apareceu duas vezes/);
  await assert.rejects(() => T.api.solicitarPagamento('ajuda_custo', hoje, 150, null, ['c3'], { total: 100 }), /passa do total das visitas detalhadas/);
  const rel = 'Mobilizei três comunidades, acompanhei visitas e organizei as listas de presença do mês.';
  await T.api.solicitarPagamento('bolsa', hoje, 2200, rel, [], {});
  await assert.rejects(() => T.api.solicitarPagamento('bolsa', hoje, 2200, rel, [], {}), /Você já solicitou este mês/);
});
test('ajuda de custo: o complementar devolvido volta como o mesmo pedido e continua complementar', async () => {
  const { T, hoje } = await comVisitasFeitas();
  await T.api.solicitarPagamento('ajuda_custo', hoje, 100, null, ['c1'], { total: 100 });
  const p2 = await T.api.solicitarPagamento('ajuda_custo', hoje, 80, null, ['c2'], { total: 80 });
  await T.trocar('coord_tecnico'); await T.api.avalizarPagamento(p2, false, 'Falta a foto da visita.');
  await T.trocar('bolsista');
  const de_novo = await T.api.solicitarPagamento('ajuda_custo', hoje, 160, null, ['c2', 'c3'], { total: 160 });
  assert.equal(de_novo, p2, 'corrige o devolvido, não cria outro');
  const s = lerDemo(T).solicitacoes.find(x => x.id === p2);
  assert.equal(s.situacao, 'solicitada'); assert.equal(s.detalhe.complementar, true);
  assert.equal(lerDemo(T).solicitacoes.filter(x => x.tipo === 'ajuda_custo').length, 2);
});
test('ajuda de custo na tela: aviso "Pedido complementar", botão próprio e a palavra "complementar" nas listas', async () => {
  const { T, hoje, MQ } = await comVisitasFeitas();
  const mes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+hoje.slice(5, 7) - 1] + '/' + hoje.slice(0, 4);
  await T.api.solicitarPagamento('ajuda_custo', hoje, 100, null, ['c1'], { total: 100 });
  await T.trocar('bolsista'); if (MQ.custosUI) await MQ.custosUI.garantir();
  let h = T.aba(); let t = texto(h);
  assert.ok(t.includes(`Pedido complementar: 2 visitas de ${mes} que ficaram fora do pedido anterior.`), t.slice(t.indexOf('Ajuda de custo'), t.indexOf('Ajuda de custo') + 400));
  assert.ok(/Solicitar pedido complementar R\$/.test(t)); assert.ok(/data-form="pag-ajuda"[^>]*data-complementar="1"/.test(h));
  await T.api.solicitarPagamento('ajuda_custo', hoje, 80, null, ['c2'], { total: 80 });
  await T.trocar('bolsista'); t = texto(T.aba());
  assert.ok(t.includes(`Pedido complementar: 1 visita de ${mes} que ficou fora do pedido anterior.`));
  assert.ok(t.includes(`Ajuda de custo (complementar) de ${mes}`), 'rótulo na lista "Minhas solicitações"');
  await T.trocar('coord_tecnico'); t = texto(T.aba('pagamentos'));
  assert.ok(t.includes(`Ajuda de custo (complementar) de ${mes}`), 'rótulo na lista da coordenação');
  assert.ok(t.includes(`Ajuda de custo de ${mes}`), 'o primeiro pedido segue sem o rótulo');
});
test('ajuda de custo na tela: sem visita de fora, o mês com pedido não oferece novo pedido; visita de mês anterior fora do pedido é avisada', async () => {
  const { T, hoje, MQ, eu } = await comVisitasFeitas();
  await T.api.solicitarPagamento('ajuda_custo', hoje, 300, null, ['c1', 'c2', 'c3'], { total: 300 });
  const antes = MQ.regras.somaDias(hoje.slice(0, 8) + '01', -3);
  await editarDemo(T, d => { d.visitas.push(Object.assign({}, d.visitas[0], { id: 'cant', data_prevista: antes, data_realizada: antes }));
    d.equipe.find(m => m.id === eu.id).data_inicio = antes.slice(0, 8) + '01'; });
  await T.trocar('bolsista'); if (MQ.custosUI) await MQ.custosUI.garantir();
  const h = T.aba(); const t = texto(h);
  assert.ok(!h.includes('data-form="pag-ajuda"'), 'sem visita livre no mês: só o resumo do pedido');
  assert.ok(/1 visita de \w{3}\/\d{4} ficou fora do pedido/.test(t), 'aviso do mês anterior');
  assert.ok(new RegExp(`data-acao="pag-mes-ir" data-mes="${antes.slice(0, 7)}"`).test(h));
});

/* ---------- 3. passagens: um teto por finalidade ---------- */
const pass = (v, fin) => ({ valor_estimado: v, finalidade: fin, origem: 'Teresina/PI', destino: 'Salvador/BA', volta: diaMais(65), bagagem: 'mao',
  passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] });
test('passagem de acompanhamento pedagógico: a técnica não confere; a geral confere e autoriza; teto próprio de R$ 22.400', async () => {
  const t = await montar('bolsista');
  const id = await t.api.salvarPedido(null, 'passagem', 'Acompanhamento da turma do FIC', diaMais(60), pass(22000, 'pedagogico'));
  await t.trocar('coord_tecnico');
  await assert.rejects(t.api.moverPedido(id, 'conferir'), /acompanhamento pedagógico: só a coordenação geral confere/);
  await assert.rejects(t.api.moverPedido(id, 'devolver', 'corrigir a data'), /só a coordenação geral confere/);
  const h = t.painel({ tipo: 'viag-ver', id });
  assert.ok(h.includes('data-viag-pedag') && texto(h).includes('aguardando a coordenação geral'), 'a técnica vê "aguardando a coordenação geral"');
  assert.ok(!/name="acao" value="conferir"/.test(h), 'sem botão de conferir');
  assert.ok(texto(t.aba('viagens')).includes('Com a coordenação geral'), 'na lista, o pedido aparece com a coordenação geral');
  await t.trocar('coord_geral');
  assert.ok(/name="acao" value="conferir"/.test(t.painel({ tipo: 'viag-ver', id })), 'a geral tem o botão de conferir');
  await t.api.moverPedido(id, 'conferir'); await t.api.moverPedido(id, 'autorizar');
  let sd = await t.api.saldoPedidos();
  assert.equal(sd.passagem_pedagogico_usado, 22000); assert.equal(sd.passagem_pedagogico_saldo, 400); assert.equal(sd.passagem_usado, 0); assert.equal(sd.passagem_saldo, 70000);
  await t.trocar('bolsista');
  const id3 = await t.api.salvarPedido(null, 'passagem', 'Outro acompanhamento', diaMais(61), pass(500, 'pedagogico'));
  await t.trocar('coord_geral'); await t.api.moverPedido(id3, 'conferir');
  await assert.rejects(t.api.moverPedido(id3, 'autorizar'), /Passa do teto de passagens de acompanhamento pedagógico \(R\$ 22\.400,00\)/);
  await t.trocar('bolsista');
  // o intercâmbio tem o teto dele: o pedagógico cheio não atrapalha
  const id2 = await t.api.salvarPedido(null, 'passagem', 'Intercâmbio entre territórios', diaMais(62), pass(30000, 'intercambio'));
  await t.trocar('coord_tecnico'); await t.api.moverPedido(id2, 'conferir');
  await t.trocar('coord_geral'); await t.api.moverPedido(id2, 'autorizar');
  sd = await t.api.saldoPedidos(); assert.equal(sd.passagem_usado, 30000); assert.equal(sd.passagem_pedagogico_usado, 22000);
});
test('passagens na tela: dois saldos no formulário e na aba; passagem antiga sem finalidade conta no intercâmbio; a Execução não estoura à toa', async () => {
  const t = await montar('coord_geral');
  await editarDemo(t, d => { const base = { tipo: 'passagem', uf: 'PI', situacao: 'autorizado', solicitante_id: d.equipe.find(m => m.papel === 'articulacao' && m.uf === 'PI').id, titulo: 'Passagem de teste',
      data_ref: diaMais(60), enviado_em: new Date().toISOString(), decidido_em: new Date().toISOString() };
    d.pedidos = [Object.assign({ id: 'pa1', valor_autorizado: 5000, dados: { passageiros: [] } }, base),                         // antiga: sem finalidade
      Object.assign({ id: 'pa2', valor_autorizado: 3000, dados: { finalidade: 'pedagogico', passageiros: [] } }, base),
      Object.assign({ id: 'pa3', valor_autorizado: 7000, dados: { finalidade: 'intercambio', passageiros: [] } }, base)]; });
  await t.trocar('coord_geral');
  const sd = await t.api.saldoPedidos(); assert.equal(sd.passagem_usado, 12000); assert.equal(sd.passagem_pedagogico_usado, 3000);
  const h = t.aba('viagens'); const i = h.indexOf('id="viag-passagens"'); const P = texto(h.slice(i, h.indexOf('</section>', i)));
  assert.ok(/Autorizado em passagens de intercâmbio\s*R\$\s?12\.000,00 de R\$\s?70\.000,00/.test(P), P.slice(0, 600));
  assert.ok(/Autorizado em passagens de acompanhamento pedagógico\s*R\$\s?3\.000,00 de R\$\s?22\.400,00/.test(P));
  assert.ok(/R\$\s?15\.000,00\s*gasto com passagens/.test(texto(h)), 'o resumo soma as duas finalidades');
  // Execução: o comprometido de cada item usa a mesma divisão (a antiga, sem finalidade, no intercâmbio)
  const N = t.MQ.execUI && t.MQ.execUI.numeros ? t.MQ.execUI.numeros() : null;
  if (N) { assert.equal(N.porItem.passagem_intercambio.comp, 12000); assert.equal(N.porItem.passagem_pedagogico.comp, 3000);
    assert.ok(!N.porItem.passagem_pedagogico.passou && !N.porItem.passagem_intercambio.passou); }
  await t.trocar('bolsista');
  const f = texto(t.painel({ tipo: 'viag-nova', t: 'passagem' }));
  assert.ok(/Teto de passagens de intercâmbio: R\$\s?70\.000,00 · já autorizado R\$\s?12\.000,00 · saldo R\$\s?58\.000,00/.test(f), f.slice(f.indexOf('Teto'), f.indexOf('Teto') + 300));
  assert.ok(/Teto de passagens de acompanhamento pedagógico: R\$\s?22\.400,00 · já autorizado R\$\s?3\.000,00 · saldo R\$\s?19\.400,00/.test(f));
});
test('passagem antiga (sem finalidade) continua podendo ser conferida, autorizada e cancelada', async () => {
  const t = await montar('coord_tecnico');
  await editarDemo(t, d => { const sol = d.equipe.find(m => m.papel === 'articulacao' && m.uf === 'PI').id;
    d.pedidos = ['po1', 'po2'].map(id => ({ id, tipo: 'passagem', uf: 'PI', situacao: 'enviado', solicitante_id: sol, titulo: 'Pedido antigo', data_ref: diaMais(60), enviado_em: new Date().toISOString(), dados: { valor_estimado: 1500, passageiros: [] } })); });
  await t.trocar('coord_tecnico'); await t.api.moverPedido('po1', 'conferir');
  await t.trocar('coord_geral'); await t.api.moverPedido('po1', 'autorizar');
  assert.equal((await t.api.saldoPedidos()).passagem_usado, 1500);
  await t.trocar('bolsista'); await t.api.moverPedido('po2', 'cancelar');
  assert.equal(lerDemo(t).pedidos.find(p => p.id === 'po2').situacao, 'cancelado');
});

/* ---------- 4. bolsa da coordenação geral e textos da demonstração ---------- */
test('bolsa da coordenação geral: R$ 5.000 por mês × 14 meses = R$ 70.000 (igual ao orçamento); os outros perfis batem com a conta do orçamento', () => {
  const { MQ } = carregar(['dados.js']);
  assert.equal(MQ.PAPEIS.coord_geral.bolsa, 5000);
  const itens = MQ.ORCAMENTO.rubricas.flatMap(r => r.itens);
  const cg = itens.find(i => i.id === 'bolsa_coord_geral'); assert.equal(cg.total, 70000); assert.match(cg.calc, /14 meses × R\$ 5\.000/); assert.equal(14 * MQ.PAPEIS.coord_geral.bolsa, cg.total);
  // valor mensal do perfil × pessoas × meses do "calc" = total do item
  for (const [id, papel] of [['bolsa_coord_tecnico', 'coord_tecnico'], ['bolsa_articulacao', 'articulacao'], ['bolsa_apoio', 'apoio'], ['bolsa_professor', 'professor_fic'], ['bolsa_auxiliar', 'auxiliar_adm']]) {
    const it = itens.find(i => i.id === id); const m = /^(\d+) × (\d+) meses × R\$ ([\d.]+)/.exec(it.calc); assert.ok(m, id + ': ' + it.calc);
    assert.equal(+m[3].replace(/\./g, ''), Math.round(MQ.PAPEIS[papel].bolsa), id + ': valor mensal'); assert.equal(+m[1] * +m[2] * MQ.PAPEIS[papel].bolsa, it.total, id + ': total');
  }
  assert.equal(MQ.TETOS.passagem, itens.find(i => i.id === 'passagem_intercambio').total);
  assert.equal(MQ.TETOS.passagem_pedagogico, itens.find(i => i.id === 'passagem_pedagogico').total);
});
test('demonstração: "Primeiro acesso" explica que não há senha (antes: "is not a function"); o texto do aval fala em R$ 2.000 por visita', async () => {
  const T = await montar('coord_tecnico');
  assert.equal(typeof T.api.criarSenha, 'function');
  await assert.rejects(() => T.api.criarSenha('a@b.com', 'Senha#2026', 'ABCD1234'), /Na demonstração não há primeiro acesso nem senha/);
  const src = fonte('api-demo.js');
  assert.ok(!/até R\$ 600,00 por visita/.test(src), 'o texto antigo (R$ 600) saiu'); assert.ok(/até R\$ 2\.000,00 por visita/.test(src));
});

/* ---------- travas do banco que a demonstração e a tela antecipam ---------- */
test('aprovar o que foi lido: ficha ou diagnóstico alterado depois da leitura não é aprovado (marca "atualizado_em")', async () => {
  const T = await montar('coord_tecnico');
  const f = T.S.fichas.find(x => x.situacao === 'aguardando' && x.uf === 'PI'); assert.ok(f, 'há ficha aguardando no exemplo');
  await assert.rejects(() => T.api.decidirFicha(f.id, 'aprovada', null, '2020-01-01T00:00:00.000Z'), /foi alterado enquanto você lia/);
  await T.api.decidirFicha(f.id, 'devolvida', 'Falta a foto do termo.', '2020-01-01T00:00:00.000Z');   // devolver não depende da marca
  // modo produção: a aprovação manda a marca lida; devolver não manda
  const src = fonte('api-supabase.js');
  assert.match(src, /if \(situacao === 'aprovada' && m\) muda\.atualizado_em = m;/); assert.match(src, /if \(situacao === 'aprovado' && m\) muda\.atualizado_em = m;/);
  assert.match(src, /marcas\.fichas\[f\.id\] = f\.atualizado_em/); assert.match(src, /marcas\.diagnosticos\[d\.id\] = d\.atualizado_em/);
  assert.match(fonte('campo.js'), /decidirDiagnostico\(form\.dataset\.id, dec, obs, form\.dataset\.marca \|\| undefined\)/);
});
test('km de visita já paga (pedido lançado no Arlo) não muda nem se apaga; a tela trava o campo', async () => {
  const { T, hoje } = await comVisitasFeitas();
  const p = await T.api.solicitarPagamento('ajuda_custo', hoje, 100, null, ['c1'], { total: 100 });
  await T.trocar('coord_tecnico'); await T.api.salvarKm('c1', 40); await T.api.salvarKm('c2', 12);
  await editarDemo(T, d => { Object.assign(d.solicitacoes.find(s => s.id === p), { situacao: 'lancada', valor_avalizado: 100, arlo_em: new Date().toISOString() }); });
  await T.trocar('coord_tecnico');
  await assert.rejects(() => T.api.salvarKm('c1', 55), /já está num pedido lançado no Arlo/);
  await assert.rejects(() => T.api.salvarKm('c1', null), /já foi paga/);
  await T.api.salvarKm('c1', 40);    // o mesmo valor não é mudança
  await T.api.salvarKm('c2', 20);    // visita que não foi paga continua livre
  await T.api.salvarKm('c2', null);
  if (T.MQ.custosUI) { await T.MQ.custosUI.garantir(); const h = T.aba('custos');
    const campo = id => (new RegExp(`<input[^>]*data-km="${id}"[^>]*>`).exec(h) || [''])[0];
    if (campo('c1')) { assert.ok(/disabled/.test(campo('c1')), 'km da visita paga travado'); assert.ok(campo('c2') && !/disabled/.test(campo('c2')), 'km da visita não paga livre'); } }
});
test('curso FIC: a turma é de quem dá a aula (o colega não altera); mesmo encontro duas vezes e mais de 12 horas no dia são recusados', async () => {
  const T = await montar('professor'); const eu = T.S.eu; const hoje = T.MQ.regras.hoje();
  let outro;
  await editarDemo(T, d => { outro = d.equipe.find(m => m.papel === 'professor_fic' && m.status === 'ativa' && m.id !== eu.id);
    d.turmas = [{ id: 'tm', nome: 'Turma minha', professor_id: eu.id, inicio: diaMais(-20) }].concat(outro ? [{ id: 'to', nome: 'Turma do colega', professor_id: outro.id, inicio: diaMais(-20) }] : []);
    d.ficEncontros = []; d.ficPresencas = []; d.matriculas = []; });
  await T.trocar('professor');
  if (outro) {
    await assert.rejects(() => T.api.salvarTurma({ id: 'to', nome: 'Turma renomeada', professor_id: outro.id }), /outro\(a\) professor\(a\)/);
    const h = T.aba();
    assert.ok(!/data-acao="fic-turma-editar" data-id="to"/.test(h), 'sem "Editar" na turma do colega'); assert.ok(/data-acao="fic-matricular" data-id="to"/.test(h), 'mas matricula nela');
    assert.ok(/data-acao="fic-turma-editar" data-id="tm"/.test(h), 'na própria turma, edita');
  }
  await T.api.salvarTurma({ id: 'tm', nome: 'Turma minha, renomeada', professor_id: eu.id, inicio: diaMais(-20) });
  const enc = o => Object.assign({ id: null, turma_id: 'tm', data: hoje, carga_horaria: 4, modalidade: 'presencial', conteudo: 'Planejamento do quintal produtivo', presentes: [] }, o);
  await T.api.salvarEncontroFic(enc());
  await assert.rejects(() => T.api.salvarEncontroFic(enc({ conteudo: 'A mesma aula, enviada de novo' })), /já tem encontro registrado neste dia nesta modalidade/);
  await assert.rejects(() => T.api.salvarEncontroFic(enc({ modalidade: 'online', carga_horaria: 9, conteudo: 'Aula longa pela internet' })), /12 horas/);
  await T.api.salvarEncontroFic(enc({ modalidade: 'online', carga_horaria: 8, conteudo: 'Aula pela internet no mesmo dia' }));   // 4 + 8 = 12: cabe
});
test('valores da ajuda de custo: número inválido é recusado ao salvar (como no banco)', async () => {
  const T = await montar('coord_geral'); const ok = Object.assign({}, T.MQ.CUSTO_PADRAO);
  await assert.rejects(() => T.api.salvarParametros('custo_visita', Object.assign({}, ok, { km_por_litro: 0 })), /maior que zero/);
  await assert.rejects(() => T.api.salvarParametros('custo_visita', Object.assign({}, ok, { valor_hora: -1 })), /não pode ser negativo/);
  await assert.rejects(() => T.api.salvarParametros('custo_visita', Object.assign({}, ok, { refeicao: 'trinta' })), /precisa ser um número/);
  await assert.rejects(() => T.api.salvarParametros('custo_visita', 'texto'), /formato que o sistema não entende/);
  await T.api.salvarParametros('custo_visita', ok);
});
