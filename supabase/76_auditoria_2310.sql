-- =====================================================================
-- Mulheres & Quintais — 76: correções da auditoria de segurança de 23/10/2026 (banco inteiro)
-- Rode depois do 75. Pode rodar de novo sem medo: não apaga dados.
--
-- 1. Cadastro novo nasce SEM habilitação. Antes, quem cadastrava (a coordenação técnica, por exemplo) podia mandar a
--    pessoa já com matrícula no FIC, cadastro no Arlo e termo preenchidos, pulando o professor e o auxiliar, e a bolsa
--    dela passava. Agora, na inclusão feita por quem está logado (menos a coordenação geral), esses campos ficam vazios:
--    a matrícula vem do professor, o Arlo e o termo vêm depois, pelo caminho de sempre.
-- 2. O e-mail que a pessoa mandou pelo link de cadastro é o login dela. Antes, quem aprovava podia trocar por um e-mail
--    seu, gerar o código e entrar como a pessoa, lendo o questionário socioeconômico (que pelo 70 é só dela e da
--    coordenação geral). Agora só a coordenação geral aprova com outro e-mail ou troca o e-mail de quem já respondeu
--    o questionário.
-- =====================================================================

-- 1. cadastro novo sem habilitação (roda antes do equipe_antes: os gatilhos vão em ordem alfabética)
create or replace function public.equipe_a0_sem_habilitacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or coalesce(public.meu_papel(), '') = 'coord_geral' then return new; end if;   -- scripts do dono do banco e a coordenação geral
  new.matricula_fic_em := null; new.matricula_fic_numero := null;
  new.docs_funcern_em := null; new.termo_path := null; new.termo_assinado_em := null; new.obs_habilitacao := null;
  return new;
end $$;
revoke all on function public.equipe_a0_sem_habilitacao() from public, anon, authenticated;
drop trigger if exists equipe_a0_sem_habilitacao on public.equipe;
create trigger equipe_a0_sem_habilitacao before insert on public.equipe for each row execute function public.equipe_a0_sem_habilitacao();

-- 2a. aprovar o cadastro do link com o e-mail que a pessoa mandou (outro e-mail, só a coordenação geral)
create or replace function public.pre_cadastros_email_da_pessoa() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text;
begin
  if auth.uid() is null or coalesce(public.meu_papel(), '') = 'coord_geral' then return new; end if;
  if new.situacao = 'aprovado' and new.equipe_id is not null and (old.situacao is distinct from 'aprovado' or old.equipe_id is distinct from new.equipe_id) then
    select email into v_email from public.equipe where id = new.equipe_id;
    if lower(trim(coalesce(v_email, ''))) <> lower(trim(new.email)) then
      raise exception 'O e-mail do cadastro é o que a pessoa mandou pelo link (é o login dela). Para aprovar com outro e-mail, peça à coordenação geral.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pre_cadastros_email_da_pessoa() from public, anon, authenticated;
drop trigger if exists pre_cadastros_email_da_pessoa on public.pre_cadastros;
create trigger pre_cadastros_email_da_pessoa before update on public.pre_cadastros for each row execute function public.pre_cadastros_email_da_pessoa();

-- 2b. trocar o e-mail de quem já respondeu o questionário: só a coordenação geral (ou a própria pessoa)
create or replace function public.equipe_email_com_questionario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.email is not distinct from old.email or auth.uid() is null or coalesce(public.meu_papel(), '') = 'coord_geral' or old.id = public.meu_id() then return new; end if;
  if new.status = old.status and exists (select 1 from public.equipe_socio s where s.equipe_id = old.id) then
    raise exception 'Esta pessoa já respondeu o questionário socioeconômico, que é reservado: o e-mail (login dela) só a coordenação geral troca.';
  end if;
  return new;
end $$;
revoke all on function public.equipe_email_com_questionario() from public, anon, authenticated;
drop trigger if exists equipe_email_com_questionario on public.equipe;
create trigger equipe_email_com_questionario before update on public.equipe for each row execute function public.equipe_email_com_questionario();

select 'Etapa 76 instalada: cadastro novo sem habilitação; e-mail do link é o da pessoa' as resultado;
