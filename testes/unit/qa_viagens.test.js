/* QA 01/10/2026 — js/viagens.js: rótulos ligados aos campos, valor negativo, nascimento, participantes, passagem sem passageira, justificativa longa. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const { FormDataFalso, diaMais, cpfValido } = require('./ambiente');
const formFalso = (dataset = {}) => { const b = { textContent: 'x', disabled: false }; return { dataset, querySelector: s => /submit/.test(s) ? b : null, querySelectorAll: () => [], closest: () => null }; };

const pass = (o = {}) => Object.assign({ ps_nome: 'Maria da Silva', ps_cpf: cpfValido(321654987), ps_nasc: '1980-01-01', ps_rg: '123', ps_org: 'SSP/PI', ps_sexo: 'F', ps_cel: '(89) 99999-0000', ps_email: 'm@x.com', ps_end: '' }, o);
const passagem = (o = {}) => Object.assign({ finalidade: 'intercambio', origem: 'Teresina', destino: 'Natal', volta: diaMais(65), bagagem: 'mao' }, pass(), o);
const evento = (o = {}) => Object.assign({ local: 'Praça da matriz', hora: '08:00', p_mulheres: '30', est_tenda: 'on', resp_nome: 'Ana Souza', resp_cel: '(89) 99999-0000' }, o);
const validar = (V, tipo, campos, just = '') => V.validar(tipo, 'Intercâmbio de sementes', diaMais(60), just, V.lerForm(tipo, new FormDataFalso(campos)));

test('cada rótulo da passageira aponta para o seu campo (label for = id), com ids únicos entre passageiras', async () => {
  const { MQ } = await montar('bolsista'); const V = MQ.viagUI;
  const h = V.passBloco(0, {}) + V.passBloco(1, {});
  const ids = [...h.matchAll(/<(?:input|select) id="([^"]+)" name="(ps_[a-z]+)"/g)].map(m => [m[1], m[2]]);
  const fors = [...h.matchAll(/<label for="([^"]+)">/g)].map(m => m[1]);
  assert.equal(ids.length, 18, '9 campos por passageira'); assert.equal(fors.length, 18);
  assert.equal(new Set(ids.map(x => x[0])).size, 18, 'ids repetidos');
  assert.deepEqual(fors, ids.map(x => x[0]));
  assert.deepEqual([...new Set(ids.map(x => x[1]))].sort(), ['ps_cel', 'ps_cpf', 'ps_email', 'ps_end', 'ps_nasc', 'ps_nome', 'ps_org', 'ps_rg', 'ps_sexo']);
  assert.doesNotMatch(h, /<label>/);
});
test('valor estimado "-500" não vira +500: é recusado com mensagem e nada é enviado', async () => {
  const T = await montar('bolsista'); const { MQ, S } = T; let enviado = false, erros = null;
  assert.equal(MQ.viagUI.valorBR('-500'), -500); assert.equal(MQ.viagUI.valorBR('R$ -1.500,00'), -1500); assert.equal(MQ.viagUI.valorBR('(500)'), -500);
  assert.equal(MQ.viagUI.valorBR('R$ 1.500,00'), 1500); assert.equal(MQ.viagUI.valorBR('abc'), null);
  S.api.salvarPedido = async () => { enviado = true; return 'x'; }; MQ.ui.mostrarErros = (f, e) => { erros = e; };
  await MQ.viagUI.enviar('viag-salvar', formFalso({ t: 'evento' }), new FormDataFalso(Object.assign(evento(), { titulo: 'Feira de sementes', data_ref: diaMais(60), valor_estimado: '-500' })));
  assert.equal(enviado, false); assert.equal(erros.valor_estimado, 'O valor não pode ser negativo.');
});
test('nascimento da passageira: futuro, antes de 1900 e data que não existe são recusados', async () => {
  const { MQ } = await montar('bolsista'); const V = MQ.viagUI;
  const erro = nasc => ((validar(V, 'passagem', passagem({ ps_nasc: nasc }))._pass || []).find(x => x[1] === 'ps_nasc') || [])[2];
  assert.match(erro(diaMais(1)), /não pode ser no futuro/);
  assert.match(erro('1899-12-31'), /inválida/); assert.match(erro('1800-05-05'), /inválida/);
  assert.match(erro('1990-02-30'), /inválida/); assert.match(erro('30/02/1990'), /inválida/);
  assert.equal(erro(''), 'Informe a data.');
  assert.equal(erro('1980-01-01'), undefined); assert.equal(erro('1900-01-01'), undefined); assert.equal(erro(diaMais(0)), undefined);
});
test('evento: participantes negativos são recusados com mensagem (antes viravam 0 em silêncio)', async () => {
  const { MQ } = await montar('bolsista'); const V = MQ.viagUI;
  let e = validar(V, 'evento', evento({ p_mulheres: '30', p_equipe: '-5' }));
  assert.equal(e.p_equipe, 'Não pode ser negativo.');
  e = validar(V, 'evento', evento({ p_mulheres: '-30' })); assert.equal(e.p_mulheres, 'Não pode ser negativo.');
  e = validar(V, 'evento', evento({ cadeiras: '-10', almoco: '-1', servico: 'entrega' })); assert.equal(e.cadeiras, 'Não pode ser negativo.'); assert.equal(e.almoco, 'Não pode ser negativo.');
});
test('evento: participantes entre 1 e 5.000 no total', async () => {
  const { MQ } = await montar('bolsista'); const V = MQ.viagUI;
  assert.equal(validar(V, 'evento', evento({ p_mulheres: '0' })).p_mulheres, 'Quantas pessoas?');
  assert.match(validar(V, 'evento', evento({ p_mulheres: '5001' })).p_mulheres, /de 1 a 5\.000/);
  assert.match(validar(V, 'evento', evento({ p_mulheres: '4000', p_equipe: '600', p_convidados: '401' })).p_mulheres, /de 1 a 5\.000/);
  assert.deepEqual(Object.keys(validar(V, 'evento', evento({ p_mulheres: '5000' }))), []);
  assert.deepEqual(Object.keys(validar(V, 'evento', evento({ p_mulheres: '1' }))), []);
});
test('passagem sem nenhuma passageira é recusada na tela', async () => {
  const { MQ } = await montar('bolsista'); const V = MQ.viagUI;
  const e = validar(V, 'passagem', { finalidade: 'intercambio', origem: 'Teresina', destino: 'Natal', volta: diaMais(65), bagagem: 'mao' });
  assert.equal(e._geral, 'Inclua pelo menos uma passageira ou passageiro.');
  assert.deepEqual(Object.keys(validar(V, 'passagem', passagem())), [], 'com uma passageira completa passa');
});
test('justificativa do pedido com mais de 2.000 caracteres é recusada com mensagem', async () => {
  const { MQ } = await montar('bolsista'); const V = MQ.viagUI;
  assert.equal(validar(V, 'evento', evento(), 'j'.repeat(2001)).justificativa, 'Texto muito longo (máximo 2.000 caracteres).');
  assert.equal(validar(V, 'evento', evento(), 'j'.repeat(2000)).justificativa, undefined);
});
