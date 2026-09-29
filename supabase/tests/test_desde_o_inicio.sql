-- roda depois do test_cadastro_equipe.sql (usa :G, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 32_desde_o_inicio.sql: pagamento e entregas só a partir do mês de início
\set QUIET on
truncate res;
select set_config('t.bb', :BB, false);
do $x$ begin
  alter table public.equipe disable trigger user;
  update public.equipe set data_inicio = date_trunc('month', current_date)::date + 3,
    matricula_fic_em = date_trunc('month', current_date)::date + 3, docs_funcern_em = current_date, termo_assinado_em = current_date
   where user_id = current_setting('t.bb')::uuid;
  alter table public.equipe enable trigger user;
end $x$;
select t('bolsa do mês anterior ao início é recusada', :BB, $q$select public.solicitar_pagamento('bolsa', (date_trunc('month', current_date) - interval '1 month')::date, 1000, repeat('relatório do mês ', 5), null, '{}')$q$, 'começou no projeto');
select t('bolsa do mês de início é aceita (mesmo começando no dia 4)', :BB, $q$select public.solicitar_pagamento('bolsa', date_trunc('month', current_date)::date, 1000, repeat('relatório do mês ', 5), null, '{}')$q$, 'ok');
select t('presença do mês anterior ao início é recusada', :BB, $q$insert into public.entregas_mes (equipe_id, mes, item) select id, (date_trunc('month', current_date) - interval '1 month')::date, 'presenca' from public.equipe where user_id = current_setting('t.bb')::uuid$q$, 'começou no projeto');
select t('presença do mês de início é aceita', :BB, $q$insert into public.entregas_mes (equipe_id, mes, item) select id, date_trunc('month', current_date)::date, 'presenca' from public.equipe where user_id = current_setting('t.bb')::uuid$q$, 'ok');
select t('AVA antes do início é recusado', :G, $q$insert into public.entregas_mes (equipe_id, mes, item) select id, (date_trunc('month', current_date) - interval '1 month')::date, 'ava' from public.equipe where user_id = current_setting('t.bb')::uuid$q$, 'começou no projeto');
select t('AVA no mês de início e da matrícula é aceito', :G, $q$insert into public.entregas_mes (equipe_id, mes, item) select id, date_trunc('month', current_date)::date, 'ava' from public.equipe where user_id = current_setting('t.bb')::uuid$q$, 'ok');
select t('AVA sem matrícula no FIC é recusado', :G, $q$do $y$ begin set local role none; update public.equipe set matricula_fic_em = null where user_id = current_setting('t.bb')::uuid; set local role authenticated;
  insert into public.entregas_mes (equipe_id, mes, item) select id, date_trunc('month', current_date)::date, 'ava' from public.equipe where user_id = current_setting('t.bb')::uuid; end $y$$q$, 'matrícula no FIC');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
