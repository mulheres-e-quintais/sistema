-- Testes da etapa 4. Rodar depois de stub, 01 (CPF preenchido), 02, 03, 04 (banco novo).
\ir _professor_habilitado.sql
\set QUIET 1
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
declare u uuid; begin select id into u from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); perform set_config('request.jwt.claim.email', p_email, false); end $$;
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd) values ('coord_tecnico','Técnica Teste','22222222222','tec@x.org','2026-10-01',true);
insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd) values ('articulacao','PI','Ana Bolsista','33333333333','ana@x.org','2026-10-01',true);
insert into auth.users(email) values ('tec@x.org'),('ana@x.org');
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
  c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, consent_imagem, consent_criancas, resultado, data_ficha, situacao)
values ('10000000-0000-0000-0000-000000000001','PI','Paulistana','Lagoa','Maria Um Teste','52998224725','1980-01-01','Sítio 1',true,true,true,true,true,true,true,true,true,true,true,false,'selecionada','2026-10-20','aguardando'),
       ('10000000-0000-0000-0000-000000000002','PI','Paulistana','Lagoa','Joana Dois Teste','11144477735','1980-01-01','Sítio 2',true,true,true,true,true,true,true,true,true,true,false,false,'selecionada','2026-10-20','aguardando');
update public.fichas set situacao='aprovada' where id='10000000-0000-0000-0000-000000000001';

\echo '== 1. anônimo: vitrine() responde só totais (espera PI selecionadas=1, fichas=2)'
set role anon;
select e->>'uf' uf, e->>'fichas' fichas, e->>'selecionadas' sel from jsonb_array_elements(public.vitrine()->'por_uf') e where e->>'uf'='PI';
\echo '== 2. anônimo lê fichas direto (ERRO: sem permissão)'
select count(*) from public.fichas;
\echo '== 3. anônimo lê vitrine_fotos direto (ERRO: sem permissão)'
select count(*) from public.vitrine_fotos;
reset role;

select pg_temp.como('ana@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 4. bolsista publica foto (ERRO)'
insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('a.jpg','10000000-0000-0000-0000-000000000001','PI','Quintal no Piauí',true);
reset role;

select pg_temp.como('tec@x.org'); set role authenticated; select (public.vincular_conta()).papel;
\echo '== 5. sem autorização de imagem (ERRO)'
insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('b.jpg','10000000-0000-0000-0000-000000000002','PI','Quintal no Piauí',true);
\echo '== 6. sem confirmar ausência de crianças (ERRO)'
insert into public.vitrine_fotos (path, ficha_id, uf, legenda) values ('c.jpg','10000000-0000-0000-0000-000000000001','PI','Quintal no Piauí');
\echo '== 7. legenda com o nome dela (ERRO)'
insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('d.jpg','10000000-0000-0000-0000-000000000001','PI','Canteiro da Maria em Paulistana',true);
\echo '== 8. legenda "Mariana" não é o nome (OK) — e publicação válida (OK)'
insert into public.vitrine_fotos (path, ficha_id, uf, legenda, sem_criancas) values ('e.jpg','10000000-0000-0000-0000-000000000001','BA','Canteiros de hortaliças, sertão do Piauí',true);
select uf, publicada_por is not null as com_autor from public.vitrine_fotos;
reset role;

\echo '== 9. anônimo vê a foto na vitrine (espera 1, uf PI mesmo tendo enviado BA)'
set role anon; select jsonb_array_length(public.vitrine()->'fotos') n, public.vitrine()->'fotos'->0->>'uf' uf; reset role;
\echo '== 10. mulher retira autorização de imagem: foto some da vitrine (espera 0)'
alter table public.fichas disable trigger fichas_antes; update public.fichas set consent_imagem = false where id='10000000-0000-0000-0000-000000000001'; alter table public.fichas enable trigger fichas_antes;
set role anon; select jsonb_array_length(public.vitrine()->'fotos') n; reset role;

\echo '== 11. bolsista lê parâmetros (OK: valor_hora 50) e não altera (ERRO)'
select pg_temp.como('ana@x.org'); set role authenticated;
select valor->>'valor_hora' from public.parametros where chave='custo_visita';
update public.parametros set valor = jsonb_set(valor, '{valor_hora}', '80') where chave='custo_visita';
reset role;
\echo '== 12. coordenação altera preço do litro (OK, com autor)'
select pg_temp.como('tec@x.org'); set role authenticated;
update public.parametros set valor = jsonb_set(valor, '{preco_litro}', '6.8') where chave='custo_visita';
select valor->>'preco_litro' preco, atualizado_por is not null com_autor from public.parametros;
reset role;
\echo '== 13. anônimo não lê parâmetros (0 linhas ou ERRO)'
set role anon; select count(*) from public.parametros; reset role;
\echo '== 14. retirada da autorização manda o arquivo para a lista de remoção (espera 1)'
select count(*) from public.vitrine_remover;
