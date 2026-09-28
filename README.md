# Mulheres & Quintais: sistema do projeto

Sistema web do projeto **Quintais Produtivos para Mulheres Rurais** (TED 7AAEKA, processo SUAP 23136.001052.2026-19).

**Etapa 1 (esta versão):** cadastro da equipe.
- A **coordenação geral** cadastra a **coordenação técnica** (indicada pelo MPA).
- A **coordenação técnica** cadastra as **10 bolsistas**: 1 de articulação estadual e 1 de apoio estadual em cada estado (AL, BA, PE, PI, SE), com o plano de trabalho individual de cada uma.
- As duas coordenações registram a **habilitação para a bolsa**, seguindo o Guia das bolsistas: matrícula no FIC, documentos na FUNCERN e termo de compromisso.
- Desligamento com data e motivo, substituta ligada a quem saiu e histórico de todas as alterações.

**Etapa 2 (esta versão):** ficha de indicação e seleção + termo de consentimento (modelos 1 e 2, v2).
- A bolsista preenche no celular, com ou sem internet. Sem sinal, a ficha e as fotos dos papéis assinados ficam no aparelho e são enviadas quando a conexão volta.
- Substitui a planilha única: o banco impede CPF repetido no projeto inteiro, e a tela avisa quando o endereço é igual ao de outra ficha (mesma casa).
- Os resultados possíveis seguem os critérios marcados: sem água só permite "sem água: encaminhada" ou "não atende"; sem a autodeclaração, a mulher não pode ser selecionada.
- A coordenação técnica aprova ou devolve cada ficha, com no máximo 40 selecionadas aprovadas por estado. A coordenação geral acompanha e baixa a planilha (CSV).

**Visão geral (coordenação):** metas do plano de trabalho com previsto × realizado, o que pede atenção (vagas, habilitação, fichas paradas, mesma casa, estados com mais de 30% sem água), números por estado, próximos marcos e **mapa dos quintais**: cada ficha aparece no mapa (posição do GPS quando registrada; senão, aproximada no município), com cor pela situação. O mapa é desenhado pelo próprio sistema, sem serviço externo, e funciona sem internet. Só mostra o que está no sistema; o que ainda é registrado em papel aparece como tal.

**Etapa 3:** trabalho de campo. Roteiro de visitas por estado (quem visita: bolsista ou agente de campo habilitada), diagnóstico e plano do quintal (modelo 3) com GPS, fotos e fila sem internet, e aprovação do plano pela coordenação técnica.

**Etapa 4:** vitrine pública e custo das visitas.
- A tela de entrada e a página "O projeto em números" (`#numeros`) mostram só totais por estado e fotos escolhidas pela coordenação, de mulheres que autorizaram uso de imagem. Nada individual fica público; se a autorização for retirada, a foto sai na hora.
- A aba **Custos** calcula a ajuda de custo de cada visita: horas × valor da hora + combustível de ida e volta + 1 refeição. A distância vem do km conferido pela coordenação ou, sem ele, de uma estimativa (linha reta × fator de estrada entre o município de quem visita e o quintal). Gera planilha do mês por pessoa.

**Visual:** estilo da proposta ao MDA (papel claro, verde profundo, títulos em serifa Fraunces, texto em Public Sans), com modo escuro.

---

## Como está organizado

```
index.html              página única (PWA)
css/app.css             visual (estilo da proposta ao MDA, claro e escuro)
js/config.js            URL e chave do Supabase (vazio = modo demonstração)
js/dados.js             dados do projeto: estados, municípios, valores de bolsa, metas
js/regras.js            regras de negócio da tela (CPF, vagas, metas por estado)
js/api-demo.js          modo demonstração (sem servidor, dados de exemplo)
js/api-supabase.js      modo produção (Supabase)
js/fila.js              fila do aparelho (IndexedDB) para trabalhar sem internet
js/fichas.js            ficha de indicação e termo de consentimento
js/geo.js               contornos dos estados do Nordeste e municípios do projeto (para o mapa)
js/painel.js            visão geral da coordenação (metas, alertas, estados, marcos, mapa)
js/campo.js             roteiro de visitas, agente de campo, diagnóstico e plano do quintal
js/vitrine.js           tela de entrada com números e página pública "O projeto em números"
js/custos.js            cálculo da ajuda de custo por visita
js/convites.js          link de cadastro (a pessoa preenche; a coordenação confere e aprova)
js/banco.js             dados bancários para a FUNCERN
js/app.js               telas e navegação
sw.js, manifest         instalação no celular e abertura sem internet
supabase/01_criar_banco.sql      etapa 1: equipe, regras de acesso (RLS), auditoria, login
supabase/02_fichas.sql           etapa 2: fichas de indicação e termo
supabase/03_campo.sql            etapa 3: visitas, agentes de campo, diagnóstico
supabase/04_vitrine_e_custos.sql etapa 4: vitrine pública e custo das visitas
supabase/05_dados_exemplo.sql    dados inventados para testar (opcional)
supabase/07_fotos_equipe.sql     etapa 7: foto da equipe (sem foto, mostra as iniciais)
supabase/08_convites.sql         etapa 8: link de cadastro, dados pessoais complementares, desligar só sem pendência
supabase/09_dados_bancarios.sql  etapa 9: conta e Pix para a FUNCERN (só a pessoa vê; exportação registrada)
supabase/10_apl.sql              etapa 10: arranjo produtivo local por município (usado na proposta sugerida do quintal)
supabase/11_fic.sql              etapa 11: professores do FIC, turmas e matrículas; cadastro no Arlo e SIAPE; auxiliar administrativo (um só)
supabase/12_pagamentos.sql       etapa 12: visita feita (implantação/acompanhamento) e solicitação de pagamento: solicita → aval → auxiliar lança no Arlo
supabase/13_avaliacao.sql        etapa 13: visita de avaliação (5ª visita, 200 dias de campo por estado) e medidas de impacto antes × depois
supabase/06_apagar_exemplo.sql   apaga os dados inventados
supabase/00_verificar.sql        só lê: mostra quais etapas já estão instaladas e quantos registros há
supabase/15_coord_geral_total.sql etapa 15: coordenação geral com todos os acessos (decisão de 28/09/2026)
supabase/16_popular_teste.sql    depois do 14 e do 05: logins de teste por perfil e dados em todas as etapas (troque o e-mail)
supabase/14_zerar_para_teste.sql apaga TUDO menos a coordenação geral (pede confirmação ZERAR; sem desfazer)
supabase/tests/         testes das regras do banco
```

O código não tem etapa de build nem dependências para instalar: é HTML, CSS e JavaScript puros. Qualquer pessoa com noção de web consegue manter.

## Testar no computador (modo demonstração)

```bash
cd quintais-app
python3 -m http.server 8000
# abra http://localhost:8000
```

Use o seletor "Ver como" para alternar entre coordenação geral, coordenação técnica, bolsista, agente de campo e a tela de entrada.

## Colocar em produção (cerca de 1 hora)

1. **Criar o projeto no Supabase** (supabase.com, plano gratuito). Escolha a região **South America (São Paulo)** para os dados ficarem no Brasil. Crie a conta com um e-mail institucional, não pessoal, para o projeto não depender de uma pessoa.
2. **Criar o banco:** em *SQL Editor*, rode em ordem, cada um inteiro: `01_criar_banco.sql`, `02_fichas.sql`, `03_campo.sql`, `04_vitrine_e_custos.sql`, `07_fotos_equipe.sql`, `08_convites.sql`, `09_dados_bancarios.sql`, `10_apl.sql`, `11_fic.sql`, `12_pagamentos.sql`, `13_avaliacao.sql`, `15_coord_geral_total.sql`. O 02, o 03 e o 04 podem ser rodados de novo sem estragar dados. Enquanto uma etapa não for rodada, o sistema funciona e mostra "Ainda não instalado no servidor" na parte correspondente.
3. **Cadastrar a coordenação geral:** o fim do `01_criar_banco.sql` tem um `insert` com os dados da coordenação geral. Confira nome, CPF, e-mail e telefone antes de rodar.
4. **Login com senha:** em *Authentication > Sign In / Providers > Email*, **desligue "Confirm email"**. Cada pessoa cria a própria senha em "Primeiro acesso", e o banco só aceita e-mails já cadastrados pela coordenação. Assim o sistema não depende de servidor de e-mail. Para "esqueci a senha": a coordenação geral apaga o usuário em *Authentication > Users* e a pessoa faz o primeiro acesso de novo (o cadastro na equipe não é afetado). No painel, cada pessoa mostra se já fez o primeiro acesso: confira logo depois de cadastrar alguém.
5. **Ligar o sistema ao banco:** em `js/config.js`, preencha `supabaseUrl` e `supabaseAnonKey` (em *Project Settings > API*). A chave anon é pública por desenho; quem protege os dados são as regras do banco.
6. **Publicar:** suba a pasta para um repositório no GitHub e ative o *GitHub Pages*, ou arraste a pasta para o Vercel/Netlify. Precisa ser **https** para instalar no celular.

## Dados de exemplo (para testar com o sistema cheio)

- `supabase/05_dados_exemplo.sql` coloca o projeto inteiro com dados **inventados**: coordenação técnica, 10 bolsistas, 10 agentes de campo, 279 fichas (200 selecionadas e aprovadas, lista de espera, sem água, não atende, aguardando e devolvida), 800 visitas feitas e 200 diagnósticos com plano aprovado.
- Tudo fica anotado na tabela `exemplo`: não aparece na vitrine pública, ninguém consegue criar login com os e-mails de exemplo (`@exemplo.invalid`) e a coordenação vê um aviso no topo enquanto eles existirem.
- `supabase/06_apagar_exemplo.sql` apaga só os dados de exemplo. **Rode antes de cadastrar a equipe e as fichas de verdade** (a vaga de coordenação técnica e as 10 vagas de bolsista estão ocupadas pelos exemplos).
- O 05 se recusa a rodar se já houver equipe ou fichas reais.
- Para gerar de novo (mesmo conteúdo): `python3 supabase/exemplo/gerar.py`.

## Regras garantidas pelo banco (não só pela tela)

| Regra | Onde |
|---|---|
| 1 coordenação geral e 1 coordenação técnica ativas | índice único `equipe_uma_coordenacao` |
| 1 bolsista de articulação e 1 de apoio ativas por estado | índice único `equipe_uma_bolsista_por_uf` |
| Só a coordenação geral cadastra a coordenação técnica | política RLS `equipe_incluir` |
| Só a coordenação técnica cadastra bolsistas | política RLS `equipe_incluir` |
| A coordenação geral só altera a habilitação das bolsistas | gatilho `equipe_antes` |
| Papel, estado e CPF não mudam; quem foi desligada não volta | gatilho `equipe_antes` |
| Desligamento exige data e motivo | restrição `desligamento_completo` |
| Bolsista vê o próprio cadastro e a equipe do seu estado; agente vê só o próprio | política RLS `equipe_ler` |
| Máximo de 40 selecionadas aprovadas por estado | gatilho `fichas_antes` |
| Visita só para mulher selecionada e aprovada, feita por pessoa habilitada do mesmo estado; 1 diagnóstico, 1 implantação e 2 acompanhamentos por quintal; 160 dias de campo por estado | gatilho `visitas_antes` |
| Vitrine pública só com totais; foto só com autorização de imagem e sem o nome na legenda | função `vitrine()` e gatilho `vitrine_fotos_antes` |
| Valores de pagamento e km só a coordenação altera, com registro de quem alterou | gatilho `carimbar_coord` e RLS |
| Ninguém apaga registros | sem política de DELETE |
| Toda inclusão e alteração fica registrada | gatilho `auditar` |
| Só entra quem foi cadastrado | gatilho em `auth.users` |

Para rodar os testes (PostgreSQL 16 local):

```bash
createdb teste
psql -d teste -f supabase/tests/stub_supabase.sql
psql -d teste -f supabase/tests/schema_antigo_teste.sql   # só para este teste antigo; nunca no Supabase
psql -d teste -f supabase/tests/test_regras.sql   # 21 casos da equipe, com o resultado esperado em cada um
# etapa 2 (em outro banco): stub, 01_criar_banco.sql com nome/CPF preenchidos, 02_fichas.sql e depois
psql -d teste2 -f supabase/tests/test_fichas.sql  # 17 casos das fichas
# etapa 3 (em outro banco): stub, 01 (CPF preenchido), 02, 03, 04 e depois
psql -d teste3 -f supabase/tests/test_campo.sql       # 17 casos de visitas e diagnóstico
psql -d teste3 -f supabase/tests/test_correcoes.sql   # remarcar/cancelar visitas e km
# etapa 4 (em outro banco): stub, 01, 02, 03, 04 e depois
psql -d teste4 -f supabase/tests/test_vitrine.sql     # 14 casos da vitrine e dos valores
```

## Decisões tomadas

- **Conta bancária e Pix** (exigência da FUNCERN): ficam numa tabela sem acesso direto. Só a própria pessoa informa e vê os números, depois de entrar no sistema; as coordenações veem apenas se foi informado; o auxiliar administrativo (e, na falta dele, a coordenação geral) vê a conta de uma pessoa por vez para o cadastro no Arlo, e cada consulta fica no histórico. Não existe planilha com todas as contas. Esses dados não entram no cache do celular nem nos dados de exemplo.
- **Login com senha criada no primeiro acesso**, sem depender de envio de e-mail. A conta só é criada se o e-mail já estiver cadastrado pela coordenação. Limite conhecido: ninguém confirma que a pessoa é dona do e-mail, então quem souber o e-mail de uma bolsista recém-cadastrada poderia criar a senha antes dela. Por isso, a coordenação confere no painel se o primeiro acesso foi feito pela própria pessoa. Com um servidor de e-mail funcionando, dá para voltar ao login por link.
- **Ajuda de custo por visita:** R$ 50 por hora (diagnóstico 3 h; implantação, acompanhamento e avaliação 2 h), carro a 10 km/L, 1 refeição por visita. Decisão da coordenação geral: agentes e bolsistas recebem as horas. Confirmar com a FUNCERN, porque bolsistas já recebem bolsa mensal pela mesma atividade.
- **Visita de avaliação** ainda não pode ser agendada: o plano prevê 160 dias de campo por estado (4 visitas × 40 quintais); uma 5ª visita passaria desse total.
- **Valores de bolsa** vêm do plano de trabalho: coordenação técnica R$ 4.700, articulação R$ 2.200 e apoio R$ 1.600 por mês. Se o plano mudar, altere `js/dados.js`.
- **Nomes das funções:** o sistema usa "articulação estadual" e "apoio estadual", como no plano de trabalho e no Guia das bolsistas. O modelo de termo de compromisso diz "articulação territorial" e "apoio técnico", e vale uniformizar o modelo.
- **Modelo de dados alinhado à proposta de sistema nacional ao MDA** (18/07/2026): CPF validado, papéis de agentes de campo, habilitação e bolsa. Assim, os dados podem migrar se a proposta for adotada.

## Próximos passos

1. Backup semanal do banco (o plano gratuito do Supabase não guarda cópias) — antes do diagnóstico ir a campo.
2. Relatório de visita técnica (implantação e acompanhamentos; a visita final repete a pergunta de renda da linha de base).
3. Termo de recebimento do kit (depende da lista do kit aprovada).
4. Relatório mensal da bolsista gerado a partir dos registros do mês.
