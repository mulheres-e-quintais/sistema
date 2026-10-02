/* QA 01/10/2026 — js/custos.js: centavos iguais em todas as telas, km inválido, formulário "Valores usados", simulação e CSV. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { FormDataFalso } = require('./ambiente');
const limpa = s => String(s).replace(/ /g, ' ');
const formFalso = (dataset = {}) => { const b = { textContent: 'x', disabled: false }; return { dataset, querySelector: s => /submit/.test(s) ? b : null, querySelectorAll: () => [], closest: () => null }; };
async function editarDemo(T, fn) { const ls = T.janela.localStorage; const d = JSON.parse(ls.getItem('mq-demo-v4')); fn(d); ls.setItem('mq-demo-v4', JSON.stringify(d)); await T.api.reler(); }

/* 4 visitas feitas hoje pela bolsista, km conferido = 1, carro a 12 km/L: cada visita = 150 + 1,08333… + 25 = 176,08333… */
async function cenarioCentavos() {
  const T = await montar('bolsista'); const { MQ, S } = T; const hoje = MQ.regras.hoje(); const eu = S.eu;
  await editarDemo(T, d => {
    const fs_ = d.fichas.filter(f => f.uf === eu.uf && f.resultado === 'selecionada' && f.situacao === 'aprovada');
    d.visitas = [0, 1, 2, 3].map(i => ({ id: 'vq' + i, ficha_id: fs_[i % fs_.length].id, uf: eu.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: hoje, data_realizada: hoje, situacao: 'realizada' }));
    d.diagnosticos = []; d.custos = d.visitas.map(v => ({ visita_id: v.id, km_ida: 1 }));
    d.parametros = { custo_visita: Object.assign({}, MQ.CUSTO_PADRAO, { km_por_litro: 12 }) };
    d.equipe.find(m => m.id === eu.id).data_inicio = hoje.slice(0, 8) + '01';
  });
  await T.trocar('bolsista'); await MQ.custosUI.garantir();
  return T;
}

test('calcular: cada visita sai arredondada a 2 casas (176,08, não 176,08333…) e o total é a soma das partes', async () => {
  const T = await cenarioCentavos(); const c = T.MQ.custosUI.calcular('diagnostico', 1);
  assert.equal(c.combustivel, 1.08); assert.equal(c.total, 176.08); assert.equal(c.trabalho, 150); assert.equal(c.refeicao, 25);
});
test('calcular: km negativo, NaN, texto e infinito = sem km (sem combustível, não conferido), nunca NaN ou infinito', async () => {
  const { MQ } = await montar('coord_geral'); await MQ.custosUI.garantir();
  for (const k of [-10, NaN, 'abc', Infinity, -Infinity, {}, '', null, undefined]) {
    const c = MQ.custosUI.calcular('diagnostico', k);
    assert.equal(c.combustivel, null, String(k)); assert.equal(c.completo, false, String(k)); assert.equal(c.total, 175, String(k));
  }
  assert.equal(MQ.custosUI.calcular('diagnostico', '30').total, 214); assert.equal(MQ.custosUI.calcular('diagnostico', 0).completo, true);
});
test('calcular: etapa desconhecida (inclusive "constructor") = 0 hora, sem NaN', async () => {
  const { MQ } = await montar('coord_geral'); await MQ.custosUI.garantir();
  for (const e of ['xpto', 'constructor', 'toString', '__proto__', '', null, undefined]) {
    const c = MQ.custosUI.calcular(e, 10);
    assert.equal(c.horas, 0, String(e)); assert.equal(c.trabalho, 0, String(e)); assert.equal(c.etapaDesconhecida, true, String(e)); assert.equal(c.total, 38, String(e));
  }
});
test('km por litro salvo como 0 (ou negativo): a tela não mostra "R$ ∞" nem NaN e usa o padrão', async () => {
  const N = await montar('bolsista');   // entra como bolsista para os Custos ainda não estarem carregados quando o parâmetro muda
  await editarDemo(N, d => { d.parametros = { custo_visita: Object.assign({}, N.MQ.CUSTO_PADRAO, { km_por_litro: 0, valor_hora: -5 }) }; });
  await N.trocar('coord_geral'); await N.MQ.custosUI.garantir();
  const c = N.MQ.custosUI.calcular('diagnostico', 30);
  assert.equal(c.total, 214, 'vale o padrão: 10 km/L e R$ 50 a hora');
  assert.doesNotMatch(texto(N.aba('custos')), /∞|NaN|Infinity/);
});
test('o valor do botão "Solicitar R$ …" é o enviado, o do aval e o da aba Custos (704,32 em todos)', async () => {
  const T = await cenarioCentavos(); const { MQ, S } = T;
  const m = /Solicitar\s+R\$\s?([\d.,]+)/.exec(limpa(texto(MQ.pagUI.secaoMinha())));
  assert.ok(m, 'achei o botão'); const mostrado = MQ.regras.valorBR(m[1]);
  assert.equal(mostrado, 704.32);
  let enviado = null; const orig = S.api.solicitarPagamento.bind(S.api);
  S.api.solicitarPagamento = async (tipo, mes, valor, ...r) => { enviado = valor; return orig(tipo, mes, valor, ...r); };
  await MQ.pagUI.enviar('pag-ajuda', formFalso({ mes: MQ.regras.hoje().slice(0, 7) }), new FormDataFalso({ v: ['vq0', 'vq1', 'vq2', 'vq3'] }));
  assert.equal(enviado, mostrado);
  // aval: sem ninguém mexer em nada, não há "Recalculado agora" e o campo sugere o valor pedido
  await T.trocar('coord_tecnico'); await MQ.custosUI.garantir();
  const s = T.S.solic.find(x => x.tipo === 'ajuda_custo'); const html = MQ.pagUI.painel({ id: s.id });
  assert.doesNotMatch(limpa(texto(html)), /Recalculado agora/);
  assert.equal(MQ.regras.valorBR(/name="valor"[^>]*value="([^"]*)"/.exec(html)[1]), enviado);
  // aba Custos: total do mês = soma das linhas mostradas = valor pedido
  await T.trocar('coord_geral'); await MQ.custosUI.garantir();
  const aba = T.aba('custos'); const t = limpa(texto(aba));
  const total = MQ.regras.valorBR(/R\$\s?([\d.,]+)\s+visitas feitas em/.exec(t)[1]);
  const linhas = [...aba.matchAll(/class="cl-v num"><b>R\$[\s ]?([\d.,]+)<\/b>/g)].map(x => MQ.regras.valorBR(x[1]));
  assert.equal(linhas.length, 4); assert.equal(total, enviado);
  assert.equal(Math.round(linhas.reduce((a, b) => a + b, 0) * 100) / 100, total);
});

const VALORES = { valor_hora: '50', refeicao: '25', km_por_litro: '10', preco_litro: '6,5', fator_estrada: '1,3', teto: '180000', h_diagnostico: '3', h_implantacao: '2', h_acompanhamento: '2', h_avaliacao: '2' };
async function salvarValores(mudanca) {
  const T = await montar('coord_geral'); await T.MQ.custosUI.garantir();
  let erros = null, salvo = null; T.MQ.ui.mostrarErros = (f, e) => { erros = e; };
  T.S.api.salvarParametros = async (k, v) => { salvo = v; return v; };
  await T.MQ.custosUI.enviar('custo-par', formFalso(), new FormDataFalso(Object.assign({}, VALORES, mudanca)));
  return { erros, salvo };
}
test('"Valores usados": campo vazio é recusado com mensagem (antes gravava 0)', async () => {
  let r = await salvarValores({ valor_hora: '' });
  assert.equal(r.salvo, null); assert.equal(r.erros.valor_hora, 'Informe o valor da hora.');
  r = await salvarValores({ km_por_litro: '', preco_litro: ' ', fator_estrada: '', refeicao: '', h_diagnostico: '' });
  assert.equal(r.salvo, null);
  assert.match(r.erros.km_por_litro, /Informe/); assert.match(r.erros.preco_litro, /Informe/); assert.match(r.erros.fator_estrada, /Informe/); assert.match(r.erros.refeicao, /Informe/); assert.match(r.erros.h_diagnostico, /Informe/);
});
test('"Valores usados": hora, km por litro, gasolina e fator têm de ser maiores que zero; refeição pode ser zero', async () => {
  for (const k of ['valor_hora', 'km_por_litro', 'preco_litro', 'fator_estrada']) for (const v of ['0', '-1', 'abc']) {
    const r = await salvarValores({ [k]: v }); assert.equal(r.salvo, null, k + '=' + v); assert.ok(r.erros[k], k + '=' + v);
  }
  assert.ok((await salvarValores({ refeicao: '-1' })).erros.refeicao);
  const ok = await salvarValores({ refeicao: '0' });
  assert.equal(ok.erros, null); assert.equal(ok.salvo.refeicao, 0); assert.equal(ok.salvo.valor_hora, 50); assert.equal(ok.salvo.preco_litro, 6.5);
});
test('simulação: km acima de 999 (ou negativo) é recusado com mensagem; vazio pede o km', async () => {
  const { MQ } = await montar('coord_geral'); await MQ.custosUI.garantir();
  assert.match(MQ.custosUI.simular('diagnostico', '1000'), /Distância inválida: informe de 0 a 999 km/);
  assert.match(MQ.custosUI.simular('diagnostico', '-5'), /Distância inválida/);
  assert.match(MQ.custosUI.simular('diagnostico', 'abc'), /Distância inválida/);
  assert.match(texto(MQ.custosUI.simular('diagnostico', '')), /informe o km/);
  assert.match(limpa(texto(MQ.custosUI.simular('diagnostico', '999'))), /Total\s+R\$ 1\.473,70/);
  assert.match(limpa(texto(MQ.custosUI.simular('diagnostico', '30,5'))), /Total\s+R\$ 214,65/);
});
test('CSV: célula que começa por = + - @ (ou tab) ganha apóstrofo; número negativo e texto comum ficam como estão', async () => {
  const { MQ } = await montar('coord_geral'); const q = MQ.custosUI.celCSV;
  assert.equal(q('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(q('+55 84'), '"\'+55 84"'); assert.equal(q('@ana'), '"\'@ana"'); assert.equal(q('-cmd'), '"\'-cmd"'); assert.equal(q('\t=1'), '"\'\t=1"');
  assert.equal(q('-5,00'), '"-5,00"'); assert.equal(q('Ana "Nana"'), '"Ana ""Nana"""'); assert.equal(q(null), '""'); assert.equal(q(12.5), '"12.5"');
});
