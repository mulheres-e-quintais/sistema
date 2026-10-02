-- roda depois do test_auditoria_qa.sql (usa :G, :T, :BB, :X, :PASS, t(), f(), logar(), sp(), mv())
-- e ANTES do test_conferencia_auxiliar.sql (que desliga a coordenação técnica e o auxiliar)
-- 46_regras_decididas.sql: quatro regras decididas pela coordenação geral + pendências da auditoria.
-- Cada regra tem: o que passa a ser recusado, o que continua aceito e o registro ANTIGO (gravado sem os gatilhos,
-- como estava antes da regra) que precisa continuar podendo ser aprovado, devolvido, cancelado e remarcado.
-- Datas sempre relativas a hoje (fuso de Fortaleza): "mes" = dia 1º do mês atual.
\set QUIET on
truncate res;
select set_config('t.bb', :BB, false);

-- troca de pessoa no meio de um caso (quem leu, quem alterou, quem aprova)
create or replace function r46_como(u uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  if u is not null then perform set_config('role', 'authenticated', true); end if;
end $$;
-- ficha mínima (texto do insert): id, CPF, colunas e valores a mais
create or replace function r46_fi(p_n int, p_cpf text, p_cols text default '', p_vals text default '', p_res text default 'selecionada') returns text language sql as $$
  select format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha%s)
    values (('f6100000-0000-0000-0000-0000000001' || lpad(%s::text, 2, '0'))::uuid, 'BA', 'Juazeiro', 'Lagoa das Regras', 'Maria Regra Nova ' || %s, %L, '1980-01-01', 'Sítio novo',
    true,true,true,true,true,true,true,true,true,true, %L, public.fic_hoje()%s)$q$, p_cols, p_n, p_n, p_cpf, p_res, p_vals) $$;

-- ===== cenário (como dono do banco, sem os gatilhos: monta também os registros "antigos") =====
do $x$ declare b public.equipe; tec uuid; hoje date := (now() at time zone 'America/Fortaleza')::date;
  mes date := (now() at time zone 'America/Fortaleza')::date - (extract(day from (now() at time zone 'America/Fortaleza')::date)::int - 1);
  rg uuid := 'f6000000-0000-0000-0000-000000000001'; rg2 uuid := 'f6000000-0000-0000-0000-000000000002';
  rp uuid := 'f6000000-0000-0000-0000-000000000003'; rp2 uuid := 'f6000000-0000-0000-0000-000000000004'; i int; t text;
begin
  select * into b from public.equipe where user_id = current_setting('t.bb')::uuid;
  select id into tec from public.equipe where papel = 'coord_tecnico' and status = 'ativa';
  foreach t in array array['equipe','equipe_privado','fichas','visitas','diagnosticos','avaliacoes','turmas_fic','matriculas_fic','convites','solicitacoes_pagamento','entregas_mes'] loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;
  insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em, municipio) values
    (rg,  'agente', 'BA', 'Rita Agente Regras', '96000000001', 'r46.ag@t.com',  mes - 40, true, mes - 40, mes - 40, mes - 40, 'Juazeiro'),
    (rg2, 'agente', 'BA', 'Rosa Agente Regras', '96000000002', 'r46.ag2@t.com', mes - 40, true, mes - 45, mes - 40, mes - 40, 'Juazeiro');
  insert into public.equipe (id, papel, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em) values
    (rp,  'professor_fic', 'Paulo Professor Regras', '96000000003', 'r46.prof@t.com',  mes - 40, true, mes - 40, mes - 40),
    (rp2, 'professor_fic', 'Paula Professora Regras', '96000000004', 'r46.prof2@t.com', mes - 40, true, mes - 40, mes - 40);
  insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status, data_fim, motivo_desligamento) values
    ('f6000000-0000-0000-0000-000000000005', 'agente', 'BA', 'Zeca Desligado Regras', '96000000005', 'r46.desl@t.com', mes - 40, true, 'desligada', mes - 10, 'Saiu do projeto');
  insert into public.equipe_privado (equipe_id, data_nascimento, nis) values (rg, '1990-01-01', '12345678901');
  -- fichas da BA (data da ficha: 60 dias antes do dia 1º)
  for i in 1..14 loop
    insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
      c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao, bolsista_id, posicao_espera, obs_coordenacao)
    values (('f6100000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'BA', 'Juazeiro', 'Lagoa das Regras', 'Maria Regras ' || i,
      case when i = 12 then '96000000002' else (96100000000 + i)::text end,   -- 12: ficha ANTIGA com o CPF de pessoa ativa da equipe
      '1980-01-01', 'Sítio ' || i, true,true,true,true,true,true,true,true,true,true,
      case when i in (13, 14) then 'lista_espera' else 'selecionada' end, mes - 60,
      case when i in (7, 13, 14) then 'aguardando' when i = 11 then 'devolvida' else 'aprovada' end, b.id,
      case when i in (12, 13, 14) then 3 end,                                 -- ANTIGAS: posição em selecionada (12) e posição repetida (13 e 14)
      case when i = 11 then 'Rever o endereço' end);
  end loop;
  -- visitas: v(ficha, etapa) = f62...-<ficha><n>
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato) values
    ('f6200000-0000-0000-0000-000000000011', 'f6100000-0000-0000-0000-000000000001', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null),
    ('f6200000-0000-0000-0000-000000000021', 'f6100000-0000-0000-0000-000000000002', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null),
    ('f6200000-0000-0000-0000-000000000023', 'f6100000-0000-0000-0000-000000000002', 'BA', 'acompanhamento', rg,  hoje, null, 'prevista', null),          -- ANTIGA: sem implantação
    ('f6200000-0000-0000-0000-000000000031', 'f6100000-0000-0000-0000-000000000003', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null),
    ('f6200000-0000-0000-0000-000000000041', 'f6100000-0000-0000-0000-000000000004', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null),
    ('f6200000-0000-0000-0000-000000000042', 'f6100000-0000-0000-0000-000000000004', 'BA', 'implantacao',    rg,  mes - 5, mes - 5, 'realizada', 'Implantação feita com a família, canteiros prontos.'),
    ('f6200000-0000-0000-0000-000000000043', 'f6100000-0000-0000-0000-000000000004', 'BA', 'acompanhamento', rg,  mes, mes, 'realizada', 'Acompanhamento: horta produzindo, orientação de rega.'),
    ('f6200000-0000-0000-0000-000000000045', 'f6100000-0000-0000-0000-000000000004', 'BA', 'avaliacao',      rg,  hoje, null, 'prevista', null),
    ('f6200000-0000-0000-0000-000000000051', 'f6100000-0000-0000-0000-000000000005', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null),
    ('f6200000-0000-0000-0000-000000000052', 'f6100000-0000-0000-0000-000000000005', 'BA', 'implantacao',    rg,  hoje, null, 'prevista', null),           -- ANTIGA: plano devolvido
    ('f6200000-0000-0000-0000-000000000061', 'f6100000-0000-0000-0000-000000000006', 'BA', 'diagnostico',    rg,  mes - 20, hoje + 30, 'realizada', null), -- ANTIGA: feita com data no futuro
    ('f6200000-0000-0000-0000-000000000063', 'f6100000-0000-0000-0000-000000000006', 'BA', 'acompanhamento', rg,  hoje, hoje + 30, 'prevista', null),     -- ANTIGA: prevista com data de feita no futuro
    ('f6200000-0000-0000-0000-000000000081', 'f6100000-0000-0000-0000-000000000008', 'BA', 'diagnostico',    rg,  hoje, null, 'prevista', null),
    ('f6200000-0000-0000-0000-000000000101', 'f6100000-0000-0000-0000-000000000010', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null),
    ('f6200000-0000-0000-0000-000000000102', 'f6100000-0000-0000-0000-000000000010', 'BA', 'implantacao',    rg,  mes - 5, mes - 5, 'realizada', 'Implantação antiga, feita antes de o plano ser aprovado.'),   -- ANTIGA
    ('f6200000-0000-0000-0000-000000000103', 'f6100000-0000-0000-0000-000000000010', 'BA', 'acompanhamento', rg,  mes, mes, 'realizada', 'Acompanhamento antigo do quintal já implantado.'),
    ('f6200000-0000-0000-0000-000000000111', 'f6100000-0000-0000-0000-000000000011', 'BA', 'diagnostico',    rg,  mes - 20, mes - 20, 'realizada', null);
  insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, agua_seca, sem_agua, lote, latitude, longitude, area_m2, situacao, obs_coordenacao) values
    ('f6300000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 'f6200000-0000-0000-0000-000000000011', 'BA', rg,  mes - 20, 'sim', false, 1, -9.41, -40.5, 300, 'aguardando', null),
    ('f6300000-0000-0000-0000-000000000002', 'f6100000-0000-0000-0000-000000000002', 'f6200000-0000-0000-0000-000000000021', 'BA', rg2, mes - 20, 'sim', false, 1, -9.41, -40.5, 300, 'aprovado', null),
    ('f6300000-0000-0000-0000-000000000003', 'f6100000-0000-0000-0000-000000000003', 'f6200000-0000-0000-0000-000000000031', 'BA', rg,  mes - 20, 'nao', true, null, -9.41, -40.5, 300, 'aprovado', null),
    ('f6300000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000041', 'BA', rg,  mes - 20, 'sim', false, 1, -9.41, -40.5, 300, 'aprovado', null),
    ('f6300000-0000-0000-0000-000000000005', 'f6100000-0000-0000-0000-000000000005', 'f6200000-0000-0000-0000-000000000051', 'BA', rg,  mes - 20, 'sim', false, 1, -9.41, -40.5, 300, 'devolvido', 'Rever o kit'),
    -- ANTIGO: data anterior à ficha, área negativa e GPS (0, 0)
    ('f6300000-0000-0000-0000-000000000010', 'f6100000-0000-0000-0000-000000000010', 'f6200000-0000-0000-0000-000000000101', 'BA', rg,  mes - 90, 'sim', false, 1, 0, 0, -5, 'aguardando', null),
    ('f6300000-0000-0000-0000-000000000011', 'f6100000-0000-0000-0000-000000000011', 'f6200000-0000-0000-0000-000000000111', 'BA', rg,  mes - 20, 'sim', false, 1, -9.41, -40.5, 300, 'aguardando', null);
  -- curso FIC: duas turmas, uma de cada professor; matrícula ANTIGA com data anterior ao início da turma
  insert into public.turmas_fic (id, nome, uf, inicio, professor_id) values
    ('f6500000-0000-0000-0000-000000000001', 'Turma Regras 46', null, mes - 30, rp), ('f6500000-0000-0000-0000-000000000002', 'Turma da Paula 46', null, mes - 30, rp2);
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em) values ('f6700000-0000-0000-0000-000000000002', 'f6500000-0000-0000-0000-000000000001', rg2, 'R46-002', mes - 45);
  -- links de cadastro: um já usado, um ainda aberto
  insert into public.convites (id, token, papel, uf, criado_por, criado_em, expira_em, usado_em) values
    ('f6600000-0000-0000-0000-000000000001', 'r46usado' || md5('a'), 'agente', 'BA', tec, now() - interval '3 days', now() + interval '4 days', now() - interval '1 day'),
    ('f6600000-0000-0000-0000-000000000002', 'r46aberto' || md5('b'), 'agente', 'BA', tec, now() - interval '3 days', now() + interval '4 days', null);
  -- entregas e bolsa antigas da bolsista (3 meses atrás: bolsa lançada; 4 meses atrás: sem bolsa)
  insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, relatorio, situacao, arlo_em)
    values ('f6800000-0000-0000-0000-000000000001', 'bolsa', b.id, (mes - interval '3 months')::date, 700, 700, repeat('Relatório do mês. ', 5), 'lancada', now());
  insert into public.entregas_mes (equipe_id, mes, item) values (b.id, (mes - interval '3 months')::date, 'presenca'), (b.id, (mes - interval '4 months')::date, 'presenca');
  foreach t in array array['equipe','equipe_privado','fichas','visitas','diagnosticos','avaliacoes','turmas_fic','matriculas_fic','convites','solicitacoes_pagamento','entregas_mes'] loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;
end $x$;
select logar('r46.ag@t.com') \gset rg_
\set RG '''' :rg_logar ''''
select logar('r46.prof@t.com') \gset rp_
\set RP '''' :rp_logar ''''
select logar('r46.prof2@t.com') \gset rp2_
\set RP2 '''' :rp2_logar ''''
select (now() at time zone 'America/Fortaleza')::date - (extract(day from (now() at time zone 'America/Fortaleza')::date)::int - 1) as mes \gset
select (:'mes'::date - interval '1 month')::date as m1 \gset
select id as bbid from public.equipe where user_id = :BB \gset
select id as tecid from public.equipe where papel = 'coord_tecnico' and status = 'ativa' \gset
select id as agpi from public.equipe where email = 'ag1@t.com' and status = 'ativa' \gset
\set F ' where id = ''f6100000-0000-0000-0000-0000000000'
\set V ' where id = ''f6200000-0000-0000-0000-000000000'
\set VIS 'insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), ''f6100000-0000-0000-0000-0000000000'
\set RGID '''f6000000-0000-0000-0000-000000000001'''

-- =====================================================================
-- 1. ETAPAS DO CAMPO EXIGEM A ANTERIOR
-- =====================================================================
select t('1. implantação NÃO é agendada com o plano ainda em análise', :BB, :'VIS' || $q$01', 'BA', 'implantacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'O plano deste quintal ainda não foi aprovado pela coordenação técnica.');
select t('1. implantação NÃO é agendada em quintal sem água na seca', :BB, :'VIS' || $q$03', 'BA', 'implantacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'Este quintal está sem água na seca: foi encaminhado a programa de cisternas e não recebe implantação.');
select t('1. a coordenação técnica também não agenda implantação sem plano aprovado', :T, :'VIS' || $q$01', 'BA', 'implantacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'ainda não foi aprovado');
select t('1. implantação é agendada com o plano aprovado', :BB, :'VIS' || $q$02', 'BA', 'implantacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'ok');
select t('1. acompanhamento NÃO é agendado antes da implantação feita', :BB, :'VIS' || $q$01', 'BA', 'acompanhamento', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'O acompanhamento é feito depois da implantação do quintal.');
select t('1. acompanhamento é agendado depois da implantação feita', :BB, :'VIS' || $q$04', 'BA', 'acompanhamento', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'ok');
select t('1. avaliação final continua exigindo a implantação', :BB, :'VIS' || $q$02', 'BA', 'avaliacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'A avaliação é feita depois da implantação');
select t('1. o diagnóstico continua sendo agendado como antes', :BB, :'VIS' || $q$09', 'BA', 'diagnostico', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'ok');
select t('1. segunda implantação do mesmo quintal: mensagem clara (sem erro cru de registro repetido)', :BB, :'VIS' || $q$04', 'BA', 'implantacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 5)$q$, 'já tem essa visita agendada ou feita (implantação)');
-- marcar como feita
select t('1. implantação ANTIGA (plano devolvido) NÃO é marcada como feita', :RG, $q$update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje(), relato = 'Implantação feita: dois canteiros e a caixa instalada.'$q$ || :'V' || $q$052'$q$, 'O plano deste quintal ainda não foi aprovado');
select t('1. acompanhamento ANTIGO (sem implantação) NÃO é marcado como feito', :RG, $q$update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje(), relato = 'Acompanhamento feito: horta produzindo bem.'$q$ || :'V' || $q$023'$q$, 'O acompanhamento é feito depois da implantação');
select t('1. implantação ANTIGA fora da regra continua podendo ser cancelada', :BB, $q$do $x$ declare n int; begin update public.visitas set situacao = 'cancelada', obs = 'aguardando o plano' where id = 'f6200000-0000-0000-0000-000000000052';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não cancelou'; end if; end $x$$q$, 'ok');
select t('1. implantação ANTIGA fora da regra continua podendo ser remarcada (data)', :BB, $q$do $x$ declare n int; begin update public.visitas set data_prevista = public.fic_hoje() + 20 where id = 'f6200000-0000-0000-0000-000000000052';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não remarcou'; end if; end $x$$q$, 'ok');
select t('1. implantação ANTIGA fora da regra continua podendo trocar de pessoa', :BB, $q$do $x$ declare n int; begin update public.visitas set executor_id = 'f6000000-0000-0000-0000-000000000002' where id = 'f6200000-0000-0000-0000-000000000052';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não trocou'; end if; end $x$$q$, 'ok');
select t('1. acompanhamento ANTIGO fora da regra continua podendo ser cancelado e remarcado', :BB, $q$do $x$ begin
  update public.visitas set data_prevista = public.fic_hoje() + 20 where id = 'f6200000-0000-0000-0000-000000000023';
  update public.visitas set situacao = 'cancelada' where id = 'f6200000-0000-0000-0000-000000000023';
  if (select situacao from public.visitas where id = 'f6200000-0000-0000-0000-000000000023') <> 'cancelada' then raise exception 'não cancelou'; end if; end $x$$q$, 'ok');
select t('1. implantação ANTIGA já feita (sem plano aprovado) fica como está: quem fez completa o relato', :RG, $q$do $x$ declare n int; begin
  update public.visitas set relato = relato || ' Mudas de acerola plantadas.', obs = 'voltar em 15 dias' where id = 'f6200000-0000-0000-0000-000000000102';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, 'ok');
select t('1. ... e a coordenação técnica corrige a data dela (depois do diagnóstico)', :T, $q$update public.visitas set data_realizada = data_realizada + 1$q$ || :'V' || $q$102'$q$, 'ok');
select t('1. ... mas a data corrigida não pode ficar antes do diagnóstico', :T, $q$update public.visitas set data_realizada = data_realizada - 30$q$ || :'V' || $q$102'$q$, 'A implantação não pode ter data anterior à do diagnóstico');
-- caminho completo: o plano foi aprovado por outra pessoa e o diagnóstico é de outra agente (quem marca não enxerga o plano)
select t('1. caminho completo: implantação feita com plano aprovado, depois o acompanhamento, com as datas em ordem', :BB, format($q$do $x$ declare m text; begin
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values ('f6200000-0000-0000-0000-000000000022', 'f6100000-0000-0000-0000-000000000002', 'BA', 'implantacao', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje());
  perform r46_como(%L);
  if exists (select 1 from public.diagnosticos where ficha_id = 'f6100000-0000-0000-0000-000000000002') then raise exception 'a agente não deveria enxergar o plano feito por outra pessoa'; end if;
  begin update public.visitas set situacao = 'realizada', data_realizada = %L::date - 21, relato = 'Implantação feita: dois canteiros e a caixa instalada.' where id = 'f6200000-0000-0000-0000-000000000022'; m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like 'A implantação não pode ter data anterior à do diagnóstico (%%' then raise exception 'data anterior ao diagnóstico: %%', m; end if;
  update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje(), relato = 'Implantação feita: dois canteiros e a caixa instalada.' where id = 'f6200000-0000-0000-0000-000000000022';
  begin update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje() - 1, relato = 'Acompanhamento feito: horta produzindo bem.' where id = 'f6200000-0000-0000-0000-000000000023'; m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like 'O acompanhamento não pode ter data anterior à da implantação (%%' then raise exception 'data anterior à implantação: %%', m; end if;
  update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje(), relato = 'Acompanhamento feito: horta produzindo bem.' where id = 'f6200000-0000-0000-0000-000000000023';
  if (select count(*) from public.visitas where ficha_id = 'f6100000-0000-0000-0000-000000000002' and situacao = 'realizada') <> 3 then raise exception 'não ficou feito'; end if; end $x$$q$, :'rg_logar', :'mes'), 'ok');
select t('1. avaliação com data anterior à implantação é recusada; na data certa é aceita; e não pode ser corrigida para antes', :RG, format($q$do $x$ declare m text; begin
  begin insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', %L::date - 10, -9.41, -40.5, 'sim'); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like 'A avaliação não pode ter data anterior à da implantação (%%' then raise exception 'ao registrar: %%', m; end if;
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', public.fic_hoje(), -9.41, -40.5, 'sim');
  if (select situacao from public.visitas where id = 'f6200000-0000-0000-0000-000000000045') <> 'realizada' then raise exception 'a visita não ficou feita'; end if;
  begin update public.avaliacoes set data_visita = %L::date - 10 where id = 'f6400000-0000-0000-0000-000000000004'; m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like 'A avaliação não pode ter data anterior à da implantação (%%' then raise exception 'ao corrigir: %%', m; end if; end $x$$q$, :'mes', :'mes'), 'ok');

-- =====================================================================
-- 24. visita ANTIGA com data de "feita" no futuro volta a ser operável
-- =====================================================================
select t('24. coordenação geral altera a observação de visita ANTIGA feita com data no futuro', :G, $q$do $x$ declare n int; begin update public.visitas set obs = 'data a corrigir' where id = 'f6200000-0000-0000-0000-000000000061';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, 'ok');
select t('24. ... e corrige a data para hoje', :G, $q$update public.visitas set data_realizada = public.fic_hoje()$q$ || :'V' || $q$061'$q$, 'ok');
select t('24. bolsista cancela visita ANTIGA prevista que tinha data de feita no futuro', :BB, $q$do $x$ declare n int; begin update public.visitas set situacao = 'cancelada' where id = 'f6200000-0000-0000-0000-000000000063';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não cancelou'; end if; end $x$$q$, 'ok');
select t('24. ... e remarca', :BB, $q$do $x$ declare n int; begin update public.visitas set data_prevista = public.fic_hoje() + 9 where id = 'f6200000-0000-0000-0000-000000000063';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não remarcou'; end if; end $x$$q$, 'ok');
select t('24. mudar a data de feita para OUTRA data no futuro continua recusado (até para a coordenação geral)', :G, $q$update public.visitas set data_realizada = public.fic_hoje() + 40$q$ || :'V' || $q$063'$q$, 'não pode ser no futuro');
select t('24. gravar visita nova já com data de feita no futuro continua recusado', :BB, $q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada)
  values (gen_random_uuid(), 'f6100000-0000-0000-0000-000000000009', 'BA', 'diagnostico', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje(), public.fic_hoje() + 2)$q$, 'não pode ser no futuro');

-- =====================================================================
-- 2. PEDIDO COMPLEMENTAR DE AJUDA DE CUSTO (e 6: valor × detalhe; 22: mensagens)
-- =====================================================================
create or replace function r46_aj(p_mes date, p_vis text, p_valor text, p_detalhe text default '{}') returns text language sql as $$
  select format($q$select public.solicitar_pagamento('ajuda_custo', %L, %s, null, array[%s]::uuid[], %L)$q$, p_mes,
    p_valor, (select string_agg(quote_literal('f6200000-0000-0000-0000-000000000' || x), ',') from unnest(string_to_array(p_vis, ',')) x), p_detalhe) $$;
select f(:RG, r46_aj(:'m1', '011,031', '300', '{"total": 300}'));
select id as s1 from public.solicitacoes_pagamento where equipe_id = :RGID and tipo = 'ajuda_custo' \gset
select t('2. primeiro pedido do mês não leva o rótulo de complementar', null, format($q$do $x$ begin set local role none;
  if (select detalhe ? 'complementar' from public.solicitacoes_pagamento where id = %L) then raise exception 'veio com rótulo'; end if; end $x$$q$, :'s1'), 'ok');
select t('2. visita que ficou fora entra num pedido complementar do mesmo mês', :RG, format($q$do $x$ declare v uuid; begin
  v := public.solicitar_pagamento('ajuda_custo', %L, 120, null, array['f6200000-0000-0000-0000-000000000041']::uuid[], '{"total": 120, "complementar": false}');
  if v = %L then raise exception 'reaproveitou o pedido anterior'; end if;
  if (select count(*) from public.solicitacoes_pagamento where equipe_id = public.meu_id() and tipo = 'ajuda_custo' and mes = %L) <> 2 then raise exception 'não ficaram 2 pedidos'; end if;
  if (select detalhe ->> 'complementar' from public.solicitacoes_pagamento where id = v) is distinct from 'true' then raise exception 'sem o rótulo de complementar'; end if;
  if (select solicitacao_id from public.solicitacao_visitas where visita_id = 'f6200000-0000-0000-0000-000000000041') <> v then raise exception 'visita no pedido errado'; end if; end $x$$q$, :'m1', :'s1', :'m1'), 'ok');
select t('2. visita que JÁ está em pedido não entra no complementar', :RG, r46_aj(:'m1', '011', '100'), 'já foi solicitada');
select t('2. visita que já está em pedido, junto com uma livre, também é recusada', :RG, r46_aj(:'m1', '041,011', '100'), 'já foi solicitada');
select t('2. visita de outro mês não entra no pedido deste mês', :RG, r46_aj(:'m1', '043', '100'), 'é de outro mês');
select t('2. visita de outra pessoa não entra', :RG, format($q$select public.solicitar_pagamento('ajuda_custo', %L, 100, null, array['e2000000-0000-0000-0000-000000000002']::uuid[], '{}')$q$, :'mes'), 'não é sua');
select t('2. o mês atual também é pedido, com o mês anterior já pedido', :RG, r46_aj(:'mes', '043', '134.10'), 'ok');
select t('22. a mesma visita duas vezes na lista: mensagem clara', :RG, r46_aj(:'m1', '041,041', '100'), 'A mesma visita apareceu duas vezes');
select t('22. tipo de pagamento que não existe: mensagem clara', :RG, $q$select public.solicitar_pagamento('diaria', public.fic_hoje(), 100, null, null, '{}')$q$, 'Tipo de pagamento inválido');
select t('22. pedido sem mês: mensagem clara', :RG, $q$select public.solicitar_pagamento('ajuda_custo', null, 100, null, null, '{}')$q$, 'Informe o mês');
-- 6. valor pedido × total detalhado
select t('6. valor pedido acima do total detalhado é recusado', :RG, r46_aj(:'m1', '041', '999', '{"total": 100, "visitas": [{"total": 100}]}'), 'passa do total das visitas detalhadas (R$ 100,00)');
select t('6. 2 centavos acima do total detalhado é recusado', :RG, r46_aj(:'m1', '041', '100.02', '{"total": 100}'), 'passa do total');
select t('6. 1 centavo de tolerância é aceito', :RG, r46_aj(:'m1', '041', '100.01', '{"total": 100}'), 'ok');
select t('6. valor igual ao total detalhado é aceito', :RG, r46_aj(:'m1', '041,042', '250', '{"total": 250}'), 'ok');
select t('6. valor abaixo do total detalhado é aceito', :RG, r46_aj(:'m1', '041', '80', '{"total": 100}'), 'ok');
select t('6. sem total, vale a soma das visitas detalhadas', :RG, r46_aj(:'m1', '041,042', '150', '{"visitas": [{"total": 60}, {"total": 40}]}'), 'passa do total das visitas detalhadas (R$ 100,00)');
select t('6. total escrito como texto ("100,00") também é conferido', :RG, r46_aj(:'m1', '041', '500', '{"total": "100,00"}'), 'passa do total');
select t('6. sem detalhe, vale só o teto de R$ 2.000,00 por visita', :RG, r46_aj(:'m1', '041', '999'), 'ok');
select t('6. ... e o teto por visita continua valendo', :RG, r46_aj(:'m1', '041', '2000.01'), 'Valor acima do esperado');
-- segundo pedido gravado de verdade (complementar)
select f(:RG, r46_aj(:'m1', '041,042', '250', '{"total": 250}'));
select id as s2 from public.solicitacoes_pagamento where equipe_id = :RGID and tipo = 'ajuda_custo' and id <> :'s1' \gset
select t('2. pedido devolvido volta pelo MESMO registro, com o rótulo que tinha, e a visita solta vai para outro complementar', :T, format($q$do $x$ declare v uuid; begin
  perform public.avalizar_pagamento(%L, false, 'conferir o km das duas visitas', null);
  if exists (select 1 from public.solicitacao_visitas where solicitacao_id = %L) then raise exception 'as visitas não ficaram livres'; end if;
  perform r46_como(%L);
  v := public.solicitar_pagamento('ajuda_custo', %L, 150, null, array['f6200000-0000-0000-0000-000000000011']::uuid[], '{"total": 150}');
  if v <> %L then raise exception 'criou outro registro em vez de reenviar o devolvido'; end if;
  if (select detalhe ? 'complementar' from public.solicitacoes_pagamento where id = v) then raise exception 'o pedido original virou complementar'; end if;
  v := public.solicitar_pagamento('ajuda_custo', %L, 150, null, array['f6200000-0000-0000-0000-000000000031']::uuid[], '{"total": 150}');
  if (select detalhe ->> 'complementar' from public.solicitacoes_pagamento where id = v) is distinct from 'true' then raise exception 'o novo não veio como complementar'; end if;
  if (select count(*) from public.solicitacoes_pagamento where equipe_id = public.meu_id() and tipo = 'ajuda_custo' and mes = %L) <> 3 then raise exception 'não ficaram 3 pedidos'; end if; end $x$$q$,
  :'s1', :'s1', :'rg_logar', :'m1', :'s1', :'m1', :'m1'), 'ok');
select t('2. a BOLSA continua uma por mês por pessoa', :BB, $q$select public.solicitar_pagamento('bolsa', public.fic_hoje(), 700, repeat('Relatório de atividades do mês. ', 3), null, '{}')$q$, 'Você já solicitou este mês');
select t('2. ... também por baixo da função: o banco não aceita duas bolsas da mesma pessoa no mesmo mês', null, format($q$do $x$ begin set local role none;
  insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio) select 'bolsa', equipe_id, mes, 700, relatorio from public.solicitacoes_pagamento where id = 'f6800000-0000-0000-0000-000000000001'; end $x$$q$), 'uma_por_mes');
select t('2. a trava "uma_por_mes" agora é só da bolsa (índice parcial, sem a restrição antiga)', null, $q$do $x$ begin set local role none;
  if exists (select 1 from pg_constraint where conname = 'uma_por_mes') then raise exception 'a restrição antiga continua'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'uma_por_mes' and indexdef ilike '%unique%' and indexdef ilike '%where%bolsa%') then raise exception 'sem o índice parcial'; end if; end $x$$q$, 'ok');
-- aval e lançamento continuam como eram (o complementar segue o mesmo caminho)
select f(:G, format($q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000041', 30)$q$));
select f(:T, format($q$select public.avalizar_pagamento(%L, true, null, 250)$q$, :'s2'));
select t('2. pedido complementar com aval é lançado no Arlo pelo auxiliar', :X, format($q$select public.registrar_no_arlo(%L, 'ARLO-46')$q$, :'s2'), 'ok');
select f(:X, format($q$select public.registrar_no_arlo(%L, 'ARLO-46')$q$, :'s2'));

-- =====================================================================
-- 7. custos da visita já paga (e 22: mensagens)
-- =====================================================================
\set KM ' where visita_id = ''f6200000-0000-0000-0000-000000000041'''
select t('7. km de visita em pedido lançado no Arlo NÃO muda (coordenação geral)', :G, $q$update public.custos_visita set km_ida = 5$q$ || :'KM', 'já está num pedido lançado no Arlo');
select t('7. ... nem pela coordenação técnica', :T, $q$update public.custos_visita set km_ida = 80$q$ || :'KM', 'já está num pedido lançado no Arlo');
select t('7. ... nem pelo caminho da tela (gravar por cima)', :G, $q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000041', 12) on conflict (visita_id) do update set km_ida = excluded.km_ida$q$, 'já está num pedido lançado no Arlo');
select t('7. ninguém apaga o km de visita já paga', :G, $q$delete from public.custos_visita$q$ || :'KM', 'já foi paga');
select t('7. km NOVO em visita já paga (que não tinha km) também é recusado', :T, $q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000042', 10)$q$, 'já está num pedido lançado no Arlo');
select t('7. regravar o MESMO km de visita já paga não trava (a tela salva de novo)', :G, $q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000041', 30) on conflict (visita_id) do update set km_ida = excluded.km_ida$q$, 'ok');
select t('7. a observação do km de visita já paga continua editável', :G, $q$do $x$ declare n int; begin update public.custos_visita set obs = 'conferido no mapa' where visita_id = 'f6200000-0000-0000-0000-000000000041';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, 'ok');
select t('7. visita NÃO paga: a coordenação continua gravando, mudando e apagando o km', :T, $q$do $x$ declare n int; begin
  insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000043', 22);
  update public.custos_visita set km_ida = 25 where visita_id = 'f6200000-0000-0000-0000-000000000043';
  delete from public.custos_visita where visita_id = 'f6200000-0000-0000-0000-000000000043'; get diagnostics n = row_count; if n <> 1 then raise exception 'não apagou'; end if; end $x$$q$, 'ok');
select t('7. visita em pedido só solicitado (ainda sem lançar): o km ainda muda', :T, $q$do $x$ begin
  insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000011', 22);
  update public.custos_visita set km_ida = 28 where visita_id = 'f6200000-0000-0000-0000-000000000011'; end $x$$q$, 'ok');
select t('22. km negativo: mensagem clara', :G, $q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000043', -1)$q$, 'Distância inválida: informe de 0 a 999 km');
select t('22. km de 1000: mensagem clara', :G, $q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000043', 1000)$q$, 'Distância inválida');
select t('22. km de visita que não existe: mensagem clara', :G, $q$insert into public.custos_visita (visita_id, km_ida) values (gen_random_uuid(), 10)$q$, 'Visita não encontrada');
select t('7. bolsista continua sem alterar km', :BB, $q$insert into public.custos_visita (visita_id, km_ida) values ('f6200000-0000-0000-0000-000000000043', 10)$q$, 'Só a coordenação altera');

-- =====================================================================
-- 8. parâmetros do custo da visita
-- =====================================================================
\set PU 'update public.parametros set valor = valor || '
\set PW ' where chave = ''custo_visita'''
select t('8. valor da hora negativo é recusado', :G, :'PU' || $q$'{"valor_hora": -50}'$q$ || :'PW', 'O valor da hora não pode ser negativo');
select t('8. refeição negativa é recusada', :G, :'PU' || $q$'{"refeicao": -1}'$q$ || :'PW', 'O valor da refeição não pode ser negativo');
select t('8. km por litro = 0 é recusado (divisão por zero na conta)', :G, :'PU' || $q$'{"km_por_litro": 0}'$q$ || :'PW', 'precisa ser maior que zero');
select t('8. preço do litro = 0 é recusado', :T, :'PU' || $q$'{"preco_litro": 0}'$q$ || :'PW', 'precisa ser maior que zero');
select t('8. fator estrada menor que 1 é recusado', :G, :'PU' || $q$'{"fator_estrada": 0.5}'$q$ || :'PW', 'O fator estrada precisa ser 1 ou mais');
select t('8. teto negativo é recusado', :G, :'PU' || $q$'{"teto": -1}'$q$ || :'PW', 'não pode ser negativo');
select t('8. horas por etapa acima de 24 são recusadas', :G, :'PU' || $q$'{"horas": {"diagnostico": 30}}'$q$ || :'PW', 'entre 0 e 24');
select t('8. horas por etapa negativas são recusadas', :G, :'PU' || $q$'{"horas": {"diagnostico": -1}}'$q$ || :'PW', 'entre 0 e 24');
select t('8. número escrito como texto é recusado', :G, :'PU' || $q$'{"valor_hora": "50"}'$q$ || :'PW', 'precisa ser um número');
select t('8. campo vazio (nulo) é recusado', :G, :'PU' || $q$'{"km_por_litro": null}'$q$ || :'PW', 'precisa ser um número');
select t('8. texto solto no lugar dos valores é recusado', :T, $q$update public.parametros set valor = '"qualquer coisa"'$q$ || :'PW', 'formato que o sistema não entende');
select t('8. lista no lugar dos valores é recusada', :T, $q$update public.parametros set valor = '[1, 2]'$q$ || :'PW', 'formato que o sistema não entende');
select t('8. valores certos continuam sendo salvos (como a tela manda)', :T, $q$insert into public.parametros (chave, valor) values ('custo_visita',
  '{"valor_hora": 55, "refeicao": 0, "km_por_litro": 11.5, "preco_litro": 6.59, "fator_estrada": 1, "teto": 0, "horas": {"diagnostico": 3, "implantacao": 2, "acompanhamento": 0, "avaliacao": 24}}')
  on conflict (chave) do update set valor = excluded.valor$q$, 'ok');
select t('8. parâmetro ANTIGO com valor impossível não trava outra alteração nem a correção', null, format($q$do $x$ begin set local role none;
  alter table public.parametros disable trigger user;
  update public.parametros set valor = valor || '{"km_por_litro": 0, "valor_hora": "cinquenta"}' where chave = 'custo_visita';
  alter table public.parametros enable trigger user;
  perform r46_como(%L);
  update public.parametros set atualizado_em = now() where chave = 'custo_visita';                                            -- regravar sem mudar os valores
  update public.parametros set valor = valor || '{"km_por_litro": 10, "valor_hora": 50}' where chave = 'custo_visita';      -- corrigir
  if (select (valor ->> 'km_por_litro')::numeric from public.parametros where chave = 'custo_visita') <> 10 then raise exception 'não corrigiu'; end if; end $x$$q$, :'g_logar'), 'ok');
select t('8. outras chaves de parâmetro não são afetadas', :G, $q$insert into public.parametros (chave, valor) values ('r46_outra', '"texto livre"')$q$, 'ok');

-- =====================================================================
-- 16. entrega do mês × bolsa lançada (e 22: mensagens)
-- =====================================================================
select t('16. entrega do mês NÃO é desmarcada depois da bolsa lançada no Arlo', :BB, format($q$delete from public.entregas_mes where equipe_id = public.meu_id() and mes = (%L::date - interval '3 months')::date$q$, :'mes'), 'já foi lançada no Arlo: a entrega deste mês não pode mais ser desmarcada');
select t('16. entrega de mês sem bolsa lançada continua podendo ser desmarcada', :BB, format($q$do $x$ declare n int; begin
  delete from public.entregas_mes where equipe_id = public.meu_id() and mes = (%L::date - interval '4 months')::date; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não desmarcou (%% linhas)', n; end if; end $x$$q$, :'mes'), 'ok');
select t('16. entrega do mês atual (bolsa só solicitada) é marcada e desmarcada', :BB, format($q$do $x$ declare n int; begin
  delete from public.entregas_mes where equipe_id = public.meu_id() and mes = %L;
  insert into public.entregas_mes (equipe_id, mes, item) values (public.meu_id(), %L, 'presenca');
  delete from public.entregas_mes where equipe_id = public.meu_id() and mes = %L; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não desmarcou'; end if; end $x$$q$, :'mes', :'mes', :'mes'), 'ok');
select t('22. entrega com dia diferente de 1: mensagem clara', :BB, format($q$insert into public.entregas_mes (equipe_id, mes, item) values (public.meu_id(), %L::date + 14, 'presenca')$q$, :'mes'), 'dia 1º do mês');
select t('22. entrega marcada duas vezes: mensagem clara, com o mesmo código de "já existe" que a tela espera', :BB, format($q$do $x$ declare c text; m text; begin
  delete from public.entregas_mes where equipe_id = public.meu_id() and mes = %L;
  insert into public.entregas_mes (equipe_id, mes, item) values (public.meu_id(), %L, 'presenca');
  begin insert into public.entregas_mes (equipe_id, mes, item) values (public.meu_id(), %L, 'presenca'); m := 'aceitou';
  exception when others then get stacked diagnostics c = returned_sqlstate, m = message_text; end;
  if c is distinct from '23505' or m <> 'Esta entrega do mês já estava marcada.' then raise exception 'veio %% / %%', c, m; end if; end $x$$q$, :'mes', :'mes', :'mes'), 'ok');

-- =====================================================================
-- 3. PASSAGENS: teto por finalidade e quem confere (e 17: valores e passageiras; 22: mensagens)
-- =====================================================================
select (:'PASS'::jsonb || '{"finalidade": "pedagogico"}')::text as ped \gset
select (:'PASS'::jsonb - 'finalidade')::text as semfin \gset
select t('3. passagem NOVA sem finalidade é recusada', :BB, sp('', null, 'passagem', 50, :'semfin'), 'Escolha para que é a passagem: intercâmbio ou acompanhamento pedagógico');
select t('3. passagem com finalidade que não existe é recusada', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"finalidade": "turismo"}')::text), 'Escolha para que é a passagem');
select t('3. passagem de intercâmbio é aceita', :BB, sp('', null, 'passagem', 50, :'PASS'), 'ok');
select t('3. passagem de acompanhamento pedagógico é aceita', :BB, sp('', null, 'passagem', 50, :'ped'), 'ok');
select t('3. evento não tem finalidade e continua aceito', :BB, sp('', null, 'evento', 60, '{"local": "Sede"}'), 'ok');
create temp table pid46(k text, id uuid); grant all on pid46 to authenticated;
select f(:BB, format('insert into pid46 select %L, (%s)', 'ped', sp('', null, 'passagem', 50, :'ped')));
select f(:BB, format('insert into pid46 select %L, (%s)', 'int', sp('', null, 'passagem', 50, :'PASS')));
\set PED '(select id from pid46 where k=''ped'')'
\set INT '(select id from pid46 where k=''int'')'
select t('3. pedagógico: a coordenação técnica NÃO confere', :T, mv(:'PED', 'conferir'), 'Pedido de acompanhamento pedagógico: só a coordenação geral confere.');
select t('3. pedagógico: a coordenação técnica NÃO devolve', :T, mv(:'PED', 'devolver', 'faltou o documento'), 'Pedido de acompanhamento pedagógico: só a coordenação geral confere.');
select t('3. pedagógico: o auxiliar administrativo NÃO confere', :X, mv(:'PED', 'conferir'), 'Pedido de acompanhamento pedagógico: só a coordenação geral confere.');
select t('3. pedagógico: quem pediu continua cancelando o próprio pedido', :BB, mv(:'PED', 'cancelar'), 'ok');
select t('3. pedagógico: a coordenação geral devolve', :G, mv(:'PED', 'devolver', 'faltou o documento'), 'ok');
select t('3. pedagógico: a coordenação geral confere', :G, mv(:'PED', 'conferir'), 'ok');
select t('3. intercâmbio: continua com a coordenação técnica', :T, mv(:'INT', 'conferir'), 'ok');
select t('3. intercâmbio: com a técnica ativa, a geral não confere (sempre duas pessoas)', :G, mv(:'INT', 'conferir'), 'Quem confere agora é a coordenação técnica');
select f(:G, mv(:'PED', 'conferir'));
select f(:T, mv(:'INT', 'conferir'));
select t('3. pedagógico: a técnica não autoriza', :T, mv(:'PED', 'autorizar'), 'Quem autoriza e manda para a FUNCERN é a coordenação geral');
select t('3. intercâmbio: quem autoriza continua sendo só a coordenação geral', :T, mv(:'INT', 'autorizar'), 'Quem autoriza e manda para a FUNCERN é a coordenação geral');
select t('3. saldo traz os dois tetos, com os nomes antigos valendo para o intercâmbio', :BB, $q$do $x$ declare s jsonb := public.saldo_passagens_eventos(); begin
  if (s ->> 'passagem_teto')::numeric <> 70000 or (s ->> 'passagem_pedagogico_teto')::numeric <> 22400 or (s ->> 'evento_teto')::numeric <> 6000 then raise exception 'tetos: %', s; end if;
  if not (s ? 'passagem_usado' and s ? 'passagem_saldo' and s ? 'passagem_pedagogico_usado' and s ? 'passagem_pedagogico_saldo' and s ? 'evento_usado') then raise exception 'faltam chaves: %', s; end if;
  if (s ->> 'passagem_pedagogico_usado')::numeric <> 0 or (s ->> 'passagem_pedagogico_saldo')::numeric <> 22400 then raise exception 'pedagógico começou usado: %', s; end if; end $x$$q$, 'ok');
select t('3. tetos separados: o pedagógico vai até R$ 22.400,00 (a geral confere e autoriza) e não mexe no saldo do intercâmbio', :G, format($q$do $x$ declare a jsonb := public.saldo_passagens_eventos(); d jsonb; m text; begin
  perform public.definir_valor_pedido(%s, 22400.01);
  begin perform public.mover_pedido_apoio(%s, 'autorizar', null, 'PROT-46'); m := 'autorizou';
  exception when others then m := sqlerrm; end;
  if m <> 'Passa do teto de passagens de acompanhamento pedagógico (R$ 22.400,00): já autorizado R$ 0,00, saldo R$ 22.400,00.' then raise exception 'acima do teto: %%', m; end if;
  perform public.definir_valor_pedido(%s, 22400);
  perform public.mover_pedido_apoio(%s, 'autorizar', null, 'PROT-46');
  d := public.saldo_passagens_eventos();
  if (d ->> 'passagem_pedagogico_usado')::numeric <> 22400 or (d ->> 'passagem_pedagogico_saldo')::numeric <> 0 then raise exception 'saldo pedagógico: %%', d; end if;
  if d ->> 'passagem_usado' <> a ->> 'passagem_usado' or d -> 'evento_usado' <> a -> 'evento_usado' then raise exception 'mexeu no intercâmbio ou nos eventos: %% / %%', a, d; end if; end $x$$q$, :'PED', :'PED', :'PED', :'PED'), 'ok');
select t('3. tetos separados: o intercâmbio vai até R$ 70.000,00 e não mexe no saldo do pedagógico', :G, format($q$do $x$ declare a jsonb := public.saldo_passagens_eventos(); d jsonb; m text; livre numeric; begin
  livre := 70000 - (a ->> 'passagem_usado')::numeric;
  if livre < 1 then raise exception 'cenário sem saldo de intercâmbio'; end if;
  perform public.definir_valor_pedido(%s, livre + 0.01);
  begin perform public.mover_pedido_apoio(%s, 'autorizar', null, 'PROT-46'); m := 'autorizou';
  exception when others then m := sqlerrm; end;
  if m not like 'Passa do teto de passagens de intercâmbio (R$ 70.000,00): já autorizado R$ %%' then raise exception 'acima do teto: %%', m; end if;
  perform public.definir_valor_pedido(%s, livre);
  perform public.mover_pedido_apoio(%s, 'autorizar', null, 'PROT-46');
  d := public.saldo_passagens_eventos();
  if (d ->> 'passagem_usado')::numeric <> 70000 or (d ->> 'passagem_saldo')::numeric <> 0 then raise exception 'saldo intercâmbio: %%', d; end if;
  if d ->> 'passagem_pedagogico_usado' <> a ->> 'passagem_pedagogico_usado' then raise exception 'mexeu no pedagógico: %%', d; end if; end $x$$q$, :'INT', :'INT', :'INT', :'INT'), 'ok');
-- passagem ANTIGA, sem finalidade (gravada sem os gatilhos)
create or replace function r46_antiga(p_sit text) returns text language sql as $$
  select format($q$set local role none; alter table public.pedidos_apoio disable trigger user;
  insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, conferido_por, conferido_em)
    select 'f6900000-0000-0000-0000-000000000001', 'passagem', e.uf, e.id, 'Passagem antiga sem finalidade', public.fic_hoje() + 60,
           '{"valor_estimado": 500, "origem": "Salvador/BA", "destino": "Natal/RN", "passageiros": [{"nome": "Maria Passageira Um", "cpf": "52998224725", "rg": "1", "nascimento": "1970-01-01"}]}',
           %L, case when %L = 'conferido' then (select id from public.equipe where papel = 'coord_tecnico' and status = 'ativa') end, case when %L = 'conferido' then now() end
      from public.equipe e where e.user_id = current_setting('t.bb')::uuid;
  alter table public.pedidos_apoio enable trigger user;$q$, p_sit, p_sit, p_sit) $$;
select t('3. passagem ANTIGA sem finalidade conta no teto do intercâmbio e continua podendo ser autorizada', null, format($q$do $x$ declare a jsonb; d jsonb; begin %s
  perform r46_como(%L);
  a := public.saldo_passagens_eventos();
  perform public.mover_pedido_apoio('f6900000-0000-0000-0000-000000000001', 'autorizar', null, 'PROT-46');
  d := public.saldo_passagens_eventos();
  if (d ->> 'passagem_usado')::numeric <> (a ->> 'passagem_usado')::numeric + 500 then raise exception 'não contou no intercâmbio: %% / %%', a, d; end if;
  if d ->> 'passagem_pedagogico_usado' <> a ->> 'passagem_pedagogico_usado' then raise exception 'contou no pedagógico'; end if; end $x$$q$, r46_antiga('conferido'), :'g_logar'), 'ok');
select t('3. passagem ANTIGA sem finalidade continua podendo ser conferida pela técnica', null, format($q$do $x$ begin %s
  perform r46_como(%L); perform public.mover_pedido_apoio('f6900000-0000-0000-0000-000000000001', 'conferir', null, null);
  if (select situacao from public.pedidos_apoio where id = 'f6900000-0000-0000-0000-000000000001') <> 'conferido' then raise exception 'não conferiu'; end if; end $x$$q$, r46_antiga('enviado'), :'t_logar'), 'ok');
select t('3. passagem ANTIGA sem finalidade continua podendo ser devolvida, corrigida (ainda sem finalidade) e cancelada', null, format($q$do $x$ begin %s
  perform r46_como(%L); perform public.mover_pedido_apoio('f6900000-0000-0000-0000-000000000001', 'devolver', 'faltou o RG da passageira', null);
  perform r46_como(%L);
  perform public.salvar_pedido_apoio('f6900000-0000-0000-0000-000000000001', 'passagem', 'Passagem antiga corrigida', public.fic_hoje() + 60,
    '{"valor_estimado": 600, "origem": "Salvador/BA", "destino": "Natal/RN", "passageiros": [{"nome": "Maria Passageira Um", "cpf": "52998224725", "rg": "123", "nascimento": "1970-01-01"}]}', null);
  if (select situacao from public.pedidos_apoio where id = 'f6900000-0000-0000-0000-000000000001') <> 'enviado' then raise exception 'não reenviou'; end if;
  perform public.mover_pedido_apoio('f6900000-0000-0000-0000-000000000001', 'cancelar', null, null); end $x$$q$, r46_antiga('enviado'), :'t_logar', :'bb_logar'), 'ok');
select t('3. passagem ANTIGA sem finalidade continua podendo ser recusada pela geral', null, format($q$do $x$ begin %s
  perform r46_como(%L); perform public.mover_pedido_apoio('f6900000-0000-0000-0000-000000000001', 'recusar', 'fora do plano de trabalho', null); end $x$$q$, r46_antiga('conferido'), :'g_logar'), 'ok');
-- 17. valores e passageiras
select t('17. evento com valor estimado de 1e12 é recusado já no envio', :BB, sp('', null, 'evento', 60, '{"local": "Sede", "valor_estimado": 1e12}'), 'O valor estimado precisa ficar entre R$ 0,01 e R$ 1.000.000,00');
select t('17. evento com valor estimado de R$ 0,001 é recusado', :BB, sp('', null, 'evento', 60, '{"local": "Sede", "valor_estimado": 0.001}'), 'O valor estimado precisa ficar entre R$ 0,01 e R$ 1.000.000,00');
select t('17. valor estimado zero continua com a mensagem de sempre', :BB, sp('', null, 'evento', 60, '{"local": "Sede", "valor_estimado": 0}'), 'Informe o valor estimado do pedido');
select t('17. valor estimado que não é número continua com a mensagem de sempre', :BB, sp('', null, 'evento', 60, '{"local": "Sede", "valor_estimado": "mil"}'), 'Informe o valor estimado do pedido');
select t('17. valor estimado de R$ 1.000.000,00 (o máximo) é aceito no envio', :BB, sp('', null, 'evento', 60, '{"local": "Sede", "valor_estimado": 1000000}'), 'ok');
select t('17. valor estimado de R$ 0,01 (o mínimo) é aceito no envio', :BB, sp('', null, 'evento', 60, '{"local": "Sede", "valor_estimado": 0.01}'), 'ok');
select t('17. definir valor de R$ 0,004 (viraria R$ 0,00): mensagem clara', :G, format('select public.definir_valor_pedido(%s, 0.004)', :'INT'), 'Informe um valor maior que zero (pelo menos R$ 0,01)');
select t('17. definir valor de 1e12: mensagem clara (sem erro cru de número grande)', :G, format('select public.definir_valor_pedido(%s, 1e12)', :'INT'), 'Valor acima do esperado (R$ 1.000.000.000.000,00; o máximo é R$ 1.000.000,00)');
select t('17. definir valor dentro do esperado continua aceito', :G, format('select public.definir_valor_pedido(%s, 1234.56)', :'INT'), 'ok');
select t('17. passageira com nascimento que não existe (30/02) é recusada', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"passageiros": [{"nome": "Maria Passageira Um", "cpf": "52998224725", "rg": "1", "nascimento": "1980-02-30"}]}')::text), 'A data de nascimento de Maria Passageira Um não é uma data que existe');
select t('17. passageira com nascimento no futuro é recusada', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"passageiros": [{"nome": "Maria Passageira Um", "cpf": "52998224725", "rg": "1", "nascimento": "2090-01-01"}]}')::text), 'está no futuro');
select t('17. a mesma passageira (CPF) duas vezes no pedido é recusada, com ou sem pontos', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"passageiros": [{"nome": "Maria Passageira Um", "cpf": "52998224725", "rg": "1", "nascimento": "1980-01-01"}, {"nome": "Maria Passageira Um", "cpf": "529.982.247-25", "rg": "1", "nascimento": "1980-01-01"}]}')::text), 'aparece duas vezes na lista de passageiras');
select t('17. duas passageiras diferentes continuam aceitas', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"passageiros": [{"nome": "Maria Passageira Um", "cpf": "52998224725", "rg": "1", "nascimento": "1980-01-01"}, {"nome": "Joana Passageira Dois", "cpf": "15350946056", "rg": "2", "nascimento": "1985-05-05"}]}')::text), 'ok');
select t('22. passagem com volta que não é data: mensagem clara', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"volta": "amanha"}')::text), 'A data da volta não é uma data que existe');
select t('22. passagem com volta em 29/02/2027 (não existe): mensagem clara', :BB, sp('', null, 'passagem', 50, (:'PASS'::jsonb || '{"volta": "2027-02-29"}')::text), 'A data da volta não é uma data que existe');

-- =====================================================================
-- 5, 15 e 19. CURSO FIC
-- =====================================================================
\set TA '''f6500000-0000-0000-0000-000000000001'''
\set RPID '''f6000000-0000-0000-0000-000000000003'''
\set RP2ID '''f6000000-0000-0000-0000-000000000004'''
select t('5. professor NÃO toma a turma de outro (a alteração não acha a turma) nem registra encontro nela', :RP2, $q$do $x$ declare n int; m text; begin
  update public.turmas_fic set professor_id = public.meu_id() where id = 'f6500000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'tomou a turma'; end if;
  update public.turmas_fic set nome = 'Turma tomada' where id = 'f6500000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'alterou a turma de outro'; end if;
  begin perform public.registrar_encontro_fic(null, 'f6500000-0000-0000-0000-000000000001', public.fic_hoje(), 2, 'presencial', 'Aula na turma de outro professor', '{}'); m := 'registrou';
  exception when others then m := sqlerrm; end;
  if m not like 'Esta turma é de outro(a) professor(a)%' then raise exception 'encontro: %', m; end if; end $x$$q$, 'ok');
select t('5. ... e a turma continua com o professor de antes', null, $q$do $x$ begin set local role none;
  if (select professor_id from public.turmas_fic where id = 'f6500000-0000-0000-0000-000000000001') <> 'f6000000-0000-0000-0000-000000000003' then raise exception 'mudou'; end if; end $x$$q$, 'ok');
select t('5. pelo caminho da tela (tenta incluir quando não consegue alterar): mensagem clara', :RP2, $q$insert into public.turmas_fic (id, nome, professor_id) values ('f6500000-0000-0000-0000-000000000001', 'Turma tomada', public.meu_id())$q$, 'Esta turma é de outro(a) professor(a)');
select t('5. professor NÃO cria turma no nome de outro professor', :RP2, format($q$insert into public.turmas_fic (nome, professor_id) values ('Turma no nome do colega', %s)$q$, :'RPID'), 'Você cria turmas só no seu nome');
select t('5. professor continua criando a própria turma', :RP2, $q$insert into public.turmas_fic (nome, professor_id, inicio) values ('Turma nova da Paula', public.meu_id(), public.fic_hoje())$q$, 'ok');
select t('5. professor continua alterando a PRÓPRIA turma', :RP, $q$do $x$ declare n int; begin
  update public.turmas_fic set obs = 'sala 3', municipio = 'Juazeiro', fim = public.fic_hoje() + 90 where id = 'f6500000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não alterou'; end if; end $x$$q$, 'ok');
select t('5. professor NÃO passa a própria turma para outro: só a coordenação geral', :RP, format($q$update public.turmas_fic set professor_id = %s where id = %s$q$, :'RP2ID', :'TA'), 'Só a coordenação geral passa a turma para outro(a) professor(a)');
select t('5. coordenação geral continua passando a turma para outro professor (desligamento do 41)', :G, format($q$do $x$ declare n int; begin
  update public.turmas_fic set professor_id = %s where id = %s; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não passou'; end if; end $x$$q$, :'RP2ID', :'TA'), 'ok');
select t('5. coordenação técnica continua sem alterar turmas', :T, format($q$do $x$ declare n int; begin update public.turmas_fic set obs = 'x' where id = %s; get diagnostics n = row_count;
  if n <> 0 then raise exception 'alterou'; end if; end $x$$q$, :'TA'), 'ok');
select t('5. professor continua matriculando na turma do colega (regra do 15)', :RP2, format($q$select public.matricular_fic(%s, %s, 'R46-001', %L)$q$, :'TA', :'RGID', :'mes'), 'ok');
-- 15
select t('15. turma repetida (mesmo nome, estado, professor e início) é recusada', :RP, format($q$insert into public.turmas_fic (nome, professor_id, inicio) values ('turma  regras 46 ', public.meu_id(), %L::date - 30)$q$, :'mes'), 'Já existe uma turma com este nome, estado, professor(a) e data de início');
select t('15. mesmo nome com outro início é aceito', :RP, format($q$insert into public.turmas_fic (nome, professor_id, inicio) values ('Turma Regras 46', public.meu_id(), %L::date)$q$, :'mes'), 'ok');
select t('15. mesmo nome em outro estado é aceito', :RP, format($q$insert into public.turmas_fic (nome, uf, professor_id, inicio) values ('Turma Regras 46', 'BA', public.meu_id(), %L::date - 30)$q$, :'mes'), 'ok');
select t('15. turma com fim antes do início: mensagem clara', :RP, $q$insert into public.turmas_fic (nome, professor_id, inicio, fim) values ('Turma datas trocadas', public.meu_id(), public.fic_hoje(), public.fic_hoje() - 5)$q$, 'O fim da turma não pode ser antes do início');
select t('15. turma ANTIGA repetida continua editável', null, format($q$do $x$ declare n int; begin set local role none;
  alter table public.turmas_fic disable trigger user;
  insert into public.turmas_fic (id, nome, inicio, professor_id) values ('f6500000-0000-0000-0000-000000000009', 'Turma Regras 46', %L::date - 30, %s);
  alter table public.turmas_fic enable trigger user;
  perform r46_como(%L);
  update public.turmas_fic set obs = 'turma repetida de antes da regra' where id = 'f6500000-0000-0000-0000-000000000009'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não alterou'; end if; end $x$$q$, :'mes', :'RPID', :'rp_logar'), 'ok');
select t('15. turma com início em 1900 é recusada', :RP, $q$insert into public.turmas_fic (nome, professor_id, inicio) values ('Turma 1900', public.meu_id(), date '1900-01-01')$q$, 'O início da turma fica entre 01/01/2026 e 31/12/2027');
select t('15. turma com fim em 2099 é recusada', :RP, $q$insert into public.turmas_fic (nome, professor_id, inicio, fim) values ('Turma 2099', public.meu_id(), public.fic_hoje(), date '2099-01-01')$q$, 'O fim da turma fica entre 01/01/2026 e 31/12/2027');
select t('15. turma com início e fim dentro do projeto é aceita', :RP, $q$insert into public.turmas_fic (nome, professor_id, inicio, fim) values ('Turma dentro do período', public.meu_id(), date '2026-01-01', date '2027-12-31')$q$, 'ok');
select t('15. turma ANTIGA com início em 1900 continua editável (e a data errada pode ser corrigida)', null, format($q$do $x$ declare n int; begin set local role none;
  alter table public.turmas_fic disable trigger user;
  insert into public.turmas_fic (id, nome, inicio, professor_id) values ('f6500000-0000-0000-0000-00000000000a', 'Turma antiga de 1900', date '1900-01-01', %s);
  alter table public.turmas_fic enable trigger user;
  perform r46_como(%L);
  update public.turmas_fic set obs = 'turma de antes da regra' where id = 'f6500000-0000-0000-0000-00000000000a'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não alterou'; end if;
  update public.turmas_fic set inicio = public.fic_hoje() where id = 'f6500000-0000-0000-0000-00000000000a'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não corrigiu a data'; end if; end $x$$q$, :'RPID', :'rp_logar'), 'ok');
select t('15. mesmo número de matrícula para outra pessoa é recusado', :RP, format($q$select public.matricular_fic(%s, %s, ' r46-002 ', %L)$q$, :'TA', :'RGID', :'mes'), 'O número de matrícula r46-002 já é de Rosa Agente Regras');
select t('15. matrícula com data anterior ao início da turma é recusada', :RP, format($q$select public.matricular_fic(%s, %s, 'R46-001', %L::date - 31)$q$, :'TA', :'RGID', :'mes'), 'A turma começa em');
select t('15. matrícula no dia em que a turma começa é aceita', :RP, format($q$select public.matricular_fic(%s, %s, 'R46-001', %L::date - 30)$q$, :'TA', :'RGID', :'mes'), 'ok');
select t('15. matrícula ANTIGA (anterior ao início da turma) continua podendo ser regravada com a mesma data e ter o número corrigido', :RP, format($q$do $x$ begin
  perform public.matricular_fic(%s, 'f6000000-0000-0000-0000-000000000002', 'R46-002', %L::date - 45);
  perform public.matricular_fic(%s, 'f6000000-0000-0000-0000-000000000002', 'R46-002B', %L::date - 45);
  if (select numero from public.matriculas_fic where id = 'f6700000-0000-0000-0000-000000000002') <> 'R46-002B' then raise exception 'não corrigiu'; end if; end $x$$q$, :'TA', :'mes', :'TA', :'mes'), 'ok');
select t('15. ... e continua podendo ser cancelada', :RP, $q$select public.cancelar_matricula_fic('f6700000-0000-0000-0000-000000000002', 'Matrícula lançada na turma errada')$q$, 'ok');
select t('15. ... mas mudar a data dela para outra anterior ao início é recusado', :RP, format($q$select public.matricular_fic(%s, 'f6000000-0000-0000-0000-000000000002', 'R46-002', %L::date - 44)$q$, :'TA', :'mes'), 'A turma começa em');
create or replace function r46_enc(p_id text, p_data text, p_carga text, p_mod text, p_txt text) returns text language sql as $$
  select format($q$public.registrar_encontro_fic(%s, 'f6500000-0000-0000-0000-000000000001', %s, %s, %L, %L, '{}')$q$, p_id, p_data, p_carga, p_mod, p_txt) $$;
select t('15. encontros da turma no mesmo dia somam até 12 horas', :RP, 'select ' || r46_enc('null', 'public.fic_hoje()', '6', 'presencial', 'Aula da manhã sobre canteiros') || ', ' || r46_enc('null', 'public.fic_hoje()', '6', 'online', 'Aula da noite sobre sementes'), 'ok');
select t('15. ... e passam a ser recusados acima de 12 horas', :RP, 'select ' || r46_enc('null', 'public.fic_hoje()', '6', 'presencial', 'Aula da manhã sobre canteiros') || ', ' || r46_enc('null', 'public.fic_hoje()', '6', 'online', 'Aula da noite sobre sementes')
  || ', ' || r46_enc('null', 'public.fic_hoje()', '0.5', 'ava', 'Atividade no ambiente virtual'), 'somariam 12,5 horas: o máximo é 12 horas por dia');
select t('15. em dias diferentes, 12 horas em cada dia são aceitas', :RP, 'select ' || r46_enc('null', 'public.fic_hoje()', '12', 'presencial', 'Dia de campo completo no quintal') || ', ' || r46_enc('null', 'public.fic_hoje() - 1', '12', 'presencial', 'Dia de campo completo na horta'), 'ok');
select t('19. mesmo encontro (turma, dia e modalidade) duas vezes é recusado', :RP, 'select ' || r46_enc('null', 'public.fic_hoje()', '2', 'presencial', 'Aula sobre compostagem caseira') || ', ' || r46_enc('null', 'public.fic_hoje()', '2', 'presencial', 'Outra aula no mesmo dia e modalidade'), 'já tem encontro registrado neste dia nesta modalidade');
select t('19. encontro cancelado libera o dia e a modalidade', :RP, $q$do $x$ declare e uuid; begin
  e := $q$ || r46_enc('null', 'public.fic_hoje()', '2', 'presencial', 'Aula sobre compostagem caseira') || $q$;
  perform public.cancelar_encontro_fic(e, 'Registrado no dia errado');
  perform $q$ || r46_enc('null', 'public.fic_hoje()', '2', 'presencial', 'Aula sobre compostagem, agora certa') || $q$; end $x$$q$, 'ok');
select t('15 e 19. encontros ANTIGOS (dois no mesmo dia e modalidade, 16 horas no dia) continuam editáveis e canceláveis; só não aumentam', null, format($q$do $x$ declare m text; begin set local role none;
  insert into public.fic_encontros (id, turma_id, professor_id, data, carga_horaria, modalidade, conteudo) values
    ('f6a00000-0000-0000-0000-000000000001', 'f6500000-0000-0000-0000-000000000001', %s, public.fic_hoje(), 8, 'presencial', 'Encontro antigo da manhã'),
    ('f6a00000-0000-0000-0000-000000000002', 'f6500000-0000-0000-0000-000000000001', %s, public.fic_hoje(), 8, 'presencial', 'Encontro antigo da tarde');
  perform r46_como(%L);
  perform public.registrar_encontro_fic('f6a00000-0000-0000-0000-000000000001', 'f6500000-0000-0000-0000-000000000001', public.fic_hoje(), 8, 'presencial', 'Encontro antigo da manhã, com o texto corrigido', '{}');
  perform public.registrar_encontro_fic('f6a00000-0000-0000-0000-000000000001', 'f6500000-0000-0000-0000-000000000001', public.fic_hoje(), 7, 'presencial', 'Encontro antigo da manhã, com menos horas', '{}') ;
  begin perform public.registrar_encontro_fic('f6a00000-0000-0000-0000-000000000002', 'f6500000-0000-0000-0000-000000000001', public.fic_hoje(), 9, 'presencial', 'Encontro antigo da tarde, com mais horas', '{}'); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like '%%o máximo é 12 horas por dia%%' then raise exception 'aumentar as horas: %%', m; end if;
  perform public.cancelar_encontro_fic('f6a00000-0000-0000-0000-000000000002', 'Lançado em dobro antes da regra'); end $x$$q$, :'RPID', :'RPID', :'rp_logar'), 'ok');
-- 19. canal de venda
select t('19. canal de venda repetido (maiúsculas e espaços sobrando) é recusado', :BB, $q$select public.salvar_canal_venda(null, 'BA', 'Juazeiro', 'feira', 'Feira da Família São José', null, null, true),
  public.salvar_canal_venda(null, 'BA', ' JUAZEIRO ', 'feira', ' feira da Família São José ', null, null, true)$q$, 'Este canal já está cadastrado neste município');
select t('19. canal renomeado para o nome de outro que já existe é recusado', :BB, $q$do $x$ declare a uuid; b uuid; begin
  a := public.salvar_canal_venda(null, 'BA', 'Juazeiro', 'feira', 'Feira Regras Um', null, null, true);
  b := public.salvar_canal_venda(null, 'BA', 'Juazeiro', 'feira', 'Feira Regras Dois', null, null, true);
  perform public.salvar_canal_venda(b, 'BA', 'Juazeiro', 'feira', 'feira regras um', 'aos sábados', null, true); end $x$$q$, 'Já existe outro canal com este nome e tipo neste município');
select t('19. canal continua sendo alterado (detalhe, contato, desativar) e renomeado para um nome livre', :BB, $q$do $x$ declare a uuid; begin
  a := public.salvar_canal_venda(null, 'BA', 'Juazeiro', 'feira', 'Feira Regras Um', null, null, true);
  perform public.salvar_canal_venda(a, 'BA', 'Juazeiro', 'feira', 'Feira Regras Um', 'aos sábados, na praça', 'Dona Maria (74) 99999-0000', false);
  perform public.salvar_canal_venda(a, 'BA', 'Juazeiro', 'grupo', 'Feira Regras Três', null, null, true);
  if (select nome from public.canais_venda where id = a) <> 'Feira Regras Três' then raise exception 'não renomeou'; end if; end $x$$q$, 'ok');
select t('19. canais ANTIGOS repetidos continuam editáveis (sem mudar o nome)', null, format($q$do $x$ begin set local role none;
  insert into public.canais_venda (id, uf, municipio, tipo, nome) values ('f6b00000-0000-0000-0000-000000000001', 'BA', 'Juazeiro', 'paa', 'Canal antigo repetido'), ('f6b00000-0000-0000-0000-000000000002', 'BA', 'Juazeiro', 'paa', 'Canal antigo repetido');
  perform r46_como(%L);
  perform public.salvar_canal_venda('f6b00000-0000-0000-0000-000000000002', 'BA', 'Juazeiro', 'paa', 'Canal antigo repetido', 'entrega às terças', null, false);
  if (select ativo from public.canais_venda where id = 'f6b00000-0000-0000-0000-000000000002') then raise exception 'não alterou'; end if; end $x$$q$, :'bb_logar'), 'ok');

-- =====================================================================
-- 9. histórico das tabelas que não tinham
-- =====================================================================
select t('9. dados pessoais complementares: o histórico guarda quem, quando e QUAIS campos mudaram, sem os valores', :T, format($q$do $x$ declare a public.auditoria; eu uuid := public.meu_id(); begin
  update public.equipe_privado set data_nascimento = '1970-01-01', nis = '99999999999', endereco = '{"cidade": "Cidade Secreta"}' where equipe_id = %s;
  set local role none;
  select * into a from public.auditoria where tabela = 'equipe_privado' and registro_id = %s order by id desc limit 1;
  if a.id is null or a.acao <> 'UPDATE' or a.por is distinct from eu then raise exception 'sem registro de quem alterou'; end if;
  if a.depois -> 'campos_alterados' <> '["data_nascimento", "endereco", "nis"]'::jsonb then raise exception 'campos: %%', a.depois; end if;
  if a.antes is not null or a.depois::text ~ '99999999999|12345678901|1970|1990|Secreta' then raise exception 'o histórico guardou o dado pessoal: %% / %%', a.antes, a.depois; end if; end $x$$q$, :'RGID', :'RGID'), 'ok');
select t('9. dados pessoais complementares: gravar sem mudar nada não enche o histórico', :T, format($q$do $x$ declare n bigint; begin
  update public.equipe_privado set atualizado_em = now() where equipe_id = %s;
  set local role none; select count(*) into n from public.auditoria where tabela = 'equipe_privado' and registro_id = %s;
  if n <> 0 then raise exception 'registrou %% linha(s)', n; end if; end $x$$q$, :'RGID', :'RGID'), 'ok');
select t('9. dados pessoais complementares novos: só os nomes dos campos preenchidos', :T, $q$do $x$ declare a public.auditoria; begin
  insert into public.equipe_privado (equipe_id, data_nascimento, nis) values ('f6000000-0000-0000-0000-000000000002', '1988-08-08', '55555555555');
  set local role none;
  select * into a from public.auditoria where tabela = 'equipe_privado' and registro_id = 'f6000000-0000-0000-0000-000000000002' order by id desc limit 1;
  if a.acao is distinct from 'INSERT' or a.depois -> 'campos_preenchidos' <> '["data_nascimento", "nis"]'::jsonb or a.depois::text ~ '55555555555|1988' then raise exception 'veio: %', a.depois; end if; end $x$$q$, 'ok');
select t('9. visitas de cada pedido de pagamento ficam no histórico (entrada no pedido e saída ao devolver)', :T, format($q$do $x$ declare n bigint; eu uuid := public.meu_id(); begin
  perform public.avalizar_pagamento(%L, false, 'conferir o km das duas visitas', null);
  set local role none;
  select count(*) into n from public.auditoria where tabela = 'solicitacao_visitas' and registro_id = %L and acao = 'INSERT' and por = 'f6000000-0000-0000-0000-000000000001' and depois ? 'visita_id';
  if n <> 2 then raise exception 'entradas: %%', n; end if;
  select count(*) into n from public.auditoria where tabela = 'solicitacao_visitas' and registro_id = %L and acao = 'DELETE' and por = eu and antes ? 'visita_id';
  if n <> 2 then raise exception 'saídas: %%', n; end if; end $x$$q$, :'s1', :'s1', :'s1'), 'ok');
select t('9. marcar e desmarcar a entrega do mês fica no histórico', :BB, format($q$do $x$ declare n bigint; eu uuid := public.meu_id(); begin
  delete from public.entregas_mes where equipe_id = eu and mes = %L;
  insert into public.entregas_mes (equipe_id, mes, item) values (eu, %L, 'presenca');
  delete from public.entregas_mes where equipe_id = eu and mes = %L;
  set local role none;
  select count(*) into n from public.auditoria where tabela = 'entregas_mes' and registro_id = eu and por = eu and em >= now()
     and ((acao = 'INSERT' and depois ->> 'item' = 'presenca') or (acao = 'DELETE' and antes ->> 'item' = 'presenca'));
  if n < 2 then raise exception 'só %% linha(s)', n; end if; end $x$$q$, :'mes', :'mes', :'mes'), 'ok');
select t('9. alteração de APL do município fica no histórico', :T, $q$do $x$ declare a public.auditoria; eu uuid := public.meu_id(); begin
  insert into public.apl_municipios (uf, municipio, apls, obs) values ('BA', 'Juazeiro', '{fruticultura}', 'polo de frutas') on conflict (uf, municipio) do update set apls = excluded.apls, obs = excluded.obs;
  set local role none;
  select * into a from public.auditoria where tabela = 'apl_municipios' order by id desc limit 1;
  if a.id is null or a.por is distinct from eu or a.depois ->> 'municipio' <> 'Juazeiro' or a.depois ->> 'obs' <> 'polo de frutas' then raise exception 'veio: %', a.depois; end if; end $x$$q$, 'ok');
select t('9. o histórico das outras tabelas continua completo e lido só pela coordenação geral', :T, $q$do $x$ begin
  if exists (select 1 from public.auditoria) then raise exception 'a técnica leu o histórico'; end if; end $x$$q$, 'ok');

-- =====================================================================
-- 10. aprovar o que mudou enquanto era lido
-- =====================================================================
\set F7 ' where id = ''f6100000-0000-0000-0000-000000000007'''
\set D1 ' where id = ''f6300000-0000-0000-0000-000000000001'''
select t('10. ficha: aprovação com a marca do que foi lido é aceita quando nada mudou', :T, $q$update public.fichas set situacao = 'aprovada', atualizado_em = (select x.atualizado_em from public.fichas x where x.id = 'f6100000-0000-0000-0000-000000000007')$q$ || :'F7', 'ok');
select t('10. ficha: aprovação com marca antiga é recusada', :T, $q$update public.fichas set situacao = 'aprovada', atualizado_em = now() - interval '1 hour'$q$ || :'F7', 'Este registro foi alterado enquanto você lia. Abra de novo e confira.');
select t('10. ficha: sem a marca (celular com versão antiga), aprova como antes', :T, $q$update public.fichas set situacao = 'aprovada'$q$ || :'F7', 'ok');
select t('10. ficha: a marca só é conferida na aprovação (devolver com marca antiga passa)', :T, $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever o endereço', atualizado_em = now() - interval '1 hour'$q$ || :'F7', 'ok');
select t('10. ficha: a técnica lê, a bolsista altera, a técnica aprova o que leu: recusado; lendo de novo, aprova', :T, format($q$do $x$ declare lido timestamptz; m text; begin
  select atualizado_em into lido from public.fichas where id = 'f6100000-0000-0000-0000-000000000007';
  perform r46_como(%L); perform pg_sleep(0.01);
  update public.fichas set comunidade = 'Outra comunidade', endereco = 'Outro sítio' where id = 'f6100000-0000-0000-0000-000000000007';
  perform r46_como(%L);
  begin update public.fichas set situacao = 'aprovada', obs_coordenacao = null, atualizado_em = lido where id = 'f6100000-0000-0000-0000-000000000007'; m := 'aprovou';
  exception when others then m := sqlerrm; end;
  if m <> 'Este registro foi alterado enquanto você lia. Abra de novo e confira.' then raise exception 'veio: %%', m; end if;
  select atualizado_em into lido from public.fichas where id = 'f6100000-0000-0000-0000-000000000007';
  update public.fichas set situacao = 'aprovada', obs_coordenacao = null, atualizado_em = lido where id = 'f6100000-0000-0000-0000-000000000007';
  if (select situacao from public.fichas where id = 'f6100000-0000-0000-0000-000000000007') <> 'aprovada' then raise exception 'não aprovou'; end if; end $x$$q$, :'bb_logar', :'t_logar'), 'ok');
select t('10. plano: aprovação com a marca do que foi lido é aceita quando nada mudou', :T, $q$update public.diagnosticos set situacao = 'aprovado', atualizado_em = (select x.atualizado_em from public.diagnosticos x where x.id = 'f6300000-0000-0000-0000-000000000001')$q$ || :'D1', 'ok');
select t('10. plano: aprovação com marca antiga é recusada', :T, $q$update public.diagnosticos set situacao = 'aprovado', atualizado_em = now() - interval '1 hour'$q$ || :'D1', 'Este registro foi alterado enquanto você lia. Abra de novo e confira.');
select t('10. plano: sem a marca, aprova como antes', :T, $q$update public.diagnosticos set situacao = 'aprovado'$q$ || :'D1', 'ok');
select t('10. plano: a geral também é conferida', :G, $q$update public.diagnosticos set situacao = 'aprovado', atualizado_em = now() - interval '1 hour'$q$ || :'D1', 'Este registro foi alterado enquanto você lia');
select t('10. plano: a técnica lê, quem visitou altera, a técnica aprova o que leu: recusado', :T, format($q$do $x$ declare lido timestamptz; m text; begin
  select atualizado_em into lido from public.diagnosticos where id = 'f6300000-0000-0000-0000-000000000001';
  perform r46_como(%L); perform pg_sleep(0.01);
  update public.diagnosticos set dados = '{"kit": [{"item": "Caixa", "qtd": 1, "valor": 4900}]}' where id = 'f6300000-0000-0000-0000-000000000001';
  perform r46_como(%L);
  begin update public.diagnosticos set situacao = 'aprovado', atualizado_em = lido where id = 'f6300000-0000-0000-0000-000000000001'; m := 'aprovou';
  exception when others then m := sqlerrm; end;
  if m <> 'Este registro foi alterado enquanto você lia. Abra de novo e confira.' then raise exception 'veio: %%', m; end if; end $x$$q$, :'rg_logar', :'t_logar'), 'ok');

-- =====================================================================
-- 11. diagnóstico e avaliação: datas e números coerentes (e 22)
-- =====================================================================
create or replace function r46_dg(p_data text, p_lat text default '-9.41', p_lon text default '-40.5', p_area text default '300', p_renda text default '900', p_lote text default '1') returns text language sql as $$
  select format($q$insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, lote, latitude, longitude, area_m2, renda_familiar, renda_quintal)
    values ('f6300000-0000-0000-0000-000000000008', 'f6100000-0000-0000-0000-000000000008', 'f6200000-0000-0000-0000-000000000081', 'BA', %s, 'sim', %s, %s, %s, %s, %s, 50)$q$, p_data, p_lote, p_lat, p_lon, p_area, p_renda) $$;
select t('11. diagnóstico com tudo certo é aceito', :RG, r46_dg('public.fic_hoje()'), 'ok');
select t('11. diagnóstico na mesma data da ficha é aceito', :RG, r46_dg(format('%L::date - 60', :'mes')), 'ok');
select t('11. diagnóstico com data anterior à da ficha é recusado', :RG, r46_dg(format('%L::date - 61', :'mes')), 'não pode ser anterior à data da ficha desta mulher');
select t('11. diagnóstico com data anterior a 01/01/2026 é recusado', :RG, r46_dg($q$'2025-12-31'$q$), 'não pode ser anterior a 01/01/2026');
select t('11. diagnóstico com data em 1900 é recusado', :RG, r46_dg($q$'1900-01-01'$q$), 'não pode ser anterior a 01/01/2026');
select t('11. área negativa é recusada', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '-50'), 'A área do quintal precisa ser maior que zero');
select t('11. área zero é recusada', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '0'), 'A área do quintal precisa ser maior que zero');
select t('11. área acima de 100.000 m² é recusada', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '100000.5'), 'no máximo 100.000 m²');
select t('11. área de 100.000 m² é aceita', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '100000'), 'ok');
select t('11. área em branco é aceita', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', 'null'), 'ok');
select t('11. renda negativa é recusada', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '300', '-1000'), 'A renda da família não pode ser negativa');
select t('11. renda de 1e30 é recusada', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '300', '1e30'), 'nem passar de R$ 1.000.000,00');
select t('11. renda zero é aceita', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '300', '0'), 'ok');
select t('11. latitude 500 é recusada', :RG, r46_dg('public.fic_hoje()', '500', '-40.5'), 'Localização inválida: a latitude vai de -90 a 90');
select t('11. longitude -200 é recusada', :RG, r46_dg('public.fic_hoje()', '-9.41', '-200'), 'Localização inválida: a latitude vai de -90 a 90');
select t('11. GPS (0, 0) é recusado', :RG, r46_dg('public.fic_hoje()', '0', '0'), 'Localização inválida (0, 0)');
select t('22. segundo diagnóstico do mesmo quintal: mensagem clara', :RG, $q$insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, lote, latitude, longitude)
  values (gen_random_uuid(), 'f6100000-0000-0000-0000-000000000001', 'f6200000-0000-0000-0000-000000000011', 'BA', public.fic_hoje(), 'sim', 1, -9.41, -40.5)$q$, 'Este quintal já tem diagnóstico registrado.');
select t('22. lote 3: mensagem clara', :RG, r46_dg('public.fic_hoje()', '-9.41', '-40.5', '300', '900', '3'), 'O lote de implantação precisa ser 1 ou 2');
\set D10 ' where id = ''f6300000-0000-0000-0000-000000000010'''
select t('11. diagnóstico ANTIGO (data anterior à ficha, área negativa, GPS 0,0) continua podendo ser aprovado', :T, $q$do $x$ declare n int; begin update public.diagnosticos set situacao = 'aprovado' where id = 'f6300000-0000-0000-0000-000000000010';
  get diagnostics n = row_count; if n <> 1 or (select situacao from public.diagnosticos where id = 'f6300000-0000-0000-0000-000000000010') <> 'aprovado' then raise exception 'não aprovou'; end if; end $x$$q$, 'ok');
select t('11. ... devolvido', :T, $q$update public.diagnosticos set situacao = 'devolvido', obs_coordenacao = 'Refazer a medida da área'$q$ || :'D10', 'ok');
select t('11. ... e corrigido em outro campo por quem fez a visita', :RG, $q$do $x$ declare n int; begin update public.diagnosticos set renda_quintal = 10, mes_implantacao = 'nov/26' where id = 'f6300000-0000-0000-0000-000000000010';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, 'ok');
select t('11. ... mas mudar a área dele para outro valor impossível é recusado', :G, $q$update public.diagnosticos set area_m2 = -3$q$ || :'D10', 'A área do quintal precisa ser maior que zero');
select t('11. ... mudar a data dele para outra anterior à ficha é recusado', :RG, $q$update public.diagnosticos set data_visita = data_visita - 1$q$ || :'D10', 'não pode ser anterior à data da ficha');
select t('11. ... e corrigir a área, o GPS e a data para valores certos é aceito', :RG, format($q$update public.diagnosticos set area_m2 = 250, latitude = -9.4, longitude = -40.5, data_visita = %L::date - 20$q$, :'mes') || :'D10', 'ok');
select t('11. avaliação: latitude 500 e EBIA 15 são recusadas com mensagem clara; a certa é aceita', :RG, $q$do $x$ declare m text; begin
  begin insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', public.fic_hoje(), 500, -40.5, 'sim'); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like 'Localização inválida%' then raise exception 'latitude: %', m; end if;
  begin insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz, ebia_pontos)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', public.fic_hoje(), -9.41, -40.5, 'sim', 15); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m <> 'A pontuação da EBIA vai de 0 a 14.' then raise exception 'EBIA: %', m; end if;
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz, ebia_pontos)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', public.fic_hoje(), -9.41, -40.5, 'sim', 14);
  begin insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz)
    values (gen_random_uuid(), 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', public.fic_hoje(), -9.41, -40.5, 'sim'); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m <> 'Esta visita já tem avaliação registrada.' then raise exception 'segunda avaliação: %', m; end if; end $x$$q$, 'ok');
select t('11. avaliação ANTIGA com data anterior à ficha continua podendo ser corrigida em outro campo', null, format($q$do $x$ declare n int; begin set local role none;
  alter table public.avaliacoes disable trigger user; alter table public.visitas disable trigger user;
  update public.visitas set situacao = 'realizada', data_realizada = %L::date - 90 where id = 'f6200000-0000-0000-0000-000000000045';
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, quintal_produz)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', 'f6000000-0000-0000-0000-000000000001', %L::date - 90, 0, 0, 'sim');
  alter table public.avaliacoes enable trigger user; alter table public.visitas enable trigger user;
  perform r46_como(%L);
  update public.avaliacoes set quintal_produz = 'em_parte', ebia_pontos = 3, ebia_nivel = 'leve' where id = 'f6400000-0000-0000-0000-000000000004'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, :'mes', :'mes', :'rg_logar'), 'ok');

-- =====================================================================
-- 12. ficha com quintal em andamento
-- =====================================================================
\set F4 ' where id = ''f6100000-0000-0000-0000-000000000004'''
\set F9 ' where id = ''f6100000-0000-0000-0000-000000000009'''
select t('12. ficha com visita: a coordenação geral NÃO muda o estado', :G, $q$update public.fichas set uf = 'PE', municipio = 'Petrolina'$q$ || :'F4', 'Esta ficha já tem visita agendada ou feita: o estado não muda');
select t('12. quintal em andamento: a técnica NÃO devolve a ficha', :T, $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever os dados'$q$ || :'F4', 'Este quintal já está em andamento (tem diagnóstico registrado): a ficha não pode ser devolvida nem mudar de resultado');
select t('12. quintal em andamento: a geral NÃO devolve a ficha', :G, $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever os dados'$q$ || :'F4', 'Este quintal já está em andamento');
select t('12. quintal em andamento: a geral NÃO muda o resultado', :G, $q$update public.fichas set resultado = 'nao_atende', justificativa = 'Desistiu do projeto'$q$ || :'F4', 'Este quintal já está em andamento');
select t('12. quintal em andamento: a geral continua corrigindo os outros dados da ficha', :G, $q$do $x$ declare n int; begin update public.fichas set celular = '(74) 99999-0000', endereco = 'Sítio corrigido' where id = 'f6100000-0000-0000-0000-000000000004';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, 'ok');
select t('12. ficha sem diagnóstico continua podendo ser devolvida', :T, $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever os dados'$q$ || :'F9', 'ok');
select t('12. ficha sem visita continua podendo mudar de estado e de resultado (coordenação geral)', :G, $q$update public.fichas set uf = 'PE', municipio = 'Petrolina', resultado = 'nao_atende', justificativa = 'Mudou-se'$q$ || :'F9', 'ok');
select t('12. ficha só com visita CANCELADA continua podendo mudar de estado', :G, $q$do $x$ begin
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values ('f6200000-0000-0000-0000-000000000091', 'f6100000-0000-0000-0000-000000000009', 'BA', 'diagnostico', 'f6000000-0000-0000-0000-000000000001', public.fic_hoje() + 3);
  update public.visitas set situacao = 'cancelada' where id = 'f6200000-0000-0000-0000-000000000091';
  update public.fichas set uf = 'PE', municipio = 'Petrolina' where id = 'f6100000-0000-0000-0000-000000000009'; end $x$$q$, 'ok');
select t('12. ficha ANTIGA devolvida já com diagnóstico continua podendo ser corrigida, reenviada e aprovada', :BB, format($q$do $x$ begin
  update public.fichas set endereco = 'Sítio com o endereço revisto' where id = 'f6100000-0000-0000-0000-000000000011';
  if (select situacao from public.fichas where id = 'f6100000-0000-0000-0000-000000000011') <> 'aguardando' then raise exception 'não voltou para análise'; end if;
  perform r46_como(%L);
  update public.fichas set situacao = 'aprovada' where id = 'f6100000-0000-0000-0000-000000000011';
  if (select situacao from public.fichas where id = 'f6100000-0000-0000-0000-000000000011') <> 'aprovada' then raise exception 'não aprovou'; end if; end $x$$q$, :'t_logar'), 'ok');

-- =====================================================================
-- 13. link de cadastro já usado
-- =====================================================================
\set C1 ' where id = ''f6600000-0000-0000-0000-000000000001'''
\set C2 ' where id = ''f6600000-0000-0000-0000-000000000002'''
select t('13. link já usado NÃO é reaberto (usado_em não volta a vazio)', :T, $q$update public.convites set usado_em = null$q$ || :'C1', 'Este link de cadastro já foi usado e não pode ser reaberto');
select t('13. link já usado NÃO tem o prazo empurrado', :T, $q$update public.convites set expira_em = now() + interval '90 days'$q$ || :'C1', 'já foi usado e não pode ser reaberto');
select t('13. ... nem pela coordenação geral', :G, $q$update public.convites set usado_em = null, expira_em = now() + interval '90 days'$q$ || :'C1', 'já foi usado e não pode ser reaberto');
select t('13. link já usado continua podendo ser cancelado', :T, $q$do $x$ declare n int; begin update public.convites set cancelado_em = now() where id = 'f6600000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não cancelou'; end if; end $x$$q$, 'ok');
select t('13. link ainda aberto continua podendo ser cancelado', :T, $q$update public.convites set cancelado_em = now()$q$ || :'C2', 'ok');
select t('13. link aberto é usado normalmente (o cadastro pelo link continua funcionando)', null, $q$select public.enviar_pre_cadastro('r46aberto' || md5('b'),
  '{"nome": "Nova Agente Pelo Link", "cpf": "960.000.000-99", "email": "nova.r46@t.com", "data_nascimento": "1990-03-02", "consentimento_lgpd": true}')$q$, 'ok');
select t('22. cadastro pelo link com nascimento que não existe (30/02): mensagem clara', null, $q$select public.enviar_pre_cadastro('r46aberto' || md5('b'),
  '{"nome": "Nova Agente Pelo Link", "cpf": "960.000.000-99", "email": "nova.r46@t.com", "data_nascimento": "1990-02-30", "consentimento_lgpd": true}')$q$, 'A data de nascimento não é uma data que existe');
select t('22. cadastro pelo link com nascimento no futuro: mensagem clara', null, $q$select public.enviar_pre_cadastro('r46aberto' || md5('b'),
  '{"nome": "Nova Agente Pelo Link", "cpf": "960.000.000-99", "email": "nova.r46@t.com", "data_nascimento": "2090-01-01", "consentimento_lgpd": true}')$q$, 'não pode ser no futuro');
select t('22. cadastro pelo link com CPF de 10 números: mensagem clara', null, $q$select public.enviar_pre_cadastro('r46aberto' || md5('b'),
  '{"nome": "Nova Agente Pelo Link", "cpf": "1234567890", "email": "nova.r46@t.com", "data_nascimento": "1990-03-02", "consentimento_lgpd": true}')$q$, 'O CPF precisa ter 11 números');
select t('22. cadastro pelo link com e-mail inválido: mensagem clara', null, $q$select public.enviar_pre_cadastro('r46aberto' || md5('b'),
  '{"nome": "Nova Agente Pelo Link", "cpf": "960.000.000-99", "email": "sem arroba", "data_nascimento": "1990-03-02", "consentimento_lgpd": true}')$q$, 'E-mail inválido');

-- =====================================================================
-- 14. ficha: CPF da equipe, testemunha e lista de espera (e 22)
-- =====================================================================
select t('14. ficha com o CPF de pessoa ATIVA da equipe é recusada', :BB, r46_fi(21, '96000000001'), 'Este CPF é de uma pessoa ativa da equipe do projeto');
select t('14. ficha com o CPF de pessoa DESLIGADA da equipe é aceita', :BB, r46_fi(21, '96000000005'), 'ok');
select t('14. trocar o CPF de uma ficha para o de pessoa ativa da equipe é recusado', :G, $q$update public.fichas set cpf = '96000000001'$q$ || :'F9', 'Este CPF é de uma pessoa ativa da equipe do projeto');
select t('14. testemunha com o mesmo CPF da mulher é recusada', :BB, r46_fi(22, '96200000022', ', assinatura, testemunha_nome, testemunha_cpf', $q$, 'digital', 'Maria Regra Nova 22', '96200000022'$q$), 'A testemunha da assinatura não pode ser a própria mulher');
select t('14. testemunha com outro CPF é aceita', :BB, r46_fi(22, '96200000022', ', assinatura, testemunha_nome, testemunha_cpf', $q$, 'digital', 'Joana Testemunha', '96200000023'$q$), 'ok');
select t('14. posição na lista de espera em ficha SELECIONADA é recusada', :BB, r46_fi(23, '96200000023', ', posicao_espera', ', 5'), 'A posição na lista de espera só vale para quem está na lista de espera');
select t('14. posição livre na lista de espera é aceita', :BB, r46_fi(23, '96200000023', ', posicao_espera', ', 5', 'lista_espera'), 'ok');
select t('14. posição repetida na lista de espera do estado é recusada', :BB, 'do $x$ begin ' || r46_fi(23, '96200000023', ', posicao_espera', ', 5', 'lista_espera') || '; ' || r46_fi(24, '96200000024', ', posicao_espera', ', 5', 'lista_espera') || '; end $x$', 'Já há outra mulher na posição 5 da lista de espera de BA');
select t('14. mudar a posição para uma já ocupada é recusado', :BB, 'do $x$ begin ' || r46_fi(23, '96200000023', ', posicao_espera', ', 5', 'lista_espera') || '; ' || r46_fi(24, '96200000024', ', posicao_espera', ', 6', 'lista_espera') || $q$;
  update public.fichas set posicao_espera = 5 where cpf = '96200000024'; end $x$$q$, 'Já há outra mulher na posição 5 da lista de espera de BA');
select t('14. quem sai da lista de espera (foi selecionada) perde a posição sozinha', :BB, 'do $x$ begin ' || r46_fi(23, '96200000023', ', posicao_espera', ', 5', 'lista_espera') || $q$;
  update public.fichas set resultado = 'selecionada' where cpf = '96200000023';
  if (select posicao_espera from public.fichas where cpf = '96200000023') is not null then raise exception 'ficou com a posição'; end if; end $x$$q$, 'ok');
select t('14. ficha ANTIGA (CPF de pessoa da equipe, posição em selecionada) continua podendo ser devolvida', :T, $q$update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o CPF'$q$ || :'F' || $q$12'$q$, 'ok');
select t('14. ... e corrigida em outro campo pela coordenação geral', :G, $q$do $x$ declare n int; begin update public.fichas set celular = '(74) 98888-0000' where id = 'f6100000-0000-0000-0000-000000000012';
  get diagnostics n = row_count; if n <> 1 or (select posicao_espera from public.fichas where id = 'f6100000-0000-0000-0000-000000000012') <> 3 then raise exception 'não gravou ou mexeu na posição'; end if; end $x$$q$, 'ok');
select t('14. fichas ANTIGAS com a mesma posição na lista de espera continuam editáveis e aprováveis', :BB, format($q$do $x$ begin
  update public.fichas set celular = '(74) 97777-0000' where id = 'f6100000-0000-0000-0000-000000000013';
  perform r46_como(%L);
  update public.fichas set situacao = 'aprovada' where id = 'f6100000-0000-0000-0000-000000000013';
  update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever a posição' where id = 'f6100000-0000-0000-0000-000000000014'; end $x$$q$, :'t_logar'), 'ok');
select t('22. CPF com pontos e traço: mensagem clara', :BB, r46_fi(25, '962.000.000-25'), 'O CPF da mulher precisa ter 11 números');
select t('22. CPF repetido: mensagem clara', :BB, r46_fi(25, '96100000004'), 'Esta mulher (CPF) já tem ficha no projeto');
select t('22. menor de 18 anos selecionada: mensagem clara', :BB, 'do $x$ begin ' || r46_fi(25, '96200000025', ', p_jovem', ', true') || $q$; update public.fichas set data_nascimento = public.fic_hoje() - 6000 where cpf = '96200000025'; end $x$$q$, 'Ela tem menos de 18 anos na data da ficha');
select t('22. família com 0 pessoas: mensagem clara', :BB, r46_fi(25, '96200000025', ', pessoas_familia', ', 0'), 'O número de pessoas da família precisa ficar entre 1 e 30');
select t('22. selecionada sem um critério obrigatório: mensagem clara', :G, $q$update public.fichas set c_sem_kit = false$q$ || :'F9', 'Selecionada ou lista de espera só com todos os critérios obrigatórios');
select t('14. ficha com latitude 500 é recusada', :BB, r46_fi(25, '96200000025', ', latitude, longitude', ', 500, -40'), 'Localização inválida');

-- =====================================================================
-- 20. equipe: cadastro desligado, substituição e matrícula no desligamento (e 22)
-- =====================================================================
\set E5 ' where id = ''f6000000-0000-0000-0000-000000000005'''
\set E2 ' where id = ''f6000000-0000-0000-0000-000000000002'''
select t('20. coordenação técnica NÃO altera o nome de cadastro desligado', :T, $q$update public.equipe set nome = 'Nome Trocado Depois'$q$ || :'E5', 'Este cadastro está desligado e não é mais alterado');
select t('20. coordenação técnica NÃO reescreve a data e o motivo do desligamento', :T, $q$update public.equipe set data_fim = data_fim - 1, motivo_desligamento = 'motivo reescrito depois'$q$ || :'E5', 'Este cadastro está desligado e não é mais alterado');
select t('20. auxiliar NÃO registra Arlo e termo em cadastro desligado', :X, $q$update public.equipe set docs_funcern_em = public.fic_hoje()$q$ || :'E5', 'Este cadastro está desligado e não é mais alterado');
select t('20. coordenação geral continua corrigindo o cadastro desligado', :G, $q$do $x$ declare n int; begin update public.equipe set nome = 'Zeca Desligado Corrigido', motivo_desligamento = 'Saiu do projeto a pedido' where id = 'f6000000-0000-0000-0000-000000000005';
  get diagnostics n = row_count; if n <> 1 then raise exception 'não gravou'; end if; end $x$$q$, 'ok');
select t('20. gravar o cadastro desligado sem mudar nada não dá erro (a tela regrava)', :T, $q$update public.equipe set nome = nome$q$ || :'E5', 'ok');
select t('20. "substitui" apontando para a própria pessoa é recusado', :T, $q$update public.equipe set substitui_id = id$q$ || :'E2', 'A pessoa não pode substituir a si mesma');
select t('20. "substitui" apontando para pessoa ATIVA de outro estado é recusado', :T, format($q$update public.equipe set substitui_id = %L$q$, :'agpi') || :'E2', 'está ativa em outro estado');
select t('20. "substitui" apontando para quem saiu da vaga continua aceito', :T, $q$update public.equipe set substitui_id = 'f6000000-0000-0000-0000-000000000005'$q$ || :'E2', 'ok');
select t('20. cadastro ANTIGO com "substitui" errado continua editável e pode ser desligado', null, format($q$do $x$ begin set local role none;
  alter table public.equipe disable trigger user;
  update public.equipe set substitui_id = id where id = 'f6000000-0000-0000-0000-000000000002';
  alter table public.equipe enable trigger user;
  perform r46_como(%L);
  update public.equipe set telefone = '(74) 99999-1111', municipio = 'Sobradinho' where id = 'f6000000-0000-0000-0000-000000000002';
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Saiu do projeto' where id = 'f6000000-0000-0000-0000-000000000002'; end $x$$q$, :'t_logar'), 'ok');
select t('20. no desligamento, a matrícula do FIC ainda ativa passa a cancelada (e a presença em encontros antigos continua valendo)', :T, format($q$do $x$ declare m public.matriculas_fic; begin
  update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'Saiu do projeto' where id = 'f6000000-0000-0000-0000-000000000002';
  set local role none;
  select * into m from public.matriculas_fic where id = 'f6700000-0000-0000-0000-000000000002';
  if m.cancelada_em is null or m.motivo_cancelamento <> 'Cancelada pelo sistema: a pessoa foi desligada do projeto em ' || to_char(public.fic_hoje(), 'DD/MM/YYYY') || '.' then raise exception 'matrícula: %% / %%', m.cancelada_em, m.motivo_cancelamento; end if;
  if 'f6000000-0000-0000-0000-000000000002' not in (select public.fic_matriculados_em('f6500000-0000-0000-0000-000000000001', %L::date - 5)) then raise exception 'perdeu a presença em encontro anterior ao desligamento'; end if; end $x$$q$, :'mes'), 'ok');
select t('22. desligamento com data anterior ao início: mensagem clara', :T, $q$update public.equipe set status = 'desligada', data_fim = data_inicio - 1, motivo_desligamento = 'Saiu do projeto'$q$ || :'E2', 'A data do desligamento não pode ser anterior à data de início');

-- =====================================================================
-- 21. documentos (e 22)
-- =====================================================================
create or replace function r46_doc(p_data text, p_path text default $q$'2026/r46_' || gen_random_uuid() || '.pdf'$q$) returns text language sql as $$
  select format($q$insert into public.documentos_projeto (id, tipo, titulo, data_documento, arquivo_path, arquivo_nome) values ('f6c00000-0000-0000-0000-000000000001', 'ata', 'Ata das regras decididas', %s, %s, 'ata.pdf')$q$, p_data, p_path) $$;
select t('21. documento com data em 2090 é recusado', :G, r46_doc($q$'2090-01-01'$q$), 'Confira a data do documento: precisa ser a partir de 01/01/2025 e no máximo um ano à frente');
select t('21. documento com data em 1900 é recusado', :G, r46_doc($q$'1900-01-01'$q$), 'Confira a data do documento');
select t('21. documento com data de 31/12/2024 é recusado', :G, r46_doc($q$'2024-12-31'$q$), 'Confira a data do documento');
select t('21. documento de 01/01/2025 é aceito', :G, r46_doc($q$'2025-01-01'$q$), 'ok');
select t('21. documento com data de hoje + 1 ano é aceito; + 1 ano e 1 dia, recusado', :G, 'do $x$ declare m text; begin ' || r46_doc('public.fic_hoje() + 365') || $q$;
  begin update public.documentos_projeto set data_documento = public.fic_hoje() + 366 where id = 'f6c00000-0000-0000-0000-000000000001'; m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m not like 'Confira a data do documento%' then raise exception 'veio: %', m; end if; end $x$$q$, 'ok');
select t('21. documento arquivado NÃO muda de título', :G, 'do $x$ begin ' || r46_doc('public.fic_hoje()') || $q$;
  update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Versão antiga' where id = 'f6c00000-0000-0000-0000-000000000001';
  update public.documentos_projeto set titulo = 'Título trocado depois' where id = 'f6c00000-0000-0000-0000-000000000001'; end $x$$q$, 'Este documento já está arquivado: o título e a data não mudam mais');
select t('21. documento arquivado NÃO muda de data', :G, 'do $x$ begin ' || r46_doc('public.fic_hoje()') || $q$;
  update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Versão antiga' where id = 'f6c00000-0000-0000-0000-000000000001';
  update public.documentos_projeto set data_documento = public.fic_hoje() - 1 where id = 'f6c00000-0000-0000-0000-000000000001'; end $x$$q$, 'Este documento já está arquivado: o título e a data não mudam mais');
select t('21. documento NÃO arquivado continua mudando de título e de data', :G, 'do $x$ begin ' || r46_doc('public.fic_hoje()') || $q$;
  update public.documentos_projeto set titulo = 'Ata das regras decididas (revista)', data_documento = public.fic_hoje() - 1 where id = 'f6c00000-0000-0000-0000-000000000001'; end $x$$q$, 'ok');
select t('21. documento ANTIGO com data de 1900 continua podendo ser alterado em outro campo e arquivado', null, format($q$do $x$ begin set local role none;
  alter table public.documentos_projeto disable trigger user;
  insert into public.documentos_projeto (id, tipo, titulo, data_documento, arquivo_path, arquivo_nome) values ('f6c00000-0000-0000-0000-000000000002', 'ata', 'Ata antiga com data errada', '1900-01-01', '2026/r46_antiga.pdf', 'ata.pdf');
  alter table public.documentos_projeto enable trigger user;
  perform r46_como(%L);
  update public.documentos_projeto set descricao = 'data lançada errada na época', titulo = 'Ata antiga (data a conferir)' where id = 'f6c00000-0000-0000-0000-000000000002';
  update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Data errada: anexada de novo' where id = 'f6c00000-0000-0000-0000-000000000002';
  if (select arquivado_em from public.documentos_projeto where id = 'f6c00000-0000-0000-0000-000000000002') is null then raise exception 'não arquivou'; end if; end $x$$q$, :'g_logar'), 'ok');
select t('22. o mesmo arquivo anexado duas vezes: mensagem clara', :G, 'do $x$ begin ' || r46_doc('public.fic_hoje()', $q$'2026/r46_mesmo.pdf'$q$) || $q$;
  insert into public.documentos_projeto (tipo, titulo, data_documento, arquivo_path, arquivo_nome) values ('ata', 'Ata repetida de novo', public.fic_hoje(), '2026/r46_mesmo.pdf', 'ata.pdf'); end $x$$q$, 'Este arquivo já foi anexado. Escolha outro arquivo.');

-- =====================================================================
-- 18. datas "de hoje" no fuso de Fortaleza, mesmo com a conexão em outro fuso
-- =====================================================================
select t('18. nenhuma função do banco usa mais a data da conexão', null, $q$do $x$ declare l text; begin set local role none;
  select string_agg(proname, ', ' order by proname) into l from pg_proc where pronamespace = 'public'::regnamespace
     and proname not in ('ins', 'sp', 'mv', 't', 'f', 'logar')   -- funções auxiliares desta suíte de testes
     and (prosrc ~* ('current' || '_date') or prosrc ~* 'date_trunc\(''month'', now\(\)\)');
  if l is not null then raise exception 'ainda usam: %', l; end if; end $x$$q$, 'ok');
select t('18. conexão em outro fuso (já é amanhã lá): lançamento de execução com data de amanhã é recusado', :G, $q$do $x$ begin set local timezone = 'Pacific/Kiritimati';
  insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'diarias', 10, public.fic_hoje() + 1); end $x$$q$, 'A data do lançamento não pode ser no futuro');
select t('18. ... e com a data de hoje (de Fortaleza) é aceito', :G, $q$do $x$ begin set local timezone = 'Pacific/Kiritimati';
  insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'diarias', 10, public.fic_hoje()); end $x$$q$, 'ok');
select t('18. conexão em outro fuso: matrícula no FIC com data de amanhã é recusada', :RP, format($q$do $x$ begin set local timezone = 'Pacific/Kiritimati';
  perform public.matricular_fic(%s, %s, 'R46-001', public.fic_hoje() + 1); end $x$$q$, :'TA', :'RGID'), 'Data da matrícula vazia ou no futuro');
select t('18. conexão em outro fuso: pedido de evento para HOJE (de Fortaleza), com justificativa, é aceito', :BB, $q$do $x$ begin set local timezone = 'Pacific/Kiritimati';
  perform public.salvar_pedido_apoio(null, 'evento', 'Evento de hoje no fuso', public.fic_hoje(), '{"valor_estimado": 10, "local": "Sede"}', 'Evento confirmado em cima da hora pela prefeitura'); end $x$$q$, 'ok');
select t('18. conexão em outro fuso: pedido de evento para ONTEM (de Fortaleza) é recusado', :BB, $q$do $x$ begin set local timezone = 'Etc/GMT+12';
  perform public.salvar_pedido_apoio(null, 'evento', 'Evento de ontem no fuso', public.fic_hoje() - 1, '{"valor_estimado": 10, "local": "Sede"}', 'Evento confirmado em cima da hora pela prefeitura'); end $x$$q$, 'Informe uma data que ainda não passou');
select t('18. conexão em outro fuso: o mês seguinte ao de Fortaleza não é aceito no pagamento nem na entrega', :BB, format($q$do $x$ declare m text; begin set local timezone = 'Pacific/Kiritimati';
  begin perform public.solicitar_pagamento('bolsa', (%L::date + interval '1 month')::date, 700, repeat('Relatório de atividades do mês. ', 3), null, '{}'); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m <> 'Só dá para solicitar o mês atual ou meses anteriores.' then raise exception 'pagamento: %%', m; end if;
  begin insert into public.entregas_mes (equipe_id, mes, item) values (public.meu_id(), (%L::date + interval '1 month')::date, 'presenca'); m := 'aceitou';
  exception when others then m := sqlerrm; end;
  if m <> 'Mês no futuro.' then raise exception 'entrega: %%', m; end if; end $x$$q$, :'mes', :'mes'), 'ok');
select t('18. conexão em outro fuso: avaliação com data de amanhã é recusada', :RG, $q$do $x$ begin set local timezone = 'Pacific/Kiritimati';
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz)
    values ('f6400000-0000-0000-0000-000000000004', 'f6100000-0000-0000-0000-000000000004', 'f6200000-0000-0000-0000-000000000045', 'BA', public.fic_hoje() + 1, -9.41, -40.5, 'sim'); end $x$$q$, 'futuro');

-- =====================================================================
-- 22 (execução) e 23 (vitrine)
-- =====================================================================
select t('22. lançamento de R$ 0,004 (viraria R$ 0,00): mensagem clara', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 0.004, public.fic_hoje())$q$, 'O valor do lançamento precisa ser de R$ 0,01 a R$ 2.000.000,00');
select t('22. lançamento de R$ 2.000.000,01: mensagem clara', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 2000000.01, public.fic_hoje())$q$, 'O valor do lançamento precisa ser de R$ 0,01 a R$ 2.000.000,00');
select t('22. lançamento de R$ 2.000.000,00 continua aceito', :G, $q$insert into public.execucao_lancamentos (tipo, item, valor, data) values ('despesa', 'quintais', 2000000, public.fic_hoje())$q$, 'ok');
select t('23. vitrine: município com e sem acento conta como um só, com o nome acentuado', null, $q$do $x$ declare v jsonb; n int; begin set local role none;
  alter table public.fichas disable trigger user;
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha)
  select gen_random_uuid(), 'PE', m, 'Vila', 'Maria Vitrine ' || i, (96300000000 + i)::text, '1980-01-01', 'Sítio', true,true,true,true,true,true,true,true,true,true, 'selecionada', public.fic_hoje()
    from unnest(array['São José do Belmonte', 'Sao Jose do Belmonte', 'SÃO JOSÉ DO  BELMONTE ', 'sao jose do belmonte']) with ordinality x(m, i);
  alter table public.fichas enable trigger user;
  v := public.vitrine_municipios();
  select count(*) into n from jsonb_array_elements(v) e where e ->> 'uf' = 'PE' and public.sem_acento(e ->> 'municipio') = 'sao jose do belmonte';
  if n <> 1 then raise exception 'ficaram % círculos: %', n, v; end if;
  if not exists (select 1 from jsonb_array_elements(v) e where e ->> 'uf' = 'PE' and e ->> 'municipio' = 'São José do Belmonte' and (e ->> 'n')::int = 4) then raise exception 'nome ou total: %', v; end if; end $x$$q$, 'ok');
select t('23. vitrine: nenhum município aparece duas vezes no mesmo estado, e o anônimo continua lendo', null, $q$do $x$ declare v jsonb := public.vitrine_municipios(); begin
  if jsonb_typeof(v) <> 'array' then raise exception 'veio: %', v; end if;
  set local role none;
  if exists (select 1 from jsonb_array_elements(v) e group by e ->> 'uf', public.sem_acento(e ->> 'municipio') having count(*) > 1) then raise exception 'repetiu: %', v; end if; end $x$$q$, 'ok');

-- =====================================================================
-- instalação: o script pode rodar de novo, não apaga nada e fecha as funções novas
-- =====================================================================
select t('46. gatilhos, regras e funções novas instalados; funções de gatilho fechadas para quem não entrou', null, $q$do $x$ declare n int; begin set local role none;
  select count(*) into n from pg_trigger where not tgisinternal and tgname in ('a1_versao', 'diagnosticos_a1_versao', 'diagnosticos_a2_limites', 'avaliacoes_a2_limites', 'fichas_c_regras', 'equipe_c_regras',
    'custos_visita_a0_travas', 'parametros_a0_validar', 'convites_a0_travas', 'entregas_a0_travas', 'equipe_desligada_matricula', 'equipe_privado_auditoria', 'solicitacao_visitas_auditoria',
    'entregas_mes_auditoria', 'apl_municipios_auditoria');
  if n <> 15 then raise exception 'gatilhos: %', n; end if;
  if (select pg_get_expr(polqual, polrelid) from pg_policy where polname = 'turmas_alterar') not like '%professor_id = %meu_id()%' then raise exception 'regra das turmas'; end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('visita_etapa_motivo', 'custos_visita_travas', 'parametros_validar', 'auditar_sem_id', 'versao_conferir',
       'campo_formulario_limites', 'fichas_regras', 'convites_travas', 'entregas_travas', 'equipe_regras', 'equipe_desligada_matricula', 'sem_acento')
       and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))) then raise exception 'função interna aberta'; end if;
  if has_function_privilege('anon', 'public.solicitar_pagamento(text, date, numeric, text, uuid[], jsonb)', 'EXECUTE') or has_function_privilege('anon', 'public.salvar_pedido_apoio(uuid, text, text, date, jsonb, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.registrar_encontro_fic(uuid, uuid, date, numeric, text, text, uuid[])', 'EXECUTE') then raise exception 'anônimo alcança'; end if;
  if not has_function_privilege('anon', 'public.enviar_pre_cadastro(text, jsonb)', 'EXECUTE') or not has_function_privilege('anon', 'public.vitrine_municipios()', 'EXECUTE') then raise exception 'fechou o que é público'; end if; end $x$$q$, 'ok');

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
-- arruma o que o teste deixou (o teste seguinte desliga a técnica e o auxiliar e não depende destes registros)
drop table pid46;
drop function r46_como(uuid), r46_fi(int, text, text, text, text), r46_aj(date, text, text, text), r46_antiga(text), r46_enc(text, text, text, text, text),
  r46_dg(text, text, text, text, text, text), r46_doc(text, text);
