-- =====================================================================
-- Mulheres & Quintais — VERIFICAR o banco (só lê, não muda nada)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Mostra, etapa por etapa, o que já está instalado. Onde aparecer "FALTA", rode aquele script
-- (na ordem 01, 02, 03, 04, 07, 08, 09, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 41). Todos podem rodar de novo sem estragar nada.
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
  union all select '20_organizar_texto (opcional: só se ligar a IA)', exists (select 1 from fn where proname = 'registrar_uso_ia')
  union all select '18_codigo_primeiro_acesso', to_regclass('public.acesso_codigos') is not null and exists (select 1 from fn where proname = 'gerar_codigo_acesso')
  union all select '21_roteiro_testes', to_regclass('public.testes_resultados') is not null
  union all select '25_historico_e_cadastro', exists (select 1 from pg_policy where polname = 'auditoria_ler' and pg_get_expr(polqual, polrelid) not like '%coord_tecnico%')
                   and exists (select 1 from pg_proc where proname = 'enviar_pre_cadastro' and prosrc like '%já foram enviados%')
  union all select '24_documentos', to_regclass('public.documentos_projeto') is not null and exists (select 1 from storage.buckets where id = 'documentos')
  union all select '23_fic_coordenacao_tecnica', exists (select 1 from pg_proc where proname = 'matricular_fic' and prosrc like '%coord_tecnico%')
  -- rodar 01, 03, 07 ou 11 de novo fora de ordem volta regras antigas da equipe: estes dois itens acusam.
  -- Conserto: rodar de novo, em ordem, 11, 12, 13, 15, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 41 (nunca 05, 06, 14 ou 16).
  union all select 'regras da equipe (se FALTA: rode de novo, em ordem, do 11 ao 41)',
                   exists (select 1 from pg_proc where proname = 'equipe_antes' and prosrc like '%só registra o cadastro no Arlo%' and prosrc like '%coordenação geral altera%')
  union all select 'auxiliar ver e registrar Arlo (se FALTA: rode de novo, em ordem, do 11 ao 41)',
                   exists (select 1 from pg_policy where polname = 'equipe_ler' and pg_get_expr(polqual, polrelid) like '%auxiliar_adm%')
                   and exists (select 1 from pg_policy where polname = 'equipe_alterar' and pg_get_expr(polqual, polrelid) like '%auxiliar_adm%')
  union all select '29_desempenho (rode depois do 11 ao 28)', to_regclass('public.auditoria_em') is not null
                   and exists (select 1 from pg_policy where polname = 'visitas_ler' and pg_get_expr(polqual, polrelid) like '%SELECT%meu_papel%')
  union all select '30_ultimos_acessos', to_regclass('public.acessos') is not null
                   and coalesce((select bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE')) from pg_proc p
                                 where p.proname = 'registrar_acesso' and p.pronamespace = 'public'::regnamespace), false)
  union all select '31_validacao_diagnostico (se rodar 03 ou 15 de novo, rode este depois)',
                   exists (select 1 from col where table_name = 'diagnosticos' and column_name = 'conteudo_alterado_por')
                   and exists (select 1 from pg_proc where proname = 'diagnosticos_antes' and prosrc like '%Você alterou este diagnóstico%')
  union all select '32_desde_o_inicio (se rodar 12 ou 19 de novo, rode este depois)',
                   exists (select 1 from pg_proc where proname = 'solicitar_pagamento' and prosrc like '%começou no projeto%')
                   and exists (select 1 from pg_proc where proname = 'entregas_antes' and prosrc like '%começou no projeto%')
  union all select '33_exige_professor_fic', exists (select 1 from pg_trigger where tgname = 'equipe_exige_professor')
                   and exists (select 1 from pg_trigger where tgname = 'convites_exige_professor')
  union all select '35_tetos_passagens_eventos (se rodar 22 de novo, rode este depois)',
                   exists (select 1 from col where table_name = 'pedidos_apoio' and column_name = 'valor_autorizado')
                   and exists (select 1 from pg_trigger where tgname = 'pedidos_apoio_valor')
  union all select '36_execucao_financeira', to_regclass('public.execucao_lancamentos') is not null
                   and exists (select 1 from pg_trigger where tgname = 'execucao_antes')
  union all select '37_execucao_planilhas', to_regclass('public.execucao_planilhas') is not null
                   and exists (select 1 from pg_trigger where tgname = 'execucao_planilhas_antes')
                   and exists (select 1 from storage.buckets where id = 'execucao')
  union all select '38_fic_encontros', to_regclass('public.fic_encontros') is not null and to_regclass('public.fic_presencas') is not null
                   and exists (select 1 from pg_trigger where tgname = 'solic_professor_fic')
                   and exists (select 1 from fn where proname = 'cancelar_encontro_fic')   -- revisão de 01/10 (se FALTA: rode o 38 de novo)
  union all select '39_agua', to_regclass('public.agua_situacoes') is not null and exists (select 1 from fn where proname = 'registrar_situacao_agua')
  union all select '40_vitrine_municipios (mapa público por município)', exists (select 1 from fn where proname = 'vitrine_municipios')
  union all select '41_desligamento (professor com turma; pedidos de quem sai)', exists (select 1 from pg_trigger where tgname = 'equipe_desligar_regras')
                   and exists (select 1 from pg_trigger where tgname = 'equipe_desligada_pedidos')
  union all select '28_pedido_novo_acesso', to_regclass('public.pedidos_novo_acesso') is not null and exists (select 1 from fn where proname = 'pedir_novo_acesso')
  -- (as checagens de permissão olham o objeto pelo número dele: se a tabela ou a função ainda não existe, dá FALTA e não erro)
  union all select '27_seguranca_revisao',
                   coalesce((select not has_table_privilege('authenticated', c.oid, 'INSERT') from pg_class c
                             where c.relname = 'solicitacoes_pagamento' and c.relnamespace = 'public'::regnamespace), false)
                   and coalesce((select bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE')) from pg_proc p
                                 where p.proname = 'pendencias_campo' and p.pronamespace = 'public'::regnamespace), false)
                   and exists (select 1 from pg_proc where proname = 'documentos_antes' and prosrc like '%já está arquivado%')
  union all select '26_conferencia_auxiliar', exists (select 1 from fn where proname = 'quem_confere_pedidos')
  union all select '22_passagens_eventos', to_regclass('public.pedidos_apoio') is not null and exists (select 1 from fn where proname = 'mover_pedido_apoio')
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
