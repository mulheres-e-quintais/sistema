-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 38_fic_encontros.sql. Cenário próprio: professor habilitado, turma, 2 matrículas (a técnica e a bolsista).
\set QUIET on
truncate res;
select id as prof from public.equipe where papel = 'professor_fic' and status = 'ativa' order by criado_em limit 1 \gset
update public.equipe set docs_funcern_em = coalesce(docs_funcern_em, public.fic_hoje()), termo_assinado_em = coalesce(termo_assinado_em, public.fic_hoje()), data_inicio = date '2026-09-01' where id = :'prof';
select logar(email) from public.equipe where id = :'prof' \gset pr_
\set PR '''' :pr_logar ''''
insert into public.turmas_fic (nome, professor_id, inicio) values ('Turma teste encontros', :'prof', date '2026-09-01');
select id as turma from public.turmas_fic where nome = 'Turma teste encontros' \gset
select id as tec from public.equipe where papel = 'coord_tecnico' and status = 'ativa' limit 1 \gset
select id as bol from public.equipe where id = (select id from public.equipe e where e.papel in ('articulacao','apoio') and e.status = 'ativa' and exists (select 1 from auth.users u where u.email = e.email) limit 1) \gset
insert into public.matriculas_fic (turma_id, equipe_id, numero, matriculado_em) select :'turma', x, 'M' || left(x::text, 6), public.fic_hoje() from unnest(array[:'tec'::uuid, :'bol'::uuid]) x
  where not exists (select 1 from public.matriculas_fic m where m.equipe_id = x and m.cancelada_em is null);
update public.matriculas_fic set turma_id = :'turma' where equipe_id in (:'tec', :'bol') and cancelada_em is null;
select logar(email) from public.equipe where id = :'bol' \gset b2_
\set B2 '''' :b2_logar ''''
select id as geral_id from public.equipe where papel = 'coord_geral' and status = 'ativa' limit 1 \gset

select t('anônimo NÃO lê encontros', null, $q$select count(*) from public.fic_encontros$q$, 'permission denied');
select t('anônimo NÃO registra encontro', null, $q$select public.registrar_encontro_fic(null, gen_random_uuid(), public.fic_hoje(), 2, 'presencial', 'Aula sobre quintais', '{}')$q$, 'permission denied');
select t('bolsista NÃO registra encontro', :B2, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'presencial', 'Aula sobre quintais', '{}')$q$, :'turma'), 'professor do FIC');
select t('técnica NÃO registra encontro', :T, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'presencial', 'Aula sobre quintais', '{}')$q$, :'turma'), 'professor do FIC');
select t('ninguém grava direto na tabela', :PR, format($q$insert into public.fic_encontros (turma_id, professor_id, data, carga_horaria, modalidade, conteudo) values (%L, %L, public.fic_hoje(), 2, 'ava', 'Aula direta na tabela')$q$, :'turma', :'prof'), 'permission denied');
select t('data no futuro é recusada', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje() + 3, 2, 'presencial', 'Aula sobre quintais', '{}')$q$, :'turma'), 'futuro');
select t('sem conteúdo é recusado', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'presencial', 'curto', '{}')$q$, :'turma'), 'trabalhado');
select t('carga horária acima de 12 h é recusada', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 20, 'presencial', 'Aula sobre quintais', '{}')$q$, :'turma'), 'carga');
select t('quem não está matriculado não entra na lista', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'presencial', 'Aula sobre quintais', array[%L::uuid])$q$, :'turma', :'geral_id'), 'matriculado');
-- encontro gravado de verdade: bolsista presente, técnica ausente
select f(:PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 3, 'presencial', 'Planejamento do quintal e calendário de plantio', array[%L::uuid])$q$, :'turma', :'bol'));
select id as enc from public.fic_encontros where turma_id = :'turma' limit 1 \gset
select t('lista de presença traz todos os matriculados (presente e ausente)', :G, format($q$do $x$ begin
  if (select count(*) from public.fic_presencas where encontro_id = %L) <> 2 then raise exception 'lista incompleta'; end if;
  if (select presente from public.fic_presencas where encontro_id = %L and equipe_id = %L) is not true then raise exception 'bolsista não presente'; end if;
  if (select presente from public.fic_presencas where encontro_id = %L and equipe_id = %L) is not false then raise exception 'técnica não ausente'; end if; end $x$ $q$, :'enc', :'enc', :'bol', :'enc', :'tec'), 'ok');
select t('bolsista vê o encontro dela', :B2, format($q$do $x$ begin if not exists (select 1 from public.fic_encontros where id = %L) then raise exception 'não viu'; end if; end $x$ $q$, :'enc'), 'ok');
select t('bolsista vê só a própria presença', :B2, $q$do $x$ begin if exists (select 1 from public.fic_presencas where equipe_id <> public.meu_id()) then raise exception 'viu de outra pessoa'; end if; end $x$ $q$, 'ok');
select t('ausente NÃO confirma presença', :T, format($q$select public.confirmar_presenca_fic(%L)$q$, :'enc'), 'Não há presença');
select f(:B2, format($q$select public.confirmar_presenca_fic(%L)$q$, :'enc'));
select t('presente confirma e fica registrado', :G, format($q$do $x$ begin if (select confirmado_em from public.fic_presencas where encontro_id = %L and equipe_id = %L) is null then raise exception 'sem confirmação'; end if; end $x$ $q$, :'enc', :'bol'), 'ok');
select t('confirmar duas vezes é recusado', :B2, format($q$select public.confirmar_presenca_fic(%L)$q$, :'enc'), 'já está confirmada');
select t('professor NÃO desmarca quem já confirmou', :PR, format($q$select public.registrar_encontro_fic(%L, %L, public.fic_hoje(), 3, 'presencial', 'Planejamento do quintal e calendário de plantio', '{}')$q$, :'enc', :'turma'), 'confirmou');
select t('professor corrige a carga horária', :PR, format($q$select public.registrar_encontro_fic(%L, %L, public.fic_hoje(), 4, 'presencial', 'Planejamento do quintal e calendário de plantio', array[%L::uuid])$q$, :'enc', :'turma', :'bol'), 'ok');
select t('ninguém apaga encontro', :G, $q$delete from public.fic_encontros$q$, 'permission denied');
select t('bolsa do professor leva os encontros do mês (gravados pelo banco)', :PR, $q$do $x$ declare s uuid; d jsonb; begin
  s := public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 2200, 'Aulas do curso FIC no mês, com planejamento e acompanhamento das turmas.', null, '{"fic_encontros": "forjado"}');
  select detalhe into d from public.solicitacoes_pagamento where id = s;
  if jsonb_typeof(d->'fic_encontros') <> 'array' or jsonb_array_length(d->'fic_encontros') < 1 then raise exception 'sem encontros: %', d; end if;
  if (d->'fic_encontros'->0->'presencas') is null then raise exception 'sem presenças'; end if; end $x$ $q$, 'ok');
select t('coordenação geral registra no lugar do professor: o encontro fica em nome do professor da turma', :G, format($q$do $x$ declare v uuid; begin
  v := public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'ava', 'Atividade no AVA sobre compostagem', '{}');
  if (select professor_id from public.fic_encontros where id = v) <> %L then raise exception 'ficou em nome da coordenação'; end if; end $x$ $q$, :'turma', :'prof'), 'ok');
-- mês sem encontro: só com justificativa
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em)
  values ('professor_fic', 'Professora Sem Encontro', '95813246746', 'prof.sem.encontro@t.com', date '2026-09-01', true, public.fic_hoje(), public.fic_hoje());
select logar('prof.sem.encontro@t.com') \gset p2_
\set P2 '''' :p2_logar ''''
select t('mês sem encontro e sem justificativa: recusa', :P2, $q$select public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 2200, 'Planejamento das aulas do curso FIC e preparação do material didático.', null, '{}')$q$, 'Nenhum encontro');
select t('mês sem encontro com justificativa curta: recusa', :P2, $q$select public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 2200, 'Planejamento das aulas do curso FIC e preparação do material didático.', null, '{"justificativa_sem_encontro": "férias"}')$q$, 'Nenhum encontro');
select t('mês sem encontro com justificativa: aceita', :P2, $q$select public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 2200, 'Planejamento das aulas do curso FIC e preparação do material didático.', null, '{"justificativa_sem_encontro": "Mês de preparação: montagem do plano de curso e do material do AVA."}')$q$, 'ok');
-- revisão 01/10: dono da turma, turma não muda, matrícula na data, duplicidade, cancelamento, mês fecha ao pedir
insert into public.turmas_fic (nome, professor_id, inicio) select 'Turma da outra professora', id, date '2026-09-01' from public.equipe where email = 'prof.sem.encontro@t.com';
select id as turma2 from public.turmas_fic where nome = 'Turma da outra professora' \gset
select t('professor NÃO registra encontro na turma de outro professor', :P2, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'presencial', 'Aula na turma alheia', '{}')$q$, :'turma'), 'outro(a) professor');
select t('professor NÃO altera encontro de outro professor', :P2, format($q$select public.registrar_encontro_fic(%L, %L, public.fic_hoje(), 11, 'presencial', 'Alterando encontro alheio', array[%L::uuid])$q$, :'enc', :'turma', :'bol'), 'outro(a) professor');
select t('professor NÃO cancela encontro de outro professor', :P2, format($q$select public.cancelar_encontro_fic(%L, 'Cancelando encontro de outra pessoa')$q$, :'enc'), 'outro(a) professor');
select t('a turma de um encontro não muda', :G, format($q$select public.registrar_encontro_fic(%L, %L, public.fic_hoje(), 4, 'presencial', 'Planejamento do quintal e calendário de plantio', array[%L::uuid])$q$, :'enc', :'turma2', :'bol'), 'não muda');
select t('quem se matriculou depois da data do encontro não entra na lista', :PR, format($q$select public.registrar_encontro_fic(null, %L, greatest(date '2026-09-01', public.fic_hoje() - 40), 2, 'presencial', 'Encontro antes da matrícula', array[%L::uuid])$q$, :'turma', :'bol'), 'na data do encontro');
select t('encontro antes da matrícula: lista vazia (ninguém matriculado ainda)', :PR, format($q$do $x$ declare v uuid; begin
  v := public.registrar_encontro_fic(null, %L, greatest(date '2026-09-01', public.fic_hoje() - 40), 2, 'presencial', 'Encontro antes da matrícula', '{}');
  if (select count(*) from public.fic_presencas where encontro_id = v) <> 0 then raise exception 'lista com quem não estava matriculado'; end if; end $x$ $q$, :'turma'), 'ok');
select t('mesmo encontro duas vezes (clique duplo) é recusado', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 3, 'presencial', 'Planejamento do quintal e calendário de plantio', '{}')$q$, :'turma'), 'já está registrado');
select t('carga que arredonda para zero é recusada com mensagem', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 0.04, 'presencial', 'Aula sobre quintais', '{}')$q$, :'turma'), 'carga');
select t('modalidade vazia é recusada', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, null, 'Aula sobre quintais', '{}')$q$, :'turma'), 'Modalidade');
select t('texto acima de 2.000 letras é recusado com mensagem', :PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'ava', repeat('a', 2001), '{}')$q$, :'turma'), '2.000');
select t('bolsa pedida fecha o mês: não inclui encontro', :PR, format($q$do $x$ begin
  perform public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 2200, 'Aulas do curso FIC no mês, com planejamento e acompanhamento das turmas.', null, '{}');
  perform public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'ava', 'Encontro depois do pedido', '{}'); end $x$ $q$, :'turma'), 'já foi pedida');
select t('pessoas logadas NÃO consultam a bolsa dos professores', :B2, format($q$select public.fic_mes_fechado(%L, public.fic_hoje())$q$, :'prof'), 'permission denied');
select t('ninguém altera a presença direto na tabela', :G, format($q$update public.fic_presencas set presente = false where encontro_id = %L and equipe_id = %L$q$, :'enc', :'bol'), 'permission denied');
select f(:PR, format($q$select public.registrar_encontro_fic(null, %L, public.fic_hoje(), 2, 'online', 'Oficina de sementes crioulas lançada por engano', array[%L::uuid])$q$, :'turma', :'tec'));
select id as enc2 from public.fic_encontros where conteudo like 'Oficina de sementes%' \gset
select t('cancelar sem motivo é recusado', :PR, format($q$select public.cancelar_encontro_fic(%L, 'x')$q$, :'enc2'), 'motivo');
select f(:PR, format($q$select public.cancelar_encontro_fic(%L, 'Lançado por engano, duplicado')$q$, :'enc2'));
select t('encontro cancelado não se confirma', :T, format($q$select public.confirmar_presenca_fic(%L)$q$, :'enc2'), 'cancelado');
select t('encontro cancelado não se altera', :PR, format($q$select public.registrar_encontro_fic(%L, %L, public.fic_hoje(), 2, 'online', 'Oficina de sementes crioulas lançada por engano', '{}')$q$, :'enc2', :'turma'), 'cancelado');
select t('encontro cancelado fica fora do relatório da bolsa', :PR, $q$do $x$ declare s uuid; d jsonb; begin
  s := public.solicitar_pagamento('bolsa', date_trunc('month', public.fic_hoje())::date, 2200, 'Aulas do curso FIC no mês, com planejamento e acompanhamento das turmas.', null, '{}');
  select detalhe into d from public.solicitacoes_pagamento where id = s;
  if d::text like '%Oficina de sementes%' then raise exception 'cancelado entrou no relatório'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
