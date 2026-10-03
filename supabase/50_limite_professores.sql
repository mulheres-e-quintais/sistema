-- =====================================================================
-- Mulheres & Quintais — 50: NO MÁXIMO 2 PROFESSORES DO FIC ATIVOS (decisão da coordenação geral em 03/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 48. NÃO APAGA NENHUM DADO e não altera nenhum cadastro.
--
-- O orçamento prevê 2 professores do curso FIC (2 × 12 meses × R$ 2.200). A partir daqui o banco recusa:
--   * cadastrar (direto ou pelo link) um terceiro professor enquanto houver 2 ativos;
--   * gerar link de cadastro de professor quando as 2 vagas já estão ocupadas.
-- Quem já está cadastrado continua como está. Se hoje houver mais de 2 ativos, ninguém é desligado:
-- o banco só deixa de aceitar novos até que restem menos de 2.
-- Para trocar de professor: desligue um e cadastre o outro.
-- =====================================================================
begin;

create or replace function public.equipe_limite_professores() returns trigger
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s' as $$
begin
  if new.papel = 'professor_fic' and new.status = 'ativa'
     and (tg_op = 'INSERT' or old.status is distinct from 'ativa' or old.papel is distinct from 'professor_fic') then
    perform pg_advisory_xact_lock(hashtext('mq_limite_professores'));   -- dois cadastros ao mesmo tempo: um espera o outro
    if (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa' and id <> new.id) >= 2 then
      raise exception 'O projeto tem no máximo 2 professores do FIC ativos. Desligue um antes de cadastrar outro.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.equipe_limite_professores() from public, anon, authenticated;

drop trigger if exists equipe_limite_professores on public.equipe;
create trigger equipe_limite_professores before insert or update of status, papel on public.equipe
  for each row execute function public.equipe_limite_professores();

create or replace function public.convites_limite_professores() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.papel = 'professor_fic'
     and (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa') >= 2 then
    raise exception 'O projeto tem no máximo 2 professores do FIC ativos. Desligue um antes de convidar outro.';
  end if;
  return new;
end $$;
revoke all on function public.convites_limite_professores() from public, anon, authenticated;

drop trigger if exists convites_limite_professores on public.convites;
create trigger convites_limite_professores before insert on public.convites
  for each row execute function public.convites_limite_professores();

commit;

select 'Etapa 50 instalada: no máximo 2 professores do FIC ativos' as resultado,
       (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa') as professores_ativos_hoje;
