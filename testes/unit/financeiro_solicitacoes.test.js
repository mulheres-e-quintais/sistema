/* 22/10/2026: Financeiro com a planilha de SOLICITAÇÕES da FUNCERN (o mesmo formato que o sistema do Saberes que Cultivam importa).
   Planilha fictícia (nomes de exemplo) copiada dos testes daquele sistema. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { montar } = require('./telas');
const arquivo = nome => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', nome)); return { name: nome, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
async function enviar(t, pr) {
  await t.api.enviarPlanilhaExec({ posicao_em: pr.posicao, arquivo_nome: pr.nome, linhas: pr.linhas, total_gasto: pr.resumo.gasto, total_recebido: pr.resumo.recebido, nao_classificadas: pr.resumo.naoClassificadas.length }, null);
  await t.trocar('coord_geral');
}

test('lê todas as abas; cancelada não entra; "Pagamento" é comprometido; DOA e coordenador do projeto vão para o item certo; CPF nunca', async () => {
  const t = await montar('coord_geral'); 
  const pr = await t.MQ.execUI.preparar(arquivo('funcern_solicitacoes.xlsx'));
  assert.equal(pr.formato, 'solicitacoes'); assert.match(pr.aba, /Solicitações \(Projeto 000\)/);
  assert.equal(pr.linhas.length, 3, 'a cancelada (90003) ficou de fora');
  const por = Object.fromEntries(pr.linhas.map(l => [l.documento, l]));
  assert.equal(por['Solicitação 90001'].item, 'bolsa_coord_geral'); assert.equal(por['Solicitação 90001'].situacao, 'comprometido');
  assert.equal(por['Solicitação 90002'].item, 'doa'); assert.equal(por['Solicitação 90002'].rubrica, 'r13', 'DOA não fica em serviços de terceiros');
  assert.equal(por['Solicitação 90004'].item, 'combustivel'); assert.equal(por['Solicitação 90004'].situacao, 'pago'); assert.equal(por['Solicitação 90004'].valor, 1250.5);
  assert.equal(pr.resumo.gasto, 1250.5); assert.equal(pr.resumo.comprometido, 22000);
  assert.doesNotMatch(JSON.stringify(pr.linhas), /000\.000\.000-00|cpf/i);
});
test('na prévia, a coordenação muda como um status entra (ex.: "Pagamento" como pago) e a escolha vale para a próxima planilha', async () => {
  const t = await montar('coord_geral'); 
  t.janela.localStorage.setItem('mq-imp-status', JSON.stringify({ Pagamento: 'pago' }));
  const pr = await t.MQ.execUI.preparar(arquivo('funcern_solicitacoes.xlsx'));
  assert.equal(pr.resumo.gasto, 23250.5); assert.equal(pr.resumo.comprometido, 0);
  t.janela.localStorage.removeItem('mq-imp-status');
});
test('números e tela: pago só o pago; comprometido soma o não pago; recebido pelo cronograma; despesas listadas', async () => {
  const t = await montar('coord_geral'); 
  await enviar(t, await t.MQ.execUI.preparar(arquivo('funcern_solicitacoes.xlsx')));
  const n = t.MQ.execUI.numeros();
  assert.equal(n.exec, 1250.5); assert.equal(n.porItem.doa.exec, 0); assert.equal(n.porItem.doa.compF, 20000); assert.ok(n.porItem.bolsa_coord_geral.comp >= 2000);
  assert.ok(n.recebidoEstimado); assert.ok(n.recebido >= 1000000, 'primeira parcela pelo cronograma');
  assert.equal(n.despesas.length, 3);
  const h = texto(t.aba('execucao'));
  assert.match(h, /Acompanhamento financeiro/); assert.match(h, /recebido/); assert.match(h, /disponível do recebido/); assert.match(h, /Dentro do que já foi recebido/);
  assert.match(h, /Despesas do projeto 3/); assert.match(h, /Pagamento de Bolsa · Coordenador do Projeto/); assert.match(h, /Ver os números em tabela/);
  assert.doesNotMatch(h, /Solicitação 90003/, 'a cancelada não aparece');
});
test('planilha antiga (modelo, sem situação): continua tudo pago, como antes', async () => {
  const t = await montar('coord_geral'); 
  await enviar(t, await t.MQ.execUI.preparar(arquivo('modelo_preenchido.xlsx')));
  const n = t.MQ.execUI.numeros(); assert.equal(n.exec, 111800); assert.equal(n.recebido, 1000000); assert.ok(!n.recebidoEstimado);
});
