/* QA 01/10/2026 — js/execucao.js: barras entre 0 e 100%, item desconhecido não some da rubrica, planilha fora do período, plural da prévia. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { FormDataFalso } = require('./ambiente');

const linha = (item, rubrica, valor, data) => ({ linha: 1, data: data || null, texto: item || '', item, rubrica, valor });
async function comPlanilha(linhas, extra = {}) {
  const T = await montar('coord_geral'); const hoje = T.MQ.regras.hoje();
  T.S.execPlanilhas = [Object.assign({ id: 'p1', posicao_em: hoje, enviado_em: new Date().toISOString(), arquivo_nome: 'g.xlsx', arquivo_path: 'x', linhas,
    total_gasto: linhas.filter(l => l.item !== 'repasse_mda').reduce((t, l) => t + l.valor, 0), total_recebido: 0 }, extra)];
  T.S.solic = []; T.S.pedidos = [];
  return T;
}
const formFalso = () => { const b = { textContent: 'x', disabled: false }; return { dataset: {}, querySelector: s => /submit/.test(s) ? b : null, querySelectorAll: () => [], closest: () => null }; };
const arqCsv = txt => { const b = Buffer.from(txt, 'utf8'); return { name: 'gastos.csv', size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
async function previa(T, txt) {
  let erro = null; T.MQ.ui.mostrarErros = (f, e) => { erro = e; };
  await T.MQ.execUI.enviar('exec-ler', formFalso(), new FormDataFalso({ arquivo: arqCsv(txt) }));
  assert.equal(erro, null, JSON.stringify(erro));
  return T.MQ.execUI.painel({ tipo: 'exec-enviar' });
}

test('estorno maior que o gasto (executado negativo): nenhuma barra com largura negativa', async () => {
  const T = await comPlanilha([linha('diarias', 'r4', -500)]);
  const h = T.aba('execucao');
  assert.doesNotMatch(h, /width:-/); assert.doesNotMatch(h, /left:-/);
  for (const m of h.matchAll(/(?:width|left):(-?[\d.]+)%/g)) assert.ok(+m[1] >= 0 && +m[1] <= 100, m[0]);
  // e gasto muito acima do previsto continua parando em 100%
  const A = await comPlanilha([linha('diarias', 'r4', 9e6)]);
  for (const m of A.aba('execucao').matchAll(/(?:width|left):(-?[\d.]+)%/g)) assert.ok(+m[1] >= 0 && +m[1] <= 100, m[0]);
});
test('item que não existe mais no orçamento, com rubrica: continua somando na rubrica (linha "sem item")', async () => {
  const T = await comPlanilha([linha('item_antigo', 'r4', 400), linha('diarias', 'r4', 100)]);
  const n = T.MQ.execUI.numeros(); const r4 = n.rub.find(x => x.r.id === 'r4');
  assert.equal(n.exec, 500); assert.equal(r4.exec, 500); assert.equal(r4.semItem, 400); assert.equal(n.naoClass, 0);
  assert.equal(n.rub.reduce((t, x) => t + x.exec, 0) + n.naoClass, n.exec);
  assert.match(texto(T.aba('execucao')), /Sem item definido na planilha/);
});
test('item e rubrica desconhecidos: vão para "fora do orçamento" e a soma fecha com o total', async () => {
  const T = await comPlanilha([linha('item_antigo', 'r99', 70), linha('outro', null, 30), linha('diarias', 'r4', 100), linha('repasse_mda', null, 1000)]);
  const n = T.MQ.execUI.numeros();
  assert.equal(n.exec, 200); assert.equal(n.naoClass, 100); assert.equal(n.recebido, 1000);
  assert.equal(n.rub.reduce((t, x) => t + x.exec, 0) + n.naoClass, n.exec);
});
test('planilha vigente datada fora do período do projeto: aviso na aba', async () => {
  const T = await comPlanilha([linha('diarias', 'r4', 100)], { posicao_em: '2026-03-10' });
  assert.match(texto(T.aba('execucao')), /fora do período do projeto \(14\/09\/2026 a 30\/09\/2027\)/);
  const ok = await comPlanilha([linha('diarias', 'r4', 100)]);
  assert.doesNotMatch(texto(ok.aba('execucao')), /fora do período do projeto/);
});
test('prévia: planilha com data fora do período do projeto e linha suspeita mostram aviso (sem bloquear)', async () => {
  const T = await montar('coord_geral'); T.S.execPlanilhas = [];
  const h = texto(await previa(T, 'Data;Item;Valor\n10/03/2026;Diárias;100\n10/03/2026;Diárias;20.000.000,00\n'));
  assert.match(h, /A data desta planilha \(10\/03\/2026\) está fora do período do projeto/);
  assert.match(h, /1 linha suspeita, com valor acima de R\$ 10 milhões/);
  assert.match(h, /Enviar e usar esta planilha/, 'o envio continua disponível');
});
test('prévia: concordância com 1 linha ("1 linha ... ignorada", "1 linha não bate")', async () => {
  const T = await montar('coord_geral'); T.S.execPlanilhas = [];
  const um = texto(await previa(T, 'Data;Item;Valor\n01/10/2026;Diárias;100\n01/10/2026;Coffee break;50\n;Total;;150\n'));
  assert.match(um, /1 linha de total ou sem valor ignorada(?!s)/); assert.doesNotMatch(um, /1 linhas/);
  assert.match(um, /1 linha não bate com nenhum item do orçamento \(entra no total/); assert.doesNotMatch(um, /1 linha não batem/);
  const dois = texto(await previa(T, 'Data;Item;Valor\n01/10/2026;Diárias;100\n01/10/2026;Coffee break;50\n01/10/2026;Brindes;50\n;Subtotal;;200\n;Total;;200\n'));
  assert.match(dois, /2 linhas de total ou sem valor ignoradas/); assert.match(dois, /2 linhas não batem com nenhum item do orçamento \(entram no total/);
});
