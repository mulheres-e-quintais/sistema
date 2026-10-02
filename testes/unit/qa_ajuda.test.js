/* QA 01/10/2026 — js/ajuda.js: a ajuda da aba Execução abre o tópico da Execução (antes abria "Visão geral"). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

test('coordenação geral na aba Execução: a ajuda é a da Execução', async () => {
  const T = await montar('coord_geral'); const A = T.MQ.ajudaUI;
  T.S.aba = 'execucao';
  assert.equal(A.chaveAtual(), 'execucao');
  const h = texto(A.painel({}));
  assert.ok(h.includes(A.A.execucao.t), 'título do tópico da Execução'); assert.ok(!h.includes('Ajuda ' + A.A.visao.t));
  T.S.aba = 'visao'; assert.equal(A.chaveAtual(), 'visao');
});
test('o tópico da Execução aparece entre os outros tópicos só para a coordenação geral', async () => {
  const G = await montar('coord_geral'); G.S.aba = 'equipe';
  assert.match(G.MQ.ajudaUI.painel({}), /data-k="execucao"|execucao/);
  const T = await montar('coord_tecnico'); T.S.aba = 'execucao';
  assert.notEqual(T.MQ.ajudaUI.chaveAtual(), 'execucao', 'a técnica não tem a aba Execução');
});
