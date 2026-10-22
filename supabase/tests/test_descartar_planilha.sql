-- 72: descartar planilha de gastos enviada por engano (só a coordenação geral, com motivo; o registro fica)
begin;
set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000072c1', 'cg.t72@exemplo.invalid'), ('00000000-0000-0000-0000-0000000072c2', 'tec.t72@exemplo.invalid');
update public.equipe set user_id = null where user_id in ('00000000-0000-0000-0000-0000000072c1', '00000000-0000-0000-0000-0000000072c2');
update public.equipe set user_id = '00000000-0000-0000-0000-0000000072c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste 72', user_id = null where papel = 'coord_tecnico' and status = 'ativa';
insert into public.equipe (id, user_id, papel, nome, cpf, email, data_inicio, consentimento_lgpd, status) values
  ('00000000-0000-0000-0000-0000000072a2', '00000000-0000-0000-0000-0000000072c2', 'coord_tecnico', 'Técnica T72', '72017201100', 'tec.t72@exemplo.invalid', '2026-10-01', true, 'ativa');
insert into public.parametros (chave, valor) values ('acomp_mda_financeiro', '"previa"') on conflict (chave) do update set valor = excluded.valor;
set session_replication_role = origin;

create temp table _r (caso text, erro text, valor text) on commit drop; grant all on _r to authenticated;
create function pg_temp.tenta(caso text, quem uuid, cmd text) returns void language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', 'authenticated', true);
  begin execute cmd into v; insert into _r values (caso, null, v); exception when others then insert into _r values (caso, sqlerrm, null); end;
  perform set_config('role', 'postgres', true);
end $$;
create function pg_temp.ok(caso text, deve text, titulo text) returns text language sql as $$
  select case when (deve = 'ok' and (select erro from _r where _r.caso = ok.caso) is null)
                or (deve <> 'ok' and (select erro from _r where _r.caso = ok.caso) ~ deve) then 'PASSOU' else 'FALHOU' end
         || ' 72: ' || titulo || ' | ' || coalesce((select erro from _r where _r.caso = ok.caso), 'gravou')
$$;
\set CG '00000000-0000-0000-0000-0000000072c1'
\set TEC '00000000-0000-0000-0000-0000000072c2'

-- duas planilhas: a certa (setembro) e, enviada depois, a errada (gasto absurdo)
select pg_temp.tenta('envia_certa', :'CG', $$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido)
  values (current_date - 10, '2026/t72_certa.xlsx', 'certa.xlsx', '[{"linha": 1, "item": "material", "rubrica": "consumo", "valor": 1000}]', 1000, 0) returning id::text$$);
select pg_sleep(0.01);
select pg_temp.tenta('envia_errada', :'CG', $$insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido)
  values (current_date - 20, '2026/t72_errada.xlsx', 'errada.xlsx', '[{"linha": 1, "item": "material", "rubrica": "consumo", "valor": 999999}]', 999999, 0) returning id::text$$);
reset role;
select pg_temp.ok('envia_errada', 'ok', 'a coordenação geral envia as planilhas');
-- (na mesma transação de teste as duas teriam a mesma hora de envio: a errada passa a ter sido enviada 1 hora depois)
set session_replication_role = replica; update public.execucao_planilhas set enviado_em = enviado_em + interval '1 hour' where arquivo_nome = 'errada.xlsx'; set session_replication_role = origin;
create function pg_temp.vale() returns text language sql as $$
  select (select arquivo_nome from public.execucao_planilhas where enviado_em = (r->'financeiro'->>'enviado_em')::timestamptz limit 1)
    from (select public.acompanhamento_extra('mda') r) x $$;
select pg_temp.tenta('mda_antes', :'CG', $$select pg_temp.vale()$$);
reset role;
select case when (select valor from _r where caso = 'mda_antes') = 'errada.xlsx' then 'PASSOU' else 'FALHOU' end
  || ' 72: o acompanhamento do MDA usa a ÚLTIMA ENVIADA (a mesma regra da tela), mesmo com data de gastos mais antiga | ' || coalesce((select valor from _r where caso = 'mda_antes'), (select erro from _r where caso = 'mda_antes'), '');

select pg_temp.tenta('tec_descarta', :'TEC', format($q$select public.descartar_planilha_exec(%L, 'Arquivo errado do mês')$q$, (select valor from _r where caso = 'envia_errada')));
select pg_temp.tenta('cg_sem_motivo', :'CG', format($q$select public.descartar_planilha_exec(%L, 'x')$q$, (select valor from _r where caso = 'envia_errada')));
select pg_temp.tenta('cg_update_direto', :'CG', format($q$update public.execucao_planilhas set descartada_em = now(), motivo_descarte = 'direto' where id = %L returning 'ok'$q$, (select valor from _r where caso = 'envia_errada')));
select pg_temp.tenta('cg_descarta', :'CG', format($q$select public.descartar_planilha_exec(%L, 'Arquivo errado: planilha de outro projeto')$q$, (select valor from _r where caso = 'envia_errada')));
select pg_temp.tenta('cg_de_novo', :'CG', format($q$select public.descartar_planilha_exec(%L, 'Arquivo errado de novo')$q$, (select valor from _r where caso = 'envia_errada')));
select pg_temp.tenta('cg_muda_descartada', :'CG', format($q$update public.execucao_planilhas set total_gasto = 1 where id = %L returning 'ok'$q$, (select valor from _r where caso = 'envia_errada')));
select pg_temp.tenta('cg_apaga', :'CG', format($q$delete from public.execucao_planilhas where id = %L returning 'ok'$q$, (select valor from _r where caso = 'envia_certa')));
select pg_temp.tenta('mda_depois', :'CG', $$select pg_temp.vale()$$);
reset role;
select pg_temp.ok('tec_descarta', 'Só a coordenação geral', 'só a coordenação geral descarta');
select pg_temp.ok('cg_sem_motivo', 'motivo do descarte', 'descartar exige motivo');
select case when (select erro from _r where caso = 'cg_update_direto') is not null or (select descartada_em from public.execucao_planilhas where arquivo_nome = 'errada.xlsx') is null
  then 'PASSOU' else 'FALHOU' end || ' 72: ninguém descarta por gravação direta (só pela função, com motivo) | ' || coalesce((select erro from _r where caso = 'cg_update_direto'), 'gravou');
select pg_temp.ok('cg_descarta', 'ok', 'a coordenação geral descarta com motivo');
select case when descartada_em is not null and descartada_por is not null and motivo_descarte like 'Arquivo errado: planilha%' and total_gasto = 999999 then 'PASSOU' else 'FALHOU' end
  || ' 72: o registro fica, com quem, quando e por quê (os dados não mudam)' from public.execucao_planilhas where arquivo_nome = 'errada.xlsx';
select pg_temp.ok('cg_de_novo', 'já foi descartada', 'descartar duas vezes é recusado');
select pg_temp.ok('cg_muda_descartada', 'não se altera|permission denied', 'a planilha descartada continua sem alteração');
select case when (select valor from _r where caso = 'cg_apaga') is null then 'PASSOU' else 'FALHOU' end || ' 72: planilha não se apaga | ' || coalesce((select erro from _r where caso = 'cg_apaga'), 'nada apagado (sem permissão)');
select case when (select valor from _r where caso = 'mda_depois') = 'certa.xlsx' then 'PASSOU' else 'FALHOU' end
  || ' 72: descartada a errada, o acompanhamento do MDA volta para a certa | ' || coalesce((select valor from _r where caso = 'mda_depois'), (select erro from _r where caso = 'mda_depois'), '');
select case when exists (select 1 from public.auditoria where tabela = 'execucao_planilhas' and acao = 'UPDATE' and depois->>'motivo_descarte' like 'Arquivo errado%') then 'PASSOU' else 'FALHOU' end
  || ' 72: o descarte fica no histórico';
-- arquivo: só o de planilha DESCARTADA pode ser apagado da pasta privada (no Supabase quem entrou tem DELETE em storage.objects, filtrado pelas regras)
grant select, delete on storage.objects to authenticated;
insert into storage.objects (bucket_id, name) values ('execucao', '2026/t72_errada.xlsx'), ('execucao', '2026/t72_certa.xlsx');
select pg_temp.tenta('apaga_arq_errada', :'CG', $$with x as (delete from storage.objects where bucket_id = 'execucao' and name = '2026/t72_errada.xlsx' returning 1) select count(*)::text from x$$);
select pg_temp.tenta('apaga_arq_certa', :'CG', $$with x as (delete from storage.objects where bucket_id = 'execucao' and name = '2026/t72_certa.xlsx' returning 1) select count(*)::text from x$$);
select pg_temp.tenta('tec_apaga_arq', :'TEC', $$with x as (delete from storage.objects where bucket_id = 'execucao' returning 1) select count(*)::text from x$$);
reset role;
select case when (select valor from _r where caso = 'apaga_arq_errada') = '1' and (select valor from _r where caso = 'apaga_arq_certa') = '0' and (select valor from _r where caso = 'tec_apaga_arq') = '0'
  then 'PASSOU' else 'FALHOU' end || ' 72: só o arquivo da planilha descartada sai da pasta, e só pela coordenação geral | '
  || concat_ws(' / ', (select coalesce(valor, erro) from _r where caso = 'apaga_arq_errada'), (select coalesce(valor, erro) from _r where caso = 'apaga_arq_certa'), (select coalesce(valor, erro) from _r where caso = 'tec_apaga_arq'));
rollback;
