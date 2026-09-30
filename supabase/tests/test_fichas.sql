-- Testes da etapa 2. Rodar depois de stub, 01 (com CPF preenchido) e 02.
\ir _professor_habilitado.sql
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid;
begin
  select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false);
  perform set_config('request.jwt.claim.email', p_email, false);
end $$;
-- equipe mínima (como postgres, sem RLS)
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values
 ('coord_tecnico','Técnica Teste MPA','22222222222','tec@x.org','2026-10-01',true);
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd) values
 ('articulacao','PI','Ana Bolsista PI','33333333333','ana@x.org','2026-10-01',true),
 ('apoio','BA','Bia Bolsista BA','44444444444','bia@x.org','2026-10-01',true);
insert into auth.users(email) values ('tec@x.org'),('ana@x.org'),('bia@x.org'),('cleone.lima@ifrn.edu.br');

create or replace function pg_temp.ficha(p_id uuid, p_uf text, p_cpf text, p_res text, p_agua bool default true) returns void language sql as $$
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao,
    p_sustento,p_cadunico, consent_dados, resultado, encaminhada_para, data_ficha)
  values (p_id, p_uf, 'Paulistana', 'Comunidade Lagoa', 'Maria Teste da Silva', p_cpf, '1980-05-01', 'Sítio Lagoa, 12',
    true,true,true,p_agua,true,true,true,true,true, true,true, true, p_res,
    case when p_res='sem_agua' then 'Programa Cisternas' end, '2026-10-20')
$$;

select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 1. bolsista PI lança ficha no PI (OK)'
select pg_temp.ficha('00000000-0000-0000-0000-000000000001','PI','52998224725','selecionada');
\echo '== 2. bolsista PI tenta lançar no BA (ERRO RLS)'
select pg_temp.ficha('00000000-0000-0000-0000-000000000002','BA','11144477735','selecionada');
\echo '== 3. mesmo CPF de novo (ERRO único)'
select pg_temp.ficha('00000000-0000-0000-0000-000000000003','PI','52998224725','lista_espera');
\echo '== 4. selecionada sem água (ERRO critérios)'
select pg_temp.ficha('00000000-0000-0000-0000-000000000004','PI','11144477735','selecionada', false);
\echo '== 5. sem água com encaminhamento (OK)'
select pg_temp.ficha('00000000-0000-0000-0000-000000000005','PI','11144477735','sem_agua', false);
\echo '== 6. sem consentimento (ERRO)'
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica, consent_dados, resultado, data_ficha)
  values ('00000000-0000-0000-0000-000000000006','PI','Paulistana','Com X','Joana Teste Sem','39053344705','1980-01-01','Rua 1',
    true,true,true,true,true,true,true,true,false,'nao_atende','2026-10-20');
\echo '== 7. bolsista tenta se aprovar (situacao volta a aguardando)'
update public.fichas set situacao='aprovada' where id='00000000-0000-0000-0000-000000000001';
select situacao from public.fichas where id='00000000-0000-0000-0000-000000000001';
\echo '== 8. pontos calculados (espera 4)'
select pontos from public.fichas where id='00000000-0000-0000-0000-000000000001';
reset role;

select pg_temp.como('bia@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 9. bolsista BA não vê fichas do PI (espera 0)'
select count(*) from public.fichas;
reset role;

select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 10. coord técnica vê tudo (espera 2)'
select count(*) from public.fichas;
\echo '== 11. coord técnica tenta mudar nome (ERRO)'
update public.fichas set nome='Outro Nome Qualquer' where id='00000000-0000-0000-0000-000000000001';
\echo '== 12. devolver sem motivo (ERRO)'
update public.fichas set situacao='devolvida' where id='00000000-0000-0000-0000-000000000001';
\echo '== 13. aprovar (OK, aprovada_por preenchido)'
update public.fichas set situacao='aprovada' where id='00000000-0000-0000-0000-000000000001';
select situacao, aprovada_por is not null as tem_aprovador from public.fichas where id='00000000-0000-0000-0000-000000000001';
\echo '== 14. coord técnica não insere ficha (ERRO RLS)'
select pg_temp.ficha('00000000-0000-0000-0000-000000000007','PI','86288366757','nao_atende');
reset role;

select pg_temp.como('ana@x.org'); set role authenticated;
\echo '== 15. bolsista tenta editar ficha aprovada (ERRO)'
update public.fichas set celular='(89) 99999-0000' where id='00000000-0000-0000-0000-000000000001';
reset role;

\echo '== 16. limite de 40 aprovadas por estado (39 + a do teste 13 = 40; a 41ª dá ERRO)'
select set_config('request.jwt.claim.sub','',false);
-- cria 40 selecionadas aprovadas no PI direto como postgres
do $$ begin for i in 1..39 loop
  perform pg_temp.ficha(('00000000-0000-0000-0001-' || lpad(i::text,12,'0'))::uuid,'PI', lpad((10000000000+i)::text,11,'0'),'selecionada');
end loop; end $$;
update public.fichas set situacao='aprovada' where uf='PI' and resultado='selecionada';
select count(*) as aprovadas_pi from public.fichas where uf='PI' and situacao='aprovada' and resultado='selecionada';
select pg_temp.ficha('00000000-0000-0000-0002-000000000001','PI','20000000001','selecionada');
select pg_temp.como('tec@x.org'); set role authenticated;
update public.fichas set situacao='aprovada' where id='00000000-0000-0000-0002-000000000001';
reset role;

select pg_temp.como('cleone.lima@ifrn.edu.br'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 17. coord geral vê mas não altera (espera UPDATE 0)'
update public.fichas set situacao='devolvida', obs_coordenacao='teste de devolução' where id='00000000-0000-0000-0000-000000000005';
select count(*) as fichas_visiveis_coord_geral from public.fichas;
reset role;
\echo '== auditoria de fichas'
select acao, count(*) from public.auditoria where tabela='fichas' group by 1;
