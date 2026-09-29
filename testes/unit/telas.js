/* Monta o sistema inteiro (todos os arquivos de js/, na ordem do index.html) no navegador falso, com o modo
   demonstração como fonte de dados, e desenha as telas de um perfil. Não usa servidor nem internet. */
const { carregar } = require('./ambiente');

const ARQUIVOS = ['dados.js', 'regras.js', 'api-demo.js', 'api-supabase.js', 'fila.js', 'fichas.js', 'geo.js', 'painel.js', 'campo.js', 'vitrine.js', 'custos.js',
  'fic.js', 'pagamentos.js', 'viagens.js', 'documentos.js', 'entregas.js', 'roteiro.js', 'impacto.js', 'convites.js', 'banco.js', 'pendencias.js', 'ajuda.js', 'mascaras.js', 'voz.js',
  'sugestao.js', 'app.js'];

/* perfil: coord_geral | coord_tecnico | bolsista | agente | professor | auxiliar */
async function montar(perfil) {
  const amb = carregar(ARQUIVOS);
  const { MQ } = amb; MQ.CONFIG = { supabaseUrl: '', supabaseAnonKey: '', semServiceWorker: true };
  const S = MQ.ui.S; S.api = MQ.apiDemo;
  await S.api.iniciar(); S.eu = await S.api.trocarPerfil(perfil);
  await MQ.ui.carregar();
  const tela = {
    MQ, S, api: S.api,
    /* desenha a tela (ou uma aba da coordenação) e devolve o HTML */
    aba(nome) { S.aba = nome || null; S.painel = null; MQ.ui.render(); return amb.app(); },
    /* abre um painel lateral e devolve o HTML dele */
    painel(p) { MQ.ui.abrirPainel(p); return amb.painel(); },
    async trocar(p) { S.eu = await S.api.trocarPerfil(p); await MQ.ui.carregar(); }
  };
  return tela;
}

/* ajudas para ler o HTML sem depender do desenho */
const texto = html => String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const abasDe = html => [...new Set([...String(html).matchAll(/data-acao="aba" data-aba="([a-z]+)"/g)].map(m => m[1]))];
const botoes = (html, acao) => [...String(html).matchAll(new RegExp(`data-acao="${acao}"([^>]*)>`, 'g'))].map(m => m[1]);
const tem = (html, re) => (re instanceof RegExp ? re : new RegExp(re)).test(html);

module.exports = { montar, texto, abasDe, botoes, tem };
