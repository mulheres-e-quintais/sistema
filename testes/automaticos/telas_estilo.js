const { chromium } = require(process.argv[2]);
const W = +process.argv[3] || 1280;
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: 900 }, isMobile: W < 700, hasTouch: W < 700 }); const p = await ctx.newPage();
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  const tab = {};  // chave de estilo -> telas
  const add = (k, v, tela) => { tab[k] = tab[k] || {}; (tab[k][v] = tab[k][v] || new Set()).add(tela); };
  for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    await p.click(`button[data-acao=perfil][data-p=${pf}]`); await p.waitForTimeout(400); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel());
    const abas = await p.$$eval('nav.abas [data-acao=aba]', l => l.map(x => x.dataset.aba)).catch(() => []);
    for (const aba of (abas.length ? abas : ['—'])) {
      if (aba !== '—') { await p.evaluate(a => { MQ.ui.S.aba = a; MQ.ui.render(); }, aba); await p.waitForTimeout(350); }
      const tela = pf + '/' + aba;
      const r = await p.evaluate(() => {
        const vis = e => e.offsetParent !== null;
        const st = e => { const c = getComputedStyle(e); return `${c.fontFamily.split(',')[0].replace(/"/g, '')} ${c.fontSize} ${c.fontWeight} ${c.color}`; };
        const o = {};
        const pega = (sel, k) => { [...document.querySelectorAll(sel)].filter(vis).forEach(e => { (o[k] = o[k] || new Set()).add(st(e)); }); };
        pega('main h1', 'h1'); pega('main h2', 'h2'); pega('main h3', 'h3'); pega('main .eyebrow', 'eyebrow');
        pega('main .cab p:not(.small):not(.carregando)', 'cab p'); pega('main .secao-cab p', 'secao-cab p');
        pega('main .btn:not(.peq):not(.pri):not(.perigo)', '.btn'); pega('main .btn.pri:not(.peq)', '.btn.pri'); pega('main .btn.peq', '.btn.peq');
        pega('main .chip:not(.chip-lg)', '.chip'); pega('main .resumo .v', '.resumo .v'); pega('main .resumo .l', '.resumo .l');
        pega('main .aviso', '.aviso'); pega('main .muted.small, main .small.muted', 'small muted');
        const m = document.querySelector('main'); const pr = m && m.firstElementChild;
        o['1º bloco'] = new Set([pr ? pr.className.split(' ')[0] + ' top=' + Math.round(pr.getBoundingClientRect().top + scrollY) : '-']);
        const cab = document.querySelector('main .cab'); o['cab top'] = new Set([cab ? String(Math.round(cab.getBoundingClientRect().top + scrollY)) : 'SEM .cab']);
        return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));
      });
      Object.entries(r).forEach(([k, vs]) => vs.forEach(v => add(k, v, tela)));
    }
  }
  for (const [k, vs] of Object.entries(tab)) {
    const ent = Object.entries(vs).sort((a, b) => b[1].size - a[1].size);
    console.log(`\n== ${k}: ${ent.length} variações`);
    ent.forEach(([v, telas]) => console.log(`   ${v}  ← ${telas.size} telas${ent.length > 1 && telas.size < 9 ? ': ' + [...telas].join(', ') : ''}`));
  }
  await b.close(); })();
