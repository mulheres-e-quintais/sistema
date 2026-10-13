-- =====================================================================
-- Mulheres & Quintais — 60: PLANILHAS NO HISTÓRICO E EQUIPE HABILITADA NA TELA DO MPA (12/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 59. Pode rodar de novo.
-- Não muda nenhum registro que já existe: só cria duas funções.
--
-- 1. registrar_planilha: cada vez que alguém baixa a planilha das fichas (completa ou sem documentos) ou a cópia
--    dos dados, fica no Histórico quem baixou, quando, qual planilha, quantas fichas e com que filtro (LGPD:
--    a planilha completa tem CPF, NIS, CAF e endereço). Só a coordenação geral lê o Histórico.
-- 2. acompanhamento_equipe_uf: para a tela do MPA, por estado, quantas pessoas da equipe de campo estão habilitadas
--    e quantos diagnósticos esperam a coordenação (ou foram devolvidos). Só contagens, como o resto da tela.
-- =====================================================================
begin;

-- ---------- 1. planilhas baixadas ficam no Histórico ----------
create or replace function public.registrar_planilha(p_tipo text, p_qtd int, p_filtro text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id(); pp text := coalesce(public.meu_papel(), '');
begin
  if eu is null or pp not in ('coord_geral', 'coord_tecnico') then raise exception 'Só a coordenação baixa as planilhas das fichas.'; end if;
  if p_tipo is null or p_tipo not in ('completa', 'sem_documentos', 'copia_dados') then raise exception 'Tipo de planilha inválido.'; end if;
  if p_qtd is null or p_qtd < 0 or p_qtd > 1000000 then raise exception 'Quantidade inválida.'; end if;
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('planilhas', null, 'PLANILHA', eu, null,
          jsonb_build_object('tipo', p_tipo, 'qtd', p_qtd, 'filtro', left(nullif(trim(coalesce(p_filtro, '')), ''), 200)));
end $$;
revoke all on function public.registrar_planilha(text, int, text) from public, anon;
grant execute on function public.registrar_planilha(text, int, text) to authenticated;

-- ---------- 2. tela do MPA: equipe habilitada e diagnósticos esperando, por estado ----------
create or replace function public.acompanhamento_equipe_uf(p_orgao text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org text; r jsonb;
begin
  -- a mesma porta da acompanhamento_dados (52): quem acompanha de fora, ou a coordenação vendo a prévia
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico') and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;
  with d as (select x.* from public.diagnosticos x join public.fichas f on f.id = x.ficha_id where f.id not in (select id from public.exemplo))
  select jsonb_agg(jsonb_build_object('uf', u.uf,
      'equipe_campo', (select count(*) from public.equipe x where x.uf = u.uf and x.status = 'ativa' and x.papel in ('articulacao', 'apoio', 'agente') and x.id not in (select id from public.exemplo)),
      'habilitadas', (select count(*) from public.equipe x where x.uf = u.uf and x.status = 'ativa' and x.papel in ('articulacao', 'apoio', 'agente') and x.id not in (select id from public.exemplo) and public.habilitado(x)),
      'diag_aguardando', (select count(*) from d where d.uf = u.uf and d.situacao = 'aguardando'),
      'diag_devolvidos', (select count(*) from d where d.uf = u.uf and d.situacao = 'devolvido')) order by u.uf)
    into r
    from (values ('AL'), ('BA'), ('PE'), ('PI'), ('SE')) as u(uf);
  return coalesce(r, '[]'::jsonb);
end $$;
revoke all on function public.acompanhamento_equipe_uf(text) from public, anon;
grant execute on function public.acompanhamento_equipe_uf(text) to authenticated;

commit;

select 'Etapa 60 instalada: planilhas no Histórico e equipe habilitada na tela do MPA' as resultado,
       to_regprocedure('public.registrar_planilha(text, integer, text)') is not null as planilha,
       to_regprocedure('public.acompanhamento_equipe_uf(text)') is not null as mpa;
