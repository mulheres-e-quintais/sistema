/* Contrato da camada de produção (js/api-supabase.js) com um Supabase simulado:
   toda leitura e toda gravação trata do mesmo jeito a recusa do banco e a falta de internet.
   Nenhuma gravação pode "dar certo" em silêncio quando o banco recusou. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montarApi } = require('./servidor_simulado');

const LEITURAS = ['listarPerfisEquipe', 'listarTestes', 'listarEntregas', 'listarCiencias', 'listarPedidosAcesso', 'listarAcessos', 'listarFichas', 'listarVisitas', 'listarDiagnosticos',
  'listarAvaliacoes', 'lerPrivado', 'meusDadosBancarios', 'situacaoBancaria', 'listarAPL', 'listarPreCadastros', 'contarExemplo', 'lerParametros', 'listarCustos', 'vitrine', 'listarVitrine',
  'listarEquipe', 'listarSolicitacoes', 'listarCanaisVenda', 'listarOrientacoesVenda', 'listarObservadores', 'listarKitItens', 'listarAgua', 'listarPlanilhasExec', 'listarDocumentos',
  'quemConferePedidos', 'listarPedidos', 'saldoPedidos', 'listarEquipeFic', 'listarEncontrosFic', 'listarTurmas', 'listarMatriculas', 'auditoria'];
const arq = () => ({ name: 'a.pdf', size: 10, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(1) });
const pessoa = () => ({ nome: 'Ana', cpf: '476.024.360-75', email: ' Ana@X.br ', papel: 'apoio', uf: 'RN' });
/* gravações: nome → argumentos de um pedido bem formado */
const GRAVACOES = {
  salvarTeste: [{ tarefa: 't1', resultado: 'ok' }], marcarEntrega: ['e1', '2026-10', true], darCiencia: ['doc'], pedirNovoAcesso: ['a@b.br'], descartarPedidoAcesso: ['p1'], gerarCodigoAcesso: ['e2'],
  salvarFicha: [{ id: 'f1', nome: 'Maria' }, {}, {}], decidirFicha: ['f1', 'aprovada', null, null], salvarVisita: [{ id: 'v1', ficha_id: 'f1' }, {}, {}], salvarDiagnostico: [{ id: 'd1', ficha_id: 'f1' }, {}, {}],
  salvarAvaliacao: [{ id: 'a1', ficha_id: 'f1' }, {}, {}], decidirDiagnostico: ['d1', 'aprovado', null, null], criarConvite: [{ papel: 'apoio', uf: 'RN' }], enviarPreCadastro: ['tok', { nome: 'A' }],
  salvarPrivado: ['e2', { nis: '1' }], salvarMeusDadosBancarios: [{ banco: '001' }], verContaArlo: ['e2'], salvarAPL: [{ municipio: 'Apodi', uf: 'RN' }], decidirPreCadastro: ['p1', 'recusado', 'm'],
  aprovarPreCadastro: ['p1', pessoa(), null], salvarParametros: [{ valor_km: 1 }], salvarKm: ['v1', 10], retirarFoto: ['x1', 'motivo'], solicitarPagamento: ['bolsa', '2026-10', 100, null, [], {}],
  avalizarPagamento: ['s1', true, null, 100], registrarNoArlo: ['s1', 'P1'], salvarCanalVenda: [{ nome: 'Feira', uf: 'RN' }], registrarOrientacaoVenda: [{ ficha_id: 'f1' }], dadosAcompanhamento: ['mda'],
  salvarObservador: [{ nome: 'M', email: 'm@x.br', orgao: 'mda' }], gerarCodigoObservador: ['o1'], salvarKitItem: [{ item: 'Regador', unidade: 'un', valor_ref: 10 }], registrarSituacaoAgua: ['f1', 'ok', null],
  enviarPlanilhaExec: [{ mes: '2026-10' }, arq()], enviarDocumento: [{ titulo: 'Ata', tipo: 'ata', data_documento: '2026-10-01' }, arq()], arquivarDocumento: ['d1', 'Versão errada'],
  salvarPedido: [{ tipo: 'passagem' }], definirValorPedido: ['p1', 10], moverPedido: ['p1', 'aprovar', null, null], salvarEncontroFic: [{ turma_id: 't1' }], cancelarEncontroFic: ['e1', 'm'],
  confirmarPresencaFic: ['e1', 'x1', true], salvarTurma: [{ nome: 'T' }], matricular: ['t1', 'e2'], cancelarMatricula: ['m1', 'm'], criar: [pessoa()], atualizar: ['e2', { nome: 'Ana B' }], desligar: ['e2', 'motivo', '2026-10-01'],
  enviarTermo: ['e2', arq()], enviarMeuTermo: ['e2', arq()], enviarFotoEquipe: ['e2', arq()]
};
/* de propósito não derrubam a tela se falharem: são registros de apoio */
const MELHOR_ESFORCO = ['registrarAcesso', 'limparVitrinePendente'];
const TECNICO = /permission denied|42501|PGRST|Failed to fetch|TypeError|undefined|\[object/;

describe('leituras: resposta vazia, recusa do banco e falta de internet', () => {
  for (const n of LEITURAS) test(n, async () => {
    const ok = await montarApi(); await assert.doesNotReject(ok.api[n](), 'resposta vazia do servidor não pode quebrar');
    assert.ok(ok.chamadas.length >= 1, 'consultou o servidor');
    const er = await montarApi({ modo: 'erro' });
    await assert.rejects(er.api[n](), e => { assert.ok(e.original, 'guarda o erro original para o console'); assert.equal(e.semRede, false); assert.doesNotMatch(e.message, TECNICO, 'mensagem para gente: ' + e.message); return true; });
    const rd = await montarApi({ modo: 'rede' });
    await assert.rejects(rd.api[n](), e => { assert.equal(e.semRede, true, 'falta de internet marcada: a tela usa a cópia do aparelho'); assert.doesNotMatch(e.message, TECNICO); return true; });
  });
});

describe('gravações: o banco recusou ou a internet caiu → sempre erro, nunca "salvo"', () => {
  for (const [n, args] of Object.entries(GRAVACOES)) test(n, async () => {
    const er = await montarApi({ modo: 'erro' });
    await assert.rejects(er.api[n](...args), e => { assert.ok(e.original, 'erro do banco, não de programação: ' + e.message); assert.doesNotMatch(e.message, TECNICO, e.message); return true; });
    assert.ok(er.chamadas.length >= 1);
    const rd = await montarApi({ modo: 'rede' });
    await assert.rejects(rd.api[n](...args), e => { assert.equal(e.semRede, true, e.message); assert.match(e.message, /Sem internet/); return true; });
  });
  test('registros de apoio (acesso, limpeza da vitrine) não derrubam a tela', async () => {
    for (const modo of ['erro', 'rede']) { const t = await montarApi({ modo }); for (const n of MELHOR_ESFORCO) await assert.doesNotReject(t.api[n]('abriu', 'celular')); }
  });
});

describe('nenhuma função da camada de produção fica sem teste', () => {
  test('toda função está numa das listas (ou é de entrada/sessão/arquivo, testada à parte)', async () => {
    const { api } = await montarApi();
    const AParte = /^(iniciar|eu|entrar|entrarSenha|criarSenha|trocarSenha|sair|organizarTexto|linkFoto|linkTermo|linkDocumento|linkPlanilhaExec|verConvite|publicarFoto)$/;
    const fora = Object.keys(api).filter(k => typeof api[k] === 'function' && !LEITURAS.includes(k) && !GRAVACOES[k] && !MELHOR_ESFORCO.includes(k) && !AParte.test(k));
    assert.deepEqual(fora, [], 'função nova sem teste de contrato: ' + fora.join(', '));
  });
});

describe('o que vai para o banco', () => {
  test('cadastro: CPF só com dígitos, e-mail sem espaços e em minúsculas, e o status nunca é enviado', async () => {
    const t = await montarApi(); await t.api.criar(Object.assign(pessoa(), { status: 'ativa' }));
    const ins = t.chamadas.find(c => c.nome === 'equipe').passos.find(p => p[0] === 'insert')[1][0];
    assert.equal(ins.cpf, '47602436075'); assert.equal(ins.email, 'ana@x.br'); assert.ok(!('status' in ins));
  });
  test('aprovar ficha manda a versão lida (dois aprovando ao mesmo tempo: o segundo é recusado pelo banco)', async () => {
    const t = await montarApi(); await t.api.decidirFicha('f1', 'aprovada', null, '2026-10-01T10:00:00.123456+00:00');
    const up = t.chamadas.find(c => c.nome === 'fichas').passos.find(p => p[0] === 'update')[1][0];
    assert.equal(up.atualizado_em, '2026-10-01T10:00:00.123456+00:00', 'a marca vai como texto, com os microssegundos');
    const u = await montarApi(); await u.api.decidirFicha('f1', 'recusada', 'faltou documento', 'x');
    assert.ok(!('atualizado_em' in u.chamadas[0].passos.find(p => p[0] === 'update')[1][0]), 'recusar não depende da versão');
  });
  test('pagamento: pedido e aval vão pelas funções do banco, com os nomes certos', async () => {
    const t = await montarApi(); await t.api.solicitarPagamento('bolsa', '2026-10', 700, 'rel', ['v1'], { a: 1 }); await t.api.avalizarPagamento('s1', false, 'sem entrega', null);
    assert.deepEqual(JSON.parse(JSON.stringify(t.chamadas.map(c => [c.nome, c.args]))), [
      ['solicitar_pagamento', { p_tipo: 'bolsa', p_mes: '2026-10', p_valor: 700, p_relatorio: 'rel', p_visitas: ['v1'], p_detalhe: { a: 1 } }],
      ['avalizar_pagamento', { p_id: 's1', p_ok: false, p_obs: 'sem entrega', p_valor: null }]]);
  });
  test('página pública e equipe do curso: resposta vazia do servidor não quebra a tela', async () => {
    const t = await montarApi(); assert.deepEqual(JSON.parse(JSON.stringify(await t.api.vitrine())), { fotos: [] }); assert.deepEqual([...(await t.api.listarEquipeFic())], []);
  });
  test('histórico: no máximo 200 registros, do mais novo para o mais antigo', async () => {
    const t = await montarApi(); await t.api.auditoria(); const p = t.chamadas[0].passos;
    assert.deepEqual(p.find(x => x[0] === 'limit')[1], [200]); assert.equal(p.find(x => x[0] === 'order')[1][1].ascending, false);
  });
});
