-- =====================================================================
-- Mulheres & Quintais — 68: TROCAR O E-MAIL DE QUEM JÁ ENTROU NO SISTEMA (18/10/2026, auditoria independente)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 67. Pode rodar de novo.
--
-- O problema: o e-mail é o login. Trocar o e-mail de quem já tem senha apaga a senha (o equipe_antes zera o login).
-- O 56 dizia que só a coordenação geral faz isso, mas a trava (equipe_login_fixo) era "BEFORE UPDATE OF user_id":
-- só disparava quando a tela mudava o login diretamente. Na troca de e-mail quem zera o login é outro gatilho, então
-- a trava não rodava: a coordenação técnica apagava a senha de uma bolsista sem perceber, e depois o "Gerar código"
-- dela era recusado ("Esta pessoa já entrou no sistema antes...").
-- Agora: a trava roda em toda alteração do cadastro (depois do equipe_antes, pela ordem alfabética dos gatilhos) e a
-- troca de e-mail de quem já entrou é recusada com uma mensagem clara para quem não é a coordenação geral.
-- Não muda nenhum registro.
-- =====================================================================
create or replace function public.equipe_login_fixo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- 68: o e-mail de quem já entrou (o login dela) só a coordenação geral troca: a troca apaga a senha
  if new.email is distinct from old.email and old.user_id is not null and auth.uid() is not null
     and coalesce(public.meu_papel(), '') <> 'coord_geral' and new.status = old.status then
    raise exception 'Esta pessoa já entrou no sistema: o e-mail é o login dela e trocar apaga a senha. Só a coordenação geral faz essa troca.';
  end if;
  -- desligar zera o login (pode); ligar uma conta só pelo código de primeiro acesso (sem usuário logado)
  if new.user_id is not null and new.user_id is distinct from old.user_id and auth.uid() is not null then
    raise exception 'O login de um cadastro não se troca pela tela. Gere um novo código de primeiro acesso.';
  end if;
  -- 56: soltar o login de quem entrou (apagar a senha) só a coordenação geral, ou o próprio desligamento
  if new.user_id is null and old.user_id is not null and auth.uid() is not null
     and coalesce(public.meu_papel(), '') <> 'coord_geral' and new.status = old.status then
    raise exception 'Só a coordenação geral libera um novo primeiro acesso para quem já tem senha.';
  end if;
  return new;
end $$;
revoke all on function public.equipe_login_fixo() from public, anon, authenticated;

drop trigger if exists equipe_login_fixo on public.equipe;
create trigger equipe_login_fixo before update on public.equipe for each row execute function public.equipe_login_fixo();

select 'Etapa 68 instalada: só a coordenação geral troca o e-mail de quem já entrou no sistema' as resultado;
