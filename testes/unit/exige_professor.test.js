/* 29/09/2026: técnica, bolsistas e agentes só se cadastram com professor do FIC ativo e habilitado (33_exige_professor_fic.sql). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { cpfValido } = require('./ambiente');

async function semProfessorHabilitado(t) {
  const k = 'mq-demo-v4'; const d = JSON.parse(t.janela.localStorage.getItem(k));
  d.equipe.filter(m => m.papel === 'professor_fic').forEach(m => { m.termo_assinado_em = null; });
  t.janela.localStorage.setItem(k, JSON.stringify(d)); await t.api.reler(); await t.MQ.ui.carregar();
}
test('sem professor habilitado: não cadastra agente nem gera link; a tela explica', async () => {
  const t = await montar('coord_geral'); await semProfessorHabilitado(t);
  await assert.rejects(t.api.criar({ papel: 'agente', uf: 'PE', nome: 'Fulana Agente Teste', cpf: cpfValido(812345671), email: 'fa@t.com', telefone: '(84) 99999-0000', data_inicio: '2026-10-01', consentimento_lgpd: true }), /professor do FIC/);
  await assert.rejects(t.api.criarConvite('agente', 'PE', null), /professor do FIC/);
  const h = texto(t.painel({ tipo: 'cadastro', papel: 'agente', uf: 'PE' }));
  assert.ok(h.includes('Ainda não dá para cadastrar')); assert.ok(h.includes('falta registrar o cadastro no Arlo e o termo'));
  assert.ok(texto(t.aba('equipe')).includes('Cadastre e habilite primeiro um professor do FIC'));
});
test('professor e auxiliar continuam podendo ser cadastrados; com professor habilitado, o resto libera', async () => {
  const t = await montar('coord_geral'); await semProfessorHabilitado(t);
  assert.ok(!texto(t.painel({ tipo: 'cadastro', papel: 'professor_fic', modo: 'manual' })).includes('Ainda não dá para cadastrar'));
  const t2 = await montar('coord_geral');
  assert.ok(!texto(t2.painel({ tipo: 'cadastro', papel: 'agente', uf: 'PE' })).includes('Ainda não dá para cadastrar'));
  assert.ok(!texto(t2.aba('equipe')).includes('Cadastre e habilite primeiro'));
});
