/* Modo demonstração: roda sem servidor, guarda no próprio navegador e aplica
   as mesmas regras do banco. Os dados são de exemplo. */
(function () {
  const R = MQ.regras;
  const CHAVE = 'mq-demo-v4';
  let mem = null;

  function gerarCPF(seed) {
    const n = String(seed).padStart(9, '0').slice(-9).split('').map(Number);
    const dv = arr => { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i] * (arr.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    n.push(dv(n)); n.push(dv(n));
    return n.join('');
  }
  const uid = () => 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function semente() {
    const t = '2026-09-26T10:00:00.000Z';
    const base = (o) => Object.assign({
      id: uid(), user_id: null, uf: null, telefone: '', municipio: '', organizacao: '',
      data_inicio: MQ.PROJETO.inicioBolsas, data_fim: null, motivo_desligamento: null,
      meta_diagnosticos: null, meta_quintais: null, meta_visitas: null,
      matricula_fic_em: null, matricula_fic_numero: null, docs_funcern_em: null,
      termo_path: null, termo_assinado_em: null, obs_habilitacao: null,
      consentimento_lgpd: true, status: 'ativa', substitui_id: null, criado_por: null,
      criado_em: t, atualizado_em: t, exemplo: true
    }, o);
    const cg = base({ papel: 'coord_geral', nome: 'Cleone Lima', cpf: gerarCPF(123456781), email: 'cleone.lima@ifrn.edu.br',
      telefone: '(84) 99992-7943', municipio: 'Apodi/RN', organizacao: 'IFRN Campus Apodi', data_inicio: '2026-09-14', exemplo: false });
    const ct = base({ papel: 'coord_tecnico', nome: 'Joana Ferreira (exemplo)', cpf: gerarCPF(234567812), email: 'joana.exemplo@mpa.org.br',
      telefone: '(89) 98111-2233', municipio: 'Paulistana/PI', organizacao: 'MPA', criado_por: cg.id,
      matricula_fic_em: '2026-09-29', matricula_fic_numero: '20261FIC0001', docs_funcern_em: '2026-09-30' });
    const b = (o) => base(Object.assign({ criado_por: ct.id, criado_em: '2026-09-27T12:00:00.000Z', atualizado_em: '2026-09-27T12:00:00.000Z' }, o));
    const lista = [cg, ct,
      b({ papel: 'articulacao', uf: 'PI', nome: 'Ana Paula Souza (exemplo)', cpf: gerarCPF(345678123), email: 'ana.exemplo@gmail.com',
          telefone: '(89) 99421-0001', municipio: 'Paulistana', organizacao: 'MPA – Regional Sertão do Piauí',
          meta_diagnosticos: 20, meta_quintais: 20, meta_visitas: 40,
          matricula_fic_em: '2026-09-29', matricula_fic_numero: '20261FIC0002', docs_funcern_em: '2026-09-30', termo_assinado_em: '2026-09-30', termo_path: 'termo_ana.pdf' }),
      b({ papel: 'apoio', uf: 'PI', nome: 'Rita de Cássia Lima (exemplo)', cpf: gerarCPF(456781234), email: 'rita.exemplo@gmail.com',
          telefone: '(89) 99421-0002', municipio: 'Pio IX', organizacao: 'Associação de Mulheres de Pio IX',
          meta_diagnosticos: 20, meta_quintais: 20, meta_visitas: 40,
          matricula_fic_em: '2026-09-29', matricula_fic_numero: '20261FIC0003' }),
      b({ papel: 'articulacao', uf: 'BA', nome: 'Maria José Santos (exemplo)', cpf: gerarCPF(567812345), email: 'mariajose.exemplo@gmail.com',
          telefone: '(74) 99811-0003', municipio: 'Itiúba', organizacao: 'MPA Bahia', meta_diagnosticos: 20, meta_quintais: 20, meta_visitas: 40 }),
      b({ papel: 'articulacao', uf: 'SE', nome: 'Luana Rocha (exemplo)', cpf: gerarCPF(678123456), email: 'luana.exemplo@gmail.com',
          telefone: '(79) 99911-0004', municipio: 'Porto da Folha', organizacao: 'MPA Sergipe',
          status: 'desligada', data_fim: '2026-09-27', motivo_desligamento: 'Pedido da própria bolsista: aprovada em concurso, sem disponibilidade.' })
    ];
    const aud = [];
    let k = 1;
    lista.forEach(m => aud.push({ id: k++, tabela: 'equipe', registro_id: m.id, acao: 'INSERT', por: m.criado_por, em: m.criado_em, antes: null, depois: m }));
    const lu = lista[lista.length - 1];
    aud.push({ id: k++, tabela: 'equipe', registro_id: lu.id, acao: 'UPDATE', por: ct.id, em: '2026-09-27T15:30:00.000Z',
      antes: Object.assign({}, lu, { status: 'ativa' }), depois: lu });
    const ana = lista[2], maria = lista[4];
    const gil = b({ papel: 'agente', uf: 'PI', nome: 'Gilvânia Rocha (exemplo)', cpf: gerarCPF(812345671), email: 'gilvania.exemplo@gmail.com',
      telefone: '(89) 99421-0077', municipio: 'Paulistana', organizacao: 'MPA – Regional Sertão do Piauí',
      matricula_fic_em: '2026-10-02', matricula_fic_numero: '20261FIC0011', docs_funcern_em: '2026-10-03', termo_assinado_em: '2026-10-03', termo_path: 'termo_gil.pdf' });
    const lia = b({ papel: 'agente', uf: 'PI', nome: 'Lia Moura (exemplo)', cpf: gerarCPF(823456712), email: 'lia.exemplo@gmail.com',
      telefone: '(89) 99421-0088', municipio: 'Pio IX', organizacao: 'Sindicato de Pio IX', matricula_fic_em: '2026-10-02', matricula_fic_numero: '20261FIC0012' });
    lista.push(gil, lia);
    aud.push({ id: k++, tabela: 'equipe', registro_id: gil.id, acao: 'INSERT', por: ct.id, em: gil.criado_em, antes: null, depois: gil });
    const fichas = fichasExemplo(ana, maria, ct, gerarCPF);
    fichas.forEach(f => aud.push({ id: k++, tabela: 'fichas', registro_id: f.id, acao: 'INSERT', por: f.bolsista_id, em: f.criado_em, antes: null, depois: f }));
    const aprov = fichas.filter(f => f.uf === 'PI' && f.resultado === 'selecionada' && f.situacao === 'aprovada');
    const vis = (f, ex, data, o) => Object.assign({ id: uid(), ficha_id: f.id, uf: f.uf, etapa: 'diagnostico', executor_id: ex.id, data_prevista: data,
      data_realizada: null, situacao: 'prevista', obs: null, criado_por: ana.id, criado_em: '2026-10-22T15:00:00.000Z', atualizado_em: '2026-10-22T15:00:00.000Z' }, o);
    const v1 = vis(aprov[0], ana, '2026-10-26', { situacao: 'realizada', data_realizada: '2026-10-26' });
    const v2 = vis(aprov[1], gil, '2026-10-28');
    const v3 = vis(aprov[2], gil, '2026-11-04');
    const diag = { id: uid(), ficha_id: aprov[0].id, visita_id: v1.id, uf: 'PI', executor_id: ana.id, data_visita: '2026-10-26', codigo_quintal: 'PI-' + aprov[0].id.slice(1, 5).toUpperCase(),
      latitude: aprov[0].latitude, longitude: aprov[0].longitude, sem_gps_motivo: null, area_m2: 300, renda_familiar: 900, renda_quintal: 150,
      agua_seca: 'sim', sem_agua: false, lote: 1, mes_implantacao: 'fevereiro', situacao: 'aguardando', aprovado_por: null, aprovado_em: null, obs_coordenacao: null,
      fotos: ['exemplo'], criado_em: '2026-10-26T20:00:00.000Z', atualizado_em: '2026-10-26T20:00:00.000Z', exemplo: true,
      dados: { familia: [{ nome: 'Francisca', idade: 46, parentesco: 'Ela mesma', ocupacao: 'Agricultora', ajuda: true }, { nome: 'José', idade: 50, parentesco: 'Cônjuge/companheiro', ocupacao: 'Agricultor', ajuda: true }, { nome: 'Ana', idade: 14, parentesco: 'Filho(a)', ocupacao: 'Estuda', ajuda: false }],
        politicas: ['bolsa_familia', 'garantia_safra'], fonte_renda: 'Bolsa Família e venda de galinhas', terra: 'propria', cercado: 'em_parte',
        fontes_agua: ['cisterna_consumo', 'cisterna_producao'], capacidade_litros: 52000, meses_seca: 6, distancia_m: 20, reuso: true, irrigacao: 'regador', meses_chuva: 'janeiro a abril', solo: 'arenoso',
        producao: { hortalicas: { qtd: '4 canteiros', consumo: true, venda: true, onde: 'Feira de Paulistana' }, galinhas: { qtd: '25 cabeças', consumo: true, venda: true, onde: 'Na comunidade' } },
        praticas: ['esterco', 'sementes'], horas_dia: 3, participa: ['associacao', 'mpa'], dificuldades: 'Falta de água em setembro e outubro; bicho come as mudas.', sonhos: 'Vender mais hortaliças na feira e ter um galinheiro fechado.',
        objetivos: ['alimentacao', 'venda'], frase_objetivo: 'Ter verdura o ano todo e vender na feira toda semana.',
        kit: [{ item: 'Caixa d’água 1.000 L', qtd: '1', para: 'Guardar água da cisterna para o quintal' }, { item: 'Kit de gotejamento', qtd: '1', para: 'Economizar água' }, { item: 'Tela para canteiro', qtd: '20 m', para: 'Proteger das galinhas' }],
        cronograma: [{ oque: 'Preparar canteiros e composto', inicio: 'jan', fim: 'fev', quem: 'Francisca e José' }], compromissos: true } };
    return { equipe: lista, fichas, visitas: [v1, v2, v3], diagnosticos: [diag], auditoria: aud,
      eu: { coord_geral: cg.id, coord_tecnico: ct.id, bolsista: ana.id, agente: gil.id }, perfil: 'coord_geral' };
  }

  function fichasExemplo(ana, maria, ct, gerarCPF) {
    const tudoSim = {}; MQ.CRITERIOS.forEach(([c]) => { tudoSim[c] = true; });
    const f = (n, o) => Object.assign({
      id: 'f' + n + 'x' + Math.random().toString(36).slice(2, 8), uf: 'PI', municipio: 'Paulistana', comunidade: 'Comunidade Lagoa do Mato',
      nome: '', cpf: gerarCPF(700000000 + n * 7919), data_nascimento: '1979-03-12', celular: '(89) 99' + String(4000000 + n).slice(-7),
      endereco: 'Sítio Lagoa do Mato, ' + (10 + n), ponto_referencia: '', nis: null, caf: null, pessoas_familia: 4, indicada_por: 'Associação de Mulheres da Lagoa',
      autodeclaracao: true, p_sustento: false, p_cadunico: true, p_sem_ater: true, p_raca_povo: false, p_jovem: false, p_grupo: true, p_caf: false,
      consent_dados: true, consent_imagem: true, consent_criancas: false, assinatura: 'assinatura', testemunha_nome: null, testemunha_cpf: null,
      resultado: 'selecionada', posicao_espera: null, encaminhada_para: null, justificativa: '',
      foto_ficha_path: 'exemplo', foto_termo_path: 'exemplo', latitude: null, longitude: null,
      situacao: 'aprovada', aprovada_por: ct.id, aprovada_em: '2026-10-22T14:00:00.000Z', obs_coordenacao: null,
      bolsista_id: ana.id, data_ficha: '2026-10-20', criado_em: '2026-10-20T13:00:00.000Z', atualizado_em: '2026-10-22T14:00:00.000Z', exemplo: true
    }, tudoSim, o);
    const lista = [
      f(1, { nome: 'Francisca Alves de Sousa (exemplo)', p_sustento: true, latitude: -8.1102, longitude: -41.1187 }),
      f(2, { nome: 'Raimunda Nonata Ribeiro (exemplo)', comunidade: 'Assentamento Novo Horizonte', endereco: 'Rua do Açude, 3', p_raca_povo: true, latitude: -8.1731, longitude: -41.1649 }),
      f(3, { nome: 'Antônia Pereira Lima (exemplo)', municipio: 'Pio IX', comunidade: 'Comunidade Barra', endereco: 'Sítio Barra, s/n', data_nascimento: '1998-07-02', p_jovem: true, bolsista_id: null, latitude: -6.8121, longitude: -40.5903 }),
      f(4, { nome: 'Josefa Maria da Conceição (exemplo)', situacao: 'aguardando', aprovada_por: null, aprovada_em: null, data_ficha: '2026-10-24', criado_em: '2026-10-24T12:00:00.000Z' }),
      f(5, { nome: 'Luzia Gomes Ferreira (exemplo)', situacao: 'aguardando', aprovada_por: null, aprovada_em: null, endereco: 'Sitio Lagoa do Mato 11', data_ficha: '2026-10-24', criado_em: '2026-10-24T12:30:00.000Z' }),
      f(6, { nome: 'Maria do Socorro Silva (exemplo)', resultado: 'lista_espera', posicao_espera: 1, p_cadunico: false, p_sem_ater: false }),
      f(7, { nome: 'Cícera Rodrigues Nunes (exemplo)', resultado: 'sem_agua', c_agua: false, encaminhada_para: 'Programa Cisternas (ASA) – Paulistana', justificativa: 'Só tem cisterna de consumo; na seca usa carro-pipa.' }),
      f(8, { nome: 'Ivonete Barbosa (exemplo)', situacao: 'devolvida', aprovada_por: null, aprovada_em: null, obs_coordenacao: 'A foto do termo está cortada: falta a assinatura. Fotografe de novo.' }),
      f(9, { uf: 'BA', municipio: 'Itiúba', comunidade: 'Comunidade Caldeirão', nome: 'Edilene Santos Reis (exemplo)', bolsista_id: maria.id, situacao: 'aguardando', aprovada_por: null, aprovada_em: null }),
      f(10, { uf: 'BA', municipio: 'Itiúba', comunidade: 'Comunidade Caldeirão', nome: 'Rosângela Oliveira (exemplo)', bolsista_id: maria.id })
    ];
    lista.forEach(x => { x.pontos = MQ.regras.pontosFicha(x); });
    return lista;
  }
  const fotosMemoria = new Map();

  function ler() {
    if (mem) return mem;
    try { const s = localStorage.getItem(CHAVE); if (s) mem = JSON.parse(s); } catch (e) { /* sem armazenamento */ }
    if (!mem) mem = semente();
    if (!mem.fotosEx) {   // ilustrações de pessoas para a equipe de exemplo (não são fotos de gente de verdade)
      const homens = /^(José|Antônio|Francisco|João|Raimundo|Pedro|Luiz|Manoel|Cícero|Sebastião|Geraldo)\b/;
      const mul = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17], hom = [6, 12, 18];
      mem.equipe.filter(m => m.papel !== 'coord_geral').forEach((m, i) => { if (!m.foto_url) { const l = homens.test(m.nome) ? hom : mul; m.foto_path = 'exemplo'; m.foto_url = 'assets/exemplo/pessoa-' + l[i % l.length] + '.svg'; } });
      mem.fotosEx = true;
    }
    if (!mem.vitrine) {   // duas fotos de exemplo aprovadas pela coordenação (ilustrações)
      const [a, b] = mem.fichas.filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada' && f.consent_imagem);
      mem.vitrine = [a && { id: 'vit-1', path: 'exemplo-1.jpg', ficha_id: a.id, uf: a.uf, legenda: 'Canteiros de hortaliças no sertão do Piauí', sem_criancas: true, publicada_em: '2026-11-10T12:00:00Z' },
        b && { id: 'vit-2', path: 'exemplo-2.jpg', ficha_id: b.id, uf: b.uf, legenda: 'Preparo da área para o quintal, Paulistana (PI)', sem_criancas: true, publicada_em: '2026-11-05T12:00:00Z' }].filter(Boolean);
    }
    return mem;
  }
  /* Demonstração não tem fotos reais: desenha uma ilustração de canteiros (claramente não é foto de ninguém) */
  function ilustracao(seed) {
    let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const verdes = ['#2E6B45', '#3C7D4F', '#4F8F5A', '#6A9F5E'], terra = ['#B98B5E', '#A87B50', '#C69C6D'];
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><rect width="400" height="260" fill="#E9E2CF"/><rect y="0" width="400" height="70" fill="#DCE7D6"/>`;
    for (let i = 0; i < 5; i++) {
      const y = 80 + i * 36, t = terra[(h + i) % 3];
      s += `<rect x="${20 + (h + i) % 20}" y="${y}" width="${330 - (h >> i) % 60}" height="24" rx="6" fill="${t}"/>`;
      for (let j = 0; j < 9; j++) s += `<circle cx="${40 + j * 34 + (h >> j) % 8}" cy="${y + 8 + (j % 2) * 6}" r="${7 + (h >> (i + j)) % 5}" fill="${verdes[(h + i + j) % 4]}"/>`;
    }
    s += `<circle cx="${320 + h % 40}" cy="36" r="18" fill="#E7B04A"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  const bancoMem = {};   // demonstração: dados bancários só na memória (somem ao recarregar), como exemplo de cuidado
  function gravar() { try { localStorage.setItem(CHAVE, JSON.stringify(mem)); } catch (e) { /* segue só em memória */ } }
  const copia = o => JSON.parse(JSON.stringify(o));
  const falha = msg => { const e = new Error(msg); e.regra = true; return e; };

  function euMesmo() {
    const d = ler();
    const id = d.eu[d.perfil];
    return d.equipe.find(x => x.id === id && x.status === 'ativa') || null;
  }
  function auditar(acao, antes, depois) {
    const d = ler(); const eu = euMesmo();
    d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'equipe', registro_id: (depois || antes).id, acao,
      por: eu && eu.id, em: new Date().toISOString(), antes: antes && copia(antes), depois: depois && copia(depois) });
  }
  const CAMPOS_HAB = ['matricula_fic_em', 'matricula_fic_numero', 'docs_funcern_em', 'termo_path', 'termo_assinado_em', 'obs_habilitacao'];

  MQ.apiDemo = {
    modo: 'demo',
    async iniciar() { ler(); return euMesmo(); },
    async eu() { return euMesmo(); },
    perfisDemo() {
      const d = ler();
      // se a bolsista de exemplo foi desligada, usa a primeira bolsista ativa
      if (!d.equipe.some(x => x.id === d.eu.bolsista && x.status === 'ativa')) {
        const b = d.equipe.find(x => R.ehBolsista(x.papel) && x.status === 'ativa'); if (b) d.eu.bolsista = b.id;
      }
      return d.perfil;
    },
    async trocarPerfil(p) { const d = ler(); d.perfil = p; this.perfisDemo(); gravar(); return euMesmo(); },
    async recomecar() { mem = semente(); gravar(); return euMesmo(); },

    async listarEquipe() {
      const d = ler(); const eu = euMesmo(); if (!eu) return [];
      if (eu.papel === 'coord_geral' || eu.papel === 'coord_tecnico') return copia(d.equipe);
      if (R.ehBolsista(eu.papel)) return copia(d.equipe.filter(x => x.id === eu.id || x.uf === eu.uf));
      return copia(d.equipe.filter(x => x.id === eu.id));
    },
    async auditoria() {
      const eu = euMesmo(); if (!eu || !/^coord/.test(eu.papel)) return [];
      return copia(ler().auditoria).reverse();
    },

    async criar(m) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.podeCadastrar(eu.papel, m.papel)) throw falha('Seu perfil não tem permissão para esta ação.');
      const erros = R.validar(m, d.equipe);
      if (Object.keys(erros).length) { const e = falha(Object.values(erros)[0]); e.campos = erros; throw e; }
      const agora = new Date().toISOString();
      const novo = Object.assign({}, m, { id: uid(), cpf: R.soDigitos(m.cpf), email: m.email.trim(), status: 'ativa', user_id: null,
        data_fim: null, motivo_desligamento: null, criado_por: eu.id, criado_em: agora, atualizado_em: agora });
      d.equipe.push(novo); auditar('INSERT', null, novo); gravar();
      return copia(novo);
    },

    async atualizar(id, patch) {
      const d = ler(); const eu = euMesmo();
      const i = d.equipe.findIndex(x => x.id === id); if (i < 0) throw falha('Registro não encontrado.');
      const antes = d.equipe[i];
      const soHab = Object.keys(patch).every(k => CAMPOS_HAB.includes(k));
      const pode = R.podeEditarDados(eu && eu.papel, antes.papel) || (soHab && R.podeEditarHabilitacao(eu && eu.papel, antes.papel));
      if (!pode) throw falha(eu && eu.papel === 'coord_geral' && R.ehBolsista(antes.papel)
        ? 'A coordenação geral só altera a habilitação das bolsistas. Dados pessoais e desligamento são da coordenação técnica.'
        : 'Seu perfil não tem permissão para esta ação.');
      if (antes.status === 'desligada' && patch.status === 'ativa') throw falha('Registro desligado não pode ser reativado. Faça um novo cadastro.');
      ['papel', 'uf', 'cpf'].forEach(k => { if (k in patch && patch[k] !== antes[k]) throw falha('Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.'); });
      const depois = Object.assign({}, antes, patch, { atualizado_em: new Date().toISOString() });
      if (depois.status === 'desligada' && (!depois.data_fim || String(depois.motivo_desligamento || '').trim().length < 5))
        throw falha('Para desligar, informe a data e o motivo.');
      if (depois.status === 'ativa') {
        const erros = R.validar(depois, d.equipe);
        delete erros.papel;
        if (Object.keys(erros).length) { const e = falha(Object.values(erros)[0]); e.campos = erros; throw e; }
      }
      d.equipe[i] = depois; auditar('UPDATE', antes, depois); gravar();
      return copia(depois);
    },

    /* ---------- Fichas de indicação (mesmas regras do 02_fichas.sql) ---------- */
    async listarFichas() {
      const d = ler(); d.fichas = d.fichas || []; const eu = euMesmo(); if (!eu) return [];
      if (/^coord/.test(eu.papel)) return copia(d.fichas);
      if (eu.papel === 'agente') { const ids = new Set((d.visitas || []).filter(v => v.executor_id === eu.id && v.situacao !== 'cancelada').map(v => v.ficha_id)); return copia(d.fichas.filter(f => ids.has(f.id))); }
      return copia(d.fichas.filter(f => f.uf === eu.uf));
    },
    async salvarFicha(dados, fotos) {
      const d = ler(); d.fichas = d.fichas || []; const eu = euMesmo();
      if (!eu || !R.ehBolsista(eu.papel) || dados.uf !== eu.uf) throw falha('Seu perfil não tem permissão para esta ação.');
      const i = d.fichas.findIndex(x => x.id === dados.id);
      const antes = i >= 0 ? d.fichas[i] : null;
      if (antes && antes.situacao === 'aprovada') throw falha('Ficha já aprovada pela coordenação técnica. Para corrigir, peça que ela devolva a ficha.');
      if (d.fichas.some(x => x.id !== dados.id && x.cpf === R.soDigitos(dados.cpf))) throw falha(R.mensagemErro('fichas_cpf_unico'));
      if (!dados.consent_dados) throw falha(R.mensagemErro('consent_dados'));
      if (['selecionada', 'lista_espera'].includes(dados.resultado) && !(R.criteriosOk(dados) && dados.autodeclaracao)) throw falha(R.mensagemErro('criterios_para_selecao'));
      const f = Object.assign({}, antes || {}, dados);
      Object.entries(fotos || {}).forEach(([campo, blob]) => {
        if (!blob) return; const path = f.uf + '/' + f.id + '/' + campo; fotosMemoria.set(path, URL.createObjectURL(blob)); f['foto_' + campo + '_path'] = path;
      });
      delete f.tem_foto_ficha; delete f.tem_foto_termo;
      const agora = new Date().toISOString();
      Object.assign(f, { cpf: R.soDigitos(f.cpf), pontos: R.pontosFicha(f), situacao: 'aguardando', bolsista_id: antes ? antes.bolsista_id : eu.id,
        criado_em: antes ? antes.criado_em : agora, atualizado_em: agora, aprovada_por: antes ? antes.aprovada_por : null, aprovada_em: antes ? antes.aprovada_em : null,
        obs_coordenacao: antes ? antes.obs_coordenacao : null });
      if (i >= 0) d.fichas[i] = f; else d.fichas.unshift(f);
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fichas', registro_id: f.id, acao: antes ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: antes && copia(antes), depois: copia(f) });
      gravar(); return copia(f);
    },
    async decidirFicha(id, situacao, obs) {
      const d = ler(); const eu = euMesmo();
      if (!eu || eu.papel !== 'coord_tecnico') throw falha('Só a coordenação técnica aprova ou devolve fichas.');
      const i = d.fichas.findIndex(x => x.id === id); if (i < 0) throw falha('Ficha não encontrada.');
      const antes = d.fichas[i];
      if (situacao === 'devolvida' && String(obs || '').trim().length < 5) throw falha('Para devolver, escreva o que a bolsista precisa corrigir.');
      if (situacao === 'aprovada' && antes.resultado === 'selecionada' &&
          d.fichas.filter(x => x.uf === antes.uf && x.resultado === 'selecionada' && x.situacao === 'aprovada' && x.id !== id).length >= MQ.VAGAS_UF)
        throw falha('O estado ' + antes.uf + ' já tem 40 selecionadas aprovadas. Esta mulher deve ir para a lista de espera.');
      const agora = new Date().toISOString();
      const f = Object.assign({}, antes, { situacao, obs_coordenacao: obs || null, atualizado_em: agora,
        aprovada_por: situacao === 'aprovada' ? eu.id : null, aprovada_em: situacao === 'aprovada' ? agora : null });
      d.fichas[i] = f;
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fichas', registro_id: id, acao: 'UPDATE', por: eu.id, em: agora, antes: copia(antes), depois: copia(f) });
      gravar(); return copia(f);
    },
    async linkFoto(path) { return fotosMemoria.get(path) || null; },

    /* ---------- Visitas e diagnósticos (mesmas regras do 03_campo.sql) ---------- */
    async listarVisitas() {
      const d = ler(); d.visitas = d.visitas || []; const eu = euMesmo(); if (!eu) return [];
      if (/^coord/.test(eu.papel)) return copia(d.visitas);
      if (R.ehBolsista(eu.papel)) return copia(d.visitas.filter(v => v.uf === eu.uf));
      return copia(d.visitas.filter(v => v.executor_id === eu.id));
    },
    async salvarVisita(v) {
      const d = ler(); d.visitas = d.visitas || []; const eu = euMesmo();
      const i = d.visitas.findIndex(x => x.id === v.id); const antes = i >= 0 ? d.visitas[i] : null;
      const f = d.fichas.find(x => x.id === v.ficha_id);
      if (!f) throw falha('Ficha não encontrada.');
      if (!eu || !(eu.papel === 'coord_tecnico' || (R.ehBolsista(eu.papel) && f.uf === eu.uf) || (antes && antes.executor_id === eu.id))) throw falha('Seu perfil não tem permissão para esta ação.');
      if (eu.papel === 'agente' && antes && (v.executor_id !== antes.executor_id || v.data_prevista !== antes.data_prevista || v.situacao === 'cancelada')) throw falha('O agente de campo não reagenda nem cancela visitas. Fale com a bolsista do estado.');
      if (!(f.resultado === 'selecionada' && f.situacao === 'aprovada')) throw falha('Só há visita para mulher selecionada e aprovada pela coordenação técnica.');
      const ex = d.equipe.find(x => x.id === v.executor_id);
      if (!ex || ex.status !== 'ativa' || !R.ehCampo(ex.papel)) throw falha('Quem faz a visita precisa ser bolsista ou agente de campo ativa.');
      if (ex.uf !== f.uf) throw falha('Quem faz a visita precisa ser do mesmo estado do quintal.');
      if (v.situacao !== 'cancelada' && !R.habilitado(ex)) throw falha(ex.nome + ' ainda não está habilitada (FIC, FUNCERN e termo): a visita não poderia ser paga.');
      if (!antes) {
        const mesmas = d.visitas.filter(x => x.ficha_id === v.ficha_id && x.etapa === v.etapa && x.situacao !== 'cancelada').length;
        if (mesmas >= MQ.ETAPAS[v.etapa].max) throw falha(v.etapa === 'acompanhamento' ? 'Este quintal já tem as 2 visitas de acompanhamento.' : 'Este quintal já tem essa visita agendada ou feita.');
        if (v.etapa !== 'diagnostico' && !d.visitas.some(x => x.ficha_id === v.ficha_id && x.etapa === 'diagnostico' && x.situacao === 'realizada')) throw falha('Primeiro o diagnóstico: implantação e acompanhamento só depois dele.');
        if (d.visitas.filter(x => x.uf === f.uf && x.situacao !== 'cancelada').length >= MQ.DIAS_CAMPO_UF) throw falha('O estado ' + f.uf + ' já usou os 160 dias de campo previstos.');
      }
      const agora = new Date().toISOString();
      const n = Object.assign({}, antes || {}, v, { uf: f.uf, atualizado_em: agora, criado_em: antes ? antes.criado_em : agora, criado_por: antes ? antes.criado_por : eu.id });
      if (!n.situacao) n.situacao = 'prevista';
      if (i >= 0) d.visitas[i] = n; else d.visitas.push(n);
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'visitas', registro_id: n.id, acao: antes ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: antes && copia(antes), depois: copia(n) });
      gravar(); return copia(n);
    },
    async listarDiagnosticos() {
      const d = ler(); d.diagnosticos = d.diagnosticos || []; const eu = euMesmo(); if (!eu) return [];
      if (/^coord/.test(eu.papel)) return copia(d.diagnosticos);
      if (R.ehBolsista(eu.papel)) return copia(d.diagnosticos.filter(x => x.uf === eu.uf));
      return copia(d.diagnosticos.filter(x => x.executor_id === eu.id));
    },
    async salvarDiagnostico(dados, fotos) {
      const d = ler(); d.diagnosticos = d.diagnosticos || []; const eu = euMesmo();
      const v = (d.visitas || []).find(x => x.id === dados.visita_id);
      if (!v || v.etapa !== 'diagnostico' || v.ficha_id !== dados.ficha_id) throw falha('O diagnóstico precisa estar ligado à visita de diagnóstico desta mulher.');
      if (!eu || !((R.ehBolsista(eu.papel) && v.uf === eu.uf) || v.executor_id === eu.id)) throw falha('Seu perfil não tem permissão para esta ação.');
      const i = d.diagnosticos.findIndex(x => x.id === dados.id); const antes = i >= 0 ? d.diagnosticos[i] : null;
      if (!antes && d.diagnosticos.some(x => x.ficha_id === dados.ficha_id)) throw falha('Este quintal já tem diagnóstico registrado.');
      if (antes && antes.situacao === 'aprovado') throw falha('Plano já aprovado pela coordenação técnica. Peça que ela devolva para corrigir.');
      if (dados.latitude == null && String(dados.sem_gps_motivo || '').trim().length < 5) throw falha('Registre a localização ou explique por que não foi possível.');
      const caminhos = new Set(dados.fotos || (antes && antes.fotos) || []);
      Object.entries(fotos || {}).forEach(([campo, blob]) => { if (!blob) return; const path = v.uf + '/' + v.ficha_id + '/diag_' + campo; fotosMemoria.set(path, URL.createObjectURL(blob)); caminhos.add(path); });
      const agora = new Date().toISOString();
      const n = Object.assign({}, antes || {}, dados, { uf: v.uf, executor_id: v.executor_id, fotos: [...caminhos], situacao: 'aguardando',
        aprovado_por: antes ? antes.aprovado_por : null, aprovado_em: antes ? antes.aprovado_em : null, obs_coordenacao: antes ? antes.obs_coordenacao : null,
        criado_em: antes ? antes.criado_em : agora, atualizado_em: agora });
      if (i >= 0) d.diagnosticos[i] = n; else d.diagnosticos.push(n);
      Object.assign(v, { situacao: 'realizada', data_realizada: n.data_visita, atualizado_em: agora });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'diagnosticos', registro_id: n.id, acao: antes ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: antes && copia(antes), depois: copia(n) });
      gravar(); return copia(n);
    },
    async decidirDiagnostico(id, situacao, obs) {
      const d = ler(); const eu = euMesmo();
      if (!eu || eu.papel !== 'coord_tecnico') throw falha('Só a coordenação técnica aprova ou devolve o plano.');
      const i = d.diagnosticos.findIndex(x => x.id === id); if (i < 0) throw falha('Diagnóstico não encontrado.');
      if (situacao === 'devolvido' && String(obs || '').trim().length < 5) throw falha('Para devolver, escreva o que precisa ser corrigido.');
      const agora = new Date().toISOString(); const antes = d.diagnosticos[i];
      d.diagnosticos[i] = Object.assign({}, antes, { situacao, obs_coordenacao: obs || null, atualizado_em: agora,
        aprovado_por: situacao === 'aprovado' ? eu.id : antes.aprovado_por, aprovado_em: situacao === 'aprovado' ? agora : antes.aprovado_em });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'diagnosticos', registro_id: id, acao: 'UPDATE', por: eu.id, em: agora, antes: copia(antes), depois: copia(d.diagnosticos[i]) });
      gravar(); return copia(d.diagnosticos[i]);
    },

    /* ---------- Link de cadastro (mesmas regras do 08_convites.sql) ---------- */
    async criarConvite(papel, uf, subst) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.podeCadastrar(eu.papel, papel)) throw falha('Seu perfil não pode cadastrar esta função.');
      const ativa = d.equipe.find(m => m.status === 'ativa' && m.papel === papel && (papel === 'coord_tecnico' || (R.ehBolsista(papel) && m.uf === uf)));
      if (ativa && papel !== 'agente') throw falha(papel === 'coord_tecnico' ? 'Já há coordenação técnica ativa. Desligue antes de convidar outra.' : 'Esta vaga já está ocupada no estado.');
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      d.convites = (d.convites || []).concat([{ id: uid(), token, papel, uf: papel === 'coord_tecnico' ? null : uf, substitui_id: subst || null, criado_por: eu.id,
        criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 7 * 864e5).toISOString(), usado_em: null }]);
      gravar(); return token;
    },
    async verConvite(token) {
      const c = (ler().convites || []).find(x => x.token === token);
      if (!c) return { valido: false, motivo: 'inexistente' };
      const motivo = c.usado_em ? 'usado' : new Date(c.expira_em) <= new Date() ? 'vencido' : null;
      return { papel: c.papel, uf: c.uf, expira_em: c.expira_em, valido: !motivo, motivo };
    },
    async enviarPreCadastro(token, dados) {
      const d = ler(); const c = (d.convites || []).find(x => x.token === token);
      if (!c || c.usado_em || new Date(c.expira_em) <= new Date()) throw falha('Este link não vale mais. Peça um novo à coordenação.');
      if (!dados.consentimento_lgpd) throw falha('É preciso aceitar o uso dos dados para o cadastro.');
      const cpf = R.soDigitos(dados.cpf), email = String(dados.email || '').trim().toLowerCase();
      if (d.equipe.some(m => m.status === 'ativa' && (m.cpf === cpf || String(m.email).toLowerCase() === email))) throw falha('Já existe pessoa ativa na equipe com este CPF ou e-mail. Fale com a coordenação.');
      d.pre_cadastros = (d.pre_cadastros || []).concat([{ id: uid(), convite_id: c.id, papel: c.papel, uf: c.uf, substitui_id: c.substitui_id,
        nome: String(dados.nome).trim(), cpf, email, telefone: dados.telefone || null, municipio: dados.municipio || null, organizacao: dados.organizacao || null,
        nome_social: dados.nome_social || null, data_nascimento: dados.data_nascimento || null, nis: dados.nis || null, endereco: dados.endereco || {}, socioeconomico: dados.socioeconomico || null,
        consentimento_lgpd: true, enviado_em: new Date().toISOString(), situacao: 'aguardando' }]);
      c.usado_em = new Date().toISOString(); gravar();
    },
    async lerPrivado(id) {
      const d = ler(); const eu = euMesmo(); if (!eu || !(eu.id === id || /^coord/.test(eu.papel))) return null;
      return copia((d.privado || {})[id] || null);
    },
    async salvarPrivado(id, dados) {
      const d = ler(); const eu = euMesmo(); const m = d.equipe.find(x => x.id === id);
      if (!eu || !m || !(eu.id === id || R.podeCadastrar(eu.papel, m.papel))) throw falha('Seu perfil não pode alterar estes dados.');
      d.privado = d.privado || {}; d.privado[id] = Object.assign({ equipe_id: id }, copia(dados)); gravar();
    },
    async meusDadosBancarios() { const eu = euMesmo(); return eu ? copia((bancoMem[eu.id]) || null) : null; },
    async salvarMeusDadosBancarios(dd) { const eu = euMesmo(); if (!eu) throw falha('Entre no sistema.'); bancoMem[eu.id] = Object.assign({}, dd, { atualizado_em: new Date().toISOString() }); },
    async situacaoBancaria() {
      const eu = euMesmo(); if (!eu || !/^coord/.test(eu.papel)) return [];
      return ler().equipe.filter(m => m.status === 'ativa' && m.papel !== 'coord_geral').map(m => ({ equipe_id: m.id, informado: !!bancoMem[m.id], atualizado_em: (bancoMem[m.id] || {}).atualizado_em || null }));
    },
    async exportarDadosBancarios() {
      const eu = euMesmo(); if (!eu || eu.papel !== 'coord_geral') throw falha('Só a coordenação geral gera a planilha bancária para a FUNCERN.');
      return ler().equipe.filter(m => m.status === 'ativa' && bancoMem[m.id]).map(m => Object.assign({ nome: m.nome, cpf: m.cpf, papel: m.papel, uf: m.uf, email: m.email, telefone: m.telefone }, bancoMem[m.id]));
    },
    async listarPreCadastros() {
      const eu = euMesmo(); if (!eu) return [];
      return copia((ler().pre_cadastros || []).filter(x => x.situacao === 'aguardando' && R.podeCadastrar(eu.papel, x.papel)));
    },
    async decidirPreCadastro(id, situacao, obs, equipe_id) {
      const d = ler(); const eu = euMesmo(); const x = (d.pre_cadastros || []).find(y => y.id === id);
      if (!x || !eu || !R.podeCadastrar(eu.papel, x.papel)) throw falha('Seu perfil não pode decidir este cadastro.');
      if (x.situacao !== 'aguardando') throw falha('Este pré-cadastro já foi decidido.');
      if (situacao === 'recusado' && String(obs || '').trim().length < 5) throw falha('Para recusar, escreva o motivo.');
      Object.assign(x, { situacao, obs: obs || null, equipe_id: equipe_id || null, decidido_por: eu.id, decidido_em: new Date().toISOString() }); gravar();
    },

    /* ---------- Ajuda de custo por visita (mesmas regras do 04_vitrine_e_custos.sql) ---------- */
    async lerParametros(chave) { const d = ler(); return copia((d.parametros || {})[chave] || MQ.CUSTO_PADRAO); },
    async salvarParametros(chave, valor) {
      const eu = euMesmo(); if (!eu || !/^coord/.test(eu.papel)) throw falha('Só a coordenação altera valores de pagamento.');
      const d = ler(); d.parametros = d.parametros || {}; d.parametros[chave] = copia(valor); gravar(); return copia(valor);
    },
    async listarCustos() {
      const d = ler(); const eu = euMesmo(); if (!eu) return [];
      if (/^coord/.test(eu.papel)) return copia(d.custos || []);
      const minhas = new Set((d.visitas || []).filter(v => v.executor_id === eu.id).map(v => v.id));
      return copia((d.custos || []).filter(c => minhas.has(c.visita_id)));
    },
    async salvarKm(visita_id, km_ida) {
      const eu = euMesmo(); if (!eu || !/^coord/.test(eu.papel)) throw falha('Só a coordenação altera valores de pagamento.');
      if (km_ida != null && !(km_ida >= 0 && km_ida < 1000)) throw falha('Distância inválida (0 a 999 km).');
      const d = ler(); d.custos = (d.custos || []).filter(c => c.visita_id !== visita_id);
      if (km_ida != null) d.custos.push({ visita_id, km_ida, definido_em: new Date().toISOString() });
      gravar(); return km_ida;
    },

    /* ---------- Vitrine pública: mesmas regras do 04_vitrine_e_custos.sql ---------- */
    async vitrine() {
      const d = ler(); const n = (arr, fn) => arr.filter(fn).length;
      const por_uf = MQ.UFS.map(({ uf }) => ({ uf,
        fichas: n(d.fichas, f => f.uf === uf),
        selecionadas: n(d.fichas, f => f.uf === uf && f.resultado === 'selecionada' && f.situacao === 'aprovada'),
        diagnosticos: n(d.diagnosticos || [], x => x.uf === uf),
        planos: n(d.diagnosticos || [], x => x.uf === uf && x.situacao === 'aprovado'),
        implantados: n(d.visitas || [], v => v.uf === uf && v.etapa === 'implantacao' && v.situacao === 'realizada'),
        acompanhamentos: n(d.visitas || [], v => v.uf === uf && v.etapa === 'acompanhamento' && v.situacao === 'realizada') }));
      const ativos = d.equipe.filter(m => m.status === 'ativa');
      const fotos = (d.vitrine || []).filter(v => { const f = d.fichas.find(x => x.id === v.ficha_id); return f && f.consent_imagem && (f.consent_criancas || v.sem_criancas); })
        .slice(0, 24).map(v => ({ path: v.path, legenda: v.legenda, uf: v.uf, url: ilustracao(v.path) }));
      return { atualizado_em: new Date().toISOString(), por_uf, fotos,
        equipe: { bolsistas: n(ativos, m => R.ehBolsista(m.papel)), agentes: n(ativos, m => m.papel === 'agente') } };
    },
    async listarVitrine() { return copia(ler().vitrine || []).map(v => Object.assign(v, { url: ilustracao(v.path) })); },
    async publicarFoto({ ficha_id, origem, legenda, sem_criancas }) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !/^coord/.test(eu.papel)) throw falha('Só a coordenação publica fotos na vitrine.');
      const f = d.fichas.find(x => x.id === ficha_id); if (!f) throw falha('Ficha não encontrada.');
      if (!f.consent_imagem) throw falha('Esta mulher não autorizou uso de imagem. A foto não pode ser publicada.');
      if (!f.consent_criancas && !sem_criancas) throw falha('A autorização não inclui crianças: confirme que nenhuma criança aparece na foto.');
      const leg = String(legenda || '').trim();
      if (leg.length < 5 || leg.length > 140) throw falha('Escreva uma legenda de 5 a 140 caracteres.');
      const pn = String(f.nome || '').split(' ')[0];
      if (pn.length >= 3 && new RegExp('(^|[^\\p{L}])' + pn + '($|[^\\p{L}])', 'iu').test(leg)) throw falha('A legenda não pode trazer o nome da mulher.');
      const v = { id: MQ.novoId(), path: MQ.novoId() + '.jpg', ficha_id, uf: f.uf, legenda: leg, sem_criancas: !!sem_criancas, publicada_por: eu.id, publicada_em: new Date().toISOString(), origem };
      d.vitrine = [v].concat(d.vitrine || []); gravar(); return copia(v);
    },
    async retirarFoto(id) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !/^coord/.test(eu.papel)) throw falha('Só a coordenação retira fotos da vitrine.');
      d.vitrine = (d.vitrine || []).filter(v => v.id !== id); gravar();
    },

    async desligar(id, data_fim, motivo) {
      const d = ler(); const m = d.equipe.find(x => x.id === id);
      if (m && ['agente', 'articulacao', 'apoio'].includes(m.papel)) {
        const vp = (d.visitas || []).filter(v => v.executor_id === id && v.situacao === 'prevista').length;
        const dv = (d.diagnosticos || []).filter(x => x.executor_id === id && x.situacao === 'devolvido').length;
        if (vp || dv) throw falha(`Não dá para desligar ainda: ${vp} visita(s) agendada(s) com ela e ${dv} diagnóstico(s) devolvido(s) para ela corrigir. Passe as visitas para outra pessoa ou cancele, e resolva os diagnósticos.`);
      }
      return this.atualizar(id, { status: 'desligada', data_fim, motivo_desligamento: motivo });
    },

    async enviarFotoEquipe(id, blob) {
      const d = ler(); const eu = euMesmo(); const m = d.equipe.find(x => x.id === id);
      if (!m) throw falha('Pessoa não encontrada.');
      const pode = eu && (eu.id === id || (eu.papel === 'coord_tecnico' && m.papel !== 'coord_geral') || (eu.papel === 'coord_geral' && m.papel !== 'coord_geral'));
      if (!pode) throw falha('Só a coordenação ou a própria pessoa troca a foto.');
      const url = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
      m.foto_path = 'demo/' + id + '.jpg'; m.foto_url = url; gravar(); return m.foto_path;
    },
    async enviarTermo(id, arquivo) { return arquivo.name; },   // no demo guarda só o nome
    async linkTermo(path) { return null; },
    async entrar() { throw falha('No modo demonstração não há login: use o seletor de perfil.'); },
    async sair() {}
  };
})();
