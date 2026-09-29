-- =====================================================================
-- Mulheres & Quintais — 32: PAGAMENTO E ENTREGAS SÓ A PARTIR DO MÊS DE INÍCIO (decisão da coordenação geral, 29/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo. Precisa do 12 e do 19.
-- Bolsa e ajuda de custo só podem ser solicitadas a partir do mês de início da pessoa no projeto
-- (campo "Início da bolsa" / "Início no projeto" do cadastro). Ex.: início em 15/10 → outubro em diante.
-- Vale também para as entregas do mês: a lista de presença e a confirmação de acesso ao AVA
-- (o AVA, além disso, só a partir do mês da matrícula no FIC).
-- O resto é igual ao 12 e ao 19. Se algum dia rodar o 12 ou o 19 de novo, rode este depois.
-- =====================================================================
begin;

create or replace function public.solicitar_pagamento(p_tipo text, p_mes date, p_valor numeric, p_relatorio text, p_visitas uuid[], p_detalhe jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.equipe; v_mes date := date_trunc('month', p_mes)::date; s public.solicitacoes_pagamento; v_id uuid; n int; ruins int;
begin
  select * into eu from public.equipe where id = public.meu_id();
  if eu.id is null or eu.status <> 'ativa' then raise exception 'Entre no sistema para solicitar.'; end if;
  if p_tipo = 'ajuda_custo' and eu.papel not in ('articulacao','apoio','agente') then
    raise exception 'Ajuda de custo é só para bolsistas e agentes de campo que fazem visitas.';
  end if;
  if p_tipo = 'bolsa' and eu.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm') then
    raise exception 'Seu perfil não recebe bolsa mensal pelo projeto.';
  end if;
  if not public.habilitado(eu) then raise exception 'Sua habilitação ainda não está completa: sem ela não há pagamento.'; end if;
  if v_mes > date_trunc('month', current_date)::date then raise exception 'Só dá para solicitar o mês atual ou meses anteriores.'; end if;
  -- 32: nada antes do mês em que a pessoa começou no projeto (início da bolsa, data do cadastro)
  if eu.data_inicio is not null and v_mes < date_trunc('month', eu.data_inicio)::date then
    raise exception 'Você começou no projeto em %: só dá para solicitar a partir desse mês.', to_char(eu.data_inicio, 'MM/YYYY');
  end if;
  select * into s from public.solicitacoes_pagamento where tipo = p_tipo and equipe_id = eu.id and mes = v_mes for update;
  if s.id is not null and s.situacao <> 'devolvida' then raise exception 'Você já solicitou este mês. Acompanhe a situação na lista.'; end if;

  if p_tipo = 'ajuda_custo' then
    n := coalesce(array_length(p_visitas, 1), 0);
    if n = 0 then raise exception 'Marque as visitas feitas no mês.'; end if;
    select count(*) into ruins from unnest(p_visitas) x(id)
      left join public.visitas v on v.id = x.id
     where v.id is null or v.executor_id <> eu.id or v.situacao <> 'realizada' or date_trunc('month', v.data_realizada)::date <> v_mes
        or exists (select 1 from public.solicitacao_visitas sv where sv.visita_id = x.id and sv.solicitacao_id is distinct from s.id);
    if ruins > 0 then raise exception 'Há visita que não é sua, não está feita, é de outro mês ou já foi solicitada.'; end if;
    if coalesce(p_valor, 0) <= 0 then raise exception 'Valor inválido.'; end if;
  else
    if length(trim(coalesce(p_relatorio, ''))) < 50 then raise exception 'Escreva o relatório de atividades do mês (pelo menos algumas linhas).'; end if;
  end if;

  if s.id is null then
    insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio, detalhe)
      values (p_tipo, eu.id, v_mes, p_valor, nullif(trim(p_relatorio), ''), coalesce(p_detalhe, '{}'::jsonb)) returning id into v_id;
  else
    update public.solicitacoes_pagamento set situacao = 'solicitada', valor_solicitado = p_valor, valor_avalizado = null, relatorio = nullif(trim(p_relatorio), ''),
      detalhe = coalesce(p_detalhe, '{}'::jsonb), solicitada_em = now(), aval_por = null, aval_em = null where id = s.id;
    v_id := s.id;
    delete from public.solicitacao_visitas where solicitacao_id = s.id;
  end if;
  if p_tipo = 'ajuda_custo' then
    insert into public.solicitacao_visitas (visita_id, solicitacao_id) select x, v_id from unnest(p_visitas) x;
  end if;
  return v_id;
end $$;


create or replace function public.entregas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.equipe;
begin
  new.marcado_por := public.meu_id();
  new.marcado_em := now();
  if new.mes > date_trunc('month', now())::date then raise exception 'Mês no futuro.'; end if;
  select * into p from public.equipe where id = new.equipe_id;
  if p.data_inicio is not null and new.mes < date_trunc('month', p.data_inicio)::date then
    raise exception '% começou no projeto em %: não há entrega antes desse mês.', coalesce(p.nome_social, p.nome), to_char(p.data_inicio, 'MM/YYYY');
  end if;
  if new.item = 'ava' and (p.matricula_fic_em is null or new.mes < date_trunc('month', p.matricula_fic_em)::date) then
    raise exception 'Acesso ao AVA só a partir do mês da matrícula no FIC.';
  end if;
  return new;
end $$;

commit;

select 'Pagamento e entregas a partir do mês de início instalados' as resultado;
