\set QUIET on
truncate res;
select t('coordenação geral lê o histórico', :G, $q$do $x$ begin if not exists(select 1 from public.auditoria) then raise exception 'vazio'; end if; end $x$ $q$, 'ok');
select t('coordenação técnica NÃO lê o histórico', :T, $q$do $x$ begin if exists(select 1 from public.auditoria) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('auxiliar NÃO lê o histórico', :X, $q$do $x$ begin if exists(select 1 from public.auditoria) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('bolsista NÃO lê o histórico', :BB, $q$do $x$ begin if exists(select 1 from public.auditoria) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('ninguém apaga o histórico (nem a geral)', :G, $q$delete from public.auditoria$q$, 'permission denied');
select t('ninguém altera o histórico (nem a geral)', :G, $q$update public.auditoria set acao = 'X'$q$, 'permission denied');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 90) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
