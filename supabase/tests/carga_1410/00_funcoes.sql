-- carga_1410 / 00: funções de apoio para a massa sintética e os testes (banco LOCAL de teste; NÃO rodar no Supabase).
-- Mesmas ideias do test_cadastro_equipe.sql (cpf_t, logar, f), mais g(): executa um comando COMO um usuário (auth.uid()
-- simulado pelo stub) e, se o banco recusar, anota a recusa em carga.erros em vez de parar.
\set QUIET on
create schema if not exists carga;
alter table auth.users add column if not exists raw_user_meta_data jsonb;
create table if not exists carga.erros (n serial primary key, etapa text, cmd text, erro text, em timestamptz default clock_timestamp());
create table if not exists carga.pessoas (equipe_id uuid, uid uuid, papel text, uf text, email text primary key);
create table if not exists carga.tempos (etapa text primary key, inicio timestamptz, fim timestamptz, ok int, recusados int);

create or replace function cpf_t(n bigint) returns text language sql immutable as $f$
  with a as (select substr(lpad(n::text, 11, '0'), 1, 3) || substr(lpad(n::text, 11, '0'), 6, 6) as b),
       b as (select b || ((((select sum(substr(b, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10) % 11) % 10)::text as c from a)
  select c || ((((select sum(substr(c, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10) % 11) % 10)::text from b
$f$;

create or replace function logar(p_email text) returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  alter table auth.users disable trigger user;
  insert into auth.users(id, email) values (u, p_email);
  alter table auth.users enable trigger user;
  update public.equipe set user_id = u where email = p_email and status = 'ativa';
  insert into carga.pessoas(equipe_id, uid, papel, uf, email)
    select id, u, papel, uf, email from public.equipe where email = p_email and status = 'ativa'
    on conflict (email) do update set uid = excluded.uid, equipe_id = excluded.equipe_id;
  return u;
end $$;

create or replace function uid_de(p_email text) returns uuid language sql stable as $$ select uid from carga.pessoas where email = p_email $$;
create or replace function id_de(p_email text) returns uuid language sql stable as $$ select equipe_id from carga.pessoas where email = p_email $$;

-- grava de verdade como "quem"; falhou -> anota e segue
create or replace function g(etapa text, quem uuid, cmd text) returns boolean language plpgsql as $$
begin
  begin
    perform set_config('request.jwt.claim.sub', coalesce(quem::text,''), true);
    perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
    execute cmd;
    perform set_config('role', 'none', true);
    return true;
  exception when others then
    perform set_config('role', 'none', true);
    insert into carga.erros(etapa, cmd, erro) values (etapa, left(cmd, 400), sqlerrm);
    return false;
  end;
end $$;

-- resultado de teste (para o test_auditoria_1410_integridade.sql)
create table if not exists carga.res (n serial, caso text, ok boolean, det text);
-- executa como "quem" e desfaz; compara com o esperado ('ok' ou trecho do erro)
create or replace function t(caso text, quem uuid, cmd text, espera text) returns void language plpgsql as $$
declare msg text := 'ok';
begin
  begin
    perform set_config('request.jwt.claim.sub', coalesce(quem::text,''), true);
    perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
    execute cmd;
    perform set_config('role', 'none', true);
    raise exception 'ROLLBACK_OK';
  exception when others then
    msg := case when sqlerrm = 'ROLLBACK_OK' then 'ok' else sqlerrm end;
  end;
  perform set_config('role', 'none', true);
  insert into carga.res(caso, ok, det) values (caso, case when espera = 'ok' then msg = 'ok' else msg <> 'ok' and msg ilike '%'||espera||'%' end, msg);
end $$;
-- verificação simples (consulta que deve devolver true), como dono do banco
create or replace function chk(caso text, cond boolean, det text default null) returns void language sql as $$
  insert into carga.res(caso, ok, det) values (caso, coalesce(cond, false), det)
$$;
