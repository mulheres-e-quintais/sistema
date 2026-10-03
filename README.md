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

**Visual:** estilo da proposta ao MDA (papel claro, verde profundo, tipografia Manrope em todo o sistema; Lora só no nome "Mulheres & Quintais"), com modo escuro.

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
js/termo.js             termo de compromisso (ou de autorização do servidor) já preenchido com os dados do cadastro, para imprimir, assinar e anexar
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
supabase/48_termo_pela_pessoa.sql Etapa 48: a própria pessoa anexa o termo de compromisso; a data só entra com o termo anexado (decisão de 02/10/2026)
supabase/06_apagar_exemplo.sql   apaga os dados inventados
supabase/00_verificar.sql        só lê: mostra quais etapas já estão instaladas e quantos registros há
supabase/15_coord_geral_total.sql etapa 15: coordenação geral com todos os acessos (decisão de 28/09/2026)
supabase/17_corrige_link_cadastro.sql correção: "Gerar link de cadastro" (erro gen_random_bytes)
supabase/16_popular_teste.sql    depois do 14 e do 05: logins de teste por perfil e dados em todas as etapas (troque o e-mail)
supabase/14_zerar_para_teste.sql apaga TUDO menos a coordenação geral (pede confirmação ZERAR; sem desfazer)
supabase/18_codigo_primeiro_acesso.sql Código de primeiro acesso (fecha a brecha do login)
supabase/19_entregas_do_mes.sql Entregas do mês e ciência do guia
supabase/20_organizar_texto.sql Organizar texto (controle de uso da IA)
supabase/21_roteiro_testes.sql Roteiro de testes (respostas "Deu certo / Não deu certo")
supabase/22_passagens_eventos.sql Pedidos de passagem aérea e de estrutura de evento
supabase/23_fic_coordenacao_tecnica.sql Coordenação técnica também faz o curso FIC
supabase/24_documentos.sql Documentos do projeto (atas, ofícios, relatórios…) — só a coordenação geral
supabase/25_historico_e_cadastro.sql Histórico só para a coordenação geral + cadastro repetido pelo link
supabase/26_conferencia_auxiliar.sql Quem confere os pedidos de passagem e evento na falta da coordenação técnica
supabase/27_seguranca_revisao.sql Correções de segurança da revisão de 29/09/2026
supabase/28_pedido_novo_acesso.sql "esqueci a senha" pela tela de entrada
supabase/29_desempenho.sql Desempenho do banco (revisão de 29/09/2026)
supabase/30_ultimos_acessos.sql Últimos acessos (quem entrou, quando e de que aparelho)
supabase/31_validacao_diagnostico.sql Validação do diagnóstico (decisão da coordenação geral, 29/09/2026)
supabase/32_desde_o_inicio.sql Pagamento e entregas só a partir do mês de início (decisão da coordenação geral, 29/09/2026)
supabase/33_exige_professor_fic.sql Cadastro só com professor do FIC habilitado (decisão da coordenação geral, 29/09/2026)
supabase/34_popular_teste.sql Popular o banco com dados de teste (fictícios)
supabase/35_tetos_passagens_eventos.sql Tetos de passagens e eventos (decisão da coordenação geral, 29/09/2026)
supabase/36_execucao_financeira.sql Execução financeira (painel da coordenação geral, 30/09/2026)
supabase/37_execucao_planilhas.sql Execução pela planilha do mês (30/09/2026)
supabase/38_fic_encontros.sql Encontros do curso FIC, lista de presença e relatório do professor (30/09/2026)
supabase/39_agua.sql Acompanhamento do acesso à água (01/10/2026)
supabase/40_vitrine_municipios.sql Vitrine pública por município (01/10/2026)
supabase/41_desligamento.sql Desligamento com pendências (01/10/2026)
supabase/42_revisao_seguranca.sql Revisão de segurança e consistência (01/10/2026)
supabase/43_lgpd_equipe.sql Proteção dos dados da equipe e conta da coordenação geral (01/10/2026)
supabase/44_venda.sql Orientação de venda do excedente (01/10/2026)
supabase/45_auditoria_qa.sql Correções da auditoria de qualidade (01/10/2026)
supabase/46_regras_decididas.sql Regras decididas pela coordenação geral e pendências da auditoria (02/10/2026)
supabase/47_auditoria_bd.sql Correções da auditoria do banco de dados (02/10/2026)
supabase/49_popular_fic.sql Popular o curso FIC com dados de teste (fictícios) (03/10/2026)
supabase/50_limite_professores.sql No máximo 2 professores do FIC ativos (decisão da coordenação geral em 03/10/2026)
supabase/51_kit_itens.sql Itens do kit com preço de referência, editados pela coordenação (03/10/2026)
supabase/90_auditoria_dados.sql Auditoria da qualidade dos dados (só lê, não muda nada)
supabase/99_zerar_tudo.sql Zerar todo o banco (02/10/2026)
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
2. **Criar o banco:** em *SQL Editor*, rode em ordem, cada um inteiro: `01_criar_banco.sql`, `02_fichas.sql`, `03_campo.sql`, `04_vitrine_e_custos.sql`, `07_fotos_equipe.sql`, `08_convites.sql`, `09_dados_bancarios.sql`, `10_apl.sql`, `11_fic.sql`, `12_pagamentos.sql`, `13_avaliacao.sql`, `15_coord_geral_total.sql`, `17_corrige_link_cadastro.sql`, `18_codigo_primeiro_acesso.sql`, `19_entregas_do_mes.sql`, `21_roteiro_testes.sql`, `22_passagens_eventos.sql`, `23_fic_coordenacao_tecnica.sql`, `24_documentos.sql`, `25_historico_e_cadastro.sql`, `26_conferencia_auxiliar.sql`, `27_seguranca_revisao.sql`, `28_pedido_novo_acesso.sql`, `29_desempenho.sql`, `30_ultimos_acessos.sql`, `31_validacao_diagnostico.sql`, `32_desde_o_inicio.sql`, `33_exige_professor_fic.sql`, `35_tetos_passagens_eventos.sql`, `36_execucao_financeira.sql`, `37_execucao_planilhas.sql`, `38_fic_encontros.sql`, `39_agua.sql`, `40_vitrine_municipios.sql`, `41_desligamento.sql`, `42_revisao_seguranca.sql`, `43_lgpd_equipe.sql`, `44_venda.sql`, `45_auditoria_qa.sql`, `46_regras_decididas.sql`, `47_auditoria_bd.sql`, `48_termo_pela_pessoa.sql`, `50_limite_professores.sql`, `51_kit_itens.sql`. Todos podem ser rodados de novo, desde que em ordem e até o fim (os mais antigos recriam funções que os mais novos atualizam). O `20_organizar_texto.sql` é opcional (só se ligar a IA). No fim, rode o `00_verificar.sql`: ele mostra ok ou FALTA em cada etapa. Não fazem parte da instalação: `05`, `06`, `14`, `16`, `34`, `49` (dados de teste) e `99` (zera o banco). Enquanto uma etapa não for rodada, o sistema funciona e mostra "Ainda não instalado no servidor" na parte correspondente.
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

- **Termo de compromisso (02/10/2026):** cada pessoa baixa o modelo, preenche, assina e anexa o termo no próprio cadastro (Pendências ou Meus dados). Quem confere (auxiliar administrativo ou coordenação) abre o arquivo e só então registra a data; sem o termo anexado, o banco recusa a data. Depois de conferido, só quem confere troca o arquivo. O sistema monta o termo já preenchido com os dados do cadastro (`js/termo.js`): a pessoa só confere, imprime ou salva em PDF, assina e anexa; o que o sistema não tem (cargo, regime e campus do servidor) sai em branco. São dois modelos, com versão em branco em `modelos/`, escolhidos pela função (`MQ.MODELOS_TERMO` em `js/dados.js`): servidores do IFRN (professores do FIC e auxiliar administrativo) usam o termo de autorização de participação em programa gerenciado pela FUNCERN (Anexo I da Portaria 017/2017), em branco; coordenação técnica, bolsistas e agentes (MPA) usam o termo de compromisso do projeto, redigido a partir do Guia das bolsistas e ainda a validar com a FUNCERN. Quem recebe o termo por fora (papel, WhatsApp) ainda pode anexar pela ficha da pessoa. Registros antigos com data e sem arquivo continuam valendo.
- **Aba Equipe da coordenação técnica (02/10/2026):** não mostra o auxiliar administrativo nem os professores do FIC (são cadastrados e acompanhados pela coordenação geral). É só a tela: o banco não mudou.
- **Tela de entrada (02/10/2026):** uma ajuda só, o link "Precisa de ajuda para entrar?" ao lado do formulário; o botão "Ajuda desta página" do rodapé fica nas outras telas.

## Próximos passos

1. Backup semanal do banco (o plano gratuito do Supabase não guarda cópias) — antes do diagnóstico ir a campo.
2. Relatório de visita técnica (implantação e acompanhamentos; a visita final repete a pergunta de renda da linha de base).
3. Termo de recebimento do kit (depende da lista do kit aprovada).
4. Relatório mensal da bolsista gerado a partir dos registros do mês.

## Manuais em PDF

O manual completo, os guias rápidos e o manual de cada perfil são gerados das telas reais por `bash ferramentas/manuais/gerar_tudo.sh` (detalhes em `ferramentas/manuais/LEIA-ME.md`). Os de cada perfil ficam em `manuais/` e abrem pelo botão de ajuda. Toda mudança de funcionalidade pede gerar de novo.
