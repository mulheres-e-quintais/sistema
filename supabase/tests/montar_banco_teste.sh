#!/bin/bash
# (14/10/2026) banco local de teste: Postgres com o simulador do Supabase. Uso: bash supabase/tests/montar_banco_teste.sh <banco>
# monta um banco de teste com todas as etapas (menos dados de exemplo/zerar/popular); $1 = nome, $2 = "sem47" para parar no 46
DB=$1; cd /home/claude/sistema/supabase
chmod -R a+rX /home/claude /home/claude/sistema 2>/dev/null
sudo -u postgres dropdb --if-exists $DB; sudo -u postgres createdb $DB
P="sudo -u postgres psql -X -q -d $DB -v ON_ERROR_STOP=0"
$P -f tests/stub_supabase.sql 2>&1 | grep -E "ERROR" | head -3
sed "s/'SEU NOME COMPLETO', 'SEU CPF'/'Cleone Silva Teste', '52998224725'/" 01_criar_banco.sql > /tmp/01.sql; chmod a+r /tmp/01.sql
for f in /tmp/01.sql $(ls [0-9][0-9]_*.sql | grep -v -E "^(00|01|05|06|07|08|14|16|34|49|54|90|91|99)_"); do
  [ "$2" = sem47 ] && [[ "$f" == 47_* ]] && continue
  n=$($P -f $f 2>&1 | grep -c "ERROR"); [ "$n" != 0 ] && echo "$f: $n erros: $($P -f $f 2>&1 | grep ERROR | head -2 | cut -c1-200)"
done
echo "banco $DB montado"
