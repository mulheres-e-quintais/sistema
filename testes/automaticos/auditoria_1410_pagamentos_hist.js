/* Auditoria 14/10/2026 — pagamentos (pedido → aval → Arlo), cadastro da equipe e histórico (filtros, ver o que mudou, CSV):
   sucesso, erro de validação, toque repetido, sem internet e "gravou mas a resposta não chegou".
   Uso: node testes/automaticos/auditoria_1410_pagamentos_hist.js <caminho do playwright>   (servidor em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 220) : '')); };
let seq = 300000000; const cpf = () => { const b = String(seq++).padStart(9, '0').split('').map(Number);
  const dv = a => { const s = a.reduce((t, x, i) => t + x * (a.length + 1 - i), 0) % 11; return s < 2 ? 0 : 11 - s; }; b.push(dv(b)); b.push(dv(b)); return b.join(''); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOGO: ' + d.message()); d.dismiss(); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort()); await ctx.route('**/viacep.com.br/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('.resumo');
  await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
  await p.evaluate(() => {
    window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (t && !t.hidden && t.textContent && window.__toasts[window.__toasts.length - 1] !== t.textContent) window.__toasts.push(t.textContent); })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    window.demo = () => JSON.parse(localStorage.getItem('mq-demo-v4'));
    window.semRede = () => { const e = new Error('Failed to fetch'); e.semRede = true; return e; };
  });
  const entrar = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(700); await p.evaluate(() => MQ.ui.fecharPainel()); };
  const txt = sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), sel);
  const ultToast = () => p.evaluate(() => window.__toasts.slice(-1)[0] || '');
  const erroDe = sel => p.evaluate(sel => { const e = document.querySelector(sel + ' [data-erro]'); return e && !e.hidden ? e.textContent : ''; }, sel);
  const aba = async a => { await p.evaluate(a => { const b = document.querySelector(`[data-acao=aba][data-aba=${a}]`); if (b) b.click(); }, a); await p.waitForTimeout(400); };
  const solic = () => p.evaluate(() => demo().solicitacoes || []);
  const audDe = id => p.evaluate(id => demo().auditoria.filter(a => a.registro_id === id).map(a => a.acao + ':' + ((a.depois || {}).situacao || '')), id);

  /* ============ 9. Bolsa: pedido → aval → Arlo ============ */
  await entrar('bolsista');
  const euB = await p.evaluate(() => MQ.ui.S.eu.id);
  const temForm = await p.$('form[data-form=pag-bolsa]');
  ok('9.0 a bolsista vê o pedido de bolsa do mês', !!temForm);
  if (temForm) {
    await p.fill('form[data-form=pag-bolsa] textarea[name=relatorio]', 'Pouco texto');
    await p.click('form[data-form=pag-bolsa] button[type=submit]'); await p.waitForTimeout(300);
    ok('9.1 relatório curto: barrado na tela', /pelo menos 50 letras/.test(await txt('form[data-form=pag-bolsa]')));
    const rel = 'Em outubro fiz 3 reuniões com as comunidades de Paulistana, apliquei 4 fichas de indicação e acompanhei a agente nas visitas.';
    await p.fill('form[data-form=pag-bolsa] textarea[name=relatorio]', rel);
    // SEM internet: o pedido não vai para a fila; a tela deve avisar e manter o texto
    await ctx.setOffline(true); await p.waitForTimeout(150);
    await p.evaluate(() => { const a = MQ.ui.S.api; window.__origSol = a.solicitarPagamento; a.solicitarPagamento = async () => { throw semRede(); }; });
    await p.click('form[data-form=pag-bolsa] button[type=submit]'); await p.waitForTimeout(500);
    const msgOff = (await erroDe('form[data-form=pag-bolsa]')) || await ultToast();
    ok('9.2 sem internet: avisa e o relatório digitado continua na tela', /internet|conex/i.test(msgOff) && (await p.inputValue('form[data-form=pag-bolsa] textarea[name=relatorio]').catch(() => '')) === rel, msgOff);
    ok('9.3 sem internet: nenhum pedido gravado', (await solic()).filter(s => s.equipe_id === euB && s.tipo === 'bolsa').length === 0);
    await ctx.setOffline(false);
    // "gravou e a resposta não chegou": a 1ª chamada grava e falha; a pessoa toca de novo
    await p.evaluate(() => { const a = MQ.ui.S.api; let n = 0; a.solicitarPagamento = async function (...x) { n++; if (n === 1) { await window.__origSol.apply(this, x); throw semRede(); } return window.__origSol.apply(this, x); }; });
    await p.click('form[data-form=pag-bolsa] button[type=submit]'); await p.waitForTimeout(600);
    const msg1 = (await erroDe('form[data-form=pag-bolsa]')) || await ultToast();
    const n1 = (await solic()).filter(s => s.equipe_id === euB && s.tipo === 'bolsa').length;
    let msg2 = '';
    if (await p.$('form[data-form=pag-bolsa]')) { await p.click('form[data-form=pag-bolsa] button[type=submit]'); await p.waitForTimeout(600); msg2 = (await erroDe('form[data-form=pag-bolsa]')) || await ultToast(); }
    const n2 = (await solic()).filter(s => s.equipe_id === euB && s.tipo === 'bolsa').length;
    ok('9.4 resposta perdida + novo toque: continua UM pedido de bolsa no mês', n1 === 1 && n2 === 1, `n1=${n1} n2=${n2}`);
    ok('9.5 resposta perdida: a pessoa fica sabendo que o pedido JÁ foi registrado (não "erro"/"já solicitou")', !(await p.$('form[data-form=pag-bolsa]')) || /solicitada|registrad/i.test(msg2) && !/já solicitou/i.test(msg2), `1ª: ${msg1} ‖ 2ª: ${msg2}`);
    await p.evaluate(() => { MQ.ui.S.api.solicitarPagamento = window.__origSol; });
    await p.evaluate(async () => { await MQ.ui.carregar(); MQ.ui.render(); });
  }
  const sid = ((await solic()).find(s => s.equipe_id === euB && s.tipo === 'bolsa') || {}).id;
  if (sid) {
    // aval da coordenação técnica (bolsa da articulação)
    await entrar('coord_tecnico');
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'pag-ver', id }), sid); await p.waitForTimeout(300);
    ok('9.6 a coordenação técnica vê o formulário de aval', !!(await p.$('#painel form[data-form=pag-aval]')));
    await p.click('#painel form[data-form=pag-aval] button[name=ok][value="0"]').catch(() => {}); await p.waitForTimeout(300);
    ok('9.7 devolver sem dizer o quê: barrado', /Escreva o que precisa ser corrigido/.test(await txt('#painel form[data-form=pag-aval]')));
    await p.fill('#painel form[data-form=pag-aval] input[name=valor]', '999999').catch(() => {});
    await p.click('#painel form[data-form=pag-aval] button[name=ok][value="1"]').catch(() => {}); await p.waitForTimeout(300);
    ok('9.8 aval acima do pedido: barrado', /passa do valor pedido|muito acima/.test(await txt('#painel form[data-form=pag-aval]')), await erroDe('#painel form[data-form=pag-aval]'));
    await p.fill('#painel form[data-form=pag-aval] input[name=valor]', '').catch(() => {});
    await p.dblclick('#painel form[data-form=pag-aval] button[name=ok][value="1"]').catch(() => {}); await p.waitForTimeout(800);
    let a = await audDe(sid);
    ok('9.9 duplo clique em "Dar aval": um aval só, solicitação avalizada', a.filter(x => /avalizada/.test(x)).length === 1 && (await solic()).find(s => s.id === sid).situacao === 'avalizada', a.join(','));
    ok('9.10 depois do aval, a tela não mostra mensagem de erro', !/não está aguardando aval/.test(await p.evaluate(() => window.__toasts.join(' '))), await p.evaluate(() => window.__toasts.slice(-2).join(' ‖ ')));
    // Arlo pelo auxiliar administrativo
    await entrar('auxiliar');
    await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'pag-ver', id }), sid); await p.waitForTimeout(300);
    ok('9.11 o auxiliar vê "Lançar no Arlo"', !!(await p.$('#painel form[data-form=pag-arlo]')));
    if (await p.$('#painel form[data-form=pag-arlo]')) {
      await p.fill('#painel form[data-form=pag-arlo] input[name=protocolo]', 'x'.repeat(400)).catch(() => {});
      await p.click('#painel form[data-form=pag-arlo] button[type=submit]'); await p.waitForTimeout(300);
      const eA = await erroDe('#painel form[data-form=pag-arlo]');
      ok('9.12 protocolo longo demais: barrado', /longo|máximo/i.test(eA + await txt('#painel form[data-form=pag-arlo]')) || (await p.inputValue('#painel form[data-form=pag-arlo] input[name=protocolo]')).length < 400, eA);
      await p.fill('#painel form[data-form=pag-arlo] input[name=protocolo]', 'ARLO-2026-0042');
      // resposta perdida no Arlo, e a pessoa toca de novo
      await p.evaluate(() => { const a = MQ.ui.S.api; window.__origArlo = a.registrarNoArlo; let n = 0; a.registrarNoArlo = async function (...x) { n++; if (n === 1) { await window.__origArlo.apply(this, x); throw semRede(); } return window.__origArlo.apply(this, x); }; });
      await p.click('#painel form[data-form=pag-arlo] button[type=submit]'); await p.waitForTimeout(500);
      const m1 = (await erroDe('#painel form[data-form=pag-arlo]')) || await ultToast();
      let m2 = '';
      if (await p.$('#painel form[data-form=pag-arlo]')) { await p.click('#painel form[data-form=pag-arlo] button[type=submit]'); await p.waitForTimeout(500); m2 = (await erroDe('#painel form[data-form=pag-arlo]')) || await ultToast(); }
      a = await audDe(sid);
      ok('9.13 Arlo com resposta perdida: lançado uma vez só', a.filter(x => /lancada/.test(x)).length === 1, a.join(','));
      ok('9.14 Arlo com resposta perdida: o novo toque não termina em mensagem de erro confusa', !/Só solicitação com aval/.test(m2), `1ª: ${m1} ‖ 2ª: ${m2}`);
      await p.evaluate(() => { MQ.ui.S.api.registrarNoArlo = window.__origArlo; });
    }
  }

  /* ============ 10. Cadastro da equipe: toque repetido e resposta perdida ============ */
  await entrar('coord_geral'); await aba('equipe');
  const abrirManual = async sel => { await p.locator(sel + ' >> visible=true').first().click(); await p.waitForTimeout(300); if (await p.$('[data-acao=cad-modo][data-m=manual]')) { await p.click('[data-acao=cad-modo][data-m=manual]'); await p.waitForTimeout(250); } return !!(await p.$('form[data-form=cadastro]')); };
  const preencher = async d => {
    await p.fill('#c-nome', d.nome); await p.fill('#c-cpf', d.cpf); await p.fill('#c-fone', '(84) 99888-7766'); await p.fill('#c-email', d.email);
    await p.fill('#dp-cid', d.mun || 'Afogados da Ingazeira/PE').catch(() => {});
    await p.click('#w-cadastro_arlo label:has-text("Não")').catch(() => {});
    for (const k of ['agricultora', 'atua_mulheres', 'mora_rural', 'internet', 'outra_bolsa']) await p.click(`#w-pf_${k} label:has-text("${k === 'outra_bolsa' ? 'Não' : 'Sim'}")`).catch(() => {});
    await p.selectOption('#pf-exp', 'nenhuma').catch(() => {}); await p.fill('#dp-nasc', '1980-05-05').catch(() => {}); await p.check('#c-lgpd');
  };
  if (await abrirManual('[data-acao=novo][data-papel=agente][data-uf=PE]')) {
    await preencher({ nome: 'Dora Duplo Clique', cpf: cpf(), email: 'dora.duplo@gmail.com' });
    await p.evaluate(() => { const fm = document.querySelector('form[data-form=cadastro]'); const bt = fm.querySelector('button[type=submit]'); bt.click(); bt.click(); fm.requestSubmit(); }); await p.waitForTimeout(1200);
    const n = await p.evaluate(() => demo().equipe.filter(m => m.email === 'dora.duplo@gmail.com').length);
    ok('10.1 três toques em Salvar no cadastro: uma pessoa só', n === 1, 'n=' + n + ' erro=' + await erroDe('form[data-form=cadastro]'));
    await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200);
  } else ok('10.1 (bloqueado) cadastro de agente PE não abriu', false, 'BLOQUEADO');
  if (await abrirManual('[data-acao=novo][data-papel=agente][data-uf=PE]')) {
    const c = cpf(); await preencher({ nome: 'Eva Resposta Perdida', cpf: c, email: 'eva.perdida@gmail.com' });
    await p.evaluate(() => { const a = MQ.ui.S.api; window.__origCriar = a.criar; let n = 0; a.criar = async function (...x) { n++; if (n === 1) { await window.__origCriar.apply(this, x); throw semRede(); } return window.__origCriar.apply(this, x); }; });
    await p.click('form[data-form=cadastro] button[type=submit]'); await p.waitForTimeout(700);
    const m1 = (await erroDe('form[data-form=cadastro]')) || await ultToast();
    let m2 = '';
    if (await p.$('form[data-form=cadastro]')) { await p.click('form[data-form=cadastro] button[type=submit]'); await p.waitForTimeout(700); m2 = (await erroDe('form[data-form=cadastro]')) || await ultToast(); }
    const n = await p.evaluate(() => demo().equipe.filter(m => m.email === 'eva.perdida@gmail.com').length);
    ok('10.2 cadastro com resposta perdida + novo toque: uma pessoa só', n === 1, 'n=' + n);
    ok('10.3 cadastro com resposta perdida: a tela não manda a coordenação "conferir o CPF" de quem acabou de cadastrar', !/CPF|já está na equipe|já ocupa/i.test(m2), `1ª: ${m1} ‖ 2ª: ${m2}`);
    await p.evaluate(() => { MQ.ui.S.api.criar = window.__origCriar; MQ.ui.fecharPainel(); });
  } else ok('10.2 (bloqueado)', false, 'BLOQUEADO');

  /* ============ 11. Histórico: filtros, ver o que mudou, CSV ============ */
  await p.evaluate(async () => { await MQ.ui.carregar(); }); await aba('historico'); await p.waitForTimeout(800);
  ok('11.0 histórico abre com filtros', !!(await p.$('#hf-quem')) && !!(await p.$('#hf-grupo')) && !!(await p.$('#hf-busca')));
  const total = await p.evaluate(() => MQ.ui.S.aud.length);
  const quem = await p.evaluate(() => { const o = [...document.querySelectorAll('#hf-quem option')].filter(o => o.value && o.value !== '_sistema'); return o.map(x => [x.value, x.textContent]); });
  if (quem.length) {
    await p.selectOption('#hf-quem', quem[0][0]); await p.waitForTimeout(300);
    const st = await txt('.hist-filtros + p, p[role=status]');
    const esperado = await p.evaluate(id => MQ.ui.S.aud.filter(a => a.por === id).length, quem[0][0]);
    ok('11.1 filtro "Quem fez" mostra só os registros da pessoa (contagem certa)', new RegExp('^' + esperado + ' de ' + total).test(st), st + ' esperado ' + esperado);
    ok('11.2 filtro preservado: o select continua na pessoa depois de redesenhar', await p.inputValue('#hf-quem') === quem[0][0]);
    // CSV do filtrado
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('[data-acao=hist-csv]')]);
    let linhas = -1, cab = '', nomeOk = false;
    if (dl) { const fs = require('fs'); const cam = await dl.path(); const t = fs.readFileSync(cam, 'utf8'); linhas = t.replace(/^﻿/, '').split('\r\n').length - 1; cab = t.split('\r\n')[0]; nomeOk = /^historico-mulheres-e-quintais-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()); }
    ok('11.3 CSV baixa com o mesmo número de linhas do filtro e cabeçalho', dl && linhas === esperado && /Quem fez/.test(cab) && nomeOk, `linhas=${linhas} esperado=${esperado} nome=${dl && dl.suggestedFilename()}`);
    await p.waitForTimeout(600);
    ok('11.4 o download da planilha fica registrado no histórico', await p.evaluate(() => (demo().auditoria || []).concat(demo().planilhas || []).some(a => /historico/.test(JSON.stringify(a)) && /planilha|csv|historico/i.test(JSON.stringify(a)))), '');
    await p.click('[data-acao=hist-limpar]'); await p.waitForTimeout(300);
    ok('11.5 Limpar filtros volta a todos', await p.inputValue('#hf-quem') === '' && !/com este filtro/.test(await txt('p[role=status]')));
  } else ok('11.1 (bloqueado) histórico sem pessoas', false, 'BLOQUEADO');
  // busca sem resultado e "ver o que mudou"
  await p.fill('#hf-busca', 'zzzz-nada-assim'); await p.press('#hf-busca', 'Enter'); await p.waitForTimeout(300);
  ok('11.6 busca sem resultado diz o que fazer', /Nenhum registro com este filtro/.test(await txt('main')));
  await p.click('[data-acao=hist-limpar]'); await p.waitForTimeout(300);
  const temMudou = await p.evaluate(() => document.querySelectorAll('details.hist-mudou').length);
  ok('11.7 há "ver o que mudou" nas alterações (UPDATE) do histórico', temMudou > 0, 'qtde=' + temMudou);
  const mudouPag = await p.evaluate(() => MQ.ui.S.aud.filter(a => a.tabela === 'solicitacoes_pagamento' && a.acao === 'UPDATE').map(a => !!a.antes));
  ok('11.8 alterações de pagamento (aval, Arlo) têm o "antes" para mostrar o que mudou', mudouPag.length > 0 && mudouPag.every(Boolean), JSON.stringify(mudouPag));
  // dado protegido não aparece
  const html = await p.evaluate(() => [...document.querySelectorAll('details.hist-mudou')].map(d => d.textContent).join(' '));
  ok('11.9 "ver o que mudou" não mostra CPF/conta/PIX', !/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(html), html.slice(0, 160));

  /* ============ 12. Ver como o MDA/MPA vê: sai e volta ao mesmo ponto (inclusive pelo Voltar do navegador) ============ */
  await aba('equipe'); await p.waitForTimeout(500);
  if (await p.$('[data-acao=acomp-previa][data-o=mda]')) {
    await p.evaluate(() => { document.querySelector('[data-acao=acomp-previa][data-o=mda]').scrollIntoView(); });
    const antes = await p.evaluate(() => [MQ.ui.S.aba, Math.round(scrollY)]);
    await p.evaluate(() => document.querySelector('[data-acao=acomp-previa][data-o=mda]').click()); await p.waitForTimeout(900);
    ok('12.1 "Ver como o MDA vê" abre a prévia em tela inteira', await p.evaluate(() => !!MQ.ui.S.verComo) && /Pré-visualização/.test(await txt('body')));
    await p.click('#ac-voltar'); await p.waitForTimeout(600);
    const v1 = await p.evaluate(() => [MQ.ui.S.aba, Math.round(scrollY), !!MQ.ui.S.verComo]);
    ok('12.2 "Voltar à minha visão" volta à mesma aba e posição', v1[0] === antes[0] && !v1[2] && Math.abs(v1[1] - antes[1]) < 60, JSON.stringify(v1) + ' antes ' + JSON.stringify(antes));
    await p.evaluate(() => document.querySelector('[data-acao=acomp-previa][data-o=mpa]').click()); await p.waitForTimeout(900);
    const urlAntes = p.url();
    await p.goBack(); await p.waitForTimeout(800);
    const v2 = await p.evaluate(() => ({ aba: MQ.ui.S.aba, previa: !!MQ.ui.S.verComo, faixa: !!document.querySelector('.ac-faixa-previa'), dentro: !!MQ.ui.S.eu && !MQ.ui.S.verEntrada }));
    ok('12.3 Voltar do navegador na prévia: sai da prévia e fica na aba de antes', !v2.previa && v2.aba === antes[0] && v2.dentro, JSON.stringify(v2) + ' url ' + urlAntes + ' → ' + p.url());
    if (v2.previa) { await p.evaluate(() => { const b = document.getElementById('ac-voltar'); b && b.click(); }); await p.waitForTimeout(400); }
  } else ok('12.0 (bloqueado) botão "Ver como o MDA vê" não encontrado na aba Equipe', false, 'BLOQUEADO');

  /* ============ 13. Pedido de passagem: toque repetido e resposta perdida (o id do pedido nasce no servidor) ============ */
  const dia = n => { const d = new Date(Date.now() + n * 864e5 - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 10); };
  await entrar('bolsista');
  const peds = () => p.evaluate(() => (demo().pedidos || []).length);
  const abrePass = async () => { await p.evaluate(() => { const b = document.querySelector('[data-acao=viag-nova][data-t=passagem]'); b && b.click(); }); await p.waitForTimeout(300); return !!(await p.$('form[data-form=viag-salvar]')); };
  const enchePass = async tit => {
    await p.fill('#vg-tit', tit); await p.fill('#vg-valor', '900,00'); await p.selectOption('#vg-fin', 'intercambio'); await p.fill('#vg-ori', 'Teresina/PI'); await p.fill('#vg-des', 'Petrolina/PE');
    await p.fill('#vg-ida', dia(50)); await p.dispatchEvent('#vg-ida', 'change'); await p.fill('#vg-vol', dia(53)); await p.selectOption('#vg-bag', 'mao');
    const bl = '[data-pass]:nth-of-type(1) ';
    await p.fill(bl + '[name=ps_nome]', 'Maria das Dores Silva'); await p.fill(bl + '[name=ps_cpf]', '52998224725'); await p.fill(bl + '[name=ps_nasc]', '1968-04-04');
    await p.fill(bl + '[name=ps_rg]', '1234567'); await p.fill(bl + '[name=ps_org]', 'SSP/PI'); await p.selectOption(bl + '[name=ps_sexo]', 'F'); await p.fill(bl + '[name=ps_cel]', '89999990000'); await p.fill(bl + '[name=ps_email]', 'dores@gmail.com');
  };
  if (await abrePass()) {
    const n0 = await peds(); await enchePass('Intercâmbio em Petrolina (duplo clique)');
    await p.evaluate(() => { const fm = document.querySelector('form[data-form=viag-salvar]'); const bt = fm.querySelector('button[type=submit]'); bt.click(); bt.click(); fm.requestSubmit(); }); await p.waitForTimeout(1000);
    ok('13.1 três toques em "Enviar" no pedido de passagem: um pedido só', await peds() - n0 === 1, 'novos=' + (await peds() - n0) + ' erro=' + await erroDe('form[data-form=viag-salvar]'));
    await p.evaluate(() => MQ.ui.fecharPainel());
    if (await abrePass()) {
      const n1 = await peds(); await enchePass('Intercâmbio em Petrolina (resposta perdida)');
      await p.evaluate(() => { const a = MQ.ui.S.api; window.__origPed = a.salvarPedido; let n = 0; a.salvarPedido = async function (...x) { n++; if (n === 1) { await window.__origPed.apply(this, x); throw semRede(); } return window.__origPed.apply(this, x); }; });
      await p.click('form[data-form=viag-salvar] button[type=submit]'); await p.waitForTimeout(600);
      const m1 = (await erroDe('form[data-form=viag-salvar]')) || await ultToast();
      if (await p.$('form[data-form=viag-salvar]')) { await p.click('form[data-form=viag-salvar] button[type=submit]'); await p.waitForTimeout(600); }
      const novos = await peds() - n1;
      ok('13.2 pedido de passagem com resposta perdida + novo toque: não cria dois pedidos', novos === 1, 'novos=' + novos + ' 1ª msg: ' + m1);
      await p.evaluate(() => { MQ.ui.S.api.salvarPedido = window.__origPed; MQ.ui.fecharPainel(); });
    }
  } else ok('13.0 (bloqueado) formulário de passagem não abriu', false, 'BLOQUEADO');

  /* ============ 14. Encontro do curso FIC (professor): toque repetido e resposta perdida ============ */
  await entrar('professor');
  const encs = () => p.evaluate(() => (demo().ficEncontros || []).length);
  const abreEnc = async () => { await p.evaluate(() => { const b = document.querySelector('[data-acao=enc-novo]'); b && b.click(); }); await p.waitForTimeout(400); return !!(await p.$('form[data-form=enc-salvar]')); };
  const encheEnc = async (cont, d) => {
    await p.evaluate(() => { const s = document.getElementById('en-turma'); if (s && s.tagName === 'SELECT' && !s.value) { const o = [...s.options].find(o => o.value); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } } });
    await p.fill('#en-data', d).catch(() => {}); await p.fill('#en-ch', '4').catch(() => {}); await p.selectOption('#en-mod', 'presencial').catch(() => {}); await p.fill('#en-cont', cont).catch(() => {});
  };
  if (await abreEnc()) {
    await p.click('form[data-form=enc-salvar] button[type=submit]'); await p.waitForTimeout(300);
    ok('14.1 encontro vazio: barrado na tela', !!(await erroDe('form[data-form=enc-salvar]')) || await p.$$eval('form[data-form=enc-salvar] .tem-erro', l => l.length) > 0);
    const e0 = await encs(); await encheEnc('Aula sobre compostagem e manejo do solo no quintal, com prática.', dia(-1));
    await p.evaluate(() => { const fm = document.querySelector('form[data-form=enc-salvar]'); const bt = fm.querySelector('button[type=submit]'); bt.click(); bt.click(); fm.requestSubmit(); }); await p.waitForTimeout(1000);
    ok('14.2 três toques em salvar encontro: um encontro só', await encs() - e0 === 1, 'novos=' + (await encs() - e0) + ' erro=' + await erroDe('form[data-form=enc-salvar]'));
    await p.evaluate(() => MQ.ui.fecharPainel());
    if (await abreEnc()) {
      const e1 = await encs(); await encheEnc('Aula sobre irrigação por gotejamento, montagem do kit.', dia(-2));
      await p.evaluate(() => { const a = MQ.ui.S.api; window.__origEnc = a.salvarEncontroFic; let n = 0; a.salvarEncontroFic = async function (...x) { n++; if (n === 1) { await window.__origEnc.apply(this, x); throw semRede(); } return window.__origEnc.apply(this, x); }; });
      await p.click('form[data-form=enc-salvar] button[type=submit]'); await p.waitForTimeout(600);
      if (await p.$('form[data-form=enc-salvar]')) { await p.click('form[data-form=enc-salvar] button[type=submit]'); await p.waitForTimeout(600); }
      const novos = await encs() - e1;
      ok('14.3 encontro com resposta perdida + novo toque: não cria dois encontros (carga horária em dobro na bolsa)', novos === 1, 'novos=' + novos + ' msg=' + ((await erroDe('form[data-form=enc-salvar]')) || await ultToast()));
      await p.evaluate(() => { MQ.ui.S.api.salvarEncontroFic = window.__origEnc; MQ.ui.fecharPainel(); });
    }
  } else ok('14.0 (bloqueado) formulário de encontro não abriu', false, 'BLOQUEADO');

  ok('sem erro de página', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log('TOTAL', R.length, 'FALHAS', R.filter(r => r[0] === 'FALHOU').length);
})().catch(e => { console.error(e); process.exit(1); });
