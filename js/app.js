/* Mulheres & Quintais — telas do sistema (cadastro da equipe) */
(function () {
  const R = MQ.regras;
  const P = MQ.PAPEIS;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomeUF = uf => (MQ.UFS.find(x => x.uf === uf) || {}).nome || uf;

  const S = { api: null, eu: null, equipe: [], aud: [], fichas: [], visitas: [], diagnosticos: [], fila: [], painel: null, enviado: null };
  // ao recarregar a página, volta para a mesma seção e a mesma altura da tela (só neste navegador)
  try { S.aba = localStorage.getItem('mq-aba') || null; const y = +sessionStorage.getItem('mq-rolagem'); if (y) S.rolarPara = y; } catch (e) {}
  const lembrarAba = () => { try { if (S.aba) localStorage.setItem('mq-aba', S.aba); else localStorage.removeItem('mq-aba'); } catch (e) {} };
  window.addEventListener('pagehide', () => { try { sessionStorage.setItem('mq-rolagem', String(Math.round(window.scrollY))); } catch (e) {} });

  /* ---------- início ---------- */
  /* abertura: a arte de carregamento (mulher regando) fica pelo menos 1,8 s, só na 1ª abertura da sessão.
     Não segura quem pediu menos animação, nem os testes automáticos (medem o tempo real de abertura). */
  const ABERTURA_MIN = 1800;
  async function esperarAbertura() {
    try { if (sessionStorage.getItem('mq-abertura-vista')) return; sessionStorage.setItem('mq-abertura-vista', '1'); } catch (e) { return; }
    if (navigator.webdriver || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const passou = typeof performance !== 'undefined' ? performance.now() : ABERTURA_MIN;
    if (passou < ABERTURA_MIN) await new Promise(r => setTimeout(r, ABERTURA_MIN - passou));
  }
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
      // reabriu o sistema depois de 15 minutos sem uso: sai antes de mostrar qualquer dado
      // sem internet não sai (não daria para entrar de novo): abrir o sistema conta como uso
      if (S.eu && MQ.sessao && MQ.sessao.venceu(MQ.sessao.ultimo()) && !MQ.sessao.semRede() && await temConexao()) await sairDoSistema(AVISO_INATIVO);
      if (S.eu && !S.verEntrada) { if (MQ.sessao) MQ.sessao.tocar(true); registrarAbriu(); await carregar(); setTimeout(() => sincronizar(false), 500); }
    } catch (e) { toast(e.message); }
    if (MQ.sessao) MQ.sessao.iniciar({ ativo: () => !!S.eu && !S.verEntrada, temConexao, aoVencer: () => sairDoSistema(AVISO_INATIVO) });
    await esperarAbertura();
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !MQ.CONFIG.semServiceWorker) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  const modoDemoAtivo = () => !!(S.api && S.api.modo === 'demo');
  /* o servidor responde? (sinal fraco engana o navigator.onLine). Qualquer resposta = tem conexão; 5 s no máximo */
  async function temConexao() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    if (modoDemoAtivo() || !MQ.CONFIG || !MQ.CONFIG.supabaseUrl) return true;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 5000) : null;
    try { await fetch(MQ.CONFIG.supabaseUrl + '/auth/v1/health', { cache: 'no-store', headers: { apikey: MQ.CONFIG.supabaseAnonKey || '' }, signal: ctl ? ctl.signal : undefined }); return true; }
    catch (e) { return false; }
    finally { if (t) clearTimeout(t); }
  }
  /* Últimos acessos (30_ultimos_acessos.sql): o aparelho em poucas palavras, sem guardar o "user agent" inteiro */
  function aparelho() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android' : 'Tablet Android')
      : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Outro';
    const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox|FxiOS/.test(ua) ? 'Firefox'
      : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    let app = false; try { app = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; } catch (e) {}
    return so + ' · ' + nav + (app ? ' · app instalado' : '');
  }
  /* registra sem nunca travar nem quebrar o sistema (sem o script 30, sem internet: só não registra). Espera no máximo 3 s */
  function registrarAcesso(tipo) {
    if (!S.api || !S.api.registrarAcesso) return Promise.resolve();
    let t; const limite = new Promise(ok => { t = setTimeout(ok, 3000); if (t && t.unref) t.unref(); });
    return Promise.race([Promise.resolve().then(() => S.api.registrarAcesso(tipo, aparelho())).catch(() => {}), limite]).finally(() => clearTimeout(t));
  }
  const CHAVE_ABRIU = 'mq-acesso-registrado';
  const marcarAbriu = () => { try { sessionStorage.setItem(CHAVE_ABRIU, '1'); } catch (e) {} };
  /* abriu o sistema já logado: uma vez por aba (recarregar a página não conta de novo) */
  function registrarAbriu() {
    let ja = false; try { ja = sessionStorage.getItem(CHAVE_ABRIU) === '1'; } catch (e) {}
    if (ja) return; marcarAbriu(); registrarAcesso('abriu');
  }
  const AVISO_INATIVO = 'Você saiu do sistema depois de 15 minutos sem uso. Entre de novo. O que estava guardado no celular não se perdeu: é enviado quando você entrar.';
  /* sai do sistema (botão Sair ou 15 minutos sem uso): fecha o painel, apaga do aparelho a cópia dos dados e volta para a entrada */
  async function sairDoSistema(aviso) {
    if (aviso) guardarRascunhoPainel();   // saiu sozinho: guarda o formulário pela metade
    if (S.eu && !S.verEntrada) await registrarAcesso(aviso ? 'saida_inatividade' : 'saida');   // antes de encerrar a sessão no servidor
    try { sessionStorage.removeItem(CHAVE_ABRIU); } catch (e) {}
    S.painel = null; const pf = $('#painel'); if (pf) pf.remove();
    S.menuAberto = false; S.aba = null; lembrarAba(); if (MQ.bancoUI) MQ.bancoUI.limpar();
    try { Object.keys(sessionStorage).filter(k => /^mq-pend-visto-/.test(k)).forEach(k => sessionStorage.removeItem(k)); } catch (e) {}
    S.pendVisto = false; S.avisoLogin = aviso || null;
    if (MQ.sessao) MQ.sessao.esquecer();
    // LGPD: a cópia dos dados (fichas, equipe, histórico) não fica no aparelho depois de sair.
    // Para entrar de novo é preciso internet, e aí tudo é recarregado. A fila do que não foi enviado fica.
    try { localStorage.removeItem(chaveCache()); } catch (e) {}
    if (modoDemoAtivo()) { S.verEntrada = true; render(); return; }   // demonstração: volta para a tela de entrada
    try { await S.api.sair(); } catch (e) { /* sem internet: a sessão já foi apagada do aparelho */ }
    S.eu = null; S.equipe = []; S.fichas = []; S.visitas = []; S.diagnosticos = []; S.aud = []; S.documentos = []; S.acessos = []; S.execPlanilhas = []; S.encontros = []; S.agua = [];
    S.solic = []; S.pedidos = []; S.pre = []; S.pedidosAcesso = []; S.entregas = []; S.matriculas = []; S.turmas = []; S.avaliacoes = []; S.codigos = {}; S.confirmaAcesso = null; S.painel = null; S.solicVis = {}; S.ciencias = []; S.testes = []; S.saldoPed = null; S.quemConfere = null;   // nada da pessoa anterior fica na memória
    if (MQ.convitesUI && MQ.convitesUI.limparCache) MQ.convitesUI.limparCache();
    render();
  }
  const chaveCache = () => 'mq-cache-' + (S.eu && S.eu.id);
  async function carregar() {
    try {
      /* Tudo o que não depende de outra coisa é buscado AO MESMO TEMPO (antes eram ~18 esperas em fila:
         6 a 12 segundos em internet fraca). Cada parte continua com o seu tratamento: "sem o script no
         banco" vira lista vazia; sem internet, o erro sobe e o sistema mostra a cópia do aparelho. */
      const papel = S.eu.papel, coord = /^coord/.test(papel);
      const semFic = e => /PGRST20[25]|42P01|42883|does not exist|Could not find|schema cache/i.test(String((e.original && (e.original.code + ' ' + e.original.message)) || e.message));
      const semTabela = e => !e.semRede && /PGRST205|42P01|does not exist|Could not find the table|schema cache/i.test(String((e.original && (e.original.code + ' ' + e.original.message)) || e.message));
      const opcional = async fn => { try { return fn ? await fn.call(S.api) : []; } catch (e) { if (semTabela(e)) { S.campoSemBanco = true; return []; } throw e; } };
      // parte que pode não estar instalada no banco: devolve [ok, valor]; sem internet ou erro de verdade, sobe
      const talvez = async (fn, seErro) => { try { return [true, await fn()]; } catch (e) { if (e.semRede || !seErro(e)) throw e; return [false, null]; } };
      const qualquer = e => !e.semRede;   // para as partes em que qualquer erro que não seja de rede só desliga a parte
      S.kitPar = { valor_quintal: MQ.KIT_QUINTAL };   // R$ 5.000 por quintal, fixado no plano de trabalho
      const campoPapel = !['professor_fic', 'auxiliar_adm'].includes(papel);
      const [equipe, fic, fichas, visitas, diagnosticos, aval, aud, pag, docs, quem, entregas, testes, perfis, pre, exemplo, pedAcesso, acessos, lancs, encs, agua] = await Promise.all([
        S.api.listarEquipe(),
        // curso FIC (11_fic.sql): turmas e matrículas
        (coord || papel === 'professor_fic') && S.api.listarTurmas
          ? talvez(() => Promise.all([S.api.listarTurmas(), S.api.listarMatriculas(), papel === 'professor_fic' ? S.api.listarEquipeFic() : []]), semFic) : [true, [[], [], []]],
        campoPapel ? S.api.listarFichas() : [],
        opcional(S.api.listarVisitas),        // sem o 03_campo.sql, o resto do sistema continua
        opcional(S.api.listarDiagnosticos),
        S.api.listarAvaliacoes && campoPapel ? talvez(() => S.api.listarAvaliacoes(), semFic) : [true, []],   // 13_avaliacao.sql
        papel === 'coord_geral' ? S.api.auditoria() : [],   // o histórico é só da coordenação geral
        S.api.listarSolicitacoes ? talvez(() => S.api.listarSolicitacoes(), semFic) : [false, null],          // 12_pagamentos.sql
        papel === 'coord_geral' && S.api.listarDocumentos ? talvez(() => S.api.listarDocumentos(), semFic) : [true, []],   // 24_documentos.sql
        S.api.quemConferePedidos && ['coord_geral', 'coord_tecnico', 'articulacao', 'auxiliar_adm'].includes(papel)
          ? talvez(() => S.api.quemConferePedidos(), qualquer) : [true, null],                                // 26_conferencia_auxiliar.sql
        S.api.listarEntregas && papel !== 'auxiliar_adm' ? talvez(() => Promise.all([S.api.listarEntregas(), S.api.listarCiencias()]), semFic) : [true, [[], []]],   // 19
        S.api.listarTestes ? talvez(() => S.api.listarTestes(), qualquer) : [true, []],                     // 21_roteiro_testes.sql
        papel === 'coord_geral' && S.api.listarPerfisEquipe ? talvez(() => S.api.listarPerfisEquipe(), qualquer) : [true, []],
        coord && S.api.listarPreCadastros ? opcional(S.api.listarPreCadastros) : [],
        coord && S.api.contarExemplo ? opcional(async () => [await S.api.contarExemplo()]).then(r => r[0] || 0) : 0,
        papel === 'coord_geral' && S.api.listarPedidosAcesso ? talvez(() => S.api.listarPedidosAcesso(), semFic) : [true, []],   // 28
        papel === 'coord_geral' && S.api.listarAcessos ? talvez(() => S.api.listarAcessos(), qualquer) : [true, []],   // 30
        papel === 'coord_geral' && S.api.listarPlanilhasExec ? talvez(() => S.api.listarPlanilhasExec(), semFic) : [true, []],   // 37_execucao_planilhas.sql
        S.api.listarEncontrosFic && papel !== 'auxiliar_adm' ? talvez(() => S.api.listarEncontrosFic(), semFic) : [true, []],   // 38_fic_encontros.sql
        coord && S.api.listarAgua ? talvez(() => S.api.listarAgua(), semFic) : [true, []]   // 39_agua.sql
      ]);
      S.equipe = equipe;
      S.ficSemBanco = !fic[0]; [S.turmas, S.matriculas] = fic[0] ? fic[1] : [[], []];
      if (fic[0] && papel === 'professor_fic') { const ids = new Set(S.equipe.map(m => m.id)); S.equipe = S.equipe.concat(fic[1][2].filter(o => !ids.has(o.id))); }
      S.fichas = fichas; S.visitas = visitas; S.diagnosticos = diagnosticos;
      S.avalSemBanco = !aval[0]; S.avaliacoes = aval[0] ? aval[1] : [];
      S.aud = aud;
      S.pagSemBanco = !!S.api.listarSolicitacoes && !pag[0]; S.solic = pag[0] ? pag[1].lista : []; S.solicVis = pag[0] ? pag[1].vinculos : {};
      S.docSemBanco = !docs[0]; S.documentos = docs[0] ? docs[1] : [];
      S.execSemBanco = !lancs[0]; S.execPlanilhas = lancs[0] ? lancs[1] : [];
      S.encSemBanco = !encs[0]; S.encontros = encs[0] ? encs[1] : [];
      S.aguaSemBanco = !agua[0]; S.agua = agua[0] ? agua[1] : [];
      S.quemConfere = quem[0] ? quem[1] : null;
      S.entregasSemBanco = !entregas[0]; [S.entregas, S.ciencias] = entregas[0] ? entregas[1] : [[], []];
      S.testesSemBanco = !testes[0]; S.testes = testes[0] ? testes[1] : [];
      S.perfisSemBanco = !perfis[0]; S.perfisEquipe = perfis[0] ? perfis[1] : [];
      S.pre = pre; S.exemplo = exemplo; S.pedidosAcesso = pedAcesso[0] ? pedAcesso[1] : [];
      S.acessosSemBanco = !acessos[0]; S.acessos = acessos[0] ? acessos[1] : [];
      // segunda leva: os pedidos de viagem dependem de saber quem confere (22 e 26)
      S.pedSemBanco = false; S.pedidos = [];
      if (S.api.listarPedidos && MQ.viagUI && (MQ.viagUI.podeVer(papel) || MQ.viagUI.souConferente())) {
        const r = await talvez(() => S.api.listarPedidos(), semFic); S.pedSemBanco = !r[0]; S.pedidos = r[0] ? r[1] : [];
        if (S.api.saldoPedidos && !S.pedSemBanco) { const sd = await talvez(() => S.api.saldoPedidos(), qualquer); S.saldoPed = sd[0] ? sd[1] : null; }   // 35
      }
      // cálculo de custos carregado em segundo plano: a aba Custos abre pronta, sem "Carregando…" e sem a página pular
      if (coord && MQ.custosUI && !MQ.custosUI.pronto()) MQ.custosUI.garantir().then(() => { if (S.aba === 'custos') render(); }).catch(() => {});
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
  /* ---------- dados sempre em dia: o que outra pessoa fez aparece sem recarregar a página ----------
     Recarrega em segundo plano ao trocar de aba do sistema, ao voltar para a janela ou ao celular,
     quando a internet volta e a cada 2 minutos com a tela aberta. No máximo uma vez a cada 20 s.
     Se a pessoa está digitando na página, os números novos aparecem na próxima troca de tela
     (o que ela digitou não se perde). */
  const ATUALIZA_MIN = 20000, ATUALIZA_CICLO = 120000;
  let atualizadoEm = Date.now(), atualizando = false, digitouEm = 0;
  document.addEventListener('input', ev => { if (ev.target && ev.target.closest && ev.target.closest('#app')) digitouEm = Date.now(); }, true);
  const digitando = () => { const a = document.activeElement;
    return (a && a.closest && a.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || Date.now() - digitouEm < 60000; };
  async function atualizarEmSegundoPlano(forcar) {
    if (!S.eu || S.verEntrada || atualizando || S.semRede || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!forcar && Date.now() - atualizadoEm < ATUALIZA_MIN) return;
    atualizando = true;
    try {
      const antes = JSON.stringify([S.equipe, S.fichas, S.visitas, S.diagnosticos, S.solic, S.pedidos, S.pre, S.pedidosAcesso, S.entregas, S.matriculas, S.turmas, S.documentos, S.avaliacoes, S.execPlanilhas, S.encontros, S.agua]);
      // dados pessoais e conta do próprio cadastro também podem ter sido resolvidos por outra pessoa (pendências)
      if (!digitando() && !S.painel) { if (MQ.convitesUI) MQ.convitesUI.esquecerPrivado(S.eu.id); if (MQ.bancoUI) MQ.bancoUI.limpar(); }
      if (S.api.reler) await S.api.reler();   // demonstração: outra aba pode ter mudado os dados guardados
      await carregar(); atualizadoEm = Date.now();
      const depois = JSON.stringify([S.equipe, S.fichas, S.visitas, S.diagnosticos, S.solic, S.pedidos, S.pre, S.pedidosAcesso, S.entregas, S.matriculas, S.turmas, S.documentos, S.avaliacoes, S.execPlanilhas, S.encontros, S.agua]);
      if (antes !== depois && !digitando()) { const y = window.scrollY; render(); window.scrollTo(0, y); }
    } catch (e) { /* sem internet ou servidor fora: fica com o que já está na tela */ }
    finally { atualizando = false; }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') atualizarEmSegundoPlano(); });
    window.addEventListener('focus', () => atualizarEmSegundoPlano());
    window.addEventListener('online', () => atualizarEmSegundoPlano(true));
    const ciclo = setInterval(() => atualizarEmSegundoPlano(), ATUALIZA_CICLO); if (ciclo && ciclo.unref) ciclo.unref();
  }
  /* sem coordenação técnica ativa (vaga aberta, desligada): a coordenação geral assume a vez dela
     nos contadores e listas, para nenhum pedido ficar parado sem aviso. Só vale para quem vê a equipe toda. */
  const semTecnica = () => !!(S.eu && S.eu.papel === 'coord_geral') && !(S.equipe || []).some(m => m.papel === 'coord_tecnico' && m.status === 'ativa');
  MQ.ui = { vagaAberta, S, esc, semTecnica, dobra: (k, t, c, a) => dobra(k, t, c, a), nomeUF, toast: m => toast(m), render: () => render(), abrirPainel: p => abrirPainel(p), fecharPainel: () => fecharPainel(),
    mostrarErros: (...a) => mostrarErros(...a), ocupado: (...a) => ocupado(...a), carregar: () => carregar(), sincronizar: a => sincronizar(a),
    porId: id => porId(id), avatar: (m, t) => avatar(m, t), passos: m => passos(m), dadosDL: m => dadosDL(m), botaoFoto: m => botaoFoto(m), cartaoPessoa: m => cartaoPessoa(m),
    atualizar: f => atualizarEmSegundoPlano(f), aparelho: () => aparelho(), ipCurto: ip => ipCurto(ip), sair: a => sairDoSistema(a) };

  /* ---------- consultas ---------- */
  const ativos = () => S.equipe.filter(m => m.status === 'ativa');
  const porId = id => S.equipe.find(m => m.id === id);
  const naVaga = (papel, uf) => ativos().find(m => m.papel === papel && (uf ? m.uf === uf : true));
  const ultimaDesligada = (papel, uf) => S.equipe
    .filter(m => m.status === 'desligada' && m.papel === papel && (uf ? m.uf === uf : true))
    .filter(m => !S.equipe.some(x => x.substitui_id === m.id))
    .sort((a, b) => String(b.data_fim).localeCompare(String(a.data_fim)))[0];

  /* ---------- desenho ---------- */
  function render() {
    const app = $('#app');
    const modoDemo = S.api.modo === 'demo';
    const conv = /^#convite=([\w-]+)/.exec(location.hash);
    if (conv || location.hash === '#numeros') { S.painel = null; const pf = $('#painel'); if (pf) pf.remove(); }
    if (conv && MQ.convitesUI) { app.innerHTML = barra(true, true) + MQ.convitesUI.pagina(conv[1]) + rodape(); document.title = 'Cadastro · Mulheres & Quintais'; return; }
    if (location.hash === '#numeros' && MQ.vitrineUI) { app.innerHTML = barra(true) + MQ.vitrineUI.pagina() + rodape(); document.title = 'O projeto em números · Mulheres & Quintais'; return; }
    document.title = 'Mulheres & Quintais';
    const telaEntrada = (modoDemo && S.verEntrada) || (!S.eu && !modoDemo && !S.api.temSessao);
    let h = (telaEntrada ? '' : barra()) + (modoDemo ? faixaDemo() : '');
    if (S.eu && (S.semRede || S.api.offline || !navigator.onLine))
      h += `<div class="demo" role="status"><div class="demo-in"><span><b>Sem internet.</b> O que você preencher fica guardado neste aparelho e é enviado quando a conexão voltar.${S.cacheEm ? ' Dados de ' + new Date(S.cacheEm).toLocaleString('pt-BR') + '.' : ''}</span></div></div>`;
    if (modoDemo && S.verEntrada) h += login();
    else if (!S.eu) h += modoDemo ? '<main class="wrap"><p class="carregando">' + MQ.ampulheta(true) + '</p></main>' : (S.api.temSessao ? semCadastro() : login());
    else {
      if (MQ.pendUI) h += MQ.pendUI.faixa();   // pendências do próprio cadastro, em todas as telas
      if (MQ.lembreteUI && (!/^coord/.test(S.eu.papel) || (abaAtual() === abasDoPapel()[0] && abaAtual() !== 'visao'))) h += MQ.lembreteUI.quadro();   // na visão geral, os prazos já estão no painel   // prazo, data com roda de conversa ou número do projeto
      if (/^coord/.test(S.eu.papel)) h += (S.eu.papel === 'coord_tecnico' && MQ.encUI && MQ.encUI.paraConfirmar().length ? `<div class="wrap">${MQ.encUI.blocoConfirmar()}</div>` : '') + telaCoordenacao();
      else if (S.eu.papel === 'agente' && MQ.campoUI) h += MQ.campoUI.telaAgente();
      else if (S.eu.papel === 'professor_fic' && MQ.ficUI) h += MQ.ficUI.telaProfessor();
      else if (S.eu.papel === 'auxiliar_adm') h += telaAuxiliar();
      else h += telaBolsista();
    }
    app.innerHTML = h + rodape() + (S.eu && MQ.roteiroUI ? MQ.roteiroUI.barra() : '');
    app.querySelectorAll('.atalhos [data-alvo]').forEach(b => { b.hidden = !document.querySelector(b.dataset.alvo); });
    if (S.eu && MQ.roteiroUI) MQ.roteiroUI.verificarLink();
    if (S.painel) desenharPainel();
    if (S.rolarPara && S.eu && !S.verEntrada) { const y = S.rolarPara; S.rolarPara = 0; requestAnimationFrame(() => window.scrollTo(0, y)); }
    else if (S.eu && !S.verEntrada && MQ.pendUI) MQ.pendUI.cobrar();
  }

  /* rodapé de todas as páginas */
  function rodape() {
    return `<footer class="rodape"><div class="rodape-in">
      <div class="rodape-marca"><img src="assets/isotipo.svg" alt="" width="26" height="37"><span><b>Mulheres &amp; Quintais</b><small>Quintais Produtivos para Mulheres Rurais</small></span></div>
      <p class="rodape-org">IFRN Campus Apodi · MPA · FUNCERN<br><span>Processo ${esc(MQ.PROJETO.processo)}</span></p>
      <div class="rodape-lgpd"><button type="button" class="rodape-ajuda" data-acao="ajuda"><span class="rodape-ajuda-ic" aria-hidden="true">?</span>Ajuda desta página</button>
        <p>Dados protegidos pela LGPD (Lei nº 13.709/2018), usados só para o projeto.</p></div>
    </div></footer>`;
  }
  function barra(publica, semBotao) {
    return `<header class="barra"><div class="barra-in">
      <div class="marca"><img class="emb" src="assets/isotipo.svg" alt="" width="36" height="52"><img src="assets/logo-claro.svg" alt="Mulheres &amp; Quintais" width="112" height="36"><span class="sep" aria-hidden="true"></span>
        <span class="sis"><b>Sistema do projeto</b>Quintais Produtivos para Mulheres Rurais</span></div>
      ${publica ? (semBotao ? '' : `<a class="btn-barra" href="#">${S.eu ? 'Voltar ao sistema' : 'Entrar'}</a>`) : S.eu && !S.verEntrada ? `<div class="quem"><button class="btn-ajuda" data-acao="ajuda" title="Ajuda desta tela" aria-label="Ajuda desta tela">?</button><button class="btn-meus" data-acao="meus-dados" title="Meus dados" aria-label="Meus dados e conta bancária">${avatar(Object.assign({}, S.eu, porId(S.eu.id) || {}), 34)}</button><span><span class="nome">${esc(S.eu.nome)}</span><br><span class="papel">${esc(P[S.eu.papel].nome)}${S.eu.uf ? ' · ' + esc(S.eu.uf) : ''}</span></span>
        ${S.api.modo === 'supabase' ? '<button class="btn-barra" data-acao="sair">Sair</button>' : ''}</div>` : ''}
    </div></header>`;
  }

  function faixaDemo() {
    const p = S.api.perfisDemo();
    const b = (id, t) => `<button type="button" data-acao="perfil" data-p="${id}" aria-pressed="${S.verEntrada ? id === 'entrada' : p === id}">${t}</button>`;
    return `<div class="demo"><div class="demo-in"><span class="demo-selo"><span aria-hidden="true">⚠</span> <b>Ambiente de demonstração</b> · os dados exibidos são fictícios</span>
      <span class="demo-ver">Ver como: <span class="seg" role="group" aria-label="Perfil">${b('coord_geral', 'Coordenação geral')}${b('coord_tecnico', 'Coordenação técnica')}${b('bolsista', 'Bolsista')}${b('agente', 'Agente de campo')}${b('professor', 'Professor FIC')}${b('auxiliar', 'Auxiliar adm.')}${b('entrada', 'Tela de entrada')}</span></span>
      <details class="demo-mais"><summary>Ver detalhes</summary><p>Os dados ficam gravados só neste navegador e servem para testar. Nada aqui vai para o servidor nem para a vitrine pública.</p>
        <button class="link" data-acao="recomecar">Recomeçar demonstração</button></details></div></div>`;
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

  const GRUPOS_ABAS = [['Gestão', ['visao', 'equipe', 'selecao']], ['Execução', ['campo', 'fic', 'execucao']], ['Financeiro', ['pagamentos', 'custos', 'viagens']], ['Documentação', ['documentos', 'historico']]];
  /* cada coordenação só vê os módulos do seu papel (o banco também limita o que cada uma lê e grava) */
  const ABAS_PAPEL = {
    coord_geral:   ['visao', 'equipe', 'selecao', 'campo', 'fic', 'execucao', 'pagamentos', 'custos', 'viagens', 'documentos', 'historico'],   // na ordem dos grupos do menu
    coord_tecnico: ['selecao', 'equipe', 'campo', 'pagamentos', 'custos', 'viagens']
  };
  /* seções da coordenação com o número de pendências de cada uma (abas no computador, menu ☰ no celular) */
  const abasDoPapel = () => ABAS_PAPEL[S.eu.papel] || ABAS_PAPEL.coord_tecnico;
  function abasCoord() {
    const pode = abasDoPapel();
    const aguard = (S.fichas || []).filter(f => f.situacao === 'aguardando').length;
    const diagAguard = (S.diagnosticos || []).filter(x => x.situacao === 'aguardando').length;
    const aval = MQ.pagUI ? MQ.pagUI.contaAval() : 0;
    const equipe = (S.pre || []).length + (S.pedidosAcesso || []).length;   // cadastros do link para conferir + pedidos de novo acesso
    return [['visao', 'Visão geral', 0], ['equipe', 'Equipe', equipe], ['selecao', 'Seleção', aguard], ['campo', 'Campo', diagAguard], ['fic', 'Curso FIC', 0],
      ['pagamentos', 'Pagamentos', aval], ['viagens', 'Viagens e eventos', MQ.viagUI ? MQ.viagUI.contaMinha() : 0], ['custos', 'Custos', 0], ['execucao', 'Execução', 0], ['documentos', 'Documentos', 0], ['historico', 'Histórico', 0]].filter(([id]) => pode.includes(id));
  }
  function abaAtual() { const pode = abasDoPapel(); return pode.includes(S.aba) ? S.aba : pode[0]; }
  function telaCoordenacao() {
    const souGeral = S.eu.papel === 'coord_geral';
    const ct = naVaga('coord_tecnico');
    const bols = ativos().filter(m => R.ehBolsista(m.papel));
    const pagaveis = ativos().filter(m => m.papel === 'coord_tecnico' || R.ehBolsista(m.papel));
    const aptas = pagaveis.filter(m => R.situacao(m).cod === 'ok').length;
    const aba = abaAtual();
    const lista = abasCoord();
    // número na aba = coisas esperando uma ação SUA ali (quem lê tela ouve "3 esperando você")
    const abas = lista.map(([id, t, n]) => [id, `<span class="aba-t" data-t="${esc(t)}">${t}</span>` + (n ? ` <span class="conta" aria-hidden="true">${n}</span><span class="so-leitor"> (${n} esperando você)</span>` : '')]);
    const nomeAba = id => { const x = lista.find(([i]) => i === id) || lista[0]; return x[1]; };
    const outras = lista.filter(([id, , n]) => n && id !== aba);
    const somaOutras = outras.reduce((t, [, , n]) => t + n, 0);
    // menu agrupado: Gestão · Execução · Financeiro · Documentação (só os grupos com abas deste papel)
    const btnAba = ([id, t]) => `<button type="button" data-acao="aba" data-aba="${id}" ${aba === id ? 'aria-current="page"' : ''}>${t}</button>`;
    const grupos = GRUPOS_ABAS.map(([g, ids]) => [g, ids.map(id => abas.find(([i]) => i === id)).filter(Boolean)]).filter(([, l]) => l.length);
    const soltas = abas.filter(([id]) => !GRUPOS_ABAS.some(([, ids]) => ids.includes(id)));
    const nav = `<nav class="abas abas-grupos" aria-label="Seções">${grupos.map(([g, l]) => `<div class="aba-grupo" role="group" aria-label="${g}"><span class="aba-g" aria-hidden="true">${g}</span><div class="aba-btns">${l.map(btnAba).join('')}</div></div>`).join('')}${soltas.length ? `<div class="aba-grupo"><div class="aba-btns">${soltas.map(btnAba).join('')}</div></div>` : ''}</nav>
      <details class="abas-m"><summary><span class="small muted">Seção</span> <b>${(abas.find(([id]) => id === aba) || abas[0])[1]}</b>${somaOutras ? `<span class="conta abas-m-pend" aria-hidden="true">${somaOutras}</span><span class="so-leitor"> (${somaOutras} esperando você em: ${esc(outras.map(([id]) => nomeAba(id)).join(', '))})</span>` : ''}<span class="abas-m-seta" aria-hidden="true">▾</span></summary>
        <div class="abas-m-grade">${grupos.map(([g, l]) => `<span class="aba-g">${g}</span>${l.map(btnAba).join('')}`).join('')}${soltas.map(btnAba).join('')}</div></details>`;
    const intro = souGeral
      ? 'Você cadastra a coordenação técnica indicada pelo MPA, os professores do curso FIC e o auxiliar administrativo, e tem acesso a tudo: também pode cadastrar, editar e desligar bolsistas e agentes, registrar a habilitação e matricular no FIC.'
      : 'Cadastre as bolsistas indicadas pelo MPA: uma de articulação estadual e uma de apoio estadual por estado.';
    let corpo = '';
    if (aba === 'visao') corpo = MQ.painelUI ? MQ.painelUI.visaoGeral(S) : '';
    else if (aba === 'equipe') corpo = (!R.temProfessorHabilitado(S.equipe) ? `<div class="aviso erro" role="status"><b>Cadastre e habilite primeiro um professor do FIC.</b> Sem professor com cadastro no Arlo e termo assinado, o sistema não cadastra coordenação técnica, bolsistas nem agentes de campo (a matrícula no curso depende dele).</div>` : '') + secaoPedidosAcesso() + (MQ.convitesUI ? MQ.convitesUI.secaoPendentes() : '') + `
      <div class="cab eq-cab"><div><span class="eyebrow">Equipe do projeto</span><h1>Coordenação e bolsistas</h1><p class="eq-intro">${intro}</p>${prazoChip()}</div></div>
      <div class="eq-kpis" aria-label="Resumo da equipe">
        ${kpiEq(ct ? 1 : 0, 1, 'coordenação técnica cadastrada')}
        ${kpiEq(bols.length, 10, 'bolsistas cadastradas')}
        ${kpiEq(aptas, pagaveis.length || 0, 'habilitadas (FIC, FUNCERN e termo)')}
        ${kpiEq((S.fichas || []).filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada').length, 200, 'mulheres selecionadas e aprovadas')}
      </div>
      <section class="secao" aria-labelledby="t-ct">
        <div class="secao-cab"><div><h2 id="t-ct">Coordenação técnica</h2><p>Uma para os 5 estados · indicada pelo MPA · cadastrada pela coordenação geral</p></div></div>
        ${ct ? cartaoPessoa(ct) : vagaCoordTecnica(souGeral)}
      </section>
      ${secaoAuxiliares(souGeral)}
      ${MQ.ficUI && !S.ficSemBanco ? MQ.ficUI.secaoEquipe() : ''}
      <section class="secao" aria-labelledby="t-b">
        <div class="secao-cab"><div><h2 id="t-b">Bolsistas por estado</h2><p>1 de articulação e 1 de apoio por estado · cadastradas pela coordenação técnica · meta de 40 quintais por estado</p></div></div>
        ${quadroTabela()}${quadroCartoes()}
      </section>
      ${secaoAgentes()}`;
    else if (aba === 'selecao') corpo = MQ.fichasUI ? MQ.fichasUI.secaoCoord() : '';
    else if (aba === 'custos') corpo = MQ.custosUI ? MQ.custosUI.aba() : '';
    else if (aba === 'fic') corpo = MQ.ficUI ? MQ.ficUI.aba() : '';
    else if (aba === 'pagamentos') corpo = MQ.pagUI ? MQ.pagUI.abaCoord() : '';
    else if (aba === 'viagens') corpo = MQ.viagUI ? MQ.viagUI.abaCoord() : '';
    else if (aba === 'documentos') corpo = MQ.docsUI && souGeral ? MQ.docsUI.aba() : '';
    else if (aba === 'execucao') corpo = MQ.execUI && souGeral ? MQ.execUI.aba() : '';
    else if (aba === 'campo') corpo = (MQ.campoUI ? MQ.campoUI.abaCoord() : '') + (MQ.vitrineUI && !S.campoSemBanco ? MQ.vitrineUI.secaoCoord() : '');
    else corpo = `<div class="cab"><div><span class="eyebrow">Histórico</span><h1 id="t-h">Histórico de alterações</h1>
        <p>Quem fez o quê, e quando: cadastros, aprovações, pagamentos, códigos de acesso e consultas a dados bancários. Serve para a prestação de contas.</p></div></div>
      ${secaoAcessos()}
      <section class="secao" aria-label="Registros"><div class="secao-cab"><div><h2 id="t-reg">Alterações</h2></div></div>${historico()}</section>`;
    const avisoEx = S.exemplo ? `<details class="aviso-ex" role="status"><summary><span aria-hidden="true">⚠</span> <b>Dados de exemplo no servidor</b> · ${S.exemplo} registros inventados <span class="link">Ver detalhes</span></summary>
      <p>Servem para testar; não aparecem na vitrine pública. Antes de cadastrar a equipe e as fichas de verdade, a coordenação geral roda o arquivo 06_apagar_exemplo.sql no Supabase.</p></details>` : '';
    return `<main class="wrap" id="principal">${avisoEx}${nav}${corpo}</main>`;
  }


  const nomeDe = m => m.nome_social ? m.nome_social : m.nome;
  /* foto pequena ao lado do nome; sem foto (ou link vencido), mostra as iniciais */
  const CORES_AV = ['#6B7A3A', '#A44934', '#885B44', '#8A5A00', '#2F6B66', '#6A4E7A'];   // terrosos: oliva, terracota, marrom, ocre, petróleo, roxo suave
  function avatar(m, tam) {
    const p = String(m.nome || '?').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(x => x && !/^(d[aeo]s?|e)$/i.test(x));
    const ini = ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    let h = 0; for (const c of String(m.id || m.nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="av" style="--av:${tam || 32}px;--avc:${CORES_AV[h % CORES_AV.length]}" aria-hidden="true">${esc(ini)}${m.foto_url ? `<img src="${esc(m.foto_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }
  const podeTrocarFoto = m => m.status === 'ativa' && (S.eu.id === m.id || (/^coord/.test(S.eu.papel) && R.podeEditarDados(S.eu.papel, m.papel)));
  const botaoFoto = m => podeTrocarFoto(m) ? `<label class="btn peq foto-btn">${m.foto_url ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/*" data-foto-equipe="${m.id}" hidden></label>` : '';

  function cartaoPessoa(m) {
    const s = R.situacao(m);
    return `<div class="pessoa com-foto pessoa-c">${avatar(m, 60)}<div style="display:grid;gap:6px;min-width:0">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="nm">${esc(nomeDe(m))}</span><span class="chip ${s.cod}">${esc(s.rot)}</span></div>
        <div class="dd"><span>${esc(m.email)}</span><span class="num">${esc(m.telefone)}</span>${m.municipio ? `<span>${esc(m.municipio)}</span>` : ''}${m.organizacao ? `<span>${esc(m.organizacao)}</span>` : ''}</div></div>
      <div class="acts"><button class="btn peq" data-acao="ver" data-id="${m.id}">Ver detalhes</button></div></div>`;
  }
  /* vaga sem pessoa: o mesmo componente para coordenação técnica, auxiliar e professores (não é erro: é uma vaga a preencher) */
  function vagaAberta(texto, pode, botao, rotulo) {
    return `<div class="vaga-aberta"><div><span class="st-chip ${rotulo && rotulo !== 'Vaga aberta' ? 'st-nao' : 'st-aten'}">${rotulo || 'Vaga aberta'}</span><p>${texto}</p>${pode ? '' : '<p class="small muted">Só a coordenação geral pode fazer este cadastro.</p>'}</div>${pode ? botao : ''}</div>`;
  }
  /* indicador da equipe: número grande, denominador menor, descrição; "completo" em verde quando chega lá */
  function kpiEq(n, de, rot) {
    return `<div class="eq-kpi"><span class="eq-n num"><b>${n}</b><small> de ${de}</small></span><span class="eq-l">${rot}</span>${de && n >= de ? '<span class="eq-ok">completo</span>' : ''}</div>`;
  }

  function vagaCoordTecnica(souGeral) {
    const ant = ultimaDesligada('coord_tecnico');
    return vagaAberta(ant ? `A anterior, ${esc(ant.nome)}, foi desligada${ant.data_fim ? ' em ' + R.fmtData(ant.data_fim) : ''}.` : 'O MPA ainda não indicou a coordenação técnica.', souGeral,
      MQ.botaoAcao({ acao: 'novo', icone: 'equipe', texto: 'Cadastrar coordenação técnica', curto: 'Cadastrar', attrs: `data-papel="coord_tecnico"${ant ? ` data-subst="${ant.id}"` : ''}` }));
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
    if (!posso) return `<button class="vagabtn livre" disabled><span class="add">Vaga aberta</span><span class="sub">${quem}</span></button>`;
    return `<div class="vaga-slot"><span class="sub">${quem}</span>${MQ.botaoAcao({ acao: 'novo', icone: 'pessoa_mais', sec: true, peq: true,
      texto: 'Cadastrar ' + (ant ? 'substituta' : P[papel].curto.toLowerCase()), curto: 'Cadastrar', rotulo: 'Cadastrar ' + (ant ? 'substituta' : P[papel].curto.toLowerCase()) + ' em ' + uf,
      attrs: `data-papel="${papel}" data-uf="${uf}"${ant ? ` data-subst="${ant.id}"` : ''}` })}</div>`;
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
          ${podeCad ? MQ.botaoAcao({ acao: 'novo', icone: 'pessoa_mais', texto: 'Adicionar agente', rotulo: 'Adicionar agente em ' + u.uf, sec: true, peq: true, attrs: `data-papel="agente" data-uf="${u.uf}"` }) : ''}</div>`; }).join('')}</div>
    </section>`;
  }

  /* ---------- auxiliar administrativo ---------- */
  function secaoAuxiliares(souGeral) {
    const aux = naVaga('auxiliar_adm'); const ant = ultimaDesligada('auxiliar_adm');
    return `<section class="secao" aria-labelledby="t-aux">
      <div class="secao-cab"><div><h2 id="t-aux">Auxiliar administrativo</h2><p>Um para o projeto · IFRN · cadastrado pela coordenação geral · cadastra a equipe no Arlo, registra o Arlo e o termo e lança os pagamentos</p></div></div>
      ${aux ? cartaoPessoa(aux) : vagaAberta(ant ? `O anterior, ${esc(ant.nome)}, foi desligado${ant.data_fim ? ' em ' + R.fmtData(ant.data_fim) : ''}.` : 'Digite os dados ou gere um link para ele preencher.', souGeral,
        MQ.botaoAcao({ acao: 'novo', icone: 'pasta', texto: 'Cadastrar auxiliar administrativo', curto: 'Cadastrar', attrs: `data-papel="auxiliar_adm"${ant ? ` data-subst="${ant.id}"` : ''}` }))}
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
    const grupo = (t, l, vazio, id) => `<section class="secao"><div class="secao-cab"><h2${id ? ` id="${id}"` : ''}>${t} <span class="conta-t${l.length ? '' : ' zero'}">${l.length}</span></h2></div>
      ${l.length ? `<div class="grade-prof">${l.map(linha).join('')}</div>` : `<p class="muted">${vazio}</p>`}</section>`;
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">${esc(P.auxiliar_adm.nome)}</span><h1>Olá, ${esc(nomeDe(eu).split(' ')[0])}</h1><p>${esc(P.auxiliar_adm.faz)}</p></div>
        <span class="chip chip-lg ${s.cod}">${esc(s.rot)}</span></div>
      ${atalhos([['Cadastrar no Arlo', '#t-arlo', true, semArlo.length], ['Lançar pagamentos no Arlo', '#t-lancar', false, MQ.pagUI ? MQ.pagUI.contaLancar() : 0],
        ['Pedir a minha bolsa', '#t-pag', false, MQ.pagUI ? MQ.pagUI.contaDevolvidas() : 0],
        S.quemConfere === 'auxiliar_adm' ? ['Conferir passagens e eventos', '#t-conf', false, MQ.viagUI ? MQ.viagUI.contaMinha() : 0] : null])}
      <div class="resumo">
        <div><span class="v num">${pessoas.length}</span><span class="l">pessoas na equipe</span></div>
        <div><span class="v num" ${semArlo.length ? 'style="color:var(--crit)"' : ''}>${semArlo.length}</span><span class="l">falta cadastrar no Arlo</span></div>
        <div><span class="v num">${semTermo.length}</span><span class="l">no Arlo, falta o termo</span></div>
        <div><span class="v num">${ok.length}</span><span class="l">Arlo e termo registrados</span></div></div>
      <p class="small muted">Abra a pessoa, veja os dados (e a conta, se precisar), cadastre no Arlo e registre a data em <b>Registrar passos da habilitação</b>. Cada consulta de conta bancária fica no histórico.</p>
      ${MQ.bancoUI ? MQ.bancoUI.blocoSituacao() : ''}
      ${MQ.viagUI ? MQ.viagUI.secaoConferente() : ''}
      ${MQ.pagUI ? MQ.pagUI.secaoAuxiliar() : ''}
      ${grupo('Falta cadastrar no Arlo', semArlo, 'Todos já estão no Arlo.', 't-arlo')}
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
    if (a.tabela === 'acesso_codigos') { const n = esc((porId(a.registro_id) || {}).nome || 'uma pessoa');
      return a.acao === 'NOVO_ACESSO' ? `<b>${esc(quem)}</b> liberou um novo primeiro acesso para <b>${n}</b> (a senha anterior foi apagada).` : `<b>${esc(quem)}</b> gerou o código de acesso de <b>${n}</b>.`; }
    const Q = `<b>${esc(quem)}</b>`, A0 = a.antes || {}, D0 = a.depois || {};
    const mulher = id => { const f = (S.fichas || []).find(x => x.id === id); return f ? `<b>${esc(f.nome)}</b>` : 'uma agricultora'; };
    const pessoa = id => { const m = porId(id); return m ? `<b>${esc(nomeDe(m))}</b>` : 'uma pessoa'; };
    const mudou = A0.situacao !== D0.situacao && a.acao === 'UPDATE' ? D0.situacao : null;
    const ETAPA = { diagnostico: 'de diagnóstico', implantacao: 'de implantação', acompanhamento: 'de acompanhamento', avaliacao: 'de avaliação final' };
    if (a.tabela === 'fichas') {
      if (a.acao === 'INSERT') return `${Q} registrou a ficha de indicação de ${mulher(alvo.id) === 'uma agricultora' ? `<b>${esc(alvo.nome || '')}</b>` : mulher(alvo.id)}${alvo.uf ? ' (' + esc(alvo.uf) + ')' : ''}.`;
      if (mudou === 'aprovada') return `${Q} aprovou a ficha de ${mulher(a.registro_id)}.`;
      if (mudou === 'devolvida') return `${Q} devolveu para correção a ficha de ${mulher(a.registro_id)}.`;
      if (A0.resultado !== D0.resultado && MQ.RESULTADOS[D0.resultado]) return `${Q} marcou ${mulher(a.registro_id)} como <b>${esc(MQ.RESULTADOS[D0.resultado].nome.toLowerCase())}</b>.`;
      return `${Q} atualizou a ficha de ${mulher(a.registro_id)}.`;
    }
    if (a.tabela === 'visitas') {
      const et = ETAPA[alvo.etapa] || '';
      if (a.acao === 'INSERT') return `${Q} agendou a visita ${et} ao quintal de ${mulher(alvo.ficha_id)}${alvo.data_prevista ? ' para ' + R.fmtData(alvo.data_prevista) : ''}.`;
      if (mudou === 'realizada') return `${Q} registrou a visita ${et} ao quintal de ${mulher(alvo.ficha_id)} como feita.`;
      if (mudou === 'cancelada') return `${Q} cancelou a visita ${et} ao quintal de ${mulher(alvo.ficha_id)}.`;
      return `${Q} atualizou a visita ${et} ao quintal de ${mulher(alvo.ficha_id)}.`;
    }
    if (a.tabela === 'diagnosticos') {
      if (a.acao === 'INSERT') return `${Q} enviou o diagnóstico e o plano do quintal de ${mulher(alvo.ficha_id)}.`;
      if (mudou === 'aprovado' || mudou === 'aprovada') return `${Q} aprovou o diagnóstico de ${mulher(alvo.ficha_id)}.`;
      if (mudou === 'devolvido' || mudou === 'devolvida') return `${Q} devolveu para correção o diagnóstico de ${mulher(alvo.ficha_id)}.`;
      return `${Q} atualizou o diagnóstico de ${mulher(alvo.ficha_id)}.`;
    }
    if (a.tabela === 'avaliacoes') return `${Q} ${a.acao === 'INSERT' ? 'registrou' : 'atualizou'} a avaliação final do quintal de ${mulher(alvo.ficha_id)}.`;
    if (a.tabela === 'custos_visita') return `${Q} definiu a distância (ajuda de custo) de uma visita${alvo.km_ida != null ? ': ' + esc(alvo.km_ida) + ' km de ida' : ''}.`;
    if (a.tabela === 'solicitacoes_pagamento') {
      const tipo = alvo.tipo === 'ajuda_custo' ? 'ajuda de custo' : 'bolsa';
      if (a.acao === 'INSERT' || mudou === 'solicitada') return `${pessoa(alvo.equipe_id)} pediu o pagamento da ${tipo}.`;
      if (mudou === 'avalizada') return `${Q} avalizou o pagamento da ${tipo} de ${pessoa(alvo.equipe_id)}.`;
      if (mudou === 'lancada') return `${Q} lançou no Arlo o pagamento da ${tipo} de ${pessoa(alvo.equipe_id)}.`;
      if (mudou === 'devolvida') return `${Q} devolveu o pedido de ${tipo} de ${pessoa(alvo.equipe_id)}.`;
      return `${Q} atualizou o pedido de ${tipo} de ${pessoa(alvo.equipe_id)}.`;
    }
    if (a.tabela === 'documentos_projeto') return alvo.arquivado_em && a.acao === 'UPDATE'
      ? `${Q} arquivou o documento <b>${esc(alvo.titulo)}</b>: ${esc(alvo.motivo_arquivo || '')}` : `${Q} anexou o documento <b>${esc(alvo.titulo)}</b>${MQ.docsUI && MQ.docsUI.TIPOS[alvo.tipo] ? ' (' + esc(MQ.docsUI.TIPOS[alvo.tipo].toLowerCase()) + ')' : ''}.`;
    if (a.tabela === 'pedidos_apoio') {
      const tipo = alvo.tipo === 'evento' ? 'estrutura de evento' : 'passagem aérea';
      const txt = { enviado: `${pessoa(alvo.solicitante_id)} ${a.acao === 'INSERT' ? 'pediu' : 'reenviou o pedido de'} ${tipo}`, conferido: `${Q} conferiu o pedido de ${tipo} de ${pessoa(alvo.solicitante_id)}`,
        devolvido: `${Q} devolveu o pedido de ${tipo} de ${pessoa(alvo.solicitante_id)}`, autorizado: `${Q} autorizou o pedido de ${tipo} de ${pessoa(alvo.solicitante_id)} e mandou para a FUNCERN`,
        recusado: `${Q} recusou o pedido de ${tipo} de ${pessoa(alvo.solicitante_id)}`, cancelado: `${Q} cancelou o pedido de ${tipo}` }[alvo.situacao];
      return (txt || `${Q} atualizou um pedido de ${tipo}`) + (alvo.uf ? ' (' + esc(alvo.uf) + ')' : '') + '.';
    }
    if (a.tabela === 'turmas_fic') return `${Q} ${a.acao === 'INSERT' ? 'criou' : a.acao === 'DELETE' ? 'removeu' : 'atualizou'} a turma do FIC <b>${esc(alvo.nome || '')}</b>.`;
    if (a.tabela === 'matriculas_fic') return alvo.cancelada_em ? `${Q} cancelou a matrícula no FIC de ${pessoa(alvo.equipe_id)}.` : `${Q} matriculou ${pessoa(alvo.equipe_id)} no curso FIC.`;
    if (a.tabela === 'vitrine_fotos') return `${Q} ${a.acao === 'DELETE' ? 'tirou uma foto da' : 'publicou uma foto na'} vitrine${alvo.uf ? ' (' + esc(alvo.uf) + ')' : ''}.`;
    if (a.tabela && a.tabela !== 'equipe') return `${Q} alterou um registro (${esc(a.tabela.replace(/_/g, ' '))}).`;
    if (a.acao === 'INSERT') return `${Q} cadastrou <b>${esc(alvo.nome)}</b>${papel ? ' (' + esc(papel) + ')' : ''}${alvo.substitui_id ? ' como substituta' : ''}.`;
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
    if (!S.aud.length) return `<div class="vazio-hist"><p><b>Nada registrado ainda.</b></p>
      <p class="small muted">Aqui aparece, com data, hora e autor, tudo o que muda na equipe: cadastros, códigos de acesso, habilitação (FIC, Arlo e termo), consultas à conta bancária, desligamentos e o primeiro acesso de cada pessoa.</p></div>`;
    const fmtH = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dia = t => { const d = new Date(t), h = new Date(); const ontem = new Date(h); ontem.setDate(h.getDate() - 1);
      const k = x => x.toLocaleDateString('pt-BR'); return k(d) === k(h) ? 'Hoje' : k(d) === k(ontem) ? 'Ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); };
    const lista = arr => { let ult = ''; return arr.map(a => { const d = dia(a.em); const cab = d !== ult ? `<li class="hist-dia">${esc(d)}</li>` : ''; ult = d;
      return cab + `<li><time datetime="${esc(a.em)}">${fmtH(a.em)}</time><span>${descreverAud(a)}</span></li>`; }).join(''); };
    const semana = S.aud.filter(a => Date.now() - new Date(a.em) < 7 * 864e5).length;
    const ord = S.aud.slice().sort((x, y) => String(y.em).localeCompare(String(x.em)));
    const N = 12, rec = ord.slice(0, N), resto = ord.slice(N, 200);
    return `<p class="small muted">${S.aud.length} registro${S.aud.length > 1 ? 's' : ''} · ${semana} nos últimos 7 dias</p>
      <ul class="linha-tempo lt-hora">${lista(rec)}</ul>
      ${resto.length ? dobra('hist-antigos', `Ver ${resto.length} registro${resto.length > 1 ? 's' : ''} anterior${resto.length > 1 ? 'es' : ''}`, `<ul class="linha-tempo lt-hora">${lista(resto)}</ul>`) : ''}`;
  }

  /* ---------- Últimos acessos (só a coordenação geral; 30_ultimos_acessos.sql) ---------- */
  const TIPO_ACESSO = { entrada: 'entrou', primeiro_acesso: 'entrou pela primeira vez', abriu: 'abriu o sistema (já estava logada)',
    saida: 'saiu pelo botão Sair', saida_inatividade: 'saiu sozinho: 15 minutos sem uso', senha_trocada: 'trocou a senha' };
  /* IP pela metade: basta para ver se é a mesma rede; o número inteiro fica só no banco */
  const ipCurto = ip => { const v = String(ip || ''); if (!v) return '';
    if (v.includes('.')) { const p = v.split('.'); return p.length === 4 ? p[0] + '.' + p[1] + '.•.•' : ''; }
    return v.split(':').slice(0, 2).join(':') + ':…'; };
  function quandoAcesso(t) {
    const d = new Date(t), h = new Date(); const k = x => x.toLocaleDateString('pt-BR');
    const ontem = new Date(h); ontem.setDate(h.getDate() - 1);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return k(d) === k(h) ? 'hoje, ' + hora : k(d) === k(ontem) ? 'ontem, ' + hora : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ', ' + hora;
  }
  const ultimoAcessoDe = id => (S.acessos || []).find(a => a.equipe_id === id && a.tipo !== 'saida' && a.tipo !== 'saida_inatividade');
  function linhaUltimoAcesso(m) {
    if (!S.eu || S.eu.papel !== 'coord_geral' || S.acessosSemBanco || m.id === S.eu.id) return '';
    const a = ultimoAcessoDe(m.id);
    if (!a) return `<p class="small muted ult-acesso">${m.user_id ? 'Último acesso: sem registro nos últimos 6 meses.' : 'Ainda não entrou no sistema.'}</p>`;
    return `<p class="small muted ult-acesso">Último acesso: <b>${esc(quandoAcesso(a.em))}</b>${a.aparelho ? ' · ' + esc(a.aparelho) : ''}</p>`;
  }
  function secaoAcessos() {
    if (!S.eu || S.eu.papel !== 'coord_geral') return '';
    const cab = `<div class="secao-cab"><div><h2 id="t-acessos">Últimos acessos</h2><p>Quem entrou no sistema, quando e de que aparelho. Só a coordenação geral vê. Registros com mais de 6 meses são apagados sozinhos.</p></div></div>`;
    if (S.acessosSemBanco) return `<section class="secao" aria-labelledby="t-acessos">${cab}<div class="aviso">Para ver quem entrou no sistema, quando e de que aparelho, rode no Supabase o arquivo <b>30_ultimos_acessos.sql</b>. O registro começa a partir daí.</div></section>`;
    const acessos = (S.acessos || []).slice().sort((x, y) => String(y.em).localeCompare(String(x.em)));
    const pessoas = (S.equipe || []).filter(m => m.status === 'ativa' && m.id !== S.eu.id);
    const com = pessoas.map(m => [m, ultimoAcessoDe(m.id)]).filter(([, a]) => a).sort((x, y) => String(y[1].em).localeCompare(String(x[1].em)));
    const nunca = pessoas.filter(m => !m.user_id && !ultimoAcessoDe(m.id)), semReg = pessoas.filter(m => m.user_id && !ultimoAcessoDe(m.id));
    const semana = new Set(acessos.filter(a => Date.now() - new Date(a.em) < 7 * 864e5 && a.equipe_id !== S.eu.id).map(a => a.equipe_id)).size;
    const detalhe = a => [a.aparelho, ipCurto(a.ip) && 'rede ' + ipCurto(a.ip)].filter(Boolean).map(esc).join(' · ');
    const papelDe = m => esc(P[m.papel] ? P[m.papel].nome : m.papel) + (m.uf ? ' · ' + esc(m.uf) : '');
    const itemPessoa = ([m, a]) => `<li><time datetime="${esc(a.em)}">${esc(quandoAcesso(a.em))}</time><span><b>${esc(nomeDe(m))}</b> <span class="small muted">${papelDe(m)}</span>${detalhe(a) ? `<br><span class="small muted">${detalhe(a)}</span>` : ''}</span></li>`;
    const itemReg = a => { const m = porId(a.equipe_id) || { nome: 'Pessoa' };
      return `<li><time datetime="${esc(a.em)}">${esc(quandoAcesso(a.em))}</time><span><b>${esc(nomeDe(m))}</b> ${esc(TIPO_ACESSO[a.tipo] || a.tipo)}${detalhe(a) ? `<br><span class="small muted">${detalhe(a)}</span>` : ''}</span></li>`; };
    const nomes = l => l.map(m => esc(nomeDe(m))).join(', ');
    return `<section class="secao" aria-labelledby="t-acessos">${cab}
      <p class="small muted">${semana} de ${pessoas.length} pessoa${pessoas.length === 1 ? '' : 's'} da equipe entr${semana === 1 ? 'ou' : 'aram'} nos últimos 7 dias.</p>
      ${com.length ? `<ul class="linha-tempo lt-acesso" id="lista-acessos">${com.map(itemPessoa).join('')}</ul>` : '<p class="small muted">Ninguém da equipe entrou desde que o registro começou.</p>'}
      ${nunca.length ? `<p class="small"><b>Ainda não entraram (${nunca.length}):</b> ${nomes(nunca)}. Na ficha de cada uma está o código de acesso.</p>` : ''}
      ${semReg.length ? `<p class="small muted">Sem registro de entrada nos últimos 6 meses (${semReg.length}): ${nomes(semReg)}.</p>` : ''}
      ${acessos.length ? dobra('acessos-todos', `Ver entradas e saídas (${acessos.length})`, `<ul class="linha-tempo lt-acesso">${acessos.slice(0, 300).map(itemReg).join('')}</ul>`) : ''}
    </section>`;
  }

  /* "Meus dados": abre pelo botão com a foto, no alto, ao lado de Sair */
  const NOTA_DADOS = { coord_tecnico: 'a coordenação geral', professor_fic: 'a coordenação geral', auxiliar_adm: 'a coordenação geral',
    articulacao: 'a coordenação técnica', apoio: 'a coordenação técnica', agente: 'a coordenação técnica' };
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
        ${m.papel !== 'coord_geral' && !m.cadastro_arlo && MQ.bancoUI ? MQ.bancoUI.secaoMinha() : ''}
        <details class="hist trocar-senha"><summary>Trocar minha senha</summary>
          <form class="f" data-form="trocar-senha" novalidate>
            <input type="text" name="usuario" autocomplete="username" value="${esc(m.email || '')}" hidden>
            <div class="campo"><label for="ts-atual">Senha atual</label><input id="ts-atual" name="atual" type="password" autocomplete="current-password" required></div>
            <div class="campo"><label for="ts-nova">Nova senha</label><input id="ts-nova" name="nova" type="password" autocomplete="new-password" minlength="8" required><span class="dica">Pelo menos 8 caracteres, com letras e números.</span></div>
            <div class="campo"><label for="ts-nova2">Repita a nova senha</label><input id="ts-nova2" name="nova2" type="password" autocomplete="new-password" required></div>
            <div class="aviso erro" data-erro hidden></div>
            <div class="acoes"><button class="btn pri" type="submit">Trocar senha</button></div>
          </form></details>
        ${S.api.modo === 'supabase' ? '<div class="acoes"><button class="btn" data-acao="sair">Sair</button></div>' : ''}</div>`;
  }

  /* atalhos no topo das telas pessoais: o caminho mais curto para cada tarefa, sem rolar a página inteira no celular.
     Cada item: [texto, '#id da seção' ou {acao: 'nome-da-acao'}, destaque]. Atalho de seção que não existe na tela some sozinho. */
  MQ.atalhos = itens => atalhos(itens);
  function atalhos(itens) {
    // 4º item (opcional): quantas coisas esperam a pessoa ali; aparece como número no botão
    const n = k => k ? ` <span class="conta" aria-hidden="true">${k}</span><span class="so-leitor"> (${k} esperando você)</span>` : '';
    const bt = ([t, alvo, pri, k]) => typeof alvo === 'string'
      ? `<button type="button" class="btn${pri ? ' pri' : ''}" data-acao="ir" data-alvo="${alvo}">${t}${n(k)}</button>`
      : `<button type="button" class="btn${pri ? ' pri' : ''}" data-acao="${alvo.acao}"${alvo.t ? ` data-t="${alvo.t}"` : ''}>${t}${n(k)}</button>`;
    return `<nav class="atalhos" aria-label="O que você quer fazer"><span class="eyebrow">O que você quer fazer?</span><div class="atalhos-grade">${itens.filter(Boolean).map(bt).join('')}</div></nav>`;
  }
  function telaBolsista() {
    const m = Object.assign({}, S.eu, porId(S.eu.id) || {});   // inclui o link da foto
    const s = R.situacao(m);
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">${esc(P[m.papel].nome)} · ${esc(nomeUF(m.uf))}</span><h1>Olá, ${esc(nomeDe(m).split(' ')[0])}</h1>
        <p>${esc(P[m.papel].faz)}</p></div><span class="chip chip-lg ${s.cod}">${esc(s.rot)}</span></div>
      ${atalhos([['+ Nova ficha de mulher', { acao: 'ficha-nova' }, true], ['Visitas e diagnósticos', '#t-campo', false, MQ.campoUI ? MQ.campoUI.contaAFazer() : 0],
        ['Entregas do mês', '#t-ent', false, MQ.entregasUI ? MQ.entregasUI.contaFaltas() : 0], ['Pedir pagamento', '#t-pag', false, MQ.pagUI ? MQ.pagUI.contaDevolvidas() : 0],
        m.papel === 'articulacao' ? ['Passagem ou evento', '#t-viag', false, MQ.viagUI ? MQ.viagUI.contaDevolvidos() : 0] : null])}
      ${MQ.entregasUI ? MQ.entregasUI.blocoCiencia() : ''}
      ${MQ.encUI ? MQ.encUI.blocoConfirmar() : ''}
      ${s.cod === 'ok' ? '' : `<div class="bloco"><h2>Habilitação para receber a bolsa</h2><p class="small muted">A bolsa de ${R.fmtBRL(P[m.papel].bolsa || 0)} por mês só é paga pela FUNCERN depois destes passos. Dúvidas sobre matrícula e AVA: professores do curso FIC. Documentos, conta ou Pix: auxiliar administrativo.</p>${passos(m)}</div>`}
      ${MQ.entregasUI ? MQ.entregasUI.cartaoBolsista() : ''}
      ${m.meta_diagnosticos != null ? `<div class="bloco"><h2>Sua previsão de atividades</h2><p class="small muted">Previsão do termo de compromisso. O trabalho de campo do estado pode ser dividido de outro jeito, combinado com a coordenação técnica.</p><div class="resumo r3">
        <div><span class="v num">${m.meta_diagnosticos}</span><span class="l">diagnósticos (Meta 2)</span></div>
        <div><span class="v num">${m.meta_quintais}</span><span class="l">quintais implantados (Meta 3)</span></div>
        <div><span class="v num">${m.meta_visitas}</span><span class="l">visitas de acompanhamento (Meta 4)</span></div></div></div>` : ''}
      ${MQ.fichasUI ? MQ.fichasUI.secaoBolsista() : ''}
      ${MQ.campoUI ? MQ.campoUI.secaoBolsista() : ''}
      ${MQ.pagUI ? MQ.pagUI.secaoMinha() : ''}
      ${MQ.viagUI ? MQ.viagUI.secaoBolsista() : ''}
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
        <p class="ent-s"><b class="ent-s1 serif">É onde produção, renda e autonomia começam.</b>
          <span class="ent-s2">Mulheres rurais de cinco estados do Nordeste estão construindo seus quintais produtivos.</span></p>
        <ul class="ent-ufs" aria-label="Estados do projeto">${ufs}</ul>
        ${MQ.vitrineUI ? MQ.vitrineUI.entrada() : ''}
        ${broto}
      </section>
      <section class="ent-acesso">
        ${S.modoLogin === 'esqueci' ? formEsqueci() : `<form class="login ent-card" data-form="login" novalidate>
          ${S.avisoLogin ? `<div class="aviso sessao-saiu" role="status">${esc(S.avisoLogin)}</div>` : ''}
          <div><span class="eyebrow">Sistema do projeto</span><h2 class="serif">${primeiro ? 'Primeiro acesso' : 'Que bom ver você'}</h2>
            <p class="muted">${primeiro ? 'Crie a sua senha com o e-mail que a coordenação cadastrou.' : 'Entre com o e-mail cadastrado pela coordenação.'}</p></div>
          <span class="seg ent-seg" role="group" aria-label="Tipo de acesso">${aba('entrar', 'Já tenho senha')}${aba('primeiro', 'Primeiro acesso')}</span>
          <div class="campo"><label for="l-email">E-mail</label><input id="l-email" name="email" type="email" autocomplete="username" inputmode="email" placeholder="seu@email.com" required></div>
          ${primeiro ? '<div class="campo"><label for="l-cod">Código de acesso</label><input id="l-cod" name="codigo" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="ABCD-2345" required><span class="dica">Vem na mensagem que a coordenação mandou. Vale 7 dias.</span></div>' : ''}
          <div class="campo"><label for="l-senha">${primeiro ? 'Crie uma senha' : 'Senha'}</label><input id="l-senha" name="senha" type="password" autocomplete="${primeiro ? 'new-password' : 'current-password'}" minlength="8" required>
            ${primeiro ? '<span class="dica">Pelo menos 8 caracteres, com letras e números.</span>' : ''}</div>
          ${primeiro ? '<div class="campo"><label for="l-senha2">Repita a senha</label><input id="l-senha2" name="senha2" type="password" autocomplete="new-password" required></div>' : ''}
          <div class="aviso erro" data-erro hidden></div>
          <button class="btn pri ent-btn" type="submit">${primeiro ? 'Criar senha e entrar' : 'Entrar'} <span aria-hidden="true">→</span></button>
          ${primeiro ? '' : '<button type="button" class="link ent-esqueci" data-acao="modo-login" data-m="esqueci">Esqueci a senha</button>'}
          <button type="button" class="link ent-ajuda" data-acao="ajuda" data-k="entrada">Precisa de ajuda para entrar?</button>
        </form>`}
      </section>
    </main>`;
  }
  /* "Esqueci a senha": a pessoa pede; a coordenação geral libera um código novo e manda pelo WhatsApp cadastrado */
  function formEsqueci() {
    if (S.esqueciEnviado) return `<div class="login ent-card" role="status">
        <div><span class="eyebrow">Esqueci a senha</span><h2 class="serif">Pedido enviado</h2></div>
        <div class="aviso ok">Se este e-mail estiver cadastrado no projeto, a <b>coordenação geral</b> vai liberar um <b>código de acesso novo</b> e mandar para o <b>WhatsApp do seu cadastro</b>.</div>
        <p class="muted">Quando receber o código, volte aqui, toque em <b>Primeiro acesso</b> e crie uma senha nova. Seus dados não se perdem.</p>
        <p class="small muted">Se precisar com urgência, fale direto com a coordenação geral.</p>
        <button type="button" class="btn pri ent-btn" data-acao="modo-login" data-m="primeiro">Já recebi o código</button>
        <button type="button" class="link ent-ajuda" data-acao="modo-login" data-m="entrar">Voltar para entrar</button></div>`;
    return `<form class="login ent-card" data-form="esqueci" novalidate>
        <div><span class="eyebrow">Esqueci a senha</span><h2 class="serif">Pedir um novo acesso</h2>
          <p class="muted">Digite o e-mail do seu cadastro. A coordenação geral recebe o pedido e manda um código novo para o seu WhatsApp.</p></div>
        <div class="campo"><label for="e-email">E-mail</label><input id="e-email" name="email" type="email" autocomplete="username" inputmode="email" placeholder="seu@email.com" value="${esc(S.emailDigitado || '')}" required></div>
        <div class="aviso erro" data-erro hidden></div>
        <button class="btn pri ent-btn" type="submit">Pedir novo acesso <span aria-hidden="true">→</span></button>
        <button type="button" class="link ent-ajuda" data-acao="modo-login" data-m="entrar">Voltar para entrar</button>
      </form>`;
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
    return `<main class="wrap"><div class="login"><h1>Acesso não liberado</h1><p>Este e-mail não está ativo na equipe do projeto. Se você foi desligada ou trocou de e-mail, fale com quem fez o seu cadastro (coordenação técnica ou coordenação geral).</p>
      <button class="btn" data-acao="sair">Sair</button></div></main>`;
  }

  /* ---------- painel lateral ---------- */
  function abrirPainel(p) { S.painel = p; desenharPainel(); }
  function fecharPainel() {
    S.painel = null; const f = $('#painel'); if (f) f.remove();
    if (S.voltarFoco && document.body.contains(S.voltarFoco)) S.voltarFoco.focus();
  }
  /* rascunho do formulário aberto: se o sistema sair sozinho (15 minutos sem uso) com um formulário
     pela metade, o que foi digitado fica guardado neste aparelho (só para a mesma pessoa, por 24 horas)
     e volta quando ela abrir o mesmo formulário. Senha e arquivo nunca são guardados. */
  const RASC_VALIDADE = 24 * 60 * 60 * 1000;
  const chaveRasc = () => 'mq-rascunho-painel-' + (S.eu && S.eu.id);
  const registroDoPainel = () => (S.painel && (S.painel.id || (S.painel.dados && S.painel.dados.id))) || null;   // ficha A não volta na ficha B
  function guardarRascunhoPainel() {
    const f = $('#painel form[data-form]'); if (!f || !S.eu || !S.painel) return;
    const campos = {}; let algum = false;
    f.querySelectorAll('input,select,textarea').forEach(i => {
      if (/^(password|file|hidden|submit|button)$/.test(i.type)) return;
      const k = i.type === 'radio' ? (i.name ? 'r:' + i.name + '=' + i.value : null) : i.id ? 'i:' + i.id : null; if (!k) return;
      const v = (i.type === 'checkbox' || i.type === 'radio') ? (i.checked ? '1' : '') : i.value;
      campos[k] = v; if (v && i.type !== 'checkbox' && i.type !== 'radio' && i.tagName !== 'SELECT') algum = true;
    });
    if (!algum) return;
    try { localStorage.setItem(chaveRasc(), JSON.stringify({ tipo: S.painel.tipo, id: registroDoPainel(), form: f.dataset.form, campos, em: Date.now() })); } catch (e) {}
  }
  function restaurarRascunhoPainel(el) {
    let r; try { r = JSON.parse(localStorage.getItem(chaveRasc()) || 'null'); } catch (e) { r = null; }
    if (!r) return;
    if (Date.now() - r.em > RASC_VALIDADE) { try { localStorage.removeItem(chaveRasc()); } catch (e) {} return; }
    const f = el.querySelector(`form[data-form="${r.form}"]`);
    if (!f || r.tipo !== S.painel.tipo || (r.id || null) !== registroDoPainel()) return;
    const limpo = x => String(x).replace(/["\\]/g, '');
    Object.keys(r.campos).forEach(k => {
      const m = /^r:(.*)=(.*)$/.exec(k);
      const i = m ? f.querySelector(`input[type=radio][name="${limpo(m[1])}"][value="${limpo(m[2])}"]`) : f.querySelector(`[id="${limpo(k.slice(2))}"]`);
      if (!i) return; const id = k;
      if (i.type === 'checkbox' || i.type === 'radio') { if (i.type === 'checkbox' || r.campos[id] === '1') i.checked = r.campos[id] === '1'; } else i.value = r.campos[id];
      if (i.tagName === 'SELECT' || i.type === 'checkbox' || (i.type === 'radio' && i.checked)) i.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const nota = document.createElement('p'); nota.className = 'aviso rascunho-volta'; nota.setAttribute('role', 'status');
    nota.textContent = 'Recuperamos o que você tinha digitado antes de o sistema sair sozinho. Confira e salve.';
    f.prepend(nota);
    try { localStorage.removeItem(chaveRasc()); } catch (e) {}
  }
  function desenharPainel() {
    let el = $('#painel');
    if (!el) { el = document.createElement('div'); el.id = 'painel'; document.body.appendChild(el); }
    const p = S.painel;
    const corpo = p.tipo === 'roteiro' && MQ.roteiroUI ? MQ.roteiroUI.painel(p) : p.tipo === 'ajuda' ? MQ.ajudaUI.painel(p) : p.tipo === 'meus-dados' ? painelMeusDados() : /^pend/.test(p.tipo) ? MQ.pendUI.painel(p) : /^aval-/.test(p.tipo) ? MQ.impactoUI.painel(p) : /^pag-/.test(p.tipo) ? MQ.pagUI.painel(p) : /^viag-/.test(p.tipo) && MQ.viagUI ? MQ.viagUI.painel(p) : /^doc-/.test(p.tipo) && MQ.docsUI ? MQ.docsUI.painel(p) : /^exec-/.test(p.tipo) && MQ.execUI ? MQ.execUI.painel(p) : /^fic-/.test(p.tipo) ? MQ.ficUI.painel(p) : /^enc-/.test(p.tipo) && MQ.encUI ? MQ.encUI.painel(p) : /^agua-/.test(p.tipo) && MQ.aguaUI ? MQ.aguaUI.painel(p) : p.tipo === 'pre-ver' ? MQ.convitesUI.painel(p) : /^ficha/.test(p.tipo) ? MQ.fichasUI.painel(p) : /^(visita|diag)/.test(p.tipo) ? MQ.campoUI.painel(p) : p.tipo === 'cadastro' ? painelCadastro(p) : painelDetalhe(p);
    el.innerHTML = `<div class="fundo" data-acao="fechar"></div><aside class="painel${/^(ficha|diag|aval)-(form|ver)$/.test(p.tipo) ? ' largo' : ''}" role="dialog" aria-modal="true" aria-labelledby="painel-t">${corpo}</aside>`;   // formulários longos do campo: painel mais largo
    restaurarRascunhoPainel(el);
    // questionário de campo: opção de imprimir em branco para aplicar no papel (só para quem preenche)
    if (MQ.imprimirUI) { const fm = el.querySelector('.painel-corpo > form[data-form]'); const b = fm && MQ.imprimirUI.barra(fm); if (b) fm.insertAdjacentHTML('beforebegin', b); }
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
      const b = MQ.bancoUI.informou(m.id); if (b) linhas.push(['Conta para a FUNCERN', m.cadastro_arlo ? 'Já está no Arlo (não precisa informar)' : b.ok ? 'Informada por ela' + (b.em ? ' em ' + new Date(b.em).toLocaleDateString('pt-BR') : '') : 'Ainda não informou']);
    }
    if (pv) linhas.push(['Nascimento', pv.data_nascimento && R.fmtData(pv.data_nascimento)], ['PIS/NIS', pv.nis], ['Endereço', MQ.convitesUI.textoEndereco(pv.endereco)],
      ['Socioeconômico', pv.socioeconomico ? 'Respondido' : null],
      ['Leitura do guia', MQ.entregasUI && gestao ? MQ.entregasUI.cienciaDe(m.id, m.papel) : null],
      ['Perfil no campo', MQ.convitesUI && MQ.convitesUI.temPerfil(m.papel) ? (MQ.convitesUI.resumoPerfil(pv.perfil) || 'Não respondido') : null]);
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
          ${editaDados ? `<div class="acoes"><button class="btn" data-acao="editar" data-id="${m.id}">Editar</button><button class="btn perigo" data-acao="desligar-abrir">Desligar</button></div>` : ''}
          </div>

        <form class="bloco" data-form="desligar" data-id="${m.id}" hidden novalidate>
          <h3>Desligar ${esc(nomeDe(m).split(' ')[0])}</h3>
          ${(() => { const vp = (S.visitas || []).filter(v => v.executor_id === m.id && v.situacao === 'prevista').length;
              const dv = (S.diagnosticos || []).filter(x => x.executor_id === m.id && x.situacao === 'devolvido').length;
              return vp || dv ? `<div class="aviso erro"><b>Ainda não dá para desligar.</b> ${vp ? vp + ' visita' + (vp > 1 ? 's' : '') + ' agendada' + (vp > 1 ? 's' : '') + ' com ela' : ''}${vp && dv ? ' e ' : ''}${dv ? dv + ' diagnóstico' + (dv > 1 ? 's' : '') + ' devolvido' + (dv > 1 ? 's' : '') + ' para ela corrigir' : ''}. Na aba Campo, passe as visitas para outra pessoa ou cancele, e resolva os diagnósticos.</div>` : ''; })()}
          ${(() => {   // 41: professor com turma em andamento (bloqueia); pagamento em aberto (só avisa); pedidos ainda não autorizados (serão cancelados)
              const ts = m.papel === 'professor_fic' ? (S.turmas || []).filter(t => t.professor_id === m.id && (!t.fim || t.fim >= R.hoje())) : [];
              const pg = (S.solic || []).filter(x => x.equipe_id === m.id && ['solicitada', 'avalizada'].includes(x.situacao));
              const pd = (S.pedidos || []).filter(x => x.solicitante_id === m.id && ['enviado', 'devolvido', 'conferido'].includes(x.situacao));
              return (ts.length ? `<div class="aviso erro"><b>Ainda não dá para desligar.</b> É professor(a) da turma em andamento ${esc(ts.map(t => t.nome).join(', '))}. Passe a turma para outro(a) professor(a) na aba Curso FIC (Editar) e desligue depois.</div>` : '')
                + (pg.length ? `<div class="aviso"><b>${pg.length} pagamento${pg.length > 1 ? 's' : ''} em aberto</b> (${pg.map(x => (x.tipo === 'bolsa' ? 'bolsa' : 'ajuda de custo') + ' de ' + String(x.mes || '').slice(5, 7) + '/' + String(x.mes || '').slice(0, 4)).join(', ')}). O desligamento não cancela: ela tem direito a receber pelo que fez. O pedido continua até o lançamento no Arlo.</div>` : '')
                + (pd.length ? `<div class="aviso"><b>${pd.length} pedido${pd.length > 1 ? 's' : ''} de passagem ou evento ainda não autorizado${pd.length > 1 ? 's' : ''}</b> ser${pd.length > 1 ? 'ão' : 'á'} cancelado${pd.length > 1 ? 's' : ''} ao desligar, com o motivo registrado.</div>` : ''); })()}
          <p class="small muted">O cadastro não é apagado. A vaga fica livre para a substituta e o histórico guarda quem desligou, quando e por quê. Não dá para desfazer: se ela voltar, faça um novo cadastro.</p>
          <div class="campos"><div class="campo"><label for="d-data">Último dia na bolsa</label><input id="d-data" name="data_fim" type="date" min="${esc(m.data_inicio)}" value="${hoje}" required></div>
            <div class="campo"><label for="d-motivo">Motivo</label><select id="d-motivo" name="motivo" required><option value="">Escolha o motivo…</option>${MQ.MOTIVOS.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
            <div class="campo inteiro"><label for="d-det">Explique em uma frase</label><textarea id="d-det" name="detalhe" placeholder="Ex.: pediu para sair por motivo de saúde, comunicou em 20/11."></textarea></div></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn perigo cheio" type="submit">Confirmar desligamento</button><button class="btn" type="button" data-acao="desligar-cancelar">Cancelar</button></div>
        </form>

        ${linhaUltimoAcesso(m)}
        ${avisoAcesso(m, editaDados || /^coord|auxiliar_adm/.test(S.eu.papel))}
        ${plano}
        ${m.id === S.eu.id && m.papel !== 'coord_geral' && !m.cadastro_arlo && MQ.bancoUI ? MQ.bancoUI.secaoMinha() : ''}
        ${m.id !== S.eu.id && MQ.bancoUI ? MQ.bancoUI.blocoContaArlo(m) : ''}

        <div class="bloco"><h3>Habilitação</h3>${m.papel === 'coord_geral' ? '<p class="small muted">Não se aplica.</p>' : passos(m)}
          ${editaHab && m.papel !== 'coord_geral' ? formHabilitacao(m) : ''}</div>
      </div>`;
  }

  /* pedidos de "Esqueci a senha" feitos na tela de entrada (28_pedido_novo_acesso.sql): só a coordenação geral */
  const pedidoAcessoDe = id => (S.pedidosAcesso || []).find(p => p.equipe_id === id);
  const quandoPediu = p => new Date(p.pedido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + (p.vezes > 1 ? ` · pediu ${p.vezes} vezes` : '');
  function secaoPedidosAcesso() {
    const l = (S.pedidosAcesso || []).map(p => [p, porId(p.equipe_id)]).filter(([, m]) => m);
    if (S.eu.papel !== 'coord_geral' || !l.length) return '';
    return `<section class="secao" aria-labelledby="t-acesso"><div class="secao-cab"><div><h2 id="t-acesso">Pedidos de novo acesso <span class="conta-t">${l.length}</span></h2>
        <p>Pessoas que tocaram em "Esqueci a senha". Abra a ficha, toque em <b>Liberar novo primeiro acesso</b> e mande o código pelo WhatsApp do cadastro. Se não foi a própria pessoa que pediu (ela não sabe do pedido), descarte.</p></div></div>
      <div class="lista-fichas">${l.map(([p, m]) => `<div class="vagabtn ficha-linha pedido-acesso">
          <span class="nm">${esc(nomeDe(m))}</span><span class="small muted">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(m.uf) : ''} · pediu em ${quandoPediu(p)}</span>
          <span class="acoes"><button type="button" class="btn peq" data-acao="ver" data-id="${esc(m.id)}">Ver detalhes</button>
            <button type="button" class="btn peq perigo" data-acao="acesso-descartar" data-id="${esc(p.id)}">Descartar</button></span></div>`).join('')}</div></section>`;
  }
  /* a pessoa só entra no sistema quando alguém avisa: o sistema não manda e-mail */
  function avisoAcesso(m, pode) {
    if (!pode || m.status !== 'ativa' || m.id === S.eu.id) return '';
    const gera = R.podeCadastrar(S.eu.papel, m.papel);
    if (m.user_id) {   // já tem senha: só a coordenação geral libera um novo primeiro acesso (esqueceu a senha)
      if (S.eu.papel !== 'coord_geral' || !gera) return '';
      const conf = S.confirmaAcesso === m.id; const ped = pedidoAcessoDe(m.id);
      return `<div class="bloco aviso-acesso"><h3>Esqueceu a senha?</h3>
        ${ped ? `<div class="aviso">Ela pediu novo acesso na tela de entrada em ${quandoPediu(ped)}.</div>` : ''}
        <p class="small muted">Libere um novo primeiro acesso: a senha atual deixa de valer e sai um código novo para ${esc(nomeDe(m).split(' ')[0])} criar outra senha. Os dados dela não mudam.</p>
        <div class="acoes"><button class="btn${conf ? ' pri' : ''}" type="button" data-acao="gerar-codigo" data-id="${esc(m.id)}"${conf ? ' data-ok="1"' : ''}>${conf ? 'Confirmar: apagar a senha atual' : 'Liberar novo primeiro acesso'}</button>
        ${conf ? '<button class="btn" type="button" data-acao="gerar-codigo-nao">Cancelar</button>' : ''}</div></div>`;
    }
    const cod = (S.codigos || {})[m.id];
    const pedNovo = pedidoAcessoDe(m.id);
    if (!cod) return `<div class="bloco aviso-acesso"><h3>Avisar o acesso</h3>${pedNovo ? `<div class="aviso">Ela pediu acesso na tela de entrada em ${quandoPediu(pedNovo)}: gere o código e mande para ela.</div>` : ''}
      <p class="small muted">Ela ainda não entrou. Para criar a senha, ela precisa de um <b>código de acesso</b> junto com o e-mail. É isso que impede outra pessoa de entrar no lugar dela.</p>
      ${gera ? `<div class="acoes"><button class="btn pri" type="button" data-acao="gerar-codigo" data-id="${esc(m.id)}">Gerar código de acesso</button></div>
      <p class="small muted">O código vale 7 dias e uma vez só. Se ela perder, gere outro (o anterior deixa de valer).</p>`
      : '<p class="small muted">Quem cadastrou esta pessoa gera o código na ficha dela.</p>'}</div>`;
    const url = location.origin + location.pathname;
    const msg = `Olá, ${nomeDe(m).split(' ')[0]}! Seu cadastro foi feito no sistema do projeto Mulheres & Quintais (${P[m.papel].nome}${m.uf ? ' · ' + m.uf : ''}).\n\nPara entrar:\n1) Abra ${url}\n2) Toque em "Primeiro acesso"\n3) E-mail: ${m.email}\n4) Código de acesso: ${cod}\n5) Crie a sua senha\n\nO código vale 7 dias e só pode ser usado uma vez. Não passe para ninguém.`;
    const fone = String(m.telefone || '').replace(/\D/g, '');
    const wa = 'https://wa.me/' + (fone.length >= 10 ? '55' + fone : '') + '?text=' + encodeURIComponent(msg);
    return `<div class="bloco aviso-acesso"><h3>Avisar o acesso</h3>
      <div class="cod-acesso"><span class="small muted">Código de acesso</span><b class="num">${esc(cod)}</b><span class="small muted">vale 7 dias · aparece só agora</span></div>
      <p class="small muted">O sistema não manda e-mail: envie esta mensagem por WhatsApp. Mande só para ela.</p>
      <textarea readonly rows="8" aria-label="Mensagem de acesso" onclick="this.select()">${esc(msg)}</textarea>
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
        ${!fic ? '' : `<div class="campo inteiro"><span class="dica">${turma ? `Matrícula no FIC registrada pelo professor na turma <b>${esc(turma.nome)}</b> (nº ${esc(mt.numero)}, ${R.fmtData(mt.matriculado_em)}).`
          : m.matricula_fic_em ? `Matrícula no FIC registrada em ${R.fmtData(m.matricula_fic_em)} (nº ${esc(m.matricula_fic_numero || '')}), ainda sem turma no sistema.` : '<b>Matrícula no FIC: aguardando.</b>'} A matrícula é registrada só pelos professores do curso, na aba Curso FIC.</span></div>`}
        ${[['h-fun', 'docs_funcern_em', 'Cadastrado no Arlo (FUNCERN) em'], ['h-ter', 'termo_assinado_em', 'Termo de compromisso assinado em']].map(([id, k, rot]) => {
          // sem data registrada: já vem com hoje (o calendário muda); se ainda não aconteceu, "Limpar" deixa em branco
          const sug = !m[k];
          return `<div class="campo"><label for="${id}">${rot}</label><div class="data-hoje"><input id="${id}" name="${k}" type="date" max="${R.hoje()}" value="${esc(m[k] || R.hoje())}"${sug ? ' data-sugerido="1"' : ''}>
            <button type="button" class="btn peq" data-acao="data-limpar" data-alvo="${id}">Limpar</button></div>
            ${sug ? '<span class="dica">Sugerido: hoje. Mude no calendário se foi outro dia. Se ainda não aconteceu, toque em Limpar.</span>' : ''}</div>`; }).join('')}
        <div class="campo inteiro"><label for="h-arq">Termo assinado (PDF ou foto)</label><input id="h-arq" name="termo" type="file" accept="application/pdf,image/*">
          <span class="dica">${m.termo_path ? 'Já enviado: ' + esc(String(m.termo_path).split('/').pop()) + '. Enviar outro substitui o link.' : 'Com assinaturas da bolsista, da coordenação técnica e da coordenação geral.'}</span></div>
        <div class="campo inteiro"><label for="h-obs">Observações</label><textarea id="h-obs" name="obs_habilitacao" placeholder="Ex.: falta comprovante de conta; Pix informado em 02/10.">${esc(m.obs_habilitacao || '')}</textarea></div>
      </div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar</button></div></form></details>`;
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
    // 33: técnica, bolsistas e agentes só com professor do FIC habilitado (a matrícula no curso depende dele)
    if (!edit && R.PRECISA_PROFESSOR.includes(m.papel) && !R.temProfessorHabilitado(S.equipe)) {
      const prof = (S.equipe || []).find(x => x.papel === 'professor_fic' && x.status === 'ativa');
      return cabP + `<div class="painel-corpo"><div class="aviso erro sem-professor"><b>Ainda não dá para cadastrar.</b> ${esc(R.MSG_SEM_PROFESSOR)}</div>
        <p class="small muted">${prof ? `${esc(nomeDe(prof))} já está cadastrado(a) como professor(a): falta registrar o cadastro no Arlo e o termo assinado, na ficha dele(a).` : 'Nenhum professor do FIC cadastrado ainda. Quem cadastra professor é a coordenação geral, na aba Equipe.'}</p>
        ${prof && S.eu.papel === 'coord_geral' ? `<div class="acoes"><button class="btn" data-acao="ver" data-id="${esc(prof.id)}" aria-label="Ver detalhes de ${esc(nomeDe(prof))}">Ver detalhes</button></div>` : ''}</div>`;
    }
    // cadastro novo: primeiro escolhe como (link para a pessoa preencher ou à mão)
    if (!edit && !pre && MQ.convitesUI && p.modo !== 'manual') {
      if (p.modo === 'link') return cabP + `<div class="painel-corpo"><button type="button" class="cad-modo cad-modo-2 cad-modo-topo" data-acao="cad-modo" data-m="manual"><b>Prefere digitar os dados você mesmo?</b><span>Abra o formulário e preencha agora, sem mandar link.</span></button>${MQ.convitesUI.blocoLink(p)}</div>`;
      return cabP + `<div class="painel-corpo"><p class="muted">Como você quer fazer este cadastro?</p>
        <div class="cad-modos">
          <button class="cad-modo" data-acao="cad-modo" data-m="link" autofocus><b>Gerar link de cadastro</b>
            <span>A pessoa preenche os próprios dados pelo celular e aceita o termo de uso dos dados. Você confere e aprova. Menos digitação e menos erro.</span><em>Recomendado</em></button>
          <button class="cad-modo" data-acao="cad-modo" data-m="manual"><b>Digitar os dados agora</b>
            <span>Você digita os dados. Use quando já tem tudo em mãos ou a pessoa não tem internet.</span></button>
        </div></div>`;
    }
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${titulo}</span>
        <h2 id="painel-t">${esc(P[m.papel].nome)}${m.uf ? ' · ' + esc(nomeUF(m.uf)) : ''}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="cadastro" novalidate>
        ${!edit && !pre && MQ.convitesUI ? `<button type="button" class="cad-modo cad-modo-2 cad-modo-topo" data-acao="cad-modo" data-m="link"><b>Prefere que a pessoa preencha?</b><span>Gere um link e mande pelo WhatsApp.</span></button>` : ''}
        <div class="fixo">${m.papel === 'agente' ? '<span class="small muted">Pagamento</span><b>Ajuda de custo por visita</b>' : `<span class="small muted">Função</span><b>${esc(P[m.papel].nome)}</b>`}
          <span class="small">${P[m.papel].faz ? esc(P[m.papel].faz) : 'Planeja, coordena e acompanha a execução técnica nos 5 estados.'}</span>
          ${['professor_fic', 'auxiliar_adm'].includes(m.papel) ? '<span class="small">Habilitação: cadastro no Arlo (FUNCERN) e termo de compromisso (não se matricula no FIC).</span>' : ''}
          ${m.papel === 'agente' ? '<span class="small">Precisa estar matriculada no FIC e cadastrada na FUNCERN antes da primeira visita paga. Vê só os quintais atribuídos a ela.</span>' : ''}</div>
        ${pre ? `<div class="aviso">Dados enviados por ela pelo link em ${R.fmtData(pre._pre.enviado_em)}. Confira, complete o que falta e salve: ao salvar, o cadastro é aprovado.</div>` : ''}
        ${subst ? `<div class="aviso">Substitui <b>${esc(subst.nome)}</b>, desligada em ${R.fmtData(subst.data_fim)}. O histórico liga as duas.</div>` : ''}
        <fieldset><legend>Dados pessoais</legend><div class="campos">
          <div class="campo inteiro"><label for="c-nome">Nome completo</label><input id="c-nome" name="nome" autocomplete="name" value="${v('nome')}" ${edit ? '' : 'autofocus'} required></div>
          <div class="campo"><label for="c-cpf">CPF</label><input id="c-cpf" name="cpf" inputmode="numeric" value="${esc(R.fmtCPF(m.cpf || ''))}" ${edit ? 'readonly' : ''} placeholder="000.000.000-00" required>
            ${edit ? '<span class="dica">CPF não muda. Se estiver errado, desligue e cadastre de novo.</span>' : ''}</div>
          <div class="campo"><label for="c-fone">Celular com WhatsApp</label><input id="c-fone" name="telefone" inputmode="tel" autocomplete="tel" value="${esc(MQ.mascaras ? MQ.mascaras.fmtTel(String(m.telefone || '').replace(/\D/g, '')) : (m.telefone || ''))}" placeholder="(89) 90000-0000" required></div>
          <div class="campo inteiro"><label for="c-email">E-mail</label><input id="c-email" name="email" type="email" autocomplete="email" value="${v('email')}" required>
            <span class="dica">É o login no sistema. Nenhum e-mail é enviado: depois de salvar, mande para ela o aviso de acesso (aparece na ficha dela).</span></div>
          ${MQ.convitesUI && priv !== undefined ? '' : `<div class="campo"><label for="c-mun">Município onde mora</label><input id="c-mun" name="municipio" value="${v('municipio')}" ${bols ? 'list="lista-mun"' : 'placeholder="Município/UF"'}>
            ${bols ? `<datalist id="lista-mun">${munis.map(x => `<option value="${esc(x)}">`).join('')}</datalist><span class="dica">A lista traz os municípios do projeto técnico em ${esc(m.uf)}.</span>` : ''}</div>`}
          <div class="campo"><label for="c-siape">Matrícula SIAPE <span class="muted">(só se for servidor(a) público(a) federal)</span></label><input id="c-siape" name="siape" inputmode="numeric" value="${v('siape')}" placeholder="Deixe vazio se não for"></div>
          <div class="campo"><label for="c-org">Organização ou movimento</label><input id="c-org" name="organizacao" value="${v('organizacao')}" placeholder="${bols ? 'Ex.: MPA, associação, sindicato' : ['professor_fic', 'auxiliar_adm'].includes(m.papel) ? 'Ex.: IFRN Campus Apodi' : 'Ex.: MPA'}"></div>
        </div></fieldset>
        ${MQ.convitesUI ? (priv === undefined ? '<p class="small muted">' + MQ.ampulheta() + '</p>' : MQ.convitesUI.camposPessoais(Object.assign({ nome_social: m.nome_social, municipio: m.municipio, cadastro_arlo: p.id ? !!m.cadastro_arlo : m.cadastro_arlo }, priv || {}), false, m.papel, bols ? munis : null)) : ''}
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
        ${bols && !edit && MQ.PERFIL_BOLSISTA ? `<fieldset class="perfil-bols"><legend>Perfil da bolsista</legend>
          <p class="small muted">Antes de ${pre ? 'aprovar' : 'cadastrar'}, confira se a indicada tem este perfil (Guia das bolsistas, item 3).</p>
          <p class="perfil-esp"><b>${esc(P[m.papel].nome)}:</b> ${esc(MQ.PERFIL_BOLSISTA[m.papel] || '')}</p>
          <ul class="perfil-lista">${MQ.PERFIL_BOLSISTA.todas.map(t => `<li>${esc(t)}</li>`).join('')}</ul></fieldset>` : ''}
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
      if (a === 'lembrete-ok') { MQ.lembreteUI.dispensar(el.dataset.id); render(); return; }
      if (a === 'perfil' && el.dataset.p === 'entrada') { S.verEntrada = true; S.painel = null; render(); window.scrollTo(0, 0); }
      else if (a === 'perfil') { S.verEntrada = false; S.avisoLogin = null; if (MQ.sessao) MQ.sessao.tocar(true); S.aba = null; lembrarAba(); S.painel = null; const f = $('#painel'); if (f) f.remove(); S.eu = await S.api.trocarPerfil(el.dataset.p); marcarAbriu(); registrarAcesso('entrada'); await carregar(); render(); }
      else if (a === 'recomecar') { S.painel = null; const f = $('#painel'); if (f) f.remove(); S.eu = await S.api.recomecar(); await carregar(); render(); toast('Demonstração recomeçada com os dados de exemplo.'); }
      else if (a === 'gerar-codigo-nao') { S.confirmaAcesso = null; abrirPainel(S.painel); }
      else if (a === 'acesso-descartar') {
        await S.api.descartarPedidoAcesso(el.dataset.id); await carregar(); render(); toast('Pedido descartado.');
      }
      else if (a === 'gerar-codigo') {
        const m = porId(el.dataset.id); if (!m) return;
        if (m.user_id && !el.dataset.ok) { S.confirmaAcesso = m.id; abrirPainel(S.painel); return; }
        el.disabled = true;
        try {
          const c = await S.api.gerarCodigoAcesso(m.id);
          S.codigos = Object.assign({}, S.codigos, { [m.id]: c }); S.confirmaAcesso = null;
          if (m.user_id) { m.user_id = null; toast('Senha antiga apagada. Mande o código novo para ' + nomeDe(m).split(' ')[0] + '.'); }
          abrirPainel(S.painel);
        } catch (e) { el.disabled = false; toast(e.message || String(e)); }
      }
      else if (a === 'data-limpar') { const i = document.getElementById(el.dataset.alvo); if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); } }
      else if (a === 'cad-modo') {
        const p = Object.assign({}, S.painel, { modo: el.dataset.m || undefined }); abrirPainel(p);
        if (p.modo === 'link' && MQ.convitesUI) {   // o link sai pronto, sem outro clique
          try { await MQ.convitesUI.gerarLink(p); } catch (e) { toast(e.message); abrirPainel(Object.assign({}, p, { modo: undefined })); return; }
          if (S.painel && S.painel.tipo === 'cadastro' && S.painel.modo === 'link') abrirPainel(S.painel);
        }
      }
      else if (a === 'ajuda') { if (S.menuAberto) { S.menuAberto = false; render(); } S.voltarFoco = el; abrirPainel({ tipo: 'ajuda', k: el.dataset.k }); }
      else if (a === 'meus-dados') { if (S.menuAberto) { S.menuAberto = false; render(); } S.voltarFoco = el; abrirPainel({ tipo: 'meus-dados' }); }
      else if (a === 'copiar-texto') { const t = el.closest('.bloco').querySelector('textarea'); try { await navigator.clipboard.writeText(t.value); toast('Mensagem copiada.'); } catch (e) { t.select(); toast('Selecione e copie a mensagem.'); } }
      else if (a === 'modo-login') {
        const em = $('#l-email'); if (em && em.value) S.emailDigitado = em.value.trim();   // leva o e-mail já digitado
        S.modoLogin = el.dataset.m; S.esqueciEnviado = false; render(); const f = $('#l-email') || $('#e-email'); if (f) f.focus(); }
      else if (a === 'sair' && !el.dataset.ok && (!navigator.onLine || (S.fila || []).length)) {
        // sem internet, não dá para entrar de novo; e o que está guardado no aparelho só sobe depois de entrar
        el.dataset.ok = '1'; el.textContent = 'Sair mesmo?';
        toast(!navigator.onLine ? 'Você está sem internet: se sair, só consegue entrar de novo quando a conexão voltar.' : (S.fila.length + (S.fila.length > 1 ? ' registros ainda estão' : ' registro ainda está') + ' só neste aparelho. Se sair, eles sobem quando você entrar de novo.'));
        setTimeout(() => { if (el.isConnected) { delete el.dataset.ok; el.textContent = 'Sair'; } }, 6000);
      }
      else if (a === 'sair') await sairDoSistema();
      else if (a === 'fechar') fecharPainel();
      else if (a === 'aba') { S.aba = el.dataset.aba; lembrarAba(); S.menuAberto = false; render(); window.scrollTo(0, 0); digitouEm = 0; atualizarEmSegundoPlano(); }
      else if (/^ficha/.test(a) && MQ.fichasUI) { S.voltarFoco = el; await MQ.fichasUI.clique(a, el); }
      else if (/^apl-/.test(a) && MQ.sugestaoUI) await MQ.sugestaoUI.clique(a, el);
      else if (/^banco-/.test(a) && MQ.bancoUI) await MQ.bancoUI.clique(a, el);
      else if (/^pend-/.test(a) && MQ.pendUI) { S.voltarFoco = el; await MQ.pendUI.clique(a, el); }
      else if (/^conv-/.test(a) && MQ.convitesUI) await MQ.convitesUI.clique(a, el);
      else if (/^custo-/.test(a) && MQ.custosUI) await MQ.custosUI.clique(a, el);
      else if (/^fic-/.test(a) && MQ.ficUI) { S.voltarFoco = el; await MQ.ficUI.clique(a, el); }
      else if (/^pag-/.test(a) && MQ.pagUI) { S.voltarFoco = el; await MQ.pagUI.clique(a, el); }
      else if (/^enc-/.test(a) && MQ.encUI) { if (/^enc-(novo|editar)$/.test(a)) S.voltarFoco = el; await MQ.encUI.clique(a, el); }
      else if (/^exec-/.test(a) && MQ.execUI) { S.voltarFoco = el; await MQ.execUI.clique(a, el); }
      else if (/^agua-/.test(a) && MQ.aguaUI) { S.voltarFoco = el; await MQ.aguaUI.clique(a, el); }
      else if (/^doc-/.test(a) && MQ.docsUI) { if (!/^doc-rel-/.test(a)) S.voltarFoco = el; await MQ.docsUI.clique(a, el); }
      else if (/^viag-/.test(a) && MQ.viagUI) { if (!/pass$/.test(a)) S.voltarFoco = el; await MQ.viagUI.clique(a, el); }
      else if (/^(aval|imp)-/.test(a) && MQ.impactoUI) { S.voltarFoco = el; await MQ.impactoUI.clique(a, el); }
      else if (/^vit-/.test(a) && MQ.vitrineUI) await MQ.vitrineUI.clique(a, el);
      else if (/^ent-/.test(a) && MQ.entregasUI) await MQ.entregasUI.clique(a, el);
      else if (/^rot-/.test(a) && MQ.roteiroUI) { S.voltarFoco = null; await MQ.roteiroUI.clique(a, el); }
      else if (/^campo-/.test(a) && MQ.campoUI) { S.voltarFoco = el; await MQ.campoUI.clique(a, el); }
      else if (a === 'ver') { S.voltarFoco = el; abrirPainel({ tipo: 'detalhe', id: el.dataset.id }); }
      else if (a === 'ir') { const t = document.querySelector(el.dataset.alvo); if (t) { const sec = t.closest('section, .bloco') || t; sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }
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
    // CPF e telefone: a máscara (com o cursor no lugar certo) é do mascaras.js
    const c = t.closest && t.closest('.campo.tem-erro, .check.tem-erro, .criterio.tem-erro');   // some o aviso do campo assim que a pessoa corrige
    if (c) { c.classList.remove('tem-erro'); const e = c.querySelector('.erro'); if (e) e.remove(); }
  });

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('form[data-form]'); if (!form) return;
    ev.preventDefault();
    const tipo = form.dataset.form;
    const fd = new FormData(form);
    try {
      if (tipo === 'trocar-senha') {
        const atual = String(fd.get('atual') || ''), nova = String(fd.get('nova') || ''), nova2 = String(fd.get('nova2') || '');
        const e = {};
        if (!atual) e.atual = 'Digite a senha que você usa hoje.';
        if (nova.length < 8) e.nova = 'Pelo menos 8 caracteres.'; else if (!(/[a-zA-Z]/.test(nova) && /\d/.test(nova))) e.nova = 'Misture letras e números.';
        else if (nova === atual) e.nova = 'A nova senha precisa ser diferente da atual.';
        if (!e.nova && nova !== nova2) e.nova2 = 'As duas senhas não são iguais.';
        if (Object.keys(e).length) return mostrarErros(form, e);
        await ocupado(form, async () => { await S.api.trocarSenha(atual, nova); registrarAcesso('senha_trocada'); form.reset(); form.closest('details').open = false; toast('Senha trocada. Use a nova senha na próxima vez que entrar.'); });
        return;
      }
      if (tipo === 'esqueci') {
        const email = String(fd.get('email') || '').trim().toLowerCase();
        if (!R.emailValido(email)) return mostrarErros(form, { email: 'Digite o e-mail do seu cadastro.' });
        await ocupado(form, async () => { await S.api.pedirNovoAcesso(email); S.emailDigitado = email; S.esqueciEnviado = true; render(); });
        return;
      }
      if (tipo === 'login') {
        const email = String(fd.get('email') || '').trim();
        const senha = String(fd.get('senha') || '');
        const erros = {};
        if (!R.emailValido(email)) erros.email = 'Digite um e-mail válido.';
        if (senha.length < 8) erros.senha = 'A senha tem pelo menos 8 caracteres.';
        else if (S.modoLogin === 'primeiro' && !(/[a-zA-Z]/.test(senha) && /\d/.test(senha))) erros.senha = 'Misture letras e números.';
        if (S.modoLogin === 'primeiro' && senha !== String(fd.get('senha2') || '')) erros.senha2 = 'As duas senhas não são iguais.';
        const codigo = String(fd.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (S.modoLogin === 'primeiro' && codigo.length !== 8) erros.codigo = 'O código tem 8 letras e números (ex.: ABCD-2345).';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        await ocupado(form, async () => {
          S.eu = S.modoLogin === 'primeiro' ? await S.api.criarSenha(email, senha, codigo) : await S.api.entrarSenha(email, senha);
          if (S.eu) { S.avisoLogin = null; if (MQ.sessao) MQ.sessao.tocar(true); marcarAbriu(); registrarAcesso(S.modoLogin === 'primeiro' ? 'primeiro_acesso' : 'entrada'); await carregar(); setTimeout(() => sincronizar(false), 500); }
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
      if (/^viag-/.test(tipo) && MQ.viagUI) await MQ.viagUI.enviar(tipo, form, fd);
      if (/^doc-/.test(tipo) && MQ.docsUI) await MQ.docsUI.enviar(tipo, form, fd);
      if (/^exec-/.test(tipo) && MQ.execUI) await MQ.execUI.enviar(tipo, form, fd);
      if (/^enc-/.test(tipo) && MQ.encUI) await MQ.encUI.enviar(tipo, form, fd);
      if (/^agua-/.test(tipo) && MQ.aguaUI) await MQ.aguaUI.enviar(tipo, form, fd);
      if (/^rot-/.test(tipo) && MQ.roteiroUI) await MQ.roteiroUI.enviar(tipo, form, fd);
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
        if (priv) { m.nome_social = priv.nome_social; m.cadastro_arlo = !!priv.cadastro_arlo; m.municipio = (priv.endereco || {}).cidade || m.municipio; }   // um campo só: o município do endereço
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
            const temAlgo = priv && (priv.data_nascimento || priv.nis || Object.keys(priv.endereco).length || priv.socioeconomico || priv.perfil);
            // a pessoa já está cadastrada: uma falha daqui em diante não pode levar a cadastrar de novo (daria "CPF já ocupa vaga")
            let falhou = '';
            try { if (temAlgo) await S.api.salvarPrivado(novo.id, priv); } catch (e) { falhou = 'os dados pessoais (nascimento, endereço, perfil) não foram salvos: abra "Editar" e salve de novo'; }
            try { if (p.pre) await S.api.decidirPreCadastro(p.pre, 'aprovado', null, novo.id); } catch (e) { falhou = falhou || 'o cadastro enviado pelo link continua na lista: recuse-o com o motivo "já cadastrada"'; }
            try { await recarregar(); } catch (e) {}
            abrirPainel({ tipo: 'detalhe', id: novo.id });
            if (falhou) { toast(nomeDe(m).split(' ')[0] + ' foi cadastrada, mas ' + falhou + '.'); return; }
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
        if (!fd.get('motivo')) erros.motivo = 'Escolha o motivo.';
        if (fd.get('motivo') === 'Outro motivo' && det.length < 5) erros.detalhe = 'Explique o motivo.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        await ocupado(form, async () => {
          await S.api.desligar(id, data, fd.get('motivo') + (det ? ': ' + det : ''));
          await recarregar(); fecharPainel(); toast(m.nome.split(' ')[0] + ' desligada. A vaga está aberta para a substituta.');
        });
      }
    } catch (e) {
      mostrarErros(form, e.campos || {}, e.original || !/fetch|network|Load failed/i.test(e.message || '') ? e.message : R.mensagemErro(e));
    }
  });

  window.addEventListener('DOMContentLoaded', boot);
})();
