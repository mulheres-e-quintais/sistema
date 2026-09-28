-- =====================================================================
-- Mulheres & Quintais — Etapa 13: visita de avaliação (5ª visita) para medir o impacto
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Rodar depois de 01 a 12. Pode rodar de novo sem estragar nada.
-- =====================================================================
-- O que o banco garante:
--   * Nova etapa de visita: avaliação. Uma por quintal, só depois da implantação feita.
--   * Dias de campo por estado: 200 (40 quintais × 5 visitas), no lugar de 160.
--   * A avaliação registrada marca a visita como feita (entra na ajuda de custo como as outras).
--   * As medidas de impacto (EBIA, consumo, diversidade, renda, venda, autonomia, políticas)
--     são as mesmas perguntadas no diagnóstico (linha de base), para comparar antes × depois.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Etapa "avaliação" nas visitas
-- ---------------------------------------------------------------------
alter table public.visitas drop constraint if exists visitas_etapa_check;
alter table public.visitas add constraint visitas_etapa_check
  check (etapa in ('diagnostico','implantacao','acompanhamento','avaliacao'));
drop index if exists public.visitas_etapa_unica;
create unique index visitas_etapa_unica on public.visitas (ficha_id, etapa)
  where situacao <> 'cancelada' and etapa in ('diagnostico','implantacao','avaliacao');

create or replace function public.visitas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare f public.fichas; ex public.equipe; papel text := public.meu_papel(); n int;
begin
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then
    if new.ficha_id <> old.ficha_id or new.uf <> old.uf or new.etapa <> old.etapa or new.criado_em <> old.criado_em then
      raise exception 'Quintal e etapa da visita não mudam. Cancele e agende outra.';
    end if;
    if old.situacao = 'cancelada' and new.situacao <> 'cancelada' then raise exception 'Visita cancelada não volta. Agende outra.'; end if;
    if papel = 'agente' and (new.executor_id <> old.executor_id or new.data_prevista <> old.data_prevista or new.situacao = 'cancelada') then
      raise exception 'O agente de campo não reagenda nem cancela visitas. Fale com a bolsista do estado.';
    end if;
    if new.executor_id = old.executor_id and new.situacao = old.situacao then return new; end if;
    -- cancelar sempre pode (libera o dia de campo), mesmo se a ficha foi devolvida depois
    if new.situacao = 'cancelada' then return new; end if;
  end if;
  select * into f from public.fichas where id = new.ficha_id;
  if f.id is null then raise exception 'Ficha não encontrada.'; end if;
  new.uf := f.uf;
  if not (f.resultado = 'selecionada' and f.situacao = 'aprovada') then
    raise exception 'Só há visita para mulher selecionada e aprovada pela coordenação técnica.';
  end if;
  select * into ex from public.equipe where id = new.executor_id;
  if ex.id is null or ex.status <> 'ativa' or ex.papel not in ('articulacao','apoio','agente') then
    raise exception 'Quem faz a visita precisa ser bolsista ou agente de campo ativa.';
  end if;
  if ex.uf <> f.uf then raise exception 'Quem faz a visita precisa ser do mesmo estado do quintal.'; end if;
  if not public.habilitado(ex) and new.situacao <> 'cancelada' then
    raise exception '% ainda não está habilitada (FIC, Arlo e termo): a visita não poderia ser paga.', ex.nome;
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.visitas where id = new.id) then
    new.criado_por := public.meu_id(); new.criado_em := now();
    if new.etapa = 'acompanhamento' then
      select count(*) into n from public.visitas where ficha_id = new.ficha_id and etapa = 'acompanhamento' and situacao <> 'cancelada';
      if n >= 2 then raise exception 'Este quintal já tem as 2 visitas de acompanhamento.'; end if;
    end if;
    if new.etapa <> 'diagnostico' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'diagnostico' and situacao = 'realizada') then
      raise exception 'Primeiro o diagnóstico: implantação, acompanhamento e avaliação só depois dele.';
    end if;
    if new.etapa = 'avaliacao' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'implantacao' and situacao = 'realizada') then
      raise exception 'A avaliação é feita depois da implantação do quintal.';
    end if;
    select count(*) into n from public.visitas where uf = new.uf and situacao <> 'cancelada';
    if n >= 200 then raise exception 'O estado % já usou os 200 dias de campo previstos (40 quintais × 5 visitas).', new.uf; end if;
  end if;
  return new;
end $$;

-- implantação e acompanhamento pedem relato; diagnóstico e avaliação são marcados pelo próprio formulário
create or replace function public.visitas_feita() returns trigger
language plpgsql as $$
begin
  if new.situacao = 'realizada' and old.situacao is distinct from 'realizada' and new.etapa in ('implantacao','acompanhamento') then
    if new.data_realizada is null or new.data_realizada > current_date then
      raise exception 'Informe a data em que a visita foi feita (não pode ser no futuro).';
    end if;
    if length(trim(coalesce(new.relato, ''))) < 20 then
      raise exception 'Conte em poucas linhas o que foi feito na visita (pelo menos 20 letras).';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Avaliação (mesmas medidas da linha de base do diagnóstico)
-- ---------------------------------------------------------------------
create table if not exists public.avaliacoes (
  id              uuid primary key,
  ficha_id        uuid not null references public.fichas(id),
  visita_id       uuid not null unique references public.visitas(id),
  uf              char(2) not null,
  executor_id     uuid references public.equipe(id),
  data_visita     date not null,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  sem_gps_motivo  text,
  quintal_produz  text not null check (quintal_produz in ('sim','em_parte','nao')),
  ebia_pontos     int check (ebia_pontos between 0 and 14),
  ebia_nivel      text check (ebia_nivel in ('seguranca','leve','moderada','grave')),
  dados           jsonb not null default '{}'::jsonb,
  fotos           text[] not null default '{}',
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint aval_gps_ou_motivo check (latitude is not null or length(trim(coalesce(sem_gps_motivo,''))) >= 5)
);

create or replace function public.avaliacoes_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.visitas; papel text := public.meu_papel();
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.visita_id <> old.visita_id then
    select * into v from public.visitas where id = new.visita_id;
    if v.id is null or v.etapa <> 'avaliacao' or v.ficha_id <> new.ficha_id then
      raise exception 'A avaliação precisa estar ligada à visita de avaliação desta mulher.';
    end if;
    if v.situacao = 'cancelada' then raise exception 'A visita de avaliação foi cancelada.'; end if;
    new.uf := v.uf; new.executor_id := v.executor_id;
  end if;
  if new.data_visita > current_date then raise exception 'A data da avaliação não pode ser no futuro.'; end if;
  if tg_op = 'INSERT' then new.criado_em := now();
  elsif papel is not null and papel not in ('articulacao','apoio','agente') then
    raise exception 'Quem corrige a avaliação é quem fez a visita ou a bolsista do estado.';
  end if;
  return new;
end $$;

create or replace function public.avaliacoes_depois() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.visitas set situacao = 'realizada', data_realizada = new.data_visita
   where id = new.visita_id and (situacao <> 'realizada' or data_realizada is distinct from new.data_visita);
  return new;
end $$;

drop trigger if exists avaliacoes_antes on public.avaliacoes;
create trigger avaliacoes_antes before insert or update on public.avaliacoes for each row execute function public.avaliacoes_antes();
drop trigger if exists avaliacoes_depois on public.avaliacoes;
create trigger avaliacoes_depois after insert or update on public.avaliacoes for each row execute function public.avaliacoes_depois();
drop trigger if exists avaliacoes_auditoria on public.avaliacoes;
create trigger avaliacoes_auditoria after insert or update on public.avaliacoes for each row execute function public.auditar();

alter table public.avaliacoes enable row level security;
drop policy if exists aval_ler on public.avaliacoes;
drop policy if exists aval_incluir on public.avaliacoes;
drop policy if exists aval_alterar on public.avaliacoes;
create policy aval_ler on public.avaliacoes for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or executor_id = public.meu_id());
create policy aval_incluir on public.avaliacoes for insert to authenticated
  with check ((public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and exists (select 1 from public.visitas v where v.id = visita_id and v.executor_id = public.meu_id())));
create policy aval_alterar on public.avaliacoes for update to authenticated
  using ((public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and executor_id = public.meu_id()))
  with check ((public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and executor_id = public.meu_id()));
revoke all on public.avaliacoes from anon;
grant select, insert, update on public.avaliacoes to authenticated;

select 'Etapa 13 instalada' as resultado, (select count(*) from public.avaliacoes) as avaliacoes;
