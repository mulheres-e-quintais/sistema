#!/bin/bash
# carga_1410: roda tudo em sequência no banco LOCAL (NÃO é o Supabase: sem PostgREST, sem rede, sem pooler; os números valem
# para o Postgres desta máquina). Cada cenário começa de uma cópia limpa do banco com a massa (bdcarga1410_base).
#   1. monta o banco e grava a massa pelos perfis (montar.sh)      4. carga: 1, 15, 50 (taxa 25/s e sem limite), 90, 100, 200
#   2. integridade (test_auditoria_1410_integridade.sql)           5. pico abrupto (90 de uma vez) e rodada longa (50 x 10 min)
#   3. concorrência (concorrencia_1410.sh, R6 com 1 e 2 gravações)  6. EXPLAIN ANALYZE (03_explain.sql) antes e depois da rodada longa
# Uso: bash supabase/tests/carga_1410/rodar_tudo.sh   (uns 35 minutos)
set -u; D=$(cd "$(dirname "$0")" && pwd); W=${W:-/tmp/c1410w}; mkdir -p $W; chmod 777 $W
copia() { sudo -u postgres dropdb --if-exists "$1" 2>/dev/null; sudo -u postgres createdb -T bdcarga1410_base "$1"; }
bash "$D/montar.sh" bdcarga1410
cp "$D/02_prep_carga.sql" $W/; chmod a+r $W/02_prep_carga.sql; sudo -u postgres psql -X -q -d bdcarga1410 -f $W/02_prep_carga.sql
sudo -u postgres dropdb --if-exists bdcarga1410_base; sudo -u postgres createdb -T bdcarga1410 bdcarga1410_base
copia bdcarga1410_int; cp "$D/../test_auditoria_1410_integridade.sql" "$D/03_explain.sql" $W/; chmod a+r $W/*.sql
sudo -u postgres psql -X -d bdcarga1410_int -f $W/test_auditoria_1410_integridade.sql | grep -E '^[0-9]+\||^TOTAL'
for m in 1 2; do copia bdcarga1410_conc; MODO=$m bash "$D/concorrencia_1410.sh" bdcarga1410_conc 20 60; done
copia bdcarga1410_load; sudo -u postgres psql -X -d bdcarga1410_load -f $W/03_explain.sql > $W/explain_base.txt 2>&1
for c in "c1_base 1 60" "c15_pool 15 90" "c50_R25 50 120 25" "c50_sat 50 120" "c90_sat 90 120" "c100 100 60" "c200 200 60" "c90_R200 90 60 200"; do
  copia bdcarga1410_load; bash "$D/carga.sh" bdcarga1410_load $c | grep -E 'RESUMO|máquina|ERRO'
done
copia bdcarga1410_load; P=1 bash "$D/carga.sh" bdcarga1410_load pico90 90 30 | grep -E 'RESUMO|máquina'
copia bdcarga1410_long; P=30 bash "$D/carga.sh" bdcarga1410_long longo50 50 600 | grep -E 'RESUMO|máquina'; grep ^progress $W/logs/longo50/saida.txt
sudo -u postgres psql -X -d bdcarga1410_long -f $W/03_explain.sql > $W/explain_depois_longo.txt 2>&1
echo "planos em $W/explain_base.txt e $W/explain_depois_longo.txt"
