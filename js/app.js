/* Mulheres & Quintais — telas do sistema (cadastro da equipe) */
(function () {
  const R = MQ.regras;
  const P = MQ.PAPEIS;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomeUF = uf => (MQ.UFS.find(x => x.uf === uf) || {}).nome || uf;

  const S = { api: null, eu: null, equipe: [], aud: [], fichas: [], visitas: [], diagnosticos: [], fila: [], painel: null, enviado: null };

  /* ---------- início ---------- */
  async function boot() {
    const producao = !!(MQ.CONFIG && MQ.CONFIG.supabaseUrl);
    // Em produção nunca cai no modo demonstração: se a biblioteca não carregou, para e avisa.
    if (producao && !window.supabase) {
      $('#app').innerHTML = barra() + '<main class="wrap"><div class="login"><h1>Sem conexão com o servidor</h1><p>O sistema não conseguiu carregar. Verifique a internet e recarregue a página. Nada foi salvo.</p></div></main>';
      return;
    }
    S.api = producao ? MQ.apiSupabase : MQ.apiDemo;
    try {
      S.eu = await S.api.iniciar();
      if (S.eu) { await carregar(); setTimeout(() => sincronizar(false), 500); }
    } catch (e) { toast(e.message); }
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !MQ.CONFIG.semServiceWorker) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  const chaveCache = () => 'mq-cache-' + (S.eu && S.eu.id);
  async function carregar() {
    try {
      S.equipe = await S.api.listarEquipe();
      // curso FIC (11_fic.sql): turmas e matrículas; o professor vê da equipe só o necessário para matricular
      S.ficSemBanco = false;
      const semFic = e => /PGRST20[25]|42P01|42883|does not exist|Could not find|schema cache/i.test(String((e.original && (e.original.code + ' ' + e.original.message)) || e.message));
      if (/^coord|professor_fic/.test(S.eu.papel) && S.api.listarTurmas) {
        try {
          S.turmas = await S.api.listarTurmas(); S.matriculas = await S.api.listarMatriculas();
          if (S.eu.papel === 'professor_fic') { const outros = await S.api.listarEquipeFic(); S.equipe = S.equipe.concat(outros.filter(o => !S.equipe.some(m => m.id === o.id))); }
        } catch (e) { if (e.semRede || !semFic(e)) throw e; S.ficSemBanco = true; S.turmas = []; S.matriculas = []; }
      } else { S.turmas = []; S.matriculas = []; }
      S.fichas = ['professor_fic', 'auxiliar_adm'].includes(S.eu.papel) ? [] : await S.api.listarFichas();
      // se o banco ainda não tiver as tabelas de campo (03_campo.sql), o resto do sistema continua funcionando
      const semTabela = e => !e.semRede && /PGRST205|42P01|does not exist|Could not find the table|schema cache/i.test(String((e.original && (e.original.code + ' ' + e.original.message)) || e.message));
      const opcional = async fn => { try { return fn ? await fn.call(S.api) : []; } catch (e) { if (semTabela(e)) { S.campoSemBanco = true; return []; } throw e; } };
      S.visitas = await opcional(S.api.listarVisitas);
      S.diagnosticos = await opcional(S.api.listarDiagnosticos);
      // avaliação final (13_avaliacao.sql); sem o script, o resto continua
      S.avalSemBanco = false; S.avaliacoes = [];
      if (S.api.listarAvaliacoes && !['professor_fic', 'auxiliar_adm'].includes(S.eu.papel)) {
        try { S.avaliacoes = await S.api.listarAvaliacoes(); } catch (e) { if (e.semRede || !semFic(e)) throw e; S.avalSemBanco = true; }
      }
      S.aud = /^coord/.test(S.eu.papel) ? await S.api.auditoria() : [];
      // solicitações de pagamento (12_pagamentos.sql); sem o script, o resto continua
      S.pagSemBanco = false;
      if (S.api.listarSolicitacoes) {
        try { const r = await S.api.listarSolicitacoes(); S.solic = r.lista; S.solicVis = r.vinculos; }
        catch (e) { if (e.semRede || !semFic(e)) throw e; S.pagSemBanco = true; S.solic = []; S.solicVis = {}; }
      }
      // valor do kit por quintal (para a projeção do investimento no diagnóstico)
      try { const k = S.api.lerParametros ? await S.api.lerParametros('kit') : null; S.kitPar = k && k.valor_quintal ? k : { valor_quintal: MQ.KIT_QUINTAL }; } catch (e) { if (e.semRede) throw e; S.kitPar = { valor_quintal: MQ.KIT_QUINTAL }; }
      S.pre = /^coord/.test(S.eu.papel) && S.api.listarPreCadastros ? await opcional(S.api.listarPreCadastros) : [];
      S.exemplo = /^coord/.test(S.eu.papel) && S.api.contarExemplo ? await opcional(async () => [await S.api.contarExemplo()]).then(r => r[0] || 0) : 0;
      S.semRede = false;
      try { localStorage.setItem(chaveCache(), JSON.stringify({ equipe: S.equipe, fichas: S.fichas, visitas: S.visitas, diagnosticos: S.diagnosticos, aud: S.aud, em: Date.now() })); } catch (e) {}
    } catch (e) {
      if (!e.semRede) throw e;
      // Sem internet: mostra a última cópia guardada no aparelho
      S.semRede = true;
      try { const c = JSON.parse(localStorage.getItem(chaveCache()) || 'null'); if (c) { S.equipe = c.equipe; S.fichas = c.fichas; S.visitas = c.visitas || []; S.diagnosticos = c.diagnosticos || []; S.aud = c.aud; S.cacheEm = c.em; } } catch (x) {}
      if (!S.equipe.length) S.equipe = [S.eu];
    }
    S.fila = await MQ.fila.listar(S.eu.id);
  }
  async function sincronizar(avisar) {
    if (!S.eu || !R.ehCampo(S.eu.papel) || !navigator.onLine) return;
    const antes = (await MQ.fila.listar(S.eu.id)).length; if (!antes) return;
    const r = await MQ.fila.sincronizar(S.api, S.eu.id);
    try { await carregar(); } catch (e) {}
    render();
    if (r.enviados && avisar !== false) toast(r.enviados + (r.enviados > 1 ? ' registros enviados.' : ' registro enviado.'));
  }
  MQ.ui = { S, esc, dobra: (k, t, c, a) => dobra(k, t, c, a), nomeUF, toast: m => toast(m), render: () => render(), abrirPainel: p => abrirPainel(p), fecharPainel: () => fecharPainel(),
    mostrarErros: (...a) => mostrarErros(...a), ocupado: (...a) => ocupado(...a), carregar: () => carregar(), sincronizar: a => sincronizar(a),
    porId: id => porId(id), avatar: (m, t) => avatar(m, t), passos: m => passos(m), dadosDL: m => dadosDL(m), botaoFoto: m => botaoFoto(m), cartaoPessoa: m => cartaoPessoa(m) };

  /* ---------- consultas ---------- */
  const ativos = () => S.equipe.filter(m => m.status === 'ativa');
  const porId = id => S.equipe.find(m => m.id === id);
  const naVaga = (papel, uf) => ativos().find(m => m.papel === papel && (uf ? m.uf === uf : true));
  const ultimaDesligada = (papel, uf) => S.equipe
    .filter(m => m.status === 'desligada' && m.papel === papel && (uf ? m.uf === uf : true))
    .filter(m => !S.equipe.some(x => x.substitui_id === m.id))
    .sort((a, b) => String(b.data_fim).localeCompare(String(a.data_fim)))[0];
  const somaUF = (uf, campo) => ativos().filter(m => m.uf === uf).reduce((s, m) => s + (+m[campo] || 0), 0);

  /* ---------- desenho ---------- */
  function render() {
    const app = $('#app');
    const modoDemo = S.api.modo === 'demo';
    const conv = /^#convite=([\w-]+)/.exec(location.hash);
    if (conv || location.hash === '#numeros') { S.painel = null; const pf = $('#painel'); if (pf) pf.remove(); }
    if (conv && MQ.convitesUI) { app.innerHTML = MQ.convitesUI.pagina(conv[1]); document.title = 'Cadastro · Mulheres & Quintais'; return; }
    if (location.hash === '#numeros' && MQ.vitrineUI) { app.innerHTML = barra(true) + MQ.vitrineUI.pagina(); document.title = 'O projeto em números · Mulheres & Quintais'; return; }
    document.title = 'Mulheres & Quintais';
    const telaEntrada = (modoDemo && S.verEntrada) || (!S.eu && !modoDemo && !S.api.temSessao);
    let h = (telaEntrada ? '' : barra()) + (modoDemo ? faixaDemo() : '');
    if (S.eu && (S.semRede || S.api.offline || !navigator.onLine))
      h += `<div class="demo" role="status"><div class="demo-in"><span><b>Sem internet.</b> O que você preencher fica guardado neste aparelho e é enviado quando a conexão voltar.${S.cacheEm ? ' Dados de ' + new Date(S.cacheEm).toLocaleString('pt-BR') + '.' : ''}</span></div></div>`;
    if (modoDemo && S.verEntrada) h += login();
    else if (!S.eu) h += modoDemo ? '<main class="wrap"><p class="carregando">Carregando…</p></main>' : (S.api.temSessao ? semCadastro() : login());
    else {
      if (MQ.pendUI) h += MQ.pendUI.faixa();   // pendências do próprio cadastro, em todas as telas
      if (/^coord/.test(S.eu.papel)) h += telaCoordenacao();
      else if (S.eu.papel === 'agente' && MQ.campoUI) h += MQ.campoUI.telaAgente();
      else if (S.eu.papel === 'professor_fic' && MQ.ficUI) h += MQ.ficUI.telaProfessor();
      else if (S.eu.papel === 'auxiliar_adm') h += telaAuxiliar();
      else h += telaBolsista();
    }
    app.innerHTML = h;
    if (S.painel) desenharPainel();
    else if (S.eu && !S.verEntrada && MQ.pendUI) MQ.pendUI.cobrar();
  }

  function barra(publica) {
    return `<header class="barra"><div class="barra-in">
      <div class="marca"><img class="emb" src="assets/isotipo.svg" alt="" width="36" height="52"><img src="assets/logo-claro.svg" alt="Mulheres &amp; Quintais" width="112" height="36"><span class="sep" aria-hidden="true"></span>
        <span class="sis"><b>Sistema do projeto</b>Quintais Produtivos para Mulheres Rurais</span></div>
      ${publica ? `<a class="btn-barra" href="#">${S.eu ? 'Voltar ao sistema' : 'Entrar'}</a>` : S.eu && !S.verEntrada ? `<div class="quem"><button class="btn-ajuda" data-acao="ajuda" title="Ajuda desta tela" aria-label="Ajuda desta tela">?</button><button class="btn-meus" data-acao="meus-dados" title="Meus dados" aria-label="Meus dados e conta bancária">${avatar(Object.assign({}, S.eu, porId(S.eu.id) || {}), 34)}</button><span><span class="nome">${esc(S.eu.nome)}</span><br><span class="papel">${esc(P[S.eu.papel].nome)}${S.eu.uf ? ' · ' + esc(S.eu.uf) : ''}</span></span>
        ${S.api.modo === 'supabase' ? '<button class="btn-barra" data-acao="sair">Sair</button>' : ''}</div>` : ''}
    </div></header>`;
  }

  function faixaDemo() {
    const p = S.api.perfisDemo();
    const b = (id, t) => `<button type="button" data-acao="perfil" data-p="${id}" aria-pressed="${S.verEntrada ? id === 'entrada' : p === id}">${t}</button>`;
    return `<div class="demo"><div class="demo-in"><span><b>Demonstração</b> com dados de exemplo, gravados só neste navegador.</span>
      <span>Ver como: <span class="seg" role="group" aria-label="Perfil">${b('coord_geral', 'Coordenação geral')}${b('coord_tecnico', 'Coordenação técnica')}${b('bolsista', 'Bolsista')}${b('agente', 'Agente de campo')}${b('professor', 'Professor FIC')}${b('auxiliar', 'Auxiliar adm.')}${b('entrada', 'Tela de entrada')}</span></span>
      <button class="link" data-acao="recomecar">Recomeçar demonstração</button></div></div>`;
  }

  function prazoChip() {
    const faltamVagas = 11 - ativos().filter(m => m.papel === 'coord_tecnico' || R.ehBolsista(m.papel)).length;
    if (faltamVagas <= 0) return '<span class="prazo ok">Equipe completa: 1 coordenação técnica e 10 bolsistas</span>';
    const d = R.diasAte(MQ.PROJETO.prazoIndicacao);
    const vagas = faltamVagas + (faltamVagas > 1 ? ' vagas abertas' : ' vaga aberta');
    if (d < 0) return `<span class="prazo crit">Prazo de indicação do MPA venceu em ${R.fmtData(MQ.PROJETO.prazoIndicacao)} · ${vagas}</span>`;
    const quando = d === 0 ? 'vence hoje' : d === 1 ? 'falta 1 dia' : 'faltam ' + d + ' dias';
    return `<span class="prazo ${d <= 3 ? 'crit' : ''}">Indicação do MPA até ${R.fmtData(MQ.PROJETO.prazoIndicacao)} · ${quando} · ${vagas}</span>`;
  }

  /* cada coordenação só vê os módulos do seu papel (o banco também limita o que cada uma lê e grava) */
  const ABAS_PAPEL = {
    coord_geral:   ['visao', 'equipe', 'selecao', 'campo', 'fic', 'pagamentos', 'custos', 'historico'],
    coord_tecnico: ['selecao', 'equipe', 'campo', 'pagamentos', 'custos']
  };
  /* seções da coordenação com o número de pendências de cada uma (abas no computador, menu ☰ no celular) */
  function abasCoord() {
    const pode = ABAS_PAPEL[S.eu.papel] || ABAS_PAPEL.coord_tecnico;
    const aguard = (S.fichas || []).filter(f => f.situacao === 'aguardando').length;
    const diagAguard = (S.diagnosticos || []).filter(x => x.situacao === 'aguardando').length;
    const aval = MQ.pagUI ? MQ.pagUI.contaAval() : 0;
    return [['visao', 'Visão geral', 0], ['equipe', 'Equipe', 0], ['selecao', 'Seleção', aguard], ['campo', 'Campo', diagAguard], ['fic', 'Curso FIC', 0],
      ['pagamentos', 'Pagamentos', aval], ['custos', 'Custos', 0], ['historico', 'Histórico', 0]].filter(([id]) => pode.includes(id));
  }
  function abaAtual() { const pode = ABAS_PAPEL[S.eu.papel] || ABAS_PAPEL.coord_tecnico; return pode.includes(S.aba) ? S.aba : pode[0]; }
  function telaCoordenacao() {
    const souGeral = S.eu.papel === 'coord_geral';
    const ct = naVaga('coord_tecnico');
    const bols = ativos().filter(m => R.ehBolsista(m.papel));
    const pagaveis = ativos().filter(m => m.papel === 'coord_tecnico' || R.ehBolsista(m.papel));
    const aptas = pagaveis.filter(m => R.situacao(m).cod === 'ok').length;
    const pode = ABAS_PAPEL[S.eu.papel] || ABAS_PAPEL.coord_tecnico;
    const aba = pode.includes(S.aba) ? S.aba : pode[0];
    const abas = abasCoord().map(([id, t, n]) => [id, t + (n ? ` <span class="conta">${n}</span>` : '')]);
    const nav = `<nav class="abas" aria-label="Seções">${abas.map(([id, t]) => `<button type="button" data-acao="aba" data-aba="${id}" ${aba === id ? 'aria-current="page"' : ''}>${t}</button>`).join('')}</nav>
      <details class="abas-m"><summary><span class="small muted">Seção</span> <b>${(abas.find(([id]) => id === aba) || abas[0])[1]}</b><span class="abas-m-seta" aria-hidden="true">▾</span></summary>
        <div class="abas-m-grade">${abas.map(([id, t]) => `<button type="button" data-acao="aba" data-aba="${id}" ${aba === id ? 'aria-current="page"' : ''}>${t}</button>`).join('')}</div></details>`;
    const intro = souGeral
      ? 'Você cadastra a coordenação técnica indicada pelo MPA, os professores do curso FIC e o auxiliar administrativo, e tem acesso a tudo: também pode cadastrar, editar e desligar bolsistas e agentes, registrar a habilitação e matricular no FIC.'
      : 'Cadastre as bolsistas indicadas pelo MPA: uma de articulação estadual e uma de apoio estadual por estado.';
    let corpo = '';
    if (aba === 'visao') corpo = MQ.painelUI ? MQ.painelUI.visaoGeral(S) : '';
    else if (aba === 'equipe') corpo = (MQ.convitesUI ? MQ.convitesUI.secaoPendentes() : '') + `
      <div class="cab"><div><span class="eyebrow">Equipe do projeto · processo ${esc(MQ.PROJETO.processo)}</span><h1>Coordenação e bolsistas</h1><p>${intro}</p></div>${prazoChip()}</div>
      <div class="resumo" aria-label="Resumo da equipe">
        <div><span class="v num">${ct ? 1 : 0}<small> de 1</small></span><span class="l">coordenação técnica cadastrada</span></div>
        <div><span class="v num">${bols.length}<small> de 10</small></span><span class="l">bolsistas cadastradas</span></div>
        <div><span class="v num">${aptas}<small> de ${pagaveis.length || 0}</small></span><span class="l">habilitadas (FIC, FUNCERN e termo)</span></div>
        <div><span class="v num">${(S.fichas || []).filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada').length}<small> de 200</small></span><span class="l">mulheres selecionadas e aprovadas</span></div>
      </div>
      <section class="secao" aria-labelledby="t-ct">
        <div class="secao-cab"><h2 id="t-ct">Coordenação técnica</h2><p>Uma para os 5 estados · indicada pelo MPA · cadastrada pela coordenação geral</p></div>
        ${ct ? cartaoPessoa(ct) : vagaCoordTecnica(souGeral)}
      </section>
      ${secaoAuxiliares(souGeral)}
      ${MQ.ficUI && !S.ficSemBanco ? MQ.ficUI.secaoEquipe() : ''}
      <section class="secao" aria-labelledby="t-b">
        <div class="secao-cab"><h2 id="t-b">Bolsistas por estado</h2><p>1 de articulação e 1 de apoio por estado · cadastradas pela coordenação técnica · meta de 40 quintais por estado</p></div>
        ${quadroTabela()}${quadroCartoes()}
      </section>
      ${secaoAgentes()}`;
    else if (aba === 'selecao') corpo = MQ.fichasUI ? MQ.fichasUI.secaoCoord() : '';
    else if (aba === 'custos') corpo = MQ.custosUI ? MQ.custosUI.aba() : '';
    else if (aba === 'fic') corpo = MQ.ficUI ? MQ.ficUI.aba() : '';
    else if (aba === 'pagamentos') corpo = MQ.pagUI ? MQ.pagUI.abaCoord() : '';
    else if (aba === 'campo') corpo = (MQ.campoUI ? MQ.campoUI.abaCoord() : '') + (MQ.vitrineUI && !S.campoSemBanco ? MQ.vitrineUI.secaoCoord() : '');
    else corpo = `<section class="secao" aria-labelledby="t-h"><h2 id="t-h">Histórico de alterações</h2>${historico()}</section>`;
    const avisoEx = S.exemplo ? `<div class="aviso erro" role="status"><b>Este sistema está com dados de exemplo (${S.exemplo} registros inventados).</b> Servem para testar; não aparecem na vitrine pública. Antes de cadastrar a equipe e as fichas de verdade, a coordenação geral roda o arquivo 06_apagar_exemplo.sql no Supabase.</div>` : '';
    return `<main class="wrap" id="principal">${avisoEx}${nav}${corpo}</main>`;
  }


  const nomeDe = m => m.nome_social ? m.nome_social : m.nome;
  /* foto pequena ao lado do nome; sem foto (ou link vencido), mostra as iniciais */
  const CORES_AV = ['#A44934', '#885B44', '#6B7A3A', '#2F6B66', '#8A5A00', '#6A4E7A', '#4F6A8A'];
  function avatar(m, tam) {
    const p = String(m.nome || '?').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(x => x && !/^(d[aeo]s?|e)$/i.test(x));
    const ini = ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    let h = 0; for (const c of String(m.id || m.nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="av" style="--av:${tam || 32}px;--avc:${CORES_AV[h % CORES_AV.length]}" aria-hidden="true">${esc(ini)}${m.foto_url ? `<img src="${esc(m.foto_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }
  const podeTrocarFoto = m => m.status === 'ativa' && (S.eu.id === m.id || (/^coord/.test(S.eu.papel) && m.papel !== 'coord_geral'));
  const botaoFoto = m => podeTrocarFoto(m) ? `<label class="btn peq foto-btn">${m.foto_url ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" data-foto-equipe="${m.id}" hidden></label>` : '';

  function cartaoPessoa(m) {
    const s = R.situacao(m);
    return `<div class="pessoa com-foto">${avatar(m, 80)}<div style="display:grid;gap:6px;min-width:0">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="nm">${esc(nomeDe(m))}</span><span class="chip ${s.cod}">${esc(s.rot)}</span></div>
        <div class="dd"><span>${esc(m.email)}</span><span class="num">${esc(m.telefone)}</span>${m.municipio ? `<span>${esc(m.municipio)}</span>` : ''}${m.organizacao ? `<span>${esc(m.organizacao)}</span>` : ''}</div></div>
      <div class="acts"><button class="btn" data-acao="ver" data-id="${m.id}">Ver detalhes</button></div></div>`;
  }

  function vagaCoordTecnica(souGeral) {
    const ant = ultimaDesligada('coord_tecnico');
    return `<div class="vazio"><div><b>Vaga aberta.</b> ${ant ? `A anterior, ${esc(ant.nome)}, foi desligada em ${R.fmtData(ant.data_fim)}.` : 'O MPA ainda não indicou a coordenação técnica.'}
      ${souGeral ? '' : '<br><span class="small">Só a coordenação geral pode fazer este cadastro.</span>'}</div>
      ${souGeral ? `<button class="btn pri" data-acao="novo" data-papel="coord_tecnico" ${ant ? `data-subst="${ant.id}"` : ''}>Cadastrar coordenação técnica</button>` : ''}</div>`;
  }

  function botaoVaga(papel, uf) {
    const m = naVaga(papel, uf);
    if (m) {
      const s = R.situacao(m);
      const nFichas = (S.fichas || []).filter(f => f.bolsista_id === m.id).length;
      const nVis = (S.visitas || []).filter(v => v.executor_id === m.id && v.situacao === 'realizada').length;
      const plano = nFichas || nVis ? `${nFichas} ficha${nFichas === 1 ? '' : 's'} lançada${nFichas === 1 ? '' : 's'} · ${nVis} visita${nVis === 1 ? '' : 's'} feita${nVis === 1 ? '' : 's'}` : 'Ainda sem fichas nem visitas';
      return `<button class="vagabtn com-foto" data-acao="ver" data-id="${m.id}">${avatar(m, 56)}<span class="vb-t"><span class="nm">${esc(nomeDe(m))}</span>
        <span><span class="chip ${s.cod}">${esc(s.rot)}</span></span><span class="sub">${esc(plano)}</span></span></button>`;
    }
    const ant = ultimaDesligada(papel, uf);
    const posso = R.podeCadastrar(S.eu.papel, papel);
    const quem = ant ? `Substituta de ${esc(ant.nome)}, desligada em ${R.fmtData(ant.data_fim)}` : 'Aguardando indicação do MPA';
    return `<button class="vagabtn livre" ${posso ? `data-acao="novo" data-papel="${papel}" data-uf="${uf}" ${ant ? `data-subst="${ant.id}"` : ''}` : 'disabled'}>
      <span class="add">${posso ? '+ Cadastrar ' + (ant ? 'substituta' : P[papel].curto.toLowerCase()) : 'Vaga aberta'}</span><span class="sub">${quem}</span></button>`;
  }

  function secaoAgentes() {
    const podeCad = R.podeCadastrar(S.eu.papel, 'agente');
    const ag = ativos().filter(m => m.papel === 'agente');
    return `<section class="secao" aria-labelledby="t-ag">
      <div class="secao-cab"><div><h2 id="t-ag">Agentes de campo</h2><p>Alunas do FIC que fazem visitas por ajuda de custo · sem limite por estado · cadastradas pela coordenação técnica · veem só os quintais atribuídos</p></div></div>
      <div class="grade-uf">${MQ.UFS.map(u => { const l = ag.filter(m => m.uf === u.uf);
        return `<div class="cartao"><div class="cab-uf"><span class="uf"><span class="sigla">${u.uf}</span></span><span class="nomeuf muted">${u.nome}</span></div>
          ${l.map(m => { const s = R.situacao(m); const nv = (S.visitas || []).filter(v => v.executor_id === m.id && v.situacao === 'realizada').length;
            return `<button class="vagabtn com-foto" data-acao="ver" data-id="${m.id}">${avatar(m, 48)}<span class="vb-t"><span class="nm">${esc(nomeDe(m))}</span><span><span class="chip ${s.cod}">${esc(s.rot)}</span></span><span class="sub">${nv ? nv + ' visita' + (nv > 1 ? 's' : '') + ' feita' + (nv > 1 ? 's' : '') : 'Nenhuma visita ainda'}</span></span></button>`; }).join('') || '<p class="small muted" style="padding:4px">Nenhuma agente.</p>'}
          ${podeCad ? `<button class="btn peq" data-acao="novo" data-papel="agente" data-uf="${u.uf}">+ Agente em ${u.uf}</button>` : ''}</div>`; }).join('')}</div>
    </section>`;
  }

  /* ---------- auxiliar administrativo ---------- */
  function secaoAuxiliares(souGeral) {
    const aux = naVaga('auxiliar_adm'); const ant = ultimaDesligada('auxiliar_adm');
    return `<section class="secao" aria-labelledby="t-aux">
      <div class="secao-cab"><h2 id="t-aux">Auxiliar administrativo</h2><p>Um para o projeto · IFRN · cadastrado pela coordenação geral · cadastra a equipe no Arlo, registra o Arlo e o termo e lança os pagamentos</p></div>
      ${aux ? cartaoPessoa(aux) : `<div class="vazio"><div><b>Vaga aberta.</b> ${ant ? `O anterior, ${esc(ant.nome)}, foi desligado em ${R.fmtData(ant.data_fim)}.` : 'Cadastre à mão ou gere um link para ele preencher.'}
        ${souGeral ? '' : '<br><span class="small">Só a coordenação geral pode fazer este cadastro.</span>'}</div>
        ${souGeral ? `<button class="btn pri" data-acao="novo" data-papel="auxiliar_adm" ${ant ? `data-subst="${ant.id}"` : ''}>Cadastrar auxiliar administrativo</button>` : ''}</div>`}
    </section>`;
  }
  function telaAuxiliar() {
    const eu = Object.assign({}, S.eu, porId(S.eu.id) || {}); const s = R.situacao(eu);
    const ordem = ['coord_tecnico', 'professor_fic', 'auxiliar_adm', 'articulacao', 'apoio', 'agente'];
    const pessoas = ativos().filter(m => m.papel !== 'coord_geral' && m.id !== eu.id)
      .sort((a, b) => ordem.indexOf(a.papel) - ordem.indexOf(b.papel) || String(a.uf || '').localeCompare(String(b.uf || '')) || nomeDe(a).localeCompare(nomeDe(b)));
    const semArlo = pessoas.filter(m => !m.docs_funcern_em), semTermo = pessoas.filter(m => m.docs_funcern_em && !m.termo_assinado_em);
    const ok = pessoas.filter(m => m.docs_funcern_em && m.termo_assinado_em);
    const linha = m => `<button class="vagabtn com-foto" data-acao="ver" data-id="${m.id}">${avatar(m, 44)}<span class="vb-t"><span class="nm">${esc(nomeDe(m))}</span>
        <span class="sub">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(m.uf) : ''}${!m.docs_funcern_em && m.cadastro_arlo ? ' · <b>diz que já tem Arlo: confira e registre</b>' : ''}</span></span></button>`;
    const grupo = (t, l, vazio) => `<section class="secao"><div class="secao-cab"><h2>${t} <span class="conta-t">${l.length}</span></h2></div>
      ${l.length ? `<div class="grade-prof">${l.map(linha).join('')}</div>` : `<p class="muted">${vazio}</p>`}</section>`;
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">${esc(P.auxiliar_adm.nome)}</span><h1>Olá, ${esc(nomeDe(eu).split(' ')[0])}</h1><p>${esc(P.auxiliar_adm.faz)}</p></div>
        <span class="chip ${s.cod}" style="font-size:13px;padding:4px 12px">${esc(s.rot)}</span></div>
      <div class="resumo">
        <div><span class="v num">${pessoas.length}</span><span class="l">pessoas na equipe</span></div>
        <div><span class="v num" ${semArlo.length ? 'style="color:var(--crit)"' : ''}>${semArlo.length}</span><span class="l">falta cadastrar no Arlo</span></div>
        <div><span class="v num">${semTermo.length}</span><span class="l">no Arlo, falta o termo</span></div>
        <div><span class="v num">${ok.length}</span><span class="l">Arlo e termo registrados</span></div></div>
      <p class="small muted">Abra a pessoa, veja os dados (e a conta, se precisar), cadastre no Arlo e registre a data em <b>Registrar passos da habilitação</b>. Cada consulta de conta bancária fica no histórico.</p>
      ${MQ.bancoUI ? MQ.bancoUI.blocoSituacao() : ''}
      ${MQ.pagUI ? MQ.pagUI.secaoAuxiliar() : ''}
      ${grupo('Falta cadastrar no Arlo', semArlo, 'Todos já estão no Arlo.')}
      ${grupo('No Arlo, falta registrar o termo', semTermo, 'Nenhum termo pendente.')}
      <details class="hist"><summary>Arlo e termo registrados (${ok.length})</summary><div style="padding:0 18px 16px">${ok.length ? `<div class="grade-prof">${ok.map(linha).join('')}</div>` : '<p class="muted">Ninguém ainda.</p>'}</div></details>
      ${s.cod === 'ok' ? '' : `<div class="bloco"><h2>Sua habilitação</h2><p class="small muted">A sua é registrada pela coordenação geral.</p>${passos(eu)}</div>`}
      ${MQ.pagUI ? MQ.pagUI.secaoMinha() : ''}
    </main>`;
  }

  function planoUF(uf) {
    // andamento da seleção (fichas) no estado: quem faz o trabalho de campo pode variar
    const fs = (S.fichas || []).filter(f => f.uf === uf);
    const aprov = fs.filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada').length;
    const aguard = fs.filter(f => f.situacao === 'aguardando').length;
    const pct = Math.min(100, Math.round(aprov / MQ.VAGAS_UF * 100));
    return `<div class="plano"><div class="ln" style="grid-template-columns:minmax(0,1fr) 52px"><span class="bar" role="img" aria-label="${aprov} de ${MQ.VAGAS_UF} selecionadas aprovadas"><i class="${aprov >= MQ.VAGAS_UF ? 'cheio' : ''}" style="width:${pct}%"></i></span><span class="num">${aprov}/${MQ.VAGAS_UF}</span></div>
      <span>${fs.length} ficha${fs.length === 1 ? '' : 's'}${aguard ? ` · <b>${aguard}</b> aguardando aprovação` : ''}</span></div>`;
  }

  function quadroTabela() {
    return `<div class="quadro-scroll"><table class="quadro"><colgroup><col class="c-uf"><col><col><col class="c-plano"></colgroup><thead><tr><th scope="col">Estado</th><th scope="col">Articulação estadual</th>
      <th scope="col">Apoio estadual</th><th scope="col">Seleção no estado</th></tr></thead><tbody>
      ${MQ.UFS.map(u => `<tr><td class="uf"><span class="sigla">${u.uf}</span><span class="nomeuf">${u.nome}</span></td>
        <td>${botaoVaga('articulacao', u.uf)}</td><td>${botaoVaga('apoio', u.uf)}</td><td>${planoUF(u.uf)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function quadroCartoes() {
    return `<div class="cartoes">${MQ.UFS.map(u => `<div class="cartao"><div class="cab-uf"><span class="uf"><span class="sigla">${u.uf}</span></span><span class="nomeuf muted">${u.nome}</span></div>
      <span class="fn">Articulação estadual</span>${botaoVaga('articulacao', u.uf)}<span class="fn">Apoio estadual</span>${botaoVaga('apoio', u.uf)}${planoUF(u.uf)}</div>`).join('')}</div>`;
  }

  function descreverAud(a) {
    const quem = a.por ? (porId(a.por) || {}).nome || 'Alguém' : 'Sistema';
    const alvo = a.depois || a.antes || {};
    const papel = P[alvo.papel] ? P[alvo.papel].nome.toLowerCase() + (alvo.uf ? ' ' + alvo.uf : '') : '';
    if (a.tabela === 'equipe_bancario' && a.acao === 'VIEW') return `<b>${esc(quem)}</b> consultou a conta bancária de <b>${esc((porId(a.registro_id) || {}).nome || 'uma pessoa')}</b> para o cadastro no Arlo.`;
    if (a.tabela === 'equipe_bancario' && a.acao === 'EXPORT') return `<b>${esc(quem)}</b> gerou a planilha bancária para a FUNCERN.`;
    if (a.tabela === 'equipe_bancario') return `<b>${esc(quem)}</b> informou ou alterou a própria conta bancária.`;
    if (a.acao === 'INSERT') return `<b>${esc(quem)}</b> cadastrou <b>${esc(alvo.nome)}</b> (${esc(papel)})${alvo.substitui_id ? ' como substituta' : ''}.`;
    const A = a.antes || {}, D = a.depois || {};
    if (A.status === 'ativa' && D.status === 'desligada') return `<b>${esc(quem)}</b> desligou <b>${esc(D.nome)}</b> (${esc(papel)}): ${esc(D.motivo_desligamento)}`;
    const partes = [];
    if (!A.matricula_fic_em && D.matricula_fic_em) partes.push('matrícula no FIC');
    if (!A.docs_funcern_em && D.docs_funcern_em) partes.push('documentos na FUNCERN');
    if (!A.termo_assinado_em && D.termo_assinado_em) partes.push('termo de compromisso');
    if (A.user_id !== D.user_id && D.user_id) return `<b>${esc(D.nome)}</b> entrou no sistema pela primeira vez.`;
    if (partes.length) return `<b>${esc(quem)}</b> registrou ${partes.join(', ')} de <b>${esc(D.nome)}</b>.`;
    return `<b>${esc(quem)}</b> atualizou o cadastro de <b>${esc(D.nome)}</b>.`;
  }
  function historico() {
    if (!S.aud.length) return '<p class="muted">Nada registrado ainda.</p>';
    const fmt = t => { const d = new Date(t); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
    return `<details class="hist"><summary>${S.aud.length} registros · o mais recente: ${fmt(S.aud[0].em)}</summary>
      <ul class="linha-tempo">${S.aud.slice(0, 60).map(a => `<li><time datetime="${esc(a.em)}">${fmt(a.em)}</time><span>${descreverAud(a)}</span></li>`).join('')}</ul></details>`;
  }

  /* "Meus dados": abre pelo botão com a foto, no alto, ao lado de Sair */
  const NOTA_DADOS = { coord_tecnico: 'a coordenação geral', professor_fic: 'a coordenação geral', auxiliar_adm: 'a coordenação geral',
    articulacao: 'a coordenação técnica', apoio: 'a coordenação técnica', agente: 'a bolsista do estado ou a coordenação técnica' };
  /* bloco recolhível que lembra se foi aberto (entre uma atualização da tela e outra) */
  S.aberto = S.aberto || {};
  function dobra(chave, titulo, conteudo, aberto) {
    const ab = chave in S.aberto ? S.aberto[chave] : !!aberto;
    return `<details class="hist dobra" data-lembrar="${esc(chave)}" ${ab ? 'open' : ''}><summary>${titulo}</summary><div class="dobra-in">${conteudo}</div></details>`;
  }
  document.addEventListener('toggle', ev => { const d = ev.target; if (d.dataset && d.dataset.lembrar) S.aberto[d.dataset.lembrar] = d.open; }, true);
  // procurar dentro de uma lista sem redesenhar a tela
  document.addEventListener('input', ev => {
    const t = ev.target; if (!t.dataset || !t.dataset.procura) return;
    const q = t.value.trim().toLowerCase(); const alvo = document.getElementById(t.dataset.procura); if (!alvo) return;
    [...alvo.children].forEach(c => { c.hidden = !!q && !c.textContent.toLowerCase().includes(q); });
  });

  function painelMeusDados() {
    const m = Object.assign({}, S.eu, porId(S.eu.id) || {});
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(nomeUF(m.uf)) : ''}</span><h2 id="painel-t">Meus dados</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><div class="bloco"><div class="cab-av">${avatar(m, 96)}<div style="display:grid;gap:6px"><h3>${esc(nomeDe(m))}</h3>${botaoFoto(m)}</div></div>${dadosDL(m)}
        ${NOTA_DADOS[m.papel] ? `<p class="small muted">Algum dado errado? Fale com ${NOTA_DADOS[m.papel]}, que corrige o cadastro.</p>` : ''}</div>
        ${m.papel !== 'coord_geral' && MQ.bancoUI ? MQ.bancoUI.secaoMinha() : ''}
        ${S.api.modo === 'supabase' ? '<div class="acoes"><button class="btn" data-acao="sair">Sair do sistema</button></div>' : ''}</div>`;
  }

  function telaBolsista() {
    const m = Object.assign({}, S.eu, porId(S.eu.id) || {});   // inclui o link da foto
    const s = R.situacao(m);
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">${esc(P[m.papel].nome)} · ${esc(nomeUF(m.uf))}</span><h1>Olá, ${esc(nomeDe(m).split(' ')[0])}</h1>
        <p>${esc(P[m.papel].faz)}</p></div><span class="chip ${s.cod}" style="font-size:13px;padding:4px 12px">${esc(s.rot)}</span></div>
      ${s.cod === 'ok' ? '' : `<div class="bloco"><h2>Habilitação para receber a bolsa</h2><p class="small muted">A bolsa de ${R.fmtBRL(P[m.papel].bolsa || 0)} por mês só é paga pela FUNCERN depois destes passos. Dúvidas sobre matrícula e AVA: professores do curso FIC. Documentos, conta ou Pix: auxiliar administrativo.</p>${passos(m)}</div>`}
      ${m.meta_diagnosticos != null ? `<div class="bloco"><h2>Sua previsão de atividades</h2><p class="small muted">Previsão do termo de compromisso. O trabalho de campo do estado pode ser dividido de outro jeito, combinado com a coordenação técnica.</p><div class="resumo r3">
        <div><span class="v num">${m.meta_diagnosticos}</span><span class="l">diagnósticos (Meta 2)</span></div>
        <div><span class="v num">${m.meta_quintais}</span><span class="l">quintais implantados (Meta 3)</span></div>
        <div><span class="v num">${m.meta_visitas}</span><span class="l">visitas de acompanhamento (Meta 4)</span></div></div></div>` : ''}
      ${MQ.fichasUI ? MQ.fichasUI.secaoBolsista() : ''}
      ${MQ.campoUI ? MQ.campoUI.secaoBolsista() : ''}
      ${MQ.pagUI ? MQ.pagUI.secaoMinha() : ''}
      <section class="secao"><div class="secao-cab"><h2>Próximos formulários</h2><span class="chip pend">Em preparação</span></div>
        <p class="small muted">Até entrarem no sistema, use os modelos em papel (versão 2).</p>
        <ul class="forms">${MQ.FORMULARIOS.filter(f => f.n === 4).map(f => `<li><span class="n">${f.n}</span><b>${esc(f.nome)}</b><span class="small muted">${esc(f.quando)}</span></li>`).join('')}</ul></section>
    </main>`;
  }

  function login() {
    const primeiro = S.modoLogin === 'primeiro';
    const aba = (id, t) => `<button type="button" data-acao="modo-login" data-m="${id}" aria-pressed="${(S.modoLogin || 'entrar') === id}">${t}</button>`;
    const ufs = MQ.UFS.map((u, i) => `<li style="--i:${i}" title="${esc(u.nome)}"><b aria-hidden="true">${u.uf}</b><span>${esc(u.nome)}</span></li>`).join('');
    // broto desenhado (decorativo): o caule cresce e as folhas abrem
    const broto = `<svg class="ent-broto" viewBox="0 -8 220 268" aria-hidden="true" focusable="false">
      <path class="caule" d="M110 250 C 108 200, 118 170, 104 128 S 96 70, 112 30" />
      <path class="folha f1" d="M106 150 C 70 150, 46 124, 44 96 C 76 98, 100 118, 106 150 Z" />
      <path class="folha f2" d="M108 108 C 140 104, 166 80, 170 52 C 136 56, 112 78, 108 108 Z" />
      <g class="flor"><ellipse cx="112" cy="14" rx="9" ry="15" transform="rotate(0 112 30)" /><ellipse cx="112" cy="14" rx="9" ry="15" transform="rotate(72 112 30)" /><ellipse cx="112" cy="14" rx="9" ry="15" transform="rotate(144 112 30)" /><ellipse cx="112" cy="14" rx="9" ry="15" transform="rotate(216 112 30)" /><ellipse cx="112" cy="14" rx="9" ry="15" transform="rotate(288 112 30)" /><circle class="miolo" cx="112" cy="30" r="7" /></g>
      <path class="chao" d="M40 252 Q 110 236 180 252" /></svg>`;
    const anim = !S.entAnimou; S.entAnimou = true;
    requestAnimationFrame(() => { ajustarBroto(); const h = document.querySelector('.ent-hero');   // os números entram depois: reajusta
      if (h && window.ResizeObserver && !h._ro) { h._ro = new ResizeObserver(() => ajustarBroto()); h._ro.observe(h); } });   // a entrada anima só na primeira vez (trocar de aba não repete)
    return `<main class="ent${anim ? ' anim' : ''}">
      <div class="ent-fundo" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
      <section class="ent-hero">
        <div class="ent-marca"><img src="assets/isotipo.svg" alt="" width="34" height="48"><span><b class="serif">Mulheres &amp; Quintais</b><small>Quintais Produtivos para Mulheres Rurais</small></span></div>
        <h1 class="ent-t serif">O quintal<br><em>nunca</em> foi pouco.</h1>
        <p class="ent-s">É ali que 200 mulheres rurais do Nordeste produzem comida, renda e autonomia. O projeto chega aonde elas estão.</p>
        <ul class="ent-ufs" aria-label="Estados do projeto">${ufs}</ul>
        ${MQ.vitrineUI ? MQ.vitrineUI.entrada() : ''}
        ${broto}
      </section>
      <section class="ent-acesso">
        <form class="login ent-card" data-form="login" novalidate>
          <div><span class="eyebrow">Sistema do projeto</span><h2 class="serif">${primeiro ? 'Primeiro acesso' : 'Que bom ver você'}</h2>
            <p class="muted">${primeiro ? 'Crie a sua senha com o e-mail que a coordenação cadastrou.' : 'Entre com o e-mail cadastrado pela coordenação.'}</p></div>
          <span class="seg ent-seg" role="group" aria-label="Tipo de acesso">${aba('entrar', 'Já tenho senha')}${aba('primeiro', 'Primeiro acesso')}</span>
          <div class="campo"><label for="l-email">E-mail</label><input id="l-email" name="email" type="email" autocomplete="username" inputmode="email" placeholder="seu@email.com" required></div>
          <div class="campo"><label for="l-senha">${primeiro ? 'Crie uma senha' : 'Senha'}</label><input id="l-senha" name="senha" type="password" autocomplete="${primeiro ? 'new-password' : 'current-password'}" minlength="8" required>
            ${primeiro ? '<span class="dica">Pelo menos 8 caracteres, com letras e números.</span>' : ''}</div>
          ${primeiro ? '<div class="campo"><label for="l-senha2">Repita a senha</label><input id="l-senha2" name="senha2" type="password" autocomplete="new-password" required></div>' : ''}
          <div class="aviso erro" data-erro hidden></div>
          <button class="btn pri ent-btn" type="submit">${primeiro ? 'Criar senha e entrar' : 'Entrar'} <span aria-hidden="true">→</span></button>
          ${primeiro ? '' : '<p class="nota">Esqueceu a senha? A coordenação geral libera um novo primeiro acesso.</p>'}
          <button type="button" class="link ent-ajuda" data-acao="ajuda" data-k="entrada">Precisa de ajuda para entrar?</button>
        </form>
        <p class="ent-rodape">IFRN Campus Apodi · MPA · FUNCERN</p>
      </section>
    </main>`;
  }
  /* a flor ocupa o espaço que sobra abaixo dos estados, sem ser cortada no pé da tela */
  function ajustarBroto() {
    const b = document.querySelector('.ent-broto'), h = document.querySelector('.ent-hero'); if (!b || !h) return;
    b.style.display = ''; if (getComputedStyle(b).display === 'none') return;   // no celular a flor fica escondida pelo CSS
    const livre = window.innerHeight - h.getBoundingClientRect().bottom - 14;
    const alt = Math.min(280, livre);
    b.style.display = alt < 100 ? 'none' : ''; b.style.height = alt + 'px'; b.style.width = 'auto';
  }
  window.addEventListener('resize', () => requestAnimationFrame(ajustarBroto));

  function semCadastro() {
    return `<main class="wrap"><div class="login"><h1>Acesso não liberado</h1><p>Este e-mail não está ativo na equipe do projeto. Se você foi desligada ou trocou de e-mail, fale com a coordenação técnica.</p>
      <button class="btn" data-acao="sair">Sair</button></div></main>`;
  }

  /* ---------- painel lateral ---------- */
  function abrirPainel(p) { S.painel = p; desenharPainel(); }
  function fecharPainel() {
    S.painel = null; const f = $('#painel'); if (f) f.remove();
    if (S.voltarFoco && document.body.contains(S.voltarFoco)) S.voltarFoco.focus();
  }
  function desenharPainel() {
    let el = $('#painel');
    if (!el) { el = document.createElement('div'); el.id = 'painel'; document.body.appendChild(el); }
    const p = S.painel;
    const corpo = p.tipo === 'ajuda' ? MQ.ajudaUI.painel(p) : p.tipo === 'meus-dados' ? painelMeusDados() : /^pend/.test(p.tipo) ? MQ.pendUI.painel(p) : /^aval-/.test(p.tipo) ? MQ.impactoUI.painel(p) : /^pag-/.test(p.tipo) ? MQ.pagUI.painel(p) : /^fic-/.test(p.tipo) ? MQ.ficUI.painel(p) : p.tipo === 'pre-ver' ? MQ.convitesUI.painel(p) : /^ficha/.test(p.tipo) ? MQ.fichasUI.painel(p) : /^(visita|diag)/.test(p.tipo) ? MQ.campoUI.painel(p) : p.tipo === 'cadastro' ? painelCadastro(p) : painelDetalhe(p);
    el.innerHTML = `<div class="fundo" data-acao="fechar"></div><aside class="painel" role="dialog" aria-modal="true" aria-labelledby="painel-t">${corpo}</aside>`;
    const foco = el.querySelector('[autofocus]') || el.querySelector('.fechar');
    if (foco) foco.focus();
  }

  function dadosDL(m) {
    const subst = m.substitui_id && porId(m.substitui_id);
    const linhas = [
      m.nome_social ? ['Nome civil', m.nome] : null, m.cadastro_arlo ? ['Cadastro no Arlo', 'Sim: dados completos e conta estão no Arlo'] : null, ['CPF', R.fmtCPF(m.cpf)], ['E-mail', m.email], ['Celular', m.telefone], ['Município', m.municipio],
      ['Organização', m.organizacao], m.siape ? ['Matrícula SIAPE', m.siape] : null, ['Início da bolsa', R.fmtData(m.data_inicio)],
      m.status === 'ativa' && S.api.modo === 'supabase' ? ['Acesso ao sistema', m.user_id ? 'Já criou a senha e entrou' : 'Ainda não fez o primeiro acesso'] : null,
      m.papel === 'agente' ? ['Pagamento', 'Ajuda de custo por visita (aba Custos)'] : null,
      subst ? ['Substitui', subst.nome] : null,
      m.status === 'desligada' ? ['Desligada em', R.fmtData(m.data_fim)] : null,
      m.status === 'desligada' ? ['Motivo', m.motivo_desligamento] : null
    ].filter(Boolean).filter(l => l[1]);
    const gestao = /^coord|auxiliar_adm/.test(S.eu.papel);
    const pv = MQ.convitesUI && (S.eu.id === m.id || gestao) ? MQ.convitesUI.privado(m.id) : null;
    if (MQ.bancoUI && gestao && m.status === 'ativa' && m.papel !== 'coord_geral') {
      const b = MQ.bancoUI.informou(m.id); if (b) linhas.push(['Conta para a FUNCERN', b.ok ? 'Informada por ela' + (b.em ? ' em ' + new Date(b.em).toLocaleDateString('pt-BR') : '') : m.cadastro_arlo ? 'No Arlo' : 'Ainda não informou']);
    }
    if (pv) linhas.push(['Nascimento', pv.data_nascimento && R.fmtData(pv.data_nascimento)], ['PIS/NIS', pv.nis], ['Endereço', MQ.convitesUI.textoEndereco(pv.endereco)],
      ['Socioeconômico', pv.socioeconomico ? 'Respondido' : null]);
    return `<dl class="dl">${linhas.filter(l => l[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  }

  function passos(m) {
    return `<ol class="passos">${R.passosHabilitacao(m).map((p, i) => `<li class="${p.feito ? 'feito' : ''}"><span class="mk" aria-hidden="true">${p.feito ? '✓' : i + 1}</span>
      <span><span>${esc(p.nome)}</span><br><span class="q">${p.feito ? 'Feito em ' + R.fmtData(p.quando) + (p.extra ? ' · ' + esc(String(p.extra).split('/').pop()) : '') : 'Pendente'}</span></span></li>`).join('')}</ol>`;
  }

  function painelDetalhe(p) {
    const m = porId(p.id); if (!m) return '';
    const s = R.situacao(m);
    const editaDados = m.status === 'ativa' && R.podeEditarDados(S.eu.papel, m.papel);
    const editaHab = m.status === 'ativa' && R.podeEditarHabilitacao(S.eu.papel, m.papel) && !(S.eu.papel === 'auxiliar_adm' && m.id === S.eu.id);
    const plano = R.ehBolsista(m.papel) ? `<div class="bloco"><h3>Previsão de atividades (plano individual)</h3>
      ${m.meta_diagnosticos != null ? `<dl class="dl"><dt>Diagnósticos</dt><dd class="num">${m.meta_diagnosticos ?? '—'}</dd><dt>Quintais</dt><dd class="num">${m.meta_quintais ?? '—'}</dd><dt>Visitas</dt><dd class="num">${m.meta_visitas ?? '—'}</dd></dl>` : '<p class="muted small">Não preenchido.</p>'}</div>` : '';
    const hoje = R.hoje() > m.data_inicio ? R.hoje() : m.data_inicio;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(nomeUF(m.uf)) : ''}</span>
        <div class="cab-av">${avatar(m, 96)}<div style="display:grid;gap:4px"><h2 id="painel-t">${esc(nomeDe(m))}</h2><span><span class="chip ${s.cod}">${esc(s.rot)}</span></span></div></div>
        ${botaoFoto(m) ? `<span>${botaoFoto(m)}</span>` : ''}</div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        <div class="bloco"><h3>Dados</h3>${dadosDL(m)}
          ${editaDados ? `<div class="acoes"><button class="btn" data-acao="editar" data-id="${m.id}">Editar dados</button><button class="btn perigo" data-acao="desligar-abrir">Desligar</button></div>` : ''}
          </div>

        <form class="bloco" data-form="desligar" data-id="${m.id}" hidden novalidate>
          <h3>Desligar ${esc(nomeDe(m).split(' ')[0])}</h3>
          ${(() => { const vp = (S.visitas || []).filter(v => v.executor_id === m.id && v.situacao === 'prevista').length;
              const dv = (S.diagnosticos || []).filter(x => x.executor_id === m.id && x.situacao === 'devolvido').length;
              return vp || dv ? `<div class="aviso erro"><b>Ainda não dá para desligar.</b> ${vp ? vp + ' visita' + (vp > 1 ? 's' : '') + ' agendada' + (vp > 1 ? 's' : '') + ' com ela' : ''}${vp && dv ? ' e ' : ''}${dv ? dv + ' diagnóstico' + (dv > 1 ? 's' : '') + ' devolvido' + (dv > 1 ? 's' : '') + ' para ela corrigir' : ''}. Na aba Campo, passe as visitas para outra pessoa ou cancele, e resolva os diagnósticos.</div>` : ''; })()}
          <p class="small muted">O cadastro não é apagado. A vaga fica livre para a substituta e o histórico guarda quem desligou, quando e por quê. Não dá para desfazer: se ela voltar, faça um novo cadastro.</p>
          <div class="campos"><div class="campo"><label for="d-data">Último dia na bolsa</label><input id="d-data" name="data_fim" type="date" min="${esc(m.data_inicio)}" value="${hoje}" required></div>
            <div class="campo"><label for="d-motivo">Motivo</label><select id="d-motivo" name="motivo">${MQ.MOTIVOS.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
            <div class="campo inteiro"><label for="d-det">Explique em uma frase</label><textarea id="d-det" name="detalhe" placeholder="Ex.: pediu para sair por motivo de saúde, comunicou em 20/11."></textarea></div></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn perigo cheio" type="submit">Confirmar desligamento</button><button class="btn" type="button" data-acao="desligar-cancelar">Cancelar</button></div>
        </form>

        ${avisoAcesso(m, editaDados || /^coord|auxiliar_adm/.test(S.eu.papel))}
        ${plano}
        ${m.id === S.eu.id && m.papel !== 'coord_geral' && MQ.bancoUI ? MQ.bancoUI.secaoMinha() : ''}
        ${m.id !== S.eu.id && MQ.bancoUI ? MQ.bancoUI.blocoContaArlo(m) : ''}

        <div class="bloco"><h3>Habilitação</h3>${m.papel === 'coord_geral' ? '<p class="small muted">Não se aplica.</p>' : passos(m)}
          ${editaHab && m.papel !== 'coord_geral' ? formHabilitacao(m) : ''}</div>
      </div>`;
  }

  /* a pessoa só entra no sistema quando alguém avisa: o sistema não manda e-mail */
  function avisoAcesso(m, pode) {
    if (!pode || m.status !== 'ativa' || m.user_id || m.id === S.eu.id) return '';
    const url = location.origin + location.pathname;
    const msg = `Olá, ${nomeDe(m).split(' ')[0]}! Seu cadastro foi feito no sistema do projeto Mulheres & Quintais (${P[m.papel].nome}${m.uf ? ' · ' + m.uf : ''}).\n\nPara entrar:\n1) Abra ${url}\n2) Toque em "Primeiro acesso"\n3) Use este e-mail: ${m.email}\n4) Crie uma senha com pelo menos 8 caracteres, misturando letras e números.\n\nDepois é só entrar com esse e-mail e essa senha.`;
    const fone = String(m.telefone || '').replace(/\D/g, '');
    const wa = 'https://wa.me/' + (fone.length >= 10 ? '55' + fone : '') + '?text=' + encodeURIComponent(msg);
    return `<div class="bloco aviso-acesso"><h3>Avisar o acesso</h3>
      <p class="small muted">Ela ainda não entrou. O sistema não manda e-mail: envie esta mensagem por WhatsApp ou e-mail. Ela entra com o e-mail cadastrado e cria a própria senha em "Primeiro acesso".</p>
      <textarea readonly rows="7" aria-label="Mensagem de acesso" onclick="this.select()">${esc(msg)}</textarea>
      <div class="acoes"><a class="btn pri" target="_blank" rel="noopener" href="${esc(wa)}">Mandar por WhatsApp</a>
        <a class="btn" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Acesso ao sistema Mulheres & Quintais')}&body=${encodeURIComponent(msg)}">Mandar por e-mail</a>
        <button class="btn" type="button" data-acao="copiar-texto">Copiar</button></div></div>`;
  }

  function formHabilitacao(m) {
    const fic = R.fazFIC(m.papel);
    const lista = fic ? [m.matricula_fic_em, m.docs_funcern_em, m.termo_assinado_em] : [m.docs_funcern_em, m.termo_assinado_em];
    const feitos = lista.filter(Boolean).length, total = lista.length;
    const mt = (S.matriculas || []).find(x => x.equipe_id === m.id); const turma = mt && (S.turmas || []).find(t => t.id === mt.turma_id);
    return `<details class="hab${feitos === total ? ' completa' : ''}" ${feitos === total ? '' : 'open'}><summary class="hab-sum">
        <span class="hab-ic" aria-hidden="true">${feitos === total ? '✓' : feitos + '/' + total}</span>
        <span class="hab-t"><b>${feitos === total ? 'Datas da habilitação' : 'Registrar passos da habilitação'}</b><span class="small muted">${feitos === total ? 'Os ' + total + ' passos estão registrados · abra para ver ou corrigir uma data' : (fic ? 'Cadastro no Arlo e termo assinado (a matrícula no FIC é dos professores do curso)' : 'Cadastro no Arlo e termo assinado')}</span></span>
        <span class="hab-seta" aria-hidden="true"></span></summary>
      <form class="f" data-form="hab" data-id="${m.id}" style="margin-top:12px" novalidate>
      <div class="campos">
        ${!fic ? '' : `<div class="campo inteiro"><span class="dica" style="font-size:14px">${turma ? `Matrícula no FIC registrada pelo professor na turma <b>${esc(turma.nome)}</b> (nº ${esc(mt.numero)}, ${R.fmtData(mt.matriculado_em)}).`
          : m.matricula_fic_em ? `Matrícula no FIC registrada em ${R.fmtData(m.matricula_fic_em)} (nº ${esc(m.matricula_fic_numero || '')}), ainda sem turma no sistema.` : '<b>Matrícula no FIC: aguardando.</b>'} A matrícula é registrada só pelos professores do curso, na aba Curso FIC.</span></div>`}
        <div class="campo"><label for="h-fun">Cadastrado no Arlo (FUNCERN) em</label><input id="h-fun" name="docs_funcern_em" type="date" value="${esc(m.docs_funcern_em || '')}"></div>
        <div class="campo"><label for="h-ter">Termo de compromisso assinado em</label><input id="h-ter" name="termo_assinado_em" type="date" value="${esc(m.termo_assinado_em || '')}"></div>
        <div class="campo inteiro"><label for="h-arq">Termo assinado (PDF ou foto)</label><input id="h-arq" name="termo" type="file" accept="application/pdf,image/*">
          <span class="dica">${m.termo_path ? 'Já enviado: ' + esc(String(m.termo_path).split('/').pop()) + '. Enviar outro substitui o link.' : 'Com assinaturas da bolsista, da coordenação técnica e da coordenação geral.'}</span></div>
        <div class="campo inteiro"><label for="h-obs">Observações</label><textarea id="h-obs" name="obs_habilitacao" placeholder="Ex.: falta comprovante de conta; Pix informado em 02/10.">${esc(m.obs_habilitacao || '')}</textarea></div>
      </div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar habilitação</button></div></form></details>`;
  }

  function painelCadastro(p) {
    const pre = p.pre && MQ.convitesUI ? MQ.convitesUI.dadosPre(p.pre) : null;
    const hojeVig = (h => h < MQ.PROJETO.vigencia.inicio ? MQ.PROJETO.vigencia.inicio : h > MQ.PROJETO.vigencia.fim ? MQ.PROJETO.vigencia.fim : h)(R.hoje());
    const m = p.id ? porId(p.id) : Object.assign({ papel: p.papel, uf: p.uf || null, substitui_id: p.subst || null, data_inicio: hojeVig }, pre || {});
    const priv = p.id ? (MQ.convitesUI ? MQ.convitesUI.privado(p.id) : null) : (pre ? pre._priv : {});
    const edit = !!p.id;
    const bols = R.ehBolsista(m.papel);
    const subst = m.substitui_id && porId(m.substitui_id);
    const v = k => esc(m[k] == null ? '' : m[k]);
    const munis = bols ? (MQ.MUNICIPIOS[m.uf] || []) : [];
    const titulo = edit ? 'Editar cadastro' : subst ? 'Cadastrar substituta' : 'Novo cadastro';
    const cabP = `<div class="painel-cab"><div class="t"><span class="eyebrow">${titulo}</span>
        <h2 id="painel-t">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(nomeUF(m.uf)) : ''}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
    // cadastro novo: primeiro escolhe como (link para a pessoa preencher ou à mão)
    if (!edit && !pre && MQ.convitesUI && p.modo !== 'manual') {
      if (p.modo === 'link') return cabP + `<div class="painel-corpo">${`<div class="modo-cad" role="group" aria-label="Como cadastrar"><span class="small muted">Como cadastrar:</span><span class="seg"><button type="button" data-acao="cad-modo" data-m="link" aria-pressed="true">Gerar link</button><button type="button" data-acao="cad-modo" data-m="manual" aria-pressed="false">À mão</button></span></div>`}${MQ.convitesUI.blocoLink(p)}</div>`;
      return cabP + `<div class="painel-corpo"><p class="muted">Como você quer fazer este cadastro?</p>
        <div class="cad-modos">
          <button class="cad-modo" data-acao="cad-modo" data-m="link" autofocus><b>Gerar link de cadastro</b>
            <span>A pessoa preenche os próprios dados pelo celular e aceita o termo de uso dos dados. Você confere e aprova. Menos digitação e menos erro.</span><em>Recomendado</em></button>
          <button class="cad-modo" data-acao="cad-modo" data-m="manual"><b>Cadastrar à mão agora</b>
            <span>Você digita os dados. Use quando já tem tudo em mãos ou a pessoa não tem internet.</span></button>
        </div></div>`;
    }
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${titulo}</span>
        <h2 id="painel-t">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(nomeUF(m.uf)) : ''}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="cadastro" novalidate>
        ${!edit && !pre && MQ.convitesUI ? `<div class="modo-cad" role="group" aria-label="Como cadastrar"><span class="small muted">Como cadastrar:</span><span class="seg"><button type="button" data-acao="cad-modo" data-m="link" aria-pressed="false">Gerar link</button><button type="button" data-acao="cad-modo" data-m="manual" aria-pressed="true">À mão</button></span></div>` : ''}
        <div class="fixo">${m.papel === 'agente' ? '<span class="small muted">Pagamento</span><b>Ajuda de custo por visita</b>' : `<span class="small muted">Função</span><b>${esc(P[m.papel].nome)}</b>`}
          <span class="small">${P[m.papel].faz ? esc(P[m.papel].faz) : 'Planeja, coordena e acompanha a execução técnica nos 5 estados.'}</span>
          ${['professor_fic', 'auxiliar_adm'].includes(m.papel) ? '<span class="small">Habilitação: cadastro no Arlo (FUNCERN) e termo de compromisso (não se matricula no FIC).</span>' : ''}
          ${m.papel === 'agente' ? '<span class="small">Precisa estar matriculada no FIC e cadastrada na FUNCERN antes da primeira visita paga. Vê só os quintais atribuídos a ela.</span>' : ''}</div>
        ${pre ? `<div class="aviso">Dados enviados por ela pelo link em ${R.fmtData(String(pre._pre.enviado_em).slice(0, 10))}. Confira, complete o que falta e salve: ao salvar, o cadastro é aprovado.</div>` : ''}
        ${subst ? `<div class="aviso">Substitui <b>${esc(subst.nome)}</b>, desligada em ${R.fmtData(subst.data_fim)}. O histórico liga as duas.</div>` : ''}
        <fieldset><legend>Dados pessoais</legend><div class="campos">
          <div class="campo inteiro"><label for="c-nome">Nome completo</label><input id="c-nome" name="nome" autocomplete="name" value="${v('nome')}" ${edit ? '' : 'autofocus'} required></div>
          <div class="campo"><label for="c-cpf">CPF</label><input id="c-cpf" name="cpf" inputmode="numeric" value="${esc(R.fmtCPF(m.cpf || ''))}" ${edit ? 'readonly' : ''} placeholder="000.000.000-00" required>
            ${edit ? '<span class="dica">CPF não muda. Se estiver errado, desligue e cadastre de novo.</span>' : ''}</div>
          <div class="campo"><label for="c-fone">Celular com WhatsApp</label><input id="c-fone" name="telefone" inputmode="tel" autocomplete="tel" value="${v('telefone')}" placeholder="(89) 90000-0000" required></div>
          <div class="campo inteiro"><label for="c-email">E-mail</label><input id="c-email" name="email" type="email" autocomplete="email" value="${v('email')}" required>
            <span class="dica">É o login no sistema. Nenhum e-mail é enviado: depois de salvar, mande para ela o aviso de acesso (aparece na ficha dela).</span></div>
          <div class="campo"><label for="c-mun">Município onde mora</label><input id="c-mun" name="municipio" value="${v('municipio')}" ${bols ? 'list="lista-mun"' : 'placeholder="Município/UF"'}>
            ${bols ? `<datalist id="lista-mun">${munis.map(x => `<option value="${esc(x)}">`).join('')}</datalist><span class="dica">A lista traz os municípios do projeto técnico em ${esc(m.uf)}.</span>` : ''}</div>
          <div class="campo"><label for="c-siape">Matrícula SIAPE <span class="muted">(só se for servidor(a) público(a) federal)</span></label><input id="c-siape" name="siape" inputmode="numeric" value="${v('siape')}" placeholder="Deixe vazio se não for"></div>
          <div class="campo"><label for="c-org">Organização ou movimento</label><input id="c-org" name="organizacao" value="${v('organizacao')}" placeholder="${bols ? 'Ex.: MPA, associação, sindicato' : ['professor_fic', 'auxiliar_adm'].includes(m.papel) ? 'Ex.: IFRN Campus Apodi' : 'Ex.: MPA'}"></div>
        </div></fieldset>
        ${MQ.convitesUI ? (priv === undefined ? '<p class="small muted">Carregando os dados pessoais…</p>' : MQ.convitesUI.camposPessoais(Object.assign({ nome_social: m.nome_social, cadastro_arlo: p.id ? !!m.cadastro_arlo : m.cadastro_arlo }, priv || {}), false, m.papel)) : ''}
        <fieldset><legend>Bolsa</legend><div class="campos">
          <div class="campo"><label for="c-ini">Início ${m.papel === 'agente' ? 'no projeto' : 'da bolsa'}</label><input id="c-ini" name="data_inicio" type="date" value="${v('data_inicio')}" min="${MQ.PROJETO.vigencia.inicio}" max="${MQ.PROJETO.vigencia.fim}" required>
            ${edit ? '' : '<span class="dica">Sugerimos hoje. Mude se a pessoa começou em outro dia.</span>'}</div>
        </div></fieldset>
        ${bols ? `<fieldset><legend>Previsão de atividades (opcional)</legend>
          <p class="small muted" style="margin-top:-6px">Item 6 do termo de compromisso. É só previsão: diagnóstico, implantação e visitas podem ser feitos por esta bolsista, pela outra do estado ou por outra pessoa, paga por ajuda de custo. O sistema registra quem fez cada atividade.</p>
          <div class="campos" style="grid-template-columns:repeat(3,minmax(0,1fr))">
            <div class="campo"><label for="c-md">Diagnósticos</label><input id="c-md" name="meta_diagnosticos" type="number" min="0" inputmode="numeric" value="${v('meta_diagnosticos')}"></div>
            <div class="campo"><label for="c-mq">Quintais</label><input id="c-mq" name="meta_quintais" type="number" min="0" inputmode="numeric" value="${v('meta_quintais')}"></div>
            <div class="campo"><label for="c-mv">Visitas</label><input id="c-mv" name="meta_visitas" type="number" min="0" inputmode="numeric" value="${v('meta_visitas')}"></div>
          </div></fieldset>` : ''}
        <fieldset><legend>Proteção de dados</legend>
          <label class="check" id="w-lgpd"><input type="checkbox" id="c-lgpd" name="consentimento_lgpd" ${m.consentimento_lgpd ? 'checked' : ''}>
            <span>A pessoa foi informada e concorda que estes dados sejam usados só para a gestão do projeto e o pagamento da bolsa (Lei nº 13.709/2018).</span></label>
          <p class="nota">Conta bancária e chave Pix não entram aqui: vão direto para a FUNCERN, que faz o pagamento.</p></fieldset>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">${edit ? 'Salvar alterações' : 'Cadastrar'}</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
      </form></div>`;
  }

  /* ---------- ações ---------- */
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 3600);
  }
  function mostrarErros(form, erros, geral) {
    form.querySelectorAll('.tem-erro').forEach(x => x.classList.remove('tem-erro'));
    form.querySelectorAll('.campo .erro, .criterio .erro').forEach(x => x.remove());
    const box = form.querySelector('[data-erro]');
    Object.entries(erros || {}).forEach(([k, msg]) => {
      const inp = form.querySelector(`[name="${k}"]`);
      if (!inp) return;
      if (inp.type === 'checkbox') { inp.closest('.check').classList.add('tem-erro'); return; }
      if (inp.type === 'radio' && inp.closest('.criterio')) { const w = inp.closest('.criterio'); w.classList.add('tem-erro'); const s = document.createElement('span'); s.className = 'erro'; s.textContent = msg; w.appendChild(s); return; }
      const c = inp.closest('.campo'); if (!c) return; c.classList.add('tem-erro');
      const s = document.createElement('span'); s.className = 'erro'; s.textContent = msg; c.appendChild(s);
    });
    const lista = Object.values(erros || {});
    const texto = geral || (lista.length ? (lista.length > 1 ? 'Corrija os ' + lista.length + ' campos marcados.' : lista[0]) : '');
    if (box) { box.textContent = texto; box.hidden = !texto; } else if (texto) toast(texto);
    const primeiro = form.querySelector('.tem-erro input, .tem-erro select, .tem-erro textarea, .check.tem-erro input');
    if (primeiro) primeiro.focus();
  }
  async function ocupado(form, fn) {
    const b = form.querySelector('[type=submit]'); const txt = b.textContent;
    b.disabled = true; b.textContent = 'Salvando…';
    try { await fn(); } finally { if (document.body.contains(b)) { b.disabled = false; b.textContent = txt; } }
  }
  async function recarregar() { S.eu = await S.api.eu(true); await carregar(); render(); }

  document.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-acao]'); if (!el) return;
    const a = el.dataset.acao;
    try {
      if (a === 'perfil' && MQ.bancoUI) MQ.bancoUI.limpar();
      if (a === 'perfil' && el.dataset.p === 'entrada') { S.verEntrada = true; S.painel = null; render(); window.scrollTo(0, 0); }
      else if (a === 'perfil') { S.verEntrada = false; S.aba = null; S.painel = null; const f = $('#painel'); if (f) f.remove(); S.eu = await S.api.trocarPerfil(el.dataset.p); await carregar(); render(); }
      else if (a === 'recomecar') { S.painel = null; const f = $('#painel'); if (f) f.remove(); S.eu = await S.api.recomecar(); await carregar(); render(); toast('Demonstração recomeçada com os dados de exemplo.'); }
      else if (a === 'cad-modo') { abrirPainel(Object.assign({}, S.painel, { modo: el.dataset.m || undefined })); }
      else if (a === 'ajuda') { if (S.menuAberto) { S.menuAberto = false; render(); } S.voltarFoco = el; abrirPainel({ tipo: 'ajuda', k: el.dataset.k }); }
      else if (a === 'meus-dados') { if (S.menuAberto) { S.menuAberto = false; render(); } S.voltarFoco = el; abrirPainel({ tipo: 'meus-dados' }); }
      else if (a === 'copiar-texto') { const t = el.closest('.bloco').querySelector('textarea'); try { await navigator.clipboard.writeText(t.value); toast('Mensagem copiada.'); } catch (e) { t.select(); toast('Selecione e copie a mensagem.'); } }
      else if (a === 'modo-login') { S.modoLogin = el.dataset.m; render(); const f = $('#l-email'); if (f) f.focus(); }
      else if (a === 'sair') { S.menuAberto = false; if (MQ.bancoUI) MQ.bancoUI.limpar(); try { Object.keys(sessionStorage).filter(k => /^mq-pend-visto-/.test(k)).forEach(k => sessionStorage.removeItem(k)); } catch (e) {} S.pendVisto = false; await S.api.sair(); S.eu = null; S.equipe = []; render(); }
      else if (a === 'fechar') fecharPainel();
      else if (a === 'aba') { S.aba = el.dataset.aba; S.menuAberto = false; render(); window.scrollTo(0, 0); }
      else if (/^ficha/.test(a) && MQ.fichasUI) { S.voltarFoco = el; await MQ.fichasUI.clique(a, el); }
      else if (/^apl-/.test(a) && MQ.sugestaoUI) await MQ.sugestaoUI.clique(a, el);
      else if (/^banco-/.test(a) && MQ.bancoUI) await MQ.bancoUI.clique(a, el);
      else if (/^pend-/.test(a) && MQ.pendUI) { S.voltarFoco = el; await MQ.pendUI.clique(a, el); }
      else if (/^conv-/.test(a) && MQ.convitesUI) await MQ.convitesUI.clique(a, el);
      else if (/^custo-/.test(a) && MQ.custosUI) await MQ.custosUI.clique(a, el);
      else if (/^fic-/.test(a) && MQ.ficUI) { S.voltarFoco = el; await MQ.ficUI.clique(a, el); }
      else if (/^pag-/.test(a) && MQ.pagUI) { S.voltarFoco = el; await MQ.pagUI.clique(a, el); }
      else if (/^(aval|imp)-/.test(a) && MQ.impactoUI) { S.voltarFoco = el; await MQ.impactoUI.clique(a, el); }
      else if (/^vit-/.test(a) && MQ.vitrineUI) await MQ.vitrineUI.clique(a, el);
      else if (/^campo-/.test(a) && MQ.campoUI) { S.voltarFoco = el; await MQ.campoUI.clique(a, el); }
      else if (a === 'ver') { S.voltarFoco = el; abrirPainel({ tipo: 'detalhe', id: el.dataset.id }); }
      else if (a === 'novo') { S.voltarFoco = el; abrirPainel({ tipo: 'cadastro', papel: el.dataset.papel, uf: el.dataset.uf, subst: el.dataset.subst }); }
      else if (a === 'editar') abrirPainel({ tipo: 'cadastro', id: el.dataset.id });
      else if (a === 'desligar-abrir') { const f = $('form[data-form=desligar]'); f.hidden = false; f.scrollIntoView({ block: 'nearest' }); f.querySelector('select').focus(); }
      else if (a === 'desligar-cancelar') { $('form[data-form=desligar]').hidden = true; }
    } catch (e) { toast(e.message); }
  });

  document.addEventListener('keydown', ev => { if (ev.key !== 'Escape') return; if (S.painel) fecharPainel(); else if (S.menuAberto) { S.menuAberto = false; render(); } });
  // foto da equipe: recorta quadrada, 320 px, JPEG (tira dados do celular, como a localização)
  function fotoQuadrada(arq, lado = 320) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(arq); const img = new Image();
      img.onload = () => {
        const m = Math.min(img.width, img.height); const c = document.createElement('canvas'); c.width = c.height = lado;
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado); URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error('Não foi possível preparar a foto.')), 'image/jpeg', .85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Arquivo de imagem inválido.')); };
      img.src = url;
    });
  }
  document.addEventListener('change', async ev => {
    const inp = ev.target.closest('input[data-foto-equipe]'); if (!inp || !inp.files[0]) return;
    const lab = inp.closest('label'); const txt = lab ? lab.firstChild.textContent : '';
    try {
      if (lab) lab.firstChild.textContent = 'Enviando…';
      await S.api.enviarFotoEquipe(inp.dataset.fotoEquipe, await fotoQuadrada(inp.files[0]));
      S.equipe = await S.api.listarEquipe(); if (S.eu.id === inp.dataset.fotoEquipe) S.eu = Object.assign({}, S.eu, porId(S.eu.id));
      render(); toast('Foto salva.');
    } catch (e) { if (lab) lab.firstChild.textContent = txt; toast(e.message); }
  });

  window.addEventListener('hashchange', () => { if (/^#(numeros|convite=|)$|^#convite=/.test(location.hash) || location.hash === '') { render(); window.scrollTo(0, 0); } });
  window.addEventListener('online', () => { if (S.eu) sincronizar(); });
  window.addEventListener('offline', () => { if (S.eu) render(); });

  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.name === 'cpf' && !t.readOnly) t.value = R.fmtCPF(t.value);
    if (t.name === 'telefone') t.value = R.fmtFone(t.value);
    const c = t.closest && t.closest('.campo.tem-erro, .check.tem-erro, .criterio.tem-erro');   // some o aviso do campo assim que a pessoa corrige
    if (c) { c.classList.remove('tem-erro'); const e = c.querySelector('.erro'); if (e) e.remove(); }
  });

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('form[data-form]'); if (!form) return;
    ev.preventDefault();
    const tipo = form.dataset.form;
    const fd = new FormData(form);
    try {
      if (tipo === 'login') {
        const email = String(fd.get('email') || '').trim();
        const senha = String(fd.get('senha') || '');
        const erros = {};
        if (!R.emailValido(email)) erros.email = 'Digite um e-mail válido.';
        if (senha.length < 8) erros.senha = 'A senha tem pelo menos 8 caracteres.';
        else if (S.modoLogin === 'primeiro' && !(/[a-zA-Z]/.test(senha) && /\d/.test(senha))) erros.senha = 'Misture letras e números.';
        if (S.modoLogin === 'primeiro' && senha !== String(fd.get('senha2') || '')) erros.senha2 = 'As duas senhas não são iguais.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        await ocupado(form, async () => {
          S.eu = S.modoLogin === 'primeiro' ? await S.api.criarSenha(email, senha) : await S.api.entrarSenha(email, senha);
          if (S.eu) { await carregar(); setTimeout(() => sincronizar(false), 500); }
          render();
        });
      }
      if (/^ficha/.test(tipo) && MQ.fichasUI) await MQ.fichasUI.enviar(tipo, form, fd);
      if (/^pend-/.test(tipo) && MQ.pendUI) await MQ.pendUI.enviar(tipo, form, fd);
      if (/^(visita|diag)/.test(tipo) && MQ.campoUI) await MQ.campoUI.enviar(tipo, form, fd);
      if (/^vit-/.test(tipo) && MQ.vitrineUI) await MQ.vitrineUI.enviar(tipo, form, fd);
      if (/^custo-/.test(tipo) && MQ.custosUI) await MQ.custosUI.enviar(tipo, form, fd);
      if (/^fic-/.test(tipo) && MQ.ficUI) await MQ.ficUI.enviar(tipo, form, fd);
      if (/^pag-/.test(tipo) && MQ.pagUI) await MQ.pagUI.enviar(tipo, form, fd);
      if (tipo === 'aval' && MQ.impactoUI) await MQ.impactoUI.enviar(tipo, form, fd);
      if (/^conv-/.test(tipo) && MQ.convitesUI) await MQ.convitesUI.enviar(tipo, form, fd);
      if (tipo === 'banco' && MQ.bancoUI) await MQ.bancoUI.enviar(tipo, form, fd);
      if (tipo === 'apl' && MQ.sugestaoUI) await MQ.sugestaoUI.enviar(tipo, form, fd);
      if (tipo === 'cadastro') {
        const p = S.painel;
        const base = p.id ? porId(p.id) : { papel: p.papel, uf: p.uf || null, substitui_id: p.subst || null };
        const num = k => (fd.get(k) === '' || fd.get(k) == null ? null : parseInt(fd.get(k), 10));
        const m = Object.assign({}, base, {
          nome: String(fd.get('nome') || '').trim().replace(/\s+/g, ' '),
          cpf: R.soDigitos(fd.get('cpf') || base.cpf), email: String(fd.get('email') || '').trim(),
          telefone: String(fd.get('telefone') || ''), municipio: String(fd.get('municipio') || '').trim(),
          organizacao: String(fd.get('organizacao') || '').trim(), data_inicio: String(fd.get('data_inicio') || ''), siape: R.soDigitos(fd.get('siape')) || null,
          consentimento_lgpd: !!fd.get('consentimento_lgpd')
        });
        const temPriv = MQ.convitesUI && form.querySelector('[name=data_nascimento]');
        const priv = temPriv ? MQ.convitesUI.lerPessoais(fd) : null;
        if (priv) { m.nome_social = priv.nome_social; m.cadastro_arlo = !!priv.cadastro_arlo; }
        if (R.ehBolsista(m.papel)) Object.assign(m, { meta_diagnosticos: num('meta_diagnosticos'), meta_quintais: num('meta_quintais'), meta_visitas: num('meta_visitas') });
        const erros = R.validar(m, S.equipe);
        if (p.id) delete erros.papel;
        if (priv) Object.assign(erros, MQ.convitesUI.validarPessoais(priv, false));
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        await ocupado(form, async () => {
          if (p.id) {
            const patch = {}; ['nome', 'nome_social', 'cadastro_arlo', 'siape', 'email', 'telefone', 'municipio', 'organizacao', 'data_inicio', 'consentimento_lgpd', 'meta_diagnosticos', 'meta_quintais', 'meta_visitas']
              .forEach(k => { if (k in m && (m[k] || null) !== (base[k] || null)) patch[k] = m[k]; });
            if (priv) { await S.api.salvarPrivado(p.id, priv); MQ.convitesUI.esquecerPrivado(p.id); }
            if (!Object.keys(patch).length) { await recarregar(); abrirPainel({ tipo: 'detalhe', id: p.id }); toast('Dados salvos.'); return; }
            await S.api.atualizar(p.id, patch); await recarregar(); abrirPainel({ tipo: 'detalhe', id: p.id }); toast('Cadastro atualizado.');
          } else {
            const novo = await S.api.criar(m);
            const temAlgo = priv && (priv.data_nascimento || priv.nis || Object.keys(priv.endereco).length || priv.socioeconomico);
            if (temAlgo) await S.api.salvarPrivado(novo.id, priv);
            if (p.pre) await S.api.decidirPreCadastro(p.pre, 'aprovado', null, novo.id);
            await recarregar(); abrirPainel({ tipo: 'detalhe', id: novo.id });
            toast(nomeDe(m).split(' ')[0] + (['professor_fic', 'auxiliar_adm'].includes(m.papel) ? ' cadastrado(a). Próximo passo: cadastro no Arlo e termo.' : ' cadastrada. Próximo passo: matrícula no curso FIC.'));
          }
        });
      }
      if (tipo === 'hab') {
        const id = form.dataset.id; const m = porId(id);
        const patch = {};
        ['matricula_fic_em', 'matricula_fic_numero', 'docs_funcern_em', 'termo_assinado_em', 'obs_habilitacao'].forEach(k => {
          if (!form.querySelector('[name="' + k + '"]')) return;   // campo fora da tela (professor sem FIC, ou matrícula feita na turma)
          const val = String(fd.get(k) || '').trim() || null; if (val !== (m[k] || null)) patch[k] = val;
        });
        const erros = {};
        ['matricula_fic_em', 'docs_funcern_em', 'termo_assinado_em'].forEach(k => { if (patch[k] && patch[k] > R.hoje()) erros[k] = 'Data no futuro. Registre só o que já aconteceu.'; });
        if (patch.matricula_fic_em && !(patch.matricula_fic_numero || m.matricula_fic_numero)) erros.matricula_fic_numero = 'Informe o número da matrícula.';
        const arq = fd.get('termo');
        if (arq && arq.size && arq.size > 10 * 1024 * 1024) erros.termo = 'Arquivo acima de 10 MB. Envie um PDF menor ou uma foto.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        await ocupado(form, async () => {
          if (arq && arq.size) patch.termo_path = await S.api.enviarTermo(id, arq);
          if (!Object.keys(patch).length) { toast('Nada mudou.'); return; }
          await S.api.atualizar(id, patch); await recarregar(); abrirPainel({ tipo: 'detalhe', id });
          const n = porId(id); toast(R.situacao(n).cod === 'ok' ? n.nome.split(' ')[0] + ' está habilitada: todos os passos concluídos.' : 'Habilitação atualizada.');
        });
      }
      if (tipo === 'desligar') {
        const id = form.dataset.id; const m = porId(id);
        const data = String(fd.get('data_fim') || ''); const det = String(fd.get('detalhe') || '').trim();
        const erros = {};
        if (!data) erros.data_fim = 'Informe o último dia.';
        else if (data < m.data_inicio) erros.data_fim = 'Antes do início da bolsa (' + R.fmtData(m.data_inicio) + ').';
        if (fd.get('motivo') === 'Outro motivo' && det.length < 5) erros.detalhe = 'Explique o motivo.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        await ocupado(form, async () => {
          await S.api.desligar(id, data, fd.get('motivo') + (det ? ': ' + det : ''));
          await recarregar(); fecharPainel(); toast(m.nome.split(' ')[0] + ' desligada. A vaga está aberta para a substituta.');
        });
      }
    } catch (e) {
      mostrarErros(form, e.campos || {}, e.message);
    }
  });

  window.addEventListener('DOMContentLoaded', boot);
})();
