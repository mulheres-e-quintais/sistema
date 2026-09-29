/* Abas de cada perfil e as telas Pagamentos, Viagens e eventos, Custos, Histórico e Documentos, perfil por perfil.
   Mesmo método de telas_por_perfil.test.js: sistema montado do zero, modo demonstração, sem servidor. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto, abasDe, botoes } = require('./telas');
const { diaMais, simples } = require('./ambiente');

const REL = 'Neste mês visitei os quintais do território, organizei as listas de presença e atualizei as fichas.';
const mes = () => diaMais(0).slice(0, 7) + '-01';

/* ================================================================== ABAS */
describe('Abas de cada perfil', () => {
  test('coordenação geral: 10 abas, na ordem da tela', async () => {
    const t = await montar('coord_geral');
    assert.deepEqual(simples(abasDe(t.aba(null))), ['visao', 'equipe', 'selecao', 'campo', 'fic', 'pagamentos', 'viagens', 'custos', 'documentos', 'historico']);
  });
  test('coordenação técnica: 6 abas (sem Visão geral, Curso FIC, Documentos e Histórico) e abre na Seleção', async () => {
    const t = await montar('coord_tecnico'); const h = t.aba(null);
    assert.deepEqual(simples(abasDe(h)), ['equipe', 'selecao', 'campo', 'pagamentos', 'viagens', 'custos']);
    assert.ok(texto(h).includes('Seleção das beneficiárias'));
  });
  for (const p of ['bolsista', 'agente', 'professor', 'auxiliar']) test(`${p}: nenhuma aba, uma tela própria`, async () => {
    const t = await montar(p); const h = t.aba(null);
    assert.equal(abasDe(h).length, 0); assert.match(texto(h), /Olá, /);
  });
  test('coordenação técnica: pedir uma aba que não é dela (Histórico, Documentos, Curso FIC) abre a Seleção', async () => {
    const t = await montar('coord_tecnico');
    for (const a of ['historico', 'documentos', 'fic', 'visao']) assert.ok(texto(t.aba(a)).includes('Seleção das beneficiárias'), a);
  });
});

/* ================================================================== PAGAMENTOS */
describe('Pagamentos', () => {
  test('coordenação geral e técnica: aba Solicitações de pagamento; só a técnica pede a própria bolsa ali', async () => {
    const g = await montar('coord_geral'); const hg = texto(g.aba('pagamentos'));
    assert.ok(hg.includes('Solicitações de pagamento')); assert.ok(!hg.includes('Solicitar pagamento'));
    const t = await montar('coord_tecnico'); const ht = texto(t.aba('pagamentos'));
    assert.ok(ht.includes('Solicitações de pagamento')); assert.ok(ht.includes('Solicitar pagamento'));
  });
  test('bolsa da bolsista: aval é da coordenação técnica (a geral vê como "com a coordenação técnica")', async () => {
    const t = await montar('bolsista'); await t.api.solicitarPagamento('bolsa', mes(), 1000, REL, [], {});
    await t.trocar('coord_tecnico'); assert.equal(t.MQ.pagUI.contaAval(), 1);
    await t.trocar('coord_geral'); assert.equal(t.MQ.pagUI.contaAval(), 0);
    assert.ok(texto(t.aba('pagamentos')).includes('Com a coordenação técnica'));
  });
  test('depois do aval, o pedido aparece para o auxiliar lançar no Arlo', async () => {
    const t = await montar('bolsista'); const id = await t.api.solicitarPagamento('bolsa', mes(), 1000, REL, [], {});
    await t.trocar('coord_tecnico'); await t.api.avalizarPagamento(id, true, null, 1000);
    await t.trocar('auxiliar'); const h = t.aba(null);
    assert.ok(texto(h).includes('Pagamentos para lançar no Arlo'));
    assert.ok(botoes(h, 'pag-ver').some(b => b.includes(id)));
  });
  test('bolsista, professor e auxiliar pedem bolsa; agente não tem bolsa (só ajuda de custo)', async () => {
    for (const p of ['bolsista', 'professor', 'auxiliar']) { const t = await montar(p); assert.ok(/data-form="pag-bolsa"|Solicitar bolsa/.test(t.aba(null)), p); }
    const a = await montar('agente'); const h = a.aba(null);
    assert.ok(texto(h).includes('Solicitar pagamento')); assert.ok(!/data-form="pag-bolsa"/.test(h));
    await assert.rejects(a.api.solicitarPagamento('bolsa', mes(), 100, REL, [], {}), /não recebe bolsa/);
  });
});

/* ================================================================== VIAGENS E EVENTOS */
describe('Viagens e eventos', () => {
  const pass = { finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
  test('articulação estadual pede; a técnica recebe para conferir; depois a geral para autorizar', async () => {
    const t = await montar('bolsista'); assert.ok(texto(t.aba(null)).includes('Passagens aéreas e eventos'));
    const id = await t.api.salvarPedido(null, 'passagem', 'Intercâmbio em Juazeiro', diaMais(50), pass);
    await t.trocar('coord_tecnico'); assert.equal(t.MQ.viagUI.contaMinha(), 1); assert.ok(texto(t.aba('viagens')).includes('Esperando a sua conferência'));
    await t.trocar('coord_geral'); assert.equal(t.MQ.viagUI.contaMinha(), 0);
    await t.trocar('coord_tecnico'); await t.api.moverPedido(id, 'conferir');
    await t.trocar('coord_geral'); assert.equal(t.MQ.viagUI.contaMinha(), 1); assert.ok(texto(t.aba('viagens')).includes('Esperando a sua autorização'));
  });
  test('bolsista de apoio não vê a seção de passagens (só a de articulação)', async () => {
    const t = await montar('bolsista'); t.S.eu = Object.assign({}, t.S.eu, { papel: 'apoio' });
    assert.ok(!texto(t.aba(null)).includes('Passagens aéreas e eventos'));
  });
  for (const p of ['agente', 'professor', 'auxiliar']) test(`${p}: não vê passagens e eventos`, async () => {
    const t = await montar(p); const h = t.aba(null);
    assert.ok(!texto(h).includes('Passagens aéreas e eventos')); assert.equal(botoes(h, 'viag-nova').length, 0);
  });
});

/* ================================================================== CUSTOS */
describe('Custos', () => {
  for (const p of ['coord_geral', 'coord_tecnico']) test(`${p}: vê o custo das visitas e os valores usados`, async () => {
    const t = await montar(p); const h = texto(t.aba('custos'));
    assert.ok(h.includes('Custo das visitas')); assert.ok(h.includes('Valores usados'));
  });
  for (const p of ['bolsista', 'agente', 'professor', 'auxiliar']) test(`${p}: não vê custos e não muda valores nem km`, async () => {
    const t = await montar(p);
    assert.ok(!texto(t.aba('custos')).includes('Custo das visitas'));
    await assert.rejects(t.api.salvarParametros('custo_visita', {}), /Só a coordenação/);
    await assert.rejects(t.api.salvarKm('v1', 10), /Só a coordenação/);
  });
});

/* ================================================================== HISTÓRICO */
describe('Histórico', () => {
  test('coordenação geral: vê o histórico com o que a equipe fez', async () => {
    const t = await montar('coord_tecnico');
    await t.api.criar({ papel: 'agente', uf: 'SE', nome: 'Agente Do Historico', cpf: '47602436075', email: 'hist@gmail.com', telefone: '(79) 99999-0000', data_inicio: diaMais(0), consentimento_lgpd: true });
    await t.trocar('coord_geral'); const h = texto(t.aba('historico'));
    assert.ok(h.includes('Histórico de alterações')); assert.ok(h.includes('cadastrou') && h.includes('Agente Do Historico'));
  });
  test('coordenação técnica e perfis pessoais não têm histórico', async () => {
    for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
      const t = await montar(p); assert.ok(!texto(t.aba('historico')).includes('Histórico de alterações'), p);
      assert.equal(t.S.aud.length, 0, p + ' não recebe o histórico');
    }
  });
});

/* ================================================================== DOCUMENTOS */
describe('Documentos', () => {
  test('coordenação geral: aba com anexar e gerar relatório', async () => {
    const t = await montar('coord_geral'); const h = t.aba('documentos');
    assert.ok(texto(h).includes('Documentos do projeto'));
    assert.equal(botoes(h, 'doc-novo').length, 1); assert.equal(botoes(h, 'doc-relatorio').length, 1);
  });
  for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) test(`${p}: não vê documentos`, async () => {
    const t = await montar(p); const h = t.aba('documentos');
    assert.ok(!texto(h).includes('Documentos do projeto')); assert.equal(botoes(h, 'doc-novo').length, 0);
  });
});
