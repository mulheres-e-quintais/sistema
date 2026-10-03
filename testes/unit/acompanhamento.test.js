/* Perfis de acompanhamento (js/acompanhamento.js): a conta dos números agregados que o MDA e o MPA veem.
   A mesma forma do que a função acompanhamento_dados (52_acompanhamento.sql) devolve. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');

const MQ = carregar(['dados.js', 'regras.js', 'acompanhamento.js'], { ui: { S: {}, esc: s => String(s) } }).MQ;
const HOJE = '2026-12-15';
const ficha = (i, o) => Object.assign({ id: 'f' + i, uf: 'PI', municipio: 'Picos', comunidade: 'Sítio ' + (i % 3), nome: 'Maria Secreta ' + i, cpf: '5299822472' + (i % 10), endereco: 'Rua Escondida ' + i, celular: '8999990000' + (i % 10),
  data_nascimento: '1980-06-10', pessoas_familia: 4, resultado: 'selecionada', situacao: 'aprovada', p_sustento: true, p_cadunico: i % 2 === 0, p_sem_ater: false, p_raca_povo: i < 3, p_jovem: false, p_grupo: true, p_caf: i < 6 }, o);
const base = () => {
  const fichas = Array.from({ length: 12 }, (_, i) => ficha(i, i === 10 ? { resultado: 'lista_espera' } : i === 11 ? { resultado: 'sem_agua' } : i === 9 ? { uf: 'BA', municipio: 'Itiúba' } : i === 8 ? { municipio: 'PICOS ', data_nascimento: '2000-01-01' } : {}));
  const visitas = [
    { id: 'v1', ficha_id: 'f0', uf: 'PI', etapa: 'diagnostico', situacao: 'realizada', data_prevista: '2026-10-20', data_realizada: '2026-10-20' },
    { id: 'v2', ficha_id: 'f1', uf: 'PI', etapa: 'diagnostico', situacao: 'realizada', data_prevista: '2026-11-05', data_realizada: '2026-11-06' },
    { id: 'v3', ficha_id: 'f0', uf: 'PI', etapa: 'implantacao', situacao: 'realizada', data_prevista: '2026-11-20', data_realizada: '2026-11-20' },
    { id: 'v4', ficha_id: 'f2', uf: 'PI', etapa: 'diagnostico', situacao: 'prevista', data_prevista: '2026-12-01' },      // atrasada
    { id: 'v5', ficha_id: 'f3', uf: 'PI', etapa: 'diagnostico', situacao: 'prevista', data_prevista: '2026-12-20' },      // agendada
    { id: 'v6', ficha_id: 'f4', uf: 'PI', etapa: 'diagnostico', situacao: 'cancelada', data_prevista: '2026-11-01' },
    { id: 'v7', ficha_id: 'f0', uf: 'PI', etapa: 'acompanhamento', situacao: 'realizada', data_prevista: '2026-12-10', data_realizada: '2026-12-10' },
    { id: 'v8', ficha_id: 'fantasma', uf: 'PI', etapa: 'diagnostico', situacao: 'realizada', data_prevista: '2026-10-20', data_realizada: '2026-10-20' }];
  const diagnosticos = [{ ficha_id: 'f0', uf: 'PI', situacao: 'aprovado', sem_agua: false, area_m2: 300, renda_quintal: 100 }, { ficha_id: 'f1', uf: 'PI', situacao: 'aguardando', sem_agua: false, area_m2: 200, renda_quintal: 50 },
    { ficha_id: 'f5', uf: 'PI', situacao: 'aprovado', sem_agua: true, area_m2: 999 }];
  const equipe = [{ id: 'e1', status: 'ativa', papel: 'articulacao', uf: 'PI', nome: 'Ana Oculta', email: 'ana@oculta.br', cpf: '11144477735' }, { id: 'e2', status: 'ativa', papel: 'agente', uf: 'PI', nome: 'Gil Oculto' },
    { id: 'e3', status: 'desligada', papel: 'apoio', uf: 'PI', nome: 'Saiu' }, { id: 'e4', status: 'ativa', papel: 'coord_tecnico', uf: null, nome: 'Tec' }];
  return { fichas, visitas, diagnosticos, avaliacoes: [], equipe, turmas: [{ id: 't' }], matriculas: [{ id: 'm1' }, { id: 'm2' }], encontros: [] };
};
const uf = (a, u) => a.por_uf.find(x => x.uf === u);
const soma = (a, k) => a.por_uf.reduce((t, x) => t + x[k], 0);

describe('números do acompanhamento', () => {
  test('traz sempre os 5 estados, em ordem, mesmo os que não têm nada', () => {
    const a = MQ.acomp.calcular(base(), 'mda', HOJE);
    assert.equal(a.por_uf.map(x => x.uf).join(','), 'AL,BA,PE,PI,SE');
    assert.equal(uf(a, 'SE').indicadas + uf(a, 'SE').visitas_feitas, 0);
  });
  test('conta por estado: indicadas, selecionadas, espera, sem água, pessoas, municípios e comunidades', () => {
    const p = uf(MQ.acomp.calcular(base(), 'mda', HOJE), 'PI');
    assert.equal(p.indicadas, 11); assert.equal(p.selecionadas, 9); assert.equal(p.espera, 1); assert.equal(p.sem_agua, 1);
    assert.equal(p.pessoas, 36); assert.equal(p.municipios, 1, '"Picos" e "PICOS " são o mesmo município'); assert.equal(p.comunidades, 3);
  });
  test('ficha devolvida ou aguardando não conta como selecionada', () => {
    const d = base(); d.fichas[0].situacao = 'aguardando'; d.fichas[1].situacao = 'devolvida';
    assert.equal(uf(MQ.acomp.calcular(d, 'mda', HOJE), 'PI').selecionadas, 7);
  });
  test('etapas: diagnósticos, planos, implantados, acompanhamentos, área (sem os quintais sem água)', () => {
    const p = uf(MQ.acomp.calcular(base(), 'mda', HOJE), 'PI');
    assert.equal(p.diagnosticos, 3); assert.equal(p.planos, 1); assert.equal(p.diag_sem_agua, 1); assert.equal(p.area_m2, 500);
    assert.equal(p.implantados, 1); assert.equal(p.acompanhamentos, 1); assert.equal(p.visitas_feitas, 4);
  });
  test('visita cancelada não conta; vencida e sem registro é atrasada; com data à frente é agendada', () => {
    const p = uf(MQ.acomp.calcular(base(), 'mpa', HOJE), 'PI');
    assert.equal(p.atrasadas, 1); assert.equal(p.agendadas, 1);
    assert.equal(uf(MQ.acomp.calcular(base(), 'mpa', '2026-12-20'), 'PI').agendadas, 1, 'no próprio dia ainda é agendada');
    assert.equal(uf(MQ.acomp.calcular(base(), 'mpa', '2026-12-21'), 'PI').atrasadas, 2);
  });
  test('visita de ficha que não existe fica fora', () => {
    const a = MQ.acomp.calcular(base(), 'mda', HOJE);
    assert.equal(soma(a, 'visitas_feitas'), 4);
  });
  test('equipe por estado: só quem está ativa; coordenação não conta como equipe de campo', () => {
    const p = uf(MQ.acomp.calcular(base(), 'mpa', HOJE), 'PI');
    assert.equal(p.bolsistas, 1); assert.equal(p.agentes, 1);
  });
  test('municípios: a soma é igual ao total de selecionadas e os implantados entram', () => {
    const a = MQ.acomp.calcular(base(), 'mda', HOJE);
    assert.equal(a.municipios.reduce((t, m) => t + m.n, 0), soma(a, 'selecionadas'));
    assert.deepEqual(JSON.parse(JSON.stringify(a.municipios.map(m => [m.uf, m.n, m.implantados]))), [['BA', 1, 0], ['PI', 9, 1]]);
  });
  test('por mês: a soma das etapas é igual ao total de visitas feitas, em ordem de data', () => {
    const a = MQ.acomp.calcular(base(), 'mda', HOJE);
    assert.equal(a.mensal.map(m => m.mes).join(','), '2026-10,2026-11,2026-12');
    assert.equal(a.mensal.reduce((t, m) => t + m.diagnostico + m.implantacao + m.acompanhamento + m.avaliacao, 0), soma(a, 'visitas_feitas'));
  });
});

describe('o que cada órgão recebe', () => {
  test('MDA recebe perfil e impacto, e não recebe formação', () => {
    const a = MQ.acomp.calcular(base(), 'mda', HOJE);
    assert.ok(a.perfil && a.impacto); assert.equal(a.formacao, undefined);
  });
  test('MPA recebe formação, e não recebe perfil nem impacto', () => {
    const a = MQ.acomp.calcular(base(), 'mpa', HOJE);
    assert.equal(a.formacao.turmas, 1); assert.equal(a.formacao.matriculas, 2); assert.equal(a.perfil, undefined); assert.equal(a.impacto, undefined);
  });
  test('nenhum dos dois recebe nome, CPF, e-mail, endereço, celular nem comunidade', () => {
    for (const o of ['mda', 'mpa']) { const t = JSON.stringify(MQ.acomp.calcular(base(), o, HOJE));
      for (const proibido of ['Secreta', '5299822472', 'Escondida', '8999990000', 'Oculta', 'Oculto', 'ana@', '11144477735', 'Sítio']) assert.ok(!t.includes(proibido), o + ' recebeu ' + proibido); }
  });
  test('nenhuma parte financeira no que sai', () => {
    for (const o of ['mda', 'mpa']) assert.doesNotMatch(JSON.stringify(MQ.acomp.calcular(base(), o, HOJE)), /bolsa|pagament|orcament|saldo|pix|banco|kit_total|teto|valor/i);
  });
});

describe('proteção contra identificação (contagem pequena)', () => {
  test('de 1 a 4 vira -1; zero e 5 ou mais saem como são', () => {
    assert.deepEqual([0, 1, 4, 5, 200].map(MQ.acomp.pequeno), [0, -1, -1, 5, 200]);
  });
  test('perfil: grupo de 3 mulheres aparece como "menos de 5"; grupo de 10 aparece inteiro', () => {
    const p = MQ.acomp.calcular(base(), 'mda', HOJE).perfil;
    assert.equal(p.base, 10); assert.equal(p.sustento, 10); assert.equal(p.raca_povo, -1); assert.equal(p.cadunico, 5); assert.equal(p.sem_ater, 0); assert.equal(p.caf, 6);
  });
  test('idade: calculada na data de hoje; faixa com 1 pessoa não aparece', () => {
    const p = MQ.acomp.calcular(base(), 'mda', HOJE).perfil;
    assert.equal(p.faixas['18 a 29'], -1); assert.equal(p.faixas['45 a 59'], 9); assert.equal(p.faixas['60 ou mais'], 0);
    const d = base(); d.fichas.forEach(f => { f.data_nascimento = '1996-12-16'; });   // faz 30 anos amanhã
    assert.equal(MQ.acomp.calcular(d, 'mda', HOJE).perfil.faixas['18 a 29'], 10);
    assert.equal(MQ.acomp.calcular(d, 'mda', '2026-12-16').perfil.faixas['30 a 44'], 10);
  });
  test('impacto: média de venda só com 5 diagnósticos ou mais; avaliações pequenas não aparecem', () => {
    const d = base(); assert.equal(MQ.acomp.calcular(d, 'mda', HOJE).impacto.renda_quintal_media, null);
    d.diagnosticos = Array.from({ length: 6 }, (_, i) => ({ ficha_id: 'f' + i, uf: 'PI', situacao: 'aprovado', sem_agua: false, area_m2: 100, renda_quintal: 100 + i * 10 }));
    d.avaliacoes = [{ ficha_id: 'f0', uf: 'PI', quintal_produz: 'sim', ebia_nivel: 'leve' }, { ficha_id: 'f1', uf: 'PI', quintal_produz: 'sim', ebia_nivel: 'seguranca' }];
    const i = MQ.acomp.calcular(d, 'mda', HOJE).impacto;
    assert.equal(i.renda_quintal_media, 125); assert.equal(i.base_n, 6); assert.equal(i.final_n, 2); assert.equal(i.produz.sim, -1); assert.equal(i.produz.nao, 0); assert.equal(i.ebia_final.leve, -1);
  });
  test('banco vazio: tudo zero, sem erro', () => {
    const a = MQ.acomp.calcular({}, 'mda', HOJE);
    assert.equal(soma(a, 'indicadas'), 0); assert.equal(a.municipios.length, 0); assert.equal(a.mensal.length, 0); assert.equal(a.perfil.base, 0); assert.equal(a.impacto.renda_quintal_media, null);
  });
});

describe('teste por sorteio (300 bancos inventados)', () => {
  // gerador simples e repetível: o mesmo sorteio a cada rodada
  let semente = 20261003; const rnd = n => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente % n; };
  const UFS = ['AL', 'BA', 'PE', 'PI', 'SE'], RES = ['selecionada', 'selecionada', 'selecionada', 'lista_espera', 'nao_atende', 'sem_agua'], SIT = ['aprovada', 'aprovada', 'aguardando', 'devolvida'];
  const ET = ['diagnostico', 'implantacao', 'acompanhamento', 'avaliacao'], SV = ['prevista', 'realizada', 'realizada', 'cancelada'];
  const banco = () => {
    const nf = rnd(60), fichas = Array.from({ length: nf }, (_, i) => ({ id: 'f' + i, uf: UFS[rnd(5)], municipio: ['Picos', 'PICOS', 'Itiúba', 'Itiuba ', 'Arapiraca'][rnd(5)], comunidade: 'Comunidade Reservada ' + rnd(6), nome: 'Nome Reservado ' + i, cpf: String(10000000000 + i * 7919),
      endereco: 'Endereço Reservado ' + i, celular: '8499' + (1000000 + i), data_nascimento: (1940 + rnd(68)) + '-' + String(1 + rnd(12)).padStart(2, '0') + '-' + String(1 + rnd(28)).padStart(2, '0'), pessoas_familia: 1 + rnd(9),
      resultado: RES[rnd(6)], situacao: SIT[rnd(4)], p_sustento: !rnd(2), p_cadunico: !rnd(2), p_sem_ater: !rnd(3), p_raca_povo: !rnd(4), p_jovem: !rnd(5), p_grupo: !rnd(2), p_caf: !rnd(3) }));
    const visitas = Array.from({ length: rnd(120) }, (_, i) => { const f = fichas[rnd(Math.max(1, nf))] || { id: 'x', uf: 'PI' }; const sit = SV[rnd(4)]; const d = '2026-' + String(10 + rnd(3)).padStart(2, '0') + '-' + String(1 + rnd(28)).padStart(2, '0');
      return { id: 'v' + i, ficha_id: rnd(15) ? f.id : 'orfa', uf: f.uf, etapa: ET[rnd(4)], situacao: sit, data_prevista: d, data_realizada: sit === 'realizada' ? d : null }; });
    const diagnosticos = fichas.filter(() => !rnd(3)).map(f => ({ ficha_id: f.id, uf: f.uf, situacao: ['aprovado', 'aguardando', 'devolvido'][rnd(3)], sem_agua: !rnd(6), area_m2: rnd(900), renda_quintal: rnd(4) ? rnd(500) : null }));
    const avaliacoes = fichas.filter(() => !rnd(5)).map(f => ({ ficha_id: f.id, uf: f.uf, quintal_produz: ['sim', 'em_parte', 'nao'][rnd(3)], ebia_nivel: ['seguranca', 'leve', 'moderada', 'grave'][rnd(4)] }));
    const equipe = Array.from({ length: rnd(25) }, (_, i) => ({ id: 'e' + i, nome: 'Equipe Reservada ' + i, email: 'reservado' + i + '@x.br', cpf: String(20000000000 + i), status: rnd(4) ? 'ativa' : 'desligada', papel: ['articulacao', 'apoio', 'agente', 'coord_tecnico'][rnd(4)], uf: UFS[rnd(5)] }));
    return { fichas, visitas, diagnosticos, avaliacoes, equipe, turmas: [], matriculas: [], encontros: [] };
  };
  test('em qualquer banco: as somas fecham, nada pessoal sai, grupo pequeno não aparece', () => {
    for (let k = 0; k < 300; k++) {
      const d = banco(); const hoje = '2026-' + String(10 + rnd(3)) + '-' + String(1 + rnd(28)).padStart(2, '0');
      for (const o of ['mda', 'mpa']) {
        const a = MQ.acomp.calcular(d, o, hoje), txt = JSON.stringify(a), ctx = 'rodada ' + k + ' ' + o;
        const sel = d.fichas.filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada');
        assert.equal(a.por_uf.length, 5, ctx);
        assert.equal(soma(a, 'indicadas'), d.fichas.length, ctx + ' indicadas');
        assert.equal(soma(a, 'selecionadas'), sel.length, ctx + ' selecionadas');
        assert.equal(a.municipios.reduce((t, m) => t + m.n, 0), sel.length, ctx + ' municípios');
        assert.equal(a.mensal.reduce((t, m) => t + m.diagnostico + m.implantacao + m.acompanhamento + m.avaliacao, 0), soma(a, 'visitas_feitas'), ctx + ' meses');
        const ids = new Set(d.fichas.map(f => f.id));
        assert.equal(soma(a, 'visitas_feitas'), d.visitas.filter(v => v.situacao === 'realizada' && ids.has(v.ficha_id)).length, ctx + ' visitas');
        assert.ok(a.por_uf.every(u => Object.entries(u).every(([c, v]) => c === 'uf' || (Number.isInteger(v) && v >= 0))), ctx + ' só inteiros não negativos por estado');
        assert.ok(a.por_uf.every(u => u.selecionadas <= u.indicadas && u.planos <= u.diagnosticos && u.implantados + u.acompanhamentos <= u.visitas_feitas && u.municipios <= u.comunidades), ctx + ' coerência entre as etapas');
        assert.ok(!/Reservad|reservado|8499\d|1000000\d{4}|2000000\d{4}/.test(txt), ctx + ' vazou dado pessoal');
        assert.ok(!/bolsa|pagament|orcament|saldo|pix|banco|teto|valor/i.test(txt), ctx + ' parte financeira');
        if (o === 'mda') {
          const p = a.perfil, todos = [p.sustento, p.cadunico, p.sem_ater, p.raca_povo, p.jovem, p.grupo, p.caf].concat(Object.values(p.faixas), Object.values(a.impacto.produz), Object.values(a.impacto.ebia_final));
          assert.ok(todos.every(v => v === -1 || v === 0 || v >= 5), ctx + ' apareceu contagem de 1 a 4: ' + todos.join(','));
          assert.ok(todos.every(v => v <= Math.max(p.base, a.impacto.final_n)), ctx + ' parcela maior que o todo');
          const fx = Object.values(p.faixas); if (fx.every(v => v >= 0)) assert.equal(fx.reduce((t, v) => t + v, 0), p.base, ctx + ' faixas de idade somam a base');
          assert.equal(a.formacao, undefined, ctx);
        } else { assert.equal(a.perfil, undefined, ctx); assert.equal(a.impacto, undefined, ctx); }
      }
    }
  });
});
