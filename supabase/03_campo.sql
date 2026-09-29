-- =====================================================================
-- Mulheres & Quintais — ETAPA 3: agente de campo, visitas (roteiro de campo) e
-- diagnóstico + plano do quintal (1ª visita).
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode ser rodado de novo sem problema. Requer 01_criar_banco.sql e 02_fichas.sql.
-- =====================================================================
-- O que o banco garante:
--   * Agente de campo: aluna do FIC que faz visitas por ajuda de custo. Cadastrada pela
--     coordenação técnica, sem limite de quantidade por estado. Vê só os quintais atribuídos a ela.
--   * Visita só para mulher selecionada e aprovada, feita por pessoa do mesmo estado e HABILITADA
--     (FIC + FUNCERN + termo). Sem habilitação, a visita não pode ser paga, então não entra no roteiro.
--   * Por quintal: 1 diagnóstico (com o plano), 1 implantação e 2 acompanhamentos.
--   * Por estado: no máximo 160 dias de campo (40 quintais x 4 visitas).
--   * Diagnóstico registrado marca a visita como realizada (conta 1 dia de campo de quem visitou).
--   * Sem água na seca: o diagnóstico para na Parte A (sem plano e sem kit).
--   * A coordenação técnica aprova ou devolve o plano do quintal.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Novo papel na equipe: agente de campo
-- ---------------------------------------------------------------------
alter table public.equipe drop constraint if exists equipe_papel_check;
-- já com os perfis que o 11_fic.sql acrescenta (professor e auxiliar): assim este arquivo pode ser rodado
-- de novo depois do 11 sem esbarrar nas pessoas já cadastradas nesses perfis
alter table public.equipe add constraint equipe_papel_check
  check (papel in ('coord_geral','coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm'));
alter table public.equipe drop constraint if exists uf_por_papel;
alter table public.equipe add constraint uf_por_papel check (
  (papel in ('articulacao','apoio','agente') and uf is not null) or
  (papel in ('coord_geral','coord_tecnico','professor_fic','auxiliar_adm') and uf is null));

create or replace function public.pode_gerenciar(p_papel text) returns boolean
language sql stable as $$
  select case
    when p_papel = 'coord_tecnico'                     then public.meu_papel() = 'coord_geral'
    when p_papel in ('articulacao','apoio','agente')   then public.meu_papel() = 'coord_tecnico'
    else false
  end
$$;

create or replace function public.habilitado(p equipe) returns boolean
language sql immutable as $$
  select p.status = 'ativa' and p.matricula_fic_em is not null and p.docs_funcern_em is not null and p.termo_assinado_em is not null
$$;

create or replace function public.equipe_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := public.meu_id();
    new.status := 'ativa'; new.data_fim := null; new.motivo_desligamento := null; new.user_id := null;
  else
    if new.papel is distinct from old.papel or new.uf is distinct from old.uf
       or new.cpf is distinct from old.cpf or new.criado_por is distinct from old.criado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.';
    end if;
    if old.status = 'desligada' and new.status = 'ativa' then
      raise exception 'Registro desligado não pode ser reativado. Faça um novo cadastro.';
    end if;
    if new.email is distinct from old.email then new.user_id := null; end if;
    if public.meu_papel() = 'coord_geral' and old.papel in ('articulacao','apoio','agente') then
      if (to_jsonb(new) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em'])
         is distinct from
         (to_jsonb(old) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em']) then
        raise exception 'A coordenação geral só altera a habilitação. Dados pessoais e desligamento são da coordenação técnica.';
      end if;
    end if;
    if new.status = 'desligada' then new.user_id := null; end if;
    new.atualizado_em := now();
  end if;
  return new;
end $$;

drop policy if exists equipe_ler on public.equipe;
create policy equipe_ler on public.equipe for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico') or user_id = auth.uid()
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf()));

drop policy if exists equipe_alterar on public.equipe;
create policy equipe_alterar on public.equipe for update to authenticated
  using (public.pode_gerenciar(papel)
         or (public.meu_papel() = 'coord_geral' and papel in ('articulacao','apoio','agente')))
  with check (public.pode_gerenciar(papel)
         or (public.meu_papel() = 'coord_geral' and papel in ('articulacao','apoio','agente')));

-- ---------------------------------------------------------------------
-- 2. Visitas (roteiro de campo e dias de campo para a ajuda de custo)
-- ---------------------------------------------------------------------
create table if not exists public.visitas (
  id              uuid primary key,
  ficha_id        uuid not null references public.fichas(id),
  uf              char(2) not null,
  etapa           text not null check (etapa in ('diagnostico','implantacao','acompanhamento')),
  executor_id     uuid not null references public.equipe(id),
  data_prevista   date not null,
  data_realizada  date,
  situacao        text not null default 'prevista' check (situacao in ('prevista','realizada','cancelada')),
  obs             text,
  criado_por      uuid references public.equipe(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint realizada_com_data check (situacao <> 'realizada' or data_realizada is not null)
);
create index if not exists visitas_uf on public.visitas (uf, situacao, data_prevista);
create unique index if not exists visitas_etapa_unica on public.visitas (ficha_id, etapa)
  where situacao <> 'cancelada' and etapa in ('diagnostico','implantacao');

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
    raise exception '% ainda não está habilitada (FIC, FUNCERN e termo): a visita não poderia ser paga.', ex.nome;
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.visitas where id = new.id) then
    new.criado_por := public.meu_id(); new.criado_em := now();
    if new.etapa = 'acompanhamento' then
      select count(*) into n from public.visitas where ficha_id = new.ficha_id and etapa = 'acompanhamento' and situacao <> 'cancelada';
      if n >= 2 then raise exception 'Este quintal já tem as 2 visitas de acompanhamento.'; end if;
    end if;
    if new.etapa <> 'diagnostico' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'diagnostico' and situacao = 'realizada') then
      raise exception 'Primeiro o diagnóstico: implantação e acompanhamento só depois dele.';
    end if;
    select count(*) into n from public.visitas where uf = new.uf and situacao <> 'cancelada';
    if n >= 160 then raise exception 'O estado % já usou os 160 dias de campo previstos.', new.uf; end if;
  end if;
  return new;
end $$;

drop trigger if exists visitas_antes on public.visitas;
create trigger visitas_antes before insert or update on public.visitas
  for each row execute function public.visitas_antes();
drop trigger if exists visitas_auditoria on public.visitas;
create trigger visitas_auditoria after insert or update or delete on public.visitas
  for each row execute function public.auditar();

-- quintais atribuídos a um agente (usado nas regras de acesso)
create or replace function public.ficha_atribuida(p_ficha uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.visitas v where v.ficha_id = p_ficha and v.executor_id = public.meu_id() and v.situacao <> 'cancelada')
$$;

alter table public.visitas enable row level security;
drop policy if exists visitas_ler on public.visitas;
drop policy if exists visitas_incluir on public.visitas;
drop policy if exists visitas_alterar on public.visitas;
create policy visitas_ler on public.visitas for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or executor_id = public.meu_id());
create policy visitas_incluir on public.visitas for insert to authenticated
  with check (public.meu_papel() = 'coord_tecnico'
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf()));
create policy visitas_alterar on public.visitas for update to authenticated
  using (public.meu_papel() = 'coord_tecnico'
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or executor_id = public.meu_id())
  with check (public.meu_papel() = 'coord_tecnico'
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or executor_id = public.meu_id());

-- agente vê a ficha das mulheres que vai visitar
drop policy if exists fichas_ler on public.fichas;
create policy fichas_ler on public.fichas for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and public.ficha_atribuida(id)));

-- ---------------------------------------------------------------------
-- 3. Diagnóstico e plano do quintal (1ª visita)
-- ---------------------------------------------------------------------
create table if not exists public.diagnosticos (
  id                 uuid primary key,
  ficha_id           uuid not null unique references public.fichas(id),
  visita_id          uuid not null unique references public.visitas(id),
  uf                 char(2) not null,
  executor_id        uuid references public.equipe(id),
  data_visita        date not null,
  codigo_quintal     text,
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  sem_gps_motivo     text,
  area_m2            numeric,
  renda_familiar     numeric,
  renda_quintal      numeric,
  agua_seca          text not null check (agua_seca in ('sim','as_vezes','nao')),
  sem_agua           boolean not null default false,   -- não recebe kit agora (encaminhamento)
  lote               int check (lote in (1,2)),
  mes_implantacao    text,
  dados              jsonb not null default '{}'::jsonb,  -- demais respostas do modelo 3 (família, produção, kit, cronograma...)
  fotos              text[] not null default '{}',        -- caminhos no bucket "campo"
  situacao           text not null default 'aguardando' check (situacao in ('aguardando','aprovado','devolvido')),
  aprovado_por       uuid references public.equipe(id),
  aprovado_em        timestamptz,
  obs_coordenacao    text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint gps_ou_motivo check (latitude is not null or length(trim(coalesce(sem_gps_motivo,''))) >= 5),
  constraint sem_agua_sem_plano check (not sem_agua or lote is null),
  constraint com_agua_com_lote check (sem_agua or lote is not null)
);
create index if not exists diagnosticos_uf on public.diagnosticos (uf, situacao);

create or replace function public.diagnosticos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.visitas; papel text := public.meu_papel();
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.visita_id <> old.visita_id then
    select * into v from public.visitas where id = new.visita_id;
    if v.id is null or v.etapa <> 'diagnostico' or v.ficha_id <> new.ficha_id then
      raise exception 'O diagnóstico precisa estar ligado à visita de diagnóstico desta mulher.';
    end if;
    if v.situacao = 'cancelada' then raise exception 'A visita de diagnóstico foi cancelada.'; end if;
    new.uf := v.uf; new.executor_id := v.executor_id;
  end if;
  if tg_op = 'INSERT' then
    new.situacao := 'aguardando'; new.aprovado_por := null; new.aprovado_em := null; new.obs_coordenacao := null; new.criado_em := now();
    return new;
  end if;
  if papel = 'coord_tecnico' then
    if (to_jsonb(new) - array['situacao','aprovado_por','aprovado_em','obs_coordenacao','atualizado_em'])
       is distinct from (to_jsonb(old) - array['situacao','aprovado_por','aprovado_em','obs_coordenacao','atualizado_em']) then
      raise exception 'A coordenação técnica aprova ou devolve o plano; quem corrige é quem fez a visita.';
    end if;
    if new.situacao = 'aprovado' and old.situacao <> 'aprovado' then new.aprovado_por := public.meu_id(); new.aprovado_em := now(); end if;
    if new.situacao = 'devolvido' and length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
      raise exception 'Para devolver, escreva o que precisa ser corrigido.';
    end if;
  elsif papel in ('articulacao','apoio','agente') then
    if old.situacao = 'aprovado' then raise exception 'Plano já aprovado pela coordenação técnica. Peça que ela devolva para corrigir.'; end if;
    new.situacao := 'aguardando'; new.aprovado_por := old.aprovado_por; new.aprovado_em := old.aprovado_em; new.obs_coordenacao := old.obs_coordenacao;
  elsif papel is not null then
    raise exception 'Seu perfil não pode alterar diagnósticos.';
  end if;
  return new;
end $$;

-- diagnóstico registrado = visita realizada (1 dia de campo de quem visitou)
create or replace function public.diagnosticos_depois() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.visitas set situacao = 'realizada', data_realizada = new.data_visita
   where id = new.visita_id and (situacao <> 'realizada' or data_realizada is distinct from new.data_visita);
  return new;
end $$;

drop trigger if exists diagnosticos_antes on public.diagnosticos;
create trigger diagnosticos_antes before insert or update on public.diagnosticos
  for each row execute function public.diagnosticos_antes();
drop trigger if exists diagnosticos_depois on public.diagnosticos;
create trigger diagnosticos_depois after insert or update on public.diagnosticos
  for each row execute function public.diagnosticos_depois();
drop trigger if exists diagnosticos_auditoria on public.diagnosticos;
create trigger diagnosticos_auditoria after insert or update or delete on public.diagnosticos
  for each row execute function public.auditar();

alter table public.diagnosticos enable row level security;
drop policy if exists diag_ler on public.diagnosticos;
drop policy if exists diag_incluir on public.diagnosticos;
drop policy if exists diag_alterar on public.diagnosticos;
create policy diag_ler on public.diagnosticos for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or executor_id = public.meu_id());
create policy diag_incluir on public.diagnosticos for insert to authenticated
  with check ((public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and exists (select 1 from public.visitas v where v.id = visita_id and v.executor_id = public.meu_id())));
create policy diag_alterar on public.diagnosticos for update to authenticated
  using (public.meu_papel() = 'coord_tecnico'
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and executor_id = public.meu_id()))
  with check (public.meu_papel() = 'coord_tecnico'
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or (public.meu_papel() = 'agente' and executor_id = public.meu_id()));

revoke all on public.visitas, public.diagnosticos from anon;
grant select, insert, update on public.visitas, public.diagnosticos to authenticated;
revoke execute on function public.ficha_atribuida(uuid) from anon, public;
grant execute on function public.ficha_atribuida(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Fotos das visitas (bucket privado "campo"): <UF>/<id da ficha>/<arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('campo', 'campo', false)
on conflict (id) do nothing;

drop policy if exists campo_ler on storage.objects;
drop policy if exists campo_enviar on storage.objects;
drop policy if exists campo_trocar on storage.objects;
create policy campo_ler on storage.objects for select to authenticated
  using (bucket_id = 'campo' and (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and (storage.foldername(name))[1] = public.minha_uf())
         or (public.meu_papel() = 'agente' and public.ficha_atribuida(((storage.foldername(name))[2])::uuid))));
create policy campo_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'campo' and (
         (public.meu_papel() in ('articulacao','apoio') and (storage.foldername(name))[1] = public.minha_uf())
         or (public.meu_papel() = 'agente' and public.ficha_atribuida(((storage.foldername(name))[2])::uuid))));
create policy campo_trocar on storage.objects for update to authenticated
  using (bucket_id = 'campo' and (
         (public.meu_papel() in ('articulacao','apoio') and (storage.foldername(name))[1] = public.minha_uf())
         or (public.meu_papel() = 'agente' and public.ficha_atribuida(((storage.foldername(name))[2])::uuid))));

select 'Etapa 3 instalada' as resultado,
       (select count(*) from public.visitas) as visitas,
       (select count(*) from public.diagnosticos) as diagnosticos;
