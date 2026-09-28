/* Configuração. Deixe supabaseUrl vazio para rodar em modo demonstração.
   Para produção, copie a URL e a chave "publishable" (ou "anon public") do painel do Supabase
   (Project Settings > API). A chave anon é pública por desenho: quem protege
   os dados são as regras do banco (RLS), não o segredo da chave. */
window.MQ = window.MQ || {};
MQ.CONFIG = {
  supabaseUrl: 'https://tgdfhdwdobsrjvvixhem.supabase.co',
  supabaseAnonKey: 'sb_publishable_3_ExEdVQvx2CDeEuW7fauw_-XUYUhIk',
  semServiceWorker: false
};
