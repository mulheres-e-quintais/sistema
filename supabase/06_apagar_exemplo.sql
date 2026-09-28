-- =====================================================================
-- Mulheres & Quintais — Etapa 6: APAGAR os dados de exemplo
-- Apaga só o que está anotado na tabela public.exemplo (colocado pelo 05_dados_exemplo.sql).
-- Nada que foi cadastrado de verdade é apagado. Rode ANTES de cadastrar a equipe e as fichas reais.
-- =====================================================================
begin;

-- se algum registro real apontar para uma pessoa de exemplo (ex.: ficha real aprovada pela coordenação técnica de exemplo),
-- a referência vira vazia em vez de impedir a limpeza
alter table public.fichas disable trigger user;
alter table public.visitas disable trigger user;
alter table public.diagnosticos disable trigger user;
alter table public.equipe disable trigger user;
update public.fichas set aprovada_por = null where aprovada_por in (select id from public.exemplo where tabela = 'equipe') and id not in (select id from public.exemplo);
update public.fichas set bolsista_id = null  where bolsista_id  in (select id from public.exemplo where tabela = 'equipe') and id not in (select id from public.exemplo);
update public.diagnosticos set aprovado_por = null where aprovado_por in (select id from public.exemplo where tabela = 'equipe') and id not in (select id from public.exemplo);
update public.equipe set criado_por = null where criado_por in (select id from public.exemplo where tabela = 'equipe') and id not in (select id from public.exemplo);
update public.equipe set substitui_id = null where substitui_id in (select id from public.exemplo where tabela = 'equipe') and id not in (select id from public.exemplo);

-- fotos publicadas de mulheres de exemplo: o arquivo vai para a lista de remoção (o sistema apaga ao abrir a aba Campo)
insert into public.vitrine_remover (path)
  select path from public.vitrine_fotos where ficha_id in (select id from public.exemplo where tabela = 'fichas') on conflict do nothing;
delete from public.vitrine_fotos where ficha_id in (select id from public.exemplo where tabela = 'fichas');

delete from public.custos_visita where visita_id in (select id from public.exemplo where tabela = 'visitas');
delete from public.diagnosticos  where id in (select id from public.exemplo where tabela = 'diagnosticos');
delete from public.visitas       where id in (select id from public.exemplo where tabela = 'visitas');
delete from public.fichas        where id in (select id from public.exemplo where tabela = 'fichas');
delete from public.equipe        where id in (select id from public.exemplo where tabela = 'equipe');
delete from public.auditoria     where registro_id in (select id from public.exemplo);
delete from public.exemplo;

alter table public.fichas enable trigger user;
alter table public.visitas enable trigger user;
alter table public.diagnosticos enable trigger user;
alter table public.equipe enable trigger user;
commit;

select 'Dados de exemplo apagados' as resultado,
  (select count(*) from public.equipe) as equipe_que_ficou,
  (select count(*) from public.fichas) as fichas_que_ficaram;
