-- =====================================================================
-- Mulheres & Quintais — 22: PEDIDOS DE PASSAGEM AÉREA E DE ESTRUTURA DE EVENTO
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
--
-- Caminho (Guia "Viagens, ajuda de custo e eventos"):
--   bolsista de articulação territorial pede  →  coordenação técnica confere (ou devolve)
--   →  coordenação geral autoriza e manda para a FUNCERN (ou recusa/devolve).
-- Só veem os pedidos: quem pediu, a coordenação técnica e a coordenação geral.
-- Prazos: passagem 40 dias antes da viagem; evento 45 dias antes. Fora do prazo, só com justificativa.
-- Os dados das passageiras (CPF, RG, nascimento) NÃO vão para o histórico, só a situação do pedido.
-- =====================================================================
begin;

create table if not exists public.pedidos_apoio (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (tipo in ('passagem', 'evento')),
  uf               char(2) not null check (uf in ('AL','BA','PE','PI','SE')),
  solicitante_id   uuid not null references public.equipe(id),
  titulo           text not null check (length(trim(titulo)) between 5 and 200),
  data_ref         date not null,                 -- ida da viagem ou dia do evento
  dados            jsonb not null default '{}'::jsonb,
  justificativa_prazo text,
  situacao         text not null default 'enviado'
                     check (situacao in ('enviado', 'devolvido', 'conferido', 'autorizado', 'recusado', 'cancelado')),
  enviado_em       timestamptz not null default now(),
  conferido_por    uuid references public.equipe(id),
  conferido_em     timestamptz,
  decidido_por     uuid references public.equipe(id),
  decidido_em      timestamptz,
  obs              text,                          -- motivo da devolução ou da recusa
  funcern_protocolo text,
  criado_em        timestamptz not null default now()
);
create index if not exists pedidos_apoio_sit on public.pedidos_apoio (situacao);

alter table public.pedidos_apoio enable row level security;
revoke all on public.pedidos_apoio from anon, authenticated;
grant select on public.pedidos_apoio to authenticated;   -- gravar, só pelas funções abaixo
drop policy if exists pedidos_ler on public.pedidos_apoio;
create policy pedidos_ler on public.pedidos_apoio for select to authenticated
  using (solicitante_id = public.meu_id() or coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico'));

-- histórico sem os dados pessoais das passageiras
create or replace function public.auditar_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, public.meu_id(),
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'dados' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'dados' end);
  return coalesce(new, old);
end $$;
drop trigger if exists pedidos_apoio_auditoria on public.pedidos_apoio;
create trigger pedidos_apoio_auditoria after insert or update on public.pedidos_apoio
  for each row execute function public.auditar_pedido();

-- ---------------------------------------------------------------------
-- A bolsista de articulação envia (ou reenvia, depois de devolvido)
-- ---------------------------------------------------------------------
create or replace function public.salvar_pedido_apoio(p_id uuid, p_tipo text, p_titulo text, p_data date, p_dados jsonb, p_justificativa text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.equipe; p public.pedidos_apoio; v_id uuid; antecedencia int := case p_tipo when 'passagem' then 40 when 'evento' then 45 end;
        v_pass jsonb; n int;
begin
  select * into eu from public.equipe where id = public.meu_id() and status = 'ativa';
  if eu.id is null or eu.papel <> 'articulacao' then
    raise exception 'Quem pede passagem e estrutura de evento é a bolsista de articulação territorial.';
  end if;
  if antecedencia is null then raise exception 'Tipo de pedido inválido.'; end if;
  if p_data is null or p_data < current_date then raise exception 'Informe uma data que ainda não passou.'; end if;
  if p_data > date '2027-09-30' then raise exception 'A data passa do fim do projeto (setembro de 2027).'; end if;
  if p_data < current_date + antecedencia and length(trim(coalesce(p_justificativa, ''))) < 15 then
    raise exception 'Pedido fora do prazo (% dias antes). Escreva a justificativa.', antecedencia;
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 5 then raise exception 'Escreva o objetivo e a atividade do projeto.'; end if;
  if p_tipo = 'passagem' then
    v_pass := p_dados->'passageiros';
    n := coalesce(jsonb_array_length(case when jsonb_typeof(v_pass) = 'array' then v_pass end), 0);
    if n < 1 then raise exception 'Informe pelo menos uma passageira ou passageiro.'; end if;
    if exists (select 1 from jsonb_array_elements(v_pass) x
               where regexp_replace(coalesce(x->>'cpf', ''), '\D', '', 'g') !~ '^[0-9]{11}$'
                  or length(trim(coalesce(x->>'nome', ''))) < 5 or coalesce(x->>'nascimento', '') = ''
                  or coalesce(x->>'rg', '') = '') then
      raise exception 'Falta nome, CPF, RG ou nascimento de alguma passageira.';
    end if;
    if coalesce(p_dados->>'volta', '') <> '' and (p_dados->>'volta')::date < p_data then raise exception 'A volta é antes da ida.'; end if;
  end if;

  if p_id is null then
    insert into public.pedidos_apoio (tipo, uf, solicitante_id, titulo, data_ref, dados, justificativa_prazo)
      values (p_tipo, eu.uf, eu.id, trim(p_titulo), p_data, coalesce(p_dados, '{}'), nullif(trim(p_justificativa), ''))
      returning id into v_id;
    return v_id;
  end if;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null or p.solicitante_id <> eu.id then raise exception 'Pedido não encontrado.'; end if;
  if p.situacao <> 'devolvido' then raise exception 'Só dá para corrigir pedido devolvido.'; end if;
  if p.tipo <> p_tipo then raise exception 'Não dá para mudar o tipo do pedido.'; end if;
  update public.pedidos_apoio set titulo = trim(p_titulo), data_ref = p_data, dados = coalesce(p_dados, '{}'),
    justificativa_prazo = nullif(trim(p_justificativa), ''), situacao = 'enviado', enviado_em = now(),
    conferido_por = null, conferido_em = null, decidido_por = null, decidido_em = null where id = p_id;
  return p_id;
end $$;

-- ---------------------------------------------------------------------
-- Andamento: conferir, devolver, autorizar, recusar, cancelar, protocolo
-- ---------------------------------------------------------------------
create or replace function public.mover_pedido_apoio(p_id uuid, p_acao text, p_obs text, p_protocolo text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.pedidos_apoio; papel text := coalesce(public.meu_papel(), ''); eu uuid := public.meu_id(); v_obs text := nullif(trim(p_obs), '');
begin
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p_acao = 'conferir' then
    if papel not in ('coord_tecnico', 'coord_geral') then raise exception 'Quem confere é a coordenação técnica.'; end if;
    if p.situacao <> 'enviado' then raise exception 'Este pedido não está esperando conferência.'; end if;
    update public.pedidos_apoio set situacao = 'conferido', conferido_por = eu, conferido_em = now(), obs = null where id = p_id;
  elsif p_acao = 'devolver' then
    if not ((papel in ('coord_tecnico', 'coord_geral') and p.situacao = 'enviado') or (papel = 'coord_geral' and p.situacao = 'conferido')) then
      raise exception 'Este pedido não pode ser devolvido agora.';
    end if;
    if length(coalesce(v_obs, '')) < 5 then raise exception 'Para devolver, escreva o que precisa ser corrigido.'; end if;
    update public.pedidos_apoio set situacao = 'devolvido', obs = v_obs, decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'autorizar' then
    if papel <> 'coord_geral' then raise exception 'Quem autoriza e manda para a FUNCERN é a coordenação geral.'; end if;
    if p.situacao <> 'conferido' then raise exception 'Só pedido conferido pela coordenação técnica pode ser autorizado.'; end if;
    update public.pedidos_apoio set situacao = 'autorizado', decidido_por = eu, decidido_em = now(), obs = v_obs,
      funcern_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
  elsif p_acao = 'recusar' then
    if papel <> 'coord_geral' then raise exception 'Quem recusa é a coordenação geral.'; end if;
    if p.situacao not in ('enviado', 'conferido') then raise exception 'Este pedido não pode ser recusado agora.'; end if;
    if length(coalesce(v_obs, '')) < 5 then raise exception 'Escreva o motivo da recusa.'; end if;
    update public.pedidos_apoio set situacao = 'recusado', obs = v_obs, decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'cancelar' then
    if p.solicitante_id <> eu then raise exception 'Só quem pediu pode cancelar.'; end if;
    if p.situacao not in ('enviado', 'devolvido') then raise exception 'Depois de conferido, peça à coordenação para cancelar.'; end if;
    update public.pedidos_apoio set situacao = 'cancelado', obs = coalesce(v_obs, 'Cancelado por quem pediu.'), decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'protocolo' then
    if papel <> 'coord_geral' then raise exception 'Só a coordenação geral registra o protocolo da FUNCERN.'; end if;
    if p.situacao <> 'autorizado' then raise exception 'Só pedido autorizado tem protocolo.'; end if;
    update public.pedidos_apoio set funcern_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
  else
    raise exception 'Ação inválida.';
  end if;
end $$;

revoke all on function public.salvar_pedido_apoio(uuid, text, text, date, jsonb, text), public.mover_pedido_apoio(uuid, text, text, text) from public, anon;
grant execute on function public.salvar_pedido_apoio(uuid, text, text, date, jsonb, text), public.mover_pedido_apoio(uuid, text, text, text) to authenticated;

commit;

select 'Passagens e eventos instalados' as resultado, to_regclass('public.pedidos_apoio') is not null as tabela;
