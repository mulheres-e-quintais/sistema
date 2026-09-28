-- =====================================================================
-- Mulheres & Quintais — Etapa 16: POPULAR o banco para testar TODAS as funções
-- Só para teste. Nomes, CPFs e endereços são inventados.
--
-- Ordem: 14_zerar_para_teste.sql (com ZERAR)  →  05_dados_exemplo.sql  →  este arquivo.
-- Antes de rodar, troque SEU_EMAIL@gmail.com pelo seu e-mail na linha "meu_email".
--
-- O que este script faz (em cima dos dados do 05):
--   * Cria 6 logins de teste, um por perfil, com apelidos do SEU e-mail (seu+tecnica@..., seu+articulacao@...).
--     O Gmail entrega "seu+qualquercoisa@gmail.com" na sua caixa, mas o sistema não manda e-mail nenhum:
--     você entra em "Primeiro acesso" com cada apelido e cria uma senha.
--   * Professores do FIC (2), auxiliar administrativo, turmas e matrículas do FIC.
--   * Coloca o projeto "no meio do caminho": diagnósticos feitos, parte das implantações e
--     acompanhamentos feitos, o resto agendado para as próximas semanas, algumas avaliações de impacto.
--   * Linha de base de impacto (EBIA etc.) em todos os diagnósticos e avaliações com melhora.
--   * Pedidos de pagamento em todas as situações (pedido, devolvido, com aval, lançado no Arlo).
--   * Um cadastro enviado pelo link esperando aprovação.
--   * Deixa pendências de propósito para testar os avisos: os logins de teste sem dados pessoais e conta,
--     e o auxiliar sem o termo registrado.
-- Para limpar tudo depois: 14_zerar_para_teste.sql.
-- =====================================================================
begin;

-- CPF válido a partir de 9 números
create or replace function pg_temp.cpf(base bigint) returns text language plpgsql as $$
declare d text := lpad((base % 1000000000)::text, 9, '0'); s int; i int; v1 int; v2 int;
begin
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  v1 := (s * 10) % 11; if v1 = 10 then v1 := 0; end if; d := d || v1;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  v2 := (s * 10) % 11; if v2 = 10 then v2 := 0; end if;
  return d || v2;
end $$;
-- número "aleatório" fixo a partir de um texto (sempre o mesmo resultado)
create or replace function pg_temp.h(t text, n int) returns int language sql immutable as $$ select abs(hashtext(t)) % n $$;
-- nível EBIA (cortes MDS): com menores 0 | 1–5 | 6–9 | 10–14; sem menores 0 | 1–3 | 4–5 | 6–8
create or replace function pg_temp.nivel(p int, menor boolean) returns text language sql immutable as $$
  select case when p = 0 then 'seguranca'
    when menor then case when p <= 5 then 'leve' when p <= 9 then 'moderada' else 'grave' end
    else case when p <= 3 then 'leve' when p <= 5 then 'moderada' else 'grave' end end $$;
create or replace function pg_temp.impacto(chave text, pontos int, menor boolean, dias int, especies int, criacoes int, vende boolean) returns jsonb language sql immutable as $$
  select jsonb_build_object('menor', menor,
    'ebia', (select jsonb_agg(case when i < (case when menor then 14 else 8 end) then to_jsonb(i < pontos) else 'null'::jsonb end order by i) from generate_series(0, 13) i),
    'ebia_pontos', pontos, 'ebia_nivel', pg_temp.nivel(pontos, menor),
    'dias_consumo', dias, 'especies', especies, 'criacoes', criacoes, 'vende', vende,
    'onde_vende', case when vende then (array['["feira"]','["comunidade"]','["feira","paa"]','["comunidade","pnae"]'])[1 + pg_temp.h(chave || 'o', 4)]::jsonb else '[]'::jsonb end,
    'decide', case when not vende then 'nao_vende' else (array['ela','ela_e_outro','ela','outra'])[1 + pg_temp.h(chave || 'd', 4)] end,
    'caf', (array['s','n','ns','n'])[1 + pg_temp.h(chave || 'c', 4)]) $$;

do $$
declare
  meu_email text := 'SEU_EMAIL@gmail.com';     -- <<< troque pelo seu e-mail
  usr text; dom text;
  cg uuid; ct uuid; art uuid; apo uuid; ag uuid; prof1 uuid := gen_random_uuid(); prof2 uuid := gen_random_uuid(); aux uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); conv uuid := gen_random_uuid();
  hoje date := current_date; mes_atual date := date_trunc('month', current_date)::date;
  rec record; s_id uuid; n int; sit text;
begin
  if meu_email like 'SEU_EMAIL%' or meu_email !~ '^[^@\s+]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Troque SEU_EMAIL@gmail.com pelo seu e-mail (sem +) na linha "meu_email". Nada foi feito.';
  end if;
  if to_regclass('public.exemplo') is null or not exists (select 1 from public.exemplo) then
    raise exception 'Rode antes o 05_dados_exemplo.sql (depois de zerar com o 14). Nada foi feito.';
  end if;
  if exists (select 1 from public.equipe where papel in ('professor_fic','auxiliar_adm')) then
    raise exception 'Este script já foi rodado (ou já há professor/auxiliar). Para repetir: 14 (zerar), 05 e este. Nada foi feito.';
  end if;
  usr := split_part(meu_email, '@', 1); dom := split_part(meu_email, '@', 2);
  select id into cg from public.equipe where papel = 'coord_geral' and status = 'ativa';
  if cg is null then raise exception 'Não achei a coordenação geral ativa. Nada foi feito.'; end if;

  alter table public.equipe disable trigger user;
  alter table public.fichas disable trigger user;
  alter table public.visitas disable trigger user;
  alter table public.diagnosticos disable trigger user;
  alter table public.avaliacoes disable trigger user;
  alter table public.solicitacoes_pagamento disable trigger user;

  -- -------------------------------------------------------------------
  -- 1. Logins de teste: pessoas do exemplo passam a usar apelidos do seu e-mail
  -- -------------------------------------------------------------------
  select id into ct  from public.equipe where papel = 'coord_tecnico' and status = 'ativa';
  select id into art from public.equipe where papel = 'articulacao' and uf = 'PI' and status = 'ativa';
  select id into apo from public.equipe where papel = 'apoio' and uf = 'PI' and status = 'ativa';
  select e.id into ag from public.equipe e where e.papel = 'agente' and e.uf = 'PI' and e.status = 'ativa'
    order by (select count(*) from public.visitas v where v.executor_id = e.id) desc, e.id limit 1;
  update public.equipe set email = usr || '+tecnica@' || dom     where id = ct;
  update public.equipe set email = usr || '+articulacao@' || dom where id = art;
  update public.equipe set email = usr || '+apoio@' || dom       where id = apo;
  update public.equipe set email = usr || '+agente@' || dom      where id = ag;
  delete from public.exemplo where id in (ct, art, apo, ag);        -- logins só funcionam fora da lista de exemplo

  -- agentes habilitados (quem faz visita paga precisa de FIC, Arlo e termo)
  update public.equipe set matricula_fic_em = hoje - 70, matricula_fic_numero = '2026' || lpad((pg_temp.h(id::text, 99999))::text, 5, '0'),
         docs_funcern_em = hoje - 65, termo_assinado_em = hoje - 65
   where papel = 'agente' and status = 'ativa';

  -- -------------------------------------------------------------------
  -- 2. Professores do FIC, auxiliar administrativo, turmas e matrículas
  -- -------------------------------------------------------------------
  insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd, criado_por,
                             docs_funcern_em, termo_assinado_em, siape)
  values (prof1, 'professor_fic', null, 'Marcos Aurélio Bezerra (teste)', pg_temp.cpf(318274651), usr || '+professor@' || dom, '(84) 99811-2001', 'Apodi/RN', 'IFRN Campus Apodi', hoje - 90, true, cg, hoje - 85, hoje - 85, '1823456'),
         (prof2, 'professor_fic', null, 'Rita de Cássia Moura (teste)', pg_temp.cpf(427163958), 'rita.moura@exemplo.invalid', '(84) 99811-2002', 'Apodi/RN', 'IFRN Campus Apodi', hoje - 90, true, cg, hoje - 85, hoje - 85, '2034567'),
         (aux,   'auxiliar_adm',  null, 'Sônia Maria Freitas (teste)',  pg_temp.cpf(536281947), usr || '+auxiliar@' || dom, '(84) 99811-2003', 'Apodi/RN', 'IFRN Campus Apodi', hoje - 90, true, cg, hoje - 88, null, '1945678');
  insert into public.exemplo (tabela, id) values ('equipe', prof2);

  insert into public.turmas_fic (id, nome, uf, municipio, inicio, fim, professor_id, criado_por)
  values (t1, 'FIC Agroecologia e Quintais – AL, BA e PE (teste)', null, 'Apodi/RN', hoje - 75, hoje + 120, prof1, prof1),
         (t2, 'FIC Agroecologia e Quintais – PI e SE (teste)',    null, 'Apodi/RN', hoje - 75, hoje + 120, prof2, prof2);
  insert into public.matriculas_fic (turma_id, equipe_id, numero, matriculado_em, criado_por)
  select case when e.uf in ('PI','SE') then t2 else t1 end, e.id,
         coalesce(e.matricula_fic_numero, '2026' || lpad((pg_temp.h(e.id::text, 99999))::text, 5, '0')), e.matricula_fic_em,
         case when e.uf in ('PI','SE') then prof2 else prof1 end
    from public.equipe e where e.status = 'ativa' and e.papel in ('articulacao','apoio','agente') and e.matricula_fic_em is not null;

  -- -------------------------------------------------------------------
  -- 3. Projeto "no meio do caminho": datas no passado e agenda para as próximas semanas
  -- -------------------------------------------------------------------
  create temp table q on commit drop as
    select f.id as ficha_id, (row_number() over (order by pg_temp.h(f.id::text, 1000000), f.id) - 1)::int as r
      from public.fichas f where f.resultado = 'selecionada' and f.situacao = 'aprovada';
  alter table q add column d0 date; update q set d0 = hoje - 80 + (r % 30);

  -- diagnóstico: todos feitos
  update public.visitas v set data_prevista = q.d0, data_realizada = q.d0, situacao = 'realizada'
    from q where v.ficha_id = q.ficha_id and v.etapa = 'diagnostico';
  update public.diagnosticos d set data_visita = q.d0, aprovado_em = (q.d0 + 3)::timestamptz, criado_em = q.d0::timestamptz
    from q where d.ficha_id = q.ficha_id;
  -- 15 planos esperando a coordenação técnica e 5 devolvidos (desses quintais nada foi implantado)
  update public.diagnosticos d set situacao = 'aguardando', aprovado_por = null, aprovado_em = null
    from q where d.ficha_id = q.ficha_id and q.r >= 185;
  update public.diagnosticos d set situacao = 'devolvido', aprovado_por = null, aprovado_em = null,
         obs_coordenacao = 'Conferir a área do quintal e a fonte de água: a foto não mostra a cisterna.'
    from q where d.ficha_id = q.ficha_id and q.r between 180 and 184;

  -- implantação: 150 feitas, o resto agendado
  update public.visitas v set data_prevista = q.d0 + 25, data_realizada = q.d0 + 25, situacao = 'realizada',
         relato = 'Kit entregue e canteiros montados com a família. Mudas plantadas e irrigação por gotejamento instalada.'
    from q where v.ficha_id = q.ficha_id and v.etapa = 'implantacao' and q.r < 150;
  update public.visitas v set data_prevista = hoje + 3 + (q.r % 20), data_realizada = null, situacao = 'prevista', relato = null
    from q where v.ficha_id = q.ficha_id and v.etapa = 'implantacao' and q.r >= 150;

  -- acompanhamentos: 1º feito em 90 quintais, 2º em 40; os outros agendados
  create temp table ac on commit drop as
    select v.id, v.ficha_id, row_number() over (partition by v.ficha_id order by v.id) as k
      from public.visitas v join q on q.ficha_id = v.ficha_id where v.etapa = 'acompanhamento';
  update public.visitas v set data_prevista = q.d0 + 45, data_realizada = q.d0 + 45, situacao = 'realizada',
         relato = 'Plantas pegaram bem. Orientação sobre cobertura do solo e controle de pulgão com calda de fumo.'
    from ac, q where v.id = ac.id and q.ficha_id = ac.ficha_id and ac.k = 1 and q.r < 90;
  update public.visitas v set data_prevista = least(q.d0 + 60, hoje - 2), data_realizada = least(q.d0 + 60, hoje - 2), situacao = 'realizada',
         relato = 'Primeira colheita de coentro e alface. A família já consome e vende o excedente na vizinhança.'
    from ac, q where v.id = ac.id and q.ficha_id = ac.ficha_id and ac.k = 2 and q.r < 40;
  update public.visitas v set data_prevista = case when ac.k = 1 then hoje + 8 + (q.r % 25) else hoje + 40 + (q.r % 30) end,
         data_realizada = null, situacao = 'prevista', relato = null
    from ac, q where v.id = ac.id and q.ficha_id = ac.ficha_id and ((ac.k = 1 and q.r >= 90) or (ac.k = 2 and q.r >= 40));
  -- 3 visitas atrasadas (previstas para dias que já passaram)
  update public.visitas v set data_prevista = hoje - 4
    from ac, q where v.id = ac.id and q.ficha_id = ac.ficha_id and ac.k = 1 and q.r between 90 and 92;

  -- avaliação de impacto: 25 feitas e 10 agendadas (só onde a implantação foi feita)
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, criado_por, criado_em, relato)
  select gen_random_uuid(), q.ficha_id, v.uf, 'avaliacao', v.executor_id,
         case when q.r < 25 then least(q.d0 + 64, hoje - 1) else hoje + 5 + (q.r % 10) end,
         case when q.r < 25 then least(q.d0 + 64, hoje - 1) end,
         case when q.r < 25 then 'realizada' else 'prevista' end, ct, now(), null
    from q join public.visitas v on v.ficha_id = q.ficha_id and v.etapa = 'implantacao'
   where q.r < 35;

  -- -------------------------------------------------------------------
  -- 4. Linha de base de impacto (diagnóstico) e avaliações com o "depois"
  -- -------------------------------------------------------------------
  update public.diagnosticos d set dados = d.dados || jsonb_build_object('impacto',
      pg_temp.impacto(d.id::text,
        (case when pg_temp.h(d.id::text || 'm', 2) = 0 then (array[0,2,4,7,11])[1 + pg_temp.h(d.id::text || 'p', 5)] else (array[0,1,3,4,6])[1 + pg_temp.h(d.id::text || 'p', 5)] end),
        pg_temp.h(d.id::text || 'm', 2) = 0, pg_temp.h(d.id::text || 'dc', 4), 3 + pg_temp.h(d.id::text || 'e', 8), pg_temp.h(d.id::text || 'cr', 4),
        pg_temp.h(d.id::text || 'v', 10) < 3))
    from q where d.ficha_id = q.ficha_id;

  insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, sem_gps_motivo, quintal_produz, ebia_pontos, ebia_nivel, dados, fotos)
  select gen_random_uuid(), v.ficha_id, v.id, v.uf, v.executor_id, v.data_realizada, d.latitude, d.longitude,
         case when d.latitude is null then 'Sem sinal de GPS na comunidade' end,
         (array['sim','sim','sim','em_parte','nao'])[1 + pg_temp.h(v.id::text, 5)],
         x.p, pg_temp.nivel(x.p, x.menor),
         jsonb_build_object('motivo', null, 'renda_quintal', round(coalesce(d.renda_quintal, 0) + 80 + pg_temp.h(v.id::text || 'r', 220)),
           'horas_dia', 2 + pg_temp.h(v.id::text || 'h', 3), 'agua', 'suficiente',
           'alimentacao', (array['melhorou','melhorou','igual','melhorou'])[1 + pg_temp.h(v.id::text || 'a', 4)],
           'encaminhamentos', '["caf","feira"]'::jsonb, 'fala', 'Hoje a gente come o que planta e ainda sobra para vender.',
           'impacto', pg_temp.impacto(v.id::text, x.p, x.menor, least(7, x.dias + 3), x.esp + 6 + pg_temp.h(v.id::text || 's', 7), x.cri + 1, pg_temp.h(v.id::text || 'v', 10) < 6)),
         '{}'
    from public.visitas v
    join public.diagnosticos d on d.ficha_id = v.ficha_id
    cross join lateral (select (d.dados->'impacto'->>'menor')::boolean as menor,
                               greatest(0, (d.dados->'impacto'->>'ebia_pontos')::int - 1 - pg_temp.h(v.id::text || 'q', 4)) as p,
                               (d.dados->'impacto'->>'dias_consumo')::int as dias, (d.dados->'impacto'->>'especies')::int as esp,
                               (d.dados->'impacto'->>'criacoes')::int as cri) x
   where v.etapa = 'avaliacao' and v.situacao = 'realizada';

  -- -------------------------------------------------------------------
  -- 5. Pedidos de pagamento em todas as situações
  -- -------------------------------------------------------------------
  -- ajuda de custo: meses anteriores lançados no Arlo; mês atual misturado (pedido, com aval, devolvido ou ainda não pedido)
  for rec in
    select v.executor_id, date_trunc('month', v.data_realizada)::date as mes, count(*) as n, array_agg(v.id) as vis
      from public.visitas v where v.situacao = 'realizada' and v.data_realizada is not null
     group by 1, 2
  loop
    if rec.mes < mes_atual then sit := 'lancada';
    else sit := (array['solicitada','avalizada','devolvida','nenhum'])[1 + pg_temp.h(rec.executor_id::text, 4)]; end if;
    if rec.executor_id in (art, ag) and rec.mes = mes_atual then sit := 'nenhum'; end if;   -- os logins de teste pedem eles mesmos
    continue when sit = 'nenhum';
    s_id := gen_random_uuid();
    insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, relatorio, detalhe, situacao, solicitada_em,
                                               aval_por, aval_em, obs_aval, arlo_por, arlo_em, arlo_protocolo)
    values (s_id, 'ajuda_custo', rec.executor_id, rec.mes, rec.n * 85, case when sit in ('avalizada','lancada') then rec.n * 85 end,
            rec.n || ' visitas de campo no mês.', jsonb_build_object('visitas', rec.n), sit, (rec.mes + 32)::timestamptz - interval '3 days',
            case when sit <> 'solicitada' then ct end, case when sit <> 'solicitada' then now() - interval '2 days' end,
            case when sit = 'devolvida' then 'Falta o relato de uma das visitas. Corrija e peça de novo.' end,
            case when sit = 'lancada' then aux end, case when sit = 'lancada' then now() - interval '1 day' end,
            case when sit = 'lancada' then 'ARLO-' || to_char(rec.mes, 'YYYYMM') || '-' || lpad(pg_temp.h(rec.executor_id::text, 9999)::text, 4, '0') end);
    if sit <> 'devolvida' then
      insert into public.solicitacao_visitas (visita_id, solicitacao_id) select unnest(rec.vis), s_id;
    end if;
  end loop;

  -- bolsa mensal do mês atual (quem recebe bolsa); os logins de teste ficam sem pedido
  insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio, situacao, aval_por, aval_em, arlo_por, arlo_em, arlo_protocolo)
  select 'bolsa', e.id, mes_atual, null, 'Atividades do mês: articulação com as comunidades, apoio às visitas e relatório.',
         x.sit, case when x.sit in ('avalizada','lancada') then case when e.papel in ('coord_tecnico','professor_fic','auxiliar_adm') then cg else ct end end,
         case when x.sit in ('avalizada','lancada') then now() - interval '1 day' end,
         case when x.sit = 'lancada' then aux end, case when x.sit = 'lancada' then now() end,
         case when x.sit = 'lancada' then 'ARLO-B-' || lpad(pg_temp.h(e.id::text, 9999)::text, 4, '0') end
    from public.equipe e
    cross join lateral (select (array['solicitada','avalizada','lancada'])[1 + pg_temp.h(e.id::text || 'b', 3)] as sit) x
   where e.status = 'ativa' and e.papel in ('articulacao','apoio','coord_tecnico','professor_fic') and e.id not in (ct, art, apo, prof1);

  -- -------------------------------------------------------------------
  -- 6. Um cadastro enviado pelo link esperando aprovação (agente da BA)
  -- -------------------------------------------------------------------
  insert into public.convites (id, token, papel, uf, criado_por, criado_em, expira_em, usado_em)
  values (conv, 'teste' || replace(gen_random_uuid()::text, '-', ''), 'agente', 'BA', ct, now() - interval '2 days', now() + interval '5 days', now() - interval '1 day');
  insert into public.pre_cadastros (convite_id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_nascimento, endereco, consentimento_lgpd, enviado_em)
  values (conv, 'agente', 'BA', 'Joelma Santos de Jesus (teste)', pg_temp.cpf(645192837), 'joelma.jesus@exemplo.invalid', '(75) 99812-3344', 'Cansanção/BA', 'MPA',
          '1995-03-14', '{"logradouro":"Povoado Lagoa Grande","numero":"s/n","cidade":"Cansanção","uf":"BA"}', true, now() - interval '1 day');

  alter table public.equipe enable trigger user;
  alter table public.fichas enable trigger user;
  alter table public.visitas enable trigger user;
  alter table public.diagnosticos enable trigger user;
  alter table public.avaliacoes enable trigger user;
  alter table public.solicitacoes_pagamento enable trigger user;
end $$;

commit;

-- Seus logins de teste (entre em "Primeiro acesso" com cada e-mail e crie uma senha)
select case papel when 'coord_tecnico' then '1 Coordenação técnica' when 'articulacao' then '2 Bolsista de articulação (PI)' when 'apoio' then '3 Bolsista de apoio (PI)'
         when 'agente' then '4 Agente de campo (PI)' when 'professor_fic' then '5 Professor do FIC' when 'auxiliar_adm' then '6 Auxiliar administrativo' end as perfil,
       nome, email
  from public.equipe where email like '%+%@%' and status = 'ativa'
union all select '0 Coordenação geral (você)', nome, email from public.equipe where papel = 'coord_geral' and status = 'ativa'
order by 1;
