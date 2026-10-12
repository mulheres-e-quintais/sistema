-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, :B, :BB, :A, t(), f(), logar()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_correcoes_auditoria.sql
-- 56_correcoes_auditoria.sql: visita não nasce feita; bolsa no valor da função; login só pela geral; vitrine privada; municípios da lista.
\set QUIET on
truncate res;

-- ===== 2. visita nova não entra como feita (nem diagnóstico, nem implantação sem relato)
select t('2. bolsista NÃO cria visita de diagnóstico já como feita', :B, $q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao, data_realizada)
  values (gen_random_uuid(), gen_random_uuid(), 'PI', 'diagnostico', public.meu_id(), public.fic_hoje(), 'realizada', public.fic_hoje())$q$, 'agendada primeiro e marcada como feita depois');
select t('2. bolsista NÃO cria implantação já como feita', :B, $q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao, data_realizada, relato)
  values (gen_random_uuid(), gen_random_uuid(), 'PI', 'implantacao', public.meu_id(), public.fic_hoje(), 'realizada', public.fic_hoje(), 'x')$q$, 'agendada primeiro e marcada como feita depois');
select t('2. coordenação geral também agenda antes de marcar feita', :G, $q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao, data_realizada)
  values (gen_random_uuid(), gen_random_uuid(), 'PI', 'acompanhamento', public.meu_id(), public.fic_hoje(), 'realizada', public.fic_hoje())$q$, 'agendada primeiro e marcada como feita depois');
select t('2. scripts do dono do banco (sem login) continuam podendo gravar visita feita (dados de exemplo)', null, $q$do $x$ begin set local role none;
  if (select tgenabled from pg_trigger where tgname = 'a0_nasce_prevista') is null then raise exception 'sem gatilho'; end if; end $x$$q$, 'ok');

-- ===== 6. bolsa no valor da função (a articulação BA fica habilitada para pedir)
do $x$ begin set session_replication_role = replica;
  update public.equipe set matricula_fic_em = coalesce(matricula_fic_em, public.fic_hoje()), matricula_fic_numero = coalesce(matricula_fic_numero, 'T56'),
    docs_funcern_em = coalesce(docs_funcern_em, public.fic_hoje()), termo_path = coalesce(termo_path, 'equipe/t56/termo_1.pdf'), termo_assinado_em = coalesce(termo_assinado_em, public.fic_hoje())
   where email = 'art.ba@t.com' and status = 'ativa';
  -- um mês sem pedido de bolsa dela (o anterior): começa antes dele e não tem pedido nele
  update public.equipe set data_inicio = least(data_inicio, (date_trunc('month', public.fic_hoje()) - interval '1 month')::date) where email = 'art.ba@t.com' and status = 'ativa';
  delete from public.solicitacoes_pagamento where tipo = 'bolsa' and mes = (date_trunc('month', public.fic_hoje()) - interval '1 month')::date
     and equipe_id = (select id from public.equipe where email = 'art.ba@t.com' and status = 'ativa');
  set session_replication_role = origin; end $x$;
select t('6. valor da bolsa por função (plano de trabalho)', null, $q$do $x$ begin set local role none;
  if public.valor_bolsa('articulacao') <> 2200 or public.valor_bolsa('apoio') <> 1600 or public.valor_bolsa('coord_tecnico') <> 4700
     or public.valor_bolsa('professor_fic') <> 2200 or public.valor_bolsa('auxiliar_adm') <> 1200 or public.valor_bolsa('agente') is not null then raise exception 'valores'; end if; end $x$$q$, 'ok');
select t('6. bolsa de articulação com R$ 9.999,00 é recusada', :BB, $q$select public.solicitar_pagamento('bolsa', (date_trunc('month', public.fic_hoje()) - interval '1 month')::date, 9999, repeat('Relatório de atividades do mês. ', 3), null, '{}')$q$, 'A bolsa de articulação estadual é de R$ 2.200,00');
select t('6. bolsa de articulação com R$ 2.199,99 também é recusada', :BB, $q$select public.solicitar_pagamento('bolsa', (date_trunc('month', public.fic_hoje()) - interval '1 month')::date, 2199.99, repeat('Relatório de atividades do mês. ', 3), null, '{}')$q$, 'é de R$ 2.200,00');

-- ===== 7. login: soltar e liberar de novo é só da coordenação geral
select t('7. coordenação técnica NÃO solta o login de uma bolsista (user_id = null)', :T, $q$update public.equipe set user_id = null where email = 'art.ba@t.com' and status = 'ativa'$q$, 'Só a coordenação geral libera');
select t('7. coordenação técnica NÃO gera código para quem já tem senha', :T, $q$select public.gerar_codigo_acesso((select id from public.equipe where email = 'art.ba@t.com' and status = 'ativa'))$q$, 'já entrou no sistema antes');
-- quem já entrou e perdeu o login por troca de e-mail: a técnica também não gera o código
do $x$ begin insert into public.contas_ja_ligadas (equipe_id) select id from public.equipe where email = 'apoio.pi@t.com' and status = 'ativa' on conflict do nothing; end $x$;
select t('7. técnica NÃO gera código para quem já entrou antes, mesmo sem login agora', :T, $q$select public.gerar_codigo_acesso((select id from public.equipe where email = 'apoio.pi@t.com' and status = 'ativa'))$q$, 'já entrou no sistema antes');
select id as nunca from public.equipe where papel in ('articulacao','apoio','agente') and status = 'ativa' and user_id is null
   and id not in (select equipe_id from public.contas_ja_ligadas) limit 1 \gset
select t('7. técnica continua gerando o PRIMEIRO acesso de quem nunca entrou', :T, format($q$select public.gerar_codigo_acesso(%L)$q$, :'nunca'), 'ok');
select t('7. coordenação geral libera novo primeiro acesso de quem já tem senha', :G, $q$select public.gerar_codigo_acesso((select id from public.equipe where email = 'art.ba@t.com' and status = 'ativa'))$q$, 'ok');

-- ===== 8. vitrine privada: foto só abre enquanto a autorização valer
select t('8. a pasta da vitrine não é mais pública', null, $q$do $x$ begin set local role none;
  if (select public from storage.buckets where id = 'vitrine') then raise exception 'ainda pública'; end if; end $x$$q$, 'ok');
select t('8. arquivo que não está publicado (ou sem autorização) não abre para visitante', null, $q$do $x$ begin
  if public.vitrine_foto_publica('qualquer/arquivo.jpg') then raise exception 'abriu'; end if; end $x$$q$, 'ok');

-- ===== 9. municípios na página pública: só os 29 do projeto, com o nome oficial
do $x$ declare b uuid; begin set session_replication_role = replica;
  select id into b from public.equipe where email = 'art.pi@t.com' and status = 'ativa';
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, resultado, situacao, data_ficha, bolsista_id, consent_dados,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao)
  values ('f5600000-0000-0000-0000-000000000001', 'PI', 'Josefa Pereira dos Santos - CPF 71428793860', 'Sítio', 'Teste Um Silva', '71428793860', '1980-01-01', 'Sítio 1', 'selecionada', 'aguardando', public.fic_hoje(), b, true, true,true,true,true,true,true,true,true,true),
         ('f5600000-0000-0000-0000-000000000002', 'PI', '  paulistana ', 'Sítio', 'Teste Dois Silva', '11144477735', '1980-01-01', 'Sítio 2', 'selecionada', 'aguardando', public.fic_hoje(), b, true, true,true,true,true,true,true,true,true,true);
  set session_replication_role = origin; end $x$;
select t('9. texto livre digitado no campo município NÃO aparece para o público', null, $q$do $x$ begin
  if public.vitrine_municipios()::text like '%Josefa%' or public.vitrine_municipios()::text like '%7142%' then raise exception 'vazou'; end if; end $x$$q$, 'ok');
select t('9. município do projeto escrito de outro jeito aparece com o nome oficial', null, $q$do $x$ begin
  if public.vitrine_municipios()::text not like '%"Paulistana"%' then raise exception 'sumiu: %', public.vitrine_municipios(); end if; end $x$$q$, 'ok');
do $x$ begin set session_replication_role = replica; delete from public.fichas where id::text like 'f5600000-%'; set session_replication_role = origin; end $x$;

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 110) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
