-- Garantias ESTRUTURAIS do banco (auditoria de 02/10/2026; atualizado com o 47_auditoria_bd.sql): chave primária e RLS em toda tabela, vínculos (FK),
-- listas fechadas (CHECK), índices únicos que sustentam regra de negócio, funções e privilégios.
-- Só lê o catálogo do banco: não grava em nenhuma tabela do sistema, não precisa de usuário nem de dados.
-- Roda sozinho (psql -d <banco de teste> -f test_estrutura_bd.sql) ou dentro da suíte, em qualquer posição;
-- pode rodar quantas vezes quiser. Cada caso lista, em "det", o que saiu do esperado (vazio = tudo certo).
--
-- O que HOJE NÃO VALE está escrito mais abaixo, comentado, na seção "PENDENTES", com a explicação.
-- Quando a correção entrar, é só tirar o comentário do caso.
--
-- PRIVILÉGIOS: o banco de teste (stub_supabase.sql) não imita os "default privileges" do Supabase real, que dão ALL
-- em toda tabela nova e EXECUTE em toda função nova a anon e authenticated. Com o 47 instalado, os casos de privilégio
-- passam nos dois (banco de teste e banco montado como o Supabase). Para conferir: aplique, ANTES dos scripts 01-47,
--   alter default privileges in schema public grant all on tables to anon, authenticated;
--   alter default privileges in schema public grant all on functions to anon, authenticated;
--   alter default privileges in schema public grant all on sequences to anon, authenticated;
-- e rode este arquivo.
\set QUIET on
\pset format unaligned
\pset tuples_only on
create table if not exists res (n serial, caso text, ok boolean, det text);
truncate res;

-- cada caso é uma consulta que devolve "o que está errado" (uma linha de texto por problema); sem linhas = passou
create or replace function est_caso(p_caso text, p_sql text) returns void language plpgsql as $$
declare v text; q int;
begin
  begin
    execute 'select count(*), string_agg(x, '', '' order by x) from (' || p_sql || ') q(x)' into q, v;
    insert into res (caso, ok, det) values (p_caso, q = 0, coalesce(v, ''));
  exception when others then
    insert into res (caso, ok, det) values (p_caso, false, 'ERRO NO TESTE: ' || sqlerrm);
  end;
end $$;
-- compara o que existe com a lista esperada: acusa o que FALTA (-) e o que SOBRA (+)
create or replace function est_lista(p_caso text, p_sql_existe text, p_esperado text[]) returns void language plpgsql as $$
declare tem text[]; v text;
begin
  begin
    execute 'select coalesce(array_agg(x), ''{}'') from (' || p_sql_existe || ') q(x)' into tem;
    select string_agg(d, ', ' order by d) into v from (
      select '-' || e d from unnest(p_esperado) e where e <> all (tem)
      union all select '+' || t from unnest(tem) t where t <> all (p_esperado)) x;
    insert into res (caso, ok, det) values (p_caso, v is null, coalesce(v, ''));
  exception when others then
    insert into res (caso, ok, det) values (p_caso, false, 'ERRO NO TESTE: ' || sqlerrm);
  end;
end $$;

-- ===================================================================== 1. TABELAS
select est_lista('as 39 tabelas do sistema existem (nenhuma a menos, nenhuma a mais)',
  $q$select c.relname::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname <> 'res'$q$,
  array['acesso_codigos','acessos','agua_situacoes','apl_municipios','auditoria','avaliacoes','canais_venda','ciencias','contas_ja_ligadas','convites','custos_visita',
        'diagnosticos','documentos_projeto','entregas_mes','equipe','equipe_bancario','equipe_privado','execucao_lancamentos','execucao_planilhas','exemplo','fic_encontros','fic_presencas',
        'fichas','ia_usos','kit_itens','matriculas_fic','observadores','orientacoes_venda','parametros','pedidos_apoio','pedidos_novo_acesso','pre_cadastros','solicitacao_visitas',
        'solicitacoes_pagamento','testes_resultados','turmas_fic','visitas','vitrine_fotos','vitrine_remover']);
select est_caso('toda tabela tem chave primária',
  $q$select c.relname::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname <> 'res'
      and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p')$q$);
select est_caso('não há visão (view) nem tabela materializada no schema public (escapariam da RLS)',
  $q$select c.relname::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')$q$);

-- ===================================================================== 2. RLS
select est_caso('toda tabela tem RLS ligada',
  $q$select c.relname::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname <> 'res' and not c.relrowsecurity$q$);
select est_lista('tabelas com RLS e NENHUMA regra de acesso são só as quatro que ninguém lê pelo app (acesso só por função)',
  $q$select c.relname::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname <> 'res' and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)$q$,
  array['acesso_codigos','contas_ja_ligadas','equipe_bancario','observadores']);
select est_caso('toda regra de acesso (policy) é só para quem entrou no sistema (authenticated): nenhuma para anon ou public',
  $q$select tablename || '.' || policyname from pg_policies where schemaname in ('public', 'storage') and roles <> '{authenticated}'$q$);
select est_caso('nenhuma regra de acesso "aberta" (true) para ler ou gravar',
  $q$select tablename || '.' || policyname from pg_policies where schemaname in ('public', 'storage') and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')$q$);
select est_lista('apagar (DELETE) só tem regra de acesso nas tabelas em que é permitido de propósito (fora a regra geral da coordenação geral)',
  $q$select distinct tablename::text from pg_policies where schemaname = 'public' and cmd = 'DELETE'$q$,
  array['custos_visita','entregas_mes','testes_resultados','vitrine_fotos']);

-- ===================================================================== 3. PRIVILÉGIOS DE TABELA
select est_caso('anônimo (anon) não tem privilégio em nenhuma tabela',
  $q$select table_name || ':' || string_agg(privilege_type, '/' order by privilege_type) from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'PUBLIC') and table_name <> 'res' group by table_name$q$);
select est_lista('quem entrou (authenticated) só apaga (DELETE) nas cinco tabelas em que é permitido de propósito',
  $q$select table_name::text from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'DELETE' and table_name <> 'res'$q$,
  array['custos_visita','entregas_mes','testes_resultados','vitrine_fotos','vitrine_remover']);
select est_caso('ninguém (anon, authenticated) tem TRUNCATE, REFERENCES ou TRIGGER em tabela alguma',
  $q$select grantee || ':' || table_name || ':' || privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER') and table_name <> 'res'$q$);
select est_lista('tabelas sem NENHUM privilégio direto para quem entrou (só por função do banco)',
  $q$select c.relname::text from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname <> 'res'
      and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated')$q$,
  array['acesso_codigos','contas_ja_ligadas','equipe_bancario','observadores']);
select est_lista('tabelas que quem entrou só LÊ (toda gravação passa por função do banco ou não existe)',
  $q$select table_name::text from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and table_name <> 'res'
      group by table_name having string_agg(privilege_type, ',' order by privilege_type) = 'SELECT'$q$,
  array['acessos','agua_situacoes','auditoria','canais_venda','exemplo','fic_encontros','fic_presencas','ia_usos','kit_itens','matriculas_fic','orientacoes_venda','pedidos_apoio',
        'solicitacao_visitas','solicitacoes_pagamento']);
select est_caso('o histórico (auditoria) não pode ser gravado, alterado nem apagado por ninguém pelo app',
  $q$select grantee || ':' || privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'auditoria'
      and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type <> 'SELECT'$q$);
select est_caso('anônimo não usa as sequências (numeração) do banco',
  $q$select s.relname::text from (select c.oid, c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'S' and c.relname <> 'res_n_seq' offset 0) s
      where has_sequence_privilege('anon', s.oid, 'USAGE')$q$);

-- ===================================================================== 4. FUNÇÕES
select est_caso('nenhuma função que roda com o direito do banco (security definer) está sem search_path fixo',
  $q$select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%')$q$);
select est_caso('nenhuma função security definer tem o schema public gravável por usuário comum no search_path (só public)',
  $q$select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%' and x not in ('search_path=public', 'search_path=public, pg_temp', 'search_path="$user", public'))$q$);
select est_caso('usuário comum não cria objetos no schema public',
  $q$select r from unnest(array['anon', 'authenticated']) r where has_schema_privilege(r, 'public', 'CREATE')$q$);
select est_lista('funções security definer que o ANÔNIMO executa: só as cinco públicas de propósito',
  $q$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'EXECUTE')$q$,
  array['enviar_pre_cadastro','pedir_novo_acesso','ver_convite','vitrine','vitrine_municipios']);
select est_lista('funções internas que NINGUÉM chama pelo app (nem quem entrou)',
  $q$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')$q$,
  array['acomp_n','codigo_coordenacao_geral','cpf_valido','fic_matriculados_em','fic_mes_fechado','novo_codigo_acesso','sem_acento','trava_aviso','visita_etapa_motivo']);
select est_caso('o único SQL montado em tempo de execução (EXECUTE) é o de vitrine_municipios, que não recebe parâmetro',
  $q$select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
      and (p.prosecdef or p.prorettype = 'trigger'::regtype or has_function_privilege('anon', p.oid, 'EXECUTE') is false)   -- funções do sistema (as de apoio dos testes ficam de fora)
      and p.proname not in ('est_caso', 'est_lista', 't', 'f', 'logar')
      and p.prosrc ~* '\mexecute\M\s+(''|format|[a-z_]+\s*(\|\||;))' and not (p.proname = 'vitrine_municipios' and p.pronargs = 0)$q$);
select est_caso('as funções chamadas pelo app (js/api-supabase.js) existem com os mesmos nomes de parâmetro',
  $q$select e.f || '(' || array_to_string(e.args, ',') || ')' from (values
      ('vincular_conta', '{}'::text[]), ('pedir_novo_acesso', '{p_email}'), ('registrar_acesso', '{p_tipo,p_aparelho}'), ('gerar_codigo_acesso', '{p_equipe}'),
      ('criar_convite', '{p_papel,p_uf,p_substitui}'), ('ver_convite', '{p_token}'), ('enviar_pre_cadastro', '{p_token,p_dados}'), ('meus_dados_bancarios', '{}'),
      ('salvar_meus_dados_bancarios', '{p}'), ('ver_conta_para_arlo', '{p_equipe}'), ('situacao_bancaria', '{}'), ('vitrine', '{}'), ('vitrine_municipios', '{}'),
      ('equipe_do_estado', '{}'), ('definir_minha_foto', '{p_path}'), ('solicitar_pagamento', '{p_tipo,p_mes,p_valor,p_relatorio,p_visitas,p_detalhe}'),
      ('avalizar_pagamento', '{p_id,p_ok,p_obs,p_valor}'), ('registrar_no_arlo', '{p_id,p_protocolo}'),
      ('salvar_canal_venda', '{p_id,p_uf,p_municipio,p_tipo,p_nome,p_detalhe,p_contato,p_ativo}'), ('registrar_orientacao_venda', '{p_ficha,p_dados}'),
      ('registrar_situacao_agua', '{p_ficha,p_situacao,p_obs}'), ('quem_confere_pedidos', '{}'), ('salvar_pedido_apoio', '{p_id,p_tipo,p_titulo,p_data,p_dados,p_justificativa}'),
      ('definir_valor_pedido', '{p_id,p_valor}'), ('saldo_passagens_eventos', '{}'), ('mover_pedido_apoio', '{p_id,p_acao,p_obs,p_protocolo}'), ('equipe_para_fic', '{}'),
      ('registrar_encontro_fic', '{p_id,p_turma,p_data,p_carga,p_modalidade,p_conteudo,p_presentes}'), ('cancelar_encontro_fic', '{p_id,p_motivo}'),
      ('confirmar_presenca_fic', '{p_encontro}'), ('matricular_fic', '{p_turma,p_equipe,p_numero,p_data}'), ('cancelar_matricula_fic', '{p_id,p_motivo}'),
      ('registrar_uso_ia', '{}'), ('aprovar_pre_cadastro', '{p_pre,p_equipe,p_privado}')) e(f, args)
     where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.f
                         and coalesce(p.proargnames[1:p.pronargs], '{}') = e.args
                         and (e.f in ('pedir_novo_acesso', 'ver_convite', 'enviar_pre_cadastro', 'vitrine', 'vitrine_municipios') or has_function_privilege('authenticated', p.oid, 'EXECUTE')))$q$);

-- ===================================================================== 5. VÍNCULOS (FK)
select est_lista('os 71 vínculos entre tabelas (tabela.coluna > tabela de destino) existem',
  $q$select k.conrelid::regclass::text || '.' || a.attname || '>' || k.confrelid::regclass::text from pg_constraint k
       join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.contype = 'f' and k.connamespace = 'public'::regnamespace$q$,
  array['kit_itens.atualizado_por>equipe','observadores.criado_por>equipe','acesso_codigos.equipe_id>equipe','acessos.equipe_id>equipe','agua_situacoes.ficha_id>fichas','agua_situacoes.registrado_por>equipe','apl_municipios.atualizado_por>equipe',
        'avaliacoes.executor_id>equipe','avaliacoes.ficha_id>fichas','avaliacoes.visita_id>visitas','canais_venda.atualizado_por>equipe','canais_venda.criado_por>equipe',
        'ciencias.equipe_id>equipe','contas_ja_ligadas.equipe_id>equipe','convites.criado_por>equipe','convites.substitui_id>equipe','custos_visita.definido_por>equipe',
        'custos_visita.visita_id>visitas','diagnosticos.aprovado_por>equipe','diagnosticos.conteudo_alterado_por>equipe','diagnosticos.executor_id>equipe','diagnosticos.ficha_id>fichas',
        'diagnosticos.visita_id>visitas','documentos_projeto.arquivado_por>equipe','documentos_projeto.enviado_por>equipe','entregas_mes.equipe_id>equipe','equipe.criado_por>equipe',
        'equipe.substitui_id>equipe','equipe.user_id>auth.users','equipe_bancario.equipe_id>equipe','equipe_privado.equipe_id>equipe','execucao_lancamentos.criado_por>equipe',
        'execucao_lancamentos.estorno_de>execucao_lancamentos','execucao_planilhas.enviado_por>equipe','fic_encontros.cancelado_por>equipe','fic_encontros.professor_id>equipe',
        'fic_encontros.turma_id>turmas_fic','fic_presencas.encontro_id>fic_encontros','fic_presencas.equipe_id>equipe','fic_presencas.marcado_por>equipe','fichas.aprovada_por>equipe',
        'fichas.bolsista_id>equipe','ia_usos.equipe_id>equipe','matriculas_fic.criado_por>equipe','matriculas_fic.equipe_id>equipe','matriculas_fic.turma_id>turmas_fic',
        'orientacoes_venda.feito_por>equipe','orientacoes_venda.ficha_id>fichas','parametros.atualizado_por>equipe','pedidos_apoio.conferido_por>equipe','pedidos_apoio.decidido_por>equipe',
        'pedidos_apoio.solicitante_id>equipe','pedidos_novo_acesso.equipe_id>equipe','pedidos_novo_acesso.resolvido_por>equipe','pre_cadastros.convite_id>convites',
        'pre_cadastros.decidido_por>equipe','pre_cadastros.equipe_id>equipe','pre_cadastros.substitui_id>equipe','solicitacao_visitas.solicitacao_id>solicitacoes_pagamento',
        'solicitacao_visitas.visita_id>visitas','solicitacoes_pagamento.arlo_por>equipe','solicitacoes_pagamento.aval_por>equipe','solicitacoes_pagamento.equipe_id>equipe',
        'testes_resultados.equipe_id>equipe','turmas_fic.criado_por>equipe','turmas_fic.professor_id>equipe','visitas.criado_por>equipe','visitas.executor_id>equipe',
        'visitas.ficha_id>fichas','vitrine_fotos.ficha_id>fichas','vitrine_fotos.publicada_por>equipe']);
select est_caso('todo vínculo está validado (nenhum criado com NOT VALID)',
  $q$select k.conname::text from pg_constraint k where k.contype = 'f' and k.connamespace = 'public'::regnamespace and not k.convalidated$q$);
select est_lista('apagar em cascata (ON DELETE CASCADE) só nas sete tabelas de apoio da pessoa (o sistema não apaga pessoa: é só para instalação de teste)',
  $q$select k.conrelid::regclass::text from pg_constraint k where k.contype = 'f' and k.connamespace = 'public'::regnamespace and k.confdeltype = 'c'$q$,
  array['acesso_codigos','acessos','ciencias','entregas_mes','ia_usos','pedidos_novo_acesso','testes_resultados']);
select est_lista('ON DELETE SET NULL só no login (equipe.user_id): apagar a conta não apaga a pessoa',
  $q$select k.conrelid::regclass::text || '.' || a.attname from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
      where k.contype = 'f' and k.connamespace = 'public'::regnamespace and k.confdeltype = 'n'$q$,
  array['equipe.user_id']);
select est_caso('nenhum vínculo propaga troca de chave (ON UPDATE é sempre NO ACTION)',
  $q$select k.conname::text from pg_constraint k where k.contype = 'f' and k.connamespace = 'public'::regnamespace and k.confupdtype <> 'a'$q$);
select est_caso('fichas, visitas, diagnósticos, pagamentos e pessoas com dependentes não são apagados nem em cascata (todos os vínculos para eles são NO ACTION, fora as tabelas de apoio)',
  $q$select k.conname::text from pg_constraint k where k.contype = 'f' and k.connamespace = 'public'::regnamespace and k.confdeltype <> 'a'
      and k.confrelid in ('public.fichas'::regclass, 'public.visitas'::regclass, 'public.diagnosticos'::regclass, 'public.solicitacoes_pagamento'::regclass, 'public.turmas_fic'::regclass, 'public.fic_encontros'::regclass, 'public.convites'::regclass)$q$);

-- ===================================================================== 6. LISTAS FECHADAS (CHECK)
-- cada linha: tabela, coluna e os valores aceitos; o caso falha se não houver CHECK na coluna citando TODOS os valores
select est_caso('todo campo de opções tem CHECK no banco com a lista completa',
  $q$select e.t || '.' || e.c from (values
      ('equipe', 'papel', '{coord_geral,coord_tecnico,articulacao,apoio,agente,professor_fic,auxiliar_adm}'::text[]), ('equipe', 'status', '{ativa,desligada}'), ('equipe', 'uf', '{AL,BA,PE,PI,SE}'),
      ('fichas', 'uf', '{AL,BA,PE,PI,SE}'), ('fichas', 'situacao', '{aguardando,aprovada,devolvida}'), ('fichas', 'resultado', '{selecionada,lista_espera,nao_atende,sem_agua}'),
      ('fichas', 'assinatura', '{assinatura,digital}'), ('visitas', 'etapa', '{diagnostico,implantacao,acompanhamento,avaliacao}'), ('visitas', 'situacao', '{prevista,realizada,cancelada}'),
      ('diagnosticos', 'situacao', '{aguardando,aprovado,devolvido}'), ('diagnosticos', 'agua_seca', '{sim,as_vezes,nao}'), ('diagnosticos', 'lote', '{1,2}'),
      ('avaliacoes', 'quintal_produz', '{sim,em_parte,nao}'), ('avaliacoes', 'ebia_nivel', '{seguranca,leve,moderada,grave}'),
      ('convites', 'papel', '{coord_tecnico,articulacao,apoio,agente,professor_fic,auxiliar_adm}'), ('convites', 'uf', '{AL,BA,PE,PI,SE}'),
      ('pre_cadastros', 'situacao', '{aguardando,aprovado,recusado}'), ('equipe_bancario', 'tipo_conta', '{corrente,poupanca,pagamento}'), ('equipe_bancario', 'pix_tipo', '{cpf,email,celular,aleatoria}'),
      ('apl_municipios', 'uf', '{AL,BA,PE,PI,SE}'), ('turmas_fic', 'uf', '{AL,BA,PE,PI,SE}'), ('solicitacoes_pagamento', 'tipo', '{ajuda_custo,bolsa}'),
      ('solicitacoes_pagamento', 'situacao', '{solicitada,devolvida,avalizada,lancada}'), ('entregas_mes', 'item', '{presenca,ava}'), ('ciencias', 'documento', '{guia_bolsista,guia_agente}'),
      ('testes_resultados', 'resultado', '{ok,nao,pulou}'), ('pedidos_apoio', 'tipo', '{passagem,evento}'), ('pedidos_apoio', 'uf', '{AL,BA,PE,PI,SE}'),
      ('pedidos_apoio', 'situacao', '{enviado,devolvido,conferido,autorizado,recusado,cancelado}'),
      ('documentos_projeto', 'tipo', '{ata,oficio,relatorio,contrato,plano,lista_presenca,foto,outro}'), ('documentos_projeto', 'uf', '{AL,BA,PE,PI,SE}'),
      ('pedidos_novo_acesso', 'situacao', '{aguardando,atendido,descartado}'), ('acessos', 'tipo', '{entrada,primeiro_acesso,abriu,saida,saida_inatividade,senha_trocada}'),
      ('execucao_lancamentos', 'tipo', '{despesa,repasse}'), ('fic_encontros', 'modalidade', '{presencial,online,ava}'),
      ('agua_situacoes', 'situacao', '{sem_solucao,encaminhada,em_andamento,concluida}'), ('canais_venda', 'tipo', '{feira,grupo,merenda,paa,comprador,outro}'), ('canais_venda', 'uf', '{AL,BA,PE,PI,SE}')
     ) e(t, c, vals)
     where not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || e.t)::regclass and k.contype = 'c'
                         and pg_get_constraintdef(k.oid) ~ ('\m' || e.c || '\M')
                         and not exists (select 1 from unnest(e.vals) v where pg_get_constraintdef(k.oid) !~ ('(''|\[|, )' || v || '(''|\]|,)')))$q$);
select est_caso('regras de coerência do registro continuam no banco (CHECK com nome)',
  $q$select e from unnest(array['equipe.datas_coerentes','equipe.desligamento_completo','equipe.uf_por_papel','equipe.siape_ok','fichas.criterios_para_selecao','fichas.digital_com_testemunha',
      'fichas.idade_minima','fichas.sem_agua_encaminhada','visitas.realizada_com_data','diagnosticos.com_agua_com_lote','diagnosticos.sem_agua_sem_plano','diagnosticos.gps_ou_motivo',
      'avaliacoes.aval_gps_ou_motivo','convites.uf_do_convite','equipe_bancario.pix_completo','turmas_fic.periodo_ok','fic_presencas.fic_pres_confirmado_presente']) e
     where not exists (select 1 from pg_constraint k where k.contype = 'c' and k.conrelid = ('public.' || split_part(e, '.', 1))::regclass and k.conname = split_part(e, '.', 2))$q$);
select est_caso('formato conferido no banco: CPF (11 números), NIS, e-mail, banco/agência/conta, mês no dia 1º',
  $q$select e.t || '.' || e.c from (values ('equipe', 'cpf', '\^\[0-9\]\{11\}\$'), ('fichas', 'cpf', '\^\[0-9\]\{11\}\$'), ('pre_cadastros', 'cpf', '\^\[0-9\]\{11\}\$'), ('fichas', 'testemunha_cpf', '\^\[0-9\]\{11\}\$'),
      ('fichas', 'nis', '\^\[0-9\]\{11\}\$'), ('equipe_privado', 'nis', '\^\[0-9\]\{11\}\$'), ('equipe', 'email', '@'), ('pre_cadastros', 'email', '@'),
      ('equipe_bancario', 'banco_codigo', '\{3\}'), ('equipe_bancario', 'agencia', '\{1,5\}'), ('equipe_bancario', 'conta', '\{1,13\}'),
      ('solicitacoes_pagamento', 'mes', 'EXTRACT\(day'), ('entregas_mes', 'mes', 'EXTRACT\(day')) e(t, c, padrao)
     where not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || e.t)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ ('\m' || e.c || '\M') and pg_get_constraintdef(k.oid) ~ e.padrao)$q$);
select est_caso('limites numéricos conferidos no banco (CHECK): km, carga horária, EBIA, pessoas da família, metas, valores',
  $q$select e.t || '.' || e.c from (values ('custos_visita', 'km_ida'), ('fic_encontros', 'carga_horaria'), ('avaliacoes', 'ebia_pontos'), ('fichas', 'pessoas_familia'), ('fichas', 'posicao_espera'),
      ('equipe', 'meta_diagnosticos'), ('equipe', 'meta_quintais'), ('equipe', 'meta_visitas'), ('solicitacoes_pagamento', 'valor_solicitado'), ('solicitacoes_pagamento', 'valor_avalizado'),
      ('pedidos_apoio', 'valor_autorizado'), ('execucao_lancamentos', 'valor'), ('documentos_projeto', 'tamanho'), ('execucao_planilhas', 'nao_classificadas')) e(t, c)
     where not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || e.t)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ ('\m' || e.c || '\M') and pg_get_constraintdef(k.oid) ~ '[<>]')$q$);

-- ===================================================================== 7. ÍNDICES ÚNICOS QUE SUSTENTAM REGRA DE NEGÓCIO
-- cada linha: tabela, colunas (na ordem), se o índice é parcial (com condição) e a regra que ele garante
select est_caso('índices únicos de regra de negócio existem (CPF da ficha, vagas da equipe, uma visita por etapa, um diagnóstico por quintal, uma bolsa por mês...)',
  $q$select e.t || '(' || e.cols || ')' || case when e.parcial then ' parcial' else '' end || ': ' || e.regra from (values
      ('fichas', 'cpf', false, 'um CPF, uma ficha'),
      ('equipe', 'cpf', true, 'CPF não se repete entre pessoas ativas'), ('equipe', 'email', true, 'e-mail não se repete entre pessoas ativas'),
      ('equipe', 'papel', true, 'uma coordenação geral/técnica e um auxiliar ativos'), ('equipe', 'papel,uf', true, 'uma articulação e um apoio ativos por estado'),
      ('equipe', 'user_id', false, 'um login, uma pessoa'),
      ('visitas', 'ficha_id,etapa', true, 'uma visita de diagnóstico, implantação e avaliação por quintal'),
      ('diagnosticos', 'ficha_id', false, 'um diagnóstico por quintal'), ('diagnosticos', 'visita_id', false, 'um diagnóstico por visita'), ('avaliacoes', 'visita_id', false, 'uma avaliação por visita'),
      ('matriculas_fic', 'equipe_id', true, 'uma matrícula ativa por pessoa'), ('solicitacoes_pagamento', 'equipe_id,mes', true, 'uma bolsa por pessoa por mês'),
      ('solicitacao_visitas', 'visita_id', false, 'cada visita em um pedido de pagamento só'), ('custos_visita', 'visita_id', false, 'um km por visita'),
      ('entregas_mes', 'equipe_id,mes,item', false, 'uma entrega por pessoa, mês e item'), ('ciencias', 'equipe_id,documento', false, 'uma ciência por pessoa e guia'),
      ('testes_resultados', 'equipe_id,tarefa', false, 'uma resposta por pessoa e tarefa'), ('fic_presencas', 'encontro_id,equipe_id', false, 'uma presença por pessoa e encontro'),
      ('convites', 'token', false, 'link de cadastro único'), ('pre_cadastros', 'convite_id', false, 'um pré-cadastro por link'),
      ('pedidos_novo_acesso', 'equipe_id', true, 'um pedido de novo acesso aberto por pessoa'), ('execucao_lancamentos', 'estorno_de', true, 'um estorno por lançamento'),
      ('equipe_privado', 'equipe_id', false, 'um registro de dados pessoais por pessoa'), ('equipe_bancario', 'equipe_id', false, 'uma conta por pessoa'),
      ('acesso_codigos', 'equipe_id', false, 'um código de primeiro acesso por pessoa'), ('apl_municipios', 'uf,municipio', false, 'um registro por município'),
      ('documentos_projeto', 'arquivo_path', false, 'um registro por arquivo'), ('execucao_planilhas', 'arquivo_path', false, 'um registro por arquivo'), ('vitrine_fotos', 'path', false, 'um registro por foto'),
      ('parametros', 'chave', false, 'um valor por chave')) e(t, cols, parcial, regra)
     where not exists (select 1 from pg_index i where i.indrelid = ('public.' || e.t)::regclass and i.indisunique and i.indisvalid and (i.indpred is not null) = e.parcial
                         and (select string_agg(a.attname, ',' order by k.ord) from unnest(i.indkey::int2[]) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) = e.cols)$q$);
select est_caso('nenhum índice inválido e nenhum índice repetido (mesmas colunas, mesma condição)',
  $q$select c.relname::text from pg_index i join pg_class c on c.oid = i.indexrelid where c.relnamespace = 'public'::regnamespace and not i.indisvalid
     union all
     select ca.relname || '=' || cb.relname from pg_index a join pg_index b on a.indrelid = b.indrelid and a.indexrelid < b.indexrelid and a.indkey::text = b.indkey::text
        and coalesce(pg_get_expr(a.indpred, a.indrelid), '') = coalesce(pg_get_expr(b.indpred, b.indrelid), '') and coalesce(pg_get_expr(a.indexprs, a.indrelid), '') = coalesce(pg_get_expr(b.indexprs, b.indrelid), '')
       join pg_class ca on ca.oid = a.indexrelid join pg_class cb on cb.oid = b.indexrelid where ca.relnamespace = 'public'::regnamespace$q$);

-- ===================================================================== 8. TIPOS, OBRIGATÓRIOS E PADRÕES
select est_caso('nenhuma coluna em ponto flutuante (real, double precision) nem do tipo money',
  $q$select table_name || '.' || column_name from information_schema.columns where table_schema = 'public' and data_type in ('real', 'double precision', 'money') and table_name <> 'res'$q$);
select est_caso('dinheiro em numeric com 2 casas',
  $q$select e.t || '.' || e.c from (values ('solicitacoes_pagamento', 'valor_solicitado'), ('solicitacoes_pagamento', 'valor_avalizado'), ('pedidos_apoio', 'valor_autorizado'),
      ('execucao_lancamentos', 'valor'), ('execucao_planilhas', 'total_gasto'), ('execucao_planilhas', 'total_recebido')) e(t, c)
     where not exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = e.t and k.column_name = e.c and k.data_type = 'numeric' and k.numeric_scale = 2)$q$);
select est_caso('estado (uf) é char(2) em todas as tabelas',
  $q$select table_name::text from information_schema.columns where table_schema = 'public' and column_name = 'uf' and not (data_type = 'character' and character_maximum_length = 2)$q$);
select est_caso('datas de calendário em date e carimbos de hora em timestamptz (nenhum timestamp sem fuso)',
  $q$select table_name || '.' || column_name from information_schema.columns where table_schema = 'public' and table_name <> 'res'
      and (data_type = 'timestamp without time zone' or (column_name ~ '_em$' and data_type not in ('timestamp with time zone', 'date')) or (column_name ~ '^data' and data_type <> 'date'))$q$);
select est_caso('colunas que não podem ficar vazias são NOT NULL (estado, situação, etapa, datas de criação, chaves)',
  $q$select e from unnest(array['fichas.uf','fichas.situacao','fichas.resultado','fichas.cpf','fichas.nome','fichas.data_ficha','fichas.data_nascimento','fichas.criado_em','fichas.atualizado_em','fichas.consent_dados',
      'visitas.ficha_id','visitas.uf','visitas.etapa','visitas.situacao','visitas.executor_id','visitas.data_prevista','visitas.criado_em',
      'diagnosticos.ficha_id','diagnosticos.visita_id','diagnosticos.uf','diagnosticos.situacao','diagnosticos.data_visita','diagnosticos.agua_seca','diagnosticos.sem_agua','diagnosticos.dados','diagnosticos.criado_em',
      'avaliacoes.ficha_id','avaliacoes.visita_id','avaliacoes.uf','avaliacoes.data_visita','avaliacoes.criado_em',
      'equipe.papel','equipe.nome','equipe.cpf','equipe.email','equipe.status','equipe.data_inicio','equipe.consentimento_lgpd','equipe.criado_em',
      'solicitacoes_pagamento.tipo','solicitacoes_pagamento.equipe_id','solicitacoes_pagamento.mes','solicitacoes_pagamento.situacao','solicitacoes_pagamento.solicitada_em',
      'pedidos_apoio.tipo','pedidos_apoio.uf','pedidos_apoio.solicitante_id','pedidos_apoio.situacao','pedidos_apoio.data_ref','pedidos_apoio.criado_em',
      'turmas_fic.nome','turmas_fic.professor_id','matriculas_fic.turma_id','matriculas_fic.equipe_id','matriculas_fic.numero','matriculas_fic.matriculado_em',
      'fic_encontros.turma_id','fic_encontros.professor_id','fic_encontros.data','fic_encontros.carga_horaria','fic_presencas.presente',
      'auditoria.tabela','auditoria.acao','auditoria.em','orientacoes_venda.uf','orientacoes_venda.ficha_id','vitrine_fotos.uf','vitrine_fotos.ficha_id','canais_venda.uf','canais_venda.municipio',
      'agua_situacoes.ficha_id','agua_situacoes.situacao','agua_situacoes.obs','convites.token','convites.papel','convites.expira_em','pre_cadastros.convite_id','pre_cadastros.situacao',
      'execucao_lancamentos.valor','execucao_lancamentos.data','documentos_projeto.titulo','documentos_projeto.arquivo_path','acesso_codigos.hash','acesso_codigos.expira_em']) e
     where not exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = split_part(e, '.', 1) and k.column_name = split_part(e, '.', 2) and k.is_nullable = 'NO')$q$);
select est_caso('padrões (DEFAULT): situação inicial, carimbo de hora e identificador gerado pelo banco',
  $q$select e.t || '.' || e.c from (values ('fichas', 'situacao', 'aguardando'), ('visitas', 'situacao', 'prevista'), ('diagnosticos', 'situacao', 'aguardando'), ('equipe', 'status', 'ativa'),
      ('solicitacoes_pagamento', 'situacao', 'solicitada'), ('pedidos_apoio', 'situacao', 'enviado'), ('pre_cadastros', 'situacao', 'aguardando'), ('pedidos_novo_acesso', 'situacao', 'aguardando'),
      ('fichas', 'criado_em', 'now()'), ('visitas', 'criado_em', 'now()'), ('diagnosticos', 'criado_em', 'now()'), ('avaliacoes', 'criado_em', 'now()'), ('equipe', 'criado_em', 'now()'),
      ('auditoria', 'em', 'now()'), ('acessos', 'em', 'now()'), ('solicitacoes_pagamento', 'solicitada_em', 'now()'), ('pedidos_apoio', 'criado_em', 'now()'), ('convites', 'criado_em', 'now()'),
      ('convites', 'expira_em', '7 days'), ('equipe', 'id', 'gen_random_uuid()'), ('convites', 'id', 'gen_random_uuid()'), ('turmas_fic', 'id', 'gen_random_uuid()'),
      ('solicitacoes_pagamento', 'id', 'gen_random_uuid()'), ('pedidos_apoio', 'id', 'gen_random_uuid()'), ('fichas', 'consent_imagem', 'false'), ('fichas', 'consent_criancas', 'false'),
      ('diagnosticos', 'dados', '{}'), ('diagnosticos', 'fotos', '{}'), ('equipe', 'cadastro_arlo', 'false')) e(t, c, def)
     where not exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = e.t and k.column_name = e.c and position(e.def in coalesce(k.column_default, '')) > 0)$q$);
select est_caso('os pontos da ficha são coluna calculada pelo banco (não dá para gravar um valor diferente das prioridades marcadas)',
  $q$select 'fichas.pontos' where not exists (select 1 from pg_attribute a where a.attrelid = 'public.fichas'::regclass and a.attname = 'pontos' and a.attgenerated = 's')$q$);

-- ===================================================================== 9. GATILHOS
select est_caso('nenhum gatilho desligado (a carga de teste desliga e precisa religar)',
  $q$select t.tgrelid::regclass || '.' || t.tgname from pg_trigger t where not t.tgisinternal and t.tgenabled <> 'O' and (t.tgrelid::regclass::text !~ '\.' or t.tgrelid::regclass::text like 'auth.%')$q$);
select est_caso('histórico (auditoria) ligado em todas as tabelas que guardam decisão ou dinheiro',
  $q$select e from unnest(array['equipe','equipe_privado','fichas','visitas','diagnosticos','avaliacoes','convites','pre_cadastros','solicitacoes_pagamento','solicitacao_visitas','custos_visita','parametros',
      'pedidos_apoio','documentos_projeto','execucao_lancamentos','execucao_planilhas','turmas_fic','matriculas_fic','fic_encontros','fic_presencas','agua_situacoes','canais_venda','orientacoes_venda',
      'entregas_mes','apl_municipios','vitrine_fotos','pedidos_novo_acesso']) e
     where not exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid where t.tgrelid = ('public.' || e)::regclass and not t.tgisinternal and p.proname like 'auditar%' and t.tgtype & 4 = 4)$q$);
select est_caso('gatilhos que são trava de regra continuam nas tabelas (os que não podem sumir se um script antigo for rodado de novo)',
  $q$select e from unnest(array['equipe.equipe_antes','equipe.equipe_c_regras','equipe.equipe_b_datas','equipe.equipe_login_fixo','equipe.equipe_matricula_so_professor','equipe.equipe_desligar_pendencias',
      'equipe.equipe_exige_professor','fichas.fichas_antes','fichas.fichas_b_conferir','fichas.fichas_c_regras','fichas.a1_versao','fichas.a0_trava_limite','fichas.fichas_vitrine_consentimento',
      'visitas.visitas_antes','visitas.visitas_feita','visitas.visitas_trava_pagamento','visitas.a0_trava_limite','diagnosticos.diagnosticos_antes','diagnosticos.diagnosticos_a0_fixos',
      'diagnosticos.diagnosticos_a1_versao','diagnosticos.diagnosticos_a2_limites','diagnosticos.diagnosticos_b_aprovacao','diagnosticos.diagnosticos_depois','avaliacoes.avaliacoes_antes',
      'avaliacoes.avaliacoes_a0_fixos','avaliacoes.avaliacoes_a2_limites','custos_visita.custos_visita_a0_travas','parametros.parametros_a0_validar','convites.convites_a0_travas',
      'pre_cadastros.pre_cadastros_antes','entregas_mes.entregas_antes','entregas_mes.entregas_a0_travas','solicitacoes_pagamento.solic_valor_aval','solicitacoes_pagamento.solic_professor_fic',
      'pedidos_apoio.pedidos_apoio_valor','documentos_projeto.documentos_antes','execucao_lancamentos.execucao_antes','execucao_planilhas.execucao_planilhas_antes','turmas_fic.turmas_fic_antes',
      'agua_situacoes.agua_situacoes_antes','orientacoes_venda.orientacoes_venda_antes','vitrine_fotos.vitrine_fotos_antes','testes_resultados.testes_antes','pedidos_novo_acesso.pedidos_novo_acesso_antes',
      -- 47: versão em qualquer alteração, chave que não muda, tamanho de texto, login de quem saiu, nascimento da equipe
      'visitas.a1_versao','avaliacoes.avaliacoes_a1_versao','fichas.a00_chave_fixa','visitas.a00_chave_fixa','diagnosticos.a00_chave_fixa','avaliacoes.a00_chave_fixa','equipe.a00_chave_fixa',
      'turmas_fic.a00_chave_fixa','parametros.a00_chave_fixa','fichas.a0_tamanho','visitas.a0_tamanho','diagnosticos.a0_tamanho','avaliacoes.a0_tamanho','equipe.a0_tamanho','pedidos_apoio.a0_tamanho',
      'solicitacoes_pagamento.a0_tamanho','pre_cadastros.a0_tamanho','equipe.equipe_z_solta_login','equipe_privado.equipe_privado_a0_regras']) e
     where not exists (select 1 from pg_trigger t where t.tgrelid = ('public.' || split_part(e, '.', 1))::regclass and t.tgname = split_part(e, '.', 2) and not t.tgisinternal)$q$);
select est_caso('o cadastro de login (auth.users) tem os três gatilhos: só quem está cadastrado, liga a conta, e-mail não troca',
  $q$select e from unnest(array['auth_so_cadastrados','auth_liga_cadastro','auth_sem_troca_email']) e where not exists (select 1 from pg_trigger t where t.tgrelid = 'auth.users'::regclass and t.tgname = e)$q$);
-- a ordem dos gatilhos BEFORE é alfabética: os que travam e conferem a versão vêm antes dos que carimbam
select est_caso('ordem dos gatilhos: em fichas e diagnósticos, a trava de limite e a conferência de versão rodam antes do gatilho principal',
  $q$select x from (values
      (case when 'a1_versao' < 'fichas_antes' and 'fichas_antes' < 'fichas_b_conferir' and 'fichas_b_conferir' < 'fichas_c_regras' then null else 'fichas' end),
      (case when 'diagnosticos_a0_fixos' < 'diagnosticos_a1_versao' and 'diagnosticos_a1_versao' < 'diagnosticos_a2_limites' and 'diagnosticos_a2_limites' < 'diagnosticos_antes' and 'diagnosticos_antes' < 'diagnosticos_b_aprovacao' then null else 'diagnosticos' end),
      (case when 'equipe_antes' < 'equipe_b_datas' and 'equipe_b_datas' < 'equipe_c_regras' then null else 'equipe' end),
      (case when 'a1_versao' < 'visitas_antes' and 'avaliacoes_a1_versao' < 'avaliacoes_antes' then null else 'visitas/avaliacoes' end)) v(x) where x is not null$q$);

-- ===================================================================== 10. ARQUIVOS (storage)
select est_lista('pastas de arquivos: sete, e só a vitrine é pública',
  $q$select id || case when public then ':publica' else '' end from storage.buckets$q$,
  array['campo','documentos','equipe','execucao','fichas','termos','vitrine:publica']);
select est_caso('pastas de documentos e de execução financeira: sem regra para trocar (UPDATE) nem apagar (DELETE) arquivo',
  $q$select policyname::text from pg_policies where schemaname = 'storage' and cmd in ('UPDATE', 'DELETE') and (coalesce(qual, '') ~ '''(documentos|execucao)''' and coalesce(qual, '') !~ 'ANY')$q$);

-- ===================================================================== 11. GARANTIAS QUE PASSARAM A VALER COM O 47_auditoria_bd.sql
-- (eram os itens P2, P3, P5, P7 e P10 da seção PENDENTES)
-- P2. "as do sistema" = as que têm permissão própria ou rodam com o direito do banco (as funções de apoio dos testes, criadas
--     na sessão da suíte, ficam com a permissão padrão do Postgres e não entram na conta)
select est_lista('funções que o ANÔNIMO executa (todas as do sistema, não só as security definer): só as cinco públicas',
  $q$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype and (p.proacl is not null or p.prosecdef)
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') and has_function_privilege('anon', p.oid, 'EXECUTE')$q$,
  array['enviar_pre_cadastro','pedir_novo_acesso','ver_convite','vitrine','vitrine_municipios']);
select est_caso('nenhuma função do sistema ficou com a permissão padrão do Postgres (aberta a todos): toda função de gatilho e toda função com o direito do banco tem permissão própria',
  $q$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.prosecdef or p.prorettype = 'trigger'::regtype) and p.proacl is null
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')$q$);
select est_caso('toda função security definer fixa search_path = public, pg_temp',
  $q$select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x = 'search_path=public, pg_temp')$q$);
select est_caso('toda coluna uf tem CHECK com os cinco estados',
  $q$select c.table_name::text from information_schema.columns c where c.table_schema = 'public' and c.column_name = 'uf'
      and not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || c.table_name)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ '\muf\M.*AL.*BA.*PE.*PI.*SE')$q$);
select est_caso('toda coluna de texto livre das tabelas principais tem limite de tamanho no banco',
  $q$select c.table_name || '.' || c.column_name from information_schema.columns c where c.table_schema = 'public' and c.data_type = 'text'
      and c.table_name in ('fichas','visitas','diagnosticos','avaliacoes','equipe','turmas_fic','pedidos_apoio','solicitacoes_pagamento','pre_cadastros','equipe_bancario','matriculas_fic','fic_encontros')
      and c.column_name !~ '(_path|^situacao|^resultado|^etapa|^papel|^status|^tipo|^assinatura|^agua_seca|^modalidade|^token|^hash)$'
      and not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || c.table_name)::regclass and k.contype = 'c'
                       and pg_get_constraintdef(k.oid) ~ ('\m' || c.column_name || '\M') and pg_get_constraintdef(k.oid) ~ '(<=|~ ''\^)')$q$);
select est_caso('os JSON das tabelas principais têm tamanho máximo no banco, e o kit, a família e as passageiras, número máximo de itens',
  $q$select e from unnest(array['diagnosticos.tam_dados_100000','avaliacoes.tam_dados_100000','pedidos_apoio.tam_dados_100000','solicitacoes_pagamento.tam_detalhe_500000','orientacoes_venda.tam_dados_8000',
      'equipe_privado.tam_endereco_4000','equipe_privado.tam_socioeconomico_8000','equipe_privado.tam_perfil_8000','pre_cadastros.tam_endereco_4000','pre_cadastros.tam_perfil_8000','parametros.tam_valor_20000',
      'diagnosticos.lista_kit_60','diagnosticos.lista_familia_30','pedidos_apoio.lista_passageiros_60']) e
     where not exists (select 1 from pg_constraint k where k.contype = 'c' and k.conrelid = ('public.' || split_part(e, '.', 1))::regclass and k.conname = split_part(e, '.', 2))$q$);
select est_caso('colunas de vínculo usadas em filtro ou regra de acesso têm índice',
  $q$select e from unnest(array['visitas.executor_id','visitas.ficha_id','fichas.bolsista_id','diagnosticos.executor_id','avaliacoes.ficha_id','solicitacao_visitas.solicitacao_id','matriculas_fic.turma_id',
      'fic_encontros.turma_id','fic_presencas.equipe_id','pedidos_apoio.solicitante_id','vitrine_fotos.ficha_id','auditoria.registro_id']) e
     where not exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
                        where i.indrelid = ('public.' || split_part(e, '.', 1))::regclass and a.attname = split_part(e, '.', 2))$q$);
select est_caso('um CPF só aguardando conferência nos cadastros enviados pelo link (índice único parcial)',
  $q$select 'pre_cadastros_cpf_aguardando' where not exists (select 1 from pg_index i where i.indexrelid = to_regclass('public.pre_cadastros_cpf_aguardando') and i.indisunique and i.indisvalid and i.indpred is not null)$q$);
select est_caso('nenhuma regra de acesso chama meu_papel(), meu_id() ou minha_uf() uma vez por linha (sempre "(select ...)")',
  $q$select tablename || '.' || policyname from pg_policies where schemaname = 'public'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(?<!public\.)\m(meu_papel|meu_id|minha_uf|quem_confere_pedidos)\(\)'$q$);
select est_caso('o que o dono do banco criar daqui para a frente não nasce aberto para anon nem authenticated (default privileges do schema public)',
  $q$select d.defaclrole::regrole::text || ':' || d.defaclobjtype::text || ':' || d.defaclacl::text from pg_default_acl d where d.defaclnamespace = 'public'::regnamespace
      and exists (select 1 from aclexplode(d.defaclacl) a join pg_roles r on r.oid = a.grantee where r.rolname in ('anon', 'authenticated'))$q$);


-- ===================================================================== resultado
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 300) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
drop function est_caso(text, text), est_lista(text, text, text[]);

-- =====================================================================
-- PENDENTES: garantias que HOJE NÃO VALEM (auditoria de 02/10/2026). Cada caso está pronto: tire o comentário
-- quando a correção indicada entrar (e mova o caso para a seção de cima, antes do "resultado").
-- RESOLVIDOS pelo 47_auditoria_bd.sql (casos ativos na seção 11, acima): P1, P2, P3, P5, P7, P9 e P10.
-- =====================================================================
-- P1. RESOLVIDO no 47: privilégios no Supabase real (revoke em tabelas, numerações e funções; o que for criado depois já nasce fechado). Os casos da seção 3 passam nos dois bancos.
--
-- P2. RESOLVIDO no 47: as funções de apoio (brl, codigo_hash, fic_hoje...) não são mais executáveis por quem não entrou.
--
-- P3. RESOLVIDO no 47: search_path = public, pg_temp em todas as funções security definer.
--
-- P4. VÍNCULOS QUE FALTAM. Três colunas guardam o id de uma pessoa sem FK: acesso_codigos.criado_por,
--     entregas_mes.marcado_por e auditoria.por (esta de propósito: o histórico não pode impedir nada).
--     Correção: alter table public.acesso_codigos add foreign key (criado_por) references public.equipe(id);
--               alter table public.entregas_mes   add foreign key (marcado_por) references public.equipe(id);
-- select est_caso('toda coluna *_id / *_por (uuid) tem vínculo declarado, fora o histórico',
--   $q$select c.table_name || '.' || c.column_name from information_schema.columns c where c.table_schema = 'public' and c.data_type = 'uuid' and c.column_name ~ '(_id|_por|_de)$'
--       and c.table_name not in ('auditoria', 'exemplo', 'res')
--       and not exists (select 1 from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
--                        where k.contype = 'f' and k.conrelid = ('public.' || c.table_name)::regclass and a.attname = c.column_name)$q$);
--
-- P5. RESOLVIDO no 47: CHECK de UF (NOT VALID) em visitas, diagnosticos, avaliacoes, orientacoes_venda, vitrine_fotos e pre_cadastros.
--
-- P6. REGRAS DE "NÃO REPETIR" SEM ÍNDICE ÚNICO (só a função ou o gatilho conferem, com trava de aviso; por SQL direto repete):
--     número de matrícula ativa, posição na lista de espera por estado, canal de venda igual, encontro do FIC
--     (turma, dia, modalidade), turma repetida. Criar o índice exige antes limpar o que já estiver repetido
--     (o 90_auditoria_dados.sql mostra: B13, B16, B17, B18, B19).
-- select est_caso('índices únicos das regras de "não repetir"',
--   $q$select e from unnest(array['matriculas_fic_numero_ativo','fichas_espera_unica','canais_venda_unico','fic_encontros_unico']) e where to_regclass('public.' || e) is null$q$);
--
-- P7. RESOLVIDO no 47: CHECK de tamanho (NOT VALID) nas colunas de texto e nos JSON, e gatilho com a mensagem que diz o campo.
--
-- P8. NÚMERO SEM ESCALA. Renda da família, vendas do quintal, área e km estão em numeric sem casas definidas
--     (aceitam 30 casas decimais). Correção: alter column ... type numeric(12,2) (renda), numeric(9,2) (área), numeric(6,1) (km).
-- select est_caso('renda, área e km com casas decimais definidas',
--   $q$select table_name || '.' || column_name from information_schema.columns where table_schema = 'public' and data_type = 'numeric' and numeric_scale is null$q$);
--
-- P9. RESOLVIDO no 47: gatilho a00_chave_fixa em fichas, visitas, diagnosticos, avaliacoes, equipe, turmas_fic e parametros (comportamento testado em test_auditoria_bd.sql).
--
-- P10. RESOLVIDO no 47: índices nas colunas de vínculo consultadas (as 10 da lista, mais visitas.ficha_id e auditoria.registro_id). As demais FKs ("quem fez", *_por) continuam sem índice de propósito.
--
-- P11. FUNÇÃO DE GATILHO SEM GATILHO: checar_meta_estado() ficou sem uso (a soma das metas do estado não é mais conferida).
--      Correção: drop function public.checar_meta_estado();  (ou religar, se a regra ainda vale)
-- select est_caso('nenhuma função de gatilho sem gatilho',
--   $q$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype and not exists (select 1 from pg_trigger t where t.tgfoid = p.oid)$q$);
--
-- P12. JSON SEM FORMATO CONFERIDO na coluna (só a função ou o gatilho conferem parte): diagnosticos.dados, avaliacoes.dados,
--      pedidos_apoio.dados, solicitacoes_pagamento.detalhe, equipe_privado.endereco/socioeconomico/perfil, pre_cadastros.*,
--      orientacoes_venda.dados, parametros.valor (só a chave custo_visita é conferida; qualquer outra chave entra com qualquer conteúdo).
-- select est_caso('toda coluna jsonb das tabelas principais tem CHECK de tipo (objeto ou lista)',
--   $q$select c.table_name || '.' || c.column_name from information_schema.columns c where c.table_schema = 'public' and c.data_type = 'jsonb' and c.table_name not in ('auditoria', 'res')
--       and not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || c.table_name)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ ('jsonb_typeof\(' || c.column_name))$q$);
