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
  const itens = () => O().rubricas.flatMap(r => r.itens.map(i => Object.assign({ rubrica: r.id }, i)));
  const itemPorId = id => itens().find(i => i.id === id);
  // vale a última ENVIADA ("a mais nova passa a valer"), mesmo que corrija uma data anterior
  const planilhas = () => (S().execPlanilhas || []).slice().sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em)) || String(b.posicao_em).localeCompare(String(a.posicao_em)));
  const vigente = () => planilhas()[0] || null;
  const G = {};   // prévia da planilha escolhida (antes de confirmar o envio)

  /* ---------- números ---------- */
  function comprometidoItem(i, desde) {   // o que o sistema sabe e a planilha (até "desde") ainda não trouxe
    const a = i.auto; if (!a) return 0;
    const eq = S().equipe || []; const papelDe = id => (eq.find(m => m.id === id) || {}).papel;
    const val = s => +(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado) || 0;
    const depois = d => !desde || (d && R.diaLocal(d) > desde);   // data de Brasília (o banco grava em UTC)
    if (a.bolsa || a.ajuda) {
      return (S().solic || []).filter(s => (a.ajuda ? s.tipo === 'ajuda_custo' : (s.tipo === 'bolsa' && papelDe(s.equipe_id) === a.bolsa))
        && (s.situacao === 'avalizada' || (s.situacao === 'lancada' && depois(s.arlo_em)))).reduce((t, s) => t + val(s), 0);
    }
    return (S().pedidos || []).filter(p => p.situacao === 'autorizado' && depois(p.decidido_em) && (a.evento ? p.tipo === 'evento' : p.tipo === 'passagem' && (p.dados || {}).finalidade === a.passagem))
      .reduce((t, p) => t + (+p.valor_autorizado || +(p.dados || {}).valor_estimado || 0), 0);
  }
  function numeros() {
    const pl = vigente(); const linhas = pl ? pl.linhas : []; const desde = pl ? String(pl.posicao_em).slice(0, 10) : null;
    const somaL = f => Math.round(linhas.filter(f).reduce((t, l) => t + (+l.valor || 0), 0) * 100) / 100;
    const porItem = {};
    itens().forEach(i => { const exec = somaL(l => l.item === i.id), comp = comprometidoItem(i, desde);
      porItem[i.id] = { exec, comp, saldo: i.total - exec - comp, passou: exec + comp > i.total + 0.005 }; });
    const soma = (xs, k) => xs.reduce((t, i) => t + porItem[i.id][k], 0);
    const rub = O().rubricas.map(r => { const semItem = somaL(l => l.rubrica === r.id && !l.item);
      return { r, previsto: r.itens.reduce((t, i) => t + i.total, 0), exec: soma(r.itens, 'exec') + semItem, comp: soma(r.itens, 'comp'), semItem }; });
    const naoClass = somaL(l => l.item !== 'repasse_mda' && !l.rubrica);
    const exec = somaL(l => l.item !== 'repasse_mda'), comp = soma(itens(), 'comp');
    const recebido = somaL(l => l.item === 'repasse_mda');
    const V = MQ.PROJETO.vigencia; const dia = d => new Date(d + 'T12:00:00').getTime();
    const tempo = Math.max(0, Math.min(1, (dia(R.hoje()) - dia(V.inicio)) / (dia(V.fim) - dia(V.inicio))));
    const idade = pl ? R.diasAte(R.hoje()) - R.diasAte(desde) : null;
    return { pl, porItem, rub, exec, comp, recebido, naoClass, tempo, idade, livre: O().total - exec - comp, caixa: recebido - exec };
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
    (pl ? pl.linhas : []).forEach(l => { const ym = l.data ? String(l.data).slice(0, 7) : mesPl;
      if (l.item === 'repasse_mda') recMes[ym] = (recMes[ym] || 0) + (+l.valor || 0); else add(ym, +l.valor || 0); });
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
  const celExec = (exec, total) => { const p = pct(exec, total); return `<span class="fin-exe"><span class="medidor fino" aria-hidden="true"><i class="${exec > 0 ? 'st-ok' : ''}" style="width:${Math.min(100, p)}%"></i></span><b class="num">${pctBR(p)}%</b></span>`; };
  const vExec = v => `<span class="${v > 0 ? 'fin-exec' : 'fin-zero'}">${brl(v)}</span>`;
  const vComp = v => `<span class="${v > 0 ? 'fin-comp' : 'fin-zero'}">${brl(v)}</span>`;
  function alertas(n) {
    const a = [];
    if (!n.pl) a.push('Nenhuma planilha de gastos enviada ainda. Sem ela, o executado fica zerado: envie a planilha do mês.');
    else if (n.idade > 35) a.push(`A planilha vigente é de <b>${R.fmtData(n.pl.posicao_em)}</b> (${n.idade} dias atrás). Envie a planilha deste mês.`);
    itens().forEach(i => { const x = n.porItem[i.id]; if (x.passou) a.push(`<b>${E(i.nome)}</b>: executado + comprometido (${brl(x.exec + x.comp)}) passa do previsto (${brl(i.total)}).`); });
    if (n.naoClass) a.push(`${brl(n.naoClass)} em linhas que não batem com nenhum item do orçamento (entram no executado total, fora das rubricas). Veja em <b>Planilhas enviadas</b>.`);
    if (n.caixa < -0.005) a.push(`O executado (${brl(n.exec)}) passa do recebido do MDA na planilha (${brl(n.recebido)}). Confira se a planilha traz os repasses.`);
    return a;
  }
  function aba() {
    if (S().execSemBanco) return `<div class="cab"><div><span class="eyebrow">Execução</span><h1>Execução do orçamento</h1></div></div>
      <div class="aviso">A execução ainda não está instalada no servidor. Rode o arquivo <b>37_execucao_planilhas.sql</b> no Supabase.</div>`;
    const n = numeros(); const T = O().total; const al = alertas(n);
    const usoPct = pct(n.exec + n.comp, T), tempoPct = Math.round(n.tempo * 1000) / 10;
    const ritmo = usoPct + 10 < tempoPct ? 'abaixo do tempo decorrido: o projeto está gastando devagar' : usoPct > tempoPct + 15 ? 'acima do tempo decorrido: atenção ao ritmo' : 'no ritmo do tempo decorrido';
    let acum = 0; const prox = O().repasses.find(r => { acum += r.valor; return acum > n.recebido + 0.005; });   // o próximo repasse que ainda não entrou
    const linhaItem = i => { const x = n.porItem[i.id];
      return `<tr class="fin-item${x.passou ? ' passou' : ''}"><th scope="row"><button type="button" class="fin-nome" data-acao="exec-comp" data-id="${E(i.id)}" aria-expanded="false" aria-controls="exc-${E(i.id)}">${E(i.nome)}</button></th>
        <td class="num" data-rot="Previsto">${brl(i.total)}</td><td class="num" data-rot="Executado">${vExec(x.exec)}</td><td class="num" data-rot="Comprometido">${vComp(x.comp)}</td><td class="num fin-saldo" data-rot="Saldo">${brl(x.saldo)}</td><td data-rot="Execução">${celExec(x.exec, i.total)}</td></tr>
        <tr class="fin-comp" id="exc-${E(i.id)}" hidden><td colspan="6"><dl class="fin-det"><div><dt>Composição</dt><dd>${E(composicao(i))}</dd></div><div><dt>Previsto</dt><dd class="num">${brl(i.total)}</dd></div>
          <div><dt>Executado</dt><dd class="num">${brl(x.exec)}</dd></div><div><dt>Comprometido</dt><dd class="num">${brl(x.comp)}</dd></div><div><dt>Saldo</dt><dd class="num"><b>${brl(x.saldo)}</b></dd></div></dl></td></tr>`; };
    const semItem = x => x.semItem ? `<tr class="fin-item"><th scope="row"><span class="fin-nome sem">Sem item definido na planilha</span><span class="small muted">a planilha disse só a rubrica</span></th><td class="num" data-rot="Previsto">—</td><td class="num" data-rot="Executado">${vExec(x.semItem)}</td><td class="num" data-rot="Comprometido">—</td><td class="num" data-rot="Saldo">—</td><td></td></tr>` : '';
    return `<div class="cab"><div><span class="eyebrow">Execução</span><h1>Execução do orçamento</h1>
        <p>Previsto × executado de cada rubrica do TED (R$ ${(T / 1e6).toLocaleString('pt-BR')} milhões). O executado vem da <b>planilha de gastos</b> mais recente; o comprometido, do que o sistema já sabe e a planilha ainda não trouxe. Só você vê esta aba.</p>
        <p class="small muted">Base do previsto: ${E(O().fonte)}, com o remanejamento aprovado pelo MDA.</p></div></div>
      <div class="acoes-pag">${MQ.acaoComDica({ acao: 'exec-enviar', icone: 'enviar', texto: 'Enviar planilha de gastos', curto: 'Enviar planilha' }, 'Pelo menos uma vez por mês. Retrato completo desde o início: a mais nova substitui as anteriores.')}</div>
      <p class="small ${n.pl ? 'muted' : ''}">${n.pl ? `Planilha vigente: <b>${E(n.pl.arquivo_nome)}</b>, gastos até ${R.fmtData(n.pl.posicao_em)} (enviada em ${R.fmtData(String(n.pl.enviado_em).slice(0, 10))}).` : '<b>Nenhuma planilha enviada ainda.</b>'}</p>
      <section class="fin-resumo" aria-label="Execução financeira">
        <span class="dx-rot">Execução financeira</span>
        <div class="fin-nums">
          <div><span class="fin-v num">${brl(T)}</span><span class="fin-l">total previsto</span></div>
          <div><span class="fin-v num fin-exec">${brl(n.exec)}</span><span class="fin-l">executado · ${pctBR(pct(n.exec, T))}%</span></div>
          <div><span class="fin-v num fin-comp">${brl(n.comp)}</span><span class="fin-l">comprometido · ${pctBR(pct(n.comp, T))}%</span></div>
          <div><span class="fin-v num"><b>${brl(n.livre)}</b></span><span class="fin-l">saldo livre para executar</span></div>
        </div>
        <div class="fin-barra" role="img" aria-label="Executado ${pctBR(pct(n.exec, T))}%, comprometido ${pctBR(pct(n.comp, T))}%"><i class="e" style="width:${Math.min(100, pct(n.exec, T))}%"></i><i class="c" style="width:${Math.min(100 - Math.min(100, pct(n.exec, T)), pct(n.comp, T))}%"></i></div>
        <p class="fin-sub"><span><b>${pctBR(usoPct)}%</b> do orçamento em uso (executado + comprometido) · tempo de vigência decorrido: ${pctBR(tempoPct)}%: ${ritmo}</span></p>
        <p class="fin-sub muted">Recebido do MDA: <b>${brl(n.recebido)}</b> de ${brl(T)}${prox ? ` · próximo repasse: ${brl(prox.valor)}, previsto para ${prox.mes.slice(5)}/${prox.mes.slice(0, 4)}${prox.mes < R.hoje().slice(0, 7) ? ' (atrasado ou ainda fora da planilha)' : ''}` : ''} · em caixa na FUNCERN (recebido − executado): <b>${brl(n.caixa)}</b>. Comprometido = aval, Arlo ou autorização ${n.pl ? 'depois de ' + R.fmtData(n.pl.posicao_em) : 'ainda sem planilha'}.</p>
      </section>
      <div class="exec-grafs">${graficoRitmo(serie())}${graficoRubricas(n)}</div>
      ${al.length ? `<div class="aviso erro"><ul class="exec-alertas">${al.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      <section class="secao" aria-labelledby="t-exr"><div class="secao-cab"><h2 id="t-exr">Por rubrica</h2></div>
        <p class="small muted">Toque no item para ver a composição do valor.</p>
        <div class="fin-wrap"><table class="fin exec-fin"><thead><tr><th scope="col">Rubrica</th><th scope="col">Previsto</th><th scope="col">Executado</th><th scope="col">Comprometido</th><th scope="col">Saldo</th><th scope="col">Execução</th></tr></thead>
          ${n.rub.map(x => { const { r, previsto, exec, comp } = x; return `<tbody id="exr-${r.id}"><tr class="fin-grupo"><th scope="rowgroup">${E(r.nome)}</th><td class="num" data-rot="Previsto">${brl(previsto)}</td><td class="num" data-rot="Executado">${vExec(exec)}</td><td class="num" data-rot="Comprometido">${vComp(comp)}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(previsto - exec - comp)}</b></td><td data-rot="Execução">${celExec(exec, previsto)}</td></tr>
            ${r.itens.map(linhaItem).join('')}${semItem(x)}</tbody>`; }).join('')}
          ${n.naoClass ? `<tbody><tr class="fin-grupo"><th scope="rowgroup">Fora do orçamento (não classificado)</th><td class="num" data-rot="Previsto">—</td><td class="num" data-rot="Executado">${vExec(n.naoClass)}</td><td class="num" data-rot="Comprometido">—</td><td class="num" data-rot="Saldo">—</td><td></td></tr></tbody>` : ''}
          <tfoot><tr class="fin-tot"><th scope="row">Total do projeto</th><td class="num" data-rot="Previsto"><b>${brl(T)}</b></td><td class="num" data-rot="Executado">${vExec(n.exec)}</td><td class="num" data-rot="Comprometido">${vComp(n.comp)}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(n.livre)}</b></td><td data-rot="Execução">${celExec(n.exec, T)}</td></tr></tfoot>
        </table></div></section>
      <section class="secao" aria-labelledby="t-exl"><div class="secao-cab"><h2 id="t-exl">Planilhas enviadas <span class="conta-t${planilhas().length ? '' : ' zero'}">${planilhas().length}</span></h2></div>
        ${planilhas().length ? `<div class="pag-lista">${planilhas().map((pl, k) => linhaPlanilha(pl, k === 0)).join('')}</div>` : '<p class="muted">Nenhuma ainda.</p>'}</section>`;
  }
  function linhaPlanilha(pl, vale) {
    const nao = (pl.linhas || []).filter(l => l.item !== 'repasse_mda' && !l.rubrica);
    return `<div class="exec-lanc${vale ? '' : ' antiga'}">
      <span class="nm">${E(pl.arquivo_nome)} ${vale ? '<span class="chip ok">vigente</span>' : '<span class="chip">substituída</span>'}</span><b class="num">${brl(pl.total_gasto)}</b>
      <span class="small muted">Gastos até ${R.fmtData(pl.posicao_em)} · enviada em ${R.fmtData(String(pl.enviado_em).slice(0, 10))} · ${(pl.linhas || []).length} linhas · recebido ${brl(pl.total_recebido)}</span>
      ${pl.obs ? `<span class="small">${E(pl.obs)}</span>` : ''}
      ${nao.length ? `<details class="small"><summary>${nao.length} linha${nao.length > 1 ? 's' : ''} fora do orçamento</summary><ul>${nao.slice(0, 30).map(l => `<li>Linha ${l.linha}: “${E(l.texto)}” · ${brl(l.valor)}${l.descricao ? ' · ' + E(l.descricao) : ''}</li>`).join('')}</ul></details>` : ''}
      <button type="button" class="link small" data-acao="exec-baixar" data-path="${E(pl.arquivo_path)}">Baixar o arquivo enviado</button></div>`;
  }

  /* ---------- enviar planilha: escolher o arquivo, ver a prévia, confirmar ---------- */
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function previaHTML(pr) {
    const s = pr.resumo; const porRub = {};
    pr.linhas.filter(l => l.item !== 'repasse_mda').forEach(l => { const k = l.rubrica || '_'; porRub[k] = (porRub[k] || 0) + l.valor; });
    const nomeR = id => id === '_' ? 'Fora do orçamento (não classificado)' : (O().rubricas.find(r => r.id === id) || {}).nome;
    const ant = vigente();
    return `<div class="bloco"><h3>Prévia: ${E(pr.nome)}</h3>
      <p class="small muted">Aba lida: ${E(pr.aba)} · ${pr.linhas.length} linhas com valor${pr.ignoradas ? ` · ${pr.ignoradas} linhas de total ou sem valor ignoradas` : ''}</p>
      <ul class="pp"><li><span>Gastos</span><b class="num">${brl(s.gasto)}</b></li><li><span>Recebido do MDA</span><b class="num">${brl(s.recebido)}</b></li>
        ${ant ? `<li><span>Planilha vigente hoje</span><b class="num">${brl(ant.total_gasto)}<small class="muted"> até ${R.fmtData(ant.posicao_em)}</small></b></li>` : ''}</ul>
      ${ant && s.gasto + 0.005 < +ant.total_gasto ? '<div class="aviso erro">O total desta planilha é <b>menor</b> que o da planilha vigente. Como cada planilha é o retrato completo desde o início, confira se não faltam gastos antigos.</div>' : ''}
      ${ant && s.ultimaData && s.ultimaData < String(ant.posicao_em).slice(0, 10) ? `<div class="aviso">Os gastos desta planilha vão até ${R.fmtData(s.ultimaData)}, antes da vigente (${R.fmtData(ant.posicao_em)}). Se for uma correção, tudo bem: a última enviada é a que vale.</div>` : ''}
      <table class="quadro viag-tab"><tbody>${Object.entries(porRub).map(([k, v]) => `<tr><th scope="row">${E(nomeR(k))}</th><td class="num">${brl(v)}</td></tr>`).join('')}</tbody></table>
      ${s.naoClassificadas.length ? `<div class="aviso erro"><b>${s.naoClassificadas.length} linha${s.naoClassificadas.length > 1 ? 's' : ''} não batem com nenhum item do orçamento</b> (entram no total, fora das rubricas). Se for erro de nome, corrija na planilha com o nome da aba Itens do modelo e escolha de novo.
        <ul class="small">${s.naoClassificadas.slice(0, 15).map(l => `<li>Linha ${l.linha}: “${E(l.texto)}” · ${brl(l.valor)}</li>`).join('')}${s.naoClassificadas.length > 15 ? `<li>… e mais ${s.naoClassificadas.length - 15}</li>` : ''}</ul></div>` : ''}
      ${pr.avisos.map(a => `<p class="small muted">${E(a)}</p>`).join('')}</div>`;
  }
  function painel(p) {
    if (p.tipo !== 'exec-enviar') return '';
    const pr = G.previa;
    return cab('Execução', 'Enviar planilha de gastos') + `<div class="painel-corpo">
      <form class="f" data-form="exec-ler" novalidate><div class="campos">
        <div class="campo inteiro"><label for="ex-arq">Planilha (.xlsx ou .csv)</label><input id="ex-arq" name="arquivo" type="file" accept=".xlsx,.csv">
          <span class="dica">Todos os gastos desde o início, até a data de hoje (ou da última atualização da FUNCERN). Colunas: Data, Item do orçamento, Descrição, Documento, Valor. <a href="modelos/Modelo_planilha_de_gastos_Mulheres_e_Quintais.xlsx" download>Baixar o modelo</a>.</span></div></div>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn${pr ? '' : ' pri'}" type="submit">${pr ? 'Ler outro arquivo' : 'Ler a planilha'}</button></div></form>
      ${pr ? previaHTML(pr) + `<form class="f" data-form="exec-confirmar" novalidate><div class="campos">
          <div class="campo"><label for="ex-pos">Gastos até (data da planilha)</label><input id="ex-pos" name="posicao_em" type="date" max="${R.hoje()}" value="${pr.posicao}"></div>
          <div class="campo inteiro"><label for="ex-obs">Observação <span class="muted">(opcional)</span></label><input id="ex-obs" name="obs" maxlength="500" placeholder="Ex.: planilha enviada pela FUNCERN em 05/10"></div></div>
          <p class="small muted">Depois de enviada, a planilha não se altera nem se apaga: se precisar corrigir, envie outra. A mais nova passa a valer.</p>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn pri" type="submit">Enviar e usar esta planilha</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form>` : ''}
    </div>`;
  }
  async function clique(a, el) {
    if (a === 'exec-enviar') { G.previa = null; U().abrirPainel({ tipo: 'exec-enviar' }); }
    else if (a === 'exec-baixar') { const url = await S().api.linkPlanilhaExec(el.dataset.path); if (url) window.open(url, '_blank', 'noopener'); else U().toast('O arquivo não está disponível neste aparelho.'); }
    else if (a === 'exec-comp') { const tr = document.getElementById('exc-' + el.dataset.id); if (tr) { tr.hidden = !tr.hidden; el.setAttribute('aria-expanded', String(!tr.hidden)); } }
    else if (a === 'exec-rub') { const tb = document.getElementById('exr-' + el.dataset.id); if (tb) { tb.scrollIntoView({ behavior: 'smooth', block: 'start' }); tb.classList.remove('realce'); void tb.offsetWidth; tb.classList.add('realce'); } }
  }
  async function preparar(arquivo) {   // lê e interpreta; devolve a prévia (também usado nos testes)
    const tab = await MQ.planilha.ler(arquivo); const r = MQ.planilha.interpretar(tab); const resumo = MQ.planilha.resumo(r);
    const posicao = resumo.ultimaData && resumo.ultimaData <= R.hoje() ? resumo.ultimaData : R.hoje();
    return Object.assign(r, { resumo, posicao, nome: String(arquivo.name || 'planilha').slice(0, 200), arquivo });
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'exec-ler') {
      const arq = fd.get('arquivo'); if (!arq || !arq.name) return U().mostrarErros(form, { arquivo: 'Escolha o arquivo da planilha.' });
      await U().ocupado(form, async () => {
        try { G.previa = await preparar(arq); } catch (e) { return U().mostrarErros(form, { arquivo: e.message }); }
        U().abrirPainel({ tipo: 'exec-enviar' });
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
  MQ.execUI = { aba, painel, clique, enviar, numeros, serie, preparar, vigente };
})();
