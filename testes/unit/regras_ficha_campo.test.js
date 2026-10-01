/* Regras da ficha de indicação e do diagnóstico de campo (js/regras.js). */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais, simples } = require('./ambiente');

let R, MQ;
beforeEach(() => { ({ MQ } = carregar(['dados.js', 'regras.js'], { ui: { S: { kitPar: { valor_quintal: 5000 } } } })); R = MQ.regras; });

const todosCriterios = (v = true) => Object.fromEntries(MQ.CRITERIOS.map(([k]) => [k, v]));
function fichaOk(extra = {}) {
  return Object.assign({ id: 'f1', uf: 'PI', nome: 'Maria das Dores', cpf: '52998224725', data_nascimento: '1980-05-05', municipio: 'Picos', comunidade: 'Baixa Verde',
    endereco: 'Sítio Baixa Verde, 10', consent_dados: true, autodeclaracao: true, resultado: 'selecionada', data_ficha: diaMais(-1),
    tem_foto_termo: true, tem_foto_ficha: true }, todosCriterios(true), extra);
}

describe('pontuação de prioridade e critérios', () => {
  test('soma os pesos marcados (2+2+2+1+1+1+1 = 10 no máximo)', () => {
    const todas = Object.fromEntries(MQ.PRIORIDADES.map(([k]) => [k, true]));
    assert.equal(R.pontosFicha(todas), 10);
    assert.equal(R.pontosFicha({}), 0);
    assert.equal(R.pontosFicha({ p_sustento: true, p_jovem: true }), 3);
  });
  test('criteriosOk só com todos os critérios = true (não aceita "truthy")', () => {
    assert.equal(R.criteriosOk(todosCriterios(true)), true);
    assert.equal(R.criteriosOk(Object.assign(todosCriterios(true), { c_agua: false })), false);
    assert.equal(R.criteriosOk(Object.assign(todosCriterios(true), { c_agua: 'sim' })), false);
  });
});

describe('resultadosPossiveis', () => {
  test('todos os critérios + autodeclaração: selecionada ou lista de espera', () =>
    assert.deepEqual(simples(R.resultadosPossiveis(Object.assign(todosCriterios(), { autodeclaracao: true }))), ['selecionada', 'lista_espera']));
  test('todos os critérios sem autodeclaração: não atende', () =>
    assert.deepEqual(simples(R.resultadosPossiveis(todosCriterios())), ['nao_atende']));
  test('só falta água: sem água ou não atende', () =>
    assert.deepEqual(simples(R.resultadosPossiveis(Object.assign(todosCriterios(), { c_agua: false }))), ['sem_agua', 'nao_atende']));
  test('falta outro critério (ou dois): só não atende', () => {
    assert.deepEqual(simples(R.resultadosPossiveis(Object.assign(todosCriterios(), { c_maior18: false }))), ['nao_atende']);
    assert.deepEqual(simples(R.resultadosPossiveis(Object.assign(todosCriterios(), { c_agua: false, c_espaco: false }))), ['nao_atende']);
  });
});

describe('mesma casa escrita de jeitos diferentes', () => {
  test('normEndereco ignora acento, maiúsculas, "sítio", "nº" e pontuação', () => {
    assert.equal(R.normEndereco('Sítio Baixa Verde, nº 10'), R.normEndereco('sitio baixa verde 10'));
    assert.equal(R.normEndereco(null), '');
  });
  test('casasParecidas acha a mesma casa no mesmo município e estado', () => {
    const f = { id: 'novo', uf: 'PI', municipio: 'Picos', endereco: 'Sítio Baixa Verde 10' };
    const lista = [{ id: 'a', uf: 'PI', municipio: 'PICOS', endereco: 'sitio baixa verde, nº 10' },
      { id: 'b', uf: 'BA', municipio: 'Picos', endereco: 'Sítio Baixa Verde 10' },   // outro estado
      { id: 'c', uf: 'PI', municipio: 'Oeiras', endereco: 'Sítio Baixa Verde 10' }];  // outro município
    assert.deepEqual(simples(R.casasParecidas(f, lista).map(x => x.id)), ['a']);
  });
  test('sem endereço não compara (evita acusar todas as fichas vazias)', () =>
    assert.equal(R.casasParecidas({ id: 'x', uf: 'PI', municipio: 'Picos', endereco: '' }, [{ id: 'a', uf: 'PI', municipio: 'Picos', endereco: '' }]).length, 0));
});

describe('validarFicha', () => {
  test('ficha completa e coerente não tem erro', () => assert.deepEqual(simples(R.validarFicha(fichaOk(), [])), {}));
  test('CPF de outra ficha é recusado; a própria ficha não conta', () => {
    assert.match(R.validarFicha(fichaOk(), [{ id: 'outra', cpf: '52998224725' }]).cpf, /já tem ficha/);
    assert.equal(R.validarFicha(fichaOk(), [{ id: 'f1', cpf: '52998224725' }]).cpf, undefined);
  });
  test('critério sem resposta (nem sim nem não) é apontado', () => {
    const f = fichaOk(); delete f.c_agua;
    assert.ok(R.validarFicha(f, []).c_agua);
  });
  test('marcou "tem 18 anos" mas a data diz 17: recusa', () => {
    const nasc = new Date(); nasc.setFullYear(nasc.getFullYear() - 17);
    assert.match(R.validarFicha(fichaOk({ data_nascimento: nasc.toISOString().slice(0, 10), data_ficha: R.hoje() }), []).c_maior18, /menos de 18/);
  });
  test('resultado incompatível com os critérios é recusado', () =>
    assert.match(R.validarFicha(fichaOk({ c_agua: false }), []).resultado, /incompatível/));
  test('lista de espera exige posição ≥ 1', () => {
    assert.ok(R.validarFicha(fichaOk({ resultado: 'lista_espera', posicao_espera: 0 }), []).posicao_espera);
    assert.equal(R.validarFicha(fichaOk({ resultado: 'lista_espera', posicao_espera: 1 }), []).posicao_espera, undefined);
  });
  test('sem água exige para onde foi encaminhada', () => {
    const f = fichaOk({ c_agua: false, resultado: 'sem_agua' });
    assert.ok(R.validarFicha(f, []).encaminhada_para);
    assert.equal(R.validarFicha(Object.assign(f, { encaminhada_para: 'Programa Cisternas' }), []).encaminhada_para, undefined);
  });
  test('data da ficha no futuro é recusada; hoje é aceita', () => {
    assert.match(R.validarFicha(fichaOk({ data_ficha: diaMais(1) }), []).data_ficha, /futuro/);
    assert.equal(R.validarFicha(fichaOk({ data_ficha: R.hoje() }), []).data_ficha, undefined);
  });
  test('família: 1 e 30 aceitos; 0 e 31 recusados', () => {
    [1, 30].forEach(n => assert.equal(R.validarFicha(fichaOk({ pessoas_familia: n }), []).pessoas_familia, undefined, String(n)));
    [0, 31].forEach(n => assert.ok(R.validarFicha(fichaOk({ pessoas_familia: n }), []).pessoas_familia, String(n)));
  });
  test('NIS precisa de 11 números quando informado', () => {
    assert.ok(R.validarFicha(fichaOk({ nis: '123' }), []).nis);
    assert.equal(R.validarFicha(fichaOk({ nis: '123.45678.90-1' }), []).nis, undefined);
  });
  test('assinatura digital exige testemunha com nome completo e CPF válido', () => {
    const e = R.validarFicha(fichaOk({ assinatura: 'digital', testemunha_nome: 'José', testemunha_cpf: '123' }), []);
    assert.ok(e.testemunha_nome); assert.ok(e.testemunha_cpf);
  });
  test('sem autorização de dados e sem as fotos: não registra', () => {
    const e = R.validarFicha(fichaOk({ consent_dados: false, tem_foto_termo: false, tem_foto_ficha: false }), []);
    assert.ok(e.consent_dados); assert.ok(e.foto_termo); assert.ok(e.foto_ficha);
  });
  test('ficha vazia aponta os campos básicos sem quebrar', () => {
    const e = R.validarFicha({}, []);
    ['nome', 'cpf', 'data_nascimento', 'municipio', 'comunidade', 'endereco', 'consent_dados', 'resultado', 'data_ficha'].forEach(k => assert.ok(e[k], k));
  });
});

describe('diagnóstico de campo', () => {
  const dg = (extra = {}) => Object.assign({ data_visita: diaMais(-1), latitude: -7.1, familia: [{ nome: 'Maria' }], agua_seca: 'sim', fontes_agua: ['poco'],
    fotos_ok: 3, objetivos: ['consumo'], kit: [{ item: 'Mudas', qtd: '10', valor: 5 }], lote: 1, compromissos: true }, extra);
  test('semAgua: sem água na seca ou só carro-pipa', () => {
    assert.equal(R.semAgua({ agua_seca: 'nao' }), true);
    assert.equal(R.semAgua({ agua_seca: 'sim', fontes_agua: ['carro_pipa'] }), true);
    assert.equal(R.semAgua({ agua_seca: 'sim', fontes_agua: ['carro_pipa', 'poco'] }), false);
    assert.equal(R.semAgua({ agua_seca: 'sim', fontes_agua: [] }), false);
  });
  test('diagnóstico completo não tem erro', () => assert.deepEqual(simples(R.validarDiagnostico(dg())), {}));
  test('menos de 3 fotos é recusado; exatamente 3 aceito', () => {
    assert.ok(R.validarDiagnostico(dg({ fotos_ok: 2 })).fotos);
    assert.equal(R.validarDiagnostico(dg({ fotos_ok: 3 })).fotos, undefined);
  });
  test('sem GPS exige motivo com pelo menos 5 letras', () => {
    assert.ok(R.validarDiagnostico(dg({ latitude: null, sem_gps_motivo: 'céu' })).sem_gps_motivo);
    assert.equal(R.validarDiagnostico(dg({ latitude: null, sem_gps_motivo: 'Sem sinal de GPS na serra' })).sem_gps_motivo, undefined);
  });
  test('kit no limite (R$ 5.000) passa; R$ 5.000,01 não passa', () => {
    assert.equal(R.validarDiagnostico(dg({ kit_total: 5000 })).kit, undefined);
    assert.match(R.validarDiagnostico(dg({ kit_total: 5000.01 })).kit, /passa do valor/);
  });
  test('item do kit sem preço é recusado', () => assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'Mudas', qtd: '1', valor: 0 }] })).kit, /valor estimado/));
  test('total calculado a partir de quantidade × valor (vírgula decimal)', () =>
    assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'Tela', qtd: '1,5', valor: 3400 }] })).kit, /passa do valor/));
  test('sem água: não pede kit, objetivo, lote nem compromissos', () => {
    const e = R.validarDiagnostico(dg({ agua_seca: 'nao', kit: [], objetivos: [], lote: null, compromissos: false }));
    ['kit', 'objetivos', 'lote', 'compromissos'].forEach(k => assert.equal(e[k], undefined, k));
  });
  test('data no futuro e área zero são recusadas', () => {
    const e = R.validarDiagnostico(dg({ data_visita: diaMais(2), area_m2: 0 }));
    assert.ok(e.data_visita); assert.ok(e.area_m2);
  });
});

describe('datas inválidas (vindas da fila do celular ou de outro aparelho)', () => {
  test('ficha com data de nascimento que não é data é recusada', () =>
    assert.ok(R.validarFicha(fichaOk({ data_nascimento: '31/02/1980' }), []).data_nascimento));
  test('idade de data inválida é nula (não um número sem sentido)', () => assert.equal(R.idade('abc'), null));
});
