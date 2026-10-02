/* QA 01/10/2026 — js/api-demo.js: a demonstração (usada em treinamento) recusa o mesmo que a produção. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const { cpfValido } = require('./ambiente');
async function editarDemo(T, fn) { const ls = T.janela.localStorage; const d = JSON.parse(ls.getItem('mq-demo-v4')); fn(d); ls.setItem('mq-demo-v4', JSON.stringify(d)); await T.api.reler(); }
const lerDemo = T => JSON.parse(T.janela.localStorage.getItem('mq-demo-v4'));
async function campoPI() {
  const T = await montar('bolsista'); const { MQ, S } = T; const R = MQ.regras; const eu = S.eu;
  const fichas = S.fichas.filter(f => f.uf === eu.uf && f.resultado === 'selecionada' && f.situacao === 'aprovada');
  return { T, MQ, S, R, eu, fichas };
}
const naoEhErroDeCodigo = e => { assert.ok(!(e instanceof TypeError) && !(e instanceof SyntaxError) && !/Cannot read|is not a function|Nothing to repeat|Invalid regular/.test(e.message), e.message); return true; };

test('pedido devolvido perde o valor autorizado (42_revisao_seguranca.sql)', async () => {
  const T = await montar('bolsista'); const R = T.MQ.regras;
  const id = await T.api.salvarPedido(null, 'evento', 'Feira de sementes', R.somaDias(R.hoje(), 60), { valor_estimado: 5000 }, null);
  await T.api.trocarPerfil('coord_tecnico'); await T.api.moverPedido(id, 'conferir');
  await T.api.trocarPerfil('coord_geral'); await T.api.definirValorPedido(id, 5900); await T.api.moverPedido(id, 'devolver', 'corrigir o local');
  const p = (await T.api.listarPedidos()).find(x => x.id === id);
  assert.equal(p.situacao, 'devolvido'); assert.equal(p.valor_autorizado, null);
});
test('e-mail do cadastro é guardado em minúsculas', async () => {
  const T = await montar('coord_geral');
  const novo = await T.api.criar({ papel: 'professor_fic', nome: 'Pessoa Teste', cpf: cpfValido(444555666), email: '  Pessoa.Teste@IFRN.edu.br ', telefone: '84999990000', data_inicio: '2026-10-01', consentimento_lgpd: true });
  assert.equal(novo.email, 'pessoa.teste@ifrn.edu.br');
});
test('visita com etapa inexistente dá mensagem, não TypeError', async () => {
  const { T, R, eu, fichas } = await campoPI();
  await editarDemo(T, d => { d.visitas = []; d.diagnosticos = []; });
  for (const etapa of ['xpto', 'constructor', undefined])
    await assert.rejects(() => T.api.salvarVisita({ id: 'vy', ficha_id: fichas[0].id, etapa, executor_id: eu.id, data_prevista: R.hoje(), situacao: 'prevista' }), e => naoEhErroDeCodigo(e) && /Etapa da visita inválida/.test(e.message));
});
test('visita cancelada não volta a valer', async () => {
  const { T, R, eu, fichas } = await campoPI();
  await editarDemo(T, d => { d.visitas = []; d.diagnosticos = []; });
  const v = { id: 'vc1', ficha_id: fichas[0].id, etapa: 'diagnostico', executor_id: eu.id, data_prevista: R.hoje(), situacao: 'prevista' };
  await T.api.salvarVisita(v); await T.api.salvarVisita(Object.assign({}, v, { situacao: 'cancelada' }));
  await assert.rejects(() => T.api.salvarVisita(Object.assign({}, v, { situacao: 'prevista' })), /Visita cancelada não volta/);
  await assert.rejects(() => T.api.salvarVisita(Object.assign({}, v, { situacao: 'realizada', data_realizada: R.hoje() })), /Visita cancelada não volta/);
  await assert.doesNotReject(() => T.api.salvarVisita(Object.assign({}, v, { situacao: 'cancelada', relato: 'cancelada de novo' })));
});
test('legenda da vitrine: nome com caracteres de expressão regular ("C++ da Silva") não quebra', async () => {
  const T = await montar('coord_geral'); const f = T.S.fichas[0];
  await editarDemo(T, d => { Object.assign(d.fichas.find(x => x.id === f.id), { nome: 'C++ da Silva (teste', consent_imagem: true, consent_criancas: true }); });
  await assert.rejects(() => T.api.publicarFoto({ ficha_id: f.id, origem: 'diag', legenda: 'Quintal da C++ em outubro', sem_criancas: true }), e => naoEhErroDeCodigo(e) && /nome da mulher/.test(e.message));
  const v = await T.api.publicarFoto({ ficha_id: f.id, origem: 'diag', legenda: 'Canteiros prontos para o plantio', sem_criancas: true });
  assert.equal(v.legenda, 'Canteiros prontos para o plantio');
});
test('entrarSenha existe na demonstração e devolve erro amigável', async () => {
  const T = await montar('coord_geral');
  assert.equal(typeof T.api.entrarSenha, 'function');
  await assert.rejects(() => T.api.entrarSenha('a@b.com', 'senha'), /^Error: Na demonstração não há login: escolha um perfil acima\.$/);
});
async function comVisitaDiag() {
  const c = await campoPI(); const { T, R, eu, fichas } = c;
  await editarDemo(T, d => { d.diagnosticos = []; d.visitas = [{ id: 'vk', ficha_id: fichas[0].id, uf: eu.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: R.hoje(), situacao: 'prevista' }]; });
  const dg = (o = {}) => Object.assign({ id: 'dk', ficha_id: fichas[0].id, visita_id: 'vk', uf: eu.uf, data_visita: R.hoje(), latitude: -8.1, longitude: -41.1, sem_agua: false, lote: 1, dados: {} }, o);
  return Object.assign(c, { dg });
}
test('diagnóstico não é marcado como feito com data no futuro', async () => {
  const { T, R, dg } = await comVisitaDiag();
  await assert.rejects(() => T.api.salvarDiagnostico(dg({ data_visita: R.somaDias(R.hoje(), 10) }), {}), /A data da visita não pode ser no futuro/);
  assert.equal(lerDemo(T).visitas[0].situacao, 'prevista', 'a visita não foi marcada como feita');
});
test('kit acima de R$ 5.000 e item com quantidade zero ou negativa são recusados; kit dentro do teto passa', async () => {
  const { T, dg } = await comVisitaDiag();
  await assert.rejects(() => T.api.salvarDiagnostico(dg({ dados: { kit: [{ item: 'Motobomba', qtd: '3', valor: 4000 }] } }), {}), /O kit passa do valor por quintal .*teto é R\$ 5\.000,00/);
  await assert.rejects(() => T.api.salvarDiagnostico(dg({ dados: { kit: [{ item: 'Tela', qtd: '0', valor: 10 }] } }), {}), /Quantidade inválida no kit \(Tela\)/);
  await assert.rejects(() => T.api.salvarDiagnostico(dg({ dados: { kit: [{ item: 'Caixa d’água', qtd: '1', valor: 900 }, { item: 'Tela', qtd: '-2', valor: 10 }] } }), {}), /Quantidade inválida no kit \(Tela\)/);
  const ok = await T.api.salvarDiagnostico(dg({ dados: { kit: [{ item: 'Caixa d’água', qtd: '1', valor: 900 }, { item: 'Tela', qtd: '20 m', valor: 205 }] } }), {});
  assert.equal(ok.id, 'dk');   // 900 + 20 × 205 = 5.000: no teto
});
test('ajuda de custo com valor zero, negativo ou vazio é recusada', async () => {
  const T = await montar('bolsista'); const { MQ, S } = T; const hoje = MQ.regras.hoje(); const eu = S.eu;
  await editarDemo(T, d => { const f = d.fichas.find(x => x.uf === eu.uf && x.resultado === 'selecionada' && x.situacao === 'aprovada');
    d.visitas = [{ id: 'vz', ficha_id: f.id, uf: eu.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: hoje, data_realizada: hoje, situacao: 'realizada' }]; d.solicitacoes = []; d.solic_visitas = {};
    d.equipe.find(m => m.id === eu.id).data_inicio = hoje.slice(0, 8) + '01'; });
  for (const v of [0, -10, null, undefined, 'abc']) await assert.rejects(() => T.api.solicitarPagamento('ajuda_custo', hoje, v, null, ['vz'], {}), /Valor inválido/, 'valor ' + v);
  await assert.doesNotReject(() => T.api.solicitarPagamento('ajuda_custo', hoje, 176.08, null, ['vz'], {}));
});
test('aval de ajuda de custo: maior que zero e até R$ 2.000 por visita', async () => {
  const T = await montar('coord_tecnico'); const { MQ, S } = T; const hoje = MQ.regras.hoje();
  const ana = S.equipe.find(m => m.papel === 'articulacao' && m.uf === 'PI');
  const montarSolic = () => editarDemo(T, d => { d.solicitacoes = [{ id: 'sq1', tipo: 'ajuda_custo', equipe_id: ana.id, mes: hoje.slice(0, 8) + '01', situacao: 'solicitada', valor_solicitado: 356.5, valor_avalizado: null, detalhe: {}, solicitada_em: new Date().toISOString() }];
    d.solic_visitas = { va: 'sq1', vb: 'sq1' }; });
  await montarSolic(); await T.trocar('coord_tecnico');
  await assert.rejects(() => T.api.avalizarPagamento('sq1', true, null, 1000000), /Valor muito acima do pedido \(R\$\s356,50\)/);
  await assert.rejects(() => T.api.avalizarPagamento('sq1', true, null, 4000.01), /Valor muito acima do pedido.*até R\$ 2\.000,00 por visita/);
  await assert.rejects(() => T.api.avalizarPagamento('sq1', true, null, 0), /maior que zero/);
  await T.api.avalizarPagamento('sq1', true, null, 4000);   // 2 visitas × R$ 2.000 (o mesmo teto do banco)
  assert.equal(lerDemo(T).solicitacoes[0].valor_avalizado, 4000);
});
test('relatório da bolsa do professor: carga horária somada com 1 casa (0,1 + 0,2 = 0,3)', async () => {
  const T = await montar('professor'); const { MQ, S } = T; const hoje = MQ.regras.hoje(); const eu = S.eu;
  await editarDemo(T, d => { d.turmas = (d.turmas || []).concat([{ id: 'tq', nome: 'Turma de teste', professor_id: eu.id }]); d.solicitacoes = [];
    d.equipe.find(m => m.id === eu.id).data_inicio = hoje.slice(0, 8) + '01';
    d.ficEncontros = [0.1, 0.2].map((h, i) => ({ id: 'eq' + i, turma_id: 'tq', professor_id: eu.id, data: hoje, carga_horaria: h, modalidade: 'presencial', conteudo: 'Planejamento do quintal ' + i })); d.ficPresencas = []; });
  await T.trocar('professor');
  await T.api.solicitarPagamento('bolsa', hoje, 2200, 'Aulas dadas, materiais preparados e acompanhamento das turmas no mês.', [], {});
  const s = lerDemo(T).solicitacoes.find(x => x.tipo === 'bolsa');
  assert.equal(s.detalhe.fic_carga_horaria, 0.3);
});
