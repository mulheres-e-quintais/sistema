-- ficha nova (não atende) pela bolsista do estado; ROLLBACK no fim para o volume não crescer durante a carga
\set k random(1, 10)
\set c random(10000000, 99999999)
select uid as u, uf from carga.u_bols where n = :k \gset
begin;
select set_config('request.jwt.claim.sub', ':u', true);
set local role authenticated;
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
  values (gen_random_uuid(), ':uf', 'Município Carga', 'Comunidade Carga', 'Agricultora Carga Teste', public.cpf_t(80000000000 + :c), date '1980-05-05', 'Sítio Carga', false, true, true, true, true, true, true, true, true, true, 'nao_atende', date '2026-10-13') returning id;
rollback;
