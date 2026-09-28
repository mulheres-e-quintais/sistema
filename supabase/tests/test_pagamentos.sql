-- Testes da etapa 12. Rodar num banco novo com stub, 01 (CPF preenchido), 02, 03, 04, 07, 08, 09, 10, 11 e 12.
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); perform set_config('request.jwt.claim.email', p_email, false); end $$;
-- equipe (pelo SQL Editor, sem login: as travas de quem pode ficam de fora)
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em, matricula_fic_em, matricula_fic_numero) values
  ('coord_tecnico','Técnica Teste','22222222222','tec@x.org','2026-09-01',true,'2026-09-01','2026-09-01','2026-09-01','F0'),
  ('auxiliar_adm','Aux Teste','77777777777','aux@ifrn.edu.br','2026-09-01',true,'2026-09-01','2026-09-01',null,null);
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em, matricula_fic_em, matricula_fic_numero) values
  ('articulacao','PI','Ana Bolsista','33333333333','ana@x.org','2026-09-01',true,'2026-09-01','2026-09-01','2026-09-01','F1'),
  ('agente','PI','Gil Agente','44444444444','gil@x.org','2026-09-01',true,'2026-09-01','2026-09-01','2026-09-01','F2'),
  ('agente','PI','Lia Sem Habilitacao','55555555555','lia@x.org','2026-09-01',true,null,null,null,null);
insert into auth.users(email) values ('cleone.lima@ifrn.edu.br'),('tec@x.org'),('aux@ifrn.edu.br'),('ana@x.org'),('gil@x.org'),('lia@x.org');
set session_replication_role = replica;
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao)
values ('10000000-0000-0000-0000-000000000001','PI','Paulistana','Lagoa','Maria Um Teste','52998224725','1980-01-01','Sítio 1',true,true,true,true,true,true,true,true,true,true,'selecionada','2026-09-02','aprovada'),
       ('10000000-0000-0000-0000-000000000002','PI','Paulistana','Lagoa','Joana Dois Teste','11144477735','1980-01-01','Sítio 2',true,true,true,true,true,true,true,true,true,true,'selecionada','2026-09-02','aprovada');
insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','PI','diagnostico',(select id from public.equipe where email='gil@x.org'),'2026-09-10','2026-09-10','realizada'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','PI','diagnostico',(select id from public.equipe where email='gil@x.org'),'2026-09-12','2026-09-12','realizada'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','PI','implantacao',(select id from public.equipe where email='gil@x.org'),'2026-09-20',null,'prevista'),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','PI','acompanhamento',(select id from public.equipe where email='ana@x.org'),'2026-09-15','2026-09-15','realizada');
set session_replication_role = origin;

select pg_temp.como('gil@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 1. agente marca implantação feita sem relato (ERRO)'
update public.visitas set situacao = 'realizada', data_realizada = '2026-09-20' where id = '20000000-0000-0000-0000-000000000003';
\echo '== 2. com data no futuro (ERRO)'
update public.visitas set situacao = 'realizada', data_realizada = current_date + 2, relato = 'Entregue a caixa d''água e montados 3 canteiros.' where id = '20000000-0000-0000-0000-000000000003';
\echo '== 3. com data e relato (OK)'
update public.visitas set situacao = 'realizada', data_realizada = '2026-09-20', relato = 'Entregue a caixa d''água e montados 3 canteiros.' where id = '20000000-0000-0000-0000-000000000003' returning situacao;
\echo '== 4. agente pede bolsa (ERRO: agente não tem bolsa)'
select public.solicitar_pagamento('bolsa', '2026-09-01', 2200, repeat('relatório ', 10), null, null);
\echo '== 5. agente inclui visita da Ana (ERRO)'
select public.solicitar_pagamento('ajuda_custo', '2026-09-01', 300, null, array['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004']::uuid[], null);
\echo '== 6. mês futuro (ERRO)'
select public.solicitar_pagamento('ajuda_custo', (current_date + interval '40 days')::date, 300, null, array['20000000-0000-0000-0000-000000000001']::uuid[], null);
\echo '== 7. agente solicita as 3 visitas de setembro (OK)'
select public.solicitar_pagamento('ajuda_custo', '2026-09-15', 612.5, null, array['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003']::uuid[], '{"visitas":3}') is not null as ok;
\echo '== 8. de novo o mesmo mês (ERRO)'
select public.solicitar_pagamento('ajuda_custo', '2026-09-01', 612.5, null, array['20000000-0000-0000-0000-000000000001']::uuid[], null);
\echo '== 9. muda a data de visita já solicitada (ERRO)'
update public.visitas set data_realizada = '2026-09-11' where id = '20000000-0000-0000-0000-000000000001';
\echo '== 10. dá aval na própria (ERRO)'
select public.avalizar_pagamento((select id from public.solicitacoes_pagamento limit 1), true, null, null);
\echo '== 11. agente lê a tabela direto: só a dela (1); não grava direto (ERRO)'
select count(*) from public.solicitacoes_pagamento;
update public.solicitacoes_pagamento set situacao = 'avalizada';
reset role;

select pg_temp.como('lia@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 12. sem habilitação (ERRO)'
select public.solicitar_pagamento('ajuda_custo', '2026-09-01', 100, null, array['20000000-0000-0000-0000-000000000001']::uuid[], null);
reset role;

select pg_temp.como('aux@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 13. auxiliar lança no Arlo antes do aval (ERRO) e tenta dar aval (ERRO)'
select public.registrar_no_arlo((select id from public.solicitacoes_pagamento limit 1), 'P-1');
select public.avalizar_pagamento((select id from public.solicitacoes_pagamento limit 1), true, null, null);
reset role;

select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 14. técnica devolve sem motivo (ERRO)'
select public.avalizar_pagamento((select id from public.solicitacoes_pagamento limit 1), false, '', null);
\echo '== 15. técnica devolve com motivo (OK) e as visitas ficam livres (0 vínculos)'
select public.avalizar_pagamento((select id from public.solicitacoes_pagamento limit 1), false, 'Faltou a foto da implantação.', null);
select situacao, obs_aval from public.solicitacoes_pagamento;
select count(*) as vinculos from public.solicitacao_visitas;
reset role;

select pg_temp.como('gil@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 16. agente reenvia o mesmo mês depois da devolução (OK: volta para solicitada)'
select public.solicitar_pagamento('ajuda_custo', '2026-09-01', 612.5, null, array['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003']::uuid[], '{"visitas":3}') is not null as ok;
select situacao, aval_por is null as sem_aval from public.solicitacoes_pagamento;
reset role;

select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 17. técnica dá o aval com o valor conferido (OK)'
select public.avalizar_pagamento((select id from public.solicitacoes_pagamento limit 1), true, 'Conferido com o km.', 598.4);
select situacao, valor_solicitado, valor_avalizado from public.solicitacoes_pagamento;
\echo '== 18. técnica pede a própria bolsa (OK) e não pode dar aval nela (ERRO)'
select public.solicitar_pagamento('bolsa', '2026-09-01', 4700, 'Organizei a seleção nos 5 estados, aprovei fichas e acompanhei os primeiros diagnósticos.', null, null) is not null as ok;
select public.avalizar_pagamento((select id from public.solicitacoes_pagamento where tipo = 'bolsa'), true, null, null);
reset role;

select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 19. bolsista pede bolsa sem relatório (ERRO) e com relatório (OK)'
select public.solicitar_pagamento('bolsa', '2026-09-01', 2200, 'pouco', null, null);
select public.solicitar_pagamento('bolsa', '2026-09-01', 2200, 'Mobilizei 3 comunidades em Paulistana, lancei 12 fichas e acompanhei 2 diagnósticos com as agentes.', null, null) is not null as ok;
reset role;

select pg_temp.como('cleone.lima@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 20. coordenação geral dá o aval na bolsa da técnica (OK)'
select public.avalizar_pagamento((select s.id from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id where s.tipo = 'bolsa' and e.papel = 'coord_tecnico'), true, null, null);
reset role;

select pg_temp.como('aux@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 21. auxiliar lança no Arlo as duas com aval (OK) e a da Ana, ainda sem aval, dá ERRO'
select public.registrar_no_arlo(id, 'ARLO-' || left(id::text, 4)) from public.solicitacoes_pagamento where situacao = 'avalizada';
select public.registrar_no_arlo((select s.id from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id where e.email = 'ana@x.org'), null);
select e.nome, s.tipo, s.situacao, s.arlo_protocolo is not null as protocolo from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id order by e.nome, s.tipo;
reset role;
\echo '== 22. histórico (>= 7 registros de solicitação)'
select count(*) from public.auditoria where tabela = 'solicitacoes_pagamento';
