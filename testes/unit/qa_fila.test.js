/* QA 01/10/2026 — js/fila.js: regravar mantém a ordem de envio; erro traduzido; só foto de verdade é aceita. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');

const novo = () => carregar(['dados.js', 'regras.js', 'fila.js']);
const MSG = 'Este arquivo não é uma foto. Tire a foto de novo ou escolha outra imagem.';

test('regravar um item da fila preserva "criado": o diagnóstico corrigido continua antes da implantação', async () => {
  const { MQ } = novo(); const F = MQ.fila;
  await F.salvar({ id: 'diag', dono: 'u', tipo: 'diagnostico', dados: { v: 1 }, criado: 1000 });
  await F.salvar({ id: 'impl', dono: 'u', tipo: 'visita', dados: {}, criado: 2000 });
  const r = await F.salvar({ id: 'diag', dono: 'u', tipo: 'diagnostico', dados: { v: 2 }, erro: null });   // a tela regrava sem "criado"
  assert.equal(r.criado, 1000);
  const l = await F.listar('u');
  assert.deepEqual([...l].map(x => x.id), ['diag', 'impl']); assert.equal(l[0].dados.v, 2);
  const outro = await F.salvar({ id: 'novo', dono: 'u', tipo: 'ficha', dados: {} });
  assert.ok(outro.criado > 2000, 'item novo recebe a data de agora');
});
test('sincronizar envia na ordem original mesmo depois de corrigir o primeiro item', async () => {
  const { MQ } = novo(); const F = MQ.fila; const ordem = [];
  await F.salvar({ id: 'diag', dono: 'u', tipo: 'diagnostico', dados: { id: 'diag' }, criado: 1000 });
  await F.salvar({ id: 'impl', dono: 'u', tipo: 'visita', dados: { id: 'impl' }, criado: 2000 });
  await F.salvar({ id: 'diag', dono: 'u', tipo: 'diagnostico', dados: { id: 'diag' } });
  const api = { salvarDiagnostico: async d => { ordem.push('diagnostico'); }, salvarVisita: async d => { if (!ordem.includes('diagnostico')) throw new Error('Primeiro o diagnóstico.'); ordem.push('visita'); } };
  const r = await F.sincronizar(api, 'u');
  assert.deepEqual(ordem, ['diagnostico', 'visita']); assert.equal(r.enviados, 2);
});
test('erro do servidor fica guardado já traduzido (R.mensagemErro), não o texto cru', async () => {
  const { MQ } = novo(); const F = MQ.fila;
  await F.salvar({ id: 'f1', dono: 'u', tipo: 'ficha', dados: {} });
  await F.salvar({ id: 'f2', dono: 'u', tipo: 'ficha', dados: {} });
  let n = 0;
  await F.sincronizar({ salvarFicha: async () => { throw new Error(n++ ? 'duplicate key value violates unique constraint "fichas_cpf_unico"' : 'new row violates row-level security policy for table "fichas"'); } }, 'u');
  const l = await F.listar('u');
  assert.equal(l[0].erro, 'Seu perfil não tem permissão para esta ação.');
  assert.match(l[1].erro, /Esta mulher \(CPF\) já tem ficha no projeto/);
  for (const it of l) assert.doesNotMatch(it.erro, /row-level|duplicate key|constraint/);
});

/* ---------- fotos ---------- */
const arq = (conteudo, type) => new Blob(Array.isArray(conteudo) ? conteudo : [conteudo], { type });
/* navegador de mentira: Image que abre (ou não) e canvas que devolve um JPEG pequeno (ou nada) */
function comNavegador(a, { abre = true, jpeg = 'jpg' } = {}) {
  a.janela.Image = class { set src(v) { setTimeout(() => { if (abre) { this.width = 3200; this.height = 2400; this.onload(); } else this.onerror(); }, 0); } };
  a.janela.document.createElement = () => ({ getContext: () => ({ drawImage() {} }), toBlob(cb) { cb(jpeg == null ? null : new Blob([jpeg], { type: 'image/jpeg' })); } });
}
test('fotoValida: só JPEG, PNG, WebP e HEIC/HEIF com tamanho maior que zero', () => {
  const { MQ } = novo();
  for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'IMAGE/JPEG']) assert.equal(MQ.fotoValida(arq('abc', t)), true, t);
  for (const t of ['text/plain', 'application/pdf', 'application/x-msdownload', 'image/svg+xml', 'image/gif', '']) assert.equal(MQ.fotoValida(arq('abc', t)), false, t);
  assert.equal(MQ.fotoValida(arq('', 'image/png')), false, '0 byte'); assert.equal(MQ.fotoValida(null), false);
});
test('arquivo que não é imagem, vazio ou .exe é recusado com a mensagem (não devolve o original)', async () => {
  const a = novo(); comNavegador(a);
  for (const f of [arq('texto', 'text/plain'), arq('', 'image/png'), arq('MZ', 'application/x-msdownload'), null])
    await assert.rejects(() => a.MQ.comprimirFoto(f), e => e.message === MSG && e.naoEhFoto === true);
});
test('txt renomeado para .png (tipo de imagem, mas o navegador não consegue abrir) é recusado', async () => {
  const a = novo(); comNavegador(a, { abre: false });
  await assert.rejects(() => a.MQ.comprimirFoto(arq('isto é um texto', 'image/png')), e => e.message === MSG);
  await assert.rejects(() => a.MQ.comprimirFoto(arq('isto não é heic', 'image/heic')), e => e.message === MSG);
  // HEIC verdadeiro (iPhone) que este navegador não abre fica como veio; foto que abre sai reduzida
  const heic = arq([new Uint8Array([0, 0, 0, 24]), 'ftypheic', 'x'.repeat(100)], 'image/heic');
  assert.equal(await a.MQ.comprimirFoto(heic), heic);
  comNavegador(a);
  const grande = arq('x'.repeat(5000), 'image/jpeg'); const r = await a.MQ.comprimirFoto(grande);
  assert.equal(r.type, 'image/jpeg'); assert.ok(r.size < grande.size);
});
test('compressão que falha (canvas não gera a imagem) é recusada', async () => {
  const a = novo(); comNavegador(a, { jpeg: null });
  await assert.rejects(() => a.MQ.comprimirFoto(arq('x'.repeat(5000), 'image/jpeg')), e => e.message === MSG);
});
test('a recusa avisa na tela (toast) para as telas que não tratam o erro; com semAviso não avisa', async () => {
  const avisos = []; const a = carregar(['dados.js', 'regras.js', 'fila.js'], { ui: { toast: m => avisos.push(m) } }); comNavegador(a, { abre: false });
  await assert.rejects(() => a.MQ.comprimirFoto(arq('texto', 'image/png')));
  assert.deepEqual(avisos, [MSG]);
  await assert.rejects(() => a.MQ.comprimirFoto(arq('texto', 'image/png'), undefined, undefined, { semAviso: true }));
  assert.equal(avisos.length, 1);
});
