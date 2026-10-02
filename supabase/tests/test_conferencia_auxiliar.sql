-- roda POR ÚLTIMO (desliga a coordenação técnica e o auxiliar): depois do test_cadastro_equipe.sql e do test_passagens_eventos.sql, na mesma sessão (usa :G, :T, :BB, :X, sp(), mv())
-- 26_conferencia_auxiliar.sql: sempre duas pessoas em cada pedido de passagem e evento.
\set QUIET on
truncate res;
create temp table pid2(k text, id uuid); grant all on pid2 to authenticated;
select f(:BB, format('insert into pid2 select %L, (%s)', 'a', sp('', null, 'passagem', 50, :'PASS')));
-- (47: pedido idêntico da mesma pessoa em menos de 2 minutos devolve o que já existe; o segundo pedido do teste tem outra data)
select f(:BB, format('insert into pid2 select %L, (%s)', 'b', sp('', null, 'passagem', 51, :'PASS')));
select f(:BB, format('insert into pid2 select %L, (%s)', 'c', sp('', null, 'evento', 60, '{"local":"Sede"}')));
\set PA '(select id from pid2 where k=''a'')'
\set PB '(select id from pid2 where k=''b'')'
\set PC '(select id from pid2 where k=''c'')'
-- 1) com técnica ativa
select t('com técnica: quem confere é a técnica', :G, $q$do $x$ begin if public.quem_confere_pedidos() <> 'coord_tecnico' then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('com técnica: geral NÃO confere mais no lugar dela', :G, mv(:'PA', 'conferir'), 'coordenação técnica');
select t('com técnica: auxiliar NÃO confere', :X, mv(:'PA', 'conferir'), 'coordenação técnica');
select t('com técnica: auxiliar NÃO vê pedidos', :X, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('com técnica: geral ainda recusa direto', :G, mv(:'PC', 'recusar', 'Evento fora do plano.'), 'ok');
-- 2) técnica desligada
update public.equipe set status = 'desligada', data_fim = greatest(current_date, data_inicio), motivo_desligamento = 'Teste: vaga aberta.' where papel = 'coord_tecnico' and status = 'ativa';
select t('sem técnica: quem confere é o auxiliar', :G, $q$do $x$ begin if public.quem_confere_pedidos() <> 'auxiliar_adm' then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('sem técnica: bolsista sabe quem confere (só o papel)', :BB, $q$select public.quem_confere_pedidos()$q$, 'ok');
select t('sem técnica: auxiliar VÊ os pedidos', :X, $q$do $x$ begin if not exists(select 1 from public.pedidos_apoio) then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('sem técnica: auxiliar não grava direto na tabela', :X, $q$update public.pedidos_apoio set situacao='autorizado'$q$, 'permission denied');
select t('sem técnica: geral NÃO confere (é o auxiliar)', :G, mv(:'PA', 'conferir'), 'auxiliar administrativo');
select t('sem técnica: técnica desligada não confere', :T, mv(:'PA', 'conferir'), '');
select t('sem técnica: auxiliar devolve sem motivo: recusa', :X, mv(:'PB', 'devolver'), 'escreva');
select t('sem técnica: auxiliar devolve com motivo', :X, mv(:'PB', 'devolver', 'Falta o RG da passageira.'), 'ok');
select t('sem técnica: auxiliar confere', :X, mv(:'PA', 'conferir'), 'ok');
select f(:X, mv(:'PA', 'conferir'));
select t('conferido por quem? auxiliar', :G, $q$do $x$ begin if (select e.papel from public.pedidos_apoio p join public.equipe e on e.id = p.conferido_por where p.id=(select id from pid2 where k='a')) <> 'auxiliar_adm' then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('auxiliar NÃO autoriza', :X, mv(:'PA', 'autorizar'), 'coordenação geral');
select t('auxiliar NÃO recusa', :X, mv(:'PA', 'recusar', 'motivo qualquer'), 'coordenação geral');
select t('auxiliar NÃO registra protocolo', :X, mv(:'PA', 'protocolo', null, 'X'), 'coordenação geral');
select t('geral autoriza o conferido pelo auxiliar', :G, mv(:'PA', 'autorizar', null, 'FUNCERN 9/2026'), 'ok');
select t('regra NÃO vale para pagamento: auxiliar não dá aval', :X,
  $q$select public.avalizar_pagamento((select id from public.solicitacoes_pagamento limit 1), true, null, null)$q$, '');
-- 3) sem técnica e sem auxiliar
update public.equipe set status = 'desligada', data_fim = greatest(current_date, data_inicio), motivo_desligamento = 'Teste: vaga aberta.' where papel = 'auxiliar_adm' and status = 'ativa';
select t('sem os dois: quem confere é a geral', :G, $q$do $x$ begin if public.quem_confere_pedidos() <> 'coord_geral' then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('sem os dois: auxiliar desligado não vê pedidos', :X, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio where solicitante_id <> public.meu_id()) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('sem os dois: geral confere', :G, mv(:'PB', 'conferir'), 'ok');
select f(:G, mv(:'PB', 'conferir'));
-- 4) chega um auxiliar: quem conferiu (a geral) não autoriza o mesmo pedido
-- (só no teste: religa o auxiliar por baixo, sem as travas de "desligado não volta")
alter table public.equipe disable trigger user;
update public.equipe set status = 'ativa', data_fim = null, motivo_desligamento = null where email = 'aux@t.com';
alter table public.equipe enable trigger user;
select t('com auxiliar de volta: quem conferiu não autoriza o mesmo', :G, mv(:'PB', 'autorizar'), 'Quem conferiu não autoriza');
select t('geral devolve o pedido para nova conferência', :G, mv(:'PB', 'devolver', 'Voltar para o auxiliar conferir.'), 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
