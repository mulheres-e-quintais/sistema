-- Testes da etapa 13. Banco novo com stub, 01 (CPF preenchido), 02, 03, 04, 07, 08, 09, 10, 11, 12 e 13.
\ir _professor_habilitado.sql
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); perform set_config('request.jwt.claim.email', p_email, false); end $$;
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em, matricula_fic_em, matricula_fic_numero) values
  ('coord_tecnico','Técnica Teste','22222222222','tec@x.org','2026-09-01',true,'2026-09-01','2026-09-01','2026-09-01','F0');
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em, matricula_fic_em, matricula_fic_numero) values
  ('articulacao','PI','Ana Bolsista','33333333333','ana@x.org','2026-09-01',true,'2026-09-01','2026-09-01','2026-09-01','F1'),
  ('agente','PI','Gil Agente','44444444444','gil@x.org','2026-09-01',true,'2026-09-01','2026-09-01','2026-09-01','F2');
insert into auth.users(email) values ('cleone.lima@ifrn.edu.br'),('tec@x.org'),('ana@x.org'),('gil@x.org');
set session_replication_role = replica;
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao)
values ('10000000-0000-0000-0000-000000000001','PI','Paulistana','Lagoa','Maria Um Teste','52998224725','1980-01-01','Sítio 1',true,true,true,true,true,true,true,true,true,true,'selecionada','2026-09-02','aprovada');
insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','PI','diagnostico',(select id from public.equipe where email='gil@x.org'),'2026-09-10','2026-09-10','realizada');
set session_replication_role = origin;

select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 1. agenda avaliação antes da implantação (ERRO)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista) values ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','avaliacao',(select id from public.equipe where email='gil@x.org'),'2026-09-20');
\echo '== 2. agenda implantação (OK) e registra feita com relato (OK)'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista) values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','implantacao',(select id from public.equipe where email='gil@x.org'),'2026-09-15');
update public.visitas set situacao = 'realizada', data_realizada = '2026-09-15', relato = 'Entregue o kit e montados os canteiros com a família.' where id = '20000000-0000-0000-0000-000000000002' returning situacao;
\echo '== 3. agora agenda a avaliação (OK) e uma segunda avaliação dá ERRO'
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista) values ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','avaliacao',(select id from public.equipe where email='gil@x.org'),'2026-09-25') returning etapa;
insert into public.visitas (id, ficha_id, etapa, executor_id, data_prevista) values ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','avaliacao',(select id from public.equipe where email='gil@x.org'),'2026-09-26');
reset role;

select pg_temp.como('gil@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 4. agente registra avaliação sem GPS nem motivo (ERRO)'
insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, quintal_produz, ebia_pontos, ebia_nivel) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','PI','2026-09-25','sim',2,'leve');
\echo '== 5. ligada à visita errada (ERRO)'
insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','PI','2026-09-25',-8.1,-41.1,'sim');
\echo '== 6. avaliação correta (OK) e a visita vira feita'
insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz, ebia_pontos, ebia_nivel, dados) values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','PI','2026-09-25',-8.1,-41.1,'sim',2,'leve','{"dias_consumo":5}');
select situacao, data_realizada from public.visitas where id = '20000000-0000-0000-0000-000000000005';
\echo '== 7. entra na solicitação de ajuda de custo com as outras (OK)'
select public.solicitar_pagamento('ajuda_custo','2026-09-01', 300, null, array['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000005']::uuid[], null) is not null as ok;
reset role;
select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 8. coordenação técnica lê (1) e tentar alterar a avaliação o banco ignora (continua sim)'
select count(*) from public.avaliacoes;
update public.avaliacoes set quintal_produz = 'nao';
reset role;
select case when quintal_produz = 'sim' then 'ok: continua sim' else 'FALHOU: alterou' end as confere from public.avaliacoes;
