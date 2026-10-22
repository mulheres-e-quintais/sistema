\set k random(1, 1000000)
select id as v, uid as u from carga.v_acomp where n = 1 + (:k % (select count(*) from carga.v_acomp)) \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
update public.visitas set relato = 'Relato atualizado na carga: plantio conferido, irrigação ok, família presente. ' || clock_timestamp()::text where id = ':v' returning *;
commit;
