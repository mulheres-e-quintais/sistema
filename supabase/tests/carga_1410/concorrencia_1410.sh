#!/bin/bash
# carga_1410: corridas de concorrência com a massa cheia (banco LOCAL; não é o Supabase). Complementa concorrencia_bd.sh
# (que já cobre limites de vagas, dias de campo, pagamentos, CPF/ficha repetida etc.). Aqui:
#   R1-R3 reenvio simultâneo do MESMO registro (mesmo id, padrão "gravar" da tela: UPDATE; se 0 linhas, INSERT) — visita, diagnóstico, avaliação
#   R4    devolução da coordenação × correção da bolsista ao mesmo tempo (lost update da decisão)
#   R5    aprovação dupla do mesmo plano (técnica e geral ao mesmo tempo)
#   R6    caça a deadlock: N sessões gravando em linhas quentes do mesmo estado por SEG segundos
# Uso: bash concorrencia_1410.sh <banco (cópia do bdcarga1410_base)> [N=20] [SEG=60]
DB=$1; N=${2:-20}; SEG=${3:-60}; W=${W:-/tmp/c1410w}/conc; mkdir -p $W; chmod 777 $W; rm -f $W/*
Q="sudo -u postgres psql -X -q -tA -d $DB"
PASS=0; FAIL=0
uid() { $Q -c "select uid from carga.pessoas where email = '$1'"; }
# uma sessão: $1 uid, $2 comando, $3 arquivo de saída, $4 segundos segurando a transação antes do COMMIT
sess() { printf "begin;\nselect set_config('request.jwt.claim.sub', '%s', true);\nset local role authenticated;\n%s;\nselect pg_sleep(%s);\ncommit;\n" "$1" "$2" "${4:-0}" \
           | sudo -u postgres psql -X -q -tA -d $DB > "$3" 2>&1; }
res() { if [ "$1" = ok ]; then PASS=$((PASS+1)); echo "PASSOU | $2"; else FAIL=$((FAIL+1)); echo "FALHOU | $2"; fi; echo "         $3"; }
G=$(uid cleone.lima@ifrn.edu.br); T=$(uid tecnica@carga.invalid); B=$(uid articulacao1.se@carga.invalid); E=$(uid agente1.se@carga.invalid)
EID=$($Q -c "select equipe_id from carga.pessoas where email = 'agente1.se@carga.invalid'")
# cenário: libera 3 quintais do SE (sem visitas) para as corridas de reenvio (como dono, sem gatilhos, só para montar)
$Q <<'SQL' >/dev/null
set session_replication_role = replica;
delete from public.solicitacao_visitas where visita_id in (select v.id from public.visitas v join carga.fichas_plano f on f.id = v.ficha_id where f.uf = 'SE' and f.i in (36,37,38));
delete from public.avaliacoes where ficha_id in (select id from carga.fichas_plano where uf = 'SE' and i in (36,37,38));
delete from public.diagnosticos where ficha_id in (select id from carga.fichas_plano where uf = 'SE' and i in (36,37,38));
delete from public.visitas where ficha_id in (select id from carga.fichas_plano where uf = 'SE' and i in (36,37,38));
SQL
F36=$($Q -c "select id from carga.fichas_plano where uf='SE' and i=36"); F37=$($Q -c "select id from carga.fichas_plano where uf='SE' and i=37")

echo "== R1. reenvio simultâneo da MESMA visita (mesmo id), 5 sessões"
VID=c1410000-0000-4000-8000-000000000001
for k in 1 2 3 4 5; do sess "$B" "with u as (update public.visitas set data_prevista = date '2026-10-13' where id = '$VID' returning id) select count(*) from u; insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) select '$VID', '$F36', 'SE', 'diagnostico', '$EID', date '2026-10-13' where not exists (select 1 from public.visitas where id = '$VID')" $W/r1_$k 1 & done; wait
n=$($Q -c "select count(*) from public.visitas where ficha_id = '$F36'"); err=$(cat $W/r1_* | grep -h ERROR | sort | uniq -c | sed 's/^ *//' | tr '\n' ';')
[ "$n" = 1 ] && res ok "R1 visita: 1 registro no fim (sem duplicata)" "linhas=$n; erros vistos pelos outros envios: ${err:-nenhum}" || res no "R1 visita duplicada" "linhas=$n; $err"

echo "== R2. reenvio simultâneo do MESMO diagnóstico (mesmo id), 5 sessões"
DID=c1410000-0000-4000-8000-0000000000d1
for k in 1 2 3 4 5; do sess "$E" "insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, agua_seca, sem_agua, lote, dados) values ('$DID', '$F36', '$VID', 'SE', date '2026-10-13', -10.9, -37.0, 'sim', false, 1, '{}')" $W/r2_$k 1 & done; wait
n=$($Q -c "select count(*) from public.diagnosticos where ficha_id = '$F36'"); err=$(cat $W/r2_* | grep -h ERROR | sort | uniq -c | sed 's/^ *//' | tr '\n' ';')
[ "$n" = 1 ] && res ok "R2 diagnóstico: 1 registro no fim (sem duplicata)" "linhas=$n; erros vistos pelos outros envios: ${err:-nenhum}" || res no "R2 diagnóstico duplicado" "linhas=$n; $err"

echo "== R3. dois diagnósticos com ids DIFERENTES para o mesmo quintal (dois celulares), 2 sessões"
VID2=c1410000-0000-4000-8000-000000000002
sess "$B" "insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values ('$VID2', '$F37', 'SE', 'diagnostico', '$EID', date '2026-10-13')" $W/r3_0
for k in 1 2; do sess "$E" "insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, agua_seca, sem_agua, lote, dados) values (gen_random_uuid(), '$F37', '$VID2', 'SE', date '2026-10-13', -10.9, -37.0, 'sim', false, 1, '{}')" $W/r3_$k 1 & done; wait
n=$($Q -c "select count(*) from public.diagnosticos where ficha_id = '$F37'"); err=$(cat $W/r3_[12] | grep -h ERROR | sort | uniq -c | sed 's/^ *//' | tr '\n' ';')
if [ "$n" = 1 ] && ! echo "$err" | grep -q "duplicate key"; then res ok "R3 2 diagnósticos simultâneos: 1 entra, o outro lê mensagem clara" "$err"
elif [ "$n" = 1 ]; then res ok "R3 2 diagnósticos simultâneos: sem duplicata (quem perde recebe o erro do índice único; a tela traduz em regras.js)" "linhas=$n; $err"
else res no "R3 diagnóstico duplicado" "linhas=$n; $err"; fi

echo "== R4. devolução (sem marca, como a tela) × correção da bolsista ao mesmo tempo"
FX=c1410000-0000-4000-8000-0000000000f4
CPF=$($Q -c "select cpf_t(88800000044)")
sess "$B" "insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha) values ('$FX', 'SE', 'Município', 'Comunidade', 'Agricultora Corrida Teste', '$CPF', date '1980-01-01', 'Sítio antigo', false, true, true, true, true, true, true, true, true, true, 'nao_atende', date '2026-10-13')" $W/r4_0
sess "$B" "update public.fichas set endereco = 'Sítio corrigido pela bolsista' where id = '$FX'" $W/r4_1 2 &
sleep 0.5; sess "$T" "update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Endereço incompleto, corrigir' where id = '$FX'" $W/r4_2 & wait
fin=$($Q -c "select situacao || ' / ' || endereco from public.fichas where id = '$FX'")
if echo "$fin" | grep -q "devolvida / Sítio corrigido"; then res no "R4 (BD-5) a devolução, decidida sobre a versão antiga, ficou por cima da correção (nenhum aviso)" "final: $fin; erros: $(cat $W/r4_1 $W/r4_2 | grep ERROR | tr '\n' ' ')"
else res ok "R4 conflito detectado" "final: $fin; $(cat $W/r4_1 $W/r4_2 | grep ERROR | tr '\n' ' ')"; fi

echo "== R5. aprovação dupla do mesmo plano (técnica e geral)"
DI=$($Q -c "select id from public.diagnosticos where ficha_id = '$F36'")
sess "$T" "update public.diagnosticos set situacao = 'aprovado' where id = '$DI'" $W/r5_1 1 & sess "$G" "update public.diagnosticos set situacao = 'aprovado' where id = '$DI'" $W/r5_2 1 & wait
fin=$($Q -c "select situacao || ' por ' || coalesce((select papel from public.equipe where id = aprovado_por), '?') from public.diagnosticos where id = '$DI'")
na=$($Q -c "select count(*) from public.auditoria where registro_id = '$DI' and acao = 'UPDATE'")
res ok "R5 aprovação dupla: estado final coerente" "final: $fin; atualizações na auditoria: $na; erros: $(cat $W/r5_* | grep ERROR | tr '\n' ' ')"

echo "== R6. caça a deadlock: $N sessões x ${SEG}s, gravações cruzadas no mesmo estado (PE); ${MODO:-1} gravação(ões) por transação"
$Q <<'SQL' >/dev/null
create table if not exists carga.conc_erros (estado text, msg text, n int default 1);
create or replace function public.g_conc(quem uuid, cmd text) returns void language plpgsql as $f$
declare d text; c text;
begin
  begin
    perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', 'authenticated', true);
    execute cmd; perform set_config('role', 'none', true);
  exception when others then
    perform set_config('role', 'none', true);
    get stacked diagnostics d = pg_exception_detail, c = pg_exception_context;
    insert into carga.conc_erros(estado, msg) values (sqlstate, case when sqlstate = '40P01' then sqlerrm || ' | ' || d || ' | ' || left(c, 600) else left(sqlerrm, 120) end);
  end;
end $f$;
drop table if exists carga.r6; create table carga.r6 as
  select row_number() over () n, q.* from (
    select p.uid, format($q$update public.visitas set relato = 'Relato da corrida R6 com texto suficiente ' || clock_timestamp() where id = %L$q$, v.id) cmd
      from public.visitas v join carga.pessoas p on p.equipe_id = v.executor_id where v.uf = 'PE' and v.etapa = 'acompanhamento'
    union all select (select uid from carga.pessoas where papel = 'coord_geral'), format($q$update public.diagnosticos set area_m2 = area_m2 + 1 where id = %L$q$, d.id) from public.diagnosticos d where d.uf = 'PE'
    union all select (select uid from carga.pessoas where papel = 'coord_tecnico'), format($q$update public.diagnosticos set situacao = 'aprovado' where id = %L$q$, d.id) from public.diagnosticos d where d.uf = 'PE'
    union all select (select uid from carga.pessoas where papel = 'coord_geral'), format($q$update public.fichas set comunidade = 'Comunidade R6 ' || (random()*9)::int where id = %L$q$, f.id) from public.fichas f where f.uf = 'PE' and f.resultado = 'selecionada'
    union all select (select uid from carga.pessoas where papel = 'coord_tecnico'), format($q$update public.visitas set data_prevista = data_prevista where id = %L$q$, v.id) from public.visitas v where v.uf = 'PE'
    union all select (select uid from carga.pessoas where papel = 'auxiliar_adm'), format($q$update public.equipe set docs_funcern_em = docs_funcern_em where id = %L$q$, p.equipe_id) from carga.pessoas p where p.uf = 'PE'
  ) q;
SQL
TOT=$($Q -c "select count(*) from carga.r6")
cat > $W/r6.sql <<SQL
\set a random(1, $TOT)
\set b random(1, $TOT)
begin;
select public.g_conc(uid, cmd) from carga.r6 where n = :a;
$( [ "${MODO:-1}" = 2 ] && echo "" || echo "-- " )select public.g_conc(uid, cmd) from carga.r6 where n = :b;
commit;
SQL
chmod a+r $W/r6.sql
sudo -u postgres pgbench -n -M simple -c $N -j 2 -T $SEG --max-tries=1 --failures-detailed -f $W/r6.sql -d $DB > $W/r6.out 2>&1
dl=$($Q -c "select count(*) from carga.conc_erros where estado = '40P01'"); tps=$(grep -o 'tps = [0-9.]*' $W/r6.out)
outros=$($Q -c "select string_agg(estado || ' x' || c || ' (' || m || ')', '; ') from (select estado, count(*) c, min(msg) m from carga.conc_erros group by estado) x")
$Q -c "select msg from carga.conc_erros where estado = '40P01'" > $W/r6_deadlocks.txt
lt=$($Q -c "select count(*) from carga.conc_erros where estado = '55P03'")
[ "$dl" = 0 ] && res ok "R6 nenhum deadlock em ${SEG}s com $N sessões ($tps)" "erros de regra/espera vistos: ${outros:-nenhum}" || res no "R6 $dl deadlocks" "$outros"
echo "TOTAL concorrência: $PASS passaram, $FAIL falharam"
