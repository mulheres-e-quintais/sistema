/* Impressões da coordenação geral na aba Documentos (js/documentos.js):
   relatórios por tipo (equipe, seleção, campo) e fichas de cadastro (bolsistas e demais membros). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais } = require('./ambiente');

const docs = () => carregar(['dados.js', 'regras.js', 'documentos.js'], { ui: { S: {}, esc: s => String(s), nomeUF: u => u } }).MQ.docsUI;
const p = (o) => Object.assign({ id: o.nome, status: 'ativa', cpf: '52998224725', email: 'a@b.com', telefone: '84999990000', data_inicio: '2026-10-01', municipio: 'Picos',
  matricula_fic_em: '2026-10-05', docs_funcern_em: '2026-10-06', termo_assinado_em: '2026-10-07', pix_chave: 'SEGREDO-PIX', banco: 'SEGREDO-BANCO', conta: '99999-9' }, o);
const s = () => ({
  equipe: [p({ nome: 'Geral Um', papel: 'coord_geral', uf: null }), p({ nome: 'Tecnica Uma', papel: 'coord_tecnico', uf: null }),
    p({ nome: 'Ana Articula', papel: 'articulacao', uf: 'PI' }), p({ nome: 'Bia Apoio', papel: 'apoio', uf: 'PI', termo_assinado_em: null }),
    p({ nome: 'Carla Bahia', papel: 'articulacao', uf: 'BA' }), p({ nome: 'Gil Agente', papel: 'agente', uf: 'PI' }),
    p({ nome: 'Saiu Antes', papel: 'apoio', uf: 'BA', status: 'desligada' })],
  fichas: [{ id: 'f1', uf: 'PI', municipio: 'Picos', comunidade: 'Sítio', nome: 'Maria Exemplo', cpf: '11144477735', resultado: 'selecionada', situacao: 'aprovada' },
    { id: 'f2', uf: 'PI', municipio: 'Picos', comunidade: 'Sítio', nome: 'Joana Exemplo', cpf: '11144477735', resultado: 'lista_espera', situacao: 'aguardando' },
    { id: 'f3', uf: 'BA', municipio: 'Juazeiro', comunidade: 'Roça', nome: 'Rita Exemplo', cpf: '11144477735', resultado: 'selecionada', situacao: 'aprovada' }],
  visitas: [{ id: 'v1', ficha_id: 'f1', uf: 'PI', etapa: 'diagnostico', executor_id: 'Ana Articula', data_prevista: diaMais(-5), data_realizada: diaMais(-5), situacao: 'realizada' },
    { id: 'v2', ficha_id: 'f1', uf: 'PI', etapa: 'implantacao', executor_id: 'Gil Agente', data_prevista: diaMais(-1), situacao: 'prevista' },
    { id: 'v3', ficha_id: 'f3', uf: 'BA', etapa: 'diagnostico', executor_id: 'Carla Bahia', data_prevista: diaMais(4), situacao: 'prevista' },
    { id: 'v4', ficha_id: 'f3', uf: 'BA', etapa: 'diagnostico', executor_id: 'Carla Bahia', data_prevista: diaMais(2), situacao: 'cancelada' }],
  diagnosticos: [{ uf: 'PI', situacao: 'aprovado' }]
});

describe('relatórios por tipo', () => {
  test('equipe: só ativas, sem a coordenação geral, com a habilitação de cada uma', () => {
    const d = docs().dadosImpressao('rel-equipe', s(), null);
    assert.equal(d.total, 5); assert.equal(d.habilitados, 4);
    assert.ok(!d.linhas.some(x => x.nome === 'Geral Um' || x.nome === 'Saiu Antes'));
    assert.equal(d.linhas.find(x => x.nome === 'Bia Apoio').termo, null);
  });
  test('equipe por estado: quem não tem estado (coordenação) continua na lista', () => {
    const d = docs().dadosImpressao('rel-equipe', s(), 'BA');
    assert.deepEqual(d.linhas.map(x => x.nome).sort(), ['Carla Bahia', 'Tecnica Uma']);
  });
  test('seleção: totais por estado e a lista sem CPF', () => {
    const d = docs().dadosImpressao('rel-selecao', s(), null);
    const pi = d.porUF.find(x => x.uf === 'PI');
    assert.deepEqual([pi.lancadas, pi.selecionadas, pi.aguardando, pi.espera], [2, 1, 1, 1]);
    assert.equal(d.linhas.length, 3);
    assert.ok(!JSON.stringify(d).includes('11144477735'));
  });
  test('campo: cancelada não entra; data vencida aparece como atrasada', () => {
    const d = docs().dadosImpressao('rel-campo', s(), null);
    assert.equal(d.total, 3); assert.equal(d.feitas, 1); assert.equal(d.planosAprovados, 1);
    assert.deepEqual(d.linhas.map(x => x.situacao).sort(), ['Agendada', 'Atrasada', 'Feita']);
    assert.equal(d.linhas.find(x => x.situacao === 'Atrasada').quem, 'Gil Agente');
  });
  test('filtro por estado vale para seleção e campo', () => {
    assert.equal(docs().dadosImpressao('rel-selecao', s(), 'BA').linhas.length, 1);
    assert.equal(docs().dadosImpressao('rel-campo', s(), 'BA').total, 1);
  });
});

describe('fichas de cadastro', () => {
  test('bolsistas: só articulação e apoio ativas', () => {
    const d = docs().dadosImpressao('fic-bolsistas', s(), null);
    assert.deepEqual(d.pessoas.map(x => x.nome).sort(), ['Ana Articula', 'Bia Apoio', 'Carla Bahia']);
  });
  test('demais membros: coordenação técnica e agente, sem a coordenação geral', () => {
    const d = docs().dadosImpressao('fic-membros', s(), null);
    assert.deepEqual(d.pessoas.map(x => x.nome).sort(), ['Gil Agente', 'Tecnica Uma']);
  });
  test('nenhuma impressão leva dado bancário', () => {
    Object.keys(docs().IMPRESSOES).forEach(k => {
      const d = docs().dadosImpressao(k, s(), null); const h = docs().htmlImpressao(d, 'Fulana');
      assert.ok(!/SEGREDO|99999-9/.test(JSON.stringify(d) + h), k);
    });
  });
  test('ficha: CPF formatado, uma página por pessoa e aviso de uso interno', () => {
    const h = docs().htmlImpressao(docs().dadosImpressao('fic-bolsistas', s(), 'PI'), 'Fulana');
    assert.equal((h.match(/class="rel ficha-cad"/g) || []).length, 2);
    assert.ok(h.includes('529.982.247-25')); assert.ok(/Uso interno/.test(h));
  });
  test('grupo vazio diz que não há ninguém', () => {
    const v = s(); v.equipe = v.equipe.filter(m => m.papel === 'coord_geral');
    assert.ok(/Nenhuma pessoa ativa/.test(docs().htmlImpressao(docs().dadosImpressao('fic-membros', v, null), '')));
  });
});
