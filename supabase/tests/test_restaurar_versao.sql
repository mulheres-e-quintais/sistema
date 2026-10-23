-- 74: "Restaurar como estava antes" no Histórico (só a coordenação geral; conflito avisa; restauração fica marcada)
begin;
set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000074c1', 'cg.t74@exemplo.invalid'), ('00000000-0000-0000-0000-0000000074c2', 'tec.t74@exemplo.invalid');
update public.equipe set user_id = null where user_id in ('00000000-0000-0000-0000-0000000074c1', '00000000-0000-0000-0000-0000000074c2');
update public.equipe set user_id = '00000000-0000-0000-0000-0000000074c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste 74', user_id = null where papel = 'coord_tecnico' and status = 'ativa';
insert into public.equipe (id, user_id, papel, nome, cpf, email, data_inicio, consentimento_lgpd, status) values
  ('00000000-0000-0000-0000-0000000074a2', '00000000-0000-0000-0000-0000000074c2', 'coord_tecnico', 'Técnica T74', '74017401100', 'tec.t74@exemplo.invalid', '2026-10-01', true, 'ativa');
insert into public.kit_itens (id, item, unidade, valor_ref) values ('00000000-0000-0000-0000-0000000074b1', 'Enxada T74', 'un', 50);
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco,
    c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao)
  values ('00000000-0000-0000-0000-0000000074f1', 'SE', 'Município T74', 'Comunidade Antiga', 'Maria T74', '74000000001', '1980-01-01', 'Sítio T74', true, true, true, true, true, true, true,
    true, true, true, 'lista_espera', current_date, 'aguardando');
set session_replication_role = origin;

create temp table _r (caso text, erro text, valor text) on commit drop; grant all on _r to authenticated, anon;
create function pg_temp.tenta(caso text, quem uuid, cmd text, papel text default 'authenticated') returns void language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', papel, true);
  begin execute cmd into v; insert into _r values (caso, null, v); exception when others then insert into _r values (caso, sqlerrm, null); end;
  perform set_config('role', 'postgres', true);
end $$;
create function pg_temp.ok(caso text, deve text, titulo text) returns text language sql as $$
  select case when (deve = 'ok' and (select erro from _r where _r.caso = ok.caso) is null)
                or (deve <> 'ok' and (select erro from _r where _r.caso = ok.caso) ~ deve) then 'PASSOU' else 'FALHOU' end
         || ' 74: ' || titulo || ' | ' || coalesce((select erro from _r where _r.caso = ok.caso), (select valor from _r where _r.caso = ok.caso), 'gravou')
$$;
\set CG '00000000-0000-0000-0000-0000000074c1'
\set TEC '00000000-0000-0000-0000-0000000074c2'

-- duas alterações seguidas no item do kit (gravadas como a coordenação, com o histórico ligado)
select pg_temp.tenta('alt1', :'CG', $$update public.kit_itens set valor_ref = 80 where id = '00000000-0000-0000-0000-0000000074b1' returning 'ok'$$, 'postgres');
select pg_temp.tenta('alt2', :'CG', $$update public.kit_itens set fonte = 'Cotação nova' where id = '00000000-0000-0000-0000-0000000074b1' returning 'ok'$$, 'postgres');
select pg_temp.tenta('alt_ficha', :'CG', $$update public.fichas set comunidade = 'Comunidade Nova' where id = '00000000-0000-0000-0000-0000000074f1' returning 'ok'$$, 'postgres');
reset role;
create temp table _a as select
  (select id from public.auditoria where tabela = 'kit_itens' and registro_id = '00000000-0000-0000-0000-0000000074b1' and acao = 'UPDATE' order by id limit 1) a1,
  (select id from public.auditoria where tabela = 'kit_itens' and registro_id = '00000000-0000-0000-0000-0000000074b1' and acao = 'UPDATE' order by id desc limit 1) a2,
  (select id from public.auditoria where tabela = 'fichas' and registro_id = '00000000-0000-0000-0000-0000000074f1' and acao = 'UPDATE' order by id desc limit 1) af,
  (select id from public.auditoria where tabela = 'equipe' order by id desc limit 1) ae;
grant select on _a to authenticated, anon;
select case when (select a1 from _a) is not null and (select a2 from _a) > (select a1 from _a) and (select af from _a) is not null then 'PASSOU' else 'FALHOU' end || ' 74: as alterações estão no histórico';

select pg_temp.tenta('tec', :'TEC', $$select public.restaurar_versao((select a2 from _a))::text$$);
select pg_temp.tenta('anon', :'CG', $$select public.restaurar_versao((select a2 from _a))::text$$, 'anon');
select pg_temp.tenta('equipe', :'CG', $$select public.restaurar_versao((select ae from _a))::text$$);
select pg_temp.tenta('conflito', :'CG', $$select public.restaurar_versao((select a1 from _a))::text$$);
select pg_temp.tenta('pos_conflito', :'CG', $$select valor_ref::text from public.kit_itens where id = '00000000-0000-0000-0000-0000000074b1'$$, 'postgres');
select pg_temp.tenta('ultima', :'CG', $$select public.restaurar_versao((select a2 from _a))::text$$);
select pg_temp.tenta('forcado', :'CG', $$select public.restaurar_versao((select a1 from _a), true)::text$$);
select pg_temp.tenta('ficha', :'CG', $$select public.restaurar_versao((select af from _a))::text$$);
select pg_temp.tenta('inexistente', :'CG', $$select public.restaurar_versao(-1)::text$$);
reset role;
select pg_temp.ok('tec', 'Só a coordenação geral', 'só a coordenação geral restaura');
select pg_temp.ok('anon', 'permission denied', 'sem login não chama a função');
select pg_temp.ok('equipe', 'não se restaura', 'equipe e acessos não se restauram pelo histórico');
select case when (select valor from _r where caso = 'conflito') like '%"conflito": true%' and (select valor from _r where caso = 'pos_conflito')::numeric = 80
  then 'PASSOU' else 'FALHOU' end || ' 74: versão com mudança depois: avisa conflito e não restaura | ' || coalesce((select valor from _r where caso = 'conflito'), (select erro from _r where caso = 'conflito'));
select pg_temp.ok('ultima', 'ok', 'a última alteração se desfaz');
select pg_temp.ok('forcado', 'ok', 'com confirmação, a versão mais antiga volta');
select case when (select valor_ref from public.kit_itens where id = '00000000-0000-0000-0000-0000000074b1') = 50 and (select fonte from public.kit_itens where id = '00000000-0000-0000-0000-0000000074b1') is null
  then 'PASSOU' else 'FALHOU' end || ' 74: o item voltou a como era antes da primeira alteração';
select pg_temp.ok('ficha', 'ok', 'a ficha volta como estava (comunidade)');
select case when (select comunidade from public.fichas where id = '00000000-0000-0000-0000-0000000074f1') = 'Comunidade Antiga' then 'PASSOU' else 'FALHOU' end || ' 74: comunidade da ficha restaurada';
select case when (select count(*) from public.auditoria where obs like 'restauração da linha %' and registro_id in ('00000000-0000-0000-0000-0000000074b1', '00000000-0000-0000-0000-0000000074f1')) = 3
  then 'PASSOU' else 'FALHOU' end || ' 74: cada restauração entra no histórico marcada como restauração';
select case when (select count(*) from public.auditoria where obs is not null and registro_id not in ('00000000-0000-0000-0000-0000000074b1', '00000000-0000-0000-0000-0000000074f1')) = 0
  then 'PASSOU' else 'FALHOU' end || ' 74: a marca não vaza para outras gravações da mesma transação';
select pg_temp.ok('inexistente', 'não existe mais', 'linha do histórico inexistente: recusa com mensagem clara');
rollback;
