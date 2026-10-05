const { chromium } = require(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright'); const fs = require('fs'); const D = __dirname + '/node_modules/';
const F = { man: fs.readFileSync(D + '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2'), l6: fs.readFileSync(D + '@fontsource/lora/files/lora-latin-600-normal.woff2'), l7: fs.readFileSync(D + '@fontsource/lora/files/lora-latin-700-normal.woff2') };
const CSSF = `@font-face{font-family:Manrope;font-weight:400 800;src:url(https://fonts.gstatic.com/man.woff2) format('woff2')}@font-face{font-family:Lora;font-weight:600;src:url(https://fonts.gstatic.com/l6.woff2) format('woff2')}@font-face{font-family:Lora;font-weight:700;src:url(https://fonts.gstatic.com/l7.woff2) format('woff2')}`;
const CEL = process.env.CEL; const SUF = CEL ? '_cel' : '';
const TELAS = [
  { id: 'entrada', perfil: 'entrada', clip: 'vp:760', m: [['.ent-seg', 1], ['#l-email', 2], ['#l-senha', 3], ['.ent-btn', 4], ['.ent-esqueci', 5], ['.ent-ajuda', 6]] },
  { id: 'topo', perfil: 'coord_geral', aba: 'visao', clip: 'y:0:225', m: [['nav.abas', 1], ['.btn-ajuda', 2], ['.btn-meus', 3], ['.btn-sair', 4]] },
  { id: 'visao_atencao', perfil: 'coord_geral', aba: 'visao', clip: 'de:main h1:.dx-atencao', m: [['.dx-atencao h2', 1], ['.dx-conta', 2], ['.dx-atencao .dx-ir', 3]] },
  { id: 'visao_metas', perfil: 'coord_geral', aba: 'visao', clip: 'el:.dx-duas', m: [['#t-metas', 1], ['.meta-ver', 2], ['#t-marcos', 3]] },
  { id: 'visao_mapa', perfil: 'coord_geral', aba: 'visao', clip: 'el:.dx-mapa', m: [['.dx-mapa .seg', 1], ['.dx-mapa .mapa-caixa, .dx-mapa svg.mapa', 2], ['t:Status das fichas', 3], ['t:Municípios com mais fichas', 4]] },
  { id: 'equipe_coord', perfil: 'coord_geral', aba: 'equipe', clip: 'de:main h1:section[aria-labelledby=t-prof]', m: [['.resumo, .kpis, .cab + div', 1], ['t:Ver detalhes', 2], ['#t-prof', 3]] },
  { id: 'equipe_estados', perfil: 'coord_geral', aba: 'equipe', clip: 'de:section[aria-labelledby=t-b]:section[aria-labelledby=t-ag]', m: [['.eq-quadro .vaga-slot .btn-acao', 1], ['.eq-quadro .vagabtn.com-foto', 2], ['.eq-quadro .plano', 3], ['.ag-acao .btn-acao', 4]] },
  { id: 'equipe_ficha', perfil: 'coord_geral', aba: 'equipe', clique: '.eq-quadro .vagabtn.com-foto', clip: 'el:aside.painel', m: [['p:Trocar foto', 1], ['aside.painel .passos', 2], ['p:Registrar passos da habilitação', 3], ['p:Hoje', 4]] },
  { id: 'selecao', perfil: 'coord_geral', aba: 'selecao', clip: 'main', m: [['t:Baixar CSV', 1], ['.quadro-sel', 2], ['.painel-sit', 3], ['t:Todas as fichas', 4]] },
  { id: 'selecao_ficha', perfil: 'coord_geral', aba: 'selecao', clique: '.painel-sit [data-acao=ficha-ver]', clip: 'el:aside.painel', m: [['aside.painel .painel-cab .chip', 1], ['p:Identificação', 2], ['p:Termo de consentimento', 3], ['p:Critérios obrigatórios', 4]] },
  { id: 'campo_estados', perfil: 'coord_geral', aba: 'campo', clip: 'de:main h1:.quadro-scroll', m: [['t:+ Agendar visita', 1], ['.tab-campo-uf', 2]] },
  { id: 'campo_roteiro', perfil: 'coord_geral', aba: 'campo', clip: 'roteiro', m: [['t:Planos para você aprovar', 1], ['.tab-rot', 2], ['.rot-acoes', 3]] },
  { id: 'fic', perfil: 'coord_geral', aba: 'fic', clip: 'main', m: [['t:+ Nova turma', 1], ['t:+ Matricular', 2], ['t:Registrar encontro', 3], ['#t-ava', 4]] },
  { id: 'pagamentos', perfil: 'coord_geral', aba: 'pagamentos', clip: 'main', m: [['.resumo', 1], ['t:Esperando o seu aval', 2], ['t:Com aval, falta', 3], ['t:Lançadas no Arlo', 4]] },
  { id: 'custos', perfil: 'coord_geral', aba: 'custos', clip: 'main', m: [['t:Pagamento do mês', 1], ['t:Proposta de roteiro', 2], ['t:Visitas do mês', 3], ['t:Valores usados', 4]] },
  { id: 'viagens', perfil: 'coord_geral', aba: 'viagens', clip: 'main', m: [['#t-vp', 1], ['t:Tetos de gasto · passagens', 2], ['t:Esperando a sua autorização', 3], ['#t-ve', 4]] },
  { id: 'execucao', perfil: 'coord_geral', aba: 'execucao', clip: 'main', m: [['t:Enviar planilha de gastos', 1], ['.fin-resumo', 2], ['.exec-grafs', 3], ['.fin-rub', 4]] },
  { id: 'documentos', perfil: 'coord_geral', aba: 'documentos', clip: 'main', m: [['t:Anexar documento', 1], ['t:Gerar relatório da ação', 2], ['#t-imp', 3], ['#t-docs', 4]] },
  { id: 'historico', perfil: 'coord_geral', aba: 'historico', clip: 'main', m: [['#t-acessos', 1], ['#t-reg', 2]] },
  { id: 'bolsista', perfil: 'bolsista', clip: 'de:main h1:section[aria-labelledby=t-ent]', m: [['t:+ Nova ficha de mulher', 1], ['t:Visitas e diagnósticos', 2], [CEL ? 'b:Entregas do mês' : 't:Entregas do mês', 3], ['t:Pedir pagamento', 4], ['t:Passagem ou evento', 5], ['t:Entreguei', 6]] },
  { id: 'bolsista_campo', perfil: 'bolsista', clip: 'el:section[aria-labelledby=t-campo]', m: [['t:Para fazer agora', 1], ['t:+ Agendar visita', 2], ['.tab-rot', 3]] },
  { id: 'bolsista_pag', perfil: 'bolsista', clip: 'el:section[aria-labelledby=t-pag]', m: [['t:Ajuda de custo', 1], [CEL ? 'b:Solicitar' : 't:Solicitar', 2], ['t:Bolsa ·', 3], ['t:Falar', 4]] },
  { id: 'agente', perfil: 'agente', clip: 'main', m: [['t:Minhas próximas visitas', 1], ['t:Registrar diagnóstico', 2], ['t:Pedir ajuda de custo', 3]] },
  { id: 'professor', perfil: 'professor', clip: 'main', m: [['t:Matricular alunas', 1], ['t:Registrar encontro e presença', 2], ['t:Confirmar acesso ao AVA', 3], ['t:Pedir a minha bolsa', 4], ['t:+ Nova turma', 5]] },
  { id: 'auxiliar', perfil: 'auxiliar', clip: 'main', m: [['t:Cadastrar no Arlo', 1], ['t:Lançar pagamentos no Arlo', 2], ['#t-arlo', 3], ['t:No Arlo, falta registrar o termo', 4]] },
  { id: 'acomp_mda', perfil: 'obs_mda', clip: 'de:main h1:#ac-metas', m: [['t:Atualizar agora', 1], ['.ac-kpis', 2], ['#ac-caminho', 3], ['#ac-metas', 4]] },
  { id: 'acomp_mpa', perfil: 'obs_mpa', clip: 'de:main h1:#ac-parado', m: [['t:Atualizar agora', 1], ['.ac-kpis', 2], ['#ac-estados', 3], ['#ac-parado', 4]] },
  { id: 'acomp_coord', perfil: 'coord_geral', aba: 'equipe', clip: 'el:#ac-coord', m: [['t:Adicionar pessoa', 1], ['#ac-coord .ag-uf', 2], ['t:Ver como o MDA vê', 3]] },
  { id: 'meus_dados', perfil: 'bolsista', clique: '.btn-meus', clip: 'el:aside.painel', m: [['p:Trocar foto', 1], ['aside.painel dl', 2], ['p:Termo de compromisso', 3], ['p:Gerar o termo preenchido', 4]] },
  { id: 'ficha_nova', perfil: 'bolsista', clique: '[data-acao=ficha-nova]', clip: 'el:aside.painel', m: [['p:Imprimir em branco', 1], ['aside.painel input', 2], ['p:Salvar', 3]] },
];
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: CEL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: CEL ? 3 : 2, isMobile: !!CEL, hasTouch: !!CEL, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: CSSF }));
  await ctx.route('https://fonts.gstatic.com/**', r => { const k = r.request().url().split('/').pop().replace('.woff2', ''); r.fulfill({ contentType: 'font/woff2', body: F[k], headers: { 'access-control-allow-origin': '*' } }); });
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
  await p.addStyleTag({ content: '.demo,.aviso-ex,.toast{display:none!important}.mq-m{position:absolute;z-index:99999;width:26px;height:26px;border-radius:50%;background:#A44934;color:#fff;font:800 14px/22px Manrope,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);box-sizing:border-box}.mq-a{position:absolute;z-index:99998;border:2px solid #A44934;border-radius:10px;pointer-events:none;box-sizing:border-box}' });
  const res = {}; const so = process.argv[2];
  for (const t of TELAS) { if (so && t.id !== so) continue; if (CEL && !/^(bolsista|agente|ficha_nova)/.test(t.id)) continue;
    await p.evaluate(() => { document.querySelectorAll('.mq-m,.mq-a').forEach(e => e.remove()); MQ.ui.fecharPainel && MQ.ui.fecharPainel(); MQ.ui.S.api.modo = 'demo'; MQ.ui.render(); }); await p.waitForTimeout(250);
    await p.evaluate(per => { const bt = document.querySelector(`button[data-p=${per}]`); if (bt) bt.click(); }, t.perfil); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel());
    if (t.perfil !== 'entrada') await p.evaluate(a => { MQ.ui.S.api.modo = 'supabase'; if (a) document.querySelector(`[data-aba="${a}"]`).click(); else MQ.ui.render(); }, t.aba || null);
    await p.waitForTimeout(t.perfil === 'entrada' ? 1500 : 500); await p.evaluate(() => { MQ.ui.S.api.modo = 'demo'; });
    if (t.clique) { await p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length > 0); if (e) e.click(); }, t.clique); await p.waitForTimeout(600); }
    await p.evaluate(() => document.fonts.ready);
    const r = await p.evaluate(({ m, clip }) => { const vis = e => e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
      const achar = s => { if (s.startsWith('b:')) { const q = s.slice(2); return [...document.querySelectorAll('main button, main a')].filter(vis).filter(e => e.textContent.trim().replace(/\s+/g, ' ').startsWith(q))[0] || null; }
        if (s.startsWith('t:') || s.startsWith('p:')) { const raiz = s[0] === 'p' ? document.querySelector('aside.painel') : document.querySelector('main') || document.body; if (!raiz) return null; const q = s.slice(2);
          const l = [...raiz.querySelectorAll('button, a, summary, h1, h2, h3, h4, label, th, legend')].filter(vis).filter(e => { const x = e.textContent.trim().replace(/\s+/g, ' '); return s[0] === 'p' ? x.includes(q) : x.startsWith(q); }); return l.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null; }
        return [...document.querySelectorAll(s)].find(vis) || null; };
      const painel = document.querySelector('aside.painel'); const postos = [];
      const caixa = e => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
      // região do recorte
      let c; const W = document.documentElement.clientWidth; const main = document.querySelector('main') || document.body;
      if (clip.startsWith('vp:')) c = { x: 0, y: 0, w: W, h: +clip.slice(3) };
      else if (clip.startsWith('y:')) { const [, a, b2] = clip.split(':'); c = { x: 0, y: +a, w: W, h: +b2 - +a }; }
      else if (clip.startsWith('el:')) { const e = achar(clip.slice(3)); if (!e) return { erro: 'sem ' + clip }; c = caixa(e); c = { x: Math.max(0, c.x - 16), y: Math.max(0, c.y - 16), w: Math.min(W, c.w + 32), h: c.h + 32 }; }
      else if (clip.startsWith('de:')) { const [, a, b2] = clip.split(':'); const e1 = achar(a), e2 = achar(b2); if (!e1 || !e2) return { erro: 'sem ' + clip }; const c1 = caixa(e1), c2 = caixa(e2); const mm = caixa(main); c = { x: Math.max(0, mm.x - 16), y: c1.y - 16, w: Math.min(W, mm.w + 32), h: c2.y + c2.h - c1.y + 32 }; }
      else if (clip === 'roteiro') { const e1 = achar('t:Planos para você aprovar') || achar('t:Roteiro'), e2 = achar('.tab-rot'); if (!e1 || !e2) return { erro: 'sem roteiro' }; const c1 = caixa(e1.closest('.bloco') || e1), c2 = caixa(e2.closest('.quadro-scroll') || e2); const mm = caixa(main); c = { x: Math.max(0, mm.x - 16), y: c1.y - 16, w: Math.min(W, mm.w + 32), h: c2.y + c2.h - c1.y + 32 }; }
      else { const mm = caixa(main); c = { x: Math.max(0, mm.x - 16), y: Math.max(0, mm.y - 8), w: Math.min(W, mm.w + 32), h: mm.h + 16 }; }
      const MAXH = Math.round(c.w * (innerWidth < 600 ? 2.05 : 1.2)); if (c.h > MAXH) c.h = MAXH;
      const host = painel && clip.startsWith('el:aside') ? painel : document.body;
      for (const [s, n] of m) { const e = achar(s); if (!e) continue; const k = caixa(e); if (k.y + 8 > c.y + c.h || k.y + k.h < c.y) continue;
        const a = document.createElement('div'); a.className = 'mq-a'; const pad = 4; Object.assign(a.style, { left: (k.x - pad) + 'px', top: (k.y - pad) + 'px', width: (k.w + 2 * pad) + 'px', height: Math.min(k.h + 2 * pad, c.y + c.h - k.y) + 'px', position: 'absolute' }); document.body.appendChild(a);
        const d = document.createElement('div'); d.className = 'mq-m'; d.textContent = n; Object.assign(d.style, { left: Math.max(c.x + 2, k.x - pad - 13) + 'px', top: Math.max(c.y + 2, k.y - pad - 13) + 'px' }); document.body.appendChild(d); postos.push(n); }
      return { c, postos }; }, { m: t.m, clip: t.clip });
    if (r.erro) { console.log(t.id, 'ERRO', r.erro); continue; }
    // o painel lateral é fixo: para ele, captura a janela (não a página inteira)
    if (t.clip.startsWith('el:aside')) { const bx = await p.evaluate(() => { const r = document.querySelector('aside.painel').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, innerHeight) }; });
      await p.evaluate(() => document.querySelectorAll('.mq-m,.mq-a').forEach(e => { const y = parseFloat(e.style.top) - scrollY, x = parseFloat(e.style.left) - scrollX; e.style.position = 'fixed'; e.style.top = y + 'px'; e.style.left = x + 'px'; }));
      await p.screenshot({ path: `shots/${t.id}${SUF}.png`, clip: { x: bx.x, y: bx.y, width: bx.w, height: bx.h } }); r.c = bx; }
    else await p.screenshot({ path: `shots/${t.id}${SUF}.png`, fullPage: true, clip: { x: r.c.x, y: r.c.y, width: r.c.w, height: r.c.h } });
    res[t.id + SUF] = { postos: r.postos, w: Math.round(r.c.w), h: Math.round(r.c.h) }; console.log(t.id, JSON.stringify(res[t.id + SUF])); }
  if (!so) fs.writeFileSync(CEL ? 'shots_cel.json' : 'shots.json', JSON.stringify(res, null, 1)); await b.close(); })();
