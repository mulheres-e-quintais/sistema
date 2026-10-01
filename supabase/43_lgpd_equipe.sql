-- =====================================================================
-- Mulheres & Quintais — 43: PROTEÇÃO DOS DADOS DA EQUIPE E CONTA DA COORDENAÇÃO GERAL (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 42. NÃO APAGA NENHUM DADO e não altera nenhum cadastro.
--
-- 1. LGPD: a bolsista (articulação e apoio) deixa de ler o cadastro completo das colegas do estado.
--    Continua vendo o que precisa para trabalhar: nome, função, município, foto, telefone de quem está ativa
--    e as datas da habilitação (curso FIC, Arlo, termo). CPF, e-mail, SIAPE, observações da habilitação,
--    motivo do desligamento e o arquivo do termo ficam só com a coordenação e o auxiliar.
--    Quem foi desligada aparece só com o nome e a data de saída.
-- 2. Conta da coordenação geral: a primeira senha (instalação nova) continua sem código. Depois que a conta
--    já foi usada, recriar a senha com o e-mail da coordenação geral passa a exigir um código, gerado aqui
--    no SQL Editor:   select public.codigo_coordenacao_geral();
--    Assim, se o login dela for apagado, ninguém "toma" o e-mail criando uma senha antes.
-- =====================================================================
begin;

-- 1. leitura da equipe -----------------------------------------------------
drop policy if exists equipe_ler on public.equipe;
create policy equipe_ler on public.equipe for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico','auxiliar_adm') or user_id = auth.uid());

create or replace function public.equipe_do_estado() returns table (
  id uuid, papel text, uf char(2), nome text, nome_social text, municipio text, organizacao text, telefone text,
  data_inicio date, data_fim date, status text, substitui_id uuid, criado_em timestamptz, foto_path text,
  matricula_fic_em date, docs_funcern_em date, termo_assinado_em date,
  meta_diagnosticos int, meta_quintais int, meta_visitas int)
language sql stable security definer set search_path = public as $$
  select e.id, e.papel, e.uf, e.nome, e.nome_social, e.municipio, e.organizacao,
         case when e.status = 'ativa' then e.telefone end,
         e.data_inicio, e.data_fim, e.status, e.substitui_id, e.criado_em, case when e.status = 'ativa' then e.foto_path end,
         case when e.status = 'ativa' then e.matricula_fic_em end, case when e.status = 'ativa' then e.docs_funcern_em end,
         case when e.status = 'ativa' then e.termo_assinado_em end,
         e.meta_diagnosticos, e.meta_quintais, e.meta_visitas
    from public.equipe e
   where coalesce(public.meu_papel(), '') in ('articulacao','apoio')
     and e.uf = public.minha_uf() and e.user_id is distinct from auth.uid()
   order by e.criado_em;
$$;
revoke all on function public.equipe_do_estado() from public, anon;
grant execute on function public.equipe_do_estado() to authenticated;

-- 2. conta da coordenação geral --------------------------------------------
create table if not exists public.contas_ja_ligadas (equipe_id uuid primary key references public.equipe(id), em timestamptz not null default now());
alter table public.contas_ja_ligadas enable row level security;
revoke all on public.contas_ja_ligadas from anon, authenticated;
-- quem já tem login hoje conta como "já entrou" (só acrescenta linhas nesta tabela nova)
insert into public.contas_ja_ligadas (equipe_id) select id from public.equipe where user_id is not null on conflict do nothing;

create or replace function public.ligar_conta_criada() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  update public.equipe set user_id = new.id
   where lower(email::text) = lower(new.email::text) and status = 'ativa' and user_id is null
  returning id into v;
  if v is not null then
    delete from public.acesso_codigos where equipe_id = v;
    insert into public.contas_ja_ligadas (equipe_id) values (v) on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.bloquear_conta_nao_cadastrada() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.equipe; k public.acesso_codigos;
begin
  select * into m from public.equipe
   where lower(email::text) = lower(new.email::text) and status = 'ativa' and user_id is null limit 1;
  if m.id is null then raise exception 'E-mail não cadastrado no projeto.'; end if;
  -- quem roda SQL direto no painel do Supabase (dono do banco) não precisa de código
  if session_user in ('postgres', 'supabase_admin') then return new; end if;
  select * into k from public.acesso_codigos where equipe_id = m.id;
  if k.equipe_id is null then
    -- instalação nova: a coordenação geral cria a PRIMEIRA senha sem código; depois disso, só com código (codigo_hash)
    if m.papel = 'coord_geral' and not exists (select 1 from public.contas_ja_ligadas c where c.equipe_id = m.id) then return new; end if;
    raise exception 'Código de acesso não gerado.';
  end if;
  if k.expira_em < now() then raise exception 'Código de acesso vencido.'; end if;
  if k.hash <> public.codigo_hash(m.id, new.raw_user_meta_data ->> 'codigo') then raise exception 'Código de acesso errado.'; end if;
  return new;
end $$;

-- código para a coordenação geral recriar a senha: só no SQL Editor (o app não alcança esta função)
create or replace function public.codigo_coordenacao_geral() returns text
language plpgsql security definer set search_path = public as $$
declare m public.equipe;
begin
  select * into m from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1;
  if m.id is null then raise exception 'Coordenação geral não cadastrada.'; end if;
  if m.user_id is not null then raise exception 'A coordenação geral já tem senha. Use "Esqueci a senha" na tela de entrada.'; end if;
  return public.novo_codigo_acesso(m.id, null) || '  (vale 7 dias; use em "Primeiro acesso" com o e-mail ' || m.email || ')';
end $$;
revoke all on function public.codigo_coordenacao_geral() from public, anon, authenticated;

commit;

select 'Proteção dos dados da equipe instalada' as resultado,
       (select count(*) from public.contas_ja_ligadas) as contas_que_ja_entraram,
       exists (select 1 from public.equipe e join public.contas_ja_ligadas c on c.equipe_id = e.id where e.papel = 'coord_geral') as coordenacao_geral_ja_entrou;
