/* Vitrine (tela de entrada e "O projeto em números"): mapa com municípios, Apodi e rotas; mosaico de retratos */
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
const MUN = { PI: 10, BA: 8, AL: 3, PE: 5, SE: 3 };
(async () => { const b = await chromium.launch();
  for (const w of [320, 390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(600);
    // sem foto publicada (como o banco real hoje)
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mq-demo-v4')); d.vitrine = []; localStorage.setItem('mq-demo-v4', JSON.stringify(d)); });
    await p.reload(); await p.waitForTimeout(700);
    await p.evaluate(() => { localStorage.removeItem('mq-vitrine'); document.querySelector('button[data-p=entrada]').click(); }); await p.waitForTimeout(1600);
    ok(`${w} entrada: sem a palavra "Carregando"`, !/Carregando/.test(await p.innerText('body')));
    const mapa = async (raiz) => {
      const pre = raiz + ' ';
      ok(`${w} ${raiz}: 29 municípios + Apodi no mapa`, (await p.$$eval(pre + '.mun-pt', l => l.length)) === 30);
      ok(`${w} ${raiz}: 29 rotas saindo de Apodi`, (await p.$$eval(pre + '.rota', l => l.length)) === 29);
      if (true) {   // entrada e página pública (01/10/2026): mesmo mapa, sem lista de legenda; o número de cidades fica em cada estado
        ok(`${w} ${raiz}: sem legenda`, !(await p.$(pre + '.mapa-lista')));
        const nums = await p.$$eval(pre + '.uf-num', l => l.map(x => x.textContent.trim()));
        ok(`${w} ${raiz}: número de cidades em cada estado`, Object.values(MUN).every(n => nums.includes(n + ' cidades')), nums.join(','));
      } else {
        const leg = await p.textContent(pre + '.mapa-lista');
        ok(`${w} ${raiz}: legenda com municípios por estado`, Object.entries(MUN).every(([uf, n]) => new RegExp(uf + '\\s*' + n + ' municípios').test(leg)) && /RN\s*sede/.test(leg), leg.replace(/\s+/g, ' '));
        ok(`${w} ${raiz}: legenda sem contagem de mulheres`, !/mulher/i.test(leg));
      }
      const corte = await p.$eval(pre + 'svg.mapa-pub', svg => { const vb = svg.viewBox.baseVal; const fora = [];
        svg.querySelectorAll('.uf-pub, .uf-sede').forEach(pth => { const bb = pth.getBBox(); if (bb.x < vb.x - 1e-3 || bb.y < vb.y - 1e-3 || bb.x + bb.width > vb.x + vb.width + 1e-3 || bb.y + bb.height > vb.y + vb.height + 1e-3) fora.push(pth.textContent.split(':')[0]); });
        return fora; });
      ok(`${w} ${raiz}: nenhum estado cortado (PI inteiro)`, !corte.length, corte.join(','));
      const cores = await p.$$eval(pre + '.uf-pub', l => new Set(l.map(x => getComputedStyle(x).fill)).size);
      ok(`${w} ${raiz}: 5 cores diferentes, uma por estado`, cores === 5, String(cores));
      await p.locator(pre + '.mun-pt').nth(4).dispatchEvent('mouseover'); await p.waitForTimeout(150);
      const nome = await p.textContent(pre + '[data-mun-nome]');
      ok(`${w} ${raiz}: passar o mouse mostra o nome e acende a rota`, /\/(PI|BA|AL|PE|SE)( · .+)?$/.test(nome.trim()) && (await p.$$eval(pre + '.rota.ativa', l => l.length)) === 1, nome);
      ok(`${w} ${raiz}: sem textos retirados`, !/Cor do estado|a partir de Apodi\/RN|municípios que receberão os quintais, a partir/.test(await p.innerText(raiz)));
    };
    await mapa('#vitrine');
    const mos = await p.$$eval('#vit-foto .mini-mos > span:not(.mos-selo)', l => l.length);
    ok(`${w} entrada: 1 imagem principal e 2 menores`, mos === 3, String(mos));
    ok(`${w} entrada: ilustrações com selo (sem foto publicada)`, (await p.$$eval('#vit-foto .mos-selo', l => l.length)) === 1);
    ok(`${w} entrada: retrato enquadrado pelo alto (não corta o rosto)`, (await p.$eval('#vit-foto .mini-mos img', i => getComputedStyle(i).objectPosition)).startsWith('50% 22%'));
    if (w === 1280) {
      const [hm, hf] = await p.evaluate(() => [document.querySelector('#vitrine .vit-mapa').getBoundingClientRect().height, document.getElementById('vit-foto').getBoundingClientRect().height]);
      ok(`${w} entrada: mosaico com a mesma altura do mapa`, Math.abs(hm - hf) <= 2, hm + ' x ' + hf);
      const [xl, xh] = await p.evaluate(() => [document.querySelector('.ent-acesso').getBoundingClientRect().left, document.querySelector('.ent-t').getBoundingClientRect().right]);
      ok(`${w} entrada: login ao lado da frase`, xl > xh);
      ok(`${w} entrada: números na largura toda, abaixo do login`, await p.evaluate(() => document.querySelector('#vitrine').getBoundingClientRect().top >= document.querySelector('.ent-acesso').getBoundingClientRect().bottom - 2));
      const q = p.locator('#vit-foto .mini-mos > span.mm-n').first(); await q.hover(); await p.waitForTimeout(500);
      ok(`${w} entrada: zoom ao passar o mouse na foto`, /matrix\(1\.3/.test(await q.locator('img').evaluate(i => getComputedStyle(i).transform)));
      const l1 = await p.$$eval('#vit-foto .mini-mos > span', l => l.map(e => e.className).join(','));
      await p.waitForTimeout(8500);
      ok(`${w} entrada: painel fixo (o desenho não muda quando as fotos trocam)`, l1 === await p.$$eval('#vit-foto .mini-mos > span', l => l.map(e => e.className).join(',')));
    }
    ok(`${w} entrada: sem rolagem para o lado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // página pública
    await p.evaluate(() => { location.hash = '#numeros'; }); await p.waitForTimeout(1200);
    await mapa('#numeros');
    ok(`${w} números: tabela por estado cabe no quadro`, await p.$eval('.pub-tab', t => t.scrollWidth <= t.parentElement.clientWidth + 1));
    ok(`${w} números: no máximo 3 imagens (1 principal e 2 menores), o mapa é o destaque`, (await p.$$eval('.pub-fotos > *', l => l.length)) <= 3 && (await p.$$eval('.pub-fotos > *', l => l.length)) >= 1);
    ok(`${w} números: legenda do tamanho dos círculos`, /O tamanho indica o número de mulheres cadastradas/.test(await p.innerText('#numeros')));
    ok(`${w} números: sem rolagem para o lado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // com fotos publicadas: o mosaico vira de fotos e amplia
    await p.evaluate(() => { location.hash = ''; }); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('button[data-p=coord_geral]').click()); await p.waitForTimeout(600);
    await p.evaluate(async () => { const fs = MQ.ui.S.fichas.filter(f => f.consent_imagem); for (let i = 0; i < 8; i++) await MQ.apiDemo.publicarFoto({ ficha_id: fs[i % fs.length].id, origem: 'exemplo', legenda: 'Retrato ' + (i + 1), sem_criancas: true }); localStorage.removeItem('mq-vitrine'); location.hash = '#numeros'; location.reload(); });
    await p.waitForTimeout(1600);
    const nf = await p.$$eval('.pub-fotos > button', l => l.length);
    ok(`${w} números: com fotos publicadas, mostra 3 fotos (sem ilustração)`, nf === 3 && !(await p.$('.pub-fotos .mos-selo')), String(nf));
    await p.click('.pub-fotos > button >> nth=0'); await p.waitForTimeout(200);
    ok(`${w} números: tocar amplia a foto`, await p.isVisible('#vit-amplia'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok(`${w} números: Esc fecha a foto`, !(await p.isVisible('#vit-amplia')));
    ok(`${w}: sem erro de página`, errs.length === 0, errs.join('|'));
    await ctx.close(); }
  // 01/10/2026: paleta do infográfico (pedida pela coordenação), igual nos dois temas (quadro creme); estado pintado com 80% sobre o creme
  const PAL = { PI: '#75A878', BA: '#7B8FCE', PE: '#D3B45A', AL: '#D9877D', SE: '#6FA3A3' };
  const mistura = h => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * .8 + parseInt('FAF7F1'.slice(i - 1, i + 1), 16) * .2).toString(16).padStart(2, '0')).join('');
  const MDA = { light: Object.fromEntries(Object.entries(PAL).map(([u, h]) => [u, mistura(h)])), dark: Object.fromEntries(Object.entries(PAL).map(([u, h]) => [u, mistura(h)])) };
  const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: tema, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/#numeros'); await p.waitForSelector('.vit-mapa svg');
    const r = await p.$$eval('.vit-mapa svg .uf-pub', l => l.map(x => [x.querySelector('title').textContent, getComputedStyle(x).fill]));
    const nomes = { PI: 'Piauí', BA: 'Bahia', PE: 'Pernambuco', AL: 'Alagoas', SE: 'Sergipe' };
    for (const [uf, hex] of Object.entries(PAL)) { const x = r.find(([t]) => t.startsWith(nomes[uf])); ok(`${tema}: ${uf} com a cor do infográfico ${hex}`, x && x[1] === rgb(hex), x && x[1]); }
    const contr = await p.$$eval('.vit-mapa svg .uf-sigla', (l, MDA) => { const lum = c => { const v = c.match(/\d+/g).slice(0, 3).map(n => { n /= 255; return n <= .03928 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
      return l.map(t => { const uf = t.textContent.trim().slice(0, 2); const f = MDA[uf]; if (!f) return [uf, 99]; const a = lum(getComputedStyle(t).fill), bb = lum('rgb(' + [1, 3, 5].map(i => parseInt(f.slice(i, i + 2), 16)).join(',') + ')'); return [uf, (Math.max(a, bb) + .05) / (Math.min(a, bb) + .05)]; }); }, MDA[tema]);
    const pior = contr.filter(([, c]) => c < 99).sort((a, b) => a[1] - b[1])[0];
    ok(`${tema}: sigla legível sobre o estado (contraste ≥ 4,5)`, pior && pior[1] >= 4.5, pior && pior[0] + ' ' + pior[1].toFixed(2));
    await ctx.close(); }
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
