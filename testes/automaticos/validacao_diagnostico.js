/* Diagnóstico: onde foi registrado (mapa, distância, alertas) e cadastro com um campo só de município */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  for (const w of [320, 390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); };
    await entrar('coord_tecnico');
    await p.evaluate(() => { const d = MQ.ui.S.diagnosticos[0]; MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: d.ficha_id }); }); await p.waitForTimeout(300);
    ok(`${w}: diagnóstico mostra "Onde foi registrado" com mapa`, !!(await p.$('#painel .bloco-local svg.mapa-local')));
    ok(`${w}: mostra distância do centro do município`, /Distância do centro de/.test(await p.textContent('#painel')));
    ok(`${w}: painel sem rolagem para o lado`, await p.evaluate(() => { const e = document.querySelector('#painel .painel-corpo'); return e.scrollWidth <= e.clientWidth + 1; }));
    if (w === 390) await p.screenshot({ path: process.argv[3] + '/diag_local.png', fullPage: false });
    // sem localização: aprovar pede a observação
    await p.evaluate(() => { const S = MQ.ui.S; S.diagnosticos = S.diagnosticos.map((x, i) => i ? x : Object.assign({}, x, { latitude: null, longitude: null, sem_gps_motivo: 'O celular não achou o sinal de GPS no quintal. Fica no fundo do vale' })); const d = S.diagnosticos[0]; MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: d.ficha_id }); }); await p.waitForTimeout(300);
    ok(`${w}: sem localização aparece o aviso`, /Sem localização\./.test(await p.textContent('#painel')));
    await p.click('#painel button[name=decisao][value=aprovado]'); await p.waitForTimeout(300);
    ok(`${w}: aprovar sem observação é barrado na tela`, /como você confirmou/.test(await p.textContent('#painel form[data-form=diag-decisao]')));
    // formulário do diagnóstico: motivo em lista
    await entrar('bolsista');
    await p.evaluate(() => { const f = MQ.ui.S.fichas.find(x => x.uf === 'PI' && x.resultado === 'selecionada' && x.situacao === 'aprovada' && !MQ.ui.S.diagnosticos.some(d => d.ficha_id === x.id)); MQ.ui.abrirPainel({ tipo: 'diag-form', ficha: f.id }); }); await p.waitForTimeout(300);
    ok(`${w}: diagnóstico novo começa sem localização`, (await p.inputValue('#painel input[name=latitude]')) === '');
    ok(`${w}: motivo sem GPS é uma lista`, (await p.$$eval('#dg-semgps-tipo option', l => l.length)) >= 5);
    // cadastro: um campo de município
    await entrar('coord_geral');
    await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'cadastro', papel: 'articulacao', uf: 'PI', modo: 'manual' })); await p.waitForTimeout(800);
    await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'cadastro', papel: 'articulacao', uf: 'PI', modo: 'manual' })); await p.waitForTimeout(300);
    const n = await p.$$eval('#painel label', l => l.filter(x => /Município onde mora|^Cidade$/.test(x.textContent.trim())).length);
    ok(`${w}: cadastro pede o município uma vez só`, n === 1, 'campos: ' + n);
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
