-- Auditoria de 14/10/2026: REGRAS DE NEGÓCIO, RASTREABILIDADE E INDICADORES (banco).
-- Autocontido: monta a própria equipe e uma massa sintética (com casos de borda), confere as regras do servidor
-- e compara vitrine(), acompanhamento_dados() e uma contagem SQL independente. Tudo é desfeito no fim (rollback).
-- Rodar num banco montado com todas as etapas (bash /tmp/montar_db.sh <db>), SEM a suíte de equipe antes:
--   sudo -u postgres psql -X -q -d <db> -f supabase/tests/test_auditoria_1410_indicadores.sql
-- Saída: uma linha por caso "PASSOU|caso|detalhe" ou "FALHOU|caso|detalhe" e, no fim, "SNAPSHOT|{json}" (dados sem
-- exemplo + o que as funções devolvem), lido por testes/unit/auditoria_1410_regras.test.js quando AUD_DB está definido.
-- Casos marcados [ACHADO] descrevem o comportamento ESPERADO pela regra escrita (tela/plano); se FALHOU, é divergência.
\set QUIET on
\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP 0
begin;
alter table auth.users add column if not exists raw_user_meta_data jsonb;
create table aud_res (n serial, caso text, ok boolean, det text);
grant all on aud_res to authenticated, anon; grant usage on sequence aud_res_n_seq to authenticated, anon;

create function aud_cpf(n bigint) returns text language sql immutable as $f$
  with a as (select substr(lpad(n::text, 11, '0'), 1, 3) || substr(lpad(n::text, 11, '0'), 6, 6) as b),
       b as (select b || ((((select sum(substr(b, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10) % 11) % 10)::text as c from a)
  select c || ((((select sum(substr(c, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10) % 11) % 10)::text from b
$f$;
-- executa como um usuário e desfaz; compara com 'ok' ou com um trecho do erro
create function aud_t(caso text, quem uuid, cmd text, espera text) returns void language plpgsql as $$
declare msg text := 'ok';
begin
  begin
    perform set_config('request.jwt.claim.sub', coalesce(quem::text, ''), true);
    perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
    execute cmd;
    perform set_config('role', 'none', true);
    raise exception 'ROLLBACK_OK';
  exception when others then msg := case when sqlerrm = 'ROLLBACK_OK' then 'ok' else sqlerrm end;
  end;
  perform set_config('role', 'none', true); perform set_config('request.jwt.claim.sub', '', true);
  insert into aud_res(caso, ok, det) values (caso, case when espera = 'ok' then msg = 'ok' else msg <> 'ok' and msg ilike '%' || espera || '%' end, msg);
end $$;
-- igual, mas grava
create function aud_f(quem uuid, cmd text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(quem::text, ''), true);
  perform set_config('role', 'authenticated', true);
  execute cmd;
  perform set_config('role', 'none', true); perform set_config('request.jwt.claim.sub', '', true);
end $$;
create function aud_ok(caso text, ok boolean, det text default '') returns void language sql as $$ insert into aud_res(caso, ok, det) values (caso, coalesce(ok, false), coalesce(det, 'nulo')) $$;
create function aud_logar(p_email text) returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  alter table auth.users disable trigger user;
  insert into auth.users(id, email) values (u, p_email);
  alter table auth.users enable trigger user;
  update public.equipe set user_id = u where email = p_email and status = 'ativa';
  return u;
end $$;
-- pessoa habilitada (carga do dono do banco: sem login, as travas de papel não se aplicam)
create function aud_pessoa(p_papel text, p_uf text, p_nome text, p_n bigint) returns uuid language plpgsql as $$
declare i uuid;
begin
  insert into public.equipe(papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd, matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_path, termo_assinado_em)
  values (p_papel, p_uf, p_nome, aud_cpf(p_n), 'aud' || p_n || '@t.com', '(84) 99999-0000', '2026-10-01', true,
          case when p_papel in ('professor_fic', 'auxiliar_adm') then null else date '2026-10-02' end,
          case when p_papel in ('professor_fic', 'auxiliar_adm') then null else 'M' || p_n end, '2026-10-02', 'x/termo_' || p_n || '.pdf', '2026-10-02')
  returning id into i;
  return i;
end $$;
-- ficha (carga): selecionada e aprovada por padrão
create function aud_ficha(p_uf text, p_n bigint, p_res text default 'selecionada', p_aprova boolean default true, p_mun text default 'Picos',
                          p_nome text default null, p_end text default null) returns uuid language plpgsql as $$
declare i uuid := gen_random_uuid(); ok boolean := p_res in ('selecionada', 'lista_espera');
begin
  insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade,
    c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, posicao_espera, encaminhada_para, data_ficha, pessoas_familia, p_sustento)
  values (i, p_uf, p_mun, 'Sítio Aud', coalesce(p_nome, 'Maria Auditoria ' || p_n), aud_cpf(p_n), '1980-05-05', coalesce(p_end, 'Rua Aud ' || p_n), true, true, true,
    p_res <> 'sem_agua', true, true, true, true, ok, true, p_res, case when p_res = 'lista_espera' then (p_n % 900)::int + 1 end,
    case when p_res = 'sem_agua' then 'Programa Cisternas' end, '2026-09-14', 4, p_n % 2 = 0);
  if p_aprova then update public.fichas set situacao = 'aprovada' where id = i; end if;
  return i;
end $$;
create function aud_visita(p_ficha uuid, p_etapa text, p_exec uuid, p_data date) returns uuid language plpgsql as $$
declare i uuid := gen_random_uuid();
begin
  insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (i, p_ficha, (select uf from public.fichas where id = p_ficha), p_etapa, p_exec, p_data);
  return i;
end $$;
-- diagnóstico completo (visita + formulário); aprovado opcional
create function aud_diag(p_ficha uuid, p_exec uuid, p_data date, p_sit text default 'aprovado', p_sem_agua boolean default false) returns uuid language plpgsql as $$
declare v uuid := aud_visita(p_ficha, 'diagnostico', p_exec, p_data); d uuid := gen_random_uuid();
begin
  insert into public.diagnosticos(id, ficha_id, visita_id, uf, data_visita, agua_seca, sem_agua, lote, latitude, longitude, area_m2, dados, fotos)
  values (d, p_ficha, v, (select uf from public.fichas where id = p_ficha), p_data, case when p_sem_agua then 'nao' else 'sim' end, p_sem_agua,
          case when p_sem_agua then null else 1 end, -7.08, -41.47, 100, '{}'::jsonb, '{}'::text[]);
  if p_sit <> 'aguardando' then update public.diagnosticos set situacao = p_sit, obs_coordenacao = 'Conferido pela auditoria.' where id = d; end if;
  return d;
end $$;
-- visita marcada como feita (relato e foto)
create function aud_feita(p_ficha uuid, p_etapa text, p_exec uuid, p_data date) returns uuid language plpgsql as $$
declare v uuid := aud_visita(p_ficha, p_etapa, p_exec, p_data);
begin
  update public.visitas set situacao = 'realizada', data_realizada = p_data, relato = 'Visita da auditoria com relato suficiente.', fotos = array['x/foto.jpg'] where id = v;
  return v;
end $$;
create function aud_avaliacao(p_ficha uuid, p_exec uuid, p_data date) returns uuid language plpgsql as $$
declare v uuid := aud_visita(p_ficha, 'avaliacao', p_exec, p_data); a uuid := gen_random_uuid();
begin
  insert into public.avaliacoes(id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz, ebia_nivel, dados)
  values (a, p_ficha, v, (select uf from public.fichas where id = p_ficha), p_data, -7.08, -41.47, 'sim', 'leve', '{}'::jsonb);
  return a;
end $$;

-- ===================== equipe =====================
select aud_pessoa('professor_fic', null, 'Prof Auditoria Um', 70000000001) as prof \gset
select aud_pessoa('coord_tecnico', null, 'Tecnica Auditoria Silva', 70000000002) as ct \gset
select aud_pessoa('articulacao', 'PI', 'Bia Auditoria Piaui', 70000000003) as bpi \gset
select aud_pessoa('articulacao', 'BA', 'Dora Auditoria Bahia', 70000000004) as bba \gset
select aud_pessoa('articulacao', 'AL', 'Lia Auditoria Alagoas', 70000000005) as bal \gset
select aud_pessoa('apoio', 'PI', 'Cris Apoio Piaui', 70000000006) as api \gset
select aud_pessoa('agente', 'PI', 'Gil Agente Piaui', 70000000007) as agpi \gset
select aud_logar('cleone.lima@ifrn.edu.br') as ucg \gset
select aud_logar('aud70000000002@t.com') as uct \gset
select aud_logar('aud70000000003@t.com') as ubpi \gset
select aud_logar('aud70000000004@t.com') as ubba \gset
select aud_logar('aud70000000005@t.com') as ubal \gset
select aud_logar('aud70000000007@t.com') as uagpi \gset
\set CG '''' :ucg ''''
\set CT '''' :uct ''''
\set BPI '''' :ubpi ''''
\set BBA '''' :ubba ''''
\set BAL '''' :ubal ''''
\set AGPI '''' :uagpi ''''

-- ===================== massa sintética (PI e BA) =====================
-- PI: 10 selecionadas aprovadas. Situações:
--  q1 completo (diag aprovado, implantação, 2 acompanhamentos, avaliação)  q2 diag aprovado + implantação + 1 acomp
--  q3 diag aguardando  q4 diag devolvido  q5 diag SEM ÁGUA aprovado (encaminhado)  q6 diag aprovado sem implantação
--  q7 diag aprovado + implantação cancelada  q8 só diagnóstico agendado  q9 nada  q10 diag aprovado + implantação; depois o plano é devolvido
select aud_ficha('PI', 81000000001) as q1 \gset
select aud_ficha('PI', 81000000002) as q2 \gset
select aud_ficha('PI', 81000000003) as q3 \gset
select aud_ficha('PI', 81000000004) as q4 \gset
select aud_ficha('PI', 81000000005) as q5 \gset
select aud_ficha('PI', 81000000006) as q6 \gset
select aud_ficha('PI', 81000000007) as q7 \gset
select aud_ficha('PI', 81000000008, 'selecionada', true, 'Picos ') as q8 \gset
select aud_ficha('PI', 81000000009, 'selecionada', true, 'PICOS') as q9 \gset
select aud_ficha('PI', 81000000010, 'selecionada', true, 'Oeiras') as q10 \gset
select aud_ficha('PI', 81000000011, 'lista_espera') as qe \gset
select aud_ficha('PI', 81000000012, 'sem_agua') as qs \gset
select aud_ficha('PI', 81000000013, 'nao_atende') as qn \gset
select aud_ficha('PI', 81000000014, 'selecionada', false) as qag \gset
select aud_diag(:'q1', :'bpi', '2026-09-20') \gset d1_
select aud_feita(:'q1', 'implantacao', :'bpi', '2026-09-25') \gset
select aud_feita(:'q1', 'acompanhamento', :'agpi', '2026-10-01') \gset
select aud_feita(:'q1', 'acompanhamento', :'agpi', '2026-10-05') \gset
select aud_avaliacao(:'q1', :'bpi', '2026-10-10') \gset
select aud_diag(:'q2', :'bpi', '2026-09-21') \gset
select aud_feita(:'q2', 'implantacao', :'bpi', '2026-09-26') \gset
select aud_feita(:'q2', 'acompanhamento', :'bpi', '2026-10-02') \gset
select aud_visita(:'q2', 'acompanhamento', :'agpi', '2026-10-30') \gset
select aud_diag(:'q3', :'bpi', '2026-09-22', 'aguardando') \gset
select aud_diag(:'q4', :'bpi', '2026-09-22', 'devolvido') \gset
select aud_diag(:'q5', :'bpi', '2026-09-23', 'aprovado', true) \gset
select aud_diag(:'q6', :'bpi', '2026-09-23') \gset
select aud_diag(:'q7', :'bpi', '2026-09-24') \gset
select aud_visita(:'q7', 'implantacao', :'bpi', '2026-10-20') as v7i \gset
update public.visitas set situacao = 'cancelada' where id = :'v7i';
select aud_visita(:'q8', 'diagnostico', :'bpi', '2026-10-01') \gset
select aud_diag(:'q10', :'bpi', '2026-09-24') as d10 \gset
select aud_feita(:'q10', 'implantacao', :'bpi', '2026-09-28') \gset
-- BA: 2 selecionadas; uma implantada
select aud_ficha('BA', 82000000001, 'selecionada', true, 'Itiúba') as b1 \gset
select aud_ficha('BA', 82000000002, 'selecionada', true, 'Itiuba') as b2 \gset
select aud_diag(:'b1', :'bba', '2026-09-22') \gset
select aud_feita(:'b1', 'implantacao', :'bba', '2026-09-30') \gset
-- FIC: 1 turma, 2 matrículas (1 cancelada), 2 encontros (1 cancelado)
insert into public.turmas_fic(id, nome, professor_id, inicio) values (gen_random_uuid(), 'Turma Auditoria PI', :'prof', '2026-10-01') returning id as tu \gset
insert into public.matriculas_fic(turma_id, equipe_id, numero, matriculado_em) values (:'tu', :'bpi', 'MA1', '2026-10-02'), (:'tu', :'api', 'MA2', '2026-10-02');
update public.matriculas_fic set cancelada_em = now(), motivo_cancelamento = 'teste auditoria' where numero = 'MA2';
insert into public.fic_encontros(turma_id, professor_id, data, carga_horaria, modalidade, conteudo) values
  (:'tu', :'prof', '2026-10-05', 4, 'presencial', 'Conteúdo do encontro um da auditoria'), (:'tu', :'prof', '2026-10-06', 4, 'presencial', 'Conteúdo do encontro dois da auditoria');
update public.fic_encontros set cancelado_em = now(), motivo_cancelamento = 'duplicado na auditoria' where data = '2026-10-06';
-- exemplo: uma ficha de exemplo completa (anotada) e uma visita criada DEPOIS nela sem anotação (o testador usou a ficha de exemplo)
select aud_ficha('PI', 89000000001) as qx \gset
select aud_diag(:'qx', :'bpi', '2026-09-20') as dx \gset
insert into public.exemplo(tabela, id) select 'fichas', :'qx'::uuid union all select 'diagnosticos', :'dx'::uuid
  union all select 'visitas', id from public.visitas where ficha_id = :'qx';
select aud_feita(:'qx', 'implantacao', :'bpi', '2026-09-27') as vxi \gset
-- carga feita? (se a massa não montou, os números abaixo não valem)
select aud_ok('massa sintética montada (5 implantações feitas = 3 PI + 1 BA + 1 na ficha de exemplo)',
  (select count(*) from public.visitas where etapa = 'implantacao' and situacao = 'realizada') = 5,
  (select count(*)::text from public.visitas where etapa = 'implantacao' and situacao = 'realizada'));

-- ===================== REGRAS: identificação e duplicidade =====================
select aud_t('REG ficha: mesmo CPF em outro estado é recusado (BA tenta CPF de ficha do PI)', :BBA,
  format($q$insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
   values (gen_random_uuid(), 'BA', 'Itiúba', 'Sítio X', 'Maria Outra Pessoa', %L, '1980-05-05', 'Rua B', true, true, true, true, true, true, true, true, true, true, 'selecionada', '2026-10-01')$q$, aud_cpf(81000000001)), 'já tem ficha');
select aud_t('REG ficha: nome igual e mesma data de nascimento, CPF diferente, NÃO bloqueia', :BPI,
  format($q$insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
   values (gen_random_uuid(), 'PI', 'Picos', 'Sítio Aud', 'Maria Auditoria 81000000001', %L, '1980-05-05', 'Rua Outra 9', true, true, true, true, true, true, true, true, true, true, 'selecionada', '2026-10-01')$q$, aud_cpf(81000000099)), 'ok');
select aud_t('REG ficha: mesmo endereço (mesma casa), CPF diferente, não bloqueia no banco (aviso na tela)', :BPI,
  format($q$insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
   values (gen_random_uuid(), 'PI', 'Picos', 'Sítio Aud', 'Joana Vizinha Souza', %L, '1975-01-01', 'Rua Aud 81000000001', true, true, true, true, true, true, true, true, true, true, 'selecionada', '2026-10-01')$q$, aud_cpf(81000000098)), 'ok');
select aud_t('REG ficha: CPF de pessoa ativa da equipe é recusado', :BPI,
  format($q$insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
   values (gen_random_uuid(), 'PI', 'Picos', 'Sítio Aud', 'Gil Agente Piaui', %L, '1980-05-05', 'Rua C', true, true, true, true, true, true, true, true, true, true, 'selecionada', '2026-10-01')$q$, aud_cpf(70000000007)), 'equipe');
select aud_t('REG ficha: CPF de ficha "não atende" também bloqueia nova ficha (unicidade é global)', :BPI,
  format($q$insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
   values (gen_random_uuid(), 'PI', 'Picos', 'Sítio Aud', 'Maria Auditoria Nova', %L, '1980-05-05', 'Rua D', true, true, true, true, true, true, true, true, true, true, 'selecionada', '2026-10-01')$q$, aud_cpf(81000000013)), 'já tem ficha');
select aud_t('REG ficha: selecionada sem todos os critérios é recusada', :BPI,
  format($q$insert into public.fichas(id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
   values (gen_random_uuid(), 'PI', 'Picos', 'Sítio Aud', 'Maria Sem Criterio', %L, '1980-05-05', 'Rua E', true, true, true, false, true, true, true, true, true, true, 'selecionada', '2026-10-01')$q$, aud_cpf(81000000097)), 'critérios');
-- 40 selecionadas aprovadas por estado: AL com 40 e a 41ª pela coordenação técnica
do $$ declare i int; begin for i in 1..40 loop perform aud_ficha('AL', 83000000000 + i, 'selecionada', true, 'Arapiraca'); end loop; end $$;
select aud_ficha('AL', 83000000041, 'selecionada', false, 'Arapiraca') as al41 \gset
select aud_t('REG seleção: 41ª selecionada aprovada no estado é recusada (coordenação técnica)', :CT,
  format($q$update public.fichas set situacao = 'aprovada' where id = %L$q$, :'al41'), '40 selecionadas');
select aud_t('REG seleção: 41ª selecionada aprovada no estado é recusada (coordenação geral)', :CG,
  format($q$update public.fichas set situacao = 'aprovada' where id = %L$q$, :'al41'), '40 selecionadas');

-- ===================== REGRAS: diagnóstico, plano, implantação =====================
select aud_t('REG diagnóstico: segundo diagnóstico do mesmo quintal é recusado', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'diagnostico', %L, current_date + 1)$q$, :'q1', :'bpi'), 'já tem essa visita');
select aud_t('REG implantação: sem plano aprovado (aguardando) é recusada', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'implantacao', %L, current_date + 1)$q$, :'q3', :'bpi'), 'não foi aprovado');
select aud_t('REG implantação: plano devolvido é recusada', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'implantacao', %L, current_date + 1)$q$, :'q4', :'bpi'), 'não foi aprovado');
select aud_t('REG implantação: quintal sem água (encaminhado) não recebe implantação', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'implantacao', %L, current_date + 1)$q$, :'q5', :'bpi'), 'sem água');
select aud_t('REG implantação: segunda implantação do mesmo quintal é recusada', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'implantacao', %L, current_date + 1)$q$, :'q1', :'bpi'), 'já tem essa visita');
select aud_t('REG implantação: depois de cancelada, pode agendar outra (só uma não cancelada)', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'implantacao', %L, current_date + 1)$q$, :'q7', :'bpi'), 'ok');
select aud_t('REG visita: nasce agendada (logado não grava visita já "realizada")', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato) values (gen_random_uuid(), %L, 'PI', 'implantacao', %L, current_date, current_date, 'realizada', 'relato com mais de vinte letras ok')$q$, :'q6', :'bpi'), 'agendada primeiro');
select aud_visita(:'q6', 'implantacao', :'bpi', '2026-10-13') as v6i \gset
select aud_t('REG implantação: marcar feita sem relato é recusado', :BPI,
  format($q$update public.visitas set situacao = 'realizada', data_realizada = '2026-10-13', relato = 'curto' where id = %L$q$, :'v6i'), '20 letras');
select aud_t('REG implantação (63): marcar feita sem foto é recusado (como na tela)', :BPI,
  format($q$update public.visitas set situacao = 'realizada', data_realizada = '2026-10-13', relato = 'Relato com mais de vinte letras certinho', fotos = '{}' where id = %L$q$, :'v6i'), 'foto');
select aud_t('REG implantação: data antes do diagnóstico é recusada', :BPI,
  format($q$update public.visitas set situacao = 'realizada', data_realizada = '2026-09-15', relato = 'Relato com mais de vinte letras certinho', fotos = '{x}' where id = %L$q$, :'v6i'), 'anterior');
select aud_t('REG visita: fora da vigência (01/10/2027) é recusada', :BPI,
  format($q$update public.visitas set data_prevista = '2027-10-01' where id = %L$q$, :'v6i'), 'vigência');
-- implantação feita e depois o plano devolvido: o quintal continua contando como implantado
select aud_t('REG plano (63): a coordenação técnica NÃO devolve o plano de quintal já implantado', :CT,
  format($q$update public.diagnosticos set situacao = 'devolvido', obs_coordenacao = 'devolvido depois da implantação' where id = %L$q$, :'d10'), 'já foi implantado');

-- ===================== REGRAS: acompanhamento (2 por quintal = 400) =====================
select aud_t('REG acompanhamento: terceiro acompanhamento do quintal é recusado', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'acompanhamento', %L, current_date + 3)$q$, :'q1', :'bpi'), '2 visitas de acompanhamento');
select aud_t('REG acompanhamento: antes da implantação é recusado', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'acompanhamento', %L, current_date + 3)$q$, :'q6', :'bpi'), 'depois da implantação');
select aud_t('REG acompanhamento: dois no mesmo dia do mesmo quintal são recusados', :BBA,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'BA', 'acompanhamento', %L, '2026-10-30'); insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'BA', 'acompanhamento', %L, '2026-10-30')$q$, :'b1', :'bba', :'b1', :'bba'), 'acompanhamento_dia');
select aud_t('REG visita: executor de outro estado é recusado', :CT,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'acompanhamento', %L, current_date + 3)$q$, :'q2', :'bba'), 'mesmo estado');
select aud_t('REG visita: agente não cancela visita', :AGPI,
  format($q$do $x$ declare n int; begin update public.visitas set situacao = 'cancelada' where ficha_id = %L and etapa = 'acompanhamento' and situacao = 'prevista'; get diagnostics n = row_count; if n = 0 then raise exception 'nenhuma visita alcançada'; end if; end $x$$q$, :'q2'), 'não reagenda nem cancela');

-- ===================== REGRAS: avaliação final =====================
select aud_t('REG avaliação: segunda avaliação do quintal é recusada', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'avaliacao', %L, current_date + 1)$q$, :'q1', :'bpi'), 'já tem essa visita');
select aud_t('REG avaliação: antes da implantação é recusada', :BPI,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'PI', 'avaliacao', %L, current_date + 1)$q$, :'q6', :'bpi'), 'depois da implantação');
select aud_t('REG avaliação: visita com avaliação registrada não se cancela', :CT,
  format($q$update public.visitas set situacao = 'cancelada' where ficha_id = %L and etapa = 'avaliacao'$q$, :'q1'), 'não pode ser cancelada');

-- ===================== REGRAS: 200 dias de campo por estado (40 quintais × 5) =====================
do $$ declare f record; i int := 0; ex uuid := (select id from public.equipe where email = 'aud70000000005@t.com'); d date;
begin
  for f in select id from public.fichas where uf = 'AL' and situacao = 'aprovada' order by cpf loop
    i := i + 1;
    perform aud_diag(f.id, ex, date '2026-09-15');
    perform aud_feita(f.id, 'implantacao', ex, date '2026-09-20');
    perform aud_visita(f.id, 'acompanhamento', ex, date '2026-10-20');
    perform aud_visita(f.id, 'acompanhamento', ex, date '2026-11-20');
    perform aud_visita(f.id, 'avaliacao', ex, date '2026-12-20');
  end loop;
end $$;
select aud_ok('carga AL: 200 visitas não canceladas', (select count(*) from public.visitas where uf = 'AL' and situacao <> 'cancelada') = 200,
  (select count(*)::text from public.visitas where uf = 'AL' and situacao <> 'cancelada'));
update public.fichas set situacao = 'aprovada' where id = :'al41';   -- dono do banco passa da trava das 40 (SQL Editor)
select aud_ok('[DÚVIDA] trava das 40 selecionadas vale só para quem está logado: o dono do banco aprova a 41ª',
  (select count(*) from public.fichas where uf = 'AL' and resultado = 'selecionada' and situacao = 'aprovada') = 41, 'comportamento atual: 41');
select aud_t('REG dias de campo: 201ª visita no estado é recusada', :BAL,
  format($q$insert into public.visitas(id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), %L, 'AL', 'diagnostico', %L, current_date + 1)$q$, :'al41', :'bal'), '200 dias');

-- ===================== INDICADORES =====================
-- contagem independente (sem exemplo; por quintal distinto)
create temp table aud_ind as
with ex as (select id from public.exemplo),
     f as (select * from public.fichas where id not in (select id from ex))
select u.uf,
  (select count(*) from f where f.uf = u.uf) fichas,
  (select count(*) from f where f.uf = u.uf and resultado = 'selecionada' and situacao = 'aprovada') selecionadas,
  (select count(*) from public.diagnosticos d join f on f.id = d.ficha_id where d.uf = u.uf and d.id not in (select id from ex)) diagnosticos,
  (select count(*) from public.diagnosticos d join f on f.id = d.ficha_id where d.uf = u.uf and d.situacao = 'aprovado' and d.id not in (select id from ex)) diag_aprovados,
  (select count(*) from public.diagnosticos d join f on f.id = d.ficha_id where d.uf = u.uf and d.situacao = 'aprovado' and not d.sem_agua and d.id not in (select id from ex)) planos_com_agua,
  (select count(distinct v.ficha_id) from public.visitas v join f on f.id = v.ficha_id where v.uf = u.uf and v.etapa = 'implantacao' and v.situacao = 'realizada') implantados,
  (select count(*) from public.visitas v join f on f.id = v.ficha_id where v.uf = u.uf and v.etapa = 'acompanhamento' and v.situacao = 'realizada') acompanhamentos,
  (select count(*) from public.avaliacoes a join f on f.id = a.ficha_id where a.uf = u.uf) avaliacoes
from (values ('AL'), ('BA'), ('PE'), ('PI'), ('SE')) u(uf);
select set_config('request.jwt.claim.sub', :'ucg', false);
create temp table aud_fn as select public.vitrine() vit, public.acompanhamento_dados('mda') mda, public.acompanhamento_dados('mpa') mpa, public.acompanhamento_formacao('mpa') form;   -- 61: a tela do MPA usa acompanhamento_formacao
select set_config('request.jwt.claim.sub', '', false);
create temp view aud_v as select (u->>'uf') uf, u from aud_fn, jsonb_array_elements(vit->'por_uf') u;
create temp view aud_a as select (u->>'uf') uf, u from aud_fn, jsonb_array_elements(mda->'por_uf') u;

select aud_ok('IND fichas: vitrine = contagem independente (sem exemplo)', bool_and((v.u->>'fichas')::int = i.fichas), string_agg(i.uf || ':' || (v.u->>'fichas') || '/' || i.fichas, ' ')) from aud_ind i join aud_v v using (uf);
select aud_ok('IND selecionadas: vitrine = acompanhamento = independente', bool_and((v.u->>'selecionadas')::int = i.selecionadas and (a.u->>'selecionadas')::int = i.selecionadas), string_agg(i.uf || ':' || (v.u->>'selecionadas') || '/' || (a.u->>'selecionadas') || '/' || i.selecionadas, ' ')) from aud_ind i join aud_v v using (uf) join aud_a a using (uf);
select aud_ok('IND diagnósticos (M2): vitrine = acompanhamento = independente (inclui aguardando, devolvido e sem água)', bool_and((v.u->>'diagnosticos')::int = i.diagnosticos and (a.u->>'diagnosticos')::int = i.diagnosticos), string_agg(i.uf || ':' || (v.u->>'diagnosticos') || '/' || (a.u->>'diagnosticos') || '/' || i.diagnosticos, ' ')) from aud_ind i join aud_v v using (uf) join aud_a a using (uf);
select aud_ok('IND diagnósticos PI: 8 registrados, mas só 6 aprovados (M2 conta aguardando, devolvido e sem água; desde o 63 o plano implantado não volta)', i.diagnosticos = 8 and i.diag_aprovados = 6, i.diagnosticos || ' registrados, ' || i.diag_aprovados || ' aprovados') from aud_ind i where uf = 'PI';
select aud_ok('IND "planos" (63): vitrine pública e MDA deveriam mostrar o mesmo número (mesma chave "planos")', bool_and((v.u->>'planos') = (a.u->>'planos')), string_agg(uf || ': vitrine ' || (v.u->>'planos') || ' × MDA ' || (a.u->>'planos'), ' ')) from aud_v v join aud_a a using (uf);
select aud_ok('IND implantados (M3): acompanhamento = quintais distintos com implantação feita (sem exemplo)', bool_and((a.u->>'implantados')::int = i.implantados), string_agg(i.uf || ':' || (a.u->>'implantados') || '/' || i.implantados, ' ')) from aud_ind i join aud_a a using (uf);
select aud_ok('IND implantados (63): vitrine pública = quintais distintos com implantação feita (sem exemplo)', bool_and((v.u->>'implantados')::int = i.implantados), string_agg(i.uf || ': vitrine ' || (v.u->>'implantados') || ' × indep ' || i.implantados, ' ')) from aud_ind i join aud_v v using (uf);
select aud_ok('IND implantados: implantação cancelada não conta e só há 1 implantação não cancelada por quintal', not exists (select 1 from public.visitas where etapa = 'implantacao' and situacao <> 'cancelada' group by ficha_id having count(*) > 1), '');
select aud_ok('IND acompanhamentos (M4): vitrine = acompanhamento = independente', bool_and((v.u->>'acompanhamentos')::int = i.acompanhamentos and (a.u->>'acompanhamentos')::int = i.acompanhamentos), string_agg(i.uf || ':' || (v.u->>'acompanhamentos') || '/' || (a.u->>'acompanhamentos') || '/' || i.acompanhamentos, ' ')) from aud_ind i join aud_v v using (uf) join aud_a a using (uf);
select aud_ok('IND acompanhamentos: nenhum quintal com mais de 2 acompanhamentos feitos (400 = 200 × 2)', not exists (select 1 from public.visitas where etapa = 'acompanhamento' and situacao = 'realizada' group by ficha_id having count(*) > 2), '');
select aud_ok('IND avaliações: acompanhamento = independente', bool_and((a.u->>'avaliacoes')::int = i.avaliacoes), string_agg(i.uf || ':' || (a.u->>'avaliacoes') || '/' || i.avaliacoes, ' ')) from aud_ind i join aud_a a using (uf);
select aud_ok('IND mensal: soma por mês = visitas feitas por estado (MDA)', (select sum((m->>'diagnostico')::int + (m->>'implantacao')::int + (m->>'acompanhamento')::int + (m->>'avaliacao')::int) from aud_fn, jsonb_array_elements(mda->'mensal') m)
  = (select sum((u->>'visitas_feitas')::int) from aud_a), '');
select aud_ok('IND municípios: soma dos implantados por município = implantados por estado', (select sum((m->>'implantados')::int) from aud_fn, jsonb_array_elements(mda->'municipios') m) = (select sum((u->>'implantados')::int) from aud_a),
  (select sum((m->>'implantados')::int) from aud_fn, jsonb_array_elements(mda->'municipios') m)::text || ' × ' || (select sum((u->>'implantados')::int) from aud_a)::text);
select aud_ok('IND municípios: "Picos", "Picos " e "PICOS" contam como 1 município; "Itiúba" e "Itiuba" também', (a.u->>'municipios')::int = 2 and (select (u->>'municipios')::int from aud_a where uf = 'BA') = 1, 'PI ' || (a.u->>'municipios')) from aud_a a where uf = 'PI';
select aud_ok('IND atrasadas: diagnóstico previsto no passado conta como atrasado no PI', (a.u->>'atrasadas')::int >= 1, a.u->>'atrasadas') from aud_a a where uf = 'PI';
select aud_ok('IND plano devolvido depois da implantação: o quintal segue em "implantados" (comportamento atual)', (select (u->>'implantados')::int from aud_a where uf = 'PI') = 3, (select u->>'implantados' from aud_a where uf = 'PI'));
select aud_ok('IND formação (MPA, 61): matrículas sem a cancelada, como a tela', (select (form->>'matriculas')::int from aud_fn) = (select count(*) from public.matriculas_fic where cancelada_em is null and id not in (select id from public.exemplo)),
  'SQL ' || (select form->>'matriculas' from aud_fn) || ' × ativas ' || (select count(*) from public.matriculas_fic where cancelada_em is null));
select aud_ok('IND formação (MPA, 61): encontros sem o cancelado, como a tela', (select (form->>'encontros')::int from aud_fn) = (select count(*) from public.fic_encontros where cancelado_em is null and id not in (select id from public.exemplo)),
  'SQL ' || (select form->>'encontros' from aud_fn) || ' × válidos ' || (select count(*) from public.fic_encontros where cancelado_em is null));
select aud_ok('IND exemplo: ficha de exemplo fora da vitrine e do MDA', (select sum((u->>'fichas')::int) from aud_v) = (select count(*) from public.fichas where id not in (select id from public.exemplo)), '');
select aud_ok('IND exemplo (63): visita nova em ficha de exemplo deveria ficar fora da vitrine (como fica no MDA)', (select (u->>'implantados')::int from aud_v where uf = 'PI') = (select (u->>'implantados')::int from aud_a where uf = 'PI'),
  'vitrine PI ' || (select u->>'implantados' from aud_v where uf = 'PI') || ' × MDA PI ' || (select u->>'implantados' from aud_a where uf = 'PI'));
select aud_ok('IND perfil MDA: base = selecionadas aprovadas (sem exemplo)', (select (mda->'perfil'->>'base')::int from aud_fn) = (select sum(selecionadas) from aud_ind), '');
select aud_ok('IND perfil MDA: contagem de 1 a 4 sai como "menos de 5" (-1)', (select (mda->'impacto'->'produz'->>'sim')::int from aud_fn) = -1, (select mda->'impacto'->'produz'->>'sim' from aud_fn));

-- ===================== resultado =====================
select case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || left(replace(coalesce(det, ''), E'\n', ' '), 220) from aud_res order by n;
select 'TOTAL|' || count(*) || '|passou ' || count(*) filter (where ok) || '|falhou ' || count(*) filter (where not ok) from aud_res;
-- foto do banco para a comparação com a conta da tela (js/acompanhamento.js calcular)
select 'SNAPSHOT|' || jsonb_build_object(
  'fichas', (select coalesce(jsonb_agg(to_jsonb(x) - 'cpf' - 'nome' - 'endereco'), '[]') from public.fichas x where id not in (select id from public.exemplo)),
  'visitas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ficha_id', ficha_id, 'uf', uf, 'etapa', etapa, 'situacao', situacao, 'data_prevista', data_prevista, 'data_realizada', data_realizada)), '[]') from public.visitas x where ficha_id not in (select id from public.exemplo)),
  'diagnosticos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ficha_id', ficha_id, 'uf', uf, 'situacao', situacao, 'sem_agua', sem_agua, 'area_m2', area_m2, 'renda_quintal', renda_quintal)), '[]') from public.diagnosticos x where ficha_id not in (select id from public.exemplo)),
  'avaliacoes', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ficha_id', ficha_id, 'uf', uf, 'quintal_produz', quintal_produz, 'ebia_nivel', ebia_nivel)), '[]') from public.avaliacoes x where ficha_id not in (select id from public.exemplo)),
  'equipe', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'papel', papel, 'uf', uf, 'status', status, 'matricula_fic_em', matricula_fic_em, 'docs_funcern_em', docs_funcern_em, 'termo_assinado_em', termo_assinado_em)), '[]') from public.equipe x where id not in (select id from public.exemplo)),
  'turmas', (select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]') from public.turmas_fic),
  'matriculas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cancelada_em', cancelada_em)), '[]') from public.matriculas_fic),
  'encontros', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cancelado_em', cancelado_em)), '[]') from public.fic_encontros),
  'hoje', (now() at time zone 'America/Fortaleza')::date,
  'sql_mda', (select mda from aud_fn), 'sql_mpa', (select mpa || jsonb_build_object('formacao', form) from aud_fn),   -- 61: a tela do MPA troca a formação pela acompanhamento_formacao
  'sql_vitrine', (select vit - 'fotos' from aud_fn))::text;
rollback;
