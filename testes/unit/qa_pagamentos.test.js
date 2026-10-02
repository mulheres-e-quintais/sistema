/* QA 01/10/2026 — js/pagamentos.js: aval da ajuda de custo com teto; limites de texto (protocolo do Arlo, justificativa). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const { FormDataFalso } = require('./ambiente');
const formFalso = (dataset = {}) => { const b = { textContent: 'x', disabled: false }; return { dataset, querySelector: s => /submit/.test(s) ? b : null, querySelectorAll: () => [], closest: () => null }; };
async function editarDemo(T, fn) { const ls = T.janela.localStorage; const d = JSON.parse(ls.getItem('mq-demo-v4')); fn(d); ls.setItem('mq-demo-v4', JSON.stringify(d)); await T.api.reler(); }

async function comSolicitacao(valor, nVisitas = 0) {
  const T = await montar('coord_tecnico'); const { MQ, S } = T; const hoje = MQ.regras.hoje();
  const ana = S.equipe.find(m => m.papel === 'articulacao' && m.uf === 'PI');
  await editarDemo(T, d => {
    d.solicitacoes = [{ id: 'sq1', tipo: 'ajuda_custo', equipe_id: ana.id, mes: hoje.slice(0, 8) + '01', situacao: 'solicitada', valor_solicitado: valor, valor_avalizado: null,
      detalhe: { visitas: Array.from({ length: nVisitas }, (_, i) => ({ id: 'vz' + i, etapa: 'diagnostico', total: valor / nVisitas })) }, solicitada_em: new Date().toISOString() }];
    d.solic_visitas = {}; });
  await T.trocar('coord_tecnico');
  return T;
}
async function avalizar(T, valorTxt) {
  let chamou = null, erros = null; T.S.api.avalizarPagamento = async (id, ok, obs, valor) => { chamou = valor; }; T.MQ.ui.carregar = async () => {};
  T.MQ.ui.mostrarErros = (f, e) => { erros = e; };
  await T.MQ.pagUI.enviar('pag-aval', formFalso({ id: 'sq1', ok: '1' }), new FormDataFalso({ valor: valorTxt, obs: '' }));
  return { chamou, erros };
}

test('aval de ajuda de custo muito acima do pedido (R$ 1.000.000 num pedido de R$ 356,50) é bloqueado com mensagem', async () => {
  const T = await comSolicitacao(356.5);
  for (const v of ['1.000.000,00', '21.400,00', '534,76']) {
    const r = await avalizar(T, v);
    assert.equal(r.chamou, null, v + ' chegou à API');
    assert.match(String(r.erros.valor).replace(/ /g, ' '), /^Valor muito acima do pedido \(R\$ 356,50\)\. Confira o valor\.$/);
  }
  // até 1,5 × o pedido passa (inclusive menor que o pedido e campo vazio)
  assert.equal((await avalizar(T, '534,75')).chamou, 534.75);
  assert.equal((await avalizar(T, '300')).chamou, 300);
  const vazio = await avalizar(T, ''); assert.equal(vazio.chamou, null); assert.equal(vazio.erros, null);
});
test('aval acima de R$ 2.000 por visita é bloqueado, mesmo dentro de 1,5 × o pedido', async () => {
  const T = await comSolicitacao(3000, 2);   // 2 visitas: teto de R$ 4.000,00
  assert.equal((await avalizar(T, '4.000,00')).chamou, 4000);
  const r = await avalizar(T, '4.000,01'); assert.equal(r.chamou, null); assert.match(r.erros.valor, /Valor muito acima do pedido/);
  // bolsa: a regra antiga continua (aval não passa do pedido)
  const B = await comSolicitacao(2200);
  await editarDemo(B, d => { d.solicitacoes[0].tipo = 'bolsa'; }); await B.trocar('coord_tecnico');
  const b = await avalizar(B, '2.200,01'); assert.equal(b.chamou, null); assert.match(b.erros.valor, /passa do valor pedido/);
  assert.equal((await avalizar(B, '2.200,00')).chamou, 2200);
});
test('protocolo do Arlo com mais de 60 caracteres é recusado com mensagem', async () => {
  const T = await montar('auxiliar'); let chamou = null, erros = null;
  T.S.api.registrarNoArlo = async (id, p) => { chamou = p; }; T.MQ.ui.carregar = async () => {}; T.MQ.ui.mostrarErros = (f, e) => { erros = e; };
  await T.MQ.pagUI.enviar('pag-arlo', formFalso({ id: 's1' }), new FormDataFalso({ protocolo: 'x'.repeat(61) }));
  assert.equal(chamou, null); assert.equal(erros.protocolo, 'Texto muito longo (máximo 60 caracteres).');
  await T.MQ.pagUI.enviar('pag-arlo', formFalso({ id: 's1' }), new FormDataFalso({ protocolo: ' ' + 'x'.repeat(60) + ' ' }));
  assert.equal(chamou, 'x'.repeat(60));
});
test('justificativa do pedido de bolsa (mês sem encontro) com mais de 2.000 caracteres é recusada', async () => {
  const T = await montar('professor'); let chamou = false, erros = null;
  T.S.api.solicitarPagamento = async () => { chamou = true; }; T.MQ.ui.carregar = async () => {}; T.MQ.ui.mostrarErros = (f, e) => { erros = e; };
  const mes = T.MQ.regras.hoje().slice(0, 7);
  await T.MQ.pagUI.enviar('pag-bolsa', formFalso({ mes }), new FormDataFalso({ relatorio: 'Aulas dadas e materiais preparados no mês. '.repeat(3), justificativa_sem_encontro: 'j'.repeat(2001) }));
  assert.equal(chamou, false); assert.equal(erros.justificativa_sem_encontro, 'Texto muito longo (máximo 2.000 caracteres).');
});
