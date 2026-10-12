-- =====================================================================
-- Mulheres & Quintais — 57: CORREÇÕES DA AUDITORIA DE 12/10/2026 (itens 10, 12, 13 e 14)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 56. Pode rodar de novo.
-- Não apaga nem muda nenhum registro que já existe: só acrescenta regras para o que for gravado daqui em diante.
--
-- 10. Termo e fotos da ficha aprovada: o arquivo tem nome fixo e era sobrescrito. A bolsista trocava a foto do
--     termo de consentimento de uma ficha já aprovada sem a coordenação saber. Agora, com a ficha aprovada,
--     ninguém troca nem acrescenta arquivo; para corrigir, a coordenação técnica devolve a ficha.
-- 12. Bolsa só de outubro de 2026 a setembro de 2027 (os 12 meses do plano de trabalho). Com início em
--     setembro saía uma 13ª bolsa, fora do orçamento.
-- 13. Desligamento não leva embora o que a pessoa tem a receber: com visita feita sem pedido de ajuda de custo
--     ou com pedido devolvido para corrigir, não se desliga. Ela faz o pedido antes (depois de desligada perde
--     o acesso). Se ela não responder, só a coordenação geral desliga assim mesmo, com a justificativa no histórico.
-- 14. Visita só dentro da vigência do TED: de 14/09/2026 a 30/09/2027 (antes valia de 01/01/2026 a 31/12/2027).
-- =====================================================================

-- ---------- 10. arquivo de ficha aprovada não se troca ----------
-- caminho no bucket "fichas": <UF>/<id da ficha>/<campo>.<ext>
create or replace function public.ficha_arquivo_livre(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.meu_id() is null then false   -- conta sem cadastro ativo: nada
              else not exists (select 1 from public.fichas f
                                where f.id::text = (storage.foldername(p_name))[2] and f.situacao = 'aprovada') end;
$$;
revoke all on function public.ficha_arquivo_livre(text) from public, anon;
grant execute on function public.ficha_arquivo_livre(text) to authenticated;

drop policy if exists fichas_arq_enviar on storage.objects;
drop policy if exists fichas_arq_trocar on storage.objects;
create policy fichas_arq_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fichas' and public.meu_papel() in ('articulacao','apoio')
              and (storage.foldername(name))[1] = public.minha_uf() and public.ficha_arquivo_livre(name));
create policy fichas_arq_trocar on storage.objects for update to authenticated
  using (bucket_id = 'fichas' and public.meu_papel() in ('articulacao','apoio')
         and (storage.foldername(name))[1] = public.minha_uf() and public.ficha_arquivo_livre(name))
  with check (bucket_id = 'fichas' and public.meu_papel() in ('articulacao','apoio')
              and (storage.foldername(name))[1] = public.minha_uf() and public.ficha_arquivo_livre(name));

-- ---------- 12. bolsa só nos 12 meses do plano ----------
create or replace function public.pagamentos_mes_bolsa() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- só para quem está logado (a tela e a chave pública); carga feita pelo dono do banco não passa por aqui
  if auth.uid() is not null and new.tipo = 'bolsa' and (tg_op = 'INSERT' or new.mes is distinct from old.mes)
     and (new.mes < date '2026-10-01' or new.mes > date '2027-09-01') then
    raise exception 'A bolsa vai de outubro de 2026 a setembro de 2027 (os 12 meses do plano de trabalho). Escolha um mês dentro desse período.';
  end if;
  return new;
end $$;
revoke all on function public.pagamentos_mes_bolsa() from public, anon, authenticated;
drop trigger if exists a0_mes_bolsa on public.solicitacoes_pagamento;
drop trigger if exists z_mes_bolsa on public.solicitacoes_pagamento;
-- "z_": roda depois das outras conferências (valor, mês repetido), que dão a mensagem mais precisa
create trigger z_mes_bolsa before insert or update on public.solicitacoes_pagamento for each row execute function public.pagamentos_mes_bolsa();

-- ---------- 14. visita dentro da vigência do TED ----------
create or replace function public.visitas_vigencia() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;   -- carga feita pelo dono do banco não passa por aqui
  if (tg_op = 'INSERT' or new.data_prevista is distinct from old.data_prevista)
     and new.data_prevista is not null and (new.data_prevista < date '2026-09-14' or new.data_prevista > date '2027-09-30') then
    raise exception 'A visita tem de ficar dentro da vigência do projeto: de 14/09/2026 a 30/09/2027.';
  end if;
  if (tg_op = 'INSERT' or new.data_realizada is distinct from old.data_realizada)
     and new.data_realizada is not null and (new.data_realizada < date '2026-09-14' or new.data_realizada > date '2027-09-30') then
    raise exception 'A visita tem de ficar dentro da vigência do projeto: de 14/09/2026 a 30/09/2027.';
  end if;
  return new;
end $$;
revoke all on function public.visitas_vigencia() from public, anon, authenticated;
drop trigger if exists a0_vigencia on public.visitas;
drop trigger if exists z_vigencia on public.visitas;
-- "z_": roda depois das outras conferências de data (futuro, ordem das etapas), que dão a mensagem mais precisa
create trigger z_vigencia before insert or update on public.visitas for each row execute function public.visitas_vigencia();

-- ---------- 13. desligar só depois dos pedidos (ou pela coordenação geral, justificando) ----------
-- visitas feitas por ela que não estão em pedido nenhum (ou só em pedido devolvido) e pedidos devolvidos dela
create or replace function public.pendencias_pagamento(p_equipe uuid) returns table (visitas_sem_pedido int, pedidos_devolvidos int)
language sql stable security definer set search_path = public, pg_temp as $$
  select (select count(*)::int from public.visitas v
           where v.executor_id = p_equipe and v.situacao = 'realizada'
             and not exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                              where sv.visita_id = v.id and s.situacao in ('solicitada','avalizada','lancada'))
             and (to_regclass('public.exemplo') is null or v.ficha_id not in (select id from public.exemplo))),
         (select count(*)::int from public.solicitacoes_pagamento s where s.equipe_id = p_equipe and s.situacao = 'devolvida');
$$;
revoke all on function public.pendencias_pagamento(uuid) from public, anon, authenticated;   -- só uso interno (gatilho e desligar_sem_pedido); a tela conta pelo que já lê

create or replace function public.equipe_desligar_pendencias() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare nv int; nd int;
begin
  if old.status = 'ativa' and new.status = 'desligada' then
    select visitas_sem_pedido, pedidos_devolvidos into nv, nd from public.pendencias_pagamento(old.id);
    if (nv > 0 or nd > 0)
       and not (coalesce(current_setting('mq.desligar_sem_pedido', true), '') = old.id::text and coalesce(public.meu_papel(), '') = 'coord_geral') then
      raise exception 'Não dá para desligar ainda: % visita(s) feita(s) sem pedido de ajuda de custo e % pedido(s) devolvido(s) para corrigir. Peça que ela faça o pedido antes: depois de desligada, ela não entra mais no sistema. Se ela não responder, a coordenação geral pode desligar assim mesmo, justificando.', nv, nd;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.equipe_desligar_pendencias() from public, anon, authenticated;
drop trigger if exists a1_desligar_pendencias on public.equipe;
create trigger a1_desligar_pendencias before update of status on public.equipe for each row execute function public.equipe_desligar_pendencias();

-- a coordenação geral desliga mesmo com pendência (ela não respondeu, abandonou): fica no histórico com a justificativa
create or replace function public.desligar_sem_pedido(p_equipe uuid, p_data date, p_motivo text, p_justificativa text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare nv int; nd int;
begin
  if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Só a coordenação geral desliga quem ainda tem pagamento a pedir.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 20 then raise exception 'Explique por que ela não fez o pedido (pelo menos 20 letras).'; end if;
  if length(p_justificativa) > 2000 or length(coalesce(p_motivo, '')) > 2000 then raise exception 'Texto muito longo (máximo 2.000 caracteres).'; end if;
  select visitas_sem_pedido, pedidos_devolvidos into nv, nd from public.pendencias_pagamento(p_equipe);
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

select 'Etapa 57 instalada: correções da auditoria de 12/10/2026 (itens 10, 12, 13 e 14)' as resultado;
