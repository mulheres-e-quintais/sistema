/* Aba Execução (coordenação geral): baixar modelo, enviar planilha (prévia, confirmar), números, histórico, substituição. */
const { chromium } = require(process.argv[2]); const path = require('path');
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const FIX = n => path.join(__dirname, '..', 'unit', 'fixtures', n);
const R = []; const ok = (c, cond, det = '') => { R.push([cond ? 'PASSOU' : 'FALHOU', c, det]); };
(async () => {
  const b = await chromium.launch();
  for (const w of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('main');
    await p.evaluate(() => { MQ.ui.S.verEntrada = false; document.querySelector('button[data-p=coord_geral]').click(); }); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel());
    await p.evaluate(() => document.querySelector('[data-aba=execucao]').click()); await p.waitForTimeout(300);
    ok(`${w}: aba Execução com o nome curto`, (await p.textContent('[data-aba=execucao]')).trim().startsWith('Execução') && !/financeira/.test(await p.textContent('[data-aba=execucao]')));
    ok(`${w}: sem planilha, aviso para enviar`, /Nenhuma planilha de gastos enviada ainda/.test(await p.textContent('main')));
    ok(`${w}: modelo fora da aba (só no painel de envio)`, !(await p.$('main a[href*="Modelo_planilha_de_gastos"]')));
    await p.click('[data-acao=exec-enviar]'); await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#painel a[href*="Modelo_planilha_de_gastos"]')]);
    ok(`${w}: baixar o modelo no painel de envio`, /Modelo_planilha_de_gastos.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    await p.click('form[data-form=exec-ler] button[type=submit]'); await p.waitForTimeout(200);
    ok(`${w}: sem arquivo, pede o arquivo`, /Escolha o arquivo/.test(await p.textContent('#painel')));
    await p.setInputFiles('#ex-arq', FIX('modelo_preenchido.xlsx')); await p.click('form[data-form=exec-ler] button[type=submit]'); await p.waitForTimeout(800);
    const prev = await p.textContent('#painel');
    ok(`${w}: prévia mostra gasto e recebido`, /Gastos\s*R\$\s?111\.800,00/.test(prev) && /Recebido do MDA\s*R\$\s?1\.000\.000,00/.test(prev), prev.slice(0, 200));
    ok(`${w}: data sugerida = última data da planilha`, (await p.inputValue('#ex-pos')) === '2026-09-25');
    await p.click('form[data-form=exec-confirmar] button[type=submit]'); await p.waitForTimeout(700);
    const m = await p.textContent('main');
    ok(`${w}: depois de enviar, executado da planilha`, /R\$\s?111\.800,00\s*executado/.test(m));
    ok(`${w}: histórico com 1 planilha vigente`, /Planilhas enviadas\s*1/.test(m) && /vigente/.test(m));
    // envia a de fora: substitui e mostra fora do orçamento
    await p.click('[data-acao=exec-enviar]'); await p.waitForTimeout(300);
    await p.setInputFiles('#ex-arq', FIX('funcern_baguncado.xlsx')); await p.click('form[data-form=exec-ler] button[type=submit]'); await p.waitForTimeout(800);
    const p2 = await p.textContent('#painel');
    ok(`${w}: prévia avisa linha fora do orçamento`, /1 linha não batem com nenhum item|1 linha não bate|não batem com nenhum item/.test(p2) && /Coffee break/.test(p2));
    await p.click('form[data-form=exec-confirmar] button[type=submit]'); await p.waitForTimeout(700);
    const m2 = await p.textContent('main');
    ok(`${w}: a nova substitui (histórico com 2, uma substituída)`, /Planilhas enviadas\s*2/.test(m2) && /substituída/.test(m2));
    ok(`${w}: alerta de linha fora do orçamento`, /em linhas que não batem com nenhum item do orçamento/.test(m2));
    ok(`${w}: sem rolagem lateral`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    ok(`${w}: sem erro de página`, !errs.length, errs.join('|'));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
