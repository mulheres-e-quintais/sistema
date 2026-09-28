-- =====================================================================
-- Mulheres & Quintais — Correção 17: "Gerar link de cadastro" dava erro
-- (function gen_random_bytes(integer) does not exist)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- O token do link passa a usar gen_random_uuid(), que já vem no Postgres (não depende da extensão pgcrypto).
-- =====================================================================
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

select 'Correção 17 instalada: gerar link de cadastro' as resultado;
