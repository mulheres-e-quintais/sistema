-- =====================================================================
-- Mulheres & Quintais — ENTREGAS DO MÊS e CIÊNCIA DO GUIA
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo sem estragar nada.
--
-- entregas_mes: o que o sistema não consegue saber sozinho entre as entregas mensais do Guia das bolsistas:
--   'presenca' → a própria bolsista marca que entregou as listas de presença do mês;
--   'ava'      → o professor do FIC (ou a coordenação geral) confirma o acesso ao AVA no mês.
--   (fotos, fichas, relatório e metas o sistema calcula pelas visitas e pelo pedido de bolsa)
-- ciencias: registro de que a pessoa leu os pontos importantes do Guia ("Li e entendi"). Não se apaga.
-- perfil: perguntas do perfil no campo (é agricultora, atua com mulheres rurais, movimento, experiência…)
--   para coordenação técnica, bolsistas e agentes; entra no cadastro à mão e no link de cadastro.
-- =====================================================================
begin;

create table if not exists public.entregas_mes (
  equipe_id  uuid not null references public.equipe(id) on delete cascade,
  mes        date not null check (extract(day from mes) = 1),
  item       text not null check (item in ('presenca', 'ava')),
  marcado_por uuid,
  marcado_em timestamptz not null default now(),
  primary key (equipe_id, mes, item)
);
alter table public.entregas_mes enable row level security;

create or replace function public.entregas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.marcado_por := public.meu_id();
  new.marcado_em := now();
  if new.mes > date_trunc('month', now())::date then raise exception 'Mês no futuro.'; end if;
  return new;
end $$;
drop trigger if exists entregas_antes on public.entregas_mes;
create trigger entregas_antes before insert on public.entregas_mes
  for each row execute function public.entregas_antes();

drop policy if exists entregas_ler on public.entregas_mes;
create policy entregas_ler on public.entregas_mes for select to authenticated
  using (equipe_id = public.meu_id()
         or public.meu_papel() in ('coord_geral', 'coord_tecnico', 'professor_fic', 'auxiliar_adm')
         or (public.meu_papel() in ('articulacao', 'apoio')
             and exists (select 1 from public.equipe e where e.id = entregas_mes.equipe_id and e.uf = public.minha_uf())));
drop policy if exists entregas_marcar on public.entregas_mes;
create policy entregas_marcar on public.entregas_mes for insert to authenticated
  with check ((item = 'presenca' and equipe_id = public.meu_id())
              or (item = 'ava' and public.meu_papel() in ('professor_fic', 'coord_geral')));
drop policy if exists entregas_desmarcar on public.entregas_mes;
create policy entregas_desmarcar on public.entregas_mes for delete to authenticated
  using ((item = 'presenca' and equipe_id = public.meu_id())
         or (item = 'ava' and public.meu_papel() in ('professor_fic', 'coord_geral')));
grant select, insert, delete on public.entregas_mes to authenticated;

create table if not exists public.ciencias (
  equipe_id uuid not null references public.equipe(id) on delete cascade,
  documento text not null check (documento in ('guia_bolsista', 'guia_agente')),
  em        timestamptz not null default now(),
  primary key (equipe_id, documento)
);
alter table public.ciencias enable row level security;
drop policy if exists ciencias_ler on public.ciencias;
create policy ciencias_ler on public.ciencias for select to authenticated
  using (equipe_id = public.meu_id() or public.meu_papel() in ('coord_geral', 'coord_tecnico', 'auxiliar_adm'));
drop policy if exists ciencias_dar on public.ciencias;
create policy ciencias_dar on public.ciencias for insert to authenticated
  with check (equipe_id = public.meu_id());
grant select, insert on public.ciencias to authenticated;

create or replace function public.ciencias_antes() returns trigger
language plpgsql as $$ begin new.em := now(); return new; end $$;
drop trigger if exists ciencias_antes on public.ciencias;
create trigger ciencias_antes before insert on public.ciencias
  for each row execute function public.ciencias_antes();

-- perfil no campo
alter table public.equipe_privado add column if not exists perfil jsonb;
alter table public.pre_cadastros add column if not exists perfil jsonb;
create or replace function public.enviar_pre_cadastro(p_token text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c public.convites; v_cpf text := regexp_replace(coalesce(p_dados->>'cpf', ''), '\D', '', 'g');
        v_email text := lower(trim(coalesce(p_dados->>'email', '')));
        v_arlo boolean := coalesce((p_dados->>'cadastro_arlo')::boolean, false);
begin
  select * into c from public.convites where token = p_token for update;
  if c.id is null or c.usado_em is not null or c.cancelado_em is not null or c.expira_em <= now() then
    raise exception 'Este link não vale mais. Peça um novo à coordenação.';
  end if;
  if coalesce((p_dados->>'consentimento_lgpd')::boolean, false) is not true then raise exception 'É preciso aceitar o uso dos dados para o cadastro.'; end if;
  if not v_arlo and nullif(p_dados->>'data_nascimento', '') is null then raise exception 'Informe a data de nascimento.'; end if;
  if exists (select 1 from public.equipe where status = 'ativa' and (cpf = v_cpf or lower(email::text) = v_email)) then
    raise exception 'Já existe pessoa ativa na equipe com este CPF ou e-mail. Fale com a coordenação.';
  end if;
  insert into public.pre_cadastros (convite_id, papel, uf, substitui_id, nome, cpf, email, telefone, municipio, organizacao,
                                    nome_social, data_nascimento, nis, endereco, socioeconomico, consentimento_lgpd, cadastro_arlo, siape, perfil)
    values (c.id, c.papel, c.uf, c.substitui_id, trim(p_dados->>'nome'), v_cpf, v_email,
            nullif(trim(p_dados->>'telefone'), ''), nullif(trim(p_dados->>'municipio'), ''), nullif(trim(p_dados->>'organizacao'), ''),
            nullif(trim(p_dados->>'nome_social'), ''), nullif(p_dados->>'data_nascimento', '')::date,
            nullif(regexp_replace(coalesce(p_dados->>'nis', ''), '\D', '', 'g'), ''),
            coalesce(p_dados->'endereco', '{}'::jsonb), p_dados->'socioeconomico', true, v_arlo,
            nullif(regexp_replace(coalesce(p_dados->>'siape', ''), '\D', '', 'g'), ''),
            case when jsonb_typeof(p_dados->'perfil') = 'object' then p_dados->'perfil' end);
  update public.convites set usado_em = now() where id = c.id;
end $$;
revoke all on function public.enviar_pre_cadastro(text, jsonb) from public;
grant execute on function public.enviar_pre_cadastro(text, jsonb) to anon, authenticated;

commit;

select 'Entregas do mês e ciência do guia instaladas' as resultado,
  to_regclass('public.entregas_mes') is not null as entregas, to_regclass('public.ciencias') is not null as ciencias;
