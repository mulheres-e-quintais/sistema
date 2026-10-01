-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 42_revisao_seguranca.sql. Cada caso roda dentro de t(), que desfaz tudo no fim.
\set QUIET on
truncate res;
-- cenário: uma visita de diagnóstico ainda prevista (cópia de uma existente) e um pagamento aguardando aval
set session_replication_role = replica;
do $x$ declare cols text; begin
  select string_agg(quote_ident(column_name), ',') into cols from information_schema.columns where table_schema = 'public' and table_name = 'fichas' and is_generated = 'NEVER';
  execute format('insert into public.fichas (%s) select %s from jsonb_populate_record(null::public.fichas, (select to_jsonb(f) || jsonb_build_object(''id'', gen_random_uuid(), ''nome'', ''Teste Revisao'', ''cpf'', ''73412589691'', ''resultado'', ''selecionada'', ''situacao'', ''aprovada'') from public.fichas f limit 1))', cols, cols);
end $x$;
insert into public.visitas select (jsonb_populate_record(null::public.visitas, to_jsonb(v) || jsonb_build_object('id', gen_random_uuid(), 'ficha_id', (select id from public.fichas where nome = 'Teste Revisao'),
  'uf', (select uf from public.fichas where nome = 'Teste Revisao'), 'situacao', 'prevista', 'data_realizada', null))).*
  from public.visitas v where etapa = 'diagnostico' limit 1;
select id as vprev from public.visitas where etapa = 'diagnostico' and situacao = 'prevista' limit 1 \gset
select id as dg from public.diagnosticos limit 1 \gset
select id as tec from public.equipe where user_id = :T and status = 'ativa' \gset
insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, situacao)
  values ('bolsa', :'tec', date_trunc('month', current_date)::date - interval '1 month', 1400, 'solicitada');
select id as sol from public.solicitacoes_pagamento where equipe_id = :'tec' and situacao = 'solicitada' limit 1 \gset
select id as ped from public.pedidos_apoio where situacao = 'conferido' limit 1 \gset
set session_replication_role = origin;

select t('fuso do banco é o de Fortaleza', null, $q$do $x$ begin set local role none;
  if current_setting('timezone') <> 'America/Fortaleza' then raise exception 'fuso %', current_setting('timezone'); end if; end $x$$q$, 'ok');
-- 2. visita de diagnóstico sem formulário
select t('visita de diagnóstico NÃO vira realizada sem o formulário', :G, format($q$update public.visitas set situacao = 'realizada', data_realizada = current_date where id = %L$q$, :'vprev'), 'próprio formulário');
select t('visita NÃO é realizada no futuro', :G, format($q$update public.visitas set situacao = 'realizada', data_realizada = current_date + 3 where id = %L$q$, :'vprev'), 'futuro');
-- 3. diagnóstico: campos fixos e data
select t('corrigir diagnóstico NÃO troca quem fez a visita', null, format($q$do $x$ declare antes uuid; depois uuid; begin set local role none;
  select executor_id into antes from public.diagnosticos where id = %L;
  update public.diagnosticos set executor_id = (select id from public.equipe where papel = 'coord_geral' limit 1), uf = 'SE' where id = %L;
  select executor_id into depois from public.diagnosticos where id = %L;
  if antes is distinct from depois then raise exception 'trocou executor'; end if;
  if (select uf from public.diagnosticos where id = %L) = 'SE' and (select v.uf from public.visitas v join public.diagnosticos d on d.visita_id = v.id where d.id = %L) <> 'SE' then raise exception 'trocou uf'; end if;
  end $x$$q$, :'dg', :'dg', :'dg', :'dg', :'dg'), 'ok');
select t('diagnóstico NÃO tem data de visita no futuro', null, format($q$do $x$ begin set local role none;
  update public.diagnosticos set data_visita = current_date + 2 where id = %L; end $x$$q$, :'dg'), 'futuro');
-- 4. kit
select t('kit acima de R$ 5.000 é recusado pelo banco', null, format($q$do $x$ begin set local role none;
  update public.diagnosticos set sem_agua = false, dados = dados || '{"kit": [{"item": "Tela", "qtd": "10", "valor": 400}, {"item": "Mudas", "qtd": "2,5", "valor": 800}]}'::jsonb where id = %L; end $x$$q$, :'dg'), 'teto é R$ 5.000');
select t('kit dentro do teto passa', null, format($q$do $x$ begin set local role none;
  update public.diagnosticos set sem_agua = false, dados = dados || '{"kit": [{"item": "Tela", "qtd": "5", "valor": 400}, {"item": "Mudas", "qtd": "2,5", "valor": 800}]}'::jsonb where id = %L; end $x$$q$, :'dg'), 'ok');
select t('avaliação continua gravando (a trava do kit não mexe nela)', null, format($q$do $x$ begin set local role none;
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz)
  select gen_random_uuid(), v.ficha_id, v.id, v.uf, current_date, -5.6, -37.8, 'sim' from public.visitas v where v.id = %L; end $x$$q$, :'vprev'), 'ligada à visita de avaliação');
select t('aval de ajuda de custo pode subir quando a coordenação confere o km', null, $q$do $x$ begin set local role none;
  if (select prosrc from pg_proc where proname = 'solic_valor_aval') not like '%new.tipo = ''bolsa''%' then raise exception 'regra vale para todos'; end if; end $x$$q$, 'ok');
-- 5. login
select t('coordenação NÃO troca o login de um cadastro', :G, format($q$update public.equipe set user_id = %L where id = (select id from public.equipe where papel = 'coord_tecnico' and status = 'ativa' limit 1)$q$, :BB), 'não se troca pela tela');
-- 6. trava dos limites existe
select t('limites com trava (fichas e visitas)', null, $q$do $x$ begin set local role none;
  if (select count(*) from pg_trigger where tgname = 'a0_trava_limite') <> 2 then raise exception 'sem trava'; end if; end $x$$q$, 'ok');
-- 7. valor autorizado velho
select t('pedido devolvido perde o valor autorizado antigo', null, format($q$do $x$ begin set local role none;
  update public.pedidos_apoio set valor_autorizado = 100 where id = %L;
  update public.pedidos_apoio set situacao = 'devolvido', obs = 'Corrigir o valor estimado.' where id = %L;
  if (select valor_autorizado from public.pedidos_apoio where id = %L) is not null then raise exception 'ficou o valor velho'; end if; end $x$$q$, :'ped', :'ped', :'ped'), 'ok');
-- 8. aval
select t('aval maior que o pedido é recusado', :G, format($q$select public.avalizar_pagamento(%L, true, null, 2000)$q$, :'sol'), 'passa do valor pedido');
select t('aval zero é recusado', :G, format($q$select public.avalizar_pagamento(%L, true, null, 0)$q$, :'sol'), 'maior que zero');
select t('aval igual ao pedido passa', :G, format($q$select public.avalizar_pagamento(%L, true, null, null)$q$, :'sol'), 'ok');
-- 9. apagar
select t('coordenação geral NÃO apaga ficha', :G, $q$delete from public.fichas where id = (select id from public.fichas limit 1)$q$, 'permission denied');
select t('coordenação geral NÃO apaga pessoa da equipe', :G, $q$delete from public.equipe where papel = 'agente'$q$, 'permission denied');
select t('coordenação geral NÃO apaga pagamento', :G, $q$delete from public.solicitacoes_pagamento$q$, 'permission denied');
-- 10. funções internas
select t('anônimo não executa criar_convite nem matricular_fic', null, $q$do $x$ begin set local role none;
  if exists (select 1 from pg_proc p where p.proname in ('criar_convite','matricular_fic','equipe_para_fic','definir_minha_foto','cancelar_matricula_fic')
               and p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE')) then raise exception 'aberta'; end if; end $x$$q$, 'ok');

set session_replication_role = replica;
delete from public.solicitacoes_pagamento where id = :'sol';
delete from public.visitas where id = :'vprev';
delete from public.fichas where nome = 'Teste Revisao';
set session_replication_role = origin;
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
