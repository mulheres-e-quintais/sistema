/* 22/10/2026: duas cargas ao mesmo tempo terminando fora de ordem (a do segundo plano, lenta, começa antes de gravar; a de depois
   de gravar termina primeiro). A tela tem de ficar com os dados novos (antes voltava aos de antes: "os painéis não atualizam").
   Uso: node testes/automaticos/carga_fora_de_ordem.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('button[data-p]');
  await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(900); await p.evaluate(() => MQ.ui.fecharPainel());
  await p.evaluate(async () => { MQ.ui.S.aba = 'execucao'; MQ.ui.render(); }); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => {
    const api = MQ.ui.S.api, orig = api.listarPlanilhasExec.bind(api); let n = 0;
    api.listarPlanilhasExec = async () => { const v = await orig(); if (n++ === 0) await new Promise(ok => setTimeout(ok, 1500)); return v; };   // a primeira (segundo plano) é lenta e traz a lista de ANTES
    const fundo = MQ.ui.carregar();   // atualização em segundo plano, começou antes de gravar
    await new Promise(ok => setTimeout(ok, 100));
    await api.enviarPlanilhaExec({ posicao_em: MQ.regras.hoje(), arquivo_nome: 'nova.csv', linhas: [{ linha: 1, item: 'material', rubrica: 'consumo', valor: 500 }], total_gasto: 500, total_recebido: 0, nao_classificadas: 0, obs: null }, new Blob(['x'], { type: 'text/csv' }));
    await MQ.ui.carregar(); const logoDepois = (MQ.ui.S.execPlanilhas || []).length; MQ.ui.render();
    await fundo; await new Promise(ok => setTimeout(ok, 200)); MQ.ui.render();
    api.listarPlanilhasExec = orig;
    return { logoDepois, fim: (MQ.ui.S.execPlanilhas || []).length, tela: /nova\.csv/.test(document.querySelector('main').textContent) };
  });
  ok('1. depois de gravar, a carga já traz a planilha nova', r.logoDepois === 1, r);
  ok('2. a carga antiga que chega depois não desfaz: a planilha nova continua na memória e na tela', r.fim === 1 && r.tela, r);
  ok('sem erro de página', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close(); const f = R.filter(x => x[0] === 'FALHOU').length; console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
