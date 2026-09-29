-- =====================================================================
-- Mulheres & Quintais — Etapa 15: coordenação geral com TODOS os acessos
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Rodar depois de 01 a 13. Pode rodar de novo sem estragar nada.
-- =====================================================================
-- Decisão da coordenação geral (28/09/2026): acesso total, sem exceção.
--   * Cadastra, edita, desliga e habilita qualquer pessoa (inclusive bolsistas e agentes).
--   * Aprova, devolve e corrige fichas e diagnósticos; agenda, reagenda e cancela visitas.
--   * Cria turmas e matricula no FIC; dá o aval e lança no Arlo qualquer pagamento.
--   * Lê e grava em todas as tabelas e pastas de arquivos do sistema.
-- O que continua valendo para TODOS, inclusive a coordenação geral:
--   * Tudo fica no histórico (auditoria), que ninguém consegue alterar pelo sistema.
--   * Regras de consistência: 40 selecionadas por estado, 200 dias de campo, datas no futuro, etc.
--   * Conta bancária: só pela consulta registrada no histórico (como já era).
-- =====================================================================

-- 1. Gerenciar pessoas: a coordenação geral gerencia todos os papéis (menos a própria vaga)
create or replace function public.pode_gerenciar(p_papel text) returns boolean
language sql stable as $$
  select case
    when public.meu_papel() = 'coord_geral' then coalesce(p_papel, '') <> 'coord_geral'
    when p_papel in ('articulacao','apoio','agente') then public.meu_papel() = 'coord_tecnico'
    else false
  end
$$;

-- 2. Cadastro da equipe: sem a trava "coordenação geral só altera a habilitação"
create or replace function public.equipe_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare so_hab text[] := array['docs_funcern_em','termo_path','termo_assinado_em','obs_habilitacao','atualizado_em'];
begin
  if tg_op = 'INSERT' then
    new.criado_por := public.meu_id();
    new.status := 'ativa'; new.data_fim := null; new.motivo_desligamento := null; new.user_id := null;
  else
    if new.papel is distinct from old.papel or new.uf is distinct from old.uf
       or new.cpf is distinct from old.cpf or new.criado_por is distinct from old.criado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.';
    end if;
    if old.status = 'desligada' and new.status = 'ativa' then
      raise exception 'Registro desligado não pode ser reativado. Faça um novo cadastro.';
    end if;
    if new.email is distinct from old.email then new.user_id := null; end if;
    -- (a coordenação geral altera qualquer dado de qualquer pessoa: etapa 15)
    if public.meu_papel() = 'auxiliar_adm' and auth.uid() is not null then
      if old.id = public.meu_id() then
        -- no próprio cadastro só mudam o vínculo do login e a foto (pelas funções do sistema)
        if (to_jsonb(new) - array['user_id','foto_path','atualizado_em']) is distinct from (to_jsonb(old) - array['user_id','foto_path','atualizado_em']) then
          raise exception 'A sua própria habilitação e os seus dados são registrados pela coordenação geral.';
        end if;
      elsif (to_jsonb(new) - so_hab) is distinct from (to_jsonb(old) - so_hab) then
        raise exception 'O auxiliar administrativo só registra o cadastro no Arlo e o termo. Dados pessoais são de quem cadastrou a pessoa.';
      end if;
    end if;
    if new.status = 'desligada' then new.user_id := null; end if;
    new.atualizado_em := now();
  end if;
  return new;
end $$;

-- 3. FIC: a coordenação geral também cria turmas e matricula
create or replace function public.pode_matricular(p_turma uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel(), '') in ('professor_fic','coord_geral') and exists (select 1 from public.turmas_fic t where t.id = p_turma);
$$;
drop policy if exists turmas_incluir on public.turmas_fic;
drop policy if exists turmas_alterar on public.turmas_fic;
create policy turmas_incluir on public.turmas_fic for insert to authenticated
  with check (public.meu_papel() in ('professor_fic','coord_geral'));
create policy turmas_alterar on public.turmas_fic for update to authenticated
  using (public.meu_papel() in ('professor_fic','coord_geral')) with check (public.meu_papel() in ('professor_fic','coord_geral'));

-- 4. Fichas: a coordenação geral corrige e decide
create or replace function public.fichas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare papel text := public.meu_papel();
declare aprovadas int;
begin
  new.atualizado_em := now();

  if tg_op = 'INSERT' then
    new.situacao := 'aguardando'; new.aprovada_por := null; new.aprovada_em := null; new.obs_coordenacao := null;
    if papel in ('articulacao','apoio') then new.bolsista_id := public.meu_id(); end if;
    new.criado_em := now();
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.criado_em <> old.criado_em or (new.bolsista_id is distinct from old.bolsista_id and papel is distinct from 'coord_geral') then
    raise exception 'Campos de controle não podem ser alterados.';
  end if;

  if papel in ('articulacao','apoio') then
    if old.situacao = 'aprovada' then
      raise exception 'Ficha já aprovada pela coordenação técnica. Para corrigir, peça que ela devolva a ficha.';
    end if;
    if new.uf <> old.uf then raise exception 'O estado da ficha não muda.'; end if;
    -- bolsista reenviando: volta para análise
    new.situacao := 'aguardando'; new.aprovada_por := old.aprovada_por; new.aprovada_em := old.aprovada_em;
    new.obs_coordenacao := old.obs_coordenacao;
  elsif papel = 'coord_tecnico' then
    -- coordenação técnica só decide: aprova ou devolve (não reescreve a ficha)
    -- (pontos é coluna calculada: no gatilho BEFORE ela ainda vem vazia em NEW)
    if (to_jsonb(new) - array['situacao','aprovada_por','aprovada_em','obs_coordenacao','atualizado_em','pontos'])
       is distinct from (to_jsonb(old) - array['situacao','aprovada_por','aprovada_em','obs_coordenacao','atualizado_em','pontos']) then
      raise exception 'A coordenação técnica aprova ou devolve a ficha; quem corrige os dados é a bolsista.';
    end if;
    if new.situacao = 'aprovada' and old.situacao <> 'aprovada' then
      new.aprovada_por := public.meu_id(); new.aprovada_em := now();
      if new.resultado = 'selecionada' then
        select count(*) into aprovadas from public.fichas
         where uf = new.uf and resultado = 'selecionada' and situacao = 'aprovada' and id <> new.id;
        if aprovadas >= 40 then
          raise exception 'O estado % já tem 40 selecionadas aprovadas. Esta mulher deve ir para a lista de espera.', new.uf;
        end if;
      end if;
    elsif new.situacao = 'devolvida' then
      if length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
        raise exception 'Para devolver, escreva o que a bolsista precisa corrigir.';
      end if;
      new.aprovada_por := null; new.aprovada_em := null;
    end if;
  elsif papel = 'coord_geral' then
    -- coordenação geral: corrige os dados e também decide (aprova ou devolve)
    if new.situacao = 'aprovada' and old.situacao <> 'aprovada' then
      new.aprovada_por := public.meu_id(); new.aprovada_em := now();
    end if;
    if new.situacao = 'aprovada' and new.resultado = 'selecionada' and not (old.situacao = 'aprovada' and old.resultado = 'selecionada' and old.uf = new.uf) then
      select count(*) into aprovadas from public.fichas
       where uf = new.uf and resultado = 'selecionada' and situacao = 'aprovada' and id <> new.id;
      if aprovadas >= 40 then
        raise exception 'O estado % já tem 40 selecionadas aprovadas. Esta mulher deve ir para a lista de espera.', new.uf;
      end if;
    end if;
    if new.situacao = 'devolvida' and old.situacao <> 'devolvida' then
      if length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
        raise exception 'Para devolver, escreva o que a bolsista precisa corrigir.';
      end if;
      new.aprovada_por := null; new.aprovada_em := null;
    end if;
  elsif papel is not null then
    raise exception 'Seu perfil não pode alterar fichas.';
  end if;
  return new;
end $$;

-- 5. Diagnósticos: idem
create or replace function public.diagnosticos_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.visitas; papel text := public.meu_papel();
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
  if tg_op = 'INSERT' then
    new.situacao := 'aguardando'; new.aprovado_por := null; new.aprovado_em := null; new.obs_coordenacao := null; new.criado_em := now();
    return new;
  end if;
  if papel = 'coord_tecnico' then
    if (to_jsonb(new) - array['situacao','aprovado_por','aprovado_em','obs_coordenacao','atualizado_em'])
       is distinct from (to_jsonb(old) - array['situacao','aprovado_por','aprovado_em','obs_coordenacao','atualizado_em']) then
      raise exception 'A coordenação técnica aprova ou devolve o plano; quem corrige é quem fez a visita.';
    end if;
    if new.situacao = 'aprovado' and old.situacao <> 'aprovado' then new.aprovado_por := public.meu_id(); new.aprovado_em := now(); end if;
    if new.situacao = 'devolvido' and length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
      raise exception 'Para devolver, escreva o que precisa ser corrigido.';
    end if;
  elsif papel in ('articulacao','apoio','agente') then
    if old.situacao = 'aprovado' then raise exception 'Plano já aprovado pela coordenação técnica. Peça que ela devolva para corrigir.'; end if;
    new.situacao := 'aguardando'; new.aprovado_por := old.aprovado_por; new.aprovado_em := old.aprovado_em; new.obs_coordenacao := old.obs_coordenacao;
  elsif papel = 'coord_geral' then
    -- coordenação geral: corrige e também decide
    if new.situacao = 'aprovado' and old.situacao <> 'aprovado' then new.aprovado_por := public.meu_id(); new.aprovado_em := now(); end if;
    if new.situacao = 'devolvido' and old.situacao <> 'devolvido' and length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
      raise exception 'Para devolver, escreva o que precisa ser corrigido.';
    end if;
  elsif papel is not null then
    raise exception 'Seu perfil não pode alterar diagnósticos.';
  end if;
  return new;
end $$;

-- 6. Avaliações: a coordenação geral também corrige
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
  if new.data_visita > current_date then raise exception 'A data da avaliação não pode ser no futuro.'; end if;
  if tg_op = 'INSERT' then new.criado_em := now();
  elsif papel is not null and papel not in ('articulacao','apoio','agente','coord_geral') then
    raise exception 'Quem corrige a avaliação é quem fez a visita ou a bolsista do estado.';
  end if;
  return new;
end $$;

-- 7. Todas as tabelas: leitura e gravação para a coordenação geral
do $$
declare t text;
begin
  foreach t in array array['fichas','visitas','diagnosticos','avaliacoes','custos_visita','vitrine_fotos','vitrine_remover','parametros',
    'apl_municipios','convites','pre_cadastros','equipe_privado','turmas_fic','solicitacoes_pagamento','solicitacao_visitas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists geral_tudo on public.%I', t);
      execute format('create policy geral_tudo on public.%I for all to authenticated using (public.meu_papel() = ''coord_geral'') with check (public.meu_papel() = ''coord_geral'')', t);
      -- pagamentos: gravar só pelas funções (12_pagamentos.sql); convites e pré-cadastros: criar só pelas funções (08)
      if t in ('solicitacoes_pagamento', 'solicitacao_visitas') then
        execute format('grant select on public.%I to authenticated', t);
      elsif t in ('convites', 'pre_cadastros') then
        execute format('grant select, update on public.%I to authenticated', t);
      else
        execute format('grant select, insert, update on public.%I to authenticated', t);
      end if;
    end if;
  end loop;
  -- na equipe, menos a própria vaga (ninguém se desliga sem querer)
  drop policy if exists geral_tudo on public.equipe;
  create policy geral_tudo on public.equipe for all to authenticated
    using (public.meu_papel() = 'coord_geral' and papel <> 'coord_geral') with check (public.meu_papel() = 'coord_geral' and papel <> 'coord_geral');
end $$;

-- 8. Arquivos (fotos, fichas digitalizadas, termos): a coordenação geral lê e envia em todas as pastas
drop policy if exists geral_arquivos_ler on storage.objects;
drop policy if exists geral_arquivos_enviar on storage.objects;
drop policy if exists geral_arquivos_trocar on storage.objects;
create policy geral_arquivos_ler on storage.objects for select to authenticated
  using (bucket_id in ('fichas','campo','equipe','termos','vitrine') and public.meu_papel() = 'coord_geral');
create policy geral_arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id in ('fichas','campo','equipe','termos','vitrine') and public.meu_papel() = 'coord_geral');
create policy geral_arquivos_trocar on storage.objects for update to authenticated
  using (bucket_id in ('fichas','campo','equipe','termos','vitrine') and public.meu_papel() = 'coord_geral')
  with check (bucket_id in ('fichas','campo','equipe','termos','vitrine') and public.meu_papel() = 'coord_geral');

select 'Etapa 15 instalada: coordenação geral com todos os acessos' as resultado;
