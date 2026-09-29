-- =====================================================================
-- Mulheres & Quintais — VERIFICAR o banco (só lê, não muda nada)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Mostra, etapa por etapa, o que já está instalado. Onde aparecer "FALTA", rode aquele script
-- (na ordem 01, 02, 03, 04, 07, 08, 09, 10, 11, 12, 13, 15, 17, 18, 19). Todos podem rodar de novo sem estragar nada.
-- =====================================================================
with col as (select table_name, column_name from information_schema.columns where table_schema = 'public'),
fn as (select proname from pg_proc where pronamespace = 'public'::regnamespace),
chk as (
  select '01_criar_banco'      as etapa, to_regclass('public.equipe') is not null and to_regclass('public.auditoria') is not null as ok
  union all select '02_fichas',          to_regclass('public.fichas') is not null
  union all select '03_campo',           to_regclass('public.visitas') is not null and to_regclass('public.diagnosticos') is not null
  union all select '04_vitrine_e_custos', to_regclass('public.vitrine_fotos') is not null and to_regclass('public.custos_visita') is not null and to_regclass('public.parametros') is not null
  union all select '07_fotos_equipe',    exists (select 1 from col where table_name = 'equipe' and column_name = 'foto_path')
  union all select '08_convites',        to_regclass('public.convites') is not null and to_regclass('public.pre_cadastros') is not null
  union all select '09_dados_bancarios', to_regclass('public.equipe_bancario') is not null
  union all select '10_apl',             to_regclass('public.apl_municipios') is not null
  union all select '11_fic (versão final, com SIAPE e auxiliar)',
                   to_regclass('public.turmas_fic') is not null
                   and exists (select 1 from col where table_name = 'equipe' and column_name = 'siape')
                   and exists (select 1 from col where table_name = 'equipe' and column_name = 'cadastro_arlo')
                   and to_regclass('public.equipe_um_auxiliar') is not null
                   and exists (select 1 from fn where proname = 'ver_conta_para_arlo')
  union all select '12_pagamentos',      to_regclass('public.solicitacoes_pagamento') is not null
                   and exists (select 1 from col where table_name = 'visitas' and column_name = 'relato')
                   and exists (select 1 from fn where proname = 'registrar_no_arlo')
  union all select '13_avaliacao (versão final)', to_regclass('public.avaliacoes') is not null
                   and not exists (select 1 from fn where proname = 'exportar_dados_bancarios')
  union all select '15_coord_geral_total', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fichas' and policyname = 'geral_tudo')
  union all select '17_corrige_link_cadastro', not exists (select 1 from pg_proc where proname = 'criar_convite' and prosrc like '%gen_random_bytes%')
  union all select '19_entregas_do_mes', to_regclass('public.entregas_mes') is not null and to_regclass('public.ciencias') is not null
                   and exists (select 1 from col where table_name = 'equipe_privado' and column_name = 'perfil')
  union all select '18_codigo_primeiro_acesso', to_regclass('public.acesso_codigos') is not null and exists (select 1 from fn where proname = 'gerar_codigo_acesso')
)
-- o SQL Editor do Supabase mostra só o último resultado: por isso vai tudo numa tabela só
, conta as (
  select t, case when to_regclass('public.' || t) is null then null
    else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || t, false, true, '')))[1]::text::int end as n
  from unnest(array['equipe','fichas','visitas','diagnosticos','avaliacoes','solicitacoes_pagamento','exemplo']) as t
)
select 1 as ordem, etapa as item, case when ok then 'ok' else 'FALTA rodar este script' end as situacao from chk
union all
select 2, 'quantos registros em ' || t, coalesce(n::text, '—') from conta
union all
select 3, 'logins criados', (select count(*)::text from auth.users)
order by 1, 2;
