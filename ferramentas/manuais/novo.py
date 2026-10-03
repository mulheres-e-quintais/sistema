# conteúdo novo, inserido em gerar.py por marcadores
from base import *
S = '<span class="sim"></span>'; N = ''
def matriz():
    L = [
     ('Cadastrar coordenação técnica, professores e auxiliar', S,N,N,N,N,N),
     ('Cadastrar bolsistas e agentes', S,S,N,N,N,N),
     ('Lançar a ficha de uma mulher', N,N,S,N,N,N),
     ('Aprovar ou devolver ficha', S,S,N,N,N,N),
     ('Agendar visita', N,N,S,N,N,N),
     ('Registrar visita, diagnóstico e avaliação', N,N,S,S,N,N),
     ('Aprovar o plano do quintal', S,S,N,N,N,N),
     ('Pedir ajuda de custo', N,N,S,S,N,N),
     ('Pedir bolsa', N,S,S,N,S,S),
     ('Dar aval: ajuda de custo e bolsa das bolsistas', S,S,N,N,N,N),
     ('Dar aval: bolsa da coord. técnica, professores e auxiliar', S,N,N,N,N,N),
     ('Registrar o Arlo e conferir o termo', N,N,N,N,N,S),
     ('Lançar pagamento no Arlo', N,N,N,N,N,S),
     ('Pedir passagem ou evento', N,N,'<span class="sim"></span><sup>1</sup>',N,N,N),
     ('Conferir passagem ou evento', S,S,N,N,N,N),
     ('Autorizar passagem ou evento', S,N,N,N,N,N),
     ('Criar turma, matricular, registrar encontro e presença', S,N,N,N,S,N),
     ('Enviar planilha de gastos, documentos e histórico', S,N,N,N,N,N),
     ('Imprimir relatórios por tipo e fichas de cadastro', S,N,N,N,N,N),
    ]
    return tabela(['Ação', 'Coord. geral', 'Coord. técnica', 'Bolsista', 'Agente', 'Professor', 'Auxiliar'], [list(x) for x in L], 'mat') + \
      '<p class="nota"><sup>1</sup> Só a bolsista de articulação estadual. &nbsp;Ninguém dá aval, confere ou autoriza o próprio pedido, e quem confere um pedido de passagem ou evento não autoriza o mesmo pedido.</p>'

def quem_faz():
    return sec('Quem faz o quê') + p('Use esta tabela para tirar a dúvida “isso é comigo?”. O ponto marca quem faz a ação no sistema.') + matriz()

def cores():
    c = lambda cls, t: '<span class="cor %s"></span>%s' % (cls, t)
    h = sec('Cores, selos e situações')
    h += p('As cores dizem a mesma coisa em todas as telas. Na dúvida, comece pelo vermelho.')
    h += tabela(['Cor', 'Selo na Visão geral', 'O que significa', 'O que fazer'], [
        [c('crit', 'Vermelho'), 'Requer ação', 'Prazo vencido ou risco para o projeto', 'Resolver primeiro'],
        [c('pend', 'Âmbar'), 'Atenção', 'Algo espera por você ou o prazo está chegando', 'Resolver dentro do prazo'],
        [c('ok', 'Verde'), '—', 'Em dia', 'Nada a fazer'],
        [c('info', 'Cinza'), 'Aviso', 'Informação para acompanhar', 'Consultar quando puder'],
    ], 'cores')
    h += p('Os quadros que têm tarefa sua ganham uma faixa colorida no alto, na cor da situação. Quadro sem faixa não pede ação.')
    h += h3('Situações que você vai encontrar')
    h += tabela(['Registro', 'Situações, na ordem'], [
        ['Ficha da mulher', 'Aguardando aprovação <span class="seta">›</span> Aprovada, ou Devolvida para correção'],
        ['Visita', 'Agendada <span class="seta">›</span> Feita. Pode ser cancelada antes de feita; com a data vencida, aparece em vermelho'],
        ['Plano do quintal', 'Enviado com o diagnóstico <span class="seta">›</span> Aprovado, ou devolvido para correção'],
        ['Pedido de bolsa ou ajuda de custo', 'Solicitado <span class="seta">›</span> Com aval <span class="seta">›</span> Lançado no Arlo. Pode ser devolvido para correção'],
        ['Pedido de passagem ou evento', 'Enviado <span class="seta">›</span> Conferido <span class="seta">›</span> Autorizado. Pode ser devolvido para correção'],
        ['Pessoa da equipe', 'Habilitação pendente <span class="seta">›</span> Habilitada (FIC, Arlo e termo). Desligada não volta'],
    ])
    return h

def ciclo():
    h = sec('O ciclo do mês e os prazos')
    h += p('O trabalho se repete todo mês na mesma ordem. Cada passo depende do anterior.')
    h += fluxo('O mês de quem recebe pelo projeto', [
        ('Durante o mês', 'Visitas e encontros', False), ('Durante o mês', 'Entregas marcadas', False), ('A partir do dia 20', 'Pedido de bolsa', False),
        ('Coordenação', 'Aval', False), ('Auxiliar', 'Lança no Arlo', True)], linhas=1, W=124, G=18)
    h += tabela(['Quando', 'O quê', 'Quem'], [
        ['Durante o mês', 'Registrar cada visita no dia em que é feita; registrar os encontros do FIC e confirmar a presença', 'Bolsista, agente, professor'],
        ['Até o dia 20', 'Fechar o roteiro de visitas do mês seguinte', 'Bolsista do estado'],
        ['A partir do dia 20', 'O sistema lembra quem ainda não pediu a bolsa do mês e lembra de enviar a planilha de gastos', 'Quem recebe bolsa; coordenação geral'],
        ['Até o último dia do mês', 'Marcar as entregas e pedir a bolsa: quem pede no mês recebe o mês todo', 'Quem recebe bolsa'],
        ['Até o último dia do mês', 'Enviar a planilha de gastos do mês', 'Coordenação geral'],
        ['Depois do pedido', 'Dar o aval e lançar no Arlo', 'Coordenação; auxiliar'],
    ], 'ciclo')
    h += h3('Prazos que o sistema confere')
    h += tabela(['Prazo', 'Vale para'], [
        ['7 dias', 'Código de primeiro acesso. Depois disso, peça outro'],
        ['5 dias', 'Ficha aguardando aprovação. Passou disso, entra em O que pede atenção'],
        ['40 dias antes da viagem', 'Pedido de passagem aérea. Fora do prazo, só com justificativa'],
        ['45 dias antes', 'Pedido de estrutura de evento. Fora do prazo, só com justificativa'],
        ['15 minutos', 'Tempo sem uso até o sistema sair sozinho'],
        ['24 horas', 'Tempo em que o formulário pela metade fica guardado no aparelho'],
    ], 'curta')
    h += caixa('importante', 'O dia em que o dinheiro cai na conta é definido pela FUNCERN, não pelo sistema. O sistema mostra só até onde o pedido chegou.')
    return h

def lgpd():
    h = sec('Cuidado com os dados das pessoas (LGPD)')
    h += serve('O sistema guarda nome, CPF, endereço, localização, renda, fotos e conta bancária de mulheres rurais e da equipe. Esses dados são protegidos pela Lei nº 13.709/2018 e só podem ser usados para o projeto.')
    h += '<div class="duas"><div class="pode"><div class="rot">Pode</div><ul class="lst">%s</ul></div><div class="naopode"><div class="rot">Não pode</div><ul class="lst">%s</ul></div></div>' % (
        ''.join('<li>%s</li>' % x for x in [
            'Consultar os dados das pessoas e dos quintais que são do seu trabalho.',
            'Fotografar a ficha e o termo de consentimento pelo próprio sistema.',
            'Fotografar o quintal e a mulher, com o termo de consentimento assinado.',
            'Divulgar números por estado e por município.',
            'Usar o relatório da ação: ele já sai sem nome e sem CPF.']),
        ''.join('<li>%s</li>' % x for x in [
            'Fotografar ou copiar telas com dados de outras pessoas.',
            'Mandar nome, CPF, endereço ou localização por WhatsApp, e-mail ou rede social.',
            'Publicar foto em que apareça criança: a autorização não inclui crianças.',
            'Mostrar onde uma mulher mora fora do sistema: o mapa é só de uso interno.',
            'Emprestar a sua senha ou usar o acesso de outra pessoa.']))
    h += tabela(['O que o sistema já faz por você', ''], [
        ['Cada perfil vê só o que é do seu trabalho', 'A bolsista não vê CPF nem e-mail das colegas; a agente vê só os quintais dela'],
        ['Conta bancária e Pix', 'Cada consulta fica registrada no histórico, com quem consultou e quando'],
        ['Página pública', 'Mostra só totais; município com menos de 3 mulheres não mostra o número'],
        ['Histórico', 'Guarda quem cadastrou, alterou e aprovou cada registro'],
    ], 'curta sem-cab')
    h += caixa('atencao', 'Perdeu o celular ou acha que alguém usou a sua senha? Avise a coordenação geral na hora, pelo WhatsApp (84) 9 9992-7943, para trocar o acesso.')
    return h

def mensagens():
    h = sec('Mensagens do sistema e o que fazer')
    h += p('Quando o sistema recusa uma ação, ele diz o motivo. Estas são as recusas mais comuns.')
    h += tabela(['A mensagem diz', 'O que fazer'], [
        ['O estado já tem 40 selecionadas aprovadas', 'Coloque a mulher na lista de espera'],
        ['Esta mulher (CPF) já tem ficha no projeto', 'Ela já foi indicada, talvez em outro estado. Fale com a coordenação técnica'],
        ['Este CPF é de uma pessoa ativa da equipe', 'Quem trabalha no projeto não entra como beneficiária. Confira o CPF'],
        ['CPF inválido', 'Confira os 11 números, sem pontos nem traço'],
        ['Ela tem menos de 18 anos na data da ficha', 'Não pode ser selecionada nem entrar na lista de espera'],
        ['Primeiro o diagnóstico', 'Implantação, acompanhamento e avaliação só depois do diagnóstico feito'],
        ['Este quintal já tem essa visita agendada ou feita', 'Altere a visita que já existe, em vez de agendar outra'],
        ['A pessoa ainda não está habilitada (FIC, Arlo e termo)', 'Ela não pode visitar. Veja na ficha dela qual passo falta'],
        ['O kit passa do valor por quintal (teto de R$ 5.000,00)', 'Tire ou troque itens do plano'],
        ['O estado já usou os 200 dias de campo previstos', 'Não há mais visitas a agendar no estado. Fale com a coordenação'],
        ['Passa do teto de passagens (ou de eventos)', 'O pedido não cabe no saldo. A mensagem mostra o saldo; reduza o pedido'],
        ['Ninguém confere o próprio pedido', 'Outra pessoa da coordenação precisa conferir'],
        ['A bolsa deste mês já foi pedida', 'O encontro ou a entrega do mês não muda mais. Se a coordenação devolver o pedido, reabre'],
        ['O projeto tem no máximo 2 professores do FIC ativos', 'Desligue um antes de cadastrar outro'],
        ['Já há coordenação técnica (ou auxiliar) ativa', 'Desligue a pessoa atual antes de cadastrar outra'],
        ['Este cadastro está desligado e não é mais alterado', 'Peça a correção à coordenação geral'],
        ['Este registro foi alterado por outra pessoa enquanto você editava', 'Abra de novo, confira e refaça a sua alteração'],
    ], 'msg')
    return h

def sobre():
    h = cap('Sobre este manual', 'A que versão do sistema ele corresponde e o que mudou.')
    h += p('O sistema é atualizado com frequência. Este manual descreve a versão indicada abaixo; se uma tela estiver diferente do que você vê, vale a tela, e a ajuda ' + ic('ajuda') + ' de cada tela está sempre atualizada.')
    h += tabela(['Versão do manual', 'Data', 'Versão do sistema', 'O que mudou'], [
        ['1.0', QUANDO.capitalize(), VER, 'Gerado a partir das telas desta versão do sistema'],
    ], 'ver')
    h += caixa('dica', 'Para a consulta do dia a dia há uma folha de guia rápido para cada perfil, com as tarefas mais comuns.')
    h += p('Dúvidas e correções deste manual: coordenação do projeto, WhatsApp (84) 9 9992-7943.')
    return h + fimcap()
