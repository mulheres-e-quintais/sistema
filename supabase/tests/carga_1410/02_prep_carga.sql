-- carga_1410 / 02: tabelas de sorteio para o pgbench (quem faz cada pedido). Roda como dono, depois do 01.
\set QUIET on
drop table if exists carga.u_coord, carga.u_bols, carga.u_ag, carga.v_acomp;
create table carga.u_coord as select row_number() over (order by papel, email) n, uid, papel from carga.pessoas where papel in ('coord_geral','coord_tecnico');
create table carga.u_bols  as select row_number() over (order by email) n, uid, uf from carga.pessoas where papel in ('articulacao','apoio');
create table carga.u_ag    as select row_number() over (order by email) n, uid, uf, equipe_id from carga.pessoas where papel = 'agente';
create table carga.v_acomp as select row_number() over (order by v.id) n, v.id, p.uid from public.visitas v join carga.pessoas p on p.equipe_id = v.executor_id
  where v.etapa = 'acompanhamento' and v.situacao = 'realizada';
select (select count(*) from carga.u_coord) coord, (select count(*) from carga.u_bols) bols, (select count(*) from carga.u_ag) ag, (select count(*) from carga.v_acomp) acomp;
