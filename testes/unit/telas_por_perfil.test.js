/* Telas Visão geral, Equipe, Seleção, Campo e Curso FIC para cada perfil do sistema.
   Cada teste monta o sistema do zero (modo demonstração, sem servidor) e desenha a tela do perfil:
   confere o que o perfil vê, o que não vê e as ações que tem, sem depender do desenho (só de atributos e textos). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto, abasDe, botoes, tem } = require('./telas');
const { diaMais } = require('./ambiente');

const PESSOAIS = ['bolsista', 'agente', 'professor', 'auxiliar'];   // perfis sem abas: uma tela só
const cpfsFormatados = t => (t.S.equipe || []).map(m => t.MQ.regras.fmtCPF(m.cpf || '')).filter(c => c.length === 14);

/* ================================================================== VISÃO GERAL */
describe('Visão geral', () => {
  test('coordenação geral: tem a aba e vê avisos, equipe de execução, metas e estados', async () => {
    const t = await montar('coord_geral'); const h = t.aba('visao');
    assert.ok(abasDe(h).includes('visao'));
    ['O que pede atenção', 'Quem é a equipe de execução', 'Metas do plano de trabalho', 'Por estado'].forEach(x => assert.ok(texto(h).includes(x), x));
  });
  test('coordenação geral: a equipe de execução conta a coordenação técnica e as bolsistas ativas', async () => {
    const t = await montar('coord_geral'); const h = texto(t.aba('visao'));
    const bols = t.S.equipe.filter(m => m.status === 'ativa' && ['articulacao', 'apoio'].includes(m.papel)).length;
    assert.ok(h.includes('Coordenação técnica')); assert.ok(bols > 0);
  });
  test('coordenação técnica: não tem Visão geral; pedir a aba abre a tela inicial dela (Seleção)', async () => {
    const t = await montar('coord_tecnico'); const h = t.aba('visao');
    assert.ok(!abasDe(h).includes('visao'));
    assert.ok(!texto(h).includes('O que pede atenção'));
    assert.ok(texto(h).includes('Seleção das beneficiárias'));
  });
  for (const p of PESSOAIS) test(`${p}: não vê a Visão geral nem abas de coordenação`, async () => {
    const t = await montar(p); const h = t.aba('visao');
    assert.equal(abasDe(h).length, 0);
    ['O que pede atenção', 'Metas do plano de trabalho'].forEach(x => assert.ok(!texto(h).includes(x), x));
  });
});

/* ================================================================== EQUIPE */
describe('Equipe', () => {
  test('coordenação geral: cadastra professor e vaga livre de bolsista; não oferece vaga ocupada', async () => {
    const t = await montar('coord_geral'); const h = t.aba('equipe');
    const novos = botoes(h, 'novo');
    assert.ok(novos.some(b => /data-papel="professor_fic"/.test(b)), 'professor');
    assert.ok(novos.some(b => /data-papel="articulacao" data-uf="AL"/.test(b)), 'vaga livre em AL');
    assert.ok(!novos.some(b => /data-papel="articulacao" data-uf="PI"/.test(b)), 'vaga ocupada em PI');
    assert.ok(!novos.some(b => /data-papel="coord_tecnico"/.test(b)), 'coordenação técnica já ocupada');
    assert.ok(!novos.some(b => /data-papel="auxiliar_adm"/.test(b)), 'auxiliar já ocupado');
  });
  test('coordenação geral: com o auxiliar desligado, aparece o botão para cadastrar outro', async () => {
    const t = await montar('coord_geral');
    const aux = t.S.equipe.find(m => m.papel === 'auxiliar_adm' && m.status === 'ativa');
    await t.api.desligar(aux.id, aux.data_inicio > diaMais(0) ? aux.data_inicio : diaMais(0), 'Fim do contrato');
    await t.MQ.ui.carregar();
    assert.ok(botoes(t.aba('equipe'), 'novo').some(b => /data-papel="auxiliar_adm"/.test(b)));
  });
  test('coordenação técnica: só cadastra bolsistas e agentes (uma vaga por função e estado)', async () => {
    const t = await montar('coord_tecnico'); const novos = botoes(t.aba('equipe'), 'novo');
    assert.ok(novos.length > 0);
    novos.forEach(b => assert.match(b, /data-papel="(articulacao|apoio|agente)"/));
    assert.equal(novos.filter(b => /data-papel="agente"/.test(b)).length, 5, 'um "+ Agente" por estado');
  });
  test('coordenação técnica: formulário de agente pede perfil no campo; o de professor não existe para ela', async () => {
    const t = await montar('coord_tecnico'); t.aba('equipe');
    const f = t.painel({ tipo: 'cadastro', papel: 'agente', uf: 'PI', modo: 'manual' });
    assert.ok(tem(f, 'data-form="cadastro"')); assert.ok(texto(f).includes('Perfil no campo'));
    assert.equal(t.MQ.regras.podeCadastrar('coord_tecnico', 'professor_fic'), false);
  });
  test('coordenação geral: formulário de professor não pede perfil no campo nem previsão de atividades', async () => {
    const t = await montar('coord_geral'); t.aba('equipe');
    const f = t.painel({ tipo: 'cadastro', papel: 'professor_fic', modo: 'manual' });
    assert.ok(!texto(f).includes('Perfil no campo')); assert.ok(!tem(f, 'name="meta_quintais"'));
  });
  test('auxiliar: abre as pessoas para registrar o Arlo, mas não cadastra ninguém', async () => {
    const t = await montar('auxiliar'); const h = t.aba(null);
    assert.ok(botoes(h, 'ver').length > 0); assert.equal(botoes(h, 'novo').length, 0);
    assert.ok(texto(h).includes('Falta cadastrar no Arlo'));
  });
  for (const p of ['bolsista', 'agente', 'professor']) test(`${p}: não cadastra nem abre o cadastro de outras pessoas`, async () => {
    const t = await montar(p); const h = t.aba('equipe');
    assert.equal(botoes(h, 'novo').length, 0); assert.equal(botoes(h, 'ver').length, 0);
    assert.ok(!texto(h).includes('Bolsistas por estado'));
  });
});

/* ================================================================== SELEÇÃO */
describe('Seleção', () => {
  for (const p of ['coord_geral', 'coord_tecnico']) test(`${p}: vê as fichas de todos os estados, abre e baixa; não lança ficha`, async () => {
    const t = await montar(p); const h = t.aba('selecao');
    assert.ok(texto(h).includes('Seleção das beneficiárias'));
    assert.ok(botoes(h, 'ficha-ver').length > 0); assert.ok(botoes(h, 'ficha-csv').length > 0);
    assert.equal(botoes(h, 'ficha-nova').length, 0);
  });
  test('coordenação técnica: ficha aguardando tem Aprovar e Devolver', async () => {
    const t = await montar('coord_tecnico'); t.aba('selecao');
    const f = t.S.fichas.find(x => x.situacao === 'aguardando'); assert.ok(f, 'há ficha aguardando no exemplo');
    const pn = t.painel({ tipo: 'ficha-ver', id: f.id });
    assert.ok(tem(pn, 'value="aprovada"')); assert.ok(tem(pn, 'value="devolvida"'));
  });
  test('bolsista: lança nova ficha e vê só as fichas do próprio estado', async () => {
    const t = await montar('bolsista'); const h = t.aba(null);
    assert.ok(botoes(h, 'ficha-nova').length > 0);
    assert.ok(texto(h).includes('Seleção das mulheres · Piauí'));
    assert.ok(t.S.fichas.length > 0); t.S.fichas.forEach(f => assert.equal(f.uf, 'PI'));
  });
  test('bolsista: a ficha nova abre o formulário com critérios e autorização dos dados', async () => {
    const t = await montar('bolsista'); t.aba(null);
    const f = t.painel({ tipo: 'ficha-form' });
    assert.ok(tem(f, 'data-form="ficha"')); assert.ok(tem(f, 'name="c_agua"')); assert.ok(tem(f, 'name="consent_dados"'));
  });
  for (const p of ['agente', 'professor', 'auxiliar']) test(`${p}: não lança nem decide fichas`, async () => {
    const t = await montar(p); const h = t.aba(null);
    assert.equal(botoes(h, 'ficha-nova').length, 0);
    assert.ok(!texto(h).includes('Seleção das mulheres'));
    assert.equal(t.MQ.regras.decideCampo(t.S.eu.papel), false);
  });
});

/* ================================================================== CAMPO */
describe('Campo', () => {
  for (const p of ['coord_geral', 'coord_tecnico']) test(`${p}: vê roteiro, planos e impacto de todos os estados`, async () => {
    const t = await montar(p); const h = texto(t.aba('campo'));
    ['Visitas, diagnósticos e planos', 'Roteiro', 'Impacto: antes × depois'].forEach(x => assert.ok(h.includes(x), x));
  });
  test('bolsista: agenda visitas e registra diagnóstico no próprio estado', async () => {
    const t = await montar('bolsista'); const h = t.aba(null);
    assert.ok(texto(h).includes('Trabalho de campo · Piauí'));
    assert.ok(botoes(h, 'campo-visita-nova').length > 0);
    t.S.visitas.forEach(v => assert.equal(v.uf, 'PI'));
  });
  test('agente: vê só as visitas dela e registra; não agenda', async () => {
    const t = await montar('agente'); const h = t.aba(null);
    assert.ok(texto(h).includes('Próximas visitas'));
    assert.ok(t.S.visitas.length > 0); t.S.visitas.forEach(v => assert.equal(v.executor_id, t.S.eu.id));
    assert.equal(botoes(h, 'campo-visita-nova').length, 0);
    assert.ok(botoes(h, 'campo-diag-novo').length + botoes(h, 'campo-feita').length > 0);
  });
  for (const p of ['professor', 'auxiliar']) test(`${p}: não vê trabalho de campo`, async () => {
    const t = await montar(p); const h = texto(t.aba(null));
    ['Trabalho de campo', 'Próximas visitas', 'Visitas, diagnósticos e planos'].forEach(x => assert.ok(!h.includes(x), x));
  });
});

/* ================================================================== CURSO FIC */
describe('Curso FIC', () => {
  test('coordenação geral: cria turma, matricula e confirma o AVA', async () => {
    const t = await montar('coord_geral'); const h = t.aba('fic');
    ['fic-turma-nova', 'fic-matricular', 'ent-ava'].forEach(a => assert.ok(botoes(h, a).length > 0, a));
  });
  test('coordenação técnica: não tem a aba Curso FIC, mas a habilitação dela pede a matrícula no FIC', async () => {
    const t = await montar('coord_tecnico'); const h = t.aba('fic');
    assert.ok(!abasDe(h).includes('fic'));
    assert.ok(t.MQ.regras.passosHabilitacao(t.S.eu).some(x => x.id === 'fic'));
    assert.equal(t.MQ.regras.matriculaFIC('coord_tecnico'), true);
  });
  test('professor: cria turma e confirma AVA, sem ver CPF de ninguém', async () => {
    const t = await montar('professor'); const h = t.aba(null);
    assert.ok(botoes(h, 'fic-turma-nova').length > 0); assert.ok(botoes(h, 'ent-ava').length > 0);
    cpfsFormatados(t).forEach(c => assert.ok(!h.includes(c), 'CPF à mostra: ' + c));
  });
  test('professor: a coordenação técnica aparece para matricular, também em turma de um estado', async () => {
    const t = await montar('professor');
    const ct = t.S.equipe.find(m => m.papel === 'coord_tecnico');
    assert.ok(ct, 'coordenação técnica na lista do professor');
    const turma = await t.api.salvarTurma({ nome: 'Turma Piauí', uf: 'PI', professor_id: t.S.eu.id });
    await t.MQ.ui.carregar(); t.aba(null);
    const f = t.painel({ tipo: 'fic-matricular', id: turma.id });
    assert.ok(tem(f, `value="${ct.id}"`), 'coordenação técnica entre as opções');
  });
  test('professor: matricular a coordenação técnica completa o passo FIC da habilitação dela', async () => {
    const t = await montar('professor');
    const ct = t.S.equipe.find(m => m.papel === 'coord_tecnico');
    const turma = await t.api.salvarTurma({ nome: 'Turma geral', professor_id: t.S.eu.id });
    await t.api.matricular(turma.id, ct.id, '2026FIC0100', diaMais(0));
    await t.trocar('coord_geral');
    const depois = t.S.equipe.find(m => m.id === ct.id);
    assert.equal(depois.matricula_fic_em, diaMais(0));
    assert.ok(t.MQ.regras.passosHabilitacao(depois).find(x => x.id === 'fic').feito);
  });
  test('professor: a coordenação técnica matriculada aparece no acesso ao AVA do mês', async () => {
    const t = await montar('professor'); const h = t.aba(null);
    const ct = t.S.equipe.find(m => m.papel === 'coord_tecnico' && m.matricula_fic_em);
    assert.ok(ct, 'coordenação técnica do exemplo já tem matrícula');
    assert.ok(tem(h, `data-acao="ent-ava" data-id="${ct.id}"`));
  });
  test('professor: não é matriculado nem matricula a si mesmo', async () => {
    const t = await montar('professor');
    const turma = await t.api.salvarTurma({ nome: 'Turma geral', professor_id: t.S.eu.id });
    await assert.rejects(t.api.matricular(turma.id, t.S.eu.id, '2026FIC0101', diaMais(0)), /coordenação técnica, bolsistas e agentes/);
  });
  test('bolsista: não cria turma; acompanha o AVA nas entregas do mês', async () => {
    const t = await montar('bolsista'); const h = t.aba(null);
    assert.equal(botoes(h, 'fic-turma-nova').length, 0); assert.equal(botoes(h, 'ent-ava').length, 0);
    assert.ok(texto(h).includes('Entregas do mês'));
  });
  for (const p of ['agente', 'auxiliar']) test(`${p}: não cria turma nem confirma AVA`, async () => {
    const t = await montar(p); const h = t.aba(null);
    ['fic-turma-nova', 'fic-matricular', 'ent-ava'].forEach(a => assert.equal(botoes(h, a).length, 0, a));
  });
});

/* ================================================================== TODAS AS TELAS */
describe('Todas as telas de cada perfil desenham sem erro', () => {
  for (const p of ['coord_geral', 'coord_tecnico', ...PESSOAIS]) test(p, async () => {
    const t = await montar(p); const abas = abasDe(t.aba(null));
    for (const a of (abas.length ? abas : [null])) {
      const h = t.aba(a);
      assert.ok(tem(h, '<main'), `${p}/${a}: sem conteúdo`);
      assert.ok(!/undefined|NaN|\[object Object\]/.test(texto(h)), `${p}/${a}: texto quebrado`);
    }
  });
});
