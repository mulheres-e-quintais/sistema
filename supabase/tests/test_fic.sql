-- Testes da etapa 11 (professores do FIC, turmas e matrículas). Rodar depois de stub, 01 (CPF preenchido), 02, 03, 04, 07, 08, 09, 10, 11 (banco novo).
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); perform set_config('request.jwt.claim.email', p_email, false); end $$;
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('coord_tecnico','Técnica Teste','22222222222','tec@x.org','2026-10-01',true);
insert into auth.users(email) values ('cleone.lima@ifrn.edu.br'),('tec@x.org');
select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd) values ('articulacao','PI','Ana Bolsista','33333333333','ana@x.org','2026-10-01',true);
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd) values ('agente','BA','Bia Agente','44444444444','bia@x.org','2026-10-01',true);
\echo '== 1. coordenação técnica cadastra professor (ERRO: permissão)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('professor_fic','Prof Errado','55555555555','x@ifrn.edu.br','2026-10-01',true);
\echo '== 2. coordenação técnica gera convite de professor (ERRO)'
select public.criar_convite('professor_fic');
reset role;
insert into auth.users(email) values ('ana@x.org'),('bia@x.org');

select pg_temp.como('cleone.lima@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 3. professor com estado (ERRO: uf_por_papel)'
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd) values ('professor_fic','PI','Prof Com UF','55555555555','prof@ifrn.edu.br','2026-10-01',true);
\echo '== 4. coordenação geral cadastra dois professores (OK)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('professor_fic','Professor Um','55555555555','prof@ifrn.edu.br','2026-10-01',true);
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('professor_fic','Professora Dois','66666666666','prof2@ifrn.edu.br','2026-10-01',true);
select count(*) as professores from public.equipe where papel = 'professor_fic';
\echo '== 5. coordenação geral gera convite de professor (OK: devolve código)'
select length(public.criar_convite('professor_fic')) > 10 as convite_ok;
\echo '== 6. coordenação geral registra FUNCERN e termo do professor: habilitado sem FIC (t)'
update public.equipe set docs_funcern_em = '2026-10-02', termo_assinado_em = '2026-10-02' where email = 'prof@ifrn.edu.br';
select public.habilitado(e) from public.equipe e where email = 'prof@ifrn.edu.br';
reset role;
insert into auth.users(email) values ('prof@ifrn.edu.br'),('prof2@ifrn.edu.br');

select pg_temp.como('prof@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 7. professor lê a tabela equipe: só a si mesmo (1)'
select count(*) from public.equipe;
\echo '== 8. professor vê a lista para matricular, sem CPF/e-mail (4 linhas: 2 professores, Ana, Bia)'
select papel, uf, nome, matricula_fic_em from public.equipe_para_fic();
\echo '== 9. coordenação geral não cria turma nem matricula (ERRO, ERRO) nem altera a matrícula à mão (ERRO)'
reset role; select pg_temp.como('cleone.lima@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
insert into public.turmas_fic (nome, uf, professor_id) values ('Turma Coord','PI',(select id from public.equipe where email = 'prof@ifrn.edu.br'));
update public.equipe set matricula_fic_em = current_date - 1, matricula_fic_numero = '123' where email = 'ana@x.org';
reset role; select pg_temp.como('prof@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 10. professor cria a própria turma PI (OK)'
insert into public.turmas_fic (nome, uf, municipio, inicio, fim, professor_id) values ('FIC Agroecologia PI','PI','Paulistana','2026-10-01','2027-03-30',(select (public.vincular_conta()).id));
\echo '== 11. matricula Ana na turma PI (OK) e a habilitação dela recebe a matrícula'
select public.matricular_fic((select id from public.turmas_fic limit 1), (select id from public.equipe_para_fic() where nome = 'Ana Bolsista'), '20261FIC0001', current_date - 1) is not null as ok;
select nome, matricula_fic_em, matricula_fic_numero from public.equipe_para_fic() where nome = 'Ana Bolsista';
\echo '== 12. corrige o número na mesma turma (OK, continua 1 matrícula)'
select public.matricular_fic((select id from public.turmas_fic limit 1), (select id from public.equipe_para_fic() where nome = 'Ana Bolsista'), '20261FIC0009', current_date - 1) is not null as ok;
select count(*) as matriculas, max(numero) from public.matriculas_fic;
\echo '== 13. agente da BA na turma PI (ERRO: estado)'
select public.matricular_fic((select id from public.turmas_fic limit 1), (select id from public.equipe_para_fic() where nome = 'Bia Agente'), '20261FIC0002', current_date - 1);
\echo '== 14. matricular outro professor (ERRO)'
select public.matricular_fic((select id from public.turmas_fic limit 1), (select id from public.equipe_para_fic() where nome = 'Professora Dois'), '20261FIC0003', current_date - 1);
\echo '== 15. data no futuro (ERRO)'
select public.matricular_fic((select id from public.turmas_fic limit 1), (select id from public.equipe_para_fic() where nome = 'Ana Bolsista'), '20261FIC0009', current_date + 3);
\echo '== 16. professor não altera a equipe direto (0 linhas alteradas)'
update public.equipe set matricula_fic_em = '2026-10-01' where email = 'bia@x.org';
reset role;

select pg_temp.como('prof2@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 17. outro professor matricula na turma do colega (OK: qualquer professor matricula)'
select public.matricular_fic((select id from public.turmas_fic limit 1), (select id from public.equipe_para_fic() where nome = 'Ana Bolsista'), '20261FIC0009', current_date - 1);
reset role;

select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 18. bolsista: não vê turmas (0), vê a própria matrícula (1), não matricula (ERRO)'
select count(*) as turmas from public.turmas_fic;
select count(*) as minhas from public.matriculas_fic;
select public.equipe_para_fic();
select public.matricular_fic((select turma_id from public.matriculas_fic limit 1), (select (public.vincular_conta()).id), '1234', current_date - 1);
reset role;

select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 19. coordenação técnica vê turmas (1) mas não cria (ERRO)'
select count(*) from public.turmas_fic;
insert into public.turmas_fic (nome, professor_id) values ('Turma Tec', (select id from public.equipe where email = 'prof@ifrn.edu.br'));
reset role;

\echo '== 20. com visita no roteiro, cancelar a matrícula (ERRO)'
set session_replication_role = replica;
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao)
values ('10000000-0000-0000-0000-000000000001','PI','Paulistana','Lagoa','Maria Um Teste','52998224725','1980-01-01','Sítio 1',true,true,true,true,true,true,true,true,true,true,'selecionada','2026-10-20','aprovada');
insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'PI', 'diagnostico', (select id from public.equipe where email = 'ana@x.org'), '2026-11-01');
set session_replication_role = origin;
select pg_temp.como('prof@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
select public.cancelar_matricula_fic((select id from public.matriculas_fic limit 1), 'Matrícula errada');
reset role;
\echo '== 21. sem visita, cancela (OK) e a habilitação fica sem matrícula'
delete from public.visitas;
select pg_temp.como('prof@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '   motivo curto (ERRO)'
select public.cancelar_matricula_fic((select id from public.matriculas_fic limit 1), 'x');
select public.cancelar_matricula_fic((select id from public.matriculas_fic limit 1), 'Matrícula lançada na pessoa errada');
select nome, matricula_fic_em from public.equipe_para_fic() where nome = 'Ana Bolsista';
reset role;
\echo '== 22. auditoria registrou turma e matrículas (>= 3)'
select count(*) from public.auditoria where tabela in ('turmas_fic','matriculas_fic');

-- ===================== auxiliar administrativo =====================
select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== A1. coordenação técnica cadastra auxiliar (ERRO)'
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('auxiliar_adm','Aux Errado','77777777777','aux@ifrn.edu.br','2026-10-01',true);
reset role;
select pg_temp.como('cleone.lima@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== A2. coordenação geral gera convite de auxiliar (t), cadastra um (OK); o segundo (ERRO) e novo convite (ERRO): é um só'
select length(public.criar_convite('auxiliar_adm')) > 10 as convite_ok;
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('auxiliar_adm','Auxiliar Um','77777777777','aux@ifrn.edu.br','2026-10-01',true);
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('auxiliar_adm','Auxiliar Dois','88888888888','aux2@ifrn.edu.br','2026-10-01',true);
select public.criar_convite('auxiliar_adm');
reset role;
insert into auth.users(email) values ('aux@ifrn.edu.br');
select pg_temp.como('aux@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== A3. auxiliar vê a equipe toda (7: geral, técnica, Ana, Bia, 2 professores, auxiliar)'
select count(*) from public.equipe;
\echo '== A4. auxiliar registra Arlo e termo da Ana (OK: 1 linha)'
update public.equipe set docs_funcern_em = current_date - 1, termo_assinado_em = current_date - 1 where email = 'ana@x.org' returning nome, docs_funcern_em is not null as arlo;
\echo '== A5. auxiliar muda o telefone da Ana (ERRO)'
update public.equipe set telefone = '(84) 90000-0000' where email = 'ana@x.org';
\echo '== A6. auxiliar registra a própria habilitação (ERRO)'
update public.equipe set docs_funcern_em = current_date - 1 where email = 'aux@ifrn.edu.br';
\echo '== A7. auxiliar mexe na coordenação geral (0 linhas)'
update public.equipe set docs_funcern_em = current_date - 1 where papel = 'coord_geral' returning id;
\echo '== A8. auxiliar lança matrícula FIC (ERRO)'
update public.equipe set matricula_fic_em = current_date - 1 where email = 'bia@x.org';
\echo '== A9. auxiliar desliga alguém (ERRO)'
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste de desligamento' where email = 'bia@x.org';
\echo '== A10. auxiliar vê a conta da Ana (vazia: null) e a consulta fica no histórico (1)'
select public.ver_conta_para_arlo((select id from public.equipe where email = 'ana@x.org')) is null as sem_conta;
reset role;
select count(*) as consultas from public.auditoria where tabela = 'equipe_bancario' and acao = 'VIEW';
select pg_temp.como('cleone.lima@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== A11. a coordenação geral registra a habilitação do auxiliar (OK) e ele fica habilitado sem FIC (t)'
update public.equipe set docs_funcern_em = current_date - 1, termo_assinado_em = current_date - 1 where email = 'aux@ifrn.edu.br';
reset role;
select public.habilitado(e) from public.equipe e where email = 'aux@ifrn.edu.br';
select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== A12. bolsista tenta ver conta de outra pessoa (ERRO)'
select public.ver_conta_para_arlo((select (public.vincular_conta()).id));
reset role;
