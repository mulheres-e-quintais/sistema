-- =====================================================================
-- Mulheres & Quintais — 46: REGRAS DECIDIDAS PELA COORDENAÇÃO GERAL E PENDÊNCIAS DA AUDITORIA (02/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 45. NÃO APAGA NENHUM DADO. As conferências novas valem só para os próximos registros
-- (ou quando o campo conferido muda): o registro antigo que não cumpre a regra nova continua podendo ser
-- aprovado, devolvido, cancelado e remarcado. Única alteração em dados que já existem: a matrícula do FIC
-- ainda "ativa" de quem JÁ foi desligada passa a "cancelada" (item 20), com o motivo escrito.
--
-- A. QUATRO REGRAS DECIDIDAS
--  1. ETAPAS DO CAMPO EXIGEM A ANTERIOR. Implantação (agendar ou marcar como feita): só com o plano do quintal
--     APROVADO pela coordenação técnica e com água na seca. Acompanhamento: só depois da implantação feita.
--     A avaliação final continua depois da implantação. A data de uma etapa não pode ser anterior à da etapa anterior.
--     Visita antiga fora da regra continua podendo ser cancelada e remarcada; a que já está "realizada" fica.
--  2. PEDIDO COMPLEMENTAR DE AJUDA DE CUSTO. A visita que ficou fora do pedido do mês pode ser pedida num pedido
--     complementar do mesmo mês. Cada visita entra em UM pedido só. A BOLSA continua UMA por mês por pessoa.
--  3. PASSAGENS: TETO POR FINALIDADE E QUEM CONFERE. Intercâmbio até R$ 70.000,00 (passagem antiga sem finalidade
--     conta aqui); acompanhamento pedagógico até R$ 22.400,00; cada um com o seu saldo. Em pedido novo de passagem a
--     finalidade é obrigatória. Intercâmbio: confere quem já conferia (a técnica; sem ela, o auxiliar; sem os dois,
--     a geral). Pedagógico: só a coordenação geral confere e autoriza. Eventos (R$ 6.000,00 por estado) não mudam.
--  4. BOLSA DA COORDENAÇÃO GERAL: R$ 5.000,00 × 14 meses. A correção é só na tela (js/dados.js): o banco não guarda
--     esse valor (a coordenação geral não solicita bolsa pelo sistema).
--
-- B. PENDÊNCIAS DA AUDITORIA
--  5. Professor do FIC só altera a turma em que ELE é o professor; só a coordenação geral passa a turma a outro.
--  6. Ajuda de custo: o valor pedido não passa do total detalhado por visita (tolerância de 1 centavo).
--  7. Km de visita que já está em pedido lançado no Arlo não muda mais; ninguém apaga o km de visita já paga.
--  8. Valores do custo da visita (parâmetros): só números, dentro do que faz sentido.
--  9. Histórico também para dados pessoais complementares (só QUAIS campos mudaram, sem os valores),
--     visitas de cada pedido de pagamento, entregas do mês e municípios do APL.
-- 10. Aprovar ficha ou plano que mudou enquanto era lido: recusado quando a tela manda a marca do que leu.
-- 11. Diagnóstico e avaliação: data a partir de 01/01/2026 e nunca antes da data da ficha; área, renda e GPS coerentes.
-- 12. Ficha com visita: o estado não muda. Quintal em andamento (com diagnóstico): a ficha não é devolvida
--     nem muda de resultado.
-- 13. Link de cadastro já usado não é reaberto.
-- 14. Ficha: CPF de pessoa ativa da equipe é recusado; testemunha não pode ser a própria mulher;
--     posição na lista de espera só para quem está na lista, sem repetir no estado.
-- 15. FIC: número de matrícula não se repete; matrícula não é anterior ao início da turma; turma duplicada é
--     recusada; os encontros de uma turma no mesmo dia somam no máximo 12 horas.
-- 16. Entrega do mês não é desmarcada depois que a bolsa daquele mês foi lançada no Arlo.
-- 17. Pedido de evento/passagem: valor entre R$ 0,01 e R$ 1.000.000,00; nascimento da passageira válido;
--     a mesma passageira (CPF) não entra duas vezes.
-- 18. Datas "de hoje" sempre no fuso de Fortaleza (seis funções ainda usavam o fuso da conexão).
-- 19. Envio em dobro ao mesmo tempo: canal de venda, encontro do FIC e situação da água.
-- 20. Cadastro desligado não é mais editado (só a coordenação geral corrige); "substitui" não aponta para a própria
--     pessoa nem para pessoa ativa de outro estado; a matrícula do FIC é cancelada no desligamento.
-- 21. Documento arquivado não muda título nem data; data do documento de 01/01/2025 até um ano à frente.
-- 22. Mensagens em português no lugar dos erros crus do banco (valor grande demais, data inválida, repetido).
-- 23. Mapa da vitrine: município com e sem acento conta como um só.
-- 24. Visita antiga com data de "feita" no futuro volta a poder ser corrigida, cancelada e remarcada
--     (a conferência de data futura vale só ao gravar ou mudar a data).
-- =====================================================================
begin;

-- nome sem acento, em minúsculas e sem espaços sobrando (compara "São José" com "Sao Jose") -----------------
create or replace function public.sem_acento(t text) returns text language sql immutable as $$
  select regexp_replace(trim(translate(lower(coalesce(t, '')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g')
$$;

-- =====================================================================
-- 1 e 24. ETAPAS DO CAMPO
-- =====================================================================
-- Devolve o motivo (em português) de a etapa ainda não poder acontecer neste quintal, ou vazio se pode.
-- p_data: a data em que a visita foi feita (vazio = só agendando). p_so_data: confere só a ordem das datas
-- (correção da data de uma visita que já estava feita). Usada só pelos gatilhos de visitas.
create or replace function public.visita_etapa_motivo(p_ficha uuid, p_etapa text, p_visita uuid, p_data date, p_so_data boolean) returns text
language plpgsql stable security definer set search_path = public as $$
declare d_ant date;
begin
  if p_etapa = 'implantacao' then
    if not coalesce(p_so_data, false) then
      if exists (select 1 from public.diagnosticos d where d.ficha_id = p_ficha and d.sem_agua) then
        return 'Este quintal está sem água na seca: foi encaminhado a programa de cisternas e não recebe implantação.';
      end if;
      if not exists (select 1 from public.diagnosticos d where d.ficha_id = p_ficha and d.situacao = 'aprovado') then
        return 'O plano deste quintal ainda não foi aprovado pela coordenação técnica.';
      end if;
    end if;
    if p_data is not null then
      select max(v.data_realizada) into d_ant from public.visitas v
       where v.ficha_id = p_ficha and v.etapa = 'diagnostico' and v.situacao = 'realizada';
      if p_data < d_ant then
        return format('A implantação não pode ter data anterior à do diagnóstico (%s).', to_char(d_ant, 'DD/MM/YYYY'));
      end if;
    end if;
  elsif p_etapa = 'acompanhamento' then
    if not coalesce(p_so_data, false) and not exists (select 1 from public.visitas v where v.ficha_id = p_ficha and v.etapa = 'implantacao'
                    and v.situacao = 'realizada' and v.id is distinct from p_visita) then
      return 'O acompanhamento é feito depois da implantação do quintal.';
    end if;
    if p_data is not null then
      select max(v.data_realizada) into d_ant from public.visitas v
       where v.ficha_id = p_ficha and v.etapa = 'implantacao' and v.situacao = 'realizada';
      if p_data < d_ant then
        return format('O acompanhamento não pode ter data anterior à da implantação (%s).', to_char(d_ant, 'DD/MM/YYYY'));
      end if;
    end if;
  elsif p_etapa = 'avaliacao' and p_data is not null then
    select max(v.data_realizada) into d_ant from public.visitas v
     where v.ficha_id = p_ficha and v.etapa = 'implantacao' and v.situacao = 'realizada';
    if p_data < d_ant then
      return format('A avaliação não pode ter data anterior à da implantação (%s).', to_char(d_ant, 'DD/MM/YYYY'));
    end if;
  end if;
  return null;
end $$;
revoke all on function public.visita_etapa_motivo(uuid, text, uuid, date, boolean) from public, anon, authenticated;

-- (igual ao do 45; muda só o que está marcado com "46")
create or replace function public.visitas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare f public.fichas; ex public.equipe; papel text := public.meu_papel(); n int; motivo text;
        hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  new.atualizado_em := now();
  -- 45: datas (só ao agendar ou quando a data muda: visita antiga não trava)
  if (new.data_prevista < date '2026-01-01' or new.data_prevista > date '2027-12-31')
     and ((tg_op = 'UPDATE' and new.data_prevista is distinct from old.data_prevista)
          or (tg_op = 'INSERT' and not exists (select 1 from public.visitas x where x.id = new.id and x.data_prevista = new.data_prevista))) then
    raise exception 'A data prevista da visita precisa ficar entre 01/01/2026 e 31/12/2027.';
  end if;
  -- 46: a data de "feita" no futuro só é conferida ao gravar ou quando ela muda
  --     (visita antiga com data errada continua podendo ser corrigida, cancelada e remarcada)
  if new.data_realizada > hoje and (tg_op = 'INSERT' or new.data_realizada is distinct from old.data_realizada) then
    raise exception 'A data em que a visita foi feita não pode ser no futuro.';
  end if;
  if tg_op = 'UPDATE' then
    if new.ficha_id <> old.ficha_id or new.uf <> old.uf or new.etapa <> old.etapa or new.criado_em <> old.criado_em then
      raise exception 'Quintal e etapa da visita não mudam. Cancele e agende outra.';
    end if;
    if old.situacao = 'cancelada' and new.situacao <> 'cancelada' then raise exception 'Visita cancelada não volta. Agende outra.'; end if;
    if papel = 'agente' and (new.executor_id <> old.executor_id or new.data_prevista <> old.data_prevista or new.situacao = 'cancelada') then
      raise exception 'O agente de campo não reagenda nem cancela visitas. Fale com a bolsista do estado.';
    end if;
    -- 45: visita com o formulário registrado não se cancela (vale para todos)
    if new.situacao = 'cancelada' and old.situacao <> 'cancelada' then
      if new.etapa = 'diagnostico' and exists (select 1 from public.diagnosticos d where d.visita_id = new.id) then
        raise exception 'Esta visita já tem diagnóstico registrado; não pode ser cancelada.';
      end if;
      if new.etapa = 'avaliacao' and exists (select 1 from public.avaliacoes a where a.visita_id = new.id) then
        raise exception 'Esta visita já tem avaliação registrada; não pode ser cancelada.';
      end if;
    end if;
    -- 45: visita já feita não muda mais; só a coordenação corrige (fica no histórico)
    if old.situacao = 'realizada' and auth.uid() is not null and coalesce(papel, '') not in ('coord_geral','coord_tecnico') then
      if new.executor_id is distinct from old.executor_id or new.situacao is distinct from old.situacao
         or new.data_prevista is distinct from old.data_prevista
         or (new.data_realizada is distinct from old.data_realizada
             -- a data da visita de diagnóstico/avaliação acompanha a data do formulário (quem fez a visita corrige o formulário)
             and not ((new.etapa = 'diagnostico' and exists (select 1 from public.diagnosticos d where d.visita_id = new.id and d.data_visita = new.data_realizada))
                   or (new.etapa = 'avaliacao' and exists (select 1 from public.avaliacoes a where a.visita_id = new.id and a.data_visita = new.data_realizada)))) then
        raise exception 'Esta visita já foi feita: quem fez, as datas e a situação não mudam mais. Se houver erro, peça à coordenação para corrigir.';
      end if;
      if new.relato is distinct from old.relato and length(trim(coalesce(old.relato, ''))) > 0
         and (length(trim(coalesce(new.relato, ''))) = 0
              or (new.etapa in ('implantacao','acompanhamento') and length(trim(coalesce(new.relato, ''))) < 20)) then
        raise exception 'O relato de uma visita já feita não pode ficar vazio (pelo menos 20 letras). Se houver erro, peça à coordenação para corrigir.';
      end if;
    end if;
    if new.executor_id = old.executor_id and new.situacao = old.situacao then return new; end if;
    -- cancelar sempre pode (libera o dia de campo), mesmo se a ficha foi devolvida depois
    if new.situacao = 'cancelada' then return new; end if;
  end if;
  select * into f from public.fichas where id = new.ficha_id;
  if f.id is null then raise exception 'Ficha não encontrada.'; end if;
  new.uf := f.uf;
  if not (f.resultado = 'selecionada' and f.situacao = 'aprovada') then
    raise exception 'Só há visita para mulher selecionada e aprovada pela coordenação técnica.';
  end if;
  select * into ex from public.equipe where id = new.executor_id;
  if ex.id is null or ex.status <> 'ativa' or ex.papel not in ('articulacao','apoio','agente') then
    raise exception 'Quem faz a visita precisa ser bolsista ou agente de campo ativa.';
  end if;
  if ex.uf <> f.uf then raise exception 'Quem faz a visita precisa ser do mesmo estado do quintal.'; end if;
  if not public.habilitado(ex) and new.situacao <> 'cancelada' then
    raise exception '% ainda não está habilitada (FIC, Arlo e termo): a visita não poderia ser paga.', ex.nome;
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.visitas where id = new.id) then
    new.criado_por := public.meu_id(); new.criado_em := now();
    if new.etapa = 'acompanhamento' then
      select count(*) into n from public.visitas where ficha_id = new.ficha_id and etapa = 'acompanhamento' and situacao <> 'cancelada';
      if n >= 2 then raise exception 'Este quintal já tem as 2 visitas de acompanhamento.'; end if;
    end if;
    -- 46: mensagem clara no lugar do erro de registro repetido (diagnóstico, implantação e avaliação: uma por quintal)
    if new.situacao <> 'cancelada' and new.etapa in ('diagnostico','implantacao','avaliacao')
       and exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = new.etapa and situacao <> 'cancelada') then
      raise exception 'Este quintal já tem essa visita agendada ou feita (%). Para trocar a data ou quem faz, altere a visita que já existe.',
        case new.etapa when 'diagnostico' then 'diagnóstico' when 'implantacao' then 'implantação' else 'avaliação final' end;
    end if;
    if new.etapa <> 'diagnostico' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'diagnostico' and situacao = 'realizada') then
      raise exception 'Primeiro o diagnóstico: implantação, acompanhamento e avaliação só depois dele.';
    end if;
    if new.etapa = 'avaliacao' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'implantacao' and situacao = 'realizada') then
      raise exception 'A avaliação é feita depois da implantação do quintal.';
    end if;
    -- 46: cada etapa exige a anterior (só ao agendar visita NOVA: a que já existe não trava aqui)
    if new.situacao <> 'cancelada' then
      motivo := public.visita_etapa_motivo(new.ficha_id, new.etapa, new.id, case when new.situacao = 'realizada' then new.data_realizada end, false);
      if motivo is not null then raise exception '%', motivo; end if;
    end if;
    select count(*) into n from public.visitas where uf = new.uf and situacao <> 'cancelada';
    if n >= 200 then raise exception 'O estado % já usou os 200 dias de campo previstos (40 quintais × 5 visitas).', new.uf; end if;
  end if;
  return new;
end $$;

-- (igual ao do 42; muda só o que está marcado com "46". Passa a rodar com o direito do banco, para a agente de campo,
--  que só enxerga as próprias visitas, ser conferida contra o plano e a implantação feitos por outra pessoa)
create or replace function public.visitas_feita() returns trigger
language plpgsql security definer set search_path = public as $$
declare motivo text;
begin
  if new.situacao = 'realizada' and old.situacao is distinct from 'realizada' then
    if new.data_realizada is null or new.data_realizada > (now() at time zone 'America/Fortaleza')::date then
      raise exception 'Informe a data em que a visita foi feita (não pode ser no futuro).';
    end if;
    if new.etapa in ('implantacao','acompanhamento') and length(trim(coalesce(new.relato, ''))) < 20 then
      raise exception 'Conte em poucas linhas o que foi feito na visita (pelo menos 20 letras).';
    end if;
    if new.etapa = 'diagnostico' and not exists (select 1 from public.diagnosticos d where d.visita_id = new.id) then
      raise exception 'A visita de diagnóstico é marcada como feita pelo próprio formulário do diagnóstico.';
    end if;
    if new.etapa = 'avaliacao' and to_regclass('public.avaliacoes') is not null
       and not exists (select 1 from public.avaliacoes a where a.visita_id = new.id) then
      raise exception 'A visita de avaliação é marcada como feita pelo próprio formulário da avaliação.';
    end if;
    -- 46: cada etapa exige a anterior, e a data não pode ser anterior à da etapa anterior
    --     (só na passagem para "realizada": a visita que já está feita fica como está)
    motivo := public.visita_etapa_motivo(new.ficha_id, new.etapa, new.id, new.data_realizada, false);
    if motivo is not null then raise exception '%', motivo; end if;
  elsif new.situacao = 'realizada' and new.data_realizada is distinct from old.data_realizada then
    -- 46: correção da data de uma visita já feita: confere só a ordem das datas
    motivo := public.visita_etapa_motivo(new.ficha_id, new.etapa, new.id, new.data_realizada, true);
    if motivo is not null then raise exception '%', motivo; end if;
  end if;
  return new;
end $$;

-- =====================================================================
-- 2, 6, 18 e 22. PAGAMENTOS: pedido complementar de ajuda de custo
-- =====================================================================
-- A trava antiga era "unique (tipo, equipe_id, mes)". Agora vale só para a bolsa. Nenhum registro muda:
-- a regra nova é mais larga que a antiga (tudo o que cabia na antiga cabe na nova).
alter table public.solicitacoes_pagamento drop constraint if exists uma_por_mes;
create unique index if not exists uma_por_mes on public.solicitacoes_pagamento (equipe_id, mes) where tipo = 'bolsa';
create index if not exists solicitacoes_pessoa_mes on public.solicitacoes_pagamento (equipe_id, mes, tipo);

-- (igual ao do 45; muda só o que está marcado com "46")
create or replace function public.solicitar_pagamento(p_tipo text, p_mes date, p_valor numeric, p_relatorio text, p_visitas uuid[], p_detalhe jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.equipe; v_mes date; s public.solicitacoes_pagamento; v_id uuid; n int; ruins int;
        hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: o "hoje" é o de Fortaleza, não o da conexão
        complementar boolean := false; v_detalhe jsonb; v_total numeric;
begin
  -- 46: tipo e mês conferidos antes de tudo (mensagem clara no lugar do erro do banco)
  if p_tipo is null or p_tipo not in ('ajuda_custo', 'bolsa') then raise exception 'Tipo de pagamento inválido: escolha ajuda de custo ou bolsa.'; end if;
  if p_mes is null then raise exception 'Informe o mês do pedido.'; end if;
  v_mes := p_mes - (extract(day from p_mes)::int - 1);
  select * into eu from public.equipe where id = public.meu_id();
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
  perform pg_advisory_xact_lock(hashtext('solicitar_pagamento_' || eu.id::text));
  if p_tipo = 'ajuda_custo' then
    -- 46: a ajuda de custo pode ter mais de um pedido no mês. O pedido devolvido é corrigido e reenviado
    --     (o mesmo registro); se não há devolvido, entra um pedido novo (complementar, se o mês já tem pedido).
    select * into s from public.solicitacoes_pagamento
     where tipo = 'ajuda_custo' and equipe_id = eu.id and mes = v_mes and situacao = 'devolvida'
     order by aval_em desc nulls last, solicitada_em desc limit 1 for update;
    --     O pedido devolvido que volta continua com o rótulo que já tinha.
    complementar := case when s.id is not null then coalesce(s.detalhe ->> 'complementar', '') = 'true'
                         else exists (select 1 from public.solicitacoes_pagamento x
                                       where x.tipo = 'ajuda_custo' and x.equipe_id = eu.id and x.mes = v_mes and x.situacao <> 'devolvida') end;
  else
    select * into s from public.solicitacoes_pagamento where tipo = p_tipo and equipe_id = eu.id and mes = v_mes for update;
    if s.id is not null and s.situacao <> 'devolvida' then raise exception 'Você já solicitou este mês. Acompanhe a situação na lista.'; end if;
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
      detalhe = v_detalhe, solicitada_em = now(), aval_por = null, aval_em = null where id = s.id;
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
end $$;

-- =====================================================================
-- 3, 17, 18 e 22. PASSAGENS E EVENTOS
-- =====================================================================
create or replace function public.saldo_passagens_eventos() returns jsonb
language sql stable security definer set search_path = public as $$
  -- passagem_teto / passagem_usado / passagem_saldo = INTERCÂMBIO (mesmos nomes de antes: o celular em versão antiga continua lendo)
  select jsonb_build_object(
    'passagem_teto', 70000, 'passagem_usado', x.inter, 'passagem_saldo', greatest(70000 - x.inter, 0),
    'passagem_pedagogico_teto', 22400, 'passagem_pedagogico_usado', x.pedag, 'passagem_pedagogico_saldo', greatest(22400 - x.pedag, 0),
    'evento_teto', 6000,
    'evento_usado', coalesce((select jsonb_object_agg(uf, s) from (select uf, sum(valor_autorizado) s from public.pedidos_apoio
                              where tipo = 'evento' and situacao = 'autorizado' group by uf) y), '{}'::jsonb))
    from (select coalesce(sum(valor_autorizado) filter (where dados->>'finalidade' is distinct from 'pedagogico'), 0) as inter,
                 coalesce(sum(valor_autorizado) filter (where dados->>'finalidade' = 'pedagogico'), 0) as pedag
            from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado') x
   where auth.uid() is null or public.meu_id() is not null
$$;

do $$ begin
  if to_regclass('public.pedidos_apoio') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_apoio' and column_name = 'valor_autorizado') then
    execute $f$
create or replace function public.pedidos_apoio_valor() returns trigger
language plpgsql security definer set search_path = public as $b$
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
  -- autorizar: confere o saldo (um pedido de cada vez, para dois ao mesmo tempo não passarem do teto)
  if tg_op = 'UPDATE' and new.situacao = 'autorizado' and old.situacao <> 'autorizado' then
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
end $b$;
    $f$;
  end if;
end $$;

-- (iguais aos do 45, 35 e 22; muda só o que está marcado com "46")
do $$ begin
  if to_regclass('public.pedidos_apoio') is not null then
    execute $f$
create or replace function public.mover_pedido_apoio(p_id uuid, p_acao text, p_obs text, p_protocolo text) returns void
language plpgsql security definer set search_path = public as $b$
declare p public.pedidos_apoio; papel text := coalesce(public.meu_papel(), ''); eu uuid := public.meu_id(); v_obs text := nullif(trim(p_obs), '');
        conferente text := public.quem_confere_pedidos(); nome_conf text; pedag boolean;
begin
  if eu is null or conferente is null then raise exception 'Entre no sistema com um cadastro ativo para mexer em pedidos.'; end if;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  -- 46: passagem de acompanhamento pedagógico: só a coordenação geral confere (e autoriza)
  pedag := p.tipo = 'passagem' and coalesce(p.dados->>'finalidade', '') = 'pedagogico';
  if pedag then conferente := 'coord_geral'; end if;
  nome_conf := case conferente when 'coord_tecnico' then 'a coordenação técnica' when 'auxiliar_adm' then 'o auxiliar administrativo' else 'a coordenação geral' end;
  if pedag and p_acao in ('conferir', 'devolver') and papel <> 'coord_geral' then
    raise exception 'Pedido de acompanhamento pedagógico: só a coordenação geral confere.';
  end if;
  if p_acao = 'conferir' then
    if papel <> conferente then raise exception 'Quem confere agora é %.', nome_conf; end if;
    if p.solicitante_id = eu then raise exception 'Ninguém confere o próprio pedido.'; end if;
    if p.situacao <> 'enviado' then raise exception 'Este pedido não está esperando conferência.'; end if;
    update public.pedidos_apoio set situacao = 'conferido', conferido_por = eu, conferido_em = now(), obs = null where id = p_id;
  elsif p_acao = 'devolver' then
    if not ((papel = conferente and p.situacao = 'enviado') or (papel = 'coord_geral' and p.situacao = 'conferido')) then
      raise exception 'Este pedido não pode ser devolvido agora.';
    end if;
    if length(coalesce(v_obs, '')) < 5 then raise exception 'Para devolver, escreva o que precisa ser corrigido.'; end if;
    update public.pedidos_apoio set situacao = 'devolvido', obs = v_obs, decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'autorizar' then
    if papel <> 'coord_geral' then raise exception 'Quem autoriza e manda para a FUNCERN é a coordenação geral.'; end if;
    if p.situacao <> 'conferido' then raise exception 'Só pedido conferido pode ser autorizado.'; end if;
    if p.conferido_por = eu and conferente <> 'coord_geral' then
      raise exception 'Quem conferiu não autoriza o mesmo pedido. Devolva para %.', nome_conf;
    end if;
    update public.pedidos_apoio set situacao = 'autorizado', decidido_por = eu, decidido_em = now(), obs = v_obs,
      funcern_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
  elsif p_acao = 'recusar' then
    if papel <> 'coord_geral' then raise exception 'Quem recusa é a coordenação geral.'; end if;
    if p.situacao not in ('enviado', 'conferido') then raise exception 'Este pedido não pode ser recusado agora.'; end if;
    if length(coalesce(v_obs, '')) < 5 then raise exception 'Escreva o motivo da recusa.'; end if;
    update public.pedidos_apoio set situacao = 'recusado', obs = v_obs, decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'cancelar' then
    if p.solicitante_id is distinct from eu then raise exception 'Só quem pediu pode cancelar.'; end if;
    if p.situacao not in ('enviado', 'devolvido') then raise exception 'Depois de conferido, peça à coordenação para cancelar.'; end if;
    update public.pedidos_apoio set situacao = 'cancelado', obs = coalesce(v_obs, 'Cancelado por quem pediu.'), decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'protocolo' then
    if papel <> 'coord_geral' then raise exception 'Só a coordenação geral registra o protocolo da FUNCERN.'; end if;
    if p.situacao <> 'autorizado' then raise exception 'Só pedido autorizado tem protocolo.'; end if;
    update public.pedidos_apoio set funcern_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
  else
    raise exception 'Ação inválida.';
  end if;
end $b$;

create or replace function public.salvar_pedido_apoio(p_id uuid, p_tipo text, p_titulo text, p_data date, p_dados jsonb, p_justificativa text)
returns uuid language plpgsql security definer set search_path = public as $b$
declare eu public.equipe; p public.pedidos_apoio; v_id uuid; antecedencia int := case p_tipo when 'passagem' then 40 when 'evento' then 45 end;
        v_pass jsonb; n int; pes jsonb; v_val numeric; v_nasc date; v_volta date; v_cpf text; v_cpfs text[] := '{}';
        hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: o "hoje" é o de Fortaleza, não o da conexão
begin
  select * into eu from public.equipe where id = public.meu_id() and status = 'ativa';
  if eu.id is null or eu.papel <> 'articulacao' then
    raise exception 'Quem pede passagem e estrutura de evento é a bolsista de articulação estadual.';
  end if;
  if antecedencia is null then raise exception 'Tipo de pedido inválido.'; end if;
  if p_data is null or p_data < hoje then raise exception 'Informe uma data que ainda não passou.'; end if;
  if p_data > date '2027-09-30' then raise exception 'A data passa do fim do projeto (setembro de 2027).'; end if;
  if p_data < hoje + antecedencia and length(trim(coalesce(p_justificativa, ''))) < 15 then
    raise exception 'Pedido fora do prazo (% dias antes). Escreva a justificativa.', antecedencia;
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 5 then raise exception 'Escreva o objetivo e a atividade do projeto.'; end if;
  if length(trim(p_titulo)) > 200 then raise exception 'O objetivo do pedido passou de 200 letras. Resuma.'; end if;
  -- 46: valor estimado de R$ 0,01 a R$ 1.000.000,00, conferido já no envio (sem erro cru de número grande mais adiante)
  begin v_val := nullif(trim(p_dados->>'valor_estimado'), '')::numeric; exception when others then v_val := null; end;
  if v_val is null or v_val <= 0 then raise exception 'Informe o valor estimado do pedido (R$).'; end if;
  if not (round(v_val, 2) >= 0.01 and v_val <= 1000000) then
    raise exception 'O valor estimado precisa ficar entre R$ 0,01 e R$ 1.000.000,00 (veio %). Confira.', public.brl(v_val);
  end if;
  if p_tipo = 'passagem' then
    v_pass := p_dados->'passageiros';
    n := coalesce(jsonb_array_length(case when jsonb_typeof(v_pass) = 'array' then v_pass end), 0);
    if n < 1 then raise exception 'Informe pelo menos uma passageira ou passageiro.'; end if;
    if exists (select 1 from jsonb_array_elements(v_pass) x
               where regexp_replace(coalesce(x->>'cpf', ''), '\D', '', 'g') !~ '^[0-9]{11}$'
                  or length(trim(coalesce(x->>'nome', ''))) < 5 or coalesce(x->>'nascimento', '') = ''
                  or coalesce(x->>'rg', '') = '') then
      raise exception 'Falta nome, CPF, RG ou nascimento de alguma passageira.';
    end if;
    -- 46: nascimento de verdade (data que existe, não futura) e ninguém duas vezes na lista
    for pes in select * from jsonb_array_elements(v_pass) loop
      begin v_nasc := (pes->>'nascimento')::date;
      exception when others then
        raise exception 'A data de nascimento de % não é uma data que existe. Confira dia, mês e ano.', left(trim(pes->>'nome'), 60);
      end;
      if v_nasc > hoje then raise exception 'A data de nascimento de % está no futuro. Confira.', left(trim(pes->>'nome'), 60); end if;
      if v_nasc < date '1901-01-01' then raise exception 'Confira a data de nascimento de %: o ano está antigo demais.', left(trim(pes->>'nome'), 60); end if;
      v_cpf := regexp_replace(pes->>'cpf', '\D', '', 'g');
      if v_cpf = any (v_cpfs) then raise exception 'A mesma pessoa (CPF) aparece duas vezes na lista de passageiras. Deixe cada pessoa uma vez só.'; end if;
      v_cpfs := v_cpfs || v_cpf;
    end loop;
    begin v_volta := nullif(trim(p_dados->>'volta'), '')::date;
    exception when others then raise exception 'A data da volta não é uma data que existe. Confira dia, mês e ano.';
    end;
    if v_volta < p_data then raise exception 'A volta é antes da ida.'; end if;
  end if;

  if p_id is null then
    insert into public.pedidos_apoio (tipo, uf, solicitante_id, titulo, data_ref, dados, justificativa_prazo)
      values (p_tipo, eu.uf, eu.id, trim(p_titulo), p_data, coalesce(p_dados, '{}'), nullif(trim(p_justificativa), ''))
      returning id into v_id;
    return v_id;
  end if;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null or p.solicitante_id <> eu.id then raise exception 'Pedido não encontrado.'; end if;
  if p.situacao <> 'devolvido' then raise exception 'Só dá para corrigir pedido devolvido.'; end if;
  if p.tipo <> p_tipo then raise exception 'Não dá para mudar o tipo do pedido.'; end if;
  update public.pedidos_apoio set titulo = trim(p_titulo), data_ref = p_data, dados = coalesce(p_dados, '{}'),
    justificativa_prazo = nullif(trim(p_justificativa), ''), situacao = 'enviado', enviado_em = now(),
    conferido_por = null, conferido_em = null, decidido_por = null, decidido_em = null where id = p_id;
  return p_id;
end $b$;
    $f$;
  end if;
end $$;

do $$ begin
  if to_regclass('public.pedidos_apoio') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_apoio' and column_name = 'valor_autorizado') then
    execute $f$
create or replace function public.definir_valor_pedido(p_id uuid, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $b$
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral define o valor autorizado.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  -- 46: de R$ 0,01 a R$ 1.000.000,00 (mensagem clara no lugar do erro do banco)
  if not (round(p_valor, 2) >= 0.01) then raise exception 'Informe um valor maior que zero (pelo menos R$ 0,01).'; end if;
  if not (p_valor <= 1000000) then raise exception 'Valor acima do esperado (%; o máximo é R$ 1.000.000,00). Confira.', public.brl(p_valor); end if;
  update public.pedidos_apoio set valor_autorizado = round(p_valor, 2) where id = p_id and situacao = 'conferido';
  if not found then raise exception 'Só dá para definir o valor de pedido conferido, antes de autorizar.'; end if;
end $b$;
    $f$;
  end if;
end $$;

-- =====================================================================
-- 5, 15 e 19. CURSO FIC
-- =====================================================================
-- 5. o professor altera (e cria) só a turma em que ELE é o professor. A coordenação geral continua com tudo
--    (regra "geral_tudo" do 15) e é a única que passa a turma para outro professor (41: desligamento).
drop policy if exists turmas_incluir on public.turmas_fic;
drop policy if exists turmas_alterar on public.turmas_fic;
create policy turmas_incluir on public.turmas_fic for insert to authenticated
  with check (public.meu_papel() = 'coord_geral' or (public.meu_papel() = 'professor_fic' and professor_id = public.meu_id()));
create policy turmas_alterar on public.turmas_fic for update to authenticated
  using (public.meu_papel() = 'coord_geral' or (public.meu_papel() = 'professor_fic' and professor_id = public.meu_id()))
  with check (public.meu_papel() = 'coord_geral' or (public.meu_papel() = 'professor_fic' and professor_id = public.meu_id()));

-- (igual ao do 11; muda só o que está marcado com "46")
create or replace function public.turmas_fic_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare logado boolean := auth.uid() is not null; v_papel text := coalesce(public.meu_papel(), ''); novo boolean := tg_op = 'INSERT';
begin
  -- 46: turma de outro professor (a tela tenta incluir quando não consegue alterar)
  if novo and logado and exists (select 1 from public.turmas_fic x where x.id = new.id) then
    raise exception 'Esta turma é de outro(a) professor(a): só ele(a) ou a coordenação geral altera.';
  end if;
  if not exists (select 1 from public.equipe where id = new.professor_id and papel = 'professor_fic' and status = 'ativa') then
    raise exception 'A turma precisa de um(a) professor(a) do FIC ativo(a).';
  end if;
  -- 46: só a coordenação geral escolhe ou troca o professor de uma turma
  if logado and v_papel <> 'coord_geral' then
    if novo and new.professor_id is distinct from public.meu_id() then
      raise exception 'Você cria turmas só no seu nome. Turma de outro(a) professor(a) é criada por ele(a) ou pela coordenação geral.';
    end if;
    if not novo and new.professor_id is distinct from old.professor_id then
      raise exception 'Só a coordenação geral passa a turma para outro(a) professor(a).';
    end if;
  end if;
  if new.fim is not null and new.inicio is not null and new.fim < new.inicio then
    raise exception 'O fim da turma não pode ser antes do início.';
  end if;
  -- 46: início e fim dentro do período do projeto (só ao criar ou quando a data muda; a tela já pedia isto)
  if new.inicio is not null and (novo or new.inicio is distinct from old.inicio) and not (new.inicio between date '2026-01-01' and date '2027-12-31') then
    raise exception 'O início da turma fica entre 01/01/2026 e 31/12/2027.';
  end if;
  if new.fim is not null and (novo or new.fim is distinct from old.fim) and not (new.fim between date '2026-01-01' and date '2027-12-31') then
    raise exception 'O fim da turma fica entre 01/01/2026 e 31/12/2027.';
  end if;
  -- 46: turma repetida (mesmo nome, estado, professor e início), só ao criar ou quando um desses muda
  if (novo or public.sem_acento(new.nome) is distinct from public.sem_acento(old.nome) or new.uf is distinct from old.uf
      or new.professor_id is distinct from old.professor_id or new.inicio is distinct from old.inicio)
     and exists (select 1 from public.turmas_fic x where x.id <> new.id and public.sem_acento(x.nome) = public.sem_acento(new.nome)
                   and x.uf is not distinct from new.uf and x.professor_id = new.professor_id and x.inicio is not distinct from new.inicio) then
    raise exception 'Já existe uma turma com este nome, estado, professor(a) e data de início. Use a que já existe ou mude o nome.';
  end if;
  if novo then new.criado_por := public.meu_id(); new.criado_em := now();
  else new.criado_por := old.criado_por; new.criado_em := old.criado_em; end if;
  new.atualizado_em := now();
  return new;
end $$;

-- (igual ao do 23; muda só o que está marcado com "46")
create or replace function public.matricular_fic(p_turma uuid, p_equipe uuid, p_numero text, p_data date) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.turmas_fic; p public.equipe; atual public.matriculas_fic; v_id uuid; v_dono text;
        hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: o "hoje" é o de Fortaleza, não o da conexão
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
  if p_data is null or p_data > hoje then raise exception 'Data da matrícula vazia ou no futuro.'; end if;
  select * into atual from public.matriculas_fic where equipe_id = p_equipe and cancelada_em is null;
  if atual.id is not null and atual.turma_id <> p_turma then
    raise exception '% já está matriculada em outra turma. Cancele lá antes de trocar.', p.nome;
  end if;
  -- 46: o número de matrícula é de uma pessoa só (conferido ao matricular ou quando o número muda)
  if atual.id is null or lower(trim(atual.numero)) is distinct from lower(trim(p_numero)) then
    perform pg_advisory_xact_lock(hashtext('matricula_fic_' || lower(trim(p_numero))));
    select coalesce(q.nome_social, q.nome) into v_dono from public.matriculas_fic m join public.equipe q on q.id = m.equipe_id
     where m.cancelada_em is null and m.equipe_id <> p_equipe and lower(trim(m.numero)) = lower(trim(p_numero)) limit 1;
    if v_dono is not null then
      raise exception 'O número de matrícula % já é de %. Cada pessoa tem o seu número: confira no SUAP.', trim(p_numero), v_dono;
    end if;
  end if;
  -- 46: ninguém é matriculado antes de a turma começar (conferido ao matricular ou quando a data muda)
  if t.inicio is not null and p_data < t.inicio and (atual.id is null or atual.matriculado_em is distinct from p_data) then
    raise exception 'A turma começa em %: a data da matrícula não pode ser antes disso.', to_char(t.inicio, 'DD/MM/YYYY');
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

-- (igual ao do 38; muda só o que está marcado com "46")
create or replace function public.registrar_encontro_fic(p_id uuid, p_turma uuid, p_data date, p_carga numeric, p_modalidade text, p_conteudo text, p_presentes uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.fic_encontros; t public.turmas_fic; v_id uuid; m record; eu uuid := public.meu_id(); v_papel text := coalesce(public.meu_papel(), '');
        v_pres uuid[] := coalesce(p_presentes, '{}'); v_soma numeric;
begin
  if v_papel not in ('professor_fic', 'coord_geral') then raise exception 'Quem registra os encontros do curso é o professor do FIC.'; end if;
  select * into t from public.turmas_fic where id = p_turma;
  if t.id is null then raise exception 'Turma não encontrada.'; end if;
  if t.professor_id is null then raise exception 'Esta turma não tem professor(a): ajuste a turma antes.'; end if;
  if v_papel = 'professor_fic' and t.professor_id <> eu then raise exception 'Esta turma é de outro(a) professor(a): só dá para registrar encontros das suas turmas.'; end if;
  if p_id is not null and exists (select 1 from public.fic_encontros x where x.id = p_id and x.turma_id <> p_turma) then
    raise exception 'A turma de um encontro não muda. Cancele este e registre de novo na turma certa.';
  end if;
  if p_data is null or p_data > public.fic_hoje() then raise exception 'A data do encontro não pode ser no futuro.'; end if;
  if p_data < date '2026-09-01' then raise exception 'Data antes do início do projeto.'; end if;
  if p_carga is null or round(p_carga, 1) <= 0 or p_carga > 12 then raise exception 'Informe a carga horária do encontro (até 12 horas).'; end if;
  if coalesce(p_modalidade, '') not in ('presencial', 'online', 'ava') then raise exception 'Modalidade inválida.'; end if;
  if length(trim(coalesce(p_conteudo, ''))) < 10 then raise exception 'Escreva o que foi trabalhado no encontro (pelo menos 10 letras).'; end if;
  if length(trim(p_conteudo)) > 2000 then raise exception 'O texto do que foi trabalhado passou de 2.000 letras.'; end if;
  if exists (select 1 from unnest(v_pres) x where x not in (select public.fic_matriculados_em(p_turma, p_data))) then
    raise exception 'Só entra na lista de presença quem estava matriculado nesta turma na data do encontro.';
  end if;
  -- 46: um registro de cada vez por turma e dia (dois envios ao mesmo tempo não gravam o mesmo encontro duas vezes)
  perform pg_advisory_xact_lock(hashtext('fic_encontro_' || p_turma::text || '_' || p_data::text));
  if p_id is null then
    -- o encontro é sempre do professor da turma (também quando a coordenação geral registra no lugar dele)
    if public.fic_mes_fechado(t.professor_id, p_data) then raise exception 'A bolsa deste mês do professor já foi pedida: não dá para incluir encontro neste mês (se a coordenação devolver o pedido, reabre).'; end if;
    if exists (select 1 from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.cancelado_em is null and lower(trim(x.conteudo)) = lower(trim(p_conteudo))) then
      raise exception 'Este encontro já está registrado (mesma turma, data e conteúdo).';
    end if;
    -- 46: mesma turma, dia e modalidade = o mesmo encontro
    if exists (select 1 from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.modalidade = p_modalidade and x.cancelado_em is null) then
      raise exception 'Esta turma já tem encontro registrado neste dia nesta modalidade. Se houve mais horas, altere o encontro que já existe.';
    end if;
    -- 46: os encontros de uma turma no mesmo dia somam no máximo 12 horas
    select coalesce(sum(x.carga_horaria), 0) into v_soma from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.cancelado_em is null;
    if v_soma + p_carga > 12 then
      raise exception 'Os encontros desta turma neste dia somariam % horas: o máximo é 12 horas por dia.', replace(trim(to_char(v_soma + p_carga, 'FM990.0')), '.', ',');
    end if;
    insert into public.fic_encontros (turma_id, professor_id, data, carga_horaria, modalidade, conteudo)
      values (p_turma, t.professor_id, p_data, p_carga, p_modalidade, trim(p_conteudo)) returning id into v_id;
  else
    select * into e from public.fic_encontros where id = p_id for update;
    if e.id is null then raise exception 'Encontro não encontrado.'; end if;
    if v_papel = 'professor_fic' and e.professor_id <> eu then raise exception 'Este encontro é de outro(a) professor(a).'; end if;
    if e.cancelado_em is not null then raise exception 'Este encontro foi cancelado e não muda mais.'; end if;
    if e.turma_id <> p_turma then raise exception 'A turma de um encontro não muda. Cancele este e registre de novo na turma certa.'; end if;
    if public.fic_mes_fechado(e.professor_id, e.data) or public.fic_mes_fechado(e.professor_id, p_data) then
      raise exception 'A bolsa deste mês já foi pedida: o encontro não muda mais (se a coordenação devolver o pedido, reabre).';
    end if;
    if exists (select 1 from public.fic_presencas p where p.encontro_id = e.id and p.confirmado_em is not null
                 and (not (p.equipe_id = any(v_pres)) or p.equipe_id not in (select public.fic_matriculados_em(p_turma, p_data)))) then
      raise exception 'Alguém que já confirmou a presença foi desmarcado (ou ficou fora da lista pela nova data). Quem confirmou continua presente.';
    end if;
    -- 46: as duas conferências novas valem só quando o dia ou a modalidade mudam, ou quando as horas AUMENTAM
    --     (encontro antigo continua editável, e diminuir as horas é sempre aceito)
    if (p_data <> e.data or p_modalidade <> e.modalidade)
       and exists (select 1 from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.modalidade = p_modalidade and x.cancelado_em is null and x.id <> e.id) then
      raise exception 'Esta turma já tem encontro registrado neste dia nesta modalidade. Se houve mais horas, altere o encontro que já existe.';
    end if;
    if p_data <> e.data or p_carga > e.carga_horaria then
      select coalesce(sum(x.carga_horaria), 0) into v_soma from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.cancelado_em is null and x.id <> e.id;
      if v_soma + p_carga > 12 then
        raise exception 'Os encontros desta turma neste dia somariam % horas: o máximo é 12 horas por dia.', replace(trim(to_char(v_soma + p_carga, 'FM990.0')), '.', ',');
      end if;
    end if;
    update public.fic_encontros set data = p_data, carga_horaria = p_carga, modalidade = p_modalidade, conteudo = trim(p_conteudo), atualizado_em = now()
      where id = e.id;
    v_id := e.id;
  end if;
  -- lista de presença: quem estava matriculado na data, presente ou não; quem saiu da lista (nova data) fica como ausente
  for m in select x as equipe_id from public.fic_matriculados_em(p_turma, p_data) x loop
    insert into public.fic_presencas (encontro_id, equipe_id, presente, marcado_por, marcado_em)
      values (v_id, m.equipe_id, m.equipe_id = any(v_pres), eu, now())
      on conflict (encontro_id, equipe_id) do update set presente = excluded.presente, marcado_por = eu, marcado_em = now()
      where fic_presencas.presente is distinct from excluded.presente;
  end loop;
  update public.fic_presencas set presente = false, marcado_por = eu, marcado_em = now()
   where encontro_id = v_id and presente and confirmado_em is null and equipe_id not in (select public.fic_matriculados_em(p_turma, p_data));
  return v_id;
end $$;

-- =====================================================================
-- 7 e 8. CUSTOS DA VISITA
-- =====================================================================
create or replace function public.custos_visita_travas() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_vis uuid := case when tg_op = 'DELETE' then old.visita_id else new.visita_id end; paga boolean;
begin
  paga := auth.uid() is not null and exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                                              where sv.visita_id = v_vis and s.situacao = 'lancada');
  if tg_op = 'DELETE' then
    if paga then raise exception 'Esta visita já foi paga (o pedido foi lançado no Arlo): a distância conferida não pode mais ser apagada.'; end if;
    return old;
  end if;
  if new.km_ida is null or not (new.km_ida >= 0 and new.km_ida < 1000) then raise exception 'Distância inválida: informe de 0 a 999 km (só a ida).'; end if;
  if not exists (select 1 from public.visitas v where v.id = new.visita_id) then raise exception 'Visita não encontrada.'; end if;
  if paga and ((tg_op = 'UPDATE' and new.km_ida is distinct from old.km_ida)
               or (tg_op = 'INSERT' and not exists (select 1 from public.custos_visita c where c.visita_id = new.visita_id and c.km_ida = new.km_ida))) then
    raise exception 'Esta visita já está num pedido lançado no Arlo: a distância (km) não muda mais.';
  end if;
  return new;
end $$;
revoke all on function public.custos_visita_travas() from public, anon, authenticated;
drop trigger if exists custos_visita_a0_travas on public.custos_visita;
create trigger custos_visita_a0_travas before insert or update or delete on public.custos_visita for each row execute function public.custos_visita_travas();

-- 8. valores usados na conta da ajuda de custo: números de verdade, dentro do que faz sentido (só quando os valores mudam)
create or replace function public.parametros_validar() returns trigger
language plpgsql as $$
declare v jsonb := new.valor; k text; rot text; h jsonb; x numeric;
begin
  if new.chave <> 'custo_visita' or (tg_op = 'UPDATE' and new.valor is not distinct from old.valor) then return new; end if;
  if jsonb_typeof(v) <> 'object' then
    raise exception 'Os valores do custo da visita vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.';
  end if;
  foreach k in array array['valor_hora', 'refeicao', 'km_por_litro', 'preco_litro', 'fator_estrada', 'teto'] loop
    if not (v ? k) then continue; end if;
    rot := case k when 'valor_hora' then 'O valor da hora' when 'refeicao' then 'O valor da refeição' when 'km_por_litro' then 'O consumo do carro (km por litro)'
                  when 'preco_litro' then 'O preço do litro da gasolina' when 'fator_estrada' then 'O fator estrada' else 'O teto das ajudas de custo' end;
    if jsonb_typeof(v -> k) <> 'number' then raise exception '% precisa ser um número.', rot; end if;
    x := (v ->> k)::numeric;
    if k in ('valor_hora', 'refeicao', 'teto') and not (x >= 0) then raise exception '% não pode ser negativo.', rot; end if;
    if k in ('km_por_litro', 'preco_litro') and not (x > 0) then raise exception '% precisa ser maior que zero.', rot; end if;
    if k = 'fator_estrada' and not (x >= 1) then raise exception 'O fator estrada precisa ser 1 ou mais (a estrada nunca é mais curta que a linha reta).'; end if;
    if not (x <= 100000000) then raise exception '% está alto demais. Confira o número.', rot; end if;
  end loop;
  if v ? 'horas' then
    h := v -> 'horas';
    if jsonb_typeof(h) <> 'object' then raise exception 'As horas por etapa vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.'; end if;
    for k in select jsonb_object_keys(h) loop
      if jsonb_typeof(h -> k) <> 'number' or not ((h ->> k)::numeric >= 0 and (h ->> k)::numeric <= 24) then
        raise exception 'As horas de cada etapa precisam ser um número entre 0 e 24.';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.parametros_validar() from public, anon, authenticated;
drop trigger if exists parametros_a0_validar on public.parametros;
create trigger parametros_a0_validar before insert or update on public.parametros for each row execute function public.parametros_validar();

-- =====================================================================
-- 9. HISTÓRICO das tabelas que ainda não tinham
-- =====================================================================
-- (tabelas sem coluna "id": o registro fica ligado à pessoa ou ao pedido. Dados pessoais complementares:
--  o histórico guarda só QUAIS campos mudaram, nunca os valores)
create or replace function public.auditar_sem_id() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end; d jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
        v_reg uuid; campos text[];
begin
  v_reg := case tg_table_name when 'equipe_privado' then (coalesce(d, a) ->> 'equipe_id')::uuid when 'entregas_mes' then (coalesce(d, a) ->> 'equipe_id')::uuid
                              when 'solicitacao_visitas' then (coalesce(d, a) ->> 'solicitacao_id')::uuid end;
  if tg_table_name = 'equipe_privado' then
    if tg_op = 'UPDATE' then
      select array_agg(k order by k) into campos from jsonb_object_keys(d) k where k not in ('equipe_id', 'atualizado_em') and (d -> k) is distinct from (a -> k);
      if campos is null then return new; end if;   -- nada mudou de verdade
      a := null; d := jsonb_build_object('campos_alterados', to_jsonb(campos));
    elsif tg_op = 'INSERT' then
      select array_agg(k order by k) into campos from jsonb_object_keys(d) k
       where k not in ('equipe_id', 'atualizado_em') and jsonb_typeof(d -> k) <> 'null' and (d -> k) <> '{}'::jsonb;
      d := jsonb_build_object('campos_preenchidos', to_jsonb(coalesce(campos, '{}')));
    else
      a := jsonb_build_object('registro_apagado', true);
    end if;
  end if;
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois) values (tg_table_name, v_reg, tg_op, public.meu_id(), a, d);
  return coalesce(new, old);
end $$;
revoke all on function public.auditar_sem_id() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['equipe_privado', 'solicitacao_visitas', 'entregas_mes', 'apl_municipios'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.auditar_sem_id()', t || '_auditoria', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- 10. APROVAR O QUE MUDOU ENQUANTO ERA LIDO
-- =====================================================================
-- A tela manda, junto com a aprovação, a marca "atualizado_em" do registro que ela leu. Se o registro mudou
-- depois disso, a marca não confere e a aprovação é recusada. Sem a marca (celular com versão antiga da tela),
-- aprova como antes. (O nome do gatilho começa com "a1": roda antes do gatilho que carimba a nova data.)
create or replace function public.versao_conferir() returns trigger
language plpgsql as $$
begin
  if new.situacao in ('aprovada', 'aprovado') and old.situacao is distinct from new.situacao
     and new.atualizado_em is distinct from old.atualizado_em then
    raise exception 'Este registro foi alterado enquanto você lia. Abra de novo e confira.';
  end if;
  return new;
end $$;
revoke all on function public.versao_conferir() from public, anon, authenticated;
drop trigger if exists a1_versao on public.fichas;
create trigger a1_versao before update on public.fichas for each row execute function public.versao_conferir();
drop trigger if exists diagnosticos_a1_versao on public.diagnosticos;
create trigger diagnosticos_a1_versao before update on public.diagnosticos for each row execute function public.versao_conferir();

-- =====================================================================
-- 11 e 22. DIAGNÓSTICO E AVALIAÇÃO: datas e números coerentes (só ao registrar ou quando o campo muda)
-- =====================================================================
create or replace function public.campo_formulario_limites() returns trigger
language plpgsql security definer set search_path = public as $$
declare novo boolean := tg_op = 'INSERT'; f_data date;
begin
  -- mensagem clara no lugar do erro de registro repetido (um diagnóstico por quintal, uma avaliação por visita)
  if novo and tg_table_name = 'diagnosticos' and exists (select 1 from public.diagnosticos d where d.ficha_id = new.ficha_id and d.id <> new.id) then
    raise exception 'Este quintal já tem diagnóstico registrado.';
  end if;
  if novo and tg_table_name = 'avaliacoes' and exists (select 1 from public.avaliacoes a where a.visita_id = new.visita_id and a.id <> new.id) then
    raise exception 'Esta visita já tem avaliação registrada.';
  end if;
  if novo or new.data_visita is distinct from old.data_visita then
    if new.data_visita < date '2026-01-01' then
      raise exception 'A data da visita não pode ser anterior a 01/01/2026 (o projeto ainda não tinha começado).';
    end if;
    select f.data_ficha into f_data from public.fichas f where f.id = new.ficha_id;
    if new.data_visita < f_data then
      raise exception 'A data da visita (%) não pode ser anterior à data da ficha desta mulher (%).', to_char(new.data_visita, 'DD/MM/YYYY'), to_char(f_data, 'DD/MM/YYYY');
    end if;
  end if;
  if new.latitude is not null and (novo or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude) then
    if new.longitude is null or not (new.latitude between -90 and 90) or not (new.longitude between -180 and 180) then
      raise exception 'Localização inválida: a latitude vai de -90 a 90 e a longitude de -180 a 180. Registre de novo a localização no quintal.';
    end if;
    if new.latitude = 0 and new.longitude = 0 then
      raise exception 'Localização inválida (0, 0): o GPS não respondeu. Registre de novo a localização no quintal ou explique por que não foi possível.';
    end if;
  end if;
  if tg_table_name = 'diagnosticos' then
    if new.area_m2 is not null and (novo or new.area_m2 is distinct from old.area_m2) and not (new.area_m2 > 0 and new.area_m2 <= 100000) then
      raise exception 'A área do quintal precisa ser maior que zero e de no máximo 100.000 m² (10 hectares). Confira o número.';
    end if;
    if new.renda_familiar is not null and (novo or new.renda_familiar is distinct from old.renda_familiar)
       and not (new.renda_familiar >= 0 and new.renda_familiar <= 1000000) then
      raise exception 'A renda da família não pode ser negativa nem passar de R$ 1.000.000,00. Confira o número.';
    end if;
    if new.renda_quintal is not null and (novo or new.renda_quintal is distinct from old.renda_quintal)
       and not (new.renda_quintal >= 0 and new.renda_quintal <= 1000000) then
      raise exception 'O valor das vendas do quintal não pode ser negativo nem passar de R$ 1.000.000,00. Confira o número.';
    end if;
    if new.lote is not null and new.lote not in (1, 2) then raise exception 'O lote de implantação precisa ser 1 ou 2.'; end if;
  elsif tg_table_name = 'avaliacoes' then
    if new.ebia_pontos is not null and not (new.ebia_pontos between 0 and 14) then raise exception 'A pontuação da EBIA vai de 0 a 14.'; end if;
  end if;
  return new;
end $$;
revoke all on function public.campo_formulario_limites() from public, anon, authenticated;
drop trigger if exists diagnosticos_a2_limites on public.diagnosticos;
create trigger diagnosticos_a2_limites before insert or update on public.diagnosticos for each row execute function public.campo_formulario_limites();
do $$ begin
  if to_regclass('public.avaliacoes') is not null then
    drop trigger if exists avaliacoes_a2_limites on public.avaliacoes;
    create trigger avaliacoes_a2_limites before insert or update on public.avaliacoes for each row execute function public.campo_formulario_limites();
  end if;
end $$;

-- 18. (igual ao do 15; muda só a data futura: fuso de Fortaleza, e só ao registrar ou quando a data muda)
create or replace function public.avaliacoes_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.visitas; papel text := public.meu_papel();
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.visita_id <> old.visita_id then
    select * into v from public.visitas where id = new.visita_id;
    if v.id is null or v.etapa <> 'avaliacao' or v.ficha_id <> new.ficha_id then
      raise exception 'A avaliação precisa estar ligada à visita de avaliação desta mulher.';
    end if;
    if v.situacao = 'cancelada' then raise exception 'A visita de avaliação foi cancelada.'; end if;
    new.uf := v.uf; new.executor_id := v.executor_id;
  end if;
  if new.data_visita > (now() at time zone 'America/Fortaleza')::date and (tg_op = 'INSERT' or new.data_visita is distinct from old.data_visita) then
    raise exception 'A data da avaliação não pode ser no futuro.';
  end if;
  if tg_op = 'INSERT' then new.criado_em := now();
  elsif papel is not null and papel not in ('articulacao','apoio','agente','coord_geral') then
    raise exception 'Quem corrige a avaliação é quem fez a visita ou a bolsista do estado.';
  end if;
  return new;
end $$;

-- =====================================================================
-- 12, 14 e 22. FICHAS
-- =====================================================================
-- ("c_" no nome: roda depois de fichas_antes e de fichas_b_conferir)
create or replace function public.fichas_regras() returns trigger
language plpgsql security definer set search_path = public as $$
declare ant public.fichas; novo boolean; logado boolean := auth.uid() is not null;
begin
  if tg_op = 'UPDATE' then ant := old;
  else select * into ant from public.fichas x where x.id = new.id;   -- celular reenviando a mesma ficha: compara com a que já existe
  end if;
  novo := ant.id is null;
  -- CPF: formato, repetido e pessoa da equipe (só na ficha nova ou quando o CPF muda)
  if novo or new.cpf is distinct from ant.cpf then
    if new.cpf is null or new.cpf !~ '^[0-9]{11}$' then raise exception 'O CPF da mulher precisa ter 11 números, sem pontos, traço ou espaços.'; end if;
    if exists (select 1 from public.fichas x where x.cpf = new.cpf and x.id <> new.id) then
      raise exception 'Esta mulher (CPF) já tem ficha no projeto, possivelmente em outro estado. Fale com a coordenação técnica.';
    end if;
    if exists (select 1 from public.equipe e where e.cpf = new.cpf and e.status = 'ativa') then
      raise exception 'Este CPF é de uma pessoa ativa da equipe do projeto: quem trabalha no projeto não entra como beneficiária. Confira o CPF.';
    end if;
  end if;
  if new.testemunha_cpf is not null and new.testemunha_cpf = new.cpf
     and (novo or new.testemunha_cpf is distinct from ant.testemunha_cpf or new.cpf is distinct from ant.cpf) then
    raise exception 'A testemunha da assinatura não pode ser a própria mulher (mesmo CPF). Informe o CPF de quem assistiu.';
  end if;
  -- mensagens claras no lugar dos erros do banco (são as mesmas regras de sempre)
  if new.resultado in ('selecionada', 'lista_espera') and new.data_nascimento > (new.data_ficha - interval '18 years') then
    raise exception 'Ela tem menos de 18 anos na data da ficha: não pode ser selecionada nem entrar na lista de espera.';
  end if;
  if new.pessoas_familia is not null and not (new.pessoas_familia between 1 and 30) then
    raise exception 'O número de pessoas da família precisa ficar entre 1 e 30.';
  end if;
  if new.resultado in ('selecionada', 'lista_espera') and not (new.c_agricultora and new.c_maior18 and new.c_espaco and new.c_agua and new.c_disponibilidade
       and new.c_sem_kit and new.c_sem_parentesco and new.c_casa_unica and new.autodeclaracao) then
    raise exception 'Selecionada ou lista de espera só com todos os critérios obrigatórios e a autodeclaração assinada.';
  end if;
  if new.latitude is not null and (novo or new.latitude is distinct from ant.latitude or new.longitude is distinct from ant.longitude)
     and (new.longitude is null or not (new.latitude between -90 and 90) or not (new.longitude between -180 and 180)
          or (new.latitude = 0 and new.longitude = 0)) then
    raise exception 'Localização inválida. Registre de novo a localização (a latitude vai de -90 a 90 e a longitude de -180 a 180).';
  end if;
  -- posição na lista de espera: só para quem está na lista, sem repetir no estado
  if new.posicao_espera is not null then
    if new.resultado <> 'lista_espera' then
      if not novo and new.posicao_espera is not distinct from ant.posicao_espera then
        -- saiu da lista de espera (foi selecionada, por exemplo): a posição se desfaz. Ficha antiga que já estava assim fica como está.
        if ant.resultado = 'lista_espera' then new.posicao_espera := null; end if;
      else
        raise exception 'A posição na lista de espera só vale para quem está na lista de espera.';
      end if;
    elsif novo or new.posicao_espera is distinct from ant.posicao_espera or new.resultado is distinct from ant.resultado or new.uf is distinct from ant.uf then
      perform pg_advisory_xact_lock(hashtext('espera_' || new.uf));
      if exists (select 1 from public.fichas x where x.uf = new.uf and x.resultado = 'lista_espera' and x.posicao_espera = new.posicao_espera and x.id <> new.id) then
        raise exception 'Já há outra mulher na posição % da lista de espera de %. Escolha outra posição.', new.posicao_espera, new.uf;
      end if;
    end if;
  end if;
  -- quintal em andamento (só na tela: pelo SQL Editor a coordenação geral ainda consegue consertar um caso raro)
  if tg_op = 'UPDATE' and logado then
    if new.uf is distinct from old.uf and exists (select 1 from public.visitas v where v.ficha_id = old.id and v.situacao <> 'cancelada') then
      raise exception 'Esta ficha já tem visita agendada ou feita: o estado não muda. Se o estado foi lançado errado, cancele antes as visitas agendadas (visita já feita não se cancela).';
    end if;
    if ((new.situacao = 'devolvida' and old.situacao is distinct from 'devolvida') or new.resultado is distinct from old.resultado)
       and exists (select 1 from public.diagnosticos d where d.ficha_id = old.id) then
      raise exception 'Este quintal já está em andamento (tem diagnóstico registrado): a ficha não pode ser devolvida nem mudar de resultado. Para corrigir um dado da ficha, a coordenação geral altera direto. Se a mulher saiu do projeto, cancele antes as visitas agendadas e registre a saída na observação.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.fichas_regras() from public, anon, authenticated;
drop trigger if exists fichas_c_regras on public.fichas;
create trigger fichas_c_regras before insert or update on public.fichas for each row execute function public.fichas_regras();

-- =====================================================================
-- 13. LINK DE CADASTRO já usado não é reaberto
-- =====================================================================
create or replace function public.convites_travas() returns trigger
language plpgsql as $$
begin
  if old.usado_em is not null and auth.uid() is not null then
    if new.usado_em is distinct from old.usado_em or new.expira_em > old.expira_em
       or new.token is distinct from old.token or new.papel is distinct from old.papel or new.uf is distinct from old.uf then
      raise exception 'Este link de cadastro já foi usado e não pode ser reaberto. Gere um link novo.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.convites_travas() from public, anon, authenticated;
drop trigger if exists convites_a0_travas on public.convites;
create trigger convites_a0_travas before update on public.convites for each row execute function public.convites_travas();

-- =====================================================================
-- 16, 18 e 22. ENTREGAS DO MÊS
-- =====================================================================
-- (igual ao do 32; muda só o que está marcado com "46")
create or replace function public.entregas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.equipe; hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: fuso de Fortaleza
begin
  new.marcado_por := public.meu_id();
  new.marcado_em := now();
  -- 46: mensagens claras no lugar dos erros do banco
  if new.mes is null or extract(day from new.mes) <> 1 then raise exception 'O mês da entrega precisa vir como o dia 1º do mês (por exemplo, 01/09/2026).'; end if;
  if exists (select 1 from public.entregas_mes x where x.equipe_id = new.equipe_id and x.mes = new.mes and x.item = new.item) then
    raise exception using message = 'Esta entrega do mês já estava marcada.', errcode = '23505';
  end if;
  if new.mes > hoje - (extract(day from hoje)::int - 1) then raise exception 'Mês no futuro.'; end if;
  select * into p from public.equipe where id = new.equipe_id;
  if p.data_inicio is not null and new.mes < p.data_inicio - (extract(day from p.data_inicio)::int - 1) then
    raise exception '% começou no projeto em %: não há entrega antes desse mês.', coalesce(p.nome_social, p.nome), to_char(p.data_inicio, 'MM/YYYY');
  end if;
  if new.item = 'ava' and (p.matricula_fic_em is null or new.mes < p.matricula_fic_em - (extract(day from p.matricula_fic_em)::int - 1)) then
    raise exception 'Acesso ao AVA só a partir do mês da matrícula no FIC.';
  end if;
  return new;
end $$;

-- 16. depois da bolsa lançada no Arlo, a entrega daquele mês não se desmarca
create or replace function public.entregas_travas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and exists (select 1 from public.solicitacoes_pagamento s
       where s.tipo = 'bolsa' and s.equipe_id = old.equipe_id and s.mes = old.mes and s.situacao = 'lancada') then
    raise exception 'A bolsa de % já foi lançada no Arlo: a entrega deste mês não pode mais ser desmarcada.', to_char(old.mes, 'MM/YYYY');
  end if;
  return old;
end $$;
revoke all on function public.entregas_travas() from public, anon, authenticated;
drop trigger if exists entregas_a0_travas on public.entregas_mes;
create trigger entregas_a0_travas before delete on public.entregas_mes for each row execute function public.entregas_travas();

-- =====================================================================
-- 18 e 22. EXECUÇÃO FINANCEIRA (igual ao do 36; muda só o que está marcado com "46")
-- =====================================================================
create or replace function public.execucao_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.execucao_lancamentos;
begin
  if tg_op <> 'INSERT' then raise exception 'Lançamento não se altera nem se apaga. Para corrigir, faça um estorno.'; end if;
  new.criado_por := public.meu_id(); new.criado_em := now();
  -- 46: o "hoje" é o de Fortaleza, não o da conexão
  if new.data > (now() at time zone 'America/Fortaleza')::date then raise exception 'A data do lançamento não pode ser no futuro.'; end if;
  if new.data < date '2026-01-01' or new.data > date '2028-12-31' then raise exception 'Data fora do período do projeto.'; end if;
  if new.estorno_de is null then
    if new.valor < 0 then raise exception 'Valor negativo só em estorno.'; end if;
    -- 46: mensagem clara no lugar do erro do banco
    if new.valor is null or new.valor = 0 or abs(new.valor) > 2000000 then
      raise exception 'O valor do lançamento precisa ser de R$ 0,01 a R$ 2.000.000,00.';
    end if;
  else
    select * into o from public.execucao_lancamentos where id = new.estorno_de;
    if o.id is null then raise exception 'Lançamento a estornar não encontrado.'; end if;
    if o.estorno_de is not null then raise exception 'Não se estorna um estorno.'; end if;
    if length(trim(coalesce(new.descricao, ''))) < 10 then raise exception 'Para estornar, escreva o motivo (pelo menos 10 letras).'; end if;
    -- 46: mensagem clara no lugar do erro de registro repetido
    if exists (select 1 from public.execucao_lancamentos x where x.estorno_de = new.estorno_de) then raise exception 'Este lançamento já foi estornado.'; end if;
    new.tipo := o.tipo; new.item := o.item; new.valor := -o.valor;              -- o estorno anula exatamente o original
  end if;
  return new;
end $$;

-- =====================================================================
-- 19. ENVIO EM DOBRO AO MESMO TEMPO: canal de venda e situação da água (o encontro do FIC está no bloco do curso)
-- =====================================================================
-- (igual ao do 44; muda só o que está marcado com "46")
create or replace function public.salvar_canal_venda(p_id uuid, p_uf text, p_municipio text, p_tipo text, p_nome text, p_detalhe text, p_contato text, p_ativo boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare papel text := coalesce(public.meu_papel(), ''); v uuid; atual public.canais_venda;
begin
  if papel not in ('coord_geral','coord_tecnico','articulacao','apoio') then
    raise exception 'Quem cadastra os canais de venda é a coordenação ou a bolsista do estado.';
  end if;
  if p_id is not null then
    select * into atual from public.canais_venda where id = p_id for update;
    if atual.id is null then raise exception 'Canal não encontrado.'; end if;
    p_uf := atual.uf;   -- o estado de um canal não muda
  end if;
  if p_uf is null or p_uf not in ('AL','BA','PE','PI','SE') then raise exception 'Escolha o estado.'; end if;
  if papel in ('articulacao','apoio') and p_uf <> public.minha_uf() then raise exception 'Você cadastra canais só do seu estado.'; end if;
  if length(trim(coalesce(p_municipio, ''))) < 2 then raise exception 'Informe o município.'; end if;
  if length(trim(p_municipio)) > 80 then raise exception 'O nome do município passou de 80 letras.'; end if;
  if coalesce(p_tipo, '') not in ('feira','grupo','merenda','paa','comprador','outro') then raise exception 'Escolha o tipo de canal.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Dê um nome ao canal (pelo menos 3 letras).'; end if;
  if length(trim(p_nome)) > 120 then raise exception 'O nome do canal passou de 120 letras.'; end if;
  if length(coalesce(p_detalhe, '')) > 400 then raise exception 'O detalhe do canal passou de 400 letras.'; end if;
  if length(coalesce(p_contato, '')) > 160 then raise exception 'O contato do canal passou de 160 letras.'; end if;
  -- 46: um cadastro de cada vez por município (dois envios ao mesmo tempo não gravam o mesmo canal duas vezes)
  perform pg_advisory_xact_lock(hashtext('canal_venda_' || p_uf || '_' || lower(trim(p_municipio))));
  if p_id is null then
    if exists (select 1 from public.canais_venda c where c.uf = p_uf and lower(trim(c.municipio)) = lower(trim(p_municipio)) and c.tipo = p_tipo
                 and lower(trim(c.nome)) = lower(trim(p_nome))) then
      raise exception 'Este canal já está cadastrado neste município.';
    end if;
    insert into public.canais_venda (uf, municipio, tipo, nome, detalhe, contato, ativo, criado_por, atualizado_por)
    values (p_uf, trim(p_municipio), p_tipo, trim(p_nome), nullif(trim(coalesce(p_detalhe, '')), ''), nullif(trim(coalesce(p_contato, '')), ''), coalesce(p_ativo, true), public.meu_id(), public.meu_id())
    returning id into v;
  else
    -- 46: ao mudar o nome, o tipo ou o município, o canal não pode virar repetido de outro (o que já era repetido antes continua editável)
    if (lower(trim(p_nome)) <> lower(trim(atual.nome)) or p_tipo <> atual.tipo or lower(trim(p_municipio)) <> lower(trim(atual.municipio)))
       and exists (select 1 from public.canais_venda c where c.id <> p_id and c.uf = p_uf and lower(trim(c.municipio)) = lower(trim(p_municipio))
                     and c.tipo = p_tipo and lower(trim(c.nome)) = lower(trim(p_nome))) then
      raise exception 'Já existe outro canal com este nome e tipo neste município.';
    end if;
    update public.canais_venda set municipio = trim(p_municipio), tipo = p_tipo, nome = trim(p_nome), detalhe = nullif(trim(coalesce(p_detalhe, '')), ''),
      contato = nullif(trim(coalesce(p_contato, '')), ''), ativo = coalesce(p_ativo, true), atualizado_por = public.meu_id(), atualizado_em = now()
    where id = p_id returning id into v;
  end if;
  return v;
end $$;

-- (igual ao do 39; muda só o que está marcado com "46")
create or replace function public.registrar_situacao_agua(p_ficha uuid, p_situacao text, p_obs text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_atual text;
begin
  if coalesce(public.meu_papel(), '') not in ('coord_geral', 'coord_tecnico') then
    raise exception 'Quem registra a situação da água é a coordenação.';
  end if;
  if not exists (select 1 from public.fichas f where f.id = p_ficha and f.resultado = 'sem_agua')
     and not exists (select 1 from public.diagnosticos d where d.ficha_id = p_ficha and d.sem_agua) then
    raise exception 'Esta mulher não está na lista de quem precisa de solução de água.';
  end if;
  if coalesce(p_situacao, '') not in ('sem_solucao', 'encaminhada', 'em_andamento', 'concluida') then raise exception 'Situação inválida.'; end if;
  if length(trim(coalesce(p_obs, ''))) < 10 then raise exception 'Escreva o que aconteceu (pelo menos 10 letras): programa, órgão, o que foi feito.'; end if;
  if length(trim(p_obs)) > 500 then raise exception 'A observação passou de 500 letras.'; end if;
  -- 46: um registro de cada vez por mulher (dois envios ao mesmo tempo não gravam a mesma situação duas vezes)
  perform pg_advisory_xact_lock(hashtext('agua_' || p_ficha::text));
  select situacao into v_atual from public.agua_situacoes where ficha_id = p_ficha order by registrado_em desc limit 1;
  if v_atual = p_situacao then raise exception 'A situação já é esta. Escolha a nova situação.'; end if;
  insert into public.agua_situacoes (ficha_id, situacao, obs, registrado_por) values (p_ficha, p_situacao, trim(p_obs), public.meu_id()) returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- 20 e 22. EQUIPE
-- =====================================================================
-- ("c_" no nome: roda depois de equipe_antes e de equipe_b_datas)
create or replace function public.equipe_regras() returns trigger
language plpgsql security definer set search_path = public as $$
declare novo boolean := tg_op = 'INSERT'; logado boolean := auth.uid() is not null; alvo public.equipe;
        fora constant text[] := array['atualizado_em', 'user_id'];
begin
  -- 20. cadastro desligado não é mais editado; só a coordenação geral corrige
  --     (a matrícula do FIC, cancelada pelo professor, e o vínculo do login continuam sendo acertados pelo sistema)
  if not novo and old.status = 'desligada' and logado and coalesce(public.meu_papel(), '') <> 'coord_geral'
     and coalesce(current_setting('mq.matricula_fic', true), '') <> '1'
     and (to_jsonb(new) - fora) is distinct from (to_jsonb(old) - fora) then
    raise exception 'Este cadastro está desligado e não é mais alterado. Se houver erro, peça à coordenação geral para corrigir.';
  end if;
  -- 20. "substitui": nunca a própria pessoa, nem pessoa ativa de outro estado (só ao cadastrar ou quando o campo muda)
  if new.substitui_id is not null and (novo or new.substitui_id is distinct from old.substitui_id) then
    if new.substitui_id = new.id then raise exception 'A pessoa não pode substituir a si mesma. Escolha quem saiu da vaga.'; end if;
    select * into alvo from public.equipe where id = new.substitui_id;
    if alvo.id is not null and alvo.status = 'ativa' and alvo.uf is distinct from new.uf then
      raise exception '% está ativa em outro estado: a substituição é de quem saiu da mesma vaga.', coalesce(alvo.nome_social, alvo.nome);
    end if;
  end if;
  -- 22. mensagens claras no lugar dos erros do banco (são as mesmas regras de sempre)
  if new.cpf is null or new.cpf !~ '^[0-9]{11}$' then raise exception 'O CPF precisa ter 11 números, sem pontos, traço ou espaços.'; end if;
  if new.email is null or new.email::text !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido. Confira (sem espaços).'; end if;
  if new.status = 'desligada' and (new.data_fim is null or length(trim(coalesce(new.motivo_desligamento, ''))) < 5) then
    raise exception 'Para desligar, informe a data e o motivo do desligamento (pelo menos 5 letras).';
  end if;
  if new.data_fim is not null and new.data_fim < new.data_inicio then
    raise exception 'A data do desligamento não pode ser anterior à data de início (%).', to_char(new.data_inicio, 'DD/MM/YYYY');
  end if;
  if new.status = 'ativa' and (novo or new.cpf is distinct from old.cpf)
     and exists (select 1 from public.equipe x where x.status = 'ativa' and x.cpf = new.cpf and x.id <> new.id) then
    raise exception 'Esta pessoa (CPF) já ocupa outra vaga ativa.';
  end if;
  if new.status = 'ativa' and (novo or new.email is distinct from old.email)
     and exists (select 1 from public.equipe x where x.status = 'ativa' and x.email = new.email and x.id <> new.id) then
    raise exception 'Este e-mail já está em uso por outra pessoa ativa.';
  end if;
  return new;
end $$;
revoke all on function public.equipe_regras() from public, anon, authenticated;
drop trigger if exists equipe_c_regras on public.equipe;
create trigger equipe_c_regras before insert or update on public.equipe for each row execute function public.equipe_regras();

-- 20. no desligamento, a matrícula do FIC ainda ativa passa a "cancelada" (o histórico das presenças continua valendo:
--     a pessoa conta como matriculada em todos os encontros anteriores ao desligamento)
create or replace function public.equipe_desligada_matricula() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'ativa' and new.status = 'desligada' and to_regclass('public.matriculas_fic') is not null then
    update public.matriculas_fic
       set cancelada_em = now(),
           motivo_cancelamento = 'Cancelada pelo sistema: a pessoa foi desligada do projeto em '
             || to_char(coalesce(new.data_fim, (now() at time zone 'America/Fortaleza')::date), 'DD/MM/YYYY') || '.'
     where equipe_id = old.id and cancelada_em is null;
  end if;
  return new;
end $$;
revoke all on function public.equipe_desligada_matricula() from public, anon, authenticated;
drop trigger if exists equipe_desligada_matricula on public.equipe;
create trigger equipe_desligada_matricula after update on public.equipe for each row execute function public.equipe_desligada_matricula();
-- quem JÁ estava desligada e ficou com matrícula "ativa" (única alteração deste script em dado que já existe; nada é apagado)
update public.matriculas_fic m
   set cancelada_em = now(),
       motivo_cancelamento = 'Cancelada pelo sistema: a pessoa foi desligada do projeto em ' || to_char(e.data_fim, 'DD/MM/YYYY') || '.'
  from public.equipe e
 where e.id = m.equipe_id and e.status = 'desligada' and m.cancelada_em is null;

-- =====================================================================
-- 21 e 22. DOCUMENTOS (igual ao do 27; muda só o que está marcado com "46")
-- =====================================================================
create or replace function public.documentos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  if tg_op = 'INSERT' then
    new.enviado_por := public.meu_id(); new.enviado_em := now(); new.arquivado_em := null; new.arquivado_por := null; new.motivo_arquivo := null;
    -- 46: mensagem clara no lugar do erro de registro repetido
    if exists (select 1 from public.documentos_projeto x where x.arquivo_path = new.arquivo_path) then
      raise exception 'Este arquivo já foi anexado. Escolha outro arquivo.';
    end if;
  else
    if new.arquivo_path is distinct from old.arquivo_path or new.enviado_por is distinct from old.enviado_por or new.enviado_em is distinct from old.enviado_em then
      raise exception 'O arquivo e quem enviou não mudam. Para trocar o arquivo, arquive este documento e anexe outro.';
    end if;
    if old.arquivado_em is not null and new.arquivado_em is null then raise exception 'Documento arquivado não volta. Anexe de novo, se precisar.'; end if;
    if old.arquivado_em is not null and (new.arquivado_em is distinct from old.arquivado_em or new.motivo_arquivo is distinct from old.motivo_arquivo
        or new.arquivado_por is distinct from old.arquivado_por) then
      raise exception 'Este documento já está arquivado.';
    end if;
    -- 46: documento arquivado não muda título nem data
    if old.arquivado_em is not null and (new.titulo is distinct from old.titulo or new.data_documento is distinct from old.data_documento) then
      raise exception 'Este documento já está arquivado: o título e a data não mudam mais.';
    end if;
    if new.arquivado_em is not null and old.arquivado_em is null then
      if length(trim(coalesce(new.motivo_arquivo, ''))) < 5 then raise exception 'Para arquivar, escreva o motivo.'; end if;
      new.arquivado_por := public.meu_id(); new.arquivado_em := now();
    end if;
  end if;
  -- 46: data do documento de 01/01/2025 até um ano à frente (só ao anexar ou quando a data muda)
  if (tg_op = 'INSERT' or new.data_documento is distinct from old.data_documento)
     and (new.data_documento < date '2025-01-01' or new.data_documento > hoje + 365) then
    raise exception 'Confira a data do documento: precisa ser a partir de 01/01/2025 e no máximo um ano à frente.';
  end if;
  return new;
end $$;

-- =====================================================================
-- 22. LINK DE CADASTRO (igual ao do 25; muda só o que está marcado com "46")
-- =====================================================================
create or replace function public.enviar_pre_cadastro(p_token text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c public.convites; v_cpf text := regexp_replace(coalesce(p_dados->>'cpf', ''), '\D', '', 'g');
        v_email text := lower(trim(coalesce(p_dados->>'email', '')));
        v_arlo boolean; v_nasc date; v_nis text := nullif(regexp_replace(coalesce(p_dados->>'nis', ''), '\D', '', 'g'), '');
        v_siape text := nullif(regexp_replace(coalesce(p_dados->>'siape', ''), '\D', '', 'g'), '');
        hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  select * into c from public.convites where token = p_token for update;
  if c.id is null or c.usado_em is not null or c.cancelado_em is not null or c.expira_em <= now() then
    raise exception 'Este link não vale mais. Peça um novo à coordenação.';
  end if;
  -- 46: o que vem do formulário é conferido antes de chegar às colunas (mensagem clara no lugar do erro do banco)
  begin v_arlo := coalesce((p_dados->>'cadastro_arlo')::boolean, false); exception when others then v_arlo := false; end;
  begin
    if coalesce((p_dados->>'consentimento_lgpd')::boolean, false) is not true then raise exception 'É preciso aceitar o uso dos dados para o cadastro.'; end if;
  exception when invalid_text_representation then raise exception 'É preciso aceitar o uso dos dados para o cadastro.';
  end;
  if length(trim(coalesce(p_dados->>'nome', ''))) < 5 then raise exception 'Escreva o nome completo (pelo menos 5 letras).'; end if;
  if v_cpf !~ '^[0-9]{11}$' then raise exception 'O CPF precisa ter 11 números. Confira.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido. Confira (sem espaços).'; end if;
  if v_nis is not null and v_nis !~ '^[0-9]{11}$' then raise exception 'O NIS precisa ter 11 números. Se não souber, deixe em branco.'; end if;
  if v_siape is not null and v_siape !~ '^[0-9]{5,8}$' then raise exception 'O SIAPE precisa ter de 5 a 8 números. Confira.'; end if;
  if not v_arlo and nullif(p_dados->>'data_nascimento', '') is null then raise exception 'Informe a data de nascimento.'; end if;
  begin v_nasc := nullif(trim(p_dados->>'data_nascimento'), '')::date;
  exception when others then raise exception 'A data de nascimento não é uma data que existe. Confira dia, mês e ano.';
  end;
  if v_nasc > hoje then raise exception 'A data de nascimento não pode ser no futuro.'; end if;
  if v_nasc < date '1901-01-01' then raise exception 'Confira a data de nascimento: o ano está antigo demais.'; end if;
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
            nullif(trim(p_dados->>'nome_social'), ''), v_nasc, v_nis,
            coalesce(p_dados->'endereco', '{}'::jsonb), p_dados->'socioeconomico', true, v_arlo, v_siape,
            case when jsonb_typeof(p_dados->'perfil') = 'object' then p_dados->'perfil' end);
  update public.convites set usado_em = now() where id = c.id;
end $$;

-- =====================================================================
-- 23. VITRINE: município com e sem acento é o mesmo (igual ao do 40; muda só o agrupamento e o nome mostrado)
-- =====================================================================
create or replace function public.vitrine_municipios() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_ex text := '';
begin
  if to_regclass('public.exemplo') is not null then v_ex := ' and f.id not in (select id from public.exemplo)'; end if;
  -- 46: agrupa pelo nome sem acento; mostra a grafia com acento (em caso de empate, a que não está toda em maiúsculas ou minúsculas e a mais usada)
  execute 'select coalesce(jsonb_agg(jsonb_build_object(''uf'', uf, ''municipio'', municipio, ''n'', case when n >= 3 then n end, ''menos_de_3'', n < 3) order by uf, municipio), ''[]''::jsonb)
             from (select g.uf, (array_agg(g.nome order by g.acentos desc, (g.nome <> upper(g.nome) and g.nome <> lower(g.nome)) desc, g.vezes desc, g.nome))[1] municipio, sum(g.vezes) n
                     from (select f.uf, public.sem_acento(f.municipio) chave, regexp_replace(trim(f.municipio), ''\s+'', '' '', ''g'') nome, count(*) vezes,
                                  length(regexp_replace(trim(f.municipio), ''[ -~]'', '''', ''g'')) acentos
                             from public.fichas f
                            where f.resultado <> ''nao_atende'' and coalesce(trim(f.municipio), '''') <> ''''' || v_ex || '
                            group by 1, 2, 3, 5) g
                    group by g.uf, g.chave) x'
    into v;
  return v;
end $$;

-- funções novas: fechadas para quem não entrou no sistema (as de gatilho não são chamadas por ninguém) ---------------
revoke all on function public.sem_acento(text) from public, anon, authenticated;

commit;

select 'Regras decididas e pendências da auditoria instaladas' as resultado,
       (select prosrc like '%visita_etapa_motivo%' from pg_proc where proname = 'visitas_feita' and pronamespace = 'public'::regnamespace) as etapas_em_ordem,
       not exists (select 1 from pg_constraint where conname = 'uma_por_mes' and conrelid = 'public.solicitacoes_pagamento'::regclass)
         and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'uma_por_mes' and indexdef ilike '%where%bolsa%') as ajuda_complementar_e_bolsa_unica,
       public.brl((public.saldo_passagens_eventos()->>'passagem_teto')::numeric) as teto_intercambio,
       public.brl((public.saldo_passagens_eventos()->>'passagem_pedagogico_teto')::numeric) as teto_pedagogico,
       (select count(*) from pg_trigger where not tgisinternal and tgname in ('a1_versao', 'diagnosticos_a1_versao', 'diagnosticos_a2_limites', 'fichas_c_regras', 'equipe_c_regras',
          'custos_visita_a0_travas', 'parametros_a0_validar', 'convites_a0_travas', 'entregas_a0_travas', 'equipe_desligada_matricula', 'equipe_privado_auditoria')) as gatilhos_novos_de_11,
       (select string_agg(proname, ', ') from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* 'current_date') as funcoes_ainda_no_fuso_da_conexao;
