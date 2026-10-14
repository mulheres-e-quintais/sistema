-- =====================================================================
-- Mulheres & Quintais — 62: PLANILHA DO HISTÓRICO TAMBÉM FICA REGISTRADA (14/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 61. Pode rodar de novo.
-- Não muda nenhum registro que já existe: só troca a função registrar_planilha (do 60) para aceitar o tipo
-- 'historico'. A aba Histórico ganhou o botão "Baixar planilha (.csv)" (com os filtros aplicados): como a
-- planilha traz nomes das agricultoras e da equipe, cada download fica no próprio Histórico, como as fichas.
-- =====================================================================
begin;
create or replace function public.registrar_planilha(p_tipo text, p_qtd int, p_filtro text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id(); pp text := coalesce(public.meu_papel(), '');
begin
  if eu is null or pp not in ('coord_geral', 'coord_tecnico') then raise exception 'Só a coordenação baixa as planilhas das fichas.'; end if;
  if p_tipo is null or p_tipo not in ('completa', 'sem_documentos', 'copia_dados', 'historico') then raise exception 'Tipo de planilha inválido.'; end if;
  if p_tipo = 'historico' and pp <> 'coord_geral' then raise exception 'Só a coordenação geral baixa o Histórico.'; end if;
  if p_qtd is null or p_qtd < 0 or p_qtd > 1000000 then raise exception 'Quantidade inválida.'; end if;
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('planilhas', null, 'PLANILHA', eu, null,
          jsonb_build_object('tipo', p_tipo, 'qtd', p_qtd, 'filtro', left(nullif(trim(coalesce(p_filtro, '')), ''), 200)));
end $$;
revoke all on function public.registrar_planilha(text, int, text) from public, anon;
grant execute on function public.registrar_planilha(text, int, text) to authenticated;
commit;
