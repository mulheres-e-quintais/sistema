-- =====================================================================
-- Mulheres & Quintais — 47: CORREÇÕES DA AUDITORIA DO BANCO DE DADOS (02/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Rode depois do 46. NÃO APAGA NENHUM DADO DE NEGÓCIO e não muda nenhum registro que já existe: só acrescenta
-- índices, travas (constraints "NOT VALID": valem para o que for gravado daqui em diante, não conferem as linhas
-- antigas e não reescrevem tabela), gatilhos e funções. As conferências novas valem só para os próximos registros
-- (ou quando o campo conferido muda): o registro antigo que não cumpre a regra nova continua podendo ser aprovado,
-- devolvido, cancelado e corrigido.
--
-- A. DESEMPENHO COM A SEGURANÇA POR LINHA. O agente de campo lendo as fichas dos quintais que visita levava 46 ms com o
--    volume do projeto, 3,6 s com 10 vezes e 5 minutos com 100 vezes: a regra de acesso procurava as visitas dele uma vez
--    por ficha. Agora a lista dos quintais dele é montada uma vez por consulta, e "quem sou eu, meu papel, meu estado"
--    são calculados uma vez por consulta em TODAS as regras de acesso (o significado de cada regra não muda).
--    Índices novos nas colunas mais consultadas.
-- B. EDIÇÃO AO MESMO TEMPO. Duas pessoas (ou o celular reenviando horas depois) gravando o mesmo diagnóstico, ficha,
--    visita ou avaliação: a última gravação vencia em silêncio. Agora a tela manda a marca ("atualizado_em") do que leu;
--    se o registro mudou depois disso, a gravação é recusada com aviso. Sem a marca (celular com a versão antiga da
--    tela, gatilhos internos, SQL Editor), grava como antes.
-- C. PRIVILÉGIOS. O Supabase concede tudo a "anon" e "authenticated" em cada tabela, função e numeração nova; os scripts
--    tiravam caso a caso. Agora: quem não entrou no sistema (anon) não tem privilégio em nenhuma tabela nem numeração e
--    só executa as cinco funções públicas de propósito (ver o link de cadastro, enviar o cadastro, pedir novo acesso e
--    as duas da vitrine); quem entrou não tem TRUNCATE/REFERENCES/TRIGGER nem grava direto no histórico, nos exemplos,
--    nos usos da IA e nas matrículas; o que for criado daqui para a frente já nasce fechado; todas as funções que rodam
--    com o direito do banco passam a procurar tabelas só em "public" (search_path = public, pg_temp).
-- D. TAMANHO DE TEXTO. Nome de 1 milhão de letras, "dados" de 5 MB e kit com 100 mil itens eram aceitos (e copiados
--    para o histórico a cada alteração). Agora cada texto tem limite no banco (igual ou um pouco acima do da tela),
--    conferido ao gravar ou quando o campo muda, com mensagem que diz o campo.
-- E. LOGIN DE QUEM SAIU. No desligamento (ou quando o e-mail do cadastro é trocado) o login da pessoa é removido: se ela
--    voltar ao projeto com o mesmo e-mail, consegue criar a senha de novo. Fica no histórico. Logins antigos sem pessoa
--    NÃO são apagados por este script (o 90_auditoria_dados.sql mostra quantos há, item I03).
-- F. Matricular × cancelar matrícula × desligar travavam a pessoa e a matrícula em ordens opostas (deadlock): agora
--    todos travam a pessoa primeiro.
-- G. Aprovar o cadastro vindo do link passa a ser UMA operação (aprovar_pre_cadastro): pessoa na equipe, dados pessoais
--    e cadastro enviado marcado como aprovado, tudo ou nada.
-- H. Seis conferências que podiam ser furadas por duas gravações no mesmo instante passam a esperar uma pela outra:
--    desligar × agendar visita; desligar × pedir pagamento; lançar no Arlo × mudar o km; pedir pagamento × mudar a
--    data da visita; bolsa do professor × registrar encontro; devolver a ficha × registrar o diagnóstico.
-- I. Espera por trava: no máximo 5 segundos (3 para quem não entrou). Estourou: "O sistema está ocupado com outra
--    gravação. Tente de novo em instantes."
-- J. Repetição depois de falha de rede (o primeiro envio tinha chegado): pedido de passagem/evento, orientação de venda,
--    link de cadastro e documento iguais, da mesma pessoa, em menos de 2 minutos, não são gravados duas vezes.
-- K. Miúdos: o identificador de um registro não muda; um CPF só aguardando conferência nos cadastros enviados por link;
--    nome com parêntese na legenda da vitrine não dá mais erro; canal de venda e APL comparados sem acento; estado (UF)
--    com lista fechada em todas as tabelas; substituição sem círculo; limite diário da IA sob concorrência; parâmetros
--    só com chave conhecida; nascimento da equipe entre 1900 e 16 anos atrás; totais da planilha de execução válidos;
--    dígito verificador do CPF conferido no banco (ficha, equipe e cadastro pelo link).
--
-- ORDEM DAS TRAVAS (para não haver deadlock; toda função ou gatilho novo segue esta ordem):
--   1. links e cadastros enviados (convites, pre_cadastros): sempre a primeira trava de quem os usa
--   2. PESSOA (linha de equipe): exclusiva em matricular, cancelar matrícula e desligar; compartilhada em agendar visita
--      (quem faz a visita) e em pedir pagamento (a própria pessoa)
--   3. travas "de aviso" por pessoa (pedido de pagamento/bolsa, encontro do FIC do professor, uso da IA, link, documento)
--   4. travas "de aviso" de limite (40 fichas e 200 dias por estado, tetos de passagens/eventos, lista de espera, canal,
--      encontro por turma e dia, número de matrícula)
--   5. FICHAS  ->  6. DIAGNÓSTICOS e AVALIAÇÕES  ->  7. VISITAS  ->  8. km da visita (custos_visita)
--   9. PEDIDOS DE PAGAMENTO (solicitacoes_pagamento) e as visitas de cada pedido  ->  10. matrículas, encontros e presenças
--  Exceção conferida: alterar uma visita trava a visita e depois lê o cadastro de quem a faz em modo compartilhado
--  (7 -> 2). Não fecha círculo porque quem trava a pessoa em modo exclusivo (matricular, cancelar matrícula, desligar)
--  nunca espera por linha de visita.
-- =====================================================================
begin;

-- =====================================================================
-- 0. FERRAMENTAS
-- =====================================================================
-- CPF de verdade: 11 números (pontos e traço são ignorados), não todos iguais, com os dois dígitos verificadores certos.
-- É a mesma conta de R.cpfValido (js/regras.js).
create or replace function public.cpf_valido(p text) returns boolean language sql immutable as $$
  select case
    when c !~ '^[0-9]{11}$' or c ~ '^(\d)\1{10}$' then false
    else (select (case when d1 = 10 then 0 else d1 end) = substr(c, 10, 1)::int and (case when d2 = 10 then 0 else d2 end) = substr(c, 11, 1)::int
            from (select ((select sum(substr(c, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10) % 11 as d1,
                         ((select sum(substr(c, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10) % 11 as d2) x)
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as c) y
$$;

-- I. Trava "de aviso" com espera de no máximo 5 segundos e mensagem em português quando estoura.
create or replace function public.trava_aviso(p_chave text) returns void
language plpgsql set search_path = public, pg_temp set lock_timeout = '5s' as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_chave));
exception when lock_not_available then
  raise exception 'O sistema está ocupado com outra gravação. Tente de novo em instantes.' using errcode = '55P03';
end $$;

-- K. O identificador (chave) de um registro não muda: o histórico e os vínculos apontam para ele.
create or replace function public.chave_fixa() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) -> tg_argv[0]) is distinct from (to_jsonb(old) -> tg_argv[0]) then
    raise exception 'O identificador deste registro não muda.';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['visitas', 'diagnosticos', 'avaliacoes', 'equipe', 'turmas_fic', 'fichas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists a00_chave_fixa on public.%I', t);
      execute format('create trigger a00_chave_fixa before update on public.%I for each row execute function public.chave_fixa(''id'')', t);
    end if;
  end loop;
  drop trigger if exists a00_chave_fixa on public.parametros;
  create trigger a00_chave_fixa before update on public.parametros for each row execute function public.chave_fixa('chave');
end $$;

-- =====================================================================
-- D. TAMANHO DE TEXTO E DE JSON
-- =====================================================================
-- Gatilho único: recebe trios (coluna, limite, nome do campo para a mensagem). Confere só o que está sendo gravado
-- pela primeira vez ou o campo que MUDOU: registro antigo com texto maior continua podendo ser aprovado, devolvido etc.
-- (No reenvio pela tela, que tenta incluir de novo um registro que já existe, compara com o que já está gravado.)
create or replace function public.limites_texto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n jsonb := to_jsonb(new); o jsonb; i int := 0; col text; lim int; rot text; tam int; lista jsonb;
begin
  if tg_op = 'UPDATE' then o := to_jsonb(old);
  elsif tg_table_name in ('fichas', 'visitas', 'diagnosticos', 'avaliacoes', 'turmas_fic') then
    if tg_table_name = 'fichas' then select to_jsonb(x) into o from public.fichas x where x.id = new.id;
    elsif tg_table_name = 'visitas' then select to_jsonb(x) into o from public.visitas x where x.id = new.id;
    elsif tg_table_name = 'diagnosticos' then select to_jsonb(x) into o from public.diagnosticos x where x.id = new.id;
    elsif tg_table_name = 'avaliacoes' then select to_jsonb(x) into o from public.avaliacoes x where x.id = new.id;
    else select to_jsonb(x) into o from public.turmas_fic x where x.id = new.id;
    end if;
  elsif tg_table_name = 'equipe_privado' then select to_jsonb(x) into o from public.equipe_privado x where x.equipe_id = new.equipe_id;
  elsif tg_table_name = 'parametros' then select to_jsonb(x) into o from public.parametros x where x.chave = new.chave;
  elsif tg_table_name = 'custos_visita' then select to_jsonb(x) into o from public.custos_visita x where x.visita_id = new.visita_id;
  elsif tg_table_name = 'apl_municipios' then select to_jsonb(x) into o from public.apl_municipios x where x.uf = new.uf and x.municipio = new.municipio;
  end if;
  while i + 2 < tg_nargs loop
    col := tg_argv[i]; lim := tg_argv[i + 1]::int; rot := tg_argv[i + 2]; i := i + 3;
    if coalesce(jsonb_typeof(n -> col), 'null') = 'null' then continue; end if;
    if o is not null and (o -> col) is not distinct from (n -> col) then continue; end if;   -- não mudou
    tam := case when jsonb_typeof(n -> col) = 'string' then length(n ->> col) else length((n -> col)::text) end;
    if tam > lim then
      raise exception 'Texto muito longo em % (máximo % caracteres).', rot, replace(to_char(lim, 'FM999,999,999'), ',', '.');
    end if;
  end loop;
  -- listas dentro do JSON: itens do kit, pessoas da família, passageiras
  if tg_table_name = 'diagnosticos' then
    lista := n -> 'dados' -> 'kit';
    if jsonb_typeof(lista) = 'array' and (o is null or lista is distinct from (o -> 'dados' -> 'kit')) then
      if jsonb_array_length(lista) > 60 then raise exception 'O kit tem itens demais (máximo 60 itens). Junte itens parecidos numa linha só.'; end if;
    end if;
    lista := n -> 'dados' -> 'familia';
    if jsonb_typeof(lista) = 'array' and (o is null or lista is distinct from (o -> 'dados' -> 'familia')) then
      if jsonb_array_length(lista) > 30 then raise exception 'A lista da família tem pessoas demais (máximo 30 pessoas).'; end if;
    end if;
  elsif tg_table_name = 'pedidos_apoio' then
    lista := n -> 'dados' -> 'passageiros';
    if jsonb_typeof(lista) = 'array' and (o is null or lista is distinct from (o -> 'dados' -> 'passageiros')) then
      if jsonb_array_length(lista) > 60 then raise exception 'A lista de passageiras tem pessoas demais (máximo 60).'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.limites_texto() from public, anon, authenticated;

-- A lista de limites: tabela, coluna, limite e o nome do campo como a pessoa conhece. Para cada tabela: o gatilho
-- "a0_tamanho" (mensagem clara) e, por coluna, a trava do banco "tam_<coluna>_<limite>" (NOT VALID: não confere as
-- linhas antigas). Se já houver linha antiga acima do limite, a trava daquela coluna NÃO é criada (ela impediria
-- qualquer alteração naquela linha): o gatilho continua valendo para os textos novos e o resultado no fim avisa.
drop table if exists pg_temp._47_limites;
create temp table _47_limites (tabela text, coluna text, limite int, rotulo text);   -- some sozinha quando a sessão termina (o resultado no fim a consulta)
insert into _47_limites values
  ('fichas', 'municipio', 120, 'município'), ('fichas', 'comunidade', 300, 'comunidade'), ('fichas', 'nome', 160, 'nome'), ('fichas', 'celular', 40, 'celular'),
  ('fichas', 'endereco', 300, 'endereço'), ('fichas', 'ponto_referencia', 300, 'ponto de referência'), ('fichas', 'caf', 60, 'CAF ou DAP'),
  ('fichas', 'indicada_por', 200, 'quem indicou'), ('fichas', 'testemunha_nome', 160, 'nome da testemunha'), ('fichas', 'encaminhada_para', 300, 'para onde foi encaminhada'),
  ('fichas', 'justificativa', 4000, 'justificativa'), ('fichas', 'obs_coordenacao', 4000, 'observação da coordenação'),
  ('fichas', 'foto_ficha_path', 300, 'arquivo da ficha'), ('fichas', 'foto_termo_path', 300, 'arquivo do termo'),
  ('visitas', 'obs', 2000, 'observação'), ('visitas', 'relato', 4000, 'relato da visita'), ('visitas', 'fotos', 6000, 'fotos da visita'),
  ('diagnosticos', 'codigo_quintal', 60, 'código do quintal'), ('diagnosticos', 'sem_gps_motivo', 1000, 'motivo de não haver localização'),
  ('diagnosticos', 'mes_implantacao', 160, 'mês da implantação'), ('diagnosticos', 'obs_coordenacao', 4000, 'observação da coordenação'),
  ('diagnosticos', 'dados', 100000, 'respostas do diagnóstico'), ('diagnosticos', 'fotos', 6000, 'fotos do diagnóstico'),
  ('avaliacoes', 'sem_gps_motivo', 1000, 'motivo de não haver localização'), ('avaliacoes', 'quintal_produz', 20, 'o quintal produz'), ('avaliacoes', 'ebia_nivel', 20, 'nível da EBIA'),
  ('avaliacoes', 'dados', 100000, 'respostas da avaliação'), ('avaliacoes', 'fotos', 6000, 'fotos da avaliação'),
  ('equipe', 'nome', 160, 'nome'), ('equipe', 'nome_social', 160, 'nome social'), ('equipe', 'email', 254, 'e-mail'), ('equipe', 'telefone', 40, 'telefone'),
  ('equipe', 'municipio', 120, 'município'), ('equipe', 'organizacao', 160, 'organização'), ('equipe', 'matricula_fic_numero', 40, 'número da matrícula'),
  ('equipe', 'motivo_desligamento', 2000, 'motivo do desligamento'), ('equipe', 'obs_habilitacao', 4000, 'observação da habilitação'),
  ('equipe', 'termo_path', 300, 'arquivo do termo'), ('equipe', 'foto_path', 300, 'arquivo da foto'),
  ('equipe_privado', 'endereco', 4000, 'endereço'), ('equipe_privado', 'socioeconomico', 8000, 'dados socioeconômicos'), ('equipe_privado', 'perfil', 8000, 'perfil'),
  ('equipe_bancario', 'banco_nome', 120, 'nome do banco'), ('equipe_bancario', 'tipo_conta', 20, 'tipo de conta'), ('equipe_bancario', 'pix_tipo', 20, 'tipo de chave Pix'),
  ('equipe_bancario', 'pix_chave', 160, 'chave Pix'),
  ('turmas_fic', 'nome', 160, 'nome da turma'), ('turmas_fic', 'municipio', 120, 'município'), ('turmas_fic', 'obs', 4000, 'observação'),
  ('matriculas_fic', 'numero', 40, 'número da matrícula'), ('matriculas_fic', 'motivo_cancelamento', 2000, 'motivo do cancelamento'),
  ('fic_encontros', 'motivo_cancelamento', 2000, 'motivo do cancelamento'),
  ('pedidos_apoio', 'justificativa_prazo', 4000, 'justificativa'), ('pedidos_apoio', 'obs', 4000, 'observação'),
  ('pedidos_apoio', 'funcern_protocolo', 120, 'protocolo da FUNCERN'), ('pedidos_apoio', 'dados', 100000, 'dados do pedido'),
  ('solicitacoes_pagamento', 'relatorio', 20000, 'relatório do mês'), ('solicitacoes_pagamento', 'obs_aval', 4000, 'observação do aval'),
  ('solicitacoes_pagamento', 'arlo_protocolo', 120, 'protocolo do Arlo'), ('solicitacoes_pagamento', 'detalhe', 500000, 'detalhe do pedido'),
  ('pre_cadastros', 'nome', 160, 'nome'), ('pre_cadastros', 'nome_social', 160, 'nome social'), ('pre_cadastros', 'email', 254, 'e-mail'), ('pre_cadastros', 'telefone', 40, 'telefone'),
  ('pre_cadastros', 'municipio', 120, 'município'), ('pre_cadastros', 'organizacao', 160, 'organização'), ('pre_cadastros', 'obs', 4000, 'motivo'),
  ('pre_cadastros', 'nis', 11, 'NIS'), ('pre_cadastros', 'siape', 8, 'SIAPE'),
  ('pre_cadastros', 'endereco', 4000, 'endereço'), ('pre_cadastros', 'socioeconomico', 8000, 'dados socioeconômicos'), ('pre_cadastros', 'perfil', 8000, 'perfil'),
  ('documentos_projeto', 'arquivo_nome', 300, 'nome do arquivo'), ('documentos_projeto', 'arquivo_path', 400, 'arquivo'), ('documentos_projeto', 'mime', 160, 'tipo do arquivo'),
  ('documentos_projeto', 'motivo_arquivo', 2000, 'motivo do arquivamento'),
  ('orientacoes_venda', 'dados', 8000, 'orientação de venda'), ('vitrine_fotos', 'path', 300, 'arquivo da foto'),
  ('custos_visita', 'obs', 2000, 'observação'), ('apl_municipios', 'municipio', 120, 'município'), ('apl_municipios', 'obs', 4000, 'observação'),
  ('apl_municipios', 'apls', 4000, 'arranjos produtivos'), ('parametros', 'chave', 60, 'nome do parâmetro'), ('parametros', 'valor', 20000, 'valores'),
  ('convites', 'token', 200, 'link');

do $$
declare r record; t text; args text; def text; n bigint;
begin
  -- travas do banco, uma por coluna
  for r in select l.*, (select c.data_type from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.tabela and c.column_name = l.coluna) tipo
             from _47_limites l order by l.tabela, l.coluna loop
    if r.tipo is null then continue; end if;   -- tabela ou coluna que esta instalação não tem
    if exists (select 1 from pg_constraint k where k.conrelid = ('public.' || r.tabela)::regclass and k.conname = format('tam_%s_%s', r.coluna, r.limite)) then continue; end if;
    def := case when r.tipo in ('jsonb', 'ARRAY', 'USER-DEFINED') then format('length((%I)::text) <= %s', r.coluna, r.limite) else format('length(%I) <= %s', r.coluna, r.limite) end;
    execute format('select count(*) from public.%I where not (%s)', r.tabela, def) into n;
    if n = 0 then   -- (com linha antiga acima do limite a trava não é criada: aparece no resultado, no fim)
      execute format('alter table public.%I add constraint %I check (%s) not valid', r.tabela, format('tam_%s_%s', r.coluna, r.limite), def);
    end if;
  end loop;
  -- o gatilho de cada tabela, com a lista dela
  for t in select distinct tabela from _47_limites where to_regclass('public.' || tabela) is not null loop
    select string_agg(format('%L, %L, %L', l.coluna, l.limite::text, l.rotulo), ', ' order by l.coluna) into args from _47_limites l
     where l.tabela = t and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.tabela and c.column_name = l.coluna);
    execute format('drop trigger if exists a0_tamanho on public.%I', t);
    execute format('create trigger a0_tamanho before insert or update on public.%I for each row execute function public.limites_texto(%s)', t, args);
  end loop;
  -- listas dentro do JSON (as mesmas do gatilho)
  if not exists (select 1 from pg_constraint where conrelid = 'public.diagnosticos'::regclass and conname = 'lista_kit_60')
     and not exists (select 1 from public.diagnosticos where jsonb_typeof(dados -> 'kit') = 'array' and jsonb_array_length(dados -> 'kit') > 60) then
    alter table public.diagnosticos add constraint lista_kit_60
      check (case when jsonb_typeof(dados -> 'kit') = 'array' then jsonb_array_length(dados -> 'kit') <= 60 else true end) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.diagnosticos'::regclass and conname = 'lista_familia_30')
     and not exists (select 1 from public.diagnosticos where jsonb_typeof(dados -> 'familia') = 'array' and jsonb_array_length(dados -> 'familia') > 30) then
    alter table public.diagnosticos add constraint lista_familia_30
      check (case when jsonb_typeof(dados -> 'familia') = 'array' then jsonb_array_length(dados -> 'familia') <= 30 else true end) not valid;
  end if;
  if to_regclass('public.pedidos_apoio') is not null
     and not exists (select 1 from pg_constraint where conrelid = 'public.pedidos_apoio'::regclass and conname = 'lista_passageiros_60')
     and not exists (select 1 from public.pedidos_apoio where jsonb_typeof(dados -> 'passageiros') = 'array' and jsonb_array_length(dados -> 'passageiros') > 60) then
    alter table public.pedidos_apoio add constraint lista_passageiros_60
      check (case when jsonb_typeof(dados -> 'passageiros') = 'array' then jsonb_array_length(dados -> 'passageiros') <= 60 else true end) not valid;
  end if;
end $$;

-- K. ESTADO (UF) com lista fechada nas tabelas que ainda não tinham (o gatilho copia o estado da ficha; isto é a trava do banco).
do $$
declare t text; n bigint;
begin
  foreach t in array array['visitas', 'diagnosticos', 'avaliacoes', 'orientacoes_venda', 'vitrine_fotos', 'pre_cadastros'] loop
    if to_regclass('public.' || t) is null
       or exists (select 1 from pg_constraint k where k.conrelid = ('public.' || t)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ '\muf\M.*AL.*BA.*PE.*PI.*SE') then continue; end if;
    execute format('select count(*) from public.%I where uf is not null and uf not in (''AL'',''BA'',''PE'',''PI'',''SE'')', t) into n;
    if n = 0 then   -- (com linha antiga fora da lista a trava não é criada: aparece no resultado, no fim)
      execute format('alter table public.%I add constraint %I check (uf in (''AL'',''BA'',''PE'',''PI'',''SE'')) not valid', t, t || '_uf_lista');
    end if;
  end loop;
end $$;

-- =====================================================================
-- B. EDIÇÃO AO MESMO TEMPO (fichas, diagnósticos, visitas e avaliações)
-- =====================================================================
-- A coluna "atualizado_em" já existe nas quatro tabelas. (Por segurança: se alguma instalação não tiver, é criada,
-- preenchida com a data de criação: é acréscimo de coluna, não apaga nada.)
do $$ declare t text; begin
  foreach t in array array['visitas', 'avaliacoes'] loop
    if to_regclass('public.' || t) is not null and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'atualizado_em') then
      execute format('alter table public.%I add column atualizado_em timestamptz not null default now()', t);
      execute format('alter table public.%I disable trigger user', t);
      execute format('update public.%I set atualizado_em = criado_em', t);
      execute format('alter table public.%I enable trigger user', t);
    end if;
  end loop;
end $$;

-- A tela manda, junto com a alteração, a marca "atualizado_em" do registro que ela leu. Se o registro mudou depois
-- disso, a marca não confere e a gravação é recusada. Sem a marca (o campo não vem na alteração: celular com a versão
-- antiga da tela, gatilhos internos, funções do banco, SQL Editor), grava como antes.
-- (O nome do gatilho começa com "a1": roda antes do gatilho que carimba a nova data.)
-- (igual ao do 46; muda só o que está marcado com "47")
create or replace function public.versao_conferir() returns trigger
language plpgsql as $$
begin
  if new.atualizado_em is distinct from old.atualizado_em then
    if tg_table_name in ('fichas', 'diagnosticos') then
      if new.situacao in ('aprovada', 'aprovado') and old.situacao is distinct from new.situacao then
        raise exception 'Este registro foi alterado enquanto você lia. Abra de novo e confira.';
      end if;
    end if;
    -- 47: vale para qualquer alteração, não só para a aprovação
    raise exception 'Este registro foi alterado por outra pessoa enquanto você editava. Abra de novo, confira e refaça a sua alteração.';
  end if;
  return new;
end $$;
revoke all on function public.versao_conferir() from public, anon, authenticated;
drop trigger if exists a1_versao on public.fichas;
create trigger a1_versao before update on public.fichas for each row execute function public.versao_conferir();
drop trigger if exists diagnosticos_a1_versao on public.diagnosticos;
create trigger diagnosticos_a1_versao before update on public.diagnosticos for each row execute function public.versao_conferir();
drop trigger if exists a1_versao on public.visitas;
create trigger a1_versao before update on public.visitas for each row execute function public.versao_conferir();
do $$ begin
  if to_regclass('public.avaliacoes') is not null then
    drop trigger if exists avaliacoes_a1_versao on public.avaliacoes;
    create trigger avaliacoes_a1_versao before update on public.avaliacoes for each row execute function public.versao_conferir();
  end if;
end $$;

-- =====================================================================
-- E. LOGIN DE QUEM SAIU
-- =====================================================================
-- Quando o cadastro deixa de estar ligado a um login (desligamento, e-mail trocado ou "novo primeiro acesso"), o login
-- antigo é removido: é só a senha, não é dado de negócio. Sem isto, a pessoa que voltava ao projeto com o mesmo e-mail
-- não conseguia criar a senha ("e-mail já cadastrado").
create or replace function public.equipe_solta_login() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_motivo text; n int;
begin
  if old.user_id is not null and new.user_id is null then
    delete from auth.users where id = old.user_id;
    get diagnostics n = row_count;
    v_motivo := case when new.status = 'desligada' and old.status is distinct from 'desligada' then 'desligamento'
                     when new.email is distinct from old.email then 'e-mail do cadastro alterado' end;
    -- ("novo primeiro acesso" já fica no histórico pela própria função que gera o código)
    if n > 0 and v_motivo is not null then
      insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
      values ('equipe', new.id, 'LOGIN_REMOVIDO', public.meu_id(), null,
              jsonb_build_object('nome', new.nome, 'papel', new.papel, 'uf', new.uf, 'status', new.status, 'motivo', v_motivo,
                                 'aviso', 'login (senha) removido: se a pessoa voltar, cria a senha de novo com um código de primeiro acesso'));
    end if;
  end if;
  return null;
end $$;
revoke all on function public.equipe_solta_login() from public, anon, authenticated;
drop trigger if exists equipe_z_solta_login on public.equipe;
create trigger equipe_z_solta_login after update on public.equipe for each row
  when (old.user_id is not null and new.user_id is null) execute function public.equipe_solta_login();

-- =====================================================================
-- H. CONFERÊNCIAS QUE ESPERAM UMA PELA OUTRA (e os limites de tamanho das funções)
-- =====================================================================
-- (igual ao do 46; muda só o que está marcado com "47": desligar × agendar visita)
create or replace function public.visitas_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.fichas; ex public.equipe; papel text := public.meu_papel(); n int; motivo text;
        hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  new.atualizado_em := now();
  -- 45: datas (só ao agendar ou quando a data muda: visita antiga não trava)
  if (new.data_prevista < date '2026-01-01' or new.data_prevista > date '2027-12-31')
     and ((tg_op = 'UPDATE' and new.data_prevista is distinct from old.data_prevista)
          or (tg_op = 'INSERT' and not exists (select 1 from public.visitas x where x.id = new.id and x.data_prevista = new.data_prevista))) then
    raise exception 'A data prevista da visita precisa ficar entre 01/01/2026 e 31/12/2027.';
  end if;
  -- 46: a data de "feita" no futuro só é conferida ao gravar ou quando ela muda
  --     (visita antiga com data errada continua podendo ser corrigida, cancelada e remarcada)
  if new.data_realizada > hoje and (tg_op = 'INSERT' or new.data_realizada is distinct from old.data_realizada) then
    raise exception 'A data em que a visita foi feita não pode ser no futuro.';
  end if;
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
  -- 47: segura o cadastro de quem faz a visita enquanto confere (desligar a pessoa ao mesmo tempo espera, e vice-versa)
  select * into ex from public.equipe where id = new.executor_id for share;
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
    -- 46: mensagem clara no lugar do erro de registro repetido (diagnóstico, implantação e avaliação: uma por quintal)
    if new.situacao <> 'cancelada' and new.etapa in ('diagnostico','implantacao','avaliacao')
       and exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = new.etapa and situacao <> 'cancelada') then
      raise exception 'Este quintal já tem essa visita agendada ou feita (%). Para trocar a data ou quem faz, altere a visita que já existe.',
        case new.etapa when 'diagnostico' then 'diagnóstico' when 'implantacao' then 'implantação' else 'avaliação final' end;
    end if;
    if new.etapa <> 'diagnostico' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'diagnostico' and situacao = 'realizada') then
      raise exception 'Primeiro o diagnóstico: implantação, acompanhamento e avaliação só depois dele.';
    end if;
    if new.etapa = 'avaliacao' and not exists (select 1 from public.visitas where ficha_id = new.ficha_id and etapa = 'implantacao' and situacao = 'realizada') then
      raise exception 'A avaliação é feita depois da implantação do quintal.';
    end if;
    -- 46: cada etapa exige a anterior (só ao agendar visita NOVA: a que já existe não trava aqui)
    if new.situacao <> 'cancelada' then
      motivo := public.visita_etapa_motivo(new.ficha_id, new.etapa, new.id, case when new.situacao = 'realizada' then new.data_realizada end, false);
      if motivo is not null then raise exception '%', motivo; end if;
    end if;
    select count(*) into n from public.visitas where uf = new.uf and situacao <> 'cancelada';
    if n >= 200 then raise exception 'O estado % já usou os 200 dias de campo previstos (40 quintais × 5 visitas).', new.uf; end if;
  end if;
  return new;
end 
$$;

-- (igual ao do 46; muda só o que está marcado com "47": desligar × pedir pagamento; pedir pagamento × mudar a data da visita)
create or replace function public.solicitar_pagamento(p_tipo text, p_mes date, p_valor numeric, p_relatorio text, p_visitas uuid[], p_detalhe jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare eu public.equipe; v_mes date; s public.solicitacoes_pagamento; v_id uuid; n int; ruins int;
        hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: o "hoje" é o de Fortaleza, não o da conexão
        complementar boolean := false; v_detalhe jsonb; v_total numeric;
begin
  -- 46: tipo e mês conferidos antes de tudo (mensagem clara no lugar do erro do banco)
  if p_tipo is null or p_tipo not in ('ajuda_custo', 'bolsa') then raise exception 'Tipo de pagamento inválido: escolha ajuda de custo ou bolsa.'; end if;
  if p_mes is null then raise exception 'Informe o mês do pedido.'; end if;
  v_mes := p_mes - (extract(day from p_mes)::int - 1);
  -- 47: tamanho do que a tela manda (nada grande demais segue adiante)
  if length(coalesce(p_relatorio, '')) > 20000 then raise exception 'Texto muito longo em relatório do mês (máximo 20.000 caracteres).'; end if;
  if length(coalesce(p_detalhe, '{}'::jsonb)::text) > 100000 then raise exception 'Texto muito longo em detalhe do pedido (máximo 100.000 caracteres).'; end if;
  if coalesce(array_length(p_visitas, 1), 0) > 200 then raise exception 'Visitas demais num pedido só (máximo 200).'; end if;
  -- 47: segura o próprio cadastro enquanto o pedido entra (o desligamento ao mesmo tempo espera, e vice-versa)
  select * into eu from public.equipe where id = public.meu_id() for share;
  if eu.id is null or eu.status <> 'ativa' then raise exception 'Entre no sistema para solicitar.'; end if;
  if p_tipo = 'ajuda_custo' and eu.papel not in ('articulacao','apoio','agente') then
    raise exception 'Ajuda de custo é só para bolsistas e agentes de campo que fazem visitas.';
  end if;
  if p_tipo = 'bolsa' and eu.papel not in ('coord_tecnico','articulacao','apoio','professor_fic','auxiliar_adm') then
    raise exception 'Seu perfil não recebe bolsa mensal pelo projeto.';
  end if;
  if not public.habilitado(eu) then raise exception 'Sua habilitação ainda não está completa: sem ela não há pagamento.'; end if;
  if v_mes > hoje - (extract(day from hoje)::int - 1) then raise exception 'Só dá para solicitar o mês atual ou meses anteriores.'; end if;
  -- 32: nada antes do mês em que a pessoa começou no projeto (início da bolsa, data do cadastro)
  if eu.data_inicio is not null and v_mes < eu.data_inicio - (extract(day from eu.data_inicio)::int - 1) then
    raise exception 'Você começou no projeto em %: só dá para solicitar a partir desse mês.', to_char(eu.data_inicio, 'MM/YYYY');
  end if;
  -- 46: um pedido de cada vez por pessoa (dois celulares ao mesmo tempo não criam dois pedidos com a mesma visita)
  perform public.trava_aviso('solicitar_pagamento_' || eu.id::text);
  -- 47: segura as visitas do pedido antes de conferir (mudar a data ou quem fez ao mesmo tempo espera, e vice-versa).
  --     Ordem das travas: pessoa, visitas, pedido.
  if p_tipo = 'ajuda_custo' and p_visitas is not null then
    perform 1 from public.visitas v where v.id = any (p_visitas) order by v.id for share;
  end if;
  if p_tipo = 'ajuda_custo' then
    -- 46: a ajuda de custo pode ter mais de um pedido no mês. O pedido devolvido é corrigido e reenviado
    --     (o mesmo registro); se não há devolvido, entra um pedido novo (complementar, se o mês já tem pedido).
    select * into s from public.solicitacoes_pagamento
     where tipo = 'ajuda_custo' and equipe_id = eu.id and mes = v_mes and situacao = 'devolvida'
     order by aval_em desc nulls last, solicitada_em desc limit 1 for update;
    --     O pedido devolvido que volta continua com o rótulo que já tinha.
    complementar := case when s.id is not null then coalesce(s.detalhe ->> 'complementar', '') = 'true'
                         else exists (select 1 from public.solicitacoes_pagamento x
                                       where x.tipo = 'ajuda_custo' and x.equipe_id = eu.id and x.mes = v_mes and x.situacao <> 'devolvida') end;
  else
    select * into s from public.solicitacoes_pagamento where tipo = p_tipo and equipe_id = eu.id and mes = v_mes for update;
    if s.id is not null and s.situacao <> 'devolvida' then raise exception 'Você já solicitou este mês. Acompanhe a situação na lista.'; end if;
  end if;

  if p_tipo = 'ajuda_custo' then
    n := coalesce(array_length(p_visitas, 1), 0);
    if n = 0 then raise exception 'Marque as visitas feitas no mês.'; end if;
    -- 46: a mesma visita duas vezes na lista (mensagem clara no lugar do erro de registro repetido)
    if (select count(distinct x) from unnest(p_visitas) x) <> n then raise exception 'A mesma visita apareceu duas vezes no pedido. Marque cada visita uma vez só.'; end if;
    select count(*) into ruins from unnest(p_visitas) x(id)
      left join public.visitas v on v.id = x.id
     where v.id is null or v.executor_id <> eu.id or v.situacao <> 'realizada'
        or v.data_realizada - (extract(day from v.data_realizada)::int - 1) <> v_mes
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
  v_detalhe := coalesce(p_detalhe, '{}'::jsonb);
  if p_tipo = 'ajuda_custo' and jsonb_typeof(v_detalhe) = 'object' then
    -- 46: o valor pedido não passa do total detalhado por visita (1 centavo de tolerância). Sem detalhe, vale só o teto por visita.
    begin
      if jsonb_typeof(v_detalhe -> 'total') = 'number' then v_total := (v_detalhe ->> 'total')::numeric;
      elsif jsonb_typeof(v_detalhe -> 'total') = 'string' then v_total := public.num_br(v_detalhe ->> 'total');
      elsif jsonb_typeof(v_detalhe -> 'visitas') = 'array' and jsonb_array_length(v_detalhe -> 'visitas') > 0
            and not exists (select 1 from jsonb_array_elements(v_detalhe -> 'visitas') i where jsonb_typeof(i -> 'total') is distinct from 'number') then
        select sum((i ->> 'total')::numeric) into v_total from jsonb_array_elements(v_detalhe -> 'visitas') i;
      end if;
    exception when others then v_total := null;
    end;
    if v_total is not null and p_valor > round(v_total, 2) + 0.01 then
      raise exception 'O valor pedido (%) passa do total das visitas detalhadas (%). Confira o pedido.', public.brl(p_valor), public.brl(round(v_total, 2));
    end if;
    -- 46: quem diz se o pedido é complementar é o banco (aparece nas listas)
    v_detalhe := (v_detalhe - 'complementar') || case when complementar then '{"complementar": true}'::jsonb else '{}'::jsonb end;
  end if;

  if s.id is null then
    insert into public.solicitacoes_pagamento (tipo, equipe_id, mes, valor_solicitado, relatorio, detalhe)
      values (p_tipo, eu.id, v_mes, p_valor, nullif(trim(p_relatorio), ''), v_detalhe) returning id into v_id;
  else
    update public.solicitacoes_pagamento set situacao = 'solicitada', valor_solicitado = p_valor, valor_avalizado = null, relatorio = nullif(trim(p_relatorio), ''),
      detalhe = v_detalhe, solicitada_em = now(), aval_por = null, aval_em = null where id = s.id;
    v_id := s.id;
    delete from public.solicitacao_visitas where solicitacao_id = s.id;
  end if;
  if p_tipo = 'ajuda_custo' then
    begin
      insert into public.solicitacao_visitas (visita_id, solicitacao_id) select x, v_id from unnest(p_visitas) x;
    exception when unique_violation then   -- 46: a visita entrou em outro pedido neste instante
      raise exception 'Há visita que não é sua, não está feita, é de outro mês ou já foi solicitada.';
    end;
  end if;
  return v_id;
end 
$$;

-- (igual ao do 46; muda só o que está marcado com "47": lançar no Arlo × mudar o km)
create or replace function public.custos_visita_travas() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vis uuid := case when tg_op = 'DELETE' then old.visita_id else new.visita_id end; paga boolean;
begin
  -- 47: segura o(s) pedido(s) de pagamento desta visita enquanto confere (lançar no Arlo ao mesmo tempo espera, e vice-versa)
  perform 1 from public.solicitacoes_pagamento s
   where s.id in (select sv.solicitacao_id from public.solicitacao_visitas sv where sv.visita_id = v_vis) order by s.id for share;
  paga := auth.uid() is not null and exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id
                                              where sv.visita_id = v_vis and s.situacao = 'lancada');
  if tg_op = 'DELETE' then
    if paga then raise exception 'Esta visita já foi paga (o pedido foi lançado no Arlo): a distância conferida não pode mais ser apagada.'; end if;
    return old;
  end if;
  if new.km_ida is null or not (new.km_ida >= 0 and new.km_ida < 1000) then raise exception 'Distância inválida: informe de 0 a 999 km (só a ida).'; end if;
  if not exists (select 1 from public.visitas v where v.id = new.visita_id) then raise exception 'Visita não encontrada.'; end if;
  if paga and ((tg_op = 'UPDATE' and new.km_ida is distinct from old.km_ida)
               or (tg_op = 'INSERT' and not exists (select 1 from public.custos_visita c where c.visita_id = new.visita_id and c.km_ida = new.km_ida))) then
    raise exception 'Esta visita já está num pedido lançado no Arlo: a distância (km) não muda mais.';
  end if;
  return new;
end 
$$;

-- (iguais aos do 46 e do 38; muda só o que está marcado com "47": bolsa do professor × encontro)
create or replace function public.registrar_encontro_fic(p_id uuid, p_turma uuid, p_data date, p_carga numeric, p_modalidade text, p_conteudo text, p_presentes uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.fic_encontros; t public.turmas_fic; v_id uuid; m record; eu uuid := public.meu_id(); v_papel text := coalesce(public.meu_papel(), '');
        v_pres uuid[] := coalesce(p_presentes, '{}'); v_soma numeric; v_prof_ant uuid;
begin
  if v_papel not in ('professor_fic', 'coord_geral') then raise exception 'Quem registra os encontros do curso é o professor do FIC.'; end if;
  if coalesce(array_length(p_presentes, 1), 0) > 500 then raise exception 'Lista de presença grande demais (máximo 500 pessoas).'; end if;   -- 47
  select * into t from public.turmas_fic where id = p_turma;
  if t.id is null then raise exception 'Turma não encontrada.'; end if;
  if t.professor_id is null then raise exception 'Esta turma não tem professor(a): ajuste a turma antes.'; end if;
  if v_papel = 'professor_fic' and t.professor_id <> eu then raise exception 'Esta turma é de outro(a) professor(a): só dá para registrar encontros das suas turmas.'; end if;
  if p_id is not null and exists (select 1 from public.fic_encontros x where x.id = p_id and x.turma_id <> p_turma) then
    raise exception 'A turma de um encontro não muda. Cancele este e registre de novo na turma certa.';
  end if;
  if p_data is null or p_data > public.fic_hoje() then raise exception 'A data do encontro não pode ser no futuro.'; end if;
  if p_data < date '2026-09-01' then raise exception 'Data antes do início do projeto.'; end if;
  if p_carga is null or round(p_carga, 1) <= 0 or p_carga > 12 then raise exception 'Informe a carga horária do encontro (até 12 horas).'; end if;
  if coalesce(p_modalidade, '') not in ('presencial', 'online', 'ava') then raise exception 'Modalidade inválida.'; end if;
  if length(trim(coalesce(p_conteudo, ''))) < 10 then raise exception 'Escreva o que foi trabalhado no encontro (pelo menos 10 letras).'; end if;
  if length(trim(p_conteudo)) > 2000 then raise exception 'O texto do que foi trabalhado passou de 2.000 letras.'; end if;
  if exists (select 1 from unnest(v_pres) x where x not in (select public.fic_matriculados_em(p_turma, p_data))) then
    raise exception 'Só entra na lista de presença quem estava matriculado nesta turma na data do encontro.';
  end if;
  -- 46: um registro de cada vez por turma e dia (dois envios ao mesmo tempo não gravam o mesmo encontro duas vezes)
  -- 47: um de cada vez com o pedido de bolsa do professor (o pedido do mês e o encontro registrado ao mesmo tempo
  --     esperam um pelo outro: é a mesma trava de solicitar_pagamento)
  perform public.trava_aviso('solicitar_pagamento_' || t.professor_id::text);
  if p_id is not null then
    select x.professor_id into v_prof_ant from public.fic_encontros x where x.id = p_id;
    if v_prof_ant is not null and v_prof_ant <> t.professor_id then perform public.trava_aviso('solicitar_pagamento_' || v_prof_ant::text); end if;
  end if;
  perform public.trava_aviso('fic_encontro_' || p_turma::text || '_' || p_data::text);
  if p_id is null then
    -- o encontro é sempre do professor da turma (também quando a coordenação geral registra no lugar dele)
    if public.fic_mes_fechado(t.professor_id, p_data) then raise exception 'A bolsa deste mês do professor já foi pedida: não dá para incluir encontro neste mês (se a coordenação devolver o pedido, reabre).'; end if;
    if exists (select 1 from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.cancelado_em is null and lower(trim(x.conteudo)) = lower(trim(p_conteudo))) then
      raise exception 'Este encontro já está registrado (mesma turma, data e conteúdo).';
    end if;
    -- 46: mesma turma, dia e modalidade = o mesmo encontro
    if exists (select 1 from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.modalidade = p_modalidade and x.cancelado_em is null) then
      raise exception 'Esta turma já tem encontro registrado neste dia nesta modalidade. Se houve mais horas, altere o encontro que já existe.';
    end if;
    -- 46: os encontros de uma turma no mesmo dia somam no máximo 12 horas
    select coalesce(sum(x.carga_horaria), 0) into v_soma from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.cancelado_em is null;
    if v_soma + p_carga > 12 then
      raise exception 'Os encontros desta turma neste dia somariam % horas: o máximo é 12 horas por dia.', replace(trim(to_char(v_soma + p_carga, 'FM990.0')), '.', ',');
    end if;
    insert into public.fic_encontros (turma_id, professor_id, data, carga_horaria, modalidade, conteudo)
      values (p_turma, t.professor_id, p_data, p_carga, p_modalidade, trim(p_conteudo)) returning id into v_id;
  else
    select * into e from public.fic_encontros where id = p_id for update;
    if e.id is null then raise exception 'Encontro não encontrado.'; end if;
    if v_papel = 'professor_fic' and e.professor_id <> eu then raise exception 'Este encontro é de outro(a) professor(a).'; end if;
    if e.cancelado_em is not null then raise exception 'Este encontro foi cancelado e não muda mais.'; end if;
    if e.turma_id <> p_turma then raise exception 'A turma de um encontro não muda. Cancele este e registre de novo na turma certa.'; end if;
    if public.fic_mes_fechado(e.professor_id, e.data) or public.fic_mes_fechado(e.professor_id, p_data) then
      raise exception 'A bolsa deste mês já foi pedida: o encontro não muda mais (se a coordenação devolver o pedido, reabre).';
    end if;
    if exists (select 1 from public.fic_presencas p where p.encontro_id = e.id and p.confirmado_em is not null
                 and (not (p.equipe_id = any(v_pres)) or p.equipe_id not in (select public.fic_matriculados_em(p_turma, p_data)))) then
      raise exception 'Alguém que já confirmou a presença foi desmarcado (ou ficou fora da lista pela nova data). Quem confirmou continua presente.';
    end if;
    -- 46: as duas conferências novas valem só quando o dia ou a modalidade mudam, ou quando as horas AUMENTAM
    --     (encontro antigo continua editável, e diminuir as horas é sempre aceito)
    if (p_data <> e.data or p_modalidade <> e.modalidade)
       and exists (select 1 from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.modalidade = p_modalidade and x.cancelado_em is null and x.id <> e.id) then
      raise exception 'Esta turma já tem encontro registrado neste dia nesta modalidade. Se houve mais horas, altere o encontro que já existe.';
    end if;
    if p_data <> e.data or p_carga > e.carga_horaria then
      select coalesce(sum(x.carga_horaria), 0) into v_soma from public.fic_encontros x where x.turma_id = p_turma and x.data = p_data and x.cancelado_em is null and x.id <> e.id;
      if v_soma + p_carga > 12 then
        raise exception 'Os encontros desta turma neste dia somariam % horas: o máximo é 12 horas por dia.', replace(trim(to_char(v_soma + p_carga, 'FM990.0')), '.', ',');
      end if;
    end if;
    update public.fic_encontros set data = p_data, carga_horaria = p_carga, modalidade = p_modalidade, conteudo = trim(p_conteudo), atualizado_em = now()
      where id = e.id;
    v_id := e.id;
  end if;
  -- lista de presença: quem estava matriculado na data, presente ou não; quem saiu da lista (nova data) fica como ausente
  for m in select x as equipe_id from public.fic_matriculados_em(p_turma, p_data) x loop
    insert into public.fic_presencas (encontro_id, equipe_id, presente, marcado_por, marcado_em)
      values (v_id, m.equipe_id, m.equipe_id = any(v_pres), eu, now())
      on conflict (encontro_id, equipe_id) do update set presente = excluded.presente, marcado_por = eu, marcado_em = now()
      where fic_presencas.presente is distinct from excluded.presente;
  end loop;
  update public.fic_presencas set presente = false, marcado_por = eu, marcado_em = now()
   where encontro_id = v_id and presente and confirmado_em is null and equipe_id not in (select public.fic_matriculados_em(p_turma, p_data));
  return v_id;
end 
$$;

create or replace function public.cancelar_encontro_fic(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.fic_encontros; eu uuid := public.meu_id(); v_papel text := coalesce(public.meu_papel(), ''); v_prof uuid;
begin
  if v_papel not in ('professor_fic', 'coord_geral') then raise exception 'Quem cancela um encontro é o professor do FIC.'; end if;
  -- 47: um de cada vez com o pedido de bolsa do professor (mesma trava de solicitar_pagamento)
  select x.professor_id into v_prof from public.fic_encontros x where x.id = p_id;
  if v_prof is not null then perform public.trava_aviso('solicitar_pagamento_' || v_prof::text); end if;
  select * into e from public.fic_encontros where id = p_id for update;
  if e.id is null then raise exception 'Encontro não encontrado.'; end if;
  if v_papel = 'professor_fic' and e.professor_id <> eu then raise exception 'Este encontro é de outro(a) professor(a).'; end if;
  if e.cancelado_em is not null then raise exception 'Este encontro já foi cancelado.'; end if;
  if public.fic_mes_fechado(e.professor_id, e.data) then raise exception 'A bolsa deste mês já foi pedida: o encontro não muda mais (se a coordenação devolver o pedido, reabre).'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'Escreva o motivo do cancelamento (pelo menos 10 letras).'; end if;
  update public.fic_encontros set cancelado_em = now(), cancelado_por = eu, motivo_cancelamento = trim(p_motivo), atualizado_em = now() where id = e.id;
end 
$$;

-- (igual ao do 45; muda só o que está marcado com "47": devolver a ficha × registrar o diagnóstico)
create or replace function public.diagnosticos_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.visitas; papel text := public.meu_papel(); eu uuid := public.meu_id();
        decisao constant text[] := array['situacao','aprovado_por','aprovado_em','obs_coordenacao','atualizado_em','conteudo_alterado_por','conteudo_alterado_em'];
        mudou boolean;
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.visita_id <> old.visita_id then
    -- 47: segura a ficha enquanto o diagnóstico entra (devolver a ficha ao mesmo tempo espera, e vice-versa)
    perform 1 from public.fichas f where f.id = new.ficha_id for share;
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
end 
$$;

-- (igual ao do 46; muda só o que está marcado com "47": tamanho do que chega, dígito do CPF, idade e o mesmo CPF por dois links)
create or replace function public.enviar_pre_cadastro(p_token text, p_dados jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.convites; v_cpf text := regexp_replace(coalesce(p_dados->>'cpf', ''), '\D', '', 'g');
        v_email text := lower(trim(coalesce(p_dados->>'email', '')));
        v_arlo boolean; v_nasc date; v_nis text := nullif(regexp_replace(coalesce(p_dados->>'nis', ''), '\D', '', 'g'), '');
        v_siape text := nullif(regexp_replace(coalesce(p_dados->>'siape', ''), '\D', '', 'g'), '');
        hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  -- 47: tamanho do que chega (função aberta, chamada sem login): nada grande demais segue adiante
  if length(coalesce(p_token, '')) > 200 then raise exception 'Este link não vale mais. Peça um novo à coordenação.'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'Os dados do cadastro não chegaram. Preencha o formulário de novo.'; end if;
  if length(p_dados::text) > 30000 then raise exception 'Texto muito longo em dados do cadastro (máximo 30.000 caracteres).'; end if;
  if length(coalesce(p_dados->>'nome', '')) > 160 then raise exception 'Texto muito longo em nome (máximo 160 caracteres).'; end if;
  if length(coalesce(p_dados->>'nome_social', '')) > 160 then raise exception 'Texto muito longo em nome social (máximo 160 caracteres).'; end if;
  if length(coalesce(p_dados->>'email', '')) > 254 then raise exception 'Texto muito longo em e-mail (máximo 254 caracteres).'; end if;
  if length(coalesce(p_dados->>'telefone', '')) > 40 then raise exception 'Texto muito longo em telefone (máximo 40 caracteres).'; end if;
  if length(coalesce(p_dados->>'municipio', '')) > 120 then raise exception 'Texto muito longo em município (máximo 120 caracteres).'; end if;
  if length(coalesce(p_dados->>'organizacao', '')) > 160 then raise exception 'Texto muito longo em organização (máximo 160 caracteres).'; end if;
  if length(coalesce(p_dados->'endereco', '{}'::jsonb)::text) > 4000 then raise exception 'Texto muito longo em endereço (máximo 4.000 caracteres).'; end if;
  if length(coalesce(p_dados->'socioeconomico', '{}'::jsonb)::text) > 8000 then raise exception 'Texto muito longo em dados socioeconômicos (máximo 8.000 caracteres).'; end if;
  if length(coalesce(p_dados->'perfil', '{}'::jsonb)::text) > 8000 then raise exception 'Texto muito longo em perfil (máximo 8.000 caracteres).'; end if;
  select * into c from public.convites where token = p_token for update;
  if c.id is null or c.usado_em is not null or c.cancelado_em is not null or c.expira_em <= now() then
    raise exception 'Este link não vale mais. Peça um novo à coordenação.';
  end if;
  -- 46: o que vem do formulário é conferido antes de chegar às colunas (mensagem clara no lugar do erro do banco)
  begin v_arlo := coalesce((p_dados->>'cadastro_arlo')::boolean, false); exception when others then v_arlo := false; end;
  begin
    if coalesce((p_dados->>'consentimento_lgpd')::boolean, false) is not true then raise exception 'É preciso aceitar o uso dos dados para o cadastro.'; end if;
  exception when invalid_text_representation then raise exception 'É preciso aceitar o uso dos dados para o cadastro.';
  end;
  if length(trim(coalesce(p_dados->>'nome', ''))) < 5 then raise exception 'Escreva o nome completo (pelo menos 5 letras).'; end if;
  if v_cpf !~ '^[0-9]{11}$' then raise exception 'O CPF precisa ter 11 números. Confira.'; end if;
  if not public.cpf_valido(v_cpf) then raise exception 'CPF inválido. Confira os 11 números.'; end if;   -- 47: dígito verificador
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido. Confira (sem espaços).'; end if;
  if v_nis is not null and v_nis !~ '^[0-9]{11}$' then raise exception 'O NIS precisa ter 11 números. Se não souber, deixe em branco.'; end if;
  if v_siape is not null and v_siape !~ '^[0-9]{5,8}$' then raise exception 'O SIAPE precisa ter de 5 a 8 números. Confira.'; end if;
  if not v_arlo and nullif(p_dados->>'data_nascimento', '') is null then raise exception 'Informe a data de nascimento.'; end if;
  begin v_nasc := nullif(trim(p_dados->>'data_nascimento'), '')::date;
  exception when others then raise exception 'A data de nascimento não é uma data que existe. Confira dia, mês e ano.';
  end;
  if v_nasc > hoje then raise exception 'A data de nascimento não pode ser no futuro.'; end if;
  if v_nasc < date '1901-01-01' then raise exception 'Confira a data de nascimento: o ano está antigo demais.'; end if;
  -- 47: a mesma regra da tela (pelo menos 16 anos)
  if v_nasc > (hoje - interval '16 years')::date then raise exception 'Data de nascimento inválida: é preciso ter pelo menos 16 anos.'; end if;
  -- 47: um envio de cada vez por CPF e por e-mail (a mesma pessoa por dois links ao mesmo tempo não vira dois cadastros para conferir)
  perform public.trava_aviso('pre_cadastro_cpf_' || v_cpf);
  perform public.trava_aviso('pre_cadastro_email_' || v_email);
  if exists (select 1 from public.equipe where status = 'ativa' and (cpf = v_cpf or lower(email::text) = v_email)) then
    raise exception 'Já existe pessoa ativa na equipe com este CPF ou e-mail. Fale com a coordenação.';
  end if;
  if exists (select 1 from public.pre_cadastros where situacao = 'aguardando' and (cpf = v_cpf or lower(email) = v_email)) then
    raise exception 'Seus dados já foram enviados e estão com a coordenação para conferir. Não precisa enviar de novo.';
  end if;
  begin
  insert into public.pre_cadastros (convite_id, papel, uf, substitui_id, nome, cpf, email, telefone, municipio, organizacao,
                                    nome_social, data_nascimento, nis, endereco, socioeconomico, consentimento_lgpd, cadastro_arlo, siape, perfil)
    values (c.id, c.papel, c.uf, c.substitui_id, trim(p_dados->>'nome'), v_cpf, v_email,
            nullif(trim(p_dados->>'telefone'), ''), nullif(trim(p_dados->>'municipio'), ''), nullif(trim(p_dados->>'organizacao'), ''),
            nullif(trim(p_dados->>'nome_social'), ''), v_nasc, v_nis,
            coalesce(p_dados->'endereco', '{}'::jsonb), p_dados->'socioeconomico', true, v_arlo, v_siape,
            case when jsonb_typeof(p_dados->'perfil') = 'object' then p_dados->'perfil' end);
  exception when unique_violation then   -- 47: a trava do banco (um CPF aguardando conferência)
    raise exception 'Seus dados já foram enviados e estão com a coordenação para conferir. Não precisa enviar de novo.';
  end;
  update public.convites set usado_em = now() where id = c.id;
end 
$$;

-- K. limite diário da IA: um de cada vez por pessoa (igual ao do 20; muda só o que está marcado com "47")
create or replace function public.registrar_uso_ia() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := public.meu_id();
begin
  if eu is null then return false; end if;
  perform public.trava_aviso('ia_' || eu::text);   -- 47: um de cada vez por pessoa (vários pedidos ao mesmo tempo não passam do limite)
  if (select count(*) from public.ia_usos where equipe_id = eu and em > now() - interval '24 hours') >= 60 then
    return false;
  end if;
  insert into public.ia_usos (equipe_id) values (eu);
  return true;
end 
$$;

-- K. um CPF só aguardando conferência nos cadastros enviados pelo link (a função já recusava; esta é a trava do banco).
do $$ begin
  if to_regclass('public.pre_cadastros_cpf_aguardando') is null then
    -- (se já houver o mesmo CPF em dois cadastros aguardando, o índice não é criado e o resultado, no fim, avisa:
    --  decida os repetidos e rode o 47 de novo)
    if not exists (select 1 from public.pre_cadastros where situacao = 'aguardando' group by cpf having count(*) > 1) then
      create unique index pre_cadastros_cpf_aguardando on public.pre_cadastros (cpf) where situacao = 'aguardando';
    end if;
  end if;
end $$;

-- =====================================================================
-- F. MATRÍCULA DO FIC: a pessoa é travada primeiro, como em matricular_fic e no desligamento
-- =====================================================================
-- (igual ao do 23; muda só a ordem das travas, marcada com "47")
create or replace function public.cancelar_matricula_fic(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.matriculas_fic;
begin
  -- 47: lê a matrícula sem travar, trava a PESSOA e só depois a matrícula (antes era o contrário: deadlock com matricular e desligar)
  select * into m from public.matriculas_fic where id = p_id;
  if m.id is null or m.cancelada_em is not null then raise exception 'Matrícula não encontrada ou já cancelada.'; end if;
  if not public.pode_matricular(m.turma_id) then raise exception 'A matrícula no FIC é cancelada pelos professores do curso.'; end if;
  perform 1 from public.equipe where id = m.equipe_id for update;
  select * into m from public.matriculas_fic where id = p_id for update;
  if m.id is null or m.cancelada_em is not null then raise exception 'Matrícula não encontrada ou já cancelada.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.'; end if;
  if exists (select 1 from public.visitas where executor_id = m.equipe_id and situacao <> 'cancelada') then
    raise exception 'Esta pessoa já tem visita no roteiro de campo, que depende da matrícula. Para corrigir número ou data, matricule de novo na mesma turma.';
  end if;
  update public.matriculas_fic set cancelada_em = now(), motivo_cancelamento = trim(p_motivo) where id = p_id;
  perform set_config('mq.matricula_fic', '1', true);
  update public.equipe set matricula_fic_em = null, matricula_fic_numero = null where id = m.equipe_id;
  perform set_config('mq.matricula_fic', '', true);
end $$;

-- =====================================================================
-- G. APROVAR O CADASTRO VINDO DO LINK: uma operação só (tudo ou nada)
-- =====================================================================
-- Faz, numa transação, as três gravações que a tela fazia em três chamadas: 1) inclui a pessoa na equipe; 2) grava os
-- dados pessoais complementares; 3) marca o cadastro enviado como aprovado. Roda com o direito de QUEM CHAMA (não é
-- "security definer"): valem exatamente as mesmas regras de acesso e os mesmos gatilhos das três gravações de antes.
create or replace function public.aprovar_pre_cadastro(p_pre uuid, p_equipe jsonb, p_privado jsonb) returns public.equipe
language plpgsql set search_path = public, pg_temp as $$
declare pc public.pre_cadastros; novo public.equipe; e jsonb; pv jsonb := p_privado;
begin
  if public.meu_id() is null then raise exception 'Entre no sistema com um cadastro ativo para aprovar o cadastro.'; end if;
  if p_pre is null then raise exception 'Informe o cadastro enviado pelo link.'; end if;
  if p_equipe is null or jsonb_typeof(p_equipe) <> 'object' then raise exception 'Os dados da pessoa não chegaram. Abra o cadastro de novo.'; end if;
  if length(p_equipe::text) > 20000 then raise exception 'Texto muito longo em dados da pessoa (máximo 20.000 caracteres).'; end if;
  if length(coalesce(pv, '{}'::jsonb)::text) > 30000 then raise exception 'Texto muito longo em dados pessoais (máximo 30.000 caracteres).'; end if;
  -- o cadastro enviado é a primeira trava: duas pessoas aprovando ao mesmo tempo, a segunda é avisada
  select * into pc from public.pre_cadastros where id = p_pre for update;
  if pc.id is null then raise exception 'Cadastro enviado não encontrado (ou o seu perfil não pode aprová-lo).'; end if;
  if pc.situacao <> 'aguardando' then raise exception 'Este pré-cadastro já foi decidido.'; end if;
  -- campo vazio ("") vira sem valor, como a tela já fazia
  select coalesce(jsonb_object_agg(k, case when v = '""'::jsonb then 'null'::jsonb else v end), '{}'::jsonb) into e from jsonb_each(p_equipe) x(k, v);
  -- 1) a pessoa na equipe (só os campos do cadastro; situação, login e datas de controle são do banco)
  insert into public.equipe (papel, uf, nome, cpf, email, telefone, municipio, organizacao, data_inicio, meta_diagnosticos, meta_quintais, meta_visitas,
                             nome_social, cadastro_arlo, siape, consentimento_lgpd, substitui_id)
  select r.papel, r.uf, r.nome, regexp_replace(coalesce(r.cpf, ''), '\D', '', 'g'), lower(trim(e ->> 'email')), r.telefone, r.municipio, r.organizacao, r.data_inicio,
         r.meta_diagnosticos, r.meta_quintais, r.meta_visitas, r.nome_social, coalesce(r.cadastro_arlo, false), r.siape, coalesce(r.consentimento_lgpd, false), r.substitui_id
    from jsonb_populate_record(null::public.equipe, e - 'email') r
  returning * into novo;
  -- 2) os dados pessoais complementares, se vieram
  if pv is not null and jsonb_typeof(pv) = 'object' then
    insert into public.equipe_privado (equipe_id, data_nascimento, nis, endereco, socioeconomico, perfil, atualizado_em)
    values (novo.id, nullif(pv ->> 'data_nascimento', '')::date, nullif(pv ->> 'nis', ''),
            case when jsonb_typeof(pv -> 'endereco') = 'object' then pv -> 'endereco' else '{}'::jsonb end,
            case when jsonb_typeof(pv -> 'socioeconomico') = 'object' then pv -> 'socioeconomico' end,
            case when jsonb_typeof(pv -> 'perfil') = 'object' then pv -> 'perfil' end, now())
    on conflict (equipe_id) do update set data_nascimento = excluded.data_nascimento, nis = excluded.nis, endereco = excluded.endereco,
      socioeconomico = excluded.socioeconomico, perfil = excluded.perfil, atualizado_em = now();
  end if;
  -- 3) o cadastro enviado fica aprovado, ligado à pessoa
  update public.pre_cadastros set situacao = 'aprovado', obs = null, equipe_id = novo.id where id = p_pre;
  return novo;
end $$;
revoke all on function public.aprovar_pre_cadastro(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.aprovar_pre_cadastro(uuid, jsonb, jsonb) to authenticated;

-- =====================================================================
-- J. REPETIÇÃO DEPOIS DE FALHA DE REDE (e os limites de tamanho das funções)
-- =====================================================================
-- (iguais aos do 46, do 44 e do 45; muda só o que está marcado com "47")
do $$ begin
  if to_regclass('public.pedidos_apoio') is not null then
    execute $f$
create or replace function public.salvar_pedido_apoio(p_id uuid, p_tipo text, p_titulo text, p_data date, p_dados jsonb, p_justificativa text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $b$
declare eu public.equipe; p public.pedidos_apoio; v_id uuid; antecedencia int := case p_tipo when 'passagem' then 40 when 'evento' then 45 end;
        v_pass jsonb; n int; pes jsonb; v_val numeric; v_nasc date; v_volta date; v_cpf text; v_cpfs text[] := '{}';
        hoje date := (now() at time zone 'America/Fortaleza')::date;   -- 46: o "hoje" é o de Fortaleza, não o da conexão
begin
  -- 47: tamanho do que a tela manda (nada grande demais segue adiante)
  if length(coalesce(p_dados, '{}'::jsonb)::text) > 100000 then raise exception 'Texto muito longo em dados do pedido (máximo 100.000 caracteres).'; end if;
  if length(coalesce(p_justificativa, '')) > 4000 then raise exception 'Texto muito longo em justificativa (máximo 4.000 caracteres).'; end if;
  if (case when jsonb_typeof(p_dados -> 'passageiros') = 'array' then jsonb_array_length(p_dados -> 'passageiros') else 0 end) > 60 then
    raise exception 'A lista de passageiras tem pessoas demais (máximo 60).';
  end if;
  select * into eu from public.equipe where id = public.meu_id() and status = 'ativa';
  if eu.id is null or eu.papel <> 'articulacao' then
    raise exception 'Quem pede passagem e estrutura de evento é a bolsista de articulação estadual.';
  end if;
  if antecedencia is null then raise exception 'Tipo de pedido inválido.'; end if;
  if p_data is null or p_data < hoje then raise exception 'Informe uma data que ainda não passou.'; end if;
  if p_data > date '2027-09-30' then raise exception 'A data passa do fim do projeto (setembro de 2027).'; end if;
  if p_data < hoje + antecedencia and length(trim(coalesce(p_justificativa, ''))) < 15 then
    raise exception 'Pedido fora do prazo (% dias antes). Escreva a justificativa.', antecedencia;
  end if;
  if length(trim(coalesce(p_titulo, ''))) < 5 then raise exception 'Escreva o objetivo e a atividade do projeto.'; end if;
  if length(trim(p_titulo)) > 200 then raise exception 'O objetivo do pedido passou de 200 letras. Resuma.'; end if;
  -- 46: valor estimado de R$ 0,01 a R$ 1.000.000,00, conferido já no envio (sem erro cru de número grande mais adiante)
  begin v_val := nullif(trim(p_dados->>'valor_estimado'), '')::numeric; exception when others then v_val := null; end;
  if v_val is null or v_val <= 0 then raise exception 'Informe o valor estimado do pedido (R$).'; end if;
  if not (round(v_val, 2) >= 0.01 and v_val <= 1000000) then
    raise exception 'O valor estimado precisa ficar entre R$ 0,01 e R$ 1.000.000,00 (veio %). Confira.', public.brl(v_val);
  end if;
  if p_tipo = 'passagem' then
    v_pass := p_dados->'passageiros';
    n := coalesce(jsonb_array_length(case when jsonb_typeof(v_pass) = 'array' then v_pass end), 0);
    if n < 1 then raise exception 'Informe pelo menos uma passageira ou passageiro.'; end if;
    if exists (select 1 from jsonb_array_elements(v_pass) x
               where regexp_replace(coalesce(x->>'cpf', ''), '\D', '', 'g') !~ '^[0-9]{11}$'
                  or length(trim(coalesce(x->>'nome', ''))) < 5 or coalesce(x->>'nascimento', '') = ''
                  or coalesce(x->>'rg', '') = '') then
      raise exception 'Falta nome, CPF, RG ou nascimento de alguma passageira.';
    end if;
    -- 46: nascimento de verdade (data que existe, não futura) e ninguém duas vezes na lista
    for pes in select * from jsonb_array_elements(v_pass) loop
      begin v_nasc := (pes->>'nascimento')::date;
      exception when others then
        raise exception 'A data de nascimento de % não é uma data que existe. Confira dia, mês e ano.', left(trim(pes->>'nome'), 60);
      end;
      if v_nasc > hoje then raise exception 'A data de nascimento de % está no futuro. Confira.', left(trim(pes->>'nome'), 60); end if;
      if v_nasc < date '1901-01-01' then raise exception 'Confira a data de nascimento de %: o ano está antigo demais.', left(trim(pes->>'nome'), 60); end if;
      v_cpf := regexp_replace(pes->>'cpf', '\D', '', 'g');
      if v_cpf = any (v_cpfs) then raise exception 'A mesma pessoa (CPF) aparece duas vezes na lista de passageiras. Deixe cada pessoa uma vez só.'; end if;
      v_cpfs := v_cpfs || v_cpf;
    end loop;
    begin v_volta := nullif(trim(p_dados->>'volta'), '')::date;
    exception when others then raise exception 'A data da volta não é uma data que existe. Confira dia, mês e ano.';
    end;
    if v_volta < p_data then raise exception 'A volta é antes da ida.'; end if;
  end if;

  if p_id is null then
    -- 47: repetição depois de uma falha de rede: o mesmo pedido, da mesma pessoa, há menos de 2 minutos, devolve o que já foi gravado
    perform public.trava_aviso('pedido_apoio_' || eu.id::text);
    select x.id into v_id from public.pedidos_apoio x
     where x.solicitante_id = eu.id and x.tipo = p_tipo and x.titulo = trim(p_titulo) and x.data_ref = p_data and x.dados = coalesce(p_dados, '{}')
       and x.justificativa_prazo is not distinct from nullif(trim(p_justificativa), '') and x.situacao = 'enviado' and x.criado_em > now() - interval '2 minutes'
     order by x.criado_em desc limit 1;
    if v_id is not null then return v_id; end if;
    insert into public.pedidos_apoio (tipo, uf, solicitante_id, titulo, data_ref, dados, justificativa_prazo)
      values (p_tipo, eu.uf, eu.id, trim(p_titulo), p_data, coalesce(p_dados, '{}'), nullif(trim(p_justificativa), ''))
      returning id into v_id;
    return v_id;
  end if;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null or p.solicitante_id <> eu.id then raise exception 'Pedido não encontrado.'; end if;
  if p.situacao <> 'devolvido' then raise exception 'Só dá para corrigir pedido devolvido.'; end if;
  if p.tipo <> p_tipo then raise exception 'Não dá para mudar o tipo do pedido.'; end if;
  update public.pedidos_apoio set titulo = trim(p_titulo), data_ref = p_data, dados = coalesce(p_dados, '{}'),
    justificativa_prazo = nullif(trim(p_justificativa), ''), situacao = 'enviado', enviado_em = now(),
    conferido_por = null, conferido_em = null, decidido_por = null, decidido_em = null where id = p_id;
  return p_id;
end 
$b$;
    $f$;
  end if;
end $$;

create or replace function public.registrar_orientacao_venda(p_ficha uuid, p_dados jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare papel text := coalesce(public.meu_papel(), ''); f public.fichas; v uuid;
begin
  if papel not in ('coord_geral','coord_tecnico','articulacao','apoio','agente') then
    raise exception 'Quem registra a orientação de venda é quem visita o quintal ou a coordenação.';
  end if;
  select * into f from public.fichas where id = p_ficha;
  if f.id is null then raise exception 'Ficha não encontrada.'; end if;
  if not (f.resultado = 'selecionada' and f.situacao = 'aprovada') then raise exception 'A orientação de venda é para mulher selecionada e aprovada.'; end if;
  if papel in ('articulacao','apoio','agente') and f.uf <> public.minha_uf() then raise exception 'Este quintal é de outro estado.'; end if;
  if papel = 'agente' and not exists (select 1 from public.visitas x where x.ficha_id = p_ficha and x.executor_id = public.meu_id() and x.situacao <> 'cancelada') then
    raise exception 'Você registra a orientação só dos quintais que visita.';
  end if;
  if not exists (select 1 from public.diagnosticos d where d.ficha_id = p_ficha) then raise exception 'Primeiro o diagnóstico do quintal.'; end if;
  if jsonb_typeof(p_dados -> 'sobra') is distinct from 'array' then raise exception 'Marque o que está sobrando no quintal (ou registre que nada sobra).'; end if;
  if coalesce(p_dados ->> 'caf', '') not in ('sim','nao','nao_sabe') then raise exception 'Responda se a família tem CAF ou DAP.'; end if;
  if length(p_dados::text) > 4000 then raise exception 'Registro grande demais.'; end if;
  -- 47: repetição depois de uma falha de rede: a mesma orientação, da mesma pessoa, há menos de 2 minutos, devolve a que já foi gravada
  perform public.trava_aviso('orientacao_venda_' || p_ficha::text);
  select o.id into v from public.orientacoes_venda o
   where o.ficha_id = p_ficha and o.feito_por = public.meu_id() and o.dados = p_dados and o.feito_em > now() - interval '2 minutes' order by o.feito_em desc limit 1;
  if v is not null then return v; end if;
  insert into public.orientacoes_venda (ficha_id, uf, dados, feito_por) values (p_ficha, f.uf, p_dados, public.meu_id()) returning id into v;
  return v;
end 
$$;

create or replace function public.criar_convite(p_papel text, p_uf text default null, p_substitui uuid default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  if not coalesce(public.pode_gerenciar(p_papel), false) then raise exception 'Seu perfil não pode cadastrar esta função.'; end if;
  if p_papel = 'coord_tecnico' and exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then
    raise exception 'Já há coordenação técnica ativa. Desligue antes de convidar outra.';
  end if;
  if p_papel in ('articulacao','apoio') and exists (select 1 from public.equipe where papel = p_papel and uf = upper(p_uf) and status = 'ativa') then
    raise exception 'Esta vaga já está ocupada no estado.';
  end if;
  if p_papel = 'auxiliar_adm' and exists (select 1 from public.equipe where papel = 'auxiliar_adm' and status = 'ativa') then
    raise exception 'Já há auxiliar administrativo ativo. Desligue antes de convidar outro.';
  end if;
  -- 47: repetição depois de uma falha de rede: o mesmo link (mesma função, estado e vaga), da mesma pessoa, há menos de 20 segundos,
  --     devolve o link que já foi criado (se ainda não foi usado nem cancelado)
  perform public.trava_aviso('convite_' || coalesce(public.meu_id()::text, ''));
  select c.token into t from public.convites c
   where c.criado_por = public.meu_id() and c.papel = p_papel and c.substitui_id is not distinct from p_substitui
     and c.uf is not distinct from (case when p_papel in ('coord_tecnico','professor_fic','auxiliar_adm') then null else upper(p_uf) end)::char(2)
     and c.usado_em is null and c.cancelado_em is null and c.expira_em > now() and c.criado_em > now() - interval '20 seconds'
     -- só nas funções de vaga única (ou substituição): para agente e professor há mais de uma vaga, e dois links seguidos são dois convites
     and (p_papel in ('coord_tecnico', 'articulacao', 'apoio', 'auxiliar_adm') or p_substitui is not null)
   order by c.criado_em desc limit 1;
  if t is not null then return t; end if;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');   -- sem pgcrypto (no Supabase ela fica em outro schema)
  insert into public.convites (token, papel, uf, substitui_id, criado_por)
    values (t, p_papel, case when p_papel in ('coord_tecnico','professor_fic','auxiliar_adm') then null else upper(p_uf) end, p_substitui, public.meu_id());
  return t;
end 
$$;

create or replace function public.documentos_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  if tg_op = 'INSERT' then
    new.enviado_por := public.meu_id(); new.enviado_em := now(); new.arquivado_em := null; new.arquivado_por := null; new.motivo_arquivo := null;
    -- 46: mensagem clara no lugar do erro de registro repetido
    if exists (select 1 from public.documentos_projeto x where x.arquivo_path = new.arquivo_path) then
      raise exception 'Este arquivo já foi anexado. Escolha outro arquivo.';
    end if;
    -- 47: repetição depois de uma falha de rede: o mesmo documento (tipo, título, data, estado, nome e tamanho do arquivo), da mesma
    --     pessoa, há menos de 2 minutos, não é gravado de novo (a tela mostra o que já foi anexado)
    if new.enviado_por is not null then
      perform public.trava_aviso('documento_' || new.enviado_por::text);
      if exists (select 1 from public.documentos_projeto x
                  where x.enviado_por = new.enviado_por and x.tipo = new.tipo and x.titulo = new.titulo and x.data_documento = new.data_documento
                    and x.uf is not distinct from new.uf and x.arquivo_nome = new.arquivo_nome and x.tamanho is not distinct from new.tamanho
                    and x.arquivado_em is null and x.enviado_em > now() - interval '2 minutes') then
        return null;
      end if;
    end if;
  else
    if new.arquivo_path is distinct from old.arquivo_path or new.enviado_por is distinct from old.enviado_por or new.enviado_em is distinct from old.enviado_em then
      raise exception 'O arquivo e quem enviou não mudam. Para trocar o arquivo, arquive este documento e anexe outro.';
    end if;
    if old.arquivado_em is not null and new.arquivado_em is null then raise exception 'Documento arquivado não volta. Anexe de novo, se precisar.'; end if;
    if old.arquivado_em is not null and (new.arquivado_em is distinct from old.arquivado_em or new.motivo_arquivo is distinct from old.motivo_arquivo
        or new.arquivado_por is distinct from old.arquivado_por) then
      raise exception 'Este documento já está arquivado.';
    end if;
    -- 46: documento arquivado não muda título nem data
    if old.arquivado_em is not null and (new.titulo is distinct from old.titulo or new.data_documento is distinct from old.data_documento) then
      raise exception 'Este documento já está arquivado: o título e a data não mudam mais.';
    end if;
    if new.arquivado_em is not null and old.arquivado_em is null then
      if length(trim(coalesce(new.motivo_arquivo, ''))) < 5 then raise exception 'Para arquivar, escreva o motivo.'; end if;
      new.arquivado_por := public.meu_id(); new.arquivado_em := now();
    end if;
  end if;
  -- 46: data do documento de 01/01/2025 até um ano à frente (só ao anexar ou quando a data muda)
  if (tg_op = 'INSERT' or new.data_documento is distinct from old.data_documento)
     and (new.data_documento < date '2025-01-01' or new.data_documento > hoje + 365) then
    raise exception 'Confira a data do documento: precisa ser a partir de 01/01/2025 e no máximo um ano à frente.';
  end if;
  return new;
end 
$$;

-- =====================================================================
-- K. MIÚDOS
-- =====================================================================
-- Vitrine: o nome da mulher na legenda é procurado palavra por palavra, sem montar expressão com o nome
-- (um nome como "Ana(Nita" dava erro cru do banco). Com e sem acento, maiúsculas ou minúsculas.
-- (igual ao do 04; muda só a conferência do nome)
create or replace function public.vitrine_fotos_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare f record; v_nome text;
begin
  if auth.uid() is not null and coalesce(public.meu_papel(), '') not in ('coord_geral','coord_tecnico') then
    raise exception 'Só a coordenação publica fotos na vitrine.';
  end if;
  select * into f from public.fichas where id = new.ficha_id;
  if f.id is null then raise exception 'Ficha não encontrada.'; end if;
  if not f.consent_imagem then
    raise exception 'Esta mulher não autorizou uso de imagem. A foto não pode ser publicada.';
  end if;
  if not f.consent_criancas and not new.sem_criancas then
    raise exception 'A autorização não inclui crianças: confirme que nenhuma criança aparece na foto.';
  end if;
  v_nome := public.sem_acento(split_part(trim(f.nome), ' ', 1));
  if length(v_nome) >= 3 and v_nome = any (regexp_split_to_array(public.sem_acento(new.legenda), '[^a-z0-9]+')) then
    raise exception 'A legenda não pode trazer o nome da mulher.';
  end if;
  new.uf := f.uf;
  new.publicada_por := public.meu_id();
  new.publicada_em := now();
  return new;
end $$;

-- Canal de venda: município e nome comparados sem acento; município com pelo menos 2 letras.
-- (igual ao do 46; muda só o que está marcado com "47")
create or replace function public.salvar_canal_venda(p_id uuid, p_uf text, p_municipio text, p_tipo text, p_nome text, p_detalhe text, p_contato text, p_ativo boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare papel text := coalesce(public.meu_papel(), ''); v uuid; atual public.canais_venda;
begin
  if papel not in ('coord_geral','coord_tecnico','articulacao','apoio') then
    raise exception 'Quem cadastra os canais de venda é a coordenação ou a bolsista do estado.';
  end if;
  if p_id is not null then
    select * into atual from public.canais_venda where id = p_id for update;
    if atual.id is null then raise exception 'Canal não encontrado.'; end if;
    p_uf := atual.uf;   -- o estado de um canal não muda
  end if;
  if p_uf is null or p_uf not in ('AL','BA','PE','PI','SE') then raise exception 'Escolha o estado.'; end if;
  if papel in ('articulacao','apoio') and p_uf <> public.minha_uf() then raise exception 'Você cadastra canais só do seu estado.'; end if;
  if length(trim(coalesce(p_municipio, ''))) < 2 then raise exception 'Informe o município.'; end if;
  -- 47: município de verdade (pelo menos 2 letras); só no canal novo ou quando o município muda (o antigo continua editável)
  if (p_id is null or public.sem_acento(p_municipio) <> public.sem_acento(atual.municipio)) and public.sem_acento(p_municipio) !~ '[a-z].*[a-z]' then
    raise exception 'Informe o município (pelo menos 2 letras).';
  end if;
  if length(trim(p_municipio)) > 80 then raise exception 'O nome do município passou de 80 letras.'; end if;
  if coalesce(p_tipo, '') not in ('feira','grupo','merenda','paa','comprador','outro') then raise exception 'Escolha o tipo de canal.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Dê um nome ao canal (pelo menos 3 letras).'; end if;
  if length(trim(p_nome)) > 120 then raise exception 'O nome do canal passou de 120 letras.'; end if;
  if length(coalesce(p_detalhe, '')) > 400 then raise exception 'O detalhe do canal passou de 400 letras.'; end if;
  if length(coalesce(p_contato, '')) > 160 then raise exception 'O contato do canal passou de 160 letras.'; end if;
  -- 46: um cadastro de cada vez por município (dois envios ao mesmo tempo não gravam o mesmo canal duas vezes)
  perform public.trava_aviso('canal_venda_' || p_uf || '_' || public.sem_acento(p_municipio));
  if p_id is null then
    -- 47: compara sem acento ("São José" e "Sao Jose" são o mesmo município; "Feira Agroecológica" e "Feira Agroecologica", o mesmo canal)
    if exists (select 1 from public.canais_venda c where c.uf = p_uf and public.sem_acento(c.municipio) = public.sem_acento(p_municipio) and c.tipo = p_tipo
                 and public.sem_acento(c.nome) = public.sem_acento(p_nome)) then
      raise exception 'Este canal já está cadastrado neste município.';
    end if;
    insert into public.canais_venda (uf, municipio, tipo, nome, detalhe, contato, ativo, criado_por, atualizado_por)
    values (p_uf, trim(p_municipio), p_tipo, trim(p_nome), nullif(trim(coalesce(p_detalhe, '')), ''), nullif(trim(coalesce(p_contato, '')), ''), coalesce(p_ativo, true), public.meu_id(), public.meu_id())
    returning id into v;
  else
    -- 46: ao mudar o nome, o tipo ou o município, o canal não pode virar repetido de outro (o que já era repetido antes continua editável)
    if (public.sem_acento(p_nome) <> public.sem_acento(atual.nome) or p_tipo <> atual.tipo or public.sem_acento(p_municipio) <> public.sem_acento(atual.municipio))
       and exists (select 1 from public.canais_venda c where c.id <> p_id and c.uf = p_uf and public.sem_acento(c.municipio) = public.sem_acento(p_municipio)
                     and c.tipo = p_tipo and public.sem_acento(c.nome) = public.sem_acento(p_nome)) then
      raise exception 'Já existe outro canal com este nome e tipo neste município.';
    end if;
    update public.canais_venda set municipio = trim(p_municipio), tipo = p_tipo, nome = trim(p_nome), detalhe = nullif(trim(coalesce(p_detalhe, '')), ''),
      contato = nullif(trim(coalesce(p_contato, '')), ''), ativo = coalesce(p_ativo, true), atualizado_por = public.meu_id(), atualizado_em = now()
    where id = p_id returning id into v;
  end if;
  return v;
end 
$$;

-- APL: o mesmo município com outra grafia ("Sao Jose" e "São José") é um registro só: a gravação vai para o que já
-- existe. Município com pelo menos 2 letras. (igual ao do 10; o resto é do 47)
create or replace function public.apl_carimbo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ja text;
begin
  if tg_op = 'INSERT' or new.municipio is distinct from old.municipio then
    select a.municipio into v_ja from public.apl_municipios a
     where a.uf = new.uf and a.municipio <> new.municipio and public.sem_acento(a.municipio) = public.sem_acento(new.municipio) limit 1;
    if v_ja is not null then
      if tg_op = 'INSERT' then
        -- só leva para a grafia que já existe quando ESTA grafia ainda não está na lista (duplicado antigo, "São Gabriel" e
        -- "Sao Gabriel": cada linha continua sendo editada por ela mesma)
        if not exists (select 1 from public.apl_municipios a where a.uf = new.uf and a.municipio = new.municipio) then new.municipio := v_ja; end if;
      else raise exception 'Este município já está na lista de APL do estado (%). Altere o registro que já existe.', v_ja; end if;
    elsif public.sem_acento(new.municipio) !~ '[a-z].*[a-z]'
          and not (tg_op = 'INSERT' and exists (select 1 from public.apl_municipios a where a.uf = new.uf and a.municipio = new.municipio)) then
      raise exception 'Informe o município (pelo menos 2 letras).';
    end if;
  end if;
  new.atualizado_por := public.meu_id(); new.atualizado_em := now(); return new;
end $$;

-- Ficha: dígito verificador do CPF (só na ficha nova ou quando o CPF muda). (igual ao do 46; muda só o que está marcado com "47")
create or replace function public.fichas_regras() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare ant public.fichas; novo boolean; logado boolean := auth.uid() is not null;
begin
  if tg_op = 'UPDATE' then ant := old;
  else select * into ant from public.fichas x where x.id = new.id;   -- celular reenviando a mesma ficha: compara com a que já existe
  end if;
  novo := ant.id is null;
  -- CPF: formato, repetido e pessoa da equipe (só na ficha nova ou quando o CPF muda)
  if novo or new.cpf is distinct from ant.cpf then
    if new.cpf is null or new.cpf !~ '^[0-9]{11}$' then raise exception 'O CPF da mulher precisa ter 11 números, sem pontos, traço ou espaços.'; end if;
    if not public.cpf_valido(new.cpf) then raise exception 'CPF inválido. Confira os 11 números do CPF da mulher.'; end if;   -- 47: dígito verificador
    if exists (select 1 from public.fichas x where x.cpf = new.cpf and x.id <> new.id) then
      raise exception 'Esta mulher (CPF) já tem ficha no projeto, possivelmente em outro estado. Fale com a coordenação técnica.';
    end if;
    if exists (select 1 from public.equipe e where e.cpf = new.cpf and e.status = 'ativa') then
      raise exception 'Este CPF é de uma pessoa ativa da equipe do projeto: quem trabalha no projeto não entra como beneficiária. Confira o CPF.';
    end if;
  end if;
  if new.testemunha_cpf is not null and new.testemunha_cpf = new.cpf
     and (novo or new.testemunha_cpf is distinct from ant.testemunha_cpf or new.cpf is distinct from ant.cpf) then
    raise exception 'A testemunha da assinatura não pode ser a própria mulher (mesmo CPF). Informe o CPF de quem assistiu.';
  end if;
  -- mensagens claras no lugar dos erros do banco (são as mesmas regras de sempre)
  if new.resultado in ('selecionada', 'lista_espera') and new.data_nascimento > (new.data_ficha - interval '18 years') then
    raise exception 'Ela tem menos de 18 anos na data da ficha: não pode ser selecionada nem entrar na lista de espera.';
  end if;
  if new.pessoas_familia is not null and not (new.pessoas_familia between 1 and 30) then
    raise exception 'O número de pessoas da família precisa ficar entre 1 e 30.';
  end if;
  if new.resultado in ('selecionada', 'lista_espera') and not (new.c_agricultora and new.c_maior18 and new.c_espaco and new.c_agua and new.c_disponibilidade
       and new.c_sem_kit and new.c_sem_parentesco and new.c_casa_unica and new.autodeclaracao) then
    raise exception 'Selecionada ou lista de espera só com todos os critérios obrigatórios e a autodeclaração assinada.';
  end if;
  if new.latitude is not null and (novo or new.latitude is distinct from ant.latitude or new.longitude is distinct from ant.longitude)
     and (new.longitude is null or not (new.latitude between -90 and 90) or not (new.longitude between -180 and 180)
          or (new.latitude = 0 and new.longitude = 0)) then
    raise exception 'Localização inválida. Registre de novo a localização (a latitude vai de -90 a 90 e a longitude de -180 a 180).';
  end if;
  -- posição na lista de espera: só para quem está na lista, sem repetir no estado
  if new.posicao_espera is not null then
    if new.resultado <> 'lista_espera' then
      if not novo and new.posicao_espera is not distinct from ant.posicao_espera then
        -- saiu da lista de espera (foi selecionada, por exemplo): a posição se desfaz. Ficha antiga que já estava assim fica como está.
        if ant.resultado = 'lista_espera' then new.posicao_espera := null; end if;
      else
        raise exception 'A posição na lista de espera só vale para quem está na lista de espera.';
      end if;
    elsif novo or new.posicao_espera is distinct from ant.posicao_espera or new.resultado is distinct from ant.resultado or new.uf is distinct from ant.uf then
      perform public.trava_aviso('espera_' || new.uf);
      if exists (select 1 from public.fichas x where x.uf = new.uf and x.resultado = 'lista_espera' and x.posicao_espera = new.posicao_espera and x.id <> new.id) then
        raise exception 'Já há outra mulher na posição % da lista de espera de %. Escolha outra posição.', new.posicao_espera, new.uf;
      end if;
    end if;
  end if;
  -- quintal em andamento (só na tela: pelo SQL Editor a coordenação geral ainda consegue consertar um caso raro)
  if tg_op = 'UPDATE' and logado then
    if new.uf is distinct from old.uf and exists (select 1 from public.visitas v where v.ficha_id = old.id and v.situacao <> 'cancelada') then
      raise exception 'Esta ficha já tem visita agendada ou feita: o estado não muda. Se o estado foi lançado errado, cancele antes as visitas agendadas (visita já feita não se cancela).';
    end if;
    if ((new.situacao = 'devolvida' and old.situacao is distinct from 'devolvida') or new.resultado is distinct from old.resultado)
       and exists (select 1 from public.diagnosticos d where d.ficha_id = old.id) then
      raise exception 'Este quintal já está em andamento (tem diagnóstico registrado): a ficha não pode ser devolvida nem mudar de resultado. Para corrigir um dado da ficha, a coordenação geral altera direto. Se a mulher saiu do projeto, cancele antes as visitas agendadas e registre a saída na observação.';
    end if;
  end if;
  return new;
end 
$$;

-- Equipe: dígito verificador do CPF e substituição sem círculo. (igual ao do 46; muda só o que está marcado com "47")
create or replace function public.equipe_regras() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare novo boolean := tg_op = 'INSERT'; logado boolean := auth.uid() is not null; alvo public.equipe;
        fora constant text[] := array['atualizado_em', 'user_id']; v_prox uuid; v_passos int := 0;
begin
  -- 20. cadastro desligado não é mais editado; só a coordenação geral corrige
  --     (a matrícula do FIC, cancelada pelo professor, e o vínculo do login continuam sendo acertados pelo sistema)
  if not novo and old.status = 'desligada' and logado and coalesce(public.meu_papel(), '') <> 'coord_geral'
     and coalesce(current_setting('mq.matricula_fic', true), '') <> '1'
     and (to_jsonb(new) - fora) is distinct from (to_jsonb(old) - fora) then
    raise exception 'Este cadastro está desligado e não é mais alterado. Se houver erro, peça à coordenação geral para corrigir.';
  end if;
  -- 20. "substitui": nunca a própria pessoa, nem pessoa ativa de outro estado (só ao cadastrar ou quando o campo muda)
  if new.substitui_id is not null and (novo or new.substitui_id is distinct from old.substitui_id) then
    if new.substitui_id = new.id then raise exception 'A pessoa não pode substituir a si mesma. Escolha quem saiu da vaga.'; end if;
    select * into alvo from public.equipe where id = new.substitui_id;
    if alvo.id is not null and alvo.status = 'ativa' and alvo.uf is distinct from new.uf then
      raise exception '% está ativa em outro estado: a substituição é de quem saiu da mesma vaga.', coalesce(alvo.nome_social, alvo.nome);
    end if;
    -- 47: a cadeia de substituições não pode voltar na própria pessoa (A substitui B, que substitui A)
    v_prox := alvo.substitui_id;
    while v_prox is not null and v_passos < 50 loop
      if v_prox = new.id then raise exception 'Esta substituição fecharia um círculo (a pessoa acabaria substituindo a si mesma). Escolha quem saiu da vaga.'; end if;
      select x.substitui_id into v_prox from public.equipe x where x.id = v_prox;
      v_passos := v_passos + 1;
    end loop;
  end if;
  -- 22. mensagens claras no lugar dos erros do banco (são as mesmas regras de sempre)
  if new.cpf is null or new.cpf !~ '^[0-9]{11}$' then raise exception 'O CPF precisa ter 11 números, sem pontos, traço ou espaços.'; end if;
  -- 47: dígito verificador (só no cadastro novo ou quando o CPF muda: o cadastro antigo continua editável)
  if (novo or new.cpf is distinct from old.cpf) and not public.cpf_valido(new.cpf) then raise exception 'CPF inválido. Confira os 11 números.'; end if;
  if new.email is null or new.email::text !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido. Confira (sem espaços).'; end if;
  if new.status = 'desligada' and (new.data_fim is null or length(trim(coalesce(new.motivo_desligamento, ''))) < 5) then
    raise exception 'Para desligar, informe a data e o motivo do desligamento (pelo menos 5 letras).';
  end if;
  if new.data_fim is not null and new.data_fim < new.data_inicio then
    raise exception 'A data do desligamento não pode ser anterior à data de início (%).', to_char(new.data_inicio, 'DD/MM/YYYY');
  end if;
  if new.status = 'ativa' and (novo or new.cpf is distinct from old.cpf)
     and exists (select 1 from public.equipe x where x.status = 'ativa' and x.cpf = new.cpf and x.id <> new.id) then
    raise exception 'Esta pessoa (CPF) já ocupa outra vaga ativa.';
  end if;
  if new.status = 'ativa' and (novo or new.email is distinct from old.email)
     and exists (select 1 from public.equipe x where x.status = 'ativa' and x.email = new.email and x.id <> new.id) then
    raise exception 'Este e-mail já está em uso por outra pessoa ativa.';
  end if;
  return new;
end 
$$;

-- Parâmetros: só as chaves que o sistema conhece. (igual ao do 46; muda só o que está marcado com "47")
create or replace function public.parametros_validar() returns trigger
language plpgsql as $$
declare v jsonb := new.valor; k text; rot text; h jsonb; x numeric;
begin
  -- 47: só entram os parâmetros que o sistema conhece (o que já existe com outro nome continua podendo ser alterado)
  if tg_op = 'INSERT' and new.chave is distinct from 'custo_visita' and not exists (select 1 from public.parametros p where p.chave = new.chave) then
    raise exception 'Parâmetro desconhecido (%). O sistema só guarda os valores do custo da visita.', left(coalesce(new.chave, ''), 40);
  end if;
  if new.chave <> 'custo_visita' or (tg_op = 'UPDATE' and new.valor is not distinct from old.valor) then return new; end if;
  if jsonb_typeof(v) <> 'object' then
    raise exception 'Os valores do custo da visita vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.';
  end if;
  foreach k in array array['valor_hora', 'refeicao', 'km_por_litro', 'preco_litro', 'fator_estrada', 'teto'] loop
    if not (v ? k) then continue; end if;
    rot := case k when 'valor_hora' then 'O valor da hora' when 'refeicao' then 'O valor da refeição' when 'km_por_litro' then 'O consumo do carro (km por litro)'
                  when 'preco_litro' then 'O preço do litro da gasolina' when 'fator_estrada' then 'O fator estrada' else 'O teto das ajudas de custo' end;
    if jsonb_typeof(v -> k) <> 'number' then raise exception '% precisa ser um número.', rot; end if;
    x := (v ->> k)::numeric;
    if k in ('valor_hora', 'refeicao', 'teto') and not (x >= 0) then raise exception '% não pode ser negativo.', rot; end if;
    if k in ('km_por_litro', 'preco_litro') and not (x > 0) then raise exception '% precisa ser maior que zero.', rot; end if;
    if k = 'fator_estrada' and not (x >= 1) then raise exception 'O fator estrada precisa ser 1 ou mais (a estrada nunca é mais curta que a linha reta).'; end if;
    if not (x <= 100000000) then raise exception '% está alto demais. Confira o número.', rot; end if;
  end loop;
  if v ? 'horas' then
    h := v -> 'horas';
    if jsonb_typeof(h) <> 'object' then raise exception 'As horas por etapa vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.'; end if;
    for k in select jsonb_object_keys(h) loop
      if jsonb_typeof(h -> k) <> 'number' or not ((h ->> k)::numeric >= 0 and (h ->> k)::numeric <= 24) then
        raise exception 'As horas de cada etapa precisam ser um número entre 0 e 24.';
      end if;
    end loop;
  end if;
  return new;
end 
$$;

-- Planilha de execução: totais válidos. (igual ao do 37; muda só o que está marcado com "47")
create or replace function public.execucao_planilhas_antes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Planilha enviada não se altera nem se apaga. Envie uma nova: a mais recente é a que vale.'; end if;
  new.enviado_por := public.meu_id(); new.enviado_em := now();
  if new.posicao_em > (now() at time zone 'America/Fortaleza')::date then raise exception 'A data da planilha não pode ser no futuro.'; end if;
  if new.posicao_em < date '2026-01-01' then raise exception 'Data da planilha fora do período do projeto.'; end if;
  if new.arquivo_path !~ '^\d{4}/[\w.-]+$' then raise exception 'Caminho do arquivo inválido.'; end if;
  -- 47: totais da planilha: números de verdade, não negativos ("NaN" e valores absurdos são recusados)
  if new.total_gasto is null or new.total_recebido is null or not (new.total_gasto >= 0 and new.total_gasto < 1000000000)
     or not (new.total_recebido >= 0 and new.total_recebido < 1000000000) then
    raise exception 'Os totais da planilha vieram com valor que o sistema não aceita (negativo ou que não é número). Confira a planilha e envie de novo.';
  end if;
  return new;
end 
$$;

-- Dados pessoais da equipe: nascimento entre 1900 e 16 anos atrás (só ao gravar pela primeira vez ou quando a data muda).
create or replace function public.equipe_privado_regras() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  if new.data_nascimento is not null
     and (tg_op = 'UPDATE' and new.data_nascimento is distinct from old.data_nascimento
          or tg_op = 'INSERT' and not exists (select 1 from public.equipe_privado x where x.equipe_id = new.equipe_id and x.data_nascimento = new.data_nascimento))
     and (new.data_nascimento < date '1900-01-01' or new.data_nascimento > (hoje - interval '16 years')::date) then
    raise exception 'Data de nascimento inválida: o ano precisa ser de 1900 em diante e a pessoa precisa ter pelo menos 16 anos.';
  end if;
  return new;
end $$;
revoke all on function public.equipe_privado_regras() from public, anon, authenticated;
do $$ begin
  if to_regclass('public.equipe_privado') is not null then
    drop trigger if exists equipe_privado_a0_regras on public.equipe_privado;
    create trigger equipe_privado_a0_regras before insert or update on public.equipe_privado for each row execute function public.equipe_privado_regras();
  end if;
end $$;

-- =====================================================================
-- A. DESEMPENHO COM A SEGURANÇA POR LINHA
-- =====================================================================
create index if not exists visitas_executor on public.visitas (executor_id) where situacao <> 'cancelada';
create index if not exists visitas_ficha on public.visitas (ficha_id);
create index if not exists diagnosticos_executor on public.diagnosticos (executor_id);
create index if not exists solicitacao_visitas_solicitacao on public.solicitacao_visitas (solicitacao_id);
create index if not exists auditoria_registro on public.auditoria (registro_id, em desc);
create index if not exists fichas_bolsista on public.fichas (bolsista_id);
do $$ declare r record; begin
  -- (tabelas de scripts opcionais: o índice só é criado onde a tabela existe)
  for r in select * from (values ('avaliacoes', 'avaliacoes_ficha', 'ficha_id'), ('avaliacoes', 'avaliacoes_executor', 'executor_id'), ('matriculas_fic', 'matriculas_fic_turma', 'turma_id'),
                                 ('fic_encontros', 'fic_encontros_turma', 'turma_id, data'), ('fic_presencas', 'fic_presencas_pessoa', 'equipe_id'),
                                 ('pedidos_apoio', 'pedidos_apoio_solicitante', 'solicitante_id'), ('vitrine_fotos', 'vitrine_fotos_ficha', 'ficha_id')) v(tabela, indice, colunas) loop
    if to_regclass('public.' || r.tabela) is not null then
      execute format('create index if not exists %I on public.%I (%s)', r.indice, r.tabela, r.colunas);
    end if;
  end loop;
end $$;

-- Os quintais do agente de campo (as fichas das visitas dele que não foram canceladas): a lista é montada UMA vez por consulta.
create or replace function public.minhas_fichas() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select v.ficha_id from public.visitas v where v.executor_id = public.meu_id() and v.situacao <> 'cancelada'
$$;
revoke all on function public.minhas_fichas() from public, anon;
grant execute on function public.minhas_fichas() to authenticated;

-- (a mesma regra de antes: coordenação lê tudo; bolsista, o estado dela; agente, as fichas dos quintais que visita)
drop policy if exists fichas_ler on public.fichas;
create policy fichas_ler on public.fichas for select to authenticated using (
  (select public.meu_papel()) in ('coord_geral', 'coord_tecnico')
  or ((select public.meu_papel()) in ('articulacao', 'apoio') and uf = (select public.minha_uf()))
  or ((select public.meu_papel()) = 'agente' and id in (select public.minhas_fichas())));

-- Em TODAS as regras de acesso: "quem sou eu", "meu papel", "meu estado" e "quem confere" passam a ser calculados uma vez
-- por consulta (entre parênteses, com "select"), e não uma vez por linha. O texto da regra é o mesmo; pode rodar de novo
-- (o que já foi trocado não é trocado outra vez).
do $$
declare p record; q text; c text; sp text := current_setting('search_path');
        re constant text := '(?<!SELECT )(?<!public\.)\m(meu_papel|meu_id|minha_uf|quem_confere_pedidos)\(\)';
begin
  perform set_config('search_path', 'public', true);   -- para o texto das regras vir sem "public." na frente dos nomes
  for p in select * from pg_policies where schemaname = 'public' loop
    q := regexp_replace(p.qual, re, '(select public.\1())', 'g'); c := regexp_replace(p.with_check, re, '(select public.\1())', 'g');
    q := regexp_replace(q, '(?<!SELECT )\mauth\.uid\(\)', '(select auth.uid())', 'g'); c := regexp_replace(c, '(?<!SELECT )\mauth\.uid\(\)', '(select auth.uid())', 'g');
    if q is distinct from p.qual or c is distinct from p.with_check then
      execute format('alter policy %I on public.%I %s %s', p.policyname, p.tablename,
        case when q is not null then 'using (' || q || ')' else '' end, case when c is not null then 'with check (' || c || ')' else '' end);
    end if;
  end loop;
  perform set_config('search_path', sp, true);
end $$;

-- =====================================================================
-- I. TEMPO DE ESPERA POR TRAVA
-- =====================================================================
-- Quem entrou espera no máximo 5 segundos por uma trava; quem não entrou, 3. (O tempo máximo de cada consulta é do
-- próprio Supabase e não muda.) Se este usuário do banco não puder alterar os papéis, segue sem erro.
do $$ begin
  begin execute 'alter role authenticated set lock_timeout = ''5s'''; exception when insufficient_privilege or undefined_object then null; end;
  begin execute 'alter role anon set lock_timeout = ''3s'''; exception when insufficient_privilege or undefined_object then null; end;
end $$;
-- As funções e gatilhos que pegam trava "de aviso" (limites e envios em dobro) não esperam mais que 5 segundos, entrem por onde entrarem.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as nome from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosrc ~ '(pg_advisory_xact_lock|trava_aviso)\('
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x = 'lock_timeout=5s') loop
    execute format('alter function %s set lock_timeout = ''5s''', f.nome);
  end loop;
end $$;

-- =====================================================================
-- C. PRIVILÉGIOS
-- =====================================================================
-- Tabelas e numerações: quem não entrou (anon) não tem privilégio nenhum; quem entrou não tem TRUNCATE, REFERENCES nem
-- TRIGGER, e não grava direto no histórico, nos exemplos, nos usos da IA nem nas matrículas (a tela nunca gravou nelas
-- direto: é sempre por função do banco); ciências e entregas do mês só entram e saem, não se alteram. O que cada script
-- concedeu de propósito continua igual.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['auditoria', 'exemplo', 'ia_usos', 'matriculas_fic'] loop
    if to_regclass('public.' || t) is not null then execute format('revoke insert, update, delete on public.%I from authenticated', t); end if;
  end loop;
  if to_regclass('public.ciencias') is not null then revoke update, delete on public.ciencias from authenticated; end if;
  if to_regclass('public.entregas_mes') is not null then revoke update on public.entregas_mes from authenticated; end if;   -- (marca e desmarca: nunca altera)
end $$;

-- Funções: (1) todas as que rodam com o direito do banco procuram tabelas só em "public" (e as temporárias por último);
-- (2) ninguém de fora (PUBLIC, anon) executa nada, fora as cinco públicas de propósito; quem entrou continua executando
-- exatamente o que já executava; as funções de gatilho não são chamadas por ninguém (o banco as dispara sozinho).
do $$
declare f record; tem_sr boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  for f in select p.oid, p.oid::regprocedure as nome, p.prosecdef, p.prorettype = 'trigger'::regtype as gatilho, p.proname,
                  has_function_privilege('authenticated', p.oid, 'EXECUTE') as entrou,
                  coalesce((select has_function_privilege('service_role', p.oid, 'EXECUTE') where tem_sr), false) as servico,
                  coalesce(p.proconfig, '{}') as cfg
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    if f.prosecdef and not ('search_path=public, pg_temp' = any (f.cfg)) then
      execute format('alter function %s set search_path = public, pg_temp', f.nome);
    end if;
    execute format('revoke all on function %s from public, anon', f.nome);
    if f.gatilho then
      execute format('revoke all on function %s from authenticated', f.nome);
    else
      if f.entrou then execute format('grant execute on function %s to authenticated', f.nome); end if;
      if f.servico then execute format('grant execute on function %s to service_role', f.nome); end if;
    end if;
  end loop;
end $$;
-- funções novas deste script que ninguém chama pela tela
revoke all on function public.cpf_valido(text) from public, anon, authenticated;
revoke all on function public.trava_aviso(text) from public, anon, authenticated;
revoke all on function public.chave_fixa() from public, anon, authenticated;
-- as cinco abertas de propósito a quem não entrou: tela de entrada ("esqueci a senha"), link de cadastro e vitrine pública
do $$ declare f record; begin
  for f in select p.oid::regprocedure as nome from pg_proc p where p.pronamespace = 'public'::regnamespace
              and p.proname in ('ver_convite', 'enviar_pre_cadastro', 'pedir_novo_acesso', 'vitrine', 'vitrine_municipios') loop
    execute format('grant execute on function %s to anon, authenticated', f.nome);
  end loop;
end $$;

-- Tabelas e numerações criadas daqui para a frente já nascem fechadas para anon e authenticated (cada script concede o que
-- precisa). FUNÇÕES NÃO: toda função nova continua nascendo executável por "public" (padrão do Postgres), então todo script
-- novo tem de fazer `revoke all on function ... from public, anon` e conceder só a quem precisa, como os scripts 20 a 48 fazem.
-- Vale para o que o dono do banco criar; se este usuário não puder mudar o padrão, segue sem erro.
do $$
declare alvo text; obj text;
begin
  foreach alvo in array array['', 'for role postgres '] loop
    foreach obj in array array['all on tables', 'all on sequences', 'execute on functions'] loop
      begin
        execute format('alter default privileges %sin schema public revoke %s from anon, authenticated', alvo, obj);
      exception when insufficient_privilege or undefined_object then null;
      end;
    end loop;
  end loop;
end $$;

-- a API relê as funções e as configurações novas
notify pgrst, 'reload schema';
notify pgrst, 'reload config';

-- o script 20 (IA) é opcional: sem a tabela dele, a função de limite de uso não fica instalada
do $$ begin if to_regclass('public.ia_usos') is null then drop function if exists public.registrar_uso_ia(); end if; end $$;

commit;

select 'Correções da auditoria do banco instaladas' as resultado,
       (select count(*) from pg_policies where schemaname = 'public' and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(?<!SELECT )(?<!public\.)\m(meu_papel|meu_id|minha_uf)\(\)') as regras_de_acesso_ainda_por_linha,
       (select count(*) from pg_trigger where not tgisinternal and tgname in ('a1_versao', 'diagnosticos_a1_versao', 'avaliacoes_a1_versao')) as gatilhos_de_versao_de_4,
       (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon') as privilegios_de_tabela_do_anonimo,
       (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype <> 'trigger'::regtype
          and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') and has_function_privilege('anon', p.oid, 'EXECUTE')) as funcoes_abertas_a_quem_nao_entrou,
       (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and not ('search_path=public, pg_temp' = any (coalesce(p.proconfig, '{}')))) as funcoes_sem_search_path_fechado,
       (select count(*) from pg_constraint where connamespace = 'public'::regnamespace and conname ~ '^(tam_|lista_)') as travas_de_tamanho,
       coalesce((select array_to_string(s.setconfig, ', ') from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticated' and s.setdatabase = 0),
                'não definida (este usuário do banco não pôde alterar: defina pelo painel)') as espera_por_trava_de_quem_entrou,
       -- travas que NÃO foram criadas porque já havia dado antigo fora da regra (o gatilho confere os novos; o 90_auditoria_dados.sql mostra os casos)
       coalesce(nullif(concat_ws(' | ',
         (select 'texto acima do limite em: ' || string_agg(l.tabela || '.' || l.coluna, ', ' order by l.tabela, l.coluna) from _47_limites l
           where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.tabela and c.column_name = l.coluna)
             and not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || l.tabela)::regclass and k.conname = format('tam_%s_%s', l.coluna, l.limite))),
         (select 'estado (UF) fora da lista em: ' || string_agg(c.table_name, ', ' order by c.table_name) from information_schema.columns c where c.table_schema = 'public' and c.column_name = 'uf'
             and c.table_name in ('visitas', 'diagnosticos', 'avaliacoes', 'orientacoes_venda', 'vitrine_fotos', 'pre_cadastros')
             and not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || c.table_name)::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ '\muf\M.*AL.*BA.*PE.*PI.*SE')),
         case when to_regclass('public.pre_cadastros_cpf_aguardando') is null then 'o mesmo CPF em mais de um cadastro aguardando conferência (decida os repetidos e rode o 47 de novo)' end), ''), 'nenhum') as dados_antigos_fora_das_travas_novas;
