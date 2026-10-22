-- =====================================================================
-- Mulheres & Quintais — 71: CORREÇÕES DA AUDITORIA INDEPENDENTE DE 22/10/2026 (sobre o 69 e o 70)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 70. Pode rodar de novo.
--
-- 1. Questionário socioeconômico (70): na aprovação do cadastro enviado pelo link, as respostas iam para a pessoa
--    indicada na linha (equipe_id) sem conferir se era a mesma pessoa do cadastro. Quem confere o link conseguia, com
--    uma gravação direta, trocar as respostas de OUTRA pessoa da equipe (não lia nada, mas adulterava o dado).
--    Agora as respostas só passam se o CPF da pessoa na equipe for o CPF do cadastro enviado.
-- 2. Desligamento e aval ao mesmo tempo (69): a conferência "a data de saída não fica antes de bolsa já aprovada"
--    passa a travar as bolsas da pessoa antes de olhar, para um aval que chega no mesmo instante esperar a decisão.
-- Não muda nenhum registro.
-- =====================================================================

create or replace function public.pre_cadastros_socio_depois() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.situacao = 'aprovado' and old.situacao is distinct from 'aprovado' and new.equipe_id is not null then
    -- aprovado: as respostas passam para a pessoa (quem aprovou não precisa vê-las) e saem do cadastro enviado.
    -- 71: só para a MESMA pessoa (CPF do cadastro enviado = CPF da pessoa na equipe)
    insert into public.equipe_socio (equipe_id, socioeconomico, atualizado_em)
      select new.equipe_id, s.socioeconomico, now() from public.pre_cadastros_socio s
       where s.pre_id = new.id and exists (select 1 from public.equipe e where e.id = new.equipe_id and e.cpf = new.cpf)
      on conflict (equipe_id) do update set socioeconomico = excluded.socioeconomico, atualizado_em = now();
    delete from public.pre_cadastros_socio where pre_id = new.id;
  elsif new.situacao = 'recusado' and old.situacao is distinct from 'recusado' then
    delete from public.pre_cadastros_socio where pre_id = new.id;   -- recusado: as respostas não ficam guardadas
  end if;
  return new;
end $$;
revoke all on function public.pre_cadastros_socio_depois() from public, anon, authenticated;

create or replace function public.equipe_saida_pagamentos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_lista text; v_mes date; v_ref date;
begin
  if new.status = 'desligada' and new.data_fim is not null
     and (old.status is distinct from new.status or old.data_fim is distinct from new.data_fim) then
    v_ref := date_trunc('month', new.data_fim)::date;
    -- 71: trava as bolsas da pessoa de meses depois da saída (um aval no mesmo instante espera esta decisão)
    perform 1 from public.solicitacoes_pagamento where tipo = 'bolsa' and equipe_id = new.id and mes > v_ref order by id for update;
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

select 'Etapa 71 instalada: questionário só vai para a mesma pessoa do cadastro; desligamento trava as bolsas antes de conferir' as resultado;
