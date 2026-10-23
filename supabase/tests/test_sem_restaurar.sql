-- 75: a função de restaurar do 74 não fica no banco; o histórico continua gravando (com a coluna obs vazia)
\pset tuples_only on
select case when not exists (select 1 from pg_proc where proname = 'restaurar_versao' and pronamespace = 'public'::regnamespace)
  then 'PASSOU' else 'FALHOU' end || ' 75: restaurar_versao não existe no banco';
select case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'auditoria' and column_name = 'obs')
  then 'PASSOU' else 'FALHOU' end || ' 75: a coluna obs do histórico continua (o 74 já rodou em produção)';
select case when (select proconfig::text from pg_proc where proname = 'auditar' and pronamespace = 'public'::regnamespace) like '%pg_temp%'
  then 'PASSOU' else 'FALHOU' end || ' 75: a gravação do histórico segue com search_path fechado';
begin;
insert into public.kit_itens (id, item, unidade, valor_ref) values ('00000000-0000-0000-0000-0000000075b1', 'Regador T75', 'un', 30);
update public.kit_itens set valor_ref = 35 where id = '00000000-0000-0000-0000-0000000075b1';
select case when exists (select 1 from public.auditoria where tabela = 'kit_itens' and registro_id = '00000000-0000-0000-0000-0000000075b1' and acao = 'UPDATE' and obs is null)
  then 'PASSOU' else 'FALHOU' end || ' 75: alteração continua indo para o histórico, sem marca';
rollback;
\pset tuples_only off
