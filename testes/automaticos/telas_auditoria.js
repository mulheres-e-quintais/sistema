const { chromium } = require(process.argv[2]);
const out = [];
(async () => { const b = await chromium.launch();
  for (const [W, H, mob] of [[360, 740, true], [1280, 900, false]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: mob, hasTouch: mob, locale: 'pt-BR' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
    const perfis = await p.$$eval('button[data-acao=perfil]', l => [...new Set(l.map(x => x.dataset.p))]);
    for (const perfil of perfis) {
      await p.click(`button[data-acao=perfil][data-p=${perfil}]`); await p.waitForTimeout(400); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel()); await p.waitForTimeout(150);
      const abas = await p.$$eval('nav.abas [data-acao=aba]', l => l.map(x => x.dataset.aba)).catch(() => []);
      for (const aba of (abas.length ? abas : ['—'])) {
        if (aba !== '—') { await p.evaluate(a => { window.__cls = 0; try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__cls += e.value; })).observe({ type: 'layout-shift' }); } catch (e) {} MQ.ui.S.aba = a; MQ.ui.render(); }, aba); }
        await p.waitForTimeout(500);
        const r = await p.evaluate(mob => {
          const vis = e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
          const o = { largura: document.documentElement.scrollWidth, cls: +(window.__cls || 0).toFixed(3) };
          const alvo = [...document.querySelectorAll('main button, main a.btn, main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select, main .sn')].filter(vis);
          o.pequenos = mob ? alvo.filter(e => { const r = e.getBoundingClientRect(); return r.height < 36 && !e.closest('.seg, .abas'); }).map(e => (e.textContent || e.name || e.className).trim().slice(0, 25)) : [];
          o.fonteInput = mob ? [...document.querySelectorAll('main input, main select, main textarea')].filter(vis).filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.name || e.id) : [];
          o.semNome = alvo.filter(e => e.tagName === 'BUTTON' && !(e.textContent.trim() || e.getAttribute('aria-label') || e.title)).length;
          o.h1 = [...document.querySelectorAll('main h1')].filter(vis).length;
          o.transborda = [...document.querySelectorAll('main *')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.abas, .tab-rolagem, .tab-uf-wrap, [style*=overflow]'); }).slice(0, 3).map(e => e.tagName + '.' + e.className.toString().slice(0, 20));
          o.altura = document.documentElement.scrollHeight;
          return o; }, mob);
        const probs = [];
        if (r.largura > W) probs.push('rolagem lateral ' + r.largura);
        if (r.cls > 0.05) probs.push('página pula (CLS ' + r.cls + ')');
        if (r.pequenos.length) probs.push('botões pequenos: ' + [...new Set(r.pequenos)].slice(0, 5).join(' | '));
        if (r.fonteInput.length) probs.push('campo com letra < 16px: ' + r.fonteInput.slice(0, 4).join(','));
        if (r.semNome) probs.push(r.semNome + ' botão sem nome');
        if (r.h1 !== 1) probs.push(r.h1 + ' títulos h1');
        if (r.transborda.length) probs.push('sai da tela: ' + r.transborda.join(', '));
        out.push([W, perfil, aba, probs.length ? probs.join(' ; ') : 'ok']);
        if (mob) await p.screenshot({ path: `/tmp/claude-0/pw/cad/tela-${perfil}-${aba}.png`, fullPage: false });
      }
    }
    if (errs.length) out.push([W, 'ERROS JS', '', [...new Set(errs)].join(' | ')]);
    await ctx.close();
  }
  out.forEach(x => console.log(x.join(' | '))); await b.close(); })();
