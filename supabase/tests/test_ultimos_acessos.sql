-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 30_ultimos_acessos.sql
\set QUIET on
truncate res;
select t('anônimo NÃO registra acesso', null, $q$select public.registrar_acesso('entrada', 'Android · Chrome')$q$, 'permission denied');
select t('anônimo NÃO lê os acessos', null, $q$select count(*) from public.acessos$q$, 'permission denied');
select f(:BB, $q$select public.registrar_acesso('entrada', 'Android · Chrome')$q$);
select f(:T, $q$select public.registrar_acesso('abriu', 'Windows · Edge')$q$);
select t('o registro fica em nome de quem está logado', :G, $q$do $x$ begin
  if (select count(*) from public.acessos) <> 2 then raise exception 'esperava 2'; end if;
  if not exists (select 1 from public.acessos a join public.equipe e on e.id = a.equipe_id where e.papel in ('articulacao','apoio') and a.tipo = 'entrada') then raise exception 'sem a bolsista'; end if;
  if not exists (select 1 from public.acessos a join public.equipe e on e.id = a.equipe_id where e.papel = 'coord_tecnico' and a.tipo = 'abriu') then raise exception 'sem a técnica'; end if; end $x$ $q$, 'ok');
select t('tipo inventado é recusado', :BB, $q$select public.registrar_acesso('hackear', null)$q$, 'inválido');
select t('bolsista NÃO grava direto na tabela', :BB, $q$insert into public.acessos (equipe_id, tipo) select id, 'entrada' from public.equipe limit 1$q$, 'permission denied');
select t('bolsista NÃO vê os acessos (nem os dela)', :BB, $q$do $x$ begin if exists(select 1 from public.acessos) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('coord. técnica NÃO vê os acessos', :T, $q$do $x$ begin if exists(select 1 from public.acessos) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('geral vê os acessos', :G, $q$do $x$ begin if (select count(*) from public.acessos) < 2 then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('ninguém altera um acesso', :G, $q$update public.acessos set tipo = 'saida'$q$, 'permission denied');
select t('ninguém apaga um acesso', :G, $q$delete from public.acessos$q$, 'permission denied');
select t('aparelho grande é cortado em 80 letras', :BB, $q$do $x$ begin perform public.registrar_acesso('saida', repeat('x', 300)); end $x$ $q$, 'ok');
select t('IP vem do cabeçalho da requisição (primeiro da lista)', :BB, $q$do $x$ begin
  perform set_config('request.headers', '{"x-forwarded-for": "177.12.34.56, 10.0.0.1"}', true);
  perform public.registrar_acesso('entrada', 'iPhone · Safari');
  perform set_config('role', 'none', true);
  if (select ip from public.acessos order by id desc limit 1) <> '177.12.34.56' then raise exception 'ip errado: %', (select ip from public.acessos order by id desc limit 1); end if; end $x$ $q$, 'ok');
select t('sem cabeçalho: registra sem IP', :BB, $q$do $x$ begin
  perform set_config('request.headers', '', true);
  perform public.registrar_acesso('entrada', null);
  perform set_config('role', 'none', true);
  if (select ip from public.acessos order by id desc limit 1) is not null then raise exception 'tinha ip'; end if; end $x$ $q$, 'ok');
select t('registro antigo (mais de 6 meses) é apagado pela limpeza', :G, $q$do $x$ declare i int; begin
  perform set_config('role', 'none', true);
  insert into public.acessos (equipe_id, em, tipo) select id, now() - interval '7 months', 'entrada' from public.equipe where papel = 'coord_geral';
  perform set_config('role', 'authenticated', true);
  for i in 1..200 loop perform public.registrar_acesso('abriu', null); end loop;
  perform set_config('role', 'none', true);
  if exists (select 1 from public.acessos where em < now() - interval '6 months') then raise exception 'não limpou'; end if; end $x$ $q$, 'ok');
select t('pessoa desligada (sem cadastro ativo) não registra nada', null, $q$do $x$ begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.registrar_acesso('entrada', null);
  perform set_config('role', 'none', true);
  if exists (select 1 from public.acessos where equipe_id is null) then raise exception 'x'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
