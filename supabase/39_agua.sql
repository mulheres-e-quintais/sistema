-- =====================================================================
-- Mulheres & Quintais — 39: ACOMPANHAMENTO DO ACESSO À ÁGUA (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 02 (fichas), do 03 (diagnósticos) e do 01 (meu_papel, meu_id, auditar).
--
-- Quem precisa de solução de água: a ficha com resultado "sem água: encaminhada" e a mulher
-- selecionada cujo diagnóstico achou o quintal sem água na seca (fica sem kit até resolver).
-- A coordenação registra cada mudança de situação (sem solução → encaminhada → em andamento → concluída),
-- com uma observação. Nada se altera nem se apaga: a situação atual é o registro mais recente.
-- Sem nenhum registro: a ficha "sem água" conta como encaminhada (o encaminhamento é obrigatório na ficha);
-- o diagnóstico sem água conta como "sem solução".
-- =====================================================================
begin;

create table if not exists public.agua_situacoes (
  id             uuid primary key default gen_random_uuid(),
  ficha_id       uuid not null references public.fichas(id),
  situacao       text not null check (situacao in ('sem_solucao', 'encaminhada', 'em_andamento', 'concluida')),
  obs            text not null check (length(trim(obs)) between 10 and 500),
  registrado_por uuid references public.equipe(id),
  registrado_em  timestamptz not null default now()
);
create index if not exists agua_situacoes_ficha on public.agua_situacoes (ficha_id, registrado_em desc);

alter table public.agua_situacoes enable row level security;
revoke all on public.agua_situacoes from anon, authenticated;
grant select on public.agua_situacoes to authenticated;          -- registrar só pela função abaixo
drop policy if exists agua_ler on public.agua_situacoes;
create policy agua_ler on public.agua_situacoes for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico'));

create or replace function public.agua_situacoes_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Registro de água não se altera nem se apaga. Registre a nova situação.';
end $$;
drop trigger if exists agua_situacoes_antes on public.agua_situacoes;
create trigger agua_situacoes_antes before update or delete on public.agua_situacoes for each row execute function public.agua_situacoes_antes();

create or replace function public.registrar_situacao_agua(p_ficha uuid, p_situacao text, p_obs text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_atual text;
begin
  if coalesce(public.meu_papel(), '') not in ('coord_geral', 'coord_tecnico') then
    raise exception 'Quem registra a situação da água é a coordenação.';
  end if;
  if not exists (select 1 from public.fichas f where f.id = p_ficha and f.resultado = 'sem_agua')
     and not exists (select 1 from public.diagnosticos d where d.ficha_id = p_ficha and d.sem_agua) then
    raise exception 'Esta mulher não está na lista de quem precisa de solução de água.';
  end if;
  if coalesce(p_situacao, '') not in ('sem_solucao', 'encaminhada', 'em_andamento', 'concluida') then raise exception 'Situação inválida.'; end if;
  if length(trim(coalesce(p_obs, ''))) < 10 then raise exception 'Escreva o que aconteceu (pelo menos 10 letras): programa, órgão, o que foi feito.'; end if;
  if length(trim(p_obs)) > 500 then raise exception 'A observação passou de 500 letras.'; end if;
  select situacao into v_atual from public.agua_situacoes where ficha_id = p_ficha order by registrado_em desc limit 1;
  if v_atual = p_situacao then raise exception 'A situação já é esta. Escolha a nova situação.'; end if;
  insert into public.agua_situacoes (ficha_id, situacao, obs, registrado_por) values (p_ficha, p_situacao, trim(p_obs), public.meu_id()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.registrar_situacao_agua(uuid, text, text) from public, anon;
grant execute on function public.registrar_situacao_agua(uuid, text, text) to authenticated;

drop trigger if exists agua_situacoes_auditoria on public.agua_situacoes;
create trigger agua_situacoes_auditoria after insert on public.agua_situacoes for each row execute function public.auditar();

commit;

select 'Acompanhamento da água instalado' as resultado, to_regclass('public.agua_situacoes') is not null as tabela;
