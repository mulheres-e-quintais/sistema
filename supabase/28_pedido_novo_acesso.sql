-- =====================================================================
-- Mulheres & Quintais — 28: "ESQUECI A SENHA" PELA TELA DE ENTRADA
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo. Precisa do 18.
--
-- Caminho:
--   1) Na tela de entrada, a pessoa toca em "Esqueci a senha", digita o e-mail e envia.
--   2) A coordenação geral vê o pedido na aba Equipe (com número na aba) e abre a ficha da pessoa.
--   3) Ela toca em "Liberar novo primeiro acesso" e manda o código novo pelo WhatsApp cadastrado.
--      O pedido é marcado como atendido sozinho quando o código é gerado.
-- Proteções:
--   - a resposta da tela é SEMPRE a mesma (não revela se o e-mail está cadastrado);
--   - só vira pedido se o e-mail for de alguém ATIVO na equipe; e-mail desconhecido não é guardado;
--   - um pedido em aberto por pessoa (pedir de novo não cria outro);
--   - ninguém recebe código pela tela: quem libera é a coordenação geral, e o código vai para o
--     WhatsApp que já está no cadastro. Quem digitou o e-mail de outra pessoa não ganha nada.
-- =====================================================================
begin;

create table if not exists public.pedidos_novo_acesso (
  id           uuid primary key default gen_random_uuid(),
  equipe_id    uuid not null references public.equipe(id) on delete cascade,
  pedido_em    timestamptz not null default now(),
  vezes        int not null default 1,          -- quantas vezes pediu enquanto estava em aberto
  situacao     text not null default 'aguardando' check (situacao in ('aguardando', 'atendido', 'descartado')),
  resolvido_por uuid references public.equipe(id),
  resolvido_em timestamptz
);
create unique index if not exists pedidos_novo_acesso_um_aberto on public.pedidos_novo_acesso (equipe_id) where situacao = 'aguardando';

alter table public.pedidos_novo_acesso enable row level security;
revoke all on public.pedidos_novo_acesso from anon, authenticated;
grant select, update on public.pedidos_novo_acesso to authenticated;
drop policy if exists pna_geral_ler on public.pedidos_novo_acesso;
drop policy if exists pna_geral_alterar on public.pedidos_novo_acesso;
create policy pna_geral_ler on public.pedidos_novo_acesso for select to authenticated using (public.meu_papel() = 'coord_geral');
create policy pna_geral_alterar on public.pedidos_novo_acesso for update to authenticated
  using (public.meu_papel() = 'coord_geral') with check (public.meu_papel() = 'coord_geral');

-- a coordenação só descarta (atender é gerando o código); quem e quando é o sistema que marca
create or replace function public.pedidos_novo_acesso_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.equipe_id is distinct from old.equipe_id or new.pedido_em is distinct from old.pedido_em then
    raise exception 'O pedido não muda.';
  end if;
  if old.situacao <> 'aguardando' and new.situacao is distinct from old.situacao then raise exception 'Este pedido já foi resolvido.'; end if;
  if new.situacao <> old.situacao then new.resolvido_por := public.meu_id(); new.resolvido_em := now(); end if;
  return new;
end $$;
drop trigger if exists pedidos_novo_acesso_antes on public.pedidos_novo_acesso;
create trigger pedidos_novo_acesso_antes before update on public.pedidos_novo_acesso for each row execute function public.pedidos_novo_acesso_antes();
drop trigger if exists pedidos_novo_acesso_auditoria on public.pedidos_novo_acesso;
create trigger pedidos_novo_acesso_auditoria after insert or update on public.pedidos_novo_acesso for each row execute function public.auditar();

-- chamado da tela de entrada, SEM login. Não devolve nada: a resposta é sempre a mesma.
create or replace function public.pedir_novo_acesso(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.equipe; e text := lower(trim(coalesce(p_email, '')));
begin
  if length(e) < 5 or length(e) > 200 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  select * into m from public.equipe where lower(email) = e and status = 'ativa' limit 1;
  if m.id is null then return; end if;
  update public.pedidos_novo_acesso set vezes = vezes + 1 where equipe_id = m.id and situacao = 'aguardando';
  if not found then
    insert into public.pedidos_novo_acesso (equipe_id) values (m.id);
  end if;
end $$;
revoke all on function public.pedir_novo_acesso(text) from public;
grant execute on function public.pedir_novo_acesso(text) to anon, authenticated;

-- código gerado para a pessoa (gerar_codigo_acesso) = pedido atendido
create or replace function public.acesso_codigo_atende_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pedidos_novo_acesso set situacao = 'atendido', resolvido_por = new.criado_por, resolvido_em = now()
   where equipe_id = new.equipe_id and situacao = 'aguardando';
  return new;
end $$;
drop trigger if exists acesso_codigo_atende_pedido on public.acesso_codigos;
create trigger acesso_codigo_atende_pedido after insert or update on public.acesso_codigos
  for each row execute function public.acesso_codigo_atende_pedido();

commit;

select 'Pedido de novo acesso instalado' as resultado, to_regclass('public.pedidos_novo_acesso') is not null as tabela;
