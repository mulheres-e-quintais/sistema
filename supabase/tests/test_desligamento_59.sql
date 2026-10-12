-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, t()):
-- 59_corrige_desligamento.sql: as duas travas do desligamento valem juntas.
\set QUIET on
truncate res;
-- visita AGENDADA (prevista) para a agente ag1, plantada como dono dentro do caso (volta atrás no fim)
\set PREV 'set local role none; set local session_replication_role = replica; insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao) select gen_random_uuid(), gen_random_uuid(), e.uf, ''acompanhamento'', e.id, public.fic_hoje() + 3, ''prevista'' from public.equipe e where e.email = ''ag1@t.com'' and e.status = ''ativa''; set local session_replication_role = origin; perform set_config(''role'', ''authenticated'', true);'
\set FEITA 'set local role none; set local session_replication_role = replica; insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao, data_realizada, relato) select gen_random_uuid(), gen_random_uuid(), e.uf, ''acompanhamento'', e.id, public.fic_hoje(), ''realizada'', public.fic_hoje(), ''Visita de acompanhamento feita.'' from public.equipe e where e.email = ''ag1@t.com'' and e.status = ''ativa''; set local session_replication_role = origin; perform set_config(''role'', ''authenticated'', true);'
select t('59. visita AGENDADA impede o desligamento de novo (trava do 08 de volta)', :T, format($q$do $x$ begin %s
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Pediu para sair' where email = 'ag1@t.com' and status = 'ativa'; end $x$$q$, :'PREV'), '1 visita(s) agendada(s) com ela');
select t('59. visita FEITA sem pedido também impede (trava do 57 continua)', :T, format($q$do $x$ begin %s
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Pediu para sair' where email = 'ag1@t.com' and status = 'ativa'; end $x$$q$, :'FEITA'), 'visita(s) feita(s) sem pedido');
select t('59. "desligar assim mesmo" não passa por cima da visita agendada', :G, format($q$do $x$ begin %s %s
  perform public.desligar_sem_pedido((select id from public.equipe where email = 'ag1@t.com' and status = 'ativa'), public.fic_hoje(), 'Abandono', 'Não responde há 30 dias, mensagens e ligações sem retorno.'); end $x$$q$, :'PREV', :'FEITA'), 'visita(s) agendada(s)');
select t('59. "desligar assim mesmo" com só pagamento pendente funciona (coordenação geral)', :G, format($q$do $x$ begin %s
  perform public.desligar_sem_pedido((select id from public.equipe where email = 'ag1@t.com' and status = 'ativa'), public.fic_hoje(), 'Abandono', 'Não responde há 30 dias, mensagens e ligações sem retorno.'); end $x$$q$, :'FEITA'), 'ok');
select t('59. "desligar assim mesmo" sem pendência é recusado (sem histórico falso)', :G, $q$select public.desligar_sem_pedido((select id from public.equipe where email = 'aux@t.com' and status = 'ativa'), public.fic_hoje(), 'Outro', 'Justificativa com mais de vinte letras.')$q$, 'não tem pagamento a pedir');
select t('59. a coordenação geral não se desliga por "desligar assim mesmo"', :G, $q$select public.desligar_sem_pedido(public.meu_id(), public.fic_hoje(), 'Outro', 'Justificativa com mais de vinte letras.')$q$, 'coordenação geral não é desligada');
select t('59. os dois gatilhos usam funções diferentes', null, $q$do $x$ begin set local role none;
  if (select count(distinct tgfoid) from pg_trigger where not tgisinternal and tgname in ('equipe_desligar_pendencias', 'a1_desligar_pendencias')) <> 2 then raise exception 'mesma função'; end if; end $x$$q$, 'ok');
select n || '|' || case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || coalesce(det, '') from res order by n;
