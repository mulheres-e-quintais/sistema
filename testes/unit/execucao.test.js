/* 30/09/2026: aba Execução (só a coordenação geral): previsto da planilha atualizada × executado da PLANILHA DE GASTOS
   mais recente (retrato completo, a mais nova vale) + comprometido do que o sistema sabe depois da data da planilha. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { montar, texto } = require('./telas');
const { diaMais } = require('./ambiente');
const arquivo = nome => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', nome)); return { name: nome, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
async function enviarFixture(t, nome, pos) {
  const pr = await t.MQ.execUI.preparar(arquivo(nome));
  await t.api.enviarPlanilhaExec({ posicao_em: pos || pr.posicao, arquivo_nome: pr.nome, linhas: pr.linhas, total_gasto: pr.resumo.gasto, total_recebido: pr.resumo.recebido, nao_classificadas: pr.resumo.naoClassificadas.length }, null);
  await t.trocar('coord_geral'); return pr;
}

test('orçamento: R$ 2 milhões, rubricas da planilha atualizada, códigos válidos', async () => {
  const t = await montar('coord_geral'); const O = t.MQ.ORCAMENTO;
  assert.equal(O.rubricas.flatMap(r => r.itens).reduce((s, i) => s + i.total, 0), 2000000);
  const rub = Object.fromEntries(O.rubricas.map(r => [r.nome, r.itens.reduce((s, i) => s + i.total, 0)]));
  assert.equal(rub['Auxílio financeiro a pesquisador (bolsas)'], 163600); assert.equal(rub['Auxílio financeiro a estudantes (bolsas)'], 284400);
  assert.equal(rub['Ajuda de custo (pessoa física)'], 191250); assert.equal(rub['Passagens e locomoção'], 102200);
  assert.equal(rub['Serviços de terceiros (pessoa jurídica)'], 1030000); assert.equal(rub['Material de consumo'], 7350);
});

test('só a coordenação geral tem a aba, lê e envia planilhas', async () => {
  const g = await montar('coord_geral'); assert.ok(texto(g.aba('execucao')).includes('Execução do orçamento'));
  for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    const t = await montar(p); const h = t.aba('execucao');
    assert.ok(!h.includes('Execução do orçamento'), p); assert.ok(!/data-aba="execucao"/.test(h), p);
    assert.equal((await t.api.listarPlanilhasExec()).length, 0, p);
    await assert.rejects(t.api.enviarPlanilhaExec({ posicao_em: '2026-09-01', linhas: [{ valor: 1 }] }, null), /coordenação geral/, p);
  }
});

test('sem planilha: executado zerado e aviso para enviar; não há lançamento à mão', async () => {
  const t = await montar('coord_geral'); const h = texto(t.aba('execucao'));
  assert.equal(t.MQ.execUI.numeros().exec, 0);
  assert.match(h, /Nenhuma planilha de gastos enviada ainda/); assert.ok(h.includes('Enviar planilha de gastos') && !h.includes('Baixar o modelo'));
  assert.ok(!/Lançar despesa/.test(h), 'lançamento à mão saiu');
});

test('planilha do modelo: executado por item, recebido do MDA, caixa; tabela e histórico', async () => {
  const t = await montar('coord_geral'); await enviarFixture(t, 'modelo_preenchido.xlsx');
  const n = t.MQ.execUI.numeros();
  assert.equal(n.porItem.doa.exec, 100000); assert.equal(n.porItem.diarias.exec, 800); assert.equal(n.porItem.bolsa_articulacao.exec, 11000);
  assert.equal(n.exec, 111800); assert.equal(n.recebido, 1000000); assert.equal(n.caixa, 888200);
  const h = texto(t.aba('execucao')); assert.match(h, /Planilha vigente:\s*modelo_preenchido\.xlsx\s*, gastos até 25\/09\/2026/); assert.match(h, /Planilhas enviadas\s*1/);
});

test('a mais nova substitui (não soma); a anterior fica no histórico como substituída', async () => {
  const t = await montar('coord_geral'); await enviarFixture(t, 'modelo_preenchido.xlsx', '2026-09-25'); await enviarFixture(t, 'funcern_baguncado.xlsx', '2026-09-28');
  const n = t.MQ.execUI.numeros();
  assert.equal(n.pl.arquivo_nome, 'funcern_baguncado.xlsx'); assert.equal(n.porItem.doa.exec, 0, 'a DOA da planilha antiga não soma');
  assert.equal(n.porItem.quintais.exec, 200000); assert.equal(n.naoClass, -1200, 'linha fora do orçamento aparece à parte');
  assert.equal(n.rub.find(x => x.r.id === 'r6').semItem, 2800, 'rubrica sem item definido');
  const h = t.aba('execucao'); assert.equal((h.match(/chip ok">vigente/g) || []).length, 1); assert.equal((h.match(/>substituída</g) || []).length, 1);
  assert.match(texto(h), /Fora do orçamento \(não classificado\)/); assert.match(texto(h), /linha.? fora do orçamento/);
});

test('comprometido: só o que o sistema autorizou depois da data da planilha (evita contar duas vezes)', async () => {
  const t = await montar('coord_geral'); const hj = diaMais(60);
  const pas = { valor_estimado: 3000, finalidade: 'intercambio', passageiros: [{ nome: 'Maria', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
  await t.trocar('bolsista'); const a = await t.api.salvarPedido(null, 'passagem', 'Intercâmbio', hj, pas); const e = await t.api.salvarPedido(null, 'evento', 'Encontro', hj, { valor_estimado: 5000, local: 'Sede' });
  await t.trocar('coord_tecnico'); await t.api.moverPedido(a, 'conferir'); await t.api.moverPedido(e, 'conferir');
  await t.trocar('coord_geral'); await t.api.moverPedido(a, 'autorizar'); await t.api.moverPedido(e, 'autorizar'); await t.trocar('coord_geral');
  let n = t.MQ.execUI.numeros(); assert.equal(n.porItem.passagem_intercambio.comp, 3000, 'sem planilha: tudo autorizado é comprometido'); assert.equal(n.porItem.eventos.comp, 5000);
  await enviarFixture(t, 'modelo_preenchido.xlsx', '2026-09-01'); n = t.MQ.execUI.numeros();
  assert.equal(n.porItem.passagem_intercambio.comp, 3000, 'autorizado depois da planilha: comprometido');
  await enviarFixture(t, 'modelo_preenchido.xlsx', t.MQ.regras.hoje()); n = t.MQ.execUI.numeros();
  assert.equal(n.porItem.passagem_intercambio.comp, 0, 'autorizado até a data da planilha: já está nela');
});

test('prévia avisa quando a nova planilha tem total menor que a vigente (retrato incompleto)', async () => {
  const t = await montar('coord_geral'); await enviarFixture(t, 'funcern_baguncado.xlsx', '2026-09-28');
  t.MQ.ui.S.painel = null; const pr = await t.MQ.execUI.preparar(arquivo('modelo_preenchido.xlsx'));
  assert.equal(pr.posicao, '2026-09-25', 'data sugerida = última data da planilha');
  const h = t.MQ.execUI.painel({ tipo: 'exec-enviar' }); assert.ok(!/Prévia/.test(h), 'sem arquivo lido, sem prévia');
});

test('alerta de planilha velha (mais de 35 dias) e lembrete do mês para a coordenação geral', async () => {
  const t = await montar('coord_geral'); await enviarFixture(t, 'modelo_preenchido.xlsx', '2026-09-25');
  t.S.execPlanilhas.forEach(p => { p.enviado_em = '2026-09-25T15:00:00.000Z'; });   // enviada em setembro (o teste não depende do dia em que roda)
  t.MQ.regras.hoje = () => '2026-11-05'; assert.match(texto(t.aba('execucao')), /Envie a planilha deste mês/);
  t.MQ.regras.hoje = () => '2026-10-22'; assert.ok(t.MQ.lembreteUI.itens().some(i => /^planilha-2026-10$/.test(i.id)), 'lembrete a partir do dia 20 sem planilha do mês');
  t.MQ.regras.hoje = () => '2026-10-10'; assert.ok(!t.MQ.lembreteUI.itens().some(i => /^planilha/.test(i.id)), 'antes do dia 20, sem lembrete');
});

test('gráficos: ritmo com os gastos da planilha por mês; uma barra por rubrica; clique leva à tabela', async () => {
  const t = await montar('coord_geral'); await enviarFixture(t, 'modelo_preenchido.xlsx');
  const sr = t.MQ.execUI.serie(); assert.equal(sr.meses.length, 13); assert.ok(Math.abs(sr.previsto[12] - 2000000) < 0.01);
  const i = sr.meses.indexOf('2026-09'); assert.equal(sr.executado[i], 111800); assert.equal(sr.recebido[i], 1000000);
  if (sr.idxHoje >= 0 && sr.idxHoje < 12) assert.equal(sr.executado[sr.idxHoje + 1], null, 'futuro em branco');
  const h = t.aba('execucao');
  assert.equal((h.match(/data-exg="/g) || []).length, 13); assert.equal((h.match(/class="eg-bar[" ]/g) || []).length, t.MQ.ORCAMENTO.rubricas.length);
  assert.ok(/data-acao="exec-rub" data-id="r13"/.test(h) && /<tbody id="exr-r13">/.test(h));
  assert.ok(!/\d\.\d%/.test(texto(h)), 'porcentagem com vírgula');
});

test('vale a última planilha ENVIADA, mesmo que corrija uma data anterior', async () => {
  const t = await montar('coord_geral');
  t.S.execPlanilhas = [{ id: 'a', posicao_em: '2026-09-28', enviado_em: '2026-09-29T10:00:00Z', total_gasto: 9999, linhas: [], arquivo_nome: 'a.xlsx' },
                       { id: 'b', posicao_em: '2026-09-20', enviado_em: '2026-09-30T10:00:00Z', total_gasto: 500, linhas: [], arquivo_nome: 'b.xlsx' }];
  assert.equal(t.MQ.execUI.vigente().id, 'b');
});
