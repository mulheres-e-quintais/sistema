-- =====================================================================
-- Mulheres & Quintais — 23: COORDENAÇÃO TÉCNICA TAMBÉM FAZ O CURSO FIC
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Decisão de 29/09/2026: a coordenação técnica participa do curso FIC (a bolsa só pode ser paga a
-- estudante do IFRN). Antes, a habilitação dela pedia a matrícula, mas o sistema não deixava matriculá-la.
-- Agora: os professores do FIC matriculam a coordenação técnica em qualquer turma (ela atua nos 5 estados)
-- e ela aparece na lista de quem ainda não tem matrícula e no acesso ao AVA do mês.
-- =====================================================================
begin;

create or replace function public.matricular_fic(p_turma uuid, p_equipe uuid, p_numero text, p_data date) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.turmas_fic; p public.equipe; atual public.matriculas_fic; v_id uuid;
begin
  select * into t from public.turmas_fic where id = p_turma;
  if t.id is null then raise exception 'Turma não encontrada.'; end if;
  if not public.pode_matricular(p_turma) then raise exception 'A matrícula no FIC é feita pelos professores do curso.'; end if;
  select * into p from public.equipe where id = p_equipe for update;
  if p.id is null or p.status <> 'ativa' or p.papel not in ('coord_tecnico','articulacao','apoio','agente') then
    raise exception 'Só a coordenação técnica, bolsistas e agentes de campo ativas são matriculadas no FIC.';
  end if;
  -- turma de um estado aceita só gente daquele estado; a coordenação técnica (sem estado) entra em qualquer turma
  if t.uf is not null and p.uf is not null and p.uf <> t.uf then raise exception 'Esta turma é de %; % é de %.', t.uf, p.nome, p.uf; end if;
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

-- o que o professor vê da equipe para matricular (sem CPF, e-mail, telefone ou endereço): agora com a coordenação técnica
create or replace function public.equipe_para_fic() returns table (
  id uuid, papel text, uf char(2), nome text, nome_social text, municipio text, status text,
  matricula_fic_em date, matricula_fic_numero text, foto_path text)
language sql stable security definer set search_path = public as $$
  select e.id, e.papel, e.uf, e.nome, e.nome_social, e.municipio, e.status, e.matricula_fic_em, e.matricula_fic_numero, e.foto_path
    from public.equipe e
   where coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico','professor_fic')
     and e.status = 'ativa' and e.papel in ('coord_tecnico','articulacao','apoio','agente','professor_fic')
   order by e.uf nulls first, e.nome;
$$;
revoke all on function public.equipe_para_fic() from public;
grant execute on function public.equipe_para_fic() to authenticated;

commit;

select 'Coordenação técnica liberada no curso FIC' as resultado,
       (select count(*) from public.equipe where papel = 'coord_tecnico' and status = 'ativa' and matricula_fic_em is null) as coordenacao_tecnica_sem_matricula;
