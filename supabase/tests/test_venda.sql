-- roda depois do test_cadastro_equipe.sql (usa :G, :BB, :A) e ANTES do test_conferencia_auxiliar.sql
-- 44_venda.sql
\set QUIET on
truncate res;
select uf as ufbb from public.equipe where user_id = :BB \gset
select case when :'ufbb' = 'PE' then 'SE' else 'PE' end as ufoutra \gset
select d.ficha_id as fdiag from public.diagnosticos d join public.fichas f on f.id = d.ficha_id where f.resultado = 'selecionada' and f.situacao = 'aprovada' limit 1 \gset
select id as fnao from public.fichas where not (resultado = 'selecionada' and situacao = 'aprovada') limit 1 \gset

select t('anônimo NÃO lê os canais', null, $q$select count(*) from public.canais_venda$q$, 'permission denied');
select t('anônimo NÃO cadastra canal', null, $q$select public.salvar_canal_venda(null, 'PI', 'Paulistana', 'feira', 'Feira do anônimo', null, null, true)$q$, 'permission denied');
select t('ninguém grava direto na tabela', :G, $q$insert into public.canais_venda (uf, municipio, tipo, nome) values ('PI', 'Paulistana', 'feira', 'Direto na tabela')$q$, 'permission denied');
select t('bolsista cadastra canal no próprio estado', :BB, format($q$select public.salvar_canal_venda(null, %L, 'Município Teste', 'feira', 'Feira de sábado', 'Praça do mercado', 'Dona Chica', true)$q$, :'ufbb'), 'ok');
select f(:BB, format($q$select public.salvar_canal_venda(null, %L, 'Município Teste', 'feira', 'Feira de sábado', 'Praça do mercado', 'Dona Chica', true)$q$, :'ufbb'));
select t('canal repetido é recusado', :BB, format($q$select public.salvar_canal_venda(null, %L, 'município teste', 'feira', 'FEIRA DE SÁBADO', null, null, true)$q$, :'ufbb'), 'já está cadastrado');
select t('bolsista NÃO cadastra em outro estado', :BB, format($q$select public.salvar_canal_venda(null, %L, 'Outro', 'feira', 'Feira de lá', null, null, true)$q$, :'ufoutra'), 'só do seu estado');
select t('agente NÃO cadastra canal', :A, format($q$select public.salvar_canal_venda(null, %L, 'Município Teste', 'grupo', 'Grupo da agente', null, null, true)$q$, :'ufbb'), 'coordenação ou a bolsista');
select t('tipo inválido é recusado', :G, $q$select public.salvar_canal_venda(null, 'PI', 'Paulistana', 'loja', 'Canal qualquer', null, null, true)$q$, 'tipo de canal');
select t('coordenação geral cadastra em qualquer estado', :G, format($q$select public.salvar_canal_venda(null, %L, 'Outro Município', 'merenda', 'Secretaria de Educação', null, null, true)$q$, :'ufoutra'), 'ok');
select f(:G, format($q$select public.salvar_canal_venda(null, %L, 'Outro Município', 'merenda', 'Secretaria de Educação', null, null, true)$q$, :'ufoutra'));
select t('bolsista lê só os canais do próprio estado', :BB, $q$do $x$ begin
  if not exists (select 1 from public.canais_venda) then raise exception 'não leu o próprio'; end if;
  if exists (select 1 from public.canais_venda where uf <> public.minha_uf()) then raise exception 'leu outro estado'; end if; end $x$$q$, 'ok');
select t('desativar guarda o canal (não apaga) e o estado não muda', :BB, format($q$do $x$ declare c uuid; begin
  select id into c from public.canais_venda where nome = 'Feira de sábado';
  perform public.salvar_canal_venda(c, %L, 'Município Teste', 'feira', 'Feira de sábado', null, null, false);
  if (select ativo from public.canais_venda where id = c) then raise exception 'continuou ativo'; end if;
  if (select uf from public.canais_venda where id = c) <> public.minha_uf() then raise exception 'mudou de estado'; end if; end $x$$q$, :'ufoutra'), 'ok');
select t('ninguém apaga canal (nem a geral)', :G, $q$delete from public.canais_venda$q$, 'permission denied');
select t('canal vai para o histórico', :G, $q$do $x$ begin if not exists (select 1 from public.auditoria where tabela = 'canais_venda') then raise exception 'sem histórico'; end if; end $x$$q$, 'ok');
-- orientação
select t('orientação sem a resposta do CAF é recusada', :G, format($q$select public.registrar_orientacao_venda(%L, '{"sobra": []}')$q$, :'fdiag'), 'CAF');
select t('orientação sem dizer o que sobra é recusada', :G, format($q$select public.registrar_orientacao_venda(%L, '{"caf": "sim"}')$q$, :'fdiag'), 'sobrando');
select t('orientação só para mulher selecionada e aprovada', :G, format($q$select public.registrar_orientacao_venda(%L, '{"sobra": [], "caf": "sim"}')$q$, :'fnao'), 'selecionada e aprovada');
select t('coordenação registra a orientação', :G, format($q$select public.registrar_orientacao_venda(%L, '{"sobra": [{"produto": "hortalicas", "regular": true}], "caf": "nao", "grupo": false}')$q$, :'fdiag'), 'ok');
select t('anônimo NÃO registra orientação', null, format($q$select public.registrar_orientacao_venda(%L, '{"sobra": [], "caf": "sim"}')$q$, :'fdiag'), 'permission denied');
select t('orientação registrada não se altera nem se apaga', null, format($q$do $x$ begin set local role none;
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.orientacoes_venda (ficha_id, uf, dados) select id, uf, '{"sobra": [], "caf": "sim"}' from public.fichas where id = %L;
  update public.orientacoes_venda set dados = '{}'; end $x$$q$, :'fdiag'), 'não se altera');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
