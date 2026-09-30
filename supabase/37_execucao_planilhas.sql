-- =====================================================================
-- Mulheres & Quintais — 37: EXECUÇÃO PELA PLANILHA DO MÊS (30/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 01 (meu_papel, meu_id, auditar).
--
-- Todo mês a coordenação geral envia a planilha de gastos do projeto (retrato completo desde o início).
-- A mais nova vale; as anteriores ficam guardadas no histórico (nada se apaga nem se altera).
-- O arquivo original vai para a pasta privada "execucao"; as linhas lidas ficam aqui, para o painel.
-- Só a coordenação geral envia e lê. Substitui o lançamento à mão do 36 (a tabela do 36 fica, sem uso).
-- =====================================================================
begin;

create table if not exists public.execucao_planilhas (
  id            uuid primary key default gen_random_uuid(),
  posicao_em    date not null,                                          -- os gastos valem até esta data
  arquivo_path  text not null unique,
  arquivo_nome  text not null check (length(arquivo_nome) between 1 and 200),
  linhas        jsonb not null check (jsonb_typeof(linhas) = 'array' and jsonb_array_length(linhas) between 1 and 5000),
  total_gasto   numeric(14,2) not null,
  total_recebido numeric(14,2) not null default 0,
  nao_classificadas integer not null default 0 check (nao_classificadas >= 0),
  obs           text check (obs is null or length(obs) <= 500),
  enviado_por   uuid references public.equipe(id),
  enviado_em    timestamptz not null default now()
);
create index if not exists execucao_planilhas_posicao on public.execucao_planilhas (posicao_em desc, enviado_em desc);

alter table public.execucao_planilhas enable row level security;
revoke all on public.execucao_planilhas from anon, authenticated;
grant select, insert on public.execucao_planilhas to authenticated;          -- sem update e sem delete
drop policy if exists expl_geral_ler on public.execucao_planilhas;
drop policy if exists expl_geral_incluir on public.execucao_planilhas;
create policy expl_geral_ler on public.execucao_planilhas for select to authenticated using (public.meu_papel() = 'coord_geral');
create policy expl_geral_incluir on public.execucao_planilhas for insert to authenticated with check (public.meu_papel() = 'coord_geral');

create or replace function public.execucao_planilhas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Planilha enviada não se altera nem se apaga. Envie uma nova: a mais recente é a que vale.'; end if;
  new.enviado_por := public.meu_id(); new.enviado_em := now();
  if new.posicao_em > current_date then raise exception 'A data da planilha não pode ser no futuro.'; end if;
  if new.posicao_em < date '2026-01-01' then raise exception 'Data da planilha fora do período do projeto.'; end if;
  if new.arquivo_path !~ '^\d{4}/[\w.-]+$' then raise exception 'Caminho do arquivo inválido.'; end if;
  return new;
end $$;
drop trigger if exists execucao_planilhas_antes on public.execucao_planilhas;
create trigger execucao_planilhas_antes before insert or update or delete on public.execucao_planilhas for each row execute function public.execucao_planilhas_antes();
drop trigger if exists execucao_planilhas_auditoria on public.execucao_planilhas;
create trigger execucao_planilhas_auditoria after insert on public.execucao_planilhas for each row execute function public.auditar();

-- pasta privada no Storage: só a coordenação geral lê e envia (sem apagar, sem trocar)
insert into storage.buckets (id, name, public) values ('execucao', 'execucao', false) on conflict (id) do nothing;
drop policy if exists execucao_ler on storage.objects;
drop policy if exists execucao_enviar on storage.objects;
create policy execucao_ler on storage.objects for select to authenticated
  using (bucket_id = 'execucao' and public.meu_papel() = 'coord_geral');
create policy execucao_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'execucao' and public.meu_papel() = 'coord_geral');

commit;

select 'Execução pela planilha do mês instalada' as resultado, to_regclass('public.execucao_planilhas') is not null as tabela,
       exists (select 1 from storage.buckets where id = 'execucao') as pasta;
