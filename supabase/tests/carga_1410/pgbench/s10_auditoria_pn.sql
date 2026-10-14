-- página seguinte ("carregar mais antigos"): em < data do último da página anterior
\set p random(1, 20)
select uid as u from carga.u_coord where papel = 'coord_geral' \gset
select em as antes from public.auditoria order by em desc offset (:p * 200) limit 1 \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
select coalesce(json_agg(t), '[]') from (select * from public.auditoria where em < ':antes' order by em desc limit 200) t;
commit;
