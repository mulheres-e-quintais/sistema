#!/bin/bash
# Mulheres & Quintais — TESTE DE RESTAURAÇÃO: abre uma cópia num banco de rascunho no seu computador e conta os registros.
# Uma cópia que nunca foi restaurada não é uma cópia. Não toca no Supabase.
# Uso:  bash ferramentas/backup/testar.sh <arquivo .dump.enc>
set -euo pipefail
ARQ="${1:?Informe o arquivo da cópia (mq_AAAA-MM-DD_HHMM.dump.enc)}"
[ -f "$ARQ" ] || { echo "Não achei $ARQ"; exit 1; }
command -v pg_restore >/dev/null && command -v psql >/dev/null && command -v createdb >/dev/null || { echo "Falta o PostgreSQL neste computador. No Mac: brew install postgresql@17 && brew services start postgresql@17"; exit 1; }
SENHA="${MQ_SENHA_COPIA:-}"
if [ -z "$SENHA" ] && command -v security >/dev/null; then SENHA="$(security find-generic-password -s mq-backup-senha-do-arquivo -w 2>/dev/null || true)"; fi
[ -n "$SENHA" ] || { read -r -s -p "Senha da cópia: " SENHA; echo; }
TMP="$(mktemp -d)"; chmod 700 "$TMP"; BD="mq_teste_restauracao_$$"
trap 'dropdb --if-exists "$BD" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
MQ_S="$SENHA" openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$ARQ" -out "$TMP/mq.dump" -pass env:MQ_S || { echo "Senha errada ou arquivo corrompido."; exit 1; }
# O que o Supabase tem e o seu computador não: os papéis e as extensões (citext, pgcrypto). São criados só para a
# restauração passar. As extensões podem estar no esquema "public" ou no "extensions": tenta um e, se não servir, o outro.
restaurar() {
  dropdb --if-exists "$BD" >/dev/null 2>&1 || true; createdb "$BD"
  psql -q -d "$BD" -c "do \$\$ begin
    perform 1 from pg_roles where rolname='anon';          if not found then create role anon; end if;
    perform 1 from pg_roles where rolname='authenticated'; if not found then create role authenticated; end if;
    perform 1 from pg_roles where rolname='service_role';  if not found then create role service_role; end if;
  end \$\$;" -c "create schema if not exists extensions" \
    -c "create extension if not exists citext with schema $1" -c "create extension if not exists pgcrypto with schema $1" >/dev/null 2>&1 || { echo "Faltam as extensões citext/pgcrypto no PostgreSQL deste computador."; exit 1; }
  pg_restore --no-owner --no-privileges --dbname="$BD" "$TMP/mq.dump" > "$TMP/restauracao.log" 2>&1 || true
  psql -At -d "$BD" -c "select count(*) from public.equipe" >/dev/null 2>&1
}
restaurar public || restaurar extensions || true
ERROS="$(grep -c 'error:' "$TMP/restauracao.log" || true)"
echo "Registros restaurados:"
FALHA=0
for t in equipe fichas visitas diagnosticos avaliacoes solicitacoes_pagamento auditoria; do
  n="$(psql -At -d "$BD" -c "select count(*) from public.$t" 2>/dev/null || echo ERRO)"
  printf "  %-26s %s\n" "$t" "$n"; [ "$n" = "ERRO" ] && FALHA=1
done
n="$(psql -At -d "$BD" -c "select count(*) from auth.users" 2>/dev/null || echo "não conferido neste computador")"; printf "  %-26s %s\n" "logins (auth.users)" "$n"
# (os logins dependem de peças internas do Supabase; se não abrirem aqui, a cópia deles continua no arquivo)
[ "$(psql -At -d "$BD" -c "select count(*) from public.equipe where papel='coord_geral'" 2>/dev/null || echo 0)" -ge 1 ] || FALHA=1
if [ "$FALHA" = 0 ]; then echo "RESTAURAÇÃO OK ($ERROS avisos de objetos próprios do Supabase, esperados). Confira se os números batem com o 00_verificar.sql."
else echo "RESTAURAÇÃO FALHOU. Veja $TMP/restauracao.log (copiado para ./restauracao.log)"; cp "$TMP/restauracao.log" ./restauracao.log; exit 1; fi
