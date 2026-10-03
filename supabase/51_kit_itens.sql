-- =====================================================================
-- Mulheres & Quintais — 51: ITENS DO KIT COM PREÇO DE REFERÊNCIA (03/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 01 (equipe, meu_papel, meu_id, auditar).
--
-- Lista de itens que quem faz o diagnóstico escolhe ao montar o kit do quintal: o preço de referência
-- entra sozinho na projeção do investimento. Toda a equipe lê; só a coordenação (técnica ou geral) altera,
-- pela função salvar_kit_item. Nada se apaga: item que sai da lista fica "inativo".
--
-- Os 9 itens abaixo entram com ESTIMATIVA PRELIMINAR pesquisada na internet em 03/10/2026 (a fonte está
-- em cada linha). Não são cotação: a coordenação técnica troca pelo valor da cotação ou da ata de preços
-- na aba Campo. Rodar de novo NÃO desfaz o que a coordenação já alterou.
-- Este arquivo não mexe em nenhum diagnóstico: plano antigo sem valor aparece na tela com o preço de
-- referência, marcado "(ref.)".
-- =====================================================================
begin;

create table if not exists public.kit_itens (
  id             uuid primary key default gen_random_uuid(),
  item           text not null check (length(trim(item)) between 2 and 120),
  unidade        text not null check (length(trim(unidade)) between 1 and 20),
  valor_ref      numeric(10,2) not null check (valor_ref > 0 and valor_ref <= 5000),
  fonte          text check (fonte is null or length(fonte) <= 300),
  preliminar     boolean not null default true,
  ativo          boolean not null default true,
  atualizado_por uuid references public.equipe(id),
  atualizado_em  timestamptz not null default now()
);
create unique index if not exists kit_itens_nome on public.kit_itens (lower(trim(item)));

alter table public.kit_itens enable row level security;
revoke all on public.kit_itens from anon, authenticated;
grant select on public.kit_itens to authenticated;                 -- gravar só pela função abaixo
drop policy if exists kit_itens_ler on public.kit_itens;
create policy kit_itens_ler on public.kit_itens for select to authenticated
  using ((select public.meu_papel()) is not null);

create or replace function public.salvar_kit_item(p_id uuid, p_item text, p_unidade text, p_valor numeric,
  p_fonte text, p_preliminar boolean, p_ativo boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_item text := trim(coalesce(p_item, '')); v_un text := trim(coalesce(p_unidade, '')); v_fonte text := nullif(trim(coalesce(p_fonte, '')), '');
begin
  if coalesce(public.meu_papel(), '') not in ('coord_geral', 'coord_tecnico') then
    raise exception 'Quem altera a lista de itens do kit é a coordenação.';
  end if;
  if length(v_item) < 2 or length(v_item) > 120 then raise exception 'Escreva o nome do item (de 2 a 120 letras).'; end if;
  if length(v_un) < 1 or length(v_un) > 20 then raise exception 'Informe a unidade (un, m, m², saco...).'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 5000 then raise exception 'O preço de referência precisa ser maior que zero e não passar de R$ 5.000,00.'; end if;
  if length(coalesce(v_fonte, '')) > 300 then raise exception 'A origem do preço passou de 300 letras.'; end if;
  if not coalesce(p_preliminar, true) and length(coalesce(v_fonte, '')) < 5 then
    raise exception 'Para confirmar o preço, diga de onde ele veio (cotação, ata, nota).';
  end if;
  if exists (select 1 from public.kit_itens k where lower(trim(k.item)) = lower(v_item) and (p_id is null or k.id <> p_id)) then
    raise exception 'Já existe um item com este nome.';
  end if;
  if p_id is null then
    insert into public.kit_itens (item, unidade, valor_ref, fonte, preliminar, ativo, atualizado_por)
    values (v_item, v_un, round(p_valor, 2), v_fonte, coalesce(p_preliminar, true), coalesce(p_ativo, true), public.meu_id())
    returning id into v_id;
  else
    update public.kit_itens set item = v_item, unidade = v_un, valor_ref = round(p_valor, 2), fonte = v_fonte,
      preliminar = coalesce(p_preliminar, true), ativo = coalesce(p_ativo, true), atualizado_por = public.meu_id(), atualizado_em = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Item não encontrado. Atualize a tela e tente de novo.'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.salvar_kit_item(uuid, text, text, numeric, text, boolean, boolean) from public, anon;
grant execute on function public.salvar_kit_item(uuid, text, text, numeric, text, boolean, boolean) to authenticated;

create or replace function public.kit_itens_nao_apaga() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'Item do kit não se apaga. Tire-o da lista (inativo) na aba Campo.';
end $$;
drop trigger if exists kit_itens_nao_apaga on public.kit_itens;
create trigger kit_itens_nao_apaga before delete on public.kit_itens for each row execute function public.kit_itens_nao_apaga();
revoke all on function public.kit_itens_nao_apaga() from public, anon, authenticated;   -- função de gatilho: ninguém chama direto

drop trigger if exists kit_itens_auditoria on public.kit_itens;
create trigger kit_itens_auditoria after insert or update on public.kit_itens for each row execute function public.auditar();

-- estimativas preliminares (03/10/2026): só entram os itens que ainda não existem
insert into public.kit_itens (item, unidade, valor_ref, fonte)
select v.item, v.unidade, v.valor, v.fonte from (values
  ('Caixa d''água 1.000 L',      'un',     502.84, 'SINAPI, insumo 34636, média nacional, jul/2026'),
  ('Kit de gotejamento',         'un',     350.00, 'Estimativa sem fonte verificada (kit pequeno, sem bomba)'),
  ('Regador e mangueira',        'un',     120.00, 'Estimativa sem fonte verificada'),
  ('Tela de sombreamento 50%',   'm²',       7.00, 'Estimativa: varejo on-line tem a tela de 80% a R$ 8,67/m²; a de 50% não foi cotada'),
  ('Tela para galinheiro',       'm',        7.40, 'Varejo on-line, rolo de 50 m × 1,5 m a R$ 369,36, out/2026'),
  ('Ferramentas manuais',        'kit',    250.00, 'Estimativa sem fonte verificada'),
  ('Mudas frutíferas',           'un',      20.00, 'Codevasf, pregão 90006/2026: de R$ 7 a R$ 39 conforme a espécie'),
  ('Sementes de hortaliças',     'pacote',   5.00, 'Estimativa sem fonte verificada'),
  ('Esterco curtido',            'saco',    15.00, 'Estimativa sem fonte verificada')
) as v(item, unidade, valor, fonte)
where not exists (select 1 from public.kit_itens k where lower(trim(k.item)) = lower(v.item));

commit;

select 'Itens do kit instalados' as resultado, (select count(*) from public.kit_itens) as itens,
       (select count(*) from public.kit_itens where preliminar) as estimativas_preliminares;
