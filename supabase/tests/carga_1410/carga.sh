#!/bin/bash
# carga_1410: um cenário de carga com pgbench no banco LOCAL (não é o Supabase: sem PostgREST, sem rede, sem pooler).
# Uso: bash carga.sh <banco> <nome> <clientes> <segundos> [taxa_alvo_tps (vazio = sem limite)] [jobs]
# Mistura (pesos): listas da coordenação (fichas 10, visitas 10, diagnósticos 5), visitas da bolsista 15, listas do agente 15,
# gravar visita 15 (UPDATE com gatilhos, COMMIT), gravar ficha 5 (INSERT com gatilhos, ROLLBACK), acompanhamento_dados 10,
# auditoria página 1 (10) e páginas seguintes (5). Cada transação = um pedido do PostgREST (set_config + SET LOCAL ROLE).
DB=$1; NOME=$2; C=$3; S=$4; R=$5; J=${6:-2}
D=$(cd "$(dirname "$0")" && pwd); W=${W:-/tmp/c1410w}; L=$W/logs/$NOME; mkdir -p "$L"; chmod 777 "$W" "$W/logs" "$L"; rm -f "$L"/pgbench_log.*
cp "$D"/pgbench/*.sql "$W"/; chmod a+r "$W"/*.sql
F="-f $W/s01_coord_fichas.sql@10 -f $W/s02_coord_visitas.sql@10 -f $W/s03_coord_diag.sql@5 -f $W/s04_bols_visitas.sql@15 -f $W/s05_agente_listas.sql@15 -f $W/s06_gravar_visita.sql@15 -f $W/s07_gravar_ficha.sql@5 -f $W/s08_acomp_dados.sql@10 -f $W/s09_auditoria_p1.sql@10 -f $W/s10_auditoria_pn.sql@5"
cd "$L"; echo "carga da máquina antes: $(cut -d" " -f1-3 /proc/loadavg)" > "$L/maquina.txt"
sudo -u postgres pgbench -n -M simple -c "$C" -j "$J" -T "$S" ${R:+-R $R} -P ${P:-10} --max-tries=1 --failures-detailed -l --log-prefix="$L/pgbench_log" $F -d "$DB" > "$L/saida.txt" 2>&1
python3 "$D/resumo.py" "$L" "$NOME" "$C" "$S" "${R:--}"; echo "  máquina: $(cat "$L/maquina.txt"); depois: $(cut -d" " -f1-3 /proc/loadavg)"
