-- 21/10/2026: o painel do MDA/MPA é só de quem acompanha e da coordenação geral (a técnica é recusada)
select uid as u from carga.u_coord where papel = 'coord_geral' limit 1 \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
select public.acompanhamento_dados('mda');
commit;
