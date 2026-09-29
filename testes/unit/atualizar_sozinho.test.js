/* 29/09/2026: o que outra pessoa faz aparece sem recarregar a página (pendências, contadores). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const pausa = () => new Promise(r => setTimeout(r, 30));   // dados pessoais e conta chegam em seguida (assíncrono)
const pend = h => { const m = /Seu cadastro tem (\d+) pendência/.exec(texto(h)); return m ? +m[1] : 0; };

test('pendências da técnica diminuem quando a coordenação geral registra o termo em outra janela', async () => {
  const t = await montar('coord_tecnico'); const id = t.S.eu.id; const k = 'mq-demo-v4';
  let d = JSON.parse(t.janela.localStorage.getItem(k)); d.equipe.find(m => m.id === id).termo_assinado_em = null; t.janela.localStorage.setItem(k, JSON.stringify(d));
  await t.api.reler(); await t.MQ.ui.carregar(); t.aba(null); await pausa(); const antes = pend(t.aba(null));
  assert.ok(t.MQ.pendUI.lista().itens.some(i => i.id === 'termo'), 'começa com o termo pendente');
  // "outra janela": a geral registra o termo assinado
  d = JSON.parse(t.janela.localStorage.getItem(k)); d.equipe.find(m => m.id === id).termo_assinado_em = '2026-09-29'; t.janela.localStorage.setItem(k, JSON.stringify(d));
  assert.equal(pend(t.html()), antes, 'sem atualizar, a tela ainda mostra o número antigo');
  await t.MQ.ui.atualizar(true); await pausa();
  assert.ok(!t.MQ.pendUI.lista().itens.some(i => i.id === 'termo'), 'o termo sai da lista');
  assert.equal(pend(t.html()), antes - 1, 'o número na página cai sozinho');
});

test('sem digitação, redesenha com o que outra pessoa mudou', async () => {
  const t = await montar('coord_geral'); t.S.aba = 'equipe'; t.MQ.ui.render();
  const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); d.equipe[1].nome = d.equipe[1].nome + ' Novo'; t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d));
  const html0 = t.html(); await t.MQ.ui.atualizar(true);
  assert.notEqual(t.html(), html0);
});
