/* Fila de envio sem internet (js/fila.js). A API é um dublê (mock) que registra as chamadas;
   sem IndexedDB no Node, a fila usa a memória, que é o caminho de reserva do próprio módulo. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, simples } = require('./ambiente');

let F;
beforeEach(() => { F = carregar(['fila.js']).MQ.fila; });

function apiFalsa(comportamento = {}) {
  const chamadas = [];
  const faz = tipo => async (dados) => { chamadas.push([tipo, dados.id]); const c = comportamento[dados.id]; if (c) throw c; };
  return { chamadas, salvarFicha: faz('ficha'), salvarVisita: faz('visita'), salvarDiagnostico: faz('diagnostico'), salvarAvaliacao: faz('avaliacao') };
}
const erroRegra = msg => Object.assign(new Error(msg), { regra: true });
const erroRede = () => Object.assign(new Error('Failed to fetch'), { semRede: true });

describe('guardar no aparelho', () => {
  test('salvar, listar em ordem de criação e remover', async () => {
    await F.salvar({ id: 'b', dono: 'u1', tipo: 'ficha', dados: { id: 'b' }, criado: 2 });
    await F.salvar({ id: 'a', dono: 'u1', tipo: 'ficha', dados: { id: 'a' }, criado: 1 });
    assert.deepEqual(simples((await F.listar('u1')).map(x => x.id)), ['a', 'b']);
    await F.remover('a');
    assert.deepEqual(simples((await F.listar('u1')).map(x => x.id)), ['b']);
  });
  test('cada pessoa vê só o que é dela; sem dono, lista tudo', async () => {
    await F.salvar({ id: 'x', dono: 'u1', dados: { id: 'x' } }); await F.salvar({ id: 'y', dono: 'u2', dados: { id: 'y' } });
    assert.equal((await F.listar('u1')).length, 1); assert.equal((await F.listar()).length, 2);
  });
  test('salvar de novo com o mesmo id substitui (não duplica)', async () => {
    await F.salvar({ id: 'x', dono: 'u1', dados: { id: 'x', v: 1 } }); await F.salvar({ id: 'x', dono: 'u1', dados: { id: 'x', v: 2 } });
    const l = await F.listar('u1'); assert.equal(l.length, 1); assert.equal(l[0].dados.v, 2);
  });
  test('fila vazia lista vazio', async () => assert.equal((await F.listar('ninguem')).length, 0));
});

describe('sincronizar', () => {
  test('envia cada tipo pela função certa e esvazia a fila', async () => {
    for (const [id, tipo] of [['f', 'ficha'], ['v', 'visita'], ['d', 'diagnostico'], ['a', 'avaliacao']]) await F.salvar({ id, dono: 'u', tipo, dados: { id } });
    const api = apiFalsa();
    const r = await F.sincronizar(api, 'u');
    assert.equal(r.enviados, 4);
    assert.deepEqual(api.chamadas.map(c => c[0]).sort(), ['avaliacao', 'diagnostico', 'ficha', 'visita']);
    assert.equal((await F.listar('u')).length, 0);
  });
  test('erro de regra: o item fica, marcado com a mensagem, e os outros seguem', async () => {
    await F.salvar({ id: 'ruim', dono: 'u', tipo: 'ficha', dados: { id: 'ruim' }, criado: 1 });
    await F.salvar({ id: 'bom', dono: 'u', tipo: 'ficha', dados: { id: 'bom' }, criado: 2 });
    const r = await F.sincronizar(apiFalsa({ ruim: erroRegra('Esta mulher já tem ficha no projeto.') }), 'u');
    assert.equal(r.enviados, 1);
    const l = await F.listar('u'); assert.equal(l.length, 1); assert.equal(l[0].erro, 'Esta mulher já tem ficha no projeto.'); assert.equal(l[0].reenviar, false);
  });
  test('item com erro não é reenviado sozinho, só quando marcado para reenviar', async () => {
    await F.salvar({ id: 'x', dono: 'u', tipo: 'ficha', dados: { id: 'x' }, erro: 'antes', reenviar: false });
    let api = apiFalsa(); await F.sincronizar(api, 'u'); assert.equal(api.chamadas.length, 0);
    await F.salvar({ id: 'x', dono: 'u', tipo: 'ficha', dados: { id: 'x' }, erro: 'antes', reenviar: true });
    api = apiFalsa(); const r = await F.sincronizar(api, 'u'); assert.equal(r.enviados, 1);
  });
  test('sem rede: para na hora e não marca erro (tenta depois)', async () => {
    await F.salvar({ id: 'a', dono: 'u', tipo: 'ficha', dados: { id: 'a' }, criado: 1 });
    await F.salvar({ id: 'b', dono: 'u', tipo: 'ficha', dados: { id: 'b' }, criado: 2 });
    const api = apiFalsa({ a: erroRede() });
    const r = await F.sincronizar(api, 'u');
    assert.equal(r.enviados, 0); assert.equal(api.chamadas.length, 1);   // nem tentou o segundo
    const l = await F.listar('u'); assert.equal(l.length, 2); assert.ok(l.every(x => !x.erro));
  });
  test('duas sincronizações ao mesmo tempo não enviam em dobro', async () => {
    await F.salvar({ id: 'a', dono: 'u', tipo: 'ficha', dados: { id: 'a' } });
    const api = apiFalsa();
    const [r1, r2] = await Promise.all([F.sincronizar(api, 'u'), F.sincronizar(api, 'u')]);
    assert.equal(r1.enviados + r2.enviados, 1); assert.equal(api.chamadas.length, 1);
    assert.equal(F.enviando, false);
  });
  test('depois de uma exceção inesperada a fila destrava (enviando volta a falso)', async () => {
    await F.salvar({ id: 'a', dono: 'u', tipo: 'ficha', dados: { id: 'a' } });
    const api = apiFalsa(); api.salvarFicha = async () => { throw new Error('qualquer'); };
    await F.sincronizar(api, 'u'); assert.equal(F.enviando, false);
  });
});

describe('novoId', () => {
  test('gera identificadores diferentes no formato UUID', () => {
    const { MQ } = carregar(['fila.js']);
    const a = MQ.novoId(), b = MQ.novoId();
    assert.notEqual(a, b); assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
