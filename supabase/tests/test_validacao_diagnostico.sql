-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB) e ANTES do test_conferencia_auxiliar.sql
-- 31_validacao_diagnostico.sql: quem alterou não aprova; localização de verdade
\set QUIET on
truncate res;
select set_config('t.bb', :BB, false);
-- cenário (como superusuário): quintal selecionado e aprovado na BA, visita de diagnóstico da bolsista :BB, habilitada
do $x$ declare b public.equipe; begin
  select * into b from public.equipe where user_id = current_setting('t.bb')::uuid;
  alter table public.equipe disable trigger user; alter table public.fichas disable trigger user; alter table public.visitas disable trigger user;
  update public.equipe set matricula_fic_em = coalesce(matricula_fic_em, current_date), docs_funcern_em = coalesce(docs_funcern_em, current_date),
    termo_assinado_em = coalesce(termo_assinado_em, current_date) where id = b.id;
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco,
    c_agricultora,c_maior18,c_espaco,c_agua,c_disponibilidade,c_sem_kit,c_sem_parentesco,c_casa_unica,autodeclaracao, consent_dados, resultado, data_ficha, situacao, bolsista_id)
  values ('d1000000-0000-0000-0000-000000000001', 'BA', 'Juazeiro', 'Lagoa Teste', 'Maria Diag Teste', '52998224725', '1980-01-01', 'Sítio 1',
    true,true,true,true,true,true,true,true,true,true,'selecionada', current_date, 'aprovada', b.id);
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, situacao)
  values ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'BA', 'diagnostico', b.id, current_date, 'prevista');
  alter table public.equipe enable trigger user; alter table public.fichas enable trigger user; alter table public.visitas enable trigger user;
end $x$;
\set INS 'insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, agua_seca, lote, sem_gps_motivo) values (''d3000000-0000-0000-0000-000000000001'',''d1000000-0000-0000-0000-000000000001'',''d2000000-0000-0000-0000-000000000001'',''BA'', current_date, ''sim'', 1, '
\set DG 'update public.diagnosticos set '
\set W ' where id = ''d3000000-0000-0000-0000-000000000001'''

select t('sem GPS com explicação curta (menos de 15 letras) é recusado', :BB, :'INS' || $q$'sem sinal')$q$, '15 letras');
select f(:BB, :'INS' || $q$'O celular não achou o sinal de GPS no quintal. Fica no fundo do vale')$q$);
select t('registro guarda quem mexeu no conteúdo (a bolsista)', :G, $q$do $x$ begin if (select e.email from public.diagnosticos d join public.equipe e on e.id = d.conteudo_alterado_por) <> 'art.ba@t.com' then raise exception 'x'; end if; end $x$$q$, 'ok');
select t('técnica NÃO aprova sem localização e sem observação', :T, :'DG' || $q$situacao = 'aprovado'$q$ || :'W', 'sem localização');
select t('técnica NÃO aprova sem localização com observação curta', :T, :'DG' || $q$situacao = 'aprovado', obs_coordenacao = 'ok visto'$q$ || :'W', 'sem localização');
select t('técnica aprova sem localização dizendo como confirmou', :T, :'DG' || $q$situacao = 'aprovado', obs_coordenacao = 'Liguei para a mulher e confirmei a visita'$q$ || :'W', 'ok');
select t('técnica continua sem poder mexer no conteúdo', :T, :'DG' || $q$area_m2 = 10$q$ || :'W', 'quem corrige é quem fez a visita');
select t('ninguém forja quem alterou', :T, $q$do $x$ begin update public.diagnosticos set conteudo_alterado_por = null;
  if (select conteudo_alterado_por from public.diagnosticos) is null then raise exception 'forjou'; end if; end $x$$q$, 'ok');
select f(:T, :'DG' || $q$situacao = 'devolvido', obs_coordenacao = 'Confirmar a localização'$q$ || :'W');
select f(:BB, :'DG' || $q$area_m2 = 120$q$ || :'W');
select t('correção da bolsista volta para análise', :G, $q$do $x$ begin if (select situacao from public.diagnosticos) <> 'aguardando' then raise exception 'x'; end if; end $x$$q$, 'ok');
select t('aprovar sem localização repetindo a observação antiga é recusado', :T, :'DG' || $q$situacao = 'aprovado'$q$ || :'W', 'sem localização');
-- coordenação geral corrige: não aprova o que ela mesma alterou
select f(:G, :'DG' || $q$area_m2 = 130$q$ || :'W');
select t('geral alterou: quem alterou passa a ser ela', :G, $q$do $x$ begin if (select e.email from public.diagnosticos d join public.equipe e on e.id = d.conteudo_alterado_por) <> 'cleone.lima@ifrn.edu.br' then raise exception 'x'; end if; end $x$$q$, 'ok');
select t('geral NÃO aprova o que ela alterou', :G, :'DG' || $q$situacao = 'aprovado', obs_coordenacao = 'Liguei para a mulher e confirmei a visita'$q$ || :'W', 'Você alterou');
select t('geral NÃO altera e aprova no mesmo passo', :G, :'DG' || $q$area_m2 = 140, situacao = 'aprovado', obs_coordenacao = 'Liguei para a mulher e confirmei a visita'$q$ || :'W', 'Você alterou');
select t('técnica aprova o que a geral alterou', :T, :'DG' || $q$situacao = 'aprovado', obs_coordenacao = 'Liguei para a mulher e confirmei a visita'$q$ || :'W', 'ok');
select t('geral devolve o que ela alterou (caminho sem técnica)', :G, :'DG' || $q$situacao = 'devolvido', obs_coordenacao = 'Confira a área e reenvie'$q$ || :'W', 'ok');
select f(:G, :'DG' || $q$situacao = 'devolvido', obs_coordenacao = 'Confira a área e reenvie'$q$ || :'W');
select f(:BB, :'DG' || $q$latitude = -9.41, longitude = -40.50, sem_gps_motivo = null$q$ || :'W');
select t('depois da correção de quem aplicou, a geral aprova (com GPS, sem observação obrigatória)', :G, :'DG' || $q$situacao = 'aprovado'$q$ || :'W', 'ok');
select f(:T, :'DG' || $q$situacao = 'aprovado'$q$ || :'W');
select f(:G, :'DG' || $q$area_m2 = 150$q$ || :'W');
select t('plano aprovado alterado pela geral volta para análise', :G, $q$do $x$ begin if (select situacao from public.diagnosticos) <> 'aguardando' then raise exception 'ficou %', (select situacao from public.diagnosticos); end if; end $x$$q$, 'ok');
select t('bolsista NÃO tira o GPS sem explicar', :BB, :'DG' || $q$latitude = null, longitude = null, sem_gps_motivo = 'sem gps'$q$ || :'W', '15 letras');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
