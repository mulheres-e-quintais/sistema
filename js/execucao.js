/* Mulheres & Quintais — aba "Execução financeira" (só a coordenação geral), 30/09/2026.
   Previsto: MQ.ORCAMENTO (planilha atualizada de apoio do TED).
   Executado e comprometido:
     - automático: bolsas e ajudas de custo (lançada no Arlo = executado; com aval = comprometido),
       passagens e eventos autorizados (comprometido: quem paga é a FUNCERN);
     - lançado à mão pela coordenação geral: o resto e os repasses do MDA (36_execucao_financeira.sql).
   Nada se apaga: erro vira estorno. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const R = MQ.regras; const E = s => MQ.ui.esc(s);
  const O = () => MQ.ORCAMENTO;
  const brl = v => R.fmtBRL(+v || 0);
  const itens = () => O().rubricas.flatMap(r => r.itens.map(i => Object.assign({ rubrica: r.id }, i)));
  const itemPorId = id => itens().find(i => i.id === id);
  const manuais = () => itens().filter(i => !i.auto);
  const lanc = () => S().lancamentos || [];
  const valorBR = t => { const x = String(t || '').replace(/[^\d,.]/g, ''); if (!x) return null; const n = /,\d{1,2}$/.test(x) ? +x.replace(/\./g, '').replace(',', '.') : +x.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(n) ? n : null; };

  /* ---------- números ---------- */
  function autoItem(i) {
    const a = i.auto; const eq = S().equipe || []; const papelDe = id => (eq.find(m => m.id === id) || {}).papel;
    const val = s => +(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado) || 0;
    if (a.bolsa || a.ajuda) {
      const xs = (S().solic || []).filter(s => a.ajuda ? s.tipo === 'ajuda_custo' : (s.tipo === 'bolsa' && papelDe(s.equipe_id) === a.bolsa));
      return { exec: xs.filter(s => s.situacao === 'lancada').reduce((t, s) => t + val(s), 0), comp: xs.filter(s => s.situacao === 'avalizada').reduce((t, s) => t + val(s), 0) };
    }
    const peds = (S().pedidos || []).filter(p => p.situacao === 'autorizado' && (a.evento ? p.tipo === 'evento' : p.tipo === 'passagem' && (p.dados || {}).finalidade === a.passagem));
    return { exec: 0, comp: peds.reduce((t, p) => t + (+p.valor_autorizado || +(p.dados || {}).valor_estimado || 0), 0) };
  }
  function numeros() {
    const porItem = {};
    itens().forEach(i => {
      const m = lanc().filter(l => l.tipo === 'despesa' && l.item === i.id).reduce((t, l) => t + (+l.valor || 0), 0);
      const a = i.auto ? autoItem(i) : { exec: 0, comp: 0 };
      const exec = a.exec + m, comp = a.comp;
      porItem[i.id] = { exec, comp, saldo: i.total - exec - comp, passou: exec + comp > i.total + 0.005 };
    });
    const soma = (xs, k) => xs.reduce((t, i) => t + porItem[i.id][k], 0);
    const rub = O().rubricas.map(r => ({ r, previsto: r.itens.reduce((t, i) => t + i.total, 0), exec: soma(r.itens, 'exec'), comp: soma(r.itens, 'comp') }));
    const exec = soma(itens(), 'exec'), comp = soma(itens(), 'comp');
    const recebido = lanc().filter(l => l.tipo === 'repasse').reduce((t, l) => t + (+l.valor || 0), 0);
    const V = MQ.PROJETO.vigencia; const dia = d => new Date(d + 'T12:00:00').getTime();
    const tempo = Math.max(0, Math.min(1, (dia(R.hoje()) - dia(V.inicio)) / (dia(V.fim) - dia(V.inicio))));
    // ajuda de custo: média paga por visita comparada com o previsto (R$ 225)
    const vis = S().solicVis || {}; const lancadas = new Set((S().solic || []).filter(s => s.tipo === 'ajuda_custo' && s.situacao === 'lancada').map(s => s.id));
    const nVis = Object.values(vis).filter(id => lancadas.has(id)).length;
    return { porItem, rub, exec, comp, recebido, tempo, livre: O().total - exec - comp, caixa: recebido - exec, ajudaMedia: nVis ? porItem.ajuda_visitas.exec / nVis : null, nVis };
  }

  /* ---------- gráficos (SVG/HTML próprios: funcionam sem internet) ---------- */
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const somaMes = (ym, n) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const rotMes = ym => MES[+ym.slice(5) - 1] + '/' + ym.slice(2, 4);
  function serie() {
    const C = O().cronograma; const meses = C.meses.map((_, i) => somaMes(C.inicio, i));
    const tot = C.meses.reduce((a, b) => a + b, 0); let ac = 0;
    const previsto = C.meses.map(v => (ac += v) / tot * O().total);
    const hoje = R.hoje().slice(0, 7); const idxHoje = meses.indexOf(hoje);
    const gastoMes = {}; const add = (ym, v) => { gastoMes[ym] = (gastoMes[ym] || 0) + v; };
    lanc().filter(l => l.tipo === 'despesa').forEach(l => add(String(l.data).slice(0, 7), +l.valor || 0));
    (S().solic || []).filter(x => x.situacao === 'lancada').forEach(x => add(String(x.arlo_em || x.mes).slice(0, 7), +(x.valor_avalizado != null ? x.valor_avalizado : x.valor_solicitado) || 0));
    const recMes = {}; lanc().filter(l => l.tipo === 'repasse').forEach(l => { const ym = String(l.data).slice(0, 7); recMes[ym] = (recMes[ym] || 0) + (+l.valor || 0); });
    const antes = (obj, ym) => Object.entries(obj).filter(([k]) => k < meses[0]).reduce((t, [, v]) => t + v, 0);   // o que veio antes de set/2026 entra no primeiro mês
    let e = antes(gastoMes), r = antes(recMes);
    const executado = [], recebido = [];
    meses.forEach((ym, i) => { e += gastoMes[ym] || 0; r += recMes[ym] || 0; const futuro = idxHoje >= 0 ? i > idxHoje : ym > hoje; executado.push(futuro ? null : e); recebido.push(futuro ? null : r); });
    return { meses, previsto, executado, recebido, idxHoje };
  }
  function graficoRitmo(sr) {
    const W = 720, H = 250, ml = 58, mr = 14, mt = 14, mb = 34, T = O().total;
    const x = i => ml + i * (W - ml - mr) / (sr.meses.length - 1), y = v => mt + (1 - v / T) * (H - mt - mb);
    const linha = (vs, passo) => { let d = ''; vs.forEach((v, i) => { if (v == null) return; const p = `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      if (!d) d = 'M' + p; else d += passo ? `H${x(i).toFixed(1)}V${y(v).toFixed(1)}` : 'L' + p; }); return d; };
    const grade = [0, .25, .5, .75, 1].map(f => `<line x1="${ml}" x2="${W - mr}" y1="${y(T * f)}" y2="${y(T * f)}" class="eg-grade"/><text x="${ml - 8}" y="${y(T * f) + 4}" class="eg-eixo" text-anchor="end">${f ? 'R$ ' + (T * f / 1e6).toLocaleString('pt-BR') + ' mi' : '0'}</text>`).join('');
    const rot = sr.meses.map((ym, i) => i % 2 === 0 || i === sr.meses.length - 1 ? `<text x="${x(i)}" y="${H - 12}" class="eg-eixo" text-anchor="middle">${rotMes(ym)}</text>` : '').join('');
    const hoje = sr.idxHoje >= 0 ? `<line x1="${x(sr.idxHoje)}" x2="${x(sr.idxHoje)}" y1="${mt}" y2="${H - mb}" class="eg-hoje"/><text x="${x(sr.idxHoje) + 4}" y="${mt + 10}" class="eg-eixo">hoje</text>` : '';
    const ult = (vs) => { for (let i = vs.length - 1; i >= 0; i--) if (vs[i] != null) return i; return -1; };
    const pontos = (vs, cls) => { const i = ult(vs); return i < 0 ? '' : `<circle cx="${x(i)}" cy="${y(vs[i])}" r="4" class="${cls}"/>`; };
    const alvos = sr.meses.map((_, i) => `<rect x="${x(i) - (W - ml - mr) / (sr.meses.length - 1) / 2}" y="${mt}" width="${(W - ml - mr) / (sr.meses.length - 1)}" height="${H - mt - mb}" class="eg-alvo" data-exg="${i}" tabindex="0" role="button" aria-label="${rotMes(sr.meses[i])}: previsto ${brl(sr.previsto[i])}${sr.executado[i] == null ? '' : ', executado ' + brl(sr.executado[i]) + ', recebido ' + brl(sr.recebido[i])}"/>`).join('');
    return `<figure class="exec-graf" data-exec-ritmo><figcaption><b>Ritmo do gasto</b> <span class="small muted">acumulado mês a mês</span></figcaption>
      <ul class="eg-leg small"><li><i class="eg-q prev"></i>Previsto (plano de desembolso)</li><li><i class="eg-q exe"></i>Executado</li><li><i class="eg-q rec"></i>Recebido do MDA</li></ul>
      <div class="eg-caixa"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Ritmo do gasto: previsto, executado e recebido acumulados por mês">${grade}${rot}${hoje}
        <path d="${linha(sr.previsto)}" class="eg-prev"/><path d="${linha(sr.recebido, true)}" class="eg-rec"/><path d="${linha(sr.executado)}" class="eg-exe"/>
        ${pontos(sr.recebido, 'eg-pt rec')}${pontos(sr.executado, 'eg-pt exe')}<line class="eg-cruz" x1="0" x2="0" y1="${mt}" y2="${H - mb}" hidden/>${alvos}</svg>
        <div class="exec-dica" role="status" hidden></div></div>
      <p class="small muted">Passe o mouse ou toque num mês. O previsto usa o ritmo do plano de desembolso (que soma R$ 1.970.308,00), ajustado ao total de R$ 2 milhões.</p></figure>`;
  }
  function graficoRubricas(n) {
    const tempo = n.tempo * 100;
    return `<figure class="exec-graf" data-exec-rub><figcaption><b>Uso de cada rubrica</b> <span class="small muted">% do previsto · clique para ver os itens</span></figcaption>
      <ul class="eg-leg small"><li><i class="eg-q exe"></i>Executado</li><li><i class="eg-q comp"></i>Comprometido</li><li><i class="eg-q tempo"></i>Tempo decorrido (${pctBR(Math.round(tempo * 10) / 10)}%)</li></ul>
      <div class="eg-barras">${n.rub.map(({ r, previsto, exec, comp }) => { const pe = Math.min(100, exec / previsto * 100), pc = Math.min(100 - pe, comp / previsto * 100); const tot = (exec + comp) / previsto * 100;
        return `<button type="button" class="eg-bar${tot > 100.05 ? ' passou' : ''}" data-acao="exec-rub" data-id="${r.id}" data-dica="${E(r.nome)}|${brl(previsto)}|${brl(exec)}|${brl(comp)}|${brl(previsto - exec - comp)}">
          <span class="eg-nome">${E(r.nome)}</span>
          <span class="eg-trilho"><i class="exe" style="width:${pe}%"></i><i class="comp" style="left:${pe}%;width:${pc}%"></i><i class="tempo" style="left:${Math.min(100, tempo)}%"></i></span>
          <span class="eg-pct num">${pctBR(Math.round(tot * 10) / 10)}%</span></button>`; }).join('')}</div>
      <div class="exec-dica" role="status" hidden></div></figure>`;
  }
  /* dica flutuante: mês do gráfico de ritmo e barra de rubrica */
  function dica(el, alvo, html) {
    const fig = alvo.closest('.exec-graf'); const d = fig && fig.querySelector('.exec-dica'); if (!d) return;
    if (!html) { d.hidden = true; const c = fig.querySelector('.eg-cruz'); if (c) c.setAttribute('hidden', ''); return; }
    d.innerHTML = html; d.hidden = false;
    const fr = fig.getBoundingClientRect(), ar = alvo.getBoundingClientRect();
    const left = Math.max(4, Math.min(fr.width - d.offsetWidth - 4, ar.left - fr.left + ar.width / 2 - d.offsetWidth / 2));
    d.style.left = left + 'px'; d.style.top = Math.max(0, ar.top - fr.top - d.offsetHeight - 8) + 'px';
  }
  function mostrarDica(alvo) {
    if (alvo.dataset.exg != null) {
      const sr = serie(); const i = +alvo.dataset.exg; const v = a => a[i] == null ? '—' : brl(a[i]);
      const c = alvo.closest('svg').querySelector('.eg-cruz'); const xx = +alvo.getAttribute('x') + +alvo.getAttribute('width') / 2; c.setAttribute('x1', xx); c.setAttribute('x2', xx); c.removeAttribute('hidden');
      dica(null, alvo, `<b>${rotMes(sr.meses[i])}</b><span><i class="eg-q prev"></i>Previsto ${brl(sr.previsto[i])}</span><span><i class="eg-q exe"></i>Executado ${v(sr.executado)}</span><span><i class="eg-q rec"></i>Recebido ${v(sr.recebido)}</span>`
        + (sr.executado[i] != null ? `<span class="muted">${sr.executado[i] < sr.previsto[i] ? 'Abaixo' : 'Acima'} do previsto em ${brl(Math.abs(sr.previsto[i] - sr.executado[i]))}</span>` : ''));
    } else if (alvo.dataset.dica) {
      const [nome, prev, exe, comp, saldo] = alvo.dataset.dica.split('|');
      dica(null, alvo, `<b>${nome}</b><span>Previsto ${prev}</span><span><i class="eg-q exe"></i>Executado ${exe}</span><span><i class="eg-q comp"></i>Comprometido ${comp}</span><span>Saldo <b>${saldo}</b></span>`);
    }
  }
  if (typeof document !== 'undefined') {
    const alvoDe = ev => ev.target && ev.target.closest && ev.target.closest('.exec-graf [data-exg], .exec-graf [data-dica]');
    ['mouseover', 'focusin'].forEach(t => document.addEventListener(t, ev => { const a = alvoDe(ev); if (a) mostrarDica(a); }));
    ['mouseout', 'focusout'].forEach(t => document.addEventListener(t, ev => { const a = alvoDe(ev); if (a && !(ev.relatedTarget && a.contains(ev.relatedTarget))) dica(null, a, ''); }));
  }

  /* ---------- tela ---------- */
  const pct = (v, t) => t ? Math.round(v / t * 1000) / 10 : 0;
  const pctBR = x => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const med = (exec, comp, total) => `<span class="medidor exec-med" title="executado e comprometido"><i style="width:${Math.min(100, (exec + comp) / total * 100)}%;opacity:.35"></i><i style="width:${Math.min(100, exec / total * 100)}%"></i></span>`;
  function alertas(n) {
    const a = [];
    itens().forEach(i => { const x = n.porItem[i.id]; if (x.passou) a.push(`<b>${E(i.nome)}</b>: executado + comprometido (${brl(x.exec + x.comp)}) passa do previsto (${brl(i.total)}).`); });
    if (n.ajudaMedia != null && n.ajudaMedia > (itemPorId('ajuda_visitas').unitario || 225) * 1.05)
      a.push(`Ajuda de custo: a média paga é <b>${brl(n.ajudaMedia)} por visita</b> (${n.nVis} visitas), acima dos ${brl(itemPorId('ajuda_visitas').unitario)} previstos. Nesse ritmo, as 800 visitas não cabem na rubrica.`);
    if (n.caixa < -0.005) a.push(`O executado (${brl(n.exec)}) passa do que foi lançado como recebido (${brl(n.recebido)}). Falta lançar um repasse, ou há despesa lançada a mais.`);
    return a;
  }
  function aba() {
    if (S().execSemBanco) return `<div class="cab"><div><span class="eyebrow">Execução financeira</span><h1>Execução do orçamento</h1></div></div>
      <div class="aviso">A execução financeira ainda não está instalada no servidor. Rode o arquivo <b>36_execucao_financeira.sql</b> no Supabase.</div>`;
    const n = numeros(); const T = O().total; const al = alertas(n);
    const usoPct = pct(n.exec + n.comp, T), tempoPct = Math.round(n.tempo * 1000) / 10;
    const ritmo = usoPct + 10 < tempoPct ? 'abaixo do tempo decorrido: o projeto está gastando devagar' : usoPct > tempoPct + 15 ? 'acima do tempo decorrido: atenção ao ritmo' : 'no ritmo do tempo decorrido';
    let acum = 0; const prox = O().repasses.find(r => { acum += r.valor; return acum > n.recebido + 0.005; });   // o próximo repasse que ainda não entrou
    const linhaItem = i => { const x = n.porItem[i.id];
      return `<tr${x.passou ? ' class="passou"' : ''}><th scope="row"><span>${E(i.nome)}</span><span class="small muted">${E(i.calc)} · ${i.auto ? 'automático' : 'lançado à mão'}</span></th>
        <td class="num">${brl(i.total)}</td><td class="num">${brl(x.exec)}</td><td class="num muted">${brl(x.comp)}</td><td class="num"><b>${brl(x.saldo)}</b></td><td>${med(x.exec, x.comp, i.total)}</td></tr>`; };
    return `<div class="cab"><div><span class="eyebrow">Execução financeira</span><h1>Execução do orçamento</h1>
        <p>Previsto × executado de cada rubrica do TED (R$ ${(T / 1e6).toLocaleString('pt-BR')} milhões). Bolsas e ajudas de custo lançadas no Arlo, passagens e eventos autorizados entram sozinhos; o resto e os repasses do MDA você lança. Só você vê esta aba.</p>
        <p class="small muted">Base: ${E(O().fonte)}. Confira se o remanejamento em relação ao plano pactuado foi aprovado pelo MDA.</p></div></div>
      <div class="viag-botoes"><button type="button" class="cad-modo" data-acao="exec-novo"><b>Lançar despesa ou repasse</b><span>Implantação dos quintais, diárias, locação, combustível, equipamento, taxa da FUNCERN, bolsas pagas fora do sistema, repasses do MDA.</span></button></div>
      <div class="resumo exec-resumo">
        <div><span class="v num">${brl(n.exec)}</span><span class="l">executado · ${pctBR(pct(n.exec, T))}%</span></div>
        <div><span class="v num">${brl(n.comp)}</span><span class="l">comprometido (autorizado ou com aval, ainda não pago)</span></div>
        <div><span class="v num">${brl(n.livre)}</span><span class="l">livre para executar</span></div>
        <div><span class="v num">${brl(n.recebido)}<small> de ${brl(T)}</small></span><span class="l">recebido do MDA${prox ? ` · próximo repasse: ${brl(prox.valor)}, previsto para ${prox.mes.slice(5)}/${prox.mes.slice(0, 4)}${prox.mes < R.hoje().slice(0, 7) ? ' (atrasado ou ainda não lançado aqui)' : ''}` : ''}</span></div>
      </div>
      <div class="bloco exec-ritmo"><div class="vg-lin"><span>Uso do orçamento (executado + comprometido)</span><b class="num">${pctBR(usoPct)}%</b></div>${med(n.exec, n.comp, T)}
        <div class="vg-lin small"><span class="muted">Tempo de vigência decorrido: ${pctBR(tempoPct)}% (${R.fmtData(MQ.PROJETO.vigencia.inicio)} a ${R.fmtData(MQ.PROJETO.vigencia.fim)})</span><span>${ritmo}</span></div>
        <p class="small muted" style="margin:6px 0 0">Em caixa na FUNCERN (recebido − executado): <b>${brl(n.caixa)}</b></p></div>
      <div class="exec-grafs">${graficoRitmo(serie())}${graficoRubricas(n)}</div>
      ${al.length ? `<div class="aviso erro"><ul class="exec-alertas">${al.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      <section class="secao" aria-labelledby="t-exr"><div class="secao-cab"><h2 id="t-exr">Por rubrica</h2></div>
        <div class="quadro-scroll"><table class="quadro exec-tab"><thead><tr><th scope="col">Rubrica e item</th><th scope="col">Previsto</th><th scope="col">Executado</th><th scope="col">Comprometido</th><th scope="col">Saldo</th><th scope="col"><span class="sr">Uso</span></th></tr></thead>
          ${n.rub.map(({ r, previsto, exec, comp }) => `<tbody id="exr-${r.id}"><tr class="rub"><th scope="rowgroup">${E(r.nome)}</th><td class="num">${brl(previsto)}</td><td class="num">${brl(exec)}</td><td class="num muted">${brl(comp)}</td><td class="num"><b>${brl(previsto - exec - comp)}</b></td><td>${med(exec, comp, previsto)}</td></tr>
            ${r.itens.map(linhaItem).join('')}</tbody>`).join('')}
          <tfoot><tr class="tot"><th scope="row">Total</th><td class="num">${brl(T)}</td><td class="num">${brl(n.exec)}</td><td class="num muted">${brl(n.comp)}</td><td class="num"><b>${brl(n.livre)}</b></td><td>${med(n.exec, n.comp, T)}</td></tr></tfoot>
        </table></div></section>
      <section class="secao" aria-labelledby="t-exl"><div class="secao-cab"><h2 id="t-exl">Lançamentos <span class="conta-t${lanc().length ? '' : ' zero'}">${lanc().length}</span></h2></div>
        ${lanc().length ? `<div class="pag-lista">${lanc().map(linhaLanc).join('')}</div>` : '<p class="muted">Nenhum lançamento ainda. Comece pelo repasse do MDA (nota de crédito) e pelas despesas que a FUNCERN já pagou.</p>'}</section>`;
  }
  function linhaLanc(l) {
    const it = l.tipo === 'repasse' ? { nome: 'Repasse do MDA' } : (itemPorId(l.item) || { nome: l.item });
    const estornado = lanc().some(x => x.estorno_de === l.id);
    return `<div class="exec-lanc${l.estorno_de ? ' estorno' : ''}${estornado ? ' estornado' : ''}">
      <span class="nm">${E(it.nome)}</span><b class="num">${brl(l.valor)}</b>
      <span class="small muted">${R.fmtData(l.data)}${l.documento ? ' · ' + E(l.documento) : ''}${l.estorno_de ? ' · estorno' : ''}${estornado ? ' · estornado' : ''}</span>
      ${l.descricao ? `<span class="small">${E(l.descricao)}</span>` : ''}
      ${!l.estorno_de && !estornado ? `<button type="button" class="link small" data-acao="exec-estornar" data-id="${E(l.id)}">Estornar</button>` : ''}</div>`;
  }

  /* ---------- formulários ---------- */
  function validar(d) {
    const e = {};
    if (!['despesa', 'repasse'].includes(d.tipo)) e.tipo = 'Escolha despesa ou repasse.';
    if (d.tipo === 'despesa' && !manuais().some(i => i.id === d.item)) e.item = 'Escolha o item do orçamento.';
    if (d.tipo === 'repasse' && d.item !== 'repasse_mda') e.item = 'Repasse vai no item "Repasse do MDA".';
    if (!(+d.valor > 0)) e.valor = 'Informe o valor (R$).'; else if (+d.valor > O().total) e.valor = 'Valor maior que o projeto inteiro.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data || '')) e.data = 'Informe a data.'; else if (d.data > R.hoje()) e.data = 'A data não pode ser no futuro.';
    if (d.documento && d.documento.length > 120) e.documento = 'Até 120 letras.';
    if (d.descricao && d.descricao.length > 500) e.descricao = 'Até 500 letras.';
    return e;
  }
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function painel(p) {
    if (p.tipo === 'exec-novo') {
      const opts = O().rubricas.map(r => { const m = r.itens.filter(i => !i.auto); return m.length ? `<optgroup label="${E(r.nome)}">${m.map(i => `<option value="${i.id}">${E(i.nome)}</option>`).join('')}</optgroup>` : ''; }).join('');
      return cab('Execução financeira', 'Lançar despesa ou repasse') + `<div class="painel-corpo"><form class="f" data-form="exec-lancar" novalidate>
        <fieldset class="campo inteiro"><legend>O que é</legend><div class="sn-par">
          <label class="sn"><input type="radio" name="tipo" value="despesa" checked> Despesa paga</label>
          <label class="sn"><input type="radio" name="tipo" value="repasse"> Repasse do MDA</label></div></fieldset>
        <div class="campos">
          <div class="campo inteiro" data-so="despesa"><label for="ex-item">Item do orçamento</label><select id="ex-item" name="item"><option value="">Selecione…</option>${opts}</select>
            <span class="dica">Bolsas, ajudas de custo, passagens e eventos não aparecem aqui: entram sozinhos pelo sistema.</span></div>
          <div class="campo"><label for="ex-valor">Valor (R$)</label><input id="ex-valor" name="valor" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
          <div class="campo"><label for="ex-data">Data do pagamento ou do repasse</label><input id="ex-data" name="data" type="date" max="${R.hoje()}" value="${R.hoje()}"></div>
          <div class="campo inteiro"><label for="ex-doc">Documento <span class="muted">(opcional)</span></label><input id="ex-doc" name="documento" maxlength="120" placeholder="Ex.: NF 1234, ordem bancária, 2026NC000014"></div>
          <div class="campo inteiro"><label for="ex-desc">Descrição <span class="muted">(opcional)</span></label><textarea id="ex-desc" name="descricao" maxlength="500"></textarea></div>
        </div>
        <p class="small muted">Lançamento não se altera nem se apaga. Se errar, use "Estornar" na lista: fica registrado.</p>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Lançar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
      </form></div>`;
    }
    if (p.tipo === 'exec-estornar') {
      const l = lanc().find(x => x.id === p.id); if (!l) return cab('Execução financeira', 'Lançamento não encontrado');
      const it = l.tipo === 'repasse' ? { nome: 'Repasse do MDA' } : (itemPorId(l.item) || { nome: l.item });
      return cab('Execução financeira', 'Estornar lançamento') + `<div class="painel-corpo">
        <dl class="dl"><dt>Item</dt><dd>${E(it.nome)}</dd><dt>Valor</dt><dd class="num">${brl(l.valor)}</dd><dt>Data</dt><dd>${R.fmtData(l.data)}</dd>${l.documento ? `<dt>Documento</dt><dd>${E(l.documento)}</dd>` : ''}</dl>
        <form class="f" data-form="exec-estornar" data-id="${E(l.id)}" novalidate><div class="campos">
          <div class="campo inteiro"><label for="ex-mot">Motivo do estorno</label><textarea id="ex-mot" name="motivo" maxlength="500" placeholder="Ex.: nota fiscal lançada em duplicidade"></textarea></div></div>
          <p class="small muted">O estorno lança o mesmo valor com sinal trocado. O lançamento original continua na lista, marcado como estornado.</p>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn pri" type="submit">Estornar ${brl(l.valor)}</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
    }
    return '';
  }
  async function clique(a, el) {
    if (a === 'exec-novo') U().abrirPainel({ tipo: 'exec-novo' });
    else if (a === 'exec-estornar') U().abrirPainel({ tipo: 'exec-estornar', id: el.dataset.id });
    else if (a === 'exec-rub') { const tb = document.getElementById('exr-' + el.dataset.id); if (tb) { tb.scrollIntoView({ behavior: 'smooth', block: 'start' }); tb.classList.remove('realce'); void tb.offsetWidth; tb.classList.add('realce'); } }
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'exec-lancar') {
      const t = String(fd.get('tipo') || 'despesa');
      const d = { tipo: t, item: t === 'repasse' ? 'repasse_mda' : String(fd.get('item') || ''), valor: valorBR(fd.get('valor')), data: String(fd.get('data') || ''),
        documento: String(fd.get('documento') || '').trim() || null, descricao: String(fd.get('descricao') || '').trim() || null };
      const e = validar(d); if (Object.keys(e).length) return U().mostrarErros(form, e);
      await U().ocupado(form, async () => { await S().api.lancarExecucao(d); await U().carregar(); U().fecharPainel(); U().render(); U().toast(t === 'repasse' ? 'Repasse lançado.' : 'Despesa lançada.'); });
    }
    if (tipo === 'exec-estornar') {
      const m = String(fd.get('motivo') || '').trim();
      if (m.length < 10) return U().mostrarErros(form, { motivo: 'Escreva o motivo (pelo menos 10 letras).' });
      await U().ocupado(form, async () => { await S().api.estornarLancamento(form.dataset.id, m); await U().carregar(); U().fecharPainel(); U().render(); U().toast('Lançamento estornado.'); });
    }
  }
  MQ.execUI = { aba, painel, clique, enviar, validar, numeros, valorBR, serie };
})();
