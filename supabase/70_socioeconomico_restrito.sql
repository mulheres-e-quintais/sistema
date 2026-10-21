-- =====================================================================
-- Mulheres & Quintais — 70: QUESTIONÁRIO SOCIOECONÔMICO SÓ PARA A PRÓPRIA PESSOA E A COORDENAÇÃO GERAL (21/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 69. Pode rodar de novo.
--
-- Antes: as respostas (escolaridade, raça/cor, renda da família, pessoas na casa) ficavam junto dos outros dados
-- pessoais e eram lidas também pela coordenação técnica e pelo auxiliar administrativo (e, no cadastro enviado
-- pelo link, por quem confere). Decisão da coordenação geral: com o nome, só a própria pessoa e a coordenação geral.
--
-- Agora as respostas ficam em tabelas próprias, com regra de acesso própria:
--   equipe_socio          → a própria pessoa (lê, responde, apaga) e a coordenação geral;
--   pre_cadastros_socio   → só a coordenação geral (o que chegou pelo link, até a aprovação).
-- Na aprovação do cadastro enviado pelo link, o banco copia as respostas para equipe_socio (quem aprova não precisa vê-las).
-- O cadastro enviado ganha "socio_respondido" (sim ou não, sem as respostas), para quem confere saber que foi respondido.
-- A coluna antiga continua existindo, sempre vazia: a tela de antes (aparelho sem atualizar) continua funcionando,
-- e o que ela mandar vai para o lugar novo (ou é descartado, se quem mandou não pode ver).
-- Move as respostas que já existem para as tabelas novas.
-- =====================================================================

-- ---------- tabelas ----------
create table if not exists public.equipe_socio (
  equipe_id uuid primary key references public.equipe(id),
  socioeconomico jsonb not null check (jsonb_typeof(socioeconomico) = 'object' and length(socioeconomico::text) <= 8000),
  atualizado_em timestamptz not null default now()
);
alter table public.equipe_socio enable row level security;
revoke all on public.equipe_socio from public, anon, authenticated;
grant select, insert, update, delete on public.equipe_socio to authenticated;
drop policy if exists socio_proprio_ou_geral on public.equipe_socio;
create policy socio_proprio_ou_geral on public.equipe_socio for all to authenticated
  using (equipe_id = (select public.meu_id()) or (select public.meu_papel()) = 'coord_geral')
  with check (equipe_id = (select public.meu_id()) or (select public.meu_papel()) = 'coord_geral');

create table if not exists public.pre_cadastros_socio (
  pre_id uuid primary key references public.pre_cadastros(id) on delete cascade deferrable initially deferred,   -- gravada antes da linha do cadastro (gatilho de antes)
  socioeconomico jsonb not null check (jsonb_typeof(socioeconomico) = 'object' and length(socioeconomico::text) <= 8000)
);
alter table public.pre_cadastros_socio enable row level security;
revoke all on public.pre_cadastros_socio from public, anon, authenticated;
grant select on public.pre_cadastros_socio to authenticated;
drop policy if exists pre_socio_geral on public.pre_cadastros_socio;
create policy pre_socio_geral on public.pre_cadastros_socio for select to authenticated using ((select public.meu_papel()) = 'coord_geral');

alter table public.pre_cadastros add column if not exists socio_respondido boolean not null default false;

-- histórico: só que mudou, nunca as respostas (como no equipe_privado)
create or replace function public.auditar_socio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values (tg_table_name, coalesce(new.equipe_id, old.equipe_id), tg_op, public.meu_id(), null, jsonb_build_object('questionario_socioeconomico', case tg_op when 'DELETE' then 'apagado' else 'respondido' end));
  return coalesce(new, old);
end $$;
revoke all on function public.auditar_socio() from public, anon, authenticated;
drop trigger if exists equipe_socio_auditoria on public.equipe_socio;
create trigger equipe_socio_auditoria after insert or update or delete on public.equipe_socio for each row execute function public.auditar_socio();

-- ---------- o que chega pela coluna antiga vai para o lugar novo ----------
-- equipe_privado: a própria pessoa e a coordenação geral gravam em equipe_socio; de outros perfis, é descartado.
-- A coluna antiga fica sempre vazia. Vazio na coluna antiga NÃO apaga as respostas (quem não vê manda vazio).
create or replace function public.equipe_privado_socio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.socioeconomico is not null and jsonb_typeof(new.socioeconomico) = 'object'
     and (public.meu_id() is null or new.equipe_id = public.meu_id() or coalesce(public.meu_papel(), '') = 'coord_geral') then
    insert into public.equipe_socio (equipe_id, socioeconomico, atualizado_em) values (new.equipe_id, new.socioeconomico, now())
      on conflict (equipe_id) do update set socioeconomico = excluded.socioeconomico, atualizado_em = now();
  end if;
  new.socioeconomico := null;
  return new;
end $$;
revoke all on function public.equipe_privado_socio() from public, anon, authenticated;
drop trigger if exists equipe_privado_a00_socio on public.equipe_privado;
create trigger equipe_privado_a00_socio before insert or update on public.equipe_privado for each row execute function public.equipe_privado_socio();

-- pre_cadastros: as respostas do link vão para pre_cadastros_socio (só a coordenação geral lê); fica só "respondido"
create or replace function public.pre_cadastros_socio_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    -- a resposta vai direto para pre_cadastros_socio (o vínculo é conferido no fim da transação) e não passa pela linha nem pelo histórico
    new.socio_respondido := new.socioeconomico is not null and jsonb_typeof(new.socioeconomico) = 'object';
    if new.socio_respondido then
      insert into public.pre_cadastros_socio (pre_id, socioeconomico) values (new.id, new.socioeconomico)
        on conflict (pre_id) do update set socioeconomico = excluded.socioeconomico;
    end if;
  else
    new.socio_respondido := old.socio_respondido;   -- ninguém muda pela tela
  end if;
  new.socioeconomico := null;
  return new;
end $$;
create or replace function public.pre_cadastros_socio_depois() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.situacao = 'aprovado' and old.situacao is distinct from 'aprovado' and new.equipe_id is not null then
    -- aprovado: as respostas passam para a pessoa (quem aprovou não precisa vê-las) e saem do cadastro enviado
    insert into public.equipe_socio (equipe_id, socioeconomico, atualizado_em)
      select new.equipe_id, s.socioeconomico, now() from public.pre_cadastros_socio s where s.pre_id = new.id
      on conflict (equipe_id) do update set socioeconomico = excluded.socioeconomico, atualizado_em = now();
    delete from public.pre_cadastros_socio where pre_id = new.id;
  elsif new.situacao = 'recusado' and old.situacao is distinct from 'recusado' then
    delete from public.pre_cadastros_socio where pre_id = new.id;   -- recusado: as respostas não ficam guardadas
  end if;
  return new;
end $$;
revoke all on function public.pre_cadastros_socio_antes() from public, anon, authenticated;
revoke all on function public.pre_cadastros_socio_depois() from public, anon, authenticated;
drop trigger if exists pre_cadastros_a00_socio on public.pre_cadastros;
create trigger pre_cadastros_a00_socio before insert or update on public.pre_cadastros for each row execute function public.pre_cadastros_socio_antes();
drop trigger if exists pre_cadastros_z_socio on public.pre_cadastros;
create trigger pre_cadastros_z_socio after update on public.pre_cadastros for each row execute function public.pre_cadastros_socio_depois();

-- ---------- move o que já existe ----------
insert into public.equipe_socio (equipe_id, socioeconomico, atualizado_em)
  select equipe_id, socioeconomico, atualizado_em from public.equipe_privado where socioeconomico is not null and jsonb_typeof(socioeconomico) = 'object'
  on conflict (equipe_id) do nothing;
insert into public.pre_cadastros_socio (pre_id, socioeconomico)
  select id, socioeconomico from public.pre_cadastros where socioeconomico is not null and jsonb_typeof(socioeconomico) = 'object' and situacao = 'aguardando'
  on conflict (pre_id) do nothing;
-- (cadastros já decididos não se alteram pela regra normal: as travas ficam desligadas só nesta limpeza)
alter table public.pre_cadastros disable trigger pre_cadastros_a00_socio;
alter table public.pre_cadastros disable trigger pre_cadastros_z_socio;
alter table public.pre_cadastros disable trigger pre_cadastros_antes;
alter table public.pre_cadastros disable trigger pre_cadastros_auditoria;
update public.pre_cadastros set socio_respondido = (jsonb_typeof(socioeconomico) = 'object'), socioeconomico = null where socioeconomico is not null;
alter table public.pre_cadastros enable trigger pre_cadastros_a00_socio;
alter table public.pre_cadastros enable trigger pre_cadastros_z_socio;
alter table public.pre_cadastros enable trigger pre_cadastros_antes;
alter table public.pre_cadastros enable trigger pre_cadastros_auditoria;
update public.equipe_privado set socioeconomico = null where socioeconomico is not null;   -- o gatilho deixa vazio (o dono do banco grava, sem login)

select 'Etapa 70 instalada: questionário socioeconômico só para a própria pessoa e a coordenação geral' as resultado,
       (select count(*) from public.equipe_socio) as respostas_da_equipe,
       (select count(*) from public.pre_cadastros_socio) as respostas_aguardando_conferencia;
