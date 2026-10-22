/* 22/10/2026: planilha da FUNCERN — a coluna "Rubrica" traz a rubrica contábil; o item vem do histórico/favorecido.
   Antes: bolsa do coordenador geral ficava "sem item" em Auxílio a pesquisador; a taxa da fundação (DOA) caía em Serviços de terceiros. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const TAB = { linhas: [['Dt. Pagamento', 'Rubrica', 'Histórico', 'Favorecido', 'Valor Pago'],
  ['01/10/2026', 'Auxílio financeiro a pesquisador', 'Bolsa set/2026', 'Cleone Silva de Lima', 5000],
  ['01/10/2026', 'Auxílio financeiro a pesquisador', 'Bolsa coordenação geral out/2026', '', 5000],
  ['02/10/2026', 'Serviços de terceiros - pessoa jurídica', 'Despesas operacionais e administrativas - DOA', 'FUNCERN', 100000],
  ['03/10/2026', 'Serviços de terceiros - pessoa jurídica', 'Kit quintal lote 1', 'Agro Ltda', 20000],
  ['03/10/2026', 'Passagens e locomoção', 'Passagem coordenador geral Brasília', 'Cia', 2000],
  ['04/10/2026', 'Auxílio financeiro a estudantes', 'Bolsa', 'Maria das Dores Souza', 2200],
  ['05/10/2026', 'Auxílio financeiro a pesquisador', 'Bolsa', 'Pessoa Desconhecida', 1000]] };
const EQ = [{ nome: 'Cleone Silva de Lima', papel: 'coord_geral' }, { nome: 'Maria das Dores Souza', papel: 'articulacao' }];

test('FUNCERN: o histórico e o favorecido decidem o item quando a rubrica não basta', async () => {
  const t = await montar('coord_geral'); const r = t.MQ.planilha.interpretar(TAB, { equipe: EQ });
  const it = r.linhas.map(l => [l.linha, l.rubrica, l.item]);
  assert.deepEqual(it[0], [2, 'r1', 'bolsa_coord_geral'], 'nome do coordenador geral no favorecido');
  assert.deepEqual(it[1], [3, 'r1', 'bolsa_coord_geral'], '"coordenação geral" no histórico');
  assert.deepEqual(it[2], [4, 'r13', 'doa'], 'DOA vai para Despesas operacionais, mesmo vindo como serviço de terceiros');
  assert.deepEqual(it[3], [5, 'r7', 'quintais'], 'kit do quintal');
  assert.deepEqual(it[4], [6, 'r6', null], 'passagem do coordenador geral NÃO vira bolsa (fica na rubrica de passagens)');
  assert.deepEqual(it[5], [7, 'r2', 'bolsa_articulacao'], 'nome de bolsista de articulação');
  assert.deepEqual(it[6], [8, 'r1', null], 'nome que não é da equipe: fica na rubrica, sem chutar item');
});
test('a tela passa a equipe ao ler a planilha (o nome no favorecido acha a bolsa)', async () => {
  const t = await montar('coord_geral');
  assert.match(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'js', 'execucao.js'), 'utf8'), /interpretar\(tab, \{ equipe: S\(\)\.equipe/);
});
