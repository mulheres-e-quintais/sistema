-- roda DEPOIS do test_cadastro.sql (usa :G, :T, :P, :A e a função t)
\set QUIET on
truncate res;
select f(:P, $q$insert into public.turmas_fic (nome, uf, professor_id) values ('Turma Piauí', 'PI', public.meu_id()), ('Turma 5 estados', null, public.meu_id())$q$);
create temp table ids as select (select id from public.turmas_fic where nome='Turma Piauí') pi, (select id from public.turmas_fic where nome='Turma 5 estados') geral,
  (select id from public.equipe where papel='coord_tecnico' and status='ativa') ct, (select id from public.equipe where email='ag2@t.com') ag, (select id from public.equipe where email='art.ba@t.com') ba;
grant select on ids to authenticated;
select t('professor matricula a coordenação técnica numa turma de estado', :P, $q$select public.matricular_fic((select pi from ids), (select ct from ids), '2026FIC01', current_date)$q$, 'ok');
select t('professor matricula a coordenação técnica na turma de 5 estados', :P, $q$select public.matricular_fic((select geral from ids), (select ct from ids), '2026FIC01', current_date)$q$, 'ok');
select f(:P, $q$select public.matricular_fic((select geral from ids), (select ct from ids), '2026FIC01', current_date)$q$);
select t('habilitação da coordenação técnica recebe a data do FIC', :G, $q$do $x$ begin if (select matricula_fic_em from public.equipe where id=(select ct from ids)) is null then raise exception 'sem data'; end if; end $x$ $q$, 'ok');
select t('bolsista da BA continua barrada na turma do PI', :P, $q$select public.matricular_fic((select pi from ids), (select ba from ids), '2026FIC02', current_date)$q$, 'Esta turma é de PI');
select t('agente do PI entra na turma do PI', :P, $q$select public.matricular_fic((select pi from ids), (select ag from ids), '2026FIC03', current_date)$q$, 'ok');
select t('professor não é matriculado', :P, $q$select public.matricular_fic((select geral from ids), public.meu_id(), '2026FIC04', current_date)$q$, 'Só a coordenação técnica');
select t('coordenação geral não é matriculada', :G, $q$select public.matricular_fic((select geral from ids), public.meu_id(), '2026FIC05', current_date)$q$, 'Só a coordenação técnica');
select t('coordenação técnica não se matricula sozinha', :T, $q$select public.matricular_fic((select geral from ids), public.meu_id(), '2026FIC06', current_date)$q$, 'professores do curso');
select t('professor vê a coordenação técnica na lista do FIC (sem CPF)', :P, $q$do $x$ begin if not exists (select 1 from public.equipe_para_fic() where papel='coord_tecnico') then raise exception 'não aparece'; end if; end $x$ $q$, 'ok');
select t('agente não vê a lista do FIC', :A, $q$do $x$ begin if exists (select 1 from public.equipe_para_fic()) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 90) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
