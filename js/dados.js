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
  prazoIndicacao: '2026-10-09',   // (prorrogado em 29/09/2026) MPA indica coordenação técnica e as 10 bolsistas
  inicioDiagnosticos: '2026-10-23'
};

/* Modelos do termo: a pessoa baixa, preenche com os dados dela, assina e anexa no próprio cadastro.
   São dois, porque são documentos diferentes (decisão de 02/10/2026):
   - servidor: servidores do IFRN (professores do FIC e auxiliar administrativo) usam o termo de autorização de participação
     em programa gerenciado pela FUNCERN (Anexo I da Portaria 017/2017 – SUP/FUNCERN), com parecer da chefia e da direção-geral;
   - bolsista: coordenação técnica, bolsistas e agentes de campo (MPA, não são servidores) usam o termo de compromisso do projeto.
   Os arquivos ficam na pasta modelos/. Sem arquivo (''), a tela não mostra o link e orienta a pedir o modelo a quem confere. */
MQ.MODELOS_TERMO = {
  servidor: { arquivo: 'modelos/Modelo_termo_de_autorizacao_servidor_IFRN.docx', nome: 'termo de autorização de participação (servidor do IFRN)',
              como: 'Preencha os campos entre colchetes, assine e colha o parecer da chefia imediata e da direção-geral do seu campus.' },
  bolsista: { arquivo: 'modelos/Modelo_termo_de_compromisso_bolsista_e_agente.pdf', nome: 'termo de compromisso',
              como: 'Imprima, preencha com os seus dados e assine. Sem impressora, peça uma cópia à coordenação técnica.' }
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
  coord_geral:   { nome: 'Coordenação geral',    curto: 'Coord. geral',   bolsa: 5000, org: 'IFRN' },   // 14 meses × R$ 5.000 = R$ 70.000 (planilha do TED; decisão de 01/10/2026)
  coord_tecnico: { nome: 'Coordenação técnica',  curto: 'Coord. técnica', bolsa: 56400 / 12, org: 'MPA' },
  articulacao:   { nome: 'Articulação estadual', curto: 'Articulação',    bolsa: 132000 / 5 / 12, org: 'MPA',
                   faz: 'Mobiliza as comunidades, organiza as atividades, acompanha as metas e elabora registros e relatórios.' },
  apoio:         { nome: 'Apoio estadual',       curto: 'Apoio',          bolsa: 96000 / 5 / 12, org: 'MPA',
                   faz: 'Cuida da logística, da coleta e organização das informações, dos registros das ações e do monitoramento.' },
  agente:        { nome: 'Agente de campo',      curto: 'Agente',         bolsa: null, org: 'MPA',
                   faz: 'Faz as visitas de diagnóstico, implantação e acompanhamento nos quintais atribuídos a ela, com ajuda de custo por dia de campo.' },
  auxiliar_adm:  { nome: 'Auxiliar administrativo', curto: 'Auxiliar adm.', bolsa: 1200, org: 'IFRN',
                   faz: 'Cadastra a equipe no Arlo (FUNCERN) e registra no sistema o cadastro no Arlo e o termo de compromisso assinado.' },
  professor_fic: { nome: 'Professor(a) do curso FIC', curto: 'Professor FIC', bolsa: 2200, org: 'IFRN',
                   faz: 'Dá as aulas do curso FIC e registra no sistema as turmas e a matrícula da coordenação técnica, das bolsistas e das agentes de campo.' }
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

/* ---------- Metas do plano de trabalho (versão final, 13 meses; mês 1 = set/2026) ----------
   valor: o que o Plano de Trabalho destina diretamente à meta (itens 14.4 a 14.7 com "META n").
   M2: ajuda de custo do diagnóstico 50 mil · M3: implantação dos quintais 1 milhão + ajuda de custo 50 mil ·
   M4: ajuda de custo do acompanhamento 100 mil · M5: eventos 30 mil · M6: passagens do intercâmbio 70 mil ·
   M7: diárias 11,2 mil + passagens 22,4 mil + veículo 8,4 mil. M1 e M8 usam itens de TODAS as metas (bolsas, despesas operacionais). */
MQ.METAS = [
  { id: 'M1', nome: 'Equipe e coordenação', alvo: 12, un: 'meses com equipe ativa', ini: 1, fim: 13, fonte: 'equipe' },
  { id: 'M2', nome: 'Diagnósticos socioeconômicos e ambientais', alvo: 200, un: 'diagnósticos', ini: 2, fim: 5, fonte: 'diagnostico', valor: 50000 },
  { id: 'M3', nome: 'Implantação dos quintais', alvo: 200, un: 'quintais implantados', ini: 5, fim: 10, fonte: 'implantacao', valor: 1050000 },
  { id: 'M4', nome: 'Visitas de acompanhamento', alvo: 400, un: 'visitas', ini: 5, fim: 12, fonte: 'visitas', valor: 100000 },
  { id: 'M5', nome: 'Eventos de troca de saberes', alvo: 5, un: 'eventos', ini: 6, fim: 11, fonte: null, valor: 30000 },
  { id: 'M6', nome: 'Intercâmbio de experiências', alvo: 1, un: 'intercâmbio', ini: 5, fim: 11, fonte: null, valor: 70000 },
  { id: 'M7', nome: 'Acompanhamento pedagógico', alvo: 8, un: 'missões', ini: 4, fim: 12, fonte: null, valor: 42000 },
  { id: 'M8', nome: 'Relatório final', alvo: 1, un: 'relatório', ini: 13, fim: 13, fonte: null }
];
/* meta: a meta do plano de trabalho a que o marco pertence (o 2º repasse é financeiro: não é de uma meta só).
   feito: o marco sai da lista quando o sistema já mostra que aconteceu (equipe completa, 1º diagnóstico, Meta 2 concluída) */
MQ.MARCOS = [
  { d: '2026-10-09', t: 'MPA indica a coordenação técnica e as 10 bolsistas', feito: 'equipe', meta: 'M1' },
  { d: '2026-10-16', t: 'Termo de referência dos kits enviado à FUNCERN', meta: 'M3' },
  { d: '2026-10-23', t: 'Ata dos critérios de seleção assinada; início dos diagnósticos', feito: 'diagnostico_inicio', meta: 'M2' },
  { d: '2027-01-31', t: 'Fim dos diagnósticos', feito: 'M2', meta: 'M2' },
  { d: '2027-04-30', t: '2º repasse do MDA previsto' },
  { d: '2027-09-30', t: 'Fim da vigência do TED', meta: 'M8' }
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
  fotos: [['geral', 'Visão geral do quintal'], ['agua', 'Fonte de água'], ['plantio', 'Área de plantio'], ['mulher', 'Retrato dela: o rosto (opcional)'], ['croqui', 'Croqui desenhado (casa, água, canteiros, árvores, animais, cerca, norte)']]
};

/* ---------- Ajuda de custo por visita (valores padrão; a coordenação altera na aba Custos) ---------- */
/* Kit do quintal: até R$ 5.000 por quintal (plano de trabalho, item 14.7: 200 × R$ 5.000 = R$ 1 milhão; confirmado pela coordenação em 01/10/2026) */
MQ.KIT_QUINTAL = 5000;

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
/* tetos de gasto (35_tetos_passagens_eventos.sql e 46_regras_decididas.sql): evento por estado; passagens no projeto todo, um teto por finalidade.
   "passagem" é o teto do INTERCÂMBIO (nome antigo, mantido); passagem antiga, sem finalidade, conta no intercâmbio. */
MQ.TETOS = { evento: 6000, passagem: 70000, passagem_pedagogico: 22400 };
MQ.tetoPassagem = finalidade => finalidade === 'pedagogico' ? MQ.TETOS.passagem_pedagogico : MQ.TETOS.passagem;

/* ---------- etapas do campo em ordem (46_regras_decididas.sql): as MESMAS mensagens do banco ----------
   Implantação: só com o plano aprovado e com água na seca. Acompanhamento: só depois da implantação feita.
   A data de uma etapa não pode ser anterior à da etapa anterior (a avaliação continua depois da implantação).
   base = { visitas, diagnosticos } que a pessoa enxerga. op.visitaId: a visita que está sendo registrada; op.data: o dia
   em que foi feita (vazio = só agendando); op.veTudo: quem enxerga todos os planos do estado (coordenação e bolsista):
   para a agente, que só vê os planos que ela mesma fez, plano "não encontrado" não trava a tela (o banco confere). */
MQ.MSG_ETAPA = {
  semAgua: 'Este quintal está sem água na seca: foi encaminhado a programa de cisternas e não recebe implantação.',
  plano: 'O plano deste quintal ainda não foi aprovado pela coordenação técnica.',
  acompanhamento: 'O acompanhamento é feito depois da implantação do quintal.'
};
MQ.etapaMotivo = function (etapa, fichaId, base, op) {
  op = op || {}; base = base || {};
  const dataBR = d => String(d).slice(0, 10).split('-').reverse().join('/');
  const feitas = et => (base.visitas || []).filter(v => v.ficha_id === fichaId && v.etapa === et && v.situacao === 'realizada' && v.id !== op.visitaId && v.data_realizada);
  const ultima = et => feitas(et).map(v => String(v.data_realizada).slice(0, 10)).sort().pop() || null;
  const antes = (et, nome, deQue) => { const u = ultima(et); return op.data && u && String(op.data).slice(0, 10) < u ? nome + ' não pode ter data anterior à ' + deQue + ' (' + dataBR(u) + ').' : null; };
  if (etapa === 'implantacao') {
    if (!op.soData) {
      const dg = (base.diagnosticos || []).find(d => d.ficha_id === fichaId);
      if (dg && dg.sem_agua) return MQ.MSG_ETAPA.semAgua;
      if (dg ? dg.situacao !== 'aprovado' : !!op.veTudo) return MQ.MSG_ETAPA.plano;
    }
    return antes('diagnostico', 'A implantação', 'do diagnóstico');
  }
  if (etapa === 'acompanhamento') {
    if (!op.soData && !feitas('implantacao').length && (op.veTudo || (base.visitas || []).some(v => v.ficha_id === fichaId && v.etapa === 'implantacao' && v.situacao !== 'cancelada'))) return MQ.MSG_ETAPA.acompanhamento;
    return antes('implantacao', 'O acompanhamento', 'da implantação');
  }
  if (etapa === 'avaliacao') return antes('implantacao', 'A avaliação', 'da implantação');
  return null;
};
/* carregando: uma mulher rega um broto, que cresce a cada ciclo (caule, folhas e flor), com as gotas caindo do regador.
   O leitor de tela ouve "Carregando". O nome MQ.ampulheta ficou por compatibilidade com as telas que já o chamam. */
MQ.ampulheta = (grande) => `<span class="ampulheta${grande ? ' grande' : ''}" role="status" aria-label="Carregando"><svg viewBox="0 0 56 48" width="39" height="33" aria-hidden="true" focusable="false">`
  + `<g fill="currentColor"><circle cx="13" cy="9" r="4"/><circle cx="9.6" cy="6.4" r="2.2"/><path d="M13 13.5 7 31h12z"/></g>`
  + `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 31v9M15.5 31v9M14 17.5l9 3"/>`
  + `<rect x="22" y="18" width="10" height="8" rx="2"/><path d="M32 21l6-5M24 18c0-4 6-4 6 0"/><path d="M30 43h22" opacity=".45"/></g>`
  + `<g class="planta" fill="currentColor"><path class="caule" d="M41 43V29" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`
  + `<path class="folha f1" d="M41 38c-4 0-6.5-2.2-6.5-4.6 3.2 0 6.5 1.8 6.5 4.6z"/><path class="folha f2" d="M41 34c4 0 6.5-2.4 6.5-5 -3.4 0-6.5 2-6.5 5z"/>`
  + `<circle class="flor" cx="41" cy="27" r="3.2"/></g>`
  + `<g fill="currentColor"><circle class="gota" cx="39.6" cy="18" r="1.5"/><circle class="gota g2" cx="41.6" cy="18" r="1.5"/><circle class="gota g3" cx="37.8" cy="18" r="1.5"/></g></svg></span>`;

/* ORÇAMENTO do TED (planilha atualizada de apoio, escolhida em 30/09/2026 como base do painel de execução).
   auto: de onde o sistema tira sozinho o executado/comprometido. Sem auto: a coordenação geral lança.
   Rubricas com previsão zero (CLT, serviços PF, ressarcimento IFRN, outros custos) ficam de fora. */
MQ.ORCAMENTO = {
  fonte: 'Planilha atualizada de apoio do TED (Financeiro/Planilhas_e_memoria_de_calculo)',
  total: 2000000,
  repasses: [{ mes: '2026-09', valor: 1000000 }, { mes: '2027-04', valor: 1000000 }],   // cronograma de desembolso do plano de trabalho
  /* ritmo mensal do gasto: Plano_de_desembolso_TED_quintais_produtivos.xlsx (set/2026 a set/2027). A planilha soma
     R$ 1.970.308,00 (não R$ 2 milhões); o gráfico usa só o formato mês a mês, ajustado ao total do orçamento. */
  cronograma: { inicio: '2026-09', meses: [110000, 54392.31, 333192.31, 253192.31, 64792.31, 53192.31, 67992.31, 453192.31, 361992.31, 53192.31, 53192.31, 58792.31, 53192.31] },
  rubricas: [
    { id: 'r1', nome: 'Auxílio financeiro a pesquisador (bolsas)', itens: [
      { id: 'bolsa_coord_geral', nome: 'Coordenador geral', calc: '1 × 14 meses × R$ 5.000', total: 70000 },
      { id: 'bolsa_professor', nome: 'Professores do curso FIC', calc: '2 × 12 meses × R$ 2.200', total: 52800, auto: { bolsa: 'professor_fic' } },
      { id: 'bolsa_auxiliar', nome: 'Auxiliar administrativo', calc: '1 × 14 meses × R$ 1.200', total: 16800, auto: { bolsa: 'auxiliar_adm' } },
      { id: 'bolsa_secretaria', nome: 'Secretária acadêmica', calc: '1 × 12 meses × R$ 1.000', total: 12000 },
      { id: 'bolsa_coord_pedagogico', nome: 'Coordenador pedagógico', calc: '1 × 12 meses × R$ 1.000', total: 12000 }] },
    { id: 'r2', nome: 'Auxílio financeiro a estudantes (bolsas)', itens: [
      { id: 'bolsa_coord_tecnico', nome: 'Coordenador técnico', calc: '1 × 12 meses × R$ 4.700', total: 56400, auto: { bolsa: 'coord_tecnico' } },
      { id: 'bolsa_articulacao', nome: 'Articulação estadual (5)', calc: '5 × 12 meses × R$ 2.200', total: 132000, auto: { bolsa: 'articulacao' } },
      { id: 'bolsa_apoio', nome: 'Apoio estadual (5)', calc: '5 × 12 meses × R$ 1.600', total: 96000, auto: { bolsa: 'apoio' } }] },
    { id: 'r4', nome: 'Diárias', itens: [
      { id: 'diarias', nome: 'Diárias (meta 7)', calc: '28 × R$ 400', total: 11200 }] },
    { id: 'r5', nome: 'Ajuda de custo (pessoa física)', itens: [
      { id: 'ajuda_visitas', nome: 'Equipe técnica: diagnóstico, implantação e acompanhamento', calc: '800 visitas × R$ 225 (200 + 200 + 400)', total: 180000, auto: { ajuda: true }, unitario: 225 },
      { id: 'ajuda_apoio', nome: 'Apoio à execução das atividades', calc: '50 × R$ 225', total: 11250 }] },
    { id: 'r6', nome: 'Passagens e locomoção', itens: [
      { id: 'passagem_intercambio', nome: 'Passagens aéreas: intercâmbio (meta 6)', calc: '25 × R$ 2.800', total: 70000, auto: { passagem: 'intercambio' } },
      { id: 'passagem_pedagogico', nome: 'Passagens aéreas: acompanhamento pedagógico (meta 7)', calc: '8 × R$ 2.800', total: 22400, auto: { passagem: 'pedagogico' } },
      { id: 'locacao_veiculo', nome: 'Locação de veículo (meta 7)', calc: '28 × R$ 350', total: 9800 }] },
    { id: 'r7', nome: 'Serviços de terceiros (pessoa jurídica)', itens: [
      { id: 'eventos', nome: 'Infraestrutura dos eventos (meta 5)', calc: '5 × R$ 6.000', total: 30000, auto: { evento: true } },
      { id: 'quintais', nome: 'Implantação dos quintais produtivos (meta 3)', calc: '200 × R$ 5.000', total: 1000000 }] },
    { id: 'r9', nome: 'Material de consumo', itens: [
      { id: 'combustivel', nome: 'Combustível', calc: 'verba', total: 7350 }] },
    { id: 'r10', nome: 'Máquinas e equipamentos', itens: [
      { id: 'equipamento', nome: 'Dispositivo eletrônico (notebook)', calc: '1 × R$ 10.000', total: 10000 }] },
    { id: 'r13', nome: 'Despesas operacionais e administrativas (FUNCERN)', itens: [
      { id: 'doa', nome: 'Taxa da fundação de apoio', calc: '10% do projeto', total: 200000 }] }
  ]
};
