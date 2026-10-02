-- roda depois do test_cadastro_equipe.sql e do test_passagens_eventos.sql (usa :G, :T, :BB, :X, t(), f(), logar())
-- e ANTES do test_conferencia_auxiliar.sql (que desliga a coordenação técnica e o auxiliar)
-- 45_auditoria_qa.sql: correções da auditoria de qualidade
\set QUIET on
truncate res;
select set_config('t.bb', :BB, false);

-- ===== cenário (como superusuário, sem os gatilhos: monta também registros "antigos") =====
do $x$ declare b public.equipe; ag uuid := 'e0000000-0000-0000-0000-000000000001'; hoje date := (now() at time zone 'America/Fortaleza')::date;
  mes date := date_trunc('month', (now() at time zone 'America/Fortaleza')::date)::date; i int;
begin
  select * into b from public.equipe where user_id = current_setting('t.bb')::uuid;
  alter table public.equipe disable trigger user; alter table public.fichas disable trigger user; alter table public.visitas disable trigger user;
  alter table public.diagnosticos disable trigger user; alter table public.avaliacoes disable trigger user;
  update public.equipe set matricula_fic_em = coalesce(matricula_fic_em, hoje), docs_funcern_em = coalesce(docs_funcern_em, hoje),
    termo_assinado_em = coalesce(termo_assinado_em, hoje) where id = b.id;
  -- agente da BA, habilitada, com login; uma pessoa que será desligada; um cadastro antigo (início em 2020)
  insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em) values
    (ag, 'agente', 'BA', 'Agente Auditoria', '90000000001', 'qa.ag@t.com', mes, true, mes, mes, mes),
    ('e0000000-0000-0000-0000-000000000002', 'agente', 'BA', 'Agente Desligada', '90000000002', 'qa.desl@t.com', mes, true, null, null, null),
    ('e0000000-0000-0000-0000-000000000003', 'agente', 'BA', 'Agente Antiga', '90000000003', 'qa.antiga@t.com', '2020-03-01', true, null, null, null);
  for i in 1..7 loop
    insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
      c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao, bolsista_id)
    values (('e1000000-0000-0000-0000-00000000000' || i)::uuid, 'BA', 'Juazeiro', 'Lagoa Auditoria', 'Maria Auditoria ' || i, (91000000000 + i)::text, '1980-01-01', 'Sítio ' || i,
      true,true,true,true,true,true,true,true,true,true,'selecionada', case when i = 5 then date '2025-06-01' else hoje - 30 end, case when i in (5, 6) then 'aguardando' else 'aprovada' end, b.id);
  end loop;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato) values
    ('e2000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000001', 'BA', 'diagnostico',    ag, hoje - 5, hoje - 5, 'realizada', null),
    ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'BA', 'implantacao',    ag, hoje, hoje, 'realizada', 'Implantação feita com a família, canteiros prontos.'),
    ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'BA', 'acompanhamento', ag, hoje, hoje, 'realizada', 'Acompanhamento: horta produzindo, orientação de rega.'),
    ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'BA', 'diagnostico',    ag, hoje, null, 'prevista', null),
    ('e2000000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000003', 'BA', 'diagnostico',    ag, hoje, hoje, 'realizada', null),
    ('e2000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000003', 'BA', 'implantacao',    ag, hoje, null, 'prevista', null),
    ('e2000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000004', 'BA', 'diagnostico',  b.id, hoje, null, 'prevista', null),
    ('e2000000-0000-0000-0000-000000000027', 'e1000000-0000-0000-0000-000000000007', 'BA', 'avaliacao',      ag, hoje, hoje, 'realizada', null);
  insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, agua_seca, lote, latitude, longitude, situacao) values
    ('e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000011', 'BA', ag, hoje - 5, 'sim', 1, -9.41, -40.5, 'aguardando'),
    ('e3000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000013', 'BA', ag, hoje, 'sim', 1, -9.41, -40.5, 'aprovado');   -- 46: a implantação só é feita com o plano aprovado
  insert into public.avaliacoes (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, quintal_produz) values
    ('e4000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000007', 'e2000000-0000-0000-0000-000000000027', 'BA', ag, hoje, -9.41, -40.5, 'sim');
  alter table public.equipe enable trigger user; alter table public.fichas enable trigger user; alter table public.visitas enable trigger user;
  alter table public.diagnosticos enable trigger user; alter table public.avaliacoes enable trigger user;
end $x$;
insert into public.apl_municipios (uf, municipio) values ('BA', 'Juazeiro') on conflict do nothing;
select logar('qa.ag@t.com') \gset ag_
\set AG '''' :ag_logar ''''
-- conta DESLIGADA: entrou, foi desligada (o banco tira o login do cadastro), mas a conta continua existindo
select logar('qa.desl@t.com') \gset ds_
\set DESL '''' :ds_logar ''''
update public.equipe set status = 'desligada', data_fim = (now() at time zone 'America/Fortaleza')::date, motivo_desligamento = 'teste da auditoria' where email = 'qa.desl@t.com';
-- pior caso: o cadastro desligado ainda aponta para a conta (banco antigo)
alter table public.equipe disable trigger user;
update public.equipe set user_id = :DESL where email = 'qa.desl@t.com';
alter table public.equipe enable trigger user;
-- conta SEM CADASTRO: existe no login, não existe na equipe
alter table auth.users disable trigger user;
insert into auth.users (id, email) values ('e9000000-0000-0000-0000-000000000009', 'intrusa@fora.com');
alter table auth.users enable trigger user;
\set NOEQ '''e9000000-0000-0000-0000-000000000009'''
select id as ag2 from public.equipe where email = 'ag2@t.com' \gset
select id as apo from public.equipe where email = 'apoio.pi@t.com' and status = 'ativa' \gset
select id as agid from public.equipe where email = 'qa.ag@t.com' \gset
select id as penv from public.pedidos_apoio where situacao = 'enviado' limit 1 \gset
select id as pconf from public.pedidos_apoio where tipo = 'passagem' and situacao = 'conferido' limit 1 \gset

-- ===== 1. conta sem cadastro ativo (e desligada) =====
select t('sem cadastro NÃO gera código de acesso de agente', :NOEQ, format($q$select public.gerar_codigo_acesso(%L)$q$, :'ag2'), 'não pode gerar');
select t('desligada NÃO gera código de acesso de agente', :DESL, format($q$select public.gerar_codigo_acesso(%L)$q$, :'ag2'), 'não pode gerar');
select t('sem cadastro NÃO gera código de bolsista que já tem senha (apagaria o login dela)', :NOEQ, format($q$select public.gerar_codigo_acesso(%L)$q$, :'apo'), 'não pode gerar');
select t('nenhum código ficou gravado pelas tentativas', null, format($q$do $x$ begin set local role none;
  if exists (select 1 from public.acesso_codigos where equipe_id = %L) then raise exception 'gravou código'; end if; end $x$$q$, :'ag2'), 'ok');
select t('coordenação técnica continua gerando código de agente', :T, format($q$do $x$ begin
  if public.gerar_codigo_acesso(%L) !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$' then raise exception 'sem código'; end if; end $x$$q$, :'ag2'), 'ok');
select t('coordenação geral continua gerando código', :G, format($q$select public.gerar_codigo_acesso(%L)$q$, :'ag2'), 'ok');
select t('bolsista continua SEM gerar código', :BB, format($q$select public.gerar_codigo_acesso(%L)$q$, :'ag2'), 'não pode gerar');
select t('pode_gerenciar devolve sempre sim ou não (nunca vazio)', :NOEQ, $q$do $x$ begin
  if public.pode_gerenciar('agente') is distinct from false or public.pode_gerenciar(null) is distinct from false then raise exception 'veio vazio ou sim'; end if; end $x$$q$, 'ok');
select t('pode_gerenciar: técnica gerencia agente e não gerencia professor', :T, $q$do $x$ begin
  if public.pode_gerenciar('agente') is not true or public.pode_gerenciar('professor_fic') is not false then raise exception 'regra mudou'; end if; end $x$$q$, 'ok');
select t('sem cadastro NÃO cancela pedido de passagem/evento', :NOEQ, format($q$select public.mover_pedido_apoio(%L, 'cancelar', null, null)$q$, :'penv'), 'cadastro ativo');
select t('desligada NÃO cancela pedido', :DESL, format($q$select public.mover_pedido_apoio(%L, 'cancelar', null, null)$q$, :'penv'), 'cadastro ativo');
select t('sem cadastro NÃO confere pedido', :NOEQ, format($q$select public.mover_pedido_apoio(%L, 'conferir', null, null)$q$, :'penv'), 'cadastro ativo');
select t('técnica NÃO cancela pedido de outra pessoa', :T, format($q$select public.mover_pedido_apoio(%L, 'cancelar', null, null)$q$, :'penv'), 'Só quem pediu');
select t('quem pediu continua cancelando o próprio pedido', :BB, format($q$select public.mover_pedido_apoio(%L, 'cancelar', null, null)$q$, :'penv'), 'ok');
select t('técnica continua conferindo', :T, format($q$select public.mover_pedido_apoio(%L, 'conferir', null, null)$q$, :'penv'), 'ok');
select t('sem cadastro NÃO vê pendências de campo de ninguém', :NOEQ, format($q$do $x$ begin
  if public.pendencias_campo(%L) is not null then raise exception 'viu'; end if; end $x$$q$, :'agid'), 'ok');
select t('bolsista NÃO vê pendências de outra pessoa', :BB, format($q$do $x$ begin
  if public.pendencias_campo(%L) is not null then raise exception 'viu'; end if; end $x$$q$, :'agid'), 'ok');
select t('a pessoa vê as próprias pendências', :AG, $q$do $x$ begin
  if (public.pendencias_campo(public.meu_id()) ->> 'visitas')::int < 2 then raise exception 'não viu'; end if; end $x$$q$, 'ok');
select t('coordenação vê as pendências de quem ela gerencia', :T, format($q$do $x$ begin
  if (public.pendencias_campo(%L) ->> 'visitas')::int < 2 then raise exception 'não viu'; end if; end $x$$q$, :'agid'), 'ok');
select t('desligar quem tem visita agendada continua barrado (o banco ainda enxerga as pendências)', :T, format($q$update public.equipe
  set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'teste da auditoria' where id = %L$q$, :'agid'), 'Não dá para desligar ainda');
select t('sem cadastro NÃO vê saldo de passagens, quem confere, nem se há professor', :NOEQ, $q$do $x$ begin
  if public.saldo_passagens_eventos() is not null then raise exception 'viu saldo'; end if;
  if public.quem_confere_pedidos() is not null then raise exception 'viu quem confere'; end if;
  if public.tem_professor_fic_habilitado() is distinct from false then raise exception 'viu professor'; end if; end $x$$q$, 'ok');
select t('desligada também não vê', :DESL, $q$do $x$ begin
  if public.saldo_passagens_eventos() is not null or public.quem_confere_pedidos() is not null or public.tem_professor_fic_habilitado() then raise exception 'viu'; end if; end $x$$q$, 'ok');
select t('equipe ativa continua vendo saldo, quem confere e professor', :BB, $q$do $x$ begin
  if (public.saldo_passagens_eventos() ->> 'passagem_teto')::int <> 70000 then raise exception 'sem saldo'; end if;
  if public.quem_confere_pedidos() <> 'coord_tecnico' then raise exception 'sem conferente'; end if;
  if not public.tem_professor_fic_habilitado() then raise exception 'sem professor'; end if; end $x$$q$, 'ok');
select t('SQL Editor (sem login) continua vendo: os scripts antigos e os gatilhos dependem disso', null, $q$do $x$ begin set local role none;
  if public.quem_confere_pedidos() is null or not public.tem_professor_fic_habilitado() or public.saldo_passagens_eventos() is null then raise exception 'não viu'; end if; end $x$$q$, 'ok');
select t('sem cadastro NÃO confirma presença no FIC', :NOEQ, $q$select public.confirmar_presenca_fic((select id from public.fic_encontros limit 1))$q$, 'Não há presença sua');

-- ===== 2. leituras =====
insert into storage.objects (bucket_id, name) values ('equipe', 'e0000000-0000-0000-0000-000000000001/foto.jpg');
select t('equipe ativa continua lendo os valores de pagamento', :AG, $q$do $x$ begin if not exists (select 1 from public.parametros) then raise exception 'não leu'; end if; end $x$$q$, 'ok');
select t('equipe ativa continua lendo os municípios do APL', :AG, $q$do $x$ begin if not exists (select 1 from public.apl_municipios) then raise exception 'não leu'; end if; end $x$$q$, 'ok');
select t('quem está ativa continua lendo o próprio cadastro', :AG, $q$do $x$ begin if (select count(*) from public.equipe) <> 1 then raise exception 'leu %', (select count(*) from public.equipe); end if; end $x$$q$, 'ok');
select t('equipe ativa continua vendo as fotos da equipe', :AG, $q$do $x$ begin if not exists (select 1 from storage.objects where bucket_id = 'equipe') then raise exception 'não viu'; end if; end $x$$q$, 'ok');

-- ===== 3. visita já feita não muda mais =====
\set V1 ' where id = ''e2000000-0000-0000-0000-000000000001'''
select t('agente NÃO volta para "prevista" a visita que ela fez', :AG, $q$update public.visitas set situacao = 'prevista', data_realizada = null$q$ || :'V1', 'já foi feita');
select t('bolsista NÃO volta visita feita para "prevista"', :BB, $q$update public.visitas set situacao = 'prevista', data_realizada = null$q$ || :'V1', 'já foi feita');
select t('bolsista NÃO cancela visita já feita', :BB, $q$update public.visitas set situacao = 'cancelada'$q$ || :'V1', 'já foi feita');
select t('bolsista NÃO troca quem fez a visita já feita (passar para o próprio nome)', :BB, $q$update public.visitas set executor_id = public.meu_id()$q$ || :'V1', 'já foi feita');
select t('bolsista NÃO troca a data da visita já feita', :BB, $q$update public.visitas set data_realizada = data_realizada - 3$q$ || :'V1', 'já foi feita');
select t('bolsista NÃO troca a data prevista da visita já feita', :BB, $q$update public.visitas set data_prevista = data_prevista + 3$q$ || :'V1', 'já foi feita');
select t('ninguém apaga o relato da visita já feita', :AG, $q$update public.visitas set relato = ''$q$ || :'V1', 'não pode ficar vazio');
select t('relato de visita feita não encolhe para menos de 20 letras', :BB, $q$update public.visitas set relato = 'ok'$q$ || :'V1', 'não pode ficar vazio');
select t('data da visita feita no FUTURO é recusada até para a coordenação geral', :G, $q$update public.visitas set data_realizada = date '2030-01-01'$q$ || :'V1', 'não pode ser no futuro');
select t('quem fez a visita continua completando o relato e a observação', :AG, $q$update public.visitas set relato = relato || ' Plantio de mudas no segundo canteiro.', obs = 'voltar em 15 dias'$q$ || :'V1', 'ok');
select t('coordenação técnica corrige a data da visita feita', :T, $q$update public.visitas set data_realizada = data_realizada - 2$q$ || :'V1', 'ok');
select t('coordenação geral corrige a visita feita e a correção fica no histórico (quem e quando)', :G, $q$do $x$ begin
  update public.visitas set situacao = 'prevista', data_realizada = null where id = 'e2000000-0000-0000-0000-000000000001';
  if not exists (select 1 from public.auditoria a where a.tabela = 'visitas' and a.registro_id = 'e2000000-0000-0000-0000-000000000001' and a.acao = 'UPDATE'
                   and a.por = public.meu_id() and a.antes ->> 'situacao' = 'realizada' and a.depois ->> 'situacao' = 'prevista') then raise exception 'sem histórico'; end if; end $x$$q$, 'ok');
-- o caminho normal não mudou: prevista → realizada, com relato e data na mesma gravação
\set V4 ' where id = ''e2000000-0000-0000-0000-000000000004'''
select t('agente marca a visita como feita (relato e data na mesma gravação)', :AG, $q$update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje(), relato = 'Implantação feita: dois canteiros e a caixa instalada.'$q$ || :'V4', 'ok');
select t('marcar como feita com data no futuro continua recusado', :AG, $q$update public.visitas set situacao = 'realizada', data_realizada = public.fic_hoje() + 1, relato = 'Implantação feita: dois canteiros e a caixa instalada.'$q$ || :'V4', 'futuro');
select t('visita ainda prevista: data de "feita" no futuro é recusada mesmo sem mudar a situação', :BB, $q$update public.visitas set data_realizada = public.fic_hoje() + 10$q$ || :'V4', 'não pode ser no futuro');
select t('bolsista continua reagendando visita prevista', :BB, $q$update public.visitas set data_prevista = public.fic_hoje() + 7$q$ || :'V4', 'ok');

-- ===== 10 (visitas). data prevista dentro do projeto =====
\set VI 'insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (''e2000000-0000-0000-0000-000000000099'', ''e1000000-0000-0000-0000-000000000003'', ''BA'', ''acompanhamento'', ''e0000000-0000-0000-0000-000000000001'', '
select t('visita agendada para 1900 é recusada', :BB, :'VI' || $q$'1900-01-01')$q$, 'entre 01/01/2026 e 31/12/2027');
select t('visita agendada para 2028 é recusada', :BB, :'VI' || $q$'2028-01-01')$q$, 'entre 01/01/2026 e 31/12/2027');
select t('reagendar visita para 2030 é recusado', :BB, $q$update public.visitas set data_prevista = '2030-05-01'$q$ || :'V4', 'entre 01/01/2026 e 31/12/2027');
select t('visita agendada dentro do projeto é aceita', :BB, $q$insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista)
  values ('e2000000-0000-0000-0000-000000000098', 'e1000000-0000-0000-0000-000000000001', 'BA', 'acompanhamento', 'e0000000-0000-0000-0000-000000000001', '2027-03-10')$q$, 'ok');   -- 46: acompanhamento só em quintal já implantado
-- visita antiga com data fora do período não trava ao ser alterada em outro campo
alter table public.visitas disable trigger user;
update public.visitas set data_prevista = '2025-11-20' where id = 'e2000000-0000-0000-0000-000000000005';
alter table public.visitas enable trigger user;
select t('visita antiga (data prevista de 2025) continua podendo ser alterada em outro campo', :BB, $q$update public.visitas set obs = 'levar o formulário impresso' where id = 'e2000000-0000-0000-0000-000000000005'$q$, 'ok');

-- ===== 5. teto do kit =====
\set KI 'insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, lote, latitude, longitude, dados) values (''e3000000-0000-0000-0000-000000000002'', ''e1000000-0000-0000-0000-000000000002'', ''e2000000-0000-0000-0000-000000000003'', ''BA'', public.fic_hoje(), ''sim'', 1, -9.41, -40.5, '
\set KS 'insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, sem_agua, lote, latitude, longitude, dados) values (''e3000000-0000-0000-0000-000000000002'', ''e1000000-0000-0000-0000-000000000002'', ''e2000000-0000-0000-0000-000000000003'', ''BA'', public.fic_hoje(), ''nao'', true, null, -9.41, -40.5, '
\set DK ' where id = ''e3000000-0000-0000-0000-000000000002'''
select t('kit de R$ 9.000 é recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa d''água","qtd":"1","valor":9000}]}')$q$, 'R$ 9.000,00, o teto é R$ 5.000,00');
select t('kit com quantidade vazia e valor 9000 é recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa d''água","qtd":"","valor":9000}]}')$q$, 'informe a quantidade');
select t('kit com quantidade negativa para caber no teto é recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa","qtd":"1","valor":9000},{"item":"Desconto","qtd":"-1","valor":4500}]}')$q$, 'não pode ser negativa');
select t('kit com valor negativo para caber no teto é recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa","qtd":"1","valor":9000},{"item":"Desconto","qtd":"1","valor":-4500}]}')$q$, 'não pode ser negativo');
select t('kit com valor em texto "9.000,00" é lido e recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa","qtd":"1","valor":"9.000,00"}]}')$q$, 'R$ 9.000,00, o teto');
select t('kit com valor "R$ 9000" é lido e recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa","qtd":"1","valor":"R$ 9000"}]}')$q$, 'R$ 9.000,00, o teto');
select t('kit com valor que não é número é recusado', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa","qtd":"1","valor":"a combinar"}]}')$q$, 'não é um número');
select t('kit que não é lista é recusado', :AG, :'KI' || $q$'{"kit":{"item":"Caixa","qtd":"1","valor":9000}}')$q$, 'formato');
select t('kit com item que não é registro é recusado', :AG, :'KI' || $q$'{"kit":[9000]}')$q$, 'formato');
select t('kit de R$ 5.000,01 é recusado e a mensagem mostra o total certo', :AG, :'KI' || $q$'{"kit":[{"item":"Mudas","qtd":"3","valor":1666.67}]}')$q$, '(R$ 5.000,01, o teto');
select t('kit de R$ 5.000,0001 (R$ 5.000,00 na tela) é aceito', :AG, :'KI' || $q$'{"kit":[{"item":"Mudas","qtd":"3","valor":1666.6667}]}')$q$, 'ok');
select t('kit de R$ 5.000,00 exatos é aceito', :AG, :'KI' || $q$'{"kit":[{"item":"Caixa d''água","qtd":"2","valor":2500}]}')$q$, 'ok');
select t('kit com quantidade "20 m" e item ainda sem valor é aceito (como a tela grava)', :AG, :'KI' || $q$'{"kit":[{"item":"Tela","qtd":"20 m","valor":10},{"item":"Sementes","qtd":"","valor":null}]}')$q$, 'ok');
select t('diagnóstico sem kit é aceito', :AG, :'KI' || $q$'{}')$q$, 'ok');
-- sem água primeiro (sem teto), depois vira com água sem mexer no kit
select f(:AG, :'KS' || $q$'{"kit":[{"item":"Caixa d''água","qtd":"1","valor":9000}]}')$q$);
select t('diagnóstico sem água vira COM água sem mexer no kit de R$ 9.000: recusado', :AG, $q$update public.diagnosticos set sem_agua = false, lote = 1, agua_seca = 'sim'$q$ || :'DK', 'R$ 9.000,00, o teto');
select f(:AG, $q$update public.diagnosticos set sem_agua = false, lote = 1, agua_seca = 'sim', dados = '{"kit":[{"item":"Caixa d''água","qtd":"1","valor":4000}]}'$q$ || :'DK');
select t('kit acima do teto gravado antes (banco antigo) não é aprovado sem corrigir', null, $q$do $x$ begin set local role none;
  alter table public.diagnosticos disable trigger user;
  update public.diagnosticos set dados = '{"kit":[{"item":"Caixa","qtd":"1","valor":9000}]}' where id = 'e3000000-0000-0000-0000-000000000002';
  alter table public.diagnosticos enable trigger user;
  update public.diagnosticos set situacao = 'aprovado' where id = 'e3000000-0000-0000-0000-000000000002'; end $x$$q$, 'passa do valor por quintal');
select t('kit antigo com quantidade vazia (como a tela aceitava antes): devolver o diagnóstico continua funcionando', null, $q$do $x$ begin set local role none;
  alter table public.diagnosticos disable trigger user;
  update public.diagnosticos set dados = '{"kit":[{"item":"Mudas","qtd":"","valor":35},{"item":"Garrafas","qtd":"2 de 500 ml","valor":3}]}' where id = 'e3000000-0000-0000-0000-000000000002';
  alter table public.diagnosticos enable trigger user;
  update public.diagnosticos set obs_coordenacao = 'Conferir a lista do kit.' where id = 'e3000000-0000-0000-0000-000000000002'; end $x$$q$, 'ok');
select t('kit antigo com quantidade vazia: ao MEXER no kit a quantidade passa a ser exigida', :AG, $q$update public.diagnosticos set dados = '{"kit":[{"item":"Mudas","qtd":"","valor":36}]}'$q$ || :'DK', 'informe a quantidade');
select f(null, $q$do $x$ begin set local role none; alter table public.diagnosticos disable trigger user;
  update public.diagnosticos set dados = '{"kit":[{"item":"Caixa d''água","qtd":"1","valor":4000}]}' where id = 'e3000000-0000-0000-0000-000000000002';
  alter table public.diagnosticos enable trigger user; end $x$$q$);

-- ===== 4. visita com formulário não se cancela =====
\set V3 ' where id = ''e2000000-0000-0000-0000-000000000003'''
select t('o formulário marcou a visita de diagnóstico como feita (fluxo normal)', :AG, $q$do $x$ begin if (select situacao from public.visitas$q$ || :'V3' || $q$) <> 'realizada' then raise exception 'não marcou'; end if; end $x$$q$, 'ok');
select t('bolsista NÃO cancela visita de diagnóstico que já tem formulário', :BB, $q$update public.visitas set situacao = 'cancelada'$q$ || :'V3', 'já tem diagnóstico registrado; não pode ser cancelada');
select t('coordenação técnica NÃO cancela visita de diagnóstico que já tem formulário', :T, $q$update public.visitas set situacao = 'cancelada'$q$ || :'V3', 'já tem diagnóstico registrado; não pode ser cancelada');
select t('coordenação geral NÃO cancela visita de diagnóstico que já tem formulário', :G, $q$update public.visitas set situacao = 'cancelada'$q$ || :'V3', 'já tem diagnóstico registrado; não pode ser cancelada');
select t('coordenação geral NÃO cancela visita de avaliação que já tem formulário', :G, $q$update public.visitas set situacao = 'cancelada' where id = 'e2000000-0000-0000-0000-000000000027'$q$, 'já tem avaliação registrada; não pode ser cancelada');
select t('visita de diagnóstico ainda sem formulário continua podendo ser cancelada', :BB, $q$update public.visitas set situacao = 'cancelada' where id = 'e2000000-0000-0000-0000-000000000005'$q$, 'ok');
select t('quem fez corrige a data no formulário e a visita acompanha (não trava)', :AG, $q$do $x$ begin
  update public.diagnosticos set data_visita = data_visita - 1 where id = 'e3000000-0000-0000-0000-000000000002';
  if (select v.data_realizada from public.visitas v where v.id = 'e2000000-0000-0000-0000-000000000003') <> public.fic_hoje() - 1 then raise exception 'a visita não acompanhou'; end if; end $x$$q$, 'ok');

-- ===== 8. quem aprovou e quando =====
select t('diagnóstico: técnica NÃO forja quem aprovou sem aprovar', :T, $q$do $x$ begin
  update public.diagnosticos set aprovado_por = (select id from public.equipe where papel = 'coord_geral'), aprovado_em = '2020-01-01' where id = 'e3000000-0000-0000-0000-000000000002';
  if (select aprovado_por from public.diagnosticos where id = 'e3000000-0000-0000-0000-000000000002') is not null then raise exception 'forjou'; end if; end $x$$q$, 'ok');
select f(:T, $q$update public.diagnosticos set situacao = 'aprovado', aprovado_por = (select id from public.equipe where papel = 'coord_geral'), aprovado_em = '2020-01-01'$q$ || :'DK');
select t('diagnóstico: ao aprovar, quem aprova é quem está logada e a hora é a de agora (o que veio da tela é ignorado)', :T, $q$do $x$ declare d public.diagnosticos; begin
  select * into d from public.diagnosticos where id = 'e3000000-0000-0000-0000-000000000002';
  if d.aprovado_por is distinct from public.meu_id() or d.aprovado_em < now() - interval '5 minutes' then raise exception 'por % em %', d.aprovado_por, d.aprovado_em; end if; end $x$$q$, 'ok');
select t('diagnóstico aprovado: técnica NÃO troca quem aprovou nem a data', :T, $q$do $x$ declare d public.diagnosticos; begin
  update public.diagnosticos set aprovado_por = null, aprovado_em = '2020-01-01' where id = 'e3000000-0000-0000-0000-000000000002';
  select * into d from public.diagnosticos where id = 'e3000000-0000-0000-0000-000000000002';
  if d.aprovado_por is distinct from public.meu_id() or d.aprovado_em < now() - interval '5 minutes' then raise exception 'trocou'; end if; end $x$$q$, 'ok');
select t('diagnóstico devolvido depois de aprovado fica sem aprovador', :T, $q$do $x$ declare d public.diagnosticos; begin
  update public.diagnosticos set situacao = 'devolvido', obs_coordenacao = 'Rever o kit e reenviar' where id = 'e3000000-0000-0000-0000-000000000002';
  select * into d from public.diagnosticos where id = 'e3000000-0000-0000-0000-000000000002';
  if d.aprovado_por is not null or d.aprovado_em is not null then raise exception 'ficou com aprovador'; end if; end $x$$q$, 'ok');
\set F6 ' where id = ''e1000000-0000-0000-0000-000000000006'''
select t('ficha: técnica NÃO forja quem aprovou sem aprovar', :T, $q$do $x$ begin
  update public.fichas set aprovada_por = (select id from public.equipe where papel = 'coord_geral'), aprovada_em = '2020-01-01' where id = 'e1000000-0000-0000-0000-000000000006';
  if (select aprovada_por from public.fichas where id = 'e1000000-0000-0000-0000-000000000006') is not null then raise exception 'forjou'; end if; end $x$$q$, 'ok');
select f(:T, $q$update public.fichas set situacao = 'aprovada', aprovada_por = (select id from public.equipe where papel = 'coord_geral'), aprovada_em = '2020-01-01'$q$ || :'F6');
select t('ficha: ao aprovar, quem aprova é quem está logada e a hora é a de agora', :T, $q$do $x$ declare d public.fichas; begin
  select * into d from public.fichas where id = 'e1000000-0000-0000-0000-000000000006';
  if d.aprovada_por is distinct from public.meu_id() or d.aprovada_em < now() - interval '5 minutes' then raise exception 'por % em %', d.aprovada_por, d.aprovada_em; end if; end $x$$q$, 'ok');
select t('ficha aprovada: coordenação geral NÃO troca quem aprovou nem a data', :G, $q$do $x$ declare d public.fichas; begin
  update public.fichas set aprovada_por = public.meu_id(), aprovada_em = '2020-01-01' where id = 'e1000000-0000-0000-0000-000000000006';
  select * into d from public.fichas where id = 'e1000000-0000-0000-0000-000000000006';
  if d.aprovada_por = public.meu_id() or d.aprovada_em < now() - interval '5 minutes' then raise exception 'trocou'; end if; end $x$$q$, 'ok');
select t('ficha devolvida depois de aprovada fica sem aprovador', :T, $q$do $x$ declare d public.fichas; begin
  update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Conferir o endereço' where id = 'e1000000-0000-0000-0000-000000000006';
  select * into d from public.fichas where id = 'e1000000-0000-0000-0000-000000000006';
  if d.aprovada_por is not null or d.aprovada_em is not null then raise exception 'ficou com aprovador'; end if; end $x$$q$, 'ok');
select t('ficha aprovada que volta para análise (pela coordenação geral) fica sem aprovador', :G, $q$do $x$ declare d public.fichas; begin
  update public.fichas set situacao = 'aguardando' where id = 'e1000000-0000-0000-0000-000000000006';
  select * into d from public.fichas where id = 'e1000000-0000-0000-0000-000000000006';
  if d.aprovada_por is not null or d.aprovada_em is not null then raise exception 'ficou com aprovador'; end if; end $x$$q$, 'ok');

-- ===== 7. fichas: datas e CPF =====
create or replace function qa_fi(p_cpf text, p_nasc text, p_data text, p_resultado text default 'selecionada') returns text language sql as $$
  select format($q$insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha)
    values (gen_random_uuid(), 'BA', 'Juazeiro', 'Lagoa Auditoria', 'Maria Ficha Nova', %L, (%s)::date, 'Sítio novo', true,%s,true,true,true,true,true,true,true,true, %L, (%s)::date)$q$,
    p_cpf, p_nasc, case when p_resultado = 'nao_atende' then 'false' else 'true' end, p_resultado, p_data) $$;
select t('ficha com data no futuro é recusada', :BB, qa_fi('92000000001', $q$'1980-01-01'$q$, $q$public.fic_hoje() + 1$q$), 'data da ficha não pode ser no futuro');
select t('menor de idade NÃO passa como selecionada pondo a data da ficha no futuro', :BB, qa_fi('92000000002', $q$public.fic_hoje() - interval '15 years'$q$, $q$public.fic_hoje() + interval '4 years'$q$), 'data da ficha não pode ser no futuro');
select t('ficha com data de 1900 é recusada', :BB, qa_fi('92000000003', $q$'1880-01-01'$q$, $q$'1900-01-01'$q$, 'nao_atende'), 'anterior a 01/01/2026');
select t('ficha com data anterior ao projeto (2025) é recusada', :BB, qa_fi('92000000004', $q$'1980-01-01'$q$, $q$'2025-12-31'$q$), 'anterior a 01/01/2026');
select t('ficha com nascimento no futuro é recusada', :BB, qa_fi('92000000005', $q$public.fic_hoje() + 1$q$, $q$public.fic_hoje()$q$, 'nao_atende'), 'nascimento não pode ser no futuro');
select t('ficha com nascimento em 1900 é recusada', :BB, qa_fi('92000000006', $q$'1900-01-01'$q$, $q$public.fic_hoje()$q$), 'data de nascimento');
select t('ficha com CPF 00000000000 é recusada', :BB, qa_fi('00000000000', $q$'1980-01-01'$q$, $q$public.fic_hoje()$q$), 'CPF inválido');
select t('ficha com CPF 11111111111 é recusada', :BB, qa_fi('11111111111', $q$'1980-01-01'$q$, $q$public.fic_hoje()$q$), 'CPF inválido');
select t('ficha de hoje, com nascimento e CPF comuns, é aceita', :BB, qa_fi('92000000007', $q$'1980-01-01'$q$, $q$public.fic_hoje()$q$), 'ok');
select t('ficha de 01/01/2026 (primeiro dia aceito) é aceita', :BB, qa_fi('92000000008', $q$'1950-05-20'$q$, $q$'2026-01-01'$q$), 'ok');
\set F5 ' where id = ''e1000000-0000-0000-0000-000000000005'''
select t('ficha antiga (data de 2025) continua podendo ser aprovada', :T, $q$update public.fichas set situacao = 'aprovada'$q$ || :'F5', 'ok');
select t('ficha antiga continua podendo ser corrigida em outro campo', :BB, $q$update public.fichas set celular = '(74) 99999-0000'$q$ || :'F5', 'ok');
select t('mudar a data de uma ficha para antes do projeto é recusado', :BB, $q$update public.fichas set data_ficha = '2025-07-01'$q$ || :'F5', 'anterior a 01/01/2026');
select t('mudar o CPF de uma ficha para dígitos repetidos é recusado', :BB, $q$update public.fichas set cpf = '22222222222'$q$ || :'F5', 'CPF inválido');

-- ===== 6. pagamentos =====
create or replace function qa_aj(p_valor text) returns text language sql as $$
  select format($q$select public.solicitar_pagamento('ajuda_custo', public.fic_hoje(), %s, null,
    array['e2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002']::uuid[], '{}')$q$, p_valor) $$;
create or replace function qa_bo(p_valor text) returns text language sql as $$
  select format($q$select public.solicitar_pagamento('bolsa', public.fic_hoje(), %s, repeat('Relatório de atividades do mês. ', 3), null, '{}')$q$, p_valor) $$;
select t('ajuda de custo sem valor é recusada', :AG, qa_aj('null'), 'maior que zero');
select t('ajuda de custo de R$ 0 é recusada', :AG, qa_aj('0'), 'maior que zero');
select t('ajuda de custo de R$ 0,004 (viraria R$ 0,00) é recusada', :AG, qa_aj('0.004'), 'maior que zero');
select t('ajuda de custo negativa é recusada', :AG, qa_aj('-50'), 'maior que zero');
select t('ajuda de custo de R$ 99.999.999,99 por 2 visitas é recusada', :AG, qa_aj('99999999.99'), 'Valor acima do esperado para a ajuda de custo de 2 visita(s) (R$ 99.999.999,99');
select t('ajuda de custo de 1e12: mensagem clara (sem erro cru de número)', :AG, qa_aj('1e12'), 'Valor acima do esperado para a ajuda de custo de 2 visita(s) (R$ 1.000.000.000.000,00');
select t('ajuda de custo de R$ 4.000,01 por 2 visitas é recusada (R$ 2.000,00 por visita)', :AG, qa_aj('4000.01'), 'Valor acima do esperado');
select t('ajuda de custo de R$ 4.000,00 por 2 visitas é aceita', :AG, qa_aj('4000'), 'ok');
select f(:AG, qa_aj('856'));
select s.id as saj from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id where e.email = 'qa.ag@t.com' and s.tipo = 'ajuda_custo' \gset
\set SAJ '''' :saj '''::uuid'
select t('aval de R$ 0,004 é recusado', :T, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 0.004)', 'maior que zero');
select t('aval de R$ 0 é recusado', :T, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 0)', 'maior que zero');
select t('aval de 1e12: mensagem clara', :T, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 1e12)', 'Valor acima do esperado para a ajuda de custo');
select t('aval de ajuda de custo 100 vezes o pedido (R$ 85.600) é recusado', :T, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 85600)', 'Valor acima do esperado para a ajuda de custo de 2 visita(s) (R$ 85.600,00');
select t('aval de ajuda de custo pode subir dentro do teto (a coordenação confere o km)', :T, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 1200)', 'ok');
select t('aval de R$ 700,004 grava R$ 700,00', :T, $q$do $x$ begin perform public.avalizar_pagamento($q$ || :'SAJ' || $q$, true, null, 700.004);
  if (select valor_avalizado from public.solicitacoes_pagamento where id = $q$ || :'SAJ' || $q$) <> 700.00 then raise exception 'não arredondou'; end if; end $x$$q$, 'ok');
select t('quem avaliza NÃO mudou: bolsista não dá aval', :BB, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 856)', 'O aval desta solicitação é da coordenação técnica');
select t('quem avaliza NÃO mudou: auxiliar não dá aval', :X, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, 856)', 'O aval desta solicitação é da coordenação técnica');
select f(:T, 'select public.avalizar_pagamento(' || :'SAJ' || ', true, null, null)');
select t('aval sem informar valor usa o valor pedido', :T, $q$do $x$ begin if (select valor_avalizado from public.solicitacoes_pagamento where id = $q$ || :'SAJ' || $q$) <> 856 then raise exception 'outro valor'; end if; end $x$$q$, 'ok');
select t('lançamento no Arlo do pagamento com aval continua funcionando', :X, 'select public.registrar_no_arlo(' || :'SAJ' || $q$, 'ARLO-1')$q$, 'ok');
select t('quem lança NÃO mudou: técnica não lança no Arlo', :T, 'select public.registrar_no_arlo(' || :'SAJ' || $q$, 'ARLO-1')$q$, 'auxiliar administrativo');
update public.solicitacoes_pagamento set valor_avalizado = 85600 where id = :'saj';
select t('lançamento de aval antigo fora do esperado é recusado', :X, 'select public.registrar_no_arlo(' || :'SAJ' || $q$, 'ARLO-1')$q$, 'Valor acima do esperado para a ajuda de custo');
update public.solicitacoes_pagamento set valor_avalizado = 0 where id = :'saj';
select t('lançamento de aval zerado é recusado', :X, 'select public.registrar_no_arlo(' || :'SAJ' || $q$, 'ARLO-1')$q$, 'sem valor de aval');
update public.solicitacoes_pagamento set valor_avalizado = 856 where id = :'saj';
select t('bolsa sem valor é recusada', :BB, qa_bo('null'), 'maior que zero');
select t('bolsa de R$ 0 é recusada', :BB, qa_bo('0'), 'maior que zero');
select t('bolsa negativa é recusada', :BB, qa_bo('-1400'), 'maior que zero');
select t('bolsa de R$ 99.999.999,99 é recusada', :BB, qa_bo('99999999.99'), 'Valor acima do esperado para a bolsa do mês (R$ 99.999.999,99');
select t('bolsa de R$ 10.000,01 é recusada', :BB, qa_bo('10000.01'), 'Valor acima do esperado para a bolsa');
select t('bolsa de 1e12: mensagem clara', :BB, qa_bo('1e12'), 'Valor acima do esperado para a bolsa');
select t('bolsa de R$ 10.000,00 (limite) é aceita', :BB, qa_bo('10000'), 'ok');
select f(:BB, qa_bo('1400'));
select s.id as sbo from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id where e.email = 'art.ba@t.com' and s.tipo = 'bolsa' \gset
\set SBO '''' :sbo '''::uuid'
select t('aval de bolsa de 1e12: mensagem clara', :T, 'select public.avalizar_pagamento(' || :'SBO' || ', true, null, 1e12)', 'Valor acima do esperado para a bolsa');
select t('aval de bolsa acima do pedido continua recusado (regra do 42)', :T, 'select public.avalizar_pagamento(' || :'SBO' || ', true, null, 1401)', 'passa do valor pedido');
select t('aval de bolsa no valor pedido é aceito', :T, 'select public.avalizar_pagamento(' || :'SBO' || ', true, null, 1400)', 'ok');

-- ===== 9. mensagens de valor =====
select t('valor em reais no padrão brasileiro, também os grandes', null, $q$do $x$ begin
  if public.brl(1e12) <> 'R$ 1.000.000.000.000,00' then raise exception '1e12 = %', public.brl(1e12); end if;
  if public.brl(70000) <> 'R$ 70.000,00' or public.brl(0.5) <> 'R$ 0,50' or public.brl(null) <> 'R$ 0,00' or public.brl(-1234.5) <> 'R$ -1.234,50' then raise exception 'formato mudou'; end if;
  if public.brl(5000.004) <> 'R$ 5.000,00' or public.brl(1e20) like '%#%' then raise exception 'arredondamento'; end if; end $x$$q$, 'ok');
select t('teto de passagens: a mensagem mostra os valores no padrão brasileiro', :G, format($q$do $x$ declare m text; begin
  perform public.definir_valor_pedido(%L, 69500);
  begin perform public.mover_pedido_apoio(%L, 'autorizar', null, 'PROT-9'); m := 'autorizou';
  exception when others then m := sqlerrm; end;
  if m !~ 'teto de passagens de intercâmbio \(R\$ 70\.000,00\): já autorizado R\$ [0-9.]+,[0-9]{2}, saldo R\$ [0-9.]+,[0-9]{2}\.$' then raise exception '%%', m; end if; end $x$$q$, :'pconf', :'pconf'), 'ok');
select t('teto de eventos: a mensagem mostra os valores no padrão brasileiro', :G, $q$do $x$ declare m text; p uuid; begin
  select id into p from public.pedidos_apoio where tipo = 'evento' and situacao = 'conferido' limit 1;
  if p is null then raise exception 'sem pedido de evento conferido no cenário'; end if;
  perform public.definir_valor_pedido(p, 5999);
  begin perform public.mover_pedido_apoio(p, 'autorizar', null, 'PROT-9'); m := 'autorizou';
  exception when others then m := sqlerrm; end;
  if m !~ 'teto de eventos de [A-Z]{2} \(R\$ 6\.000,00\): já autorizado R\$ [0-9.]+,[0-9]{2}, saldo R\$ [0-9.]+,[0-9]{2}\.$' then raise exception '%', m; end if; end $x$$q$, 'ok');

-- ===== 10. equipe: datas =====
create or replace function qa_eq(p_inicio text, p_n int) returns text language sql as $$
  select format($q$insert into public.equipe (papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd)
    values ('agente', 'BA', 'Agente Data Nova', %L, %L, (%s)::date, true)$q$, (93000000000 + p_n)::text, 'qa.data' || p_n || '@t.com', p_inicio) $$;
select t('cadastro com início em 1900 é recusado', :T, qa_eq($q$'1900-01-01'$q$, 1), 'data de início');
select t('cadastro com início em 2090 é recusado', :T, qa_eq($q$'2090-01-01'$q$, 2), 'data de início');
select t('cadastro com início em 2024 é recusado', :T, qa_eq($q$'2024-12-31'$q$, 3), 'data de início');
select t('cadastro com início hoje é aceito', :T, qa_eq($q$public.fic_hoje()$q$, 4), 'ok');
select t('cadastro com início daqui a 2 meses é aceito', :T, qa_eq($q$public.fic_hoje() + 60$q$, 5), 'ok');
select t('termo assinado no futuro é recusado', :G, format($q$update public.equipe set termo_assinado_em = '2090-01-01' where id = %L$q$, :'ag2'), 'termo assinado');
select t('cadastro no Arlo com data no futuro é recusado', :X, format($q$update public.equipe set docs_funcern_em = public.fic_hoje() + 1 where id = %L$q$, :'ag2'), 'cadastro no Arlo');
select t('cadastro no Arlo com data de 2020 é recusado', :X, format($q$update public.equipe set docs_funcern_em = '2020-01-01' where id = %L$q$, :'ag2'), 'cadastro no Arlo');
select t('matrícula no FIC com data no futuro é recusada (também por dentro do banco)', null, format($q$do $x$ begin set local role none;
  update public.equipe set matricula_fic_em = '2090-01-01', matricula_fic_numero = '2026555' where id = %L; end $x$$q$, :'ag2'), 'matrícula no FIC');
select t('auxiliar continua registrando Arlo e termo com a data de hoje', :X, format($q$update public.equipe set docs_funcern_em = public.fic_hoje(), termo_assinado_em = public.fic_hoje() where id = %L$q$, :'ag2'), 'ok');
select t('desligamento com data no futuro é recusado', :T, format($q$update public.equipe set status = 'desligada', data_fim = public.fic_hoje() + 30, motivo_desligamento = 'vai sair do projeto' where id = %L$q$, :'ag2'), 'desligamento não pode ser no futuro');
select t('desligamento com a data de hoje continua funcionando', :T, format($q$update public.equipe set status = 'desligada', data_fim = public.fic_hoje(), motivo_desligamento = 'saiu do projeto' where id = %L$q$, :'ag2'), 'ok');
select t('cadastro antigo (início em 2020) continua podendo ser alterado em outro campo', :T, $q$update public.equipe set telefone = '(74) 98888-0000' where email = 'qa.antiga@t.com'$q$, 'ok');
select t('mudar o início de um cadastro para 1900 é recusado', :T, $q$update public.equipe set data_inicio = '1900-01-01' where email = 'qa.antiga@t.com'$q$, 'data de início');

-- ===== 1 e 2 (de novo, agora com pagamentos e pedidos de verdade no banco). varredura geral =====
-- varredura: TODAS as funções que o app alcança, chamadas pela conta sem cadastro e pela desligada, com registros de verdade
create temp table qa_arg (fn text, arg text, expr text);
insert into qa_arg values
  ('gerar_codigo_acesso', 'p_equipe', $q$(select id from public.equipe where email = 'ag2@t.com')$q$),
  ('ver_conta_para_arlo', 'p_equipe', $q$(select id from public.equipe where email = 'qa.ag@t.com')$q$),
  ('pendencias_campo', 'p_id', $q$(select id from public.equipe where email = 'qa.ag@t.com')$q$),
  ('mover_pedido_apoio', 'p_id', $q$(select id from public.pedidos_apoio where situacao = 'enviado' limit 1)$q$),
  ('mover_pedido_apoio', 'p_acao', $q$'cancelar'$q$),
  ('definir_valor_pedido', 'p_id', $q$(select id from public.pedidos_apoio where situacao = 'conferido' limit 1)$q$),
  ('salvar_pedido_apoio', 'p_tipo', $q$'evento'$q$), ('salvar_pedido_apoio', 'p_data', $q$current_date + 60$q$), ('salvar_pedido_apoio', 'p_dados', $q$'{"valor_estimado": 100}'$q$),
  ('avalizar_pagamento', 'p_id', $q$(select id from public.solicitacoes_pagamento where situacao = 'solicitada' limit 1)$q$),
  ('registrar_no_arlo', 'p_id', $q$(select id from public.solicitacoes_pagamento where situacao = 'avalizada' limit 1)$q$),
  ('solicitar_pagamento', 'p_tipo', $q$'bolsa'$q$), ('solicitar_pagamento', 'p_relatorio', $q$repeat('relatório do mês ', 5)$q$),
  ('cancelar_encontro_fic', 'p_id', $q$(select id from public.fic_encontros where cancelado_em is null limit 1)$q$),
  ('confirmar_presenca_fic', 'p_encontro', $q$(select id from public.fic_encontros where cancelado_em is null limit 1)$q$),
  ('cancelar_matricula_fic', 'p_id', $q$(select id from public.matriculas_fic where cancelada_em is null limit 1)$q$),
  ('matricular_fic', 'p_turma', $q$(select id from public.turmas_fic where uf is null limit 1)$q$),
  ('matricular_fic', 'p_equipe', $q$(select id from public.equipe where email = 'qa.ag@t.com')$q$), ('matricular_fic', 'p_numero', $q$'2026123'$q$),
  ('pode_matricular', 'p_turma', $q$(select id from public.turmas_fic limit 1)$q$),
  ('registrar_encontro_fic', 'p_id', 'null'), ('registrar_encontro_fic', 'p_turma', $q$(select id from public.turmas_fic limit 1)$q$),
  ('registrar_encontro_fic', 'p_carga', '2'), ('registrar_encontro_fic', 'p_modalidade', $q$'online'$q$),
  ('pode_gerenciar', 'p_papel', $q$'agente'$q$), ('criar_convite', 'p_papel', $q$'agente'$q$), ('criar_convite', 'p_uf', $q$'BA'$q$), ('criar_convite', 'p_substitui', 'null'),
  ('ficha_atribuida', 'p_ficha', $q$'e1000000-0000-0000-0000-000000000001'$q$),
  ('registrar_orientacao_venda', 'p_ficha', $q$'e1000000-0000-0000-0000-000000000001'$q$), ('registrar_orientacao_venda', 'p_dados', $q$'{"sobra": [], "caf": "sim"}'$q$),
  ('registrar_situacao_agua', 'p_ficha', $q$(select id from public.fichas where resultado = 'sem_agua' limit 1)$q$), ('registrar_situacao_agua', 'p_situacao', $q$'em_andamento'$q$),
  ('salvar_canal_venda', 'p_id', 'null'), ('salvar_canal_venda', 'p_uf', $q$'BA'$q$), ('salvar_canal_venda', 'p_tipo', $q$'feira'$q$),
  ('registrar_acesso', 'p_tipo', $q$'entrada'$q$),
  ('salvar_meus_dados_bancarios', 'p', $q$'{"banco_codigo":"001","banco_nome":"BB","agencia":"1","conta":"2","conta_dv":"3"}'$q$);
-- devolve, para cada função, o que a conta conseguiu: "recusada", "vazio", "DADO" (recebeu informação) ou "GRAVOU"
create or replace function qa_varre(quem uuid) returns table (funcao text, saida text) language plpgsql as $$
declare r record; i int; args text; v text; ex text; cmd text; n int; val text; w0 bigint; w1 bigint;
begin
  for r in select p.oid, p.proname, p.pronargs, p.proargnames, p.proargtypes, p.prorettype
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and has_function_privilege('authenticated', p.oid, 'EXECUTE')
              and (p.prosecdef or p.proacl is not null)       -- as do sistema (as de apoio dos testes não têm permissão própria)
            order by p.proname loop
    args := '';
    for i in 1..r.pronargs loop
      select a.expr into ex from qa_arg a where a.fn = r.proname and a.arg = r.proargnames[i];
      if not found then
        ex := case r.proargtypes[i - 1]::regtype::text
                when 'uuid' then 'null' when 'text' then $q$'texto de teste da auditoria'$q$ when 'numeric' then '100' when 'date' then 'current_date'
                when 'boolean' then 'true' when 'jsonb' then $q$'{}'$q$ when 'uuid[]' then $q$'{}'$q$ else 'null' end;
      end if;
      execute 'select (' || ex || ')::text' into v;            -- resolve como superusuário (o id existe de verdade)
      args := args || case when i > 1 then ', ' else '' end || coalesce(quote_literal(v), 'null') || '::' || r.proargtypes[i - 1]::regtype::text;
    end loop;
    cmd := format('select count(*), left(string_agg(x::text, %L), 120) from (select public.%I(%s) as x) q where not (x is null)', ' | ', r.proname, args);
    begin
      perform set_config('request.jwt.claim.sub', quem::text, true);
      perform set_config('role', 'authenticated', true);
      select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) into w0 from pg_stat_xact_user_tables;
      execute cmd into n, val;
      select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) into w1 from pg_stat_xact_user_tables;
      raise exception 'QA_FIM %', case when w1 > w0 then 'GRAVOU' when n = 0 or coalesce(val, '') in ('', 'false', '0', '{}', '[]') or val ~ '^\(,*\)$' then 'vazio' else 'DADO: ' || val end;
    exception when others then
      saida := case when sqlerrm like 'QA_FIM %' then substr(sqlerrm, 8) else 'recusada: ' || left(sqlerrm, 90) end;
    end;
    perform set_config('role', 'none', true);
    funcao := r.proname; return next;
  end loop;
end $$;
-- abertas de propósito (tela de entrada, vitrine pública e link de cadastro): não dão dado pessoal a ninguém
create temp table qa_abertas (fn text);
insert into qa_abertas values ('ver_convite'), ('vitrine'), ('vitrine_municipios'), ('pedir_novo_acesso'), ('enviar_pre_cadastro');
create temp table qa_varredura as
  select 'sem cadastro' as conta, v.* from qa_varre(:NOEQ) v union all select 'desligada', v.* from qa_varre(:DESL) v union all select 'coordenação geral', v.* from qa_varre(:G) v;
insert into res (caso, ok, det) select 'varredura: conta SEM CADASTRO chama todas as funções do app e não recebe dado nem grava nada',
  count(*) filter (where saida ~ '^(DADO|GRAVOU)' and funcao not in (select fn from qa_abertas)) = 0 and count(*) >= 35,
  coalesce(string_agg(funcao || ' → ' || saida, '; ') filter (where saida ~ '^(DADO|GRAVOU)' and funcao not in (select fn from qa_abertas)), count(*) || ' funções, todas recusadas ou vazias')
  from qa_varredura where conta = 'sem cadastro';
insert into res (caso, ok, det) select 'varredura: conta DESLIGADA chama todas as funções do app e não recebe dado nem grava nada',
  count(*) filter (where saida ~ '^(DADO|GRAVOU)' and funcao not in (select fn from qa_abertas)) = 0 and count(*) >= 35,
  coalesce(string_agg(funcao || ' → ' || saida, '; ') filter (where saida ~ '^(DADO|GRAVOU)' and funcao not in (select fn from qa_abertas)), count(*) || ' funções, todas recusadas ou vazias')
  from qa_varredura where conta = 'desligada';
insert into res (caso, ok, det) select 'varredura (controle): a mesma varredura, com a coordenação geral, recebe dado ou grava em várias funções',
  count(*) filter (where saida ~ '^(DADO|GRAVOU)' and funcao in ('gerar_codigo_acesso', 'pendencias_campo', 'saldo_passagens_eventos', 'quem_confere_pedidos',
                                                               'tem_professor_fic_habilitado', 'pode_gerenciar', 'meu_papel', 'situacao_bancaria', 'equipe_para_fic', 'registrar_acesso')) = 10,
  coalesce(string_agg(funcao || ' → ' || saida, '; ') filter (where saida !~ '^(DADO|GRAVOU)' and funcao in ('gerar_codigo_acesso', 'pendencias_campo', 'saldo_passagens_eventos', 'quem_confere_pedidos',
    'tem_professor_fic_habilitado', 'pode_gerenciar', 'meu_papel', 'situacao_bancaria', 'equipe_para_fic', 'registrar_acesso')), 'as 10 funções de controle responderam')
  from qa_varredura where conta = 'coordenação geral';
-- o mesmo para as tabelas: nenhuma linha de nenhuma tabela
create or replace function qa_tabelas(quem uuid) returns text language plpgsql as $$
declare r record; n bigint; achou text := '';
begin
  for r in select c.oid::regclass::text as tb from pg_class c where c.relkind in ('r', 'v') and c.relnamespace in ('public'::regnamespace, 'storage'::regnamespace)
            and c.relname not in ('res') and c.relpersistence = 'p' and has_table_privilege('authenticated', c.oid, 'SELECT') loop
    begin
      perform set_config('request.jwt.claim.sub', quem::text, true);
      perform set_config('role', 'authenticated', true);
      execute 'select count(*) from ' || r.tb into n;
      perform set_config('role', 'none', true);
      if n > 0 then achou := achou || r.tb || '=' || n || ' '; end if;
    exception when others then perform set_config('role', 'none', true);
    end;
  end loop;
  return achou;
end $$;
insert into res (caso, ok, det) select 'conta sem cadastro não lê nenhuma linha de nenhuma tabela (nem valores de pagamento, APL e fotos da equipe)', x = '', x from qa_tabelas(:NOEQ) x;
insert into res (caso, ok, det) select 'conta desligada não lê nenhuma linha de nenhuma tabela (nem o próprio cadastro antigo)', x = '', x from qa_tabelas(:DESL) x;

delete from storage.objects where name = 'e0000000-0000-0000-0000-000000000001/foto.jpg';

-- o script pode rodar de novo e não apaga nada
select t('o script 45 só redefine funções, gatilhos e regras de leitura (verificação do que ficou instalado)', null, $q$do $x$ begin set local role none;
  if (select prosrc from pg_proc where proname = 'pode_gerenciar' and pronamespace = 'public'::regnamespace) not like '%coalesce(case%' then raise exception 'pode_gerenciar'; end if;
  if (select prosrc from pg_proc where proname = 'gerar_codigo_acesso' and pronamespace = 'public'::regnamespace) not like '%coalesce(public.pode_gerenciar(m.papel), false)%' then raise exception 'gerar_codigo_acesso'; end if;
  if (select count(*) from pg_trigger where tgname in ('fichas_b_conferir', 'diagnosticos_b_aprovacao', 'equipe_b_datas') and not tgisinternal) <> 3 then raise exception 'gatilhos'; end if;
  if exists (select 1 from pg_policies where policyname in ('parametros_ler', 'apl_ler') and qual = 'true') then raise exception 'leitura aberta'; end if;
  if has_function_privilege('anon', 'public.gerar_codigo_acesso(uuid)', 'EXECUTE') or has_function_privilege('anon', 'public.pendencias_campo(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.solicitar_pagamento(text, date, numeric, text, uuid[], jsonb)', 'EXECUTE') then raise exception 'anônimo alcança'; end if; end $x$$q$, 'ok');

\pset tuples_only off
select conta, funcao, left(saida, 110) as saida from qa_varredura where conta <> 'coordenação geral' and (saida !~ '^recusada' ) order by 1, 2;
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
-- arruma o que o teste deixou (os outros testes desta sessão não dependem destes registros)
drop table qa_arg, qa_abertas, qa_varredura;
drop function qa_varre(uuid), qa_tabelas(uuid), qa_fi(text, text, text, text), qa_aj(text), qa_bo(text), qa_eq(text, int);
alter table public.equipe disable trigger user;
update public.equipe set user_id = null where email = 'qa.desl@t.com';
alter table public.equipe enable trigger user;
