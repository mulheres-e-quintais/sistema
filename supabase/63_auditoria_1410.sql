-- =====================================================================
-- Mulheres & Quintais — 63: CORREÇÕES DA AUDITORIA COMPLETA DE 14/10/2026
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 62. Pode rodar de novo.
-- Não apaga nem muda nenhum registro que já existe: só troca regras (funções, gatilhos e regras de acesso).
--
--  1. (SEG-1) Avaliação final de visita que já está num pedido de pagamento não muda (só a coordenação geral).
--  2. (SEG-2) Relato e fotos da visita paga também ficam travados (antes só a data, a situação e quem fez).
--  3. (SEG-3) Foto que é prova de visita paga, de avaliação paga ou de diagnóstico aprovado não é sobrescrita nem renomeada.
--  4. (SEG-4) A agente só grava foto na pasta do estado da ficha que ela visita.
--  5. (SEG-5) A coordenação técnica lê os dados pessoais só de quem ela gerencia (bolsistas e agentes).
--  6. (BD-2)  Quintal já implantado: o plano aprovado não é devolvido, e a correção da coordenação geral mantém o plano aprovado.
--  7. (BD-6)  Ficha selecionada com visita agendada não muda de resultado (cancele a visita antes).
--  8. (BD-8)  Histórico e últimos acessos: a regra de leitura volta a usar o índice (a página não lê a tabela inteira).
--  9. (IND-1, IND-3) Vitrine pública: "planos" sem os quintais sem água (como na tela do MDA) e nada de ficha de exemplo.
-- 10. (REG-1) Implantação e acompanhamento só ficam "feitos" com pelo menos uma foto (a tela já exigia; agora o banco também).
-- =====================================================================
begin;

-- ---------- 1. avaliação final de visita em pedido de pagamento ----------
create or replace function public.avaliacoes_trava_pagamento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and coalesce(public.meu_papel(), '') <> 'coord_geral'
     and (to_jsonb(new) - array['atualizado_em']) is distinct from (to_jsonb(old) - array['atualizado_em'])
     and exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                  where sv.visita_id = old.visita_id and s.situacao in ('solicitada', 'avalizada', 'lancada')) then
    raise exception 'Esta avaliação é de uma visita que já está numa solicitação de pagamento. Para corrigir, a coordenação devolve a solicitação.';
  end if;
  return new;
end $$;
revoke all on function public.avaliacoes_trava_pagamento() from public, anon, authenticated;
drop trigger if exists avaliacoes_a3_trava_pagamento on public.avaliacoes;
create trigger avaliacoes_a3_trava_pagamento before update on public.avaliacoes for each row execute function public.avaliacoes_trava_pagamento();

-- ---------- 2. visita paga: relato e fotos também travados ----------
create or replace function public.visitas_trava_pagamento() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.situacao is distinct from old.situacao or new.data_realizada is distinct from old.data_realizada or new.executor_id is distinct from old.executor_id
      or new.relato is distinct from old.relato or new.fotos is distinct from old.fotos)
     and exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                  where sv.visita_id = old.id and s.situacao in ('solicitada','avalizada','lancada')) then
    raise exception 'Esta visita já está numa solicitação de pagamento. Para mudar, a solicitação precisa ser devolvida pela coordenação.';
  end if;
  return new;
end $$;
revoke all on function public.visitas_trava_pagamento() from public, anon, authenticated;

-- ---------- 3 e 4. fotos do campo: prova não muda; agente só na pasta do estado da ficha ----------
create or replace function public.campo_arquivo_livre(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.meu_id() is not null   -- conta sem cadastro ativo: nada
     and not exists (select 1 from public.visitas v join public.solicitacao_visitas sv on sv.visita_id = v.id
                       join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                      where p_name = any (v.fotos) and s.situacao in ('solicitada', 'avalizada', 'lancada'))
     and not exists (select 1 from public.diagnosticos d where p_name = any (d.fotos) and d.situacao = 'aprovado')
     and not exists (select 1 from public.avaliacoes a join public.solicitacao_visitas sv on sv.visita_id = a.visita_id
                       join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                      where p_name = any (a.fotos) and s.situacao in ('solicitada', 'avalizada', 'lancada'))
$$;
create or replace function public.campo_pasta_agente(p_name text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.fichas f join public.visitas v on v.ficha_id = f.id
                  where f.id::text = (storage.foldername(p_name))[2] and f.uf::text = (storage.foldername(p_name))[1]
                    and v.executor_id = public.meu_id() and v.situacao <> 'cancelada')
$$;
revoke all on function public.campo_arquivo_livre(text), public.campo_pasta_agente(text) from public, anon;
grant execute on function public.campo_arquivo_livre(text), public.campo_pasta_agente(text) to authenticated;

drop policy if exists campo_enviar on storage.objects;
create policy campo_enviar on storage.objects for insert to authenticated with check (bucket_id = 'campo' and (
  ((select public.meu_papel()) in ('articulacao', 'apoio') and (storage.foldername(name))[1] = (select public.minha_uf()))
  or ((select public.meu_papel()) = 'agente' and public.campo_pasta_agente(name))));
drop policy if exists campo_trocar on storage.objects;
create policy campo_trocar on storage.objects for update to authenticated
  using (bucket_id = 'campo' and public.campo_arquivo_livre(name) and (
    ((select public.meu_papel()) in ('articulacao', 'apoio') and (storage.foldername(name))[1] = (select public.minha_uf()))
    or ((select public.meu_papel()) = 'agente' and public.campo_pasta_agente(name))))
  with check (bucket_id = 'campo' and public.campo_arquivo_livre(name) and (
    ((select public.meu_papel()) in ('articulacao', 'apoio') and (storage.foldername(name))[1] = (select public.minha_uf()))
    or ((select public.meu_papel()) = 'agente' and public.campo_pasta_agente(name))));

-- ---------- 5. dados pessoais da equipe: a técnica lê só de quem ela gerencia ----------
drop policy if exists privado_ler on public.equipe_privado;
create policy privado_ler on public.equipe_privado for select to authenticated using (
  equipe_id = (select public.meu_id())
  or (select public.meu_papel()) in ('coord_geral', 'auxiliar_adm')
  or ((select public.meu_papel()) = 'coord_tecnico' and public.pode_gerenciar((select e.papel from public.equipe e where e.id = equipe_privado.equipe_id))));

-- ---------- 6. plano de quintal já implantado continua aprovado ----------
create or replace function public.diagnosticos_implantado() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.situacao = 'aprovado' and new.situacao is distinct from 'aprovado'
     and exists (select 1 from public.visitas v where v.ficha_id = old.ficha_id and v.etapa = 'implantacao' and v.situacao = 'realizada') then
    if new.situacao = 'devolvido' then
      raise exception 'Este quintal já foi implantado com este plano: ele não volta para correção. Registre o que mudou no relato da próxima visita.';
    end if;
    -- correção do conteúdo pela coordenação geral: o plano segue aprovado (a implantação já foi feita com ele)
    new.situacao := 'aprovado'; new.aprovado_por := old.aprovado_por; new.aprovado_em := old.aprovado_em;
  end if;
  return new;
end $$;
revoke all on function public.diagnosticos_implantado() from public, anon, authenticated;
drop trigger if exists z_diagnosticos_implantado on public.diagnosticos;
create trigger z_diagnosticos_implantado before update on public.diagnosticos for each row execute function public.diagnosticos_implantado();

-- ---------- 7. ficha selecionada com visita agendada ----------
create or replace function public.fichas_resultado_com_visita() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.resultado = 'selecionada' and new.resultado is distinct from old.resultado
     and exists (select 1 from public.visitas v where v.ficha_id = old.id and v.situacao = 'prevista') then
    raise exception 'Esta mulher tem visita agendada. Cancele a visita no Campo antes de mudar o resultado da ficha.';
  end if;
  return new;
end $$;
revoke all on function public.fichas_resultado_com_visita() from public, anon, authenticated;
drop trigger if exists z_fichas_resultado_visita on public.fichas;
create trigger z_fichas_resultado_visita before update of resultado on public.fichas for each row execute function public.fichas_resultado_com_visita();

-- ---------- 8. histórico e acessos: a regra de leitura deixa o índice trabalhar ----------
drop policy if exists auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated using ((select (select public.meu_papel()) = 'coord_geral'));
drop policy if exists acessos_geral_ler on public.acessos;
create policy acessos_geral_ler on public.acessos for select to authenticated using ((select (select public.meu_papel()) = 'coord_geral'));
create index if not exists auditoria_em_id on public.auditoria (em desc, id desc);   -- página seguinte por (em, id): nada some nos empates

-- ---------- 9. vitrine pública: planos sem os quintais sem água; nada de ficha de exemplo ----------
create or replace function public.vitrine() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with ufs(uf) as (values ('AL'),('BA'),('PE'),('PI'),('SE')),
  ex as (select id from exemplo),
  fx as (select id, uf from fichas where id not in (select id from ex)),
  sel as (select uf, count(*) n from fichas where resultado = 'selecionada' and situacao = 'aprovada' and id not in (select id from ex) group by uf),
  fic as (select uf, count(*) n from fx group by uf),
  dg  as (select d.uf, count(*) n, count(*) filter (where d.situacao = 'aprovado' and not d.sem_agua) aprov
            from diagnosticos d where d.id not in (select id from ex) and d.ficha_id in (select id from fx) group by d.uf),
  imp as (select v.uf, count(*) n from visitas v where v.etapa = 'implantacao' and v.situacao = 'realizada' and v.id not in (select id from ex) and v.ficha_id in (select id from fx) group by v.uf),
  aco as (select v.uf, count(*) n from visitas v where v.etapa = 'acompanhamento' and v.situacao = 'realizada' and v.id not in (select id from ex) and v.ficha_id in (select id from fx) group by v.uf),
  eq  as (select count(*) filter (where papel in ('articulacao','apoio')) bolsistas,
                 count(*) filter (where papel = 'agente') agentes
            from equipe where status = 'ativa' and id not in (select id from ex)),
  por_uf as (
    select jsonb_agg(jsonb_build_object(
             'uf', u.uf,
             'fichas', coalesce(fic.n, 0),
             'selecionadas', coalesce(sel.n, 0),
             'diagnosticos', coalesce(dg.n, 0),
             'planos', coalesce(dg.aprov, 0),
             'implantados', coalesce(imp.n, 0),
             'acompanhamentos', coalesce(aco.n, 0)) order by u.uf) j
      from ufs u
      left join sel on sel.uf = u.uf left join fic on fic.uf = u.uf left join dg on dg.uf = u.uf
      left join imp on imp.uf = u.uf left join aco on aco.uf = u.uf),
  fotos as (
    select coalesce(jsonb_agg(jsonb_build_object('path', v.path, 'legenda', v.legenda, 'uf', v.uf)
                              order by v.publicada_em desc), '[]'::jsonb) j
      from (select vf.* from vitrine_fotos vf join fichas f on f.id = vf.ficha_id
             where f.consent_imagem and (f.consent_criancas or vf.sem_criancas) and f.id not in (select id from ex)
             order by vf.publicada_em desc limit 24) v)
  select jsonb_build_object(
    'atualizado_em', now(),
    'por_uf', (select j from por_uf),
    'equipe', (select to_jsonb(eq) from eq),
    'fotos', (select j from fotos));
$$;
revoke all on function public.vitrine() from public;
grant execute on function public.vitrine() to anon, authenticated;

-- ---------- 10. implantação e acompanhamento feitos têm foto ----------
create or replace function public.visitas_feita_com_foto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.situacao = 'realizada' and old.situacao is distinct from 'realizada' and new.etapa in ('implantacao', 'acompanhamento')
     and cardinality(coalesce(new.fotos, '{}'::text[])) < 1 then
    raise exception 'Para marcar a visita como feita, envie pelo menos uma foto do quintal.';
  end if;
  return new;
end $$;
revoke all on function public.visitas_feita_com_foto() from public, anon, authenticated;
drop trigger if exists z_visitas_feita_foto on public.visitas;
create trigger z_visitas_feita_foto before update on public.visitas for each row execute function public.visitas_feita_com_foto();

commit;

select 'Etapa 63 instalada: correções da auditoria de 14/10/2026' as resultado,
       exists (select 1 from pg_trigger where not tgisinternal and tgname = 'avaliacoes_a3_trava_pagamento') as avaliacao_paga,
       exists (select 1 from pg_proc where proname = 'campo_arquivo_livre') as fotos_prova,
       exists (select 1 from pg_trigger where not tgisinternal and tgname = 'z_diagnosticos_implantado') as plano_implantado,
       exists (select 1 from pg_trigger where not tgisinternal and tgname = 'z_visitas_feita_foto') as visita_com_foto;
