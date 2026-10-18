-- =====================================================================
-- Mulheres & Quintais — 95: SIMULAÇÃO DO PROJETO COMPLETO (dados FICTÍCIOS em todas as abas, no limite do plano)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 63.
--
-- PARA QUE SERVE: ver e testar o sistema como ele fica no FIM do projeto (setembro de 2027), com todas as abas cheias:
--   equipe completa (coord. técnica, auxiliar, 2 professores do FIC, 2 bolsistas e 2 agentes por estado, 1 desligada),
--   300 fichas (por estado: 40 selecionadas, 10 na lista de espera, 4 sem água, 3 não atendem, 2 aguardando, 1 devolvida),
--   1.000 visitas feitas (as 200 por estado: diagnóstico, implantação, 2 acompanhamentos e avaliação de cada quintal),
--   200 diagnósticos com plano aprovado, 200 avaliações finais, km de cada visita, bolsas e ajudas de custo de 12 meses
--   (pedido, aval e Arlo), entregas do mês, 2 turmas do curso FIC com encontros semanais e presença, passagens e eventos,
--   documentos, planilha de gastos, acesso à água, canais de venda, arranjos produtivos (APL) de cada município, acompanhamento do MDA e do MPA, acessos, relatos
--   de problema, convites e o histórico de tudo isso.
--
-- ATENÇÃO, LEIA ANTES:
--   1. O IDEAL é rodar num projeto Supabase SEPARADO, de teste (cópia com 01 a 63), e não no projeto em uso.
--   2. Por segurança, o script PARA (sem mudar nada) se já houver equipe ou fichas de verdade, ou dados de exemplo.
--      Se você rodou o 05_dados_exemplo.sql, rode antes o 96_apagar_simulacao.sql.
--   3. As datas vão até setembro de 2027 (o fim do projeto). Como hoje ainda é 2026, telas que comparam com "hoje"
--      (prazos, "atrasada", cronograma) vão mostrar visitas e pagamentos "no futuro". É uma simulação de volume e de tela.
--   4. Ninguém da equipe fictícia consegue entrar (e-mails @exemplo.invalid, sem login). Você vê tudo como coordenação
--      geral e usa "Ver como o MDA vê / o MPA vê". Fotos e arquivos não existem de verdade: miniaturas e downloads falham.
--   5. Tudo fica anotado na tabela public.exemplo: some da vitrine pública e sai inteiro com o 96_apagar_simulacao.sql.
--   6. A vitrine pública e quem acompanha DE VERDADE (MDA, MPA) não contam dados de exemplo. Na sua prévia
--      "Ver como o MDA vê / o MPA vê" eles entram (com o 64_previa_com_simulacao.sql instalado).
-- =====================================================================

do $sim$
declare
  cg uuid := (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
  tec uuid; aux uuid; prof1 uuid; prof2 uuid; t1 uuid; t2 uuid;
  ufs text[] := array['AL','BA','PE','PI','SE'];
  nomes text[] := array['Maria','Francisca','Antônia','Raimunda','Josefa','Rita','Ana','Luzia','Edileuza','Cícera','Marinalva','Gilvânia','Rosilene','Joelma','Valdirene',
    'Aparecida','Damiana','Lucineide','Jucileide','Erivânia','Adriana','Elisângela','Terezinha','Sebastiana','Domingas','Joana','Iraci','Neide','Rosângela','Edilene',
    'Vera Lúcia','Marlene','Socorro','Conceição','Givanilda','Eliane','Cleonice','Zuleide','Genilda','Jacira','Maria do Socorro','Maria da Conceição','Maria José','Ana Paula'];
  sobre text[] := array['Silva','Santos','Oliveira','Souza','Pereira','Lima','Alves','Ferreira','Rodrigues','Costa','Gomes','Nascimento','Araújo','Barbosa','Ribeiro',
    'Carvalho','Rocha','Almeida','Batista','Moura','Nunes','Dias','Cavalcante','Bezerra','Leite','Macêdo','Feitosa','Sampaio','Vieira','Freitas','Monteiro','Brito'];
  comunid text[] := array['Sítio Lagoa do Mato','Comunidade Baixa Verde','Assentamento Santa Rita','Sítio Caldeirão','Povoado Barra','Comunidade Quilombola Tapuio',
    'Sítio Olho d''Água','Assentamento Novo Horizonte','Comunidade Serra Branca','Sítio Riacho Fundo','Povoado Malhada Grande','Comunidade São Bento',
    'Sítio Várzea Comprida','Assentamento Terra Livre','Comunidade Lagoa Seca','Sítio Pedra Branca','Assentamento Margarida Alves'];
  kit jsonb := '[{"item":"Caixa d''água 1.000 L","qtd":"1","para":"reservar água para irrigar","valor":650},{"item":"Kit de gotejamento","qtd":"1","para":"irrigação econômica","valor":890},
    {"item":"Tela de sombreamento 50%","qtd":"30 m²","para":"proteger os canteiros do sol","valor":14},{"item":"Sementes de hortaliças","qtd":"10 pacotes","para":"plantio dos canteiros","valor":18},
    {"item":"Mudas frutíferas","qtd":"10","para":"pomar do quintal","valor":35},{"item":"Esterco curtido","qtd":"20 sacos","para":"adubação","valor":20},
    {"item":"Ferramentas manuais","qtd":"1 kit","para":"preparo do solo","valor":520},{"item":"Tela para galinheiro","qtd":"25 m","para":"criação de galinhas","valor":24},
    {"item":"Regador e mangueira","qtd":"1","para":"irrigação","valor":230}]';
  u text; k int; i int; j int; n int; mid uuid; fid uuid; vid uuid; did uuid; sid uuid; mun record; dd date; di date; a1 date; a2 date; av date;
  art uuid; apo uuid; ag1 uuid; ag2 uuid; campo uuid[]; quem uuid; nm text; nasc date; df date; menor boolean; pb int; pf int; mes date;
  bolsistas uuid[] := '{}'; todos_campo uuid[] := '{}'; ncpf bigint := 61000000000; fcpf bigint := 62000000000;
begin
  if to_regclass('public.exemplo') is null or to_regclass('public.avaliacoes') is null or to_regclass('public.relatos_problema') is null
     or not exists (select 1 from pg_proc where proname = 'campo_arquivo_livre') then
    raise exception 'Falta instalar etapas anteriores (até o 63_auditoria_1410.sql). Nada mudou.';
  end if;
  if exists (select 1 from public.equipe where papel <> 'coord_geral' and id not in (select id from public.exemplo)) then
    raise exception 'Já há equipe cadastrada de verdade: a simulação NÃO foi colocada (nada mudou). Use um projeto Supabase de teste.';
  end if;
  if exists (select 1 from public.fichas where id not in (select id from public.exemplo)) then
    raise exception 'Já há fichas de verdade: a simulação NÃO foi colocada (nada mudou). Use um projeto Supabase de teste.';
  end if;
  -- 66: produção ainda no começo (sem fichas) também é protegida: documentos, planilhas, acompanhamento, canais ou pedidos de verdade param a simulação
  if exists (select 1 from public.documentos_projeto where id not in (select id from public.exemplo))
     or exists (select 1 from public.execucao_planilhas where id not in (select id from public.exemplo))
     or exists (select 1 from public.observadores where id not in (select id from public.exemplo))
     or exists (select 1 from public.canais_venda where id not in (select id from public.exemplo))
     or exists (select 1 from public.pedidos_apoio where id not in (select id from public.exemplo)) then
    raise exception 'Este banco já tem registros de verdade (documentos, planilhas, acompanhamento, canais ou pedidos): a simulação NÃO foi colocada (nada mudou). Use um projeto Supabase de teste.';
  end if;
  if exists (select 1 from public.exemplo) then
    raise exception 'Já há dados de exemplo no banco. Rode antes o 96_apagar_simulacao.sql (nada mudou).';
  end if;
  if not exists (select 1 from public.equipe where papel = 'coord_geral' and status = 'ativa') then
    raise exception 'Cadastre antes a coordenação geral (01_criar_banco.sql). Nada mudou.';
  end if;

  -- as regras do sistema (gatilhos) ficam desligadas só durante a carga: as datas vão até 2027 e as aprovações entram prontas
  alter table public.equipe disable trigger user;            alter table public.equipe_privado disable trigger user;
  alter table public.equipe_bancario disable trigger user;   alter table public.fichas disable trigger user;
  alter table public.visitas disable trigger user;           alter table public.diagnosticos disable trigger user;
  alter table public.avaliacoes disable trigger user;        alter table public.custos_visita disable trigger user;
  alter table public.solicitacoes_pagamento disable trigger user; alter table public.solicitacao_visitas disable trigger user;
  alter table public.entregas_mes disable trigger user;      alter table public.turmas_fic disable trigger user;
  alter table public.matriculas_fic disable trigger user;    alter table public.fic_encontros disable trigger user;
  alter table public.fic_presencas disable trigger user;     alter table public.pedidos_apoio disable trigger user;
  alter table public.documentos_projeto disable trigger user; alter table public.execucao_planilhas disable trigger user;
  alter table public.agua_situacoes disable trigger user;    alter table public.canais_venda disable trigger user;
  alter table public.orientacoes_venda disable trigger user; alter table public.observadores disable trigger user;
  alter table public.relatos_problema disable trigger user;  alter table public.convites disable trigger user;
  alter table public.pre_cadastros disable trigger user;     alter table public.vitrine_fotos disable trigger user;
  alter table public.auditoria disable trigger user;         alter table public.acessos disable trigger user;

  create temp table _mun (uf text, nome text, lon numeric, lat numeric) on commit drop;
  insert into _mun values
  ('AL', 'Estrela de Alagoas', -36.7644, -9.3909), ('AL', 'Cacimbinhas', -36.9911, -9.4012), ('AL', 'Palmeira dos Índios', -36.6328, -9.4057),
  ('BA', 'Juazeiro', -40.5008, -9.4167), ('BA', 'Remanso', -42.0848, -9.6219), ('BA', 'Pilão Arcado', -42.4936, -10.0051), ('BA', 'Sento Sé', -41.8786, -9.7419),
  ('BA', 'Casa Nova', -40.9739, -9.1621), ('BA', 'Campo Alegre de Lourdes', -43.0126, -9.5222), ('BA', 'Uauá', -39.4790, -9.8414), ('BA', 'Curaçá', -39.9097, -8.9846),
  ('PE', 'Ouricuri', -40.0816, -7.8792), ('PE', 'Araripina', -40.4983, -7.5707), ('PE', 'Exu', -39.7243, -7.5125), ('PE', 'Bodocó', -39.9333, -7.7783), ('PE', 'Trindade', -40.2647, -7.7590),
  ('PI', 'Picos', -41.4669, -7.0769), ('PI', 'São Raimundo Nonato', -42.6997, -9.0154), ('PI', 'Paulistana', -41.1431, -8.1343), ('PI', 'Simões', -40.8137, -7.5986),
  ('PI', 'Pio IX', -40.6083, -6.8366), ('PI', 'Fronteiras', -40.6146, -7.0817), ('PI', 'Jaicós', -41.1371, -7.3623), ('PI', 'Oeiras', -42.1286, -7.0191),
  ('PI', 'Itainópolis', -41.4687, -7.4433), ('PI', 'Massapê do Piauí', -41.1103, -7.4747),
  ('SE', 'Poço Redondo', -37.6833, -9.8061), ('SE', 'Porto da Folha', -37.2775, -9.9172), ('SE', 'Canindé de São Francisco', -37.7897, -9.6422);
  -- (se o nome de algum município do mapa mudar em js/geo.js, a ficha só deixa de aparecer como ponto no mapa)

  create or replace function pg_temp.pick(a text[]) returns text language sql volatile as $f$ select a[1 + floor(random() * array_length(a, 1))::int] $f$;
  create or replace function pg_temp.entre(a date, b date) returns date language sql volatile as $f$ select case when b <= a then a else a + floor(random() * (b - a + 1))::int end $f$;
  create or replace function pg_temp.cpf(n bigint) returns text language sql immutable as $f$
    with a as (select substr(lpad(n::text, 11, '0'), 1, 3) || substr(lpad(n::text, 11, '0'), 6, 6) as b),
         b as (select b || ((((select sum(substr(b, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10) % 11) % 10)::text as c from a)
    select c || ((((select sum(substr(c, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10) % 11) % 10)::text from b $f$;
  create or replace function pg_temp.ebia(p int, menor boolean) returns text language sql immutable as $f$
    select case when p = 0 then 'seguranca' when p <= case when menor then 5 else 3 end then 'leve'
                when p <= case when menor then 9 else 5 end then 'moderada' else 'grave' end $f$;

  perform setseed(0.2610);

  -- ---------- equipe ----------
  create temp table _eq (id uuid, papel text, uf text, nome text) on commit drop;
  insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd, status,
                             matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_path, termo_assinado_em, cadastro_arlo, criado_por, criado_em, foto_path)
  select gen_random_uuid(), p.papel, p.uf, p.nome, pg_temp.cpf(ncpf + p.n), lower(translate(split_part(p.nome, ' ', 1) || '.' || p.n, 'áâãéêíóôõúçÁÉÍÓÚ', 'aaaeeiooouc')) || '@exemplo.invalid',
         '(87) 9' || (8000 + p.n) || '-' || (1000 + p.n * 7), coalesce((select nome from _mun where uf = p.uf order by random() limit 1), 'Apodi/RN'),
         case when p.uf is null then case when p.papel in ('professor_fic','auxiliar_adm') then 'IFRN' else 'MPA – coordenação nacional' end else pg_temp.pick(array['MPA','MPA – regional','Associação de Mulheres Rurais','Sindicato dos Trabalhadores Rurais']) end,
         case when p.papel = 'auxiliar_adm' then date '2026-09-14' else date '2026-10-01' end, true, 'ativa',
         case when p.papel in ('coord_tecnico','articulacao','apoio','agente') then date '2026-10-06' end, case when p.papel in ('coord_tecnico','articulacao','apoio','agente') then '2026' || (1000000 + p.n * 37) end,
         date '2026-10-08', 'exemplo/termo_' || p.n || '.pdf', date '2026-10-08', true, cg, timestamptz '2026-10-01 09:00-03' + p.n * interval '7 minutes',
         'exemplo:' || (1 + p.n % 18)
    from (select row_number() over () as n, x.* from (
            select 'coord_tecnico' papel, null::text uf, 'Rosângela Feitosa Lima' nome union all
            select 'auxiliar_adm', null, 'Marcos Vinícius Holanda' union all
            select 'professor_fic', null, 'Luciana Sampaio Brito' union all
            select 'professor_fic', null, 'Jorge Henrique Tavares' union all
            select pp.papel, uu.uf, pg_temp.pick(nomes) || ' ' || pg_temp.pick(sobre) || ' ' || pg_temp.pick(sobre)
              from unnest(array['AL','BA','PE','PI','SE']) uu(uf) cross join (values ('articulacao', 1), ('apoio', 2), ('agente', 3), ('agente', 4)) pp(papel, o)
          ) x) p;
  insert into _eq select id, papel, uf, nome from public.equipe where email like '%@exemplo.invalid';
  insert into public.exemplo (tabela, id) select 'equipe', id from _eq;
  select id into tec from _eq where papel = 'coord_tecnico'; select id into aux from _eq where papel = 'auxiliar_adm';
  select id into prof1 from _eq where papel = 'professor_fic' order by nome limit 1; select id into prof2 from _eq where papel = 'professor_fic' and id <> prof1;
  update public.equipe set meta_diagnosticos = 20, meta_quintais = 20, meta_visitas = 40 where id in (select id from _eq where papel in ('articulacao','apoio'));
  -- uma agente desligada (substituída) no PI: aparece no histórico da equipe
  insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, data_fim, motivo_desligamento, consentimento_lgpd, status, criado_por, criado_em)
  values (gen_random_uuid(), 'agente', 'PI', 'Damiana Rocha Nunes', pg_temp.cpf(ncpf + 99), 'damiana.99@exemplo.invalid', '(89) 98877-1100', 'Picos', 'MPA', date '2026-10-01', date '2026-11-30',
          'Mudou de cidade', true, 'desligada', cg, timestamptz '2026-10-01 10:00-03') returning id into mid;
  insert into public.exemplo values ('equipe', mid);
  update public.equipe set substitui_id = mid where id = (select id from _eq where papel = 'agente' and uf = 'PI' order by nome limit 1);

  insert into public.equipe_privado (equipe_id, data_nascimento, nis, endereco, socioeconomico, perfil)
  select e.id, date '1975-01-01' + floor(random() * 9000)::int, lpad((10000000000 + floor(random() * 89999999999))::bigint::text, 11, '0'),
         jsonb_build_object('logradouro', 'Rua ' || pg_temp.pick(sobre), 'numero', (10 + floor(random() * 500))::int::text, 'bairro', 'Centro', 'cidade', coalesce(e.uf, 'RN'), 'cep', '59700000'),
         jsonb_build_object('escolaridade', pg_temp.pick(array['medio','superior','tecnico']), 'raca', pg_temp.pick(array['parda','preta','branca','indigena'])),
         case when e.papel in ('coord_tecnico','articulacao','apoio','agente') then jsonb_build_object('agricultora', random() < .7, 'atua_mulheres', true, 'mora_rural', random() < .6,
              'internet', random() < .9, 'outra_bolsa', random() < .1, 'experiencia', pg_temp.pick(array['ate2','3a5','mais5','nenhuma'])) end
    from _eq e;
  insert into public.equipe_bancario (equipe_id, banco_codigo, banco_nome, agencia, conta, conta_dv, tipo_conta, pix_tipo, pix_chave)
  select e.id, '001', 'Banco do Brasil', (1000 + floor(random() * 8000))::int::text, (10000 + floor(random() * 80000))::int::text, (floor(random() * 10))::int::text, 'corrente', 'cpf', q.cpf
    from _eq e join public.equipe q on q.id = e.id where e.papel <> 'professor_fic' or random() < 2;

  -- ---------- fichas ----------
  create temp table _f (id uuid, uf text, mun text, lon numeric, lat numeric, nome text, sel boolean, bolsista uuid, ordem int) on commit drop;
  foreach u in array ufs loop
    select id into art from _eq where papel = 'articulacao' and uf = u; select id into apo from _eq where papel = 'apoio' and uf = u;
    for k in 1..60 loop
      select * into mun from _mun where uf = u order by random() limit 1;
      nm := pg_temp.pick(nomes) || ' ' || pg_temp.pick(sobre) || ' ' || pg_temp.pick(sobre);
      df := pg_temp.entre(date '2026-10-05', date '2026-11-20');
      nasc := df - (19 + floor(random() * 50))::int * 365 - floor(random() * 300)::int;
      fid := gen_random_uuid(); fcpf := fcpf + 13;
      insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, celular, endereco, ponto_referencia, nis, pessoas_familia, indicada_por,
          c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao,
          p_sustento, p_cadunico, p_sem_ater, p_raca_povo, p_jovem, p_grupo, p_caf, consent_dados, consent_imagem, consent_criancas, assinatura,
          resultado, posicao_espera, encaminhada_para, justificativa, foto_ficha_path, foto_termo_path, latitude, longitude, situacao, aprovada_por, aprovada_em, obs_coordenacao,
          bolsista_id, data_ficha, criado_em, atualizado_em)
      values (fid, u, mun.nome, pg_temp.pick(comunid), nm, pg_temp.cpf(fcpf), nasc, '(87) 9' || (8100 + k) || '-' || (2000 + k * 11),
          pg_temp.pick(array['Sítio','Rua','Travessa','Estrada']) || ' ' || pg_temp.pick(sobre) || ', ' || (1 + floor(random() * 350))::int,
          pg_temp.pick(array['Perto da escola','Ao lado da igreja','Depois da cisterna comunitária','Casa de muro azul']),
          case when random() < .7 then lpad((10000000000 + floor(random() * 89999999999))::bigint::text, 11, '0') end, 1 + floor(random() * 7)::int,
          pg_temp.pick(array['Associação comunitária','Sindicato','MPA','Agente de saúde','Grupo de mulheres']),
          true, true, k not in (55, 56), k not between 51 and 54, k <> 57, k <> 58, true, true, true,
          random() < .55, random() < .75, random() < .6, random() < .7, nasc > df - 30 * 365, random() < .4, random() < .5, true, random() < .9, random() < .3, 'assinatura',
          case when k <= 40 or k between 59 and 60 then 'selecionada' when k <= 50 then 'lista_espera' when k <= 54 then 'sem_agua' when k <= 58 then 'nao_atende' else 'lista_espera' end,
          case when k between 41 and 50 then k - 40 end,
          case when k between 51 and 54 then 'Programa Cisternas (ASA) – ' || mun.nome end,
          case when k between 51 and 54 then 'Sem água que dure no período seco' when k between 55 and 58 then 'Não atende a critério obrigatório' end,
          'exemplo/ficha_' || k || '.jpg', 'exemplo/termo_' || k || '.jpg', round(mun.lat + (random()::numeric - .5) * .12, 6), round(mun.lon + (random()::numeric - .5) * .12, 6),
          case when k = 59 then 'aguardando' when k = 60 then 'devolvida' else 'aprovada' end,
          case when k < 59 then tec end, case when k < 59 then (df + 3)::timestamp + interval '10 hours' end,
          case when k = 60 then 'A foto do termo ficou cortada: fotografe de novo.' end,
          case when k % 2 = 0 then art else apo end, df, df::timestamp + interval '9 hours', df::timestamp + interval '11 hours');
      insert into _f values (fid, u, mun.nome, mun.lon, mun.lat, nm, k <= 40, case when k % 2 = 0 then art else apo end, k);
    end loop;
  end loop;
  insert into public.exemplo (tabela, id) select 'fichas', id from _f;

  -- ---------- campo: visitas, diagnósticos, avaliações, km ----------
  create temp table _v (id uuid, ficha uuid, uf text, etapa text, executor uuid, dia date) on commit drop;
  foreach u in array ufs loop
    select id into art from _eq where papel = 'articulacao' and uf = u; select id into apo from _eq where papel = 'apoio' and uf = u;
    select array_agg(id order by nome) into campo from _eq where uf = u;
    todos_campo := todos_campo || campo; bolsistas := bolsistas || array[art, apo];
    for fid in select id from _f where uf = u and sel order by ordem loop
      dd := pg_temp.entre(greatest(date '2026-10-26', (select f.data_ficha from public.fichas f where f.id = fid) + 5), date '2027-01-29');
      di := pg_temp.entre(greatest(dd + 25, date '2027-01-11'), date '2027-05-28');
      a1 := pg_temp.entre(di + 25, di + 55); a2 := pg_temp.entre(a1 + 30, least(a1 + 70, date '2027-09-05')); if a2 <= a1 then a2 := a1 + 1; end if;
      av := pg_temp.entre(a2 + 3, least(a2 + 20, date '2027-09-25')); if av <= a2 then av := a2 + 1; end if;
      for j in 1..5 loop
        vid := gen_random_uuid(); quem := campo[1 + floor(random() * array_length(campo, 1))::int];
        insert into _v values (vid, fid, u, (array['diagnostico','implantacao','acompanhamento','acompanhamento','avaliacao'])[j], quem, (array[dd, di, a1, a2, av])[j]);
      end loop;
    end loop;
  end loop;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, criado_por, criado_em, atualizado_em, relato, fotos)
  select v.id, v.ficha, v.uf, v.etapa, v.executor, greatest(v.dia - 7, (select x.data_ficha from public.fichas x where x.id = v.ficha)), v.dia, 'realizada', f.bolsista, (v.dia - 10)::timestamp + interval '15 hours', v.dia::timestamp + interval '18 hours',
         case v.etapa when 'implantacao' then 'Implantação feita: canteiros preparados, caixa d''água e gotejamento instalados, mudas plantadas com a família.'
                      when 'acompanhamento' then pg_temp.pick(array['Quintal produzindo bem: alface, coentro e cebolinha. Orientei cobertura do solo e adubação com esterco.',
                         'Algumas mudas perdidas pelo sol; replantio feito. Galinhas soltas: combinamos a cerca.', 'Horta bonita, já vendendo na feira aos sábados. Conversamos sobre o PAA.'])
                      else null end,
         case when v.etapa in ('implantacao','acompanhamento') then array[v.uf || '/' || v.ficha || '/visita_' || v.id || '_1.jpg'] else '{}'::text[] end
    from _v v join _f f on f.id = v.ficha;
  insert into public.exemplo (tabela, id) select 'visitas', id from _v;
  insert into public.custos_visita (visita_id, km_ida, obs, definido_por, definido_em)
  select v.id, round((8 + random() * 70)::numeric, 1), null, tec, v.dia::timestamp + interval '20 hours' from _v v;

  insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, codigo_quintal, latitude, longitude, area_m2, renda_familiar, renda_quintal, agua_seca, sem_agua,
      lote, mes_implantacao, dados, fotos, situacao, aprovado_por, aprovado_em, criado_em, atualizado_em, conteudo_alterado_por, conteudo_alterado_em)
  select gen_random_uuid(), v.ficha, v.id, v.uf, v.executor, v.dia, v.uf || '-' || upper(substr(v.ficha::text, 1, 5)), round(f.lat + (random()::numeric - .5) * .1, 6), round(f.lon + (random()::numeric - .5) * .1, 6),
         (array[80,120,150,200,250,300,400,600])[1 + floor(random() * 8)::int], (array[600,800,1000,1200,1412,1600,2000])[1 + floor(random() * 7)::int],
         (array[0,0,50,100,150,200])[1 + floor(random() * 6)::int], pg_temp.pick(array['sim','sim','as_vezes']), false,
         case when v.dia < date '2026-12-15' then 1 else 2 end, case when v.dia < date '2026-12-15' then 'janeiro de 2027' else 'maio de 2027' end,
         jsonb_build_object(
           'familia', jsonb_build_array(jsonb_build_object('nome', split_part(f.nome, ' ', 1), 'idade', null, 'parentesco', 'Ela mesma', 'ocupacao', 'Agricultora', 'ajuda', true),
                                        jsonb_build_object('nome', pg_temp.pick(array['José','Antônio','Francisco','João']), 'idade', 30 + floor(random() * 40)::int, 'parentesco', 'Cônjuge/companheiro', 'ocupacao', 'Agricultor(a)', 'ajuda', true),
                                        jsonb_build_object('nome', pg_temp.pick(nomes), 'idade', 4 + floor(random() * 14)::int, 'parentesco', 'Filho(a)', 'ocupacao', 'Estuda', 'ajuda', false)),
           'politicas', to_jsonb(array[pg_temp.pick(array['bolsa_familia','aposentadoria','bpc']), pg_temp.pick(array['garantia_safra','paa','pnae','pronaf'])]),
           'fonte_renda', pg_temp.pick(array['Bolsa Família','Aposentadoria','Diárias na roça','Venda de produção']), 'terra', pg_temp.pick(array['propria','propria','cedida']),
           'cercado', pg_temp.pick(array['sim','nao','em_parte']), 'fontes_agua', to_jsonb(array[pg_temp.pick(array['cisterna_producao','poco','acude'])]),
           'capacidade_litros', (array[16000,52000,30000])[1 + floor(random() * 3)::int], 'meses_seca', 3 + floor(random() * 6)::int, 'distancia_m', 5 + floor(random() * 140)::int,
           'irrigacao', pg_temp.pick(array['nao','regador','gotejamento']), 'solo', pg_temp.pick(array['arenoso','argiloso','pedregoso']), 'meses_chuva', 'janeiro a abril',
           'producao', jsonb_build_object('hortalicas', jsonb_build_object('qtd', '2 canteiros', 'consumo', true, 'venda', random() < .3, 'onde', 'Feira da cidade'),
                                          'galinhas', jsonb_build_object('qtd', '15 cabeças', 'consumo', true, 'venda', false, 'onde', '')),
           'praticas', to_jsonb(array['compostagem','cobertura']), 'horas_dia', 1 + floor(random() * 4)::int, 'participa', to_jsonb(array['grupo_mulheres']),
           'dificuldades', pg_temp.pick(array['Falta água na seca','Não tem cerca','Solo fraco e pedregoso','Difícil vender a produção']),
           'sonhos', pg_temp.pick(array['Ter verdura o ano todo para a família','Vender na feira da cidade','Criar galinhas para ovos','Vender para a merenda escolar (PNAE)']),
           'objetivos', to_jsonb(array['alimentacao', pg_temp.pick(array['venda','animais','medicinais'])]), 'frase_objetivo', 'Ter hortaliças o ano inteiro e vender o que sobrar na feira',
           'kit', (select jsonb_agg(x) from (select x from jsonb_array_elements(kit) x order by random() limit 4) s),
           'cronograma', '[{"oque":"Preparar canteiros e cerca","inicio":"jan","fim":"fev","quem":"Ela e a família"},{"oque":"Instalar caixa e gotejamento","inicio":"fev","fim":"mar","quem":"Equipe do projeto"},{"oque":"Plantio e cobertura do solo","inicio":"mar","fim":"abr","quem":"Ela"}]'::jsonb,
           'compromissos', true,
           'impacto', jsonb_build_object('menor', true, 'ebia_pontos', v.pb, 'ebia_nivel', pg_temp.ebia(v.pb, true), 'dias_consumo', 1 + floor(random() * 3)::int,
                                         'especies', 2 + floor(random() * 5)::int, 'criacoes', floor(random() * 2)::int, 'vende', random() < .25, 'onde_vende', '[]'::jsonb,
                                         'decide', pg_temp.pick(array['ela','ela_e_outro','outra','nao_vende']), 'caf', pg_temp.pick(array['s','n','n','ns']))),
         array[v.uf || '/' || v.ficha || '/diag_' || v.id || '_geral.jpg', v.uf || '/' || v.ficha || '/diag_' || v.id || '_agua.jpg', v.uf || '/' || v.ficha || '/diag_' || v.id || '_plantio.jpg'],
         'aprovado', tec, (v.dia + 4)::timestamp + interval '10 hours', v.dia::timestamp + interval '19 hours', (v.dia + 4)::timestamp + interval '10 hours', v.executor, v.dia::timestamp + interval '19 hours'
    from (select *, (2 + floor(random() * 9))::int pb from _v where etapa = 'diagnostico') v join _f f on f.id = v.ficha;
  insert into public.exemplo (tabela, id) select 'diagnosticos', d.id from public.diagnosticos d join _f f on f.id = d.ficha_id;

  insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, quintal_produz, ebia_pontos, ebia_nivel, dados, fotos, criado_em, atualizado_em)
  select gen_random_uuid(), v.ficha, v.id, v.uf, v.executor, v.dia, round(f.lat + (random()::numeric - .5) * .1, 6), round(f.lon + (random()::numeric - .5) * .1, 6),
         case when random() < .78 then 'sim' when random() < .8 then 'em_parte' else 'nao' end, v.pf, pg_temp.ebia(v.pf, true),
         jsonb_build_object('motivo', null, 'renda_quintal', (array[80,150,200,300,450])[1 + floor(random() * 5)::int], 'horas_dia', 2 + floor(random() * 3)::int,
           'agua', pg_temp.pick(array['sim','sim','as_vezes']), 'alimentacao', case when random() < .82 then 'melhorou' else 'igual' end,
           'encaminhamentos', to_jsonb(array[pg_temp.pick(array['caf','paa','pnae','feira','ater'])]), 'fala', pg_temp.pick(array['Hoje a gente come verdura todo dia.','Vendo na feira e ajudo em casa.','O quintal mudou nossa mesa.']),
           'impacto', jsonb_build_object('menor', true, 'ebia_pontos', v.pf, 'ebia_nivel', pg_temp.ebia(v.pf, true), 'dias_consumo', 4 + floor(random() * 4)::int,
                                         'especies', 6 + floor(random() * 10)::int, 'criacoes', 1 + floor(random() * 3)::int, 'vende', random() < .6, 'onde_vende', to_jsonb(array['feira']),
                                         'decide', pg_temp.pick(array['ela','ela','ela_e_outro']), 'caf', pg_temp.pick(array['s','s','n']))),
         array[v.uf || '/' || v.ficha || '/aval_' || v.id || '_geral.jpg'], v.dia::timestamp + interval '19 hours', v.dia::timestamp + interval '19 hours'
    from (select *, floor(random() * 4)::int pf from _v where etapa = 'avaliacao') v join _f f on f.id = v.ficha;
  insert into public.exemplo (tabela, id) select 'avaliacoes', a.id from public.avaliacoes a join _f f on f.id = a.ficha_id;

  -- ---------- pagamentos: bolsas (12 meses) e ajuda de custo por mês com as visitas ----------
  create temp table _s (id uuid) on commit drop;
  for mes in select generate_series(date '2026-10-01', date '2027-09-01', interval '1 month')::date loop
    with ins as (
      insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, relatorio, detalhe, situacao, solicitada_em, aval_por, aval_em, arlo_por, arlo_em, arlo_protocolo)
      select gen_random_uuid(), 'bolsa', e.id, mes,
             case e.papel when 'coord_tecnico' then 4700 when 'articulacao' then 2200 when 'apoio' then 1600 when 'professor_fic' then 2200 when 'auxiliar_adm' then 1200 end,
             case when mes < date '2027-09-01' then case e.papel when 'coord_tecnico' then 4700 when 'articulacao' then 2200 when 'apoio' then 1600 when 'professor_fic' then 2200 when 'auxiliar_adm' then 1200 end end,
             'Atividades do mês: visitas, registros no sistema, encontro do curso FIC e reunião de planejamento com a equipe.', '{}'::jsonb,
             case when mes < date '2027-08-01' then 'lancada' when mes < date '2027-09-01' then 'avalizada' else 'solicitada' end,
             (mes + 27)::timestamp + interval '10 hours',
             case when mes < date '2027-09-01' then case when e.papel in ('articulacao','apoio') then tec else cg end end,
             case when mes < date '2027-09-01' then (mes + 30)::timestamp + interval '9 hours' end,
             case when mes < date '2027-08-01' then case when e.papel = 'auxiliar_adm' then cg else aux end end,
             case when mes < date '2027-08-01' then (mes + 34)::timestamp + interval '15 hours' end,
             case when mes < date '2027-08-01' then 'ARLO-' || to_char(mes, 'YYYYMM') || '-' || (100 + floor(random() * 900))::int end
        from _eq e where e.papel in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm')
      returning id) insert into _s select id from ins;
    -- ajuda de custo: um pedido por pessoa de campo com visitas feitas no mês
    for quem in select distinct executor from _v where date_trunc('month', dia)::date = mes loop
      sid := gen_random_uuid();
      insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, detalhe, situacao, solicitada_em, aval_por, aval_em, arlo_por, arlo_em, arlo_protocolo)
      select sid, 'ajuda_custo', quem, mes, t.total, case when mes < date '2027-09-01' then t.total end,
             jsonb_build_object('total', t.total, 'visitas', t.itens),
             case when mes < date '2027-08-01' then 'lancada' when mes < date '2027-09-01' then 'avalizada' else 'solicitada' end,
             (mes + 28)::timestamp + interval '10 hours', case when mes < date '2027-09-01' then tec end, case when mes < date '2027-09-01' then (mes + 31)::timestamp + interval '9 hours' end,
             case when mes < date '2027-08-01' then aux end, case when mes < date '2027-08-01' then (mes + 35)::timestamp + interval '15 hours' end,
             case when mes < date '2027-08-01' then 'ARLO-' || to_char(mes, 'YYYYMM') || '-' || (100 + floor(random() * 900))::int end
        from (select round(sum(r.tot), 2) total, jsonb_agg(jsonb_build_object('id', r.id, 'etapa', r.etapa, 'data', r.dia, 'municipio', r.mun, 'km', r.km, 'fonte', 'conferido', 'total', r.tot) order by r.dia) itens
                from (select v.id, v.etapa, v.dia, f.mun, c.km_ida km, round(160 + c.km_ida * 2 * 0.95 + 30, 2) tot
                        from _v v join _f f on f.id = v.ficha join public.custos_visita c on c.visita_id = v.id
                       where v.executor = quem and date_trunc('month', v.dia)::date = mes) r) t;
      insert into public.solicitacao_visitas (visita_id, solicitacao_id) select id, sid from _v where executor = quem and date_trunc('month', dia)::date = mes;
      insert into _s values (sid);
    end loop;
    -- entregas do mês das bolsistas (presença e AVA)
    insert into public.entregas_mes (equipe_id, mes, item, marcado_por, marcado_em)
    select b, mes, it, prof1, (mes + 25)::timestamp + interval '14 hours' from unnest(bolsistas) b cross join unnest(array['presenca','ava']) it;
  end loop;
  insert into public.exemplo (tabela, id) select 'solicitacoes_pagamento', id from _s;

  -- ---------- curso FIC: 2 turmas, matrículas, encontros semanais e presença ----------
  t1 := gen_random_uuid(); t2 := gen_random_uuid();
  insert into public.turmas_fic (id, nome, uf, municipio, inicio, fim, professor_id, obs, criado_por, criado_em) values
    (t1, 'Agroecologia em Quintais Produtivos – Turma A (AL, BA, SE)', null, null, date '2026-10-01', date '2027-09-30', prof1, 'Encontros às segundas, online e no AVA.', cg, timestamptz '2026-10-02 10:00-03'),
    (t2, 'Agroecologia em Quintais Produtivos – Turma B (PE, PI)', null, null, date '2026-10-01', date '2027-09-30', prof2, 'Encontros às terças, online e no AVA.', cg, timestamptz '2026-10-02 10:30-03');
  insert into public.exemplo values ('turmas_fic', t1), ('turmas_fic', t2);
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em, criado_por, criado_em)
  select gen_random_uuid(), case when e.uf in ('PE','PI') or (e.uf is null and e.papel = 'coord_tecnico') then t2 else t1 end, e.id, '2026' || (1000000 + (select count(*) from _eq x where x.nome <= e.nome) * 37), date '2026-10-02', prof1, timestamptz '2026-10-02 11:00-03'
    from _eq e where e.papel in ('coord_tecnico','articulacao','apoio','agente');
  insert into public.exemplo (tabela, id) select 'matriculas_fic', m.id from public.matriculas_fic m where m.turma_id in (t1, t2);
  update public.equipe q set matricula_fic_numero = m.numero, matricula_fic_em = m.matriculado_em from public.matriculas_fic m where m.equipe_id = q.id and m.turma_id in (t1, t2);
  insert into public.fic_encontros (id, turma_id, professor_id, data, carga_horaria, modalidade, conteudo, criado_em, atualizado_em)
  select gen_random_uuid(), t.id, t.prof, d::date, case when extract(week from d)::int % 4 = 0 then 8 else 4 end,
         case when extract(week from d)::int % 4 = 0 then 'presencial' when extract(week from d)::int % 2 = 0 then 'ava' else 'online' end,
         (array['Agroecologia e soberania alimentar','Manejo da água no semiárido','Preparo do solo e compostagem','Canteiros econômicos e irrigação por gotejamento',
                'Sementes crioulas','Criação de galinhas no quintal','Comercialização: feiras, PAA e PNAE','Registro das visitas no sistema','Plantas medicinais','Gênero e autonomia das mulheres'])[1 + (extract(week from d)::int % 10)],
         d + interval '20 hours', d + interval '20 hours'
    from (values (t1, prof1, date '2026-10-05'), (t2, prof2, date '2026-10-06')) t(id, prof, ini) cross join lateral generate_series(t.ini::timestamp, timestamp '2027-09-21', interval '7 days') d;
  insert into public.exemplo (tabela, id) select 'fic_encontros', id from public.fic_encontros where turma_id in (t1, t2);
  insert into public.fic_presencas (id, encontro_id, equipe_id, presente, marcado_por, marcado_em, confirmado_em)
  select gen_random_uuid(), en.id, m.equipe_id, p, en.professor_id, en.data::timestamp + interval '21 hours', case when p then en.data::timestamp + interval '21 hours' end
    from public.fic_encontros en join public.matriculas_fic m on m.turma_id = en.turma_id cross join lateral (select random() < .9 as p) r where en.turma_id in (t1, t2);
  insert into public.exemplo (tabela, id) select 'fic_presencas', p.id from public.fic_presencas p join public.fic_encontros e on e.id = p.encontro_id where e.turma_id in (t1, t2);

  -- ---------- viagens e eventos (até os tetos) ----------
  foreach u in array ufs loop
    select id into art from _eq where papel = 'articulacao' and uf = u;
    mid := gen_random_uuid();
    insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, enviado_em, conferido_por, conferido_em, decidido_por, decidido_em, funcern_protocolo, criado_em, valor_autorizado)
    values (mid, 'evento', u, art, 'Encontro estadual de troca de saberes das mulheres dos quintais – ' || u, date '2027-07-10' + (array_position(ufs, u) * 5),
      jsonb_build_object('valor_estimado', 5800, 'hora', '08:00', 'duracao', '8 horas', 'local', 'Centro comunitário de ' || (select nome from _mun where uf = u limit 1), 'referencia', 'Ao lado da praça',
        'participantes', jsonb_build_object('mulheres', 40, 'equipe', 6, 'convidados', 10), 'estrutura', jsonb_build_object('som', true, 'tenda', true, 'cadeiras', 60, 'mesas', 8),
        'alimentacao', jsonb_build_object('lanche', 56, 'almoco', 56, 'servico', 'Cozinha da associação', 'descartaveis', false),
        'responsavel', jsonb_build_object('nome', 'Responsável do centro comunitário', 'celular', '(87) 98888-1234'), 'fornecedores', null, 'orcamento', null),
      'autorizado', date '2027-05-20', aux, timestamptz '2027-05-22 10:00-03', cg, timestamptz '2027-05-25 10:00-03', 'FUNCERN-EV-' || u, timestamptz '2027-05-20 09:00-03', 5800);
    insert into public.exemplo values ('pedidos_apoio', mid);
    mid := gen_random_uuid();
    insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, enviado_em, conferido_por, conferido_em, decidido_por, decidido_em, funcern_protocolo, criado_em, valor_autorizado)
    values (mid, 'passagem', u, art, 'Intercâmbio de experiências em quintais produtivos – delegação de ' || u, date '2027-06-15',
      jsonb_build_object('valor_estimado', 13500, 'finalidade', 'intercambio', 'origem', (select nome from _mun where uf = u limit 1) || '/' || u, 'destino', 'Petrolina/PE', 'volta', '2027-06-19',
        'volta_para', null, 'sugestao', 'Voo da manhã', 'bagagem', 'Sem bagagem despachada',
        'passageiros', (select jsonb_agg(jsonb_build_object('nome', f.nome, 'cpf', f.cpf, 'nascimento', f.data_nascimento, 'rg', '12' || substr(f.cpf, 1, 5), 'rg_orgao', 'SSP', 'sexo', 'F',
                                                            'celular', '(87) 98888-0000', 'email', 'passageira@exemplo.invalid', 'endereco', null))
                          from (select x.nome, x.cpf, x.data_nascimento from public.fichas x join _f y on y.id = x.id where y.uf = u and y.sel order by y.ordem limit 6) f)),
      'autorizado', date '2027-04-20', aux, timestamptz '2027-04-22 10:00-03', cg, timestamptz '2027-04-25 10:00-03', 'FUNCERN-PA-' || u, timestamptz '2027-04-20 09:00-03', 13500);
    insert into public.exemplo values ('pedidos_apoio', mid);
  end loop;
  -- acompanhamento pedagógico: 8 missões da coordenação técnica (passagens da Meta 7)
  for k in 1..8 loop
    mid := gen_random_uuid();
    insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, enviado_em, conferido_por, conferido_em, decidido_por, decidido_em, funcern_protocolo, criado_em, valor_autorizado)
    values (mid, 'passagem', ufs[1 + (k % 5)], (select id from _eq where papel = 'articulacao' and uf = ufs[1 + (k % 5)]), 'Missão de acompanhamento pedagógico nº ' || k || ' – ' || ufs[1 + (k % 5)],
      date '2026-11-10' + k * 35, jsonb_build_object('valor_estimado', 2700, 'finalidade', 'pedagogico', 'origem', 'Natal/RN', 'destino', (select nome from _mun where uf = ufs[1 + (k % 5)] limit 1),
        'volta', to_char(date '2026-11-13' + k * 35, 'YYYY-MM-DD'), 'volta_para', null, 'sugestao', '', 'bagagem', '',
        'passageiros', jsonb_build_array(jsonb_build_object('nome', 'Rosângela Feitosa Lima', 'cpf', (select cpf from public.equipe where id = tec), 'nascimento', '1978-03-10', 'rg', '7654321', 'rg_orgao', 'SSP', 'sexo', 'F',
                                                            'celular', '(84) 98888-0001', 'email', 'tecnica@exemplo.invalid', 'endereco', null))),
      case when k <= 7 then 'autorizado' else 'enviado' end, date '2026-10-01' + k * 35, case when k <= 7 then aux end, case when k <= 7 then (date '2026-10-03' + k * 35)::timestamp end,
      case when k <= 7 then cg end, case when k <= 7 then (date '2026-10-05' + k * 35)::timestamp end, case when k <= 7 then 'FUNCERN-PP-' || k end, (date '2026-10-01' + k * 35)::timestamp, case when k <= 7 then 2700 end);
    insert into public.exemplo values ('pedidos_apoio', mid);
  end loop;

  -- ---------- documentos do projeto ----------
  insert into public.documentos_projeto (id, tipo, titulo, data_documento, uf, descricao, arquivo_path, arquivo_nome, tamanho, mime, enviado_por, enviado_em)
  select gen_random_uuid(), x.tipo, x.titulo || case when x.uf is not null then ' – ' || x.uf else '' end, x.dia, x.uf, x.descr, 'exemplo/' || x.n || '.pdf', x.n || '.pdf', 250000 + x.n * 1000, 'application/pdf', cg, x.dia::timestamp + interval '16 hours'
    from (select row_number() over () n, t.* from (
            select 'plano' tipo, 'Plano de trabalho do TED' titulo, date '2026-09-14' dia, null::text uf, 'Versão aprovada pelo MDA' descr union all
            select 'contrato', 'Termo de Execução Descentralizada', date '2026-09-14', null, 'TED assinado' union all
            select 'ata', 'Ata dos critérios de seleção', date '2026-10-23', null, 'Reunião com o MPA' union all
            select 'oficio', 'Ofício ao MDA – relatório parcial', date '2027-03-31', null, 'Envio do relatório do 1º semestre' union all
            select 'relatorio', 'Relatório parcial de execução', date '2027-03-31', null, 'Metas 1 a 4' union all
            select 'relatorio', 'Relatório final de execução', date '2027-09-28', null, 'Todas as metas' union all
            select 'lista_presenca', 'Lista de presença do encontro estadual', date '2027-07-15', u.uf, 'Meta 5' from unnest(array['AL','BA','PE','PI','SE']) u(uf) union all
            select 'ata', 'Ata da reunião de planejamento estadual', date '2026-10-15', u.uf, 'Planejamento das visitas' from unnest(array['AL','BA','PE','PI','SE']) u(uf) union all
            select 'foto', 'Registro fotográfico das implantações', date '2027-05-30', u.uf, 'Fotos autorizadas' from unnest(array['AL','BA','PE','PI','SE']) u(uf) union all
            select 'outro', 'Termo de referência dos kits', date '2026-10-16', null, 'Enviado à FUNCERN') t) x;
  insert into public.exemplo (tabela, id) select 'documentos_projeto', id from public.documentos_projeto where arquivo_path like 'exemplo/%';

  -- ---------- planilha de gastos (o retrato até 28/09/2027) ----------
  mid := gen_random_uuid();
  insert into public.execucao_planilhas (id, posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido, nao_classificadas, obs, enviado_por, enviado_em)
  select mid, date '2027-09-28', 'exemplo/planilha_gastos_2027-09.xlsx', 'planilha_gastos_2027-09.xlsx', jsonb_agg(l.j order by l.n), sum(l.v) filter (where l.item <> 'repasse_mda'),
         sum(l.v) filter (where l.item = 'repasse_mda'), 0, 'Simulação: retrato completo do fim do projeto.', cg, timestamptz '2027-09-29 10:00-03'
    from (select row_number() over () n, x.item, x.v, jsonb_build_object('linha', row_number() over () + 1, 'data', x.dia, 'texto', x.texto, 'item', x.item, 'rubrica', x.rub, 'descricao', x.texto, 'documento', null, 'valor', x.v) j
            from (values ('repasse_mda', null, 1000000.00, date '2026-09-20', 'Repasse do MDA – 1ª parcela'), ('repasse_mda', null, 1000000.00, date '2027-04-28', 'Repasse do MDA – 2ª parcela'),
                         ('bolsa_coord_geral', 'r1', 70000.00, date '2027-09-25', 'Bolsas da coordenação geral'), ('bolsa_professor', 'r1', 52800.00, date '2027-09-25', 'Bolsas dos professores do curso FIC'),
                         ('bolsa_auxiliar', 'r1', 16800.00, date '2027-09-25', 'Bolsas do auxiliar administrativo'), ('bolsa_secretaria', 'r1', 12000.00, date '2027-09-25', 'Bolsas da secretária acadêmica'),
                         ('bolsa_coord_pedagogico', 'r1', 12000.00, date '2027-09-25', 'Bolsas do coordenador pedagógico'), ('bolsa_coord_tecnico', 'r2', 56400.00, date '2027-09-25', 'Bolsas da coordenação técnica'),
                         ('bolsa_articulacao', 'r2', 132000.00, date '2027-09-25', 'Bolsas da articulação estadual'), ('bolsa_apoio', 'r2', 96000.00, date '2027-09-25', 'Bolsas do apoio estadual'),
                         ('diarias', 'r4', 11200.00, date '2027-08-30', 'Diárias – acompanhamento pedagógico'), ('ajuda_visitas', 'r5', 178500.00, date '2027-09-25', 'Ajuda de custo das visitas de campo'),
                         ('ajuda_apoio', 'r5', 11250.00, date '2027-09-10', 'Apoio à execução das atividades'), ('passagem_intercambio', 'r6', 67500.00, date '2027-06-10', 'Passagens do intercâmbio'),
                         ('passagem_pedagogico', 'r6', 18900.00, date '2027-08-30', 'Passagens do acompanhamento pedagógico'), ('locacao_veiculo', 'r6', 9800.00, date '2027-08-30', 'Locação de veículo'),
                         ('eventos', 'r7', 29000.00, date '2027-08-05', 'Infraestrutura dos eventos estaduais'), ('quintais', 'r7', 998600.00, date '2027-05-30', 'Kits e implantação dos 200 quintais'),
                         ('combustivel', 'r9', 7350.00, date '2027-09-10', 'Combustível'), ('equipamento', 'r10', 9850.00, date '2026-11-20', 'Notebook'),
                         ('doa', 'r13', 200000.00, date '2027-09-25', 'Taxa da fundação de apoio (FUNCERN)')) x(item, rub, v, dia, texto)) l;
  insert into public.exemplo values ('execucao_planilhas', mid);

  -- ---------- acesso à água, canais de venda, orientações de venda ----------
  insert into public.agua_situacoes (id, ficha_id, situacao, obs, registrado_por, registrado_em)
  select gen_random_uuid(), f.id, pg_temp.pick(array['encaminhada','em_andamento','concluida','sem_solucao']), 'Encaminhada ao Programa Cisternas; visita da ASA marcada.', tec, timestamptz '2026-12-10 10:00-03'
    from _f f where f.ordem between 51 and 54;
  insert into public.exemplo (tabela, id) select 'agua_situacoes', a.id from public.agua_situacoes a join _f f on f.id = a.ficha_id;
  insert into public.canais_venda (id, uf, municipio, tipo, nome, detalhe, contato, ativo, criado_por, criado_em)
  select gen_random_uuid(), m.uf, m.nome, t.tipo, t.nome || ' de ' || m.nome, t.det, '(87) 98888-5555', true, tec, timestamptz '2027-02-01 10:00-03'
    from _mun m cross join (values ('feira', 'Feira livre', 'Sábados, 5h às 11h'), ('merenda', 'Merenda escolar (PNAE)', 'Chamada pública da prefeitura')) t(tipo, nome, det);
  insert into public.exemplo (tabela, id) select 'canais_venda', id from public.canais_venda where criado_por = tec;
  insert into public.orientacoes_venda (id, ficha_id, uf, dados, feito_por, feito_em)
  select gen_random_uuid(), f.id, f.uf, jsonb_build_object('sobra', to_jsonb(array['hortalicas','ovos']), 'caf', pg_temp.pick(array['sim','nao','nao_sabe']), 'canais', to_jsonb(array['feira']), 'obs', 'Orientada sobre a feira e o PNAE.'),
         f.bolsista, timestamptz '2027-06-15 10:00-03'
    from _f f where f.sel and f.ordem % 2 = 0;
  insert into public.exemplo (tabela, id) select 'orientacoes_venda', o.id from public.orientacoes_venda o join _f f on f.id = o.ficha_id;

  -- ---------- vitrine (fotos fictícias: os arquivos não existem) ----------
  insert into public.vitrine_fotos (id, path, ficha_id, uf, legenda, sem_criancas, publicada_por, publicada_em)
  select gen_random_uuid(), 'exemplo-' || row_number() over () || '.jpg', f.id, f.uf, 'Quintal produzindo em ' || f.mun, true, cg, timestamptz '2027-06-01 10:00-03' + row_number() over () * interval '1 day'
    from (select y.* from _f y join public.fichas x on x.id = y.id where y.sel and x.consent_imagem and x.consent_criancas order by y.uf, y.ordem limit 6) f;
  insert into public.exemplo (tabela, id) select 'vitrine_fotos', v.id from public.vitrine_fotos v join _f f on f.id = v.ficha_id;

  -- ---------- acompanhamento externo, acessos, relatos, convites ----------
  insert into public.observadores (id, nome, email, orgao, cargo, status, criado_por, criado_em) values
    (gen_random_uuid(), 'Analista do MDA (exemplo)', 'analista.mda@exemplo.invalid', 'mda', 'Analista técnica', 'ativo', cg, timestamptz '2026-10-10 10:00-03'),
    (gen_random_uuid(), 'Coordenação do MDA (exemplo)', 'coord.mda@exemplo.invalid', 'mda', 'Coordenadora', 'ativo', cg, timestamptz '2026-10-10 10:05-03'),
    (gen_random_uuid(), 'Direção do MPA (exemplo)', 'direcao.mpa@exemplo.invalid', 'mpa', 'Direção nacional', 'ativo', cg, timestamptz '2026-10-10 10:10-03'),
    (gen_random_uuid(), 'Regional do MPA (exemplo)', 'regional.mpa@exemplo.invalid', 'mpa', 'Coordenação regional', 'inativo', cg, timestamptz '2026-10-10 10:15-03');
  insert into public.exemplo (tabela, id) select 'observadores', id from public.observadores where email like '%@exemplo.invalid';
  insert into public.acessos (equipe_id, em, tipo, aparelho, ip)
  select e.id, timestamptz '2027-09-28 08:00-03' - (g * interval '17 hours') - (random() * interval '3 hours'), case when g % 5 = 0 then 'saida' else 'entrada' end,
         pg_temp.pick(array['Android · Chrome','iPhone · Safari','Windows · Chrome']), '177.' || (10 + floor(random() * 200))::int || '.' || floor(random() * 250)::int || '.' || floor(random() * 250)::int
    from _eq e cross join generate_series(1, 6) g;
  insert into public.relatos_problema (id, autor_id, papel, tela, versao, aparelho, texto, status, nota, resolvido_por, resolvido_em, criado_em)
  select gen_random_uuid(), e.id, e.papel, x.tela, 'mq-v272', 'Android · Chrome', x.texto, x.st, case when x.st = 'resolvido' then 'Resolvido na versão seguinte.' end,
         case when x.st = 'resolvido' then cg end, case when x.st = 'resolvido' then timestamptz '2027-03-02 10:00-03' end, timestamptz '2027-03-01 10:00-03' + x.n * interval '9 days'
    from (values (1, 'campo', 'A foto demorou para enviar no sítio sem sinal.', 'resolvido'), (2, 'pagamentos', 'Não achei onde pedir a ajuda de custo de agosto.', 'aberto'),
                 (3, 'selecao', 'O CPF da testemunha deu inválido mas estava certo.', 'resolvido'), (4, 'campo', 'O mapa não abriu no meu celular antigo.', 'aberto')) x(n, tela, texto, st)
    join lateral (select id, papel from _eq where papel in ('articulacao','apoio','agente') order by random() limit 1) e on true;
  insert into public.exemplo (tabela, id) select 'relatos_problema', r.id from public.relatos_problema r join _eq e on e.id = r.autor_id;
  insert into public.convites (id, token, papel, uf, criado_por, criado_em, expira_em)
  values (gen_random_uuid(), md5('sim-convite-1'), 'agente', 'BA', tec, timestamptz '2027-09-20 10:00-03', timestamptz '2027-09-27 10:00-03') returning id into mid;
  update public.convites set usado_em = timestamptz '2027-09-21 09:00-03' where id = mid;
  insert into public.exemplo values ('convites', mid);
  insert into public.pre_cadastros (id, convite_id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, consentimento_lgpd, enviado_em, situacao)
  values (gen_random_uuid(), mid, 'agente', 'BA', 'Lucineide Barbosa Rocha', pg_temp.cpf(ncpf + 500), 'lucineide.sim@exemplo.invalid', '(74) 98888-7777', 'Juazeiro', 'MPA', true, timestamptz '2027-09-21 09:00-03', 'aguardando')
  returning id into mid;
  insert into public.exemplo values ('pre_cadastros', mid);

  -- ---------- leitura do guia (bolsistas: guia da bolsista; agentes: guia da agente), dois dias depois de entrar ----------
  if to_regclass('public.ciencias') is not null then
    alter table public.ciencias disable trigger user;   -- o gatilho põe a data de hoje; aqui vale a data da simulação
    insert into public.ciencias (equipe_id, documento, em)
    select e.id, case when e.papel = 'agente' then 'guia_agente' else 'guia_bolsista' end, (e.data_inicio + 2)::timestamp + interval '10 hours'
      from public.equipe e where e.id in (select id from _eq) and e.papel in ('articulacao', 'apoio', 'agente') and e.status = 'ativa'
    on conflict do nothing;
    alter table public.ciencias enable trigger user;
  end if;

  -- ---------- arranjos produtivos (APL) de cada município com quintal (18/10/2026) ----------
  -- a tabela não tem id: a linha fica anotada em public.exemplo pelo md5 de "UF|município" (o 96 apaga do mesmo jeito);
  -- município que já tinha APL de verdade fica como está (on conflict do nothing) e não é anotado
  if to_regclass('public.apl_municipios') is not null then
    alter table public.apl_municipios disable trigger user;
    with novos as (
      insert into public.apl_municipios (uf, municipio, apls, obs, atualizado_por, atualizado_em)
      select m.muf, m.mnome,
        string_to_array((array['hortaliças|feira agroecológica|galinha caipira', 'caprinocultura|apicultura|fruticultura',
               'mandioca e derivados|feira livre|PNAE', 'apicultura|artesanato|PAA', 'galinha caipira|hortaliças|cooperativa'])[1 + (m.o % 5)::int], '|'),
        (array['Feira agroecológica aos sábados na sede; prefeitura compra para a merenda (PNAE).', 'Cooperativa local compra mel e frutas; associação de criadoras de cabras.',
               'Casa de farinha comunitária; feira livre às quartas.', 'PAA ativo pela Conab; grupo de artesãs na comunidade.', 'Cooperativa compra ovos e hortaliças toda semana.'])[1 + (m.o % 5)::int],
        cg, timestamptz '2027-03-10 10:00-03' + m.o * interval '3 hours'
      from (select x.muf, x.mnome, row_number() over (order by x.muf, x.mnome) as o from (select distinct f.uf as muf, f.mun as mnome from _f f) x) m
      on conflict (uf, municipio) do nothing
      returning apl_municipios.uf as nuf, apl_municipios.municipio as nmun)
    insert into public.exemplo (tabela, id) select 'apl_municipios', md5(novos.nuf || '|' || novos.nmun)::uuid from novos on conflict do nothing;
    alter table public.apl_municipios enable trigger user;
  end if;

  -- ---------- histórico: o rastro de cada ação (as regras estavam desligadas na carga, então ele é escrito aqui) ----------
  insert into public.auditoria (tabela, registro_id, acao, por, em, antes, depois)
  select 'equipe', e.id, 'INSERT', cg, q.criado_em, null::jsonb, jsonb_build_object('nome', q.nome, 'papel', q.papel, 'uf', q.uf, 'status', 'ativa') from _eq e join public.equipe q on q.id = e.id
  union all select 'fichas', f.id, 'INSERT', f.bolsista_id, f.criado_em, null, jsonb_build_object('id', f.id, 'nome', f.nome, 'uf', f.uf, 'municipio', f.municipio, 'resultado', f.resultado, 'situacao', 'aguardando')
    from public.fichas f where f.id in (select id from _f)
  union all select 'fichas', f.id, 'UPDATE', tec, f.aprovada_em, jsonb_build_object('situacao', 'aguardando'), jsonb_build_object('situacao', 'aprovada')
    from public.fichas f where f.id in (select id from _f) and f.situacao = 'aprovada'
  union all select 'visitas', v.id, 'INSERT', f.bolsista, (v.dia - 10)::timestamp + interval '15 hours', null, jsonb_build_object('ficha_id', v.ficha, 'etapa', v.etapa, 'data_prevista', v.dia - 7, 'situacao', 'prevista')
    from _v v join _f f on f.id = v.ficha
  union all select 'visitas', v.id, 'UPDATE', v.executor, v.dia::timestamp + interval '18 hours', jsonb_build_object('situacao', 'prevista', 'data_realizada', null), jsonb_build_object('ficha_id', v.ficha, 'etapa', v.etapa, 'situacao', 'realizada', 'data_realizada', v.dia)
    from _v v
  union all select 'diagnosticos', d.id, 'UPDATE', tec, d.aprovado_em, jsonb_build_object('situacao', 'aguardando', 'ficha_id', d.ficha_id), jsonb_build_object('situacao', 'aprovado', 'ficha_id', d.ficha_id)
    from public.diagnosticos d where d.id in (select id from public.exemplo where tabela = 'diagnosticos')
  union all select 'solicitacoes_pagamento', s.id, 'UPDATE', s.aval_por, s.aval_em, jsonb_build_object('situacao', 'solicitada'), jsonb_build_object('situacao', 'avalizada', 'valor_avalizado', s.valor_avalizado)
    from public.solicitacoes_pagamento s where s.id in (select id from _s) and s.aval_em is not null
  union all select 'solicitacoes_pagamento', s.id, 'UPDATE', s.arlo_por, s.arlo_em, jsonb_build_object('situacao', 'avalizada'), jsonb_build_object('situacao', 'lancada', 'arlo_protocolo', s.arlo_protocolo)
    from public.solicitacoes_pagamento s where s.id in (select id from _s) and s.arlo_em is not null
  union all select 'planilhas', null, 'PLANILHA', cg, timestamptz '2027-09-20 11:00-03', null, jsonb_build_object('tipo', 'sem_documentos', 'qtd', 300, 'filtro', null);

  alter table public.equipe enable trigger user;            alter table public.equipe_privado enable trigger user;
  alter table public.equipe_bancario enable trigger user;   alter table public.fichas enable trigger user;
  alter table public.visitas enable trigger user;           alter table public.diagnosticos enable trigger user;
  alter table public.avaliacoes enable trigger user;        alter table public.custos_visita enable trigger user;
  alter table public.solicitacoes_pagamento enable trigger user; alter table public.solicitacao_visitas enable trigger user;
  alter table public.entregas_mes enable trigger user;      alter table public.turmas_fic enable trigger user;
  alter table public.matriculas_fic enable trigger user;    alter table public.fic_encontros enable trigger user;
  alter table public.fic_presencas enable trigger user;     alter table public.pedidos_apoio enable trigger user;
  alter table public.documentos_projeto enable trigger user; alter table public.execucao_planilhas enable trigger user;
  alter table public.agua_situacoes enable trigger user;    alter table public.canais_venda enable trigger user;
  alter table public.orientacoes_venda enable trigger user; alter table public.observadores enable trigger user;
  alter table public.relatos_problema enable trigger user;  alter table public.convites enable trigger user;
  alter table public.pre_cadastros enable trigger user;     alter table public.vitrine_fotos enable trigger user;
  alter table public.auditoria enable trigger user;         alter table public.acessos enable trigger user;

  drop function pg_temp.pick(text[]), pg_temp.entre(date, date), pg_temp.cpf(bigint), pg_temp.ebia(int, boolean);
end $sim$;

select 'Simulação do projeto completo colocada' as resultado,
  (select count(*) from public.exemplo where tabela = 'equipe') as equipe,
  (select count(*) from public.exemplo where tabela = 'fichas') as fichas,
  (select count(*) from public.exemplo where tabela = 'visitas') as visitas,
  (select count(*) from public.exemplo where tabela = 'diagnosticos') as diagnosticos,
  (select count(*) from public.exemplo where tabela = 'avaliacoes') as avaliacoes,
  (select count(*) from public.exemplo where tabela = 'solicitacoes_pagamento') as pagamentos,
  (select count(*) from public.exemplo where tabela = 'fic_encontros') as encontros_fic,
  (select count(*) from public.exemplo where tabela = 'apl_municipios') as municipios_com_apl,
  (select count(*) from public.auditoria where registro_id in (select id from public.exemplo)) as historico;
