/* QA2 02/10/2026 — arquivo conferido pelo CONTEÚDO (assinatura), não só pela extensão: MQ.arquivoConfere (fila.js),
   usado no termo da habilitação (app.js), em Documentos (documentos.js) e no PDF da ficha (fichas.js). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');

const arq = (nome, bytes) => { const b = new Blob([bytes instanceof Uint8Array ? bytes : Buffer.from(bytes)]); b.name = nome; return b; };
const PDF = '%PDF-1.4\n%%EOF', JPG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10]), PNG = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  ZIP = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]), OLE = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), EXE = new Uint8Array([0x4D, 0x5A, 0x90, 0, 3]);
const TODOS = ['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'jpg', 'jpeg', 'png'];

test('assinatura: cada tipo é reconhecido pelos primeiros bytes', async () => {
  const { MQ } = await montar('coord_geral'); const a = MQ.assinaturaDe;
  assert.equal(a(Buffer.from(PDF)), 'pdf'); assert.equal(a(JPG), 'jpg'); assert.equal(a(PNG), 'png'); assert.equal(a(ZIP), 'zip'); assert.equal(a(OLE), 'ole');
  assert.equal(a(EXE), ''); assert.equal(a(Buffer.from('<html>')), ''); assert.equal(a(new Uint8Array(0)), '');
});
test('arquivo de verdade passa: PDF, JPG, PNG, DOCX/XLSX (PK), DOC/XLS antigos (D0 CF 11 E0)', async () => {
  const { MQ } = await montar('coord_geral');
  for (const [n, b] of [['ata.pdf', PDF], ['ATA.PDF', PDF], ['foto.jpg', JPG], ['foto.jpeg', JPG], ['foto.png', PNG], ['doc.docx', ZIP], ['plan.xlsx', ZIP], ['texto.odt', ZIP], ['velho.doc', OLE], ['velha.xls', OLE]])
    assert.equal(await MQ.arquivoConfere(arq(n, b), TODOS), '', n);
});
test('HTML ou programa renomeado para .pdf é recusado com mensagem simples', async () => {
  const { MQ } = await montar('coord_geral');
  const msg = 'Este arquivo não é um PDF de verdade (ou está corrompido). Gere o PDF de novo.';
  assert.equal(await MQ.arquivoConfere(arq('falso.pdf', '<html><body>oi</body></html>'), TODOS), msg);
  assert.equal(await MQ.arquivoConfere(arq('virus.pdf', EXE), TODOS), msg);
});
test('a extensão tem de combinar com o conteúdo: PDF com nome .png, PNG com nome .jpg, texto com nome .docx', async () => {
  const { MQ } = await montar('coord_geral');
  assert.match(await MQ.arquivoConfere(arq('pdf.png', PDF), TODOS), /não é uma foto de verdade/);
  assert.equal(await MQ.arquivoConfere(arq('png.jpg', PNG), TODOS), '');   // foto de verdade com a extensão trocada (print de celular) é aceita
  assert.match(await MQ.arquivoConfere(arq('html.jpg', '<html><script>x</script></html>'), TODOS), /não é uma foto de verdade/);
  assert.match(await MQ.arquivoConfere(arq('texto.docx', 'texto puro'), TODOS), /não é um documento do Word de verdade/);
  assert.match(await MQ.arquivoConfere(arq('texto.xlsx', 'a;b;c'), TODOS), /não é uma planilha de verdade/);
});
test('extensão fora da lista (.exe, sem extensão) e arquivo vazio são recusados', async () => {
  const { MQ } = await montar('coord_geral');
  assert.match(await MQ.arquivoConfere(arq('programa.exe', EXE), ['pdf', 'jpg', 'png'], { rotulo: 'PDF ou foto (JPG, PNG)' }), /^Tipo de arquivo não aceito\. Use PDF ou foto \(JPG, PNG\)\.$/);
  assert.match(await MQ.arquivoConfere(arq('semextensao', PDF), TODOS), /Tipo de arquivo não aceito/);
  assert.match(await MQ.arquivoConfere(arq('planilha.xlsx', ZIP), ['pdf']), /Tipo de arquivo não aceito/);
  assert.equal(await MQ.arquivoConfere(arq('vazio.pdf', new Uint8Array(0)), TODOS), 'O arquivo está vazio. Escolha outro.');
  assert.equal(await MQ.arquivoConfere(null, TODOS), 'Escolha o arquivo.');
});
