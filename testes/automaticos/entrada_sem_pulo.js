const { chromium } = require(process.argv[2]);
(async () => { const b = await chromium.launch();
  for (const w of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const p = await ctx.newPage();
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.addInitScript(() => { window.__cls = []; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: +e.value.toFixed(3), t: Math.round(e.startTime), src: (e.sources || []).map(s => (s.node && (s.node.className || s.node.nodeName)) + ' ' + JSON.stringify(s.previousRect && [Math.round(s.previousRect.y), Math.round(s.currentRect.y), Math.round(s.previousRect.height), Math.round(s.currentRect.height)])).slice(0, 3) }); }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await p.evaluate(() => { window.__cls = []; document.querySelector('button[data-p=entrada], [data-p]:last-child').click(); }); await p.waitForTimeout(2500);
  const c = await p.evaluate(() => window.__cls); console.log(w, 'total', c.reduce((s, x) => s + x.v, 0).toFixed(3)); c.slice(0, 6).forEach(x => console.log('  ', x.v, x.t + 'ms', x.src.join(' | ')));
  await ctx.close(); }
  await b.close(); })();
