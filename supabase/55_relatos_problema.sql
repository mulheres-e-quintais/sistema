-- =====================================================================
-- Mulheres & Quintais — 55: RELATAR PROBLEMA NO SISTEMA (05/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 54 (ou do 53). Cria uma tabela nova; não mexe em nenhum dado que já existe.
--
-- relatos_problema: o que a pessoa da equipe escreveu quando algo não funcionou, com a tela, a versão do sistema
--   e o aparelho (preenchidos pelo próprio sistema). Sem foto da tela e sem dado de beneficiária.
--   Quem relata: qualquer pessoa ativa da equipe (até 20 por dia). Quem lê tudo e marca como resolvido: a coordenação geral.
--   Cada pessoa lê os próprios relatos. Nada se apaga. Tudo passa pelas funções: ninguém grava direto na tabela.
-- =====================================================================
begin;

create table if not exists public.relatos_problema (
  id            uuid primary key default gen_random_uuid(),
  autor_id      uuid not null references public.equipe(id),
  papel         text not null,
  tela          text check (tela is null or length(tela) <= 60),
  versao        text check (versao is null or length(versao) <= 20),
  aparelho      text check (aparelho is null or length(aparelho) <= 200),
  texto         text not null check (length(trim(texto)) between 10 and 1000),
  status        text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  nota          text check (nota is null or length(nota) <= 400),
  resolvido_por uuid references public.equipe(id),
  resolvido_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index if not exists relatos_problema_status on public.relatos_problema (status, criado_em desc);
create index if not exists relatos_problema_autor on public.relatos_problema (autor_id, criado_em desc);
alter table public.relatos_problema enable row level security;
revoke all on public.relatos_problema from public, anon, authenticated;

create or replace function public.relatos_nao_apaga() returns trigger language plpgsql as $$
begin raise exception 'Relato de problema não se apaga: marque como resolvido.'; end $$;
drop trigger if exists relatos_problema_nao_apaga on public.relatos_problema;
create trigger relatos_problema_nao_apaga before delete on public.relatos_problema for each row execute function public.relatos_nao_apaga();

create or replace function public.relatar_problema(p_texto text, p_tela text, p_versao text, p_aparelho text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id(); papel text := coalesce(public.meu_papel(), ''); v uuid; t text := trim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'));
begin
  if eu is null or papel = '' then raise exception 'Entre no sistema para relatar um problema.'; end if;
  if length(t) < 10 then raise exception 'Conte o que aconteceu com um pouco mais de detalhe (pelo menos 10 letras).'; end if;
  if length(t) > 1000 then raise exception 'O relato pode ter até 1000 letras.'; end if;
  if (select count(*) from public.relatos_problema r where r.autor_id = eu and r.criado_em > now() - interval '1 day') >= 20 then
    raise exception 'Você já enviou 20 relatos hoje. Fale com a coordenação geral.';
  end if;
  insert into public.relatos_problema (autor_id, papel, tela, versao, aparelho, texto)
    values (eu, papel, nullif(left(trim(coalesce(p_tela, '')), 60), ''), nullif(left(trim(coalesce(p_versao, '')), 20), ''), nullif(left(trim(coalesce(p_aparelho, '')), 200), ''), t)
    returning id into v;
  return v;
end $$;

create or replace function public.listar_relatos()
returns table (id uuid, autor text, papel text, tela text, versao text, aparelho text, texto text, status text, nota text, resolvido_em timestamptz, criado_em timestamptz, meu boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, e.nome, r.papel, r.tela, r.versao, r.aparelho, r.texto, r.status, r.nota, r.resolvido_em, r.criado_em, r.autor_id = public.meu_id()
    from public.relatos_problema r join public.equipe e on e.id = r.autor_id
   where public.meu_id() is not null and (coalesce(public.meu_papel(), '') = 'coord_geral' or r.autor_id = public.meu_id())
   order by (r.status = 'aberto') desc, r.criado_em desc
   limit 500;
$$;

create or replace function public.resolver_relato(p_id uuid, p_nota text, p_reabrir boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id();
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral marca um relato como resolvido.'; end if;
  if length(coalesce(p_nota, '')) > 400 then raise exception 'A anotação pode ter até 400 letras.'; end if;
  update public.relatos_problema set status = case when p_reabrir then 'aberto' else 'resolvido' end,
         nota = nullif(trim(coalesce(p_nota, '')), ''), resolvido_por = case when p_reabrir then null else eu end, resolvido_em = case when p_reabrir then null else now() end
   where id = p_id;
  if not found then raise exception 'Relato não encontrado.'; end if;
end $$;

revoke all on function public.relatar_problema(text, text, text, text) from public, anon;
revoke all on function public.listar_relatos() from public, anon;
revoke all on function public.resolver_relato(uuid, text, boolean) from public, anon;
grant execute on function public.relatar_problema(text, text, text, text) to authenticated;
grant execute on function public.listar_relatos() to authenticated;
grant execute on function public.resolver_relato(uuid, text, boolean) to authenticated;

commit;

select 'Relato de problema instalado' as resultado, (select count(*) from public.relatos_problema) as relatos;
