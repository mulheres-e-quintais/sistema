/* Mulheres & Quintais — ajuda de cada tela: para que serve, como fazer e dúvidas comuns.
   Abre pelo botão "?" da barra (e pelo link "Precisa de ajuda?" na tela de entrada). */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);

  const A = {
    entrada: {
      t: 'Como entrar no sistema',
      intro: 'Só entra quem foi cadastrado pela coordenação, com o e-mail que ela registrou. O sistema não manda e-mail: as instruções chegam pelo WhatsApp, com um código de acesso.',
      tarefas: [
        ['Entrar pela primeira vez', ['Abra o endereço que veio no WhatsApp (no Chrome ou no Safari).', 'Toque em <b>Primeiro acesso</b>.', 'Digite o e-mail cadastrado e o <b>código de acesso</b> da mensagem.', 'Crie uma senha com pelo menos 8 caracteres, com letras e números, e repita.', 'Toque em <b>Criar senha e entrar</b>.']],
        ['Entrar nas próximas vezes', ['Toque em <b>Já tenho senha</b>.', 'Digite o e-mail e a senha.', 'Toque em <b>Entrar</b>.']]
      ],
      contato: { nome: 'coordenação do projeto', tel: '(84) 9 9992-7943', wa: '5584999927943' },
      secoes: [['Antes de entrar', ['Abra no <b>Chrome</b> (Android) ou no <b>Safari</b> (iPhone). Aberto por dentro do WhatsApp ou do Instagram, a localização e as fotos não funcionam.', 'Para usar como aplicativo, no menu do navegador toque em <b>Adicionar à tela inicial</b>. Assim ele também funciona no campo sem internet.']]],
      duvidas: [
        ['Aparece "confira o e-mail e o código de acesso".', 'O e-mail tem de ser exatamente o do cadastro (confira pontos e o final @gmail.com, @ifrn.edu.br…). O código vale 7 dias e uma vez só. Se venceu ou se perdeu, peça um novo à coordenação pelo WhatsApp (84) 9 9992-7943.'],
        ['Aparece "Este e-mail já tem senha".', 'Você já fez o primeiro acesso. Use "Já tenho senha".'],
        ['Quero trocar a minha senha.', 'Toque na sua foto ou nas suas iniciais, no alto, para abrir <b>Meus dados</b>. Abra <b>Trocar minha senha</b>, digite a senha atual, a nova duas vezes e toque em <b>Trocar senha</b>.'],
        ['Esqueci a senha.', 'Na tela de entrada, toque em <b>Esqueci a senha</b>, digite o seu e-mail e toque em <b>Pedir novo acesso</b>. A coordenação geral recebe o pedido e manda um código novo para o WhatsApp do seu cadastro. Com o código, entre em <b>Primeiro acesso</b> e crie outra senha. Seus dados não se perdem.'],
        ['Não recebi e-mail do sistema.', 'É normal: o sistema não manda e-mail. Quem cadastrou você manda o aviso de acesso, com o código, pelo WhatsApp.'],
        ['Por que esse código?', 'Ele garante que só você crie a senha da sua conta. Sem ele, qualquer pessoa que soubesse o seu e-mail poderia entrar no seu lugar.']
      ]
    },

    /* ---------- dicas que valem para todo mundo ---------- */
    geral: {
      t: 'Dicas para usar o sistema',
      intro: 'O que funciona igual em todas as telas.',
      secoes: [
        ['No alto da tela', [
          '<b>?</b> abre esta ajuda, sempre sobre a tela em que você está.',
          'A <b>sua foto</b> (ou suas iniciais) abre <b>Meus dados</b>: celular, endereço e conta bancária para a FUNCERN.',
          'Se aparecer um aviso de <b>pendências no seu cadastro</b>, resolva primeiro: sem elas, a FUNCERN não paga.']],
        ['Falar em vez de digitar', [
          'Nos campos de texto (relato, observações, relatório), toque em <b>Falar</b> e fale normalmente. O texto vai aparecendo; toque em <b>Parar</b> quando terminar e revise antes de salvar.',
          'Diga "vírgula", "ponto final" ou "nova linha" para pontuar.',
          'Precisa de internet. Sem sinal, use o microfone do teclado do celular.',
          'Evite dizer nomes e CPF: o sistema já sabe de quem é a visita.']],
        ['Sem internet', [
          'Fichas, diagnósticos, visitas feitas e avaliações podem ser preenchidos sem sinal. Ficam guardados no celular, com as fotos, e sobem sozinhos quando a internet voltar (ou em <b>Enviar agora</b>).',
          'Antes de ir a campo, abra o sistema com internet para atualizar a lista de visitas.',
          'Depois de 15 minutos sem uso o sistema sai sozinho, em todos os perfis (aos 13 minutos aparece um aviso: toque em <b>Continuar usando</b>). Sem internet ele não sai (para entrar de novo é preciso conexão); quando o sinal volta, se você continuar parada há 15 minutos, aí ele sai.',
          'Se o sistema sair com um formulário pela metade, o que foi digitado volta quando você entrar e abrir o mesmo formulário (fica guardado só neste aparelho, por 24 horas). O que já estava guardado para enviar também não se perde.',
          'Não apague os dados do navegador nem desinstale o aplicativo com registros pendentes: eles se perdem.']],
        ['Proteção dos dados', [
          'Os dados das pessoas são protegidos pela LGPD (Lei nº 13.709/2018). Cada perfil vê só o que precisa para o seu trabalho.',
          'Não fotografe telas nem repasse informações de outras pessoas.',
          'Tudo o que muda no cadastro da equipe, e cada consulta a conta bancária, fica registrado no histórico.']]
      ]
    },

    /* ---------- coordenação ---------- */
    visao: {
      t: 'Visão geral',
      intro: 'O retrato do projeto em uma tela: em que mês estamos, como está a equipe, a seleção das mulheres, o campo e os avisos que pedem atenção.',
      tarefas: [
        ['Resolver um aviso', ['Leia os avisos do topo, do mais urgente para o menos.', 'Toque no aviso: o sistema abre a aba que resolve.', 'Faça a ação e volte à <b>Visão geral</b>: o aviso some quando o problema acaba.']]
      ],
      passos: [
        'A linha de 13 quadradinhos mostra os meses do projeto; o quadrado colorido é o mês atual. Ao lado, quantos dias faltam para o fim da vigência.',
        'Os <b>avisos</b> vêm por ordem de urgência (crítico, atenção, informação). Toque no aviso para ir direto à aba que resolve.',
        'O cartão <b>Ponto de partida</b> (e, depois das avaliações, <b>hoje</b>) compara a linha de base do diagnóstico com a avaliação final (fome, renda do quintal, consumo, venda, autonomia). Só entra quem já tem as duas medidas.',
        '<b>Financeiro e entregas</b> abre o painel de recursos, rubricas e metas físicas. Só a coordenação geral vê esse botão.'
      ],
      duvidas: [
        ['Os números estão zerados.', 'Eles só contam registros reais. Dados de teste (exemplo) ficam de fora dos números e da vitrine.'],
        ['Qual a diferença entre "na equipe" e "habilitadas"?', 'Na equipe é quem está cadastrado e ativo. Habilitada é quem completou os passos para receber: matrícula no FIC (coordenação técnica, bolsistas e agentes), cadastro no Arlo e termo de compromisso.']
      ]
    },
    equipe: {
      t: 'Equipe',
      intro: 'Cadastro de todas as pessoas do projeto: coordenação técnica, auxiliar administrativo, professores do FIC, bolsistas por estado e agentes de campo.',
      tarefas: [
        ['Cadastrar pelo link (recomendado)', ['Na aba <b>Equipe</b>, toque na vaga ou em <b>Cadastrar</b>.', 'Toque em <b>Gerar link de cadastro</b>.', 'Toque em <b>Enviar pelo WhatsApp</b> e escolha a pessoa.', 'Quando ela enviar, abra <b>Cadastros enviados pelo link</b>.', 'Confira os dados e toque em <b>Conferir e cadastrar</b> → <b>Cadastrar</b>.']],
        ['Cadastrar digitando', ['Toque na vaga ou em <b>Cadastrar</b> → <b>Digitar os dados agora</b>.', 'Preencha nome, CPF, celular e e-mail.', 'Responda se a pessoa já tem cadastro no Arlo e, para quem vai a campo, o perfil no campo.', 'Marque a ciência sobre o uso dos dados.', 'Toque em <b>Cadastrar</b>.']],
        ['Mandar o acesso para a pessoa', ['Abra a ficha da pessoa.', 'Toque em <b>Gerar código de acesso</b>.', 'Toque em <b>Mandar por WhatsApp</b>: a mensagem já leva endereço, e-mail e código.']],
        ['Registrar a habilitação', ['Abra a ficha da pessoa.', 'Toque em <b>Registrar passos da habilitação</b>.', 'Em cada passo feito, toque em <b>Hoje</b> (ou escolha a data).', 'Toque em <b>Salvar</b>.']],
        ['Desligar e pôr substituta', ['Abra a ficha da pessoa → <b>Desligar</b>.', 'Escolha o motivo e explique em uma frase.', 'Toque em <b>Confirmar desligamento</b> (não tem volta).', 'Na vaga que abriu, toque em <b>Cadastrar substituta</b>.']]
      ],
      passos: [
        'Toque na vaga ou em <b>Cadastrar</b> e escolha: <b>Gerar link de cadastro</b> (a pessoa preenche pelo celular e você confere e aprova) ou <b>Digitar os dados agora</b> (você mesmo preenche). O link é o recomendado: menos digitação e a própria pessoa aceita o termo de dados.',
        'Para bolsistas, antes de salvar aparece o <b>perfil da bolsista</b> do Guia: confira se a indicada atende.',
        'Para coordenação técnica, bolsistas e agentes há o <b>Perfil no campo</b> (é agricultora, atua com mulheres rurais, experiência…). Pelo link é obrigatório; digitando, marque o que souber.',
        'Depois de salvar, abra a ficha da pessoa e toque em <b>Gerar código de acesso</b>. Mande a mensagem pronta pelo WhatsApp: ela traz o endereço, o e-mail e o código.',
        'Cadastros que chegam pelo link aparecem em <b>Cadastros enviados pelo link</b>. Abra, confira, complete e salve: ao salvar, o cadastro é aprovado.',
        'Na ficha da pessoa ficam a <b>habilitação</b> (FIC, Arlo e termo), a <b>leitura do guia</b> e o <b>perfil no campo</b>. O botão <b>Hoje</b> preenche a data do dia.',
        '<b>Desligar</b> não apaga o cadastro: a vaga fica livre para a substituta e o histórico guarda quem desligou, quando e por quê.'
      ],
      duvidas: [
        ['Quem cadastra quem?', 'A coordenação geral cadastra a coordenação técnica, os professores do FIC e o auxiliar, e pode cadastrar todos os outros. A coordenação técnica cadastra bolsistas e agentes.'],
        ['A pessoa perdeu o código ou ele venceu.', 'Abra a ficha dela e gere outro. O anterior deixa de valer na hora.'],
        ['A pessoa esqueceu a senha.', 'Quando ela toca em "Esqueci a senha" na entrada, o pedido aparece na aba <b>Equipe</b> (com número na aba), em "Pedidos de novo acesso". Só a coordenação geral resolve: abra a ficha, toque em "Liberar novo primeiro acesso" (confirme) e mande o código pelo WhatsApp do cadastro. A senha antiga é apagada; os dados não mudam. Se a pessoa não sabe do pedido, descarte.'],
        ['Errei o CPF.', 'CPF e estado não mudam depois de salvos. Desligue o cadastro errado e faça um novo.'],
        ['A pessoa já tem cadastro no Arlo.', 'Marque "Sim" na pergunta do Arlo: só os dados básicos são pedidos (e a cidade, para quem vai a campo).'],
        ['O CEP não preencheu a rua.', 'Em muitas cidades pequenas o CEP é um só para a cidade toda. O sistema preenche cidade e estado; digite a rua, o sítio ou a comunidade.']
      ]
    },
    selecao: {
      t: 'Seleção das mulheres',
      intro: 'Cada mulher indicada pela comunidade tem uma ficha de indicação, preenchida pela bolsista do estado, com os critérios do edital e o termo de consentimento. Aqui a coordenação aprova ou devolve.',
      tarefas: [
        ['Aprovar ou devolver uma ficha', ['Na aba <b>Seleção</b>, abra uma ficha que aguarda.', 'Confira dados, critérios e a foto do termo assinado.', 'Toque em <b>Aprovar</b>, ou escreva o que corrigir e toque em <b>Devolver para correção</b>.']],
        ['Baixar as fichas', ['Toque em <b>Baixar CSV</b>.', 'Abra o arquivo no Excel ou no Google Planilhas.']]
      ],
      passos: [
        'A tabela mostra, por estado, as fichas lançadas e a situação: <b>selecionadas aprovadas</b> (as que ocupam as 40 vagas), <b>lista de espera</b>, <b>sem água</b>, <b>não atende</b> e as que <b>aguardam</b> decisão.',
        'Abra uma ficha que aguarda, confira os dados, os critérios e a foto do termo assinado, e escolha <b>Aprovar</b> ou <b>Devolver</b> (dizendo o que corrigir).',
        'Cada estado tem no máximo 40 selecionadas aprovadas. As demais ficam na lista de espera, pela pontuação de prioridade.'
      ],
      duvidas: [
        ['A soma da linha passa de 40.', 'As 40 são as vagas. Lista de espera, sem água e não atende também são fichas lançadas, mas não ocupam vaga.'],
        ['O que é "sem água"?', 'A água da casa não dura no período seco. Essa mulher não recebe o kit agora e é encaminhada a programa de cisternas; a vaga vai para a lista de espera.'],
        ['O sistema avisou possível duplicidade.', 'Há outra ficha com o mesmo CPF ou o mesmo endereço. Confira antes de aprovar: o critério é uma mulher por casa.']
      ]
    },
    campo: {
      t: 'Trabalho de campo',
      intro: 'As 5 visitas de cada quintal: diagnóstico e plano, implantação, 2 acompanhamentos e avaliação final. São até 200 dias de campo por estado.',
      tarefas: [
        ['Agendar uma visita', ['Na aba <b>Campo</b>, toque em <b>+ Agendar visita</b>.', 'Escolha o quintal, a etapa, a data e quem vai (só aparece quem está habilitada).', 'Toque em <b>Agendar</b>.']],
        ['Aprovar o plano do quintal', ['Em <b>Planos para você aprovar</b>, abra o diagnóstico.', 'Confira fotos, kit (até R$ 5.000) e cronograma.', 'Toque em <b>Aprovar</b>, ou escreva o motivo e toque em <b>Devolver para correção</b>.']],
        ['Mudar ou cancelar uma visita', ['Abra a visita no roteiro.', 'Toque em <b>Mudar data ou pessoa</b>, ou em <b>Cancelar esta visita</b>.']]
      ],
      passos: [
        'A tabela mostra, por estado, os dias de campo feitos e previstos, diagnósticos, planos aprovados, casos sem água e agentes.',
        'As etapas seguem uma ordem: a <b>implantação</b> só é agendada ou registrada com o plano do quintal aprovado (e nunca em quintal sem água); o <b>acompanhamento</b>, só depois da implantação feita. A data de cada etapa não pode ser anterior à da etapa de antes. Quando a etapa ainda não pode, a tela mostra o motivo no lugar do botão.',
        'Em <b>Planos para você aprovar</b>, abra o diagnóstico, confira as fotos, o kit (itens da lista aprovada, com preço, até o valor por quintal) e o cronograma, e <b>aprove</b> ou <b>devolva</b>.',
        '<b>Investimento nos quintais</b> mostra o valor do kit por quintal (R$ 5.000,00, fixado no plano de trabalho) e a soma projetada pelos planos.',
        'O <b>roteiro</b> lista cada visita: data, quem vai e a situação, com o botão do que fazer. Visitas vencidas aparecem como atrasadas.',
        '<b>Impacto: antes × depois</b> compara o diagnóstico com a avaliação final de cada quintal.'
      ],
      duvidas: [
        ['Por que não consigo agendar a visita para uma agente?', 'Quem visita precisa estar habilitada (FIC, Arlo e termo); senão a visita não pode ser paga.'],
        ['O que conta como dia de campo?', 'Cada visita feita a um quintal é 1 dia de campo de quem visitou, e é a base da ajuda de custo.'],
        ['Um plano passou de R$ 5.000.', 'O sistema não deixa salvar acima do valor. Se aparecer acima, devolva pedindo para tirar ou trocar itens.'],
        ['Onde a visita foi feita?', 'No diagnóstico, o bloco <b>Onde foi registrado</b> mostra no mapa do estado o ponto do GPS e o centro do município da ficha, com a distância. Mais de 40 km do centro, fora do estado ou sem localização aparece em vermelho: confira antes de aprovar e diga na observação como conferiu.'],
        ['Por que não aparece o botão Aprovar para mim?', 'Se você (coordenação geral) alterou o diagnóstico, quem aprova é a coordenação técnica. Sem técnica, devolva para quem aplicou corrigir: depois da correção dela, você pode aprovar.']
      ]
    },
    fic: {
      t: 'Curso FIC',
      intro: 'Turmas do curso FIC do IFRN, matrículas da coordenação técnica, das bolsistas e das agentes e o acesso mensal ao AVA. A matrícula é um dos passos da habilitação; o acesso ao AVA é uma das entregas do mês das bolsistas.',
      tarefas: [
        ['Criar uma turma', ['Toque em <b>+ Nova turma</b>.', 'Dê o nome, o estado (ou vários estados) e as datas.', 'Toque em <b>Criar turma</b>.']],
        ['Matricular', ['Na turma, toque em <b>+ Matricular</b>.', 'Marque as pessoas e digite o número da matrícula no SUAP de cada uma.', 'Confira a data e toque em <b>Salvar</b>.']],
        ['Confirmar o acesso ao AVA', ['Em <b>Acesso ao AVA no mês</b>, confira o mês (use ‹ › para mudar).', 'Marque quem entrou e fez as atividades. Salva na hora.']]
      ],
      passos: [
        'Os professores do FIC criam as turmas e matriculam, em qualquer turma. A coordenação geral também pode.',
        'Para matricular: abra a turma, toque em <b>+ Matricular</b>, escolha a pessoa, informe o número da matrícula (SUAP) e a data.',
        'Turma de um estado só aceita gente daquele estado. Turma "vários estados" aceita todos.',
        'Em <b>Acesso ao AVA no mês</b>, marque quem entrou no curso e fez as atividades. Use ‹ › para mudar o mês.'
      ],
      duvidas: [
        ['Professor e auxiliar se matriculam?', 'Não. A habilitação deles é cadastro no Arlo e termo de compromisso.'],
        ['Matriculei errado.', 'Para corrigir número ou data, matricule de novo na mesma turma. Para trocar de turma, cancele antes (com motivo).'],
        ['Marquei o AVA por engano.', 'Toque de novo para desmarcar. Só professores do FIC e a coordenação geral marcam.']
      ]
    },
    pagamentos: {
      t: 'Pagamentos',
      intro: 'Pedidos de ajuda de custo (visitas de campo) e de bolsa mensal. O caminho é sempre: a pessoa pede → a coordenação dá o aval → o auxiliar lança no Arlo (FUNCERN).',
      tarefas: [
        ['Dar o aval', ['Em <b>Esperando o seu aval</b>, abra o pedido.', 'Confira as visitas e o km (ajuda de custo) ou o relatório e as entregas do mês (bolsa).', 'Toque em <b>Dar aval</b>, ou escreva o que corrigir e toque em <b>Devolver para correção</b>.']]
      ],
      passos: [
        'Em <b>Esperando o seu aval</b>, abra o pedido e confira: na ajuda de custo, as visitas e o km; na bolsa, o relatório e as <b>entregas do mês</b> (fotos, lista de presença, fichas, AVA e metas).',
        'Toque em <b>Dar aval</b> ou <b>Devolver</b>, dizendo o que corrigir.',
        'Quem dá o aval: a coordenação técnica, para ajuda de custo e bolsa das bolsistas; a coordenação geral, para a bolsa da coordenação técnica, dos professores e do auxiliar.',
        'Com o aval, o pedido vai para o auxiliar, que lança no Arlo e registra o protocolo.'
      ],
      duvidas: [
        ['Quem começou no meio do mês recebe o mês inteiro?', 'Sim. A bolsa é pedida a partir do mês de início no projeto e, pedida no mês, vale o mês inteiro (decisão da coordenação geral). Antes do mês de início o sistema não deixa pedir.'],
        ['Uma visita pode entrar em dois pedidos?', 'Não. Depois de pedida, a visita fica travada (data, pessoa e situação) até o pedido ser devolvido. Depois que o pedido é lançado no Arlo, o km conferido da visita também não muda mais.'],
        ['A lista de presença está marcada, mas não vi o papel.', 'A marcação é a bolsista quem faz. Confira as listas assinadas antes de dar o aval.'],
        ['Quanto é a ajuda de custo?', 'É calculada na aba Custos: horas da visita, combustível pela distância e refeição.'],
        ['Ficou uma visita fora do pedido de ajuda de custo. E agora?', 'A pessoa faz um <b>pedido complementar</b> do mesmo mês, só com as visitas que ficaram de fora. Ele aparece na lista com a palavra "complementar" e passa pelo mesmo aval. A bolsa continua sendo um pedido só por mês.'],
      ]
    },
    custos: {
      t: 'Custos',
      intro: 'Cálculo da ajuda de custo de cada visita e planejamento do orçamento de campo do projeto.',
      tarefas: [
        ['Conferir o km de uma visita', ['Em <b>Pagamento do mês</b>, escolha o mês com ‹ ›.', 'Na linha da visita, digite o <b>Km conferido</b> (só a ida).', 'Saia do campo: salva sozinho e o valor da visita muda na hora.']],
        ['Mudar os valores usados', ['Abra <b>Valores usados</b>.', 'Ajuste hora, horas por etapa, consumo, gasolina ou refeição.', 'Toque em <b>Salvar</b>.']],
        ['Ver se o projeto cabe no orçamento', ['Toque em <b>Proposta de roteiro</b>.', 'Veja o custo projetado e, em <b>Caber no orçamento</b>, quanto cada medida economiza.']]
      ],
      passos: [
        'Cada visita vale: horas da etapa × valor da hora + combustível (ida e volta, pela distância até o quintal) + refeição.',
        'Em <b>Valores usados</b> a coordenação ajusta valor da hora, horas por etapa, consumo do carro, preço da gasolina, refeição e o teto do projeto. Toda mudança fica no histórico.',
        'Onde a distância estimada estiver errada, informe o <b>km conferido</b> da visita antes de dar o aval.',
        'A <b>Proposta de roteiro</b> estima quem visita cada quintal e o custo do projeto inteiro; <b>Caber no orçamento</b> mostra quanto cada medida economiza para ficar dentro do teto.'
      ],
      duvidas: [
        ['Por que o custo projetado é alto?', 'Quintais longe de quem visita pesam no combustível. A medida que mais economiza é ter agentes morando nos municípios distantes.']
      ]
    },
    viagens: {
      t: 'Viagens e eventos',
      intro: 'Pedidos de passagem aérea (intercâmbio e acompanhamento pedagógico) e de estrutura de evento, feitos pela bolsista de articulação estadual. A FUNCERN só compra ou contrata depois da autorização.',
      tarefas: [
        ['Conferir um pedido (coordenação técnica; sem ela, o auxiliar administrativo)', ['Em <b>Esperando a sua conferência</b>, abra o pedido.', 'Confira nomes iguais ao documento, CPF, RG, datas e quantidades.', 'Toque em <b>Conferido</b>, ou escreva o que corrigir e toque em <b>Devolver para correção</b>.']],
        ['Autorizar e mandar à FUNCERN (coordenação geral)', ['Em <b>Esperando a sua autorização</b>, abra o pedido.', 'Se já tiver, digite o protocolo da FUNCERN.', 'Toque em <b>Autorizar</b> (ou devolva, ou recuse com o motivo).', 'Toque em <b>Copiar texto</b> e cole no e-mail ou sistema da FUNCERN.']]
      ],
      passos: [
        'A bolsista de articulação estadual envia o pedido. Ele aparece para a <b>coordenação técnica</b> em "Esperando a sua conferência".',
        'A coordenação técnica confere os dados (nomes iguais ao documento, datas, CPF e RG, quantidades) e toca em <b>Conferido</b>, ou <b>Devolve</b> dizendo o que corrigir.',
        '<b>Sem coordenação técnica ativa</b>, quem confere é o <b>auxiliar administrativo</b> (na tela dele aparece "Passagens e eventos para conferir"). Sem os dois, a coordenação geral confere e autoriza, com aviso. Quando a técnica é cadastrada, volta tudo para ela.',
        'Cada pedido passa por <b>duas pessoas</b>: quem conferiu não autoriza o mesmo pedido.',
        'O pedido de passagem de <b>acompanhamento pedagógico</b> é diferente: só a <b>coordenação geral</b> confere e autoriza. Para a coordenação técnica ele aparece como "aguardando a coordenação geral".',
        'As passagens têm <b>dois tetos</b>, que não se misturam: R$ 70.000,00 para o intercâmbio e R$ 22.400,00 para o acompanhamento pedagógico. Os eventos têm R$ 6.000,00 por estado.',
        'A <b>coordenação geral</b> autoriza (ou devolve, ou recusa com o motivo). Depois de autorizar, use <b>Copiar texto</b> para mandar o pedido à FUNCERN e registre o protocolo.',
        'Prazos: passagem <b>40 dias</b> antes da viagem (a FUNCERN exige 30); evento <b>45 dias</b> antes. Fora do prazo, o pedido só vai com justificativa.',
        'Os contadores mostram quantas passagens já foram autorizadas (25 de intercâmbio e 8 de acompanhamento pedagógico, por pessoa) e quantos estados já têm evento (5).'
      ],
      duvidas: [
        ['Quem vê os pedidos?', 'Só quem pediu, a coordenação técnica e a coordenação geral (e o auxiliar administrativo, só enquanto estiver conferindo no lugar da técnica). Os dados das passageiras (CPF, RG, nascimento) não vão para o histórico.'],
        ['Pode dividir o almoço em vários pedidos?', 'Não. Um serviço, um pedido: dividir o mesmo serviço é proibido e pode anular a compra. Serviços diferentes (alimentação, tenda, som) podem ir separados.'],
        ['Por que o auxiliar não dá aval nos pagamentos?', 'Porque é ele quem lança no Arlo: se também desse o aval, uma pessoa só aprovaria e lançaria. Sem coordenação técnica, o aval dos pagamentos é da coordenação geral.'],
        ['E depois da viagem ou do evento?', 'Os cartões de embarque, a lista de presença e o relato ou relatório são entregues à coordenação técnica.']
      ]
    },
    execucao: {
      t: 'Execução',
      intro: 'Previsto × executado de cada rubrica do TED, com gráficos. O executado vem da planilha de gastos que você envia pelo menos uma vez por mês; o comprometido, do que o sistema já sabe e a planilha ainda não trouxe. Só a coordenação geral vê esta aba.',
      tarefas: [
        ['Enviar a planilha do mês', ['Toque em <b>Enviar planilha de gastos</b> e escolha o arquivo (.xlsx ou .csv).', 'Toque em <b>Ler a planilha</b> e confira a prévia: total, rubricas e linhas fora do orçamento.', 'Confira a data <b>Gastos até</b> e toque em <b>Enviar e usar esta planilha</b>.']],
        ['Preparar a planilha', ['Em <b>Enviar planilha de gastos</b>, toque em <b>Baixar o modelo</b> (abaixo do campo do arquivo).', 'Uma linha por pagamento (e por repasse do MDA), com o item escolhido na lista.', 'A planilha é o retrato completo: todos os gastos desde o início, não só os do mês. Não escreva linhas de total.']],
        ['Ler os gráficos', ['<b>Ritmo do gasto</b>: passe o mouse ou toque num mês para ver previsto, executado e recebido até ali.', '<b>Uso de cada rubrica</b>: a barra cheia é o executado; a clara, o comprometido; o traço vertical, o tempo de vigência já passado. Toque numa rubrica para ver os itens na tabela.']]
      ],
      passos: [
        '<b>Executado</b> é o que está na planilha mais recente. As anteriores ficam guardadas em <b>Planilhas enviadas</b>, marcadas como substituídas.',
        '<b>Comprometido</b> é o que já foi decidido e ainda não aparece na planilha: bolsa ou ajuda de custo com aval, ou lançada no Arlo depois da data da planilha; passagem e evento autorizados depois dessa data.',
        'O sistema entende planilhas de fora (da FUNCERN, por exemplo) se tiverem as colunas Item (ou Rubrica) e Valor. Linhas de total são ignoradas para não contar duas vezes.'
      ],
      duvidas: [
        ['Enviei a planilha errada.', 'Envie a certa: a mais nova é a que vale. A errada fica no histórico, marcada como substituída (nada se apaga).'],
        ['Apareceram linhas "fora do orçamento".', 'O nome do item na planilha não bate com nenhum item do orçamento. Corrija com o nome da aba Itens do modelo e envie de novo. Enquanto isso, o valor entra no total, fora das rubricas.'],
        ['A planilha é .xls ou .ods.', 'Abra no Excel ou LibreOffice e salve como .xlsx. O .xlsx é lido sem nenhum programa extra.'],
        ['Quem mais vê esta aba?', 'Ninguém. A aba, as planilhas e os arquivos são só da coordenação geral, no sistema e no banco.']
      ]
    },
    documentos: {
      t: 'Documentos',
      intro: 'Pasta de documentos do projeto (atas, ofícios, relatórios, listas de presença) e o relatório da ação, gerado com os dados do sistema. Só a coordenação geral vê esta aba.',
      tarefas: [
        ['Anexar um documento', ['Toque em <b>Anexar documento</b>.', 'Escolha o tipo, a data e escreva o título (o estado é opcional).', 'Escolha o arquivo: PDF, Word, planilha ou foto, até 20 MB.', 'Toque em <b>Anexar</b>.']],
        ['Abrir um documento', ['Toque no documento na lista.', 'Toque em <b>Abrir o arquivo</b>: ele abre numa aba nova por alguns minutos.']],
        ['Arquivar um documento errado', ['Abra o documento.', 'Em <b>Arquivar</b>, escreva o motivo.', 'Toque em <b>Arquivar</b>. Ele sai da lista, mas não é apagado.']],
        ['Gerar o relatório da ação', ['Toque em <b>Gerar relatório da ação</b>.', 'Escolha o período e, se quiser, um estado; toque em <b>Atualizar o relatório</b>.', 'Toque em <b>Imprimir</b> ou em <b>Baixar para o Word</b>.']]
      ],
      passos: [
        'O relatório junta equipe, seleção, campo, curso FIC, pagamentos, viagens e eventos e a lista de documentos do período, só com números: nenhum nome, CPF ou endereço das mulheres.',
        'Documento não é apagado: arquivado, continua em <b>Arquivados</b> e no histórico.'
      ],
      duvidas: [
        ['Quem mais vê os documentos?', 'Ninguém. A pasta e a lista são só da coordenação geral, no sistema e no banco.'],
        ['Anexei o arquivo errado.', 'Arquive com o motivo e anexe o certo. O arquivo de um documento não pode ser trocado.'],
        ['O relatório está com números zerados.', 'Ele conta só o que foi registrado no sistema dentro do período escolhido. Confira as datas de início e fim.']
      ]
    },
    historico: {
      t: 'Histórico',
      intro: 'Registro de tudo o que foi feito no sistema: quem cadastrou, alterou, aprovou, devolveu, desligou, gerou código de acesso, consultou conta bancária, e quando.',
      tarefas: [
        ['Achar um registro', ['Role pelos dias (Hoje, Ontem, datas).', 'No fim da lista, toque em "Ver … registros anteriores" para ir mais para trás.']],
        ['Ver quem entrou no sistema', ['No alto da aba, em <b>Últimos acessos</b>, cada pessoa aparece com a última entrada, o aparelho e a rede.', 'Embaixo aparece quem ainda não entrou.', 'Toque em "Ver entradas e saídas" para ver tudo, inclusive quem saiu por 15 minutos sem uso.', 'Na ficha de cada pessoa aparece o último acesso dela.']]
      ],
      passos: [
        'Os registros aparecem por dia (Hoje, Ontem, datas), do mais recente para o mais antigo. Os 12 últimos ficam à vista; os anteriores, no fim da lista.',
        'Ninguém consegue alterar ou apagar o histórico pelo sistema, nem a coordenação geral.'
      ],
      duvidas: [
        ['Para que serve?', 'Prestação de contas e auditoria (CGU, TCU): mostra quem fez cada ação e quando.'],
        ['Está vazio.', 'Ele começa a encher quando o sistema passa a ser usado: cada cadastro, aprovação ou pagamento vira um registro.'],
        ['Os acessos ficam guardados para sempre?', 'Não. Entradas e saídas ficam 6 meses e depois são apagadas sozinhas. O IP aparece pela metade: basta para ver se foi a mesma rede.'],
        ['Alguém abriu o sistema e não aparece.', 'Quem já estava logado conta uma vez por aba aberta. Sem internet nada é registrado.']
      ]
    },

    /* ---------- telas individuais ---------- */
    bolsista: {
      t: 'Sua tela (bolsista)',
      intro: 'Tudo o que você faz no estado: indicar as mulheres, registrar o trabalho de campo, acompanhar as entregas do mês e pedir os pagamentos.',
      tarefas: [
        ['Lançar a ficha de uma mulher', ['No topo, toque em <b>+ Nova ficha de mulher</b>.', 'Preencha os dados e os critérios com a mulher.', 'Fotografe a ficha e o termo assinado.', 'Toque em <b>Registrar localização</b> e depois em <b>Salvar</b>. Sem internet, ela sobe sozinha depois.']],
        ['Registrar diagnóstico ou visita', ['No topo, toque em <b>Visitas e diagnósticos</b>.', 'Em <b>Para fazer agora</b>, toque no botão da visita (<b>Registrar diagnóstico</b>, <b>Registrar visita feita</b> ou <b>Registrar avaliação</b>).', 'Faça as fotos, registre a localização e salve.']],
        ['Marcar a lista de presença', ['No topo, toque em <b>Entregas do mês</b>.', 'Na lista de presença, toque em <b>Entreguei</b>.']],
        ['Pedir a bolsa e a ajuda de custo', ['No topo, toque em <b>Pedir pagamento</b>.', 'Na ajuda de custo, marque as visitas feitas e toque em <b>Solicitar</b>.', 'Na bolsa, escreva o relatório do mês (pode usar <b>Falar</b>) e toque em <b>Solicitar bolsa</b>.']],
        ['Pedir passagem ou evento (só articulação estadual)', ['No topo, toque em <b>Passagem ou evento</b>.', 'Toque em <b>Pedir passagem aérea</b> (40 dias antes) ou <b>Pedir estrutura de evento</b> (45 dias antes).', 'Preencha tudo e toque em <b>Enviar</b> (vai para a coordenação técnica; sem ela, para o auxiliar administrativo).', 'Se voltar devolvido, abra, leia o motivo, toque em <b>Corrigir e reenviar</b>.']]
      ],
      passos: [
        'Na primeira vez, leia os pontos importantes do Guia e toque em <b>Li e entendi</b>.',
        'Se aparecer <b>pendências no seu cadastro</b>, resolva primeiro: sem elas a FUNCERN não paga.',
        'Os botões de <b>O que você quer fazer?</b>, no topo, levam direto a cada parte da tela.',
        '<b>Diagnóstico:</b> 3 fotos (visão geral, água e plantio), localização e o kit com o preço de cada item, sem passar de R$ 5.000.',
        '<b>Localização do diagnóstico:</b> registre em pé, no quintal, durante a visita (o ponto da ficha não vale). Sem localização, escolha o motivo e explique com suas palavras: a coordenação só aprova depois de confirmar a visita de outro jeito.',
        'As <b>Entregas do mês</b> (fotos, lista de presença, relatório, fichas, AVA e metas) liberam a bolsa do mês.'
      ],
      duvidas: [
        ['Posso falar em vez de digitar?', 'Sim. Nos campos de texto, toque em Falar e fale; o texto vai aparecendo. Revise antes de salvar. Evite dizer nomes e CPF. Precisa de internet.'],
        ['Prefiro aplicar no papel.', 'Abra o formulário (ficha, diagnóstico, registro de visita ou avaliação) e toque em <b>Imprimir em branco</b>, no alto. A folha sai com o símbolo do projeto e os seus dados de quem aplica já preenchidos. Depois, lance as respostas no sistema: o papel não substitui o registro.'],
        ['Estou sem internet no campo.', 'Pode preencher fichas, diagnósticos, visitas e avaliações. Ficam guardados no celular e sobem quando a internet voltar ("Enviar agora"). Não toque em Sair enquanto estiver sem sinal. Sem internet o sistema não sai sozinho; ele só sai depois de 15 minutos sem uso quando o sinal voltar.'],
        ['A localização foi negada.', 'Libere a localização para o site nas permissões do navegador (cadeado ao lado do endereço) e tente de novo. Se não der, escolha o motivo e explique com suas palavras (pelo menos 15 letras).'],
        ['Posso corrigir uma ficha aprovada?', 'Não. Peça à coordenação técnica para devolvê-la.'],
        ['Uma entrega está com "!".', 'Ainda falta. Veja a linha de baixo: ela diz o que fazer. Sem as entregas, a bolsa do mês não é paga.']
      ]
    },
    agente: {
      t: 'Sua tela (agente de campo)',
      intro: 'As visitas atribuídas a você, os registros de cada uma e o pedido da ajuda de custo.',
      tarefas: [
        ['Registrar uma visita', ['No topo, toque em <b>Minhas próximas visitas</b>.', 'Toque no botão da visita (<b>Registrar diagnóstico</b>, <b>Registrar visita feita</b> ou <b>Registrar avaliação</b>).', 'Faça as fotos, registre a localização e salve. Sem internet, sobe depois.']],
        ['Pedir a ajuda de custo', ['No topo, toque em <b>Pedir ajuda de custo</b>.', 'Marque as visitas feitas no mês.', 'Toque em <b>Solicitar</b>.']]
      ],
      passos: [
        'Na primeira vez, leia como funciona para a agente e toque em <b>Li e entendi</b>.',
        'Quem agenda as visitas é a bolsista do estado ou a coordenação técnica. Registre cada visita no mesmo dia, com fotos e localização.'
      ],
      duvidas: [
        ['Não aparece nenhuma visita.', 'Você só vê os quintais atribuídos a você, e só depois de habilitada (FIC, Arlo e termo).'],
        ['Posso mudar a data da visita?', 'Não. Fale com a bolsista do estado para reagendar.'],
        ['Estou sem internet no quintal.', 'Pode registrar. Fica guardado no celular e sobe quando a internet voltar. Não saia do sistema enquanto estiver sem sinal.'],
        ['Cuidado com os dados.', 'Os dados das mulheres são protegidos pela LGPD: não fotografe telas nem repasse informações.']
      ]
    },
    guia_bolsista: {
      t: 'Guia das bolsistas',
      intro: 'O essencial do Guia das bolsistas do projeto Mulheres & Quintais: o que cada uma faz, como começar, como é o pagamento e o que entregar todo mês.',
      secoes: [
        ['O que cada uma faz', [
          '<b>Coordenação técnica:</b> planeja, coordena e acompanha a execução técnica nos 5 estados, articula a equipe e garante o cumprimento do cronograma e das metas.',
          '<b>Articulação estadual:</b> mobiliza as comunidades, organiza as atividades, acompanha as metas e elabora registros e relatórios.',
          '<b>Apoio estadual:</b> cuida da logística, da coleta e organização das informações, dos registros das ações e do monitoramento.']],
        ['Passo a passo para começar', [
          '<b>Enviar os dados:</b> nome completo, CPF e e-mail, repassados pela coordenação técnica.',
          '<b>Matrícula no curso FIC:</b> os professores do FIC fazem a matrícula e enviam o acesso ao AVA e a declaração de matrícula. A bolsa só pode ser paga a estudantes do IFRN, por isso o curso.',
          '<b>Cadastro na FUNCERN:</b> entregue os documentos pedidos pela fundação, com conta bancária ou chave Pix no seu nome (informe em <b>Meus dados</b>, no alto da tela).',
          '<b>Início das atividades:</b> com matrícula e cadastro prontos, a bolsa conta a partir do início da execução do projeto.']],
        ['Como é o pagamento', [
          'A bolsa é paga uma vez por mês, pela FUNCERN, por depósito na conta ou chave Pix da própria bolsista.',
          'O pagamento segue um calendário mensal de entregas, combinado entre a coordenação do projeto e a coordenação técnica.',
          'Cada mês só é pago depois que as entregas daquele mês forem apresentadas e conferidas.',
          'A data de pagamento de cada mês é informada pela coordenação do projeto.']],
        ['O que entregar todo mês', [
          '<b>Fotos</b> de cada visita, oficina e atividade realizada.',
          '<b>Lista de presença</b> assinada em toda atividade coletiva.',
          '<b>Relatório:</b> o que foi feito no mês e o que ficou pendente (vai junto com o pedido da bolsa).',
          '<b>Ficha do quintal:</b> uma por mulher atendida, atualizada a cada visita.',
          '<b>Acesso ao AVA:</b> entrar no curso pelo menos uma vez por mês e fazer as atividades (o professor confirma).',
          '<b>Metas do mês:</b> andamento do que estava previsto no calendário.',
          'Acompanhe tudo no cartão <b>Entregas do mês</b>, na sua tela.']],
        ['Importante', [
          'A bolsa não gera vínculo empregatício com o IFRN, a FUNCERN ou o MDA.',
          'Sem as comprovações do mês, o pagamento não pode ser feito, porque o projeto presta contas ao MDA.',
          'A matrícula no curso precisa ficar ativa durante todo o período da bolsa.',
          'Se você já recebe outra bolsa, avise a coordenação antes de se cadastrar.']],
        ['Com quem falar', [
          'Fale primeiro com a <b>coordenação técnica</b> do projeto.',
          'Se ela não puder resolver: <b>coordenação geral</b> para questões gerais do projeto; <b>professores do FIC</b> para matrícula, curso e acesso ao AVA; <b>auxiliar administrativo</b> para documentos, conta ou Pix e pagamento.']]
      ],
      rodape: 'Realização: Subsecretaria de Mulheres Rurais · IFRN · FUNCERN'
    },
    guia_agente: {
      t: 'Guia da agente de campo',
      intro: 'Como funciona o trabalho da agente de campo no projeto Mulheres & Quintais.',
      secoes: [
        ['O que você faz', [
          'Faz as visitas de diagnóstico, implantação, acompanhamento e avaliação nos quintais atribuídos a você.',
          'Quem agenda as visitas é a bolsista do estado ou a coordenação técnica.']],
        ['Antes da primeira visita paga', [
          '<b>Matrícula no curso FIC</b>, feita pelos professores do curso.',
          '<b>Cadastro na FUNCERN</b>, com conta bancária ou chave Pix no seu nome (informe em <b>Meus dados</b>).',
          '<b>Termo de compromisso</b>: baixe o modelo, preencha, assine e anexe em <b>Meus dados</b> (ou no aviso de pendências). O auxiliar administrativo confere.']],
        ['Como você recebe', [
          'Você não recebe bolsa: recebe <b>ajuda de custo</b> por dia de campo, calculada pela distância até os quintais.',
          'No fim do mês, peça a ajuda de custo das visitas feitas em <b>Solicitar pagamento</b>.',
          'A coordenação técnica confere e dá o aval; o pagamento é lançado na FUNCERN.']],
        ['Em cada visita', [
          'Registre no sistema no mesmo dia: fotos, localização e um relato curto do que foi feito.',
          'No diagnóstico: as 3 fotos (visão geral, água e plantio) e o kit com o preço de cada item, sem passar do valor por quintal.',
          'Sem internet, pode preencher: o registro fica guardado no aparelho e é enviado depois.']],
        ['Importante', [
          'A ajuda de custo não gera vínculo empregatício com o IFRN, a FUNCERN ou o MDA.',
          'Só é paga a visita registrada no sistema.',
          'Os dados das mulheres são protegidos por lei: não fotografe telas nem repasse informações.']],
        ['Com quem falar', [
          'Agenda das visitas: a <b>bolsista do estado</b>.',
          'Dúvidas do trabalho: a <b>coordenação técnica</b>.',
          'Curso e AVA: os <b>professores do FIC</b>. Documentos, conta ou Pix e pagamento: o <b>auxiliar administrativo</b>.']]
      ],
      rodape: 'Realização: Subsecretaria de Mulheres Rurais · IFRN · FUNCERN'
    },
    professor_fic: {
      t: 'Sua tela (professor do FIC)',
      intro: 'Turmas do curso FIC, matrículas da coordenação técnica, das bolsistas e das agentes de campo e a confirmação mensal do acesso ao AVA.',
      tarefas: [
        ['Matricular alunas', ['No topo, toque em <b>Matricular alunas</b>.', 'Na turma, toque em <b>+ Matricular</b> (se não houver turma, crie em <b>+ Nova turma</b>).', 'Marque as pessoas, digite o número do SUAP e toque em <b>Salvar</b>.']],
        ['Confirmar o AVA do mês', ['No topo, toque em <b>Confirmar acesso ao AVA</b>.', 'Marque quem acessou. Salva na hora.']]
      ],
      passos: [
        'Você pode matricular também nas turmas do outro professor.',
        'A matrícula registrada aqui completa o passo "matrícula no FIC" da habilitação da pessoa.',
        'O acesso ao AVA é uma das entregas que liberam a bolsa das bolsistas: marque todo mês.'
      ],
      duvidas: [
        ['Por que não vejo CPF nem telefone?', 'Você vê só o mínimo para matricular. Os demais dados são protegidos (LGPD).'],
        ['Esqueci de marcar o AVA de um mês.', 'Use ‹ para voltar ao mês e marque. Só não dá para marcar meses que ainda não começaram.']
      ]
    },
    auxiliar_adm: {
      t: 'Sua tela (auxiliar administrativo)',
      intro: 'Cadastro da equipe no Arlo (FUNCERN), registro do termo de compromisso e lançamento dos pagamentos no Arlo.',
      tarefas: [
        ['Registrar o cadastro no Arlo', ['No topo, toque em <b>Cadastrar no Arlo</b>.', 'Abra a pessoa e, se precisar, toque em <b>Ver conta e Pix</b>.', 'Cadastre no Arlo, volte e toque em <b>Registrar passos da habilitação</b> → <b>Hoje</b> → <b>Salvar</b>.']],
        ['Lançar um pagamento no Arlo', ['No topo, toque em <b>Lançar pagamentos no Arlo</b>.', 'Abra o pedido, lance o valor no Arlo e digite o protocolo.', 'Toque em <b>Registrar: lançado no Arlo</b>.']]
      ],
      passos: [
        'O termo é anexado pela própria pessoa, no cadastro dela. Quando chegar, abra a pessoa, toque em <b>Abrir o termo</b>, confira se está preenchido e assinado e só então registre a data em <b>Registrar passos da habilitação</b>. Sem o termo anexado, o sistema não aceita a data.',
        'Em <b>Pagamentos para lançar</b> ficam só os pedidos que já têm o aval da coordenação.'
      ],
      duvidas: [
        ['A consulta da conta bancária fica registrada?', 'Sim. Cada vez que você abre a conta de alguém, fica no histórico.'],
        ['Posso mudar dados pessoais de alguém?', 'Não. Isso é de quem cadastrou a pessoa. Você registra só Arlo e termo.'],
        ['Posso colocar uma data futura?', 'Não. Registre só o que já aconteceu.']
      ]
    }
  };

  const TOPICOS_COORD = ['visao', 'equipe', 'selecao', 'campo', 'fic', 'pagamentos', 'viagens', 'custos', 'execucao', 'documentos', 'historico'];

  function chaveAtual() {
    const s = S();
    if (!s.eu || s.verEntrada) return 'entrada';
    if (/^coord/.test(s.eu.papel)) {
      const pode = { coord_geral: TOPICOS_COORD, coord_tecnico: ['selecao', 'equipe', 'campo', 'pagamentos', 'viagens', 'custos'] }[s.eu.papel];
      return pode.includes(s.aba) ? s.aba : pode[0];
    }
    if (['articulacao', 'apoio'].includes(s.eu.papel)) return 'bolsista';
    return A[s.eu.papel] ? s.eu.papel : 'bolsista';
  }

  const guiaDe = k => k === 'bolsista' ? 'guia_bolsista' : k === 'agente' ? 'guia_agente' : null;
  function painel(p) {
    const k = p.k && A[p.k] ? p.k : chaveAtual(); const a = A[k];
    const s = S(); const coord = s.eu && /^coord/.test(s.eu.papel) && !s.verEntrada;
    const outros = coord ? TOPICOS_COORD.filter(x => x !== k && (s.eu.papel === 'coord_geral' || ['selecao', 'equipe', 'campo', 'pagamentos', 'viagens', 'custos'].includes(x))) : [];
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Ajuda</span><h2 id="painel-t">${E(a.t)}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo ajuda">
        <p class="ajuda-intro">${a.intro}</p>
        ${a.contato ? `<p class="ajuda-contato"><span>Não conseguiu entrar? Fale com a ${E(a.contato.nome)}:</span> <a class="btn pri" href="https://wa.me/${a.contato.wa}" target="_blank" rel="noopener">WhatsApp ${E(a.contato.tel)}</a></p>` : ''}
        ${a.tarefas && a.tarefas.length ? `<h3>Passo a passo</h3><div class="ajuda-duvidas ajuda-tarefas">${a.tarefas.map(([t, ps], i) => `<details ${i === 0 ? 'open' : ''}><summary>${E(t)}</summary><ol class="ajuda-passos">${ps.map(x => `<li>${x}</li>`).join('')}</ol></details>`).join('')}</div>` : ''}
        ${a.passos && a.passos.length ? `<h3>${a.tarefas ? 'Como funciona' : 'Como fazer'}</h3>
        <ol class="ajuda-passos">${a.passos.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
        ${(a.secoes || []).map(([h, l]) => `<h3>${E(h)}</h3><ul class="ajuda-lista">${l.map(x => `<li>${x}</li>`).join('')}</ul>`).join('')}
        ${guiaDe(k) ? `<button type="button" class="cad-modo cad-modo-2" data-acao="ajuda" data-k="${guiaDe(k)}"><b>${E(A[guiaDe(k)].t)}</b><span>Pagamento, entregas do mês, o que é importante e com quem falar.</span></button>` : ''}
        ${a.duvidas && a.duvidas.length ? `<h3>Dúvidas comuns</h3><div class="ajuda-duvidas">${a.duvidas.map(([q, r]) => `<details><summary>${E(q)}</summary><p>${E(r)}</p></details>`).join('')}</div>` : ''}
        ${k !== 'entrada' && s.eu && MQ.roteiroUI && MQ.roteiroUI.grupoDe(s.eu.papel) ? `<button type="button" class="cad-modo cad-modo-2" data-acao="rot-abrir"><b>${s.eu.papel === 'coord_geral' ? 'Teste do sistema' : 'Ajudar a testar o sistema'}</b><span>${s.eu.papel === 'coord_geral' ? 'Seu roteiro, convites para a equipe e resultados de todos.' : 'Tarefas curtas do seu perfil, uma de cada vez: você diz se deu certo.'}</span></button>` : ''}
        ${k !== 'geral' && k !== 'entrada' ? `<button type="button" class="cad-modo cad-modo-2" data-acao="ajuda" data-k="geral"><b>Dicas para usar o sistema</b><span>Falar em vez de digitar, uso sem internet, Meus dados e proteção dos dados.</span></button>` : ''}
        ${outros.length ? `<h3>Ajuda de outras seções</h3><div class="ajuda-outros">${outros.map(x => `<button type="button" class="btn peq" data-acao="ajuda" data-k="${x}">${E(A[x].t)}</button>`).join('')}</div>` : ''}
        ${a.rodape ? `<p class="small muted ajuda-real">${E(a.rodape)}</p>` : ''}
        <p class="small muted">Não achou a resposta? Fale com ${s.eu && ['articulacao', 'apoio', 'agente'].includes(s.eu.papel) ? 'a coordenação técnica' : 'a coordenação geral'}.</p>
      </div>`;
  }

  MQ.ajudaUI = { painel, chaveAtual, A };
})();
