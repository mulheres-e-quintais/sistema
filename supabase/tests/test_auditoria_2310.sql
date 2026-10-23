-- 76: auditoria de segurança de 23/10/2026 — cadastro novo sem habilitação; e-mail do link é o da pessoa
begin;
set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000076c1', 'cg.t76@exemplo.invalid'), ('00000000-0000-0000-0000-0000000076c2', 'ct.t76@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000076c3', 'aux.t76@exemplo.invalid');
update public.equipe set user_id = null where user_id in ('00000000-0000-0000-0000-0000000076c1', '00000000-0000-0000-0000-0000000076c2', '00000000-0000-0000-0000-0000000076c3');
update public.equipe set user_id = '00000000-0000-0000-0000-0000000076c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste 76', user_id = null where papel in ('coord_tecnico', 'auxiliar_adm') and status = 'ativa';
insert into public.equipe (id, user_id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status) values
  ('00000000-0000-0000-0000-0000000076a2', '00000000-0000-0000-0000-0000000076c2', 'coord_tecnico', null, 'Técnica T76', '76017601100', 'ct.t76@exemplo.invalid', '2026-10-01', true, 'ativa'),
  ('00000000-0000-0000-0000-0000000076a3', '00000000-0000-0000-0000-0000000076c3', 'auxiliar_adm', null, 'Auxiliar T76', '76017601200', 'aux.t76@exemplo.invalid', '2026-10-01', true, 'ativa'),
  ('00000000-0000-0000-0000-0000000076a5', null, 'agente', 'PE', 'Agente Com Questionário', '76017601300', 'agente.t76@exemplo.invalid', '2026-10-01', true, 'ativa');
insert into public.equipe_socio (equipe_id, socioeconomico) values ('00000000-0000-0000-0000-0000000076a5', '{"renda":"reservado"}');
insert into public.convites (id, token, papel, uf, criado_por) values
  ('00000000-0000-0000-0000-0000000076e1', 'tok-t76-um', 'agente', 'PE', '00000000-0000-0000-0000-0000000076a2'),
  ('00000000-0000-0000-0000-0000000076e2', 'tok-t76-dois', 'agente', 'PE', '00000000-0000-0000-0000-0000000076a2');
insert into public.pre_cadastros (id, convite_id, papel, uf, nome, cpf, email, telefone, consentimento_lgpd) values
  ('00000000-0000-0000-0000-0000000076d1', '00000000-0000-0000-0000-0000000076e1', 'agente', 'PE', 'Pessoa do Link Um', '76123456091', 'pessoa.um@exemplo.invalid', '(81) 99999-0000', true),
  ('00000000-0000-0000-0000-0000000076d2', '00000000-0000-0000-0000-0000000076e2', 'agente', 'PE', 'Pessoa do Link Dois', '76234567096', 'pessoa.dois@exemplo.invalid', '(81) 99999-0001', true);
set session_replication_role = origin;

create temp table _r (caso text, erro text, valor text) on commit drop; grant all on _r to authenticated, anon;
create function pg_temp.tenta(caso text, quem uuid, cmd text) returns void language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', 'authenticated', true);
  begin execute cmd into v; insert into _r values (caso, null, v); exception when others then insert into _r values (caso, sqlerrm, null); end;
  perform set_config('role', 'postgres', true);
end $$;
create function pg_temp.ok(caso text, deve text, titulo text) returns text language sql as $$
  select case when (deve = 'ok' and (select erro from _r where _r.caso = ok.caso) is null)
                or (deve <> 'ok' and (select erro from _r where _r.caso = ok.caso) ~ deve) then 'PASSOU' else 'FALHOU' end
         || ' 76: ' || titulo || ' | ' || coalesce((select erro from _r where _r.caso = ok.caso), (select valor from _r where _r.caso = ok.caso), 'gravou')
$$;
\set CG '00000000-0000-0000-0000-0000000076c1'
\set CT '00000000-0000-0000-0000-0000000076c2'
\set AUX '00000000-0000-0000-0000-0000000076c3'

-- 1. cadastro novo com habilitação preenchida
select pg_temp.tenta('ct_hab', :'CT', $$insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd,
    matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_path, termo_assinado_em, obs_habilitacao)
  values ('00000000-0000-0000-0000-0000000076f1', 'apoio', 'AL', 'Bolsista Fantasma', '39053344705', 'fantasma.t76@exemplo.invalid', '(82) 99999-0000', '2026-10-01', true,
    current_date - 1, '2026999', current_date - 1, 'equipe/x/termo_1.pdf', current_date - 1, 'tudo certo')
  returning concat_ws('|', matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_path, termo_assinado_em, obs_habilitacao, public.habilitado(equipe.*))$$);
select pg_temp.tenta('cg_hab', :'CG', $$insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd, docs_funcern_em)
  values ('00000000-0000-0000-0000-0000000076f2', 'agente', 'AL', 'Agente da Geral', '93541134780', 'agente.geral.t76@exemplo.invalid', '(82) 99999-0001', '2026-10-01', true, current_date - 1)
  returning coalesce(docs_funcern_em::text, 'vazio')$$);
select pg_temp.tenta('aux_arlo', :'AUX', $$update public.equipe set docs_funcern_em = current_date where id = '00000000-0000-0000-0000-0000000076f1' returning docs_funcern_em::text$$);
reset role;
select case when (select valor from _r where caso = 'ct_hab') in ('false', 'f') then 'PASSOU' else 'FALHOU' end
  || ' 76: cadastro novo feito pela coordenação técnica nasce sem matrícula, Arlo, termo e observação, e não habilitado | ' || coalesce((select valor from _r where caso = 'ct_hab'), (select erro from _r where caso = 'ct_hab'));
select case when (select valor from _r where caso = 'cg_hab') <> 'vazio' then 'PASSOU' else 'FALHOU' end || ' 76: a coordenação geral continua podendo cadastrar com a data do Arlo | ' || coalesce((select valor from _r where caso = 'cg_hab'), (select erro from _r where caso = 'cg_hab'));
select pg_temp.ok('aux_arlo', 'ok', 'o auxiliar continua registrando o Arlo depois do cadastro');

-- 2a. aprovar o cadastro do link com outro e-mail
select pg_temp.tenta('ct_outro_email', :'CT', $$select (public.aprovar_pre_cadastro('00000000-0000-0000-0000-0000000076d1',
  '{"papel":"agente","uf":"PE","nome":"Pessoa do Link Um","cpf":"76123456091","email":"ct.apelido@exemplo.invalid","telefone":"(81) 99999-0000","data_inicio":"2026-10-01","consentimento_lgpd":true}', null)).id::text$$);
select pg_temp.tenta('ct_mesmo_email', :'CT', $$select (public.aprovar_pre_cadastro('00000000-0000-0000-0000-0000000076d1',
  '{"papel":"agente","uf":"PE","nome":"Pessoa do Link Um","cpf":"76123456091","email":" Pessoa.Um@exemplo.invalid","telefone":"(81) 99999-0000","data_inicio":"2026-10-01","consentimento_lgpd":true}', null)).id::text$$);
select pg_temp.tenta('cg_outro_email', :'CG', $$select (public.aprovar_pre_cadastro('00000000-0000-0000-0000-0000000076d2',
  '{"papel":"agente","uf":"PE","nome":"Pessoa do Link Dois","cpf":"76234567096","email":"pessoa.dois.certo@exemplo.invalid","telefone":"(81) 99999-0001","data_inicio":"2026-10-01","consentimento_lgpd":true}', null)).id::text$$);
-- 2b. trocar o e-mail de quem respondeu o questionário
select pg_temp.tenta('ct_email_socio', :'CT', $$update public.equipe set email = 'ct.apelido2@exemplo.invalid' where id = '00000000-0000-0000-0000-0000000076a5' returning email$$);
select pg_temp.tenta('ct_tel_socio', :'CT', $$update public.equipe set telefone = '(81) 98888-0000' where id = '00000000-0000-0000-0000-0000000076a5' returning telefone$$);
select pg_temp.tenta('cg_email_socio', :'CG', $$update public.equipe set email = 'agente.certo.t76@exemplo.invalid' where id = '00000000-0000-0000-0000-0000000076a5' returning email$$);
reset role;
select pg_temp.ok('ct_outro_email', 'mandou pelo link', 'coordenação técnica não aprova o cadastro do link com outro e-mail');
select pg_temp.ok('ct_mesmo_email', 'ok', 'coordenação técnica aprova com o e-mail que a pessoa mandou (maiúsculas e espaço não contam)');
select pg_temp.ok('cg_outro_email', 'ok', 'a coordenação geral pode aprovar com o e-mail corrigido');
select pg_temp.ok('ct_email_socio', 'questionário socioeconômico', 'coordenação técnica não troca o e-mail de quem respondeu o questionário');
select pg_temp.ok('ct_tel_socio', 'ok', 'os outros dados da pessoa a coordenação técnica continua corrigindo');
select pg_temp.ok('cg_email_socio', 'ok', 'a coordenação geral troca o e-mail');
rollback;
