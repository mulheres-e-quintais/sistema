const { chromium } = require(process.argv[2]); const N = +process.argv[3] || 10;
(async () => { const b = await chromium.launch(); const PERF = ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar'];
  const t0 = Date.now(); const res = [];
  await Promise.all(Array.from({ length: N }, async (_, i) => {
    const r = { i, perfil: PERF[i % 6], erros: [], ms: {} }; res.push(r);
    const ctx = await b.newContext({ viewport: i % 2 ? { width: 390, height: 844 } : { width: 1280, height: 900 } }); const p = await ctx.newPage();
    p.on('pageerror', e => r.erros.push(e.message));
    await ctx.route('**/js/config.js', x => x.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', x => x.abort()); await ctx.route('**/fonts.g*/**', x => x.abort());
    try {
      let t = Date.now(); await p.goto('http://localhost:8766/'); await p.waitForSelector('main'); r.ms.abrir = Date.now() - t;
      t = Date.now(); await p.evaluate(pf => { document.querySelector(`button[data-p=${pf}]`).click(); }, r.perfil); await p.waitForTimeout(300); await p.evaluate(() => MQ.ui.fecharPainel()); r.ms.entrar = Date.now() - t;
      t = Date.now();
      const abas = await p.evaluate(() => [...document.querySelectorAll('nav.abas [data-aba]')].map(x => x.dataset.aba));
      for (const a of abas) { await p.evaluate(a => document.querySelector(`[data-aba=${a}]`).click(), a); await p.waitForTimeout(80); }
      r.ms.abas = Date.now() - t; r.abas = abas.length;
      t = Date.now();
      if (r.perfil === 'bolsista') {   // salva uma ficha de verdade (no aparelho)
        await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.waitForTimeout(200);
        await p.fill('#fi-nome', 'Maria Carga Teste ' + i); await p.click('form[data-form=ficha] button[type=submit]'); await p.waitForTimeout(300);
      } else { await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'meus-dados' })); await p.waitForTimeout(200); }
      r.ms.acao = Date.now() - t;
      await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'ajuda' })); await p.waitForTimeout(100);
      r.ok = true;
    } catch (e) { r.erros.push(e.message.split('\n')[0]); }
    await ctx.close();
  }));
  const ok = res.filter(r => r.ok && !r.erros.length).length; const med = k => { const v = res.map(r => r.ms[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] + ' ms (pior ' + v[v.length - 1] + ')' : '-'; };
  console.log(`N=${N} sessões ao mesmo tempo · ${ok}/${N} sem erro · total ${Date.now() - t0} ms`);
  console.log(`  abrir: ${med('abrir')} · entrar: ${med('entrar')} · passar pelas abas: ${med('abas')} · ação (salvar ficha / abrir dados): ${med('acao')}`);
  res.filter(r => r.erros.length).slice(0, 3).forEach(r => console.log('  ERRO', r.perfil, r.erros[0].slice(0, 120)));
  await b.close(); })();
