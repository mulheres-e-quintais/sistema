-- 51_kit_itens.sql: quem lê, quem altera e o que é recusado. Roda depois da suíte (usa t(), res e a equipe dela).
\set QUIET on
\pset format unaligned
\pset tuples_only on
truncate res;
select user_id as ct from public.equipe where papel in ('coord_tecnico', 'coord_geral') and status = 'ativa' and user_id is not null order by papel desc limit 1 \gset
select user_id as bo from public.equipe where papel in ('articulacao', 'apoio') and status = 'ativa' and user_id is not null limit 1 \gset
\set CT '''' :ct ''''
\set BO '''' :bo ''''
select t('bolsista lê a lista de itens', :BO, $q$do $$ begin if (select count(*) from public.kit_itens) < 9 then raise exception 'lista vazia'; end if; end $$$q$, 'ok');
select t('quem não entrou não lê a lista', null, $q$do $$ begin if (select count(*) from public.kit_itens) > 0 then raise exception 'vazou'; end if; end $$$q$, 'permission denied');
select t('bolsista não altera preço pela função', :BO, $q$select public.salvar_kit_item(null, 'Arame liso', 'm', 2, null, true, true)$q$, 'coordenação');
select t('bolsista não grava direto na tabela', :BO, $q$update public.kit_itens set valor_ref = 1$q$, 'permission denied');
select t('coordenação inclui item', :CT, $q$select public.salvar_kit_item(null, 'Arame liso', 'm', 2.5, null, true, true)$q$, 'ok');
select t('nome repetido é recusado (sem ligar para maiúscula)', :CT, $q$select public.salvar_kit_item(null, 'ESTERCO CURTIDO', 'saco', 10, null, true, true)$q$, 'Já existe');
select t('preço zero é recusado', :CT, $q$select public.salvar_kit_item(null, 'Bomba', 'un', 0, null, true, true)$q$, 'maior que zero');
select t('preço acima do kit é recusado', :CT, $q$select public.salvar_kit_item(null, 'Bomba', 'un', 5000.01, null, true, true)$q$, 'maior que zero');
select t('confirmar preço sem dizer a origem é recusado', :CT, $q$select public.salvar_kit_item((select id from public.kit_itens where item = 'Esterco curtido'), 'Esterco curtido', 'saco', 12, null, false, true)$q$, 'de onde ele veio');
select t('coordenação confirma preço com a origem', :CT, $q$do $$ declare i uuid := (select id from public.kit_itens where item = 'Esterco curtido'); begin perform public.salvar_kit_item(i, 'Esterco curtido', 'saco', 12, 'Cotação de 3 lojas, out/2026', false, true);
  if (select preliminar or valor_ref <> 12 or atualizado_por is null from public.kit_itens where id = i) then raise exception 'não gravou'; end if;
  if not exists (select 1 from public.auditoria where tabela = 'kit_itens' and registro_id = i and acao = 'UPDATE') then raise exception 'sem histórico'; end if; end $$$q$, 'ok');
select t('item não se apaga', null, $q$do $$ begin perform set_config('role', 'none', true); delete from public.kit_itens; end $$$q$, 'não se apaga');
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from res;
select 'FALHOU: ' || caso || ' -> ' || det from res where not ok;
