-- =====================================================================
-- Mulheres & Quintais — 38: ENCONTROS DO CURSO FIC, LISTA DE PRESENÇA E RELATÓRIO DO PROFESSOR (30/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 11 (turmas e matrículas), do 12 (pagamentos) e do 15.
--
-- 1) O professor registra cada encontro (turma, data, carga horária, modalidade, o que foi trabalhado)
--    e marca quem estava presente entre as pessoas matriculadas na turma.
-- 2) Cada pessoa marcada como presente confirma, no próprio acesso, que participou.
-- 3) Ao pedir a bolsa do mês, o relatório do professor leva, gravado pelo banco, a lista dos encontros
--    do mês com a presença e as confirmações. Mês sem encontro: pede justificativa (pelo menos 30 letras).
-- Encontro não se apaga. Depois que a bolsa do mês tem aval, os encontros daquele mês não mudam mais.
-- =====================================================================
begin;

create table if not exists public.fic_encontros (
  id            uuid primary key default gen_random_uuid(),
  turma_id      uuid not null references public.turmas_fic(id),
  professor_id  uuid not null references public.equipe(id),
  data          date not null,
  carga_horaria numeric(4,1) not null check (carga_horaria > 0 and carga_horaria <= 12),
  modalidade    text not null check (modalidade in ('presencial', 'online', 'ava')),
  conteudo      text not null check (length(trim(conteudo)) between 10 and 2000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists fic_encontros_prof_data on public.fic_encontros (professor_id, data);

create table if not exists public.fic_presencas (
  id            uuid primary key default gen_random_uuid(),
  encontro_id   uuid not null references public.fic_encontros(id),
  equipe_id     uuid not null references public.equipe(id),
  presente      boolean not null,
  marcado_por   uuid references public.equipe(id),
  marcado_em    timestamptz not null default now(),
  confirmado_em timestamptz,
  unique (encontro_id, equipe_id)
);

alter table public.fic_encontros enable row level security;
alter table public.fic_presencas enable row level security;
revoke all on public.fic_encontros from anon, authenticated;
revoke all on public.fic_presencas from anon, authenticated;
grant select on public.fic_encontros to authenticated;       -- escrever só pelas funções abaixo
grant select on public.fic_presencas to authenticated;
drop policy if exists fic_enc_ler on public.fic_encontros;
drop policy if exists fic_pres_ler on public.fic_presencas;
create policy fic_enc_ler on public.fic_encontros for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico', 'professor_fic')
         or exists (select 1 from public.fic_presencas p where p.encontro_id = fic_encontros.id and p.equipe_id = public.meu_id()));
create policy fic_pres_ler on public.fic_presencas for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico', 'professor_fic') or equipe_id = public.meu_id());

-- mês já com aval na bolsa do professor: os encontros daquele mês ficam como estão
create or replace function public.fic_mes_fechado(p_prof uuid, p_data date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.solicitacoes_pagamento s where s.tipo = 'bolsa' and s.equipe_id = p_prof
                   and s.mes = date_trunc('month', p_data)::date and s.situacao in ('avalizada', 'lancada'))
$$;
revoke all on function public.fic_mes_fechado(uuid, date) from public, anon;

create or replace function public.registrar_encontro_fic(p_id uuid, p_turma uuid, p_data date, p_carga numeric, p_modalidade text,
                                                         p_conteudo text, p_presentes uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.fic_encontros; v_id uuid; m record; eu uuid := public.meu_id(); v_prof uuid;
begin
  if coalesce(public.meu_papel(), '') not in ('professor_fic', 'coord_geral') then raise exception 'Quem registra os encontros do curso é o professor do FIC.'; end if;
  if not exists (select 1 from public.turmas_fic where id = p_turma) then raise exception 'Turma não encontrada.'; end if;
  if p_data is null or p_data > current_date then raise exception 'A data do encontro não pode ser no futuro.'; end if;
  if p_data < date '2026-09-01' then raise exception 'Data antes do início do projeto.'; end if;
  if p_carga is null or p_carga <= 0 or p_carga > 12 then raise exception 'Informe a carga horária do encontro (até 12 horas).'; end if;
  if p_modalidade not in ('presencial', 'online', 'ava') then raise exception 'Modalidade inválida.'; end if;
  if length(trim(coalesce(p_conteudo, ''))) < 10 then raise exception 'Escreva o que foi trabalhado no encontro (pelo menos 10 letras).'; end if;
  if exists (select 1 from unnest(coalesce(p_presentes, '{}')) x
             where not exists (select 1 from public.matriculas_fic mt where mt.turma_id = p_turma and mt.equipe_id = x and mt.cancelada_em is null)) then
    raise exception 'Só entra na lista de presença quem está matriculado nesta turma.';
  end if;
  -- o encontro é sempre do professor: se a coordenação geral registra no lugar dele, fica em nome do professor da turma
  v_prof := case when public.meu_papel() = 'professor_fic' then eu else (select professor_id from public.turmas_fic where id = p_turma) end;
  if p_id is null then
    if public.fic_mes_fechado(v_prof, p_data) then raise exception 'A bolsa deste mês do professor já teve aval: não dá para incluir encontro neste mês.'; end if;
    insert into public.fic_encontros (turma_id, professor_id, data, carga_horaria, modalidade, conteudo)
      values (p_turma, v_prof, p_data, p_carga, p_modalidade, trim(p_conteudo)) returning id into v_id;
  else
    select * into e from public.fic_encontros where id = p_id for update;
    if e.id is null then raise exception 'Encontro não encontrado.'; end if;
    if public.fic_mes_fechado(e.professor_id, e.data) or public.fic_mes_fechado(e.professor_id, p_data) then
      raise exception 'A bolsa deste mês já teve aval: o encontro não muda mais.';
    end if;
    if e.turma_id <> p_turma and exists (select 1 from public.fic_presencas where encontro_id = e.id and confirmado_em is not null) then
      raise exception 'Já há presença confirmada neste encontro: a turma não pode mudar.';
    end if;
    update public.fic_encontros set turma_id = p_turma, data = p_data, carga_horaria = p_carga, modalidade = p_modalidade, conteudo = trim(p_conteudo), atualizado_em = now()
      where id = e.id;
    v_id := e.id;
  end if;
  -- lista de presença: todas as pessoas matriculadas na turma, presente ou não
  for m in select mt.equipe_id from public.matriculas_fic mt where mt.turma_id = p_turma and mt.cancelada_em is null loop
    if exists (select 1 from public.fic_presencas where encontro_id = v_id and equipe_id = m.equipe_id and confirmado_em is not null)
       and not (m.equipe_id = any(coalesce(p_presentes, '{}'))) then
      raise exception 'Alguém que já confirmou a presença foi desmarcado. Quem confirmou continua presente.';
    end if;
    insert into public.fic_presencas (encontro_id, equipe_id, presente, marcado_por, marcado_em)
      values (v_id, m.equipe_id, m.equipe_id = any(coalesce(p_presentes, '{}')), eu, now())
      on conflict (encontro_id, equipe_id) do update set presente = excluded.presente, marcado_por = eu, marcado_em = now()
      where fic_presencas.presente is distinct from excluded.presente;
  end loop;
  return v_id;
end $$;
revoke all on function public.registrar_encontro_fic(uuid, uuid, date, numeric, text, text, uuid[]) from public, anon;
grant execute on function public.registrar_encontro_fic(uuid, uuid, date, numeric, text, text, uuid[]) to authenticated;

-- a própria pessoa confirma que participou (só onde o professor marcou presente)
create or replace function public.confirmar_presenca_fic(p_encontro uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.fic_presencas set confirmado_em = now()
   where encontro_id = p_encontro and equipe_id = public.meu_id() and presente and confirmado_em is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Não há presença sua para confirmar neste encontro (ou já está confirmada).'; end if;
end $$;
revoke all on function public.confirmar_presenca_fic(uuid) from public, anon;
grant execute on function public.confirmar_presenca_fic(uuid) to authenticated;

-- relatório do professor: ao pedir a bolsa, o banco grava os encontros do mês com a presença
create or replace function public.solic_professor_fic() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_papel text; v_enc jsonb; v_ch numeric;
begin
  if new.tipo <> 'bolsa' or new.situacao <> 'solicitada' then return new; end if;
  if tg_op = 'UPDATE' and new.solicitada_em is not distinct from old.solicitada_em then return new; end if;   -- aval, Arlo: não recalcula
  select papel into v_papel from public.equipe where id = new.equipe_id;
  if v_papel <> 'professor_fic' then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'data', e.data, 'turma', t.nome, 'carga_horaria', e.carga_horaria, 'modalidade', e.modalidade, 'conteudo', e.conteudo,
           'presencas', (select coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(q.nome_social, q.nome), 'papel', q.papel, 'uf', q.uf,
                                                                      'presente', p.presente, 'confirmado_em', p.confirmado_em) order by coalesce(q.nome_social, q.nome)), '[]'::jsonb)
                         from public.fic_presencas p join public.equipe q on q.id = p.equipe_id where p.encontro_id = e.id)) order by e.data), '[]'::jsonb),
         coalesce(sum(e.carga_horaria), 0)
    into v_enc, v_ch
    from public.fic_encontros e join public.turmas_fic t on t.id = e.turma_id
   where e.professor_id = new.equipe_id and date_trunc('month', e.data)::date = new.mes;
  if jsonb_array_length(v_enc) = 0 and length(trim(coalesce(new.detalhe->>'justificativa_sem_encontro', ''))) < 30 then
    raise exception 'Nenhum encontro do curso registrado neste mês: explique por quê (pelo menos 30 letras), por exemplo, mês de preparação do curso.';
  end if;
  new.detalhe := coalesce(new.detalhe, '{}'::jsonb) || jsonb_build_object('fic_encontros', v_enc, 'fic_carga_horaria', v_ch, 'fic_gerado_em', now());
  return new;
end $$;
drop trigger if exists solic_professor_fic on public.solicitacoes_pagamento;
create trigger solic_professor_fic before insert or update on public.solicitacoes_pagamento for each row execute function public.solic_professor_fic();

drop trigger if exists fic_encontros_auditoria on public.fic_encontros;
create trigger fic_encontros_auditoria after insert or update on public.fic_encontros for each row execute function public.auditar();
drop trigger if exists fic_presencas_auditoria on public.fic_presencas;
create trigger fic_presencas_auditoria after insert or update on public.fic_presencas for each row execute function public.auditar();

commit;

select 'Encontros do FIC e relatório do professor instalados' as resultado, to_regclass('public.fic_encontros') is not null as encontros,
       to_regclass('public.fic_presencas') is not null as presencas;
