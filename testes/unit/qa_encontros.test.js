/* QA 01/10/2026 — js/encontros.js: soma da carga horária com 1 casa (1,1 + 2,2 = 3,3 h, não 3,3000000000000003 h). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

async function professorComEncontros(cargas) {
  const T = await montar('professor'); const { MQ, S } = T; const hoje = MQ.regras.hoje(); const eu = S.eu;
  S.turmas = [{ id: 'tq', nome: 'Turma de teste', professor_id: eu.id }]; S.matriculas = [];
  S.encontros = cargas.map((h, i) => ({ id: 'eq' + i, turma_id: 'tq', professor_id: eu.id, data: hoje, carga_horaria: h, modalidade: 'presencial', conteudo: 'Planejamento do quintal ' + i, presencas: [] }));
  return { T, MQ, eu, ym: hoje.slice(0, 7) };
}

test('pedido de bolsa do professor: 1,1 h + 2,2 h aparece como "3,3 h"', async () => {
  const { MQ, eu, ym } = await professorComEncontros([1.1, 2.2]);
  const t = texto(MQ.encUI.blocoPedido(eu.id, ym));
  assert.match(t, /2 encontros · 3,3 h ·/); assert.doesNotMatch(t, /3,30000/);
});
test('lista de encontros do mês: o título soma com 1 casa (0,1 + 0,2 = 0,3 h)', async () => {
  const { MQ } = await professorComEncontros([0.1, 0.2]);
  const t = texto(MQ.encUI.secaoProfessor());
  assert.match(t, /2 encontros · 0,3 h/); assert.doesNotMatch(t, /0,30000000000000004/);
});
test('relatório gravado: o resumo usa a soma arredondada', async () => {
  const { MQ, eu, ym } = await professorComEncontros([1.1, 2.2]);
  const encs = MQ.encUI.doMes(eu.id, ym);
  const h = texto(MQ.encUI.relatorioHTML({ equipe_id: eu.id, mes: ym + '-01', relatorio: 'x', detalhe: { fic_encontros: encs } }));
  assert.match(h, /3,3 h de carga horária/); assert.doesNotMatch(h, /3,30000/);
});
