\set k random(1, 2)
select uid as u from carga.u_coord where n = :k \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
select (select count(*) from public.diagnosticos) total, coalesce(json_agg(t), '[]') from (select * from public.diagnosticos order by data_visita desc, id limit 1000) t;
commit;
