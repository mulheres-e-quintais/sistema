/* 30/09/2026: quem marcou que já tem cadastro no Arlo não vê nem recebe pedido de conta bancária. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

test('auxiliar: pessoa com Arlo não mostra "Conta para o cadastro no Arlo"; sem Arlo, mostra', async () => {
  const t = await montar('auxiliar');
  const alvo = t.S.equipe.find(m => m.status === 'ativa' && m.papel !== 'coord_geral' && m.id !== t.S.eu.id);
  alvo.cadastro_arlo = true;
  let h = texto(t.painel({ tipo: 'detalhe', id: alvo.id }));
  assert.ok(!h.includes('Conta para o cadastro no Arlo'), 'com Arlo: sem o bloco');
  assert.ok(!h.includes('ainda não informou a conta')); assert.match(h, /Cadastro no Arlo\s*Sim/);
  alvo.cadastro_arlo = false; t.MQ.ui.fecharPainel();
  h = texto(t.painel({ tipo: 'detalhe', id: alvo.id }));
  assert.ok(h.includes('Conta para o cadastro no Arlo'), 'sem Arlo: o bloco aparece');
});

test('a própria pessoa com Arlo não vê "Dados bancários para a FUNCERN"', async () => {
  const t = await montar('professor'); const eu = t.S.equipe.find(m => m.id === t.S.eu.id);
  eu.cadastro_arlo = true; t.S.eu.cadastro_arlo = true;
  const h = t.painel({ tipo: 'meus-dados' });
  assert.ok(!/data-banco-meu/.test(h), 'sem a seção de conta bancária');
});
