/* QA 01/10/2026 — js/convites.js: "Copiar link" sem área de transferência; nascimento inválido no cadastro pelo link. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');

test('"Copiar link" com a área de transferência negada: seleciona o link e avisa (sem "Cannot read properties of null")', async () => {
  const T = await montar('coord_geral'); const avisos = []; T.MQ.ui.toast = m => avisos.push(m);
  T.janela.navigator.clipboard = { writeText: async () => { throw new Error('NotAllowedError'); } };
  let selecionou = 0; const campo = { focus() {}, select() { selecionou++; } };
  // na tela, o botão fica em .conv-botoes e o campo do link em .conv-url (irmãos): o pai do botão não tem input
  const caixa = { querySelector: sel => /conv-url input/.test(sel) ? campo : null };
  const el = { dataset: { url: 'https://exemplo.test/#convite=abc' }, parentElement: { querySelector: () => null }, closest: sel => sel === '.conv-pronto' ? caixa : null };
  await T.MQ.convitesUI.clique('conv-copiar', el);
  assert.equal(selecionou, 1); assert.deepEqual(avisos, ['Não deu para copiar. Selecione o link e copie.']);
  // com permissão continua copiando
  let copiado = null; T.janela.navigator.clipboard = { writeText: async t => { copiado = t; } };
  await T.MQ.convitesUI.clique('conv-copiar', el);
  assert.equal(copiado, 'https://exemplo.test/#convite=abc'); assert.equal(avisos[1], 'Link copiado.');
});
test('"Copiar link" em navegador sem área de transferência e sem o campo na tela: só avisa, não quebra', async () => {
  const T = await montar('coord_geral'); const avisos = []; T.MQ.ui.toast = m => avisos.push(m);
  const el = { dataset: { url: 'u' }, parentElement: { querySelector: () => null }, closest: () => null };
  await assert.doesNotReject(() => T.MQ.convitesUI.clique('conv-copiar', el));
  assert.deepEqual(avisos, ['Não deu para copiar. Selecione o link e copie.']);
});
test('validarPessoais: nascimento que não existe (30/02) ou de 1800 é recusado', async () => {
  const { MQ } = await montar('coord_geral'); const C = MQ.convitesUI;
  const pub = o => Object.assign({ _arlo_resp: 'nao', cadastro_arlo: false, data_nascimento: '1985-03-10', endereco: {}, perfil: null }, o);
  for (const d of ['1990-02-30', '1991-02-29', '1990-13-01', '1800-01-01', '1899-12-31', '30/02/1990'])
    assert.equal(C.validarPessoais(pub({ data_nascimento: d }), true).data_nascimento, 'Data de nascimento inválida.', d);
  for (const d of ['1985-03-10', '1992-02-29', '1900-01-01']) assert.equal(C.validarPessoais(pub({ data_nascimento: d }), true).data_nascimento, undefined, d);
});
