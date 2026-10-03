-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, t(), f(), ins(), cpf_t()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_limite_professores.sql
-- 50_limite_professores.sql: no máximo 2 professores do FIC ativos (cadastro direto e link de cadastro).
-- Os testes antigos foram escritos quando não havia limite e criam vários professores: a suíte começa tirando os dois
-- gatilhos do 50 (drop trigger equipe_limite_professores / convites_limite_professores) e este arquivo os recoloca só aqui dentro.
-- Tudo acontece numa transação desfeita no fim: não muda nada para os testes que vêm depois.
\set QUIET on
truncate res;
begin;
create trigger equipe_limite_professores before insert or update of status, papel on public.equipe for each row execute function public.equipe_limite_professores();
create trigger convites_limite_professores before insert on public.convites for each row execute function public.convites_limite_professores();
-- cenário: ficam ativos só os dois professores do test_cadastro_equipe.sql
alter table public.equipe disable trigger user;
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste do limite de professores'
 where papel = 'professor_fic' and status = 'ativa' and email not in ('prof0@t.com', 'prof1@t.com');
alter table public.equipe enable trigger user;
select t('cenário: 2 professores ativos', :G, $q$do $x$ begin if (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa') <> 2 then raise exception 'ativos: %', (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa'); end if; end $x$$q$, 'ok');

select t('3º professor é recusado no cadastro direto', :G, ins('professor_fic', '', 'Terceiro Professor Limite', cpf_t(96500000101), 'lim3@t.com'), 'no máximo 2 professores');
select t('link de cadastro de professor é recusado com as 2 vagas ocupadas', :G, $$select public.criar_convite('professor_fic')$$, 'no máximo 2 professores');
select t('a recusa não atrapalha as outras funções: link de agente continua saindo', :T, $$select public.criar_convite('agente', 'SE')$$, 'ok');
select t('editar um professor que já está ativo continua permitido', :G, $q$do $x$ begin update public.equipe set telefone = '(84) 98888-0000' where email = 'prof1@t.com'; if not found then raise exception 'não editou'; end if; end $x$$q$, 'ok');

-- com uma vaga aberta, volta a aceitar; e fecha de novo no segundo
alter table public.equipe disable trigger user;
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste do limite de professores' where email = 'prof1@t.com';
alter table public.equipe enable trigger user;
select t('com 1 ativo, o link de professor volta a sair', :G, $$select public.criar_convite('professor_fic')$$, 'ok');
select t('com 1 ativo, o cadastro direto volta a ser aceito', :G, ins('professor_fic', '', 'Segundo Professor Limite', cpf_t(96500000202), 'lim2@t.com'), 'ok');
select f(:G, ins('professor_fic', '', 'Segundo Professor Limite', cpf_t(96500000202), 'lim2@t.com'));
select t('depois de ocupar a vaga, o próximo é recusado de novo', :G, ins('professor_fic', '', 'Terceiro Professor Limite', cpf_t(96500000101), 'lim3@t.com'), 'no máximo 2 professores');
select t('quem não entrou não chama as funções do limite', null, $$select public.equipe_limite_professores()$$, 'permission denied');
select t('as duas funções esperam no máximo 5 segundos por trava', :G, $q$do $x$ begin
  if not exists (select 1 from pg_proc p where p.proname = 'equipe_limite_professores' and 'lock_timeout=5s' = any (coalesce(p.proconfig, '{}'))) then raise exception 'sem limite de espera'; end if; end $x$$q$, 'ok');

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 110) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
rollback;
