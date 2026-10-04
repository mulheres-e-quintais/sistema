/* Itens do kit com preço de referência (js/dados.js, js/regras.js) e a projeção do plano antigo sem valor. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');

const amb = S => carregar(['dados.js', 'regras.js'], { ui: { S: S || {} } }).MQ;

describe('lista de itens do kit', () => {
  test('a lista do sistema tem os 9 itens, todos com preço, unidade, fonte e marcados como estimativa', () => {
    const MQ = amb();
    assert.equal(MQ.KIT_ITENS.length, 9);
    MQ.KIT_ITENS.forEach(x => { assert.ok(x.valor_ref > 0 && x.valor_ref <= MQ.KIT_QUINTAL, x.item); assert.ok(x.unidade && x.fonte, x.item); assert.equal(x.preliminar, true); });
  });
  test('acha o item sem ligar para acento, maiúscula, espaço ou tipo de apóstrofo', () => {
    const MQ = amb();
    assert.equal(MQ.kitItem('caixa d’água 1.000 l').valor_ref, 502.84);
    assert.equal(MQ.kitItem('  TELA  PARA GALINHEIRO ').unidade, 'm');
    assert.equal(MQ.kitItem('Esterco curtído').item, 'Esterco curtido');
    assert.equal(MQ.kitItem('Trator'), null);
    assert.equal(MQ.kitItem(''), null);
  });
  test('a tabela do banco, quando existe, vale no lugar da lista do sistema; item inativo some', () => {
    const MQ = amb({ kitItens: [{ item: 'Esterco curtido', unidade: 'saco', valor_ref: 12, ativo: true }, { item: 'Arame', unidade: 'm', valor_ref: 2, ativo: false }] });
    assert.equal(MQ.kitItem('esterco curtido').valor_ref, 12);
    assert.equal(MQ.kitItem('Arame'), null);
    assert.equal(MQ.kitItem("Caixa d'água 1.000 L"), null);
    assert.equal(MQ.kitItens().length, 1);
  });
  test('tabela vazia no banco: continua valendo a lista do sistema', () => {
    assert.equal(amb({ kitItens: [] }).kitItens().length, 9);
  });
});

describe('projeção com preço de referência', () => {
  test('plano antigo sem valor: usa o preço de referência e marca o item', () => {
    const MQ = amb(); const R = MQ.regras;
    const kit = [{ item: 'Tela de sombreamento 50%', qtd: '30 m²' }, { item: 'Tela para galinheiro', qtd: '25 m' }, { item: "Caixa d'água 1.000 L", qtd: '1' }, { item: 'Ferramentas manuais', qtd: '1 kit' }, { item: 'Regador e mangueira', qtd: '1' }];
    assert.equal(R.totalKit(kit), 0);                          // sem valor digitado, a conta de verdade continua zero
    const c = R.kitComRef(kit, MQ.kitItem);
    assert.ok(c.every(x => x.ref));
    assert.equal(Math.round(R.totalKit(c) * 100) / 100, 1273.07);   // 74,10 + 333,00 + 502,84 + 209,60 + 153,53
  });
  test('valor digitado manda: não é trocado pelo de referência', () => {
    const MQ = amb(); const R = MQ.regras;
    const c = R.kitComRef([{ item: 'Esterco curtido', qtd: '20 sacos', valor: 9 }], MQ.kitItem);
    assert.equal(c[0].valor, 9); assert.equal(c[0].ref, undefined);
  });
  test('item fora da lista fica sem valor; lista vazia ou ausente não quebra', () => {
    const MQ = amb(); const R = MQ.regras;
    assert.equal(R.kitComRef([{ item: 'Tela para canteiro', qtd: '20 m' }], MQ.kitItem)[0].valor, undefined);
    assert.equal(R.kitComRef(null, MQ.kitItem).length, 0);
    assert.equal(R.kitComRef([{ item: 'x' }])[0].valor, undefined);
  });
  test('a conferência do envio não exige valor (quem faz o diagnóstico não informa preço), mas exige quantidade', () => {
    const R = amb().regras;
    assert.equal(R.erroKit([{ item: 'Esterco curtido', qtd: '20' }]), null);
    assert.match(R.erroKit([{ item: 'Esterco curtido', qtd: '' }]), /Informe a quantidade de Esterco curtido/);
    assert.match(R.erroKit([{ item: 'Esterco curtido', qtd: '2', valor: -1 }]), /não pode ser negativo/);
  });
});
