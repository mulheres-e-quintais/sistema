-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :P) e ANTES do test_conferencia_auxiliar.sql
-- 41_desligamento.sql. Cada caso roda dentro de t(), que desfaz tudo no fim.
\set QUIET on
truncate res;
select id as dprof from public.equipe where user_id = :P and status = 'ativa' \gset
select id as dtec from public.equipe where user_id = :T and status = 'ativa' \gset
-- cenário: turma em andamento do professor e 3 pedidos da técnica (enviado, conferido, autorizado)
insert into public.turmas_fic (nome, professor_id, inicio) values ('Turma teste desligamento', :'dprof', current_date - 10);
set session_replication_role = replica;
insert into public.pedidos_apoio (tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, obs) values
  ('passagem', 'PI', :'dtec', 'Pedido enviado do teste', current_date + 30, '{"valor_estimado": 800}', 'enviado', null),
  ('passagem', 'PI', :'dtec', 'Pedido conferido do teste', current_date + 30, '{"valor_estimado": 900}', 'conferido', 'Conferido sem ressalvas'),
  ('passagem', 'PI', :'dtec', 'Pedido autorizado do teste', current_date + 30, '{"valor_estimado": 700}', 'autorizado', null);
set session_replication_role = origin;

select t('professor com turma em andamento NÃO é desligado', :G, format($q$update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'Teste de desligamento' where id = %L$q$, :'dprof'), 'Turma teste desligamento');
select t('turma passada para outra pessoa: aí desliga', :G, format($q$do $x$ begin
  update public.turmas_fic set professor_id = (select id from public.equipe where papel = 'professor_fic' and status = 'ativa' and id <> %L limit 1) where professor_id = %L;
  update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'Teste de desligamento' where id = %L; end $x$$q$, :'dprof', :'dprof', :'dprof'), 'ok');
select t('turma encerrada não segura o desligamento', null, format($q$do $x$ begin
  set local role none;
  alter table public.turmas_fic disable trigger user;
  update public.turmas_fic set fim = current_date - 1 where professor_id = %L;
  alter table public.turmas_fic enable trigger user;
  update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'Teste de desligamento' where id = %L; end $x$$q$, :'dprof', :'dprof'), 'ok');
select t('desligar cancela os pedidos não autorizados e mantém o autorizado', null, format($q$do $x$ declare r record; begin
  set local role none;
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Teste de desligamento' where id = %L;
  for r in select titulo, situacao, obs from public.pedidos_apoio where solicitante_id = %L and titulo like '%%do teste' loop
    if r.titulo like 'Pedido autorizado%%' and r.situacao <> 'autorizado' then raise exception 'mexeu no autorizado'; end if;
    if r.titulo not like 'Pedido autorizado%%' and r.situacao <> 'cancelado' then raise exception 'não cancelou %%', r.titulo; end if;
    if r.titulo like 'Pedido enviado%%' and r.obs <> 'Cancelado pelo sistema: a solicitante foi desligada do projeto em ' || to_char(public.fic_hoje(), 'DD/MM/YYYY') || '.' then raise exception 'obs errada: %%', r.obs; end if;
    if r.titulo like 'Pedido conferido%%' and r.obs not like 'Conferido sem ressalvas · Cancelado pelo sistema%%' then raise exception 'perdeu a obs anterior: %%', r.obs; end if;
  end loop; end $x$$q$, :'dtec', :'dtec'), 'ok');
select t('quem continua ativa não tem pedido cancelado', null, $q$do $x$ begin set local role none;
  if exists (select 1 from public.pedidos_apoio where titulo like '%do teste' and situacao = 'cancelado') then raise exception 'cancelou sem desligar'; end if; end $x$$q$, 'ok');

-- limpa o cenário (pedidos e turma do teste não existem fora daqui)
set session_replication_role = replica;
delete from public.pedidos_apoio where titulo like '%do teste' and solicitante_id = :'dtec';
delete from public.turmas_fic where nome = 'Turma teste desligamento';
set session_replication_role = origin;
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
