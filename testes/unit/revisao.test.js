/* Correções da revisão de 29/09/2026: contagem de dias, números em português, limites do cadastro,
   "mesma casa" sem trabalho repetido, carregamento em paralelo e prazo de indicação prorrogado. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais } = require('./ambiente');
const { montar } = require('./telas');

const base = () => { const { MQ } = carregar(['dados.js', 'regras.js']); return { MQ, R: MQ.regras }; };

describe('dias até uma data (dias de calendário, não importa a hora)', () => {
  test('hoje = 0, amanhã = 1, ontem = -1', () => {
    const { R } = base();
    assert.equal(R.diasAte(R.hoje()), 0); assert.equal(R.diasAte(diaMais(1)), 1); assert.equal(R.diasAte(diaMais(-1)), -1);
    assert.equal(R.diasAte(diaMais(10)), 10);
  });
  test('aceita data com hora (usa só o dia)', () => { const { R } = base(); assert.equal(R.diasAte(diaMais(2) + 'T08:00:00Z'), 2); });
});

describe('prazo de indicação do MPA', () => {
  test('prorrogado para 09/10/2026 e o marco acompanha', () => {
    const { MQ } = base();
    assert.equal(MQ.PROJETO.prazoIndicacao, '2026-10-09');
    assert.ok(MQ.MARCOS.some(m => m.d === '2026-10-09' && /indica/.test(m.t)));
    assert.ok(!MQ.MARCOS.some(m => m.d === '2026-09-30' && /indica/.test(m.t)));
    const ds = MQ.MARCOS.map(m => m.d); assert.deepEqual([...ds], [...ds].sort(), 'marcos em ordem de data');
  });
});

describe('número digitado no kit (padrão brasileiro e com ponto)', () => {
  const numBR = async () => (await montar('coord_geral')).MQ.campoUI.numBR;
  test('1.250,50 = 1250,5; 12,50 = 12,5; 12.50 = 12,5; 1.250 = 1250; 0.5 = 0,5', async () => {
    const n = await numBR();
    assert.equal(n('1.250,50'), 1250.5); assert.equal(n('12,50'), 12.5); assert.equal(n('12.50'), 12.5);
    assert.equal(n('1.250'), 1250); assert.equal(n('0.5'), 0.5); assert.equal(n('R$ 3.500,00'), 3500); assert.equal(n('10'), 10);
  });
  test('vazio e texto sem número = nada', async () => { const n = await numBR(); assert.equal(n(''), null); assert.equal(n(null), null); assert.equal(n('muitos'), null); });
});

describe('cadastro: mesmos limites do banco', () => {
  const pessoa = (o) => Object.assign({ nome: 'Maria Teste Silva', cpf: '47602436075', email: 'm.teste@gmail.com', telefone: '(84) 99999-0000', data_inicio: '2026-10-01', consentimento_lgpd: true }, o);
  test('segunda coordenação técnica ativa é recusada na tela', () => {
    const { R } = base();
    const e = R.validar(pessoa({ papel: 'coord_tecnico' }), [{ id: 'x', papel: 'coord_tecnico', status: 'ativa', cpf: '1', email: 'a@b.c' }]);
    assert.match(e.papel || '', /Já existe coordenação técnica/);
  });
  test('previsão acima do limite (41 diagnósticos, 81 visitas) é recusada; 40 e 80 passam', () => {
    const { R } = base();
    const e = R.validar(pessoa({ papel: 'articulacao', uf: 'PI', meta_diagnosticos: 41, meta_quintais: 40, meta_visitas: 81 }), []);
    assert.equal(e.meta_diagnosticos, 'No máximo 40.'); assert.equal(e.meta_visitas, 'No máximo 80.'); assert.equal(e.meta_quintais, undefined);
  });
  test('erro do banco de limite vira mensagem clara', () => {
    const { R } = base(); assert.match(R.mensagemErro({ message: 'new row violates check constraint "equipe_meta_visitas_check"' }), /até 40 diagnósticos/);
  });
});

describe('"Mesma casa?" contada de uma vez', () => {
  test('dá o mesmo resultado que comparar ficha por ficha', () => {
    const { R } = base();
    const fs = [
      { id: 1, uf: 'PI', municipio: 'Picos', endereco: 'Sítio Boa Vista, nº 10' }, { id: 2, uf: 'PI', municipio: 'PICOS', endereco: 'sitio boa vista 10' },
      { id: 3, uf: 'BA', municipio: 'Picos', endereco: 'Sítio Boa Vista, nº 10' }, { id: 4, uf: 'PI', municipio: 'Picos', endereco: '' },
      { id: 5, uf: 'PI', municipio: 'Oeiras', endereco: 'Sítio Boa Vista 10' }];
    const n = R.contarCasas(fs);
    fs.forEach(f => { const k = R.chaveCasa(f); assert.equal(!!(k && n.get(k) > 1), R.casasParecidas(f, fs).length > 0, 'ficha ' + f.id); });
  });
});

describe('carregar busca os dados ao mesmo tempo', () => {
  test('várias chamadas em andamento juntas (antes: uma de cada vez)', async () => {
    const t = await montar('coord_geral'); const api = t.api;
    let agora = 0, pico = 0;
    const lento = fn => async (...a) => { agora++; pico = Math.max(pico, agora); await new Promise(r => setTimeout(r, 15)); try { return await fn.apply(api, a); } finally { agora--; } };
    ['listarEquipe', 'listarFichas', 'listarVisitas', 'listarDiagnosticos', 'listarAvaliacoes', 'auditoria', 'listarSolicitacoes', 'listarDocumentos', 'listarTurmas', 'listarEntregas']
      .forEach(k => { if (api[k]) api[k] = lento(api[k]); });
    const t0 = Date.now(); await t.MQ.ui.carregar(); const dt = Date.now() - t0;
    assert.ok(pico >= 5, 'chamadas simultâneas: ' + pico);
    assert.ok(dt < 10 * 15, 'levou ' + dt + ' ms');
    assert.ok(t.S.equipe.length > 0 && Array.isArray(t.S.fichas) && Array.isArray(t.S.solic));
  });
  test('sem internet no meio: mostra a cópia guardada (não quebra)', async () => {
    const t = await montar('bolsista'); const n = t.S.equipe.length;
    t.api.listarVisitas = async () => { const e = new Error('Failed to fetch'); e.semRede = true; throw e; };
    await t.MQ.ui.carregar(); assert.equal(t.S.semRede, true); assert.equal(t.S.equipe.length, n);
  });
});
