/* Auditoria independente de 18/10/2026 (véspera do teste real): os achados confirmados, para não voltarem.
   1. visita mudada ou cancelada pela coordenação chega ao servidor (antes ficava presa na fila do aparelho);
   2. a coordenação técnica não vê "Registrar diagnóstico/avaliação" (o banco não deixa ela registrar);
   3. cada "Gerar link" dá um link novo (antes a segunda agente recebia o link já usado);
   4. registro recusado na fila tem "Abrir e corrigir" e "Descartar" (antes ficava preso para sempre);
   5. e-mail de quem já entrou: só a coordenação geral troca (aviso no formulário);
   6. simulacao.html não usa o armazenamento do sistema real;
   7. (20/10) barra de salvar no celular sem internet e na visita com Cancelar; Modo sol no tablet deitado.
   Uso: node testes/automaticos/auditoria_1810.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, typeof d === 'string' ? d : JSON.stringify(d)]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function sessao(w) {
    const ctx = await b.newContext({ viewport: { width: w || 1280, height: 900 } });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8766/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('button[data-p]');
    return { ctx, p };
  }
  const perfil = async (p, pf) => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(700); await p.evaluate(() => MQ.ui.fecharPainel()); };
  const aba = async (p, a) => { await p.evaluate(a => { MQ.ui.S.aba = a; MQ.ui.render(); }, a); await p.waitForTimeout(500); };

  /* ---------- 1 e 2: coordenação no Roteiro ---------- */
  { const { ctx, p } = await sessao();
    await perfil(p, 'coord_tecnico'); await aba(p, 'campo');
    const bt = await p.evaluate(() => ({ mudar: document.querySelectorAll('[data-acao=campo-visita-editar]').length,
      diag: document.querySelectorAll('[data-acao=campo-diag-novo]').length, aval: document.querySelectorAll('[data-acao=aval-novo]').length }));
    ok('Coord. técnica: Roteiro sem "Registrar diagnóstico" nem "Registrar avaliação" (o banco recusa)', bt.diag === 0 && bt.aval === 0, bt);
    ok('Coord. técnica: continua podendo mudar data ou pessoa', bt.mudar > 0, bt);
    if (bt.mudar) {
      const id = await p.$eval('[data-acao=campo-visita-editar]', e => e.dataset.id);
      await p.click(`[data-acao=campo-visita-editar][data-id="${id}"]`); await p.waitForTimeout(500);
      const nova = await p.evaluate(() => MQ.regras.somaDias(MQ.regras.hoje(), 12));
      await p.fill('form[data-form=visita] [name=data_prevista]', nova);
      await p.click('form[data-form=visita] button[type=submit]'); await p.waitForTimeout(1500);
      const r = await p.evaluate(async id => ({ serv: (await MQ.ui.S.api.listarVisitas()).find(v => v.id === id).data_prevista, fila: (await MQ.fila.listar(MQ.ui.S.eu.id)).length }), id);
      ok('Coord. técnica muda a data: chega ao servidor e a fila do aparelho fica vazia', r.serv === nova && r.fila === 0, Object.assign({ nova }, r));
    }
    await perfil(p, 'coord_geral'); await aba(p, 'campo');
    const temDiag = await p.evaluate(() => document.querySelectorAll('[data-acao=campo-diag-novo], [data-acao=campo-diag-ver], [data-acao=aval-novo], [data-acao=campo-feita]').length);
    ok('Coord. geral: continua com os botões de registro no Roteiro', temDiag > 0, String(temDiag));
    await ctx.close(); }

  /* ---------- 3: link de cadastro ---------- */
  { const { ctx, p } = await sessao();
    await perfil(p, 'coord_tecnico');
    const l = await p.evaluate(async () => { const a = await MQ.convitesUI.gerarLink({ papel: 'agente', uf: 'PI' }, true); const b2 = await MQ.convitesUI.gerarLink({ papel: 'agente', uf: 'PI' }, true);
      const guardado = await MQ.convitesUI.gerarLink({ papel: 'agente', uf: 'PI' }); return { a, b2, guardado }; });
    ok('Gerar link duas vezes: dois links diferentes (cada agente o seu)', l.a && l.b2 && l.a !== l.b2, l);
    ok('Com o painel aberto, o link mostrado é o último gerado', l.guardado === l.b2);
    await ctx.close(); }

  /* ---------- 4: registro recusado na fila ---------- */
  { const { ctx, p } = await sessao(390);
    await perfil(p, 'agente');
    const v = await p.evaluate(async () => { const eu = MQ.ui.S.eu; const v = MQ.ui.S.visitas.find(x => x.executor_id === eu.id && x.situacao === 'prevista' && x.etapa === 'diagnostico'); if (!v) return null;
      const dados = { id: MQ.novoId(), ficha_id: v.ficha_id, visita_id: v.id, uf: v.uf, data_visita: MQ.regras.hoje(), latitude: -7.1, longitude: -41.5, sem_agua: false, fotos: [], dados: { kit: [] } };
      await MQ.fila.salvar({ id: dados.id, dono: eu.id, tipo: 'diagnostico', dados, fotos: null, erro: null, marca: v.atualizado_em, mud: [] }); return v.id; });
    if (v) {
      await perfil(p, 'bolsista');
      await p.evaluate(async id => { const x = MQ.ui.S.visitas.find(y => y.id === id); await MQ.ui.S.api.salvarVisita(Object.assign({}, x, { situacao: 'cancelada' }), null, { marca: x.atualizado_em }); }, v);
      await perfil(p, 'agente'); await p.evaluate(() => MQ.ui.sincronizar(false)); await p.waitForTimeout(900);
      const bts = await p.evaluate(() => [...document.querySelectorAll('.fila-campo button')].map(x => x.textContent.trim()));
      ok('Registro recusado: aparecem "Abrir e corrigir" e "Descartar"', bts.includes('Abrir e corrigir') && bts.includes('Descartar'), bts);
      await p.click('.fila-campo [data-acao=campo-conferir]'); await p.waitForTimeout(500);
      ok('Abrir um registro de quintal que saiu da lista explica o porquê', /não está mais na sua lista/.test(await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '))));
      await p.click('.fila-campo [data-acao=campo-descartar]'); await p.waitForTimeout(600);
      const meio = await p.evaluate(async () => (await MQ.fila.listar(MQ.ui.S.eu.id)).length);
      await p.click('.fila-campo [data-acao=campo-descartar]'); await p.waitForTimeout(700);
      const fim = await p.evaluate(async () => (await MQ.fila.listar(MQ.ui.S.eu.id)).length);
      ok('Descartar pede um segundo toque e então tira o registro do aparelho', meio === 1 && fim === 0 && !(await p.$('.fila-campo')), { meio, fim });
    } else ok('Registro recusado: cenário montado', false, 'sem visita de diagnóstico prevista para a agente');
    await ctx.close(); }

  /* ---------- 5: e-mail de quem já entrou ---------- */
  { const { ctx, p } = await sessao();
    for (const [pf, readonly] of [['coord_tecnico', true], ['coord_geral', false]]) {
      await perfil(p, pf);
      const r = await p.evaluate(() => { const m = MQ.ui.S.equipe.find(x => x.papel === 'articulacao' && x.status === 'ativa'); m.user_id = 'u-teste'; MQ.ui.abrirPainel({ tipo: 'cadastro', id: m.id });
        const i = document.querySelector('#c-email'); return i && { ro: i.readOnly, dica: i.parentElement.querySelector('.dica').textContent }; });
      ok(`${pf}: e-mail de quem já entrou ${readonly ? 'só leitura' : 'editável'}, com o aviso de que a troca apaga a senha`, r && r.ro === readonly && /apaga a senha/.test(r.dica), r);
      await p.evaluate(() => MQ.ui.fecharPainel());
    }
    await ctx.close(); }

  /* ---------- 7 (20/10/2026, simulação em aparelhos): barra de salvar no celular com o aviso de sem internet e com "Cancelar esta visita" ---------- */
  { const { ctx, p } = await sessao(320);
    await perfil(p, 'bolsista'); await p.click('[data-acao=ficha-nova]'); await p.waitForTimeout(500);
    await p.evaluate(() => document.documentElement.classList.add('sem-rede')); await p.waitForTimeout(150);
    const f = await p.evaluate(() => [...document.querySelectorAll('form[data-form=ficha] > .acoes:last-child > .btn')].map(b => Math.round(b.getBoundingClientRect().width)));
    ok('320 px sem internet: Salvar e Cancelar da ficha inteiros (antes ficavam espremidos ao lado do aviso)', f.length >= 2 && f.every(w => w >= 120), f);
    await p.evaluate(() => { document.documentElement.classList.remove('sem-rede'); MQ.ui.fecharPainel(); });
    await perfil(p, 'coord_tecnico');
    await p.evaluate(() => { const v = MQ.ui.S.visitas.find(x => x.situacao === 'prevista'); MQ.ui.abrirPainel({ tipo: 'visita-form', id: v.id }); }); await p.waitForTimeout(500);
    const v = await p.evaluate(() => [...document.querySelectorAll('form[data-form=visita] > .acoes > .btn')].map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().width)]));
    ok('320 px: Salvar e Fechar da visita inteiros, Cancelar esta visita na linha de baixo', v.length === 3 && v.every(([, w]) => w >= 120), v);
    await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
    await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('button[data-p]');
    await p.evaluate(() => document.querySelector('button[data-p=entrada]').click()); await p.waitForTimeout(800);
    const h = await p.evaluate(() => { const b = document.querySelector('.ent-aparencia'); return b ? Math.round(b.getBoundingClientRect().height) : null; });
    ok('Tablet deitado: Modo sol da tela de entrada com 44 px para o dedo', h >= 44, String(h));
    await ctx.close(); }

  /* ---------- 6: simulação isolada ---------- */
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push('simulação: ' + e.message));
    await p.goto('http://localhost:8766/simulacao.html'); await p.waitForTimeout(2000);
    for (const pf of ['coord_tecnico', 'bolsista']) { await p.click(`button[data-p=${pf}]`); await p.waitForTimeout(1500); }
    const q = await ctx.newPage(); await q.goto('http://localhost:8766/assets/icon-192.png');
    const real = await q.evaluate(() => { const ks = []; let t = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ks.push(k); t += localStorage.getItem(k).length; } return { ks, t }; });
    ok('Simulação: só chaves "mq-sim:" no armazenamento do endereço, e pequenas', real.ks.every(k => k.indexOf('mq-sim:') === 0) && real.t < 2000, real);
    await ctx.close(); }

  ok('Sem erro de página', errs.length === 0, errs.join(' | '));
  await b.close();
  R.forEach(r => console.log(r.join(' | '))); const f = R.filter(r => r[0] === 'FALHOU').length;
  console.log('TOTAL', R.length, 'FALHAS', f); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
