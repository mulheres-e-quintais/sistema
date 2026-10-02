-- Atomicidade: cada operação que grava em mais de uma tabela ou é tudo, ou é nada.
-- Para cada função (ou gravação com gatilhos em cascata) o teste:
--   1. CONTROLE: roda o comando sem falha e confere que ele funciona e muda o banco (depois desfaz);
--   2. SABOTAGEM: pendura um gatilho de teste no ÚLTIMO passo da operação, que falha de propósito e informa quantas
--      linhas do PRIMEIRO passo já estavam gravadas naquele instante ("antes=N", N >= 1: a falha foi mesmo no meio);
--   3. confere que o comando devolveu erro e que o banco ficou IGUAL ao que era (conteúdo de 22 tabelas + contagem do histórico).
-- Também confere falhas naturais (segundo item inválido, teto estourado) e que o erro num gatilho desfaz a linha do histórico.
-- Roda TUDO dentro de uma transação que é desfeita no fim: não deixa nada no banco, pode repetir à vontade.
-- Precisa dos scripts 01–47 instalados num banco de TESTE (monta o próprio cenário, no estado SE). NUNCA em produção.
-- Uso: psql -X -q -d <banco de teste> -f atomicidade_bd.sql      Saída: PASSOU/FALHOU por caso e a contagem final.
-- "FALHA CONHECIDA" = problema já relatado, ainda sem correção: não conta como regressão. (Desde o 47 não há nenhuma: a aprovação
-- do cadastro pelo link, que eram 3 chamadas da tela, virou a função aprovar_pre_cadastro.)
\set QUIET on
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
set client_min_messages = warning;
begin;
create temp table at_res (n serial, caso text, r text, det text) on commit drop;
create temp table at_id (k text primary key, v uuid) on commit drop;
grant select on at_id to authenticated, anon;

-- ---------- ferramentas ----------
create function public._bd_sabota() returns trigger language plpgsql security definer set search_path = public as $$
declare n bigint;
begin execute tg_argv[0] into n; raise exception 'SABOTAGEM antes=%', n; end $$;

create function pg_temp.estado() returns text language plpgsql as $$
declare t text; h text := ''; x text;
begin
  perform set_config('role', 'none', true);
  foreach t in array array['equipe','equipe_privado','equipe_bancario','fichas','visitas','diagnosticos','avaliacoes','solicitacoes_pagamento','solicitacao_visitas','pedidos_apoio',
      'turmas_fic','matriculas_fic','fic_encontros','fic_presencas','convites','pre_cadastros','acesso_codigos','contas_ja_ligadas','pedidos_novo_acesso','custos_visita','entregas_mes','agua_situacoes'] loop
    execute format('select coalesce(md5(string_agg(md5(x::text), '''' order by md5(x::text))), ''-'') from public.%I x', t) into x;
    h := h || t || '=' || x || ';';
  end loop;
  select h || 'users=' || coalesce(md5(string_agg(id::text, '' order by id)), '-') || ';aud=' || (select count(*) from public.auditoria) into h from auth.users;
  return md5(h);
end $$;
-- executa como a pessoa (uuid do login; nulo = sem login; ffffffff-... = dono do banco). Devolve 'ok' ou o erro. Com erro, nada do comando fica.
create function pg_temp.tenta(quem uuid, cmd text) returns text language plpgsql as $$
begin
  if quem is distinct from 'ffffffff-ffff-ffff-ffff-ffffffffffff' then
    perform set_config('request.jwt.claim.sub', coalesce(quem::text, ''), true);
    perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
  end if;
  execute cmd;
  perform set_config('role', 'none', true); perform set_config('request.jwt.claim.sub', '', true);
  return 'ok';
exception when others then
  perform set_config('role', 'none', true); perform set_config('request.jwt.claim.sub', '', true);
  return sqlerrm;
end $$;
-- controle: o comando funciona? muda o banco? (desfaz em seguida)
create function pg_temp.controle(quem uuid, cmd text, out r text, out mudou boolean) language plpgsql as $$
declare h0 text := pg_temp.estado(); m text;
begin
  begin
    r := pg_temp.tenta(quem, cmd);
    raise exception 'DESFAZ|%|%', r, pg_temp.estado();
  exception when others then m := sqlerrm;
  end;
  r := split_part(m, '|', 2); mudou := split_part(m, '|', 3) <> h0;
end $$;
-- caso com sabotagem. p_onde: 'before insert on public.x' etc.; p_quando: condição do gatilho (ou ''); p_sonda: select que conta o que já estava gravado
create function pg_temp.caso(p_nome text, quem uuid, cmd text, p_onde text, p_quando text, p_sonda text) returns void language plpgsql as $$
declare c record; h0 text; h1 text; r text; antes int; ok boolean; tab text := split_part(p_onde, ' on ', 2);
begin
  select * into c from pg_temp.controle(quem, cmd);
  h0 := pg_temp.estado();
  execute format('create trigger zz_sabota %s for each row %s execute function public._bd_sabota(%L)', p_onde, case when p_quando <> '' then 'when (' || p_quando || ')' else '' end, p_sonda);
  r := pg_temp.tenta(quem, cmd);
  execute format('drop trigger zz_sabota on %s', tab);
  h1 := pg_temp.estado();
  antes := nullif(substring(r from 'SABOTAGEM antes=(\d+)'), '')::int;
  ok := c.r = 'ok' and c.mudou and antes >= 1 and h0 = h1;
  insert into at_res (caso, r, det) values (p_nome, case when ok then 'PASSOU' else 'FALHOU' end,
    format('controle: %s%s; com a falha no último passo: %s; banco %s', left(c.r, 120), case when c.mudou then '' else ' (NÃO mudou o banco)' end, left(r, 160),
           case when h0 = h1 then 'igual ao de antes' else 'DIFERENTE do de antes (ficou coisa pela metade)' end));
end $$;
-- caso de falha natural: o comando tem de dar erro com o trecho esperado e não deixar nada
create function pg_temp.recusa(p_nome text, quem uuid, cmd text, p_trecho text) returns void language plpgsql as $$
declare h0 text := pg_temp.estado(); r text := pg_temp.tenta(quem, cmd); h1 text := pg_temp.estado();
begin
  insert into at_res (caso, r, det) values (p_nome, case when r <> 'ok' and r ilike '%' || p_trecho || '%' and h0 = h1 then 'PASSOU' else 'FALHOU' end,
    left(r, 200) || case when h0 = h1 then '' else ' | banco DIFERENTE do de antes' end);
end $$;

-- ---------- cenário (como dono do banco, sem os gatilhos) ----------
do $c$
declare hoje date := (now() at time zone 'America/Fortaleza')::date; mes date := hoje - (extract(day from hoje)::int - 1); m1 date := (mes - interval '1 month')::date; ini date := (mes - interval '3 months')::date;
        r record; e public.equipe; u uuid; i int; p text; fi uuid; n int := 0;
        A constant text := 'bda00000-0000-4000-8000-0000000000';
begin
  set local session_replication_role = replica;
  -- funções únicas: usa quem já existe (com um login de teste, se faltar) ou cria; no fim tudo é desfeito
  for r in select * from (values ('G', 'coord_geral', null), ('T', 'coord_tecnico', null), ('X', 'auxiliar_adm', null), ('ART', 'articulacao', 'SE')) v(k, papel, uf) loop
    n := n + 1;
    select * into e from public.equipe q where q.papel = r.papel and q.uf is not distinct from r.uf and q.status = 'ativa' limit 1;
    if e.id is null then
      insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em)
      values ((A || '0' || n)::uuid, r.papel, r.uf, 'Pessoa Atômica ' || r.k, '9800000000' || n, 'bda.' || lower(r.k) || '@teste.invalid', ini, true, ini, ini, ini) returning * into e;
    else
      update public.equipe set matricula_fic_em = coalesce(matricula_fic_em, ini), docs_funcern_em = coalesce(docs_funcern_em, ini), termo_assinado_em = coalesce(termo_assinado_em, ini),
        data_inicio = least(data_inicio, ini) where id = e.id;
    end if;
    if e.user_id is null then
      u := (A || '9' || n)::uuid; insert into auth.users (id, email) values (u, e.email::text); update public.equipe set user_id = u where id = e.id; e.user_id := u;
    end if;
    insert into at_id values (r.k, e.id), ('u' || r.k, e.user_id);
  end loop;
  -- agentes AG1..AG4 de SE e o professor (AG3: sem login, sem matrícula, com código de primeiro acesso)
  for i in 1..5 loop
    p := case when i = 5 then 'PROF' else 'AG' || i end;
    insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_assinado_em)
    values ((A || '1' || i)::uuid, case when i = 5 then 'professor_fic' else 'agente' end, case when i < 5 then 'SE' end, 'Pessoa Atômica ' || p, '9800000001' || i,
            'bda.' || lower(p) || '@teste.invalid', ini, true, case when i in (1, 2, 4) then ini end, case when i in (1, 2, 4) then 'BDA-00' || i end, ini, ini);
    insert into at_id values (p, (A || '1' || i)::uuid);
    if i <> 3 then
      insert into auth.users (id, email) values ((A || '8' || i)::uuid, 'bda.' || lower(p) || '@teste.invalid');
      update public.equipe set user_id = (A || '8' || i)::uuid where id = (A || '1' || i)::uuid;
      insert into at_id values ('u' || p, (A || '8' || i)::uuid);
    end if;
  end loop;
  insert into public.acesso_codigos (equipe_id, hash, expira_em) values ((A || '13')::uuid, 'hash-de-teste', now() + interval '7 days');
  -- turma e matrículas
  insert into public.turmas_fic (id, nome, inicio, professor_id) values ((A || '20')::uuid, 'Turma Atômica', ini, (A || '15')::uuid);
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em)
  select (A || '2' || j)::uuid, (A || '20')::uuid, (A || '1' || j)::uuid, 'BDA-00' || j, ini from unnest(array[1, 2, 4]) j;
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em) select (A || '29')::uuid, (A || '20')::uuid, v, 'BDA-ART', ini from at_id where k = 'ART'
    on conflict do nothing;
  -- fichas F1..F4 (F3: lista de espera aguardando a coordenação; as outras selecionadas e aprovadas)
  for i in 1..4 loop
    insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco,
        c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao)
    values ((A || '3' || i)::uuid, 'SE', 'Município Atômico', 'Comunidade Atômica', 'Maria Atômica ' || i, '9810000000' || i, '1980-01-01', 'Sítio ' || i, true, true, true, true, true, true, true,
        true, true, true, case when i = 3 then 'lista_espera' else 'selecionada' end, ini, case when i = 3 then 'aguardando' else 'aprovada' end);
  end loop;
  -- visitas: 4x = AG1 no quintal 1 (mês passado); 5x = AG2 no quintal 2 (mês passado); 49 = AG1 hoje (outro mês); 61 = diagnóstico agendado do quintal 4 (AG1)
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato)
  select (A || (3 + q) || et)::uuid, (A || '3' || q)::uuid, 'SE', (array['diagnostico','implantacao','acompanhamento'])[et], (A || '1' || q)::uuid, m1 + et, m1 + et, 'realizada', 'Visita feita com a família, tudo conferido.'
    from generate_series(1, 2) q, generate_series(1, 3) et;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato) values
    ((A || '49')::uuid, (A || '31')::uuid, 'SE', 'acompanhamento', (A || '11')::uuid, hoje, hoje, 'realizada', 'Segundo acompanhamento, feito hoje com a família.'),
    ((A || '61')::uuid, (A || '34')::uuid, 'SE', 'diagnostico', (A || '11')::uuid, hoje, null, 'prevista', null);
  -- pagamentos de AG2: 71 = solicitada com as visitas 51 e 52; 72 = devolvida; 73 = avalizada
  insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, situacao, aval_por, aval_em, obs_aval, detalhe) values
    ((A || '71')::uuid, 'ajuda_custo', (A || '12')::uuid, m1, 200, null, 'solicitada', null, null, null, '{"total": 200}'),
    ((A || '72')::uuid, 'ajuda_custo', (A || '12')::uuid, m1, 100, null, 'devolvida', (select v from at_id where k = 'T'), now(), 'Corrija o valor', '{"total": 100, "complementar": true}'),
    ((A || '73')::uuid, 'ajuda_custo', (A || '12')::uuid, (m1 - interval '1 month')::date, 100, 100, 'avalizada', (select v from at_id where k = 'T'), now(), null, '{"total": 100}');
  insert into public.solicitacao_visitas (visita_id, solicitacao_id) values ((A || '51')::uuid, (A || '71')::uuid), ((A || '52')::uuid, (A || '71')::uuid);
  -- link de cadastro (81) e cadastro enviado por outro link (82/83); pedidos de passagem: 91 conferido, 92 enviado, 93 conferido acima do teto
  insert into public.convites (id, token, papel, uf, criado_por) values ((A || '81')::uuid, 'bda-token-atomicidade-1', 'agente', 'SE', (select v from at_id where k = 'T'));
  insert into public.convites (id, token, papel, uf, criado_por, usado_em) values ((A || '82')::uuid, 'bda-token-atomicidade-2', 'agente', 'SE', (select v from at_id where k = 'T'), now());
  insert into public.pre_cadastros (id, convite_id, papel, uf, nome, cpf, email, consentimento_lgpd, data_nascimento)
    values ((A || '83')::uuid, (A || '82')::uuid, 'agente', 'SE', 'Joana Pelo Link Atômica', '98000002167', 'bda.link@teste.invalid', true, '1990-01-01');
  insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, conferido_por, conferido_em, valor_autorizado)
  select (A || '9' || j)::uuid, 'passagem', 'SE', (select v from at_id where k = 'ART'), 'Pedido atômico ' || j || ': intercâmbio', hoje + 60,
         jsonb_build_object('valor_estimado', 500, 'finalidade', 'intercambio'), case when j = 2 then 'enviado' else 'conferido' end,
         case when j <> 2 then (select v from at_id where k = 'T') end, case when j <> 2 then now() end, case when j = 3 then 70001 end from generate_series(1, 3) j;
end $c$;
set local session_replication_role = origin;
-- valores usados nos comandos
select set_config('bd.hoje', ((now() at time zone 'America/Fortaleza')::date)::text, true) \g /dev/null
select set_config('bd.m1', ((date_trunc('month', (now() at time zone 'America/Fortaleza')::date) - interval '1 month')::date)::text, true) \g /dev/null
create function pg_temp.i(p text) returns uuid language sql as $$ select v from at_id where k = p $$;
create function pg_temp.a(p text) returns uuid language sql as $$ select ('bda00000-0000-4000-8000-0000000000' || p)::uuid $$;

-- ---------- 1. solicitar_pagamento: pedido + visitas do pedido ----------
select pg_temp.caso('solicitar_pagamento: falha na 2ª visita não deixa o pedido nem a 1ª visita', pg_temp.i('uAG1'),
  format($q$select public.solicitar_pagamento('ajuda_custo', %L, 150, null, array[%L, %L]::uuid[], '{"total": 150}')$q$, current_setting('bd.m1'), pg_temp.a('41'), pg_temp.a('42')),
  'before insert on public.solicitacao_visitas', format('new.visita_id = %L', pg_temp.a('42')),
  format('select count(*) from public.solicitacoes_pagamento where equipe_id = %L', pg_temp.a('11')));
select pg_temp.recusa('solicitar_pagamento: segunda visita inválida (de outro mês) recusa o pedido inteiro', pg_temp.i('uAG1'),
  format($q$select public.solicitar_pagamento('ajuda_custo', %L, 150, null, array[%L, %L]::uuid[], '{"total": 150}')$q$, current_setting('bd.m1'), pg_temp.a('41'), pg_temp.a('49')), 'Há visita que não é sua');
select pg_temp.caso('solicitar_pagamento (reenvio do devolvido): falha ao gravar as visitas mantém o pedido devolvido', pg_temp.i('uAG2'),
  format($q$select public.solicitar_pagamento('ajuda_custo', %L, 90, null, array[%L]::uuid[], '{"total": 90}')$q$, current_setting('bd.m1'), pg_temp.a('53')),
  'before insert on public.solicitacao_visitas', format('new.visita_id = %L', pg_temp.a('53')),
  format('select count(*) from public.solicitacoes_pagamento where id = %L and situacao = ''solicitada''', pg_temp.a('72')));
-- ---------- 2. aval e lançamento no Arlo ----------
select pg_temp.caso('avalizar_pagamento (devolver): falha ao soltar as visitas mantém o pedido como estava', pg_temp.i('uT'),
  format($q$select public.avalizar_pagamento(%L, false, 'Corrija o km da segunda visita', null)$q$, pg_temp.a('71')),
  'before delete on public.solicitacao_visitas', '', format('select count(*) from public.solicitacoes_pagamento where id = %L and situacao = ''devolvida''', pg_temp.a('71')));
select pg_temp.caso('avalizar_pagamento (aval): falha no histórico desfaz o aval', pg_temp.i('uT'),
  format($q$select public.avalizar_pagamento(%L, true, null, 200)$q$, pg_temp.a('71')),
  'before insert on public.auditoria', 'new.tabela = ''solicitacoes_pagamento''', format('select count(*) from public.solicitacoes_pagamento where id = %L and situacao = ''avalizada''', pg_temp.a('71')));
select pg_temp.caso('registrar_no_arlo: falha no histórico desfaz o lançamento', pg_temp.i('uX'),
  format($q$select public.registrar_no_arlo(%L, 'ARLO-ATOMICO')$q$, pg_temp.a('73')),
  'before insert on public.auditoria', 'new.tabela = ''solicitacoes_pagamento''', format('select count(*) from public.solicitacoes_pagamento where id = %L and situacao = ''lancada''', pg_temp.a('73')));
-- ---------- 3. passagens e eventos ----------
select pg_temp.caso('salvar_pedido_apoio: falha no histórico não deixa o pedido', pg_temp.i('uART'),
  format($q$select public.salvar_pedido_apoio(null, 'evento', 'Encontro atômico de mulheres', %L, '{"valor_estimado": 800}', null)$q$, current_setting('bd.hoje')::date + 90),
  'before insert on public.auditoria', 'new.tabela = ''pedidos_apoio''', 'select count(*) from public.pedidos_apoio where titulo = ''Encontro atômico de mulheres''');
select pg_temp.caso('mover_pedido_apoio (autorizar): falha no histórico desfaz a autorização e o valor', pg_temp.i('uG'),
  format($q$select public.mover_pedido_apoio(%L, 'autorizar', null, 'PROT-1')$q$, pg_temp.a('91')),
  'before insert on public.auditoria', 'new.tabela = ''pedidos_apoio''', format('select count(*) from public.pedidos_apoio where id = %L and situacao = ''autorizado'' and valor_autorizado = 500', pg_temp.a('91')));
select pg_temp.recusa('mover_pedido_apoio (autorizar): acima do teto recusa e não muda o pedido', pg_temp.i('uG'),
  format($q$select public.mover_pedido_apoio(%L, 'autorizar', null, null)$q$, pg_temp.a('93')), 'Passa do teto');
-- ---------- 4. curso FIC ----------
select pg_temp.caso('matricular_fic: falha ao marcar a pessoa não deixa a matrícula', pg_temp.i('uPROF'),
  format($q$select public.matricular_fic(%L, %L, 'BDA-777', %L)$q$, pg_temp.a('20'), pg_temp.a('13'), current_setting('bd.hoje')),
  'before update on public.equipe', 'new.matricula_fic_numero = ''BDA-777''', 'select count(*) from public.matriculas_fic where numero = ''BDA-777''');
select pg_temp.caso('cancelar_matricula_fic: falha ao desmarcar a pessoa mantém a matrícula', pg_temp.i('uPROF'),
  format($q$select public.cancelar_matricula_fic(%L, 'Matrícula lançada na turma errada')$q$, pg_temp.a('24')),
  'before update on public.equipe', format('new.id = %L and new.matricula_fic_em is null', pg_temp.a('14')),
  format('select count(*) from public.matriculas_fic where id = %L and cancelada_em is not null', pg_temp.a('24')));
select pg_temp.caso('registrar_encontro_fic: falha numa presença não deixa o encontro nem as outras presenças', pg_temp.i('uPROF'),
  format($q$select public.registrar_encontro_fic(null, %L, %L, 2, 'presencial', 'Encontro atômico: manejo do solo', array[%L, %L]::uuid[])$q$, pg_temp.a('20'), current_setting('bd.hoje'), pg_temp.a('11'), pg_temp.a('12')),
  'before insert on public.fic_presencas', format('new.equipe_id = %L', pg_temp.a('14')), 'select count(*) from public.fic_encontros where conteudo = ''Encontro atômico: manejo do solo''');
select pg_temp.recusa('registrar_encontro_fic: presente que não é da turma recusa tudo', pg_temp.i('uPROF'),
  format($q$select public.registrar_encontro_fic(null, %L, %L, 2, 'presencial', 'Encontro atômico: manejo do solo', array[%L, %L]::uuid[])$q$, pg_temp.a('20'), current_setting('bd.hoje'), pg_temp.a('11'), pg_temp.a('13')),
  'Só entra na lista de presença');
-- ---------- 5. link de cadastro e primeiro acesso ----------
select pg_temp.caso('enviar_pre_cadastro: falha ao marcar o link como usado não deixa o cadastro enviado', null,
  $q$select public.enviar_pre_cadastro('bda-token-atomicidade-1', '{"nome": "Nova Agente Atômica", "cpf": "98000003139", "email": "bda.nova@teste.invalid", "consentimento_lgpd": true, "data_nascimento": "1990-01-01"}')$q$,
  'before update on public.convites', 'new.usado_em is not null', 'select count(*) from public.pre_cadastros where cpf = ''98000003139''');
select pg_temp.caso('gerar_codigo_acesso (novo primeiro acesso): falha no histórico mantém o login antigo e não deixa código', pg_temp.i('uG'),
  format('select public.gerar_codigo_acesso(%L)', pg_temp.a('14')),
  'before insert on public.auditoria', 'new.tabela = ''acesso_codigos''', format('select count(*) from public.acesso_codigos where equipe_id = %L', pg_temp.a('14')));
select pg_temp.caso('primeiro acesso (conta criada): falha no último passo não liga a conta nem apaga o código', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  $q$insert into auth.users (id, email) values ('bda00000-0000-4000-8000-000000000083', 'bda.ag3@teste.invalid')$q$,
  'before insert on public.contas_ja_ligadas', '', format('select count(*) from public.equipe where id = %L and user_id is not null', pg_temp.a('13')));
-- ---------- 6. desligamento e os seus efeitos (matrícula cancelada, pedidos cancelados) ----------
select pg_temp.caso('desligamento: falha ao cancelar os pedidos mantém a pessoa ativa e a matrícula', pg_temp.i('uT'),
  format($q$update public.equipe set status = 'desligada', data_fim = %L, motivo_desligamento = 'Saiu do projeto' where id = %L$q$, current_setting('bd.hoje'), pg_temp.i('ART')),
  'before update on public.pedidos_apoio', 'new.situacao = ''cancelado''', format('select count(*) from public.matriculas_fic where equipe_id = %L and cancelada_em is not null and motivo_cancelamento like ''Cancelada pelo sistema%%''', pg_temp.i('ART')));
-- ---------- 7. decidir ficha; diagnóstico + visita "realizada"; erro em gatilho desfaz também o histórico ----------
select pg_temp.caso('decidir ficha: falha no histórico desfaz a aprovação', pg_temp.i('uT'),
  format('update public.fichas set situacao = ''aprovada'' where id = %L', pg_temp.a('33')),
  'before insert on public.auditoria', 'new.tabela = ''fichas''', format('select count(*) from public.fichas where id = %L and situacao = ''aprovada''', pg_temp.a('33')));
select pg_temp.caso('decidir ficha: erro num gatilho DEPOIS do histórico desfaz também a linha do histórico', pg_temp.i('uT'),
  format('update public.fichas set situacao = ''aprovada'' where id = %L', pg_temp.a('33')),
  'after update on public.fichas', '', format('select count(*) from public.auditoria where tabela = ''fichas'' and registro_id = %L', pg_temp.a('33')));
select pg_temp.caso('diagnóstico: falha ao marcar a visita como feita não deixa o diagnóstico', pg_temp.i('uAG1'),
  format($q$insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, area_m2, agua_seca, lote, dados)
    values ('bda00000-0000-4000-8000-000000000099', %L, %L, 'SE', %L, -10.5, -37.2, 200, 'sim', 1, '{"kit": [{"item": "Tela", "qtd": "5", "valor": 400}]}')$q$, pg_temp.a('34'), pg_temp.a('61'), current_setting('bd.hoje')),
  'before update on public.visitas', format('new.id = %L and new.situacao = ''realizada''', pg_temp.a('61')), format('select count(*) from public.diagnosticos where ficha_id = %L', pg_temp.a('34')));
select pg_temp.caso('dados bancários: falha no histórico não deixa a conta gravada', pg_temp.i('uAG1'),
  $q$select public.salvar_meus_dados_bancarios('{"banco_codigo": "001", "banco_nome": "Banco do Brasil", "agencia": "1234", "conta": "56789", "conta_dv": "0"}')$q$,
  'before insert on public.auditoria', 'new.tabela = ''equipe_bancario''', format('select count(*) from public.equipe_bancario where equipe_id = %L', pg_temp.a('11')));

-- ---------- 8. aprovar o cadastro enviado pelo link: UMA operação (aprovar_pre_cadastro, do 47_auditoria_bd.sql) ----------
-- Até o 46 a tela fazia 3 chamadas separadas (pessoa na equipe; dados pessoais; cadastro enviado aprovado): se a rede caía no
-- meio, a pessoa ficava na equipe e o cadastro enviado continuava "aguardando". Agora é uma função só: tudo ou nada.
select set_config('bd.eq', format('{"papel": "agente", "uf": "SE", "nome": "Joana Pelo Link Atômica", "cpf": "%s", "email": "bda.link@teste.invalid", "data_inicio": "%s", "consentimento_lgpd": true}', '98000002167', current_setting('bd.hoje')), true) \g /dev/null
select pg_temp.caso('aprovar_pre_cadastro: falha ao marcar o cadastro enviado como aprovado não deixa a pessoa na equipe nem os dados pessoais', pg_temp.i('uT'),
  format($q$select public.aprovar_pre_cadastro(%L, %L, '{"data_nascimento": "1990-01-01", "endereco": {"cidade": "Aracaju"}}')$q$, pg_temp.a('83'), current_setting('bd.eq')),
  'before update on public.pre_cadastros', '', $q$select count(*) from public.equipe where cpf = '98000002167'$q$);
select pg_temp.caso('aprovar_pre_cadastro: falha ao gravar os dados pessoais não deixa a pessoa na equipe', pg_temp.i('uT'),
  format($q$select public.aprovar_pre_cadastro(%L, %L, '{"data_nascimento": "1990-01-01", "endereco": {"cidade": "Aracaju"}}')$q$, pg_temp.a('83'), current_setting('bd.eq')),
  'before insert on public.equipe_privado', '', $q$select count(*) from public.equipe where cpf = '98000002167'$q$);
select pg_temp.recusa('aprovar_pre_cadastro: dados pessoais inválidos (menos de 16 anos) recusam a aprovação inteira', pg_temp.i('uT'),
  format($q$select public.aprovar_pre_cadastro(%L, %L, '{"data_nascimento": "2020-01-01"}')$q$, pg_temp.a('83'), current_setting('bd.eq')), 'Data de nascimento inválida');
do $k$
declare r text; sit text; priv int;
begin
  r := pg_temp.tenta(pg_temp.i('uT'), format($q$select public.aprovar_pre_cadastro(%L, %L, '{"data_nascimento": "1990-01-01", "endereco": {"cidade": "Aracaju"}}')$q$, pg_temp.a('83'), current_setting('bd.eq')));
  select situacao into sit from public.pre_cadastros where id = pg_temp.a('83');
  select count(*) into priv from public.equipe_privado p join public.equipe e on e.id = p.equipe_id where e.cpf = '98000002167';
  insert into at_res (caso, r, det) values ('aprovar cadastro do link: uma chamada inclui a pessoa, leva os dados pessoais e resolve o cadastro enviado',
    case when r = 'ok' and sit = 'aprovado' and priv = 1 then 'PASSOU' else 'FALHOU' end,
    format('chamada: %s; cadastro enviado ficou "%s"; dados pessoais gravados: %s.', left(r, 120), sit, priv));
end $k$;

-- ---------- resultado ----------
select r || ' | ' || caso || E'\n         ' || det from at_res order by n;
select case when count(*) filter (where r = 'FALHOU') = 0 then 'PASSOU' else 'FALHOU' end || ' | atomicidade: ' || count(*) filter (where r = 'PASSOU') || ' de ' || count(*) filter (where r <> 'FALHA CONHECIDA')
       || ' casos' || case when count(*) filter (where r = 'FALHA CONHECIDA') > 0 then '; ' || count(*) filter (where r = 'FALHA CONHECIDA') || ' falha(s) conhecida(s) (operação da tela em várias chamadas)' else '' end from at_res;
rollback;
