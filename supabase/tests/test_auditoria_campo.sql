-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, :X, :A, t(), f(), logar(), ins()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_auditoria_campo.sql
-- 61_auditoria_campo.sql: termo conferido é o arquivo aberto; bolsa depois da saída; acompanhamento duplicado;
-- agente escalada lê o plano; fotos de visita feita ficam; fila do celular com data absurda; vitrine aberta.
\set QUIET on
truncate res;
grant select, insert on storage.objects to authenticated;  -- no Supabase de verdade essa permissão já existe; o stub local não tem
select f(:T, ins('agente','BA','Tito Termo Sessenta',cpf_t(61000000001),'ag61@t.com'));
select logar('ag61@t.com') \gset t61_
\set T61 '''' :t61_logar ''''
select id as ag61 from public.equipe where email = 'ag61@t.com' \gset
\set P1 'equipe/' :ag61 '/termo_1759400000001.pdf'
\set P2 'equipe/' :ag61 '/termo_1759400000002.pdf'

-- ===== 1. termo: a conferência vale só para o arquivo que foi aberto
select f(:T61, format($q$select public.enviar_meu_termo(%L)$q$, :'P1'));
select f(:T61, format($q$select public.enviar_meu_termo(%L)$q$, :'P2'));   -- trocou depois que o auxiliar abriu o primeiro
select t('61. auxiliar confere o termo_1, mas a pessoa já trocou pelo termo_2: recusado', :X,
  format($q$select public.conferir_termo(%L, %L, public.fic_hoje())$q$, :'ag61', :'P1'), 'trocado enquanto você conferia');
select t('61. ... e a data não foi gravada', null, format($q$do $x$ begin set local role none;
  if (select termo_assinado_em from public.equipe where id = %L) is not null then raise exception 'gravou'; end if; end $x$$q$, :'ag61'), 'ok');
select t('61. auxiliar confere o arquivo que está anexado: aceito', :X,
  format($q$select public.conferir_termo(%L, %L, public.fic_hoje())$q$, :'ag61', :'P2'), 'ok');
select f(:X, format($q$select public.conferir_termo(%L, %L, public.fic_hoje())$q$, :'ag61', :'P2'));
select t('61. depois de conferido, a pessoa não troca o arquivo', :T61, format($q$select public.enviar_meu_termo(%L)$q$, :'P1'), 'já foi conferido');
select t('61. a própria pessoa não confere o termo pela função nova (as travas de sempre valem)', :T61,
  format($q$select public.conferir_termo(%L, %L, date '2026-10-01')$q$, :'ag61', :'P2'), 'permissão');
select t('61. bolsista não confere termo de outra pessoa', :BB, format($q$select public.conferir_termo(%L, %L, date '2026-10-01')$q$, :'ag61', :'P2'), 'permissão');
select t('61. quem não entrou não chega à função', null, format($q$select public.conferir_termo(%L, %L, public.fic_hoje())$q$, :'ag61', :'P2'), 'permission denied');

-- ===== 2. bolsa de mês depois do desligamento
do $x$ declare e uuid := gen_random_uuid(); begin set session_replication_role = replica;
  insert into public.equipe (id, papel, uf, nome, cpf, email, status, data_inicio, data_fim, motivo_desligamento, consentimento_lgpd)
    values (e, 'apoio', 'PI', 'Dora Desligada Sessenta', cpf_t(61000000002), 'dora61@t.com', 'desligada', date '2026-09-15', date '2026-10-05', 'Teste', true);
  insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, relatorio, situacao)
    values ('f6100000-0000-0000-0000-0000000000b1', 'bolsa', e, date '2026-11-01', 1600, repeat('Relatório do mês de teste. ', 3), 'solicitada'),
           ('f6100000-0000-0000-0000-0000000000b2', 'bolsa', e, date '2026-10-01', 1600, repeat('Relatório do mês de teste. ', 3), 'solicitada');
  set session_replication_role = origin; end $x$;
select t('61. bolsa de novembro de quem saiu em 05/10: aval recusado', null, $q$do $x$ begin set local role none;
  update public.solicitacoes_pagamento set situacao = 'avalizada', valor_avalizado = 1600 where id = 'f6100000-0000-0000-0000-0000000000b1'; end $x$$q$, 'não pode ser paga');
select t('61. bolsa do mês da saída (outubro) continua podendo receber aval', null, $q$do $x$ begin set local role none;
  update public.solicitacoes_pagamento set situacao = 'avalizada', valor_avalizado = 1600 where id = 'f6100000-0000-0000-0000-0000000000b2'; end $x$$q$, 'ok');

-- ===== 3. acompanhamento duplicado no mesmo dia
select t('61. o índice contra acompanhamento repetido no mesmo dia existe', null, $q$do $x$ begin set local role none;
  if to_regclass('public.visitas_acompanhamento_dia') is null then raise exception 'sem índice'; end if; end $x$$q$, 'ok');
select t('61. dois acompanhamentos do mesmo quintal no mesmo dia: o segundo não entra', null, $q$do $x$ declare fi uuid := gen_random_uuid(); begin set local role none; set local session_replication_role = replica;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao) values (gen_random_uuid(), fi, 'PI', 'acompanhamento', gen_random_uuid(), date '2027-02-10', 'prevista');
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao) values (gen_random_uuid(), fi, 'PI', 'acompanhamento', gen_random_uuid(), date '2027-02-10', 'prevista'); end $x$$q$, 'duplicate key');
select t('61. acompanhamentos do mesmo quintal em dias diferentes entram', null, $q$do $x$ declare fi uuid := gen_random_uuid(); begin set local role none; set local session_replication_role = replica;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao) values (gen_random_uuid(), fi, 'PI', 'acompanhamento', gen_random_uuid(), date '2027-02-10', 'prevista');
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao) values (gen_random_uuid(), fi, 'PI', 'acompanhamento', gen_random_uuid(), date '2027-04-10', 'prevista'); end $x$$q$, 'ok');

-- ===== 4. agente escalada lê o diagnóstico do quintal
do $x$ declare fi uuid := 'f6100000-0000-0000-0000-0000000000f1'; ag uuid := (select id from public.equipe where email = 'ag1@t.com' and status = 'ativa'); begin
  set session_replication_role = replica;
  insert into public.diagnosticos (id, ficha_id, uf, visita_id, data_visita, situacao, executor_id, agua_seca, lote, sem_gps_motivo) values ('f6100000-0000-0000-0000-0000000000d1', fi, 'PI', gen_random_uuid(), date '2026-10-10', 'aprovado', gen_random_uuid(), 'sim', 1, 'Teste sem GPS no quintal da família') on conflict (id) do nothing;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao) values ('f6100000-0000-0000-0000-0000000000e1', fi, 'PI', 'implantacao', ag, date '2027-01-20', 'prevista') on conflict (id) do nothing;
  set session_replication_role = origin; end $x$;
select t('61. a agente escalada para a implantação lê o diagnóstico feito por outra pessoa', :A, $q$do $x$ begin
  if not exists (select 1 from public.diagnosticos where id = 'f6100000-0000-0000-0000-0000000000d1') then raise exception 'não leu'; end if; end $x$$q$, 'ok');
select t('61. agente sem visita naquele quintal continua sem ler', :T61, $q$do $x$ begin
  if exists (select 1 from public.diagnosticos where id = 'f6100000-0000-0000-0000-0000000000d1') then raise exception 'leu'; end if; end $x$$q$, 'ok');

-- ===== 5. fotos de visita feita não são apagadas por quem fez
do $x$ begin set session_replication_role = replica;
  update public.visitas set situacao = 'realizada', data_realizada = date '2026-10-12', fotos = array['PI/f/visita_1.jpg', 'PI/f/visita_2.jpg'], relato = 'Visita feita no quintal com a família.'
   where id = 'f6100000-0000-0000-0000-0000000000e1';
  set session_replication_role = origin; end $x$;
select t('61. a agente não apaga foto de visita já feita', :A, $q$update public.visitas set fotos = array['PI/f/visita_1.jpg'] where id = 'f6100000-0000-0000-0000-0000000000e1'$q$, 'não podem ser apagadas');
select t('61. a coordenação corrige (tira a foto errada)', :G, $q$update public.visitas set fotos = array['PI/f/visita_1.jpg'] where id = 'f6100000-0000-0000-0000-0000000000e1'$q$, 'ok');

-- ===== 6. relatos com trava; 7. fila do celular com data absurda
select t('61. o limite de relatos por dia tem trava contra envio simultâneo', null, $q$do $x$ begin set local role none;
  if not exists (select 1 from pg_trigger where tgname = 'a_relatos_limite_dia' and not tgisinternal) then raise exception 'sem trava'; end if; end $x$$q$, 'ok');
select t('61. fila do celular: "desde 1900" vira o começo de 2026', :A, $q$do $x$ begin perform public.informar_fila(2, 0, timestamptz '1900-01-01'); set local role none;
  if (select mais_antigo from public.fila_celular f join public.equipe e on e.id = f.equipe_id where e.email = 'ag1@t.com') < timestamptz '2026-01-01 00:00-03' then raise exception 'ficou em 1900'; end if; end $x$$q$, 'ok');
select t('61. fila do celular: "-infinito" também', :A, $q$do $x$ begin perform public.informar_fila(1, 0, '-infinity'); set local role none;
  if (select mais_antigo from public.fila_celular f join public.equipe e on e.id = f.equipe_id where e.email = 'ag1@t.com') = '-infinity' then raise exception 'ficou infinito'; end if; end $x$$q$, 'ok');
select t('61. quem não entrou continua vendo as fotos da vitrine', null, $q$do $x$ begin set local role none;
  if not has_function_privilege('anon', 'public.vitrine_foto_publica(text)', 'EXECUTE') then raise exception 'fechou'; end if; end $x$$q$, 'ok');

-- 67 (18/10/2026): matriculadas = pessoas ativas com matrícula registrada, a mesma conta da coordenação (cancelar apaga matricula_fic_em)
select t('61. formação do MPA: a coordenação vê a prévia, com as matriculadas contadas como na coordenação', :G, $q$do $x$ declare r jsonb := public.acompanhamento_formacao('mpa'); begin set local role none;
  if (r ->> 'matriculas')::int <> (select count(*) from public.equipe x where x.status = 'ativa' and x.papel in ('coord_tecnico','articulacao','apoio','agente') and x.matricula_fic_em is not null and x.id not in (select public.exemplo_fora())) then raise exception 'conta diferente da coordenação'; end if; end $x$$q$, 'ok');
select t('61. formação do MPA: bolsista não vê', :BB, $q$select public.acompanhamento_formacao('mpa')$q$, 'Acesso restrito');
select n || '|' || case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || coalesce(det, '') from res order by n;
-- (18/10/2026) limpeza: o cenário das seções 4 e 5 foi montado sem checagem de vínculo (réplica), com uma ficha que não existe.
-- Sem apagar, o diagnóstico e a visita órfãos ficavam no banco e desencontravam as contagens dos testes seguintes.
do $x$ begin set session_replication_role = replica;
  delete from public.visitas where id = 'f6100000-0000-0000-0000-0000000000e1';
  delete from public.diagnosticos where id = 'f6100000-0000-0000-0000-0000000000d1';
  set session_replication_role = origin; end $x$;

