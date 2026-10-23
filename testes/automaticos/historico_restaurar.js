/* 23/10/2026: Histórico no padrão do Saberes que Cultivam — Atualizar por seção, acessos em tabela, "O que mudou (N)",
   "Restaurar como estava antes" (confirmação, conflito, marca de restauração) e celular sem rolagem para o lado.
   Uso: node testes/automaticos/historico_restaurar.js <caminho do playwright>   (servidor em http://localhost:8766) */
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
// duas alterações seguidas na mesma ficha, feitas "por outra pessoa" (direto no armazenamento da demonstração)
const alterar = (p, valores) => p.evaluate(async vs => {
  const d = JSON.parse(localStorage.getItem('mq-demo-v4')); const f = d.fichas[0];
  for (const v of vs) { const ant = JSON.parse(JSON.stringify(f)); f.comunidade = v;
    d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fichas', registro_id: f.id, acao: 'UPDATE', por: d.equipe.find(m => m.papel === 'coord_tecnico').id, em: new Date().toISOString(), antes: ant, depois: JSON.parse(JSON.stringify(f)) }); }
  localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await MQ.ui.S.api.reler(); await MQ.ui.carregar(); MQ.ui.S.aba = 'historico'; MQ.ui.render(); return f.id;
}, valores);
(async () => {
  const b = await chromium.launch();
  let p = await abrir(b, 1280);
  const fid = await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].id);
  const orig = await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].comunidade);
  await alterar(p, ['Comunidade A', 'Comunidade B']); await p.waitForTimeout(800);
  ok('1. título "Histórico" e as três seções (problemas, acessos, alterações)', await p.evaluate(() => document.querySelector('#t-h').textContent === 'Histórico' && !!document.querySelector('#t-relatos') && !!document.querySelector('#t-acessos') && !!document.querySelector('#t-reg')));
  ok('2. últimos acessos em tabela, com a situação de cada pessoa', await p.evaluate(() => document.querySelectorAll('#lista-acessos tbody tr').length > 0 && /Nunca entrou|Em uso/.test(document.querySelector('#lista-acessos').textContent)));
  ok('3. cada seção tem o seu Atualizar', await p.evaluate(() => !!document.querySelector('[data-acao=acessos-atualizar]') && !!document.querySelector('[data-acao=hist-atualizar]')));
  ok('4. alterações num quadro, com dias em destaque e "O que mudou (N)"', await p.evaluate(() => !!document.querySelector('.hs-quadro .hs-l .hs-dia') && /O que mudou \(\d+\)/.test(document.querySelector('.hs-quadro').textContent)));
  const ids = await p.evaluate(fid => MQ.ui.S.aud.filter(a => a.tabela === 'fichas' && a.acao === 'UPDATE' && a.registro_id === fid).map(a => a.id).sort((x, y) => x - y), fid);
  ok('5. as duas alterações têm "Restaurar como estava antes"; equipe não tem', ids.length === 2 && await p.evaluate(ids => ids.every(i => document.querySelector(`[data-acao=hist-restaurar][data-id="${i}"]`)) && !MQ.ui.S.aud.filter(a => a.tabela === 'equipe').some(a => document.querySelector(`[data-acao=hist-restaurar][data-id="${a.id}"]`)), ids), ids);
  // a mais nova: confirma e volta para A
  await p.click(`[data-acao=hist-restaurar][data-id="${ids[1]}"]`); await p.waitForSelector('.hs-rest-conf');
  const conf = await p.textContent('.hs-rest-conf');
  ok('6. primeiro toque mostra o que vai voltar e pede confirmação (nada muda ainda)', /Vai voltar/.test(conf) && /Comunidade B\s*→\s*Comunidade A/.test(conf) && await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].comunidade === 'Comunidade B'), conf.replace(/\s+/g, ' ').slice(0, 160));
  ok('6.1 o foco vai para o Confirmar', await p.evaluate(() => document.activeElement && document.activeElement.dataset.acao === 'hist-rest-ok'));
  await p.click('[data-acao=hist-rest-nao]'); await p.waitForTimeout(200);
  ok('7. Cancelar fecha a confirmação sem mudar nada', !(await p.$('.hs-rest-conf')) && await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].comunidade === 'Comunidade B'));
  await p.click(`[data-acao=hist-restaurar][data-id="${ids[1]}"]`); await p.click('[data-acao=hist-rest-ok]'); await p.waitForTimeout(900);
  ok('8. confirmado: a ficha voltou como estava antes da última alteração', await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].comunidade) === 'Comunidade A');
  ok('9. a restauração aparece no histórico com o selo "restauração"', /restauração/.test(await p.textContent('.hs-quadro .hs-l')));
  // a mais antiga: agora há mudanças depois → conflito
  await p.click(`[data-acao=hist-restaurar][data-id="${ids[0]}"]`); await p.click('[data-acao=hist-rest-ok]'); await p.waitForTimeout(500);
  ok('10. versão com mudanças depois: avisa o conflito e pede "Restaurar mesmo assim"', /mudou de novo depois/.test(await p.textContent('.hs-rest-conf')) && /Restaurar mesmo assim/.test(await p.textContent('[data-acao=hist-rest-ok]')));
  await p.click('[data-acao=hist-rest-ok]'); await p.waitForTimeout(900);
  ok('11. "Restaurar mesmo assim" devolve a versão mais antiga', await p.evaluate(() => JSON.parse(localStorage.getItem('mq-demo-v4')).fichas[0].comunidade) === orig);
  await p.click('[data-acao=hist-atualizar]'); await p.waitForTimeout(500);
  ok('12. Atualizar do histórico relê os registros', /Histórico atualizado/.test(await p.evaluate(() => document.body.textContent)));
  await p.click('[data-acao=acessos-atualizar]'); await p.waitForTimeout(500);
  ok('13. Atualizar dos acessos relê a lista', /Últimos acessos atualizados/.test(await p.evaluate(() => document.body.textContent)));
  ok('sem erro de página (computador)', !p.errs.length, p.errs.slice(0, 2).join(' | '));
  await p.context().close();
  for (const w of [320, 390, 768]) {
    p = await abrir(b, w); await alterar(p, ['Comunidade C']); await p.waitForTimeout(700);
    ok(`${w}px: sem rolagem para o lado no Histórico`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (w < 700) ok(`${w}px: acessos viram cartões (sem cabeçalho de tabela visível)`, await p.evaluate(() => { const th = document.querySelector('.hs-tab thead'); return !th || th.getBoundingClientRect().width <= 1; }));
    await p.click('[data-acao=hist-restaurar]'); await p.waitForSelector('.hs-rest-conf');
    ok(`${w}px: confirmação cabe na tela`, await p.evaluate(() => { const r = document.querySelector('.hs-rest-conf').getBoundingClientRect(); return r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
    ok(`${w}px: sem erro de página`, !p.errs.length, p.errs.slice(0, 2).join(' | '));
    await p.context().close();
  }
  await b.close();
  const f = R.filter(x => !x).length; console.log(`TOTAL ${R.length} FALHAS ${f}`); process.exit(f ? 1 : 0);
})();
