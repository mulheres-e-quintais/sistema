-- =====================================================================
-- Mulheres & Quintais — Etapa 10: arranjos produtivos locais (APL) por município
-- Usados na "proposta sugerida" do quintal, que a coordenação vê ao analisar o diagnóstico.
-- A coordenação preenche o que conhece de cada município (o sistema não inventa APL).
-- Rodar depois de 01 a 04. Pode rodar de novo sem estragar nada.
-- =====================================================================
create table if not exists public.apl_municipios (
  uf             char(2) not null check (uf in ('AL','BA','PE','PI','SE')),
  municipio      text not null,
  apls           text[] not null default '{}',   -- ex.: {apicultura, caprinocultura, feira agroecológica}
  obs            text,                           -- compradores, feiras, cooperativas, PAA/PNAE no município
  atualizado_por uuid references public.equipe(id),
  atualizado_em  timestamptz not null default now(),
  primary key (uf, municipio)
);
alter table public.apl_municipios enable row level security;
drop policy if exists apl_ler on public.apl_municipios;
drop policy if exists apl_gravar on public.apl_municipios;
drop policy if exists apl_alterar on public.apl_municipios;
create policy apl_ler on public.apl_municipios for select to authenticated using (true);
create policy apl_gravar on public.apl_municipios for insert to authenticated with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy apl_alterar on public.apl_municipios for update to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')) with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
grant select, insert, update on public.apl_municipios to authenticated;

create or replace function public.apl_carimbo() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.atualizado_por := public.meu_id(); new.atualizado_em := now(); return new; end $$;
drop trigger if exists apl_carimbo on public.apl_municipios;
create trigger apl_carimbo before insert or update on public.apl_municipios for each row execute function public.apl_carimbo();

select 'Etapa 10 instalada' as resultado, count(*) as municipios_com_apl from public.apl_municipios;
