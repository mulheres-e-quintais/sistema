/* QA 01/10/2026 — js/regras.js (e a validação de impacto.js): leitura de números, limites do diagnóstico, da ficha e do kit,
   datas alinhadas com o banco (supabase/45_auditoria_qa.sql) e mensagens de erro em linguagem simples. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais, cpfValido, simples } = require('./ambiente');

const novo = () => { const a = carregar(['dados.js', 'regras.js']); return { MQ: a.MQ, R: a.MQ.regras }; };
const GENERICA = 'Não deu certo. Tente de novo; se continuar, avise a coordenação.';

describe('numBR: o primeiro número do texto', () => {
  const { R } = novo();
  const casos = [['10 kg', 10], ['2,5', 2.5], ['1.000 mudas', 1000], ['20 m²', 20], ['1.5 kg', 1.5], ['0', 0], [5, 5], ['1.250,50', 1250.5], ['R$ 1.600,50', 1600.5],
    ['1/2', 0.5], ['1 / 4 de saco', 0.25], ['1 1/2 kg', 1.5], ['2 de 500 ml', 2], ['3 a 4', 3], ['10-20', 10], ['aprox. 7', 7], ['-1', -1], ['3x', 3]];
  casos.forEach(([t, n]) => test(JSON.stringify(t) + ' → ' + n, () => assert.equal(R.numBR(t), n)));
  test('sem número → null (vazio, texto, traço, null, undefined, NaN, Infinity)', () =>
    assert.deepEqual(['', '   ', 'meia', '-', null, undefined, NaN, Infinity].map(R.numBR), [null, null, null, null, null, null, null, null]));
  test('antes os números eram colados: "1/2" não é 12, "2 de 500 ml" não é 2500, "3 a 4" não é 34', () => {
    assert.notEqual(R.numBR('1/2'), 12); assert.notEqual(R.numBR('2 de 500 ml'), 2500); assert.notEqual(R.numBR('3 a 4'), 34);
  });
  test('numBanco imita o banco (cola os números): serve para saber quando a tela e o banco leriam diferente', () => {
    assert.equal(R.numBanco('1/2'), 12); assert.equal(R.numBanco('2 de 500 ml'), 2500); assert.equal(R.numBanco('10 kg'), 10);
    for (const t of ['10 kg', '2,5', '1.000 mudas', '0,5', '3']) assert.equal(R.numBR(t), R.numBanco(t), t);   // quantidade comum: os dois leem igual
  });
});

describe('kit do quintal', () => {
  const { R, MQ } = novo(); MQ.ui = { S: { kitPar: { valor_quintal: 5000 } } };
  const dg = (extra = {}) => Object.assign({ data_visita: diaMais(-1), latitude: -7.1, familia: [{ nome: 'Maria', idade: 40 }], agua_seca: 'sim', fontes_agua: ['poco'],
    fotos_ok: 3, objetivos: ['consumo'], kit: [{ item: 'Mudas', qtd: '10', valor: 5 }], lote: 1, compromissos: true }, extra);
  test('totalKit: quantidade × valor; item negativo NÃO abate; sem quantidade conta zero', () => {
    assert.equal(R.totalKit([{ item: 'a', qtd: '2', valor: 4000 }, { item: 'b', qtd: '-1', valor: 4000 }]), 8000);
    assert.equal(R.totalKit([{ item: 'a', qtd: '2', valor: -10 }, { item: 'b', qtd: '1,5', valor: 100 }]), 150);
    assert.equal(R.totalKit([{ item: 'a', qtd: '', valor: 9000 }]), 0);
    assert.equal(R.totalKit([{ item: 'a', qtd: '1/2', valor: 100 }]), 50);
    assert.equal(R.totalKit(null), 0); assert.equal(R.totalKit('x'), 0);
  });
  test('item com valor e sem quantidade: "Informe a quantidade de …" (o banco recusaria)', () => {
    const e = R.validarDiagnostico(dg({ kit: [{ item: 'Motobomba', qtd: '', valor: 9000 }] }));
    assert.match(e.kit, /Informe a quantidade de Motobomba/);
    assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'Tela', qtd: '0', valor: 10 }] })).kit, /Informe a quantidade de Tela/);
    assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'Tela', qtd: 'um rolo', valor: 10 }] })).kit, /Informe a quantidade de Tela/);
  });
  test('quantidade negativa não abate o teto: R$ 8.000 + item de -1 é recusado', () => {
    const e = R.validarDiagnostico(dg({ kit: [{ item: 'Caixa', qtd: '2', valor: 4000 }, { item: 'Ajuste', qtd: '-1', valor: 4000 }] }));
    assert.match(e.kit, /quantidade de Ajuste não pode ser negativa/);
  });
  test('valor negativo é recusado; item sem valor passa (04/10/2026: quem faz o diagnóstico não informa preço)', () => {
    assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'Desconto', qtd: '1', valor: -50 }] })).kit, /valor de Desconto não pode ser negativo/);
    assert.equal(R.validarDiagnostico(dg({ kit: [{ item: 'Mudas', qtd: '1', valor: null }] })).kit, undefined);
    assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'Mudas', qtd: '', valor: null }] })).kit, /Informe a quantidade de Mudas/);
  });
  test('kit bom passa; teto conferido em centavos (5.000,00 passa; 5.000,01 não)', () => {
    assert.equal(R.validarDiagnostico(dg()).kit, undefined);
    assert.equal(R.validarDiagnostico(dg({ kit: [{ item: 'a', qtd: '1', valor: 0.1 }, { item: 'b', qtd: '1', valor: 0.2 }, { item: 'c', qtd: '1', valor: 4999.7 }] })).kit, undefined);
    assert.match(R.validarDiagnostico(dg({ kit: [{ item: 'a', qtd: '3', valor: 1666.67 }] })).kit, /passa do valor/);
  });
  test('diagnóstico: números fora do possível são recusados, com mensagem em cada campo', () => {
    const ruim = (extra, campo) => assert.ok(R.validarDiagnostico(dg(extra))[campo], campo + ' deveria acusar: ' + JSON.stringify(extra));
    const bom = (extra, campo) => assert.equal(R.validarDiagnostico(dg(extra))[campo], undefined, campo + ' não deveria acusar: ' + JSON.stringify(extra));
    ruim({ familia: [{ nome: 'Ana', idade: 121 }] }, 'familia'); ruim({ familia: [{ nome: 'Ana', idade: -1 }] }, 'familia'); ruim({ familia: [{ nome: 'Ana', idade: 3.5 }] }, 'familia');
    bom({ familia: [{ nome: 'Ana', idade: 0 }, { nome: 'Zé', idade: 120 }, { nome: 'Bia', idade: null }] }, 'familia');
    ruim({ renda_familiar: -1 }, 'renda_familiar'); ruim({ renda_familiar: 100001 }, 'renda_familiar'); bom({ renda_familiar: 0 }, 'renda_familiar'); bom({ renda_familiar: 100000 }, 'renda_familiar');
    ruim({ renda_quintal: -0.01 }, 'renda_quintal'); ruim({ renda_quintal: 1e9 }, 'renda_quintal'); bom({ renda_quintal: null }, 'renda_quintal');
    ruim({ area_m2: 0 }, 'area_m2'); ruim({ area_m2: -5 }, 'area_m2'); ruim({ area_m2: 100001 }, 'area_m2'); bom({ area_m2: 100000 }, 'area_m2'); bom({ area_m2: null }, 'area_m2');
    ruim({ capacidade_litros: -1 }, 'capacidade_litros'); bom({ capacidade_litros: 0 }, 'capacidade_litros'); ruim({ distancia_m: -3 }, 'distancia_m');
    ruim({ meses_seca: 13 }, 'meses_seca'); ruim({ meses_seca: -1 }, 'meses_seca'); bom({ meses_seca: 12 }, 'meses_seca'); bom({ meses_seca: 0 }, 'meses_seca');
    ruim({ horas_dia: 25 }, 'horas_dia'); ruim({ horas_dia: -1 }, 'horas_dia'); bom({ horas_dia: 24 }, 'horas_dia'); bom({ horas_dia: 7.5 }, 'horas_dia');
    ruim({ renda_familiar: NaN }, 'renda_familiar'); ruim({ meses_seca: Infinity }, 'meses_seca');
  });
  test('diagnóstico: data anterior a 01/01/2026 é recusada (o projeto não tinha começado)', () => {
    assert.match(R.validarDiagnostico(dg({ data_visita: '2019-05-10' })).data_visita, /01\/01\/2026/);
    assert.equal(R.validarDiagnostico(dg({ data_visita: '2026-01-01' })).data_visita, undefined);
  });
});

describe('ficha: limites', () => {
  const { R, MQ } = novo();
  const boa = (extra = {}) => Object.assign({ id: 'f1', nome: 'Maria da Silva', cpf: cpfValido(987654321), data_nascimento: '1980-05-10', municipio: 'Pio IX', comunidade: 'Barra', endereco: 'Sítio Barra, 10',
    pessoas_familia: 4, consent_dados: true, assinatura: 'assinatura', autodeclaracao: true, resultado: 'selecionada', data_ficha: diaMais(0), tem_foto_termo: true, tem_foto_ficha: true },
    Object.fromEntries(MQ.CRITERIOS.map(([c]) => [c, true])), extra);
  test('ficha boa não tem erro', () => assert.deepEqual(simples(R.validarFicha(boa(), [])), {}));
  test('pessoas na família: inteiro de 1 a 30', () => {
    for (const v of [0, 31, -1, 2.5, NaN, 'abc', Infinity]) assert.ok(R.validarFicha(boa({ pessoas_familia: v }), []).pessoas_familia, String(v));
    for (const v of [1, 30, '4', null, undefined]) assert.equal(R.validarFicha(boa({ pessoas_familia: v }), []).pessoas_familia, undefined, String(v));
  });
  test('posição na lista de espera: inteiro de 1 a 999', () => {
    const e = v => R.validarFicha(boa({ resultado: 'lista_espera', posicao_espera: v }), []).posicao_espera;
    for (const v of [0, -1, 1000, 1.5, null, 'x']) assert.ok(e(v), String(v));
    for (const v of [1, 999, '12']) assert.equal(e(v), undefined, String(v));
  });
  test('celular: 10 ou 11 números e DDD de 11 em diante (em branco pode)', () => {
    const e = v => R.validarFicha(boa({ celular: v }), []).celular;
    for (const v of ['99999-9999', '(05) 99999-9999', '(00) 3333-4444', '+55 (89) 99999-9999', '123']) assert.ok(e(v), v);
    for (const v of ['(89) 99999-9999', '(11) 3333-4444', '', null, undefined]) assert.equal(e(v), undefined, String(v));
    assert.equal(R.celularValido('84 9 9999 8888'), true); assert.equal(R.celularValido('10999998888'), false);
  });
});

describe('avaliação final e linha de base (impacto.js): números inteiros e dentro do possível', () => {
  const a = carregar(['dados.js', 'regras.js', 'impacto.js'], { ui: { S: {}, esc: s => String(s) } }); const V = a.MQ.impactoUI.validar;
  const bom = (extra = {}) => Object.assign({ menor: false, ebia_pontos: 0, dias_consumo: 3, especies: 5, criacoes: 1, vende: false, decide: 'nao_vende', caf: 'n' }, extra);
  test('respostas boas não têm erro', () => assert.deepEqual(simples(V(bom())), {}));
  test('dias 0–7, tipos de planta 0–200, tipos de criação 0–30, sem vírgula', () => {
    for (const v of [8, -1, 2.5]) assert.ok(V(bom({ dias_consumo: v })).im_dias, 'dias ' + v);
    for (const v of [201, -1, 1.5, 99999]) assert.ok(V(bom({ especies: v })).im_especies, 'espécies ' + v);
    for (const v of [31, -1, 0.5]) assert.ok(V(bom({ criacoes: v })).im_criacoes, 'criações ' + v);
    for (const [k, v, c] of [['dias_consumo', 7, 'im_dias'], ['dias_consumo', 0, 'im_dias'], ['especies', 200, 'im_especies'], ['criacoes', 30, 'im_criacoes'], ['criacoes', 0, 'im_criacoes']])
      assert.equal(V(bom({ [k]: v }))[c], undefined, k + ' ' + v);
  });
});

describe('datas com os mesmos limites do banco (45_auditoria_qa.sql)', () => {
  const { R } = novo();
  test('agendar ou remarcar visita: de hoje até 31/12/2027; a data antiga que não mudou não trava', () => {
    assert.equal(R.erroDataPrevista(diaMais(0)), null); assert.equal(R.erroDataPrevista('2027-12-31'), null);
    assert.match(R.erroDataPrevista(diaMais(-1)), /já passou/); assert.match(R.erroDataPrevista('2019-03-01'), /já passou/);
    assert.match(R.erroDataPrevista('2028-01-01'), /31\/12\/2027/); assert.match(R.erroDataPrevista('2099-01-01'), /31\/12\/2027/);
    assert.match(R.erroDataPrevista(''), /Informe/); assert.match(R.erroDataPrevista('31/12/2026'), /inválida/);
    assert.equal(R.erroDataPrevista('2026-09-20', '2026-09-20'), null);   // remarcar só a pessoa: a data atrasada continua
    assert.match(R.erroDataPrevista('2026-09-19', '2026-09-20'), /já passou/);
  });
  test('visita feita: de 01/01/2026 até hoje', () => {
    assert.equal(R.erroDataFeita(diaMais(0)), null); assert.equal(R.erroDataFeita('2026-01-01'), null);
    assert.match(R.erroDataFeita(diaMais(1)), /futuro/); assert.match(R.erroDataFeita('2025-12-31'), /01\/01\/2026/); assert.match(R.erroDataFeita(''), /Informe/);
  });
  test('início da bolsa: de 01/01/2025 até um ano à frente', () => {
    assert.equal(R.erroDataInicio('2025-01-01'), null); assert.equal(R.erroDataInicio(diaMais(365)), null);
    assert.match(R.erroDataInicio('2024-12-31'), /01\/01\/2025/); assert.match(R.erroDataInicio(diaMais(366)), /um ano/); assert.match(R.erroDataInicio('2099-01-01'), /um ano/);
  });
  test('passos da habilitação: em branco pode; de 01/01/2025 até hoje', () => {
    assert.equal(R.erroDataPasso(''), null); assert.equal(R.erroDataPasso(null), null); assert.equal(R.erroDataPasso(diaMais(0)), null);
    assert.match(R.erroDataPasso(diaMais(1)), /futuro/); assert.match(R.erroDataPasso('2019-05-10'), /2025/);
  });
  test('desligamento: não antes do início, não no futuro', () => {
    assert.equal(R.erroDataDesligamento(diaMais(0), '2026-09-14'), null);
    assert.match(R.erroDataDesligamento(diaMais(1), '2026-09-14'), /futuro/); assert.match(R.erroDataDesligamento('2026-09-01', '2026-09-14'), /Antes do início/);
    assert.match(R.erroDataDesligamento('', '2026-09-14'), /Informe/);
  });
});

describe('mensagemErro: nada de texto técnico na tela', () => {
  const { R } = novo();
  const TECNICO = /Cannot read|is not a function|undefined|\[object|violates|constraint|duplicate key|JWT|syntax|relation "|column "|TypeError|PGRST|Internal Server/;
  test('códigos do Postgres/PostgREST viram frases simples', () => {
    assert.equal(R.mensagemErro({ code: '23514', message: 'new row for relation "fichas" violates check constraint "fichas_pessoas_familia_check"' }), 'Algum campo está com valor que o sistema não aceita. Confira e tente de novo.');
    assert.equal(R.mensagemErro({ code: '23502', message: 'null value in column "uf" of relation "visitas" violates not-null constraint' }), 'Algum campo está com valor que o sistema não aceita. Confira e tente de novo.');
    assert.equal(R.mensagemErro({ code: '22003', message: 'numeric field overflow' }), 'Valor grande demais.');
    assert.equal(R.mensagemErro({ code: '22007', message: 'invalid input syntax for type date: "x"' }), 'Data inválida.');
    assert.equal(R.mensagemErro({ code: '22008', message: 'date/time field value out of range' }), 'Data inválida.');
    assert.equal(R.mensagemErro({ code: 'PGRST301', message: 'JWT expired' }), 'Sua sessão venceu. Entre de novo.');
    assert.equal(R.mensagemErro({ message: 'JWT expired' }), 'Sua sessão venceu. Entre de novo.');
    assert.equal(R.mensagemErro({ code: '42501', message: 'must be owner of table x' }), 'Sua sessão venceu. Entre de novo.');
    assert.match(R.mensagemErro({ code: '57014', message: 'canceling statement due to statement timeout' }), /demorou demais/);
    assert.match(R.mensagemErro({ code: '23505', message: 'duplicate key value violates unique constraint "qualquer_key"' }), /já existe/);
  });
  test('duplicados com texto próprio para cada regra do banco', () => {
    const dup = c => R.mensagemErro({ code: '23505', message: `duplicate key value violates unique constraint "${c}"` });
    assert.equal(dup('uma_por_mes'), 'Você já solicitou este mês.');
    assert.match(dup('solicitacao_visitas_pkey'), /visita já está em outro pedido/);
    assert.match(dup('entregas_mes_pkey'), /entrega do mês já estava marcada/);
    assert.match(dup('documentos_projeto_arquivo_path_key'), /arquivo já foi anexado/);
    assert.match(dup('execucao_um_estorno'), /já foi estornado/);
    assert.match(dup('avaliacoes_visita_id_key'), /já tem avaliação/);
    assert.match(dup('equipe_cpf_ativo'), /CPF/); assert.match(dup('fichas_cpf_unico'), /já tem ficha/);
  });
  test('mensagem do projeto (raise exception, P0001, em português) passa como veio', () => {
    assert.equal(R.mensagemErro({ code: 'P0001', message: 'A data da ficha não pode ser no futuro.' }), 'A data da ficha não pode ser no futuro.');
    assert.equal(R.mensagemErro(new Error('Agende antes a visita de avaliação no roteiro de campo.')), 'Agende antes a visita de avaliação no roteiro de campo.');
    assert.equal(R.mensagemErro({ code: 'P0001', message: 'unexpected null value in function x' }), GENERICA);   // P0001 que não é frase do projeto
  });
  test('objeto sem mensagem, erro de programação e texto em inglês viram a mensagem simples (nunca "[object Object]")', () => {
    for (const e of [{ code: '500' }, { message: '' }, {}, { code: '500', message: 'Internal Server Error' }, new TypeError("Cannot read properties of undefined (reading 'max')"),
      new ReferenceError('x is not defined'), { message: 'invalid input syntax for type uuid: "undefined"' }, { message: 'The resource already exists' }, { message: '{"error":"x"}' }, 'S.api.entrarSenha is not a function', 500, true]) {
      const m = R.mensagemErro(e); assert.equal(m, GENERICA, JSON.stringify(e && e.message || e) + ' → ' + m);
    }
    for (const e of [{ code: '23505' }, { code: '23514' }, { code: 'XX000' }, { details: null, hint: null, code: '57014', message: '' }]) assert.doesNotMatch(R.mensagemErro(e), TECNICO);
  });
  test('"Sem internet" só para erro de rede de verdade, não para qualquer texto com "fetch" ou "rede"', () => {
    for (const m of ['Failed to fetch', 'TypeError: Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) assert.match(R.mensagemErro({ message: m }), /^Sem internet/, m);
    assert.match(R.mensagemErro(new TypeError('Failed to fetch')), /^Sem internet/);
    assert.doesNotMatch(R.mensagemErro({ message: 'Não foi possível buscar (fetch) o registro: sem permissão.' }), /Sem internet/);
    assert.doesNotMatch(R.mensagemErro({ code: 'P0001', message: 'A rede de apoio (network) não foi informada.' }), /Sem internet/);
    assert.equal(R.erroDeRede({ message: 'fetch' }), false); assert.equal(R.erroDeRede(null), false);
  });
  test('mensagemParaTela: o que a API já traduziu (e.original) e as regras da demonstração (e.regra) passam; o resto é traduzido; nunca vazio', () => {
    const jaTraduzido = Object.assign(new Error('Você já solicitou este mês.'), { original: { code: '23505' } });
    assert.equal(R.mensagemParaTela(jaTraduzido), 'Você já solicitou este mês.');
    assert.equal(R.mensagemParaTela(Object.assign(new Error('Só o professor do FIC confirma o acesso ao AVA.'), { regra: true })), 'Só o professor do FIC confirma o acesso ao AVA.');
    assert.equal(R.mensagemParaTela(new TypeError('x.y is not a function')), GENERICA);
    for (const e of [undefined, { code: '500' }, 'undefined', Object.assign(new Error(''), { original: { code: 'P0001', message: '' } }), Object.assign(new Error('[object Object]'), { original: {} })]) {
      const m = R.mensagemParaTela(e); assert.ok(m && !/undefined|null|\[object/.test(m), JSON.stringify(e) + ' → ' + m);
    }
  });
  test('textoErro nunca transforma objeto em "[object Object]"', () => {
    assert.equal(R.textoErro({ code: '1' }), ''); assert.equal(R.textoErro({ message: 'a', details: 'b', hint: { x: 1 } }), 'a b'); assert.equal(R.textoErro(null), ''); assert.equal(R.textoErro('x'), 'x');
  });
});
