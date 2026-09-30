/* Regras dos formulários: máscaras, e-mail digitado errado, link de cadastro, pedidos de passagem e evento,
   medida de impacto (EBIA), cálculo da ajuda de custo e anonimização do ditado. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, FormDataFalso, diaMais, simples } = require('./ambiente');

/* ---------------------------------------------------------------- máscaras */
describe('máscaras (js/mascaras.js)', () => {
  const novo = () => carregar(['dados.js', 'regras.js', 'mascaras.js']);
  test('fmtCPF: progressivo e corta em 11', () => {
    const { MQ } = novo(); const f = MQ.mascaras.fmtCPF;
    assert.equal(f(''), ''); assert.equal(f('529'), '529'); assert.equal(f('5299'), '529.9');
    assert.equal(f('5299822'), '529.982.2'); assert.equal(f('52998224725'), '529.982.247-25'); assert.equal(f('5299822472599'), '529.982.247-25');
  });
  test('fmtTel: DDD, fixo de 10 e celular de 11', () => {
    const { MQ } = novo(); const f = MQ.mascaras.fmtTel;
    assert.equal(f(''), ''); assert.equal(f('8'), '(8'); assert.equal(f('84'), '(84');
    assert.equal(f('8433221100'), '(84) 3322-1100'); assert.equal(f('84999887766'), '(84) 99988-7766'); assert.equal(f('849998877661234'), '(84) 99988-7766');
  });
  test('corrigirEmail sugere o domínio certo nos erros comuns', () => {
    const { MQ } = novo(); const c = MQ.mascaras.corrigirEmail;
    assert.equal(c('maria@gmial.com'), 'maria@gmail.com');
    assert.equal(c('maria@gmail.con'), 'maria@gmail.com');
    assert.equal(c('MARIA@HOTMAL.COM'), 'maria@hotmail.com');
    assert.equal(c('ana@bol.com'), 'ana@bol.com.br');
    assert.equal(c('ana@qualquer.con'), 'ana@qualquer.com');   // regra geral do ".con"
  });
  test('corrigirEmail não mexe em e-mail certo, vazio ou esquisito', () => {
    const { MQ } = novo(); const c = MQ.mascaras.corrigirEmail;
    ['maria@gmail.com', 'maria@ifrn.edu.br', '', null, 'sem-arroba', 'a"b@gmial.com', 'x@<script>.con'].forEach(v => assert.equal(c(v), null, String(v)));
  });
  test('ao digitar, o campo de CPF ganha a máscara e o de e-mail fica minúsculo e sem espaço', () => {
    const { ouvintes } = novo();
    const campo = (o) => Object.assign({ tagName: 'INPUT', readOnly: false, dataset: {}, maxLength: -1, selectionStart: null, setSelectionRange() {},
      classList: { remove() {}, toggle() {} }, parentElement: { querySelector: () => null } }, o);
    const cpf = campo({ name: 'cpf', type: 'text', value: '52998224725' });
    ouvintes.input.forEach(fn => fn({ target: cpf }));
    assert.equal(cpf.value, '529.982.247-25'); assert.equal(cpf.maxLength, 14);
    const em = campo({ name: 'email', type: 'email', value: ' Maria@Gmail.COM ' });
    ouvintes.input.forEach(fn => fn({ target: em }));
    assert.equal(em.value, 'maria@gmail.com');
  });
});

/* ---------------------------------------------------------------- link de cadastro */
describe('link de cadastro (js/convites.js)', () => {
  const novo = () => carregar(['dados.js', 'regras.js', 'convites.js']).MQ.convitesUI;
  const fd = o => new FormDataFalso(o);
  test('lerPessoais sem Arlo: guarda nascimento, NIS só números, endereço sem campos vazios', () => {
    const C = novo();
    const d = C.lerPessoais(fd({ cadastro_arlo: 'nao', data_nascimento: '1985-03-10', nis: '123.45678.90-1', cep: '64600-100', cidade: 'Picos', logradouro: '', uf_end: 'PI' }));
    assert.equal(d.cadastro_arlo, false); assert.equal(d.nis, '12345678901');
    assert.deepEqual(simples(d.endereco), { cep: '64600100', cidade: 'Picos', uf: 'PI' });
  });
  test('lerPessoais com Arlo: quem vai a campo guarda só o município; os outros, nenhum endereço', () => {
    const C = novo();
    const d = C.lerPessoais(fd({ cadastro_arlo: 'sim', _campo: '1', data_nascimento: '1985-03-10', cep: '64600100', logradouro: 'Rua A', cidade: 'Picos', uf_end: 'PI' }));
    assert.equal(d.cadastro_arlo, true); assert.equal(d.data_nascimento, null);
    assert.deepEqual(simples(d.endereco), { cidade: 'Picos' });
    const o = C.lerPessoais(fd({ cadastro_arlo: 'sim', cep: '64600100', logradouro: 'Rua A', cidade: 'Picos', uf_end: 'PI' }));
    assert.deepEqual(simples(o.endereco), {});
  });
  test('lerPessoais: perfil no campo só quando respondido', () => {
    const C = novo();
    assert.equal(C.lerPessoais(fd({ cadastro_arlo: 'nao' })).perfil, null);
    assert.deepEqual(simples(C.lerPessoais(fd({ cadastro_arlo: 'nao', pf_agricultora: 'sim', pf_internet: 'nao', pf_experiencia: 'ate2' })).perfil),
      { agricultora: true, internet: false, experiencia: 'ate2' });
  });
  test('lerPessoais: socioeconômico só com a caixa marcada; renda 0 é valor válido', () => {
    const C = novo();
    assert.equal(C.lerPessoais(fd({ cadastro_arlo: 'nao', raca_etnia: 'Parda' })).socioeconomico, null);
    const s = C.lerPessoais(fd({ cadastro_arlo: 'nao', tem_socio: 'on', raca_etnia: 'Parda', renda_familiar: '0', pessoas_casa: '4' })).socioeconomico;
    assert.equal(s.renda_familiar, 0); assert.equal(s.pessoas_casa, 4);
  });
  const pub = (o) => Object.assign({ _arlo_resp: 'nao', cadastro_arlo: false, data_nascimento: '1985-03-10', endereco: {}, perfil: null }, o);
  test('validarPessoais pelo link: exige resposta do Arlo e nascimento', () => {
    const C = novo();
    assert.ok(C.validarPessoais(pub({ _arlo_resp: null }), true).cadastro_arlo);
    assert.ok(C.validarPessoais(pub({ data_nascimento: null }), true).data_nascimento);
    assert.equal(C.validarPessoais(pub({ data_nascimento: null }), false).data_nascimento, undefined);   // coordenação digitando: opcional
  });
  test('validarPessoais: menor de 16 anos e data no futuro recusadas; 16 anos aceita', () => {
    const C = novo(); const hoje = new Date();
    const anos = n => { const d = new Date(hoje); d.setFullYear(d.getFullYear() - n); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
    assert.ok(C.validarPessoais(pub({ data_nascimento: anos(15) }), true).data_nascimento);
    assert.ok(C.validarPessoais(pub({ data_nascimento: diaMais(3) }), true).data_nascimento);
    assert.equal(C.validarPessoais(pub({ data_nascimento: anos(16) }), true).data_nascimento, undefined);
  });
  test('validarPessoais: CEP com 8 números e NIS com 11', () => {
    const C = novo();
    assert.ok(C.validarPessoais(pub({ endereco: { cep: '646' } }), true).cep);
    assert.ok(C.validarPessoais(pub({ nis: '123' }), true).nis);
    assert.deepEqual(simples(C.validarPessoais(pub({ endereco: { cep: '64600100' }, nis: '12345678901' }), true)), {});
  });
  test('validarPessoais: com Arlo, quem vai a campo precisa da cidade', () => {
    const C = novo();
    assert.ok(C.validarPessoais(pub({ cadastro_arlo: true, _arlo_resp: 'sim', _campo: true, data_nascimento: null }), true).cidade);
    assert.equal(C.validarPessoais(pub({ cadastro_arlo: true, _arlo_resp: 'sim', _campo: false, data_nascimento: null }), true).cidade, undefined);
  });
  test('validarPessoais: perfil obrigatório pelo link marca as 5 perguntas e a experiência', () => {
    const C = novo();
    const e = C.validarPessoais(pub({ _perfil: true, perfil: { agricultora: true } }), true);
    ['pf_atua_mulheres', 'pf_mora_rural', 'pf_internet', 'pf_outra_bolsa', 'pf_experiencia'].forEach(k => assert.ok(e[k], k));
    assert.equal(e.pf_agricultora, undefined);
  });
  test('validarPessoais: socioeconômico incompleto pede raça, renda e pessoas', () => {
    const C = novo();
    const e = C.validarPessoais(pub({ socioeconomico: { raca_etnia: null, renda_familiar: null, pessoas_casa: null } }), true);
    assert.ok(e.raca_etnia); assert.ok(e.renda_familiar); assert.ok(e.pessoas_casa);
  });
  test('resumoPerfil em frase curta; nulo e vazio', () => {
    const C = novo();
    assert.equal(C.resumoPerfil({ agricultora: true, atua_mulheres: true, mora_rural: false, experiencia: '3a5', internet: false, outra_bolsa: true }),
      'Agricultora · atua com mulheres rurais · mora na cidade · experiência: 3 a 5 anos · sem celular com internet · já recebe outra bolsa');
    assert.equal(C.resumoPerfil(null), null); assert.equal(C.resumoPerfil({}), null);
  });
  test('temPerfil: coordenação técnica, bolsistas e agentes (não professor nem auxiliar)', () => {
    const C = novo();
    ['coord_tecnico', 'articulacao', 'apoio', 'agente'].forEach(p => assert.equal(C.temPerfil(p), true, p));
    ['professor_fic', 'auxiliar_adm', 'coord_geral'].forEach(p => assert.equal(C.temPerfil(p), false, p));
  });
  test('textoEndereco monta a linha e formata o CEP; vazio vira nulo', () => {
    const C = novo();
    assert.equal(C.textoEndereco({ logradouro: 'Sítio A', numero: '10', bairro: 'Zona rural', cidade: 'Picos', uf: 'PI', cep: '64600100' }),
      'Sítio A, 10 · Zona rural · Picos/PI · CEP 64600-100');
    assert.equal(C.textoEndereco({}), null); assert.equal(C.textoEndereco(null), null);
  });
});

/* ---------------------------------------------------------------- passagens e eventos */
describe('pedidos de passagem e evento (js/viagens.js)', () => {
  const novo = () => carregar(['dados.js', 'regras.js', 'viagens.js']).MQ.viagUI;
  const pass = (o = {}) => Object.assign({ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '123', rg_orgao: 'SSP/PI', sexo: 'F', celular: '(89) 99999-0000', email: 'm@gmail.com' }, o);
  const dadosPass = (o = {}) => Object.assign({ finalidade: 'intercambio', origem: 'Teresina', destino: 'Salvador', volta: diaMais(55), bagagem: 'mao', passageiros: [pass()] }, o);
  test('passagem completa, 50 dias antes, sem erro', () =>
    assert.deepEqual(simples(novo().validar('passagem', 'Intercâmbio em Juazeiro', diaMais(50), '', dadosPass())), {}));
  test('prazo: 40 dias passa sem justificativa; 39 dias exige', () => {
    const V = novo();
    assert.equal(V.validar('passagem', 'Intercâmbio', diaMais(40), '', dadosPass()).justificativa, undefined);
    assert.ok(V.validar('passagem', 'Intercâmbio', diaMais(39), '', dadosPass()).justificativa);
    assert.equal(V.validar('passagem', 'Intercâmbio', diaMais(39), 'Convite chegou só agora', dadosPass()).justificativa, undefined);
  });
  test('evento: prazo de 45 dias', () => {
    const V = novo(); const ev = { local: 'Sede', hora: '08:00', participantes: { mulheres: 30 }, estrutura: { tenda: true }, alimentacao: {}, responsavel: { nome: 'Joana', celular: '89999990000' } };
    assert.equal(V.validar('evento', 'Encontro estadual', diaMais(45), '', ev).justificativa, undefined);
    assert.ok(V.validar('evento', 'Encontro estadual', diaMais(44), '', ev).justificativa);
  });
  test('data no passado e depois do fim do projeto são recusadas', () => {
    const V = novo();
    assert.match(V.validar('passagem', 'Intercâmbio', diaMais(-1), '', dadosPass()).data_ref, /já passou/);
    assert.match(V.validar('passagem', 'Intercâmbio', '2027-10-01', '', dadosPass()).data_ref, /fim do projeto/);
    assert.equal(V.validar('passagem', 'Intercâmbio', '2027-09-30', 'Última viagem do projeto', dadosPass({ volta: '2027-09-30' })).data_ref, undefined);
  });
  test('volta antes da ida é recusada', () =>
    assert.ok(novo().validar('passagem', 'Intercâmbio', diaMais(50), '', dadosPass({ volta: diaMais(49) })).volta));
  test('cada campo da passageira é conferido (erros no bloco dela)', () => {
    const e = novo().validar('passagem', 'Intercâmbio', diaMais(50), '', dadosPass({ passageiros: [pass({ nome: 'Maria', cpf: '111', nascimento: '', rg: '', rg_orgao: '', sexo: '', celular: '9', email: 'x' })] }));
    assert.deepEqual(simples(e._pass.map(x => x[1]).sort()), ['ps_cel', 'ps_cpf', 'ps_email', 'ps_nasc', 'ps_nome', 'ps_org', 'ps_rg', 'ps_sexo']);
  });
  test('a mesma pessoa duas vezes é recusada', () =>
    assert.match(novo().validar('passagem', 'Intercâmbio', diaMais(50), '', dadosPass({ passageiros: [pass(), pass()] }))._geral, /duas vezes/));
  test('evento sem nenhum item de estrutura ou alimentação é recusado; almoço sem tipo de serviço também', () => {
    const V = novo(); const base = { local: 'Sede', hora: '08:00', participantes: { mulheres: 30 }, estrutura: {}, alimentacao: {}, responsavel: { nome: 'Joana', celular: '89999990000' } };
    assert.match(V.validar('evento', 'Encontro', diaMais(60), '', base)._geral, /pelo menos um item/);
    assert.ok(V.validar('evento', 'Encontro', diaMais(60), '', Object.assign({}, base, { alimentacao: { almoco: 60 } })).servico);
  });
  test('evento sem participantes e sem responsável é recusado', () => {
    const e = novo().validar('evento', 'Encontro', diaMais(60), '', { local: 'Sede', hora: '08:00', participantes: {}, estrutura: { som: true }, alimentacao: {}, responsavel: { nome: '', celular: '' } });
    assert.ok(e.p_mulheres); assert.ok(e.resp_nome); assert.ok(e.resp_cel);
  });
  test('lerForm (passagem): alinha os campos de cada pessoa, CPF só números, e-mail minúsculo', () => {
    const d = novo().lerForm('passagem', new FormDataFalso({ finalidade: 'pedagogico', origem: ' Picos ', volta: '', ps_nome: ['Ana  Lima', 'Bia Souza'], ps_cpf: ['529.982.247-25', '111.444.777-35'],
      ps_nasc: ['1980-01-01', '1990-01-01'], ps_rg: ['1', '2'], ps_org: ['SSP', 'SSP'], ps_sexo: ['F', 'F'], ps_cel: ['1', '2'], ps_email: ['A@X.COM', 'b@x.com'], ps_end: ['', 'Rua B'] }));
    assert.equal(d.origem, 'Picos'); assert.equal(d.volta, null);
    assert.equal(d.passageiros.length, 2); assert.equal(d.passageiros[0].nome, 'Ana Lima'); assert.equal(d.passageiros[1].cpf, '11144477735');
    assert.equal(d.passageiros[0].email, 'a@x.com'); assert.equal(d.passageiros[0].endereco, null); assert.equal(d.passageiros[1].endereco, 'Rua B');
  });
  test('lerForm (evento): número negativo vira 0 e vazio vira nulo; caixas marcadas viram verdadeiro', () => {
    const d = novo().lerForm('evento', new FormDataFalso({ p_mulheres: '-5', p_equipe: '', est_tenda: 'on', almoco: '60', servico: 'entrega' }));
    assert.equal(d.participantes.mulheres, 0); assert.equal(d.participantes.equipe, null);
    assert.equal(d.estrutura.tenda, true); assert.equal(d.estrutura.som, false); assert.equal(d.alimentacao.almoco, 60);
  });
  test('podeVer: só articulação estadual, coordenação técnica e geral', () => {
    const V = novo();
    ['articulacao', 'coord_tecnico', 'coord_geral'].forEach(p => assert.equal(V.podeVer(p), true, p));
    ['apoio', 'agente', 'professor_fic', 'auxiliar_adm', undefined].forEach(p => assert.equal(V.podeVer(p), false, String(p)));
  });
});

/* ---------------------------------------------------------------- impacto (EBIA) */
describe('medida de impacto (js/impacto.js)', () => {
  const novo = () => carregar(['dados.js', 'regras.js', 'impacto.js']).MQ.impactoUI;
  test('EBIA com menores de 18 (14 perguntas): cortes 0 | 1–5 | 6–9 | 10–14', () => {
    const c = novo().classificar;
    assert.equal(c(0, true), 'seguranca'); assert.equal(c(1, true), 'leve'); assert.equal(c(5, true), 'leve');
    assert.equal(c(6, true), 'moderada'); assert.equal(c(9, true), 'moderada'); assert.equal(c(10, true), 'grave'); assert.equal(c(14, true), 'grave');
  });
  test('EBIA sem menores (8 perguntas): cortes 0 | 1–3 | 4–5 | 6–8', () => {
    const c = novo().classificar;
    assert.equal(c(0, false), 'seguranca'); assert.equal(c(3, false), 'leve'); assert.equal(c(4, false), 'moderada');
    assert.equal(c(5, false), 'moderada'); assert.equal(c(6, false), 'grave'); assert.equal(c(8, false), 'grave');
  });
  test('sem pontos (questionário incompleto) não classifica', () => assert.equal(novo().classificar(null, true), null));
  test('validar: tudo respondido passa; dias fora de 0 a 7 recusado', () => {
    const I = novo(); const ok = { menor: false, ebia_pontos: 0, dias_consumo: 7, especies: 0, criacoes: 0, vende: false, decide: 'nao_vende', caf: 'ns' };
    assert.deepEqual(simples(I.validar(ok)), {});
    assert.ok(I.validar(Object.assign({}, ok, { dias_consumo: 8 })).im_dias);
    assert.ok(I.validar(Object.assign({}, ok, { dias_consumo: -1 })).im_dias);
  });
  test('validar: sem resposta sobre menores e com EBIA incompleta', () => {
    const I = novo();
    assert.ok(I.validar({ menor: null }).im_menor);
    assert.ok(I.validar({ menor: true, ebia_pontos: null }).ebia);
  });
  test('menorDaFamilia: verdadeiro se alguém tem menos de 18; sem idade informada fica "não sei"', () => {
    const I = novo();
    assert.equal(I.menorDaFamilia([{ idade: 30 }, { idade: 17 }]), true);
    assert.equal(I.menorDaFamilia([{ idade: 30 }, { idade: 18 }]), null);
    assert.equal(I.menorDaFamilia([]), null); assert.equal(I.menorDaFamilia(null), null);
  });
});

/* ---------------------------------------------------------------- custos */
describe('ajuda de custo por visita (js/custos.js)', () => {
  const novo = () => carregar(['dados.js', 'regras.js', 'custos.js']).MQ.custosUI;
  test('diagnóstico com 20 km: 3 h × 50 + 40 km ÷ 10 × 6,50 + 25 = 201', () => {
    const c = novo().calcular('diagnostico', 20);
    assert.equal(c.horas, 3); assert.equal(c.trabalho, 150); assert.equal(c.combustivel, 26); assert.equal(c.refeicao, 25); assert.equal(c.total, 201); assert.equal(c.completo, true);
  });
  test('sem km: sem combustível e marcado como incompleto', () => {
    const c = novo().calcular('acompanhamento', null);
    assert.equal(c.combustivel, null); assert.equal(c.total, 125); assert.equal(c.completo, false);
  });
  test('km 0 é válido (quintal na mesma cidade)', () => {
    const c = novo().calcular('implantacao', 0);
    assert.equal(c.combustivel, 0); assert.equal(c.completo, true);
  });
  test('etapa desconhecida não paga horas, só a refeição', () => assert.equal(novo().calcular('inventada', null).total, 25));
});

/* ---------------------------------------------------------------- ditado */
describe('anonimização do ditado (js/voz.js)', () => {
  const novo = (S) => carregar(['dados.js', 'regras.js', 'voz.js'], { ui: { S } }).MQ.voz;
  const S = { fichas: [{ nome: 'Maria das Dores Silva' }], equipe: [{ nome: 'Ana Paula Souza (exemplo)', nome_social: 'Paulinha Souza' }] };
  test('troca nome completo e nome + sobrenome da agricultora', () => {
    const v = novo(S);
    assert.equal(v.semNomes('Visitei Maria das Dores Silva hoje'), 'Visitei a agricultora hoje');
    assert.equal(v.semNomes('maria silva mostrou o quintal'), 'a agricultora mostrou o quintal');
  });
  test('troca nome da colega (ignorando "(exemplo)") e nome social', () => {
    const v = novo(S);
    assert.equal(v.semNomes('Fui com Ana Paula Souza'), 'Fui com a colega da equipe');
    assert.equal(v.semNomes('Paulinha Souza anotou'), 'a colega da equipe anotou');
  });
  test('não troca pedaço de outra palavra nem nome de uma palavra só', () => {
    const v = novo({ fichas: [{ nome: 'Ana' }, { nome: 'Rosa Lima' }], equipe: [] });
    assert.equal(v.semNomes('Ana plantou; Rosa Limão doou mudas'), 'Ana plantou; Rosa Limão doou mudas');
  });
  test('esconde CPF, telefone e e-mail', () => {
    const v = novo({ fichas: [], equipe: [] });
    assert.equal(v.semNomes('CPF 529.982.247-25, fone (89) 99999-0000, e-mail m@x.com'), 'CPF [CPF], fone [telefone], e-mail [e-mail]');
  });
  test('sem estado da tela devolve o texto como veio', () => {
    const { MQ } = carregar(['dados.js', 'regras.js', 'voz.js']);
    assert.equal(MQ.voz.semNomes('Maria Silva'), 'Maria Silva');
  });
});
