/* 01/10/2026: revisão geral — cada correção tem o seu teste (mesmas regras do 42_revisao_seguranca.sql) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { carregar } = require('./ambiente');

const base = () => carregar(['dados.js', 'regras.js']).MQ.regras;
const csv = (nome, txt) => { const b = Buffer.from(txt, 'utf8'); return { name: nome, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };

/* ---------- números em reais: a tela e o banco leem igual (casos do public.num_br) ---------- */
test('valor em reais digitado de qualquer jeito vira o número certo (teclado do Android, ponto de milhar, R$)', () => {
  const R = base();
  const casos = { '1600.50': 1600.5, '1.600,50': 1600.5, '1600,5': 1600.5, 'R$ 1.600': 1600, '1600': 1600, '1,600.50': 1600.5, '0,50': 0.5, '12.50': 12.5 };
  for (const [t, v] of Object.entries(casos)) assert.equal(R.valorBR(t), v, t);
  for (const t of ['', 'abc', '1,2,3']) assert.ok(Number.isNaN(R.valorBR(t)), t);
});
test('quantidade do kit: "2,5" é dois e meio, "1.000" é mil, "10 kg" é dez (igual ao banco)', () => {
  const R = base();
  assert.deepEqual(['2,5', '1.000', '12.50', '10 kg', '1.234,5', 'x', '1,600.50'].map(R.numBR), [2.5, 1000, 12.5, 10, 1234.5, null, 1600.5]);
});

/* ---------- datas no dia de Fortaleza (npm test roda com TZ=America/Fortaleza) ---------- */
test('data e hora do servidor depois das 21h mostram o dia de Fortaleza, não o dia seguinte', () => {
  const R = base();
  assert.equal(R.fmtData('2026-10-01T23:30:00-03:00'), '01/10/2026');
  assert.equal(R.fmtData('2026-10-02T02:30:00+00:00'), '01/10/2026');   // 23h30 em Fortaleza
  assert.equal(R.fmtData('2026-10-01'), '01/10/2026');
  assert.equal(R.fmtData(null), '');
});
test('somar dias não pula um dia por causa do fuso', () => {
  const R = base();
  assert.equal(R.somaDias('2026-10-01', 7), '2026-10-08'); assert.equal(R.somaDias('2026-12-28', 5), '2027-01-02'); assert.equal(R.somaDias('2026-03-01', -1), '2026-02-28');
});

/* ---------- aval de pagamento ---------- */
test('aval: valor zero ou maior que o pedido é recusado; igual ou menor passa', async () => {
  const t = await montar('bolsista'); const rel = 'Relatório do mês com as visitas, os encontros e o que foi feito no campo.';
  const mes = t.MQ.regras.hoje().slice(0, 7) + '-01';
  const id = await t.api.solicitarPagamento('bolsa', mes, 1400, rel, [], {});
  await t.trocar('coord_tecnico');
  await assert.rejects(t.api.avalizarPagamento(id, true, null, 0), /maior que zero/);
  await assert.rejects(t.api.avalizarPagamento(id, true, null, 2000), /passa do valor pedido/);
  await t.api.avalizarPagamento(id, true, null, 1200);
  assert.equal(JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')).solicitacoes.find(s => s.id === id).valor_avalizado, 1200);
});

/* ---------- planilha: "Total" no nome do fornecedor não apaga o gasto ---------- */
test('planilha: fornecedor chamado "Total ..." com data é gasto; linha "Total" sem data é ignorada', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.planilha;
  const txt = 'Data;Item do orçamento;Descrição;Documento;Valor (R$)\n05/09/2026;Material de consumo;Total Distribuidora Ltda;NF 12;800,00\n06/09/2026;Material de consumo;Sementes;NF 13;200,00\n;Total;;;1.000,00\n;Total geral;;;1.000,00\n';
  const r = P.interpretar(await P.ler(csv('gastos.csv', txt)));
  assert.equal(r.linhas.length, 2, 'as duas compras entram');
  assert.equal(r.linhas.reduce((s, l) => s + l.valor, 0), 1000);
});

/* ---------- sair: nada da pessoa anterior fica na memória ---------- */
test('ao sair, códigos de acesso, pagamentos, pedidos e dados pessoais do usuário anterior somem da memória', () => {
  // fora do modo demonstração (que só volta para a tela de entrada): a rotina de saída zera tudo
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/app.js'), 'utf8');
  const i0 = src.indexOf('async function sairDoSistema'); const sair = src.slice(i0, src.indexOf('\n  }\n', i0));
  for (const k of ['S.eu = null', 'S.equipe = []', 'S.fichas = []', 'S.solic = []', 'S.pedidos = []', 'S.turmas = []', 'S.matriculas = []', 'S.codigos = {}', 'limparCache()'])
    assert.ok(sair.includes(k), 'falta zerar ' + k);
});

/* ---------- encontros: quem saiu da turma não perde a presença ao corrigir o encontro ---------- */
test('corrigir um encontro mantém a presença de quem saiu da turma depois (não aparece no formulário)', async () => {
  const t = await montar('professor'); const S = t.S;
  const enc = { id: 'e1', turma_id: 't1', data: '2026-09-10', carga_horaria: 2, modalidade: 'presencial', conteudo: 'Aula sobre quintais produtivos',
    presencas: [{ equipe_id: 'saiu', presente: true }, { equipe_id: 'ficou', presente: true }] };
  S.encontros = [enc];
  let enviado = null; S.api.salvarEncontroFic = async x => { enviado = x; };
  const form = { dataset: { id: 'e1' }, querySelectorAll: () => [{ value: 'ficou', checked: true }] };
  const fd = { get: k => ({ turma_id: 't1', data: '2026-09-10', carga_horaria: '2', modalidade: 'presencial', conteudo: 'Aula sobre quintais produtivos' })[k] };
  t.MQ.ui.ocupado = async (f, fn) => fn(); t.MQ.ui.carregar = async () => {}; t.MQ.ui.fecharPainel = () => {}; t.MQ.ui.render = () => {}; t.MQ.ui.toast = () => {};
  await t.MQ.encUI.enviar('enc-salvar', form, fd);
  assert.ok(enviado, 'salvou'); assert.equal(JSON.stringify([...enviado.presentes].sort()), JSON.stringify(['ficou', 'saiu']));
});

/* ---------- coordenação geral registra encontro no lugar do professor ---------- */
test('a coordenação geral vê a seção de encontros na aba Curso FIC (registra no lugar do professor)', async () => {
  const t = await montar('coord_geral'); const h = t.aba('fic');
  assert.match(texto(h), /Encontros do curso e lista de presença/); assert.match(texto(h), /no lugar do professor/);
});

/* ---------- visão geral: aviso da planilha do mês ---------- */
test('a partir do dia 20, sem planilha do mês, o painel da coordenação geral avisa', async () => {
  const t = await montar('coord_geral'); const R = t.MQ.regras; const hoje0 = R.hoje;
  R.hoje = () => '2026-10-25'; t.S.execPlanilhas = [];
  try { assert.match(texto(t.aba('visao')), /Planilha de gastos do mês ainda não enviada/); }
  finally { R.hoje = hoje0; }
});

/* ---------- pedidos: data vencida não aparece como "faltam -5 dias" ---------- */
test('pedido com data vencida mostra "a data já passou", nunca dias negativos', async () => {
  const t = await montar('bolsista');
  t.S.pedidos = [{ id: 'p1', tipo: 'evento', uf: t.S.eu.uf, solicitante_id: t.S.eu.id, titulo: 'Roda de conversa no assentamento', data_ref: t.MQ.regras.somaDias(t.MQ.regras.hoje(), -5), situacao: 'enviado', dados: { valor_estimado: 500 } }];
  const h = texto(t.aba(null)) + texto(t.aba('viagens'));
  assert.ok(!/faltam -\d/.test(h), 'sem dias negativos');
});
