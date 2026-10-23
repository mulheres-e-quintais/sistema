/* Mulheres & Quintais — junta os arquivos do sistema num só (js/tudo.js) para abrir rápido no celular.
   Por quê: em 3G cada arquivo custa uma ida e volta (~0,3 s); eram 39 arquivos. Agora são 2 (config + tudo).
   Uso:  node ferramentas/montar.js          → grava js/tudo.js
         node ferramentas/montar.js --conferir → só confere se js/tudo.js está em dia (o teste de unidade usa)
   Rode SEMPRE depois de mudar qualquer arquivo em js/ (menos o config.js, que fica separado). */
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..');
const ORDEM = ['vendor/supabase-2.117.2.js', 'aparencia.js', 'teclado.js', 'guia.js', 'dados.js', 'regras.js', 'api-demo.js', 'api-supabase.js', 'fila.js', 'fichas.js', 'geo.js', 'painel.js', 'fotodia.js', 'campo.js',
  'vitrine.js', 'custos.js', 'fic.js', 'encontros.js', 'agua.js', 'venda.js', 'pagamentos.js', 'viagens.js', 'documentos.js', 'planilha.js', 'execucao.js', 'entregas.js',
  'roteiro.js', 'impacto.js', 'convites.js', 'banco.js', 'termo.js', 'pendencias.js', 'lembretes.js', 'ajuda.js', 'mascaras.js', 'voz.js', 'sugestao.js', 'sessao.js',
  'imprimir.js', 'acompanhamento.js', 'relatos.js', 'prontidao.js', 'app.js'];
/* 23/10/2026 (teste de desempenho): o arquivo vai compactado. No 3G de celular simples a abertura era quase toda download:
   1,9 MB (540 KB com gzip). Sem comentários e espaços: ~1,5 MB (455 KB com gzip), menos tempo para baixar e para o aparelho ler.
   Os nomes das funções ficam (sem "mangle"), para a mensagem de erro continuar dizendo onde foi. Mesmo esbuild, mesmo resultado. */
function esbuild() {
  for (const c of ['esbuild', '/opt/npm-tools/node_modules/esbuild']) { try { return require(c); } catch (e) { /* tenta o próximo */ } }
  throw new Error('Falta o esbuild para montar o js/tudo.js: rode  npm install  (está em devDependencies no package.json).');
}
function juntar() {
  return ORDEM.map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(raiz, 'js', f), 'utf8').replace(/\s*$/, '') + '\n;\n').join('');
}
function montar() {
  const r = esbuild().transformSync(juntar(), { minifyWhitespace: true, minifySyntax: true, legalComments: 'none', charset: 'utf8' });
  return '/* GERADO por ferramentas/montar.js (compactado) — não edite aqui: edite os arquivos de js/ e rode a montagem de novo. */\n' + r.code;
}
if (require.main === module) {
  const destino = path.join(raiz, 'js', 'tudo.js'); const novo = montar();
  if (process.argv.includes('--conferir')) {
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
    if (atual !== novo) { console.error('js/tudo.js está desatualizado: rode  node ferramentas/montar.js'); process.exit(1); }
    console.log('js/tudo.js em dia');
  } else { fs.writeFileSync(destino, novo); console.log('js/tudo.js gravado:', Math.round(novo.length / 1024), 'KB,', ORDEM.length, 'arquivos'); }
}
module.exports = { montar, juntar, ORDEM };
