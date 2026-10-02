#!/bin/bash
# Concorrência no banco: 2, 5 e 20 sessões fazem a mesma coisa (ou coisas que se cruzam) ao mesmo tempo.
# Para cada corrida confere: quantas sessões passaram, se o resultado final é coerente e o que quem perdeu leu.
#   A. limites e duplicidades: 40ª ficha do estado, 200º dia de campo, mesma visita em dois pedidos, duas bolsas do mês,
#      pedido complementar × normal, aval duplo, Arlo duplo, tetos de passagens (70.000 e 22.400) e de eventos (6.000 por estado)
#      no limite exato, mesmo número de matrícula, mesmo encontro, mesmo CPF em duas fichas, mesmo e-mail em dois cadastros,
#      mesmo link usado duas vezes, mesma vaga de bolsista, posição na lista de espera, mesma ficha enviada duas vezes,
#      dois diagnósticos do mesmo quintal, dois códigos de acesso, aprovar × editar.
#   B. ler-conferir-gravar (corrigido no 47_auditoria_bd.sql: agora cada par espera um pelo outro): edição × edição do
#      diagnóstico, desligar × agendar visita, desligar × pedir pagamento, Arlo × km, pedido × data da visita, bolsa do
#      professor × encontro, ficha devolvida × diagnóstico, mesmo CPF por dois links de cadastro, limite diário da IA
#      (que também mostra a espera máxima de 5 segundos por trava, com a mensagem em português).
#   C. travas na mesma ordem (sem deadlock): matricular × cancelar matrícula, desligar × cancelar matrícula; e carga mista
#      de 20 sessões por SEG segundos (pgbench), com as contagens conferidas no fim.
#   "FALHA CONHECIDA" ficou só como nome de uma classe de resultado: desde o 47 não há nenhuma (tudo tem de passar).
# Uso: bash concorrencia_bd.sh <banco de teste> [SEG da carga mista; 60 por omissão; 0 = não roda a carga]
# Precisa dos scripts 01–47 instalados num banco de TESTE (NUNCA em produção). Monta o próprio cenário no estado SE
# (ids bdc00000-...), empresta logins de teste às pessoas de função única que já existirem e desfaz tudo no fim. Reexecutável.
DB=${1:-bd_perf}; SEG=${2:-60}
Q="sudo -u postgres psql -X -q -d $DB -tA"; TMP=$(mktemp -d /tmp/bdconc.XXXXXX); chmod 755 "$TMP"
PASS=0; FAIL=0; CONH=0
I='bdc00000-0000-4000-8'   # prefixo dos ids do cenário

limpar() { $Q <<'SQL' >/dev/null 2>&1
set session_replication_role = replica;
do $l$ declare t text; r record; meus uuid[];
begin
  select array_agg(id) into meus from public.equipe where id::text like 'bdc00000%' or email::text like 'bdc.%@teste.invalid';
  delete from public.auditoria where registro_id::text like 'bdc00000%' or registro_id = any (meus) or por = any (meus)
     or registro_id in (select id from public.solicitacoes_pagamento where equipe_id = any (meus))
     or registro_id in (select id from public.fic_encontros where turma_id::text like 'bdc00000%')
     or (tabela = 'pre_cadastros' and depois ->> 'cpf' like '9870000%')
     or coalesce(depois, antes) ->> 'turma_id' like 'bdc00000%' or coalesce(depois, antes) ->> 'ficha_id' like 'bdc00000%' or coalesce(depois, antes) ->> 'visita_id' like 'bdc00000%'
     or coalesce(depois, antes) ->> 'equipe_id' = any (meus::text[]) or coalesce(depois, antes) ->> 'solicitante_id' = any (meus::text[]);
  delete from public.solicitacao_visitas where visita_id::text like 'bdc00000%' or solicitacao_id in (select id from public.solicitacoes_pagamento where equipe_id = any (meus));
  delete from public.solicitacoes_pagamento where equipe_id = any (meus);
  delete from public.fic_presencas where encontro_id in (select id from public.fic_encontros where turma_id::text like 'bdc00000%');
  delete from public.fic_encontros where turma_id::text like 'bdc00000%';
  delete from public.matriculas_fic where turma_id::text like 'bdc00000%' or equipe_id = any (meus);
  delete from public.turmas_fic where id::text like 'bdc00000%';
  delete from public.custos_visita where visita_id::text like 'bdc00000%';
  delete from public.diagnosticos where ficha_id::text like 'bdc00000%';
  delete from public.visitas where ficha_id::text like 'bdc00000%';
  delete from public.fichas where id::text like 'bdc00000%' or cpf like '9871%';
  delete from public.pedidos_apoio where id::text like 'bdc00000%';
  delete from public.pre_cadastros where cpf like '9870000%';
  delete from public.convites where id::text like 'bdc00000%';
  delete from public.acesso_codigos where equipe_id = any (meus);
  delete from public.pedidos_novo_acesso where equipe_id = any (meus);
  delete from public.ia_usos where equipe_id = any (meus);
  delete from public.contas_ja_ligadas where equipe_id = any (meus);
  delete from public.equipe_privado where equipe_id = any (meus);
  if to_regclass('public._bdc_emprestimo') is not null then
    for r in execute 'select * from public._bdc_emprestimo' loop
      update public.equipe set user_id = (r.antes ->> 'user_id')::uuid, matricula_fic_em = (r.antes ->> 'matricula_fic_em')::date, docs_funcern_em = (r.antes ->> 'docs_funcern_em')::date,
        termo_assinado_em = (r.antes ->> 'termo_assinado_em')::date, data_inicio = (r.antes ->> 'data_inicio')::date where id = r.equipe_id;
    end loop;
    execute 'drop table public._bdc_emprestimo';
  end if;
  delete from public.equipe where id = any (meus);
  delete from auth.users where id::text like 'bdc00000%';
  drop table if exists public._bdc_id;
  drop function if exists public._bdc_tenta(text);
end $l$;
SQL
}

cenario() { $Q -v ON_ERROR_STOP=1 <<'SQL'
set session_replication_role = replica;
create table public._bdc_emprestimo (equipe_id uuid primary key, antes jsonb);
create table public._bdc_id (k text primary key, v uuid);
-- chamada que engole o erro de regra (para a carga mista não parar) mas deixa passar deadlock e espera de trava estourada
create function public._bdc_tenta(cmd text) returns text language plpgsql as $f$
begin execute cmd; return 'ok';
exception when deadlock_detected or lock_not_available or query_canceled then raise; when others then return sqlerrm; end $f$;
grant execute on function public._bdc_tenta(text) to authenticated, anon;
do $c$
#variable_conflict use_column
declare hoje date := (now() at time zone 'America/Fortaleza')::date; mes date := hoje - (extract(day from hoje)::int - 1); m1 date := (mes - interval '1 month')::date;
        m2 date := (mes - interval '2 months')::date; m3 date := (mes - interval '3 months')::date; ini date := (mes - interval '4 months')::date;
        r record; e public.equipe; u uuid; n int := 0; j int; falta int; tec uuid; art uuid; ufv text;
        P constant text := 'bdc00000-0000-4000-8';
begin
  for r in select * from (values ('G', 'coord_geral', null), ('T', 'coord_tecnico', null), ('X', 'auxiliar_adm', null), ('ART', 'articulacao', 'SE'), ('APO', 'apoio', 'SE')) v(k, papel, uf) loop
    n := n + 1;
    select * into e from public.equipe q where q.papel = r.papel and q.uf is not distinct from r.uf and q.status = 'ativa' limit 1;
    if e.id is null then
      insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, docs_funcern_em, termo_assinado_em)
      values ((P || '000-00000000000' || n)::uuid, r.papel, r.uf, 'Pessoa Corrida ' || r.k, '9870000000' || n, 'bdc.' || lower(r.k) || '@teste.invalid', ini, true, ini, ini, ini) returning * into e;
    else
      insert into public._bdc_emprestimo values (e.id, jsonb_build_object('user_id', e.user_id, 'matricula_fic_em', e.matricula_fic_em, 'docs_funcern_em', e.docs_funcern_em,
        'termo_assinado_em', e.termo_assinado_em, 'data_inicio', e.data_inicio));
      update public.equipe set matricula_fic_em = coalesce(matricula_fic_em, ini), docs_funcern_em = coalesce(docs_funcern_em, ini), termo_assinado_em = coalesce(termo_assinado_em, ini),
        data_inicio = least(data_inicio, ini) where id = e.id;
    end if;
    if e.user_id is null then
      u := (P || '009-00000000000' || n)::uuid; insert into auth.users (id, email) values (u, e.email::text); update public.equipe set user_id = u where id = e.id; e.user_id := u;
    end if;
    insert into public._bdc_id values (r.k, e.id), ('u' || r.k, e.user_id);
  end loop;
  select v into tec from public._bdc_id where k = 'T'; select v into art from public._bdc_id where k = 'ART';
  -- agentes de SE: AG1..AG5 e AGD1, AGD2 (para desligar). AG4 e AG5 sem matrícula; AG5 sem login. Professores PROF e PROF2.
  for j in 1..9 loop
    insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, matricula_fic_em, matricula_fic_numero, docs_funcern_em, termo_assinado_em)
    values ((P || '000-0000000000' || (10 + j))::uuid, case when j > 7 then 'professor_fic' else 'agente' end, case when j <= 7 then 'SE' end,
            'Pessoa Corrida ' || (array['AG1','AG2','AG3','AG4','AG5','AGD1','AGD2','PROF','PROF2'])[j], '987000000' || (10 + j), 'bdc.p' || j || '@teste.invalid', ini, true,
            case when j in (1, 2, 3, 6, 7) then ini end, case when j in (1, 2, 3, 6, 7) then 'BDC-0' || j end, ini, ini);
    insert into public._bdc_id values ((array['AG1','AG2','AG3','AG4','AG5','AGD1','AGD2','PROF','PROF2'])[j], (P || '000-0000000000' || (10 + j))::uuid);
    if j <> 5 then
      insert into auth.users (id, email) values ((P || '009-0000000000' || (10 + j))::uuid, 'bdc.p' || j || '@teste.invalid');
      update public.equipe set user_id = (P || '009-0000000000' || (10 + j))::uuid where id = (P || '000-0000000000' || (10 + j))::uuid;
      insert into public._bdc_id values ('u' || (array['AG1','AG2','AG3','AG4','AG5','AGD1','AGD2','PROF','PROF2'])[j], (P || '009-0000000000' || (10 + j))::uuid);
    end if;
  end loop;
  -- turmas (PROF e PROF2), matrículas de AG1..AG3 e AGD1 na turma do PROF, um encontro de hoje com presença
  insert into public.turmas_fic (id, nome, inicio, professor_id) values ((P || '008-000000000001')::uuid, 'Turma Corrida 1', ini, (P || '000-000000000018')::uuid),
    ((P || '008-000000000002')::uuid, 'Turma Corrida 2', ini, (P || '000-000000000019')::uuid);
  insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em)
  select (P || '008-00000000001' || j)::uuid, (P || '008-000000000001')::uuid, (P || '000-0000000000' || (10 + j))::uuid, 'BDC-0' || j, ini from unnest(array[1, 2, 3, 6]) j;
  insert into public.fic_encontros (id, turma_id, professor_id, data, carga_horaria, modalidade, conteudo)
    values ((P || '008-000000000021')::uuid, (P || '008-000000000001')::uuid, (P || '000-000000000018')::uuid, hoje - 1, 2, 'ava', 'Encontro de ontem para a carga mista');
  insert into public.fic_presencas (encontro_id, equipe_id, presente) select (P || '008-000000000021')::uuid, (P || '000-0000000000' || (10 + j))::uuid, true from unnest(array[1, 2, 3]) j;
  -- quintais Q1..Q4 (selecionadas aprovadas), LE1 e LE2 (lista de espera) e 30 candidatas (selecionadas aguardando)
  for j in 1..36 loop
    insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco,
        c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao, bolsista_id)
    values ((P || case when j <= 6 then '005' else '001' end || '-0000000000' || lpad((case when j <= 6 then j else j - 6 end)::text, 2, '0'))::uuid, 'SE', 'Município Corrida', 'Comunidade Corrida',
        'Maria Corrida ' || j, '98710000' || lpad(j::text, 3, '0'), '1980-01-01', 'Sítio ' || j, true, true, true, true, true, true, true, true, true, true,
        case when j in (5, 6) then 'lista_espera' else 'selecionada' end, ini, case when j <= 4 then 'aprovada' else 'aguardando' end, art);
  end loop;
  -- o estado fica com 39 selecionadas aprovadas (completa com fichas de enchimento)
  select 39 - count(*) into falta from public.fichas where uf = 'SE' and resultado = 'selecionada' and situacao = 'aprovada';
  insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco,
      c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha, situacao)
  select (P || '002-0000000000' || lpad(j::text, 2, '0'))::uuid, 'SE', 'Município Corrida', 'Comunidade Corrida', 'Maria Enchimento ' || j, '98711000' || lpad(j::text, 3, '0'), '1980-01-01', 'Sítio',
      true, true, true, true, true, true, true, true, true, true, 'selecionada', ini, 'aprovada' from generate_series(1, greatest(falta, 0)) j;
  -- visitas: 1x = AG1 no quintal 1 (6 feitas no mês passado: 11..16); 2x = AG2 no quintal 2 (21..24); 31 = diagnóstico feito do quintal 3 (AG1);
  --          41 = diagnóstico agendado do quintal 4 (AG1); 51 = visita feita de AGD1 (mês passado)
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato)
  select (P || '006-0000000000' || q || k)::uuid, (P || '005-00000000000' || q)::uuid, 'SE', case when k = 1 then 'diagnostico' when k = 2 then 'implantacao' else 'acompanhamento' end,
         (P || '000-00000000001' || q)::uuid, m1 + k, m1 + k, 'realizada', 'Visita feita com a família, tudo conferido.' from generate_series(1, 2) q, generate_series(1, 6) k where q = 1 or k <= 4;
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato) values
    ((P || '006-000000000031')::uuid, (P || '005-000000000003')::uuid, 'SE', 'diagnostico', (P || '000-000000000011')::uuid, m1 + 2, m1 + 2, 'realizada', null),
    ((P || '006-000000000041')::uuid, (P || '005-000000000004')::uuid, 'SE', 'diagnostico', (P || '000-000000000011')::uuid, hoje, null, 'prevista', null),
    ((P || '006-000000000051')::uuid, (P || '005-000000000003')::uuid, 'SE', 'acompanhamento', (P || '000-000000000016')::uuid, m1 + 3, m1 + 3, 'realizada', 'Visita feita com a família, tudo conferido.');
  insert into public.diagnosticos (id, ficha_id, visita_id, uf, executor_id, data_visita, latitude, longitude, area_m2, renda_familiar, agua_seca, lote, dados, situacao)
    values ((P || '006-000000000091')::uuid, (P || '005-000000000003')::uuid, (P || '006-000000000031')::uuid, 'SE', (P || '000-000000000011')::uuid, m1 + 2, -10.5, -37.2, 200, 900, 'sim', 1,
            '{"kit": [{"item": "Tela", "qtd": "5", "valor": 400}]}', 'aguardando');
  insert into public.custos_visita (visita_id, km_ida) values ((P || '006-000000000015')::uuid, 10);
  -- pagamentos de AG2: 71 = solicitada (2 meses atrás); 72 = avalizada (3 meses atrás). De AG1: 73 = avalizada com a visita 15
  insert into public.solicitacoes_pagamento (id, tipo, equipe_id, mes, valor_solicitado, valor_avalizado, situacao, aval_por, aval_em, detalhe) values
    ((P || '007-000000000071')::uuid, 'ajuda_custo', (P || '000-000000000012')::uuid, m2, 100, null, 'solicitada', null, null, '{"total": 100}'),
    ((P || '007-000000000072')::uuid, 'ajuda_custo', (P || '000-000000000012')::uuid, m3, 100, 100, 'avalizada', tec, now(), '{"total": 100}'),
    ((P || '007-000000000073')::uuid, 'ajuda_custo', (P || '000-000000000011')::uuid, m1, 100, 100, 'avalizada', tec, now(), '{"total": 100}');
  insert into public.solicitacao_visitas (visita_id, solicitacao_id) values ((P || '006-000000000015')::uuid, (P || '007-000000000073')::uuid);
  -- links de cadastro (3) e pedidos de passagem/evento: o já autorizado deixa o saldo em R$ 1.000,00; 20 candidatos de R$ 500,00 conferidos em cada teto
  insert into public.convites (id, token, papel, uf, criado_por) select (P || '00a-00000000000' || j)::uuid, 'bdc-token-corrida-' || j, 'agente', 'SE', tec from generate_series(1, 3) j;
  for r in select * from (values (1, 'passagem', 'intercambio', 70000), (2, 'passagem', 'pedagogico', 22400), (3, 'evento', null, 6000)) v(g, tipo, fin, teto) loop
    select r.teto - 1000 - coalesce(sum(valor_autorizado), 0) into falta from public.pedidos_apoio x where x.tipo = r.tipo and x.situacao = 'autorizado'
       and case r.g when 1 then x.dados ->> 'finalidade' is distinct from 'pedagogico' when 2 then x.dados ->> 'finalidade' = 'pedagogico' else x.uf = 'SE' end;
    insert into public.pedidos_apoio (id, tipo, uf, solicitante_id, titulo, data_ref, dados, situacao, conferido_por, conferido_em, decidido_por, decidido_em, valor_autorizado)
    select (P || '004-000000000' || r.g || lpad(j::text, 2, '0'))::uuid, r.tipo, 'SE', art, 'Pedido corrida ' || r.g || '-' || j, hoje + 90,
           jsonb_strip_nulls(jsonb_build_object('valor_estimado', 500, 'finalidade', r.fin)), case when j = 0 then 'autorizado' else 'conferido' end, tec, now(),
           case when j = 0 then (select v from public._bdc_id where k = 'G') end, case when j = 0 then now() end, case when j = 0 then falta end
      from generate_series(case when falta > 0 then 0 else 1 end, 20) j;
  end loop;
  -- estado com a vaga de apoio livre (para a corrida da mesma vaga)
  select x into ufv from unnest(array['AL','PE','BA','PI','SE']) x where not exists (select 1 from public.equipe q where q.papel = 'apoio' and q.uf = x and q.status = 'ativa') limit 1;
  insert into public._bdc_id values ('UFVAGA:' || coalesce(ufv, '-'), null);
end $c$;
SQL
}

id() { $Q -c "select v from public._bdc_id where k = '$1'"; }
dono() { $Q -c "set session_replication_role = replica" -c "$1" 2>&1; }
# uma sessão: $1 login (uuid; vazio = sem login; DONO = dono do banco), $2 comando, $3 saída, $4 segundos segurando a transação, $5 comando antes (como dono, na mesma transação)
sess() {
  local papel="set local role authenticated"; [ -z "$1" ] && papel="set local role anon"; [ "$1" = DONO ] && papel=""
  $Q -v ON_ERROR_STOP=1 <<SQL > "$3" 2>&1
begin;
$5
select set_config('request.jwt.claim.sub', '$( [ "$1" = DONO ] || echo "$1" )', true); $papel;
$2;
select pg_sleep($4);
commit;
SQL
}
# corrida: nome | tipo (ok = tem de passar; conhecida = problema relatado) | quantas sessões devem passar (n ou a-b) | conferência (sql t/f)
#          | trecho que quem perdeu tem de ler (ou vazio) | sessões: pares "login" "comando"
corrida() {
  local nome="$1" tipo="$2" esp="$3" conf="$4" trecho="$5"; shift 5
  local n=0 ok=0 msgs="" f t0=$(date +%s.%N)
  rm -f "$TMP"/s_*.out
  while [ $# -gt 0 ]; do n=$((n+1)); sess "$1" "$2" "$TMP/s_$n.out" 1.2 & shift 2; sleep 0.05; done
  wait
  local dur=$(printf '%.1f' "$(echo "$(date +%s.%N) - $t0" | bc)")
  for f in "$TMP"/s_*.out; do if grep -q 'ERROR' "$f"; then msgs="$msgs$(grep -o 'ERROR:.*' "$f" | head -1 | cut -c8-140)"$'\n'; else ok=$((ok+1)); fi; done
  local c=$($Q -c "select ($conf)" 2>&1) r=PASSOU lo=${esp%-*} hi=${esp#*-}
  [ "$ok" -ge "$lo" ] && [ "$ok" -le "$hi" ] || r=FALHOU
  [ "$c" = t ] || r=FALHOU
  local mm=$(echo -n "$msgs" | sort | uniq -c | sort -rn | head -3 | sed 's/^ *//' | tr '\n' ';')
  if [ -n "$trecho" ] && [ $ok -lt $n ] && ! echo "$msgs" | grep -q "$trecho"; then r=FALHOU; fi
  if echo "$msgs" | grep -q 'deadlock detected'; then mm="DEADLOCK; $mm"; fi
  if [ $r = FALHOU ] && [ "$tipo" = conhecida ]; then r='FALHA CONHECIDA'; CONH=$((CONH+1)); elif [ $r = FALHOU ]; then FAIL=$((FAIL+1)); else PASS=$((PASS+1)); fi
  echo "$r | $nome"
  echo "         $n sessões, $ok passaram (esperado $esp); final coerente: $c; ${dur}s; quem perdeu leu: ${mm:-—}"
}
repete() { local k=$1 u="$2" c="$3" i; for i in $(seq 1 $k); do printf '%s\0%s\0' "$u" "${c//@N@/$i}"; done; }   # k sessões iguais (@N@ = número da sessão)
corridaN() { # nome tipo esperado conferência trecho k login comando(@N@)
  local a=(); while IFS= read -r -d '' x; do a+=("$x"); done < <(repete "$6" "$7" "$8"); corrida "$1 [$6 sessões]" "$2" "$3" "$4" "$5" "${a[@]}"; }

limpar; cenario || { echo "FALHOU | não foi possível montar o cenário no banco $DB"; limpar; exit 1; }
G=$(id uG); T=$(id uT); X=$(id uX); ART=$(id uART); APO=$(id uAPO); AG1=$(id uAG1); AG2=$(id uAG2); AG4=$(id uAG4); AGD1=$(id uAGD1); PROF=$(id uPROF); PROF2=$(id uPROF2)
eART=$(id ART); eAG5=$(id AG5)
UFV=$($Q -c "select split_part(k, ':', 2) from public._bdc_id where k like 'UFVAGA:%'")
HOJE=$($Q -c "select (now() at time zone 'America/Fortaleza')::date"); MES=$($Q -c "select date_trunc('month', date '$HOJE')::date"); M1=$($Q -c "select (date '$MES' - interval '1 month')::date")
F() { echo "${I}001-0000000000$(printf %02d $1)"; }   # ficha candidata n
ap40="(select count(*) from public.fichas where uf = 'SE' and resultado = 'selecionada' and situacao = 'aprovada')"

echo "===== A. limites e duplicidades ====="
# --- 40ª/41ª ficha do estado (o estado está com 39)
corrida "40ª ficha: duas aprovações ao mesmo tempo com 39 aprovadas no estado: só uma entra" ok 1 "$ap40 = 40" "já tem 40 selecionadas" \
  "$T" "update public.fichas set situacao = 'aprovada' where id = '$(F 1)'" "$G" "update public.fichas set situacao = 'aprovada' where id = '$(F 2)'"
for k in 5 20; do
  dono "update public.fichas set situacao = 'aguardando', aprovada_por = null, aprovada_em = null where id::text like '${I}001-%'" >/dev/null
  corridaN "40ª ficha: aprovações simultâneas de fichas diferentes: só uma entra" ok 1 "$ap40 = 40" "já tem 40 selecionadas" $k "$T" "update public.fichas set situacao = 'aprovada' where id = ('${I}001-0000000000' || lpad('@N@', 2, '0'))::uuid"
done
# --- 200º/201º dia de campo (deixa o estado com 199 visitas; as candidatas viram aprovadas, como dono)
dono "update public.fichas set situacao = 'aprovada' where id::text like '${I}001-%';
  insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato)
  select ('${I}003-' || lpad(j::text, 12, '0'))::uuid, '${I}005-000000000001', 'SE', 'acompanhamento', '${I}000-000000000011', date '$M1' + 1, date '$M1' + 1, 'realizada', 'Visita de enchimento para o limite de dias de campo.'
    from generate_series(1, 199 - (select count(*)::int from public.visitas where uf = 'SE' and situacao <> 'cancelada')) j" >/dev/null
vis="(select count(*) from public.visitas where uf = 'SE' and situacao <> 'cancelada')"
VI() { echo "insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values ('${I}00b-0000000000$1', '${I}001-0000000000$1', 'SE', 'diagnostico', '${I}000-000000000011', date '$HOJE' + 3)"; }
corrida "200º dia de campo: duas visitas agendadas ao mesmo tempo com 199 no estado: só uma entra" ok 1 "$vis = 200" "200 dias de campo" "$ART" "$(VI 01)" "$APO" "$(VI 02)"
for k in 5 20; do
  dono "delete from public.visitas where id::text like '${I}00b-%'" >/dev/null
  corridaN "200º dia de campo: visitas agendadas ao mesmo tempo: só uma entra" ok 1 "$vis = 200" "200 dias de campo" $k "$ART" \
    "insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (('${I}00b-0000000000' || lpad('@N@', 2, '0'))::uuid, ('${I}001-0000000000' || lpad('@N@', 2, '0'))::uuid, 'SE', 'diagnostico', '${I}000-000000000011', date '$HOJE' + 3)"
done
dono "delete from public.visitas where id::text like '${I}00b-%' or id::text like '${I}003-%'" >/dev/null
# --- pagamentos
AJ() { echo "select public.solicitar_pagamento('ajuda_custo', '$M1', 100, null, array['${I}006-0000000000$1']::uuid[], '{\"total\": 100}')"; }
sAG1="(select count(*) from public.solicitacoes_pagamento where equipe_id = '${I}000-000000000011' and situacao = 'solicitada')"
corrida "mesma visita em dois pedidos de ajuda de custo ao mesmo tempo: fica em um pedido só" ok 1 "$sAG1 = 1 and (select count(*) from public.solicitacao_visitas where visita_id = '${I}006-000000000011') = 1" "já foi solicitada" "$AG1" "$(AJ 11)" "$AG1" "$(AJ 11)"
corridaN "mesma visita em vários pedidos ao mesmo tempo: fica em um pedido só" ok 1 "$sAG1 = 2 and (select count(*) from public.solicitacao_visitas where visita_id = '${I}006-000000000012') = 1" "já foi solicitada" 20 "$AG1" "$(AJ 12)"
corrida "pedido normal × complementar ao mesmo tempo (visitas diferentes): os dois valem e só um é o complementar" ok 2 \
  "(select count(*) = 2 and count(*) filter (where detalhe ->> 'complementar' = 'true') = 1 from public.solicitacoes_pagamento where equipe_id = '${I}000-000000000012' and mes = '$M1')" "" "$AG2" "$(AJ 21)" "$AG2" "$(AJ 22)"
BO="select public.solicitar_pagamento('bolsa', '$M1', 1400, 'Relatório do mês: preparação do curso, material das aulas e reuniões com a coordenação técnica do projeto.', null, '{\"justificativa_sem_encontro\": \"Mês de preparação do curso, sem encontros com a turma ainda.\"}')"
bol="(select count(*) from public.solicitacoes_pagamento where equipe_id = '${I}000-000000000019' and tipo = 'bolsa' and mes = '$M1')"
corrida "duas bolsas do mesmo mês ao mesmo tempo: fica uma" ok 1 "$bol = 1" "já solicitou este mês" "$PROF2" "$BO" "$PROF2" "$BO"
dono "delete from public.solicitacoes_pagamento where equipe_id = '${I}000-000000000019'" >/dev/null
corridaN "bolsas do mesmo mês ao mesmo tempo: fica uma" ok 1 "$bol = 1" "já solicitou este mês" 20 "$PROF2" "$BO"
dono "delete from public.solicitacoes_pagamento where equipe_id = '${I}000-000000000019'" >/dev/null
AV="select public.avalizar_pagamento('${I}007-000000000071', true, null, 100)"
corrida "aval duplo (coordenação técnica × geral) ao mesmo tempo: um aval só" ok 1 "(select situacao = 'avalizada' from public.solicitacoes_pagamento where id = '${I}007-000000000071')" "não está aguardando aval" "$T" "$AV" "$G" "$AV"
dono "update public.solicitacoes_pagamento set situacao = 'solicitada', valor_avalizado = null, aval_por = null, aval_em = null where id = '${I}007-000000000071'" >/dev/null
corridaN "aval da mesma solicitação em várias sessões: um aval só" ok 1 "(select situacao = 'avalizada' and (select count(*) from public.auditoria a where a.registro_id = s.id and a.depois ->> 'situacao' = 'avalizada' and a.antes ->> 'situacao' = 'solicitada') = 2 from public.solicitacoes_pagamento s where id = '${I}007-000000000071')" "não está aguardando aval" 20 "$T" "$AV"
AR="select public.registrar_no_arlo('${I}007-000000000072', 'ARLO-CORRIDA')"
corrida "lançamento no Arlo duplo (auxiliar × coordenação geral) ao mesmo tempo: um lançamento só" ok 1 "(select situacao = 'lancada' from public.solicitacoes_pagamento where id = '${I}007-000000000072')" "Só solicitação com aval" "$X" "$AR" "$G" "$AR"
# --- tetos no limite exato: saldo de R$ 1.000,00 e pedidos de R$ 500,00: cabem exatamente dois
for g in "1|passagens de intercâmbio (70.000)|tipo = 'passagem' and dados ->> 'finalidade' is distinct from 'pedagogico'|70000" "2|passagens de acompanhamento pedagógico (22.400)|tipo = 'passagem' and dados ->> 'finalidade' = 'pedagogico'|22400" "3|eventos de SE (6.000)|tipo = 'evento' and uf = 'SE'|6000"; do
  IFS='|' read gn gt gw gteto <<< "$g"
  soma="(select coalesce(sum(valor_autorizado), 0) from public.pedidos_apoio where situacao = 'autorizado' and $gw)"
  if [ "$($Q -c "select $soma = $gteto - 1000")" != t ]; then echo "PULOU  | teto de $gt: o banco já tem mais autorizado do que o teste comporta"; continue; fi
  for k in 2 5 20; do
    dono "update public.pedidos_apoio set situacao = 'conferido', valor_autorizado = null, decidido_por = null, decidido_em = null where id::text like '${I}004-000000000${gn}%' and id::text not like '%${gn}00'" >/dev/null
    [ $k = 2 ] && { dono "update public.pedidos_apoio set dados = dados || '{\"valor_estimado\": 600}' where id::text like '${I}004-000000000${gn}%' and id::text not like '%${gn}00'" >/dev/null; e=1; fim="$gteto - 400"; n="sobram R\$ 1.000 e dois pedidos de R\$ 600: só um cabe"; } \
               || { dono "update public.pedidos_apoio set dados = dados || '{\"valor_estimado\": 500}' where id::text like '${I}004-000000000${gn}%' and id::text not like '%${gn}00'" >/dev/null; e=2; fim="$gteto"; n="sobram R\$ 1.000 e pedidos de R\$ 500: cabem exatamente dois (limite exato)"; }
    corridaN "teto de $gt: $n" ok $e "$soma = $fim" "Passa do teto" $k "$G" "select public.mover_pedido_apoio(('${I}004-000000000${gn}' || lpad('@N@', 2, '0'))::uuid, 'autorizar', null, null)"
  done
done
# --- curso FIC
MT() { echo "select public.matricular_fic('${I}008-000000000001', '${I}000-0000000000$1', '$2', '$HOJE')"; }
corrida "mesmo número de matrícula para duas pessoas ao mesmo tempo: fica com uma" ok 1 "(select count(*) = 1 from public.matriculas_fic where numero = 'BDC-900' and cancelada_em is null)" "já é de" "$PROF" "$(MT 14 BDC-900)" "$G" "$(MT 15 BDC-900)"
dono "delete from public.matriculas_fic where equipe_id in ('${I}000-000000000014', '${I}000-000000000015'); update public.equipe set matricula_fic_em = null, matricula_fic_numero = null where id in ('${I}000-000000000014', '${I}000-000000000015')" >/dev/null
corridaN "mesma pessoa matriculada em várias sessões ao mesmo tempo: uma matrícula ativa, e a pessoa com o número dela" ok 20 \
  "(select count(*) = 1 and max(numero) = (select matricula_fic_numero from public.equipe where id = '${I}000-000000000014') from public.matriculas_fic where equipe_id = '${I}000-000000000014' and cancelada_em is null)" "" 20 "$PROF" "$(MT 14 BDC-91@N@)"
EN="select public.registrar_encontro_fic(null, '${I}008-000000000001', '$HOJE', 2, 'online', 'Encontro da corrida: aula enviada pela sessão @N@', '{}')"
corridaN "mesmo encontro (turma, dia, modalidade) registrado ao mesmo tempo: fica um" ok 1 "(select count(*) = 1 from public.fic_encontros where turma_id = '${I}008-000000000001' and data = '$HOJE' and modalidade = 'online' and cancelado_em is null)" "já tem encontro registrado" 20 "$PROF" "$EN"
# --- fichas, cadastros, links
FI() { echo "insert into public.fichas (id, uf, municipio, comunidade, nome, cpf, data_nascimento, endereco, c_agricultora, c_maior18, c_espaco, c_agua, c_disponibilidade, c_sem_kit, c_sem_parentesco, c_casa_unica, autodeclaracao, consent_dados, resultado, data_ficha)
  values ('${I}00c-0000000000$1', 'SE', 'Município Corrida', 'Comunidade Corrida', 'Maria Mesmo CPF', '$2', '1980-01-01', 'Sítio', true, true, true, true, true, true, true, true, true, true, 'selecionada', '$HOJE')"; }
corrida "mesmo CPF em duas fichas ao mesmo tempo (articulação × apoio): fica uma" ok 1 "(select count(*) = 1 from public.fichas where cpf = '98719999097')" "" "$ART" "$(FI 01 98719999097)" "$APO" "$(FI 02 98719999097)"
corrida "mesma ficha enviada duas vezes ao mesmo tempo (fila do celular): fica uma" ok 1 "(select count(*) = 1 from public.fichas where cpf = '98719999178')" "" "$ART" "$(FI 03 98719999178)" "$ART" "$(FI 03 98719999178)"
EQ() { echo "insert into public.equipe (papel, uf, nome, cpf, email, telefone, data_inicio, consentimento_lgpd) values ('$1', '$2', 'Pessoa Corrida Nova $3', '$3', '$4', '(79) 99999-0000', '$HOJE', true)"; }
corrida "mesmo e-mail em dois cadastros da equipe ao mesmo tempo: fica um" ok 1 "(select count(*) = 1 from public.equipe where email = 'bdc.mesmo@teste.invalid')" "" "$T" "$(EQ agente SE 98700009164 bdc.mesmo@teste.invalid)" "$T" "$(EQ agente SE 98700009245 bdc.mesmo@teste.invalid)"
if [ "$UFV" != "-" ]; then
  corrida "mesma vaga de bolsista (apoio de $UFV) preenchida duas vezes ao mesmo tempo: fica uma" ok 1 "(select count(*) = 1 from public.equipe where papel = 'apoio' and uf = '$UFV' and status = 'ativa')" "" "$T" "$(EQ apoio $UFV 98700009326 bdc.vaga1@teste.invalid)" "$G" "$(EQ apoio $UFV 98700009407 bdc.vaga2@teste.invalid)"
else echo "PULOU  | mesma vaga de bolsista: não há estado com a vaga de apoio livre neste banco"; fi
PC() { echo "select public.enviar_pre_cadastro('bdc-token-corrida-$1', '{\"nome\": \"Pessoa Pelo Link $2\", \"cpf\": \"$2\", \"email\": \"$3\", \"consentimento_lgpd\": true, \"data_nascimento\": \"1990-01-01\"}')"; }
corrida "mesmo link de cadastro usado por duas pessoas ao mesmo tempo: vale para uma" ok 1 "(select count(*) = 1 from public.pre_cadastros where convite_id = '${I}00a-000000000001')" "Este link não vale mais" "" "$(PC 1 98700008192 bdc.link1@teste.invalid)" "" "$(PC 1 98700008273 bdc.link2@teste.invalid)"
ES() { echo "update public.fichas set posicao_espera = 7 where id = '${I}005-00000000000$1'"; }
corrida "mesma posição na lista de espera para duas mulheres ao mesmo tempo: fica com uma" ok 1 "(select count(*) = 1 from public.fichas where uf = 'SE' and resultado = 'lista_espera' and posicao_espera = 7)" "Já há outra mulher na posição" "$ART" "$(ES 5)" "$APO" "$(ES 6)"
DG() { echo "insert into public.diagnosticos (id, ficha_id, visita_id, uf, data_visita, latitude, longitude, area_m2, agua_seca, lote, dados) values ('${I}006-0000000000$1', '${I}005-000000000004', '${I}006-000000000041', 'SE', '$HOJE', -10.5, -37.2, 200, 'sim', 1, '{\"kit\": []}')"; }
corrida "dois diagnósticos do mesmo quintal enviados ao mesmo tempo: fica um, e a visita fica feita" ok 1 "(select count(*) = 1 from public.diagnosticos where ficha_id = '${I}005-000000000004') and (select situacao = 'realizada' from public.visitas where id = '${I}006-000000000041')" "" "$AG1" "$(DG 92)" "$AG1" "$(DG 93)"
dono "delete from public.diagnosticos where ficha_id = '${I}005-000000000004'; update public.visitas set situacao = 'prevista', data_realizada = null where id = '${I}006-000000000041'" >/dev/null
CD="select public.gerar_codigo_acesso('$eAG5')"
corrida "dois códigos de acesso para a mesma pessoa ao mesmo tempo: os dois recebem um código, mas só o último vale (sem aviso)" ok 2 "(select count(*) = 1 from public.acesso_codigos where equipe_id = '$eAG5')" "" "$T" "$CD" "$G" "$CD"
# --- aprovar × editar o diagnóstico (a marca atualizado_em protege a APROVAÇÃO)
MARCA=$($Q -c "select atualizado_em from public.diagnosticos where id = '${I}006-000000000091'")
ED() { echo "update public.diagnosticos set area_m2 = $1, renda_familiar = $2 where id = '${I}006-000000000091'"; }
corrida "editar × aprovar ao mesmo tempo (edição primeiro): a aprovação do que foi lido antes é recusada" ok 1 "(select situacao = 'aguardando' and area_m2 = 321 from public.diagnosticos where id = '${I}006-000000000091')" "foi alterado enquanto você lia" \
  "$AG1" "$(ED 321 900)" "$T" "update public.diagnosticos set situacao = 'aprovado', atualizado_em = '$MARCA' where id = '${I}006-000000000091'"
MARCA=$($Q -c "select atualizado_em from public.diagnosticos where id = '${I}006-000000000091'")
corrida "aprovar × editar ao mesmo tempo (aprovação primeiro): a edição do que já foi aprovado é recusada" ok 1 "(select situacao = 'aprovado' and area_m2 = 321 from public.diagnosticos where id = '${I}006-000000000091')" "já aprovado" \
  "$T" "update public.diagnosticos set situacao = 'aprovado', atualizado_em = '$MARCA' where id = '${I}006-000000000091'" "$AG1" "$(ED 555 900)"
dono "update public.diagnosticos set situacao = 'aguardando', aprovado_por = null, aprovado_em = null, area_m2 = 200, renda_familiar = 900 where id = '${I}006-000000000091'" >/dev/null

echo "===== B. ler-conferir-gravar: cada par espera um pelo outro (47_auditoria_bd.sql) ====="
MARCA=$($Q -c "select atualizado_em from public.diagnosticos where id = '${I}006-000000000091'")
# cada pessoa leu o diagnóstico (área 200, renda 900) e manda o registro inteiro com o seu campo mudado, junto com a marca do que leu
corrida "duas pessoas editando o mesmo diagnóstico: a segunda é avisada de que o registro mudou e não grava por cima" ok 1 \
  "(select area_m2 = 444 and renda_familiar = 900 from public.diagnosticos where id = '${I}006-000000000091')" "alterado por outra pessoa enquanto você editava" \
  "$AG1" "update public.diagnosticos set area_m2 = 444, renda_familiar = 900, atualizado_em = '$MARCA' where id = '${I}006-000000000091'" \
  "$ART" "update public.diagnosticos set area_m2 = 200, renda_familiar = 1500, atualizado_em = '$MARCA' where id = '${I}006-000000000091'"
corrida "desligar × agendar visita para a mesma pessoa ao mesmo tempo: não sobra pessoa desligada com visita agendada" ok 1 \
  "(select not exists (select 1 from public.visitas v join public.equipe e on e.id = v.executor_id where e.id = '${I}000-000000000017' and e.status = 'desligada' and v.situacao = 'prevista'))" "" \
  "$T" "update public.equipe set status = 'desligada', data_fim = '$HOJE', motivo_desligamento = 'Saiu do projeto' where id = '${I}000-000000000017'" \
  "$ART" "insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values ('${I}00b-000000000030', '$(F 30)', 'SE', 'diagnostico', '${I}000-000000000017', date '$HOJE' + 3)"
corrida "desligar × a própria pessoa pedir pagamento ao mesmo tempo: não sobra pedido criado por quem já está desligada" ok 1 \
  "(select not exists (select 1 from public.solicitacoes_pagamento s join public.equipe e on e.id = s.equipe_id where e.id = '${I}000-000000000016' and e.status = 'desligada' and s.situacao = 'solicitada'))" "" \
  "$T" "update public.equipe set status = 'desligada', data_fim = '$HOJE', motivo_desligamento = 'Saiu do projeto' where id = '${I}000-000000000016'" "$AGD1" "$(AJ 51)"
corrida "lançar no Arlo × mudar o km da visita ao mesmo tempo: pedido lançado não fica com o km alterado" ok 1 \
  "(select not (s.situacao = 'lancada' and c.km_ida = 99) from public.solicitacoes_pagamento s, public.custos_visita c where s.id = '${I}007-000000000073' and c.visita_id = '${I}006-000000000015')" "já está num pedido lançado" \
  "$X" "select public.registrar_no_arlo('${I}007-000000000073', 'ARLO-KM')" "$T" "update public.custos_visita set km_ida = 99 where visita_id = '${I}006-000000000015'"
corrida "pedir pagamento × a coordenação mudar a data da visita para outro mês ao mesmo tempo: o pedido não fica com visita de outro mês" ok 1 \
  "(select not exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id join public.visitas v on v.id = sv.visita_id where v.id = '${I}006-000000000016' and date_trunc('month', v.data_realizada)::date <> s.mes))" "já está numa solicitação" \
  "$AG1" "$(AJ 16)" "$T" "update public.visitas set data_realizada = '$HOJE' where id = '${I}006-000000000016'"
BM="select public.solicitar_pagamento('bolsa', '$MES', 1400, 'Relatório do mês: preparação do curso, material das aulas e reuniões com a coordenação técnica do projeto.', null, '{\"justificativa_sem_encontro\": \"Mês de preparação do curso, sem encontros com a turma ainda.\"}')"
corrida "bolsa do professor × encontro registrado no mesmo mês ao mesmo tempo: não sobra encontro fora do pedido da bolsa" ok 1 \
  "(select not exists (select 1 from public.solicitacoes_pagamento s join public.fic_encontros e on e.professor_id = s.equipe_id and date_trunc('month', e.data)::date = s.mes and e.cancelado_em is null where s.equipe_id = '${I}000-000000000019' and s.tipo = 'bolsa' and s.situacao = 'solicitada' and jsonb_array_length(s.detalhe -> 'fic_encontros') = 0))" "bolsa deste mês" \
  "$PROF2" "$BM" "$G" "select public.registrar_encontro_fic(null, '${I}008-000000000002', '$HOJE', 2, 'presencial', 'Encontro registrado durante o pedido da bolsa', '{}')"
corrida "devolver a ficha × registrar o diagnóstico ao mesmo tempo: não sobra ficha devolvida com diagnóstico" ok 1 \
  "(select not exists (select 1 from public.fichas f join public.diagnosticos d on d.ficha_id = f.id where f.id = '${I}005-000000000004' and f.situacao = 'devolvida'))" "já está em andamento" \
  "$AG1" "$(DG 92)" "$T" "update public.fichas set situacao = 'devolvida', obs_coordenacao = 'Rever o endereço da ficha' where id = '${I}005-000000000004'"
corrida "mesmo CPF enviado por dois links de cadastro diferentes ao mesmo tempo: fica um cadastro para conferir" ok 1 "(select count(*) = 1 from public.pre_cadastros where cpf = '98700008354' and situacao = 'aguardando')" "já foram enviados" \
  "" "$(PC 2 98700008354 bdc.link3@teste.invalid)" "" "$(PC 3 98700008354 bdc.link3@teste.invalid)"
dono "insert into public.ia_usos (equipe_id) select '${I}000-000000000011' from generate_series(1, 59)" >/dev/null
# cada sessão segura a transação por 1,2 s (é o teste que segura; na tela a chamada dura milésimos): as primeiras entram na fila da trava por pessoa, uma por vez;
# quem espera mais de 5 s lê a mensagem de sistema ocupado. O que importa: nunca passa de 60.
corridaN "limite diário da IA (60 usos) com 59 já feitos: entra só mais um, mesmo com 20 pedidos ao mesmo tempo; quem espera mais de 5 s pela trava lê o aviso em português" ok 1-20 "(select count(*) = 60 from public.ia_usos where equipe_id = '${I}000-000000000011')" "O sistema está ocupado com outra gravação. Tente de novo em instantes." 20 "$AG1" "select public.registrar_uso_ia()"

echo "===== C. travas na mesma ordem (sem deadlock) ====="
# Até o 46: matricular e desligar travavam a pessoa e depois a matrícula; cancelar matrícula, a matrícula e depois a pessoa (deadlock).
# Desde o 47 os três travam a PESSOA primeiro. A sessão do cancelamento segura a PRIMEIRA trava dela (agora a pessoa) 1 s antes de
# seguir: é a ordem de quem chegou um instante antes. (A prova sem ordem combinada é a carga mista, logo abaixo: m09 × m10.)
dono "delete from public.matriculas_fic where equipe_id = '${I}000-000000000014'; insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em) values ('${I}008-000000000014', '${I}008-000000000001', '${I}000-000000000014', 'BDC-014', '$HOJE');
  update public.equipe set matricula_fic_em = '$HOJE', matricula_fic_numero = 'BDC-014' where id = '${I}000-000000000014'" >/dev/null
cruzado() { # nome, pré-trava (dono), login A, comando A, login B, comando B, conferência
  rm -f "$TMP"/d_*.out; local t0=$(date +%s.%N)
  sess "$3" "$4" "$TMP/d_a.out" 0 "$2; select pg_sleep(1);" & sleep 0.4; sess "$5" "$6" "$TMP/d_b.out" 0 & wait
  local dur=$(printf '%.1f' "$(echo "$(date +%s.%N) - $t0" | bc)") dl=$(cat "$TMP"/d_*.out | grep -c 'deadlock detected') er=$(cat "$TMP"/d_*.out | grep -o 'ERROR:.*' | cut -c8-110 | tr '\n' ';') c=$($Q -c "select ($7)")
  local r=PASSOU; [ "$dl" = 0 ] && [ "$c" = t ] || r='FALHOU'
  [ "$r" = PASSOU ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
  echo "$r | $1"; echo "         deadlocks: $dl; final coerente: $c; ${dur}s; erros: ${er:-nenhum}"
}
# coerente = o número de matrícula no cadastro da pessoa é o da matrícula ATIVA dela (ou nenhum, se não há matrícula ativa); nunca duas ativas
coer="(select e.status = 'desligada' or e.matricula_fic_numero is not distinct from (select m.numero from public.matriculas_fic m where m.equipe_id = e.id and m.cancelada_em is null) from public.equipe e where e.id = '${I}000-000000000014')"
cruzado "matricular de novo × cancelar a matrícula da mesma pessoa, cruzados: nenhum dos dois cai em deadlock" "select 1 from public.equipe where id = '${I}000-000000000014' for update" \
  "$PROF" "select public.cancelar_matricula_fic('${I}008-000000000014', 'Matrícula lançada na turma errada')" "$G" "$(MT 14 BDC-777)" "$coer"
dono "delete from public.matriculas_fic where equipe_id = '${I}000-000000000014' and id <> '${I}008-000000000014'; update public.matriculas_fic set cancelada_em = null, motivo_cancelamento = null, numero = 'BDC-014' where id = '${I}008-000000000014'; update public.equipe set matricula_fic_em = '$HOJE', matricula_fic_numero = 'BDC-014' where id = '${I}000-000000000014'" >/dev/null
cruzado "desligar a pessoa × cancelar a matrícula dela, cruzados: nenhum dos dois cai em deadlock" "select 1 from public.equipe where id = '${I}000-000000000014' for update" \
  "$PROF" "select public.cancelar_matricula_fic('${I}008-000000000014', 'Matrícula lançada na turma errada')" \
  "$T" "update public.equipe set status = 'desligada', data_fim = '$HOJE', motivo_desligamento = 'Saiu do projeto' where id = '${I}000-000000000014'" "$coer"

# ----- carga mista: 20 sessões por SEG segundos, com operações que se cruzam; confere deadlocks e as contagens no fim -----
if [ "$SEG" -gt 0 ]; then
  dono "update public.equipe set status = 'ativa', data_fim = null, motivo_desligamento = null, user_id = '${I}009-000000000014' where id = '${I}000-000000000014';
    update public.matriculas_fic set cancelada_em = null, motivo_cancelamento = null where id = '${I}008-000000000014'; update public.equipe set matricula_fic_em = '$HOJE', matricula_fic_numero = (select numero from public.matriculas_fic where id = '${I}008-000000000014') where id = '${I}000-000000000014';
    delete from public.visitas where id::text like '${I}00b-%'; delete from public.diagnosticos where ficha_id = '${I}005-000000000004'; update public.visitas set situacao = 'prevista', data_realizada = null where id = '${I}006-000000000041';
    update public.fichas set situacao = 'aguardando', aprovada_por = null, aprovada_em = null where id::text like '${I}001-%'; update public.fichas set situacao = 'aprovada' where id = '${I}005-000000000004';
    update public.diagnosticos set situacao = 'aguardando' where id = '${I}006-000000000091';
    insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista, data_realizada, situacao, relato)
    select ('${I}003-' || lpad(j::text, 12, '0'))::uuid, '${I}005-000000000001', 'SE', 'acompanhamento', '${I}000-000000000011', date '$M1' + 1, date '$M1' + 1, 'realizada', 'Visita de enchimento para o limite de dias de campo.'
      from generate_series(1, 190 - (select count(*)::int from public.visitas where uf = 'SE' and situacao <> 'cancelada')) j" >/dev/null
  mk() { # arquivo, login, comando (usa :n de 1 a 30)
    cat > "$TMP/$1.sql" <<SQL
\\set n random(1, 30)
begin;
select set_config('request.jwt.claim.sub', '$2', true);
set local role authenticated;
select public._bdc_tenta(\$cmd\$$3\$cmd\$);
commit;
SQL
  }
  CAND="('${I}001-0000000000' || lpad((:n)::text, 2, '0'))::uuid"
  mk m01 "$T" "update public.fichas set situacao = case when situacao = 'aprovada' then 'devolvida' else 'aprovada' end, obs_coordenacao = 'Rever o endereço' where id = $CAND"
  mk m02 "$G" "update public.fichas set situacao = case when situacao = 'aprovada' then 'devolvida' else 'aprovada' end, obs_coordenacao = 'Rever o endereço' where id = $CAND"
  mk m03 "$ART" "insert into public.visitas (id, ficha_id, uf, etapa, executor_id, data_prevista) values (gen_random_uuid(), $CAND, 'SE', 'diagnostico', '${I}000-000000000011', date '$HOJE' + 3)"
  mk m04 "$APO" "update public.visitas set situacao = 'cancelada' where ficha_id = $CAND and situacao = 'prevista'"
  mk m05 "$AG1" "update public.diagnosticos set area_m2 = 100 + :n where id = '${I}006-000000000091'"
  mk m06 "$T" "update public.diagnosticos set situacao = case when situacao = 'aprovado' then 'devolvido' else 'aprovado' end, obs_coordenacao = 'Rever o kit do plano' where id = '${I}006-000000000091'"
  mk m07 "$AG1" "select public.solicitar_pagamento('ajuda_custo', '$M1', 100, null, array[('${I}006-00000000001' || (1 + :n % 4))::uuid], '{\"total\": 100}')"
  mk m08 "$T" "select public.avalizar_pagamento(id, false, 'Corrija o km da visita', null) from public.solicitacoes_pagamento where equipe_id = '${I}000-000000000011' and situacao = 'solicitada' and mes = '$M1' limit 1"
  mk m09 "$PROF" "select public.matricular_fic('${I}008-000000000001', '${I}000-000000000014', 'BDC-M' || :n, '$HOJE')"
  mk m10 "$G" "select public.cancelar_matricula_fic(id, 'Matrícula lançada na turma errada') from public.matriculas_fic where equipe_id = '${I}000-000000000014' and cancelada_em is null"
  mk m11 "$PROF" "select public.registrar_encontro_fic('${I}008-000000000021', '${I}008-000000000001', date '$HOJE' - 1, 2 + :n % 3, 'ava', 'Encontro de ontem para a carga mista', array['${I}000-000000000011', '${I}000-000000000012']::uuid[])"
  mk m12 "$AG1" "select public.confirmar_presenca_fic('${I}008-000000000021')"
  ARGS=""; for f in "$TMP"/m*.sql; do ARGS="$ARGS -f $f"; done
  sudo -u postgres pgbench -n -c 20 -j 4 -T "$SEG" --failures-detailed --max-tries=1 $ARGS "$DB" > "$TMP/pgbench.out" 2>&1
  TPS=$(grep -o 'tps = [0-9.]*' "$TMP/pgbench.out" | head -1); NTX=$(grep 'number of transactions actually processed' "$TMP/pgbench.out" | grep -o '[0-9]*' | head -1)
  DL=$(grep 'number of deadlock failures' "$TMP/pgbench.out" | head -1 | grep -o ': [0-9]*' | tr -d ': '); LAT=$(grep 'latency average' "$TMP/pgbench.out" | head -1 | grep -o '[0-9.]* ms')
  PIOR=$(awk '/^SQL script/{n=$4} /^ - latency average/{if ($5+0 > m) {m=$5+0; q=n}} END{sub(/.*\//, "", q); sub(/\.sql.*/, "", q); printf "%s, média de %.0f ms", q, m}' "$TMP/pgbench.out")
  QUAL=$(awk '/^SQL script/{n=$4; sub(/.*\//, "", n); sub(/\.sql.*/, "", n)} /^ - number of deadlock failures/{if ($6+0 > 0) printf "%s=%s ", n, $6}' "$TMP/pgbench.out")
  AB=$(grep -c 'aborted' "$TMP/pgbench.out")
  INV=$($Q -c "select $ap40 <= 40 and $vis <= 200
     and not exists (select 1 from public.matriculas_fic where cancelada_em is null group by equipe_id having count(*) > 1)
     and (select coalesce((select numero from public.matriculas_fic m where m.equipe_id = e.id and m.cancelada_em is null), '-') = coalesce(e.matricula_fic_numero, '-') from public.equipe e where e.id = '${I}000-000000000014')
     and not exists (select 1 from public.diagnosticos d join public.visitas v on v.id = d.visita_id where d.id::text like '${I}%' and v.situacao <> 'realizada')
     and not exists (select 1 from public.solicitacao_visitas sv join public.solicitacoes_pagamento s on s.id = sv.solicitacao_id where s.equipe_id = '${I}000-000000000011' and s.situacao = 'devolvida')
     and not exists (select 1 from public.visitas where ficha_id::text like '${I}001-%' and situacao <> 'cancelada' group by ficha_id, etapa having count(*) > 1)")
  r=PASSOU; [ "$INV" = t ] && [ "$AB" = 0 ] && [ -n "$NTX" ] || r=FALHOU
  [ "${DL:-0}" = 0 ] || r=FALHOU   # desde o 47, deadlock na carga mista é falha
  if [ $r = PASSOU ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  echo "$r | carga mista: 20 sessões por ${SEG}s com 12 operações que se cruzam: contagens e vínculos coerentes no fim, sem deadlock"
  echo "         transações: ${NTX:-?} ($TPS; latência média ${LAT:-?}); deadlocks: ${DL:-?} ${QUAL:+(por operação: $QUAL)}(operação mais lenta: $PIOR); sessões abortadas: $AB; contagens e vínculos coerentes: $INV"
  [ $r = FALHOU ] && tail -15 "$TMP/pgbench.out"
fi

limpar; rm -rf "$TMP"
TOT=$((PASS+FAIL))
if [ $FAIL -eq 0 ]; then echo "PASSOU | concorrência do banco: $PASS de $TOT; falhas conhecidas: $CONH"
else echo "FALHOU | concorrência do banco: $FAIL caso(s) de $TOT; falhas conhecidas: $CONH"; fi
