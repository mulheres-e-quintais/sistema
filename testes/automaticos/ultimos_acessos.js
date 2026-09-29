/* Quadro "Últimos acessos" (aba Histórico da coordenação geral) e registro de entradas e saídas */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  for (const w of [320, 390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); };
    await entrar('bolsista'); await entrar('agente'); await entrar('coord_geral');
    await p.evaluate(() => { S = MQ.ui.S; S.aba = 'historico'; MQ.ui.render(); }); await p.waitForTimeout(300);
    const txt = await p.textContent('main');
    ok(`${w}: Histórico mostra "Últimos acessos"`, /Últimos acessos/.test(txt));
    const n = await p.$$eval('#lista-acessos li', l => l.length);
    ok(`${w}: bolsista e agente aparecem com a última entrada`, n >= 2, 'itens: ' + n);
    ok(`${w}: mostra o aparelho`, /· (Chrome|Chromium|navegador)/.test(await p.textContent('#lista-acessos')));
    ok(`${w}: conta quem entrou nos últimos 7 dias`, /entraram nos últimos 7 dias|entrou nos últimos 7 dias/.test(txt));
    ok(`${w}: sem rolagem para o lado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const id = await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('mq-demo-v4')).acessos; return l.find(a => a.equipe_id !== MQ.ui.S.eu.id).equipe_id; });
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'detalhe', id }), id); await p.waitForTimeout(300);
    ok(`${w}: ficha da pessoa mostra o último acesso`, /Último acesso: .*(hoje|ontem)/.test(await p.textContent('#painel')));
    await p.evaluate(() => MQ.ui.fecharPainel());
    await entrar('coord_tecnico');
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'detalhe', id }), id); await p.waitForTimeout(300);
    ok(`${w}: coordenação técnica não vê último acesso`, !/Último acesso/.test(await p.textContent('#painel')));
    const tipos = await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).acessos.map(a => a.tipo));
    ok(`${w}: cada troca de perfil registrou uma entrada`, tipos.filter(t => t === 'entrada').length >= 4, tipos.join(','));
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
