/* 30/09/2026: leitor de planilha (.xlsx e .csv, sem biblioteca) e interpretação para a aba Execução. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { montar } = require('./telas');
const arquivo = (nome, tipo) => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', nome)); return { name: nome, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const csv = (nome, txt, enc) => { const b = Buffer.from(txt, enc || 'utf8'); return { name: nome, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };

test('modelo preenchido (.xlsx): lê a aba Gastos, datas do Excel, itens do orçamento e o repasse', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.planilha;
  const tab = await P.ler(arquivo('modelo_preenchido.xlsx')); assert.equal(tab.aba, 'Gastos');
  const r = P.interpretar(tab); assert.equal(r.linhas.length, 4);
  const por = Object.fromEntries(r.linhas.map(l => [l.item, l]));
  assert.equal(por.repasse_mda.valor, 1000000); assert.equal(por.repasse_mda.data, '2026-09-01'); assert.equal(por.repasse_mda.documento, '2026NC000014');
  assert.equal(por.doa.valor, 100000); assert.equal(por.diarias.valor, 800); assert.equal(por.bolsa_articulacao.valor, 11000);
  const s = P.resumo(r); assert.equal(s.gasto, 111800); assert.equal(s.recebido, 1000000); assert.equal(s.naoClassificadas.length, 0); assert.equal(s.ultimaData, '2026-09-25');
});

test('planilha de fora: acha o cabeçalho abaixo do título, pula subtotal e total, entende "R$ 1.234,56" e "(1.200,00)"', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.planilha;
  const r = P.interpretar(await P.ler(arquivo('funcern_baguncado.xlsx')));
  assert.equal(r.ignoradas, 2, 'subtotal e total geral não entram');
  const q = r.linhas.find(l => /Kit/.test(l.descricao)); assert.equal(q.item, 'quintais'); assert.equal(q.valor, 200000); assert.equal(q.data, '2026-09-23', 'data em número de série do Excel');
  assert.equal(r.linhas.find(l => l.texto === 'Diárias').item, 'diarias');
  const c = r.linhas.find(l => l.texto === 'Material de consumo'); assert.equal(c.item, 'combustivel', 'rubrica com um item só vai para o item'); assert.equal(c.valor, 350.5);
  const cb = r.linhas.find(l => l.texto === 'Coffee break'); assert.equal(cb.item, null); assert.equal(cb.rubrica, null, 'fora do orçamento: não classificada'); assert.equal(cb.valor, -1200);
  const pa = r.linhas.find(l => l.texto === 'Passagens e locomoção'); assert.equal(pa.rubrica, 'r6'); assert.equal(pa.item, null, 'rubrica com vários itens: fica na rubrica, sem item');
  assert.equal(P.resumo(r).naoClassificadas.length, 1);
});

test('CSV com ponto e vírgula e acento do Excel brasileiro (ANSI); aspas com separador dentro', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.planilha;
  const txt = 'Data;Item do orçamento;Descrição;Documento;Valor (R$)\r\n05/09/2026;Taxa da fundação de apoio;"DOA; primeira parcela";C 277;100.000,00\r\n;Total;;;100.000,00\r\n';
  const r = P.interpretar(await P.ler(csv('gastos.csv', txt, 'latin1')));
  assert.equal(r.linhas.length, 1); assert.equal(r.linhas[0].item, 'doa'); assert.equal(r.linhas[0].descricao, 'DOA; primeira parcela'); assert.equal(r.linhas[0].valor, 100000); assert.equal(r.linhas[0].data, '2026-09-05');
});

test('arquivos errados dão mensagem clara', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.planilha;
  await assert.rejects(P.ler(csv('x.xls', 'a')), /Salve a planilha como \.xlsx/);
  await assert.rejects(P.ler(csv('x.pdf', 'a')), /\.xlsx ou \.csv/);
  await assert.rejects(P.ler(csv('x.xlsx', 'não sou zip')), /não é uma planilha \.xlsx válida/);
  assert.throws(() => P.interpretar({ aba: 'x', linhas: [['nome', 'idade'], ['a', 1]] }), /cabeçalho/);
  assert.throws(() => P.interpretar({ aba: 'x', linhas: [['Item', 'Valor'], ['Total', 10]] }), /nenhuma linha com valor/);
  await assert.rejects(P.ler(Object.assign(csv('g.csv', 'a'), { size: 11 * 1024 * 1024 })), /grande demais/);
});

test('números e datas no jeito brasileiro', async () => {
  const t = await montar('coord_geral'); const { numeroBR: n, dataDe: d } = t.MQ.planilha;
  assert.equal(n('R$ 1.234,56'), 1234.56); assert.equal(n('1234.56'), 1234.56); assert.equal(n('1.234'), 1234); assert.equal(n('(350,00)'), -350); assert.equal(n('-10'), -10); assert.equal(n(''), null);
  assert.equal(d('05/09/2026'), '2026-09-05'); assert.equal(d('5/9/26'), '2026-09-05'); assert.equal(d('2026-09-05T00:00'), '2026-09-05'); assert.equal(d(46288), '2026-09-23'); assert.equal(d('ontem'), null);
});
