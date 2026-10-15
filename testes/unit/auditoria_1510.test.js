/* Auditoria de 15/10/2026: as regras corrigidas na tela de quem acompanha e em "Onde vender". */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');

describe('Onde vender: dia da semana da feira', () => {
  const MQ = carregar(['dados.js', 'regras.js', 'venda.js'], { ui: { S: {}, esc: s => String(s) } }).MQ;
  const dias = t => MQ.vendaUI.diasDe(t).map((x, i) => x ? ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'][i] : '').filter(Boolean).join(',');
  test('palavra inteira: "Quintais" não é quinta; "São Domingos" não é domingo; "segunda quinzena" não é segunda', () => {
    assert.equal(dias('Feira dos Quintais Produtivos, aos sábados'), 'sab');
    assert.equal(dias('Praça São Domingos, sábados'), 'sab');
    assert.equal(dias('segunda quinzena do mês'), '');
  });
  test('abreviações e intervalos', () => {
    assert.equal(dias('Sáb 5h'), 'sab'); assert.equal(dias('2ª feira'), 'seg'); assert.equal(dias('quintas e domingos'), 'qui,dom');
    assert.equal(dias('Segunda a sexta'), 'seg,ter,qua,qui,sex'); assert.equal(dias('Seg-sex, 6h'), 'seg,ter,qua,qui,sex'); assert.equal(dias('de terça até sábado'), 'ter,qua,qui,sex,sab');
  });
});

describe('Tela de quem acompanha: metas com a mesma regra da coordenação', () => {
  const MQ = carregar(['dados.js', 'regras.js', 'painel.js', 'acompanhamento.js'], { ui: { S: {}, esc: s => String(s), nomeUF: u => u } }).MQ;
  const uf = (o) => Object.assign({ uf: 'PI', selecionadas: 0, diagnosticos: 0, planos: 0, implantados: 0, acompanhamentos: 0, avaliacoes: 0, bolsistas: 0, agentes: 0, equipe_campo: 0, habilitadas: 0 }, o);
  const a = (o, extra) => ({ hoje: '2026-10-15', por_uf: [uf(o)], municipios: [], mensal: [], extra });
  const meta = (r, id) => r.metas.find(x => x.m.id === id);
  test('M1 não fica "Concluída" no 2º mês com equipe completa (a meta é ter equipe os 12 meses)', () => {
    const r = MQ.acomp.situacaoMetas(a({ bolsistas: 10, equipe_campo: 10, habilitadas: 10 }));
    assert.equal(meta(r, 'M1').st, 'andamento'); assert.equal(meta(r, 'M1').alvo, 10);
  });
  test('M5 conta eventos feitos, não autorizados', () => {
    const r = MQ.acomp.situacaoMetas(a({}, { atividades: { eventos: { autorizados: 5, realizados: 0 }, intercambio: { autorizados: 25, viagens_feitas: 0 }, pedagogico: { autorizados: 3, viagens_feitas: 0 } } }));
    assert.equal(meta(r, 'M5').v, 0); assert.notEqual(meta(r, 'M5').st, 'concluida');
    assert.equal(meta(r, 'M6').v, 0, '25 passagens autorizadas não são 25 intercâmbios');
  });
  test('M8 aparece como registrada fora do sistema (sem "0 de 1" para sempre)', () => {
    const r = MQ.acomp.situacaoMetas(a({})); assert.equal(meta(r, 'M8').v, null);
  });
  test('Recursos por meta inclui as bolsas (M1) e o comum: a soma fecha com o executado', () => {
    MQ.ui.S.acAba = 'recursos';
    const ex = { financeiro: { liberado: 'previa', posicao_em: '2026-12-31', por_item: [{ item: 'repasse_mda', valor: 1000000 }, { item: 'bolsa_articulacao', rubrica: 'r2', valor: 11000 }, { item: 'combustivel', valor: 800 }, { item: null, rubrica: null, valor: 500 }] } };
    const h = MQ.acomp.corpo(Object.assign(a({}), { extra: ex }));
    assert.match(h, /M1 · Equipe e coordenação[\s\S]*R\$\s?11\.000/); assert.match(h, /Comum a todas as metas/); assert.match(h, /Não classificado/);
  });
});
