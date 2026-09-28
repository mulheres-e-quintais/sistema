/* Regras de negócio usadas na tela. O banco repete as mesmas regras (supabase/schema.sql):
   a tela avisa cedo, o banco garante. */
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
  R.podeCadastrar = (meuPapel, papelAlvo) =>
    (papelAlvo === 'coord_tecnico' && meuPapel === 'coord_geral') ||
    (R.ehBolsista(papelAlvo) && meuPapel === 'coord_tecnico');
  R.podeEditarDados = R.podeCadastrar;
  R.podeEditarHabilitacao = (meuPapel, papelAlvo) =>
    (meuPapel === 'coord_geral' && (papelAlvo === 'coord_tecnico' || R.ehBolsista(papelAlvo))) ||
    (meuPapel === 'coord_tecnico' && R.ehBolsista(papelAlvo));

  /* Habilitação para receber bolsa: passo a passo do Guia das bolsistas */
  R.passosHabilitacao = m => [
    { id: 'dados',     nome: 'Dados enviados pela coordenação técnica', feito: true, quando: m.criado_em && m.criado_em.slice(0, 10) },
    { id: 'fic',       nome: 'Matrícula no curso FIC (IFRN)', feito: !!m.matricula_fic_em, quando: m.matricula_fic_em, extra: m.matricula_fic_numero },
    { id: 'funcern',   nome: 'Documentos e conta/Pix entregues à FUNCERN', feito: !!m.docs_funcern_em, quando: m.docs_funcern_em },
    { id: 'termo',     nome: 'Termo de compromisso assinado', feito: !!m.termo_assinado_em, quando: m.termo_assinado_em, extra: m.termo_path }
  ];
  R.situacao = m => {
    if (m.status === 'desligada') return { cod: 'desligada', rot: 'Desligada' };
    if (m.papel === 'coord_geral') return { cod: 'ok', rot: 'Ativa' };
    const p = R.passosHabilitacao(m);
    const faltam = p.filter(x => !x.feito).length;
    return faltam === 0 ? { cod: 'ok', rot: 'Apta a receber bolsa' } : { cod: 'pend', rot: 'Habilitação: falta' + (faltam > 1 ? 'm ' : ' ') + faltam };
  };

  /* Validação do formulário. Devolve {campo: mensagem}. */
  R.validar = function (m, equipe) {
    const e = {};
    if (!m.nome || m.nome.trim().split(/\s+/).length < 2) e.nome = 'Escreva o nome completo, como no documento.';
    if (!R.cpfValido(m.cpf)) e.cpf = 'CPF inválido. Confira os 11 números.';
    if (!R.emailValido(m.email)) e.email = 'E-mail inválido. É por ele que a pessoa entra no sistema.';
    if (R.soDigitos(m.telefone).length < 10) e.telefone = 'Informe o celular com DDD.';
    if (!m.data_inicio) e.data_inicio = 'Informe a data de início.';
    if (!m.consentimento_lgpd) e.consentimento_lgpd = 'Sem a ciência da pessoa sobre o uso dos dados, o cadastro não pode ser salvo.';
    const ativos = equipe.filter(x => x.status === 'ativa' && x.id !== m.id);
    const cpf = R.soDigitos(m.cpf);
    if (!e.cpf && ativos.some(x => x.cpf === cpf)) e.cpf = 'Esta pessoa já ocupa outra vaga ativa no projeto.';
    const em = String(m.email || '').trim().toLowerCase();
    if (!e.email && ativos.some(x => String(x.email).toLowerCase() === em)) e.email = 'Este e-mail já está em uso por outra pessoa ativa.';
    if (R.ehBolsista(m.papel)) {
      if (!m.id && ativos.some(x => x.papel === m.papel && x.uf === m.uf))
        e.papel = 'Já existe ' + MQ.PAPEIS[m.papel].nome.toLowerCase() + ' ativa em ' + m.uf + '. Desligue antes de cadastrar outra.';
      const outras = ativos.filter(x => x.uf === m.uf);
      [['meta_diagnosticos', 'diagnosticos'], ['meta_quintais', 'quintais'], ['meta_visitas', 'visitas']].forEach(([c, k]) => {
        const soma = outras.reduce((s, x) => s + (+x[c] || 0), 0) + (+m[c] || 0);
        if (+m[c] < 0) e[c] = 'Não pode ser negativo.';
        else if (soma > MQ.META_UF[k]) e[c] = 'Passa da meta do estado: sobram ' + Math.max(0, MQ.META_UF[k] - (soma - (+m[c] || 0))) + '.';
      });
    }
    return e;
  };

  /* Traduz erros do banco para a linguagem de quem usa */
  R.mensagemErro = function (err) {
    const s = String((err && (err.message || err.details)) || err || '');
    if (/equipe_uma_bolsista_por_uf/.test(s)) return 'Já existe bolsista ativa nessa função e estado. Desligue a atual antes de cadastrar outra.';
    if (/equipe_uma_coordenacao/.test(s)) return 'Já existe coordenação técnica ativa. Desligue a atual antes de cadastrar outra.';
    if (/equipe_cpf_ativo/.test(s)) return 'Esta pessoa (CPF) já ocupa outra vaga ativa.';
    if (/equipe_email_ativo/.test(s)) return 'Este e-mail já está em uso por outra pessoa ativa.';
    if (/row-level security|permission denied/i.test(s)) return 'Seu perfil não tem permissão para esta ação.';
    if (/Failed to fetch|NetworkError|network/i.test(s)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    return s || 'Não foi possível salvar. Tente de novo.';
  };

  R.hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  R.fmtData = d => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
  R.fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  R.diasAte = d => Math.ceil((new Date(d + 'T23:59:59') - new Date()) / 864e5);
})();
