-- =====================================================================
-- Mulheres & Quintais — sistema do projeto Quintais Produtivos
-- Esquema do banco (Supabase / PostgreSQL)
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma única vez.
-- =====================================================================
-- Regras que o BANCO garante (não só a tela):
--   * Só há 1 coordenação geral e 1 coordenação técnica ativas.
--   * Só a coordenação geral cadastra/edita a coordenação técnica.
--   * Só a coordenação técnica cadastra/edita bolsistas.
--   * No máximo 1 bolsista de articulação e 1 de apoio ativa por estado
--     (AL, BA, PE, PI, SE) => 5 + 5.
--   * Ninguém é apagado: sai por desligamento (data + motivo), e a
--     substituta aponta para quem ela substitui. Histórico preservado.
--   * Toda inclusão/alteração fica registrada na tabela de auditoria.
--   * Só entra no sistema quem foi cadastrado antes (por e-mail).
-- =====================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Equipe
-- ---------------------------------------------------------------------
create table if not exists public.equipe (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references auth.users(id) on delete set null,
  papel                 text not null check (papel in ('coord_geral','coord_tecnico','articulacao','apoio')),
  uf                    char(2) check (uf in ('AL','BA','PE','PI','SE')),
  nome                  text not null check (length(trim(nome)) >= 5),
  cpf                   text not null check (cpf ~ '^[0-9]{11}$'),
  email                 citext not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone              text,
  municipio             text,          -- município onde mora
  organizacao           text,          -- movimento/organização de vínculo (perfil do Guia das bolsistas)
  data_inicio           date not null,
  -- plano de trabalho individual (item 6 do termo de compromisso)
  meta_diagnosticos     int check (meta_diagnosticos between 0 and 40),
  meta_quintais         int check (meta_quintais between 0 and 40),
  meta_visitas          int check (meta_visitas between 0 and 80),
  -- habilitação para receber bolsa (passo a passo do Guia das bolsistas)
  matricula_fic_em      date,          -- matrícula no curso FIC (IFRN)
  matricula_fic_numero  text,
  docs_funcern_em       date,          -- documentos e conta/Pix entregues à FUNCERN
  data_fim              date,
  motivo_desligamento   text,
  termo_path            text,          -- arquivo do termo de compromisso (bucket "termos")
  termo_assinado_em     date,
  obs_habilitacao       text,
  consentimento_lgpd    boolean not null check (consentimento_lgpd),
  status                text not null default 'ativa' check (status in ('ativa','desligada')),
  substitui_id          uuid references public.equipe(id),
  criado_por            uuid references public.equipe(id),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  -- bolsistas têm estado; coordenações não
  constraint uf_por_papel check (
    (papel in ('articulacao','apoio') and uf is not null) or
    (papel in ('coord_geral','coord_tecnico') and uf is null)
  ),
  -- desligada exige data e motivo
  constraint desligamento_completo check (
    status = 'ativa' or (data_fim is not null and length(trim(coalesce(motivo_desligamento,''))) >= 5)
  ),
  constraint datas_coerentes check (data_fim is null or data_fim >= data_inicio)
);

-- a soma do plano individual das 2 bolsistas de um estado não passa da meta do estado
create or replace function public.checar_meta_estado() returns trigger
language plpgsql as $$
declare d int; q int; v int;
begin
  if new.uf is null or new.status <> 'ativa' then return new; end if;
  select coalesce(sum(meta_diagnosticos),0), coalesce(sum(meta_quintais),0), coalesce(sum(meta_visitas),0)
    into d, q, v from public.equipe
   where uf = new.uf and status = 'ativa' and id <> new.id;
  if d + coalesce(new.meta_diagnosticos,0) > 40 or q + coalesce(new.meta_quintais,0) > 40
     or v + coalesce(new.meta_visitas,0) > 80 then
    raise exception 'O plano individual passa da meta do estado (40 diagnósticos, 40 quintais, 80 visitas).';
  end if;
  return new;
end $$;

-- 1 coordenação geral e 1 técnica ativas
create unique index if not exists equipe_uma_coordenacao
  on public.equipe (papel) where status = 'ativa' and papel in ('coord_geral','coord_tecnico');
-- 1 bolsista por função por estado
create unique index if not exists equipe_uma_bolsista_por_uf
  on public.equipe (papel, uf) where status = 'ativa' and papel in ('articulacao','apoio');
-- a mesma pessoa não ocupa duas vagas ao mesmo tempo
create unique index if not exists equipe_cpf_ativo   on public.equipe (cpf)   where status = 'ativa';
create unique index if not exists equipe_email_ativo on public.equipe (email) where status = 'ativa';

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.equipe where user_id = auth.uid() and status = 'ativa' limit 1
$$;

create or replace function public.meu_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.equipe where user_id = auth.uid() and status = 'ativa' limit 1
$$;

-- quem pode gerenciar um registro de determinado papel
create or replace function public.pode_gerenciar(p_papel text) returns boolean
language sql stable as $$
  select case
    when p_papel = 'coord_tecnico'            then public.meu_papel() = 'coord_geral'
    when p_papel in ('articulacao','apoio')   then public.meu_papel() = 'coord_tecnico'
    else false
  end
$$;

-- vincula a conta de login ao cadastro (chamada pelo app após o login)
create or replace function public.vincular_conta() returns public.equipe
language plpgsql security definer set search_path = public as $$
declare r public.equipe;
begin
  update public.equipe set user_id = auth.uid()
   where email = (auth.jwt() ->> 'email') and status = 'ativa'
     and (user_id is null or user_id = auth.uid())
  returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Gatilhos da tabela equipe
-- ---------------------------------------------------------------------
create or replace function public.equipe_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := public.meu_id();
    new.status := 'ativa';
    new.data_fim := null;
    new.motivo_desligamento := null;
    new.user_id := null;
  else
    -- campos que identificam a vaga não mudam: para trocar, desliga e cadastra outra
    if new.papel is distinct from old.papel or new.uf is distinct from old.uf
       or new.cpf is distinct from old.cpf or new.criado_por is distinct from old.criado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.';
    end if;
    if old.status = 'desligada' and new.status = 'ativa' then
      raise exception 'Registro desligado não pode ser reativado. Faça um novo cadastro.';
    end if;
    -- troca de e-mail desfaz o vínculo de login (a pessoa entra com o novo e-mail)
    if new.email is distinct from old.email then new.user_id := null; end if;
    -- a coordenação geral só mexe na habilitação das bolsistas (quem cadastra é a coord. técnica)
    if public.meu_papel() = 'coord_geral' and old.papel in ('articulacao','apoio') then
      if (to_jsonb(new) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em'])
         is distinct from
         (to_jsonb(old) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em']) then
        raise exception 'A coordenação geral só altera a habilitação das bolsistas. Dados pessoais e desligamento são da coordenação técnica.';
      end if;
    end if;
    if new.status = 'desligada' then new.user_id := null; end if;
    new.atualizado_em := now();
  end if;
  return new;
end $$;

drop trigger if exists equipe_antes on public.equipe;
create trigger equipe_antes before insert or update on public.equipe
  for each row execute function public.equipe_antes();

drop trigger if exists equipe_meta_estado on public.equipe;
create trigger equipe_meta_estado before insert or update on public.equipe
  for each row execute function public.checar_meta_estado();

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid,
  acao        text not null,
  por         uuid,          -- equipe.id de quem fez
  em          timestamptz not null default now(),
  antes       jsonb,
  depois      jsonb
);

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, public.meu_id(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists equipe_auditoria on public.equipe;
create trigger equipe_auditoria after insert or update or delete on public.equipe
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Só entra quem está cadastrado (bloqueia criação de conta estranha)
-- ---------------------------------------------------------------------
create or replace function public.bloquear_conta_nao_cadastrada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.equipe where email = new.email and status = 'ativa') then
    raise exception 'E-mail não cadastrado no projeto.';
  end if;
  return new;
end $$;

drop trigger if exists auth_so_cadastrados on auth.users;
create trigger auth_so_cadastrados before insert on auth.users
  for each row execute function public.bloquear_conta_nao_cadastrada();

-- ---------------------------------------------------------------------
-- Segurança por linha (RLS)
-- ---------------------------------------------------------------------
alter table public.equipe    enable row level security;
alter table public.auditoria enable row level security;

drop policy if exists equipe_ler       on public.equipe;
drop policy if exists equipe_incluir   on public.equipe;
drop policy if exists equipe_alterar   on public.equipe;

-- coordenações veem todos; bolsista vê só o próprio cadastro
create policy equipe_ler on public.equipe for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico') or user_id = auth.uid());

create policy equipe_incluir on public.equipe for insert to authenticated
  with check (public.pode_gerenciar(papel));

create policy equipe_alterar on public.equipe for update to authenticated
  using (public.pode_gerenciar(papel)
         or (public.meu_papel() = 'coord_geral' and papel in ('articulacao','apoio')))
  with check (public.pode_gerenciar(papel)
         or (public.meu_papel() = 'coord_geral' and papel in ('articulacao','apoio')));

-- sem política de delete: ninguém apaga pelo app

drop policy if exists auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico'));

-- ---------------------------------------------------------------------
-- Arquivos dos termos de compromisso (bucket privado)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('termos', 'termos', false)
on conflict (id) do nothing;

drop policy if exists termos_ler     on storage.objects;
drop policy if exists termos_enviar  on storage.objects;

create policy termos_ler on storage.objects for select to authenticated
  using (bucket_id = 'termos' and public.meu_papel() in ('coord_geral','coord_tecnico'));

create policy termos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'termos' and public.meu_papel() in ('coord_geral','coord_tecnico'));

-- ---------------------------------------------------------------------
-- Permissões explícitas (não depender do padrão do projeto)
-- ---------------------------------------------------------------------
revoke all on public.equipe, public.auditoria from anon;
revoke execute on function public.vincular_conta(), public.meu_papel(), public.meu_id() from anon, public;
grant select, insert, update on public.equipe to authenticated;
grant select on public.auditoria to authenticated;
grant execute on function public.vincular_conta(), public.meu_papel(), public.meu_id(), public.pode_gerenciar(text) to authenticated;

-- ---------------------------------------------------------------------
-- PRIMEIRO ACESSO: cadastre a coordenação geral manualmente
-- (troque os dados e rode só esta parte, uma vez)
-- ---------------------------------------------------------------------
-- insert into public.equipe (papel, nome, cpf, email, telefone, data_inicio, consentimento_lgpd)
-- values ('coord_geral', 'NOME COMPLETO', '00000000000', 'email@ifrn.edu.br', '(84) 90000-0000', '2026-09-14', true);
