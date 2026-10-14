\set k random(1, 10)
select uid as u from carga.u_ag where n = :k \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
select (select count(*) from public.fichas) total, coalesce(json_agg(t), '[]') from (select * from public.fichas order by criado_em desc, id limit 1000) t;
commit;
