/* Regras de negócio da tela (as mesmas garantidas no banco: supabase/01 a 04).
   A tela avisa cedo; o banco garante. */
(function () {
  const R = (MQ.regras = {});

  R.soDigitos = s => String(s || '').replace(/\D/g, '');

  R.cpfValido = function (cpf) {
    const c = R.soDigitos(cpf);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const dv = n => {
      let s = 0;
      for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === +c[9] && dv(10) === +c[10];
  };

  R.fmtCPF = s => {
    const c = R.soDigitos(s).slice(0, 11);
    return c.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  };
  R.cpfMascarado = s => {
    const c = R.soDigitos(s);
    return c.length === 11 ? '•••.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-••' : '';
  };
  R.fmtFone = s => {
    const c = R.soDigitos(s).slice(0, 11);
    if (c.length <= 2) return c;
    if (c.length <= 6) return '(' + c.slice(0, 2) + ') ' + c.slice(2);
    if (c.length <= 10) return '(' + c.slice(0, 2) + ') ' + c.slice(2, 6) + '-' + c.slice(6);
    return '(' + c.slice(0, 2) + ') ' + c.slice(2, 7) + '-' + c.slice(7);
  };
  R.emailValido = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());

  R.ehBolsista = p => p === 'articulacao' || p === 'apoio';

  /* Quem pode fazer o quê (espelha pode_gerenciar() no banco) */
  /* a coordenação geral tem todos os acessos (decisão de 28/09/2026); a técnica cuida de bolsistas e agentes */
  R.podeCadastrar = (meuPapel, papelAlvo) =>
    (meuPapel === 'coord_geral' && papelAlvo !== 'coord_geral') ||
    ((R.ehBolsista(papelAlvo) || papelAlvo === 'agente') && meuPapel === 'coord_tecnico');
  R.podeEditarDados = R.podeCadastrar;
  R.podeEditarHabilitacao = (meuPapel, papelAlvo) =>
    (meuPapel === 'coord_geral' && papelAlvo !== 'coord_geral') ||
    (meuPapel === 'auxiliar_adm' && papelAlvo !== 'coord_geral') ||   // cadastro no Arlo e termo (a própria habilitação não: a tela e o banco barram)
    (meuPapel === 'coord_tecnico' && (R.ehBolsista(papelAlvo) || papelAlvo === 'agente'));

  /* Habilitação para receber bolsa: passo a passo do Guia das bolsistas */
  /* professor do FIC não se matricula no curso: habilita com FUNCERN e termo */
  R.fazFIC = papel => !['professor_fic', 'auxiliar_adm', 'coord_geral'].includes(papel);
  /* quem é matriculado no curso FIC: coordenação técnica, bolsistas e agentes de campo (decisão de 29/09/2026) */
  R.matriculaFIC = papel => ['coord_tecnico', 'articulacao', 'apoio', 'agente'].includes(papel);
  /* turma de um estado aceita gente daquele estado; a coordenação técnica (os 5 estados) entra em qualquer turma */
  R.cabeNaTurma = (turma, pessoa) => !turma.uf || !pessoa.uf || pessoa.uf === turma.uf;
  R.passosHabilitacao = m => [
    { id: 'dados',     nome: ['professor_fic', 'auxiliar_adm', 'coord_tecnico'].includes(m.papel) ? 'Dados cadastrados pela coordenação geral' : 'Dados enviados pela coordenação técnica', feito: true, quando: m.criado_em && m.criado_em.slice(0, 10) },
    R.fazFIC(m.papel) ? { id: 'fic', nome: 'Matrícula no curso FIC (IFRN)', feito: !!m.matricula_fic_em, quando: m.matricula_fic_em, extra: m.matricula_fic_numero } : null,
    { id: 'funcern',   nome: 'Cadastro no Arlo (FUNCERN)', feito: !!m.docs_funcern_em, quando: m.docs_funcern_em },
    { id: 'termo',     nome: 'Termo de compromisso assinado', feito: !!m.termo_assinado_em, quando: m.termo_assinado_em, extra: m.termo_path, enviado: !!m.termo_path && !m.termo_assinado_em }
  ].filter(Boolean);
  /* termo de compromisso: a pessoa anexa o termo preenchido e assinado no próprio cadastro; quem confere abre o arquivo e só então registra a data.
     'falta' (nada anexado) → 'enviado' (anexado, esperando conferência) → 'conferido' (data registrada) */
  R.termoSituacao = m => m.termo_assinado_em ? 'conferido' : m.termo_path ? 'enviado' : 'falta';
  /* qual termo cada função assina: servidor do IFRN (professor do FIC, auxiliar) ou bolsista/agente (MPA) */
  /* aceita a função (texto) ou a pessoa: professor do FIC é sempre servidor; nas outras funções do IFRN (auxiliar administrativo),
     é servidor quem tem matrícula SIAPE no cadastro; sem a pessoa em mãos, o auxiliar conta como servidor */
  R.tipoTermo = x => {
    const papel = x && typeof x === 'object' ? x.papel : x;
    if (papel === 'professor_fic') return 'servidor';
    if (papel === 'auxiliar_adm') return x && typeof x === 'object' && !x.siape ? 'bolsista' : 'servidor';
    return 'bolsista';
  };
  R.modeloTermo = x => { const m = (MQ.MODELOS_TERMO || {})[R.tipoTermo(x)]; return m && m.arquivo ? m : null; };
  R.MSG_TERMO_SEM_ARQUIVO = 'Sem o termo anexado não há o que conferir: a data só é registrada depois que o termo preenchido e assinado estiver anexado.';
  R.MSG_TERMO_SEM_DATA = 'Você anexou o termo: confira no documento a data da assinatura e preencha aqui.';
  R.TERMO_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
  R.nomeArquivo = p => String(p || '').split('/').pop();
  R.situacao = m => {
    if (m.status === 'desligada') return { cod: 'desligada', rot: 'Desligada' };
    if (m.papel === 'coord_geral') return { cod: 'ok', rot: 'Ativa' };
    const p = R.passosHabilitacao(m);
    const faltam = p.filter(x => !x.feito).length;
    return faltam === 0 ? { cod: 'ok', rot: m.papel === 'agente' ? 'Habilitada para visitas' : 'Habilitada' } : { cod: 'pend', rot: 'Habilitação: falta' + (faltam > 1 ? 'm ' : ' ') + faltam };
  };

  /* Validação do formulário. Devolve {campo: mensagem}. */
  R.validar = function (m, equipe) {
    const e = {};
    if (!m.nome || m.nome.trim().split(/\s+/).length < 2) e.nome = 'Escreva o nome completo, como no documento.';
    if (!R.cpfValido(m.cpf)) e.cpf = 'CPF inválido. Confira os 11 números.';
    if (!R.emailValido(m.email)) e.email = 'E-mail inválido. É por ele que a pessoa entra no sistema.';
    if (R.soDigitos(m.telefone).length < 10) e.telefone = 'Informe o celular com DDD.';
    if (!m.data_inicio) e.data_inicio = 'Informe a data de início.';
    if (m.siape && !/^\d{5,8}$/.test(m.siape)) e.siape = 'A matrícula SIAPE tem de 5 a 8 números.';
    if (!m.consentimento_lgpd) e.consentimento_lgpd = 'Sem a ciência da pessoa sobre o uso dos dados, o cadastro não pode ser salvo.';
    const ativos = equipe.filter(x => x.status === 'ativa' && x.id !== m.id);
    const cpf = R.soDigitos(m.cpf);
    if (!e.cpf && ativos.some(x => x.cpf === cpf)) e.cpf = 'Esta pessoa já ocupa outra vaga ativa no projeto.';
    const em = String(m.email || '').trim().toLowerCase();
    if (!e.email && ativos.some(x => String(x.email).toLowerCase() === em)) e.email = 'Este e-mail já está em uso por outra pessoa ativa.';
    if (m.papel === 'auxiliar_adm' && !m.id && ativos.some(x => x.papel === 'auxiliar_adm'))
      e.papel = 'Já existe auxiliar administrativo ativo. Desligue antes de cadastrar outro.';
    if (m.papel === 'professor_fic' && !m.id && ativos.filter(x => x.papel === 'professor_fic').length >= R.MAX_PROFESSORES)
      e.papel = R.MSG_MAX_PROFESSORES;
    if (m.papel === 'coord_tecnico' && !m.id && ativos.some(x => x.papel === 'coord_tecnico'))
      e.papel = 'Já existe coordenação técnica ativa. Desligue a atual antes de cadastrar outra.';
    if (R.ehBolsista(m.papel)) {
      if (!m.id && ativos.some(x => x.papel === m.papel && x.uf === m.uf))
        e.papel = 'Já existe ' + MQ.PAPEIS[m.papel].nome.toLowerCase() + ' ativa em ' + m.uf + '. Desligue antes de cadastrar outra.';
      // mesmos limites do banco (01_criar_banco.sql): 0 a 40 diagnósticos e quintais, 0 a 80 visitas
      [['meta_diagnosticos', 40], ['meta_quintais', 40], ['meta_visitas', 80]].forEach(([c, max]) => {
        if (m[c] == null || m[c] === '') return;
        if (+m[c] < 0) e[c] = 'Não pode ser negativo.'; else if (+m[c] > max) e[c] = 'No máximo ' + max + '.'; });
    }
    return e;
  };

  /* Traduz erros do banco para a linguagem de quem usa (auditoria de 01/10/2026).
     Regra: a pessoa só lê a mensagem original quando ela é do projeto (escrita em português, vinda de
     "raise exception" no banco, código P0001, ou das regras da tela). Texto técnico do Postgres/Supabase,
     erro de programação e objeto sem mensagem viram um aviso simples. Nunca "[object Object]". */
  R.MSG_GENERICA = 'Não deu certo. Tente de novo; se continuar, avise a coordenação.';
  R.MSG_SEM_REDE = 'Sem internet agora. O que você preencheu continua na tela: tente de novo quando o sinal melhorar.';
  R.MSG_SESSAO = 'Sua sessão venceu. Entre de novo.';
  const str = v => (typeof v === 'string' ? v : '');
  /* texto do erro (mensagem + detalhes), sem nunca transformar objeto em "[object Object]" */
  R.textoErro = err => {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    if (typeof err !== 'object') return typeof err === 'number' && err ? String(err) : '';
    return [str(err.message), str(err.details), str(err.hint)].filter(Boolean).join(' ');
  };
  const TECNICO = /Cannot read|is not a function|is not defined|is not iterable|\bundefined\b|\bnull\b|\[object|violates|constraint|duplicate key|\bJWT\b|syntax|relation "|column "|\b(Type|Reference|Range|Syntax)Error\b|PGRST|schema cache|invalid input|permission denied|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time|statement timeout|unexpected|^\s*[{<]|\bat [A-Za-z_$][\w$]*\.|\bstack\b|\bNaN\b/i;
  const INGLES = /\b(the|is|are|was|were|not|of|with|error|failed|invalid|cannot|unable|missing|required|expired|denied|found|token|request|server|timeout|timed|value|key|already|exists|must|should|too|large|payload|resource|bucket|object|row|table)\b/i;
  const PORTUGUES = /[áàâãéêíóôõúç]|\b(nao|que|para|com|uma|um|em|ou|ja|ela|ele|voce|foi|esta|sem|mais|pelo|pela|dos|das|qualquer|coisa)\b/i;
  /* a mensagem é do projeto? (português, sem cara de texto técnico) */
  R.mensagemDoProjeto = m => { const t = String(m || '').trim();
    return !!t && t.length <= 600 && /[a-zà-ú]{3}/i.test(t) && !TECNICO.test(t) && !(INGLES.test(t) && !PORTUGUES.test(t)); };
  /* erro de rede de verdade: o navegador não conseguiu falar com o servidor (não é qualquer texto com "fetch") */
  R.erroDeRede = err => { const m = str(err && typeof err === 'object' ? err.message : err).trim();
    return /^(TypeError:\s*)?(Failed to fetch|NetworkError when attempting to fetch resource\.?|NetworkError|Load failed|Network request failed|The network connection was lost\.?)$/i.test(m); };
  const DUPLICADO = [
    [/uma_por_mes/, 'Você já solicitou este mês.'],
    [/solicitacao_visitas_pkey/, 'Esta visita já está em outro pedido de pagamento.'],
    [/entregas_mes_pkey/, 'Esta entrega do mês já estava marcada.'],
    [/documentos_projeto_arquivo_path_key/, 'Este arquivo já foi anexado. Escolha outro arquivo.'],
    [/execucao_um_estorno/, 'Este lançamento já foi estornado.'],
    [/avaliacoes_visita_id_key/, 'Esta visita já tem avaliação registrada.']
  ];
  /* 47 (supabase/47_auditoria_bd.sql): mensagens das travas novas do banco */
  R.MSG_OCUPADO = 'O sistema está ocupado com outra gravação. Tente de novo em instantes.';
  R.MSG_CONFLITO = 'Este registro foi alterado por outra pessoa enquanto você editava. Abra de novo, confira e refaça a sua alteração.';
  R.ehConflito = e => /alterado por outra pessoa enquanto voc/i.test(String((e && e.message) || e || '') + ' ' + String((e && e.original && e.original.message) || ''));
  // nome do campo como a pessoa conhece, para a trava "tam_<coluna>_<limite>" (o gatilho do banco já manda a frase pronta; isto é a rede de baixo)
  R.ROTULO_LIMITE = { municipio: 'município', endereco: 'endereço', ponto_referencia: 'ponto de referência', caf: 'CAF ou DAP', indicada_por: 'quem indicou',
    testemunha_nome: 'nome da testemunha', encaminhada_para: 'para onde foi encaminhada', obs_coordenacao: 'observação da coordenação', obs: 'observação',
    relato: 'relato da visita', sem_gps_motivo: 'motivo de não haver localização', dados: 'respostas do formulário', organizacao: 'organização',
    motivo_desligamento: 'motivo do desligamento', obs_habilitacao: 'observação da habilitação', motivo_cancelamento: 'motivo do cancelamento',
    relatorio: 'relatório do mês', obs_aval: 'observação do aval', email: 'e-mail', nome_social: 'nome social', motivo_arquivo: 'motivo do arquivamento',
    justificativa_prazo: 'justificativa', pix_chave: 'chave Pix', arquivo_nome: 'nome do arquivo', matricula_fic_numero: 'número da matrícula', numero: 'número da matrícula' };
  R.mensagemErro = function (err) {
    if (err == null || err === '' || err === 0 || err === false) return 'Não foi possível salvar. Tente de novo.';
    const o = typeof err === 'object' ? err : (typeof err === 'string' ? { message: err } : {});   // número ou verdadeiro/falso soltos não são mensagem
    const s = R.textoErro(o), cod = String(o.code == null ? '' : o.code), msg = str(o.message).trim();
    if (/equipe_uma_bolsista_por_uf/.test(s)) return 'Já existe bolsista ativa nessa função e estado. Desligue a atual antes de cadastrar outra.';
    if (/meta_(diagnosticos|quintais|visitas)/.test(s) && /check/.test(s)) return 'Previsão de atividades fora do limite: até 40 diagnósticos, 40 quintais e 80 visitas.';
    if (/equipe_uma_coordenacao/.test(s)) return 'Já existe coordenação técnica ativa. Desligue a atual antes de cadastrar outra.';
    if (/equipe_cpf_ativo/.test(s)) return 'Esta pessoa (CPF) já ocupa outra vaga ativa.';
    if (/equipe_email_ativo/.test(s)) return 'Este e-mail já está em uso por outra pessoa ativa.';
    for (const [re, t] of DUPLICADO) if (re.test(s)) return t;
    if (/row-level security|permission denied/i.test(s)) return 'Seu perfil não tem permissão para esta ação.';
    if (cod === 'P0001' && R.mensagemDoProjeto(msg)) return msg;   // "raise exception" do banco: já está em português
    if (cod === '42501' || cod === 'PGRST301' || cod === 'PGRST302' || /JWT expired|invalid JWT|JWT.*(expired|invalid)/i.test(s)) return R.MSG_SESSAO;
    // 47: banco ocupado com outra gravação (a espera por trava tem limite), texto acima do limite e lista fora do combinado
    if (cod === '55P03' || /lock timeout|could not obtain lock/i.test(s)) return R.MSG_OCUPADO;
    { const t = /\btam_([a-z0-9_]+?)_(\d+)\b/.exec(s);
      if (t) return 'Texto muito longo em ' + (R.ROTULO_LIMITE[t[1]] || t[1].replace(/_/g, ' ')) + ' (máximo ' + Number(t[2]).toLocaleString('pt-BR') + ' caracteres).'; }
    if (/_uf_lista\b/.test(s)) return 'Estado (UF) fora da lista do projeto. Confira e tente de novo.';
    if (cod === '23505' || /duplicate key/i.test(s)) return 'Este registro já existe. Confira se ele já não foi salvo.';
    if (cod === '23514' || cod === '23502' || /violates (check|not-null) constraint/i.test(s)) return 'Algum campo está com valor que o sistema não aceita. Confira e tente de novo.';
    if (cod === '22003') return 'Valor grande demais.';
    if (cod === '22007' || cod === '22008') return 'Data inválida.';
    if (cod === '57014' || /statement timeout|canceling statement/i.test(s)) return 'O sistema demorou demais para responder. Tente de novo daqui a pouco.';
    if (R.erroDeRede(o)) return R.MSG_SEM_REDE;
    if (/^(Type|Reference|Range|Syntax|Eval)Error$/.test(str(o.name))) return R.MSG_GENERICA;   // erro de programação
    if (!cod && R.mensagemDoProjeto(msg || str(o.details))) return msg || str(o.details).trim();   // regra da tela ou da demonstração
    return R.MSG_GENERICA;
  };
  /* o que vai para a tela a partir de um erro apanhado: o que a API já traduziu (e.original) e as regras da
     demonstração (e.regra) passam como estão; o resto é traduzido aqui. Nunca devolve vazio nem "undefined". */
  R.mensagemParaTela = function (e) {
    let m = '';
    if (e && typeof e === 'object' && (e.original || e.regra) && typeof e.message === 'string') m = e.message.trim();
    if (!m || /^(undefined|null|\[object [^\]]*\])$/i.test(m)) m = R.mensagemErro(e && typeof e === 'object' && e.original && !str(e.message).trim() ? e.original : e);
    return m || R.MSG_GENERICA;
  };

  R.hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  /* Limites de data e de número: os MESMOS do banco (supabase/45_auditoria_qa.sql). A tela avisa antes; o banco garante. */
  R.LIM = { visitaMin: '2026-01-01', visitaMax: '2027-12-31', equipeMin: '2025-01-01', inicioFuturoDias: 365,
    rendaMax: 100000, areaMax: 100000, idadeMax: 120, familiaMax: 30, esperaMax: 999, nome: 120, texto: 2000 };
  const dataOk = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(new Date(d + 'T12:00:00'));
  R.dataValida = dataOk;
  /* data prevista de uma visita (agendar ou remarcar): de hoje até 31/12/2027. "antiga" = a data que já estava gravada (não mudou: não trava). */
  R.erroDataPrevista = (d, antiga) => {
    if (!d) return 'Informe a data.';
    if (!dataOk(d)) return 'Data inválida.';
    if (antiga && d === antiga) return null;
    if (d < R.hoje()) return 'Esta data já passou. Escolha de hoje em diante.';
    if (d > R.LIM.visitaMax) return 'A data vai só até 31/12/2027.';
    return null;
  };
  /* dia em que a visita (ou o diagnóstico, a avaliação) foi feita: de 01/01/2026 até hoje */
  R.erroDataFeita = d => {
    if (!d) return 'Informe o dia.';
    if (!dataOk(d)) return 'Data inválida.';
    if (d > R.hoje()) return 'Não pode ser no futuro.';
    if (d < R.LIM.visitaMin) return 'Não pode ser antes de 01/01/2026 (o projeto ainda não tinha começado).';
    return null;
  };
  /* datas da equipe: início (de 01/01/2025 até um ano à frente) e passos da habilitação (de 01/01/2025 até hoje) */
  R.erroDataInicio = d => {
    if (!d) return 'Informe a data de início.';
    if (!dataOk(d)) return 'Data inválida.';
    if (d < R.LIM.equipeMin) return 'Confira o ano: o início precisa ser a partir de 01/01/2025.';
    if (d > R.somaDias(R.hoje(), R.LIM.inicioFuturoDias)) return 'Confira o ano: o início pode ser no máximo um ano à frente.';
    return null;
  };
  R.erroDataPasso = d => {
    if (!d) return null;   // passo ainda não feito: fica em branco
    if (!dataOk(d)) return 'Data inválida.';
    if (d > R.hoje()) return 'Data no futuro. Registre só o que já aconteceu.';
    if (d < R.LIM.equipeMin) return 'Confira o ano: não pode ser antes de 01/01/2025.';
    return null;
  };
  R.erroDataDesligamento = (d, inicio) => {
    if (!d) return 'Informe o último dia.';
    if (!dataOk(d)) return 'Data inválida.';
    if (inicio && d < inicio) return 'Antes do início da bolsa (' + R.fmtData(inicio) + ').';
    if (d > R.hoje()) return 'Não pode ser no futuro. Desligue no dia em que a pessoa sair.';
    return null;
  };
  /* celular: 10 ou 11 números, com DDD de 11 a 99 */
  R.celularValido = t => { const c = R.soDigitos(t); return (c.length === 10 || c.length === 11) && +c.slice(0, 2) >= 11; };
  const inteiro = v => v !== '' && v != null && typeof v !== 'boolean' && Number.isInteger(Number(v));
  R.inteiro = inteiro;
  /* número dentro da faixa? (null/vazio = não informado, passa) */
  R.foraDaFaixa = (v, min, max, soInteiro) => { if (v == null || v === '') return false; const n = Number(v);
    return !isFinite(n) || n < min || n > max || (!!soInteiro && !Number.isInteger(n)); };
  // dia local (Brasil) de um carimbo de data e hora gravado em UTC ("2026-10-01T01:00Z" é 30/09 à noite aqui)
  /* valor em reais digitado de qualquer jeito: "1.600,50", "1600.50", "1600,5", "R$ 1.600" → número; inválido → NaN */
  R.valorBR = v => {
    let s = String(v == null ? '' : v).replace(/R\$|\s/g, '').replace(/[\u2212]/g, '-');
    if (!s) return NaN;
    const iv = s.lastIndexOf(','), ip = s.lastIndexOf('.');
    if (iv >= 0 && ip >= 0) s = iv > ip ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (iv >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // 1.600 = mil e seiscentos
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  };
  /* número dentro de um texto ("10 kg", "2,5", "1.000 mudas") → número ou null.
     Vale o PRIMEIRO número do texto: "2 de 500 ml" é 2, "3 a 4" é 3, "10-20" é 10.
     Fração simples: "1/2" é 0,5 e "1 1/2" é 1,5. (Antes os números eram colados: "1/2" virava 12.) */
  R.numBR = t => {
    if (typeof t === 'number') return isFinite(t) ? t : null;
    const s = String(t == null ? '' : t).replace(/−/g, '-').trim(); if (!s) return null;
    const i = s.search(/\d/); if (i < 0) return null;
    const neg = i > 0 && s[i - 1] === '-' && (i === 1 || /[\s(]/.test(s[i - 2]));
    const r = s.slice(i);
    let m = /^(\d+)\s+(\d+)\s*\/\s*(\d+)(?![\d/])/.exec(r), n;
    if (m && +m[3] > 0) n = +m[1] + (+m[2]) / (+m[3]);
    else if ((m = /^(\d+)\s*\/\s*(\d+)(?![\d/.,])/.exec(r)) && +m[2] > 0) n = (+m[1]) / (+m[2]);
    else { const tok = /^\d[\d.,]*/.exec(r)[0].replace(/[.,]+$/, ''); n = R.valorBR(tok); if (isNaN(n)) { const x = /^\d+([.,]\d+)?/.exec(tok); n = x ? +x[0].replace(',', '.') : NaN; } }
    if (isNaN(n) || !isFinite(n)) return null;
    return neg ? -n : n;
  };
  /* leitura do banco (public.num_br, 42_revisao_seguranca.sql): tira tudo o que não é número e cola o resto.
     Serve só para saber quando o banco leria um número diferente do da tela (ver campo.js: quantidade do kit). */
  R.numBanco = t => { const s = String(t == null ? '' : t).replace(/[^\d.,-]/g, ''); if (!s) return null; const n = R.valorBR(s); if (!isNaN(n)) return n;
    const m = s.replace(/,/g, '.').match(/\d+(\.\d+)?/); return m ? +m[0] : null; };
  R.diaLocal = v => { if (!v) return null; const s = String(v); if (s.length <= 10) return s; const t = new Date(s); return isNaN(t) ? s.slice(0, 10) : new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  R.somaDias = (dia, n) => { const t = new Date(String(dia).slice(0, 10) + 'T12:00:00'); t.setDate(t.getDate() + n); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  R.fmtData = d => (d ? String(R.diaLocal(d)).slice(0, 10).split('-').reverse().join('/') : '');   // data ou data e hora (no dia de Fortaleza)
  R.fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // dias de calendário até a data: hoje = 0, amanhã = 1, ontem = -1 (não depende da hora do dia)
  R.diasAte = d => Math.round((new Date(String(d).slice(0, 10) + 'T12:00:00') - new Date(R.hoje() + 'T12:00:00')) / 864e5);
})();

/* ---------- Regras da ficha de indicação ---------- */
(function () {
  const R = MQ.regras;
  R.pontosFicha = f => MQ.PRIORIDADES.reduce((s, [k, , p]) => s + (f[k] ? p : 0), 0);
  R.criteriosOk = f => MQ.CRITERIOS.every(([k]) => f[k] === true);
  R.idade = (nasc, em) => {
    if (!nasc) return null;
    const a = new Date(nasc + 'T12:00:00'), b = new Date((em || R.hoje()) + 'T12:00:00');
    if (isNaN(a) || isNaN(b)) return null;   // texto que não é data (AAAA-MM-DD)
    let i = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) i--;
    return i;
  };
  /* Resultados possíveis conforme os critérios marcados */
  R.resultadosPossiveis = f => {
    const faltam = MQ.CRITERIOS.filter(([k]) => f[k] !== true).map(([k]) => k);
    if (!faltam.length) return f.autodeclaracao ? ['selecionada', 'lista_espera'] : ['nao_atende'];
    if (faltam.length === 1 && faltam[0] === 'c_agua') return ['sem_agua', 'nao_atende'];
    return ['nao_atende'];
  };
  /* Endereço "normalizado" para achar a mesma casa escrita de jeitos diferentes */
  const memoEnd = new Map();   // o mesmo endereço é normalizado muitas vezes por tela: guarda o resultado
  R.normEndereco = s => { const k = String(s || ''); let v = memoEnd.get(k); if (v === undefined) { v = normEnd(k); if (memoEnd.size > 5000) memoEnd.clear(); memoEnd.set(k, v); } return v; };
  const normEnd = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(sitio|sit|rua|r|povoado|pov|fazenda|faz|assentamento|assent|comunidade|com|numero|n|no|s\/n|sn)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  /* chave da "mesma casa" (estado + município + endereço normalizados) e contagem de uma lista inteira de uma vez só */
  R.chaveCasa = f => { const e = R.normEndereco(f.endereco); return e ? f.uf + '|' + R.normEndereco(f.municipio) + '|' + e : null; };
  R.contarCasas = fichas => { const m = new Map(); fichas.forEach(f => { const k = R.chaveCasa(f); if (k) m.set(k, (m.get(k) || 0) + 1); }); return m; };
  R.casasParecidas = (f, fichas) => {
    const alvo = R.normEndereco(f.endereco); if (!alvo) return [];
    return fichas.filter(x => x.id !== f.id && x.uf === f.uf && R.normEndereco(x.municipio) === R.normEndereco(f.municipio)
      && R.normEndereco(x.endereco) === alvo);
  };
  R.validarFicha = function (f, fichas) {
    const e = {};
    if (!f.nome || f.nome.trim().split(/\s+/).length < 2) e.nome = 'Nome completo, como no documento.';
    if (!R.cpfValido(f.cpf)) e.cpf = 'CPF inválido. Confira os 11 números.';
    else if (fichas.some(x => x.id !== f.id && x.cpf === R.soDigitos(f.cpf))) e.cpf = 'Esta mulher já tem ficha no projeto.';
    if (!f.data_nascimento) e.data_nascimento = 'Informe a data de nascimento.';
    else { const i = R.idade(f.data_nascimento, f.data_ficha); if (i == null || i < 0 || i > 110) e.data_nascimento = 'Data de nascimento inválida.'; }
    if (!f.municipio || f.municipio.trim().length < 3) e.municipio = 'Informe o município.';
    if (!f.comunidade || f.comunidade.trim().length < 3) e.comunidade = 'Informe a comunidade ou assentamento.';
    if (!f.endereco || f.endereco.trim().length < 3) e.endereco = 'Informe o endereço (rua, sítio, nº).';
    if (f.nis && R.soDigitos(f.nis).length !== 11) e.nis = 'O NIS tem 11 números. Deixe em branco se ela não souber.';
    if (f.pessoas_familia != null && f.pessoas_familia !== '' && R.foraDaFaixa(f.pessoas_familia, 1, R.LIM.familiaMax, true)) e.pessoas_familia = 'Entre 1 e 30.';   // número inteiro
    if (f.celular && !R.celularValido(f.celular)) e.celular = 'Celular com DDD: 10 ou 11 números (ex.: (89) 90000-0000).';
    if (!f.consent_dados) e.consent_dados = 'Sem a autorização de uso dos dados, a ficha não pode ser registrada.';
    if (f.assinatura === 'digital') {
      if (!f.testemunha_nome || f.testemunha_nome.trim().split(/\s+/).length < 2) e.testemunha_nome = 'Nome completo da testemunha.';
      if (!R.cpfValido(f.testemunha_cpf)) e.testemunha_cpf = 'CPF da testemunha inválido.';
    }
    MQ.CRITERIOS.forEach(([k]) => { if (f[k] !== true && f[k] !== false) e[k] = 'Marque sim ou não.'; });
    if (f.c_maior18 === true && f.data_nascimento && R.idade(f.data_nascimento, f.data_ficha) < 18) e.c_maior18 = 'Pela data de nascimento ela tem menos de 18 anos.';
    if (!f.resultado) e.resultado = 'Escolha o resultado.';
    else if (!R.resultadosPossiveis(f).includes(f.resultado)) e.resultado = 'Resultado incompatível com os critérios marcados.';
    if (f.resultado === 'lista_espera' && !(f.posicao_espera >= 1)) e.posicao_espera = 'Informe a posição na lista.';
    else if (f.resultado === 'lista_espera' && R.foraDaFaixa(f.posicao_espera, 1, R.LIM.esperaMax, true)) e.posicao_espera = 'Posição de 1 a 999 (número inteiro).';
    if (f.resultado === 'sem_agua' && (!f.encaminhada_para || f.encaminhada_para.trim().length < 3)) e.encaminhada_para = 'Para onde ela foi encaminhada (programa de cisternas, órgão)?';
    if (!f.data_ficha) e.data_ficha = 'Informe a data.';
    else if (f.data_ficha > R.hoje()) e.data_ficha = 'Data no futuro.';
    if (!f.tem_foto_termo) e.foto_termo = 'Fotografe o termo de consentimento assinado.';
    if (!f.tem_foto_ficha) e.foto_ficha = 'Fotografe a ficha em papel assinada.';
    return e;
  };
  const antigo = R.mensagemErro;
  R.mensagemErro = function (err) {
    const s = R.textoErro(err);
    if (/fichas_cpf_unico/.test(s)) return 'Esta mulher (CPF) já tem ficha no projeto, possivelmente em outro estado. Fale com a coordenação técnica.';
    if (/criterios_para_selecao/.test(s)) return 'Selecionada ou lista de espera só com todos os critérios obrigatórios e a autodeclaração assinada.';
    if (/sem_agua_encaminhada/.test(s)) return 'Informe para onde ela foi encaminhada por falta de água.';
    if (/idade_minima/.test(s)) return 'Ela tem menos de 18 anos na data da ficha.';
    if (/consent_dados/.test(s)) return 'Sem a autorização de uso dos dados, a ficha não pode ser registrada.';
    return antigo(err);
  };
})();

/* ---------- Regras do trabalho de campo ---------- */
(function () {
  const R = MQ.regras;
  R.ehCampo = p => p === 'articulacao' || p === 'apoio' || p === 'agente';
  /* 33: técnica, bolsistas e agentes precisam da matrícula no FIC; só se cadastram com professor do FIC ativo e habilitado */
  R.PRECISA_PROFESSOR = ['coord_tecnico', 'articulacao', 'apoio', 'agente'];
  /* 50: o orçamento prevê 2 professores do FIC; o banco recusa o terceiro */
  R.MAX_PROFESSORES = 2;
  R.MSG_MAX_PROFESSORES = 'O projeto tem no máximo 2 professores do FIC ativos. Desligue um antes de cadastrar outro.';
  R.temProfessorHabilitado = equipe => (equipe || []).some(m => m.papel === 'professor_fic' && m.status === 'ativa' && m.docs_funcern_em && m.termo_assinado_em);
  R.MSG_SEM_PROFESSOR = 'Antes, cadastre e habilite um professor do FIC (cadastro no Arlo e termo assinado): sem ele, ninguém consegue a matrícula no curso.';
  R.habilitado = m => !!(m && m.status === 'ativa' && (m.matricula_fic_em || !R.fazFIC(m.papel)) && m.docs_funcern_em && m.termo_assinado_em);
  R.podeMatricular = papel => papel === 'professor_fic' || papel === 'coord_geral';
  R.decideCampo = papel => papel === 'coord_tecnico' || papel === 'coord_geral';   // aprova ou devolve fichas e diagnósticos, agenda visitas   // sempre um dos professores do FIC, em qualquer turma
  /* sem água na seca (ou só carro-pipa): a visita para na Parte A */
  R.semAgua = d => d.agua_seca === 'nao' || (Array.isArray(d.fontes_agua) && d.fontes_agua.length > 0 && d.fontes_agua.every(f => f === 'carro_pipa'));
  /* projeção do kit: quantidade × valor de cada item. Item com quantidade ou valor negativo NÃO abate o total. */
  R.totalKit = kit => (Array.isArray(kit) ? kit : []).reduce((s, x) => { const q = R.numBR(x && x.qtd), v = x && x.valor != null && x.valor !== '' ? Number(x.valor) : 0;
    return s + (q > 0 && v > 0 ? q * v : 0); }, 0);
  /* confere o kit item por item (as mesmas travas do banco, 45): valor ≥ 0, quantidade > 0 em item com valor */
  R.erroKit = kit => {
    for (const x of (kit || [])) {
      if (!x || !String(x.item || '').trim()) continue;
      const nome = String(x.item).trim().slice(0, 60), q = R.numBR(x.qtd), v = x.valor == null || x.valor === '' ? null : Number(x.valor);
      if (v != null && (isNaN(v) || v < 0)) return 'O valor de ' + nome + ' não pode ser negativo.';
      if (q != null && q < 0) return 'A quantidade de ' + nome + ' não pode ser negativa.';
      if (!(v > 0)) return 'Informe o valor estimado de cada item (R$ por unidade): é a projeção do investimento no quintal.';
      if (!(q > 0)) return 'Informe a quantidade de ' + nome + ' (um número maior que zero).';
    }
    return null;
  };
  R.validarDiagnostico = function (d) {
    const e = {}, L = R.LIM, fora = R.foraDaFaixa;
    if (!d.data_visita) e.data_visita = 'Informe a data da visita.'; else if (d.data_visita > R.hoje()) e.data_visita = 'Data no futuro.';
    else if (R.dataValida(d.data_visita) && d.data_visita < L.visitaMin) e.data_visita = 'A data não pode ser antes de 01/01/2026.';
    if (d.latitude == null) {   // sem GPS: motivo escolhido e explicação com as próprias palavras (31_validacao_diagnostico.sql)
      const det = String(d.sem_gps_detalhe != null ? d.sem_gps_detalhe : d.sem_gps_motivo || '').trim();
      if (d.sem_gps_detalhe != null && !String(d.sem_gps_tipo || '').trim()) e.sem_gps_motivo = 'Registre a localização no quintal ou escolha por que não foi possível.';
      else if (det.length < 15) e.sem_gps_motivo = 'Registre a localização no quintal ou explique, em pelo menos 15 letras, por que não foi possível.';
    }
    if (!(d.familia || []).some(x => String(x.nome || '').trim())) e.familia = 'Registre pelo menos a própria mulher na família.';
    else if ((d.familia || []).some(x => fora(x.idade, 0, L.idadeMax, true))) e.familia = 'Confira as idades da família: de 0 a 120 anos, sem vírgula.';
    if (!d.agua_seca) e.agua_seca = 'Informe se a água dá para o quintal no período seco.';
    if (!(d.fontes_agua || []).length) e.fontes_agua = 'Marque as fontes de água.';
    if (d.area_m2 != null && !(d.area_m2 > 0)) e.area_m2 = 'Área inválida.';
    else if (d.area_m2 != null && d.area_m2 > L.areaMax) e.area_m2 = 'Área grande demais: no máximo 100.000 m² (10 hectares). Confira o número.';
    // números fora do possível (o campo aceita qualquer coisa digitada; aqui é que se confere)
    if (fora(d.renda_familiar, 0, L.rendaMax)) e.renda_familiar = 'Renda de R$ 0 a R$ 100.000 por mês. Confira o número.';
    if (fora(d.renda_quintal, 0, L.rendaMax)) e.renda_quintal = 'Vendas de R$ 0 a R$ 100.000 por mês. Confira o número.';
    if (fora(d.capacidade_litros, 0, 1e9)) e.capacidade_litros = 'A capacidade não pode ser negativa.';
    if (fora(d.distancia_m, 0, 1e6)) e.distancia_m = 'A distância não pode ser negativa.';
    if (fora(d.meses_seca, 0, 12)) e.meses_seca = 'De 0 a 12 meses.';
    if (fora(d.horas_dia, 0, 24)) e.horas_dia = 'De 0 a 24 horas por dia.';
    if ((d.fotos_ok || 0) < 3) e.fotos = 'Faça pelo menos 3 fotos: visão geral, fonte de água e área de plantio.';
    if (d.impacto !== undefined && MQ.impactoUI) Object.assign(e, MQ.impactoUI.validar(d.impacto));   // linha de base para medir o impacto
    if (!R.semAgua(d)) {
      if (!(d.objetivos || []).length) e.objetivos = 'Marque o objetivo do quintal.';
      const ek = R.erroKit(d.kit);
      if (!(d.kit || []).some(x => String(x.item || '').trim())) e.kit = 'Escolha pelo menos um item do kit.';
      else if (ek) e.kit = ek;
      else {
        const lim = +(((MQ.ui && MQ.ui.S.kitPar) || {}).valor_quintal) || 0;
        const tot = Math.round((d.kit_total != null ? Math.max(0, +d.kit_total || 0) : R.totalKit(d.kit)) * 100) / 100;   // em centavos, como o banco compara
        if (lim && tot > lim) e.kit = 'O kit passa do valor por quintal (' + tot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' de ' + lim.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '). Tire ou troque itens.';
      }
      if (!d.lote) e.lote = 'Escolha o lote de implantação.';
      if (!d.compromissos) e.compromissos = 'A beneficiária precisa concordar com os compromissos.';
    }
    return e;
  };
  const antigo = R.mensagemErro;
  R.mensagemErro = function (err) {
    const s = R.textoErro(err);
    if (/visitas_etapa_unica/.test(s)) return 'Este quintal já tem essa visita agendada ou feita.';
    if (/diagnosticos_ficha_id_key|diagnosticos_visita_id_key/.test(s)) return 'Este quintal já tem diagnóstico registrado.';
    if (/gps_ou_motivo/.test(s)) return 'Registre a localização ou explique por que não foi possível.';
    if (/sem_agua_sem_plano|com_agua_com_lote/.test(s)) return 'Sem água na seca, não há plano nem lote; com água, escolha o lote.';
    return antigo(err);
  };
})();

/* Botão de ação (design system, 01/10/2026): [ícone | texto →], altura fixa, mesmo componente em todo o sistema.
   o = { acao, texto, curto (rótulo do celular), icone, sec (versão clara, para a segunda ação do grupo), peq (dentro de cartões), mini (em tabelas e faixas, só texto →; icone: false), attrs, rotulo (aria-label) } */
(function () {
  const p = d => `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICONES = {
    equipe: p('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.4-.2 4.1 1.3 4.6 4.3"/>'),
    pasta: p('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'),
    capelo: p('<path d="M2.5 9 12 5l9.5 4L12 13z"/><path d="M6.5 11v4.2c1.4 1.4 3.3 2.1 5.5 2.1s4.1-.7 5.5-2.1V11"/><path d="M21.5 9v5"/>'),
    ver: p('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),   // olho: só consultar (aviso, sem nada a resolver)
    resolver: p('<path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z"/>'),   // chave de boca: resolver uma pendência
    pessoa_mais: p('<circle cx="10" cy="8" r="3.4"/><path d="M3.5 20c.7-3.6 3.2-5.6 6.5-5.6 1.5 0 2.8.4 3.9 1.1"/><path d="M18.5 14v6M15.5 17h6"/>'),
    enviar: p('<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>'),
    calendario: p('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>'),
    anexo: p('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11.5v6M9 14.5h6"/>'),
    relatorio: p('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 17v-3M12 17v-5M15 17v-2"/>'),
    aviao: p('<path d="M10.5 13.5 4 11l1.2-1.2 7.3.8 4.6-4.6c.8-.8 2.2-.9 2.9-.2.7.7.6 2.1-.2 2.9l-4.6 4.6.8 7.3L14.8 21l-2.5-6.5"/><path d="m7 17-3 .5L3.5 19 6 18.5"/>'),
    tenda: p('<path d="M12 4 3 19h18z"/><path d="M12 4v15M12 19l-3-6M12 19l3-6"/><path d="M2 19h20"/>')
  };
  const SETA = p('<path d="M5 12h13"/><path d="m13 6.5 5.5 5.5-5.5 5.5"/>');
  MQ.ICONES = ICONES;
  /* faixa no alto do painel conforme a situação: 'crit' (devolvido/atrasado), 'pend' (esperando quem está olhando), neutra se não há nada */
  MQ.sit = (n, nivel) => ' painel-sit sit-' + (n ? (nivel || 'pend') : 'ok');
  MQ.botaoAcao = o => `<button type="button" class="btn-acao${o.sec ? ' sec' : ''}${o.peq ? ' peq' : ''}${o.mini ? ' mini' : ''}${o.cls ? ' ' + o.cls : ''}" data-acao="${o.acao}"${o.rotulo || o.curto ? ` aria-label="${o.rotulo || o.texto}"` : ''} ${o.attrs || ''}>`
    + `${o.icone === false ? '' : `<span class="ba-ic">${ICONES[o.icone] || ICONES.pessoa_mais}</span>`}<span class="ba-tx">${o.curto ? `<span class="ba-l">${o.texto}</span><span class="ba-c" aria-hidden="true">${o.curto}</span>` : o.texto}</span><span class="ba-seta">${SETA}</span></button>`;
  /* botão de ação com a explicação curta embaixo (substitui os antigos cartões "cad-modo" das páginas) */
  MQ.acaoComDica = (o, dica) => `<div class="acao-item">${MQ.botaoAcao(o)}${dica ? `<p class="acao-dica">${dica}</p>` : ''}</div>`;
})();
