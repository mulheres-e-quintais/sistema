-- carga_1410 / 01: massa sintética do tamanho do plano de trabalho, gravada PELOS PERFIS CERTOS e com TODOS os gatilhos
-- ligados (nada de session_replication_role nem "disable trigger"). Banco LOCAL de teste; NÃO rodar no Supabase.
--   equipe completa (coord. geral, coord. técnica, auxiliar, 2 professores FIC, 1 articulação + 1 apoio + 2 agentes por UF),
--   habilitação pelo caminho da tela (turma FIC + matrícula pelo professor, Arlo e termo conferidos pelo auxiliar),
--   255 fichas (por UF: 40 selecionadas, 8 lista de espera, 2 não atende, 1 sem água), aprovação pela coord. técnica,
--   200 diagnósticos (agente/apoio) + aprovação do plano, 1.000 visitas (diagnóstico, implantação, 2 acompanhamentos,
--   avaliação), 200 avaliações, pedidos de ajuda de custo e bolsa + aval.
-- Cada comando roda na sua própria transação (\gexec em autocommit): "now()" muda de um registro para outro, como na vida real.
-- Recusas do banco ficam em carga.erros; tempos por etapa em carga.tempos.
\set QUIET on
\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP 0

create table if not exists carga.fila (n serial primary key, etapa text, quem uuid, cmd text);
create or replace function carga.inicio(e text) returns void language sql as $$
  insert into carga.tempos(etapa, inicio) values (e, clock_timestamp()) on conflict (etapa) do update set inicio = clock_timestamp() $$;
create or replace function carga.fim(e text) returns text language sql as $$
  update carga.tempos set fim = clock_timestamp(),
     recusados = (select count(*) from carga.erros where etapa = e),
     ok = (select count(*) from carga.fila where etapa = e) - (select count(*) from carga.erros where etapa = e)
   where etapa = e
  returning rpad(etapa, 22) || ' ok=' || ok || ' recusados=' || recusados || ' tempo=' || round(extract(epoch from fim - inicio)::numeric, 2) || 's' $$;

-- ===== equipe =====
select logar('cleone.lima@ifrn.edu.br');
create or replace function carga.ins_eq(papel text, uf text, nome text, cpf text, email text) returns text language sql as $$
  select format('insert into public.equipe(papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd) values (%L, %L, %L, %L, %L, ''(84) 98888-0000'', ''Município Fictício'', ''Organização Fictícia'', date ''2026-09-01'', true)',
    papel, nullif(uf, ''), nome, cpf, email) $$;

select carga.inicio('equipe');
insert into carga.fila(etapa, quem, cmd) values
  ('equipe', uid_de('cleone.lima@ifrn.edu.br'), carga.ins_eq('professor_fic', '', 'Professora Carga Um', cpf_t(52000000001), 'prof1@carga.invalid')),
  ('equipe', uid_de('cleone.lima@ifrn.edu.br'), carga.ins_eq('professor_fic', '', 'Professor Carga Dois', cpf_t(52000000002), 'prof2@carga.invalid'));
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'equipe' order by n \gexec
\o
insert into carga.fila(etapa, quem, cmd)
  select 'equipe', uid_de('cleone.lima@ifrn.edu.br'), format($q$update public.equipe set docs_funcern_em = date '2026-09-05', termo_path = 'equipe/'||id||'/termo_1.pdf', termo_assinado_em = date '2026-09-05' where email = %L$q$, e)
    from unnest(array['prof1@carga.invalid','prof2@carga.invalid']) e;
insert into carga.fila(etapa, quem, cmd) values
  ('equipe', uid_de('cleone.lima@ifrn.edu.br'), carga.ins_eq('coord_tecnico', '', 'Coordenadora Técnica Carga', cpf_t(52000000003), 'tecnica@carga.invalid')),
  ('equipe', uid_de('cleone.lima@ifrn.edu.br'), carga.ins_eq('auxiliar_adm', '', 'Auxiliar Administrativo Carga', cpf_t(52000000004), 'auxiliar@carga.invalid'));
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'equipe' and n > 2 order by n \gexec
\o
select logar(e) from unnest(array['prof1@carga.invalid','prof2@carga.invalid','tecnica@carga.invalid','auxiliar@carga.invalid']) e;

create table if not exists carga.ufs (uf text primary key, k int);
insert into carga.ufs values ('AL',1),('BA',2),('PE',3),('PI',4),('SE',5) on conflict do nothing;
insert into carga.fila(etapa, quem, cmd)
  select 'equipe', uid_de('tecnica@carga.invalid'), carga.ins_eq(p.papel, u.uf, initcap(p.papel) || ' Carga ' || u.uf || ' ' || p.j, cpf_t(52000000000 + u.k * 100 + case p.papel when 'articulacao' then 10 when 'apoio' then 20 else 30 end + p.j), lower(p.papel) || p.j || '.' || lower(u.uf) || '@carga.invalid')
    from carga.ufs u cross join (values ('articulacao', 1), ('apoio', 1), ('agente', 1), ('agente', 2)) p(papel, j) order by u.uf, p.papel, p.j;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'equipe' and n > 6 order by n \gexec
\o
select logar(email) from public.equipe where email like '%@carga.invalid' and user_id is null;
select carga.fim('equipe');

-- ===== habilitação (turma FIC, matrícula, Arlo, termo) =====
select carga.inicio('habilitacao');
insert into carga.fila(etapa, quem, cmd)
  select 'turmas', uid_de('prof1@carga.invalid'), format($q$insert into public.turmas_fic (nome, uf, municipio, inicio, fim, professor_id) values (%L, %L, 'Município Fictício', date '2026-09-01', date '2027-03-31', public.meu_id())$q$, 'Turma Carga ' || coalesce(uf, 'Geral'), uf)
    from (select uf from carga.ufs union all select null) x;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'turmas' order by n \gexec
\o
insert into carga.fila(etapa, quem, cmd)
  select 'habilitacao', uid_de('prof1@carga.invalid'), format($q$select public.matricular_fic((select id from public.turmas_fic where nome = %L), %L, %L, date '2026-09-08')$q$,
         'Turma Carga ' || coalesce(p.uf, 'Geral'), p.equipe_id, 'SUAP2026' || lpad(row_number() over (order by p.email)::text, 4, '0'))
    from carga.pessoas p where p.papel in ('coord_tecnico','articulacao','apoio','agente');
insert into carga.fila(etapa, quem, cmd)
  select 'habilitacao', uid_de(case when p.papel = 'auxiliar_adm' then 'cleone.lima@ifrn.edu.br' else 'auxiliar@carga.invalid' end), format($q$update public.equipe set docs_funcern_em = date '2026-09-09' where id = %L$q$, p.equipe_id)
    from carga.pessoas p where p.papel in ('coord_tecnico','articulacao','apoio','agente','auxiliar_adm');
insert into carga.fila(etapa, quem, cmd)
  select 'habilitacao', p.uid, format($q$select public.enviar_meu_termo(%L)$q$, 'equipe/' || p.equipe_id || '/termo_1759000000001.pdf')
    from carga.pessoas p where p.papel in ('coord_tecnico','articulacao','apoio','agente','auxiliar_adm');
insert into carga.fila(etapa, quem, cmd)
  select 'habilitacao', uid_de(case when p.papel = 'auxiliar_adm' then 'cleone.lima@ifrn.edu.br' else 'auxiliar@carga.invalid' end),
         format($q$select public.conferir_termo(%L, %L, date '2026-09-10')$q$, p.equipe_id, 'equipe/' || p.equipe_id || '/termo_1759000000001.pdf')
    from carga.pessoas p where p.papel in ('coord_tecnico','articulacao','apoio','agente','auxiliar_adm');
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'habilitacao' order by n \gexec
\o
select carga.fim('habilitacao');

-- ===== fichas =====
create table if not exists carga.fichas_plano (id uuid primary key, uf text, i int, resultado text, posicao int, cpf text, data_ficha date, executor text, bolsista text);
insert into carga.fichas_plano
  select gen_random_uuid(), u.uf, i,
         case when i < 40 then 'selecionada' when i < 48 then 'lista_espera' when i < 50 then 'nao_atende' else 'sem_agua' end,
         case when i between 40 and 47 then i - 39 end,
         cpf_t(70000000000 + u.k * 1000 + i), date '2026-09-14' + (i % 4),
         case i % 3 when 0 then 'agente1.' when 1 then 'agente2.' else 'apoio1.' end || lower(u.uf) || '@carga.invalid',
         'articulacao1.' || lower(u.uf) || '@carga.invalid'
    from carga.ufs u cross join generate_series(0, 50) i
  on conflict do nothing;

select carga.inicio('fichas');
insert into carga.fila(etapa, quem, cmd)
  select 'fichas', uid_de(case when i % 2 = 0 then bolsista else replace(bolsista, 'articulacao1', 'apoio1') end), format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, celular, endereco, pessoas_familia,
      c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao,
      p_sustento, p_cadunico, p_sem_ater, p_raca_povo, p_jovem, p_grupo, p_caf, consent_dados, consent_imagem,
      resultado, posicao_espera, encaminhada_para, latitude, longitude, data_ficha)
    values (%L, %L, %L, %L, %L, %L, %L, '(82) 99999-0000', 'Sítio Fictício, s/n', %s,
      %L, true, true, %L, true, true, true, true, true,
      %L, %L, true, %L, false, true, false, true, true,
      %L, %s, %L, %s, %s, %L)$q$,
    id, uf, 'Município ' || uf || ' ' || (i % 8), 'Comunidade ' || (i % 12), 'Agricultora Fictícia ' || uf || ' ' || lpad(i::text, 3, '0'), cpf,
    date '1970-01-01' + (i * 211), 1 + i % 7,
    case when resultado = 'nao_atende' then 'false' else 'true' end, case when resultado = 'sem_agua' then 'false' else 'true' end,
    (i % 2 = 0), (i % 3 = 0), (i % 5 = 0),
    resultado, coalesce(posicao::text, 'null'), case when resultado = 'sem_agua' then 'Programa Cisternas (fictício)' end,
    -9.5 - (i % 10) * 0.01, -37.5 - (i % 10) * 0.01, data_ficha)
  from carga.fichas_plano order by uf, i;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'fichas' order by n \gexec
\o
select carga.fim('fichas');

select carga.inicio('fichas_aprovar');
insert into carga.fila(etapa, quem, cmd)
  select 'fichas_aprovar', uid_de('tecnica@carga.invalid'), format($q$update public.fichas set situacao = 'aprovada' where id = %L$q$, id)
    from carga.fichas_plano order by uf, i;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'fichas_aprovar' order by n \gexec
\o
select carga.fim('fichas_aprovar');

-- ===== visitas: plano =====
create table if not exists carga.visitas_plano (id uuid primary key, ficha_id uuid, uf text, i int, etapa text, ordem int, data date, executor text, bolsista text);
insert into carga.visitas_plano
  select gen_random_uuid(), f.id, f.uf, f.i, e.etapa, e.ordem,
         case e.ordem when 1 then date '2026-09-18' + (f.i % 5) when 2 then date '2026-09-25' + (f.i % 5)
                      when 3 then date '2026-10-01' + (f.i % 4) when 4 then date '2026-10-06' + (f.i % 3) else date '2026-10-10' + (f.i % 4) end,
         f.executor, f.bolsista
    from carga.fichas_plano f cross join (values ('diagnostico', 1), ('implantacao', 2), ('acompanhamento', 3), ('acompanhamento', 4), ('avaliacao', 5)) e(etapa, ordem)
   where f.resultado = 'selecionada'
  on conflict do nothing;

create or replace function carga.agendar(o int) returns void language sql as $$
  insert into carga.fila(etapa, quem, cmd)
    select 'agendar_' || o, uid_de(bolsista), format($q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (%L, %L, %L, %L, %L, %L)$q$,
           id, ficha_id, uf, etapa, id_de(executor), data)
      from carga.visitas_plano where ordem = o order by uf, i $$;
create or replace function carga.realizar(o int) returns void language sql as $$
  insert into carga.fila(etapa, quem, cmd)
    select 'realizar_' || o, uid_de(executor), format($q$update public.visitas set situacao = 'realizada', data_realizada = %L, relato = %L, fotos = array[%L] where id = %L$q$,
           data, 'Visita feita no quintal: conversa com a família, plantio e manejo conferidos (registro fictício).', uf || '/carga/' || id || '.jpg', id)   -- 63: implantação e acompanhamento feitos têm foto
      from carga.visitas_plano where ordem = o order by uf, i $$;

-- 1) diagnóstico: agenda (bolsista) -> formulário (quem fez a visita) -> aprovação do plano (coord. técnica)
select carga.inicio('agendar_1'); select carga.agendar(1);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'agendar_1' order by n \gexec
\o
select carga.fim('agendar_1');

select carga.inicio('diagnosticos');
insert into carga.fila(etapa, quem, cmd)
  select 'diagnosticos', uid_de(executor), format($q$insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, codigo_quintal, latitude, longitude, area_m2, renda_familiar, renda_quintal, agua_seca, sem_agua, lote, mes_implantacao, dados)
     values (gen_random_uuid(), %L, %L, %L, %L, %L, %s, %s, %s, %s, %s, %L, false, %s, 'outubro/2026', %L::jsonb)$q$,
     ficha_id, id, uf, data, uf || '-' || lpad(i::text, 3, '0'), -9.5 - (i % 10) * 0.01, -37.5 - (i % 10) * 0.01, 50 + i * 3, 900 + i * 10, 50 + i,
     case when i % 4 = 0 then 'as_vezes' else 'sim' end, 1 + i % 2,
     jsonb_build_object('familia', jsonb_build_array(jsonb_build_object('nome', 'Pessoa fictícia', 'idade', 30)),
                        'kit', jsonb_build_array(jsonb_build_object('item', 'Enxada', 'qtd', 2, 'valor', 60),
                                                 jsonb_build_object('item', 'Mangueira 50 m', 'qtd', 1, 'valor', 180),
                                                 jsonb_build_object('item', 'Mudas frutíferas', 'qtd', 20, 'valor', 15)),
                        'producao', 'hortaliças e galinhas (fictício)'))
    from carga.visitas_plano where ordem = 1 order by uf, i;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'diagnosticos' order by n \gexec
\o
select carga.fim('diagnosticos');

select carga.inicio('diag_aprovar');
insert into carga.fila(etapa, quem, cmd)
  select 'diag_aprovar', uid_de('tecnica@carga.invalid'), format($q$update public.diagnosticos set situacao = 'aprovado' where ficha_id = %L$q$, ficha_id)
    from carga.visitas_plano where ordem = 1 order by uf, i;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'diag_aprovar' order by n \gexec
\o
select carga.fim('diag_aprovar');

-- 2) implantação, 3) e 4) acompanhamentos: agenda (bolsista) -> marcada como feita com relato (quem fez)
select carga.inicio('agendar_2'); select carga.agendar(2);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'agendar_2' order by n \gexec
\o
select carga.fim('agendar_2');
select carga.inicio('realizar_2'); select carga.realizar(2);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'realizar_2' order by n \gexec
\o
select carga.fim('realizar_2');
select carga.inicio('agendar_3'); select carga.agendar(3);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'agendar_3' order by n \gexec
\o
select carga.fim('agendar_3');
select carga.inicio('realizar_3'); select carga.realizar(3);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'realizar_3' order by n \gexec
\o
select carga.fim('realizar_3');
select carga.inicio('agendar_4'); select carga.agendar(4);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'agendar_4' order by n \gexec
\o
select carga.fim('agendar_4');
select carga.inicio('realizar_4'); select carga.realizar(4);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'realizar_4' order by n \gexec
\o
select carga.fim('realizar_4');

-- 5) avaliação: agenda (bolsista) -> formulário da avaliação (quem fez)
select carga.inicio('agendar_5'); select carga.agendar(5);
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'agendar_5' order by n \gexec
\o
select carga.fim('agendar_5');
select carga.inicio('avaliacoes');
insert into carga.fila(etapa, quem, cmd)
  select 'avaliacoes', uid_de(executor), format($q$insert into public.avaliacoes (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, quintal_produz, ebia_pontos, ebia_nivel, dados)
     values (gen_random_uuid(), %L, %L, %L, %L, %s, %s, %L, %s, %L, %L::jsonb)$q$,
     ficha_id, id, uf, data, -9.5 - (i % 10) * 0.01, -37.5 - (i % 10) * 0.01,
     case when i % 7 = 0 then 'em_parte' else 'sim' end, i % 9, case when i % 9 = 0 then 'seguranca' when i % 9 < 4 then 'leve' when i % 9 < 7 then 'moderada' else 'grave' end,
     jsonb_build_object('obs', 'avaliação fictícia'))
    from carga.visitas_plano where ordem = 5 order by uf, i;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'avaliacoes' order by n \gexec
\o
select carga.fim('avaliacoes');

-- ===== pagamentos (ajuda de custo por visita feita, bolsa de outubro) + aval =====
select carga.inicio('pagamentos');
insert into carga.fila(etapa, quem, cmd)
  select 'pagamentos', uid_de(v.executor), format($q$select public.solicitar_pagamento('ajuda_custo', %L, %s, null, %L::uuid[], '{}'::jsonb)$q$,
         date_trunc('month', v.data)::date, 80 * count(*), array_agg(v.id order by v.id))
    from carga.visitas_plano v join public.visitas x on x.id = v.id and x.situacao = 'realizada'
   group by v.executor, date_trunc('month', v.data) order by 1;
insert into carga.fila(etapa, quem, cmd)
  select 'pagamentos', p.uid, format($q$select public.solicitar_pagamento('bolsa', date '2026-10-01', %s, %L, null, '{"justificativa_sem_encontro": "Mês de preparação do curso, sem encontro ainda (fictício)."}'::jsonb)$q$,
         public.valor_bolsa(p.papel), 'Relatório de atividades de outubro (fictício): visitas acompanhadas, fichas conferidas, reuniões com a coordenação.')
    from carga.pessoas p where p.papel in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm') order by p.email;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'pagamentos' order by n \gexec
\o
select carga.fim('pagamentos');

select carga.inicio('pagamentos_aval');
insert into carga.fila(etapa, quem, cmd)
  select 'pagamentos_aval', case when public.quem_avaliza(s.tipo, e.papel) = 'coord_tecnico' then uid_de('tecnica@carga.invalid') else uid_de('cleone.lima@ifrn.edu.br') end,
         format($q$select public.avalizar_pagamento(%L, true, null, null)$q$, s.id)
    from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id
   where (hashtext(s.id::text) % 3) <> 0 order by s.solicitada_em;
\o /dev/null
select format('select g(%L, %L, %L)', etapa, quem, cmd) from carga.fila where etapa = 'pagamentos_aval' order by n \gexec
\o
select carga.fim('pagamentos_aval');

analyze;
select 'TOTAL ' || round(extract(epoch from max(fim) - min(inicio))::numeric, 1) || 's; recusas: ' || (select count(*) from carga.erros) from carga.tempos;
select 'contagem|' || string_agg(t || '=' || n, ' ') from (
  select 'equipe' t, count(*) n from public.equipe union all select 'fichas', count(*) from public.fichas
  union all select 'fichas_aprovadas_sel', count(*) from public.fichas where situacao = 'aprovada' and resultado = 'selecionada'
  union all select 'visitas', count(*) from public.visitas union all select 'visitas_feitas', count(*) from public.visitas where situacao = 'realizada'
  union all select 'diagnosticos', count(*) from public.diagnosticos union all select 'diag_aprovados', count(*) from public.diagnosticos where situacao = 'aprovado'
  union all select 'avaliacoes', count(*) from public.avaliacoes union all select 'pedidos', count(*) from public.solicitacoes_pagamento
  union all select 'pedidos_avalizados', count(*) from public.solicitacoes_pagamento where situacao = 'avalizada'
  union all select 'auditoria', count(*) from public.auditoria) x;
select 'RECUSA|' || etapa || '|' || count(*) || '|' || min(erro) from carga.erros group by etapa order by etapa;
