/* v266: celular e tablet — página pública a 600 px, toque e campos de 16 px no tablet, barra numa linha, menu Seção no tablet
   deitado, áreas seguras do iPhone, painel e botão de salvar no celular deitado, atalho "pedem atenção" e nenhuma tela rolando
   para o lado em 320/360/600/768/1024 px.
   Uso: node testes/automaticos/responsividade.js <caminho do playwright> [pasta para fotos]   (servidor em http://localhost:8766) */
const { chromium, devices } = require(process.argv[2]); const OUT = process.argv[3] || require('os').tmpdir();
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  const abrir = async (op, perfil) => { const ctx = await b.newContext(op); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    if (perfil) { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, perfil); await p.waitForTimeout(600); await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200); }
    return { ctx, p, errs }; };
  // 1. página pública a 600
  { const { ctx, p } = await abrir({ viewport: { width: 600, height: 900 } }); await p.evaluate(() => { location.hash = '#numeros'; }); await p.waitForTimeout(800);
    ok('página pública a 600 px: sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await p.evaluate(() => document.documentElement.scrollWidth))); await ctx.close(); }
  // 2. tablet com toque: alvos e campos de 16 px
  { const { ctx, p } = await abrir({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, 'coord_geral');
    const peq = await p.evaluate(() => [...document.querySelectorAll('main button, main a[href], main summary, header button')].filter(e => e.offsetParent && getComputedStyle(e).visibility !== 'hidden')
      .map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.h < 36 && x.w > 0));
    ok('tablet 820 com toque: botões e links com pelo menos 36 px de altura', peq.length <= 2, JSON.stringify(peq.slice(0, 6)));
    ok('tablet 820: barra de cima numa linha (até 80 px)', (await p.evaluate(() => document.querySelector('header.barra').getBoundingClientRect().height)) <= 80, String(await p.evaluate(() => document.querySelector('header.barra').getBoundingClientRect().height)));
    ok('tablet 820: atalho "pedem atenção" no topo da Visão geral', !!(await p.$('.ir-atencao')) && await p.evaluate(() => getComputedStyle(document.querySelector('.ir-atencao')).display !== 'none'));
    await p.click('.ir-atencao'); await p.waitForTimeout(700);
    ok('o atalho leva ao quadro "O que pede atenção"', await p.evaluate(() => { const r = document.querySelector('.dx-atencao').getBoundingClientRect(); return r.top >= -5 && r.top < 200; }));
    await p.evaluate(() => { const S = MQ.ui.S; document.body.insertAdjacentHTML('beforeend', `<button id="ab" data-acao="campo-diag-novo" data-ficha="${S.fichas.find(x => x.resultado === 'selecionada').id}"></button>`); document.getElementById('ab').click(); document.getElementById('ab').remove(); }); await p.waitForTimeout(500);
    const fontes = await p.evaluate(() => [...document.querySelectorAll('#painel input:not([type=checkbox]):not([type=radio]):not([type=file]), #painel select, #painel textarea')].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)).filter(f => f < 16).length);
    ok('tablet com toque: nenhum campo com letra menor que 16 px (o iPhone não dá zoom)', fontes === 0, String(fontes));
    await p.screenshot({ path: OUT + '/r-820-diag.png' }); await ctx.close(); }
  // 3. 1024 deitado: menu Seção no lugar das abas em grupos
  { const { ctx, p } = await abrir({ viewport: { width: 1024, height: 768 }, hasTouch: true }, 'coord_geral');
    ok('tablet deitado 1024: menu "Seção" (sem o grupo caindo na 2ª linha)', await p.evaluate(() => getComputedStyle(document.querySelector('.abas-m')).display !== 'none' && getComputedStyle(document.querySelector('nav.abas')).display === 'none'));
    await p.screenshot({ path: OUT + '/r-1024-topo.png', clip: { x: 0, y: 0, width: 1024, height: 400 } }); await ctx.close(); }
  // 4. iPhone deitado com entalhe: áreas seguras
  { const { ctx, p } = await abrir({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }, 'bolsista');
    const cdp = await ctx.newCDPSession(p);
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 47, right: 47, top: 0, bottom: 21 } }); } catch (e) {}
    await p.waitForTimeout(300);
    const esq = await p.evaluate(() => Math.round(document.querySelector('.barra-in .marca').getBoundingClientRect().left));
    ok('iPhone deitado: logo fora do entalhe (≥ 47 px da borda)', esq >= 47, String(esq));
    await p.evaluate(() => { const S = MQ.ui.S; document.body.insertAdjacentHTML('beforeend', `<button id="ab" data-acao="campo-diag-novo" data-ficha="${S.fichas.find(x => x.resultado === 'selecionada').id}"></button>`); document.getElementById('ab').click(); document.getElementById('ab').remove(); }); await p.waitForTimeout(500);
    const cab = await p.evaluate(() => Math.round(document.querySelector('#painel .painel-cab').getBoundingClientRect().height));
    ok('celular deitado: cabeçalho do painel enxuto (até 70 px)', cab <= 70, String(cab));
    ok('celular deitado: botão de salvar fixo à vista', await p.evaluate(() => { const a = document.querySelector('#painel .painel-corpo > form.f > .acoes:last-child'); if (!a) return false; const btn = a.querySelector('button[type=submit], .btn.pri') || a; const r = btn.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }));
    await p.screenshot({ path: OUT + '/r-844-diag.png' }); await ctx.close(); }
  // 5. varredura sem rolagem lateral em 320/360/600/768/1024
  for (const w of [320, 360, 600, 768, 1024]) { for (const pf of ['coord_geral', 'bolsista', 'agente', 'obs_mpa']) {
    const { ctx, p, errs } = await abrir({ viewport: { width: w, height: 800 }, hasTouch: w < 1100 }, pf);
    const abas = pf.startsWith('obs') ? [null] : [null, ...(await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-aba]')].map(x => x.dataset.aba))]))];
    const ruim = [];
    for (const ab of abas) { if (ab) { await p.evaluate(ab => { const x = document.querySelector(`[data-aba="${ab}"]`); x && x.click(); }, ab); await p.waitForTimeout(250); }
      if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) ruim.push(ab || 'inicio'); }
    ok(`${w} px · ${pf}: nenhuma tela rola para o lado`, !ruim.length && !errs.length, ruim.join(',') + errs.join('|')); await ctx.close(); } }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
