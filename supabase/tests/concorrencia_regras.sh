#!/bin/bash
# Concorrência das regras do 46: duas sessões fazem a mesma coisa ao mesmo tempo; só uma pode valer.
#  1. pedido complementar de ajuda de custo: a mesma visita em dois pedidos ao mesmo tempo → fica em UM pedido só
#  2. ... e duas visitas diferentes, cada uma no seu pedido complementar, ao mesmo tempo → os dois valem
#  3. canal de venda igual cadastrado duas vezes ao mesmo tempo → fica um
#  4. encontro do FIC (mesma turma, dia e modalidade) registrado duas vezes ao mesmo tempo → fica um
#  5. situação da água registrada duas vezes ao mesmo tempo → fica uma
# Uso: bash concorrencia_regras.sh <banco de teste>   (precisa da suíte já rodada no banco: usa o cenário do test_regras_decididas.sql)
DB=${1:-ts}; Q="sudo -u postgres psql -X -q -d $DB -tA"; FALHAS=0
uid() { $Q -c "select user_id from public.equipe where email = '$1' and status = 'ativa' and user_id is not null limit 1"; }
sess() { # $1 login (uuid), $2 comando, $3 arquivo de saída
  $Q -v ON_ERROR_STOP=1 <<SQL > "$3" 2>&1
begin;
select set_config('request.jwt.claim.sub', '$1', true); set local role authenticated;
$2;
select pg_sleep(1.5);
commit;
SQL
}
par() { # nome, login A, comando A, login B, comando B, conferência (sql que devolve t/f), o que se espera das sessões (um_erro | sem_erro)
  sess "$2" "$3" /tmp/conc46_a.out & sleep 0.3; sess "$4" "$5" /tmp/conc46_b.out & wait
  local EA=$(grep -o 'ERROR.*' /tmp/conc46_a.out | head -1); local EB=$(grep -o 'ERROR.*' /tmp/conc46_b.out | head -1)
  local OK=$($Q -c "select ($6)"); local N=0; [ -n "$EA" ] && N=$((N+1)); [ -n "$EB" ] && N=$((N+1))
  if [ "$7" = um_erro ] && [ $N -ne 1 ]; then OK=f; fi
  if [ "$7" = sem_erro ] && [ $N -ne 0 ]; then OK=f; fi
  echo "sessão A: ${EA:-ok}"; echo "sessão B: ${EB:-ok}"
  if [ "$OK" = t ]; then echo "PASSOU | $1"; else echo "FALHOU | $1"; FALHAS=$((FALHAS+1)); fi
}
RG=$(uid r46.ag@t.com); BB=$(uid art.ba@t.com); RP=$(uid r46.prof@t.com); G=$($Q -c "select user_id from public.equipe where papel = 'coord_geral' and status = 'ativa' and user_id is not null limit 1")
if [ -z "$RG" ] || [ -z "$BB" ] || [ -z "$RP" ] || [ -z "$G" ]; then echo "FALHOU | cenário do test_regras_decididas.sql não encontrado no banco $DB (rode a suíte antes)"; exit 1; fi
M1=$($Q -c "select ((now() at time zone 'America/Fortaleza')::date - (extract(day from (now() at time zone 'America/Fortaleza')::date)::int - 1) - interval '1 month')::date")
V='f6200000-0000-0000-0000-000000000'
limpar() { $Q <<SQL >/dev/null
set session_replication_role = replica;
delete from public.solicitacao_visitas where visita_id in ('${V}051', '${V}101', '${V}102');
delete from public.solicitacoes_pagamento s where s.detalhe ->> 'teste' = 'concorrencia46';
delete from public.canais_venda where nome ilike 'Feira da concorrência 46%';
delete from public.fic_presencas where encontro_id in (select id from public.fic_encontros where conteudo like 'Concorrência 46:%');
delete from public.fic_encontros where conteudo like 'Concorrência 46:%';
delete from public.agua_situacoes where obs like 'Concorrência 46:%';
SQL
}
limpar
AJ() { echo "select public.solicitar_pagamento('ajuda_custo', '$M1', 100, null, array['${V}$1']::uuid[], '{\"total\": 100, \"teste\": \"concorrencia46\"}')"; }
par "ajuda de custo: a mesma visita em dois pedidos complementares ao mesmo tempo fica em UM pedido só" "$RG" "$(AJ 051)" "$RG" "$(AJ 051)" \
  "select (select count(*) from public.solicitacao_visitas where visita_id = '${V}051') = 1 and (select count(*) from public.solicitacoes_pagamento where detalhe ->> 'teste' = 'concorrencia46') = 1" um_erro
par "ajuda de custo: duas visitas diferentes, cada uma no seu pedido complementar, ao mesmo tempo: os dois valem" "$RG" "$(AJ 101)" "$RG" "$(AJ 102)" \
  "select (select count(distinct solicitacao_id) from public.solicitacao_visitas where visita_id in ('${V}101', '${V}102')) = 2 and (select count(*) from public.solicitacoes_pagamento where detalhe ->> 'teste' = 'concorrencia46') = 3" sem_erro
par "canal de venda: o mesmo canal cadastrado duas vezes ao mesmo tempo fica um" "$BB" "select public.salvar_canal_venda(null, 'BA', 'Juazeiro', 'feira', 'Feira da concorrência 46', null, null, true)" \
  "$BB" "select public.salvar_canal_venda(null, 'BA', 'JUAZEIRO', 'feira', ' feira da CONCORRÊNCIA 46 ', null, null, true)" \
  "select count(*) = 1 from public.canais_venda where nome ilike 'Feira da concorr%ncia 46'" um_erro
par "encontro do FIC: mesma turma, dia e modalidade registrados duas vezes ao mesmo tempo fica um" \
  "$RP" "select public.registrar_encontro_fic(null, 'f6500000-0000-0000-0000-000000000001', public.fic_hoje(), 2, 'online', 'Concorrência 46: aula enviada pelo computador', '{}')" \
  "$RP" "select public.registrar_encontro_fic(null, 'f6500000-0000-0000-0000-000000000001', public.fic_hoje(), 2, 'online', 'Concorrência 46: a mesma aula enviada pelo celular', '{}')" \
  "select count(*) = 1 from public.fic_encontros where conteudo like 'Concorrência 46:%' and cancelado_em is null" um_erro
FA=$($Q -c "select id from public.fichas where resultado = 'sem_agua' limit 1")
SIT=$($Q -c "select case when coalesce((select situacao from public.agua_situacoes where ficha_id = '$FA' order by registrado_em desc limit 1), '') = 'encaminhada' then 'em_andamento' else 'encaminhada' end")
par "água: a mesma situação registrada duas vezes ao mesmo tempo fica uma" "$G" "select public.registrar_situacao_agua('$FA', '$SIT', 'Concorrência 46: registrada pela primeira sessão')" \
  "$G" "select public.registrar_situacao_agua('$FA', '$SIT', 'Concorrência 46: registrada pela segunda sessão')" \
  "select count(*) = 1 from public.agua_situacoes where obs like 'Concorrência 46:%'" um_erro
limpar
rm -f /tmp/conc46_a.out /tmp/conc46_b.out
if [ $FALHAS -eq 0 ]; then echo "PASSOU | concorrência das regras do 46: 5 de 5"; else echo "FALHOU | concorrência das regras do 46: $FALHAS caso(s)"; fi
