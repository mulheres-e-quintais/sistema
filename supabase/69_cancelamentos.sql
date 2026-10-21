-- =====================================================================
-- Mulheres & Quintais — 69: CANCELAR PEDIDOS (21/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 68. Pode rodar de novo.
--
-- 1. Pedido de pagamento (bolsa ou ajuda de custo) agora pode ser CANCELADO, com o motivo registrado:
--    - a própria pessoa cancela o dela enquanto não tem aval (aguardando aval ou devolvido);
--    - a coordenação técnica cancela, nesse mesmo ponto, os pedidos em que ela dá o aval (com motivo);
--    - a coordenação geral cancela também o que já tem aval e ainda não foi lançado no Arlo (com motivo).
--    Lançado no Arlo não se cancela por aqui (o dinheiro já saiu: é com a FUNCERN).
--    As visitas de um pedido de ajuda de custo cancelado ficam livres para um pedido novo. A bolsa cancelada
--    do mês pode ser pedida de novo (o mesmo registro volta para "aguardando aval").
-- 2. Desligamento com data no passado: a data de saída não pode ficar antes de bolsa já aprovada (com aval
--    ou lançada no Arlo). Bolsa ainda sem aval de mês depois da saída é cancelada pelo sistema, com o motivo.
--    Antes a bolsa aprovada ficava presa: não ia para o Arlo e não havia como tirar da fila.
-- 3. Passagem ou evento JÁ AUTORIZADO: só a coordenação geral cancela (o valor volta ao saldo do teto) ou
--    ajusta o valor (conferido de novo contra o teto), sempre com o motivo, que fica na observação e no histórico.
-- Não muda nenhum registro existente.
-- =====================================================================

-- ---------- 1. pedido de pagamento cancelado ----------
alter table public.solicitacoes_pagamento add column if not exists cancelado_por uuid references public.equipe(id);
alter table public.solicitacoes_pagamento add column if not exists cancelado_em timestamptz;
alter table public.solicitacoes_pagamento add column if not exists motivo_cancelamento text;
alter table public.solicitacoes_pagamento drop constraint if exists tam_motivo_cancelamento_2000;
alter table public.solicitacoes_pagamento add constraint tam_motivo_cancelamento_2000 check (length(motivo_cancelamento) <= 2000) not valid;
alter table public.solicitacoes_pagamento drop constraint if exists solicitacoes_pagamento_situacao_check;
alter table public.solicitacoes_pagamento add constraint solicitacoes_pagamento_situacao_check
  check (situacao in ('solicitada', 'devolvida', 'avalizada', 'lancada', 'cancelada'));

create or replace function public.cancelar_pagamento(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s' as $$
declare eu public.equipe; s public.solicitacoes_pagamento; dono public.equipe; v_mot text := nullif(trim(p_motivo), ''); v_pessoa uuid;
begin
  select * into eu from public.equipe where id = public.meu_id();
  if eu.id is null or eu.status <> 'ativa' then raise exception 'Entre no sistema com um cadastro ativo para cancelar.'; end if;
  if length(coalesce(v_mot, '')) > 2000 then raise exception 'Texto muito longo em motivo do cancelamento (máximo 2.000 caracteres).'; end if;
  -- mesma trava do solicitar_pagamento (um pedido de cada vez por pessoa): cancelar e reenviar ao mesmo tempo não se cruzam
  select equipe_id into v_pessoa from public.solicitacoes_pagamento where id = p_id;
  if v_pessoa is null then raise exception 'Solicitação não encontrada.'; end if;
  perform public.trava_aviso('solicitar_pagamento_' || v_pessoa::text);
  select * into s from public.solicitacoes_pagamento where id = p_id for update;
  if s.situacao = 'cancelada' then raise exception 'Esta solicitação já foi cancelada.'; end if;
  if s.situacao = 'lancada' then
    raise exception 'Esta solicitação já foi lançada no Arlo: não dá para cancelar pelo sistema. Se o pagamento não era devido, a coordenação geral trata com a FUNCERN.';
  end if;
  select * into dono from public.equipe where id = s.equipe_id;
  if s.equipe_id = eu.id then
    if s.situacao not in ('solicitada', 'devolvida') then raise exception 'Este pedido já tem o aval: agora só a coordenação geral cancela.'; end if;
  elsif eu.papel = 'coord_geral' then
    null;   -- aguardando aval, devolvido ou com aval (falta lançar no Arlo)
  elsif eu.papel = 'coord_tecnico' and public.quem_avaliza(s.tipo, dono.papel) = 'coord_tecnico' then
    if s.situacao not in ('solicitada', 'devolvida') then raise exception 'Este pedido já tem o aval: agora só a coordenação geral cancela.'; end if;
  else
    raise exception 'Quem cancela este pedido é a própria pessoa ou a coordenação.';
  end if;
  if s.equipe_id <> eu.id and length(coalesce(v_mot, '')) < 5 then
    raise exception 'Escreva o motivo do cancelamento (a pessoa vê o motivo).';
  end if;
  update public.solicitacoes_pagamento set situacao = 'cancelada', cancelado_por = eu.id, cancelado_em = now(),
    motivo_cancelamento = coalesce(v_mot, 'Cancelado por quem pediu.') where id = s.id;
  delete from public.solicitacao_visitas where solicitacao_id = s.id;   -- as visitas ficam livres para um pedido novo
end $$;
revoke all on function public.cancelar_pagamento(uuid, text) from public, anon;
grant execute on function public.cancelar_pagamento(uuid, text) to authenticated;

-- pedir de novo: a bolsa cancelada do mês volta (o mesmo registro); o pedido de ajuda de custo cancelado não conta
-- para "complementar". Igual ao 47 nas outras regras.
create or replace function public.solicitar_pagamento(p_tipo text, p_mes date, p_valor numeric, p_relatorio text, p_visitas uuid[], p_detalhe jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
declare eu public.equipe; v_mes date; s public.solicitacoes_pagamento; v_id uuid; n int; ruins int;
        hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: o "hoje" é o de Fortaleza, não o da conexão
        complementar boolean := false; v_detalhe jsonb; v_total numeric;
begin
  -- 46: tipo e mês conferidos antes de tudo (mensagem clara no lugar do erro do banco)
  if p_tipo is null or p_tipo not in ('ajuda_custo', 'bolsa') then raise exception 'Tipo de pagamento inválido: escolha ajuda de custo ou bolsa.'; end if;
  if p_mes is null then raise exception 'Informe o mês do pedido.'; end if;
  v_mes := p_mes - (extract(day from p_mes)::int - 1);
  -- 47: tamanho do que a tela manda (nada grande demais segue adiante)
  if length(coalesce(p_relatorio, '')) > 20000 then raise exception 'Texto muito longo em relatório do mês (máximo 20.000 caracteres).'; end if;
  if length(coalesce(p_detalhe, '{}'::jsonb)::text) > 100000 then raise exception 'Texto muito longo em detalhe do pedido (máximo 100.000 caracteres).'; end if;
  if coalesce(array_length(p_visitas, 1), 0) > 200 then raise exception 'Visitas demais num pedido só (máximo 200).'; end if;
  -- 47: segura o próprio cadastro enquanto o pedido entra (o desligamento ao mesmo tempo espera, e vice-versa)
  select * into eu from public.equipe where id = public.meu_id() for share;
  if eu.id is null or eu.status <> 'ativa' then raise exception 'Entre no sistema para solicitar.'; end if;
  if p_tipo = 'ajuda_custo' and eu.papel not in ('articulacao','apoio','agente') then
    raise exception 'Ajuda de custo é só para bolsistas e agentes de campo que fazem visitas.';
  end if;
  if p_tipo = 'bolsa' and eu.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm') then
    raise exception 'Seu perfil não recebe bolsa mensal pelo projeto.';
  end if;
  if not public.habilitado(eu) then raise exception 'Sua habilitação ainda não está completa: sem ela não há pagamento.'; end if;
  if v_mes > hoje - (extract(day from hoje)::int - 1) then raise exception 'Só dá para solicitar o mês atual ou meses anteriores.'; end if;
  -- 32: nada antes do mês em que a pessoa começou no projeto (início da bolsa, data do cadastro)
  if eu.data_inicio is not null and v_mes < eu.data_inicio - (extract(day from eu.data_inicio)::int - 1) then
    raise exception 'Você começou no projeto em %: só dá para solicitar a partir desse mês.', to_char(eu.data_inicio, 'MM/YYYY');
  end if;
  -- 46: um pedido de cada vez por pessoa (dois celulares ao mesmo tempo não criam dois pedidos com a mesma visita)
  perform public.trava_aviso('solicitar_pagamento_' || eu.id::text);
  -- 47: segura as visitas do pedido antes de conferir (mudar a data ou quem fez ao mesmo tempo espera, e vice-versa).
  --     Ordem das travas: pessoa, visitas, pedido.
  if p_tipo = 'ajuda_custo' and p_visitas is not null then
    perform 1 from public.visitas v where v.id = any (p_visitas) order by v.id for share;
  end if;
  if p_tipo = 'ajuda_custo' then
    -- 46: a ajuda de custo pode ter mais de um pedido no mês. O pedido devolvido é corrigido e reenviado
    --     (o mesmo registro); se não há devolvido, entra um pedido novo (complementar, se o mês já tem pedido).
    select * into s from public.solicitacoes_pagamento
     where tipo = 'ajuda_custo' and equipe_id = eu.id and mes = v_mes and situacao = 'devolvida'
     order by aval_em desc nulls last, solicitada_em desc limit 1 for update;
    --     O pedido devolvido que volta continua com o rótulo que já tinha.
    complementar := case when s.id is not null then coalesce(s.detalhe ->> 'complementar', '') = 'true'
                         else exists (select 1 from public.solicitacoes_pagamento x
                                       where x.tipo = 'ajuda_custo' and x.equipe_id = eu.id and x.mes = v_mes and x.situacao not in ('devolvida', 'cancelada')) end;   -- 69: o cancelado não conta
  else
    select * into s from public.solicitacoes_pagamento where tipo = p_tipo and equipe_id = eu.id and mes = v_mes for update;
    -- 69: a bolsa devolvida ou cancelada do mês volta como pedido novo (o mesmo registro: é uma bolsa por mês)
    if s.id is not null and s.situacao not in ('devolvida', 'cancelada') then raise exception 'Você já solicitou este mês. Acompanhe a situação na lista.'; end if;
  end if;

  if p_tipo = 'ajuda_custo' then
    n := coalesce(array_length(p_visitas, 1), 0);
    if n = 0 then raise exception 'Marque as visitas feitas no mês.'; end if;
    -- 46: a mesma visita duas vezes na lista (mensagem clara no lugar do erro de registro repetido)
    if (select count(distinct x) from unnest(p_visitas) x) <> n then raise exception 'A mesma visita apareceu duas vezes no pedido. Marque cada visita uma vez só.'; end if;
    select count(*) into ruins from unnest(p_visitas) x(id)
      left join public.visitas v on v.id = x.id
     where v.id is null or v.executor_id <> eu.id or v.situacao <> 'realizada'
        or v.data_realizada - (extract(day from v.data_realizada)::int - 1) <> v_mes
        or exists (select 1 from public.solicitacao_visitas sv where sv.visita_id = x.id and sv.solicitacao_id is distinct from s.id);
    if ruins > 0 then raise exception 'Há visita que não é sua, não está feita, é de outro mês ou já foi solicitada.'; end if;
  else
    if length(trim(coalesce(p_relatorio, ''))) < 50 then raise exception 'Escreva o relatório de atividades do mês (pelo menos algumas linhas).'; end if;
  end if;
  -- 45: valor obrigatório, maior que zero (em centavos) e dentro do esperado (antes de chegar à coluna: sem erro cru de número grande)
  if p_valor is null or not (round(p_valor, 2) > 0) then raise exception 'Valor inválido: informe um valor maior que zero.'; end if;
  if p_tipo = 'bolsa' and p_valor > 10000 then
    raise exception 'Valor acima do esperado para a bolsa do mês (%; o máximo é R$ 10.000,00). Confira.', public.brl(p_valor);
  end if;
  if p_tipo = 'ajuda_custo' and p_valor > 2000 * n then
    raise exception 'Valor acima do esperado para a ajuda de custo de % visita(s) (%; o máximo é R$ 2.000,00 por visita). Confira.', n, public.brl(p_valor);
  end if;
  p_valor := round(p_valor, 2);
  v_detalhe := coalesce(p_detalhe, '{}'::jsonb);
  if p_tipo = 'ajuda_custo' and jsonb_typeof(v_detalhe) = 'object' then
    -- 46: o valor pedido não passa do total detalhado por visita (1 centavo de tolerância). Sem detalhe, vale só o teto por visita.
    begin
      if jsonb_typeof(v_detalhe -> 'total') = 'number' then v_total := (v_detalhe ->> 'total')::numeric;
      elsif jsonb_typeof(v_detalhe -> 'total') = 'string' then v_total := public.num_br(v_detalhe ->> 'total');
      elsif jsonb_typeof(v_detalhe -> 'visitas') = 'array' and jsonb_array_length(v_detalhe -> 'visitas') > 0
            and not exists (select 1 from jsonb_array_elements(v_detalhe -> 'visitas') i where jsonb_typeof(i -> 'total') is distinct from 'number') then
        select sum((i ->> 'total')::numeric) into v_total from jsonb_array_elements(v_detalhe -> 'visitas') i;
      end if;
    exception when others then v_total := null;
    end;
    if v_total is not null and p_valor > round(v_total, 2) + 0.01 then
      raise exception 'O valor pedido (%) passa do total das visitas detalhadas (%). Confira o pedido.', public.brl(p_valor), public.brl(round(v_total, 2));
    end if;
    -- 46: quem diz se o pedido é complementar é o banco (aparece nas listas)
    v_detalhe := (v_detalhe - 'complementar') || case when complementar then '{"complementar": true}'::jsonb else '{}'::jsonb end;
  end if;

  if s.id is null then
    insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio, detalhe)
      values (p_tipo, eu.id, v_mes, p_valor, nullif(trim(p_relatorio), ''), v_detalhe) returning id into v_id;
  else
    update public.solicitacoes_pagamento set situacao = 'solicitada', valor_solicitado = p_valor, valor_avalizado = null, relatorio = nullif(trim(p_relatorio), ''),
      detalhe = v_detalhe, solicitada_em = now(), aval_por = null, aval_em = null,
      cancelado_por = null, cancelado_em = null, motivo_cancelamento = null where id = s.id;
    v_id := s.id;
    delete from public.solicitacao_visitas where solicitacao_id = s.id;
  end if;
  if p_tipo = 'ajuda_custo' then
    begin
      insert into public.solicitacao_visitas (visita_id, solicitacao_id) select x, v_id from unnest(p_visitas) x;
    exception when unique_violation then   -- 46: a visita entrou em outro pedido neste instante
      raise exception 'Há visita que não é sua, não está feita, é de outro mês ou já foi solicitada.';
    end;
  end if;
  return v_id;
end 
$function$;

-- ---------- 2. desligamento com data no passado ----------
-- Roda antes do a1_desligar_pendencias (ordem alfabética dos gatilhos): a bolsa devolvida de mês depois da
-- saída já sai cancelada e não trava o desligamento como "pedido devolvido para corrigir".
create or replace function public.equipe_saida_pagamentos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_lista text; v_mes date; v_ref date;
begin
  if new.status = 'desligada' and new.data_fim is not null
     and (old.status is distinct from new.status or old.data_fim is distinct from new.data_fim) then
    v_ref := date_trunc('month', new.data_fim)::date;
    select string_agg(to_char(mes, 'MM/YYYY') || case situacao when 'lancada' then ' (já lançada no Arlo)' else ' (com aval)' end, ', ' order by mes), min(mes)
      into v_lista, v_mes
      from public.solicitacoes_pagamento where tipo = 'bolsa' and equipe_id = new.id and situacao in ('avalizada', 'lancada') and mes > v_ref;
    if v_lista is not null then
      raise exception 'A data de saída (%) fica antes de bolsa já aprovada: %. Use uma data de saída a partir de %. Se essa bolsa não era devida, a coordenação geral cancela o aval antes (Pagamentos > abrir o pedido); bolsa já lançada no Arlo não se cancela pelo sistema.',
        to_char(new.data_fim, 'DD/MM/YYYY'), v_lista, to_char(v_mes, 'DD/MM/YYYY');
    end if;
    update public.solicitacoes_pagamento
       set situacao = 'cancelada', cancelado_por = public.meu_id(), cancelado_em = now(),
           motivo_cancelamento = 'Cancelado pelo sistema: bolsa de mês depois da saída do projeto (' || to_char(new.data_fim, 'DD/MM/YYYY') || ').'
     where tipo = 'bolsa' and equipe_id = new.id and situacao in ('solicitada', 'devolvida') and mes > v_ref;
  end if;
  return new;
end $$;
revoke all on function public.equipe_saida_pagamentos() from public, anon, authenticated;
drop trigger if exists a0b_saida_pagamentos on public.equipe;
create trigger a0b_saida_pagamentos before update of status, data_fim on public.equipe
  for each row execute function public.equipe_saida_pagamentos();

-- a mensagem da bolsa de mês depois da saída passa a indicar o cancelamento (devolver não adianta: ela não entra mais)
create or replace function public.pagamentos_depois_da_saida() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.equipe;
begin
  if new.tipo = 'bolsa' and new.situacao in ('avalizada', 'lancada') and new.situacao is distinct from old.situacao then
    select * into p from public.equipe where id = new.equipe_id;
    if p.status = 'desligada' and p.data_fim is not null and new.mes > date_trunc('month', p.data_fim)::date then
      raise exception 'Bolsa de % não pode ser paga: % foi desligada em %. Cancele este pedido, com o motivo.',
        to_char(new.mes, 'MM/YYYY'), coalesce(p.nome, 'a pessoa'), to_char(p.data_fim, 'DD/MM/YYYY');
    end if;
  end if;
  return new;
end $$;

-- ---------- 3. passagem ou evento já autorizado ----------
-- o teto agora é conferido também quando o valor de um pedido autorizado muda (ajuste), não só ao autorizar
create or replace function public.pedidos_apoio_valor() returns trigger
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s' as $$
declare v numeric; teto numeric; usado numeric; pedag boolean;
begin
  if tg_op = 'INSERT' or new.dados is distinct from old.dados then
    begin v := nullif(new.dados->>'valor_estimado', '')::numeric; exception when others then v := null; end;
    if v is null or v <= 0 then raise exception 'Informe o valor estimado do pedido (R$).'; end if;
  end if;
  -- 46: passagem nova (ou quando a finalidade muda) precisa dizer para quê. Pedido antigo sem finalidade não trava.
  if new.tipo = 'passagem' and (tg_op = 'INSERT' or (new.dados->>'finalidade') is distinct from (old.dados->>'finalidade'))
     and coalesce(new.dados->>'finalidade', '') not in ('intercambio', 'pedagogico') then
    raise exception 'Escolha para que é a passagem: intercâmbio ou acompanhamento pedagógico.';
  end if;
  -- autorizar (ou ajustar o valor do autorizado, 69): confere o saldo, um pedido de cada vez
  if tg_op = 'UPDATE' and new.situacao = 'autorizado'
     and (old.situacao <> 'autorizado' or new.valor_autorizado is distinct from old.valor_autorizado) then
    pedag := new.tipo = 'passagem' and coalesce(new.dados->>'finalidade', '') = 'pedagogico';   -- 46: sem finalidade conta como intercâmbio
    perform pg_advisory_xact_lock(hashtext('teto_' || new.tipo || case when pedag then '_pedagogico' else '' end));
    begin new.valor_autorizado := coalesce(new.valor_autorizado, nullif(new.dados->>'valor_estimado', '')::numeric);
    exception when others then new.valor_autorizado := null; end;
    if new.valor_autorizado is null or new.valor_autorizado <= 0 then raise exception 'Informe o valor para autorizar.'; end if;
    if new.tipo = 'evento' then
      teto := 6000;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio where tipo = 'evento' and uf = new.uf and situacao = 'autorizado' and id <> new.id;
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de eventos de % (R$ 6.000,00): já autorizado %, saldo %.', new.uf, public.brl(usado), public.brl(teto - usado);
      end if;
    elsif pedag then
      teto := 22400;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio
       where tipo = 'passagem' and situacao = 'autorizado' and id <> new.id and dados->>'finalidade' = 'pedagogico';
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de passagens de acompanhamento pedagógico (R$ 22.400,00): já autorizado %, saldo %.', public.brl(usado), public.brl(teto - usado);
      end if;
    else
      teto := 70000;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio
       where tipo = 'passagem' and situacao = 'autorizado' and id <> new.id and dados->>'finalidade' is distinct from 'pedagogico';
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de passagens de intercâmbio (R$ 70.000,00): já autorizado %, saldo %.', public.brl(usado), public.brl(teto - usado);
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.cancelar_pedido_autorizado(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.pedidos_apoio; v_mot text := nullif(trim(p_motivo), '');
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral cancela um pedido já autorizado.'; end if;
  if length(coalesce(v_mot, '')) < 5 then raise exception 'Escreva o motivo do cancelamento.'; end if;
  if length(v_mot) > 1000 then raise exception 'Texto muito longo em motivo do cancelamento (máximo 1.000 caracteres).'; end if;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p.situacao <> 'autorizado' then raise exception 'Só pedido autorizado é cancelado por aqui. Antes disso, use Devolver ou Recusar.'; end if;
  update public.pedidos_apoio set situacao = 'cancelado', decidido_por = public.meu_id(), decidido_em = now(),
    obs = left(coalesce(nullif(trim(obs), '') || ' · ', '') || 'Cancelado depois de autorizado (' || to_char(now() at time zone 'America/Fortaleza', 'DD/MM/YYYY') || '): ' || v_mot, 4000)
   where id = p_id;
end $$;
revoke all on function public.cancelar_pedido_autorizado(uuid, text) from public, anon;
grant execute on function public.cancelar_pedido_autorizado(uuid, text) to authenticated;

create or replace function public.ajustar_valor_pedido(p_id uuid, p_valor numeric, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.pedidos_apoio; v_mot text := nullif(trim(p_motivo), '');
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral ajusta o valor de um pedido autorizado.'; end if;
  if p_valor is null or not (round(p_valor, 2) >= 0.01) then raise exception 'Informe um valor maior que zero (pelo menos R$ 0,01).'; end if;
  if not (p_valor <= 1000000) then raise exception 'Valor acima do esperado (%; o máximo é R$ 1.000.000,00). Confira.', public.brl(p_valor); end if;
  if length(coalesce(v_mot, '')) < 5 then raise exception 'Escreva o motivo do ajuste (por exemplo, o valor da nota fiscal).'; end if;
  if length(v_mot) > 1000 then raise exception 'Texto muito longo em motivo do ajuste (máximo 1.000 caracteres).'; end if;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p.situacao <> 'autorizado' then raise exception 'Só pedido autorizado tem o valor ajustado por aqui. Antes de autorizar, use o campo de valor da conferência.'; end if;
  if round(p_valor, 2) = p.valor_autorizado then raise exception 'O valor é o mesmo que já está autorizado.'; end if;
  -- o gatilho pedidos_apoio_valor confere o teto com o valor novo
  update public.pedidos_apoio set valor_autorizado = round(p_valor, 2),
    obs = left(coalesce(nullif(trim(obs), '') || ' · ', '') || 'Valor ajustado de ' || public.brl(p.valor_autorizado) || ' para ' || public.brl(round(p_valor, 2))
          || ' (' || to_char(now() at time zone 'America/Fortaleza', 'DD/MM/YYYY') || '): ' || v_mot, 4000)
   where id = p_id;
end $$;
revoke all on function public.ajustar_valor_pedido(uuid, numeric, text) from public, anon;
grant execute on function public.ajustar_valor_pedido(uuid, numeric, text) to authenticated;

select 'Etapa 69 instalada: cancelar pedido de pagamento, desligamento com bolsa aprovada e cancelar ou ajustar passagem e evento autorizados' as resultado;
