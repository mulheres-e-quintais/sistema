-- roda depois do test_passagens_eventos.sql e ANTES do test_conferencia_auxiliar.sql (usa :G, :T, :BB, sp(), mv())
-- 35_tetos_passagens_eventos.sql
\set QUIET on
truncate res;
create temp table if not exists pid3 (k text, id uuid); grant all on pid3 to authenticated;
select t('pedido sem valor estimado é recusado', :BB, $q$select public.salvar_pedido_apoio(null, 'evento', 'Evento sem valor teste', current_date + 60, '{"local":"Sede"}'::jsonb, null)$q$, 'valor estimado');
-- evento de R$ 5.000 na BA: autoriza; outro de R$ 1.500: passa do teto (6.000)
select f(:BB, format('insert into pid3 select %L, (%s)', 'e5', sp('', null, 'evento', 60, '{"local":"Sede","valor_estimado":5000}')));
select f(:BB, format('insert into pid3 select %L, (%s)', 'e2', sp('', null, 'evento', 61, '{"local":"Sede","valor_estimado":1500}')));
select f(:T, mv((select quote_literal(id) from pid3 where k='e5'), 'conferir'));
select f(:T, mv((select quote_literal(id) from pid3 where k='e2'), 'conferir'));
select t('geral autoriza evento de R$ 5.000 (dentro do teto)', :G, mv((select quote_literal(id) from pid3 where k='e5'), 'autorizar'), 'ok');
select f(:G, mv((select quote_literal(id) from pid3 where k='e5'), 'autorizar'));
select t('valor autorizado = estimado quando a geral não ajusta', :G, $q$do $x$ begin if (select valor_autorizado from public.pedidos_apoio p join pid3 on pid3.id = p.id where k='e5') <> 5000 then raise exception 'x'; end if; end $x$$q$, 'ok');
select t('segundo evento do estado passa do teto: não autoriza', :G, mv((select quote_literal(id) from pid3 where k='e2'), 'autorizar'), 'teto de eventos');
select t('técnica NÃO define valor', :T, format('select public.definir_valor_pedido(%L, 900)', (select id from pid3 where k='e2')), 'coordenação geral');
select f(:G, format('select public.definir_valor_pedido(%L, 1000)', (select id from pid3 where k='e2')));
select t('geral ajusta para R$ 1.000 (saldo exato): autoriza', :G, mv((select quote_literal(id) from pid3 where k='e2'), 'autorizar'), 'ok');
select t('saldo mostra só totais para a bolsista', :BB, $q$do $x$ begin if (public.saldo_passagens_eventos()->>'evento_teto')::numeric <> 6000 then raise exception 'x'; end if; end $x$$q$, 'ok');
select t('anônimo NÃO vê saldo', null, $q$select public.saldo_passagens_eventos()$q$, 'permission denied');
-- passagem: teto de R$ 70.000 no projeto
select f(:BB, format('insert into pid3 select %L, (%s)', 'p1', sp('', null, 'passagem', 60, :'PASS')));
select f(:T, mv((select quote_literal(id) from pid3 where k='p1'), 'conferir'));
select f(:G, format('select public.definir_valor_pedido(%L, 70001)', (select id from pid3 where k='p1')));
select t('passagem acima de R$ 70.000: não autoriza', :G, mv((select quote_literal(id) from pid3 where k='p1'), 'autorizar'), 'teto de passagens');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
