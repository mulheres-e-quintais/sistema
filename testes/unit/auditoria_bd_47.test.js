/* O que a tela faz com as travas do supabase/47_auditoria_bd.sql:
   - versão do registro (item B): a marca "atualizado_em" lida vai junto no envio; se outra pessoa alterou, o envio é
     recusado, o que foi preenchido NÃO é descartado e a marca nova passa a valer depois de salvar;
   - aprovar o cadastro vindo do link numa operação só (item G);
   - mensagens novas do banco traduzidas (itens D e I). */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais, cpfValido, simples } = require('./ambiente');

let api, MQ, R, F;
beforeEach(async () => { ({ MQ } = carregar(['dados.js', 'regras.js', 'fila.js', 'api-demo.js'])); api = MQ.apiDemo; R = MQ.regras; F = MQ.fila; await api.iniciar(); });
const como = p => api.trocarPerfil(p);
const falha = async (promessa, texto) => { await assert.rejects(promessa, e => { assert.match(e.message, texto); return true; }); };
const espera = ms => new Promise(r => setTimeout(r, ms));
let seq = 470000000;
const criterios = () => Object.fromEntries(MQ.CRITERIOS.map(([k]) => [k, true]));
const ficha = (o = {}) => Object.assign({ id: 'f47' + seq, uf: 'PI', nome: 'Mulher Versao ' + seq, cpf: cpfValido(seq++), data_nascimento: '1980-01-01', municipio: 'Paulistana',
  comunidade: 'Comunidade Teste', endereco: 'Sítio ' + seq, consent_dados: true, autodeclaracao: true, resultado: 'selecionada', data_ficha: diaMais(-1) }, criterios(), o);
const pessoa = async (papel, extra = () => true) => (await api.listarEquipe()).find(m => m.papel === papel && m.status === 'ativa' && extra(m));
const CONFLITO = /alterado por outra pessoa enquanto você editava/;

describe('47 · mensagens do banco traduzidas', () => {
  test('espera por trava estourou (55P03): "o sistema está ocupado", nunca o texto cru', () => {
    assert.equal(R.mensagemErro({ code: '55P03', message: 'canceling statement due to lock timeout' }), R.MSG_OCUPADO);
    assert.equal(R.mensagemErro({ code: '55P03', message: R.MSG_OCUPADO }), R.MSG_OCUPADO);
    assert.match(R.MSG_OCUPADO, /ocupado com outra gravação\. Tente de novo em instantes\./);
  });
  test('tempo total estourado (57014) continua com a mensagem de antes', () => {
    assert.match(R.mensagemErro({ code: '57014', message: 'canceling statement due to statement timeout' }), /demorou demais/);
  });
  test('trava de tamanho do banco (tam_<coluna>_<limite>): diz o campo e o limite', () => {
    assert.equal(R.mensagemErro({ code: '23514', message: 'new row for relation "fichas" violates check constraint "tam_ponto_referencia_300"' }),
      'Texto muito longo em ponto de referência (máximo 300 caracteres).');
    assert.equal(R.mensagemErro({ code: '23514', message: 'new row for relation "visitas" violates check constraint "tam_relato_4000"' }),
      'Texto muito longo em relato da visita (máximo 4.000 caracteres).');
    assert.equal(R.mensagemErro({ code: '23514', message: 'violates check constraint "tam_coluna_nova_10"' }), 'Texto muito longo em coluna nova (máximo 10 caracteres).');
  });
  test('outra trava do banco continua com a mensagem geral', () => {
    assert.match(R.mensagemErro({ code: '23514', message: 'violates check constraint "outra_coisa"' }), /valor que o sistema não aceita/);
  });
  test('a recusa por versão passa como veio (já está em português) e é reconhecida como conflito', () => {
    const e = { code: 'P0001', message: R.MSG_CONFLITO };
    assert.equal(R.mensagemErro(e), R.MSG_CONFLITO);
    assert.equal(R.ehConflito(e), true); assert.equal(R.ehConflito(new Error(R.MSG_CONFLITO)), true);
    assert.equal(R.ehConflito(new Error('Ficha já aprovada')), false); assert.equal(R.ehConflito(null), false);
    assert.equal(R.MSG_CONFLITO, 'Este registro foi alterado por outra pessoa enquanto você editava. Abra de novo, confira e refaça a sua alteração.');
  });
});

describe('47 · versão do registro no modo demonstração (espelho do banco)', () => {
  test('ficha: salvar com a marca lida grava; com marca velha é recusado e nada muda', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {}); await espera(3);
    const g = await api.salvarFicha(Object.assign({}, f, { comunidade: 'Nova' }), {}, { marca: f.atualizado_em });
    assert.equal(g.comunidade, 'Nova'); assert.notEqual(g.atualizado_em, f.atualizado_em);
    await falha(api.salvarFicha(Object.assign({}, f, { comunidade: 'Velha por cima' }), {}, { marca: f.atualizado_em }), CONFLITO);
    assert.equal((await api.listarFichas()).find(x => x.id === f.id).comunidade, 'Nova');
  });
  test('ficha: salvar duas vezes seguidas com a marca que voltou do primeiro salvar funciona', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {}); await espera(3);
    const g = await api.salvarFicha(Object.assign({}, f, { comunidade: 'Uma' }), {}, { marca: f.atualizado_em }); await espera(3);
    const h = await api.salvarFicha(Object.assign({}, g, { comunidade: 'Duas' }), {}, { marca: g.atualizado_em });
    assert.equal(h.comunidade, 'Duas');
  });
  test('sem marca (registro novo, tela antiga) grava como antes', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {});
    assert.equal((await api.salvarFicha(Object.assign({}, f, { comunidade: 'Sem marca' }), {})).comunidade, 'Sem marca');
    assert.equal((await api.salvarFicha(ficha(), {}, { marca: null })).situacao, 'aguardando');
  });
  test('ficha devolvida pela coordenação depois da leitura: a correção com a marca velha é recusada; com a nova, entra', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {}); await espera(3);
    await como('coord_tecnico'); await api.decidirFicha(f.id, 'devolvida', 'Falta o ponto de referência');
    await como('bolsista');
    await falha(api.salvarFicha(Object.assign({}, f, { ponto_referencia: 'Perto da escola' }), {}, { marca: f.atualizado_em }), CONFLITO);
    const agora = (await api.listarFichas()).find(x => x.id === f.id);
    assert.equal((await api.salvarFicha(Object.assign({}, agora, { ponto_referencia: 'Perto da escola' }), {}, { marca: agora.atualizado_em })).ponto_referencia, 'Perto da escola');
  });
  test('visita: remarcar com a marca velha, depois que outra pessoa remarcou, é recusado', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {});
    await como('coord_tecnico'); await api.decidirFicha(f.id, 'aprovada');
    const ex = await pessoa('agente', m => R.habilitado(m) && m.uf === 'PI');
    const v = await api.salvarVisita({ id: 'v47' + (seq++), ficha_id: f.id, etapa: 'diagnostico', executor_id: ex.id, data_prevista: diaMais(3) }, {}); await espera(3);
    const v2 = await api.salvarVisita(Object.assign({}, v, { data_prevista: diaMais(4) }), {}, { marca: v.atualizado_em });
    await falha(api.salvarVisita(Object.assign({}, v, { data_prevista: diaMais(5) }), {}, { marca: v.atualizado_em }), CONFLITO);
    assert.equal((await api.listarVisitas()).find(x => x.id === v.id).data_prevista, diaMais(4));
    await espera(3);
    assert.equal((await api.salvarVisita(Object.assign({}, v2, { data_prevista: diaMais(6) }), {}, { marca: v2.atualizado_em })).data_prevista, diaMais(6));
  });
});

describe('47 · fila do aparelho com a marca', () => {
  const apiFalsa = (comportamento = {}) => { const chamadas = [];
    const faz = tipo => async (dados, fotos, op) => { chamadas.push([tipo, dados.id, op && op.marca]); const c = comportamento[dados.id]; if (c) throw c; };
    return { chamadas, salvarFicha: faz('ficha'), salvarVisita: faz('visita'), salvarDiagnostico: faz('diagnostico'), salvarAvaliacao: faz('avaliacao') }; };

  test('a marca guardada no item vai no envio de cada tipo; item sem marca manda nulo', async () => {
    await F.salvar({ id: 'a', dono: 'u', tipo: 'ficha', dados: { id: 'a' }, marca: 'm-a' });
    await F.salvar({ id: 'b', dono: 'u', tipo: 'visita', dados: { id: 'b' }, marca: 'm-b' });
    await F.salvar({ id: 'c', dono: 'u', tipo: 'diagnostico', dados: { id: 'c' }, marca: 'm-c' });
    await F.salvar({ id: 'd', dono: 'u', tipo: 'avaliacao', dados: { id: 'd' }, marca: 'm-d' });
    await F.salvar({ id: 'e', dono: 'u', tipo: 'ficha', dados: { id: 'e' } });
    const a = apiFalsa(); await F.sincronizar(a, 'u');
    assert.deepEqual(simples(a.chamadas), [['ficha', 'a', 'm-a'], ['visita', 'b', 'm-b'], ['diagnostico', 'c', 'm-c'], ['avaliacao', 'd', 'm-d'], ['ficha', 'e', null]]);
  });
  test('recusa por versão: o item fica na fila (nada digitado se perde), marcado como conflito e com a mensagem', async () => {
    await F.salvar({ id: 'a', dono: 'u', tipo: 'ficha', dados: { id: 'a', comunidade: 'Digitada' }, marca: 'velha' });
    const r = await F.sincronizar(apiFalsa({ a: Object.assign(new Error(R.MSG_CONFLITO), { regra: true }) }), 'u');
    assert.equal(r.enviados, 0);
    const [it] = await F.listar('u');
    assert.equal(it.conflito, true); assert.equal(it.erro, R.MSG_CONFLITO); assert.equal(it.dados.comunidade, 'Digitada');
  });
  test('outro erro de regra não é conflito; falta de rede não marca nada', async () => {
    await F.salvar({ id: 'a', dono: 'u', tipo: 'ficha', dados: { id: 'a' } }); await F.salvar({ id: 'b', dono: 'u', tipo: 'ficha', dados: { id: 'b' } });
    await F.sincronizar(apiFalsa({ a: Object.assign(new Error('Ficha já aprovada pela coordenação técnica.'), { regra: true }), b: Object.assign(new Error('Failed to fetch'), { semRede: true }) }), 'u');
    const its = await F.listar('u');
    assert.equal(its.find(x => x.id === 'a').conflito, false); assert.equal(its.find(x => x.id === 'b').erro, undefined);
  });
  test('campos mudados: só o que difere do registro lido; soma com o que já estava mudado; sem registro lido, tudo', () => {
    const base = { id: '1', nome: 'Ana', comunidade: 'A', renda: 10, fotos: ['x'], atualizado_em: 't0' };
    assert.deepEqual(simples(MQ.camposMudados({ id: '1', nome: 'Ana', comunidade: 'B', renda: 10, fotos: ['x'], atualizado_em: 't9' }, base)), ['comunidade']);
    assert.deepEqual(simples(MQ.camposMudados({ id: '1', nome: 'Ana B', comunidade: 'A' }, base, ['comunidade'])), ['comunidade', 'nome']);
    assert.deepEqual(simples(MQ.camposMudados({ id: '1', nome: 'Ana', obs: '' , _fila: true }, null)), ['id', 'nome', 'obs']);
    assert.deepEqual(simples(MQ.camposMudados({ obs: null }, { obs: undefined })), []);
  });
  test('o que a tela mostra: sem conflito, o item por cima; em conflito, o servidor e só os campos que a pessoa mudou', () => {
    const serv = { id: '1', nome: 'Ana', comunidade: 'Do servidor', situacao: 'devolvida', atualizado_em: 't2' };
    const it = { id: '1', dados: { id: '1', nome: 'Ana Maria', comunidade: 'Antiga', situacao: 'aguardando' }, mud: ['nome'] };
    assert.deepEqual(simples(MQ.juntarFila(serv, it)), { id: '1', nome: 'Ana Maria', comunidade: 'Antiga', situacao: 'aguardando', atualizado_em: 't2' });
    assert.deepEqual(simples(MQ.juntarFila(serv, Object.assign({ conflito: true }, it))), { id: '1', nome: 'Ana Maria', comunidade: 'Do servidor', situacao: 'devolvida', atualizado_em: 't2' });
    assert.deepEqual(simples(MQ.juntarFila(undefined, Object.assign({ conflito: true }, it))), it.dados);
  });
  test('marca do envio: a do registro lido quando o formulário abriu; a do item que já está na fila; a nova depois de um conflito', () => {
    const vista = { fichas: [{ id: '1', atualizado_em: 't1' }], fila: [] }, agora = { fichas: [{ id: '1', atualizado_em: 't5' }], fila: [] };
    assert.equal(MQ.marcaDe('ficha', '1', vista, agora), 't1');                       // a lista atualizou por trás: vale o que a pessoa viu
    assert.equal(MQ.marcaDe('ficha', 'novo', vista, agora), null);                    // registro novo
    const naFila = { fichas: [{ id: '1', atualizado_em: 't1' }], fila: [{ id: '1', tipo: 'ficha', marca: 't0' }] };
    assert.equal(MQ.marcaDe('ficha', '1', naFila, naFila), 't0');                     // edição sobre edição sem internet: a primeira marca continua
    const conflito = { fichas: [{ id: '1', atualizado_em: 't7' }], fila: [{ id: '1', tipo: 'ficha', marca: 't0', conflito: true }] };
    assert.equal(MQ.marcaDe('ficha', '1', conflito, conflito), 't7');                 // reabriu depois da recusa: a marca do que ela conferiu
    const novoNaFila = { fichas: [], fila: [{ id: '9', tipo: 'ficha', marca: null }] };
    assert.equal(MQ.marcaDe('ficha', '9', novoNaFila, novoNaFila), null);
    assert.equal(MQ.marcaDe('ficha', '9', novoNaFila, { fichas: [{ id: '9', atualizado_em: 't3' }], fila: [] }), 't3');   // já subiu com o formulário aberto
    assert.equal(MQ.marcaDe('visita', '1', { visitas: [{ id: '1', atualizado_em: 'v1' }], fila: [{ id: '1', tipo: 'ficha', marca: 'x' }] }, {}), 'v1');   // item de outro tipo não conta
  });
});

describe('47 · fila + banco de demonstração (os três casos pedidos)', () => {
  const guardar = async (dados, lista, tipo = 'ficha') => {   // o que a tela faz ao salvar: marca do que foi lido + campos mudados
    const fila = await F.listar('eu'); const vista = { fichas: lista, visitas: lista, fila };
    const antes = fila.find(i => i.id === dados.id); const noServ = lista.find(x => x.id === dados.id);
    await F.salvar({ id: dados.id, dono: 'eu', tipo, dados, erro: null, marca: MQ.marcaDe(tipo, dados.id, vista, vista), mud: MQ.camposMudados(dados, noServ, antes && antes.mud) });
  };
  test('salvar duas vezes seguidas (com internet): as duas entram', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {}); await espera(3);
    await guardar(Object.assign({}, f, { comunidade: 'Primeira' }), await api.listarFichas()); assert.equal((await F.sincronizar(api, 'eu')).enviados, 1); await espera(3);
    await guardar(Object.assign({}, f, { comunidade: 'Segunda' }), await api.listarFichas()); assert.equal((await F.sincronizar(api, 'eu')).enviados, 1);
    assert.equal((await api.listarFichas()).find(x => x.id === f.id).comunidade, 'Segunda'); assert.equal((await F.listar('eu')).length, 0);
  });
  test('sem internet: editar duas vezes o mesmo registro e depois enviar: um envio só, com a marca da primeira leitura, e entra', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {}); await espera(3);
    const lida = await api.listarFichas();
    await guardar(Object.assign({}, f, { comunidade: 'Primeira' }), lida);
    await guardar(Object.assign({}, f, { comunidade: 'Primeira', endereco: 'Rua nova' }), lida);
    const [it] = await F.listar('eu');
    assert.equal(it.marca, f.atualizado_em); assert.deepEqual(simples(it.mud).sort(), ['comunidade', 'endereco']);
    assert.equal((await F.sincronizar(api, 'eu')).enviados, 1);
    const g = (await api.listarFichas()).find(x => x.id === f.id); assert.equal(g.comunidade, 'Primeira'); assert.equal(g.endereco, 'Rua nova');
  });
  test('edição na fila e a coordenação decide antes do envio: recusado, nada se perde; reabrindo, mostra o dado novo com a mudança dela e entra', async () => {
    await como('bolsista'); const f = await api.salvarFicha(ficha(), {}); await espera(3);
    await guardar(Object.assign({}, f, { comunidade: 'Editada sem internet' }), await api.listarFichas());
    await como('coord_tecnico'); await api.decidirFicha(f.id, 'devolvida', 'Falta o ponto de referência'); await espera(3);
    await como('bolsista');
    assert.equal((await F.sincronizar(api, 'eu')).enviados, 0);
    let [it] = await F.listar('eu');
    assert.equal(it.conflito, true); assert.match(it.erro, CONFLITO); assert.equal(it.dados.comunidade, 'Editada sem internet');
    const serv = (await api.listarFichas()).find(x => x.id === f.id);
    assert.equal(serv.comunidade, 'Comunidade Teste'); assert.equal(serv.situacao, 'devolvida');   // o servidor não foi alterado pelo envio recusado
    // "Corrigir": a tela mostra o servidor + só o que ela mudou; a devolução da coordenação aparece
    const naTela = MQ.juntarFila(serv, it);
    assert.equal(naTela.comunidade, 'Editada sem internet'); assert.equal(naTela.obs_coordenacao, 'Falta o ponto de referência'); assert.equal(naTela.situacao, 'devolvida');
    // "Enviar agora" sem conferir continua recusado (não passa por cima)
    it.reenviar = true; await F.salvar(it); assert.equal((await F.sincronizar(api, 'eu')).enviados, 0);
    // conferiu e salvou de novo: vai com a marca nova
    await guardar(Object.assign({}, naTela, { ponto_referencia: 'Perto da escola' }), await api.listarFichas());
    [it] = await F.listar('eu'); assert.equal(it.marca, serv.atualizado_em); assert.equal(it.erro, null);
    assert.equal((await F.sincronizar(api, 'eu')).enviados, 1);
    const fim = (await api.listarFichas()).find(x => x.id === f.id);
    assert.equal(fim.comunidade, 'Editada sem internet'); assert.equal(fim.ponto_referencia, 'Perto da escola'); assert.equal((await F.listar('eu')).length, 0);
  });
});

describe('47 · aprovar o cadastro vindo do link numa operação só', () => {
  const dadosLink = (o) => Object.assign({ nome: 'Luzia Rural Silva', cpf: cpfValido(seq++), email: 'luzia' + seq + '@gmail.com', telefone: '(89) 99911-2233',
    consentimento_lgpd: true, cadastro_arlo: false, data_nascimento: '1985-03-10', endereco: { cidade: 'Picos' } }, o);
  async function enviado() {
    await como('coord_tecnico'); const tk = await api.criarConvite('agente', 'PI'); const d = dadosLink(); await api.enviarPreCadastro(tk, d);
    const pre = (await api.listarPreCadastros()).find(x => x.cpf === R.soDigitos(d.cpf) || x.email === d.email);
    const m = { papel: 'agente', uf: 'PI', nome: d.nome, cpf: d.cpf, email: d.email, telefone: d.telefone, municipio: 'Picos', organizacao: 'Associação', data_inicio: diaMais(0), consentimento_lgpd: true };
    return { pre, m };
  }
  test('aprova: a pessoa entra na equipe, os dados pessoais ficam gravados e o cadastro enviado sai da lista', async () => {
    const { pre, m } = await enviado(); assert.ok(pre, 'o cadastro enviado aparece para a coordenação');
    const novo = await api.aprovarPreCadastro(pre.id, m, { data_nascimento: '1985-03-10', nis: null, endereco: { cidade: 'Picos' }, socioeconomico: null });
    assert.ok((await api.listarEquipe()).some(x => x.id === novo.id && x.status === 'ativa'));
    assert.equal((await api.lerPrivado(novo.id)).data_nascimento, '1985-03-10');
    assert.equal((await api.listarPreCadastros()).some(x => x.id === pre.id), false);
  });
  test('falha no meio (dados pessoais): nada fica gravado: sem pessoa nova e o cadastro enviado continua aguardando', async () => {
    const { pre, m } = await enviado(); const antes = (await api.listarEquipe()).length;
    const original = api.salvarPrivado; api.salvarPrivado = async () => { throw new Error('falha de propósito'); };
    try { await falha(api.aprovarPreCadastro(pre.id, m, { data_nascimento: '1985-03-10', endereco: {} }), /falha de propósito/); } finally { api.salvarPrivado = original; }
    assert.equal((await api.listarEquipe()).length, antes);
    assert.ok((await api.listarPreCadastros()).some(x => x.id === pre.id));
    await api.aprovarPreCadastro(pre.id, m, null);   // e pode aprovar de novo, sem "CPF já ocupa vaga"
  });
  test('cadastro já decidido não é aprovado de novo; cadastro inexistente é recusado', async () => {
    const { pre, m } = await enviado(); await api.aprovarPreCadastro(pre.id, m, null);
    await falha(api.aprovarPreCadastro(pre.id, m, null), /já foi decidido/);
    await falha(api.aprovarPreCadastro('nao-existe', m, null), /não encontrado/);
  });
});
