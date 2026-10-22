-- =====================================================================
-- Mulheres & Quintais — 72: DESCARTAR PLANILHA DE GASTOS ENVIADA POR ENGANO (22/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 71. Pode rodar de novo.
--
-- Até aqui a planilha enviada não se alterava nem se apagava (prestação de contas). Uma planilha enviada por engano
-- (arquivo errado, mês errado) ficava valendo até chegar outra. Agora a coordenação geral DESCARTA, com o motivo:
--   - a planilha descartada sai de todas as contas (painel financeiro e acompanhamento do MDA); vale a última enviada
--     que não foi descartada;
--   - o arquivo pode ser apagado da pasta privada "execucao" (só o de planilha descartada);
--   - o registro continua na lista e no histórico como "descartada": quem enviou, quem descartou, quando e por quê.
-- Descartar não se desfaz: para voltar, envie a planilha de novo.
-- Também alinha o acompanhamento do MDA à regra da tela: vale a ÚLTIMA ENVIADA (antes ele usava a de data mais nova).
-- Não muda nenhum registro.
-- =====================================================================
alter table public.execucao_planilhas add column if not exists descartada_em timestamptz;
alter table public.execucao_planilhas add column if not exists descartada_por uuid references public.equipe(id);
alter table public.execucao_planilhas add column if not exists motivo_descarte text;
alter table public.execucao_planilhas drop constraint if exists tam_motivo_descarte_1000;
alter table public.execucao_planilhas add constraint tam_motivo_descarte_1000 check (length(motivo_descarte) <= 1000) not valid;

-- a planilha continua sem alteração e sem exclusão; a única mudança aceita é o descarte, uma vez, pela função abaixo
create or replace function public.execucao_planilhas_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('mq.descartar_planilha', true), '') = old.id::text
     and old.descartada_em is null and new.descartada_em is not null
     and (to_jsonb(new) - array['descartada_em', 'descartada_por', 'motivo_descarte']) = (to_jsonb(old) - array['descartada_em', 'descartada_por', 'motivo_descarte']) then
    return new;
  end if;
  if tg_op <> 'INSERT' then raise exception 'Planilha enviada não se altera nem se apaga. Se foi enviada por engano, descarte (com o motivo) ou envie uma nova: a última enviada é a que vale.'; end if;
  new.enviado_por := public.meu_id(); new.enviado_em := now();
  new.descartada_em := null; new.descartada_por := null; new.motivo_descarte := null;
  if new.posicao_em > (now() at time zone 'America/Fortaleza')::date then raise exception 'A data da planilha não pode ser no futuro.'; end if;
  if new.posicao_em < date '2026-01-01' then raise exception 'Data da planilha fora do período do projeto.'; end if;
  if new.arquivo_path !~ '^\d{4}/[\w.-]+$' then raise exception 'Caminho do arquivo inválido.'; end if;
  -- 47: totais da planilha: números de verdade, não negativos ("NaN" e valores absurdos são recusados)
  if new.total_gasto is null or new.total_recebido is null or not (new.total_gasto >= 0 and new.total_gasto < 1000000000)
     or not (new.total_recebido >= 0 and new.total_recebido < 1000000000) then
    raise exception 'Os totais da planilha vieram com valor que o sistema não aceita (negativo ou que não é número). Confira a planilha e envie de novo.';
  end if;
  return new;
end $$;
drop trigger if exists execucao_planilhas_auditoria on public.execucao_planilhas;
create trigger execucao_planilhas_auditoria after insert or update on public.execucao_planilhas for each row execute function public.auditar();

create or replace function public.descartar_planilha_exec(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_mot text := nullif(trim(p_motivo), ''); pl public.execucao_planilhas;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral descarta planilha de gastos.'; end if;
  if length(coalesce(v_mot, '')) < 5 then raise exception 'Escreva o motivo do descarte (por exemplo: arquivo errado, mês errado).'; end if;
  if length(v_mot) > 1000 then raise exception 'Texto muito longo em motivo do descarte (máximo 1.000 caracteres).'; end if;
  select * into pl from public.execucao_planilhas where id = p_id for update;
  if pl.id is null then raise exception 'Planilha não encontrada.'; end if;
  if pl.descartada_em is not null then raise exception 'Esta planilha já foi descartada.'; end if;
  perform set_config('mq.descartar_planilha', p_id::text, true);
  update public.execucao_planilhas set descartada_em = now(), descartada_por = public.meu_id(), motivo_descarte = v_mot where id = p_id;
  perform set_config('mq.descartar_planilha', '', true);
end $$;
revoke all on function public.descartar_planilha_exec(uuid, text) from public, anon;
grant execute on function public.descartar_planilha_exec(uuid, text) to authenticated;

-- pasta privada: a coordenação geral apaga o arquivo SÓ de planilha descartada (as outras continuam sem apagar)
drop policy if exists execucao_apagar_descartada on storage.objects;
create policy execucao_apagar_descartada on storage.objects for delete to authenticated
  using (bucket_id = 'execucao' and public.meu_papel() = 'coord_geral'
         and exists (select 1 from public.execucao_planilhas x where x.arquivo_path = storage.objects.name and x.descartada_em is not null));

-- acompanhamento do MDA: sem a descartada, e a última enviada é a que vale
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
end $function$;

select 'Etapa 72 instalada: descartar planilha de gastos enviada por engano' as resultado;
