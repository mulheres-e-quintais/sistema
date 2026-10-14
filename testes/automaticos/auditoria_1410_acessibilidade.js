/* Auditoria de acessibilidade (WCAG 2.2 AA) e usabilidade heurística — 14/10/2026.
   Não substitui teste com leitor de tela real nem com usuárias reais: é verificação automática + heurística.
   Uso: node testes/automaticos/auditoria_1410_acessibilidade.js <caminho do playwright> [axe.min.js] [pasta de saída] [fases]
        fases = letras de A a G (padrão: ABCDEFG)
          A axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) em todas as telas e painéis, 3 temas, 1280 e 360 px
          B teclado: foco visível, foco não encoberto pela barra fixa (2.4.11), painel prende e devolve o foco, Esc
          C títulos, rótulos, mensagens de erro ligadas aos campos e foco no 1º erro
          D alvos de toque (2.5.8, 24 px ou espaçamento)
          E refluxo a 320 px (zoom 400%) e 640 px (zoom 200%) e espaçamento de texto (1.4.12)
          F 1.4.13, 2.5.7, 3.3.8, 3.2.6, 3.3.7 e informação só por cor
          G usabilidade: tarefas representativas, contagem de passos e cliques
   Servidor de teste em http://localhost:8766 (node ferramentas/servidor_teste.js 8766). */
const { chromium } = require(process.argv[2]); const fs = require('fs'); const os = require('os'); const path = require('path');
const AXE = fs.readFileSync(process.argv[3] || '/tmp/claude-0/pw/node_modules/axe-core/axe.min.js', 'utf8');
const OUT = process.argv[4] || path.join(os.tmpdir(), 'auditoria_1410'); fs.mkdirSync(OUT, { recursive: true });
const FASES = (process.argv[5] || 'ABCDEFG').toUpperCase();
const URL = 'http://localhost:8766/';
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const reg = (fase, st, nome, det = '') => { R.push({ fase, st, nome, det: String(det).slice(0, 600) }); if (st !== 'PASSOU') console.log(`${st} | ${fase} | ${nome}${det !== '' ? ' | ' + String(det).slice(0, 300) : ''}`); };
const ok = (fase, nome, c, det) => reg(fase, c ? 'PASSOU' : 'FALHOU', nome, det);
const bloq = (fase, nome, det) => reg(fase, 'BLOQUEADO', nome, det);
const AXV = {}; const TRANS = [];   // violações agregadas: regra|alvo -> {regra, impacto, criterios, alvo, html, telas:Set}
const PERFIS = ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar', 'obs_mda', 'obs_mpa', 'entrada'];
const TEMAS = { claro: { tema: 'claro', sol: false }, escuro: { tema: 'escuro', sol: false }, sol: { tema: 'claro', sol: true } };

(async () => {
  const b = await chromium.launch();
  /* ---------- sessão: contexto + página, já no modo demonstração, com o tema pedido ---------- */
  async function sessao({ w = 1280, h = 900, tema = 'claro', toque = false, zoom = 1 } = {}) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque, deviceScaleFactor: zoom, locale: 'pt-BR', bypassCSP: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
    await ctx.route('**/fonts.g*/**', r => r.abort()); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort());
    await p.goto(URL); await p.evaluate(t => { localStorage.clear(); localStorage.setItem('mq-aparencia', JSON.stringify(t)); }, TEMAS[tema]); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(async () => { if (MQ.apiDemo && MQ.apiDemo.recomecar) await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(t => { localStorage.setItem('mq-aparencia', JSON.stringify(t)); MQ.aparencia.aplicar(); }, TEMAS[tema]);
    return { ctx, p, errs };
  }
  const entrar = async (p, pf) => { await p.evaluate(pf => { MQ.ui.fecharPainel(); const x = document.querySelector(`button[data-p=${pf}]`); x && x.click(); }, pf); await p.waitForTimeout(800);
    await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200); };
  /* o modo demonstração começa sem pedidos de pagamento: o professor pede a bolsa do mês (pela API do modo demonstração) */
  const semearPedido = async p => { if (await p.evaluate(() => (MQ.ui.S.solic || []).some(s => s.situacao === 'solicitada'))) return;
    await entrar(p, 'professor');
    await p.evaluate(async () => { const m = new Date().toISOString().slice(0, 7); await MQ.ui.S.api.solicitarPagamento('bolsa', m + '-01', 2200, 'Relatório de teste da auditoria: encontros, matrículas, acompanhamento das alunas do curso no mês.', [], { justificativa_sem_encontro: 'Sem encontro neste mês por causa da auditoria automática de acessibilidade.' }); }).catch(e => console.log('semear:', e.message)); };
  const abasDe = p => p.evaluate(() => [...new Set([...document.querySelectorAll('nav.abas [data-aba]')].map(x => x.dataset.aba))]);
  const irAba = async (p, a) => { await p.evaluate(a => { MQ.ui.fecharPainel(); MQ.ui.S.aba = a; MQ.ui.render(); window.scrollTo(0, 0); }, a); await p.waitForTimeout(350); };
  /* painéis principais: como abrir e com que perfil */
  const PAINEIS = [
    ['ficha', 'bolsista', p => p.click('[data-acao=ficha-nova]')],
    ['diagnóstico', 'bolsista', p => p.evaluate(() => { const S = MQ.ui.S; const f = S.fichas.find(x => x.resultado === 'selecionada'); document.body.insertAdjacentHTML('beforeend', `<button id="ab-aud" data-acao="campo-diag-novo" data-ficha="${f.id}"></button>`); document.getElementById('ab-aud').click(); document.getElementById('ab-aud').remove(); })],
    ['visita', 'bolsista', p => p.click('[data-acao=campo-visita-nova]')],
    ['pagamento', 'coord_geral', async p => { await semearPedido(p); await entrar(p, 'coord_geral'); await irAba(p, 'pagamentos'); await p.click('[data-acao=pag-ver]', { timeout: 4000 }); }],
    ['cadastro de equipe', 'coord_geral', async p => { await irAba(p, 'equipe'); await p.click('[data-acao=novo][data-papel=agente]'); }],
    ['meus dados', 'bolsista', p => p.click('header [data-acao=meus-dados]')],
    ['ajuda', 'bolsista', p => p.click('header [data-acao=ajuda]')],
    ['aparência', 'bolsista', p => p.click('header [data-acao=aparencia]')],
    ['relatar problema', 'bolsista', p => p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'relato-form', de: MQ.ui.S.aba }))],
    ['pendências do cadastro', 'bolsista', p => p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'pend' }))],
  ];
  const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
  async function axe(p, tela) {
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
    const rodar = () => p.evaluate(async tags => { const x = await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
      return x.violations.map(v => ({ id: v.id, impact: v.impact, tags: v.tags.filter(t => /^wcag\d{3,}$/.test(t)), help: v.help, nodes: v.nodes.map(n => ({ t: n.target.join(' '), html: n.html.slice(0, 160), msg: (n.any.concat(n.all, n.none)[0] || {}).message || '' })) })); }, TAGS);
    let v = await rodar();
    // contraste medido no meio de uma transição (painel abrindo, mapa colorindo): espera a animação acabar e mede de novo
    if (v.some(x => x.id === 'color-contrast')) { TRANS.push(tela + ': ' + v.filter(x => x.id === 'color-contrast').map(x => x.nodes.length).join('')); await p.waitForTimeout(2500); v = await rodar(); }
    v.forEach(x => x.nodes.forEach(n => { const k = x.id + '|' + n.t; (AXV[k] = AXV[k] || { regra: x.id, impacto: x.impact, criterios: x.tags.join(','), ajuda: x.help, alvo: n.t, html: n.html, msg: n.msg, telas: new Set() }).telas.add(tela); }));
    return v;
  }

  /* =========================================================== A. axe-core */
  if (FASES.includes('A')) {
    for (const tema of Object.keys(TEMAS)) for (const w of [1280, 360]) {
      const { ctx, p, errs } = await sessao({ w, h: w > 1000 ? 900 : 760, tema, toque: w < 1000 });
      for (const pf of PERFIS) {
        await entrar(p, pf);
        const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
        for (const a of abas) { if (a) await irAba(p, a);
          const tela = `${pf}${a ? '/' + a : ''} · ${tema} · ${w}px`; const v = await axe(p, tela);
          ok('A', `axe sem violações: ${tela}`, v.length === 0, v.map(x => `${x.id}(${x.impact},${x.nodes.length}): ${x.nodes[0].t}`).join(' ; ')); }
        if (pf === 'entrada') { await p.evaluate(() => { const x = document.querySelector('[data-acao=modo-login]'); x && x.click(); }); await p.waitForTimeout(300);
          const v = await axe(p, `entrada/login · ${tema} · ${w}px`); ok('A', `axe sem violações: entrada/formulário de acesso · ${tema} · ${w}px`, v.length === 0, v.map(x => `${x.id}(${x.impact}): ${x.nodes[0].t}`).join(' ; ')); }
      }
      for (const [nome, pf, abrir] of PAINEIS) {
        await entrar(p, pf);
        try { await abrir(p); await p.waitForSelector('#painel aside', { timeout: 3000 }); await p.waitForTimeout(300); } catch (e) { bloq('A', `abrir painel ${nome} (${tema}, ${w}px)`, e.message.split('\n')[0]); continue; }
        const tela = `painel ${nome} · ${tema} · ${w}px`; const v = await axe(p, tela);
        ok('A', `axe sem violações: ${tela}`, v.length === 0, v.map(x => `${x.id}(${x.impact},${x.nodes.length}): ${x.nodes[0].t}`).join(' ; '));
        await p.evaluate(() => MQ.ui.fecharPainel());
      }
      ok('A', `sem erro de JavaScript na varredura (${tema}, ${w}px)`, !errs.length, [...new Set(errs)].join(' | '));
      await ctx.close();
    }
    reg('A', 'PASSOU', `(informativo) ${TRANS.length} medições de contraste caíram no meio de uma transição de cor e foram refeitas após 2,5 s`, TRANS.slice(0, 8).join(' ; '));
    const lista = Object.values(AXV).map(x => Object.assign({}, x, { telas: [...x.telas] }));
    fs.writeFileSync(path.join(OUT, 'axe_violacoes.json'), JSON.stringify(lista, null, 1));
    console.log('\n--- axe: violações agregadas (regra | impacto | critério | alvo | nº de telas) ---');
    lista.sort((a, b) => b.telas.length - a.telas.length).forEach(x => console.log(`${x.regra} | ${x.impacto} | ${x.criterios} | ${x.alvo} | ${x.telas.length} telas | ex.: ${x.telas[0]} | ${x.msg.slice(0, 140)}`));
  }

  /* =========================================================== B. teclado */
  if (FASES.includes('B')) {
    const { ctx, p } = await sessao({ w: 1280, h: 800 });
    const focoInfo = () => p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null;
      const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
      const sombra = s.boxShadow && s.boxShadow !== 'none';
      // barra de cima fixa: o elemento com foco fica inteiro escondido atrás dela? (2.4.11)
      const fixos = [...document.querySelectorAll('header, .barra, [class*=fix], nav, .rodape, .acoes')].filter(x => { const c = getComputedStyle(x); return (c.position === 'fixed' || c.position === 'sticky') && !x.contains(e) && x.offsetParent !== undefined; });
      let encoberto = false, quem = '';
      for (const f of fixos) { const q = f.getBoundingClientRect(); if (q.height < 1) continue; if (r.top >= q.top - 0.5 && r.bottom <= q.bottom + 0.5 && r.left >= q.left - 0.5 && r.right <= q.right + 0.5) { encoberto = true; quem = f.className || f.tagName; } }
      const fora = r.bottom < 0 || r.top > innerHeight;
      return { k: (e.dataset.acao || e.dataset.aba || e.id || e.tagName) + '|' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), visivel: outline || sombra, outline: s.outlineStyle + ' ' + s.outlineWidth, encoberto, quem, fora, noPainel: !!e.closest('#painel') }; });
    const percorrer = async (rot, n) => { await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.removeAttribute('tabindex'); });
      const semFoco = [], cobertos = [], vistos = new Set();
      for (let i = 0; i < n; i++) { await p.keyboard.press('Tab'); const f = await focoInfo(); if (!f) continue; if (vistos.has(f.k) && i > 5) break; vistos.add(f.k);
        if (!f.visivel) semFoco.push(f.k + ' [' + f.outline + ']'); if (f.encoberto) cobertos.push(f.k + ' sob ' + f.quem); }
      ok('B', `${rot}: todo controle alcançado pelo Tab mostra o foco (2.4.7)`, !semFoco.length, `${vistos.size} paradas; sem foco visível: ` + semFoco.slice(0, 6).join(' ; '));
      ok('B', `${rot}: foco nunca fica inteiro escondido atrás da barra fixa (2.4.11)`, !cobertos.length, cobertos.slice(0, 6).join(' ; ')); };
    for (const pf of PERFIS.filter(x => x !== 'entrada')) { await entrar(p, pf);
      const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
      for (const a of abas) { if (a) await irAba(p, a); await percorrer(`${pf}${a ? '/' + a : ''}`, 120); } }
    // modais: abrir pelo teclado (Enter), foco entra, Tab preso, Esc fecha, foco volta ao botão
    const MODAIS = [['ficha', 'bolsista', '[data-acao=ficha-nova]'], ['visita', 'bolsista', '[data-acao=campo-visita-nova]'], ['meus dados', 'bolsista', 'header [data-acao=meus-dados]'],
      ['ajuda', 'bolsista', 'header [data-acao=ajuda]'], ['aparência', 'bolsista', 'header [data-acao=aparencia]'], ['diagnóstico (agente)', 'agente', '[data-acao=campo-diag-novo]'],
      ['pagamento', 'coord_geral', '[data-acao=pag-ver]', 'pagamentos', true], ['cadastro de equipe', 'coord_geral', '[data-acao=novo][data-papel=agente]', 'equipe'], ['ficha (técnica)', 'coord_tecnico', '[data-acao=ficha-ver]', 'selecao']];
    for (const [nome, pf, sel, aba, sem] of MODAIS) { if (sem) await semearPedido(p); await entrar(p, pf); if (aba) await irAba(p, aba);
      const tem = await p.$(sel); if (!tem) { bloq('B', `modal ${nome}: botão ${sel} não encontrado`); continue; }
      await p.focus(sel); const abridor = await p.evaluate(() => document.activeElement.outerHTML.slice(0, 80)); await p.keyboard.press('Enter'); await p.waitForTimeout(450);
      const dentro = await p.evaluate(() => !!document.activeElement.closest('#painel aside'));
      ok('B', `modal ${nome}: ao abrir, o foco vai para dentro do painel`, dentro, await p.evaluate(() => document.activeElement.outerHTML.slice(0, 100)));
      const papel = await p.evaluate(() => { const a = document.querySelector('#painel aside'); const t = a && document.getElementById(a.getAttribute('aria-labelledby')); return { role: a && a.getAttribute('role'), modal: a && a.getAttribute('aria-modal'), nome: t && t.textContent.trim(), inert: document.getElementById('app').hasAttribute('inert') }; });
      ok('B', `modal ${nome}: role=dialog, aria-modal e nome acessível; fundo inerte`, papel.role === 'dialog' && papel.modal === 'true' && !!papel.nome && papel.inert, JSON.stringify(papel));
      let fugiu = 0; for (let i = 0; i < 80; i++) { await p.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab'); if (!(await p.evaluate(() => !!document.activeElement.closest('#painel')))) fugiu++; }
      ok('B', `modal ${nome}: Tab/Shift+Tab não escapam do painel (80 teclas)`, fugiu === 0, 'escapou ' + fugiu + ' vezes');
      const semFoco = []; for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); const f = await focoInfo(); if (f && !f.visivel) semFoco.push(f.k); }
      ok('B', `modal ${nome}: foco visível em todos os controles do painel`, !semFoco.length, [...new Set(semFoco)].slice(0, 5).join(' ; '));
      await p.keyboard.press('Escape'); await p.waitForTimeout(350);
      const pergunta = await p.$('#painel .confirma-sair'); if (pergunta) { await p.keyboard.press('Escape'); await p.waitForTimeout(200); if (await p.$('#painel .confirma-sair')) { await p.click('[data-acao=painel-sair]'); } await p.waitForTimeout(300); }
      const fechou = !(await p.$('#painel aside'));
      ok('B', `modal ${nome}: Esc fecha o painel`, fechou);
      const volta = await p.evaluate(() => document.activeElement.outerHTML.slice(0, 80));
      ok('B', `modal ${nome}: foco volta ao botão que abriu`, fechou && volta === abridor, 'abridor=' + abridor + ' foco=' + volta);
    }
    // "Sair sem salvar?": pergunta é alertdialog com foco preso
    await entrar(p, 'bolsista'); await p.click('[data-acao=ficha-nova]'); await p.waitForTimeout(300); await p.fill('#painel input[name=nome]', 'Teste Auditoria'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const cs = await p.evaluate(() => { const c = document.querySelector('#painel .confirma-sair'); return c && { role: c.getAttribute('role'), foco: document.activeElement.dataset.acao }; });
    ok('B', 'ficha alterada + Esc: pergunta "Sair sem salvar?" (alertdialog) com foco em "Continuar preenchendo"', cs && cs.role === 'alertdialog' && cs.foco === 'painel-ficar', JSON.stringify(cs));
    let fug = 0; for (let i = 0; i < 10; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement.closest('.confirma-sair')))) fug++; }
    ok('B', '"Sair sem salvar?": Tab fica entre os 2 botões', fug === 0, String(fug));
    await p.evaluate(() => MQ.ui.fecharPainel());
    // tela de entrada (sem login)
    await entrar(p, 'entrada'); await percorrer('tela de entrada', 80);
    await ctx.close();
  }

  /* =========================================================== C. títulos, rótulos, erros */
  if (FASES.includes('C')) {
    const { ctx, p } = await sessao({ w: 1280, h: 900 });
    const titulos = () => p.evaluate(() => { const vis = e => !!(e.offsetWidth || e.offsetHeight); const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter(h => vis(h) && !h.closest('[inert],#painel')).map(h => +(h.getAttribute('aria-level') || h.tagName[1]));
      return { hs, um: hs.filter(x => x === 1).length, pulo: hs.findIndex((x, i) => i > 0 && x - hs[i - 1] > 1), vazio: [...document.querySelectorAll('h1,h2,h3,h4')].filter(h => vis(h) && !h.textContent.trim() && !h.getAttribute('aria-label')).length }; });
    for (const pf of PERFIS) { await entrar(p, pf); const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
      for (const a of abas) { if (a) await irAba(p, a); const t = await titulos(); const rot = `${pf}${a ? '/' + a : ''}`;
        ok('C', `${rot}: exatamente um h1`, t.um === 1, t.hs.join(''));
        ok('C', `${rot}: títulos sem pular nível (1.3.1)`, t.pulo < 0, 'sequência ' + t.hs.join('') + ' pulo na posição ' + t.pulo);
        ok('C', `${rot}: nenhum título vazio`, t.vazio === 0, String(t.vazio)); } }
    // painéis: título do diálogo é h2 e níveis internos sem pulo; todo campo com nome acessível; obrigatórios sinalizados
    for (const [nome, pf, abrir] of PAINEIS) { await entrar(p, pf); try { await abrir(p); await p.waitForSelector('#painel aside', { timeout: 3000 }); await p.waitForTimeout(250); } catch (e) { bloq('C', `painel ${nome}`, e.message.split('\n')[0]); continue; }
      const r = await p.evaluate(() => { const a = document.querySelector('#painel aside'); const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
        const hs = [...a.querySelectorAll('h1,h2,h3,h4,h5')].filter(vis).map(h => +h.tagName[1]);
        const semNome = [...a.querySelectorAll('input,select,textarea')].filter(i => i.type !== 'hidden' && vis(i)).filter(i => { const lb = (i.labels && [...i.labels].map(l => l.textContent).join('').trim()) || i.getAttribute('aria-label') || (i.getAttribute('aria-labelledby') || '').split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join('').trim() || i.title; return !lb; }).map(i => i.name || i.id || i.type);
        const req = [...a.querySelectorAll('[required]')].filter(vis); const reqSemMarca = req.filter(i => { const l = i.labels && i.labels[0]; return !(l && /\*|obrigat/i.test(l.textContent)) && i.getAttribute('aria-required') !== 'true' && !i.required; }).length;
        const marcas = [...a.querySelectorAll('label, legend')].filter(l => /\*|obrigat/i.test(l.textContent)).length;
        const legenda = /\*\s*(=|:)?\s*obrigat|campos? obrigat|obrigatório/i.test(a.innerText);
        return { hs, pulo: hs.findIndex((x, i) => i > 0 && x - hs[i - 1] > 1), semNome, req: req.length, reqSemMarca, marcas, legenda, campos: a.querySelectorAll('input:not([type=hidden]),select,textarea').length }; });
      const grupos = await p.evaluate(() => { const a = document.querySelector('#painel aside'); const nomes = [...new Set([...a.querySelectorAll('input[type=radio]')].filter(i => i.offsetParent || (i.labels[0] && i.labels[0].offsetParent)).map(i => i.name))];
        const sem = nomes.filter(n => { const rs = [...a.querySelectorAll(`input[type=radio][name="${n}"]`)]; const g = rs[0].closest('[role=radiogroup],fieldset');
          if (!g) return true; const outros = new Set([...g.querySelectorAll('input[type=radio]')].map(i => i.name)); const nomeG = g.getAttribute('aria-label') || (g.getAttribute('aria-labelledby') && (document.getElementById(g.getAttribute('aria-labelledby')) || {}).textContent) || (g.querySelector('legend') || {}).textContent || '';
          return outros.size > 1 || !nomeG.trim(); });
        return { total: nomes.length, sem }; });
      if (grupos.total) ok('C', `painel ${nome}: cada grupo de opções (Sim/Não etc.) tem a pergunta como nome do grupo — fieldset/legend ou role=radiogroup+aria-labelledby (1.3.1)`, !grupos.sem.length, `${grupos.sem.length} de ${grupos.total} grupos sem a pergunta associada: ` + grupos.sem.slice(0, 8).join(', '));
      ok('C', `painel ${nome}: títulos internos sem pular nível`, r.pulo < 0, r.hs.join(''));
      ok('C', `painel ${nome}: todo campo visível tem nome acessível (1.3.1/4.1.2)`, !r.semNome.length, r.semNome.join(', '));
      if (r.campos > 2) ok('C', `painel ${nome}: campos obrigatórios sinalizados no rótulo (3.3.2) — ${r.req} com required, ${r.marcas} rótulos marcados`, r.req > 0 ? r.marcas >= r.req : r.marcas > 0 || !r.legenda, JSON.stringify({ req: r.req, marcas: r.marcas, campos: r.campos }));
      await p.evaluate(() => MQ.ui.fecharPainel()); }
    // erros: ficha vazia enviada
    await entrar(p, 'bolsista'); await p.click('[data-acao=ficha-nova]'); await p.waitForTimeout(400);
    await p.evaluate(() => { const f = document.querySelector('form[data-form=ficha]'); const bt = f.querySelector('button[type=submit]') || [...f.querySelectorAll('button')].pop(); bt.click(); }); await p.waitForTimeout(600);
    const er = await p.evaluate(() => { const f = document.querySelector('form[data-form=ficha]'); const inv = [...f.querySelectorAll('[aria-invalid=true]')];
      const ligados = inv.filter(i => (i.getAttribute('aria-describedby') || '').split(' ').some(id => { const d = document.getElementById(id); return d && d.textContent.trim(); }));
      const box = f.querySelector('[data-erro]'); const a = document.activeElement;
      return { inv: inv.length, ligados: ligados.length, foco: a.name || a.id || a.className, focoInv: a.getAttribute('aria-invalid') === 'true' || !!(box && box.contains(a)) || a === box, primeiro: inv[0] && (inv[0].name || inv[0].id), box: box && { txt: box.textContent.trim().slice(0, 120), role: box.getAttribute('role'), live: box.getAttribute('aria-live') }, visiveis: [...f.querySelectorAll('span.erro:not(.so-leitor)')].length }; });
    ok('C', 'ficha vazia: campos com erro marcados com aria-invalid', er.inv > 0, JSON.stringify(er));
    ok('C', 'ficha vazia: cada campo com erro aponta (aria-describedby) para a mensagem (3.3.1)', er.inv > 0 && er.ligados === er.inv, `${er.ligados}/${er.inv}`);
    ok('C', 'ficha vazia: foco vai para o primeiro erro ou para o resumo de erros', er.focoInv, 'foco=' + er.foco + ' primeiro=' + er.primeiro);
    const obrig = await p.evaluate(() => { const f = document.querySelector('form[data-form=ficha]'); const n = (((f.querySelector('[data-erro]') || {}).textContent || '').match(/Faltam (\d+)/) || [])[1];
      const marcados = [...f.querySelectorAll('input,select,textarea')].filter(i => i.required || i.getAttribute('aria-required') === 'true').map(i => i.name);
      const asterisco = [...f.querySelectorAll('label,legend')].filter(l => /\*|\(obrigat/i.test(l.textContent)).length; return { exigidos: +n || 0, marcados: [...new Set(marcados)], asterisco }; });
    ok('C', `ficha: campos exigidos na validação estão marcados antes do envio (required/aria-required e indicação visível) (3.3.2) — exigidos ${obrig.exigidos}, marcados ${obrig.marcados.length}, rótulos com indicação ${obrig.asterisco}`, obrig.marcados.length >= obrig.exigidos - 2 && obrig.asterisco >= obrig.exigidos - 2, JSON.stringify(obrig));
    ok('C', 'ficha vazia: resumo de erros anunciado (role=alert ou aria-live)', !!(er.box && (er.box.role === 'alert' || er.box.live)), JSON.stringify(er.box));
    await p.evaluate(() => MQ.ui.fecharPainel({}));
    // erros no diagnóstico (agente)
    await entrar(p, 'agente'); await p.click('[data-acao=campo-diag-novo]'); await p.waitForTimeout(500);
    const er2 = await p.evaluate(() => { const f = document.querySelector('#painel form'); const bt = f.querySelector('button[type=submit]'); bt && bt.click(); return !!bt; }); await p.waitForTimeout(600);
    const e2 = await p.evaluate(() => { const f = document.querySelector('#painel form'); const inv = [...f.querySelectorAll('[aria-invalid=true]')]; const a = document.activeElement;
      return { inv: inv.length, ligados: inv.filter(i => (i.getAttribute('aria-describedby') || '').split(' ').some(id => document.getElementById(id))).length, foco: (a.name || a.id || a.className).slice(0, 40), ok: a.getAttribute('aria-invalid') === 'true' || !!a.closest('[data-erro]') || a.matches('[data-erro]') || !!a.closest('.tem-erro') }; });
    ok('C', 'diagnóstico vazio: erros ligados aos campos e foco no primeiro erro', er2 && e2.inv > 0 && e2.ligados === e2.inv && e2.ok, JSON.stringify(e2));
    await p.evaluate(() => MQ.ui.fecharPainel({}));
    // idioma e título da página
    const lang = await p.evaluate(() => ({ lang: document.documentElement.lang, title: document.title }));
    ok('C', 'página com lang="pt-BR" e título (3.1.1, 2.4.2)', /^pt/.test(lang.lang) && !!lang.title, JSON.stringify(lang));
    // título da página muda com a aba (2.4.2: ajuda a saber onde está)
    await entrar(p, 'coord_geral'); const t1 = await p.title(); await irAba(p, 'pagamentos'); const t2 = await p.title();
    ok('C', 'título da janela muda conforme a aba (2.4.2, boa prática)', t1 !== t2, `"${t1}" → "${t2}"`);
    await ctx.close();
  }

  /* =========================================================== D. alvos de toque (2.5.8) */
  if (FASES.includes('D')) {
    for (const tema of ['claro', 'sol']) {
      const { ctx, p } = await sessao({ w: 360, h: 760, toque: true, tema });
      const medir = () => p.evaluate(() => {
        const vis = e => { const s = getComputedStyle(e); return (e.offsetWidth || e.offsetHeight) && s.visibility !== 'hidden' && !e.closest('[inert]') && !e.closest('[aria-hidden=true]'); };
        const raiz = document.querySelector('#painel aside') || document;
        const alvos = [...raiz.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]')].filter(vis).filter(e => !e.classList.contains('foco-guarda') && !e.classList.contains('pular'));
        const rs = alvos.map(e => { let r = e.getBoundingClientRect(); if (/^(radio|checkbox)$/.test(e.type) && e.labels && e.labels[0]) { const l = e.labels[0].getBoundingClientRect(); if (l.width * l.height > r.width * r.height) r = l; } return { e, r }; });
        const emTexto = e => e.tagName === 'A' && /^(P|LI|SPAN|SMALL|TD|DD)$/.test(e.parentElement.tagName) && e.parentElement.textContent.trim().length > e.textContent.trim().length + 15;
        const ruins = [];
        rs.forEach(({ e, r }, i) => { if (r.width >= 24 && r.height >= 24) return; if (emTexto(e)) return; if (e.labels && [...e.labels].some(l => l.contains(e))) return;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const conflito = rs.some(({ e: o, r: q }, j) => { if (j === i || o.contains(e) || e.contains(o) || (e.labels && [...e.labels].includes(o))) return false;
            const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom); return dx * dx + dy * dy < 144; });
          if (conflito) ruins.push(((e.dataset && e.dataset.acao) || e.tagName.toLowerCase() + (e.type ? ':' + e.type : '')) + '"' + (e.getAttribute('aria-label') || e.textContent || e.name || '').trim().slice(0, 22) + '" ' + Math.round(r.width) + '×' + Math.round(r.height) + ' .' + String(e.className).split(' ')[0]); });
        return { n: rs.length, ruins: [...new Set(ruins)] }; });
      for (const pf of PERFIS) { await entrar(p, pf); const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
        for (const a of abas) { if (a) await irAba(p, a); const m = await medir(); ok('D', `${pf}${a ? '/' + a : ''} (${tema}, 360 px): alvos ≥ 24 px ou espaçados (2.5.8)`, !m.ruins.length, `${m.ruins.length}/${m.n}: ` + m.ruins.slice(0, 8).join(' ; ')); } }
      for (const [nome, pf, abrir] of PAINEIS) { await entrar(p, pf); try { await abrir(p); await p.waitForSelector('#painel aside', { timeout: 3000 }); await p.waitForTimeout(250); } catch (e) { bloq('D', `painel ${nome}`, e.message.split('\n')[0]); continue; }
        const m = await medir(); ok('D', `painel ${nome} (${tema}, 360 px): alvos ≥ 24 px ou espaçados (2.5.8)`, !m.ruins.length, `${m.ruins.length}/${m.n}: ` + m.ruins.slice(0, 8).join(' ; ')); await p.evaluate(() => MQ.ui.fecharPainel()); }
      await ctx.close();
    }
  }

  /* =========================================================== E. refluxo, zoom, espaçamento de texto */
  if (FASES.includes('E')) {
    const ESPACO = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
    const cortes = () => p_.evaluate(() => { const vis = e => !!(e.offsetWidth || e.offsetHeight) && !e.closest('[inert]');
      const raiz = document.querySelector('#painel aside') || document.querySelector('main') || document.body;
      const lat = document.documentElement.scrollWidth > innerWidth + 1;
      const fora = [...raiz.querySelectorAll('button,a,input,select,h1,h2,h3,p,label,.etq,td,th')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); if (r.right <= innerWidth + 1) return false; let q = e.parentElement; while (q && q !== document.body) { const c = getComputedStyle(q); if (/(auto|scroll)/.test(c.overflowX) && q.scrollWidth > q.clientWidth) return false; q = q.parentElement; } return true; }).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '"' + e.textContent.trim().slice(0, 20) + '"');
      const soLeitor = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return (r.width <= 2 && r.height <= 2) || /rect\(0|inset\(50%/.test(c.clip + c.clipPath); };
      const cort = [...raiz.querySelectorAll('*')].filter(vis).filter(e => { const c = getComputedStyle(e); if (soLeitor(e)) return false; if (!/(hidden|clip)/.test(c.overflow + c.overflowX + c.overflowY)) return false; if (c.textOverflow === 'ellipsis') return false; if (!e.textContent.trim() || e.children.length > 3) return false; return e.scrollHeight > e.clientHeight + 3 || e.scrollWidth > e.clientWidth + 3; }).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '"' + e.textContent.trim().slice(0, 25) + '"');
      const reticencias = [...raiz.querySelectorAll('*')].filter(vis).filter(e => getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && !e.title && !e.getAttribute('aria-label') && !e.closest('button,a[href],[data-dica]')).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '"' + e.textContent.trim().slice(0, 25) + '"');
      return { lat, sw: document.documentElement.scrollWidth, fora: [...new Set(fora)], cort: [...new Set(cort)], ret: [...new Set(reticencias)] }; });
    let p_;
    for (const [w, rotZ] of [[320, 'zoom 400% / 320 px'], [640, 'zoom 200% / 640 px']]) {
      const { ctx, p } = await sessao({ w, h: w === 320 ? 640 : 800, toque: false }); p_ = p;
      for (const pf of PERFIS) { await entrar(p, pf); const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
        for (const a of abas) { if (a) await irAba(p, a); const c = await cortes(); const rot = `${pf}${a ? '/' + a : ''} (${rotZ})`;
          ok('E', `${rot}: sem rolagem horizontal e nada cortado à direita (1.4.10)`, !c.lat && !c.fora.length, `scrollWidth=${c.sw} ` + c.fora.slice(0, 5).join(' ; '));
          if (w === 320) ok('E', `${rot}: textos truncados com "…" têm o texto completo acessível`, !c.ret.length, c.ret.slice(0, 5).join(' ; ')); } }
      for (const [nome, pf, abrir] of PAINEIS) { await entrar(p, pf); try { await abrir(p); await p.waitForSelector('#painel aside', { timeout: 3000 }); await p.waitForTimeout(250); } catch (e) { bloq('E', `painel ${nome}`, e.message.split('\n')[0]); continue; }
        const c = await cortes(); ok('E', `painel ${nome} (${rotZ}): sem rolagem horizontal (1.4.10)`, !c.lat && !c.fora.length, `scrollWidth=${c.sw} ` + c.fora.slice(0, 5).join(' ; ')); await p.evaluate(() => MQ.ui.fecharPainel()); }
      await ctx.close();
    }
    // espaçamento de texto 1.4.12
    for (const w of [1280, 360]) { const { ctx, p } = await sessao({ w, h: 800, toque: w < 1000 }); p_ = p;
      for (const pf of PERFIS) { await entrar(p, pf); await p.addStyleTag({ content: ESPACO }); await p.waitForTimeout(150);
        const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
        for (const a of abas) { if (a) { await irAba(p, a); } const c = await cortes();
          ok('E', `${pf}${a ? '/' + a : ''} (${w} px) com espaçamento de texto aumentado: nada cortado nem rolagem lateral (1.4.12)`, !c.cort.length && !c.lat, (c.lat ? 'rola p/ o lado; ' : '') + c.cort.slice(0, 6).join(' ; ')); } }
      for (const [nome, pf, abrir] of PAINEIS) { await entrar(p, pf); try { await abrir(p); await p.waitForSelector('#painel aside', { timeout: 3000 }); } catch (e) { continue; } await p.addStyleTag({ content: ESPACO }); await p.waitForTimeout(200);
        const c = await cortes(); ok('E', `painel ${nome} (${w} px) com espaçamento aumentado: nada cortado (1.4.12)`, !c.cort.length && !c.lat, (c.lat ? 'rola p/ o lado; ' : '') + c.cort.slice(0, 6).join(' ; ')); await p.evaluate(() => MQ.ui.fecharPainel()); }
      await ctx.close(); }
  }

  /* =========================================================== F. critérios específicos */
  if (FASES.includes('F')) {
    const { ctx, p } = await sessao({ w: 1280, h: 800 });
    const CSS = fs.readFileSync(path.join(__dirname, '../../css/app.css'), 'utf8');
    const JS = fs.readFileSync(path.join(__dirname, '../../js/tudo.js'), 'utf8');
    // 1.4.13: conteúdo que aparece em hover também aparece em foco e some com Esc
    const hovers = [...CSS.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/g)].filter(m => /(display\s*:\s*(block|flex|grid)|visibility\s*:\s*visible|opacity\s*:\s*1)/.test(m[2])).map(m => m[1].trim());
    const semFoco = hovers.filter(s => !/focus/.test(s) && !CSS.includes(s.replace(/:hover/g, ':focus-within')) && !CSS.includes(s.replace(/:hover/g, ':focus')));
    ok('F', `1.4.13: conteúdo revelado no hover também aparece no foco (${hovers.length} regras)`, !semFoco.length, semFoco.slice(0, 5).join(' | '));
    const titulos = await (async () => { await entrar(p, 'coord_geral'); const n = {}; for (const a of await abasDe(p)) { await irAba(p, a); n[a] = await p.evaluate(() => [...document.querySelectorAll('main [title]')].filter(e => e.matches('a[href],button,input,select,summary,[tabindex]:not([tabindex="-1"]),[role=button]') && !e.getAttribute('aria-label') && !e.textContent.trim()).length); } return n; })();
    const soTitle = Object.values(titulos).reduce((a, b) => a + b, 0);
    ok('F', '1.4.13/4.1.2: nenhum controle sem texto que dependa só de title (tooltip do navegador não aparece no toque nem no teclado)', soTitle === 0, JSON.stringify(titulos));
    // 2.5.7 arrastar
    const arrasto = { draggable: (JS.match(/draggable\s*=\s*["']?true/g) || []).length, dragstart: (JS.match(/dragstart|pointermove|touchmove|mousemove/g) || []).length };
    ok('F', '2.5.7: nenhuma função exige arrastar (sem draggable/pointermove no código)', arrasto.draggable === 0 && arrasto.dragstart === 0, JSON.stringify(arrasto));
    await irAba(p, 'visao');
    const mapa = await p.evaluate(() => { const m = document.querySelector('.mapa, [class*=mapa]'); if (!m) return null; return { botoesUF: document.querySelectorAll('[data-acao=mapa-uf]').length, svgPaths: m.querySelectorAll('path').length, tab: [...m.querySelectorAll('[data-acao=mapa-uf],[data-acao=mapa-mun]')].filter(e => e.tabIndex >= 0).length }; });
    ok('F', '2.5.7/2.1.1: mapa da Visão geral escolhido por clique ou teclado (sem arrastar)', !mapa || (mapa.botoesUF > 0 && mapa.tab > 0), JSON.stringify(mapa));
    // 3.3.8 autenticação acessível
    await entrar(p, 'entrada'); await p.evaluate(() => { const x = document.querySelector('[data-acao=modo-login]'); x && x.click(); }); await p.waitForTimeout(300);
    const login = await p.evaluate(() => { const s = document.querySelector('input[type=password]'); const u = document.querySelector('input[type=email], input[name=email], input[autocomplete=username]');
      return s && { senhaAuto: s.getAttribute('autocomplete'), userAuto: u && u.getAttribute('autocomplete'), userType: u && u.type, colar: !s.onpaste && !s.hasAttribute('onpaste'), verSenha: !!document.querySelector('[data-acao=ver-senha]'), captcha: !!document.querySelector('[class*=captcha], iframe[src*=captcha], [class*=recaptcha]'), esqueci: /esqueci/i.test(document.body.innerText) }; });
    if (!login) bloq('F', '3.3.8: formulário de acesso não encontrado na tela de entrada'); else {
      const bloqueiaColar = /addEventListener\(\s*['"](paste|copy)['"][^)]*preventDefault/.test(JS) || /onpaste\s*=\s*["']return false/.test(JS);
      ok('F', '3.3.8: e-mail com autocomplete=username/email e senha com current-password (gerenciador de senhas funciona)', /username|email/.test(login.userAuto || '') && login.senhaAuto === 'current-password', JSON.stringify(login));
      ok('F', '3.3.8: colar senha permitido, sem CAPTCHA/teste cognitivo, com "mostrar senha" e "esqueci a senha"', login.colar && !bloqueiaColar && !login.captcha && login.verSenha && login.esqueci, JSON.stringify(login)); }
    // 3.2.6 ajuda consistente: mesma posição relativa em todas as telas
    const ordemAjuda = {};
    for (const pf of PERFIS.filter(x => !/^obs|entrada/.test(x))) { await entrar(p, pf); const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
      for (const a of abas) { if (a) await irAba(p, a); ordemAjuda[pf + (a ? '/' + a : '')] = await p.evaluate(() => { const h = [...document.querySelectorAll('header.barra button, header.barra a')].filter(e => e.offsetParent).map(e => e.dataset.acao || 'link'); const r = !!document.querySelector('.rodape-ajuda'); return h.join('>') + (r ? ' + rodapé' : ''); }); } }
    const formas = [...new Set(Object.values(ordemAjuda))];
    ok('F', '3.2.6: botão de ajuda na mesma ordem relativa na barra de cima e "Ajuda desta página" no rodapé em todas as telas logadas', formas.length === 1 && /ajuda/.test(formas[0]) && /rodapé/.test(formas[0]), formas.join(' || '));
    const obs = {}; for (const pf of ['obs_mda', 'obs_mpa']) { await entrar(p, pf); obs[pf] = await p.evaluate(() => ({ ajuda: !!document.querySelector('[data-acao=ajuda]') || [...document.querySelectorAll('button,a')].some(b => /como ler|ajuda/i.test(b.textContent)), contato: /contato|fale|e-mail|ajuda/i.test((document.querySelector('footer') || document.body).innerText) })); }
    ok('F', '3.2.6: telas dos observadores (MDA/MPA) têm o mesmo mecanismo de ajuda ("Como ler este painel") — contato humano é boa prática', Object.values(obs).every(x => x.ajuda || x.contato), JSON.stringify(obs));
    // 3.3.7 entrada redundante: diagnóstico e visita já trazem a mulher escolhida (não pedem de novo nome, CPF, município)
    await entrar(p, 'agente'); await p.click('[data-acao=campo-diag-novo]'); await p.waitForTimeout(500);
    const red = await p.evaluate(() => { const f = document.querySelector('#painel form'); if (!f) return null; const nomes = [...f.querySelectorAll('input,select,textarea')].map(i => i.name); return { pedeDeNovo: nomes.filter(n => /^(nome|cpf|municipio|comunidade|celular|endereco)$/.test(n)), cabecalho: (document.querySelector('#painel .painel-cab') || {}).textContent.trim().slice(0, 120) }; });
    ok('F', '3.3.7: diagnóstico não pede de novo os dados da ficha da mulher (nome, CPF, município…)', red && !red.pedeDeNovo.length, JSON.stringify(red));
    await p.evaluate(() => MQ.ui.fecharPainel({}));
    await entrar(p, 'bolsista'); await p.click('header [data-acao=meus-dados]'); await p.waitForTimeout(400);
    const md = await p.evaluate(() => { const a = document.querySelector('#painel aside'); const nomes = [...a.querySelectorAll('input,select,textarea')].map(i => i.name); const t = a.innerText; return { mostraCPF: /CPF\s*\n?\s*[\d.]{11,14}-\d{2}/.test(t), mostraEmail: /@/.test(t), pedeDeNovo: nomes.filter(n => /^(nome|cpf|email|celular|municipio)$/.test(n)) }; });
    ok('F', '3.3.7: "Meus dados" mostra o que já foi cadastrado (CPF, e-mail) sem pedir de novo', md.mostraCPF && md.mostraEmail && !md.pedeDeNovo.length, JSON.stringify(md));
    await p.evaluate(() => MQ.ui.fecharPainel({}));
    // informação só por cor: etiquetas de situação têm texto; marcadores coloridos sem texto têm nome
    const cor = {};
    for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista']) { await entrar(p, pf); const abas = /^coord/.test(pf) ? await abasDe(p) : [null];
      for (const a of abas) { if (a) await irAba(p, a); const r = await p.evaluate(() => { const vis = e => !!(e.offsetWidth || e.offsetHeight);
          return [...document.querySelectorAll('main *')].filter(e => vis(e) && e.children.length === 0 && !e.textContent.trim() && !e.closest('svg') && e.tagName !== 'IMG' && e.tagName !== 'INPUT' && e.tagName !== 'BR' && e.tagName !== 'HR' && !e.closest('[aria-hidden=true]') && !e.getAttribute('aria-label') && !e.title).filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width <= 20 && r.height <= 20 && r.width >= 6 && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && !/foco-guarda/.test(e.className) && (s.borderRadius !== '0px') && !(e.parentElement.textContent.trim()) && !/\d/.test(e.parentElement.parentElement.textContent) && !e.parentElement.closest('[aria-label],[aria-hidden=true],[role=img]'); }).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ').join('.')).slice(0, 4); });
        if (r.length) cor[pf + (a ? '/' + a : '')] = r; } }
    ok('F', '1.4.1: nenhum marcador colorido sem texto/nome visível ao leitor de tela (pontos de situação)', !Object.keys(cor).length, JSON.stringify(cor).slice(0, 500));
    // 1.4.1 links no meio do texto se distinguem sem cor (sublinhado)
    await entrar(p, 'coord_geral'); const lk = await p.evaluate(() => [...document.querySelectorAll('main p a[href], main li a[href]')].filter(a => a.offsetParent && getComputedStyle(a).textDecorationLine === 'none').length);
    ok('F', '1.4.1: links no meio do texto sublinhados', lk === 0, String(lk));
    // 2.2.1 tempo: sessão expira por inatividade? avisa antes e deixa continuar
    const sess = { aviso: /sessao-continuar/.test(JS), tempo: (JS.match(/INATIV[A-Z_]*\s*=\s*[^;,]+/) || [''])[0] };
    ok('F', '2.2.1: sessão por inatividade avisa antes e oferece "continuar"', sess.aviso, JSON.stringify(sess));
    // 2.4.1: pular para o conteúdo
    ok('F', '2.4.1: "Pular para o conteúdo" existe e é o 1º item do Tab', await p.evaluate(() => { const x = document.querySelector('.pular'); return !!x && [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(e => !e.closest('[inert]'))[0] === x; }));
    // 1.3.4 orientação: CSS não trava retrato/paisagem
    ok('F', '1.3.4: nenhuma trava de orientação no CSS/manifest', !/orientation\s*:\s*(portrait|landscape)\s*;?\s*\}/.test(CSS) && !/"orientation"\s*:\s*"(portrait|landscape)/.test(fs.readFileSync(path.join(__dirname, '../../manifest.webmanifest'), 'utf8')), (fs.readFileSync(path.join(__dirname, '../../manifest.webmanifest'), 'utf8').match(/"orientation"[^,}]*/) || [''])[0]);
    // 1.4.4 redimensionar texto: viewport sem user-scalable=no / maximum-scale
    const vp = await p.evaluate(() => (document.querySelector('meta[name=viewport]') || {}).content || '');
    ok('F', '1.4.4: viewport permite zoom (sem user-scalable=no nem maximum-scale<2)', !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp), vp);
    // 4.1.3 mensagens de status: toast em região viva
    await entrar(p, 'coord_geral'); await p.evaluate(() => MQ.ui.toast('teste de aviso')); await p.waitForTimeout(150);
    const toast = await p.evaluate(() => { const t = [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].find(e => /teste de aviso/.test(e.textContent)); return t ? (t.getAttribute('role') || '') + '/' + (t.getAttribute('aria-live') || '') : null; });
    ok('F', '4.1.3: avisos rápidos (toast) estão em região viva (role=status/aria-live)', !!toast, String(toast));
    // 2.3.3 / prefers-reduced-motion
    ok('F', '2.3.3 (AAA, informativo): CSS respeita prefers-reduced-motion', /prefers-reduced-motion/.test(CSS));
    await ctx.close();
  }

  /* =========================================================== G. usabilidade heurística */
  if (FASES.includes('G')) {
    const { ctx, p, errs } = await sessao({ w: 360, h: 760, toque: true });
    let cliques = 0, teclas = 0; const toque = async sel => { cliques++; await p.click(sel); await p.waitForTimeout(250); };
    const digita = async (sel, v) => { teclas++; await p.fill(sel, v); };
    // G1 bolsista cadastra ficha (mínimo para "Selecionada")
    await entrar(p, 'bolsista'); cliques = 0; teclas = 0;
    await toque('[data-acao=ficha-nova]');
    const antes = await p.evaluate(() => MQ.ui.S.fichas.length);
    await digita('#painel [name=nome]', 'Maria Auditoria da Silva'); await digita('#painel [name=cpf]', '52998224725'); await digita('#painel [name=data_nascimento]', '1980-05-10');
    await digita('#painel [name=celular]', '86999990000'); await digita('#painel [name=municipio]', 'Paulistana'); await digita('#painel [name=comunidade]', 'Sítio Teste');
    for (const n of ['consent_dados', 'consent_imagem', 'consent_criancas']) { cliques++; await p.check(`#painel [name=${n}]`, { force: true }).catch(() => {}); }
    await p.selectOption('#painel [name=assinatura]', 'assinatura').catch(() => {}); await digita('#painel [name=endereco]', 'Sítio Teste, s/n');
    for (const n of ['c_agricultora', 'c_maior18', 'c_espaco', 'c_agua', 'c_disponibilidade', 'c_sem_kit', 'c_sem_parentesco', 'c_casa_unica']) { cliques++; await p.check(`#painel input[name=${n}][value=sim], #painel input[name=${n}]:first-of-type`, { force: true }).catch(() => {}); }
    cliques++; await p.check('#painel [name=autodeclaracao]', { force: true }).catch(() => {});
    await p.waitForTimeout(300);
    const resOpc = await p.evaluate(() => [...document.querySelectorAll('#painel [name=resultado]')].filter(e => e.offsetParent || (e.labels[0] && e.labels[0].offsetParent)).map(e => e.value));
    cliques++; await p.check('#painel [name=resultado][value=selecionada]', { force: true }).catch(() => {});
    const fotosObrig = await p.evaluate(() => [...document.querySelectorAll('#painel input[type=file]')].map(i => i.name));
    for (const f of fotosObrig) { cliques++; await p.setInputFiles(`#painel input[name=${f}]`, { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDAgNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64') }).catch(() => {}); await p.waitForFunction(n => !/preparando/i.test((document.querySelector(`#painel input[name=${n}]`).closest('.campo') || {}).textContent || ''), f, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(800); }
    const altura = await p.evaluate(() => { const c = document.querySelector('#painel .painel-corpo'); return c ? Math.round(c.scrollHeight / innerHeight * 10) / 10 : 0; });
    cliques++; await p.evaluate(() => { const f = document.querySelector('form[data-form=ficha]'); (f.querySelector('button[type=submit]')).click(); }); await p.waitForTimeout(900);
    const fim1 = await p.evaluate(() => ({ fechou: !document.querySelector('#painel aside'), erro: ((document.querySelector('#painel [data-erro]') || {}).textContent || '').trim().slice(0, 300), n: MQ.ui.S.fichas.length }));
    ok('G', `G1 bolsista cadastra ficha: concluída (${cliques} toques, ${teclas} campos digitados, formulário com ${altura} telas de altura a 360 px; resultados oferecidos: ${resOpc.join('/')})`, fim1.fechou && fim1.n > antes, JSON.stringify(fim1));
    if (!fim1.fechou) { await p.evaluate(() => MQ.ui.fecharPainel({})); }
    // risco de perda: rascunho ao fechar o painel sem salvar
    await toque('[data-acao=ficha-nova]'); await digita('#painel [name=nome]', 'Rascunho Teste'); await p.waitForTimeout(1500);
    await p.evaluate(() => MQ.ui.pedirFechar()); await p.waitForTimeout(250); const perg = !!(await p.$('#painel .confirma-sair'));
    if (perg) await p.click('[data-acao=painel-sair]'); await p.waitForTimeout(300);
    await toque('[data-acao=ficha-nova]'); await p.waitForTimeout(400);
    const volta = await p.evaluate(() => ({ nome: (document.querySelector('#painel [name=nome]') || {}).value, oferta: !!document.querySelector('#painel .rascunho-volta, #painel .confirma-rasc') }));
    ok('G', 'G1b perda de dados: fechar ficha preenchida pergunta "Sair sem salvar?"', perg);
    reg('G', 'PASSOU', 'G1c (informativo) depois de "Sair sem salvar", reabrir a ficha: ' + (volta.oferta || volta.nome ? 'oferece o rascunho' : 'vem vazia (o descarte foi explícito)'), JSON.stringify(volta));
    await p.evaluate(() => MQ.ui.fecharPainel({}));
    // G2 técnica aprova ficha
    await entrar(p, 'coord_tecnico'); cliques = 0; await irAba(p, 'selecao'); cliques++;
    const fila = await p.evaluate(() => document.querySelectorAll('[data-acao=ficha-ver]').length);
    if (!fila) bloq('G', 'G2 técnica aprova: nenhuma ficha na lista'); else {
      await toque('[data-acao=ficha-ver]');
      const botoes = await p.evaluate(() => [...document.querySelectorAll('#painel button')].filter(b => b.offsetParent).map(b => b.textContent.trim().slice(0, 30)));
      const aprovar = await p.evaluate(() => { const b = [...document.querySelectorAll('#painel button, #painel input[type=radio]')].find(b => /aprov/i.test(b.textContent || (b.labels && b.labels[0] && b.labels[0].textContent) || b.value)); if (!b) return null; const t = (b.textContent || b.value).trim().slice(0, 30); b.click(); return t; }); cliques++; await p.waitForTimeout(500);
      let conf = await p.evaluate(() => { const b = [...document.querySelectorAll('#painel button[type=submit], .confirma-sair button.pri, #painel .acoes .btn.pri')].find(b => b.offsetParent && /aprov|confirm|salvar|registrar|enviar/i.test(b.textContent)); if (!b) return null; const t = b.textContent.trim(); b.click(); return t; }); if (conf) cliques++; await p.waitForTimeout(700);
      const st = await p.evaluate(() => ({ painel: !!document.querySelector('#painel aside'), erro: ((document.querySelector('#painel [data-erro]') || {}).textContent || '').trim().slice(0, 200), toast: ((document.querySelector('.toast') || {}).textContent || '').trim() }));
      ok('G', `G2 técnica aprova ficha: ${cliques} toques (aba Seleção → ficha → "${aprovar}" → "${conf}")`, !!aprovar && !st.erro, JSON.stringify({ botoes: botoes.slice(0, 10), st }));
      await p.evaluate(() => MQ.ui.fecharPainel({})); }
    // G3 agente registra diagnóstico com foto
    await entrar(p, 'agente'); cliques = 0; teclas = 0; await toque('[data-acao=campo-diag-novo]');
    const diag = await p.evaluate(() => { const f = document.querySelector('#painel form'); const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
      const grupos = new Set(); [...f.querySelectorAll('input,select,textarea')].filter(i => i.type !== 'hidden' && vis(i)).forEach(i => grupos.add(i.name || i.id)); return { perguntas: grupos.size, fotos: [...f.querySelectorAll('input[type=file]')].map(i => i.name), botoesFoto: [...f.querySelectorAll('[data-acao=foto-camera],[data-acao=foto-agora],[data-acao=campo-gps]')].map(b => b.dataset.acao + ':' + b.textContent.trim().slice(0, 20)), altura: Math.round(f.scrollHeight / innerHeight * 10) / 10, etapas: f.querySelectorAll('fieldset, details, .etapa, section').length, req: f.querySelectorAll('[required]').length }; });
    ok('G', `G3 agente abre diagnóstico com foto: ${diag.perguntas} perguntas, ${diag.etapas} blocos, ${diag.altura} telas de altura a 360 px; fotos: ${diag.fotos.join(',')}; botões: ${diag.botoesFoto.join(' / ')}`, diag.fotos.length > 0 || diag.botoesFoto.length > 0, JSON.stringify(diag));
    const salvarVis = await p.evaluate(() => { const b = document.querySelector('#painel button[type=submit]'); if (!b) return null; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    ok('G', 'G3b diagnóstico: botão de salvar sempre à vista no celular (sem rolar até o fim)', salvarVis, String(salvarVis));
    const rasc = /rascunho/i.test(await p.evaluate(() => document.querySelector('#painel').innerText)) || await p.evaluate(() => Object.keys(localStorage).some(k => /rasc/i.test(k)));
    await digita('#painel textarea', 'teste de rascunho'); await p.waitForTimeout(2500);
    const guardou = await p.evaluate(() => Object.keys(localStorage).filter(k => /rasc/i.test(k)).length + Object.keys(sessionStorage).filter(k => /rasc/i.test(k)).length);
    reg('G', guardou > 0 ? 'PASSOU' : 'FALHOU', 'G3c diagnóstico guarda rascunho no aparelho enquanto se digita (risco de perda em campo sem sinal)', 'chaves de rascunho: ' + guardou + (rasc ? ' (menciona rascunho)' : ''));
    await p.evaluate(() => document.querySelector('#painel form button[type=submit]').click()); await p.waitForTimeout(600);
    const faltam = await p.evaluate(() => ((document.querySelector('#painel [data-erro]') || {}).textContent || '').trim().slice(0, 400));
    reg('G', 'PASSOU', `G3d (informativo) diagnóstico enviado vazio: ${(faltam.match(/Faltam (\d+)/) || [, '?'])[1]} itens exigidos, nenhum marcado como obrigatório antes do envio`, faltam);
    await p.evaluate(() => MQ.ui.fecharPainel({}));
    // G4a professor pede a bolsa do mês (para haver o que aprovar)
    await entrar(p, 'professor'); cliques = 0; teclas = 0;
    await toque('.atalhos [data-alvo="#t-pag"]').catch(() => {});
    const formB = await p.$('form[data-form=pag-bolsa]');
    if (!formB) bloq('G', 'G4a professor pede a bolsa: formulário não aparece'); else {
      await digita('form[data-form=pag-bolsa] [name=relatorio]', 'No mês fiz as matrículas, preparei o material e acompanhei as alunas do curso FIC pelo WhatsApp.');
      if (await p.$('form[data-form=pag-bolsa] [name=justificativa_sem_encontro]')) await digita('form[data-form=pag-bolsa] [name=justificativa_sem_encontro]', 'O primeiro encontro ficou para o mês que vem por causa da chuva.');
      await toque('form[data-form=pag-bolsa] button[type=submit]'); await p.waitForTimeout(600);
      const e = await p.evaluate(() => ((document.querySelector('form[data-form=pag-bolsa] [data-erro]') || {}).textContent || '').trim());
      ok('G', `G4a professor pede a bolsa: ${cliques} toques + ${teclas} campos`, !e && await p.evaluate(() => (MQ.ui.S.solic || []).some(s => s.situacao === 'solicitada')), e); }
    // G4 coord geral aprova (dá o aval) num pagamento
    await entrar(p, 'coord_geral'); cliques = 0; await irAba(p, 'pagamentos'); cliques++;
    const pendentes = await p.evaluate(() => [...document.querySelectorAll('[data-acao=pag-ver]')].map(b => b.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)));
    if (!pendentes.length) bloq('G', 'G4 coord geral aprova pagamento: nenhum pedido na lista do modo demonstração'); else {
      await toque('[data-acao=pag-ver]');
      const f = await p.evaluate(() => { const fs = [...document.querySelectorAll('#painel form')].map(f => f.dataset.form); const bs = [...document.querySelectorAll('#painel button')].filter(b => b.offsetParent).map(b => b.textContent.trim().slice(0, 30)); return { fs, bs }; });
      const aval = await p.evaluate(() => { const b = [...document.querySelectorAll('#painel form[data-form=pag-aval] button')].find(b => /aval|aprov/i.test(b.textContent)); if (!b) return null; const t = b.textContent.trim(); b.click(); return t; }); if (aval) cliques++; await p.waitForTimeout(700);
      const st = await p.evaluate(() => ({ erro: ((document.querySelector('#painel [data-erro]') || {}).textContent || '').trim().slice(0, 200), painel: !!document.querySelector('#painel aside') }));
      ok('G', `G4 coord geral dá o aval num pagamento: ${cliques} toques (Pagamentos → pedido → "${aval}")`, !!aval && !st.erro, JSON.stringify({ pend: pendentes.slice(0, 3), f, st }));
      await p.evaluate(() => MQ.ui.fecharPainel({})); }
    // G5 auxiliar lança no Arlo
    await entrar(p, 'auxiliar'); cliques = 0; teclas = 0;
    const naFila = await p.evaluate(() => { const s = document.querySelector('#t-lancar'); const sec = s && s.closest('section'); return sec ? [...sec.querySelectorAll('[data-acao=pag-ver]')].length : -1; });
    if (naFila <= 0) bloq('G', 'G5 auxiliar lança no Arlo: nenhum pagamento com aval na fila do modo demonstração', 'itens: ' + naFila); else {
      await toque('#t-lancar ~ * [data-acao=pag-ver], section:has(#t-lancar) [data-acao=pag-ver]');
      await digita('#pr-prot', '2026-0001');
      const env = await p.evaluate(() => { const b = document.querySelector('#painel form[data-form=pag-arlo] button[type=submit]'); if (!b) return null; const t = b.textContent.trim(); b.click(); return t; }); if (env) cliques++; await p.waitForTimeout(700);
      const st = await p.evaluate(() => ({ erro: ((document.querySelector('#painel [data-erro]') || {}).textContent || '').trim().slice(0, 200), painel: !!document.querySelector('#painel aside'), conf: !!document.querySelector('#painel .confirma-sair, [role=alertdialog]') }));
      ok('G', `G5 auxiliar lança no Arlo: ${cliques} toques + ${teclas} campo (lista → pedido → protocolo → "${env}")`, !!env && !st.erro, JSON.stringify(st));
      await p.evaluate(() => MQ.ui.fecharPainel({})); }
    // consistência visual: botões primários com a mesma aparência entre perfis
    const prim = {}; for (const pf of ['coord_geral', 'bolsista', 'agente', 'auxiliar']) { await entrar(p, pf); prim[pf] = await p.evaluate(() => { const b = document.querySelector('main .btn.pri'); if (!b) return null; const s = getComputedStyle(b); return s.backgroundColor + ' ' + s.borderRadius + ' ' + s.fontWeight; }); }
    const vals = [...new Set(Object.values(prim).filter(Boolean))];
    ok('G', 'consistência: botão principal com a mesma cor/forma em todos os perfis', vals.length <= 1, JSON.stringify(prim));
    ok('G', 'sem erro de JavaScript nas tarefas', !errs.length, [...new Set(errs)].join(' | '));
    await ctx.close();
  }

  await b.close();
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(R, null, 1));
  const fases = [...new Set(R.map(r => r.fase))];
  console.log('\n=== RESUMO ===');
  fases.forEach(f => { const l = R.filter(r => r.fase === f); console.log(`${f}: ${l.length} verificações · ${l.filter(r => r.st === 'PASSOU').length} passaram · ${l.filter(r => r.st === 'FALHOU').length} falharam · ${l.filter(r => r.st === 'BLOQUEADO').length} bloqueadas`); });
  console.log(`TOTAL ${R.length} · ${R.filter(r => r.st === 'PASSOU').length} passaram · ${R.filter(r => r.st === 'FALHOU').length} falharam · ${R.filter(r => r.st === 'BLOQUEADO').length} bloqueadas · saída em ${OUT}`);
  process.exit(R.some(r => r.st === 'FALHOU') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
