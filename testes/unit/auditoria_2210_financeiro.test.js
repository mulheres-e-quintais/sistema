/* Auditoria independente de 22/10/2026 (v304): leitura da planilha da FUNCERN e contas do Financeiro. Cada teste reproduz um defeito achado. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const H = ['ID Solicitação', 'Tipo Solicitação', 'Beneficiário Nome', 'Beneficiário CPF', 'Valor', 'Rubrica Financeira', 'Subrubrica Financeira', 'Detalhe Rubrica', 'Status', 'Data Solicitação'];
const tab = (linhas, nome) => ({ abas: [{ nome: nome || 'Solicitações', linhas: [H].concat(linhas) }] });
const L = (id, rub, det, st, v, benef) => [String(id), 'Solicitação de Pagamento', benef || 'Fulana', '-', v == null ? 100 : v, rub, '-', det, st || 'Pago', '2026-10-05'];

test('1. nenhuma linha vira "recebido do MDA" pelo histórico (devolução de valor recebido)', async () => {
  const t = await montar('coord_geral'); const r = t.MQ.planilha.interpretar(tab([L(1, 'Outras despesas', 'Devolução de valor recebido a maior', 'Pago', 90)]), {});
  assert.notEqual(r.linhas[0].item, 'repasse_mda');
  const g = t.MQ.planilha.interpretar({ linhas: [['Data', 'Rubrica', 'Histórico', 'Valor'], ['01/10/2026', '', 'Pagamento de serviço, conforme recibo recebido', 500]] }, {});
  assert.notEqual(g.linhas[0].item, 'repasse_mda');
});
test('2. rubricas e itens: passagem de intercâmbio, INSS não é bolsa, tenda do evento não é kit, pessoa física não é PJ', async () => {
  const t = await montar('coord_geral'); const r = t.MQ.planilha.interpretar(tab([
    L(1, 'Passagens e Despesas com Locomoção', 'Passagem aérea intercâmbio'), L(2, 'Obrigações Tributárias', 'INSS sobre bolsa do coordenador geral'),
    L(3, 'Outros Serviços de Terceiros - Pessoa Jurídica', 'Locação de tenda para o evento Quintais Produtivos'), L(4, 'Outros Serviços de Terceiros - Pessoa Física', 'Serviço')]), {});
  const por = Object.fromEntries(r.linhas.map(l => [l.documento.replace('Solicitação ', ''), l]));
  assert.equal(por[1].item, 'passagem_intercambio'); assert.equal(por[1].rubrica, 'r6');
  assert.notEqual(por[2].item, 'bolsa_coord_geral'); assert.equal(por[3].item, 'eventos'); assert.notEqual(por[4].rubrica, 'r7');
});
test('7. status: pagamento efetuado e "Pago - aguardando prestação" são pagos; rejeitada, anulada e excluída não entram', async () => {
  const t = await montar('coord_geral'); const d = t.MQ.planilha.destinoStatus;
  assert.equal(d('Pagamento efetuado'), 'pago'); assert.equal(d('Pagamento realizado'), 'pago'); assert.equal(d('Pago - aguardando prestação de contas'), 'pago');
  assert.equal(d('Rejeitada'), 'ignorar'); assert.equal(d('Anulada'), 'ignorar'); assert.equal(d('Excluída'), 'ignorar');
  assert.equal(d('Pagamento'), 'comprometido'); assert.equal(d('Em liquidação'), 'comprometido'); assert.equal(d('Pago'), 'pago'); assert.equal(d('Cancelada'), 'ignorar');
});
test('6. aba grande que não é a de gastos não impede a leitura (a escolha é por nome e a leitura tolera a aba com erro)', async () => {
  const t = await montar('coord_geral'); const fs = require('fs'), path = require('path'); const b = fs.readFileSync(path.join(__dirname, 'fixtures', 'gastos_com_base_grande.xlsx'));
  const tb = await t.MQ.planilha.ler({ name: 'g.xlsx', size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  assert.equal(tb.aba, 'Gastos'); assert.equal(t.MQ.planilha.interpretar(tb, {}).linhas[0].item, 'combustivel');
  const r = t.MQ.planilha.interpretar({ aba: 'Gastos', linhas: [['Data', 'Item', 'Valor'], ['01/10/2026', 'Combustível', 100]], abas: [{ nome: 'Gastos', linhas: [['Data', 'Item', 'Valor'], ['01/10/2026', 'Combustível', 100]] }], abasIgnoradas: ['Base'] }, {});
  assert.equal(r.linhas[0].item, 'combustivel');
});
test('9. mesma numeração em abas diferentes vale nas duas; repetida na mesma aba e estorno avisam', async () => {
  const t = await montar('coord_geral');
  const r = t.MQ.planilha.interpretar({ abas: [{ nome: 'A', linhas: [H, L(1, 'Material de consumo', 'Combustível'), L(1, 'Material de consumo', 'Combustível'), L(2, 'Material de consumo', 'Estorno', 'Pago', -50)] }, { nome: 'CLT', linhas: [H, L(1, 'Material de consumo', 'Combustível')] }] }, {});
  assert.equal(r.linhas.length, 2); assert.ok(r.avisos.some(a => /repete o número/.test(a))); assert.ok(r.avisos.some(a => /valor negativo/.test(a)));
});
test('3. bolsa já na planilha da FUNCERN e lançada no sistema não conta duas vezes no comprometido', async () => {
  const t = await montar('coord_geral'); const S = t.S;
  const ct = S.equipe.find(m => m.papel === 'coord_tecnico' && m.status === 'ativa'); assert.ok(ct, 'há coordenação técnica no demo');
  const val = 4700;
  S.solic = (S.solic || []).filter(s => !(s.tipo === 'bolsa' && s.equipe_id === ct.id)).concat([{ id: 'x1', tipo: 'bolsa', equipe_id: ct.id, mes: '2026-10-01', situacao: 'lancada', arlo_em: '2026-10-07T12:00:00Z', valor_solicitado: val, valor_avalizado: val }]);
  S.execPlanilhas = [{ id: 'p1', arquivo_nome: 's.xlsx', posicao_em: '2026-10-06', enviado_em: '2026-10-08T12:00:00Z', linhas: [{ linha: 2, item: 'bolsa_coord_tecnico', rubrica: 'r2', valor: val, situacao: 'comprometido', status: 'Pagamento', favorecido: ct.nome, data: '2026-10-06' }] }];
  const n = t.MQ.execUI.numeros(); assert.equal(n.porItem.bolsa_coord_tecnico.comp, val, 'conta uma vez só');
  // a bolsa do mês seguinte, só com aval no sistema, entra (não "pega" a linha do mês anterior)
  S.solic.push({ id: 'x2', tipo: 'bolsa', equipe_id: ct.id, mes: '2026-11-01', situacao: 'avalizada', valor_solicitado: val, valor_avalizado: val });
  assert.equal(t.MQ.execUI.numeros().porItem.bolsa_coord_tecnico.comp, 2 * val);
});
test('8. escolher "Não entra" para todos os status não trava as próximas importações (a escolha não é guardada)', async () => {
  const t = await montar('coord_geral'); const ls = t.janela.localStorage;
  ls.setItem('mq-imp-status', JSON.stringify({ Pago: 'xyz' })); // valor inválido guardado é ignorado
  const fs = require('fs'), path = require('path'); const b = fs.readFileSync(path.join(__dirname, 'fixtures', 'funcern_solicitacoes.xlsx'));
  const pr = await t.MQ.execUI.preparar({ name: 'f.xlsx', size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  assert.equal(pr.resumo.gasto, 1250.5, 'valor inválido no aparelho não muda a leitura');
});
