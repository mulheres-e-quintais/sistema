/* QA 01/10/2026 — js/planilha.js: texto na coluna de valor não vira gasto; classificação de repasse; CSV com vírgula; linhas suspeitas. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./ambiente');
const { MQ } = carregar(['dados.js', 'regras.js', 'planilha.js']);
const P = MQ.planilha;
const tab = linhas => ({ aba: 't', linhas });
const csv = s => P.lerCsv(new TextEncoder().encode(s).buffer);

test('numeroBR: data, texto com número, notação científica e intervalo não são valor', () => {
  for (const v of ['12/10/2026', '2026-10-01', '31.12.2026', 'Nota 12', 'ver nota 12', '1e3', '10-20', '5 + 5', '=1+1', '1.2.3', '12,34,56'])
    assert.equal(P.numeroBR(v), null, v + ' → ' + P.numeroBR(v));
  // o texto inteiro no padrão brasileiro ou americano continua valendo (R$, sinal e parênteses)
  assert.deepEqual(['1.600,50', '1600.50', '(1.234,56)', '-1.234,56', 'R$ -5', '- R$ 5,00', '5-', '−5', '1.234', '12.345.678', '1,234.56', '1,000,000', '0.500', '0.005', '.5', ',5', '0,00', 'R$ 1.234,56', ' 400 ', '+7'].map(P.numeroBR),
    [1600.5, 1600.5, -1234.56, -1234.56, -5, -5, -5, -5, 1234, 12345678, 1234.56, 1000000, 0.5, 0.005, 0.5, 0.5, 0, 1234.56, 400, 7]);
  assert.equal(P.numeroBR(12.5), 12.5); assert.equal(P.numeroBR(true), null); assert.equal(P.numeroBR({}), null);
});
test('interpretar: linha com data ou texto na coluna de valor é ignorada, contada e avisada (não vira R$ 12.102.026,00)', () => {
  const r = P.interpretar(tab([['Item', 'Valor'], ['Diárias', 400], ['Diárias', '12/10/2026'], ['Diárias', 'ver nota 12'], ['Diárias', '10-20']]));
  assert.equal(P.resumo(r).gasto, 400); assert.equal(r.linhas.length, 1); assert.equal(r.ignoradas, 3);
  assert.match(r.avisos.join(' | '), /3 linhas ignoradas por ter texto ou data no lugar do valor \(linhas 3, 4, 5\)/);
  const um = P.interpretar(tab([['Item', 'Valor'], ['Diárias', 400], ['Diárias', '1e3']]));
  assert.match(um.avisos.join(' | '), /1 linha ignorada por ter texto ou data no lugar do valor \(linha 3\)/);
});
test('classificar: "repasse" e "receita" só são dinheiro recebido do MDA com o contexto', () => {
  const c = t => simples(P.classificar(t));
  assert.deepEqual(c('Repasse de combustível aos agentes'), { item: 'combustivel', rubrica: 'r9' });
  assert.notEqual(c('Receita Federal - DARF').item, 'repasse_mda');
  assert.notEqual(c('Repasse aos agentes de campo').item, 'repasse_mda');
  for (const t of ['Repasse do MDA', 'Repasse MDA', 'repasse_mda', 'Repasse', 'Repasse 1ª parcela', 'Receita', 'Recurso recebido', 'Crédito recebido', 'Crédito do convênio', 'Nota de crédito', 'Transferência do MDA', 'Repasse do TED'])
    assert.equal(c(t).item, 'repasse_mda', t);
});
test('classificar: "Evento" no singular cai em "eventos"; "Diária" em "diarias"', () => {
  assert.deepEqual(simples(P.classificar('Evento')), { item: 'eventos', rubrica: 'r7' });
  assert.deepEqual(simples(P.classificar('eventos')), { item: 'eventos', rubrica: 'r7' });
  assert.equal(P.classificar('Diária').item, 'diarias');
  assert.deepEqual(simples(P.classificar('Passagens')), { item: null, rubrica: 'r6' });   // genérico continua só na rubrica
});
test('CSV separado por vírgula com centavos sem aspas (1000,50): avisa, em vez de ler 1000 em silêncio', () => {
  const r = P.interpretar(csv('Data,Item,Valor\n01/10/2026,Diárias,1000,50\n02/10/2026,Combustível,20\n'));
  assert.match(r.avisos.join(' | '), /vírgula para separar as colunas e também nos centavos.*1 valor pode ter perdido os centavos/);
  const dois = P.interpretar(csv('Data,Item,Valor\n01/10/2026,Diárias,1000,50\n02/10/2026,Combustível,20,5\n'));
  assert.match(dois.avisos.join(' | '), /2 valores podem ter perdido os centavos/);
  // com ponto e vírgula ou com aspas não há aviso
  assert.doesNotMatch(P.interpretar(csv('Data;Item;Valor\n01/10/2026;Diárias;1000,50\n')).avisos.join(' | '), /centavos/);
  assert.doesNotMatch(P.interpretar(csv('Data,Item,Valor\n01/10/2026,Diárias,"1000,50"\n')).avisos.join(' | '), /centavos/);
});
test('linha com valor acima de R$ 10 milhões ou data fora de 2026 e 2027 entra, marcada como suspeita', () => {
  const r = P.interpretar(tab([['Data', 'Item', 'Valor'], ['01/10/2026', 'Diárias', 400], ['01/10/2026', 'Diárias', 10000000.01], ['31/12/2025', 'Diárias', 10], ['01/01/2028', 'Diárias', 10], ['31/12/2027', 'Diárias', 10]]));
  assert.equal(r.linhas.length, 5, 'não bloqueia: todas entram');
  assert.deepEqual(simples(r.suspeitas), [3, 4, 5]);
  assert.match(r.avisos.join(' | '), /3 linhas suspeitas, com valor acima de R\$ 10 milhões ou data fora de 2026 e 2027 \(linhas 3, 4, 5\)/);
  const ok = P.interpretar(tab([['Data', 'Item', 'Valor'], ['01/01/2026', 'Diárias', 10000000]]));
  assert.deepEqual(simples(ok.suspeitas), []); assert.doesNotMatch(ok.avisos.join(' | '), /suspeita/);
  const uma = P.interpretar(tab([['Data', 'Item', 'Valor'], ['01/10/2029', 'Diárias', 1]]));
  assert.match(uma.avisos.join(' | '), /1 linha suspeita.*\(linha 2\)/);
});
