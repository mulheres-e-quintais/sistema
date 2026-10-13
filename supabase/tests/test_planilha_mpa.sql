-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, :BB, :A, :X, t(), f()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_planilha_mpa.sql
-- 60_planilha_e_mpa.sql: planilhas baixadas ficam no Histórico; tela do MPA com equipe habilitada e diagnósticos esperando.
\set QUIET on
truncate res;

-- ===== 1. planilhas no Histórico
select t('60. a coordenação geral registra a planilha completa', :G, $q$select public.registrar_planilha('completa', 37, 'Estado PI')$q$, 'ok');
select t('60. a coordenação técnica também (ela vê a Seleção)', :T, $q$select public.registrar_planilha('sem_documentos', 12, null)$q$, 'ok');
select t('60. bolsista não registra (não baixa as planilhas)', :BB, $q$select public.registrar_planilha('completa', 1, null)$q$, 'Só a coordenação');
select t('60. agente também não', :A, $q$select public.registrar_planilha('completa', 1, null)$q$, 'Só a coordenação');
select t('60. quem não entrou não chega à função', null, $q$select public.registrar_planilha('completa', 1, null)$q$, 'permission denied');
select t('60. tipo inventado é recusado', :G, $q$select public.registrar_planilha('tudo', 1, null)$q$, 'Tipo de planilha inválido');
select t('60. quantidade negativa é recusada', :G, $q$select public.registrar_planilha('completa', -1, null)$q$, 'Quantidade inválida');
select f(:G, $q$select public.registrar_planilha('completa', 37, 'Estado PI')$q$);
select t('60. fica no Histórico: quem, qual planilha, quantas fichas e o filtro', null, $q$do $x$ begin set local role none;
  if not exists (select 1 from public.auditoria a join public.equipe e on e.id = a.por where a.tabela = 'planilhas' and a.acao = 'PLANILHA' and e.papel = 'coord_geral'
                  and a.depois ->> 'tipo' = 'completa' and (a.depois ->> 'qtd')::int = 37 and a.depois ->> 'filtro' = 'Estado PI') then raise exception 'não ficou no histórico'; end if; end $x$$q$, 'ok');
select t('60. filtro comprido é cortado em 200 letras', :G, $q$do $x$ begin perform public.registrar_planilha('copia_dados', 5, repeat('x', 500)); set local role none;
  if (select max(length(depois ->> 'filtro')) from public.auditoria where tabela = 'planilhas') > 200 then raise exception 'não cortou'; end if; end $x$$q$, 'ok');

-- ===== 2. tela do MPA
select t('60. a coordenação vê a prévia do MPA com os 5 estados', :G, $q$do $x$ declare r jsonb := public.acompanhamento_equipe_uf('mpa'); begin
  if jsonb_array_length(r) <> 5 then raise exception 'não veio os 5 estados'; end if;
  if exists (select 1 from jsonb_array_elements(r) u where (u ->> 'habilitadas')::int > (u ->> 'equipe_campo')::int) then raise exception 'habilitadas maior que a equipe'; end if; end $x$$q$, 'ok');
select t('60. só contagens: nenhum nome, e-mail ou CPF na resposta', :G, $q$do $x$ declare r text := public.acompanhamento_equipe_uf('mpa')::text; begin
  if r ~ '@|nome|cpf' then raise exception 'vazou dado pessoal: %', r; end if; end $x$$q$, 'ok');
select t('60. bolsista não vê os números do acompanhamento', :BB, $q$select public.acompanhamento_equipe_uf('mpa')$q$, 'Acesso restrito');
select t('60. sem dizer o órgão, nem a coordenação vê (igual ao 52)', :G, $q$select public.acompanhamento_equipe_uf(null)$q$, 'Acesso restrito');
select t('60. quem não entrou não chega à função', null, $q$select public.acompanhamento_equipe_uf('mpa')$q$, 'permission denied');
-- observador do MPA (conta de acompanhamento ativa) vê; desativado, não
do $x$ begin insert into public.observadores (id, nome, email, orgao, status, user_id) values ('f6000000-0000-0000-0000-0000000000a1', 'Paulo Teste Sessenta', 'paulo60@mpa.exemplo', 'mpa', 'ativo', 'f6000000-0000-0000-0000-0000000000b1') on conflict (id) do nothing; end $x$;
select t('60. o observador do MPA vê a equipe habilitada por estado', 'f6000000-0000-0000-0000-0000000000b1', $q$do $x$ begin
  if jsonb_array_length(public.acompanhamento_equipe_uf()) <> 5 then raise exception 'não viu'; end if; end $x$$q$, 'ok');
update public.observadores set status = 'inativo' where id = 'f6000000-0000-0000-0000-0000000000a1';
select t('60. observador desativado não vê mais', 'f6000000-0000-0000-0000-0000000000b1', $q$select public.acompanhamento_equipe_uf()$q$, 'Acesso restrito');
-- contagem confere com a regra de habilitação do banco
select t('60. habilitadas = quem a regra habilitado() aprova, por estado', :G, $q$do $x$ declare u jsonb; esperado int; begin
  for u in select * from jsonb_array_elements(public.acompanhamento_equipe_uf('mpa')) loop
    select count(*) into esperado from public.equipe x where x.uf = u ->> 'uf' and x.status = 'ativa' and x.papel in ('articulacao', 'apoio', 'agente') and x.id not in (select id from public.exemplo) and public.habilitado(x);
    if (u ->> 'habilitadas')::int <> esperado then raise exception 'estado %: % em vez de %', u ->> 'uf', u ->> 'habilitadas', esperado; end if;
  end loop; end $x$$q$, 'ok');

select n || '|' || case when ok then 'PASSOU' else 'FALHOU' end || '|' || caso || '|' || coalesce(det, '') from res order by n;
