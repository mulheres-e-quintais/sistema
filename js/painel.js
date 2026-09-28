/* Mulheres & Quintais — visão geral do projeto (tela inicial da coordenação).
   Mostra só o que o sistema sabe; o que ainda é registrado fora dele aparece como tal, nunca como zero. */
(function () {
  const R = MQ.regras;
  const E = s => MQ.ui.esc(s);

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
    const pagaveis = ativos.filter(m => m.papel !== 'coord_geral');
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
    const vagas = 11 - d.pagaveis.length;
    if (vagas > 0) {
      const dias = R.diasAte(MQ.PROJETO.prazoIndicacao);
      a.push({ nivel: dias < 0 ? 'crit' : 'pend', texto: `${vagas} vaga${vagas > 1 ? 's' : ''} da equipe sem pessoa cadastrada`,
        det: dias < 0 ? `O prazo de indicação do MPA venceu em ${R.fmtData(MQ.PROJETO.prazoIndicacao)}.` : `Prazo de indicação do MPA: ${R.fmtData(MQ.PROJETO.prazoIndicacao)}.`, aba: 'equipe' });
    }
    const semHab = d.pagaveis.filter(m => R.situacao(m).cod !== 'ok');
    if (semHab.length) a.push({ nivel: 'pend', texto: `${semHab.length} pessoa${semHab.length > 1 ? 's' : ''} ainda sem habilitação completa para a bolsa`,
      det: semHab.slice(0, 4).map(m => m.nome.split(' ')[0] + ' (' + R.passosHabilitacao(m).filter(p => !p.feito).map(p => p.id === 'fic' ? 'FIC' : p.id === 'funcern' ? 'FUNCERN' : 'termo').join(', ') + ')').join(' · ') + (semHab.length > 4 ? ' …' : ''), aba: 'equipe' });
    const velhas = d.fichas.filter(f => f.situacao === 'aguardando' && f.criado_em && (Date.now() - new Date(f.criado_em)) > 5 * 864e5);
    if (velhas.length) a.push({ nivel: 'pend', texto: `${velhas.length} ficha${velhas.length > 1 ? 's' : ''} aguardando aprovação há mais de 5 dias`, det: 'A aprovação é da coordenação técnica. Sem ela, o diagnóstico não começa.', aba: 'selecao' });
    const casas = d.fichas.filter(f => R.casasParecidas(f, d.fichas).length);
    if (casas.length) a.push({ nivel: 'crit', texto: `${casas.length} fichas com o mesmo endereço de outra ficha`, det: 'Duas pessoas da mesma casa não podem ser selecionadas (risco de questionamento da seleção).', aba: 'selecao' });
    MQ.UFS.forEach(u => {
      const fs = d.fichas.filter(f => f.uf === u.uf);
      const semAgua = fs.filter(f => f.resultado === 'sem_agua').length;
      if (fs.length >= 5 && semAgua / fs.length > 0.3)
        a.push({ nivel: 'crit', texto: `${u.nome}: ${Math.round(semAgua / fs.length * 100)}% das fichas sem água no período seco`,
          det: 'Acima de 30% é o sinal de alerta do risco "quintal sem água". Rever o território ou buscar parceria com programa de cisternas.', aba: 'selecao' });
      if (hoje >= MQ.PROJETO.inicioDiagnosticos && fs.length === 0)
        a.push({ nivel: 'pend', texto: `${u.nome}: nenhuma ficha de indicação lançada`, det: 'Os diagnósticos já deveriam ter começado.', aba: 'selecao' });
    });
    const semImagem = d.fichas.filter(f => f.consent_dados && !f.consent_imagem).length;
    if (semImagem) a.push({ nivel: 'info', texto: `${semImagem} mulher${semImagem > 1 ? 'es' : ''} não autorizou uso de imagem`, det: 'Não use fotos delas em divulgação. O sistema mostra o aviso na ficha de cada uma.', aba: 'selecao' });
    return a;
  }

  function linhaMeta(meta, S, d, mes) {
    const prev = previsto(meta, mes);
    let atual = null, rotulo = '', nota = '', alvo = meta.alvo, un = meta.un;
    if (meta.fonte === 'equipe') {
      atual = d.aptas.length; alvo = 11; un = 'pessoas aptas a receber bolsa';
      nota = `${d.pagaveis.length} de 11 cadastradas (1 coordenação técnica e 10 bolsistas). Meta: ${meta.alvo} ${meta.un}.`;
    } else if (meta.fonte) {
      nota = 'O formulário desta etapa ainda não está no sistema. Por enquanto o registro é em papel.';
    } else {
      nota = 'Acompanhada fora deste sistema, no painel financeiro e de entregas.';
    }
    const pctAtual = atual == null ? 0 : Math.min(100, atual / alvo * 100);
    const pctPrev = meta.fonte === 'equipe' ? null : Math.min(100, prev / alvo * 100);
    let st;
    if (atual == null) st = mes - 1 < meta.ini ? { cls: 'off', t: 'Começa em ' + MESES[meta.ini - 1] } : { cls: 'off', t: 'Sem registro no sistema' };
    else if (meta.fonte === 'equipe') st = atual >= 11 ? { cls: 'ok', t: 'Completa' } : mes >= 2 ? { cls: 'crit', t: 'Incompleta' } : { cls: 'pend', t: 'Montando' };
    return `<div class="meta-linha">
      <div class="meta-cab"><span class="meta-id">${meta.id}</span><span class="meta-nome">${E(meta.nome)}</span><span class="chip ${st.cls}">${E(st.t)}</span></div>
      <div class="medidor" role="img" aria-label="${atual == null ? 'sem registro' : atual + ' de ' + alvo}${pctPrev != null ? ', previsto até agora ' + prev : ''}">
        <i style="width:${pctAtual}%"></i>${pctPrev != null && prev > 0 ? `<b class="previsto" style="left:${pctPrev}%"></b>` : ''}</div>
      <div class="meta-num"><span class="num"><b>${atual == null ? '—' : atual}</b> de ${alvo} ${E(un)}</span>
        ${pctPrev != null && mes - 1 >= meta.ini ? `<span class="muted num">previsto até ${MESES[Math.max(0, mes - 2)]}: ${prev}</span>` : ''}</div>
      <p class="nota">${E(nota)} <span class="muted">Período: ${MESES[meta.ini - 1]} a ${MESES[meta.fim - 1]}.</span></p>
    </div>`;
  }

  function visaoGeral(S) {
    const d = dados(S);
    const mes = mesDoProjeto();
    const diasFim = R.diasAte(MQ.PROJETO.vigencia.fim);
    const al = alertas(S, d);
    const marcos = MQ.MARCOS.filter(m => R.diasAte(m.d) >= -7).slice(0, 4);
    const selPct = Math.min(100, d.selAprov.length / 200 * 100);
    const aguard = d.fichas.filter(f => f.situacao === 'aguardando').length;
    const icone = n => n === 'crit' ? '!' : n === 'pend' ? '•' : 'i';
    const rotNivel = { crit: 'Crítico', pend: 'Atenção', info: 'Informação' };
    return `
      <div class="cab"><div><span class="eyebrow">Visão geral · processo ${E(MQ.PROJETO.processo)}</span><h1>Mulheres &amp; Quintais</h1>
        <p>Mês <b class="num">${mes}</b> de 13 · vigência até ${R.fmtData(MQ.PROJETO.vigencia.fim)} (${diasFim > 0 ? 'faltam ' + diasFim + ' dias' : 'encerrada'}).
        Recursos e rubricas ficam no <a href="${E(MQ.PAINEL_FINANCEIRO)}" target="_blank" rel="noopener">painel financeiro e de entregas</a>.</p></div>
        <div class="linha-tempo-mini" aria-label="Meses do projeto">${MESES.map((m, i) => `<span class="${i + 1 < mes ? 'passou' : i + 1 === mes ? 'agora' : ''}" title="${m}"></span>`).join('')}</div></div>

      <div class="resumo" aria-label="Números do projeto">
        <div><span class="v num">${d.pagaveis.length}<small> de 11</small></span><span class="l">na equipe (coordenação técnica e bolsistas)</span></div>
        <div><span class="v num">${d.aptas.length}<small> de 11</small></span><span class="l">aptas a receber bolsa</span></div>
        <div><span class="v num">${d.fichas.length}</span><span class="l">fichas de indicação lançadas${aguard ? ` · <b>${aguard}</b> aguardando` : ''}</span></div>
        <div><span class="v num">${d.selAprov.length}<small> de 200</small></span><span class="l">mulheres selecionadas e aprovadas</span></div>
      </div>

      <section class="secao" aria-labelledby="t-alertas">
        <h2 id="t-alertas">O que pede atenção</h2>
        ${al.length ? `<ul class="alertas">${al.map(x => `<li class="al-${x.nivel}"><span class="al-ic" aria-hidden="true">${icone(x.nivel)}</span>
          <span><span class="sr">${rotNivel[x.nivel]}: </span><b>${E(x.texto)}</b><br><span class="small muted">${E(x.det)}</span></span>
          ${x.aba ? `<button class="link small" data-acao="aba" data-aba="${x.aba}">Ver</button>` : ''}</li>`).join('')}</ul>`
          : '<p class="aviso" style="background:var(--ok-bg)">Nada pendente nos dados do sistema.</p>'}
      </section>

      <div class="duas-col">
        <section class="secao" aria-labelledby="t-metas">
          <div class="secao-cab"><h2 id="t-metas">Metas do plano de trabalho</h2><p>Barra: realizado · traço: previsto até o mês passado</p></div>
          <div class="bloco metas">
            ${linhaMeta(MQ.METAS[0], S, d, mes)}
            <div class="meta-linha">
              <div class="meta-cab"><span class="meta-id">Sel.</span><span class="meta-nome">Seleção das beneficiárias (antes da Meta 2)</span>
                <span class="chip ${d.selAprov.length >= 200 ? 'ok' : d.fichas.length ? 'pend' : 'off'}">${d.selAprov.length >= 200 ? 'Completa' : d.fichas.length ? 'Em andamento' : 'Não começou'}</span></div>
              <div class="medidor" role="img" aria-label="${d.selAprov.length} de 200"><i style="width:${selPct}%"></i></div>
              <div class="meta-num"><span class="num"><b>${d.selAprov.length}</b> de 200 selecionadas e aprovadas</span><span class="muted num">${aguard} aguardando aprovação</span></div>
              <p class="nota">Registrada no sistema (ficha de indicação e termo de consentimento).</p>
            </div>
            ${MQ.METAS.filter(m => m.fonte && m.fonte !== 'equipe').map(m => linhaMeta(m, S, d, mes)).join('')}
          </div>
          <details class="hist"><summary>Metas acompanhadas no painel financeiro (M5 a M8)</summary>
            <div class="metas" style="padding:0 18px 8px">${MQ.METAS.filter(m => !m.fonte).map(m => linhaMeta(m, S, d, mes)).join('')}</div></details>
        </section>

        <div style="display:grid;gap:28px;align-content:start">
          <section class="secao" aria-labelledby="t-uf">
            <h2 id="t-uf">Por estado</h2>
            <div class="bloco" style="padding:6px 16px">
              <table class="tab-uf"><thead><tr><th>UF</th><th>Equipe</th><th>Selecionadas</th><th>Sem água</th></tr></thead><tbody>
              ${MQ.UFS.map(u => {
                const eq = d.bols.filter(m => m.uf === u.uf);
                const fs = d.fichas.filter(f => f.uf === u.uf);
                const sel = fs.filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada').length;
                const sa = fs.filter(f => f.resultado === 'sem_agua').length;
                const pSa = fs.length ? Math.round(sa / fs.length * 100) : null;
                return `<tr><td><b>${u.uf}</b></td>
                  <td>${eq.length === 2 ? '<span class="chip ok">2 de 2</span>' : `<span class="chip ${eq.length ? 'pend' : 'crit'}">${eq.length} de 2</span>`}</td>
                  <td><div class="mini"><span class="medidor fino"><i style="width:${Math.min(100, sel / MQ.VAGAS_UF * 100)}%"></i></span><span class="num">${sel}/${MQ.VAGAS_UF}</span></div></td>
                  <td class="num">${pSa == null ? '<span class="muted">—</span>' : pSa > 30 ? `<b style="color:var(--crit)">${pSa}%</b>` : pSa + '%'}</td></tr>`;
              }).join('')}</tbody></table>
            </div>
          </section>

          <section class="secao" aria-labelledby="t-marcos">
            <h2 id="t-marcos">Próximos marcos</h2>
            <ul class="marcos">${marcos.map(m => { const dd = R.diasAte(m.d);
              return `<li><time datetime="${m.d}">${R.fmtData(m.d)}</time><span>${E(m.t)}<br><span class="small ${dd < 0 ? 'crit-txt' : dd <= 7 ? 'pend-txt' : 'muted'}">${dd < 0 ? 'passou há ' + (-dd) + ' dia' + (dd === -1 ? '' : 's') : dd === 0 ? 'hoje' : 'em ' + dd + ' dia' + (dd === 1 ? '' : 's')}</span></span></li>`; }).join('')}</ul>
          </section>
        </div>
      </div>`;
  }

  MQ.painelUI = { visaoGeral, mesDoProjeto };
})();
