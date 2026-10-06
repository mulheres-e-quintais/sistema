-- 55_relatos_problema.sql: quem relata, quem lê, quem resolve e o que é recusado. Roda depois da suíte (usa t(), res e a equipe dela).
\set QUIET on
\pset format unaligned
\pset tuples_only on
truncate res;
select user_id as cg from public.equipe where papel = 'coord_geral' and status = 'ativa' and user_id is not null limit 1 \gset
select user_id as bo from public.equipe where papel in ('articulacao', 'apoio') and status = 'ativa' and user_id is not null limit 1 \gset
\set CG '''' :cg ''''
\set BO '''' :bo ''''
select t('quem não entrou não relata', null, $q$select public.relatar_problema('O botão de salvar não respondeu', 'campo', 'mq-v250', 'celular')$q$, 'permission denied');
select t('quem não entrou não lista', null, $q$select count(*) from public.listar_relatos()$q$, 'permission denied');
select t('relato curto demais é recusado', :BO, $q$select public.relatar_problema('travou', 'campo', 'mq-v250', 'celular')$q$, 'mais de detalhe');
select t('relato só de espaços é recusado', :BO, $q$select public.relatar_problema('                    ', 'campo', 'mq-v250', 'celular')$q$, 'mais de detalhe');
select t('relato longo demais é recusado', :BO, $q$select public.relatar_problema(repeat('a', 1001), 'campo', 'mq-v250', 'celular')$q$, 'até 1000');
select t('bolsista relata', :BO, $q$select public.relatar_problema('Outro relato de teste que não fica gravado', 'campo', 'mq-v250', 'celular')$q$, 'ok');
-- cenário gravado de verdade (t() desfaz o que faz; f() grava)
select f(:BO, $q$select public.relatar_problema('O botão de salvar a ficha   não respondeu quando toquei', 'campo', 'mq-v250', 'Android 14, 390x800')$q$);
select t('o relato guarda autora, perfil, tela, versão e o texto sem espaços repetidos', null, $q$do $$ declare r public.relatos_problema; begin perform set_config('role', 'none', true); select * into r from public.relatos_problema where tela = 'campo' limit 1;
  if r.autor_id is null or r.papel not in ('articulacao', 'apoio') or r.tela <> 'campo' or r.versao <> 'mq-v250' or r.texto <> 'O botão de salvar a ficha não respondeu quando toquei' or r.status <> 'aberto' then raise exception 'gravou errado: %', row_to_json(r); end if; end $$$q$, 'ok');
select f(:BO, $q$select public.relatar_problema('A tela ficou em branco depois de abrir o mapa', repeat('t', 200), repeat('v', 200), repeat('a', 900))$q$);
select t('campos longos de contexto são cortados, não recusados', null, $q$do $$ begin perform set_config('role', 'none', true); if (select count(*) from public.relatos_problema where length(tela) = 60 and length(versao) = 20 and length(aparelho) = 200) <> 1 then raise exception 'não cortou'; end if; end $$$q$, 'ok');
select t('bolsista vê os próprios relatos', :BO, $q$do $$ begin if (select count(*) from public.listar_relatos() where meu) <> 2 or (select count(*) from public.listar_relatos() where not meu) <> 0 then raise exception 'lista errada'; end if; end $$$q$, 'ok');
select f(:CG, $q$select public.relatar_problema('O relatório de custos abriu sem o total do mês', 'custos', 'mq-v250', 'Mac, 1440x900')$q$);
select t('bolsista não vê o relato de outra pessoa', :BO, $q$do $$ begin if (select count(*) from public.listar_relatos()) <> 2 then raise exception 'viu de outra pessoa'; end if; end $$$q$, 'ok');
select t('coordenação geral vê todos, com o nome de quem relatou', :CG, $q$do $$ begin if (select count(*) from public.listar_relatos()) <> 3 or (select count(*) from public.listar_relatos() where autor is null or autor = '') > 0 then raise exception 'lista errada'; end if; end $$$q$, 'ok');
select t('bolsista não marca como resolvido', :BO, $q$select public.resolver_relato((select id from public.listar_relatos() limit 1), 'ok', false)$q$, 'coordenação geral');
select t('coordenação geral marca como resolvido, com anotação', :CG, $q$do $$ declare i uuid := (select id from public.listar_relatos() where tela = 'campo' limit 1); begin perform public.resolver_relato(i, 'Corrigido na versão 251', false);
  if (select count(*) from public.listar_relatos() where id = i and status = 'resolvido' and nota = 'Corrigido na versão 251' and resolvido_em is not null) <> 1 then raise exception 'não resolveu'; end if; end $$$q$, 'ok');
select f(:CG, $q$select public.resolver_relato((select id from public.listar_relatos() where tela = 'custos' limit 1), 'Corrigido', false)$q$);
select t('os abertos vêm antes dos resolvidos', :CG, $q$do $$ begin if (select status from public.listar_relatos() limit 1) <> 'aberto' or (select status from (select status, row_number() over () n from public.listar_relatos()) x order by n desc limit 1) <> 'resolvido' then raise exception 'ordem errada'; end if; end $$$q$, 'ok');
select t('coordenação geral reabre', :CG, $q$do $$ declare i uuid := (select id from public.listar_relatos() where status = 'resolvido' limit 1); begin perform public.resolver_relato(i, null, true);
  if (select count(*) from public.listar_relatos() where id = i and status = 'aberto' and resolvido_em is null) <> 1 then raise exception 'não reabriu'; end if; end $$$q$, 'ok');
select t('anotação longa demais é recusada', :CG, $q$select public.resolver_relato((select id from public.listar_relatos() limit 1), repeat('n', 401), false)$q$, 'até 400');
select t('relato que não existe', :CG, $q$select public.resolver_relato(gen_random_uuid(), 'x', false)$q$, 'não encontrado');
select t('ninguém lê direto na tabela', :CG, $q$select count(*) from public.relatos_problema$q$, 'permission denied');
select t('ninguém grava direto na tabela', :BO, $q$insert into public.relatos_problema (autor_id, papel, texto) values (public.meu_id(), 'apoio', 'gravando direto na tabela')$q$, 'permission denied');
select t('relato não se apaga', null, $q$do $$ begin perform set_config('role', 'none', true); delete from public.relatos_problema; end $$$q$, 'não se apaga');
select t('o limite de 20 por dia vale', :BO, $q$do $$ begin for i in 1..25 loop perform public.relatar_problema('Relato repetido de teste número ' || i, 'campo', 'mq-v250', 'celular'); end loop; end $$$q$, '20 relatos');
insert into res(caso, ok, det) select 'a tabela tem segurança por linha ligada', relrowsecurity, '' from pg_class where oid = 'public.relatos_problema'::regclass;
insert into res(caso, ok, det) select 'visitante e equipe não têm permissão direta na tabela', not has_table_privilege('anon', 'public.relatos_problema', 'select,insert,update,delete') and not has_table_privilege('authenticated', 'public.relatos_problema', 'select,insert,update,delete'), '';
insert into res(caso, ok, det) select 'visitante (anon) não executa nenhuma das funções', not has_function_privilege('anon', 'public.relatar_problema(text, text, text, text)', 'execute') and not has_function_privilege('anon', 'public.listar_relatos()', 'execute') and not has_function_privilege('anon', 'public.resolver_relato(uuid, text, boolean)', 'execute'), '';
insert into res(caso, ok, det) select 'as funções têm o caminho de busca fixado', count(*) = 3, count(*)::text from pg_proc p where p.proname in ('relatar_problema', 'listar_relatos', 'resolver_relato') and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x = 'search_path=public, pg_temp');
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from res;
select 'FALHOU: ' || caso || ' -> ' || det from res where not ok;
