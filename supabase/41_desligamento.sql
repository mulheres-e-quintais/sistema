-- =====================================================================
-- Mulheres & Quintais — 41: DESLIGAMENTO COM PENDÊNCIAS (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 11 (turmas do FIC) e do 22 (pedidos de passagem e evento). Não apaga nada.
--
-- 1) Professor(a) do FIC com turma em andamento não é desligado(a): antes, a coordenação passa a turma
--    para outro(a) professor(a) (aba Curso FIC > Editar). Sem isso, a turma fica sem quem registre encontros.
-- 2) Ao desligar alguém, os pedidos de passagem e evento dela que ainda não foram autorizados são cancelados,
--    com o motivo registrado (o pedido não fica andando em nome de quem saiu). Os já autorizados ficam como estão.
-- 3) Pagamento em aberto NÃO impede o desligamento (é direito da pessoa receber pelo que fez); a tela avisa.
-- O bloqueio de visita agendada e diagnóstico devolvido (bolsistas e agentes) continua, do script 08.
-- =====================================================================
begin;

create or replace function public.equipe_desligar_regras() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_turmas text;
begin
  if old.status = 'ativa' and new.status = 'desligada' and old.papel = 'professor_fic' then
    select string_agg(t.nome, ', ' order by t.nome) into v_turmas from public.turmas_fic t
     where t.professor_id = old.id and (t.fim is null or t.fim >= (now() at time zone 'America/Fortaleza')::date);
    if v_turmas is not null then
      raise exception 'Não dá para desligar ainda: é professor(a) da turma em andamento %. Passe a turma para outro(a) professor(a) (aba Curso FIC > Editar) e desligue depois.', v_turmas;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists equipe_desligar_regras on public.equipe;
create trigger equipe_desligar_regras before update of status on public.equipe
  for each row execute function public.equipe_desligar_regras();

create or replace function public.equipe_desligada_pedidos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'ativa' and new.status = 'desligada' and to_regclass('public.pedidos_apoio') is not null then
    update public.pedidos_apoio
       set situacao = 'cancelado',
           obs = coalesce(nullif(trim(obs), '') || ' · ', '') || 'Cancelado pelo sistema: a solicitante foi desligada do projeto em '
                 || to_char(coalesce(new.data_fim, (now() at time zone 'America/Fortaleza')::date), 'DD/MM/YYYY') || '.'
     where solicitante_id = old.id and situacao in ('enviado', 'devolvido', 'conferido');
  end if;
  return new;
end $$;
drop trigger if exists equipe_desligada_pedidos on public.equipe;
create trigger equipe_desligada_pedidos after update of status on public.equipe
  for each row execute function public.equipe_desligada_pedidos();

commit;

select 'Regras de desligamento instaladas' as resultado,
       exists (select 1 from pg_trigger where tgname = 'equipe_desligar_regras') as professor_com_turma,
       exists (select 1 from pg_trigger where tgname = 'equipe_desligada_pedidos') as pedidos_cancelados;
