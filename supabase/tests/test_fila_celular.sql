-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, :BB, :A, :X, t()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_fila_celular.sql
-- 58_fila_nos_celulares.sql: o celular informa só a contagem; a coordenação vê.
\set QUIET on
truncate res;
select t('58. a agente informa a contagem do celular', :A, $q$select public.informar_fila(3, 1, now() - interval '3 days')$q$, 'ok');
select t('58. contagem negativa ou recusados acima do total: recusado', :A, $q$select public.informar_fila(2, 5, now())$q$, 'Contagem inválida');
select t('58. conta sem cadastro: não grava nada (e não dá erro)', gen_random_uuid(), $q$do $x$ begin perform public.informar_fila(1, 0, now()); end $x$$q$, 'ok');
select t('58. ninguém lê a tabela direto (só pela função)', :G, $q$select count(*) from public.fila_celular$q$, 'permission denied');
-- grava de verdade para os casos de leitura
select f(:A, $q$select public.informar_fila(3, 1, now() - interval '3 days')$q$);
select t('58. a coordenação geral vê a agente com 3 registros', :G, $q$do $x$ begin
  if not exists (select 1 from public.listar_fila_celular() l join public.equipe e on e.id = l.equipe_id where e.email = 'ag1@t.com' and l.qtd = 3 and l.recusados = 1) then raise exception 'não viu'; end if; end $x$$q$, 'ok');
select t('58. a coordenação técnica também vê (agente é da equipe de campo)', :T, $q$do $x$ begin
  if not exists (select 1 from public.listar_fila_celular() l join public.equipe e on e.id = l.equipe_id where e.email = 'ag1@t.com') then raise exception 'não viu'; end if; end $x$$q$, 'ok');
select t('58. bolsista e auxiliar não veem a fila dos outros', :BB, $q$do $x$ begin if exists (select 1 from public.listar_fila_celular()) then raise exception 'viu'; end if; end $x$$q$, 'ok');
select t('58. ... nem o auxiliar', :X, $q$do $x$ begin if exists (select 1 from public.listar_fila_celular()) then raise exception 'viu'; end if; end $x$$q$, 'ok');
select t('58. celular sem nada guardado zera a contagem', :A, $q$do $x$ begin perform public.informar_fila(0, 0, null); set local role none;
  if (select qtd from public.fila_celular f join public.equipe e on e.id = f.equipe_id where e.email = 'ag1@t.com') <> 0 then raise exception 'não zerou'; end if; end $x$$q$, 'ok');
select t('58. data no futuro vira agora (relógio errado do celular não engana)', :A, $q$do $x$ begin perform public.informar_fila(1, 0, now() + interval '5 days'); set local role none;
  if (select mais_antigo from public.fila_celular f join public.equipe e on e.id = f.equipe_id where e.email = 'ag1@t.com') > now() then raise exception 'ficou no futuro'; end if; end $x$$q$, 'ok');
select n || '|' || case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || coalesce(det, '') from res order by n;
