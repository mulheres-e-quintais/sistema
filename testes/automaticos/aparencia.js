/* Aparência da tela (v261): modo sol e tema claro/escuro/automático, guardados no aparelho.
   Uso: node testes/automaticos/aparencia.js <caminho do playwright> [pasta para fotos da tela]   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]); const FOTOS = process.argv[3];
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 860 }, colorScheme: 'light' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  const foto = async n => { if (FOTOS) await p.screenshot({ path: `${FOTOS}/${n}.png` }); };
  const attr = () => p.evaluate(() => ({ tema: document.documentElement.getAttribute('data-theme'), sol: document.documentElement.hasAttribute('data-sol') }));
  const cor = sel => p.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
  let a = await attr(); ok('sem escolha: segue o celular (sem tema forçado, sem modo sol)', a.tema === null && !a.sol, JSON.stringify(a));
  await p.evaluate(() => { MQ.ui.fecharPainel(); document.querySelector('button[data-p=bolsista]').click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200);   // o aviso do cadastro abre sozinho na demonstração
  ok('botão de aparência na barra de cima', !!(await p.$('.barra .btn-aparencia')));
  await foto('1-normal');
  await p.click('.barra .btn-aparencia'); await p.waitForTimeout(300);
  ok('painel "Aparência da tela" abre', /Aparência da tela/.test(await p.textContent('#painel')));
  ok('chave do modo sol começa desligada', (await p.getAttribute('[data-acao=aparencia-sol]', 'aria-checked')) === 'false');
  await foto('2-painel');
  await p.evaluate(() => { document.querySelector('main').dataset.velho = '1'; });
  await p.click('[data-acao=aparencia-sol]'); await p.waitForTimeout(300);
  ok('a página atrás do painel é redesenhada na hora (Safari não repinta sozinho)', await p.evaluate(() => !document.querySelector('main[data-velho]') && !!document.querySelector('main')));
  a = await attr(); ok('modo sol liga na hora: tela clara e modo sol', a.tema === 'light' && a.sol, JSON.stringify(a));
  ok('fundo fica branco puro', (await cor('body')) === 'rgb(255, 255, 255)', await cor('body'));
  ok('a chave mostra ligado e o foco fica nela', (await p.getAttribute('[data-acao=aparencia-sol]', 'aria-checked')) === 'true' && await p.evaluate(() => document.activeElement.dataset.acao === 'aparencia-sol'));
  ok('com modo sol, o tema não se escolhe (fica claro)', await p.evaluate(() => [...document.querySelectorAll('[data-acao=aparencia-tema]')].every(x => x.disabled)));
  ok('o botão da barra mostra que está ligado', !!(await p.$('.barra .btn-aparencia.ligado')));
  await foto('3-painel-sol');
  await p.click('#painel .fechar'); await p.waitForTimeout(300); await foto('4-tela-sol');
  const borda = await p.evaluate(() => { const i = document.createElement('div'); i.className = 'campo'; i.innerHTML = '<input>'; document.body.appendChild(i); const w = getComputedStyle(i.querySelector('input')).borderTopWidth; i.remove(); return w; });
  ok('campos de formulário com borda grossa no modo sol', borda === '2px', borda);
  // continua depois de recarregar e de sair da conta
  await p.reload(); await p.waitForTimeout(700); await p.evaluate(() => MQ.ui.fecharPainel()); a = await attr(); ok('a escolha continua depois de recarregar', a.sol, JSON.stringify(a));
  await p.evaluate(() => MQ.ui.sair()); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200); a = await attr(); ok('a escolha continua depois de sair da conta', a.sol, JSON.stringify(a));
  await foto('5-entrada-sol');
  ok('na tela de entrada há o botão "Modo sol" (ligado)', /modo sol ligado/.test(await p.getAttribute('.ent-aparencia', 'aria-label').catch(() => '')) && !!(await p.$('.ent-aparencia.ligado')));
  // desliga o sol e escolhe escuro (pela tela de entrada)
  await p.click('.ent-aparencia'); await p.waitForTimeout(300);
  await p.click('[data-acao=aparencia-sol]'); await p.waitForTimeout(200);
  await p.click('[data-acao=aparencia-tema][data-v=escuro]'); await p.waitForTimeout(300);
  a = await attr(); ok('tema escuro escolhido à mão (mesmo com o celular claro)', a.tema === 'dark' && !a.sol, JSON.stringify(a));
  ok('fundo escuro', (await cor('body')) === 'rgb(22, 17, 14)', await cor('body'));
  await foto('6-escuro');
  await p.click('[data-acao=aparencia-tema][data-v=auto]'); await p.waitForTimeout(200);
  a = await attr(); ok('Automático volta a seguir o celular', a.tema === null, JSON.stringify(a));
  // dado estragado no aparelho não quebra
  await p.evaluate(() => localStorage.setItem('mq-aparencia', '{lixo')); await p.reload(); await p.waitForTimeout(600);
  a = await attr(); ok('preferência estragada no aparelho: volta ao padrão sem erro', a.tema === null && !a.sol, JSON.stringify(a));
  ok('sem erro de página', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
