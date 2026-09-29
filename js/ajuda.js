/* Mulheres & Quintais — ajuda de cada tela: para que serve, como fazer e dúvidas comuns.
   Abre pelo botão "?" da barra (e pelo link "Precisa de ajuda?" na tela de entrada). */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);

  const A = {
    entrada: {
      t: 'Como entrar no sistema',
      intro: 'Só entra quem foi cadastrado pela coordenação, com o e-mail que ela registrou. O sistema não manda e-mail: as instruções chegam pelo WhatsApp, com um código de acesso.',
      passos: [
        '<b>Primeira vez:</b> toque em <b>Primeiro acesso</b>, digite o e-mail cadastrado e o <b>código de acesso</b> (8 letras e números, como ABCD-2345) que veio na mensagem da coordenação. Depois crie uma senha com pelo menos 8 caracteres, misturando letras e números.',
        '<b>Das próximas vezes:</b> use <b>Já tenho senha</b>, com o mesmo e-mail e a senha que você criou.',
        'Abra no <b>Chrome</b> (Android) ou no <b>Safari</b> (iPhone). Dentro do WhatsApp ou do Instagram algumas funções, como localização e fotos, não funcionam.',
        'Para usar como aplicativo: no menu do navegador, toque em <b>Adicionar à tela inicial</b>. Assim ele também funciona no campo sem internet.'
      ],
      duvidas: [
        ['Aparece "confira o e-mail e o código de acesso".', 'O e-mail tem de ser exatamente o do cadastro (confira pontos e o final @gmail.com, @ifrn.edu.br…). O código vale 7 dias e uma vez só. Se venceu ou se perdeu, peça um novo a quem cadastrou você.'],
        ['Aparece "Este e-mail já tem senha".', 'Você já fez o primeiro acesso. Use "Já tenho senha".'],
        ['Esqueci a senha.', 'Peça à coordenação geral para liberar um novo primeiro acesso. Ela manda um código novo; entre em "Primeiro acesso" e crie outra senha. Seus dados não se perdem.'],
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
          'Não saia do sistema sem internet: para entrar de novo é preciso conexão.',
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
      passos: [
        'A linha de 13 quadradinhos mostra os meses do projeto; o quadrado colorido é o mês atual. Ao lado, quantos dias faltam para o fim da vigência.',
        'Os <b>avisos</b> vêm por ordem de urgência (crítico, atenção, informação). Toque no aviso para ir direto à aba que resolve.',
        'O cartão <b>Ponto de partida</b> (e, depois das avaliações, <b>hoje</b>) compara a linha de base do diagnóstico com a avaliação final (fome, renda do quintal, consumo, venda, autonomia). Só entra quem já tem as duas medidas.',
        '<b>Financeiro e entregas</b> abre o painel de recursos, rubricas e metas físicas. Só a coordenação geral vê esse botão.'
      ],
      duvidas: [
        ['Os números estão zerados.', 'Eles só contam registros reais. Dados de teste (exemplo) ficam de fora dos números e da vitrine.'],
        ['Qual a diferença entre "na equipe" e "habilitadas"?', 'Na equipe é quem está cadastrado e ativo. Habilitada é quem completou os passos para receber: matrícula no FIC (bolsistas e agentes), cadastro no Arlo e termo de compromisso.']
      ]
    },
    equipe: {
      t: 'Equipe',
      intro: 'Cadastro de todas as pessoas do projeto: coordenação técnica, auxiliar administrativo, professores do FIC, bolsistas por estado e agentes de campo.',
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
        ['A pessoa esqueceu a senha.', 'Só a coordenação geral resolve: na ficha dela, "Liberar novo primeiro acesso" (confirme). A senha antiga é apagada e sai um código novo; os dados não mudam.'],
        ['Errei o CPF.', 'CPF e estado não mudam depois de salvos. Desligue o cadastro errado e faça um novo.'],
        ['A pessoa já tem cadastro no Arlo.', 'Marque "Sim" na pergunta do Arlo: só os dados básicos são pedidos (e a cidade, para quem vai a campo).'],
        ['O CEP não preencheu a rua.', 'Em muitas cidades pequenas o CEP é um só para a cidade toda. O sistema preenche cidade e estado; digite a rua, o sítio ou a comunidade.']
      ]
    },
    selecao: {
      t: 'Seleção das mulheres',
      intro: 'Cada mulher indicada pela comunidade tem uma ficha de indicação, preenchida pela bolsista do estado, com os critérios do edital e o termo de consentimento. Aqui a coordenação aprova ou devolve.',
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
      passos: [
        'A tabela mostra, por estado, os dias de campo feitos e previstos, diagnósticos, planos aprovados, casos sem água e agentes.',
        'Em <b>Planos para você aprovar</b>, abra o diagnóstico, confira as fotos, o kit (itens da lista aprovada, com preço, até o valor por quintal) e o cronograma, e <b>aprove</b> ou <b>devolva</b>.',
        '<b>Investimento nos quintais</b> mostra o valor do kit por quintal (R$ 4.500,00, fixado no plano de trabalho) e a soma projetada pelos planos.',
        'O <b>roteiro</b> lista cada visita: data, quem vai e a situação, com o botão do que fazer. Visitas vencidas aparecem como atrasadas.',
        '<b>Impacto: antes × depois</b> compara o diagnóstico com a avaliação final de cada quintal.'
      ],
      duvidas: [
        ['Por que não consigo agendar a visita para uma agente?', 'Quem visita precisa estar habilitada (FIC, Arlo e termo); senão a visita não pode ser paga.'],
        ['O que conta como dia de campo?', 'Cada visita feita a um quintal é 1 dia de campo de quem visitou, e é a base da ajuda de custo.'],
        ['Um plano passou de R$ 4.500.', 'O sistema não deixa salvar acima do valor. Se aparecer acima, devolva pedindo para tirar ou trocar itens.']
      ]
    },
    fic: {
      t: 'Curso FIC',
      intro: 'Turmas do curso FIC do IFRN, matrículas das bolsistas e agentes e o acesso mensal ao AVA. A matrícula é um dos passos da habilitação; o acesso ao AVA é uma das entregas do mês das bolsistas.',
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
      passos: [
        'Em <b>Esperando o seu aval</b>, abra o pedido e confira: na ajuda de custo, as visitas e o km; na bolsa, o relatório e as <b>entregas do mês</b> (fotos, lista de presença, fichas, AVA e metas).',
        'Toque em <b>Dar aval</b> ou <b>Devolver</b>, dizendo o que corrigir.',
        'Quem dá o aval: a coordenação técnica, para ajuda de custo e bolsa das bolsistas; a coordenação geral, para a bolsa da coordenação técnica, dos professores e do auxiliar.',
        'Com o aval, o pedido vai para o auxiliar, que lança no Arlo e registra o protocolo.'
      ],
      duvidas: [
        ['Uma visita pode entrar em dois pedidos?', 'Não. Depois de pedida, a visita fica travada (data, pessoa e situação) até o pedido ser devolvido.'],
        ['A lista de presença está marcada, mas não vi o papel.', 'A marcação é a bolsista quem faz. Confira as listas assinadas antes de dar o aval.'],
        ['Quanto é a ajuda de custo?', 'É calculada na aba Custos: horas da visita, combustível pela distância e refeição.']
      ]
    },
    custos: {
      t: 'Custos',
      intro: 'Cálculo da ajuda de custo de cada visita e planejamento do orçamento de campo do projeto.',
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
      intro: 'Pedidos de passagem aérea (intercâmbio e acompanhamento pedagógico) e de estrutura de evento, feitos pela bolsista de articulação territorial. A FUNCERN só compra ou contrata depois da autorização.',
      passos: [
        'A bolsista de articulação territorial envia o pedido. Ele aparece para a <b>coordenação técnica</b> em "Esperando a sua conferência".',
        'A coordenação técnica confere os dados (nomes iguais ao documento, datas, CPF e RG, quantidades) e toca em <b>Conferido</b>, ou <b>Devolve</b> dizendo o que corrigir.',
        'A <b>coordenação geral</b> autoriza (ou devolve, ou recusa com o motivo). Depois de autorizar, use <b>Copiar texto</b> para mandar o pedido à FUNCERN e registre o protocolo.',
        'Prazos: passagem <b>40 dias</b> antes da viagem (a FUNCERN exige 30); evento <b>45 dias</b> antes. Fora do prazo, o pedido só vai com justificativa.',
        'Os contadores mostram quantas passagens já foram autorizadas (25 de intercâmbio e 8 de acompanhamento pedagógico, por pessoa) e quantos estados já têm evento (5).'
      ],
      duvidas: [
        ['Quem vê os pedidos?', 'Só quem pediu, a coordenação técnica e a coordenação geral. Os dados das passageiras (CPF, RG, nascimento) não vão para o histórico.'],
        ['Pode dividir o almoço em vários pedidos?', 'Não. Um serviço, um pedido: dividir o mesmo serviço é proibido e pode anular a compra. Serviços diferentes (alimentação, tenda, som) podem ir separados.'],
        ['E depois da viagem ou do evento?', 'Os cartões de embarque, a lista de presença e o relato ou relatório são entregues à coordenação técnica.']
      ]
    },
    historico: {
      t: 'Histórico',
      intro: 'Registro de tudo o que foi feito no sistema: quem cadastrou, alterou, aprovou, devolveu, desligou, gerou código de acesso, consultou conta bancária, e quando.',
      passos: [
        'Os registros aparecem por dia (Hoje, Ontem, datas), do mais recente para o mais antigo. Os 12 últimos ficam à vista; os anteriores, em <b>Ver registros anteriores</b>.',
        'Ninguém consegue alterar ou apagar o histórico pelo sistema, nem a coordenação geral.'
      ],
      duvidas: [
        ['Para que serve?', 'Prestação de contas e auditoria (CGU, TCU): mostra quem fez cada ação e quando.'],
        ['Está vazio.', 'Ele começa a encher quando o sistema passa a ser usado: cada cadastro, aprovação ou pagamento vira um registro.']
      ]
    },

    /* ---------- telas individuais ---------- */
    bolsista: {
      t: 'Sua tela (bolsista)',
      intro: 'Tudo o que você faz no estado: indicar as mulheres, registrar o trabalho de campo, acompanhar as entregas do mês e pedir os pagamentos.',
      passos: [
        'Leia os pontos importantes do Guia e toque em <b>Li e entendi</b> (aparece uma vez só).',
        'Se aparecer <b>pendências no seu cadastro</b>, resolva primeiro: sem elas a FUNCERN não paga.',
        '<b>Seleção das mulheres:</b> toque em <b>+ Nova ficha</b> quando estiver com a mulher indicada. Fichas devolvidas aparecem em "Para corrigir".',
        '<b>Trabalho de campo:</b> em <b>Para fazer agora</b> estão as visitas atrasadas, as dos próximos 7 dias e os planos devolvidos, cada um com o botão da ação.',
        '<b>Diagnóstico:</b> faça as 3 fotos (visão geral, água e plantio), registre a localização e monte o kit com o preço de cada item, sem passar de R$ 4.500.',
        '<b>Entregas do mês:</b> acompanhe as 6 entregas. Quando entregar as listas de presença, toque em <b>Entreguei</b>. O acesso ao AVA é o professor quem confirma.',
        '<b>Solicitar pagamento:</b> uma vez por mês, peça a ajuda de custo das visitas feitas e a bolsa, com o relatório de atividades.',
        '<b>Passagens aéreas e eventos</b> (só a bolsista de articulação territorial): peça a passagem 40 dias antes da viagem e a estrutura do evento 45 dias antes. A coordenação técnica confere e a coordenação geral autoriza e manda para a FUNCERN.'
      ],
      duvidas: [
        ['Posso falar em vez de digitar?', 'Sim. Nos campos de texto, toque em Falar e fale; o texto vai aparecendo. Revise antes de salvar. Evite dizer nomes e CPF. Precisa de internet.'],
        ['Estou sem internet no campo.', 'Pode preencher fichas, diagnósticos, visitas e avaliações. Ficam guardados no celular e sobem quando a internet voltar ("Enviar agora"). Não saia do sistema enquanto estiver sem sinal.'],
        ['A localização foi negada.', 'Libere a localização para o site nas permissões do navegador (cadeado ao lado do endereço) e tente de novo. Se não der, explique no campo indicado.'],
        ['Posso corrigir uma ficha aprovada?', 'Não. Peça à coordenação técnica para devolvê-la.'],
        ['Uma entrega está com "!".', 'Ainda falta. Veja a linha de baixo: ela diz o que fazer. Sem as entregas, a bolsa do mês não é paga.']
      ]
    },
    agente: {
      t: 'Sua tela (agente de campo)',
      intro: 'As visitas atribuídas a você, os registros de cada uma e o pedido da ajuda de custo.',
      passos: [
        'Leia como funciona para a agente e toque em <b>Li e entendi</b> (aparece uma vez só).',
        'Em <b>Próximas visitas</b> estão os quintais e as datas. Quem agenda é a bolsista do estado ou a coordenação técnica.',
        'Na visita, toque no botão da ação: <b>Registrar diagnóstico</b>, <b>Registrar visita feita</b> ou <b>Registrar avaliação</b>. Registre no mesmo dia, com fotos e localização.',
        'No fim do mês, peça a ajuda de custo das visitas feitas em <b>Solicitar pagamento</b>.'
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
          'Se ela não puder resolver: <b>coordenação geral</b> para questões gerais do projeto; <b>professores do FIC</b> para matrícula, curso e acesso ao AVA; <b>apoio administrativo</b> para documentos, conta ou Pix e pagamento.']]
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
          '<b>Termo de compromisso</b> assinado.']],
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
          'Curso e AVA: os <b>professores do FIC</b>. Documentos, conta ou Pix e pagamento: o <b>apoio administrativo</b>.']]
      ],
      rodape: 'Realização: Subsecretaria de Mulheres Rurais · IFRN · FUNCERN'
    },
    professor_fic: {
      t: 'Sua tela (professor do FIC)',
      intro: 'Turmas do curso FIC, matrículas das bolsistas e agentes de campo e a confirmação mensal do acesso ao AVA.',
      passos: [
        'Toque em <b>+ Nova turma</b> para criar a sua turma.',
        'Matricule as pessoas com o número da matrícula no SUAP e a data. Você pode matricular também nas turmas do outro professor.',
        'A matrícula registrada aqui completa o passo "matrícula no FIC" da habilitação da pessoa.',
        'Todo mês, em <b>Acesso ao AVA no mês</b>, marque quem entrou no curso e fez as atividades. É uma das entregas que liberam a bolsa das bolsistas.'
      ],
      duvidas: [
        ['Por que não vejo CPF nem telefone?', 'Você vê só o mínimo para matricular. Os demais dados são protegidos (LGPD).'],
        ['Esqueci de marcar o AVA de um mês.', 'Use ‹ para voltar ao mês e marque. Só não dá para marcar meses que ainda não começaram.']
      ]
    },
    auxiliar_adm: {
      t: 'Sua tela (auxiliar administrativo)',
      intro: 'Cadastro da equipe no Arlo (FUNCERN), registro do termo de compromisso e lançamento dos pagamentos no Arlo.',
      passos: [
        '<b>Falta cadastrar no Arlo:</b> abra a pessoa, veja os dados (e a conta, se precisar), cadastre no Arlo e registre a data em <b>Registrar passos da habilitação</b>. O botão <b>Hoje</b> preenche a data do dia.',
        '<b>No Arlo, falta o termo:</b> quando a pessoa entregar o termo assinado, registre a data e anexe o arquivo.',
        '<b>Pagamentos para lançar:</b> pedidos que já têm aval. Lance no Arlo e registre o protocolo.'
      ],
      duvidas: [
        ['A consulta da conta bancária fica registrada?', 'Sim. Cada vez que você abre a conta de alguém, fica no histórico.'],
        ['Posso mudar dados pessoais de alguém?', 'Não. Isso é de quem cadastrou a pessoa. Você registra só Arlo e termo.'],
        ['Posso colocar uma data futura?', 'Não. Registre só o que já aconteceu.']
      ]
    }
  };

  const TOPICOS_COORD = ['visao', 'equipe', 'selecao', 'campo', 'fic', 'pagamentos', 'viagens', 'custos', 'historico'];

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
        ${a.passos && a.passos.length ? `<h3>Como fazer</h3>
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
