-- =====================================================================
-- Mulheres & Quintais — 29: DESEMPENHO DO BANCO (revisão de 29/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Não muda QUEM vê o quê: as regras são as mesmas, só calculadas uma vez por consulta
-- (antes, "qual é o meu perfil?" era perguntado de novo para cada linha).
-- Medido com o volume do fim do projeto (200 fichas, 1.000 visitas, 15 mil registros de histórico):
--   histórico 90 ms → 0,2 ms · visitas da bolsista 26 ms → 5 ms · visitas da agente 27 ms → 8 ms.
-- Rode DEPOIS dos outros (se rodar 02, 03 ou 25 de novo, rode este também).
-- =====================================================================
begin;

create index if not exists auditoria_em on public.auditoria (em desc);

drop policy if exists auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated
  using ((select public.meu_papel()) = 'coord_geral');

drop policy if exists visitas_ler on public.visitas;
create policy visitas_ler on public.visitas for select to authenticated using (
  (select public.meu_papel()) in ('coord_geral','coord_tecnico')
  or ((select public.meu_papel()) in ('articulacao','apoio') and uf = (select public.minha_uf()))
  or executor_id = (select public.meu_id()));

drop policy if exists fichas_ler on public.fichas;
create policy fichas_ler on public.fichas for select to authenticated using (
  (select public.meu_papel()) in ('coord_geral','coord_tecnico')
  or ((select public.meu_papel()) in ('articulacao','apoio') and uf = (select public.minha_uf()))
  or ((select public.meu_papel()) = 'agente' and public.ficha_atribuida(id)));

commit;
analyze public.auditoria; analyze public.visitas; analyze public.fichas;

select 'Desempenho ajustado' as resultado, to_regclass('public.auditoria_em') is not null as indice_historico;
