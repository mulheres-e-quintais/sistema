const { chromium } = require(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo'); fs.writeFileSync('icons.json', JSON.stringify(await p.evaluate(() => MQ.ICONES))); await b.close(); })();
