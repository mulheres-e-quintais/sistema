#!/bin/bash
# 52_acompanhamento.sql sob concorrência: e-mail repetido, mesmo código em várias tentativas, limite de 20 ativos e leituras simultâneas.
# Uso: bash concorrencia_acompanhamento.sh   (banco de teste "ts", com a suíte já rodada e o 52 instalado). NUNCA em produção.
P="sudo -u postgres psql -d ts -Atq"
CG=$($P -c "select user_id from public.equipe where papel='coord_geral' and status='ativa' and user_id is not null limit 1")
como() { $P -c "select set_config('request.jwt.claim.sub','$CG',false); set role authenticated; $1" 2>&1; }
# 1. o mesmo e-mail cadastrado 4 vezes ao mesmo tempo: só um entra
for r in 1 2 3; do E="corrida$r$RANDOM@mda.exemplo"; for i in 1 2 3 4; do ( como "select public.salvar_observador(null, 'Pessoa Corrida $i', '$E', 'mda', null, true);" > /tmp/co_o$i ) & done; wait
  echo "e-mail simultâneo, rodada $r: gravados=$($P -c "select count(*) from public.observadores where email='$E'") recusas=$(cat /tmp/co_o1 /tmp/co_o2 /tmp/co_o3 /tmp/co_o4 | grep -c -i error)"; done
# 2. o mesmo código usado por 5 tentativas de criar senha ao mesmo tempo: só uma conta nasce
E="unico$RANDOM@mpa.exemplo"; ID=$(como "select public.salvar_observador(null, 'Pessoa Unica Teste', '$E', 'mpa', null, true);" | tail -1); COD=$(como "select public.gerar_codigo_observador('$ID');" | tail -1)
for i in 1 2 3 4 5; do ( $P -c "insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), '$E', jsonb_build_object('codigo', '$COD'));" > /tmp/co_u$i 2>&1 ) & done; wait
echo "mesmo código em 5 tentativas simultâneas: contas=$($P -c "select count(*) from auth.users where email='$E'") ligada=$($P -c "select (user_id is not null and codigo_hash is null) from public.observadores where id='$ID'")"
# 3. limite de 20 ativos sob corrida: 30 cadastros simultâneos
A0=$($P -c "select count(*) from public.observadores where status='ativo'")
for i in $(seq 1 30); do ( como "select public.salvar_observador(null, 'Pessoa Limite $i', 'limite$i$RANDOM@mda.exemplo', 'mda', null, true);" >/dev/null ) & done; wait
echo "limite de 20 ativos com 30 cadastros simultâneos: antes=$A0 depois=$($P -c "select count(*) from public.observadores where status='ativo'")"
# 4. 40 leituras dos números ao mesmo tempo por quem acompanha
UO=$($P -c "select user_id from public.observadores where id='$ID'")
T0=$(date +%s%N); for i in $(seq 1 40); do ( $P -c "select set_config('request.jwt.claim.sub','$UO',false); set role authenticated; select length(public.acompanhamento_dados()::text) > 100;" 2>&1 | tail -1 > /tmp/co_l$i ) & done; wait
echo "40 leituras simultâneas: certas=$(cat /tmp/co_l* | grep -c '^t$') em $(( ($(date +%s%N) - T0) / 1000000 )) ms"
