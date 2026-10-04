/* Mulheres & Quintais — acesso à água (01/10/2026). Mesmas regras do supabase/39_agua.sql.
   Quem precisa de solução: ficha "sem água: encaminhada" e diagnóstico que achou o quintal sem água na seca.
   A coordenação registra cada mudança de situação com uma observação; nada se altera nem se apaga. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const SIT = [
    { id: 'sem_solucao', t: 'Sem água', d: 'identificada, ainda sem encaminhamento', cls: 'st-atr' },
    { id: 'encaminhada', t: 'Solução encaminhada', d: 'a programa de cisternas ou órgão', cls: 'st-aten' },
    { id: 'em_andamento', t: 'Solução em andamento', d: 'cisterna ou obra sendo feita', cls: 'st-and' },
    { id: 'concluida', t: 'Solução concluída', d: 'tem água que dura na seca', cls: 'st-ok' }
  ];
  const sitDe = id => SIT.find(x => x.id === id) || SIT[0];
  const pessoa = id => (S().equipe || []).find(m => m.id === id);

  /* quem está na lista: a ficha sem água (padrão: encaminhada, porque a ficha exige o encaminhamento)
     e o diagnóstico sem água (padrão: sem solução) */
  function lista() {
    const fichas = S().fichas || []; const diags = S().diagnosticos || []; const ev = S().agua || [];
    const ids = new Set(fichas.filter(f => f.resultado === 'sem_agua').map(f => f.id));
    diags.filter(d => d.sem_agua).forEach(d => ids.add(d.ficha_id));
    return [...ids].map(id => {
      const f = fichas.find(x => x.id === id) || { id };
      const hist = ev.filter(x => x.ficha_id === id).sort((a, b) => String(a.registrado_em).localeCompare(String(b.registrado_em)));
      const ult = hist[hist.length - 1];
      const origem = f.resultado === 'sem_agua' ? 'ficha' : 'diagnostico';
      return { f, hist, origem, situacao: ult ? ult.situacao : (origem === 'ficha' ? 'encaminhada' : 'sem_solucao'), desde: ult ? ult.registrado_em : (f.criado_em || null) };
    }).sort((a, b) => SIT.findIndex(x => x.id === a.situacao) - SIT.findIndex(x => x.id === b.situacao) || String(a.f.nome || '').localeCompare(String(b.f.nome || '')));
  }

  function secao() {
    if (S().aguaSemBanco) return `<section class="secao dx-agua" aria-labelledby="t-agua"><h2 id="t-agua">Acesso à água</h2>
      <p class="aviso">O acompanhamento da água ainda não está instalado no servidor. A coordenação geral roda o arquivo <b>39_agua.sql</b> no Supabase.</p></section>`;
    const l = lista(); const n = l.length;
    const cont = Object.fromEntries(SIT.map(s => [s.id, l.filter(x => x.situacao === s.id).length]));
    const pend = l.filter(x => x.situacao !== 'concluida');
    return `<section class="secao dx-agua" aria-labelledby="t-agua">
      <div class="secao-cab"><div><h2 id="t-agua">Acesso à água</h2><p>Mulheres que precisam de solução de água para o quintal produzir na seca.</p></div></div>
      ${n ? `<div class="agua-topo">
          <div class="dx-num"><b class="num">${n}</b><span>mulher${n > 1 ? 'es' : ''} com necessidade de água</span></div>
          <div class="agua-barra" role="img" aria-label="${SIT.map(s => cont[s.id] + ' ' + s.t.toLowerCase()).join(', ')}">${SIT.filter(s => cont[s.id]).map(s => `<i class="${s.cls}" style="flex:${cont[s.id]}"></i>`).join('')}</div>
          <ul class="agua-sit">${SIT.map(s => `<li><span class="st-pt ${s.cls}" aria-hidden="true"></span><span>${s.t}<small>${s.d}</small></span><b class="num">${cont[s.id]}</b></li>`).join('')}</ul>
        </div>
        ${pend.length ? `<details class="agua-lista"><summary>Ver quem ainda não tem solução concluída (${pend.length})</summary>
          <ul>${pend.map(x => `<li><span><b>${E(x.f.nome_social || x.f.nome || 'Ficha')}</b> <span class="small muted">${E(x.f.municipio || '')}${x.f.uf ? '/' + x.f.uf : ''}${x.f.encaminhada_para ? ' · encaminhada para ' + E(x.f.encaminhada_para) : ''}</span></span>
            <span class="st-chip ${sitDe(x.situacao).cls}">${sitDe(x.situacao).t}</span>
            <button type="button" class="btn peq" data-acao="agua-ver" data-id="${E(x.f.id)}">Atualizar</button></li>`).join('')}</ul></details>` : '<p class="small muted">Todas com solução concluída.</p>'}`
        : '<p class="muted">Nenhuma mulher com necessidade de água registrada até agora.</p>'}
      <p class="nota">Conta quem foi encaminhada na ficha (sem água) e quem o diagnóstico achou sem água na seca. A situação muda quando a coordenação registra.</p>
    </section>`;
  }

  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function painel(p) {
    const x = lista().find(y => y.f.id === p.id); if (!x) return cab('Acesso à água', 'Não encontrada') + '<div class="painel-corpo"><p class="muted">Esta mulher não está mais na lista.</p></div>';
    const nome = x.f.nome_social || x.f.nome || 'Ficha';
    return cab('Acesso à água', E(nome)) + `<div class="painel-corpo">
      <p>${E(x.f.municipio || '')}${x.f.uf ? '/' + x.f.uf : ''} · ${x.origem === 'ficha' ? 'sem água na ficha de indicação' : 'diagnóstico achou o quintal sem água na seca'}${x.f.encaminhada_para ? ' · encaminhada para <b>' + E(x.f.encaminhada_para) + '</b>' : ''}</p>
      <p>Situação atual: <span class="st-chip ${sitDe(x.situacao).cls}">${sitDe(x.situacao).t}</span></p>
      <h3>Histórico</h3>
      ${x.hist.length ? `<ol class="agua-hist">${x.hist.slice().reverse().map(h => `<li><span class="st-chip ${sitDe(h.situacao).cls}">${sitDe(h.situacao).t}</span>
          <span>${E(h.obs)}<br><span class="small muted">${new Date(h.registrado_em).toLocaleDateString('pt-BR')}${pessoa(h.registrado_por) ? ' · ' + E(pessoa(h.registrado_por).nome) : ''}</span></span></li>`).join('')}</ol>`
        : '<p class="small muted">Nenhuma atualização registrada ainda.</p>'}
      <form class="f" data-form="agua-registrar" data-id="${E(x.f.id)}" novalidate><div class="campos">
        <div class="campo inteiro"><label for="ag-sit">Nova situação</label><select id="ag-sit" name="situacao">${SIT.filter(s => s.id !== x.situacao).map(s => `<option value="${s.id}">${s.t}</option>`).join('')}</select></div>
        <div class="campo inteiro"><label for="ag-obs">O que aconteceu</label><textarea id="ag-obs" name="obs" rows="3" maxlength="500" placeholder="Ex.: cadastrada no Programa Cisternas da prefeitura; obra prevista para novembro."></textarea></div>
      </div><div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Registrar</button><button class="btn" type="button" data-acao="fechar">Fechar</button></div></form></div>`;
  }
  async function clique(a, el) { if (a === 'agua-ver') U().abrirPainel({ tipo: 'agua-ver', id: el.dataset.id }); }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'agua-registrar') return;
    const obs = String(fd.get('obs') || '').trim(); const situacao = String(fd.get('situacao') || '');
    if (obs.length < 10) return U().mostrarErros(form, { obs: 'Escreva o que aconteceu (pelo menos 10 letras).' });
    await U().ocupado(form, async () => { await S().api.registrarSituacaoAgua(form.dataset.id, situacao, obs); await U().carregar(); U().fecharPainel(); U().render(); U().toast('Situação da água registrada.'); });
  }
  MQ.aguaUI = { secao, painel, clique, enviar, lista, SIT };
})();
