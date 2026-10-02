-- =====================================================================
-- Mulheres & Quintais — 45: CORREÇÕES DA AUDITORIA DE QUALIDADE (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 44. NÃO APAGA NENHUM DADO e não muda nenhum registro que já existe:
-- só fecha brechas e acrescenta conferências para os próximos registros.
--
--  1. CRÍTICO: conta que entrou no sistema mas não tem cadastro ativo (ou foi desligada) não gera mais
--     código de acesso de ninguém, não cancela pedido, não vê pendências, saldo de passagens nem quem confere.
--  2. Valores de pagamento, municípios do APL e fotos da equipe: só lê quem tem cadastro ativo.
--     O próprio cadastro só é lido enquanto está ativo.
--  3. Visita já feita não muda mais (quem fez, datas, situação, relato vazio): só a coordenação corrige,
--     e a correção fica no histórico. Data da visita feita nunca no futuro.
--  4. Visita de diagnóstico ou avaliação que já tem o formulário registrado não pode ser cancelada.
--  5. Kit do quintal: o teto de R$ 5.000,00 não se burla mais com quantidade vazia ou negativa, valor negativo,
--     valor escrito como texto ("9.000,00") ou lista em outro formato; é conferido de novo a cada alteração.
--  6. Pagamentos: valor sempre maior que zero; bolsa até R$ 10.000,00; ajuda de custo até R$ 2.000,00 por visita
--     (no pedido, no aval e no lançamento no Arlo). Quem aprova o quê NÃO mudou.
--  7. Ficha: data da ficha de 01/01/2026 até hoje; nascimento de 1901 até hoje; CPF de dígitos repetidos recusado.
--  8. Quem aprovou e quando (ficha e diagnóstico): só o banco grava, na hora da aprovação. Ao devolver, limpa.
--  9. Mensagens de valor no padrão brasileiro (R$ 70.000,00) também nos tetos de passagens e eventos.
-- 10. Datas absurdas recusadas: início na equipe, passos da habilitação, desligamento e data prevista de visita.
-- =====================================================================
begin;

-- 9. valor em reais no padrão brasileiro, também para valores muito grandes ------------------
create or replace function public.brl(v numeric) returns text language sql immutable as $$
  select 'R$ ' || case
    when v is null then '0,00'
    when v::text in ('NaN', 'Infinity', '-Infinity') then v::text
    when abs(v) >= 1e18 then replace(round(v, 2)::text, '.', ',')
    else translate(to_char(v, 'FM999,999,999,999,999,990.00'), ',.', '.,') end
$$;

-- 1. conta sem cadastro ativo ------------------------------------------------------------
-- (meu_papel(), meu_id() e minha_uf() devolvem vazio para quem não tem cadastro ativo: toda comparação com eles
--  precisa tratar o vazio, senão a regra "não dispara" e a conta passa)
create or replace function public.pode_gerenciar(p_papel text) returns boolean
language sql stable as $$
  select coalesce(case
    when public.meu_papel() = 'coord_geral' then coalesce(p_papel, '') <> 'coord_geral'
    when p_papel in ('articulacao','apoio','agente') then public.meu_papel() = 'coord_tecnico'
    else false
  end, false)
$$;

create or replace function public.gerar_codigo_acesso(p_equipe uuid) returns text
language plpgsql security definer set search_path = public as $$
declare m public.equipe; c text;
begin
  if public.meu_id() is null then raise exception 'Você não pode gerar o acesso desta pessoa.'; end if;
  select * into m from public.equipe where id = p_equipe;
  if m.id is null or m.status <> 'ativa' then raise exception 'Cadastro não encontrado ou desligado.'; end if;
  if not coalesce(public.pode_gerenciar(m.papel), false) then raise exception 'Você não pode gerar o acesso desta pessoa.'; end if;
  if m.user_id is not null then
    if coalesce(public.meu_papel(), '') <> 'coord_geral' then raise exception 'Esta pessoa já tem senha. Só a coordenação geral libera um novo primeiro acesso.'; end if;
    update public.equipe set user_id = null where id = m.id;
    delete from auth.users where id = m.user_id;
  end if;
  c := public.novo_codigo_acesso(m.id, public.meu_id());
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('acesso_codigos', m.id, case when m.user_id is null then 'CODIGO' else 'NOVO_ACESSO' end, public.meu_id(),
          null, jsonb_build_object('expira_em', now() + interval '7 days', 'senha_anterior_apagada', m.user_id is not null));
  return c;
end $$;

-- pendências de campo: só da própria pessoa, ou a coordenação (o banco, por dentro, continua vendo ao desligar alguém)
create or replace function public.pendencias_campo(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'visitas', (select count(*) from public.visitas where executor_id = p_id and situacao = 'prevista'),
    'diagnosticos', case when to_regclass('public.diagnosticos') is null then 0
                         else (select count(*) from public.diagnosticos where executor_id = p_id and situacao = 'devolvido') end)
   where auth.uid() is null or p_id = public.meu_id() or coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico');
$$;

-- as três abaixo respondem só a quem tem cadastro ativo (auth.uid() vazio = o próprio banco ou o SQL Editor)
create or replace function public.saldo_passagens_eventos() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'passagem_teto', 70000,
    'passagem_usado', (select coalesce(sum(valor_autorizado), 0) from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado'),
    'evento_teto', 6000,
    'evento_usado', coalesce((select jsonb_object_agg(uf, s) from (select uf, sum(valor_autorizado) s from public.pedidos_apoio
                              where tipo = 'evento' and situacao = 'autorizado' group by uf) x), '{}'::jsonb))
   where auth.uid() is null or public.meu_id() is not null
$$;

create or replace function public.quem_confere_pedidos() returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null and public.meu_id() is null then null
    when exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then 'coord_tecnico'
    when exists (select 1 from public.equipe where papel = 'auxiliar_adm' and status = 'ativa') then 'auxiliar_adm'
    else 'coord_geral' end
$$;

create or replace function public.tem_professor_fic_habilitado() returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or public.meu_id() is not null)
     and exists (select 1 from public.equipe where papel = 'professor_fic' and status = 'ativa'
                   and docs_funcern_em is not null and termo_assinado_em is not null)
$$;

-- pedido de passagem/evento: sem cadastro ativo não mexe em nada; "só quem pediu cancela" vale também para o vazio
do $$ begin
  if to_regclass('public.pedidos_apoio') is not null then
    execute $f$
create or replace function public.mover_pedido_apoio(p_id uuid, p_acao text, p_obs text, p_protocolo text) returns void
language plpgsql security definer set search_path = public as $b$
declare p public.pedidos_apoio; papel text := coalesce(public.meu_papel(), ''); eu uuid := public.meu_id(); v_obs text := nullif(trim(p_obs), '');
        conferente text := public.quem_confere_pedidos(); nome_conf text;
begin
  if eu is null or conferente is null then raise exception 'Entre no sistema com um cadastro ativo para mexer em pedidos.'; end if;
  nome_conf := case conferente when 'coord_tecnico' then 'a coordenação técnica' when 'auxiliar_adm' then 'o auxiliar administrativo' else 'a coordenação geral' end;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
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
    $f$;
  end if;
end $$;

-- confirmar presença no FIC: sem cadastro ativo nem chega a segurar o encontro
create or replace function public.confirmar_presenca_fic(p_encontro uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int; e public.fic_encontros;
begin
  if public.meu_id() is null then raise exception 'Não há presença sua para confirmar neste encontro (ou já está confirmada).'; end if;
  select * into e from public.fic_encontros where id = p_encontro for update;   -- fila com a edição do professor
  if e.id is null or e.cancelado_em is not null then raise exception 'Este encontro não está disponível para confirmar (foi cancelado?).'; end if;
  update public.fic_presencas set confirmado_em = now()
   where encontro_id = p_encontro and equipe_id = public.meu_id() and presente and confirmado_em is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Não há presença sua para confirmar neste encontro (ou já está confirmada).'; end if;
end $$;

-- 2. leituras abertas demais ----------------------------------------------------------------
drop policy if exists parametros_ler on public.parametros;
create policy parametros_ler on public.parametros for select to authenticated using (public.meu_papel() is not null);
drop policy if exists apl_ler on public.apl_municipios;
create policy apl_ler on public.apl_municipios for select to authenticated using (public.meu_papel() is not null);
drop policy if exists equipe_ler on public.equipe;
create policy equipe_ler on public.equipe for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico','auxiliar_adm') or (user_id = auth.uid() and status = 'ativa'));
-- fotos da equipe: só quem tem cadastro ativo (antes, qualquer conta que entrasse)
drop policy if exists equipe_foto_ler on storage.objects;
create policy equipe_foto_ler on storage.objects for select to authenticated using (bucket_id = 'equipe' and public.meu_papel() is not null);

-- 3, 4 e 10. visitas ---------------------------------------------------------------------------
create or replace function public.visitas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare f public.fichas; ex public.equipe; papel text := public.meu_papel(); n int;
        hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  new.atualizado_em := now();
  -- 45: datas (só ao agendar ou quando a data muda: visita antiga não trava)
  if (new.data_prevista < date '2026-01-01' or new.data_prevista > date '2027-12-31')
     and ((tg_op = 'UPDATE' and new.data_prevista is distinct from old.data_prevista)
          or (tg_op = 'INSERT' and not exists (select 1 from public.visitas x where x.id = new.id and x.data_prevista = new.data_prevista))) then
    raise exception 'A data prevista da visita precisa ficar entre 01/01/2026 e 31/12/2027.';
  end if;
  if new.data_realizada > hoje then raise exception 'A data em que a visita foi feita não pode ser no futuro.'; end if;
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
    if new.etapa <> 'diagnostico' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'diagnostico' and situacao = 'realizada') then
      raise exception 'Primeiro o diagnóstico: implantação, acompanhamento e avaliação só depois dele.';
    end if;
    if new.etapa = 'avaliacao' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'implantacao' and situacao = 'realizada') then
      raise exception 'A avaliação é feita depois da implantação do quintal.';
    end if;
    select count(*) into n from public.visitas where uf = new.uf and situacao <> 'cancelada';
    if n >= 200 then raise exception 'O estado % já usou os 200 dias de campo previstos (40 quintais × 5 visitas).', new.uf; end if;
  end if;
  return new;
end $$;

-- 5. kit do quintal ---------------------------------------------------------------------------------
create or replace function public.campo_formulario_fixos() returns trigger
language plpgsql as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date; tot numeric := 0; it jsonb; q numeric; v numeric; kit jsonb;
begin
  if tg_op = 'UPDATE' and new.visita_id = old.visita_id then
    new.ficha_id := old.ficha_id; new.uf := old.uf; new.executor_id := old.executor_id;   -- ninguém muda por baixo
  end if;
  if new.data_visita > hoje and (tg_op = 'INSERT' or new.data_visita is distinct from old.data_visita) then
    raise exception 'A data da visita não pode ser no futuro.';
  end if;
  -- kit: só o diagnóstico tem (a avaliação não tem a coluna sem_agua: o teste fica num bloco separado)
  if tg_table_name = 'diagnosticos' then
    kit := new.dados -> 'kit';
    -- só confere o kit quando ele é gravado ou muda (ou quando "sem água" deixa de valer): aprovar ou devolver um
    -- diagnóstico antigo, com kit preenchido do jeito que a tela aceitava antes, continua funcionando
    if not (tg_op = 'INSERT' or new.dados -> 'kit' is distinct from old.dados -> 'kit'
            or (coalesce(old.sem_agua, false) and not coalesce(new.sem_agua, false))) then
      -- kit não mudou. Ao APROVAR, o teto ainda vale (leitura tolerante: o que não der para ler não conta)
      if new.situacao = 'aprovado' and old.situacao is distinct from 'aprovado' and not coalesce(new.sem_agua, false) and jsonb_typeof(kit) = 'array' then
        for it in select * from jsonb_array_elements(kit) loop
          begin
            q := case when jsonb_typeof(it -> 'qtd') = 'number' then (it ->> 'qtd')::numeric else public.num_br(it ->> 'qtd') end;
            v := case when jsonb_typeof(it -> 'valor') = 'number' then (it ->> 'valor')::numeric else public.num_br(it ->> 'valor') end;
            tot := tot + greatest(coalesce(q, 0), 0) * greatest(coalesce(v, 0), 0);
          exception when others then null;
          end;
        end loop;
        if round(tot, 2) > 5000 then
          raise exception 'O kit passa do valor por quintal (%, o teto é R$ 5.000,00). Devolva o diagnóstico para corrigir a lista.', public.brl(round(tot, 2));
        end if;
      end if;
      return new;
    end if;
    if kit is not null and jsonb_typeof(kit) not in ('array', 'null') then
      raise exception 'A lista do kit veio num formato que o sistema não entende. Abra o diagnóstico e monte o kit de novo.';
    end if;
    -- confere sempre que o diagnóstico é gravado (também quando só muda "sem água" ou a situação)
    if not coalesce(new.sem_agua, false) and jsonb_typeof(kit) = 'array' then
      for it in select * from jsonb_array_elements(kit) loop
        if jsonb_typeof(it) <> 'object' then
          raise exception 'A lista do kit veio num formato que o sistema não entende. Abra o diagnóstico e monte o kit de novo.';
        end if;
        begin
          q := case when jsonb_typeof(it -> 'qtd') = 'number' then (it ->> 'qtd')::numeric else public.num_br(it ->> 'qtd') end;
          v := case when jsonb_typeof(it -> 'valor') = 'number' then (it ->> 'valor')::numeric else public.num_br(it ->> 'valor') end;
        exception when others then
          raise exception 'Kit: quantidade ou valor que o sistema não conseguiu ler no item "%". Confira os números.', left(coalesce(it ->> 'item', ''), 60);
        end;
        if v is null and trim(coalesce(it ->> 'valor', '')) <> '' then
          raise exception 'Kit: o valor do item "%" não é um número. Confira.', left(coalesce(it ->> 'item', ''), 60);
        end if;
        if v < 0 then raise exception 'Kit: o valor do item "%" não pode ser negativo.', left(coalesce(it ->> 'item', ''), 60); end if;
        if q < 0 then raise exception 'Kit: a quantidade do item "%" não pode ser negativa.', left(coalesce(it ->> 'item', ''), 60); end if;
        if v > 0 and coalesce(q, 0) <= 0 then
          raise exception 'Kit: informe a quantidade (maior que zero) do item "%".', left(coalesce(it ->> 'item', ''), 60);
        end if;
        tot := tot + coalesce(q, 0) * coalesce(v, 0);
      end loop;
      -- compara o valor como aparece na tela (centavos): 5.000,0001 é R$ 5.000,00 e cabe
      if round(tot, 2) > 5000 then
        raise exception 'O kit passa do valor por quintal (%, o teto é R$ 5.000,00). Tire ou troque itens.', public.brl(round(tot, 2));
      end if;
    end if;
  end if;
  return new;
end $$;

-- 6. pagamentos -------------------------------------------------------------------------------------
create or replace function public.solicitar_pagamento(p_tipo text, p_mes date, p_valor numeric, p_relatorio text, p_visitas uuid[], p_detalhe jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare eu public.equipe; v_mes date := date_trunc('month', p_mes)::date; s public.solicitacoes_pagamento; v_id uuid; n int; ruins int;
begin
  select * into eu from public.equipe where id = public.meu_id();
  if eu.id is null or eu.status <> 'ativa' then raise exception 'Entre no sistema para solicitar.'; end if;
  if p_tipo = 'ajuda_custo' and eu.papel not in ('articulacao','apoio','agente') then
    raise exception 'Ajuda de custo é só para bolsistas e agentes de campo que fazem visitas.';
  end if;
  if p_tipo = 'bolsa' and eu.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm') then
    raise exception 'Seu perfil não recebe bolsa mensal pelo projeto.';
  end if;
  if not public.habilitado(eu) then raise exception 'Sua habilitação ainda não está completa: sem ela não há pagamento.'; end if;
  if v_mes > date_trunc('month', current_date)::date then raise exception 'Só dá para solicitar o mês atual ou meses anteriores.'; end if;
  -- 32: nada antes do mês em que a pessoa começou no projeto (início da bolsa, data do cadastro)
  if eu.data_inicio is not null and v_mes < date_trunc('month', eu.data_inicio)::date then
    raise exception 'Você começou no projeto em %: só dá para solicitar a partir desse mês.', to_char(eu.data_inicio, 'MM/YYYY');
  end if;
  select * into s from public.solicitacoes_pagamento where tipo = p_tipo and equipe_id = eu.id and mes = v_mes for update;
  if s.id is not null and s.situacao <> 'devolvida' then raise exception 'Você já solicitou este mês. Acompanhe a situação na lista.'; end if;

  if p_tipo = 'ajuda_custo' then
    n := coalesce(array_length(p_visitas, 1), 0);
    if n = 0 then raise exception 'Marque as visitas feitas no mês.'; end if;
    select count(*) into ruins from unnest(p_visitas) x(id)
      left join public.visitas v on v.id = x.id
     where v.id is null or v.executor_id <> eu.id or v.situacao <> 'realizada' or date_trunc('month', v.data_realizada)::date <> v_mes
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

  if s.id is null then
    insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio, detalhe)
      values (p_tipo, eu.id, v_mes, p_valor, nullif(trim(p_relatorio), ''), coalesce(p_detalhe, '{}'::jsonb)) returning id into v_id;
  else
    update public.solicitacoes_pagamento set situacao = 'solicitada', valor_solicitado = p_valor, valor_avalizado = null, relatorio = nullif(trim(p_relatorio), ''),
      detalhe = coalesce(p_detalhe, '{}'::jsonb), solicitada_em = now(), aval_por = null, aval_em = null where id = s.id;
    v_id := s.id;
    delete from public.solicitacao_visitas where solicitacao_id = s.id;
  end if;
  if p_tipo = 'ajuda_custo' then
    insert into public.solicitacao_visitas (visita_id, solicitacao_id) select x, v_id from unnest(p_visitas) x;
  end if;
  return v_id;
end $$;

create or replace function public.avalizar_pagamento(p_id uuid, p_ok boolean, p_obs text, p_valor numeric) returns void
language plpgsql security definer set search_path = public as $$
declare s public.solicitacoes_pagamento; quem public.equipe; papel text := coalesce(public.meu_papel(), ''); v numeric; n int;
begin
  select * into s from public.solicitacoes_pagamento where id = p_id for update;
  if s.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if s.situacao <> 'solicitada' then raise exception 'Esta solicitação não está aguardando aval.'; end if;
  select * into quem from public.equipe where id = s.equipe_id;
  if s.equipe_id = public.meu_id() then raise exception 'Ninguém dá o aval na própria solicitação.'; end if;
  if not (papel = 'coord_geral' or papel = public.quem_avaliza(s.tipo, quem.papel)) then
    raise exception 'O aval desta solicitação é da %.', case public.quem_avaliza(s.tipo, quem.papel) when 'coord_geral' then 'coordenação geral' else 'coordenação técnica' end;
  end if;
  if p_ok then
    -- 45: valor do aval maior que zero (em centavos) e dentro do esperado
    v := coalesce(p_valor, s.valor_solicitado);
    if v is null or not (round(v, 2) > 0) then raise exception 'Informe o valor do aval (maior que zero).'; end if;
    if s.tipo = 'bolsa' and v > 10000 then
      raise exception 'Valor acima do esperado para a bolsa do mês (%; o máximo é R$ 10.000,00). Confira.', public.brl(v);
    end if;
    if s.tipo = 'ajuda_custo' then
      select greatest(count(*), 1) into n from public.solicitacao_visitas where solicitacao_id = s.id;
      if v > 2000 * n then
        raise exception 'Valor acima do esperado para a ajuda de custo de % visita(s) (%; o máximo é R$ 2.000,00 por visita). Confira.', n, public.brl(v);
      end if;
    end if;
    update public.solicitacoes_pagamento set situacao = 'avalizada', valor_avalizado = round(v, 2),
      aval_por = public.meu_id(), aval_em = now(), obs_aval = nullif(trim(p_obs), '') where id = p_id;
  else
    if length(trim(coalesce(p_obs, ''))) < 5 then raise exception 'Para devolver, escreva o que precisa ser corrigido.'; end if;
    update public.solicitacoes_pagamento set situacao = 'devolvida', aval_por = public.meu_id(), aval_em = now(), obs_aval = trim(p_obs) where id = p_id;
    delete from public.solicitacao_visitas where solicitacao_id = p_id;   -- as visitas ficam livres para corrigir
  end if;
end $$;

create or replace function public.registrar_no_arlo(p_id uuid, p_protocolo text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.solicitacoes_pagamento; n int;
begin
  if coalesce(public.meu_papel(), '') not in ('auxiliar_adm','coord_geral') then
    raise exception 'Quem lança o pagamento no Arlo é o auxiliar administrativo.';
  end if;
  select * into s from public.solicitacoes_pagamento where id = p_id for update;
  if s.id is null then raise exception 'Solicitação não encontrada.'; end if;
  if s.situacao <> 'avalizada' then raise exception 'Só solicitação com aval vai para o Arlo.'; end if;
  if s.equipe_id = public.meu_id() then raise exception 'O seu próprio pagamento é lançado pela coordenação geral.'; end if;
  -- 45: não lança valor zerado nem fora do esperado (aval antigo, de antes desta conferência)
  if s.valor_avalizado is null or s.valor_avalizado <= 0 then
    raise exception 'Esta solicitação está sem valor de aval (maior que zero): não dá para lançar. Fale com a coordenação geral.';
  end if;
  if s.tipo = 'bolsa' and s.valor_avalizado > 10000 then
    raise exception 'Valor acima do esperado para a bolsa do mês (%; o máximo é R$ 10.000,00). Confira com a coordenação geral antes de lançar.', public.brl(s.valor_avalizado);
  end if;
  if s.tipo = 'ajuda_custo' then
    select greatest(count(*), 1) into n from public.solicitacao_visitas where solicitacao_id = s.id;
    if s.valor_avalizado > 2000 * n then
      raise exception 'Valor acima do esperado para a ajuda de custo de % visita(s) (%; o máximo é R$ 2.000,00 por visita). Confira com a coordenação geral antes de lançar.', n, public.brl(s.valor_avalizado);
    end if;
  end if;
  update public.solicitacoes_pagamento set situacao = 'lancada', arlo_por = public.meu_id(), arlo_em = now(), arlo_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
end $$;

-- 7 e 8. fichas: datas, CPF e quem aprovou ("b_" no nome: roda DEPOIS de fichas_antes) -------------------------
create or replace function public.fichas_conferir() returns trigger
language plpgsql as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date; ant public.fichas;
begin
  if tg_op = 'UPDATE' then ant := old;
  else select * into ant from public.fichas x where x.id = new.id;   -- celular reenviando a mesma ficha: compara com a que já existe
  end if;
  if ant.id is null or new.data_ficha is distinct from ant.data_ficha then
    if new.data_ficha > hoje then raise exception 'A data da ficha não pode ser no futuro.'; end if;
    if new.data_ficha < date '2026-01-01' then raise exception 'A data da ficha não pode ser anterior a 01/01/2026 (antes do projeto).'; end if;
  end if;
  if ant.id is null or new.data_nascimento is distinct from ant.data_nascimento then
    if new.data_nascimento > hoje then raise exception 'A data de nascimento não pode ser no futuro.'; end if;
    if new.data_nascimento < date '1901-01-01' then raise exception 'Confira a data de nascimento: o ano está antigo demais.'; end if;
  end if;
  if (ant.id is null or new.cpf is distinct from ant.cpf) and new.cpf ~ '^(\d)\1{10}$' then
    raise exception 'CPF inválido (todos os números iguais). Confira o CPF da mulher.';
  end if;
  -- quem aprovou e quando: só na hora em que a situação muda
  if tg_op = 'UPDATE' then
    if new.situacao is not distinct from old.situacao then
      new.aprovada_por := old.aprovada_por; new.aprovada_em := old.aprovada_em;          -- ninguém forja
    elsif new.situacao = 'aprovada' then
      if auth.uid() is not null then new.aprovada_por := public.meu_id(); new.aprovada_em := now();
      else new.aprovada_em := coalesce(new.aprovada_em, now()); end if;                    -- SQL Editor
    else
      new.aprovada_por := null; new.aprovada_em := null;                                   -- devolvida ou de volta para análise
    end if;
  end if;
  return new;
end $$;
drop trigger if exists fichas_b_conferir on public.fichas;
create trigger fichas_b_conferir before insert or update on public.fichas for each row execute function public.fichas_conferir();

create or replace function public.diagnosticos_aprovacao() returns trigger
language plpgsql as $$
begin
  if new.situacao is not distinct from old.situacao then
    new.aprovado_por := old.aprovado_por; new.aprovado_em := old.aprovado_em;              -- ninguém forja
  elsif new.situacao = 'aprovado' then
    if auth.uid() is not null then new.aprovado_por := public.meu_id(); new.aprovado_em := now();
    else new.aprovado_em := coalesce(new.aprovado_em, now()); end if;                      -- SQL Editor
  else
    new.aprovado_por := null; new.aprovado_em := null;                                     -- devolvido ou de volta para análise
  end if;
  return new;
end $$;
drop trigger if exists diagnosticos_b_aprovacao on public.diagnosticos;
create trigger diagnosticos_b_aprovacao before update on public.diagnosticos for each row execute function public.diagnosticos_aprovacao();

-- 9. tetos de passagens e eventos: valores no padrão brasileiro -----------------------------------------
do $$ begin
  if to_regclass('public.pedidos_apoio') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_apoio' and column_name = 'valor_autorizado') then
    execute $f$
create or replace function public.pedidos_apoio_valor() returns trigger
language plpgsql security definer set search_path = public as $b$
declare v numeric; teto numeric; usado numeric;
begin
  if tg_op = 'INSERT' or new.dados is distinct from old.dados then
    begin v := nullif(new.dados->>'valor_estimado', '')::numeric; exception when others then v := null; end;
    if v is null or v <= 0 then raise exception 'Informe o valor estimado do pedido (R$).'; end if;
  end if;
  -- autorizar: confere o saldo (um pedido de cada vez, para dois ao mesmo tempo não passarem do teto)
  if tg_op = 'UPDATE' and new.situacao = 'autorizado' and old.situacao <> 'autorizado' then
    perform pg_advisory_xact_lock(hashtext('teto_' || new.tipo));
    begin new.valor_autorizado := coalesce(new.valor_autorizado, nullif(new.dados->>'valor_estimado', '')::numeric);
    exception when others then new.valor_autorizado := null; end;
    if new.valor_autorizado is null or new.valor_autorizado <= 0 then raise exception 'Informe o valor para autorizar.'; end if;
    if new.tipo = 'evento' then
      teto := 6000;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio where tipo = 'evento' and uf = new.uf and situacao = 'autorizado' and id <> new.id;
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de eventos de % (R$ 6.000,00): já autorizado %, saldo %.', new.uf, public.brl(usado), public.brl(teto - usado);
      end if;
    else
      teto := 70000;
      select coalesce(sum(valor_autorizado), 0) into usado from public.pedidos_apoio where tipo = 'passagem' and situacao = 'autorizado' and id <> new.id;
      if usado + new.valor_autorizado > teto then
        raise exception 'Passa do teto de passagens do projeto (R$ 70.000,00): já autorizado %, saldo %.', public.brl(usado), public.brl(teto - usado);
      end if;
    end if;
  end if;
  return new;
end $b$;
    $f$;
  end if;
end $$;

-- 10. equipe: datas absurdas (só ao cadastrar ou quando a data muda) --------------------------------------
create or replace function public.equipe_datas() returns trigger
language plpgsql as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date; novo boolean := tg_op = 'INSERT';
begin
  if (novo or new.data_inicio is distinct from old.data_inicio)
     and (new.data_inicio < date '2025-01-01' or new.data_inicio > hoje + 365) then
    raise exception 'Confira a data de início: precisa ser a partir de 01/01/2025 e no máximo um ano à frente.';
  end if;
  if new.matricula_fic_em is not null and (novo or new.matricula_fic_em is distinct from old.matricula_fic_em)
     and (new.matricula_fic_em > hoje or new.matricula_fic_em < date '2025-01-01') then
    raise exception 'Confira a data da matrícula no FIC: não pode ser no futuro nem anterior a 01/01/2025.';
  end if;
  if new.docs_funcern_em is not null and (novo or new.docs_funcern_em is distinct from old.docs_funcern_em)
     and (new.docs_funcern_em > hoje or new.docs_funcern_em < date '2025-01-01') then
    raise exception 'Confira a data do cadastro no Arlo: não pode ser no futuro nem anterior a 01/01/2025.';
  end if;
  if new.termo_assinado_em is not null and (novo or new.termo_assinado_em is distinct from old.termo_assinado_em)
     and (new.termo_assinado_em > hoje or new.termo_assinado_em < date '2025-01-01') then
    raise exception 'Confira a data do termo assinado: não pode ser no futuro nem anterior a 01/01/2025.';
  end if;
  if not novo and new.data_fim is not null and new.data_fim is distinct from old.data_fim and new.data_fim > hoje then
    raise exception 'A data do desligamento não pode ser no futuro. Desligue no dia em que a pessoa sair.';
  end if;
  return new;
end $$;
drop trigger if exists equipe_b_datas on public.equipe;
create trigger equipe_b_datas before insert or update on public.equipe for each row execute function public.equipe_datas();

commit;

select 'Correções da auditoria instaladas' as resultado,
       (select prosrc like '%coalesce(case%' from pg_proc where proname = 'pode_gerenciar' and pronamespace = 'public'::regnamespace) as conta_sem_cadastro_barrada,
       exists (select 1 from pg_trigger where tgname = 'fichas_b_conferir') as ficha_conferida,
       exists (select 1 from pg_trigger where tgname = 'equipe_b_datas') as datas_conferidas,
       public.brl(1234567.891) as exemplo_de_valor;
