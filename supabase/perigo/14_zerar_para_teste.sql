-- =====================================================================
-- Mulheres & Quintais — ZERAR o banco para começar os testes do zero
-- ATENÇÃO: apaga de vez. Não tem como desfazer. Use só enquanto tudo no banco for teste.
-- Este arquivo fica na pasta supabase/perigo/, separado dos scripts de estrutura, para não ser rodado por engano.
-- Antes de rodar: faça a cópia de segurança (ferramentas/backup/LEIA-ME.md). O script só apaga com a data dela.
--
-- Supabase > SQL Editor > New query > cole este arquivo inteiro.
-- 1) Rode primeiro o 00_verificar.sql e confira que não há nada real (equipe, fichas, visitas).
-- 2) Aqui embaixo, troque  'NAO'  por  'ZERAR'  na linha "confirmar". Depois clique em Run.
--    Sem essa troca, o script não apaga nada.
--
-- FICA:   você (coordenação geral), o seu login e os seus dados; parâmetros de custo; APLs por município;
--         documentos do projeto (aba Documentos: atas, ofícios). Se anexou documento de teste, arquive na tela.
-- SAI:    toda a equipe (coordenação técnica, auxiliar, professores, bolsistas, agentes) e os logins dela;
--         convites e pré-cadastros; contas bancárias; fichas; visitas; diagnósticos; avaliações;
--         custos de visita; turmas e matrículas do FIC; pedidos de pagamento; pedidos de passagem e evento;
--         pedidos de novo acesso; entregas do mês e ciências; respostas do roteiro de testes; códigos de acesso;
--         histórico (auditoria); dados de exemplo; fotos publicadas na vitrine (os arquivos entram na lista de remoção).
-- (atualizado em 29/09/2026 para as tabelas dos scripts 19 a 28)
-- ARQUIVOS: fotos e termos já enviados continuam no Storage. Para apagá-los, veja o passo 3 no fim.
-- =====================================================================
begin;

do $$
declare
  confirmar text := 'NAO';     -- <<< troque por 'ZERAR' para apagar
  copia_feita_em text := 'SEM COPIA';   -- <<< a data da cópia de segurança que VOCÊ fez e testou, no formato AAAA-MM-DD (ferramentas/backup/LEIA-ME.md)
  eu uuid; meu_login uuid; t text; lista text;
begin
  if confirmar <> 'ZERAR' then
    raise exception 'Nada foi apagado. Para zerar, troque NAO por ZERAR na linha "confirmar" e rode de novo.';
  end if;
  -- segunda trava (auditoria de 04/10/2026): só apaga com uma cópia de segurança feita hoje ou ontem
  if copia_feita_em !~ '^\d{4}-\d{2}-\d{2}$' or copia_feita_em::date > current_date or copia_feita_em::date < current_date - 1 then
    raise exception 'Nada foi apagado. Faça antes a cópia de segurança (ferramentas/backup/LEIA-ME.md) e escreva a data dela, de hoje ou de ontem, na linha "copia_feita_em".';
  end if;

  select id, user_id into eu, meu_login from public.equipe where papel = 'coord_geral' and status = 'ativa';
  if eu is null then raise exception 'Não achei a coordenação geral ativa. Nada foi apagado.'; end if;

  -- fotos da vitrine: o arquivo vai para a lista de remoção antes de a linha sair
  if to_regclass('public.vitrine_fotos') is not null and to_regclass('public.vitrine_remover') is not null then
    insert into public.vitrine_remover (path) select path from public.vitrine_fotos on conflict do nothing;
  end if;

  -- tabelas de movimento: saem inteiras (só as que existem neste banco)
  select string_agg(format('public.%I', x), ', ') into lista
    from unnest(array['avaliacoes','solicitacao_visitas','solicitacoes_pagamento','matriculas_fic','turmas_fic',
                      'custos_visita','vitrine_fotos','diagnosticos','visitas','fichas',
                      'pre_cadastros','convites','equipe_bancario','exemplo','auditoria',
                      'pedidos_apoio','pedidos_novo_acesso','entregas_mes','ciencias','testes_resultados','acesso_codigos']) as x
   where to_regclass('public.' || x) is not null;
  execute 'truncate table ' || lista;

  -- o que fica deixa de apontar para quem sai
  if to_regclass('public.parametros') is not null then
    update public.parametros set atualizado_por = null where atualizado_por is distinct from eu;
  end if;
  if to_regclass('public.apl_municipios') is not null then
    update public.apl_municipios set atualizado_por = null where atualizado_por is distinct from eu;
  end if;
  -- documentos do projeto (atas, ofícios) FICAM: são da coordenação geral; só deixam de apontar para quem sai
  if to_regclass('public.documentos_projeto') is not null then
    execute 'alter table public.documentos_projeto disable trigger user';
    execute 'update public.documentos_projeto set arquivado_por = null where arquivado_por is distinct from $1' using eu;
    execute 'update public.documentos_projeto set enviado_por = null where enviado_por is distinct from $1' using eu;
    execute 'alter table public.documentos_projeto enable trigger user';
  end if;

  -- equipe: fica só a coordenação geral (sem gatilhos, para não gerar histórico nem travas de regra)
  alter table public.equipe disable trigger user;
  if to_regclass('public.equipe_privado') is not null then
    execute 'alter table public.equipe_privado disable trigger user';
    execute 'delete from public.equipe_privado where equipe_id <> $1' using eu;
    execute 'alter table public.equipe_privado enable trigger user';
  end if;
  update public.equipe set criado_por = null, substitui_id = null where id = eu;
  delete from public.equipe where id <> eu;
  alter table public.equipe enable trigger user;

  -- logins de quem saiu (o seu fica)
  delete from auth.users where id is distinct from meu_login;
end $$;

commit;

select 'Banco zerado' as resultado,
  (select count(*) from public.equipe) as equipe_que_ficou,
  (select string_agg(nome || ' (' || papel || ')', ', ') from public.equipe) as quem_ficou,
  (select count(*) from public.fichas) as fichas,
  (select count(*) from auth.users) as logins;

-- ---------------------------------------------------------------------
-- 3) (opcional) Apagar os arquivos de teste no Storage
-- O Supabase não deixa apagar arquivo pelo SQL. Vá em Storage e, em cada bucket
-- (fichas, campo, equipe, termos, vitrine), clique nos três pontinhos > "Empty bucket".
-- Não apague o bucket em si, só esvazie.
-- ---------------------------------------------------------------------
