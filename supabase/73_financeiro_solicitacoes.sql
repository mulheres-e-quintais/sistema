-- =====================================================================
-- Mulheres & Quintais — 73: FINANCEIRO COM A PLANILHA DE SOLICITAÇÕES DA FUNCERN (22/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 72. Pode rodar de novo.
--
-- A aba Financeiro passa a ler a exportação de SOLICITAÇÕES da FUNCERN (a mesma que o sistema do Saberes que Cultivam importa):
-- solicitação ainda não paga entra na planilha com situacao = 'comprometido'. O resumo financeiro que o MDA vê
-- (acompanhamento_extra) passa a somar só o que foi PAGO, como a tela da coordenação geral.
-- Não muda tabela nem registro: só a função.
-- =====================================================================

create or replace function public.acompanhamento_extra(p_orgao text DEFAULT NULL::text)
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
    -- 72: planilha descartada não vale; a que vale é a ÚLTIMA ENVIADA (a mesma regra da tela da coordenação geral)
    select * into v_pl from public.execucao_planilhas x where x.id not in (select public.exemplo_fora()) and x.descartada_em is null
     order by x.enviado_em desc, x.posicao_em desc limit 1;
    if v_pl.id is not null then
      r := r || jsonb_build_object('financeiro', jsonb_build_object('liberado', v_fin, 'posicao_em', v_pl.posicao_em, 'enviado_em', v_pl.enviado_em,
        'por_item', (select coalesce(jsonb_agg(jsonb_build_object('item', it, 'rubrica', rb, 'valor', v) order by it, rb), '[]'::jsonb)
                       from (select l->>'item' it, l->>'rubrica' rb, round(sum(case when jsonb_typeof(l->'valor') = 'number' then (l->>'valor')::numeric else 0 end), 2) v from jsonb_array_elements(v_pl.linhas) l where coalesce(l->>'situacao', '') <> 'comprometido' group by 1, 2) t),
        'por_mes', (select coalesce(jsonb_agg(jsonb_build_object('mes', m, 'gasto', g, 'recebido', rc) order by m), '[]'::jsonb)
                      from (select case when coalesce(l->>'data', '') ~ '^\d{4}-\d{2}' then left(l->>'data', 7) else to_char(v_pl.posicao_em, 'YYYY-MM') end m,
                                   round(sum(case when l->>'item' = 'repasse_mda' or jsonb_typeof(l->'valor') <> 'number' then 0 else (l->>'valor')::numeric end), 2) g,
                                   round(sum(case when l->>'item' = 'repasse_mda' and jsonb_typeof(l->'valor') = 'number' then (l->>'valor')::numeric else 0 end), 2) rc
                              from jsonb_array_elements(v_pl.linhas) l where coalesce(l->>'situacao', '') <> 'comprometido' group by 1) t)));
    else
      r := r || jsonb_build_object('financeiro', jsonb_build_object('liberado', v_fin, 'sem_planilha', true));
    end if;
  end if;
  return r || jsonb_build_object('orgao', v_org);
end $function$;

select 'Etapa 73 instalada: o resumo financeiro do MDA conta só o pago (solicitação ainda não paga é comprometido)' as resultado;
