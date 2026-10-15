-- =====================================================================
-- Mulheres & Quintais — 64: A PRÉVIA "VER COMO O MDA / O MPA VÊ" MOSTRA TAMBÉM OS DADOS DE EXEMPLO E DE SIMULAÇÃO
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 63. Pode rodar de novo.
-- Quem acompanha DE VERDADE (MDA, MPA) continua sem ver dado de exemplo: só a coordenação, na prévia, vê a conta com eles.
-- A vitrine pública também continua sem eles. Não muda nenhum registro: só troca 3 funções de contagem.
-- =====================================================================

-- quais registros ficam fora da conta: os de exemplo, para quem não é da coordenação; para a coordenação (na prévia), nenhum
create or replace function public.exemplo_fora() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $f$
  select e.id from public.exemplo e where coalesce(public.meu_papel(), '') not in ('coord_geral', 'coord_tecnico')
$f$;
revoke all on function public.exemplo_fora() from public, anon;
grant execute on function public.exemplo_fora() to authenticated;

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
    if coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico') and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
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

  if v_org = 'mda' then
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
  else
    select jsonb_build_object('formacao', jsonb_build_object(
        'turmas', (select count(*) from public.turmas_fic t where t.id not in (select public.exemplo_fora())),
        'matriculas', (select count(*) from public.matriculas_fic m where m.id not in (select public.exemplo_fora())),
        'encontros', (select count(*) from public.fic_encontros n where n.id not in (select public.exemplo_fora()))))
      into v_extra;
  end if;

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
    if coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico') and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
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
    if coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico') and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
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


select 'Etapa 64 instalada: a prévia do MDA e do MPA conta também os dados de exemplo' as resultado,
       exists (select 1 from pg_proc where proname = 'exemplo_fora') as previa_com_exemplo;
