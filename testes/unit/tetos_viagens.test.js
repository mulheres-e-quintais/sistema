/* 29/09/2026: tetos de gasto: eventos R$ 6.000 por estado; passagens R$ 70.000 no projeto (35_tetos_passagens_eventos.sql). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { diaMais } = require('./ambiente');

const pass = v => ({ valor_estimado: v, finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] });
async function autorizado(t, tipo, valor, ajuste) {
  await t.trocar('bolsista'); const id = await t.api.salvarPedido(null, tipo, 'Pedido de teste', diaMais(60), tipo === 'evento' ? { valor_estimado: valor, local: 'Sede' } : pass(valor));
  await t.trocar('coord_tecnico'); await t.api.moverPedido(id, 'conferir');
  await t.trocar('coord_geral'); if (ajuste) await t.api.definirValorPedido(id, ajuste);
  await t.api.moverPedido(id, 'autorizar'); return id;
}
test('pedido sem valor estimado é recusado', async () => {
  const t = await montar('bolsista');
  await assert.rejects(t.api.salvarPedido(null, 'evento', 'Evento sem valor', diaMais(60), { local: 'Sede' }), /valor estimado/);
});
test('evento: R$ 5.000 autoriza; o segundo de R$ 1.500 passa do teto do estado; ajustado para R$ 1.000 autoriza', async () => {
  const t = await montar('bolsista');
  await autorizado(t, 'evento', 5000);
  await t.trocar('bolsista'); const id = await t.api.salvarPedido(null, 'evento', 'Segundo evento', diaMais(61), { valor_estimado: 1500, local: 'Sede' });
  await t.trocar('coord_tecnico'); await t.api.moverPedido(id, 'conferir');
  await t.trocar('coord_geral'); await assert.rejects(t.api.moverPedido(id, 'autorizar'), /teto de eventos/);
  await t.api.definirValorPedido(id, 1000); await t.api.moverPedido(id, 'autorizar');
  const sd = await t.api.saldoPedidos(); assert.equal(sd.evento_usado.PI, 6000);
});
test('passagens: teto de R$ 70.000 no projeto', async () => {
  const t = await montar('bolsista');
  await autorizado(t, 'passagem', 69000);
  await t.trocar('bolsista'); const id = await t.api.salvarPedido(null, 'passagem', 'Outra viagem', diaMais(60), pass(1500));
  await t.trocar('coord_tecnico'); await t.api.moverPedido(id, 'conferir');
  await t.trocar('coord_geral'); await assert.rejects(t.api.moverPedido(id, 'autorizar'), /teto de passagens/);
});
test('telas: formulário pede o valor e mostra o saldo; aba da coordenação mostra os tetos; autorizar tem o campo de valor', async () => {
  const t = await montar('bolsista');
  const f = texto(t.painel({ tipo: 'viag-nova', t: 'evento' }));
  assert.ok(f.includes('Valor estimado (R$)')); assert.ok(/Teto de eventos de PI: R\$\s?6\.000,00/.test(f));
  assert.ok(/Teto de passagens do projeto: R\$\s?70\.000,00/.test(texto(t.painel({ tipo: 'viag-nova', t: 'passagem' }))));
  const id = await t.api.salvarPedido(null, 'evento', 'Encontro com valor', diaMais(60), { valor_estimado: 1234.5, local: 'Sede' });
  await t.trocar('coord_tecnico'); await t.api.moverPedido(id, 'conferir');
  await t.trocar('coord_geral');
  assert.ok(texto(t.aba('viagens')).includes('Tetos de gasto'));
  const h = t.painel({ tipo: 'viag-ver', id }); assert.ok(/name="valor" inputmode="decimal" value="1234,5"/.test(h)); assert.ok(texto(h).includes('Valor estimado'));
});
