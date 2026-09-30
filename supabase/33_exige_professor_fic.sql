-- =====================================================================
-- Mulheres & Quintais — 33: CADASTRO SÓ COM PROFESSOR DO FIC HABILITADO (decisão da coordenação geral, 29/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo. Precisa do 08 e do 11.
--
-- Coordenação técnica, bolsistas de articulação, bolsistas de apoio e agentes de campo precisam da matrícula
-- no curso FIC. Por isso só podem ser cadastrados (direto ou pelo link) quando já houver pelo menos um
-- professor do FIC ATIVO e HABILITADO: com o cadastro no Arlo e o termo de compromisso registrados.
-- Quem já está cadastrado não muda. Professor, auxiliar administrativo e coordenação geral não dependem disso.
-- =====================================================================
begin;

create or replace function public.tem_professor_fic_habilitado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where papel = 'professor_fic' and status = 'ativa'
                   and docs_funcern_em is not null and termo_assinado_em is not null)
$$;
revoke all on function public.tem_professor_fic_habilitado() from public, anon;
grant execute on function public.tem_professor_fic_habilitado() to authenticated;   -- devolve só sim/não

create or replace function public.exige_professor_fic() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.papel in ('coord_tecnico', 'articulacao', 'apoio', 'agente') and not public.tem_professor_fic_habilitado() then
    raise exception 'Antes, cadastre e habilite um professor do FIC (cadastro no Arlo e termo assinado): sem ele, ninguém consegue a matrícula no curso.';
  end if;
  return new;
end $$;

drop trigger if exists equipe_exige_professor on public.equipe;
create trigger equipe_exige_professor before insert on public.equipe for each row execute function public.exige_professor_fic();
drop trigger if exists convites_exige_professor on public.convites;
create trigger convites_exige_professor before insert on public.convites for each row execute function public.exige_professor_fic();

commit;

select 'Cadastro só com professor do FIC habilitado' as resultado, public.tem_professor_fic_habilitado() as ja_tem_professor_habilitado;
