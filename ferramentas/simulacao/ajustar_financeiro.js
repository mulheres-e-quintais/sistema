/* Mulheres & Quintais — segundo passo do gerar.sh: fecha a planilha de gastos da simulação sem estouro.
   Os valores da planilha do 95 são inventados e, somados ao que o sistema já sabe (bolsas com aval, passagens autorizadas
   depois da planilha), passavam do previsto em algumas rubricas: a prévia do fim do projeto mostrava estouro que não existe.
   Aqui, com as mesmas contas da aba Financeiro (MQ.execUI.numeros), cada item que passaria de 99,5% do previsto tem as
   linhas da planilha reduzidas na proporção. Abre a página simulacao.html num navegador sem tela, lendo os arquivos do disco.
   Uso: node ferramentas/simulacao/ajustar_financeiro.js <caminho do playwright> */
const fs = require('fs'); const path = require('path');
const { chromium } = require(process.argv[2] || 'playwright');
const raiz = path.join(__dirname, '..', '..'); const ARQ = path.join(raiz, 'js', 'simulacao-dados.js');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route('http://sim.local/**', r => { const f = path.join(raiz, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(f), contentType: TIPOS[path.extname(f)] || 'application/octet-stream' }); });
  await p.route(/^(?!http:\/\/sim\.local)/, r => r.abort());
  await p.goto('http://sim.local/simulacao.html'); await p.waitForFunction(() => MQ.ui && MQ.ui.S && MQ.ui.S.eu && (MQ.ui.S.execPlanilhas || []).length, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const n = MQ.execUI.numeros(); const pl = MQ.execUI.vigente(); const itens = MQ.ORCAMENTO.rubricas.flatMap(x => x.itens);
    const fator = {}; itens.forEach(i => { const x = n.porItem[i.id]; const teto = i.total * 0.995;
      if (x && x.exec > 0 && x.exec + x.comp > teto) fator[i.id] = Math.max(0, (teto - x.comp) / x.exec); });
    const linhas = pl.linhas.map(l => fator[l.item] != null ? Object.assign({}, l, { valor: Math.round(l.valor * fator[l.item] * 100) / 100 }) : l);
    const gasto = Math.round(linhas.filter(l => l.item !== 'repasse_mda').reduce((t, l) => t + (+l.valor || 0), 0) * 100) / 100;
    return { id: pl.id, linhas, gasto, ajustados: Object.keys(fator), antes: Math.round((n.exec + n.comp) / MQ.ORCAMENTO.total * 1000) / 10 };
  });
  await b.close();
  global.window = {}; const MQ = {}; new Function('window', 'MQ', fs.readFileSync(ARQ, 'utf8').replace('window.MQ = window.MQ || {};', ''))(global.window, MQ);
  const d = MQ.SIM_FIM; const pl = d.execPlanilhas.find(x => x.id === r.id);
  pl.linhas = r.linhas; pl.total_gasto = r.gasto;
  const txt = fs.readFileSync(ARQ, 'utf8'); const cab = txt.slice(0, txt.indexOf('MQ.SIM_FIM = '));
  fs.writeFileSync(ARQ, cab + 'MQ.SIM_FIM = ' + JSON.stringify(d) + ';\n');
  console.log(`planilha ajustada: ${r.ajustados.length} itens reduzidos (${r.ajustados.join(', ') || 'nenhum'}); antes ${r.antes}% do orçamento`);
})().catch(e => { console.error(e); process.exit(1); });
