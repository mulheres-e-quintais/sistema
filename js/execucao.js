/* Mulheres & Quintais — aba "Execução" (só a coordenação geral), 30/09/2026.
   Previsto: MQ.ORCAMENTO (planilha atualizada de apoio do TED).
   Executado: a PLANILHA DE GASTOS mais recente que a coordenação geral envia (pelo menos uma vez por mês).
     Ela é o retrato completo desde o início e traz tudo (bolsas, ajudas de custo, passagens, eventos…);
     a mais nova substitui as anteriores, que ficam no histórico (37_execucao_planilhas.sql).
   Comprometido: o que o sistema sabe e ainda não entrou na planilha — bolsa ou ajuda de custo com aval,
     ou lançada no Arlo depois da data da planilha; passagem e evento autorizados depois dessa data.
   Não há lançamento à mão. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const R = MQ.regras; const E = s => MQ.ui.esc(s);
  const O = () => MQ.ORCAMENTO;
  const brl = v => R.fmtBRL(+v || 0);
  const lim = v => Math.max(0, Math.min(100, +v || 0));   // largura de barra: sempre entre 0 e 100% (estorno maior que o gasto dava largura negativa)
  const foraDoPeriodo = d => { const V = MQ.PROJETO.vigencia, x = String(d || '').slice(0, 10); return !!x && (x < V.inicio || x > V.fim); };
  const itens = () => O().rubricas.flatMap(r => r.itens.map(i => Object.assign({ rubrica: r.id }, i)));
  // vale a última ENVIADA ("a mais nova passa a valer"), mesmo que corrija uma data anterior
  const planilhas = () => (S().execPlanilhas || []).slice().sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em)) || String(b.posicao_em).localeCompare(String(a.posicao_em)));
  const vigente = () => planilhas().find(p => !p.descartada_em) || null;   // 72: a descartada não vale; vale a última enviada que não foi descartada
  const pessoa = id => { const m = (S().equipe || []).find(x => x.id === id); return m ? (m.nome_social || m.nome) : 'a coordenação geral'; };
  const G = {};   // prévia da planilha escolhida (antes de confirmar o envio)

  /* ---------- números ---------- */
  /* auditoria 22/10: a planilha de solicitações da FUNCERN já traz a bolsa ou a ajuda de custo que foi lançada no Arlo (como
     comprometida ou paga). Para não contar duas vezes, o pedido do sistema que já aparece nela (mesmo item, mesmo valor e,
     quando a planilha diz, o nome da pessoa) não entra de novo no comprometido. */
  const nrm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function jaNaPlanilha(sol, itemId, linhas, usadas) {
    const eq = S().equipe || []; const m = eq.find(x => x.id === sol.equipe_id) || {}; const t = nrm(m.nome).split(' ').filter(Boolean);
    const nomes = [nrm(m.nome), nrm(m.nome_social), t.length > 1 ? t[0] + ' ' + t[t.length - 1] : ''].filter(Boolean);
    const v = +(sol.valor_avalizado != null ? sol.valor_avalizado : sol.valor_solicitado) || 0;
    const k = linhas.findIndex((l, j) => !usadas.has(j) && l.item === itemId && Math.abs((+l.valor || 0) - v) < 0.01 && (!l.favorecido || nomes.some(n => (' ' + nrm(l.favorecido) + ' ').includes(' ' + n + ' '))));
    if (k < 0) return false; usadas.add(k); return true;
  }
  function comprometidoItem(i, desde, linhasPl) {   // o que o sistema sabe e a planilha (até "desde") ainda não trouxe
    const a = i.auto; if (!a) return 0;
    const eq = S().equipe || []; const papelDe = id => (eq.find(m => m.id === id) || {}).papel;
    const sol = (linhasPl || []).some(l => l.situacao) ? linhasPl : null, usadas = new Set();   // só a planilha de solicitações traz pedido por pedido
    const val = s => +(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado) || 0;
    const depois = d => !desde || (d && R.diaLocal(d) > desde);   // data de Brasília (o banco grava em UTC)
    if (a.bolsa || a.ajuda) {
      const doItem = (S().solic || []).filter(s => a.ajuda ? s.tipo === 'ajuda_custo' : (s.tipo === 'bolsa' && papelDe(s.equipe_id) === a.bolsa));
      // com a planilha de solicitações: liga cada pedido do sistema já lançado a uma linha dela, do mês mais antigo para o mais novo
      // (a bolsa de setembro não "pega" a linha que é da de outubro); o que ficou ligado já está na planilha
      const naPl = new Set();
      if (sol) doItem.filter(s => ['avalizada', 'lancada'].includes(s.situacao)).sort((x, y) => String(x.mes || x.solicitada_em || '').localeCompare(String(y.mes || y.solicitada_em || '')))
        .forEach(s => { if (jaNaPlanilha(s, i.id, sol, usadas)) naPl.add(s.id); });
      return doItem.filter(s => (s.situacao === 'avalizada' || (s.situacao === 'lancada' && depois(s.arlo_em))) && !naPl.has(s.id)).reduce((t, s) => t + val(s), 0);
    }
    return (S().pedidos || []).filter(p => p.situacao === 'autorizado' && depois(p.decidido_em) && (a.evento ? p.tipo === 'evento' : p.tipo === 'passagem' && ((p.dados || {}).finalidade === 'pedagogico' ? 'pedagogico' : 'intercambio') === a.passagem))   // passagem antiga, sem finalidade, conta no intercâmbio (46)
      .reduce((t, p) => t + (+p.valor_autorizado || +(p.dados || {}).valor_estimado || 0), 0);
  }
  function numeros() {
    const pl = vigente(); const desde = pl ? String(pl.posicao_em).slice(0, 10) : null;
    // 22/10/2026: linha da planilha de solicitações da FUNCERN ainda não paga conta como COMPROMETIDO (não como pago), como no Saberes que Cultivam
    const todas = pl ? pl.linhas : [], linhas = todas.filter(l => l.situacao !== 'comprometido'), pend = todas.filter(l => l.situacao === 'comprometido' && l.item !== 'repasse_mda');
    const somaL = f => Math.round(linhas.filter(f).reduce((t, l) => t + (+l.valor || 0), 0) * 100) / 100;
    const somaP = f => Math.round(pend.filter(f).reduce((t, l) => t + (+l.valor || 0), 0) * 100) / 100;
    const porItem = {};
    itens().forEach(i => { const exec = somaL(l => l.item === i.id), compF = somaP(l => l.item === i.id), comp = Math.round((comprometidoItem(i, desde, todas) + compF) * 100) / 100;
      porItem[i.id] = { exec, comp, compF, saldo: i.total - exec - comp, passou: exec + comp > i.total + 0.005 }; });
    const soma = (xs, k) => xs.reduce((t, i) => t + porItem[i.id][k], 0);
    // item antigo ou desconhecido (não está mais no orçamento) com rubrica: entra em "sem item" da rubrica, para a soma das rubricas fechar com o total
    const conhecido = new Set(itens().map(i => i.id)); const rubDe = new Set(O().rubricas.map(r => r.id));
    const semItemDe = l => l.item !== 'repasse_mda' && !conhecido.has(l.item);
    const rub = O().rubricas.map(r => { const semItem = somaL(l => l.rubrica === r.id && semItemDe(l)), semItemC = somaP(l => l.rubrica === r.id && semItemDe(l));
      return { r, previsto: r.itens.reduce((t, i) => t + i.total, 0), exec: soma(r.itens, 'exec') + semItem, comp: soma(r.itens, 'comp') + semItemC, semItem, semItemC }; });
    const naoClass = somaL(l => semItemDe(l) && !rubDe.has(l.rubrica)), naoClassC = somaP(l => semItemDe(l) && !rubDe.has(l.rubrica));
    const exec = somaL(l => l.item !== 'repasse_mda'), comp = Math.round((soma(itens(), 'comp') + rub.reduce((t, x) => t + x.semItemC, 0) + naoClassC) * 100) / 100;
    // recebido: o repasse que a planilha traz; a de solicitações da FUNCERN não traz repasse: vale o cronograma de desembolso até este mês
    const recPl = somaL(l => l.item === 'repasse_mda'), hojeYM = R.hoje().slice(0, 7);
    const recebidoEstimado = !recPl; const recebido = recPl || O().repasses.filter(r => r.mes <= hojeYM).reduce((t, r) => t + r.valor, 0);
    const V = MQ.PROJETO.vigencia; const dia = d => new Date(d + 'T12:00:00').getTime();
    const tempo = Math.max(0, Math.min(1, (dia(R.hoje()) - dia(V.inicio)) / (dia(V.fim) - dia(V.inicio))));
    const idade = pl ? R.diasAte(R.hoje()) - R.diasAte(desde) : null;
    return { pl, porItem, rub, exec, comp, recebido, recebidoEstimado, naoClass, naoClassC, tempo, idade, livre: O().total - exec - comp, caixa: recebido - exec, disponivel: recebido - exec - comp, despesas: todas.filter(l => l.item !== 'repasse_mda') };
  }

  /* ---------- por meta do plano de trabalho (14/10/2026) ----------
     O previsto de cada meta é a soma dos itens do orçamento ligados a ela (MQ.ORCAMENTO, campo meta), para o pago, o comprometido e o
     saldo fecharem com as rubricas. Item dividido entre metas (ajuda de custo das visitas): previsto, executado e comprometido entram na
     mesma proporção, porque a planilha de gastos não diz a etapa de cada visita. */
  const partes = i => !i.meta ? { _comum: 1 } : typeof i.meta === 'string' ? { [i.meta]: 1 } : i.meta;
  function porMeta(n) {
    const grupos = MQ.METAS.map(m => ({ id: m.id, nome: m.nome, plano: m.valor || 0, itens: [] })).concat([{ id: '_comum', nome: 'Comum a todas as metas', itens: [] }]);
    const G = Object.fromEntries(grupos.map(g => [g.id, g]));
    itens().forEach(i => { const x = n.porItem[i.id]; Object.entries(partes(i)).forEach(([k, f]) => { if (G[k]) G[k].itens.push({ i, f, previsto: i.total * f, exec: x.exec * f, comp: x.comp * f }); }); });
    // o que a planilha trouxe sem item conhecido (só a rubrica, ou fora do orçamento) não tem meta: entra no comum, para o total fechar
    const semItem = n.rub.reduce((t, x) => t + x.semItem, 0) + n.naoClass, semItemC = n.rub.reduce((t, x) => t + (x.semItemC || 0), 0) + (n.naoClassC || 0);
    if (semItem || semItemC) G._comum.itens.push({ i: { id: '_sem', nome: 'Gastos sem item definido na planilha' }, f: 1, previsto: 0, exec: semItem, comp: semItemC });
    grupos.forEach(g => ['previsto', 'exec', 'comp'].forEach(k => { g[k] = Math.round(g.itens.reduce((t, y) => t + y[k], 0) * 100) / 100; }));
    return grupos.filter(g => g.itens.length);
  }
  const metaAbertas = new Set();
  function secaoMetas(n) {
    const gs = porMeta(n);
    const fr = f => f === 1 ? '' : ` <span class="fin-parte">${Math.round(f * 100)}% do item</span>`;
    return `<section class="secao" aria-labelledby="t-exm"><div class="secao-cab"><div><h2 id="t-exm">Por meta do plano de trabalho</h2><p>O mesmo gasto, visto pelas metas do plano pactuado com o MDA. Toque na meta para ver os itens do orçamento ligados a ela.</p></div>
        <button type="button" class="btn peq" data-acao="exec-abrir-metas">${metaAbertas.size ? 'Fechar todas' : 'Abrir todas'}</button></div>
      <div class="fin-wrap"><table class="fin exec-fin exec-meta"><thead><tr><th scope="col">Meta</th><th scope="col">Previsto</th><th scope="col">Pago</th><th scope="col">Comprometido</th><th scope="col">Saldo</th><th scope="col">Execução</th></tr></thead>
        ${gs.map(g => { const ab = metaAbertas.has(g.id); const nIt = g.itens.length; const dif = g.plano && Math.abs(g.plano - g.previsto) >= 1;
          return `<tbody id="exm-${g.id}" class="fin-rubrica${ab ? ' aberta' : ''}"><tr class="fin-grupo"><th scope="rowgroup"><button type="button" class="fin-rub" data-acao="exec-abrir-meta" data-id="${g.id}" aria-expanded="${ab}">
              <span class="fin-rub-n">${g.id === '_comum' ? '' : `<span class="fin-meta-id">${g.id}</span> `}${E(g.nome)}</span><small>${nIt} ${nIt === 1 ? 'item' : 'itens'}</small>${dif ? `<span class="fin-plano">no plano de trabalho: ${brl(g.plano)}</span>` : ''}</button></th>
            <td class="num" data-rot="Previsto">${g.previsto ? brl(g.previsto) : zero}</td><td class="num" data-rot="Pago">${vExec(g.exec)}</td><td class="num" data-rot="Comprometido">${vComp(g.comp)}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(g.previsto - g.exec - g.comp)}</b></td><td data-rot="Execução">${celExec(g.exec, g.previsto)}</td></tr>
            ${g.itens.map(y => `<tr class="fin-item"><th scope="row"><span class="fin-nome sem">${E(y.i.nome)}${fr(y.f)}</span></th><td class="num" data-rot="Previsto">${y.previsto ? brl(y.previsto) : zero}</td><td class="num" data-rot="Pago">${vExec(y.exec)}</td><td class="num" data-rot="Comprometido">${vComp(y.comp)}</td><td class="num fin-saldo" data-rot="Saldo">${y.previsto ? brl(y.previsto - y.exec - y.comp) : zero}</td><td data-rot="Execução">${y.previsto ? celExec(y.exec, y.previsto) : ''}</td></tr>`).join('')}</tbody>`; }).join('')}
        <tfoot><tr class="fin-tot"><th scope="row">Total do projeto</th><td class="num" data-rot="Previsto"><b>${brl(O().total)}</b></td><td class="num" data-rot="Pago">${vExec(n.exec)}</td><td class="num" data-rot="Comprometido">${vComp(n.comp)}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(n.livre)}</b></td><td data-rot="Execução">${celExec(n.exec, O().total)}</td></tr></tfoot>
      </table></div>
      <p class="small muted fin-nota-meta">Bolsas entram na Meta 1 (equipe e coordenação). A ajuda de custo das visitas é dividida pelas 800 visitas do orçamento: 25% diagnósticos (M2), 25% implantação (M3) e 50% acompanhamento (M4). Quando o valor do plano de trabalho é diferente da soma dos itens, a meta mostra “no plano”.</p></section>`;
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
    const pl = vigente(); const mesPl = pl ? String(pl.posicao_em).slice(0, 7) : hoje; const recMes = {};
    (pl ? pl.linhas : []).filter(l => l.situacao !== 'comprometido').forEach(l => { const ym = l.data ? String(l.data).slice(0, 7) : mesPl;
      if (l.item === 'repasse_mda') recMes[ym] = (recMes[ym] || 0) + (+l.valor || 0); else add(ym, +l.valor || 0); });
    if (!Object.keys(recMes).length) O().repasses.forEach(r => { recMes[r.mes] = (recMes[r.mes] || 0) + r.valor; });   // planilha sem repasse (a de solicitações da FUNCERN): o cronograma
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
      <ul class="eg-leg small"><li><i class="eg-q prev"></i>Previsto (plano de desembolso)</li><li><i class="eg-q exe"></i>Pago</li><li><i class="eg-q rec"></i>Recebido do MDA</li></ul>
      <div class="eg-caixa"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Ritmo do gasto: previsto, pago e recebido acumulados por mês">${grade}${rot}${hoje}
        <path d="${linha(sr.previsto)}" class="eg-prev"/><path d="${linha(sr.recebido, true)}" class="eg-rec"/><path d="${linha(sr.executado)}" class="eg-exe"/>
        ${pontos(sr.recebido, 'eg-pt rec')}${pontos(sr.executado, 'eg-pt exe')}<line class="eg-cruz" x1="0" x2="0" y1="${mt}" y2="${H - mb}" hidden/>${alvos}</svg>
        <div class="exec-dica" role="status" hidden></div></div>
      <p class="small muted">Passe o mouse ou toque num mês. O previsto usa o ritmo do plano de desembolso (que soma R$ 1.970.308,00), ajustado ao total de R$ 2 milhões.</p>
      <details class="eg-tab-d"><summary>Ver os números em tabela</summary><div class="fin-wrap"><table class="quadro eg-tab"><thead><tr><th scope="col">Mês</th><th scope="col" class="num">Previsto</th><th scope="col" class="num">Pago</th><th scope="col" class="num">Recebido</th></tr></thead>
        <tbody>${sr.meses.map((ym, i) => `<tr${i === sr.idxHoje ? ' class="eg-tab-hoje"' : ''}><th scope="row">${rotMes(ym)}${i === sr.idxHoje ? ' <span class="small muted">(mês atual)</span>' : ''}</th><td class="num">${brl(sr.previsto[i])}</td><td class="num">${sr.executado[i] == null ? '—' : brl(sr.executado[i])}</td><td class="num">${sr.recebido[i] == null ? '—' : brl(sr.recebido[i])}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
  }
  function graficoRubricas(n) {
    const tempo = n.tempo * 100;
    return `<figure class="exec-graf" data-exec-rub><figcaption><b>Uso de cada rubrica</b> <span class="small muted">% do previsto · clique para ver os itens</span></figcaption>
      <ul class="eg-leg small"><li><i class="eg-q exe"></i>Pago</li><li><i class="eg-q comp"></i>Comprometido</li><li><i class="eg-q tempo"></i>Tempo decorrido (${pctBR(Math.round(tempo * 10) / 10)}%)</li></ul>
      <div class="eg-barras">${n.rub.map(({ r, previsto, exec, comp }) => { const pe = lim(exec / previsto * 100), pc = Math.min(100 - pe, lim(comp / previsto * 100)); const tot = (exec + comp) / previsto * 100;
        return `<button type="button" class="eg-bar${tot > 100.05 ? ' passou' : ''}" data-acao="exec-rub" data-id="${r.id}" data-dica="${E(r.nome)}|${brl(previsto)}|${brl(exec)}|${brl(comp)}|${brl(previsto - exec - comp)}">
          <span class="eg-nome">${E(r.nome)}</span>
          <span class="eg-trilho"><i class="exe" style="width:${pe}%"></i><i class="comp" style="left:${pe}%;width:${pc}%"></i><i class="tempo" style="left:${lim(tempo)}%"></i></span>
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
      dica(null, alvo, `<b>${rotMes(sr.meses[i])}</b><span><i class="eg-q prev"></i>Previsto ${brl(sr.previsto[i])}</span><span><i class="eg-q exe"></i>Pago ${v(sr.executado)}</span><span><i class="eg-q rec"></i>Recebido ${v(sr.recebido)}</span>`
        + (sr.executado[i] != null ? `<span class="muted">${sr.executado[i] < sr.previsto[i] ? 'Abaixo' : 'Acima'} do previsto em ${brl(Math.abs(sr.previsto[i] - sr.executado[i]))}</span>` : ''));
    } else if (alvo.dataset.dica) {
      const [nome, prev, exe, comp, saldo] = alvo.dataset.dica.split('|');
      dica(null, alvo, `<b>${nome}</b><span>Previsto ${prev}</span><span><i class="eg-q exe"></i>Pago ${exe}</span><span><i class="eg-q comp"></i>Comprometido ${comp}</span><span>Saldo <b>${saldo}</b></span>`);
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
  /* composição do item em linguagem de gente (sem "1 × 14 × R$"): fica só no detalhe, não na tabela */
  const UNID = { diarias: ['diária', 'diárias'], locacao_veiculo: ['diária de veículo', 'diárias de veículo'], passagem_intercambio: ['passagem', 'passagens'], passagem_pedagogico: ['passagem', 'passagens'],
    eventos: ['evento', 'eventos'], quintais: ['quintal', 'quintais'], ajuda_apoio: ['ajuda de custo', 'ajudas de custo'], equipamento: ['unidade', 'unidades'] };
  function composicao(i) {
    const c = String(i.calc || ''); let m;
    if ((m = /^(\d+) × (\d+) meses × (R\$ [\d.,]+)$/.exec(c))) return +m[1] === 1 ? `${m[2]} meses · ${m[3]}/mês` : `${m[1]} pessoas · ${m[2]} meses · ${m[3]}/mês cada`;
    if ((m = /^(\d+) visitas × (R\$ [\d.,]+) \((\d+) \+ (\d+) \+ (\d+)\)$/.exec(c))) return `${m[1]} visitas · ${m[2]} cada (${m[3]} diagnósticos, ${m[4]} implantações e ${m[5]} acompanhamentos)`;
    if ((m = /^(\d+) × (R\$ [\d.,]+)$/.exec(c))) { const u = UNID[i.id] || ['unidade', 'unidades']; return `${m[1]} ${+m[1] === 1 ? u[0] : u[1]} · ${m[2]} cada`; }
    if (c === 'verba') return 'Verba (valor global, sem quantidade)';
    if (/^10% do projeto$/.test(c)) return '10% do valor do projeto';
    return c;
  }
  const celExec = (exec, total) => { const p = pct(exec, total); return `<span class="fin-exe"><span class="medidor fino" aria-hidden="true"><i class="${exec > 0 ? 'st-ok' : ''}" style="width:${lim(p)}%"></i></span><b class="num">${pctBR(p)}%</b></span>`; };
  // zero aparece como travessão (com o valor por extenso para o leitor de tela): a tabela fica limpa enquanto não há gasto
  const zero = '<span class="fin-zero" aria-hidden="true">—</span><span class="so-leitor">R$ 0,00</span>';
  const vExec = v => v > 0 ? `<span class="fin-exec">${brl(v)}</span>` : zero;
  const vComp = v => v > 0 ? `<span class="fin-comp">${brl(v)}</span>` : zero;
  const rubAbertas = new Set();   // rubricas abertas na tabela (começam fechadas; ficam como a pessoa deixou enquanto a página está aberta)
  /* 22/10/2026 (como no Saberes que Cultivam): cartão do resumo, detalhe do item e lista de despesas */
  function finKpi(tom, pc, grande, de, rot, sub, fim) {
    const p = Math.max(0, Math.min(100, +pc || 0)), C = 2 * Math.PI * 18;
    return `<div class="eq-kpi dx-kpi fin-k fk-${tom}"><div class="dx-kpi-topo"><span class="dx-anel" aria-hidden="true"><svg viewBox="0 0 44 44" width="52" height="52" focusable="false"><circle cx="22" cy="22" r="18" class="tr"/><circle cx="22" cy="22" r="18" class="pg${p > 0 ? '' : ' vazio'}" stroke-dasharray="${(C * p / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle" class="dx-anel-t">${Math.round(p)}%</text></svg></span>
      <span class="eq-n num"><b>${grande}</b><small> ${de}</small></span></div><span class="eq-l">${rot}</span>
      <span class="medidor fino" aria-hidden="true"><i style="width:${p}%"></i></span><span class="dx-kpi-p"><b class="num">${pctBR(Math.round(p))}%</b> ${fim}</span><span class="dx-kpi-s">${sub}</span></div>`;
  }
  function detalheGasto(comp, prev, pago, compr, saldo, nDesp) {
    const p = v => prev > 0 ? Math.max(0, Math.min(100, v / prev * 100)) : 0, pP = p(pago), pC = Math.min(100 - pP, p(compr));
    return `<div class="rbx"><p class="rbx-top"><span><b>Previsto: ${brl(prev)}</b> · ${E(comp)}</span><span>${nDesp ? `${nDesp} ${nDesp === 1 ? 'despesa' : 'despesas'} neste item` : 'nenhuma despesa neste item'}</span></p>
      <span class="rbx-bar" role="img" aria-label="Pago ${brl(pago)}, comprometido ${brl(compr)}, saldo ${brl(saldo)} de ${brl(prev)} previstos"><i class="pg" style="width:${pP}%"></i><i class="cp" style="width:${pC}%"></i></span>
      <ul class="rbx-l"><li><span class="rbx-s pg" aria-hidden="true"></span><span>Pago<b class="num">${brl(pago)}</b></span></li><li><span class="rbx-s cp" aria-hidden="true"></span><span>Comprometido<b class="num">${brl(compr)}</b></span></li><li><span class="rbx-s sd" aria-hidden="true"></span><span>Saldo<b class="num${saldo < 0 ? ' neg' : ''}">${brl(saldo)}</b></span></li></ul>
      <p class="rbx-nota">Comprometido: solicitação ainda não paga na FUNCERN, ou o que o sistema já sabe e a planilha ainda não trouxe. Saldo: o que sobra para gastar (previsto − pago − comprometido).</p></div>`;
  }
  const sitChip = l => l.situacao === 'comprometido' ? `<span class="chip pend">${E(l.status || 'Comprometido')}</span>` : `<span class="chip ok">${E(l.status && !/^pago$/i.test(l.status) ? l.status : 'Pago')}</span>`;
  const ordemData = (a, b) => String(b.data || '').localeCompare(String(a.data || '')) || (a.linha || 0) - (b.linha || 0);
  const metaDe = id => { const i = itens().find(x => x.id === id); if (!i) return '—'; if (!i.meta) return '<span class="muted">Comum</span>';
    return typeof i.meta === 'string' ? i.meta : Object.keys(i.meta).join('/'); };
  function tabelaDespesas(lista, comRubrica) {
    const nomeRub = id => (O().rubricas.find(r => r.id === id) || {}).nome || 'Fora do orçamento';
    const nomeItem = id => { const i = itens().find(x => x.id === id); return i ? i.nome : ''; };
    return `<div class="fin-wrap"><table class="quadro desp-tab"><thead><tr><th scope="col">Data</th><th scope="col">Meta</th><th scope="col">Descrição</th><th scope="col">Situação</th><th scope="col" class="num">Valor</th></tr></thead>
      <tbody>${lista.slice().sort(ordemData).map(l => `<tr><td data-rot="Data" class="num">${l.data ? R.fmtData(l.data) : '—'}</td><td data-rot="Meta" class="desp-meta">${metaDe(l.item)}</td>
        <td data-rot="Descrição"><span class="desp-d">${E(l.descricao || l.texto || 'Despesa')}</span><span class="desp-s">${[comRubrica ? nomeRub(l.rubrica) : '', l.item ? nomeItem(l.item) : (comRubrica ? '' : 'sem item definido'), l.favorecido, l.documento].filter(Boolean).map(E).join(' · ')}</span></td>
        <td data-rot="Situação">${sitChip(l)}</td><td data-rot="Valor" class="num"><b>${brl(l.valor)}</b></td></tr>`).join('')}</tbody></table></div>`;
  }
  /* estresse 22/10: com milhares de despesas, a página montava a lista de cada rubrica (escondida) e a lista inteira a cada clique
     (3,8 MB de HTML e ~1 s por desenho). Agora a lista só é montada quando a rubrica ou "Ver as outras" é aberta (como no Cultivos). */
  let ultimoN = null;
  function encherRub(tb) {
    const ph = tb && tb.querySelector(':scope > tr.fin-desp[data-tarde]'); if (!ph || !ultimoN) return;
    const h = linhaDespesasRub(ph.dataset.tarde, ultimoN, true); if (!h) { ph.remove(); return; }
    ph.insertAdjacentHTML('afterend', h); ph.remove();
  }
  function linhaDespesasRub(rid, n, agora) {
    const ds = n.despesas.filter(l => l.rubrica === rid); if (!ds.length) return '';
    if (!agora && !rubAbertas.has(rid)) return `<tr class="fin-desp" data-tarde="${E(rid)}" hidden></tr>`;
    return `<tr class="fin-desp"><td colspan="6"><h3 class="fin-desp-t">Despesas desta rubrica <span class="small muted">(${ds.length}, da planilha vigente)</span></h3>${tabelaDespesas(ds, false)}</td></tr>`;
  }
  /* 22/10/2026: como "Despesas do projeto" do Saberes que Cultivam, no fim da aba, com o único botão de envio (sem lançamento à mão) */
  function secaoDespesas(n) {
    const ds = n.despesas; const LIM = 40, mais = ds.length > LIM; const ord = ds.slice().sort(ordemData);
    return `<section class="secao exec-desp" id="exec-desp" aria-labelledby="t-exd"><div class="secao-cab desp-cab"><div><h2 id="t-exd">Despesas do projeto${ds.length ? ` <span class="conta-t">${ds.length}</span>` : ''}</h2>
        <p>Vêm da planilha de solicitações da FUNCERN: envie a planilha atualizada e o sistema mostra o que mudou antes de gravar. Enquanto não estiver paga, a despesa conta como comprometida; cancelada não entra.</p></div></div>
      <div class="desp-acoes">${MQ.botaoAcao({ acao: 'exec-enviar', icone: 'enviar', texto: 'Importar planilha da FUNCERN', curto: 'Importar planilha' })}</div>
      ${ds.length ? tabelaDespesas(ord.slice(0, LIM), true) + (mais ? `<details class="desp-mais"><summary>Ver as outras ${ds.length - LIM} despesas</summary><div data-desp-tarde></div></details>` : '')
        : '<p class="vazio-pl">Nenhuma despesa ainda. Toque em “Importar planilha da FUNCERN”.</p>'}</section>`;
  }
  function alertas(n) {
    const a = [];
    // 23/10/2026: sem planilha, nenhum aviso aqui (Despesas do projeto, no fim, já diz "Nenhuma despesa ainda" e traz o botão)
    if (n.pl && n.idade > 35) a.push(`A planilha vigente é de <b>${R.fmtData(n.pl.posicao_em)}</b> (${n.idade} dias atrás). Envie a planilha deste mês.`);
    if (n.pl && foraDoPeriodo(n.pl.posicao_em)) a.push(`A planilha vigente é de <b>${R.fmtData(n.pl.posicao_em)}</b>, fora do período do projeto (${R.fmtData(MQ.PROJETO.vigencia.inicio)} a ${R.fmtData(MQ.PROJETO.vigencia.fim)}). Confira a data e, se estiver errada, envie a planilha de novo.`);
    itens().forEach(i => { const x = n.porItem[i.id]; if (x.passou) a.push(`<b>${E(i.nome)}</b>: pago + comprometido (${brl(x.exec + x.comp)}) passa do previsto (${brl(i.total)}).`); });
    if (n.naoClass) a.push(`${brl(n.naoClass)} em linhas que não batem com nenhum item do orçamento (entram no total pago, fora das rubricas). Veja em <b>Planilhas enviadas</b>.`);
    if (n.disponivel < -0.005) a.push(`Pago e comprometido (${brl(n.exec + n.comp)}) passam do recebido do MDA (${brl(n.recebido)}${n.recebidoEstimado ? ', pelo cronograma de desembolso' : ''}). Confira os repasses antes de novas despesas.`);
    return a;
  }
  function aba() {
    if (S().execSemBanco) return `<div class="cab"><div><span class="eyebrow">Financeiro</span><h1>Execução do orçamento</h1></div></div>
      <div class="aviso">A execução ainda não está instalada no servidor. Rode o arquivo <b>37_execucao_planilhas.sql</b> no Supabase.</div>`;
    const n = numeros(); ultimoN = n; const T = O().total; const al = alertas(n);
    const usoPct = pct(n.exec + n.comp, T), tempoPct = Math.round(n.tempo * 1000) / 10;
    const ritmo = usoPct + 10 < tempoPct ? 'abaixo do tempo decorrido: o projeto está gastando devagar' : usoPct > tempoPct + 15 ? 'acima do tempo decorrido: atenção ao ritmo' : 'no ritmo do tempo decorrido';
    let acum = 0; const prox = O().repasses.find(r => { acum += r.valor; return acum > n.recebido + 0.005; });   // o próximo repasse que ainda não entrou
    const linhaItem = i => { const x = n.porItem[i.id];
      return `<tr class="fin-item${x.passou ? ' passou' : ''}"><th scope="row"><button type="button" class="fin-nome" data-acao="exec-comp" data-id="${E(i.id)}" aria-expanded="false" aria-controls="exc-${E(i.id)}">${E(i.nome)}</button></th>
        <td class="num" data-rot="Previsto">${brl(i.total)}</td><td class="num" data-rot="Pago">${vExec(x.exec)}</td><td class="num" data-rot="Comprometido">${vComp(x.comp)}</td><td class="num fin-saldo" data-rot="Saldo">${brl(x.saldo)}</td><td data-rot="Execução">${celExec(x.exec, i.total)}</td></tr>
        <tr class="fin-detalhe" id="exc-${E(i.id)}" hidden><td colspan="6">${detalheGasto(composicao(i), i.total, x.exec, x.comp, x.saldo, n.despesas.filter(l => l.item === i.id).length)}</td></tr>`; };
    const semItem = x => x.semItem || x.semItemC ? `<tr class="fin-item"><th scope="row"><span class="fin-nome sem">Sem item definido na planilha</span><span class="small muted">a planilha disse só a rubrica ou um item que não está no orçamento</span></th><td class="num" data-rot="Previsto">—</td><td class="num" data-rot="Pago">${vExec(x.semItem)}</td><td class="num" data-rot="Comprometido">${vComp(x.semItemC)}</td><td class="num" data-rot="Saldo">—</td><td></td></tr>` : '';
    const mil = v => (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) % 1000 ? 1 : 0 });
    const nPago = n.despesas.filter(l => l.situacao !== 'comprometido').length, nComp = n.despesas.filter(l => l.situacao === 'comprometido').length;
    const acima = n.exec + n.comp > n.recebido + 0.005, recPct = pct(n.recebido, T);
    return `<div class="cab"><div><span class="eyebrow">Recursos do TED</span><h1>Acompanhamento financeiro</h1>
        <p>Valores previstos no plano de trabalho, comparados com a planilha de solicitações da FUNCERN. O registro oficial continua sendo o da FUNCERN; confira os dois antes de cada prestação de contas. Só você vê esta aba.</p></div></div>
      ${/* 22/10/2026: a mesma tela do Financeiro do Saberes que Cultivam (resumo recebido · pago · comprometido · disponível) */ ''}
      ${n.pl ? `<p class="small muted">Planilha vigente: <b>${E(n.pl.arquivo_nome)}</b>, gastos até ${R.fmtData(n.pl.posicao_em)} (enviada em ${R.fmtData(n.pl.enviado_em)}). O envio da próxima fica no fim da página.</p>` : ''}
      <section class="fin-resumo dx-topo fin-topo" aria-label="Resumo financeiro">
        <div class="dx-exec"><span class="dx-rot">Execução financeira do projeto</span>
          <div class="dx-exec-num"><b class="num">${pctBR(usoPct)}%</b></div>
          <div><span class="chip ${acima ? 'crit' : 'ok'}">${acima ? 'Acima do que já foi recebido' : 'Dentro do que já foi recebido'}</span></div>
          <div class="fin-barra fin-barra-rec" role="img" aria-label="Pago ${pctBR(pct(n.exec, T))}%, comprometido ${pctBR(pct(n.comp, T))}% do total; recebido ${pctBR(recPct)}%"><i class="e" style="width:${lim(pct(n.exec, T))}%"></i><i class="c" style="width:${Math.min(100 - lim(pct(n.exec, T)), lim(pct(n.comp, T)))}%"></i><b class="fin-rec-traco" style="left:${lim(recPct)}%"></b></div>
          <p class="fin-sub fin-sub-2"><span>Pago ou comprometido: <b>${brl(n.exec + n.comp)}</b></span><span>Total do TED: <b>${brl(T)}</b></span></p>
          <details class="dx-como"><summary>Como é calculado</summary><p class="small">Soma do pago e do comprometido, dividida pelo valor total do TED. <b>Pago</b>: solicitação paga na planilha da FUNCERN. <b>Comprometido</b>: solicitação ainda não paga (em pagamento, em compras, pendente) e o que o sistema já sabe e a planilha ainda não trouxe (bolsa ou ajuda de custo com aval ou lançada no Arlo depois da data da planilha; passagem e evento autorizados depois dessa data). Cancelada não entra. O traço na barra marca quanto já foi repassado à fundação (${pctBR(recPct)}%). Tempo de vigência decorrido: ${pctBR(tempoPct)}%: ${ritmo}.</p></details>
        </div>
        <div class="dx-kpis fin-kpis">
          ${finKpi('rec', recPct, mil(n.recebido), 'de ' + mil(T) + ' mil', 'recebido', (n.recebidoEstimado ? 'pelo cronograma de desembolso' : 'pela planilha') + (prox ? ` · próxima parcela de ${brl(prox.valor)} prevista para ${prox.mes.slice(5)}/${prox.mes.slice(0, 4)}` : ' · todas as parcelas recebidas'), 'do total')}
          ${finKpi('pago', pct(n.exec, n.recebido), mil(n.exec), 'de ' + mil(n.recebido) + ' mil', 'pago', `${nPago} ${nPago === 1 ? 'despesa paga' : 'despesas pagas'}`, 'do recebido')}
          ${finKpi('comp', pct(n.comp, n.recebido), mil(n.comp), 'de ' + mil(n.recebido) + ' mil', 'comprometido', `${nComp} ${nComp === 1 ? 'solicitação' : 'solicitações'} ainda não ${nComp === 1 ? 'paga' : 'pagas'}, mais o que o sistema já sabe`, 'do recebido')}
          ${finKpi('disp', pct(n.disponivel, n.recebido), mil(n.disponivel), 'de ' + mil(n.recebido) + ' mil', 'disponível do recebido', n.disponivel < 0 ? 'pago e comprometido passam do que já foi recebido' : 'recebido menos pago e comprometido', 'do recebido')}
        </div>
      </section>
      <div class="exec-grafs">${graficoRitmo(serie())}${graficoRubricas(n)}</div>
      ${al.length ? `<div class="aviso erro"><ul class="exec-alertas">${al.map(x => `<li>${x}</li>`).join('')}</ul>${/* 22/10/2026: um lugar só para enviar (em Planilhas enviadas, no fim): o aviso só leva até lá */ n.pl && n.idade > 35 ? '<p class="exec-alerta-acao"><a href="#exec-desp" class="link">Ir para Despesas do projeto, onde se importa a planilha ↓</a></p>' : ''}</div>` : ''}
      <section class="secao" aria-labelledby="t-exr"><div class="secao-cab"><div><h2 id="t-exr">Por rubrica</h2><p>Toque na rubrica para ver os itens; toque no item para ver a composição do valor.</p></div>
          <button type="button" class="btn peq" data-acao="exec-abrir-tudo">${rubAbertas.size ? 'Fechar todas' : 'Abrir todas'}</button></div>
        <div class="fin-wrap"><table class="fin exec-fin"><thead><tr><th scope="col">Rubrica</th><th scope="col">Previsto</th><th scope="col">Pago</th><th scope="col">Comprometido</th><th scope="col">Saldo</th><th scope="col">Execução</th></tr></thead>
          ${n.rub.map(x => { const { r, previsto, exec, comp } = x; const nIt = r.itens.length + (x.semItem || x.semItemC ? 1 : 0); const ab = rubAbertas.has(r.id);
            return `<tbody id="exr-${r.id}" class="fin-rubrica${ab ? ' aberta' : ''}"><tr class="fin-grupo"><th scope="rowgroup"><button type="button" class="fin-rub" data-acao="exec-abrir" data-id="${E(r.id)}" aria-expanded="${ab}"><span class="fin-rub-n">${E(r.nome)}</span><small>${nIt} ${nIt === 1 ? 'item' : 'itens'}</small></button></th><td class="num" data-rot="Previsto">${brl(previsto)}</td><td class="num" data-rot="Pago">${vExec(exec)}</td><td class="num" data-rot="Comprometido">${vComp(comp)}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(previsto - exec - comp)}</b></td><td data-rot="Execução">${celExec(exec, previsto)}</td></tr>
            ${r.itens.map(linhaItem).join('')}${semItem(x)}${linhaDespesasRub(r.id, n)}</tbody>`; }).join('')}
          ${n.naoClass || n.naoClassC ? `<tbody><tr class="fin-grupo"><th scope="rowgroup">Fora do orçamento (não classificado)</th><td class="num" data-rot="Previsto">—</td><td class="num" data-rot="Pago">${vExec(n.naoClass)}</td><td class="num" data-rot="Comprometido">${vComp(n.naoClassC)}</td><td class="num" data-rot="Saldo">—</td><td></td></tr></tbody>` : ''}
          <tfoot><tr class="fin-tot"><th scope="row">Total do projeto</th><td class="num" data-rot="Previsto"><b>${brl(T)}</b></td><td class="num" data-rot="Pago">${vExec(n.exec)}</td><td class="num" data-rot="Comprometido">${vComp(n.comp)}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(n.livre)}</b></td><td data-rot="Execução">${celExec(n.exec, T)}</td></tr></tfoot>
        </table></div></section>
      ${secaoMetas(n)}
      <section class="secao exec-planilhas" aria-labelledby="t-exl"><div class="secao-cab"><div><h2 id="t-exl">Planilhas enviadas <span class="conta-t${planilhas().filter(p => !p.descartada_em).length ? '' : ' zero'}">${planilhas().filter(p => !p.descartada_em).length}</span></h2>
          <p>Pelo menos uma vez por mês, importe a planilha de solicitações da FUNCERN (botão em <b>Despesas do projeto</b>, logo abaixo). Ela é o retrato completo desde o início: a mais nova substitui as anteriores, que ficam guardadas aqui. O sistema mostra a prévia antes de gravar.</p>
          <p class="small muted">Base do previsto: ${E(O().fonte)}, com o remanejamento aprovado pelo MDA.</p></div>
          </div>
        ${planilhas().length ? listaPlanilhas() : '<p class="vazio-pl">Nenhuma planilha enviada ainda. Use “Importar planilha da FUNCERN”, logo abaixo.</p>'}</section>
      ${secaoDespesas(n)}`;
  }
  /* 22/10/2026: cada planilha é um cartão (ícone, nome, situação, valor, botões com ícone); a vigente tem a faixa verde;
     as descartadas ficam recolhidas no fim, com o motivo, sem entrar na conta */
  const IC = k => `<span class="pl-bt-ic" aria-hidden="true">${(MQ.ICONES || {})[k] || ''}</span>`;
  const semPonto = t => String(t || '').trim().replace(/[.\s]+$/, '');
  function linhaPlanilha(pl, vale) {
    const nao = (pl.linhas || []).filter(l => l.item !== 'repasse_mda' && !l.rubrica);
    const desc = !!pl.descartada_em; const n = (pl.linhas || []).length;
    const meta = [`gastos até <b>${R.fmtData(pl.posicao_em)}</b>`, `enviada em ${R.fmtData(pl.enviado_em)}`, `${n} linha${n === 1 ? '' : 's'}`]
      .concat(+pl.total_recebido > 0 ? [`recebido ${brl(pl.total_recebido)}`] : []).join(' · ');
    const sit = desc ? '<span class="chip crit">descartada</span>' : vale ? '<span class="chip ok">vigente</span>' : '<span class="chip">substituída</span>';
    return `<article class="pl-cartao${vale ? ' vigente' : ''}${desc ? ' descartada' : ''}" data-planilha="${E(pl.id)}">
      <span class="pl-ic" aria-hidden="true">${(MQ.ICONES || {}).relatorio || ''}</span>
      <div class="pl-corpo">
        <div class="pl-topo"><h3 class="pl-nome">${E(pl.arquivo_nome)}</h3>${sit}</div>
        <p class="pl-meta">${meta}</p>
        ${pl.obs ? `<p class="pl-obs">${E(pl.obs)}</p>` : ''}
        ${desc ? `<p class="pl-motivo"><b>Motivo do descarte:</b> ${E(semPonto(pl.motivo_descarte))}. <span>Descartada em ${R.fmtData(pl.descartada_em)} por ${E(pessoa(pl.descartada_por))}. Não entra em nenhuma conta e o arquivo foi apagado.</span></p>`
          : nao.length ? `<details class="pl-fora"><summary>${nao.length} linha${nao.length > 1 ? 's' : ''} fora do orçamento</summary><ul>${nao.slice(0, 30).map(l => `<li>Linha ${l.linha}: “${E(l.texto)}” · ${brl(l.valor)}${l.descricao ? ' · ' + E(l.descricao) : ''}</li>`).join('')}</ul></details>` : ''}
        ${desc ? '' : `<div class="pl-acoes"><button type="button" class="pl-bt" data-acao="exec-baixar" data-path="${E(pl.arquivo_path)}">${IC('baixar')}Baixar o arquivo</button>
          <button type="button" class="pl-bt perigo" data-acao="exec-descartar" data-id="${E(pl.id)}">${IC('lixeira')}Descartar (enviada por engano)</button></div>`}
      </div>
      <div class="pl-valor"><b class="num">${brl(pl.total_gasto)}</b><span>${desc ? 'não conta' : 'total de gastos'}</span></div>
    </article>`;
  }
  function listaPlanilhas() {
    const val = planilhas().filter(p => !p.descartada_em), desc = planilhas().filter(p => p.descartada_em);
    return `${val.length ? `<div class="pl-lista">${val.map(pl => linhaPlanilha(pl, pl === vigente())).join('')}</div>` : '<p class="vazio-pl">Nenhuma planilha valendo. Use “Importar planilha da FUNCERN”, no fim da página.</p>'}
      ${desc.length ? `<details class="pl-descartadas"><summary>Descartadas <span class="conta-t">${desc.length}</span><span class="pl-desc-dica">enviadas por engano, fora das contas</span></summary>
        <div class="pl-lista">${desc.map(pl => linhaPlanilha(pl, false)).join('')}</div></details>` : ''}`;
  }

  /* ---------- enviar planilha: escolher o arquivo, ver a prévia, confirmar ---------- */
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function previaHTML(pr) {
    const s = pr.resumo; const porRub = {};
    pr.linhas.filter(l => l.item !== 'repasse_mda').forEach(l => { const k = l.rubrica || '_'; porRub[k] = (porRub[k] || 0) + l.valor; });   // pago + comprometido, por rubrica
    const nomeR = id => id === '_' ? 'Fora do orçamento (não classificado)' : (O().rubricas.find(r => r.id === id) || {}).nome;
    const ant = vigente();
    return `<div class="bloco"><h3>Prévia: ${E(pr.nome)}</h3>
      <p class="small muted">Aba lida: ${E(pr.aba)} · ${pr.linhas.length} linhas com valor${pr.ignoradas ? ` · ${pr.ignoradas === 1 ? '1 linha de total ou sem valor ignorada' : pr.ignoradas + ' linhas de total ou sem valor ignoradas'}` : ''}</p>
      ${pr.formato === 'solicitacoes' ? `<div class="pv-status"><h4>Situação na FUNCERN</h4><p class="small muted">Planilha de solicitações: cada solicitação vale pela situação. Confira como cada status entra na conta (a escolha fica guardada para as próximas planilhas).</p>
        <table class="quadro"><thead><tr><th scope="col">Status</th><th scope="col" class="num">Solicitações</th><th scope="col" class="num">Valor</th><th scope="col">Entra como</th></tr></thead><tbody>${(pr.status || []).map(x => `<tr><th scope="row">${E(x.txt)}</th><td class="num">${x.n}</td><td class="num">${brl(x.total)}</td>
          <td><select data-exec-status="${E(x.txt)}" aria-label="Como “${E(x.txt)}” entra na conta">${[['pago', 'Pago'], ['comprometido', 'Comprometido'], ['ignorar', 'Não entra']].map(([v, t]) => `<option value="${v}"${x.destino === v ? ' selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}
      <ul class="pp"><li><span>Pago</span><b class="num">${brl(s.gasto)}</b></li>${s.comprometido ? `<li><span>Comprometido (ainda não pago)</span><b class="num">${brl(s.comprometido)}</b></li>` : ''}<li><span>Recebido do MDA</span><b class="num">${pr.formato === 'solicitacoes' && !s.recebido ? '<small class="muted">a planilha de solicitações não traz; vale o cronograma</small>' : brl(s.recebido)}</b></li>
        ${ant ? `<li><span>Planilha vigente hoje</span><b class="num">${brl(ant.total_gasto)}<small class="muted"> até ${R.fmtData(ant.posicao_em)}</small></b></li>` : ''}</ul>
      ${ant && s.gasto + (s.comprometido || 0) + 0.005 < +ant.total_gasto ? '<div class="aviso erro">O total desta planilha (pago e comprometido) é <b>menor</b> que o da planilha vigente. Como cada planilha é o retrato completo desde o início, confira se não faltam gastos antigos.</div>' : ''}
      ${ant && s.ultimaData && s.ultimaData < String(ant.posicao_em).slice(0, 10) ? `<div class="aviso">Os gastos desta planilha vão até ${R.fmtData(s.ultimaData)}, antes da vigente (${R.fmtData(ant.posicao_em)}). Se for uma correção, tudo bem: a última enviada é a que vale.</div>` : ''}
      <table class="quadro viag-tab"><tbody>${Object.entries(porRub).map(([k, v]) => `<tr><th scope="row">${E(nomeR(k))}</th><td class="num">${brl(v)}</td></tr>`).join('')}</tbody></table>
      ${s.naoClassificadas.length ? `<div class="aviso erro"><b>${s.naoClassificadas.length === 1 ? '1 linha não bate' : s.naoClassificadas.length + ' linhas não batem'} com nenhum item do orçamento</b> (${s.naoClassificadas.length === 1 ? 'entra' : 'entram'} no total, fora das rubricas). Se for erro de nome, corrija na planilha com o nome da aba Itens do modelo e escolha de novo.
        <ul class="small">${s.naoClassificadas.slice(0, 15).map(l => `<li>Linha ${l.linha}: “${E(l.texto)}” · ${brl(l.valor)}</li>`).join('')}${s.naoClassificadas.length > 15 ? `<li>… e mais ${s.naoClassificadas.length - 15}</li>` : ''}</ul></div>` : ''}
      ${foraDoPeriodo(pr.posicao) ? `<div class="aviso">A data desta planilha (${R.fmtData(pr.posicao)}) está fora do período do projeto (${R.fmtData(MQ.PROJETO.vigencia.inicio)} a ${R.fmtData(MQ.PROJETO.vigencia.fim)}). Confira antes de enviar.</div>` : ''}
      ${(pr.suspeitas || []).length ? `<div class="aviso">${E(pr.avisos.find(a => /suspeita/.test(a)) || '')}</div>` : ''}
      ${pr.avisos.filter(a => !(pr.suspeitas || []).length || !/suspeita/.test(a)).map(a => `<p class="small muted">${E(a)}</p>`).join('')}</div>`;
  }
  function painel(p) {
    if (p.tipo === 'exec-descartar') {   // 72: planilha enviada por engano
      const pl = planilhas().find(x => x.id === p.id); if (!pl) return cab('Financeiro', 'Descartar planilha') + '<div class="painel-corpo"><p>Planilha não encontrada.</p></div>';
      const eraVigente = pl === vigente(); const prox = eraVigente ? planilhas().find(x => !x.descartada_em && x !== pl) : null;
      return cab('Financeiro', 'Descartar planilha') + `<div class="painel-corpo"><form class="f" data-form="exec-descartar" data-id="${E(pl.id)}" novalidate>
        <div class="bloco"><dl class="dl"><dt>Arquivo</dt><dd><b>${E(pl.arquivo_nome)}</b></dd><dt>Gastos até</dt><dd>${R.fmtData(pl.posicao_em)}</dd><dt>Enviada em</dt><dd>${R.fmtData(pl.enviado_em)}</dd><dt>Total de gastos</dt><dd class="num">${brl(pl.total_gasto)}</dd></dl></div>
        <div class="aviso">${eraVigente ? (prox ? `Esta é a planilha vigente. Descartada, os números voltam a ser os de <b>${E(prox.arquivo_nome)}</b> (gastos até ${R.fmtData(prox.posicao_em)}).` : 'Esta é a única planilha que vale. Descartada, o painel fica sem planilha até você enviar outra.') : 'Esta planilha já foi substituída: descartar só a tira da lista de planilhas válidas.'}
          A planilha sai de todas as contas e o arquivo é apagado. O registro continua na lista como descartada, com o motivo. Não se desfaz: para voltar, envie o arquivo de novo.</div>
        <div class="campo"><label for="exd-mot">Motivo do descarte (obrigatório)</label><textarea id="exd-mot" name="motivo" maxlength="1000" placeholder="Ex.: arquivo errado (planilha de outro projeto); mês errado."></textarea></div>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn perigo" type="submit">Descartar esta planilha</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
    }
    if (p.tipo !== 'exec-enviar') return '';
    const pr = G.previa;
    return cab('Financeiro', 'Importar planilha da FUNCERN') + `<div class="painel-corpo">
      <form class="f" data-form="exec-ler" novalidate><div class="campos">
        <div class="campo inteiro"><label for="ex-arq">Planilha (.xlsx ou .csv)</label><input id="ex-arq" name="arquivo" type="file" accept=".xlsx,.csv">
          <span class="dica">Todos os gastos desde o início, até a data de hoje (ou da última atualização da FUNCERN). Colunas: Data, Item do orçamento, Descrição, Documento, Valor. <a href="modelos/Modelo_planilha_de_gastos_Mulheres_e_Quintais.xlsx" download>Baixar o modelo</a>.</span></div></div>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn${pr ? '' : ' pri'}" type="submit">${pr ? 'Ler outro arquivo' : 'Ler a planilha'}</button></div></form>
      ${pr ? previaHTML(pr) + `<form class="f" data-form="exec-confirmar" novalidate><div class="campos">
          <div class="campo"><label for="ex-pos">Gastos até (data da planilha)</label><input id="ex-pos" name="posicao_em" type="date" max="${R.hoje()}" value="${pr.posicao}"></div>
          <div class="campo inteiro"><label for="ex-obs">Observação <span class="muted">(opcional)</span></label><input id="ex-obs" name="obs" maxlength="500" placeholder="Ex.: planilha enviada pela FUNCERN em 05/10" value="${E(pr.obsDigitada || '')}"></div></div>
          <p class="small muted">Depois de enviada, a planilha não se altera: se precisar corrigir, envie outra (a mais nova passa a valer). Enviou por engano? Descarte na lista de planilhas enviadas.</p>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn pri" type="submit">Enviar e usar esta planilha</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form>` : ''}
    </div>`;
  }
  async function clique(a, el) {
    if (a === 'exec-enviar') { G.previa = null; U().abrirPainel({ tipo: 'exec-enviar' }); }
    else if (a === 'exec-descartar') U().abrirPainel({ tipo: 'exec-descartar', id: el.dataset.id });
    else if (a === 'exec-baixar') { const url = await S().api.linkPlanilhaExec(el.dataset.path); if (url) window.open(url, '_blank', 'noopener'); else U().toast('O arquivo não está disponível neste aparelho.'); }
    else if (a === 'exec-comp') { const tr = document.getElementById('exc-' + el.dataset.id); if (tr) { tr.hidden = !tr.hidden; el.setAttribute('aria-expanded', String(!tr.hidden)); } }
    else if (a === 'exec-abrir') { const tb = document.getElementById('exr-' + el.dataset.id); if (tb) { const ab = !tb.classList.contains('aberta'); if (ab) encherRub(tb); tb.classList.toggle('aberta', ab); el.setAttribute('aria-expanded', String(ab)); if (ab) rubAbertas.add(el.dataset.id); else rubAbertas.delete(el.dataset.id);
      const bt = document.querySelector('[data-acao="exec-abrir-tudo"]'); if (bt) bt.textContent = rubAbertas.size ? 'Fechar todas' : 'Abrir todas'; } }
    else if (a === 'exec-abrir-meta') { const tb = document.getElementById('exm-' + el.dataset.id); if (tb) { const ab = !tb.classList.contains('aberta'); tb.classList.toggle('aberta', ab); el.setAttribute('aria-expanded', String(ab)); if (ab) metaAbertas.add(el.dataset.id); else metaAbertas.delete(el.dataset.id);
      const bt = document.querySelector('[data-acao="exec-abrir-metas"]'); if (bt) bt.textContent = metaAbertas.size ? 'Fechar todas' : 'Abrir todas'; } }
    else if (a === 'exec-abrir-metas') { const abrir = !metaAbertas.size; document.querySelectorAll('.exec-meta tbody.fin-rubrica').forEach(tb => { const id = tb.id.slice(4); tb.classList.toggle('aberta', abrir); const b = tb.querySelector('.fin-rub'); if (b) b.setAttribute('aria-expanded', String(abrir)); if (abrir) metaAbertas.add(id); else metaAbertas.delete(id); }); el.textContent = abrir ? 'Fechar todas' : 'Abrir todas'; }
    else if (a === 'exec-abrir-tudo') { const abrir = !rubAbertas.size; document.querySelectorAll('.exec-fin:not(.exec-meta) tbody.fin-rubrica').forEach(tb => { const id = tb.id.slice(4); if (abrir) encherRub(tb); tb.classList.toggle('aberta', abrir); const b = tb.querySelector('.fin-rub'); if (b) b.setAttribute('aria-expanded', String(abrir)); if (abrir) rubAbertas.add(id); else rubAbertas.delete(id); }); el.textContent = abrir ? 'Fechar todas' : 'Abrir todas'; }
    else if (a === 'exec-rub') { const tb = document.getElementById('exr-' + el.dataset.id); if (tb) { encherRub(tb); tb.classList.add('aberta'); rubAbertas.add(el.dataset.id); const bb = tb.querySelector('.fin-rub'); if (bb) bb.setAttribute('aria-expanded', 'true'); tb.scrollIntoView({ behavior: 'smooth', block: 'start' }); tb.classList.remove('realce'); void tb.offsetWidth; tb.classList.add('realce'); } }
  }
  /* como cada status da FUNCERN entra (pago, comprometido, não entra): a escolha fica guardada neste aparelho para a próxima planilha */
  const CH_ST = 'mq-imp-status';
  const DESTINOS = ['pago', 'comprometido', 'ignorar'];
  const escolhasStatus = () => { try { const e = JSON.parse(localStorage.getItem(CH_ST) || '{}') || {}; return Object.fromEntries(Object.entries(e).filter(([, v]) => DESTINOS.includes(v))); } catch (e) { return {}; } };
  function mudarStatus(txt, destino) {
    if (!DESTINOS.includes(destino)) return;
    const pr = G.previa; if (!pr || !pr.tab) return;
    const e = Object.assign(escolhasStatus(), { [txt]: destino });
    // auditoria 22/10: primeiro confere se a planilha ainda tem o que valer com a escolha nova; só então guarda (antes, "tudo Não entra" travava as próximas importações)
    let r; try { r = MQ.planilha.interpretar(pr.tab, { equipe: S().equipe || [], status: e }); }
    catch (x) { U().toast(x.message + ' A escolha não foi guardada.'); U().abrirPainel({ tipo: 'exec-enviar' }); return; }
    try { localStorage.setItem(CH_ST, JSON.stringify(e)); } catch (x) {}
    const form = document.querySelector('form[data-form=exec-confirmar]'); const pos = form && form.posicao_em ? form.posicao_em.value : pr.posicao, obs = form && form.obs ? form.obs.value : '';   // o que já foi digitado não se perde
    G.previa = Object.assign(r, { resumo: MQ.planilha.resumo(r), posicao: pos || pr.posicao, obsDigitada: obs, nome: pr.nome, arquivo: pr.arquivo, tab: pr.tab }); U().abrirPainel({ tipo: 'exec-enviar' });
  }
  // "Ver as outras N despesas": a lista só é montada quando abre
  if (typeof document !== 'undefined') document.addEventListener('toggle', ev => { const d = ev.target; if (!d || !d.matches || !d.matches('details.desp-mais') || !d.open) return;
    const alvo = d.querySelector('[data-desp-tarde]'); if (!alvo || !ultimoN) return; const ord = ultimoN.despesas.slice().sort(ordemData); alvo.outerHTML = tabelaDespesas(ord.slice(40), true); }, true);
  if (typeof document !== 'undefined') document.addEventListener('change', ev => { const el = ev.target; if (el && el.matches && el.matches('select[data-exec-status]')) mudarStatus(el.dataset.execStatus, el.value); });
  async function preparar(arquivo) {   // lê e interpreta; devolve a prévia (também usado nos testes)
    const tab = await MQ.planilha.ler(arquivo); const r = MQ.planilha.interpretar(tab, { equipe: S().equipe || [], status: escolhasStatus() }); const resumo = MQ.planilha.resumo(r);
    const posicao = resumo.ultimaData && resumo.ultimaData <= R.hoje() ? resumo.ultimaData : R.hoje();
    return Object.assign(r, { resumo, posicao, nome: String(arquivo.name || 'planilha').slice(0, 200), arquivo, tab });
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'exec-ler') {
      const arq = fd.get('arquivo'); if (!arq || !arq.name) return U().mostrarErros(form, { arquivo: 'Escolha o arquivo da planilha.' });
      await U().ocupado(form, async () => {
        try { G.previa = await preparar(arq); } catch (e) { return U().mostrarErros(form, { arquivo: e.message }); }
        U().abrirPainel({ tipo: 'exec-enviar' });
      });
    }
    if (tipo === 'exec-descartar') {
      const mot = String(fd.get('motivo') || '').trim();
      if (mot.length < 5) return U().mostrarErros(form, { motivo: 'Escreva o motivo do descarte (por exemplo: arquivo errado, mês errado).' });
      await U().ocupado(form, async () => {
        const r = await S().api.descartarPlanilhaExec(form.dataset.id, mot);
        await U().carregar(); U().fecharPainel(); U().render();
        U().toast('Planilha descartada.' + (r && r.arquivoFicou ? ' O arquivo não foi apagado agora (sem internet?): ele não conta em nada.' : ' Os números já não a usam.'));
      });
    }
    if (tipo === 'exec-confirmar') {
      const pr = G.previa; if (!pr) return;
      const pos = String(fd.get('posicao_em') || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(pos)) return U().mostrarErros(form, { posicao_em: 'Informe até que data vão os gastos.' });
      if (pos > R.hoje()) return U().mostrarErros(form, { posicao_em: 'A data não pode ser no futuro.' });
      const obs = String(fd.get('obs') || '').trim() || null;
      await U().ocupado(form, async () => {
        await S().api.enviarPlanilhaExec({ posicao_em: pos, arquivo_nome: pr.nome, linhas: pr.linhas, total_gasto: pr.resumo.gasto, total_recebido: pr.resumo.recebido,
          nao_classificadas: pr.resumo.naoClassificadas.length, obs }, pr.arquivo);
        G.previa = null; await U().carregar(); U().fecharPainel(); U().render(); U().toast('Planilha enviada. Os números já são os dela.');
      });
    }
  }
  MQ.execUI = { aba, painel, clique, enviar, numeros, serie, preparar, vigente, porMeta };
})();
