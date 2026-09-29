-- =====================================================================
-- Mulheres & Quintais — 25: HISTÓRICO SÓ PARA A COORDENAÇÃO GERAL + CADASTRO REPETIDO PELO LINK
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- A aba Histórico é só da coordenação geral, mas o banco ainda deixava a coordenação técnica ler a
-- tabela de histórico inteira — que guarda cópias dos cadastros (CPF, e-mail, telefone), das fichas
-- das mulheres e os títulos dos documentos que são só da coordenação geral (24_documentos.sql).
-- Agora só a coordenação geral lê o histórico. Ninguém altera nem apaga (como antes).
-- E: a mesma pessoa (CPF ou e-mail) não envia o cadastro por um segundo link enquanto o primeiro
-- ainda espera a conferência da coordenação (antes ficava duas vezes na lista para conferir).
-- =====================================================================
begin;

drop policy if exists auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated
  using (public.meu_papel() = 'coord_geral');

-- cadastro pelo link: não aceita o mesmo CPF ou e-mail enquanto houver envio esperando conferência
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
  if exists (select 1 from public.pre_cadastros where situacao = 'aguardando' and (cpf = v_cpf or lower(email) = v_email)) then
    raise exception 'Seus dados já foram enviados e estão com a coordenação para conferir. Não precisa enviar de novo.';
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

select 'Histórico só para a coordenação geral' as resultado,
       (select string_agg(pg_get_expr(polqual, polrelid), '') from pg_policy where polname = 'auditoria_ler') as regra;
