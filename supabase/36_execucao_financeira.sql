-- =====================================================================
-- Mulheres & Quintais — 36: EXECUÇÃO FINANCEIRA (painel da coordenação geral, 30/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 01 (meu_papel, meu_id, auditar).
--
-- O orçamento (previsto por rubrica) fica no sistema, copiado da planilha atualizada de apoio do TED.
-- Bolsas e ajudas de custo lançadas no Arlo, passagens e eventos autorizados entram sozinhos.
-- O resto (implantação dos quintais, diárias, locação, combustível, equipamento, taxa da FUNCERN,
-- bolsas pagas fora do sistema) e os repasses do MDA a coordenação geral lança aqui.
-- Só a coordenação geral lê e lança. Nada é alterado nem apagado: erro se corrige com ESTORNO
-- (um lançamento negativo que aponta o original, com motivo). Tudo vai para o histórico.
-- Também tira do público a função pode_matricular (sobra de permissão achada na revisão de 30/09).
-- =====================================================================
begin;

create table if not exists public.execucao_lancamentos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('despesa', 'repasse')),
  item        text not null check (item ~ '^[a-z0-9_]{2,40}$'),            -- item do orçamento (código do sistema)
  valor       numeric(14,2) not null check (valor <> 0 and abs(valor) <= 2000000),
  data        date not null,
  documento   text check (documento is null or length(documento) <= 120),  -- nota fiscal, ordem bancária, nota de crédito…
  descricao   text check (descricao is null or length(descricao) <= 500),
  estorno_de  uuid references public.execucao_lancamentos(id),
  criado_por  uuid references public.equipe(id),
  criado_em   timestamptz not null default now()
);
create index if not exists execucao_lancamentos_data on public.execucao_lancamentos (data desc);
create unique index if not exists execucao_um_estorno on public.execucao_lancamentos (estorno_de) where estorno_de is not null;

alter table public.execucao_lancamentos enable row level security;
revoke all on public.execucao_lancamentos from anon, authenticated;
grant select, insert on public.execucao_lancamentos to authenticated;          -- sem update e sem delete
drop policy if exists exec_geral_ler on public.execucao_lancamentos;
drop policy if exists exec_geral_incluir on public.execucao_lancamentos;
create policy exec_geral_ler on public.execucao_lancamentos for select to authenticated using (public.meu_papel() = 'coord_geral');
create policy exec_geral_incluir on public.execucao_lancamentos for insert to authenticated with check (public.meu_papel() = 'coord_geral');

create or replace function public.execucao_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.execucao_lancamentos;
begin
  if tg_op <> 'INSERT' then raise exception 'Lançamento não se altera nem se apaga. Para corrigir, faça um estorno.'; end if;
  new.criado_por := public.meu_id(); new.criado_em := now();
  if new.data > current_date then raise exception 'A data do lançamento não pode ser no futuro.'; end if;
  if new.data < date '2026-01-01' or new.data > date '2028-12-31' then raise exception 'Data fora do período do projeto.'; end if;
  if new.estorno_de is null then
    if new.valor < 0 then raise exception 'Valor negativo só em estorno.'; end if;
  else
    select * into o from public.execucao_lancamentos where id = new.estorno_de;
    if o.id is null then raise exception 'Lançamento a estornar não encontrado.'; end if;
    if o.estorno_de is not null then raise exception 'Não se estorna um estorno.'; end if;
    if length(trim(coalesce(new.descricao, ''))) < 10 then raise exception 'Para estornar, escreva o motivo (pelo menos 10 letras).'; end if;
    new.tipo := o.tipo; new.item := o.item; new.valor := -o.valor;              -- o estorno anula exatamente o original
  end if;
  return new;
end $$;
drop trigger if exists execucao_antes on public.execucao_lancamentos;
create trigger execucao_antes before insert or update or delete on public.execucao_lancamentos for each row execute function public.execucao_antes();
drop trigger if exists execucao_auditoria on public.execucao_lancamentos;
create trigger execucao_auditoria after insert on public.execucao_lancamentos for each row execute function public.auditar();

-- sobra de permissão: pode_matricular só para quem está logado (para o público já devolvia sempre "não")
revoke execute on function public.pode_matricular(uuid) from public, anon;
grant execute on function public.pode_matricular(uuid) to authenticated;

commit;

select 'Execução financeira instalada' as resultado, to_regclass('public.execucao_lancamentos') is not null as tabela,
       not has_function_privilege('anon', 'public.pode_matricular(uuid)', 'execute') as pode_matricular_fechada;
