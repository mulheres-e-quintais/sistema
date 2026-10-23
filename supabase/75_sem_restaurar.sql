-- =====================================================================
-- Mulheres & Quintais — 75: tira o "Restaurar como estava antes" do Histórico (decisão da coordenação, 23/10/2026)
-- Rode depois do 74. Pode rodar de novo sem medo: não apaga dados.
--
-- O 74 criou a função restaurar_versao, que devolvia fichas, visitas e outros registros a uma versão anterior.
-- Aqui quem altera ficha e visita é a equipe de campo, e a correção segue pela devolução para correção, com a
-- responsabilidade de quem coletou. A função sai do banco: função com poder de alterar dado que ninguém usa
-- só aumenta o que precisa ser protegido.
-- Fica do 74 o que não atrapalha: a coluna obs no histórico (vazia) e a gravação do histórico com search_path fechado.
-- =====================================================================

drop function if exists public.restaurar_versao(bigint, boolean);
