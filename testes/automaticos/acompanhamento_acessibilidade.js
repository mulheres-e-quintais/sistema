/* Acessibilidade automática (axe-core, WCAG 2.1 A e AA) e uso só pelo teclado nas telas de acompanhamento e no cadastro da coordenação.
   Uso: node acompanhamento_acessibilidade.js <caminho do playwright> [caminho do axe.min.js]   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]); const fs = require('fs');
const AXE = fs.readFileSync(process.argv[3] || '/tmp/claude-0/pw/node_modules/axe-core/axe.min.js', 'utf8');
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(!!c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 220) : '')); };
(async () => { const b = await chromium.launch();
  for (const [esquema, vp] of [['light', { width: 1280, height: 900 }], ['dark', { width: 1280, height: 900 }], ['light', { width: 390, height: 780 }]]) {
    const ctx = await b.newContext({ viewport: vp, bypassCSP: true, colorScheme: esquema }); const p = await ctx.newPage();
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo'); await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo'); await p.addScriptTag({ content: AXE });
    const axe = () => p.evaluate(async () => { const x = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }); return x.violations.map(v => v.id + ' (' + v.impact + ', ' + v.nodes.length + '): ' + (v.nodes[0] && v.nodes[0].target.join(' '))); });
    const rot = (esquema === 'dark' ? 'tema escuro' : 'tema claro') + ', ' + vp.width + ' px';
    for (const [pf, sigla] of [['obs_mda', 'MDA'], ['obs_mpa', 'MPA']]) {
      await p.evaluate(pf => document.querySelector(`button[data-p=${pf}]`).click(), pf); await p.waitForSelector('.ac-kpis'); await p.waitForTimeout(400);
      if (pf === 'obs_mda') await p.evaluate(() => { const a = JSON.parse(JSON.stringify(MQ.ui.S.acomp)); a.perfil = { base: 40, sustento: 30, cadunico: 22, sem_ater: 12, raca_povo: -1, jovem: 0, grupo: 9, caf: 40, faixas: { '18 a 29': -1, '30 a 44': 20, '45 a 59': 15, '60 ou mais': 5 } };
        a.impacto = { base_n: 40, renda_quintal_media: 132.5, final_n: 12, produz: { sim: 9, em_parte: -1, nao: 0 }, ebia_final: { seguranca: 6, leve: 5, moderada: -1, grave: 0 } };
        a.mensal = [{ mes: '2026-10', diagnostico: 12, implantacao: 0, acompanhamento: 0, avaliacao: 0 }, { mes: '2026-11', diagnostico: 30, implantacao: 8, acompanhamento: 0, avaliacao: 0 }, { mes: '2026-12', diagnostico: 20, implantacao: 25, acompanhamento: 9, avaliacao: 0 }]; MQ.ui.S.acomp = a; MQ.ui.render(); });
      const v = await axe(); ok(`${sigla} (${rot}): nenhuma violação de acessibilidade`, v.length === 0, v.join(' ; '));
      const h = await p.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3')].map(e => +e.tagName[1]));
      ok(`${sigla} (${rot}): títulos em ordem (um h1, sem pular nível)`, h.filter(x => x === 1).length === 1 && h.every((x, i) => i === 0 || x - h[i - 1] <= 1), h.join(''));
      if (vp.width > 1000 && esquema === 'light') {
        // só teclado: Tab chega a todos os controles, com foco visível
        const alvos = await p.evaluate(() => [...document.querySelectorAll('main button, main a[href]')].filter(e => e.offsetParent).length);
        await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
        const vistos = new Set(); let semFoco = 0;
        for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { k: (e.dataset.acao || e.getAttribute('href') || e.tagName) + '|' + e.textContent.trim().slice(0, 20), dentro: !!e.closest('main'), foco: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 }; });
          if (r && r.dentro) { vistos.add(r.k); if (!r.foco) semFoco++; } }
        ok(`${sigla}: o teclado alcança todos os controles da tela, com foco visível`, vistos.size >= alvos && semFoco === 0, `alcançados ${vistos.size} de ${alvos}; sem foco visível ${semFoco}`);
      }
    }
    await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(700); await p.evaluate(() => { MQ.ui.fecharPainel(); MQ.ui.S.aba = 'equipe'; MQ.ui.render(); }); await p.waitForSelector('#ac-coord');
    await p.evaluate(async () => { const a = MQ.ui.S.api; const id = await a.salvarObservador({ nome: 'Marta Observadora', email: 'marta@mda.exemplo', orgao: 'mda', ativo: true }); await a.gerarCodigoObservador(id); await MQ.ui.carregar(); MQ.ui.render(); document.querySelector('[data-acao=acomp-previa][data-o=mpa]').click(); }); await p.waitForSelector('.ac-previa');
    const vc = (await axe()).filter(x => /#ac-coord|\.ac-|#ac-/.test(x)); ok(`cadastro e prévia na aba Equipe (${rot}): nenhuma violação de acessibilidade no bloco`, vc.length === 0, vc.join(' ; '));
    await ctx.close();
  }
  console.log('\n' + R.filter(Boolean).length + ' passou, ' + R.filter(x => !x).length + ' falhou'); await b.close(); process.exit(R.some(x => !x) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
