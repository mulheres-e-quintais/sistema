-- Auditoria 14/10/2026 — integridade do banco com a massa do tamanho do plano (supabase/tests/carga_1410).
-- Banco LOCAL de teste (NÃO é o Supabase; NÃO rodar em produção). Pré-requisito: carga_1410/montar.sh (00_funcoes + 01_massa).
-- ALTERA o banco (limpa a cadeia de um quintal do AL para montar cenários): rode numa CÓPIA, por exemplo:
--   sudo -u postgres createdb -T bdcarga1410_base bdcarga1410_int
--   sudo -u postgres psql -X -d bdcarga1410_int -f test_auditoria_1410_integridade.sql
-- Saída: n|PASSOU/FALHOU|caso|detalhe. Os casos marcados "ACHADO BD-n" descrevem o comportamento ESPERADO; FALHOU = achado confirmado.
\set QUIET on
\pset format unaligned
\pset tuples_only on
truncate carga.res restart identity;

create or replace function como(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); perform set_config('role', 'authenticated', true); end $$;
create or replace function como_dono() returns void language plpgsql as $$
begin perform set_config('role', 'none', true); end $$;
grant execute on function como(uuid), como_dono() to authenticated, anon;

select uid_de('cleone.lima@ifrn.edu.br') g, uid_de('tecnica@carga.invalid') tt, uid_de('articulacao1.al@carga.invalid') b,
       uid_de('agente1.al@carga.invalid') e, id_de('agente1.al@carga.invalid') e_id, uid_de('agente2.al@carga.invalid') e2 \gset
\set G '''' :g ''''
\set T '''' :tt ''''
\set B '''' :b ''''
\set E '''' :e ''''
\set E2 '''' :e2 ''''

-- ======================= A. a massa: consistência entre tabelas (dados gravados pelos perfis certos) =======================
select chk('A. 200 selecionadas aprovadas, 40 por estado', (select bool_and(n = 40) and sum(n) = 200 from (select count(*) n from public.fichas where resultado = 'selecionada' and situacao = 'aprovada' group by uf) x));
select chk('A. nenhum CPF de ficha repetido (e nenhum CPF de ficha igual ao de pessoa ativa da equipe)',
  not exists (select cpf from public.fichas group by cpf having count(*) > 1) and not exists (select 1 from public.fichas f join public.equipe e on e.cpf = f.cpf and e.status = 'ativa'));
select chk('A. um diagnóstico por ficha; diagnóstico só de ficha selecionada e aprovada',
  not exists (select ficha_id from public.diagnosticos group by 1 having count(*) > 1)
  and not exists (select 1 from public.diagnosticos d join public.fichas f on f.id = d.ficha_id where not (f.resultado = 'selecionada' and f.situacao = 'aprovada')));
select chk('A. no máximo uma visita não cancelada de diagnóstico/implantação/avaliação por ficha; 2 acompanhamentos; nenhum no mesmo dia',
  not exists (select 1 from public.visitas where situacao <> 'cancelada' group by ficha_id, etapa having count(*) > case when etapa = 'acompanhamento' then 2 else 1 end)
  and not exists (select 1 from public.visitas where etapa = 'acompanhamento' and situacao <> 'cancelada' group by ficha_id, coalesce(data_realizada, data_prevista) having count(*) > 1));
select chk('A. visita, diagnóstico e avaliação com o mesmo estado da ficha; quem fez a visita é do estado',
  not exists (select 1 from public.visitas v join public.fichas f on f.id = v.ficha_id join public.equipe e on e.id = v.executor_id where v.uf <> f.uf or e.uf <> f.uf)
  and not exists (select 1 from public.diagnosticos d join public.fichas f on f.id = d.ficha_id where d.uf <> f.uf)
  and not exists (select 1 from public.avaliacoes a join public.fichas f on f.id = a.ficha_id where a.uf <> f.uf));
select chk('A. diagnóstico/avaliação ligados à visita da etapa certa, da mesma ficha e com a mesma data e executor',
  not exists (select 1 from public.diagnosticos d join public.visitas v on v.id = d.visita_id where v.etapa <> 'diagnostico' or v.ficha_id <> d.ficha_id or v.data_realizada is distinct from d.data_visita or v.executor_id <> d.executor_id)
  and not exists (select 1 from public.avaliacoes a join public.visitas v on v.id = a.visita_id where v.etapa <> 'avaliacao' or v.ficha_id <> a.ficha_id or v.data_realizada is distinct from a.data_visita or v.executor_id <> a.executor_id));
select chk('A. visita feita de diagnóstico/avaliação sempre tem o formulário',
  not exists (select 1 from public.visitas v where v.situacao = 'realizada' and ((v.etapa = 'diagnostico' and not exists (select 1 from public.diagnosticos d where d.visita_id = v.id))
                                                                                or (v.etapa = 'avaliacao' and not exists (select 1 from public.avaliacoes a where a.visita_id = v.id)))));
select chk('A. implantação feita só com plano aprovado; acompanhamento/avaliação só depois da implantação, em data igual ou posterior',
  not exists (select 1 from public.visitas v where v.etapa = 'implantacao' and v.situacao = 'realizada' and not exists (select 1 from public.diagnosticos d where d.ficha_id = v.ficha_id and d.situacao = 'aprovado'))
  and not exists (select 1 from public.visitas v where v.etapa in ('acompanhamento','avaliacao') and v.situacao = 'realizada'
                   and not exists (select 1 from public.visitas i where i.ficha_id = v.ficha_id and i.etapa = 'implantacao' and i.situacao = 'realizada' and i.data_realizada <= v.data_realizada)));
select chk('A. todas as datas de visita dentro da vigência (14/09/2026 a 30/09/2027) e nenhuma visita feita no futuro',
  not exists (select 1 from public.visitas where data_prevista not between date '2026-09-14' and date '2027-09-30'
               or data_realizada not between date '2026-09-14' and least(date '2027-09-30', (now() at time zone 'America/Fortaleza')::date)));
select chk('A. no máximo 200 dias de campo (visitas não canceladas) por estado', not exists (select 1 from public.visitas where situacao <> 'cancelada' group by uf having count(*) > 200));
select chk('A. pedido de ajuda de custo: só visitas feitas, de quem pede, do mês do pedido; nenhuma visita em dois pedidos',
  not exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id join public.visitas v on v.id = sv.visita_id
               where v.executor_id <> s.equipe_id or v.situacao <> 'realizada' or date_trunc('month', v.data_realizada)::date <> s.mes));
select chk('A. uma bolsa por pessoa por mês', not exists (select 1 from public.solicitacoes_pagamento where tipo = 'bolsa' group by equipe_id, mes having count(*) > 1));
select chk('A. lista de espera: posição única por estado', not exists (select 1 from public.fichas where resultado = 'lista_espera' group by uf, posicao_espera having count(*) > 1));
select chk('A. toda alteração da massa ficou na auditoria (fichas, visitas, diagnósticos, avaliações, pedidos)',
  (select count(distinct registro_id) from public.auditoria where tabela in ('fichas','visitas','diagnosticos','avaliacoes','solicitacoes_pagamento'))
  = (select count(*) from public.fichas) + (select count(*) from public.visitas) + (select count(*) from public.diagnosticos) + (select count(*) from public.avaliacoes) + (select count(*) from public.solicitacoes_pagamento));

-- ======================= B. estrutura =======================
select chk('B. todas as chaves estrangeiras estão validadas', not exists (select 1 from pg_constraint where contype = 'f' and not convalidated and connamespace = 'public'::regnamespace),
  (select string_agg(conrelid::regclass || '.' || conname, ', ') from pg_constraint where contype = 'f' and not convalidated and connamespace = 'public'::regnamespace));
select chk('B. (informativo) travas CHECK criadas NOT VALID não foram conferidas nas linhas antigas', true,
  (select count(*) || ' travas NOT VALID: ' || string_agg(distinct conrelid::regclass::text, ', ') from pg_constraint where contype = 'c' and not convalidated and connamespace = 'public'::regnamespace));
select chk('B. nenhuma linha atual viola as travas NOT VALID das tabelas do campo (nome, relato, kit, família)',
  not exists (select 1 from public.fichas where length(nome) > 160 or length(endereco) > 300)
  and not exists (select 1 from public.visitas where length(relato) > 4000 or length(obs) > 2000 or uf not in ('AL','BA','PE','PI','SE'))
  and not exists (select 1 from public.diagnosticos where jsonb_typeof(dados -> 'kit') = 'array' and jsonb_array_length(dados -> 'kit') > 60));
select chk('B. colunas uuid de ligação sem chave estrangeira (lista para conferência)', true,
  (select string_agg(c.table_name || '.' || c.column_name, ', ' order by 1) from information_schema.columns c
    where c.table_schema = 'public' and c.data_type = 'uuid' and (c.column_name like '%\_id' or c.column_name like '%\_por' or c.column_name in ('por'))
      and not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
                      where k.contype = 'f' and k.conrelid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass and a.attname = c.column_name)
      and c.table_name in (select tablename from pg_tables where schemaname = 'public')));
select chk('B. índices únicos contra duplicidade: CPF da ficha, diagnóstico por ficha e por visita, avaliação por visita, etapa única, acompanhamento por dia, bolsa por mês',
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('fichas_cpf_unico','diagnosticos_ficha_id_key','diagnosticos_visita_id_key','avaliacoes_visita_id_key','visitas_etapa_unica','visitas_acompanhamento_dia','uma_por_mes')) = 7);
select chk('B. avaliação: uma por quintal na prática (índice único por visita + etapa única + visita com formulário não se cancela)',
  not exists (select ficha_id from public.avaliacoes group by 1 having count(*) > 1));

-- ======================= C. paginação da auditoria (tela "Histórico": 200 por vez, "carregar mais antigos" por em < último) =======================
-- BD-1 (corrigido na v271): a tela pagina por (em, id); o caso abaixo confere que assim nada some nos empates
do $$ declare be timestamptz := null; bi bigint := null; tot int := 0; n int; total int := (select count(*) from public.auditoria);
begin
  loop
    select count(*) into n from (select 1 from public.auditoria where be is null or (em, id) < (be, bi) order by em desc, id desc limit 200) x;
    exit when n = 0; tot := tot + n;
    select em, id into be, bi from (select em, id from public.auditoria where be is null or (em, id) < (be, bi) order by em desc, id desc limit 200) x order by em, id limit 1;
  end loop;
  perform chk('C. correção proposta: paginar por (em, id) traz todas as linhas', tot = total, format('lidas %s de %s', tot, total));
end $$;

select t('C. ACHADO BD-8: com ~22 mil linhas (5x a massa, ~ meses de uso), a página da auditoria (coord. geral, RLS ligada) usa o índice auditoria_em em vez de ler a tabela toda', null,
  format($q$do $x$ declare p text; begin perform como_dono();
           insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois) select tabela, registro_id, acao, por, em - interval '1 day' * k, antes, depois from public.auditoria, generate_series(1, 4) k;
           analyze public.auditoria; perform como(%L); execute 'explain (format json) select * from public.auditoria order by em desc limit 200' into p; perform como_dono();
           if strpos(p, '"Index Name": "auditoria_em"') = 0 then raise exception 'plano sem o índice (Seq Scan: %%)', strpos(p, 'Seq Scan') > 0; end if; end $x$$q$, :'g'), 'ok');

select t('C. correção proposta para BD-8: regra de leitura como (select meu_papel() = ''coord_geral'') faz o planejador usar o índice', null,
  format($q$do $x$ declare p text; begin perform como_dono();
           insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois) select tabela, registro_id, acao, por, em - interval '1 day' * k, antes, depois from public.auditoria, generate_series(1, 4) k;
           analyze public.auditoria; alter policy auditoria_ler on public.auditoria using ((select public.meu_papel() = 'coord_geral'));
           perform como(%L); execute 'explain (format json) select * from public.auditoria order by em desc limit 200' into p; perform como_dono();
           if strpos(p, '"Index Name": "auditoria_em"') = 0 then raise exception 'plano sem o índice'; end if; end $x$$q$, :'g'), 'ok');

-- ======================= D. regras com o banco cheio (cenários montados num quintal do AL) =======================
-- prepara: quintal AL nº 39 volta a "selecionada e aprovada, sem nada feito" (como dono, sem gatilhos: só para o cenário)
select v.ficha_id as fi, d.id as di, (select id from public.visitas where ficha_id = v.ficha_id and etapa = 'implantacao') as vimp,
       (select id from public.avaliacoes where ficha_id = v.ficha_id) as av
  from carga.visitas_plano v join public.diagnosticos d on d.ficha_id = v.ficha_id where v.uf = 'AL' and v.i = 0 and v.ordem = 1 \gset
select id as f39 from carga.fichas_plano where uf = 'AL' and i = 39 \gset
select id as f38 from carga.fichas_plano where uf = 'AL' and i = 38 \gset
select cpf as cpf_ba from public.fichas where uf = 'BA' order by cpf limit 1 \gset
do $$ declare f uuid := (select id from carga.fichas_plano where uf = 'AL' and i = 39); begin
  set local session_replication_role = replica;
  delete from public.solicitacao_visitas where visita_id in (select id from public.visitas where ficha_id = f);
  delete from public.avaliacoes where ficha_id = f; delete from public.diagnosticos where ficha_id = f; delete from public.visitas where ficha_id = f;
end $$;
-- a bolsista agenda o diagnóstico (de verdade)
select g('teste', :B, format($q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values ('d1410000-0000-4000-8000-000000000001', %L, 'AL', 'diagnostico', %L, date '2026-10-13')$q$, :'f39', :'e_id'));
select chk('D. cenário montado (visita de diagnóstico agendada no quintal AL 39)', exists (select 1 from public.visitas where id = 'd1410000-0000-4000-8000-000000000001'),
  (select string_agg(erro, '; ') from carga.erros where etapa = 'teste'));

\set DIAG 'insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, agua_seca, sem_agua, lote, dados) values (gen_random_uuid(), ''' :f39 ''', ''d1410000-0000-4000-8000-000000000001'', ''AL'', date ''2026-10-13'', -9.5, -37.5, ''sim'', false, 1, ''{}'')'
select t('D. controle: com a ficha aprovada, a agente registra o diagnóstico', :E, :'DIAG', 'ok');
select t('D. ficha devolvida pela coordenação técnica (visita de diagnóstico ainda agendada): diagnóstico recusado', null,
  format($q$do $x$ begin perform como(%L); update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o endereço da família' where id = %L;
           perform como(%L); %s; end $x$$q$, :'tt', :'f39', :'e', :'DIAG'), '');
select t('D. bolsista passa a ficha para a lista de espera com a visita agendada: recusado (ou o diagnóstico depois é recusado)', null,
  format($q$do $x$ begin perform como(%L); perform como_dono(); update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o endereço da família' where id = %L;
           perform como(%L); update public.fichas set resultado = 'lista_espera', posicao_espera = 99 where id = %L;
           perform como(%L); %s; end $x$$q$, :'tt', :'f39', :'b', :'f39', :'e', :'DIAG'), '');
select t('D. ACHADO BD-6: ficha com visita agendada não muda de "selecionada" para lista de espera (a visita ficaria órfã na agenda e nos 200 dias de campo)', null,
  format($q$do $x$ begin perform como_dono(); update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o endereço da família' where id = %L;
           perform como(%L); update public.fichas set resultado = 'lista_espera', posicao_espera = 99 where id = %L; end $x$$q$, :'f39', :'b', :'f39'), 'visita');
select t('D. diagnóstico com data antes da vigência (10/09/2026; ficha de 01/08/2026) é recusado', null,
  format($q$do $x$ begin perform como_dono(); update public.fichas set data_ficha = date '2026-08-01' where id = %L; perform como(%L); %s; end $x$$q$,
         :'f39', :'e', replace(:'DIAG', '2026-10-13', '2026-09-10')), 'vigência');
select t('D. diagnóstico com data no futuro é recusado', :E, replace(:'DIAG', '2026-10-13', '2026-10-20'), 'futuro');
select t('D. segundo diagnóstico do mesmo quintal (outra visita, outro id) é recusado com mensagem clara', :E,
  format($q$insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, agua_seca, sem_agua, lote) values (gen_random_uuid(), %L, (select id from public.visitas where ficha_id = %L and etapa = 'acompanhamento' limit 1), 'AL', date '2026-10-01', -9.5, -37.5, 'sim', false, 1)$q$, :'fi', :'fi'), 'já tem diagnóstico');
select t('D. ficha com CPF de outra ficha (outro estado) é recusada com mensagem clara', :B,
  format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
            values (gen_random_uuid(), 'AL', 'Município', 'Comunidade', 'Agricultora Repetida', %L, date '1980-01-01', 'Sítio', true, true, true, true, true, true, true, true, true, true, 'nao_atende', date '2026-10-13')$q$, :'cpf_ba'), 'já tem ficha');
select t('D. terceiro acompanhamento do mesmo quintal é recusado', :B,
  format($q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'AL', 'acompanhamento', %L, date '2026-11-20')$q$, :'fi', :'e_id'), 'acompanhamento');
select t('D. segunda implantação do mesmo quintal é recusada', :B,
  format($q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'AL', 'implantacao', %L, date '2026-11-20')$q$, :'fi', :'e_id'), 'já tem essa visita');
select t('D. segunda avaliação na mesma visita é recusada', :E,
  format($q$insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz) select gen_random_uuid(), ficha_id, visita_id, uf, data_visita, -9.5, -37.5, 'sim' from public.avaliacoes where id = %L$q$, :'av'), 'já tem avaliação');
select t('D. visita agendada fora da vigência (01/10/2027) é recusada', :B,
  format($q$update public.visitas set data_prevista = date '2027-10-01' where id = 'd1410000-0000-4000-8000-000000000001'$q$), 'vigência');
select t('D. coordenação técnica põe a implantação antes do diagnóstico: recusado', :T,
  format($q$update public.visitas set data_realizada = date '2026-09-15' where id = %L$q$, :'vimp'), 'anterior');
select t('D. avaliação corrigida para antes da implantação: recusada (desde o 63, a de visita em pedido de pagamento nem muda)', :E,
  format($q$update public.avaliacoes set data_visita = date '2026-09-20' where id = %L$q$, :'av'), 'solicitação de pagamento');
select t('D. ACHADO BD-2: coordenação técnica devolve o plano de um quintal JÁ IMPLANTADO: recusado', :T,
  format($q$update public.diagnosticos set situacao = 'devolvido', obs_coordenacao = 'Rever o kit, por favor' where id = %L$q$, :'di'), 'implant');
select t('D. ACHADO BD-2: coordenação geral altera o plano aprovado de quintal JÁ IMPLANTADO: o plano não pode voltar para "aguardando"', null,
  format($q$do $x$ begin perform como(%L); update public.diagnosticos set area_m2 = 77 where id = %L; perform como_dono();
           if (select situacao from public.diagnosticos where id = %L) <> 'aprovado' then raise exception 'plano do quintal implantado voltou para %%', (select situacao from public.diagnosticos where id = %L); end if; end $x$$q$, :'g', :'di', :'di', :'di'), 'ok');

-- E. versão do registro: a devolução com a marca do que foi lido é recusada (a tela, hoje, só manda a marca ao APROVAR)
select g('teste', :B, format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
  values ('d1410000-0000-4000-8000-0000000000f1', 'AL', 'Município', 'Comunidade', 'Agricultora Versão Teste', %L, date '1980-01-01', 'Sítio', false, true, true, true, true, true, true, true, true, true, 'nao_atende', date '2026-10-13')$q$, cpf_t(88800000001)));
select atualizado_em::text as m0 from public.fichas where id = 'd1410000-0000-4000-8000-0000000000f1' \gset
select g('teste', :B, $q$update public.fichas set endereco = 'Sítio corrigido pela bolsista' where id = 'd1410000-0000-4000-8000-0000000000f1'$q$);
select t('E. devolver COM a marca antiga (lida antes da correção da bolsista) é recusado', :T,
  format($q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o endereço', atualizado_em = %L where id = 'd1410000-0000-4000-8000-0000000000f1'$q$, :'m0'), 'alterado');
select t('E. devolver SEM marca (como a tela faz hoje em decidirFicha/decidirDiagnostico) passa por cima da correção (ver BD-5)', :T,
  $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o endereço' where id = 'd1410000-0000-4000-8000-0000000000f1'$q$, 'ok');

select n || '|' || case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || coalesce(det, '') from carga.res order by n;
select 'TOTAL|' || count(*) || ' casos, ' || count(*) filter (where ok) || ' passaram, ' || count(*) filter (where not ok) || ' falharam' from carga.res;
