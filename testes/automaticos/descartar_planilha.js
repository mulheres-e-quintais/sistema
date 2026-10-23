/* Etapa 72 (22/10/2026): descartar a planilha de gastos enviada por engano (aba Financeiro, Planilhas enviadas).
   Uso: node testes/automaticos/descartar_planilha.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('button[data-p]');
  await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(900); await p.evaluate(() => MQ.ui.fecharPainel());
  const env = (nome, total, dias) => p.evaluate(async a => { const d = MQ.regras.somaDias(MQ.regras.hoje(), -a.dias);
    await MQ.ui.S.api.enviarPlanilhaExec({ posicao_em: d, arquivo_nome: a.nome, linhas: [{ linha: 1, item: 'material', rubrica: 'consumo', valor: a.total }], total_gasto: a.total, total_recebido: 0, nao_classificadas: 0, obs: null }, new Blob(['x'], { type: 'text/csv' })); }, { nome, total, dias });
  await env('certa.csv', 1000, 10); await p.waitForTimeout(30); await env('errada.csv', 999999, 20);
  await p.evaluate(async () => { await MQ.ui.carregar(); MQ.ui.S.aba = 'execucao'; MQ.ui.render(); }); await p.waitForTimeout(500);
  const vig = () => p.evaluate(() => (MQ.execUI.vigente() || {}).arquivo_nome);
  ok('1. a última enviada (a errada) é a vigente antes do descarte', (await vig()) === 'errada.csv', await vig());
  const id = await p.evaluate(() => (MQ.ui.S.execPlanilhas.find(x => x.arquivo_nome === 'errada.csv') || {}).id);
  ok('2. cada planilha tem "Descartar (enviada por engano)"', await p.evaluate(id => !!document.querySelector(`[data-acao=exec-descartar][data-id="${id}"]`), id));
  await p.click(`[data-acao=exec-descartar][data-id="${id}"]`); await p.waitForSelector('form[data-form=exec-descartar]');
  const aviso = await p.evaluate(() => document.querySelector('form[data-form=exec-descartar] .aviso').textContent.replace(/\s+/g, ' '));
  ok('3. o painel avisa que é a vigente e qual volta a valer', /vigente/.test(aviso) && /certa\.csv/.test(aviso), aviso.slice(0, 160));
  await p.click('form[data-form=exec-descartar] button[type=submit]'); await p.waitForTimeout(300);
  ok('4. sem motivo: barrado na tela', /motivo/i.test(await p.evaluate(() => document.querySelector('form[data-form=exec-descartar]').textContent)) && (await vig()) === 'errada.csv');
  await p.fill('#exd-mot', 'Arquivo errado: planilha de outro projeto'); await p.click('form[data-form=exec-descartar] button[type=submit]'); await p.waitForTimeout(800);
  ok('5. descartada: a certa volta a valer', (await vig()) === 'certa.csv', await vig());
  const linha = await p.evaluate(id => { const e = document.querySelector(`[data-planilha="${id}"]`); return e ? e.textContent.replace(/\s+/g, ' ') : ''; }, id);
  ok('6. a descartada continua na lista, marcada, com o motivo e sem o botão de baixar', /descartada/.test(linha) && /outro projeto/.test(linha) && !/Baixar o arquivo/.test(linha), linha.slice(0, 200));
  const arr = await p.evaluate(id => ({ recolhida: (e => !!e && !e.closest('details') && e.offsetHeight > 0 && e.offsetHeight < 90)(document.querySelector(`.pl-descartadas li.pl-desc[data-planilha="${id}"]`)), conta: (document.querySelector('#t-exl .conta-t') || {}).textContent, vigente: !!document.querySelector('.pl-cartao.vigente [data-acao=exec-baixar]') }), id);
  ok('6.1 a descartada fica em "Descartadas" como linha curta, à vista sem clicar, o número do título conta só as que valem e a vigente tem o botão de baixar', arr.recolhida && arr.conta === '1' && arr.vigente, arr);
  const hist = await p.evaluate(() => (MQ.apiDemo ? 1 : 1) && JSON.parse(localStorage.getItem('mq-demo-v4')).auditoria.some(a => a.tabela === 'execucao_planilhas' && a.acao === 'UPDATE' && (a.depois || {}).motivo_descarte));
  ok('7. o descarte fica no histórico', hist);
  const de = await p.evaluate(id => MQ.ui.S.api.descartarPlanilhaExec(id, 'De novo por engano').then(() => 'gravou', e => e.message), id);
  ok('8. descartar de novo é recusado', /já foi descartada/.test(de), de);
  ok('sem erro de página', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close(); const f = R.filter(r => r[0] === 'FALHOU').length; console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
