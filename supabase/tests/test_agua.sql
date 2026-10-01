-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 39_agua.sql. Cenário: uma ficha "sem água: encaminhada" copiada de uma ficha existente (só para o teste)
\set QUIET on
truncate res;
set session_replication_role = replica;
do $x$ declare cols text; begin
  select string_agg(quote_ident(column_name), ',') into cols from information_schema.columns where table_schema = 'public' and table_name = 'fichas' and is_generated = 'NEVER';
  execute format('insert into public.fichas (%s) select %s from jsonb_populate_record(null::public.fichas, (select to_jsonb(f) || jsonb_build_object(''id'', gen_random_uuid(), ''resultado'', ''sem_agua'', ''c_agua'', false, ''encaminhada_para'', ''Programa Cisternas do município'', ''nome'', ''Teste Sem Agua'', ''cpf'', ''39053344705'') from public.fichas f limit 1))', cols, cols);
end $x$;
set session_replication_role = origin;
select id as fa from public.fichas where nome = 'Teste Sem Agua' \gset
select id as fs from public.fichas where resultado <> 'sem_agua' limit 1 \gset
select t('anônimo NÃO lê a situação da água', null, $q$select count(*) from public.agua_situacoes$q$, 'permission denied');
select t('anônimo NÃO registra', null, format($q$select public.registrar_situacao_agua(%L, 'em_andamento', 'Cisterna sendo construída')$q$, :'fa'), 'permission denied');
select t('bolsista NÃO registra', :BB, format($q$select public.registrar_situacao_agua(%L, 'em_andamento', 'Cisterna sendo construída')$q$, :'fa'), 'coordenação');
select t('ninguém grava direto na tabela', :G, format($q$insert into public.agua_situacoes (ficha_id, situacao, obs) values (%L, 'concluida', 'Gravando direto na tabela')$q$, :'fa'), 'permission denied');
select t('quem não precisa de água fica fora', :G, format($q$select public.registrar_situacao_agua(%L, 'em_andamento', 'Cisterna sendo construída')$q$, :'fs'), 'não está na lista');
select t('sem observação é recusado', :G, format($q$select public.registrar_situacao_agua(%L, 'em_andamento', 'curto')$q$, :'fa'), 'pelo menos 10');
select t('situação inválida é recusada', :G, format($q$select public.registrar_situacao_agua(%L, 'resolvida', 'Cisterna sendo construída')$q$, :'fa'), 'inválida');
select f(:T, format($q$select public.registrar_situacao_agua(%L, 'em_andamento', 'Cisterna de 16 mil litros em construção pela prefeitura')$q$, :'fa'));
select t('a mesma situação duas vezes é recusada', :G, format($q$select public.registrar_situacao_agua(%L, 'em_andamento', 'Cisterna sendo construída de novo')$q$, :'fa'), 'já é esta');
select t('geral registra a conclusão', :G, format($q$select public.registrar_situacao_agua(%L, 'concluida', 'Cisterna entregue e cheia na primeira chuva')$q$, :'fa'), 'ok');
select t('técnica e geral leem; bolsista NÃO lê', :BB, $q$do $x$ begin if exists (select 1 from public.agua_situacoes) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('técnica lê o histórico', :T, $q$do $x$ begin if not exists (select 1 from public.agua_situacoes) then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('quem registrou é o sistema que marca', :G, $q$do $x$ begin if exists (select 1 from public.agua_situacoes where registrado_por is null) then raise exception 'sem autor'; end if; end $x$ $q$, 'ok');
select t('ninguém altera um registro (nem a geral)', :G, $q$update public.agua_situacoes set obs = 'mudando o registro antigo'$q$, 'permission denied');
select t('ninguém apaga um registro (nem a geral)', :G, $q$delete from public.agua_situacoes$q$, 'permission denied');
select t('registro vai para o histórico', :G, $q$do $x$ begin if not exists (select 1 from public.auditoria where tabela = 'agua_situacoes') then raise exception 'sem histórico'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
