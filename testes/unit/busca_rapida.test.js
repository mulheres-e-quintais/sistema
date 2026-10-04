/* Busca rápida por campo (MQ.porCampo) e pelo nome do item do kit (MQ.kitItem): mesmo resultado do .find, sem varrer a lista a cada procura. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');
const amb = S => carregar(['dados.js', 'regras.js'], { ui: { S: S || {} } }).MQ;
const espera = ms => new Promise(r => setTimeout(r, ms));

describe('MQ.porCampo', () => {
  test('devolve o PRIMEIRO registro com aquele valor, como o .find', () => {
    const MQ = amb(); const l = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }];
    assert.equal(MQ.porCampo(l, 'id').get('a').n, 1); assert.equal(MQ.porCampo(l, 'id').get('b').n, 2); assert.equal(MQ.porCampo(l, 'id').get('z'), undefined);
  });
  test('lista vazia, nula ou indefinida: mapa vazio, sem erro', () => {
    const MQ = amb(); for (const l of [[], null, undefined]) { assert.equal(MQ.porCampo(l, 'id').get('a'), undefined); assert.equal(MQ.porCampo(l, 'id').has('a'), false); }
  });
  test('com filtro: só entram os registros que passam (ex.: diagnóstico com GPS)', () => {
    const MQ = amb(); const l = [{ ficha_id: 'f1', latitude: null }, { ficha_id: 'f1', latitude: -7.1 }, { ficha_id: 'f2', latitude: null }];
    const m = MQ.porCampo(l, 'ficha_id', 'gps', x => x.latitude != null);
    assert.equal(m.get('f1').latitude, -7.1); assert.equal(m.has('f2'), false);
    assert.equal(MQ.porCampo(l, 'ficha_id').get('f1').latitude, null, 'o mapa sem filtro é outro e não se mistura');
  });
  test('registro acrescentado à mesma lista aparece na hora (o tamanho mudou)', () => {
    const MQ = amb(); const l = [{ id: 'a' }]; assert.equal(MQ.porCampo(l, 'id').has('b'), false);
    l.push({ id: 'b' }); assert.equal(MQ.porCampo(l, 'id').has('b'), true);
  });
  test('lista trocada por outra aparece na hora', () => {
    const MQ = amb(); assert.equal(MQ.porCampo([{ id: 'a' }], 'id').has('a'), true); assert.equal(MQ.porCampo([{ id: 'b' }], 'id').has('a'), false);
  });
  test('registro alterado no lugar, sem mudar o tamanho, aparece em até 1/5 de segundo', async () => {
    const MQ = amb(); const l = [{ id: 'a' }, { id: 'b' }]; assert.equal(MQ.porCampo(l, 'id').has('c'), false);
    l[1] = { id: 'c' }; await espera(230); assert.equal(MQ.porCampo(l, 'id').has('c'), true); assert.equal(MQ.porCampo(l, 'id').has('b'), false);
  });
  test('resultado igual ao .find em 200 listas sorteadas', () => {
    const MQ = amb(); let s = 7; const rnd = n => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
    for (let k = 0; k < 200; k++) { const l = Array.from({ length: rnd(80) }, (_, i) => ({ ficha_id: 'f' + rnd(30), latitude: rnd(3) ? i : null, i }));
      for (let q = 0; q < 30; q++) { const id = 'f' + q;
        assert.equal(MQ.porCampo(l, 'ficha_id').get(id), l.find(x => x.ficha_id === id));
        assert.equal(MQ.porCampo(l, 'ficha_id', 'gps', x => x.latitude != null).get(id), l.find(x => x.ficha_id === id && x.latitude != null)); } }
  });
  test('10.000 procuras em lista de 10.000 levam menos de 200 ms (antes, cada procura varria a lista)', () => {
    const MQ = amb(); const l = Array.from({ length: 10000 }, (_, i) => ({ id: 'f' + i })); const t = Date.now();
    let achou = 0; for (let i = 0; i < 10000; i++) if (MQ.porCampo(l, 'id').get('f' + i)) achou++;
    assert.equal(achou, 10000); assert.ok(Date.now() - t < 200, (Date.now() - t) + ' ms');
  });
});

describe('MQ.kitItem com a lista indexada', () => {
  test('tabela do banco trocada: o item novo vale na hora', () => {
    const S = { kitItens: [{ item: 'Esterco curtido', unidade: 'saco', valor_ref: 12, ativo: true }] }; const MQ = amb(S);
    assert.equal(MQ.kitItem('esterco curtido').valor_ref, 12);
    S.kitItens = [{ item: 'Esterco curtido', unidade: 'saco', valor_ref: 9, ativo: true }, { item: 'Arame', unidade: 'm', valor_ref: 2, ativo: true }];
    assert.equal(MQ.kitItem('ESTERCO CURTIDO').valor_ref, 9); assert.equal(MQ.kitItem('arame').valor_ref, 2);
  });
  test('tabela esvaziada: volta a valer a lista do sistema', () => {
    const S = { kitItens: [{ item: 'Arame', unidade: 'm', valor_ref: 2, ativo: true }] }; const MQ = amb(S);
    assert.equal(MQ.kitItem('Mudas frutíferas'), null); S.kitItens = []; assert.equal(MQ.kitItem('Mudas frutíferas').valor_ref, 20);
  });
  test('dois itens com o mesmo nome: vale o primeiro; inativo não entra', () => {
    const MQ = amb({ kitItens: [{ item: 'Tela', unidade: 'm', valor_ref: 1, ativo: false }, { item: 'tela', unidade: 'm', valor_ref: 5, ativo: true }, { item: 'TELA', unidade: 'm', valor_ref: 7, ativo: true }] });
    assert.equal(MQ.kitItem('Tela').valor_ref, 5);
  });
});
