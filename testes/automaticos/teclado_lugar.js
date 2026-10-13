/* v261: (1) todo bloco de conteúdo alcançável pelo Tab, sem cara de link; (2) quem sai do sistema volta para a mesma aba.
   Uso: node testes/automaticos/teclado_lugar.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(600); await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(300); };
  await entrar('coord_geral');
  // 1. a "Situação do campo em cada estado" (só leitura) entra na sequência do Tab, antes de "O que pede atenção"
  await p.evaluate(() => { const m = document.querySelector('main'); m.setAttribute('tabindex', '-1'); m.focus(); });
  const seq = [];
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const e = document.activeElement; const id = e.getAttribute('aria-labelledby'); return (id && document.getElementById(id) ? document.getElementById(id).textContent : e.textContent || '').trim().slice(0, 40); })); }
  const iP = seq.findIndex(t => /^Situação do campo em cada estado/.test(t)), iA = seq.findIndex(t => /^O que pede atenção/.test(t));
  ok('Tab chega na "Situação do campo em cada estado"', iP >= 0, seq.slice(10, 25).join(' / '));
  ok('e depois em "O que pede atenção"', iA > iP && iP >= 0);
  const sec = await p.evaluate(() => { const s = document.querySelector('section.prontidao'); s.focus(); const c = getComputedStyle(s);
    return { tab: s.tabIndex, cursor: c.cursor, deco: c.textDecorationLine, outline: c.outlineStyle, rotulo: s.getAttribute('aria-labelledby') }; });
  ok('sem cara de link: cursor normal, sem sublinhado', sec.cursor === 'auto' && sec.deco === 'none', JSON.stringify(sec));
  ok('com contorno de foco ao chegar pelo teclado', sec.outline === 'solid', JSON.stringify(sec));
  ok('o leitor de tela anuncia o título do bloco', sec.rotulo === 't-pront');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok('Enter no bloco não faz nada (não é link)', !(await p.$('#painel aside')) && await p.evaluate(() => document.activeElement.matches('section.prontidao')));
  // abas do menu de cima: o foco pelo teclado também pinta o fundo (não só o contorno)
  await p.evaluate(() => document.querySelector('nav.abas [data-aba]').focus()); await p.keyboard.press('Tab');
  const fundoAba = await p.evaluate(() => getComputedStyle(document.activeElement).backgroundColor);
  ok('aba do menu com foco do teclado ganha fundo realçado', !/rgba\(0, 0, 0, 0\)|transparent/.test(fundoAba), fundoAba);
  // menu de cima pelo teclado: Enter numa aba abre a aba e o foco fica nela; o próximo Tab vai para a aba seguinte
  await p.evaluate(() => document.querySelector('nav.abas [data-aba="equipe"]').focus()); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const depoisEnter = await p.evaluate(() => ({ aba: MQ.ui.S.aba, foco: document.activeElement.dataset.aba }));
  await p.keyboard.press('Tab');
  const proximo = await p.evaluate(() => { const l = [...document.querySelectorAll('nav.abas [data-aba]')].map(b => b.dataset.aba); return { foco: document.activeElement.dataset.aba, esperado: l[l.indexOf('equipe') + 1] }; });
  ok('Enter na aba: abre e o foco continua nela', depoisEnter.aba === 'equipe' && depoisEnter.foco === 'equipe', JSON.stringify(depoisEnter));
  ok('o Tab seguinte vai para a próxima aba do menu (não volta ao começo)', proximo.foco && proximo.foco === proximo.esperado, JSON.stringify(proximo));
  await p.evaluate(() => document.querySelector('nav.abas [data-aba="visao"]').click()); await p.waitForTimeout(400);
  // em todas as abas da coordenação: todo bloco de conteúdo fora de formulário é parada do Tab
  const abas = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-aba]')].map(x => x.dataset.aba))]);
  const faltas = [];
  for (const ab of abas) {
    await p.evaluate(ab => document.querySelector(`[data-aba="${ab}"]`).click(), ab); await p.waitForTimeout(400);
    const f = await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && !e.closest('form') && !e.matches('a[href],button,input,select,textarea,summary,label') && e.tabIndex < 0 && ![...e.querySelectorAll('*')].some(d => d.tabIndex >= 0)).map(e => e.className).slice(0, 3), await p.evaluate(() => MQ.teclado.BLOCOS));
    if (f.length) faltas.push(ab + ': ' + f.join(','));
  }
  ok(`todas as ${abas.length} abas: todo bloco é parada do Tab ou tem paradas dentro`, abas.length > 5 && !faltas.length, faltas.join(' | '));
  // sem parada repetida: bloco que já é parada não tem outro bloco-parada que só o embrulha; e os quadros roláveis têm nomes diferentes
  await p.evaluate(() => document.querySelector('[data-aba="visao"]').click()); await p.waitForTimeout(500);
  const aninh = await p.evaluate(() => [...document.querySelectorAll('[data-tab-bloco]')].filter(e => e.parentElement && e.parentElement.closest('[data-tab-bloco]:not(section)')).length);
  ok('Visão geral: nenhum bloco-parada dentro de outro bloco-parada (fora as seções)', aninh === 0, String(aninh));
  ok('"Pular para o conteúdo" é o primeiro item do Tab e leva ao conteúdo', await p.evaluate(() => { document.activeElement && document.activeElement.blur(); return true; }) && await (async () => {
    await p.evaluate(() => { document.body.setAttribute('tabindex', '-1'); document.body.focus(); }); await p.keyboard.press('Tab');
    const primeiro = await p.evaluate(() => document.activeElement.className); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    return primeiro === 'pular' && await p.evaluate(() => document.activeElement.tagName === 'MAIN'); })());
  // dentro de formulário, o Tab vai de campo em campo (bloco não vira parada)
  await p.evaluate(() => { const S = MQ.ui.S; document.body.insertAdjacentHTML('beforeend', `<button id="ab" data-acao="campo-diag-novo" data-ficha="${S.fichas.find(x => x.resultado === 'selecionada').id}"></button>`); document.getElementById('ab').click(); document.getElementById('ab').remove(); });
  await p.waitForTimeout(500);
  ok('formulário: nenhum bloco extra no caminho do Tab', await p.evaluate(() => !document.querySelector('#painel form [data-tab-bloco]')));
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200);

  // menu "Baixar planilha" da Seleção: abre pelo teclado e fecha com Esc, voltando o foco ao botão
  await p.evaluate(() => document.querySelector('[data-acao=aba][data-aba=selecao]').click()); await p.waitForTimeout(400);
  await p.focus('.menu-planilha > summary'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  const abriu = await p.evaluate(() => document.querySelector('.menu-planilha').open);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('menu da planilha: Enter abre, Esc fecha e o foco volta ao botão', abriu && await p.evaluate(() => !document.querySelector('.menu-planilha').open && document.activeElement.matches('.menu-planilha > summary')));
  await p.click('.menu-planilha > summary'); await p.click('h1'); await p.waitForTimeout(100);
  ok('menu da planilha fecha com clique fora', await p.evaluate(() => !document.querySelector('.menu-planilha').open));

  // 2. sair e entrar de novo: volta para a mesma aba e altura
  await p.evaluate(() => document.querySelector('[data-aba="pagamentos"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(150);
  await p.evaluate(() => MQ.ui.sair()); await p.waitForTimeout(500);
  const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem('mq-voltar') || 'null'));
  ok('ao sair, guarda a aba e a altura de quem saiu (só isso)', guardado && guardado.aba === 'pagamentos' && guardado.y > 0 && Object.keys(guardado).sort().join() === 'aba,em,quem,y', JSON.stringify(guardado));
  await entrar('coord_geral'); await p.waitForTimeout(300);
  ok('a mesma pessoa entra de novo: volta para Pagamentos', await p.evaluate(() => MQ.ui.S.aba === 'pagamentos' && /Pagamentos/.test(document.querySelector('[data-aba="pagamentos"][aria-current], [data-aba="pagamentos"].ativa, [data-aba="pagamentos"][aria-selected="true"]')?.textContent || document.title + MQ.ui.S.aba)));
  ok('e na mesma altura da tela', Math.abs((await p.evaluate(() => window.scrollY)) - guardado.y) < 40, String(await p.evaluate(() => window.scrollY)));
  ok('o lugar guardado é usado uma vez só', await p.evaluate(() => localStorage.getItem('mq-voltar') === null));
  // outra pessoa no mesmo aparelho não herda o lugar
  await p.evaluate(() => document.querySelector('[data-aba="documentos"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => MQ.ui.sair()); await p.waitForTimeout(400);
  await entrar('coord_tecnico');
  ok('outra pessoa que entra começa do início', await p.evaluate(() => MQ.ui.S.aba !== 'documentos'));
  ok('sem erro de página', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
