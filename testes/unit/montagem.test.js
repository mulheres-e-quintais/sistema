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
test('todo arquivo de js/ entra na montagem (menos config.js, o próprio tudo.js e os dois da página de simulação)', () => {
  const todos = fs.readdirSync(path.join(raiz, 'js')).filter(f => f.endsWith('.js') && !['config.js', 'tudo.js', 'config-simulacao.js', 'simulacao-dados.js'].includes(f));
  for (const f of todos) assert.ok(ORDEM.includes(f), f + ' não está em ferramentas/montar.js');
});
test('a página carrega só config.js e tudo.js; o aparelho guarda os dois para abrir sem internet', () => {
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8'); const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(JSON.stringify(scripts), JSON.stringify(['js/config.js', 'js/tudo.js']));
  assert.match(sw, /'js\/config\.js', 'js\/tudo\.js'/);
});

/* 18/10/2026: simulacao.html (o projeto concluído, com dados inventados) não pode falar com o banco de verdade */
test('simulação: página separada, sem banco, fora das buscas e fora do pacote do sistema', () => {
  const html = fs.readFileSync(path.join(raiz, 'simulacao.html'), 'utf8'); const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(JSON.stringify(scripts), JSON.stringify(['js/config-simulacao.js', 'js/simulacao-dados.js', 'js/tudo.js']), 'carrega a configuração sem banco, os dados e o sistema');
  const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const connect = (csp.match(/connect-src ([^;]+)/) || [])[1] || '';
  assert.ok(connect && !/supabase/.test(connect), 'o navegador bloqueia qualquer conversa com o Supabase: ' + connect);
  assert.match(html, /<meta name="robots" content="noindex/);
  const cfg = fs.readFileSync(path.join(raiz, 'js', 'config-simulacao.js'), 'utf8');
  assert.match(cfg, /supabaseUrl:\s*''/); assert.match(cfg, /cenario:\s*'fim'/);
  assert.ok(!/simulacao/.test(sw), 'o aparelho não guarda a simulação junto com o sistema');
  const dados = fs.readFileSync(path.join(raiz, 'js', 'simulacao-dados.js'), 'utf8');
  const emails = [...dados.matchAll(/"email":"([^"]+)"/g)].map(m => m[1]);
  assert.ok(emails.length > 20 && emails.every(e => /@exemplo\.invalid$/.test(e)), 'só e-mails inventados: ' + emails.filter(e => !/@exemplo\.invalid$/.test(e)).join(', '));
});
