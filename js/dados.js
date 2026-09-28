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
                   faz: 'Cuida da logística, da coleta e organização das informações, dos registros das ações e do monitoramento.' }
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
