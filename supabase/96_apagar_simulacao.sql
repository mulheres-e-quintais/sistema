-- =====================================================================
-- Mulheres & Quintais — 96: APAGAR A SIMULAÇÃO (e os dados de exemplo do 05)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Apaga SÓ o que está anotado na tabela public.exemplo (colocado pelo 05_dados_exemplo.sql ou pelo 95_simulacao_completa.sql),
-- e o que depende disso (km das visitas, pagamentos, presença no FIC, dados pessoais e bancários da equipe fictícia, acessos,
-- histórico). Nada cadastrado de verdade é apagado: referências de registros reais a pessoas fictícias viram vazias.
-- Faz o trabalho do 06_apagar_exemplo.sql e mais: cobre todas as tabelas.
-- =====================================================================
-- Tudo roda num bloco só: se qualquer parte falhar, nada muda.
do $apagar$
declare
  t text;
  tabs text[] := array['equipe','equipe_privado','equipe_bancario','fichas','visitas','diagnosticos','avaliacoes','custos_visita','solicitacoes_pagamento',
    'solicitacao_visitas','entregas_mes','turmas_fic','matriculas_fic','fic_encontros','fic_presencas','pedidos_apoio','documentos_projeto','execucao_planilhas',
    'agua_situacoes','canais_venda','orientacoes_venda','observadores','relatos_problema','convites','pre_cadastros','vitrine_fotos','acessos','auditoria',
    'acesso_codigos','ciencias','fila_celular','pedidos_novo_acesso','testes_resultados'];
begin

  foreach t in array tabs loop
    if to_regclass('public.' || t) is not null then execute format('alter table public.%I disable trigger user', t); end if;
  end loop;

  create temp table _ex on commit drop as select id, tabela from public.exemplo;
  create temp table _eqx on commit drop as select id from _ex where tabela = 'equipe';

  -- registros reais que apontam para pessoas fictícias: a referência fica vazia
  update public.fichas set aprovada_por = null where aprovada_por in (select id from _eqx) and id not in (select id from _ex);
  update public.fichas set bolsista_id = null where bolsista_id in (select id from _eqx) and id not in (select id from _ex);
  update public.diagnosticos set aprovado_por = null where aprovado_por in (select id from _eqx) and id not in (select id from _ex);
  update public.equipe set criado_por = null where criado_por in (select id from _eqx) and id not in (select id from _ex);
  update public.equipe set substitui_id = null where substitui_id in (select id from _eqx) and id not in (select id from _ex);

  -- fotos publicadas de mulheres fictícias: o arquivo vai para a lista de remoção
  insert into public.vitrine_remover (path) select path from public.vitrine_fotos where ficha_id in (select id from _ex) or id in (select id from _ex) on conflict do nothing;

  delete from public.fic_presencas where id in (select id from _ex) or encontro_id in (select id from _ex) or equipe_id in (select id from _eqx);
  delete from public.fic_encontros where id in (select id from _ex) or turma_id in (select id from _ex);
  delete from public.matriculas_fic where id in (select id from _ex) or turma_id in (select id from _ex) or equipe_id in (select id from _eqx);
  delete from public.turmas_fic where id in (select id from _ex);
  delete from public.solicitacao_visitas where solicitacao_id in (select id from _ex) or visita_id in (select id from _ex);
  delete from public.solicitacoes_pagamento where id in (select id from _ex) or equipe_id in (select id from _eqx);
  delete from public.entregas_mes where equipe_id in (select id from _eqx);
  delete from public.custos_visita where visita_id in (select id from _ex);
  delete from public.vitrine_fotos where id in (select id from _ex) or ficha_id in (select id from _ex);
  delete from public.orientacoes_venda where id in (select id from _ex) or ficha_id in (select id from _ex);
  delete from public.agua_situacoes where id in (select id from _ex) or ficha_id in (select id from _ex);
  delete from public.avaliacoes where id in (select id from _ex) or ficha_id in (select id from _ex);
  delete from public.diagnosticos where id in (select id from _ex) or ficha_id in (select id from _ex);
  delete from public.visitas where id in (select id from _ex) or ficha_id in (select id from _ex);
  delete from public.fichas where id in (select id from _ex);
  delete from public.pedidos_apoio where id in (select id from _ex) or solicitante_id in (select id from _eqx);
  delete from public.documentos_projeto where id in (select id from _ex);
  delete from public.execucao_planilhas where id in (select id from _ex);
  delete from public.canais_venda where id in (select id from _ex);
  delete from public.observadores where id in (select id from _ex);
  delete from public.relatos_problema where id in (select id from _ex) or autor_id in (select id from _eqx);
  delete from public.pre_cadastros where id in (select id from _ex) or convite_id in (select id from _ex);
  delete from public.convites where id in (select id from _ex);
  delete from public.acessos where equipe_id in (select id from _eqx);
  delete from public.equipe_privado where equipe_id in (select id from _eqx);
  delete from public.equipe_bancario where equipe_id in (select id from _eqx);
  -- tabelas que nem toda instalação tem
  if to_regclass('public.acesso_codigos') is not null then delete from public.acesso_codigos where equipe_id in (select id from _eqx); end if;
  if to_regclass('public.ciencias') is not null then delete from public.ciencias where equipe_id in (select id from _eqx); end if;
  if to_regclass('public.fila_celular') is not null then delete from public.fila_celular where equipe_id in (select id from _eqx); end if;
  if to_regclass('public.pedidos_novo_acesso') is not null then delete from public.pedidos_novo_acesso where equipe_id in (select id from _eqx); end if;
  if to_regclass('public.testes_resultados') is not null then delete from public.testes_resultados where equipe_id in (select id from _eqx); end if;
  delete from public.equipe where id in (select id from _eqx);
  delete from public.auditoria where registro_id in (select id from _ex)
   or (tabela = 'planilhas' and depois ->> 'qtd' = '300' and em = timestamptz '2027-09-20 11:00-03');   -- a linha de planilha que a simulação escreveu
  delete from public.exemplo;

  foreach t in array tabs loop
    if to_regclass('public.' || t) is not null then execute format('alter table public.%I enable trigger user', t); end if;
  end loop;
end $apagar$;

select 'Simulação e dados de exemplo apagados' as resultado,
  (select count(*) from public.exemplo) as exemplo_restante,
  (select count(*) from public.equipe) as equipe_que_ficou,
  (select count(*) from public.fichas) as fichas_que_ficaram;
