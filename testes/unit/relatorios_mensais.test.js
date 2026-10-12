/* 12/10/2026: o relatório da ação inclui os relatórios mensais da equipe (quadro de entregas sempre; textos com aval, opcionais). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

async function cenario() {
  const t = await montar('coord_geral'); const D = t.MQ.docsUI;
  const art = t.S.equipe.find(m => m.papel === 'articulacao' && m.status === 'ativa'), ag = t.S.equipe.find(m => m.papel === 'agente' && m.status === 'ativa');
  t.S.solic = [
    { id: 's1', tipo: 'bolsa', equipe_id: art.id, mes: '2026-10-01', situacao: 'avalizada', relatorio: 'Mobilizei 3 comunidades e acompanhei 12 fichas.', aval_em: '2026-11-03T12:00:00Z' },
    { id: 's2', tipo: 'bolsa', equipe_id: art.id, mes: '2026-11-01', situacao: 'devolvida', relatorio: 'Texto devolvido que não pode aparecer.' },
    { id: 's3', tipo: 'ajuda_custo', equipe_id: ag.id, mes: '2026-10-01', situacao: 'lancada', relatorio: null }
  ];
  return { t, D, art, ag };
}
const f = (o = {}) => Object.assign({ de: '2026-10-01', ate: '2026-11-30', uf: '' }, o);

test('quadro de entregas: pessoa × mês, com aval, devolvido e mês sem relatório; agentes ficam de fora', async () => {
  const { t, D, art } = await cenario(); const r = D.dadosRelatorio(t.S, f());
  assert.deepEqual([...r.relatorios.meses], ['2026-10', '2026-11']);
  const p = r.relatorios.pessoas.find(x => x.id === art.id); assert.equal(p.sit['2026-10'], 'aval'); assert.equal(p.sit['2026-11'], 'devolvido');
  assert.ok(!r.relatorios.pessoas.some(x => x.papel === 'agente'), 'agente não entra');
  const h = texto(D.htmlRelatorio(r, 'Teste'));
  assert.match(h, /8\. Relatórios mensais da equipe/); assert.match(h, /out\/26/); assert.ok(!/set\/26/.test(h), 'antes do início das bolsas não conta'); assert.match(h, /Com aval/); assert.match(h, /Devolvido/);
  assert.ok(!h.includes('Mobilizei 3 comunidades'), 'sem a opção, os textos não entram');
  assert.match(h, /Não contém nome, CPF ou endereço das beneficiárias/);
});
test('com a opção: só os textos com aval entram, em anexo, e a nota de LGPD pede revisão', async () => {
  const { t, D } = await cenario(); const h = texto(D.htmlRelatorio(D.dadosRelatorio(t.S, f({ textos: true })), 'Teste'));
  assert.match(h, /Anexo: textos dos relatórios mensais com aval/); assert.ok(h.includes('Mobilizei 3 comunidades e acompanhei 12 fichas.'));
  assert.ok(!h.includes('Texto devolvido que não pode aparecer'), 'devolvido não entra');
  assert.match(h, /podem citar beneficiárias: revise antes de enviar/); assert.ok(!/Não contém nome, CPF ou endereço/.test(h));
});
test('mês antes do início da pessoa não é cobrado; mês sem relatório aparece como não enviado', async () => {
  const { t, D, art } = await cenario(); art.data_inicio = '2026-11-01';
  const r = D.dadosRelatorio(t.S, f()); const p = r.relatorios.pessoas.find(x => x.id === art.id);
  assert.equal(p.sit['2026-11'], 'devolvido'); assert.equal(r.relatorios.pessoas.filter(x => x.sit['2026-10'] === null).length > 0, true);
  assert.match(texto(D.htmlRelatorio(r, 'Teste')), /Não enviado/);
});
test('filtro de estado e de período valem para os relatórios mensais', async () => {
  const { t, D, art } = await cenario(); const outra = t.MQ.UFS.find(u => u.uf !== art.uf).uf;
  assert.ok(!D.dadosRelatorio(t.S, f({ uf: outra, textos: true })).relatorios.textos.length, 'outro estado: sem o texto da articulação');
  assert.ok(!D.dadosRelatorio(t.S, f({ de: '2026-11-01', textos: true })).relatorios.textos.length, 'período sem o mês com aval');
});
test('texto do relatório não vira código no documento', async () => {
  const { t, D } = await cenario(); t.S.solic[0].relatorio = 'Fiz <script>alert(1)</script> e <img src=x onerror=alert(1)>';
  const h = D.htmlRelatorio(D.dadosRelatorio(t.S, f({ textos: true })), 'Teste'); assert.ok(!/<script>alert|<img src=x/.test(h));
});
test('tela do relatório tem a opção de incluir os textos', async () => {
  const { t } = await cenario(); const h = t.painel({ tipo: 'doc-relatorio' });
  assert.match(h, /<input id="rl-textos" name="textos" type="checkbox"/);
});
