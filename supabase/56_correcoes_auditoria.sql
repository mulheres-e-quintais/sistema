-- =====================================================================
-- Mulheres & Quintais — 56: CORREÇÕES DA AUDITORIA DE 12/10/2026
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode depois do 55. Pode rodar de novo.
-- Não apaga nem muda nenhum registro que já existe: só troca regras (gatilhos, funções e políticas).
--
--  2. Visita não nasce "feita": a regra "o diagnóstico (e a avaliação) é marcado como feito pelo próprio formulário"
--     e "relato com pelo menos 20 letras" só valia quando a visita era ALTERADA. Gravando a visita nova já como feita,
--     dava para pedir ajuda de custo por uma visita sem formulário nem relato.
--  6. Bolsa no valor da função: o banco aceitava qualquer bolsa até R$ 10.000. Agora a bolsa pedida é exatamente
--     o valor da função (plano de trabalho) e o aval não passa dele.
--  7. Login da bolsista: a coordenação técnica conseguia soltar o login de uma pessoa (user_id = null) e gerar um código
--     novo, entrando no lugar dela. Agora soltar o login é só da coordenação geral (ou do desligamento), e quem já
--     entrou alguma vez só recebe código novo da coordenação geral.
--  8. Foto da vitrine: o arquivo ficava num endereço público até alguém da coordenação abrir a tela da vitrine.
--     Agora a pasta é privada e cada foto abre por um link que vale 1 hora, só enquanto a autorização de imagem
--     continuar valendo: retirou a autorização, nenhum link novo abre a foto.
--  9. Municípios na página pública: a lista mostrava o texto digitado no campo município da ficha (podia ser nome
--     de sítio ou até dado pessoal). Agora só os 29 municípios do projeto, com o nome oficial.
-- =====================================================================

-- ---------- 2. visita nova não entra como feita ----------
create or replace function public.visitas_nasce_prevista() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- quem está logado agenda a visita (prevista); ela vira "feita" depois, pelo formulário ou pelo registro da visita,
  -- onde as regras de data, relato, formulário e ordem das etapas são conferidas (gatilho visitas_feita)
  if auth.uid() is not null and new.situacao = 'realizada' then
    raise exception 'A visita é agendada primeiro e marcada como feita depois, pelo formulário (diagnóstico e avaliação) ou pelo registro da visita.';
  end if;
  return new;
end $$;
revoke all on function public.visitas_nasce_prevista() from public, anon, authenticated;
drop trigger if exists a0_nasce_prevista on public.visitas;
create trigger a0_nasce_prevista before insert on public.visitas for each row execute function public.visitas_nasce_prevista();

-- ---------- 6. bolsa no valor da função ----------
-- valores do plano de trabalho (os mesmos de js/dados.js, MQ.PAPEIS[...].bolsa): se o plano mudar, mude os dois
create or replace function public.valor_bolsa(p_papel text) returns numeric
language sql immutable set search_path = public, pg_temp as $$
  select case p_papel when 'coord_tecnico' then 4700.00 when 'articulacao' then 2200.00 when 'apoio' then 1600.00
                      when 'professor_fic' then 2200.00 when 'auxiliar_adm' then 1200.00 end::numeric(10,2)
$$;
revoke all on function public.valor_bolsa(text) from public, anon;
grant execute on function public.valor_bolsa(text) to authenticated;

create or replace function public.pagamentos_valor_bolsa() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v numeric(10,2); papel text;
begin
  if new.tipo <> 'bolsa' or auth.uid() is null then return new; end if;
  select e.papel into papel from public.equipe e where e.id = new.equipe_id;
  v := public.valor_bolsa(papel);
  if v is null then raise exception 'Esta função não recebe bolsa pelo projeto.'; end if;
  if (tg_op = 'INSERT' or new.valor_solicitado is distinct from old.valor_solicitado) and new.valor_solicitado is distinct from v then
    raise exception 'A bolsa de % é de % por mês (plano de trabalho). Atualize a página e peça de novo.',
      lower(case papel when 'coord_tecnico' then 'coordenação técnica' when 'articulacao' then 'articulação estadual' when 'apoio' then 'apoio estadual'
                       when 'professor_fic' then 'professor do FIC' when 'auxiliar_adm' then 'auxiliar administrativo' else papel end),
      public.brl(v);
  end if;
  if new.valor_avalizado is not null and new.valor_avalizado is distinct from old.valor_avalizado and new.valor_avalizado > v then
    raise exception 'O aval da bolsa não pode passar do valor da função (%).', public.brl(v);
  end if;
  return new;
end $$;
revoke all on function public.pagamentos_valor_bolsa() from public, anon, authenticated;
drop trigger if exists a0_valor_bolsa on public.solicitacoes_pagamento;
create trigger a0_valor_bolsa before insert or update on public.solicitacoes_pagamento for each row execute function public.pagamentos_valor_bolsa();

-- ---------- 7. login: soltar e liberar de novo é só da coordenação geral ----------
create or replace function public.equipe_login_fixo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- desligar zera o login (pode); ligar uma conta só pelo código de primeiro acesso (sem usuário logado)
  if new.user_id is not null and new.user_id is distinct from old.user_id and auth.uid() is not null then
    raise exception 'O login de um cadastro não se troca pela tela. Gere um novo código de primeiro acesso.';
  end if;
  -- 56: soltar o login de quem entrou (apagar a senha) só a coordenação geral, ou o próprio desligamento
  if new.user_id is null and old.user_id is not null and auth.uid() is not null
     and coalesce(public.meu_papel(), '') <> 'coord_geral' and new.status = old.status then
    raise exception 'Só a coordenação geral libera um novo primeiro acesso para quem já tem senha.';
  end if;
  return new;
end $$;
revoke all on function public.equipe_login_fixo() from public, anon, authenticated;

create or replace function public.gerar_codigo_acesso(p_equipe uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.equipe; c text;
begin
  if public.meu_id() is null then raise exception 'Você não pode gerar o acesso desta pessoa.'; end if;
  select * into m from public.equipe where id = p_equipe;
  if m.id is null or m.status <> 'ativa' then raise exception 'Cadastro não encontrado ou desligado.'; end if;
  if not coalesce(public.pode_gerenciar(m.papel), false) then raise exception 'Você não pode gerar o acesso desta pessoa.'; end if;
  -- 56: quem já entrou alguma vez (mesmo que o login tenha sido solto depois, por troca de e-mail) só recebe código novo
  --     da coordenação geral: a coordenação técnica gera só o PRIMEIRO acesso de quem ela cadastrou
  if coalesce(public.meu_papel(), '') <> 'coord_geral'
     and (m.user_id is not null or exists (select 1 from public.contas_ja_ligadas k where k.equipe_id = m.id)) then
    raise exception 'Esta pessoa já entrou no sistema antes. Só a coordenação geral libera um novo primeiro acesso.';
  end if;
  if m.user_id is not null then
    update public.equipe set user_id = null where id = m.id;
    delete from auth.users where id = m.user_id;
  end if;
  c := public.novo_codigo_acesso(m.id, public.meu_id());
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
  values ('acesso_codigos', m.id, case when m.user_id is null then 'CODIGO' else 'NOVO_ACESSO' end, public.meu_id(),
          null, jsonb_build_object('expira_em', now() + interval '7 days', 'senha_anterior_apagada', m.user_id is not null));
  return c;
end $$;
revoke all on function public.gerar_codigo_acesso(uuid) from public, anon;
grant execute on function public.gerar_codigo_acesso(uuid) to authenticated;

-- ---------- 8. vitrine: pasta privada, link de 1 hora só enquanto a autorização valer ----------
create or replace function public.vitrine_foto_publica(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.vitrine_fotos vf join public.fichas f on f.id = vf.ficha_id
                  where vf.path = p_path and f.consent_imagem and (f.consent_criancas or vf.sem_criancas)
                    and (to_regclass('public.exemplo') is null or f.id not in (select id from public.exemplo)));
$$;
revoke all on function public.vitrine_foto_publica(text) from public;
grant execute on function public.vitrine_foto_publica(text) to anon, authenticated;
update storage.buckets set public = false where id = 'vitrine';
drop policy if exists vitrine_arq_ler_publico on storage.objects;
create policy vitrine_arq_ler_publico on storage.objects for select to anon, authenticated
  using (bucket_id = 'vitrine' and public.vitrine_foto_publica(name));

-- ---------- 9. municípios da página pública: só os 29 do projeto, com o nome oficial ----------
create or replace function public.vitrine_municipios() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb; v_ex text := '';
begin
  if to_regclass('public.exemplo') is not null then v_ex := ' and f.id not in (select id from public.exemplo)'; end if;
  execute 'with proj (uf, municipio) as (values
      (''AL'',''Cacimbinhas''),(''AL'',''Estrela de Alagoas''),(''AL'',''Palmeira dos Índios''),
      (''BA'',''Cansanção''),(''BA'',''Iraquara''),(''BA'',''Itiúba''),(''BA'',''Laje''),(''BA'',''Lençóis''),(''BA'',''Ponto Novo''),(''BA'',''Taperoá''),(''BA'',''Vitória da Conquista''),
      (''PE'',''Araripina''),(''PE'',''Bodocó''),(''PE'',''Cedro''),(''PE'',''Ouricuri''),(''PE'',''Serrita''),
      (''PI'',''Alagoinha do Piauí''),(''PI'',''Campo Grande do Piauí''),(''PI'',''Francisco Santos''),(''PI'',''Geminiano''),(''PI'',''Oeiras''),(''PI'',''Paulistana''),
      (''PI'',''Pio IX''),(''PI'',''São João da Varjota''),(''PI'',''São Julião''),(''PI'',''Teresina''),
      (''SE'',''Neópolis''),(''SE'',''Pacatuba''),(''SE'',''Porto da Folha'')),
    contagem as (select p.uf, p.municipio, count(*) n
                   from public.fichas f join proj p on p.uf = f.uf and public.sem_acento(p.municipio) = public.sem_acento(f.municipio)
                  where f.resultado <> ''nao_atende''' || v_ex || '
                  group by 1, 2)
    select coalesce(jsonb_agg(jsonb_build_object(''uf'', uf, ''municipio'', municipio, ''n'', case when n >= 3 then n end, ''menos_de_3'', n < 3)
                              order by uf, municipio), ''[]''::jsonb) from contagem'
    into v;
  return v;
end $$;
revoke all on function public.vitrine_municipios() from public;
grant execute on function public.vitrine_municipios() to anon, authenticated;

select 'Etapa 56 instalada: correções da auditoria de 12/10/2026' as resultado,
       (select public from storage.buckets where id = 'vitrine') as vitrine_publica_deve_ser_false;
