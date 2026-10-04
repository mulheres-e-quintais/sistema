-- =====================================================================
-- Mulheres & Quintais — 54: POPULAR O BANCO COM 5 VEZES MAIS DADOS DE TESTE (fictícios) (04/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode UMA vez, com o banco SEM bolsistas,
-- agentes e fichas (banco novo, ou depois do perigo/99_zerar_tudo.sql). Precisa de todos os anteriores (até o 53).
-- NÃO rode junto com o 34_popular_teste.sql: é um ou outro.
--
-- O que entra (tudo inventado; e-mails terminam em @exemplo.invalid, ninguém entra com eles), 5 vezes o 34:
--   10 bolsistas (1 de articulação e 1 de apoio por estado: o banco só aceita uma de cada por estado, então aqui
--   não dá para multiplicar), 50 agentes de campo (10 por estado),
--   1.395 fichas de mulheres (1.000 selecionadas e aprovadas, 200 por estado; e mais lista de espera, sem água,
--   não atende, aguardando e devolvida), 4.000 visitas feitas e 1.000 diagnósticos com plano aprovado.
--   Se ainda não houver: 2 professores do FIC habilitados, 1 auxiliar administrativo e 1 coordenação técnica.
--
-- ATENÇÃO: isto é 5 vezes o plano de trabalho (200 quintais, 40 por estado). As telas vão mostrar "1.000 de 200" e
-- metas em 500%, e as travas de vagas por estado e de dias de campo recusam registro novo enquanto estes dados
-- estiverem no banco. Serve para ver o sistema cheio e testar volume, não para trabalhar.
-- NÃO mexe em nada que já existe e NÃO apaga nada. Todo registro fica anotado na tabela public.exemplo: não aparece
-- na vitrine pública nem no acompanhamento do MDA e do MPA, e sai com o 06_apagar_exemplo.sql ou o perigo/99.
-- Por segurança, para (sem mudar nada) se já houver bolsistas/agentes ou fichas, ou se já tiver rodado.
-- =====================================================================
begin;

create table if not exists public.exemplo (tabela text not null, id uuid not null, primary key (tabela, id));
alter table public.exemplo enable row level security;

do $$ begin
  if exists (select 1 from public.exemplo) then
    raise exception 'Os dados de teste já estão no banco (nada mudou).';
  end if;
  if exists (select 1 from public.equipe where status = 'ativa' and papel in ('articulacao','apoio','agente')) then
    raise exception 'Já há bolsistas ou agentes cadastrados: os dados de teste ocupariam as mesmas vagas. Nada mudou.';
  end if;
  if exists (select 1 from public.fichas) then
    raise exception 'Já há fichas de mulheres no banco. Nada mudou.';
  end if;
end $$;

-- as regras do sistema (gatilhos) ficam desligadas só durante a carga, para gravar datas e aprovações de uma vez
alter table public.equipe disable trigger user;
alter table public.fichas disable trigger user;
alter table public.visitas disable trigger user;
alter table public.diagnosticos disable trigger user;

-- coordenação técnica: só se não houver uma ativa (a que existe é mantida)
do $$ begin
  if not exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then
    insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd, status, matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_assinado_em, termo_path) values
    ('9f645a0d-ea02-48bd-9a10-aa60f69d4336', 'coord_tecnico', null, 'Francineide Oliveira', '35807046994', 'francineide.oliveira87@exemplo.invalid', '(89) 98118-4085', 'Apodi/RN', 'MPA – coordenação nacional', '2026-10-01', true, 'ativa', '2026-10-06', '20261419558', '2026-10-12', '2026-10-20', null);
    insert into public.exemplo (tabela, id) values ('equipe', '9f645a0d-ea02-48bd-9a10-aa60f69d4336');
  end if;
end $$;

-- professores do FIC (habilitados) e auxiliar administrativo: só se ainda não houver
do $$ begin
  if not exists (select 1 from public.equipe where papel = 'professor_fic' and status = 'ativa' and docs_funcern_em is not null and termo_assinado_em is not null) then
    insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd, status, docs_funcern_em, termo_assinado_em) values
    ('5c1e0a01-0000-4000-8000-000000000001', 'professor_fic', null, 'Tiago Menezes Exemplo', '91234567873', 'tiago.menezes@exemplo.invalid', '(84) 98811-1011', 'Apodi/RN', 'IFRN Campus Apodi', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01'),
    ('5c1e0a01-0000-4000-8000-000000000002', 'professor_fic', null, 'Clara Bezerra Exemplo', '92345678119', 'clara.bezerra@exemplo.invalid', '(84) 98822-1022', 'Apodi/RN', 'IFRN Campus Apodi', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01');
    insert into public.exemplo (tabela, id) values ('equipe', '5c1e0a01-0000-4000-8000-000000000001'), ('equipe', '5c1e0a01-0000-4000-8000-000000000002');
  end if;
  if not exists (select 1 from public.equipe where papel = 'auxiliar_adm' and status = 'ativa') then
    insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd, status, docs_funcern_em, termo_assinado_em) values
    ('5c1e0a01-0000-4000-8000-000000000003', 'auxiliar_adm', null, 'Rosa Amaral Exemplo', '93456781237', 'rosa.amaral@exemplo.invalid', '(84) 98833-1033', 'Apodi/RN', 'IFRN Campus Apodi', '2026-10-01', true, 'ativa', '2026-10-01', '2026-10-01');
    insert into public.exemplo (tabela, id) values ('equipe', '5c1e0a01-0000-4000-8000-000000000003');
  end if;
end $$;

-- CPF inventado, com os dois dígitos de conferência certos
create function pg_temp.cpf(base bigint) returns text language plpgsql as $f$
declare d int[]; s int := 0; i int; t text := lpad((base % 999999999)::text, 9, '0'); a int; b int;
begin
  for i in 1..9 loop d[i] := substr(t, i, 1)::int; s := s + d[i] * (11 - i); end loop;
  a := (s * 10) % 11; if a = 10 then a := 0; end if;
  s := 0; for i in 1..9 loop s := s + d[i] * (12 - i); end loop; s := s + a * 2;
  b := (s * 10) % 11; if b = 10 then b := 0; end if;
  return t || a::text || b::text;
end $f$;

do $$
declare
  ufs text[] := array['AL','BA','PE','PI','SE'];
  ddd text[] := array['82','74','87','89','79'];
  lat numeric[] := array[-9.42, -10.90, -7.88, -8.14, -10.20];
  lon numeric[] := array[-36.63, -40.00, -40.08, -41.14, -36.80];
  munis text[][] := array[
    array['Cacimbinhas','Estrela de Alagoas','Palmeira dos Índios','Cacimbinhas','Estrela de Alagoas','Palmeira dos Índios','Cacimbinhas','Estrela de Alagoas','Palmeira dos Índios','Cacimbinhas'],
    array['Cansanção','Iraquara','Itiúba','Laje','Lençóis','Ponto Novo','Taperoá','Vitória da Conquista','Cansanção','Itiúba'],
    array['Araripina','Bodocó','Cedro','Ouricuri','Serrita','Araripina','Bodocó','Cedro','Ouricuri','Serrita'],
    array['Alagoinha do Piauí','Campo Grande do Piauí','Francisco Santos','Geminiano','Oeiras','Paulistana','Pio IX','São João da Varjota','São Julião','Teresina'],
    array['Neópolis','Pacatuba','Porto da Folha','Neópolis','Pacatuba','Porto da Folha','Neópolis','Pacatuba','Porto da Folha','Neópolis']];
  nomes text[] := array['Maria','Francisca','Antônia','Josefa','Raimunda','Luzia','Cícera','Rita','Ana','Rosa','Edilene','Ivonete','Marlene','Damiana','Severina','Joana','Tereza','Lúcia','Neide','Aparecida','Valdete','Cleide','Edna','Geralda','Irene','Jacira','Lindalva','Quitéria','Zuleide','Marinalva'];
  sobres text[] := array['Silva','Souza','Santos','Oliveira','Lima','Pereira','Ferreira','Alves','Ribeiro','Gomes','Barbosa','Rodrigues','Nunes','Reis','Araújo','Bezerra','Cavalcante','Moura','Nascimento','Batista','Dias','Sales','Tavares','Freitas','Teixeira'];
  comuns text[] := array['Povoado Barra','Sítio Lagoa do Mato','Comunidade Caldeirão','Assentamento Novo Horizonte','Sítio Baixio','Comunidade Riacho Seco','Povoado Serra Branca','Sítio Umburana','Comunidade Poço Dantas','Povoado Boa Vista','Sítio Malhada','Comunidade Olho d’Água','Povoado Várzea Grande','Sítio Juazeiro','Comunidade Angico'];
  orgs text[] := array['MPA','MPA – regional','Associação de Mulheres','Sindicato dos Trabalhadores Rurais','Cooperativa da Agricultura Familiar'];
  quem text[] := array['Sindicato','Associação de mulheres','MPA','Agente de saúde','Igreja'];
  kits jsonb[] := array[
    '[{"item":"Mudas frutíferas","qtd":"10","para":"pomar do quintal"},{"item":"Kit de gotejamento","qtd":"1","para":"irrigação econômica"},{"item":"Esterco curtido","qtd":"20","para":"adubação"},{"item":"Ferramentas manuais","qtd":"1","para":"preparo do solo"},{"item":"Caixa d''água 1.000 L","qtd":"1","para":"reservar água para irrigar"},{"item":"Sementes de hortaliças","qtd":"10","para":"plantio dos canteiros"}]'::jsonb,
    '[{"item":"Tela para galinheiro","qtd":"25","para":"criação de galinhas"},{"item":"Ferramentas manuais","qtd":"1","para":"preparo do solo"},{"item":"Mudas frutíferas","qtd":"10","para":"pomar do quintal"},{"item":"Caixa d''água 1.000 L","qtd":"1","para":"reservar água para irrigar"},{"item":"Esterco curtido","qtd":"20","para":"adubação"}]'::jsonb,
    '[{"item":"Tela de sombreamento 50%","qtd":"30","para":"proteger os canteiros do sol"},{"item":"Regador e mangueira","qtd":"1","para":"rega dos canteiros"},{"item":"Sementes de hortaliças","qtd":"12","para":"horta"},{"item":"Kit de gotejamento","qtd":"1","para":"irrigação econômica"},{"item":"Esterco curtido","qtd":"15","para":"adubação"}]'::jsonb];
  ct uuid := (select id from public.equipe where papel = 'coord_tecnico' and status = 'ativa' limit 1);
  u int; i int; k int; n bigint := 0; uf text; pid uuid; fid uuid; vid uuid; did uuid; nome text; mun text;
  bols uuid[]; campo uuid[]; quem_faz uuid; d_ficha date; d_diag date; d_impl date; d_a1 date; d_a2 date; res text; sit text; pos int;
begin
  for u in 1..5 loop
    uf := ufs[u]; bols := '{}'; campo := '{}';
    -- equipe do estado: 1 de articulação, 1 de apoio (limite do banco) e 10 agentes
    for i in 1..12 loop
      n := n + 1; pid := gen_random_uuid(); nome := nomes[1 + (n * 7 % 30)] || ' ' || sobres[1 + (n * 11 % 25)] || ' ' || sobres[1 + (n * 3 % 25)];
      insert into public.equipe (id, papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, consentimento_lgpd, status, matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_assinado_em, termo_path)
      values (pid, case when i = 1 then 'articulacao' when i = 2 then 'apoio' else 'agente' end, uf, nome, pg_temp.cpf(100000000 + n * 7919),
        'equipe' || n || '@exemplo.invalid', '(' || ddd[u] || ') 99' || lpad((100 + n)::text, 3, '0') || '-' || lpad((1000 + n * 37 % 9000)::text, 4, '0'), munis[u][1 + (i % 10)], orgs[1 + (i % 5)],
        '2026-10-01', true, 'ativa', '2026-10-06', '2026' || lpad((1000000 + n)::text, 7, '0'), '2026-10-12', '2026-10-09', null);
      insert into public.exemplo (tabela, id) values ('equipe', pid);
      if i <= 2 then bols := bols || pid; end if; campo := campo || pid;
    end loop;
    -- fichas: 200 selecionadas e aprovadas; depois 40 na lista de espera, 12 sem água, 10 não atende, 12 aguardando e 5 devolvidas
    for i in 1..279 loop
      n := n + 1; fid := gen_random_uuid(); nome := nomes[1 + (n * 13 % 30)] || ' ' || sobres[1 + (n * 5 % 25)] || ' ' || sobres[1 + (n * 17 % 25)];
      mun := munis[u][1 + (i % 10)]; d_ficha := date '2026-10-19' + (i % 26);
      res := case when i <= 200 then 'selecionada' when i <= 240 then 'lista_espera' when i <= 252 then 'sem_agua' when i <= 262 then 'nao_atende' else 'selecionada' end;
      if i > 274 then res := 'lista_espera'; end if;
      sit := case when i <= 262 then 'aprovada' when i <= 274 then 'aguardando' else 'devolvida' end;
      pos := case when res = 'lista_espera' and i <= 240 then i - 200 else null end;
      insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, celular, endereco, ponto_referencia, nis, pessoas_familia, indicada_por, autodeclaracao,
        p_sustento, p_cadunico, p_sem_ater, p_raca_povo, p_jovem, p_grupo, p_caf, consent_dados, consent_imagem, consent_criancas, assinatura, resultado, posicao_espera, encaminhada_para, justificativa,
        latitude, longitude, situacao, aprovada_por, aprovada_em, obs_coordenacao, bolsista_id, data_ficha, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica)
      values (fid, uf, mun, comuns[1 + (i % 15)], nome, pg_temp.cpf(500000000 + n * 104729), date '1958-01-01' + ((n * 97) % 16000)::int,
        '(' || ddd[u] || ') 98' || lpad((100 + i)::text, 3, '0') || '-' || lpad((1000 + n * 53 % 9000)::text, 4, '0'), 'Sítio ' || comuns[1 + (i % 15)] || ', casa ' || i, 'Perto da escola', null, 2 + (i % 6), quem[1 + (i % 5)], true,
        i % 2 = 0, i % 5 <> 0, i % 3 <> 0, i % 3 = 0, i % 7 = 0, i % 2 = 1, i % 4 = 0, true, i % 3 <> 0, false, 'assinatura', res, pos,
        case when res = 'sem_agua' then 'Programa Cisternas (ASA)' else null end, case when res in ('sem_agua', 'nao_atende') then 'Registrado na visita de seleção.' else null end,
        null, null, sit, case when sit = 'aprovada' then ct else null end, case when sit = 'aprovada' then (d_ficha + 4)::timestamp at time zone 'America/Fortaleza' + interval '12 hours' else null end,
        case when sit = 'devolvida' then 'A foto do termo está cortada: falta a assinatura. Fotografe de novo.' else null end, bols[1 + (i % 2)], d_ficha,
        true, true, true, res <> 'sem_agua', true, true, true, res <> 'nao_atende');
      insert into public.exemplo (tabela, id) values ('fichas', fid);
      if i > 200 then continue; end if;
      -- 4 visitas feitas por quintal (diagnóstico, implantação e 2 acompanhamentos) e o diagnóstico com plano aprovado
      quem_faz := campo[1 + (i % 12)]; d_diag := d_ficha + 6 + (i % 20); d_impl := date '2027-02-01' + (i % 100); d_a1 := d_impl + 30 + (i % 20); d_a2 := d_a1 + 40 + (i % 20);
      vid := gen_random_uuid();
      insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, criado_por) values (vid, fid, uf, 'diagnostico', quem_faz, d_diag, d_diag, 'realizada', bols[1 + (i % 2)]);
      insert into public.exemplo (tabela, id) values ('visitas', vid);
      did := gen_random_uuid();
      insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, codigo_quintal, latitude, longitude, sem_gps_motivo, area_m2, renda_familiar, renda_quintal, agua_seca, sem_agua, lote, mes_implantacao, dados, situacao, aprovado_por, aprovado_em)
      values (did, fid, vid, uf, quem_faz, d_diag, uf || '-' || upper(substr(replace(fid::text, '-', ''), 1, 5)), round(lat[u] + ((n * 37 % 300) - 150) / 1000.0, 6), round(lon[u] + ((n * 71 % 300) - 150) / 1000.0, 6), null,
        100 + (i % 12) * 30, 600 + (i % 15) * 100, (i % 5) * 50, case when i % 6 = 0 then 'as_vezes' else 'sim' end, false, 1 + (i % 2), 'fevereiro de 2027',
        jsonb_build_object(
          'familia', jsonb_build_array(jsonb_build_object('nome', split_part(nome, ' ', 1), 'idade', null, 'parentesco', 'Ela mesma', 'ocupacao', 'Agricultora', 'ajuda', true), jsonb_build_object('nome', nomes[1 + (i % 30)], 'idade', 12 + (i % 50), 'parentesco', 'Filho(a)', 'ocupacao', 'Estuda', 'ajuda', i % 2 = 0)),
          'politicas', case i % 3 when 0 then '["bolsa_familia","garantia_safra"]'::jsonb when 1 then '["pronaf","bpc"]'::jsonb else '["bolsa_familia"]'::jsonb end,
          'fonte_renda', case i % 3 when 0 then 'Bolsa Família e venda de galinhas' when 1 then 'Aposentadoria' else 'Diárias na roça' end,
          'terra', case i % 3 when 0 then 'propria' when 1 then 'cedida' else 'outra' end, 'cercado', case i % 3 when 0 then 'sim' when 1 then 'em_parte' else 'nao' end,
          'fontes_agua', case i % 2 when 0 then '["cisterna_consumo","cisterna_producao"]'::jsonb else '["cisterna_producao","poco"]'::jsonb end,
          'capacidade_litros', case i % 2 when 0 then 52000 else 16000 end, 'meses_seca', 6 + (i % 3), 'distancia_m', 20 + (i % 90), 'irrigacao', case i % 2 when 0 then 'regador' else 'nao' end,
          'solo', case i % 3 when 0 then 'arenoso' when 1 then 'pedregoso' else 'argiloso' end, 'meses_chuva', 'janeiro a abril',
          'producao', jsonb_build_object('hortalicas', jsonb_build_object('qtd', (2 + i % 4) || ' canteiros', 'consumo', true, 'venda', i % 2 = 0, 'onde', 'Feira da cidade'), 'galinhas', jsonb_build_object('qtd', (10 + i % 20) || ' cabeças', 'consumo', true, 'venda', i % 3 = 0, 'onde', 'Na comunidade')),
          'praticas', '["esterco","sementes"]'::jsonb, 'horas_dia', 2 + (i % 3), 'participa', '["associacao","grupo_mulheres"]'::jsonb,
          'dificuldades', 'Falta água na seca', 'sonhos', 'Ter verdura o ano todo para a família', 'objetivos', '["alimentacao","venda"]'::jsonb, 'frase_objetivo', 'Produzir verdura sem veneno e vender na feira',
          'kit', kits[1 + (i % 3)],
          'cronograma', '[{"oque":"Preparar canteiros e cerca","inicio":"jan","fim":"fev","quem":"Ela e a família"},{"oque":"Instalar caixa e gotejamento","inicio":"fev","fim":"mar","quem":"Equipe do projeto"},{"oque":"Plantio e cobertura do solo","inicio":"mar","fim":"abr","quem":"Ela"}]'::jsonb,
          'compromissos', true),
        'aprovado', ct, (d_diag + 5)::timestamp at time zone 'America/Fortaleza' + interval '12 hours');
      insert into public.exemplo (tabela, id) values ('diagnosticos', did);
      for k in 1..3 loop
        vid := gen_random_uuid();
        insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, criado_por)
        values (vid, fid, uf, case when k = 1 then 'implantacao' else 'acompanhamento' end, quem_faz, case k when 1 then d_impl when 2 then d_a1 else d_a2 end, case k when 1 then d_impl when 2 then d_a1 else d_a2 end, 'realizada', bols[1 + (i % 2)]);
        insert into public.exemplo (tabela, id) values ('visitas', vid);
      end loop;
    end loop;
  end loop;
end $$;

alter table public.equipe enable trigger user;
alter table public.fichas enable trigger user;
alter table public.visitas enable trigger user;
alter table public.diagnosticos enable trigger user;

commit;

select 'Dados de teste (5 vezes) colocados' as resultado,
  (select count(*) from public.exemplo where tabela = 'equipe') as equipe,
  (select count(*) from public.exemplo where tabela = 'fichas') as fichas,
  (select count(*) from public.fichas where resultado = 'selecionada' and situacao = 'aprovada') as selecionadas,
  (select count(*) from public.exemplo where tabela = 'visitas') as visitas,
  (select count(*) from public.exemplo where tabela = 'diagnosticos') as diagnosticos;
