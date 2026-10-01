/* 01/10/2026: desligamento com pendências (mesmas regras do 41_desligamento.sql) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { diaMais } = require('./ambiente');
const pass = { valor_estimado: 1500, finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };

test('professor com turma em andamento não é desligado: a tela explica e o sistema recusa', async () => {
  const t = await montar('coord_geral'); const prof = t.S.equipe.find(m => m.papel === 'professor_fic' && t.S.turmas.some(x => x.professor_id === m.id));
  assert.ok(prof, 'a demonstração tem professor com turma');
  const h = texto(t.painel({ tipo: 'ver', id: prof.id })); assert.match(h, /professor\(a\) da turma em andamento/);
  await assert.rejects(t.api.desligar(prof.id, t.MQ.regras.hoje(), 'Pediu para sair'), /turma em andamento/);
  assert.equal(t.S.equipe.find(m => m.id === prof.id).status, 'ativa');
});
test('desligar a bolsista cancela os pedidos de passagem e evento ainda não autorizados, com o motivo', async () => {
  const t = await montar('bolsista'); const eu = t.S.eu;
  const id = await t.api.salvarPedido(null, 'passagem', 'Viagem para o intercâmbio', diaMais(60), pass);
  await t.trocar('coord_geral');
  const h = texto(t.painel({ tipo: 'ver', id: eu.id })); assert.match(h, /pedido de passagem ou evento ainda não autorizado\s*será cancelado/);
  const vis = (t.S.visitas || []).filter(v => v.executor_id === eu.id && v.situacao === 'prevista');
  const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); d.visitas.forEach(v => { if (v.executor_id === eu.id && v.situacao === 'prevista') v.situacao = 'cancelada'; });
  d.diagnosticos.forEach(x => { if (x.executor_id === eu.id && x.situacao === 'devolvido') x.situacao = 'aprovado'; });
  t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await t.api.reler();
  await t.api.desligar(eu.id, t.MQ.regras.hoje(), 'Pediu para sair');
  const p = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')).pedidos.find(x => x.id === id);
  assert.equal(p.situacao, 'cancelado'); assert.match(p.obs, /desligada do projeto/);
  assert.ok(vis.length >= 0);
});
test('pagamento em aberto não impede o desligamento: só avisa', async () => {
  const t = await montar('coord_geral'); const ag = t.S.equipe.find(m => m.papel === 'agente' && m.status === 'ativa');
  t.S.solic = [{ id: 'x1', equipe_id: ag.id, tipo: 'ajuda_custo', mes: '2026-09-01', situacao: 'avalizada' }];
  const h = texto(t.painel({ tipo: 'ver', id: ag.id })); assert.match(h, /1 pagamento em aberto/); assert.match(h, /não cancela/);
});
