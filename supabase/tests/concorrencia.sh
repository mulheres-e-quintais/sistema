#!/bin/bash
# Concorrência: duas pessoas aprovam ao mesmo tempo a 40ª selecionada do mesmo estado. Só uma pode passar.
# Uso: bash concorrencia.sh <banco de teste>   (precisa da suíte já rodada no banco: usa a coordenação geral logada)
DB=${1:-ts}; Q="sudo -u postgres psql -X -q -d $DB -tA"
G=$($Q -c "select user_id from public.equipe where papel='coord_geral' and status='ativa' and user_id is not null limit 1")
$Q <<SQL >/dev/null
set session_replication_role = replica;
delete from public.fichas where nome like 'Concorrência %';
insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit,
  c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao)
select gen_random_uuid(), 'SE', 'Aracaju', 'Teste', 'Concorrência ' || g, lpad((80000000000 + g * 7919)::text, 11, '0'), '1980-01-01', 'Sítio', true, true, true, true, true, true, true, true, true, true,
       'selecionada', current_date, case when g <= 39 - (select count(*) from public.fichas where uf = 'SE' and resultado = 'selecionada' and situacao = 'aprovada') then 'aprovada' else 'aguardando' end
from generate_series(1, 41) g;
SQL
A=$($Q -c "select id from public.fichas where nome like 'Concorrência %' and situacao='aguardando' order by nome limit 1")
B=$($Q -c "select id from public.fichas where nome like 'Concorrência %' and situacao='aguardando' order by nome offset 1 limit 1")
aprova() { $Q -v ON_ERROR_STOP=1 <<SQL 2>&1
begin;
select set_config('request.jwt.claim.sub', '$G', true); set local role authenticated;
update public.fichas set situacao = 'aprovada' where id = '$1';
select pg_sleep(1.5);
commit;
SQL
}
aprova $A > /tmp/conc_a.out & aprova $B > /tmp/conc_b.out & wait
N=$($Q -c "select count(*) from public.fichas where uf='SE' and resultado='selecionada' and situacao='aprovada'")
$Q -c "set session_replication_role = replica; delete from public.fichas where nome like 'Concorrência %';" >/dev/null
echo "sessão A: $(grep -o 'ERROR.*' /tmp/conc_a.out | head -1 || true)"; echo "sessão B: $(grep -o 'ERROR.*' /tmp/conc_b.out | head -1 || true)"
if [ "$N" -le 40 ]; then echo "PASSOU | duas aprovações ao mesmo tempo: o estado ficou com $N selecionadas aprovadas (limite 40)"; else echo "FALHOU | o estado ficou com $N selecionadas aprovadas (passou do limite de 40)"; fi
