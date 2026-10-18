# Testes do banco — como rodar cada grupo

Banco **local** de teste (Postgres com o simulador do Supabase em `stub_supabase.sql`). Nunca rode estes arquivos no Supabase de produção.

```bash
sudo service postgresql start
bash supabase/tests/montar_banco_teste.sh ts          # banco com todas as etapas (sem dados de exemplo)
```

## 1. Suíte principal (a que vale para enviar)

```bash
bash supabase/tests/rodar_suite.sh ts "auditoria_bd estrutura_bd correcoes_auditoria"
```

Mostra três números: PASSOU, FALHOU e ERROR. O esperado é FALHOU = 0 e ERROR = 0. A lista de arquivos fica dentro do `rodar_suite.sh`.

## 2. Arquivos que rodam na MESMA sessão do `test_cadastro_equipe.sql`

Usam as variáveis e funções que ele cria (`:G`, `:T`, `t()`, `f()`, `res`). Rode num banco limpo, de dentro de `supabase/`:

```bash
cd supabase && sudo -u postgres psql -X -q -d <banco limpo> -f tests/test_cadastro_equipe.sql -f tests/test_<nome>.sql
```

`auditoria_1410_seguranca`, `documentos`, `fic_coordenacao`, `historico`, `kit_itens`, `relatos`, `termo_pela_pessoa`, `vitrine_municipios`,
`limite_professores` (este espera que o 50 ainda não tenha posto os gatilhos: veja o cabeçalho).

## 3. Autocontidos

- `test_auditoria_1410_indicadores.sql` — num banco limpo, sem a suíte. A comparação servidor × tela:
  `AUD_DB=<banco limpo> node --test testes/unit/auditoria_1410_regras.test.js`
- `atomicidade_bd.sql`, `desempenho_volume.sql`, `desempenho_escala.sql` (este, num banco limpo) — veja o cabeçalho de cada um.
- Concorrência (numa cópia do banco com a suíte rodada): `concorrencia.sh`, `concorrencia_bd.sh`, `concorrencia_regras.sh`, `concorrencia_acompanhamento.sh` — `bash <arquivo> <banco>`.
- `test_auditoria_1410_integridade.sql` — precisa da massa de `carga_1410/montar.sh` (veja o cabeçalho).

## 4. Testes por etapa (histórico)

`test_fichas`, `test_campo`, `test_correcoes`, `test_avaliacao`, `test_pagamentos`, `test_regras`, `test_vitrine`, `test_fic` foram escritos
para um banco montado **só até a etapa deles** (o cabeçalho diz quais). Num banco com todas as etapas eles param no primeiro cadastro,
porque as etapas seguintes passaram a exigir CPF válido, professor habilitado etc. As mesmas áreas (fichas, campo, pagamentos, vitrine,
curso FIC) têm testes na suíte principal, mas ninguém conferiu caso a caso se cada verificação antiga tem uma equivalente.
Ficam aqui como histórico; adaptar um deles = trocar o cadastro do começo pelo `test_cadastro_equipe.sql`.
