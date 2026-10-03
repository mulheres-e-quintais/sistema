/* Mulheres & Quintais — junta os arquivos do sistema num só (js/tudo.js) para abrir rápido no celular.
   Por quê: em 3G cada arquivo custa uma ida e volta (~0,3 s); eram 39 arquivos. Agora são 2 (config + tudo).
   Uso:  node ferramentas/montar.js          → grava js/tudo.js
         node ferramentas/montar.js --conferir → só confere se js/tudo.js está em dia (o teste de unidade usa)
   Rode SEMPRE depois de mudar qualquer arquivo em js/ (menos o config.js, que fica separado). */
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..');
const ORDEM = ['vendor/supabase-2.117.2.js', 'dados.js', 'regras.js', 'api-demo.js', 'api-supabase.js', 'fila.js', 'fichas.js', 'geo.js', 'painel.js', 'campo.js',
  'vitrine.js', 'custos.js', 'fic.js', 'encontros.js', 'agua.js', 'venda.js', 'pagamentos.js', 'viagens.js', 'documentos.js', 'planilha.js', 'execucao.js', 'entregas.js',
  'roteiro.js', 'impacto.js', 'convites.js', 'banco.js', 'termo.js', 'pendencias.js', 'lembretes.js', 'ajuda.js', 'mascaras.js', 'voz.js', 'sugestao.js', 'sessao.js',
  'imprimir.js', 'acompanhamento.js', 'app.js'];
function montar() {
  return '/* GERADO por ferramentas/montar.js — não edite aqui: edite os arquivos de js/ e rode a montagem de novo. */\n'
    + ORDEM.map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(raiz, 'js', f), 'utf8').replace(/\s*$/, '') + '\n;\n').join('');
}
if (require.main === module) {
  const destino = path.join(raiz, 'js', 'tudo.js'); const novo = montar();
  if (process.argv.includes('--conferir')) {
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
    if (atual !== novo) { console.error('js/tudo.js está desatualizado: rode  node ferramentas/montar.js'); process.exit(1); }
    console.log('js/tudo.js em dia');
  } else { fs.writeFileSync(destino, novo); console.log('js/tudo.js gravado:', Math.round(novo.length / 1024), 'KB,', ORDEM.length, 'arquivos'); }
}
module.exports = { montar, ORDEM };
