-- =====================================================================
-- Mulheres & Quintais — 90: AUDITORIA DA QUALIDADE DOS DADOS (só lê, não muda nada)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
--
-- É UM comando só, feito apenas de SELECT: não cria tabela, função nem coisa alguma, não altera e não apaga
-- nenhum registro. Pode rodar quantas vezes quiser, a qualquer hora. Precisa dos scripts 01 a 46 instalados.
--
-- Devolve UMA tabela com uma linha por verificação:
--   verificacao  o que foi conferido (a letra do código diz o grupo)
--   quantidade   quantos casos foram encontrados
--   status       ok (nenhum caso) ou ATENÇÃO (há casos para olhar)
--   como_ver     o SELECT para colar numa nova consulta e ver os casos (esse SELECT mostra dados pessoais:
--                rode só quem pode vê-los; a tabela desta auditoria traz apenas contagens)
--
-- Grupos:  A órfãos (registro que aponta para outro que não existe; arquivo citado que não está na pasta)
--          B duplicidades             C campo obrigatório vazio        D negativos e fora de limite
--          E datas inválidas ou fora de ordem                          F incoerência entre campos do mesmo registro
--          G incoerência entre tabelas e tetos do projeto              H formatos (CPF, celular, e-mail, município, UF)
--          I pessoas e logins
--
-- "ATENÇÃO" não quer dizer erro do sistema: registro antigo, gravado antes de uma regra existir, aparece aqui
-- para a coordenação decidir. Várias verificações repetem o que o banco já impede (devem dar sempre 0):
-- servem para avisar se alguma regra for desligada ou se um script antigo for rodado fora de ordem.
-- (arquivo gerado a partir de uma lista de verificações; o mesmo SELECT conta e aparece em como_ver)
-- =====================================================================
with c (codigo, verificacao, quantidade, como_ver) as (
  select 'A01', 'órfãos em acesso_codigos (equipe_id)',
    (select count(*) from (select x.* from public.acesso_codigos x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.acesso_codigos x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A02', 'órfãos em acessos (equipe_id)',
    (select count(*) from (select x.* from public.acessos x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.acessos x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A03', 'órfãos em agua_situacoes (ficha_id, registrado_por)',
    (select count(*) from (select x.* from public.agua_situacoes x where (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.registrado_por is not null and not exists (select 1 from public.equipe y where y.id = x.registrado_por))) q),
    $q$select x.* from public.agua_situacoes x where (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.registrado_por is not null and not exists (select 1 from public.equipe y where y.id = x.registrado_por));$q$
  union all
  select 'A04', 'órfãos em apl_municipios (atualizado_por)',
    (select count(*) from (select x.* from public.apl_municipios x where (x.atualizado_por is not null and not exists (select 1 from public.equipe y where y.id = x.atualizado_por))) q),
    $q$select x.* from public.apl_municipios x where (x.atualizado_por is not null and not exists (select 1 from public.equipe y where y.id = x.atualizado_por));$q$
  union all
  select 'A05', 'órfãos em avaliacoes (executor_id, ficha_id, visita_id)',
    (select count(*) from (select x.* from public.avaliacoes x where (x.executor_id is not null and not exists (select 1 from public.equipe y where y.id = x.executor_id)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id))) q),
    $q$select x.* from public.avaliacoes x where (x.executor_id is not null and not exists (select 1 from public.equipe y where y.id = x.executor_id)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id));$q$
  union all
  select 'A06', 'órfãos em canais_venda (atualizado_por, criado_por)',
    (select count(*) from (select x.* from public.canais_venda x where (x.atualizado_por is not null and not exists (select 1 from public.equipe y where y.id = x.atualizado_por)) or (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por))) q),
    $q$select x.* from public.canais_venda x where (x.atualizado_por is not null and not exists (select 1 from public.equipe y where y.id = x.atualizado_por)) or (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por));$q$
  union all
  select 'A07', 'órfãos em ciencias (equipe_id)',
    (select count(*) from (select x.* from public.ciencias x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.ciencias x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A08', 'órfãos em contas_ja_ligadas (equipe_id)',
    (select count(*) from (select x.* from public.contas_ja_ligadas x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.contas_ja_ligadas x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A09', 'órfãos em convites (criado_por, substitui_id)',
    (select count(*) from (select x.* from public.convites x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.substitui_id is not null and not exists (select 1 from public.equipe y where y.id = x.substitui_id))) q),
    $q$select x.* from public.convites x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.substitui_id is not null and not exists (select 1 from public.equipe y where y.id = x.substitui_id));$q$
  union all
  select 'A10', 'órfãos em custos_visita (definido_por, visita_id)',
    (select count(*) from (select x.* from public.custos_visita x where (x.definido_por is not null and not exists (select 1 from public.equipe y where y.id = x.definido_por)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id))) q),
    $q$select x.* from public.custos_visita x where (x.definido_por is not null and not exists (select 1 from public.equipe y where y.id = x.definido_por)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id));$q$
  union all
  select 'A11', 'órfãos em diagnosticos (aprovado_por, conteudo_alterado_por, executor_id, ficha_id, visita_id)',
    (select count(*) from (select x.* from public.diagnosticos x where (x.aprovado_por is not null and not exists (select 1 from public.equipe y where y.id = x.aprovado_por)) or (x.conteudo_alterado_por is not null and not exists (select 1 from public.equipe y where y.id = x.conteudo_alterado_por)) or (x.executor_id is not null and not exists (select 1 from public.equipe y where y.id = x.executor_id)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id))) q),
    $q$select x.* from public.diagnosticos x where (x.aprovado_por is not null and not exists (select 1 from public.equipe y where y.id = x.aprovado_por)) or (x.conteudo_alterado_por is not null and not exists (select 1 from public.equipe y where y.id = x.conteudo_alterado_por)) or (x.executor_id is not null and not exists (select 1 from public.equipe y where y.id = x.executor_id)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id));$q$
  union all
  select 'A12', 'órfãos em documentos_projeto (arquivado_por, enviado_por)',
    (select count(*) from (select x.* from public.documentos_projeto x where (x.arquivado_por is not null and not exists (select 1 from public.equipe y where y.id = x.arquivado_por)) or (x.enviado_por is not null and not exists (select 1 from public.equipe y where y.id = x.enviado_por))) q),
    $q$select x.* from public.documentos_projeto x where (x.arquivado_por is not null and not exists (select 1 from public.equipe y where y.id = x.arquivado_por)) or (x.enviado_por is not null and not exists (select 1 from public.equipe y where y.id = x.enviado_por));$q$
  union all
  select 'A13', 'órfãos em entregas_mes (equipe_id)',
    (select count(*) from (select x.* from public.entregas_mes x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.entregas_mes x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A14', 'órfãos em equipe (criado_por, substitui_id, user_id)',
    (select count(*) from (select x.* from public.equipe x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.substitui_id is not null and not exists (select 1 from public.equipe y where y.id = x.substitui_id)) or (x.user_id is not null and not exists (select 1 from auth.users y where y.id = x.user_id))) q),
    $q$select x.* from public.equipe x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.substitui_id is not null and not exists (select 1 from public.equipe y where y.id = x.substitui_id)) or (x.user_id is not null and not exists (select 1 from auth.users y where y.id = x.user_id));$q$
  union all
  select 'A15', 'órfãos em equipe_bancario (equipe_id)',
    (select count(*) from (select x.* from public.equipe_bancario x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.equipe_bancario x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A16', 'órfãos em equipe_privado (equipe_id)',
    (select count(*) from (select x.* from public.equipe_privado x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.equipe_privado x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A17', 'órfãos em execucao_lancamentos (criado_por, estorno_de)',
    (select count(*) from (select x.* from public.execucao_lancamentos x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.estorno_de is not null and not exists (select 1 from public.execucao_lancamentos y where y.id = x.estorno_de))) q),
    $q$select x.* from public.execucao_lancamentos x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.estorno_de is not null and not exists (select 1 from public.execucao_lancamentos y where y.id = x.estorno_de));$q$
  union all
  select 'A18', 'órfãos em execucao_planilhas (enviado_por)',
    (select count(*) from (select x.* from public.execucao_planilhas x where (x.enviado_por is not null and not exists (select 1 from public.equipe y where y.id = x.enviado_por))) q),
    $q$select x.* from public.execucao_planilhas x where (x.enviado_por is not null and not exists (select 1 from public.equipe y where y.id = x.enviado_por));$q$
  union all
  select 'A19', 'órfãos em fic_encontros (cancelado_por, professor_id, turma_id)',
    (select count(*) from (select x.* from public.fic_encontros x where (x.cancelado_por is not null and not exists (select 1 from public.equipe y where y.id = x.cancelado_por)) or (x.professor_id is not null and not exists (select 1 from public.equipe y where y.id = x.professor_id)) or (x.turma_id is not null and not exists (select 1 from public.turmas_fic y where y.id = x.turma_id))) q),
    $q$select x.* from public.fic_encontros x where (x.cancelado_por is not null and not exists (select 1 from public.equipe y where y.id = x.cancelado_por)) or (x.professor_id is not null and not exists (select 1 from public.equipe y where y.id = x.professor_id)) or (x.turma_id is not null and not exists (select 1 from public.turmas_fic y where y.id = x.turma_id));$q$
  union all
  select 'A20', 'órfãos em fic_presencas (encontro_id, equipe_id, marcado_por)',
    (select count(*) from (select x.* from public.fic_presencas x where (x.encontro_id is not null and not exists (select 1 from public.fic_encontros y where y.id = x.encontro_id)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.marcado_por is not null and not exists (select 1 from public.equipe y where y.id = x.marcado_por))) q),
    $q$select x.* from public.fic_presencas x where (x.encontro_id is not null and not exists (select 1 from public.fic_encontros y where y.id = x.encontro_id)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.marcado_por is not null and not exists (select 1 from public.equipe y where y.id = x.marcado_por));$q$
  union all
  select 'A21', 'órfãos em fichas (aprovada_por, bolsista_id)',
    (select count(*) from (select x.* from public.fichas x where (x.aprovada_por is not null and not exists (select 1 from public.equipe y where y.id = x.aprovada_por)) or (x.bolsista_id is not null and not exists (select 1 from public.equipe y where y.id = x.bolsista_id))) q),
    $q$select x.* from public.fichas x where (x.aprovada_por is not null and not exists (select 1 from public.equipe y where y.id = x.aprovada_por)) or (x.bolsista_id is not null and not exists (select 1 from public.equipe y where y.id = x.bolsista_id));$q$
  union all
  select 'A22', 'órfãos em ia_usos (equipe_id)',
    (select count(*) from (select x.* from public.ia_usos x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.ia_usos x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A23', 'órfãos em matriculas_fic (criado_por, equipe_id, turma_id)',
    (select count(*) from (select x.* from public.matriculas_fic x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.turma_id is not null and not exists (select 1 from public.turmas_fic y where y.id = x.turma_id))) q),
    $q$select x.* from public.matriculas_fic x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.turma_id is not null and not exists (select 1 from public.turmas_fic y where y.id = x.turma_id));$q$
  union all
  select 'A24', 'órfãos em orientacoes_venda (feito_por, ficha_id)',
    (select count(*) from (select x.* from public.orientacoes_venda x where (x.feito_por is not null and not exists (select 1 from public.equipe y where y.id = x.feito_por)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id))) q),
    $q$select x.* from public.orientacoes_venda x where (x.feito_por is not null and not exists (select 1 from public.equipe y where y.id = x.feito_por)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id));$q$
  union all
  select 'A25', 'órfãos em parametros (atualizado_por)',
    (select count(*) from (select x.* from public.parametros x where (x.atualizado_por is not null and not exists (select 1 from public.equipe y where y.id = x.atualizado_por))) q),
    $q$select x.* from public.parametros x where (x.atualizado_por is not null and not exists (select 1 from public.equipe y where y.id = x.atualizado_por));$q$
  union all
  select 'A26', 'órfãos em pedidos_apoio (conferido_por, decidido_por, solicitante_id)',
    (select count(*) from (select x.* from public.pedidos_apoio x where (x.conferido_por is not null and not exists (select 1 from public.equipe y where y.id = x.conferido_por)) or (x.decidido_por is not null and not exists (select 1 from public.equipe y where y.id = x.decidido_por)) or (x.solicitante_id is not null and not exists (select 1 from public.equipe y where y.id = x.solicitante_id))) q),
    $q$select x.* from public.pedidos_apoio x where (x.conferido_por is not null and not exists (select 1 from public.equipe y where y.id = x.conferido_por)) or (x.decidido_por is not null and not exists (select 1 from public.equipe y where y.id = x.decidido_por)) or (x.solicitante_id is not null and not exists (select 1 from public.equipe y where y.id = x.solicitante_id));$q$
  union all
  select 'A27', 'órfãos em pedidos_novo_acesso (equipe_id, resolvido_por)',
    (select count(*) from (select x.* from public.pedidos_novo_acesso x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.resolvido_por is not null and not exists (select 1 from public.equipe y where y.id = x.resolvido_por))) q),
    $q$select x.* from public.pedidos_novo_acesso x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.resolvido_por is not null and not exists (select 1 from public.equipe y where y.id = x.resolvido_por));$q$
  union all
  select 'A28', 'órfãos em pre_cadastros (convite_id, decidido_por, equipe_id, substitui_id)',
    (select count(*) from (select x.* from public.pre_cadastros x where (x.convite_id is not null and not exists (select 1 from public.convites y where y.id = x.convite_id)) or (x.decidido_por is not null and not exists (select 1 from public.equipe y where y.id = x.decidido_por)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.substitui_id is not null and not exists (select 1 from public.equipe y where y.id = x.substitui_id))) q),
    $q$select x.* from public.pre_cadastros x where (x.convite_id is not null and not exists (select 1 from public.convites y where y.id = x.convite_id)) or (x.decidido_por is not null and not exists (select 1 from public.equipe y where y.id = x.decidido_por)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id)) or (x.substitui_id is not null and not exists (select 1 from public.equipe y where y.id = x.substitui_id));$q$
  union all
  select 'A29', 'órfãos em solicitacao_visitas (solicitacao_id, visita_id)',
    (select count(*) from (select x.* from public.solicitacao_visitas x where (x.solicitacao_id is not null and not exists (select 1 from public.solicitacoes_pagamento y where y.id = x.solicitacao_id)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id))) q),
    $q$select x.* from public.solicitacao_visitas x where (x.solicitacao_id is not null and not exists (select 1 from public.solicitacoes_pagamento y where y.id = x.solicitacao_id)) or (x.visita_id is not null and not exists (select 1 from public.visitas y where y.id = x.visita_id));$q$
  union all
  select 'A30', 'órfãos em solicitacoes_pagamento (arlo_por, aval_por, equipe_id)',
    (select count(*) from (select x.* from public.solicitacoes_pagamento x where (x.arlo_por is not null and not exists (select 1 from public.equipe y where y.id = x.arlo_por)) or (x.aval_por is not null and not exists (select 1 from public.equipe y where y.id = x.aval_por)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.solicitacoes_pagamento x where (x.arlo_por is not null and not exists (select 1 from public.equipe y where y.id = x.arlo_por)) or (x.aval_por is not null and not exists (select 1 from public.equipe y where y.id = x.aval_por)) or (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A31', 'órfãos em testes_resultados (equipe_id)',
    (select count(*) from (select x.* from public.testes_resultados x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id))) q),
    $q$select x.* from public.testes_resultados x where (x.equipe_id is not null and not exists (select 1 from public.equipe y where y.id = x.equipe_id));$q$
  union all
  select 'A32', 'órfãos em turmas_fic (criado_por, professor_id)',
    (select count(*) from (select x.* from public.turmas_fic x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.professor_id is not null and not exists (select 1 from public.equipe y where y.id = x.professor_id))) q),
    $q$select x.* from public.turmas_fic x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.professor_id is not null and not exists (select 1 from public.equipe y where y.id = x.professor_id));$q$
  union all
  select 'A33', 'órfãos em visitas (criado_por, executor_id, ficha_id)',
    (select count(*) from (select x.* from public.visitas x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.executor_id is not null and not exists (select 1 from public.equipe y where y.id = x.executor_id)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id))) q),
    $q$select x.* from public.visitas x where (x.criado_por is not null and not exists (select 1 from public.equipe y where y.id = x.criado_por)) or (x.executor_id is not null and not exists (select 1 from public.equipe y where y.id = x.executor_id)) or (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id));$q$
  union all
  select 'A34', 'órfãos em vitrine_fotos (ficha_id, publicada_por)',
    (select count(*) from (select x.* from public.vitrine_fotos x where (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.publicada_por is not null and not exists (select 1 from public.equipe y where y.id = x.publicada_por))) q),
    $q$select x.* from public.vitrine_fotos x where (x.ficha_id is not null and not exists (select 1 from public.fichas y where y.id = x.ficha_id)) or (x.publicada_por is not null and not exists (select 1 from public.equipe y where y.id = x.publicada_por));$q$
  union all
  select 'A35', 'órfãos (sem vínculo declarado): código de acesso gerado por pessoa que não existe',
    (select count(*) from (select x.equipe_id, x.criado_por from public.acesso_codigos x where x.criado_por is not null and not exists (select 1 from public.equipe e where e.id = x.criado_por)) q),
    $q$select x.equipe_id, x.criado_por from public.acesso_codigos x where x.criado_por is not null and not exists (select 1 from public.equipe e where e.id = x.criado_por);$q$
  union all
  select 'A36', 'órfãos (sem vínculo declarado): entrega do mês marcada por pessoa que não existe',
    (select count(*) from (select x.* from public.entregas_mes x where x.marcado_por is not null and not exists (select 1 from public.equipe e where e.id = x.marcado_por)) q),
    $q$select x.* from public.entregas_mes x where x.marcado_por is not null and not exists (select 1 from public.equipe e where e.id = x.marcado_por);$q$
  union all
  select 'A37', 'órfãos (sem vínculo declarado): histórico feito por pessoa que não existe',
    (select count(*) from (select x.id, x.tabela, x.acao, x.por, x.em from public.auditoria x where x.por is not null and not exists (select 1 from public.equipe e where e.id = x.por)) q),
    $q$select x.id, x.tabela, x.acao, x.por, x.em from public.auditoria x where x.por is not null and not exists (select 1 from public.equipe e where e.id = x.por);$q$
  union all
  select 'A38', 'órfãos: histórico de registro que não existe mais (equipe, fichas, visitas, diagnósticos, avaliações)',
    (select count(*) from (select x.id, x.tabela, x.registro_id, x.acao, x.em from public.auditoria x where x.registro_id is not null and x.acao <> 'DELETE' and ((x.tabela = 'equipe' and not exists (select 1 from public.equipe y where y.id = x.registro_id)) or (x.tabela = 'fichas' and not exists (select 1 from public.fichas y where y.id = x.registro_id)) or (x.tabela = 'visitas' and not exists (select 1 from public.visitas y where y.id = x.registro_id)) or (x.tabela = 'diagnosticos' and not exists (select 1 from public.diagnosticos y where y.id = x.registro_id)) or (x.tabela = 'avaliacoes' and not exists (select 1 from public.avaliacoes y where y.id = x.registro_id)))) q),
    $q$select x.id, x.tabela, x.registro_id, x.acao, x.em from public.auditoria x where x.registro_id is not null and x.acao <> 'DELETE' and ((x.tabela = 'equipe' and not exists (select 1 from public.equipe y where y.id = x.registro_id)) or (x.tabela = 'fichas' and not exists (select 1 from public.fichas y where y.id = x.registro_id)) or (x.tabela = 'visitas' and not exists (select 1 from public.visitas y where y.id = x.registro_id)) or (x.tabela = 'diagnosticos' and not exists (select 1 from public.diagnosticos y where y.id = x.registro_id)) or (x.tabela = 'avaliacoes' and not exists (select 1 from public.avaliacoes y where y.id = x.registro_id)));$q$
  union all
  select 'A39', 'órfãos: marca de ''dado de exemplo'' para registro que não existe',
    (select count(*) from (select x.* from public.exemplo x where (x.tabela = 'equipe' and not exists (select 1 from public.equipe y where y.id = x.id)) or (x.tabela = 'fichas' and not exists (select 1 from public.fichas y where y.id = x.id)) or (x.tabela = 'visitas' and not exists (select 1 from public.visitas y where y.id = x.id)) or (x.tabela = 'diagnosticos' and not exists (select 1 from public.diagnosticos y where y.id = x.id))) q),
    $q$select x.* from public.exemplo x where (x.tabela = 'equipe' and not exists (select 1 from public.equipe y where y.id = x.id)) or (x.tabela = 'fichas' and not exists (select 1 from public.fichas y where y.id = x.id)) or (x.tabela = 'visitas' and not exists (select 1 from public.visitas y where y.id = x.id)) or (x.tabela = 'diagnosticos' and not exists (select 1 from public.diagnosticos y where y.id = x.id));$q$
  union all
  select 'A40', 'órfãos (dentro do JSON): visita citada no detalhe do pedido de pagamento que não existe',
    (select count(*) from (select s.id, s.equipe_id, s.mes, i ->> 'id' as visita_citada from public.solicitacoes_pagamento s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.detalhe -> 'visitas') = 'array' then s.detalhe -> 'visitas' else '[]'::jsonb end) i where i ->> 'id' is not null and not exists (select 1 from public.visitas v where v.id::text = i ->> 'id')) q),
    $q$select s.id, s.equipe_id, s.mes, i ->> 'id' as visita_citada from public.solicitacoes_pagamento s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.detalhe -> 'visitas') = 'array' then s.detalhe -> 'visitas' else '[]'::jsonb end) i where i ->> 'id' is not null and not exists (select 1 from public.visitas v where v.id::text = i ->> 'id');$q$
  union all
  select 'A41', 'órfãos (dentro do JSON): visita citada no detalhe do pedido (não devolvido) que não está vinculada a ele',
    (select count(*) from (select s.id, s.equipe_id, s.mes, s.situacao, i ->> 'id' as visita_citada from public.solicitacoes_pagamento s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.detalhe -> 'visitas') = 'array' then s.detalhe -> 'visitas' else '[]'::jsonb end) i where s.situacao <> 'devolvida' and i ->> 'id' is not null and not exists (select 1 from public.solicitacao_visitas sv where sv.solicitacao_id = s.id and sv.visita_id::text = i ->> 'id')) q),
    $q$select s.id, s.equipe_id, s.mes, s.situacao, i ->> 'id' as visita_citada from public.solicitacoes_pagamento s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.detalhe -> 'visitas') = 'array' then s.detalhe -> 'visitas' else '[]'::jsonb end) i where s.situacao <> 'devolvida' and i ->> 'id' is not null and not exists (select 1 from public.solicitacao_visitas sv where sv.solicitacao_id = s.id and sv.visita_id::text = i ->> 'id');$q$
  union all
  select 'A42', 'órfãos (arquivo): foto da ficha ou do termo que não está na pasta ''fichas''',
    (select count(*) from (select f.id, f.uf, p.caminho from public.fichas f cross join lateral (values (f.foto_ficha_path), (f.foto_termo_path)) p(caminho) where p.caminho is not null and p.caminho not like 'exemplo%' and not exists (select 1 from storage.objects o where o.bucket_id = 'fichas' and o.name = p.caminho)) q),
    $q$select f.id, f.uf, p.caminho from public.fichas f cross join lateral (values (f.foto_ficha_path), (f.foto_termo_path)) p(caminho) where p.caminho is not null and p.caminho not like 'exemplo%' and not exists (select 1 from storage.objects o where o.bucket_id = 'fichas' and o.name = p.caminho);$q$
  union all
  select 'A43', 'órfãos (arquivo): foto de diagnóstico, visita ou avaliação que não está na pasta ''campo''',
    (select count(*) from (select x.tabela, x.id, p.caminho from (select 'diagnosticos' tabela, id, fotos from public.diagnosticos union all select 'visitas', id, fotos from public.visitas union all select 'avaliacoes', id, fotos from public.avaliacoes) x cross join lateral unnest(x.fotos) p(caminho) where p.caminho not like 'exemplo%' and not exists (select 1 from storage.objects o where o.bucket_id = 'campo' and o.name = p.caminho)) q),
    $q$select x.tabela, x.id, p.caminho from (select 'diagnosticos' tabela, id, fotos from public.diagnosticos union all select 'visitas', id, fotos from public.visitas union all select 'avaliacoes', id, fotos from public.avaliacoes) x cross join lateral unnest(x.fotos) p(caminho) where p.caminho not like 'exemplo%' and not exists (select 1 from storage.objects o where o.bucket_id = 'campo' and o.name = p.caminho);$q$
  union all
  select 'A44', 'órfãos (arquivo): foto da vitrine, foto da equipe, termo, documento ou planilha que não está na sua pasta',
    (select count(*) from (select x.pasta, x.id, x.caminho from (select 'vitrine' pasta, id::text id, path caminho from public.vitrine_fotos union all select 'equipe', id::text, foto_path from public.equipe where foto_path is not null and foto_path not like 'exemplo%' union all select 'termos', id::text, termo_path from public.equipe where termo_path is not null and termo_path not like 'exemplo%' union all select 'documentos', id::text, arquivo_path from public.documentos_projeto union all select 'execucao', id::text, arquivo_path from public.execucao_planilhas) x where not exists (select 1 from storage.objects o where o.bucket_id = x.pasta and o.name = x.caminho)) q),
    $q$select x.pasta, x.id, x.caminho from (select 'vitrine' pasta, id::text id, path caminho from public.vitrine_fotos union all select 'equipe', id::text, foto_path from public.equipe where foto_path is not null and foto_path not like 'exemplo%' union all select 'termos', id::text, termo_path from public.equipe where termo_path is not null and termo_path not like 'exemplo%' union all select 'documentos', id::text, arquivo_path from public.documentos_projeto union all select 'execucao', id::text, arquivo_path from public.execucao_planilhas) x where not exists (select 1 from storage.objects o where o.bucket_id = x.pasta and o.name = x.caminho);$q$
  union all
  select 'B01', 'duplicidade: CPF repetido em fichas (só os números)',
    (select count(*) from (select regexp_replace(cpf, '\D', '', 'g') cpf, count(*) fichas, string_agg(uf, ',') ufs from public.fichas group by 1 having count(*) > 1) q),
    $q$select regexp_replace(cpf, '\D', '', 'g') cpf, count(*) fichas, string_agg(uf, ',') ufs from public.fichas group by 1 having count(*) > 1;$q$
  union all
  select 'B02', 'duplicidade: mesma mulher (nome sem acento + nascimento) em mais de uma ficha, com CPFs diferentes',
    (select count(*) from (select regexp_replace(trim(translate(lower(coalesce(nome, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') nome, data_nascimento, count(*) fichas, string_agg(uf, ',') ufs from public.fichas group by 1, 2 having count(*) > 1) q),
    $q$select regexp_replace(trim(translate(lower(coalesce(nome, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') nome, data_nascimento, count(*) fichas, string_agg(uf, ',') ufs from public.fichas group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B03', 'duplicidade: CPF repetido entre pessoas ATIVAS da equipe',
    (select count(*) from (select regexp_replace(cpf, '\D', '', 'g') cpf, count(*) pessoas from public.equipe where status = 'ativa' group by 1 having count(*) > 1) q),
    $q$select regexp_replace(cpf, '\D', '', 'g') cpf, count(*) pessoas from public.equipe where status = 'ativa' group by 1 having count(*) > 1;$q$
  union all
  select 'B04', 'duplicidade: e-mail repetido entre pessoas ATIVAS da equipe (sem diferenciar maiúsculas e espaços)',
    (select count(*) from (select lower(trim(email::text)) email, count(*) pessoas from public.equipe where status = 'ativa' group by 1 having count(*) > 1) q),
    $q$select lower(trim(email::text)) email, count(*) pessoas from public.equipe where status = 'ativa' group by 1 having count(*) > 1;$q$
  union all
  select 'B05', 'duplicidade: CPF de ficha que é de pessoa ATIVA da equipe',
    (select count(*) from (select f.id ficha, f.uf, e.id pessoa, e.papel from public.fichas f join public.equipe e on e.cpf = f.cpf and e.status = 'ativa') q),
    $q$select f.id ficha, f.uf, e.id pessoa, e.papel from public.fichas f join public.equipe e on e.cpf = f.cpf and e.status = 'ativa';$q$
  union all
  select 'B06', 'duplicidade: mais de uma coordenação geral/técnica, auxiliar ou bolsista (por estado) ativa na mesma vaga',
    (select count(*) from (select papel, uf, count(*) pessoas from public.equipe where status = 'ativa' and papel in ('coord_geral','coord_tecnico','auxiliar_adm','articulacao','apoio') group by 1, 2 having count(*) > 1) q),
    $q$select papel, uf, count(*) pessoas from public.equipe where status = 'ativa' and papel in ('coord_geral','coord_tecnico','auxiliar_adm','articulacao','apoio') group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B07', 'duplicidade: visita por ficha + etapa (diagnóstico, implantação, avaliação: uma só que não esteja cancelada)',
    (select count(*) from (select ficha_id, etapa, count(*) visitas from public.visitas where situacao <> 'cancelada' and etapa in ('diagnostico','implantacao','avaliacao') group by 1, 2 having count(*) > 1) q),
    $q$select ficha_id, etapa, count(*) visitas from public.visitas where situacao <> 'cancelada' and etapa in ('diagnostico','implantacao','avaliacao') group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B08', 'duplicidade: mais de 2 visitas de acompanhamento (não canceladas) no mesmo quintal',
    (select count(*) from (select ficha_id, count(*) visitas from public.visitas where situacao <> 'cancelada' and etapa = 'acompanhamento' group by 1 having count(*) > 2) q),
    $q$select ficha_id, count(*) visitas from public.visitas where situacao <> 'cancelada' and etapa = 'acompanhamento' group by 1 having count(*) > 2;$q$
  union all
  select 'B09', 'duplicidade: mais de um diagnóstico por ficha',
    (select count(*) from (select ficha_id, count(*) diagnosticos from public.diagnosticos group by 1 having count(*) > 1) q),
    $q$select ficha_id, count(*) diagnosticos from public.diagnosticos group by 1 having count(*) > 1;$q$
  union all
  select 'B10', 'duplicidade: mais de um diagnóstico ou de uma avaliação para a mesma visita',
    (select count(*) from (select 'diagnosticos' tabela, visita_id, count(*) n from public.diagnosticos group by 2 having count(*) > 1 union all select 'avaliacoes', visita_id, count(*) from public.avaliacoes group by 2 having count(*) > 1) q),
    $q$select 'diagnosticos' tabela, visita_id, count(*) n from public.diagnosticos group by 2 having count(*) > 1 union all select 'avaliacoes', visita_id, count(*) from public.avaliacoes group by 2 having count(*) > 1;$q$
  union all
  select 'B11', 'duplicidade: mais de uma avaliação final por ficha',
    (select count(*) from (select ficha_id, count(*) avaliacoes from public.avaliacoes group by 1 having count(*) > 1) q),
    $q$select ficha_id, count(*) avaliacoes from public.avaliacoes group by 1 having count(*) > 1;$q$
  union all
  select 'B12', 'duplicidade: mais de uma matrícula ATIVA no FIC para a mesma pessoa',
    (select count(*) from (select equipe_id, count(*) matriculas from public.matriculas_fic where cancelada_em is null group by 1 having count(*) > 1) q),
    $q$select equipe_id, count(*) matriculas from public.matriculas_fic where cancelada_em is null group by 1 having count(*) > 1;$q$
  union all
  select 'B13', 'duplicidade: mesmo número de matrícula (ativa) em pessoas diferentes',
    (select count(*) from (select lower(trim(numero)) numero, count(distinct equipe_id) pessoas from public.matriculas_fic where cancelada_em is null group by 1 having count(distinct equipe_id) > 1) q),
    $q$select lower(trim(numero)) numero, count(distinct equipe_id) pessoas from public.matriculas_fic where cancelada_em is null group by 1 having count(distinct equipe_id) > 1;$q$
  union all
  select 'B14', 'duplicidade: mais de uma bolsa da mesma pessoa no mesmo mês',
    (select count(*) from (select equipe_id, mes, count(*) pedidos from public.solicitacoes_pagamento where tipo = 'bolsa' group by 1, 2 having count(*) > 1) q),
    $q$select equipe_id, mes, count(*) pedidos from public.solicitacoes_pagamento where tipo = 'bolsa' group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B15', 'duplicidade: mais de um pedido de ajuda de custo ABERTO (não devolvido) e sem rótulo de complementar no mesmo mês',
    (select count(*) from (select equipe_id, mes, count(*) pedidos from public.solicitacoes_pagamento where tipo = 'ajuda_custo' and situacao <> 'devolvida' and coalesce(detalhe ->> 'complementar', '') <> 'true' group by 1, 2 having count(*) > 1) q),
    $q$select equipe_id, mes, count(*) pedidos from public.solicitacoes_pagamento where tipo = 'ajuda_custo' and situacao <> 'devolvida' and coalesce(detalhe ->> 'complementar', '') <> 'true' group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B16', 'duplicidade: canais de venda iguais (estado, município sem acento, tipo e nome)',
    (select count(*) from (select uf, regexp_replace(trim(translate(lower(coalesce(municipio, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') municipio, tipo, regexp_replace(trim(translate(lower(coalesce(nome, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') nome, count(*) canais from public.canais_venda group by 1, 2, 3, 4 having count(*) > 1) q),
    $q$select uf, regexp_replace(trim(translate(lower(coalesce(municipio, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') municipio, tipo, regexp_replace(trim(translate(lower(coalesce(nome, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') nome, count(*) canais from public.canais_venda group by 1, 2, 3, 4 having count(*) > 1;$q$
  union all
  select 'B17', 'duplicidade: posição repetida na lista de espera do mesmo estado',
    (select count(*) from (select uf, posicao_espera, count(*) fichas from public.fichas where resultado = 'lista_espera' and posicao_espera is not null group by 1, 2 having count(*) > 1) q),
    $q$select uf, posicao_espera, count(*) fichas from public.fichas where resultado = 'lista_espera' and posicao_espera is not null group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B18', 'duplicidade: turma do FIC repetida (nome sem acento, estado, professor e início)',
    (select count(*) from (select regexp_replace(trim(translate(lower(coalesce(nome, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') nome, uf, professor_id, inicio, count(*) turmas from public.turmas_fic group by 1, 2, 3, 4 having count(*) > 1) q),
    $q$select regexp_replace(trim(translate(lower(coalesce(nome, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') nome, uf, professor_id, inicio, count(*) turmas from public.turmas_fic group by 1, 2, 3, 4 having count(*) > 1;$q$
  union all
  select 'B19', 'duplicidade: encontro do FIC repetido (turma, dia e modalidade, não cancelado)',
    (select count(*) from (select turma_id, data, modalidade, count(*) encontros from public.fic_encontros where cancelado_em is null group by 1, 2, 3 having count(*) > 1) q),
    $q$select turma_id, data, modalidade, count(*) encontros from public.fic_encontros where cancelado_em is null group by 1, 2, 3 having count(*) > 1;$q$
  union all
  select 'B20', 'duplicidade: mesma pessoa duas vezes na lista de presença do mesmo encontro',
    (select count(*) from (select encontro_id, equipe_id, count(*) n from public.fic_presencas group by 1, 2 having count(*) > 1) q),
    $q$select encontro_id, equipe_id, count(*) n from public.fic_presencas group by 1, 2 having count(*) > 1;$q$
  union all
  select 'B21', 'duplicidade: pré-cadastros AGUARDANDO com o mesmo CPF ou e-mail',
    (select count(*) from (select 'cpf' campo, cpf valor, count(*) n from public.pre_cadastros where situacao = 'aguardando' group by 2 having count(*) > 1 union all select 'email', lower(trim(email)), count(*) from public.pre_cadastros where situacao = 'aguardando' group by 2 having count(*) > 1) q),
    $q$select 'cpf' campo, cpf valor, count(*) n from public.pre_cadastros where situacao = 'aguardando' group by 2 having count(*) > 1 union all select 'email', lower(trim(email)), count(*) from public.pre_cadastros where situacao = 'aguardando' group by 2 having count(*) > 1;$q$
  union all
  select 'B22', 'duplicidade: mais de um pedido de novo acesso AGUARDANDO para a mesma pessoa',
    (select count(*) from (select equipe_id, count(*) n from public.pedidos_novo_acesso where situacao = 'aguardando' group by 1 having count(*) > 1) q),
    $q$select equipe_id, count(*) n from public.pedidos_novo_acesso where situacao = 'aguardando' group by 1 having count(*) > 1;$q$
  union all
  select 'B23', 'duplicidade: mesmo lançamento financeiro estornado mais de uma vez',
    (select count(*) from (select estorno_de, count(*) n from public.execucao_lancamentos where estorno_de is not null group by 1 having count(*) > 1) q),
    $q$select estorno_de, count(*) n from public.execucao_lancamentos where estorno_de is not null group by 1 having count(*) > 1;$q$
  union all
  select 'B24', 'duplicidade: situação da água repetida em seguida para a mesma mulher',
    (select count(*) from (select ficha_id, situacao, registrado_em from (select a.*, lag(situacao) over (partition by ficha_id order by registrado_em) anterior from public.agua_situacoes a) x where situacao = anterior) q),
    $q$select ficha_id, situacao, registrado_em from (select a.*, lag(situacao) over (partition by ficha_id order by registrado_em) anterior from public.agua_situacoes a) x where situacao = anterior;$q$
  union all
  select 'B25', 'duplicidade: mesmo documento do projeto anexado duas vezes (tipo, título e data, não arquivado)',
    (select count(*) from (select tipo, regexp_replace(trim(translate(lower(coalesce(titulo, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') titulo, data_documento, count(*) n from public.documentos_projeto where arquivado_em is null group by 1, 2, 3 having count(*) > 1) q),
    $q$select tipo, regexp_replace(trim(translate(lower(coalesce(titulo, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') titulo, data_documento, count(*) n from public.documentos_projeto where arquivado_em is null group by 1, 2, 3 having count(*) > 1;$q$
  union all
  select 'B26', 'duplicidade: mesma entrega do mês marcada duas vezes ou mesma foto na vitrine duas vezes',
    (select count(*) from (select 'entregas_mes' tabela, equipe_id::text chave, count(*) n from public.entregas_mes group by equipe_id, mes, item having count(*) > 1 union all select 'vitrine_fotos', path, count(*) from public.vitrine_fotos group by path having count(*) > 1) q),
    $q$select 'entregas_mes' tabela, equipe_id::text chave, count(*) n from public.entregas_mes group by equipe_id, mes, item having count(*) > 1 union all select 'vitrine_fotos', path, count(*) from public.vitrine_fotos group by path having count(*) > 1;$q$
  union all
  select 'C01', 'vazio indevido: ficha sem nome, município, comunidade, endereço ou CPF',
    (select count(*) from (select id, uf, municipio from public.fichas where length(trim(coalesce(nome, ''))) < 5 or length(trim(coalesce(municipio, ''))) < 3 or length(trim(coalesce(comunidade, ''))) < 3 or length(trim(coalesce(endereco, ''))) < 3 or coalesce(cpf, '') = '') q),
    $q$select id, uf, municipio from public.fichas where length(trim(coalesce(nome, ''))) < 5 or length(trim(coalesce(municipio, ''))) < 3 or length(trim(coalesce(comunidade, ''))) < 3 or length(trim(coalesce(endereco, ''))) < 3 or coalesce(cpf, '') = '';$q$
  union all
  select 'C02', 'vazio indevido: ficha sem estado, situação, resultado, data da ficha, nascimento ou data de criação',
    (select count(*) from (select id from public.fichas where uf is null or situacao is null or resultado is null or data_ficha is null or data_nascimento is null or criado_em is null) q),
    $q$select id from public.fichas where uf is null or situacao is null or resultado is null or data_ficha is null or data_nascimento is null or criado_em is null;$q$
  union all
  select 'C03', 'vazio indevido: ficha sem a bolsista que registrou',
    (select count(*) from (select id, uf, criado_em from public.fichas where bolsista_id is null) q),
    $q$select id, uf, criado_em from public.fichas where bolsista_id is null;$q$
  union all
  select 'C04', 'vazio indevido: ficha sem a autorização de uso dos dados (consent_dados)',
    (select count(*) from (select id, uf from public.fichas where consent_dados is not true) q),
    $q$select id, uf from public.fichas where consent_dados is not true;$q$
  union all
  select 'C05', 'vazio indevido: pessoa da equipe sem nome, CPF, e-mail, função, data de início ou aceite da LGPD',
    (select count(*) from (select id, papel, uf, status from public.equipe where length(trim(coalesce(nome, ''))) < 5 or coalesce(cpf, '') = '' or coalesce(trim(email::text), '') = '' or papel is null or data_inicio is null or consentimento_lgpd is not true or status is null or criado_em is null) q),
    $q$select id, papel, uf, status from public.equipe where length(trim(coalesce(nome, ''))) < 5 or coalesce(cpf, '') = '' or coalesce(trim(email::text), '') = '' or papel is null or data_inicio is null or consentimento_lgpd is not true or status is null or criado_em is null;$q$
  union all
  select 'C06', 'vazio indevido: bolsista ou agente ATIVA sem celular ou sem município',
    (select count(*) from (select id, papel, uf from public.equipe where status = 'ativa' and papel in ('articulacao','apoio','agente') and (coalesce(trim(telefone), '') = '' or coalesce(trim(municipio), '') = '')) q),
    $q$select id, papel, uf from public.equipe where status = 'ativa' and papel in ('articulacao','apoio','agente') and (coalesce(trim(telefone), '') = '' or coalesce(trim(municipio), '') = '');$q$
  union all
  select 'C07', 'vazio indevido: pessoa ATIVA (fora a coordenação geral) sem dados pessoais complementares ou sem data de nascimento',
    (select count(*) from (select e.id, e.papel, e.uf from public.equipe e left join public.equipe_privado p on p.equipe_id = e.id where e.status = 'ativa' and e.papel <> 'coord_geral' and not e.cadastro_arlo and (p.equipe_id is null or p.data_nascimento is null)) q),
    $q$select e.id, e.papel, e.uf from public.equipe e left join public.equipe_privado p on p.equipe_id = e.id where e.status = 'ativa' and e.papel <> 'coord_geral' and not e.cadastro_arlo and (p.equipe_id is null or p.data_nascimento is null);$q$
  union all
  select 'C08', 'vazio indevido: visita sem ficha, estado, etapa, quem faz, data prevista ou situação',
    (select count(*) from (select id from public.visitas where ficha_id is null or uf is null or etapa is null or executor_id is null or data_prevista is null or situacao is null or criado_em is null) q),
    $q$select id from public.visitas where ficha_id is null or uf is null or etapa is null or executor_id is null or data_prevista is null or situacao is null or criado_em is null;$q$
  union all
  select 'C09', 'vazio indevido: implantação ou acompanhamento FEITO sem relato (pelo menos 20 letras)',
    (select count(*) from (select id, uf, etapa, data_realizada from public.visitas where situacao = 'realizada' and etapa in ('implantacao','acompanhamento') and length(trim(coalesce(relato, ''))) < 20) q),
    $q$select id, uf, etapa, data_realizada from public.visitas where situacao = 'realizada' and etapa in ('implantacao','acompanhamento') and length(trim(coalesce(relato, ''))) < 20;$q$
  union all
  select 'C10', 'vazio indevido: implantação ou acompanhamento FEITO sem nenhuma foto',
    (select count(*) from (select id, uf, etapa, data_realizada from public.visitas where situacao = 'realizada' and etapa in ('implantacao','acompanhamento') and coalesce(array_length(fotos, 1), 0) = 0) q),
    $q$select id, uf, etapa, data_realizada from public.visitas where situacao = 'realizada' and etapa in ('implantacao','acompanhamento') and coalesce(array_length(fotos, 1), 0) = 0;$q$
  union all
  select 'C11', 'vazio indevido: diagnóstico sem quem fez, sem data, sem estado ou sem resposta da água na seca',
    (select count(*) from (select id, uf, ficha_id from public.diagnosticos where executor_id is null or data_visita is null or uf is null or agua_seca is null or situacao is null) q),
    $q$select id, uf, ficha_id from public.diagnosticos where executor_id is null or data_visita is null or uf is null or agua_seca is null or situacao is null;$q$
  union all
  select 'C12', 'vazio indevido: diagnóstico ou avaliação sem localização (GPS) e sem explicação de pelo menos 15 letras',
    (select count(*) from (select 'diagnosticos' tabela, id, uf from public.diagnosticos where latitude is null and length(trim(coalesce(sem_gps_motivo, ''))) < 15 union all select 'avaliacoes', id, uf from public.avaliacoes where latitude is null and length(trim(coalesce(sem_gps_motivo, ''))) < 5) q),
    $q$select 'diagnosticos' tabela, id, uf from public.diagnosticos where latitude is null and length(trim(coalesce(sem_gps_motivo, ''))) < 15 union all select 'avaliacoes', id, uf from public.avaliacoes where latitude is null and length(trim(coalesce(sem_gps_motivo, ''))) < 5;$q$
  union all
  select 'C13', 'vazio indevido: diagnóstico com água sem nenhum item no kit, ou sem nenhuma foto',
    (select count(*) from (select id, uf, ficha_id, situacao from public.diagnosticos where not sem_agua and (coalesce(jsonb_array_length(case when jsonb_typeof(dados -> 'kit') = 'array' then dados -> 'kit' end), 0) = 0 or coalesce(array_length(fotos, 1), 0) = 0)) q),
    $q$select id, uf, ficha_id, situacao from public.diagnosticos where not sem_agua and (coalesce(jsonb_array_length(case when jsonb_typeof(dados -> 'kit') = 'array' then dados -> 'kit' end), 0) = 0 or coalesce(array_length(fotos, 1), 0) = 0);$q$
  union all
  select 'C14', 'vazio indevido: latitude sem longitude (ou o contrário) em ficha, diagnóstico ou avaliação',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where (latitude is null) <> (longitude is null) union all select 'diagnosticos', id from public.diagnosticos where (latitude is null) <> (longitude is null) union all select 'avaliacoes', id from public.avaliacoes where (latitude is null) <> (longitude is null)) q),
    $q$select 'fichas' tabela, id from public.fichas where (latitude is null) <> (longitude is null) union all select 'diagnosticos', id from public.diagnosticos where (latitude is null) <> (longitude is null) union all select 'avaliacoes', id from public.avaliacoes where (latitude is null) <> (longitude is null);$q$
  union all
  select 'C15', 'vazio indevido: pedido de pagamento sem valor, e bolsa sem relatório (pelo menos 50 letras)',
    (select count(*) from (select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where valor_solicitado is null or (tipo = 'bolsa' and situacao <> 'devolvida' and length(trim(coalesce(relatorio, ''))) < 50)) q),
    $q$select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where valor_solicitado is null or (tipo = 'bolsa' and situacao <> 'devolvida' and length(trim(coalesce(relatorio, ''))) < 50);$q$
  union all
  select 'C16', 'vazio indevido: pedido de passagem/evento sem valor estimado, passagem sem finalidade ou sem passageiras',
    (select count(*) from (select id, tipo, uf, situacao from public.pedidos_apoio where (case jsonb_typeof(dados -> 'valor_estimado') when 'number' then (dados -> 'valor_estimado' #>> '{}')::numeric when 'string' then case when (dados -> 'valor_estimado' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados -> 'valor_estimado' #>> '{}')::numeric when replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.')::numeric end end) is null or (tipo = 'passagem' and (coalesce(dados ->> 'finalidade', '') not in ('intercambio','pedagogico') or coalesce(jsonb_array_length(case when jsonb_typeof(dados -> 'passageiros') = 'array' then dados -> 'passageiros' end), 0) = 0))) q),
    $q$select id, tipo, uf, situacao from public.pedidos_apoio where (case jsonb_typeof(dados -> 'valor_estimado') when 'number' then (dados -> 'valor_estimado' #>> '{}')::numeric when 'string' then case when (dados -> 'valor_estimado' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados -> 'valor_estimado' #>> '{}')::numeric when replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.')::numeric end end) is null or (tipo = 'passagem' and (coalesce(dados ->> 'finalidade', '') not in ('intercambio','pedagogico') or coalesce(jsonb_array_length(case when jsonb_typeof(dados -> 'passageiros') = 'array' then dados -> 'passageiros' end), 0) = 0));$q$
  union all
  select 'C17', 'vazio indevido: turma do FIC sem professor ou sem nome; matrícula sem número',
    (select count(*) from (select 'turmas_fic' tabela, id from public.turmas_fic where professor_id is null or length(trim(coalesce(nome, ''))) < 3 union all select 'matriculas_fic', id from public.matriculas_fic where length(trim(coalesce(numero, ''))) < 3) q),
    $q$select 'turmas_fic' tabela, id from public.turmas_fic where professor_id is null or length(trim(coalesce(nome, ''))) < 3 union all select 'matriculas_fic', id from public.matriculas_fic where length(trim(coalesce(numero, ''))) < 3;$q$
  union all
  select 'C18', 'vazio indevido: registro de água ou de encontro do FIC sem texto',
    (select count(*) from (select 'agua_situacoes' tabela, id from public.agua_situacoes where length(trim(coalesce(obs, ''))) < 10 union all select 'fic_encontros', id from public.fic_encontros where length(trim(coalesce(conteudo, ''))) < 10) q),
    $q$select 'agua_situacoes' tabela, id from public.agua_situacoes where length(trim(coalesce(obs, ''))) < 10 union all select 'fic_encontros', id from public.fic_encontros where length(trim(coalesce(conteudo, ''))) < 10;$q$
  union all
  select 'C19', 'vazio indevido: dados bancários incompletos (banco, agência, conta ou dígito)',
    (select count(*) from (select equipe_id from public.equipe_bancario where coalesce(banco_codigo, '') = '' or coalesce(trim(banco_nome), '') = '' or coalesce(agencia, '') = '' or coalesce(conta, '') = '' or coalesce(conta_dv, '') = '' or (pix_tipo is null) <> (pix_chave is null)) q),
    $q$select equipe_id from public.equipe_bancario where coalesce(banco_codigo, '') = '' or coalesce(trim(banco_nome), '') = '' or coalesce(agencia, '') = '' or coalesce(conta, '') = '' or coalesce(conta_dv, '') = '' or (pix_tipo is null) <> (pix_chave is null);$q$
  union all
  select 'C20', 'vazio indevido: foto da vitrine sem legenda (5 a 140 letras)',
    (select count(*) from (select id, uf from public.vitrine_fotos where length(trim(coalesce(legenda, ''))) not between 5 and 140) q),
    $q$select id, uf from public.vitrine_fotos where length(trim(coalesce(legenda, ''))) not between 5 and 140;$q$
  union all
  select 'D01', 'fora do limite: kit do quintal acima de R$ 5.000,00',
    (select count(*) from (select d.id, d.uf, d.ficha_id, d.situacao, k.total from public.diagnosticos d cross join lateral (select coalesce(sum(greatest(coalesce((case when jsonb_typeof(i -> 'qtd') = 'number' then (i ->> 'qtd')::numeric else public.num_br(i ->> 'qtd') end), 0), 0) * greatest(coalesce((case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end), 0), 0)), 0) total from jsonb_array_elements(case when jsonb_typeof(d.dados -> 'kit') = 'array' then d.dados -> 'kit' else '[]'::jsonb end) i) k where not d.sem_agua and round(k.total, 2) > 5000) q),
    $q$select d.id, d.uf, d.ficha_id, d.situacao, k.total from public.diagnosticos d cross join lateral (select coalesce(sum(greatest(coalesce((case when jsonb_typeof(i -> 'qtd') = 'number' then (i ->> 'qtd')::numeric else public.num_br(i ->> 'qtd') end), 0), 0) * greatest(coalesce((case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end), 0), 0)), 0) total from jsonb_array_elements(case when jsonb_typeof(d.dados -> 'kit') = 'array' then d.dados -> 'kit' else '[]'::jsonb end) i) k where not d.sem_agua and round(k.total, 2) > 5000;$q$
  union all
  select 'D02', 'fora do limite: item do kit com quantidade ou valor negativo, valor sem quantidade, ou valor que não é número',
    (select count(*) from (select d.id, d.uf, i ->> 'item' item, i ->> 'qtd' qtd, i ->> 'valor' valor from public.diagnosticos d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.dados -> 'kit') = 'array' then d.dados -> 'kit' else '[]'::jsonb end) i where (case when jsonb_typeof(i -> 'qtd') = 'number' then (i ->> 'qtd')::numeric else public.num_br(i ->> 'qtd') end) < 0 or (case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end) < 0 or ((case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end) > 0 and coalesce((case when jsonb_typeof(i -> 'qtd') = 'number' then (i ->> 'qtd')::numeric else public.num_br(i ->> 'qtd') end), 0) <= 0) or (coalesce(trim(i ->> 'valor'), '') <> '' and (case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end) is null)) q),
    $q$select d.id, d.uf, i ->> 'item' item, i ->> 'qtd' qtd, i ->> 'valor' valor from public.diagnosticos d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.dados -> 'kit') = 'array' then d.dados -> 'kit' else '[]'::jsonb end) i where (case when jsonb_typeof(i -> 'qtd') = 'number' then (i ->> 'qtd')::numeric else public.num_br(i ->> 'qtd') end) < 0 or (case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end) < 0 or ((case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end) > 0 and coalesce((case when jsonb_typeof(i -> 'qtd') = 'number' then (i ->> 'qtd')::numeric else public.num_br(i ->> 'qtd') end), 0) <= 0) or (coalesce(trim(i ->> 'valor'), '') <> '' and (case when jsonb_typeof(i -> 'valor') = 'number' then (i ->> 'valor')::numeric else public.num_br(i ->> 'valor') end) is null);$q$
  union all
  select 'D03', 'fora do limite: valor pedido ou avalizado zero, negativo ou que não é número (NaN)',
    (select count(*) from (select id, tipo, equipe_id, mes, situacao, valor_solicitado, valor_avalizado from public.solicitacoes_pagamento where not (valor_solicitado > 0 and valor_solicitado < 1e9) or (valor_avalizado is not null and not (valor_avalizado > 0 and valor_avalizado < 1e9))) q),
    $q$select id, tipo, equipe_id, mes, situacao, valor_solicitado, valor_avalizado from public.solicitacoes_pagamento where not (valor_solicitado > 0 and valor_solicitado < 1e9) or (valor_avalizado is not null and not (valor_avalizado > 0 and valor_avalizado < 1e9));$q$
  union all
  select 'D04', 'fora do limite: bolsa acima de R$ 10.000,00 ou ajuda de custo acima de R$ 2.000,00 por visita',
    (select count(*) from (select s.id, s.tipo, s.equipe_id, s.mes, s.situacao, s.valor_solicitado, s.valor_avalizado, n.visitas from public.solicitacoes_pagamento s cross join lateral (select greatest(count(*), 1) visitas from public.solicitacao_visitas sv where sv.solicitacao_id = s.id) n where s.situacao <> 'devolvida' and greatest(coalesce(s.valor_solicitado, 0), coalesce(s.valor_avalizado, 0)) > case when s.tipo = 'bolsa' then 10000 else 2000 * n.visitas end) q),
    $q$select s.id, s.tipo, s.equipe_id, s.mes, s.situacao, s.valor_solicitado, s.valor_avalizado, n.visitas from public.solicitacoes_pagamento s cross join lateral (select greatest(count(*), 1) visitas from public.solicitacao_visitas sv where sv.solicitacao_id = s.id) n where s.situacao <> 'devolvida' and greatest(coalesce(s.valor_solicitado, 0), coalesce(s.valor_avalizado, 0)) > case when s.tipo = 'bolsa' then 10000 else 2000 * n.visitas end;$q$
  union all
  select 'D05', 'fora do limite: bolsa avalizada acima do valor pedido',
    (select count(*) from (select id, equipe_id, mes, valor_solicitado, valor_avalizado from public.solicitacoes_pagamento where tipo = 'bolsa' and situacao in ('avalizada','lancada') and valor_avalizado > valor_solicitado) q),
    $q$select id, equipe_id, mes, valor_solicitado, valor_avalizado from public.solicitacoes_pagamento where tipo = 'bolsa' and situacao in ('avalizada','lancada') and valor_avalizado > valor_solicitado;$q$
  union all
  select 'D06', 'fora do limite: ajuda de custo pedida acima do total detalhado por visita',
    (select count(*) from (select id, equipe_id, mes, valor_solicitado, (case jsonb_typeof(detalhe -> 'total') when 'number' then (detalhe -> 'total' #>> '{}')::numeric when 'string' then case when (detalhe -> 'total' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (detalhe -> 'total' #>> '{}')::numeric when replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.')::numeric end end) total_detalhado from public.solicitacoes_pagamento where tipo = 'ajuda_custo' and situacao <> 'devolvida' and valor_solicitado > round((case jsonb_typeof(detalhe -> 'total') when 'number' then (detalhe -> 'total' #>> '{}')::numeric when 'string' then case when (detalhe -> 'total' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (detalhe -> 'total' #>> '{}')::numeric when replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.')::numeric end end), 2) + 0.01) q),
    $q$select id, equipe_id, mes, valor_solicitado, (case jsonb_typeof(detalhe -> 'total') when 'number' then (detalhe -> 'total' #>> '{}')::numeric when 'string' then case when (detalhe -> 'total' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (detalhe -> 'total' #>> '{}')::numeric when replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.')::numeric end end) total_detalhado from public.solicitacoes_pagamento where tipo = 'ajuda_custo' and situacao <> 'devolvida' and valor_solicitado > round((case jsonb_typeof(detalhe -> 'total') when 'number' then (detalhe -> 'total' #>> '{}')::numeric when 'string' then case when (detalhe -> 'total' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (detalhe -> 'total' #>> '{}')::numeric when replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((detalhe -> 'total' #>> '{}'), '.', ''), ',', '.')::numeric end end), 2) + 0.01;$q$
  union all
  select 'D07', 'fora do limite: valor de passagem/evento (estimado ou autorizado) zero, negativo ou acima de R$ 1.000.000,00',
    (select count(*) from (select id, tipo, uf, situacao, dados ->> 'valor_estimado' estimado, valor_autorizado from public.pedidos_apoio where not ((case jsonb_typeof(dados -> 'valor_estimado') when 'number' then (dados -> 'valor_estimado' #>> '{}')::numeric when 'string' then case when (dados -> 'valor_estimado' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados -> 'valor_estimado' #>> '{}')::numeric when replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.')::numeric end end) > 0 and (case jsonb_typeof(dados -> 'valor_estimado') when 'number' then (dados -> 'valor_estimado' #>> '{}')::numeric when 'string' then case when (dados -> 'valor_estimado' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados -> 'valor_estimado' #>> '{}')::numeric when replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.')::numeric end end) <= 1000000) or (valor_autorizado is not null and not (valor_autorizado > 0 and valor_autorizado <= 1000000))) q),
    $q$select id, tipo, uf, situacao, dados ->> 'valor_estimado' estimado, valor_autorizado from public.pedidos_apoio where not ((case jsonb_typeof(dados -> 'valor_estimado') when 'number' then (dados -> 'valor_estimado' #>> '{}')::numeric when 'string' then case when (dados -> 'valor_estimado' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados -> 'valor_estimado' #>> '{}')::numeric when replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.')::numeric end end) > 0 and (case jsonb_typeof(dados -> 'valor_estimado') when 'number' then (dados -> 'valor_estimado' #>> '{}')::numeric when 'string' then case when (dados -> 'valor_estimado' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (dados -> 'valor_estimado' #>> '{}')::numeric when replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((dados -> 'valor_estimado' #>> '{}'), '.', ''), ',', '.')::numeric end end) <= 1000000) or (valor_autorizado is not null and not (valor_autorizado > 0 and valor_autorizado <= 1000000));$q$
  union all
  select 'D08', 'fora do limite: distância da visita (km de ida) negativa ou de 1.000 km para cima',
    (select count(*) from (select visita_id, km_ida from public.custos_visita where not (km_ida >= 0 and km_ida < 1000)) q),
    $q$select visita_id, km_ida from public.custos_visita where not (km_ida >= 0 and km_ida < 1000);$q$
  union all
  select 'D09', 'fora do limite: área do quintal zero, negativa ou acima de 100.000 m²',
    (select count(*) from (select id, uf, area_m2 from public.diagnosticos where area_m2 is not null and not (area_m2 > 0 and area_m2 <= 100000)) q),
    $q$select id, uf, area_m2 from public.diagnosticos where area_m2 is not null and not (area_m2 > 0 and area_m2 <= 100000);$q$
  union all
  select 'D10', 'fora do limite: renda da família ou vendas do quintal negativa ou acima de R$ 1.000.000,00',
    (select count(*) from (select id, uf, renda_familiar, renda_quintal from public.diagnosticos where (renda_familiar is not null and not (renda_familiar >= 0 and renda_familiar <= 1000000)) or (renda_quintal is not null and not (renda_quintal >= 0 and renda_quintal <= 1000000))) q),
    $q$select id, uf, renda_familiar, renda_quintal from public.diagnosticos where (renda_familiar is not null and not (renda_familiar >= 0 and renda_familiar <= 1000000)) or (renda_quintal is not null and not (renda_quintal >= 0 and renda_quintal <= 1000000));$q$
  union all
  select 'D11', 'fora do limite: vendas do quintal maiores que a renda da família',
    (select count(*) from (select id, uf, renda_familiar, renda_quintal from public.diagnosticos where renda_quintal > renda_familiar) q),
    $q$select id, uf, renda_familiar, renda_quintal from public.diagnosticos where renda_quintal > renda_familiar;$q$
  union all
  select 'D12', 'fora do limite: carga horária de encontro do FIC zero, negativa ou acima de 12 horas',
    (select count(*) from (select id, turma_id, data, carga_horaria from public.fic_encontros where not (carga_horaria > 0 and carga_horaria <= 12)) q),
    $q$select id, turma_id, data, carga_horaria from public.fic_encontros where not (carga_horaria > 0 and carga_horaria <= 12);$q$
  union all
  select 'D13', 'fora do limite: encontros (não cancelados) da mesma turma no mesmo dia somando mais de 12 horas',
    (select count(*) from (select turma_id, data, sum(carga_horaria) horas from public.fic_encontros where cancelado_em is null group by 1, 2 having sum(carga_horaria) > 12) q),
    $q$select turma_id, data, sum(carga_horaria) horas from public.fic_encontros where cancelado_em is null group by 1, 2 having sum(carga_horaria) > 12;$q$
  union all
  select 'D14', 'fora do limite: pontuação da EBIA fora de 0 a 14, ou nível que não combina com os pontos vazios',
    (select count(*) from (select id, uf, ebia_pontos, ebia_nivel from public.avaliacoes where (ebia_pontos is not null and not (ebia_pontos between 0 and 14)) or ((ebia_pontos is null) <> (ebia_nivel is null))) q),
    $q$select id, uf, ebia_pontos, ebia_nivel from public.avaliacoes where (ebia_pontos is not null and not (ebia_pontos between 0 and 14)) or ((ebia_pontos is null) <> (ebia_nivel is null));$q$
  union all
  select 'D15', 'fora do limite: pessoas da família fora de 1 a 30',
    (select count(*) from (select id, uf, pessoas_familia from public.fichas where pessoas_familia is not null and not (pessoas_familia between 1 and 30)) q),
    $q$select id, uf, pessoas_familia from public.fichas where pessoas_familia is not null and not (pessoas_familia between 1 and 30);$q$
  union all
  select 'D16', 'fora do limite: metas individuais fora do previsto (diagnósticos e quintais 0 a 40, visitas 0 a 80)',
    (select count(*) from (select id, papel, uf, meta_diagnosticos, meta_quintais, meta_visitas from public.equipe where not (coalesce(meta_diagnosticos, 0) between 0 and 40) or not (coalesce(meta_quintais, 0) between 0 and 40) or not (coalesce(meta_visitas, 0) between 0 and 80)) q),
    $q$select id, papel, uf, meta_diagnosticos, meta_quintais, meta_visitas from public.equipe where not (coalesce(meta_diagnosticos, 0) between 0 and 40) or not (coalesce(meta_quintais, 0) between 0 and 40) or not (coalesce(meta_visitas, 0) between 0 and 80);$q$
  union all
  select 'D17', 'fora do limite: metas das pessoas ATIVAS de um estado somando mais que a meta do estado (40, 40, 80)',
    (select count(*) from (select uf, sum(coalesce(meta_diagnosticos, 0)) diagnosticos, sum(coalesce(meta_quintais, 0)) quintais, sum(coalesce(meta_visitas, 0)) visitas from public.equipe where status = 'ativa' and uf is not null group by 1 having sum(coalesce(meta_diagnosticos, 0)) > 40 or sum(coalesce(meta_quintais, 0)) > 40 or sum(coalesce(meta_visitas, 0)) > 80) q),
    $q$select uf, sum(coalesce(meta_diagnosticos, 0)) diagnosticos, sum(coalesce(meta_quintais, 0)) quintais, sum(coalesce(meta_visitas, 0)) visitas from public.equipe where status = 'ativa' and uf is not null group by 1 having sum(coalesce(meta_diagnosticos, 0)) > 40 or sum(coalesce(meta_quintais, 0)) > 40 or sum(coalesce(meta_visitas, 0)) > 80;$q$
  union all
  select 'D18', 'fora do limite: localização (GPS) impossível ou (0, 0)',
    (select count(*) from (select 'fichas' tabela, x.id, x.uf, x.latitude, x.longitude from public.fichas x where x.latitude is not null and (not (x.latitude between -90 and 90 and x.longitude between -180 and 180) or (x.latitude = 0 and x.longitude = 0)) union all select 'diagnosticos', x.id, x.uf, x.latitude, x.longitude from public.diagnosticos x where x.latitude is not null and (not (x.latitude between -90 and 90 and x.longitude between -180 and 180) or (x.latitude = 0 and x.longitude = 0)) union all select 'avaliacoes', x.id, x.uf, x.latitude, x.longitude from public.avaliacoes x where x.latitude is not null and (not (x.latitude between -90 and 90 and x.longitude between -180 and 180) or (x.latitude = 0 and x.longitude = 0))) q),
    $q$select 'fichas' tabela, x.id, x.uf, x.latitude, x.longitude from public.fichas x where x.latitude is not null and (not (x.latitude between -90 and 90 and x.longitude between -180 and 180) or (x.latitude = 0 and x.longitude = 0)) union all select 'diagnosticos', x.id, x.uf, x.latitude, x.longitude from public.diagnosticos x where x.latitude is not null and (not (x.latitude between -90 and 90 and x.longitude between -180 and 180) or (x.latitude = 0 and x.longitude = 0)) union all select 'avaliacoes', x.id, x.uf, x.latitude, x.longitude from public.avaliacoes x where x.latitude is not null and (not (x.latitude between -90 and 90 and x.longitude between -180 and 180) or (x.latitude = 0 and x.longitude = 0));$q$
  union all
  select 'D19', 'fora do limite: localização (GPS) fora da região dos cinco estados do projeto',
    (select count(*) from (select 'fichas' tabela, x.id, x.uf, x.latitude, x.longitude from public.fichas x where x.latitude is not null and x.longitude is not null and not (x.latitude between -19 and -2 and x.longitude between -47 and -34) union all select 'diagnosticos', x.id, x.uf, x.latitude, x.longitude from public.diagnosticos x where x.latitude is not null and x.longitude is not null and not (x.latitude between -19 and -2 and x.longitude between -47 and -34) union all select 'avaliacoes', x.id, x.uf, x.latitude, x.longitude from public.avaliacoes x where x.latitude is not null and x.longitude is not null and not (x.latitude between -19 and -2 and x.longitude between -47 and -34)) q),
    $q$select 'fichas' tabela, x.id, x.uf, x.latitude, x.longitude from public.fichas x where x.latitude is not null and x.longitude is not null and not (x.latitude between -19 and -2 and x.longitude between -47 and -34) union all select 'diagnosticos', x.id, x.uf, x.latitude, x.longitude from public.diagnosticos x where x.latitude is not null and x.longitude is not null and not (x.latitude between -19 and -2 and x.longitude between -47 and -34) union all select 'avaliacoes', x.id, x.uf, x.latitude, x.longitude from public.avaliacoes x where x.latitude is not null and x.longitude is not null and not (x.latitude between -19 and -2 and x.longitude between -47 and -34);$q$
  union all
  select 'D20', 'fora do limite: valores do custo da visita (parâmetros) negativos, zerados onde não pode, fator estrada menor que 1 ou horas fora de 0 a 24',
    (select count(*) from (select p.chave, k.key campo, k.value valor from public.parametros p cross join lateral jsonb_each(case when jsonb_typeof(p.valor) = 'object' then p.valor else '{}'::jsonb end) k where p.chave = 'custo_visita' and ((k.key in ('valor_hora','refeicao','teto','km_por_litro','preco_litro','fator_estrada') and jsonb_typeof(k.value) <> 'number') or (k.key in ('valor_hora','refeicao','teto') and jsonb_typeof(k.value) = 'number' and not ((k.value #>> '{}')::numeric >= 0 and (k.value #>> '{}')::numeric <= 100000000)) or (k.key in ('km_por_litro','preco_litro') and jsonb_typeof(k.value) = 'number' and not ((k.value #>> '{}')::numeric > 0 and (k.value #>> '{}')::numeric <= 100000000)) or (k.key = 'fator_estrada' and jsonb_typeof(k.value) = 'number' and not ((k.value #>> '{}')::numeric >= 1 and (k.value #>> '{}')::numeric <= 100)) or (k.key = 'horas' and (jsonb_typeof(k.value) <> 'object' or exists (select 1 from jsonb_each(case when jsonb_typeof(k.value) = 'object' then k.value else '{}'::jsonb end) h where jsonb_typeof(h.value) <> 'number' or not ((h.value #>> '{}')::numeric between 0 and 24)))))) q),
    $q$select p.chave, k.key campo, k.value valor from public.parametros p cross join lateral jsonb_each(case when jsonb_typeof(p.valor) = 'object' then p.valor else '{}'::jsonb end) k where p.chave = 'custo_visita' and ((k.key in ('valor_hora','refeicao','teto','km_por_litro','preco_litro','fator_estrada') and jsonb_typeof(k.value) <> 'number') or (k.key in ('valor_hora','refeicao','teto') and jsonb_typeof(k.value) = 'number' and not ((k.value #>> '{}')::numeric >= 0 and (k.value #>> '{}')::numeric <= 100000000)) or (k.key in ('km_por_litro','preco_litro') and jsonb_typeof(k.value) = 'number' and not ((k.value #>> '{}')::numeric > 0 and (k.value #>> '{}')::numeric <= 100000000)) or (k.key = 'fator_estrada' and jsonb_typeof(k.value) = 'number' and not ((k.value #>> '{}')::numeric >= 1 and (k.value #>> '{}')::numeric <= 100)) or (k.key = 'horas' and (jsonb_typeof(k.value) <> 'object' or exists (select 1 from jsonb_each(case when jsonb_typeof(k.value) = 'object' then k.value else '{}'::jsonb end) h where jsonb_typeof(h.value) <> 'number' or not ((h.value #>> '{}')::numeric between 0 and 24)))));$q$
  union all
  select 'D21', 'fora do limite: lançamento financeiro zerado, acima de R$ 2.000.000,00, negativo sem ser estorno, ou estorno que não anula o original',
    (select count(*) from (select l.id, l.tipo, l.item, l.valor, l.data, l.estorno_de from public.execucao_lancamentos l left join public.execucao_lancamentos o on o.id = l.estorno_de where not (l.valor <> 0 and abs(l.valor) <= 2000000) or (l.estorno_de is null and l.valor < 0) or (l.estorno_de is not null and l.valor <> -o.valor)) q),
    $q$select l.id, l.tipo, l.item, l.valor, l.data, l.estorno_de from public.execucao_lancamentos l left join public.execucao_lancamentos o on o.id = l.estorno_de where not (l.valor <> 0 and abs(l.valor) <= 2000000) or (l.estorno_de is null and l.valor < 0) or (l.estorno_de is not null and l.valor <> -o.valor);$q$
  union all
  select 'D22', 'fora do limite: planilha de execução com total negativo, linhas não classificadas negativas ou soma das linhas diferente do total gasto',
    (select count(*) from (select p.id, p.posicao_em, p.total_gasto, p.total_recebido, p.nao_classificadas, s.soma from public.execucao_planilhas p cross join lateral (select sum((case jsonb_typeof(l -> 'valor') when 'number' then (l -> 'valor' #>> '{}')::numeric when 'string' then case when (l -> 'valor' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (l -> 'valor' #>> '{}')::numeric when replace(replace((l -> 'valor' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((l -> 'valor' #>> '{}'), '.', ''), ',', '.')::numeric end end)) soma from jsonb_array_elements(case when jsonb_typeof(p.linhas) = 'array' then p.linhas else '[]'::jsonb end) l) s where p.total_gasto < 0 or p.total_recebido < 0 or p.nao_classificadas < 0 or abs(coalesce(s.soma, 0) - p.total_gasto) > 0.01) q),
    $q$select p.id, p.posicao_em, p.total_gasto, p.total_recebido, p.nao_classificadas, s.soma from public.execucao_planilhas p cross join lateral (select sum((case jsonb_typeof(l -> 'valor') when 'number' then (l -> 'valor' #>> '{}')::numeric when 'string' then case when (l -> 'valor' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (l -> 'valor' #>> '{}')::numeric when replace(replace((l -> 'valor' #>> '{}'), '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then replace(replace((l -> 'valor' #>> '{}'), '.', ''), ',', '.')::numeric end end)) soma from jsonb_array_elements(case when jsonb_typeof(p.linhas) = 'array' then p.linhas else '[]'::jsonb end) l) s where p.total_gasto < 0 or p.total_recebido < 0 or p.nao_classificadas < 0 or abs(coalesce(s.soma, 0) - p.total_gasto) > 0.01;$q$
  union all
  select 'D23', 'fora do limite: tamanho de documento zerado ou acima de 20 MB; pedido de novo acesso com contador menor que 1',
    (select count(*) from (select 'documentos_projeto' tabela, id from public.documentos_projeto where tamanho is not null and not (tamanho > 0 and tamanho <= 20971520) union all select 'pedidos_novo_acesso', id from public.pedidos_novo_acesso where vezes < 1) q),
    $q$select 'documentos_projeto' tabela, id from public.documentos_projeto where tamanho is not null and not (tamanho > 0 and tamanho <= 20971520) union all select 'pedidos_novo_acesso', id from public.pedidos_novo_acesso where vezes < 1;$q$
  union all
  select 'D24', 'fora do limite: posição na lista de espera menor que 1',
    (select count(*) from (select id, uf, posicao_espera from public.fichas where posicao_espera < 1) q),
    $q$select id, uf, posicao_espera from public.fichas where posicao_espera < 1;$q$
  union all
  select 'D25', 'fora do limite: texto muito longo (nome acima de 120 letras; relato, justificativa ou observação acima de 2.000)',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where length(nome) > 120 or length(coalesce(justificativa, '')) > 2000 or length(coalesce(obs_coordenacao, '')) > 2000 or length(endereco) > 500 or length(municipio) > 80 or length(comunidade) > 120 union all select 'equipe', id from public.equipe where length(nome) > 120 or length(coalesce(motivo_desligamento, '')) > 2000 or length(coalesce(obs_habilitacao, '')) > 2000 or length(coalesce(municipio, '')) > 80 union all select 'visitas', id from public.visitas where length(coalesce(relato, '')) > 2000 or length(coalesce(obs, '')) > 2000 union all select 'diagnosticos', id from public.diagnosticos where length(coalesce(obs_coordenacao, '')) > 2000 or length(coalesce(sem_gps_motivo, '')) > 2000 or length(dados::text) > 200000 union all select 'solicitacoes_pagamento', id from public.solicitacoes_pagamento where length(coalesce(relatorio, '')) > 20000 or length(coalesce(obs_aval, '')) > 2000 or length(coalesce(arlo_protocolo, '')) > 200 union all select 'pedidos_apoio', id from public.pedidos_apoio where length(coalesce(justificativa_prazo, '')) > 2000 or length(coalesce(obs, '')) > 2000 or length(coalesce(funcern_protocolo, '')) > 200 or length(dados::text) > 100000) q),
    $q$select 'fichas' tabela, id from public.fichas where length(nome) > 120 or length(coalesce(justificativa, '')) > 2000 or length(coalesce(obs_coordenacao, '')) > 2000 or length(endereco) > 500 or length(municipio) > 80 or length(comunidade) > 120 union all select 'equipe', id from public.equipe where length(nome) > 120 or length(coalesce(motivo_desligamento, '')) > 2000 or length(coalesce(obs_habilitacao, '')) > 2000 or length(coalesce(municipio, '')) > 80 union all select 'visitas', id from public.visitas where length(coalesce(relato, '')) > 2000 or length(coalesce(obs, '')) > 2000 union all select 'diagnosticos', id from public.diagnosticos where length(coalesce(obs_coordenacao, '')) > 2000 or length(coalesce(sem_gps_motivo, '')) > 2000 or length(dados::text) > 200000 union all select 'solicitacoes_pagamento', id from public.solicitacoes_pagamento where length(coalesce(relatorio, '')) > 20000 or length(coalesce(obs_aval, '')) > 2000 or length(coalesce(arlo_protocolo, '')) > 200 union all select 'pedidos_apoio', id from public.pedidos_apoio where length(coalesce(justificativa_prazo, '')) > 2000 or length(coalesce(obs, '')) > 2000 or length(coalesce(funcern_protocolo, '')) > 200 or length(dados::text) > 100000;$q$
  union all
  select 'E01', 'data inválida: ficha com data no futuro ou anterior a 01/01/2026',
    (select count(*) from (select id, uf, data_ficha from public.fichas where data_ficha > (now() at time zone 'America/Fortaleza')::date or data_ficha < date '2026-01-01') q),
    $q$select id, uf, data_ficha from public.fichas where data_ficha > (now() at time zone 'America/Fortaleza')::date or data_ficha < date '2026-01-01';$q$
  union all
  select 'E02', 'data inválida: nascimento no futuro ou anterior a 1901 (ficha, equipe, pré-cadastro)',
    (select count(*) from (select 'fichas' tabela, id, data_nascimento from public.fichas where data_nascimento > (now() at time zone 'America/Fortaleza')::date or data_nascimento < date '1901-01-01' union all select 'equipe_privado', equipe_id, data_nascimento from public.equipe_privado where data_nascimento > (now() at time zone 'America/Fortaleza')::date or data_nascimento < date '1901-01-01' union all select 'pre_cadastros', id, data_nascimento from public.pre_cadastros where data_nascimento > (now() at time zone 'America/Fortaleza')::date or data_nascimento < date '1901-01-01') q),
    $q$select 'fichas' tabela, id, data_nascimento from public.fichas where data_nascimento > (now() at time zone 'America/Fortaleza')::date or data_nascimento < date '1901-01-01' union all select 'equipe_privado', equipe_id, data_nascimento from public.equipe_privado where data_nascimento > (now() at time zone 'America/Fortaleza')::date or data_nascimento < date '1901-01-01' union all select 'pre_cadastros', id, data_nascimento from public.pre_cadastros where data_nascimento > (now() at time zone 'America/Fortaleza')::date or data_nascimento < date '1901-01-01';$q$
  union all
  select 'E03', 'data inválida: selecionada ou em lista de espera com menos de 18 anos na data da ficha',
    (select count(*) from (select id, uf, data_nascimento, data_ficha, resultado from public.fichas where resultado in ('selecionada','lista_espera') and data_nascimento > (data_ficha - interval '18 years')) q),
    $q$select id, uf, data_nascimento, data_ficha, resultado from public.fichas where resultado in ('selecionada','lista_espera') and data_nascimento > (data_ficha - interval '18 years');$q$
  union all
  select 'E04', 'data inválida: pessoa da equipe com menos de 18 anos na data de início',
    (select count(*) from (select e.id, e.papel, p.data_nascimento, e.data_inicio from public.equipe e join public.equipe_privado p on p.equipe_id = e.id where p.data_nascimento > (e.data_inicio - interval '18 years')) q),
    $q$select e.id, e.papel, p.data_nascimento, e.data_inicio from public.equipe e join public.equipe_privado p on p.equipe_id = e.id where p.data_nascimento > (e.data_inicio - interval '18 years');$q$
  union all
  select 'E05', 'data inválida: visita FEITA com data no futuro',
    (select count(*) from (select id, uf, etapa, data_realizada from public.visitas where data_realizada > (now() at time zone 'America/Fortaleza')::date) q),
    $q$select id, uf, etapa, data_realizada from public.visitas where data_realizada > (now() at time zone 'America/Fortaleza')::date;$q$
  union all
  select 'E06', 'data inválida: visita com data prevista fora de 01/01/2026 a 31/12/2027',
    (select count(*) from (select id, uf, etapa, situacao, data_prevista from public.visitas where data_prevista < date '2026-01-01' or data_prevista > date '2027-12-31') q),
    $q$select id, uf, etapa, situacao, data_prevista from public.visitas where data_prevista < date '2026-01-01' or data_prevista > date '2027-12-31';$q$
  union all
  select 'E07', 'data inválida: visita feita antes de 01/01/2026',
    (select count(*) from (select id, uf, etapa, data_realizada from public.visitas where data_realizada < date '2026-01-01') q),
    $q$select id, uf, etapa, data_realizada from public.visitas where data_realizada < date '2026-01-01';$q$
  union all
  select 'E08', 'fora de ordem: visita feita (ou prevista) antes da data da ficha',
    (select count(*) from (select v.id, v.uf, v.etapa, v.situacao, v.data_prevista, v.data_realizada, f.data_ficha from public.visitas v join public.fichas f on f.id = v.ficha_id where v.situacao <> 'cancelada' and (v.data_realizada < f.data_ficha or v.data_prevista < f.data_ficha)) q),
    $q$select v.id, v.uf, v.etapa, v.situacao, v.data_prevista, v.data_realizada, f.data_ficha from public.visitas v join public.fichas f on f.id = v.ficha_id where v.situacao <> 'cancelada' and (v.data_realizada < f.data_ficha or v.data_prevista < f.data_ficha);$q$
  union all
  select 'E09', 'data inválida: diagnóstico ou avaliação com data no futuro, antes de 01/01/2026 ou antes da ficha',
    (select count(*) from (select 'diagnosticos' tabela, d.id, d.uf, d.data_visita, f.data_ficha from public.diagnosticos d join public.fichas f on f.id = d.ficha_id where d.data_visita > (now() at time zone 'America/Fortaleza')::date or d.data_visita < date '2026-01-01' or d.data_visita < f.data_ficha union all select 'avaliacoes', d.id, d.uf, d.data_visita, f.data_ficha from public.avaliacoes d join public.fichas f on f.id = d.ficha_id where d.data_visita > (now() at time zone 'America/Fortaleza')::date or d.data_visita < date '2026-01-01' or d.data_visita < f.data_ficha) q),
    $q$select 'diagnosticos' tabela, d.id, d.uf, d.data_visita, f.data_ficha from public.diagnosticos d join public.fichas f on f.id = d.ficha_id where d.data_visita > (now() at time zone 'America/Fortaleza')::date or d.data_visita < date '2026-01-01' or d.data_visita < f.data_ficha union all select 'avaliacoes', d.id, d.uf, d.data_visita, f.data_ficha from public.avaliacoes d join public.fichas f on f.id = d.ficha_id where d.data_visita > (now() at time zone 'America/Fortaleza')::date or d.data_visita < date '2026-01-01' or d.data_visita < f.data_ficha;$q$
  union all
  select 'E10', 'fora de ordem: implantação feita antes do diagnóstico',
    (select count(*) from (select v.id, v.uf, v.ficha_id, v.etapa, v.data_realizada, a.feita_em as etapa_anterior_em from public.visitas v cross join lateral (select max(x.data_realizada) feita_em from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'diagnostico' and x.situacao = 'realizada') a where v.situacao = 'realizada' and v.etapa = 'implantacao' and v.data_realizada < a.feita_em) q),
    $q$select v.id, v.uf, v.ficha_id, v.etapa, v.data_realizada, a.feita_em as etapa_anterior_em from public.visitas v cross join lateral (select max(x.data_realizada) feita_em from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'diagnostico' and x.situacao = 'realizada') a where v.situacao = 'realizada' and v.etapa = 'implantacao' and v.data_realizada < a.feita_em;$q$
  union all
  select 'E11', 'fora de ordem: acompanhamento ou avaliação final feitos antes da implantação',
    (select count(*) from (select v.id, v.uf, v.ficha_id, v.etapa, v.data_realizada, a.feita_em as etapa_anterior_em from public.visitas v cross join lateral (select max(x.data_realizada) feita_em from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'implantacao' and x.situacao = 'realizada') a where v.situacao = 'realizada' and v.etapa in ('acompanhamento','avaliacao') and v.data_realizada < a.feita_em) q),
    $q$select v.id, v.uf, v.ficha_id, v.etapa, v.data_realizada, a.feita_em as etapa_anterior_em from public.visitas v cross join lateral (select max(x.data_realizada) feita_em from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'implantacao' and x.situacao = 'realizada') a where v.situacao = 'realizada' and v.etapa in ('acompanhamento','avaliacao') and v.data_realizada < a.feita_em;$q$
  union all
  select 'E12', 'fora de ordem: fim antes do início (turma do FIC; desligamento antes da entrada na equipe; volta antes da ida)',
    (select count(*) from (select 'turmas_fic' tabela, id::text id from public.turmas_fic where fim < inicio union all select 'equipe', id::text from public.equipe where data_fim < data_inicio union all select 'pedidos_apoio', id::text from public.pedidos_apoio where tipo = 'passagem' and dados ->> 'volta' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and dados ->> 'volta' < data_ref::text) q),
    $q$select 'turmas_fic' tabela, id::text id from public.turmas_fic where fim < inicio union all select 'equipe', id::text from public.equipe where data_fim < data_inicio union all select 'pedidos_apoio', id::text from public.pedidos_apoio where tipo = 'passagem' and dados ->> 'volta' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and dados ->> 'volta' < data_ref::text;$q$
  union all
  select 'E13', 'fora de ordem: aprovado antes de criado (ficha e diagnóstico)',
    (select count(*) from (select 'fichas' tabela, id, criado_em, aprovada_em from public.fichas where aprovada_em < criado_em union all select 'diagnosticos', id, criado_em, aprovado_em from public.diagnosticos where aprovado_em < criado_em) q),
    $q$select 'fichas' tabela, id, criado_em, aprovada_em from public.fichas where aprovada_em < criado_em union all select 'diagnosticos', id, criado_em, aprovado_em from public.diagnosticos where aprovado_em < criado_em;$q$
  union all
  select 'E14', 'fora de ordem: alterado antes de criado (ficha, visita, diagnóstico, avaliação, equipe, turma)',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where atualizado_em < criado_em union all select 'visitas', id from public.visitas where atualizado_em < criado_em union all select 'diagnosticos', id from public.diagnosticos where atualizado_em < criado_em union all select 'avaliacoes', id from public.avaliacoes where atualizado_em < criado_em union all select 'equipe', id from public.equipe where atualizado_em < criado_em union all select 'turmas_fic', id from public.turmas_fic where atualizado_em < criado_em) q),
    $q$select 'fichas' tabela, id from public.fichas where atualizado_em < criado_em union all select 'visitas', id from public.visitas where atualizado_em < criado_em union all select 'diagnosticos', id from public.diagnosticos where atualizado_em < criado_em union all select 'avaliacoes', id from public.avaliacoes where atualizado_em < criado_em union all select 'equipe', id from public.equipe where atualizado_em < criado_em union all select 'turmas_fic', id from public.turmas_fic where atualizado_em < criado_em;$q$
  union all
  select 'E15', 'fora de ordem: pagamento com aval antes do pedido ou lançamento no Arlo antes do aval',
    (select count(*) from (select id, tipo, equipe_id, mes, solicitada_em, aval_em, arlo_em from public.solicitacoes_pagamento where aval_em < solicitada_em or arlo_em < aval_em) q),
    $q$select id, tipo, equipe_id, mes, solicitada_em, aval_em, arlo_em from public.solicitacoes_pagamento where aval_em < solicitada_em or arlo_em < aval_em;$q$
  union all
  select 'E16', 'fora de ordem: pedido de passagem/evento conferido ou decidido antes de enviado',
    (select count(*) from (select id, tipo, uf, situacao, enviado_em, conferido_em, decidido_em from public.pedidos_apoio where conferido_em < criado_em or decidido_em < criado_em or (situacao = 'autorizado' and decidido_em < conferido_em)) q),
    $q$select id, tipo, uf, situacao, enviado_em, conferido_em, decidido_em from public.pedidos_apoio where conferido_em < criado_em or decidido_em < criado_em or (situacao = 'autorizado' and decidido_em < conferido_em);$q$
  union all
  select 'E17', 'data inválida: registro com data de criação no futuro (relógio)',
    (select count(*) from (select 'fichas' tabela, id::text id, criado_em from public.fichas where criado_em > now() + interval '5 minutes' union all select 'visitas', id::text, criado_em from public.visitas where criado_em > now() + interval '5 minutes' union all select 'diagnosticos', id::text, criado_em from public.diagnosticos where criado_em > now() + interval '5 minutes' union all select 'equipe', id::text, criado_em from public.equipe where criado_em > now() + interval '5 minutes' union all select 'solicitacoes_pagamento', id::text, solicitada_em from public.solicitacoes_pagamento where solicitada_em > now() + interval '5 minutes' union all select 'auditoria', id::text, em from public.auditoria where em > now() + interval '5 minutes') q),
    $q$select 'fichas' tabela, id::text id, criado_em from public.fichas where criado_em > now() + interval '5 minutes' union all select 'visitas', id::text, criado_em from public.visitas where criado_em > now() + interval '5 minutes' union all select 'diagnosticos', id::text, criado_em from public.diagnosticos where criado_em > now() + interval '5 minutes' union all select 'equipe', id::text, criado_em from public.equipe where criado_em > now() + interval '5 minutes' union all select 'solicitacoes_pagamento', id::text, solicitada_em from public.solicitacoes_pagamento where solicitada_em > now() + interval '5 minutes' union all select 'auditoria', id::text, em from public.auditoria where em > now() + interval '5 minutes';$q$
  union all
  select 'E18', 'data inválida: equipe com início antes de 01/01/2025 ou mais de um ano à frente; desligamento no futuro',
    (select count(*) from (select id, papel, uf, status, data_inicio, data_fim from public.equipe where data_inicio < date '2025-01-01' or data_inicio > (now() at time zone 'America/Fortaleza')::date + 365 or data_fim > (now() at time zone 'America/Fortaleza')::date) q),
    $q$select id, papel, uf, status, data_inicio, data_fim from public.equipe where data_inicio < date '2025-01-01' or data_inicio > (now() at time zone 'America/Fortaleza')::date + 365 or data_fim > (now() at time zone 'America/Fortaleza')::date;$q$
  union all
  select 'E19', 'data inválida: passos da habilitação (matrícula no FIC, Arlo, termo) no futuro ou antes de 01/01/2025',
    (select count(*) from (select id, papel, uf, matricula_fic_em, docs_funcern_em, termo_assinado_em from public.equipe where matricula_fic_em > (now() at time zone 'America/Fortaleza')::date or matricula_fic_em < date '2025-01-01' or docs_funcern_em > (now() at time zone 'America/Fortaleza')::date or docs_funcern_em < date '2025-01-01' or termo_assinado_em > (now() at time zone 'America/Fortaleza')::date or termo_assinado_em < date '2025-01-01') q),
    $q$select id, papel, uf, matricula_fic_em, docs_funcern_em, termo_assinado_em from public.equipe where matricula_fic_em > (now() at time zone 'America/Fortaleza')::date or matricula_fic_em < date '2025-01-01' or docs_funcern_em > (now() at time zone 'America/Fortaleza')::date or docs_funcern_em < date '2025-01-01' or termo_assinado_em > (now() at time zone 'America/Fortaleza')::date or termo_assinado_em < date '2025-01-01';$q$
  union all
  select 'E20', 'data inválida: matrícula no FIC no futuro ou antes do início da turma',
    (select count(*) from (select m.id, m.equipe_id, m.matriculado_em, t.inicio from public.matriculas_fic m join public.turmas_fic t on t.id = m.turma_id where m.matriculado_em > (now() at time zone 'America/Fortaleza')::date or (m.cancelada_em is null and m.matriculado_em < t.inicio)) q),
    $q$select m.id, m.equipe_id, m.matriculado_em, t.inicio from public.matriculas_fic m join public.turmas_fic t on t.id = m.turma_id where m.matriculado_em > (now() at time zone 'America/Fortaleza')::date or (m.cancelada_em is null and m.matriculado_em < t.inicio);$q$
  union all
  select 'E21', 'data inválida: turma do FIC com início ou fim fora de 01/01/2026 a 31/12/2027',
    (select count(*) from (select id, nome, inicio, fim from public.turmas_fic where inicio not between date '2026-01-01' and date '2027-12-31' or fim not between date '2026-01-01' and date '2027-12-31') q),
    $q$select id, nome, inicio, fim from public.turmas_fic where inicio not between date '2026-01-01' and date '2027-12-31' or fim not between date '2026-01-01' and date '2027-12-31';$q$
  union all
  select 'E22', 'data inválida: encontro do FIC no futuro ou antes de 01/09/2026',
    (select count(*) from (select id, turma_id, data from public.fic_encontros where data > (now() at time zone 'America/Fortaleza')::date or data < date '2026-09-01') q),
    $q$select id, turma_id, data from public.fic_encontros where data > (now() at time zone 'America/Fortaleza')::date or data < date '2026-09-01';$q$
  union all
  select 'E23', 'data inválida: mês de entrega ou de pagamento que não é dia 1º, está no futuro ou é anterior à entrada da pessoa',
    (select count(*) from (select 'entregas_mes' tabela, x.equipe_id, x.mes from public.entregas_mes x join public.equipe p on p.id = x.equipe_id where extract(day from x.mes) <> 1 or x.mes > date_trunc('month', (now() at time zone 'America/Fortaleza')::date)::date or x.mes < date_trunc('month', p.data_inicio)::date union all select 'solicitacoes_pagamento', x.equipe_id, x.mes from public.solicitacoes_pagamento x join public.equipe p on p.id = x.equipe_id where extract(day from x.mes) <> 1 or x.mes > date_trunc('month', (now() at time zone 'America/Fortaleza')::date)::date or x.mes < date_trunc('month', p.data_inicio)::date) q),
    $q$select 'entregas_mes' tabela, x.equipe_id, x.mes from public.entregas_mes x join public.equipe p on p.id = x.equipe_id where extract(day from x.mes) <> 1 or x.mes > date_trunc('month', (now() at time zone 'America/Fortaleza')::date)::date or x.mes < date_trunc('month', p.data_inicio)::date union all select 'solicitacoes_pagamento', x.equipe_id, x.mes from public.solicitacoes_pagamento x join public.equipe p on p.id = x.equipe_id where extract(day from x.mes) <> 1 or x.mes > date_trunc('month', (now() at time zone 'America/Fortaleza')::date)::date or x.mes < date_trunc('month', p.data_inicio)::date;$q$
  union all
  select 'E24', 'data inválida: marcação de acesso ao AVA em mês anterior ao da matrícula no FIC',
    (select count(*) from (select x.equipe_id, x.mes, p.matricula_fic_em from public.entregas_mes x join public.equipe p on p.id = x.equipe_id where x.item = 'ava' and (p.matricula_fic_em is null or x.mes < date_trunc('month', p.matricula_fic_em)::date)) q),
    $q$select x.equipe_id, x.mes, p.matricula_fic_em from public.entregas_mes x join public.equipe p on p.id = x.equipe_id where x.item = 'ava' and (p.matricula_fic_em is null or x.mes < date_trunc('month', p.matricula_fic_em)::date);$q$
  union all
  select 'E25', 'data inválida: documento com data antes de 01/01/2025 ou mais de um ano à frente; planilha ou lançamento financeiro fora do período',
    (select count(*) from (select 'documentos_projeto' tabela, id, data_documento from public.documentos_projeto where data_documento < date '2025-01-01' or data_documento > (now() at time zone 'America/Fortaleza')::date + 365 union all select 'execucao_planilhas', id, posicao_em from public.execucao_planilhas where posicao_em > (now() at time zone 'America/Fortaleza')::date or posicao_em < date '2026-01-01' union all select 'execucao_lancamentos', id, data from public.execucao_lancamentos where data > (now() at time zone 'America/Fortaleza')::date or data < date '2026-01-01' or data > date '2028-12-31') q),
    $q$select 'documentos_projeto' tabela, id, data_documento from public.documentos_projeto where data_documento < date '2025-01-01' or data_documento > (now() at time zone 'America/Fortaleza')::date + 365 union all select 'execucao_planilhas', id, posicao_em from public.execucao_planilhas where posicao_em > (now() at time zone 'America/Fortaleza')::date or posicao_em < date '2026-01-01' union all select 'execucao_lancamentos', id, data from public.execucao_lancamentos where data > (now() at time zone 'America/Fortaleza')::date or data < date '2026-01-01' or data > date '2028-12-31';$q$
  union all
  select 'E26', 'data inválida: pedido de passagem/evento com data depois do fim do projeto (30/09/2027) ou nascimento de passageira que não é data',
    (select count(*) from (select p.id, p.tipo, p.uf, p.data_ref from public.pedidos_apoio p where p.data_ref > date '2027-09-30' or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p.dados -> 'passageiros') = 'array' then p.dados -> 'passageiros' else '[]'::jsonb end) x where not (case when coalesce(x ->> 'nascimento', '') ~ '^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then substr(x ->> 'nascimento', 9, 2)::int <= extract(day from (make_date(substr(x ->> 'nascimento', 1, 4)::int, substr(x ->> 'nascimento', 6, 2)::int, 1) + interval '1 month' - interval '1 day')) else false end))) q),
    $q$select p.id, p.tipo, p.uf, p.data_ref from public.pedidos_apoio p where p.data_ref > date '2027-09-30' or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p.dados -> 'passageiros') = 'array' then p.dados -> 'passageiros' else '[]'::jsonb end) x where not (case when coalesce(x ->> 'nascimento', '') ~ '^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then substr(x ->> 'nascimento', 9, 2)::int <= extract(day from (make_date(substr(x ->> 'nascimento', 1, 4)::int, substr(x ->> 'nascimento', 6, 2)::int, 1) + interval '1 month' - interval '1 day')) else false end));$q$
  union all
  select 'E27', 'fora de ordem: link de cadastro usado depois de vencido, ou usado/cancelado antes de criado',
    (select count(*) from (select id, papel, uf, criado_em, expira_em, usado_em, cancelado_em from public.convites where usado_em > expira_em or usado_em < criado_em or cancelado_em < criado_em or expira_em < criado_em) q),
    $q$select id, papel, uf, criado_em, expira_em, usado_em, cancelado_em from public.convites where usado_em > expira_em or usado_em < criado_em or cancelado_em < criado_em or expira_em < criado_em;$q$
  union all
  select 'E28', 'fora de ordem: matrícula cancelada antes de criada; encontro cancelado antes de criado; presença confirmada antes de marcada',
    (select count(*) from (select 'matriculas_fic' tabela, id from public.matriculas_fic where cancelada_em < criado_em union all select 'fic_encontros', id from public.fic_encontros where cancelado_em < criado_em union all select 'fic_presencas', id from public.fic_presencas where confirmado_em < marcado_em - interval '1 minute') q),
    $q$select 'matriculas_fic' tabela, id from public.matriculas_fic where cancelada_em < criado_em union all select 'fic_encontros', id from public.fic_encontros where cancelado_em < criado_em union all select 'fic_presencas', id from public.fic_presencas where confirmado_em < marcado_em - interval '1 minute';$q$
  union all
  select 'F01', 'incoerência: ficha APROVADA sem quem aprovou ou sem a data da aprovação',
    (select count(*) from (select id, uf, aprovada_por, aprovada_em from public.fichas where situacao = 'aprovada' and (aprovada_por is null or aprovada_em is null)) q),
    $q$select id, uf, aprovada_por, aprovada_em from public.fichas where situacao = 'aprovada' and (aprovada_por is null or aprovada_em is null);$q$
  union all
  select 'F02', 'incoerência: ficha NÃO aprovada com quem aprovou ou data de aprovação preenchidos',
    (select count(*) from (select id, uf, situacao, aprovada_por, aprovada_em from public.fichas where situacao <> 'aprovada' and (aprovada_por is not null or aprovada_em is not null)) q),
    $q$select id, uf, situacao, aprovada_por, aprovada_em from public.fichas where situacao <> 'aprovada' and (aprovada_por is not null or aprovada_em is not null);$q$
  union all
  select 'F03', 'incoerência: ficha DEVOLVIDA sem dizer o que corrigir',
    (select count(*) from (select id, uf from public.fichas where situacao = 'devolvida' and length(trim(coalesce(obs_coordenacao, ''))) < 5) q),
    $q$select id, uf from public.fichas where situacao = 'devolvida' and length(trim(coalesce(obs_coordenacao, ''))) < 5;$q$
  union all
  select 'F04', 'incoerência: selecionada (ou outro resultado) com posição na lista de espera',
    (select count(*) from (select id, uf, resultado, posicao_espera from public.fichas where resultado <> 'lista_espera' and posicao_espera is not null) q),
    $q$select id, uf, resultado, posicao_espera from public.fichas where resultado <> 'lista_espera' and posicao_espera is not null;$q$
  union all
  select 'F05', 'incoerência: selecionada ou em lista de espera sem todos os critérios obrigatórios e a autodeclaração',
    (select count(*) from (select id, uf, resultado from public.fichas where resultado in ('selecionada','lista_espera') and not (c_agricultora and c_maior18 and c_espaco and c_agua and c_disponibilidade and c_sem_kit and c_sem_parentesco and c_casa_unica and autodeclaracao)) q),
    $q$select id, uf, resultado from public.fichas where resultado in ('selecionada','lista_espera') and not (c_agricultora and c_maior18 and c_espaco and c_agua and c_disponibilidade and c_sem_kit and c_sem_parentesco and c_casa_unica and autodeclaracao);$q$
  union all
  select 'F06', 'incoerência: resultado ''sem água'' com o critério da água marcado ou sem dizer para onde foi encaminhada',
    (select count(*) from (select id, uf, c_agua, encaminhada_para from public.fichas where resultado = 'sem_agua' and (c_agua or length(trim(coalesce(encaminhada_para, ''))) < 3)) q),
    $q$select id, uf, c_agua, encaminhada_para from public.fichas where resultado = 'sem_agua' and (c_agua or length(trim(coalesce(encaminhada_para, ''))) < 3);$q$
  union all
  select 'F07', 'incoerência: resultado ''não atende'' com todos os critérios obrigatórios marcados',
    (select count(*) from (select id, uf from public.fichas where resultado = 'nao_atende' and c_agricultora and c_maior18 and c_espaco and c_agua and c_disponibilidade and c_sem_kit and c_sem_parentesco and c_casa_unica and autodeclaracao) q),
    $q$select id, uf from public.fichas where resultado = 'nao_atende' and c_agricultora and c_maior18 and c_espaco and c_agua and c_disponibilidade and c_sem_kit and c_sem_parentesco and c_casa_unica and autodeclaracao;$q$
  union all
  select 'F08', 'incoerência: assinatura por digital sem testemunha, ou testemunha com o CPF da própria mulher',
    (select count(*) from (select id, uf, assinatura from public.fichas where (assinatura = 'digital' and (length(trim(coalesce(testemunha_nome, ''))) < 5 or testemunha_cpf is null)) or testemunha_cpf = cpf) q),
    $q$select id, uf, assinatura from public.fichas where (assinatura = 'digital' and (length(trim(coalesce(testemunha_nome, ''))) < 5 or testemunha_cpf is null)) or testemunha_cpf = cpf;$q$
  union all
  select 'F09', 'incoerência: visita REALIZADA sem a data em que foi feita',
    (select count(*) from (select id, uf, etapa from public.visitas where situacao = 'realizada' and data_realizada is null) q),
    $q$select id, uf, etapa from public.visitas where situacao = 'realizada' and data_realizada is null;$q$
  union all
  select 'F10', 'incoerência: visita NÃO realizada com data de ''feita'' preenchida',
    (select count(*) from (select id, uf, etapa, situacao, data_realizada from public.visitas where situacao <> 'realizada' and data_realizada is not null) q),
    $q$select id, uf, etapa, situacao, data_realizada from public.visitas where situacao <> 'realizada' and data_realizada is not null;$q$
  union all
  select 'F11', 'incoerência: pessoa DESLIGADA sem data de saída ou sem motivo',
    (select count(*) from (select id, papel, uf, data_fim from public.equipe where status = 'desligada' and (data_fim is null or length(trim(coalesce(motivo_desligamento, ''))) < 5)) q),
    $q$select id, papel, uf, data_fim from public.equipe where status = 'desligada' and (data_fim is null or length(trim(coalesce(motivo_desligamento, ''))) < 5);$q$
  union all
  select 'F12', 'incoerência: pessoa ATIVA com data de saída ou motivo de desligamento',
    (select count(*) from (select id, papel, uf, data_fim from public.equipe where status = 'ativa' and (data_fim is not null or motivo_desligamento is not null)) q),
    $q$select id, papel, uf, data_fim from public.equipe where status = 'ativa' and (data_fim is not null or motivo_desligamento is not null);$q$
  union all
  select 'F13', 'incoerência: estado da pessoa não combina com a função (bolsista e agente com estado; coordenação, professor e auxiliar sem)',
    (select count(*) from (select id, papel, uf from public.equipe where (papel in ('articulacao','apoio','agente')) <> (uf is not null)) q),
    $q$select id, papel, uf from public.equipe where (papel in ('articulacao','apoio','agente')) <> (uf is not null);$q$
  union all
  select 'F14', 'incoerência: diagnóstico SEM água com lote ou mês de implantação; ou COM água sem lote',
    (select count(*) from (select id, uf, sem_agua, lote, mes_implantacao from public.diagnosticos where (sem_agua and (lote is not null or mes_implantacao is not null)) or (not sem_agua and lote is null)) q),
    $q$select id, uf, sem_agua, lote, mes_implantacao from public.diagnosticos where (sem_agua and (lote is not null or mes_implantacao is not null)) or (not sem_agua and lote is null);$q$
  union all
  select 'F15', 'incoerência: diagnóstico marcado ''sem água'' sem que as respostas digam isso (água falta na seca ou só carro-pipa), ou o contrário',
    (select count(*) from (select id, uf, sem_agua, agua_seca from public.diagnosticos where (agua_seca = 'nao' and not sem_agua) or (sem_agua and agua_seca <> 'nao' and not coalesce(jsonb_typeof(dados -> 'fontes_agua') = 'array' and jsonb_array_length(case when jsonb_typeof(dados -> 'fontes_agua') = 'array' then dados -> 'fontes_agua' else '[]'::jsonb end) > 0 and not exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(dados -> 'fontes_agua') = 'array' then dados -> 'fontes_agua' else '[]'::jsonb end) x where x <> 'carro_pipa'), false))) q),
    $q$select id, uf, sem_agua, agua_seca from public.diagnosticos where (agua_seca = 'nao' and not sem_agua) or (sem_agua and agua_seca <> 'nao' and not coalesce(jsonb_typeof(dados -> 'fontes_agua') = 'array' and jsonb_array_length(case when jsonb_typeof(dados -> 'fontes_agua') = 'array' then dados -> 'fontes_agua' else '[]'::jsonb end) > 0 and not exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(dados -> 'fontes_agua') = 'array' then dados -> 'fontes_agua' else '[]'::jsonb end) x where x <> 'carro_pipa'), false));$q$
  union all
  select 'F16', 'incoerência: diagnóstico APROVADO sem quem aprovou ou sem data; não aprovado com esses campos',
    (select count(*) from (select id, uf, situacao, aprovado_por, aprovado_em from public.diagnosticos where (situacao = 'aprovado' and (aprovado_por is null or aprovado_em is null)) or (situacao <> 'aprovado' and (aprovado_por is not null or aprovado_em is not null))) q),
    $q$select id, uf, situacao, aprovado_por, aprovado_em from public.diagnosticos where (situacao = 'aprovado' and (aprovado_por is null or aprovado_em is null)) or (situacao <> 'aprovado' and (aprovado_por is not null or aprovado_em is not null));$q$
  union all
  select 'F17', 'incoerência: diagnóstico DEVOLVIDO sem dizer o que corrigir',
    (select count(*) from (select id, uf from public.diagnosticos where situacao = 'devolvido' and length(trim(coalesce(obs_coordenacao, ''))) < 5) q),
    $q$select id, uf from public.diagnosticos where situacao = 'devolvido' and length(trim(coalesce(obs_coordenacao, ''))) < 5;$q$
  union all
  select 'F18', 'incoerência: pagamento AVALIZADO ou LANÇADO sem quem deu o aval, sem data ou sem valor do aval',
    (select count(*) from (select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where situacao in ('avalizada','lancada') and (aval_por is null or aval_em is null or valor_avalizado is null)) q),
    $q$select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where situacao in ('avalizada','lancada') and (aval_por is null or aval_em is null or valor_avalizado is null);$q$
  union all
  select 'F19', 'incoerência: pagamento LANÇADO sem quem lançou ou sem data; não lançado com esses campos',
    (select count(*) from (select id, tipo, equipe_id, mes, situacao, arlo_por, arlo_em from public.solicitacoes_pagamento where (situacao = 'lancada' and (arlo_por is null or arlo_em is null)) or (situacao <> 'lancada' and (arlo_por is not null or arlo_em is not null or arlo_protocolo is not null))) q),
    $q$select id, tipo, equipe_id, mes, situacao, arlo_por, arlo_em from public.solicitacoes_pagamento where (situacao = 'lancada' and (arlo_por is null or arlo_em is null)) or (situacao <> 'lancada' and (arlo_por is not null or arlo_em is not null or arlo_protocolo is not null));$q$
  union all
  select 'F20', 'incoerência: pagamento SOLICITADO (esperando aval) com aval já preenchido; DEVOLVIDO sem motivo',
    (select count(*) from (select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where (situacao = 'solicitada' and (aval_por is not null or valor_avalizado is not null)) or (situacao = 'devolvida' and length(trim(coalesce(obs_aval, ''))) < 5)) q),
    $q$select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where (situacao = 'solicitada' and (aval_por is not null or valor_avalizado is not null)) or (situacao = 'devolvida' and length(trim(coalesce(obs_aval, ''))) < 5);$q$
  union all
  select 'F21', 'incoerência: aval dado pela própria pessoa que pediu, ou lançamento feito pela própria pessoa',
    (select count(*) from (select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where aval_por = equipe_id or arlo_por = equipe_id) q),
    $q$select id, tipo, equipe_id, mes, situacao from public.solicitacoes_pagamento where aval_por = equipe_id or arlo_por = equipe_id;$q$
  union all
  select 'F22', 'incoerência: pedido de passagem/evento CONFERIDO ou AUTORIZADO sem quem conferiu; AUTORIZADO sem quem autorizou ou sem valor',
    (select count(*) from (select id, tipo, uf, situacao from public.pedidos_apoio where (situacao in ('conferido','autorizado') and (conferido_por is null or conferido_em is null)) or (situacao = 'autorizado' and (decidido_por is null or decidido_em is null or valor_autorizado is null))) q),
    $q$select id, tipo, uf, situacao from public.pedidos_apoio where (situacao in ('conferido','autorizado') and (conferido_por is null or conferido_em is null)) or (situacao = 'autorizado' and (decidido_por is null or decidido_em is null or valor_autorizado is null));$q$
  union all
  select 'F23', 'incoerência: pedido DEVOLVIDO ou RECUSADO sem motivo; pedido não autorizado com protocolo da FUNCERN',
    (select count(*) from (select id, tipo, uf, situacao from public.pedidos_apoio where (situacao in ('devolvido','recusado') and length(trim(coalesce(obs, ''))) < 5) or (situacao <> 'autorizado' and funcern_protocolo is not null)) q),
    $q$select id, tipo, uf, situacao from public.pedidos_apoio where (situacao in ('devolvido','recusado') and length(trim(coalesce(obs, ''))) < 5) or (situacao <> 'autorizado' and funcern_protocolo is not null);$q$
  union all
  select 'F24', 'incoerência: pedido de passagem/evento conferido pela própria solicitante',
    (select count(*) from (select id, tipo, uf, situacao from public.pedidos_apoio where conferido_por = solicitante_id) q),
    $q$select id, tipo, uf, situacao from public.pedidos_apoio where conferido_por = solicitante_id;$q$
  union all
  select 'F25', 'incoerência: matrícula CANCELADA sem motivo; encontro CANCELADO sem motivo ou sem quem cancelou',
    (select count(*) from (select 'matriculas_fic' tabela, id from public.matriculas_fic where cancelada_em is not null and length(trim(coalesce(motivo_cancelamento, ''))) < 5 union all select 'fic_encontros', id from public.fic_encontros where (cancelado_em is not null and (cancelado_por is null or length(trim(coalesce(motivo_cancelamento, ''))) < 10)) or (cancelado_em is null and (cancelado_por is not null or motivo_cancelamento is not null))) q),
    $q$select 'matriculas_fic' tabela, id from public.matriculas_fic where cancelada_em is not null and length(trim(coalesce(motivo_cancelamento, ''))) < 5 union all select 'fic_encontros', id from public.fic_encontros where (cancelado_em is not null and (cancelado_por is null or length(trim(coalesce(motivo_cancelamento, ''))) < 10)) or (cancelado_em is null and (cancelado_por is not null or motivo_cancelamento is not null));$q$
  union all
  select 'F26', 'incoerência: presença confirmada pela pessoa mas marcada como ausente',
    (select count(*) from (select id, encontro_id, equipe_id from public.fic_presencas where confirmado_em is not null and not presente) q),
    $q$select id, encontro_id, equipe_id from public.fic_presencas where confirmado_em is not null and not presente;$q$
  union all
  select 'F27', 'incoerência: documento ARQUIVADO sem motivo ou sem quem arquivou; não arquivado com esses campos',
    (select count(*) from (select id, tipo, data_documento from public.documentos_projeto where (arquivado_em is not null and (arquivado_por is null or length(trim(coalesce(motivo_arquivo, ''))) < 5)) or (arquivado_em is null and (arquivado_por is not null or motivo_arquivo is not null))) q),
    $q$select id, tipo, data_documento from public.documentos_projeto where (arquivado_em is not null and (arquivado_por is null or length(trim(coalesce(motivo_arquivo, ''))) < 5)) or (arquivado_em is null and (arquivado_por is not null or motivo_arquivo is not null));$q$
  union all
  select 'F28', 'incoerência: pré-cadastro APROVADO sem a pessoa criada na equipe; RECUSADO sem motivo; decidido sem quem decidiu',
    (select count(*) from (select id, papel, uf, situacao from public.pre_cadastros where (situacao = 'aprovado' and equipe_id is null) or (situacao = 'recusado' and length(trim(coalesce(obs, ''))) < 5) or (situacao <> 'aguardando' and decidido_em is null) or (situacao = 'aguardando' and (decidido_em is not null or equipe_id is not null))) q),
    $q$select id, papel, uf, situacao from public.pre_cadastros where (situacao = 'aprovado' and equipe_id is null) or (situacao = 'recusado' and length(trim(coalesce(obs, ''))) < 5) or (situacao <> 'aguardando' and decidido_em is null) or (situacao = 'aguardando' and (decidido_em is not null or equipe_id is not null));$q$
  union all
  select 'F29', 'incoerência: link de cadastro marcado como usado sem pré-cadastro, ou pré-cadastro de link não marcado como usado',
    (select count(*) from (select c.id, c.papel, c.uf, c.usado_em, p.id pre_cadastro from public.convites c full join public.pre_cadastros p on p.convite_id = c.id where (c.usado_em is not null and p.id is null) or (p.id is not null and c.usado_em is null)) q),
    $q$select c.id, c.papel, c.uf, c.usado_em, p.id pre_cadastro from public.convites c full join public.pre_cadastros p on p.convite_id = c.id where (c.usado_em is not null and p.id is null) or (p.id is not null and c.usado_em is null);$q$
  union all
  select 'F30', 'incoerência: link de cadastro com estado que não combina com a função',
    (select count(*) from (select id, papel, uf from public.convites where (papel in ('coord_tecnico','professor_fic','auxiliar_adm')) <> (uf is null)) q),
    $q$select id, papel, uf from public.convites where (papel in ('coord_tecnico','professor_fic','auxiliar_adm')) <> (uf is null);$q$
  union all
  select 'F31', 'incoerência: pedido de novo acesso resolvido sem data; aguardando com data de resolução',
    (select count(*) from (select id, equipe_id, situacao from public.pedidos_novo_acesso where (situacao <> 'aguardando' and resolvido_em is null) or (situacao = 'aguardando' and resolvido_em is not null)) q),
    $q$select id, equipe_id, situacao from public.pedidos_novo_acesso where (situacao <> 'aguardando' and resolvido_em is null) or (situacao = 'aguardando' and resolvido_em is not null);$q$
  union all
  select 'F32', 'incoerência: matrícula do cadastro (equipe) diferente da matrícula ativa na turma (data ou número)',
    (select count(*) from (select e.id, e.papel, e.uf, e.matricula_fic_em, e.matricula_fic_numero, m.matriculado_em, m.numero from public.equipe e full join (select * from public.matriculas_fic where cancelada_em is null) m on m.equipe_id = e.id where e.status = 'ativa' and (e.matricula_fic_em is not null or m.id is not null) and (e.matricula_fic_em is distinct from m.matriculado_em or lower(trim(coalesce(e.matricula_fic_numero, ''))) is distinct from lower(trim(coalesce(m.numero, ''))))) q),
    $q$select e.id, e.papel, e.uf, e.matricula_fic_em, e.matricula_fic_numero, m.matriculado_em, m.numero from public.equipe e full join (select * from public.matriculas_fic where cancelada_em is null) m on m.equipe_id = e.id where e.status = 'ativa' and (e.matricula_fic_em is not null or m.id is not null) and (e.matricula_fic_em is distinct from m.matriculado_em or lower(trim(coalesce(e.matricula_fic_numero, ''))) is distinct from lower(trim(coalesce(m.numero, ''))));$q$
  union all
  select 'F33', 'incoerência: professor do FIC, auxiliar ou coordenação geral com matrícula no FIC',
    (select count(*) from (select id, papel, matricula_fic_em from public.equipe where papel in ('professor_fic','auxiliar_adm','coord_geral') and (matricula_fic_em is not null or matricula_fic_numero is not null)) q),
    $q$select id, papel, matricula_fic_em from public.equipe where papel in ('professor_fic','auxiliar_adm','coord_geral') and (matricula_fic_em is not null or matricula_fic_numero is not null);$q$
  union all
  select 'F34', 'incoerência: estrutura do JSON fora do esperado (dados, detalhe, endereço, kit, linhas da planilha, parâmetros)',
    (select count(*) from (select 'diagnosticos.dados' onde, id::text id from public.diagnosticos where jsonb_typeof(dados) <> 'object' or (dados ? 'kit' and jsonb_typeof(dados -> 'kit') not in ('array','null')) or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(dados -> 'kit') = 'array' then dados -> 'kit' else '[]'::jsonb end) i where jsonb_typeof(i) <> 'object') union all select 'avaliacoes.dados', id::text from public.avaliacoes where jsonb_typeof(dados) <> 'object' union all select 'orientacoes_venda.dados', id::text from public.orientacoes_venda where jsonb_typeof(dados) <> 'object' or jsonb_typeof(dados -> 'sobra') is distinct from 'array' or coalesce(dados ->> 'caf', '') not in ('sim','nao','nao_sabe') union all select 'solicitacoes_pagamento.detalhe', id::text from public.solicitacoes_pagamento where jsonb_typeof(detalhe) <> 'object' or (detalhe ? 'visitas' and jsonb_typeof(detalhe -> 'visitas') <> 'array') union all select 'pedidos_apoio.dados', id::text from public.pedidos_apoio where jsonb_typeof(dados) <> 'object' or (dados ? 'passageiros' and jsonb_typeof(dados -> 'passageiros') <> 'array') union all select 'equipe_privado', equipe_id::text from public.equipe_privado where jsonb_typeof(endereco) <> 'object' or (socioeconomico is not null and jsonb_typeof(socioeconomico) not in ('object','null')) or (perfil is not null and jsonb_typeof(perfil) not in ('object','null')) union all select 'pre_cadastros', id::text from public.pre_cadastros where jsonb_typeof(endereco) <> 'object' or (socioeconomico is not null and jsonb_typeof(socioeconomico) not in ('object','null')) or (perfil is not null and jsonb_typeof(perfil) not in ('object','null')) union all select 'execucao_planilhas.linhas', id::text from public.execucao_planilhas where jsonb_typeof(linhas) <> 'array' or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(linhas) = 'array' then linhas else '[]'::jsonb end) l where jsonb_typeof(l) <> 'object') union all select 'parametros.custo_visita', chave from public.parametros where chave = 'custo_visita' and jsonb_typeof(valor) <> 'object') q),
    $q$select 'diagnosticos.dados' onde, id::text id from public.diagnosticos where jsonb_typeof(dados) <> 'object' or (dados ? 'kit' and jsonb_typeof(dados -> 'kit') not in ('array','null')) or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(dados -> 'kit') = 'array' then dados -> 'kit' else '[]'::jsonb end) i where jsonb_typeof(i) <> 'object') union all select 'avaliacoes.dados', id::text from public.avaliacoes where jsonb_typeof(dados) <> 'object' union all select 'orientacoes_venda.dados', id::text from public.orientacoes_venda where jsonb_typeof(dados) <> 'object' or jsonb_typeof(dados -> 'sobra') is distinct from 'array' or coalesce(dados ->> 'caf', '') not in ('sim','nao','nao_sabe') union all select 'solicitacoes_pagamento.detalhe', id::text from public.solicitacoes_pagamento where jsonb_typeof(detalhe) <> 'object' or (detalhe ? 'visitas' and jsonb_typeof(detalhe -> 'visitas') <> 'array') union all select 'pedidos_apoio.dados', id::text from public.pedidos_apoio where jsonb_typeof(dados) <> 'object' or (dados ? 'passageiros' and jsonb_typeof(dados -> 'passageiros') <> 'array') union all select 'equipe_privado', equipe_id::text from public.equipe_privado where jsonb_typeof(endereco) <> 'object' or (socioeconomico is not null and jsonb_typeof(socioeconomico) not in ('object','null')) or (perfil is not null and jsonb_typeof(perfil) not in ('object','null')) union all select 'pre_cadastros', id::text from public.pre_cadastros where jsonb_typeof(endereco) <> 'object' or (socioeconomico is not null and jsonb_typeof(socioeconomico) not in ('object','null')) or (perfil is not null and jsonb_typeof(perfil) not in ('object','null')) union all select 'execucao_planilhas.linhas', id::text from public.execucao_planilhas where jsonb_typeof(linhas) <> 'array' or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(linhas) = 'array' then linhas else '[]'::jsonb end) l where jsonb_typeof(l) <> 'object') union all select 'parametros.custo_visita', chave from public.parametros where chave = 'custo_visita' and jsonb_typeof(valor) <> 'object';$q$
  union all
  select 'F35', 'incoerência: passageira de pedido de passagem sem nome, CPF de 11 números, RG ou nascimento; ou a mesma pessoa duas vezes',
    (select count(*) from (select p.id, p.uf, p.situacao from public.pedidos_apoio p where p.tipo = 'passagem' and jsonb_typeof(p.dados -> 'passageiros') = 'array' and (exists (select 1 from jsonb_array_elements(p.dados -> 'passageiros') x where regexp_replace(coalesce(x ->> 'cpf', ''), '\D', '', 'g') !~ '^[0-9]{11}$' or length(trim(coalesce(x ->> 'nome', ''))) < 5 or coalesce(x ->> 'rg', '') = '' or coalesce(x ->> 'nascimento', '') = '') or (select count(*) from jsonb_array_elements(p.dados -> 'passageiros') x) <> (select count(distinct regexp_replace(coalesce(x ->> 'cpf', ''), '\D', '', 'g')) from jsonb_array_elements(p.dados -> 'passageiros') x))) q),
    $q$select p.id, p.uf, p.situacao from public.pedidos_apoio p where p.tipo = 'passagem' and jsonb_typeof(p.dados -> 'passageiros') = 'array' and (exists (select 1 from jsonb_array_elements(p.dados -> 'passageiros') x where regexp_replace(coalesce(x ->> 'cpf', ''), '\D', '', 'g') !~ '^[0-9]{11}$' or length(trim(coalesce(x ->> 'nome', ''))) < 5 or coalesce(x ->> 'rg', '') = '' or coalesce(x ->> 'nascimento', '') = '') or (select count(*) from jsonb_array_elements(p.dados -> 'passageiros') x) <> (select count(distinct regexp_replace(coalesce(x ->> 'cpf', ''), '\D', '', 'g')) from jsonb_array_elements(p.dados -> 'passageiros') x));$q$
  union all
  select 'G01', 'entre tabelas: estado da visita diferente do estado da ficha',
    (select count(*) from (select v.id, v.uf uf_visita, f.uf uf_ficha, v.etapa, v.situacao from public.visitas v join public.fichas f on f.id = v.ficha_id where v.uf <> f.uf) q),
    $q$select v.id, v.uf uf_visita, f.uf uf_ficha, v.etapa, v.situacao from public.visitas v join public.fichas f on f.id = v.ficha_id where v.uf <> f.uf;$q$
  union all
  select 'G02', 'entre tabelas: estado do diagnóstico, da avaliação, da orientação de venda ou da foto da vitrine diferente do estado da ficha',
    (select count(*) from (select 'diagnosticos' tabela, x.id, x.uf uf_registro, f.uf uf_ficha from public.diagnosticos x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf union all select 'avaliacoes', x.id, x.uf, f.uf from public.avaliacoes x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf union all select 'orientacoes_venda', x.id, x.uf, f.uf from public.orientacoes_venda x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf union all select 'vitrine_fotos', x.id, x.uf, f.uf from public.vitrine_fotos x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf) q),
    $q$select 'diagnosticos' tabela, x.id, x.uf uf_registro, f.uf uf_ficha from public.diagnosticos x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf union all select 'avaliacoes', x.id, x.uf, f.uf from public.avaliacoes x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf union all select 'orientacoes_venda', x.id, x.uf, f.uf from public.orientacoes_venda x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf union all select 'vitrine_fotos', x.id, x.uf, f.uf from public.vitrine_fotos x join public.fichas f on f.id = x.ficha_id where x.uf <> f.uf;$q$
  union all
  select 'G03', 'entre tabelas: visita (não cancelada) com quem faz de outro estado ou que não é bolsista/agente',
    (select count(*) from (select v.id, v.uf, v.etapa, v.situacao, e.papel, e.uf uf_pessoa from public.visitas v join public.equipe e on e.id = v.executor_id where v.situacao <> 'cancelada' and (e.uf is distinct from v.uf or e.papel not in ('articulacao','apoio','agente'))) q),
    $q$select v.id, v.uf, v.etapa, v.situacao, e.papel, e.uf uf_pessoa from public.visitas v join public.equipe e on e.id = v.executor_id where v.situacao <> 'cancelada' and (e.uf is distinct from v.uf or e.papel not in ('articulacao','apoio','agente'));$q$
  union all
  select 'G04', 'entre tabelas: visita AGENDADA (prevista) com pessoa desligada',
    (select count(*) from (select v.id, v.uf, v.etapa, v.data_prevista, e.id pessoa from public.visitas v join public.equipe e on e.id = v.executor_id where v.situacao = 'prevista' and e.status <> 'ativa') q),
    $q$select v.id, v.uf, v.etapa, v.data_prevista, e.id pessoa from public.visitas v join public.equipe e on e.id = v.executor_id where v.situacao = 'prevista' and e.status <> 'ativa';$q$
  union all
  select 'G05', 'entre tabelas: visita (não cancelada) de ficha que não é selecionada e aprovada',
    (select count(*) from (select v.id, v.uf, v.etapa, v.situacao, f.resultado, f.situacao situacao_ficha from public.visitas v join public.fichas f on f.id = v.ficha_id where v.situacao <> 'cancelada' and not (f.resultado = 'selecionada' and f.situacao = 'aprovada')) q),
    $q$select v.id, v.uf, v.etapa, v.situacao, f.resultado, f.situacao situacao_ficha from public.visitas v join public.fichas f on f.id = v.ficha_id where v.situacao <> 'cancelada' and not (f.resultado = 'selecionada' and f.situacao = 'aprovada');$q$
  union all
  select 'G06', 'entre tabelas: diagnóstico ou avaliação ligado a visita de outra etapa, de outra ficha ou cancelada',
    (select count(*) from (select 'diagnosticos' tabela, d.id, v.etapa, v.situacao from public.diagnosticos d join public.visitas v on v.id = d.visita_id where v.etapa <> 'diagnostico' or v.ficha_id <> d.ficha_id or v.situacao = 'cancelada' union all select 'avaliacoes', d.id, v.etapa, v.situacao from public.avaliacoes d join public.visitas v on v.id = d.visita_id where v.etapa <> 'avaliacao' or v.ficha_id <> d.ficha_id or v.situacao = 'cancelada') q),
    $q$select 'diagnosticos' tabela, d.id, v.etapa, v.situacao from public.diagnosticos d join public.visitas v on v.id = d.visita_id where v.etapa <> 'diagnostico' or v.ficha_id <> d.ficha_id or v.situacao = 'cancelada' union all select 'avaliacoes', d.id, v.etapa, v.situacao from public.avaliacoes d join public.visitas v on v.id = d.visita_id where v.etapa <> 'avaliacao' or v.ficha_id <> d.ficha_id or v.situacao = 'cancelada';$q$
  union all
  select 'G07', 'entre tabelas: diagnóstico ou avaliação com quem fez ou com data diferente da visita',
    (select count(*) from (select 'diagnosticos' tabela, d.id, d.data_visita, v.data_realizada, v.situacao from public.diagnosticos d join public.visitas v on v.id = d.visita_id where d.executor_id is distinct from v.executor_id or d.data_visita is distinct from v.data_realizada or v.situacao <> 'realizada' union all select 'avaliacoes', d.id, d.data_visita, v.data_realizada, v.situacao from public.avaliacoes d join public.visitas v on v.id = d.visita_id where d.executor_id is distinct from v.executor_id or d.data_visita is distinct from v.data_realizada or v.situacao <> 'realizada') q),
    $q$select 'diagnosticos' tabela, d.id, d.data_visita, v.data_realizada, v.situacao from public.diagnosticos d join public.visitas v on v.id = d.visita_id where d.executor_id is distinct from v.executor_id or d.data_visita is distinct from v.data_realizada or v.situacao <> 'realizada' union all select 'avaliacoes', d.id, d.data_visita, v.data_realizada, v.situacao from public.avaliacoes d join public.visitas v on v.id = d.visita_id where d.executor_id is distinct from v.executor_id or d.data_visita is distinct from v.data_realizada or v.situacao <> 'realizada';$q$
  union all
  select 'G08', 'entre tabelas: visita de diagnóstico ou de avaliação FEITA sem o formulário',
    (select count(*) from (select v.id, v.uf, v.etapa, v.data_realizada from public.visitas v where v.situacao = 'realizada' and ((v.etapa = 'diagnostico' and not exists (select 1 from public.diagnosticos d where d.visita_id = v.id)) or (v.etapa = 'avaliacao' and not exists (select 1 from public.avaliacoes a where a.visita_id = v.id)))) q),
    $q$select v.id, v.uf, v.etapa, v.data_realizada from public.visitas v where v.situacao = 'realizada' and ((v.etapa = 'diagnostico' and not exists (select 1 from public.diagnosticos d where d.visita_id = v.id)) or (v.etapa = 'avaliacao' and not exists (select 1 from public.avaliacoes a where a.visita_id = v.id)));$q$
  union all
  select 'G09', 'entre tabelas: implantação (não cancelada) sem plano aprovado ou em quintal sem água',
    (select count(*) from (select v.id, v.uf, v.situacao, d.situacao situacao_diagnostico, d.sem_agua from public.visitas v left join public.diagnosticos d on d.ficha_id = v.ficha_id where v.etapa = 'implantacao' and v.situacao <> 'cancelada' and (d.id is null or d.situacao <> 'aprovado' or d.sem_agua)) q),
    $q$select v.id, v.uf, v.situacao, d.situacao situacao_diagnostico, d.sem_agua from public.visitas v left join public.diagnosticos d on d.ficha_id = v.ficha_id where v.etapa = 'implantacao' and v.situacao <> 'cancelada' and (d.id is null or d.situacao <> 'aprovado' or d.sem_agua);$q$
  union all
  select 'G10', 'entre tabelas: etapa (não cancelada) sem a anterior feita (implantação sem diagnóstico; acompanhamento ou avaliação sem implantação)',
    (select count(*) from (select v.id, v.uf, v.etapa, v.situacao from public.visitas v where v.situacao <> 'cancelada' and ((v.etapa <> 'diagnostico' and not exists (select 1 from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'diagnostico' and x.situacao = 'realizada')) or (v.etapa in ('acompanhamento','avaliacao') and v.situacao = 'realizada' and not exists (select 1 from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'implantacao' and x.situacao = 'realizada')))) q),
    $q$select v.id, v.uf, v.etapa, v.situacao from public.visitas v where v.situacao <> 'cancelada' and ((v.etapa <> 'diagnostico' and not exists (select 1 from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'diagnostico' and x.situacao = 'realizada')) or (v.etapa in ('acompanhamento','avaliacao') and v.situacao = 'realizada' and not exists (select 1 from public.visitas x where x.ficha_id = v.ficha_id and x.etapa = 'implantacao' and x.situacao = 'realizada')));$q$
  union all
  select 'G11', 'entre tabelas: visita em pedido de pagamento de outro mês (pela data em que foi feita)',
    (select count(*) from (select sv.visita_id, s.id pedido, s.situacao, s.mes, v.data_realizada from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id join public.visitas v on v.id = sv.visita_id where v.data_realizada is null or date_trunc('month', v.data_realizada)::date <> s.mes) q),
    $q$select sv.visita_id, s.id pedido, s.situacao, s.mes, v.data_realizada from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id join public.visitas v on v.id = sv.visita_id where v.data_realizada is null or date_trunc('month', v.data_realizada)::date <> s.mes;$q$
  union all
  select 'G12', 'entre tabelas: visita em pedido de pagamento de outra pessoa, não feita, ou em pedido que não é ajuda de custo',
    (select count(*) from (select sv.visita_id, s.id pedido, s.tipo, s.situacao, v.situacao situacao_visita from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id join public.visitas v on v.id = sv.visita_id where v.executor_id <> s.equipe_id or v.situacao <> 'realizada' or s.tipo <> 'ajuda_custo') q),
    $q$select sv.visita_id, s.id pedido, s.tipo, s.situacao, v.situacao situacao_visita from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id join public.visitas v on v.id = sv.visita_id where v.executor_id <> s.equipe_id or v.situacao <> 'realizada' or s.tipo <> 'ajuda_custo';$q$
  union all
  select 'G13', 'entre tabelas: visita presa a pedido DEVOLVIDO (deveria estar livre) ou ajuda de custo aberta sem nenhuma visita',
    (select count(*) from (select s.id pedido, s.equipe_id, s.mes, s.situacao, n.visitas from public.solicitacoes_pagamento s cross join lateral (select count(*) visitas from public.solicitacao_visitas sv where sv.solicitacao_id = s.id) n where s.tipo = 'ajuda_custo' and ((s.situacao = 'devolvida' and n.visitas > 0) or (s.situacao <> 'devolvida' and n.visitas = 0))) q),
    $q$select s.id pedido, s.equipe_id, s.mes, s.situacao, n.visitas from public.solicitacoes_pagamento s cross join lateral (select count(*) visitas from public.solicitacao_visitas sv where sv.solicitacao_id = s.id) n where s.tipo = 'ajuda_custo' and ((s.situacao = 'devolvida' and n.visitas > 0) or (s.situacao <> 'devolvida' and n.visitas = 0));$q$
  union all
  select 'G14', 'entre tabelas: pagamento LANÇADO sem aval (sem valor, sem quem deu o aval ou sem data do aval)',
    (select count(*) from (select id, tipo, equipe_id, mes, valor_avalizado, aval_por, aval_em from public.solicitacoes_pagamento where situacao = 'lancada' and (aval_por is null or aval_em is null or valor_avalizado is null or not (valor_avalizado > 0))) q),
    $q$select id, tipo, equipe_id, mes, valor_avalizado, aval_por, aval_em from public.solicitacoes_pagamento where situacao = 'lancada' and (aval_por is null or aval_em is null or valor_avalizado is null or not (valor_avalizado > 0));$q$
  union all
  select 'G15', 'entre tabelas: aval dado por quem não podia (bolsa de técnica, professor e auxiliar: coordenação geral; o resto: coordenação técnica ou geral)',
    (select count(*) from (select s.id, s.tipo, s.mes, p.papel papel_de_quem_pediu, a.papel papel_de_quem_avalizou from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id join public.equipe a on a.id = s.aval_por where s.situacao in ('avalizada','lancada') and a.papel <> 'coord_geral' and not (a.papel = 'coord_tecnico' and not (s.tipo = 'bolsa' and p.papel in ('coord_tecnico','professor_fic','auxiliar_adm')))) q),
    $q$select s.id, s.tipo, s.mes, p.papel papel_de_quem_pediu, a.papel papel_de_quem_avalizou from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id join public.equipe a on a.id = s.aval_por where s.situacao in ('avalizada','lancada') and a.papel <> 'coord_geral' and not (a.papel = 'coord_tecnico' and not (s.tipo = 'bolsa' and p.papel in ('coord_tecnico','professor_fic','auxiliar_adm')));$q$
  union all
  select 'G16', 'entre tabelas: pagamento de quem o perfil não recebe (ajuda de custo: bolsistas e agentes; bolsa: técnica, bolsistas, professor e auxiliar)',
    (select count(*) from (select s.id, s.tipo, s.mes, s.situacao, p.papel from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id where (s.tipo = 'ajuda_custo' and p.papel not in ('articulacao','apoio','agente')) or (s.tipo = 'bolsa' and p.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm'))) q),
    $q$select s.id, s.tipo, s.mes, s.situacao, p.papel from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id where (s.tipo = 'ajuda_custo' and p.papel not in ('articulacao','apoio','agente')) or (s.tipo = 'bolsa' and p.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm'));$q$
  union all
  select 'G17', 'entre tabelas: pagamento aberto (pedido ou com aval, ainda não lançado) de pessoa desligada',
    (select count(*) from (select s.id, s.tipo, s.mes, s.situacao, p.data_fim from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id where s.situacao in ('solicitada','avalizada') and p.status <> 'ativa') q),
    $q$select s.id, s.tipo, s.mes, s.situacao, p.data_fim from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id where s.situacao in ('solicitada','avalizada') and p.status <> 'ativa';$q$
  union all
  select 'G18', 'entre tabelas: bolsa de professor do FIC sem encontro no mês e sem justificativa (30 letras)',
    (select count(*) from (select s.id, s.equipe_id, s.mes, s.situacao from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id where s.tipo = 'bolsa' and p.papel = 'professor_fic' and s.situacao <> 'devolvida' and not exists (select 1 from public.fic_encontros e where e.professor_id = s.equipe_id and date_trunc('month', e.data)::date = s.mes and e.cancelado_em is null) and length(trim(coalesce(s.detalhe ->> 'justificativa_sem_encontro', ''))) < 30) q),
    $q$select s.id, s.equipe_id, s.mes, s.situacao from public.solicitacoes_pagamento s join public.equipe p on p.id = s.equipe_id where s.tipo = 'bolsa' and p.papel = 'professor_fic' and s.situacao <> 'devolvida' and not exists (select 1 from public.fic_encontros e where e.professor_id = s.equipe_id and date_trunc('month', e.data)::date = s.mes and e.cancelado_em is null) and length(trim(coalesce(s.detalhe ->> 'justificativa_sem_encontro', ''))) < 30;$q$
  union all
  select 'G19', 'entre tabelas: mais de 40 selecionadas aprovadas no estado',
    (select count(*) from (select uf, count(*) selecionadas_aprovadas from public.fichas where resultado = 'selecionada' and situacao = 'aprovada' group by 1 having count(*) > 40) q),
    $q$select uf, count(*) selecionadas_aprovadas from public.fichas where resultado = 'selecionada' and situacao = 'aprovada' group by 1 having count(*) > 40;$q$
  union all
  select 'G20', 'entre tabelas: mais de 200 dias de campo (visitas não canceladas) no estado',
    (select count(*) from (select uf, count(*) visitas from public.visitas where situacao <> 'cancelada' group by 1 having count(*) > 200) q),
    $q$select uf, count(*) visitas from public.visitas where situacao <> 'cancelada' group by 1 having count(*) > 200;$q$
  union all
  select 'G21', 'entre tabelas: passagens autorizadas acima do teto da finalidade (intercâmbio R$ 70.000,00; pedagógico R$ 22.400,00)',
    (select count(*) from (select case when dados ->> 'finalidade' = 'pedagogico' then 'pedagogico' else 'intercambio' end finalidade, sum(valor_autorizado) autorizado from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado' group by 1 having sum(valor_autorizado) > case when (case when dados ->> 'finalidade' = 'pedagogico' then 'pedagogico' else 'intercambio' end) = 'pedagogico' then 22400 else 70000 end) q),
    $q$select case when dados ->> 'finalidade' = 'pedagogico' then 'pedagogico' else 'intercambio' end finalidade, sum(valor_autorizado) autorizado from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado' group by 1 having sum(valor_autorizado) > case when (case when dados ->> 'finalidade' = 'pedagogico' then 'pedagogico' else 'intercambio' end) = 'pedagogico' then 22400 else 70000 end;$q$
  union all
  select 'G22', 'entre tabelas: eventos autorizados acima de R$ 6.000,00 no estado',
    (select count(*) from (select uf, sum(valor_autorizado) autorizado from public.pedidos_apoio where tipo = 'evento' and situacao = 'autorizado' group by 1 having sum(valor_autorizado) > 6000) q),
    $q$select uf, sum(valor_autorizado) autorizado from public.pedidos_apoio where tipo = 'evento' and situacao = 'autorizado' group by 1 having sum(valor_autorizado) > 6000;$q$
  union all
  select 'G23', 'entre tabelas: pedido de passagem/evento de quem não é articulação, ou de estado diferente do da solicitante',
    (select count(*) from (select p.id, p.tipo, p.uf, p.situacao, e.papel, e.uf uf_pessoa from public.pedidos_apoio p join public.equipe e on e.id = p.solicitante_id where e.papel <> 'articulacao' or e.uf is distinct from p.uf) q),
    $q$select p.id, p.tipo, p.uf, p.situacao, e.papel, e.uf uf_pessoa from public.pedidos_apoio p join public.equipe e on e.id = p.solicitante_id where e.papel <> 'articulacao' or e.uf is distinct from p.uf;$q$
  union all
  select 'G24', 'entre tabelas: pedido de passagem/evento ainda aberto de pessoa desligada',
    (select count(*) from (select p.id, p.tipo, p.uf, p.situacao from public.pedidos_apoio p join public.equipe e on e.id = p.solicitante_id where p.situacao in ('enviado','devolvido','conferido') and e.status <> 'ativa') q),
    $q$select p.id, p.tipo, p.uf, p.situacao from public.pedidos_apoio p join public.equipe e on e.id = p.solicitante_id where p.situacao in ('enviado','devolvido','conferido') and e.status <> 'ativa';$q$
  union all
  select 'G25', 'entre tabelas: ficha registrada por quem não é bolsista ou é de outro estado; aprovada por quem não é coordenação',
    (select count(*) from (select f.id, f.uf, b.papel papel_de_quem_registrou, b.uf uf_de_quem_registrou, a.papel papel_de_quem_aprovou from public.fichas f left join public.equipe b on b.id = f.bolsista_id left join public.equipe a on a.id = f.aprovada_por where (b.id is not null and (b.papel not in ('articulacao','apoio','coord_geral') or (b.uf is not null and b.uf <> f.uf))) or (a.id is not null and a.papel not in ('coord_tecnico','coord_geral'))) q),
    $q$select f.id, f.uf, b.papel papel_de_quem_registrou, b.uf uf_de_quem_registrou, a.papel papel_de_quem_aprovou from public.fichas f left join public.equipe b on b.id = f.bolsista_id left join public.equipe a on a.id = f.aprovada_por where (b.id is not null and (b.papel not in ('articulacao','apoio','coord_geral') or (b.uf is not null and b.uf <> f.uf))) or (a.id is not null and a.papel not in ('coord_tecnico','coord_geral'));$q$
  union all
  select 'G26', 'entre tabelas: diagnóstico aprovado por quem não é coordenação, ou aprovado pela mesma pessoa que alterou o conteúdo por último',
    (select count(*) from (select d.id, d.uf, a.papel papel_de_quem_aprovou, d.aprovado_por = d.conteudo_alterado_por as aprovou_o_que_alterou from public.diagnosticos d join public.equipe a on a.id = d.aprovado_por where d.situacao = 'aprovado' and (a.papel not in ('coord_tecnico','coord_geral') or d.aprovado_por = d.conteudo_alterado_por)) q),
    $q$select d.id, d.uf, a.papel papel_de_quem_aprovou, d.aprovado_por = d.conteudo_alterado_por as aprovou_o_que_alterou from public.diagnosticos d join public.equipe a on a.id = d.aprovado_por where d.situacao = 'aprovado' and (a.papel not in ('coord_tecnico','coord_geral') or d.aprovado_por = d.conteudo_alterado_por);$q$
  union all
  select 'G27', 'entre tabelas: foto na vitrine de mulher que não autorizou imagem (ou crianças) ou com o primeiro nome dela na legenda',
    (select count(*) from (select v.id, v.uf, f.consent_imagem, f.consent_criancas, v.sem_criancas from public.vitrine_fotos v join public.fichas f on f.id = v.ficha_id where not f.consent_imagem or (not f.consent_criancas and not v.sem_criancas) or (length(split_part(f.nome, ' ', 1)) >= 3 and position(lower(split_part(f.nome, ' ', 1)) in lower(v.legenda)) > 0)) q),
    $q$select v.id, v.uf, f.consent_imagem, f.consent_criancas, v.sem_criancas from public.vitrine_fotos v join public.fichas f on f.id = v.ficha_id where not f.consent_imagem or (not f.consent_criancas and not v.sem_criancas) or (length(split_part(f.nome, ' ', 1)) >= 3 and position(lower(split_part(f.nome, ' ', 1)) in lower(v.legenda)) > 0);$q$
  union all
  select 'G28', 'entre tabelas: foto retirada (fila de remoção) que continua registrada na vitrine',
    (select count(*) from (select r.path from public.vitrine_remover r join public.vitrine_fotos v on v.path = r.path) q),
    $q$select r.path from public.vitrine_remover r join public.vitrine_fotos v on v.path = r.path;$q$
  union all
  select 'G29', 'entre tabelas: turma do FIC com professor que não é professor do FIC ativo (turma em andamento)',
    (select count(*) from (select t.id, t.nome, e.papel, e.status from public.turmas_fic t join public.equipe e on e.id = t.professor_id where e.papel <> 'professor_fic' or (e.status <> 'ativa' and (t.fim is null or t.fim >= (now() at time zone 'America/Fortaleza')::date))) q),
    $q$select t.id, t.nome, e.papel, e.status from public.turmas_fic t join public.equipe e on e.id = t.professor_id where e.papel <> 'professor_fic' or (e.status <> 'ativa' and (t.fim is null or t.fim >= (now() at time zone 'America/Fortaleza')::date));$q$
  union all
  select 'G30', 'entre tabelas: matrícula ATIVA de pessoa desligada, de função que não se matricula ou de estado diferente do da turma',
    (select count(*) from (select m.id, m.equipe_id, e.papel, e.status, e.uf uf_pessoa, t.uf uf_turma from public.matriculas_fic m join public.equipe e on e.id = m.equipe_id join public.turmas_fic t on t.id = m.turma_id where m.cancelada_em is null and (e.status <> 'ativa' or e.papel not in ('coord_tecnico','articulacao','apoio','agente') or (t.uf is not null and e.uf is not null and e.uf <> t.uf))) q),
    $q$select m.id, m.equipe_id, e.papel, e.status, e.uf uf_pessoa, t.uf uf_turma from public.matriculas_fic m join public.equipe e on e.id = m.equipe_id join public.turmas_fic t on t.id = m.turma_id where m.cancelada_em is null and (e.status <> 'ativa' or e.papel not in ('coord_tecnico','articulacao','apoio','agente') or (t.uf is not null and e.uf is not null and e.uf <> t.uf));$q$
  union all
  select 'G31', 'entre tabelas: presença de quem nunca foi matriculado na turma do encontro; encontro com professor diferente do da turma',
    (select count(*) from (select 'fic_presencas' tabela, p.id from public.fic_presencas p join public.fic_encontros e on e.id = p.encontro_id where p.presente and not exists (select 1 from public.matriculas_fic m where m.turma_id = e.turma_id and m.equipe_id = p.equipe_id and m.matriculado_em <= e.data) union all select 'fic_encontros', e.id from public.fic_encontros e join public.turmas_fic t on t.id = e.turma_id join public.equipe q on q.id = e.professor_id where q.papel <> 'professor_fic') q),
    $q$select 'fic_presencas' tabela, p.id from public.fic_presencas p join public.fic_encontros e on e.id = p.encontro_id where p.presente and not exists (select 1 from public.matriculas_fic m where m.turma_id = e.turma_id and m.equipe_id = p.equipe_id and m.matriculado_em <= e.data) union all select 'fic_encontros', e.id from public.fic_encontros e join public.turmas_fic t on t.id = e.turma_id join public.equipe q on q.id = e.professor_id where q.papel <> 'professor_fic';$q$
  union all
  select 'G32', 'entre tabelas: distância (km) lançada para visita cancelada',
    (select count(*) from (select c.visita_id, c.km_ida, v.uf, v.etapa from public.custos_visita c join public.visitas v on v.id = c.visita_id where v.situacao = 'cancelada') q),
    $q$select c.visita_id, c.km_ida, v.uf, v.etapa from public.custos_visita c join public.visitas v on v.id = c.visita_id where v.situacao = 'cancelada';$q$
  union all
  select 'G33', 'entre tabelas: registro de água para mulher que não está sem água; orientação de venda sem diagnóstico ou de ficha não selecionada/aprovada',
    (select count(*) from (select 'agua_situacoes' tabela, a.id, a.ficha_id from public.agua_situacoes a join public.fichas f on f.id = a.ficha_id where f.resultado <> 'sem_agua' and not exists (select 1 from public.diagnosticos d where d.ficha_id = a.ficha_id and d.sem_agua) union all select 'orientacoes_venda', o.id, o.ficha_id from public.orientacoes_venda o join public.fichas f on f.id = o.ficha_id where not (f.resultado = 'selecionada' and f.situacao = 'aprovada') or not exists (select 1 from public.diagnosticos d where d.ficha_id = o.ficha_id)) q),
    $q$select 'agua_situacoes' tabela, a.id, a.ficha_id from public.agua_situacoes a join public.fichas f on f.id = a.ficha_id where f.resultado <> 'sem_agua' and not exists (select 1 from public.diagnosticos d where d.ficha_id = a.ficha_id and d.sem_agua) union all select 'orientacoes_venda', o.id, o.ficha_id from public.orientacoes_venda o join public.fichas f on f.id = o.ficha_id where not (f.resultado = 'selecionada' and f.situacao = 'aprovada') or not exists (select 1 from public.diagnosticos d where d.ficha_id = o.ficha_id);$q$
  union all
  select 'G34', 'entre tabelas: ficha ''sem água'' ou diagnóstico ''sem água'' sem nenhum registro de encaminhamento da água',
    (select count(*) from (select f.id, f.uf, f.resultado from public.fichas f where (f.resultado = 'sem_agua' or exists (select 1 from public.diagnosticos d where d.ficha_id = f.id and d.sem_agua)) and not exists (select 1 from public.agua_situacoes a where a.ficha_id = f.id)) q),
    $q$select f.id, f.uf, f.resultado from public.fichas f where (f.resultado = 'sem_agua' or exists (select 1 from public.diagnosticos d where d.ficha_id = f.id and d.sem_agua)) and not exists (select 1 from public.agua_situacoes a where a.ficha_id = f.id);$q$
  union all
  select 'G35', 'entre tabelas: substituição apontando para a própria pessoa, para pessoa ATIVA, em círculo ou de outro estado/função',
    (select count(*) from (select e.id, e.papel, e.uf, s.id substituida, s.status, s.papel papel_substituida, s.uf uf_substituida from public.equipe e join public.equipe s on s.id = e.substitui_id where e.substitui_id = e.id or s.substitui_id = e.id or (e.status = 'ativa' and s.status = 'ativa') or s.uf is distinct from e.uf or s.papel <> e.papel) q),
    $q$select e.id, e.papel, e.uf, s.id substituida, s.status, s.papel papel_substituida, s.uf uf_substituida from public.equipe e join public.equipe s on s.id = e.substitui_id where e.substitui_id = e.id or s.substitui_id = e.id or (e.status = 'ativa' and s.status = 'ativa') or s.uf is distinct from e.uf or s.papel <> e.papel;$q$
  union all
  select 'G36', 'entre tabelas: acesso ao AVA marcado para quem não é cursista do FIC (coordenação geral, professor, auxiliar)',
    (select count(*) from (select x.equipe_id, x.mes, x.item, p.papel from public.entregas_mes x join public.equipe p on p.id = x.equipe_id where p.papel in ('coord_geral','professor_fic','auxiliar_adm') and x.item = 'ava') q),
    $q$select x.equipe_id, x.mes, x.item, p.papel from public.entregas_mes x join public.equipe p on p.id = x.equipe_id where p.papel in ('coord_geral','professor_fic','auxiliar_adm') and x.item = 'ava';$q$
  union all
  select 'G37', 'entre tabelas: dados de exemplo (teste) ainda no banco',
    (select count(*) from (select tabela, count(*) registros from public.exemplo group by 1) q),
    $q$select tabela, count(*) registros from public.exemplo group by 1;$q$
  union all
  select 'H01', 'formato: CPF sem 11 números (ficha, testemunha, equipe, pré-cadastro)',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where cpf !~ '^[0-9]{11}$' or (testemunha_cpf is not null and testemunha_cpf !~ '^[0-9]{11}$') union all select 'equipe', id from public.equipe where cpf !~ '^[0-9]{11}$' union all select 'pre_cadastros', id from public.pre_cadastros where cpf !~ '^[0-9]{11}$') q),
    $q$select 'fichas' tabela, id from public.fichas where cpf !~ '^[0-9]{11}$' or (testemunha_cpf is not null and testemunha_cpf !~ '^[0-9]{11}$') union all select 'equipe', id from public.equipe where cpf !~ '^[0-9]{11}$' union all select 'pre_cadastros', id from public.pre_cadastros where cpf !~ '^[0-9]{11}$';$q$
  union all
  select 'H02', 'formato: CPF com todos os números iguais',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where cpf ~ '^([0-9])\1{10}$' union all select 'equipe', id from public.equipe where cpf ~ '^([0-9])\1{10}$' union all select 'pre_cadastros', id from public.pre_cadastros where cpf ~ '^([0-9])\1{10}$') q),
    $q$select 'fichas' tabela, id from public.fichas where cpf ~ '^([0-9])\1{10}$' union all select 'equipe', id from public.equipe where cpf ~ '^([0-9])\1{10}$' union all select 'pre_cadastros', id from public.pre_cadastros where cpf ~ '^([0-9])\1{10}$';$q$
  union all
  select 'H03', 'formato: CPF de FICHA com dígitos verificadores que não conferem (provável erro de digitação)',
    (select count(*) from (select f.id, f.uf from public.fichas f where (f.cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.cpf, 10, 1)::int or ((select sum(substr(f.cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.cpf, 11, 1)::int)) or (f.testemunha_cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.testemunha_cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.testemunha_cpf, 10, 1)::int or ((select sum(substr(f.testemunha_cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.testemunha_cpf, 11, 1)::int))) q),
    $q$select f.id, f.uf from public.fichas f where (f.cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.cpf, 10, 1)::int or ((select sum(substr(f.cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.cpf, 11, 1)::int)) or (f.testemunha_cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.testemunha_cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.testemunha_cpf, 10, 1)::int or ((select sum(substr(f.testemunha_cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.testemunha_cpf, 11, 1)::int));$q$
  union all
  select 'H04', 'formato: CPF da EQUIPE ou de pré-cadastro com dígitos verificadores que não conferem',
    (select count(*) from (select 'equipe' tabela, f.id from public.equipe f where (f.cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.cpf, 10, 1)::int or ((select sum(substr(f.cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.cpf, 11, 1)::int)) union all select 'pre_cadastros', f.id from public.pre_cadastros f where (f.cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.cpf, 10, 1)::int or ((select sum(substr(f.cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.cpf, 11, 1)::int))) q),
    $q$select 'equipe' tabela, f.id from public.equipe f where (f.cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.cpf, 10, 1)::int or ((select sum(substr(f.cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.cpf, 11, 1)::int)) union all select 'pre_cadastros', f.id from public.pre_cadastros f where (f.cpf ~ '^[0-9]{11}$' and (((select sum(substr(f.cpf, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11) % 10 <> substr(f.cpf, 10, 1)::int or ((select sum(substr(f.cpf, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11) % 10 <> substr(f.cpf, 11, 1)::int));$q$
  union all
  select 'H05', 'formato: celular/telefone que não tem DDD + 8 ou 9 números (ficha, equipe, pré-cadastro)',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where (celular is not null and trim(celular) <> '' and not (regexp_replace(celular, '\D', '', 'g') ~ '^[1-9][1-9][0-9]{8,9}$')) union all select 'equipe', id from public.equipe where (telefone is not null and trim(telefone) <> '' and not (regexp_replace(telefone, '\D', '', 'g') ~ '^[1-9][1-9][0-9]{8,9}$')) union all select 'pre_cadastros', id from public.pre_cadastros where (telefone is not null and trim(telefone) <> '' and not (regexp_replace(telefone, '\D', '', 'g') ~ '^[1-9][1-9][0-9]{8,9}$'))) q),
    $q$select 'fichas' tabela, id from public.fichas where (celular is not null and trim(celular) <> '' and not (regexp_replace(celular, '\D', '', 'g') ~ '^[1-9][1-9][0-9]{8,9}$')) union all select 'equipe', id from public.equipe where (telefone is not null and trim(telefone) <> '' and not (regexp_replace(telefone, '\D', '', 'g') ~ '^[1-9][1-9][0-9]{8,9}$')) union all select 'pre_cadastros', id from public.pre_cadastros where (telefone is not null and trim(telefone) <> '' and not (regexp_replace(telefone, '\D', '', 'g') ~ '^[1-9][1-9][0-9]{8,9}$'));$q$
  union all
  select 'H06', 'formato: e-mail com letra maiúscula, espaço ou fora do formato (equipe e pré-cadastro)',
    (select count(*) from (select 'equipe' tabela, id from public.equipe where email::text <> lower(trim(email::text)) or email::text ~ '\s' or email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' union all select 'pre_cadastros', id from public.pre_cadastros where email <> lower(trim(email)) or email ~ '\s' or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') q),
    $q$select 'equipe' tabela, id from public.equipe where email::text <> lower(trim(email::text)) or email::text ~ '\s' or email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' union all select 'pre_cadastros', id from public.pre_cadastros where email <> lower(trim(email)) or email ~ '\s' or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';$q$
  union all
  select 'H07', 'formato: e-mail do cadastro diferente do e-mail do login',
    (select count(*) from (select e.id, e.papel, e.uf from public.equipe e join auth.users u on u.id = e.user_id where lower(trim(u.email::text)) <> lower(trim(e.email::text))) q),
    $q$select e.id, e.papel, e.uf from public.equipe e join auth.users u on u.id = e.user_id where lower(trim(u.email::text)) <> lower(trim(e.email::text));$q$
  union all
  select 'H08', 'formato: mesmo município escrito de jeitos diferentes (com e sem acento, maiúsculas, espaços) no mesmo estado',
    (select count(*) from (select x.uf, regexp_replace(trim(translate(lower(coalesce(x.municipio, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') municipio_sem_acento, count(distinct trim(x.municipio)) grafias, string_agg(distinct trim(x.municipio), ' | ') como_aparece from (select uf, municipio from public.fichas union all select uf, municipio from public.equipe where uf is not null and municipio is not null union all select uf, municipio from public.canais_venda union all select uf, municipio from public.apl_municipios union all select uf, municipio from public.turmas_fic where uf is not null and municipio is not null) x where coalesce(trim(x.municipio), '') <> '' group by 1, 2 having count(distinct trim(x.municipio)) > 1) q),
    $q$select x.uf, regexp_replace(trim(translate(lower(coalesce(x.municipio, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g') municipio_sem_acento, count(distinct trim(x.municipio)) grafias, string_agg(distinct trim(x.municipio), ' | ') como_aparece from (select uf, municipio from public.fichas union all select uf, municipio from public.equipe where uf is not null and municipio is not null union all select uf, municipio from public.canais_venda union all select uf, municipio from public.apl_municipios union all select uf, municipio from public.turmas_fic where uf is not null and municipio is not null) x where coalesce(trim(x.municipio), '') <> '' group by 1, 2 having count(distinct trim(x.municipio)) > 1;$q$
  union all
  select 'H09', 'formato: texto com espaço sobrando nas pontas ou espaços duplos (nome, município, comunidade)',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where nome <> regexp_replace(trim(nome), '\s+', ' ', 'g') or municipio <> regexp_replace(trim(municipio), '\s+', ' ', 'g') or comunidade <> regexp_replace(trim(comunidade), '\s+', ' ', 'g') union all select 'equipe', id from public.equipe where nome <> regexp_replace(trim(nome), '\s+', ' ', 'g') or municipio <> regexp_replace(trim(municipio), '\s+', ' ', 'g')) q),
    $q$select 'fichas' tabela, id from public.fichas where nome <> regexp_replace(trim(nome), '\s+', ' ', 'g') or municipio <> regexp_replace(trim(municipio), '\s+', ' ', 'g') or comunidade <> regexp_replace(trim(comunidade), '\s+', ' ', 'g') union all select 'equipe', id from public.equipe where nome <> regexp_replace(trim(nome), '\s+', ' ', 'g') or municipio <> regexp_replace(trim(municipio), '\s+', ' ', 'g');$q$
  union all
  select 'H10', 'formato: nome com números, símbolos ou caracteres de controle; nome com uma palavra só',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where nome ~ '[0-9<>{}\[\]\\/|@#$%*=+_;:"]' or nome ~ '[\x01-\x1f\x7f]' or trim(nome) !~ '\s' union all select 'equipe', id from public.equipe where nome ~ '[0-9<>{}\[\]\\/|@#$%*=+_;:"]' or nome ~ '[\x01-\x1f\x7f]' or trim(nome) !~ '\s') q),
    $q$select 'fichas' tabela, id from public.fichas where nome ~ '[0-9<>{}\[\]\\/|@#$%*=+_;:"]' or nome ~ '[\x01-\x1f\x7f]' or trim(nome) !~ '\s' union all select 'equipe', id from public.equipe where nome ~ '[0-9<>{}\[\]\\/|@#$%*=+_;:"]' or nome ~ '[\x01-\x1f\x7f]' or trim(nome) !~ '\s';$q$
  union all
  select 'H11', 'formato: estado (UF) fora da lista do projeto (AL, BA, PE, PI, SE) em qualquer tabela',
    (select count(*) from (select 'apl_municipios' tabela, count(*) registros from public.apl_municipios where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'avaliacoes' tabela, count(*) registros from public.avaliacoes where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'canais_venda' tabela, count(*) registros from public.canais_venda where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'convites' tabela, count(*) registros from public.convites where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'diagnosticos' tabela, count(*) registros from public.diagnosticos where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'documentos_projeto' tabela, count(*) registros from public.documentos_projeto where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'equipe' tabela, count(*) registros from public.equipe where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'fichas' tabela, count(*) registros from public.fichas where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'orientacoes_venda' tabela, count(*) registros from public.orientacoes_venda where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'pedidos_apoio' tabela, count(*) registros from public.pedidos_apoio where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'pre_cadastros' tabela, count(*) registros from public.pre_cadastros where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'turmas_fic' tabela, count(*) registros from public.turmas_fic where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'visitas' tabela, count(*) registros from public.visitas where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'vitrine_fotos' tabela, count(*) registros from public.vitrine_fotos where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0) q),
    $q$select 'apl_municipios' tabela, count(*) registros from public.apl_municipios where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'avaliacoes' tabela, count(*) registros from public.avaliacoes where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'canais_venda' tabela, count(*) registros from public.canais_venda where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'convites' tabela, count(*) registros from public.convites where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'diagnosticos' tabela, count(*) registros from public.diagnosticos where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'documentos_projeto' tabela, count(*) registros from public.documentos_projeto where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'equipe' tabela, count(*) registros from public.equipe where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'fichas' tabela, count(*) registros from public.fichas where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'orientacoes_venda' tabela, count(*) registros from public.orientacoes_venda where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'pedidos_apoio' tabela, count(*) registros from public.pedidos_apoio where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'pre_cadastros' tabela, count(*) registros from public.pre_cadastros where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'turmas_fic' tabela, count(*) registros from public.turmas_fic where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'visitas' tabela, count(*) registros from public.visitas where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0 union all select 'vitrine_fotos' tabela, count(*) registros from public.vitrine_fotos where uf is not null and uf not in ('AL','BA','PE','PI','SE') having count(*) > 0;$q$
  union all
  select 'H12', 'formato: NIS sem 11 números; SIAPE sem 5 a 8 números',
    (select count(*) from (select 'fichas' tabela, id from public.fichas where nis is not null and nis !~ '^[0-9]{11}$' union all select 'equipe_privado', equipe_id from public.equipe_privado where nis is not null and nis !~ '^[0-9]{11}$' union all select 'equipe', id from public.equipe where siape is not null and siape !~ '^[0-9]{5,8}$' union all select 'pre_cadastros', id from public.pre_cadastros where (nis is not null and nis !~ '^[0-9]{11}$') or (siape is not null and siape !~ '^[0-9]{5,8}$')) q),
    $q$select 'fichas' tabela, id from public.fichas where nis is not null and nis !~ '^[0-9]{11}$' union all select 'equipe_privado', equipe_id from public.equipe_privado where nis is not null and nis !~ '^[0-9]{11}$' union all select 'equipe', id from public.equipe where siape is not null and siape !~ '^[0-9]{5,8}$' union all select 'pre_cadastros', id from public.pre_cadastros where (nis is not null and nis !~ '^[0-9]{11}$') or (siape is not null and siape !~ '^[0-9]{5,8}$');$q$
  union all
  select 'H13', 'formato: valor fora da lista em campo de opções (situação, etapa, função, resultado, tipo, modalidade)',
    (select count(*) from (select 'fichas' tabela, id::text id from public.fichas where situacao not in ('aguardando','aprovada','devolvida') or resultado not in ('selecionada','lista_espera','nao_atende','sem_agua') or assinatura not in ('assinatura','digital') union all select 'visitas', id::text from public.visitas where situacao not in ('prevista','realizada','cancelada') or etapa not in ('diagnostico','implantacao','acompanhamento','avaliacao') union all select 'diagnosticos', id::text from public.diagnosticos where situacao not in ('aguardando','aprovado','devolvido') or agua_seca not in ('sim','as_vezes','nao') or (lote is not null and lote not in (1, 2)) union all select 'avaliacoes', id::text from public.avaliacoes where quintal_produz not in ('sim','em_parte','nao') or (ebia_nivel is not null and ebia_nivel not in ('seguranca','leve','moderada','grave')) union all select 'equipe', id::text from public.equipe where papel not in ('coord_geral','coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm') or status not in ('ativa','desligada') union all select 'convites', id::text from public.convites where papel not in ('coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm') union all select 'pre_cadastros', id::text from public.pre_cadastros where papel not in ('coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm') or situacao not in ('aguardando','aprovado','recusado') union all select 'solicitacoes_pagamento', id::text from public.solicitacoes_pagamento where tipo not in ('ajuda_custo','bolsa') or situacao not in ('solicitada','devolvida','avalizada','lancada') union all select 'pedidos_apoio', id::text from public.pedidos_apoio where tipo not in ('passagem','evento') or situacao not in ('enviado','devolvido','conferido','autorizado','recusado','cancelado') union all select 'fic_encontros', id::text from public.fic_encontros where modalidade not in ('presencial','online','ava') union all select 'agua_situacoes', id::text from public.agua_situacoes where situacao not in ('sem_solucao','encaminhada','em_andamento','concluida') union all select 'canais_venda', id::text from public.canais_venda where tipo not in ('feira','grupo','merenda','paa','comprador','outro') union all select 'documentos_projeto', id::text from public.documentos_projeto where tipo not in ('ata','oficio','relatorio','contrato','plano','lista_presenca','foto','outro') union all select 'entregas_mes', equipe_id::text from public.entregas_mes where item not in ('presenca','ava') union all select 'equipe_bancario', equipe_id::text from public.equipe_bancario where tipo_conta not in ('corrente','poupanca','pagamento') or (pix_tipo is not null and pix_tipo not in ('cpf','email','celular','aleatoria'))) q),
    $q$select 'fichas' tabela, id::text id from public.fichas where situacao not in ('aguardando','aprovada','devolvida') or resultado not in ('selecionada','lista_espera','nao_atende','sem_agua') or assinatura not in ('assinatura','digital') union all select 'visitas', id::text from public.visitas where situacao not in ('prevista','realizada','cancelada') or etapa not in ('diagnostico','implantacao','acompanhamento','avaliacao') union all select 'diagnosticos', id::text from public.diagnosticos where situacao not in ('aguardando','aprovado','devolvido') or agua_seca not in ('sim','as_vezes','nao') or (lote is not null and lote not in (1, 2)) union all select 'avaliacoes', id::text from public.avaliacoes where quintal_produz not in ('sim','em_parte','nao') or (ebia_nivel is not null and ebia_nivel not in ('seguranca','leve','moderada','grave')) union all select 'equipe', id::text from public.equipe where papel not in ('coord_geral','coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm') or status not in ('ativa','desligada') union all select 'convites', id::text from public.convites where papel not in ('coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm') union all select 'pre_cadastros', id::text from public.pre_cadastros where papel not in ('coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm') or situacao not in ('aguardando','aprovado','recusado') union all select 'solicitacoes_pagamento', id::text from public.solicitacoes_pagamento where tipo not in ('ajuda_custo','bolsa') or situacao not in ('solicitada','devolvida','avalizada','lancada') union all select 'pedidos_apoio', id::text from public.pedidos_apoio where tipo not in ('passagem','evento') or situacao not in ('enviado','devolvido','conferido','autorizado','recusado','cancelado') union all select 'fic_encontros', id::text from public.fic_encontros where modalidade not in ('presencial','online','ava') union all select 'agua_situacoes', id::text from public.agua_situacoes where situacao not in ('sem_solucao','encaminhada','em_andamento','concluida') union all select 'canais_venda', id::text from public.canais_venda where tipo not in ('feira','grupo','merenda','paa','comprador','outro') union all select 'documentos_projeto', id::text from public.documentos_projeto where tipo not in ('ata','oficio','relatorio','contrato','plano','lista_presenca','foto','outro') union all select 'entregas_mes', equipe_id::text from public.entregas_mes where item not in ('presenca','ava') union all select 'equipe_bancario', equipe_id::text from public.equipe_bancario where tipo_conta not in ('corrente','poupanca','pagamento') or (pix_tipo is not null and pix_tipo not in ('cpf','email','celular','aleatoria'));$q$
  union all
  select 'H14', 'formato: dados bancários fora do formato (banco com 3 números, agência até 5, conta até 13) ou chave Pix que não combina com o tipo',
    (select count(*) from (select equipe_id from public.equipe_bancario where banco_codigo !~ '^[0-9]{3}$' or agencia !~ '^[0-9]{1,5}$' or conta !~ '^[0-9]{1,13}$' or conta_dv !~ '^[0-9xX]{1,2}$' or length(banco_nome) > 120 or length(coalesce(pix_chave, '')) > 140 or (pix_tipo = 'cpf' and regexp_replace(pix_chave, '\D', '', 'g') !~ '^[0-9]{11}$') or (pix_tipo = 'email' and pix_chave !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') or (pix_tipo = 'celular' and regexp_replace(pix_chave, '\D', '', 'g') !~ '^(55)?[1-9][1-9][0-9]{8,9}$')) q),
    $q$select equipe_id from public.equipe_bancario where banco_codigo !~ '^[0-9]{3}$' or agencia !~ '^[0-9]{1,5}$' or conta !~ '^[0-9]{1,13}$' or conta_dv !~ '^[0-9xX]{1,2}$' or length(banco_nome) > 120 or length(coalesce(pix_chave, '')) > 140 or (pix_tipo = 'cpf' and regexp_replace(pix_chave, '\D', '', 'g') !~ '^[0-9]{11}$') or (pix_tipo = 'email' and pix_chave !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') or (pix_tipo = 'celular' and regexp_replace(pix_chave, '\D', '', 'g') !~ '^(55)?[1-9][1-9][0-9]{8,9}$');$q$
  union all
  select 'H15', 'formato: caminho de arquivo fora do padrão da pasta (ficha: UF/id/...; campo: UF/ficha/...; foto da equipe: id/...)',
    (select count(*) from (select 'fichas' tabela, f.id::text id from public.fichas f cross join lateral (values (f.foto_ficha_path), (f.foto_termo_path)) p(c) where p.c is not null and p.c not like 'exemplo%' and p.c not like f.uf || '/' || f.id || '/%' union all select 'diagnosticos', d.id::text from public.diagnosticos d cross join lateral unnest(d.fotos) p(c) where p.c not like 'exemplo%' and p.c not like d.uf || '/' || d.ficha_id || '/%' union all select 'visitas', d.id::text from public.visitas d cross join lateral unnest(d.fotos) p(c) where p.c not like 'exemplo%' and p.c not like d.uf || '/' || d.ficha_id || '/%' union all select 'avaliacoes', d.id::text from public.avaliacoes d cross join lateral unnest(d.fotos) p(c) where p.c not like 'exemplo%' and p.c not like d.uf || '/' || d.ficha_id || '/%' union all select 'equipe', e.id::text from public.equipe e where e.foto_path is not null and e.foto_path not like 'exemplo%' and e.foto_path not like e.id || '/%') q),
    $q$select 'fichas' tabela, f.id::text id from public.fichas f cross join lateral (values (f.foto_ficha_path), (f.foto_termo_path)) p(c) where p.c is not null and p.c not like 'exemplo%' and p.c not like f.uf || '/' || f.id || '/%' union all select 'diagnosticos', d.id::text from public.diagnosticos d cross join lateral unnest(d.fotos) p(c) where p.c not like 'exemplo%' and p.c not like d.uf || '/' || d.ficha_id || '/%' union all select 'visitas', d.id::text from public.visitas d cross join lateral unnest(d.fotos) p(c) where p.c not like 'exemplo%' and p.c not like d.uf || '/' || d.ficha_id || '/%' union all select 'avaliacoes', d.id::text from public.avaliacoes d cross join lateral unnest(d.fotos) p(c) where p.c not like 'exemplo%' and p.c not like d.uf || '/' || d.ficha_id || '/%' union all select 'equipe', e.id::text from public.equipe e where e.foto_path is not null and e.foto_path not like 'exemplo%' and e.foto_path not like e.id || '/%';$q$
  union all
  select 'I01', 'logins: pessoa ATIVA sem login (ainda não criou a senha)',
    (select count(*) from (select id, papel, uf, criado_em from public.equipe where status = 'ativa' and user_id is null) q),
    $q$select id, papel, uf, criado_em from public.equipe where status = 'ativa' and user_id is null;$q$
  union all
  select 'I02', 'logins: pessoa ATIVA sem login e sem código de primeiro acesso válido (ninguém gerou, ou venceu)',
    (select count(*) from (select e.id, e.papel, e.uf, k.expira_em from public.equipe e left join public.acesso_codigos k on k.equipe_id = e.id where e.status = 'ativa' and e.user_id is null and (k.equipe_id is null or k.expira_em < now())) q),
    $q$select e.id, e.papel, e.uf, k.expira_em from public.equipe e left join public.acesso_codigos k on k.equipe_id = e.id where e.status = 'ativa' and e.user_id is null and (k.equipe_id is null or k.expira_em < now());$q$
  union all
  select 'I03', 'logins: login sem pessoa (conta que entra no sistema e não tem cadastro ativo ligado)',
    (select count(*) from (select u.id, u.email from auth.users u where not exists (select 1 from public.equipe e where e.user_id = u.id and e.status = 'ativa')) q),
    $q$select u.id, u.email from auth.users u where not exists (select 1 from public.equipe e where e.user_id = u.id and e.status = 'ativa');$q$
  union all
  select 'I04', 'logins: login sem pessoa cujo e-mail é o de uma pessoa ATIVA sem login (ela não consegue criar a senha: a conta antiga ocupa o e-mail)',
    (select count(*) from (select e.id, e.papel, e.uf from public.equipe e join auth.users u on lower(trim(u.email::text)) = lower(trim(e.email::text)) where e.status = 'ativa' and e.user_id is null) q),
    $q$select e.id, e.papel, e.uf from public.equipe e join auth.users u on lower(trim(u.email::text)) = lower(trim(e.email::text)) where e.status = 'ativa' and e.user_id is null;$q$
  union all
  select 'I05', 'logins: pessoa DESLIGADA ainda ligada a um login',
    (select count(*) from (select id, papel, uf, data_fim from public.equipe where status <> 'ativa' and user_id is not null) q),
    $q$select id, papel, uf, data_fim from public.equipe where status <> 'ativa' and user_id is not null;$q$
  union all
  select 'I06', 'logins: o mesmo login ligado a mais de uma pessoa',
    (select count(*) from (select user_id, count(*) pessoas from public.equipe where user_id is not null group by 1 having count(*) > 1) q),
    $q$select user_id, count(*) pessoas from public.equipe where user_id is not null group by 1 having count(*) > 1;$q$
  union all
  select 'I07', 'logins: código de primeiro acesso de quem já tem login, ou de pessoa desligada',
    (select count(*) from (select k.equipe_id, k.expira_em from public.acesso_codigos k join public.equipe e on e.id = k.equipe_id where e.user_id is not null or e.status <> 'ativa') q),
    $q$select k.equipe_id, k.expira_em from public.acesso_codigos k join public.equipe e on e.id = k.equipe_id where e.user_id is not null or e.status <> 'ativa';$q$
  union all
  select 'I08', 'logins: pedido de novo acesso aguardando há mais de 7 dias',
    (select count(*) from (select id, equipe_id, pedido_em, vezes from public.pedidos_novo_acesso where situacao = 'aguardando' and pedido_em < now() - interval '7 days') q),
    $q$select id, equipe_id, pedido_em, vezes from public.pedidos_novo_acesso where situacao = 'aguardando' and pedido_em < now() - interval '7 days';$q$
  union all
  select 'I09', 'logins: pré-cadastro aguardando decisão há mais de 15 dias; link de cadastro vencido sem uso',
    (select count(*) from (select 'pre_cadastros' tabela, id from public.pre_cadastros where situacao = 'aguardando' and enviado_em < now() - interval '15 days' union all select 'convites', id from public.convites where usado_em is null and cancelado_em is null and expira_em < now()) q),
    $q$select 'pre_cadastros' tabela, id from public.pre_cadastros where situacao = 'aguardando' and enviado_em < now() - interval '15 days' union all select 'convites', id from public.convites where usado_em is null and cancelado_em is null and expira_em < now();$q$
)
select '[' || codigo || '] ' || verificacao as verificacao, quantidade,
       case when quantidade = 0 then 'ok' else 'ATENÇÃO' end as status, como_ver
  from c
 order by codigo;
