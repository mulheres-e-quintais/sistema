const { chromium } = require(process.argv[2]); const fs = require('fs');
const AXE = fs.readFileSync('/tmp/claude-0/pw/node_modules/axe-core/axe.min.js', 'utf8');
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const log = (...a) => { const l = a.join(' | '); R.push(l); console.log(l); };
async function nova(b, w = 390) { const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('ALERTA: ' + d.message()); d.dismiss(); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('main'); return { ctx, p, errs }; }
const perfil = async (p, pf) => { await p.evaluate(pf => { MQ.ui.fecharPainel(); MQ.ui.S.verEntrada = false; document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(400); await p.evaluate(() => MQ.ui.fecharPainel()); };
async function telas(p, fn) {   // percorre todas as telas: entrada, cada perfil e aba, e os formulários principais
  await p.evaluate(() => { MQ.ui.S.verEntrada = true; MQ.ui.S.modoLogin = 'entrar'; MQ.ui.render(); }); await p.waitForTimeout(500); await fn('entrada');
  for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    await perfil(p, pf); const abas = await p.evaluate(() => [...document.querySelectorAll('nav.abas [data-aba]')].map(x => x.dataset.aba));
    if (!abas.length) await fn(pf); for (const a of abas) { await p.evaluate(a => document.querySelector(`[data-aba=${a}]`).click(), a); await p.waitForTimeout(150); await fn(pf + '/' + a); }
  }
  await perfil(p, 'bolsista'); await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.waitForTimeout(300); await fn('form ficha');
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'meus-dados' })); await p.waitForTimeout(200); await fn('form meus dados');
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'ajuda' })); await p.waitForTimeout(200); await fn('ajuda');
  await p.evaluate(() => MQ.ui.fecharPainel());
}
(async () => { const b = await chromium.launch();
  // ---------- 1. acessibilidade (axe-core, regras WCAG 2.1 A e AA) ----------
  { const { ctx, p, errs } = await nova(b); const porRegra = {}; let telasN = 0;
    await telas(p, async nome => { telasN++; await p.evaluate(() => Promise.all(document.getAnimations().filter(a => isFinite(a.effect && a.effect.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))));   // mede depois das animações de entrada (no meio do fade o contraste é falso)
      await p.addScriptTag({ content: AXE }).catch(() => {});
      const r = await p.evaluate(async () => { const x = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }); return x.violations.map(v => ({ id: v.id, impacto: v.impact, n: v.nodes.length, ex: v.nodes[0] && v.nodes[0].target.join(' '), desc: v.help })); });
      r.forEach(v => { const k = v.id; porRegra[k] = porRegra[k] || { impacto: v.impacto, desc: v.desc, telas: [], nos: 0, ex: v.ex }; porRegra[k].telas.push(nome); porRegra[k].nos += v.n; }); });
    log('ACESSIBILIDADE', `${telasN} telas verificadas`, `${Object.keys(porRegra).length} tipos de problema`);
    Object.entries(porRegra).sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a[1].impacto) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b[1].impacto))
      .forEach(([k, v]) => log('  ' + v.impacto, k, v.desc, `${v.nos} elementos em ${v.telas.length} telas (ex.: ${v.telas.slice(0, 3).join(', ')})`, 'ex: ' + (v.ex || '').slice(0, 80)));
    if (errs.length) log('  erros de página', errs.join(';')); await ctx.close(); }
  // ---------- 2. responsividade: sem rolagem para o lado, de 320 a 1440 ----------
  for (const w of [320, 360, 390, 768, 1024, 1440]) { const { ctx, p } = await nova(b, w); const ruins = [];
    await telas(p, async nome => { const o = await p.evaluate(() => { const lim = document.documentElement.clientWidth; const fora = [...document.querySelectorAll('main *, #painel *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > lim + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.abas, .seg, [style*=overflow], .tabela-rolavel, .rolar, table, .ver-como, .demo, pre, .mapa, svg'); });
      return { lado: document.documentElement.scrollWidth > lim + 1, fora: fora.slice(0, 2).map(e => e.tagName + '.' + String(e.className).split(' ')[0]) }; });
      if (o.lado) ruins.push(nome + ' [' + o.fora.join(',') + ']'); });
    log('RESPONSIVO ' + w + 'px', ruins.length ? `rolagem para o lado em: ${ruins.slice(0, 5).join('; ')}` : 'nenhuma tela com rolagem para o lado'); await ctx.close(); }
  // ---------- 3. toque: botões pequenos demais no celular ----------
  { const { ctx, p } = await nova(b, 390); const peq = {};
    await telas(p, async nome => { const l = await p.evaluate(() => [...document.querySelectorAll('main button, main a[href], main input:not([type=hidden]), main select, #painel button, #painel input:not([type=hidden]), #painel select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32) && !(e.type === 'radio' || e.type === 'checkbox') && getComputedStyle(e).visibility !== 'hidden'; }).map(e => (e.textContent || e.getAttribute('aria-label') || e.name || e.type).trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
      l.forEach(x => { peq[x] = (peq[x] || []).concat(nome); }); });
    const lista = Object.entries(peq); log('TOQUE (menor que 32 px)', lista.length ? `${lista.length} tipos de controle` : 'nenhum');
    lista.slice(0, 12).forEach(([k, v]) => log('   ', k, v.length + ' telas')); await ctx.close(); }
  // ---------- 4. segurança: código digitado em campos não executa ----------
  { const { ctx, p, errs } = await nova(b, 1280); const MAL = '<img src=x onerror="window.__xss=1">"><script>window.__xss=2</script>';
    await perfil(p, 'bolsista'); await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.waitForTimeout(300);
    await p.fill('#fi-nome', 'Maria ' + MAL); await p.fill('#fi-mun', MAL); const cm = await p.$('#fi-com'); if (cm) await cm.fill(MAL);
    await p.click('form[data-form=ficha] button[type=submit]'); await p.waitForTimeout(400);
    // força gravar com o nome malicioso mesmo se a validação barrar: grava direto na demonstração
    await p.evaluate(async MAL => { const eq = await MQ.apiDemo.listarEquipe(); const d = JSON.parse(localStorage.getItem('mq-demo-v4')); d.fichas[0].nome = MAL; d.fichas[0].comunidade = MAL; d.equipe[1].nome = MAL; d.equipe[1].nome_social = null; localStorage.setItem('mq-demo-v4', JSON.stringify(d)); }, MAL);
    await p.reload(); await p.waitForSelector('main'); let exec = false;
    await telas(p, async () => { if (await p.evaluate(() => window.__xss)) exec = true; });
    await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'ficha-ver', id: JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].id })); await p.waitForTimeout(300); if (await p.evaluate(() => window.__xss)) exec = true;
    log('SEGURANÇA (código em nome, município, comunidade)', exec ? 'EXECUTOU (FALHA)' : 'não executou em nenhuma tela', errs.filter(e => /ALERTA/.test(e)).length ? 'alerta aberto!' : 'nenhum alerta');
    // dados sensíveis guardados no aparelho
    await perfil(p, 'auxiliar'); const ls = await p.evaluate(() => Object.keys(localStorage).map(k => k + ':' + localStorage.getItem(k).length));
    log('   armazenamento no aparelho', ls.join(', ').slice(0, 200)); await ctx.close(); }
  await b.close(); fs.writeFileSync('/tmp/claude-0/pw/nf/naofunc.txt', R.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
