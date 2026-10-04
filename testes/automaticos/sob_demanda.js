/* Histórico e Documentos são buscados quando a aba abre (não na entrada): clique, Voltar/Avançar do navegador, recarregar a página e atalho de outro módulo */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  for (const w of [360, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelector('button[data-p=coord_tecnico]').click()); await p.waitForTimeout(400);
    await p.evaluate(() => MQ.ui.S.api.criar({ papel: 'agente', uf: 'SE', nome: 'Agente Da Aba', cpf: '47602436075', email: 'aba@gmail.com', telefone: '(79) 99999-0000', data_inicio: new Date().toISOString().slice(0, 10), consentimento_lgpd: true }));
    await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(600);
    // conta as leituras a partir de agora
    const contar = () => p.evaluate(() => { const a = MQ.ui.S.api; window.__n = { aud: 0, docs: 0 }; const f = a.auditoria, g = a.listarDocumentos; a.auditoria = async () => { __n.aud++; return f.call(a); }; a.listarDocumentos = async () => { __n.docs++; return g.call(a); }; });
    await contar();
    await p.evaluate(() => MQ.ui.carregar());
    ok(`${w}: na Visão geral, histórico e documentos não são lidos`, await p.evaluate(() => __n.aud === 0 && __n.docs === 0), JSON.stringify(await p.evaluate(() => __n)));
    const abrir = async aba => { await p.evaluate(aba => { const m = document.querySelector('[data-acao=menu]'); if (m && !document.querySelector(`[data-acao=aba][data-aba=${aba}]`)) m.click(); }, aba); await p.waitForTimeout(150);
      await p.evaluate(aba => document.querySelector(`[data-acao=aba][data-aba=${aba}]`).click(), aba); await p.waitForTimeout(600); };
    await abrir('historico');
    let txt = await p.textContent('main');
    ok(`${w}: clique na aba Histórico traz os registros`, /Agente Da Aba/.test(txt) && !(await p.$('[data-carregando-aba]')), txt.slice(0, 120));
    ok(`${w}: histórico lido ao abrir a aba`, await p.evaluate(() => __n.aud >= 1));
    ok(`${w}: nunca mostra "Nada registrado" com registros no banco`, !/Nada registrado ainda/.test(txt));
    await abrir('documentos'); txt = await p.textContent('main');
    ok(`${w}: clique na aba Documentos mostra anexar e relatório`, !!(await p.$('[data-acao=doc-novo]')) && !!(await p.$('[data-acao=doc-relatorio]')) && !(await p.$('[data-carregando-aba]')));
    ok(`${w}: documentos lidos ao abrir a aba`, await p.evaluate(() => __n.docs >= 1));
    await p.goBack(); await p.waitForTimeout(600);
    ok(`${w}: Voltar do navegador chega ao Histórico com os registros`, /Agente Da Aba/.test(await p.textContent('main')));
    await p.reload(); await p.waitForTimeout(1200);
    ok(`${w}: recarregar a página na aba Histórico mostra os registros`, /Histórico de alterações/.test(await p.textContent('main')) && /Agente Da Aba/.test(await p.textContent('main')) && !(await p.$('[data-carregando-aba]')), (await p.textContent('main')).slice(0, 100));
    await contar();
    // atalho de outro módulo: muda a aba sem passar pelo clique
    await p.evaluate(() => { MQ.ui.irParaAba('visao'); MQ.ui.render(); }); await p.waitForTimeout(200);
    await p.evaluate(() => { delete MQ.ui.S.veio; MQ.ui.S.aud = []; MQ.ui.irParaAba('historico'); MQ.ui.render(); }); await p.waitForTimeout(600);
    ok(`${w}: atalho de outro módulo para o Histórico também busca`, /Agente Da Aba/.test(await p.textContent('main')));
    // sem internet: sem "Carregando…" eterno
    await p.evaluate(() => { MQ.ui.irParaAba('visao'); MQ.ui.render(); delete MQ.ui.S.veio; }); await ctx.setOffline(true);
    await p.evaluate(() => { MQ.ui.irParaAba('historico'); MQ.ui.render(); }); await p.waitForTimeout(400);
    ok(`${w}: sem internet a aba não fica presa em "Carregando…"`, !(await p.$('[data-carregando-aba]')));
    await ctx.setOffline(false);
    ok(`${w}: sem rolagem para o lado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // outros perfis
    await p.evaluate(() => { __n.aud = 0; __n.docs = 0; document.querySelector('button[data-p=coord_tecnico]').click(); }); await p.waitForTimeout(600);
    ok(`${w}: coordenação técnica não lê histórico nem documentos`, await p.evaluate(() => __n.aud === 0 && __n.docs === 0));
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
