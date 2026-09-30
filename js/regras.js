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
    { id: 'termo',     nome: 'Termo de compromisso assinado', feito: !!m.termo_assinado_em, quando: m.termo_assinado_em, extra: m.termo_path }
  ].filter(Boolean);
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

  /* Traduz erros do banco para a linguagem de quem usa */
  R.mensagemErro = function (err) {
    const s = String((err && (err.message || err.details)) || err || '');
    if (/equipe_uma_bolsista_por_uf/.test(s)) return 'Já existe bolsista ativa nessa função e estado. Desligue a atual antes de cadastrar outra.';
    if (/meta_(diagnosticos|quintais|visitas)/.test(s) && /check/.test(s)) return 'Previsão de atividades fora do limite: até 40 diagnósticos, 40 quintais e 80 visitas.';
    if (/equipe_uma_coordenacao/.test(s)) return 'Já existe coordenação técnica ativa. Desligue a atual antes de cadastrar outra.';
    if (/equipe_cpf_ativo/.test(s)) return 'Esta pessoa (CPF) já ocupa outra vaga ativa.';
    if (/equipe_email_ativo/.test(s)) return 'Este e-mail já está em uso por outra pessoa ativa.';
    if (/row-level security|permission denied/i.test(s)) return 'Seu perfil não tem permissão para esta ação.';
    if (/Failed to fetch|NetworkError|Load failed|network|fetch/i.test(s)) return 'Sem internet agora. O que você preencheu continua na tela: tente de novo quando o sinal melhorar.';
    return s || 'Não foi possível salvar. Tente de novo.';
  };

  R.hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  R.fmtData = d => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
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
    if (f.pessoas_familia != null && (f.pessoas_familia < 1 || f.pessoas_familia > 30)) e.pessoas_familia = 'Entre 1 e 30.';
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
    if (f.resultado === 'sem_agua' && (!f.encaminhada_para || f.encaminhada_para.trim().length < 3)) e.encaminhada_para = 'Para onde ela foi encaminhada (programa de cisternas, órgão)?';
    if (!f.data_ficha) e.data_ficha = 'Informe a data.';
    else if (f.data_ficha > R.hoje()) e.data_ficha = 'Data no futuro.';
    if (!f.tem_foto_termo) e.foto_termo = 'Fotografe o termo de consentimento assinado.';
    if (!f.tem_foto_ficha) e.foto_ficha = 'Fotografe a ficha em papel assinada.';
    return e;
  };
  const antigo = R.mensagemErro;
  R.mensagemErro = function (err) {
    const s = String((err && (err.message || err.details)) || err || '');
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
  R.temProfessorHabilitado = equipe => (equipe || []).some(m => m.papel === 'professor_fic' && m.status === 'ativa' && m.docs_funcern_em && m.termo_assinado_em);
  R.MSG_SEM_PROFESSOR = 'Antes, cadastre e habilite um professor do FIC (cadastro no Arlo e termo assinado): sem ele, ninguém consegue a matrícula no curso.';
  R.habilitado = m => !!(m && m.status === 'ativa' && (m.matricula_fic_em || !R.fazFIC(m.papel)) && m.docs_funcern_em && m.termo_assinado_em);
  R.podeMatricular = papel => papel === 'professor_fic' || papel === 'coord_geral';
  R.decideCampo = papel => papel === 'coord_tecnico' || papel === 'coord_geral';   // aprova ou devolve fichas e diagnósticos, agenda visitas   // sempre um dos professores do FIC, em qualquer turma
  /* sem água na seca (ou só carro-pipa): a visita para na Parte A */
  R.semAgua = d => d.agua_seca === 'nao' || (Array.isArray(d.fontes_agua) && d.fontes_agua.length > 0 && d.fontes_agua.every(f => f === 'carro_pipa'));
  R.validarDiagnostico = function (d) {
    const e = {};
    if (!d.data_visita) e.data_visita = 'Informe a data da visita.'; else if (d.data_visita > R.hoje()) e.data_visita = 'Data no futuro.';
    if (d.latitude == null) {   // sem GPS: motivo escolhido e explicação com as próprias palavras (31_validacao_diagnostico.sql)
      const det = String(d.sem_gps_detalhe != null ? d.sem_gps_detalhe : d.sem_gps_motivo || '').trim();
      if (d.sem_gps_detalhe != null && !String(d.sem_gps_tipo || '').trim()) e.sem_gps_motivo = 'Registre a localização no quintal ou escolha por que não foi possível.';
      else if (det.length < 15) e.sem_gps_motivo = 'Registre a localização no quintal ou explique, em pelo menos 15 letras, por que não foi possível.';
    }
    if (!(d.familia || []).some(x => String(x.nome || '').trim())) e.familia = 'Registre pelo menos a própria mulher na família.';
    if (!d.agua_seca) e.agua_seca = 'Informe se a água dá para o quintal no período seco.';
    if (!(d.fontes_agua || []).length) e.fontes_agua = 'Marque as fontes de água.';
    if (d.area_m2 != null && !(d.area_m2 > 0)) e.area_m2 = 'Área inválida.';
    if ((d.fotos_ok || 0) < 3) e.fotos = 'Faça pelo menos 3 fotos: visão geral, fonte de água e área de plantio.';
    if (d.impacto !== undefined && MQ.impactoUI) Object.assign(e, MQ.impactoUI.validar(d.impacto));   // linha de base para medir o impacto
    if (!R.semAgua(d)) {
      if (!(d.objetivos || []).length) e.objetivos = 'Marque o objetivo do quintal.';
      if (!(d.kit || []).some(x => String(x.item || '').trim())) e.kit = 'Escolha pelo menos um item do kit.';
      else if ((d.kit || []).some(x => x.item && !(+x.valor > 0))) e.kit = 'Informe o valor estimado de cada item (R$ por unidade): é a projeção do investimento no quintal.';
      else {
        const lim = +(((MQ.ui && MQ.ui.S.kitPar) || {}).valor_quintal) || 0;
        const tot = d.kit_total != null ? d.kit_total : (d.kit || []).reduce((s, x) => s + (parseFloat(String(x.qtd || '').replace(',', '.')) || 0) * (+x.valor || 0), 0);
        if (lim && tot > lim) e.kit = 'O kit passa do valor por quintal (' + tot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' de ' + lim.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '). Tire ou troque itens.';
      }
      if (!d.lote) e.lote = 'Escolha o lote de implantação.';
      if (!d.compromissos) e.compromissos = 'A beneficiária precisa concordar com os compromissos.';
    }
    return e;
  };
  const antigo = R.mensagemErro;
  R.mensagemErro = function (err) {
    const s = String((err && (err.message || err.details)) || err || '');
    if (/visitas_etapa_unica/.test(s)) return 'Este quintal já tem essa visita agendada ou feita.';
    if (/diagnosticos_ficha_id_key|diagnosticos_visita_id_key/.test(s)) return 'Este quintal já tem diagnóstico registrado.';
    if (/gps_ou_motivo/.test(s)) return 'Registre a localização ou explique por que não foi possível.';
    if (/sem_agua_sem_plano|com_agua_com_lote/.test(s)) return 'Sem água na seca, não há plano nem lote; com água, escolha o lote.';
    return antigo(err);
  };
})();
