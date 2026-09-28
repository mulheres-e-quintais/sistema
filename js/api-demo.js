/* Modo demonstração: roda sem servidor, guarda no próprio navegador e aplica
   as mesmas regras do banco. Os dados são de exemplo. */
(function () {
  const R = MQ.regras;
  const CHAVE = 'mq-demo-v1';
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
    return { equipe: lista, auditoria: aud, eu: { coord_geral: cg.id, coord_tecnico: ct.id, bolsista: lista[2].id }, perfil: 'coord_geral' };
  }

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

    async desligar(id, data_fim, motivo) { return this.atualizar(id, { status: 'desligada', data_fim, motivo_desligamento: motivo }); },

    async enviarTermo(id, arquivo) { return arquivo.name; },   // no demo guarda só o nome
    async linkTermo(path) { return null; },
    async entrar() { throw falha('No modo demonstração não há login: use o seletor de perfil.'); },
    async sair() {}
  };
})();
