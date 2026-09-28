-- =====================================================================
-- Mulheres & Quintais — Etapa 11: professores do curso FIC, turmas e matrículas
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Rodar depois de 01 a 10. Pode rodar de novo sem estragar nada.
-- =====================================================================
-- O que o banco garante:
--   * Novo perfil: professor(a) do curso FIC (IFRN, sem estado). Só a coordenação geral cadastra,
--     à mão ou por link de convite. Tem os mesmos dados pessoais e bancários das bolsistas.
--   * Habilitação do professor: documentos na FUNCERN e termo (não se matricula no FIC).
--   * O professor cria turmas e matricula bolsistas e agentes de campo. A matrícula registrada
--     na turma preenche a "matrícula no FIC" da habilitação da pessoa.
--   * O professor vê da equipe só o necessário para matricular (nome, função, estado, município
--     e a situação da matrícula) — nada de CPF, e-mail, telefone ou endereço.
--   * Matrícula de quem já tem visita no roteiro não é cancelada (a visita depende dela).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil novo
-- ---------------------------------------------------------------------
alter table public.equipe drop constraint if exists equipe_papel_check;
alter table public.equipe add constraint equipe_papel_check
  check (papel in ('coord_geral','coord_tecnico','articulacao','apoio','agente','professor_fic'));
alter table public.equipe drop constraint if exists uf_por_papel;
alter table public.equipe add constraint uf_por_papel check (
  (papel in ('articulacao','apoio','agente') and uf is not null) or
  (papel in ('coord_geral','coord_tecnico','professor_fic') and uf is null));

create or replace function public.pode_gerenciar(p_papel text) returns boolean
language sql stable as $$
  select case
    when p_papel in ('coord_tecnico','professor_fic')  then public.meu_papel() = 'coord_geral'
    when p_papel in ('articulacao','apoio','agente')   then public.meu_papel() = 'coord_tecnico'
    else false
  end
$$;

-- professor não se matricula no FIC: habilita com FUNCERN e termo
create or replace function public.habilitado(p equipe) returns boolean
language sql immutable as $$
  select p.status = 'ativa' and (p.papel = 'professor_fic' or p.matricula_fic_em is not null)
     and p.docs_funcern_em is not null and p.termo_assinado_em is not null
$$;

-- convites também para professor (sem estado)
alter table public.convites drop constraint if exists convites_papel_check;
alter table public.convites add constraint convites_papel_check
  check (papel in ('coord_tecnico','articulacao','apoio','agente','professor_fic'));
alter table public.convites drop constraint if exists uf_do_convite;
alter table public.convites add constraint uf_do_convite check (
  (papel in ('coord_tecnico','professor_fic') and uf is null) or (papel not in ('coord_tecnico','professor_fic') and uf is not null));

create or replace function public.criar_convite(p_papel text, p_uf text default null, p_substitui uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not coalesce(public.pode_gerenciar(p_papel), false) then raise exception 'Seu perfil não pode cadastrar esta função.'; end if;
  if p_papel = 'coord_tecnico' and exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then
    raise exception 'Já há coordenação técnica ativa. Desligue antes de convidar outra.';
  end if;
  if p_papel in ('articulacao','apoio') and exists (select 1 from public.equipe where papel = p_papel and uf = upper(p_uf) and status = 'ativa') then
    raise exception 'Esta vaga já está ocupada no estado.';
  end if;
  t := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');
  insert into public.convites (token, papel, uf, substitui_id, criado_por)
    values (t, p_papel, case when p_papel in ('coord_tecnico','professor_fic') then null else upper(p_uf) end, p_substitui, public.meu_id());
  return t;
end $$;
revoke all on function public.criar_convite(text, text, uuid) from public;
grant execute on function public.criar_convite(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Turmas e matrículas
-- ---------------------------------------------------------------------
create table if not exists public.turmas_fic (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) >= 3),
  uf            char(2) check (uf in ('AL','BA','PE','PI','SE')),     -- vazio = turma com gente de vários estados
  municipio     text,
  inicio        date,
  fim           date,
  professor_id  uuid not null references public.equipe(id),
  obs           text,
  criado_por    uuid references public.equipe(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint periodo_ok check (fim is null or inicio is null or fim >= inicio)
);

create table if not exists public.matriculas_fic (
  id             uuid primary key default gen_random_uuid(),
  turma_id       uuid not null references public.turmas_fic(id),
  equipe_id      uuid not null references public.equipe(id),
  numero         text not null check (length(trim(numero)) >= 3),     -- número da matrícula no SUAP
  matriculado_em date not null,
  criado_por     uuid references public.equipe(id),
  criado_em      timestamptz not null default now(),
  cancelada_em   timestamptz,
  motivo_cancelamento text
);
create unique index if not exists matricula_fic_uma_ativa on public.matriculas_fic (equipe_id) where cancelada_em is null;

create or replace function public.turmas_fic_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.equipe where id = new.professor_id and papel = 'professor_fic' and status = 'ativa') then
    raise exception 'A turma precisa de um(a) professor(a) do FIC ativo(a).';
  end if;
  if tg_op = 'INSERT' then new.criado_por := public.meu_id(); new.criado_em := now();
  else new.criado_por := old.criado_por; new.criado_em := old.criado_em; end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists turmas_fic_antes on public.turmas_fic;
create trigger turmas_fic_antes before insert or update on public.turmas_fic for each row execute function public.turmas_fic_antes();

alter table public.turmas_fic enable row level security;
alter table public.matriculas_fic enable row level security;
drop policy if exists turmas_ler on public.turmas_fic;
drop policy if exists turmas_incluir on public.turmas_fic;
drop policy if exists turmas_alterar on public.turmas_fic;
drop policy if exists matriculas_ler on public.matriculas_fic;
create policy turmas_ler on public.turmas_fic for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','professor_fic'));
create policy turmas_incluir on public.turmas_fic for insert to authenticated
  with check (public.meu_papel() = 'coord_geral' or (public.meu_papel() = 'professor_fic' and professor_id = public.meu_id()));
create policy turmas_alterar on public.turmas_fic for update to authenticated
  using (public.meu_papel() = 'coord_geral' or (public.meu_papel() = 'professor_fic' and professor_id = public.meu_id()))
  with check (public.meu_papel() = 'coord_geral' or (public.meu_papel() = 'professor_fic' and professor_id = public.meu_id()));
create policy matriculas_ler on public.matriculas_fic for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','professor_fic') or equipe_id = public.meu_id());
grant select, insert, update on public.turmas_fic to authenticated;
grant select on public.matriculas_fic to authenticated;   -- matrícula só pelas funções abaixo

drop trigger if exists turmas_fic_auditoria on public.turmas_fic;
create trigger turmas_fic_auditoria after insert or update on public.turmas_fic for each row execute function public.auditar();
drop trigger if exists matriculas_fic_auditoria on public.matriculas_fic;
create trigger matriculas_fic_auditoria after insert or update on public.matriculas_fic for each row execute function public.auditar();

-- quem pode matricular nesta turma: a coordenação geral ou o professor dela
create or replace function public.pode_matricular(p_turma uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel(), '') = 'coord_geral'
      or exists (select 1 from public.turmas_fic t where t.id = p_turma and t.professor_id = public.meu_id() and public.meu_papel() = 'professor_fic');
$$;

-- matricula (ou corrige número/data de quem já está nesta turma) e preenche a habilitação da pessoa
create or replace function public.matricular_fic(p_turma uuid, p_equipe uuid, p_numero text, p_data date) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.turmas_fic; p public.equipe; atual public.matriculas_fic; v_id uuid;
begin
  select * into t from public.turmas_fic where id = p_turma;
  if t.id is null then raise exception 'Turma não encontrada.'; end if;
  if not public.pode_matricular(p_turma) then raise exception 'Só o professor da turma ou a coordenação geral matricula.'; end if;
  select * into p from public.equipe where id = p_equipe for update;
  if p.id is null or p.status <> 'ativa' or p.papel not in ('articulacao','apoio','agente') then
    raise exception 'Só bolsistas e agentes de campo ativas são matriculadas no FIC.';
  end if;
  if t.uf is not null and p.uf <> t.uf then raise exception 'Esta turma é de %; % é de %.', t.uf, p.nome, p.uf; end if;
  if length(trim(coalesce(p_numero, ''))) < 3 then raise exception 'Informe o número da matrícula (SUAP).'; end if;
  if p_data is null or p_data > current_date then raise exception 'Data da matrícula vazia ou no futuro.'; end if;
  select * into atual from public.matriculas_fic where equipe_id = p_equipe and cancelada_em is null;
  if atual.id is not null and atual.turma_id <> p_turma then
    raise exception '% já está matriculada em outra turma. Cancele lá antes de trocar.', p.nome;
  end if;
  if atual.id is not null then
    update public.matriculas_fic set numero = trim(p_numero), matriculado_em = p_data where id = atual.id;
    v_id := atual.id;
  else
    insert into public.matriculas_fic (turma_id, equipe_id, numero, matriculado_em, criado_por)
      values (p_turma, p_equipe, trim(p_numero), p_data, public.meu_id()) returning id into v_id;
  end if;
  update public.equipe set matricula_fic_em = p_data, matricula_fic_numero = trim(p_numero) where id = p_equipe;
  return v_id;
end $$;
revoke all on function public.matricular_fic(uuid, uuid, text, date) from public;
grant execute on function public.matricular_fic(uuid, uuid, text, date) to authenticated;

create or replace function public.cancelar_matricula_fic(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.matriculas_fic;
begin
  select * into m from public.matriculas_fic where id = p_id for update;
  if m.id is null or m.cancelada_em is not null then raise exception 'Matrícula não encontrada ou já cancelada.'; end if;
  if not public.pode_matricular(m.turma_id) then raise exception 'Só o professor da turma ou a coordenação geral cancela.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.'; end if;
  if exists (select 1 from public.visitas where executor_id = m.equipe_id and situacao <> 'cancelada') then
    raise exception 'Esta pessoa já tem visita no roteiro de campo, que depende da matrícula. Para corrigir número ou data, matricule de novo na mesma turma.';
  end if;
  update public.matriculas_fic set cancelada_em = now(), motivo_cancelamento = trim(p_motivo) where id = p_id;
  update public.equipe set matricula_fic_em = null, matricula_fic_numero = null where id = m.equipe_id;
end $$;
revoke all on function public.cancelar_matricula_fic(uuid, text) from public;
grant execute on function public.cancelar_matricula_fic(uuid, text) to authenticated;

-- o que o professor vê da equipe: o mínimo para matricular (sem CPF, e-mail, telefone ou endereço)
create or replace function public.equipe_para_fic() returns table (
  id uuid, papel text, uf char(2), nome text, nome_social text, municipio text, status text,
  matricula_fic_em date, matricula_fic_numero text, foto_path text)
language sql stable security definer set search_path = public as $$
  select e.id, e.papel, e.uf, e.nome, e.nome_social, e.municipio, e.status, e.matricula_fic_em, e.matricula_fic_numero, e.foto_path
    from public.equipe e
   where coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','professor_fic')
     and e.status = 'ativa' and e.papel in ('articulacao','apoio','agente','professor_fic')
   order by e.uf, e.nome;
$$;
revoke all on function public.equipe_para_fic() from public;
grant execute on function public.equipe_para_fic() to authenticated;

-- matrículas que já existiam na habilitação (registradas à mão pela coordenação) continuam valendo;
-- aparecem na tela como "registrada pela coordenação, sem turma".

select 'Etapa 11 instalada' as resultado,
       (select count(*) from public.turmas_fic) as turmas,
       (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa') as professores;
