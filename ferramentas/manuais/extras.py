# Gera essencial.html (documento para o contratante) e guias.html (uma folha por perfil)
from base import *
iso = re.sub(r'<\?xml[^>]*\?>', '', open(REPO + 'assets/isotipo.svg', encoding='utf8').read())
CSS = open(B + '/manual.css', encoding='utf8').read().replace('FD/', 'file://' + FD)
CSS = CSS[:CSS.index('@page{')] + CSS[CSS.index('*{box-sizing'):]   # sem as regras de página do manual
def h2(t): return '<h2>%s</h2>' % t
def lista(itens, ord=False): return ('<ol class="passos">%s</ol>' if ord else '<ul class="lst">%s</ul>') % ''.join('<li>%s</li>' % x for x in itens)

# ---------------- documento para o contratante ----------------
E = []
E.append('<header class="doc-cab"><div class="doc-logo">%s</div><div><div class="doc-marca">Mulheres &amp; Quintais</div><div class="doc-proj">Quintais Produtivos para Mulheres Rurais · IFRN Campus Apodi</div></div></header>' % iso)
E.append('<h1 class="doc-t">Por que o sistema é essencial ao projeto</h1><p class="doc-sub">O que ele garante à execução, à prestação de contas e às próximas etapas</p>')
E.append('<div class="nums">%s</div>' % ''.join('<div><b>%s</b><span>%s</span></div>' % x for x in [('5', 'estados do Nordeste'), ('29', 'municípios previstos'), ('200', 'quintais, 40 por estado'), ('1.000', 'visitas de campo previstas'), ('1.700+', 'verificações automáticas a cada versão')]))
E.append(p('O sistema é o lugar único onde a execução do projeto acontece e fica registrada: quem foi selecionada, quem visitou, o que foi implantado, quanto custou e quem aprovou cada passo. Sem ele, esses registros ficariam espalhados em planilhas, papéis e mensagens de cinco estados.'))
E.append(h2('1. As regras do plano de trabalho são garantidas pelo banco de dados'))
E.append(p('As regras não dependem da atenção de quem digita. O banco recusa o que foge do plano, mesmo que a tela falhe ou alguém tente outro caminho.'))
E.append(tabela(['Risco para o projeto', 'O que o sistema faz'], [
    ['Selecionar mais mulheres do que o previsto', 'Aceita no máximo 40 selecionadas por estado, 200 no total'],
    ['A mesma mulher em dois estados, ou duas pessoas da mesma casa', 'Recusa CPF repetido e avisa quando duas fichas têm o mesmo endereço'],
    ['Implantar sem diagnóstico ou sem plano aprovado', 'As 5 visitas só acontecem em ordem; implantação só com plano aprovado'],
    ['Kit acima do valor aprovado', 'Limita o kit a R$ 5.000 por quintal'],
    ['Pagar visita não feita ou pagar duas vezes', 'Ajuda de custo só de visita registrada como feita; cada visita entra em um pedido só; uma bolsa por mês'],
    ['Pagar quem não está regular', 'Só visita e só recebe quem está habilitado: curso FIC, cadastro no Arlo e termo assinado'],
    ['Estourar passagens e eventos', 'Tetos por finalidade conferidos a cada pedido'],
    ['A mesma pessoa pedir, conferir e autorizar', 'Quem confere não autoriza o mesmo pedido; ninguém aprova o próprio pedido'],
    ['Equipe maior que o orçamento', 'Uma coordenação técnica, um auxiliar, dois professores, duas bolsistas por estado'],
]))
E.append(h2('2. O sistema mostra o problema a tempo e leva a quem resolve'))
E.append(p('Impedir o erro não basta: um projeto também falha pelo que deixa de acontecer. O sistema confere os prazos e os números a cada acesso, aponta o que está fora do previsto e abre, com um toque, a tela onde aquilo se resolve. Assim a coordenação age enquanto ainda dá tempo de cumprir a meta.'))
E.append(tabela(['O que o sistema percebe sozinho', 'Por que importa para o objetivo'], [
    ['Vaga da equipe sem pessoa, com o prazo de indicação chegando', 'Sem bolsista no estado, a seleção e as visitas não começam'],
    ['Pessoa da equipe sem habilitação completa', 'Ela não pode visitar nem receber'],
    ['Ficha esperando aprovação há mais de 5 dias', 'Sem aprovação, o diagnóstico não começa'],
    ['Estado com muitas fichas sem água no período seco', 'O quintal não se sustenta; é preciso encaminhar e chamar a lista de espera'],
    ['Visita com a data vencida', 'Etapa parada; o quintal seguinte também atrasa'],
    ['Planilha de gastos do mês não enviada', 'O executado fica desatualizado e o saldo, enganoso'],
    ['Gasto fora do ritmo do tempo de vigência', 'Sobra de recurso no fim, ou falta antes do fim'],
]))
E.append(p('O problema aparece para quem decide, em ordem de gravidade e com prazo; o botão Resolver abre a tela certa; e o item só sai da lista quando o problema acaba de fato, não quando alguém marca como visto.'))
E.append(h2('3. Cuidados contra falhas e perda de dados'))
E.append(lista([
    '<b>Campo sem internet.</b> Fichas, diagnósticos e visitas são preenchidos sem sinal, ficam guardados no celular com as fotos e sobem quando a conexão volta.',
    '<b>Envio repetido não duplica.</b> Se a rede cai no meio de um envio e a pessoa tenta de novo, o banco grava uma vez só.',
    '<b>Duas pessoas no mesmo registro.</b> Quem salva depois é avisado; ninguém apaga o trabalho do outro sem saber.',
    '<b>Nada é apagado.</b> Erro se corrige, pessoa se desliga, documento se arquiva. O histórico continua.',
    '<b>Testado a cada versão.</b> Mais de 1.700 verificações automáticas de tela e de banco, incluindo uso simultâneo e volume dez vezes maior que o do projeto.']))
E.append(h2('4. Localização dos quintais'))
E.append(p('Cada ficha e cada visita registram a localização pelo GPS do celular, no momento do registro. Isso dá ao projeto três coisas:'))
E.append(lista([
    '<b>Evidência de presença.</b> A visita paga tem data, fotos e ponto no mapa, feitos por quem estava lá.',
    '<b>Mapa de execução.</b> A coordenação vê, por estado e por município, onde estão os quintais e em que etapa cada um está.',
    '<b>Cálculo do deslocamento.</b> A distância entra no custo de cada visita e no planejamento do roteiro.'], True))
E.append(caixa('importante', 'O ponto exato do quintal mostra onde a mulher mora, então fica só dentro do sistema. Na página pública aparecem apenas totais por município, e município com menos de 3 mulheres não mostra o número (LGPD).'))
E.append(h2('5. Prestação de contas e base para novas execuções'))
E.append(lista([
    '<b>Rastro completo.</b> O histórico guarda quem cadastrou, alterou, aprovou, devolveu e pagou, com data e hora.',
    '<b>Orçamento visível.</b> Previsto, executado, comprometido e saldo de cada rubrica do TED, e o ritmo do gasto contra o tempo de vigência.',
    '<b>Metas do plano de trabalho.</b> Cada meta tem o número atualizado pelos registros, sem contagem manual.',
    '<b>Relatório da ação.</b> Sai dos dados do sistema, por período e por estado, sem nome nem CPF das beneficiárias.',
    '<b>Resultado medido.</b> O diagnóstico e a avaliação final fazem as mesmas perguntas sobre produção, alimentação e renda: dá para comparar o antes e o depois de cada família.']))
E.append(p('Ao final, o projeto deixa mais do que os 200 quintais. Deixa um registro estruturado para uma nova etapa ou outro território: o custo real de cada visita e de cada quintal, o tempo de cada etapa, o que funcionou em cada município, a lista de espera já identificada e as regras do plano de trabalho já programadas.'))
E.append(caixa('atencao', 'O sistema não substitui a FUNCERN nem o SUAP. O pagamento continua sendo feito no Arlo e a matrícula do curso FIC, no SUAP; o sistema organiza o pedido, o aval e o registro.'))
CSS_E = CSS + '''
@page{size:A4;margin:18mm 20mm 18mm;@bottom-left{content:"Mulheres & Quintais — Por que o sistema é essencial ao projeto";font:500 8pt Manrope;color:#6B594A}@bottom-right{content:counter(page);font:700 8.5pt Manrope;color:#452B1A}}
html{font-size:10pt;line-height:1.38}
.doc-cab{display:flex;align-items:center;gap:4mm;padding-bottom:4mm;border-bottom:.8pt solid var(--line)}
.doc-logo svg{width:11mm;height:auto;display:block}
.doc-marca{font:700 15pt Lora;color:var(--m)}.doc-proj{font-size:8.6pt;color:var(--ink2);font-weight:500}
h1.doc-t{font-weight:800;font-size:21pt;line-height:1.15;color:var(--m);margin:7mm 0 1.5mm}
.doc-sub{color:var(--t);font-weight:600;font-size:11pt;margin-bottom:5mm}
.nums{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;margin:0 0 5mm}
.nums div{background:var(--creme);border-radius:7pt;padding:7pt 8pt}
.nums b{display:block;font-weight:800;font-size:17pt;color:var(--t);line-height:1.1}
.nums span{font-size:8pt;color:var(--ink2);font-weight:500;line-height:1.25;display:block;margin-top:2pt}
h2{font-size:12.5pt;margin:6mm 0 2.5mm}
table{font-size:9pt;margin-bottom:3mm}td,th{padding:4pt 8pt}
td:first-child{width:45%;font-weight:600}
.cx{margin:3.5mm 0}
'''
CAPA_E = '''<section class="capa"><div class="capa-topo"><div class="capa-logo">%s</div><div class="capa-marca">Mulheres &amp; Quintais</div><div class="capa-sub">Quintais Produtivos para Mulheres Rurais</div></div>
<div class="capa-meio"><div class="capa-fio"></div><div class="capa-t ess">Por que o sistema é essencial ao projeto</div><div class="capa-d">O que ele garante à execução, à prestação de contas e às próximas etapas</div></div>
<div class="capa-pe"><div class="capa-parc">IFRN Campus Apodi</div><div class="capa-v">@@QUANDOC@@</div></div></section>''' % iso
CSS_E += '@page capa{margin:0;@bottom-left{content:none}@bottom-right{content:none}}.capa-t.ess{font-size:25pt;letter-spacing:0;line-height:1.18;max-width:140mm;margin:0 auto}'
open(B + '/essencial.html', 'w', encoding='utf8').write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Por que o sistema é essencial ao projeto — Mulheres &amp; Quintais</title><style>%s</style></head><body>%s%s</body></html>' % (CSS_E, CAPA_E, ''.join(E)))

# ---------------- guias rápidos, uma folha por perfil ----------------
END = 'mulheres-e-quintais.github.io/sistema'
ENTRAR = ('Entrar pela primeira vez', ['Abra o endereço que veio no WhatsApp.', 'Toque em <b>Primeiro acesso</b>.', 'Digite o e-mail e o código de 8 letras e números.', 'Crie a senha e toque em <b>Criar senha e entrar</b>.'])
TERMO = ('Anexar o seu termo de compromisso', ['Toque na sua foto e abra <b>Meus dados</b>.', 'Toque em <b>Gerar o termo preenchido</b>.', 'Assine no papel, ou salve em PDF e assine em <b>assinador.iti.br</b> (gov.br).', 'Anexe no mesmo lugar a foto do papel ou o PDF assinado.'])
OFF = ('Trabalhar sem internet', ['Antes de sair, abra o sistema com sinal.', 'No campo, preencha normalmente: fica guardado no celular.', 'Com sinal de volta, o envio é automático. Ou toque em <b>Enviar agora</b>.'])
G = [
 ('Coordenação geral', 'Acompanha o projeto, monta a equipe, dá aval e autoriza.', [
   ('Ver o que pede atenção', ['Abra a aba <b>Visão geral</b>.', 'Leia o quadro <b>O que pede atenção</b> de cima para baixo: o mais grave vem primeiro.', 'Toque em ' + b('Resolver', 'resolver') + ' e faça a ação na aba que abrir.']),
   ('Cadastrar uma pessoa e mandar o acesso', ['Na aba <b>Equipe</b>, toque no botão de cadastro da vaga.', 'Toque em <b>Gerar link de cadastro</b> e envie pelo WhatsApp.', 'Quando ela enviar, toque em <b>Conferir e cadastrar</b>.', 'Na ficha dela, toque em <b>Gerar código de acesso</b> e <b>Mandar por WhatsApp</b>.']),
   ('Atender um “Esqueci a senha”', ['Na aba <b>Equipe</b>, abra <b>Pedidos de novo acesso</b>.', 'Toque em <b>Liberar novo primeiro acesso</b>.', 'Mande o código pelo WhatsApp do cadastro.']),
   ('Dar aval em um pagamento', ['Na aba <b>Pagamentos</b>, abra o pedido em <b>Esperando o seu aval</b>.', 'Confira as visitas e o km, ou o relatório e as entregas.', 'Toque em <b>Dar aval</b> ou em <b>Devolver para correção</b>.']),
   ('Autorizar passagem ou evento', ['Na aba <b>Viagens e eventos</b>, abra o pedido já conferido.', 'Toque em <b>Autorizar</b>.', 'Toque em <b>Copiar texto</b> e envie à FUNCERN.']),
   ('Enviar a planilha de gastos do mês', ['Na aba <b>Execução</b>, toque em ' + b('Enviar planilha de gastos', 'enviar') + '.', 'Toque em <b>Ler a planilha</b> e confira a prévia.', 'Toque em <b>Enviar e usar esta planilha</b>.']),
  ], ['Até o último dia do mês: planilha de gastos enviada.', 'Quem confere um pedido de passagem ou evento não autoriza o mesmo pedido.', 'Desligamento não tem volta: para voltar, é cadastro novo.', 'São no máximo 2 professores do FIC, 1 coordenação técnica e 1 auxiliar.']),
 ('Coordenação técnica', 'Cadastra bolsistas e agentes, aprova fichas e planos, dá aval e confere.', [
   ('Cadastrar bolsista ou agente', ['Na aba <b>Equipe</b>, toque em ' + b('Cadastrar articulação', 'pessoa_mais') + ' (ou apoio, ou agente).', 'Toque em <b>Gerar link de cadastro</b> e envie pelo WhatsApp.', 'Quando ela enviar, toque em <b>Conferir e cadastrar</b>.', 'Na ficha dela, gere o código de acesso e mande por WhatsApp.']),
   ('Aprovar ou devolver uma ficha', ['Na aba <b>Seleção</b>, abra a ficha em <b>Para você aprovar</b>.', 'Confira os dados, os critérios e a foto do termo.', 'Toque em <b>Aprovar</b>, ou escreva o motivo e toque em <b>Devolver para correção</b>.']),
   ('Aprovar o plano do quintal', ['Na aba <b>Campo</b>, abra o diagnóstico em <b>Planos para você aprovar</b>.', 'Confira as fotos, o kit (até R$ 5.000) e o cronograma.', 'Toque em <b>Aprovar</b> ou em <b>Devolver para correção</b>.']),
   ('Dar aval na ajuda de custo e na bolsa', ['Na aba <b>Pagamentos</b>, abra o pedido em <b>Esperando o seu aval</b>.', 'Confira as visitas e o km, ou o relatório e as entregas.', 'Toque em <b>Dar aval</b> ou em <b>Devolver para correção</b>.']),
   ('Conferir o km de uma visita', ['Na aba <b>Custos</b>, escolha o mês.', 'Na linha da visita, digite o <b>Km conferido</b> (só a ida).', 'Saia do campo: salva sozinho.']),
   ('Conferir passagem ou evento', ['Na aba <b>Viagens e eventos</b>, abra o pedido.', 'Confira nomes iguais ao documento, CPF, RG, datas e quantidades.', 'Toque em <b>Conferido</b> ou em <b>Devolver para correção</b>.']),
  ], ['Ficha parada há mais de 5 dias entra em O que pede atenção.', 'São 40 selecionadas por estado: a 41ª vai para a lista de espera.', 'Só visita quem está habilitada (FIC, Arlo e termo).', 'Quem agenda a visita é a bolsista do estado.']),
 ('Bolsista de articulação e de apoio', 'Indica as mulheres, registra o campo, entrega o mês e pede o pagamento.', [
   ('Lançar a ficha de uma mulher', ['Toque em <b>+ Nova ficha de mulher</b>.', 'Preencha os dados e os critérios junto com ela.', 'Fotografe a ficha e o termo de consentimento assinado.', 'Toque em <b>Registrar localização</b> e em <b>Salvar</b>.']),
   ('Agendar uma visita', ['Toque em <b>Visitas e diagnósticos</b>.', 'Toque em <b>+ Agendar visita</b>.', 'Escolha o quintal, a etapa, a data e quem vai.', 'Toque em <b>Agendar</b>.']),
   ('Registrar uma visita', ['Em <b>Para fazer agora</b>, toque no botão da visita.', 'Preencha o diagnóstico ou escreva o relato. Pode usar <b>Falar</b>.', 'Faça as fotos e registre a localização.', 'Toque em <b>Salvar</b>.']),
   ('Marcar as entregas do mês', ['Toque em <b>Entregas do mês</b>.', 'Em cada entrega feita, toque em <b>Entreguei</b>.']),
   ('Pedir ajuda de custo e bolsa', ['Toque em <b>Pedir pagamento</b>.', 'Marque as visitas feitas no mês e toque em <b>Solicitar</b>.', 'Em <b>Bolsa</b>, escreva o relatório do mês e toque em <b>Solicitar bolsa</b>.']),
   OFF,
  ], ['Visita registrada como feita não muda mais: confira antes de salvar.', 'Peça a bolsa dentro do mês. O sistema lembra a partir do dia 20.', 'Feche o roteiro do mês seguinte até o dia 20.', 'Passagem: pedir 40 dias antes. Evento: 45 dias antes (só articulação).']),
 ('Agente de campo', 'Registra as visitas atribuídas a você e pede a ajuda de custo.', [
   ENTRAR,
   ('Ver as suas visitas', ['Toque em <b>Minhas próximas visitas</b>.', 'Veja a data, a mulher e o endereço de cada uma.']),
   ('Registrar uma visita', ['Toque no botão da visita: <b>Registrar diagnóstico</b>, <b>Registrar visita feita</b> ou <b>Registrar avaliação</b>.', 'Preencha ou escreva o relato. Pode usar <b>Falar</b>.', 'Faça as fotos e registre a localização.', 'Toque em <b>Salvar</b>.']),
   ('Pedir a ajuda de custo', ['Toque em <b>Pedir ajuda de custo</b>.', 'Marque as visitas feitas no mês.', 'Toque em <b>Solicitar</b>.']),
   OFF, TERMO,
  ], ['Você só vê os quintais atribuídos a você, e só depois de habilitada (FIC, Arlo e termo).', 'Só é paga a visita registrada no sistema, com fotos e localização.', 'Para mudar a data de uma visita, fale com a bolsista do estado.', 'Abra no Chrome ou no Safari, não por dentro do WhatsApp.']),
 ('Professor(a) do curso FIC', 'Cria turmas, matricula, registra encontros e presença, confirma o AVA.', [
   ('Criar uma turma', ['Toque em <b>+ Nova turma</b>.', 'Dê o nome, o estado (ou vários) e as datas.', 'Toque em <b>Criar turma</b>.']),
   ('Matricular', ['Na turma, toque em <b>+ Matricular</b>.', 'Marque as pessoas e digite o número da matrícula no SUAP.', 'Confira a data e toque em <b>Salvar</b>.']),
   ('Registrar um encontro e a presença', ['Toque em ' + b('Registrar encontro', 'calendario') + '.', 'Informe a turma, a data, a carga horária e a modalidade.', 'Escreva o que foi trabalhado e marque quem participou.', 'Toque em <b>Registrar encontro</b>.']),
   ('Confirmar o acesso ao AVA', ['Em <b>Acesso ao AVA no mês</b>, confira o mês.', 'Marque quem entrou e fez as atividades. Salva na hora.']),
   ('Pedir a sua bolsa', ['Toque em <b>Pedir a minha bolsa</b>.', 'Escreva o relatório do mês e solicite.']),
   TERMO,
  ], ['A matrícula é um passo da habilitação: sem ela, a pessoa não visita nem recebe.', 'Encontro lançado por engano não é apagado: use <b>Cancelar encontro</b>.', 'Até 12 horas de encontro por dia.', 'Depois de pedida a bolsa do mês, os encontros do mês não mudam mais.']),
 ('Auxiliar administrativo', 'Registra o cadastro no Arlo, confere o termo e lança os pagamentos.', [
   ENTRAR,
   ('Registrar o cadastro no Arlo', ['Toque em <b>Cadastrar no Arlo</b>.', 'Abra a pessoa e, se precisar, toque em <b>Ver conta e Pix</b>.', 'Cadastre no Arlo.', 'Volte, toque em <b>Registrar passos da habilitação</b>, em <b>Hoje</b> e em <b>Salvar</b>.']),
   ('Conferir o termo de compromisso', ['Abra a pessoa e toque em <b>Abrir o termo</b>.', 'Confira se está preenchido e assinado. Assinado pelo gov.br: valide em <b>validar.iti.br</b>.', 'Registre a data em <b>Registrar passos da habilitação</b>.']),
   ('Lançar um pagamento no Arlo', ['Toque em <b>Lançar pagamentos no Arlo</b>.', 'Abra o pedido, lance o valor no Arlo e digite o protocolo.', 'Toque em <b>Registrar: lançado no Arlo</b>.']),
   TERMO,
  ], ['Cada consulta a conta bancária e Pix fica registrada no histórico.', 'Sem o termo anexado pela própria pessoa, o sistema não aceita a data do termo.', 'Só chega para lançar o pedido que já tem aval.', 'Não repasse dados bancários por WhatsApp ou e-mail.']),
]
P = []
for nome, papel, tarefas, lembre in G:
    cards = ''.join('<div class="gc"><h3>%s</h3><ol class="passos">%s</ol></div>' % (t, ''.join('<li>%s</li>' % x for x in ps)) for t, ps in tarefas)
    P.append('''<section class="guia"><header><div class="g-logo">%s</div><div class="g-id"><div class="g-marca">Mulheres &amp; Quintais</div><div class="g-k">Guia rápido</div></div><div class="g-end"><span>Endereço do sistema</span><b>%s</b></div></header>
<h1>%s</h1><p class="g-papel">%s</p><div class="g-grade">%s</div>
<div class="g-pe"><div class="g-lembre"><div class="rot">Lembre-se</div><ul class="lst">%s</ul></div><div class="g-ajuda"><div class="rot">Precisa de ajuda?</div><p>Em qualquer tela, toque em %s.</p><p>Para entrar no sistema: coordenação do projeto, WhatsApp <b>(84) 9 9992-7943</b>.</p><p class="g-lgpd">Os dados das pessoas são protegidos pela LGPD: não fotografe telas nem repasse informações.</p></div></div>
<footer>Guia rápido · %s · versão @@VER@@ do sistema, @@QUANDO@@ · Passo a passo completo no Manual do Usuário</footer></section>''' % (iso, END, nome, papel, cards, ''.join('<li>%s</li>' % x for x in lembre), ic('ajuda'), nome))
CSS_G = CSS + '''
@page{size:A4;margin:0}
html{font-size:10pt;line-height:1.38}
.guia{width:210mm;height:297mm;padding:13mm 15mm 10mm;display:flex;flex-direction:column;break-after:page;overflow:hidden}
.guia header{display:flex;align-items:center;gap:3.5mm;padding-bottom:4mm;border-bottom:.8pt solid var(--line)}
.g-logo svg{width:9mm;height:auto;display:block}
.g-marca{font:700 12.5pt Lora;color:var(--m);line-height:1.1}
.g-k{font-weight:800;font-size:7.6pt;letter-spacing:.14em;text-transform:uppercase;color:var(--t);margin-top:1pt}
.g-end{margin-left:auto;text-align:right;font-size:9pt}.g-end span{display:block;font-size:7.4pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)}.g-end b{color:var(--m)}
.guia h1{font-weight:800;font-size:23pt;line-height:1.1;color:var(--m);margin:6mm 0 1mm}
.g-papel{color:var(--ink2);font-weight:500;font-size:10.5pt;margin-bottom:5mm}
.g-grade{display:grid;grid-template-columns:1fr 1fr;gap:4mm;flex:1}
.gc{border:.7pt solid var(--line);border-top:2.5pt solid var(--t);border-radius:7pt;padding:8pt 10pt 4pt;background:#fff}
.gc h3{margin:0 0 5pt;font-weight:700;font-size:11pt;color:var(--m)}
.gc ol.passos li{margin-bottom:3.5pt;padding-left:19pt}
.gc ol.passos li::before{width:13.5pt;height:13.5pt;line-height:13.5pt;font-size:7.8pt}
.g-pe{display:grid;grid-template-columns:1.25fr 1fr;gap:4mm;margin-top:4mm}
.g-pe>div{border-radius:7pt;padding:8pt 10pt 5pt}
.g-pe .rot{margin-top:0}
.g-lembre{background:var(--creme)}.g-lembre ul.lst{margin-bottom:2pt}
.g-ajuda{background:#EDF3EA}.g-ajuda .rot{color:#3C6238}.g-ajuda p{margin-bottom:4pt}
.g-lgpd{font-size:8.4pt;color:var(--ink2)}
.guia footer{margin-top:4mm;padding-top:2.5mm;border-top:.6pt solid var(--line);font-size:7.6pt;color:var(--ink2);font-weight:500}
'''
open(B + '/guias.html', 'w', encoding='utf8').write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guias rápidos por perfil — Mulheres &amp; Quintais</title><style>%s</style></head><body>%s</body></html>' % (CSS_G, ''.join(P)))
for f in ('/essencial.html', '/guias.html'):
    t = open(B + f, encoding='utf8').read().replace('@@VER@@', VER).replace('@@QUANDOC@@', QUANDO.capitalize()).replace('@@QUANDO@@', QUANDO)
    open(B + f, 'w', encoding='utf8').write(t)
print('ok')
