-- 69: cancelar pedido de pagamento, desligamento com bolsa aprovada, cancelar ou ajustar passagem e evento autorizados
begin;
set session_replication_role = replica;   -- cenário montado direto, sem os gatilhos
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000069c1', 'cg.t69@exemplo.invalid'), ('00000000-0000-0000-0000-0000000069c2', 'tec.t69@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000069c3', 'art.t69@exemplo.invalid'), ('00000000-0000-0000-0000-0000000069c4', 'art2.t69@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000069c5', 'ag.t69@exemplo.invalid');
update public.equipe set user_id = null where user_id = '00000000-0000-0000-0000-0000000069c1';
update public.equipe set user_id = '00000000-0000-0000-0000-0000000069c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
-- quem já está no banco (de outros testes da mesma sessão) sai do caminho: uma bolsista por estado, uma técnica
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste 69', user_id = null where papel <> 'coord_geral' and status = 'ativa';
insert into public.equipe (id, user_id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status, matricula_fic_em, docs_funcern_em, termo_assinado_em) values
  ('00000000-0000-0000-0000-0000000069a2', '00000000-0000-0000-0000-0000000069c2', 'coord_tecnico', null, 'Técnica T69', '69016901102', 'tec.t69@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000069a3', '00000000-0000-0000-0000-0000000069c3', 'articulacao', 'PI', 'Articulação T69', '69016902265', 'art.t69@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000069a4', '00000000-0000-0000-0000-0000000069c4', 'apoio', 'PI', 'Apoio T69', '69016903318', 'art2.t69@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000069a5', '00000000-0000-0000-0000-0000000069c5', 'agente', 'PI', 'Agente T69', '69016904401', 'ag.t69@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000069a6', null, 'auxiliar_adm', null, 'Auxiliar T69', '69016905555', 'aux.t69@exemplo.invalid', '2026-10-01', true, 'ativa', null, '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000069a7', null, 'articulacao', 'AL', 'Sai Com Aval T69', '69016906608', 'sai1.t69@exemplo.invalid', '2026-08-01', true, 'ativa', '2026-08-01', '2026-08-01', '2026-08-01'),
  ('00000000-0000-0000-0000-0000000069a8', null, 'articulacao', 'BA', 'Sai Sem Aval T69', '69016907751', 'sai2.t69@exemplo.invalid', '2026-08-01', true, 'ativa', '2026-08-01', '2026-08-01', '2026-08-01'),
  ('00000000-0000-0000-0000-0000000069a9', null, 'apoio', 'SE', 'Já Saiu T69', '69016908804', 'sai3.t69@exemplo.invalid', '2026-08-01', true, 'ativa', '2026-08-01', '2026-08-01', '2026-08-01');
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, consent_dados, resultado, data_ficha)
  values ('00000000-0000-0000-0000-0000000069f1', 'PI', 'Pio IX', 'Comunidade T69', 'Agricultora T69', '69016909947', '1980-01-01', 'Sítio', true, true, true, true, true, true, true, true, true, 'nao_atende', '2026-10-02');
insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao)
  values ('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069f1', 'PI', 'diagnostico', '00000000-0000-0000-0000-0000000069a5', '2026-10-05', '2026-10-05', 'realizada');
insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, relatorio, situacao, aval_em) values
  ('00000000-0000-0000-0000-0000000069b1', 'bolsa', '00000000-0000-0000-0000-0000000069a3', '2026-10-01', 2200, null, 'relatório', 'solicitada', null),
  ('00000000-0000-0000-0000-0000000069b2', 'bolsa', '00000000-0000-0000-0000-0000000069a4', '2026-10-01', 2200, 2200, 'relatório', 'avalizada', now()),
  ('00000000-0000-0000-0000-0000000069b3', 'bolsa', '00000000-0000-0000-0000-0000000069a6', '2026-10-01', 1200, null, 'relatório', 'solicitada', null),
  ('00000000-0000-0000-0000-0000000069b4', 'ajuda_custo', '00000000-0000-0000-0000-0000000069a5', '2026-10-01', 150, null, null, 'devolvida', now()),
  ('00000000-0000-0000-0000-0000000069b5', 'bolsa', '00000000-0000-0000-0000-0000000069a7', '2026-10-01', 2200, 2200, 'relatório', 'avalizada', now()),
  ('00000000-0000-0000-0000-0000000069b6', 'bolsa', '00000000-0000-0000-0000-0000000069a8', '2026-10-01', 2200, null, 'relatório', 'solicitada', null),
  ('00000000-0000-0000-0000-0000000069b7', 'bolsa', '00000000-0000-0000-0000-0000000069a8', '2026-09-01', 2200, 2200, 'relatório', 'lancada', now()),
  ('00000000-0000-0000-0000-0000000069b8', 'bolsa', '00000000-0000-0000-0000-0000000069a9', '2026-10-01', 2200, 2200, 'relatório', 'avalizada', now()),
  ('00000000-0000-0000-0000-0000000069b9', 'bolsa', '00000000-0000-0000-0000-0000000069a7', '2026-09-01', 2200, 2200, 'relatório', 'lancada', now());
insert into public.solicitacao_visitas (visita_id, solicitacao_id) values ('00000000-0000-0000-0000-0000000069e1', '00000000-0000-0000-0000-0000000069b4');
insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, valor_autorizado) values
  ('00000000-0000-0000-0000-0000000069d1', 'evento', 'PI', '00000000-0000-0000-0000-0000000069a3', 'Evento autorizado T69', current_date + 20, '{"valor_estimado": 5000}', 'autorizado', 5000),
  ('00000000-0000-0000-0000-0000000069d2', 'evento', 'PI', '00000000-0000-0000-0000-0000000069a3', 'Outro evento autorizado T69', current_date + 30, '{"valor_estimado": 800}', 'autorizado', 800),
  ('00000000-0000-0000-0000-0000000069d3', 'evento', 'PI', '00000000-0000-0000-0000-0000000069a3', 'Evento só enviado T69', current_date + 30, '{"valor_estimado": 100}', 'enviado', null);
update public.equipe set status = 'desligada', data_fim = '2026-10-15', motivo_desligamento = 'teste 69' where id = '00000000-0000-0000-0000-0000000069a9';
set session_replication_role = origin;

create temp table _r (caso text, erro text) on commit drop; grant all on _r to authenticated;
create function pg_temp.tenta(caso text, quem uuid, cmd text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', 'authenticated', true);
  begin execute cmd; insert into _r values (caso, null); exception when others then insert into _r values (caso, sqlerrm); end;
  perform set_config('role', 'postgres', true);
end $$;
create function pg_temp.ok(caso text, deve text, titulo text) returns text language sql as $$
  select case when (deve = 'ok' and (select erro from _r where _r.caso = ok.caso) is null)
                or (deve <> 'ok' and (select erro from _r where _r.caso = ok.caso) ~ deve) then 'PASSOU' else 'FALHOU' end
         || ' 69: ' || titulo || ' | ' || coalesce((select erro from _r where _r.caso = ok.caso), 'gravou')
$$;
\set CG '00000000-0000-0000-0000-0000000069c1'
\set TEC '00000000-0000-0000-0000-0000000069c2'
\set ART '00000000-0000-0000-0000-0000000069c3'
\set APO '00000000-0000-0000-0000-0000000069c4'
\set AG '00000000-0000-0000-0000-0000000069c5'

-- 1. pedido de pagamento
select pg_temp.tenta('art_cancela_sem_motivo', :'ART', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b1', null)$$);
select pg_temp.tenta('art_cancela_de_novo', :'ART', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b1', null)$$);
select pg_temp.tenta('apo_cancela_com_aval', :'APO', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b2', 'não quero')$$);
select pg_temp.tenta('tec_cancela_com_aval', :'TEC', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b2', 'valor errado')$$);
select pg_temp.tenta('cg_cancela_sem_motivo', :'CG', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b2', ' ')$$);
select pg_temp.tenta('cg_cancela_com_aval', :'CG', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b2', 'Mês sem atividade comprovada')$$);
select pg_temp.tenta('tec_cancela_bolsa_do_aux', :'TEC', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b3', 'Pedido em duplicidade')$$);
select pg_temp.tenta('art_cancela_de_outra', :'ART', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b3', 'Pedido em duplicidade')$$);
select pg_temp.tenta('tec_cancela_ajuda_sem_motivo', :'TEC', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b4', 'abc')$$);
select pg_temp.tenta('tec_cancela_ajuda', :'TEC', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b4', 'Visita registrada em dobro')$$);
select pg_temp.tenta('cg_cancela_lancada', :'CG', $$select public.cancelar_pagamento('00000000-0000-0000-0000-0000000069b7', 'Pago a mais')$$);
reset role;
select pg_temp.ok('art_cancela_sem_motivo', 'ok', 'a própria pessoa cancela o pedido dela sem aval (motivo opcional)');
select case when motivo_cancelamento = 'Cancelado por quem pediu.' and cancelado_por = '00000000-0000-0000-0000-0000000069a3' then 'PASSOU' else 'FALHOU' end || ' 69: o cancelamento registra quem e o motivo padrão'
  from public.solicitacoes_pagamento where id = '00000000-0000-0000-0000-0000000069b1' and situacao = 'cancelada';
select pg_temp.tenta('art_pede_de_novo', :'ART', $$select public.solicitar_pagamento('bolsa', '2026-10-01', 2200, repeat('Relatório do mês de outubro. ', 3), null, '{}')$$);
reset role;
select pg_temp.ok('art_cancela_de_novo', 'já foi cancelada', 'cancelar duas vezes é recusado');
select pg_temp.ok('art_pede_de_novo', 'ok', 'a bolsa cancelada do mês pode ser pedida de novo');
select case when situacao = 'solicitada' and cancelado_em is null and motivo_cancelamento is null then 'PASSOU' else 'FALHOU' end || ' 69: o pedido de novo volta ao mesmo registro, sem os dados do cancelamento'
  from public.solicitacoes_pagamento where id = '00000000-0000-0000-0000-0000000069b1';
select pg_temp.ok('apo_cancela_com_aval', 'só a coordenação geral', 'com aval, a própria pessoa não cancela');
select pg_temp.ok('tec_cancela_com_aval', 'só a coordenação geral', 'com aval, a coordenação técnica não cancela');
select pg_temp.ok('cg_cancela_sem_motivo', 'motivo do cancelamento', 'a coordenação cancela só com motivo');
select pg_temp.ok('cg_cancela_com_aval', 'ok', 'a coordenação geral cancela o que tem aval e não foi lançado');
select pg_temp.ok('tec_cancela_bolsa_do_aux', 'própria pessoa ou a coordenação', 'a técnica não cancela pedido cujo aval é da coordenação geral');
select pg_temp.ok('art_cancela_de_outra', 'própria pessoa ou a coordenação', 'ninguém cancela o pedido de outra pessoa');
select pg_temp.ok('tec_cancela_ajuda_sem_motivo', 'motivo do cancelamento', 'motivo de menos de 5 letras é recusado');
select pg_temp.ok('tec_cancela_ajuda', 'ok', 'a técnica cancela a ajuda de custo devolvida, com motivo');
select case when not exists (select 1 from public.solicitacao_visitas where solicitacao_id = '00000000-0000-0000-0000-0000000069b4') then 'PASSOU' else 'FALHOU' end || ' 69: a visita do pedido cancelado fica livre';
select pg_temp.ok('cg_cancela_lancada', 'lançada no Arlo', 'lançada no Arlo não se cancela');
select case when (select visitas_sem_pedido from public.pendencias_pagamento('00000000-0000-0000-0000-0000000069a5')) = 1
             and (select pedidos_devolvidos from public.pendencias_pagamento('00000000-0000-0000-0000-0000000069a5')) = 0
  then 'PASSOU' else 'FALHOU' end || ' 69: o pedido cancelado não conta como devolvido, e a visita volta a "sem pedido"';
select pg_temp.tenta('ag_pede_de_novo', :'AG', $$select public.solicitar_pagamento('ajuda_custo', '2026-10-01', 150, null, array['00000000-0000-0000-0000-0000000069e1']::uuid[], '{}')$$);
reset role;
select pg_temp.ok('ag_pede_de_novo', 'ok', 'a visita liberada entra num pedido novo');
select case when coalesce(detalhe->>'complementar', '') = '' then 'PASSOU' else 'FALHOU' end || ' 69: o pedido novo não é "complementar" (o cancelado não conta)'
  from public.solicitacoes_pagamento where tipo = 'ajuda_custo' and equipe_id = '00000000-0000-0000-0000-0000000069a5' and situacao = 'solicitada';

-- 2. desligamento com data no passado
select pg_temp.tenta('desliga_antes_do_aval', :'CG', $$update public.equipe set status = 'desligada', data_fim = '2026-09-30', motivo_desligamento = 'Saiu do projeto' where id = '00000000-0000-0000-0000-0000000069a7'$$);
select pg_temp.tenta('desliga_no_mes_do_aval', :'CG', $$update public.equipe set status = 'desligada', data_fim = '2026-10-01', motivo_desligamento = 'Saiu do projeto' where id = '00000000-0000-0000-0000-0000000069a7'$$);
select pg_temp.tenta('desliga_sem_aval', :'CG', $$update public.equipe set status = 'desligada', data_fim = '2026-09-30', motivo_desligamento = 'Saiu do projeto' where id = '00000000-0000-0000-0000-0000000069a8'$$);
select pg_temp.tenta('muda_data_fim', :'CG', $$update public.equipe set data_fim = '2026-09-20' where id = '00000000-0000-0000-0000-0000000069a9'$$);
reset role;
select pg_temp.ok('desliga_antes_do_aval', 'antes de bolsa já aprovada: 10/2026 \(com aval\)', 'a data de saída não fica antes de bolsa com aval');
select pg_temp.ok('desliga_no_mes_do_aval', 'ok', 'saída dentro do mês da bolsa com aval: desliga');
select pg_temp.ok('desliga_sem_aval', 'ok', 'bolsa sem aval depois da saída não segura o desligamento');
select case when situacao = 'cancelada' and motivo_cancelamento like 'Cancelado pelo sistema: bolsa de mês depois da saída%' then 'PASSOU' else 'FALHOU' end
  || ' 69: a bolsa sem aval de mês depois da saída é cancelada pelo sistema | ' || situacao
  from public.solicitacoes_pagamento where id = '00000000-0000-0000-0000-0000000069b6';
select case when situacao = 'lancada' then 'PASSOU' else 'FALHOU' end || ' 69: a bolsa lançada de antes da saída continua' from public.solicitacoes_pagamento where id = '00000000-0000-0000-0000-0000000069b7';
select pg_temp.ok('muda_data_fim', 'antes de bolsa já aprovada', 'corrigir a data de saída para antes da bolsa com aval também é recusado');

-- 3. passagem ou evento já autorizado
select pg_temp.tenta('tec_ajusta', :'TEC', $$select public.ajustar_valor_pedido('00000000-0000-0000-0000-0000000069d1', 5100, 'Nota fiscal')$$);
select pg_temp.tenta('cg_ajusta_passa_teto', :'CG', $$select public.ajustar_valor_pedido('00000000-0000-0000-0000-0000000069d1', 5300, 'Nota fiscal')$$);
select pg_temp.tenta('cg_ajusta_sem_motivo', :'CG', $$select public.ajustar_valor_pedido('00000000-0000-0000-0000-0000000069d1', 5100, '')$$);
select pg_temp.tenta('cg_ajusta', :'CG', $$select public.ajustar_valor_pedido('00000000-0000-0000-0000-0000000069d1', 5100, 'Valor da nota fiscal')$$);
select pg_temp.tenta('cg_ajusta_enviado', :'CG', $$select public.ajustar_valor_pedido('00000000-0000-0000-0000-0000000069d3', 90, 'Valor da nota fiscal')$$);
select pg_temp.tenta('tec_cancela_aut', :'TEC', $$select public.cancelar_pedido_autorizado('00000000-0000-0000-0000-0000000069d2', 'Evento adiado')$$);
select pg_temp.tenta('cg_cancela_aut_sem_motivo', :'CG', $$select public.cancelar_pedido_autorizado('00000000-0000-0000-0000-0000000069d2', 'x')$$);
select pg_temp.tenta('cg_cancela_aut', :'CG', $$select public.cancelar_pedido_autorizado('00000000-0000-0000-0000-0000000069d2', 'Evento adiado para 2027')$$);
select pg_temp.tenta('cg_cancela_enviado', :'CG', $$select public.cancelar_pedido_autorizado('00000000-0000-0000-0000-0000000069d3', 'Evento adiado')$$);
reset role;
select pg_temp.ok('tec_ajusta', 'Só a coordenação geral', 'só a coordenação geral ajusta o valor autorizado');
select pg_temp.ok('cg_ajusta_passa_teto', 'Passa do teto de eventos de PI', 'o ajuste é conferido contra o teto');
select pg_temp.ok('cg_ajusta_sem_motivo', 'motivo do ajuste', 'o ajuste exige motivo');
select pg_temp.ok('cg_ajusta', 'ok', 'a coordenação geral ajusta o valor dentro do teto');
select case when valor_autorizado = 5100 and obs like '%Valor ajustado de R$%5.000,00 para R$%5.100,00%Valor da nota fiscal' then 'PASSOU' else 'FALHOU' end
  || ' 69: o ajuste fica na observação | ' || coalesce(obs, '') from public.pedidos_apoio where id = '00000000-0000-0000-0000-0000000069d1';
select pg_temp.ok('cg_ajusta_enviado', 'Só pedido autorizado', 'pedido não autorizado não é ajustado por aqui');
select pg_temp.ok('tec_cancela_aut', 'Só a coordenação geral', 'só a coordenação geral cancela o autorizado');
select pg_temp.ok('cg_cancela_aut_sem_motivo', 'motivo do cancelamento', 'cancelar o autorizado exige motivo');
select pg_temp.ok('cg_cancela_aut', 'ok', 'a coordenação geral cancela o autorizado');
select case when situacao = 'cancelado' and obs like 'Cancelado depois de autorizado (%): Evento adiado para 2027' then 'PASSOU' else 'FALHOU' end
  || ' 69: o cancelamento fica na observação | ' || coalesce(obs, '') from public.pedidos_apoio where id = '00000000-0000-0000-0000-0000000069d2';
select case when (public.saldo_passagens_eventos()->'evento_usado'->>'PI')::numeric = 5100 then 'PASSOU' else 'FALHOU' end
  || ' 69: o valor do cancelado volta ao saldo do teto | ' || coalesce(public.saldo_passagens_eventos()->'evento_usado'->>'PI', '');
select pg_temp.ok('cg_cancela_enviado', 'Só pedido autorizado', 'pedido não autorizado não é cancelado por aqui');
rollback;
