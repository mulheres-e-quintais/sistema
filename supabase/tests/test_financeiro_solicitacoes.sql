-- 73: planilha de solicitações da FUNCERN — o resumo financeiro do MDA conta só o PAGO (solicitação ainda não paga é comprometido)
begin;
set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000073c1', 'cg.t73@exemplo.invalid');
update public.equipe set user_id = null where user_id = '00000000-0000-0000-0000-0000000073c1';
update public.equipe set user_id = '00000000-0000-0000-0000-0000000073c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
insert into public.parametros (chave, valor) values ('acomp_mda_financeiro', '"sim"') on conflict (chave) do update set valor = excluded.valor;
set session_replication_role = origin;
create temp table _r (caso text, erro text, valor text) on commit drop; grant all on _r to authenticated;
create function pg_temp.tenta(caso text, quem uuid, cmd text) returns void language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', 'authenticated', true);
  begin execute cmd into v; insert into _r values (caso, null, v); exception when others then insert into _r values (caso, sqlerrm, null); end;
  perform set_config('role', 'postgres', true);
end $$;
\set CG '00000000-0000-0000-0000-0000000073c1'
select pg_temp.tenta('envia', :'CG', $$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido)
  values (current_date, '2026/t73.xlsx', 'solicitacoes.xlsx', '[{"linha": 2, "item": "combustivel", "rubrica": "r9", "valor": 1250.5, "situacao": "pago", "data": "2026-10-05"},
    {"linha": 3, "item": "doa", "rubrica": "r13", "valor": 20000, "situacao": "comprometido", "data": "2026-10-06"},
    {"linha": 4, "item": "bolsa_coord_geral", "rubrica": "r1", "valor": 5000, "data": "2026-10-06"}]', 6250.5, 0) returning id::text$$);
reset role;
select case when (select erro from _r where caso = 'envia') is null then 'PASSOU' else 'FALHOU' end || ' 73: a coordenação geral envia a planilha de solicitações | ' || coalesce((select erro from _r where caso = 'envia'), 'gravou');
set session_replication_role = replica; update public.execucao_planilhas set enviado_em = now() + interval '1 day' where arquivo_nome = 'solicitacoes.xlsx'; set session_replication_role = origin;
create function pg_temp.fin() returns jsonb language sql as $$ select (public.acompanhamento_extra('mda'))->'financeiro' $$;
select pg_temp.tenta('mda', :'CG', $$select pg_temp.fin()::text$$);
reset role;
with f as (select (select valor from _r where caso = 'mda')::jsonb f)
select case when (select f from f) ? 'por_item'
        and not exists (select 1 from jsonb_array_elements((select f from f)->'por_item') x where x->>'item' = 'doa')
        and exists (select 1 from jsonb_array_elements((select f from f)->'por_item') x where x->>'item' = 'combustivel' and (x->>'valor')::numeric = 1250.5)
        and exists (select 1 from jsonb_array_elements((select f from f)->'por_item') x where x->>'item' = 'bolsa_coord_geral' and (x->>'valor')::numeric = 5000)
       then 'PASSOU' else 'FALHOU' end || ' 73: o resumo do MDA soma o pago (e a linha sem situação, das planilhas antigas) e deixa de fora o comprometido | ' || coalesce((select valor from _r where caso = 'mda'), (select erro from _r where caso = 'mda'), '');
with f as (select (select valor from _r where caso = 'mda')::jsonb f)
select case when (select sum((x->>'gasto')::numeric) from jsonb_array_elements((select f from f)->'por_mes') x) = 6250.5 then 'PASSOU' else 'FALHOU' end
  || ' 73: o gasto por mês também não conta o comprometido | ' || coalesce((select ((select f from f)->'por_mes')::text), '');
rollback;
