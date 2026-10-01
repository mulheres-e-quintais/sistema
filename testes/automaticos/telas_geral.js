// Plano de testes geral: fluxos pelos atalhos, ajuda de cada página, duplicidades, lentidão, padrão visual
const { chromium } = require(process.argv[2]);
const fs = require('fs');
const R = []; const ok = (g, n, c, d = '') => R.push([g, c ? 'PASSOU' : 'FALHOU', n, d]);
const SRC = fs.readdirSync('/home/claude/sistema/js').filter(f => f.endsWith('.js') && !['ajuda.js', 'tudo.js'].includes(f)).map(f => fs.readFileSync('/home/claude/sistema/js/' + f, 'utf8')).join('\n');
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: 'pt-BR' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  const t0 = Date.now(); await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  ok('Lentidão', 'Sistema abre em menos de 3 s', Date.now() - t0 < 3000, (Date.now() - t0) + ' ms');
  const como = async pf => { const t = Date.now(); await p.click(`button[data-acao=perfil][data-p=${pf}]`); await p.waitForFunction(() => document.querySelector('main h1')); const ms = Date.now() - t; await p.waitForTimeout(700); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel()); await p.waitForTimeout(120); return ms; };

  // ---------- 1. Atalhos levam à parte certa (caminho mais curto)
  const ATALHOS = { bolsista: ['#t-campo', '#t-ent', '#t-pag', '#t-viag'], agente: ['#t-prox', '#t-feitas', '#t-pag'], professor: ['#t-turmas', '#t-ava', '#t-pag'], auxiliar: ['#t-arlo', '#t-lancar', '#t-pag'] };
  for (const [pf, alvos] of Object.entries(ATALHOS)) {
    const ms = await como(pf);
    ok('Lentidão', `Trocar para ${pf} em menos de 1,5 s`, ms < 1500, ms + ' ms');
    const topo = await p.evaluate(() => { const a = document.querySelector('.atalhos'); return a ? Math.round(a.getBoundingClientRect().top + scrollY) : null; });
    ok('Caminho curto', `${pf}: atalhos aparecem no topo, sem rolar`, topo != null && topo < 740, 'y=' + topo);
    for (const alvo of alvos) {
      const bt = await p.$(`.atalhos [data-alvo="${alvo}"]:not([hidden])`);
      if (!bt) { ok('Caminho curto', `${pf}: atalho para ${alvo}`, false, 'botão não aparece'); continue; }
      await p.evaluate(() => window.scrollTo(0, 0)); await bt.click(); await p.waitForTimeout(700);
      const y = await p.evaluate(a => Math.round(document.querySelector(a).getBoundingClientRect().top), alvo);
      ok('Caminho curto', `${pf}: 1 toque leva a ${alvo}`, y >= -5 && y < 400, 'posição na tela: ' + y);
    }
  }
  // bolsista: nova ficha em 1 toque
  await como('bolsista'); await p.click('.atalhos [data-acao=ficha-nova]'); await p.waitForTimeout(400);
  ok('Caminho curto', 'Bolsista: "+ Nova ficha" abre o formulário em 1 toque', !!(await p.$('form[data-form=ficha]')));
  await p.evaluate(() => MQ.ui.fecharPainel());
  // apoio NÃO vê atalho de passagem
  const semViag = await p.evaluate(() => { const S = MQ.ui.S; const o = S.eu.papel; S.eu.papel = 'apoio'; MQ.ui.render(); const r = !document.querySelector('.atalhos [data-alvo="#t-viag"]:not([hidden])'); S.eu.papel = o; MQ.ui.render(); return r; });
  ok('Perfil certo', 'Bolsista de apoio não vê o atalho "Passagem ou evento"', semViag);

  // ---------- 2. Ajuda de cada página: abre, tem passo a passo, os botões citados existem no sistema
  const topicos = await p.evaluate(() => Object.keys(MQ.ajudaUI.A));
  for (const k of topicos) {
    const r = await p.evaluate(k => { MQ.ui.abrirPainel({ tipo: 'ajuda', k }); const c = document.querySelector('.painel-corpo.ajuda'); const t = c ? c.innerHTML : '';
      return { ok: !!c, passo: /Passo a passo/.test(t), n: (c ? c.querySelectorAll('.ajuda-tarefas details').length : 0), bold: [...(c ? c.querySelectorAll('.ajuda-tarefas b') : [])].map(b => b.textContent) }; }, k);
    const guia = /^guia_|^geral$/.test(k);
    ok('Ajuda', `Ajuda "${k}" abre`, r.ok);
    if (!guia) ok('Ajuda', `Ajuda "${k}" tem passo a passo numerado (${r.n} tarefas)`, r.passo && r.n > 0);
    const faltam = r.bold.filter(t => !/^[+‹›]/.test(t) && !['Hoje'].includes(t) && !SRC.includes(t.replace(/^\+ /, '')) && !SRC.includes(t));
    if (!guia) ok('Ajuda', `Ajuda "${k}": todo botão citado existe no sistema`, !faltam.length, faltam.join(' | '));
  }
  await p.evaluate(() => MQ.ui.fecharPainel());

  // ---------- 3. Duplicidade e repetição em cada tela
  for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    await como(pf);
    const abas = await p.$$eval('nav.abas [data-acao=aba]', l => l.map(x => x.dataset.aba)).catch(() => []);
    for (const aba of (abas.length ? abas : ['—'])) {
      if (aba !== '—') { const t = Date.now(); await p.evaluate(a => { MQ.ui.S.aba = a; MQ.ui.render(); }, aba); const ms = Date.now() - t; ok('Lentidão', `${pf}/${aba} desenha em menos de 300 ms`, ms < 300, ms + ' ms'); }
      const d = await p.evaluate(() => {
        const vis = e => e.offsetParent !== null;
        const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
        const dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
        const hs = [...document.querySelectorAll('main h1, main h2')].filter(vis).map(h => h.textContent.replace(/\d+/g, '').trim());
        const dupH = hs.filter((h, i) => h && hs.indexOf(h) !== i);
        const avs = [...document.querySelectorAll('main .aviso')].filter(vis).map(a => a.textContent.trim().slice(0, 60));
        const dupA = avs.filter((a, i) => avs.indexOf(a) !== i);
        const bts = [...document.querySelectorAll('main button')].filter(vis).map(b => b.textContent.trim()).filter(t => t && t.length > 3);
        return { dupIds, dupH, dupA, n: bts.length }; });
      const tela = pf + '/' + aba;
      ok('Duplicidade', `${tela}: sem id repetido`, !d.dupIds.length, d.dupIds.join(','));
      ok('Duplicidade', `${tela}: sem título repetido`, !d.dupH.length, d.dupH.join(' | '));
      ok('Duplicidade', `${tela}: sem aviso repetido`, !d.dupA.length, d.dupA.join(' | '));
    }
  }
  ok('Erros', 'Nenhum erro de JavaScript', !errs.length, [...new Set(errs)].join(' | '));
  const grupos = [...new Set(R.map(r => r[0]))];
  grupos.forEach(g => { const l = R.filter(r => r[0] === g); console.log(`\n## ${g}: ${l.filter(r => r[1] === 'PASSOU').length}/${l.length}`); l.filter(r => r[1] === 'FALHOU').forEach(r => console.log('   FALHOU |', r[2], '|', r[3])); });
  console.log('\nTOTAL', R.filter(r => r[1] === 'PASSOU').length, 'passou,', R.filter(r => r[1] === 'FALHOU').length, 'falhou');
  fs.writeFileSync('/tmp/claude-0/pw/cad/geral.json', JSON.stringify(R));
  await b.close(); })().catch(e => { console.log('ERRO', e.stack.split('\n').slice(0, 3).join(' ')); console.log(e.message.slice(0,1500)); process.exit(1); });
