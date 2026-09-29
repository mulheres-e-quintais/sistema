-- =====================================================================
-- Mulheres & Quintais — 24: DOCUMENTOS DO PROJETO (atas, ofícios, relatórios…) — SÓ A COORDENAÇÃO GERAL
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- A coordenação geral anexa os documentos do projeto (arquivo guardado no Storage, pasta privada
-- "documentos") e gera o relatório da ação a partir dos dados do sistema. Nenhum outro perfil lê,
-- envia ou altera. Documento não é apagado: é arquivado com motivo (fica no histórico).
-- =====================================================================
begin;

create table if not exists public.documentos_projeto (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('ata', 'oficio', 'relatorio', 'contrato', 'plano', 'lista_presenca', 'foto', 'outro')),
  titulo          text not null check (length(trim(titulo)) between 5 and 200),
  data_documento  date not null,
  uf              char(2) check (uf in ('AL','BA','PE','PI','SE')),   -- vazio = projeto todo
  descricao       text check (descricao is null or length(descricao) <= 2000),
  arquivo_path    text not null unique,
  arquivo_nome    text not null,
  tamanho         integer check (tamanho is null or (tamanho > 0 and tamanho <= 20971520)),   -- até 20 MB
  mime            text,
  enviado_por     uuid references public.equipe(id),
  enviado_em      timestamptz not null default now(),
  arquivado_em    timestamptz,
  arquivado_por   uuid references public.equipe(id),
  motivo_arquivo  text
);
create index if not exists documentos_projeto_data on public.documentos_projeto (data_documento desc);

alter table public.documentos_projeto enable row level security;
revoke all on public.documentos_projeto from anon, authenticated;
grant select, insert, update on public.documentos_projeto to authenticated;
drop policy if exists docs_geral_ler on public.documentos_projeto;
drop policy if exists docs_geral_incluir on public.documentos_projeto;
drop policy if exists docs_geral_alterar on public.documentos_projeto;
create policy docs_geral_ler on public.documentos_projeto for select to authenticated using (public.meu_papel() = 'coord_geral');
create policy docs_geral_incluir on public.documentos_projeto for insert to authenticated with check (public.meu_papel() = 'coord_geral');
create policy docs_geral_alterar on public.documentos_projeto for update to authenticated
  using (public.meu_papel() = 'coord_geral') with check (public.meu_papel() = 'coord_geral');

-- quem enviou e quando é o sistema que marca; arquivar exige motivo; o arquivo não muda depois de enviado
create or replace function public.documentos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.enviado_por := public.meu_id(); new.enviado_em := now(); new.arquivado_em := null; new.arquivado_por := null; new.motivo_arquivo := null;
  else
    if new.arquivo_path is distinct from old.arquivo_path or new.enviado_por is distinct from old.enviado_por or new.enviado_em is distinct from old.enviado_em then
      raise exception 'O arquivo e quem enviou não mudam. Para trocar o arquivo, arquive este documento e anexe outro.';
    end if;
    if old.arquivado_em is not null and new.arquivado_em is null then raise exception 'Documento arquivado não volta. Anexe de novo, se precisar.'; end if;
    if new.arquivado_em is not null and old.arquivado_em is null then
      if length(trim(coalesce(new.motivo_arquivo, ''))) < 5 then raise exception 'Para arquivar, escreva o motivo.'; end if;
      new.arquivado_por := public.meu_id(); new.arquivado_em := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists documentos_antes on public.documentos_projeto;
create trigger documentos_antes before insert or update on public.documentos_projeto for each row execute function public.documentos_antes();
drop trigger if exists documentos_auditoria on public.documentos_projeto;
create trigger documentos_auditoria after insert or update on public.documentos_projeto for each row execute function public.auditar();

-- pasta privada no Storage: só a coordenação geral lê e envia (sem apagar)
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;
drop policy if exists documentos_ler on storage.objects;
drop policy if exists documentos_enviar on storage.objects;
create policy documentos_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.meu_papel() = 'coord_geral');
create policy documentos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.meu_papel() = 'coord_geral');

commit;

select 'Documentos do projeto instalados' as resultado, to_regclass('public.documentos_projeto') is not null as tabela,
       exists (select 1 from storage.buckets where id = 'documentos') as pasta;
