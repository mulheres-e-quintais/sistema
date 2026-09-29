\set QUIET on
grant select, insert on storage.objects to authenticated;  -- no Supabase de verdade essa permissão já existe; o stub local não tem
truncate res;
\set INS 'insert into public.documentos_projeto (tipo, titulo, data_documento, arquivo_path, arquivo_nome, tamanho, mime) values (''ata'', ''Ata da reunião de 29/09'', current_date, ''2026/x_'' || gen_random_uuid() || ''.pdf'', ''ata.pdf'', 1000, ''application/pdf'')'
select t('coordenação geral anexa documento', :G, :'INS', 'ok');
select f(:G, :'INS');
select t('coordenação técnica NÃO anexa', :T, :'INS', 'row-level security');
select t('professor NÃO anexa', :P, :'INS', 'row-level security');
select t('agente NÃO anexa', :A, :'INS', 'row-level security');
select t('coordenação técnica NÃO lê', :T, $q$do $x$ begin if exists(select 1 from public.documentos_projeto) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('auxiliar NÃO lê', :X, $q$do $x$ begin if exists(select 1 from public.documentos_projeto) then raise exception 'LEU'; end if; end $x$ $q$, 'ok');
select t('ninguém apaga (nem a coordenação geral)', :G, $q$delete from public.documentos_projeto$q$, 'permission denied');
select t('título curto recusado', :G, replace(:'INS', 'Ata da reunião de 29/09', 'Ata'), 'titulo');
select t('tipo inventado recusado', :G, replace(:'INS', '''ata''', '''meme'''), 'tipo');
select t('arquivo acima de 20 MB recusado', :G, replace(:'INS', ', 1000,', ', 30000000,'), 'tamanho');
select t('quem enviou é marcado pelo sistema', :G, $q$do $x$ begin if (select enviado_por from public.documentos_projeto limit 1) <> public.meu_id() then raise exception 'errado'; end if; end $x$ $q$, 'ok');
select t('arquivar sem motivo é recusado', :G, $q$update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'x'$q$, 'motivo');
select t('arquivar com motivo', :G, $q$update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Versão errada da ata'$q$, 'ok');
select f(:G, $q$update public.documentos_projeto set arquivado_em = now(), motivo_arquivo = 'Versão errada da ata'$q$);
select t('arquivado não volta', :G, $q$update public.documentos_projeto set arquivado_em = null$q$, 'não volta');
select t('arquivo não pode ser trocado', :G, $q$update public.documentos_projeto set arquivo_path = 'outro.pdf'$q$, 'não mudam');
select t('histórico registra o documento', :G, $q$do $x$ begin if not exists(select 1 from public.auditoria where tabela='documentos_projeto') then raise exception 'sem'; end if; end $x$ $q$, 'ok');
select t('pasta: coordenação geral envia arquivo', :G, $q$insert into storage.objects (bucket_id, name) values ('documentos', '2026/a.pdf')$q$, 'ok');
select t('pasta: coordenação técnica NÃO envia', :T, $q$insert into storage.objects (bucket_id, name) values ('documentos', '2026/b.pdf')$q$, 'row-level security');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 90) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
