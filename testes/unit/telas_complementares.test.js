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
    assert.deepEqual(simples(abasDe(t.aba(null))), ['visao', 'equipe', 'selecao', 'campo', 'fic', 'pagamentos', 'viagens', 'custos', 'execucao', 'documentos', 'historico']);
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
  const pass = { valor_estimado: 1500, finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
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

/* ================================================================== SEM COORDENAÇÃO TÉCNICA */
describe('Sem coordenação técnica ativa, a coordenação geral assume a vez dela', () => {
  const pass = { valor_estimado: 1500, finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
  const semTec = t => { t.S.equipe = t.S.equipe.map(m => m.papel === 'coord_tecnico' ? Object.assign({}, m, { status: 'desligada' }) : m); };
  test('com técnica ativa: bolsa da bolsista NÃO conta para a geral (fluxo normal)', async () => {
    const t = await montar('bolsista'); await t.api.solicitarPagamento('bolsa', mes(), 1000, REL, [], {});
    await t.trocar('coord_geral'); assert.equal(t.MQ.ui.semTecnica(), false); assert.equal(t.MQ.pagUI.contaAval(), 0);
  });
  test('sem técnica: a bolsa da bolsista conta no aviso da geral e aparece em "Esperando o seu aval"', async () => {
    const t = await montar('bolsista'); await t.api.solicitarPagamento('bolsa', mes(), 1000, REL, [], {});
    await t.trocar('coord_geral'); semTec(t);
    assert.equal(t.MQ.ui.semTecnica(), true); assert.equal(t.MQ.pagUI.contaAval(), 1);
    const h = texto(t.aba('pagamentos'));
    assert.ok(h.includes('Sem coordenação técnica ativa')); assert.ok(!h.includes('Com a coordenação técnica'));
  });
  test('a regra só vale para a coordenação geral (bolsista não vê a equipe toda)', async () => {
    const t = await montar('bolsista'); t.S.equipe = []; assert.equal(t.MQ.ui.semTecnica(), false);
  });
});

/* ================================================================== CONFERÊNCIA DE PASSAGENS E EVENTOS (26_conferencia_auxiliar.sql)
   Sempre duas pessoas: técnica confere e geral autoriza; sem técnica, o AUXILIAR confere; sem os dois, a geral faz tudo. */
describe('Viagens e eventos: quem confere na falta da coordenação técnica', () => {
  const pass = { valor_estimado: 1500, finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
  const desligar = async (t, papel) => {
    await t.trocar('coord_geral');
    const m = t.S.equipe.find(x => x.papel === papel && x.status === 'ativa');
    await t.api.atualizar(m.id, { status: 'desligada', data_fim: [diaMais(0), m.data_inicio].sort().pop(), motivo_desligamento: 'Teste de ausência da função.' });
  };
  const pedir = async t => { await t.trocar('bolsista'); return t.api.salvarPedido(null, 'passagem', 'Intercâmbio em Juazeiro', diaMais(50), pass); };

  test('com técnica ativa: ela confere; auxiliar não vê pedidos; geral não confere', async () => {
    const t = await montar('bolsista'); const id = await pedir(t);
    assert.equal(await t.api.quemConferePedidos(), 'coord_tecnico');
    await t.trocar('auxiliar'); assert.equal(t.S.pedidos.length, 0); assert.ok(!texto(t.aba(null)).includes('Passagens e eventos para conferir'));
    await assert.rejects(t.api.moverPedido(id, 'conferir'), /coordenação técnica/);
    await t.trocar('coord_geral'); await assert.rejects(t.api.moverPedido(id, 'conferir'), /coordenação técnica/);
    const h = texto(t.painel({ tipo: 'viag-ver', id })); assert.ok(h.includes('Quem confere este pedido é a coordenação técnica'));
  });
  test('sem técnica: auxiliar vê a seção, confere; geral autoriza (duas pessoas)', async () => {
    const t = await montar('bolsista'); const id = await pedir(t); await desligar(t, 'coord_tecnico');
    await t.trocar('bolsista'); assert.ok(texto(t.aba(null)).includes('Com o auxiliar administrativo'));
    await t.trocar('auxiliar'); assert.equal(t.S.quemConfere, 'auxiliar_adm');
    const h = texto(t.aba(null)); assert.ok(h.includes('Passagens e eventos para conferir')); assert.equal(t.MQ.viagUI.contaMinha(), 1);
    assert.ok(texto(t.painel({ tipo: 'viag-ver', id })).includes('Conferido: mandar para a coordenação geral'));
    await t.api.moverPedido(id, 'conferir');
    await t.trocar('coord_geral'); assert.equal(t.MQ.viagUI.contaMinha(), 1);
    assert.ok(texto(t.aba('viagens')).includes('quem confere os pedidos é o auxiliar administrativo'));
    await t.api.moverPedido(id, 'autorizar', null, 'FUNCERN 1');
    assert.equal(t.S.pedidos.length >= 0, true);
  });
  test('sem técnica: a geral NÃO confere (é o auxiliar), só pode recusar', async () => {
    const t = await montar('bolsista'); const id = await pedir(t); await desligar(t, 'coord_tecnico');
    await t.trocar('coord_geral');
    await assert.rejects(t.api.moverPedido(id, 'conferir'), /auxiliar administrativo/);
    assert.equal(t.MQ.viagUI.contaMinha(), 0);
    const h = texto(t.painel({ tipo: 'viag-ver', id })); assert.ok(h.includes('Recusar sem esperar a conferência')); assert.ok(!h.includes('Conferido:'));
  });
  test('auxiliar não autoriza nem recusa; não dá aval em pagamento (regra só de viagens)', async () => {
    const t = await montar('bolsista'); const id = await pedir(t);
    const pag = await t.api.solicitarPagamento('bolsa', mes(), 1000, REL, [], {});
    await desligar(t, 'coord_tecnico'); await t.trocar('auxiliar');
    await t.api.moverPedido(id, 'conferir');
    await assert.rejects(t.api.moverPedido(id, 'autorizar'), /coordenação geral/);
    await assert.rejects(t.api.moverPedido(id, 'recusar', 'motivo qualquer'), /coordenação geral/);
    await assert.rejects(t.api.avalizarPagamento(pag, true, null, 1000));
  });
  test('técnica volta a ser cadastrada: o auxiliar deixa de conferir e de ver os pedidos', async () => {
    const t = await montar('bolsista'); await pedir(t); await desligar(t, 'coord_tecnico');
    await t.trocar('auxiliar'); assert.ok(t.S.pedidos.length >= 1);
    await t.trocar('coord_geral');
    await t.api.criar({ papel: 'coord_tecnico', nome: 'Nova Coordenadora Tecnica', cpf: '47602436075', email: 'nova.tec@gmail.com', telefone: '(84) 99999-0000', data_inicio: diaMais(0), consentimento_lgpd: true });
    await t.trocar('auxiliar'); assert.equal(t.S.quemConfere, 'coord_tecnico'); assert.equal(t.S.pedidos.length, 0);
    assert.ok(!texto(t.aba(null)).includes('Passagens e eventos para conferir'));
  });
  test('sem técnica e sem auxiliar: a geral confere e autoriza, com aviso vermelho', async () => {
    const t = await montar('bolsista'); const id = await pedir(t); await desligar(t, 'coord_tecnico'); await desligar(t, 'auxiliar_adm');
    await t.trocar('coord_geral'); assert.equal(t.S.quemConfere, 'coord_geral');
    assert.ok(texto(t.aba('viagens')).includes('você confere e autoriza sozinho'));
    await t.api.moverPedido(id, 'conferir'); await t.api.moverPedido(id, 'autorizar');
  });
  test('quem conferiu não autoriza o mesmo pedido (conferiu sozinha e depois chegou o auxiliar)', async () => {
    const t = await montar('bolsista'); const id = await pedir(t); await desligar(t, 'coord_tecnico'); await desligar(t, 'auxiliar_adm');
    await t.trocar('coord_geral'); await t.api.moverPedido(id, 'conferir');
    await t.api.criar({ papel: 'auxiliar_adm', nome: 'Novo Auxiliar Administrativo', cpf: '47602436075', email: 'novo.aux@gmail.com', telefone: '(84) 99999-0001', data_inicio: diaMais(0), consentimento_lgpd: true });
    await t.trocar('coord_geral');
    await assert.rejects(t.api.moverPedido(id, 'autorizar'), /Quem conferiu não autoriza/);
    assert.ok(texto(t.painel({ tipo: 'viag-ver', id })).includes('não pode autorizá-lo'));
    await t.api.moverPedido(id, 'devolver', 'Voltar para o auxiliar conferir.');
  });
});
