from base import *
import novo
import os
PERFIS = {
 'geral': ('Coordenação geral', ['Coordenação geral e coordenação técnica', 'Professor(a) do curso FIC'], set(), 'Coordenacao_geral'),
 'tecnica': ('Coordenação técnica', ['Coordenação geral e coordenação técnica'], {'Visão geral', 'Curso FIC', 'Execução do orçamento', 'Documentos', 'Histórico'}, 'Coordenacao_tecnica'),
 'bolsista': ('Bolsista de articulação e de apoio', ['Bolsista de articulação e de apoio'], set(), 'Bolsista'),
 'agente': ('Agente de campo', ['Agente de campo'], set(), 'Agente_de_campo'),
 'professor': ('Professor(a) do curso FIC', ['Professor(a) do curso FIC'], set(), 'Professor_FIC'),
 'auxiliar': ('Auxiliar administrativo', ['Auxiliar administrativo'], set(), 'Auxiliar_administrativo'),
 'mda': ('Acompanhamento · MDA', ['Acompanhamento do projeto (MDA e MPA)'], {'A tela do MPA', 'A barra do alto e as abas', 'Meus dados e termo de compromisso', 'Usar no celular e sem internet', 'Símbolos dos botões'}, 'Acompanhamento_MDA'),
 'mpa': ('Acompanhamento · MPA', ['Acompanhamento do projeto (MDA e MPA)'], {'A tela do MDA', 'A barra do alto e as abas', 'Meus dados e termo de compromisso', 'Usar no celular e sem internet', 'Símbolos dos botões'}, 'Acompanhamento_MPA'),
}
PERFIL = os.environ.get('PERFIL', '')
COMUNS = ['Conheça o sistema', 'Primeiros passos', 'Dúvidas e solução de problemas', 'Glossário', 'Sobre este manual']
if PERFIL:
    ST['caps'] = set(COMUNS + PERFIS[PERFIL][1]); ST['semsec'] = PERFIS[PERFIL][2]
H = []
def A(x):
    if ST['on']: H.append(x)


# =========================== 1. CONHEÇA O SISTEMA ===========================
A(cap('Conheça o sistema', 'O que é, quem usa e como um quintal percorre o sistema do começo ao fim.'))
A(sec('O que é o Mulheres &amp; Quintais'))
A(p('O Mulheres &amp; Quintais é o sistema de acompanhamento do projeto Quintais Produtivos para Mulheres Rurais, executado pelo IFRN Campus Apodi em cinco estados do Nordeste: Alagoas, Bahia, Pernambuco, Piauí e Sergipe.'))
A(p('Nele a equipe seleciona as mulheres, registra as visitas a cada quintal, pede e aprova pagamentos e acompanha as metas e o orçamento. Funciona no celular e no computador, pelo navegador, e pode ser instalado como aplicativo.'))
A(caixa('importante', 'As telas deste manual mostram dados fictícios, marcados com a palavra “exemplo”. Nenhuma pessoa real aparece nas imagens.'))
A(sec('Quem usa e o que cada perfil faz'))
A(p('Cada pessoa entra com o próprio e-mail e vê só as telas do seu trabalho. Se uma tela deste manual não aparece para você, ela não é do seu perfil.'))
A(tabela(['Perfil', 'O que faz no sistema', 'Capítulo'], [
    ['Coordenação geral', 'Cadastra coordenação técnica, professores e auxiliar; autoriza passagens e eventos; dá aval em bolsas; acompanha metas e orçamento', '[[L:Coordenação geral e coordenação técnica]]'],
    ['Coordenação técnica', 'Cadastra bolsistas e agentes; aprova fichas e planos; dá aval na ajuda de custo e na bolsa das bolsistas; confere passagens e eventos', '[[L:Coordenação geral e coordenação técnica]]'],
    ['Bolsista (articulação ou apoio)', 'Lança as fichas das mulheres do estado; agenda e registra visitas; marca as entregas do mês; pede bolsa e ajuda de custo', '[[L:Bolsista de articulação e de apoio]]'],
    ['Agente de campo', 'Registra as visitas atribuídas a ela e pede a ajuda de custo', '[[L:Agente de campo]]'],
    ['Professor(a) do FIC', 'Cria turmas, matricula, registra encontros e presença, confirma o acesso ao AVA', '[[L:Professor(a) do curso FIC]]'],
    ['Auxiliar administrativo', 'Registra o cadastro no Arlo e o termo de compromisso; lança os pagamentos no Arlo', '[[L:Auxiliar administrativo]]'],
    ['Acompanhamento (MDA e MPA)', 'Só leitura: vê os números do projeto, sem nome nem dado pessoal de ninguém. Não altera nada', '[[L:Acompanhamento do projeto (MDA e MPA)]]'],
]))
A(novo.quem_faz())
A(sec('O caminho de um quintal'))
A(p('Do cadastro da ficha ao pagamento, cada quintal passa por sete passos. O sistema não deixa pular nenhum.'))
A(fluxo('Um quintal passa por 7 passos, da ficha ao pagamento', [
    ('1 · Bolsista', 'Lança a ficha', False), ('2 · Coord. técnica', 'Aprova a ficha', False), ('3 · Bolsista', 'Agenda a visita', False), ('4 · Bolsista ou agente', 'Faz o diagnóstico', False),
    ('5 · Coord. técnica', 'Aprova o plano', False), ('6 · Bolsista ou agente', 'Demais 4 visitas', False), ('7 · Coord. e auxiliar', 'Aval e pagamento', True)], linhas=2))
A(sec('Símbolos dos botões'))
A(p('Estes são os botões do sistema que têm símbolo. Os demais, como <b>Salvar</b>, <b>Aprovar</b> e <b>Agendar</b>, são só texto.'))
A(tabela(['Símbolo', 'Botão', 'Onde fica'], [
    [ic('ajuda'), 'Ajuda desta tela', 'No alto, à direita, em todas as telas'],
    [ic('sair'), 'Sair do sistema', 'No alto, à direita do seu nome'],
    [ic('pessoa_mais'), 'Cadastrar articulação, Cadastrar apoio, Cadastrar substituta, Adicionar agente', 'Aba Equipe'],
    [ic('equipe'), 'Cadastrar coordenação técnica', 'Aba Equipe'],
    [ic('pasta'), 'Cadastrar auxiliar administrativo', 'Aba Equipe'],
    [ic('capelo'), 'Cadastrar professor(a) do FIC', 'Aba Equipe'],
    [ic('resolver'), 'Resolver', 'Visão geral e aviso de pendências'],
    [ic('ver'), 'Consultar', 'Visão geral, nos avisos'],
    [ic('enviar'), 'Enviar planilha de gastos', 'Aba Execução'],
    [ic('calendario'), 'Registrar encontro', 'Curso FIC'],
    [ic('anexo'), 'Anexar documento', 'Aba Documentos'],
    [ic('relatorio'), 'Gerar relatório da ação', 'Aba Documentos'],
    [ic('aviao'), 'Pedir passagem aérea', 'Passagem ou evento'],
    [ic('tenda'), 'Pedir estrutura de evento', 'Passagem ou evento'],
], 'simb'))
A(novo.cores())
A(novo.ciclo())
A(fimcap())

# =========================== 3. PRIMEIROS PASSOS ===========================
A(cap('Primeiros passos', 'Entrar, conhecer a tela e deixar o seu cadastro em dia. Vale para todos os perfis.'))
A(sec('Entrar no sistema'))
A(serve('É a porta de entrada. Só entra quem foi cadastrado pela coordenação, com o e-mail que ela registrou.'))
A(acesso(['Navegador (Chrome ou Safari)', 'mulheres-e-quintais.github.io/sistema'], 'todos os perfis.'))
A(tela('entrada', 'Tela de entrada do sistema', [
    (1, 'Tipo de acesso', 'Escolha <b>Já tenho senha</b> ou <b>Primeiro acesso</b>.'), (2, 'E-mail', 'O e-mail do seu cadastro, exatamente como foi registrado.'),
    (3, 'Senha', 'A senha que você criou no primeiro acesso.'), (4, 'Entrar', 'Confirma e abre a sua tela.'),
    (5, 'Esqueci a senha', 'Pede um novo acesso à coordenação geral.'), (6, 'Precisa de ajuda para entrar?', 'Abre a ajuda, com o WhatsApp da coordenação.')]))
A(passos('entrar pela primeira vez', ['Abra o endereço que veio no WhatsApp.', 'Toque em <b class="bt">Primeiro acesso</b>.', 'Digite o e-mail cadastrado e o código de acesso da mensagem (8 letras e números).', 'Crie uma senha com pelo menos 8 caracteres, com letras e números, e repita.', 'Toque em <b class="bt">Criar senha e entrar</b>.'], 'O sistema abre a sua tela. Das próximas vezes, use <b>Já tenho senha</b>.'))
A(passos('quando esquecer a senha', ['Toque em <b class="bt">Esqueci a senha</b>.', 'Digite o seu e-mail e toque em <b class="bt">Pedir novo acesso</b>.', 'Aguarde o código novo, que a coordenação geral manda pelo WhatsApp do seu cadastro.', 'Entre em <b class="bt">Primeiro acesso</b> com o código e crie outra senha.'], 'Você volta a entrar com a senha nova. Seus dados não se perdem.'))
A(caixa('atencao', 'O sistema não manda e-mail. O endereço e o código chegam pelo WhatsApp. O código vale 7 dias e uma vez só.'))
A(caixa('dica', 'Abra no Chrome (Android) ou no Safari (iPhone). Aberto por dentro do WhatsApp ou do Instagram, a localização e a câmera não funcionam.'))
A(sec('A barra do alto e as abas'))
A(serve('A barra do alto aparece em todas as telas. Por ela você muda de seção, pede ajuda, abre os seus dados e sai.'))
A(acesso(['Qualquer tela, depois de entrar'], 'todos os perfis. As abas aparecem só para a coordenação.'))
A(tela('topo', 'Barra do alto e abas, como a coordenação geral vê', [
    (1, 'Abas', 'As seções do sistema, em quatro grupos: Gestão, Execução, Financeiro e Documentação. O número ao lado mostra quantos itens esperam você.'),
    (2, 'Ajuda', 'Abre a ajuda da tela em que você está.'), (3, 'Meus dados', 'A sua foto ou as suas iniciais: abre o seu cadastro.'), (4, 'Sair', 'Sai do sistema neste aparelho.')]))
A(caixa('dica', 'Depois de 15 minutos sem uso o sistema sai sozinho. Aos 13 minutos aparece um aviso: toque em <b>Continuar usando</b>.'))
A(sec('Meus dados e termo de compromisso'))
A(serve('Guarda os seus dados pessoais, a conta bancária para a FUNCERN e o termo de compromisso. Sem isso em dia, a bolsa e a ajuda de custo não são pagas.'))
A(acesso(['Barra do alto', 'sua foto ou iniciais', 'Meus dados'], 'todos os perfis, cada um nos próprios dados.'))
A(tela('meus_dados', 'Painel Meus dados', [
    (1, 'Tirar foto e Trocar foto', '<b>Tirar foto</b> abre a câmera do celular ou do computador; <b>Trocar foto</b> escolhe uma foto que já está no aparelho.'), (2, 'Seus dados', 'Função, e-mail, celular e demais dados do cadastro.'), (3, 'Termo de compromisso', 'Mostra se o termo falta, foi enviado ou já foi conferido.'), (4, 'Gerar o termo preenchido', 'Abre o termo com os seus dados, pronto para imprimir e assinar.')]))
A(passos('anexar o termo de compromisso', ['Abra <b class="bt">Meus dados</b>.', 'Em Termo de compromisso, toque em <b class="bt">Gerar o termo preenchido</b>.', 'Confira e assine: no papel, ou pelo gov.br (veja abaixo).', 'Anexe no mesmo lugar: a foto do papel inteiro ou o PDF assinado pelo gov.br.'], 'O termo fica como enviado. O auxiliar administrativo confere e registra a data; só aí o passo fica concluído.'))
A(passos('assinar pelo gov.br, sem imprimir', ['No termo gerado, toque em <b class="bt">Imprimir ou salvar em PDF</b> e escolha Salvar como PDF.', 'Abra <b>assinador.iti.br</b> e entre com a sua conta gov.br, de nível prata ou ouro.', 'Envie o PDF, marque onde fica a assinatura e confirme com o código que o gov.br manda.', 'Baixe o PDF assinado e anexe em <b class="bt">Meus dados</b>.'], 'O termo fica como enviado, com a assinatura eletrônica dentro do arquivo.'))
A(caixa('atencao', 'Não imprima nem fotografe o termo assinado pelo gov.br: a assinatura só vale no próprio arquivo PDF. Conta gov.br de nível bronze não assina; nesse caso, assine no papel.'))
A(caixa('dica', 'Para fechar Meus dados, toque em <b>Voltar ao sistema</b> ou no × do alto. O botão <b>Sair do sistema</b> encerra a sua sessão: depois dele é preciso entrar de novo com e-mail e senha.'))
A(passos('trocar a senha', ['Abra <b class="bt">Meus dados</b> e depois <b class="bt">Trocar minha senha</b>.', 'Digite a senha atual e a nova duas vezes.', 'Toque em <b class="bt">Trocar senha</b>.'], 'A senha nova passa a valer na próxima entrada.'))
A(caixa('importante', 'Nome, CPF e e-mail são de quem cadastrou você. Se estiverem errados, avise a coordenação.'))
A(sec('Usar no celular e sem internet'))
A(serve('No campo nem sempre há sinal. O sistema guarda o que você preenche e envia quando a conexão volta.'))
A(passos('instalar como aplicativo', ['Com o sistema aberto, toque no menu do navegador.', 'Toque em <b class="bt">Adicionar à tela inicial</b>.', 'Abra pelo ícone que apareceu.'], 'O sistema abre como aplicativo e funciona também sem internet.'))
A('<ul class="lst"><li>Fichas, diagnósticos, visitas feitas e avaliações podem ser preenchidos sem sinal.</li><li>Antes de ir a campo, abra o sistema com internet para atualizar a lista de visitas.</li><li>Com o sinal de volta, o envio é automático. Se preferir, toque em <b>Enviar agora</b>.</li></ul>')
A(caixa('atencao', 'Não apague os dados do navegador nem desinstale o aplicativo com registros pendentes: eles se perdem.'))
A(novo.lgpd())
A(fimcap())

# =========================== 4. COORDENAÇÃO ===========================

A(cap('Coordenação geral e coordenação técnica', 'Acompanhar o projeto, montar a equipe, aprovar e autorizar.'))
A(sec('Visão geral'))
A(serve('Mostra o retrato do projeto em uma tela: o mês em que estamos, as metas, o que pede atenção, o mapa dos quintais e o acesso à água.'))
A(acesso(['Abas', 'Gestão', 'Visão geral'], 'só a coordenação geral.'))
A(tela('visao_atencao', 'Visão geral: execução física e o quadro O que pede atenção', [
    (1, 'O que pede atenção', 'Lista os problemas do mais grave para o menos grave.'), (2, 'Contadores', 'Quantos itens há em cada nível: requer ação (vermelho), atenção (âmbar) e aviso (cinza).'), (3, 'Resolver', 'Abre a aba onde o problema se resolve.')]))
A(passos('resolver um item', ['Leia o quadro de cima para baixo.', 'Toque em ' + b('Resolver', 'resolver') + ' (ou em ' + b('Consultar', 'ver') + ', nos avisos).', 'Faça a ação na aba que abriu e volte à Visão geral.'], 'O item some da lista quando o problema acaba.'))
A(tela('visao_metas', 'Visão geral: metas do plano de trabalho e próximos marcos', [
    (1, 'Metas do plano de trabalho', 'Uma linha por meta, com o realizado, o previsto e a situação.'), (2, 'Ver detalhes', 'Abre os números e os marcos da meta.'), (3, 'Próximos marcos', 'Datas do plano de trabalho que estão chegando, ligadas à meta.')]))
A(tela('visao_mapa', 'Visão geral: onde estão os quintais produtivos', [
    (1, 'Filtro por estado', 'Mostra todos os estados ou só um.'), (2, 'Mapa', 'Cada círculo é um município; o tamanho indica o número de fichas. Toque para aproximar.'), (3, 'Status das fichas', 'Quantas estão selecionadas, em espera, aguardando ou sem água.'), (4, 'Municípios com mais fichas', 'Toque num município para ver o mapa dele.')]))
A(caixa('importante', 'O mapa mostra onde as mulheres moram. Use só dentro do sistema; em relatórios e divulgação, mostre números por município.'))

A(sec('Equipe'))
A(serve('Guarda o cadastro de todas as pessoas do projeto e mostra as vagas abertas.'))
A(acesso(['Abas', 'Gestão', 'Equipe'], 'coordenação geral (cadastra coordenação técnica, professores e auxiliar) e coordenação técnica (cadastra bolsistas e agentes).'))
A(tabela(['Função', 'Vagas'], [['Coordenação técnica', '1'], ['Auxiliar administrativo', '1'], ['Professor(a) do FIC', 'até 2'], ['Articulação estadual', '1 por estado'], ['Apoio estadual', '1 por estado'], ['Agente de campo', 'sem limite']], 'curta'))
A(tela('equipe_coord', 'Equipe: resumo, coordenação técnica, auxiliar e professores', [
    (1, 'Resumo', 'Quantas pessoas estão cadastradas e quantas estão habilitadas.'), (2, 'Ver detalhes', 'Abre a ficha da pessoa.'), (3, 'Professores do curso FIC', 'Até 2 professores. Com as duas vagas ocupadas, o botão de cadastrar não aparece.')]))
A(tela('equipe_estados', 'Equipe: bolsistas por estado e agentes de campo', [
    (1, 'Botão de cadastro', 'Aparece na vaga aberta: Cadastrar articulação, Cadastrar apoio ou Cadastrar substituta.'), (2, 'Cartão da pessoa', 'Mostra a situação da habilitação e o resumo do trabalho. Toque para abrir a ficha.'), (3, 'Seleção no estado', 'Quantas das 40 vagas já têm mulher selecionada e aprovada.'), (4, 'Adicionar agente', 'Cadastra uma agente de campo no estado.')]))
A(passos('cadastrar pelo link (recomendado)', ['Toque no botão de cadastro da vaga, por exemplo ' + b('Cadastrar articulação', 'pessoa_mais') + '.', 'Toque em <b class="bt">Gerar link de cadastro</b>.', 'Toque em <b class="bt">Enviar pelo WhatsApp</b> e escolha a pessoa.', 'Quando ela enviar, abra <b class="bt">Cadastros enviados pelo link</b>.', 'Confira e toque em <b class="bt">Conferir e cadastrar</b>.'], 'A pessoa passa a ocupar a vaga. Falta mandar o acesso.'))
A(passos('cadastrar digitando', ['Toque no botão de cadastro da vaga e escolha <b class="bt">Digitar os dados agora</b>.', 'Preencha nome, CPF, celular e e-mail.', 'Marque a ciência da pessoa sobre o uso dos dados.', 'Toque em <b class="bt">Cadastrar</b>.'], 'A pessoa aparece na vaga, com a habilitação pendente.'))
A(caixa('importante', 'Antes de cadastrar coordenação técnica, bolsista ou agente, é preciso haver um professor do FIC cadastrado e habilitado.'))
A(tela('equipe_ficha', 'Ficha de uma pessoa da equipe', [
    (1, 'Tirar foto e Trocar foto', 'Tira a foto da pessoa na hora, pela câmera, ou escolhe uma foto do aparelho.'), (2, 'Passos da habilitação', 'Dados, matrícula no FIC, cadastro no Arlo e termo. O que falta aparece como pendente.'), (3, 'Registrar passos da habilitação', 'Abre os campos de data de cada passo.'), (4, 'Hoje', 'Preenche a data do dia.')]))
A(passos('mandar o acesso para a pessoa', ['Abra a ficha da pessoa.', 'Toque em <b class="bt">Gerar código de acesso</b>.', 'Toque em <b class="bt">Mandar por WhatsApp</b>.'], 'A pessoa recebe o endereço, o e-mail e o código para o primeiro acesso.'))
A(passos('atender um “Esqueci a senha” (coordenação geral)', ['Na aba Equipe, abra <b class="bt">Pedidos de novo acesso</b>.', 'Abra a ficha de quem pediu.', 'Toque em <b class="bt">Liberar novo primeiro acesso</b> e confirme.', 'Mande o código pelo WhatsApp do cadastro.'], 'A senha antiga é apagada e a pessoa cria outra. Se ela não sabe do pedido, descarte.'))
A(passos('desligar e pôr substituta', ['Abra a ficha da pessoa e toque em <b class="bt">Desligar</b>.', 'Escolha o motivo e explique em uma frase.', 'Toque em <b class="bt">Confirmar desligamento</b>.', 'Na vaga que abriu, toque em ' + b('Cadastrar substituta', 'pessoa_mais') + '.'], 'A vaga volta a ficar aberta e o histórico da pessoa desligada continua guardado.'))
A(caixa('atencao', 'Desligamento não tem volta: quem foi desligado não pode ser reativado. Para voltar, é preciso um cadastro novo.'))

A(tela('acomp_coord', 'Equipe: acompanhamento externo (só a coordenação geral)', [(1, 'Nome e e-mail', 'Dados de quem vai acompanhar o projeto.'), (2, 'Órgão', 'MDA (ministério) ou MPA (movimento parceiro). Define qual tela a pessoa vê.'), (3, 'Ver como o MDA vê', 'Mostra, na sua tela, o que cada órgão enxerga.')]))
A(passos('liberar o acesso de quem acompanha o projeto', ['Na aba Equipe, vá até <b>Acompanhamento externo (MDA e MPA)</b>.', 'Preencha o nome, o e-mail e o órgão e toque em <b class="bt">Gravar</b>.', 'Na linha da pessoa, toque em <b class="bt">Gerar código</b>.', 'Passe o código e o endereço do sistema. Ela entra por <b>Primeiro acesso</b> e cria a senha.'], 'A pessoa passa a ver só a área de acompanhamento do seu órgão.'))
A(caixa('importante', 'Quem acompanha não entra na equipe: não vê nome, CPF, endereço, pagamento nem histórico. Vê só contagens. Para tirar o acesso, toque em <b>Alterar</b> e desmarque <b>Acesso ativo</b>. O código vale 7 dias e uma vez só, e não aparece de novo.'))
A(sec('Seleção das mulheres'))
A(serve('Reúne as fichas de indicação dos cinco estados. A coordenação técnica aprova ou devolve cada ficha antes do diagnóstico.'))
A(acesso(['Abas', 'Gestão', 'Seleção'], 'coordenação técnica e coordenação geral.'))
A(tela('selecao', 'Seleção das beneficiárias', [
    (1, 'Baixar CSV', 'Baixa as fichas para abrir no Excel ou no Google Planilhas.'), (2, 'Tabela por estado', 'Total de fichas e como elas se repartem. Só a coluna Selecionadas ocupa vaga.'), (3, 'Para você aprovar', 'Fichas esperando a sua decisão. A faixa âmbar indica tarefa pendente.'), (4, 'Todas as fichas', 'Abre a lista completa.')]))
A(tela('selecao_ficha', 'Ficha de indicação aberta', [
    (1, 'Situação', 'Resultado da seleção e situação da aprovação.'), (2, 'Identificação', 'Dados da mulher e quem lançou a ficha.'), (3, 'Termo de consentimento', 'O que ela autorizou: dados, imagem e voz, crianças nas fotos.'), (4, 'Critérios obrigatórios', 'Os critérios do edital, um a um.')]))
A(passos('aprovar ou devolver uma ficha', ['Em Para você aprovar, toque na ficha.', 'Confira os dados, os critérios e a foto do termo assinado.', 'No fim da ficha, toque em <b class="bt">Aprovar</b>. Ou escreva o que corrigir e toque em <b class="bt">Devolver para correção</b>.'], 'A ficha aprovada libera o agendamento do diagnóstico. A devolvida volta para a bolsista corrigir.'))
A(caixa('importante', 'São 40 selecionadas por estado. O sistema não aceita a 41ª nem o mesmo CPF em duas fichas.'))

A(sec('Trabalho de campo'))
A(serve('Acompanha as cinco visitas de cada quintal, os planos para aprovar e o roteiro do mês.'))
A(acesso(['Abas', 'Execução', 'Campo'], 'coordenação técnica e coordenação geral.'))
A(fluxo('As 5 visitas acontecem em ordem; o sistema não deixa pular', [('ficha aprovada', 'Diagnóstico e plano', False), ('plano aprovado', 'Implantação', False), ('depois da implantação', 'Acompanhamento 1', False), ('depois da implantação', 'Acompanhamento 2', False), ('depois das duas', 'Avaliação final', True)], linhas=1))
A(tela('campo_estados', 'Campo: andamento por estado', [(1, '+ Agendar visita', 'Agenda uma visita.'), (2, 'Tabela por estado', 'Dias de campo feitos e previstos, diagnósticos, planos aprovados, casos sem água e agentes.')]))
A(tela('campo_roteiro', 'Campo: planos para aprovar e roteiro do mês', [
    (1, 'Planos para você aprovar', 'Diagnósticos com plano esperando a coordenação técnica.'), (2, 'Roteiro de campo', 'As visitas do mês, com data, mulher, etapa, quem visita e situação.'), (3, 'Ações da visita', 'Abre o registro ou permite mudar data ou pessoa.')]))
A(passos('aprovar o plano do quintal', ['Em Planos para você aprovar, abra o diagnóstico.', 'Confira as fotos, o croqui, os itens do kit e o cronograma. Os preços de referência e a projeção aparecem só para a coordenação geral.', 'Toque em <b class="bt">Aprovar</b>. Ou escreva o motivo e toque em <b class="bt">Devolver para correção</b>.'], 'Com o plano aprovado, a implantação pode ser agendada.'))
A(passos('imprimir o plano do quintal', ['Abra o diagnóstico da mulher.', 'No alto, toque em <b class="bt">Imprimir o plano</b>.', 'Escolha a impressora ou salve em PDF.'], 'Sai uma folha com o kit, o cronograma, a foto do croqui e o espaço das assinaturas. Impressa pela coordenação geral, a folha traz também os preços de referência e a projeção do investimento. A folha não leva CPF nem endereço.'))
A(passos('manter a lista de itens do kit (só a coordenação geral)', ['Na aba Campo, vá até <b>Itens do kit e preços de referência</b>.', 'Na linha do item, toque em <b class="bt">Alterar</b>.', 'Troque o preço pelo valor da cotação e escreva de onde ele veio.', 'Marque <b>Preço confirmado por cotação ou ata</b> e toque em <b class="bt">Gravar item</b>.'], 'O novo preço passa a valer na projeção dos planos sem valor informado. Só a coordenação geral vê os preços e a projeção.'))
A(caixa('dica', 'A compra dos kits é feita por empresa contratada. Os preços do sistema são só <b>referência</b> para a coordenação geral projetar o investimento: são estimativa preliminar, pesquisada na internet. Para incluir um item novo, preencha o formulário com o campo Item em branco. Item que sai da lista não é apagado: desmarque <b>Item na lista de quem faz o diagnóstico</b>.'))
A(caixa('dica', 'Em mês com muitas visitas, o roteiro mostra as 60 primeiras. No fim da tabela, toque em <b>Mostrar mais</b> ou em <b>Mostrar todas</b>. A lista de visitas da aba Custos funciona do mesmo jeito.'))
A(passos('mudar ou cancelar uma visita', ['No roteiro, na linha da visita, toque em <b class="bt">Mudar data ou pessoa</b>.', 'Altere e salve, ou toque em <b class="bt">Cancelar esta visita</b>.'], 'O roteiro é atualizado. Visita cancelada não volta: agenda-se outra.'))
A(caixa('importante', 'Quem agenda a visita é a bolsista do estado, na tela dela. Só visita quem está habilitada (FIC, Arlo e termo) e é do mesmo estado do quintal.'))

A(sec('Curso FIC'))
A(serve('Controla as turmas do curso FIC do IFRN, as matrículas, os encontros com lista de presença e o acesso mensal ao AVA.'))
A(acesso(['Abas', 'Execução', 'Curso FIC'], 'coordenação geral. O professor do FIC faz o mesmo na tela dele (capítulo [[N:Professor(a) do curso FIC]]).'))
A(tela('fic', 'Curso FIC: turmas, matrículas, encontros e AVA', [
    (1, '+ Nova turma', 'Cria uma turma, com estado e datas.'), (2, '+ Matricular', 'Matricula pessoas na turma, com o número do SUAP.'), (3, 'Registrar encontro', 'Lança data, carga horária, conteúdo e presença.'), (4, 'Acesso ao AVA no mês', 'Marca quem entrou no AVA e fez as atividades.')]))
A(p('O passo a passo de cada tarefa está no capítulo [[L:Professor(a) do curso FIC]].'))

A(sec('Pagamentos'))
A(serve('Reúne os pedidos de bolsa e de ajuda de custo. A coordenação confere e dá o aval; o auxiliar lança no Arlo.'))
A(acesso(['Abas', 'Financeiro', 'Pagamentos'], 'coordenação técnica (ajuda de custo e bolsa das bolsistas) e coordenação geral (bolsa da coordenação técnica, dos professores e do auxiliar).'))
A(fluxo('Todo pagamento passa por três mãos antes da FUNCERN', [('Quem vai receber', 'Pede o pagamento', False), ('Coordenação', 'Dá o aval', False), ('Auxiliar adm.', 'Lança no Arlo', False), ('FUNCERN', 'Paga', True)], linhas=1, laco=(1, 0, 'devolve para corrigir')))
A(tela('pagamentos', 'Solicitações de pagamento', [
    (1, 'Resumo', 'Quantos pedidos esperam aval, quantos faltam lançar e o total já lançado.'), (2, 'Esperando o seu aval', 'Pedidos que dependem de você.'), (3, 'Com aval, falta lançar', 'Pedidos que agora dependem do auxiliar.'), (4, 'Lançadas no Arlo', 'Histórico do que já foi lançado.')]))
A(passos('dar o aval', ['Em Esperando o seu aval, abra o pedido.', 'Confira as visitas e o km (ajuda de custo) ou o relatório e as entregas do mês (bolsa).', 'Toque em <b class="bt">Dar aval</b>. Ou escreva o que corrigir e toque em <b class="bt">Devolver para correção</b>.'], 'O pedido segue para o auxiliar lançar no Arlo. O devolvido volta para quem pediu.'))

A(sec('Custos'))
A(serve('Calcula a ajuda de custo de cada visita e mostra se o trabalho de campo cabe no orçamento.'))
A(acesso(['Abas', 'Financeiro', 'Custos'], 'coordenação geral e coordenação técnica.'))
A(tela('custos', 'Custo das visitas', [
    (1, 'Pagamento do mês', 'O valor de cada visita feita no mês.'), (2, 'Proposta de roteiro', 'Projeção do custo do campo e medidas para caber no orçamento.'), (3, 'Visitas do mês', 'Uma linha por visita, com o campo Km conferido.'), (4, 'Valores usados', 'Hora, horas por etapa, consumo, gasolina e refeição usados no cálculo.')]))
A(passos('conferir o km de uma visita', ['Em Pagamento do mês, escolha o mês com as setas.', 'Na linha da visita, digite o <b>Km conferido</b> (só a ida).', 'Saia do campo.'], 'O valor salva sozinho e o custo da visita muda na hora.'))
A(passos('mudar os valores do cálculo', ['Abra <b class="bt">Valores usados</b>.', 'Ajuste o que precisar.', 'Toque em <b class="bt">Salvar</b>.'], 'Os cálculos passam a usar os novos valores.'))

A(sec('Viagens e eventos'))
A(serve('Controla os pedidos de passagem aérea e de estrutura de evento, com os tetos do orçamento.'))
A(acesso(['Abas', 'Financeiro', 'Viagens e eventos'], 'coordenação técnica (confere) e coordenação geral (autoriza).'))
A(fluxo('A FUNCERN só compra depois de conferido e autorizado', [('Articulação estadual', 'Pede', False), ('Coordenação técnica', 'Confere', False), ('Coordenação geral', 'Autoriza', False), ('FUNCERN', 'Compra ou contrata', True)], linhas=1, laco=(2, 0, 'devolve para corrigir'), notas=('Sem coordenação técnica, quem confere é o auxiliar administrativo.', 'Passagem de acompanhamento pedagógico: só a coordenação geral confere.')))
A(tabela(['Pedido', 'Antecedência', 'Teto'], [['Passagem aérea de intercâmbio', '40 dias', 'R$ 70.000'], ['Passagem aérea de acompanhamento pedagógico', '40 dias', 'R$ 22.400'], ['Estrutura de evento', '45 dias', 'R$ 30.000 (5 eventos de R$ 6.000)']]))
A(tela('viagens', 'Passagens e eventos', [
    (1, 'Passagens aéreas', 'Pedidos de passagem.'), (2, 'Tetos de gasto', 'Quanto já foi usado e quanto resta de cada teto.'), (3, 'Esperando a sua autorização', 'Pedidos que dependem de você.'), (4, 'Eventos', 'Pedidos de estrutura de evento.')]))
A(passos('conferir um pedido', ['Em Esperando a sua conferência, abra o pedido.', 'Confira nomes iguais ao documento, CPF, RG, datas e quantidades.', 'Toque em <b class="bt">Conferido</b>. Ou escreva o que corrigir e toque em <b class="bt">Devolver para correção</b>.'], 'O pedido segue para a coordenação geral autorizar.'))
A(passos('autorizar e mandar à FUNCERN (coordenação geral)', ['Em Esperando a sua autorização, abra o pedido.', 'Se já tiver, digite o protocolo da FUNCERN.', 'Toque em <b class="bt">Autorizar</b>.', 'Toque em <b class="bt">Copiar texto</b> e cole no e-mail ou no sistema da FUNCERN.'], 'O pedido fica como autorizado e entra na conta do teto.'))
A(caixa('importante', 'Quem confere não autoriza o mesmo pedido.'))

A(sec('Execução do orçamento'))
A(serve('Compara o previsto com o executado em cada rubrica do TED. O executado vem da planilha de gastos enviada pela coordenação.'))
A(acesso(['Abas', 'Execução', 'Execução'], 'só a coordenação geral.'))
A(tela('execucao', 'Execução do orçamento', [
    (1, 'Enviar planilha de gastos', 'Envia a planilha do mês.'), (2, 'Execução financeira', 'Total previsto, executado, comprometido e saldo livre.'), (3, 'Gráficos', 'Ritmo do gasto no tempo e uso de cada rubrica.'), (4, 'Rubrica', 'Toque para abrir os itens da rubrica.')]))
A(passos('enviar a planilha do mês', ['Toque em ' + b('Enviar planilha de gastos', 'enviar') + ' e escolha o arquivo (.xlsx ou .csv).', 'Toque em <b class="bt">Ler a planilha</b> e confira a prévia.', 'Confira a data <b>Gastos até</b> e toque em <b class="bt">Enviar e usar esta planilha</b>.'], 'Os números de executado, saldo e gráficos passam a refletir a planilha nova.'))
A(caixa('dica', 'A planilha é o retrato completo: todos os gastos desde o início, uma linha por pagamento, sem linhas de total. Para montar, use <b>Baixar o modelo</b>.'))
A(caixa('exemplo', '<b>Executado</b> é o que a planilha trouxe. <b>Comprometido</b> é o que o sistema já sabe (aval, Arlo, autorização) e a planilha ainda não trouxe. <b>Saldo</b> é o previsto menos os dois.'))

A(sec('Documentos'))
A(serve('É a pasta de documentos do projeto (atas, ofícios, listas de presença) e o lugar de gerar o relatório da ação.'))
A(acesso(['Abas', 'Documentação', 'Documentos'], 'só a coordenação geral.'))
A(tela('documentos', 'Documentos do projeto', [(1, 'Anexar documento', 'Guarda um arquivo na pasta do projeto.'), (2, 'Gerar relatório da ação', 'Monta o relatório com os dados do sistema.'), (3, 'Imprimir relatórios e fichas de cadastro', 'Relatórios por tipo e fichas de cadastro da equipe, por estado.'), (4, 'Lista de documentos', 'Os documentos anexados; toque para abrir.')]))
A(passos('anexar um documento', ['Toque em ' + b('Anexar documento', 'anexo') + '.', 'Escolha o tipo, a data e escreva o título.', 'Escolha o arquivo: PDF, Word, planilha ou foto, até 20 MB.', 'Toque em <b class="bt">Anexar</b>.'], 'O documento aparece na lista. Documento errado é arquivado, não apagado.'))
A(passos('gerar o relatório da ação', ['Toque em ' + b('Gerar relatório da ação', 'relatorio') + '.', 'Escolha o período e, se quiser, um estado.', 'Toque em <b class="bt">Imprimir</b> ou em <b class="bt">Baixar para o Word</b>.'], 'O relatório sai com os números do período, sem nome nem CPF das beneficiárias.'))

A(passos('imprimir relatórios por tipo e fichas de cadastro', ['Em <b>Imprimir relatórios e fichas de cadastro</b>, escolha o estado ou deixe Todos.', 'Na linha do que você quer, toque em <b class="bt">Imprimir</b>.', 'Na janela de impressão, imprima ou escolha Salvar como PDF.'], 'Sai o relatório (equipe e habilitação, seleção das mulheres ou campo e visitas) ou uma ficha de cadastro por pessoa (bolsistas ou demais membros).'))
A(caixa('atencao', 'Essas impressões trazem nomes e, nas fichas, CPF e contato. São de uso interno da coordenação: não repasse nem publique. Nenhuma traz dados bancários.'))
A(sec('Histórico'))
A(serve('Registra tudo o que foi feito no sistema: quem cadastrou, alterou, aprovou, devolveu e desligou, e quando.'))
A(acesso(['Abas', 'Documentação', 'Histórico'], 'só a coordenação geral.'))
A(tela('historico', 'Histórico de alterações', [(1, 'Últimos acessos', 'A última entrada de cada pessoa, com o aparelho e a rede.'), (2, 'Alterações', 'Os registros, do mais novo para o mais antigo.')]))
A(passos('achar um registro', ['Role pelos dias.', 'No fim da lista, toque em <b class="bt">Ver registros anteriores</b>.'], 'A lista mostra os registros mais antigos.'))
A(fimcap())

# =========================== 5. BOLSISTA ===========================
A(cap('Bolsista de articulação e de apoio', 'Indicar as mulheres, registrar o campo, entregar o mês e pedir o pagamento.'))
A(sec('A sua tela'))
A(serve('Reúne tudo o que você faz no estado. Os botões do topo levam direto a cada tarefa.'))
A(acesso(['Entrar no sistema'], 'bolsistas de articulação e de apoio.'))
A(tela('bolsista_cel', 'Tela da bolsista', [
    (1, '+ Nova ficha de mulher', 'Abre a ficha de indicação e seleção.'), (2, 'Visitas e diagnósticos', 'Leva ao trabalho de campo do estado.'), (3, 'Entregas do mês', 'Leva ao quadro de entregas. O número mostra o que falta.'), (4, 'Pedir pagamento', 'Leva ao pedido de bolsa e de ajuda de custo.'), (5, 'Passagem ou evento', 'Só para a articulação estadual.'), (6, 'Entreguei', 'Marca uma entrega do mês como feita.')]))
A(sec('Lançar a ficha de uma mulher'))
A(serve('Registra a indicação da mulher, os critérios do edital e o termo de consentimento.'))
A(acesso(['Sua tela', '+ Nova ficha de mulher'], 'bolsistas, nas fichas do próprio estado.'))
A(tela('ficha_nova_cel', 'Ficha de indicação e seleção', [(1, 'Imprimir em branco', 'Imprime a ficha para preencher no papel.'), (2, 'Campos da ficha', 'Identificação, critérios e termo de consentimento.'), (3, 'Salvar', 'Guarda a ficha e envia para aprovação.')]))
A(passos('', ['Toque em <b class="bt">+ Nova ficha de mulher</b>.', 'Preencha os dados e os critérios junto com a mulher.', 'Fotografe a ficha e o termo de consentimento assinado.', 'Toque em <b class="bt">Registrar localização</b>.', 'Toque em <b class="bt">Salvar</b>.'], 'A ficha vai para a coordenação técnica aprovar. Sem internet, fica no celular e sobe sozinha depois.'))
A(caixa('dica', 'Escreva o endereço do jeito mais completo possível: é por ele que o sistema confere se já há alguém da mesma casa.'))
A(caixa('atencao', 'Ficha devolvida aparece em <b>Para corrigir</b>. Abra, leia o que a coordenação pediu, corrija e salve.'))
A(sec('Agendar e registrar visitas'))
A(serve('É onde você agenda as visitas do estado e registra o que foi feito em cada uma.'))
A(acesso(['Sua tela', 'Visitas e diagnósticos'], 'bolsistas do estado. A agente de campo registra as visitas atribuídas a ela.'))
A(tela('bolsista_campo_cel', 'Trabalho de campo do estado', [(1, 'Para fazer agora', 'As visitas que esperam o seu registro.'), (2, '+ Agendar visita', 'Agenda uma visita para você ou para uma agente.'), (3, 'Roteiro de campo', 'As visitas do mês.')]))
A(passos('agendar uma visita', ['Toque em <b class="bt">+ Agendar visita</b>.', 'Escolha o quintal, a etapa, a data e quem vai.', 'Toque em <b class="bt">Agendar</b>.'], 'A visita entra no roteiro e aparece para quem vai fazer.'))
A(passos('registrar o diagnóstico e o plano', ['Em Para fazer agora, toque em <b class="bt">Registrar diagnóstico</b>.', 'Preencha o diagnóstico com a mulher.', 'Monte o plano: escolha cada item do kit na lista e informe a quantidade e para que serve. Não é preciso informar preço. Depois, o cronograma.', 'Desenhe o croqui do quintal no papel e fotografe: a foto aparece dentro do plano.', 'Faça as fotos e toque em <b class="bt">Registrar localização</b>.', 'Toque em <b class="bt">Salvar</b>.'], 'O plano vai para a coordenação técnica aprovar.'))
A(passos('registrar implantação, acompanhamento ou avaliação', ['Em Para fazer agora, toque em <b class="bt">Registrar visita feita</b> (ou <b class="bt">Registrar avaliação</b>).', 'Escreva o relato. Pode usar <b class="bt">Falar</b>.', 'Faça as fotos e registre a localização.', 'Toque em <b class="bt">Salvar</b>.'], 'A visita fica como feita e passa a contar para a ajuda de custo.'))
A(caixa('atencao', 'Depois de registrada como feita, a visita não muda mais. Confira antes de salvar.'))
A(sec('Entregas do mês e pagamento'))
A(serve('As entregas do mês liberam a bolsa. A ajuda de custo vem das visitas feitas.'))
A(acesso(['Sua tela', 'Entregas do mês ou Pedir pagamento'], 'bolsistas. Agente de campo pede só ajuda de custo.'))
A(tela('bolsista_pag_cel', 'Solicitar pagamento', [(1, 'Ajuda de custo', 'Lista as visitas feitas no mês.'), (2, 'Solicitar', 'Envia o pedido de ajuda de custo.'), (3, 'Bolsa', 'O pedido da bolsa do mês, com o relatório.'), (4, 'Falar', 'Escreve o que você fala, em vez de digitar.')]))
A(passos('marcar as entregas do mês', ['Toque em <b class="bt">Entregas do mês</b>.', 'Em cada entrega feita, toque em <b class="bt">Entreguei</b>.'], 'As entregas marcadas liberam o pedido da bolsa.'))
A(passos('pedir a ajuda de custo', ['Toque em <b class="bt">Pedir pagamento</b>.', 'Marque as visitas feitas no mês. O total acompanha o que você marca.', 'Toque em <b class="bt">Solicitar</b>.'], 'O pedido vai para a coordenação técnica dar o aval.'))
A(passos('pedir a bolsa', ['Em Bolsa, escreva o relatório do mês.', 'Toque em <b class="bt">Solicitar bolsa</b>.'], 'O pedido vai para a coordenação. É uma bolsa por mês.'))
A(sec('Pedir passagem ou evento'))
A(serve('Pede passagem aérea ou estrutura de evento para as atividades do estado.'))
A(acesso(['Sua tela', 'Passagem ou evento'], 'só a bolsista de articulação estadual.'))
A(caixa('importante', 'Peça com antecedência: 40 dias para passagem e 45 dias para evento.'))
A(passos('', ['Toque em <b class="bt">Passagem ou evento</b>.', 'Toque em ' + b('Pedir passagem aérea', 'aviao') + ' ou em ' + b('Pedir estrutura de evento', 'tenda') + '.', 'Preencha tudo: nomes iguais ao documento, CPF, RG, datas e quantidades.', 'Toque em <b class="bt">Enviar</b>.'], 'O pedido vai para a conferência. Se voltar devolvido, abra, leia o motivo e toque em <b>Corrigir e reenviar</b>.'))
A(fimcap())

# =========================== 6. AGENTE ===========================
A(cap('Agente de campo', 'Registrar as visitas atribuídas a você e pedir a ajuda de custo.'))
A(sec('A sua tela'))
A(serve('Mostra as visitas atribuídas a você, as que já fez e o pedido da ajuda de custo.'))
A(acesso(['Entrar no sistema'], 'agentes de campo.'))
A(tela('agente_cel', 'Tela da agente de campo', [(1, 'Minhas próximas visitas', 'Leva às visitas que você tem a fazer.'), (2, 'Registrar diagnóstico', 'Abre o registro da visita. O nome do botão muda conforme a etapa.'), (3, 'Pedir ajuda de custo', 'Leva ao pedido do mês.')]))
A(passos('registrar uma visita', ['Toque em <b class="bt">Minhas próximas visitas</b>.', 'Toque no botão da visita: Registrar diagnóstico, Registrar visita feita ou Registrar avaliação.', 'Faça as fotos, registre a localização e salve.'], 'A visita fica como feita. Sem internet, sobe depois.'))
A(passos('pedir a ajuda de custo', ['Toque em <b class="bt">Pedir ajuda de custo</b>.', 'Marque as visitas feitas no mês.', 'Toque em <b class="bt">Solicitar</b>.'], 'O pedido vai para a coordenação técnica dar o aval.'))
A(caixa('importante', 'Você só vê os quintais atribuídos a você, e só depois de habilitada (FIC, Arlo e termo). Para mudar a data de uma visita, fale com a bolsista do estado.'))
A(fimcap())

# =========================== 7. PROFESSOR ===========================
A(cap('Professor(a) do curso FIC', 'Turmas, matrículas, encontros, presença e acesso ao AVA.'))
A(sec('A sua tela'))
A(serve('Reúne as turmas do curso FIC, as matrículas, os encontros e a confirmação mensal do acesso ao AVA.'))
A(acesso(['Entrar no sistema'], 'professores do FIC. A coordenação geral faz o mesmo pela aba Curso FIC.'))
A(tela('professor', 'Tela do professor do FIC', [(1, 'Matricular alunas', 'Leva às turmas e matrículas.'), (2, 'Registrar encontro e presença', 'Leva aos encontros do curso.'), (3, 'Confirmar acesso ao AVA', 'Leva ao quadro do AVA do mês.'), (4, 'Pedir a minha bolsa', 'Leva ao pedido da bolsa.'), (5, '+ Nova turma', 'Cria uma turma.')]))
A(passos('criar uma turma', ['Toque em <b class="bt">+ Nova turma</b>.', 'Dê o nome, o estado (ou vários estados) e as datas.', 'Toque em <b class="bt">Criar turma</b>.'], 'A turma aparece em Suas turmas.'))
A(passos('matricular', ['Na turma, toque em <b class="bt">+ Matricular</b>.', 'Marque as pessoas e digite o número da matrícula no SUAP de cada uma.', 'Confira a data e toque em <b class="bt">Salvar</b>.'], 'A matrícula conta como um passo da habilitação da pessoa.'))
A(passos('registrar um encontro e a presença', ['Toque em ' + b('Registrar encontro', 'calendario') + '.', 'Escolha a turma e informe a data, a carga horária (até 12 horas no dia) e a modalidade.', 'Escreva o que foi trabalhado.', 'Marque quem participou.', 'Toque em <b class="bt">Registrar encontro</b>.'], 'O encontro entra no relatório do mês. Cada aluna confirma a própria presença na tela dela.'))
A(passos('confirmar o acesso ao AVA', ['Em Acesso ao AVA no mês, confira o mês.', 'Marque quem entrou e fez as atividades.'], 'Salva na hora. É uma das entregas do mês das bolsistas.'))
A(caixa('atencao', 'Encontro lançado por engano não é apagado: abra e toque em <b>Cancelar encontro</b>. Mês sem encontro só é aceito com justificativa.'))
A(caixa('importante', 'O projeto tem no máximo 2 professores do FIC ativos.'))
A(fimcap())

# =========================== 8. AUXILIAR ===========================
A(cap('Auxiliar administrativo', 'Cadastro no Arlo, termo de compromisso e lançamento dos pagamentos.'))
A(sec('A sua tela'))
A(serve('Mostra quem falta cadastrar no Arlo, os termos para conferir e os pagamentos para lançar.'))
A(acesso(['Entrar no sistema'], 'auxiliar administrativo.'))
A(tela('auxiliar', 'Tela do auxiliar administrativo', [(1, 'Cadastrar no Arlo', 'Leva à lista de quem falta. O número mostra quantos.'), (2, 'Lançar pagamentos no Arlo', 'Leva aos pedidos com aval.'), (3, 'Falta cadastrar no Arlo', 'Pessoas ainda sem cadastro na FUNCERN.'), (4, 'No Arlo, falta registrar o termo', 'Pessoas com termo para conferir.')]))
A(passos('registrar o cadastro no Arlo', ['Toque em <b class="bt">Cadastrar no Arlo</b>.', 'Abra a pessoa e, se precisar, toque em <b class="bt">Ver conta e Pix</b>.', 'Cadastre no Arlo.', 'Volte, toque em <b class="bt">Registrar passos da habilitação</b>, depois em <b class="bt">Hoje</b> e em <b class="bt">Salvar</b>.'], 'A pessoa sai da lista de quem falta cadastrar.'))
A(passos('conferir o termo de compromisso', ['Abra a pessoa e toque em <b class="bt">Abrir o termo</b>.', 'Confira se está preenchido e assinado. Se foi assinado pelo gov.br, baixe o arquivo e valide em <b>validar.iti.br</b>.', 'Registre a data em <b class="bt">Registrar passos da habilitação</b>.'], 'A habilitação da pessoa fica completa.'))
A(passos('lançar um pagamento no Arlo', ['Toque em <b class="bt">Lançar pagamentos no Arlo</b>.', 'Abra o pedido, lance o valor no Arlo e digite o protocolo.', 'Toque em <b class="bt">Registrar: lançado no Arlo</b>.'], 'O pedido fica como lançado e entra no comprometido do orçamento.'))
A(caixa('importante', 'Sem o termo anexado pela própria pessoa, o sistema não aceita a data do termo. Cada consulta a conta bancária fica registrada no histórico.'))
A(fimcap())

# =========================== ACOMPANHAMENTO EXTERNO ===========================
A(cap('Acompanhamento do projeto (MDA e MPA)', 'Área só de leitura para quem acompanha o projeto de fora: o ministério e o movimento parceiro.'))
A(sec('Como funciona'))
A(serve('Mostra a execução do projeto em números, ao vivo. Não permite alterar nada e não mostra dado pessoal de ninguém.'))
A(acesso(['Entrar no sistema'], 'pessoas cadastradas pela coordenação geral como acompanhamento do MDA ou do MPA.'))
A(passos('entrar pela primeira vez', ['Abra o endereço do sistema.', 'Toque em <b class="bt">Primeiro acesso</b>.', 'Digite o seu e-mail e o código de 8 letras e números que a coordenação geral enviou.', 'Crie a senha e entre.'], 'A área de acompanhamento do seu órgão abre direto. Nas próximas vezes, entre com o e-mail e a senha.'))
A(passos('atualizar e guardar os números', ['Os números se atualizam sozinhos a cada 5 minutos.', 'Para buscar na hora, toque em <b class="bt">Atualizar agora</b>.', 'Para guardar ou enviar, toque em <b class="bt">Imprimir ou salvar em PDF</b>.'], 'A data e a hora da última atualização aparecem no alto da tela.'))
A(caixa('importante', 'Os números são ao vivo: mostram o que a equipe registrou até agora, inclusive visitas atrasadas. Dados de exemplo usados em testes ficam fora das contas. Grupo com 1 a 4 mulheres aparece como "menos de 5", para ninguém ser identificada.'))
A(sec('A tela do MDA'))
A(serve('O projeto inteiro em números, sem parte financeira: alcance, etapas, metas físicas, mapa, evolução, perfil das beneficiárias e impacto.'))
A(tela('acomp_mda', 'Acompanhamento: tela do MDA', [(1, 'Atualizar agora', 'Busca os números de novo.'), (2, 'Números do alto', 'Mulheres selecionadas, pessoas nas famílias, quintais implantados, municípios, comunidades e visitas feitas.'), (3, 'O caminho de cada quintal', 'Da indicação à avaliação final, com o previsto de cada etapa.'), (4, 'Metas físicas', 'As metas do plano de trabalho, com a situação de cada uma.')]))
A(tabela(['Parte da tela', 'O que mostra'], [
    ['Onde o projeto está', 'Mapa dos 5 estados, municípios com mais quintais e tabela por estado'],
    ['Evolução do trabalho de campo', 'Visitas feitas em cada mês, por etapa'],
    ['Quem são as mulheres', 'Prioridades de seleção e idade, em número e percentual. Aparece a partir de 5 mulheres selecionadas'],
    ['O que muda na vida das famílias', 'Linha de base (diagnóstico) e avaliação final: produção do quintal e situação alimentar'],
]))
A(sec('A tela do MPA'))
A(serve('O andamento no território: cada estado, a equipe de campo, a formação e o que pede atenção.'))
A(tela('acomp_mpa', 'Acompanhamento: tela do MPA', [(1, 'Atualizar agora', 'Busca os números de novo.'), (2, 'Números do alto', 'Selecionadas, comunidades, equipe de campo e visitas feitas, agendadas e atrasadas.'), (3, 'Estado por estado', 'Um cartão por estado, com as metas do estado, a equipe e as comunidades.'), (4, 'O que pede atenção', 'Visitas com a data vencida, equipe incompleta, casos sem água e lista de espera.')]))
A(tabela(['Parte da tela', 'O que mostra'], [
    ['Formação da equipe', 'Turmas, matrículas e encontros registrados no curso de formação'],
    ['Onde o projeto está', 'Mapa, municípios com mais quintais e tabela por estado, com bolsistas e agentes'],
    ['Evolução do trabalho de campo', 'Visitas feitas em cada mês, por etapa'],
]))
A(fimcap())

# =========================== 9. DÚVIDAS ===========================
A(cap('Dúvidas e solução de problemas', 'O que verificar nas situações mais comuns.'))
prob = [
    ('Aparece “confira o e-mail e o código de acesso”.', 'O e-mail tem de ser exatamente o do cadastro. O código vale 7 dias e uma vez só: peça outro à coordenação.'),
    ('Aparece “Este e-mail já tem senha”.', 'Você já fez o primeiro acesso. Use <b>Já tenho senha</b>.'),
    ('Não chegou e-mail do sistema.', 'É normal: o sistema não manda e-mail. O acesso vem pelo WhatsApp.'),
    ('A localização ou a câmera não funciona.', 'Abra no Chrome ou no Safari, não por dentro do WhatsApp ou do Instagram, e permita o acesso quando o navegador perguntar.'),
    ('Não aparece nenhuma visita para mim.', 'Você só vê os quintais atribuídos a você, e só depois de habilitada (FIC, Arlo e termo).'),
    ('Não consigo agendar a visita para uma pessoa.', 'Ela ainda não está habilitada, ou não é do mesmo estado do quintal.'),
    ('O botão de cadastrar professor sumiu.', 'As 2 vagas de professor do FIC estão ocupadas. Desligue um para cadastrar outro.'),
    ('Aparece “Este registro foi alterado por outra pessoa enquanto você editava”.', 'Alguém salvou o mesmo registro antes de você. Feche, abra de novo e refaça a alteração.'),
    ('O sistema saiu sozinho.', 'Foram 15 minutos sem uso. Entre de novo: o formulário que estava pela metade volta, neste aparelho, por até 24 horas.'),
    ('Preenchi sem internet e não subiu.', 'Abra o sistema com sinal e toque em <b>Enviar agora</b>.'),
    ('Não consigo salvar o cadastro.', 'Veja a mensagem em vermelho no formulário: ela diz o campo. Confira CPF, e-mail, celular com DDD e a ciência sobre o uso dos dados.'),
]
A(''.join('<div class="prob"><p><span class="pl">Problema</span><span>%s</span></p><p><span class="pl v">O que verificar</span><span>%s</span></p></div>' % x for x in prob))
A(novo.mensagens())
A(sec('A quem pedir ajuda'))
A(tabela(['Assunto', 'Quem procurar'], [['Qualquer tela', 'O botão ' + ic('ajuda') + ' abre a ajuda da tela em que você está'], ['Entrar no sistema', 'Coordenação do projeto, pelo WhatsApp (84) 9 9992-7943'], ['Dados do cadastro errados', 'Quem cadastrou você: coordenação geral ou técnica'], ['Arlo, termo e pagamento lançado', 'Auxiliar administrativo']]))
A(caixa('importante', 'Os dados das pessoas são protegidos pela LGPD (Lei nº 13.709/2018). Não fotografe telas nem repasse informações de outras pessoas.'))
A(fimcap())

# =========================== 10. GLOSSÁRIO ===========================
A(cap('Glossário', 'Os termos usados no sistema, em ordem alfabética.'))
gl = [
    ('Ajuda de custo', 'Valor pago por visita de campo feita, calculado pelo tempo, pela distância e pela refeição.'),
    ('Arlo', 'Sistema da FUNCERN onde a equipe é cadastrada e os pagamentos são lançados.'),
    ('AVA', 'Ambiente virtual de aprendizagem do curso FIC.'),
    ('Aval', 'Conferência e aprovação de um pedido de pagamento pela coordenação.'),
    ('Comprometido', 'Gasto que o sistema já conhece (aval, Arlo, autorização) e a planilha de gastos ainda não trouxe.'),
    ('Curso FIC', 'Curso de formação inicial e continuada do IFRN, feito pela coordenação técnica, pelas bolsistas e pelas agentes.'),
    ('Diagnóstico', 'Primeira visita ao quintal, em que se levanta a situação da família e se monta o plano.'),
    ('Entregas do mês', 'O que a bolsista entrega a cada mês (fotos, lista de presença, relatório, fichas, AVA e metas) para liberar a bolsa.'),
    ('Executado', 'Gasto que consta na planilha de gastos enviada pela coordenação geral.'),
    ('Ficha de indicação', 'Registro da mulher indicada pela comunidade, com os critérios do edital e o termo de consentimento.'),
    ('FUNCERN', 'Fundação de apoio ao IFRN, que faz os pagamentos e as contratações do projeto.'),
    ('Habilitação', 'Os passos que tornam a pessoa apta a visitar e a receber: curso FIC, cadastro no Arlo e termo de compromisso.'),
    ('Acompanhamento externo', 'Área só de leitura para o MDA e o MPA, com números do projeto e sem dado pessoal de ninguém. O acesso é liberado pela coordenação geral.'),
    ('Kit', 'Conjunto de itens do quintal (mudas, ferramentas, materiais), de até R$ 5.000 por quintal.'),
    ('Preço de referência', 'Valor estimado de cada item do kit, usado para projetar o investimento no quintal. Não é o preço da compra, que é feita por empresa contratada. Só a coordenação geral vê e mantém a lista, na aba Campo.'),
    ('Croqui', 'Desenho do quintal feito no papel na visita de diagnóstico e fotografado. Aparece dentro do plano do quintal e na folha impressa.'),
    ('Lista de espera', 'Mulheres que atendem aos critérios, mas não têm vaga entre as 40 do estado.'),
    ('Plano do quintal', 'O que será implantado em cada quintal: itens do kit e cronograma. É aprovado pela coordenação técnica.'),
    ('Roteiro de campo', 'A lista das visitas do mês, com data, mulher, etapa e quem visita.'),
    ('Rubrica', 'Cada linha do orçamento do TED, como bolsas, ajuda de custo e passagens.'),
    ('SUAP', 'Sistema acadêmico do IFRN, onde fica a matrícula do curso FIC.'),
    ('TED', 'Termo de Execução Descentralizada: o instrumento que repassa o recurso do projeto ao IFRN.'),
    ('Termo de compromisso', 'Documento que cada pessoa da equipe assina e anexa no próprio cadastro.'),
    ('Termo de consentimento', 'Autorização da mulher para o uso dos seus dados e da sua imagem, assinada com a ficha.'),
]
A('<dl class="glos">' + ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % x for x in sorted(gl, key=lambda x: x[0].lower())) + '</dl>')
A(fimcap())

A(novo.sobre())
corpo = ''.join(H)
def _L(m):
    t = next((x for x in toc if x[3] == m.group(2) and x[0] == 1), None)
    if m.group(1) == 'N': return t[2] if t else 'do manual do professor'
    return '<a href="#%s">%s</a>' % (t[1], t[2]) if t else '<span class="fora">outro manual</span>'
corpo = re.sub(r'\[\[([LN]):([^\]]+)\]\]', _L, corpo)

# ---------- sumário e "encontre rapidamente" ----------
def pg(i): return str(PAG.get(i, ''))
sumario = '<section class="sum"><h1 class="semn" id="sumario">Sumário</h1><ul>' + ''.join(
    '<li class="n%d"><a href="#%s"><span class="sn">%s</span><span class="st">%s</span><span class="pt"></span><span class="sp">%s</span></a></li>' % (n, i, num, t, pg(i)) for (n, i, num, t) in toc) + '</ul></section>'
def ref(i):
    t = next(x for x in toc if x[1] == i); return '<a href="#%s">%s %s</a>' % (i, t[2], t[3])
def sid(tit): return next((x[1] for x in toc if x[3] == tit), None)
rapido = [
    ('Saber quem faz cada ação', 'Quem faz o quê'), ('Entender as cores e as situações', 'Cores, selos e situações'), ('Ver os prazos do mês', 'O ciclo do mês e os prazos'), ('Saber o que posso fazer com os dados', 'Cuidado com os dados das pessoas (LGPD)'), ('Entender uma recusa do sistema', 'Mensagens do sistema e o que fazer'),
    ('Entrar pela primeira vez', 'Entrar no sistema'), ('Recuperar a senha', 'Entrar no sistema'), ('Anexar o termo de compromisso', 'Meus dados e termo de compromisso'),
    ('Instalar no celular e usar sem internet', 'Usar no celular e sem internet'), ('Ver o que pede atenção no projeto', 'Visão geral'), ('Cadastrar uma pessoa da equipe', 'Equipe'),
    ('Mandar o código de acesso', 'Equipe'), ('Desligar e substituir', 'Equipe'), ('Aprovar ou devolver uma ficha', 'Seleção das mulheres'), ('Aprovar o plano do quintal', 'Trabalho de campo'),
    ('Dar aval em um pagamento', 'Pagamentos'), ('Conferir o km de uma visita', 'Custos'), ('Conferir ou autorizar passagem e evento', 'Viagens e eventos'), ('Enviar a planilha de gastos', 'Execução do orçamento'),
    ('Anexar documento ou gerar o relatório', 'Documentos'), ('Imprimir relatórios e fichas de cadastro', 'Documentos'), ('Ver quem alterou um registro', 'Histórico'), ('Lançar a ficha de uma mulher', 'Lançar a ficha de uma mulher'), ('Agendar ou registrar uma visita', 'Agendar e registrar visitas'),
    ('Pedir bolsa ou ajuda de custo', 'Entregas do mês e pagamento'), ('Pedir passagem ou evento', 'Pedir passagem ou evento'),
]
def linha_r(tarefa, tit):
    i = sid(tit); t = next(x for x in toc if x[1] == i); return [tarefa, '<a href="#%s">%s %s</a>' % (i, t[2], t[3]), '<a href="#%s">%s</a>' % (i, pg(i))]
def linha_c(tarefa, tit):
    t = next((x for x in toc if x[3] == tit and x[0] == 1), None)
    return [tarefa, '<a href="#%s">%s %s</a>' % (t[1], t[2], t[3]), '<a href="#%s">%s</a>' % (t[1], pg(t[1]))] if t else None
extra = [x for x in [linha_c('Registrar encontro do FIC e presença', 'Professor(a) do curso FIC'), linha_c('Lançar pagamento no Arlo', 'Auxiliar administrativo'), linha_c('Resolver um problema comum', 'Dúvidas e solução de problemas'), linha_c('Entender um termo', 'Glossário')] if x]
encontre = '<section class="sum enc"><h1 class="semn" id="encontre">Encontre rapidamente</h1><p>Procure a tarefa e vá direto à seção. No PDF, toque no nome da seção para abrir.</p>' + tabela(['Quero…', 'Onde está', 'Pág.'], [linha_r(*x) for x in rapido if sid(x[1])] + extra, 'rap') + '</section>'

iso = open(REPO + 'assets/isotipo.svg', encoding='utf8').read()
iso = re.sub(r'<\?xml[^>]*\?>', '', iso)
capa = '''<section class="capa"><div class="capa-topo"><div class="capa-logo">%s</div><div class="capa-marca">Mulheres &amp; Quintais</div><div class="capa-sub">Quintais Produtivos para Mulheres Rurais</div></div>
<div class="capa-meio"><div class="capa-fio"></div><div class="capa-t">MANUAL DO USUÁRIO</div><div class="capa-n">Mulheres &amp; Quintais</div><div class="capa-d">Sistema de acompanhamento dos quintais produtivos</div>%s</div>
<div class="capa-pe"><div class="capa-parc">IFRN Campus Apodi · MDA · MPA · FUNCERN</div><div class="capa-v">Versão 1.0 — 2026</div><div class="capa-vs">Corresponde à versão %s do sistema · %s</div></div></section>''' % (iso, '<div class="capa-perfil">%s</div>' % PERFIS[PERFIL][0] if PERFIL else '', VER, QUANDO)

CSS = open(B + '/manual.css', encoding='utf8').read().replace('content:"Manual do Usuário"', 'content:"Manual do Usuário · %s"' % PERFIS[PERFIL][0] if PERFIL else 'content:"Manual do Usuário"').replace('FD/', 'file://' + FD).replace('ISO', 'file://' + B + '/iso_p.svg')
doc = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual do Usuário — Mulheres &amp; Quintais</title><style>%s</style></head><body><div class="cab-logo">%s</div>%s%s%s%s</body></html>' % (CSS, iso, capa, sumario, encontre, corpo)
doc = doc.replace('SHOTS/', os.environ.get('SHOTS', 'shots') + '/')
open(B + '/manual.html', 'w', encoding='utf8').write(doc)
json.dump([x[1] for x in toc], open(B + '/ids.json', 'w'))
print('ok', len(toc), 'entradas no sumário;', nfig[0], 'figuras')
