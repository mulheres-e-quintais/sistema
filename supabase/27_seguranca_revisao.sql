-- =====================================================================
-- Mulheres & Quintais — 27: CORREÇÕES DE SEGURANÇA DA REVISÃO DE 29/09/2026
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- 1. Pagamentos: só se grava pelas funções (pedir, dar aval, lançar no Arlo). O script 15 tinha
--    liberado gravação direta para a coordenação geral, o que passava por fora das regras
--    (habilitação, "ninguém dá aval no próprio pedido", ordem das etapas).
-- 2. Convites e pré-cadastros: criar só pelas funções (vagas, validade do link). Aprovar/recusar continua.
-- 3. Pendências de campo: só quem entrou no sistema consulta (antes, sem login dava para perguntar).
-- 4. Documento arquivado não pode ser arquivado de novo (a data e o motivo do arquivamento não mudam).
-- Nada é apagado.
-- =====================================================================
begin;

revoke insert, update, delete on public.solicitacoes_pagamento, public.solicitacao_visitas from authenticated;
grant select on public.solicitacoes_pagamento, public.solicitacao_visitas to authenticated;

revoke insert, delete on public.convites, public.pre_cadastros from authenticated;

revoke all on function public.pendencias_campo(uuid) from public, anon;
grant execute on function public.pendencias_campo(uuid) to authenticated;

create or replace function public.documentos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.enviado_por := public.meu_id(); new.enviado_em := now(); new.arquivado_em := null; new.arquivado_por := null; new.motivo_arquivo := null;
  else
    if new.arquivo_path is distinct from old.arquivo_path or new.enviado_por is distinct from old.enviado_por or new.enviado_em is distinct from old.enviado_em then
      raise exception 'O arquivo e quem enviou não mudam. Para trocar o arquivo, arquive este documento e anexe outro.';
    end if;
    if old.arquivado_em is not null and new.arquivado_em is null then raise exception 'Documento arquivado não volta. Anexe de novo, se precisar.'; end if;
    if old.arquivado_em is not null and (new.arquivado_em is distinct from old.arquivado_em or new.motivo_arquivo is distinct from old.motivo_arquivo
        or new.arquivado_por is distinct from old.arquivado_por) then
      raise exception 'Este documento já está arquivado.';
    end if;
    if new.arquivado_em is not null and old.arquivado_em is null then
      if length(trim(coalesce(new.motivo_arquivo, ''))) < 5 then raise exception 'Para arquivar, escreva o motivo.'; end if;
      new.arquivado_por := public.meu_id(); new.arquivado_em := now();
    end if;
  end if;
  return new;
end $$;

commit;

select 'Correções de segurança instaladas' as resultado,
  not has_table_privilege('authenticated', 'public.solicitacoes_pagamento', 'INSERT') as pagamentos_so_por_funcao,
  not has_function_privilege('anon', 'public.pendencias_campo(uuid)', 'EXECUTE') as pendencias_sem_anonimo;
