-- =====================================================================
-- Mulheres & Quintais — 44: ORIENTAÇÃO DE VENDA DO EXCEDENTE (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 43. Cria duas tabelas novas; não mexe em nenhum dado que já existe.
--
-- 1. canais_venda: onde vender em cada município (feira, grupo/cooperativa, merenda escolar, PAA, comprador).
--    Quem preenche: a coordenação (qualquer estado) e as bolsistas (só o próprio estado).
--    Quem lê: toda a equipe de campo e a coordenação. Nada se apaga: o canal que acabou fica "desativado".
-- 2. orientacoes_venda: registro de que a mulher foi orientada (o que sobra, se tem CAF, se vende em grupo).
--    Quem registra: quem visita o quintal (bolsista ou agente do estado) e a coordenação. Não se altera nem se apaga.
--    Sem dado pessoal novo: só o que sobra no quintal e as respostas da orientação.
-- =====================================================================
begin;

create table if not exists public.canais_venda (
  id            uuid primary key default gen_random_uuid(),
  uf            char(2) not null check (uf in ('AL','BA','PE','PI','SE')),
  municipio     text not null check (length(trim(municipio)) between 2 and 80),
  tipo          text not null check (tipo in ('feira','grupo','merenda','paa','comprador','outro')),
  nome          text not null check (length(trim(nome)) between 3 and 120),
  detalhe       text check (detalhe is null or length(detalhe) <= 400),     -- dia e local da feira, como participar, o que compram
  contato       text check (contato is null or length(contato) <= 160),     -- nome e telefone de quem atende (pessoa de referência do canal)
  ativo         boolean not null default true,
  criado_por    uuid references public.equipe(id),
  criado_em     timestamptz not null default now(),
  atualizado_por uuid references public.equipe(id),
  atualizado_em timestamptz not null default now()
);
create index if not exists canais_venda_uf_mun on public.canais_venda (uf, lower(municipio));
alter table public.canais_venda enable row level security;
revoke all on public.canais_venda from anon, authenticated;
grant select on public.canais_venda to authenticated;
drop policy if exists canais_ler on public.canais_venda;
create policy canais_ler on public.canais_venda for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico')
         or (coalesce(public.meu_papel(), '') in ('articulacao','apoio','agente') and uf = public.minha_uf()));

create or replace function public.salvar_canal_venda(p_id uuid, p_uf text, p_municipio text, p_tipo text, p_nome text, p_detalhe text, p_contato text, p_ativo boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare papel text := coalesce(public.meu_papel(), ''); v uuid; atual public.canais_venda;
begin
  if papel not in ('coord_geral','coord_tecnico','articulacao','apoio') then
    raise exception 'Quem cadastra os canais de venda é a coordenação ou a bolsista do estado.';
  end if;
  if p_id is not null then
    select * into atual from public.canais_venda where id = p_id for update;
    if atual.id is null then raise exception 'Canal não encontrado.'; end if;
    p_uf := atual.uf;   -- o estado de um canal não muda
  end if;
  if p_uf is null or p_uf not in ('AL','BA','PE','PI','SE') then raise exception 'Escolha o estado.'; end if;
  if papel in ('articulacao','apoio') and p_uf <> public.minha_uf() then raise exception 'Você cadastra canais só do seu estado.'; end if;
  if length(trim(coalesce(p_municipio, ''))) < 2 then raise exception 'Informe o município.'; end if;
  if coalesce(p_tipo, '') not in ('feira','grupo','merenda','paa','comprador','outro') then raise exception 'Escolha o tipo de canal.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Dê um nome ao canal (pelo menos 3 letras).'; end if;
  if p_id is null then
    if exists (select 1 from public.canais_venda c where c.uf = p_uf and lower(trim(c.municipio)) = lower(trim(p_municipio)) and c.tipo = p_tipo
                 and lower(trim(c.nome)) = lower(trim(p_nome))) then
      raise exception 'Este canal já está cadastrado neste município.';
    end if;
    insert into public.canais_venda (uf, municipio, tipo, nome, detalhe, contato, ativo, criado_por, atualizado_por)
    values (p_uf, trim(p_municipio), p_tipo, trim(p_nome), nullif(trim(coalesce(p_detalhe, '')), ''), nullif(trim(coalesce(p_contato, '')), ''), coalesce(p_ativo, true), public.meu_id(), public.meu_id())
    returning id into v;
  else
    update public.canais_venda set municipio = trim(p_municipio), tipo = p_tipo, nome = trim(p_nome), detalhe = nullif(trim(coalesce(p_detalhe, '')), ''),
      contato = nullif(trim(coalesce(p_contato, '')), ''), ativo = coalesce(p_ativo, true), atualizado_por = public.meu_id(), atualizado_em = now()
    where id = p_id returning id into v;
  end if;
  return v;
end $$;
revoke all on function public.salvar_canal_venda(uuid, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.salvar_canal_venda(uuid, text, text, text, text, text, text, boolean) to authenticated;

drop trigger if exists canais_venda_auditoria on public.canais_venda;
create trigger canais_venda_auditoria after insert or update on public.canais_venda for each row execute function public.auditar();

-- orientação dada à mulher --------------------------------------------------
create table if not exists public.orientacoes_venda (
  id          uuid primary key default gen_random_uuid(),
  ficha_id    uuid not null references public.fichas(id),
  uf          char(2) not null,
  dados       jsonb not null default '{}'::jsonb,   -- { sobra: [{ produto, regular }], caf: sim|nao|nao_sabe, grupo: bool, obs }
  feito_por   uuid references public.equipe(id),
  feito_em    timestamptz not null default now()
);
create index if not exists orientacoes_venda_ficha on public.orientacoes_venda (ficha_id, feito_em desc);
alter table public.orientacoes_venda enable row level security;
revoke all on public.orientacoes_venda from anon, authenticated;
grant select on public.orientacoes_venda to authenticated;
drop policy if exists orient_ler on public.orientacoes_venda;
create policy orient_ler on public.orientacoes_venda for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico')
         or (coalesce(public.meu_papel(), '') in ('articulacao','apoio') and uf = public.minha_uf())
         or feito_por = public.meu_id());

create or replace function public.registrar_orientacao_venda(p_ficha uuid, p_dados jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare papel text := coalesce(public.meu_papel(), ''); f public.fichas; v uuid;
begin
  if papel not in ('coord_geral','coord_tecnico','articulacao','apoio','agente') then
    raise exception 'Quem registra a orientação de venda é quem visita o quintal ou a coordenação.';
  end if;
  select * into f from public.fichas where id = p_ficha;
  if f.id is null then raise exception 'Ficha não encontrada.'; end if;
  if not (f.resultado = 'selecionada' and f.situacao = 'aprovada') then raise exception 'A orientação de venda é para mulher selecionada e aprovada.'; end if;
  if papel in ('articulacao','apoio','agente') and f.uf <> public.minha_uf() then raise exception 'Este quintal é de outro estado.'; end if;
  if papel = 'agente' and not exists (select 1 from public.visitas x where x.ficha_id = p_ficha and x.executor_id = public.meu_id() and x.situacao <> 'cancelada') then
    raise exception 'Você registra a orientação só dos quintais que visita.';
  end if;
  if not exists (select 1 from public.diagnosticos d where d.ficha_id = p_ficha) then raise exception 'Primeiro o diagnóstico do quintal.'; end if;
  if jsonb_typeof(p_dados -> 'sobra') is distinct from 'array' then raise exception 'Marque o que está sobrando no quintal (ou registre que nada sobra).'; end if;
  if coalesce(p_dados ->> 'caf', '') not in ('sim','nao','nao_sabe') then raise exception 'Responda se a família tem CAF ou DAP.'; end if;
  if length(p_dados::text) > 4000 then raise exception 'Registro grande demais.'; end if;
  insert into public.orientacoes_venda (ficha_id, uf, dados, feito_por) values (p_ficha, f.uf, p_dados, public.meu_id()) returning id into v;
  return v;
end $$;
revoke all on function public.registrar_orientacao_venda(uuid, jsonb) from public, anon;
grant execute on function public.registrar_orientacao_venda(uuid, jsonb) to authenticated;

create or replace function public.orientacoes_venda_antes() returns trigger language plpgsql as $$
begin raise exception 'O registro de orientação de venda não se altera nem se apaga. Registre uma nova orientação.'; end $$;
drop trigger if exists orientacoes_venda_antes on public.orientacoes_venda;
create trigger orientacoes_venda_antes before update or delete on public.orientacoes_venda for each row execute function public.orientacoes_venda_antes();
drop trigger if exists orientacoes_venda_auditoria on public.orientacoes_venda;
create trigger orientacoes_venda_auditoria after insert on public.orientacoes_venda for each row execute function public.auditar();

commit;

select 'Orientação de venda instalada' as resultado,
       (select count(*) from public.canais_venda) as canais_cadastrados,
       (select count(*) from public.orientacoes_venda) as orientacoes_registradas;
