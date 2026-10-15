-- =====================================================================
-- Mulheres & Quintais — 66: CORREÇÕES DA AUDITORIA DE 15/10/2026 (tela de quem acompanha)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 65. Pode rodar de novo.
-- 1. A prévia "Ver como o MDA/MPA vê" é só da coordenação geral (a técnica não lê planilha de gastos nem documentos no resto do sistema).
-- 2. A liberação dos recursos ao MDA (acomp_mda_financeiro) só pode ser mudada pela coordenação geral, e só aceita previa, sim ou nao.
-- 3. Documentos: quem acompanha vê só quantos há de cada tipo e a data do mais recente (o título podia ter nome de pessoa).
-- 4. Uma linha mal formada da planilha de gastos não derruba mais a tela; ordem fixa nos itens.
-- 5. Formação sem matrículas e encontros cancelados também na função principal; horas já dadas e viagens feitas.
-- 6. A lista de ids de exemplo deixa de ser aberta a qualquer conta logada.
-- Não muda nenhum registro.
-- =====================================================================
begin;

CREATE OR REPLACE FUNCTION public.parametros_validar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare v jsonb := new.valor; k text; rot text; h jsonb; x numeric;
begin
  -- 47: só entram os parâmetros que o sistema conhece (o que já existe com outro nome continua podendo ser alterado)
  -- 66: a liberação dos recursos para o MDA é decisão só da coordenação geral (ou de quem roda o SQL no Supabase) e só aceita previa, sim ou nao
  if new.chave = 'acomp_mda_financeiro' then
    if auth.uid() is not null and coalesce(public.meu_papel(), '') <> 'coord_geral' then
      raise exception 'Só a coordenação geral decide se o MDA vê os recursos.';
    end if;
    if new.valor is null or jsonb_typeof(new.valor) <> 'string' or (new.valor #>> '{}') not in ('previa', 'sim', 'nao') then
      raise exception 'Use previa, sim ou nao para a liberação dos recursos ao MDA.';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' and new.chave is distinct from 'custo_visita' and not exists (select 1 from public.parametros p where p.chave = new.chave) then
    raise exception 'Parâmetro desconhecido (%). O sistema só guarda os valores do custo da visita.', left(coalesce(new.chave, ''), 40);
  end if;
  if new.chave <> 'custo_visita' or (tg_op = 'UPDATE' and new.valor is not distinct from old.valor) then return new; end if;
  if jsonb_typeof(v) <> 'object' then
    raise exception 'Os valores do custo da visita vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.';
  end if;
  foreach k in array array['valor_hora', 'refeicao', 'km_por_litro', 'preco_litro', 'fator_estrada', 'teto'] loop
    if not (v ? k) then continue; end if;
    rot := case k when 'valor_hora' then 'O valor da hora' when 'refeicao' then 'O valor da refeição' when 'km_por_litro' then 'O consumo do carro (km por litro)'
                  when 'preco_litro' then 'O preço do litro da gasolina' when 'fator_estrada' then 'O fator estrada' else 'O teto das ajudas de custo' end;
    if jsonb_typeof(v -> k) <> 'number' then raise exception '% precisa ser um número.', rot; end if;
    x := (v ->> k)::numeric;
    if k in ('valor_hora', 'refeicao', 'teto') and not (x >= 0) then raise exception '% não pode ser negativo.', rot; end if;
    if k in ('km_por_litro', 'preco_litro') and not (x > 0) then raise exception '% precisa ser maior que zero.', rot; end if;
    if k = 'fator_estrada' and not (x >= 1) then raise exception 'O fator estrada precisa ser 1 ou mais (a estrada nunca é mais curta que a linha reta).'; end if;
    if not (x <= 100000000) then raise exception '% está alto demais. Confira o número.', rot; end if;
  end loop;
  if v ? 'horas' then
    h := v -> 'horas';
    if jsonb_typeof(h) <> 'object' then raise exception 'As horas por etapa vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.'; end if;
    for k in select jsonb_object_keys(h) loop
      if jsonb_typeof(h -> k) <> 'number' or not ((h ->> k)::numeric >= 0 and (h ->> k)::numeric <= 24) then
        raise exception 'As horas de cada etapa precisam ser um número entre 0 e 24.';
      end if;
    end loop;
  end if;
  return new;
end 
$function$
;

create or replace function public.exemplo_fora() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $f$
  select e.id from public.exemplo e where coalesce(public.meu_papel(), '') <> 'coord_geral'
$f$;
revoke all on function public.exemplo_fora() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.acompanhamento_dados(p_orgao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_org text; hoje date := (now() at time zone 'America/Fortaleza')::date; r jsonb; v_uf jsonb; v_mun jsonb; v_mes jsonb; v_extra jsonb;
begin
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') = 'coord_geral' and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;

  -- por estado
  with f as (select x.* from public.fichas x where x.id not in (select public.exemplo_fora())),
       s as (select * from f where resultado = 'selecionada' and situacao = 'aprovada'),
       v as (select x.* from public.visitas x join f on f.id = x.ficha_id where x.situacao <> 'cancelada'),
       d as (select x.* from public.diagnosticos x join f on f.id = x.ficha_id),
       a as (select x.* from public.avaliacoes x join f on f.id = x.ficha_id),
       e as (select x.* from public.equipe x where x.status = 'ativa' and x.id not in (select public.exemplo_fora()))
  select jsonb_agg(jsonb_build_object('uf', u.uf,
      'indicadas', (select count(*) from f where f.uf = u.uf),
      'selecionadas', (select count(*) from s where s.uf = u.uf),
      'espera', (select count(*) from f where f.uf = u.uf and f.resultado = 'lista_espera'),
      'sem_agua', (select count(*) from f where f.uf = u.uf and f.resultado = 'sem_agua'),
      'municipios', (select count(distinct public.sem_acento(s.municipio)) from s where s.uf = u.uf),
      'comunidades', (select count(distinct public.sem_acento(s.municipio) || '|' || public.sem_acento(s.comunidade)) from s where s.uf = u.uf),
      'pessoas', (select coalesce(sum(s.pessoas_familia), 0) from s where s.uf = u.uf),
      'diagnosticos', (select count(*) from d where d.uf = u.uf),
      'planos', (select count(*) from d where d.uf = u.uf and d.situacao = 'aprovado' and not coalesce(d.sem_agua, false)),
      'diag_sem_agua', (select count(*) from d where d.uf = u.uf and coalesce(d.sem_agua, false)),
      'area_m2', (select coalesce(sum(d.area_m2), 0) from d where d.uf = u.uf and not coalesce(d.sem_agua, false)),
      'implantados', (select count(*) from v where v.uf = u.uf and v.etapa = 'implantacao' and v.situacao = 'realizada'),
      'acompanhamentos', (select count(*) from v where v.uf = u.uf and v.etapa = 'acompanhamento' and v.situacao = 'realizada'),
      'avaliacoes', (select count(*) from a where a.uf = u.uf),
      'visitas_feitas', (select count(*) from v where v.uf = u.uf and v.situacao = 'realizada'),
      'agendadas', (select count(*) from v where v.uf = u.uf and v.situacao = 'prevista' and v.data_prevista >= hoje),
      'atrasadas', (select count(*) from v where v.uf = u.uf and v.situacao = 'prevista' and v.data_prevista < hoje),
      'bolsistas', (select count(*) from e where e.uf = u.uf and e.papel in ('articulacao', 'apoio')),
      'agentes', (select count(*) from e where e.uf = u.uf and e.papel = 'agente')) order by u.uf)
    into v_uf
    from (values ('AL'), ('BA'), ('PE'), ('PI'), ('SE')) as u(uf);

  -- por município (selecionadas aprovadas e quintais já implantados)
  select coalesce(jsonb_agg(jsonb_build_object('uf', x.uf, 'municipio', x.municipio, 'n', x.n, 'implantados', x.imp) order by x.uf, x.municipio), '[]'::jsonb) into v_mun
    from (select f.uf, (array_agg(regexp_replace(trim(f.municipio), '\s+', ' ', 'g') order by length(regexp_replace(trim(f.municipio), '[ -~]', '', 'g')) desc, f.municipio))[1] municipio, count(*) n,
                 count(*) filter (where exists (select 1 from public.visitas v where v.ficha_id = f.id and v.etapa = 'implantacao' and v.situacao = 'realizada')) imp
            from public.fichas f
           where f.resultado = 'selecionada' and f.situacao = 'aprovada' and f.id not in (select public.exemplo_fora())
           group by f.uf, public.sem_acento(f.municipio)) x;

  -- por mês: visitas feitas, por etapa
  select coalesce(jsonb_agg(jsonb_build_object('mes', x.mes, 'diagnostico', x.dg, 'implantacao', x.im, 'acompanhamento', x.ac, 'avaliacao', x.av) order by x.mes), '[]'::jsonb) into v_mes
    from (select to_char(v.data_realizada, 'YYYY-MM') mes,
                 count(*) filter (where v.etapa = 'diagnostico') dg, count(*) filter (where v.etapa = 'implantacao') im,
                 count(*) filter (where v.etapa = 'acompanhamento') ac, count(*) filter (where v.etapa not in ('diagnostico', 'implantacao', 'acompanhamento')) av
            from public.visitas v
           where v.situacao = 'realizada' and v.data_realizada is not null and v.ficha_id not in (select public.exemplo_fora())
           group by 1) x;

  -- 65: os dois órgãos recebem tudo (perfil, impacto e formação); antes o MDA não via a formação e o MPA não via o perfil e o impacto
    with s as (select x.* from public.fichas x where x.resultado = 'selecionada' and x.situacao = 'aprovada' and x.id not in (select public.exemplo_fora())),
         d as (select x.* from public.diagnosticos x where not coalesce(x.sem_agua, false) and x.ficha_id not in (select public.exemplo_fora())),
         a as (select x.* from public.avaliacoes x where x.ficha_id not in (select public.exemplo_fora())),
         i as (select extract(year from age(hoje, s.data_nascimento))::int idade from s)
    select jsonb_build_object(
      'perfil', jsonb_build_object('base', (select count(*) from s),
        'sustento', public.acomp_n((select count(*) from s where p_sustento)), 'cadunico', public.acomp_n((select count(*) from s where p_cadunico)),
        'sem_ater', public.acomp_n((select count(*) from s where p_sem_ater)), 'raca_povo', public.acomp_n((select count(*) from s where p_raca_povo)),
        'jovem', public.acomp_n((select count(*) from s where p_jovem)), 'grupo', public.acomp_n((select count(*) from s where p_grupo)),
        'caf', public.acomp_n((select count(*) from s where p_caf)),
        'faixas', jsonb_build_object('18 a 29', public.acomp_n((select count(*) from i where idade < 30)), '30 a 44', public.acomp_n((select count(*) from i where idade between 30 and 44)),
                                     '45 a 59', public.acomp_n((select count(*) from i where idade between 45 and 59)), '60 ou mais', public.acomp_n((select count(*) from i where idade >= 60)))),
      'impacto', jsonb_build_object(
        'base_n', (select count(*) from d),
        'renda_quintal_media', case when (select count(*) from d where renda_quintal is not null) >= 5 then (select round(avg(renda_quintal)::numeric, 2) from d where renda_quintal is not null) end,
        'final_n', (select count(*) from a),
        'produz', jsonb_build_object('sim', public.acomp_n((select count(*) from a where quintal_produz = 'sim')), 'em_parte', public.acomp_n((select count(*) from a where quintal_produz = 'em_parte')),
                                     'nao', public.acomp_n((select count(*) from a where quintal_produz = 'nao'))),
        'ebia_final', jsonb_build_object('seguranca', public.acomp_n((select count(*) from a where ebia_nivel = 'seguranca')), 'leve', public.acomp_n((select count(*) from a where ebia_nivel = 'leve')),
                                         'moderada', public.acomp_n((select count(*) from a where ebia_nivel = 'moderada')), 'grave', public.acomp_n((select count(*) from a where ebia_nivel = 'grave')))))
      into v_extra;
    select v_extra || jsonb_build_object('formacao', jsonb_build_object(
        'turmas', (select count(*) from public.turmas_fic t where t.id not in (select public.exemplo_fora())),
        'matriculas', (select count(*) from public.matriculas_fic m where m.cancelada_em is null and m.id not in (select public.exemplo_fora())),
        'encontros', (select count(*) from public.fic_encontros n where n.cancelado_em is null and n.id not in (select public.exemplo_fora()))))
      into v_extra;

  r := jsonb_build_object('orgao', v_org, 'gerado_em', now(), 'hoje', hoje, 'por_uf', v_uf, 'municipios', v_mun, 'mensal', v_mes) || v_extra;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.acompanhamento_formacao(p_orgao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_org text;
begin
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') = 'coord_geral' and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;
  return jsonb_build_object(
    'turmas', (select count(*) from public.turmas_fic t where t.id not in (select public.exemplo_fora())),
    'matriculas', (select count(*) from public.matriculas_fic m where m.cancelada_em is null and m.id not in (select public.exemplo_fora())),
    'encontros', (select count(*) from public.fic_encontros n where n.cancelado_em is null and n.id not in (select public.exemplo_fora())));
end $function$
;

CREATE OR REPLACE FUNCTION public.acompanhamento_equipe_uf(p_orgao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_org text; r jsonb;
begin
  -- a mesma porta da acompanhamento_dados (52): quem acompanha de fora, ou a coordenação vendo a prévia
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') = 'coord_geral' and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;
  with d as (select x.* from public.diagnosticos x join public.fichas f on f.id = x.ficha_id where f.id not in (select public.exemplo_fora()))
  select jsonb_agg(jsonb_build_object('uf', u.uf,
      'equipe_campo', (select count(*) from public.equipe x where x.uf = u.uf and x.status = 'ativa' and x.papel in ('articulacao', 'apoio', 'agente') and x.id not in (select public.exemplo_fora())),
      'habilitadas', (select count(*) from public.equipe x where x.uf = u.uf and x.status = 'ativa' and x.papel in ('articulacao', 'apoio', 'agente') and x.id not in (select public.exemplo_fora()) and public.habilitado(x)),
      'diag_aguardando', (select count(*) from d where d.uf = u.uf and d.situacao = 'aguardando'),
      'diag_devolvidos', (select count(*) from d where d.uf = u.uf and d.situacao = 'devolvido')) order by u.uf)
    into r
    from (values ('AL'), ('BA'), ('PE'), ('PI'), ('SE')) as u(uf);
  return coalesce(r, '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.acompanhamento_extra(p_orgao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_org text; v_previa boolean := false; v_fin text; r jsonb; v_pl public.execucao_planilhas;
begin
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') = 'coord_geral' and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao; v_previa := true;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;

  with p as (select x.* from public.pedidos_apoio x where x.id not in (select public.exemplo_fora())),
       c as (select x.* from public.canais_venda x where x.ativo and x.id not in (select public.exemplo_fora())),
       ag as (select distinct on (s.ficha_id) s.situacao from public.agua_situacoes s where s.ficha_id not in (select public.exemplo_fora()) order by s.ficha_id, s.registrado_em desc),
       en as (select x.* from public.fic_encontros x where x.cancelado_em is null and x.id not in (select public.exemplo_fora())),
       pr as (select x.* from public.fic_presencas x join en on en.id = x.encontro_id),
       dc as (select x.* from public.documentos_projeto x where x.arquivado_em is null and x.id not in (select public.exemplo_fora()))
  select jsonb_build_object(
    'atividades', jsonb_build_object(
      'eventos', jsonb_build_object('autorizados', (select count(*) from p where tipo = 'evento' and situacao = 'autorizado'),
                                    'pedidos', (select count(*) from p where tipo = 'evento' and situacao in ('enviado', 'conferido', 'devolvido')),
                                    'realizados', (select count(*) from p where tipo = 'evento' and situacao = 'autorizado' and data_ref < (now() at time zone 'America/Fortaleza')::date)),
      'intercambio', jsonb_build_object('autorizados', (select count(*) from p where tipo = 'passagem' and situacao = 'autorizado' and coalesce(dados->>'finalidade', 'intercambio') <> 'pedagogico'),
                                        'viagens_feitas', (select count(distinct data_ref) from p where tipo = 'passagem' and situacao = 'autorizado' and coalesce(dados->>'finalidade', 'intercambio') <> 'pedagogico' and data_ref < (now() at time zone 'America/Fortaleza')::date),
                                        'pedidos', (select count(*) from p where tipo = 'passagem' and situacao in ('enviado', 'conferido', 'devolvido') and coalesce(dados->>'finalidade', 'intercambio') <> 'pedagogico')),
      'pedagogico', jsonb_build_object('autorizados', (select count(*) from p where tipo = 'passagem' and situacao = 'autorizado' and dados->>'finalidade' = 'pedagogico'),
                                       'viagens_feitas', (select count(distinct data_ref) from p where tipo = 'passagem' and situacao = 'autorizado' and dados->>'finalidade' = 'pedagogico' and data_ref < (now() at time zone 'America/Fortaleza')::date),
                                       'pedidos', (select count(*) from p where tipo = 'passagem' and situacao in ('enviado', 'conferido', 'devolvido') and dados->>'finalidade' = 'pedagogico'))),
    'canais', jsonb_build_object('por_tipo', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb) from (select tipo, count(*) n from c group by tipo) t),
                                 'municipios', (select count(distinct uf || '|' || public.sem_acento(municipio)) from c)),
    'agua', (select coalesce(jsonb_object_agg(situacao, n), '{}'::jsonb) from (select situacao, count(*) n from ag group by situacao) t),
    'fic', jsonb_build_object('encontros', (select count(*) from en), 'horas', (select coalesce(sum(carga_horaria), 0) from en), 'horas_feitas', (select coalesce(sum(carga_horaria), 0) from en where data <= (now() at time zone 'America/Fortaleza')::date),
                              'feitos', (select count(*) from en where data <= (now() at time zone 'America/Fortaleza')::date),
                              'presencas', (select count(*) from pr where presente), 'marcacoes', (select count(*) from pr)),
    -- 66: só a contagem e a data mais recente por tipo; o título é texto livre e pode ter nome de pessoa
    'documentos', jsonb_build_object('por_tipo', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb) from (select tipo, count(*) n from dc group by tipo) t),
                                     'ultima_data', (select coalesce(jsonb_object_agg(tipo, d), '{}'::jsonb) from (select tipo, max(data_documento) d from dc group by tipo) t)))
    into r;

  -- financeiro: só para o MDA, conforme o parâmetro (somas por item e por mês da última planilha; nada de linha, descrição ou favorecido)
  select coalesce(valor #>> '{}', 'previa') into v_fin from public.parametros where chave = 'acomp_mda_financeiro';
  v_fin := coalesce(v_fin, 'previa');
  if v_org = 'mda' and (v_fin = 'sim' or (v_fin = 'previa' and v_previa)) then
    select * into v_pl from public.execucao_planilhas x where x.id not in (select public.exemplo_fora()) order by x.posicao_em desc, x.enviado_em desc limit 1;
    if v_pl.id is not null then
      r := r || jsonb_build_object('financeiro', jsonb_build_object('liberado', v_fin, 'posicao_em', v_pl.posicao_em, 'enviado_em', v_pl.enviado_em,
        'por_item', (select coalesce(jsonb_agg(jsonb_build_object('item', it, 'rubrica', rb, 'valor', v) order by it, rb), '[]'::jsonb)
                       from (select l->>'item' it, l->>'rubrica' rb, round(sum(case when jsonb_typeof(l->'valor') = 'number' then (l->>'valor')::numeric else 0 end), 2) v from jsonb_array_elements(v_pl.linhas) l group by 1, 2) t),
        'por_mes', (select coalesce(jsonb_agg(jsonb_build_object('mes', m, 'gasto', g, 'recebido', rc) order by m), '[]'::jsonb)
                      from (select case when coalesce(l->>'data', '') ~ '^\d{4}-\d{2}' then left(l->>'data', 7) else to_char(v_pl.posicao_em, 'YYYY-MM') end m,
                                   round(sum(case when l->>'item' = 'repasse_mda' or jsonb_typeof(l->'valor') <> 'number' then 0 else (l->>'valor')::numeric end), 2) g,
                                   round(sum(case when l->>'item' = 'repasse_mda' and jsonb_typeof(l->'valor') = 'number' then (l->>'valor')::numeric else 0 end), 2) rc
                              from jsonb_array_elements(v_pl.linhas) l group by 1) t)));
    else
      r := r || jsonb_build_object('financeiro', jsonb_build_object('liberado', v_fin, 'sem_planilha', true));
    end if;
  end if;
  return r || jsonb_build_object('orgao', v_org);
end $function$
;

commit;

select 'Etapa 66 instalada: correções da auditoria de 15/10/2026' as resultado,
       exists (select 1 from pg_proc where proname = 'acompanhamento_extra' and prosrc like '%ultima_data%') as documentos_sem_titulo,
       exists (select 1 from pg_proc where proname = 'parametros_validar' and prosrc like '%acomp_mda_financeiro%') as recursos_so_coord_geral;
