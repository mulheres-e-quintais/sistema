-- =====================================================================
-- Mulheres & Quintais — 59: CORRIGE O DESLIGAMENTO (auditoria de 12/10/2026, 2ª rodada)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 58. Pode rodar de novo.
-- Não apaga nem muda nenhum registro: só troca funções.
--
-- 1. O script 57 criou a conferência de pagamento a pedir com o MESMO NOME da trava do script 08
--    (equipe_desligar_pendencias), e a trava antiga foi substituída: visita agendada e diagnóstico devolvido
--    deixaram de impedir o desligamento. Aqui a conferência de pagamento ganha nome próprio
--    (equipe_desligar_pagamento) e a trava do 08 volta como era. As duas valem.
-- 2. "Desligar assim mesmo" (desligar_sem_pedido) não desliga a coordenação geral nem quem não tem pendência
--    (antes gravava no histórico "com pendência" sem haver nenhuma).
-- =====================================================================

-- ---------- 1a. conferência de pagamento a pedir, com nome próprio ----------
create or replace function public.equipe_desligar_pagamento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare nv int; nd int;
begin
  if old.status = 'ativa' and new.status = 'desligada' then
    select visitas_sem_pedido, pedidos_devolvidos into nv, nd from public.pendencias_pagamento(old.id);
    if (nv > 0 or nd > 0)
       and not (coalesce(current_setting('mq.desligar_sem_pedido', true), '') = old.id::text and coalesce(public.meu_papel(), '') = 'coord_geral') then
      raise exception 'Não dá para desligar ainda: % visita(s) feita(s) sem pedido de ajuda de custo e % pedido(s) devolvido(s) para corrigir. Peça que ela faça o pedido antes: depois de desligada, ela não entra mais no sistema. Se ela não responder, a coordenação geral pode desligar assim mesmo, justificando.', nv, nd;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.equipe_desligar_pagamento() from public, anon, authenticated;
drop trigger if exists a1_desligar_pendencias on public.equipe;
create trigger a1_desligar_pendencias before update of status on public.equipe for each row execute function public.equipe_desligar_pagamento();

-- ---------- 1b. a trava do 08 de volta: visita agendada e diagnóstico devolvido (bolsistas e agentes) ----------
create or replace function public.equipe_desligar_pendencias() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pd jsonb;
begin
  if old.status = 'ativa' and new.status = 'desligada' and old.papel in ('agente','articulacao','apoio') then
    pd := public.pendencias_campo(old.id);
    if (pd->>'visitas')::int > 0 or (pd->>'diagnosticos')::int > 0 then
      raise exception 'Não dá para desligar ainda: % visita(s) agendada(s) com ela e % diagnóstico(s) devolvido(s) para ela corrigir. Passe as visitas para outra pessoa ou cancele, e resolva os diagnósticos.',
        pd->>'visitas', pd->>'diagnosticos';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.equipe_desligar_pendencias() from public, anon, authenticated;
drop trigger if exists equipe_desligar_pendencias on public.equipe;
create trigger equipe_desligar_pendencias before update of status on public.equipe
  for each row execute function public.equipe_desligar_pendencias();

-- ---------- 2. "desligar assim mesmo": só para quem tem pendência, nunca a coordenação geral ----------
create or replace function public.desligar_sem_pedido(p_equipe uuid, p_data date, p_motivo text, p_justificativa text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare nv int; nd int; alvo public.equipe;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral desliga quem ainda tem pagamento a pedir.'; end if;
  select * into alvo from public.equipe where id = p_equipe;
  if alvo.id is null or alvo.status <> 'ativa' then raise exception 'Cadastro não encontrado ou já desligado.'; end if;
  if alvo.papel = 'coord_geral' then raise exception 'A coordenação geral não é desligada por aqui.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 20 then raise exception 'Explique por que ela não fez o pedido (pelo menos 20 letras).'; end if;
  if length(p_justificativa) > 2000 or length(coalesce(p_motivo, '')) > 2000 then raise exception 'Texto muito longo (máximo 2.000 caracteres).'; end if;
  select visitas_sem_pedido, pedidos_devolvidos into nv, nd from public.pendencias_pagamento(p_equipe);
  if nv + nd = 0 then raise exception 'Ela não tem pagamento a pedir: use o desligamento normal.'; end if;
  perform set_config('mq.desligar_sem_pedido', p_equipe::text, true);
  update public.equipe set status = 'desligada', data_fim = p_data, motivo_desligamento = p_motivo where id = p_equipe and status = 'ativa';
  if not found then raise exception 'Cadastro não encontrado ou já desligado.'; end if;
  perform set_config('mq.desligar_sem_pedido', '', true);
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('equipe', p_equipe, 'DESLIGAR_COM_PENDENCIA', public.meu_id(), null,
          jsonb_build_object('visitas_sem_pedido', nv, 'pedidos_devolvidos', nd, 'justificativa', trim(p_justificativa)));
end $$;
revoke all on function public.desligar_sem_pedido(uuid, date, text, text) from public, anon;
grant execute on function public.desligar_sem_pedido(uuid, date, text, text) to authenticated;

select 'Etapa 59 instalada: desligamento com as duas travas (08 e 57)' as resultado,
       (select count(*) from pg_trigger where not tgisinternal and tgname in ('equipe_desligar_pendencias', 'a1_desligar_pendencias')) as gatilhos_deve_ser_2;
