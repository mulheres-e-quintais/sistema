const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  const perfil = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel()); };
  async function testa(nome, abrir, arquivo) {
    await p.evaluate(abrir); await p.waitForTimeout(400);
    const tem = await p.$('#painel .imp-barra [data-acao=imp-form]');
    ok(`${nome}: botão "Imprimir em branco" no formulário`, !!tem);
    if (!tem) return;
    // digita algo no formulário: NÃO pode sair no papel
    await p.evaluate(() => { const i = document.querySelector('#painel form input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file])'); if (i) i.value = 'NAO-DEVE-APARECER'; });
    const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click('#painel .imp-barra [data-acao=imp-form]')]);
    await pop.waitForLoadState('load'); await pop.waitForTimeout(500);
    const t = await pop.textContent('body');
    ok(`${nome}: cabeçalho com o projeto e o título`, /Mulheres & Quintais/.test(t) && /Processo/.test(t));
    ok(`${nome}: dados de quem aplica preenchidos`, /Aplicador\(a\)/.test(t) && await pop.$$eval('.dados dd', l => l.filter(x => x.textContent.trim()).length) >= 3);
    ok(`${nome}: sai em branco (nada digitado)`, !/NAO-DEVE-APARECER/.test(t));
    ok(`${nome}: tem perguntas e caixas`, (await pop.$$('.q')).length >= 3 && (await pop.$$('.bx, .ln')).length >= 5, (await pop.$$('.q')).length + ' perguntas');
    ok(`${nome}: símbolo do projeto carrega`, await pop.$eval('.topo img', i => i.complete && i.naturalWidth > 0));
    await pop.pdf({ path: `/tmp/claude-0/pw/cad/papel-${arquivo}.pdf`, format: 'A4', printBackground: true });

    await pop.close(); await p.evaluate(() => MQ.ui.fecharPainel());
  }
  await perfil('bolsista');
  await testa('Ficha (bolsista)', () => document.querySelector('[data-acao=ficha-nova]').click(), 'ficha');
  // visitas da demonstração
  const vs = await p.evaluate(() => MQ.ui.S.visitas.map(v => ({ id: v.id, etapa: v.etapa, sit: v.situacao, ex: v.executor_id, ficha: v.ficha_id })));
  await perfil('agente');
  const eu = await p.evaluate(() => MQ.ui.S.eu.id);
  const vd = vs.find(v => v.ex === eu && v.etapa === 'diagnostico' && v.sit === 'prevista') || vs.find(v => v.etapa === 'diagnostico');
  if (vd) await testa('Diagnóstico (agente)', new Function(`MQ.ui.abrirPainel({ tipo: 'diag-form', ficha: '${vd.ficha}', visita: '${vd.id}' })`), 'diagnostico');
  else ok('Diagnóstico: visita na demonstração', false, 'sem visita de diagnóstico');
  // a demonstração só tem visita de diagnóstico: cria uma de acompanhamento só na tela, para abrir o registro
  const va = await p.evaluate(eu => { const base = MQ.ui.S.visitas[0]; const v = Object.assign({}, base, { id: 'v-acomp-teste', etapa: 'acompanhamento', situacao: 'prevista', executor_id: eu });
    MQ.ui.S.visitas = MQ.ui.S.visitas.concat([v]); return { id: v.id, ficha: v.ficha_id }; }, eu);
  await testa('Visita feita (agente)', new Function(`MQ.ui.abrirPainel({ tipo: 'visita-feita', id: '${va.id}' })`), 'visita');
  await testa('Avaliação final (agente)', new Function(`MQ.ui.abrirPainel({ tipo: 'aval-form', ficha: '${vd ? vd.ficha : va.ficha}', visita: '${va.id}' })`), 'avaliacao');
  // perfis que não preenchem: sem botão
  await perfil('coord_geral');
  await p.evaluate(() => document.querySelector('[data-aba=selecao]') && document.querySelector('[data-aba=selecao]').click());
  await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'ficha-form' })); await p.waitForTimeout(300);
  ok('Coordenação geral: sem botão de imprimir na ficha', !(await p.$('#painel .imp-barra')));
  await p.evaluate(() => MQ.ui.fecharPainel());
  await perfil('auxiliar'); await p.evaluate(() => MQ.ui.abrirPainel({ tipo: 'ficha-form' })); await p.waitForTimeout(300);
  ok('Auxiliar: sem botão de imprimir', !(await p.$('#painel .imp-barra')));
  ok('sem erro de página', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
