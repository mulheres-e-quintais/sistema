/* 01/10/2026: visão geral 2.0 — execução ponderada pelo valor das metas, pendências com prazo, água, menu agrupado */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

test('execução física: média ponderada pelo valor de cada meta no Plano de Trabalho (não média simples)', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.painelUI; const M = t.MQ.METAS;
  assert.equal(JSON.stringify(M.filter(m => m.valor).map(m => [m.id, m.valor])), JSON.stringify([['M2', 50000], ['M3', 1050000], ['M4', 100000], ['M5', 30000], ['M6', 70000], ['M7', 42000]]));
  // só M2 completa (200 diagnósticos): pesa 50 mil de 1,2 mi = 4,2%; a média simples daria 33%
  t.S.diagnosticos = Array.from({ length: 200 }, (_, i) => ({ id: 'd' + i, ficha_id: 'f' + i, situacao: 'aprovado' }));
  t.S.visitas = [];
  const ex = P.execucaoGeral(t.S, { aptas: [], pagaveis: [], fichas: [], selAprov: [] }, 2);
  assert.ok(Math.abs(ex.real - 50000 / 1200000 * 100) < 0.01, 'M2 vale 4,2% da execução: ' + ex.real);
  assert.equal(ex.med.map(x => x.meta.id).join(), 'M2,M3,M4'); assert.equal(ex.fora.map(m => m.id).join(), 'M5,M6,M7');
  assert.match(ex.html, /Como é calculado/); assert.match(ex.html, /M5, M6, M7 ainda são registradas fora do sistema/);
});
test('status padrão das metas: concluída, em andamento, atenção, atrasada, não iniciada', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.painelUI; const M2 = t.MQ.METAS.find(m => m.id === 'M2'); const d = { aptas: [], pagaveis: [] };
  const st = (n, mes) => { t.S.diagnosticos = Array.from({ length: n }, (_, i) => ({ id: 'd' + i })); return P.infoMeta(M2, t.S, d, mes).st; };
  assert.equal(st(200, 3), 'concluida'); assert.equal(st(0, 1), 'nao'); assert.equal(st(10, 2), 'andamento');
  // mês 4: previsto até o fim do mês 3 = 2 de 4 meses da janela (2 a 5) = 100
  assert.equal(st(100, 4), 'andamento'); assert.equal(st(75, 4), 'atencao'); assert.equal(st(40, 4), 'atrasada'); assert.equal(st(150, 7), 'atrasada', 'passou da janela sem concluir');
  const M5 = t.MQ.METAS.find(m => m.id === 'M5'); assert.equal(P.infoMeta(M5, t.S, d, 2).st, 'nao'); assert.equal(P.infoMeta(M5, t.S, d, 8).st, 'fora');
});
test('visão geral: cabeçalho, indicadores, pendências com problema, prazo e ação; 279 x 269 explicado', async () => {
  const t = await montar('coord_geral'); const h = t.aba('visao'); const x = texto(h);
  assert.match(x, /Execução do projeto/); assert.match(x, /Execução física do projeto/);
  for (const r of ['mulheres selecionadas e aprovadas', 'diagnósticos', 'quintais implantados', 'visitas de acompanhamento']) assert.match(x, new RegExp(r));
  assert.match(h, /role="columnheader">Problema/); assert.match(h, /role="columnheader">Prazo/); assert.match(x, /Resolver/);
  assert.match(x, /09\/10\/2026/, 'a vaga da equipe traz o prazo de indicação do MPA');
  const nFichas = t.S.fichas.length; assert.match(x, new RegExp(`com ficha válida em \\d+ estados? do Nordeste · ${nFichas} fichas lançadas`));
  assert.match(x, /Acesso à água/); assert.match(x, /mulheres? · \d+%|mulher · \d+%/, 'quem são as mulheres: número e percentual');
});
test('menu agrupado: Gestão, Execução, Financeiro, Documentação', async () => {
  const t = await montar('coord_geral'); const h = t.aba('visao');
  const grupos = [...h.matchAll(/class="aba-grupo" role="group" aria-label="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(grupos, ['Gestão', 'Execução', 'Financeiro', 'Documentação']);
  const tec = await montar('coord_tecnico'); const g2 = [...tec.aba(null).matchAll(/class="aba-grupo" role="group" aria-label="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(g2, ['Gestão', 'Execução', 'Financeiro'], 'técnica: sem Documentação');
});
test('água: quem precisa, situação padrão, registro com histórico; nada se altera', async () => {
  const t = await montar('coord_geral'); const A = t.MQ.aguaUI;
  const sa = t.S.fichas.find(f => f.resultado === 'sem_agua'); assert.ok(sa, 'a demonstração tem ficha sem água');
  const l = A.lista(); const x = l.find(y => y.f.id === sa.id); assert.equal(x.situacao, 'encaminhada', 'ficha sem água começa encaminhada');
  await assert.rejects(t.api.registrarSituacaoAgua(sa.id, 'em_andamento', 'curto'), /pelo menos 10/);
  const outra = t.S.fichas.find(f => f.resultado === 'selecionada'); await assert.rejects(t.api.registrarSituacaoAgua(outra.id, 'em_andamento', 'Cisterna em construção'), /não está na lista/);
  await t.api.registrarSituacaoAgua(sa.id, 'em_andamento', 'Cisterna de 16 mil litros em construção');
  await assert.rejects(t.api.registrarSituacaoAgua(sa.id, 'em_andamento', 'Cisterna ainda em construção'), /já é esta/);
  await t.trocar('coord_geral');
  assert.equal(A.lista().find(y => y.f.id === sa.id).situacao, 'em_andamento');
  const p = texto(t.painel({ tipo: 'agua-ver', id: sa.id })); assert.match(p, /Cisterna de 16 mil litros/); assert.match(p, /Solução em andamento/);
  await t.trocar('bolsista'); await assert.rejects(t.api.registrarSituacaoAgua(sa.id, 'concluida', 'Cisterna pronta e cheia'), /coordenação/);
  assert.equal((await t.api.listarAgua()).length, 0, 'bolsista não lê');
});
