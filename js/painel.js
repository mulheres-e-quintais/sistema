/* Mulheres & Quintais — visão geral do projeto (tela inicial da coordenação).
   Mostra só o que o sistema sabe; o que ainda é registrado fora dele aparece como tal, nunca como zero. */
(function () {
  const R = MQ.regras;
  const E = s => MQ.ui.esc(s);
  const U = { nomeUF: uf => MQ.ui.nomeUF(uf) };

  const mesDoProjeto = (d = new Date()) => {
    const m = (d.getFullYear() - 2026) * 12 + (d.getMonth() - 8) + 1;
    return Math.max(1, Math.min(13, m));
  };
  const MESES = ['set/26', 'out/26', 'nov/26', 'dez/26', 'jan/27', 'fev/27', 'mar/27', 'abr/27', 'mai/27', 'jun/27', 'jul/27', 'ago/27', 'set/27'];
  /* previsto até o fim do mês anterior (meses completos), distribuído igualmente na janela da meta */
  const previsto = (meta, mes) => {
    const completos = mes - 1;
    if (completos < meta.ini) return 0;
    if (completos >= meta.fim) return meta.alvo;
    return Math.round(meta.alvo * (completos - meta.ini + 1) / (meta.fim - meta.ini + 1));
  };

  function dados(S) {
    const ativos = S.equipe.filter(m => m.status === 'ativa');
    const pagaveis = ativos.filter(m => m.papel === 'coord_tecnico' || MQ.regras.ehBolsista(m.papel));
    const bols = ativos.filter(m => R.ehBolsista(m.papel));
    const fichas = S.fichas || [];
    const selAprov = fichas.filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada');
    return { ativos, pagaveis, bols, fichas, selAprov, ct: ativos.find(m => m.papel === 'coord_tecnico'),
      aptas: pagaveis.filter(m => R.situacao(m).cod === 'ok') };
  }

  /* ---------- o que pede atenção (sinais objetivos, ligados aos riscos do projeto) ---------- */
  function alertas(S, d) {
    const a = [];
    const hoje = R.hoje();
    // planilha de gastos do mês (o lembrete não aparece na visão geral; o aviso fica aqui)
    if (!S.execSemBanco && +hoje.slice(8, 10) >= 20 && !(S.execPlanilhas || []).some(p => String(R.diaLocal(p.enviado_em)).slice(0, 7) === hoje.slice(0, 7))) {
      const fim = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7), 0).getDate();
      a.push({ nivel: 'pend', prazo: hoje.slice(0, 8) + String(fim).padStart(2, '0'), texto: 'Planilha de gastos do mês ainda não enviada', det: 'Sem ela, o executado do painel fica parado na planilha anterior.', aba: 'execucao' });
    }
    const vagas = 11 - d.pagaveis.length;
    if (vagas > 0) {
      const dias = R.diasAte(MQ.PROJETO.prazoIndicacao);
      a.push({ nivel: dias < 0 ? 'crit' : 'pend', prazo: MQ.PROJETO.prazoIndicacao, texto: `${vagas} vaga${vagas > 1 ? 's' : ''} da equipe sem pessoa cadastrada`,
        det: dias < 0 ? `A equipe ainda não está toda cadastrada no sistema. O prazo para o MPA indicar era ${R.fmtData(MQ.PROJETO.prazoIndicacao)}, e os diagnósticos começam em ${R.fmtData(MQ.PROJETO.inicioDiagnosticos)}.` : `Prazo de indicação do MPA: ${R.fmtData(MQ.PROJETO.prazoIndicacao)}.`, aba: 'equipe' });
    }
    // 18/10/2026: todas as funções que recebem bolsa (antes ficavam de fora os professores do curso FIC e o auxiliar)
    const comBolsa = d.ativos.filter(m => m.papel === 'coord_tecnico' || R.ehBolsista(m.papel) || m.papel === 'professor_fic' || m.papel === 'auxiliar_adm');
    const semHab = comBolsa.filter(m => R.situacao(m).cod !== 'ok');
    if (semHab.length) a.push({ nivel: 'pend', texto: `${semHab.length} pessoa${semHab.length > 1 ? 's' : ''} com bolsa ainda sem habilitação completa`,
      det: semHab.slice(0, 4).map(m => m.nome.split(' ')[0] + ' (' + R.passosHabilitacao(m).filter(p => !p.feito).map(p => p.id === 'fic' ? 'FIC' : p.id === 'funcern' ? 'FUNCERN' : 'termo').join(', ') + ')').join(' · ') + (semHab.length > 4 ? ' …' : ''), aba: 'equipe' });
    const desde = f => f.atualizado_em || f.criado_em;   // 13/10/2026: ficha devolvida e reenviada hoje não conta como atrasada
    const velhas = d.fichas.filter(f => f.situacao === 'aguardando' && desde(f) && (Date.now() - new Date(desde(f))) > 5 * 864e5);
    if (velhas.length) a.push({ nivel: 'pend', prazo: R.somaDias(velhas.map(f => R.diaLocal(desde(f))).sort()[0], 5), texto: `${velhas.length} ficha${velhas.length > 1 ? 's' : ''} aguardando aprovação há mais de 5 dias`, det: 'A aprovação é da coordenação técnica. Sem ela, o diagnóstico não começa.', aba: 'selecao' });
    const nCasas = R.contarCasas(d.fichas); const casas = d.fichas.filter(f => { const k = R.chaveCasa(f); return k && nCasas.get(k) > 1; });
    if (casas.length) a.push({ nivel: 'crit', prazo: 'imediato', texto: `${casas.length} ${casas.length === 1 ? 'ficha' : 'fichas'} com o mesmo endereço de outra ficha`, det: 'Duas pessoas da mesma casa não podem ser selecionadas (risco de questionamento da seleção).', aba: 'selecao' });
    MQ.UFS.forEach(u => {
      const fs = d.fichas.filter(f => f.uf === u.uf);
      const semAgua = fs.filter(f => f.resultado === 'sem_agua').length;
      if (fs.length >= 5 && semAgua / fs.length > 0.3)
        a.push({ nivel: 'crit', texto: `${u.nome}: ${Math.round(semAgua / fs.length * 100)}% das fichas sem água no período seco`,
          det: 'Acima de 30% é o sinal de alerta do risco "quintal sem água". Rever o território ou buscar parceria com programa de cisternas.', aba: 'selecao' });
      if (hoje >= MQ.PROJETO.inicioDiagnosticos && fs.length === 0)
        a.push({ nivel: 'pend', prazo: MQ.PROJETO.inicioDiagnosticos, texto: `${u.nome}: nenhuma ficha de indicação lançada`, det: 'Os diagnósticos já deveriam ter começado.', aba: 'selecao' });
    });
    const semImagem = d.fichas.filter(f => f.consent_dados && !f.consent_imagem).length;
    if (semImagem) a.push({ nivel: 'info', texto: `${semImagem} mulher${semImagem > 1 ? 'es' : ''} não autorizou uso de imagem`, det: 'Não use fotos delas em divulgação. O sistema mostra o aviso na ficha de cada uma.', aba: 'selecao' });
    return a;
  }

  /* ---------- padrão único de status (o mesmo em todo o sistema) ---------- */
  const STATUS = {
    concluida: { t: 'Concluída', cls: 'st-ok' }, andamento: { t: 'Em andamento', cls: 'st-and' }, atencao: { t: 'Atenção', cls: 'st-aten' },
    atrasada: { t: 'Atrasada', cls: 'st-atr' }, nao: { t: 'Não iniciada', cls: 'st-nao' }, fora: { t: 'Sem registro no sistema', cls: 'st-nao' }
  };
  const chipStatus = (k, texto) => { const s = STATUS[k] || STATUS.nao; return `<span class="st-chip ${s.cls}">${E(texto || s.t)}</span>`; };

  /* o que o sistema sabe de cada meta: realizado, previsto até o mês passado e o status (sem inventar nada) */
  function infoMeta(meta, S, d, mes) {
    const prev = previsto(meta, mes);
    let atual = null, nota = '', alvo = meta.alvo, un = meta.un;
    if (meta.fonte === 'equipe') {
      atual = d.aptas.length; alvo = 11; un = 'habilitadas (coord. técnica e bolsistas)';
      nota = `${d.pagaveis.length} de 11 cadastradas (1 coordenação técnica e 10 bolsistas). Meta: ${meta.alvo} ${meta.un}.`;
    } else if (meta.fonte === 'diagnostico') {
      const dg = S.diagnosticos || [];
      atual = dg.length;
      const aprov = dg.filter(x => x.situacao === 'aprovado' && !x.sem_agua).length, seca = dg.filter(x => x.sem_agua).length;
      nota = `${aprov} com plano aprovado pela coordenação técnica${seca ? ` · ${seca} sem água na seca (encaminhadas, sem kit)` : ''}.`;
    } else if (meta.fonte === 'implantacao' || meta.fonte === 'visitas') {
      const etapa = meta.fonte === 'implantacao' ? 'implantacao' : 'acompanhamento';
      const vs = (S.visitas || []).filter(v => v.etapa === etapa);
      atual = vs.filter(v => v.situacao === 'realizada').length;
      const prevs = vs.filter(v => v.situacao === 'prevista').length;
      nota = `Visitas de ${etapa === 'implantacao' ? 'implantação' : 'acompanhamento'} marcadas como feitas no roteiro${prevs ? ` · ${prevs} agendada${prevs > 1 ? 's' : ''}` : ''}. O relato e as fotos ficam no registro de cada visita.`;
    } else if (meta.fonte) nota = 'O formulário desta etapa ainda não está no sistema. Por enquanto o registro é em papel.';
    else nota = 'Acompanhada fora deste sistema, no painel financeiro e de entregas.';
    const antes = mes - 1 < meta.ini, depois = mes - 1 >= meta.fim;
    let st;
    if (atual == null) st = antes ? 'nao' : 'fora';
    else if (meta.fonte === 'equipe') st = atual >= 11 ? 'andamento' : R.diasAte(MQ.PROJETO.prazoIndicacao) < 0 ? 'atrasada' : 'atencao';
    else if (atual >= alvo) st = 'concluida';
    else if (antes) st = atual > 0 ? 'andamento' : 'nao';
    else if (depois) st = 'atrasada';
    else st = atual >= prev ? 'andamento' : atual >= prev * 0.7 ? 'atencao' : 'atrasada';
    return { meta, atual, alvo, un, prev, nota, st, pct: atual == null ? 0 : Math.min(100, atual / alvo * 100), pctPrev: meta.fonte === 'equipe' ? null : Math.min(100, prev / alvo * 100) };
  }
  /* cronograma físico (14/10/2026): uma linha por meta, do mês em que começa ao mês em que termina no plano de trabalho,
     com o que já foi registrado (parte cheia da barra), o traço de hoje e o número de cada meta. Toque no nome abre a meta. */
  function cronograma(S, d, mes) {
    const N = MESES.length, hj = R.hoje();
    const y = +hj.slice(0, 4), m = +hj.slice(5, 7), dia = +hj.slice(8, 10);
    const idx = (y - 2026) * 12 + (m - 9), diasMes = new Date(y, m, 0).getDate();
    const hojePct = Math.max(0, Math.min(100, (idx + (dia - 0.5) / diasMes) / N * 100));
    const pct = k => (k / N * 100).toFixed(3) + '%';
    const EXT = { 'set/26': 'setembro de 2026', 'out/26': 'outubro de 2026', 'nov/26': 'novembro de 2026', 'dez/26': 'dezembro de 2026', 'jan/27': 'janeiro de 2027', 'fev/27': 'fevereiro de 2027', 'mar/27': 'março de 2027', 'abr/27': 'abril de 2027', 'mai/27': 'maio de 2027', 'jun/27': 'junho de 2027', 'jul/27': 'julho de 2027', 'ago/27': 'agosto de 2027', 'set/27': 'setembro de 2027' };
    const linhas = MQ.METAS.map(meta => {
      const x = infoMeta(meta, S, d, mes);
      const ini = meta.ini - 1, fim = meta.fim;   // colunas: do começo do mês inicial ao fim do mês final
      const naoComecou = idx < ini, vencido = idx >= fim && x.st !== 'concluida' && x.atual != null && x.atual < x.alvo;
      const tipo = x.st === 'concluida' ? 'ok' : vencido ? 'venc' : naoComecou ? 'futuro' : 'curso';
      const situ = x.atual == null && !naoComecou ? 'registro fora do sistema' : { ok: 'concluída', venc: 'prazo vencido', futuro: 'não começou', curso: 'em curso' }[tipo];
      const cheio = x.atual == null ? 0 : x.pct;
      const per = MESES[meta.ini - 1] === MESES[meta.fim - 1] ? MESES[meta.ini - 1] : MESES[meta.ini - 1] + ' a ' + MESES[meta.fim - 1];
      const falado = `${meta.id.replace('M', 'Meta ')}, ${meta.nome}: de ${EXT[MESES[meta.ini - 1]]} a ${EXT[MESES[meta.fim - 1]]}. ${x.atual == null ? 'Sem número no sistema' : x.atual + ' de ' + x.alvo + ' ' + x.un}, ${situ}.`;
      return `<li class="cg-linha cg-${tipo}">
        <button type="button" class="cg-nome" data-meta-ir="${meta.id}" aria-label="${E(falado)} Abre o detalhe da meta."><span class="cg-id">${meta.id}</span><span>${E(meta.nome)}</span></button>
        <span class="cg-trilho" aria-hidden="true"><span class="cg-barra" style="left:${pct(ini)};width:${pct(fim - ini)}" title="${per}">${cheio ? `<i style="width:${cheio.toFixed(1)}%"></i>` : ''}</span></span>
        <span class="cg-num" aria-hidden="true"><span class="num"><b>${x.atual == null ? '—' : x.atual}</b> de ${x.alvo}</span><small>${situ}</small></span>
      </li>`;
    }).join('');
    const meses = MESES.map((l, k) => `<span class="${k === idx ? 'cg-agora' : ''}${k % 3 ? ' cg-mes-x' : ''}" style="left:${pct(k + 0.5)}">${k === 0 || k === N - 1 || l.startsWith('jan') ? l : l.slice(0, 3)}</span>`).join('');   // ano só no começo, na virada e no fim: os rótulos não se encostam
    return `<section class="secao cg" aria-labelledby="t-cg">
      <div class="secao-cab cg-cab"><div><h2 id="t-cg">Cronograma físico do plano de trabalho</h2><p>De ${MESES[0]} a ${MESES[N - 1]}. A parte cheia da barra é o que já foi registrado no sistema. Toque na meta para ver o detalhe.</p></div>
        <ul class="cg-leg" aria-label="Legenda"><li><i class="lg-per"></i>período da meta</li><li><i class="lg-reg"></i>já registrado</li><li><i class="lg-fut"></i>ainda não começou</li><li><i class="lg-venc"></i>prazo vencido</li><li><i class="lg-hoje"></i>hoje</li></ul></div>
      <div class="cg-grade" style="--cg-hoje:${hojePct.toFixed(3)}%">
        <div class="cg-meses" aria-hidden="true"><span class="cg-meses-trilho">${meses}${idx >= 0 && idx < N ? '<b class="cg-hoje-selo">hoje</b>' : ''}</span></div>
        <ol class="cg-lista">${linhas}</ol>
      </div>
    </section>`;
  }
  function linhaMeta(meta, S, d, mes) {
    const x = infoMeta(meta, S, d, mes);
    const hoje = R.hoje(); const ms = (MQ.MARCOS || []).filter(k => k.meta === meta.id);
    const MESC = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const marcosDaMeta = ms.length ? `<div class="mm-marcos"><span class="mm-t">Marco${ms.length > 1 ? 's' : ''} desta meta</span><ul>${ms.map(k => `<li class="${k.d < hoje ? 'passou' : ''}"><time datetime="${k.d}"><b>${k.d.slice(8, 10)}</b> ${MESC[+k.d.slice(5, 7) - 1]} ${k.d.slice(0, 4)}</time><span>${E(k.t)}</span></li>`).join('')}</ul></div>` : '';
    return `<details class="dx-meta" id="meta-${meta.id}">
      <summary><span class="meta-id">${meta.id}</span><span class="meta-nome">${E(meta.nome)}</span>${chipStatus(x.st, x.st === 'nao' && mes - 1 < meta.ini ? 'Começa em ' + MESES[meta.ini - 1] : null)}
        <span class="medidor" role="img" aria-label="${x.atual == null ? 'sem registro' : x.atual + ' de ' + x.alvo}${x.pctPrev != null && x.prev > 0 ? ', previsto até agora ' + x.prev : ''}"><i class="${STATUS[x.st].cls}" style="width:${x.pct}%"></i>${x.pctPrev != null && x.prev > 0 ? `<b class="previsto" style="left:${x.pctPrev}%"></b>` : ''}</span>
        <span class="meta-num num"><b>${x.atual == null ? '—' : x.atual}</b> de ${x.alvo} <span class="muted">${E(x.un)}</span></span><span class="meta-ver" aria-hidden="true"></span></summary>
      <div class="dx-meta-mais"><p class="mm-nota">${E(x.nota)}</p>${meta.id === 'M1' && d.selAprov ? `<p class="mm-nota">Seleção das beneficiárias (trabalho da equipe, antes da Meta 2): <b class="num">${d.selAprov.length}</b> de 200 selecionadas e aprovadas · ${d.fichas.length} ficha${d.fichas.length === 1 ? '' : 's'} lançada${d.fichas.length === 1 ? '' : 's'}.</p>` : ''}
        <dl class="mm-dados"><div><dt>Período</dt><dd>${MESES[meta.ini - 1]} a ${MESES[meta.fim - 1]}</dd></div>${x.pctPrev != null && mes - 1 >= meta.ini ? `<div><dt>Previsto até ${MESES[Math.max(0, mes - 2)]}</dt><dd class="num">${x.prev}</dd></div>` : ''}${meta.valor ? `<div><dt>Valor no plano</dt><dd class="num">${R.fmtBRL(meta.valor).replace(',00', '')}</dd></div>` : ''}</dl>${marcosDaMeta}</div>
    </details>`;
  }

  /* execução física do projeto: cada meta pesa o que o Plano de Trabalho destina a ela (não é média simples).
     Entram as metas com registro no sistema (M2, M3 e M4); M5 a M7 ainda são acompanhadas fora dele. */
  function execucaoGeral(S, d, mes) {
    const med = MQ.METAS.filter(m => m.valor && m.fonte && m.fonte !== 'equipe').map(m => infoMeta(m, S, d, mes)).filter(x => x.atual != null);
    const fora = MQ.METAS.filter(m => m.valor && !med.some(x => x.meta.id === m.id));
    const peso = med.reduce((t, x) => t + x.meta.valor, 0), pesoTot = MQ.METAS.reduce((t, m) => t + (m.valor || 0), 0);
    const real = peso ? med.reduce((t, x) => t + x.meta.valor * Math.min(1, x.atual / x.alvo), 0) / peso * 100 : 0;
    const prev = peso ? med.reduce((t, x) => t + x.meta.valor * Math.min(1, x.prev / x.alvo), 0) / peso * 100 : 0;
    const st = real >= 99.5 ? 'concluida' : real >= prev ? 'andamento' : real >= prev * 0.7 ? 'atencao' : 'atrasada';
    const fmt = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: v < 10 && v > 0 ? 1 : 0 });
    return { real, prev, st, peso, pesoTot, med, fora, html: `<div class="dx-exec">
      <span class="dx-rot">Execução física do projeto</span>
      <div class="dx-exec-num"><b class="num">${fmt(real)}%</b>${chipStatus(st, st === 'andamento' ? 'No ritmo' : st === 'atencao' ? 'Pouco abaixo do previsto' : st === 'atrasada' ? 'Abaixo do previsto' : null)}</div>
      <div class="medidor grosso" role="img" aria-label="Executado ${fmt(real)}%, previsto até o mês passado ${fmt(prev)}%"><i class="${STATUS[st].cls}" style="width:${Math.min(100, real)}%"></i>${prev > 0 ? `<b class="previsto" style="left:${Math.min(100, prev)}%"></b>` : ''}</div>
      <p class="dx-exec-sub"><span>previsto até ${MESES[Math.max(0, mes - 2)]}: <b class="num">${fmt(prev)}%</b></span><span>mês <b class="num">${mes}</b> de ${MESES.length}</span></p>
      <details class="dx-como"><summary>Como é calculado</summary><p>Média ponderada pelo valor que o Plano de Trabalho destina a cada meta: ${med.map(x => `${x.meta.id} (${R.fmtBRL(x.meta.valor).replace(',00', '')}): ${Math.round(Math.min(1, x.atual / x.alvo) * 100)}%`).join(' · ')}.
        Juntas, valem ${Math.round(peso / pesoTot * 100)}% do valor das metas com orçamento próprio. ${fora.length ? fora.map(m => m.id).join(', ') + ' ainda são registradas fora do sistema e não entram.' : ''} O traço é o previsto pelo cronograma até o mês passado. Bolsas, coordenação e despesas operacionais servem a todas as metas e não entram no cálculo.</p></details>
    </div>` };
  }

  /* ---------- mapa dos quintais (SVG próprio: funciona sem internet e sem serviço de mapas) ---------- */
  // as cores vão sempre em style="fill:…" (CSS): o Safari do iPad não aceita var(--…) no atributo fill/stroke e pintava tudo de uma cor só
  const CATS = [
    { id: 'aprovada', nome: 'Selecionada e aprovada', cor: 'var(--m-ok)' },
    { id: 'espera', nome: 'Lista de espera', cor: 'var(--m-espera)' },
    { id: 'aguardando', nome: 'Aguardando aprovação ou devolvida', cor: 'var(--m-aguarda)' },
    { id: 'sem_agua', nome: 'Sem água: encaminhada', cor: 'var(--m-agua)' }
  ];
  const catDe = f => f.resultado === 'sem_agua' ? 'sem_agua' : f.resultado === 'nao_atende' ? null
    : f.situacao !== 'aprovada' ? 'aguardando' : f.resultado === 'lista_espera' ? 'espera' : 'aprovada';
  const hash = t => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const K = Math.cos(9.5 * Math.PI / 180);                 // latitude média da área
  const px = ([lon, lat]) => [lon * K, -lat];
  function pontoDaFicha(f) {
    const dg = MQ.porCampo(MQ.ui && MQ.ui.S.diagnosticos, 'ficha_id', 'gps', x => x.latitude != null).get(f.id);
    if (dg) return { xy: px([+dg.longitude, +dg.latitude]), exato: true };   // GPS tirado no próprio quintal
    if (f.latitude != null && f.longitude != null) return { xy: px([+f.longitude, +f.latitude]), exato: true };
    const muns = (MQ.GEO.mun[f.uf]) || {};
    const chave = Object.keys(muns).find(m => norm(m) === norm(f.municipio));
    const base = chave ? muns[chave] : (MQ.GEO.uf[f.uf] || {}).c;
    if (!base) return null;
    const a = hash(f.id) * 2 * Math.PI, r = 0.04 + hash(f.id + 'r') * (chave ? 0.10 : 0.35);
    return { xy: px([base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r]), exato: false };
  }
  function caixa(ufs) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ufs.forEach(u => MQ.GEO.uf[u].r.forEach(anel => anel.forEach(p => { const [x, y] = px(p); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); })));
    const m = Math.max(x1 - x0, y1 - y0) * 0.06;
    return [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
  }
  const ULTIMO = { grupos: {}, foco: '' };
  /* Tamanho dos círculos do mapa. A área continua proporcional ao número de fichas, mas o conjunto encolhe por igual
     quando o volume cresce: (1) o maior círculo nunca passa de um teto; (2) nenhum círculo cobre o vizinho.
     Com poucas fichas (o plano de 200 quintais) nada muda: vale o coeficiente de sempre. Devolve n → raio.
     pontos: [{x, y, n}] · base e coef: raio = esc × (base + coef × √n) · teto: raio máximo, em unidades de esc. */
  function escalaRaios(pontos, esc, base, coef, teto) {
    const ps = pontos.filter(p => p.n > 0); if (!ps.length) return n => esc * (base + coef * Math.sqrt(n));
    let k = Math.min(coef, (teto - base) / Math.sqrt(Math.max(...ps.map(p => p.n))));
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const dist = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) / esc, soma = Math.sqrt(ps[i].n) + Math.sqrt(ps[j].n);
      if (2 * base + k * soma > dist * 0.96) k = Math.min(k, (dist * 0.96 - 2 * base) / soma);   // 4% de folga entre vizinhos
    }
    k = Math.max(k, Math.min(coef, 0.2));   // piso: abaixo disso o número não se lê; o que ainda encostar é afastado por espalhar()
    return n => esc * (base + k * Math.sqrt(n));
  }
  /* Municípios vizinhos ficam mais perto um do outro do que o menor círculo legível: encolher não basta. Aqui os círculos
     que ainda se tocam são afastados o mínimo necessário (cada um puxado de volta para o seu lugar), e quem saiu do lugar
     ganha um traço fino até o ponto verdadeiro. pontos: [{x, y, n}] → [{x, y, r, x0, y0, movido}] na mesma ordem. */
  function espalhar(pontos, raio, esc) {
    const ps = pontos.map(p => ({ x: p.x, y: p.y, x0: p.x, y0: p.y, r: raio(p.n) })); const folga = esc * 0.35;
    for (let volta = 0; volta < 120; volta++) { let mexeu = false;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); const quer = a.r + b.r + folga;
        if (d >= quer) continue;
        if (d < 1e-9) { const ang = (i * 2.399963) % (2 * Math.PI); dx = Math.cos(ang); dy = Math.sin(ang); d = 1; }   // mesmo ponto: separa num ângulo fixo
        const emp = (quer - d) / 2 + 1e-9, ux = dx / d, uy = dy / d; a.x -= ux * emp; a.y -= uy * emp; b.x += ux * emp; b.y += uy * emp; mexeu = true;
      }
      ps.forEach(p => { p.x += (p.x0 - p.x) * 0.03; p.y += (p.y0 - p.y) * 0.03; });   // puxa de volta: fica o mais perto possível do lugar certo
      if (!mexeu) break;
    }
    for (let volta = 0; volta < 40; volta++) { let mexeu = false;   // última passada só afastando: garante que nada fica por cima
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-9, quer = a.r + b.r + folga * 0.5;
        if (d >= quer) continue; const emp = (quer - d) / 2 + 1e-9; a.x -= dx / d * emp; a.y -= dy / d * emp; b.x += dx / d * emp; b.y += dy / d * emp; mexeu = true; }
      if (!mexeu) break; }
    ps.forEach(p => { p.movido = Math.hypot(p.x - p.x0, p.y - p.y0) > p.r * 0.6; });
    return ps;
  }
  // Fio até o lugar real: só quando o círculo foi afastado para longe (mais de 2,5 raios). Perto disso o fio e o ponto
  // de origem se amontoam em volta dos círculos (Alagoas, Sergipe) e parecem uma sombra cinza.
  const tracoAoLugar = (p, esc, r) => { if (!p.movido) return ''; const dx = p.x0 - p.x, dy = p.y0 - p.y, d = Math.hypot(dx, dy); if (!r || d <= r * 2.5) return '';
    return `<path d="M${p.x + dx / d * r},${p.y + dy / d * r}L${p.x0},${p.y0}" class="q-fio" stroke-width="${esc * 0.14}"/><circle cx="${p.x0}" cy="${p.y0}" r="${esc * 0.3}" class="q-fio-pt"/>`; };
  /* valores "redondos" para a legenda de tamanho, conforme o maior círculo do mapa */
  const redondo = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); const m = v / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  /* alfinete com broto (quintal): ponta em (x, y), cabeça de raio a */
  function alfinete(x, y, a, cor, cheio) {
    // 6 casas: no município o mapa inteiro mede ~0,3 grau (2 casas apagavam o desenho)
    const f = n => +n.toFixed(6), cy = y - 1.75 * a, lx = x - 0.82 * a, rx = x + 0.82 * a, py = cy + 0.57 * a;
    const pino = `<path d="M${f(x)},${f(y)}L${f(lx)},${f(py)}A${f(a)},${f(a)} 0 1 1 ${f(rx)},${f(py)}Z" style="fill:${cheio ? cor : 'var(--surface)'};stroke:${cheio ? 'var(--surface)' : cor}" stroke-width="${f(a * (cheio ? 0.16 : 0.24))}" stroke-linejoin="round" class="q-pino"/>`;
    const tinta = cheio ? '#fff' : cor, s = a * 0.62;
    const broto = `<g style="fill:${tinta};stroke:${tinta}" stroke-width="${f(a * 0.1)}" stroke-linecap="round" stroke-linejoin="round">`
      + `<path d="M${f(x)},${f(cy + 0.55 * s)}V${f(cy - 0.05 * s)}" fill="none" stroke-width="${f(a * 0.14)}"/>`
      + `<path d="M${f(x)},${f(cy + 0.05 * s)}Q${f(x - 0.95 * s)},${f(cy + 0.05 * s)} ${f(x - 0.9 * s)},${f(cy - 0.75 * s)}Q${f(x - 0.1 * s)},${f(cy - 0.7 * s)} ${f(x)},${f(cy + 0.05 * s)}Z"/>`
      + `<path d="M${f(x)},${f(cy - 0.12 * s)}Q${f(x + 0.95 * s)},${f(cy - 0.2 * s)} ${f(x + 0.95 * s)},${f(cy - 1 * s)}Q${f(x + 0.1 * s)},${f(cy - 0.95 * s)} ${f(x)},${f(cy - 0.12 * s)}Z"/></g>`;
    return pino + broto;
  }
  const iconeAlfinete = (cor, cheio) => `<svg class="lg-alf" viewBox="-7 -16 14 17" width="14" height="17" aria-hidden="true" focusable="false">${alfinete(0, 0, 5.4, cor, cheio)}</svg>`;
  const marcasTamanho = nMax => nMax <= 30 ? [5, 10, 20] : [...new Set([redondo(nMax / 10), redondo(nMax / 3), redondo(nMax)])];
  function mapa(S, d, op) {
    const RES = !!(op && op.resumo);   // resumo: o mesmo desenho, só com totais por município e sem clique (tela de quem acompanha de fora)
    /* 3 níveis: 5 estados (um círculo por município) → estado (círculo por município) → município (cada quintal) */
    const foco = S.mapaUF || '';
    const focoMun = foco && S.mapaMun && S.mapaMun.startsWith(foco + '|') ? S.mapaMun : '';
    const ufsProj = MQ.UFS.map(u => u.uf);
    const todos = d.fichas.map(f => ({ f, cat: catDe(f), p: pontoDaFicha(f) })).filter(x => x.cat && x.p && (!foco || x.f.uf === foco));
    const pts = focoMun ? todos.filter(x => x.f.uf + '|' + norm(x.f.municipio) === focoMun) : todos;
    let vb;
    if (focoMun && pts.length) {
      const xs = pts.map(x => x.p.xy[0]), ys = pts.map(x => x.p.xy[1]);
      const lado = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.12) * 1.35;
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      vb = [cx - lado / 2, cy - lado / 2, lado, lado];
    } else vb = caixa(foco ? [foco] : ufsProj);
    const esc = Math.max(vb[2], vb[3]) / 100;                // unidade de desenho proporcional ao zoom
    const exatos = pts.filter(x => x.p.exato).length;
    const ordem = ['sem_agua', 'aguardando', 'espera', 'aprovada'];
    pts.sort((a, b) => ordem.indexOf(a.cat) - ordem.indexOf(b.cat));
    const path = anel => 'M' + anel.map(p => px(p).map(v => v.toFixed(4)).join(',')).join('L') + 'Z';
    const estados = Object.entries(MQ.GEO.uf).filter(([uf]) => ufsProj.includes(uf)).map(([uf, g]) => {
      const destaque = foco ? uf === foco : true;
      return `<path d="${g.r.map(path).join('')}" class="${destaque ? 'uf-proj' : 'uf-viz'}${RES ? '' : ' uf-clic'}"${RES ? '' : ` data-acao="mapa-uf" data-uf="${uf}"`} stroke-width="${esc * 0.25}"><title>${U.nomeUF(uf)}</title></path>`;
    }).join('');
    const rotulos = foco ? '' : Object.entries(MQ.GEO.uf).filter(([uf]) => ufsProj.includes(uf)).map(([uf, g]) => {
      const [x, y] = px(g.c); return `<text x="${x}" y="${y}" class="uf-rot" font-size="${esc * 3.2}" text-anchor="middle">${uf}</text>`;
    }).join('');
    // agrupa por município (evita pontos empilhados)
    const grupos = {};
    todos.forEach(x => { const k = x.f.uf + '|' + norm(x.f.municipio); (grupos[k] = grupos[k] || { k, uf: x.f.uf, mun: x.f.municipio, itens: [] }).itens.push(x); });
    const lista = Object.values(grupos).sort((a, b) => b.itens.length - a.itens.length);
    if (!RES) { ULTIMO.grupos = grupos; ULTIMO.foco = foco; ULTIMO.geo = {}; }
    const baseDe = g => { const muns = MQ.GEO.mun[g.uf] || {}; const chave = Object.keys(muns).find(m => norm(m) === norm(g.mun));
      return { base: chave ? muns[chave] : (MQ.GEO.uf[g.uf] || {}).c, nome: chave || g.mun }; };
    const resumo = g => ordem.slice().reverse().map(id => [id, g.itens.filter(x => x.cat === id).length]).filter(([, q]) => q);
    // tamanho proporcional às fichas (área ~ número), com mínimo bem visível para o município de 1 ficha;
    // com muitas fichas os círculos encolhem juntos para não ficar um por cima do outro (escalaRaios)
    const centros = lista.map(g => { const b = baseDe(g).base; if (!b) return null; const [x, y] = px(b); return { x, y, n: g.itens.length, k: g.k }; }).filter(Boolean);
    const raio = escalaRaios(centros, esc, foco ? 1.3 : 1.0, foco ? 0.55 : 0.5, foco ? 9 : 5.5);
    const nMaior = Math.max(0, ...centros.map(c => c.n));
    const lugar = {}; if (!focoMun) espalhar(centros, raio, esc).forEach((p, i) => { lugar[centros[i].k] = p; });
    let marcas;
    if (!focoMun) {
      marcas = lista.map(g => {
        const { base, nome } = baseDe(g); if (!base) return '';
        const L = lugar[g.k] || {}; const [bx, by] = px(base); const cx = L.x != null ? L.x : bx, cy = L.y != null ? L.y : by; const n = g.itens.length; const R = raio(n);
        if (!RES) ULTIMO.geo[g.k] = { cx, cy, R };
        const por = resumo(g);
        let ang = -Math.PI / 2; const fatias = por.length === 1
          ? `<circle cx="${cx}" cy="${cy}" r="${R}" style="fill:${CATS.find(k => k.id === por[0][0]).cor}"/>`
          : por.map(([id, q]) => { const a0 = ang, a1 = ang + 2 * Math.PI * q / n; ang = a1;
              const p0 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)], p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
              return `<path d="M${cx},${cy}L${p0[0]},${p0[1]}A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0]},${p1[1]}Z" style="fill:${CATS.find(k => k.id === id).cor}"/>`; }).join('');
        const txt = `${nome}/${g.uf} · ${n} mulher${n > 1 ? 'es' : ''} com ficha: ${por.map(([id, q]) => q + ' ' + CATS.find(k => k.id === id).nome.toLowerCase()).join(', ')} · clique para ver ${foco ? 'cada quintal' : 'o estado'}`;
        // área de toque invisível maior que o círculo: no celular o dedo acerta mesmo em município pequeno
        if (RES) { const t2 = `${nome}/${g.uf}: ${n} mulher${n > 1 ? 'es' : ''} selecionada${n > 1 ? 's' : ''}`;
          return `<g class="q-fixo">${fatias}<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#fff" stroke-width="${esc * 0.22}"/><text x="${cx}" y="${cy + R * 0.34}" text-anchor="middle" font-size="${Math.min(R * (n > 9 ? 0.95 : 1.1), esc * 3)}" stroke-width="${Math.min(R * (n > 9 ? 0.95 : 1.1), esc * 3) * 0.07}" class="q-num">${n}</text><title>${E(t2)}</title></g>`; }
        return `<g class="q-pt q-grupo" data-acao="mapa-info" data-uf="${g.uf}" data-mun="${E(g.k)}" data-dica="${E(txt)}"><circle cx="${cx}" cy="${cy}" r="${Math.max(R, esc * (foco ? 4.5 : 3.8))}" fill="transparent" class="q-alvo"/>${tracoAoLugar(L, esc, R)}${fatias}<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#fff" stroke-width="${esc * 0.22}"/>
          <text x="${cx}" y="${cy + R * 0.34}" text-anchor="middle" font-size="${Math.min(R * (n > 9 ? 0.95 : 1.1), esc * 3)}" stroke-width="${(Math.min(R * (n > 9 ? 0.95 : 1.1), esc * 3)) * 0.07}" class="q-num">${n}</text><title>${E(txt)}</title></g>`;
      }).join('');
    } else {
      const r = esc * 1.4;
      // 15/10/2026: cada quintal é um alfinete com um broto dentro. A ponta marca o lugar; a cor é a situação da ficha;
      // cheio = GPS do quintal, vazado = posição aproximada. Os de baixo são desenhados por último (a ponta não fica escondida).
      marcas = pts.slice().sort((a, b) => a.p.xy[1] - b.p.xy[1]).map(({ f, cat, p }) => {
        const c = CATS.find(k => k.id === cat).cor; const [x, y] = p.xy;
        const txt = `${f.municipio}/${f.uf} · ${(MQ.RESULTADOS[f.resultado] || {}).nome}${f.situacao !== 'aprovada' ? ' (' + (MQ.SITUACOES[f.situacao] || {}).nome + ')' : ''}${p.exato ? '' : ' · posição aproximada'} · clique para abrir a ficha`;
        const alvo = `<circle cx="${x}" cy="${y - r * 2}" r="${r * 3.2}" fill="transparent" class="q-alvo"/>`;   // área de toque maior que o alfinete
        return `<g class="q-pt" data-acao="mapa-info" data-id="${E(f.id)}" data-exato="${p.exato ? '1' : ''}" data-dica="${E(txt)}">${alvo}${alfinete(x, y, r * 1.3, c, p.exato)}<title>${E(txt)}</title></g>`;
      }).join('');
    }
    const cont = {}; pts.forEach(x => { cont[x.cat] = (cont[x.cat] || 0) + 1; });
    // legenda de tamanho no próprio desenho (mesma escala dos círculos): 5, 10 e 20 fichas, no canto livre de baixo à esquerda
    const tamanhos = !foco && lista.length ? (() => { const Rn = raio; let x = vb[0] + esc * 5; const yb = vb[1] + vb[3] - esc * 7;
      return `<g class="q-tam" aria-hidden="true">${marcasTamanho(nMaior).map(n => { const r = Rn(n); const cx = x + r; x += 2 * r + esc * 3.2;
        return `<circle cx="${cx}" cy="${yb - r}" r="${r}" class="q-tam-c" stroke-width="${esc * 0.25}"/><text x="${cx}" y="${yb + esc * 3.6}" font-size="${esc * 2.6}" text-anchor="middle" class="q-tam-t">${n}</text>`; }).join('')}</g>`; })() : '';
    const nUF = new Set(todos.map(x => x.f.uf)).size;
    const naoAtende = d.fichas.filter(f => f.resultado === 'nao_atende' && (!foco || f.uf === foco) && (!focoMun || f.uf + '|' + norm(f.municipio) === focoMun)).length;
    const semLocal = foco ? 0 : d.fichas.filter(f => catDe(f) && !pontoDaFicha(f)).length; const foraMapa = foco ? 0 : naoAtende + semLocal;
    const btn = (uf, t) => `<button type="button" data-acao="mapa-uf" data-uf="${uf}" aria-pressed="${foco === uf && !focoMun}">${t}</button>`;
    const nomeMun = focoMun && grupos[focoMun] ? baseDe(grupos[focoMun]).nome : '';
    // no município o desenho fica todo dentro do estado: um mapa pequeno mostra o contorno do estado e onde fica o município
    const localizador = (() => { if (!focoMun || !MQ.GEO.uf[foco]) return '';
      const v2 = caixa([foco]); const e2 = Math.max(v2[2], v2[3]) / 100; const g = grupos[focoMun]; const b = g && baseDe(g).base; const [mx, my] = b ? px(b) : [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
      return `<figure class="mapa-local" aria-label="${E(nomeMun)} no mapa de ${E(U.nomeUF(foco))}"><svg viewBox="${v2.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path d="${MQ.GEO.uf[foco].r.map(path).join('')}" class="ml-uf" stroke-width="${e2 * 0.9}"/>
          <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" class="ml-janela" stroke-width="${e2 * 0.7}"/>
          <circle cx="${mx}" cy="${my}" r="${e2 * 3.4}" class="ml-pt" stroke-width="${e2 * 1}"/></svg>
        <figcaption>${E(nomeMun)} · ${foco}</figcaption></figure>`; })();
    const onde = focoMun ? E(nomeMun) + '/' + foco : foco ? E(U.nomeUF(foco)) : 'nos 5 estados';
    // 66: no município, a lista das mulheres (com a situação) faz o mesmo que tocar no alfinete: dá para abrir a ficha pelo teclado e o leitor de tela lê
    const fichasMun = focoMun && pts.length ? `<div class="mun-lista q-lista"><h3 class="mapa-h3">Mulheres neste município</h3>
        ${pts.slice().sort((a, b) => String(a.f.nome || '').localeCompare(String(b.f.nome || ''), 'pt-BR')).map(({ f, cat, p }) => { const k = CATS.find(x => x.id === cat);
          return `<button type="button" class="link" data-acao="mapa-info" data-id="${E(f.id)}" data-exato="${p.exato ? '1' : ''}"><span class="lg-pt" style="background:${k.cor}" aria-hidden="true"></span><span>${E(f.nome_social || f.nome || 'Ficha')}<small class="muted"> · ${E(k.nome)}${p.exato ? '' : ' · posição aproximada'}</small></span></button>`; }).join('')}</div>` : '';
    const munLista = !focoMun && lista.length ? `<div class="mun-lista"><h3 class="mapa-h3">${foco ? 'Municípios' : 'Municípios com mais fichas'}</h3>
        ${lista.slice(0, foco ? 20 : 8).map(g => `<button type="button" class="link" data-acao="mapa-mun" data-uf="${g.uf}" data-mun="${E(g.k)}"><span>${E(baseDe(g).nome)}${foco ? '' : '/' + g.uf}</span><i class="pontilhado" aria-hidden="true"></i><b class="num">${g.itens.length}</b></button>`).join('')}</div>` : '';
    if (RES) return `<div class="mapa-caixa mapa-resumo"><svg class="mapa" viewBox="${vb.join(' ')}" role="img" aria-label="Mapa com ${pts.length} mulheres selecionadas em ${lista.length} municípios de ${nUF} estados" preserveAspectRatio="xMidYMid meet">${estados}${rotulos}${marcas}${tamanhos}</svg></div>${tamanhos ? '<p class="mapa-tam-nota">Cada círculo é um município; o número e o tamanho mostram quantas mulheres foram selecionadas ali.</p>' : ''}`;
    return `<section class="secao dx-mapa" aria-labelledby="t-mapa">
      <div class="secao-cab"><div><h2 id="t-mapa">Onde estão os quintais produtivos</h2>
        <p>${pts.length ? (foco ? `${pts.length} mulher${pts.length > 1 ? 'es' : ''} com ficha ${onde}${focoMun ? ` · ${exatos} com localização do GPS, ${pts.length - exatos} aproximada${pts.length - exatos === 1 ? '' : 's'}` : ''}`
          : `${pts.length} mulher${pts.length > 1 ? 'es' : ''} com ficha válida em ${nUF} estado${nUF === 1 ? '' : 's'} do Nordeste · ${d.fichas.length} fichas lançadas${foraMapa ? ` (${foraMapa} fora do mapa: ${naoAtende ? naoAtende + ' não atende' + (naoAtende > 1 ? 'm' : '') + ' aos critérios' : ''}${naoAtende && semLocal ? ', ' : ''}${semLocal ? semLocal + ' sem município reconhecido' : ''})` : ''}`) : 'Cada ficha lançada aparece aqui.'}</p></div>
        <span class="seg" role="group" aria-label="Estado no mapa">${btn('', 'Todos')}${MQ.UFS.map(u => btn(u.uf, u.uf)).join('')}</span></div>
      ${foco ? `<nav class="migalha" aria-label="Onde você está no mapa">
        <button type="button" data-acao="mapa-uf" data-uf=""><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>5 estados</button>
        ${focoMun ? `<span aria-hidden="true">›</span><button type="button" data-acao="mapa-uf" data-uf="${foco}">${E(U.nomeUF(foco))}</button><span aria-hidden="true">›</span><b aria-current="page">${E(nomeMun)}</b>`
          : `<span aria-hidden="true">›</span><b aria-current="page">${E(U.nomeUF(foco))}</b>`}</nav>` : ''}
      <div class="mapa-caixa">
        <svg class="mapa" viewBox="${vb.join(' ')}" role="img" aria-label="Mapa com ${pts.length} quintais ${onde}" preserveAspectRatio="xMidYMid meet">
          ${estados}${rotulos}${marcas}${tamanhos}
        </svg>
        <div class="mapa-dica" id="mapa-dica" hidden></div>
        <div class="mapa-cartao" id="mapa-cartao" role="dialog" aria-label="Informações do ponto" hidden></div>
        <div class="mapa-lado">
        ${localizador}
        ${pts.length ? `<div class="mapa-destaque"><b class="num">${pts.length}</b><span>mulher${pts.length > 1 ? 'es' : ''}</span><small>${foco ? 'com ficha em ' + onde : 'com ficha válida · ' + nUF + ' estado' + (nUF === 1 ? '' : 's') + ' do Nordeste'}</small></div>` : ''}
        <h3 class="mapa-h3">Status das fichas</h3>
        <ul class="legenda">${CATS.map(k => `<li>${focoMun ? iconeAlfinete(k.cor, true) : `<span class="lg-pt" style="background:${k.cor}"></span>`}${E(k.nome)} <b class="num">${cont[k.id] || 0}</b></li>`).join('')}
          ${focoMun ? `<li>${iconeAlfinete('var(--ink-2)', false)}Alfinete vazado: posição aproximada (sem GPS)</li>` : ''}
          ${naoAtende ? `<li class="muted">${naoAtende} que não atende${naoAtende > 1 ? 'm' : ''} aos critérios fica${naoAtende > 1 ? 'm' : ''} fora do mapa</li>` : ''}</ul>
        ${munLista}${fichasMun}</div>
      </div>
      ${tamanhos ? '<p class="mapa-tam-nota">Cada círculo representa um município. O tamanho indica o número de fichas/mulheres (exemplos no canto do mapa: ' + marcasTamanho(nMaior).join(', ').replace(/, ([^,]*)$/, ' e $1') + '). Com muitas fichas, os círculos diminuem juntos; município vizinho de outro é afastado e ligado ao seu lugar por um traço.</p>' : ''}
      <p class="nota">O mapa mostra onde moram as mulheres: use só dentro do sistema. Em relatórios e divulgação, mostre números por município.</p>
    </section>`;
  }

  // 15/10/2026: a regra das cores das barras, dita na própria tela (linha miúda embaixo de cada painel)
  const LEG_META = '<p class="leg-cores"><i class="lc-ok" aria-hidden="true"></i>verde: meta cumprida <i class="lc-falta" aria-hidden="true"></i>cinza: ainda falta</p>';
  const LEG_RETRATO = '<p class="leg-cores"><i class="lc-ret" aria-hidden="true"></i>marrom: parte do grupo (retrato, não é meta)</p>';
  /* ---------- perfil das mulheres (recorte) e linha de base de renda ---------- */
  function perfil(S, d) {
    const base = d.selAprov.length ? d.selAprov : d.fichas.filter(f => f.resultado === 'selecionada');
    const rotBase = d.selAprov.length ? 'das ' + base.length + ' selecionadas e aprovadas' : 'das ' + base.length + ' fichas marcadas como selecionadas (ainda sem aprovação)';
    const itens = [
      ['p_cadunico', 'Família no CadÚnico'], ['p_sustento', 'Principal responsável pelo sustento'], ['p_sem_ater', 'Sem assistência técnica (ATER)'],
      ['p_grupo', 'Participa de grupo, associação ou MPA'], ['p_raca_povo', 'Negra, indígena, quilombola ou de comunidade tradicional'],
      ['p_caf', 'Com CAF'], ['p_jovem', 'Jovem de 18 a 29 anos']
    ];
    // 15/10/2026: do maior para o menor; o percentual em destaque à direita, a barra embaixo do nome (todas alinhadas) e a contagem miúda
    const barras = base.length ? itens.map(([k, t]) => { const n = base.filter(f => f[k]).length; return [t, n, Math.round(n / base.length * 100)]; })
      .sort((a, b) => b[1] - a[1]).map(([t, n, pct]) =>
        `<li><span class="pf2-rot">${E(t)}</span><b class="num pf2-pc">${pct}%</b><span class="pf2-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="pf2-n">${n} de ${base.length} mulheres</span></li>`).join('') : '';
    const diags = (S.diagnosticos || []).filter(x => x.renda_quintal != null || x.renda_familiar != null);
    const mediana = arr => { const a = arr.filter(v => v != null && !isNaN(v)).map(Number).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const mq = mediana(diags.map(x => x.renda_quintal)), mf = mediana(diags.map(x => x.renda_familiar));
    // linha de base (bloco 4b do diagnóstico) e, quando houver, a avaliação final
    // com avaliações, as duas colunas usam só os quintais medidos duas vezes (comparar grupos diferentes engana)
    const avs = S.avaliacoes || [];
    const pares = avs.map(a => { const dg = MQ.porCampo(S.diagnosticos, 'ficha_id').get(a.ficha_id); const i0 = dg && dg.dados && dg.dados.impacto, i1 = a.dados && a.dados.impacto;
      return i0 && i1 && i0.ebia_nivel && i1.ebia_nivel ? [i0, i1] : null; }).filter(Boolean);
    const temDepois = pares.length >= 5;   // 66: o "hoje" aparece a partir de 5 mulheres avaliadas (com 1 a 4, o percentual engana e pode identificar)
    const imps = temDepois ? pares.map(x => x[0]) : (S.diagnosticos || []).map(x => x.dados && x.dados.impacto).filter(x => x && x.ebia_nivel);
    const impsD = pares.map(x => x[1]);
    const nImp = imps.length, nAv = pares.length;
    const pc = (l, fn) => l.length ? Math.round(l.filter(fn).length / l.length * 100) : null;   // 66: lista vazia (ninguém vende, por exemplo) dá "—", não 0%
    const md = (l, k) => { const v = l.map(x => x[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
    const avPar = avs.filter(a => MQ.porCampo(S.diagnosticos, 'ficha_id', 'renda', x => x.renda_quintal != null).has(a.ficha_id) && a.dados && a.dados.renda_quintal != null);
    const mqD = avPar.length ? mediana(avPar.map(a => a.dados.renda_quintal)) : null;
    const mqA = avPar.length ? mediana(avPar.map(a => (MQ.porCampo(S.diagnosticos, 'ficha_id').get(a.ficha_id) || {}).renda_quintal)) : null;
    const razoes = diags.filter(x => +x.renda_familiar > 0 && x.renda_quintal != null).map(x => x.renda_quintal / x.renda_familiar);
    const pesoQ = razoes.length ? Math.round(mediana(razoes) * 100) : null;
    const nSemAgua = (S.diagnosticos || []).filter(x => x.sem_agua).length;
    // [indicador, início, hoje, unidade, "melhor quando sobe"]
    const linhasPP = nImp ? [
      ['Em insegurança alimentar (EBIA)', pc(imps, x => x.ebia_nivel !== 'seguranca'), pc(impsD, x => x.ebia_nivel !== 'seguranca'), '%', false],
      ['Insegurança moderada ou grave', pc(imps, x => ['moderada', 'grave'].includes(x.ebia_nivel)), pc(impsD, x => ['moderada', 'grave'].includes(x.ebia_nivel)), '%', false],
      ['Dias por semana comendo do quintal', md(imps, 'dias_consumo'), md(impsD, 'dias_consumo'), 'd', true],
      ['Vendem ou trocam o que produzem', pc(imps, x => x.vende), pc(impsD, x => x.vende), '%', true],
      ['Decidem sobre o dinheiro da venda (entre as que vendem)', pc(imps.filter(x => x.vende), x => ['ela', 'ela_e_outro'].includes(x.decide)), pc(impsD.filter(x => x.vende), x => ['ela', 'ela_e_outro'].includes(x.decide)), '%', true]
    ] : [];
    const fmtV = (v, u) => v == null ? '—' : u === '%' ? v + '%' : v.toLocaleString('pt-BR') + (u === 'd' ? (v === 1 ? ' dia' : ' dias') : '');
    const mudanca = (a, b, u, sobe) => { if (a == null || b == null) return '<span class="pp2-chip">—</span>'; const dlt = Math.round((b - a) * 10) / 10;
      if (!dlt) return '<span class="pp2-chip">igual</span>';
      const bom = sobe ? dlt > 0 : dlt < 0, txt = (dlt > 0 ? '+' : '−') + Math.abs(dlt).toLocaleString('pt-BR') + (u === '%' ? ' p.p.' : u === 'd' ? (Math.abs(dlt) === 1 ? ' dia' : ' dias') : '');
      return `<span class="pp2-chip ${bom ? 'bom' : 'ruim'}"><span aria-hidden="true">${dlt > 0 ? '▲' : '▼'}</span> ${txt}<span class="so-leitor"> (${bom ? 'melhorou' : 'piorou'})</span></span>`; };
    const brl = v => v == null ? '—' : R.fmtBRL(v).replace(',00', '');
    const kpiQ = mqD != null
      ? `<div class="pp2-kpi"><span class="pp2-k-rot">Renda com o quintal</span><span class="pp2-k-val"><span class="pp2-antes">${brl(mqA)}</span><span class="pp2-seta" aria-hidden="true">→</span><b class="num">${brl(mqD)}</b></span><span class="pp2-k-sub">mediana por mês, ${avPar.length === 1 ? 'no quintal avaliado' : 'nos ' + avPar.length + ' quintais avaliados'} (antes → hoje)</span></div>`
      : `<div class="pp2-kpi"><span class="pp2-k-rot">Renda com o quintal</span><span class="pp2-k-val"><b class="num">${brl(mq)}</b></span><span class="pp2-k-sub">mediana por mês, no diagnóstico</span></div>`;
    const kpiF = `<div class="pp2-kpi"><span class="pp2-k-rot">Renda da família</span><span class="pp2-k-val"><b class="num">${brl(mf)}</b></span><span class="pp2-k-sub">mediana por mês${pesoQ != null ? ` · o quintal é <b>${pesoQ}%</b> dela` : ''}</span></div>`;
    const tabPP = linhasPP.length ? `<table class="pp2-tab${temDepois ? ' com-hoje' : ''}"><thead><tr><th scope="col">Indicador</th><th scope="col">No início</th>${temDepois ? '<th scope="col">Hoje</th><th scope="col">Mudança</th>' : ''}</tr></thead><tbody>
      ${linhasPP.map(([t, a1, d1, u, sobe]) => `<tr><th scope="row">${E(t)}</th><td class="num">${fmtV(a1, u)}</td>${temDepois ? `<td class="num"><b>${fmtV(d1, u)}</b></td><td>${mudanca(a1, d1, u, sobe)}</td>` : ''}</tr>`).join('')}</tbody></table>` : '';
    return `<section class="secao" aria-labelledby="t-perfil">
      <div class="secao-cab"><div><h2 id="t-perfil">Quem são as mulheres</h2><p>${base.length ? 'Percentual ' + rotBase + ', pelos critérios de prioridade da ficha.' : 'Aparece quando houver mulheres selecionadas.'}</p></div></div>
      <div class="duas-col perfil-cols">
        <div class="bloco">${base.length ? `<ul class="perfil2">${barras}</ul>
          <p class="nota">"Negra, indígena, quilombola ou de comunidade tradicional" é uma única pergunta na ficha: não dá para separar quilombolas.</p>${LEG_RETRATO}` : '<p class="muted">Sem dados ainda.</p>'}</div>
        <div class="bloco pp2"><h3>Ponto de partida${temDepois ? ' e hoje' : ''}</h3>
          ${diags.length ? `<div class="pp2-kpis">${kpiQ}${kpiF}</div>${tabPP}
            ${nSemAgua ? `<p class="pp2-agua"><b>${nSemAgua}</b> diagnóstico${nSemAgua > 1 ? 's' : ''} sem água que dure na seca: não recebe${nSemAgua > 1 ? 'm' : ''} kit e precisa${nSemAgua > 1 ? 'm' : ''} de cisterna.</p>` : ''}
            <p class="nota">${temDepois ? `Início e hoje medidos ${nAv === 1 ? 'na mesma mulher' : 'nas mesmas ' + nAv + ' mulheres'} (as que já tiveram a avaliação final). Verde = melhorou; vermelho = piorou (a seta mostra se o número subiu ou desceu). Detalhe por estado na aba Campo.`
              : nImp ? `Linha de base de ${nImp} diagnóstico${nImp > 1 ? 's' : ''}. O "hoje" aparece quando as avaliações finais (5ª visita) forem registradas.` : 'As medidas de fome, consumo e autonomia aparecem quando os diagnósticos tiverem o bloco "4b".'}</p>`
            : '<p class="small muted">Vem do diagnóstico (1ª visita): renda, fome (EBIA), consumo do quintal, venda e água. Aparece quando os diagnósticos forem registrados.</p>'}</div>
      </div></section>`;
  }

  /* equipe de execução: quem são e de onde partem (perfil no campo do cadastro) */
  function equipeExec(S) {
    const ativos = (S.equipe || []).filter(m => m.status === 'ativa' && m.papel !== 'coord_geral');
    const campo = ativos.filter(m => ['coord_tecnico', 'articulacao', 'apoio', 'agente'].includes(m.papel));
    const conta = p => ativos.filter(m => m.papel === p).length;
    const bols = conta('articulacao') + conta('apoio');
    const habil = ativos.filter(m => R.habilitado(m)).length;
    const perfis = new Map((S.perfisEquipe || []).filter(x => x.perfil).map(x => [x.equipe_id, x.perfil]));
    const resp = campo.filter(m => perfis.has(m.id)).map(m => perfis.get(m.id));
    // 15/10/2026: mesmo desenho do "Quem são as mulheres": percentual em destaque, barra embaixo e "x de y" miúdo
    const pc = (fn) => { const v = resp.filter(p => fn(p) != null); return v.length ? { n: v.filter(p => fn(p) === true).length, de: v.length } : null; };
    const leram = ativos.filter(m => ['articulacao', 'apoio', 'agente'].includes(m.papel));
    const nLeram = leram.filter(m => (S.ciencias || []).some(c => c.equipe_id === m.id)).length;
    const linhas = [
      ['São agricultoras', pc(p => p.agricultora)],
      ['Atuam junto às mulheres rurais do território', pc(p => p.atua_mulheres)],
      ['Moram na zona rural', pc(p => p.mora_rural)],
      ['Mais de 5 anos com agricultura familiar ou agroecologia', pc(p => p.experiencia ? p.experiencia === 'mais5' : null)],
      ['Têm celular com internet', pc(p => p.internet)]
    ];
    const outraBolsa = pc(p => p.outra_bolsa);
    const barraPf = (t, x) => { if (!x) return `<li><span class="pf2-rot">${E(t)}</span><b class="num pf2-pc">—</b><span class="pf2-n">ninguém respondeu</span></li>`;
      const pct = Math.round(x.n / x.de * 100);
      return `<li><span class="pf2-rot">${E(t)}</span><b class="num pf2-pc">${pct}%</b><span class="pf2-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="pf2-n">${x.n} de ${x.de} pessoa${x.de === 1 ? '' : 's'}</span></li>`; };
    // composição: "x de y" com barra onde a função tem número de vagas; agentes não têm limite
    const vaga = (t, n, de, sub) => { const pct = de ? Math.min(100, Math.round(n / de * 100)) : 0, ok = de && n >= de;
      return `<li><span class="ex2-rot">${E(t)}</span><span class="ex2-v"><b class="num">${n}</b>${de ? ` de ${de}` : ''}</span>`
        + (de ? `<span class="ex2-bar" aria-hidden="true"><i class="${ok ? 'cheio' : ''}" style="width:${pct}%"></i></span>` : '')
        + (sub ? `<span class="ex2-sub">${sub}</span>` : '') + '</li>'; };
    const pcHab = ativos.length ? Math.round(habil / ativos.length * 100) : 0;
    return `<section class="secao" aria-labelledby="t-exec">
      <div class="secao-cab"><div><h2 id="t-exec">Quem é a equipe de execução</h2><p>Pessoas ativas no projeto, sem a coordenação geral. O perfil no campo vem do cadastro (coordenação técnica, bolsistas e agentes).</p></div></div>
      <div class="duas-col perfil-cols">
        <div class="bloco pp2"><h3>Composição</h3>
          <div class="pp2-kpis">
            <div class="pp2-kpi"><span class="pp2-k-rot">Pessoas na equipe</span><span class="pp2-k-val"><b class="num">${ativos.length}</b></span><span class="pp2-k-sub">ativas, de todas as funções</span></div>
            <div class="pp2-kpi"><span class="pp2-k-rot">Habilitadas</span><span class="pp2-k-val"><b class="num">${habil}</b><span class="pp2-antes-n">de ${ativos.length}</span></span>
              <span class="ex2-bar" aria-hidden="true"><i class="${ativos.length && habil >= ativos.length ? 'cheio' : ''}" style="width:${pcHab}%"></i></span>
              <span class="pp2-k-sub">${!ativos.length ? 'ninguém cadastrado ainda' : habil >= ativos.length ? 'todas prontas para trabalhar e receber' : (ativos.length - habil) + ' ainda sem habilitação completa (todas as funções, com as agentes)'}</span></div></div>
          <ul class="ex2">
            ${vaga('Bolsistas (articulação e apoio estadual)', bols, 10, '2 por estado')}
            ${vaga('Coordenação técnica', conta('coord_tecnico'), 1)}
            ${vaga('Professores do curso FIC', conta('professor_fic'), R.MAX_PROFESSORES || 2)}
            ${vaga('Auxiliar administrativo', conta('auxiliar_adm'), 1)}
            ${vaga('Agentes de campo', conta('agente'), 0, 'sem limite por estado')}
          </ul>
          ${leram.length ? (nLeram >= leram.length
            ? `<p class="ex2-guia ok"><b>Todas leram o guia</b> (${leram.length} bolsistas e agentes).</p>`
            : `<p class="ex2-guia"><b>${leram.length - nLeram} de ${leram.length}</b> bolsistas e agentes ainda não marcaram que leram o guia.</p>`) : ''}${LEG_META}</div>
        <div class="bloco"><h3>Ponto de partida da equipe</h3>
          ${resp.length ? `<ul class="perfil2">${linhas.map(([t, x]) => barraPf(t, x)).join('')}</ul>
            ${outraBolsa && outraBolsa.n ? `<p class="pp2-agua"><b>${outraBolsa.n} pessoa${outraBolsa.n > 1 ? 's' : ''}</b> já recebe${outraBolsa.n > 1 ? 'm' : ''} outra bolsa: confira se pode acumular antes de pagar.</p>` : ''}
            <p class="nota">${resp.length} de ${campo.length} pessoa${campo.length > 1 ? 's' : ''} da equipe de campo responderam o perfil${outraBolsa && !outraBolsa.n ? '; nenhuma recebe outra bolsa' : ''}. O Guia pede bolsistas mulheres, de preferência agricultoras ou com atuação junto às mulheres do território.</p>${LEG_RETRATO}`
            : `<p class="small muted">${S.perfisSemBanco ? 'O perfil no campo ainda não está instalado no servidor (rode o 19_entregas_do_mes.sql).' : 'Aparece quando a coordenação técnica, as bolsistas e as agentes responderem o perfil no campo no cadastro (pelo link é obrigatório).'}</p>`}</div>
      </div></section>`;
  }

  function visaoGeral(S) {
    const d = dados(S);
    const mes = mesDoProjeto();
    const diasFim = R.diasAte(MQ.PROJETO.vigencia.fim);
    const ORD_N = { crit: 0, pend: 1, info: 2 }; const al = alertas(S, d).map((x, i) => [x, i]).sort((a, b) => ORD_N[a[0].nivel] - ORD_N[b[0].nivel] || a[1] - b[1]).map(x => x[0]);   // o mais grave primeiro
    const feito = { equipe: () => d.pagaveis.length >= 11, diagnostico_inicio: () => (S.diagnosticos || []).length > 0, M2: () => (S.diagnosticos || []).length >= 200 };
    const marcos = MQ.MARCOS.filter(m => R.diasAte(m.d) >= -7 && !(m.feito && feito[m.feito] && feito[m.feito]())).slice(0, 4);   // marco já cumprido sai da lista
    const aguard = d.fichas.filter(f => f.situacao === 'aguardando').length;
    const NOME_ABA = { equipe: 'Equipe', selecao: 'Seleção', campo: 'Campo', custos: 'Custos', historico: 'Histórico', visao: 'Visão geral' };
    const NIVEL = { crit: ['st-atr', 'Requer ação'], pend: ['st-aten', 'Atenção'], info: ['st-nao', 'Aviso'] };
    const ex = execucaoGeral(S, d, mes);
    const dg = S.diagnosticos || [];
    const impl = (S.visitas || []).filter(v => v.etapa === 'implantacao' && v.situacao === 'realizada').length;
    const acomp = (S.visitas || []).filter(v => v.etapa === 'acompanhamento' && v.situacao === 'realizada').length;
    /* indicador do painel de execução física: anel com o percentual, número sobre o previsto, barra, "% concluído" e complemento.
       A cor (k1 a k4) só diferencia os indicadores; o anel e a barra são decorativos para o leitor de tela, que lê o texto. */
    const kpi = (k, n, de, rot, sub) => { const pc = Math.max(0, Math.min(100, n / de * 100)), pr = Math.round(pc), C = 2 * Math.PI * 18;
      return `<div class="dx-kpi k${k}"><div class="dx-kpi-topo"><span class="dx-anel" aria-hidden="true"><svg viewBox="0 0 44 44" width="52" height="52" focusable="false"><circle cx="22" cy="22" r="18" class="tr"/><circle cx="22" cy="22" r="18" class="pg${pc > 0 ? '' : ' vazio'}" stroke-dasharray="${(C * pc / 100).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 22 22)"/></svg><b class="num">${pr}%</b></span>
          <span class="dx-kpi-n num"><b>${n}</b><small> / ${de}</small></span></div><span class="dx-kpi-r">${rot}</span>
        <span class="medidor fino" aria-hidden="true"><i style="width:${pc}%"></i></span><span class="dx-kpi-p"><b class="num">${pr}%</b> concluído</span>${sub ? `<span class="dx-kpi-s">${sub}</span>` : ''}</div>`; };
    const stK = (n, de, ini) => n >= de ? 'concluida' : n > 0 ? 'andamento' : 'nao';
    const prazoTxt = x => !x.prazo ? '—' : x.prazo === 'imediato' ? 'Imediato' : `${R.fmtData(x.prazo)}<small>${R.diasAte(x.prazo) < 0 ? 'venceu há ' + (-R.diasAte(x.prazo)) + ' dia' + (R.diasAte(x.prazo) === -1 ? '' : 's') : R.diasAte(x.prazo) === 0 ? 'hoje' : 'em ' + R.diasAte(x.prazo) + ' dia' + (R.diasAte(x.prazo) === 1 ? '' : 's')}</small>`;
    const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `
      <header class="dx-cab"><div><span class="eyebrow">Mulheres &amp; Quintais</span><h1>Execução do projeto</h1>
        <p>Mês ${mes} de ${MESES.length} (${MESES[mes - 1]}) · vigência até ${R.fmtData(MQ.PROJETO.vigencia.fim)}${diasFim > 0 ? ' · faltam ' + diasFim + ' dias' : diasFim === 0 ? ' · último dia' : ' · encerrada'}</p></div>
        <div class="cab-lado">
          <div class="linha-tempo-mini" role="img" aria-label="Mês ${mes} de ${MESES.length} do projeto">${MESES.map((m, i) => `<span class="${i + 1 < mes ? 'passou' : i + 1 === mes ? 'agora' : ''}" title="${m}"></span>`).join('')}</div>
          ${(MQ.ui.S.eu || {}).papel === 'coord_geral' ? `<a class="atalho" href="${E(MQ.PAINEL_FINANCEIRO)}" target="_blank" rel="noopener">
            <span class="atalho-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>
            <span><b>Financeiro e entregas</b><span class="small muted">Recursos, rubricas e metas físicas</span></span>
            <span class="atalho-seta" aria-hidden="true">↗</span></a>` : ''}
        </div></header>

      ${al.length ? `<button type="button" class="ir-atencao ${al.some(x => x.nivel === 'crit') ? 'crit' : 'pend'}" data-acao="ir-atencao">${al.length} ${al.length === 1 ? 'item pede' : 'itens pedem'} atenção <span aria-hidden="true">↓</span></button>` : ''}
      <section class="dx-topo" aria-label="Indicadores principais">
        ${ex.html}
        <div class="dx-kpis">
          ${kpi(1, d.selAprov.length, 200, 'mulheres selecionadas e aprovadas', `${d.fichas.length} ficha${d.fichas.length === 1 ? ' lançada' : 's lançadas'}${aguard ? ' · ' + aguard + ' aguardando' : ''}`)}
          ${kpi(2, dg.length, 200, 'diagnósticos', `${dg.filter(x => x.situacao === 'aprovado' && !x.sem_agua).length} com plano aprovado`)}
          ${kpi(3, impl, 200, 'quintais implantados', `${impl} ${impl === 1 ? 'quintal implantado' : 'quintais implantados'}`)}
          ${kpi(4, acomp, 400, 'visitas de acompanhamento', `${acomp} ${acomp === 1 ? 'visita realizada' : 'visitas realizadas'}`)}
        </div>
      </section>
      ${MQ.prontidaoUI ? MQ.prontidaoUI.secao() : ''}

      <section class="secao dx-atencao dx-topo-${al.some(x => x.nivel === 'crit') ? 'crit' : al.some(x => x.nivel === 'pend') ? 'pend' : 'ok'}" aria-labelledby="t-alertas">
        <div class="secao-cab"><div><h2 id="t-alertas">O que pede atenção</h2></div>${al.length ? `<span class="dx-conta">${[['crit', n => n === 1 ? 'requer ação' : 'requerem ação'], ['pend', () => 'atenção'], ['info', n => n === 1 ? 'aviso' : 'avisos']].map(([k, r]) => { const n = al.filter(x => x.nivel === k).length; return n ? `<span class="dx-ct dx-ct-${k}"><b class="num">${n}</b> ${r(n)}</span>` : ''; }).filter(Boolean).join('<span class="so-leitor"> · </span>')}</span>` : ''}</div>
        ${al.length ? `<div class="dx-tab" role="table" aria-label="Pendências">
          <div class="dx-tr dx-th" role="row"><span role="columnheader">Problema</span><span role="columnheader">Prazo</span><span role="columnheader"><span class="sr">Ação</span></span></div>
          ${al.map(x => `<div class="dx-tr dx-n-${x.nivel}" role="row"><span role="cell" class="dx-prob"><span class="st-pt ${NIVEL[x.nivel][0]}" aria-hidden="true"></span><span><span class="dx-selo dx-selo-${x.nivel}">${NIVEL[x.nivel][1]}</span><span class="sr">: </span><b>${E(x.texto)}</b><small>${E(x.det)}</small></span></span>
            <span role="cell" class="dx-prazo num">${prazoTxt(x)}</span>
            <span role="cell">${x.aba ? MQ.botaoAcao({ acao: 'aba', texto: x.nivel === 'info' ? 'Consultar' : 'Resolver', icone: x.nivel === 'info' ? 'ver' : 'resolver', sec: x.nivel === 'info', mini: true, cls: 'dx-ir', rotulo: `${x.nivel === 'info' ? 'Consultar' : 'Resolver'}: ${E(x.texto)} (abre ${NOME_ABA[x.aba] || x.aba})`, attrs: `data-aba="${x.aba}" title="Abre ${NOME_ABA[x.aba] || x.aba}"` }) : ''}</span></div>`).join('')}
        </div>` : `<p class="dx-ok">${chipStatus('concluida', 'Nada pendente')} nos dados do sistema.</p>`}
      </section>

      <div class="dx-duas">
        <section class="secao" aria-labelledby="t-metas">
          <div class="secao-cab"><div><h2 id="t-metas">Metas do plano de trabalho</h2><p>Barra: realizado · traço: previsto até o mês passado · toque na meta para ver o detalhe</p></div></div>
          <div class="dx-metas">
            ${linhaMeta(MQ.METAS[0], S, d, mes)}
            ${MQ.METAS.filter(m => m.fonte && m.fonte !== 'equipe').map(m => linhaMeta(m, S, d, mes)).join('')}
            ${MQ.METAS.filter(m => !m.fonte).map(m => linhaMeta(m, S, d, mes)).join('')}
          </div>
        </section>
        <div class="dx-lado">
          <section class="secao" aria-labelledby="t-marcos">
            <h2 id="t-marcos">Próximos marcos</h2>
            ${marcos.length ? '' : '<p class="muted">Nenhum marco pendente: os do plano já foram cumpridos.</p>'}<ol class="marcos">${marcos.map((m, k) => { const dd = R.diasAte(m.d);
              const prox = k === marcos.findIndex(x => R.diasAte(x.d) >= 0);
              const tom = dd < 0 ? 'passou' : dd <= 7 ? 'perto' : 'longe';
              return `<li class="marco ${tom}${prox ? ' prox' : ''}"><time class="marco-cal" datetime="${m.d}"><b>${m.d.slice(8, 10)}</b><span>${MES3[+m.d.slice(5, 7) - 1]} ${m.d.slice(0, 4)}</span></time>
                <span class="marco-txt">${E(m.t)}
                ${m.meta && MQ.METAS.some(x => x.id === m.meta) ? `<button type="button" class="marco-meta" data-meta-ir="${m.meta}" aria-label="Ver a meta ${m.meta.slice(1)}: ${E((MQ.METAS.find(x => x.id === m.meta) || {}).nome || '')}">Meta ${m.meta.slice(1)} · ${E((MQ.METAS.find(x => x.id === m.meta) || {}).nome || '')}</button>` : ''}
                <span class="marco-prazo">${dd < 0 ? 'passou há ' + (-dd) + ' dia' + (dd === -1 ? '' : 's') : dd === 0 ? 'hoje' : 'em ' + dd + ' dia' + (dd === 1 ? '' : 's')}</span></span></li>`; }).join('')}</ol>
          </section>
          ${/* 15/10/2026: o quadro "Por estado" saiu (repetia a "Situação do campo em cada estado"); a coluna "Sem água" foi para lá */ ''}
        </div>
      </div>
      ${cronograma(S, d, mes)}
      ${MQ.GEO ? mapa(S, d) : ''}
      ${MQ.aguaUI && /^coord/.test((S.eu || {}).papel || '') ? MQ.aguaUI.secao() : ''}
      ${perfil(S, d)}
      ${equipeExec(S)}`;
  }
  document.addEventListener('click', ev => {
    const m = ev.target.closest('[data-acao="mapa-mun"]');
    if (m) { const S = MQ.ui.S; S.mapaUF = m.dataset.uf; S.mapaMun = m.dataset.mun; MQ.ui.render(); const t = document.getElementById('t-mapa'); if (t) t.scrollIntoView({ block: 'start' }); return; }
    const b = ev.target.closest('[data-acao="mapa-uf"]'); if (!b) return;
    const S = MQ.ui.S; S.mapaMun = ''; S.mapaUF = S.mapaUF === b.dataset.uf && b.tagName === 'path' ? '' : b.dataset.uf; MQ.ui.render();
  });
  /* clique num círculo ou ponto: cartão com as informações e o que dá para fazer */
  function cartaoMapa(el, ev) {
    const box = document.getElementById('mapa-cartao'); if (!box) return;
    const S = MQ.ui.S; const ordem = ['aprovada', 'espera', 'aguardando', 'sem_agua'];
    let html;
    // círculos sobrepostos: lista todos os municípios que estão debaixo do clique
    let juntos = [];
    if (el.dataset.mun && ev && el.ownerSVGElement) {
      const svg = el.ownerSVGElement; const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      juntos = Object.entries(ULTIMO.geo || {}).filter(([, g]) => Math.hypot(q.x - g.cx, q.y - g.cy) <= g.R * 1.05).map(([k]) => k);
    }
    if (juntos.length > 1) {
      const nomeDe = g => { const muns = MQ.GEO.mun[g.uf] || {}; return Object.keys(muns).find(m => norm(m) === norm(g.mun)) || g.mun; };
      html = `<div class="mc-cab"><b>${juntos.length} municípios neste ponto</b><button class="fechar" data-acao="mapa-cartao-fechar" aria-label="Fechar">×</button></div>
        <p class="small muted">Os círculos se sobrepõem. Escolha o município:</p>
        <ul class="mc-lista mc-muns">${juntos.map(k => ULTIMO.grupos[k]).filter(Boolean).sort((a, b) => b.itens.length - a.itens.length).map(g => {
          const por = ordem.map(id => [CATS.find(c => c.id === id), g.itens.filter(x => x.cat === id).length]).filter(([, q]) => q);
          return `<li><button class="mc-mun" data-acao="mapa-mun" data-uf="${g.uf}" data-mun="${E(g.k)}"><span class="mc-barra">${por.map(([c, q]) => `<i style="background:${c.cor};flex:${q}"></i>`).join('')}</span>
            <span>${E(nomeDe(g))}/${g.uf}</span><b class="num">${g.itens.length}</b><span aria-hidden="true">›</span></button></li>`; }).join('')}</ul>`;
    } else if (el.dataset.mun) {
      const g = ULTIMO.grupos[el.dataset.mun]; if (!g) return;
      const muns = MQ.GEO.mun[g.uf] || {}; const nome = Object.keys(muns).find(m => norm(m) === norm(g.mun)) || g.mun;
      const por = ordem.map(id => [CATS.find(k => k.id === id), g.itens.filter(x => x.cat === id).length]).filter(([, q]) => q);
      const gps = g.itens.filter(x => x.p.exato).length;
      html = `<div class="mc-cab"><b>${E(nome)}/${g.uf}</b><button class="fechar" data-acao="mapa-cartao-fechar" aria-label="Fechar">×</button></div>
        <p class="small muted">${g.itens.length} mulher${g.itens.length > 1 ? 'es' : ''} com ficha · ${gps} com GPS</p>
        <ul class="mc-lista">${por.map(([k, q]) => `<li><span class="lg-pt" style="background:${k.cor}"></span>${E(k.nome)}<b class="num">${q}</b></li>`).join('')}</ul>
        <div class="acoes"><button class="btn peq pri" data-acao="mapa-mun" data-uf="${g.uf}" data-mun="${E(g.k)}">Ver cada quintal</button>
          ${ULTIMO.foco ? '' : `<button class="btn peq" data-acao="mapa-uf" data-uf="${g.uf}">Ver o estado</button>`}</div>`;
    } else {
      const f = (S.fichas || []).find(x => x.id === el.dataset.id); if (!f) return;
      const b = MQ.ui.porId(f.bolsista_id);
      const dg = (S.diagnosticos || []).find(x => x.ficha_id === f.id);
      const vs = (S.visitas || []).filter(v => v.ficha_id === f.id && v.situacao === 'realizada').length;
      const lin = [['Situação', (MQ.RESULTADOS[f.resultado] || {}).nome + (f.situacao !== 'aprovada' ? ' · ' + (MQ.SITUACOES[f.situacao] || {}).nome : '')],
        ['Comunidade', f.comunidade], ['Prioridade', f.pontos == null ? '—' : f.pontos + (+f.pontos === 1 ? ' ponto' : ' pontos')], ['Indicada por', b ? b.nome_social || b.nome : null],
        ['Diagnóstico', dg ? (dg.situacao === 'aprovado' ? 'plano aprovado' : 'feito, ' + (dg.situacao === 'devolvido' ? 'devolvido' : 'aguardando aprovação')) : 'ainda não'],
        ['Visitas feitas', String(vs)], ['Local', el.dataset.exato ? 'GPS' : 'aproximado (sem GPS)']].filter(l => l[1]);
      html = `<div class="mc-cab"><b>Quintal em ${E(f.municipio)}/${f.uf}</b><button class="fechar" data-acao="mapa-cartao-fechar" aria-label="Fechar">×</button></div>
        <dl class="dl mc-dl">${lin.map(([k, v]) => `<dt>${k}</dt><dd>${E(v)}</dd>`).join('')}</dl>
        <div class="acoes"><button class="btn peq" data-acao="ficha-ver" data-id="${E(f.id)}">Ver ficha</button></div>`;
    }
    box.innerHTML = html; box.hidden = false;
    const caixa = box.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect();
    const w = Math.min(300, caixa.width - 16); box.style.width = w + 'px';
    let left = r.left - caixa.left + r.width / 2 - w / 2; left = Math.max(8, Math.min(left, caixa.width - w - 8));
    box.style.left = left + 'px'; box.style.top = (r.bottom - caixa.top + 8) + 'px';
    const dica = document.getElementById('mapa-dica'); if (dica) dica.hidden = true;
    const bb = box.getBoundingClientRect(); if (bb.bottom > innerHeight) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-acao="mapa-info"]');
    if (el) { ev.stopPropagation(); cartaoMapa(el, ev); return; }
    const box = document.getElementById('mapa-cartao');
    if (box && !box.hidden && (ev.target.closest('[data-acao="mapa-cartao-fechar"]') || !ev.target.closest('#mapa-cartao'))) box.hidden = true;
  }, true);
  document.addEventListener('keydown', ev => { const box = document.getElementById('mapa-cartao'); if (ev.key === 'Escape' && box && !box.hidden) { box.hidden = true; ev.stopPropagation(); } }, true);

  document.addEventListener('pointerover', ev => {
    const pt = ev.target.closest && ev.target.closest('.q-pt'); const dica = document.getElementById('mapa-dica');
    if (!dica) return;
    if (!pt) { dica.hidden = true; return; }
    const caixa = pt.closest('.mapa-caixa').getBoundingClientRect(), r = pt.getBoundingClientRect();
    dica.textContent = pt.dataset.dica; dica.hidden = false;
    dica.style.left = Math.min(r.left - caixa.left + r.width / 2, caixa.width - 12) + 'px';
    dica.style.top = (r.top - caixa.top) + 'px';
  });

  /* Mapa público: só os 5 estados pintados pelo total (sem nenhum ponto de quintal) */
  const mostrarMun = ev => { const g = ev.target.closest && ev.target.closest('.mun-pt'); if (!g) return; const svg = g.closest('svg');
    const box = svg.parentElement.querySelector('[data-mun-nome]'); if (box) box.textContent = g.dataset.mun;
    svg.querySelectorAll('.rota.ativa').forEach(r => r.classList.remove('ativa'));
    const k = g.dataset.rotaDe || g.dataset.mun; const r = svg.querySelector(`.rota[data-rota="${CSS.escape ? CSS.escape(k) : k}"]`); if (r) r.classList.add('ativa'); };
  document.addEventListener('mouseover', mostrarMun); document.addEventListener('focusin', mostrarMun); document.addEventListener('click', mostrarMun);
  const APODI = [-37.7989, -5.6649];   // IFRN Campus Apodi: de onde sai a equipe do projeto
  function mapaUFs(op) {   // op.entrada: tela de entrada (sem legenda, nº de cidades em cada estado); op.animar: rotas saindo de Apodi
    op = op || {};   // mapa fixo: os 5 estados (cor própria), o RN sede e os municípios que receberão os quintais
    const ufsProj = MQ.UFS.map(u => u.uf);
    // quadro justo nos 5 estados e no RN (nenhum estado cortado); o mapa fica grande pela altura, não pelo corte
    const vb = (() => { const c = caixa(ufsProj.concat(['RN'])); const m = Math.max(c[2], c[3]) * 0.035; const extra = op.entrada ? Math.max(c[2], c[3]) * 0.09 : 0;   // entrada: espaço à direita para "3 cidades" de AL e SE no mar
      return [c[0] + m, c[1] + m, c[2] - 2 * m + extra, c[3] - 2 * m]; })();
    const esc = Math.max(vb[2], vb[3]) / 100;
    const nMunUF = uf => Object.keys((MQ.GEO.mun || {})[uf] || {}).length;
    const path = anel => 'M' + anel.map(p => px(p).map(v => v.toFixed(3)).join(',')).join('L') + 'Z';
    // vizinhos (CE, PB…) só de fundo; RN destacado como sede; cada um dos 5 estados com sua cor
    const estados = Object.entries(MQ.GEO.uf).map(([uf, g]) => {
      if (ufsProj.includes(uf)) return `<path d="${g.r.map(path).join('')}" class="uf-pub" style="fill:var(--uf-${uf})" stroke-width="${esc * 0.25}"><title>${U.nomeUF(uf)}: ${nMunUF(uf)} ${nMunUF(uf) === 1 ? 'município' : 'municípios'}</title></path>`;
      if (uf === 'RN') return `<path d="${g.r.map(path).join('')}" class="uf-sede" stroke-width="${esc * 0.3}"><title>Rio Grande do Norte: IFRN Campus Apodi</title></path>`;
      return `<path d="${g.r.map(path).join('')}" class="uf-fundo" stroke-width="${esc * 0.2}"/>`;
    }).join('');
    const ordem = ufsProj.slice().sort((x, y) => nMunUF(y) - nMunUF(x) || x.localeCompare(y));
    // rotas: de Apodi até cada município (curvas), e os pontos dos municípios que receberão os quintais
    const [ax, ay] = px(APODI);
    const muns = ufsProj.flatMap(uf => Object.entries((MQ.GEO.mun || {})[uf] || {}).map(([nome, c]) => ({ uf, nome, xy: px(c) })));
    const rotas = muns.map(({ uf, nome, xy: [x, y] }, k) => { const mx = (ax + x) / 2, my = (ay + y) / 2, dx = x - ax, dy = y - ay, d = Math.hypot(dx, dy) || 1;
      const cx = mx - dy / d * d * 0.18, cy = my + dx / d * d * 0.18;   // curva para o lado, como rota de voo
      let len = 0, px0 = ax, py0 = ay; for (let i = 1; i <= 12; i++) { const u = i / 12, qx = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * x, qy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * y; len += Math.hypot(qx - px0, qy - py0); px0 = qx; py0 = qy; }
      return `<path class="rota" data-rota="${E(nome)}/${uf}" d="M${ax.toFixed(3)},${ay.toFixed(3)}Q${cx.toFixed(3)},${cy.toFixed(3)} ${x.toFixed(3)},${y.toFixed(3)}" stroke-width="${esc * 0.28}" stroke-dasharray="${esc * 1.2} ${esc * 1}" style="animation-delay:-${(k * 0.23).toFixed(2)}s;--len:${(len * 1.02).toFixed(2)};--i:${k}"/>`; }).join('');
    // 40: com os totais por município (página pública), cada círculo tem o tamanho do número de mulheres cadastradas;
    // município previsto ainda sem cadastro fica como ponto vazado. Menos de 3: sem o número (LGPD).
    const dadosMun = Array.isArray(op.municipios) ? op.municipios : null;
    const qMun = (uf, nome) => dadosMun && dadosMun.find(m => m.uf === uf && norm(m.municipio) === norm(nome));
    const semCadastro = dadosMun ? muns.filter(m => !qMun(m.uf, m.nome)).length : 0;
    /* Pontos do mapa: cada um tem nome para o leitor de tela (município e o que ele mostra). Na página pública (#numeros)
       entram na ordem do Tab; na tela de entrada ficam fora dela (tabindex -1), para o teclado chegar logo ao login
       em vez de passar por ~30 pontos. op.tab força um dos dois. */
    const tab = op.tab != null ? op.tab : ((typeof location !== 'undefined' && location.hash === '#numeros') ? 0 : -1);
    const acess = rot => `role="img" aria-label="${E(rot)}" tabindex="${tab}"`;
    const raioMun = escalaRaios(muns.map(m => { const q = qMun(m.uf, m.nome); return { x: m.xy[0], y: m.xy[1], n: q ? (q.n || 2) : 0 }; }), esc, 1.15, 0.42, 5);   // sem sobrepor (ver escalaRaios)
    const comDado = dadosMun ? muns.filter(m => qMun(m.uf, m.nome)) : [];
    const lugarMun = new Map(); espalhar(comDado.map(m => { const q = qMun(m.uf, m.nome); return { x: m.xy[0], y: m.xy[1], n: q.n || 2 }; }), raioMun, esc).forEach((p, i) => lugarMun.set(comDado[i].uf + '|' + comDado[i].nome, p));
    const pontoMun = ({ uf, nome, xy }, k) => { const q = qMun(uf, nome); const n = q ? (q.n || 2) : 0; const L = lugarMun.get(uf + '|' + nome) || {}; const x = L.x != null ? L.x : xy[0], y = L.y != null ? L.y : xy[1];
      const r = raioMun(n); const txt = q ? (q.menos_de_3 ? 'menos de 3 mulheres cadastradas' : q.n + ' mulheres cadastradas') : 'previsto, ainda sem cadastro';
      return `<g class="mun-pt${q ? ' mun-q' : ' mun-prev'}" data-mun="${E(nome)}/${uf} · ${txt}" data-rota-de="${E(nome)}/${uf}" ${acess(nome + '/' + uf + ': ' + txt)} style="--i:${k}"><circle cx="${x}" cy="${y}" r="${Math.max(r, esc * 3.2)}" class="mun-alvo"/>`
        + (q ? `${tracoAoLugar(L, esc, r)}<circle cx="${x}" cy="${y}" r="${r}" class="mun-dot" stroke-width="${esc * 0.35}"/>${q.n ? `<text x="${x}" y="${y + r * 0.36}" text-anchor="middle" font-size="${Math.min(r * 1.05, esc * 2.8)}" class="mun-n">${q.n}</text>` : ''}`
          : `<circle cx="${x}" cy="${y}" r="${esc * 1}" class="mun-vazio" stroke-width="${esc * 0.35}"/>`) + `<title>${E(nome)}/${uf}: ${txt}</title></g>`; };
    // sem números por município (página pública antes do login): os pontos têm tamanho fixo e, em Alagoas, Sergipe e no
    // sertão de Pernambuco, ficavam uns por cima dos outros; aqui os que se tocam são afastados o mínimo necessário
    const lugarFixo = dadosMun ? [] : espalhar(muns.map(m => ({ x: m.xy[0], y: m.xy[1], n: 1 })), () => esc * 1.4, esc);
    const pontos = dadosMun ? muns.map(pontoMun).join('') : muns.map(({ uf, nome }, k) => { const x = lugarFixo[k].x, y = lugarFixo[k].y; return (
      `<g class="mun-pt" data-mun="${E(nome)}/${uf}" ${acess(nome + '/' + uf)} style="animation-delay:${((k * 0.37) % 2.4).toFixed(2)}s;--i:${k}"><circle cx="${x}" cy="${y}" r="${esc * 3.2}" class="mun-alvo"/><circle cx="${x}" cy="${y}" r="${esc * 2.2}" class="mun-onda"/><circle cx="${x}" cy="${y}" r="${esc * 1.4}" class="mun-dot" stroke-width="${esc * 0.35}"/><title>${E(nome)}/${uf}</title></g>`); }).join('');
    const sede = op.entrada   // entrada (infográfico): Apodi como origem, marcador maior em terracota com halo discreto
      ? `<g class="mun-pt sede-pt" data-mun="Apodi/RN · IFRN Campus Apodi, de onde sai a equipe" ${acess('Apodi/RN: IFRN Campus Apodi, de onde sai a equipe')}><circle cx="${ax}" cy="${ay}" r="${esc * 3.8}" class="sede-halo"/><circle cx="${ax}" cy="${ay}" r="${esc * 3.4}" class="mun-alvo"/><circle cx="${ax}" cy="${ay}" r="${esc * 2.2}" class="sede-dot" stroke-width="${esc * 0.55}"/><title>Apodi/RN: IFRN Campus Apodi</title></g>
      <text x="${ax + esc * 3.4}" y="${ay - esc * 2.4}" class="sede-rot" font-size="${esc * 3.4}">Apodi <tspan class="sede-uf" font-size="${esc * 2.6}">RN</tspan></text>`
      : `<g class="mun-pt sede-pt" data-mun="Apodi/RN · IFRN Campus Apodi, de onde sai a equipe" ${acess('Apodi/RN: IFRN Campus Apodi, de onde sai a equipe')}><circle cx="${ax}" cy="${ay}" r="${esc * 3.4}" class="mun-alvo"/><circle cx="${ax}" cy="${ay}" r="${esc * 2.1}" class="sede-dot" stroke-width="${esc * 0.5}"/><circle cx="${ax}" cy="${ay}" r="${esc * 0.8}" class="sede-miolo"/><title>Apodi/RN: IFRN Campus Apodi</title></g>
      <text x="${ax + esc * 3}" y="${ay - esc * 2.2}" class="sede-rot" font-size="${esc * 3.4}">Apodi</text>`;
    const nMun = muns.length;
    // rótulos longe dos pontos das cidades: PI desce; AL e SE vão para o mar, ao lado (em unidades de "esc")
    const DESLOC = op.entrada ? { PI: [0, 12, 'middle'], AL: [7, -1.5, 'start'], SE: [6.5, 3, 'start'] } : {};
    // entrada: o RN já está no rótulo "Apodi RN"
    const siglas = ufsProj.concat(op.entrada ? [] : ['RN']).map(uf => { const g = MQ.GEO.uf[uf]; if (!g || !g.c) return ''; const [x0, y0] = px(g.c);
      const [ddx, ddy, anc] = DESLOC[uf] || [0, 0, 'middle']; const x = x0 + ddx * esc, y = y0 + ddy * esc;
      const n = nMunUF(uf);
      return `<text x="${x}" y="${y}" class="uf-sigla${uf === 'RN' ? ' sigla-sede' : ''}${DESLOC[uf] && anc === 'start' ? ' sigla-mar' : ''}" font-size="${esc * 3.6}" text-anchor="${anc}">${uf}</text>`
        + (op.entrada && uf !== 'RN' ? `<text x="${x}" y="${y + esc * 3.4}" class="uf-sigla uf-num${anc === 'start' ? ' sigla-mar' : ''}" font-size="${esc * 2.5}" text-anchor="${anc}">${n} ${n === 1 ? 'cidade' : 'cidades'}</text>` : ''); }).join('');
    return `<svg class="mapa mapa-pub${op.entrada ? ' mapa-info' : ''}${op.animar ? ' saindo' : ''}" viewBox="${vb.join(' ')}" role="img" aria-label="Mapa dos estados do projeto: ${ufsProj.map(u => u + ' ' + nMunUF(u) + ' municípios').join(', ')}; ${nMun} municípios que receberão os quintais, ligados a Apodi/RN, sede do IFRN" preserveAspectRatio="xMidYMid meet">${estados}${siglas}<g class="rotas">${rotas}</g>${pontos}${sede}</svg>
      <p class="mun-nome" aria-live="polite"><span data-mun-nome></span></p>
      ${op.entrada ? (dadosMun ? `<div class="mapa-leg-info"><p class="leg-sede"><span class="pt pt-sede" aria-hidden="true"></span>Polo: IFRN Campus Apodi</p><p><span class="pt" aria-hidden="true"></span>Cada círculo representa um município. O tamanho indica o número de mulheres cadastradas.</p>${semCadastro ? `<p><span class="pt pt-vazio" aria-hidden="true"></span>Município previsto, ainda sem cadastro.</p>` : ''}</div>`
        : `<div class="mapa-leg-info"><p class="leg-sede"><span class="pt pt-sede" aria-hidden="true"></span>Polo: IFRN Campus Apodi</p><p><span class="pt" aria-hidden="true"></span>Cada ponto representa 1 município atendido pelo projeto.</p></div>`) : `<ul class="mapa-lista">${ordem.map(uf => { const nm = nMunUF(uf);
        return `<li><span class="lg-q" style="background:var(--uf-${uf})"></span>${uf} <span class="lg-mun">${nm} ${nm === 1 ? 'município' : 'municípios'}</span></li>`; }).join('')}<li><span class="lg-q lg-sede"></span>RN <span class="muted">sede (Apodi)</span></li></ul>`}`;
  }

  /* marco → meta: abre a linha da meta no plano, rola até ela e põe o foco no título */
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', ev => {
    const b = ev.target && ev.target.closest && ev.target.closest('[data-meta-ir]'); if (!b) return;
    const d = document.getElementById('meta-' + b.dataset.metaIr); if (!d) return;
    d.open = true; d.classList.add('meta-alvo'); setTimeout(() => d.classList.remove('meta-alvo'), 2400);
    if (d.scrollIntoView) d.scrollIntoView({ block: 'center', behavior: (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth' });
    const s = d.querySelector('summary'); if (s && s.focus) s.focus({ preventScroll: true });
  });
  /* o mapa da Visão geral para quem acompanha de fora: recebe só totais por município ([{uf, municipio, n}]), nunca fichas */
  function mapaResumo(municipios) {
    const fichas = []; (municipios || []).forEach(m => { for (let i = 0; i < (m.n || 0); i++) fichas.push({ id: '', uf: m.uf, municipio: m.municipio, resultado: 'selecionada', situacao: 'aprovada' }); });
    return mapa({ mapaUF: '', mapaMun: '' }, { fichas }, { resumo: true });
  }
  MQ.painelUI = { previsto, LEG_META, LEG_RETRATO, mapaResumo, visaoGeral, mesDoProjeto, mapaUFs, escalaRaios, espalhar, marcasTamanho, infoMeta, execucaoGeral, chipStatus, STATUS, cronograma };
})();
