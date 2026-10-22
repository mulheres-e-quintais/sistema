-- carga_1410 / 02: tabelas de sorteio para o pgbench (quem faz cada pedido). Roda como dono, depois do 01.
\set QUIET on
drop table if exists carga.u_coord, carga.u_bols, carga.u_ag, carga.v_acomp;
create table carga.u_coord as select row_number() over (order by papel, email) n, uid, papel from carga.pessoas where papel in ('coord_geral','coord_tecnico');
create table carga.u_bols  as select row_number() over (order by email) n, uid, uf from carga.pessoas where papel in ('articulacao','apoio');
create table carga.u_ag    as select row_number() over (order by email) n, uid, uf, equipe_id from carga.pessoas where papel = 'agente';
-- 21/10/2026: na massa, todas as visitas feitas já estão em pedido de pagamento, e visita em pedido não muda mais (63).
-- Na vida real a maior parte das gravações é em visita ainda sem pedido: as de acompanhamento saem dos pedidos (só nesta cópia de carga).
delete from public.solicitacao_visitas sv using public.visitas v where v.id = sv.visita_id and v.etapa = 'acompanhamento';
create table carga.v_acomp as select row_number() over (order by v.id) n, v.id, p.uid from public.visitas v join carga.pessoas p on p.equipe_id = v.executor_id
  where v.etapa = 'acompanhamento' and v.situacao = 'realizada'
    -- 21/10/2026: visita que já está num pedido de pagamento não muda mais (63); a carga grava só nas que estão livres
    and not exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                     where sv.visita_id = v.id and s.situacao in ('solicitada', 'avalizada', 'lancada'));
select (select count(*) from carga.u_coord) coord, (select count(*) from carga.u_bols) bols, (select count(*) from carga.u_ag) ag, (select count(*) from carga.v_acomp) acomp;
