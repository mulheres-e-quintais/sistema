-- =====================================================================
-- Mulheres & Quintais — 52: PERFIS DE ACOMPANHAMENTO (MDA e MPA) (03/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 01, 02, 03, 11, 13, 18, 38 e 43 (equipe, fichas, campo, curso FIC, avaliação, código de acesso).
--
-- Dois perfis só de LEITURA para quem acompanha o projeto de fora:
--   mda: o ministério que financia. Vê o projeto inteiro em números: alcance, etapas, mapa, evolução,
--        perfil das beneficiárias e indicadores de impacto. Nada de parte financeira.
--   mpa: a organização parceira. Vê o andamento no território: cada estado, equipe, formação e pendências.
--
-- Como a proteção funciona:
--   * Quem acompanha NÃO entra na tabela da equipe. Fica numa tabela à parte (observadores). Por isso
--     nenhuma regra de acesso que já existe vale para ele: não lê ficha, equipe, pagamento nem histórico.
--   * A única coisa que ele alcança é a função acompanhamento_dados(), que devolve SÓ contagens.
--     Nenhum nome, CPF, endereço, telefone, foto ou dado bancário sai por ela.
--   * No perfil das beneficiárias e no impacto, contagem de 1 a 4 pessoas vira "menos de 5" (-1), para
--     ninguém ser identificada por dedução.
--   * Dados de exemplo (tabela public.exemplo) ficam fora das contas.
--   * Só a coordenação geral cadastra, desativa e gera o código de primeiro acesso de quem acompanha.
-- =====================================================================
begin;

create table if not exists public.exemplo (tabela text not null, id uuid not null, primary key (tabela, id));
alter table public.exemplo enable row level security;

create table if not exists public.observadores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 5 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 160),
  orgao         text not null check (orgao in ('mda', 'mpa')),
  cargo         text check (cargo is null or length(cargo) <= 120),
  status        text not null default 'ativo' check (status in ('ativo', 'inativo')),
  user_id       uuid unique,
  codigo_hash   text,
  codigo_expira timestamptz,
  criado_por    uuid references public.equipe(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists observadores_email on public.observadores (lower(trim(email)));

alter table public.observadores enable row level security;
revoke all on public.observadores from anon, authenticated;        -- tudo passa pelas funções abaixo

-- quem sou eu, se sou de acompanhamento (o app chama depois de não achar a pessoa na equipe)
create or replace function public.acompanhamento_eu() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', o.id, 'nome', o.nome, 'orgao', o.orgao, 'cargo', o.cargo)
    from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo' limit 1
$$;
revoke all on function public.acompanhamento_eu() from public, anon;
grant execute on function public.acompanhamento_eu() to authenticated;

-- lista para a coordenação geral (sem o código)
create or replace function public.listar_observadores() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral vê quem acompanha o projeto.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome, 'email', o.email, 'orgao', o.orgao, 'cargo', o.cargo, 'status', o.status,
      'tem_senha', o.user_id is not null, 'codigo_vale_ate', case when o.user_id is null and o.codigo_expira > now() then o.codigo_expira end, 'criado_em', o.criado_em) order by o.orgao, o.nome)
    from public.observadores o), '[]'::jsonb);
end $$;
revoke all on function public.listar_observadores() from public, anon;
grant execute on function public.listar_observadores() to authenticated;

create or replace function public.salvar_observador(p_id uuid, p_nome text, p_email text, p_orgao text, p_cargo text, p_ativo boolean) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_nome text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g'); v_email text := lower(trim(coalesce(p_email, '')));
        v_cargo text := nullif(trim(coalesce(p_cargo, '')), ''); o public.observadores;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral cadastra quem acompanha o projeto.'; end if;
  if length(v_nome) < 5 or length(v_nome) > 120 then raise exception 'Escreva o nome completo (de 5 a 120 letras).'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 160 then raise exception 'E-mail inválido.'; end if;
  if coalesce(p_orgao, '') not in ('mda', 'mpa') then raise exception 'Escolha o órgão: MDA ou MPA.'; end if;
  if length(coalesce(v_cargo, '')) > 120 then raise exception 'O cargo passou de 120 letras.'; end if;
  if exists (select 1 from public.equipe e where lower(e.email::text) = v_email) then
    raise exception 'Este e-mail já é de uma pessoa da equipe. Quem é da equipe não pode ser também de acompanhamento.';
  end if;
  if exists (select 1 from public.observadores x where lower(trim(x.email)) = v_email and (p_id is null or x.id <> p_id)) then
    raise exception 'Este e-mail já está cadastrado no acompanhamento.';
  end if;
  if p_id is null then
    if (select count(*) from public.observadores where status = 'ativo') >= 20 then raise exception 'Limite de 20 pessoas de acompanhamento ativas.'; end if;
    insert into public.observadores (nome, email, orgao, cargo, status, criado_por)
    values (v_nome, v_email, p_orgao, v_cargo, case when coalesce(p_ativo, true) then 'ativo' else 'inativo' end, public.meu_id()) returning id into v_id;
  else
    select * into o from public.observadores where id = p_id;
    if o.id is null then raise exception 'Cadastro não encontrado. Atualize a tela e tente de novo.'; end if;
    if o.user_id is not null and lower(trim(o.email)) <> v_email then raise exception 'Esta pessoa já criou a senha com este e-mail. Para trocar o e-mail, desative este cadastro e faça outro.'; end if;
    update public.observadores set nome = v_nome, email = v_email, orgao = p_orgao, cargo = v_cargo,
      status = case when coalesce(p_ativo, true) then 'ativo' else 'inativo' end, atualizado_em = now() where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.salvar_observador(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.salvar_observador(uuid, text, text, text, text, boolean) to authenticated;

-- código de primeiro acesso (vale 7 dias, uma vez). Se a pessoa já tinha senha, a antiga deixa de valer.
create or replace function public.gerar_codigo_observador(p_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.observadores;
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  h text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  c text := ''; i int;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral gera o código de quem acompanha o projeto.'; end if;
  select * into o from public.observadores where id = p_id;
  if o.id is null or o.status <> 'ativo' then raise exception 'Cadastro não encontrado ou desativado.'; end if;
  for i in 0..7 loop
    c := c || substr(alfabeto, 1 + (('x' || substr(h, 1 + i * 4, 4))::bit(16)::int % length(alfabeto)), 1);
  end loop;
  if o.user_id is not null then
    update public.observadores set user_id = null where id = o.id;
    delete from auth.users where id = o.user_id;
  end if;
  update public.observadores set codigo_hash = public.codigo_hash(o.id, c), codigo_expira = now() + interval '7 days', atualizado_em = now() where id = o.id;
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('observadores', o.id, case when o.user_id is null then 'CODIGO' else 'NOVO_ACESSO' end, public.meu_id(), null,
          jsonb_build_object('expira_em', now() + interval '7 days', 'senha_anterior_apagada', o.user_id is not null));
  return substr(c, 1, 4) || '-' || substr(c, 5, 4);
end $$;
revoke all on function public.gerar_codigo_observador(uuid) from public, anon;
grant execute on function public.gerar_codigo_observador(uuid) to authenticated;

-- histórico: cadastro e alteração de quem acompanha (o código não entra no histórico)
create or replace function public.observadores_auditar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'codigo_hash' - 'codigo_expira' - 'atualizado_em' - 'user_id') = (to_jsonb(old) - 'codigo_hash' - 'codigo_expira' - 'atualizado_em' - 'user_id') then return new; end if;
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('observadores', new.id, tg_op, public.meu_id(),
          case when tg_op = 'UPDATE' then to_jsonb(old) - 'codigo_hash' - 'codigo_expira' end, to_jsonb(new) - 'codigo_hash' - 'codigo_expira');
  return new;
end $$;
drop trigger if exists observadores_auditoria on public.observadores;
create trigger observadores_auditoria after insert or update on public.observadores for each row execute function public.observadores_auditar();
revoke all on function public.observadores_auditar() from public, anon, authenticated;   -- funções de gatilho: ninguém chama direto

create or replace function public.observadores_nao_apaga() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin raise exception 'Cadastro de acompanhamento não se apaga. Desative-o.'; end $$;
drop trigger if exists observadores_nao_apaga on public.observadores;
create trigger observadores_nao_apaga before delete on public.observadores for each row execute function public.observadores_nao_apaga();
revoke all on function public.observadores_nao_apaga() from public, anon, authenticated;

-- criar senha: quem é da equipe segue EXATAMENTE a regra do 43; quem não é da equipe só passa se for de
-- acompanhamento, ativo, ainda sem senha e com o código certo e no prazo
create or replace function public.bloquear_conta_nao_cadastrada() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.equipe; k public.acesso_codigos; o public.observadores;
begin
  select * into m from public.equipe
   where lower(email::text) = lower(new.email::text) and status = 'ativa' and user_id is null limit 1;
  if m.id is null then
    select * into o from public.observadores
     where lower(trim(email)) = lower(trim(new.email::text)) and status = 'ativo' and user_id is null limit 1;
    if o.id is null then raise exception 'E-mail não cadastrado no projeto.'; end if;
    if o.codigo_hash is null then raise exception 'Código de acesso não gerado.'; end if;
    if o.codigo_expira < now() then raise exception 'Código de acesso vencido.'; end if;
    if o.codigo_hash <> public.codigo_hash(o.id, new.raw_user_meta_data ->> 'codigo') then raise exception 'Código de acesso errado.'; end if;
    return new;
  end if;
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

-- conta criada: liga ao cadastro de acompanhamento e queima o código (vale uma vez)
create or replace function public.ligar_conta_acompanhamento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.equipe e where e.user_id = new.id) then return new; end if;
  update public.observadores set user_id = new.id, codigo_hash = null, codigo_expira = null, atualizado_em = now()
   where lower(trim(email)) = lower(trim(new.email::text)) and status = 'ativo' and user_id is null;
  return new;
end $$;
drop trigger if exists auth_liga_acompanhamento on auth.users;
create trigger auth_liga_acompanhamento after insert on auth.users for each row execute function public.ligar_conta_acompanhamento();
revoke all on function public.ligar_conta_acompanhamento() from public, anon, authenticated;
revoke all on function public.bloquear_conta_nao_cadastrada() from public, anon, authenticated;

-- contagem pequena não sai: de 1 a 4 vira -1 ("menos de 5")
create or replace function public.acomp_n(n bigint) returns int language sql immutable as $$
  select case when n between 1 and 4 then -1 else n::int end
$$;
revoke all on function public.acomp_n(bigint) from public, anon, authenticated;

-- os números do acompanhamento. p_orgao só vale para a coordenação, que pode ver a tela como o MDA ou o MPA veem.
create or replace function public.acompanhamento_dados(p_orgao text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org text; hoje date := (now() at time zone 'America/Fortaleza')::date; r jsonb; v_uf jsonb; v_mun jsonb; v_mes jsonb; v_extra jsonb;
begin
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico') and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;

  -- por estado
  with f as (select x.* from public.fichas x where x.id not in (select id from public.exemplo)),
       s as (select * from f where resultado = 'selecionada' and situacao = 'aprovada'),
       v as (select x.* from public.visitas x join f on f.id = x.ficha_id where x.situacao <> 'cancelada'),
       d as (select x.* from public.diagnosticos x join f on f.id = x.ficha_id),
       a as (select x.* from public.avaliacoes x join f on f.id = x.ficha_id),
       e as (select x.* from public.equipe x where x.status = 'ativa' and x.id not in (select id from public.exemplo))
  select jsonb_agg(jsonb_build_object('uf', u.uf,
      'indicadas', (select count(*) from f where f.uf = u.uf),
      'selecionadas', (select count(*) from s where s.uf = u.uf),
      'espera', (select count(*) from f where f.uf = u.uf and f.resultado = 'lista_espera'),
      'sem_agua', (select count(*) from f where f.uf = u.uf and f.resultado = 'sem_agua'),
      'municipios', (select count(distinct public.sem_acento(s.municipio)) from s where s.uf = u.uf),
      'comunidades', (select count(distinct public.sem_acento(s.municipio) || '|' || public.sem_acento(s.comunidade)) from s where s.uf = u.uf),
      'pessoas', (select coalesce(sum(s.pessoas_familia), 0) from s where s.uf = u.uf),
      'diagnosticos', (select count(*) from d where d.uf = u.uf),
      'planos', (select count(*) from d where d.uf = u.uf and d.situacao = 'aprovado' and not coalesce(d.sem_agua, false)),
      'diag_sem_agua', (select count(*) from d where d.uf = u.uf and coalesce(d.sem_agua, false)),
      'area_m2', (select coalesce(sum(d.area_m2), 0) from d where d.uf = u.uf and not coalesce(d.sem_agua, false)),
      'implantados', (select count(*) from v where v.uf = u.uf and v.etapa = 'implantacao' and v.situacao = 'realizada'),
      'acompanhamentos', (select count(*) from v where v.uf = u.uf and v.etapa = 'acompanhamento' and v.situacao = 'realizada'),
      'avaliacoes', (select count(*) from a where a.uf = u.uf),
      'visitas_feitas', (select count(*) from v where v.uf = u.uf and v.situacao = 'realizada'),
      'agendadas', (select count(*) from v where v.uf = u.uf and v.situacao = 'prevista' and v.data_prevista >= hoje),
      'atrasadas', (select count(*) from v where v.uf = u.uf and v.situacao = 'prevista' and v.data_prevista < hoje),
      'bolsistas', (select count(*) from e where e.uf = u.uf and e.papel in ('articulacao', 'apoio')),
      'agentes', (select count(*) from e where e.uf = u.uf and e.papel = 'agente')) order by u.uf)
    into v_uf
    from (values ('AL'), ('BA'), ('PE'), ('PI'), ('SE')) as u(uf);

  -- por município (selecionadas aprovadas e quintais já implantados)
  select coalesce(jsonb_agg(jsonb_build_object('uf', x.uf, 'municipio', x.municipio, 'n', x.n, 'implantados', x.imp) order by x.uf, x.municipio), '[]'::jsonb) into v_mun
    from (select f.uf, (array_agg(regexp_replace(trim(f.municipio), '\s+', ' ', 'g') order by length(regexp_replace(trim(f.municipio), '[ -~]', '', 'g')) desc, f.municipio))[1] municipio, count(*) n,
                 count(*) filter (where exists (select 1 from public.visitas v where v.ficha_id = f.id and v.etapa = 'implantacao' and v.situacao = 'realizada')) imp
            from public.fichas f
           where f.resultado = 'selecionada' and f.situacao = 'aprovada' and f.id not in (select id from public.exemplo)
           group by f.uf, public.sem_acento(f.municipio)) x;

  -- por mês: visitas feitas, por etapa
  select coalesce(jsonb_agg(jsonb_build_object('mes', x.mes, 'diagnostico', x.dg, 'implantacao', x.im, 'acompanhamento', x.ac, 'avaliacao', x.av) order by x.mes), '[]'::jsonb) into v_mes
    from (select to_char(v.data_realizada, 'YYYY-MM') mes,
                 count(*) filter (where v.etapa = 'diagnostico') dg, count(*) filter (where v.etapa = 'implantacao') im,
                 count(*) filter (where v.etapa = 'acompanhamento') ac, count(*) filter (where v.etapa not in ('diagnostico', 'implantacao', 'acompanhamento')) av
            from public.visitas v
           where v.situacao = 'realizada' and v.data_realizada is not null and v.ficha_id not in (select id from public.exemplo)
           group by 1) x;

  if v_org = 'mda' then
    with s as (select x.* from public.fichas x where x.resultado = 'selecionada' and x.situacao = 'aprovada' and x.id not in (select id from public.exemplo)),
         d as (select x.* from public.diagnosticos x where not coalesce(x.sem_agua, false) and x.ficha_id not in (select id from public.exemplo)),
         a as (select x.* from public.avaliacoes x where x.ficha_id not in (select id from public.exemplo)),
         i as (select extract(year from age(hoje, s.data_nascimento))::int idade from s)
    select jsonb_build_object(
      'perfil', jsonb_build_object('base', (select count(*) from s),
        'sustento', public.acomp_n((select count(*) from s where p_sustento)), 'cadunico', public.acomp_n((select count(*) from s where p_cadunico)),
        'sem_ater', public.acomp_n((select count(*) from s where p_sem_ater)), 'raca_povo', public.acomp_n((select count(*) from s where p_raca_povo)),
        'jovem', public.acomp_n((select count(*) from s where p_jovem)), 'grupo', public.acomp_n((select count(*) from s where p_grupo)),
        'caf', public.acomp_n((select count(*) from s where p_caf)),
        'faixas', jsonb_build_object('18 a 29', public.acomp_n((select count(*) from i where idade < 30)), '30 a 44', public.acomp_n((select count(*) from i where idade between 30 and 44)),
                                     '45 a 59', public.acomp_n((select count(*) from i where idade between 45 and 59)), '60 ou mais', public.acomp_n((select count(*) from i where idade >= 60)))),
      'impacto', jsonb_build_object(
        'base_n', (select count(*) from d),
        'renda_quintal_media', case when (select count(*) from d where renda_quintal is not null) >= 5 then (select round(avg(renda_quintal)::numeric, 2) from d where renda_quintal is not null) end,
        'final_n', (select count(*) from a),
        'produz', jsonb_build_object('sim', public.acomp_n((select count(*) from a where quintal_produz = 'sim')), 'em_parte', public.acomp_n((select count(*) from a where quintal_produz = 'em_parte')),
                                     'nao', public.acomp_n((select count(*) from a where quintal_produz = 'nao'))),
        'ebia_final', jsonb_build_object('seguranca', public.acomp_n((select count(*) from a where ebia_nivel = 'seguranca')), 'leve', public.acomp_n((select count(*) from a where ebia_nivel = 'leve')),
                                         'moderada', public.acomp_n((select count(*) from a where ebia_nivel = 'moderada')), 'grave', public.acomp_n((select count(*) from a where ebia_nivel = 'grave')))))
      into v_extra;
  else
    select jsonb_build_object('formacao', jsonb_build_object(
        'turmas', (select count(*) from public.turmas_fic t where t.id not in (select id from public.exemplo)),
        'matriculas', (select count(*) from public.matriculas_fic m where m.id not in (select id from public.exemplo)),
        'encontros', (select count(*) from public.fic_encontros n where n.id not in (select id from public.exemplo))))
      into v_extra;
  end if;

  r := jsonb_build_object('orgao', v_org, 'gerado_em', now(), 'hoje', hoje, 'por_uf', v_uf, 'municipios', v_mun, 'mensal', v_mes) || v_extra;
  return r;
end $$;
revoke all on function public.acompanhamento_dados(text) from public, anon;
grant execute on function public.acompanhamento_dados(text) to authenticated;

commit;

select 'Perfis de acompanhamento instalados' as resultado,
       (select count(*) from public.observadores where status = 'ativo') as pessoas_de_acompanhamento_ativas,
       (select prosrc like '%observadores%' from pg_proc where proname = 'bloquear_conta_nao_cadastrada' and pronamespace = 'public'::regnamespace) as primeiro_acesso_aceita_acompanhamento;
