\set k random(1, 2)
select uid as u from carga.u_coord where n = :k \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
select public.acompanhamento_dados('mda');
commit;
