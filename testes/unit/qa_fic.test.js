/* QA 01/10/2026 — js/fic.js: datas da turma e da matrícula dentro do projeto; nome da turma com até 120 caracteres. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const { FormDataFalso, diaMais } = require('./ambiente');
const formFalso = (dataset = {}) => { const b = { textContent: 'x', disabled: false }; return { dataset, querySelector: s => /submit/.test(s) ? b : null, querySelectorAll: () => [], closest: () => null }; };

async function salvarTurma(campos) {
  const T = await montar('professor'); let erros = null, salva = null;
  T.MQ.ui.mostrarErros = (f, e) => { erros = e; }; T.S.api.salvarTurma = async t => { salva = t; }; T.MQ.ui.carregar = async () => {};
  await T.MQ.ficUI.enviar('fic-turma', formFalso(), new FormDataFalso(Object.assign({ nome: 'Turma Piauí 1', uf: 'PI', inicio: '2026-11-03', fim: '2027-03-30' }, campos)));
  return { erros, salva };
}
test('turma: início e fim entre 01/01/2026 e 31/12/2027', async () => {
  let r = await salvarTurma({ inicio: '2025-12-31' }); assert.equal(r.salva, null); assert.match(r.erros.inicio, /entre 01\/01\/2026 e 31\/12\/2027/);
  r = await salvarTurma({ fim: '2028-01-01' }); assert.equal(r.salva, null); assert.match(r.erros.fim, /entre 01\/01\/2026 e 31\/12\/2027/);
  r = await salvarTurma({ inicio: '1026-11-03' }); assert.match(r.erros.inicio, /entre/);
  r = await salvarTurma({ fim: '2027-02-30' }); assert.match(r.erros.fim, /entre/);
  r = await salvarTurma({ inicio: '2026-01-01', fim: '2027-12-31' }); assert.equal(r.erros, null); assert.equal(r.salva.inicio, '2026-01-01'); assert.equal(r.salva.fim, '2027-12-31');
  // o fim continua não podendo ser antes do início
  r = await salvarTurma({ inicio: '2027-03-30', fim: '2026-11-03' }); assert.equal(r.salva, null); assert.equal(r.erros.fim, 'O fim é antes do início.');
  assert.equal((await salvarTurma({ inicio: '2026-11-03', fim: '2026-11-03' })).erros, null);
});
test('turma: nome com mais de 120 caracteres é recusado com mensagem', async () => {
  let r = await salvarTurma({ nome: 'T'.repeat(121) }); assert.equal(r.salva, null); assert.equal(r.erros.nome, 'Texto muito longo (máximo 120 caracteres).');
  r = await salvarTurma({ nome: 'T'.repeat(120) }); assert.equal(r.erros, null); assert.equal(r.salva.nome.length, 120);
});
async function matricular(data) {
  const T = await montar('professor'); let erros = null, chamou = 0;
  T.MQ.ui.mostrarErros = (f, e) => { erros = e; }; T.S.api.matricular = async () => { chamou++; }; T.MQ.ui.carregar = async () => {};
  await T.MQ.ficUI.enviar('fic-matricular', formFalso({ id: 'turma-x' }), new FormDataFalso({ data, p: ['pessoa-x'], 'n_pessoa-x': '20261234' }));
  return { erros, chamou };
}
test('matrícula: data antes de 2026, no futuro ou que não existe é recusada', async () => {
  let r = await matricular('2025-12-31'); assert.equal(r.chamou, 0); assert.match(r.erros.data, /antes de 2026/);
  r = await matricular(diaMais(1)); assert.equal(r.chamou, 0); assert.match(r.erros.data, /futuro/);
  r = await matricular('2026-02-30'); assert.equal(r.chamou, 0); assert.match(r.erros.data, /inválida/);
  r = await matricular(diaMais(0)); assert.equal(r.erros, null); assert.equal(r.chamou, 1);
  r = await matricular('2026-01-01'); assert.equal(r.erros, null); assert.equal(r.chamou, 1);
});
