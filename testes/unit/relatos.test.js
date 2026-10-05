/* Relatar problema (05/10/2026): qualquer pessoa da equipe relata; a coordenação geral lê tudo e resolve; cada um lê os seus.
   As mesmas regras estão no banco (55_relatos_problema.sql, conferidas em supabase/tests/test_relatos.sql). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const bom = { texto: 'O botão de salvar a ficha não respondeu', tela: 'Campo', versao: 'mq-v250', aparelho: 'Android 14 · 390x800' };

describe('relatar problema', () => {
  test('bolsista relata; o relato guarda quem, o perfil, a tela e a versão', async () => {
    const T = await montar('bolsista'); const id = await T.api.relatarProblema(Object.assign({}, bom, { texto: '  O botão   de salvar a ficha não respondeu  ' })); assert.ok(id);
    const l = await T.api.listarRelatos(); assert.equal(l.length, 1); assert.equal(l[0].texto, bom.texto); assert.equal(l[0].tela, 'Campo'); assert.equal(l[0].versao, 'mq-v250'); assert.equal(l[0].status, 'aberto'); assert.equal(l[0].meu, true);
  });
  test('texto curto, vazio ou longo demais é recusado', async () => {
    const T = await montar('bolsista');
    for (const t of ['', '   ', 'travou', 'a'.repeat(1001)]) await assert.rejects(T.api.relatarProblema(Object.assign({}, bom, { texto: t })), /detalhe|1000/);
    assert.equal((await T.api.listarRelatos()).length, 0);
  });
  test('contexto longo é cortado, não recusado', async () => {
    const T = await montar('bolsista'); await T.api.relatarProblema({ texto: bom.texto, tela: 't'.repeat(200), versao: 'v'.repeat(200), aparelho: 'a'.repeat(900) });
    const r = (await T.api.listarRelatos())[0]; assert.equal(r.tela.length, 60); assert.equal(r.versao.length, 20); assert.equal(r.aparelho.length, 200);
  });
  test('cada pessoa vê só os seus; a coordenação geral vê todos, com o nome', async () => {
    const T = await montar('bolsista'); await T.api.relatarProblema(bom);
    await T.trocar('agente'); await T.api.relatarProblema(Object.assign({}, bom, { texto: 'A visita não apareceu na minha lista' }));
    assert.equal((await T.api.listarRelatos()).length, 1);
    await T.trocar('coord_geral'); const l = await T.api.listarRelatos(); assert.equal(l.length, 2); assert.ok(l.every(x => x.autor));
  });
  test('só a coordenação geral marca como resolvido; resolvido vai para o fim; dá para reabrir', async () => {
    const T = await montar('bolsista'); await T.api.relatarProblema(bom); await T.api.relatarProblema(Object.assign({}, bom, { texto: 'Segundo relato, de outra coisa' }));
    const id = (await T.api.listarRelatos())[0].id;
    await assert.rejects(T.api.resolverRelato(id, 'ok', false), /coordenação geral/);
    await T.trocar('coord_tecnico'); await assert.rejects(T.api.resolverRelato(id, 'ok', false), /coordenação geral/);
    await T.trocar('coord_geral'); await assert.rejects(T.api.resolverRelato(id, 'n'.repeat(401), false), /400/); await assert.rejects(T.api.resolverRelato('nao-existe', 'x', false), /não encontrado/);
    await T.api.resolverRelato(id, 'Corrigido na versão 251', false);
    let l = await T.api.listarRelatos(); assert.equal(l[0].status, 'aberto'); assert.equal(l[1].status, 'resolvido'); assert.equal(l[1].nota, 'Corrigido na versão 251'); assert.ok(l[1].resolvido_em);
    await T.api.resolverRelato(id, null, true); l = await T.api.listarRelatos(); assert.ok(l.every(x => x.status === 'aberto' && !x.resolvido_em));
  });
  test('o limite é de 20 relatos por pessoa por dia', async () => {
    const T = await montar('bolsista'); for (let i = 0; i < 20; i++) await T.api.relatarProblema(Object.assign({}, bom, { texto: 'Relato de teste número ' + i }));
    await assert.rejects(T.api.relatarProblema(bom), /20 relatos/);
  });
  test('quem acompanha de fora (MDA) não relata nem lista', async () => {
    const T = await montar('coord_geral'); await T.trocar('obs_mda').catch(() => {});
    if (T.S.eu && T.S.eu.observador) { await assert.rejects(T.api.relatarProblema(bom), /Entre no sistema/); await assert.rejects(T.api.listarRelatos(), /Entre no sistema/); }
  });
});

describe('relatar problema: telas', () => {
  test('o formulário diz o que vai junto e não pede dado de beneficiária', async () => {
    const T = await montar('bolsista'); const h = T.painel({ tipo: 'relato-form', de: 'campo' });
    assert.match(h, /data-form="relato-novo"/); assert.match(texto(h), /Relatar problema/); assert.match(texto(h), /Não vai foto da tela/); assert.match(texto(h), /Não escreva nome, CPF/); assert.match(h, /name="tela" value="Campo"/);
  });
  test('o código escrito no relato aparece como texto na lista da coordenação', async () => {
    const T = await montar('bolsista'); await T.api.relatarProblema(Object.assign({}, bom, { texto: '<img src=x onerror=alert(1)> apareceu na tela' }));
    await T.trocar('coord_geral'); T.S.relatos = await T.api.listarRelatos(); const h = T.MQ.relatosUI.blocoCoord();
    assert.doesNotMatch(h, /<img src=x/); assert.match(h, /&lt;img src=x/); assert.match(texto(h), /1 relato aberto/); assert.match(h, /data-form="relato-resolver"/);
  });
  test('a lista só existe para a coordenação geral', async () => {
    for (const p of ['bolsista', 'agente', 'coord_tecnico', 'professor', 'auxiliar']) { const T = await montar(p); assert.equal(T.MQ.relatosUI.blocoCoord(), '', p); }
  });
  test('sem a tabela no banco, a coordenação vê qual arquivo rodar', async () => {
    const T = await montar('coord_geral'); T.S.relatosSemBanco = true; assert.match(texto(T.MQ.relatosUI.blocoCoord()), /55_relatos_problema\.sql/);
  });
});

describe('quadro de metas', () => {
  test('a Seleção não é uma linha do quadro de metas; aparece no detalhe da Meta 1', async () => {
    const T = await montar('coord_geral'); const h = T.aba('visao');
    assert.doesNotMatch(h, /<span class="meta-id">Sel\.<\/span>/); const m1 = h.slice(h.indexOf('id="meta-M1"'), h.indexOf('id="meta-M2"'));
    assert.match(texto(m1), /Seleção das beneficiárias[^.]*: \d+ de 200 selecionadas e aprovadas/);
  });
});
