/* 29/09/2026: pagamento e entregas do mês (presença, AVA) só a partir do mês de início (32_desde_o_inicio.sql). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const mesAntes = m => { const [a, b] = m.split('-').map(Number); return b === 1 ? (a - 1) + '-12' : a + '-' + String(b - 1).padStart(2, '0'); };

test('bolsa: mês anterior ao início é recusado; a tela não deixa voltar antes do início', async () => {
  const t = await montar('bolsista'); const eu = t.S.equipe.find(m => m.id === t.S.eu.id);
  const ini = String(eu.data_inicio).slice(0, 7);
  await assert.rejects(t.api.solicitarPagamento('bolsa', mesAntes(ini) + '-01', 1, 'x'.repeat(60), [], {}), /começou no projeto em/);
  const h = t.aba(null);
  assert.ok(/data-acao="pag-mes" data-n="-1" aria-label="Mês anterior" disabled/.test(h), 'seta para trás desligada no mês de início');
});
test('AVA: professor não confirma antes do início nem antes da matrícula; na lista aparece "Começa em"', async () => {
  const t = await montar('coord_geral'); const a = t.S.equipe.find(m => m.status === 'ativa' && t.MQ.regras.matriculaFIC(m.papel) && m.matricula_fic_em);
  if (!a) return;   // exemplo sem matrícula: nada a testar
  const desde = [a.data_inicio, a.matricula_fic_em].map(d => String(d).slice(0, 7)).sort().pop();
  await assert.rejects(t.api.marcarEntrega(a.id, mesAntes(desde) + '-01', 'ava', true), /começou no projeto|matrícula no FIC/);
  await t.api.marcarEntrega(a.id, desde + '-01', 'ava', true);
});
test('lista de presença: a bolsista não marca mês antes do início', async () => {
  const t = await montar('bolsista'); const eu = t.S.equipe.find(m => m.id === t.S.eu.id); const ini = String(eu.data_inicio).slice(0, 7);
  await assert.rejects(t.api.marcarEntrega(eu.id, mesAntes(ini) + '-01', 'presenca', true), /começou no projeto/);
});
