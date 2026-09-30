-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 36_execucao_financeira.sql
\set QUIET on
truncate res;
select t('anônimo NÃO lê lançamentos', null, $q$select count(*) from public.execucao_lancamentos$q$, 'permission denied');
select t('anônimo NÃO lança', null, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 10, current_date)$q$, 'permission denied');
select t('técnica NÃO lança', :T, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 10, current_date)$q$, 'row-level security');
select t('bolsista NÃO lança', :BB, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 10, current_date)$q$, 'row-level security');
select t('geral lança despesa', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, documento, descricao) values ('despesa', 'quintais', 200000, current_date, 'NF 123', 'Primeira parcela da implantação')$q$, 'ok');
select t('geral lança repasse', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, documento) values ('repasse', 'repasse_mda', 1000000, date '2026-08-07', '2026NC000014')$q$, 'ok');
-- cenário gravado de verdade (t() desfaz o que faz)
select f(:G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, documento, descricao) values ('despesa', 'quintais', 200000, current_date, 'NF 123', 'Primeira parcela da implantação')$q$);
select f(:G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, documento) values ('repasse', 'repasse_mda', 1000000, date '2026-08-07', '2026NC000014')$q$);
select f(:G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, descricao) values ('despesa', 'combustivel', 350, current_date, 'Abastecimento lançado errado')$q$);
select t('técnica NÃO vê os lançamentos', :T, $q$do $x$ begin if exists(select 1 from public.execucao_lancamentos) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('bolsista NÃO vê os lançamentos', :BB, $q$do $x$ begin if exists(select 1 from public.execucao_lancamentos) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('quem lançou é o sistema que marca (não dá para forjar)', :G, $q$do $x$ begin
  insert into public.execucao_lancamentos (tipo, item, valor, data, criado_por, criado_em) values ('despesa', 'diarias', 400, current_date, null, '2020-01-01');
  if exists (select 1 from public.execucao_lancamentos where item = 'diarias' and (criado_por is null or criado_em < now() - interval '1 minute')) then raise exception 'forjou'; end if; end $x$ $q$, 'ok');
select t('valor negativo sem estorno é recusado', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', -10, current_date)$q$, 'negativo');
select t('valor zero é recusado', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 0, current_date)$q$, 'check');
select t('data no futuro é recusada', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 10, current_date + 5)$q$, 'futuro');
select t('item com código inválido é recusado', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'Quintais <b>', 10, current_date)$q$, 'check');
select t('ninguém altera um lançamento (nem a geral)', :G, $q$update public.execucao_lancamentos set valor = 1$q$, 'permission denied');
select t('ninguém apaga um lançamento (nem a geral)', :G, $q$delete from public.execucao_lancamentos$q$, 'permission denied');
select t('estorno sem motivo é recusado', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, estorno_de) select 'despesa', 'quintais', 1, current_date, id from public.execucao_lancamentos where item = 'quintais' and estorno_de is null limit 1$q$, 'motivo');
select t('estorno anula exatamente o original (valor, item e tipo vêm do original)', :G, $q$do $x$ declare o uuid; begin
  select id into o from public.execucao_lancamentos where item = 'quintais' and estorno_de is null limit 1;
  insert into public.execucao_lancamentos (tipo, item, valor, data, estorno_de, descricao) values ('repasse', 'diarias', 5, current_date, o, 'Nota fiscal lançada em duplicidade');
  if (select sum(valor) from public.execucao_lancamentos where id = o or estorno_de = o) <> 0 then raise exception 'não zerou'; end if;
  if (select item from public.execucao_lancamentos where estorno_de = o) <> 'quintais' then raise exception 'mudou item'; end if; end $x$ $q$, 'ok');
select f(:G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, estorno_de, descricao) select 'despesa', 'combustivel', 1, current_date, id, 'Abastecimento era de outro projeto' from public.execucao_lancamentos where item = 'combustivel'$q$);
select t('o mesmo lançamento não se estorna duas vezes', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, estorno_de, descricao) select 'despesa', 'quintais', 1, current_date, estorno_de, 'Tentando estornar de novo' from public.execucao_lancamentos where estorno_de is not null limit 1$q$, 'duplicate');
select t('não se estorna um estorno', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data, estorno_de, descricao) select 'despesa', 'quintais', 1, current_date, id, 'Estorno do estorno aqui' from public.execucao_lancamentos where estorno_de is not null limit 1$q$, 'estorna um estorno');
select t('cada lançamento vai para o histórico', :G, $q$do $x$ begin if (select count(*) from public.auditoria where tabela = 'execucao_lancamentos') < 4 then raise exception 'sem histórico'; end if; end $x$ $q$, 'ok');
select t('pode_matricular fechada para o público', null, $q$select public.pode_matricular(gen_random_uuid())$q$, 'permission denied');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
