/* Foto do quintal só do dia da visita (v253) e as correções da auditoria de 12/10/2026 (itens 5 e 15):
   foto antiga recusada sem apagar a boa; fotos guardadas no aparelho voltam depois da saída por inatividade;
   mudar a data da visita depois da foto barra o envio; sair pelo botão apaga as fotos do aparelho.
   Uso: node testes/automaticos/foto_do_dia.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); };
  await entrar('bolsista');
  // foto de verdade (JPEG que o navegador abre) com a data gravada dentro (EXIF), como a câmera do celular faz
  await p.evaluate(() => {
    window.fotoCom = async (quando, nome) => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#3a6'; g.fillRect(0, 0, 40, 30);
      const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
      const txt = [...new TextEncoder().encode(quando + '\0')]; const u16 = n => [n & 255, n >> 8], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
      const tiff = [0x49, 0x49, ...u16(42), ...u32(8), ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0), ...u16(1), ...u16(0x9003), ...u16(2), ...u32(txt.length), ...u32(44), ...u32(0), ...txt];
      const app1 = [...new TextEncoder().encode('Exif'), 0, 0, ...tiff]; const tam = app1.length + 2;
      const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, tam >> 8, tam & 255, ...app1, ...jpg.slice(2)]);
      return new File([bytes], nome || 'IMG_0001.jpg', { type: 'image/jpeg' });
    };
    window.escolher = async (sel, quando) => { const inp = document.querySelector(sel); const dt = new DataTransfer(); dt.items.add(await fotoCom(quando)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
    window.contarGuardadas = () => new Promise(res => { const r = indexedDB.open('mq-fotos-rascunho', 1);
      r.onupgradeneeded = () => { const os = r.result.createObjectStore('fotos', { keyPath: 'id' }); os.createIndex('chave', 'chave'); };
      r.onsuccess = () => { const t = r.result.transaction('fotos').objectStore('fotos').count(); t.onsuccess = () => { res(t.result); r.result.close(); }; }; r.onerror = () => res(-1); });
  });
  const hoje = await p.evaluate(() => MQ.regras.hoje()); const exHoje = hoje.replace(/-/g, ':') + ' 09:12:00';
  const abrirDiag = async () => { await p.evaluate(() => { const S = MQ.ui.S;
      const f = S.fichas.find(x => x.resultado === 'selecionada' && x.situacao === 'aprovada' && !S.diagnosticos.some(d => d.ficha_id === x.id) && x.uf === S.eu.uf) || S.fichas.find(x => x.resultado === 'selecionada' && !S.diagnosticos.some(d => d.ficha_id === x.id));
      window.fichaTeste = window.fichaTeste || f.id;
      document.body.insertAdjacentHTML('beforeend', `<button id="abre-diag" data-acao="campo-diag-novo" data-ficha="${window.fichaTeste}"></button>`); document.getElementById('abre-diag').click(); document.getElementById('abre-diag').remove(); });
    await p.waitForTimeout(500); };
  await abrirDiag();
  ok('formulário do diagnóstico abriu', !!(await p.$('#painel form[data-form=diag]')));
  await p.fill('#painel input[name=data_visita]', hoje).catch(() => {});

  // foto antiga: recusada com o botão da câmera do sistema
  await p.evaluate(() => escolher('#dg-f-geral', '2026:03:01 10:00:00')); await p.waitForTimeout(600);
  let dica = await p.textContent('#dg-f-geral-dica');
  ok('foto antiga é recusada com o motivo', /Esta foto é de 01\/03\/2026/.test(dica), dica);
  ok('oferece "Tirar foto agora"', !!(await p.$('#dg-f-geral-dica [data-acao=foto-agora]')));
  // foto de hoje: aceita e guardada no aparelho
  await p.evaluate(e => escolher('#dg-f-geral', e), exHoje); await p.waitForTimeout(900);
  dica = await p.textContent('#dg-f-geral-dica');
  ok('foto do dia é aceita', /Foto pronta/.test(dica), dica);
  ok('foto aceita fica guardada no aparelho', (await p.evaluate(() => contarGuardadas())) === 1);
  // item 15: foto recusada depois não apaga a boa
  await p.evaluate(() => escolher('#dg-f-geral', '2026:03:01 10:00:00')); await p.waitForTimeout(600);
  dica = await p.textContent('#dg-f-geral-dica');
  ok('foto recusada avisa que a anterior continua valendo', /A foto anterior continua valendo/.test(dica), dica);
  ok('a foto boa continua guardada', (await p.evaluate(() => contarGuardadas())) === 1);

  // item 5: o sistema sai sozinho (15 minutos sem uso) e a foto volta ao abrir o mesmo formulário
  await p.evaluate(() => MQ.ui.sair('Você saiu do sistema depois de 15 minutos sem uso.')); await p.waitForTimeout(500);
  ok('saída por inatividade mantém a foto no aparelho', (await p.evaluate(() => contarGuardadas())) === 1);
  await entrar('bolsista'); await abrirDiag(); await p.waitForTimeout(500);
  dica = await p.textContent('#dg-f-geral-dica').catch(() => '');
  ok('foto volta sozinha ao abrir o mesmo formulário', /Foto recuperada deste aparelho \(tirada em/.test(dica), dica);
  const nota = await p.textContent('#painel').catch(() => '');
  ok('aviso do rascunho não manda tirar a foto de novo', !/tire a foto ou escolha o arquivo de novo/.test(nota));

  // item 15: data da visita mudou depois da foto → o envio é barrado
  const ontem = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 2); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
  await p.fill('#painel input[name=data_visita]', ontem);
  await p.evaluate(() => document.querySelector('#painel form[data-form=diag]').requestSubmit()); await p.waitForTimeout(500);
  const erro = await p.textContent('#painel form[data-form=diag] [data-erro]').catch(() => '');
  ok('data da visita diferente da foto barra o envio', /Há foto de .* mas a visita está com a data de/.test(erro), erro);

  // auditoria 2: foto que fica pronta DEPOIS de trocar de quintal não entra no quintal novo; fica guardada para o certo
  await p.evaluate(() => { const S = MQ.ui.S; window.fichaB = S.fichas.find(x => x.resultado === 'selecionada' && x.id !== window.fichaTeste && !S.diagnosticos.some(d => d.ficha_id === x.id)).id;
    window._comp = MQ.comprimirFoto; MQ.comprimirFoto = (...a) => new Promise(r => setTimeout(() => r(window._comp(...a)), 1500)); });
  await p.fill('#painel input[name=data_visita]', hoje);
  await p.evaluate(e => escolher('#dg-f-agua', e), exHoje); await p.waitForTimeout(200);
  await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', `<button id="abre-b" data-acao="campo-diag-novo" data-ficha="${window.fichaB}"></button>`); document.getElementById('abre-b').click(); document.getElementById('abre-b').remove(); });
  await p.waitForTimeout(2200);
  const dicaB = await p.textContent('#dg-f-agua-dica').catch(() => '');
  const fotosB = await p.evaluate(() => MQ.fotoDia.fotosDoForm('diag'));
  ok('foto atrasada NÃO entra no diagnóstico de outra mulher', !fotosB.includes('agua') && !/Foto pronta|recuperada/.test(dicaB) && await p.evaluate(() => document.querySelector('form[data-form=diag]').dataset.ficha === window.fichaB), JSON.stringify(fotosB) + ' ' + dicaB);
  await p.evaluate(() => { MQ.comprimirFoto = window._comp; });
  await abrirDiag(); await p.waitForTimeout(500);
  const dicaA = await p.textContent('#dg-f-agua-dica').catch(() => '');
  ok('a foto atrasada fica guardada e volta no diagnóstico certo', /Foto recuperada deste aparelho/.test(dicaA), dicaA);
  // auditoria 2: registro em conflito guarda as fotos antes de sair da fila
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const b = await new Promise(r => c.toBlob(r, 'image/jpeg'));
    await MQ.fotoDia.guardarCopia('visita', { id: 'vis-conflito' }, { 1: b }, { 1: { dia: MQ.regras.hoje(), hora: 9 } }); });
  ok('cópia das fotos do registro em conflito fica no aparelho', (await p.evaluate(() => contarGuardadas())) >= 2);

  // sair pelo botão: as fotos saem do aparelho (LGPD)
  await p.evaluate(() => MQ.ui.sair()); await p.waitForTimeout(600);
  ok('sair pelo botão apaga as fotos do aparelho', (await p.evaluate(() => contarGuardadas())) === 0);
  ok('sem erro de página', errs.length === 0, errs.join('|'));
  await b.close(); R.forEach(r => console.log(r.join(' | '))); console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
