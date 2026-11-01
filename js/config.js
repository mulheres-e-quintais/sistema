/* Configuração. Deixe supabaseUrl vazio para rodar em modo demonstração.
   Para produção, copie a URL e a chave "publishable" (ou "anon public") do painel do Supabase
   (Project Settings > API). A chave anon é pública por desenho: quem protege
   os dados são as regras do banco (RLS), não o segredo da chave. */
/* 01/11/2026 (pedido da coordenação: "um simulador igual ao do Saberes"): o endereço do sistema com ?simulacao ou ?simulacao=AAAA-MM-DD
   abre a simulação (simulacao.html, dados inventados, sem banco), como no Saberes que Cultivam. Sem data, o fim do projeto. */
(function () { try { const q = new URLSearchParams(window.location.search); if (!q.has('simulacao')) return; const d = q.get('simulacao') || '';
  window.MQ_REDIRECIONANDO = true; window.location.replace('simulacao.html' + (/^\d{4}-\d{2}-\d{2}$/.test(d) ? '?data=' + d : '')); } catch (e) { /* sem endereço */ } })();
window.MQ = window.MQ || {};
MQ.CONFIG = {
  supabaseUrl: 'https://tgdfhdwdobsrjvvixhem.supabase.co',
  supabaseAnonKey: 'sb_publishable_3_ExEdVQvx2CDeEuW7fauw_-XUYUhIk',
  semServiceWorker: false,
  /* v327: chave PÚBLICA dos avisos no celular (VAPID). A chave privada fica só nos segredos da função "avisos" do Supabase. */
  vapidPublica: 'BFiSpSOLhhYxF9q-O8QUBRALgNt1jD_13fLm0jAoa2tk-mi_LWEBN3-taIXfnWskOu6snJHiyGk8oRqLVmcwZbE'
};
if (window.MQ_REDIRECIONANDO) { MQ.CONFIG.supabaseUrl = ''; MQ.CONFIG.supabaseAnonKey = ''; MQ.CONFIG.semServiceWorker = true; }   /* indo para a simulação: não fala com o banco no instante antes de trocar de página */
