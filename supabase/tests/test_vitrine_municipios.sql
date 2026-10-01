-- 40_vitrine_municipios.sql: só totais por município; menos de 3 sem o número; anônimo pode ler
\set QUIET on
truncate res;
select t('anônimo lê os totais por município', null, $q$select public.vitrine_municipios()$q$, 'ok');
select t('nada de nome, CPF ou situação individual', null, $q$do $x$ declare v text := public.vitrine_municipios()::text; begin
  if v ~* '(nome|cpf|lista_espera|sem_agua|selecionada|telefone)' then raise exception 'vazou: %', v; end if; end $x$ $q$, 'ok');
select t('município com menos de 3 vai sem o número', null, $q$do $x$ begin
  if exists (select 1 from jsonb_array_elements(public.vitrine_municipios()) e where (e->>'menos_de_3')::boolean and e->>'n' is not null) then raise exception 'número exposto'; end if;
  if exists (select 1 from jsonb_array_elements(public.vitrine_municipios()) e where not (e->>'menos_de_3')::boolean and (e->>'n')::int < 3) then raise exception 'regra'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
