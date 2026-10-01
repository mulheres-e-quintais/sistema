/* 30/09/2026: lembrete no topo de cada perfil: prazo da pessoa > data com roda de conversa > número do projeto. Sem frase genérica. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const fixar = (t, dia) => { t.MQ.regras.hoje = () => dia; };

test('datas: todas oficiais, com dia válido e sugestão de roda; a próxima em 30/09/2026 é o Dia das Mulheres Rurais', async () => {
  const t = await montar('bolsista'); const L = t.MQ.lembreteUI;
  for (const d of L.DATAS) { assert.match(d.md, /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/); assert.ok(d.roda.length > 20, d.nome); }
  fixar(t, '2026-09-30'); const p = L.proximaData('2026-09-30');
  assert.equal(p.dia, '2026-10-15'); assert.equal(p.n, 15); assert.match(p.nome, /Mulheres Rurais/);
  fixar(t, '2026-08-01'); assert.equal(L.proximaData('2026-08-01'), null, 'nada nas próximas 3 semanas');
  fixar(t, '2027-09-20'); assert.equal(L.proximaData('2027-09-20').dia, '2027-09-21');
  fixar(t, '2027-09-29'); assert.equal(L.proximaData('2027-09-29'), null, 'depois do fim do projeto não sugere');
});

test('bolsista vê a data com sugestão de roda; coordenação geral não', async () => {
  const t = await montar('bolsista'); fixar(t, '2026-09-30');
  const q = texto(t.MQ.lembreteUI.quadro());
  assert.match(q, /15\/10 · Dia Internacional das Mulheres Rurais \(faltam 15 dias\)/);
  assert.match(q, /Sugestão de roda de conversa: O que o quintal já mudou/); assert.match(t.MQ.lembreteUI.quadro(), /<details>/, "sugestão recolhida: não empurra os atalhos");
  assert.ok(texto(t.aba()).includes('Dia Internacional das Mulheres Rurais'), 'aparece na tela da bolsista');
  const g = await montar('coord_geral'); fixar(g, '2026-09-30');
  assert.ok(!g.MQ.lembreteUI.itens().some(i => i.data), 'a coordenação geral não recebe sugestão de roda');
});

test('tema delicado vem com o cuidado; coordenação técnica recebe como sugestão para as bolsistas', async () => {
  const t = await montar('coord_tecnico'); fixar(t, '2026-11-20');
  const q = texto(t.MQ.lembreteUI.quadro());
  assert.match(q, /25\/11 · Dia Internacional pela Eliminação da Violência contra a Mulher/);
  assert.match(q, /Sugestão para as bolsistas levarem às comunidades/);
  assert.match(q, /combine antes com a coordenação técnica e convide alguém da rede de proteção/);
});

test('prazo vem antes da data: coordenação geral vê o prazo da indicação do MPA enquanto a equipe não está completa', async () => {
  const t = await montar('coord_geral'); fixar(t, '2026-09-30');
  const it = t.MQ.lembreteUI.itens();
  assert.equal(it[0].id, 'indicacao'); assert.match(texto(it[0].t), /09\/10\/2026 \(faltam 9 dias\)/);
  fixar(t, '2026-10-20'); assert.ok(!t.MQ.lembreteUI.itens().some(i => i.id === 'indicacao'), 'passado o prazo, some');
});

test('"Entendi" esconde aquele lembrete e no máximo duas linhas aparecem', async () => {
  const t = await montar('bolsista'); fixar(t, '2026-10-10');
  const antes = t.MQ.lembreteUI.itens(); assert.ok(antes.length >= 1 && antes.length <= 2);
  const d = antes.find(i => i.data); assert.ok(d);
  t.MQ.lembreteUI.dispensar(d.id); assert.ok(!t.MQ.lembreteUI.itens().some(i => i.id === d.id));
});

test('coordenação: sem faixa de lembrete na visão geral (os prazos já estão no painel) nem nas outras abas; a técnica vê na primeira aba', async () => {
  const t = await montar('coord_geral'); fixar(t, '2026-09-30');
  assert.ok(!t.aba('visao').includes('class="lembrete"'));
  assert.ok(!t.aba('equipe').includes('class="lembrete"'));
  const tec = await montar('coord_tecnico'); fixar(tec, '2026-09-30'); assert.ok(tec.aba('selecao').includes('class="lembrete"'), 'técnica: lembrete na primeira aba');
});

test('sem prazo e sem data: número real do projeto ou nada (nunca frase genérica)', async () => {
  const t = await montar('professor'); fixar(t, '2026-08-01');
  const it = t.MQ.lembreteUI.itens();
  assert.ok(it.length <= 1); if (it.length) assert.ok(it[0].num && /\d/.test(texto(it[0].t)));
});
