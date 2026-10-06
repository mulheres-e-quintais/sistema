#!/bin/bash
# Mulheres & Quintais — cópia de segurança do banco (Supabase) para o SEU computador, cifrada com senha.
# Uso:  bash ferramentas/backup/copiar.sh [pasta de destino]
# Não grava a senha do banco em lugar nenhum. Leia o LEIA-ME.md desta pasta antes da primeira vez.
set -euo pipefail
DESTINO="${1:-$HOME/Backups-MulheresQuintais}"
ITEM_CHAVEIRO="mq-backup-banco"          # nome do item no Chaveiro do Mac (opcional)
ITEM_SENHA="mq-backup-senha-do-arquivo"

command -v pg_dump >/dev/null || { echo "Falta o pg_dump. No Mac: brew install libpq && brew link --force libpq"; exit 1; }
command -v openssl >/dev/null || { echo "Falta o openssl."; exit 1; }

# 1) endereço do banco: do Chaveiro do Mac, da variável MQ_BANCO, ou digitado agora (não aparece na tela)
BANCO="${MQ_BANCO:-}"
if [ -z "$BANCO" ] && command -v security >/dev/null; then BANCO="$(security find-generic-password -s "$ITEM_CHAVEIRO" -w 2>/dev/null || true)"; fi
if [ -z "$BANCO" ]; then
  echo "Cole o endereço de conexão do banco (painel do Supabase > botão Connect > Session pooler, porta 5432), já com a senha no lugar de [YOUR-PASSWORD]."
  read -r -s -p "Endereço (não aparece na tela): " BANCO; echo
fi
case "$BANCO" in postgres://*|postgresql://*) ;; *) echo "O endereço deve começar com postgresql://"; exit 1;; esac
case "$BANCO" in *:6543/*) echo "Esse é o Transaction pooler (porta 6543). Use o Session pooler (porta 5432)."; exit 1;; *"[YOUR-PASSWORD]"*) echo "Troque [YOUR-PASSWORD] pela senha do banco."; exit 1;; esac

# 2) senha que cifra o arquivo da cópia (dados pessoais e bancários: a cópia nunca fica em claro)
SENHA="${MQ_SENHA_COPIA:-}"
if [ -z "$SENHA" ] && command -v security >/dev/null; then SENHA="$(security find-generic-password -s "$ITEM_SENHA" -w 2>/dev/null || true)"; fi
if [ -z "$SENHA" ]; then
  read -r -s -p "Senha para cifrar a cópia (guarde: sem ela a cópia não abre): " SENHA; echo
  read -r -s -p "Repita a senha: " SENHA2; echo
  [ "$SENHA" = "$SENHA2" ] || { echo "As senhas não conferem."; exit 1; }
fi
[ "${#SENHA}" -ge 12 ] || { echo "Use uma senha de pelo menos 12 caracteres."; exit 1; }

mkdir -p "$DESTINO"; chmod 700 "$DESTINO"
QUANDO="$(date +%Y-%m-%d_%H%M)"
ARQ="$DESTINO/mq_$QUANDO.dump.enc"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT; chmod 700 "$TMP"

echo "Copiando o banco…"
# public = dados do sistema; auth = logins (sem eles a equipe teria de criar senha de novo);
# storage = a LISTA dos arquivos (os arquivos em si são o passo 2 do LEIA-ME).
pg_dump "$BANCO" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --file="$TMP/mq.dump"

# 3) conferência: a cópia abre e tem as tabelas principais
pg_restore --list "$TMP/mq.dump" > "$TMP/lista.txt"
N="$(grep -c 'TABLE DATA public ' "$TMP/lista.txt" || true)"
[ "$N" -ge 30 ] || { echo "A cópia veio com só $N tabelas de dados: algo deu errado. Nada foi guardado."; exit 1; }
for t in equipe fichas visitas diagnosticos auditoria; do
  grep -q "TABLE DATA public $t " "$TMP/lista.txt" || { echo "Faltou a tabela $t na cópia. Nada foi guardado."; exit 1; }
done

# 4) cifra e guarda
MQ_S="$SENHA" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$TMP/mq.dump" -out "$ARQ" -pass env:MQ_S
chmod 600 "$ARQ"
( cd "$DESTINO" && shasum -a 256 "$(basename "$ARQ")" > "$(basename "$ARQ").sha256" 2>/dev/null || sha256sum "$(basename "$ARQ")" > "$(basename "$ARQ").sha256" )

# 5) guarda as 12 cópias mais novas; as mais antigas vão para a pasta "antigas" (este script não apaga nada)
mkdir -p "$DESTINO/antigas"
ls -1t "$DESTINO"/mq_*.dump.enc 2>/dev/null | tail -n +13 | while read -r velho; do mv "$velho" "$velho.sha256" "$DESTINO/antigas/" 2>/dev/null || true; done

echo "Cópia guardada: $ARQ ($(du -h "$ARQ" | cut -f1)), com $N tabelas de dados."
echo "Agora teste se ela abre:  bash \"$(dirname "$0")/testar.sh\" \"$ARQ\""
