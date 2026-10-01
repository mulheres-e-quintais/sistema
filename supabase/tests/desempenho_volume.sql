-- Desempenho com o volume do FIM do projeto (roda num banco de TESTE, depois da suíte; não use em produção).
-- 600 fichas, 1.200 visitas, 300 diagnósticos, 800 pagamentos, 60.000 registros de histórico.
-- Mede as consultas que a tela faz, com a segurança por linha ligada, para cada perfil. Limite: 300 ms cada.
\set QUIET on
\pset tuples_only on
\pset format unaligned
set session_replication_role = replica;
do $v$
declare i int; k int; ufs text[] := array['AL','BA','PE','PI','SE']; uf text; fid uuid; vid uuid; ex uuid; pes uuid[];
begin
  select array_agg(id) into pes from public.equipe where papel <> 'coord_geral';
  for i in 1..600 loop
    fid := gen_random_uuid(); uf := ufs[1 + i % 5];
    insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit,
                               c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao)
    values (fid, uf, 'Município ' || (i % 60), 'Comunidade ' || (i % 23), 'Mulher Volume ' || i, lpad((90000000000 + i * 7919)::text, 11, '0'), '1980-01-01', 'Sítio ' || i,
            true, true, true, true, true, true, true, true, true, true, case when i % 3 = 0 then 'lista_espera' else 'selecionada' end, current_date - (i % 90), 'aprovada');
    if i <= 300 then
      select id into ex from public.equipe where equipe.uf = ufs[1 + i % 5] and papel in ('articulacao','apoio','agente') limit 1;
      ex := coalesce(ex, pes[1]);
      for k in 1..4 loop
        vid := gen_random_uuid();
        insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao)
        values (vid, fid, uf, (array['diagnostico','implantacao','acompanhamento','avaliacao'])[k], ex, current_date - 60 + k * 15,
                case when k <= 2 then current_date - 60 + k * 15 end, case when k <= 2 then 'realizada' else 'prevista' end);
        if k = 1 then
          insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, agua_seca, lote, situacao, dados, latitude, longitude)
          values (gen_random_uuid(), fid, vid, uf, ex, current_date - 45, 'sim', 1 + i % 2, 'aprovado', '{"kit": [{"item": "Tela", "qtd": "5", "valor": 400}]}', -5.6, -37.8);
        end if;
      end loop;
    end if;
  end loop;
  for i in 1..800 loop
    insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, situacao)
    values ('bolsa', pes[1 + i % array_length(pes, 1)], (date '2020-01-01' + (i || ' months')::interval)::date, 1400, 'lancada') on conflict do nothing;
  end loop;
  insert into public.auditoria (tabela, acao, em) select 'fichas', 'UPDATE', now() - (g || ' minutes')::interval from generate_series(1, 60000) g;
end $v$;
set session_replication_role = origin;
analyze;
select 'volume', (select count(*) from public.fichas), (select count(*) from public.visitas), (select count(*) from public.diagnosticos), (select count(*) from public.solicitacoes_pagamento), (select count(*) from public.auditoria);

create temp table medidas (perfil text, consulta text, linhas int, ms numeric);
grant all on medidas to authenticated, anon;
create or replace function pg_temp.medir(perfil text, quem uuid, consulta text, sqltxt text) returns void language plpgsql as $$
declare t0 timestamptz; ms numeric; melhor numeric := 1e9; r int; n int;
begin
  for r in 1..3 loop   -- a melhor de 3 (a primeira aquece o cache)
    perform set_config('request.jwt.claim.sub', coalesce(quem::text, ''), true);
    perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
    t0 := clock_timestamp(); execute 'select count(*) from (select to_jsonb(x)::text t from (' || sqltxt || ') x) y where length(t) > 0' into n; ms := extract(epoch from clock_timestamp() - t0) * 1000;
    perform set_config('role', 'none', true);
    melhor := least(melhor, ms);
  end loop;
  insert into medidas values (perfil, consulta, n, round(melhor, 1));
end $$;
select u.id as g from auth.users u join public.equipe e on e.user_id = u.id where e.papel = 'coord_geral' and e.status = 'ativa' limit 1 \gset
select u.id as bol from auth.users u join public.equipe e on e.user_id = u.id where e.papel in ('articulacao','apoio') and e.status = 'ativa' limit 1 \gset
select u.id as tec from auth.users u join public.equipe e on e.user_id = u.id where e.papel = 'coord_tecnico' and e.status = 'ativa' limit 1 \gset
begin;
select pg_temp.medir(p, q, c, s) from (values
  ('coord_geral', :'g'::uuid, 'fichas (tela Seleção)', 'select * from public.fichas order by criado_em desc'),
  ('coord_geral', :'g'::uuid, 'visitas (tela Campo)', 'select * from public.visitas order by data_prevista'),
  ('coord_geral', :'g'::uuid, 'diagnósticos', 'select * from public.diagnosticos order by data_visita desc'),
  ('coord_geral', :'g'::uuid, 'pagamentos', 'select * from public.solicitacoes_pagamento order by solicitada_em desc'),
  ('coord_geral', :'g'::uuid, 'histórico (200 últimos)', 'select * from public.auditoria order by em desc limit 200'),
  ('coord_geral', :'g'::uuid, 'equipe', 'select * from public.equipe order by criado_em'),
  ('coord_tecnico', :'tec'::uuid, 'fichas', 'select * from public.fichas order by criado_em desc'),
  ('coord_tecnico', :'tec'::uuid, 'visitas', 'select * from public.visitas order by data_prevista'),
  ('bolsista', :'bol'::uuid, 'fichas do estado', 'select * from public.fichas order by criado_em desc'),
  ('bolsista', :'bol'::uuid, 'visitas do estado', 'select * from public.visitas order by data_prevista'),
  ('bolsista', :'bol'::uuid, 'diagnósticos do estado', 'select * from public.diagnosticos'),
  ('bolsista', :'bol'::uuid, 'meus pagamentos', 'select * from public.solicitacoes_pagamento'),
  ('público', null::uuid, 'números da vitrine', 'select public.vitrine()'),
  ('público', null::uuid, 'mapa por município', 'select public.vitrine_municipios()')
) v(p, q, c, s);
commit;
\pset tuples_only off
\pset format aligned
select perfil, consulta, linhas, ms, case when ms <= 300 then 'PASSOU' else 'FALHOU' end as r from medidas order by ms desc;
select count(*) filter (where ms <= 300) passou, count(*) filter (where ms > 300) falhou, max(ms) pior_ms from medidas;
