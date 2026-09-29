/* Regras de negócio do modo demonstração (js/api-demo.js), que espelham o banco (supabase/*.sql).
   Isolamento: cada teste roda num navegador novo, com localStorage falso e vazio; nada vai para o servidor. */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais, cpfValido } = require('./ambiente');

let api, MQ;
beforeEach(async () => { ({ MQ } = carregar(['dados.js', 'regras.js', 'api-demo.js'])); api = MQ.apiDemo; await api.iniciar(); });
const como = p => api.trocarPerfil(p);
const falha = async (promessa, texto) => { await assert.rejects(promessa, e => { assert.match(e.message, texto); return true; }); };
let seq = 700000000;
const novo = (o) => Object.assign({ nome: 'Fulana de Teste', cpf: cpfValido(seq++), email: 'f' + seq + '@gmail.com', telefone: '(89) 99999-0000',
  data_inicio: diaMais(0), consentimento_lgpd: true }, o);

describe('cadastro da equipe', () => {
  test('coordenação técnica cadastra agente; a pessoa entra ativa e o histórico registra', async () => {
    await como('coord_tecnico');
    const n = await api.criar(novo({ papel: 'agente', uf: 'PE' }));
    assert.equal(n.status, 'ativa'); assert.equal(n.user_id, null);
    await como('coord_geral');   // o histórico agora é só da coordenação geral (25_historico_e_cadastro.sql)
    const aud = await api.auditoria();
    assert.ok(aud.some(a => a.registro_id === n.id && a.acao === 'INSERT'));
  });
  test('coordenação técnica não cadastra professor nem auxiliar', async () => {
    await como('coord_tecnico');
    await falha(api.criar(novo({ papel: 'professor_fic' })), /permissão/);
    await falha(api.criar(novo({ papel: 'auxiliar_adm' })), /permissão/);
  });
  test('bolsista e agente não cadastram ninguém', async () => {
    for (const p of ['bolsista', 'agente']) { await como(p); await falha(api.criar(novo({ papel: 'agente', uf: 'PI' })), /permissão/); }
  });
  test('vaga ocupada (articulação PI) é recusada com os campos do erro', async () => {
    await como('coord_tecnico');
    await assert.rejects(api.criar(novo({ papel: 'articulacao', uf: 'PI' })), e => { assert.ok(e.campos.papel); return true; });
  });
  test('CPF inválido e e-mail repetido são recusados', async () => {
    await como('coord_tecnico');
    await falha(api.criar(novo({ papel: 'agente', uf: 'PI', cpf: '11111111111' })), /CPF inválido/);
    const eq = await api.listarEquipe ? await api.listarEquipe() : null;
    const outro = (eq || []).find(m => m.status === 'ativa' && m.email);
    if (outro) await falha(api.criar(novo({ papel: 'agente', uf: 'PI', email: outro.email.toUpperCase() })), /e-mail já está em uso/);
  });
});

describe('edição e desligamento', () => {
  const pessoa = async papel => (await api.listarEquipe()).find(m => m.papel === papel && m.status === 'ativa');
  test('auxiliar registra o Arlo de outra pessoa', async () => {
    await como('auxiliar'); const b = await pessoa('apoio');
    const r = await api.atualizar(b.id, { docs_funcern_em: diaMais(0) });
    assert.equal(r.docs_funcern_em, diaMais(0));
  });
  test('auxiliar não muda nome de ninguém nem a própria habilitação', async () => {
    await como('auxiliar'); const b = await pessoa('apoio'); const eu = await api.eu();
    await falha(api.atualizar(b.id, { nome: 'Outro Nome Qualquer' }), /só registra/);
    await falha(api.atualizar(eu.id, { docs_funcern_em: diaMais(0) }), /própria habilitação/);
  });
  test('CPF, estado e papel não mudam depois de salvos', async () => {
    await como('coord_tecnico'); const b = await pessoa('apoio');
    await falha(api.atualizar(b.id, { cpf: cpfValido(123123123) }), /não podem ser alterados/);
    await falha(api.atualizar(b.id, { uf: 'BA' }), /não podem ser alterados/);
  });
  test('desligar exige data e motivo; desligada não volta a ficar ativa', async () => {
    await como('coord_geral'); const aux = await pessoa('auxiliar_adm');
    const fim = aux.data_inicio > diaMais(0) ? aux.data_inicio : diaMais(0);   // o último dia não pode ser antes do início da bolsa
    await falha(api.atualizar(aux.id, { status: 'desligada', data_fim: fim, motivo_desligamento: 'x' }), /data e o motivo/);
    await api.desligar(aux.id, fim, 'Fim do contrato');
    await falha(api.atualizar(aux.id, { status: 'ativa' }), /não pode ser reativado/);
  });
  test('edição que deixa o cadastro inválido é recusada (e-mail sem @)', async () => {
    await como('coord_tecnico'); const b = await pessoa('apoio');
    await falha(api.atualizar(b.id, { email: 'semarroba.com' }), /E-mail inválido/);
  });
});

describe('link de cadastro e aprovação', () => {
  const dados = (o) => Object.assign({ nome: 'Luzia Rural Silva', cpf: cpfValido(seq++), email: 'luzia' + seq + '@gmail.com', telefone: '(89) 99911-2233',
    consentimento_lgpd: true, cadastro_arlo: false, data_nascimento: '1985-03-10', endereco: { cidade: 'Picos' } }, o);
  test('vaga ocupada não gera link; agente gera; o link abre válido', async () => {
    await como('coord_tecnico');
    await falha(api.criarConvite('articulacao', 'PI'), /ocupada/);
    const tk = await api.criarConvite('agente', 'PI');
    const v = await api.verConvite(tk);
    assert.equal(v.valido, true); assert.equal(v.papel, 'agente'); assert.equal(v.uf, 'PI');
  });
  test('link inventado: inexistente', async () => assert.equal((await api.verConvite('nao-existe')).motivo, 'inexistente'));
  test('bolsista não gera link', async () => { await como('bolsista'); await falha(api.criarConvite('agente', 'PI'), /não pode cadastrar/); });
  test('envio: sem LGPD, sem nascimento (sem Arlo) e com CPF de pessoa ativa são recusados', async () => {
    await como('coord_tecnico'); const tk = await api.criarConvite('agente', 'PI');
    await falha(api.enviarPreCadastro(tk, dados({ consentimento_lgpd: false })), /aceitar o uso/);
    await falha(api.enviarPreCadastro(tk, dados({ data_nascimento: null })), /nascimento/);
    const ativa = (await api.listarEquipe()).find(m => m.status === 'ativa' && m.papel === 'apoio');
    await falha(api.enviarPreCadastro(tk, dados({ cpf: ativa.cpf })), /Já existe pessoa ativa/);
  });
  test('com Arlo não precisa de nascimento; o link vale uma vez só', async () => {
    await como('coord_tecnico'); const tk = await api.criarConvite('agente', 'PI');
    await api.enviarPreCadastro(tk, dados({ cadastro_arlo: true, data_nascimento: null }));
    assert.equal((await api.verConvite(tk)).motivo, 'usado');
    await falha(api.enviarPreCadastro(tk, dados()), /não vale mais/);
  });
  test('coordenação vê o pré-cadastro; recusar exige motivo; decidido não se decide de novo', async () => {
    await como('coord_tecnico'); const tk = await api.criarConvite('agente', 'PI');
    await api.enviarPreCadastro(tk, dados({ nome: 'Pessoa Para Recusar' }));
    const pre = (await api.listarPreCadastros()).find(x => x.nome === 'Pessoa Para Recusar');
    assert.ok(pre);
    await falha(api.decidirPreCadastro(pre.id, 'recusado', 'ab'), /motivo/);
    await api.decidirPreCadastro(pre.id, 'recusado', 'Não é a pessoa indicada');
    await falha(api.decidirPreCadastro(pre.id, 'aprovado'), /já foi decidido/);
  });
  test('professor não vê pré-cadastros de agente', async () => {
    await como('coord_tecnico'); const tk = await api.criarConvite('agente', 'PI'); await api.enviarPreCadastro(tk, dados());
    await como('professor'); assert.equal((await api.listarPreCadastros()).length, 0);
  });
});

describe('pedidos de passagem e evento', () => {
  const pass = { finalidade: 'intercambio', passageiros: [{ nome: 'Maria das Dores', cpf: '52998224725', nascimento: '1970-01-01', rg: '1' }] };
  test('só a articulação estadual pede', async () => {
    for (const p of ['coord_tecnico', 'coord_geral', 'agente', 'professor', 'auxiliar']) { await como(p); await falha(api.salvarPedido(null, 'passagem', 'Viagem teste', diaMais(50), pass), /articulação estadual/); }
  });
  test('prazo, data no passado, fim do projeto e passagem sem pessoa', async () => {
    await como('bolsista');
    await falha(api.salvarPedido(null, 'passagem', 'Viagem teste', diaMais(39), pass), /fora do prazo/);
    await falha(api.salvarPedido(null, 'evento', 'Evento teste', diaMais(44), {}), /fora do prazo/);
    await falha(api.salvarPedido(null, 'passagem', 'Viagem teste', diaMais(-1), pass), /não passou/);
    await falha(api.salvarPedido(null, 'passagem', 'Viagem teste', '2027-10-01', pass), /fim do projeto/);
    await falha(api.salvarPedido(null, 'passagem', 'Viagem teste', diaMais(50), { passageiros: [] }), /pelo menos uma/);
    await falha(api.salvarPedido(null, 'diaria', 'Viagem teste', diaMais(50), {}), /inválido/);
    const id = await api.salvarPedido(null, 'passagem', 'Viagem teste', diaMais(39), pass, 'Convite chegou só agora.');
    assert.ok(id);
  });
  test('caminho completo: enviar → devolver → corrigir → conferir → autorizar → protocolo', async () => {
    await como('bolsista'); const id = await api.salvarPedido(null, 'passagem', 'Intercâmbio', diaMais(50), pass);
    await falha(api.salvarPedido(id, 'passagem', 'Intercâmbio', diaMais(50), pass), /devolvido/);   // ainda não foi devolvido
    await como('coord_geral'); await falha(api.moverPedido(id, 'autorizar'), /conferido/);
    await como('coord_tecnico');
    await falha(api.moverPedido(id, 'devolver', 'ab'), /escreva/);
    await api.moverPedido(id, 'devolver', 'Falta o RG da segunda pessoa');
    await como('bolsista'); await api.salvarPedido(id, 'passagem', 'Intercâmbio', diaMais(51), pass);
    let p = (await api.listarPedidos()).find(x => x.id === id); assert.equal(p.situacao, 'enviado');
    await como('coord_tecnico'); await api.moverPedido(id, 'conferir');
    await falha(api.moverPedido(id, 'autorizar'), /coordenação geral/);
    await como('bolsista'); await falha(api.moverPedido(id, 'cancelar'), /Depois de conferido/);
    await como('coord_geral'); await api.moverPedido(id, 'autorizar', null, 'FUNCERN 1/2026');
    await api.moverPedido(id, 'protocolo', null, 'FUNCERN 2/2026');
    p = (await api.listarPedidos()).find(x => x.id === id);
    assert.equal(p.situacao, 'autorizado'); assert.equal(p.funcern_protocolo, 'FUNCERN 2/2026');
    await falha(api.moverPedido(id, 'recusar', 'mudou de ideia'), /não pode ser recusado/);
  });
  test('recusa exige motivo; quem pediu cancela antes da conferência; ação inventada falha', async () => {
    await como('bolsista'); const a = await api.salvarPedido(null, 'evento', 'Encontro PI', diaMais(60), {}); const b = await api.salvarPedido(null, 'evento', 'Encontro 2', diaMais(60), {});
    await como('coord_geral'); await falha(api.moverPedido(a, 'recusar'), /motivo/); await api.moverPedido(a, 'recusar', 'Evento duplicado');
    await falha(api.moverPedido(a, 'pagar'), /inválida/);
    await como('coord_tecnico'); await falha(api.moverPedido(b, 'cancelar'), /quem pediu/);
    await como('bolsista'); await api.moverPedido(b, 'cancelar');
    assert.equal((await api.listarPedidos()).find(x => x.id === b).situacao, 'cancelado');
  });
  test('quem vê: a bolsista vê só os dela; agente e auxiliar não veem nenhum', async () => {
    await como('bolsista'); await api.salvarPedido(null, 'evento', 'Encontro PI', diaMais(60), {});
    assert.equal((await api.listarPedidos()).length, 1);
    await como('coord_tecnico'); assert.equal((await api.listarPedidos()).length, 1);
    for (const p of ['agente', 'auxiliar', 'professor']) { await como(p); assert.equal((await api.listarPedidos()).length, 0, p); }
  });
  test('histórico do pedido não guarda os dados das passageiras (CPF)', async () => {
    await como('bolsista'); await api.salvarPedido(null, 'passagem', 'Intercâmbio', diaMais(50), pass);
    await como('coord_geral'); const aud = await api.auditoria();
    assert.ok(aud.some(a => a.tabela === 'pedidos_apoio'));
    assert.equal(JSON.stringify(aud.filter(a => a.tabela === 'pedidos_apoio')).includes('52998224725'), false);
  });
});

describe('pedidos de pagamento', () => {
  const rel = 'Neste mês visitei os quintais do território, organizei as listas de presença e atualizei as fichas.';
  const mes = () => diaMais(0).slice(0, 7) + '-01';
  test('bolsista habilitada pede a bolsa; relatório curto é recusado; o mesmo mês não repete', async () => {
    await como('bolsista');
    await falha(api.solicitarPagamento('bolsa', mes(), 1000, 'curto', [], {}), /relatório/);
    await api.solicitarPagamento('bolsa', mes(), 1000, rel, [], {});
    await falha(api.solicitarPagamento('bolsa', mes(), 1000, rel, [], {}), /já solicitou/);
  });
  test('mês futuro é recusado', async () => {
    await como('bolsista'); const d = new Date(); d.setMonth(d.getMonth() + 2);
    await falha(api.solicitarPagamento('bolsa', d.toISOString().slice(0, 7) + '-01', 1000, rel, [], {}), /mês atual/);
  });
  test('agente não pede bolsa; ajuda de custo exige visitas', async () => {
    await como('agente');
    await falha(api.solicitarPagamento('bolsa', mes(), 1000, rel, [], {}), /não recebe bolsa/);
    await falha(api.solicitarPagamento('ajuda_custo', mes(), 100, null, [], {}), /Marque as visitas/);
  });
  test('aval: devolver exige motivo; ninguém dá aval no próprio; técnica não lança no Arlo; auxiliar lança', async () => {
    await como('bolsista'); const id = await api.solicitarPagamento('bolsa', mes(), 1000, rel, [], {});
    await como('coord_tecnico');
    await falha(api.avalizarPagamento(id, false, 'ab'), /corrigido/);
    await api.avalizarPagamento(id, true, null, 900);
    await falha(api.avalizarPagamento(id, true), /não está aguardando/);
    await falha(api.registrarNoArlo(id, 'P1'), /auxiliar/);
    await como('auxiliar'); await api.registrarNoArlo(id, 'P1');
    const s = (await api.listarSolicitacoes()).lista.find(x => x.id === id);
    assert.equal(s.situacao, 'lancada'); assert.equal(s.valor_avalizado, 900); assert.equal(s.arlo_protocolo, 'P1');
  });
});

describe('dados pessoais (privado)', () => {
  test('agente não lê os dados pessoais da bolsista; a coordenação lê', async () => {
    await como('coord_tecnico'); const b = (await api.listarEquipe()).find(m => m.papel === 'apoio' && m.status === 'ativa');
    await api.salvarPrivado(b.id, { data_nascimento: '1990-01-01' });
    assert.equal((await api.lerPrivado(b.id)).data_nascimento, '1990-01-01');
    await como('agente'); assert.equal(await api.lerPrivado(b.id), null);
    await falha(api.salvarPrivado(b.id, { data_nascimento: '2000-01-01' }), /não pode alterar/);
  });
});

describe('mesmas regras do banco', () => {
  test('desligar com último dia antes do início da bolsa é recusado (como o banco: datas_coerentes)', async () => {
    await como('coord_geral'); const aux = (await api.listarEquipe()).find(m => m.papel === 'auxiliar_adm' && m.status === 'ativa');
    const antes = new Date(aux.data_inicio + 'T12:00:00'); antes.setDate(antes.getDate() - 1);
    await falha(api.desligar(aux.id, antes.toISOString().slice(0, 10), 'Motivo qualquer'), /início/);
  });
});

describe('cadastro repetido pelo link (25_historico_e_cadastro.sql)', () => {
  test('a mesma pessoa não envia por um segundo link enquanto o primeiro espera conferência', async () => {
    await como('coord_tecnico'); const a = await api.criarConvite('agente', 'PI'); const b = await api.criarConvite('agente', 'PI');
    const d = { nome: 'Luzia Duas Vezes', cpf: cpfValido(seq++), email: 'duas' + seq + '@gmail.com', telefone: '(89) 99911-2233', consentimento_lgpd: true, cadastro_arlo: true };
    await api.enviarPreCadastro(a, d);
    await falha(api.enviarPreCadastro(b, d), /já foram enviados/);
    await falha(api.enviarPreCadastro(b, Object.assign({}, d, { cpf: cpfValido(seq++) })), /já foram enviados/);   // mesmo e-mail
  });
  test('depois de recusado, a pessoa pode enviar de novo por outro link', async () => {
    await como('coord_tecnico'); const a = await api.criarConvite('agente', 'PI'); const b = await api.criarConvite('agente', 'PI');
    const d = { nome: 'Luzia Recusada Antes', cpf: cpfValido(seq++), email: 'rec' + seq + '@gmail.com', telefone: '(89) 99911-2233', consentimento_lgpd: true, cadastro_arlo: true };
    await api.enviarPreCadastro(a, d);
    const pre = (await api.listarPreCadastros()).find(x => x.nome === d.nome);
    await api.decidirPreCadastro(pre.id, 'recusado', 'CPF digitado errado');
    await api.enviarPreCadastro(b, d);
  });
});

describe('histórico só da coordenação geral (25_historico_e_cadastro.sql)', () => {
  test('coordenação geral recebe o histórico; os demais perfis recebem lista vazia', async () => {
    await como('coord_geral'); assert.ok((await api.auditoria()).length > 0);
    for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) { await como(p); assert.equal((await api.auditoria()).length, 0, p); }
  });
});
