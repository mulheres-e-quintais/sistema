-- =====================================================================
-- Mulheres & Quintais — 31: VALIDAÇÃO DO DIAGNÓSTICO (decisão da coordenação geral, 29/09/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 03 e do 15. Se algum dia rodar o 03 ou o 15 de novo, rode este depois.
--
-- 1) Quem alterou não aprova.
--    O sistema guarda quem mexeu por último no conteúdo do diagnóstico (conteudo_alterado_por).
--    A coordenação geral continua podendo corrigir, mas:
--      - não aprova um diagnóstico que ela mesma alterou (quem aprova é a coordenação técnica);
--      - se ela alterar um plano já aprovado, ele volta para "em análise";
--      - sem técnica ativa, ela devolve para quem aplicou corrigir, e aí pode aprovar.
-- 2) Localização de verdade.
--    - Sem GPS, a explicação precisa ter pelo menos 15 letras (antes eram 5).
--    - Diagnóstico sem localização só é aprovado com uma observação NOVA da coordenação
--      (pelo menos 10 letras) dizendo como ela confirmou que a visita aconteceu.
-- =====================================================================
begin;

alter table public.diagnosticos add column if not exists conteudo_alterado_por uuid references public.equipe(id);
alter table public.diagnosticos add column if not exists conteudo_alterado_em timestamptz;

create or replace function public.diagnosticos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.visitas; papel text := public.meu_papel(); eu uuid := public.meu_id();
        decisao constant text[] := array['situacao','aprovado_por','aprovado_em','obs_coordenacao','atualizado_em','conteudo_alterado_por','conteudo_alterado_em'];
        mudou boolean;
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.visita_id <> old.visita_id then
    select * into v from public.visitas where id = new.visita_id;
    if v.id is null or v.etapa <> 'diagnostico' or v.ficha_id <> new.ficha_id then
      raise exception 'O diagnóstico precisa estar ligado à visita de diagnóstico desta mulher.';
    end if;
    if v.situacao = 'cancelada' then raise exception 'A visita de diagnóstico foi cancelada.'; end if;
    new.uf := v.uf; new.executor_id := v.executor_id;
  end if;
  mudou := tg_op = 'INSERT' or (to_jsonb(new) - decisao) is distinct from (to_jsonb(old) - decisao);
  if mudou then
    -- sem GPS: explicação de verdade (vale para quem registra e para quem corrige)
    if new.latitude is null and length(trim(coalesce(new.sem_gps_motivo, ''))) < 15 then
      raise exception 'Sem localização: explique em pelo menos 15 letras por que não foi possível registrar no quintal.';
    end if;
    new.conteudo_alterado_por := eu; new.conteudo_alterado_em := now();
  elsif tg_op = 'UPDATE' then
    new.conteudo_alterado_por := old.conteudo_alterado_por; new.conteudo_alterado_em := old.conteudo_alterado_em;   -- ninguém forja
  end if;
  if tg_op = 'INSERT' then
    new.situacao := 'aguardando'; new.aprovado_por := null; new.aprovado_em := null; new.obs_coordenacao := null; new.criado_em := now();
    return new;
  end if;

  -- aprovar sem localização: a coordenação diz, com palavras novas, como confirmou a visita
  if new.situacao = 'aprovado' and old.situacao <> 'aprovado' and new.latitude is null and not new.sem_agua
     and (length(trim(coalesce(new.obs_coordenacao, ''))) < 10 or new.obs_coordenacao is not distinct from old.obs_coordenacao) then
    raise exception 'Diagnóstico sem localização: para aprovar, escreva na observação como você confirmou que a visita aconteceu.';
  end if;

  if papel = 'coord_tecnico' then
    if mudou then raise exception 'A coordenação técnica aprova ou devolve o plano; quem corrige é quem fez a visita.'; end if;
    if new.situacao = 'aprovado' and old.situacao <> 'aprovado' then new.aprovado_por := eu; new.aprovado_em := now(); end if;
    if new.situacao = 'devolvido' and length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
      raise exception 'Para devolver, escreva o que precisa ser corrigido.';
    end if;
  elsif papel in ('articulacao','apoio','agente') then
    if old.situacao = 'aprovado' then raise exception 'Plano já aprovado pela coordenação técnica. Peça que ela devolva para corrigir.'; end if;
    new.situacao := 'aguardando'; new.aprovado_por := old.aprovado_por; new.aprovado_em := old.aprovado_em; new.obs_coordenacao := old.obs_coordenacao;
  elsif papel = 'coord_geral' then
    -- corrige e decide, mas nunca as duas coisas no mesmo diagnóstico
    if mudou and new.situacao = 'aprovado' and old.situacao <> 'aprovado' then
      raise exception 'Você alterou este diagnóstico: quem aprova é a coordenação técnica. Sem técnica, devolva para quem aplicou corrigir.';
    end if;
    if mudou and old.situacao = 'aprovado' and new.situacao = 'aprovado' then
      new.situacao := 'aguardando';   -- plano aprovado alterado volta para análise
    end if;
    if new.situacao = 'aprovado' and old.situacao <> 'aprovado' and old.conteudo_alterado_por = eu then
      raise exception 'Você alterou este diagnóstico: quem aprova é a coordenação técnica. Sem técnica, devolva para quem aplicou corrigir.';
    end if;
    if new.situacao = 'aprovado' and old.situacao <> 'aprovado' then new.aprovado_por := eu; new.aprovado_em := now(); end if;
    if new.situacao = 'devolvido' and old.situacao <> 'devolvido' and length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
      raise exception 'Para devolver, escreva o que precisa ser corrigido.';
    end if;
  elsif papel is not null then
    raise exception 'Seu perfil não pode alterar diagnósticos.';
  end if;
  return new;
end $$;

commit;

select 'Validação do diagnóstico instalada' as resultado,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'diagnosticos' and column_name = 'conteudo_alterado_por') as coluna;
