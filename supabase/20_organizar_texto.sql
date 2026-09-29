-- =====================================================================
-- Mulheres & Quintais — ORGANIZAR TEXTO (controle de uso da IA)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Registra cada uso do botão "Organizar o texto" (quem e quando, sem o texto) e limita
-- a 60 usos por pessoa a cada 24 horas, para o gasto com a API não sair do controle.
-- =====================================================================
begin;

create table if not exists public.ia_usos (
  id        bigint generated always as identity primary key,
  equipe_id uuid not null references public.equipe(id) on delete cascade,
  em        timestamptz not null default now()
);
create index if not exists ia_usos_pessoa on public.ia_usos (equipe_id, em);
alter table public.ia_usos enable row level security;
drop policy if exists ia_usos_ler on public.ia_usos;
create policy ia_usos_ler on public.ia_usos for select to authenticated
  using (public.meu_papel() = 'coord_geral');
revoke insert, update, delete on public.ia_usos from anon, authenticated;
grant select on public.ia_usos to authenticated;   -- a regra acima deixa só a coordenação geral ver

create or replace function public.registrar_uso_ia() returns boolean
language plpgsql security definer set search_path = public as $$
declare eu uuid := public.meu_id();
begin
  if eu is null then return false; end if;
  if (select count(*) from public.ia_usos where equipe_id = eu and em > now() - interval '24 hours') >= 60 then
    return false;
  end if;
  insert into public.ia_usos (equipe_id) values (eu);
  return true;
end $$;
revoke all on function public.registrar_uso_ia() from public, anon;
grant execute on function public.registrar_uso_ia() to authenticated;

commit;

select 'Controle de uso do "Organizar o texto" instalado' as resultado;
