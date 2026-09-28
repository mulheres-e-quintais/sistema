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

**Visão geral (coordenação):** metas do plano de trabalho com previsto × realizado, o que pede atenção (vagas, habilitação, fichas paradas, mesma casa, estados com mais de 30% sem água), números por estado e próximos marcos. Só mostra o que está no sistema; o que ainda é registrado em papel aparece como tal.

**Próximas etapas:** diagnóstico e plano do quintal, relatório de visita técnica, termo de recebimento do kit.

---

## Como está organizado

```
index.html              página única (PWA)
css/app.css             visual (identidade Mulheres & Quintais)
js/config.js            URL e chave do Supabase (vazio = modo demonstração)
js/dados.js             dados do projeto: estados, municípios, valores de bolsa, metas
js/regras.js            regras de negócio da tela (CPF, vagas, metas por estado)
js/api-demo.js          modo demonstração (sem servidor, dados de exemplo)
js/api-supabase.js      modo produção (Supabase)
js/fila.js              fila do aparelho (IndexedDB) para trabalhar sem internet
js/fichas.js            ficha de indicação e termo de consentimento
js/painel.js            visão geral da coordenação (metas, alertas, estados, marcos)
js/app.js               telas
sw.js, manifest         instalação no celular e abertura sem internet
supabase/schema.sql     banco: tabelas, regras de acesso (RLS), auditoria
supabase/tests/         testes das regras do banco
```

O código não tem etapa de build nem dependências para instalar: é HTML, CSS e JavaScript puros. Qualquer pessoa com noção de web consegue manter.

## Testar no computador (modo demonstração)

```bash
cd quintais-app
python3 -m http.server 8000
# abra http://localhost:8000
```

Use o seletor "Ver como" para alternar entre coordenação geral, coordenação técnica e bolsista.

## Colocar em produção (cerca de 1 hora)

1. **Criar o projeto no Supabase** (supabase.com, plano gratuito). Escolha a região **South America (São Paulo)** para os dados ficarem no Brasil. Crie a conta com um e-mail institucional, não pessoal, para o projeto não depender de uma pessoa.
2. **Criar o banco:** em *SQL Editor*, cole e rode todo o `supabase/schema.sql`.
3. **Etapa 2:** rode também o `supabase/02_fichas.sql` (fichas de indicação, fotos e regras).
4. **Cadastrar a coordenação geral:** no fim do `schema.sql` há um `insert` comentado. Preencha com os dados reais e rode só essa parte.
5. **Login com senha:** em *Authentication > Sign In / Providers > Email*, **desligue "Confirm email"**. Cada pessoa cria a própria senha em "Primeiro acesso", e o banco só aceita e-mails já cadastrados pela coordenação. Assim o sistema não depende de servidor de e-mail. Para "esqueci a senha": a coordenação geral apaga o usuário em *Authentication > Users* e a pessoa faz o primeiro acesso de novo (o cadastro na equipe não é afetado). No painel, cada pessoa mostra se já fez o primeiro acesso: confira logo depois de cadastrar alguém.
6. **Ligar o sistema ao banco:** em `js/config.js`, preencha `supabaseUrl` e `supabaseAnonKey` (em *Project Settings > API*). A chave anon é pública por desenho; quem protege os dados são as regras do banco.
7. **Publicar:** suba a pasta para um repositório no GitHub e ative o *GitHub Pages*, ou arraste a pasta para o Vercel/Netlify. Precisa ser **https** para instalar no celular.

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
| Plano individual das 2 bolsistas não passa de 40 diagnósticos, 40 quintais e 80 visitas por estado | gatilho `checar_meta_estado` |
| Bolsista vê só o próprio cadastro | política RLS `equipe_ler` |
| Ninguém apaga registros | sem política de DELETE |
| Toda inclusão e alteração fica registrada | gatilho `auditar` |
| Só entra quem foi cadastrado | gatilho em `auth.users` |

Para rodar os testes (PostgreSQL 16 local):

```bash
createdb teste
psql -d teste -f supabase/tests/stub_supabase.sql
psql -d teste -f supabase/schema.sql
psql -d teste -f supabase/tests/test_regras.sql   # 21 casos da equipe, com o resultado esperado em cada um
# etapa 2 (em outro banco): stub, 01_criar_banco.sql com nome/CPF preenchidos, 02_fichas.sql e depois
psql -d teste2 -f supabase/tests/test_fichas.sql  # 17 casos das fichas
```

## Decisões tomadas

- **Não guarda conta bancária nem Pix.** Esses dados vão direto para a FUNCERN, que paga as bolsas. Menos dado guardado significa menos risco (LGPD, art. 6º, III).
- **Login com senha criada no primeiro acesso**, sem depender de envio de e-mail. A conta só é criada se o e-mail já estiver cadastrado pela coordenação. Limite conhecido: ninguém confirma que a pessoa é dona do e-mail, então quem souber o e-mail de uma bolsista recém-cadastrada poderia criar a senha antes dela. Por isso, a coordenação confere no painel se o primeiro acesso foi feito pela própria pessoa. Com um servidor de e-mail funcionando, dá para voltar ao login por link.
- **Valores de bolsa** vêm do plano de trabalho: coordenação técnica R$ 4.700, articulação R$ 2.200 e apoio R$ 1.600 por mês. Se o plano mudar, altere `js/dados.js`.
- **Nomes das funções:** o sistema usa "articulação estadual" e "apoio estadual", como no plano de trabalho e no Guia das bolsistas. O modelo de termo de compromisso diz "articulação territorial" e "apoio técnico", e vale uniformizar o modelo.
- **Modelo de dados alinhado à proposta de sistema nacional ao MDA** (18/07/2026): CPF validado, papéis de agentes de campo, habilitação e bolsa. Assim, os dados podem migrar se a proposta for adotada.

## Próximos passos

1. Formulários de campo (ficha de indicação, termo de consentimento, diagnóstico e plano, termo do kit, visita), com GPS, fotos e fila offline.
2. Painel de acompanhamento por estado (fichas, selecionadas, lista de espera, sem água), substituindo a planilha única.
3. Relatório mensal da bolsista gerado a partir dos formulários do mês.
