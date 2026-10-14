select uid as u from carga.u_coord where papel = 'coord_geral' \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
select coalesce(json_agg(t), '[]') from (select * from public.auditoria order by em desc limit 200) t;
commit;
