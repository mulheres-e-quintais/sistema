/* Mulheres & Quintais — ajuda de cada tela: para que serve, como fazer e dúvidas comuns.
   Abre pelo botão "?" da barra (e pelo link "Precisa de ajuda?" na tela de entrada). */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);

  const A = {
    entrada: {
      t: 'Como entrar no sistema',
      intro: 'O sistema é usado pela equipe do projeto. Só entra quem foi cadastrado pela coordenação, com o e-mail que ela registrou.',
      passos: [
        'Na primeira vez, toque em <b>Primeiro acesso</b>, use o e-mail cadastrado e o <b>código de acesso</b> que veio na mensagem da coordenação, e crie uma senha com pelo menos 8 caracteres, misturando letras e números.',
        'Das próximas vezes, use <b>Já tenho senha</b> com o mesmo e-mail e a senha que você criou.',
        'Abra o sistema no <b>Chrome</b> (Android) ou no <b>Safari</b> (iPhone). Dentro do WhatsApp ou do Instagram algumas funções, como a localização, não funcionam.',
        'Para usar como aplicativo: no menu do navegador, toque em <b>Adicionar à tela inicial</b>.'
      ],
      duvidas: [
        ['Aparece "Este e-mail não está cadastrado no projeto".', 'O e-mail digitado é diferente do que a coordenação cadastrou. Confira letras, pontos e o final (@gmail.com, @ifrn.edu.br…). Se estiver certo, fale com quem fez o seu cadastro.'],
        ['Aparece "Este e-mail já tem senha".', 'Você já fez o primeiro acesso. Use "Já tenho senha".'],
        ['Esqueci a senha.', 'Peça à coordenação geral para liberar um novo primeiro acesso. Ela manda um código novo; entre em "Primeiro acesso" e crie outra senha.'],
        ['O código não funciona.', 'O código vale 7 dias e uma vez só. Confira o e-mail (tem de ser o mesmo do cadastro). Se venceu ou perdeu, peça um novo a quem cadastrou você.'],
        ['Não recebi e-mail do sistema.', 'O sistema não manda e-mail. Quem cadastrou você manda o aviso de acesso por WhatsApp ou e-mail; basta seguir os passos acima.']
      ]
    },

    /* ---------- coordenação ---------- */
    visao: {
      t: 'Visão geral',
      intro: 'O retrato do projeto em uma tela: em que mês estamos, como está a equipe, a seleção das mulheres, o campo e os avisos que pedem atenção.',
      passos: [
        'A linha de 13 quadradinhos mostra os meses do projeto; o quadrado colorido é o mês atual.',
        'Os <b>avisos</b> vêm por ordem de urgência (crítico, atenção, informação). Toque no aviso para ir à aba que resolve.',
        'O cartão <b>Ponto de partida e hoje</b> compara a linha de base do diagnóstico com a avaliação final (fome, renda do quintal, consumo, venda, autonomia). Só entra quem já tem as duas medidas.',
        '<b>Financeiro e entregas</b> abre o painel de recursos, rubricas e metas físicas. Só a coordenação geral vê esse botão.'
      ],
      duvidas: [
        ['Os números estão zerados.', 'Eles só contam registros reais. Dados de teste (exemplo) ficam de fora da vitrine pública.'],
        ['Qual a diferença entre "na equipe" e "habilitadas"?', 'Na equipe é quem está cadastrado e ativo. Habilitada é quem completou os passos para receber: matrícula no FIC (bolsistas e agentes), cadastro no Arlo e termo de compromisso.']
      ]
    },
    equipe: {
      t: 'Equipe',
      intro: 'Cadastro de todas as pessoas do projeto, na ordem: coordenação técnica, auxiliar administrativo, professores do FIC, bolsistas por estado e agentes de campo.',
      passos: [
        'Para cadastrar, toque na vaga ou em <b>Cadastrar</b> e escolha: <b>Gerar link</b> (a pessoa preenche pelo celular e você aprova) ou <b>Cadastrar à mão</b>.',
        'Depois de salvar, abra a ficha da pessoa e use <b>Avisar o acesso</b> para mandar por WhatsApp ou e-mail as instruções de entrada. O sistema não manda e-mail sozinho.',
        'Cadastros enviados pelo link aparecem no topo, em <b>Cadastros enviados pelo link</b>. Confira, complete e salve para aprovar.',
        'Na ficha da pessoa você vê a <b>habilitação</b> (FIC, Arlo, termo). O auxiliar administrativo registra Arlo e termo; os professores registram a matrícula no FIC.',
        '<b>Desligar</b> não apaga o cadastro: a vaga fica livre para a substituta e o histórico guarda quem desligou, quando e por quê.'
      ],
      duvidas: [
        ['Quem cadastra quem?', 'A coordenação geral cadastra a coordenação técnica, os professores do FIC e o auxiliar. A coordenação técnica cadastra bolsistas e agentes. A coordenação geral também pode fazer tudo isso.'],
        ['Errei o CPF.', 'CPF e estado não mudam depois de salvos. Desligue o cadastro errado e faça um novo.'],
        ['A pessoa já tem cadastro no Arlo.', 'Marque "Sim" na pergunta do Arlo: só os dados básicos são pedidos (e a cidade, para quem vai a campo).'],
        ['É servidor federal.', 'Informe a matrícula SIAPE no cadastro.']
      ]
    },
    selecao: {
      t: 'Seleção das mulheres',
      intro: 'Cada mulher indicada pela comunidade tem uma ficha de indicação, preenchida pela bolsista do estado, com os critérios do edital e o termo de consentimento. Aqui a coordenação aprova ou devolve.',
      passos: [
        'A tabela mostra, por estado, quantas fichas foram lançadas e como estão: <b>selecionadas aprovadas</b> (as que ocupam as 40 vagas), <b>lista de espera</b>, <b>sem água</b> e <b>não atende</b>, e as que ainda <b>aguardam</b> decisão.',
        'Abra uma ficha aguardando, confira os dados e o termo assinado e escolha <b>Aprovar</b> ou <b>Devolver</b> (dizendo o que corrigir).',
        'Cada estado tem no máximo 40 selecionadas aprovadas. As demais vão para a lista de espera, por pontuação.'
      ],
      duvidas: [
        ['A soma da linha passa de 40.', 'As 40 são as vagas. Lista de espera, sem água e não atende também são fichas lançadas, mas não ocupam vaga.'],
        ['O que é "sem água"?', 'A água da casa não dura no período seco. Essa mulher não recebe o kit agora e é encaminhada a programa de cisternas; a vaga vai para a lista de espera.']
      ]
    },
    campo: {
      t: 'Campo',
      intro: 'Acompanhamento das visitas aos quintais: diagnóstico e plano, implantação, 2 acompanhamentos e avaliação final. São 5 visitas por quintal, até 200 dias de campo por estado.',
      passos: [
        'A tabela mostra, por estado, os dias de campo usados, diagnósticos, planos aprovados, casos sem água e agentes.',
        'Em <b>Planos para aprovar</b>, abra o diagnóstico, confira o kit (itens da lista aprovada, até o valor por quintal) e o cronograma, e <b>aprove</b> ou <b>devolva</b>.',
        'Em <b>Investimento nos quintais</b> fica o valor do kit por quintal (R$ 4.500,00, fixado no plano de trabalho) e a soma projetada pelos planos.',
        'O <b>roteiro do mês</b> lista cada visita: data, quem vai e a situação. Visitas vencidas aparecem como atrasadas.',
        '<b>Impacto: antes × depois</b> compara o diagnóstico com a avaliação final de cada quintal.'
      ],
      duvidas: [
        ['Por que a visita não pode ser agendada para uma agente?', 'Quem visita precisa estar habilitada (FIC, Arlo e termo); senão a visita não poderia ser paga.'],
        ['O que conta como dia de campo?', 'Cada visita a um quintal é 1 dia de campo de quem visitou, e é a base da ajuda de custo.']
      ]
    },
    fic: {
      t: 'Curso FIC',
      intro: 'Turmas do curso FIC do IFRN e matrículas das bolsistas e agentes. A matrícula registrada aqui é um dos passos da habilitação.',
      passos: [
        'Os professores do FIC criam as turmas e matriculam, em qualquer turma. A coordenação geral também pode.',
        'Para matricular: abra a turma, escolha a pessoa, informe o número da matrícula (SUAP) e a data.',
        'Turma de um estado só aceita gente daquele estado. Turma "vários estados" aceita todos.'
      ],
      duvidas: [
        ['Professor e auxiliar se matriculam?', 'Não. A habilitação deles é cadastro no Arlo e termo de compromisso.'],
        ['Matriculei errado.', 'Para corrigir número ou data, matricule de novo na mesma turma. Para trocar de turma, cancele antes (com motivo).']
      ]
    },
    pagamentos: {
      t: 'Pagamentos',
      intro: 'Pedidos de ajuda de custo (visitas de campo) e de bolsa mensal. O caminho é sempre: a pessoa pede → a coordenação dá o aval → o auxiliar lança no Arlo (FUNCERN).',
      passos: [
        'Em <b>Esperando o seu aval</b>, abra o pedido, confira as visitas ou o relatório do mês e <b>dê o aval</b> ou <b>devolva</b> dizendo o que corrigir.',
        'Quem dá o aval: a coordenação técnica, para ajuda de custo e bolsa das bolsistas; a coordenação geral, para a bolsa da coordenação técnica, dos professores e do auxiliar.',
        'Com o aval, o pedido vai para o auxiliar, que lança no Arlo e registra o protocolo.'
      ],
      duvidas: [
        ['Uma visita pode entrar em dois pedidos?', 'Não. Depois de pedida, a visita fica travada (data, pessoa e situação) até o pedido ser devolvido.'],
        ['Quanto é a ajuda de custo?', 'É calculada na aba Custos: horas da visita, combustível pela distância e refeição.']
      ]
    },
    custos: {
      t: 'Custos',
      intro: 'Cálculo da ajuda de custo de cada visita e planejamento do orçamento de campo do projeto.',
      passos: [
        'Cada visita vale: horas da etapa × valor da hora + combustível (ida e volta, pela distância até o quintal) + refeição.',
        'Em <b>Valores usados</b> a coordenação ajusta valor da hora, horas por etapa, consumo do carro, preço da gasolina, refeição e o teto do projeto. Toda mudança fica no histórico.',
        'Onde a distância estimada estiver errada, informe o <b>km conferido</b> da visita.',
        'A <b>Proposta de roteiro</b> estima quem visita cada quintal e o custo do projeto inteiro; o bloco <b>Caber no orçamento</b> mostra quanto cada medida economiza para ficar dentro do teto.'
      ],
      duvidas: [
        ['Por que o custo projetado é alto?', 'Quintais longe de quem visita pesam no combustível. A medida que mais economiza é ter agentes morando nos municípios distantes.']
      ]
    },
    historico: {
      t: 'Histórico',
      intro: 'Registro de tudo o que foi feito no sistema: quem cadastrou, alterou, aprovou, desligou, consultou conta bancária, e quando.',
      passos: ['Os registros mais recentes vêm primeiro. Ninguém consegue alterar ou apagar o histórico pelo sistema, nem a coordenação geral.'],
      duvidas: [['Para que serve?', 'Prestação de contas e auditoria (CGU, TCU): mostra quem fez cada ação e quando.']]
    },

    /* ---------- telas individuais ---------- */
    bolsista: {
      t: 'Sua tela (bolsista)',
      intro: 'Tudo o que você faz no estado: indicar as mulheres, registrar o trabalho de campo e pedir os pagamentos.',
      passos: [
        'Se aparecer <b>pendências no seu cadastro</b> no topo, resolva primeiro: sem elas a FUNCERN não paga.',
        '<b>Seleção das mulheres:</b> toque em <b>+ Nova ficha</b> quando estiver com a mulher indicada. Fichas devolvidas aparecem em "Para corrigir".',
        '<b>Trabalho de campo:</b> em <b>Para fazer agora</b> estão as visitas atrasadas, as dos próximos 7 dias e os planos devolvidos, cada um com o botão da ação.',
        '<b>Diagnóstico:</b> faça as 3 fotos (visão geral, água e plantio), registre a localização e monte o kit com o preço de cada item, sem passar de R$ 4.500.',
        '<b>Visita feita:</b> informe a data e conte em poucas linhas o que foi feito.',
        '<b>Solicitar pagamento:</b> uma vez por mês, peça a ajuda de custo das visitas feitas e a bolsa, com o relatório de atividades.'
      ],
      duvidas: [
        ['Estou sem internet no campo.', 'Pode preencher. O registro fica guardado no aparelho e é enviado quando a internet voltar ("Enviar agora").'],
        ['A localização foi negada.', 'Libere a localização para o site nas permissões do navegador (cadeado ao lado do endereço) e tente de novo. Se não der, explique no campo indicado.'],
        ['Posso corrigir uma ficha aprovada?', 'Não. Peça à coordenação técnica para devolvê-la.']
      ]
    },
    agente: {
      t: 'Sua tela (agente de campo)',
      intro: 'As visitas atribuídas a você, os registros de cada uma e o pedido da ajuda de custo.',
      passos: [
        'Em <b>Próximas visitas</b> estão os quintais e as datas. Quem agenda é a bolsista do estado ou a coordenação técnica.',
        'Na visita, toque no botão da ação: <b>Registrar diagnóstico</b>, <b>Registrar visita feita</b> ou <b>Registrar avaliação</b>.',
        'No fim do mês, peça a ajuda de custo das visitas feitas em <b>Solicitar pagamento</b>.'
      ],
      duvidas: [
        ['Não aparece nenhuma visita.', 'Você só vê os quintais atribuídos a você, e só depois de habilitada (FIC, Arlo e termo).'],
        ['Posso mudar a data da visita?', 'Não. Fale com a bolsista do estado para reagendar.'],
        ['Cuidado com os dados.', 'Os dados das mulheres são protegidos pela LGPD: não fotografe telas nem repasse informações.']
      ]
    },
    professor_fic: {
      t: 'Sua tela (professor do FIC)',
      intro: 'Turmas do curso FIC e matrículas das bolsistas e agentes de campo.',
      passos: [
        'Toque em <b>+ Nova turma</b> para criar a sua turma.',
        'Matricule as pessoas com o número da matrícula no SUAP e a data. Você pode matricular também nas turmas do outro professor.',
        'A matrícula registrada aqui completa o passo "matrícula no FIC" da habilitação da pessoa.'
      ],
      duvidas: [['Por que não vejo CPF nem telefone?', 'Você vê só o mínimo para matricular. Os demais dados são protegidos (LGPD).']]
    },
    auxiliar_adm: {
      t: 'Sua tela (auxiliar administrativo)',
      intro: 'Cadastro da equipe no Arlo (FUNCERN), registro do termo de compromisso e lançamento dos pagamentos no Arlo.',
      passos: [
        '<b>Falta cadastrar no Arlo:</b> abra a pessoa, veja os dados (e a conta, se precisar), cadastre no Arlo e registre a data em <b>Registrar passos da habilitação</b>.',
        '<b>No Arlo, falta o termo:</b> quando a pessoa entregar o termo assinado, registre a data e anexe o arquivo.',
        '<b>Pagamentos para lançar:</b> pedidos que já têm aval. Lance no Arlo e registre o protocolo.'
      ],
      duvidas: [
        ['A consulta da conta bancária fica registrada?', 'Sim. Cada vez que você abre a conta de alguém, fica no histórico.'],
        ['Posso mudar dados pessoais de alguém?', 'Não. Isso é de quem cadastrou a pessoa. Você registra só Arlo e termo.']
      ]
    }
  };

  const TOPICOS_COORD = ['visao', 'equipe', 'selecao', 'campo', 'fic', 'pagamentos', 'custos', 'historico'];

  function chaveAtual() {
    const s = S();
    if (!s.eu || s.verEntrada) return 'entrada';
    if (/^coord/.test(s.eu.papel)) {
      const pode = { coord_geral: TOPICOS_COORD, coord_tecnico: ['selecao', 'equipe', 'campo', 'pagamentos', 'custos'] }[s.eu.papel];
      return pode.includes(s.aba) ? s.aba : pode[0];
    }
    if (['articulacao', 'apoio'].includes(s.eu.papel)) return 'bolsista';
    return A[s.eu.papel] ? s.eu.papel : 'bolsista';
  }

  function painel(p) {
    const k = p.k && A[p.k] ? p.k : chaveAtual(); const a = A[k];
    const s = S(); const coord = s.eu && /^coord/.test(s.eu.papel) && !s.verEntrada;
    const outros = coord ? TOPICOS_COORD.filter(x => x !== k && (s.eu.papel === 'coord_geral' || ['selecao', 'equipe', 'campo', 'pagamentos', 'custos'].includes(x))) : [];
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Ajuda</span><h2 id="painel-t">${E(a.t)}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo ajuda">
        <p class="ajuda-intro">${a.intro}</p>
        <h3>Como fazer</h3>
        <ol class="ajuda-passos">${a.passos.map(x => `<li>${x}</li>`).join('')}</ol>
        ${a.duvidas && a.duvidas.length ? `<h3>Dúvidas comuns</h3><div class="ajuda-duvidas">${a.duvidas.map(([q, r]) => `<details><summary>${E(q)}</summary><p>${E(r)}</p></details>`).join('')}</div>` : ''}
        ${outros.length ? `<h3>Ajuda de outras seções</h3><div class="ajuda-outros">${outros.map(x => `<button type="button" class="btn peq" data-acao="ajuda" data-k="${x}">${E(A[x].t)}</button>`).join('')}</div>` : ''}
        <p class="small muted">Não achou a resposta? Fale com ${s.eu && ['articulacao', 'apoio', 'agente'].includes(s.eu.papel) ? 'a coordenação técnica' : 'a coordenação geral'}.</p>
      </div>`;
  }

  MQ.ajudaUI = { painel, chaveAtual, A };
})();
