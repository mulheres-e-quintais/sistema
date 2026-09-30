-- Testes da etapa 3. Rodar depois de stub, 01 (CPF preenchido), 02 e 03.
\ir _professor_habilitado.sql
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); perform set_config('request.jwt.claim.email', p_email, false); end $$;
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('coord_tecnico','Técnica Teste MPA','22222222222','tec@x.org','2026-10-01',true);
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em) values
 ('articulacao','PI','Ana Bolsista PI','33333333333','ana@x.org','2026-10-01',true,'2026-10-01','2026-10-01','2026-10-01'),
 ('agente','PI','Gil Agente Habilitada','44444444444','gil@x.org','2026-10-01',true,'2026-10-01','2026-10-01','2026-10-01'),
 ('agente','PI','Lia Agente Sem Habilitacao','55555555555','lia@x.org','2026-10-01',true,null,null,null),
 ('agente','BA','Bel Agente BA','66666666666','bel@x.org','2026-10-01',true,'2026-10-01','2026-10-01','2026-10-01');
insert into auth.users(email) values ('tec@x.org'),('ana@x.org'),('gil@x.org'),('lia@x.org'),('bel@x.org');
-- fichas: 2 no PI (1 aprovada, 1 aguardando)
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
  c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao)
values ('10000000-0000-0000-0000-000000000001','PI','Paulistana','Lagoa','Maria Um Teste','52998224725','1980-01-01','Sítio 1',true,true,true,true,true,true,true,true,true,true,'selecionada','2026-10-20','aguardando'),
       ('10000000-0000-0000-0000-000000000002','PI','Paulistana','Lagoa','Maria Dois Teste','11144477735','1980-01-01','Sítio 2',true,true,true,true,true,true,true,true,true,true,'selecionada','2026-10-20','aguardando');
update public.fichas set situacao='aprovada' where id='10000000-0000-0000-0000-000000000001';
select id as gil from public.equipe where email='gil@x.org' \gset
select id as lia from public.equipe where email='lia@x.org' \gset
select id as bel from public.equipe where email='bel@x.org' \gset
select id as ana from public.equipe where email='ana@x.org' \gset

select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 1. bolsista vê agentes do seu estado (espera 3: ela, Gil, Lia)'
select count(*) from public.equipe;
\echo '== 2. agenda diagnóstico com agente habilitada (OK)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','diagnostico',:'gil','2026-10-25','PI');
\echo '== 3. agente sem habilitação (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','implantacao',:'lia','2026-10-25','PI');
\echo '== 4. agente de outro estado (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','acompanhamento',:'bel','2026-10-25','PI');
\echo '== 5. ficha não aprovada (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','diagnostico',:'gil','2026-10-25','PI');
\echo '== 6. segundo diagnóstico para o mesmo quintal (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','diagnostico',:'ana','2026-10-26','PI');
\echo '== 7. implantação antes do diagnóstico feito (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','implantacao',:'gil','2026-11-25','PI');
reset role;

select pg_temp.como('gil@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 8. agente vê só a ficha atribuída (espera 1) e só a própria visita (espera 1)'
select (select count(*) from public.fichas) as fichas, (select count(*) from public.visitas) as visitas;
\echo '== 9. agente registra diagnóstico sem GPS nem motivo (ERRO)'
insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, lote) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PI','2026-10-25','sim',1);
\echo '== 10. sem água com lote (ERRO)'
insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, sem_agua, lote, latitude, longitude) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PI','2026-10-25','nao',true,1,-8.1,-41.1);
\echo '== 11. diagnóstico correto (OK) e visita vira realizada'
insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, lote, latitude, longitude, renda_quintal) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PI','2026-10-25','sim',1,-8.1,-41.1,150);
select situacao, data_realizada from public.visitas where id='20000000-0000-0000-0000-000000000001';
\echo '== 12. agente tenta cancelar visita (ERRO)'
update public.visitas set situacao='cancelada' where id='20000000-0000-0000-0000-000000000001';
reset role;

select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 13. coord técnica aprova o plano (OK)'
update public.diagnosticos set situacao='aprovado' where id='30000000-0000-0000-0000-000000000001';
select situacao, aprovado_por is not null as tem_aprovador from public.diagnosticos;
\echo '== 14. agora implantação pode ser agendada (OK)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','implantacao',:'gil','2027-01-20','PI');
\echo '== 15. três acompanhamentos (terceiro dá ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','acompanhamento',:'gil','2027-03-20','PI');
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','acompanhamento',:'ana','2027-05-20','PI');
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista, uf) values ('20000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','acompanhamento',:'ana','2027-06-20','PI');
reset role;

select pg_temp.como('gil@x.org'); set role authenticated;
\echo '== 16. agente tenta editar plano aprovado (ERRO)'
update public.diagnosticos set lote=2 where id='30000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.como('bel@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 17. agente de outro estado não vê nada do PI (espera 0,0,0)'
select (select count(*) from public.fichas) as fichas, (select count(*) from public.visitas) as visitas, (select count(*) from public.diagnosticos) as diags;
reset role;
\echo '== dias de campo por pessoa'
select e.nome, count(*) filter (where v.situacao <> 'cancelada') as agendadas, count(*) filter (where v.situacao = 'realizada') as realizadas from public.visitas v join public.equipe e on e.id = v.executor_id group by 1 order by 1;
