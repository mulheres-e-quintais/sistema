/* Prontidão para o campo, registros parados nos celulares e cópia dos dados (12/10/2026).
   Uso: node testes/automaticos/prontidao.js <caminho do playwright> [pasta para as imagens]   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]); const D = process.argv[3];
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => {
  const b = await chromium.launch();
  for (const w of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(600); };
    // a agente guarda registros sem internet e o celular informa a contagem
    await entrar('agente');
    await p.evaluate(async () => { await MQ.ui.S.api.informarFila({ qtd: 2, recusados: 0, mais_antigo: new Date(Date.now() - 3 * 864e5).toISOString() }); });
    await entrar('coord_geral');
    await p.evaluate(() => { MQ.ui.S.aba = 'visao'; MQ.ui.render(); }); await p.waitForTimeout(400);
    const txt = await p.textContent('#app');
    ok(`${w}: Visão geral mostra "Situação do campo em cada estado"`, /Situação do campo em cada estado/.test(txt));
    ok(`${w}: lista a agente com 2 registros parados há 3 dias`, /2 registros guardados no celular desde .* \(3 dias\)/.test(txt));
    ok(`${w}: sem rolagem para o lado na página`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (D) { const s = await p.$('.prontidao'); if (s) await s.screenshot({ path: D + '/prontidao_' + w + '.png' }); }
    // cópia dos dados
    await p.evaluate(() => { MQ.ui.S.aba = 'documentos'; MQ.ui.render(); }); await p.waitForTimeout(400);
    const btn = await p.$('[data-acao="doc-copia"]'); ok(`${w}: Documentos tem "Baixar cópia dos dados"`, !!btn);
    if (btn) { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), btn.click()]);
      const caminho = (D || '/tmp') + '/copia_' + w + '.xlsx'; await dl.saveAs(caminho);
      ok(`${w}: baixou copia_mulheres_e_quintais_<data>.xlsx`, /^copia_mulheres_e_quintais_\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
      console.log('ARQUIVO ' + caminho); }
    // a técnica vê no Campo; a bolsista não vê nada disso
    await entrar('coord_tecnico'); await p.evaluate(() => { MQ.ui.S.aba = 'campo'; MQ.ui.render(); }); await p.waitForTimeout(400);
    ok(`${w}: técnica vê os registros parados na aba Campo`, /Registros que ainda não foram enviados/.test(await p.textContent('#app')));
    await entrar('bolsista');
    ok(`${w}: bolsista não vê a prontidão`, !/Situação do campo em cada estado/.test(await p.textContent('#app')));
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
