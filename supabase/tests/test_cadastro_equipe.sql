\set QUIET on
\pset format unaligned
\pset tuples_only on
alter table auth.users add column if not exists raw_user_meta_data jsonb;
create table if not exists res (n serial, caso text, ok boolean, det text);
truncate res;
-- executa SQL como um usuário (uuid do auth) e compara com o esperado ('ok' ou trecho do erro)
create or replace function t(caso text, quem uuid, cmd text, espera text) returns void language plpgsql as $$
declare msg text := 'ok'; r text;
begin
  begin
    perform set_config('request.jwt.claim.sub', coalesce(quem::text,''), true);
    perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
    execute cmd;
    perform set_config('role', 'none', true);
    raise exception 'ROLLBACK_OK';
  exception when others then
    msg := case when sqlerrm = 'ROLLBACK_OK' then 'ok' else sqlerrm end;
  end;
  perform set_config('role', 'none', true);
  insert into res(caso, ok, det) values (caso, case when espera = 'ok' then msg = 'ok' else msg <> 'ok' and msg ilike '%'||espera||'%' end, msg);
end $$;
-- igual, mas grava de verdade (para montar o cenário)
create or replace function f(quem uuid, cmd text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(quem::text,''), true);
  perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
  execute cmd;
  perform set_config('role', 'none', true);
end $$;
-- liga um login a uma pessoa
create or replace function logar(p_email text) returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  alter table auth.users disable trigger user;
  insert into auth.users(id, email) values (u, p_email);
  alter table auth.users enable trigger user;
  update public.equipe set user_id = u where email = p_email and status = 'ativa';
  return u;
end $$;
grant all on res to authenticated, anon; grant usage on sequence res_n_seq to authenticated, anon;

select logar('cleone.lima@ifrn.edu.br') \gset g_
\set G '''' :g_logar ''''
-- helpers de insert
create or replace function ins(papel text, uf text, nome text, cpf text, email text, extra text default '') returns text language sql as $$
  select format('insert into public.equipe(papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd%s) values (%L, %L, %L, %L, %L, ''(84) 99999-0000'', current_date, true%s)',
    case when extra = '' then '' else ', ' || split_part(extra, '=', 1) end, papel, nullif(uf,''), nome, cpf, email,
    case when extra = '' then '' else ', ' || split_part(extra, '=', 2) end)
$$;

-- ===== 1. Coordenação geral cadastra coordenação técnica
select t('G cadastra coord_tecnico', :G, ins('coord_tecnico','','Maria Técnica Silva','11144477735','tecnica@t.com'), 'ok');
select f(:G, ins('coord_tecnico','','Maria Técnica Silva','11144477735','tecnica@t.com'));
select t('G: segunda coord_tecnico bloqueada', :G, ins('coord_tecnico','','Outra Técnica Souza','39053344705','t2@t.com'), 'equipe_uma_coordenacao');
select t('coord_tecnico com UF bloqueada', :G, ins('coord_tecnico','PI','Outra Técnica Souza','39053344705','t2@t.com'), 'uf_por_papel');
select logar('tecnica@t.com') \gset t_
\set T '''' :t_logar ''''

-- ===== 2. Coordenação técnica: bolsistas e agentes
select t('T cadastra articulacao PI', :T, ins('articulacao','PI','Ana Articulação Lima','52998224725x','a@t.com'), 'equipe_cpf_check');
select t('T cadastra articulacao PI (CPF ok)', :T, ins('articulacao','PI','Ana Articulação Lima','15350946056','art.pi@t.com'), 'ok');
select f(:T, ins('articulacao','PI','Ana Articulação Lima','15350946056','art.pi@t.com'));
select t('T: segunda articulacao PI bloqueada', :T, ins('articulacao','PI','Bia Segunda Lima','86288366757','b@t.com'), 'equipe_uma_bolsista_por_uf');
select t('T cadastra apoio PI', :T, ins('apoio','PI','Carla Apoio Nunes','86288366757','apoio.pi@t.com'), 'ok');
select f(:T, ins('apoio','PI','Carla Apoio Nunes','86288366757','apoio.pi@t.com'));
select t('T cadastra articulacao BA', :T, ins('articulacao','BA','Dora Bahia Santos','74682489070','art.ba@t.com'), 'ok');
select f(:T, ins('articulacao','BA','Dora Bahia Santos','74682489070','art.ba@t.com'));
select t('T cadastra agente PI', :T, ins('agente','PI','Eva Agente Rocha','60724123055','ag1@t.com'), 'ok');
select f(:T, ins('agente','PI','Eva Agente Rocha','60724123055','ag1@t.com'));
select t('T cadastra 2a agente PI (sem limite)', :T, ins('agente','PI','Fia Agente Costa','23100562090','ag2@t.com'), 'ok');
select f(:T, ins('agente','PI','Fia Agente Costa','23100562090','ag2@t.com'));
select t('agente sem UF bloqueada', :T, ins('agente','','Gil Agente Sem','04253865058','ag3@t.com'), 'uf_por_papel');
select t('UF fora do projeto (CE) bloqueada', :T, ins('agente','CE','Gil Agente Ceará','04253865058','ag3@t.com'), 'equipe_uf_check');
select t('CPF repetido bloqueado', :T, ins('agente','PI','Outra Pessoa Igual','15350946056','x1@t.com'), 'equipe_cpf_ativo');
select t('e-mail repetido (maiúsculas) bloqueado', :T, ins('agente','PI','Outra Pessoa Igual','04253865058','ART.PI@T.COM'), 'equipe_email_ativo');
select t('e-mail inválido bloqueado', :T, ins('agente','PI','Outra Pessoa Igual','04253865058','semarroba.com'), 'equipe_email_check');
select t('nome curto bloqueado', :T, ins('agente','PI','Ana','04253865058','n@t.com'), 'equipe_nome_check');
select t('sem LGPD bloqueado', :T, replace(ins('agente','PI','Hana Sem Lgpd','04253865058','l@t.com'), 'current_date, true', 'current_date, false'), 'consentimento');
select t('SIAPE com 4 números bloqueado', :T, ins('agente','PI','Iara Siape Curto','04253865058','s@t.com','siape=''1234'''), 'siape_ok');
select t('meta acima de 40 bloqueada', :T, ins('apoio','BA','Jana Meta Alta','04253865058','m@t.com','meta_quintais=41'), 'meta_quintais');
select t('T não cadastra professor_fic', :T, ins('professor_fic','','Prof Tentativa Silva','04253865058','p@t.com'), 'row-level security');
select t('T não cadastra auxiliar', :T, ins('auxiliar_adm','','Aux Tentativa Silva','04253865058','x@t.com'), 'row-level security');
select t('T não cadastra outra coord_tecnico', :T, ins('coord_tecnico','','Coord Tentativa Silva','04253865058','c@t.com'), 'row-level security');
select t('T não cadastra coord_geral', :T, ins('coord_geral','','Geral Tentativa Silva','04253865058','g@t.com'), 'row-level security');

-- ===== 3. Coordenação geral: professor e auxiliar
select t('G cadastra professor_fic', :G, ins('professor_fic','','Paulo Professor Dias','04253865058','prof1@t.com'), 'ok');
select f(:G, ins('professor_fic','','Paulo Professor Dias','04253865058','prof1@t.com'));
select t('G cadastra 2o professor', :G, ins('professor_fic','','Pedro Professor Reis','34608514300','prof2@t.com'), 'ok');
select t('professor com UF bloqueado', :G, ins('professor_fic','RN','Pedro Professor Reis','34608514300','prof2@t.com'), 'equipe_uf_check');
select t('G cadastra auxiliar', :G, ins('auxiliar_adm','','Rita Auxiliar Melo','20578318044','aux@t.com'), 'ok');
select f(:G, ins('auxiliar_adm','','Rita Auxiliar Melo','20578318044','aux@t.com'));
select t('G: segundo auxiliar bloqueado', :G, ins('auxiliar_adm','','Rui Auxiliar Dois','34608514300','aux2@t.com'), 'equipe_um_auxiliar');
select t('G cadastra articulacao AL', :G, ins('articulacao','AL','Sara Alagoas Pinto','34608514300','art.al@t.com'), 'ok');
select t('G não cadastra outra coord_geral', :G, ins('coord_geral','','Geral Dois Silva','34608514300','g2@t.com'), 'row-level security');
select logar('art.pi@t.com') \gset b_
\set B '''' :b_logar ''''
select logar('ag1@t.com') \gset a_
\set A '''' :a_logar ''''
select logar('prof1@t.com') \gset p_
\set P '''' :p_logar ''''
select logar('aux@t.com') \gset x_
\set X '''' :x_logar ''''
select logar('art.ba@t.com') \gset bb_
\set BB '''' :bb_logar ''''

-- ===== 4. Quem não pode cadastrar
select t('bolsista não cadastra agente', :B, ins('agente','PI','Tina Tentativa Silva','34608514300','tt@t.com'), 'row-level security');
select t('agente não cadastra agente', :A, ins('agente','PI','Tina Tentativa Silva','34608514300','tt@t.com'), 'row-level security');
select t('professor não cadastra agente', :P, ins('agente','PI','Tina Tentativa Silva','34608514300','tt@t.com'), 'row-level security');
select t('auxiliar não cadastra agente', :X, ins('agente','PI','Tina Tentativa Silva','34608514300','tt@t.com'), 'row-level security');
select t('anônimo não cadastra', null, ins('agente','PI','Tina Tentativa Silva','34608514300','tt@t.com'), 'permission denied');

-- ===== 5. Edição
select t('T edita celular da bolsista', :T, $$update public.equipe set telefone='(86) 98888-7777' where email='art.pi@t.com'$$, 'ok');
select t('T não muda CPF', :T, $$update public.equipe set cpf='34608514300' where email='art.pi@t.com'$$, 'CPF não podem');
select t('T não muda estado', :T, $$update public.equipe set uf='BA' where email='art.pi@t.com'$$, 'não podem ser alterados');
select t('auxiliar registra Arlo', :X, $$update public.equipe set docs_funcern_em=current_date where email='art.pi@t.com'$$, 'ok');
select t('auxiliar não muda nome', :X, $$update public.equipe set nome='Nome Trocado Silva' where email='art.pi@t.com'$$, 'só registra');
select t('bolsista não edita a si mesma (nome)', :B, $q$do $x$ begin update public.equipe set nome='Eu Mesma Trocada' where email='art.pi@t.com'; if not found then raise exception 'nada alterado'; end if; end $x$ $q$, 'nada alterado');
select t('T não edita professor', :T, $q$do $x$ begin update public.equipe set telefone='(84)1' where email='prof1@t.com'; if not found then raise exception 'nada alterado'; end if; end $x$ $q$, 'nada alterado');

-- ===== 6. Quem vê o quê
select t('bolsista PI não vê bolsista BA', :B, $q$do $x$ begin if exists(select 1 from public.equipe where uf='BA') then raise exception 'VIU BA'; end if; end $x$ $q$, 'ok');
select t('bolsista PI vê agentes do PI', :B, $q$do $x$ begin if (select count(*) from public.equipe where papel='agente') < 2 then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('agente só vê a si mesma', :A, $q$do $x$ begin if (select count(*) from public.equipe) <> 1 then raise exception 'viu %', (select count(*) from public.equipe); end if; end $x$ $q$, 'ok');
select t('professor só vê a si mesmo na equipe', :P, $q$do $x$ begin if (select count(*) from public.equipe) <> 1 then raise exception 'viu %', (select count(*) from public.equipe); end if; end $x$ $q$, 'ok');

-- ===== 7. Dados pessoais (equipe_privado)
select f(:T, $$insert into public.equipe_privado(equipe_id, data_nascimento, nis, endereco) select id, '1990-05-01', '12345678901', '{"cidade":"Picos","uf":"PI"}' from public.equipe where email='art.pi@t.com'$$);
select t('bolsista lê os próprios dados pessoais', :B, $q$do $x$ begin if not exists(select 1 from public.equipe_privado) then raise exception 'não leu'; end if; end $x$ $q$, 'ok');
select t('agente NÃO lê dados pessoais da bolsista', :A, $q$do $x$ begin if exists(select 1 from public.equipe_privado) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('bolsista BA NÃO lê dados da bolsista PI', :BB, $q$do $x$ begin if exists(select 1 from public.equipe_privado) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('professor NÃO lê dados pessoais', :P, $q$do $x$ begin if exists(select 1 from public.equipe_privado) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('auxiliar lê dados pessoais (Arlo)', :X, $q$do $x$ begin if not exists(select 1 from public.equipe_privado) then raise exception 'não leu'; end if; end $x$ $q$, 'ok');

-- ===== 8. Link de cadastro
select t('T gera link de agente', :T, $$select public.criar_convite('agente','PI')$$, 'ok');
select t('T gera link de apoio BA (vaga livre)', :T, $$select public.criar_convite('apoio','BA')$$, 'ok');
select t('T: link para vaga ocupada bloqueado', :T, $$select public.criar_convite('articulacao','PI')$$, 'ocupada');
select t('T: link de professor bloqueado', :T, $$select public.criar_convite('professor_fic')$$, 'não pode cadastrar');
select t('G: link de auxiliar com vaga ocupada bloqueado', :G, $$select public.criar_convite('auxiliar_adm')$$, 'auxiliar');
select t('G gera link de professor', :G, $$select public.criar_convite('professor_fic')$$, 'ok');
select t('bolsista não gera link', :B, $$select public.criar_convite('agente','PI')$$, 'não pode');
select t('agente não gera link', :A, $$select public.criar_convite('agente','PI')$$, 'não pode');
-- cria links reais
create temp table lk(k text, token text); grant all on lk to authenticated, anon;
select f(:T, $$insert into lk select 'ag', public.criar_convite('agente','PI')$$);
select f(:T, $$insert into lk select 'ag2', public.criar_convite('agente','PI')$$);
select f(:T, $$insert into lk select 'apBA', public.criar_convite('apoio','BA')$$);
select f(:T, $$insert into lk select 'apBA2', public.criar_convite('apoio','BA')$$);
select f(:G, $$insert into lk select 'prof', public.criar_convite('professor_fic')$$);
select f(:G, $$insert into lk select 'venc', public.criar_convite('agente','SE')$$);
update public.convites set expira_em = now() - interval '1 minute' where token = (select token from lk where k='venc');
create or replace function envia(k text, dados text) returns text language sql as $$
  select format('select public.enviar_pre_cadastro((select token from lk where k=%L), %L::jsonb)', k, dados) $$;
\set D '{"nome":"Luzia Rural Silva","cpf":"476.024.360-00","email":" Luzia@Gmail.com ","telefone":"(89) 99911-2233","consentimento_lgpd":true,"cadastro_arlo":false,"data_nascimento":"1985-03-10","endereco":{"cidade":"Picos","uf":"PI"},"perfil":{"agricultora":true,"atua_mulheres":true,"mora_rural":true,"internet":true,"outra_bolsa":false,"experiencia":"mais5"}}'
select t('link: anônima vê o convite', null, $$select public.ver_convite((select token from lk where k='ag'))$$, 'ok');
select t('link: sem LGPD bloqueado', null, envia('ag', replace(:'D', '"consentimento_lgpd":true', '"consentimento_lgpd":false')), 'aceitar o uso');
select t('link: sem nascimento (sem Arlo) bloqueado', null, envia('ag', replace(:'D', '"data_nascimento":"1985-03-10",', '')), 'nascimento');
select t('link: com Arlo não exige nascimento', null, envia('ag', replace(replace(:'D', '"data_nascimento":"1985-03-10",', ''), '"cadastro_arlo":false', '"cadastro_arlo":true')), 'ok');
select t('link: CPF de pessoa ativa bloqueado', null, envia('ag', replace(:'D', '476.024.360-00', '15350946056')), 'Já existe pessoa ativa');
select t('link: e-mail de pessoa ativa bloqueado', null, envia('ag', replace(:'D', ' Luzia@Gmail.com ', 'AG1@t.com')), 'Já existe pessoa ativa');
select t('link: vencido bloqueado', null, envia('venc', :'D'), 'não vale mais');
select t('link: token inventado bloqueado', null, 'select public.enviar_pre_cadastro(''abc'', ''{}''::jsonb)', 'não vale mais');
select t('link: envio válido', null, envia('ag', :'D'), 'ok');
select f(null, envia('ag', :'D'));
select t('link: mesmo link 2a vez bloqueado', null, envia('ag', :'D'), 'não vale mais');
select t('link: e-mail guardado em minúsculas sem espaço', :T, $q$do $x$ begin if (select email from public.pre_cadastros where nome='Luzia Rural Silva') <> 'luzia@gmail.com' then raise exception 'email=%', (select email from public.pre_cadastros where nome='Luzia Rural Silva'); end if; end $x$ $q$, 'ok');
select t('link: perfil no campo guardado', :T, $q$do $x$ begin if (select perfil->>'experiencia' from public.pre_cadastros where nome='Luzia Rural Silva') is distinct from 'mais5' then raise exception 'perfil perdido'; end if; end $x$ $q$, 'ok');
select t('link: mesma pessoa por outro link (duplicado pendente)', null, envia('ag2', :'D'), 'Já');
select t('link: anônima não lê pré-cadastros', null, $q$do $x$ begin if exists(select 1 from public.pre_cadastros) then raise exception 'LEU'; end if; end $x$ $q$, 'permission denied');
select t('bolsista não lê pré-cadastros', :B, $q$do $x$ begin if exists(select 1 from public.pre_cadastros) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('auxiliar não lê pré-cadastros', :X, $q$do $x$ begin if exists(select 1 from public.pre_cadastros) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
-- professor pelo link
select t('link professor: envio válido', null, envia('prof', replace(replace(replace(:'D','Luzia Rural Silva','Otávio Professor Luz'),'476.024.360-00','12345678909'),'Luzia@Gmail.com','otavio@t.com')), 'ok');
select t('T não vê pré-cadastro de professor', :T, $q$do $x$ begin if exists(select 1 from public.pre_cadastros where papel='professor_fic') then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
-- aprovação
select t('T aprova: cria na equipe', :T, $$insert into public.equipe(papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd) select papel, uf, nome, cpf, email, telefone, current_date, true from public.pre_cadastros where nome='Luzia Rural Silva'$$, 'ok');
select f(:T, $$insert into public.equipe(papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd) select papel, uf, nome, cpf, email, telefone, current_date, true from public.pre_cadastros where nome='Luzia Rural Silva'$$);
select t('T marca pré-cadastro aprovado', :T, $$update public.pre_cadastros set situacao='aprovado', equipe_id=(select id from public.equipe where cpf='47602436000') where nome='Luzia Rural Silva'$$, 'ok');
select t('T salva perfil da aprovada (equipe_privado)', :T, $$insert into public.equipe_privado(equipe_id, perfil) select id, '{"agricultora":true}' from public.equipe where cpf='47602436000'$$, 'ok');
-- duas pessoas pela mesma vaga de apoio BA
select f(null, envia('apBA', replace(replace(replace(:'D','Luzia Rural Silva','Maria Um Bahia'),'476.024.360-00','39053344705'),' Luzia@Gmail.com ','m1@t.com')));
select f(null, envia('apBA2', replace(replace(replace(:'D','Luzia Rural Silva','Maria Dois Bahia'),'476.024.360-00','86288366757'),' Luzia@Gmail.com ','m2@t.com')));

-- ===== 9. Desligar e substituir
select t('T desliga sem motivo bloqueado', :T, $$update public.equipe set status='desligada', data_fim=current_date where email='art.pi@t.com'$$, 'desligamento_completo');
select f(:T, $$update public.equipe set status='desligada', data_fim=current_date, motivo_desligamento='Pediu para sair do projeto' where email='art.pi@t.com'$$);
select t('T cadastra substituta na vaga', :T, $q$insert into public.equipe(papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd, substitui_id) values ('articulacao','PI','Nova Substituta Pi','34608514300','subst@t.com','(86) 90000-0000', current_date, true, (select id from public.equipe where email='art.pi@t.com'))$q$, 'ok');
select t('não reativa desligada', :T, $$update public.equipe set status='ativa', data_fim=null, motivo_desligamento=null where email='art.pi@t.com'$$, 'não pode ser reativado');
select t('desligada pode voltar com novo cadastro (mesmo CPF)', :T, ins('agente','PI','Ana Articulação Lima','15350946056','art.pi@t.com'), 'ok');
select t('desligada perde o login', :G, $q$do $x$ begin if (select user_id from public.equipe where email='art.pi@t.com' and status='desligada') is not null then raise exception 'ainda tem login'; end if; end $x$ $q$, 'ok');

-- ===== 10. Código de acesso
select t('T gera código para bolsista', :T, $$select public.gerar_codigo_acesso((select id from public.equipe where email='apoio.pi@t.com'))$$, 'ok');
select t('bolsista não gera código', :B, $$select public.gerar_codigo_acesso((select id from public.equipe where email='ag2@t.com'))$$, '');
select t('T não gera código para professor', :T, $$select public.gerar_codigo_acesso((select id from public.equipe where email='prof1@t.com'))$$, '');

-- ===== auditoria
select t('histórico registra os cadastros', :G, $q$do $x$ begin if (select count(*) from public.auditoria where tabela='equipe' and acao='INSERT') < 8 then raise exception 'poucos registros: %', (select count(*) from public.auditoria where tabela='equipe' and acao='INSERT'); end if; end $x$ $q$, 'ok');

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 110) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
