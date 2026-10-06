-- =====================================================================
-- Mulheres & Quintais — VERIFICAR o banco (só lê, não muda nada)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Mostra, etapa por etapa, o que já está instalado. Onde aparecer "FALTA", rode aquele script
-- (na ordem 01, 02, 03, 04, 07, 08, 09, 10, 11, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 50, 51, 52, 53, 55).
-- Num banco que já está em uso, rode só o que aparecer como FALTA: reexecutar um script antigo pode trocar uma função já corrigida pela versão velha.
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
  -- Conserto: rodar de novo, em ordem, 11, 12, 13, 15, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47 (nunca 05, 06, 14 ou 16).
  union all select 'regras da equipe (se FALTA: rode de novo, em ordem, do 11 ao 47)',
                   exists (select 1 from pg_proc where proname = 'equipe_antes' and prosrc like '%só registra o cadastro no Arlo%' and prosrc like '%coordenação geral altera%')
  union all select 'auxiliar ver e registrar Arlo (se FALTA: rode de novo, em ordem, do 11 ao 47)',
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
  union all select '42_revisao_seguranca (fuso, travas, ninguém apaga)', exists (select 1 from pg_trigger where tgname = 'diagnosticos_a0_fixos')
                   and exists (select 1 from pg_trigger where tgname = 'equipe_login_fixo') and exists (select 1 from pg_trigger where tgname = 'solic_valor_aval')
                   and coalesce((select not has_table_privilege('authenticated', c.oid, 'DELETE') from pg_class c where c.relname = 'fichas' and c.relnamespace = 'public'::regnamespace), false)
  union all select '43_lgpd_equipe (bolsista não lê CPF e e-mail das colegas)', exists (select 1 from fn where proname = 'equipe_do_estado')
                   and to_regclass('public.contas_ja_ligadas') is not null
                   and exists (select 1 from pg_policy where polname = 'equipe_ler' and pg_get_expr(polqual, polrelid) not like '%articulacao%')
  union all select 'conta da coordenação geral só com código depois do 1º acesso (se FALTA: rode o 43)', exists (select 1 from pg_proc where proname = 'bloquear_conta_nao_cadastrada' and prosrc like '%contas_ja_ligadas%')
  union all select '44_venda (canais de venda e orientação do excedente)', to_regclass('public.canais_venda') is not null and to_regclass('public.orientacoes_venda') is not null
                   and exists (select 1 from fn where proname = 'registrar_orientacao_venda')
  union all select '45_auditoria_qa (correções da auditoria: datas, valores, visita feita, quem aprovou)', exists (select 1 from pg_trigger where tgname = 'fichas_b_conferir')
                   and exists (select 1 from pg_trigger where tgname = 'diagnosticos_b_aprovacao') and exists (select 1 from pg_trigger where tgname = 'equipe_b_datas')
                   and exists (select 1 from pg_proc where proname = 'visitas_antes' and prosrc like '%já tem diagnóstico registrado%')
                   and exists (select 1 from pg_proc where proname = 'solicitar_pagamento' and prosrc like '%Valor acima do esperado%')
                   and exists (select 1 from pg_proc where proname = 'campo_formulario_fixos' and prosrc like '%round(tot, 2) > 5000%')
  union all select 'conta sem cadastro ativo não gera código de acesso (se FALTA: rode o 45)', exists (select 1 from pg_proc where proname = 'gerar_codigo_acesso' and prosrc like '%coalesce(public.pode_gerenciar(m.papel), false)%')
                   and exists (select 1 from pg_proc where proname = 'pode_gerenciar' and prosrc like '%coalesce(case%')
  union all select 'conta sem cadastro ativo não mexe em pedidos nem vê pendências e saldo (se FALTA: rode o 45)', exists (select 1 from pg_proc where proname = 'mover_pedido_apoio' and prosrc like '%p.solicitante_id is distinct from eu%')
                   and exists (select 1 from pg_proc where proname = 'pendencias_campo' and prosrc like '%p_id = public.meu_id()%')
                   and exists (select 1 from pg_proc where proname = 'saldo_passagens_eventos' and prosrc like '%public.meu_id() is not null%')
  union all select 'valores de pagamento, APL e o próprio cadastro só para quem está ativa (se FALTA: rode o 45)',
                   not exists (select 1 from pg_policy where polname in ('parametros_ler', 'apl_ler') and pg_get_expr(polqual, polrelid) = 'true')
                   and exists (select 1 from pg_policy where polname = 'parametros_ler')
                   and exists (select 1 from pg_policy where polname = 'equipe_ler' and pg_get_expr(polqual, polrelid) like '%ativa%')
  union all select '48_termo_pela_pessoa (a própria pessoa anexa o termo; a data só entra com o termo anexado)', exists (select 1 from fn where proname = 'enviar_meu_termo')
  union all select '46_regras_decididas (regras decididas pela coordenação geral e pendências da auditoria)', exists (select 1 from fn where proname = 'visita_etapa_motivo')
                   and (select count(distinct tgname) from pg_trigger where not tgisinternal and tgname in ('a1_versao', 'diagnosticos_a1_versao', 'diagnosticos_a2_limites', 'fichas_c_regras', 'equipe_c_regras',
                          'custos_visita_a0_travas', 'parametros_a0_validar', 'convites_a0_travas', 'entregas_a0_travas', 'equipe_desligada_matricula', 'equipe_privado_auditoria',
                          'solicitacao_visitas_auditoria', 'entregas_mes_auditoria', 'apl_municipios_auditoria')) = 14
  -- as linhas abaixo voltam a FALTA se o 45 (ou outro script anterior) for rodado de novo depois do 46: nesse caso, rode o 46 de novo
  union all select 'etapas do campo em ordem: implantação só com plano aprovado, acompanhamento só depois dela (se FALTA: rode o 46)',
                   exists (select 1 from pg_proc where proname = 'visitas_antes' and prosrc like '%visita_etapa_motivo%')
                   and exists (select 1 from pg_proc where proname = 'visitas_feita' and prosrc like '%visita_etapa_motivo%')
  union all select 'pedido complementar de ajuda de custo; bolsa continua uma por mês (se FALTA: rode o 46)',
                   not exists (select 1 from pg_constraint where conname = 'uma_por_mes')
                   and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'uma_por_mes' and indexdef ilike '%where%bolsa%')
                   and exists (select 1 from pg_proc where proname = 'solicitar_pagamento' and prosrc like '%complementar%' and prosrc like '%passa do total das visitas detalhadas%')
  union all select 'passagens: teto por finalidade (R$ 70.000,00 e R$ 22.400,00) e pedagógico só com a coordenação geral (se FALTA: rode o 46)',
                   exists (select 1 from pg_proc where proname = 'pedidos_apoio_valor' and prosrc like '%22400%')
                   and exists (select 1 from pg_proc where proname = 'saldo_passagens_eventos' and prosrc like '%passagem_pedagogico_teto%')
                   and exists (select 1 from pg_proc where proname = 'mover_pedido_apoio' and prosrc like '%só a coordenação geral confere%')
                   and exists (select 1 from pg_proc where proname = 'salvar_pedido_apoio' and prosrc like '%1.000.000,00%')
  union all select 'professor do FIC só altera a própria turma (se FALTA: rode o 46)',
                   exists (select 1 from pg_policy where polname = 'turmas_alterar' and pg_get_expr(polqual, polrelid) like '%professor_id%')
                   and exists (select 1 from pg_proc where proname = 'turmas_fic_antes' and prosrc like '%Só a coordenação geral passa a turma%')
  union all select 'FIC: matrícula sem número repetido, encontros até 12 horas por dia (se FALTA: rode o 46)',
                   exists (select 1 from pg_proc where proname = 'matricular_fic' and prosrc like '%Cada pessoa tem o seu número%')
                   and exists (select 1 from pg_proc where proname = 'registrar_encontro_fic' and prosrc like '%máximo é 12 horas por dia%')
  union all select 'datas de hoje no fuso de Fortaleza em todas as funções (se FALTA: rode o 46)',
                   not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and (prosrc ~* 'current_date' or prosrc ~* 'date_trunc\(''month'', now\(\)\)'))
  union all select 'documento arquivado não muda; link de cadastro com dados conferidos; mapa sem repetir município (se FALTA: rode o 46)',
                   exists (select 1 from pg_proc where proname = 'documentos_antes' and prosrc like '%o título e a data não mudam mais%')
                   and exists (select 1 from pg_proc where proname = 'enviar_pre_cadastro' and prosrc like '%não é uma data que existe%')
                   and exists (select 1 from pg_proc where proname = 'vitrine_municipios' and prosrc like '%sem_acento%')
  union all select '52_acompanhamento (perfis de acompanhamento do MDA e do MPA)', to_regclass('public.observadores') is not null and exists (select 1 from pg_proc where proname = 'acompanhamento_dados') and exists (select 1 from pg_proc where proname = 'bloquear_conta_nao_cadastrada' and prosrc like '%observadores%')
  union all select '51_kit_itens (itens do kit com preço de referência)', to_regclass('public.kit_itens') is not null and exists (select 1 from pg_proc where proname = 'salvar_kit_item')
  union all select '55_relatos_problema (relatar problema no sistema)', to_regclass('public.relatos_problema') is not null and exists (select 1 from pg_proc where proname = 'relatar_problema') and exists (select 1 from pg_proc where proname = 'listar_relatos') and exists (select 1 from pg_proc where proname = 'resolver_relato')
  union all select '50_limite_professores (no máximo 2 professores do FIC ativos)', exists (select 1 from pg_trigger where not tgisinternal and tgname = 'equipe_limite_professores') and exists (select 1 from pg_trigger where not tgisinternal and tgname = 'convites_limite_professores')
  union all select '47_auditoria_bd (correções da auditoria do banco de dados)',
                   (select count(*) from fn where proname in ('aprovar_pre_cadastro', 'minhas_fichas', 'trava_aviso', 'cpf_valido', 'limites_texto', 'chave_fixa', 'equipe_solta_login')) = 7
                   and (select count(*) from pg_trigger where not tgisinternal and tgname = 'a00_chave_fixa') >= 7
                   and (select count(*) from pg_trigger where not tgisinternal and tgname = 'a0_tamanho') >= 15
                   and exists (select 1 from pg_trigger where not tgisinternal and tgname = 'equipe_z_solta_login')
                   and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'visitas_executor')
  -- as linhas abaixo voltam a FALTA se o 46 (ou outro script anterior) for rodado de novo depois do 47: nesse caso, rode o 47 de novo
  union all select 'regras de acesso calculadas uma vez por consulta, não por linha (se FALTA: rode o 47)',
                   not exists (select 1 from pg_policies where schemaname = 'public'
                                and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(?<!public\.)\m(meu_papel|meu_id|minha_uf|quem_confere_pedidos)\(\)')
                   and exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'fichas_ler' and qual like '%minhas_fichas%')
  union all select 'edição ao mesmo tempo é avisada: ficha, diagnóstico, visita e avaliação (se FALTA: rode o 47)',
                   exists (select 1 from pg_proc where proname = 'versao_conferir' and prosrc like '%alterado por outra pessoa enquanto você editava%')
                   and (select count(*) from pg_trigger t join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and p.proname = 'versao_conferir') = 4
  union all select 'privilégios: quem não entrou só executa as cinco funções públicas e não tem acesso a tabela (se FALTA: rode o 47)',
                   not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon')
                   and not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype and (p.proacl is not null or p.prosecdef)
                                    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') and has_function_privilege('anon', p.oid, 'EXECUTE')
                                    and p.proname not in ('ver_convite', 'enviar_pre_cadastro', 'pedir_novo_acesso', 'vitrine', 'vitrine_municipios'))
                   and not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and not ('search_path=public, pg_temp' = any (coalesce(p.proconfig, '{}'))))
  union all select 'tamanho de texto conferido no banco, com mensagem que diz o campo (se FALTA: rode o 47)',
                   exists (select 1 from pg_proc where proname = 'enviar_pre_cadastro' and prosrc like '%Texto muito longo em nome%')
                   and exists (select 1 from pg_proc where proname = 'salvar_pedido_apoio' and prosrc like '%Texto muito longo em dados do pedido%')
                   and (select count(*) from pg_constraint where connamespace = 'public'::regnamespace and conname ~ '^tam_') >= 60
  union all select 'conferências que esperam uma pela outra: desligar, agendar, pedir pagamento, km, encontro, diagnóstico (se FALTA: rode o 47)',
                   exists (select 1 from pg_proc where proname = 'visitas_antes' and prosrc like '%new.executor_id for share%')
                   and exists (select 1 from pg_proc where proname = 'solicitar_pagamento' and prosrc like '%public.meu_id() for share%' and prosrc like '%order by v.id for share%')
                   and exists (select 1 from pg_proc where proname = 'custos_visita_travas' and prosrc like '%order by s.id for share%')
                   and exists (select 1 from pg_proc where proname = 'diagnosticos_antes' and prosrc like '%new.ficha_id for share%')
                   and exists (select 1 from pg_proc where proname = 'registrar_encontro_fic' and prosrc like '%trava_aviso(''solicitar_pagamento_''%')
                   and exists (select 1 from pg_proc where proname = 'cancelar_matricula_fic' and prosrc like '%m.equipe_id for update%')
  union all select 'repetição depois de falha de rede não grava duas vezes: pedido, orientação, link e documento (se FALTA: rode o 47)',
                   exists (select 1 from pg_proc where proname = 'salvar_pedido_apoio' and prosrc like '%interval ''2 minutes''%')
                   and exists (select 1 from pg_proc where proname = 'registrar_orientacao_venda' and prosrc like '%interval ''2 minutes''%')
                   and exists (select 1 from pg_proc where proname = 'criar_convite' and prosrc like '%interval ''20 seconds''%')
                   and exists (select 1 from pg_proc where proname = 'documentos_antes' and prosrc like '%interval ''2 minutes''%')
  union all select 'CPF com dígito verificador conferido na ficha, na equipe e no cadastro pelo link (se FALTA: rode o 47)',
                   exists (select 1 from pg_proc where proname = 'fichas_regras' and prosrc like '%cpf_valido%')
                   and exists (select 1 from pg_proc where proname = 'equipe_regras' and prosrc like '%cpf_valido%' and prosrc like '%fecharia um círculo%')
                   and exists (select 1 from pg_proc where proname = 'enviar_pre_cadastro' and prosrc like '%cpf_valido%')
  union all select 'canal de venda, APL, vitrine, parâmetros e planilha com as conferências do 47 (se FALTA: rode o 47)',
                   exists (select 1 from pg_proc where proname = 'salvar_canal_venda' and prosrc like '%pelo menos 2 letras%')
                   and exists (select 1 from pg_proc where proname = 'apl_carimbo' and prosrc like '%sem_acento%')
                   and exists (select 1 from pg_proc where proname = 'vitrine_fotos_antes' and prosrc like '%regexp_split_to_array%')
                   and exists (select 1 from pg_proc where proname = 'parametros_validar' and prosrc like '%Parâmetro desconhecido%')
                   and exists (select 1 from pg_proc where proname = 'execucao_planilhas_antes' and prosrc like '%Os totais da planilha%')
  union all select 'espera por trava de no máximo 5 segundos (se FALTA: rode o 47)',
                   not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosrc ~ '(pg_advisory_xact_lock|trava_aviso)\('
                                and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') and not ('lock_timeout=5s' = any (coalesce(p.proconfig, '{}'))))
  -- regras que VOLTAM AO ANTIGO se um script velho for rodado de novo fora de ordem (se FALTA, rode de novo o número indicado)
  union all select 'primeiro acesso só com código (se FALTA: rode o 52 de novo; antes dele, o 18 e o 43)', exists (select 1 from pg_proc where proname = 'bloquear_conta_nao_cadastrada' and prosrc like '%codigo_hash%')
  union all select '200 dias de campo e avaliação (se FALTA: rode o 13 e depois o 15)', exists (select 1 from pg_proc where proname = 'visitas_antes' and prosrc like '%200 dias de campo%')
  union all select 'coordenação geral corrige fichas (se FALTA: rode o 15)', exists (select 1 from pg_proc where proname = 'fichas_antes' and prosrc like '%corrige os dados e também decide%')
  union all select 'coordenação geral corrige avaliações (se FALTA: rode o 15)', exists (select 1 from pg_proc where proname = 'avaliacoes_antes' and prosrc like '%''agente'',''coord_geral''%')
  union all select 'auxiliar vê situação bancária (se FALTA: rode o 11)', exists (select 1 from pg_proc where proname = 'situacao_bancaria' and prosrc like '%auxiliar_adm%')
  union all select 'quem confere não autoriza o mesmo pedido (se FALTA: rode o 26)', exists (select 1 from pg_proc where proname = 'mover_pedido_apoio' and prosrc like '%Quem conferiu não autoriza%')
  union all select 'visita de diagnóstico só pelo formulário (se FALTA: rode o 42)', exists (select 1 from pg_proc where proname = 'visitas_feita' and prosrc like '%próprio formulário%')
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
