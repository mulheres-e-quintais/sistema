/* 01/10/2026: o sistema abre de um arquivo só (js/tudo.js). Este teste garante que ele foi montado de novo depois
   de qualquer mudança em js/ e que nenhum arquivo do sistema ficou de fora. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const { montar, ORDEM } = require('../../ferramentas/montar');
const raiz = path.join(__dirname, '../..');

test('js/tudo.js está em dia com os arquivos de js/ (rode: node ferramentas/montar.js)', () => {
  assert.ok(fs.readFileSync(path.join(raiz, 'js/tudo.js'), 'utf8') === montar(), 'js/tudo.js desatualizado: rode node ferramentas/montar.js');
});
test('todo arquivo de js/ entra na montagem (menos config.js e o próprio tudo.js)', () => {
  const todos = fs.readdirSync(path.join(raiz, 'js')).filter(f => f.endsWith('.js') && !['config.js', 'tudo.js'].includes(f));
  for (const f of todos) assert.ok(ORDEM.includes(f), f + ' não está em ferramentas/montar.js');
});
test('a página carrega só config.js e tudo.js; o aparelho guarda os dois para abrir sem internet', () => {
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8'); const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(JSON.stringify(scripts), JSON.stringify(['js/config.js', 'js/tudo.js']));
  assert.match(sw, /'js\/config\.js', 'js\/tudo\.js'/);
});
