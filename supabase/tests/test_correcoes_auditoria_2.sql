-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, :B, :BB, :A, t(), logar()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_correcoes_auditoria_2.sql
-- 57_correcoes_auditoria_2.sql: arquivo de ficha aprovada; bolsa nos 12 meses; desligamento com pendência; vigência das visitas.
\set QUIET on
truncate res;

-- pedaço de comando que, dentro de um t(), planta como dono do banco uma visita feita SEM pedido para o agente ag1
-- (tudo volta atrás no fim do t(), como em todo caso de teste)
\set PLANTA 'set local role none; set local session_replication_role = replica; insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao, data_realizada, relato) select gen_random_uuid(), gen_random_uuid(), e.uf, ''acompanhamento'', e.id, public.fic_hoje(), ''realizada'', public.fic_hoje(), ''Visita de acompanhamento feita no quintal.'' from public.equipe e where e.email = ''ag1@t.com'' and e.status = ''ativa''; set local session_replication_role = origin; perform set_config(''role'', ''authenticated'', true);'

-- conta sem cadastro ativo não recebe nada (nem "pode trocar")
select t('10. conta sem cadastro: a conferência responde "não"', gen_random_uuid(), $q$do $x$ begin
  if public.ficha_arquivo_livre('PI/' || gen_random_uuid() || '/ficha.jpg') then raise exception 'respondeu'; end if; end $x$$q$, 'ok');

-- ===== 10. arquivo de ficha aprovada não se troca
-- cenário próprio (dono do banco, sem gatilhos): uma ficha aprovada, uma aguardando e uma visita agendada
do $x$ begin set session_replication_role = replica;
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao)
  values ('f5700000-0000-0000-0000-000000000001', 'BA', 'Laje', 'Sítio A', 'Maria Teste Aprovada', cpf_t(57000000001), '1980-01-01', 'Sítio A', true, true, true, true, true, true, true, true, true, true, 'selecionada', public.fic_hoje(), 'aprovada'),
         ('f5700000-0000-0000-0000-000000000002', 'BA', 'Laje', 'Sítio B', 'Ana Teste Aguardando', cpf_t(57000000002), '1980-01-01', 'Sítio B', true, true, true, true, true, true, true, true, true, true, 'selecionada', public.fic_hoje(), 'aguardando')
  on conflict (id) do nothing;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao)
  select 'f5700000-0000-0000-0000-000000000011', 'f5700000-0000-0000-0000-000000000001', 'BA', 'diagnostico', e.id, public.fic_hoje() + 3, 'prevista'
    from public.equipe e where e.email = 'art.ba@t.com' and e.status = 'ativa' on conflict (id) do nothing;
  set session_replication_role = origin; end $x$;
\set f_aprov f5700000-0000-0000-0000-000000000001
\set f_aprov_uf BA
\set f_aguard f5700000-0000-0000-0000-000000000002
\set f_aguard_uf BA
select t('10. ficha APROVADA: arquivo dela não se troca nem se acrescenta', :BB, format($q$do $x$ begin
  if public.ficha_arquivo_livre(%L) then raise exception 'deixou trocar'; end if; end $x$$q$, :'f_aprov_uf' || '/' || :'f_aprov' || '/termo.jpg'), 'ok');
select t('10. ficha aguardando ou devolvida: a bolsista troca o arquivo (corrige antes da aprovação)', :BB, format($q$do $x$ begin
  if not public.ficha_arquivo_livre(%L) then raise exception 'não deixou trocar'; end if; end $x$$q$, :'f_aguard_uf' || '/' || :'f_aguard' || '/termo.jpg'), 'ok');
select t('10. ficha nova (ainda sem registro): o arquivo entra antes da ficha', :BB, $q$do $x$ begin
  if not public.ficha_arquivo_livre('PI/' || gen_random_uuid() || '/ficha.jpg') then raise exception 'barrou ficha nova'; end if; end $x$$q$, 'ok');
select t('10. as regras de envio e troca da pasta "fichas" usam a conferência', null, $q$do $x$ begin set local role none;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('fichas_arq_enviar', 'fichas_arq_trocar')
        and coalesce(qual, '') || coalesce(with_check, '') like '%ficha_arquivo_livre%') <> 2 then raise exception 'regras sem a conferência'; end if; end $x$$q$, 'ok');

-- ===== 12. bolsa só de 10/2026 a 09/2027
-- cenário: art.ba habilitada, começou antes de setembro de 2026 e sem bolsa em setembro
do $x$ begin set session_replication_role = replica;
  update public.equipe set matricula_fic_em = coalesce(matricula_fic_em, public.fic_hoje()), matricula_fic_numero = coalesce(matricula_fic_numero, 'T57'),
    docs_funcern_em = coalesce(docs_funcern_em, public.fic_hoje()), termo_path = coalesce(termo_path, 'equipe/t57/termo_1.pdf'), termo_assinado_em = coalesce(termo_assinado_em, public.fic_hoje()),
    data_inicio = least(data_inicio, date '2026-08-01')
   where email = 'art.ba@t.com' and status = 'ativa';
  delete from public.solicitacoes_pagamento where tipo = 'bolsa' and mes = date '2026-09-01' and equipe_id = (select id from public.equipe where email = 'art.ba@t.com' and status = 'ativa');
  set session_replication_role = origin; end $x$;
select t('12. bolsa de setembro de 2026 é recusada (13ª bolsa, fora do plano)', :BB, $q$select public.solicitar_pagamento('bolsa', date '2026-09-01', 2200, repeat('Relatório de atividades do mês. ', 3), null, '{}')$q$, 'A bolsa vai de outubro de 2026 a setembro de 2027');
select t('12. por baixo da função também: gravar bolsa de outubro de 2027 é recusado (gatilho, com a pessoa logada)', :BB, $q$do $x$ declare eu uuid := public.meu_id(); begin set local role none;
  insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio) values ('bolsa', eu, date '2027-10-01', 2200, repeat('Relatório de atividades do mês. ', 3)); end $x$$q$, 'outubro de 2026 a setembro de 2027');
select t('12. ajuda de custo não tem essa trava (paga visita feita)', null, $q$do $x$ begin set local role none;
  if (select prosrc from pg_proc where proname = 'pagamentos_mes_bolsa') not like '%new.tipo = ''bolsa''%' then raise exception 'trava fora da bolsa'; end if; end $x$$q$, 'ok');

-- ===== 14. visita dentro da vigência (14/09/2026 a 30/09/2027)
\set v_prev f5700000-0000-0000-0000-000000000011
select t('14. reagendar visita para 01/10/2027 (depois da vigência) é recusado', :G, format($q$update public.visitas set data_prevista = date '2027-10-01' where id = %L$q$, :'v_prev'), 'dentro da vigência do projeto: de 14/09/2026 a 30/09/2027');
select t('14. remarcar visita para agosto de 2026 (antes da vigência) é recusado', :G, format($q$update public.visitas set data_prevista = date '2026-08-20' where id = %L$q$, :'v_prev'), 'vigência do projeto');
select t('14. data dentro da vigência continua valendo (30/09/2027)', :G, format($q$update public.visitas set data_prevista = date '2027-09-30' where id = %L$q$, :'v_prev'), 'ok');

-- ===== 13. desligamento com pagamento a pedir
select t('13. com visita feita sem pedido, a coordenação NÃO desliga (ela perderia a ajuda de custo)', :G, format($q$do $x$ begin %s
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Pediu para sair' where email = 'ag1@t.com' and status = 'ativa'; end $x$$q$, :'PLANTA'), 'Não dá para desligar ainda: 1 visita(s) feita(s) sem pedido');
select t('13. a coordenação técnica NÃO usa o "desligar assim mesmo"', :T, format($q$do $x$ begin %s
  perform public.desligar_sem_pedido((select id from public.equipe where email = 'ag1@t.com' and status = 'ativa'), public.fic_hoje(), 'Abandono', 'Não responde há 30 dias, mensagens e ligações sem retorno.'); end $x$$q$, :'PLANTA'), 'Só a coordenação geral');
select t('13. a coordenação geral desliga assim mesmo só com justificativa (20 letras)', :G, format($q$do $x$ begin %s
  perform public.desligar_sem_pedido((select id from public.equipe where email = 'ag1@t.com' and status = 'ativa'), public.fic_hoje(), 'Abandono', 'sumiu'); end $x$$q$, :'PLANTA'), 'pelo menos 20 letras');
select t('13. a coordenação geral desliga com justificativa e fica no histórico', :G, format($q$do $x$ declare e uuid; begin %s
  select id into e from public.equipe where email = 'ag1@t.com' and status = 'ativa';
  perform public.desligar_sem_pedido(e, public.fic_hoje(), 'Abandono', 'Não responde há 30 dias, mensagens e ligações sem retorno.');
  perform set_config('role', 'none', true);
  if (select status from public.equipe where id = e) <> 'desligada' then raise exception 'não desligou'; end if;
  if not exists (select 1 from public.auditoria where registro_id = e and acao = 'DESLIGAR_COM_PENDENCIA' and (depois ->> 'visitas_sem_pedido')::int >= 1) then raise exception 'sem histórico'; end if; end $x$$q$, :'PLANTA'), 'ok');
select t('13. o "desligar assim mesmo" não vale para outra pessoa no mesmo pedido (a liberação é só daquele cadastro)', :G, format($q$do $x$ begin %s
  perform set_config('mq.desligar_sem_pedido', gen_random_uuid()::text, true);
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Pediu para sair' where email = 'ag1@t.com' and status = 'ativa'; end $x$$q$, :'PLANTA'), 'Não dá para desligar ainda');
select t('13. sem pendência, o desligamento segue normal', :G, $q$update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Pediu para sair'
  where email = 'aux@t.com' and status = 'ativa'$q$, 'ok');
select t('13. a contagem de pendências não fica aberta a quem entrou (só uso interno)', null, $q$do $x$ begin set local role none;
  if has_function_privilege('authenticated', 'public.pendencias_pagamento(uuid)', 'EXECUTE') then raise exception 'aberta'; end if; end $x$$q$, 'ok');

select n || '|' || case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || coalesce(det, '') from res order by n;
