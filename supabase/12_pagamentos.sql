-- =====================================================================
-- Mulheres & Quintais — Etapa 12: visita feita (implantação e acompanhamento) e
-- solicitação de pagamento: pessoa solicita → aval → auxiliar lança no Arlo.
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Rodar depois de 01 a 11. Pode rodar de novo sem estragar nada.
-- =====================================================================
-- O que o banco garante:
--   * Implantação e acompanhamento só contam como feitos com data (não futura) e relato do que foi feito.
--   * Ajuda de custo: quem fez as visitas (bolsista ou agente de campo, habilitada) solicita as visitas
--     feitas no mês. Cada visita entra numa solicitação só. Depois de solicitada, a visita não muda
--     (para corrigir, a solicitação precisa ser devolvida).
--   * Bolsa mensal: a própria bolsista solicita, com o relatório de atividades do mês.
--   * Aval: a coordenação técnica. A bolsa da própria coordenação técnica, dos professores do FIC e
--     dos auxiliares vai para a coordenação geral. A coordenação geral também pode dar o aval quando a
--     técnica não puder (vaga aberta, afastamento). Ninguém dá aval na própria solicitação.
--   * Com o aval, a solicitação chega ao auxiliar administrativo, que lança no Arlo e registra aqui
--     (data e número do protocolo, se houver). A coordenação geral também pode registrar.
--   * Tudo vai para o histórico. Não há acesso direto às tabelas: só pelas funções abaixo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Visita feita: relato e fotos (implantação e acompanhamento)
-- ---------------------------------------------------------------------
alter table public.visitas add column if not exists relato text;
alter table public.visitas add column if not exists fotos text[] not null default '{}';

create or replace function public.visitas_feita() returns trigger
language plpgsql as $$
begin
  if new.situacao = 'realizada' and old.situacao is distinct from 'realizada' and new.etapa <> 'diagnostico' then
    if new.data_realizada is null or new.data_realizada > current_date then
      raise exception 'Informe a data em que a visita foi feita (não pode ser no futuro).';
    end if;
    if length(trim(coalesce(new.relato, ''))) < 20 then
      raise exception 'Conte em poucas linhas o que foi feito na visita (pelo menos 20 letras).';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists visitas_feita on public.visitas;
create trigger visitas_feita before update on public.visitas for each row execute function public.visitas_feita();

-- ---------------------------------------------------------------------
-- 2. Solicitações de pagamento
-- ---------------------------------------------------------------------
create table if not exists public.solicitacoes_pagamento (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (tipo in ('ajuda_custo','bolsa')),
  equipe_id        uuid not null references public.equipe(id),
  mes              date not null check (extract(day from mes) = 1),
  valor_solicitado numeric(10,2) check (valor_solicitado is null or valor_solicitado >= 0),
  valor_avalizado  numeric(10,2) check (valor_avalizado is null or valor_avalizado >= 0),
  relatorio        text,
  detalhe          jsonb not null default '{}'::jsonb,
  situacao         text not null default 'solicitada' check (situacao in ('solicitada','devolvida','avalizada','lancada')),
  solicitada_em    timestamptz not null default now(),
  aval_por         uuid references public.equipe(id),
  aval_em          timestamptz,
  obs_aval         text,
  arlo_por         uuid references public.equipe(id),
  arlo_em          timestamptz,
  arlo_protocolo   text,
  constraint uma_por_mes unique (tipo, equipe_id, mes)
);
create table if not exists public.solicitacao_visitas (
  visita_id       uuid primary key references public.visitas(id),   -- cada visita numa solicitação só
  solicitacao_id  uuid not null references public.solicitacoes_pagamento(id)
);

alter table public.solicitacoes_pagamento enable row level security;
alter table public.solicitacao_visitas enable row level security;
revoke all on public.solicitacoes_pagamento, public.solicitacao_visitas from anon, authenticated;
grant select on public.solicitacoes_pagamento, public.solicitacao_visitas to authenticated;
drop policy if exists solic_ler on public.solicitacoes_pagamento;
create policy solic_ler on public.solicitacoes_pagamento for select to authenticated
  using (equipe_id = public.meu_id() or coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','auxiliar_adm'));
drop policy if exists solic_vis_ler on public.solicitacao_visitas;
create policy solic_vis_ler on public.solicitacao_visitas for select to authenticated
  using (exists (select 1 from public.solicitacoes_pagamento s where s.id = solicitacao_id
                  and (s.equipe_id = public.meu_id() or coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','auxiliar_adm'))));

drop trigger if exists solicitacoes_auditoria on public.solicitacoes_pagamento;
create trigger solicitacoes_auditoria after insert or update on public.solicitacoes_pagamento for each row execute function public.auditar();

-- visita já solicitada não muda (data, pessoa, situação), até a solicitação ser devolvida
create or replace function public.visitas_trava_pagamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.situacao is distinct from old.situacao or new.data_realizada is distinct from old.data_realizada or new.executor_id is distinct from old.executor_id)
     and exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                  where sv.visita_id = old.id and s.situacao in ('solicitada','avalizada','lancada')) then
    raise exception 'Esta visita já está numa solicitação de pagamento. Para mudar, a solicitação precisa ser devolvida pela coordenação.';
  end if;
  return new;
end $$;
drop trigger if exists visitas_trava_pagamento on public.visitas;
create trigger visitas_trava_pagamento before update on public.visitas for each row execute function public.visitas_trava_pagamento();

-- quem dá o aval nesta solicitação
create or replace function public.quem_avaliza(p_tipo text, p_papel text) returns text
language sql immutable as $$
  select case when p_tipo = 'bolsa' and p_papel in ('coord_tecnico','professor_fic','auxiliar_adm') then 'coord_geral' else 'coord_tecnico' end
$$;

-- ---------------------------------------------------------------------
-- 3. Funções: solicitar, dar o aval (ou devolver), registrar no Arlo
-- ---------------------------------------------------------------------
create or replace function public.solicitar_pagamento(p_tipo text, p_mes date, p_valor numeric, p_relatorio text, p_visitas uuid[], p_detalhe jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.equipe; v_mes date := date_trunc('month', p_mes)::date; s public.solicitacoes_pagamento; v_id uuid; n int; ruins int;
begin
  select * into eu from public.equipe where id = public.meu_id();
  if eu.id is null or eu.status <> 'ativa' then raise exception 'Entre no sistema para solicitar.'; end if;
  if p_tipo = 'ajuda_custo' and eu.papel not in ('articulacao','apoio','agente') then
    raise exception 'Ajuda de custo é só para bolsistas e agentes de campo que fazem visitas.';
  end if;
  if p_tipo = 'bolsa' and eu.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm') then
    raise exception 'Seu perfil não recebe bolsa mensal pelo projeto.';
  end if;
  if not public.habilitado(eu) then raise exception 'Sua habilitação ainda não está completa: sem ela não há pagamento.'; end if;
  if v_mes > date_trunc('month', current_date)::date then raise exception 'Só dá para solicitar o mês atual ou meses anteriores.'; end if;
  select * into s from public.solicitacoes_pagamento where tipo = p_tipo and equipe_id = eu.id and mes = v_mes for update;
  if s.id is not null and s.situacao <> 'devolvida' then raise exception 'Você já solicitou este mês. Acompanhe a situação na lista.'; end if;

  if p_tipo = 'ajuda_custo' then
    n := coalesce(array_length(p_visitas, 1), 0);
    if n = 0 then raise exception 'Marque as visitas feitas no mês.'; end if;
    select count(*) into ruins from unnest(p_visitas) x(id)
      left join public.visitas v on v.id = x.id
     where v.id is null or v.executor_id <> eu.id or v.situacao <> 'realizada' or date_trunc('month', v.data_realizada)::date <> v_mes
        or exists (select 1 from public.solicitacao_visitas sv where sv.visita_id = x.id and sv.solicitacao_id is distinct from s.id);
    if ruins > 0 then raise exception 'Há visita que não é sua, não está feita, é de outro mês ou já foi solicitada.'; end if;
    if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido.'; end if;
  else
    if length(trim(coalesce(p_relatorio, ''))) < 50 then raise exception 'Escreva o relatório de atividades do mês (pelo menos algumas linhas).'; end if;
  end if;

  if s.id is null then
    insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio, detalhe)
      values (p_tipo, eu.id, v_mes, p_valor, nullif(trim(p_relatorio), ''), coalesce(p_detalhe, '{}'::jsonb)) returning id into v_id;
  else
    update public.solicitacoes_pagamento set situacao = 'solicitada', valor_solicitado = p_valor, valor_avalizado = null, relatorio = nullif(trim(p_relatorio), ''),
      detalhe = coalesce(p_detalhe, '{}'::jsonb), solicitada_em = now(), aval_por = null, aval_em = null where id = s.id;
    v_id := s.id;
    delete from public.solicitacao_visitas where solicitacao_id = s.id;
  end if;
  if p_tipo = 'ajuda_custo' then
    insert into public.solicitacao_visitas (visita_id, solicitacao_id) select x, v_id from unnest(p_visitas) x;
  end if;
  return v_id;
end $$;

create or replace function public.avalizar_pagamento(p_id uuid, p_ok boolean, p_obs text, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
declare s public.solicitacoes_pagamento; quem public.equipe; papel text := coalesce(public.meu_papel(), '');
begin
  select * into s from public.solicitacoes_pagamento where id = p_id for update;
  if s.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if s.situacao <> 'solicitada' then raise exception 'Esta solicitação não está aguardando aval.'; end if;
  select * into quem from public.equipe where id = s.equipe_id;
  if s.equipe_id = public.meu_id() then raise exception 'Ninguém dá o aval na própria solicitação.'; end if;
  if not (papel = 'coord_geral' or papel = public.quem_avaliza(s.tipo, quem.papel)) then
    raise exception 'O aval desta solicitação é da %.', case public.quem_avaliza(s.tipo, quem.papel) when 'coord_geral' then 'coordenação geral' else 'coordenação técnica' end;
  end if;
  if p_ok then
    update public.solicitacoes_pagamento set situacao = 'avalizada', valor_avalizado = coalesce(p_valor, s.valor_solicitado),
      aval_por = public.meu_id(), aval_em = now(), obs_aval = nullif(trim(p_obs), '') where id = p_id;
  else
    if length(trim(coalesce(p_obs, ''))) < 5 then raise exception 'Para devolver, escreva o que precisa ser corrigido.'; end if;
    update public.solicitacoes_pagamento set situacao = 'devolvida', aval_por = public.meu_id(), aval_em = now(), obs_aval = trim(p_obs) where id = p_id;
    delete from public.solicitacao_visitas where solicitacao_id = p_id;   -- as visitas ficam livres para corrigir
  end if;
end $$;

create or replace function public.registrar_no_arlo(p_id uuid, p_protocolo text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.solicitacoes_pagamento;
begin
  if coalesce(public.meu_papel(), '') not in ('auxiliar_adm','coord_geral') then
    raise exception 'Quem lança o pagamento no Arlo é o auxiliar administrativo.';
  end if;
  select * into s from public.solicitacoes_pagamento where id = p_id for update;
  if s.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if s.situacao <> 'avalizada' then raise exception 'Só solicitação com aval vai para o Arlo.'; end if;
  if s.equipe_id = public.meu_id() then raise exception 'O seu próprio pagamento é lançado pelo outro auxiliar ou pela coordenação geral.'; end if;
  update public.solicitacoes_pagamento set situacao = 'lancada', arlo_por = public.meu_id(), arlo_em = now(), arlo_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
end $$;

revoke all on function public.solicitar_pagamento(text, date, numeric, text, uuid[], jsonb), public.avalizar_pagamento(uuid, boolean, text, numeric),
  public.registrar_no_arlo(uuid, text) from public, anon;
grant execute on function public.solicitar_pagamento(text, date, numeric, text, uuid[], jsonb), public.avalizar_pagamento(uuid, boolean, text, numeric),
  public.registrar_no_arlo(uuid, text) to authenticated;

select 'Etapa 12 instalada' as resultado,
       (select count(*) from public.solicitacoes_pagamento where situacao = 'solicitada') as aguardando_aval,
       (select count(*) from public.solicitacoes_pagamento where situacao = 'avalizada') as para_o_arlo;
