-- =====================================================================
-- Mulheres & Quintais — 35: TETOS DE PASSAGENS E EVENTOS (decisão da coordenação geral, 29/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo. Precisa do 22 e do 26.
--
--   Evento ............ até R$ 6.000,00 por estado (soma dos eventos autorizados do estado)
--   Passagem aérea .... até R$ 70.000,00 no projeto todo (soma das passagens autorizadas)
-- Quem pede (a bolsista de articulação, como já era) informa o valor estimado.
-- A coordenação geral confirma o valor ao autorizar (pode ajustar pelo orçamento da FUNCERN).
-- O banco não autoriza se o valor passar do saldo. Pedido recusado ou cancelado não conta.
-- =====================================================================
begin;

alter table public.pedidos_apoio add column if not exists valor_autorizado numeric(12,2) check (valor_autorizado is null or valor_autorizado > 0);

-- valor estimado: obrigatório em pedido novo ou corrigido (fica nos dados do pedido)
create or replace function public.pedidos_apoio_valor() returns trigger
language plpgsql security definer set search_path = public as $$
declare v numeric; teto numeric; usado numeric;
begin
  if tg_op = 'INSERT' or new.dados is distinct from old.dados then
    begin v := nullif(new.dados->>'valor_estimado', '')::numeric; exception when others then v := null; end;
    if v is null or v <= 0 then raise exception 'Informe o valor estimado do pedido (R$).'; end if;
  end if;
  -- autorizar: confere o saldo (um pedido de cada vez, para dois ao mesmo tempo não passarem do teto)
  if tg_op = 'UPDATE' and new.situacao = 'autorizado' and old.situacao <> 'autorizado' then
    perform pg_advisory_xact_lock(hashtext('teto_' || new.tipo));
    begin new.valor_autorizado := coalesce(new.valor_autorizado, nullif(new.dados->>'valor_estimado', '')::numeric);
    exception when others then new.valor_autorizado := null; end;
    if new.valor_autorizado is null or new.valor_autorizado <= 0 then raise exception 'Informe o valor para autorizar.'; end if;
    if new.tipo = 'evento' then
      teto := 6000;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio where tipo = 'evento' and uf = new.uf and situacao = 'autorizado' and id <> new.id;
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de eventos de % (R$ 6.000,00): já autorizado R$ %, saldo R$ %.', new.uf, to_char(usado, 'FM999G990D00'), to_char(teto - usado, 'FM999G990D00');
      end if;
    else
      teto := 70000;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado' and id <> new.id;
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de passagens do projeto (R$ 70.000,00): já autorizado R$ %, saldo R$ %.', to_char(usado, 'FM999G990D00'), to_char(teto - usado, 'FM999G990D00');
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists pedidos_apoio_valor on public.pedidos_apoio;
create trigger pedidos_apoio_valor before insert or update on public.pedidos_apoio for each row execute function public.pedidos_apoio_valor();

-- a coordenação geral ajusta o valor antes de autorizar
create or replace function public.definir_valor_pedido(p_id uuid, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral define o valor autorizado.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  update public.pedidos_apoio set valor_autorizado = round(p_valor, 2) where id = p_id and situacao = 'conferido';
  if not found then raise exception 'Só dá para definir o valor de pedido conferido, antes de autorizar.'; end if;
end $$;
revoke all on function public.definir_valor_pedido(uuid, numeric) from public, anon;
grant execute on function public.definir_valor_pedido(uuid, numeric) to authenticated;

-- saldos (só totais, nenhum dado pessoal): a bolsista vê o saldo antes de pedir
create or replace function public.saldo_passagens_eventos() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'passagem_teto', 70000,
    'passagem_usado', (select coalesce(sum(valor_autorizado), 0) from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado'),
    'evento_teto', 6000,
    'evento_usado', coalesce((select jsonb_object_agg(uf, s) from (select uf, sum(valor_autorizado) s from public.pedidos_apoio
                              where tipo = 'evento' and situacao = 'autorizado' group by uf) x), '{}'::jsonb))
$$;
revoke all on function public.saldo_passagens_eventos() from public, anon;
grant execute on function public.saldo_passagens_eventos() to authenticated;

commit;

select 'Tetos de passagens e eventos instalados' as resultado, public.saldo_passagens_eventos() as saldo_agora;
