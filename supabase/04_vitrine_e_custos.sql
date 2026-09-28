-- =====================================================================
-- Mulheres & Quintais — Etapa 4: vitrine pública (tela de entrada e "O projeto em números")
--                            e cálculo da ajuda de custo por visita
-- Rodar DEPOIS de 01, 02 e 03. Pode rodar de novo sem estragar nada.
--
-- O que fica público (qualquer pessoa, sem login):
--   * só TOTAIS por estado e do projeto (nunca nome, município, CPF, GPS ou registro individual);
--   * só fotos escolhidas pela coordenação, de mulheres que autorizaram uso de imagem.
-- Nada das tabelas fichas, visitas, diagnosticos ou equipe fica legível sem login.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fotos aprovadas para divulgação
-- ---------------------------------------------------------------------
create table if not exists public.vitrine_fotos (
  id             uuid primary key default gen_random_uuid(),
  path           text not null unique,               -- caminho no bucket público "vitrine" (nome aleatório)
  ficha_id       uuid not null references public.fichas(id),
  uf             char(2) not null,
  legenda        text not null check (length(trim(legenda)) between 5 and 140),
  sem_criancas   boolean not null default false,     -- quem publica confirma que não aparece criança
  publicada_por  uuid references public.equipe(id),
  publicada_em   timestamptz not null default now()
);

create or replace function public.vitrine_fotos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if public.meu_papel() not in ('coord_geral','coord_tecnico') then
    raise exception 'Só a coordenação publica fotos na vitrine.';
  end if;
  select * into f from public.fichas where id = new.ficha_id;
  if f.id is null then raise exception 'Ficha não encontrada.'; end if;
  if not f.consent_imagem then
    raise exception 'Esta mulher não autorizou uso de imagem. A foto não pode ser publicada.';
  end if;
  if not f.consent_criancas and not new.sem_criancas then
    raise exception 'A autorização não inclui crianças: confirme que nenhuma criança aparece na foto.';
  end if;
  if length(split_part(f.nome, ' ', 1)) >= 3 and new.legenda ~* ('\m' || split_part(f.nome, ' ', 1) || '\M') then
    raise exception 'A legenda não pode trazer o nome da mulher.';
  end if;
  new.uf := f.uf;
  new.publicada_por := public.meu_id();
  new.publicada_em := now();
  return new;
end $$;

drop trigger if exists vitrine_fotos_antes on public.vitrine_fotos;
create trigger vitrine_fotos_antes before insert or update on public.vitrine_fotos
  for each row execute function public.vitrine_fotos_antes();

drop trigger if exists vitrine_fotos_auditoria on public.vitrine_fotos;
create trigger vitrine_fotos_auditoria after insert or update or delete on public.vitrine_fotos
  for each row execute function public.auditar();

alter table public.vitrine_fotos enable row level security;
drop policy if exists vitrine_fotos_ler on public.vitrine_fotos;
drop policy if exists vitrine_fotos_incluir on public.vitrine_fotos;
drop policy if exists vitrine_fotos_apagar on public.vitrine_fotos;
create policy vitrine_fotos_ler on public.vitrine_fotos for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy vitrine_fotos_incluir on public.vitrine_fotos for insert to authenticated
  with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy vitrine_fotos_apagar on public.vitrine_fotos for delete to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico'));
grant select, insert, delete on public.vitrine_fotos to authenticated;

-- Bucket público só com as cópias aprovadas (as fotos originais continuam no bucket privado "campo")
insert into storage.buckets (id, name, public) values ('vitrine', 'vitrine', true)
  on conflict (id) do update set public = true;
drop policy if exists vitrine_arq_ler on storage.objects;
drop policy if exists vitrine_arq_enviar on storage.objects;
drop policy if exists vitrine_arq_apagar on storage.objects;
create policy vitrine_arq_ler on storage.objects for select to anon, authenticated
  using (bucket_id = 'vitrine');
create policy vitrine_arq_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'vitrine' and public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy vitrine_arq_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'vitrine' and public.meu_papel() in ('coord_geral','coord_tecnico'));

-- ---------------------------------------------------------------------
-- Números públicos: só totais. Uma função, sem acesso às tabelas.
-- ---------------------------------------------------------------------
create or replace function public.vitrine() returns jsonb
language sql stable security definer set search_path = public as $$
  with ufs(uf) as (values ('AL'),('BA'),('PE'),('PI'),('SE')),
  sel as (select uf, count(*) n from fichas where resultado = 'selecionada' and situacao = 'aprovada' group by uf),
  fic as (select uf, count(*) n from fichas group by uf),
  dg  as (select uf, count(*) n, count(*) filter (where situacao = 'aprovado') aprov from diagnosticos group by uf),
  imp as (select uf, count(*) n from visitas where etapa = 'implantacao' and situacao = 'realizada' group by uf),
  aco as (select uf, count(*) n from visitas where etapa = 'acompanhamento' and situacao = 'realizada' group by uf),
  eq  as (select count(*) filter (where papel in ('articulacao','apoio')) bolsistas,
                 count(*) filter (where papel = 'agente') agentes
            from equipe where status = 'ativa'),
  por_uf as (
    select jsonb_agg(jsonb_build_object(
             'uf', u.uf,
             'fichas', coalesce(fic.n, 0),
             'selecionadas', coalesce(sel.n, 0),
             'diagnosticos', coalesce(dg.n, 0),
             'planos', coalesce(dg.aprov, 0),
             'implantados', coalesce(imp.n, 0),
             'acompanhamentos', coalesce(aco.n, 0)) order by u.uf) j
      from ufs u
      left join sel on sel.uf = u.uf left join fic on fic.uf = u.uf left join dg on dg.uf = u.uf
      left join imp on imp.uf = u.uf left join aco on aco.uf = u.uf),
  fotos as (
    select coalesce(jsonb_agg(jsonb_build_object('path', v.path, 'legenda', v.legenda, 'uf', v.uf)
                              order by v.publicada_em desc), '[]'::jsonb) j
      from (select vf.* from vitrine_fotos vf join fichas f on f.id = vf.ficha_id
             where f.consent_imagem and (f.consent_criancas or vf.sem_criancas)
             order by vf.publicada_em desc limit 24) v)
  select jsonb_build_object(
    'atualizado_em', now(),
    'por_uf', (select j from por_uf),
    'equipe', (select to_jsonb(eq) from eq),
    'fotos', (select j from fotos));
$$;

revoke all on function public.vitrine() from public;
grant execute on function public.vitrine() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Cálculo da ajuda de custo por visita (horas + combustível + alimentação)
-- ---------------------------------------------------------------------
create table if not exists public.parametros (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_por uuid references public.equipe(id),
  atualizado_em  timestamptz not null default now()
);
insert into public.parametros (chave, valor) values ('custo_visita', jsonb_build_object(
  'valor_hora', 50, 'horas', jsonb_build_object('diagnostico', 3, 'implantacao', 2, 'acompanhamento', 2, 'avaliacao', 2),
  'km_por_litro', 10, 'preco_litro', 6.50, 'refeicao', 25, 'fator_estrada', 1.3))
  on conflict (chave) do nothing;

-- km de ida conferido pela coordenação para cada visita (sem ele, o sistema estima)
create table if not exists public.custos_visita (
  visita_id     uuid primary key references public.visitas(id),
  km_ida        numeric not null check (km_ida >= 0 and km_ida < 1000),
  obs           text,
  definido_por  uuid references public.equipe(id),
  definido_em   timestamptz not null default now()
);

create or replace function public.carimbar_coord() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.meu_papel() not in ('coord_geral','coord_tecnico') then raise exception 'Só a coordenação altera valores de pagamento.'; end if;
  if tg_table_name = 'parametros' then new.atualizado_por := public.meu_id(); new.atualizado_em := now();
  else new.definido_por := public.meu_id(); new.definido_em := now(); end if;
  return new;
end $$;
drop trigger if exists parametros_antes on public.parametros;
create trigger parametros_antes before insert or update on public.parametros for each row execute function public.carimbar_coord();
drop trigger if exists custos_visita_antes on public.custos_visita;
create trigger custos_visita_antes before insert or update on public.custos_visita for each row execute function public.carimbar_coord();

-- auditoria: a tabela usa id uuid; aqui a chave é outra, então grava o registro inteiro
create or replace function public.auditar_chave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values (tg_table_name,
          case when tg_table_name = 'custos_visita' then ((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'visita_id')::uuid end,
          tg_op, public.meu_id(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists parametros_auditoria on public.parametros;
create trigger parametros_auditoria after insert or update or delete on public.parametros for each row execute function public.auditar_chave();
drop trigger if exists custos_visita_auditoria on public.custos_visita;
create trigger custos_visita_auditoria after insert or update or delete on public.custos_visita for each row execute function public.auditar_chave();

alter table public.parametros enable row level security;
alter table public.custos_visita enable row level security;
drop policy if exists parametros_ler on public.parametros;
drop policy if exists parametros_gravar on public.parametros;
drop policy if exists parametros_alterar on public.parametros;
drop policy if exists custos_ler on public.custos_visita;
drop policy if exists custos_gravar on public.custos_visita;
drop policy if exists custos_alterar on public.custos_visita;
create policy parametros_ler on public.parametros for select to authenticated using (true);
create policy parametros_gravar on public.parametros for insert to authenticated with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy parametros_alterar on public.parametros for update to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')) with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy custos_ler on public.custos_visita for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')
         or exists (select 1 from public.visitas v where v.id = visita_id and v.executor_id = public.meu_id()));
create policy custos_gravar on public.custos_visita for insert to authenticated with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
create policy custos_alterar on public.custos_visita for update to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')) with check (public.meu_papel() in ('coord_geral','coord_tecnico'));
grant select, insert, update on public.parametros, public.custos_visita to authenticated;

select 'Etapa 4 instalada' as resultado, jsonb_array_length(public.vitrine()->'por_uf') as estados;
