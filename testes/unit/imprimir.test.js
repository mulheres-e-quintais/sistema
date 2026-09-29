/* Formulário em branco para aplicar no papel (js/imprimir.js): só para quem preenche, sai sempre em branco,
   campos escondidos na tela também vão para o papel, e a localização registrada não vaza. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');

describe('Imprimir formulário em branco', () => {
  test('quem vê a opção: ficha só bolsista; campo, bolsista e agente', async () => {
    const t = await montar('bolsista'); const I = t.MQ.imprimirUI;
    assert.equal(I.pode('ficha'), true); assert.equal(I.pode('diag'), true); assert.equal(I.pode('aval'), true); assert.equal(I.pode('visita-feita'), true);
    for (const p of ['coord_geral', 'coord_tecnico', 'professor', 'auxiliar']) {
      await t.trocar(p); for (const k of ['ficha', 'diag', 'aval', 'visita-feita']) assert.equal(I.pode(k), false, p + ' ' + k);
    }
    await t.trocar('agente'); assert.equal(I.pode('ficha'), false); assert.equal(I.pode('diag'), true);
  });
  test('formulário que não é questionário de campo não tem a opção', async () => {
    const t = await montar('bolsista'); for (const k of ['pag-bolsa', 'viag-salvar', 'cadastro', 'trocar-senha']) assert.equal(t.MQ.imprimirUI.pode(k), false, k);
  });
  test('a barra só aparece no formulário de quem preenche', async () => {
    const t = await montar('bolsista'); const I = t.MQ.imprimirUI;
    assert.match(I.barra({ dataset: { form: 'ficha' } }), /data-acao="imp-form" data-t="ficha"/);
    assert.equal(I.barra({ dataset: { form: 'pag-bolsa' } }), '');
    await t.trocar('coord_tecnico'); assert.equal(I.barra({ dataset: { form: 'ficha' } }), '');
  });
});
