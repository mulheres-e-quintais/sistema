/* 01/10/2026: orientação de venda do excedente (mesmas regras do 44_venda.sql) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto, botoes } = require('./telas');

const feira = { tipo: 'feira', nome: 'Feira de sábado', detalhe: 'Praça do mercado', contato: 'Dona Chica', ativo: true };
const grupo = { tipo: 'grupo', nome: 'Associação da Lagoa', ativo: true };
const ids = r => r.caminhos.map(c => c.id).join(',');

test('fome em casa: a folha não fala em venda', async () => {
  const t = await montar('bolsista'); const r = t.MQ.vendaUI.orientar({ sobra: [{ produto: 'hortalicas', regular: true }], caf: 'sim', grupo: true, ebia: 'grave', canais: [feira] });
  assert.match(r.bloqueio, /comida da casa/); assert.equal(r.caminhos.length, 0); assert.equal(r.falta.length, 0);
});
test('nada sobrando: sem caminhos, só o aviso de que a prioridade é a família', async () => {
  const t = await montar('bolsista'); const r = t.MQ.vendaUI.orientar({ sobra: [], caf: 'nao', canais: [feira] });
  assert.equal(r.caminhos.length, 0); assert.match(r.avisos[0], /não está sobrando/);
});
test('sobra de vez em quando: vender perto de casa; não sugere merenda nem PAA', async () => {
  const t = await montar('bolsista'); const r = t.MQ.vendaUI.orientar({ sobra: [{ produto: 'hortalicas', regular: false }], caf: 'nao', canais: [] });
  assert.equal(ids(r), 'perto'); assert.equal(r.falta.length, 0); assert.ok(r.lembretes.some(l => /sobra for certa toda semana/.test(l)));
});
test('sobra toda semana: perto, feira e venda em grupo; sem CAF e sem grupo, a folha diz o que falta', async () => {
  const t = await montar('bolsista'); const r = t.MQ.vendaUI.orientar({ sobra: [{ produto: 'hortalicas', regular: true }], caf: 'nao', grupo: false, canais: [feira, grupo] });
  assert.equal(ids(r), 'perto,feira,grupo'); assert.equal(r.falta.length, 2); assert.match(r.falta[0], /CAF/); assert.match(r.falta[1], /grupo/);
  assert.equal(r.caminhos[1].canais[0].nome, 'Feira de sábado'); assert.equal(r.caminhos[2].canais[0].nome, 'Associação da Lagoa');
});
test('com CAF e em grupo, nada falta', async () => {
  const t = await montar('bolsista'); const r = t.MQ.vendaUI.orientar({ sobra: [{ produto: 'frutiferas', regular: true }], caf: 'sim', grupo: true, canais: [] });
  assert.equal(r.falta.length, 0);
});
test('ovos e criação: aviso da inspeção sanitária e nada de merenda só por causa deles', async () => {
  const t = await montar('bolsista'); const r = t.MQ.vendaUI.orientar({ sobra: [{ produto: 'galinhas', regular: true }], caf: 'sim', grupo: true, canais: [] });
  assert.ok(r.avisos.some(a => /inspeção sanitária/.test(a))); assert.ok(!ids(r).includes('grupo'));
});
test('a folha não sugere preço e sempre lembra: primeiro a comida da família', async () => {
  const t = await montar('bolsista'); const V = t.MQ.vendaUI; const x = { sobra: [{ produto: 'hortalicas', regular: true }], caf: 'sim', grupo: true };
  const r = V.orientar(Object.assign({ canais: [feira] }, x)); const f = { nome: 'Maria <b>Teste</b>', municipio: 'Paulistana', uf: 'PI' };
  const h = V.folhaHTML(f, x, r); const tx = V.folhaTexto(f, x, r);
  assert.ok(!/R\$/.test(h) && !/R\$/.test(tx), 'sem preço'); assert.match(tx, /primeiro a comida da família/); assert.match(h, /Feira de sábado/);
  assert.ok(!h.includes('<b>Teste</b>'), 'nome com código não vira HTML'); assert.match(h, /revisada em \d\d\/\d\d\/\d{4}/);
});

test('bolsista cadastra canal só no próprio estado; canal repetido é recusado; agente não cadastra', async () => {
  const t = await montar('bolsista'); const uf = t.S.eu.uf; const outro = uf === 'BA' ? 'PE' : 'BA';
  const c = { uf, municipio: 'Paulistana', tipo: 'feira', nome: 'Feira nova do bairro', detalhe: 'Domingo', contato: '' };
  const id = await t.api.salvarCanalVenda(c); assert.ok(id);
  await assert.rejects(t.api.salvarCanalVenda(c), /já está cadastrado/);
  await assert.rejects(t.api.salvarCanalVenda(Object.assign({}, c, { uf: outro, nome: 'Outra feira' })), /só do seu estado/);
  await assert.rejects(t.api.salvarCanalVenda(Object.assign({}, c, { nome: 'ab' })), /nome/);
  await t.api.salvarCanalVenda(Object.assign({}, c, { id, ativo: false }));
  assert.equal((await t.api.listarCanaisVenda()).find(x => x.id === id).ativo, false, 'desativa, não apaga');
  await t.trocar('agente'); await assert.rejects(t.api.salvarCanalVenda(Object.assign({}, c, { nome: 'Feira da agente' })), /coordenação ou a bolsista/);
});
test('orientação: precisa de diagnóstico, da resposta do CAF e de mulher selecionada', async () => {
  const t = await montar('bolsista'); const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4'));
  const comDiag = d.fichas.find(f => f.uf === t.S.eu.uf && f.resultado === 'selecionada' && f.situacao === 'aprovada' && d.diagnosticos.some(x => x.ficha_id === f.id));
  assert.ok(comDiag, 'a demonstração tem quintal com diagnóstico');
  await assert.rejects(t.api.registrarOrientacaoVenda(comDiag.id, { sobra: [], caf: '' }), /CAF/);
  await assert.rejects(t.api.registrarOrientacaoVenda(comDiag.id, { caf: 'sim' }), /sobrando/);
  const id = await t.api.registrarOrientacaoVenda(comDiag.id, { sobra: [{ produto: 'hortalicas', regular: true }], caf: 'nao_sabe', grupo: false }); assert.ok(id);
  const sem = d.fichas.find(f => f.uf === t.S.eu.uf && !d.diagnosticos.some(x => x.ficha_id === f.id) && f.resultado === 'selecionada' && f.situacao === 'aprovada');
  if (sem) await assert.rejects(t.api.registrarOrientacaoVenda(sem.id, { sobra: [], caf: 'sim' }), /diagnóstico/);
});
test('telas: bolsista vê "Onde vender" e o botão de orientação; coordenação vê os canais de todos os estados', async () => {
  const t = await montar('bolsista'); const h = t.aba(null);
  assert.match(texto(h), /Onde vender/); assert.ok(botoes(h, 'venda-canal-novo').length > 0);
  const p = texto(t.painel({ tipo: 'venda-canal', uf: t.S.eu.uf })); assert.match(p, /Cadastrar canal/); assert.match(p, /Tipo de canal/);
  await t.trocar('coord_geral'); const c = t.aba('campo'); assert.match(texto(c), /Onde vender/); assert.match(texto(c), /Feira da agricultura familiar \(exemplo\)/);
});
