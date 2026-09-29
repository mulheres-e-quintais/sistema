/* Mulheres & Quintais — imprimir um formulário para aplicar no papel.
   Vale para os questionários aplicados às mulheres no campo: ficha de indicação, diagnóstico,
   registro de visita e avaliação final. O papel é gerado a partir do PRÓPRIO formulário da tela
   (assim nunca fica desatualizado) e sai SEMPRE EM BRANCO: nada do que foi digitado é impresso.
   Campos que na tela só aparecem depois de uma escolha também vão para o papel.
   Cabeçalho com o símbolo do projeto e os dados de quem aplica já preenchidos.
   Só aparece para quem preenche aquele formulário (bolsista: ficha; bolsista e agente: campo). */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui; const S = () => MQ.ui.S;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();

  /* formulário da tela → tipo impresso */
  const TIPOS = {
    ficha: { titulo: 'Ficha de indicação e seleção', pode: p => R.ehBolsista(p), linhas: 0 },
    diag: { titulo: 'Diagnóstico e plano do quintal (1ª visita)', pode: p => R.ehCampo(p) },
    aval: { titulo: 'Avaliação final do quintal', pode: p => R.ehCampo(p) },
    'visita-feita': { titulo: 'Registro de visita ao quintal', pode: p => R.ehCampo(p) }
  };
  const LINHAS_TABELA = { familia: 8, kit: 10, cron: 6 };   // linhas em branco das tabelas que crescem na tela
  const pode = tipo => !!(TIPOS[tipo] && S().eu && TIPOS[tipo].pode(S().eu.papel));

  /* ---------- barra que aparece no alto do formulário (painel) ---------- */
  function barra(form) {
    const t = form && form.dataset.form; if (!pode(t)) return '';
    return `<div class="imp-barra" data-imp-pular><span>Prefere aplicar no papel?</span>
      <button type="button" class="btn peq" data-acao="imp-form" data-t="${E(t)}">Imprimir em branco</button></div>`;
  }

  /* ---------- conversão da tela para o papel ---------- */
  const linha = (cls = '') => `<span class="ln ${cls}"></span>`;
  const caixa = t => `<span class="op"><span class="bx"></span>${E(t)}</span>`;
  function rotuloDe(campo) {
    const l = [...campo.querySelectorAll('label')].find(x => !x.querySelector('input,select,textarea'));
    if (l) return txt(l);
    const sp = campo.querySelector(':scope > span, :scope > b, :scope > p'); return sp ? txt(sp) : '';
  }
  function controle(campo) {
    const radios = [...campo.querySelectorAll('input[type=radio]')];
    const checks = [...campo.querySelectorAll('input[type=checkbox]')];
    const sel = campo.querySelector('select'), area = campo.querySelector('textarea');
    const inp = [...campo.querySelectorAll('input')].filter(i => !['radio', 'checkbox', 'hidden', 'file', 'button', 'submit'].includes(i.type));
    const gps = campo.querySelector('[data-acao$="-gps"], [data-acao="campo-gps"]');
    const arquivo = campo.querySelector('input[type=file], [data-acao*="foto"]');
    let h = '';
    if (radios.length) h += `<div class="ops">${radios.map(r => caixa(txt(r.closest('label')) || r.value)).join('')}</div>`;
    if (checks.length > 1) h += `<div class="ops">${checks.map(c => caixa(txt(c.closest('label')) || c.value)).join('')}</div>`;
    if (sel) h += `<div class="ops">${[...sel.options].filter(o => o.value !== '' && !/^selecione/i.test(o.textContent)).map(o => caixa(txt(o))).join('')}</div>`;
    if (area) h += `<div class="area">${linha()}${linha()}${linha()}</div>`;
    inp.forEach(i => { h += i.type === 'date' ? '<span class="data">____ / ____ / ________</span>' : i.type === 'number' ? linha('curta') : linha(); });
    if (gps) h += '<span class="gps">Latitude: ' + linha('media') + ' Longitude: ' + linha('media') + '</span>';
    if (arquivo && !inp.length && !area && !sel && !radios.length) h += '<span class="nota">(foto tirada no celular)</span>';
    const dica = campo.querySelector('.dica'); if (dica && txt(dica) && !gps && !arquivo) h += `<span class="dica">${E(txt(dica))}</span>`;   // localização/foto: a dica mostra o valor registrado
    return h;
  }
  function tabela(linhas) {
    const tipo = linhas[0].dataset.linha;
    const cols = [...linhas[0].querySelectorAll('input:not([type=hidden]):not([type=checkbox]),select,label')].filter(x => !(x.tagName === 'INPUT' && x.closest('label')))
      .map(x => x.tagName === 'LABEL' ? txt(x) : (x.getAttribute('aria-label') || x.placeholder || x.name));
    const n = LINHAS_TABELA[tipo] || 6;
    return `<table class="grade"><thead><tr>${cols.map(c => `<th>${E(c)}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: n }, () => `<tr>${cols.map(() => '<td></td>').join('')}</tr>`).join('')}</tbody></table>`;
  }
  function converter(no, topo) {
    let h = '';
    const filhos = [...no.children];
    for (let i = 0; i < filhos.length; i++) {
      const el = filhos[i];
      if (el.matches('[data-imp-pular], .acoes, [data-erro], script, template, .kit-proj, .fotos-prev, img, button, input[type=hidden]')) continue;
      if (el.matches('[data-linha]')) {   // linhas repetidas seguidas viram uma tabela
        const grupo = [el]; while (filhos[i + 1] && filhos[i + 1].matches(`[data-linha="${el.dataset.linha}"]`)) grupo.push(filhos[++i]);
        h += tabela(grupo); continue;
      }
      if (el.tagName === 'FIELDSET') { h += `<section><h2>${E(txt(el.querySelector(':scope > legend')))}</h2>${converter(el)}</section>`; continue; }
      if (el.tagName === 'LEGEND') continue;
      if (el.matches('.criterio')) {   // pergunta com opções (Sim/Não, Autorizo…)
        const q = el.querySelector(':scope > span'); const ops = [...el.querySelectorAll('input[type=radio]')];
        h += `<div class="q"><p class="q-t">${E(txt(q))}</p><div class="ops">${ops.map(r => caixa(txt(r.closest('label')) || r.value)).join('')}</div></div>`; continue;
      }
      if (el.matches('label.check, label.mini-chk')) { h += `<div class="q">${caixa(txt(el))}</div>`; continue; }
      if (el.matches('.campo')) {
        const c = controle(el); const r = rotuloDe(el);
        if (c || r) h += `<div class="q${el.matches('.inteiro') ? ' inteiro' : ''}"><p class="q-t">${E(r)}</p>${c}</div>`; continue;
      }
      if (el.matches('.aviso')) { if (txt(el)) h += `<p class="aviso">${E(txt(el))}</p>`; continue; }
      if (/^H[2-4]$/.test(el.tagName)) { h += `<h3>${E(txt(el))}</h3>`; continue; }
      if (el.tagName === 'P' && !el.querySelector('input,select,textarea')) { if (txt(el) && !topo) h += `<p class="obs">${E(txt(el))}</p>`; continue; }   // no topo = instrução da tela
      if (el.matches('input[type=radio], input[type=checkbox]')) continue;
      if (el.children.length) {
        // um bloco com rótulo e controles soltos (sem .campo) vira pergunta; senão, desce nos filhos
        const temControle = el.matches('.sn-par, .chips-sel') || (!el.querySelector('.campo, fieldset, .criterio, [data-linha]') && el.querySelector('input:not([type=hidden]),select,textarea'));
        h += temControle ? `<div class="q"><p class="q-t">${E(rotuloDe(el))}</p>${controle(el)}</div>` : converter(el);
      } else if (txt(el) && el.tagName !== 'LABEL') h += `<p class="obs">${E(txt(el))}</p>`;
    }
    return h;
  }

  /* ---------- página impressa ---------- */
  let simbolo = 'assets/isotipo.svg'; try { simbolo = new URL('assets/isotipo.svg', location.href).href; } catch (e) {}
  try { fetch('assets/isotipo.svg').then(r => r.ok ? r.text() : null).then(t => { if (t) simbolo = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(t))); }).catch(() => {}); } catch (e) {}
  function cabecalho(tipo) {
    const P = MQ.PAPEIS; const eu = Object.assign({}, S().eu, U().porId(S().eu.id) || {});
    const nome = eu.nome_social || eu.nome || '';
    const p = S().painel || {}; const fic = p.ficha && (S().fichas || []).find(f => f.id === p.ficha);
    const vis = (p.visita || p.id) && (S().visitas || []).find(v => v.id === (p.visita || p.id));
    const f2 = fic || (vis && (S().fichas || []).find(f => f.id === vis.ficha_id));
    const quem = [['Aplicador(a)', nome], ['Função', (P[eu.papel] || {}).nome || ''], ['Estado', eu.uf ? U().nomeUF(eu.uf) : 'Projeto todo'],
      ['Celular', eu.telefone || ''], ['E-mail', eu.email || '']];
    const dela = f2 ? [['Mulher', f2.nome], ['Município', f2.municipio], ['Comunidade', f2.comunidade]] : null;
    const dl = l => `<dl>${l.map(([k, v]) => `<div><dt>${k}</dt><dd>${v ? E(v) : linha()}</dd></div>`).join('')}</dl>`;
    return `<header class="topo"><img src="${E(simbolo)}" alt="" width="40" height="57">
        <div><p class="marca">Mulheres &amp; Quintais</p><p class="sub">Quintais Produtivos para Mulheres Rurais · Processo ${E(MQ.PROJETO.processo)}</p></div></header>
      <h1>${E(TIPOS[tipo].titulo)}</h1>
      <div class="dados"><h2>Quem aplica</h2>${dl(quem)}${dela ? `<h2>Quem responde</h2>${dl(dela)}` : ''}</div>
      <p class="instr">Preencha à mão, com letra legível. Depois, lance no sistema assim que tiver internet: a folha não substitui o registro no sistema.</p>`;
  }
  const CSS = `@page { size: A4; margin: 14mm 14mm 16mm; }
    * { box-sizing: border-box; } body { margin: 0; color: #2E1D15; font: 10.5pt/1.45 "Public Sans", Arial, Helvetica, sans-serif; background: #fff; }
    .tela { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 14px; background: #F3EBE1; border-bottom: 1px solid #E2D3C1; position: sticky; top: 0; }
    .tela button { font: 600 11pt "Public Sans", Arial, sans-serif; padding: 9px 16px; border-radius: 999px; border: 1px solid #CDB79D; background: #FFFCF8; color: #2E1D15; cursor: pointer; }
    .tela button.pri { background: #A44934; border-color: #A44934; color: #FFFCF8; }
    main { max-width: 190mm; margin: 0 auto; padding: 12px 14px 24px; }
    .topo { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #452B1A; padding-bottom: 8px; }
    .marca { margin: 0; font: 600 14pt Fraunces, Georgia, "Times New Roman", serif; color: #452B1A; } .sub { margin: 0; font-size: 9pt; color: #634F43; }
    h1 { font: 600 15pt Fraunces, Georgia, "Times New Roman", serif; margin: 12px 0 8px; color: #2E1D15; }
    h2 { font: 700 10.5pt "Public Sans", Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; color: #A44934; margin: 14px 0 6px; border-bottom: 1px solid #E2D3C1; padding-bottom: 3px; }
    h3 { font: 700 10.5pt "Public Sans", Arial, sans-serif; margin: 10px 0 4px; }
    section { break-inside: auto; } h2, h3, .q-t { break-after: avoid; page-break-after: avoid; } .q { break-inside: avoid; margin: 0 0 8px; } .q-t { margin: 0 0 3px; font-weight: 600; }
    .dados dl { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 0; } .dados dl div { display: flex; gap: 6px; align-items: baseline; }
    dt { font-weight: 600; white-space: nowrap; } dd { margin: 0; flex: 1; border-bottom: 1px solid #CDB79D; min-height: 1.3em; }
    .ln { display: block; border-bottom: 1px solid #8A7565; height: 1.5em; } .ln.curta { width: 30mm; display: inline-block; } .ln.media { width: 38mm; display: inline-block; }
    .area .ln { height: 1.7em; } .data { letter-spacing: .08em; } .gps { display: block; margin-top: 3px; }
    .ops { display: flex; flex-wrap: wrap; gap: 4px 16px; } .op { display: inline-flex; gap: 6px; align-items: center; }
    .bx { width: 11px; height: 11px; border: 1.2px solid #2E1D15; display: inline-block; flex: none; }
    .dica, .nota { display: block; font-size: 8.5pt; color: #634F43; } .obs { font-size: 9pt; color: #634F43; margin: 2px 0 8px; }
    .aviso { font-size: 9pt; background: #F1E7DB; padding: 6px 8px; border-radius: 4px; }
    .instr { font-size: 9pt; color: #634F43; margin: 8px 0 0; }
    table.grade { width: 100%; border-collapse: collapse; margin: 4px 0 10px; font-size: 9pt; table-layout: fixed; }
    .grade th, .grade td { border: 1px solid #8A7565; padding: 3px 5px; text-align: left; } .grade td { height: 8mm; } .grade th { background: #F1E7DB; }
    .assina { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; break-inside: avoid; } .assina p { margin: 0; font-size: 9pt; text-align: center; } .assina .ln { height: 2.2em; }
    .rodape { margin-top: 14px; font-size: 8pt; color: #75604F; border-top: 1px solid #E2D3C1; padding-top: 6px; }
    @media print { .tela { display: none; } main { padding: 0; max-width: none; } }`;
  function pagina(tipo, form) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${E(TIPOS[tipo].titulo)} · Mulheres & Quintais</title>
      <style>${CSS}</style></head>
      <body><div class="tela"><button type="button" onclick="window.close()">Fechar</button><button type="button" class="pri" onclick="window.print()">Imprimir ou salvar em PDF</button></div>
      <main>${cabecalho(tipo)}${converter(form, true)}
        <div class="assina"><div>${linha()}<p>Local e data</p></div><div>${linha()}<p>Assinatura de quem aplicou</p></div>
          <div>${linha()}<p>Assinatura ou digital de quem respondeu</p></div><div>${linha()}<p>Lançado no sistema em (data)</p></div></div>
        <p class="rodape">Dados pessoais protegidos pela LGPD (Lei nº 13.709/2018), usados só para o projeto. Guarde a folha em local seguro e não fotografe nem repasse para outras pessoas.</p></main>
      </body></html>`;
  }
  /* abre em outra aba (funciona também no celular) e chama a impressão; sem aba, imprime por um quadro escondido */
  function imprimir(tipo) {
    const form = document.querySelector(`#painel form[data-form="${tipo}"]`); if (!form || !pode(tipo)) return;
    const html = pagina(tipo, form);
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); w.onload = () => { try { w.focus(); w.print(); } catch (e) {} }; return; }
    const f = document.createElement('iframe'); f.style.position = 'fixed'; f.style.width = f.style.height = '0'; f.style.border = '0'; f.setAttribute('aria-hidden', 'true');
    document.body.appendChild(f); f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 400);
  }
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-acao="imp-form"]'); if (b) imprimir(b.dataset.t); });

  MQ.imprimirUI = { barra, pode, pagina, converter, TIPOS };
})();
