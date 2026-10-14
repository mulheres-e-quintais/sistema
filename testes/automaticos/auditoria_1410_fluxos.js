/* Auditoria 14/10/2026 — fluxos de ponta a ponta, envio repetido, queda de rede, fila e reconexão, dois usuários no mesmo
   aparelho, conexão lenta, celular/iPhone deitado e botão Voltar (aplicativo real no navegador, modo demonstração).
   Uso: node testes/automaticos/auditoria_1410_fluxos.js <caminho do playwright>   (servidor de teste em http://localhost:8766)
   Observação: a demonstração não usa a rede para gravar (localStorage). "Queda de rede" é feita de dois jeitos:
   context.setOffline (o navegador diz que está sem internet) e troca da função da API por uma que falha como o Supabase
   falha sem rede (erro com semRede) — inclusive o caso "gravou no servidor, mas a resposta não chegou". */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 220) : '')); };
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const novo = async (vp, op = {}) => {
    const ctx = await b.newContext(Object.assign({ viewport: vp || { width: 1280, height: 900 } }, op.ctx || {})); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOGO: ' + d.message()); d.dismiss(); });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.resumo');
    await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
    const instalar = () => p.evaluate(() => {
      window.__toasts = [];
      new MutationObserver(() => { const t = document.getElementById('toast'); if (t && !t.hidden && t.textContent && window.__toasts[window.__toasts.length - 1] !== t.textContent) window.__toasts.push(t.textContent); })
        .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
      window.fotoCom = async (quando, nome) => {
        const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#3a6'; g.fillRect(0, 0, 40, 30);
        const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
        const txt = [...new TextEncoder().encode(quando + '\0')]; const u16 = n => [n & 255, n >> 8], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
        const tiff = [0x49, 0x49, ...u16(42), ...u32(8), ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0), ...u16(1), ...u16(0x9003), ...u16(2), ...u32(txt.length), ...u32(44), ...u32(0), ...txt];
        const app1 = [...new TextEncoder().encode('Exif'), 0, 0, ...tiff]; const tam = app1.length + 2;
        return new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, tam >> 8, tam & 255, ...app1, ...jpg.slice(2)])], nome || 'IMG_0001.jpg', { type: 'image/jpeg' });
      };
      window.escolher = async (sel, quando) => { const inp = document.querySelector(sel); const dt = new DataTransfer(); dt.items.add(await fotoCom(quando)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
      window.demo = () => JSON.parse(localStorage.getItem('mq-demo-v4'));
      window.semRede = () => { const e = new Error('Failed to fetch'); e.semRede = true; return e; };
    });
    await instalar();
    const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(700); };
    const txt = sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), sel);
    const toasts = () => p.evaluate(() => window.__toasts.join(' ‖ '));
    const fila = () => p.evaluate(async () => (await MQ.fila.listar()).map(i => ({ id: i.id, tipo: i.tipo, dono: i.dono, erro: i.erro, conflito: i.conflito, tent: i.tentativas || 0, ultimaFalha: i.ultimaFalha || null })));
    return { ctx, p, errs, entrar, txt, toasts, fila, instalar };
  };

  /* coordenação técnica aprova uma ficha aguardando do Piauí pela tela (duplo clique em Aprovar) e devolve o id */
  const aprovarFichaPI = async (p, entrar) => {
    await entrar('coord_tecnico');
    const f = await p.evaluate(() => { const x = MQ.ui.S.fichas.find(f => f.uf === 'PI' && f.resultado === 'selecionada' && f.situacao === 'aguardando'); return x && x.id; });
    if (!f) return null;
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'ficha-ver', id }), f); await p.waitForTimeout(300);
    await p.dblclick('#painel form[data-form=ficha-decisao] button[value=aprovada]').catch(() => {}); await p.waitForTimeout(800);
    return f;
  };

  /* =============== 1. Cadeia do campo: aprovar o plano → agendar implantação → registrar feita com foto =============== */
  {
    const { ctx, p, errs, entrar, txt, toasts, fila } = await novo({ width: 1280, height: 900 });
    const hoje = await p.evaluate(() => MQ.regras.hoje()); const exHoje = hoje.replace(/-/g, ':') + ' 09:12:00';
    await entrar('coord_tecnico');
    const dg = await p.evaluate(() => { const d = MQ.ui.S.diagnosticos.find(x => x.situacao === 'aguardando'); return d && { id: d.id, ficha: d.ficha_id, sem_agua: d.sem_agua }; });
    ok('1.0 há diagnóstico aguardando aprovação na demonstração', !!dg, JSON.stringify(dg));
    await p.evaluate(f => MQ.ui.abrirPainel({ tipo: 'diag-ver', ficha: f }), dg.ficha); await p.waitForTimeout(300);
    // erro de validação: devolver sem dizer o quê
    await p.click('#painel button[name=decisao][value=devolvido]'); await p.waitForTimeout(250);
    ok('1.1 devolver sem observação é barrado na tela', /Escreva o que precisa ser corrigido/.test(await txt('#painel form[data-form=diag-decisao]')));
    const audAntes = await p.evaluate(() => demo().auditoria.filter(a => a.tabela === 'diagnosticos').length);
    await p.fill('#painel textarea[name=obs]', 'Conferi as fotos e a localização com a bolsista por telefone.');
    // duplo clique em Aprovar (e Enter logo depois)
    await p.dblclick('#painel button[name=decisao][value=aprovado]').catch(() => {}); await p.keyboard.press('Enter').catch(() => {}); await p.waitForTimeout(900);
    const depois = await p.evaluate(id => { const d = demo(); return { sit: d.diagnosticos.find(x => x.id === id).situacao, aud: d.auditoria.filter(a => a.tabela === 'diagnosticos').length }; }, dg.id);
    ok('1.2 duplo clique em "Aprovar plano": aprovado, uma gravação só', depois.sit === 'aprovado' && depois.aud - audAntes <= 1, JSON.stringify(depois) + ' antes=' + audAntes);

    // dados de exemplo coerentes: nenhuma visita "realizada" com data depois de hoje
    const futuras = await p.evaluate(h => demo().visitas.filter(v => v.situacao === 'realizada' && v.data_realizada > h).map(v => v.etapa + ' ' + v.data_realizada)
      .concat(demo().diagnosticos.filter(d => d.data_visita > h).map(d => 'diagnóstico ' + d.data_visita)), hoje);
    ok('1.S dados de exemplo: nenhuma visita feita/diagnóstico com data no futuro', futuras.length === 0, futuras.join(', ') + ' (hoje ' + hoje + ')');
    if (futuras.length) {   // para seguir a cadeia, a data do diagnóstico de exemplo vai para ontem (senão a implantação de hoje é recusada)
      await p.evaluate(() => { const d = demo(); const o = new Date(); o.setDate(o.getDate() - 1); const ontem = new Date(o - o.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
        d.visitas.forEach(v => { if (v.situacao === 'realizada' && v.data_realizada > MQ.regras.hoje()) v.data_realizada = v.data_prevista = ontem; });
        d.diagnosticos.forEach(x => { if (x.data_visita > MQ.regras.hoje()) x.data_visita = ontem; }); localStorage.setItem('mq-demo-v4', JSON.stringify(d)); });
      await p.evaluate(async () => { if (MQ.ui.S.api.reler) await MQ.ui.S.api.reler(); });
    }
    // bolsista agenda a implantação
    await entrar('bolsista');
    const pode = await p.evaluate(f => { const S = MQ.ui.S; const fi = S.fichas.find(x => x.id === f); return { tem: !!fi, uf: fi && fi.uf, euUf: S.eu.uf }; }, dg.ficha);
    ok('1.3 a ficha do plano aprovado é do estado da bolsista', pode.tem && pode.uf === pode.euUf, JSON.stringify(pode));
    await p.evaluate(f => MQ.ui.abrirPainel({ tipo: 'visita-form', ficha: f, etapa: 'implantacao' }), dg.ficha); await p.waitForTimeout(300);
    // validação: sem quem faz e sem data
    await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(250);
    const errVis = await txt('#painel form[data-form=visita]');
    ok('1.4 agendar sem data e sem quem faz: barrado com as mensagens', /Escolha quem faz a visita/.test(errVis), errVis.slice(0, 200));
    const motivo = await p.evaluate(() => { const fm = document.querySelector('#painel form[data-form=visita]'); return fm ? (fm.querySelector('[data-erro]') || {}).textContent : 'sem form'; });
    const amanha = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
    await p.fill('#vi-d', amanha);
    const exec = await p.evaluate(() => { const s = document.getElementById('vi-p'); const o = [...s.options].find(o => o.value && !o.disabled); if (o) { s.value = o.value; } return o && o.value; });
    const nImpl0 = await p.evaluate(f => demo().visitas.filter(v => v.ficha_id === f && v.etapa === 'implantacao').length, dg.ficha);
    // duplo clique + Enter no Agendar
    await p.evaluate(() => { const bt = document.querySelector('#painel form[data-form=visita] button[type=submit]'); bt.click(); bt.click(); document.querySelector('#painel form[data-form=visita]').requestSubmit(); });
    await p.waitForTimeout(900);
    const nImpl = await p.evaluate(f => demo().visitas.filter(v => v.ficha_id === f && v.etapa === 'implantacao').length, dg.ficha);
    const errAg = await p.evaluate(() => { const e = document.querySelector('#painel [data-erro]'); return e && !e.hidden ? e.textContent : ''; });
    ok('1.5 três toques seguidos em "Agendar": uma visita de implantação só', nImpl - nImpl0 === 1, `antes=${nImpl0} depois=${nImpl} exec=${exec} erro=${errAg} motivoAntes=${motivo}`);
    const vImpl = await p.evaluate(f => (demo().visitas.find(v => v.ficha_id === f && v.etapa === 'implantacao' && v.situacao === 'prevista') || {}).id, dg.ficha);

    // a data prevista é amanhã: a visita só pode ser registrada como feita se a data for hoje ou antes → muda para hoje
    if (vImpl) {
      await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), vImpl); await p.waitForTimeout(300);
      await p.fill('#vi-d', hoje); await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(700);
      ok('1.6 reagendar para hoje (editar visita) grava', await p.evaluate(id => demo().visitas.find(v => v.id === id).data_prevista, vImpl) === hoje);

      /* ---- 2. Registrar a visita feita SEM internet, com foto; toques repetidos; reconexão ---- */
      await p.evaluate(id => { document.body.insertAdjacentHTML('beforeend', `<button id="abre-f" data-acao="campo-feita" data-id="${id}"></button>`); document.getElementById('abre-f').click(); document.getElementById('abre-f').remove(); }, vImpl);
      await p.waitForSelector('#painel form[data-form=visita-feita]');
      // validação: sem relato e sem foto
      await p.click('#painel form[data-form=visita-feita] button[type=submit]'); await p.waitForTimeout(300);
      const ev = await txt('#painel form[data-form=visita-feita]');
      ok('2.1 "feita" sem relato: barrado com a mensagem', /pelo menos 20 letras/.test(ev), ev.slice(0, 160));
      await p.fill('#vf-rel', 'Entregue o kit de gotejamento; montados 3 canteiros com a família.');
      await p.click('#painel form[data-form=visita-feita] button[type=submit]'); await p.waitForTimeout(300);
      ok('2.2 "feita" sem foto: barrado com a mensagem', /pelo menos 1 foto/.test(await txt('#painel form[data-form=visita-feita]')));
      await p.evaluate(e => escolher('#vf-f1', e), exHoje); await p.waitForTimeout(900);
      ok('2.3 foto do dia aceita', /Foto pronta/.test(await txt('#vf-f1-dica')), await txt('#vf-f1-dica'));
      await ctx.setOffline(true); await p.waitForTimeout(200);
      await p.evaluate(() => { const fm = document.querySelector('#painel form[data-form=visita-feita]'); const bt = fm.querySelector('button[type=submit]'); bt.click(); bt.click(); fm.requestSubmit(); });
      await p.waitForTimeout(1200);
      let fl = await fila();
      ok('2.4 sem internet: toques repetidos guardam UM item na fila', fl.filter(i => i.id === vImpl).length === 1 && fl.length === 1, JSON.stringify(fl));
      ok('2.5 sem internet: o servidor ainda não tem a visita feita', await p.evaluate(id => demo().visitas.find(v => v.id === id).situacao, vImpl) === 'prevista');
      ok('2.6 sem internet: avisa que ficou guardado no aparelho', /guardada no aparelho/.test(await toasts()), await toasts());
      ok('2.7 sem internet: faixa/aviso de conexão aparece', /sem internet|Sem internet/i.test(await txt('body')));
      // a pessoa abre de novo o mesmo registro na fila e salva outra vez (correção do texto) ainda sem internet
      const reaberto = await p.evaluate(() => !!document.querySelector('[data-acao=ficha-fila],[data-acao=campo-fila],[data-acao=fila-abrir]'));
      // volta a internet: o evento online sincroniza sozinho
      await ctx.setOffline(false); await p.waitForTimeout(2000);
      fl = await fila();
      const sv = await p.evaluate(id => { const v = demo().visitas.find(x => x.id === id); return { sit: v.situacao, fotos: (v.fotos || []).length }; }, vImpl);
      ok('2.8 internet de volta: a fila esvazia sozinha', fl.length === 0, JSON.stringify(fl));
      ok('2.9 internet de volta: visita realizada com a foto, sem duplicar', sv.sit === 'realizada' && sv.fotos === 1 && await p.evaluate(f => demo().visitas.filter(v => v.ficha_id === f && v.etapa === 'implantacao').length, dg.ficha) === 1, JSON.stringify(sv));
      ok('2.10 avisa "registro enviado"', /registro enviado/.test(await toasts()), (await toasts()).slice(-200));
      void reaberto;
    }
    ok('1/2 sem erro de página', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* =============== 3. "Gravou no servidor, mas a resposta não chegou" (sinal caiu no meio do envio) =============== */
  {
    const { ctx, p, errs, entrar, txt, toasts, fila } = await novo({ width: 390, height: 800 });
    await entrar('bolsista');
    const v = await p.evaluate(() => { const S = MQ.ui.S; const x = S.visitas.find(v => v.situacao === 'prevista' && v.uf === S.eu.uf); return x && { id: x.id, ficha: x.ficha_id, marca: x.atualizado_em }; });
    ok('3.0 há visita prevista do estado para editar', !!v);
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), v.id); await p.waitForTimeout(300);
    await p.fill('#vi-o', 'Levar a mangueira de 50 m');
    // 1ª tentativa: o servidor grava e a resposta se perde (Failed to fetch)
    await p.evaluate(() => { const a = MQ.ui.S.api; window.__orig = a.salvarVisita; let n = 0;
      a.salvarVisita = async function (...x) { n++; if (n === 1) { await window.__orig.apply(this, x); throw semRede(); } return window.__orig.apply(this, x); }; });
    await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(900);
    let fl = await fila();
    const srv = await p.evaluate(id => demo().visitas.find(x => x.id === id).obs, v.id);
    ok('3.1 o servidor gravou a observação na 1ª tentativa', srv === 'Levar a mangueira de 50 m', srv);
    ok('3.2 a tela tratou como "guardado no aparelho" (item continua na fila para reenviar)', fl.length === 1 && !fl[0].erro, JSON.stringify(fl) + ' ' + await toasts());
    // reenvio automático (o mesmo que acontece quando a internet volta / a cada 2 min)
    await p.evaluate(async () => { await MQ.ui.sincronizar(false); }); await p.waitForTimeout(600);
    fl = await fila();
    const nVis = await p.evaluate(f => demo().visitas.filter(x => x.ficha_id === f && x.etapa === 'diagnostico' && x.situacao !== 'cancelada').length, v.ficha);
    ok('3.3 reenvio: não duplica a visita', nVis === 1, 'visitas da etapa=' + nVis);
    ok('3.4 reenvio da MESMA alteração não vira "alterado por outra pessoa" (conflito) nem erro', fl.length === 0, JSON.stringify(fl));
    ok('3.5 a tela não mostra o aviso de conflito para a própria alteração', !/outra pessoa alterou antes/.test(await txt('body')), (await txt('body')).match(/.{0,60}outra pessoa alterou.{0,60}/) ? (await txt('body')).match(/.{0,60}outra pessoa alterou.{0,60}/)[0] : '');

    // mesmo caso com registro NOVO (sem marca): agendar visita nova com a resposta perdida
    await p.evaluate(() => { MQ.ui.S.api.salvarVisita = window.__orig; });
    const fAprov = await aprovarFichaPI(p, entrar); await entrar('bolsista');
    ok('3.5b ficha aprovada pela coordenação técnica (duplo clique) com uma gravação só', !!fAprov && await p.evaluate(id => { const d = demo(); return d.fichas.find(x => x.id === id).situacao === 'aprovada' && d.auditoria.filter(a => a.registro_id === id && a.tabela === 'fichas' && a.acao === 'UPDATE').length === 1; }, fAprov),
      fAprov && JSON.stringify(await p.evaluate(id => demo().auditoria.filter(a => a.registro_id === id).map(a => a.acao + ':' + (a.depois || {}).situacao), fAprov)));
    const fNova = await p.evaluate(() => { const S = MQ.ui.S; const f = S.fichas.find(x => x.uf === S.eu.uf && x.resultado === 'selecionada' && x.situacao === 'aprovada' && !S.visitas.some(v => v.ficha_id === x.id && v.situacao !== 'cancelada')); return f && f.id; });
    if (fNova) {
      await p.evaluate(f => MQ.ui.abrirPainel({ tipo: 'visita-form', ficha: f, etapa: 'diagnostico' }), fNova); await p.waitForTimeout(300);
      const amanha = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
      await p.fill('#vi-d', amanha); await p.evaluate(() => { const s = document.getElementById('vi-p'); s.value = [...s.options].find(o => o.value && !o.disabled).value; });
      await p.evaluate(() => { const a = MQ.ui.S.api; let n = 0; a.salvarVisita = async function (...x) { n++; if (n === 1) { await window.__orig.apply(this, x); throw semRede(); } return window.__orig.apply(this, x); }; });
      await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(800);
      await p.evaluate(async () => { await MQ.ui.sincronizar(false); }); await p.waitForTimeout(600);
      const n = await p.evaluate(f => demo().visitas.filter(x => x.ficha_id === f && x.situacao !== 'cancelada').length, fNova);
      ok('3.6 visita NOVA com resposta perdida: reenvio não cria duas visitas', n === 1, 'n=' + n + ' fila=' + JSON.stringify(await fila()));
      await p.evaluate(() => { MQ.ui.S.api.salvarVisita = window.__orig; });
    } else ok('3.6 (bloqueado) não há ficha aprovada sem visita no estado', false, 'BLOQUEADO');

    // servidor fora do ar (503) repetidamente: o item não vira erro definitivo e a tela diz quantas tentativas
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), v.id); await p.waitForTimeout(300);
    await p.fill('#vi-o', 'Levar também sementes');
    await p.evaluate(() => { MQ.ui.S.api.salvarVisita = async () => { const e = new Error('Service Unavailable'); e.original = { status: 503 }; throw e; }; });
    await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(700);
    await p.evaluate(async () => { await MQ.ui.sincronizar(false); await MQ.ui.sincronizar(false); }); await p.waitForTimeout(400);
    fl = await fila();
    ok('3.7 servidor fora (503): item continua na fila, sem erro definitivo, contando tentativas', fl.length === 1 && !fl[0].erro && fl[0].tent >= 2, JSON.stringify(fl));
    await p.evaluate(() => { MQ.ui.S.api.salvarVisita = window.__orig; }); await p.evaluate(async () => { await MQ.ui.sincronizar(false); }); await p.waitForTimeout(500);
    ok('3.8 servidor volta: o item sobe', (await fila()).length === 0 && await p.evaluate(id => demo().visitas.find(x => x.id === id).obs, v.id) === 'Levar também sementes', JSON.stringify(await fila()));
    ok('3 sem erro de página', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* =============== 4. Diagnóstico sem visita agendada: recusa do servidor e nova tentativa =============== */
  {
    const { ctx, p, errs, entrar, txt, fila } = await novo({ width: 1280, height: 900 });
    await aprovarFichaPI(p, entrar);
    await entrar('bolsista');
    const hoje = await p.evaluate(() => MQ.regras.hoje());
    const f = await p.evaluate(() => { const S = MQ.ui.S; const x = S.fichas.find(f => f.uf === S.eu.uf && f.resultado === 'selecionada' && f.situacao === 'aprovada' && !S.visitas.some(v => v.ficha_id === f.id && v.situacao !== 'cancelada') && !S.diagnosticos.some(d => d.ficha_id === f.id)); return x && x.id; });
    ok('4.0 há mulher selecionada e aprovada sem visita (botão "Registrar diagnóstico" direto)', !!f);
    if (f) {
      // regra que só o servidor confere: data da visita antes da data da ficha. A ficha é de hoje; a bolsista põe ontem.
      await p.evaluate(({ f, hoje }) => { const d = demo(); d.fichas.find(x => x.id === f).data_ficha = hoje; localStorage.setItem('mq-demo-v4', JSON.stringify(d)); }, { f, hoje });
      await p.evaluate(async () => { if (MQ.ui.S.api.reler) await MQ.ui.S.api.reler(); await MQ.ui.carregar(); MQ.ui.render(); });
      await p.evaluate(f => { document.body.insertAdjacentHTML('beforeend', `<button id="abre-d" data-acao="campo-diag-novo" data-ficha="${f}"></button>`); document.getElementById('abre-d').click(); document.getElementById('abre-d').remove(); }, f);
      await p.waitForSelector('#painel form[data-form=diag]');
      ok('4.1 formulário abre sem visita ligada (data-visita vazio)', await p.evaluate(() => document.querySelector('#painel form[data-form=diag]').dataset.visita === ''));
      const ontem = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); });
      // o preenchimento completo do diagnóstico (3 fotos, família, água, kit…) é coberto em outros testes; aqui a conferência da
      // TELA é dispensada para chegar à regra do servidor (o que a bolsista veria com o formulário todo certo)
      await p.evaluate(() => { window.__val = MQ.regras.validarDiagnostico; MQ.regras.validarDiagnostico = () => ({}); });
      await p.fill('#painel input[name=data_visita]', ontem);
      await p.evaluate(() => { const fm = document.querySelector('#painel form[data-form=diag]'); fm.latitude.value = '-5.0892'; fm.longitude.value = '-42.8016'; });
      await p.evaluate(() => document.querySelector('#painel form[data-form=diag]').requestSubmit()); await p.waitForTimeout(900);
      const e1 = await p.evaluate(() => { const e = document.querySelector('#painel form[data-form=diag] [data-erro]'); return e ? e.textContent : (document.getElementById('toast') || {}).textContent; });
      const vis1 = await p.evaluate(f => demo().visitas.filter(v => v.ficha_id === f && v.etapa === 'diagnostico' && v.situacao !== 'cancelada').length, f);
      ok('4.2 servidor recusa (data antes da ficha) e a mensagem aparece', /anterior à data da ficha/.test(e1 + ' ' + (await p.evaluate(() => window.__toasts.join(' ')))), e1);
      ok('4.3 (efeito colateral) a visita de diagnóstico criada na 1ª tentativa ficou no servidor', vis1 === 1, 'visitas=' + vis1);
      // a bolsista corrige a data e salva de novo, no MESMO formulário
      await p.fill('#painel input[name=data_visita]', hoje);
      await p.evaluate(() => document.querySelector('#painel form[data-form=diag]').requestSubmit()); await p.waitForTimeout(1000);
      const r2 = await p.evaluate(f => { const d = demo(); return { dg: d.diagnosticos.filter(x => x.ficha_id === f).length, vis: d.visitas.filter(v => v.ficha_id === f && v.etapa === 'diagnostico' && v.situacao !== 'cancelada').length }; }, f);
      const e2 = await p.evaluate(() => { const e = document.querySelector('#painel form[data-form=diag] [data-erro]'); return e && !e.hidden ? e.textContent : ''; });
      const fl = await fila();
      ok('4.4 corrigida a data, o diagnóstico é gravado no mesmo formulário', r2.dg === 1, JSON.stringify(r2) + ' erro=' + e2 + ' toasts=' + (await p.evaluate(() => window.__toasts.slice(-2).join(' ‖ '))));
      ok('4.5 nenhum item com erro sobra na fila do aparelho', fl.every(i => !i.erro), JSON.stringify(fl));
      await p.evaluate(() => { MQ.regras.validarDiagnostico = window.__val; });
    }
    ok('4 sem erro de página', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* =============== 5. Dois usuários no mesmo aparelho: fila, cópia dos dados e relato não vazam =============== */
  {
    const { ctx, p, errs, entrar, txt, fila } = await novo({ width: 390, height: 800 });
    await entrar('bolsista');
    const euB = await p.evaluate(() => MQ.ui.S.eu.id);
    const v = await p.evaluate(() => { const S = MQ.ui.S; const x = S.visitas.find(v => v.situacao === 'prevista' && v.uf === S.eu.uf); return x && x.id; });
    await ctx.setOffline(true);
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), v); await p.waitForTimeout(300);
    await p.fill('#vi-o', 'Observação da bolsista guardada sem internet'); await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(700);
    ok('5.1 bolsista sem internet: item dela na fila', (await fila()).filter(i => i.dono === euB).length === 1);
    // tenta sair: o sistema avisa que há registro só no aparelho
    // (na demonstração o botão Sair não é desenhado: o teste põe um botão com a mesma ação)
    await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<button id="t-sair" data-acao="sair">Sair</button>'); document.getElementById('t-sair').click(); }); await p.waitForTimeout(300);
    ok('5.2 ao tocar Sair com registro pendente, avisa antes', /só neste aparelho|sem internet/i.test(await p.evaluate(() => window.__toasts.join(' '))), await p.evaluate(() => window.__toasts.slice(-1)[0] || ''));
    await p.evaluate(() => MQ.ui.sair()); await p.waitForTimeout(400);
    ok('5.3 depois de sair, a cópia dos dados dela não fica no aparelho', await p.evaluate(id => !localStorage.getItem('mq-cache-' + id), euB));
    await ctx.setOffline(false);
    await entrar('agente');
    const euA = await p.evaluate(() => MQ.ui.S.eu.id);
    const sf = await p.evaluate(() => (MQ.ui.S.fila || []).map(i => i.dono));
    ok('5.4 agente no mesmo aparelho não vê a fila da bolsista', sf.every(d => d === euA), JSON.stringify(sf));
    ok('5.5 a tela da agente não mostra o texto guardado pela bolsista', !/Observação da bolsista guardada/.test(await p.content()));
    await p.evaluate(async () => { await MQ.ui.sincronizar(false); }); await p.waitForTimeout(500);
    const obs = await p.evaluate(id => demo().visitas.find(x => x.id === id).obs, v);
    ok('5.6 a sincronização da agente não envia o item da bolsista em nome dela', obs !== 'Observação da bolsista guardada sem internet' && (await fila()).filter(i => i.dono === euB).length === 1, 'obs=' + obs);
    await entrar('bolsista'); await p.waitForTimeout(1200);
    await p.evaluate(async () => { await MQ.ui.sincronizar(false); }); await p.waitForTimeout(500);
    ok('5.7 a bolsista volta e o item dela sobe com o nome dela', await p.evaluate(id => demo().visitas.find(x => x.id === id).obs, v) === 'Observação da bolsista guardada sem internet' && (await fila()).length === 0,
      JSON.stringify(await p.evaluate(id => { const a = demo().auditoria.filter(x => x.registro_id === id).pop(); return a && a.por; }, v)) + ' esperado ' + euB);
    ok('5 sem erro de página', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* =============== 6. Conexão lenta: o botão trava, a pessoa toca de novo, fecha o painel no meio =============== */
  {
    const { ctx, p, errs, entrar, txt, fila } = await novo({ width: 360, height: 740 });
    await entrar('bolsista');
    const v = await p.evaluate(() => { const S = MQ.ui.S; const x = S.visitas.find(v => v.situacao === 'prevista' && v.uf === S.eu.uf); return x && x.id; });
    await p.evaluate(() => { const a = MQ.ui.S.api; window.__orig = a.salvarVisita; window.__n = 0; a.salvarVisita = async function (...x) { window.__n++; await new Promise(r => setTimeout(r, 2500)); return window.__orig.apply(this, x); }; });
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), v); await p.waitForTimeout(300);
    await p.fill('#vi-o', 'Internet lenta');
    await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(300);
    const bt = await p.evaluate(() => { const b = document.querySelector('#painel form[data-form=visita] button[type=submit]'); return b && { dis: b.disabled, t: b.textContent }; });
    ok('6.1 internet lenta: botão fica travado em "Salvando…"', bt && bt.dis && /Salvando/.test(bt.t), JSON.stringify(bt));
    await p.evaluate(() => { const fm = document.querySelector('#painel form[data-form=visita]'); fm.requestSubmit(); fm.requestSubmit(); }); await p.waitForTimeout(3500);
    ok('6.2 tocar de novo durante o envio lento não manda de novo', await p.evaluate(() => window.__n) === 1, 'chamadas=' + await p.evaluate(() => window.__n));
    ok('6.3 terminou: painel fechado e gravado', !(await p.$('#painel form[data-form=visita]')) && await p.evaluate(id => demo().visitas.find(x => x.id === id).obs, v) === 'Internet lenta');
    // fecha o painel (×) no meio de um envio lento: o envio termina e nada se perde nem duplica
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), v); await p.waitForTimeout(300);
    await p.fill('#vi-o', 'Fechei no meio');
    await p.evaluate(() => { window.__n = 0; }); await p.click('#painel form[data-form=visita] button[type=submit]'); await p.waitForTimeout(200);
    await p.evaluate(() => { const x = document.querySelector('#painel [data-acao=fechar]'); if (x) x.click(); }); await p.waitForTimeout(3200);
    ok('6.4 fechar o painel no meio do envio lento: gravou uma vez', await p.evaluate(id => demo().visitas.find(x => x.id === id).obs, v) === 'Fechei no meio' && await p.evaluate(() => window.__n) === 1, 'n=' + await p.evaluate(() => window.__n));
    ok('6.5 sem rolagem para o lado em 360 px com o painel', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    ok('6 sem erro de página', errs.filter(e => !/DIALOGO/.test(e)).length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* =============== 7. Botão Voltar do navegador =============== */
  {
    const { ctx, p, errs, entrar, txt } = await novo({ width: 390, height: 800 });
    await entrar('bolsista');
    const v = await p.evaluate(() => { const S = MQ.ui.S; const x = S.visitas.find(v => v.situacao === 'prevista' && v.uf === S.eu.uf); return x && x.id; });
    await p.evaluate(() => { const b = document.querySelector('[data-acao=campo-visita-editar]'); b.click(); }); await p.waitForTimeout(400);
    ok('7.1 painel aberto pelo botão da tela', !!(await p.$('#painel form[data-form=visita]')));
    await p.goBack(); await p.waitForTimeout(500);
    ok('7.2 Voltar sem nada digitado fecha o painel e continua no sistema', !(await p.$('#painel')) && await p.evaluate(() => !!MQ.ui.S.eu && !MQ.ui.S.verEntrada));
    await p.evaluate(() => { document.querySelector('[data-acao=campo-visita-editar]').click(); }); await p.waitForTimeout(400);
    await p.fill('#vi-o', 'Digitado e não salvo');
    await p.goBack(); await p.waitForTimeout(500);
    const t = await txt('#painel');
    ok('7.3 Voltar com algo digitado pergunta antes de fechar (não perde o texto)', !!(await p.$('#painel')) && (await p.inputValue('#vi-o').catch(() => '')) === 'Digitado e não salvo' && /sair sem salvar|Sair sem salvar|descartar|continuar/i.test(t), t.slice(0, 200));
    await p.goBack(); await p.waitForTimeout(500);
    ok('7.4 Voltar de novo com a pergunta na tela não sai do sistema', await p.evaluate(() => !!MQ.ui.S.eu && !MQ.ui.S.verEntrada) && (await p.url()).startsWith('http://localhost:8766/'), await p.url());
    // coordenação: Voltar entre abas
    await entrar('coord_geral');
    await p.evaluate(() => { const b = [...document.querySelectorAll('[data-acao=aba]')].find(x => x.dataset.aba === 'equipe'); b.click(); }); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = [...document.querySelectorAll('[data-acao=aba]')].find(x => x.dataset.aba === 'historico'); b.click(); }); await p.waitForTimeout(700);
    await p.goBack(); await p.waitForTimeout(600);
    ok('7.5 coordenação: Voltar leva à aba anterior', await p.evaluate(() => MQ.ui.S.aba) === 'equipe', await p.evaluate(() => MQ.ui.S.aba));
    ok('7 sem erro de página', errs.filter(e => !/DIALOGO/.test(e)).length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* =============== 8. iPhone deitado (844x390) e celular 360x740: formulário da visita feita usável =============== */
  for (const vp of [{ width: 844, height: 390, n: 'iPhone deitado' }, { width: 360, height: 740, n: '360x740' }]) {
    const { ctx, p, errs, entrar } = await novo({ width: vp.width, height: vp.height }, { ctx: { hasTouch: true, isMobile: vp.width < 400 } });
    await entrar('bolsista');
    const v = await p.evaluate(() => { const S = MQ.ui.S; const x = S.visitas.find(v => v.situacao === 'prevista' && v.uf === S.eu.uf); return x && x.id; });
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'visita-form', id }), v); await p.waitForTimeout(400);
    const m = await p.evaluate(() => { const fm = document.querySelector('#painel form'); const bt = fm.querySelector('button[type=submit]'); bt.scrollIntoView({ block: 'center' });
      const r = bt.getBoundingClientRect(); const c = document.querySelector('#painel .painel-corpo');
      return { semLado: document.documentElement.scrollWidth <= innerWidth + 1 && (!c || c.scrollWidth <= c.clientWidth + 1), visivel: r.top >= 0 && r.bottom <= innerHeight + 1 && r.height >= 40, alto: r.height,
        topo: (() => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(e && (e === bt || bt.contains(e))); })() }; });
    ok(`8 ${vp.n}: sem rolagem lateral, botão Salvar alcançável e por cima (≥40 px)`, m.semLado && m.visivel && m.topo, JSON.stringify(m));
    await p.tap('#painel form button[type=submit]').catch(async () => p.click('#painel form button[type=submit]')); await p.waitForTimeout(700);
    ok(`8 ${vp.n}: tocar em Salvar grava e fecha`, !(await p.$('#painel form[data-form=visita]')));
    ok(`8 ${vp.n}: sem erro de página`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
