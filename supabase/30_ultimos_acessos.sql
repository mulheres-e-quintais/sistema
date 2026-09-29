-- =====================================================================
-- Mulheres & Quintais — 30: ÚLTIMOS ACESSOS (quem entrou, quando e de que aparelho)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
--
-- O próprio sistema registra: entrada, primeiro acesso, abertura com sessão já aberta, saída pelo botão,
-- saída por 15 minutos parada e troca de senha. Guarda também o aparelho (ex.: "Android · Chrome")
-- e o IP, lido pelo servidor (o celular não informa o próprio IP).
-- Só a coordenação geral vê. Ninguém grava direto: só pela função, sempre em nome de quem está logado.
-- Guarda 6 meses (mesmo prazo do Marco Civil, por boa prática): o que passar disso é apagado sozinho.
-- =====================================================================
begin;

create table if not exists public.acessos (
  id        bigserial primary key,
  equipe_id uuid not null references public.equipe(id) on delete cascade,
  em        timestamptz not null default now(),
  tipo      text not null check (tipo in ('entrada', 'primeiro_acesso', 'abriu', 'saida', 'saida_inatividade', 'senha_trocada')),
  aparelho  text check (aparelho is null or length(aparelho) <= 80),
  ip        text check (ip is null or length(ip) <= 45)
);
create index if not exists acessos_em on public.acessos (em desc);
create index if not exists acessos_pessoa on public.acessos (equipe_id, em desc);

alter table public.acessos enable row level security;
revoke all on public.acessos from anon, authenticated;
grant select on public.acessos to authenticated;
drop policy if exists acessos_geral_ler on public.acessos;
create policy acessos_geral_ler on public.acessos for select to authenticated using ((select public.meu_papel()) = 'coord_geral');

create or replace function public.registrar_acesso(p_tipo text, p_aparelho text) returns void
language plpgsql security definer set search_path = public as $$
declare eu uuid := public.meu_id(); h json; v_ip text;
begin
  if eu is null then return; end if;   -- sem cadastro ativo: não registra nada
  if p_tipo not in ('entrada', 'primeiro_acesso', 'abriu', 'saida', 'saida_inatividade', 'senha_trocada') then raise exception 'Tipo de acesso inválido.'; end if;
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  -- o Supabase passa os cabeçalhos da requisição; o primeiro endereço da lista é o do aparelho
  v_ip := nullif(trim(split_part(coalesce(h->>'cf-connecting-ip', h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1)), '');
  insert into public.acessos (equipe_id, tipo, aparelho, ip) values (eu, p_tipo, left(nullif(trim(p_aparelho), ''), 80), left(v_ip, 45));
  -- 6 meses: limpa o que passou (de vez em quando, para não pesar em cada entrada)
  if random() < 0.05 then delete from public.acessos where em < now() - interval '6 months'; end if;
end $$;
revoke all on function public.registrar_acesso(text, text) from public, anon;
grant execute on function public.registrar_acesso(text, text) to authenticated;

commit;

select 'Últimos acessos instalado' as resultado, to_regclass('public.acessos') is not null as tabela;
