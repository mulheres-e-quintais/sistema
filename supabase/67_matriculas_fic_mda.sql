-- 67 · Matrículas do FIC no painel do MDA/MPA contam como na coordenação (18/10/2026)
-- Antes: o painel de quem acompanha contava só matrículas feitas numa turma (matriculas_fic). A coordenação conta toda pessoa
-- com a matrícula registrada (matricula_fic_em), inclusive a registrada à mão na habilitação, sem turma no sistema.
-- Resultado: o MDA via menos matriculadas que a coordenação (ex.: 4 × 5). Agora as duas telas usam a mesma regra, e o MDA
-- também recebe o total de quem faz o curso (coordenação técnica, bolsistas e agentes ativas), para mostrar "5 de 6".
-- Só contagens: nenhum nome sai daqui. Pode rodar mais de uma vez.
CREATE OR REPLACE FUNCTION public.acompanhamento_formacao(p_orgao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_org text;
begin
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') = 'coord_geral' and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;
  return jsonb_build_object(
    'turmas', (select count(*) from public.turmas_fic t where t.id not in (select public.exemplo_fora())),
    'pessoas', (select count(*) from public.equipe x where x.status = 'ativa' and x.papel in ('coord_tecnico', 'articulacao', 'apoio', 'agente')
                  and x.id not in (select public.exemplo_fora())),
    'matriculas', (select count(*) from public.equipe x where x.status = 'ativa' and x.papel in ('coord_tecnico', 'articulacao', 'apoio', 'agente')
                  and x.matricula_fic_em is not null and x.id not in (select public.exemplo_fora())),
    'encontros', (select count(*) from public.fic_encontros n where n.cancelado_em is null and n.id not in (select public.exemplo_fora())));
end $function$;
revoke all on function public.acompanhamento_formacao(text) from public, anon;
grant execute on function public.acompanhamento_formacao(text) to authenticated;
