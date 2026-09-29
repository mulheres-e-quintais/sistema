/* Regras de negócio da equipe (js/regras.js): CPF, e-mail, permissões, habilitação, validação do cadastro e mensagens de erro. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, cpfValido, simples } = require('./ambiente');

let R, MQ;
beforeEach(() => { ({ MQ } = carregar(['dados.js', 'regras.js'])); R = MQ.regras; });

describe('soDigitos', () => {
  test('tira tudo que não é número', () => assert.equal(R.soDigitos('529.982.247-25'), '52998224725'));
  test('nulo, indefinido e vazio viram texto vazio', () => {
    assert.equal(R.soDigitos(null), ''); assert.equal(R.soDigitos(undefined), ''); assert.equal(R.soDigitos(''), '');
  });
  test('número vira texto', () => assert.equal(R.soDigitos(123), '123'));
});

describe('cpfValido', () => {
  test('CPF válido com e sem máscara', () => {
    assert.equal(R.cpfValido('529.982.247-25'), true);
    assert.equal(R.cpfValido('52998224725'), true);
  });
  test('dígito verificador errado é inválido', () => assert.equal(R.cpfValido('52998224724'), false));
  test('todos os dígitos iguais são inválidos (000… até 999…)', () => {
    for (let d = 0; d <= 9; d++) assert.equal(R.cpfValido(String(d).repeat(11)), false, String(d).repeat(11));
  });
  test('tamanho diferente de 11 é inválido', () => {
    assert.equal(R.cpfValido('5299822472'), false);
    assert.equal(R.cpfValido('529982247250'), false);
  });
  test('nulo, vazio e texto sem números são inválidos', () => {
    assert.equal(R.cpfValido(null), false); assert.equal(R.cpfValido(''), false); assert.equal(R.cpfValido('abc.def.ghi-jk'), false);
  });
  test('dígito verificador 0 (resto 10) é aceito', () => {
    // gera vários CPFs e confere que todos os gerados pela regra oficial passam
    for (let i = 100000000; i < 100000300; i++) assert.equal(R.cpfValido(cpfValido(i)), true, cpfValido(i));
  });
});

describe('formatação e máscara de CPF e telefone', () => {
  test('fmtCPF formata progressivamente', () => {
    assert.equal(R.fmtCPF('529'), '529');
    assert.equal(R.fmtCPF('5299'), '529.9');
    assert.equal(R.fmtCPF('5299822'), '529.982.2');
    assert.equal(R.fmtCPF('52998224725'), '529.982.247-25');
  });
  test('fmtCPF corta o que passa de 11 números', () => assert.equal(R.fmtCPF('529982247259999'), '529.982.247-25'));
  test('cpfMascarado esconde início e fim; incompleto não mostra nada', () => {
    assert.equal(R.cpfMascarado('52998224725'), '•••.982.247-••');
    assert.equal(R.cpfMascarado('123'), '');
    assert.equal(R.cpfMascarado(null), '');
  });
  test('fmtFone: fixo (10) e celular (11)', () => {
    assert.equal(R.fmtFone('8433221100'), '(84) 3322-1100');
    assert.equal(R.fmtFone('84999887766'), '(84) 99988-7766');
    assert.equal(R.fmtFone('84'), '84');
    assert.equal(R.fmtFone(''), '');
  });
});

describe('emailValido', () => {
  test('aceita e-mails comuns, com espaço nas pontas', () => {
    assert.equal(R.emailValido('maria@gmail.com'), true);
    assert.equal(R.emailValido('  maria.silva+x@ifrn.edu.br '), true);
  });
  test('recusa sem @, sem domínio, sem ponto, com espaço no meio, nulo', () => {
    for (const e of ['maria.gmail.com', 'maria@', 'maria@gmail', 'ma ria@gmail.com', '@gmail.com', '', null, undefined])
      assert.equal(R.emailValido(e), false, String(e));
  });
});

describe('quem pode cadastrar e editar (espelha o banco)', () => {
  const PAPEIS = ['coord_geral', 'coord_tecnico', 'articulacao', 'apoio', 'agente', 'professor_fic', 'auxiliar_adm'];
  test('coordenação geral cadastra todos, menos outra coordenação geral', () => {
    PAPEIS.forEach(p => assert.equal(R.podeCadastrar('coord_geral', p), p !== 'coord_geral', p));
  });
  test('coordenação técnica só cadastra bolsistas e agentes', () => {
    PAPEIS.forEach(p => assert.equal(R.podeCadastrar('coord_tecnico', p), ['articulacao', 'apoio', 'agente'].includes(p), p));
  });
  test('bolsista, agente, professor e auxiliar não cadastram ninguém', () => {
    ['articulacao', 'apoio', 'agente', 'professor_fic', 'auxiliar_adm', undefined, null].forEach(eu =>
      PAPEIS.forEach(p => assert.equal(R.podeCadastrar(eu, p), false, eu + '→' + p)));
  });
  test('auxiliar registra habilitação de todos, menos da coordenação geral', () => {
    PAPEIS.forEach(p => assert.equal(R.podeEditarHabilitacao('auxiliar_adm', p), p !== 'coord_geral', p));
  });
  test('coordenação técnica registra habilitação só de bolsistas e agentes', () => {
    assert.equal(R.podeEditarHabilitacao('coord_tecnico', 'agente'), true);
    assert.equal(R.podeEditarHabilitacao('coord_tecnico', 'professor_fic'), false);
  });
  test('ehBolsista, ehCampo e decideCampo', () => {
    assert.equal(R.ehBolsista('articulacao'), true); assert.equal(R.ehBolsista('agente'), false);
    assert.equal(R.ehCampo('agente'), true); assert.equal(R.ehCampo('coord_tecnico'), false);
    assert.equal(R.decideCampo('coord_geral'), true); assert.equal(R.decideCampo('articulacao'), false);
    assert.equal(R.podeMatricular('professor_fic'), true); assert.equal(R.podeMatricular('coord_tecnico'), false);
  });
});

describe('habilitação para receber', () => {
  const base = { status: 'ativa', criado_em: '2026-09-20T10:00:00Z' };
  test('professor, auxiliar e coord. geral não fazem FIC', () => {
    ['professor_fic', 'auxiliar_adm', 'coord_geral'].forEach(p => assert.equal(R.fazFIC(p), false));
    ['coord_tecnico', 'articulacao', 'apoio', 'agente'].forEach(p => assert.equal(R.fazFIC(p), true));
  });
  test('passos: bolsista tem 4 (dados, FIC, Arlo, termo); professor tem 3 (sem FIC)', () => {
    assert.deepEqual(simples(R.passosHabilitacao(Object.assign({ papel: 'articulacao' }, base)).map(x => x.id)), ['dados', 'fic', 'funcern', 'termo']);
    assert.deepEqual(simples(R.passosHabilitacao(Object.assign({ papel: 'professor_fic' }, base)).map(x => x.id)), ['dados', 'funcern', 'termo']);
  });
  test('situacao: falta 3, falta 1, habilitada e agente "habilitada para visitas"', () => {
    const b = Object.assign({ papel: 'apoio' }, base);
    assert.equal(R.situacao(b).rot, 'Habilitação: faltam 3');
    assert.equal(R.situacao(Object.assign({}, b, { matricula_fic_em: '2026-09-21', docs_funcern_em: '2026-09-22' })).rot, 'Habilitação: falta 1');
    const pronta = Object.assign({}, b, { matricula_fic_em: '2026-09-21', docs_funcern_em: '2026-09-22', termo_assinado_em: '2026-09-23' });
    assert.deepEqual(simples(R.situacao(pronta)), { cod: 'ok', rot: 'Habilitada' });
    assert.equal(R.situacao(Object.assign({}, pronta, { papel: 'agente' })).rot, 'Habilitada para visitas');
  });
  test('desligada e coordenação geral têm situação própria', () => {
    assert.equal(R.situacao({ papel: 'apoio', status: 'desligada' }).cod, 'desligada');
    assert.equal(R.situacao({ papel: 'coord_geral', status: 'ativa' }).rot, 'Ativa');
  });
  test('habilitado: exige ativa + FIC (se faz) + Arlo + termo', () => {
    const ok = { papel: 'agente', status: 'ativa', matricula_fic_em: 'x', docs_funcern_em: 'x', termo_assinado_em: 'x' };
    assert.equal(R.habilitado(ok), true);
    assert.equal(R.habilitado(Object.assign({}, ok, { matricula_fic_em: null })), false);
    assert.equal(R.habilitado(Object.assign({}, ok, { status: 'desligada' })), false);
    assert.equal(R.habilitado({ papel: 'professor_fic', status: 'ativa', docs_funcern_em: 'x', termo_assinado_em: 'x' }), true);
    assert.equal(R.habilitado(null), false); assert.equal(R.habilitado(undefined), false);
  });
});

describe('validar (cadastro da equipe)', () => {
  const ok = () => ({ papel: 'articulacao', uf: 'PI', nome: 'Ana Paula Souza', cpf: '529.982.247-25', email: 'ana@gmail.com', telefone: '(89) 99999-0000',
    data_inicio: '2026-10-01', consentimento_lgpd: true });
  const ativa = (o) => Object.assign({ id: 'x' + Math.random(), status: 'ativa', papel: 'agente', uf: 'PI', cpf: '11144477735', email: 'outra@gmail.com' }, o);
  test('cadastro completo não tem erro', () => assert.deepEqual(simples(R.validar(ok(), [])), {}));
  test('tudo vazio: aponta nome, cpf, e-mail, celular, início e LGPD', () => {
    const e = R.validar({ papel: 'agente' }, []);
    assert.deepEqual(simples(Object.keys(e).sort()), ['consentimento_lgpd', 'cpf', 'data_inicio', 'email', 'nome', 'telefone']);
  });
  test('nome de uma palavra só é recusado; com espaços extras, duas palavras passa', () => {
    assert.ok(R.validar(Object.assign(ok(), { nome: 'Ana' }), []).nome);
    assert.equal(R.validar(Object.assign(ok(), { nome: '  Ana   Souza ' }), []).nome, undefined);
  });
  test('celular com 9 dígitos recusado; com 10 (fixo) aceito', () => {
    assert.ok(R.validar(Object.assign(ok(), { telefone: '849999999' }), []).telefone);
    assert.equal(R.validar(Object.assign(ok(), { telefone: '8433221100' }), []).telefone, undefined);
  });
  test('SIAPE: limites 5 e 8 números aceitos; 4 e 9 recusados; vazio é opcional', () => {
    ['12345', '12345678', '', null].forEach(s => assert.equal(R.validar(Object.assign(ok(), { siape: s }), []).siape, undefined, String(s)));
    ['1234', '123456789', '12a45'].forEach(s => assert.ok(R.validar(Object.assign(ok(), { siape: s }), []).siape, s));
  });
  test('CPF de pessoa ativa é recusado; de pessoa desligada não', () => {
    assert.match(R.validar(ok(), [ativa({ cpf: '52998224725' })]).cpf, /já ocupa/);
    assert.equal(R.validar(ok(), [ativa({ cpf: '52998224725', status: 'desligada' })]).cpf, undefined);
  });
  test('e-mail repetido é recusado sem diferenciar maiúsculas', () => {
    assert.match(R.validar(ok(), [ativa({ email: 'ANA@GMAIL.COM' })]).email, /já está em uso/);
  });
  test('editar a própria pessoa não acusa CPF repetido com ela mesma', () => {
    const eu = ativa({ id: 'eu', cpf: '52998224725', email: 'ana@gmail.com', papel: 'articulacao' });
    assert.deepEqual(simples(R.validar(Object.assign(ok(), { id: 'eu' }), [eu])), {});
  });
  test('uma bolsista por função e estado; outro estado pode', () => {
    assert.match(R.validar(ok(), [ativa({ papel: 'articulacao', uf: 'PI' })]).papel, /Articulação estadual.*PI/i);
    assert.equal(R.validar(ok(), [ativa({ papel: 'articulacao', uf: 'BA' })]).papel, undefined);
    assert.equal(R.validar(ok(), [ativa({ papel: 'apoio', uf: 'PI' })]).papel, undefined);
  });
  test('um auxiliar ativo; agentes sem limite', () => {
    const aux = Object.assign(ok(), { papel: 'auxiliar_adm', uf: null });
    assert.match(R.validar(aux, [ativa({ papel: 'auxiliar_adm' })]).papel, /auxiliar/);
    const ag = Object.assign(ok(), { papel: 'agente' });
    assert.equal(R.validar(ag, [ativa({ papel: 'agente' }), ativa({ papel: 'agente', cpf: '39053344705', email: 'b@b.com' })]).papel, undefined);
  });
  test('metas: negativa recusada, zero aceita', () => {
    assert.ok(R.validar(Object.assign(ok(), { meta_quintais: -1 }), []).meta_quintais);
    assert.equal(R.validar(Object.assign(ok(), { meta_quintais: 0 }), []).meta_quintais, undefined);
  });
  test('sem ciência LGPD não salva', () => assert.ok(R.validar(Object.assign(ok(), { consentimento_lgpd: false }), []).consentimento_lgpd));
});

describe('mensagemErro (erros do banco em linguagem simples)', () => {
  const casos = [
    ['duplicate key value violates unique constraint "equipe_uma_bolsista_por_uf"', /bolsista ativa nessa função/],
    ['equipe_uma_coordenacao', /coordenação técnica ativa/],
    ['equipe_cpf_ativo', /CPF/],
    ['equipe_email_ativo', /e-mail já está em uso/],
    ['new row violates row-level security policy', /permissão/],
    ['permission denied for table equipe', /permissão/],
    ['TypeError: Failed to fetch', /Sem internet/],
    ['Load failed', /Sem internet/],            // Safari (iPhone)
    ['fichas_cpf_unico', /já tem ficha/],
    ['visitas_etapa_unica', /já tem essa visita/],
    ['gps_ou_motivo', /localização/]
  ];
  casos.forEach(([bruto, esperado]) => test(bruto, () => assert.match(R.mensagemErro({ message: bruto }), esperado)));
  test('usa details quando não há message', () => assert.match(R.mensagemErro({ details: 'equipe_cpf_ativo' }), /CPF/));
  test('erro desconhecido passa como veio; vazio/nulo dá mensagem genérica', () => {
    assert.equal(R.mensagemErro({ message: 'Qualquer coisa' }), 'Qualquer coisa');
    assert.equal(R.mensagemErro(null), 'Não foi possível salvar. Tente de novo.');
    assert.equal(R.mensagemErro(''), 'Não foi possível salvar. Tente de novo.');
  });
});

describe('datas', () => {
  test('fmtData: AAAA-MM-DD → DD/MM/AAAA; aceita data com hora; vazio vira vazio', () => {
    assert.equal(R.fmtData('2026-09-29'), '29/09/2026');
    assert.equal(R.fmtData('2026-09-29T10:00:00Z'), '29/09/2026');
    assert.equal(R.fmtData(null), ''); assert.equal(R.fmtData(''), '');
  });
  test('hoje no formato AAAA-MM-DD', () => assert.match(R.hoje(), /^\d{4}-\d{2}-\d{2}$/));
  test('idade: antes e depois do aniversário, 29 de fevereiro, sem data', () => {
    assert.equal(R.idade('2000-10-01', '2026-09-30'), 25);
    assert.equal(R.idade('2000-10-01', '2026-10-01'), 26);
    assert.equal(R.idade('2008-02-29', '2026-02-28'), 17);
    assert.equal(R.idade('2008-02-29', '2026-03-01'), 18);
    assert.equal(R.idade(null), null);
  });
});

describe('curso FIC: quem é matriculado e em que turma (decisão de 29/09/2026)', () => {
  test('matriculaFIC: coordenação técnica, bolsistas e agentes; não professor, auxiliar nem coordenação geral', () => {
    ['coord_tecnico', 'articulacao', 'apoio', 'agente'].forEach(p => assert.equal(R.matriculaFIC(p), true, p));
    ['professor_fic', 'auxiliar_adm', 'coord_geral', undefined, ''].forEach(p => assert.equal(R.matriculaFIC(p), false, String(p)));
  });
  test('matriculaFIC coincide com quem precisa do FIC na habilitação', () => {
    ['coord_geral', 'coord_tecnico', 'articulacao', 'apoio', 'agente', 'professor_fic', 'auxiliar_adm'].forEach(p => assert.equal(R.matriculaFIC(p), R.fazFIC(p), p));
  });
  test('cabeNaTurma: turma de vários estados aceita todos; turma de estado aceita o estado e a coordenação técnica', () => {
    assert.equal(R.cabeNaTurma({ uf: null }, { uf: 'BA' }), true);
    assert.equal(R.cabeNaTurma({ uf: 'PI' }, { uf: 'PI' }), true);
    assert.equal(R.cabeNaTurma({ uf: 'PI' }, { uf: 'BA' }), false);
    assert.equal(R.cabeNaTurma({ uf: 'PI' }, { uf: null }), true);   // coordenação técnica (5 estados)
  });
});
