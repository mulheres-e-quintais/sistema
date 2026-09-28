-- =====================================================================
-- Mulheres & Quintais — CÓDIGO DE PRIMEIRO ACESSO (fecha a brecha do login)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo sem estragar nada.
--
-- O problema: com "Confirm email" desligado, quem soubesse o e-mail de alguém recém-cadastrado
-- podia fazer o "Primeiro acesso" no lugar da pessoa e entrar com o perfil dela.
-- A correção:
--   1) Para criar a senha, a pessoa precisa de um CÓDIGO de 8 letras/números, gerado por quem
--      a cadastrou e mandado junto com o aviso de acesso (WhatsApp). Vale 7 dias e uma vez só.
--   2) O login passa a ser ligado ao cadastro no momento em que a senha é criada (e não mais
--      pelo e-mail a cada entrada).
--   3) Ninguém troca o e-mail do próprio login por fora do sistema.
--   4) A coordenação geral pode "liberar novo primeiro acesso" para quem esqueceu a senha.
-- Quem JÁ tem login continua entrando normalmente.
-- =====================================================================
begin;

-- 1. Códigos (só o resumo criptográfico fica guardado; o código em si aparece uma vez na tela)
create table if not exists public.acesso_codigos (
  equipe_id  uuid primary key references public.equipe(id) on delete cascade,
  hash       text not null,
  expira_em  timestamptz not null,
  criado_por uuid,
  criado_em  timestamptz not null default now()
);
alter table public.acesso_codigos enable row level security;   -- sem regras: ninguém lê pelo app
revoke all on public.acesso_codigos from anon, authenticated;

create or replace function public.codigo_normalizado(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

create or replace function public.codigo_hash(p_equipe uuid, p_codigo text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_equipe::text || ':' || public.codigo_normalizado(p_codigo), 'UTF8')), 'hex')
$$;

-- gera e guarda (uso interno: não fica exposto ao app)
create or replace function public.novo_codigo_acesso(p_equipe uuid, p_por uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- sem 0/O, 1/I/L
  h text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  c text := ''; i int;
begin
  for i in 0..7 loop
    c := c || substr(alfabeto, 1 + (('x' || substr(h, 1 + i * 4, 4))::bit(16)::int % length(alfabeto)), 1);
  end loop;
  insert into public.acesso_codigos (equipe_id, hash, expira_em, criado_por)
  values (p_equipe, public.codigo_hash(p_equipe, c), now() + interval '7 days', p_por)
  on conflict (equipe_id) do update set hash = excluded.hash, expira_em = excluded.expira_em,
    criado_por = excluded.criado_por, criado_em = now();
  return substr(c, 1, 4) || '-' || substr(c, 5, 4);
end $$;
revoke all on function public.novo_codigo_acesso(uuid, uuid) from public, anon, authenticated;

-- chamada pelo app: quem cadastra aquela função gera o código; se a pessoa já tem login,
-- só a coordenação geral pode liberar um novo primeiro acesso (a senha antiga deixa de valer)
create or replace function public.gerar_codigo_acesso(p_equipe uuid) returns text
language plpgsql security definer set search_path = public as $$
declare m public.equipe; c text;
begin
  select * into m from public.equipe where id = p_equipe;
  if m.id is null or m.status <> 'ativa' then raise exception 'Cadastro não encontrado ou desligado.'; end if;
  if not public.pode_gerenciar(m.papel) then raise exception 'Você não pode gerar o acesso desta pessoa.'; end if;
  if m.user_id is not null then
    if public.meu_papel() <> 'coord_geral' then raise exception 'Esta pessoa já tem senha. Só a coordenação geral libera um novo primeiro acesso.'; end if;
    update public.equipe set user_id = null where id = m.id;
    delete from auth.users where id = m.user_id;
  end if;
  c := public.novo_codigo_acesso(m.id, public.meu_id());
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('acesso_codigos', m.id, case when m.user_id is null then 'CODIGO' else 'NOVO_ACESSO' end, public.meu_id(),
          null, jsonb_build_object('expira_em', now() + interval '7 days', 'senha_anterior_apagada', m.user_id is not null));
  return c;
end $$;
revoke all on function public.gerar_codigo_acesso(uuid) from public, anon;
grant execute on function public.gerar_codigo_acesso(uuid) to authenticated;

-- 2. Criar a senha exige o código certo e dentro do prazo
create or replace function public.bloquear_conta_nao_cadastrada() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.equipe; k public.acesso_codigos;
begin
  select * into m from public.equipe
   where lower(email::text) = lower(new.email::text) and status = 'ativa' and user_id is null limit 1;
  if m.id is null then raise exception 'E-mail não cadastrado no projeto.'; end if;
  -- quem roda SQL direto no painel do Supabase (dono do banco) não precisa de código
  if session_user in ('postgres', 'supabase_admin') then return new; end if;
  select * into k from public.acesso_codigos where equipe_id = m.id;
  if k.equipe_id is null then
    -- instalação nova: a coordenação geral cria a primeira senha sem código
    if m.papel = 'coord_geral' then return new; end if;
    raise exception 'Código de acesso não gerado.';
  end if;
  if k.expira_em < now() then raise exception 'Código de acesso vencido.'; end if;
  if k.hash <> public.codigo_hash(m.id, new.raw_user_meta_data ->> 'codigo') then raise exception 'Código de acesso errado.'; end if;
  return new;
end $$;

-- 3. Liga o login ao cadastro na hora em que a senha é criada, e o código deixa de valer
create or replace function public.ligar_conta_criada() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  update public.equipe set user_id = new.id
   where lower(email::text) = lower(new.email::text) and status = 'ativa' and user_id is null
  returning id into v;
  if v is not null then delete from public.acesso_codigos where equipe_id = v; end if;
  return new;
end $$;
drop trigger if exists auth_liga_cadastro on auth.users;
create trigger auth_liga_cadastro after insert on auth.users
  for each row execute function public.ligar_conta_criada();

-- ninguém troca o e-mail do login por fora (evita "puxar" o cadastro de outra pessoa)
create or replace function public.bloquear_troca_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, ''))
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'O e-mail do login não pode ser trocado. Fale com a coordenação geral.';
  end if;
  return new;
end $$;
drop trigger if exists auth_sem_troca_email on auth.users;
create trigger auth_sem_troca_email before update of email on auth.users
  for each row execute function public.bloquear_troca_email();

-- 4. vincular_conta (chamada a cada entrada) passa só a LER o cadastro de quem entrou
create or replace function public.vincular_conta() returns public.equipe
language sql stable security definer set search_path = public as $$
  select * from public.equipe where user_id = auth.uid() and status = 'ativa' limit 1
$$;

-- logins que já existem e ainda não estavam ligados ao cadastro: liga agora, uma vez
update public.equipe e set user_id = u.id
  from auth.users u
 where e.user_id is null and e.status = 'ativa' and lower(e.email::text) = lower(u.email::text)
   and not exists (select 1 from public.equipe x where x.user_id = u.id);

commit;

select 'Código de primeiro acesso instalado' as resultado,
  (select count(*) from public.equipe where status = 'ativa' and user_id is null) as pessoas_ainda_sem_senha,
  'Para essas pessoas, abra a ficha e toque em "Gerar código de acesso"' as proximo_passo;
