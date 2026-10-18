/* Padrão de formulários e uso em campo (auditoria de UX de 18/10/2026).
   Guia de seções dos formulários longos, larguras de campo no painel largo, barra de salvar, campos condicionais,
   alvos de toque de 44 px, aviso sem internet, cor dos indicadores e "Nova situação" da água sem resposta pronta.
   Uso: node testes/automaticos/padrao_formularios.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, typeof d === 'string' ? d : JSON.stringify(d)]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function sessao(w, h, toque) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: toque, isMobile: toque });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo, .dx-topo');
    return { ctx, p };
  }
  const perfil = async (p, pf) => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(600); await p.evaluate(() => MQ.ui.fecharPainel()); };
  const abrir = async (p, spec) => { await p.evaluate(spec => { const S = MQ.ui.S; const d = (S.diagnosticos || [])[0];
    const x = Object.assign({}, spec); if (x.ficha === '@diag') x.ficha = d.ficha_id; if (x.visita === '@diag') x.visita = d.visita_id;
    if (x.id === '@semagua') x.id = ((S.fichas || []).find(f => f.resultado === 'sem_agua') || {}).id;
    MQ.ui.fecharPainel(); MQ.ui.abrirPainel(x); }, spec); await p.waitForTimeout(500); };

  /* ---------- 1. computador (1440): guia, larguras, cor dos indicadores ---------- */
  { const { ctx, p } = await sessao(1440, 1000, false);
    await perfil(p, 'coord_geral');
    ok('Indicador que chegou à meta fica verde; os outros, neutros (cor não vem mais da posição)', await p.evaluate(() => {
      const ks = [...document.querySelectorAll('.dx-kpi')]; if (!ks.length) return 'sem indicadores';
      return ks.every(k => { const c = getComputedStyle(k).getPropertyValue('--kc').trim(); return k.classList.contains('cumprido') ? /#2E7D43|#7CC77F/i.test(c) : !/#2E7D43|#C08A1E/i.test(c); }); }) === true);
    await abrir(p, { tipo: 'diag-form', ficha: '@diag', visita: '@diag' });
    const g = await p.evaluate(() => { const n = document.querySelector('#painel .guia-form'); return n && { pos: n.querySelector('.gf-pos').textContent, n: n.querySelectorAll('[data-gf]').length,
      sticky: getComputedStyle(n).position, conta: n.querySelector('.gf-conta').textContent }; });
    ok('Diagnóstico: guia com as 13 seções, preso no topo', g && g.n === 13 && g.sticky === 'sticky' && /^Seção 1 de 13/.test(g.pos), g);
    await p.evaluate(() => document.querySelectorAll('#painel .gf-lista button')[9].click()); await p.waitForTimeout(900);
    ok('Tocar na seção 10 leva até ela e o guia diz "Seção 10 de 13"', /^Seção 10 de 13/.test(await p.textContent('#painel .gf-pos')), await p.textContent('#painel .gf-pos'));
    const lg = await p.evaluate(() => { const w = s => Math.round(document.querySelector(s).closest('.campo').getBoundingClientRect().width);
      return { data: w('#dg-data'), corpo: Math.round(document.querySelector('#painel .painel-corpo').clientWidth) }; });
    ok('Painel largo: data com cerca de 1/3 da linha (antes metade)', lg.data < lg.corpo * 0.4, lg);
    ok('Sem localização registrada? O "por quê" fica escondido quando a localização já existe', await p.evaluate(() => { const w = document.querySelector('#w-sem_gps_motivo'); const lat = document.querySelector('form[data-form=diag] [name=latitude]').value; return lat ? w.hidden : !w.hidden; }));
    await abrir(p, { tipo: 'aval-form', ficha: '@diag' });
    ok('Avaliação: guia de seções e itens obrigatórios marcados com *', await p.evaluate(() => !!document.querySelector('#painel .guia-form') && document.querySelectorAll('form[data-form=aval] .obr').length >= 4));
    const cond = await p.evaluate(async () => { const w = document.querySelector('[data-mostra-se]'); const antes = w.hidden;
      const r = document.querySelector('form[data-form=aval] input[name=quintal_produz][value=em_parte]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
      const depois = w.hidden; const s = document.querySelector('form[data-form=aval] input[name=quintal_produz][value=sim]'); s.checked = true; s.dispatchEvent(new Event('change', { bubbles: true }));
      return { antes, depois, volta: w.hidden }; });
    ok('Avaliação: "Por que não está produzindo" só aparece com "Em parte" ou "Não"', cond.antes === true && cond.depois === false && cond.volta === true, cond);
    ok('Foto obrigatória com o mesmo * dos outros campos (não mais o asterisco escrito no texto)', await p.evaluate(() => /\*/.test(document.querySelector('label[for=av-f-geral] .obr').textContent) && !/\* *$/.test(document.querySelector('label[for=av-f-geral]').childNodes[0].textContent)));
    await ctx.close(); }

  /* ---------- 2. celular (390, toque): alvos, barra de salvar, sem internet ---------- */
  { const { ctx, p } = await sessao(390, 844, true);
    await perfil(p, 'bolsista');
    const peq = await p.evaluate(() => [...document.querySelectorAll('main button, main a.btn, main summary, main .seg button')].filter(e => e.checkVisibility() && !e.closest('.pular'))
      .map(e => [e.getBoundingClientRect(), (e.textContent || '').trim().slice(0, 30)]).filter(([q]) => q.height < 43.5).map(([q, t]) => t + ' ' + Math.round(q.height)));
    ok('Celular: nenhum botão da tela inicial abaixo de 44 px de altura', peq.length === 0, peq.slice(0, 6));
    await p.evaluate(() => document.querySelector('[data-acao=ficha-nova]').click()); await p.waitForTimeout(500);
    const barra = await p.evaluate(() => { const a = document.querySelector('form[data-form=ficha] > .acoes:last-child'); const q = a.querySelector('[type=submit]').getBoundingClientRect(); return { pos: getComputedStyle(a).position, fundo: Math.round(q.bottom), h: innerHeight }; });
    ok('Ficha no celular: Salvar preso embaixo, à vista sem rolar', barra.pos === 'sticky' && barra.fundo <= barra.h + 1, barra);
    ok('Ficha no celular: guia de 5 seções numa linha que rola para o lado', await p.evaluate(() => { const l = document.querySelector('#painel .gf-lista'); return l && l.querySelectorAll('button').length === 5 && getComputedStyle(l).overflowX === 'auto'; }));
    ok('Foto do termo e da ficha em papel: dá para escolher da galeria (sem capture)', await p.evaluate(() => !document.querySelector('#fi-ft').hasAttribute('capture') && !document.querySelector('#fi-ff').hasAttribute('capture')));
    await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline'))); await p.waitForTimeout(200);
    const aviso = await p.evaluate(() => getComputedStyle(document.querySelector('form[data-form=ficha] > .acoes:last-child'), '::before').content);
    ok('Sem internet: a barra de salvar avisa que fica guardado no aparelho', /guardado neste aparelho/.test(aviso), aviso);
    await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online')));
    await p.evaluate(() => { MQ.ui.fecharPainel(); }); await p.waitForTimeout(300);
    await ctx.close(); }

  /* ---------- 3. tablet (1024, toque): alvos e água ---------- */
  { const { ctx, p } = await sessao(1024, 768, true);
    await perfil(p, 'coord_geral');
    const peq = await p.evaluate(() => [...document.querySelectorAll('#app button, #app summary')].filter(e => e.checkVisibility() && !e.closest('.pular') && !e.closest('svg'))
      .map(e => [e.getBoundingClientRect(), (e.textContent || '').trim().slice(0, 30)]).filter(([q]) => q.height < 43.5 || q.width < 43.5).map(([q, t]) => t + ' ' + Math.round(q.width) + 'x' + Math.round(q.height)));
    ok('Tablet: nenhum botão abaixo de 44 × 44 px', peq.length === 0, peq.slice(0, 6));
    await abrir(p, { tipo: 'agua-ver', id: '@semagua' });
    const ag = await p.evaluate(() => { const s = document.querySelector('#ag-sit'); return s ? { valor: s.value, req: s.required } : null; });
    ok('Água: "Nova situação" começa sem resposta escolhida (antes vinha "Sem água")', ag && ag.valor === '' && ag.req, ag);
    if (ag) {
      await p.fill('form[data-form=agua-registrar] textarea[name=obs]', 'Conversa com a família sobre a cisterna.');
      await p.evaluate(() => document.querySelector('form[data-form=agua-registrar] [type=submit]').click()); await p.waitForTimeout(400);
      ok('Água: sem escolher a situação, não grava e explica', /Escolha a nova situação/.test(await p.textContent('#painel')) && !!(await p.$('#ag-sit')));
    }
    await ctx.close(); }

  ok('Sem erro de página', errs.length === 0, errs.join(' | '));
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); const f = R.filter(r => r[0] === 'FALHOU').length;
  console.log('TOTAL', R.length, 'FALHAS', f); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
