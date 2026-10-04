# Cópia de segurança (backup) do banco

O plano gratuito do Supabase **não guarda cópias**. Sem cópia, um erro, um script de zerar rodado por engano
ou um problema no Supabase apaga tudo sem volta. Esta pasta resolve o banco; os arquivos (fotos, termos,
documentos) são o passo 2.

Quem faz: a coordenação geral, no próprio computador. A senha do banco **não** é enviada a ninguém, nem a
assistentes de IA, e não fica gravada em arquivo.

## Uma vez só: preparar o computador (Mac)

```bash
brew install libpq postgresql@17
brew link --force libpq
brew services start postgresql@17
```

O `pg_dump` precisa ser da mesma versão do banco ou mais novo. Veja a versão em Supabase > Project Settings >
Infrastructure. Se o banco for 17 e o seu `pg_dump --version` for menor, atualize.

## Passo 1: copiar o banco (toda semana e antes de qualquer script de `supabase/perigo/`)

```bash
bash ferramentas/backup/copiar.sh
```

O script pede:

1. **O endereço do banco**: no painel do Supabase, botão **Connect** no alto da página > *Session pooler*
   (porta 5432; funciona em qualquer rede). Não use o *Transaction pooler* (porta 6543).
   Troque `[YOUR-PASSWORD]` pela senha do banco. O que você cola não aparece na tela.
2. **Uma senha para cifrar a cópia**, com 12 caracteres ou mais. A cópia tem CPF, endereço e conta bancária:
   ela nunca fica em claro no disco. **Guarde essa senha num gerenciador de senhas: sem ela a cópia não abre.**

A cópia fica em `~/Backups-MulheresQuintais/mq_AAAA-MM-DD_HHMM.dump.enc`. Ficam as 12 mais novas; as mais antigas
vão para a subpasta `antigas` (o script não apaga nada: apague você quando quiser).

Para não digitar toda vez, guarde os dois no Chaveiro do Mac (ficam cifrados pelo sistema, só para o seu usuário):

```bash
security add-generic-password -a "$USER" -s mq-backup-banco -w
security add-generic-password -a "$USER" -s mq-backup-senha-do-arquivo -w
```

## Passo 1b: testar se a cópia abre (sempre na primeira vez; depois, uma vez por mês)

```bash
bash ferramentas/backup/testar.sh ~/Backups-MulheresQuintais/mq_AAAA-MM-DD_HHMM.dump.enc
```

Ele abre a cópia num banco de rascunho no seu computador, conta os registros e apaga o rascunho. Não toca no
Supabase. Compare os números com o resultado do `supabase/00_verificar.sql`. **Cópia que nunca foi restaurada
não é cópia.**

## Passo 2: os arquivos (fotos, termos, documentos, planilhas)

O banco guarda só a lista dos arquivos; os arquivos ficam no Storage. Para copiá-los:

- Poucos arquivos: Supabase > Storage > cada pasta (`termos`, `campo`, `equipe`, `vitrine`, `documentos`,
  `execucao`) > selecionar tudo > Download.
- Muitos arquivos: Supabase > Project Settings > Storage > S3 Connection > criar uma chave de acesso e usar o
  `rclone` (`rclone copy mq:campo ~/Backups-MulheresQuintais/arquivos/campo`, uma linha por pasta). A chave de
  acesso é um segredo: não vai para o repositório nem para conversa.

Este passo ainda é manual.

## Onde guardar

A cópia já sai cifrada, então pode ir para um segundo lugar além do computador (HD externo, Google Drive
institucional). Uma cópia só, no mesmo computador, não protege de roubo ou defeito do computador.

## Rotina

| Quando | O quê |
|---|---|
| Toda semana, em dia fixo | Passo 1 |
| Uma vez por mês | Passo 1b e passo 2 |
| Antes de rodar qualquer script de `supabase/perigo/` | Passo 1 e passo 1b. O script só apaga se você escrever nele a data da cópia (de hoje ou de ontem) |

## Se precisar restaurar de verdade

Não restaure por cima do projeto em uso sem conversar antes: a restauração troca os dados atuais pelos da cópia.
O caminho seguro é criar um projeto novo no Supabase, rodar os scripts `01` a `52` e restaurar só os dados
(`pg_restore --data-only --schema=public`), conferindo com o `00_verificar.sql` antes de apontar o sistema para ele.

## Limites conhecidos

- Testado num PostgreSQL 16 local com dados de exemplo (cópia, senha errada, restauração e contagem). **Ainda
  não foi rodado contra o Supabase do projeto**: a primeira execução é o teste de verdade.
- No teste de restauração, os logins (`auth.users`) podem aparecer como "não conferido": eles dependem de
  peças internas do Supabase que o seu computador não tem. Os dados do sistema (`public`) são conferidos.
- Planos pagos do Supabase têm cópia diária automática. Isso não foi verificado para este projeto.
