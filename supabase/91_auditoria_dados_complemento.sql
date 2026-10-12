-- =====================================================================
-- Mulheres & Quintais — 91: COMPLEMENTO DA AUDITORIA DOS DADOS (só lê, não muda nada) — 12/10/2026
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode DEPOIS do 90_auditoria_dados.sql
-- (este traz só o que o 90 não confere). Mesmo formato do 90: uma linha por verificação, com a contagem
-- e o SELECT para ver os casos (o SELECT mostra dados pessoais: rode só quem pode vê-los).
-- Precisa dos scripts 01 a 48 instalados. É um comando só, feito de SELECT: não cria, não altera, não apaga nada.
--
-- Grupo K: o que a auditoria do sistema de 12/10/2026 achou que pode ter entrado no banco
-- =====================================================================
with proj (uf, municipio) as (values
  ('AL','cacimbinhas'),('AL','estrela de alagoas'),('AL','palmeira dos indios'),
  ('BA','cansancao'),('BA','iraquara'),('BA','itiuba'),('BA','laje'),('BA','lencois'),('BA','ponto novo'),('BA','taperoa'),('BA','vitoria da conquista'),
  ('PE','araripina'),('PE','bodoco'),('PE','cedro'),('PE','ouricuri'),('PE','serrita'),
  ('PI','alagoinha do piaui'),('PI','campo grande do piaui'),('PI','francisco santos'),('PI','geminiano'),('PI','oeiras'),('PI','paulistana'),
  ('PI','pio ix'),('PI','sao joao da varjota'),('PI','sao juliao'),('PI','teresina'),
  ('SE','neopolis'),('SE','pacatuba'),('SE','porto da folha')),
bolsa (papel, valor) as (values ('coord_tecnico', 4700::numeric), ('articulacao', 2200), ('apoio', 1600), ('professor_fic', 2200), ('auxiliar_adm', 1200)),
c (codigo, verificacao, quantidade, como_ver) as (
  select 'K01', 'bolsa pedida ou com aval em valor diferente do valor da função (coord. técnica 4.700; articulação 2.200; apoio 1.600; professor 2.200; auxiliar 1.200)',
    (select count(*) from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id join bolsa b on b.papel = e.papel
      where s.tipo = 'bolsa' and s.situacao <> 'devolvida' and (s.valor_solicitado <> b.valor or coalesce(s.valor_avalizado, b.valor) <> b.valor)),
    $q$select s.id, e.nome, e.papel, s.mes, s.situacao, s.valor_solicitado, s.valor_avalizado from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id where s.tipo = 'bolsa' and s.situacao <> 'devolvida' order by s.mes;$q$
  union all
  select 'K02', 'bolsa de mês fora do período das bolsas (antes de 10/2026 ou depois de 09/2027)',
    (select count(*) from public.solicitacoes_pagamento where tipo = 'bolsa' and situacao <> 'devolvida' and (mes < date '2026-10-01' or mes > date '2027-09-01')),
    $q$select id, equipe_id, mes, situacao, valor_solicitado from public.solicitacoes_pagamento where tipo = 'bolsa' and situacao <> 'devolvida' and (mes < date '2026-10-01' or mes > date '2027-09-01');$q$
  union all
  select 'K03', 'visita (não cancelada) feita ou prevista fora da vigência do TED (14/09/2026 a 30/09/2027)',
    (select count(*) from public.visitas where situacao <> 'cancelada' and (coalesce(data_realizada, data_prevista) < date '2026-09-14' or coalesce(data_realizada, data_prevista) > date '2027-09-30')),
    $q$select id, uf, etapa, situacao, data_prevista, data_realizada from public.visitas where situacao <> 'cancelada' and (coalesce(data_realizada, data_prevista) < date '2026-09-14' or coalesce(data_realizada, data_prevista) > date '2027-09-30');$q$
  union all
  select 'K04', 'termo de compromisso com data registrada e SEM o arquivo do termo (registro de antes da etapa 48: anexar o termo)',
    (select count(*) from public.equipe where status = 'ativa' and termo_assinado_em is not null and nullif(trim(coalesce(termo_path, '')), '') is null),
    $q$select id, nome, papel, uf, termo_assinado_em from public.equipe where status = 'ativa' and termo_assinado_em is not null and nullif(trim(coalesce(termo_path, '')), '') is null;$q$
  union all
  select 'K05', 'termo anexado pela pessoa e ainda sem conferência há mais de 7 dias',
    (select count(*) from public.equipe where status = 'ativa' and termo_path is not null and termo_assinado_em is null and atualizado_em < now() - interval '7 days'),
    $q$select id, nome, papel, uf, termo_path, atualizado_em from public.equipe where status = 'ativa' and termo_path is not null and termo_assinado_em is null and atualizado_em < now() - interval '7 days';$q$
  union all
  select 'K06', 'ficha com município fora dos 29 municípios do projeto, ou de outro estado (texto livre: grafia, sítio, comunidade ou dado pessoal digitado no lugar)',
    (select count(*) from public.fichas f where not exists (select 1 from proj p where p.uf = f.uf
       and p.municipio = lower(translate(trim(f.municipio), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')))),
    $q$select f.id, f.uf, f.municipio, f.situacao, f.resultado from public.fichas f where not exists (select 1 from (values ('AL','cacimbinhas'),('AL','estrela de alagoas'),('AL','palmeira dos indios'),('BA','cansancao'),('BA','iraquara'),('BA','itiuba'),('BA','laje'),('BA','lencois'),('BA','ponto novo'),('BA','taperoa'),('BA','vitoria da conquista'),('PE','araripina'),('PE','bodoco'),('PE','cedro'),('PE','ouricuri'),('PE','serrita'),('PI','alagoinha do piaui'),('PI','campo grande do piaui'),('PI','francisco santos'),('PI','geminiano'),('PI','oeiras'),('PI','paulistana'),('PI','pio ix'),('PI','sao joao da varjota'),('PI','sao juliao'),('PI','teresina'),('SE','neopolis'),('SE','pacatuba'),('SE','porto da folha')) p(uf, municipio) where p.uf = f.uf and p.municipio = lower(translate(trim(f.municipio), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))) order by f.uf, f.municipio;$q$
  union all
  select 'K07', 'visita de diagnóstico ou avaliação FEITA sem o formulário, ou implantação/acompanhamento FEITO sem relato, que já está em pedido de pagamento',
    (select count(*) from public.visitas v join public.solicitacao_visitas sv on sv.visita_id = v.id where v.situacao = 'realizada' and (
       (v.etapa = 'diagnostico' and not exists (select 1 from public.diagnosticos d where d.visita_id = v.id))
       or (v.etapa in ('implantacao', 'acompanhamento') and length(trim(coalesce(v.relato, ''))) < 20))),
    $q$select v.id, v.uf, v.etapa, v.data_realizada, sv.solicitacao_id from public.visitas v join public.solicitacao_visitas sv on sv.visita_id = v.id where v.situacao = 'realizada' and ((v.etapa = 'diagnostico' and not exists (select 1 from public.diagnosticos d where d.visita_id = v.id)) or (v.etapa in ('implantacao', 'acompanhamento') and length(trim(coalesce(v.relato, ''))) < 20));$q$
  union all
  select 'K08', 'pessoa DESLIGADA com visita feita que não está em nenhum pedido de pagamento (ficou sem receber)',
    (select count(*) from public.visitas v join public.equipe e on e.id = v.executor_id where e.status <> 'ativa' and v.situacao = 'realizada'
       and not exists (select 1 from public.solicitacao_visitas sv where sv.visita_id = v.id)),
    $q$select e.nome, e.papel, e.data_fim, v.id, v.etapa, v.data_realizada from public.visitas v join public.equipe e on e.id = v.executor_id where e.status <> 'ativa' and v.situacao = 'realizada' and not exists (select 1 from public.solicitacao_visitas sv where sv.visita_id = v.id);$q$
  union all
  select 'K09', 'foto apontada para remoção da vitrine (autorização retirada) que ainda está na fila: o arquivo pode continuar público',
    (select count(*) from public.vitrine_remover),
    $q$select * from public.vitrine_remover;$q$
)
select '[' || codigo || '] ' || verificacao as verificacao, quantidade,
       case when quantidade = 0 then 'ok' else 'ATENÇÃO' end as status, como_ver
  from c
 order by codigo;
