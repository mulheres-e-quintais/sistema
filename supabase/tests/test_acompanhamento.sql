-- 52_acompanhamento.sql: quem cadastra, como entra, o que vê e, principalmente, o que NÃO vê.
-- Roda depois da suíte (usa t(), f(), res e a equipe dela), com o 52 já instalado. Tudo é desfeito no fim.
\set QUIET on
\pset format unaligned
\pset tuples_only on
truncate res;
begin;
select user_id as cg from public.equipe where papel = 'coord_geral' and status = 'ativa' and user_id is not null limit 1 \gset
select user_id as bo from public.equipe where papel in ('articulacao', 'apoio') and status = 'ativa' and user_id is not null limit 1 \gset
select email as emeq from public.equipe where status = 'ativa' limit 1 \gset
\set CG '''' :cg ''''
\set BO '''' :bo ''''

-- ===== cadastro: só a coordenação geral =====
select t('bolsista não cadastra quem acompanha', :BO, $q$select public.salvar_observador(null, 'Fulana de Tal', 'fulana@mda.exemplo', 'mda', null, true)$q$, 'coordenação geral');
select t('quem não entrou não cadastra', null, $q$select public.salvar_observador(null, 'Fulana de Tal', 'fulana@mda.exemplo', 'mda', null, true)$q$, 'permission denied');
select t('órgão inválido é recusado', :CG, $q$select public.salvar_observador(null, 'Fulana de Tal', 'fulana@mda.exemplo', 'funcern', null, true)$q$, 'MDA ou MPA');
select t('e-mail inválido é recusado', :CG, $q$select public.salvar_observador(null, 'Fulana de Tal', 'sem-arroba', 'mda', null, true)$q$, 'inválido');
select t('nome curto é recusado', :CG, $q$select public.salvar_observador(null, 'Ana', 'ana@mda.exemplo', 'mda', null, true)$q$, 'nome completo');
select t('e-mail de alguém da equipe é recusado', :CG, format($q$select public.salvar_observador(null, 'Pessoa da Equipe', %L, 'mda', null, true)$q$, upper(:'emeq')), 'já é de uma pessoa da equipe');
select f(:CG, $q$select public.salvar_observador(null, '  Marta   Observadora  ', 'Marta@MDA.exemplo', 'mda', 'Analista', true)$q$);
select f(:CG, $q$select public.salvar_observador(null, 'Paulo Parceiro Silva', 'paulo@mpa.exemplo', 'mpa', null, true)$q$);
select id as om from public.observadores where email = 'marta@mda.exemplo' \gset
select id as op from public.observadores where email = 'paulo@mpa.exemplo' \gset
insert into res(caso, ok, det) select 'nome sem espaços sobrando e e-mail em minúsculas', nome = 'Marta Observadora' and email = 'marta@mda.exemplo', nome || ' / ' || email from public.observadores where id = :'om';
select t('e-mail repetido (com maiúsculas) é recusado', :CG, $q$select public.salvar_observador(null, 'Outra Marta', 'MARTA@mda.exemplo', 'mpa', null, true)$q$, 'já está cadastrado');
insert into res(caso, ok, det) select 'cadastro fica no histórico, sem o código', exists (select 1 from public.auditoria a where a.tabela = 'observadores' and a.registro_id = :'om' and a.acao = 'INSERT' and not (a.depois ? 'codigo_hash')), '';
select t('bolsista não lista quem acompanha', :BO, $q$select public.listar_observadores()$q$, 'coordenação geral');
select t('bolsista não lê a tabela direto', :BO, $q$select * from public.observadores$q$, 'permission denied');
select t('coordenação geral não lê a tabela direto (só pela função)', :CG, $q$select * from public.observadores$q$, 'permission denied');
select t('coordenação geral lista as duas pessoas, sem o código', :CG, $q$do $$ declare j jsonb := public.listar_observadores(); begin if jsonb_array_length(j) <> 2 or j::text like '%codigo_hash%' then raise exception 'lista errada: %', j; end if; end $$$q$, 'ok');
select t('bolsista não gera código', :BO, format($q$select public.gerar_codigo_observador(%L)$q$, :'om'), 'coordenação geral');

-- ===== primeiro acesso =====
select set_config('request.jwt.claim.sub', :CG, true); set local role authenticated;
select public.gerar_codigo_observador(:'om') as cod \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
insert into res(caso, ok, det) select 'o código tem o formato XXXX-XXXX e só o resumo dele fica guardado', :'cod' ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$' and codigo_hash is not null and codigo_hash <> :'cod' and position(replace(:'cod', '-', '') in codigo_hash) = 0, '' from public.observadores where id = :'om';
create or replace function pg_temp.entra(p_email text, p_cod text) returns text language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), p_email, jsonb_build_object('codigo', p_cod));
  return 'ok';
exception when others then return sqlerrm; end $$;
insert into res(caso, ok, det) select 'e-mail desconhecido não cria senha', x like '%não cadastrado%', x from pg_temp.entra('estranho@x.exemplo', :'cod') x;
insert into res(caso, ok, det) select 'código errado não cria senha', x like '%errado%', x from pg_temp.entra('marta@mda.exemplo', 'AAAA-AAAA') x;
insert into res(caso, ok, det) select 'sem código não cria senha', x like '%errado%', x from pg_temp.entra('marta@mda.exemplo', null) x;
insert into res(caso, ok, det) select 'o código de uma pessoa não serve para outra', x like '%não gerado%' or x like '%errado%', x from pg_temp.entra('paulo@mpa.exemplo', :'cod') x;
update public.observadores set codigo_expira = now() - interval '1 minute' where id = :'om';
insert into res(caso, ok, det) select 'código vencido não cria senha', x like '%vencido%', x from pg_temp.entra('marta@mda.exemplo', :'cod') x;
update public.observadores set codigo_expira = now() + interval '1 day' where id = :'om';
insert into res(caso, ok, det) select 'código certo cria a senha (e-mail com maiúsculas também vale)', x = 'ok', x from pg_temp.entra('Marta@mda.exemplo', lower(replace(:'cod', '-', ' '))) x;
insert into res(caso, ok, det) select 'a conta fica ligada ao cadastro e o código é queimado', user_id is not null and codigo_hash is null and codigo_expira is null, '' from public.observadores where id = :'om';
insert into res(caso, ok, det) select 'o mesmo código não cria uma segunda conta', x <> 'ok', x from pg_temp.entra('marta@mda.exemplo', :'cod') x;
insert into res(caso, ok, det) select 'a conta de acompanhamento não entra na equipe', not exists (select 1 from public.equipe e where e.user_id = (select user_id from public.observadores where id = :'om')), '';
select set_config('request.jwt.claim.sub', :CG, true); set local role authenticated;
select public.gerar_codigo_observador(:'op') as cod2 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
select pg_temp.entra('paulo@mpa.exemplo', :'cod2') as e2 \gset
select user_id as um from public.observadores where id = :'om' \gset
select user_id as up from public.observadores where id = :'op' \gset
\set UM '''' :um ''''
\set UP '''' :up ''''

-- ===== o que quem acompanha vê =====
select t('MDA: o sistema reconhece quem é', :UM, $q$do $$ declare j jsonb := public.acompanhamento_eu(); begin if j->>'orgao' <> 'mda' or j->>'nome' <> 'Marta Observadora' then raise exception '%', j; end if; end $$$q$, 'ok');
select t('pessoa da equipe não é reconhecida como acompanhamento', :BO, $q$do $$ begin if public.acompanhamento_eu() is not null then raise exception 'reconheceu'; end if; end $$$q$, 'ok');
select t('MDA recebe os números, com perfil e impacto e sem formação', :UM, $q$do $$ declare j jsonb := public.acompanhamento_dados(); begin
  if j->>'orgao' <> 'mda' or jsonb_array_length(j->'por_uf') <> 5 or not (j ? 'perfil') or not (j ? 'impacto') or (j ? 'formacao') then raise exception 'forma errada'; end if; end $$$q$, 'ok');
select t('MPA recebe os números, com formação e sem perfil nem impacto', :UP, $q$do $$ declare j jsonb := public.acompanhamento_dados(); begin
  if j->>'orgao' <> 'mpa' or jsonb_array_length(j->'por_uf') <> 5 or not (j ? 'formacao') or (j ? 'perfil') or (j ? 'impacto') then raise exception 'forma errada'; end if; end $$$q$, 'ok');
select t('MDA pedindo a visão do MPA continua recebendo a do MDA', :UM, $q$do $$ begin if public.acompanhamento_dados('mpa')->>'orgao' <> 'mda' then raise exception 'trocou'; end if; end $$$q$, 'ok');
select t('nenhuma parte financeira nos números (nem chave, nem valor em reais)', :UM, $q$do $$ declare x text := public.acompanhamento_dados()::text; begin
  if x ~* 'bolsa|pagament|orcament|execu|saldo|pix|banco|ajuda_custo|valor_|kit_total|teto' then raise exception 'tem parte financeira'; end if; end $$$q$, 'ok');
-- os números batem com a contagem direta
select set_config('request.jwt.claim.sub', :UM, true); set local role authenticated;
select public.acompanhamento_dados() as jm \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
insert into res(caso, ok, det) select 'selecionadas por estado batem com a contagem direta', bool_and((u->>'selecionadas')::int = (select count(*) from public.fichas f where f.uf = u->>'uf' and f.resultado = 'selecionada' and f.situacao = 'aprovada' and f.id not in (select id from public.exemplo))), '' from jsonb_array_elements(:'jm'::jsonb->'por_uf') u;
insert into res(caso, ok, det) select 'diagnósticos por estado batem', bool_and((u->>'diagnosticos')::int = (select count(*) from public.diagnosticos d where d.uf = u->>'uf' and d.ficha_id not in (select id from public.exemplo))), '' from jsonb_array_elements(:'jm'::jsonb->'por_uf') u;
insert into res(caso, ok, det) select 'visitas feitas por estado batem', bool_and((u->>'visitas_feitas')::int = (select count(*) from public.visitas v where v.uf = u->>'uf' and v.situacao = 'realizada' and v.ficha_id not in (select id from public.exemplo))), '' from jsonb_array_elements(:'jm'::jsonb->'por_uf') u;
insert into res(caso, ok, det) select 'a soma dos municípios é igual ao total de selecionadas', (select coalesce(sum((m->>'n')::int), 0) from jsonb_array_elements(:'jm'::jsonb->'municipios') m) = (select sum((u->>'selecionadas')::int) from jsonb_array_elements(:'jm'::jsonb->'por_uf') u), '';
insert into res(caso, ok, det) select 'a soma dos meses é igual ao total de visitas feitas', (select coalesce(sum((m->>'diagnostico')::int + (m->>'implantacao')::int + (m->>'acompanhamento')::int + (m->>'avaliacao')::int), 0) from jsonb_array_elements(:'jm'::jsonb->'mensal') m) = (select sum((u->>'visitas_feitas')::int) from jsonb_array_elements(:'jm'::jsonb->'por_uf') u), '';
insert into res(caso, ok, det) select 'há dados de verdade no cenário (o teste não passa por estar tudo zerado)', (select sum((u->>'indicadas')::int) from jsonb_array_elements(:'jm'::jsonb->'por_uf') u) > 0, (select sum((u->>'indicadas')::int) from jsonb_array_elements(:'jm'::jsonb->'por_uf') u)::text;
-- nenhum dado pessoal no que sai
insert into res(caso, ok, det) select 'nenhum nome de beneficiária aparece nos números', not exists (select 1 from public.fichas f where position(lower(f.nome) in lower(:'jm')) > 0), '';
insert into res(caso, ok, det) select 'nenhum CPF de beneficiária aparece', not exists (select 1 from public.fichas f where position(f.cpf in :'jm') > 0), '';
insert into res(caso, ok, det) select 'nenhum nome, CPF ou e-mail da equipe aparece', not exists (select 1 from public.equipe e where position(lower(e.nome) in lower(:'jm')) > 0 or position(e.cpf in :'jm') > 0 or position(lower(e.email::text) in lower(:'jm')) > 0), '';
insert into res(caso, ok, det) select 'nenhum endereço, comunidade ou celular aparece', not exists (select 1 from public.fichas f where position(lower(f.endereco) in lower(:'jm')) > 0 or (length(f.comunidade) > 6 and position(lower(f.comunidade) in lower(:'jm')) > 0) or (f.celular is not null and length(f.celular) > 7 and position(f.celular in :'jm') > 0)), '';
insert into res(caso, ok, det) select 'contagem de 1 a 4 vira "menos de 5"; zero e 5 ou mais saem como são', public.acomp_n(0) = 0 and public.acomp_n(1) = -1 and public.acomp_n(4) = -1 and public.acomp_n(5) = 5 and public.acomp_n(200) = 200, '';
-- dado de exemplo fica fora
insert into public.exemplo (tabela, id) select 'fichas', id from public.fichas where uf = 'AL' on conflict do nothing;
select t('ficha marcada como exemplo sai das contas', :UM, $q$do $$ declare j jsonb := public.acompanhamento_dados(); begin
  if (select (u->>'indicadas')::int + (u->>'diagnosticos')::int + (u->>'visitas_feitas')::int from jsonb_array_elements(j->'por_uf') u where u->>'uf' = 'AL') <> 0 then raise exception 'exemplo contado'; end if;
  if exists (select 1 from jsonb_array_elements(j->'municipios') m where m->>'uf' = 'AL') then raise exception 'município de exemplo'; end if; end $$$q$, 'ok');
delete from public.exemplo where tabela = 'fichas' and id in (select id from public.fichas where uf = 'AL');

-- ===== o que quem acompanha NÃO alcança =====
do $$ declare r record; msg text; n bigint; u uuid := (select user_id from public.observadores where email = 'marta@mda.exemplo'); begin
  for r in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm') and c.relname <> 'res' order by 1 loop
    begin
      perform set_config('request.jwt.claim.sub', u::text, true); perform set_config('role', 'authenticated', true);
      execute format('select count(*) from public.%I', r.relname) into n; msg := n::text;
    exception when others then msg := 'negado'; end;
    perform set_config('role', 'none', true);
    insert into res(caso, ok, det) values ('acompanhamento não lê nenhuma linha de ' || r.relname, msg in ('0', 'negado'), msg);
  end loop; end $$;
select t('acompanhamento não é reconhecido como equipe', :UM, $q$do $$ begin if public.meu_papel() is not null or public.meu_id() is not null or (public.vincular_conta()).id is not null then raise exception 'virou equipe'; end if; end $$$q$, 'ok');
select count(*) as nf0 from public.fichas \gset
select t('acompanhamento não grava ficha (a gravação é recusada)', :UM, $q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, consent_dados, resultado)
  values (gen_random_uuid(), 'PI', 'Picos', 'Sitio Novo', 'Maria Invasora da Silva', '52998224725', '1980-01-01', 'Sitio Novo 1', true, true, true, true, true, true, true, true, true, 'selecionada')$q$, 'e');
insert into res(caso, ok, det) select 'nenhuma ficha entrou pela tentativa do acompanhamento', count(*) = :nf0, count(*)::text from public.fichas;
select t('acompanhamento não altera equipe', :UM, $q$do $$ declare n int; begin update public.equipe set nome = 'Invadido' where true; get diagnostics n = row_count; if n > 0 then raise exception 'alterou %', n; end if; end $$$q$, 'ok');
select t('acompanhamento não cadastra outro acompanhamento', :UM, $q$select public.salvar_observador(null, 'Colega Indevido', 'colega@mda.exemplo', 'mda', null, true)$q$, 'coordenação geral');
select t('acompanhamento não lista os colegas', :UM, $q$select public.listar_observadores()$q$, 'coordenação geral');
select t('acompanhamento não gera código', :UM, format($q$select public.gerar_codigo_observador(%L)$q$, :'op'), 'coordenação geral');
select t('acompanhamento não altera preço do kit', :UM, $q$select public.salvar_kit_item(null, 'Arame', 'm', 2, null, true, true)$q$, 'coordenação');
select t('acompanhamento não lê o histórico', :UM, $q$do $$ begin if (select count(*) from public.auditoria) > 0 then raise exception 'leu'; end if; end $$$q$, 'ok');

-- ===== quem mais chama a função dos números =====
select t('bolsista não recebe os números do acompanhamento', :BO, $q$select public.acompanhamento_dados()$q$, 'restrito');
select t('bolsista não recebe nem pedindo um órgão', :BO, $q$select public.acompanhamento_dados('mda')$q$, 'restrito');
select t('quem não entrou não recebe', null, $q$select public.acompanhamento_dados('mda')$q$, 'permission denied');
select t('coordenação sem dizer o órgão não recebe', :CG, $q$select public.acompanhamento_dados()$q$, 'restrito');
select t('coordenação geral vê a tela como o MDA e como o MPA', :CG, $q$do $$ begin if public.acompanhamento_dados('mda')->>'orgao' <> 'mda' or public.acompanhamento_dados('mpa')->>'orgao' <> 'mpa' then raise exception 'x'; end if; end $$$q$, 'ok');

-- ===== desativar e novo acesso =====
select f(:CG, format($q$select public.salvar_observador(%L, 'Paulo Parceiro Silva', 'paulo@mpa.exemplo', 'mpa', null, false)$q$, :'op'));
select t('desativado: deixa de ser reconhecido', :UP, $q$do $$ begin if public.acompanhamento_eu() is not null then raise exception 'ainda entra'; end if; end $$$q$, 'ok');
select t('desativado: deixa de receber os números', :UP, $q$select public.acompanhamento_dados()$q$, 'restrito');
select t('desativado: não recebe código', :CG, format($q$select public.gerar_codigo_observador(%L)$q$, :'op'), 'desativado');
select t('trocar o e-mail de quem já tem senha é recusado', :CG, format($q$select public.salvar_observador(%L, 'Marta Observadora', 'outra@mda.exemplo', 'mda', null, true)$q$, :'om'), 'já criou a senha');
select t('novo código para quem já tem senha apaga a conta antiga e fica no histórico', :CG, format($q$do $$ declare c text; begin
  c := public.gerar_codigo_observador(%L);
  if c !~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$' then raise exception 'código estranho'; end if;
  if not exists (select 1 from public.auditoria where tabela = 'observadores' and acao = 'NOVO_ACESSO' and registro_id = %L) then raise exception 'sem histórico'; end if; end $$$q$, :'om', :'om'), 'ok');
select set_config('request.jwt.claim.sub', :CG, true); set local role authenticated;
select public.gerar_codigo_observador(:'om') as cod3 \gset
reset role; select set_config('request.jwt.claim.sub', '', true);
insert into res(caso, ok, det) select 'depois do novo código, a conta antiga some e o cadastro fica sem senha', not exists (select 1 from auth.users where id = :'um') and (select user_id is null and codigo_hash is not null from public.observadores where id = :'om'), '';
select t('a conta antiga deixa de receber os números', :UM, $q$select public.acompanhamento_dados()$q$, 'restrito');
select t('cadastro de acompanhamento não se apaga', null, $q$do $$ begin perform set_config('role', 'none', true); delete from public.observadores; end $$$q$, 'não se apaga');
insert into res(caso, ok, det) select 'visitante (anon) não tem permissão na tabela nem nas funções', not has_table_privilege('anon', 'public.observadores', 'select') and not has_function_privilege('anon', 'public.acompanhamento_dados(text)', 'execute') and not has_function_privilege('anon', 'public.acompanhamento_eu()', 'execute') and not has_function_privilege('anon', 'public.salvar_observador(uuid, text, text, text, text, boolean)', 'execute'), '';
insert into res(caso, ok, det) select 'equipe logada não tem nenhuma permissão direta na tabela', not has_table_privilege('authenticated', 'public.observadores', 'select') and not has_table_privilege('authenticated', 'public.observadores', 'insert') and not has_table_privilege('authenticated', 'public.observadores', 'update'), '';
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from res;
select 'FALHOU: ' || caso || ' -> ' || det from res where not ok;
rollback;
