-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB, :X) e ANTES do test_conferencia_auxiliar.sql
-- 27_seguranca_revisao.sql + 15 corrigido
\set QUIET on
truncate res;
select t('geral NÃO grava pagamento direto na tabela', :G,
  $q$insert into public.solicitacoes_pagamento default values$q$, 'permission denied');
select t('geral NÃO muda situação de pagamento direto', :G, $q$update public.solicitacoes_pagamento set situacao='lancada'$q$, 'permission denied');
select t('geral ainda LÊ os pagamentos', :G, $q$select count(*) from public.solicitacoes_pagamento$q$, 'ok');
select t('geral NÃO cria convite direto (só pela função)', :G, $q$insert into public.convites (papel, uf) values ('agente','PI')$q$, 'permission denied');
select t('geral NÃO cria pré-cadastro direto', :G, $q$insert into public.pre_cadastros default values$q$, 'permission denied');
select t('geral ainda decide pré-cadastro (update liberado)', :G, $q$update public.pre_cadastros set obs = obs where false$q$, 'ok');
select t('anônimo NÃO consulta pendências de campo', null, $q$select public.pendencias_campo(gen_random_uuid())$q$, 'permission denied');
select t('logado consulta pendências de campo', :G, $q$select public.pendencias_campo(gen_random_uuid())$q$, 'ok');
-- documento arquivado não é arquivado de novo
create temp table did(id uuid); grant all on did to authenticated;
select f(:G, $q$with r as (insert into public.documentos_projeto (tipo, titulo, data_documento, arquivo_path, arquivo_nome) values ('ata','Ata de teste da revisão', current_date, 'x/ata-rev.pdf', 'ata.pdf') returning id) insert into did select id from r$q$);
select f(:G, $q$update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Primeiro motivo' where id = (select id from did)$q$);
select t('arquivar de novo (trocar motivo) é recusado', :G, $q$update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Outro motivo qualquer' where id = (select id from did)$q$, 'já está arquivado');
select t('arquivado não volta', :G, $q$update public.documentos_projeto set arquivado_em = null where id = (select id from did)$q$, 'não volta');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
