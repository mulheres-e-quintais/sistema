/* 22/10/2026: Financeiro com a planilha de SOLICITAÇÕES da FUNCERN (tela como a do Saberes que Cultivam).
   Uso: node testes/automaticos/financeiro_solicitacoes.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]); const path = require('path');
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const FIX = n => path.join(__dirname, '..', 'unit', 'fixtures', n);
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
(async () => {
  const b = await chromium.launch();
  for (const [w, esquema] of [[1280, 'light'], [390, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: esquema }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('main');
    await p.evaluate(() => { MQ.ui.S.verEntrada = false; document.querySelector('button[data-p=coord_geral]').click(); }); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel());
    await p.evaluate(() => { MQ.ui.S.aba = 'execucao'; MQ.ui.render(); }); await p.waitForTimeout(300);
    await p.click('[data-acao=exec-enviar]'); await p.waitForTimeout(300);
    await p.setInputFiles('#ex-arq', FIX('funcern_solicitacoes.xlsx')); await p.click('form[data-form=exec-ler] button[type=submit]'); await p.waitForTimeout(900);
    const pv = await p.evaluate(() => ({ txt: document.querySelector('#painel').textContent.replace(/\s+/g, ' '), sel: [...document.querySelectorAll('#painel select[data-exec-status]')].map(s => [s.dataset.execStatus, s.value]) }));
    ok(`${w}: prévia lista cada status da FUNCERN e como entra (cancelada não entra; "Pagamento" comprometido)`, pv.sel.some(x => x[0] === 'Cancelada' && x[1] === 'ignorar') && pv.sel.some(x => x[0] === 'Pagamento' && x[1] === 'comprometido') && pv.sel.some(x => x[0] === 'Pago' && x[1] === 'pago'), pv.sel);
    ok(`${w}: prévia mostra pago e comprometido`, /Pago\s*R\$\s?1\.250,50/.test(pv.txt) && /Comprometido \(ainda não pago\)\s*R\$\s?22\.000,00/.test(pv.txt), pv.txt.slice(pv.txt.indexOf('Pago R$'), pv.txt.indexOf('Pago R$') + 120));
    await p.selectOption('#painel select[data-exec-status="Pagamento"]', 'pago'); await p.waitForTimeout(400);
    const pv2 = await p.evaluate(() => document.querySelector('#painel').textContent.replace(/\s+/g, ' '));
    ok(`${w}: mudar "Pagamento" para pago recalcula a prévia`, /Pago\s*R\$\s?23\.250,50/.test(pv2), pv2.slice(pv2.indexOf('Pago R$'), pv2.indexOf('Pago R$') + 60));
    await p.selectOption('#painel select[data-exec-status="Pagamento"]', 'comprometido'); await p.waitForTimeout(400);
    await p.click('form[data-form=exec-confirmar] button[type=submit]'); await p.waitForTimeout(900);
    const m = await p.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
    ok(`${w}: resumo como no Saberes que Cultivam (recebido, pago, comprometido, disponível)`, /1\.000\s*de 2\.000 mil\s*recebido/.test(m) && /1,3\s*de 1\.000 mil\s*pago/.test(m) && /22\s*de 1\.000 mil\s*comprometido/.test(m) && /disponível do recebido/.test(m), m.slice(m.indexOf('Execução financeira'), m.indexOf('Execução financeira') + 300));
    ok(`${w}: despesas do projeto com a situação na FUNCERN`, /Despesas do projeto\s*3/.test(m) && /DOA/.test(m) && /Pagamento/.test(m));
    await p.evaluate(() => document.querySelector('[data-acao=exec-abrir][data-id=r13]').click()); await p.waitForTimeout(300);
    const r13 = await p.evaluate(() => { const tb = document.getElementById('exr-r13'); return tb ? tb.textContent.replace(/\s+/g, ' ') : ''; });
    ok(`${w}: DOA em Despesas operacionais (não em serviços de terceiros), com a despesa dentro da rubrica`, /Despesas desta rubrica/.test(r13) && /Solicitação 90002/.test(r13) && /R\$\s?20\.000,00/.test(r13), r13.slice(0, 200));
    await p.evaluate(() => document.querySelector('[data-acao=exec-comp][data-id=doa]').click()); await p.waitForTimeout(200);
    ok(`${w}: o item abre a barra pago · comprometido · saldo`, await p.evaluate(() => { const d = document.querySelector('#exc-doa .rbx'); return !!d && !d.closest('[hidden]'); }));
    ok(`${w}: sem rolagem lateral`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), await p.evaluate(() => document.documentElement.scrollWidth));
    ok(`${w}: sem erro de página`, !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); const f = R.filter(x => x[0] === 'FALHOU').length; console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
