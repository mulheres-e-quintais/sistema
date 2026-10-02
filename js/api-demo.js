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
    // 46: a data da ficha de exemplo nunca fica no futuro (a visita não pode ter data anterior à da ficha)
    const dataFicha = (fixa, diasAtras) => fixa <= R.hoje() ? fixa : R.somaDias(R.hoje(), -diasAtras);
    const f = (n, o) => Object.assign({
      id: 'f' + n + 'x' + Math.random().toString(36).slice(2, 8), uf: 'PI', municipio: 'Paulistana', comunidade: 'Comunidade Lagoa do Mato',
      nome: '', cpf: gerarCPF(700000000 + n * 7919), data_nascimento: '1979-03-12', celular: '(89) 99' + String(4000000 + n).slice(-7),
      endereco: 'Sítio Lagoa do Mato, ' + (10 + n), ponto_referencia: '', nis: null, caf: null, pessoas_familia: 4, indicada_por: 'Associação de Mulheres da Lagoa',
      autodeclaracao: true, p_sustento: false, p_cadunico: true, p_sem_ater: true, p_raca_povo: false, p_jovem: false, p_grupo: true, p_caf: false,
      consent_dados: true, consent_imagem: true, consent_criancas: false, assinatura: 'assinatura', testemunha_nome: null, testemunha_cpf: null,
      resultado: 'selecionada', posicao_espera: null, encaminhada_para: null, justificativa: '',
      foto_ficha_path: 'exemplo', foto_termo_path: 'exemplo', latitude: null, longitude: null,
      situacao: 'aprovada', aprovada_por: ct.id, aprovada_em: '2026-10-22T14:00:00.000Z', obs_coordenacao: null,
      bolsista_id: ana.id, data_ficha: dataFicha('2026-10-20', 12), criado_em: '2026-10-20T13:00:00.000Z', atualizado_em: '2026-10-22T14:00:00.000Z', exemplo: true
    }, tudoSim, o);
    const lista = [
      f(1, { nome: 'Francisca Alves de Sousa (exemplo)', p_sustento: true, latitude: -8.1102, longitude: -41.1187 }),
      f(2, { nome: 'Raimunda Nonata Ribeiro (exemplo)', comunidade: 'Assentamento Novo Horizonte', endereco: 'Rua do Açude, 3', p_raca_povo: true, latitude: -8.1731, longitude: -41.1649 }),
      f(3, { nome: 'Antônia Pereira Lima (exemplo)', municipio: 'Pio IX', comunidade: 'Comunidade Barra', endereco: 'Sítio Barra, s/n', data_nascimento: '1998-07-02', p_jovem: true, bolsista_id: null, latitude: -6.8121, longitude: -40.5903 }),
      f(4, { nome: 'Josefa Maria da Conceição (exemplo)', situacao: 'aguardando', aprovada_por: null, aprovada_em: null, data_ficha: dataFicha('2026-10-24', 8), criado_em: '2026-10-24T12:00:00.000Z' }),
      f(5, { nome: 'Luzia Gomes Ferreira (exemplo)', situacao: 'aguardando', aprovada_por: null, aprovada_em: null, endereco: 'Sitio Lagoa do Mato 11', data_ficha: dataFicha('2026-10-24', 8), criado_em: '2026-10-24T12:30:00.000Z' }),
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
    if (!mem.fic) {   // curso FIC: 2 professores, 1 turma no PI e as matrículas que já existiam (exemplo)
      const cg = mem.equipe.find(m => m.papel === 'coord_geral'); const t0 = '2026-09-27T12:00:00.000Z';
      const prof = (nome, n, cpf, email, foto) => ({ id: uid(), user_id: null, papel: 'professor_fic', uf: null, nome, cpf: gerarCPF(cpf), email, telefone: '(84) 99' + n + '-10' + n,
        municipio: 'Apodi/RN', organizacao: 'IFRN Campus Apodi', data_inicio: MQ.PROJETO.inicioBolsas, data_fim: null, motivo_desligamento: null,
        meta_diagnosticos: null, meta_quintais: null, meta_visitas: null, matricula_fic_em: null, matricula_fic_numero: null,
        docs_funcern_em: '2026-09-28', termo_path: null, termo_assinado_em: null, obs_habilitacao: null, consentimento_lgpd: true, status: 'ativa',
        substitui_id: null, criado_por: cg && cg.id, criado_em: t0, atualizado_em: t0, exemplo: true, foto_path: 'exemplo', foto_url: 'assets/exemplo/pessoa-' + foto + '.svg' });
      const p1 = prof('Tiago Menezes (exemplo)', 811, 912345678, 'tiago.exemplo@ifrn.edu.br', 12), p2 = prof('Clara Bezerra (exemplo)', 822, 923456781, 'clara.exemplo@ifrn.edu.br', 9);
      p1.termo_assinado_em = '2026-09-28';   // um professor habilitado (33): sem ele não se cadastra técnica, bolsista nem agente
      mem.equipe.push(p1, p2); mem.eu.professor = p1.id;
      const tu = { id: uid(), nome: 'FIC Agroecologia e Quintais Produtivos – Piauí (exemplo)', uf: 'PI', municipio: 'Paulistana', inicio: '2026-09-29', fim: '2027-03-31',
        professor_id: p1.id, obs: null, criado_por: p1.id, criado_em: t0, atualizado_em: t0 };
      mem.turmas = [tu];
      // 44_venda.sql: canais de venda de exemplo (o município da demonstração)
      mem.canaisVenda = [
        { id: uid(), uf: 'PI', municipio: 'Paulistana', tipo: 'feira', nome: 'Feira da agricultura familiar (exemplo)', detalhe: 'Sábado de manhã, na praça do mercado. Banca dividida entre as mulheres do grupo.', contato: 'Dona Francisca (exemplo) · (89) 90000-0001', ativo: true, criado_em: new Date().toISOString() },
        { id: uid(), uf: 'PI', municipio: 'Paulistana', tipo: 'grupo', nome: 'Associação de Mulheres da Lagoa (exemplo)', detalhe: 'Reúne a produção e apresenta a proposta de venda para a merenda escolar.', contato: null, ativo: true, criado_em: new Date().toISOString() },
        { id: uid(), uf: 'PI', municipio: 'Paulistana', tipo: 'merenda', nome: 'Secretaria de Educação (exemplo)', detalhe: 'Compra hortaliças e frutas para as escolas por chamada pública.', contato: null, ativo: true, criado_em: new Date().toISOString() }];
      mem.orientacoesVenda = [];
      mem.matriculas = mem.equipe.filter(m => m.status === 'ativa' && m.uf === 'PI' && m.matricula_fic_em)
        .map(m => ({ id: uid(), turma_id: tu.id, equipe_id: m.id, numero: m.matricula_fic_numero, matriculado_em: m.matricula_fic_em, criado_por: p1.id, criado_em: t0, cancelada_em: null }));
      mem.fic = true;
    }
    if (!mem.aux) {   // auxiliar administrativo de exemplo
      const cg = mem.equipe.find(m => m.papel === 'coord_geral'); const t0 = '2026-09-27T12:00:00.000Z';
      const ax = { id: uid(), user_id: null, papel: 'auxiliar_adm', uf: null, nome: 'Rosa Maria Dantas (exemplo)', cpf: gerarCPF(934567812), email: 'rosa.exemplo@ifrn.edu.br',
        telefone: '(84) 99833-1083', municipio: 'Apodi/RN', organizacao: 'IFRN Campus Apodi', data_inicio: MQ.PROJETO.inicioBolsas, data_fim: null, motivo_desligamento: null,
        meta_diagnosticos: null, meta_quintais: null, meta_visitas: null, matricula_fic_em: null, matricula_fic_numero: null, docs_funcern_em: null, termo_path: null,
        termo_assinado_em: null, obs_habilitacao: null, consentimento_lgpd: true, status: 'ativa', substitui_id: null, criado_por: cg && cg.id, criado_em: t0, atualizado_em: t0,
        exemplo: true, foto_path: 'exemplo', foto_url: 'assets/exemplo/pessoa-15.svg' };
      mem.equipe.push(ax); mem.eu.auxiliar = ax.id; mem.aux = true;
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

  // 38: quem estava matriculado na turma na data do encontro; mês com a bolsa do professor pedida (ou com aval) fica fechado
  const matriculadosEm = (d, turma, data) => (d.matriculas || []).filter(m => m.turma_id === turma && String(m.matriculado_em || '').slice(0, 10) <= data
    && (!m.cancelada_em || R.diaLocal(m.cancelada_em) > data)).map(m => m.equipe_id);
  const ficMesFechado = (d, prof, data) => (d.solicitacoes || []).some(s => s.tipo === 'bolsa' && s.equipe_id === prof && String(s.mes).slice(0, 7) === String(data).slice(0, 7)
    && ['solicitada', 'avalizada', 'lancada'].includes(s.situacao));
  /* 46_regras_decididas.sql: o que o modo demonstração precisa para espelhar as regras novas do banco */
  const dataExiste = t => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t || '')); if (!m) return false; const x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return x.getUTCFullYear() === +m[1] && x.getUTCMonth() === +m[2] - 1 && x.getUTCDate() === +m[3]; };
  const ehPedagogico = p => p.tipo === 'passagem' && ((p.dados || {}).finalidade) === 'pedagogico';
  const usadoPassagem = (d, pedag, semId) => (d.pedidos || []).filter(y => y.id !== semId && y.situacao === 'autorizado' && y.tipo === 'passagem' && ehPedagogico(y) === pedag).reduce((t, y) => t + (+y.valor_autorizado || 0), 0);
  const visitaPaga = (d, vid) => { const sid = (d.solic_visitas || {})[vid]; return !!sid && ((d.solicitacoes || []).find(x => x.id === sid) || {}).situacao === 'lancada'; };
  const MSG_ALTERADO = 'Este registro foi alterado enquanto você lia. Abra de novo e confira.';
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
    async reler() { mem = null; ler(); return euMesmo(); },   // lê de novo o que está guardado no aparelho (outra aba mudou; testes)
    async recomecar() { mem = null; try { localStorage.removeItem(CHAVE); } catch (e) {} ler(); gravar(); return euMesmo(); },

    /* ---------- Execução: planilha de gastos do mês (mesmas regras do 37_execucao_planilhas.sql): só a coordenação geral; nada se altera nem se apaga ---------- */
    /* ---------- acesso à água (mesmas regras do 39_agua.sql): coordenação registra cada mudança; nada se altera nem se apaga ---------- */
    /* 44_venda.sql: canais de venda por município e orientação dada à mulher */
    async listarCanaisVenda() {
      const eu = euMesmo(); if (!eu) return []; const l = ler().canaisVenda || [];
      if (['coord_geral', 'coord_tecnico'].includes(eu.papel)) return copia(l);
      return ['articulacao', 'apoio', 'agente'].includes(eu.papel) ? copia(l.filter(c => c.uf === eu.uf)) : [];
    },
    async salvarCanalVenda(x) {
      const d = ler(); const eu = euMesmo(); d.canaisVenda = d.canaisVenda || [];
      if (!eu || !['coord_geral', 'coord_tecnico', 'articulacao', 'apoio'].includes(eu.papel)) throw falha('Quem cadastra os canais de venda é a coordenação ou a bolsista do estado.');
      const atual = x.id ? d.canaisVenda.find(c => c.id === x.id) : null;
      if (x.id && !atual) throw falha('Canal não encontrado.');
      const uf = atual ? atual.uf : x.uf;
      if (!['AL', 'BA', 'PE', 'PI', 'SE'].includes(uf)) throw falha('Escolha o estado.');
      if (R.ehBolsista(eu.papel) && uf !== eu.uf) throw falha('Você cadastra canais só do seu estado.');
      if (String(x.municipio || '').trim().length < 2) throw falha('Informe o município.');
      if (!['feira', 'grupo', 'merenda', 'paa', 'comprador', 'outro'].includes(x.tipo)) throw falha('Escolha o tipo de canal.');
      if (String(x.nome || '').trim().length < 3) throw falha('Dê um nome ao canal (pelo menos 3 letras).');
      const igual = s => String(s || '').trim().toLowerCase();
      const mesmo = c => c.uf === uf && igual(c.municipio) === igual(x.municipio) && c.tipo === x.tipo && igual(c.nome) === igual(x.nome);
      if (!atual && d.canaisVenda.some(mesmo)) throw falha('Este canal já está cadastrado neste município.');
      // 46: ao mudar o nome, o tipo ou o município, o canal não pode virar repetido de outro
      if (atual && (igual(x.nome) !== igual(atual.nome) || x.tipo !== atual.tipo || igual(x.municipio) !== igual(atual.municipio)) && d.canaisVenda.some(c => c.id !== atual.id && mesmo(c)))
        throw falha('Já existe outro canal com este nome e tipo neste município.');
      const agora = new Date().toISOString();
      const novo = { uf, municipio: x.municipio.trim(), tipo: x.tipo, nome: x.nome.trim(), detalhe: String(x.detalhe || '').trim() || null, contato: String(x.contato || '').trim() || null, ativo: x.ativo !== false, atualizado_por: eu.id, atualizado_em: agora };
      if (atual) Object.assign(atual, novo); else d.canaisVenda.push(Object.assign({ id: uid(), criado_por: eu.id, criado_em: agora }, novo));
      gravar(d); return atual ? atual.id : d.canaisVenda[d.canaisVenda.length - 1].id;
    },
    async listarOrientacoesVenda() {
      const eu = euMesmo(); if (!eu) return []; const l = ler().orientacoesVenda || [];
      if (['coord_geral', 'coord_tecnico'].includes(eu.papel)) return copia(l);
      if (R.ehBolsista(eu.papel)) return copia(l.filter(o => o.uf === eu.uf));
      return copia(l.filter(o => o.feito_por === eu.id));
    },
    async registrarOrientacaoVenda(ficha_id, dados) {
      const d = ler(); const eu = euMesmo(); d.orientacoesVenda = d.orientacoesVenda || [];
      if (!eu || !['coord_geral', 'coord_tecnico', 'articulacao', 'apoio', 'agente'].includes(eu.papel)) throw falha('Quem registra a orientação de venda é quem visita o quintal ou a coordenação.');
      const f = (d.fichas || []).find(x => x.id === ficha_id);
      if (!f) throw falha('Ficha não encontrada.');
      if (!(f.resultado === 'selecionada' && f.situacao === 'aprovada')) throw falha('A orientação de venda é para mulher selecionada e aprovada.');
      if (['articulacao', 'apoio', 'agente'].includes(eu.papel) && f.uf !== eu.uf) throw falha('Este quintal é de outro estado.');
      if (eu.papel === 'agente' && !(d.visitas || []).some(v => v.ficha_id === ficha_id && v.executor_id === eu.id && v.situacao !== 'cancelada')) throw falha('Você registra a orientação só dos quintais que visita.');
      if (!(d.diagnosticos || []).some(x => x.ficha_id === ficha_id)) throw falha('Primeiro o diagnóstico do quintal.');
      if (!Array.isArray(dados && dados.sobra)) throw falha('Marque o que está sobrando no quintal (ou registre que nada sobra).');
      if (!['sim', 'nao', 'nao_sabe'].includes(dados.caf)) throw falha('Responda se a família tem CAF ou DAP.');
      const o = { id: uid(), ficha_id, uf: f.uf, dados: copia(dados), feito_por: eu.id, feito_em: new Date().toISOString() };
      d.orientacoesVenda.push(o); gravar(d); return o.id;
    },
    async listarAgua() {
      const eu = euMesmo(); if (!eu || !['coord_geral', 'coord_tecnico'].includes(eu.papel)) return [];
      return copia(ler().aguaSituacoes || []);
    },
    async registrarSituacaoAgua(ficha_id, situacao, obs) {
      const d = ler(); const eu = euMesmo(); d.aguaSituacoes = d.aguaSituacoes || [];
      if (!eu || !['coord_geral', 'coord_tecnico'].includes(eu.papel)) throw falha('Quem registra a situação da água é a coordenação.');
      const f = (d.fichas || []).find(x => x.id === ficha_id);
      if (!(f && f.resultado === 'sem_agua') && !(d.diagnosticos || []).some(x => x.ficha_id === ficha_id && x.sem_agua)) throw falha('Esta mulher não está na lista de quem precisa de solução de água.');
      if (!['sem_solucao', 'encaminhada', 'em_andamento', 'concluida'].includes(situacao)) throw falha('Situação inválida.');
      const t = String(obs || '').trim();
      if (t.length < 10) throw falha('Escreva o que aconteceu (pelo menos 10 letras): programa, órgão, o que foi feito.');
      if (t.length > 500) throw falha('A observação passou de 500 letras.');
      const atual = d.aguaSituacoes.filter(x => x.ficha_id === ficha_id).sort((a, b) => String(b.registrado_em).localeCompare(String(a.registrado_em)))[0];
      if (atual && atual.situacao === situacao) throw falha('A situação já é esta. Escolha a nova situação.');
      const r = { id: uid(), ficha_id, situacao, obs: t, registrado_por: eu.id, registrado_em: new Date().toISOString() };
      d.aguaSituacoes.push(r); d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'agua_situacoes', registro_id: r.id, acao: 'INSERT', por: eu.id, em: r.registrado_em, antes: null, depois: copia(r) });
      gravar(); return r.id;
    },
    async listarPlanilhasExec() {
      const eu = euMesmo(); if (!eu || eu.papel !== 'coord_geral') return [];
      return copia(ler().execPlanilhas || []);
    },
    async enviarPlanilhaExec(dd, arquivo) {
      const d = ler(); const eu = euMesmo();
      if (!eu || eu.papel !== 'coord_geral') throw falha('Só a coordenação geral envia a planilha de gastos.');
      if (!dd.posicao_em || dd.posicao_em > R.hoje()) throw falha('A data da planilha não pode ser no futuro.');
      if (!Array.isArray(dd.linhas) || !dd.linhas.length || dd.linhas.length > 5000) throw falha('A planilha precisa ter de 1 a 5000 linhas com valor.');
      const limpo = String((arquivo && arquivo.name) || dd.arquivo_nome || 'planilha').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
      const path = String(dd.posicao_em).slice(0, 4) + '/' + uid() + '_' + limpo;
      try { if (typeof URL !== 'undefined' && URL.createObjectURL && arquivo instanceof Blob) fotosMemoria.set(path, URL.createObjectURL(arquivo)); } catch (e) { /* sem arquivo na demonstração */ }
      const x = { id: uid(), posicao_em: dd.posicao_em, arquivo_path: path, arquivo_nome: String(dd.arquivo_nome || limpo).slice(0, 200), linhas: copia(dd.linhas),
        total_gasto: +dd.total_gasto || 0, total_recebido: +dd.total_recebido || 0, nao_classificadas: +dd.nao_classificadas || 0, obs: dd.obs || null, enviado_por: eu.id, enviado_em: new Date().toISOString() };
      d.execPlanilhas = (d.execPlanilhas || []).concat([x]);
      const aud = Object.assign({}, x); delete aud.linhas;
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'execucao_planilhas', registro_id: x.id, acao: 'INSERT', por: eu.id, em: x.enviado_em, antes: null, depois: aud });
      gravar(); return copia(x);
    },
    async linkPlanilhaExec(path) { return fotosMemoria.get(path) || null; },

    /* ---------- Documentos do projeto (mesmas regras do 24_documentos.sql): só a coordenação geral ---------- */
    async listarDocumentos() {
      const eu = euMesmo(); if (!eu || eu.papel !== 'coord_geral') return [];
      return copia((ler().documentos || []).slice().sort((a, b) => String(b.data_documento).localeCompare(String(a.data_documento))));
    },
    async enviarDocumento(dd, arquivo) {
      const d = ler(); const eu = euMesmo();
      if (!eu || eu.papel !== 'coord_geral') throw falha('Só a coordenação geral anexa documentos do projeto.');
      const erros = MQ.docsUI ? MQ.docsUI.validarDocumento(dd, arquivo) : {};
      if (Object.keys(erros).length) { const e = falha(Object.values(erros)[0]); e.campos = erros; throw e; }
      if (String(dd.data_documento) < '2025-01-01' || String(dd.data_documento) > R.somaDias(R.hoje(), 365)) throw falha('Confira a data do documento: precisa ser a partir de 01/01/2025 e no máximo um ano à frente.');   // 46
      const agora = new Date().toISOString(); const path = String(dd.data_documento).slice(0, 4) + '/' + uid() + '_' + arquivo.name;
      try { if (typeof URL !== 'undefined' && URL.createObjectURL && arquivo instanceof Blob) fotosMemoria.set(path, URL.createObjectURL(arquivo)); } catch (e) { /* sem arquivo na demonstração */ }
      const x = Object.assign({ id: uid() }, copia(dd), { arquivo_path: path, arquivo_nome: arquivo.name, tamanho: arquivo.size, mime: arquivo.type || null,
        enviado_por: eu.id, enviado_em: agora, arquivado_em: null, arquivado_por: null, motivo_arquivo: null });
      d.documentos = (d.documentos || []).concat([x]);
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'documentos_projeto', registro_id: x.id, acao: 'INSERT', por: eu.id, em: agora, antes: null, depois: copia(x) });
      gravar(); return copia(x);
    },
    async linkDocumento(path) { return fotosMemoria.get(path) || null; },
    async arquivarDocumento(id, motivo) {
      const d = ler(); const eu = euMesmo(); const x = (d.documentos || []).find(y => y.id === id);
      if (!eu || eu.papel !== 'coord_geral') throw falha('Só a coordenação geral arquiva documentos.');
      if (!x) throw falha('Documento não encontrado.');
      if (x.arquivado_em) throw falha('Este documento já está arquivado.');
      if (String(motivo || '').trim().length < 5) throw falha('Para arquivar, escreva o motivo.');
      const antes = copia(x); Object.assign(x, { arquivado_em: new Date().toISOString(), arquivado_por: eu.id, motivo_arquivo: String(motivo).trim() });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'documentos_projeto', registro_id: x.id, acao: 'UPDATE', por: eu.id, em: x.arquivado_em, antes, depois: copia(x) });
      gravar();
    },

    /* ---------- Pedidos de passagem e evento (mesmas regras do 22_passagens_eventos.sql) ---------- */
    /* quem confere os pedidos agora (26_conferencia_auxiliar.sql): técnica; sem ela, o auxiliar; sem os dois, a geral */
    async quemConferePedidos() {
      const d = ler(); const ativo = papel => (d.equipe || []).some(m => m.papel === papel && m.status === 'ativa');
      return ativo('coord_tecnico') ? 'coord_tecnico' : ativo('auxiliar_adm') ? 'auxiliar_adm' : 'coord_geral';
    },
    async listarPedidos() {
      const d = ler(); const eu = euMesmo(); if (!eu) return [];
      const ve = ['coord_geral', 'coord_tecnico'].includes(eu.papel) || (eu.papel === 'auxiliar_adm' && await this.quemConferePedidos() === 'auxiliar_adm');
      return copia((d.pedidos || []).filter(p => ve || p.solicitante_id === eu.id).sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em))));
    },
    async salvarPedido(id, tipo, titulo, data, dados, justificativa) {
      const d = ler(); const eu = euMesmo(); d.pedidos = d.pedidos || [];
      if (!eu || eu.papel !== 'articulacao') throw falha('Quem pede passagem e estrutura de evento é a bolsista de articulação estadual.');
      const ant = { passagem: 40, evento: 45 }[tipo]; if (!ant) throw falha('Tipo de pedido inválido.');
      if (!data || data < R.hoje()) throw falha('Informe uma data que ainda não passou.');
      if (data > '2027-09-30') throw falha('A data passa do fim do projeto (setembro de 2027).');
      const dias = Math.round((new Date(data + 'T12:00:00') - new Date(R.hoje() + 'T12:00:00')) / 864e5);
      if (dias < ant && String(justificativa || '').trim().length < 15) throw falha('Pedido fora do prazo (' + ant + ' dias antes). Escreva a justificativa.');
      if (tipo === 'passagem' && !((dados && dados.passageiros) || []).length) throw falha('Informe pelo menos uma passageira ou passageiro.');
      const ve = +(dados || {}).valor_estimado;
      if (!(ve > 0)) throw falha('Informe o valor estimado do pedido (R$).');   // 35
      // 46: valor de R$ 0,01 a R$ 1.000.000,00 já no envio; nascimento de verdade; ninguém duas vezes na lista
      if (!(Math.round(ve * 100) / 100 >= 0.01 && ve <= 1000000)) throw falha('O valor estimado precisa ficar entre R$ 0,01 e R$ 1.000.000,00 (veio ' + R.fmtBRL(ve) + '). Confira.');
      if (tipo === 'passagem') {
        const cpfs = [];
        for (const x of dados.passageiros) {
          const nome = String((x || {}).nome || '').trim().slice(0, 60), nasc = (x || {}).nascimento;
          if (nasc) {
            if (!dataExiste(nasc)) throw falha('A data de nascimento de ' + nome + ' não é uma data que existe. Confira dia, mês e ano.');
            if (nasc > R.hoje()) throw falha('A data de nascimento de ' + nome + ' está no futuro. Confira.');
            if (nasc < '1901-01-01') throw falha('Confira a data de nascimento de ' + nome + ': o ano está antigo demais.');
          }
          const c = R.soDigitos((x || {}).cpf);
          if (c && cpfs.includes(c)) throw falha('A mesma pessoa (CPF) aparece duas vezes na lista de passageiras. Deixe cada pessoa uma vez só.');
          if (c) cpfs.push(c);
        }
        if (dados.volta && !dataExiste(dados.volta)) throw falha('A data da volta não é uma data que existe. Confira dia, mês e ano.');
      }
      const agora = new Date().toISOString(); let p = null;
      if (id) {
        p = d.pedidos.find(x => x.id === id);
        if (!p || p.solicitante_id !== eu.id) throw falha('Pedido não encontrado.');
        if (p.situacao !== 'devolvido') throw falha('Só dá para corrigir pedido devolvido.');
      }
      // 46: passagem nova (ou quando a finalidade muda) diz para quê; pedido antigo sem finalidade não trava
      if (tipo === 'passagem' && (!p || (dados.finalidade || null) !== ((p.dados || {}).finalidade || null)) && !['intercambio', 'pedagogico'].includes(dados.finalidade))
        throw falha('Escolha para que é a passagem: intercâmbio ou acompanhamento pedagógico.');
      if (!p) { p = { id: uid(), tipo, uf: eu.uf, solicitante_id: eu.id, criado_em: agora }; d.pedidos.push(p); }
      Object.assign(p, { titulo, data_ref: data, dados: copia(dados), justificativa_prazo: justificativa || null, situacao: 'enviado', enviado_em: agora, conferido_por: null, conferido_em: null, decidido_por: null, decidido_em: null, valor_autorizado: null });
      const aud = Object.assign({}, p); delete aud.dados;
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'pedidos_apoio', registro_id: p.id, acao: id ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: null, depois: aud });
      gravar(); return p.id;
    },
    /* tetos (mesmas regras do 35_tetos_passagens_eventos.sql) */
    async definirValorPedido(id, valor) {
      const d = ler(); const eu = euMesmo(); const p = (d.pedidos || []).find(x => x.id === id);
      if (!eu || eu.papel !== 'coord_geral') throw falha('Só a coordenação geral define o valor autorizado.');
      if (!(+valor > 0)) throw falha('Informe um valor maior que zero.');
      if (!(Math.round(+valor * 100) / 100 >= 0.01)) throw falha('Informe um valor maior que zero (pelo menos R$ 0,01).');   // 46
      if (!(+valor <= 1000000)) throw falha('Valor acima do esperado (' + R.fmtBRL(+valor) + '; o máximo é R$ 1.000.000,00). Confira.');
      if (!p || p.situacao !== 'conferido') throw falha('Só dá para definir o valor de pedido conferido, antes de autorizar.');
      p.valor_autorizado = Math.round(+valor * 100) / 100; gravar();
    },
    async saldoPedidos() {
      const d = ler(); const aut = (d.pedidos || []).filter(p => p.situacao === 'autorizado');
      const ev = {}; aut.filter(p => p.tipo === 'evento').forEach(p => { ev[p.uf] = (ev[p.uf] || 0) + (+p.valor_autorizado || 0); });
      // 46: um saldo por finalidade; os nomes antigos (passagem_*) valem para o intercâmbio, onde conta a passagem antiga sem finalidade
      const inter = usadoPassagem(d, false), pedag = usadoPassagem(d, true);
      return { passagem_teto: MQ.TETOS.passagem, passagem_usado: inter, passagem_saldo: Math.max(MQ.TETOS.passagem - inter, 0),
        passagem_pedagogico_teto: MQ.TETOS.passagem_pedagogico, passagem_pedagogico_usado: pedag, passagem_pedagogico_saldo: Math.max(MQ.TETOS.passagem_pedagogico - pedag, 0),
        evento_teto: MQ.TETOS.evento, evento_usado: ev };
    },
    async moverPedido(id, acao, obs, protocolo) {
      const d = ler(); const eu = euMesmo(); const p = (d.pedidos || []).find(x => x.id === id);
      if (!eu || !p) throw falha('Pedido não encontrado.');
      const papel = eu.papel; const agora = new Date().toISOString(); const o = String(obs || '').trim();
      const pedag = ehPedagogico(p);   // 46: passagem de acompanhamento pedagógico: só a coordenação geral confere (e autoriza)
      const conferente = pedag ? 'coord_geral' : await this.quemConferePedidos();
      const nomeConf = { coord_tecnico: 'a coordenação técnica', auxiliar_adm: 'o auxiliar administrativo', coord_geral: 'a coordenação geral' }[conferente];
      if (pedag && ['conferir', 'devolver'].includes(acao) && papel !== 'coord_geral') throw falha('Pedido de acompanhamento pedagógico: só a coordenação geral confere.');
      if (acao === 'conferir') {
        if (papel !== conferente) throw falha('Quem confere agora é ' + nomeConf + '.');
        if (p.solicitante_id === eu.id) throw falha('Ninguém confere o próprio pedido.');
        if (p.situacao !== 'enviado') throw falha('Este pedido não está esperando conferência.');
        Object.assign(p, { situacao: 'conferido', conferido_por: eu.id, conferido_em: agora, obs: null });
      } else if (acao === 'devolver') {
        if (!((papel === conferente && p.situacao === 'enviado') || (papel === 'coord_geral' && p.situacao === 'conferido'))) throw falha('Este pedido não pode ser devolvido agora.');
        if (o.length < 5) throw falha('Para devolver, escreva o que precisa ser corrigido.');
        Object.assign(p, { situacao: 'devolvido', obs: o, decidido_por: eu.id, decidido_em: agora, valor_autorizado: null });   // 42: pedido devolvido perde o valor autorizado
      } else if (acao === 'autorizar') {
        if (papel !== 'coord_geral') throw falha('Quem autoriza e manda para a FUNCERN é a coordenação geral.');
        if (p.situacao !== 'conferido') throw falha('Só pedido conferido pode ser autorizado.');
        if (p.conferido_por === eu.id && conferente !== 'coord_geral') throw falha('Quem conferiu não autoriza o mesmo pedido. Devolva para ' + nomeConf + '.');
        const v = +p.valor_autorizado || +(p.dados || {}).valor_estimado || 0;   // 35: teto por estado (evento) e do projeto (passagem)
        if (!(v > 0)) throw falha('Informe o valor para autorizar.');
        // 46: passagens têm um teto por finalidade (a antiga, sem finalidade, conta no intercâmbio)
        const outros = p.tipo === 'evento' ? (d.pedidos || []).filter(y => y.id !== p.id && y.situacao === 'autorizado' && y.tipo === 'evento' && y.uf === p.uf).reduce((t, y) => t + (+y.valor_autorizado || 0), 0)
          : usadoPassagem(d, pedag, p.id);
        const teto = p.tipo === 'evento' ? MQ.TETOS.evento : MQ.tetoPassagem(pedag ? 'pedagogico' : 'intercambio');
        if (outros + v > teto) throw falha((p.tipo === 'evento' ? 'Passa do teto de eventos de ' + p.uf + ' (R$ 6.000,00)' : pedag ? 'Passa do teto de passagens de acompanhamento pedagógico (R$ 22.400,00)' : 'Passa do teto de passagens de intercâmbio (R$ 70.000,00)') + ': já autorizado ' + R.fmtBRL(outros) + ', saldo ' + R.fmtBRL(teto - outros) + '.');
        p.valor_autorizado = v;
        Object.assign(p, { situacao: 'autorizado', decidido_por: eu.id, decidido_em: agora, obs: o || null, funcern_protocolo: String(protocolo || '').trim() || null });
      } else if (acao === 'recusar') {
        if (papel !== 'coord_geral') throw falha('Quem recusa é a coordenação geral.');
        if (!['enviado', 'conferido'].includes(p.situacao)) throw falha('Este pedido não pode ser recusado agora.');
        if (o.length < 5) throw falha('Escreva o motivo da recusa.');
        Object.assign(p, { situacao: 'recusado', obs: o, decidido_por: eu.id, decidido_em: agora });
      } else if (acao === 'cancelar') {
        if (p.solicitante_id !== eu.id) throw falha('Só quem pediu pode cancelar.');
        if (!['enviado', 'devolvido'].includes(p.situacao)) throw falha('Depois de conferido, peça à coordenação para cancelar.');
        Object.assign(p, { situacao: 'cancelado', obs: o || 'Cancelado por quem pediu.', decidido_por: eu.id, decidido_em: agora });
      } else if (acao === 'protocolo') {
        if (papel !== 'coord_geral') throw falha('Só a coordenação geral registra o protocolo da FUNCERN.');
        if (p.situacao !== 'autorizado') throw falha('Só pedido autorizado tem protocolo.');
        p.funcern_protocolo = String(protocolo || '').trim() || null;
      } else throw falha('Ação inválida.');
      const aud = Object.assign({}, p); delete aud.dados;
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'pedidos_apoio', registro_id: p.id, acao: 'UPDATE', por: eu.id, em: agora, antes: null, depois: aud });
      gravar();
    },

    /* ---------- Solicitação de pagamento (mesmas regras do 12_pagamentos.sql) ---------- */
    async listarSolicitacoes() {
      const d = ler(); const eu = euMesmo(); if (!eu) return { lista: [], vinculos: {} };
      const ve = ['coord_geral', 'coord_tecnico', 'auxiliar_adm'].includes(eu.papel);
      const l = (d.solicitacoes || []).filter(s => ve || s.equipe_id === eu.id).sort((a, b) => String(b.solicitada_em).localeCompare(String(a.solicitada_em)));
      const ids = new Set(l.map(s => s.id));
      return copia({ lista: l, vinculos: Object.fromEntries(Object.entries(d.solic_visitas || {}).filter(([, sid]) => ids.has(sid))) });
    },
    async solicitarPagamento(tipo, mes, valor, relatorio, visitas, detalhe) {
      const d = ler(); const eu = euMesmo(); d.solicitacoes = d.solicitacoes || []; d.solic_visitas = d.solic_visitas || {};
      if (!eu) throw falha('Entre no sistema para solicitar.');
      if (!['ajuda_custo', 'bolsa'].includes(tipo)) throw falha('Tipo de pagamento inválido: escolha ajuda de custo ou bolsa.');   // 46
      if (!mes) throw falha('Informe o mês do pedido.');
      if (tipo === 'ajuda_custo' && !R.ehCampo(eu.papel)) throw falha('Ajuda de custo é só para bolsistas e agentes de campo que fazem visitas.');
      if (tipo === 'bolsa' && !['coord_tecnico', 'articulacao', 'apoio', 'professor_fic', 'auxiliar_adm'].includes(eu.papel)) throw falha('Seu perfil não recebe bolsa mensal pelo projeto.');
      if (!R.habilitado(eu)) throw falha('Sua habilitação ainda não está completa: sem ela não há pagamento.');
      const m = String(mes).slice(0, 7) + '-01'; if (m.slice(0, 7) > R.hoje().slice(0, 7)) throw falha('Só dá para solicitar o mês atual ou meses anteriores.');
      const ini = (d.equipe.find(x => x.id === eu.id) || eu).data_inicio;   // 32: nada antes do mês de início
      if (ini && m.slice(0, 7) < String(ini).slice(0, 7)) throw falha('Você começou no projeto em ' + String(ini).slice(5, 7) + '/' + String(ini).slice(0, 4) + ': só dá para solicitar a partir desse mês.');
      // 46: a ajuda de custo pode ter mais de um pedido no mês (complementar); o devolvido é corrigido e reenviado (o mesmo registro).
      //     A bolsa continua uma por mês por pessoa.
      const doMes = d.solicitacoes.filter(x => x.tipo === tipo && x.equipe_id === eu.id && x.mes === m);
      const s = tipo === 'ajuda_custo' ? doMes.filter(x => x.situacao === 'devolvida').sort((a, b) => String(b.aval_em || '').localeCompare(String(a.aval_em || '')))[0] : doMes[0];
      if (tipo === 'bolsa' && s && s.situacao !== 'devolvida') throw falha('Você já solicitou este mês. Acompanhe a situação na lista.');
      const complementar = tipo === 'ajuda_custo' && (s ? !!(s.detalhe || {}).complementar : doMes.some(x => x.situacao !== 'devolvida'));
      if (tipo === 'ajuda_custo') {
        if (!(visitas || []).length) throw falha('Marque as visitas feitas no mês.');
        if (new Set(visitas).size !== visitas.length) throw falha('A mesma visita apareceu duas vezes no pedido. Marque cada visita uma vez só.');
        const ruim = visitas.some(id => { const v = (d.visitas || []).find(x => x.id === id); const sid = d.solic_visitas[id];
          return !v || v.executor_id !== eu.id || v.situacao !== 'realizada' || String(v.data_realizada).slice(0, 7) !== m.slice(0, 7) || (sid && (!s || sid !== s.id)); });
        if (ruim) throw falha('Há visita que não é sua, não está feita, é de outro mês ou já foi solicitada.');
        if (!(+valor > 0)) throw falha('Valor inválido: informe um valor maior que zero.');   // 32: ajuda de custo com valor zero, negativo ou vazio
        if (+valor > 2000 * visitas.length) throw falha('Valor acima do esperado para a ajuda de custo de ' + visitas.length + ' visita(s) (' + R.fmtBRL(+valor) + '; o máximo é R$ 2.000,00 por visita). Confira.');   // 45
        // 46: o valor pedido não passa do total detalhado por visita (1 centavo de tolerância); sem detalhe, vale só o teto por visita
        const det = detalhe && typeof detalhe === 'object' ? detalhe : {};
        const total = typeof det.total === 'number' ? det.total : typeof det.total === 'string' ? R.numBR(det.total)
          : Array.isArray(det.visitas) && det.visitas.length && det.visitas.every(x => x && typeof x.total === 'number') ? det.visitas.reduce((t, x) => t + x.total, 0) : null;
        if (total != null && Math.round(+valor * 100) > Math.round(total * 100) + 1) throw falha('O valor pedido (' + R.fmtBRL(+valor) + ') passa do total das visitas detalhadas (' + R.fmtBRL(total) + '). Confira o pedido.');
        detalhe = Object.assign({}, det); delete detalhe.complementar; if (complementar) detalhe.complementar = true;   // quem diz se é complementar é o sistema
      } else if (String(relatorio || '').trim().length < 50) throw falha('Escreva o relatório de atividades do mês (pelo menos algumas linhas).');
      const agora = new Date().toISOString(); let alvo = s;
      if (tipo === 'bolsa' && eu.papel === 'professor_fic') {   // 38: relatório com os encontros do mês e a presença, gravado pelo sistema
        const enc = (d.ficEncontros || []).filter(e => e.professor_id === eu.id && !e.cancelado_em && String(e.data).slice(0, 7) === m.slice(0, 7)).sort((a, b) => String(a.data).localeCompare(String(b.data)));
        if (!enc.length && String((detalhe || {}).justificativa_sem_encontro || '').trim().length < 30) throw falha('Nenhum encontro do curso registrado neste mês: explique por quê (pelo menos 30 letras), por exemplo, mês de preparação do curso.');
        const nomeP = id => { const q = d.equipe.find(y => y.id === id) || {}; return { nome: q.nome_social || q.nome, papel: q.papel, uf: q.uf }; };
        detalhe = Object.assign({}, detalhe || {}, { fic_carga_horaria: Math.round(enc.reduce((t, e) => t + (+e.carga_horaria || 0), 0) * 10) / 10, fic_gerado_em: new Date().toISOString(),
          fic_encontros: enc.map(e => ({ id: e.id, data: e.data, turma: ((d.turmas || []).find(t => t.id === e.turma_id) || {}).nome, carga_horaria: e.carga_horaria, modalidade: e.modalidade, conteudo: e.conteudo,
            presencas: (d.ficPresencas || []).filter(p => p.encontro_id === e.id && (p.presente || matriculadosEm(d, e.turma_id, e.data).includes(p.equipe_id))).map(p => Object.assign(nomeP(p.equipe_id), { presente: p.presente, confirmado_em: p.confirmado_em })).sort((a, b) => String(a.nome).localeCompare(String(b.nome))) })) });
      }
      if (!alvo) { alvo = { id: uid(), tipo, equipe_id: eu.id, mes: m }; d.solicitacoes.push(alvo); }
      Object.assign(alvo, { situacao: 'solicitada', valor_solicitado: valor, valor_avalizado: null, relatorio: relatorio || null, detalhe: detalhe || {}, solicitada_em: agora, aval_por: null, aval_em: null });
      Object.keys(d.solic_visitas).forEach(k => { if (d.solic_visitas[k] === alvo.id) delete d.solic_visitas[k]; });
      (visitas || []).forEach(id => { d.solic_visitas[id] = alvo.id; });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'solicitacoes_pagamento', registro_id: alvo.id, acao: s ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: null, depois: copia(alvo) });
      gravar(); return alvo.id;
    },
    async avalizarPagamento(id, ok, obs, valor) {
      const d = ler(); const eu = euMesmo(); const s = (d.solicitacoes || []).find(x => x.id === id);
      if (!s) throw falha('Solicitação não encontrada.');
      if (s.situacao !== 'solicitada') throw falha('Esta solicitação não está aguardando aval.');
      if (s.equipe_id === eu.id) throw falha('Ninguém dá o aval na própria solicitação.');
      const pe = d.equipe.find(x => x.id === s.equipe_id) || {};
      const quem = s.tipo === 'bolsa' && ['coord_tecnico', 'professor_fic', 'auxiliar_adm'].includes(pe.papel) ? 'coord_geral' : 'coord_tecnico';
      if (!(eu.papel === 'coord_geral' || eu.papel === quem)) throw falha('O aval desta solicitação é da ' + (quem === 'coord_geral' ? 'coordenação geral.' : 'coordenação técnica.'));
      const agora = new Date().toISOString();
      const vAval = valor != null ? valor : s.valor_solicitado;
      if (ok && !(vAval > 0)) throw falha('Informe o valor do aval (maior que zero).');
      if (ok && s.tipo === 'ajuda_custo') {   // teto de R$ 2.000,00 por visita da solicitação, como no banco (45) e na tela: erro de digitação de um zero não vira pagamento
        const nVis = Object.values(d.solic_visitas || {}).filter(sid => sid === s.id).length || ((s.detalhe || {}).visitas || []).length;
        const teto = nVis ? 2000 * nVis : MQ.CUSTO_PADRAO.teto;
        if (vAval > teto) throw falha('Valor muito acima do pedido (' + R.fmtBRL(+s.valor_solicitado || 0) + '). Confira o valor: o aval da ajuda de custo vai até R$ 2.000,00 por visita.');
      }
      if (ok && s.tipo === 'bolsa' && s.valor_solicitado != null && vAval > s.valor_solicitado) throw falha('O aval passa do valor pedido. Para pagar mais, devolva para a pessoa corrigir o valor.');
      if (ok) Object.assign(s, { situacao: 'avalizada', valor_avalizado: vAval, aval_por: eu.id, aval_em: agora, obs_aval: obs || null });
      else {
        if (String(obs || '').trim().length < 5) throw falha('Para devolver, escreva o que precisa ser corrigido.');
        Object.assign(s, { situacao: 'devolvida', aval_por: eu.id, aval_em: agora, obs_aval: obs });
        Object.keys(d.solic_visitas || {}).forEach(k => { if (d.solic_visitas[k] === s.id) delete d.solic_visitas[k]; });
      }
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'solicitacoes_pagamento', registro_id: s.id, acao: 'UPDATE', por: eu.id, em: agora, antes: null, depois: copia(s) });
      gravar();
    },
    async registrarNoArlo(id, protocolo) {
      const d = ler(); const eu = euMesmo(); const s = (d.solicitacoes || []).find(x => x.id === id);
      if (!eu || !['auxiliar_adm', 'coord_geral'].includes(eu.papel)) throw falha('Quem lança o pagamento no Arlo é o auxiliar administrativo.');
      if (!s) throw falha('Solicitação não encontrada.');
      if (s.situacao !== 'avalizada') throw falha('Só solicitação com aval vai para o Arlo.');
      if (s.equipe_id === eu.id) throw falha('O seu próprio pagamento é lançado pela coordenação geral.');
      const agora = new Date().toISOString();
      Object.assign(s, { situacao: 'lancada', arlo_por: eu.id, arlo_em: agora, arlo_protocolo: protocolo || null });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'solicitacoes_pagamento', registro_id: s.id, acao: 'UPDATE', por: eu.id, em: agora, antes: null, depois: copia(s) });
      gravar();
    },

    /* ---------- Curso FIC (mesmas regras do 11_fic.sql) ---------- */
    async listarEquipeFic() {
      const eu = euMesmo(); if (!eu || !['coord_geral', 'coord_tecnico', 'professor_fic'].includes(eu.papel)) return [];
      return copia(ler().equipe.filter(m => m.status === 'ativa' && ['coord_tecnico', 'articulacao', 'apoio', 'agente', 'professor_fic'].includes(m.papel))
        .map(m => ({ id: m.id, papel: m.papel, uf: m.uf, nome: m.nome, nome_social: m.nome_social, municipio: m.municipio, status: m.status,
          matricula_fic_em: m.matricula_fic_em, matricula_fic_numero: m.matricula_fic_numero, foto_path: m.foto_path, foto_url: m.foto_url })));
    },
    async listarTurmas() { const eu = euMesmo(); if (!eu || !['coord_geral', 'coord_tecnico', 'professor_fic'].includes(eu.papel)) return []; return copia(ler().turmas || []); },
    async listarMatriculas() {
      const eu = euMesmo(); if (!eu) return [];
      const l = (ler().matriculas || []).filter(x => !x.cancelada_em);
      return copia(['coord_geral', 'coord_tecnico', 'professor_fic'].includes(eu.papel) ? l : l.filter(x => x.equipe_id === eu.id));
    },
    /* ---------- encontros do FIC e lista de presença (mesmas regras do 38_fic_encontros.sql) ---------- */
    async listarEncontrosFic() {
      const d = ler(); const eu = euMesmo(); if (!eu) return [];
      const enc = d.ficEncontros || [], pres = d.ficPresencas || [];
      const todos = ['coord_geral', 'coord_tecnico', 'professor_fic'].includes(eu.papel);
      const meus = todos ? enc : enc.filter(e => pres.some(p => p.encontro_id === e.id && p.equipe_id === eu.id));
      return copia(meus.map(e => Object.assign({}, e, { presencas: pres.filter(p => p.encontro_id === e.id && (todos || p.equipe_id === eu.id)) })));
    },
    async salvarEncontroFic(x) {
      const d = ler(); const eu = euMesmo(); d.ficEncontros = d.ficEncontros || []; d.ficPresencas = d.ficPresencas || [];
      if (!eu || !['professor_fic', 'coord_geral'].includes(eu.papel)) throw falha('Quem registra os encontros do curso é o professor do FIC.');
      const t = (d.turmas || []).find(y => y.id === x.turma_id);
      if (!t) throw falha('Turma não encontrada.');
      if (!t.professor_id) throw falha('Esta turma não tem professor(a): ajuste a turma antes.');
      if (eu.papel === 'professor_fic' && t.professor_id !== eu.id) throw falha('Esta turma é de outro(a) professor(a): só dá para registrar encontros das suas turmas.');
      const antes = x.id ? d.ficEncontros.find(y => y.id === x.id) : null;
      if (antes && antes.turma_id !== x.turma_id) throw falha('A turma de um encontro não muda. Cancele este e registre de novo na turma certa.');
      if (!x.data || x.data > R.hoje()) throw falha('A data do encontro não pode ser no futuro.');
      if (x.data < '2026-09-01') throw falha('Data antes do início do projeto.');
      if (!(Math.round(+x.carga_horaria * 10) > 0 && +x.carga_horaria <= 12)) throw falha('Informe a carga horária do encontro (até 12 horas).');
      if (!['presencial', 'online', 'ava'].includes(x.modalidade)) throw falha('Modalidade inválida.');
      const cont = String(x.conteudo || '').trim();
      if (cont.length < 10) throw falha('Escreva o que foi trabalhado no encontro (pelo menos 10 letras).');
      if (cont.length > 2000) throw falha('O texto do que foi trabalhado passou de 2.000 letras.');
      const mats = matriculadosEm(d, x.turma_id, x.data);
      const pres = x.presentes || [];
      if (pres.some(id => !mats.includes(id))) throw falha('Só entra na lista de presença quem estava matriculado nesta turma na data do encontro.');
      const agora = new Date().toISOString(); let e;
      if (!x.id) {
        if (ficMesFechado(d, t.professor_id, x.data)) throw falha('A bolsa deste mês do professor já foi pedida: não dá para incluir encontro neste mês (se a coordenação devolver o pedido, reabre).');
        if (d.ficEncontros.some(y => y.turma_id === x.turma_id && y.data === x.data && !y.cancelado_em && String(y.conteudo).trim().toLowerCase() === cont.toLowerCase())) throw falha('Este encontro já está registrado (mesma turma, data e conteúdo).');
        e = { id: uid(), professor_id: t.professor_id, criado_em: agora };   // sempre em nome do professor da turma
      } else {
        e = antes; if (!e) throw falha('Encontro não encontrado.');
        if (eu.papel === 'professor_fic' && e.professor_id !== eu.id) throw falha('Este encontro é de outro(a) professor(a).');
        if (e.cancelado_em) throw falha('Este encontro foi cancelado e não muda mais.');
        if (ficMesFechado(d, e.professor_id, e.data) || ficMesFechado(d, e.professor_id, x.data)) throw falha('A bolsa deste mês já foi pedida: o encontro não muda mais (se a coordenação devolver o pedido, reabre).');
        if (d.ficPresencas.some(p => p.encontro_id === e.id && p.confirmado_em && (!pres.includes(p.equipe_id) || !mats.includes(p.equipe_id))))
          throw falha('Alguém que já confirmou a presença foi desmarcado (ou ficou fora da lista pela nova data). Quem confirmou continua presente.');
      }
      { // 46: mesma turma, dia e modalidade = o mesmo encontro; os encontros da turma no dia somam até 12 horas.
        //     No encontro que já existe, vale só quando o dia ou a modalidade mudam, ou quando as horas aumentam.
        const outrosDia = d.ficEncontros.filter(y => y.turma_id === x.turma_id && y.data === x.data && !y.cancelado_em && y.id !== e.id);
        const ch = Math.round(+x.carga_horaria * 10) / 10;
        if ((!x.id || x.data !== e.data || x.modalidade !== e.modalidade) && outrosDia.some(y => y.modalidade === x.modalidade))
          throw falha('Esta turma já tem encontro registrado neste dia nesta modalidade. Se houve mais horas, altere o encontro que já existe.');
        const soma = outrosDia.reduce((t, y) => t + (+y.carga_horaria || 0), 0) + ch;
        if ((!x.id || x.data !== e.data || ch > +e.carga_horaria) && soma > 12)
          throw falha('Os encontros desta turma neste dia somariam ' + soma.toFixed(1).replace('.', ',') + ' horas: o máximo é 12 horas por dia.');
      }
      if (!x.id) d.ficEncontros.push(e);
      Object.assign(e, { turma_id: x.turma_id, data: x.data, carga_horaria: Math.round(+x.carga_horaria * 10) / 10, modalidade: x.modalidade, conteudo: cont, atualizado_em: agora });
      mats.forEach(id => { const p = d.ficPresencas.find(y => y.encontro_id === e.id && y.equipe_id === id); const v = pres.includes(id);
        if (!p) d.ficPresencas.push({ id: uid(), encontro_id: e.id, equipe_id: id, presente: v, marcado_por: eu.id, marcado_em: agora, confirmado_em: null });
        else if (p.presente !== v) Object.assign(p, { presente: v, marcado_por: eu.id, marcado_em: agora }); });
      d.ficPresencas.filter(p => p.encontro_id === e.id && p.presente && !p.confirmado_em && !mats.includes(p.equipe_id))   // saiu da lista pela nova data: fica ausente
        .forEach(p => Object.assign(p, { presente: false, marcado_por: eu.id, marcado_em: agora }));
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fic_encontros', registro_id: e.id, acao: x.id ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: null, depois: copia(e) });
      gravar(); return e.id;
    },
    async cancelarEncontroFic(id, motivo) {
      const d = ler(); const eu = euMesmo(); const e = (d.ficEncontros || []).find(y => y.id === id);
      if (!eu || !['professor_fic', 'coord_geral'].includes(eu.papel)) throw falha('Quem cancela um encontro é o professor do FIC.');
      if (!e) throw falha('Encontro não encontrado.');
      if (eu.papel === 'professor_fic' && e.professor_id !== eu.id) throw falha('Este encontro é de outro(a) professor(a).');
      if (e.cancelado_em) throw falha('Este encontro já foi cancelado.');
      if (ficMesFechado(d, e.professor_id, e.data)) throw falha('A bolsa deste mês já foi pedida: o encontro não muda mais (se a coordenação devolver o pedido, reabre).');
      if (String(motivo || '').trim().length < 10) throw falha('Escreva o motivo do cancelamento (pelo menos 10 letras).');
      const agora = new Date().toISOString(); Object.assign(e, { cancelado_em: agora, cancelado_por: eu.id, motivo_cancelamento: String(motivo).trim(), atualizado_em: agora });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fic_encontros', registro_id: e.id, acao: 'UPDATE', por: eu.id, em: agora, antes: null, depois: copia(e) });
      gravar();
    },
    async confirmarPresencaFic(encontro_id) {
      const d = ler(); const eu = euMesmo(); const e = (d.ficEncontros || []).find(y => y.id === encontro_id);
      if (!e || e.cancelado_em) throw falha('Este encontro não está disponível para confirmar (foi cancelado?).');
      const p = (d.ficPresencas || []).find(y => y.encontro_id === encontro_id && y.equipe_id === (eu || {}).id && y.presente && !y.confirmado_em);
      if (!p) throw falha('Não há presença sua para confirmar neste encontro (ou já está confirmada).');
      p.confirmado_em = new Date().toISOString(); gravar();
    },
    async salvarTurma(t) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.podeMatricular(eu.papel)) throw falha('Só os professores do FIC criam turmas.');
      if (!d.equipe.some(m => m.id === t.professor_id && m.papel === 'professor_fic' && m.status === 'ativa')) throw falha('A turma precisa de um(a) professor(a) do FIC ativo(a).');
      if (String(t.nome || '').trim().length < 3) throw falha('Dê um nome à turma.');
      if (t.inicio && t.fim && t.fim < t.inicio) throw falha('O fim da turma é antes do início.');
      d.turmas = d.turmas || []; const agora = new Date().toISOString(); const i = d.turmas.findIndex(x => x.id === t.id);
      { // 46: início e fim dentro do período do projeto (só ao criar ou quando a data muda)
        const a0 = i >= 0 ? d.turmas[i] : {}; const fora = v => v < '2026-01-01' || v > '2027-12-31';
        if (t.inicio && t.inicio !== a0.inicio && fora(t.inicio)) throw falha('O início da turma fica entre 01/01/2026 e 31/12/2027.');
        if (t.fim && t.fim !== a0.fim && fora(t.fim)) throw falha('O fim da turma fica entre 01/01/2026 e 31/12/2027.');
      }
      // 46: o professor altera (e cria) só a turma em que ELE é o professor; só a coordenação geral passa a turma para outro
      if (eu.papel === 'professor_fic') {
        if (i >= 0 && d.turmas[i].professor_id !== eu.id) throw falha('Esta turma é de outro(a) professor(a): só ele(a) ou a coordenação geral altera.');
        if (i >= 0 && t.professor_id !== d.turmas[i].professor_id) throw falha('Só a coordenação geral passa a turma para outro(a) professor(a).');
        if (i < 0 && t.professor_id !== eu.id) throw falha('Você cria turmas só no seu nome. Turma de outro(a) professor(a) é criada por ele(a) ou pela coordenação geral.');
      }
      { // 46: turma repetida (mesmo nome, estado, professor e início), só ao criar ou quando um desses muda
        const ig = v => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const a = i >= 0 ? d.turmas[i] : null;
        const mudou = !a || ig(a.nome) !== ig(t.nome) || (a.uf || null) !== (t.uf || null) || a.professor_id !== t.professor_id || (a.inicio || null) !== (t.inicio || null);
        if (mudou && d.turmas.some(x => x.id !== t.id && ig(x.nome) === ig(t.nome) && (x.uf || null) === (t.uf || null) && x.professor_id === t.professor_id && (x.inicio || null) === (t.inicio || null)))
          throw falha('Já existe uma turma com este nome, estado, professor(a) e data de início. Use a que já existe ou mude o nome.');
      }
      if (i >= 0) { const antes = d.turmas[i]; d.turmas[i] = Object.assign({}, antes, t, { atualizado_em: agora }); }
      else d.turmas.push(Object.assign({}, t, { id: uid(), criado_por: eu.id, criado_em: agora, atualizado_em: agora }));
      gravar(); return copia(i >= 0 ? d.turmas[i] : d.turmas[d.turmas.length - 1]);
    },
    async matricular(turma_id, equipe_id, numero, data) {
      const d = ler(); const eu = euMesmo(); const t = (d.turmas || []).find(x => x.id === turma_id);
      if (!t) throw falha('Turma não encontrada.');
      if (!eu || !R.podeMatricular(eu.papel)) throw falha('A matrícula no FIC é feita pelos professores do curso.');
      const p = d.equipe.find(m => m.id === equipe_id);
      if (!p || p.status !== 'ativa' || !R.matriculaFIC(p.papel)) throw falha('Só a coordenação técnica, bolsistas e agentes de campo ativas são matriculadas no FIC.');
      if (!R.cabeNaTurma(t, p)) throw falha('Esta turma é de ' + t.uf + '; ' + p.nome + ' é de ' + p.uf + '.');
      if (String(numero || '').trim().length < 3) throw falha('Informe o número da matrícula (SUAP).');
      if (!data || data > R.hoje()) throw falha('Data da matrícula vazia ou no futuro.');
      d.matriculas = d.matriculas || []; const atual = d.matriculas.find(x => x.equipe_id === equipe_id && !x.cancelada_em);
      if (atual && atual.turma_id !== turma_id) throw falha(p.nome + ' já está matriculada em outra turma. Cancele lá antes de trocar.');
      { // 46: o número de matrícula é de uma pessoa só; ninguém é matriculado antes de a turma começar (só ao matricular ou quando o campo muda)
        const num = String(numero).trim().toLowerCase();
        if (!atual || String(atual.numero).trim().toLowerCase() !== num) {
          const dono = d.matriculas.find(x => !x.cancelada_em && x.equipe_id !== equipe_id && String(x.numero).trim().toLowerCase() === num);
          if (dono) { const q = d.equipe.find(y => y.id === dono.equipe_id) || {}; throw falha('O número de matrícula ' + String(numero).trim() + ' já é de ' + (q.nome_social || q.nome || 'outra pessoa') + '. Cada pessoa tem o seu número: confira no SUAP.'); }
        }
        if (t.inicio && data < t.inicio && (!atual || atual.matriculado_em !== data)) throw falha('A turma começa em ' + R.fmtData(t.inicio) + ': a data da matrícula não pode ser antes disso.');
      }
      if (atual) Object.assign(atual, { numero: String(numero).trim(), matriculado_em: data });
      else d.matriculas.push({ id: uid(), turma_id, equipe_id, numero: String(numero).trim(), matriculado_em: data, criado_por: eu.id, criado_em: new Date().toISOString(), cancelada_em: null });
      const antes = copia(p); Object.assign(p, { matricula_fic_em: data, matricula_fic_numero: String(numero).trim(), atualizado_em: new Date().toISOString() });
      auditar('UPDATE', antes, p); gravar();
    },
    async cancelarMatricula(id, motivo) {
      const d = ler(); const eu = euMesmo(); const m = (d.matriculas || []).find(x => x.id === id && !x.cancelada_em);
      if (!m) throw falha('Matrícula não encontrada ou já cancelada.');
      const t = (d.turmas || []).find(x => x.id === m.turma_id);
      if (!eu || !R.podeMatricular(eu.papel) || !t) throw falha('A matrícula no FIC é cancelada pelos professores do curso.');
      if (String(motivo || '').trim().length < 5) throw falha('Escreva o motivo do cancelamento.');
      if ((d.visitas || []).some(v => v.executor_id === m.equipe_id && v.situacao !== 'cancelada'))
        throw falha('Esta pessoa já tem visita no roteiro de campo, que depende da matrícula. Para corrigir número ou data, matricule de novo na mesma turma.');
      Object.assign(m, { cancelada_em: new Date().toISOString(), motivo_cancelamento: String(motivo).trim() });
      const p = d.equipe.find(x => x.id === m.equipe_id); const antes = copia(p);
      Object.assign(p, { matricula_fic_em: null, matricula_fic_numero: null }); auditar('UPDATE', antes, p); gravar();
    },

    /* demonstração: sem IA de verdade, só arruma maiúsculas e pontuação para mostrar a tela */
    async organizarTexto(texto) {
      await new Promise(r => setTimeout(r, 600));
      const t = String(texto).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(' ');
      return (/[.!?]$/.test(t) ? t : t + '.') + '\n\n(Demonstração: no sistema de verdade, este texto é reescrito pela IA a partir do que foi falado.)';
    },
    async listarPerfisEquipe() { const d = ler(); return Object.values(d.privado || {}).map(x => ({ equipe_id: x.equipe_id, perfil: x.perfil || null })); },
    async listarTestes() { const d = ler(); const eu = euMesmo(); if (!eu) return []; return copia((d.testes || []).filter(x => eu.papel === 'coord_geral' || x.equipe_id === eu.id)); },
    async salvarTeste(r) { const d = ler(); const eu = euMesmo(); if (!eu) throw falha('Entre no sistema para responder.');
      d.testes = (d.testes || []).filter(x => !(x.equipe_id === eu.id && x.tarefa === r.tarefa)).concat([Object.assign({}, r, { equipe_id: eu.id, em: new Date().toISOString() })]); gravar(); },
    async listarEntregas() { const d = ler(); return copia(d.entregas || []); },
    async marcarEntrega(equipe_id, mes, item, marcar) {
      const d = ler(); const eu = euMesmo(); d.entregas = d.entregas || [];
      if (item === 'presenca' && (!eu || eu.id !== equipe_id)) throw falha('Só a própria bolsista marca a lista de presença.');
      if (item === 'ava' && (!eu || !['professor_fic', 'coord_geral'].includes(eu.papel))) throw falha('Só o professor do FIC confirma o acesso ao AVA.');
      if (marcar) {   // 32: nada antes do mês de início (e o AVA, antes da matrícula no FIC)
        const p = d.equipe.find(x => x.id === equipe_id) || {}; const m7 = String(mes).slice(0, 7);
        if (p.data_inicio && m7 < String(p.data_inicio).slice(0, 7)) throw falha((p.nome_social || p.nome) + ' começou no projeto em ' + String(p.data_inicio).slice(5, 7) + '/' + String(p.data_inicio).slice(0, 4) + ': não há entrega antes desse mês.');
        if (item === 'ava' && (!p.matricula_fic_em || m7 < String(p.matricula_fic_em).slice(0, 7))) throw falha('Acesso ao AVA só a partir do mês da matrícula no FIC.');
      }
      // 46: depois da bolsa lançada no Arlo, a entrega daquele mês não se desmarca
      if (!marcar && d.entregas.some(x => x.equipe_id === equipe_id && x.mes === mes && x.item === item)
          && (d.solicitacoes || []).some(x => x.tipo === 'bolsa' && x.equipe_id === equipe_id && String(x.mes).slice(0, 7) === String(mes).slice(0, 7) && x.situacao === 'lancada'))
        throw falha('A bolsa de ' + String(mes).slice(5, 7) + '/' + String(mes).slice(0, 4) + ' já foi lançada no Arlo: a entrega deste mês não pode mais ser desmarcada.');
      d.entregas = d.entregas.filter(x => !(x.equipe_id === equipe_id && x.mes === mes && x.item === item));
      if (marcar) d.entregas.push({ equipe_id, mes, item, marcado_por: eu.id, marcado_em: new Date().toISOString() });
      gravar();
    },
    async listarCiencias() { const d = ler(); return copia(d.ciencias || []); },
    async darCiencia(equipe_id, documento) {
      const d = ler(); d.ciencias = d.ciencias || [];
      if (!d.ciencias.some(x => x.equipe_id === equipe_id && x.documento === documento)) d.ciencias.push({ equipe_id, documento, em: new Date().toISOString() });
      gravar();
    },
    /* demonstração: gera um código para mostrar a tela (não há login de verdade aqui) */
    async trocarSenha(atual, nova) { if (!euMesmo()) throw falha('Entre de novo no sistema para trocar a senha.'); if (atual === nova) throw falha('A nova senha precisa ser diferente da atual.'); },   // demonstração: não há senha de verdade
    /* "Esqueci a senha" (mesmas regras do 28_pedido_novo_acesso.sql) */
    async pedirNovoAcesso(email) {
      const d = ler(); const e = String(email || '').trim().toLowerCase(); d.pedidosAcesso = d.pedidosAcesso || [];
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return;
      const m = d.equipe.find(x => String(x.email).toLowerCase() === e && x.status === 'ativa'); if (!m) return;   // resposta sempre igual
      const aberto = d.pedidosAcesso.find(p => p.equipe_id === m.id && p.situacao === 'aguardando');
      if (aberto) aberto.vezes++; else d.pedidosAcesso.push({ id: uid(), equipe_id: m.id, pedido_em: new Date().toISOString(), vezes: 1, situacao: 'aguardando' });
      gravar();
    },
    async listarPedidosAcesso() {
      const d = ler(); const eu = euMesmo(); if (!eu || eu.papel !== 'coord_geral') return [];
      return copia((d.pedidosAcesso || []).filter(p => p.situacao === 'aguardando'));
    },
    async descartarPedidoAcesso(id) {
      const d = ler(); const eu = euMesmo(); const p = (d.pedidosAcesso || []).find(x => x.id === id);
      if (!eu || eu.papel !== 'coord_geral' || !p) throw falha('Pedido não encontrado.');
      if (p.situacao !== 'aguardando') throw falha('Este pedido já foi resolvido.');
      Object.assign(p, { situacao: 'descartado', resolvido_por: eu.id, resolvido_em: new Date().toISOString() }); gravar();
    },
    /* Últimos acessos (mesmas regras do 30_ultimos_acessos.sql): grava em nome de quem está logado, só a geral lê, 6 meses */
    async registrarAcesso(tipo, aparelho) {
      const TIPOS = ['entrada', 'primeiro_acesso', 'abriu', 'saida', 'saida_inatividade', 'senha_trocada'];
      const d = ler(); const eu = euMesmo(); if (!eu || !TIPOS.includes(tipo)) return;
      const limite = Date.now() - 183 * 864e5;
      d.acessos = (d.acessos || []).filter(a => new Date(a.em).getTime() >= limite);
      d.acessos.push({ id: d.acessos.length ? Math.max(...d.acessos.map(a => a.id)) + 1 : 1, equipe_id: eu.id, em: new Date().toISOString(), tipo, aparelho: String(aparelho || '').slice(0, 80) || null, ip: null });
      if (d.acessos.length > 2000) d.acessos = d.acessos.slice(-2000);
      gravar();
    },
    async listarAcessos() {
      const eu = euMesmo(); if (!eu || eu.papel !== 'coord_geral') return [];
      return copia(ler().acessos || []).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 500);
    },
    async gerarCodigoAcesso(id) {
      const d = ler(); const eu = euMesmo(); const m = d.equipe.find(x => x.id === id);
      if (!m || m.status !== 'ativa') throw falha('Cadastro não encontrado ou desligado.');
      if (!eu || !R.podeCadastrar(eu.papel, m.papel)) throw falha('Você não pode gerar o acesso desta pessoa.');
      if (m.user_id && eu.papel !== 'coord_geral') throw falha('Esta pessoa já tem senha. Só a coordenação geral libera um novo primeiro acesso.');
      if (m.user_id) m.user_id = null;
      (d.pedidosAcesso || []).filter(p => p.equipe_id === m.id && p.situacao === 'aguardando')   // código gerado = pedido atendido
        .forEach(p => Object.assign(p, { situacao: 'atendido', resolvido_por: eu.id, resolvido_em: new Date().toISOString() }));
      gravar();
      const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = new Uint8Array(8); crypto.getRandomValues(r);
      const c = Array.from(r, x => a[x % a.length]).join(''); return c.slice(0, 4) + '-' + c.slice(4);
    },
    async listarEquipe() {
      const d = ler(); const eu = euMesmo(); if (!eu) return [];
      if (eu.papel === 'coord_geral' || eu.papel === 'coord_tecnico' || eu.papel === 'auxiliar_adm') return copia(d.equipe);
      if (R.ehBolsista(eu.papel)) {   // como o banco (43_lgpd_equipe.sql): colegas do estado só com os dados de trabalho
        const ativa = m => m.status === 'ativa';
        return copia(d.equipe.filter(x => x.id === eu.id || x.uf === eu.uf).map(m => m.id === eu.id ? m : {
          id: m.id, papel: m.papel, uf: m.uf, nome: m.nome, nome_social: m.nome_social, municipio: m.municipio, organizacao: m.organizacao,
          telefone: ativa(m) ? m.telefone : null, data_inicio: m.data_inicio, data_fim: m.data_fim, status: m.status, substitui_id: m.substitui_id, criado_em: m.criado_em,
          foto_path: ativa(m) ? m.foto_path : null, foto_url: ativa(m) ? m.foto_url : null, matricula_fic_em: ativa(m) ? m.matricula_fic_em : null,
          docs_funcern_em: ativa(m) ? m.docs_funcern_em : null, termo_assinado_em: ativa(m) ? m.termo_assinado_em : null,
          meta_diagnosticos: m.meta_diagnosticos, meta_quintais: m.meta_quintais, meta_visitas: m.meta_visitas }));
      }
      return copia(d.equipe.filter(x => x.id === eu.id));
    },
    async auditoria() {
      const eu = euMesmo(); if (!eu || eu.papel !== 'coord_geral') return [];   // como o banco (25_historico_e_cadastro.sql)
      return copia(ler().auditoria).reverse();
    },

    async criar(m) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.podeCadastrar(eu.papel, m.papel)) throw falha('Seu perfil não tem permissão para esta ação.');
      if (R.PRECISA_PROFESSOR.includes(m.papel) && !R.temProfessorHabilitado(d.equipe)) throw falha(R.MSG_SEM_PROFESSOR);   // 33
      const erros = R.validar(m, d.equipe);
      if (Object.keys(erros).length) { const e = falha(Object.values(erros)[0]); e.campos = erros; throw e; }
      const agora = new Date().toISOString();
      const novo = Object.assign({}, m, { id: uid(), cpf: R.soDigitos(m.cpf), email: m.email.trim().toLowerCase(), status: 'ativa', user_id: null,
        data_fim: null, motivo_desligamento: null, criado_por: eu.id, criado_em: agora, atualizado_em: agora });
      d.equipe.push(novo); auditar('INSERT', null, novo); gravar();
      return copia(novo);
    },

    async atualizar(id, patch) {
      const d = ler(); const eu = euMesmo();
      const i = d.equipe.findIndex(x => x.id === id); if (i < 0) throw falha('Registro não encontrado.');
      const antes = d.equipe[i];
      const soHab = Object.keys(patch).every(k => CAMPOS_HAB.includes(k));
      if (eu && eu.papel === 'auxiliar_adm') {
        if (antes.id === eu.id) throw falha('A sua própria habilitação é registrada pela coordenação geral.');
        if (!Object.keys(patch).every(k => ['docs_funcern_em', 'termo_path', 'termo_assinado_em', 'obs_habilitacao'].includes(k))) throw falha('O auxiliar administrativo só registra o cadastro no Arlo e o termo. Dados pessoais são de quem cadastrou a pessoa.');
      }
      const pode = R.podeEditarDados(eu && eu.papel, antes.papel) || (soHab && R.podeEditarHabilitacao(eu && eu.papel, antes.papel));
      if (!pode) throw falha('Seu perfil não tem permissão para esta ação.');
      if (antes.status === 'desligada' && patch.status === 'ativa') throw falha('Registro desligado não pode ser reativado. Faça um novo cadastro.');
      // 47: a data do termo só entra com o termo anexado (pela pessoa, no cadastro dela, ou por quem confere, neste mesmo envio)
      if (patch.termo_assinado_em && patch.termo_assinado_em !== antes.termo_assinado_em && !(patch.termo_path || antes.termo_path)) throw falha(R.MSG_TERMO_SEM_ARQUIVO);
      // 46: cadastro desligado não é mais alterado (só a coordenação geral corrige); "substitui" nunca a própria pessoa nem pessoa ativa de outro estado
      if (antes.status === 'desligada' && eu && eu.papel !== 'coord_geral' && Object.keys(patch).some(k => !['atualizado_em', 'user_id'].includes(k) && (patch[k] == null ? null : patch[k]) !== (antes[k] == null ? null : antes[k])))
        throw falha('Este cadastro está desligado e não é mais alterado. Se houver erro, peça à coordenação geral para corrigir.');
      if (patch.substitui_id && patch.substitui_id !== antes.substitui_id) {
        if (patch.substitui_id === id) throw falha('A pessoa não pode substituir a si mesma. Escolha quem saiu da vaga.');
        const alvo = d.equipe.find(x => x.id === patch.substitui_id);
        if (alvo && alvo.status === 'ativa' && (alvo.uf || null) !== (antes.uf || null)) throw falha((alvo.nome_social || alvo.nome) + ' está ativa em outro estado: a substituição é de quem saiu da mesma vaga.');
      }
      ['papel', 'uf', 'cpf'].forEach(k => { if (k in patch && patch[k] !== antes[k]) throw falha('Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.'); });
      const depois = Object.assign({}, antes, patch, { atualizado_em: new Date().toISOString() });
      if (depois.status === 'desligada' && (!depois.data_fim || String(depois.motivo_desligamento || '').trim().length < 5))
        throw falha('Para desligar, informe a data e o motivo.');
      if (depois.data_fim && depois.data_inicio && depois.data_fim < depois.data_inicio)   // como o banco (datas_coerentes)
        throw falha('O último dia não pode ser antes do início da bolsa (' + R.fmtData(depois.data_inicio) + ').');
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
      { // 46: CPF de pessoa ativa da equipe, testemunha igual à mulher e posição na lista de espera (só na ficha nova ou quando o campo muda)
        const cpf = R.soDigitos(dados.cpf), test = R.soDigitos(dados.testemunha_cpf || '');
        if ((!antes || antes.cpf !== cpf) && d.equipe.some(m => m.status === 'ativa' && m.cpf === cpf))
          throw falha('Este CPF é de uma pessoa ativa da equipe do projeto: quem trabalha no projeto não entra como beneficiária. Confira o CPF.');
        if (test && test === cpf && (!antes || R.soDigitos(antes.testemunha_cpf || '') !== test || antes.cpf !== cpf))
          throw falha('A testemunha da assinatura não pode ser a própria mulher (mesmo CPF). Informe o CPF de quem assistiu.');
        if (dados.posicao_espera != null && dados.posicao_espera !== '') {
          if (dados.resultado !== 'lista_espera') {
            if (antes && antes.posicao_espera === dados.posicao_espera) { if (antes.resultado === 'lista_espera') dados = Object.assign({}, dados, { posicao_espera: null }); }
            else throw falha('A posição na lista de espera só vale para quem está na lista de espera.');
          } else if ((!antes || antes.posicao_espera !== dados.posicao_espera || antes.resultado !== 'lista_espera')
              && d.fichas.some(x => x.id !== dados.id && x.uf === dados.uf && x.resultado === 'lista_espera' && +x.posicao_espera === +dados.posicao_espera))
            throw falha('Já há outra mulher na posição ' + dados.posicao_espera + ' da lista de espera de ' + dados.uf + '. Escolha outra posição.');
        }
      }
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
    async decidirFicha(id, situacao, obs, marca) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.decideCampo(eu.papel)) throw falha('Só a coordenação aprova ou devolve fichas.');
      const i = d.fichas.findIndex(x => x.id === id); if (i < 0) throw falha('Ficha não encontrada.');
      const antes = d.fichas[i];
      // 46: a tela manda a marca (atualizado_em) da ficha que leu; se a ficha mudou depois, a aprovação é recusada. Sem a marca, aprova como antes.
      if (situacao === 'aprovada' && antes.situacao !== 'aprovada' && marca && marca !== antes.atualizado_em) throw falha(MSG_ALTERADO);
      // 46: quintal em andamento (com diagnóstico): a ficha não é devolvida
      if (situacao === 'devolvida' && antes.situacao !== 'devolvida' && (d.diagnosticos || []).some(x => x.ficha_id === id))
        throw falha('Este quintal já está em andamento (tem diagnóstico registrado): a ficha não pode ser devolvida nem mudar de resultado. Para corrigir um dado da ficha, a coordenação geral altera direto. Se a mulher saiu do projeto, cancele antes as visitas agendadas e registre a saída na observação.');
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
    async salvarVisita(v, fotos) {
      if (fotos && Object.keys(fotos).length) v = Object.assign({}, v, { fotos: Object.keys(fotos).map(k => 'visita_' + v.id + '_' + k + '.jpg') });
      const d = ler(); d.visitas = d.visitas || []; const eu = euMesmo();
      const i = d.visitas.findIndex(x => x.id === v.id); const antes = i >= 0 ? d.visitas[i] : null;
      const f = d.fichas.find(x => x.id === v.ficha_id);
      if (!f) throw falha('Ficha não encontrada.');
      if (!Object.prototype.hasOwnProperty.call(MQ.ETAPAS, antes ? antes.etapa : v.etapa) || (antes && v.etapa != null && v.etapa !== antes.etapa && !Object.prototype.hasOwnProperty.call(MQ.ETAPAS, v.etapa))) throw falha('Etapa da visita inválida.');
      if (antes && antes.situacao === 'cancelada' && (v.situacao || antes.situacao) !== 'cancelada') throw falha('Visita cancelada não volta. Agende outra.');   // 03_campo.sql
      if (!eu || !(R.decideCampo(eu.papel) || (R.ehBolsista(eu.papel) && f.uf === eu.uf) || (antes && antes.executor_id === eu.id))) throw falha('Seu perfil não tem permissão para esta ação.');
      if (eu.papel === 'agente' && antes && (v.executor_id !== antes.executor_id || v.data_prevista !== antes.data_prevista || v.situacao === 'cancelada')) throw falha('O agente de campo não reagenda nem cancela visitas. Fale com a bolsista do estado.');
      if (!(f.resultado === 'selecionada' && f.situacao === 'aprovada')) throw falha('Só há visita para mulher selecionada e aprovada pela coordenação técnica.');
      const ex = d.equipe.find(x => x.id === v.executor_id);
      if (!ex || ex.status !== 'ativa' || !R.ehCampo(ex.papel)) throw falha('Quem faz a visita precisa ser bolsista ou agente de campo ativa.');
      if (ex.uf !== f.uf) throw falha('Quem faz a visita precisa ser do mesmo estado do quintal.');
      if (v.situacao !== 'cancelada' && !R.habilitado(ex)) throw falha(ex.nome + ' ainda não está habilitada (FIC, FUNCERN e termo): a visita não poderia ser paga.');
      if (!antes) {
        const mesmas = d.visitas.filter(x => x.ficha_id === v.ficha_id && x.etapa === v.etapa && x.situacao !== 'cancelada').length;
        if (mesmas >= MQ.ETAPAS[v.etapa].max) throw falha(v.etapa === 'acompanhamento' ? 'Este quintal já tem as 2 visitas de acompanhamento.' : 'Este quintal já tem essa visita agendada ou feita.');
        if (v.etapa !== 'diagnostico' && !d.visitas.some(x => x.ficha_id === v.ficha_id && x.etapa === 'diagnostico' && x.situacao === 'realizada')) throw falha('Primeiro o diagnóstico: implantação, acompanhamento e avaliação só depois dele.');
        if (v.etapa === 'avaliacao' && !d.visitas.some(x => x.ficha_id === v.ficha_id && x.etapa === 'implantacao' && x.situacao === 'realizada')) throw falha('A avaliação é feita depois da implantação do quintal.');
        // 46: cada etapa exige a anterior (só ao agendar visita NOVA: a que já existe não trava aqui)
        if (v.situacao !== 'cancelada') { const mot = MQ.etapaMotivo(v.etapa, v.ficha_id, d, { veTudo: true, visitaId: v.id, data: v.situacao === 'realizada' ? v.data_realizada : null }); if (mot) throw falha(mot); }
        if (d.visitas.filter(x => x.uf === f.uf && x.situacao !== 'cancelada').length >= MQ.DIAS_CAMPO_UF) throw falha('O estado ' + f.uf + ' já usou os ' + MQ.DIAS_CAMPO_UF + ' dias de campo previstos.');
      }
      // 46: marcar como feita exige a etapa anterior e a data em ordem; corrigir a data de visita já feita confere só a ordem das datas
      if (antes && v.situacao === 'realizada') {
        const et = antes.etapa, virou = antes.situacao !== 'realizada';
        if (virou || (v.data_realizada || null) !== (antes.data_realizada || null)) { const mot = MQ.etapaMotivo(et, antes.ficha_id, d, { veTudo: true, visitaId: antes.id, data: v.data_realizada, soData: !virou }); if (mot) throw falha(mot); }
      }
      if (v.situacao === 'realizada' && (!antes || antes.situacao !== 'realizada') && ['implantacao', 'acompanhamento'].includes(v.etapa)) {
        if (!v.data_realizada || v.data_realizada > R.hoje()) throw falha('Informe a data em que a visita foi feita (não pode ser no futuro).');
        if (String(v.relato || '').trim().length < 20) throw falha('Conte em poucas linhas o que foi feito na visita (pelo menos 20 letras).');
      }
      if (antes && (v.situacao !== antes.situacao || (v.data_realizada || null) !== (antes.data_realizada || null) || v.executor_id !== antes.executor_id)
          && (d.solic_visitas || {})[antes.id] && ['solicitada', 'avalizada', 'lancada'].includes(((d.solicitacoes || []).find(s => s.id === d.solic_visitas[antes.id]) || {}).situacao))
        throw falha('Esta visita já está numa solicitação de pagamento. Para mudar, a solicitação precisa ser devolvida pela coordenação.');
      const agora = new Date().toISOString();
      const n = Object.assign({}, antes || {}, v, { uf: f.uf, atualizado_em: agora, criado_em: antes ? antes.criado_em : agora, criado_por: antes ? antes.criado_por : eu.id });
      if (!n.situacao) n.situacao = 'prevista';
      if (i >= 0) d.visitas[i] = n; else d.visitas.push(n);
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'visitas', registro_id: n.id, acao: antes ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: antes && copia(antes), depois: copia(n) });
      gravar(); return copia(n);
    },
    async listarAvaliacoes() {
      const d = ler(); const eu = euMesmo(); if (!eu) return [];
      const l = d.avaliacoes || [];
      if (/^coord/.test(eu.papel)) return copia(l);
      if (R.ehBolsista(eu.papel)) return copia(l.filter(a => a.uf === eu.uf));
      return copia(l.filter(a => a.executor_id === eu.id));
    },
    async salvarAvaliacao(dados, fotos) {
      const d = ler(); const eu = euMesmo(); d.avaliacoes = d.avaliacoes || [];
      const v = (d.visitas || []).find(x => x.id === dados.visita_id);
      if (!v || v.etapa !== 'avaliacao' || v.ficha_id !== dados.ficha_id) throw falha('A avaliação precisa estar ligada à visita de avaliação desta mulher.');
      if (v.situacao === 'cancelada') throw falha('A visita de avaliação foi cancelada.');
      if (!eu || !((R.ehBolsista(eu.papel) && eu.uf === v.uf) || v.executor_id === eu.id)) throw falha('Seu perfil não tem permissão para esta ação.');
      if (dados.data_visita > R.hoje()) throw falha('A data da avaliação não pode ser no futuro.');
      { // 46: data a partir de 01/01/2026, nunca antes da ficha nem da implantação (só ao registrar ou quando a data muda)
        const ja = d.avaliacoes.find(a => a.id === dados.id);
        if (!ja || ja.data_visita !== dados.data_visita) {
          const fx = (d.fichas || []).find(x => x.id === dados.ficha_id) || {};
          if (dados.data_visita < '2026-01-01') throw falha('A data da visita não pode ser anterior a 01/01/2026 (o projeto ainda não tinha começado).');
          if (fx.data_ficha && dados.data_visita < fx.data_ficha) throw falha('A data da visita (' + R.fmtData(dados.data_visita) + ') não pode ser anterior à data da ficha desta mulher (' + R.fmtData(fx.data_ficha) + ').');
          const mot = MQ.etapaMotivo('avaliacao', dados.ficha_id, d, { visitaId: v.id, data: dados.data_visita }); if (mot) throw falha(mot);
        }
      }
      if (dados.latitude == null && String(dados.sem_gps_motivo || '').trim().length < 5) throw falha('Registre a localização ou explique por que não foi possível.');
      const fts = Object.keys(fotos || {}).filter(k => fotos[k]).map(k => v.uf + '/' + v.ficha_id + '/aval_' + k + '.jpg');
      const i = d.avaliacoes.findIndex(a => a.id === dados.id); const agora = new Date().toISOString();
      const n = Object.assign({}, i >= 0 ? d.avaliacoes[i] : { criado_em: agora }, dados, { uf: v.uf, executor_id: v.executor_id, atualizado_em: agora, fotos: [...new Set([...(dados.fotos || []), ...fts])] });
      if (i >= 0) d.avaliacoes[i] = n; else d.avaliacoes.push(n);
      Object.assign(v, { situacao: 'realizada', data_realizada: dados.data_visita, atualizado_em: agora });
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
      if (dados.data_visita && String(dados.data_visita).slice(0, 10) > R.hoje() && (!antes || dados.data_visita !== antes.data_visita)) throw falha('A data da visita não pode ser no futuro.');   // 42: ao criar ou ao mudar a data
      if (v.situacao === 'cancelada') throw falha('A visita de diagnóstico foi cancelada.');
      if (dados.data_visita && (!antes || dados.data_visita !== antes.data_visita)) {   // 46: a partir de 01/01/2026 e nunca antes da ficha
        const fx = (d.fichas || []).find(x => x.id === dados.ficha_id) || {};
        if (dados.data_visita < '2026-01-01') throw falha('A data da visita não pode ser anterior a 01/01/2026 (o projeto ainda não tinha começado).');
        if (fx.data_ficha && dados.data_visita < fx.data_ficha) throw falha('A data da visita (' + R.fmtData(dados.data_visita) + ') não pode ser anterior à data da ficha desta mulher (' + R.fmtData(fx.data_ficha) + ').');
      }
      const kit = (dados.dados && dados.dados.kit) || dados.kit;   // o plano fica em dados.dados (como na produção)
      if (!dados.sem_agua && Array.isArray(kit)) {   // 42: kit até R$ 5.000,00 por quintal; quantidade tem de ser maior que zero
        let tot = 0;
        for (const it of kit) { if (!it || !String(it.item || '').trim()) continue; const q = R.numBR(it.qtd);
          if (q != null && !(q > 0)) throw falha('Quantidade inválida no kit (' + String(it.item).trim().slice(0, 60) + '): informe um número maior que zero.');
          tot += (q || 0) * (+it.valor || 0); }
        if (tot > 5000) throw falha('O kit passa do valor por quintal (' + R.fmtBRL(tot) + ', o teto é R$ 5.000,00). Tire ou troque itens.');
      }
      if (dados.latitude == null && String(dados.sem_gps_motivo || '').trim().length < 15) throw falha('Sem localização: explique em pelo menos 15 letras por que não foi possível registrar no quintal.');   // 31
      const caminhos = new Set(dados.fotos || (antes && antes.fotos) || []);
      Object.entries(fotos || {}).forEach(([campo, blob]) => { if (!blob) return; const path = v.uf + '/' + v.ficha_id + '/diag_' + campo; fotosMemoria.set(path, URL.createObjectURL(blob)); caminhos.add(path); });
      const agora = new Date().toISOString();
      const n = Object.assign({}, antes || {}, dados, { uf: v.uf, executor_id: v.executor_id, fotos: [...caminhos], situacao: 'aguardando',
        aprovado_por: antes ? antes.aprovado_por : null, aprovado_em: antes ? antes.aprovado_em : null, obs_coordenacao: antes ? antes.obs_coordenacao : null,
        criado_em: antes ? antes.criado_em : agora, atualizado_em: agora, conteudo_alterado_por: eu.id, conteudo_alterado_em: agora });
      if (i >= 0) d.diagnosticos[i] = n; else d.diagnosticos.push(n);
      Object.assign(v, { situacao: 'realizada', data_realizada: n.data_visita, atualizado_em: agora });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'diagnosticos', registro_id: n.id, acao: antes ? 'UPDATE' : 'INSERT', por: eu.id, em: agora, antes: antes && copia(antes), depois: copia(n) });
      gravar(); return copia(n);
    },
    async decidirDiagnostico(id, situacao, obs, marca) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.decideCampo(eu.papel)) throw falha('Só a coordenação aprova ou devolve o plano.');
      const i = d.diagnosticos.findIndex(x => x.id === id); if (i < 0) throw falha('Diagnóstico não encontrado.');
      // 46: aprovar com a marca do que foi lido; se o plano mudou depois, recusa. Sem a marca, aprova como antes.
      if (situacao === 'aprovado' && d.diagnosticos[i].situacao !== 'aprovado' && marca && marca !== d.diagnosticos[i].atualizado_em) throw falha(MSG_ALTERADO);
      if (situacao === 'devolvido' && String(obs || '').trim().length < 5) throw falha('Para devolver, escreva o que precisa ser corrigido.');
      const agora = new Date().toISOString(); const antes = d.diagnosticos[i];
      // mesmas regras do 31_validacao_diagnostico.sql
      if (situacao === 'aprovado' && antes.situacao !== 'aprovado') {
        if (antes.conteudo_alterado_por === eu.id) throw falha('Você alterou este diagnóstico: quem aprova é a coordenação técnica. Sem técnica, devolva para quem aplicou corrigir.');
        const o = String(obs || '').trim();
        if (antes.latitude == null && !antes.sem_agua && (o.length < 10 || o === String(antes.obs_coordenacao || '').trim()))
          throw falha('Diagnóstico sem localização: para aprovar, escreva na observação como você confirmou que a visita aconteceu.');
      }
      d.diagnosticos[i] = Object.assign({}, antes, { situacao, obs_coordenacao: obs || null, atualizado_em: agora,
        aprovado_por: situacao === 'aprovado' ? eu.id : antes.aprovado_por, aprovado_em: situacao === 'aprovado' ? agora : antes.aprovado_em });
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'diagnosticos', registro_id: id, acao: 'UPDATE', por: eu.id, em: agora, antes: copia(antes), depois: copia(d.diagnosticos[i]) });
      gravar(); return copia(d.diagnosticos[i]);
    },

    /* ---------- Link de cadastro (mesmas regras do 08_convites.sql) ---------- */
    async criarConvite(papel, uf, subst) {
      const d = ler(); const eu = euMesmo();
      if (!eu || !R.podeCadastrar(eu.papel, papel)) throw falha('Seu perfil não pode cadastrar esta função.');
      if (R.PRECISA_PROFESSOR.includes(papel) && !R.temProfessorHabilitado(d.equipe)) throw falha(R.MSG_SEM_PROFESSOR);   // 33
      const ativa = d.equipe.find(m => m.status === 'ativa' && m.papel === papel && (papel === 'coord_tecnico' || (R.ehBolsista(papel) && m.uf === uf)));
      if (ativa && papel !== 'agente') throw falha(papel === 'coord_tecnico' ? 'Já há coordenação técnica ativa. Desligue antes de convidar outra.' : 'Esta vaga já está ocupada no estado.');
      if (papel === 'auxiliar_adm' && d.equipe.some(m => m.status === 'ativa' && m.papel === 'auxiliar_adm')) throw falha('Já há auxiliar administrativo ativo. Desligue antes de convidar outro.');
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      d.convites = (d.convites || []).concat([{ id: uid(), token, papel, uf: ['coord_tecnico', 'professor_fic', 'auxiliar_adm'].includes(papel) ? null : uf, substitui_id: subst || null, criado_por: eu.id,
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
      if (!dados.cadastro_arlo && !dados.data_nascimento) throw falha('Informe a data de nascimento.');
      const cpf = R.soDigitos(dados.cpf), email = String(dados.email || '').trim().toLowerCase();
      // 46: o que vem do formulário é conferido antes de gravar
      if (!/^[0-9]{11}$/.test(cpf)) throw falha('O CPF precisa ter 11 números. Confira.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw falha('E-mail inválido. Confira (sem espaços).');
      if (dados.data_nascimento) {
        if (!dataExiste(dados.data_nascimento)) throw falha('A data de nascimento não é uma data que existe. Confira dia, mês e ano.');
        if (dados.data_nascimento > R.hoje()) throw falha('A data de nascimento não pode ser no futuro.');
        if (dados.data_nascimento < '1901-01-01') throw falha('Confira a data de nascimento: o ano está antigo demais.');
      }
      if (d.equipe.some(m => m.status === 'ativa' && (m.cpf === cpf || String(m.email).toLowerCase() === email))) throw falha('Já existe pessoa ativa na equipe com este CPF ou e-mail. Fale com a coordenação.');
      if ((d.pre_cadastros || []).some(x => x.situacao === 'aguardando' && (x.cpf === cpf || String(x.email).toLowerCase() === email)))
        throw falha('Seus dados já foram enviados e estão com a coordenação para conferir. Não precisa enviar de novo.');
      d.pre_cadastros = (d.pre_cadastros || []).concat([{ id: uid(), convite_id: c.id, papel: c.papel, uf: c.uf, substitui_id: c.substitui_id,
        nome: String(dados.nome).trim(), cpf, email, telefone: dados.telefone || null, municipio: dados.municipio || null, organizacao: dados.organizacao || null,
        cadastro_arlo: !!dados.cadastro_arlo, siape: dados.siape || null, nome_social: dados.nome_social || null, data_nascimento: dados.data_nascimento || null, nis: dados.nis || null, endereco: dados.endereco || {}, socioeconomico: dados.socioeconomico || null, perfil: dados.perfil || null,
        consentimento_lgpd: true, enviado_em: new Date().toISOString(), situacao: 'aguardando' }]);
      c.usado_em = new Date().toISOString(); gravar();
    },
    async lerPrivado(id) {
      const d = ler(); const eu = euMesmo(); if (!eu || !(eu.id === id || /^coord|auxiliar_adm/.test(eu.papel))) return null;
      return copia((d.privado || {})[id] || null);
    },
    async salvarPrivado(id, dados) {
      const d = ler(); const eu = euMesmo(); const m = d.equipe.find(x => x.id === id);
      if (!eu || !m || !(eu.id === id || R.podeCadastrar(eu.papel, m.papel))) throw falha('Seu perfil não pode alterar estes dados.');
      d.privado = d.privado || {}; d.privado[id] = Object.assign({ equipe_id: id }, d.privado[id] || {}, copia(dados)); gravar();
    },
    async meusDadosBancarios() { const eu = euMesmo(); return eu ? copia((bancoMem[eu.id]) || null) : null; },
    async salvarMeusDadosBancarios(dd) { const eu = euMesmo(); if (!eu) throw falha('Entre no sistema.'); bancoMem[eu.id] = Object.assign({}, dd, { atualizado_em: new Date().toISOString() }); },
    async situacaoBancaria() {
      const eu = euMesmo(); if (!eu || !/^coord|auxiliar_adm/.test(eu.papel)) return [];
      return ler().equipe.filter(m => m.status === 'ativa' && m.papel !== 'coord_geral').map(m => ({ equipe_id: m.id, informado: !!bancoMem[m.id], atualizado_em: (bancoMem[m.id] || {}).atualizado_em || null }));
    },
    async verContaArlo(id) {
      const eu = euMesmo(); if (!eu || !['auxiliar_adm', 'coord_geral'].includes(eu.papel)) throw falha('Só o auxiliar administrativo e a coordenação geral veem a conta para o cadastro no Arlo.');
      const d = ler(); d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'equipe_bancario', registro_id: id, acao: 'VIEW', por: eu.id, em: new Date().toISOString(), antes: null, depois: { aviso: 'conta consultada para o cadastro no Arlo' } }); gravar();
      return copia(bancoMem[id] || null);
    },
    async listarAPL() {
      const d = ler(); if (!d.apl) d.apl = [{ uf: 'PI', municipio: 'Paulistana', apls: ['apicultura (exemplo)', 'caprinocultura (exemplo)'], obs: 'Exemplo: feira livre aos sábados; associação entrega ao PNAE.' }];
      return copia(d.apl);
    },
    async salvarAPL(uf, municipio, apls, obs) {
      const eu = euMesmo(); if (!eu || !/^coord/.test(eu.papel)) throw falha('Só a coordenação cadastra APL.');
      const d = ler(); d.apl = (d.apl || []).filter(x => !(x.uf === uf && x.municipio === municipio)).concat([{ uf, municipio, apls, obs }]); gravar();
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
      if (chave === 'custo_visita') {   // 46: números de verdade, dentro do que faz sentido (como no banco)
        if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw falha('Os valores do custo da visita vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.');
        const ROT = { valor_hora: 'O valor da hora', refeicao: 'O valor da refeição', km_por_litro: 'O consumo do carro (km por litro)', preco_litro: 'O preço do litro da gasolina', fator_estrada: 'O fator estrada', teto: 'O teto das ajudas de custo' };
        for (const k of Object.keys(ROT)) { if (!(k in valor)) continue; const x = valor[k];
          if (typeof x !== 'number' || !isFinite(x)) throw falha(ROT[k] + ' precisa ser um número.');
          if (['valor_hora', 'refeicao', 'teto'].includes(k) && x < 0) throw falha(ROT[k] + ' não pode ser negativo.');
          if (['km_por_litro', 'preco_litro'].includes(k) && !(x > 0)) throw falha(ROT[k] + ' precisa ser maior que zero.');
          if (k === 'fator_estrada' && x < 1) throw falha('O fator estrada precisa ser 1 ou mais (a estrada nunca é mais curta que a linha reta).'); }
        if ('horas' in valor) { const h = valor.horas;
          if (!h || typeof h !== 'object' || Array.isArray(h)) throw falha('As horas por etapa vieram num formato que o sistema não entende. Abra a aba Custos e salve os valores de novo.');
          if (Object.values(h).some(x => typeof x !== 'number' || !(x >= 0 && x <= 24))) throw falha('As horas de cada etapa precisam ser um número entre 0 e 24.'); }
      }
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
      const d = ler();
      { // 46: km de visita em pedido lançado no Arlo não muda mais, nem se apaga
        const atual = (d.custos || []).find(c => c.visita_id === visita_id);
        if (visitaPaga(d, visita_id)) {
          if (km_ida == null) { if (atual) throw falha('Esta visita já foi paga (o pedido foi lançado no Arlo): a distância conferida não pode mais ser apagada.'); }
          else if (!atual || +atual.km_ida !== +km_ida) throw falha('Esta visita já está num pedido lançado no Arlo: a distância (km) não muda mais.');
        }
      }
      d.custos = (d.custos || []).filter(c => c.visita_id !== visita_id);
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
      // 40: mulheres com ficha válida por município; menos de 3 vai sem o número (LGPD), nenhuma situação individual
      const porMun = {}; d.fichas.filter(f => f.resultado !== 'nao_atende' && String(f.municipio || '').trim()).forEach(f => {
        const nome = String(f.municipio).trim().replace(/\s+/g, ' '); const k = f.uf + '|' + nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // 46: com e sem acento é o mesmo município
        const x = (porMun[k] = porMun[k] || { uf: f.uf, municipio: nome, n: 0 }); x.n++;
        if (nome.normalize('NFD').length - nome.length > x.municipio.normalize('NFD').length - x.municipio.length) x.municipio = nome; });   // mostra a grafia com acento
      const municipios = Object.values(porMun).map(x => ({ uf: x.uf, municipio: x.municipio, n: x.n >= 3 ? x.n : null, menos_de_3: x.n < 3 }));
      return { atualizado_em: new Date().toISOString(), por_uf, fotos, municipios,
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
      if (pn.length >= 3 && new RegExp('(^|[^\\p{L}])' + pn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}])', 'iu').test(leg)) throw falha('A legenda não pode trazer o nome da mulher.');
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
      if (m && m.papel === 'professor_fic') {   // 41: turma em andamento precisa de outro professor antes
        const ts = (d.turmas || []).filter(t => t.professor_id === id && (!t.fim || t.fim >= R.hoje())).map(t => t.nome);
        if (ts.length) throw falha(`Não dá para desligar ainda: é professor(a) da turma em andamento ${ts.join(', ')}. Passe a turma para outro(a) professor(a) (aba Curso FIC > Editar) e desligue depois.`);
      }
      const r = await this.atualizar(id, { status: 'desligada', data_fim, motivo_desligamento: motivo });
      // 41: pedidos de passagem e evento ainda não autorizados são cancelados, com o motivo registrado
      const d2 = ler(); const quando = String(data_fim || R.hoje()).split('-').reverse().join('/');
      (d2.pedidos || []).filter(p => p.solicitante_id === id && ['enviado', 'devolvido', 'conferido'].includes(p.situacao)).forEach(p => {
        p.situacao = 'cancelado'; p.obs = (p.obs ? p.obs + ' · ' : '') + 'Cancelado pelo sistema: a solicitante foi desligada do projeto em ' + quando + '.'; });
      // 46: a matrícula do FIC ainda ativa passa a cancelada (a presença nos encontros anteriores continua valendo)
      (d2.matriculas || []).filter(x => x.equipe_id === id && !x.cancelada_em).forEach(x => {
        x.cancelada_em = new Date().toISOString(); x.motivo_cancelamento = 'Cancelada pelo sistema: a pessoa foi desligada do projeto em ' + quando + '.'; });
      gravar(); return r;
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
    /* 47: a própria pessoa anexa o termo preenchido e assinado (só o arquivo: a data é de quem confere) */
    async enviarMeuTermo(id, arquivo) {
      const d = ler(); const eu = euMesmo();
      if (!eu || eu.id !== id) throw falha('Cada pessoa anexa o próprio termo, no cadastro dela.');
      const i = d.equipe.findIndex(x => x.id === id); const antes = d.equipe[i];
      if (antes.termo_assinado_em) throw falha('O seu termo já foi conferido em ' + R.fmtData(antes.termo_assinado_em) + '. Para trocar o arquivo, fale com quem conferiu.');
      d.equipe[i] = Object.assign({}, antes, { termo_path: arquivo.name, atualizado_em: new Date().toISOString() });
      auditar('UPDATE', antes, d.equipe[i]); gravar();
      return arquivo.name;
    },
    async linkTermo() { return null; },   // no demo o arquivo não é guardado
    async linkTermo(path) { return null; },
    async entrar() { throw falha('No modo demonstração não há login: use o seletor de perfil.'); },
    async entrarSenha() { throw falha('Na demonstração não há login: escolha um perfil acima.'); },
    async criarSenha() { throw falha('Na demonstração não há primeiro acesso nem senha: escolha um perfil acima para conhecer o sistema.'); },   // 46: "Primeiro acesso" mostrava "Não deu certo…"   // a tela chama S.api.entrarSenha: sem isto aparecia "is not a function"
    async sair() {}
  };
})();
