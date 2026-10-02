-- roda depois do test_regras_decididas.sql (usa :G, :T, :BB, :X, :B, t(), f(), logar(), cpf_t())
-- e ANTES do test_conferencia_auxiliar.sql (que desliga a coordenação técnica e o auxiliar)
-- 47_auditoria_bd.sql: correções da auditoria do banco (itens A a K do cabeçalho do script).
-- Cada regra tem: o que passa a ser recusado, o que continua aceito e o registro ANTIGO (gravado sem os gatilhos, como
-- estava antes da regra) que precisa continuar podendo ser aprovado, devolvido e corrigido.
-- As corridas de verdade (duas sessões ao mesmo tempo) estão em concorrencia_bd.sh; aqui fica o que uma sessão só confere.
\set QUIET on
truncate res;
select set_config('t.bb', :BB, false);

-- troca de pessoa no meio de um caso (vazio = dono do banco, como no SQL Editor)
create or replace function b47_como(u uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  if u is not null then perform set_config('role', 'authenticated', true); end if;
end $$;
-- ficha mínima (texto do insert): número, CPF, colunas e valores a mais
create or replace function b47_fi(p_n int, p_cpf text, p_cols text default '', p_vals text default '', p_res text default 'selecionada') returns text language sql as $$
  select format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha%s)
    values (('f4710000-0000-0000-0000-0000000001' || lpad(%s::text, 2, '0'))::uuid, 'BA', 'Juazeiro', 'Lagoa do Banco', 'Maria Banco Nova ' || %s, %L, '1980-01-01', 'Sítio novo',
    true,true,true,true,true,true,true,true,true,true, %L, public.fic_hoje()%s)$q$, p_cols, p_n, p_n, p_cpf, p_res, p_vals) $$;

-- ===== cenário (como dono do banco, sem os gatilhos) =====
do $x$ declare b public.equipe; tec uuid; hoje date := (now() at time zone 'America/Fortaleza')::date; i int; t text;
  a1 uuid := 'f4700000-0000-0000-0000-000000000001'; a2 uuid := 'f4700000-0000-0000-0000-000000000002'; a3 uuid := 'f4700000-0000-0000-0000-000000000003';
begin
  select * into b from public.equipe where user_id = current_setting('t.bb')::uuid;
  select id into tec from public.equipe where papel = 'coord_tecnico' and status = 'ativa';
  foreach t in array array['equipe','equipe_privado','fichas','visitas','diagnosticos','avaliacoes','convites','pre_cadastros','turmas_fic','matriculas_fic'] loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;
  insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em, municipio) values
    (a1, 'agente', 'BA', 'Tina Agente Banco', cpf_t(96400000101), 'b47.ag@t.com',  hoje - 90, true, hoje - 90, hoje - 90, hoje - 90, 'Juazeiro'),
    (a2, 'agente', 'BA', 'Dalva Agente Banco', cpf_t(96400000102), 'b47.ag2@t.com', hoje - 90, true, hoje - 90, hoje - 90, hoje - 90, 'Juazeiro'),
    (a3, 'agente', 'BA', 'Zita Agente Banco', cpf_t(96400000103), 'b47.ag3@t.com', hoje - 90, true, hoje - 90, hoje - 90, hoje - 90, 'Juazeiro');
  insert into public.equipe_privado (equipe_id, data_nascimento, nis) values (a3, '1890-01-01', null);   -- ANTIGO: nascimento fora da regra nova
  -- fichas da BA: 1 e 2 em campo; 5 e 6 para a vitrine; 7 com avaliação; 9 aguardando (para editar)
  for i in 1..9 loop
    insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
      c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, consent_imagem, consent_criancas, resultado, data_ficha, situacao, bolsista_id)
    values (('f4710000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'BA', 'Juazeiro', 'Lagoa do Banco',
      case i when 5 then 'Ana(Nita Souza' when 6 then 'Mária das Dores' else 'Maria Banco ' || i end,
      case when i = 4 then '96400000004' else cpf_t(96400000000 + i) end,                  -- 4: ficha ANTIGA com o dígito do CPF errado
      '1980-01-01', 'Sítio ' || i, true,true,true,true,true,true,true,true,true,true, i in (5, 6), i in (5, 6), 'selecionada', hoje - 60,
      case when i in (4, 9) then 'aguardando' else 'aprovada' end, b.id);
  end loop;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato) values
    ('f4720000-0000-0000-0000-000000000011', 'f4710000-0000-0000-0000-000000000001', 'BA', 'diagnostico', a1, hoje - 20, hoje - 20, 'realizada', null),
    ('f4720000-0000-0000-0000-000000000021', 'f4710000-0000-0000-0000-000000000002', 'BA', 'diagnostico', a1, hoje, null, 'prevista', null),
    ('f4720000-0000-0000-0000-000000000071', 'f4710000-0000-0000-0000-000000000007', 'BA', 'diagnostico', a1, hoje - 40, hoje - 40, 'realizada', null),
    ('f4720000-0000-0000-0000-000000000072', 'f4710000-0000-0000-0000-000000000007', 'BA', 'implantacao', a1, hoje - 30, hoje - 30, 'realizada', 'Implantação feita com a família, canteiros prontos.'),
    ('f4720000-0000-0000-0000-000000000075', 'f4710000-0000-0000-0000-000000000007', 'BA', 'avaliacao',   a1, hoje - 5, hoje - 5, 'realizada', null);
  insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, agua_seca, sem_agua, lote, latitude, longitude, area_m2, situacao, dados) values
    ('f4730000-0000-0000-0000-000000000001', 'f4710000-0000-0000-0000-000000000001', 'f4720000-0000-0000-0000-000000000011', 'BA', a1, hoje - 20, 'sim', false, 1, -9.41, -40.5, 300, 'aguardando', '{"kit": [{"item": "Tela", "qtd": 2, "valor": 100}]}'),
    ('f4730000-0000-0000-0000-000000000007', 'f4710000-0000-0000-0000-000000000007', 'f4720000-0000-0000-0000-000000000071', 'BA', a1, hoje - 40, 'sim', false, 1, -9.41, -40.5, 300, 'aprovado', '{}');
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, quintal_produz, dados) values
    ('f4740000-0000-0000-0000-000000000007', 'f4710000-0000-0000-0000-000000000007', 'f4720000-0000-0000-0000-000000000075', 'BA', a1, hoje - 5, -9.41, -40.5, 'sim', '{"fala": "O quintal mudou a nossa mesa."}');
  -- links e cadastros enviados (um agente da BA e um professor)
  insert into public.convites (id, token, papel, uf, criado_por, usado_em) values
    ('f4760000-0000-0000-0000-000000000001', 'b47link' || md5('1'), 'agente', 'BA', tec, now()), ('f4760000-0000-0000-0000-000000000002', 'b47link' || md5('2'), 'professor_fic', null, tec, now()),
    ('f4760000-0000-0000-0000-000000000003', 'b47link' || md5('3'), 'agente', 'BA', tec, null);
  insert into public.pre_cadastros (id, convite_id, papel, uf, nome, cpf, email, telefone, data_nascimento, nis, endereco, consentimento_lgpd) values
    ('f4770000-0000-0000-0000-000000000001', 'f4760000-0000-0000-0000-000000000001', 'agente', 'BA', 'Joana Pelo Link Banco', cpf_t(96400000201), 'b47.link1@t.com', '(74) 99999-0001', '1990-05-01', '12345678901', '{"cidade": "Juazeiro"}', true),
    ('f4770000-0000-0000-0000-000000000002', 'f4760000-0000-0000-0000-000000000002', 'professor_fic', null, 'Pedro Professor Pelo Link', cpf_t(96400000202), 'b47.link2@t.com', '(74) 99999-0002', '1985-05-01', null, '{}', true);
  -- curso FIC: uma turma sem estado e a matrícula da primeira agente
  insert into public.turmas_fic (id, nome, uf, inicio, professor_id) select 'f4750000-0000-0000-0000-000000000001', 'Turma do Banco 47', null, hoje - 95, id from public.equipe where papel = 'professor_fic' and status = 'ativa' order by criado_em limit 1;
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em) values ('f4750000-0000-0000-0000-000000000011', 'f4750000-0000-0000-0000-000000000001', a1, 'B47-001', hoje - 90);
  foreach t in array array['equipe','equipe_privado','fichas','visitas','diagnosticos','avaliacoes','convites','pre_cadastros','turmas_fic','matriculas_fic'] loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $x$;
select logar('b47.ag@t.com') \gset b47a_
\set AG47 '''' :b47a_logar ''''
select logar('b47.ag2@t.com') \gset b47b_
\set AG47B '''' :b47b_logar ''''
select id as tecid47 from public.equipe where papel = 'coord_tecnico' and status = 'ativa' \gset
\set F47 ' where id = ''f4710000-0000-0000-0000-0000000000'
\set V47 ' where id = ''f4720000-0000-0000-0000-0000000000'

-- =====================================================================
-- A. DESEMPENHO COM A SEGURANÇA POR LINHA
-- =====================================================================
select t('A. nenhuma regra de acesso chama "meu papel / meu id / meu estado" uma vez por linha', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(tablename || '.' || policyname, ', ') into v from pg_policies where schemaname = 'public'
   and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(?<!public\.)\m(meu_papel|meu_id|minha_uf|quem_confere_pedidos)\(\)';
  if v is not null then raise exception 'por linha: %', v; end if; end $x$$q$, 'ok');
select t('A. a regra de leitura das fichas usa a lista dos quintais do agente, montada uma vez', null, $q$do $x$ declare v text; begin set local role none;
  select qual into v from pg_policies where schemaname = 'public' and tablename = 'fichas' and policyname = 'fichas_ler';
  if v !~ 'minhas_fichas\(\)' or v ~ 'ficha_atribuida' then raise exception 'regra: %', v; end if; end $x$$q$, 'ok');
select t('A. agente lê exatamente as fichas dos quintais que visita (visita não cancelada)', :AG47, $q$do $x$ declare n int; begin
  select count(*) into n from public.fichas; if n <> 3 then raise exception 'viu % fichas (esperado 3: as das visitas dela)', n; end if;
  if exists (select 1 from public.fichas where id = 'f4710000-0000-0000-0000-000000000009') then raise exception 'viu ficha que não visita'; end if; end $x$$q$, 'ok');
select t('A. visita cancelada: a ficha deixa de aparecer para o agente', :AG47, $q$do $x$ declare n int; begin set local role none;
  alter table public.visitas disable trigger user; update public.visitas set situacao = 'cancelada' where id = 'f4720000-0000-0000-0000-000000000021'; alter table public.visitas enable trigger user;
  set local role authenticated;
  select count(*) into n from public.fichas; if n <> 2 then raise exception 'viu % fichas (esperado 2)', n; end if; end $x$$q$, 'ok');
select t('A. bolsista continua lendo só as fichas do estado dela; coordenação, todas', :BB, $q$do $x$ declare n int; m int; begin
  select count(*), count(*) filter (where uf <> 'BA') into n, m from public.fichas; if n < 9 or m > 0 then raise exception 'bolsista: % fichas, % de outro estado', n, m; end if; end $x$$q$, 'ok');
select t('A. agente de outro estado não lê as fichas da BA', :A, $q$do $x$ begin if exists (select 1 from public.fichas where id::text like 'f4710000%') then raise exception 'leu'; end if; end $x$$q$, 'ok');
select t('A. conta sem cadastro não lê ficha nenhuma', gen_random_uuid(), $q$do $x$ begin if exists (select 1 from public.fichas) then raise exception 'leu'; end if; end $x$$q$, 'ok');
select t('A. índices novos nas colunas mais consultadas', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(i, ', ') into v from unnest(array['visitas_executor', 'visitas_ficha', 'diagnosticos_executor', 'solicitacao_visitas_solicitacao', 'auditoria_registro', 'fichas_bolsista',
    'avaliacoes_ficha', 'matriculas_fic_turma', 'fic_encontros_turma', 'fic_presencas_pessoa', 'pedidos_apoio_solicitante', 'vitrine_fotos_ficha']) i where to_regclass('public.' || i) is null;
  if v is not null then raise exception 'faltam: %', v; end if; end $x$$q$, 'ok');

-- =====================================================================
-- B. EDIÇÃO AO MESMO TEMPO
-- =====================================================================
select atualizado_em as m0 from public.fichas where id = 'f4710000-0000-0000-0000-000000000009' \gset
select t('B. ficha: alteração com a marca do que foi lido é aceita', :BB, format($q$do $x$ declare n int; begin update public.fichas set celular = '(74) 98888-0001', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, :'m0'), 'ok');
select t('B. ficha: alteração SEM a marca (celular com a tela antiga) continua aceita', :BB, $q$update public.fichas set celular = '(74) 98888-0002'$q$ || :'F47' || $q$09'$q$, 'ok');
-- a primeira pessoa grava (de verdade); a segunda, que leu antes, é avisada
select f(:BB, format($q$update public.fichas set celular = '(74) 98888-0003', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009'$q$, :'m0'));
select t('B. ficha: quem leu ANTES da alteração de outra pessoa é avisado e não grava por cima', :G, format($q$update public.fichas set ponto_referencia = 'Depois da ponte', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009'$q$, :'m0'),
  'Este registro foi alterado por outra pessoa enquanto você editava. Abra de novo, confira e refaça a sua alteração.');
select t('B. ficha: nada do que a segunda pessoa mandou ficou gravado', null, $q$do $x$ begin set local role none;
  if (select celular is distinct from '(74) 98888-0003' or ponto_referencia is not null from public.fichas where id = 'f4710000-0000-0000-0000-000000000009') then raise exception 'gravou por cima'; end if; end $x$$q$, 'ok');
select atualizado_em as m1 from public.fichas where id = 'f4710000-0000-0000-0000-000000000009' \gset
select t('B. ficha: depois de salvar, a marca é outra (a tela atualiza a marca)', null, format($q$do $x$ begin if %L::timestamptz = %L::timestamptz then raise exception 'a marca não mudou'; end if; end $x$$q$, :'m0', :'m1'), 'ok');
select t('B. ficha: segunda alteração seguida da mesma pessoa, com a marca nova, é aceita', :BB, format($q$update public.fichas set celular = '(74) 98888-0004', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009'$q$, :'m1'), 'ok');
select t('B. ficha: a marca vem como texto com outro fuso (como a tela manda) e confere', :BB, format($q$update public.fichas set celular = '(74) 98888-0005', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009'$q$,
  to_char(:'m1'::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"')), 'ok');
select t('B. ficha: aprovação com marca antiga continua recusada com a mensagem da aprovação', :T, format($q$update public.fichas set situacao = 'aprovada', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009'$q$, :'m0'), 'Este registro foi alterado enquanto você lia');
select t('B. ficha: aprovação com a marca atual é aceita', :T, format($q$update public.fichas set situacao = 'aprovada', atualizado_em = %L where id = 'f4710000-0000-0000-0000-000000000009'$q$, :'m1'), 'ok');
select t('B. ficha: pelo SQL Editor (sem login e sem marca) a correção continua passando', null, $q$do $x$ begin set local role none; update public.fichas set ponto_referencia = 'Corrigido pela coordenação' where id = 'f4710000-0000-0000-0000-000000000009'; end $x$$q$, 'ok');
-- diagnóstico
select atualizado_em as d0 from public.diagnosticos where id = 'f4730000-0000-0000-0000-000000000001' \gset
select t('B. diagnóstico: alteração com a marca do que foi lido é aceita', :AG47, format($q$update public.diagnosticos set area_m2 = 310, atualizado_em = %L where id = 'f4730000-0000-0000-0000-000000000001'$q$, :'d0'), 'ok');
select f(:AG47, format($q$update public.diagnosticos set area_m2 = 320, atualizado_em = %L where id = 'f4730000-0000-0000-0000-000000000001'$q$, :'d0'));
select t('B. diagnóstico: a bolsista que leu antes da correção da agente é avisada', :BB, format($q$update public.diagnosticos set renda_familiar = 1500, atualizado_em = %L where id = 'f4730000-0000-0000-0000-000000000001'$q$, :'d0'), 'alterado por outra pessoa enquanto você editava');
select t('B. diagnóstico: a correção da agente ficou e a da bolsista não entrou', null, $q$do $x$ begin set local role none;
  if (select area_m2 <> 320 or renda_familiar is not null from public.diagnosticos where id = 'f4730000-0000-0000-0000-000000000001') then raise exception 'gravou por cima'; end if; end $x$$q$, 'ok');
select t('B. diagnóstico: aprovação do que foi lido antes continua recusada (mensagem da aprovação)', :T, format($q$update public.diagnosticos set situacao = 'aprovado', atualizado_em = %L where id = 'f4730000-0000-0000-0000-000000000001'$q$, :'d0'), 'Este registro foi alterado enquanto você lia');
select t('B. diagnóstico: devolver com marca antiga também é recusado', :T, format($q$update public.diagnosticos set situacao = 'devolvido', obs_coordenacao = 'Rever o kit', atualizado_em = %L where id = 'f4730000-0000-0000-0000-000000000001'$q$, :'d0'), 'alterado por outra pessoa enquanto você editava');
select t('B. diagnóstico: sem a marca (tela antiga) a alteração continua aceita', :AG47, $q$update public.diagnosticos set area_m2 = 330 where id = 'f4730000-0000-0000-0000-000000000001'$q$, 'ok');
-- visita
select atualizado_em as v0 from public.visitas where id = 'f4720000-0000-0000-0000-000000000021' \gset
select t('B. visita: alteração com a marca do que foi lido é aceita', :BB, format($q$update public.visitas set obs = 'Levar a trena', atualizado_em = %L$q$, :'v0') || :'V47' || $q$21'$q$, 'ok');
select f(:BB, format($q$update public.visitas set obs = 'Levar a trena e o GPS', atualizado_em = %L$q$, :'v0') || :'V47' || $q$21'$q$);
select t('B. visita: a coordenação que leu antes é avisada', :T, format($q$update public.visitas set data_prevista = public.fic_hoje() + 3, atualizado_em = %L$q$, :'v0') || :'V47' || $q$21'$q$, 'alterado por outra pessoa enquanto você editava');
select t('B. visita: cancelar com a marca antiga também é recusado', :BB, format($q$update public.visitas set situacao = 'cancelada', atualizado_em = %L$q$, :'v0') || :'V47' || $q$21'$q$, 'alterado por outra pessoa enquanto você editava');
select t('B. visita: sem a marca continua aceita', :BB, $q$update public.visitas set obs = 'Sem marca'$q$ || :'V47' || $q$21'$q$, 'ok');
select t('B. o diagnóstico registrado marca a visita como feita sem esbarrar na conferência da marca (gatilho interno)', :AG47, $q$do $x$ begin
  insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, area_m2, agua_seca, lote, dados)
    values ('f4730000-0000-0000-0000-000000000002', 'f4710000-0000-0000-0000-000000000002', 'f4720000-0000-0000-0000-000000000021', 'BA', public.fic_hoje(), -9.4, -40.5, 200, 'sim', 1, '{"kit": []}');
  if (select situacao from public.visitas where id = 'f4720000-0000-0000-0000-000000000021') <> 'realizada' then raise exception 'a visita não ficou feita'; end if; end $x$$q$, 'ok');
-- avaliação
select atualizado_em as a0 from public.avaliacoes where id = 'f4740000-0000-0000-0000-000000000007' \gset
select t('B. avaliação: alteração com a marca do que foi lido é aceita', :BB, format($q$update public.avaliacoes set ebia_pontos = 3, atualizado_em = %L where id = 'f4740000-0000-0000-0000-000000000007'$q$, :'a0'), 'ok');
select f(:BB, format($q$update public.avaliacoes set ebia_pontos = 4, atualizado_em = %L where id = 'f4740000-0000-0000-0000-000000000007'$q$, :'a0'));
select t('B. avaliação: a agente que leu antes é avisada', :AG47, format($q$update public.avaliacoes set ebia_pontos = 9, atualizado_em = %L where id = 'f4740000-0000-0000-0000-000000000007'$q$, :'a0'), 'alterado por outra pessoa enquanto você editava');
select t('B. avaliação: sem a marca continua aceita', :AG47, $q$update public.avaliacoes set ebia_pontos = 5 where id = 'f4740000-0000-0000-0000-000000000007'$q$, 'ok');
select t('B. os quatro gatilhos de versão estão no lugar e rodam antes do que carimba a data', null, $q$do $x$ declare n int; begin set local role none;
  select count(*) into n from pg_trigger g join pg_proc p on p.oid = g.tgfoid where not g.tgisinternal and p.proname = 'versao_conferir'
    and g.tgrelid::regclass::text in ('fichas', 'diagnosticos', 'visitas', 'avaliacoes') and g.tgtype & 2 = 2 and g.tgtype & 16 = 16;
  if n <> 4 then raise exception 'gatilhos: %', n; end if;
  if not ('a1_versao' < 'visitas_antes' and 'avaliacoes_a1_versao' < 'avaliacoes_antes' and 'a1_versao' < 'fichas_antes' and 'diagnosticos_a1_versao' < 'diagnosticos_antes') then raise exception 'ordem'; end if; end $x$$q$, 'ok');

-- =====================================================================
-- C. PRIVILÉGIOS
-- =====================================================================
select t('C. quem não entrou não executa função de apoio (formatar valor)', null, $q$select public.brl(10)$q$, 'permission denied');
select t('C. quem não entrou não executa a aprovação de cadastro', null, $q$select public.aprovar_pre_cadastro(gen_random_uuid(), '{}', null)$q$, 'permission denied');
select t('C. quem não entrou continua vendo o link de cadastro e a vitrine', null, $q$do $x$ begin perform public.ver_convite('x'); perform public.vitrine(); perform public.vitrine_municipios(); perform public.pedir_novo_acesso('ninguem@t.com'); end $x$$q$, 'ok');
select t('C. quem entrou continua executando as funções de apoio', :BB, $q$do $x$ begin if public.brl(10) <> 'R$ 10,00' or public.fic_hoje() is null then raise exception 'mudou'; end if; end $x$$q$, 'ok');
select t('C. quem entrou não grava direto nos usos da IA', :G, $q$insert into public.ia_usos (equipe_id) select id from public.equipe limit 1$q$, 'permission denied');
select t('C. quem entrou não grava direto nas matrículas do FIC', :G, $q$update public.matriculas_fic set numero = 'X'$q$, 'permission denied');
select t('C. quem entrou não altera nem apaga ciência dada', :BB, $q$delete from public.ciencias$q$, 'permission denied');
select t('C. ninguém tem TRUNCATE, REFERENCES ou TRIGGER; quem não entrou não tem privilégio em tabela nem numeração', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(grantee || ':' || table_name || ':' || privilege_type, ', ') into v from information_schema.role_table_grants
   where table_schema = 'public' and table_name not in ('res', 'lk', 'pid', 'pid2') and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')));
  if v is not null then raise exception 'sobrou: %', left(v, 300); end if;
  select string_agg(c.relname, ', ') into v from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname <> 'res_n_seq'
     and (case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'USAGE') else false end);
  if v is not null then raise exception 'numeração aberta: %', v; end if; end $x$$q$, 'ok');
select t('C. tabela e função criadas depois do 47 pelo dono do banco nascem fechadas para anon e authenticated (tabela) e para anon (função revogada)', null, $q$do $x$ begin set local role none;
  create table public._b47_nova (id int);
  if has_table_privilege('anon', 'public._b47_nova', 'SELECT') or has_table_privilege('authenticated', 'public._b47_nova', 'SELECT, INSERT, UPDATE, DELETE') then raise exception 'tabela nova nasceu aberta'; end if;
  create sequence public._b47_seq;
  if has_sequence_privilege('anon', 'public._b47_seq', 'USAGE') or has_sequence_privilege('authenticated', 'public._b47_seq', 'USAGE') then raise exception 'numeração nova nasceu aberta'; end if; end $x$$q$, 'ok');
select t('C. toda função com o direito do banco procura tabelas só em public (search_path = public, pg_temp)', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(p.proname, ', ') into v from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and not ('search_path=public, pg_temp' = any (coalesce(p.proconfig, '{}')));
  if v is not null then raise exception 'sem search_path fechado: %', v; end if; end $x$$q$, 'ok');

-- =====================================================================
-- D. TAMANHO DE TEXTO E DE JSON
-- =====================================================================
select t('D. ficha: nome com 161 letras é recusado, dizendo o campo e o limite', :BB, replace(b47_fi(21, cpf_t(96400000021)), $q$'Maria Banco Nova ' || 21$q$, $q$repeat('a', 161)$q$), 'Texto muito longo em nome (máximo 160 caracteres).');
select t('D. ficha: nome com 160 letras é aceito', :BB, replace(b47_fi(21, cpf_t(96400000021)), $q$'Maria Banco Nova ' || 21$q$, $q$repeat('a', 160)$q$), 'ok');
select t('D. ficha: endereço com 301 letras é recusado', :BB, replace(b47_fi(22, cpf_t(96400000022)), $q$'Sítio novo'$q$, $q$repeat('e', 301)$q$), 'Texto muito longo em endereço (máximo 300 caracteres).');
select t('D. ficha: justificativa com 4.001 letras é recusada', :BB, b47_fi(23, cpf_t(96400000023), ', justificativa', $q$, repeat('j', 4001)$q$), 'Texto muito longo em justificativa (máximo 4.000 caracteres).');
select t('D. ficha: justificativa com 4.000 letras é aceita', :BB, b47_fi(23, cpf_t(96400000023), ', justificativa', $q$, repeat('j', 4000)$q$), 'ok');
select t('D. ficha: observação da coordenação com 4.001 letras é recusada ao devolver', :T, $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = repeat('o', 4001)$q$ || :'F47' || $q$04'$q$, 'Texto muito longo em observação da coordenação (máximo 4.000 caracteres).');
select t('D. visita: relato com 4.001 letras é recusado', :T, $q$update public.visitas set relato = repeat('r', 4001)$q$ || :'V47' || $q$72'$q$, 'Texto muito longo em relato da visita (máximo 4.000 caracteres).');
select t('D. visita: relato com 4.000 letras é aceito', :T, $q$update public.visitas set relato = repeat('r', 4000)$q$ || :'V47' || $q$72'$q$, 'ok');
select t('D. diagnóstico: respostas com mais de 100.000 caracteres são recusadas', :AG47, $q$update public.diagnosticos set dados = jsonb_build_object('sonhos', repeat('s', 100001)) where id = 'f4730000-0000-0000-0000-000000000001'$q$, 'Texto muito longo em respostas do diagnóstico (máximo 100.000 caracteres).');
select t('D. diagnóstico: kit com 61 itens é recusado', :AG47, $q$update public.diagnosticos set dados = jsonb_build_object('kit', (select jsonb_agg(jsonb_build_object('item', 'Item ' || i, 'qtd', 1, 'valor', 1)) from generate_series(1, 61) i)) where id = 'f4730000-0000-0000-0000-000000000001'$q$, 'O kit tem itens demais (máximo 60 itens)');
select t('D. diagnóstico: kit com 60 itens é aceito', :AG47, $q$update public.diagnosticos set dados = jsonb_build_object('kit', (select jsonb_agg(jsonb_build_object('item', 'Item ' || i, 'qtd', 1, 'valor', 1)) from generate_series(1, 60) i)) where id = 'f4730000-0000-0000-0000-000000000001'$q$, 'ok');
select t('D. diagnóstico: família com 31 pessoas é recusada', :AG47, $q$update public.diagnosticos set dados = jsonb_build_object('familia', (select jsonb_agg(jsonb_build_object('nome', 'Pessoa ' || i)) from generate_series(1, 31) i)) where id = 'f4730000-0000-0000-0000-000000000001'$q$, 'A lista da família tem pessoas demais (máximo 30 pessoas)');
select t('D. equipe: nome com 161 letras é recusado', :T, $q$update public.equipe set nome = repeat('n', 161) where id = 'f4700000-0000-0000-0000-000000000001'$q$, 'Texto muito longo em nome (máximo 160 caracteres).');
select t('D. dados pessoais: endereço grande demais é recusado', :T, $q$insert into public.equipe_privado (equipe_id, endereco) values ('f4700000-0000-0000-0000-000000000001', jsonb_build_object('rua', repeat('r', 4001)))$q$, 'Texto muito longo em endereço (máximo 4.000 caracteres).');
select t('D. pedido de passagem: dados com mais de 100.000 caracteres são recusados antes de tudo', :BB, $q$select public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 60, jsonb_build_object('valor_estimado', 500, 'obs', repeat('x', 100001)), null)$q$, 'Texto muito longo em dados do pedido (máximo 100.000 caracteres).');
select t('D. pedido de passagem: lista com 61 passageiras é recusada', :BB, $q$select public.salvar_pedido_apoio(null, 'passagem', 'Intercâmbio de beneficiárias', public.fic_hoje() + 60,
  jsonb_build_object('valor_estimado', 500, 'finalidade', 'intercambio', 'passageiros', (select jsonb_agg(jsonb_build_object('nome', 'Passageira ' || i, 'cpf', cpf_t(96500000000 + i), 'rg', '1', 'nascimento', '1980-01-01')) from generate_series(1, 61) i)), null)$q$, 'A lista de passageiras tem pessoas demais (máximo 60).');
select t('D. pedido de pagamento: relatório com mais de 20.000 letras é recusado antes de tudo', :BB, $q$select public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 700, repeat('r', 20001), null, '{}')$q$, 'Texto muito longo em relatório do mês (máximo 20.000 caracteres).');
select t('D. cadastro pelo link (sem login): nome de 1 milhão de letras é recusado na entrada', null, format($q$select public.enviar_pre_cadastro(%L, jsonb_build_object('nome', repeat('n', 20000), 'cpf', %L, 'email', 'grande@t.com', 'data_nascimento', '1990-01-01', 'consentimento_lgpd', true))$q$, 'b47link' || md5('3'), cpf_t(96400000301)), 'Texto muito longo em nome (máximo 160 caracteres).');
select t('D. cadastro pelo link (sem login): dados com mais de 30.000 caracteres são recusados na entrada', null, format($q$select public.enviar_pre_cadastro(%L, jsonb_build_object('nome', 'Nome Normal', 'lixo', repeat('x', 30001)))$q$, 'b47link' || md5('3')), 'Texto muito longo em dados do cadastro (máximo 30.000 caracteres).');
select t('D. cadastro pelo link (sem login): link com 1 milhão de letras é recusado sem procurar', null, $q$select public.enviar_pre_cadastro(repeat('t', 1000000), '{}')$q$, 'Este link não vale mais');
select t('D. as travas do banco existem, valem para o que for gravado e não conferiram as linhas antigas (NOT VALID)', null, $q$do $x$ declare n int; m int; begin set local role none;
  select count(*), count(*) filter (where convalidated) into n, m from pg_constraint where connamespace = 'public'::regnamespace and conname ~ '^(tam_|lista_)';
  if n < 80 or m > 0 then raise exception 'travas: %, validadas: %', n, m; end if; end $x$$q$, 'ok');
select t('D. sem o gatilho (carga direta), a trava do banco segura o texto grande e o nome dela diz o campo e o limite', null, $q$do $x$ begin set local role none;
  alter table public.fichas disable trigger user; update public.fichas set nome = repeat('z', 161) where id = 'f4710000-0000-0000-0000-000000000009'; end $x$$q$, 'tam_nome_160');
-- registro ANTIGO acima do limite (a trava não teria sido criada com ele no banco): continua operável; o gatilho segura só o texto novo
select t('D. ficha ANTIGA com nome de 500 letras e endereço de 900 continua podendo ser corrigida, devolvida e aprovada', :T, $q$do $x$ declare n int; begin
  perform b47_como(null);
  alter table public.fichas drop constraint tam_nome_160; alter table public.fichas drop constraint tam_endereco_300;
  alter table public.fichas disable trigger user;
  update public.fichas set nome = repeat('Maria ', 83) || 'fim', endereco = repeat('Sítio ', 150) where id = 'f4710000-0000-0000-0000-000000000004';
  alter table public.fichas enable trigger user;
  perform b47_como(current_setting('t.bb')::uuid);
  update public.fichas set celular = '(74) 97777-0001' where id = 'f4710000-0000-0000-0000-000000000004'; get diagnostics n = row_count; if n <> 1 then raise exception 'bolsista não corrigiu outro campo'; end if;
  begin update public.fichas set nome = repeat('Outra ', 60) where id = 'f4710000-0000-0000-0000-000000000004'; raise exception 'aceitou nome novo grande';
  exception when others then if sqlerrm not like 'Texto muito longo em nome%' then raise; end if; end;
  update public.fichas set nome = 'Maria Corrigida da Silva' where id = 'f4710000-0000-0000-0000-000000000004'; get diagnostics n = row_count; if n <> 1 then raise exception 'não encurtou o nome'; end if;
  perform b47_como((select user_id from public.equipe where papel = 'coord_tecnico' and status = 'ativa'));
  update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever o endereço' where id = 'f4710000-0000-0000-0000-000000000004'; get diagnostics n = row_count; if n <> 1 then raise exception 'não devolveu'; end if;
  update public.fichas set situacao = 'aprovada' where id = 'f4710000-0000-0000-0000-000000000004'; get diagnostics n = row_count; if n <> 1 then raise exception 'não aprovou'; end if;
end $x$$q$, 'ok');
select t('D. diagnóstico ANTIGO com respostas de 150 mil caracteres e kit de 100 itens continua podendo ser corrigido, devolvido e aprovado', :T, $q$do $x$ declare n int; begin
  perform b47_como(null);
  alter table public.diagnosticos drop constraint tam_dados_100000; alter table public.diagnosticos drop constraint lista_kit_60;
  alter table public.diagnosticos disable trigger user;
  update public.diagnosticos set dados = jsonb_build_object('sonhos', repeat('s', 150000), 'kit', (select jsonb_agg(jsonb_build_object('item', 'Item ' || i, 'qtd', 1, 'valor', 1)) from generate_series(1, 100) i))
   where id = 'f4730000-0000-0000-0000-000000000001';
  alter table public.diagnosticos enable trigger user;
  perform b47_como((select user_id from public.equipe where id = 'f4700000-0000-0000-0000-000000000001'));
  update public.diagnosticos set area_m2 = 345 where id = 'f4730000-0000-0000-0000-000000000001'; get diagnostics n = row_count; if n <> 1 then raise exception 'agente não corrigiu outro campo'; end if;
  begin update public.diagnosticos set dados = dados || jsonb_build_object('kit', (select jsonb_agg(jsonb_build_object('item', 'Novo ' || i, 'qtd', 1, 'valor', 1)) from generate_series(1, 61) i)) where id = 'f4730000-0000-0000-0000-000000000001';
    raise exception 'aceitou kit novo com 61 itens';
  exception when others then if sqlerrm not like 'Texto muito longo%' and sqlerrm not like 'O kit tem itens demais%' then raise; end if; end;
  perform b47_como((select user_id from public.equipe where papel = 'coord_tecnico' and status = 'ativa'));
  update public.diagnosticos set situacao = 'devolvido', obs_coordenacao = 'Rever o kit' where id = 'f4730000-0000-0000-0000-000000000001'; get diagnostics n = row_count; if n <> 1 then raise exception 'não devolveu'; end if;
  update public.diagnosticos set situacao = 'aprovado' where id = 'f4730000-0000-0000-0000-000000000001'; get diagnostics n = row_count; if n <> 1 then raise exception 'não aprovou'; end if;
end $x$$q$, 'ok');

-- =====================================================================
-- E. LOGIN DE QUEM SAIU
-- =====================================================================
select t('E. desligamento: o login da pessoa é removido e fica no histórico', :T, $q$do $x$ declare u uuid; begin
  select user_id into u from public.equipe where id = 'f4700000-0000-0000-0000-000000000002'; if u is null then raise exception 'cenário: sem login'; end if;
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Saiu do projeto' where id = 'f4700000-0000-0000-0000-000000000002';
  perform b47_como(null);
  if exists (select 1 from auth.users where id = u) then raise exception 'o login continua em auth.users'; end if;
  if (select user_id from public.equipe where id = 'f4700000-0000-0000-0000-000000000002') is not null then raise exception 'o cadastro continua ligado'; end if;
  if not exists (select 1 from public.auditoria where tabela = 'equipe' and acao = 'LOGIN_REMOVIDO' and registro_id = 'f4700000-0000-0000-0000-000000000002' and depois ->> 'motivo' = 'desligamento'
                   and depois ->> 'nome' = 'Dalva Agente Banco' and por is not null) then raise exception 'sem registro no histórico'; end if;
end $x$$q$, 'ok');
select t('E. quem saiu e volta com o mesmo e-mail consegue criar a senha de novo (o e-mail não fica preso no login antigo)', :T, $q$do $x$ declare nova uuid; cod text; begin
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Saiu do projeto' where id = 'f4700000-0000-0000-0000-000000000002';
  insert into public.equipe (papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd, substitui_id)
    select 'agente', 'BA', 'Dalva Agente Banco De Volta', cpf, email, '(74) 99999-0000', public.fic_hoje(), true, id from public.equipe where id = 'f4700000-0000-0000-0000-000000000002' returning id into nova;
  cod := public.gerar_codigo_acesso(nova);
  perform b47_como(null);
  -- (o Supabase real tem índice único de e-mail em auth.users: com o login antigo ainda lá, criar a senha dava "e-mail já cadastrado")
  if exists (select 1 from auth.users where lower(email) = 'b47.ag2@t.com') then raise exception 'o e-mail continua preso no login antigo'; end if;
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'b47.ag2@t.com', jsonb_build_object('codigo', cod));   -- o primeiro acesso (criar a senha)
  if (select user_id from public.equipe where id = nova) is null then raise exception 'o cadastro novo não ficou ligado ao login'; end if;
end $x$$q$, 'ok');
select t('E. e-mail do cadastro trocado: o login antigo é removido e fica no histórico', :T, $q$do $x$ declare u uuid; begin
  select user_id into u from public.equipe where id = 'f4700000-0000-0000-0000-000000000002';
  update public.equipe set email = 'b47.novo.email@t.com' where id = 'f4700000-0000-0000-0000-000000000002';
  perform b47_como(null);
  if exists (select 1 from auth.users where id = u) then raise exception 'o login antigo continua'; end if;
  if not exists (select 1 from public.auditoria where acao = 'LOGIN_REMOVIDO' and registro_id = 'f4700000-0000-0000-0000-000000000002' and depois ->> 'motivo' = 'e-mail do cadastro alterado') then raise exception 'sem histórico'; end if;
end $x$$q$, 'ok');
select t('E. "novo primeiro acesso" pela coordenação geral: continua com UMA linha no histórico (a da própria função)', :G, $q$do $x$ declare u uuid; n int; begin
  select user_id into u from public.equipe where id = 'f4700000-0000-0000-0000-000000000002';
  perform public.gerar_codigo_acesso('f4700000-0000-0000-0000-000000000002');
  perform b47_como(null);
  if exists (select 1 from auth.users where id = u) then raise exception 'o login antigo continua'; end if;
  select count(*) into n from public.auditoria where registro_id = 'f4700000-0000-0000-0000-000000000002' and acao in ('NOVO_ACESSO', 'LOGIN_REMOVIDO');
  if n <> 1 then raise exception 'linhas no histórico: %', n; end if;
end $x$$q$, 'ok');
select t('E. alteração comum do cadastro não mexe no login', :T, $q$do $x$ declare u uuid; begin
  select user_id into u from public.equipe where id = 'f4700000-0000-0000-0000-000000000002';
  update public.equipe set telefone = '(74) 91111-2222' where id = 'f4700000-0000-0000-0000-000000000002';
  perform b47_como(null);
  if not exists (select 1 from auth.users where id = u) or (select user_id from public.equipe where id = 'f4700000-0000-0000-0000-000000000002') is distinct from u then raise exception 'mexeu no login'; end if;
end $x$$q$, 'ok');
select t('E. login antigo sem pessoa NÃO é apagado em massa (fica para a auditoria de dados, item I03)', null, $q$do $x$ declare u uuid := gen_random_uuid(); begin set local role none;
  alter table auth.users disable trigger user; insert into auth.users (id, email) values (u, 'b47.orfao@t.com'); alter table auth.users enable trigger user;
  update public.equipe set telefone = '(74) 93333-4444' where id = 'f4700000-0000-0000-0000-000000000001';
  if not exists (select 1 from auth.users where id = u) then raise exception 'apagou login que não era da pessoa'; end if; end $x$$q$, 'ok');

-- =====================================================================
-- F. MATRÍCULA: a pessoa é travada primeiro
-- =====================================================================
select t('F. cancelar matrícula trava a pessoa antes da matrícula (a mesma ordem de matricular e desligar)', null, $q$do $x$ declare s text; begin set local role none;
  select prosrc into s from pg_proc where proname = 'cancelar_matricula_fic' and pronamespace = 'public'::regnamespace;
  if position('from public.equipe where id = m.equipe_id for update' in s) = 0
     or position('from public.equipe where id = m.equipe_id for update' in s) > position('from public.matriculas_fic where id = p_id for update' in s) then raise exception 'ordem das travas'; end if;
  select prosrc into s from pg_proc where proname = 'matricular_fic' and pronamespace = 'public'::regnamespace;
  if position('from public.equipe where id = p_equipe for update' in s) = 0 or position('from public.equipe where id = p_equipe for update' in s) > position('from public.matriculas_fic where equipe_id = p_equipe' in s) then raise exception 'ordem em matricular'; end if;
end $x$$q$, 'ok');
select t('F. matricular e cancelar a matrícula continuam funcionando (e o cadastro acompanha)', :G, $q$do $x$ declare tu uuid; mt uuid; begin
  tu := 'f4750000-0000-0000-0000-000000000001';
  mt := public.matricular_fic(tu, 'f4700000-0000-0000-0000-000000000003', 'B47-003', public.fic_hoje());
  if (select matricula_fic_numero from public.equipe where id = 'f4700000-0000-0000-0000-000000000003') <> 'B47-003' then raise exception 'cadastro sem o número'; end if;
  perform public.cancelar_matricula_fic(mt, 'Matrícula lançada na turma errada');
  if (select matricula_fic_numero from public.equipe where id = 'f4700000-0000-0000-0000-000000000003') is not null or (select cancelada_em from public.matriculas_fic where id = mt) is null then raise exception 'não cancelou'; end if;
  begin perform public.cancelar_matricula_fic(mt, 'De novo'); raise exception 'cancelou duas vezes'; exception when others then if sqlerrm not like 'Matrícula não encontrada ou já cancelada%' then raise; end if; end;
end $x$$q$, 'ok');
select t('F. bolsista não cancela matrícula (continua só o professor ou a coordenação geral)', :BB, $q$select public.cancelar_matricula_fic('f4750000-0000-0000-0000-000000000011', 'Não deveria')$q$, 'cancelada pelos professores');

-- =====================================================================
-- G. APROVAR O CADASTRO VINDO DO LINK: uma operação só
-- =====================================================================
\set EQ47 '{"papel": "agente", "uf": "BA", "nome": "Joana Pelo Link Banco", "cpf": "CPF", "email": " B47.Link1@T.com ", "telefone": "(74) 99999-0001", "municipio": "", "data_inicio": "HOJE", "consentimento_lgpd": true, "status": "desligada", "user_id": "00000000-0000-0000-0000-000000000001"}'
select replace(replace(:'EQ47', 'CPF', cpf_t(96400000201)), 'HOJE', public.fic_hoje()::text) as eq47 \gset
\set PV47 '{"data_nascimento": "1990-05-01", "nis": "12345678901", "endereco": {"cidade": "Juazeiro"}, "socioeconomico": null, "perfil": {"agricultora": true}}'
select t('G. a técnica aprova o cadastro do link: pessoa na equipe, dados pessoais e cadastro enviado aprovado, de uma vez', :T, format($q$do $x$ declare e public.equipe; begin
  e := public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, %L);
  if e.id is null or e.status <> 'ativa' or e.user_id is not null or e.email <> 'b47.link1@t.com' or e.municipio is not null or e.criado_por is distinct from public.meu_id() then raise exception 'pessoa: %%', row_to_json(e); end if;
  if (select situacao || coalesce(equipe_id::text, '') from public.pre_cadastros where id = 'f4770000-0000-0000-0000-000000000001') <> 'aprovado' || e.id then raise exception 'cadastro enviado não ficou aprovado'; end if;
  if (select data_nascimento::text || nis || (endereco ->> 'cidade') || (perfil ->> 'agricultora') from public.equipe_privado where equipe_id = e.id) is distinct from '1990-05-0112345678901Juazeirotrue' then raise exception 'dados pessoais não gravados'; end if;
  perform b47_como(null);
  if (select count(*) from public.auditoria where registro_id = e.id and tabela in ('equipe', 'equipe_privado')) < 2 then raise exception 'sem histórico'; end if;
end $x$$q$, :'eq47', :'PV47'), 'ok');
select t('G. se a última parte falha (nascimento inválido), NADA fica gravado: nem a pessoa, nem a aprovação', :T, format($q$do $x$ declare m text; begin
  begin perform public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, %L); m := 'aprovou';
  exception when others then m := sqlerrm; end;
  if m not like 'Data de nascimento inválida%%' then raise exception 'veio: %%', m; end if;
  perform b47_como(null);
  if exists (select 1 from public.equipe where email = 'b47.link1@t.com') then raise exception 'a pessoa ficou na equipe'; end if;
  if (select situacao from public.pre_cadastros where id = 'f4770000-0000-0000-0000-000000000001') <> 'aguardando' then raise exception 'o cadastro enviado mudou'; end if;
end $x$$q$, :'eq47', replace(:'PV47', '1990-05-01', '2020-05-01')), 'ok');
select t('G. se a pessoa não pode entrar (CPF já ativo), o cadastro enviado continua aguardando', :T, format($q$do $x$ declare m text; begin
  begin perform public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, %L); m := 'aprovou';
  exception when others then m := sqlerrm; end;
  if m not like '%%já ocupa outra vaga ativa%%' then raise exception 'veio: %%', m; end if;
  if (select situacao from public.pre_cadastros where id = 'f4770000-0000-0000-0000-000000000001') <> 'aguardando' then raise exception 'o cadastro enviado mudou'; end if;
end $x$$q$, replace(:'eq47', cpf_t(96400000201), cpf_t(96400000101)), :'PV47'), 'ok');
select t('G. aprovar duas vezes: a segunda é avisada e não cadastra de novo', :T, format($q$do $x$ begin
  perform public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, null);
  perform public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, null); end $x$$q$, :'eq47', replace(replace(:'eq47', cpf_t(96400000201), cpf_t(96400000209)), 'B47.Link1', 'B47.Outra')), 'Este pré-cadastro já foi decidido.');
select t('G. sem dados pessoais (cadastro no Arlo), aprova só com a pessoa e o cadastro enviado', :T, format($q$do $x$ declare e public.equipe; begin
  e := public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, null);
  if exists (select 1 from public.equipe_privado where equipe_id = e.id) then raise exception 'criou dados pessoais vazios'; end if; end $x$$q$, :'eq47'), 'ok');
select t('G. bolsista NÃO aprova cadastro (as mesmas permissões de antes)', :BB, format($q$select public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, null)$q$, :'eq47'), 'não encontrado');
select t('G. a técnica NÃO aprova cadastro de professor (é da coordenação geral)', :T, format($q$select public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000002', %L, null)$q$,
  replace(replace(replace(replace(:'eq47', '"agente"', '"professor_fic"'), '"uf": "BA"', '"uf": null'), cpf_t(96400000201), cpf_t(96400000202)), 'B47.Link1', 'B47.Link2')), 'não encontrado');
select t('G. a coordenação geral aprova o cadastro de professor', :G, format($q$do $x$ declare e public.equipe; begin
  e := public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000002', %L, null); if e.papel <> 'professor_fic' or e.uf is not null then raise exception 'pessoa: %%', row_to_json(e); end if; end $x$$q$,
  replace(replace(replace(replace(:'eq47', '"agente"', '"professor_fic"'), '"uf": "BA"', '"uf": null'), cpf_t(96400000201), cpf_t(96400000202)), 'B47.Link1', 'B47.Link2')), 'ok');
select t('G. conta sem cadastro não aprova', gen_random_uuid(), format($q$select public.aprovar_pre_cadastro('f4770000-0000-0000-0000-000000000001', %L, null)$q$, :'eq47'), 'Entre no sistema');
select t('G. o caminho antigo (três gravações da tela antiga) continua funcionando', :T, $q$do $x$ declare nova uuid; begin
  insert into public.equipe (papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd) select papel, uf, nome, cpf, email, telefone, public.fic_hoje(), true from public.pre_cadastros where id = 'f4770000-0000-0000-0000-000000000001' returning id into nova;
  insert into public.equipe_privado (equipe_id, data_nascimento, nis) values (nova, '1990-05-01', '12345678901');
  update public.pre_cadastros set situacao = 'aprovado', equipe_id = nova where id = 'f4770000-0000-0000-0000-000000000001'; end $x$$q$, 'ok');

-- =====================================================================
-- H e I. CONFERÊNCIAS QUE ESPERAM UMA PELA OUTRA; TEMPO DE ESPERA (as corridas estão em concorrencia_bd.sh)
-- =====================================================================
select t('H. as seis conferências seguram a linha certa enquanto conferem', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(e.f, ', ') into v from (values
    ('visitas_antes', 'from public.equipe where id = new.executor_id for share'), ('solicitar_pagamento', 'where id = public.meu_id() for share'),
    ('solicitar_pagamento', 'where v.id = any (p_visitas) order by v.id for share'), ('custos_visita_travas', 'order by s.id for share'),
    ('registrar_encontro_fic', $s$trava_aviso('solicitar_pagamento_' || t.professor_id::text)$s$), ('cancelar_encontro_fic', $s$trava_aviso('solicitar_pagamento_' || v_prof::text)$s$),
    ('diagnosticos_antes', 'from public.fichas f where f.id = new.ficha_id for share'), ('enviar_pre_cadastro', $s$trava_aviso('pre_cadastro_cpf_' || v_cpf)$s$),
    ('registrar_uso_ia', $s$trava_aviso('ia_' || eu::text)$s$)) e(f, trecho)
   where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.f and position(e.trecho in p.prosrc) > 0);
  if v is not null then raise exception 'sem a trava: %', v; end if; end $x$$q$, 'ok');
select t('H. agendar visita, pedir pagamento, mudar km e registrar encontro continuam funcionando com as travas novas', :BB, $q$do $x$ begin
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), 'f4710000-0000-0000-0000-000000000003', 'BA', 'diagnostico', 'f4700000-0000-0000-0000-000000000001', public.fic_hoje() + 5);
  perform b47_como((select user_id from public.equipe where papel = 'coord_tecnico' and status = 'ativa'));
  insert into public.custos_visita (visita_id, km_ida) values ('f4720000-0000-0000-0000-000000000072', 12) on conflict (visita_id) do update set km_ida = excluded.km_ida;
  update public.custos_visita set km_ida = 15 where visita_id = 'f4720000-0000-0000-0000-000000000072';
end $x$$q$, 'ok');
select t('H. visita para pessoa desligada continua recusada', :BB, $q$do $x$ begin perform b47_como(null); alter table public.equipe disable trigger user;
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Saiu do projeto', user_id = null where id = 'f4700000-0000-0000-0000-000000000003';
  alter table public.equipe enable trigger user; perform b47_como(current_setting('t.bb')::uuid);
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), 'f4710000-0000-0000-0000-000000000003', 'BA', 'diagnostico', 'f4700000-0000-0000-0000-000000000003', public.fic_hoje() + 5); end $x$$q$,
  'precisa ser bolsista ou agente de campo ativa');
select t('I. a trava de aviso espera no máximo 5 segundos e as funções que a usam também', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(p.proname, ', ') into v from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosrc ~ '(pg_advisory_xact_lock|trava_aviso)\('
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') and not ('lock_timeout=5s' = any (coalesce(p.proconfig, '{}')));
  if v is not null then raise exception 'sem limite de espera: %', v; end if;
  if (select prosrc from pg_proc where proname = 'trava_aviso') !~ 'O sistema está ocupado com outra gravação. Tente de novo em instantes.' then raise exception 'mensagem'; end if; end $x$$q$, 'ok');
select t('I. quem entrou espera no máximo 5 segundos por trava; quem não entrou, 3', null, $q$do $x$ declare a text; b text; begin set local role none;
  select array_to_string(s.setconfig, ',') into a from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticated' and s.setdatabase = 0;
  select array_to_string(s.setconfig, ',') into b from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'anon' and s.setdatabase = 0;
  if a is distinct from 'lock_timeout=5s' or b is distinct from 'lock_timeout=3s' then raise exception 'authenticated: %, anon: %', a, b; end if; end $x$$q$, 'ok');

-- =====================================================================
-- J. REPETIÇÃO DEPOIS DE FALHA DE REDE
-- =====================================================================
select t('J. pedido de evento repetido em menos de 2 minutos devolve o mesmo pedido (não cria outro)', :BB, $q$do $x$ declare a uuid; b uuid; n int; begin
  a := public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 60, '{"valor_estimado": 500, "local": "Sede"}', null);
  b := public.salvar_pedido_apoio(null, 'evento', ' Feira de sementes do território ', public.fic_hoje() + 60, '{"local": "Sede", "valor_estimado": 500}', '');
  select count(*) into n from public.pedidos_apoio where titulo = 'Feira de sementes do território';
  if a <> b or n <> 1 then raise exception 'criou outro: % pedidos', n; end if; end $x$$q$, 'ok');
select t('J. pedido diferente (outra data ou outro valor) é um pedido novo', :BB, $q$do $x$ declare a uuid; b uuid; c uuid; begin
  a := public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 60, '{"valor_estimado": 500, "local": "Sede"}', null);
  b := public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 61, '{"valor_estimado": 500, "local": "Sede"}', null);
  c := public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 60, '{"valor_estimado": 600, "local": "Sede"}', null);
  if a = b or a = c or b = c then raise exception 'juntou pedidos diferentes'; end if; end $x$$q$, 'ok');
select t('J. o mesmo pedido depois de 2 minutos é um pedido novo', :BB, $q$do $x$ declare a uuid; b uuid; begin
  a := public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 60, '{"valor_estimado": 500, "local": "Sede"}', null);
  perform b47_como(null); update public.pedidos_apoio set criado_em = now() - interval '3 minutes' where id = a; perform b47_como(current_setting('t.bb')::uuid);
  b := public.salvar_pedido_apoio(null, 'evento', 'Feira de sementes do território', public.fic_hoje() + 60, '{"valor_estimado": 500, "local": "Sede"}', null);
  if a = b then raise exception 'devolveu o antigo'; end if; end $x$$q$, 'ok');
select t('J. orientação de venda repetida em menos de 2 minutos devolve a mesma (não registra duas)', :AG47, $q$do $x$ declare a uuid; b uuid; c uuid; n int; begin
  a := public.registrar_orientacao_venda('f4710000-0000-0000-0000-000000000001', '{"sobra": ["Hortaliças"], "caf": "sim"}');
  b := public.registrar_orientacao_venda('f4710000-0000-0000-0000-000000000001', '{"caf": "sim", "sobra": ["Hortaliças"]}');
  c := public.registrar_orientacao_venda('f4710000-0000-0000-0000-000000000001', '{"sobra": ["Ovos"], "caf": "sim"}');
  perform b47_como(null); select count(*) into n from public.orientacoes_venda where ficha_id = 'f4710000-0000-0000-0000-000000000001';
  if a <> b or a = c or n <> 2 then raise exception 'orientações: %', n; end if; end $x$$q$, 'ok');
select t('J. link de agente (várias vagas): dois pedidos seguidos são dois links; cancelado, gera outro', :T, $q$do $x$ declare a text; b text; c text; d text; begin
  a := public.criar_convite('agente', 'ba'); b := public.criar_convite('agente', 'BA'); c := public.criar_convite('agente', 'PE');
  if a = b or a = c then raise exception 'links: % % %', a, b, c; end if;
  update public.convites set cancelado_em = now() where token = a;
  d := public.criar_convite('agente', 'BA'); if d = a then raise exception 'devolveu link cancelado'; end if; end $x$$q$, 'ok');
select t('J. documento anexado duas vezes em menos de 2 minutos fica um só; título diferente é outro documento', :G, $q$do $x$ declare n int; begin
  insert into public.documentos_projeto (tipo, titulo, data_documento, uf, arquivo_path, arquivo_nome, tamanho, mime) values ('ata', 'Ata da reunião do banco', public.fic_hoje(), 'BA', '2026/b47-1_ata.pdf', 'ata.pdf', 1000, 'application/pdf');
  insert into public.documentos_projeto (tipo, titulo, data_documento, uf, arquivo_path, arquivo_nome, tamanho, mime) values ('ata', 'Ata da reunião do banco', public.fic_hoje(), 'BA', '2026/b47-2_ata.pdf', 'ata.pdf', 1000, 'application/pdf');
  get diagnostics n = row_count; if n <> 0 then raise exception 'a repetição entrou'; end if;
  insert into public.documentos_projeto (tipo, titulo, data_documento, uf, arquivo_path, arquivo_nome, tamanho, mime) values ('ata', 'Ata da OUTRA reunião do banco', public.fic_hoje(), 'BA', '2026/b47-3_ata.pdf', 'ata.pdf', 1000, 'application/pdf');
  select count(*) into n from public.documentos_projeto where arquivo_path like '2026/b47-%'; if n <> 2 then raise exception 'documentos: %', n; end if; end $x$$q$, 'ok');
select t('J. o mesmo documento depois de 2 minutos é aceito de novo', :G, $q$do $x$ declare n int; begin
  insert into public.documentos_projeto (tipo, titulo, data_documento, uf, arquivo_path, arquivo_nome, tamanho, mime) values ('ata', 'Ata da reunião do banco', public.fic_hoje(), 'BA', '2026/b47-1_ata.pdf', 'ata.pdf', 1000, 'application/pdf');
  perform b47_como(null); alter table public.documentos_projeto disable trigger user; update public.documentos_projeto set enviado_em = now() - interval '3 minutes' where arquivo_path = '2026/b47-1_ata.pdf';
  alter table public.documentos_projeto enable trigger user; perform b47_como((select user_id from public.equipe where papel = 'coord_geral' and status = 'ativa'));
  insert into public.documentos_projeto (tipo, titulo, data_documento, uf, arquivo_path, arquivo_nome, tamanho, mime) values ('ata', 'Ata da reunião do banco', public.fic_hoje(), 'BA', '2026/b47-2_ata.pdf', 'ata.pdf', 1000, 'application/pdf');
  get diagnostics n = row_count; if n <> 1 then raise exception 'recusou depois de 2 minutos'; end if; end $x$$q$, 'ok');

-- =====================================================================
-- K. MIÚDOS
-- =====================================================================
select t('K. o identificador de uma visita não muda', :T, $q$update public.visitas set id = gen_random_uuid()$q$ || :'V47' || $q$21'$q$, 'O identificador deste registro não muda.');
select t('K. o identificador de uma pessoa não muda (nem pela coordenação geral)', :G, $q$update public.equipe set id = gen_random_uuid() where id = 'f4700000-0000-0000-0000-000000000003'$q$, 'O identificador deste registro não muda.');
select t('K. o identificador de um diagnóstico e de uma avaliação não mudam', :G, $q$do $x$ begin
  begin update public.diagnosticos set id = gen_random_uuid() where id = 'f4730000-0000-0000-0000-000000000001'; raise exception 'trocou o diagnóstico'; exception when others then if sqlerrm <> 'O identificador deste registro não muda.' then raise; end if; end;
  update public.avaliacoes set id = gen_random_uuid() where id = 'f4740000-0000-0000-0000-000000000007'; end $x$$q$, 'O identificador deste registro não muda.');
select t('K. a chave de um parâmetro não muda', :T, $q$update public.parametros set chave = 'outra' where chave = 'custo_visita'$q$, 'O identificador deste registro não muda.');
select t('K. alteração normal de visita continua passando pelo gatilho da chave', :BB, $q$update public.visitas set obs = 'ok'$q$ || :'V47' || $q$21'$q$, 'ok');
select t('K. um CPF só aguardando conferência nos cadastros enviados pelo link (trava do banco)', null, $q$do $x$ begin set local role none;
  insert into public.pre_cadastros (convite_id, papel, uf, nome, cpf, email, consentimento_lgpd) select 'f4760000-0000-0000-0000-000000000003', 'agente', 'BA', 'Joana Repetida', cpf, 'outra@t.com', true
    from public.pre_cadastros where id = 'f4770000-0000-0000-0000-000000000001'; end $x$$q$, 'pre_cadastros_cpf_aguardando');
select t('K. o mesmo CPF por outro link, com o primeiro ainda aguardando: mensagem clara', null, format($q$select public.enviar_pre_cadastro(%L, jsonb_build_object('nome', 'Joana Pelo Outro Link', 'cpf', %L, 'email', 'outro.link@t.com', 'data_nascimento', '1990-01-01', 'consentimento_lgpd', true))$q$,
  'b47link' || md5('3'), cpf_t(96400000201)), 'Seus dados já foram enviados');
select t('K. vitrine: nome com parêntese não dá mais erro cru do banco', :T, $q$insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('b47-a.jpg', 'f4710000-0000-0000-0000-000000000005', 'XX', 'Quintal em produção na Lagoa', true)$q$, 'ok');
select t('K. vitrine: o nome da mulher (com acento ou em maiúsculas) continua barrado na legenda', :T, $q$insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('b47-b.jpg', 'f4710000-0000-0000-0000-000000000006', 'XX', 'Quintal da dona MARIA, lindo', true)$q$, 'A legenda não pode trazer o nome da mulher.');
select t('K. vitrine: palavra que só contém o nome (mariana) passa', :T, $q$insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('b47-c.jpg', 'f4710000-0000-0000-0000-000000000006', 'XX', 'Feira mariana de hortaliças', true)$q$, 'ok');
select t('K. canal de venda: o mesmo canal com e sem acento é recusado como repetido', :BB, $q$do $x$ begin
  perform public.salvar_canal_venda(null, 'BA', 'São José do Banco', 'feira', 'Feira Agroecológica', null, null, true);
  perform public.salvar_canal_venda(null, 'BA', 'sao jose do banco', 'feira', 'FEIRA AGROECOLOGICA', null, null, true); end $x$$q$, 'Este canal já está cadastrado neste município.');
select t('K. canal de venda: município sem pelo menos 2 letras é recusado', :BB, $q$select public.salvar_canal_venda(null, 'BA', '12', 'feira', 'Feira do número', null, null, true)$q$, 'Informe o município (pelo menos 2 letras).');
select t('K. canal de venda ANTIGO com município fora da regra continua editável (nome, contato)', :BB, $q$do $x$ declare c uuid := gen_random_uuid(); begin perform b47_como(null);
  insert into public.canais_venda (id, uf, municipio, tipo, nome) values (c, 'BA', '12', 'feira', 'Feira antiga');
  perform b47_como(current_setting('t.bb')::uuid);
  perform public.salvar_canal_venda(c, 'BA', '12', 'feira', 'Feira antiga de sábado', null, 'Dona Chica', true);
  if (select nome from public.canais_venda where id = c) <> 'Feira antiga de sábado' then raise exception 'não editou'; end if; end $x$$q$, 'ok');
select t('K. APL: o mesmo município com outra grafia vai para o registro que já existe (não cria outro)', :T, $q$do $x$ declare n int; begin
  insert into public.apl_municipios (uf, municipio, apls, obs) values ('BA', 'São José do Banco', '{apicultura}', null) on conflict (uf, municipio) do update set apls = excluded.apls, obs = excluded.obs;
  insert into public.apl_municipios (uf, municipio, apls, obs) values ('BA', 'sao jose do banco', '{apicultura,caprinocultura}', 'Feira no sábado') on conflict (uf, municipio) do update set apls = excluded.apls, obs = excluded.obs;
  perform b47_como(null);
  select count(*) into n from public.apl_municipios where uf = 'BA' and public.sem_acento(municipio) = 'sao jose do banco';
  if n <> 1 or (select array_length(apls, 1) from public.apl_municipios where uf = 'BA' and municipio = 'São José do Banco') <> 2 then raise exception 'registros: %', n; end if; end $x$$q$, 'ok');
select t('K. APL: município sem pelo menos 2 letras é recusado', :T, $q$insert into public.apl_municipios (uf, municipio, apls) values ('BA', '7', '{apicultura}')$q$, 'Informe o município (pelo menos 2 letras).');
select t('K. estado (UF) fora da lista é recusado pela trava do banco mesmo sem o gatilho', null, $q$do $x$ begin set local role none; alter table public.visitas disable trigger user;
  update public.visitas set uf = 'XX' where id = 'f4720000-0000-0000-0000-000000000021'; end $x$$q$, 'visitas_uf_lista');
select t('K. toda tabela com estado (UF) tem a lista fechada', null, $q$do $x$ declare v text; begin set local role none;
  select string_agg(c.table_name, ', ') into v from information_schema.columns c where c.table_schema = 'public' and c.column_name = 'uf'
     and not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || c.table_name)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ '\muf\M.*AL.*BA.*PE.*PI.*SE');
  if v is not null then raise exception 'sem lista: %', v; end if; end $x$$q$, 'ok');
select t('K. substituição em círculo (A substitui B, que substitui A) é recusada', :G, $q$do $x$ begin
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000002' where id = 'f4700000-0000-0000-0000-000000000001';
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000001' where id = 'f4700000-0000-0000-0000-000000000002'; end $x$$q$, 'fecharia um círculo');
select t('K. substituição em cadeia de três também é recusada quando fecha o círculo', :G, $q$do $x$ begin
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000002' where id = 'f4700000-0000-0000-0000-000000000001';
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000003' where id = 'f4700000-0000-0000-0000-000000000002';
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000001' where id = 'f4700000-0000-0000-0000-000000000003'; end $x$$q$, 'fecharia um círculo');
select t('K. substituição normal (cadeia sem círculo) continua aceita', :G, $q$do $x$ begin
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000002' where id = 'f4700000-0000-0000-0000-000000000001';
  update public.equipe set substitui_id = 'f4700000-0000-0000-0000-000000000003' where id = 'f4700000-0000-0000-0000-000000000002'; end $x$$q$, 'ok');
select t('K. limite diário da IA: com 60 usos nas últimas 24 horas o 61º é recusado (e a conta usa a trava por pessoa)', :AG47, $q$do $x$ begin perform b47_como(null);
  insert into public.ia_usos (equipe_id) select 'f4700000-0000-0000-0000-000000000001' from generate_series(1, 59);
  perform b47_como((select user_id from public.equipe where id = 'f4700000-0000-0000-0000-000000000001'));
  if not public.registrar_uso_ia() then raise exception 'recusou o 60º'; end if;
  if public.registrar_uso_ia() then raise exception 'aceitou o 61º'; end if; end $x$$q$, 'ok');
select t('K. parâmetro com chave desconhecida é recusado', :G, $q$insert into public.parametros (chave, valor) values ('b47_qualquer', '{"x": 1}')$q$, 'Parâmetro desconhecido (b47_qualquer)');
select t('K. os valores do custo da visita continuam sendo salvos', :T, $q$insert into public.parametros (chave, valor) values ('custo_visita', '{"valor_hora": 20, "refeicao": 30}') on conflict (chave) do update set valor = excluded.valor$q$, 'ok');
select t('K. dados pessoais: nascimento antes de 1900 é recusado', :T, $q$insert into public.equipe_privado (equipe_id, data_nascimento) values ('f4700000-0000-0000-0000-000000000001', '1899-12-31')$q$, 'Data de nascimento inválida');
select t('K. dados pessoais: menos de 16 anos é recusado', :T, $q$insert into public.equipe_privado (equipe_id, data_nascimento) values ('f4700000-0000-0000-0000-000000000001', (public.fic_hoje() - interval '16 years' + interval '1 day')::date)$q$, 'pelo menos 16 anos');
select t('K. dados pessoais: 16 anos completos hoje é aceito', :T, $q$insert into public.equipe_privado (equipe_id, data_nascimento) values ('f4700000-0000-0000-0000-000000000001', (public.fic_hoje() - interval '16 years')::date)$q$, 'ok');
select t('K. dados pessoais ANTIGOS com nascimento fora da regra continuam podendo ser salvos (a tela manda tudo de novo)', :T, $q$do $x$ declare n int; begin
  insert into public.equipe_privado (equipe_id, data_nascimento, nis, endereco) values ('f4700000-0000-0000-0000-000000000003', '1890-01-01', '12345678901', '{"cidade": "Juazeiro"}')
    on conflict (equipe_id) do update set data_nascimento = excluded.data_nascimento, nis = excluded.nis, endereco = excluded.endereco;
  get diagnostics n = row_count; if n <> 1 then raise exception 'não salvou'; end if;
  begin update public.equipe_privado set data_nascimento = '1891-01-01' where equipe_id = 'f4700000-0000-0000-0000-000000000003'; raise exception 'aceitou outra data antiga';
  exception when others then if sqlerrm not like 'Data de nascimento inválida%' then raise; end if; end; end $x$$q$, 'ok');
select t('K. planilha de execução: total negativo é recusado', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido, nao_classificadas) values (public.fic_hoje(), '2026/b47.xlsx', 'b47.xlsx', '[{"v":1}]', -1, 0, 0)$q$, 'Os totais da planilha vieram com valor que o sistema não aceita');
select t('K. planilha de execução: total "NaN" (não é número) é recusado', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido, nao_classificadas) values (public.fic_hoje(), '2026/b47.xlsx', 'b47.xlsx', '[{"v":1}]', 10, 'NaN', 0)$q$, 'Os totais da planilha vieram com valor que o sistema não aceita');
select t('K. planilha de execução: totais normais continuam aceitos', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido, nao_classificadas) values (public.fic_hoje(), '2026/b47.xlsx', 'b47.xlsx', '[{"v":1}]', 1234.56, 0, 0)$q$, 'ok');
-- CPF: a mesma lista de casos do teste de unidade de R.cpfValido (testes/unit/regras_equipe.test.js)
select t('K. cpf_valido: mesmos casos da tela (com pontuação, dígito errado, repetidos, tamanho, vazio, letras e 300 CPFs gerados)', null, $q$do $x$ declare d int; i int; c text; begin set local role none;
  if not public.cpf_valido('529.982.247-25') or not public.cpf_valido('52998224725') then raise exception 'CPF válido recusado'; end if;
  if public.cpf_valido('52998224724') then raise exception 'dígito verificador errado aceito'; end if;
  for d in 0..9 loop if public.cpf_valido(repeat(d::text, 11)) then raise exception 'dígitos repetidos aceitos: %', d; end if; end loop;
  if public.cpf_valido('5299822472') or public.cpf_valido('529982247250') then raise exception 'tamanho errado aceito'; end if;
  if public.cpf_valido(null) or public.cpf_valido('') or public.cpf_valido('abc.def.ghi-jk') then raise exception 'vazio ou letras aceitos'; end if;
  if public.cpf_valido(null) is null then raise exception 'devolveu vazio em vez de falso'; end if;
  for i in 100000000..100000299 loop   -- os mesmos números-base do teste de unidade: 9 primeiros + os dois dígitos calculados
    c := i::text;
    c := c || ((((select sum(substr(c, k, 1)::int * (11 - k)) from generate_series(1, 9) k) * 10) % 11) % 10)::text;
    c := c || ((((select sum(substr(c, k, 1)::int * (12 - k)) from generate_series(1, 10) k) * 10) % 11) % 10)::text;
    if not public.cpf_valido(c) then raise exception 'CPF gerado recusado: %', c; end if;
    if public.cpf_valido(left(c, 10) || ((right(c, 1)::int + 1) % 10)::text) then raise exception 'último dígito trocado aceito: %', c; end if;
  end loop; end $x$$q$, 'ok');
select t('K. ficha nova com dígito do CPF errado é recusada', :BB, b47_fi(30, '96400000030'), 'CPF inválido. Confira os 11 números do CPF da mulher.');
select t('K. ficha nova com CPF válido é aceita', :BB, b47_fi(30, cpf_t(96400000030)), 'ok');
select t('K. ficha ANTIGA com dígito do CPF errado continua podendo ser corrigida e aprovada', :BB, $q$do $x$ declare n int; begin
  update public.fichas set celular = '(74) 96666-0001' where id = 'f4710000-0000-0000-0000-000000000004'; get diagnostics n = row_count; if n <> 1 then raise exception 'não corrigiu'; end if;
  perform b47_como((select user_id from public.equipe where papel = 'coord_tecnico' and status = 'ativa'));
  update public.fichas set situacao = 'aprovada' where id = 'f4710000-0000-0000-0000-000000000004'; get diagnostics n = row_count; if n <> 1 then raise exception 'não aprovou'; end if; end $x$$q$, 'ok');
select t('K. ficha ANTIGA: trocar o CPF por outro com dígito errado é recusado; por um válido, aceito', :G, $q$do $x$ begin
  begin update public.fichas set cpf = '96400000005' where id = 'f4710000-0000-0000-0000-000000000004'; raise exception 'aceitou CPF errado';
  exception when others then if sqlerrm not like 'CPF inválido%' then raise; end if; end;
  update public.fichas set cpf = cpf_t(96400000044) where id = 'f4710000-0000-0000-0000-000000000004'; end $x$$q$, 'ok');
select t('K. cadastro novo na equipe com dígito do CPF errado é recusado', :T, $q$insert into public.equipe (papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd) values ('agente', 'BA', 'Agente CPF Errado', '96400000111', 'b47.cpf@t.com', '(74) 99999-0000', public.fic_hoje(), true)$q$, 'CPF inválido. Confira os 11 números.');
select t('K. cadastro pelo link com dígito do CPF errado é recusado', null, format($q$select public.enviar_pre_cadastro(%L, jsonb_build_object('nome', 'Pessoa CPF Errado', 'cpf', '964.000.001-11', 'email', 'cpf.errado@t.com', 'data_nascimento', '1990-01-01', 'consentimento_lgpd', true))$q$, 'b47link' || md5('3')), 'CPF inválido. Confira os 11 números.');
select t('K. cadastro pelo link com menos de 16 anos é recusado (a mesma regra da tela)', null, format($q$select public.enviar_pre_cadastro(%L, jsonb_build_object('nome', 'Pessoa Muito Nova', 'cpf', %L, 'email', 'nova.demais@t.com', 'data_nascimento', %L, 'consentimento_lgpd', true))$q$,
  'b47link' || md5('3'), cpf_t(96400000302), ((now() at time zone 'America/Fortaleza')::date - interval '15 years')::date), 'é preciso ter pelo menos 16 anos');
select t('K. cadastro pelo link válido continua entrando', null, format($q$select public.enviar_pre_cadastro(%L, jsonb_build_object('nome', 'Pessoa Certa Pelo Link', 'cpf', %L, 'email', 'certa@t.com', 'data_nascimento', '1990-01-01', 'consentimento_lgpd', true))$q$,
  'b47link' || md5('3'), cpf_t(96400000303)), 'ok');

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
-- arruma o que o teste deixou (o teste seguinte não depende destes registros)
drop function b47_como(uuid), b47_fi(int, text, text, text, text);
