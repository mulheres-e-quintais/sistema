-- 70: questionário socioeconômico só para a própria pessoa e a coordenação geral
begin;
set session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000070c1', 'cg.t70@exemplo.invalid'), ('00000000-0000-0000-0000-0000000070c2', 'tec.t70@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000070c3', 'art.t70@exemplo.invalid'), ('00000000-0000-0000-0000-0000000070c4', 'aux.t70@exemplo.invalid');
update public.equipe set user_id = null where user_id = '00000000-0000-0000-0000-0000000070c1';
update public.equipe set user_id = '00000000-0000-0000-0000-0000000070c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste 70', user_id = null where papel <> 'coord_geral' and status = 'ativa';
insert into public.equipe (id, user_id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status, matricula_fic_em, docs_funcern_em, termo_assinado_em) values
  ('00000000-0000-0000-0000-0000000070a2', '00000000-0000-0000-0000-0000000070c2', 'coord_tecnico', null, 'Técnica T70', '70017001100', 'tec.t70@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000070a3', '00000000-0000-0000-0000-0000000070c3', 'articulacao', 'PI', 'Articulação T70', '70017002262', 'art.t70@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000070a4', '00000000-0000-0000-0000-0000000070c4', 'auxiliar_adm', null, 'Auxiliar T70', '70017003315', 'aux.t70@exemplo.invalid', '2026-10-01', true, 'ativa', null, '2026-10-01', '2026-10-01'),
  ('00000000-0000-0000-0000-0000000070a5', null, 'professor_fic', null, 'Professor T70', '70017004400', 'prof.t70@exemplo.invalid', '2026-10-01', true, 'ativa', null, '2026-10-01', '2026-10-01');
insert into public.convites (id, token, papel, uf, expira_em) values ('00000000-0000-0000-0000-0000000070e1', 'token-teste-70-socio', 'agente', 'PI', now() + interval '1 day');
set session_replication_role = origin;

create temp table _r (caso text, erro text, valor text) on commit drop; grant all on _r to authenticated, anon;
create function pg_temp.tenta(caso text, quem uuid, cmd text) returns void language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(quem::text, ''), true); perform set_config('role', case when quem is null then 'anon' else 'authenticated' end, true);
  begin execute cmd into v; insert into _r values (caso, null, v); exception when others then insert into _r values (caso, sqlerrm, null); end;
  perform set_config('role', 'postgres', true);
end $$;
create function pg_temp.ok(caso text, deve text, titulo text) returns text language sql as $$
  select case when (deve = 'ok' and (select erro from _r where _r.caso = ok.caso) is null)
                or (deve <> 'ok' and (select erro from _r where _r.caso = ok.caso) ~ deve) then 'PASSOU' else 'FALHOU' end
         || ' 70: ' || titulo || ' | ' || coalesce((select erro from _r where _r.caso = ok.caso), 'gravou')
$$;
create function pg_temp.val(caso text) returns text language sql as $$ select valor from _r where _r.caso = val.caso $$;
\set CG '00000000-0000-0000-0000-0000000070c1'
\set TEC '00000000-0000-0000-0000-0000000070c2'
\set ART '00000000-0000-0000-0000-0000000070c3'
\set AUX '00000000-0000-0000-0000-0000000070c4'

-- 1. a própria pessoa responde (pela tela antiga: coluna de equipe_privado)
select pg_temp.tenta('art_responde', :'ART', $$insert into public.equipe_privado (equipe_id, endereco, socioeconomico) values ('00000000-0000-0000-0000-0000000070a3', '{"cidade": "Pio IX"}', '{"escolaridade": "Médio", "raca_etnia": "Parda", "renda_familiar": 900, "pessoas_casa": 4}') returning 'ok'$$);
select pg_temp.tenta('art_le', :'ART', $$select count(*)::text from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3'$$);
select pg_temp.tenta('tec_le', :'TEC', $$select count(*)::text from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3'$$);
select pg_temp.tenta('aux_le', :'AUX', $$select count(*)::text from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3'$$);
select pg_temp.tenta('cg_le', :'CG', $$select count(*)::text from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3'$$);
select pg_temp.tenta('tec_le_coluna', :'TEC', $$select coalesce(socioeconomico::text, 'vazio') from public.equipe_privado where equipe_id = '00000000-0000-0000-0000-0000000070a3'$$);
select pg_temp.tenta('tec_grava_vazio', :'TEC', $$update public.equipe_privado set socioeconomico = null, endereco = '{"cidade": "Picos"}' where equipe_id = '00000000-0000-0000-0000-0000000070a3' returning 'ok'$$);
select pg_temp.tenta('tec_grava_outro', :'TEC', $$update public.equipe_privado set socioeconomico = '{"raca_etnia": "Branca"}' where equipe_id = '00000000-0000-0000-0000-0000000070a3' returning 'ok'$$);
select pg_temp.tenta('tec_direto', :'TEC', $$insert into public.equipe_socio (equipe_id, socioeconomico) values ('00000000-0000-0000-0000-0000000070a3', '{"raca_etnia": "Branca"}') on conflict (equipe_id) do update set socioeconomico = excluded.socioeconomico returning 'ok'$$);
reset role;
select pg_temp.ok('art_responde', 'ok', 'a própria pessoa responde (tela antiga, pela coluna de dados pessoais)');
select case when pg_temp.val('art_le') = '1' then 'PASSOU' else 'FALHOU' end || ' 70: a própria pessoa vê as respostas | ' || coalesce(pg_temp.val('art_le'), (select erro from _r where caso = 'art_le'));
select case when pg_temp.val('tec_le') = '0' then 'PASSOU' else 'FALHOU' end || ' 70: a coordenação técnica não vê | ' || coalesce(pg_temp.val('tec_le'), (select erro from _r where caso = 'tec_le'));
select case when pg_temp.val('aux_le') = '0' then 'PASSOU' else 'FALHOU' end || ' 70: o auxiliar administrativo não vê | ' || coalesce(pg_temp.val('aux_le'), (select erro from _r where caso = 'aux_le'));
select case when pg_temp.val('cg_le') = '1' then 'PASSOU' else 'FALHOU' end || ' 70: a coordenação geral vê | ' || coalesce(pg_temp.val('cg_le'), (select erro from _r where caso = 'cg_le'));
select case when pg_temp.val('tec_le_coluna') = 'vazio' then 'PASSOU' else 'FALHOU' end || ' 70: a coluna antiga fica vazia (nada para a técnica ler ali) | ' || coalesce(pg_temp.val('tec_le_coluna'), '');
select pg_temp.ok('tec_grava_vazio', 'ok', 'a técnica continua salvando os outros dados pessoais');
select case when (select socioeconomico->>'raca_etnia' from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3') = 'Parda'
  then 'PASSOU' else 'FALHOU' end || ' 70: o que a técnica manda (vazio ou outra resposta) não apaga nem troca as respostas da pessoa';
select pg_temp.ok('tec_direto', 'row-level security|violates', 'a técnica não grava direto nas respostas');

-- 2. cadastro enviado pelo link
select pg_temp.tenta('link', null, $$select public.enviar_pre_cadastro('token-teste-70-socio', '{"nome": "Agente Pelo Link T70", "cpf": "70017005337", "email": "link.t70@exemplo.invalid", "telefone": "(89) 99999-7070", "data_nascimento": "1990-05-05", "consentimento_lgpd": true, "cadastro_arlo": false, "endereco": {"cidade": "Pio IX"}, "socioeconomico": {"escolaridade": "Superior", "raca_etnia": "Preta", "renda_familiar": 1200, "pessoas_casa": 3}}')::text$$);
reset role;
select pg_temp.ok('link', 'ok', 'o cadastro pelo link com o questionário é enviado');
select case when socioeconomico is null and socio_respondido then 'PASSOU' else 'FALHOU' end || ' 70: o cadastro enviado guarda só "respondido", sem as respostas'
  from public.pre_cadastros where cpf = '70017005337';
select case when not exists (select 1 from public.auditoria where tabela = 'pre_cadastros' and depois::text like '%Superior%') then 'PASSOU' else 'FALHOU' end || ' 70: as respostas do link não vão para o histórico';
select pg_temp.tenta('tec_le_pre', :'TEC', $$select count(*)::text from public.pre_cadastros_socio$$);
select pg_temp.tenta('cg_le_pre', :'CG', $$select count(*)::text from public.pre_cadastros_socio s join public.pre_cadastros p on p.id = s.pre_id where p.cpf = '70017005337'$$);
select pg_temp.tenta('tec_aprova', :'TEC', format($q$select (public.aprovar_pre_cadastro(%L, '{"papel": "agente", "uf": "PI", "nome": "Agente Pelo Link T70", "cpf": "70017005337", "email": "link.t70@exemplo.invalid", "telefone": "(89) 99999-7070", "data_inicio": "2026-10-20", "consentimento_lgpd": true}', '{"data_nascimento": "1990-05-05", "endereco": {"cidade": "Pio IX"}}')).id::text$q$,
  (select id from public.pre_cadastros where cpf = '70017005337')));
reset role;
select case when pg_temp.val('tec_le_pre') = '0' then 'PASSOU' else 'FALHOU' end || ' 70: quem confere o cadastro do link não vê as respostas | ' || coalesce(pg_temp.val('tec_le_pre'), (select erro from _r where caso = 'tec_le_pre'));
select case when pg_temp.val('cg_le_pre') = '1' then 'PASSOU' else 'FALHOU' end || ' 70: a coordenação geral vê as respostas do link | ' || coalesce(pg_temp.val('cg_le_pre'), (select erro from _r where caso = 'cg_le_pre'));
select pg_temp.ok('tec_aprova', 'ok', 'a técnica aprova o cadastro do link sem ver as respostas');
select case when (select socioeconomico->>'escolaridade' from public.equipe_socio where equipe_id = pg_temp.val('tec_aprova')::uuid) = 'Superior'
             and not exists (select 1 from public.pre_cadastros_socio s join public.pre_cadastros p on p.id = s.pre_id where p.cpf = '70017005337')
  then 'PASSOU' else 'FALHOU' end || ' 70: na aprovação, as respostas passam para a pessoa e saem do cadastro enviado';

-- 2b. (71) quem confere não troca as respostas de OUTRA pessoa aprovando um cadastro do link com o id dela
insert into public.convites (id, token, papel, uf, expira_em) values ('00000000-0000-0000-0000-0000000070e2', 'token-teste-70-forjado', 'agente', 'PI', now() + interval '1 day');
select pg_temp.tenta('link_forjado', null, $$select public.enviar_pre_cadastro('token-teste-70-forjado', '{"nome": "Outra Pessoa Do Link", "cpf": "70017006309", "email": "forjado.t70@exemplo.invalid", "telefone": "(89) 99999-7071", "data_nascimento": "1991-05-05", "consentimento_lgpd": true, "cadastro_arlo": false, "endereco": {"cidade": "Pio IX"}, "socioeconomico": {"escolaridade": "FORJADO", "raca_etnia": "Branca", "renda_familiar": 1, "pessoas_casa": 1}}')::text$$);
select pg_temp.tenta('tec_forja', :'TEC', $$update public.pre_cadastros set situacao = 'aprovado', equipe_id = '00000000-0000-0000-0000-0000000070a3' where cpf = '70017006309' returning 'ok'$$);
reset role;
select case when (select socioeconomico->>'escolaridade' from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3') = 'Médio'
  then 'PASSOU' else 'FALHOU' end || ' 70: aprovar o cadastro do link apontando para outra pessoa NÃO troca as respostas dela (71) | '
  || coalesce((select socioeconomico->>'escolaridade' from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3'), 'sem respostas')
  || ' | ' || coalesce((select erro from _r where caso = 'link_forjado'), '') || coalesce((select erro from _r where caso = 'tec_forja'), '');

-- 3. a própria pessoa apaga
select pg_temp.tenta('art_apaga', :'ART', $$delete from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3' returning 'ok'$$);
reset role;
select case when pg_temp.val('art_apaga') = 'ok' and not exists (select 1 from public.equipe_socio where equipe_id = '00000000-0000-0000-0000-0000000070a3') then 'PASSOU' else 'FALHOU' end
  || ' 70: a própria pessoa apaga as respostas | ' || coalesce((select erro from _r where caso = 'art_apaga'), '');
rollback;
