-- =====================================================================
-- Mulheres & Quintais — 42: REVISÃO DE SEGURANÇA E CONSISTÊNCIA (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 41. NÃO APAGA NENHUM DADO e não muda nenhum registro que já existe:
-- só acrescenta travas para os próximos registros.
--
--  1. Fuso do banco: "hoje" passa a ser o dia de Fortaleza (antes, depois das 21h o banco já achava que era amanhã).
--  2. Visita de diagnóstico ou avaliação só vira "realizada" com o formulário preenchido; data nunca no futuro.
--  3. Diagnóstico e avaliação: ao corrigir, mulher, estado e quem fez a visita não mudam; data da visita não pode ser futura.
--  4. Kit do quintal: o banco confere o teto de R$ 5.000 (antes só a tela conferia).
--  5. Ninguém troca o login (user_id) de um cadastro pela tela: só o código de primeiro acesso liga uma conta.
--  6. Limites com trava: 40 selecionadas por estado, 200 dias de campo e 2 acompanhamentos não estouram
--     quando duas pessoas gravam ao mesmo tempo (celulares sincronizando).
--  7. Pedido de passagem/evento devolvido ou reenviado perde o valor autorizado antigo (o teto conta o valor certo).
--  8. Aval de pagamento: valor maior que zero; na bolsa, nunca maior que o pedido (para pagar mais, devolva para corrigir).
--  9. Ninguém apaga registros pela tela (nem a coordenação geral): fichas, visitas, equipe, pagamentos, pedidos...
-- 10. Funções internas fechadas também para quem não entrou (anon), como já era para "public".
-- =====================================================================
begin;

-- 1. fuso -------------------------------------------------------------
do $$ begin execute format('alter database %I set timezone to %L', current_database(), 'America/Fortaleza'); end $$;
set timezone to 'America/Fortaleza';

-- valor em reais no padrão brasileiro (o to_char do servidor usa ponto e vírgula trocados)
create or replace function public.brl(v numeric) returns text language sql immutable as $$
  select 'R$ ' || translate(to_char(coalesce(v, 0), 'FM999,999,990.00'), ',.', '.,')
$$;

-- número dentro de um texto, como a tela lê: "2,5" → 2.5 · "1.000" → 1000 · "12.50" → 12.5 · "10 kg" → 10
create or replace function public.num_br(t text) returns numeric language plpgsql immutable as $$
declare s text := regexp_replace(coalesce(t, ''), '[^0-9.,-]', '', 'g');
begin
  if s = '' then return null; end if;
  if position(',' in s) > 0 and position('.' in s) > 0 then
    if strpos(reverse(s), ',') < strpos(reverse(s), '.') then s := replace(replace(s, '.', ''), ',', '.'); else s := replace(s, ',', ''); end if;
  elsif position(',' in s) > 0 then s := replace(replace(s, '.', ''), ',', '.');
  elsif s ~ '^-?[0-9]{1,3}(\.[0-9]{3})+$' then s := replace(s, '.', '');
  end if;
  if s !~ '^-?[0-9]+(\.[0-9]+)?$' then s := substring(s from '[0-9]+(?:\.[0-9]+)?'); end if;   -- "10-20" → 10
  return s::numeric;
end $$;

-- 2. visita de diagnóstico/avaliação: só com o formulário ---------------
create or replace function public.visitas_feita() returns trigger
language plpgsql as $$
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
  end if;
  return new;
end $$;

-- 3 e 4. diagnóstico e avaliação ------------------------------------------
create or replace function public.campo_formulario_fixos() returns trigger
language plpgsql as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date; tot numeric := 0; it jsonb; q numeric; v numeric;
begin
  if tg_op = 'UPDATE' and new.visita_id = old.visita_id then
    new.ficha_id := old.ficha_id; new.uf := old.uf; new.executor_id := old.executor_id;   -- ninguém muda por baixo
  end if;
  if new.data_visita > hoje and (tg_op = 'INSERT' or new.data_visita is distinct from old.data_visita) then
    raise exception 'A data da visita não pode ser no futuro.';
  end if;
  -- kit: só o diagnóstico tem (a avaliação não tem a coluna sem_agua: o teste fica num bloco separado)
  if tg_table_name = 'diagnosticos' then
    if not coalesce(new.sem_agua, false) and (tg_op = 'INSERT' or new.dados is distinct from old.dados) and jsonb_typeof(new.dados -> 'kit') = 'array' then
      for it in select * from jsonb_array_elements(new.dados -> 'kit') loop
        q := public.num_br(it ->> 'qtd');
        begin v := nullif(it ->> 'valor', '')::numeric; exception when others then v := null; end;
        tot := tot + coalesce(q, 0) * coalesce(v, 0);
      end loop;
      if tot > 5000 then
        raise exception 'O kit passa do valor por quintal (%, o teto é R$ 5.000,00). Tire ou troque itens.', public.brl(tot);
      end if;
    end if;
  end if;
  return new;
end $$;
-- "a0_" no nome: roda ANTES de diagnosticos_antes (os gatilhos rodam em ordem alfabética), para a regra de conteúdo já ver os campos travados
drop trigger if exists diagnosticos_fixos on public.diagnosticos;
drop trigger if exists diagnosticos_a0_fixos on public.diagnosticos;
create trigger diagnosticos_a0_fixos before insert or update on public.diagnosticos for each row execute function public.campo_formulario_fixos();
do $$ begin
  if to_regclass('public.avaliacoes') is not null then
    drop trigger if exists avaliacoes_fixos on public.avaliacoes;
    drop trigger if exists avaliacoes_a0_fixos on public.avaliacoes;
    create trigger avaliacoes_a0_fixos before insert or update on public.avaliacoes for each row execute function public.campo_formulario_fixos();
  end if;
end $$;

-- 5. login de um cadastro --------------------------------------------------
create or replace function public.equipe_login_fixo() returns trigger
language plpgsql as $$
begin
  -- desligar zera o login (pode); ligar uma conta só pelo código de primeiro acesso (sem usuário logado)
  if new.user_id is not null and new.user_id is distinct from old.user_id and auth.uid() is not null then
    raise exception 'O login de um cadastro não se troca pela tela. Gere um novo código de primeiro acesso.';
  end if;
  return new;
end $$;
drop trigger if exists equipe_login_fixo on public.equipe;
create trigger equipe_login_fixo before update of user_id on public.equipe for each row execute function public.equipe_login_fixo();

-- 6. travas dos limites (o nome "a0_" faz rodar antes das regras de cada tabela) ----
create or replace function public.trava_limite_uf() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text := new.uf;
begin
  -- a tela não manda o estado ao agendar a visita (o banco preenche depois): pega da ficha
  if tg_table_name = 'visitas' then select f.uf into u from public.fichas f where f.id = new.ficha_id; end if;
  if u is not null then perform pg_advisory_xact_lock(hashtext('limite_' || tg_table_name || '_' || u)); end if;
  return new;
end $$;
drop trigger if exists a0_trava_limite on public.fichas;
create trigger a0_trava_limite before update of resultado, situacao, uf on public.fichas for each row
  when (new.resultado = 'selecionada' and new.situacao = 'aprovada') execute function public.trava_limite_uf();
drop trigger if exists a0_trava_limite on public.visitas;
create trigger a0_trava_limite before insert on public.visitas for each row execute function public.trava_limite_uf();

-- 7. valor autorizado velho -------------------------------------------------
do $$ begin
  if to_regclass('public.pedidos_apoio') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_apoio' and column_name = 'valor_autorizado') then
    execute $f$
      create or replace function public.pedidos_apoio_zera_valor() returns trigger
      language plpgsql as $b$
      begin
        if new.situacao in ('devolvido', 'enviado') and new.situacao is distinct from old.situacao then new.valor_autorizado := null; end if;
        return new;
      end $b$;
    $f$;
    drop trigger if exists pedidos_apoio_a0_zera on public.pedidos_apoio;
    create trigger pedidos_apoio_a0_zera before update on public.pedidos_apoio for each row execute function public.pedidos_apoio_zera_valor();
  end if;
end $$;

-- 8. aval de pagamento -------------------------------------------------------
create or replace function public.solic_valor_aval() returns trigger
language plpgsql as $$
begin
  if new.situacao = 'avalizada' and old.situacao is distinct from 'avalizada' then
    if new.valor_avalizado is null or new.valor_avalizado <= 0 then
      raise exception 'Informe o valor do aval (maior que zero).';
    end if;
    -- bolsa tem valor fixo: o aval não passa do pedido. Ajuda de custo pode subir quando a coordenação confere o km (Custos > Pagamento do mês).
    if new.tipo = 'bolsa' and old.valor_solicitado is not null and new.valor_avalizado > old.valor_solicitado then
      raise exception 'O aval (%) passa do valor pedido (%). Para pagar mais, devolva para a pessoa corrigir o valor.',
        public.brl(new.valor_avalizado), public.brl(old.valor_solicitado);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists solic_valor_aval on public.solicitacoes_pagamento;
create trigger solic_valor_aval before update on public.solicitacoes_pagamento for each row execute function public.solic_valor_aval();

-- 9. ninguém apaga pela tela (as funções do sistema continuam podendo) ------
do $$ declare t text; begin
  foreach t in array array['fichas','visitas','diagnosticos','avaliacoes','equipe','equipe_privado','turmas_fic','matriculas_fic',
    'apl_municipios','parametros','solicitacoes_pagamento','pedidos_apoio','documentos_projeto','fic_encontros','fic_presencas',
    'agua_situacoes','execucao_planilhas','auditoria','acesso_codigos','pre_cadastros','pedidos_novo_acesso'] loop
    if to_regclass('public.' || t) is not null then execute format('revoke delete, truncate on public.%I from anon, authenticated', t); end if;
  end loop;
end $$;

-- 10. funções internas fechadas para anon -----------------------------------
do $$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p where p.pronamespace = 'public'::regnamespace
             and p.proname in ('definir_minha_foto','criar_convite','matricular_fic','cancelar_matricula_fic','equipe_para_fic',
                               'pode_matricular','gerar_codigo_acesso','avalizar_pagamento','registrar_no_arlo','mover_pedido_apoio',
                               'salvar_pedido_apoio','definir_valor_pedido','registrar_encontro_fic','cancelar_encontro_fic',
                               'confirmar_presenca_fic','registrar_situacao_agua','pendencias_campo','situacao_bancaria','vincular_conta') loop
    execute format('revoke execute on function %s from anon, public', r.f);
    execute format('grant execute on function %s to authenticated', r.f);
  end loop;
end $$;

commit;

select 'Revisão de segurança instalada' as resultado,
       current_setting('timezone') as fuso_desta_conexao,
       exists (select 1 from pg_trigger where tgname = 'diagnosticos_a0_fixos') as diagnostico_travado,
       exists (select 1 from pg_trigger where tgname = 'equipe_login_fixo') as login_travado,
       not has_table_privilege('authenticated', 'public.fichas', 'DELETE') as sem_apagar;
