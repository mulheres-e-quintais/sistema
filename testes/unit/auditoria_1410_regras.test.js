/* Auditoria de 14/10/2026: REGRAS DE NEGÓCIO, RASTREABILIDADE E INDICADORES (tela, demonstração e, se houver banco, servidor).
   Casos com "[ACHADO]" no nome descrevem o comportamento ESPERADO pela regra já escrita (no banco, na tela ou no plano);
   se reprovam, é divergência a corrigir. Casos com "[DÚVIDA]" só registram o comportamento atual de uma regra não definida
   (passam), para a coordenação decidir.
   Comparação com o banco: AUD_DB=<banco montado com /tmp/montar_db.sh> npm test (roda supabase/tests/test_auditoria_1410_indicadores.sql
   e compara MQ.acomp.calcular com acompanhamento_dados() sobre a mesma massa). Sem AUD_DB, essa parte fica pulada. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { carregar, cpfValido } = require('./ambiente');
const { montar } = require('./telas');

/* objetos vindos do navegador falso (vm) têm outro protótipo: compara pelo conteúdo */
const igual = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);
const base = () => carregar(['dados.js', 'regras.js', 'painel.js', 'acompanhamento.js'], { ui: { S: {}, esc: s => String(s), nomeUF: u => u } }).MQ;

/* ---------- 1. dados de referência coerentes com o plano de trabalho ---------- */
describe('plano de trabalho × dados de referência (js/dados.js)', () => {
  const MQ = base(); const M = id => MQ.METAS.find(m => m.id === id);
  test('200 quintais = 40 por estado × 5 estados = alvo das metas 2 e 3', () => {
    assert.equal(MQ.UFS.length, 5); assert.equal(MQ.VAGAS_UF * MQ.UFS.length, 200);
    assert.equal(M('M2').alvo, 200); assert.equal(M('M3').alvo, 200);
  });
  test('400 visitas da meta 4 = 200 quintais × 2 acompanhamentos (MQ.ETAPAS)', () => {
    assert.equal(MQ.ETAPAS.acompanhamento.max * 200, M('M4').alvo);
    assert.equal(MQ.ETAPAS.diagnostico.max + MQ.ETAPAS.implantacao.max + MQ.ETAPAS.avaliacao.max, 3);
  });
  test('dias de campo por estado = 40 quintais × visitas máximas por quintal (5)', () => {
    const porQuintal = Object.values(MQ.ETAPAS).reduce((t, e) => t + e.max, 0);
    assert.equal(MQ.DIAS_CAMPO_UF, MQ.VAGAS_UF * porQuintal);
  });
  test('vigência: limites de data das visitas = 14/09/2026 a 30/09/2027; último marco = fim da vigência; 13 meses', () => {
    assert.equal(MQ.regras.LIM.visitaMin, MQ.PROJETO.vigencia.inicio); assert.equal(MQ.regras.LIM.visitaMax, MQ.PROJETO.vigencia.fim);
    assert.equal(MQ.MARCOS[MQ.MARCOS.length - 1].d, MQ.PROJETO.vigencia.fim);
    assert.ok(MQ.MARCOS.every(k => k.d >= MQ.PROJETO.vigencia.inicio && k.d <= MQ.PROJETO.vigencia.fim));
    assert.ok(MQ.METAS.every(m => m.ini >= 1 && m.fim <= 13 && m.ini <= m.fim));
    assert.equal(MQ.ORCAMENTO.cronograma.meses.length, 13);
  });
  test('orçamento: soma dos repasses = total de R$ 2 milhões; ajuda de custo 800 × R$ 225 = teto de R$ 180 mil', () => {
    assert.equal(MQ.ORCAMENTO.repasses.reduce((t, r) => t + r.valor, 0), MQ.ORCAMENTO.total);
    assert.equal(800 * 225, MQ.CUSTO_PADRAO.teto);
  });
  test('[DÚVIDA] ajuda de custo prevê 800 visitas (200+200+400), mas o campo permite 1.000 por projeto (5 por quintal: a avaliação final é paga?)', () => {
    assert.equal(MQ.DIAS_CAMPO_UF * 5, 1000); assert.notEqual(1000, 800);
  });
});

/* ---------- 2. identificação e duplicidade (ficha) ---------- */
describe('ficha: unicidade sem bloquear cadastro legítimo (regras.js validarFicha)', () => {
  const MQ = base(); const R = MQ.regras;
  const ficha = (o = {}) => Object.assign({ id: 'nova', nome: 'Maria das Dores Silva', cpf: cpfValido('123456789'), data_nascimento: '1980-05-05', uf: 'PI', municipio: 'Picos', comunidade: 'Sítio Aud',
    endereco: 'Sítio Baixio, 12', consent_dados: true, resultado: 'selecionada', autodeclaracao: true, data_ficha: '2026-10-01', tem_foto_termo: true, tem_foto_ficha: true },
    Object.fromEntries(MQ.CRITERIOS.map(([k]) => [k, true])), o);
  test('mesmo CPF já com ficha (em qualquer estado) é apontado', () => {
    const e = R.validarFicha(ficha(), [ficha({ id: 'outra', uf: 'BA', municipio: 'Itiúba' })]);
    assert.match(e.cpf || '', /já tem ficha/);
  });
  test('nome igual e mesma data de nascimento, CPF diferente: NÃO bloqueia', () => {
    const e = R.validarFicha(ficha(), [ficha({ id: 'outra', cpf: cpfValido('987654321') })]);
    assert.equal(e.cpf, undefined); assert.equal(e.nome, undefined);
  });
  test('mesma casa (endereço escrito diferente): não bloqueia, mas é encontrada para aviso', () => {
    const outra = ficha({ id: 'outra', cpf: cpfValido('987654321'), endereco: 'Sitio Baixio nº 12' });
    assert.deepEqual(Object.keys(R.validarFicha(ficha(), [outra])), []);
    assert.equal(R.casasParecidas(ficha(), [outra]).length, 1);
  });
  test('selecionada só com todos os critérios e a autodeclaração; sem água só com encaminhamento', () => {
    igual(R.resultadosPossiveis(ficha()), ['selecionada', 'lista_espera']);
    igual(R.resultadosPossiveis(ficha({ c_agua: false })), ['sem_agua', 'nao_atende']);
    igual(R.resultadosPossiveis(ficha({ autodeclaracao: false })), ['nao_atende']);
    assert.match(R.validarFicha(ficha({ resultado: 'sem_agua', c_agua: false }), []).encaminhada_para || '', /encaminhada/);
  });
});

/* ---------- 3. ordem das etapas (dados.js etapaMotivo, a mesma do banco visita_etapa_motivo) ---------- */
describe('etapas do campo: o que conta como implantado e quando pode acompanhar', () => {
  const MQ = base();
  const b = (diag, visitas) => ({ diagnosticos: diag ? [Object.assign({ ficha_id: 'f' }, diag)] : [], visitas: visitas || [] });
  test('implantação: só com plano aprovado e com água', () => {
    assert.equal(MQ.etapaMotivo('implantacao', 'f', b({ situacao: 'aguardando' }), { veTudo: true }), MQ.MSG_ETAPA.plano);
    assert.equal(MQ.etapaMotivo('implantacao', 'f', b({ situacao: 'devolvido' }), { veTudo: true }), MQ.MSG_ETAPA.plano);
    assert.equal(MQ.etapaMotivo('implantacao', 'f', b({ situacao: 'aprovado', sem_agua: true }), { veTudo: true }), MQ.MSG_ETAPA.semAgua);
    assert.equal(MQ.etapaMotivo('implantacao', 'f', b({ situacao: 'aprovado' }), { veTudo: true }), null);
  });
  test('acompanhamento: só depois da implantação FEITA (agendada não basta); data não antes da implantação', () => {
    const imp = s => ({ id: 'i', ficha_id: 'f', etapa: 'implantacao', situacao: s, data_realizada: s === 'realizada' ? '2026-10-05' : null });
    assert.equal(MQ.etapaMotivo('acompanhamento', 'f', b(null, [imp('prevista')]), { veTudo: true }), MQ.MSG_ETAPA.acompanhamento);
    assert.equal(MQ.etapaMotivo('acompanhamento', 'f', b(null, [imp('realizada')]), { veTudo: true }), null);
    assert.match(MQ.etapaMotivo('acompanhamento', 'f', b(null, [imp('realizada')]), { veTudo: true, data: '2026-10-01' }), /anterior à da implantação/);
  });
});

/* ---------- 4. indicadores da tela ---------- */
describe('indicadores: Visão geral (painel.js) × MDA/MPA (acompanhamento.js)', () => {
  const MQ = base(); const P = MQ.painelUI; const M = id => MQ.METAS.find(m => m.id === id); const d0 = { aptas: [], pagaveis: [] };
  const fx = (i, o) => Object.assign({ id: 'f' + i, uf: 'PI', municipio: 'Picos', comunidade: 'Sítio', resultado: 'selecionada', situacao: 'aprovada', data_nascimento: '1980-01-01', pessoas_familia: 3 }, o);
  const massa = () => {
    const fichas = Array.from({ length: 8 }, (_, i) => fx(i));
    const diagnosticos = [
      { ficha_id: 'f0', uf: 'PI', situacao: 'aprovado', sem_agua: false }, { ficha_id: 'f1', uf: 'PI', situacao: 'aprovado', sem_agua: false },
      { ficha_id: 'f2', uf: 'PI', situacao: 'aguardando', sem_agua: false }, { ficha_id: 'f3', uf: 'PI', situacao: 'devolvido', sem_agua: false },
      { ficha_id: 'f4', uf: 'PI', situacao: 'aprovado', sem_agua: true }];
    const v = (id, f, etapa, situacao, dia) => ({ id, ficha_id: f, uf: 'PI', etapa, situacao, data_prevista: dia, data_realizada: situacao === 'realizada' ? dia : null });
    const visitas = [v('i0', 'f0', 'implantacao', 'realizada', '2026-10-05'), v('i1', 'f1', 'implantacao', 'cancelada', '2026-10-06'), v('i1b', 'f1', 'implantacao', 'realizada', '2026-10-07'),
      v('a0', 'f0', 'acompanhamento', 'realizada', '2026-10-10'), v('a1', 'f0', 'acompanhamento', 'cancelada', '2026-10-11'), v('a2', 'f0', 'acompanhamento', 'realizada', '2026-10-12'),
      v('a3', 'f1', 'acompanhamento', 'prevista', '2026-10-30')];
    return { fichas, diagnosticos, visitas, avaliacoes: [], equipe: [], turmas: [], matriculas: [], encontros: [] };
  };
  const tot = (a, k) => a.por_uf.reduce((t, u) => t + u[k], 0);
  test('mesmos dados: Visão geral (infoMeta) e MDA (calcular) dão o mesmo número de diagnósticos, implantados e acompanhamentos', () => {
    const S = massa(); const a = MQ.acomp.calcular(S, 'mda', '2026-10-14');
    assert.equal(P.infoMeta(M('M2'), S, d0, 2).atual, tot(a, 'diagnosticos'));
    assert.equal(P.infoMeta(M('M3'), S, d0, 2).atual, tot(a, 'implantados'));
    assert.equal(P.infoMeta(M('M4'), S, d0, 2).atual, tot(a, 'acompanhamentos'));
    assert.equal(tot(a, 'implantados'), 2, 'implantação cancelada não conta'); assert.equal(tot(a, 'acompanhamentos'), 2, 'cancelado e agendado não contam');
  });
  test('[DÚVIDA] meta 2 conta diagnóstico aguardando, devolvido e sem água: 200 registrados e nenhum aprovado já mostra "Concluída"', () => {
    const S = { diagnosticos: Array.from({ length: 200 }, (_, i) => ({ ficha_id: 'f' + i, situacao: i % 2 ? 'devolvido' : 'aguardando' })), visitas: [] };
    const x = P.infoMeta(M('M2'), S, d0, 6);
    assert.equal(x.atual, 200); assert.equal(x.st, 'concluida');
  });
  test('[ACHADO] "com plano aprovado" (Visão geral) = "planos" (MDA): diagnóstico sem água aprovado não é plano', () => {
    const S = massa(); const a = MQ.acomp.calcular(S, 'mda', '2026-10-14');
    const nota = P.infoMeta(M('M2'), S, d0, 2).nota; const visao = +(/^(\d+) com plano aprovado/.exec(nota) || [])[1];
    assert.equal(visao, tot(a, 'planos'), `Visão geral ${visao} × MDA ${tot(a, 'planos')} (o quintal sem água aprovado entra só na Visão geral)`);
  });
  test('MDA: metas na tela do MDA usam a mesma conta (atual = total do estado)', () => {
    const a = MQ.acomp.calcular(massa(), 'mda', '2026-10-14');
    assert.equal(tot(a, 'diagnosticos'), 5); assert.equal(tot(a, 'planos'), 2); assert.equal(tot(a, 'diag_sem_agua'), 1);
  });
  test('execução física ponderada: M2 só com diagnósticos (mesmo devolvidos) já soma peso', () => {
    const S = { diagnosticos: Array.from({ length: 100 }, () => ({ situacao: 'devolvido' })), visitas: [] };
    const ex = P.execucaoGeral(S, { aptas: [], pagaveis: [], fichas: [], selAprov: [] }, 3);
    assert.ok(ex.real > 0, 'diagnóstico devolvido conta na execução física: ' + ex.real);
  });
});

/* ---------- 5. demonstração × banco (o que o banco recusa e a demonstração aceita) ---------- */
async function demoPreparada() {
  const t = await montar('bolsista');
  const db = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4'));
  const ana = db.equipe.find(m => m.papel === 'articulacao' && m.uf === 'PI');
  const f1 = db.fichas.find(f => db.diagnosticos.some(d => d.ficha_id === f.id));
  const vd = db.visitas.find(v => v.ficha_id === f1.id && v.etapa === 'diagnostico');
  vd.data_prevista = vd.data_realizada = '2026-09-20';
  Object.assign(db.diagnosticos.find(d => d.ficha_id === f1.id), { data_visita: '2026-09-20', situacao: 'aprovado' });
  db.visitas.push({ id: 'audimp1', ficha_id: f1.id, uf: 'PI', etapa: 'implantacao', executor_id: ana.id, data_prevista: '2026-09-25', data_realizada: '2026-09-25', situacao: 'realizada', relato: 'Implantação feita pela auditoria (relato longo)', fotos: ['x'], criado_em: '2026-09-25T12:00:00Z', atualizado_em: '2026-09-25T12:00:00Z' });
  t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(db));
  await t.api.reler(); await t.trocar('bolsista');
  return { t, ana, f1, vd, outra: db.visitas.find(v => v.etapa === 'diagnostico' && v.situacao === 'prevista' && v.uf === 'PI') };
}
const recusa = async (fn, re) => { try { await fn(); } catch (e) { if (re) assert.match(String(e.message), re); return true; } return false; };
const futuro = n => { const x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };

describe('demonstração espelha o banco (js/api-demo.js × supabase)', () => {
  test('demonstração preparada: implantação feita e plano aprovado', async () => {
    const { t, f1 } = await demoPreparada();
    assert.ok(t.S.visitas.some(v => v.ficha_id === f1.id && v.etapa === 'implantacao' && v.situacao === 'realizada'));
  });
  test('regra presente nos dois: terceiro acompanhamento é recusado', async () => {
    const { t, ana, f1 } = await demoPreparada();
    const nova = (id, dia) => t.api.salvarVisita({ id, ficha_id: f1.id, etapa: 'acompanhamento', executor_id: ana.id, data_prevista: dia, situacao: 'prevista' });
    await nova('ac1', futuro(3)); await nova('ac2', futuro(4));
    assert.ok(await recusa(() => nova('ac3', futuro(5)), /2 visitas de acompanhamento/));
  });
  test('[ACHADO] dois acompanhamentos do mesmo quintal no mesmo dia: o banco recusa (61, visitas_acompanhamento_dia); a demonstração deveria recusar', async () => {
    const { t, ana, f1 } = await demoPreparada();
    const nova = id => t.api.salvarVisita({ id, ficha_id: f1.id, etapa: 'acompanhamento', executor_id: ana.id, data_prevista: futuro(3), situacao: 'prevista' });
    await nova('md1');
    assert.ok(await recusa(() => nova('md2')), 'a demonstração aceitou dois acompanhamentos no mesmo dia');
  });
  test('[ACHADO] visita nova já "realizada": o banco recusa (58, visitas_nasce_prevista); a demonstração deveria recusar', async () => {
    const { t, ana, f1 } = await demoPreparada();
    const hoje = t.MQ.regras.hoje();
    assert.ok(await recusa(() => t.api.salvarVisita({ id: 'nr1', ficha_id: f1.id, etapa: 'acompanhamento', executor_id: ana.id, data_prevista: hoje, data_realizada: hoje, situacao: 'realizada', relato: 'Relato de visita com mais de vinte letras' })),
      'a demonstração gravou visita nova já como feita');
  });
  test('[ACHADO] visita de diagnóstico marcada como feita sem o formulário: o banco recusa (visitas_feita); a demonstração deveria recusar', async () => {
    const { t, outra } = await demoPreparada();
    const hoje = t.MQ.regras.hoje();
    assert.ok(await recusa(() => t.api.salvarVisita(Object.assign({}, outra, { situacao: 'realizada', data_realizada: hoje }))), 'a demonstração marcou o diagnóstico como feito sem formulário');
  });
  test('[ACHADO] cancelar visita que já tem diagnóstico registrado: o banco recusa (45); a demonstração deveria recusar', async () => {
    const { t, vd } = await demoPreparada(); await t.trocar('coord_tecnico');
    const v = t.S.visitas.find(x => x.id === vd.id);
    assert.ok(await recusa(() => t.api.salvarVisita(Object.assign({}, v, { situacao: 'cancelada' }))), 'a demonstração cancelou a visita com diagnóstico');
  });
  test('[ACHADO] bolsista muda a data prevista de visita já feita: o banco recusa (45, só a coordenação corrige); a demonstração deveria recusar', async () => {
    const { t } = await demoPreparada();
    const v = t.S.visitas.find(x => x.id === 'audimp1');
    assert.ok(await recusa(() => t.api.salvarVisita(Object.assign({}, v, { data_prevista: '2026-09-26' }))), 'a demonstração deixou a bolsista mudar visita já feita');
  });
  test('MPA na tela/demonstração: matriculadas como na coordenação (matrícula registrada, só quem está ativa); encontro cancelado não conta (67)', () => {
    const MQ = base();
    // cancelar a matrícula apaga matricula_fic_em (11_fic.sql); quem foi desligada não está ativa; o professor não faz o curso
    const equipe = [{ id: 'p1', status: 'ativa', papel: 'articulacao', matricula_fic_em: '2026-10-01' }, { id: 'p2', status: 'ativa', papel: 'agente', matricula_fic_em: '2026-10-02' },
      { id: 'p3', status: 'ativa', papel: 'coord_tecnico' }, { id: 'p4', status: 'desligada', papel: 'agente', matricula_fic_em: '2026-09-20' }, { id: 'p5', status: 'ativa', papel: 'professor_fic' }];
    const a = MQ.acomp.calcular({ fichas: [], visitas: [], equipe, turmas: [{ id: 't' }], matriculas: [{ id: 'm1' }], encontros: [{ id: 'e1' }, { id: 'e2', cancelado_em: '2026-10-05' }] }, 'mpa', '2026-10-14');
    igual(a.formacao, { turmas: 1, pessoas: 3, matriculas: 2, encontros: 1 });
  });
  test('regra presente nos dois: implantação sem plano aprovado é recusada', async () => {
    const { t, ana, outra } = await demoPreparada();
    assert.ok(await recusa(() => t.api.salvarVisita({ id: 'imp2', ficha_id: outra.ficha_id, etapa: 'implantacao', executor_id: ana.id, data_prevista: futuro(3), situacao: 'prevista' })));
  });
});

/* ---------- 6. comparação com o banco (AUD_DB) ---------- */
describe('servidor × tela: acompanhamento_dados() e vitrine() × MQ.acomp.calcular (massa sintética do SQL)', { skip: !process.env.AUD_DB && 'defina AUD_DB=<banco montado> para comparar com o banco local' }, () => {
  const arq = path.join(__dirname, '..', '..', 'supabase', 'tests', 'test_auditoria_1410_indicadores.sql');
  let snap = null, linhas = [];
  const pegar = () => {
    if (snap) return snap;
    const r = spawnSync('sudo', ['-u', 'postgres', 'psql', '-X', '-q', '-d', process.env.AUD_DB, '-f', arq], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    linhas = r.stdout.split('\n');
    const l = linhas.find(x => x.startsWith('SNAPSHOT|')); assert.ok(l, 'o SQL não devolveu a foto do banco: ' + r.stderr.slice(0, 400));
    snap = JSON.parse(l.slice(9)); return snap;
  };
  const MQ = base();
  const CHAVES = ['indicadas', 'selecionadas', 'espera', 'sem_agua', 'municipios', 'comunidades', 'pessoas', 'diagnosticos', 'planos', 'diag_sem_agua', 'area_m2',
    'implantados', 'acompanhamentos', 'avaliacoes', 'visitas_feitas', 'agendadas', 'atrasadas', 'bolsistas', 'agentes'];
  const js = org => { const s = pegar(); return MQ.acomp.calcular(s, org, s.hoje); };
  test('por estado: cada número do MDA no banco = conta da tela', () => {
    const s = pegar(), a = js('mda'), dif = [];
    s.sql_mda.por_uf.forEach(u => { const j = a.por_uf.find(x => x.uf === u.uf); CHAVES.forEach(k => { if (+u[k] !== +j[k]) dif.push(`${u.uf}.${k}: banco ${u[k]} × tela ${j[k]}`); }); });
    assert.deepEqual(dif, []);
  });
  test('por município e por mês: banco = tela', () => {
    const s = pegar(), a = js('mda');
    const chave = l => l.map(m => m.uf + '|' + m.n + '|' + m.implantados).sort().join(',');
    assert.equal(chave(s.sql_mda.municipios), chave(a.municipios));
    igual(s.sql_mda.mensal, a.mensal);
  });
  test('perfil e impacto do MDA: banco = tela', () => {
    const s = pegar(), a = js('mda');
    igual(s.sql_mda.perfil, a.perfil); igual(s.sql_mda.impacto, a.impacto);
  });
  test('formação do MPA: banco (acompanhamento_formacao, 61) = tela (matrículas e encontros cancelados)', () => {
    const s = pegar(), a = js('mpa');
    igual(s.sql_mpa.formacao, a.formacao);
  });
  test('vitrine pública (banco, 63) = mesma conta da vitrine da demonstração sobre a mesma massa', () => {
    const s = pegar(); const dif = [];
    s.sql_vitrine.por_uf.forEach(u => {
      const n = (l, fn) => l.filter(fn).length;
      const j = { fichas: n(s.fichas, f => f.uf === u.uf), selecionadas: n(s.fichas, f => f.uf === u.uf && f.resultado === 'selecionada' && f.situacao === 'aprovada'),
        diagnosticos: n(s.diagnosticos, x => x.uf === u.uf), planos: n(s.diagnosticos, x => x.uf === u.uf && x.situacao === 'aprovado' && !x.sem_agua),   // 63: sem água não tem plano
        implantados: n(s.visitas, v => v.uf === u.uf && v.etapa === 'implantacao' && v.situacao === 'realizada'), acompanhamentos: n(s.visitas, v => v.uf === u.uf && v.etapa === 'acompanhamento' && v.situacao === 'realizada') };
      Object.keys(j).forEach(k => { if (+u[k] !== j[k]) dif.push(`${u.uf}.${k}: vitrine ${u[k]} × conta ${j[k]}`); });
    });
    assert.deepEqual(dif, [], 'diferença = visita nova em ficha de exemplo (a vitrine tira por id da visita, o MDA pela ficha)');
  });
  test('casos de regra do SQL (linhas FALHOU são os achados marcados no próprio SQL)', () => {
    pegar(); const tot = linhas.find(l => l.startsWith('TOTAL|')); assert.ok(tot);
    const falhas = linhas.filter(l => l.startsWith('FALHOU|'));
    assert.ok(falhas.every(l => /\[ACHADO/.test(l)), 'falhou caso que não é achado conhecido:\n' + falhas.filter(l => !/\[ACHADO/.test(l)).join('\n'));
  });
});
