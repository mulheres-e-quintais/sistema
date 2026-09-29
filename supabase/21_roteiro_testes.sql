-- =====================================================================
-- Mulheres & Quintais — 21: ROTEIRO DE TESTES (respostas "Deu certo / Não deu certo")
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Cada pessoa da equipe responde, no próprio celular, as tarefas do roteiro do seu perfil.
-- Só a própria pessoa grava e vê as suas respostas; a coordenação geral vê todas.
-- =====================================================================
begin;

create table if not exists public.testes_resultados (
  equipe_id  uuid not null references public.equipe(id) on delete cascade,
  tarefa     text not null check (tarefa ~ '^[a-z_]+-[0-9]{2}$'),
  resultado  text not null check (resultado in ('ok', 'nao', 'pulou')),
  comentario text check (comentario is null or length(comentario) <= 2000),
  aparelho   text check (aparelho is null or length(aparelho) <= 120),
  em         timestamptz not null default now(),
  primary key (equipe_id, tarefa)
);
alter table public.testes_resultados enable row level security;

create or replace function public.testes_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.equipe_id := public.meu_id();
  if new.equipe_id is null then raise exception 'Entre no sistema para responder.'; end if;
  new.em := now();
  return new;
end $$;
drop trigger if exists testes_antes on public.testes_resultados;
create trigger testes_antes before insert or update on public.testes_resultados
  for each row execute function public.testes_antes();

drop policy if exists testes_ler on public.testes_resultados;
create policy testes_ler on public.testes_resultados for select to authenticated
  using (equipe_id = public.meu_id() or public.meu_papel() = 'coord_geral');
drop policy if exists testes_gravar on public.testes_resultados;
create policy testes_gravar on public.testes_resultados for insert to authenticated
  with check (equipe_id = public.meu_id());
drop policy if exists testes_mudar on public.testes_resultados;
create policy testes_mudar on public.testes_resultados for update to authenticated
  using (equipe_id = public.meu_id()) with check (equipe_id = public.meu_id());
drop policy if exists testes_apagar on public.testes_resultados;
create policy testes_apagar on public.testes_resultados for delete to authenticated
  using (public.meu_papel() = 'coord_geral');
grant select, insert, update, delete on public.testes_resultados to authenticated;

commit;

select 'Roteiro de testes instalado' as resultado, to_regclass('public.testes_resultados') is not null as tabela;
