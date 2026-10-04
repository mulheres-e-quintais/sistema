-- =====================================================================
-- Mulheres & Quintais — 99: ZERAR TODO O BANCO (02/10/2026)
-- ATENÇÃO: APAGA DE VEZ. NÃO TEM COMO DESFAZER. Não há lixeira nem "voltar".
-- Este arquivo fica na pasta supabase/perigo/, separado dos scripts de estrutura, para não ser rodado por engano.
-- Antes de rodar: faça a cópia de segurança (ferramentas/backup/LEIA-ME.md). O script só apaga com a data dela.
--
-- Supabase > SQL Editor > New query > cole este arquivo inteiro.
-- Para funcionar, troque  'NAO'  por  'ZERAR'  na linha "confirmar" aqui embaixo e clique em Run.
-- Sem essa troca, o script não apaga nada.
--
-- FICA:  a coordenação geral (o seu cadastro, os seus dados pessoais e o seu login); os parâmetros de custo
--        (valor da hora, refeição, combustível); e toda a ESTRUTURA do sistema (tabelas, regras, permissões:
--        não é preciso rodar de novo nenhum script do 01 ao 47).
-- SAI:   TODO o resto, de todas as tabelas: equipe (coordenação técnica, auxiliar, professores, bolsistas, agentes)
--        e os logins dela; convites e pré-cadastros; contas bancárias; fichas das mulheres; visitas; diagnósticos;
--        avaliações; custos de visita; turmas, matrículas, encontros e presenças do FIC; pedidos de pagamento;
--        pedidos de passagem e evento; planilhas e lançamentos de execução; documentos do projeto; arranjos
--        produtivos (APL); canais de venda e orientações de venda; situação da água; fotos da vitrine; entregas do mês;
--        respostas do roteiro de testes; códigos e pedidos de acesso; últimos acessos; histórico (auditoria);
--        e os dados de exemplo.
-- ARQUIVOS: fotos, termos e documentos já enviados continuam no Storage (o Supabase não deixa apagar arquivo
--        pelo SQL). Para apagá-los, veja o passo no fim deste arquivo.
-- =====================================================================
begin;

do $$
declare
  confirmar text := 'NAO';     -- <<< troque por 'ZERAR' para apagar
  copia_feita_em text := 'SEM COPIA';   -- <<< a data da cópia de segurança que VOCÊ fez e testou, no formato AAAA-MM-DD (ferramentas/backup/LEIA-ME.md)
  eu uuid; meu_login uuid; n int; lista text;
  ficam text[] := array['equipe', 'equipe_privado', 'parametros'];
begin
  if confirmar <> 'ZERAR' then
    raise exception 'Nada foi apagado. Para zerar, troque NAO por ZERAR na linha "confirmar" e rode de novo.';
  end if;
  -- segunda trava (auditoria de 04/10/2026): só apaga com uma cópia de segurança feita hoje ou ontem
  if copia_feita_em !~ '^\d{4}-\d{2}-\d{2}$' or copia_feita_em::date > current_date or copia_feita_em::date < current_date - 1 then
    raise exception 'Nada foi apagado. Faça antes a cópia de segurança (ferramentas/backup/LEIA-ME.md) e escreva a data dela, de hoje ou de ontem, na linha "copia_feita_em".';
  end if;

  select count(*) into n from public.equipe where papel = 'coord_geral' and status = 'ativa';
  if n <> 1 then raise exception 'Esperava UMA coordenação geral ativa e achei %. Nada foi apagado.', n; end if;
  select id, user_id into eu, meu_login from public.equipe where papel = 'coord_geral' and status = 'ativa';
  if meu_login is null then raise exception 'A coordenação geral ainda não tem login (senha criada). Nada foi apagado: crie a sua senha primeiro, para não ficar sem acesso.'; end if;

  -- todas as tabelas do sistema, menos as três que ficam: saem inteiras
  select string_agg(format('public.%I', c.relname), ', ') into lista
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and c.relname <> all (ficam);
  if lista is not null then execute 'truncate table ' || lista; end if;

  -- o que fica deixa de apontar para quem sai
  update public.parametros set atualizado_por = null where atualizado_por is distinct from eu;

  -- equipe: fica só a coordenação geral (sem gatilhos, para não gerar histórico nem esbarrar em regra)
  alter table public.equipe disable trigger user;
  alter table public.equipe_privado disable trigger user;
  delete from public.equipe_privado where equipe_id <> eu;
  update public.equipe set criado_por = null, substitui_id = null where id = eu;
  delete from public.equipe where id <> eu;
  alter table public.equipe_privado enable trigger user;
  alter table public.equipe enable trigger user;

  -- a sua conta continua marcada como "já entrou" (recriar a senha da coordenação geral exige código: script 43)
  if to_regclass('public.contas_ja_ligadas') is not null then
    execute 'insert into public.contas_ja_ligadas (equipe_id) values ($1) on conflict do nothing' using eu;
  end if;

  -- logins de quem saiu (o seu fica)
  delete from auth.users where id is distinct from meu_login;

  -- o histórico começa do zero (as linhas geradas por esta própria limpeza também saem)
  truncate table public.auditoria;
end $$;

commit;

select case when (select count(*) from public.equipe) = 1 and (select count(*) from public.fichas) = 0 then 'Banco zerado' else 'NADA FOI APAGADO (veja a mensagem de erro acima)' end as resultado,
  (select string_agg(nome || ' (' || papel || ')', ', ') from public.equipe) as quem_ficou,
  (select count(*) from auth.users) as logins,
  (select count(*) from public.fichas) as fichas,
  (select count(*) from public.visitas) as visitas,
  (select count(*) from public.auditoria) as historico,
  (select count(*) from public.exemplo) as exemplos;

-- ---------------------------------------------------------------------
-- Arquivos no Storage (fotos, termos, documentos, planilhas)
-- O Supabase não deixa apagar arquivo pelo SQL. Vá em Storage e, em cada bucket, clique nos três pontinhos >
-- "Empty bucket". Não apague o bucket em si, só esvazie.
-- ---------------------------------------------------------------------
