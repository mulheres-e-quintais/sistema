const { chromium } = require(process.argv[2]);
const TAREFAS = {
  bolsista: [['Lançar nova ficha', '[data-acao=ficha-nova], button:has-text("Nova ficha")'], ['Registrar diagnóstico/visita', 'button:has-text("Registrar")'], ['Marcar lista de presença (Entreguei)', 'button:has-text("Entreguei")'], ['Pedir a bolsa do mês', 'button:has-text("Solicitar bolsa"), [data-form=pag-bolsa] button[type=submit]'], ['Pedir passagem', '[data-acao=viag-nova][data-t=passagem]']],
  agente: [['Registrar diagnóstico/visita', 'button:has-text("Registrar")'], ['Pedir ajuda de custo', '[data-form=pag-ajuda] button[type=submit], button:has-text("Solicitar ajuda")']],
  professor: [['Confirmar acesso ao AVA', '[data-acao=ent-ava]'], ['Matricular', 'button:has-text("Matricular")']],
  auxiliar: [['Abrir pessoa para registrar Arlo', '.grade-prof [data-acao=ver], [data-acao=ver]'], ['Lançar pagamento no Arlo', '[data-acao=pag-ver]']],
};
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  for (const [pf, ts] of Object.entries(TAREFAS)) {
    await p.click(`button[data-acao=perfil][data-p=${pf}]`); await p.waitForTimeout(400); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel()); await p.waitForTimeout(150);
    const altura = await p.evaluate(() => document.documentElement.scrollHeight);
    const ordem = await p.evaluate(() => [...document.querySelectorAll('main > *')].filter(e => e.offsetParent).map(e => { const h = e.querySelector('h1,h2'); return (h ? h.textContent.trim().slice(0, 28) : e.className.split(' ')[0]) + '@' + Math.round(e.getBoundingClientRect().top + scrollY); }).join(' · '));
    console.log(`\n## ${pf} (página com ${(altura / 740).toFixed(1)} telas de altura)\n   ordem: ${ordem}`);
    for (const [t, sel] of ts) {
      const y = await p.evaluate(sel => { const e = [...document.querySelectorAll('main *')].find(x => x.matches && (() => { try { return x.matches(sel); } catch (er) { return false; } })() && x.offsetParent); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }, sel.replace(/button:has-text\("([^"]+)"\)/g, '___')).catch(() => null);
      let y2 = y; if (y2 == null) { const loc = p.locator(sel).locator('visible=true').first(); if (await loc.count()) { const bb = await loc.boundingBox(); y2 = bb ? Math.round(bb.y + await p.evaluate(() => scrollY)) : null; } }
      console.log(`   ${t.padEnd(38)} ${y2 == null ? 'NÃO ENCONTRADO na tela inicial' : 'y=' + y2 + ' → ' + (y2 < 740 ? 'visível sem rolar' : 'rolar ' + Math.floor(y2 / 740) + ' tela(s)')}`);
    }
  }
  await b.close(); })();
