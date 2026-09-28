-- =====================================================================
-- Mulheres & Quintais — Etapa 8: link de cadastro (a própria pessoa preenche; a coordenação valida)
-- Rodar depois de 01 a 04. Pode rodar de novo sem estragar nada.
--
-- Como funciona:
--   1. Quem cadastra (coordenação geral para a coordenação técnica; coordenação técnica para bolsistas
--      e agentes) gera um link para aquela vaga. O link vale 7 dias e só pode ser usado uma vez.
--   2. A pessoa abre o link sem precisar de senha, preenche os próprios dados e aceita o termo (LGPD).
--   3. O pré-cadastro fica aguardando. Quem gerou o link confere, completa (início, plano) e aprova:
--      só então a pessoa entra na equipe e pode fazer o "Primeiro acesso".
-- Continua sendo possível a coordenação preencher tudo direto, como antes.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Dados pessoais complementares da equipe (nascimento, NIS, endereço, questionário socioeconômico).
-- Ficam numa tabela à parte porque só a própria pessoa e as coordenações podem ver
-- (as bolsistas enxergam o cadastro básico da equipe do estado, mas não isto).
-- Conta bancária e Pix não ficam aqui: estão no 09_dados_bancarios.sql, com proteção ainda maior.
-- ---------------------------------------------------------------------
alter table public.equipe add column if not exists nome_social text;   -- como a pessoa quer ser chamada (aparece nas telas)

create table if not exists public.equipe_privado (
  equipe_id        uuid primary key references public.equipe(id),
  data_nascimento  date,
  nis              text check (nis is null or nis ~ '^[0-9]{11}$'),
  endereco         jsonb not null default '{}'::jsonb,   -- cep, logradouro, numero, complemento, bairro, cidade, uf
  socioeconomico   jsonb,                               -- escolaridade, raca_etnia, renda_familiar, pessoas_casa (opcional)
  atualizado_em    timestamptz not null default now()
);
alter table public.equipe_privado enable row level security;
drop policy if exists privado_ler on public.equipe_privado;
drop policy if exists privado_gravar on public.equipe_privado;
drop policy if exists privado_alterar on public.equipe_privado;
create policy privado_ler on public.equipe_privado for select to authenticated
  using (equipe_id = public.meu_id() or public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy privado_gravar on public.equipe_privado for insert to authenticated
  with check (equipe_id = public.meu_id() or public.pode_gerenciar((select papel from public.equipe where id = equipe_id)));
create policy privado_alterar on public.equipe_privado for update to authenticated
  using (equipe_id = public.meu_id() or public.pode_gerenciar((select papel from public.equipe where id = equipe_id)))
  with check (equipe_id = public.meu_id() or public.pode_gerenciar((select papel from public.equipe where id = equipe_id)));
grant select, insert, update on public.equipe_privado to authenticated;
drop trigger if exists equipe_privado_auditoria on public.equipe_privado;

create table if not exists public.convites (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  papel         text not null check (papel in ('coord_tecnico','articulacao','apoio','agente')),
  uf            char(2) check (uf in ('AL','BA','PE','PI','SE')),
  substitui_id  uuid references public.equipe(id),
  criado_por    uuid references public.equipe(id),
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null default now() + interval '7 days',
  usado_em      timestamptz,
  cancelado_em  timestamptz,
  constraint uf_do_convite check ((papel = 'coord_tecnico' and uf is null) or (papel <> 'coord_tecnico' and uf is not null))
);

create table if not exists public.pre_cadastros (
  id            uuid primary key default gen_random_uuid(),
  convite_id    uuid not null unique references public.convites(id),
  papel         text not null,
  uf            char(2),
  substitui_id  uuid references public.equipe(id),
  nome          text not null check (length(trim(nome)) >= 5),
  cpf           text not null check (cpf ~ '^[0-9]{11}$'),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone      text,
  municipio     text,
  organizacao   text,
  nome_social   text,
  data_nascimento date,
  nis           text,
  endereco      jsonb not null default '{}'::jsonb,
  socioeconomico jsonb,
  consentimento_lgpd boolean not null check (consentimento_lgpd),
  enviado_em    timestamptz not null default now(),
  situacao      text not null default 'aguardando' check (situacao in ('aguardando','aprovado','recusado')),
  decidido_por  uuid references public.equipe(id),
  decidido_em   timestamptz,
  obs           text,
  equipe_id     uuid references public.equipe(id)
);

-- (se a tabela já existia de uma versão anterior deste arquivo)
alter table public.pre_cadastros add column if not exists nome_social text;
alter table public.pre_cadastros add column if not exists data_nascimento date;
alter table public.pre_cadastros add column if not exists nis text;
alter table public.pre_cadastros add column if not exists endereco jsonb not null default '{}'::jsonb;
alter table public.pre_cadastros add column if not exists socioeconomico jsonb;

-- quem pode gerar e validar: a mesma regra de quem cadastra
alter table public.convites enable row level security;
alter table public.pre_cadastros enable row level security;
drop policy if exists convites_ler on public.convites;
drop policy if exists convites_cancelar on public.convites;
drop policy if exists pre_ler on public.pre_cadastros;
drop policy if exists pre_decidir on public.pre_cadastros;
create policy convites_ler on public.convites for select to authenticated using (public.pode_gerenciar(papel));
create policy convites_cancelar on public.convites for update to authenticated using (public.pode_gerenciar(papel)) with check (public.pode_gerenciar(papel));
create policy pre_ler on public.pre_cadastros for select to authenticated using (public.pode_gerenciar(papel));
create policy pre_decidir on public.pre_cadastros for update to authenticated using (public.pode_gerenciar(papel)) with check (public.pode_gerenciar(papel));
grant select, update on public.convites, public.pre_cadastros to authenticated;

drop trigger if exists convites_auditoria on public.convites;
create trigger convites_auditoria after insert or update on public.convites for each row execute function public.auditar();
drop trigger if exists pre_cadastros_auditoria on public.pre_cadastros;
create trigger pre_cadastros_auditoria after insert or update on public.pre_cadastros for each row execute function public.auditar();

-- quem decide fica registrado; decisão não volta atrás
create or replace function public.pre_cadastros_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.situacao <> 'aguardando' then raise exception 'Este pré-cadastro já foi decidido.'; end if;
  if new.situacao = 'recusado' and length(trim(coalesce(new.obs, ''))) < 5 then raise exception 'Para recusar, escreva o motivo.'; end if;
  if new.situacao = 'aprovado' and new.equipe_id is null then raise exception 'Aprove cadastrando a pessoa na equipe.'; end if;
  new.decidido_por := public.meu_id(); new.decidido_em := now();
  return new;
end $$;
drop trigger if exists pre_cadastros_antes on public.pre_cadastros;
create trigger pre_cadastros_antes before update on public.pre_cadastros for each row execute function public.pre_cadastros_antes();

-- 1. gerar o link (devolve o código)
create or replace function public.criar_convite(p_papel text, p_uf text default null, p_substitui uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not coalesce(public.pode_gerenciar(p_papel), false) then raise exception 'Seu perfil não pode cadastrar esta função.'; end if;
  if p_papel = 'coord_tecnico' and exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then
    raise exception 'Já há coordenação técnica ativa. Desligue antes de convidar outra.';
  end if;
  if p_papel in ('articulacao','apoio') and exists (select 1 from public.equipe where papel = p_papel and uf = upper(p_uf) and status = 'ativa') then
    raise exception 'Esta vaga já está ocupada no estado.';
  end if;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- sem pgcrypto (no Supabase ela fica em outro schema)
  insert into public.convites (token, papel, uf, substitui_id, criado_por)
    values (t, p_papel, case when p_papel = 'coord_tecnico' then null else upper(p_uf) end, p_substitui, public.meu_id());
  return t;
end $$;
revoke all on function public.criar_convite(text, text, uuid) from public;
grant execute on function public.criar_convite(text, text, uuid) to authenticated;

-- 2. a pessoa abre o link: só diz para qual vaga é e se ainda vale (nada de dado pessoal)
create or replace function public.ver_convite(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('papel', papel, 'uf', uf, 'expira_em', expira_em,
            'valido', usado_em is null and cancelado_em is null and expira_em > now(),
            'motivo', case when usado_em is not null then 'usado' when cancelado_em is not null then 'cancelado'
                           when expira_em <= now() then 'vencido' end)
          from public.convites where token = p_token), jsonb_build_object('valido', false, 'motivo', 'inexistente'));
$$;
revoke all on function public.ver_convite(text) from public;
grant execute on function public.ver_convite(text) to anon, authenticated;

-- 3. a pessoa envia os próprios dados (uma vez só)
create or replace function public.enviar_pre_cadastro(p_token text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c public.convites; v_cpf text := regexp_replace(coalesce(p_dados->>'cpf', ''), '\D', '', 'g');
        v_email text := lower(trim(coalesce(p_dados->>'email', '')));
begin
  select * into c from public.convites where token = p_token for update;
  if c.id is null or c.usado_em is not null or c.cancelado_em is not null or c.expira_em <= now() then
    raise exception 'Este link não vale mais. Peça um novo à coordenação.';
  end if;
  if coalesce((p_dados->>'consentimento_lgpd')::boolean, false) is not true then raise exception 'É preciso aceitar o uso dos dados para o cadastro.'; end if;
  if exists (select 1 from public.equipe where status = 'ativa' and (cpf = v_cpf or lower(email::text) = v_email)) then
    raise exception 'Já existe pessoa ativa na equipe com este CPF ou e-mail. Fale com a coordenação.';
  end if;
  insert into public.pre_cadastros (convite_id, papel, uf, substitui_id, nome, cpf, email, telefone, municipio, organizacao,
                                    nome_social, data_nascimento, nis, endereco, socioeconomico, consentimento_lgpd)
    values (c.id, c.papel, c.uf, c.substitui_id, trim(p_dados->>'nome'), v_cpf, v_email,
            nullif(trim(p_dados->>'telefone'), ''), nullif(trim(p_dados->>'municipio'), ''), nullif(trim(p_dados->>'organizacao'), ''),
            nullif(trim(p_dados->>'nome_social'), ''), nullif(p_dados->>'data_nascimento', '')::date,
            nullif(regexp_replace(coalesce(p_dados->>'nis', ''), '\D', '', 'g'), ''),
            coalesce(p_dados->'endereco', '{}'::jsonb), p_dados->'socioeconomico', true);
  update public.convites set usado_em = now() where id = c.id;
end $$;
revoke all on function public.enviar_pre_cadastro(text, jsonb) from public;
grant execute on function public.enviar_pre_cadastro(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Desligar quem vai a campo (agente ou bolsista) só sem pendência:
-- visitas agendadas com ela e diagnósticos devolvidos para ela corrigir precisam ser resolvidos antes.
-- ---------------------------------------------------------------------
create or replace function public.pendencias_campo(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'visitas', (select count(*) from public.visitas where executor_id = p_id and situacao = 'prevista'),
    'diagnosticos', case when to_regclass('public.diagnosticos') is null then 0
                         else (select count(*) from public.diagnosticos where executor_id = p_id and situacao = 'devolvido') end);
$$;
grant execute on function public.pendencias_campo(uuid) to authenticated;

create or replace function public.equipe_desligar_pendencias() returns trigger
language plpgsql security definer set search_path = public as $$
declare pd jsonb;
begin
  if old.status = 'ativa' and new.status = 'desligada' and old.papel in ('agente','articulacao','apoio') then
    pd := public.pendencias_campo(old.id);
    if (pd->>'visitas')::int > 0 or (pd->>'diagnosticos')::int > 0 then
      raise exception 'Não dá para desligar ainda: % visita(s) agendada(s) com ela e % diagnóstico(s) devolvido(s) para ela corrigir. Passe as visitas para outra pessoa ou cancele, e resolva os diagnósticos.',
        pd->>'visitas', pd->>'diagnosticos';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists equipe_desligar_pendencias on public.equipe;
create trigger equipe_desligar_pendencias before update of status on public.equipe
  for each row execute function public.equipe_desligar_pendencias();

select 'Etapa 8 instalada' as resultado, (select count(*) from public.pre_cadastros where situacao = 'aguardando') as aguardando;
