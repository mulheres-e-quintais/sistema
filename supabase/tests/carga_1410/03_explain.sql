-- carga_1410 / 03: EXPLAIN ANALYZE das consultas mais pesadas com a massa cheia, COMO os perfis (RLS ligada).
-- Banco LOCAL de teste. As funções (acompanhamento_*) são abertas com auto_explain (planos das consultas de dentro).
-- Uso: sudo -u postgres psql -X -d <banco> -f 03_explain.sql > explain.txt
\pset pager off
select uid as g from carga.pessoas where papel = 'coord_geral' \gset
select uid as b from carga.pessoas where email = 'articulacao1.pe@carga.invalid' \gset
select uid as a from carga.pessoas where email = 'agente1.pe@carga.invalid' \gset
select (select count(*) from public.auditoria) auditoria, (select count(*) from public.fichas) fichas, (select count(*) from public.visitas) visitas;

\echo '=== 1. coordenação geral: lista de fichas (1ª parte de 1000 + total, como o PostgREST com count=exact)'
begin; select set_config('request.jwt.claim.sub', :'g', true); set local role authenticated;
explain (analyze, buffers, timing off, summary on) select (select count(*) from public.fichas), * from public.fichas order by criado_em desc, id limit 1000;
rollback;
\echo '=== 2. coordenação geral: lista de visitas'
begin; select set_config('request.jwt.claim.sub', :'g', true); set local role authenticated;
explain (analyze, buffers, timing off, summary on) select * from public.visitas order by data_prevista, id limit 1000;
rollback;
\echo '=== 3. bolsista (PE): lista de visitas (RLS por estado)'
begin; select set_config('request.jwt.claim.sub', :'b', true); set local role authenticated;
explain (analyze, buffers, timing off, summary on) select * from public.visitas order by data_prevista, id limit 1000;
rollback;
\echo '=== 4. agente (PE): fichas dos quintais que visita (RLS minhas_fichas) e diagnósticos (RLS com EXISTS)'
begin; select set_config('request.jwt.claim.sub', :'a', true); set local role authenticated;
explain (analyze, buffers, timing off, summary on) select * from public.fichas order by criado_em desc, id limit 1000;
explain (analyze, buffers, timing off, summary on) select * from public.diagnosticos order by data_visita desc, id limit 1000;
rollback;
\echo '=== 5. auditoria: 1ª página e página antiga (em < x) como coordenação geral'
select em::text as antes from public.auditoria order by em desc offset 4000 limit 1 \gset
begin; select set_config('request.jwt.claim.sub', :'g', true); set local role authenticated;
explain (analyze, buffers, timing off, summary on) select * from public.auditoria order by em desc limit 200;
explain (analyze, buffers, timing off, summary on) select * from public.auditoria where em < :'antes' order by em desc limit 200;
explain (analyze, buffers, timing off, summary on) select * from public.auditoria where registro_id = (select id from public.fichas limit 1) order by em desc;
rollback;
\echo '=== 6. gravar visita (UPDATE com todos os gatilhos) e gravar ficha (INSERT): tempo por gatilho'
select v.id as vid, p.uid as vu from public.visitas v join carga.pessoas p on p.equipe_id = v.executor_id where v.uf = 'PE' and v.etapa = 'acompanhamento' limit 1 \gset
begin; select set_config('request.jwt.claim.sub', :'vu', true); set local role authenticated;
explain (analyze, buffers, summary on) update public.visitas set relato = 'Relato do explain com mais de vinte letras' where id = :'vid';
rollback;
begin; select set_config('request.jwt.claim.sub', :'b', true); set local role authenticated;
explain (analyze, buffers, summary on) insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
  values (gen_random_uuid(), 'PE', 'Município', 'Comunidade', 'Agricultora Explain', public.cpf_t(81234567890), date '1980-01-01', 'Sítio', false, true, true, true, true, true, true, true, true, true, 'nao_atende', date '2026-10-13');
rollback;
\echo '=== 7. acompanhamento_dados / acompanhamento_equipe_uf (auto_explain das consultas de dentro, só as > 5 ms)'
load 'auto_explain';
set auto_explain.log_min_duration = 5; set auto_explain.log_analyze = on; set auto_explain.log_nested_statements = on; set auto_explain.log_timing = off;
set auto_explain.log_buffers = on; set client_min_messages = log;
begin; select set_config('request.jwt.claim.sub', :'g', true); set local role authenticated;
select length(public.acompanhamento_dados('mda')::text) tamanho_json;
select length(public.acompanhamento_equipe_uf('mda')::text) tamanho_json;
rollback;
