/* Etapa 70 (21/10/2026): questionário socioeconômico só para a própria pessoa e a coordenação geral (modo demonstração).
   Uso: node testes/automaticos/socio_restrito.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };
const SOCIO = { escolaridade: 'Ensino médio completo', raca_etnia: 'Parda', renda_familiar: 900, pessoas_casa: 4 };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort()); await ctx.route('**/viacep.com.br/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('button[data-p]');
  const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(700); await p.evaluate(() => MQ.ui.fecharPainel()); };
  const socioDe = id => p.evaluate(async id => { const x = await MQ.ui.S.api.lerPrivado(id); return x ? x.socioeconomico : null; }, id);
  const abrirCadastro = async id => { await p.evaluate(id => { MQ.convitesUI.esquecerPrivado && MQ.convitesUI.esquecerPrivado(id); MQ.ui.abrirPainel({ tipo: 'cadastro', id }); }, id);
    await p.waitForTimeout(900); await p.evaluate(() => MQ.ui.render()); await p.waitForTimeout(300); };

  await entrar('bolsista');
  const idB = await p.evaluate(() => MQ.ui.S.eu.id);
  await p.evaluate(async a => MQ.ui.S.api.salvarPrivado(a.id, { data_nascimento: '1985-03-10', nis: null, endereco: { cidade: 'Paulistana' }, socioeconomico: a.s }), { id: idB, s: SOCIO });
  ok('1. a própria pessoa responde e vê as respostas', JSON.stringify(await socioDe(idB)) === JSON.stringify(SOCIO));
  await entrar('coord_tecnico');
  ok('2. a coordenação técnica não recebe as respostas', (await socioDe(idB)) == null, await socioDe(idB));
  await abrirCadastro(idB);
  const tec = await p.evaluate(() => ({ campos: !!document.querySelector('#painel [name=tem_socio]'), nota: (document.querySelector('#painel [data-socio-restrito]') || {}).textContent || '' }));
  ok('3. no cadastro, a técnica não vê o questionário, e sim o aviso de quem vê', !tec.campos && /só a própria pessoa e a coordenação geral/.test(tec.nota), tec);
  if (await p.$('#painel form.f button[type=submit]')) { await p.click('#painel form.f button[type=submit]'); await p.waitForTimeout(900); }
  await entrar('bolsista');
  ok('4. a técnica salvou o cadastro e as respostas da pessoa continuam as mesmas', JSON.stringify(await socioDe(idB)) === JSON.stringify(SOCIO), await socioDe(idB));
  await entrar('auxiliar');
  ok('5. o auxiliar administrativo não recebe as respostas', (await socioDe(idB)) == null);
  await entrar('coord_geral');
  ok('6. a coordenação geral recebe as respostas', JSON.stringify(await socioDe(idB)) === JSON.stringify(SOCIO));
  await abrirCadastro(idB);
  const cg = await p.evaluate(() => ({ campos: !!document.querySelector('#painel [name=tem_socio]'), marcado: !!(document.querySelector('#painel [name=tem_socio]') || {}).checked,
    texto: ((document.querySelector('#painel [name=tem_socio]') || {}).closest ? document.querySelector('#painel [name=tem_socio]').closest('label').textContent : '') }));
  ok('7. no cadastro, a coordenação geral vê o questionário respondido e quem vê as respostas', cg.campos && cg.marcado && /só a própria pessoa e a coordenação geral/.test(cg.texto), cg);

  ok('sem erro de página', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  const f = R.filter(r => r[0] === 'FALHOU').length;
  console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
