#!/bin/bash
# Mulheres & Quintais — gera js/simulacao-dados.js (a página simulacao.html: o sistema como fica no FIM do projeto, sem banco).
# Monta um banco local de teste, roda o supabase/95_simulacao_completa.sql e converte as tabelas para o formato da demonstração.
# Uso: bash ferramentas/simulacao/gerar.sh   (precisa do Postgres local: sudo service postgresql start)
set -e
cd "$(dirname "$0")/../.."
DB=simfim_gerar; OUT=$(mktemp -d)
bash supabase/tests/montar_banco_teste.sh $DB >/dev/null 2>&1
P="sudo -u postgres psql -X -q -d $DB -At -v ON_ERROR_STOP=1"
$P -f supabase/95_simulacao_completa.sql >/dev/null
chmod 777 "$OUT"
for t in equipe equipe_privado fichas visitas diagnosticos avaliacoes custos_visita solicitacoes_pagamento solicitacao_visitas entregas_mes turmas_fic \
         matriculas_fic fic_encontros fic_presencas pedidos_apoio documentos_projeto execucao_planilhas agua_situacoes canais_venda orientacoes_venda \
         observadores relatos_problema convites pre_cadastros vitrine_fotos acessos ciencias apl_municipios kit_itens parametros; do
  $P -c "select coalesce(json_agg(x), '[]') from public.$t x" > "$OUT/$t.json"
done
# histórico: os 600 registros mais recentes (o completo passa de 1 MB e a tela mostra 200 por vez)
$P -c "select coalesce(json_agg(x order by x.em desc), '[]') from (select * from public.auditoria order by em desc limit 600) x" > "$OUT/auditoria.json"
node ferramentas/simulacao/converter.js "$OUT"
node ferramentas/simulacao/ajustar_financeiro.js "${PLAYWRIGHT:-/opt/npm-tools/node_modules/playwright}"
sudo -u postgres dropdb $DB; rm -rf "$OUT"
