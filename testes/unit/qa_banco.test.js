/* QA 01/10/2026 — js/banco.js: Pix celular, agência e conta só com zeros, tamanho da chave Pix. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const { FormDataFalso } = require('./ambiente');
const formFalso = () => { const b = { textContent: 'x', disabled: false }; return { dataset: {}, querySelector: s => /submit/.test(s) ? b : null, querySelectorAll: () => [], closest: () => null }; };
const conta = (o = {}) => Object.assign({ banco: '001', agencia: '1234', agencia_dv: '', conta: '56789', conta_dv: '0', tipo_conta: 'corrente', pix_tipo: '', pix_chave: '' }, o);
async function salvar(campos) {
  const T = await montar('bolsista'); let erros = null, salvo = null;
  T.MQ.ui.mostrarErros = (f, e) => { erros = e; }; T.S.api.salvarMeusDadosBancarios = async d => { salvo = d; };
  await T.MQ.bancoUI.enviar('banco', formFalso(), new FormDataFalso(conta(campos)));
  return { erros, salvo };
}

test('Pix celular: "abc" e "8999" são recusados (antes: salvava vazio / aceitava)', async () => {
  for (const c of ['abc', '8999', '999990000', '849999900001234']) {
    const r = await salvar({ pix_tipo: 'celular', pix_chave: c });
    assert.equal(r.salvo, null, c); assert.match(r.erros.pix_chave, /Celular inválido/, c);
  }
});
test('Pix celular com 10 ou 11 dígitos é salvo só com os números (aceita +55 na frente)', async () => {
  assert.equal((await salvar({ pix_tipo: 'celular', pix_chave: '(84) 99999-0000' })).salvo.pix_chave, '84999990000');
  assert.equal((await salvar({ pix_tipo: 'celular', pix_chave: '84 3333-0000' })).salvo.pix_chave, '8433330000');
  assert.equal((await salvar({ pix_tipo: 'celular', pix_chave: '+55 (84) 99999-0000' })).salvo.pix_chave, '84999990000');
});
test('agência "0000" e conta "0" são recusadas', async () => {
  let r = await salvar({ agencia: '0000' }); assert.equal(r.salvo, null); assert.match(r.erros.agencia, /só zeros/);
  r = await salvar({ conta: '0' }); assert.equal(r.salvo, null); assert.match(r.erros.conta, /só zeros/);
  r = await salvar({ conta: '000000' }); assert.match(r.erros.conta, /só zeros/);
  r = await salvar({ agencia: '0001', conta: '10' }); assert.equal(r.erros, null); assert.equal(r.salvo.agencia, '0001');
});
test('chave Pix: obrigatória para o tipo escolhido e com no máximo 140 caracteres', async () => {
  let r = await salvar({ pix_tipo: 'aleatoria', pix_chave: '' }); assert.equal(r.salvo, null); assert.equal(r.erros.pix_chave, 'Informe a chave.');
  r = await salvar({ pix_tipo: 'aleatoria', pix_chave: 'k'.repeat(141) }); assert.equal(r.salvo, null); assert.equal(r.erros.pix_chave, 'Texto muito longo (máximo 140 caracteres).');
  r = await salvar({ pix_tipo: 'aleatoria', pix_chave: 'k'.repeat(140) }); assert.equal(r.erros, null); assert.equal(r.salvo.pix_chave.length, 140);
  r = await salvar({ pix_tipo: '', pix_chave: 'sobra' }); assert.equal(r.salvo.pix_chave, null);
});
