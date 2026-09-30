/* 30/09/2026: aba Execução financeira (só a coordenação geral): previsto da planilha atualizada × executado e comprometido. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { diaMais } = require('./ambiente');

test('orçamento: R$ 2 milhões, rubricas da planilha atualizada, códigos válidos para o banco', async () => {
  const t = await montar('coord_geral'); const O = t.MQ.ORCAMENTO;
  const soma = O.rubricas.flatMap(r => r.itens).reduce((s, i) => s + i.total, 0);
  assert.equal(soma, 2000000); assert.equal(O.total, 2000000);
  const rub = Object.fromEntries(O.rubricas.map(r => [r.nome, r.itens.reduce((s, i) => s + i.total, 0)]));
  assert.equal(rub['Auxílio financeiro a pesquisador (bolsas)'], 163600); assert.equal(rub['Auxílio financeiro a estudantes (bolsas)'], 284400);
  assert.equal(rub['Ajuda de custo (pessoa física)'], 191250); assert.equal(rub['Passagens e locomoção'], 102200);
  assert.equal(rub['Serviços de terceiros (pessoa jurídica)'], 1030000); assert.equal(rub['Material de consumo'], 7350);
  for (const i of O.rubricas.flatMap(r => r.itens)) assert.match(i.id, /^[a-z0-9_]{2,40}$/);
});

test('só a coordenação geral tem a aba; os outros perfis não', async () => {
  const g = await montar('coord_geral'); assert.ok(texto(g.aba('execucao')).includes('Execução do orçamento'));
  for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    const t = await montar(p); const h = t.aba('execucao');
    assert.ok(!h.includes('Execução do orçamento'), p); assert.ok(!/data-aba="execucao"/.test(h), p);
    assert.equal((await t.api.listarLancamentos()).length, 0, p + ' não lê lançamentos');
    await assert.rejects(t.api.lancarExecucao({ tipo: 'despesa', item: 'quintais', valor: 10, data: '2026-09-30' }), /coordenação geral/, p);
  }
});

test('lançamento manual entra no item; repasse entra no recebido; estorno anula e não se repete', async () => {
  const t = await montar('coord_geral');
  await t.api.lancarExecucao({ tipo: 'repasse', item: 'repasse_mda', valor: 1000000, data: '2026-09-01', documento: '2026NC000014' });
  const x = await t.api.lancarExecucao({ tipo: 'despesa', item: 'quintais', valor: 200000, data: t.MQ.regras.hoje(), documento: 'NF 1' });
  await t.trocar('coord_geral');
  let n = t.MQ.execUI.numeros();
  assert.equal(n.porItem.quintais.exec, 200000); assert.equal(n.recebido, 1000000); assert.equal(n.caixa, 800000);
  await assert.rejects(t.api.estornarLancamento(x.id, 'curto'), /motivo/);
  await t.api.estornarLancamento(x.id, 'Nota fiscal lançada em duplicidade');
  await assert.rejects(t.api.estornarLancamento(x.id, 'Tentando estornar de novo'), /já foi estornado/);
  await t.trocar('coord_geral'); n = t.MQ.execUI.numeros();
  assert.equal(n.porItem.quintais.exec, 0, 'estorno zera'); assert.equal((await t.api.listarLancamentos()).length, 3, 'nada some: original + estorno + repasse');
  const h = texto(t.aba('execucao')); assert.ok(h.includes('estornado') && h.includes('Nota fiscal lançada em duplicidade'));
});

test('validação: futuro, valor zero, item automático e item inventado são recusados', async () => {
  const t = await montar('coord_geral'); const v = t.MQ.execUI.validar; const hoje = t.MQ.regras.hoje();
  assert.ok(v({ tipo: 'despesa', item: 'quintais', valor: 10, data: diaMais(3) }).data);
  assert.ok(v({ tipo: 'despesa', item: 'quintais', valor: 0, data: hoje }).valor);
  assert.ok(v({ tipo: 'despesa', item: 'bolsa_articulacao', valor: 10, data: hoje }).item, 'bolsa entra sozinha, não se lança à mão');
  assert.ok(v({ tipo: 'despesa', item: 'x<b>', valor: 10, data: hoje }).item);
  assert.equal(Object.keys(v({ tipo: 'despesa', item: 'diarias', valor: 400, data: hoje })).length, 0);
  assert.equal(t.MQ.execUI.valorBR('1.234,56'), 1234.56); assert.equal(t.MQ.execUI.valorBR('R$ 200.000,00'), 200000);
});

test('automático: passagem e evento autorizados entram como comprometido no item certo, separados', async () => {
  const t = await montar('coord_geral'); const hj = diaMais(60);
  const pas = { valor_estimado: 3000, finalidade: 'intercambio', passageiros: [{ nome: 'Maria', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
  await t.trocar('bolsista'); const a = await t.api.salvarPedido(null, 'passagem', 'Intercâmbio', hj, pas); const e = await t.api.salvarPedido(null, 'evento', 'Encontro', hj, { valor_estimado: 5000, local: 'Sede' });
  await t.trocar('coord_tecnico'); await t.api.moverPedido(a, 'conferir'); await t.api.moverPedido(e, 'conferir');
  await t.trocar('coord_geral'); await t.api.moverPedido(a, 'autorizar'); await t.api.moverPedido(e, 'autorizar'); await t.trocar('coord_geral');
  const n = t.MQ.execUI.numeros();
  assert.equal(n.porItem.passagem_intercambio.comp, 3000); assert.equal(n.porItem.passagem_pedagogico.comp, 0);
  assert.equal(n.porItem.eventos.comp, 5000); assert.equal(n.porItem.passagem_intercambio.exec, 0, 'autorizado não é pago');
});

test('alerta: item que passa do previsto aparece em destaque', async () => {
  const t = await montar('coord_geral');
  await t.api.lancarExecucao({ tipo: 'despesa', item: 'equipamento', valor: 12000, data: t.MQ.regras.hoje() }); await t.trocar('coord_geral');
  const h = t.aba('execucao'); assert.match(texto(h), /Dispositivo eletrônico \(notebook\)\s*: executado \+ comprometido \(R\$\s?12\.000,00\) passa do previsto/);
  assert.ok(/<tr class="passou">/.test(h));
  assert.match(texto(h), /Tempo de vigência decorrido: \d+(,\d)?%/, 'porcentagem com vírgula');
  assert.ok(!/\d\.\d%/.test(texto(h)), 'nenhuma porcentagem com ponto');
});

test('gráficos: ritmo acumulado (13 meses, previsto termina em R$ 2 mi) e uma barra por rubrica, com dica e clique', async () => {
  const t = await montar('coord_geral');
  await t.api.lancarExecucao({ tipo: 'repasse', item: 'repasse_mda', valor: 1000000, data: '2026-09-01' });
  await t.api.lancarExecucao({ tipo: 'despesa', item: 'doa', valor: 100000, data: t.MQ.regras.hoje() }); await t.trocar('coord_geral');
  const sr = t.MQ.execUI.serie();
  assert.equal(sr.meses.length, 13); assert.equal(sr.meses[0], '2026-09'); assert.equal(sr.meses[12], '2027-09');
  assert.ok(Math.abs(sr.previsto[12] - 2000000) < 0.01, 'previsto acumulado fecha em R$ 2 milhões');
  for (let i = 1; i < 13; i++) assert.ok(sr.previsto[i] >= sr.previsto[i - 1], 'acumulado não desce');
  const i = sr.idxHoje; assert.ok(i >= 0); assert.ok(sr.executado[i] >= 100000); assert.equal(sr.recebido[i], 1000000);
  if (i < 12) assert.equal(sr.executado[i + 1], null, 'futuro fica em branco');
  const h = t.aba('execucao');
  assert.equal((h.match(/data-exg="/g) || []).length, 13, 'um alvo de toque por mês');
  assert.equal((h.match(/class="eg-bar[" ]/g) || []).length, t.MQ.ORCAMENTO.rubricas.length, 'uma barra por rubrica');
  assert.ok(/data-acao="exec-rub" data-id="r13"/.test(h) && /<tbody id="exr-r13">/.test(h), 'clique leva à rubrica na tabela');
  assert.match(h, /Tempo decorrido \(\d+(,\d)?%\)/);
});
