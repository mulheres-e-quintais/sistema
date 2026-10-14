#!/bin/bash
# carga_1410: monta um banco LOCAL de teste (stub do Supabase + todas as etapas do supabase/, sem dados de exemplo)
# e grava a massa sintética pelos perfis certos. NÃO é o Supabase real (sem PostgREST, sem rede, sem pooler).
# Uso: bash supabase/tests/carga_1410/montar.sh [nome_do_banco]   (padrão: bdcarga1410)
DB=${1:-bdcarga1410}; D=$(cd "$(dirname "$0")" && pwd); S=$(cd "$D/../.." && pwd)
T=$(mktemp -d); cp "$D"/*.sql "$S"/[0-9][0-9]_*.sql "$S"/tests/stub_supabase.sql "$T"/; chmod -R a+rX "$T"
sudo -u postgres dropdb --if-exists "$DB"; sudo -u postgres createdb "$DB"
P="sudo -u postgres psql -X -q -d $DB -v ON_ERROR_STOP=0"
$P -f "$T/stub_supabase.sql" 2>&1 | grep ERROR | grep -v "already exists"
sed -i "s/'SEU NOME COMPLETO', 'SEU CPF'/'Cleone Silva Teste', '52998224725'/" "$T/01_criar_banco.sql"
for f in $(cd "$T" && ls [0-9][0-9]_*.sql | grep -v -E "^(00|05|06|14|16|34|49|54|90|91|99)_|^0[01]_(funcoes|massa)"); do
  n=$($P -f "$T/$f" 2>&1 | grep -c ERROR); [ "$n" != 0 ] && echo "$f: $n erros"
done
$P -f "$T/00_funcoes.sql"
t0=$(date +%s.%N); $P -f "$T/01_massa.sql"
echo "massa: $(echo "$(date +%s.%N) - $t0" | bc) s de relógio"
