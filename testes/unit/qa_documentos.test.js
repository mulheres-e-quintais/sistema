/* QA 01/10/2026 — js/documentos.js: data do documento a partir de 2026 e tipo do arquivo conferido além da extensão. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais } = require('./ambiente');
const docs = () => carregar(['dados.js', 'regras.js', 'documentos.js'], { ui: { S: {}, esc: s => s } }).MQ.docsUI;
const base = (o = {}) => Object.assign({ tipo: 'ata', titulo: 'Ata da reunião com o MPA', data_documento: diaMais(-1), uf: null, descricao: null }, o);
const arq = (name, type, size = 1000) => ({ name, type, size });

test('data do documento antes de 2026, no futuro ou que não existe é recusada', () => {
  const D = docs();
  assert.match(D.validarDocumento(base({ data_documento: '2025-12-31' }), arq('a.pdf')).data_documento, /antes de 2026/);
  assert.match(D.validarDocumento(base({ data_documento: '1999-01-01' }), arq('a.pdf')).data_documento, /antes de 2026/);
  assert.match(D.validarDocumento(base({ data_documento: '2026-02-30' }), arq('a.pdf')).data_documento, /inválida/);
  assert.ok(D.validarDocumento(base({ data_documento: diaMais(1) }), arq('a.pdf')).data_documento);
  assert.equal(D.validarDocumento(base({ data_documento: '2026-01-01' }), arq('a.pdf')).data_documento, undefined);
  assert.equal(D.validarDocumento(base({ data_documento: diaMais(0) }), arq('a.pdf')).data_documento, undefined);
});
test('extensão falsa: o tipo informado pelo navegador tem de bater com a extensão', () => {
  const D = docs();
  for (const [n, t] of [['ata.pdf', 'text/plain'], ['ata.pdf', 'image/png'], ['foto.jpg', 'application/pdf'], ['lista.xlsx', 'text/html'], ['a.docx', 'application/x-msdownload'], ['foto.png', 'image/jpeg']])
    assert.match(D.validarDocumento(base(), arq(n, t)).arquivo, /não bate com a extensão/, n + ' ' + t);
  const W = 'application/vnd.openxmlformats-officedocument.';
  for (const [n, t] of [['ata.pdf', 'application/pdf'], ['ata.PDF', 'application/pdf'], ['foto.jpg', 'image/jpeg'], ['foto.JPEG', 'image/jpeg'], ['foto.png', 'image/png'], ['a.docx', W + 'wordprocessingml.document'], ['a.xlsx', W + 'spreadsheetml.sheet'],
    ['a.doc', 'application/msword'], ['a.xls', 'application/vnd.ms-excel'], ['a.odt', 'application/vnd.oasis.opendocument.text'], ['a.ods', 'application/vnd.oasis.opendocument.spreadsheet'], ['a.odt', ''], ['a.pdf', undefined], ['a.ods', 'application/octet-stream']])
    assert.equal(D.validarDocumento(base(), arq(n, t)).arquivo, undefined, n + ' ' + t);
  assert.equal(D.validarDocumento(base(), arq('a.pdf', 'application/pdf', 0)).arquivo, 'O arquivo está vazio.', 'vazio continua recusado, mesmo com o tipo certo');
});
