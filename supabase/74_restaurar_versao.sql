-- =====================================================================
-- Mulheres & Quintais — 74: "Restaurar como estava antes" no Histórico (23/10/2026, igual ao Saberes que Cultivam)
-- Rode depois do 73. Pode rodar de novo sem medo: não apaga dados.
--
-- O histórico (tabela auditoria) já guarda cada registro como era antes de ser alterado (coluna "antes").
-- A função restaurar_versao(linha do histórico) devolve o registro àquele estado.
--   * Só a coordenação geral restaura (só ela lê o histórico).
--   * As regras do banco continuam valendo (limite de selecionadas por estado, visita já paga, prazos...):
--     se a versão antiga não cabe mais, o banco recusa e diz por quê.
--   * Se o registro mudou de novo depois daquela versão, a função não restaura e avisa (conflito); a tela
--     pergunta e só então restaura com p_forcar = true.
--   * A própria restauração entra no histórico, marcada como restauração (coluna obs).
-- Ficam de fora, de propósito: equipe e acessos (dado reservado, login, desligamento), pagamentos, pedidos de
-- passagem e evento (já foram para a FUNCERN e o Arlo), planilhas e documentos (o arquivo não fica guardado),
-- fotos e o próprio histórico. Arquivo, foto e login não voltam por aqui em nenhuma tabela.
-- =====================================================================

alter table public.auditoria add column if not exists obs text;

-- igual à do 01, e agora marca quando a mudança foi uma restauração
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois, obs)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, public.meu_id(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          nullif(current_setting('mq.restaurando', true), ''));
  return coalesce(new, old);
end $$;

create or replace function public.restaurar_versao(p_aud bigint, p_forcar boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.auditoria; cols text; n int; existe boolean;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then
    raise exception 'Só a coordenação geral restaura versões pelo histórico.' using errcode = '42501'; end if;
  select * into a from public.auditoria where id = p_aud;
  if not found then raise exception 'Esta linha do histórico não existe mais.' using errcode = 'P0001'; end if;
  if a.tabela not in ('fichas','visitas','diagnosticos','avaliacoes','kit_itens','fic_encontros','turmas_fic','canais_venda') then
    raise exception 'Este tipo de registro não se restaura pelo histórico.' using errcode = 'P0001'; end if;
  if a.acao <> 'UPDATE' or a.antes is null or a.registro_id is null then
    raise exception 'Só uma alteração pode ser desfeita.' using errcode = 'P0001'; end if;
  -- mudou de novo depois desta versão? não desfaz calado o que alguém corrigiu
  if not p_forcar and exists (select 1 from public.auditoria x where x.tabela = a.tabela and x.registro_id = a.registro_id
                                and x.id > a.id and x.acao in ('INSERT','UPDATE','DELETE')) then
    return jsonb_build_object('ok', false, 'conflito', true);
  end if;
  -- colunas que voltam: as que existiam naquela versão, menos identificação, carimbos, login, arquivo e foto
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position) into cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = a.tabela and c.is_generated = 'NEVER' and c.identity_generation is null
     and c.column_name not in ('id','criado_em','criado_por','atualizado_em','user_id')
     and c.column_name !~ '(arquivo|foto|_path$|_url$)'
     and a.antes ? c.column_name;
  if cols is null then raise exception 'Nada a restaurar nesta linha.' using errcode = 'P0001'; end if;
  execute format('select exists (select 1 from public.%I where id = $1)', a.tabela) into existe using a.registro_id;
  if not existe then raise exception 'O registro não existe mais.' using errcode = 'P0001'; end if;
  perform set_config('mq.restaurando', 'restauração da linha ' || p_aud || ' do histórico', true);
  execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where t.id = $2',
                 a.tabela, cols, cols, a.tabela) using a.antes, a.registro_id;
  get diagnostics n = row_count;
  perform set_config('mq.restaurando', '', true);
  if n = 0 then raise exception 'Nada foi restaurado.' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true, 'tabela', a.tabela, 'id', a.registro_id);
end $$;

revoke execute on function public.restaurar_versao(bigint, boolean) from public, anon;
grant execute on function public.restaurar_versao(bigint, boolean) to authenticated;
