-- =====================================================================
-- Mulheres & Quintais — 58: REGISTROS PARADOS NOS CELULARES (12/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 57. Pode rodar de novo.
--
-- O que é salvo sem internet fica só no celular até ele conectar. Se o celular não conecta mais (quebrou, foi
-- perdido, a pessoa não abre o sistema com internet), a coordenação não sabia que havia visita, diagnóstico ou
-- avaliação esperando. Agora, sempre que o celular tem internet, ele avisa ao servidor SÓ A CONTAGEM do que está
-- guardado nele (quantos, desde quando, quantos recusados) — nunca o conteúdo. A coordenação vê a lista.
-- Não muda nenhum registro que já existe.
-- =====================================================================

create table if not exists public.fila_celular (
  equipe_id    uuid primary key references public.equipe(id),
  qtd          int not null default 0 check (qtd between 0 and 10000),
  recusados    int not null default 0 check (recusados between 0 and 10000),
  mais_antigo  timestamptz,
  visto_em     timestamptz not null default now()
);
alter table public.fila_celular enable row level security;
revoke all on public.fila_celular from public, anon, authenticated;   -- só pelas funções abaixo

-- o celular de quem está logado informa a própria contagem (sobrescreve a anterior)
create or replace function public.informar_fila(p_qtd int, p_recusados int, p_mais_antigo timestamptz) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id();
begin
  if eu is null then return; end if;   -- conta sem cadastro ativo: nada
  if p_qtd is null or p_qtd < 0 or p_qtd > 10000 or coalesce(p_recusados, 0) < 0 or coalesce(p_recusados, 0) > p_qtd then
    raise exception 'Contagem inválida.';
  end if;
  insert into public.fila_celular (equipe_id, qtd, recusados, mais_antigo, visto_em)
  values (eu, p_qtd, coalesce(p_recusados, 0), case when p_qtd > 0 then least(p_mais_antigo, now()) end, now())
  on conflict (equipe_id) do update set qtd = excluded.qtd, recusados = excluded.recusados, mais_antigo = excluded.mais_antigo, visto_em = excluded.visto_em;
end $$;
revoke all on function public.informar_fila(int, int, timestamptz) from public, anon;
grant execute on function public.informar_fila(int, int, timestamptz) to authenticated;

-- a coordenação vê: a geral, todo mundo; a técnica, bolsistas e agentes (quem ela coordena)
create or replace function public.listar_fila_celular() returns table (equipe_id uuid, qtd int, recusados int, mais_antigo timestamptz, visto_em timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.equipe_id, f.qtd, f.recusados, f.mais_antigo, f.visto_em
    from public.fila_celular f join public.equipe e on e.id = f.equipe_id
   where e.status = 'ativa'
     and (public.meu_papel() = 'coord_geral'
          or (public.meu_papel() = 'coord_tecnico' and e.papel in ('articulacao', 'apoio', 'agente')));
$$;
revoke all on function public.listar_fila_celular() from public, anon;
grant execute on function public.listar_fila_celular() to authenticated;

-- de passagem: a função de gatilho do 55 (relato não se apaga) ficou com a permissão padrão do Postgres; fecha
do $$ begin if to_regprocedure('public.relatos_nao_apaga()') is not null then revoke all on function public.relatos_nao_apaga() from public, anon, authenticated; end if; end $$;

select 'Etapa 58 instalada: registros parados nos celulares' as resultado;
