-- Desempenho em escala (roda num banco de TESTE com os scripts 01–47 instalados; NUNCA em produção).
-- Gera massa fictícia em "unidades de volume" e mede, COMO CADA PERFIL (segurança por linha ligada), as leituras
-- que a tela faz na carga inicial e em cada aba, as funções de leitura e as gravações com todos os gatilhos.
--   1 unidade = volume do projeto: 300 fichas (200 selecionadas aprovadas), ~960 visitas, 190 diagnósticos, ~30 avaliações,
--               12 meses de pagamentos de ~40 pessoas (~430 pedidos), ~30.000 linhas de histórico, 10.800 acessos.
-- O arquivo gera 1× e mede (limites: leitura 100 ms, gravação 50 ms); completa até 10× e mede de novo (limite: 500 ms).
-- Uso:  psql -X -q -d <banco de teste> -f desempenho_escala.sql
--       psql -X -q -d <banco de teste> -v escalas=1,10,50 -f desempenho_escala.sql      (outras escalas, em ordem crescente)
--       psql -X -q -d <banco de teste> -v manter=1 -f desempenho_escala.sql              (deixa a massa no banco no fim)
-- Reexecutável: apaga a própria massa (ids que começam com e5ca1a) antes de começar e no fim. Não mexe em mais nada,
-- a não ser em logins de teste ligados (e depois desligados) às pessoas de função única que já existirem sem login.
-- Saída: uma linha PASSOU/FALHOU por medida e a contagem final.
\set QUIET on
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\if :{?escalas} \else \set escalas '1,10' \endif
\if :{?manter} \else \set manter 0 \endif
set client_min_messages = warning;
select set_config('escala.lista', :'escalas', false) \g /dev/null

-- ================= limpeza (antes e depois) =================
create or replace function pg_temp.limpar() returns void language plpgsql as $$
declare t text; r record;
begin
  set local session_replication_role = replica;
  delete from public.auditoria where registro_id::text like 'e5ca1a%';
  foreach t in array array['solicitacao_visitas:visita_id','custos_visita:visita_id','fic_presencas:id','fic_encontros:id','matriculas_fic:id','turmas_fic:id',
      'orientacoes_venda:id','agua_situacoes:id','avaliacoes:id','diagnosticos:id','visitas:id','fichas:id','solicitacoes_pagamento:id','pedidos_apoio:id',
      'entregas_mes:equipe_id','acessos:equipe_id','canais_venda:id','equipe_privado:equipe_id','equipe:id'] loop
    execute format('delete from public.%I where %I::text like ''e5ca1a%%''', split_part(t, ':', 1), split_part(t, ':', 2));
  end loop;
  -- pedidos e demais registros gravados pelas medidas de escrita (têm o id sorteado, mas apontam para a massa)
  delete from public.solicitacao_visitas where solicitacao_id in (select id from public.solicitacoes_pagamento where equipe_id::text like 'e5ca1a%');
  delete from public.solicitacoes_pagamento where equipe_id::text like 'e5ca1a%';
  -- logins de teste emprestados a pessoas que já existiam
  if to_regclass('public._escala_emprestimo') is not null then
    for r in execute 'select equipe_id, user_id from public._escala_emprestimo' loop
      update public.equipe set user_id = null where id = r.equipe_id and user_id = r.user_id;
    end loop;
    execute 'drop table public._escala_emprestimo';
  end if;
  drop table if exists public._escala_medidas;
  delete from auth.users where id::text like 'e5ca1a%';
end $$;
select pg_temp.limpar();

-- ================= pessoas =================
create table public._escala_emprestimo (equipe_id uuid, user_id uuid);
create temp table quem (perfil text primary key, equipe_id uuid, user_id uuid, uf text);
grant select on quem to authenticated, anon;
-- pessoa de função única: usa a que existe (empresta um login de teste, se não tiver) ou cria
create or replace function pg_temp.unica(p_perfil text, p_papel text, p_uf text, p_n int) returns void language plpgsql as $$
declare e public.equipe; u uuid := ('e5ca1a09-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid; ini date := (date_trunc('month', now()) - interval '14 months')::date;
begin
  set local session_replication_role = replica;
  select * into e from public.equipe where papel = p_papel and uf is not distinct from p_uf and status = 'ativa' limit 1;
  if e.id is null then
    insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em, municipio)
    values (('e5ca1a05-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid, p_papel, p_uf, 'Pessoa Escala ' || p_perfil, lpad((97000000000 + p_n)::text, 11, '0'),
            'escala.' || p_perfil || '@teste.invalid', ini, true, ini, ini, ini, 'Município 1') returning * into e;
  end if;
  if e.user_id is null then
    insert into auth.users (id, email) values (u, e.email::text);
    update public.equipe set user_id = u where id = e.id;
    if e.id::text not like 'e5ca1a%' then insert into public._escala_emprestimo values (e.id, u); end if;
    e.user_id := u;
  end if;
  insert into quem values (p_perfil, e.id, e.user_id, p_uf);
end $$;
select pg_temp.unica('coord_geral', 'coord_geral', null, 1);
select pg_temp.unica('coord_tecnico', 'coord_tecnico', null, 2);
select pg_temp.unica('auxiliar_adm', 'auxiliar_adm', null, 3);
select pg_temp.unica('art_' || u, 'articulacao', u, 10 + n::int), pg_temp.unica('apo_' || u, 'apoio', u, 20 + n::int)
  from unnest(array['AL','BA','PE','PI','SE']) with ordinality x(u, n);

-- ================= massa: unidades de volume u1..u2 =================
create or replace function pg_temp.massa(u1 int, u2 int) returns void language plpgsql as $$
declare ini date := (date_trunc('month', now()) - interval '14 months')::date; mes0 date := date_trunc('month', now())::date; hoje date := current_date;
        ufs text[] := array['AL','BA','PE','PI','SE']; n1 int := (u1 - 1) * 300 + 1; n2 int := u2 * 300; g uuid; tec uuid; aux uuid;
begin
  set local session_replication_role = replica;
  select equipe_id into g from quem where perfil = 'coord_geral'; select equipe_id into tec from quem where perfil = 'coord_tecnico';
  select equipe_id into aux from quem where perfil = 'auxiliar_adm';
  -- agentes: 6 por estado por unidade (id = e5ca1a05-...-<unidade:6><uf:1><n:1>) e 2 professores por unidade
  insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_assinado_em, municipio, telefone)
  select ('e5ca1a05-0000-4000-8000-' || lpad((u * 100 + k * 10 + a)::text, 12, '0'))::uuid, 'agente', ufs[k], 'Agente Escala ' || u || ' ' || ufs[k] || ' ' || a,
         lpad((96000000000 + u * 100 + k * 10 + a)::text, 11, '0'), 'escala.ag.' || u || '.' || k || '.' || a || '@teste.invalid', ini, true, ini, 'ESC' || u || k || a, ini, ini,
         'Município ' || (1 + a % 12), '(84) 99999-0000'
    from generate_series(u1, u2) u, generate_series(1, 5) k, generate_series(1, 6) a;
  insert into public.equipe (id, papel, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em)
  select ('e5ca1a05-0000-4000-8001-' || lpad((u * 10 + a)::text, 12, '0'))::uuid, 'professor_fic', 'Professor Escala ' || u || ' ' || a,
         lpad((95000000000 + u * 10 + a)::text, 11, '0'), 'escala.prof.' || u || '.' || a || '@teste.invalid', ini, true, ini, ini
    from generate_series(u1, u2) u, generate_series(1, 2) a;
  insert into auth.users (id, email) select ('e5ca1a09-0000-4000-8001-' || right(id::text, 12))::uuid, email::text from public.equipe
   where id::text like 'e5ca1a05-0000-4000-8000-%' and papel = 'agente' and right(id::text, 2) = '51' and split_part(email::text, '.', 3)::int between u1 and u2;
  update public.equipe e set user_id = ('e5ca1a09-0000-4000-8001-' || right(e.id::text, 12))::uuid
   where e.id::text like 'e5ca1a05-0000-4000-8000-%' and e.papel = 'agente' and right(e.id::text, 2) = '51' and split_part(e.email::text, '.', 3)::int between u1 and u2;
  if u1 = 1 then
    insert into auth.users (id, email) values ('e5ca1a09-0000-4000-8002-000000000011', 'escala.prof.1.1@teste.invalid');
    update public.equipe set user_id = 'e5ca1a09-0000-4000-8002-000000000011' where id = 'e5ca1a05-0000-4000-8001-000000000011';
  end if;

  -- fichas: por unidade, 200 selecionadas aprovadas, 60 em lista de espera (aprovadas) e 40 que não atendem (aguardando)
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, celular, endereco, ponto_referencia, nis, pessoas_familia, indicada_por,
      c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, p_sustento, p_cadunico, p_sem_ater,
      consent_dados, consent_imagem, resultado, posicao_espera, justificativa, foto_ficha_path, foto_termo_path, latitude, longitude, situacao, aprovada_por, aprovada_em,
      bolsista_id, data_ficha, criado_em, atualizado_em)
  select ('e5ca1a00-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, uf, 'Município ' || (1 + (i / 5) % 12), 'Comunidade ' || (1 + (i / 5) % 37),
         'Mulher Escala ' || i || ' da Silva Santos', lpad((80000000000 + i)::text, 11, '0'), date '1960-01-01' + (i % 14000), '(84) 9' || lpad((i % 100000000)::text, 8, '0'),
         'Sítio ' || i || ', zona rural, próximo à estrada vicinal', 'Depois da igreja, segunda porteira à direita', lpad((70000000000 + i)::text, 11, '0'), 1 + i % 9,
         'Associação comunitária local', true, true, true, r < 260, true, true, true, true, true, i % 2 = 0, i % 3 = 0, i % 4 = 0, true, i % 2 = 0,
         case when r < 200 then 'selecionada' when r < 260 then 'lista_espera' else 'nao_atende' end, case when r >= 200 and r < 260 then i end,
         'Atende aos critérios e tem quintal com espaço e água para a implantação do sistema produtivo.', uf || '/' || i || '/ficha.jpg', uf || '/' || i || '/termo.jpg',
         -9 + (i % 400) / 100.0, -38 + (i % 300) / 100.0, case when r < 260 then 'aprovada' else 'aguardando' end, case when r < 260 then tec end,
         case when r < 260 then now() - interval '11 months' end, (select q.equipe_id from quem q where q.perfil = 'art_' || x.uf), hoje - 340 + (i % 30), now() - interval '11 months' - (i % 30) * interval '1 day', now() - interval '10 months'
    from (select i, (i - 1) % 300 as r, 1 + (i - 1) / 300 as u, ufs[1 + i % 5] as uf from generate_series(n1, n2) i) x;

  -- visitas: 5 por quintal (as 10 últimas selecionadas de cada unidade só têm a visita de diagnóstico agendada)
  --   id = e5ca1a01-0000-4000-800<etapa>-<ficha>. Executor: agente da unidade e do estado.
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato, fotos, criado_por, criado_em, atualizado_em)
  select ('e5ca1a01-0000-4000-800' || e || '-' || lpad(i::text, 12, '0'))::uuid, ('e5ca1a00-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, uf,
         (array['diagnostico','implantacao','acompanhamento','acompanhamento','avaliacao'])[e],
         ('e5ca1a05-0000-4000-8000-' || lpad((u * 100 + (1 + i % 5) * 10 + case when r >= 190 then 1 else 1 + (i / 5) % 6 end)::text, 12, '0'))::uuid,
         dp, case when feita then dp end, case when feita then 'realizada' else 'prevista' end,
         case when feita and e in (2, 3, 4) then 'Visita feita com a família: canteiros conferidos, orientação sobre irrigação, cobertura do solo e controle de formigas. ' || i end,
         case when feita and e in (2, 3, 4) then array[uf || '/' || i || '/visita_' || e || '_1.jpg', uf || '/' || i || '/visita_' || e || '_2.jpg'] else '{}'::text[] end,
         (select q.equipe_id from quem q where q.perfil = 'art_' || x.uf), now() - interval '10 months', now() - interval '1 month'
    from (select *, r < 190 and dp <= hoje as feita from (select i, r, u, uf, e,
                 case when r >= 190 then hoje + 10 + (i % 20)
                      when e = 4 and (i / 5) % 6 = 0 then hoje            -- o 1º agente de cada estado tem visitas feitas hoje (mês atual: para a medida de "solicitar")
                      when e = 4 then hoje - 45 + (i % 40)
                      when e = 5 then hoje - 20 + (i % 50)
                      else hoje - 300 + e * 60 + (i % 50) end as dp
            from (select i, (i - 1) % 300 as r, 1 + (i - 1) / 300 as u, ufs[1 + i % 5] as uf from generate_series(n1, n2) i) y, generate_series(1, 5) e
           where r < 200 and (r < 190 or e = 1) and not (u = 1 and e = 5 and r < 5)) z) x;   -- na unidade 1 sobra espaço para 1 avaliação por estado (medida de inclusão)

  -- diagnósticos: 1 por quintal com visita feita (20% aguardando a coordenação)
  insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, codigo_quintal, latitude, longitude, area_m2, renda_familiar, renda_quintal, agua_seca, lote,
      mes_implantacao, dados, fotos, situacao, aprovado_por, aprovado_em, criado_em, atualizado_em, conteudo_alterado_por, conteudo_alterado_em)
  select ('e5ca1a02-0000-4000-8000-' || right(v.id::text, 12))::uuid, v.ficha_id, v.id, v.uf, v.executor_id, v.data_realizada, v.uf || '-' || right(v.id::text, 5),
         -9 + (n % 400) / 100.0, -38 + (n % 300) / 100.0, 120 + n % 400, 900 + n % 1500, n % 300, 'sim', 1 + n % 2, '2027-01',
         jsonb_build_object('kit', (select jsonb_agg(jsonb_build_object('item', 'Item do kit número ' || q, 'unidade', 'un', 'qtd', (1 + q)::text, 'valor', 40 + q * 7)) from generate_series(1, 9) q),
           'familia', jsonb_build_object('pessoas', 1 + n % 9, 'criancas', n % 4, 'idosos', n % 3, 'renda_principal', 'agricultura', 'beneficios', array['bolsa_familia','garantia_safra']),
           'agua', jsonb_build_object('fontes', array['cisterna_16','poco'], 'distancia_m', 30 + n % 200, 'meses_falta', n % 5, 'obs', 'Cisterna de placas em bom estado; poço amazonas salobro usado para os animais.'),
           'producao', jsonb_build_object('hortalicas', array['coentro','alface','cebolinha','tomate'], 'frutiferas', array['acerola','goiaba','mamão','limão'], 'animais', array['galinha','caprino'], 'vende', n % 2 = 0),
           'plano', jsonb_build_object('canteiros', 4 + n % 4, 'irrigacao', 'gotejamento', 'sombrite', n % 2 = 0, 'observacoes', repeat('Plano combinado com a família, com prioridade para hortaliças e frutíferas. ', 4))),
         array[v.uf || '/' || n || '/diag_quintal.jpg', v.uf || '/' || n || '/diag_agua.jpg', v.uf || '/' || n || '/diag_familia.jpg'],
         case when n % 5 = 0 then 'aguardando' else 'aprovado' end, case when n % 5 <> 0 then tec end, case when n % 5 <> 0 then now() - interval '8 months' end,
         now() - interval '9 months', now() - interval '8 months', v.executor_id, now() - interval '9 months'
    from (select v.*, right(v.id::text, 12)::bigint n from public.visitas v where v.id::text like 'e5ca1a01-0000-4000-8001-%' and right(v.id::text, 12)::bigint between n1 and n2 and v.situacao = 'realizada') v;

  -- avaliações (40% dos quintais com a visita de avaliação feita)
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, quintal_produz, ebia_pontos, ebia_nivel, dados, fotos, criado_em, atualizado_em)
  select ('e5ca1a03-0000-4000-8000-' || right(v.id::text, 12))::uuid, v.ficha_id, v.id, v.uf, v.executor_id, v.data_realizada, -9.1, -38.2, 'sim', n % 15, 'leve',
         jsonb_build_object('respostas', (select jsonb_object_agg('p' || q, (n + q) % 4) from generate_series(1, 30) q), 'depoimento', repeat('O quintal mudou a alimentação da família. ', 5)),
         array[v.uf || '/' || n || '/aval_1.jpg'], now() - interval '1 month', now() - interval '1 month'
    from (select v.*, right(v.id::text, 12)::bigint n from public.visitas v where v.id::text like 'e5ca1a01-0000-4000-8005-%' and right(v.id::text, 12)::bigint between n1 and n2 and v.situacao = 'realizada') v
   where n % 5 < 2;
  update public.visitas v set situacao = 'prevista', data_realizada = null
   where v.id::text like 'e5ca1a01-0000-4000-8005-%' and right(v.id::text, 12)::bigint between n1 and n2 and v.situacao = 'realizada'
     and not exists (select 1 from public.avaliacoes a where a.visita_id = v.id);

  -- pagamentos: 12 meses; ajuda de custo dos agentes (com as visitas do mês), bolsa das bolsistas e da coordenação (só na unidade 1)
  insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, relatorio, detalhe, situacao, solicitada_em, aval_por, aval_em, arlo_por, arlo_em, arlo_protocolo)
  select ('e5ca1a04-0000-4000-80' || lpad(m::text, 2, '0') || '-' || right(e.id::text, 12))::uuid, 'ajuda_custo', e.id, (mes0 - (m || ' months')::interval)::date, 380, 380, null,
         jsonb_build_object('total', 380, 'visitas', (select jsonb_agg(jsonb_build_object('visita', q, 'km', 22, 'horas', 4, 'total', 95)) from generate_series(1, 4) q)),
         case when m = 1 then 'solicitada' when m = 2 then 'avalizada' else 'lancada' end, mes0 - (m || ' months')::interval + interval '32 days',
         case when m > 1 then tec end, case when m > 1 then mes0 - (m || ' months')::interval + interval '34 days' end,
         case when m > 2 then aux end, case when m > 2 then mes0 - (m || ' months')::interval + interval '36 days' end, case when m > 2 then 'ARLO-' || m end
    from public.equipe e, generate_series(1, 12) m
   where e.id::text like 'e5ca1a05-0000-4000-8000-%' and e.papel = 'agente' and split_part(e.email::text, '.', 3)::int between u1 and u2;
  if u1 = 1 then
    insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, relatorio, detalhe, situacao, solicitada_em, aval_por, aval_em, arlo_por, arlo_em)
    select ('e5ca1a04-0000-4000-81' || lpad(m::text, 2, '0') || '-' || right(q.equipe_id::text, 12))::uuid, 'bolsa', q.equipe_id, (mes0 - (m || ' months')::interval)::date, 1400, 1400,
           repeat('Relatório do mês: reuniões com as agentes, acompanhamento das visitas, conferência das fichas e articulação com a prefeitura. ', 6), '{}',
           'lancada', mes0 - (m || ' months')::interval + interval '32 days', g, mes0 - (m || ' months')::interval + interval '33 days', g, mes0 - (m || ' months')::interval + interval '35 days'
      from quem q, generate_series(1, 12) m where q.perfil like 'art_%' or q.perfil like 'apo_%' or q.perfil in ('coord_tecnico', 'auxiliar_adm')
    on conflict do nothing;
  end if;
  -- cada visita feita em mês anterior entra no pedido do mês de quem fez (o mês atual fica livre para a medida de "solicitar")
  insert into public.solicitacao_visitas (visita_id, solicitacao_id)
  select v.id, s.id from public.visitas v join public.solicitacoes_pagamento s on s.equipe_id = v.executor_id and s.tipo = 'ajuda_custo' and s.mes = date_trunc('month', v.data_realizada)::date
   where v.id::text like 'e5ca1a01%' and right(v.id::text, 12)::bigint between n1 and n2 and v.situacao = 'realizada' and s.id::text like 'e5ca1a04%'
  on conflict do nothing;
  insert into public.custos_visita (visita_id, km_ida, definido_por, definido_em)
  select v.id, 5 + right(v.id::text, 6)::int % 60, tec, now() - interval '1 month' from public.visitas v
   where v.id::text like 'e5ca1a01%' and right(v.id::text, 12)::bigint between n1 and n2 and v.situacao = 'realizada' and right(v.id::text, 12)::bigint % 2 = 0;

  -- curso FIC: 2 turmas por unidade, 4 encontros por mês em 12 meses, presença de 15 pessoas por encontro
  insert into public.turmas_fic (id, nome, uf, inicio, professor_id, criado_em, atualizado_em)
  select ('e5ca1a06-0000-4000-8000-' || lpad((u * 10 + a)::text, 12, '0'))::uuid, 'Turma Escala ' || u || '-' || a, null, ini,
         ('e5ca1a05-0000-4000-8001-' || lpad((u * 10 + a)::text, 12, '0'))::uuid, now() - interval '12 months', now() - interval '12 months'
    from generate_series(u1, u2) u, generate_series(1, 2) a;
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em, criado_em)
  select ('e5ca1a06-0000-4000-8001-' || right(e.id::text, 12))::uuid, ('e5ca1a06-0000-4000-8000-' || lpad((split_part(e.email::text, '.', 3)::int * 10 + 1 + right(e.id::text, 1)::int % 2)::text, 12, '0'))::uuid,
         e.id, e.matricula_fic_numero, ini, now() - interval '12 months'
    from public.equipe e where e.id::text like 'e5ca1a05-0000-4000-8000-%' and e.papel = 'agente' and split_part(e.email::text, '.', 3)::int between u1 and u2;
  insert into public.fic_encontros (id, turma_id, professor_id, data, carga_horaria, modalidade, conteudo, criado_em, atualizado_em)
  select ('e5ca1a07-0000-4000-8' || lpad(w::text, 3, '0') || '-' || right(t.id::text, 12))::uuid, t.id, t.professor_id, hoje - w * 7, 4, (array['presencial','online','ava'])[1 + w % 3],
         'Encontro ' || w || ': agroecologia, manejo do solo, água no semiárido e planejamento do quintal produtivo.', now() - w * interval '7 days', now() - w * interval '7 days'
    from public.turmas_fic t, generate_series(1, 48) w where t.id::text like 'e5ca1a06-0000-4000-8000-%' and right(t.id::text, 12)::bigint / 10 between u1 and u2;
  insert into public.fic_presencas (id, encontro_id, equipe_id, presente, marcado_por, marcado_em, confirmado_em)
  select ('e5ca1a07-' || substr(md5(en.id::text || m.equipe_id::text), 1, 4) || '-4000-9000-' || substr(md5(en.id::text || m.equipe_id::text), 5, 12))::uuid, en.id, m.equipe_id,
         right(m.equipe_id::text, 1)::int % 4 <> 0, en.professor_id, en.criado_em, case when right(m.equipe_id::text, 1)::int % 4 <> 0 and right(m.equipe_id::text, 1)::int % 2 = 0 then en.criado_em end
    from public.fic_encontros en join public.matriculas_fic m on m.turma_id = en.turma_id
   where en.id::text like 'e5ca1a07%' and right(en.turma_id::text, 12)::bigint / 10 between u1 and u2 on conflict do nothing;

  -- passagens e eventos (30 por unidade), entregas do mês, acessos (6 meses), canais de venda, orientações e água
  insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, enviado_em, conferido_por, conferido_em, decidido_por, decidido_em, valor_autorizado, criado_em)
  select ('e5ca1a08-0000-4000-8000-' || lpad((u * 100 + p)::text, 12, '0'))::uuid, case when p % 3 = 0 then 'evento' else 'passagem' end, ufs[1 + p % 5],
         (select equipe_id from quem where perfil = 'art_' || ufs[1 + p % 5]), 'Pedido escala ' || u || '-' || p || ': intercâmbio entre quintais', hoje + 60,
         jsonb_build_object('valor_estimado', 900, 'finalidade', case when p % 2 = 0 then 'intercambio' else 'pedagogico' end, 'volta', hoje + 63,
           'passageiros', (select jsonb_agg(jsonb_build_object('nome', 'Passageira Escala ' || q, 'cpf', lpad((94000000000 + q)::text, 11, '0'), 'rg', '123456', 'nascimento', '1985-05-05')) from generate_series(1, 3) q)),
         case when p % 4 = 0 then 'enviado' when p % 4 = 1 then 'conferido' else 'recusado' end, now() - p * interval '5 days', tec, now(), g, now(), null, now() - p * interval '5 days'
    from generate_series(u1, u2) u, generate_series(1, 30) p;
  insert into public.entregas_mes (equipe_id, mes, item, marcado_por, marcado_em)
  select e.id, (mes0 - (m || ' months')::interval)::date, it, e.id, now() from public.equipe e, generate_series(1, 12) m, unnest(array['presenca','ava']) it
   where e.id::text like 'e5ca1a05-0000-4000-8000-%' and e.papel = 'agente' and split_part(e.email::text, '.', 3)::int between u1 and u2 on conflict do nothing;
  insert into public.acessos (equipe_id, em, tipo, aparelho, ip)
  select e.id, now() - (d || ' days')::interval - (h || ' hours')::interval, case when h = 1 then 'entrada' else 'abriu' end, 'Android · Chrome', '177.10.20.30'
    from public.equipe e, generate_series(0, 179) d, generate_series(1, 2) h
   where e.id::text like 'e5ca1a05-0000-4000-8000-%' and e.papel = 'agente' and split_part(e.email::text, '.', 3)::int between u1 and u2 and right(e.id::text, 1)::int <= 8;
  insert into public.canais_venda (id, uf, municipio, tipo, nome, detalhe, contato, criado_por, atualizado_por)
  select ('e5ca1a0a-0000-4000-8000-' || lpad((u * 100 + c)::text, 12, '0'))::uuid, ufs[1 + c % 5], 'Município ' || (1 + c % 12), (array['feira','grupo','merenda','paa','comprador','outro'])[1 + c % 6],
         'Canal escala ' || u || '-' || c, 'Toda sexta-feira, das 5h às 11h, na praça da matriz', '(84) 99999-0000', tec, tec from generate_series(u1, u2) u, generate_series(1, 50) c;
  insert into public.orientacoes_venda (id, ficha_id, uf, dados, feito_por, feito_em)
  select ('e5ca1a0b-0000-4000-8000-' || right(d.id::text, 12))::uuid, d.ficha_id, d.uf, '{"sobra": ["coentro", "ovos"], "caf": "sim", "canal": "feira", "obs": "Vende na feira do município aos sábados."}', d.executor_id, now() - interval '2 months'
    from public.diagnosticos d where d.id::text like 'e5ca1a02%' and right(d.id::text, 12)::bigint between n1 and n2;

  -- histórico: 30.000 linhas por unidade, com o antes e o depois de verdade (é o que pesa no disco)
  insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois)
  select 'fichas', f.id, case when k = 1 then 'INSERT' else 'UPDATE' end, tec, now() - (k * 17 + right(f.id::text, 3)::int) * interval '20 hours' / 20, case when k > 1 then to_jsonb(f) end, to_jsonb(f)
    from public.fichas f, generate_series(1, 20) k where f.id::text like 'e5ca1a00%' and right(f.id::text, 12)::bigint between n1 and n2;
  insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois)
  select 'visitas', v.id, case when k = 1 then 'INSERT' else 'UPDATE' end, v.executor_id, now() - (k * 23 + right(v.id::text, 3)::int) * interval '1 hour', case when k > 1 then to_jsonb(v) end, to_jsonb(v)
    from public.visitas v, generate_series(1, 16) k where v.id::text like 'e5ca1a01%' and right(v.id::text, 12)::bigint between n1 and n2;
  insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois)
  select 'diagnosticos', d.id, case when k = 1 then 'INSERT' else 'UPDATE' end, d.executor_id, now() - (k * 29 + right(d.id::text, 3)::int) * interval '1 hour', case when k > 1 then to_jsonb(d) end, to_jsonb(d)
    from public.diagnosticos d, generate_series(1, 16) k where d.id::text like 'e5ca1a02%' and right(d.id::text, 12)::bigint between n1 and n2;
  insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois)
  select 'solicitacoes_pagamento', s.id, case when k = 1 then 'INSERT' else 'UPDATE' end, s.equipe_id, s.solicitada_em + k * interval '1 day', case when k > 1 then to_jsonb(s) end, to_jsonb(s)
    from public.solicitacoes_pagamento s, generate_series(1, 14) k
   where s.id::text like 'e5ca1a04-0000-4000-80%' and split_part((select email::text from public.equipe e where e.id = s.equipe_id), '.', 3)::int between u1 and u2;
end $$;

-- ================= medidas =================
create temp table medidas (escala int, grupo text, perfil text, consulta text, linhas int, kb numeric, ms numeric, limite numeric, det text);
grant all on medidas to authenticated, anon;
-- leitura: a melhor de 3; conta as linhas e o tamanho em JSON (o que trafega até o aparelho)
create or replace function pg_temp.ler(p_escala int, p_grupo text, p_perfil text, p_consulta text, p_sql text) returns void language plpgsql as $$
declare t0 timestamptz; ms numeric; melhor numeric := 1e9; r int; n int; b bigint; u uuid; lim numeric := case when p_escala <= 1 then 100 else 500 end;
begin
  select user_id into u from quem where perfil = p_perfil;
  for r in 1..3 loop
    perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
    perform set_config('role', case when u is null then 'anon' else 'authenticated' end, true);
    t0 := clock_timestamp();
    execute 'select count(*), coalesce(sum(length(t)), 0) from (select to_jsonb(x)::text t from (' || p_sql || ') x) y' into n, b;
    ms := extract(epoch from clock_timestamp() - t0) * 1000;
    perform set_config('role', 'none', true);
    melhor := least(melhor, ms);
    exit when ms > 2000;   -- leitura muito lenta: uma vez basta
  end loop;
  insert into medidas values (p_escala, p_grupo, p_perfil, p_consulta, n, round(b / 1024.0, 1), round(melhor, 1), lim, null);
end $$;
-- gravação: executa como a pessoa, mede e DESFAZ (a melhor de 3). Recusa por regra também é medida (o gatilho rodou).
create or replace function pg_temp.gravar(p_escala int, p_perfil text, p_consulta text, p_sql text) returns void language plpgsql as $$
declare t0 timestamptz; ms numeric; melhor numeric := 1e9; r int; u uuid; msg text; lim numeric := case when p_escala <= 1 then 50 else 500 end;
begin
  select user_id into u from quem where perfil = p_perfil;
  for r in 1..3 loop
    begin
      perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
      perform set_config('role', 'authenticated', true);
      t0 := clock_timestamp(); execute p_sql; ms := extract(epoch from clock_timestamp() - t0) * 1000;
      perform set_config('role', 'none', true);
      raise exception 'DESFAZ';
    exception when others then
      if sqlerrm <> 'DESFAZ' then ms := extract(epoch from clock_timestamp() - t0) * 1000; msg := 'recusada: ' || left(sqlerrm, 90); end if;
    end;
    perform set_config('role', 'none', true);
    melhor := least(melhor, ms);
  end loop;
  insert into medidas values (p_escala, 'gravação', p_perfil, p_consulta, null, null, round(melhor, 1), lim, coalesce(msg, 'gravou'));
end $$;

create or replace function pg_temp.medir_tudo(k int) returns void language plpgsql as $$
declare p text; ag uuid; fd uuid; fa uuid; fn uuid; da uuid; vac uuid; mes0 date := date_trunc('month', now())::date; vis text; sid uuid; hoje date := (now() at time zone 'America/Fortaleza')::date;
        diag_dados text := $j${"kit": [{"item": "Tela", "qtd": "5", "valor": 400}, {"item": "Mangueira", "qtd": "2", "valor": 150}], "familia": {"pessoas": 5}, "plano": {"canteiros": 4}}$j$;
begin
  insert into quem select 'agente', id, user_id, 'SE' from public.equipe where id = 'e5ca1a05-0000-4000-8000-000000000151' on conflict do nothing;
  insert into quem select 'professor_fic', id, user_id, null from public.equipe where id = 'e5ca1a05-0000-4000-8001-000000000011' on conflict do nothing;
  insert into quem values ('público', null, null, null) on conflict do nothing;
  select equipe_id into ag from quem where perfil = 'agente';
  -- ---------- carga inicial (o que a tela lê ao entrar), por perfil ----------
  foreach p in array array['coord_geral', 'coord_tecnico', 'art_SE', 'agente', 'auxiliar_adm', 'professor_fic'] loop
    perform pg_temp.ler(k, 'carga', p, 'vincular_conta()', 'select public.vincular_conta()');
    perform pg_temp.ler(k, 'carga', p, 'equipe', 'select * from public.equipe order by criado_em');
    perform pg_temp.ler(k, 'carga', p, 'equipe_do_estado()', 'select * from public.equipe_do_estado()');
    perform pg_temp.ler(k, 'carga', p, 'visitas', 'select * from public.visitas order by data_prevista');
    perform pg_temp.ler(k, 'carga', p, 'diagnósticos', 'select * from public.diagnosticos order by data_visita desc');
    perform pg_temp.ler(k, 'carga', p, 'pagamentos', 'select * from public.solicitacoes_pagamento order by solicitada_em desc');
    perform pg_temp.ler(k, 'carga', p, 'visitas dos pagamentos', 'select * from public.solicitacao_visitas');
    perform pg_temp.ler(k, 'carga', p, 'testes', 'select * from public.testes_resultados');
    if p <> 'auxiliar_adm' then
      perform pg_temp.ler(k, 'carga', p, 'entregas do mês', 'select * from public.entregas_mes');
      perform pg_temp.ler(k, 'carga', p, 'ciências', 'select * from public.ciencias');
      perform pg_temp.ler(k, 'carga', p, 'encontros FIC + presenças', 'select e.*, (select coalesce(json_agg(pr), ''[]'') from public.fic_presencas pr where pr.encontro_id = e.id) presencas from public.fic_encontros e order by e.data desc');
    end if;
    if p in ('coord_geral', 'coord_tecnico', 'art_SE', 'agente') then
      perform pg_temp.ler(k, 'carga', p, 'fichas', 'select * from public.fichas order by criado_em desc');
      perform pg_temp.ler(k, 'carga', p, 'avaliações', 'select * from public.avaliacoes order by data_visita desc');
      perform pg_temp.ler(k, 'carga', p, 'canais de venda', 'select * from public.canais_venda order by uf, municipio');
      perform pg_temp.ler(k, 'carga', p, 'orientações de venda', 'select * from public.orientacoes_venda order by feito_em desc');
      perform pg_temp.ler(k, 'carga', p, 'custos das visitas', 'select visita_id, km_ida, obs, definido_em from public.custos_visita');
      perform pg_temp.ler(k, 'carga', p, 'parâmetros', 'select valor, atualizado_em from public.parametros where chave = ''custo_visita''');
    end if;
    if p in ('coord_geral', 'coord_tecnico', 'professor_fic') then
      perform pg_temp.ler(k, 'carga', p, 'turmas', 'select * from public.turmas_fic order by criado_em');
      perform pg_temp.ler(k, 'carga', p, 'matrículas', 'select * from public.matriculas_fic where cancelada_em is null order by criado_em');
      perform pg_temp.ler(k, 'carga', p, 'equipe_para_fic()', 'select * from public.equipe_para_fic()');
    end if;
    if p in ('coord_geral', 'coord_tecnico') then
      perform pg_temp.ler(k, 'carga', p, 'pré-cadastros', 'select * from public.pre_cadastros where situacao = ''aguardando'' order by enviado_em');
      perform pg_temp.ler(k, 'carga', p, 'água', 'select * from public.agua_situacoes order by registrado_em');
      perform pg_temp.ler(k, 'carga', p, 'exemplo (conta)', 'select count(*) from public.exemplo');
      perform pg_temp.ler(k, 'carga', p, 'situacao_bancaria()', 'select * from public.situacao_bancaria()');
    end if;
    if p in ('coord_geral', 'coord_tecnico', 'art_SE', 'auxiliar_adm') then
      perform pg_temp.ler(k, 'carga', p, 'quem_confere_pedidos()', 'select public.quem_confere_pedidos()');
      perform pg_temp.ler(k, 'carga', p, 'pedidos de passagem/evento', 'select * from public.pedidos_apoio order by enviado_em desc');
      perform pg_temp.ler(k, 'carga', p, 'saldo_passagens_eventos()', 'select public.saldo_passagens_eventos()');
    end if;
    if p = 'coord_geral' then
      perform pg_temp.ler(k, 'carga', p, 'histórico (200 últimos)', 'select * from public.auditoria order by em desc limit 200');
      perform pg_temp.ler(k, 'carga', p, 'acessos (500 últimos)', 'select * from public.acessos order by em desc limit 500');
      perform pg_temp.ler(k, 'carga', p, 'documentos', 'select * from public.documentos_projeto order by data_documento desc');
      perform pg_temp.ler(k, 'carga', p, 'planilhas da execução', 'select * from public.execucao_planilhas order by posicao_em desc, enviado_em desc');
      perform pg_temp.ler(k, 'carga', p, 'perfis da equipe', 'select equipe_id, perfil from public.equipe_privado');
      perform pg_temp.ler(k, 'carga', p, 'pedidos de novo acesso', 'select * from public.pedidos_novo_acesso where situacao = ''aguardando'' order by pedido_em');
      perform pg_temp.ler(k, 'carga', p, 'fotos da vitrine', 'select * from public.vitrine_fotos order by publicada_em desc');
    end if;
  end loop;
  -- ---------- abas e funções de leitura ----------
  perform pg_temp.ler(k, 'aba', 'público', 'vitrine()', 'select public.vitrine()');
  perform pg_temp.ler(k, 'aba', 'público', 'vitrine_municipios()', 'select public.vitrine_municipios()');
  perform pg_temp.ler(k, 'aba', 'público', 'ver_convite()', 'select public.ver_convite(''nao-existe'')');
  perform pg_temp.ler(k, 'aba', 'coord_tecnico', 'pendencias_campo(agente)', format('select public.pendencias_campo(%L)', ag));
  perform pg_temp.ler(k, 'aba', 'agente', 'pendencias_campo(eu)', format('select public.pendencias_campo(%L)', ag));
  perform pg_temp.ler(k, 'aba', 'agente', 'meus_dados_bancarios()', 'select public.meus_dados_bancarios()');
  perform pg_temp.ler(k, 'aba', 'coord_geral', 'dados pessoais de uma pessoa', format('select * from public.equipe_privado where equipe_id = %L', ag));

  -- ---------- gravações (com todos os gatilhos; desfeitas depois de medir) ----------
  select id into fd from public.fichas where id::text like 'e5ca1a00%' and uf = 'SE' and resultado = 'nao_atende' and situacao = 'aguardando' order by id limit 1;
  select id into fa from public.fichas where id::text like 'e5ca1a00%' and uf = 'SE' and resultado = 'selecionada' and situacao = 'aprovada' order by id limit 1;
  perform pg_temp.gravar(k, 'art_SE', 'ficha: incluir', format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua,
      c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
    values ('e5ca1a00-ffff-4000-8000-000000000001', 'SE', 'Município 1', 'Comunidade 1', 'Mulher Escala Nova', '80999999915', '1980-01-01', 'Sítio novo', true, true, true, true, true, true, true, true, true, true, 'selecionada', %L)$q$, hoje));
  perform pg_temp.gravar(k, 'art_SE', 'ficha: alterar', format('update public.fichas set celular = ''(79) 98888-7777'', ponto_referencia = ''Ao lado da escola'' where id = %L', fd));
  perform pg_temp.gravar(k, 'coord_tecnico', 'ficha: aprovar (não entra no limite)', format('update public.fichas set situacao = ''aprovada'' where id = %L', fd));
  perform pg_temp.gravar(k, 'coord_geral', 'ficha: aprovar selecionada (conta o limite de 40)',
    format('update public.fichas set resultado = ''selecionada'', c_agua = true, situacao = ''aprovada'' where id = %L', fd));
  -- visita: avaliação de um quintal de SE que ainda não tem (na unidade 1 cabe; depois o estado já passou dos 200 dias e a recusa é o que se mede)
  select f.id into fn from public.fichas f where f.id::text like 'e5ca1a00%' and f.uf = 'SE'
     and exists (select 1 from public.visitas v where v.ficha_id = f.id and v.etapa = 'implantacao' and v.situacao = 'realizada')
     and not exists (select 1 from public.visitas v where v.ficha_id = f.id and v.etapa = 'avaliacao') order by f.id limit 1;
  perform pg_temp.gravar(k, 'art_SE', 'visita: agendar (conta o limite de 200 dias)', format($q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista)
    values ('e5ca1a01-ffff-4000-8000-000000000001', %L, 'SE', 'avaliacao', %L, %L)$q$, fn, ag, hoje + 5));
  select v.id into vac from public.visitas v where v.executor_id = ag and v.etapa = 'acompanhamento' and v.situacao = 'realizada'
     and v.data_realizada >= mes0 order by v.id limit 1;
  perform pg_temp.gravar(k, 'agente', 'visita: alterar o relato', format('update public.visitas set relato = ''Relato corrigido: visita feita com a família, canteiros conferidos e orientações dadas.'' where id = %L', vac));
  -- diagnóstico: quintal do agente com a visita de diagnóstico agendada
  select v.id, v.ficha_id into vac, fn from public.visitas v where v.executor_id = ag and v.etapa = 'diagnostico' and v.situacao = 'prevista' order by v.id limit 1;
  perform pg_temp.gravar(k, 'agente', 'diagnóstico: incluir (marca a visita como feita)', format($q$insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, area_m2, agua_seca, lote, dados)
    values ('e5ca1a02-ffff-4000-8000-000000000001', %L, %L, 'SE', %L, -10.5, -37.2, 200, 'sim', 1, %L)$q$, fn, vac, hoje, diag_dados));
  select d.id into da from public.diagnosticos d where d.executor_id = ag and d.situacao = 'aguardando' order by d.id limit 1;
  perform pg_temp.gravar(k, 'agente', 'diagnóstico: alterar', format('update public.diagnosticos set area_m2 = 333, dados = dados || ''{"obs": "corrigido"}'' where id = %L', da));
  perform pg_temp.gravar(k, 'coord_tecnico', 'diagnóstico: aprovar', format('update public.diagnosticos set situacao = ''aprovado'' where id = %L', da));
  -- pagamento: ajuda de custo do mês atual com as visitas feitas neste mês; aval; lançamento no Arlo
  select string_agg(quote_literal(v.id), ',') into vis from (select v.id from public.visitas v where v.executor_id = ag and v.situacao = 'realizada' and v.data_realizada >= mes0
     and not exists (select 1 from public.solicitacao_visitas sv where sv.visita_id = v.id) order by v.id limit 3) v;
  if vis is not null then
    perform pg_temp.gravar(k, 'agente', 'pagamento: solicitar ajuda de custo', format('select public.solicitar_pagamento(''ajuda_custo'', %L, 150, null, array[%s]::uuid[], ''{"total": 150}'')', mes0, vis));
  end if;
  select s.id into sid from public.solicitacoes_pagamento s where s.equipe_id = ag and s.situacao = 'solicitada' limit 1;
  perform pg_temp.gravar(k, 'coord_tecnico', 'pagamento: dar o aval', format('select public.avalizar_pagamento(%L, true, null, 380)', sid));
  perform pg_temp.gravar(k, 'coord_tecnico', 'pagamento: devolver (solta as visitas)', format('select public.avalizar_pagamento(%L, false, ''Corrija o km da segunda visita'', null)', sid));
  select s.id into sid from public.solicitacoes_pagamento s where s.equipe_id = ag and s.situacao = 'avalizada' limit 1;
  perform pg_temp.gravar(k, 'auxiliar_adm', 'pagamento: lançar no Arlo', format('select public.registrar_no_arlo(%L, ''ARLO-ESCALA'')', sid));
  perform pg_temp.gravar(k, 'agente', 'registrar_acesso()', 'select public.registrar_acesso(''entrada'', ''Android'')');
end $$;

-- ================= execução: cada escala pedida, em ordem crescente =================
create temp table _passos as select row_number() over (order by k) n, k, coalesce(lag(k) over (order by k), 0) ant
  from (select distinct trim(x)::int k from unnest(string_to_array(current_setting('escala.lista'), ',')) x) y;
select format('select pg_temp.massa(%s, %s)', ant + 1, k), 'analyze', format('select pg_temp.medir_tudo(%s)', k) from _passos order by n \gexec

\pset tuples_only off
\pset format aligned
\echo
\echo ===== volume em cada escala =====
select (select max(k) from _passos) as escala_final, (select count(*) from public.fichas) fichas, (select count(*) from public.visitas) visitas, (select count(*) from public.diagnosticos) diagnosticos,
       (select count(*) from public.solicitacoes_pagamento) pagamentos, (select count(*) from public.auditoria) historico, (select count(*) from public.equipe) equipe,
       pg_size_pretty(pg_database_size(current_database())) banco;
\echo
\echo ===== o que trafega na carga inicial, por perfil e escala (MB em JSON) =====
select escala, perfil, count(*) leituras, sum(linhas) linhas, round(sum(kb) / 1024, 2) mb, round(sum(ms), 1) ms_somados from medidas where grupo = 'carga' group by 1, 2 order by 1, 5 desc;
\echo
\echo ===== todas as medidas (PASSOU: dentro do limite da escala) =====
select escala, grupo, perfil, consulta, linhas, kb, ms, limite, case when ms <= limite then 'PASSOU' else 'FALHOU' end as r, det from medidas order by escala, ms desc;
\pset tuples_only on
\pset format unaligned
select case when count(*) filter (where ms > limite) = 0 then 'PASSOU' else 'FALHOU' end || ' | desempenho em escala: ' || count(*) filter (where ms <= limite) || ' de ' || count(*)
       || ' medidas dentro do limite (1×: leitura 100 ms, gravação 50 ms; demais: 500 ms); pior: ' || max(ms) || ' ms' from medidas;
select 'FALHOU | ' || escala || '× | ' || perfil || ' | ' || consulta || ' | ' || ms || ' ms (limite ' || limite || ')' from medidas where ms > limite order by escala, ms desc;
\if :manter
  drop table if exists public._escala_medidas;
  create table public._escala_medidas as select * from medidas;
  \echo (massa mantida no banco: apague com uma nova execução sem -v manter=1)
\else
  select pg_temp.limpar();
\endif
