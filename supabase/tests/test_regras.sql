-- Testes das regras do banco. Rodar depois de stub_supabase.sql e schema.sql.
\set ON_ERROR_STOP 0
\set QUIET 1
-- permissões vêm do schema.sql


create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid;
begin
  select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false);
  perform set_config('request.jwt.claim.email', p_email, false);
end $$;

-- 0) primeiro acesso: coordenação geral inserida pelo SQL Editor
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('coord_geral','Coordenação Geral Teste','11111111111','geral@ifrn.edu.br','2026-09-14',true);

\echo '== 1. conta estranha não pode ser criada (espera ERRO)'
insert into auth.users (email) values ('estranho@x.com');
\echo '== 2. conta da coord geral é criada e vinculada'
insert into auth.users (email) values ('geral@ifrn.edu.br');
select pg_temp.como('geral@ifrn.edu.br');
set role authenticated;
select (public.vincular_conta()).papel as vinculado_como;

\echo '== 3. coord geral cadastra coord técnica (espera OK)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('coord_tecnico','Coordenação Técnica MPA','22222222222','tecnica@mpa.org','2026-10-01',true);
\echo '== 4. coord geral tenta cadastrar bolsista (espera ERRO de RLS)'
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('articulacao','PI','Bolsista Indevida','33333333333','x@x.com','2026-10-01',true);
\echo '== 5. segunda coord técnica ativa (espera ERRO de unicidade)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('coord_tecnico','Outra Técnica Teste','44444444444','outra@mpa.org','2026-10-01',true);
reset role;

insert into auth.users (email) values ('tecnica@mpa.org');
select pg_temp.como('tecnica@mpa.org');
set role authenticated;
select (public.vincular_conta()).papel as vinculado_como;
\echo '== 6. coord técnica cadastra articulação e apoio no PI (espera OK x2)'
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, meta_diagnosticos, meta_quintais, meta_visitas)
values ('articulacao','PI','Ana Articulação Teste','55555555555','ana@x.com','2026-10-01',true,20,20,40);
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, meta_diagnosticos, meta_quintais, meta_visitas)
values ('apoio','PI','Bia Apoio Teste','66666666666','bia@x.com','2026-10-01',true,20,20,40);
\echo '== 7. segunda articulação no PI (espera ERRO de unicidade)'
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('articulacao','PI','Carla Duplicada Teste','77777777777','carla@x.com','2026-10-01',true);
\echo '== 8. bolsista sem estado (espera ERRO de check)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('apoio','Dora Sem Estado','88888888888','dora@x.com','2026-10-01',true);
\echo '== 9. previsão individual acima da meta do estado é permitida (espera OK)'
update public.equipe set meta_diagnosticos = 25 where cpf = '55555555555';
\echo '== 10. coord técnica tenta cadastrar coord técnica (espera ERRO de RLS)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd)
values ('coord_tecnico','Autocadastro Teste','99999999999','auto@x.com','2026-10-01',true);
\echo '== 11. trocar UF da bolsista (espera ERRO)'
update public.equipe set uf = 'AL' where cpf = '55555555555';
\echo '== 12. desligar sem motivo (espera ERRO)'
update public.equipe set status='desligada', data_fim='2026-11-30' where cpf = '55555555555';
\echo '== 13. desligar com data e motivo (espera OK)'
update public.equipe set status='desligada', data_fim='2026-11-30', motivo_desligamento='Pediu desligamento' where cpf = '55555555555';
\echo '== 14. substituta ocupa a vaga (espera OK)'
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, substitui_id)
select 'articulacao','PI','Eva Substituta Teste','12312312312','eva@x.com','2026-12-01',true, id
from public.equipe where cpf='55555555555';
\echo '== 15. reativar desligada (espera ERRO)'
update public.equipe set status='ativa', data_fim=null, motivo_desligamento=null where cpf = '55555555555';
reset role;

select pg_temp.como('geral@ifrn.edu.br');
set role authenticated;
\echo '== 16. coord geral registra matrícula FIC da bolsista (espera OK, 1 linha)'
update public.equipe set matricula_fic_em='2026-10-05', matricula_fic_numero='2026FIC001' where cpf='66666666666';
\echo '== 17. coord geral tenta mudar telefone da bolsista (espera ERRO)'
update public.equipe set telefone='(89) 90000-0000' where cpf='66666666666';
\echo '== 18. ninguém apaga (espera 0 linhas)'
delete from public.equipe where cpf='66666666666';
reset role;

insert into auth.users (email) values ('bia@x.com');
select pg_temp.como('bia@x.com');
set role authenticated;
select (public.vincular_conta()).papel as vinculado_como;
\echo '== 19. bolsista vê só o próprio cadastro (espera 1)'
select count(*) as linhas_visiveis from public.equipe;
\echo '== 20. bolsista tenta alterar a si mesma (espera 0 linhas)'
update public.equipe set telefone='1' where cpf='66666666666';
\echo '== 21. bolsista não vê auditoria (espera 0)'
select count(*) from public.auditoria;
reset role;

\echo '== Resultado final'
select papel, uf, nome, status, substitui_id is not null as substitui, matricula_fic_numero from public.equipe order by criado_em;
select acao, count(*) from public.auditoria group by 1;
