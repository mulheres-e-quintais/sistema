-- 51_kit_itens.sql: quem lê, quem altera e o que é recusado. Roda depois da suíte (usa t(), res e a equipe dela).
\set QUIET on
\pset format unaligned
\pset tuples_only on
truncate res;
-- 04/10/2026: preço do kit é só da coordenação geral (lê e altera); os outros perfis recebem nome e unidade pela função kit_itens_nomes
select user_id as ct from public.equipe where papel = 'coord_geral' and status = 'ativa' and user_id is not null limit 1 \gset
select user_id as bo from public.equipe where papel in ('articulacao', 'apoio') and status = 'ativa' and user_id is not null limit 1 \gset
\set CT '''' :ct ''''
\set BO '''' :bo ''''
select t('bolsista recebe nome e unidade dos itens', :BO, $q$do $$ begin if (select count(*) from public.kit_itens_nomes() where item is not null and unidade is not null) < 9 then raise exception 'lista vazia'; end if; end $$$q$, 'ok');
select t('bolsista não vê nenhuma linha da tabela de preços', :BO, $q$do $$ begin if (select count(*) from public.kit_itens) > 0 then raise exception 'viu preço'; end if; end $$$q$, 'ok');
-- (a equipe da suíte não tem coordenação técnica com login: a regra é conferida no próprio banco)
select t('a regra de leitura dos preços cita só a coordenação geral', null, $q$do $$ begin perform set_config('role', 'none', true);
  if (select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'kit_itens_ler') !~ 'coord_geral' or (select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'kit_itens_ler') ~ 'coord_tecnico|is not null' then raise exception 'regra aberta'; end if; end $$$q$, 'ok');
select t('a função de alterar preço não aceita a coordenação técnica', null, $q$do $$ begin perform set_config('role', 'none', true);
  if (select prosrc from pg_proc where proname = 'salvar_kit_item') ~ 'coord_tecnico' then raise exception 'aceita técnica'; end if; end $$$q$, 'ok');
select t('a função de nomes não devolve preço nem fonte', null, $q$do $$ begin perform set_config('role', 'none', true);
  if (select pg_get_function_result(p.oid) from pg_proc p where p.proname = 'kit_itens_nomes') ~* 'valor|fonte|preliminar' then raise exception 'devolve preço'; end if; end $$$q$, 'ok');
select t('quem não entrou não recebe nem os nomes', null, $q$select count(*) from public.kit_itens_nomes()$q$, 'permission denied');
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

-- ===== segunda parte: ataques e casos de borda =====
select user_id as cg from public.equipe where papel = 'coord_geral' and status = 'ativa' and user_id is not null limit 1 \gset
\set CG '''' :cg ''''
select t('quem não entrou não chama a função', null, $q$select public.salvar_kit_item(null, 'Arame', 'm', 2, null, true, true)$q$, 'permission denied');
select t('coordenação não grava direto na tabela (só pela função)', :CG, $q$insert into public.kit_itens (item, unidade, valor_ref) values ('Direto', 'un', 1)$q$, 'permission denied');
select t('coordenação não apaga direto', :CG, $q$delete from public.kit_itens$q$, 'permission denied');
select t('bolsista não apaga', :BO, $q$delete from public.kit_itens$q$, 'permission denied');
select t('bolsista não inclui direto', :BO, $q$insert into public.kit_itens (item, unidade, valor_ref) values ('Direto', 'un', 1)$q$, 'permission denied');
select t('preço negativo é recusado', :CG, $q$select public.salvar_kit_item(null, 'Bomba', 'un', -5, null, true, true)$q$, 'maior que zero');
select t('preço nulo é recusado', :CG, $q$select public.salvar_kit_item(null, 'Bomba', 'un', null, null, true, true)$q$, 'maior que zero');
select t('nome vazio é recusado', :CG, $q$select public.salvar_kit_item(null, '   ', 'un', 5, null, true, true)$q$, 'nome do item');
select t('nome de 1 letra é recusado', :CG, $q$select public.salvar_kit_item(null, 'A', 'un', 5, null, true, true)$q$, 'nome do item');
select t('nome com mais de 120 letras é recusado', :CG, $q$select public.salvar_kit_item(null, repeat('a', 121), 'un', 5, null, true, true)$q$, 'nome do item');
select t('unidade vazia é recusada', :CG, $q$select public.salvar_kit_item(null, 'Bomba', '', 5, null, true, true)$q$, 'unidade');
select t('unidade com mais de 20 letras é recusada', :CG, $q$select public.salvar_kit_item(null, 'Bomba', repeat('u', 21), 5, null, true, true)$q$, 'unidade');
select t('origem com mais de 300 letras é recusada', :CG, $q$select public.salvar_kit_item(null, 'Bomba', 'un', 5, repeat('f', 301), true, true)$q$, '300 letras');
select t('nome repetido com espaços em volta é recusado', :CG, $q$select public.salvar_kit_item(null, '  Esterco curtido  ', 'saco', 10, null, true, true)$q$, 'Já existe');
select t('id que não existe é recusado', :CG, $q$select public.salvar_kit_item(gen_random_uuid(), 'Fantasma', 'un', 5, null, true, true)$q$, 'não encontrado');
select t('renomear um item para o nome de outro é recusado', :CG, $q$select public.salvar_kit_item((select id from public.kit_itens where item = 'Esterco curtido'), 'Mudas frutíferas', 'un', 5, null, true, true)$q$, 'Já existe');
select t('preço no teto (R$ 5.000,00) é aceito', :CG, $q$select public.salvar_kit_item(null, 'Item caro', 'un', 5000, null, true, true)$q$, 'ok');
select t('preço é arredondado para centavos', :CG, $q$do $$ declare i uuid; begin i := public.salvar_kit_item(null, 'Item quebrado', 'un', 3.456, null, true, true); if (select valor_ref from public.kit_itens where id = i) <> 3.46 then raise exception 'não arredondou'; end if; end $$$q$, 'ok');
select t('texto com aspas e código fica guardado como texto (sem executar nada)', :CG, $q$do $$ declare i uuid; n int := (select count(*) from public.kit_itens); begin
  i := public.salvar_kit_item(null, 'x''); drop table public.kit_itens; --', 'un', 5, '<script>alert(1)</script>', true, true);
  if (select count(*) from public.kit_itens) <> n + 1 then raise exception 'tabela mexida'; end if;
  if (select item from public.kit_itens where id = i) <> 'x''); drop table public.kit_itens; --' then raise exception 'texto alterado'; end if; end $$$q$, 'ok');
select t('item pode sair da lista (inativo) e voltar, sem apagar', :CG, $q$do $$ declare i uuid := (select id from public.kit_itens where item = 'Regador e mangueira'); begin
  perform public.salvar_kit_item(i, 'Regador e mangueira', 'un', 120, null, true, false);
  if (select ativo from public.kit_itens where id = i) then raise exception 'continuou ativo'; end if;
  perform public.salvar_kit_item(i, 'Regador e mangueira', 'un', 120, null, true, true);
  if not (select ativo from public.kit_itens where id = i) then raise exception 'não voltou'; end if; end $$$q$, 'ok');
select t('cada inclusão fica no histórico com quem fez', :CG, $q$do $$ declare i uuid; begin i := public.salvar_kit_item(null, 'Item auditado', 'un', 5, null, true, true);
  if not exists (select 1 from public.auditoria a where a.tabela = 'kit_itens' and a.registro_id = i and a.acao = 'INSERT' and a.por = public.meu_id()) then raise exception 'sem histórico'; end if; end $$$q$, 'ok');
-- todos os papéis recebem os nomes; só a coordenação geral vê a tabela com preço e altera
do $$ declare r record; begin
  for r in select distinct on (papel) papel, user_id from public.equipe where status = 'ativa' and user_id is not null order by papel loop
    perform t('papel ' || r.papel || ' recebe os nomes dos itens', r.user_id, 'do $x$ begin if (select count(*) from public.kit_itens_nomes()) < 9 then raise exception ''não recebeu''; end if; end $x$', 'ok');
    perform t('papel ' || r.papel || case when r.papel = 'coord_geral' then ' vê os preços' else ' não vê preço' end, r.user_id,
      'do $x$ begin if (select count(*) from public.kit_itens) ' || case when r.papel = 'coord_geral' then '< 9' else '> 0' end || ' then raise exception ''acesso errado''; end if; end $x$', 'ok');
    if r.papel <> 'coord_geral' then
      perform t('papel ' || r.papel || ' não altera preço', r.user_id, 'select public.salvar_kit_item(null, ''Arame'', ''m'', 2, null, true, true)', 'coordenação');
    end if;
  end loop; end $$;
-- rodar o arquivo de novo não desfaz o que a coordenação alterou
select set_config('request.jwt.claim.sub', :CG, false); set role authenticated;
select public.salvar_kit_item((select id from public.kit_itens where item = 'Tela para galinheiro'), 'Tela para galinheiro', 'm', 9.90, 'Cotação de teste, out/2026', false, true);
reset role; select set_config('request.jwt.claim.sub', '', false);
\i ../51_kit_itens.sql
\pset format unaligned
\pset tuples_only on
insert into res(caso, ok, det) select 'rodar o 51 de novo mantém o preço que a coordenação gravou', valor_ref = 9.90 and not preliminar, valor_ref::text from public.kit_itens where item = 'Tela para galinheiro';
insert into res(caso, ok, det) select 'rodar o 51 de novo não duplica itens', count(*) = count(distinct lower(trim(item))), count(*)::text from public.kit_itens;
insert into res(caso, ok, det) select 'linhas da tabela obedecem às travas (preço, nome, unidade)', bool_and(valor_ref > 0 and valor_ref <= 5000 and length(trim(item)) >= 2 and length(trim(unidade)) >= 1), '' from public.kit_itens;
insert into res(caso, ok, det) select 'a tabela tem segurança por linha ligada', relrowsecurity, '' from pg_class where oid = 'public.kit_itens'::regclass;
insert into res(caso, ok, det) select 'visitante (anon) não tem nenhuma permissão na tabela', not has_table_privilege('anon', 'public.kit_itens', 'select,insert,update,delete'), '';
insert into res(caso, ok, det) select 'equipe logada só tem leitura na tabela', has_table_privilege('authenticated', 'public.kit_itens', 'select') and not has_table_privilege('authenticated', 'public.kit_itens', 'insert') and not has_table_privilege('authenticated', 'public.kit_itens', 'update') and not has_table_privilege('authenticated', 'public.kit_itens', 'delete'), '';
insert into res(caso, ok, det) select 'visitante (anon) não executa a função de gravar', not has_function_privilege('anon', 'public.salvar_kit_item(uuid, text, text, numeric, text, boolean, boolean)', 'execute'), '';
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from res;
select 'FALHOU: ' || caso || ' -> ' || det from res where not ok;
