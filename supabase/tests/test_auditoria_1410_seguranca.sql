-- Auditoria de segurança e controle de acesso (14/10/2026).
-- Roda DEPOIS do test_cadastro_equipe.sql, na mesma sessão (usa t(), f(), logar(), res, :G :T :A :BB :X :P).
-- Cada caso diz o comportamento SEGURO esperado: "FALHOU" = achado confirmado (ver SEG-n no comentário).
-- O cenário é montado pelo dono do banco (gatilhos desligados só na montagem); os casos rodam como cada perfil.
\set QUIET on
\pset format unaligned
\pset tuples_only on
truncate res;

-- ===== cenário =====
select logar('apoio.pi@t.com') \gset bp_
\set BP '''' :bp_logar ''''
select logar('ag2@t.com') \gset a2_
\set A2 '''' :a2_logar ''''
select id as ida from public.equipe where email = 'ag1@t.com' and status = 'ativa' \gset
select id as idx from public.equipe where email = 'aux@t.com' and status = 'ativa' \gset
select id as idbb from public.equipe where email = 'art.ba@t.com' and status = 'ativa' \gset
select gen_random_uuid() as fpi, gen_random_uuid() as fba, gen_random_uuid() as v1, gen_random_uuid() as v2, gen_random_uuid() as v3,
       gen_random_uuid() as av, gen_random_uuid() as sp \gset
set session_replication_role = replica;
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua,
  c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, situacao, data_ficha)
values (:'fpi', 'PI', 'Picos', 'Sitio Auditoria', 'Maria Auditoria Piaui', cpf_t(81300000101), '1980-01-01', 'Sitio Auditoria 1', true, true, true, true, true, true, true, true, true, true, 'selecionada', 'aprovada', '2026-09-20'),
       (:'fba', 'BA', 'Laje', 'Sitio Auditoria', 'Joana Auditoria Bahia', cpf_t(81300000202), '1981-01-01', 'Sitio Auditoria 2', true, true, true, true, true, true, true, true, true, true, 'selecionada', 'aprovada', '2026-09-20');
insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato, fotos) values
  (:'v1', :'fpi', 'PI', 'diagnostico', :'ida', '2026-09-21', '2026-09-21', 'realizada', null, '{}'),
  (:'v2', :'fpi', 'PI', 'implantacao', :'ida', '2026-09-28', '2026-09-28', 'realizada', 'Implantação do quintal com canteiros e mudas.', array['PI/' || :'fpi' || '/visita_' || :'v2' || '_1.jpg']),
  (:'v3', :'fpi', 'PI', 'avaliacao', :'ida', '2026-10-05', '2026-10-05', 'realizada', null, '{}');
insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, quintal_produz, ebia_pontos, ebia_nivel, dados)
  values (:'av', :'fpi', :'v3', 'PI', :'ida', '2026-10-05', -7.07, -41.46, 'sim', 2, 'leve', '{"obs":"original"}');
-- diagnóstico APROVADO pela coordenação técnica, com a foto do quintal
insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, agua_seca, lote, dados, fotos, situacao, aprovado_em)
  values (gen_random_uuid(), :'fpi', :'v1', 'PI', :'ida', '2026-09-21', -7.07, -41.46, 'nao', 1, '{}', array['PI/' || :'fpi' || '/diag_frente.jpg'], 'aprovado', now());
-- pedido de ajuda de custo da agente com as visitas 2 e 3, já LANÇADO no Arlo (pago)
insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, situacao)
  values (:'sp', 'ajuda_custo', :'ida', '2026-10-01', 300, 300, 'lancada');
insert into public.solicitacao_visitas (solicitacao_id, visita_id) values (:'sp', :'v2'), (:'sp', :'v3');
-- arquivos no bucket "campo" (o caminho é o que a tela usa: <UF>/<ficha>/...)
insert into storage.objects (bucket_id, name) values
  ('campo', 'PI/' || :'fpi' || '/visita_' || :'v2' || '_1.jpg'),
  ('campo', 'PI/' || :'fpi' || '/diag_frente.jpg'),
  ('termos', 'equipe/' || :'idbb' || '/termo_1.pdf'),
  ('equipe', :'idbb' || '/foto.jpg');
set session_replication_role = origin;
-- no Supabase o papel "authenticated"/"anon" tem os quatro direitos em storage.objects; quem decide são as regras (RLS)
grant usage on schema storage to anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
-- executa um comando como a pessoa logada e diz INSEGURO se ele afetou alguma linha (erro do banco ou 0 linhas = seguro)
create or replace function pg_temp.nada_muda(cmd text) returns void language plpgsql as $$
declare n int := 0;
begin
  begin execute cmd; get diagnostics n = row_count; exception when others then n := 0; end;
  if n > 0 then raise exception 'INSEGURO: o comando alterou % linha(s)', n; end if;
end $$;
grant execute on function pg_temp.nada_muda(text) to authenticated, anon;
\set FOTO_PAGA '''PI/' :fpi '/visita_' :v2 '_1.jpg'''
\set FOTO_DIAG '''PI/' :fpi '/diag_frente.jpg'''

-- controle positivo: o auxiliar acusa quando o comando altera linhas (senão os casos "seguros" não valem nada)
select t('0.1 controle: a verificação acusa alteração permitida (coordenação geral corrige celular da ficha)', :G, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update public.fichas set celular = ''86999990000'' where id = %L', :'fpi')), 'INSEGURO');
select t('0.2 controle: coordenação geral lê o arquivo do campo (as regras do storage estão ativas no cenário)', :G, format($q$do $$ begin if not exists (select 1 from storage.objects where bucket_id = 'campo' and name = %L) then raise exception 'não leu'; end if; end $$$q$, :FOTO_PAGA), 'ok');

-- ===== 1. escalada de privilégio pela tabela equipe (regressão: deve continuar bloqueado) =====
select t('1.1 auxiliar NÃO muda o próprio papel para coord_tecnico', :X, format($q$update public.equipe set papel = 'coord_tecnico' where id = %L$q$, :'idx'), 'não podem ser alterados');
select t('1.2 auxiliar NÃO se habilita sozinho (termo conferido no próprio cadastro)', :X, format($q$update public.equipe set termo_assinado_em = current_date where id = %L$q$, :'idx'), 'coordenação geral');
select t('1.3 auxiliar NÃO troca o e-mail de uma bolsista (tomada de conta)', :X, format($q$update public.equipe set email = 'atacante@t.com' where id = %L$q$, :'idbb'), 'só registra o cadastro no Arlo');
select t('1.4 coord_tecnico NÃO promove agente a coord_tecnico', :T, format($q$select pg_temp.nada_muda(%L)$q$, format('update public.equipe set papel = ''coord_tecnico'', uf = null where id = %L', :'ida')), 'ok');
select t('1.5 coord_tecnico NÃO altera o próprio cadastro (habilitação)', :T, $q$do $$ declare n int; begin update public.equipe set docs_funcern_em = current_date where user_id = auth.uid(); get diagnostics n = row_count; if n > 0 then raise exception 'alterou'; end if; end $$$q$, 'ok');
select t('1.6 agente NÃO altera nenhum cadastro da equipe', :A, $q$do $$ declare n int; begin update public.equipe set telefone = '(84) 90000-0000' where true; get diagnostics n = row_count; if n > 0 then raise exception 'alterou %', n; end if; end $$$q$, 'ok');
select t('1.7 agente NÃO liga o próprio login a outro cadastro', :A, format($q$select pg_temp.nada_muda(%L)$q$, format('update public.equipe set user_id = auth.uid() where id = %L', :'idbb')), 'ok');

-- ===== 2. IDOR / forjar autoria em fichas, visitas e diagnósticos (regressão) =====
select t('2.1 agente NÃO move a própria visita para quintal de outro estado (e não passa a ler a ficha)', :A, format($q$update public.visitas set ficha_id = %L, uf = 'BA' where id = %L$q$, :'fba', :'v1'), 'não mudam');
select t('2.2 bolsista BA NÃO altera ficha do PI (0 linhas)', :BB, format($q$do $$ declare n int; begin update public.fichas set celular = '71999990000' where id = %L; get diagnostics n = row_count; if n > 0 then raise exception 'alterou'; end if; end $$$q$, :'fpi'), 'ok');
select t('2.3 bolsista NÃO cria ficha já aprovada nem forja quem aprovou', :BB, format($q$do $$ declare r public.fichas; begin
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, situacao, aprovada_por, aprovada_em, bolsista_id, data_ficha)
  values (gen_random_uuid(), 'BA', 'Laje', 'Sitio Forjado', 'Ana Forjada da Silva', %L, '1980-01-01', 'Sitio Forjado 1', true, true, true, true, true, true, true, true, true, true, 'selecionada', 'aprovada', %L, now(), %L, '2026-09-20') returning * into r;
  if r.situacao <> 'aguardando' or r.aprovada_por is not null or r.bolsista_id <> %L then raise exception 'forjou: %% %% %%', r.situacao, r.aprovada_por, r.bolsista_id; end if; end $$$q$,
  cpf_t(81300000303), :'ida', :'ida', :'idbb'), 'ok');
select t('2.4 bolsista NÃO lê ficha de outro estado', :BB, format($q$do $$ begin if exists (select 1 from public.fichas where id = %L) then raise exception 'leu'; end if; end $$$q$, :'fpi'), 'ok');
select t('2.5 agente sem visita no quintal NÃO lê a ficha (CPF)', :A2, format($q$do $$ begin if exists (select 1 from public.fichas where id = %L) then raise exception 'leu'; end if; end $$$q$, :'fpi'), 'ok');
select t('2.6 agente NÃO apaga visita (sem DELETE)', :A, format($q$delete from public.visitas where id = %L$q$, :'v1'), 'permission denied');

-- ===== 3. registros pagos: o que a pessoa ainda consegue mudar depois do pagamento =====
select t('3.1 visita paga: agente NÃO muda a data (trava do pagamento)', :A, format($q$update public.visitas set data_realizada = '2026-09-29' where id = %L$q$, :'v2'), 'e');
select t('3.2 avaliação paga: agente NÃO muda a data (cascata para a visita paga)', :A, format($q$update public.avaliacoes set data_visita = '2026-10-06' where id = %L$q$, :'av'), 'solicitação de pagamento');
-- SEG-1: a avaliação final (EBIA = indicador de impacto) segue editável por quem fez a visita depois do pagamento lançado
select t('3.3 [SEG-1] avaliação de visita PAGA: agente NÃO reescreve EBIA e respostas', :A, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update public.avaliacoes set ebia_pontos = 9, ebia_nivel = ''grave'', quintal_produz = ''nao'', dados = ''{"obs":"reescrito"}'' where id = %L', :'av')), 'ok');
-- SEG-2: o relato de visita paga (prova da implantação) é reescrito livremente (só não pode ficar curto)
select t('3.4 [SEG-2] visita PAGA: agente NÃO reescreve o relato', :A, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update public.visitas set relato = ''Texto totalmente diferente do original da visita.'' where id = %L', :'v2')), 'ok');
select t('3.5 visita paga: agente NÃO tira a foto da lista', :A, format($q$update public.visitas set fotos = '{}' where id = %L$q$, :'v2'), 'e');
select t('3.6 coord_tecnico NÃO lança km novo em visita paga', :T, format($q$do $$ begin insert into public.custos_visita (visita_id, km_ida) values (%L, 10); end $$$q$, :'v2'), 'lançado no Arlo');

-- ===== 4. Storage =====
-- SEG-3: quem pode enviar no "campo" também pode SOBRESCREVER/RENOMEAR qualquer arquivo do quintal — inclusive a foto da visita
-- já paga e a foto do diagnóstico aprovado feito por outra pessoa (não há trava de pagamento/aprovação no storage)
select t('4.1 [SEG-3] agente NÃO sobrescreve a foto da visita PAGA (upsert = UPDATE)', :A, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update storage.objects set name = name where bucket_id = ''campo'' and name = %L', :FOTO_PAGA)), 'ok');
select t('4.2 [SEG-3] agente NÃO renomeia a foto paga (a visita passa a apontar para arquivo que não existe)', :A, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update storage.objects set name = %L where bucket_id = ''campo'' and name = %L', 'PI/' || :'fpi' || '/lixo.jpg', :FOTO_PAGA)), 'ok');
select t('4.3 [SEG-3] bolsista do estado NÃO sobrescreve a foto da visita PAGA', :BP, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update storage.objects set name = name where bucket_id = ''campo'' and name = %L', :FOTO_PAGA)), 'ok');
select t('4.3b [SEG-3] agente (com visita no quintal) NÃO sobrescreve a foto do diagnóstico feito/aprovado por outra pessoa', :A, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update storage.objects set name = name where bucket_id = ''campo'' and name = %L', :FOTO_DIAG)), 'ok');
-- SEG-4: a regra da agente no "campo" confere só a pasta da ficha ([2]) e não a do estado ([1])
select t('4.4 [SEG-4] agente NÃO grava arquivo na pasta de OUTRO estado', :A, format($q$insert into storage.objects (bucket_id, name) values ('campo', %L)$q$, 'BA/' || :'fpi' || '/x.jpg'), 'row-level security');
select t('4.5 bolsista BA NÃO lê fotos do campo do PI', :BB, format($q$do $$ begin if exists (select 1 from storage.objects where bucket_id = 'campo' and name = %L) then raise exception 'leu'; end if; end $$$q$, :FOTO_PAGA), 'ok');
select t('4.6 agente sem visita no quintal NÃO lê as fotos', :A2, format($q$do $$ begin if exists (select 1 from storage.objects where bucket_id = 'campo') then raise exception 'leu'; end if; end $$$q$), 'ok');
select t('4.7 agente NÃO lê o termo de outra pessoa', :A, $q$do $$ begin if exists (select 1 from storage.objects where bucket_id = 'termos') then raise exception 'leu'; end if; end $$$q$, 'ok');
select t('4.8 agente NÃO grava termo na pasta de outra pessoa', :A, format($q$insert into storage.objects (bucket_id, name) values ('termos', %L)$q$, 'equipe/' || :'idbb' || '/termo_9.pdf'), 'row-level security');
select t('4.9 agente NÃO grava foto de perfil na pasta de outra pessoa', :A, format($q$insert into storage.objects (bucket_id, name) values ('equipe', %L)$q$, :'idbb' || '/foto2.jpg'), 'row-level security');
select t('4.10 anônimo NÃO lê nada do campo, termos e equipe', null, $q$do $$ begin if exists (select 1 from storage.objects where bucket_id in ('campo','termos','equipe','fichas','documentos','execucao')) then raise exception 'leu'; end if; end $$$q$, 'ok');
select t('4.11 ninguém (nem a coordenação) apaga prova do campo', :G, format($q$do $$ declare n int; begin delete from storage.objects where bucket_id = 'campo' and name = %L; get diagnostics n = row_count; if n > 0 then raise exception 'apagou'; end if; end $$$q$, :FOTO_PAGA), 'ok');

-- ===== 5. auditoria e funções =====
select t('5.1 coordenação geral NÃO apaga o histórico', :G, $q$delete from public.auditoria$q$, 'permission denied');
select t('5.2 coordenação geral NÃO altera o histórico', :G, $q$update public.auditoria set por = null$q$, 'permission denied');
select t('5.3 coordenação geral NÃO grava histórico falso direto', :G, $q$insert into public.auditoria (tabela, acao) values ('equipe', 'UPDATE')$q$, 'permission denied');
select t('5.4 bolsista NÃO vê a conta bancária de colega (Arlo)', :BB, format($q$select public.ver_conta_para_arlo(%L)$q$, :'ida'), 'Só o auxiliar');
select t('5.5 bolsista NÃO consulta pendências de outra pessoa (vem vazio)', :BB, format($q$do $$ begin if public.pendencias_campo(%L) is not null then raise exception 'viu'; end if; end $$$q$, :'ida'), 'ok');
select t('5.6 professor NÃO baixa planilha das fichas', :P, $q$select public.registrar_planilha('completa', 1, null)$q$, 'Só a coordenação');
select t('5.7 foto de perfil: caminho fora da própria pasta é recusado', :A, format($q$select public.definir_minha_foto(%L)$q$, :'idbb' || '/foto.jpg'), 'inválido');
select t('5.8 termo: caminho de outra pessoa é recusado', :A, format($q$select public.enviar_meu_termo(%L)$q$, 'equipe/' || :'idbb' || '/termo_1.pdf'), 'inválido');
select t('5.9 vitrine (anônimo) não traz CPF, nome nem e-mail', null, $q$do $$ declare x text := public.vitrine()::text; begin
  if x ~ '\d{11}' or x ilike '%Auditoria%' or x ~ '@' then raise exception 'dado pessoal na vitrine'; end if; end $$$q$, 'ok');
select t('5.10 entrega do mês: agente NÃO marca presença de OUTRA pessoa', :A, format($q$insert into public.entregas_mes (equipe_id, mes, item) values (%L, '2026-10-01', 'presenca')$q$, :'idbb'), 'row-level security');
select t('5.11 entrega do mês: presença em mês futuro é recusada', :A, format($q$insert into public.entregas_mes (equipe_id, mes, item) values (%L, '2030-01-01', 'presenca')$q$, :'ida'), 'futuro');

-- ===== 6. FIC: turma de outro professor =====
select id as prof0 from public.equipe where email = 'prof0@t.com' and status = 'ativa' \gset
select gen_random_uuid() as tu0 \gset
set session_replication_role = replica;
insert into public.turmas_fic (id, nome, uf, municipio, professor_id, inicio, fim, obs) values (:'tu0', 'Turma Auditoria Prof0', 'PI', 'Picos', :'prof0', '2026-10-01', '2027-03-31', 'original');
set session_replication_role = origin;
select t('6.1 professor NÃO altera nome, estado e datas da turma de OUTRO professor', :P, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update public.turmas_fic set nome = ''Turma Renomeada'', uf = ''BA'', fim = ''2026-10-02'', obs = ''alterada por outro professor'' where id = %L', :'tu0')), 'ok');
select t('6.2 professor NÃO toma a turma de outro professor', :P, format($q$select pg_temp.nada_muda(%L)$q$,
  format('update public.turmas_fic set professor_id = (select id from public.equipe where user_id = auth.uid()) where id = %L', :'tu0')), 'ok');
select t('6.3 professor NÃO registra encontro na turma de outro professor', :P, format($q$select public.registrar_encontro_fic(null, %L, current_date, 2, 'presencial', 'Conteúdo do encontro forjado', '{}')$q$, :'tu0'), 'outro(a) professor(a)');

-- ===== 7. LGPD: dados pessoais (nascimento, NIS, endereço, socioeconômico) de quem a pessoa não gerencia =====
select id as idp from public.equipe where email = 'prof1@t.com' and status = 'ativa' \gset
set session_replication_role = replica;
insert into public.equipe_privado (equipe_id, data_nascimento, nis, endereco, socioeconomico)
  values (:'idp', '1975-05-05', '12345678901', '{"cidade":"Apodi","uf":"RN"}', '{"renda":"x"}') on conflict (equipe_id) do nothing;
set session_replication_role = origin;
-- SEG-5: a regra de leitura dá à coordenação técnica os dados pessoais de TODA a equipe, inclusive professores e auxiliar,
-- que ela não cadastra nem gerencia (pode_gerenciar não vale para eles); só a coordenação geral e o auxiliar (Arlo) precisam
select t('7.1 [SEG-5] coord_tecnico NÃO lê os dados pessoais do professor (não é quem gerencia)', :T, format($q$do $$ begin if exists (select 1 from public.equipe_privado where equipe_id = %L) then raise exception 'leu nascimento/NIS/endereço do professor'; end if; end $$$q$, :'idp'), 'ok');
select t('7.2 agente NÃO lê os dados pessoais do professor', :A, format($q$do $$ begin if exists (select 1 from public.equipe_privado where equipe_id = %L) then raise exception 'leu'; end if; end $$$q$, :'idp'), 'ok');
select t('7.3 auxiliar lê os dados pessoais do professor (cadastro no Arlo)', :X, format($q$do $$ begin if not exists (select 1 from public.equipe_privado where equipe_id = %L) then raise exception 'não leu'; end if; end $$$q$, :'idp'), 'ok');

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 110) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
