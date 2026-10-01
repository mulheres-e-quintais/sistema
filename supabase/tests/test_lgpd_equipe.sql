-- roda depois do test_cadastro_equipe.sql (usa :G, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 43_lgpd_equipe.sql
\set QUIET on
truncate res;
select t('bolsista NÃO lê o cadastro completo das colegas do estado', :BB, $q$do $x$ begin
  if exists (select 1 from public.equipe where user_id is distinct from auth.uid()) then raise exception 'leu %', (select count(*) from public.equipe where user_id is distinct from auth.uid()); end if; end $x$$q$, 'ok');
select t('bolsista lê o próprio cadastro completo', :BB, $q$do $x$ begin
  if (select cpf from public.equipe where user_id = auth.uid()) is null then raise exception 'sem o próprio'; end if; end $x$$q$, 'ok');
select count(*) - 1 as colegas from public.equipe where uf = (select uf from public.equipe where user_id = :BB) \gset
select t('bolsista vê as colegas do estado com os dados de trabalho', :BB, format($q$do $x$ begin
  if (select count(*) from public.equipe_do_estado()) <> %s then raise exception 'viu %% de %s', (select count(*) from public.equipe_do_estado()); end if;
  if exists (select 1 from public.equipe_do_estado() x where x.uf <> public.minha_uf()) then raise exception 'viu outro estado'; end if; end $x$$q$, :colegas, :colegas), 'ok');
select t('a lista da bolsista não tem CPF, e-mail nem SIAPE', null, $q$do $x$ begin set local role none;
  if exists (select 1 from pg_proc p where p.proname = 'equipe_do_estado' and (pg_get_function_result(p.oid) ~* '\m(cpf|email|siape|obs_habilitacao|motivo_desligamento|termo_path)\M')) then raise exception 'tem dado pessoal'; end if; end $x$$q$, 'ok');
select t('desligada aparece sem telefone', null, $q$do $x$ begin set local role none;
  if (select prosrc from pg_proc where proname = 'equipe_do_estado') not like '%when e.status = ''ativa'' then e.telefone%' then raise exception 'telefone de desligada'; end if; end $x$$q$, 'ok');
select t('coordenação geral continua lendo tudo', :G, $q$do $x$ begin if not exists (select 1 from public.equipe where cpf is not null and user_id is distinct from auth.uid()) then raise exception 'não leu'; end if; end $x$$q$, 'ok');
select t('coordenação geral NÃO usa a lista da bolsista (vem vazia)', :G, $q$do $x$ begin if exists (select 1 from public.equipe_do_estado()) then raise exception 'veio'; end if; end $x$$q$, 'ok');
select t('anônimo não chama a lista da bolsista', null, $q$select * from public.equipe_do_estado()$q$, 'permission denied');
select t('o app não gera código da coordenação geral (só o SQL Editor)', :G, $q$select public.codigo_coordenacao_geral()$q$, 'permission denied');
select t('quem já entrou fica registrado (coordenação geral precisa de código para recriar a senha)', null, $q$do $x$ begin set local role none;
  if (select prosrc from pg_proc where proname = 'ligar_conta_criada') not like '%insert into public.contas_ja_ligadas%' then raise exception 'não registra'; end if;
  if (select prosrc from pg_proc where proname = 'bloquear_conta_nao_cadastrada') not like '%not exists (select 1 from public.contas_ja_ligadas%' then raise exception 'não exige código'; end if; end $x$$q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
