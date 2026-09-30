-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 37_execucao_planilhas.sql
\set QUIET on
truncate res;
select t('anônimo NÃO lê as planilhas', null, $q$select count(*) from public.execucao_planilhas$q$, 'permission denied');
select t('anônimo NÃO envia', null, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/a.xlsx', 'a.xlsx', '[{"v":1}]', 1)$q$, 'permission denied');
select t('técnica NÃO envia', :T, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/a.xlsx', 'a.xlsx', '[{"v":1}]', 1)$q$, 'row-level security');
select t('bolsista NÃO envia', :BB, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/a.xlsx', 'a.xlsx', '[{"v":1}]', 1)$q$, 'row-level security');
select t('geral envia a planilha', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/abc_gastos.xlsx', 'gastos.xlsx', '[{"item":"quintais","valor":200000}]', 200000)$q$, 'ok');
select f(:G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido) values (current_date - 3, '2026/set_gastos.xlsx', 'gastos setembro.xlsx', '[{"item":"quintais","valor":200000},{"item":"repasse_mda","valor":1000000}]', 200000, 1000000)$q$);
select t('técnica NÃO vê as planilhas', :T, $q$do $x$ begin if exists(select 1 from public.execucao_planilhas) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('bolsista NÃO vê as planilhas', :BB, $q$do $x$ begin if exists(select 1 from public.execucao_planilhas) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('geral vê as planilhas', :G, $q$do $x$ begin if not exists(select 1 from public.execucao_planilhas) then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('quem enviou e quando é o sistema que marca', :G, $q$do $x$ begin
  insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, enviado_por, enviado_em) values (current_date, '2026/forja.xlsx', 'f.xlsx', '[{"v":1}]', 1, null, '2020-01-01');
  if exists (select 1 from public.execucao_planilhas where arquivo_path = '2026/forja.xlsx' and (enviado_por is null or enviado_em < now() - interval '1 minute')) then raise exception 'forjou'; end if; end $x$ $q$, 'ok');
select t('data no futuro é recusada', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date + 2, '2026/b.xlsx', 'b.xlsx', '[{"v":1}]', 1)$q$, 'futuro');
select t('planilha sem linhas é recusada', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/c.xlsx', 'c.xlsx', '[]', 0)$q$, 'check');
select t('linhas que não são lista são recusadas', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/d.xlsx', 'd.xlsx', '{"a":1}', 0)$q$, 'check');
select t('caminho de arquivo esquisito é recusado', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '../../etc/passwd', 'e.xlsx', '[{"v":1}]', 1)$q$, 'Caminho');
select t('o mesmo arquivo não entra duas vezes', :G, $q$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto) values (current_date, '2026/set_gastos.xlsx', 'x.xlsx', '[{"v":1}]', 1)$q$, 'duplicate');
select t('ninguém altera uma planilha enviada (nem a geral)', :G, $q$update public.execucao_planilhas set total_gasto = 1$q$, 'permission denied');
select t('ninguém apaga uma planilha enviada (nem a geral)', :G, $q$delete from public.execucao_planilhas$q$, 'permission denied');
select t('envio vai para o histórico', :G, $q$do $x$ begin if not exists (select 1 from public.auditoria where tabela = 'execucao_planilhas') then raise exception 'sem histórico'; end if; end $x$ $q$, 'ok');
select t('pasta execucao: técnica NÃO envia arquivo', :T, $q$insert into storage.objects (bucket_id, name) values ('execucao', '2026/x.xlsx')$q$, 'row-level security');
select t('pasta execucao: geral envia arquivo', :G, $q$insert into storage.objects (bucket_id, name) values ('execucao', '2026/x.xlsx')$q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
