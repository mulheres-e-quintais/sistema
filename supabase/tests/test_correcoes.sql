-- Rodar logo depois de test_campo.sql, no mesmo banco (com 04 instalado).
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); perform set_config('request.jwt.claim.email', p_email, false); end $$;
select pg_temp.como('ana@x.org'); set role authenticated;
\echo '== C1. remarcar um acompanhamento quando já há 2 (OK: 1 linha)'
update public.visitas set data_prevista='2027-05-25' where id='20000000-0000-0000-0000-000000000009' returning data_prevista;
\echo '== C2. mesmo via upsert (insert on conflict) (OK)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf)
  select id, ficha_id, etapa, executor_id, '2027-05-26', uf from public.visitas where id='20000000-0000-0000-0000-000000000009'
  on conflict (id) do update set data_prevista = excluded.data_prevista returning data_prevista;
\echo '== C3. terceiro acompanhamento novo continua proibido (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) select '20000000-0000-0000-0000-000000000099', ficha_id, 'acompanhamento', executor_id, '2027-07-01', uf from public.visitas where id='20000000-0000-0000-0000-000000000009';
reset role;
\echo '== C4. ficha devolvida: cancelar visita ainda funciona (OK: cancelada)'
set session_replication_role = replica; update public.fichas set situacao='devolvida', obs_coordenacao='teste de devolução' where id='10000000-0000-0000-0000-000000000001'; set session_replication_role = origin;
select pg_temp.como('ana@x.org'); set role authenticated;
update public.visitas set situacao='cancelada' where id='20000000-0000-0000-0000-000000000008' returning situacao;
\echo '== C5. mas remarcar (sem cancelar) numa ficha devolvida dá ERRO'
update public.visitas set executor_id = (select id from public.equipe where email='gil@x.org') where id='20000000-0000-0000-0000-000000000009';
reset role;
\echo '== C6. coordenação apaga km conferido (OK: 0 linhas depois)'
select pg_temp.como('tec@x.org'); set role authenticated;
insert into public.custos_visita (visita_id, km_ida) values ('20000000-0000-0000-0000-000000000009', 40);
delete from public.custos_visita where visita_id='20000000-0000-0000-0000-000000000009';
select count(*) from public.custos_visita;
reset role;
