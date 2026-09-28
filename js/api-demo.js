/* Modo demonstração: roda sem servidor, guarda no próprio navegador e aplica
   as mesmas regras do banco. Os dados são de exemplo. */
(function () {
  const R = MQ.regras;
  const CHAVE = 'mq-demo-v2';
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
    const fichas = fichasExemplo(ana, maria, ct, gerarCPF);
    fichas.forEach(f => aud.push({ id: k++, tabela: 'fichas', registro_id: f.id, acao: 'INSERT', por: f.bolsista_id, em: f.criado_em, antes: null, depois: f }));
    return { equipe: lista, fichas, auditoria: aud, eu: { coord_geral: cg.id, coord_tecnico: ct.id, bolsista: ana.id }, perfil: 'coord_geral' };
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
      f(1, { nome: 'Francisca Alves de Sousa (exemplo)', p_sustento: true }),
      f(2, { nome: 'Raimunda Nonata Ribeiro (exemplo)', comunidade: 'Assentamento Novo Horizonte', endereco: 'Rua do Açude, 3', p_raca_povo: true }),
      f(3, { nome: 'Antônia Pereira Lima (exemplo)', municipio: 'Pio IX', comunidade: 'Comunidade Barra', endereco: 'Sítio Barra, s/n', data_nascimento: '1998-07-02', p_jovem: true, bolsista_id: null }),
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
    return mem;
  }
  function gravar() { try { localStorage.setItem(CHAVE, JSON.stringify(mem)); } catch (e) { /* segue só em memória */ } }
  const copia = o => JSON.parse(JSON.stringify(o));
  const falha = msg => { const e = new Error(msg); e.regra = true; return e; };

  function euMesmo() {
    const d = ler();
    const id = d.perfil === 'bolsista' ? d.eu.bolsista : d.eu[d.perfil];
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

    async desligar(id, data_fim, motivo) { return this.atualizar(id, { status: 'desligada', data_fim, motivo_desligamento: motivo }); },

    async enviarTermo(id, arquivo) { return arquivo.name; },   // no demo guarda só o nome
    async linkTermo(path) { return null; },
    async entrar() { throw falha('No modo demonstração não há login: use o seletor de perfil.'); },
    async sair() {}
  };
})();
