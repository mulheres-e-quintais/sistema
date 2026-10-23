/* 23/10/2026: Histórico no padrão do Saberes que Cultivam — Atualizar por seção, acessos em tabela, "O que mudou (N)",
   sem "Restaurar como estava antes" (decisão da coordenação; o 75 apaga a função) e celular sem rolagem para o lado.
   Uso: node testes/automaticos/historico_cultivos.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
async function abrir(b, w) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, locale: 'pt-BR' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('button[data-p]');
  await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(900); await p.evaluate(() => MQ.ui.fecharPainel());
  return p;
}
// uma alteração na ficha feita "por outra pessoa" (direto no armazenamento da demonstração)
const alterar = p => p.evaluate(async () => {
  const d = JSON.parse(localStorage.getItem('mq-demo-v4')); const f = d.fichas[0]; const ant = JSON.parse(JSON.stringify(f)); f.comunidade = 'Comunidade Nova';
  d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fichas', registro_id: f.id, acao: 'UPDATE', por: d.equipe.find(m => m.papel === 'coord_tecnico').id, em: new Date().toISOString(), antes: ant, depois: JSON.parse(JSON.stringify(f)) });
  localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await MQ.ui.S.api.reler(); await MQ.ui.carregar(); MQ.ui.S.aba = 'historico'; MQ.ui.render();
});
(async () => {
  const b = await chromium.launch();
  let p = await abrir(b, 1280); await alterar(p); await p.waitForTimeout(800);
  ok('1. título "Histórico" e as três seções (problemas, acessos, alterações)', await p.evaluate(() => document.querySelector('#t-h').textContent === 'Histórico' && !!document.querySelector('#t-relatos') && !!document.querySelector('#t-acessos') && !!document.querySelector('#t-reg')));
  ok('2. últimos acessos em tabela, com a situação de cada pessoa', await p.evaluate(() => document.querySelectorAll('#lista-acessos tbody tr').length > 0 && /Nunca entrou|Em uso/.test(document.querySelector('#lista-acessos').textContent)));
  ok('3. cada seção tem o seu Atualizar', await p.evaluate(() => !!document.querySelector('[data-acao=relato-atualizar]') && !!document.querySelector('[data-acao=acessos-atualizar]') && !!document.querySelector('[data-acao=hist-atualizar]')));
  ok('4. alterações num quadro, com dias em destaque e "O que mudou (N)"', await p.evaluate(() => !!document.querySelector('.hs-quadro .hs-l .hs-dia') && /O que mudou \(\d+\)/.test(document.querySelector('.hs-quadro').textContent)));
  await p.evaluate(() => { const d = document.querySelector('.hs-d'); if (d) d.open = true; });
  ok('5. "O que mudou" mostra o valor de antes riscado e o novo', await p.evaluate(() => [...document.querySelectorAll('.hs-d')].some(d => d.querySelector('s') && /Comunidade Nova/.test(d.textContent))));
  ok('6. sem "Restaurar como estava antes"', !(await p.$('[data-acao=hist-restaurar]')) && !/Restaurar como estava antes/.test(await p.textContent('main')));
  await p.click('[data-acao=hist-atualizar]'); await p.waitForTimeout(500);
  ok('7. Atualizar do histórico relê os registros', /Histórico atualizado/.test(await p.evaluate(() => document.body.textContent)));
  await p.click('[data-acao=acessos-atualizar]'); await p.waitForTimeout(500);
  ok('8. Atualizar dos acessos relê a lista', /Últimos acessos atualizados/.test(await p.evaluate(() => document.body.textContent)));
  // 23/10: recarregar e abrir Documentos (ou o Histórico) mostra "Carregando…"; o menu de cima não pode esticar enquanto isso
  { const alt = () => p.evaluate(() => Math.round(document.querySelector('nav.abas').getBoundingClientRect().height));
    const antes = await alt(); await p.reload(); await p.waitForTimeout(1200);
    await p.evaluate(() => { const api = MQ.ui.S.api; const o = api.listarDocumentos.bind(api); api.listarDocumentos = () => new Promise(r => setTimeout(() => r(o()), 1500)); });
    await p.click('[data-aba="documentos"]'); await p.waitForTimeout(150);
    const durante = await alt(), carregando = await p.evaluate(() => !!document.querySelector('[data-carregando-aba]'));
    ok('9. recarregar e abrir Documentos: o menu de cima fica do mesmo tamanho durante o "Carregando…"', carregando && Math.abs(durante - antes) <= 4, { antes, durante, carregando });
    await p.waitForTimeout(1800); }
  ok('sem erro de página (computador)', !p.errs.length, p.errs.slice(0, 2).join(' | '));
  await p.context().close();
  for (const w of [320, 390, 768]) {
    p = await abrir(b, w); await alterar(p); await p.waitForTimeout(700);
    ok(`${w}px: sem rolagem para o lado no Histórico`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (w < 700) ok(`${w}px: acessos viram cartões (sem cabeçalho de tabela visível)`, await p.evaluate(() => { const th = document.querySelector('.hs-tab thead'); return !th || th.getBoundingClientRect().width <= 1; }));
    ok(`${w}px: sem erro de página`, !p.errs.length, p.errs.slice(0, 2).join(' | '));
    await p.context().close();
  }
  await b.close();
  const f = R.filter(x => !x).length; console.log(`TOTAL ${R.length} FALHAS ${f}`); process.exit(f ? 1 : 0);
})();
