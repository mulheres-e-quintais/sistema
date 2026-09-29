/* Dados de referência do projeto, tirados do plano de trabalho, do Guia das bolsistas
   e do projeto técnico (Anexo F do Ofício 612/2026). Mude aqui, não no resto do código. */
window.MQ = window.MQ || {};

MQ.PROJETO = {
  nome: 'Quintais Produtivos para Mulheres Rurais',
  marca: 'Mulheres & Quintais',
  processo: '23136.001052.2026-19',
  ted: 'TED nº 30879420260063-006373 (7AAEKA)',
  vigencia: { inicio: '2026-09-14', fim: '2027-09-30' },
  inicioBolsas: '2026-10-01',
  prazoIndicacao: '2026-09-30',   // MPA indica coordenação técnica e as 10 bolsistas
  inicioDiagnosticos: '2026-10-23'
};

MQ.UFS = [
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'SE', nome: 'Sergipe' }
];

/* Metas por estado: 40 quintais, 40 diagnósticos, 2 visitas por quintal */
MQ.META_UF = { diagnosticos: 40, quintais: 40, visitas: 80 };

MQ.PAPEIS = {
  coord_geral:   { nome: 'Coordenação geral',    curto: 'Coord. geral',   bolsa: 70000 / 12, org: 'IFRN' },
  coord_tecnico: { nome: 'Coordenação técnica',  curto: 'Coord. técnica', bolsa: 56400 / 12, org: 'MPA' },
  articulacao:   { nome: 'Articulação estadual', curto: 'Articulação',    bolsa: 132000 / 5 / 12, org: 'MPA',
                   faz: 'Mobiliza as comunidades, organiza as atividades, acompanha as metas e elabora registros e relatórios.' },
  apoio:         { nome: 'Apoio estadual',       curto: 'Apoio',          bolsa: 96000 / 5 / 12, org: 'MPA',
                   faz: 'Cuida da logística, da coleta e organização das informações, dos registros das ações e do monitoramento.' },
  agente:        { nome: 'Agente de campo',      curto: 'Agente',         bolsa: null, org: 'MPA',
                   faz: 'Faz as visitas de diagnóstico, implantação e acompanhamento nos quintais atribuídos a ela, com ajuda de custo por dia de campo.' },
  auxiliar_adm:  { nome: 'Auxiliar administrativo', curto: 'Auxiliar adm.', bolsa: null, org: 'IFRN',
                   faz: 'Cadastra a equipe no Arlo (FUNCERN) e registra no sistema o cadastro no Arlo e o termo de compromisso assinado.' },
  professor_fic: { nome: 'Professor(a) do curso FIC', curto: 'Professor FIC', bolsa: null, org: 'IFRN',
                   faz: 'Dá as aulas do curso FIC e registra no sistema as turmas e a matrícula das bolsistas e agentes de campo.' }
};

/* Motivos de cancelamento previstos no item 5 do termo de compromisso */
MQ.MOTIVOS = [
  'Pedido da própria bolsista',
  'Descumprimento do plano de trabalho',
  'Dois meses seguidos sem relatório mensal',
  'Informação falsa',
  'Encerramento do projeto',
  'Outro motivo'
];

/* 29 municípios previstos no projeto técnico (a confirmar no cadastramento territorial) */
MQ.MUNICIPIOS = {
  AL: ['Cacimbinhas', 'Estrela de Alagoas', 'Palmeira dos Índios'],
  BA: ['Cansanção', 'Iraquara', 'Itiúba', 'Laje', 'Lençóis', 'Ponto Novo', 'Taperoá', 'Vitória da Conquista'],
  PE: ['Araripina', 'Bodocó', 'Cedro', 'Ouricuri', 'Serrita'],
  PI: ['Alagoinha do Piauí', 'Campo Grande do Piauí', 'Francisco Santos', 'Geminiano', 'Oeiras', 'Paulistana',
       'Pio IX', 'São João da Varjota', 'São Julião', 'Teresina'],
  SE: ['Neópolis', 'Pacatuba', 'Porto da Folha']
};

/* Formulários de campo (modelos v2, set/2026) — entram na próxima etapa */
MQ.FORMULARIOS = [
  { n: 1, nome: 'Ficha de indicação e seleção da beneficiária', quando: 'Antes do diagnóstico, aprovada pela coordenação técnica' },
  { n: 2, nome: 'Termo de consentimento de dados e uso de imagem', quando: 'Antes do diagnóstico' },
  { n: 3, nome: 'Diagnóstico e plano do quintal', quando: 'Parte A na 1ª visita, parte B na 2ª' },
  { n: 4, nome: 'Termo de recebimento do kit', quando: 'Na entrega do kit, com foto' },
  { n: 5, nome: 'Relatório de visita técnica', quando: 'Uma por visita' }
];

/* ---------- Ficha de indicação e seleção (modelo v2, set/2026) ---------- */
MQ.CRITERIOS = [
  ['c_agricultora', 'É mulher agricultora familiar e mora na comunidade atendida'],
  ['c_maior18', 'Tem 18 anos ou mais'],
  ['c_espaco', 'Tem espaço de quintal para produzir (próprio, cedido ou de uso da família)'],
  ['c_agua', 'Tem fonte de água que atende o quintal no período seco (cisterna de produção, poço, açude/barreiro, rede). Só carro-pipa ou só cisterna de consumo não contam'],
  ['c_disponibilidade', 'Tem disponibilidade para participar do diagnóstico, das visitas e das formações'],
  ['c_sem_kit', 'Não recebeu kit igual de outro programa nos últimos 2 anos'],
  ['c_sem_parentesco', 'Não é parente, até o 3º grau, de integrante da equipe do projeto (IFRN, FUNCERN, MPA ou bolsistas)'],
  ['c_casa_unica', 'Ninguém da mesma casa foi selecionado']
];
MQ.PRIORIDADES = [
  ['p_sustento', 'É a principal responsável pelo sustento da família', 2],
  ['p_cadunico', 'Família inscrita no CadÚnico', 2],
  ['p_sem_ater', 'Não tem acesso a assistência técnica (ATER) hoje', 2],
  ['p_raca_povo', 'Mulher negra, indígena, quilombola ou de comunidade tradicional', 1],
  ['p_jovem', 'Jovem de 18 a 29 anos', 1],
  ['p_grupo', 'Participa de grupo de mulheres, associação ou do MPA', 1],
  ['p_caf', 'Tem inscrição no CAF (Cadastro da Agricultura Familiar)', 1]
];
MQ.RESULTADOS = {
  selecionada:  { nome: 'Selecionada', cls: 'ok' },
  lista_espera: { nome: 'Lista de espera', cls: 'pend' },
  sem_agua:     { nome: 'Sem água: encaminhada', cls: 'crit' },
  nao_atende:   { nome: 'Não atende aos critérios', cls: 'off' }
};
MQ.SITUACOES = {
  aguardando: { nome: 'Aguardando aprovação', cls: 'pend' },
  aprovada:   { nome: 'Aprovada', cls: 'ok' },
  devolvida:  { nome: 'Devolvida para correção', cls: 'crit' }
};
MQ.VAGAS_UF = 40;
/* Perfil das bolsistas (Guia das bolsistas, item 3) */
MQ.PERFIL_BOLSISTA = {
  todas: ['Ser mulher, preferencialmente agricultora ou com atuação junto às mulheres do território.',
    'Morar no território de atuação do projeto ou próximo a ele.',
    'Ter vínculo com movimentos ou organizações do campo e experiência com agricultura familiar ou agroecologia.',
    'Ter disponibilidade para as atividades e para as visitas nos municípios do estado.',
    'Ter celular com internet para acessar o curso, fotografar as atividades e enviar relatórios.',
    'Saber ler e escrever para preencher fichas e relatórios simples.',
    'Ter CPF e conta bancária ou chave Pix no próprio nome.'],
  articulacao: 'Conhecer as comunidades e lideranças locais e ter facilidade para mobilizar e organizar atividades.',
  apoio: 'Organização com registros, fotos e documentos, e disponibilidade para a logística das visitas.'
};
MQ.TERMO = {
  finalidade: 'O Projeto Quintais Produtivos para Mulheres Rurais, executado pelo IFRN com recursos do MDA, em parceria com o MPA e a FUNCERN, vai usar os seus dados só para: fazer o diagnóstico e o plano do seu quintal; comprar e entregar o kit e acompanhar a produção; prestar contas ao MDA e aos órgãos de controle (CGU, TCU); e produzir relatórios sem mostrar o seu nome quando os dados forem divulgados em números.',
  direitos: 'Você pode, a qualquer momento e sem custo, saber quais dados o projeto tem sobre você, pedir correção e retirar este consentimento. A retirada não apaga os registros que o projeto é obrigado a guardar para a prestação de contas. Os dados não serão vendidos nem repassados para outros fins (Lei nº 13.709/2018).'
};

/* ---------- Metas do plano de trabalho (versão final, 13 meses; mês 1 = set/2026) ---------- */
MQ.METAS = [
  { id: 'M1', nome: 'Equipe e coordenação', alvo: 12, un: 'meses com equipe ativa', ini: 1, fim: 13, fonte: 'equipe' },
  { id: 'M2', nome: 'Diagnósticos socioeconômicos e ambientais', alvo: 200, un: 'diagnósticos', ini: 2, fim: 5, fonte: 'diagnostico' },
  { id: 'M3', nome: 'Implantação dos quintais', alvo: 200, un: 'quintais implantados', ini: 5, fim: 10, fonte: 'implantacao' },
  { id: 'M4', nome: 'Visitas de acompanhamento', alvo: 400, un: 'visitas', ini: 5, fim: 12, fonte: 'visitas' },
  { id: 'M5', nome: 'Eventos de troca de saberes', alvo: 5, un: 'eventos', ini: 6, fim: 11, fonte: null },
  { id: 'M6', nome: 'Intercâmbio de experiências', alvo: 1, un: 'intercâmbio', ini: 5, fim: 11, fonte: null },
  { id: 'M7', nome: 'Acompanhamento pedagógico', alvo: 8, un: 'missões', ini: 4, fim: 12, fonte: null },
  { id: 'M8', nome: 'Relatório final', alvo: 1, un: 'relatório', ini: 13, fim: 13, fonte: null }
];
MQ.MARCOS = [
  { d: '2026-09-30', t: 'MPA indica a coordenação técnica e as 10 bolsistas' },
  { d: '2026-10-16', t: 'Termo de referência dos kits enviado à FUNCERN' },
  { d: '2026-10-23', t: 'Ata dos critérios de seleção assinada; início dos diagnósticos' },
  { d: '2027-01-31', t: 'Fim dos diagnósticos (Meta 2)' },
  { d: '2027-04-30', t: '2º repasse do MDA previsto' },
  { d: '2027-09-30', t: 'Fim da vigência do TED' }
];
MQ.PAINEL_FINANCEIRO = 'https://claude.ai/artifact/TMjzFNUUaKkgwk7RKFrXgm';

/* ---------- Trabalho de campo (Guia de viagens e ajuda de custo) ---------- */
MQ.DIAS_CAMPO_UF = 200;            // 40 quintais x 5 visitas (diagnóstico, implantação, 2 acompanhamentos, avaliação)
MQ.ETAPAS = {
  diagnostico:    { nome: 'Diagnóstico e plano', curto: 'Diagnóstico', max: 1 },
  implantacao:    { nome: 'Implantação', curto: 'Implantação', max: 1 },
  acompanhamento: { nome: 'Acompanhamento', curto: 'Acomp.', max: 2 },
  avaliacao:      { nome: 'Avaliação final', curto: 'Avaliação', max: 1 }
};
MQ.DIAG = {
  parentesco: ['Ela mesma', 'Cônjuge/companheiro', 'Filho(a)', 'Neto(a)', 'Pai/mãe', 'Irmão(ã)', 'Outro'],
  politicas: [['bolsa_familia', 'Bolsa Família'], ['aposentadoria', 'Aposentadoria / pensão'], ['bpc', 'BPC'], ['garantia_safra', 'Garantia-Safra'],
              ['paa', 'PAA'], ['pnae', 'PNAE'], ['pronaf', 'Crédito Pronaf'], ['ater', 'Assistência técnica (ATER)']],
  fontes_agua: [['cisterna_consumo', 'Cisterna de consumo'], ['cisterna_producao', 'Cisterna de produção'], ['poco', 'Poço'],
                ['acude', 'Açude / barreiro'], ['rede', 'Rede'], ['carro_pipa', 'Carro-pipa']],
  producao: [['hortalicas', 'Hortaliças'], ['frutiferas', 'Frutíferas'], ['medicinais', 'Plantas medicinais'], ['graos', 'Grãos / feijão / milho'],
             ['galinhas', 'Galinhas'], ['animais', 'Porcos / cabras / ovelhas'], ['outros', 'Outros']],
  praticas: [['compostagem', 'Faz compostagem / adubo orgânico'], ['esterco', 'Usa esterco'], ['sementes', 'Guarda sementes crioulas'],
             ['veneno', 'Usa veneno / agrotóxico'], ['adubo_quimico', 'Usa adubo químico'], ['cobertura', 'Faz cobertura do solo']],
  participa: [['associacao', 'Associação'], ['sindicato', 'Sindicato'], ['grupo_mulheres', 'Grupo de mulheres'], ['mpa', 'MPA'], ['cooperativa', 'Cooperativa']],
  objetivos: [['alimentacao', 'Alimentação da família'], ['venda', 'Venda do excedente'], ['animais', 'Criação de pequenos animais'], ['medicinais', 'Plantas medicinais']],
  fotos: [['geral', 'Visão geral do quintal'], ['agua', 'Fonte de água'], ['plantio', 'Área de plantio'], ['croqui', 'Croqui desenhado (casa, água, canteiros, árvores, animais, cerca, norte)']]
};

/* ---------- Ajuda de custo por visita (valores padrão; a coordenação altera na aba Custos) ---------- */
/* Kit do quintal: até R$ 4.500 por quintal (plano de trabalho; a coordenação pode ajustar na aba Campo) */
MQ.KIT_QUINTAL = 4500;

/* localização negada: o navegador não pergunta de novo sozinho, então explicamos como liberar */
MQ.dicaGPS = (err, fim) => {
  if (!err || err.code !== 1) return 'Não foi possível pegar a localização agora. Vá para um lugar aberto e tente de novo' + (fim ? '; ' + fim : '.');
  const ua = navigator.userAgent || '';
  const dentroApp = /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua);
  const como = dentroApp ? 'Você abriu o link dentro do WhatsApp ou de outro aplicativo: abra no Chrome ou no Safari e tente de novo.'
    : /iPhone|iPad/i.test(ua) ? 'Para liberar: Ajustes > Privacidade > Serviços de Localização (ligado) > Safari > "Ao Usar o App"; depois recarregue a página.'
    : /Android/i.test(ua) ? 'Para liberar: toque no cadeado ao lado do endereço > Permissões > Localização > Permitir, e confira se a localização do celular está ligada; depois tente de novo.'
    : 'Para liberar: clique no cadeado ao lado do endereço > Localização > Permitir, e tente de novo.';
  return 'Localização bloqueada neste navegador. ' + como + (fim ? ' ' + fim : '');
};

MQ.CUSTO_PADRAO = {
  valor_hora: 50,
  horas: { diagnostico: 3, implantacao: 2, acompanhamento: 2, avaliacao: 2 },
  km_por_litro: 10,        // carro
  preco_litro: 6.50,       // gasolina, média ANP set/2026 ~R$ 6,52 (conferir no mês do pagamento)
  refeicao: 25,            // 1 refeição por visita
  fator_estrada: 1.3,      // linha reta × 1,3 ≈ distância pela estrada (estimativa)
  teto: 180000             // orçamento das ajudas de custo de campo no projeto inteiro (R$)
};
MQ.ETAPAS_CUSTO = { diagnostico: 'Diagnóstico', implantacao: 'Implantação', acompanhamento: 'Acompanhamento', avaliacao: 'Avaliação' };

/* ---------- Bancos (código de compensação) para o cadastro na FUNCERN ---------- */
MQ.BANCOS = [['001', 'Banco do Brasil'], ['104', 'Caixa Econômica Federal'], ['004', 'Banco do Nordeste'], ['237', 'Bradesco'], ['341', 'Itaú'],
  ['033', 'Santander'], ['260', 'Nubank'], ['077', 'Inter'], ['756', 'Sicoob'], ['748', 'Sicredi'], ['336', 'C6 Bank'], ['323', 'Mercado Pago'],
  ['380', 'PicPay'], ['290', 'PagBank'], ['212', 'Banco Original'], ['070', 'BRB'], ['041', 'Banrisul']];
