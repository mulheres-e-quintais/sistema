/* Item 5 (21/10/2026): o Android fecha a página no meio da ficha (acontece quando a câmera abre por cima do navegador).
   Antes o texto voltava pelo rascunho e as fotos da ficha e do termo se perdiam. Agora:
   - a foto pronta fica numa cópia neste aparelho, presa ao rascunho, e volta com "Continuar de onde parou?";
   - a tela inicial avisa que há uma ficha começada, com o botão Continuar;
   - "Começar de novo" e salvar apagam a cópia (a foto de uma mulher não aparece na ficha de outra);
   - há "Tirar foto aqui, sem sair do sistema" (a câmera abre dentro da página, sem deixar o navegador para trás).
   Uso: node testes/automaticos/fotos_ficha_aba_fechada.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 240) : '')); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  const errs = [];
  const abrir = async (limpar) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8766/'); if (limpar) { await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); }
    await p.waitForSelector('button[data-p]'); return p;
  };
  const entrar = async (p, pf) => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(800); await p.evaluate(() => MQ.ui.fecharPainel()); };
  /* uma foto de verdade (JPEG feito no canvas), entregue ao campo como a câmera entregaria */
  const foto = (p, sel) => p.evaluate(sel => new Promise(res => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const g = c.getContext('2d');
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, 800, 600); g.fillStyle = '#333'; g.font = '40px sans-serif'; g.fillText('Ficha assinada', 200, 300);
    c.toBlob(bl => { const inp = document.querySelector(sel); const dt = new DataTransfer(); dt.items.add(new File([bl], 'doc.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
      inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); res(); }, 'image/jpeg', 0.9); }), sel);
  const dica = (p, id) => p.evaluate(id => (document.getElementById(id) || {}).textContent || '', id);
  const copias = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('mq-arquivos-rascunho'); r.onsuccess = () => { const db = r.result;
    if (!db.objectStoreNames.contains('arq')) return res(0); const q = db.transaction('arq').objectStore('arq').count(); q.onsuccess = () => res(q.result); q.onerror = () => res(-1); }; r.onerror = () => res(-1); }));

  /* ---------- 1. começa a ficha, fotografa os dois papéis, a página fecha ---------- */
  let p = await abrir(true);
  await entrar(p, 'bolsista');
  await p.click('[data-acao=ficha-nova]'); await p.waitForSelector('form[data-form=ficha]');
  ok('1.1 a ficha tem "Tirar foto aqui, sem sair do sistema" nos dois campos de foto', await p.evaluate(() => ['fi-ft', 'fi-ff'].every(id => !!document.querySelector(`[data-acao=foto-agora][data-alvo=${id}]`))));
  await p.fill('#fi-nome', 'Joana Aba Fechada'); await p.fill('#fi-cpf', '529.982.247-25');
  await foto(p, '#fi-ft'); await foto(p, '#fi-ff'); await p.waitForTimeout(1800);
  ok('1.2 as duas fotos ficam prontas e guardadas neste aparelho', /guardada neste aparelho/.test(await dica(p, 'fi-ft-dica')) && /guardada neste aparelho/.test(await dica(p, 'fi-ff-dica')) && (await copias(p)) === 2, [await dica(p, 'fi-ff-dica'), await copias(p)]);
  await p.close({ runBeforeUnload: false });   // o Android fecha a aba

  /* ---------- 2. abre o sistema de novo ---------- */
  p = await abrir(false);
  await p.waitForTimeout(800); await p.evaluate(() => MQ.ui.fecharPainel());
  const faixa = await p.evaluate(() => (document.querySelector('[data-rasc-pendente]') || {}).textContent || '');
  ok('2.1 a tela inicial avisa que há uma ficha começada e não salva', /Você começou uma ficha de indicação e não salvou/.test(faixa), faixa.replace(/\s+/g, ' ').slice(0, 160));
  await p.click('[data-rasc-pendente] [data-acao=rasc-abrir]'); await p.waitForTimeout(500);
  ok('2.2 "Continuar" abre a ficha e pergunta se continua de onde parou', await p.evaluate(() => !!document.querySelector('#painel .confirma-rasc')));
  await p.click('#painel [data-acao=rasc-continuar]'); await p.waitForTimeout(900);
  ok('2.3 o que foi digitado volta', (await p.inputValue('#fi-nome')) === 'Joana Aba Fechada' && (await p.inputValue('#fi-cpf')) === '529.982.247-25');
  ok('2.4 as duas fotos voltam', /recuperada deste aparelho/.test(await dica(p, 'fi-ft-dica')) && /recuperada deste aparelho/.test(await dica(p, 'fi-ff-dica')), [await dica(p, 'fi-ft-dica'), await dica(p, 'fi-ff-dica')]);
  const nota = await p.evaluate(() => (document.querySelector('#painel .rascunho-volta') || {}).textContent || '');
  ok('2.5 o aviso não manda escolher os arquivos de novo (eles voltaram)', /voltou/.test(nota) && !/Arquivos não ficam guardados/.test(nota), nota);

  /* ---------- 3. "Começar de novo" apaga as fotos guardadas ---------- */
  await p.evaluate(() => MQ.ui.fecharPainel({ manterRascunho: true }));
  await p.close({ runBeforeUnload: false });
  p = await abrir(false); await p.waitForTimeout(800); await p.evaluate(() => MQ.ui.fecharPainel());
  await p.click('[data-acao=ficha-nova]'); await p.waitForTimeout(500);
  if (await p.$('#painel [data-acao=rasc-novo]')) { await p.click('#painel [data-acao=rasc-novo]'); await p.waitForTimeout(600); }
  ok('3.1 "Começar de novo": ficha em branco, sem foto, e as cópias saem do aparelho', (await p.inputValue('#fi-nome')) === '' && !/recuperad/.test(await dica(p, 'fi-ff-dica')) && (await copias(p)) === 0, [await p.inputValue('#fi-nome'), await copias(p)]);
  ok('3.2 o aviso da tela inicial some', await p.evaluate(() => { MQ.ui.fecharPainel(); MQ.ui.render(); return !document.querySelector('[data-rasc-pendente]'); }));

  /* ---------- 4. salvar apaga a cópia ---------- */
  await p.click('[data-acao=ficha-nova]'); await p.waitForSelector('form[data-form=ficha]');
  await p.fill('#fi-nome', 'Outra Mulher Teste'); await foto(p, '#fi-ff'); await p.waitForTimeout(1500);
  ok('4.1 foto nova guardada', (await copias(p)) === 1);
  await p.evaluate(() => MQ.ui.fecharPainel());   // como depois de salvar
  await p.waitForTimeout(500);
  ok('4.2 fechou depois de salvar (ou "Sair sem salvar"): a cópia sai do aparelho', (await copias(p)) === 0, String(await copias(p)));

  /* ---------- 5. Sair da conta apaga tudo ---------- */
  await p.click('[data-acao=ficha-nova]'); await p.waitForSelector('form[data-form=ficha]');
  await p.fill('#fi-nome', 'Mais Uma Teste'); await foto(p, '#fi-ft'); await p.waitForTimeout(1500);
  await p.evaluate(() => MQ.ui.sair()); await p.waitForTimeout(800);
  ok('5.1 o botão Sair apaga as fotos guardadas (LGPD)', (await copias(p)) === 0, String(await copias(p)));

  ok('sem erro de página', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  const f = R.filter(r => r[0] === 'FALHOU').length;
  console.log(`\n${R.length - f} passaram, ${f} falharam`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
