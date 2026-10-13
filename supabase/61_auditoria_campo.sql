-- =====================================================================
-- Mulheres & Quintais — 61: CORREÇÕES DA AUDITORIA COMPLETA (13/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 60. Pode rodar de novo.
-- Não apaga nenhum registro. Se já houver dado que contrarie uma regra nova, o script AVISA (linha "ATENÇÃO")
-- e segue sem aquela trava, em vez de falhar.
--
-- 1. Termo de compromisso: quem confere registra a data só do arquivo que abriu. Se a pessoa trocou o arquivo
--    enquanto ela conferia, a conferência é recusada (antes, a data valia para um arquivo que ninguém viu).
--    E a pessoa não troca o termo no mesmo instante em que ele é conferido.
-- 2. Bolsa de mês depois do desligamento não recebe aval nem é lançada no Arlo (o mês da saída continua valendo).
-- 3. O mesmo acompanhamento registrado duas vezes no mesmo dia (dois toques, duas abas) não entra: seria pago duas vezes.
-- 4. A agente escalada para implantar ou acompanhar um quintal lê o diagnóstico e o plano dele (antes só quem fez).
-- 5. Fotos de uma visita já feita não são apagadas por quem fez a visita (só a coordenação corrige).
-- 6. "Desligar assim mesmo" e relato de problema: travas contra duas gravações ao mesmo tempo.
-- 7. Contagem da fila do celular: data absurda (ano 1900, "-infinito") não entra.
-- =====================================================================
begin;

-- ---------- 1a. conferência do termo: só do arquivo que quem confere abriu ----------
-- SECURITY INVOKER de propósito: valem as mesmas permissões e travas de sempre (RLS e o gatilho equipe_termo);
-- a função só acrescenta a conferência do arquivo, com a linha travada.
create or replace function public.conferir_termo(p_equipe uuid, p_path text, p_data date) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_path text;
begin
  select termo_path into v_path from public.equipe where id = p_equipe for update;
  if not found then raise exception 'Cadastro não encontrado, ou você não tem permissão para conferir este termo.'; end if;
  if v_path is distinct from p_path then
    raise exception 'O termo foi trocado enquanto você conferia. Abra o cadastro de novo, confira o arquivo novo e registre a data.';
  end if;
  update public.equipe set termo_assinado_em = p_data where id = p_equipe;
end $$;
revoke all on function public.conferir_termo(uuid, text, date) from public, anon;
grant execute on function public.conferir_termo(uuid, text, date) to authenticated;

-- ---------- 1b. a pessoa anexa o termo: linha travada e só se ainda não foi conferido ----------
create or replace function public.enviar_meu_termo(p_path text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu public.equipe;
begin
  select * into eu from public.equipe where id = public.meu_id() for update;
  if eu.id is null then raise exception 'Entre no sistema para enviar o termo.'; end if;
  if eu.status <> 'ativa' then raise exception 'Este cadastro está desligado e não é mais alterado. Se houver erro, peça à coordenação geral para corrigir.'; end if;
  if eu.papel = 'coord_geral' then raise exception 'A coordenação geral não tem termo de compromisso neste sistema.'; end if;
  if p_path is null or p_path !~ ('^equipe/' || eu.id::text || '/termo_[0-9]{1,20}\.(pdf|jpg|jpeg|png|webp|heic|heif)$') then
    raise exception 'Arquivo do termo inválido. Anexe um PDF ou uma foto pelo próprio sistema.';
  end if;
  if eu.termo_assinado_em is not null then
    raise exception 'O seu termo já foi conferido em %. Para trocar o arquivo, fale com quem conferiu.', to_char(eu.termo_assinado_em, 'DD/MM/YYYY');
  end if;
  perform set_config('mq.meu_termo', '1', true);
  update public.equipe set termo_path = p_path where id = eu.id and termo_assinado_em is null;
  if not found then raise exception 'Seu termo acabou de ser conferido. Atualize a página.'; end if;
  perform set_config('mq.meu_termo', '', true);
end $$;
revoke all on function public.enviar_meu_termo(text) from public, anon, authenticated;
grant execute on function public.enviar_meu_termo(text) to authenticated;

-- ---------- 2. bolsa de mês depois da saída: sem aval e sem lançamento ----------
create or replace function public.pagamentos_depois_da_saida() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.equipe;
begin
  if new.tipo = 'bolsa' and new.situacao in ('avalizada', 'lancada') and new.situacao is distinct from old.situacao then
    select * into p from public.equipe where id = new.equipe_id;
    if p.status = 'desligada' and p.data_fim is not null and new.mes > date_trunc('month', p.data_fim)::date then
      raise exception 'Bolsa de % não pode ser paga: % foi desligada em %. Devolva este pedido.',
        to_char(new.mes, 'MM/YYYY'), coalesce(p.nome, 'a pessoa'), to_char(p.data_fim, 'DD/MM/YYYY');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pagamentos_depois_da_saida() from public, anon, authenticated;
drop trigger if exists z_depois_da_saida on public.solicitacoes_pagamento;
create trigger z_depois_da_saida before update of situacao on public.solicitacoes_pagamento
  for each row execute function public.pagamentos_depois_da_saida();

-- ---------- 3. o mesmo acompanhamento duas vezes no mesmo dia ----------
do $$ begin
  create unique index if not exists visitas_acompanhamento_dia on public.visitas (ficha_id, (coalesce(data_realizada, data_prevista)))
    where etapa = 'acompanhamento' and situacao <> 'cancelada';
exception when unique_violation then
  raise notice 'ATENÇÃO: já existem acompanhamentos do mesmo quintal no mesmo dia. A trava contra o registro duplicado NÃO foi ligada. Para ver quais: select ficha_id, coalesce(data_realizada, data_prevista) dia, count(*) from public.visitas where etapa = ''acompanhamento'' and situacao <> ''cancelada'' group by 1, 2 having count(*) > 1; cancele o repetido e rode este script de novo.';
end $$;

-- ---------- 4. a agente escalada lê o diagnóstico do quintal em que vai trabalhar ----------
drop policy if exists diag_ler_escalada on public.diagnosticos;
create policy diag_ler_escalada on public.diagnosticos for select to authenticated
  using ((select public.meu_papel()) = 'agente'
         and exists (select 1 from public.visitas v where v.ficha_id = diagnosticos.ficha_id and v.executor_id = (select public.meu_id()) and v.situacao <> 'cancelada'));

-- ---------- 5. fotos de visita já feita: quem fez não apaga ----------
create or replace function public.visitas_fotos_ficam() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.situacao = 'realizada' and auth.uid() is not null and coalesce(public.meu_papel(), '') not in ('coord_geral', 'coord_tecnico')
     and not (coalesce(old.fotos, '{}') <@ coalesce(new.fotos, '{}')) then
    raise exception 'As fotos de uma visita já feita não podem ser apagadas. Se houver erro, peça à coordenação para corrigir.';
  end if;
  return new;
end $$;
revoke all on function public.visitas_fotos_ficam() from public, anon, authenticated;
drop trigger if exists z_visitas_fotos_ficam on public.visitas;
create trigger z_visitas_fotos_ficam before update of fotos on public.visitas for each row execute function public.visitas_fotos_ficam();

-- ---------- 6a. "desligar assim mesmo": a linha fica travada enquanto as pendências são contadas ----------
create or replace function public.desligar_sem_pedido(p_equipe uuid, p_data date, p_motivo text, p_justificativa text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare nv int; nd int; alvo public.equipe;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral desliga quem ainda tem pagamento a pedir.'; end if;
  select * into alvo from public.equipe where id = p_equipe for update;
  if alvo.id is null or alvo.status <> 'ativa' then raise exception 'Cadastro não encontrado ou já desligado.'; end if;
  if alvo.papel = 'coord_geral' then raise exception 'A coordenação geral não é desligada por aqui.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 20 then raise exception 'Explique por que ela não fez o pedido (pelo menos 20 letras).'; end if;
  if length(p_justificativa) > 2000 or length(coalesce(p_motivo, '')) > 2000 then raise exception 'Texto muito longo (máximo 2.000 caracteres).'; end if;
  select visitas_sem_pedido, pedidos_devolvidos into nv, nd from public.pendencias_pagamento(p_equipe);
  if nv + nd = 0 then raise exception 'Ela não tem pagamento a pedir: use o desligamento normal.'; end if;
  perform set_config('mq.desligar_sem_pedido', p_equipe::text, true);
  update public.equipe set status = 'desligada', data_fim = p_data, motivo_desligamento = p_motivo where id = p_equipe and status = 'ativa';
  if not found then raise exception 'Cadastro não encontrado ou já desligado.'; end if;
  perform set_config('mq.desligar_sem_pedido', '', true);
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('equipe', p_equipe, 'DESLIGAR_COM_PENDENCIA', public.meu_id(), null,
          jsonb_build_object('visitas_sem_pedido', nv, 'pedidos_devolvidos', nd, 'justificativa', trim(p_justificativa)));
end $$;
revoke all on function public.desligar_sem_pedido(uuid, date, text, text) from public, anon;
grant execute on function public.desligar_sem_pedido(uuid, date, text, text) to authenticated;

-- ---------- 6b. relatos: no máximo 20 por dia, mesmo enviando vários ao mesmo tempo ----------
create or replace function public.relatos_limite_dia() returns trigger
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s' as $$
begin
  perform public.trava_aviso('relato_' || new.autor_id::text);
  if (select count(*) from public.relatos_problema r where r.autor_id = new.autor_id and r.criado_em > now() - interval '1 day') >= 20 then
    raise exception 'Você já enviou 20 relatos hoje. Fale com a coordenação geral.';
  end if;
  return new;
end $$;
revoke all on function public.relatos_limite_dia() from public, anon, authenticated;
drop trigger if exists a_relatos_limite_dia on public.relatos_problema;
create trigger a_relatos_limite_dia before insert on public.relatos_problema for each row execute function public.relatos_limite_dia();

-- ---------- 7. contagem da fila do celular: data absurda não entra ----------
create or replace function public.informar_fila(p_qtd int, p_recusados int, p_mais_antigo timestamptz) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id();
begin
  if eu is null then return; end if;   -- conta sem cadastro ativo: nada
  if p_qtd is null or p_qtd < 0 or p_qtd > 10000 or coalesce(p_recusados, 0) < 0 or coalesce(p_recusados, 0) > p_qtd then
    raise exception 'Contagem inválida.';
  end if;
  insert into public.fila_celular (equipe_id, qtd, recusados, mais_antigo, visto_em)
  values (eu, p_qtd, coalesce(p_recusados, 0),
          case when p_qtd > 0 then greatest(least(coalesce(p_mais_antigo, now()), now()), timestamptz '2026-01-01 00:00-03') end, now())
  on conflict (equipe_id) do update set qtd = excluded.qtd, recusados = excluded.recusados, mais_antigo = excluded.mais_antigo, visto_em = excluded.visto_em;
end $$;
revoke all on function public.informar_fila(int, int, timestamptz) from public, anon;
grant execute on function public.informar_fila(int, int, timestamptz) to authenticated;

-- ---------- 8. tela do MPA: a formação conta só matrículas e encontros que valem (sem os cancelados) ----------
create or replace function public.acompanhamento_formacao(p_orgao text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org text;
begin
  select o.orgao into v_org from public.observadores o where o.user_id = auth.uid() and o.status = 'ativo';
  if v_org is null then
    if coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico') and coalesce(p_orgao, '') in ('mda', 'mpa') then v_org := p_orgao;
    else raise exception 'Acesso restrito ao acompanhamento do projeto.'; end if;
  end if;
  return jsonb_build_object(
    'turmas', (select count(*) from public.turmas_fic t where t.id not in (select id from public.exemplo)),
    'matriculas', (select count(*) from public.matriculas_fic m where m.cancelada_em is null and m.id not in (select id from public.exemplo)),
    'encontros', (select count(*) from public.fic_encontros n where n.cancelado_em is null and n.id not in (select id from public.exemplo)));
end $$;
revoke all on function public.acompanhamento_formacao(text) from public, anon;
grant execute on function public.acompanhamento_formacao(text) to authenticated;

-- ---------- de passagem: a vitrine pública continua aberta a quem não entrou ----------
-- (rodar o 47 de novo tirava de "anon" a função das fotos da vitrine, criada no 56)
do $$ begin if to_regprocedure('public.vitrine_foto_publica(text)') is not null then grant execute on function public.vitrine_foto_publica(text) to anon, authenticated; end if; end $$;

commit;

select 'Etapa 61 instalada: correções da auditoria completa' as resultado,
       to_regprocedure('public.conferir_termo(uuid, text, date)') is not null as termo,
       exists (select 1 from pg_trigger where not tgisinternal and tgname = 'z_depois_da_saida') as bolsa_saida,
       to_regclass('public.visitas_acompanhamento_dia') is not null as acompanhamento_unico_deve_ser_true;
