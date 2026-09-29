-- roda DEPOIS do test_cadastro.sql, na mesma sessão (usa :G, :T, :BB, :A, :P, :X)
\set QUIET on
truncate res;
select logar('apoio.pi@t.com') \gset ap_
\set AP '''' :ap_logar ''''
\set PASS '{"finalidade":"intercambio","origem":"Salvador/BA","destino":"Teresina/PI","volta":"2026-12-20","bagagem":"mao","passageiros":[{"nome":"Maria Passageira Um","cpf":"529.982.247-25","rg":"123456","rg_orgao":"SSP/BA","nascimento":"1970-01-01","sexo":"F","celular":"(71) 99999-0000","email":"m@x.com"}]}'
create or replace function sp(quem text, id text, tipo text, dias int, dados text, just text default null) returns text language sql as $$
  select format('select public.salvar_pedido_apoio(%s, %L, %L, current_date + %s, %L::jsonb, %L)', coalesce(id, 'null'), tipo, 'Intercâmbio de beneficiárias', dias, dados, just) $$;
create or replace function mv(id text, acao text, obs text default null, prot text default null) returns text language sql as $$
  select format('select public.mover_pedido_apoio(%s, %L, %L, %L)', id, acao, obs, prot) $$;
-- quem pode pedir
select t('articulação pede passagem no prazo', :BB, sp('', null, 'passagem', 50, :'PASS'), 'ok');
select t('apoio NÃO pede', :AP, sp('', null, 'passagem', 50, :'PASS'), 'articulação');
select t('agente NÃO pede', :A, sp('', null, 'passagem', 50, :'PASS'), 'articulação');
select t('coord. técnica NÃO pede', :T, sp('', null, 'passagem', 50, :'PASS'), 'articulação');
select t('professor NÃO pede', :P, sp('', null, 'passagem', 50, :'PASS'), 'articulação');
select t('anônimo NÃO pede', null, sp('', null, 'passagem', 50, :'PASS'), 'permission denied');
-- prazos e dados
select t('passagem com 20 dias sem justificativa: recusa', :BB, sp('', null, 'passagem', 20, :'PASS'), 'fora do prazo');
select t('passagem com 20 dias COM justificativa: aceita', :BB, sp('', null, 'passagem', 20, :'PASS', 'Convite do MDA chegou só agora.'), 'ok');
select t('evento com 40 dias sem justificativa: recusa (45)', :BB, sp('', null, 'evento', 40, '{}'), 'fora do prazo');
select t('evento com 50 dias: aceita', :BB, sp('', null, 'evento', 50, '{"local":"Sede"}'), 'ok');
select t('data no passado recusada', :BB, sp('', null, 'evento', -1, '{}', 'justificativa longa aqui'), 'não passou');
select t('data depois do fim do projeto recusada', :BB, sp('', null, 'evento', 900, '{}'), 'fim do projeto');
select t('passagem sem passageira recusada', :BB, sp('', null, 'passagem', 50, '{"passageiros":[]}'), 'pelo menos uma');
select t('passageira sem RG recusada', :BB, sp('', null, 'passagem', 50, replace(:'PASS', '"rg":"123456",', '')), 'RG');
select t('volta antes da ida recusada', :BB, sp('', null, 'passagem', 50, replace(:'PASS', '2026-12-20', '2026-10-01')), 'volta é antes');
select t('tipo inventado recusado', :BB, sp('', null, 'diaria', 50, '{}'), 'inválido');
-- fluxo
create temp table pid(k text, id uuid); grant all on pid to authenticated;
select f(:BB, format('insert into pid select %L, (%s)', 'p1', sp('', null, 'passagem', 50, :'PASS')));
select f(:BB, format('insert into pid select %L, (%s)', 'e1', sp('', null, 'evento', 60, '{"local":"Sede"}')));
\set P1 '(select id from pid where k=''p1'')'
\set E1 '(select id from pid where k=''e1'')'
select t('pedido fica na UF da bolsista (BA)', :G, $q$do $x$ begin if (select uf from public.pedidos_apoio where id=(select id from pid where k='p1')) <> 'BA' then raise exception 'uf'; end if; end $x$ $q$, 'ok');
select t('bolsista não grava direto na tabela', :BB, $q$update public.pedidos_apoio set situacao='autorizado'$q$, 'permission denied');
select t('coord. geral não autoriza antes da técnica conferir', :G, mv(:'P1', 'autorizar'), 'conferido');
select t('bolsista não confere o próprio', :BB, mv(:'P1', 'conferir'), 'coordenação técnica');
select t('técnica devolve sem motivo: recusa', :T, mv(:'P1', 'devolver'), 'escreva');
select t('técnica devolve com motivo', :T, mv(:'P1', 'devolver', 'Falta o RG da segunda passageira.'), 'ok');
select f(:T, mv(:'P1', 'devolver', 'Falta o RG da segunda passageira.'));
select t('técnica não confere pedido devolvido', :T, mv(:'P1', 'conferir'), 'não está esperando');
select t('bolsista corrige e reenvia', :BB, sp('', :'P1', 'passagem', 55, :'PASS'), 'ok');
select f(:BB, sp('', :'P1', 'passagem', 55, :'PASS'));
select t('reenviado volta para "enviado"', :G, $q$do $x$ begin if (select situacao from public.pedidos_apoio where id=(select id from pid where k='p1')) <> 'enviado' then raise exception 'sit'; end if; end $x$ $q$, 'ok');
select t('não corrige pedido que não foi devolvido', :BB, sp('', :'P1', 'passagem', 55, :'PASS'), 'Só dá para corrigir');
select t('outra articulação não corrige pedido alheio', :B, sp('', :'P1', 'passagem', 55, :'PASS'), '');
select t('técnica confere', :T, mv(:'P1', 'conferir'), 'ok');
select f(:T, mv(:'P1', 'conferir'));
select t('técnica NÃO autoriza', :T, mv(:'P1', 'autorizar'), 'coordenação geral');
select t('bolsista não cancela depois de conferido', :BB, mv(:'P1', 'cancelar'), 'Depois de conferido');
select t('geral autoriza com protocolo', :G, mv(:'P1', 'autorizar', null, 'FUNCERN 123/2026'), 'ok');
select f(:G, mv(:'P1', 'autorizar', null, 'FUNCERN 123/2026'));
select t('geral corrige o protocolo depois', :G, mv(:'P1', 'protocolo', null, 'FUNCERN 124/2026'), 'ok');
select t('autorizado não volta a ser recusado', :G, mv(:'P1', 'recusar', 'mudou de ideia'), 'não pode ser recusado');
select t('geral recusa evento sem motivo: recusa', :G, mv(:'E1', 'recusar'), 'motivo');
select t('bolsista cancela o próprio pedido enviado', :BB, mv(:'E1', 'cancelar'), 'ok');
select t('ação inventada', :G, mv(:'E1', 'pagar'), 'inválida');
-- quem vê
select t('coord. técnica vê os pedidos', :T, $q$do $x$ begin if (select count(*) from public.pedidos_apoio) < 2 then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('articulação vê só os dela', :BB, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio where solicitante_id <> public.meu_id()) then raise exception 'viu alheio'; end if; end $x$ $q$, 'ok');
select t('apoio NÃO vê pedidos', :AP, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('agente NÃO vê pedidos', :A, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('auxiliar NÃO vê pedidos', :X, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('professor NÃO vê pedidos', :P, $q$do $x$ begin if exists(select 1 from public.pedidos_apoio) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('histórico registra sem CPF das passageiras', :G, $q$do $x$ begin if not exists(select 1 from public.auditoria where tabela='pedidos_apoio') then raise exception 'sem registro'; end if; if exists(select 1 from public.auditoria where tabela='pedidos_apoio' and (depois::text like '%52998224725%' or depois::text like '%529.982%')) then raise exception 'CPF NO HISTÓRICO'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
