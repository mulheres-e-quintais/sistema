/* Seleção das mulheres, visitas de campo e curso FIC no modo demonstração (js/api-demo.js),
   que espelham supabase/02_fichas.sql, 03_campo.sql e 11_fic.sql. Cada teste começa num navegador limpo. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais, cpfValido } = require('./ambiente');

let api, MQ, R;
beforeEach(async () => { ({ MQ } = carregar(['dados.js', 'regras.js', 'api-demo.js'])); api = MQ.apiDemo; R = MQ.regras; await api.iniciar(); });
const como = p => api.trocarPerfil(p);
const falha = async (promessa, texto) => { await assert.rejects(promessa, e => { assert.match(e.message, texto); return true; }); };
let seq = 300000000;
const criterios = () => Object.fromEntries(MQ.CRITERIOS.map(([k]) => [k, true]));
const ficha = (o = {}) => Object.assign({ id: 'fx' + seq, uf: 'PI', nome: 'Mulher Teste ' + seq, cpf: cpfValido(seq++), data_nascimento: '1980-01-01', municipio: 'Paulistana',
  comunidade: 'Comunidade Teste', endereco: 'Sítio ' + seq, consent_dados: true, autodeclaracao: true, resultado: 'selecionada', data_ficha: diaMais(-1) }, criterios(), o);
const pessoa = async (papel, extra = () => true) => (await api.listarEquipe()).find(m => m.papel === papel && m.status === 'ativa' && extra(m));

describe('fichas de indicação', () => {
  test('bolsista do estado lança ficha; fica aguardando e com pontos calculados', async () => {
    await como('bolsista');
    const f = await api.salvarFicha(ficha({ p_sustento: true, p_jovem: true }), {});
    assert.equal(f.situacao, 'aguardando'); assert.equal(f.pontos, 3);
  });
  test('ficha de outro estado, ou lançada por agente, é recusada', async () => {
    await como('bolsista'); await falha(api.salvarFicha(ficha({ uf: 'BA' }), {}), /permissão/);
    await como('agente'); await falha(api.salvarFicha(ficha(), {}), /permissão/);
  });
  test('CPF que já tem ficha é recusado', async () => {
    await como('bolsista'); const a = ficha(); await api.salvarFicha(a, {});
    await falha(api.salvarFicha(ficha({ cpf: a.cpf }), {}), /já tem ficha/);
  });
  test('sem autorização dos dados, ou selecionada sem todos os critérios, é recusado', async () => {
    await como('bolsista');
    await falha(api.salvarFicha(ficha({ consent_dados: false }), {}), /autorização/);
    await falha(api.salvarFicha(ficha({ c_agua: false }), {}), /critérios obrigatórios/);
    await falha(api.salvarFicha(ficha({ autodeclaracao: false }), {}), /autodeclaração/);
  });
  test('devolver exige motivo; bolsista não aprova; aprovada não se edita', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {});
    await falha(api.decidirFicha(f.id, 'aprovada'), /Só a coordenação/);
    await como('coord_tecnico'); await falha(api.decidirFicha(f.id, 'devolvida', 'ok'), /corrigir/);
    await api.decidirFicha(f.id, 'aprovada');
    await como('bolsista'); await falha(api.salvarFicha(Object.assign({}, f, { comunidade: 'Outra comunidade' }), {}), /já aprovada/);
  });
  test('limite de 40 selecionadas aprovadas por estado: a 41ª é recusada; lista de espera não conta', async () => {
    await como('coord_tecnico');
    const ja = (await api.listarFichas()).filter(x => x.uf === 'PI' && x.resultado === 'selecionada' && x.situacao === 'aprovada').length;
    await como('bolsista'); const ids = [];
    for (let i = ja; i < MQ.VAGAS_UF + 1; i++) ids.push((await api.salvarFicha(ficha(), {})).id);
    const espera = await api.salvarFicha(ficha({ resultado: 'lista_espera', posicao_espera: 1 }), {});
    await como('coord_tecnico');
    for (const id of ids.slice(0, -1)) await api.decidirFicha(id, 'aprovada');
    await falha(api.decidirFicha(ids[ids.length - 1], 'aprovada'), /já tem 40 selecionadas/);
    await api.decidirFicha(espera.id, 'aprovada');   // a lista de espera pode ser aprovada
  });
});

describe('visitas de campo', () => {
  async function fichaAprovada() {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {});
    await como('coord_tecnico'); await api.decidirFicha(f.id, 'aprovada'); return f;
  }
  const visita = (f, ex, o = {}) => Object.assign({ id: 'v' + (seq++), ficha_id: f.id, etapa: 'diagnostico', executor_id: ex.id, data_prevista: diaMais(3) }, o);
  test('agendar diagnóstico para quem está habilitada', async () => {
    const f = await fichaAprovada(); const ex = await pessoa('agente', m => R.habilitado(m) && m.uf === 'PI');
    const v = await api.salvarVisita(visita(f, ex), {});
    assert.equal(v.situacao, 'prevista'); assert.equal(v.uf, 'PI');
  });
  test('ficha não aprovada não recebe visita', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {});
    await como('coord_tecnico'); const ex = await pessoa('agente', m => R.habilitado(m) && m.uf === 'PI');
    await falha(api.salvarVisita(visita(f, ex), {}), /selecionada e aprovada/);
  });
  test('quem não está habilitada (sem Arlo ou termo) não pode ir', async () => {
    const f = await fichaAprovada(); const ex = await pessoa('agente', m => !R.habilitado(m) && m.uf === 'PI');
    await falha(api.salvarVisita(visita(f, ex), {}), /não está habilitada/);
  });
  test('quem é de outro estado não pode ir', async () => {
    const f = await fichaAprovada();
    await como('coord_geral'); const ba = await pessoa('articulacao', m => m.uf === 'BA');
    await falha(api.salvarVisita(visita(f, ba), {}), /mesmo estado|habilitada/);
  });
  test('ordem das etapas: implantação só depois do diagnóstico feito; diagnóstico não repete', async () => {
    const f = await fichaAprovada(); const ex = await pessoa('agente', m => R.habilitado(m) && m.uf === 'PI');
    await falha(api.salvarVisita(visita(f, ex, { etapa: 'implantacao' }), {}), /Primeiro o diagnóstico/);
    await api.salvarVisita(visita(f, ex), {});
    await falha(api.salvarVisita(visita(f, ex), {}), /já tem essa visita/);
  });
  test('visita de implantação feita exige data não futura e relato de 20 letras', async () => {
    const f = await fichaAprovada(); const ex = await pessoa('agente', m => R.habilitado(m) && m.uf === 'PI');
    await api.salvarVisita(visita(f, ex, { situacao: 'realizada', data_realizada: diaMais(-1) }), {});
    const imp = await api.salvarVisita(visita(f, ex, { etapa: 'implantacao' }), {});
    await falha(api.salvarVisita(Object.assign({}, imp, { situacao: 'realizada', data_realizada: diaMais(1), relato: 'Implantamos os canteiros e o gotejamento.' }), {}), /não pode ser no futuro/);
    await falha(api.salvarVisita(Object.assign({}, imp, { situacao: 'realizada', data_realizada: diaMais(0), relato: 'Feito.' }), {}), /20 letras/);
    const ok = await api.salvarVisita(Object.assign({}, imp, { situacao: 'realizada', data_realizada: diaMais(0), relato: 'Implantamos os canteiros e o gotejamento.' }), {});
    assert.equal(ok.situacao, 'realizada');
  });
  test('agente não reagenda nem cancela a própria visita', async () => {
    const f = await fichaAprovada(); const ex = await pessoa('agente', m => R.habilitado(m) && m.uf === 'PI');
    const v = await api.salvarVisita(visita(f, ex), {});
    await como('agente');
    await falha(api.salvarVisita(Object.assign({}, v, { data_prevista: diaMais(10) }), {}), /não reagenda/);
    await falha(api.salvarVisita(Object.assign({}, v, { situacao: 'cancelada' }), {}), /não reagenda/);
  });
  test('km conferido: só a coordenação; de 0 a 999', async () => {
    await como('bolsista'); await falha(api.salvarKm('v1', 10), /Só a coordenação/);
    await como('coord_tecnico');
    await falha(api.salvarKm('v1', 1000), /inválida/); await falha(api.salvarKm('v1', -1), /inválida/);
    assert.equal(await api.salvarKm('v1', 0), 0); assert.equal(await api.salvarKm('v1', 999), 999);
  });
});

describe('curso FIC', () => {
  test('coordenação técnica não cria turma; turma sem nome ou com fim antes do início é recusada', async () => {
    await como('coord_tecnico'); await falha(api.salvarTurma({ nome: 'Turma X' }), /professores do FIC/);
    await como('professor'); const eu = await api.eu();
    await falha(api.salvarTurma({ nome: 'T', professor_id: eu.id }), /nome/);
    await falha(api.salvarTurma({ nome: 'Turma PI', professor_id: eu.id, inicio: '2026-11-01', fim: '2026-10-01' }), /antes do início/);
  });
  test('matrícula: turma do estado só aceita gente do estado; data futura e número curto recusados', async () => {
    await como('coord_tecnico');   // agente nova, ainda sem matrícula (o professor não lista a equipe inteira)
    const pi = await api.criar({ papel: 'agente', uf: 'PI', nome: 'Agente Sem Matricula', cpf: cpfValido(seq++), email: 'semmat' + seq + '@gmail.com', telefone: '(89) 99999-0000', data_inicio: diaMais(0), consentimento_lgpd: true });
    await como('professor'); const eu = await api.eu();
    const t = await api.salvarTurma({ nome: 'Turma Bahia', professor_id: eu.id, uf: 'BA' });
    await falha(api.matricular(t.id, pi.id, '2026FIC99', diaMais(0)), /Esta turma é de BA/);
    const t2 = await api.salvarTurma({ nome: 'Turma Piauí', professor_id: eu.id, uf: 'PI' });
    await falha(api.matricular(t2.id, pi.id, '12', diaMais(0)), /número da matrícula/);
    await falha(api.matricular(t2.id, pi.id, '2026FIC99', diaMais(1)), /futuro/);
    await api.matricular(t2.id, pi.id, '2026FIC99', diaMais(0));
    await como('coord_geral'); assert.equal((await pessoa('agente', m => m.id === pi.id)).matricula_fic_em, diaMais(0));
  });
  test('professor e auxiliar não são matriculados; cancelar exige motivo', async () => {
    await como('professor'); const eu = await api.eu();
    const t = await api.salvarTurma({ nome: 'Turma geral', professor_id: eu.id });
    await falha(api.matricular(t.id, eu.id, '2026FIC99', diaMais(0)), /Só bolsistas e agentes/);
    await falha(api.cancelarMatricula('nao-existe', 'motivo qualquer'), /não encontrada/);
  });
  test('coordenação técnica precisa de FIC para se habilitar, mas ninguém consegue matriculá-la', { todo: 'regra contraditória: decisão da coordenação (ver relatório)' }, async () => {
    await como('coord_geral'); const ct = await pessoa('coord_tecnico');
    assert.equal(R.fazFIC('coord_tecnico'), true);   // a habilitação pede matrícula no FIC…
    await como('professor'); const eu = await api.eu();
    const t = await api.salvarTurma({ nome: 'Turma geral', professor_id: eu.id });
    await api.matricular(t.id, ct.id, '2026FIC01', diaMais(0));   // …mas a matrícula recusa a coordenação técnica
  });
});
