-- =====================================================================
-- Mulheres & Quintais — Etapa 11: professores do curso FIC, turmas e matrículas; cadastro no Arlo;
--                                  auxiliar administrativo
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Rodar depois de 01 a 10. Pode rodar de novo sem estragar nada.
-- =====================================================================
-- O que o banco garante:
--   * Novo perfil: professor(a) do curso FIC (IFRN, sem estado). Só a coordenação geral cadastra,
--     à mão ou por link de convite. Tem os mesmos dados pessoais e bancários das bolsistas.
--   * Habilitação do professor: documentos na FUNCERN e termo (não se matricula no FIC).
--   * Só os professores do FIC criam turmas e matriculam bolsistas e agentes de campo (qualquer um
--     deles, em qualquer turma, para ninguém ficar travado na ausência do outro). A matrícula preenche
--     a "matrícula no FIC" da habilitação; ninguém mais altera esse passo.
--   * O professor vê da equipe só o necessário para matricular (nome, função, estado, município
--     e a situação da matrícula) — nada de CPF, e-mail, telefone ou endereço.
--   * Matrícula de quem já tem visita no roteiro não é cancelada (a visita depende dela).
--   * Quem já tem cadastro no Arlo informa só os dados básicos (nome, CPF, e-mail, celular, município);
--     nascimento, NIS, endereço completo e dados bancários ficam no Arlo.
--   * Novo perfil: auxiliar administrativo (IFRN, sem estado; um só no projeto), cadastrado só pela coordenação geral.
--     Cadastra a equipe no Arlo (FUNCERN) e registra isso no sistema: o passo da habilitação
--     "Cadastro no Arlo (FUNCERN)" (antes "documentos na FUNCERN") e o termo assinado.
--     Vê os dados pessoais e, pessoa por pessoa, a conta bancária; cada consulta da conta vai
--     para o histórico. Não altera dados pessoais, não desliga ninguém e não mexe na própria habilitação.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil novo
-- ---------------------------------------------------------------------
alter table public.equipe drop constraint if exists equipe_papel_check;
alter table public.equipe add constraint equipe_papel_check
  check (papel in ('coord_geral','coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm'));
alter table public.equipe drop constraint if exists uf_por_papel;
alter table public.equipe add constraint uf_por_papel check (
  (papel in ('articulacao','apoio','agente') and uf is not null) or
  (papel in ('coord_geral','coord_tecnico','professor_fic','auxiliar_adm') and uf is null));

create or replace function public.pode_gerenciar(p_papel text) returns boolean
language sql stable as $$
  select case
    when p_papel in ('coord_tecnico','professor_fic','auxiliar_adm') then public.meu_papel() = 'coord_geral'
    when p_papel in ('articulacao','apoio','agente')   then public.meu_papel() = 'coord_tecnico'
    else false
  end
$$;

-- professor e auxiliar não se matriculam no FIC: habilitam com Arlo (FUNCERN) e termo
create or replace function public.habilitado(p equipe) returns boolean
language sql immutable as $$
  select p.status = 'ativa' and (p.papel in ('professor_fic','auxiliar_adm') or p.matricula_fic_em is not null)
     and p.docs_funcern_em is not null and p.termo_assinado_em is not null
$$;

-- convites também para professor (sem estado)
alter table public.convites drop constraint if exists convites_papel_check;
alter table public.convites add constraint convites_papel_check
  check (papel in ('coord_tecnico','articulacao','apoio','agente','professor_fic','auxiliar_adm'));
alter table public.convites drop constraint if exists uf_do_convite;
alter table public.convites add constraint uf_do_convite check (
  (papel in ('coord_tecnico','professor_fic','auxiliar_adm') and uf is null) or (papel not in ('coord_tecnico','professor_fic','auxiliar_adm') and uf is not null));

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
  if p_papel = 'auxiliar_adm' and exists (select 1 from public.equipe where papel = 'auxiliar_adm' and status = 'ativa') then
    raise exception 'Já há auxiliar administrativo ativo. Desligue antes de convidar outro.';
  end if;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- sem pgcrypto (no Supabase ela fica em outro schema)
  insert into public.convites (token, papel, uf, substitui_id, criado_por)
    values (t, p_papel, case when p_papel in ('coord_tecnico','professor_fic','auxiliar_adm') then null else upper(p_uf) end, p_substitui, public.meu_id());
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
  with check (public.meu_papel() = 'professor_fic');
create policy turmas_alterar on public.turmas_fic for update to authenticated
  using (public.meu_papel() = 'professor_fic') with check (public.meu_papel() = 'professor_fic');
create policy matriculas_ler on public.matriculas_fic for select to authenticated
  using (coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','professor_fic') or equipe_id = public.meu_id());
grant select, insert, update on public.turmas_fic to authenticated;
grant select on public.matriculas_fic to authenticated;   -- matrícula só pelas funções abaixo

drop trigger if exists turmas_fic_auditoria on public.turmas_fic;
create trigger turmas_fic_auditoria after insert or update on public.turmas_fic for each row execute function public.auditar();
drop trigger if exists matriculas_fic_auditoria on public.matriculas_fic;
create trigger matriculas_fic_auditoria after insert or update on public.matriculas_fic for each row execute function public.auditar();

-- quem matricula: sempre um professor do FIC (qualquer um deles, em qualquer turma)
create or replace function public.pode_matricular(p_turma uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel(), '') = 'professor_fic' and exists (select 1 from public.turmas_fic t where t.id = p_turma);
$$;

-- a matrícula no FIC da habilitação só muda pelas funções de matrícula (nem a coordenação altera à mão).
-- Quem roda direto no SQL Editor do Supabase (sem login) continua podendo corrigir.
create or replace function public.equipe_matricula_so_professor() returns trigger
language plpgsql as $$
begin
  if (new.matricula_fic_em is distinct from old.matricula_fic_em or new.matricula_fic_numero is distinct from old.matricula_fic_numero)
     and auth.uid() is not null and coalesce(current_setting('mq.matricula_fic', true), '') <> '1' then
    raise exception 'A matrícula no FIC é registrada pelos professores do curso, na aba Curso FIC.';
  end if;
  return new;
end $$;
drop trigger if exists equipe_matricula_so_professor on public.equipe;
create trigger equipe_matricula_so_professor before update on public.equipe
  for each row execute function public.equipe_matricula_so_professor();

-- matricula (ou corrige número/data de quem já está nesta turma) e preenche a habilitação da pessoa
create or replace function public.matricular_fic(p_turma uuid, p_equipe uuid, p_numero text, p_data date) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.turmas_fic; p public.equipe; atual public.matriculas_fic; v_id uuid;
begin
  select * into t from public.turmas_fic where id = p_turma;
  if t.id is null then raise exception 'Turma não encontrada.'; end if;
  if not public.pode_matricular(p_turma) then raise exception 'A matrícula no FIC é feita pelos professores do curso.'; end if;
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
  perform set_config('mq.matricula_fic', '1', true);
  update public.equipe set matricula_fic_em = p_data, matricula_fic_numero = trim(p_numero) where id = p_equipe;
  perform set_config('mq.matricula_fic', '', true);
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
  if not public.pode_matricular(m.turma_id) then raise exception 'A matrícula no FIC é cancelada pelos professores do curso.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.'; end if;
  if exists (select 1 from public.visitas where executor_id = m.equipe_id and situacao <> 'cancelada') then
    raise exception 'Esta pessoa já tem visita no roteiro de campo, que depende da matrícula. Para corrigir número ou data, matricule de novo na mesma turma.';
  end if;
  update public.matriculas_fic set cancelada_em = now(), motivo_cancelamento = trim(p_motivo) where id = p_id;
  perform set_config('mq.matricula_fic', '1', true);
  update public.equipe set matricula_fic_em = null, matricula_fic_numero = null where id = m.equipe_id;
  perform set_config('mq.matricula_fic', '', true);
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


-- ---------------------------------------------------------------------
-- 3. Cadastro no Arlo: quem já tem, informa só os dados básicos
-- ---------------------------------------------------------------------
alter table public.equipe add column if not exists cadastro_arlo boolean not null default false;
alter table public.pre_cadastros add column if not exists cadastro_arlo boolean not null default false;
-- matrícula SIAPE (só para quem é servidor público federal; opcional)
alter table public.equipe add column if not exists siape text;
alter table public.pre_cadastros add column if not exists siape text;
alter table public.equipe drop constraint if exists siape_ok;
alter table public.equipe add constraint siape_ok check (siape is null or siape ~ '^[0-9]{5,8}$');

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
                                    nome_social, data_nascimento, nis, endereco, socioeconomico, consentimento_lgpd, cadastro_arlo, siape)
    values (c.id, c.papel, c.uf, c.substitui_id, trim(p_dados->>'nome'), v_cpf, v_email,
            nullif(trim(p_dados->>'telefone'), ''), nullif(trim(p_dados->>'municipio'), ''), nullif(trim(p_dados->>'organizacao'), ''),
            nullif(trim(p_dados->>'nome_social'), ''), nullif(p_dados->>'data_nascimento', '')::date,
            nullif(regexp_replace(coalesce(p_dados->>'nis', ''), '\D', '', 'g'), ''),
            coalesce(p_dados->'endereco', '{}'::jsonb), p_dados->'socioeconomico', true, v_arlo,
            nullif(regexp_replace(coalesce(p_dados->>'siape', ''), '\D', '', 'g'), ''));
  update public.convites set usado_em = now() where id = c.id;
end $$;
revoke all on function public.enviar_pre_cadastro(text, jsonb) from public;
grant execute on function public.enviar_pre_cadastro(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Auxiliar administrativo: um só; cadastra no Arlo e registra a habilitação
-- ---------------------------------------------------------------------
create unique index if not exists equipe_um_auxiliar on public.equipe (papel) where papel = 'auxiliar_adm' and status = 'ativa';
create or replace function public.equipe_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare so_hab text[] := array['docs_funcern_em','termo_path','termo_assinado_em','obs_habilitacao','atualizado_em'];
begin
  if tg_op = 'INSERT' then
    new.criado_por := public.meu_id();
    new.status := 'ativa'; new.data_fim := null; new.motivo_desligamento := null; new.user_id := null;
  else
    if new.papel is distinct from old.papel or new.uf is distinct from old.uf
       or new.cpf is distinct from old.cpf or new.criado_por is distinct from old.criado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.';
    end if;
    if old.status = 'desligada' and new.status = 'ativa' then
      raise exception 'Registro desligado não pode ser reativado. Faça um novo cadastro.';
    end if;
    if new.email is distinct from old.email then new.user_id := null; end if;
    if public.meu_papel() = 'coord_geral' and old.papel in ('articulacao','apoio','agente') then
      if (to_jsonb(new) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em','foto_path'])
         is distinct from
         (to_jsonb(old) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em','foto_path']) then
        raise exception 'A coordenação geral só altera a habilitação. Dados pessoais e desligamento são da coordenação técnica.';
      end if;
    end if;
    if public.meu_papel() = 'auxiliar_adm' and auth.uid() is not null then
      if old.id = public.meu_id() then
        -- no próprio cadastro só mudam o vínculo do login e a foto (pelas funções do sistema)
        if (to_jsonb(new) - array['user_id','foto_path','atualizado_em']) is distinct from (to_jsonb(old) - array['user_id','foto_path','atualizado_em']) then
          raise exception 'A sua própria habilitação e os seus dados são registrados pela coordenação geral.';
        end if;
      elsif (to_jsonb(new) - so_hab) is distinct from (to_jsonb(old) - so_hab) then
        raise exception 'O auxiliar administrativo só registra o cadastro no Arlo e o termo. Dados pessoais são de quem cadastrou a pessoa.';
      end if;
    end if;
    if new.status = 'desligada' then new.user_id := null; end if;
    new.atualizado_em := now();
  end if;
  return new;
end $$;

drop policy if exists equipe_ler on public.equipe;
create policy equipe_ler on public.equipe for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico','auxiliar_adm') or user_id = auth.uid()
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf()));
drop policy if exists equipe_alterar on public.equipe;
create policy equipe_alterar on public.equipe for update to authenticated
  using (public.pode_gerenciar(papel)
         or (public.meu_papel() = 'coord_geral' and papel in ('articulacao','apoio','agente'))
         or (public.meu_papel() = 'auxiliar_adm' and papel <> 'coord_geral'))
  with check (public.pode_gerenciar(papel)
         or (public.meu_papel() = 'coord_geral' and papel in ('articulacao','apoio','agente'))
         or (public.meu_papel() = 'auxiliar_adm' and papel <> 'coord_geral'));

-- dados pessoais complementares e termos: o auxiliar precisa deles para o cadastro no Arlo
drop policy if exists privado_ler on public.equipe_privado;
create policy privado_ler on public.equipe_privado for select to authenticated
  using (equipe_id = public.meu_id() or public.meu_papel() in ('coord_geral','coord_tecnico','auxiliar_adm'));
drop policy if exists termos_ler on storage.objects;
drop policy if exists termos_enviar on storage.objects;
create policy termos_ler on storage.objects for select to authenticated
  using (bucket_id = 'termos' and public.meu_papel() in ('coord_geral','coord_tecnico','auxiliar_adm'));
create policy termos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'termos' and public.meu_papel() in ('coord_geral','coord_tecnico','auxiliar_adm'));

-- situação da conta (sem números) também para o auxiliar
create or replace function public.situacao_bancaria() returns table (equipe_id uuid, informado boolean, atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, b.equipe_id is not null, b.atualizado_em
    from public.equipe e left join public.equipe_bancario b on b.equipe_id = e.id
   where coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','auxiliar_adm') and e.status = 'ativa' and e.papel <> 'coord_geral';
$$;

-- a conta de UMA pessoa, para digitar no Arlo. Cada consulta fica no histórico (quem viu, de quem, quando).
create or replace function public.ver_conta_para_arlo(p_equipe uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if coalesce(public.meu_papel(), '') not in ('auxiliar_adm','coord_geral') then
    raise exception 'Só o auxiliar administrativo e a coordenação geral veem a conta para o cadastro no Arlo.';
  end if;
  select to_jsonb(b) - 'equipe_id' into r from public.equipe_bancario b join public.equipe e on e.id = b.equipe_id
   where b.equipe_id = p_equipe and e.status = 'ativa';
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
    values ('equipe_bancario', p_equipe, 'VIEW', public.meu_id(), null,
            jsonb_build_object('aviso', 'conta consultada para o cadastro no Arlo', 'encontrada', r is not null));
  return r;
end $$;
revoke all on function public.situacao_bancaria(), public.ver_conta_para_arlo(uuid) from public, anon;
grant execute on function public.situacao_bancaria(), public.ver_conta_para_arlo(uuid) to authenticated;

-- matrículas que já existiam na habilitação (registradas à mão pela coordenação) continuam valendo;
-- aparecem na tela como "registrada pela coordenação, sem turma".

select 'Etapa 11 instalada' as resultado,
       (select count(*) from public.turmas_fic) as turmas,
       (select count(*) from public.equipe where papel = 'professor_fic' and status = 'ativa') as professores,
       (select count(*) from public.equipe where papel = 'auxiliar_adm' and status = 'ativa') as auxiliares;
