-- roda na MESMA sessão do psql, depois do test_cadastro_equipe.sql (usa :G, :T, :X, :BB, t(), f(), logar(), ins()):
--   psql -d teste -f tests/test_cadastro_equipe.sql -f tests/test_termo_pela_pessoa.sql
-- e ANTES do test_conferencia_auxiliar.sql
-- 48_termo_pela_pessoa.sql: a própria pessoa anexa o termo; a data só entra com o termo anexado; quem confere registra a data.
\set QUIET on
truncate res;
grant select, insert on storage.objects to authenticated;  -- no Supabase de verdade essa permissão já existe; o stub local não tem
-- cenário: o auxiliar do test_cadastro_equipe.sql (:X) e uma agente nova, com login (sem termo). Os nomes começam com "tp_" para não trocar :A do outro teste.
select f(:T, ins('agente','BA','Tina Termo Agente','83698741008','ag47@t.com'));
select logar('ag47@t.com') \gset tp_
\set TA '''' :tp_logar ''''
select id as ag from public.equipe where email = 'ag47@t.com' \gset
select id as aux from public.equipe where email = 'aux@t.com' and status = 'ativa' \gset
select id as bb from public.equipe where user_id = :BB \gset
\set PAG 'equipe/' :ag '/termo_1759400000000.pdf'
\set PAUX 'equipe/' :aux '/termo_1759400000001.jpg'

-- ===== a data não entra sem o termo anexado
select t('auxiliar NÃO registra a data do termo sem o termo anexado', :X, format($q$update public.equipe set termo_assinado_em = public.fic_hoje() where id = %L$q$, :'ag'), 'Sem o termo anexado');
select t('coordenação geral também NÃO registra a data sem o termo anexado', :G, format($q$update public.equipe set termo_assinado_em = public.fic_hoje() where id = %L$q$, :'ag'), 'Sem o termo anexado');
select t('o cadastro no Arlo continua sendo registrado sem o termo', :X, format($q$update public.equipe set docs_funcern_em = public.fic_hoje() where id = %L$q$, :'ag'), 'ok');

-- ===== a própria pessoa anexa
select t('anônimo não envia termo', null, format($q$select public.enviar_meu_termo(%L)$q$, :'PAG'), 'permission denied');
select t('a pessoa NÃO grava arquivo da pasta de outra pessoa', :TA, format($q$select public.enviar_meu_termo(%L)$q$, :'PAUX'), 'inválido');
select t('caminho fora do padrão é recusado', :TA, format($q$select public.enviar_meu_termo(%L)$q$, 'equipe/' || :'ag' || '/../x.exe'), 'inválido');
select t('a pessoa NÃO registra a própria data do termo', :TA, format($q$do $x$ begin update public.equipe set termo_assinado_em = public.fic_hoje(), termo_path = 'x' where id = %L;
  if (select termo_assinado_em from public.equipe where id = %L) is not null then raise exception 'gravou a data'; end if; end $x$$q$, :'ag', :'ag'), 'ok');
select t('a agente anexa o próprio termo (grava só o arquivo)', :TA, format($q$do $x$ begin perform public.enviar_meu_termo(%L);
  if (select termo_path from public.equipe where id = %L) is distinct from %L then raise exception 'não gravou'; end if;
  if (select termo_assinado_em from public.equipe where id = %L) is not null then raise exception 'gravou a data'; end if; end $x$$q$, :'PAG', :'ag', :'PAG', :'ag'), 'ok');
select t('o auxiliar anexa o PRÓPRIO termo', :X, format($q$do $x$ begin perform public.enviar_meu_termo(%L);
  if (select termo_path from public.equipe where id = %L) is distinct from %L then raise exception 'não gravou'; end if; end $x$$q$, :'PAUX', :'aux', :'PAUX'), 'ok');
select t('o auxiliar continua SEM registrar a própria habilitação', :X, format($q$update public.equipe set docs_funcern_em = public.fic_hoje() where id = %L$q$, :'aux'), 'coordenação geral');
select t('o auxiliar NÃO troca o próprio termo por update direto (só pela função)', :X, format($q$update public.equipe set termo_path = 'qualquer' where id = %L$q$, :'aux'), 'coordenação geral');
select t('a coordenação geral não tem termo', :G, $q$select public.enviar_meu_termo('equipe/x/termo_1.pdf')$q$, 'não tem termo');
select t('o envio fica no histórico, no nome de quem enviou', :TA, format($q$do $x$ declare n int; begin perform public.enviar_meu_termo(%L);
  set local role none;
  select count(*) into n from public.auditoria a where a.tabela = 'equipe' and a.registro_id = %L and a.por = %L and a.depois ->> 'termo_path' = %L;
  if n < 1 then raise exception 'sem registro no histórico'; end if; end $x$$q$, :'PAG', :'ag', :'ag', :'PAG'), 'ok');

-- ===== quem confere registra a data (com o termo anexado)
select f(:TA, format($q$select public.enviar_meu_termo(%L)$q$, :'PAG'));
select t('com o termo anexado, o auxiliar registra a data', :X, format($q$update public.equipe set termo_assinado_em = public.fic_hoje() where id = %L$q$, :'ag'), 'ok');
select t('quem confere anexa e registra a data no mesmo envio (termo recebido por fora)', :X, format($q$update public.equipe set termo_path = 'equipe/%s/termo_2.pdf', termo_assinado_em = public.fic_hoje() where id = %L$q$, :'bb', :'bb'), 'ok');
select f(:X, format($q$update public.equipe set termo_assinado_em = public.fic_hoje() where id = %L$q$, :'ag'));
select t('depois de conferido, a pessoa não troca mais o arquivo', :TA, format($q$select public.enviar_meu_termo(%L)$q$, 'equipe/' || :'ag' || '/termo_1759400000009.pdf'), 'já foi conferido');
select t('quem confere pode corrigir: limpa a data', :X, format($q$update public.equipe set termo_assinado_em = null where id = %L$q$, :'ag'), 'ok');

-- ===== registro antigo (data sem arquivo, gravada antes da regra) continua valendo e sendo editado
do $x$ begin set session_replication_role = replica;
  update public.equipe set termo_assinado_em = current_date - 3, termo_path = null where email = 'art.pi@t.com';
  set session_replication_role = origin; end $x$;
select t('registro antigo (data sem arquivo): outras alterações continuam passando', :G, $q$update public.equipe set obs_habilitacao = 'termo em papel, arquivado no campus' where email = 'art.pi@t.com'$q$, 'ok');
select t('registro antigo: mudar a data exige o arquivo', :G, $q$update public.equipe set termo_assinado_em = current_date - 1 where email = 'art.pi@t.com'$q$, 'Sem o termo anexado');

-- ===== arquivos (bucket "termos"): cada pessoa na própria pasta
select t('a pessoa envia arquivo para a própria pasta', :TA, format($q$insert into storage.objects (bucket_id, name) values ('termos', %L)$q$, :'PAG'), 'ok');
select t('a pessoa NÃO envia arquivo para a pasta de outra', :TA, format($q$insert into storage.objects (bucket_id, name) values ('termos', %L)$q$, :'PAUX'), 'row-level security');
select t('a pessoa lê só os próprios termos', :TA, format($q$do $x$ begin set local role none;
  insert into storage.objects (bucket_id, name) values ('termos', %L), ('termos', %L); set local role authenticated;
  if (select count(*) from storage.objects where bucket_id = 'termos') <> 1 then raise exception 'leu %%', (select count(*) from storage.objects where bucket_id = 'termos'); end if; end $x$$q$, :'PAG', :'PAUX'), 'ok');
select t('o auxiliar lê os termos de todos (para conferir)', :X, format($q$do $x$ begin set local role none;
  insert into storage.objects (bucket_id, name) values ('termos', %L), ('termos', %L); set local role authenticated;
  if (select count(*) from storage.objects where bucket_id = 'termos') < 2 then raise exception 'não leu'; end if; end $x$$q$, :'PAG', :'PAUX'), 'ok');

\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 110) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
\pset tuples_only on
