-- 64: a prévia "Ver como o MDA vê" (coordenação) conta os dados de exemplo; o MDA/MPA de verdade não.
begin;
alter table auth.users disable trigger user; alter table public.equipe disable trigger user; alter table public.turmas_fic disable trigger user;
insert into public.observadores (nome, email, orgao, status, user_id) values ('MDA teste 64', 'mda.t64@exemplo.invalid', 'mda', 'ativo', '00000000-0000-0000-0000-0000000064a1');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000064a1', 'mda.t64@exemplo.invalid'), ('00000000-0000-0000-0000-0000000064c1', 'cg.t64@exemplo.invalid') on conflict do nothing;
update public.equipe set user_id = '00000000-0000-0000-0000-0000000064c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
with t as (insert into public.turmas_fic (nome, professor_id) select 'Turma exemplo 64', id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1 returning id)
insert into public.exemplo (tabela, id) select 'turmas_fic', id from t;
create temp table _r (quem text, turmas int) on commit drop; grant all on _r to authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000064a1', true); set local role authenticated;
insert into _r select 'mda', (public.acompanhamento_formacao(null) ->> 'turmas')::int;
reset role; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000064c1', true); set local role authenticated;
insert into _r select 'previa', (public.acompanhamento_formacao('mda') ->> 'turmas')::int;
reset role;
select case when (select turmas from _r where quem = 'previa') = (select turmas from _r where quem = 'mda') + (select count(*) from public.exemplo where tabela = 'turmas_fic') and (select turmas from _r where quem = 'mda') = (select count(*) from public.turmas_fic where id not in (select id from public.exemplo)) then 'PASSOU' else 'FALHOU' end
       || ' 64: a prévia da coordenação conta a turma de exemplo e o MDA de verdade não' from _r limit 1;
rollback;
