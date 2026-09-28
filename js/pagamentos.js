/* Mulheres & Quintais — solicitação de pagamento: a pessoa solicita (ajuda de custo das visitas feitas
   ou bolsa do mês, com relatório) → a coordenação dá o aval (ou devolve) → o auxiliar administrativo
   lança no Arlo e registra. Mesmas regras do supabase/12_pagamentos.sql. */
(function () {
  const R = MQ.regras, P = MQ.PAPEIS;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const brl = v => v == null ? '—' : (Math.round((+v || 0) * 100) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const nomeMes = m => { const [a, b] = String(m).slice(0, 7).split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+b - 1] + '/' + a; };
  const mesHoje = () => R.hoje().slice(0, 7);
  const somaMes = (m, n) => { const [a, b] = m.split('-').map(Number); const d = new Date(a, b - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const G = { mes: null };

  const TIPO = { ajuda_custo: 'Ajuda de custo', bolsa: 'Bolsa' };
  const SIT = { solicitada: ['pend', 'Aguardando aval'], devolvida: ['crit', 'Devolvida para corrigir'], avalizada: ['ok', 'Com aval · falta lançar no Arlo'], lancada: ['ok', 'Lançada no Arlo'] };
  const chip = s => `<span class="chip ${SIT[s.situacao][0]}">${SIT[s.situacao][1]}</span>`;
  const podeAjuda = papel => R.ehCampo(papel);
  const podeBolsa = papel => ['coord_tecnico', 'articulacao', 'apoio', 'professor_fic', 'auxiliar_adm'].includes(papel);
  const quemAvaliza = (tipo, papel) => tipo === 'bolsa' && ['coord_tecnico', 'professor_fic', 'auxiliar_adm'].includes(papel) ? 'coord_geral' : 'coord_tecnico';
  const lista = () => S().solic || [];
  const vinculadas = () => S().solicVis || {};
  const pessoa = id => U().porId(id) || {};
  const nomeDe = m => (m && (m.nome_social || m.nome)) || '—';
  const semBanco = () => '<div class="aviso">A solicitação de pagamento ainda não está instalada no servidor. A coordenação geral roda o arquivo <b>12_pagamentos.sql</b> no Supabase.</div>';

  function garantirCustos() {
    if (MQ.custosUI && !MQ.custosUI.pronto()) { MQ.custosUI.garantir().then(() => U().render()); return false; }
    return true;
  }

  /* ---------- quem recebe: solicitar ---------- */
  function secaoMinha() {
    const eu = Object.assign({}, S().eu, pessoa(S().eu.id)); const papel = eu.papel;
    if (!podeAjuda(papel) && !podeBolsa(papel)) return '';
    if (S().pagSemBanco) return `<section class="secao"><h2>Solicitar pagamento</h2>${semBanco()}</section>`;
    const m = G.mes || mesHoje();
    const minhas = lista().filter(s => s.equipe_id === eu.id);
    const doMes = t => minhas.find(s => s.tipo === t && String(s.mes).slice(0, 7) === m);
    const hab = R.habilitado(eu);
    return `<section class="secao pag" aria-labelledby="t-pag">
      <div class="secao-cab"><div><h2 id="t-pag">Solicitar pagamento</h2><p>Você solicita, a ${quemAvaliza('bolsa', papel) === 'coord_geral' && !podeAjuda(papel) ? 'coordenação geral' : 'coordenação técnica'} dá o aval e o auxiliar administrativo lança no Arlo (FUNCERN).</p></div>
        <span class="seg"><button type="button" data-acao="pag-mes" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" data-acao="pag-mes" data-n="0">${nomeMes(m)}</button><button type="button" data-acao="pag-mes" data-n="1" aria-label="Próximo mês" ${m >= mesHoje() ? 'disabled' : ''}>›</button></span></div>
      ${!hab ? '<div class="aviso erro"><b>Sua habilitação ainda não está completa.</b> Sem ela não há pagamento: veja os passos que faltam.</div>' : ''}
      <div class="pag-grade">
        ${podeAjuda(papel) ? cartaoAjuda(eu, m, doMes('ajuda_custo'), hab) : ''}
        ${podeBolsa(papel) ? cartaoBolsa(eu, m, doMes('bolsa'), hab) : ''}
      </div>
      ${minhas.length ? `<details class="hist"><summary>Minhas solicitações (${minhas.length})</summary><div class="pag-lista">${minhas.map(s => linha(s, false)).join('')}</div></details>` : ''}
    </section>`;
  }

  function situacaoTxt(s) {
    return `${chip(s)}${s.situacao === 'devolvida' && s.obs_aval ? `<p class="small"><b>O que corrigir:</b> ${E(s.obs_aval)}</p>` : ''}
      ${s.situacao === 'lancada' ? `<p class="small muted">Lançada no Arlo em ${new Date(s.arlo_em).toLocaleDateString('pt-BR')}${s.arlo_protocolo ? ' · protocolo ' + E(s.arlo_protocolo) : ''}.</p>` : ''}`;
  }

  function cartaoAjuda(eu, m, s, hab) {
    if (s && s.situacao !== 'devolvida') return `<div class="bloco pag-c"><h3>Ajuda de custo · ${nomeMes(m)}</h3>
      <p class="num" style="font-size:22px;margin:0">${brl(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado)}</p>${situacaoTxt(s)}</div>`;
    if (!garantirCustos()) return '<div class="bloco pag-c"><p class="carregando">Calculando…</p></div>';
    const vinc = vinculadas();
    const feitas = (S().visitas || []).filter(v => v.executor_id === eu.id && v.situacao === 'realizada' && String(v.data_realizada).slice(0, 7) === m && !v._fila)
      .sort((a, b) => String(a.data_realizada).localeCompare(String(b.data_realizada)));
    const livres = feitas.filter(v => !vinc[v.id] || (s && vinc[v.id] === s.id));
    const itens = livres.map(v => ({ v, c: MQ.custosUI.custoVisita(v), f: (S().fichas || []).find(x => x.id === v.ficha_id) || {} }));
    const total = itens.reduce((t, i) => t + i.c.total, 0);
    const estimado = itens.some(i => i.c.fonte !== 'conferido');
    const semKm = itens.some(i => !i.c.completo);
    const pend = (S().visitas || []).filter(v => v.executor_id === eu.id && v.situacao === 'prevista' && String(v.data_prevista).slice(0, 7) <= m).length;
    return `<form class="bloco pag-c" data-form="pag-ajuda" data-mes="${m}" novalidate><h3>Ajuda de custo · ${nomeMes(m)}</h3>
      ${s ? situacaoTxt(s) : ''}
      ${itens.length ? `<div class="pag-vis">${itens.map(i => `<label class="pv"><input type="checkbox" name="v" value="${E(i.v.id)}" checked>
          <span><b>${E(MQ.ETAPAS_CUSTO[i.v.etapa])}</b> · ${R.fmtData(i.v.data_realizada)}<br><span class="small muted">${E(i.f.municipio || '')} · ${i.c.km != null ? i.c.km + ' km ' + (i.c.fonte === 'conferido' ? 'conferidos' : 'estimados') : 'sem distância'}</span></span>
          <span class="num">${brl(i.c.total)}</span></label>`).join('')}</div>
        <p class="pag-total"><span>Total</span><b class="num">${brl(total)}</b></p>
        ${estimado ? '<p class="small muted">Distância estimada pelo município: a coordenação confere o km no aval e o valor pode mudar.</p>' : ''}
        ${semKm ? '<p class="small" style="color:var(--crit)">Há visita sem distância calculada: só as horas e a refeição entram. Avise a coordenação para conferir o km.</p>' : ''}
        <div class="aviso erro" data-erro hidden></div>
        <button class="btn pri" type="submit" ${hab ? '' : 'disabled'}>${s ? 'Corrigir e reenviar' : 'Solicitar'} ${brl(total)}</button>`
        : `<p class="muted">Nenhuma visita feita em ${nomeMes(m)} para solicitar.</p>`}
      ${pend ? `<p class="small muted">${pend} visita${pend > 1 ? 's' : ''} ainda sem registro de feita. Registre na lista de visitas para entrarem aqui.</p>` : ''}</form>`;
  }

  function cartaoBolsa(eu, m, s, hab) {
    const valor = P[eu.papel].bolsa;
    if (s && s.situacao !== 'devolvida') return `<div class="bloco pag-c"><h3>Bolsa · ${nomeMes(m)}</h3>
      <p class="num" style="font-size:22px;margin:0">${valor ? brl(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado) : 'Conforme o termo'}</p>${situacaoTxt(s)}</div>`;
    return `<form class="bloco pag-c" data-form="pag-bolsa" data-mes="${m}" novalidate><h3>Bolsa · ${nomeMes(m)}</h3>
      ${s ? situacaoTxt(s) : ''}
      <p class="small muted">${valor ? 'Valor do termo de compromisso: <b>' + brl(valor) + '</b>.' : 'Valor conforme o termo de compromisso.'} O aval é da ${quemAvaliza('bolsa', eu.papel) === 'coord_geral' ? 'coordenação geral' : 'coordenação técnica'}.</p>
      <div class="campo"><label for="pb-rel-${m}">Relatório de atividades do mês</label><textarea id="pb-rel-${m}" name="relatorio" rows="5" placeholder="O que você fez no mês: comunidades mobilizadas, fichas, visitas acompanhadas, reuniões, dificuldades.">${E(s ? s.relatorio || '' : '')}</textarea></div>
      <div class="aviso erro" data-erro hidden></div>
      <button class="btn pri" type="submit" ${hab ? '' : 'disabled'}>${s ? 'Corrigir e reenviar' : 'Solicitar bolsa de ' + nomeMes(m)}</button></form>`;
  }

  function linha(s, comPessoa) {
    const p = pessoa(s.equipe_id);
    return `<button class="vagabtn pag-l" data-acao="pag-ver" data-id="${E(s.id)}">
      ${comPessoa ? U().avatar(p, 40) : ''}<span class="vb-t"><span class="nm">${comPessoa ? E(nomeDe(p)) + ' · ' : ''}${TIPO[s.tipo]} de ${nomeMes(s.mes)}</span>
      <span class="sub">${comPessoa ? E(P[p.papel] ? P[p.papel].curto : '') + (p.uf ? ' · ' + E(p.uf) : '') + ' · ' : ''}${brl(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado)} · enviada em ${new Date(s.solicitada_em).toLocaleDateString('pt-BR')}</span></span>
      <span>${chip(s)}</span></button>`;
  }

  /* ---------- coordenação: aba Pagamentos ---------- */
  function abaCoord() {
    if (S().pagSemBanco) return semBanco();
    const eu = S().eu; const souGeral = eu.papel === 'coord_geral';
    const minhaVez = s => s.situacao === 'solicitada' && s.equipe_id !== eu.id && quemAvaliza(s.tipo, pessoa(s.equipe_id).papel) === eu.papel;
    const aval = lista().filter(minhaVez);
    const outrasAval = lista().filter(s => s.situacao === 'solicitada' && !minhaVez(s));
    const arlo = lista().filter(s => s.situacao === 'avalizada'), dev = lista().filter(s => s.situacao === 'devolvida'), lanc = lista().filter(s => s.situacao === 'lancada');
    const soma = l => l.reduce((t, s) => t + (+(s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado) || 0), 0);
    const bloco = (t, l, vazio, aberto) => `<section class="secao"><div class="secao-cab"><h2>${t} <span class="conta-t">${l.length}</span></h2>${l.length ? `<span class="muted">${brl(soma(l))}</span>` : ''}</div>
      ${l.length ? `<div class="pag-lista">${l.map(s => linha(s, true)).join('')}</div>` : `<p class="muted">${vazio}</p>`}</section>`;
    return `<div class="cab"><div><span class="eyebrow">Pagamentos</span><h1>Solicitações de pagamento</h1>
        <p>Quem visita ou recebe bolsa solicita; ${souGeral ? 'a coordenação técnica dá o aval na ajuda de custo e na bolsa das bolsistas; você, na bolsa da coordenação técnica, dos professores e dos auxiliares (e pode substituir a técnica)' : 'você dá o aval na ajuda de custo e na bolsa das bolsistas'}. Com o aval, o auxiliar administrativo lança no Arlo.</p></div></div>
      <div class="resumo">
        <div><span class="v num" ${aval.length ? 'style="color:var(--crit)"' : ''}>${aval.length}</span><span class="l">esperando o seu aval</span></div>
        <div><span class="v num">${arlo.length}</span><span class="l">com aval, falta lançar no Arlo</span></div>
        <div><span class="v num">${dev.length}</span><span class="l">devolvidas para corrigir</span></div>
        <div><span class="v num">${brl(soma(lanc))}</span><span class="l">lançado no Arlo (${lanc.length})</span></div></div>
      ${bloco('Esperando o seu aval', aval, 'Nada esperando o seu aval.')}
      ${outrasAval.length ? bloco(souGeral ? 'Com a coordenação técnica (você pode dar o aval se ela não puder)' : 'Com a coordenação geral', outrasAval, '') : ''}
      ${bloco('Com aval, falta o auxiliar lançar no Arlo', arlo, 'Nenhuma.')}
      ${dev.length ? bloco('Devolvidas para corrigir', dev, '') : ''}
      <details class="hist"><summary>Lançadas no Arlo (${lanc.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${lanc.map(s => linha(s, true)).join('') || '<p class="muted">Nenhuma ainda.</p>'}</div></details>
      ${eu.papel === 'coord_tecnico' ? secaoMinha() : ''}`;
  }

  /* ---------- auxiliar: lançar no Arlo ---------- */
  function secaoAuxiliar() {
    if (S().pagSemBanco) return `<section class="secao"><h2>Pagamentos para lançar no Arlo</h2>${semBanco()}</section>`;
    const eu = S().eu;
    const fila = lista().filter(s => s.situacao === 'avalizada' && s.equipe_id !== eu.id).sort((a, b) => String(a.aval_em).localeCompare(String(b.aval_em)));
    const feitas = lista().filter(s => s.situacao === 'lancada').slice(0, 30);
    return `<section class="secao"><div class="secao-cab"><div><h2>Pagamentos para lançar no Arlo <span class="conta-t">${fila.length}</span></h2>
        <p>Já têm o aval da coordenação. Lance no Arlo e registre aqui (com o número do protocolo, se houver).</p></div></div>
      ${fila.length ? `<div class="pag-lista">${fila.map(s => linha(s, true)).join('')}</div>` : '<p class="muted">Nada para lançar agora.</p>'}
      ${feitas.length ? `<details class="hist"><summary>Já lançadas (${feitas.length} mais recentes)</summary><div class="pag-lista" style="padding:0 18px 16px">${feitas.map(s => linha(s, true)).join('')}</div></details>` : ''}
    </section>`;
  }

  /* ---------- painel da solicitação ---------- */
  function painel(p) {
    const s = lista().find(x => x.id === p.id); if (!s) return '';
    const eu = S().eu; const pe = pessoa(s.equipe_id);
    const podeAval = s.situacao === 'solicitada' && s.equipe_id !== eu.id && (eu.papel === 'coord_geral' || quemAvaliza(s.tipo, pe.papel) === eu.papel);
    const podeArlo = s.situacao === 'avalizada' && s.equipe_id !== eu.id && ['auxiliar_adm', 'coord_geral'].includes(eu.papel);
    let conf = null, visHTML = '';
    if (s.tipo === 'ajuda_custo') {
      const ids = Object.entries(vinculadas()).filter(([, sid]) => sid === s.id).map(([vid]) => vid);
      const vs = ids.map(id => (S().visitas || []).find(v => v.id === id)).filter(Boolean);
      if (vs.length && /^coord/.test(eu.papel) && garantirCustos()) {   // coordenação recalcula com o km conferido
        const itens = vs.map(v => ({ v, c: MQ.custosUI.custoVisita(v), f: (S().fichas || []).find(x => x.id === v.ficha_id) || {} }));
        conf = itens.reduce((t, i) => t + i.c.total, 0);
        visHTML = `<table class="tab-uf"><thead><tr><th>Visita</th><th>Km (ida)</th><th style="text-align:right">Valor</th></tr></thead><tbody>${itens.map(i => `<tr>
          <td>${E(MQ.ETAPAS_CUSTO[i.v.etapa])} · ${R.fmtData(i.v.data_realizada)}<br><span class="small muted">${E(i.f.nome || '')} · ${E(i.f.municipio || '')}${i.v.relato ? ' · ' + E(String(i.v.relato).slice(0, 80)) : ''}</span></td>
          <td>${i.c.km != null ? i.c.km + (i.c.fonte === 'conferido' ? ' (conferido)' : ' (estimado)') : '—'}</td><td class="num" style="text-align:right">${brl(i.c.total)}</td></tr>`).join('')}</tbody></table>
          <p class="small muted">Para conferir o km, use Custos → Pagamento do mês antes de dar o aval.</p>`;
      } else {
        const d = (s.detalhe && s.detalhe.visitas) || [];
        visHTML = d.length ? `<table class="tab-uf"><thead><tr><th>Visita</th><th>Município</th><th style="text-align:right">Valor</th></tr></thead><tbody>${d.map(x => `<tr><td>${E(MQ.ETAPAS_CUSTO[x.etapa] || x.etapa)} · ${R.fmtData(x.data)}</td><td>${E(x.municipio || '')}</td><td class="num" style="text-align:right">${brl(x.total)}</td></tr>`).join('')}</tbody></table>` : '';
      }
    }
    const val = s.valor_avalizado != null ? s.valor_avalizado : s.valor_solicitado;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${TIPO[s.tipo]} · ${nomeMes(s.mes)}</span><h2 id="painel-t">${E(nomeDe(pe))}</h2>
        <span class="small muted">${E(P[pe.papel] ? P[pe.papel].nome : '')}${pe.uf ? ' · ' + E(pe.uf) : ''}${['auxiliar_adm', 'coord_geral'].includes(eu.papel) && pe.cpf ? ' · CPF ' + E(R.fmtCPF(pe.cpf)) : ''}</span></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        <div class="bloco"><dl class="dl"><dt>Situação</dt><dd>${chip(s)}</dd><dt>Valor solicitado</dt><dd class="num">${brl(s.valor_solicitado)}</dd>
          ${s.valor_avalizado != null ? `<dt>Valor com aval</dt><dd class="num"><b>${brl(s.valor_avalizado)}</b></dd>` : ''}
          <dt>Enviada em</dt><dd>${new Date(s.solicitada_em).toLocaleString('pt-BR')}</dd>
          ${s.aval_em ? `<dt>${s.situacao === 'devolvida' ? 'Devolvida' : 'Aval'} em</dt><dd>${new Date(s.aval_em).toLocaleString('pt-BR')} por ${E(nomeDe(pessoa(s.aval_por)))}</dd>` : ''}
          ${s.obs_aval ? `<dt>Observação</dt><dd>${E(s.obs_aval)}</dd>` : ''}
          ${s.arlo_em ? `<dt>Lançada no Arlo</dt><dd>${new Date(s.arlo_em).toLocaleDateString('pt-BR')} por ${E(nomeDe(pessoa(s.arlo_por)))}${s.arlo_protocolo ? ' · protocolo ' + E(s.arlo_protocolo) : ''}</dd>` : ''}</dl></div>
        ${s.relatorio ? `<div class="bloco"><h3>Relatório de atividades</h3><p style="white-space:pre-wrap">${E(s.relatorio)}</p></div>` : ''}
        ${visHTML ? `<div class="bloco"><h3>Visitas</h3>${visHTML}${conf != null && Math.abs(conf - s.valor_solicitado) >= 0.01 ? `<div class="aviso">Recalculado agora: <b>${brl(conf)}</b> (solicitado: ${brl(s.valor_solicitado)}). A diferença vem do km conferido ou dos valores da aba Custos.</div>` : ''}</div>` : ''}
        ${podeAval ? `<form class="bloco" data-form="pag-aval" data-id="${E(s.id)}" novalidate><h3>Aval</h3>
          <div class="campos"><div class="campo"><label for="pa-val">Valor com aval (R$)</label><input id="pa-val" name="valor" inputmode="decimal" value="${val != null ? String((conf != null ? conf : val).toFixed(2)).replace('.', ',') : ''}"></div>
          <div class="campo inteiro"><label for="pa-obs">Observação (obrigatória para devolver)</label><textarea id="pa-obs" name="obs" placeholder="Ex.: falta a foto da implantação de 12/10; conferir o km de Pio IX."></textarea></div></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn pri" type="submit" name="ok" value="1">Dar aval</button><button class="btn perigo" type="submit" name="ok" value="0">Devolver para corrigir</button></div></form>` : ''}
        ${podeArlo ? `${MQ.bancoUI ? MQ.bancoUI.blocoContaArlo(pe) : ''}<form class="bloco" data-form="pag-arlo" data-id="${E(s.id)}" novalidate><h3>Lançar no Arlo</h3>
          <p class="small muted">Lance <b>${brl(val)}</b> no Arlo para ${E(nomeDe(pe))} (${TIPO[s.tipo].toLowerCase()} de ${nomeMes(s.mes)}) e registre aqui.</p>
          <div class="campo"><label for="pr-prot">Número do protocolo no Arlo <span class="muted">(se houver)</span></label><input id="pr-prot" name="protocolo" autocomplete="off"></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn pri" type="submit">Registrar: lançado no Arlo</button></div></form>` : ''}
      </div>`;
  }

  /* ---------- ações ---------- */
  async function recarregar() { await U().carregar(); U().render(); }
  async function clique(a, el) {
    if (a === 'pag-mes') { const n = +el.dataset.n; G.mes = n === 0 ? mesHoje() : somaMes(G.mes || mesHoje(), n); if (G.mes > mesHoje()) G.mes = mesHoje(); U().render(); }
    else if (a === 'pag-ver') U().abrirPainel({ tipo: 'pag-ver', id: el.dataset.id });
  }
  document.addEventListener('click', ev => { const b = ev.target.closest('form[data-form=pag-aval] button[name=ok]'); if (b) b.form.dataset.ok = b.value; }, true);

  async function enviar(tipo, form, fd) {
    const mes = form.dataset.mes;
    if (tipo === 'pag-ajuda') {
      const ids = fd.getAll('v'); if (!ids.length) return U().mostrarErros(form, {}, 'Marque pelo menos uma visita.');
      const vs = ids.map(id => (S().visitas || []).find(v => v.id === id)).filter(Boolean);
      const itens = vs.map(v => { const c = MQ.custosUI.custoVisita(v); const f = (S().fichas || []).find(x => x.id === v.ficha_id) || {};
        return { id: v.id, etapa: v.etapa, data: v.data_realizada, municipio: f.municipio || null, km: c.km, fonte: c.fonte, total: Math.round(c.total * 100) / 100 }; });
      const total = Math.round(itens.reduce((t, i) => t + i.total, 0) * 100) / 100;
      await U().ocupado(form, async () => {
        await S().api.solicitarPagamento('ajuda_custo', mes + '-01', total, null, ids, { visitas: itens, total });
        await recarregar(); U().toast('Ajuda de custo de ' + nomeMes(mes) + ' solicitada: ' + brl(total) + '. Agora vai para o aval.');
      });
    }
    if (tipo === 'pag-bolsa') {
      const rel = String(fd.get('relatorio') || '').trim();
      if (rel.length < 50) return U().mostrarErros(form, { relatorio: 'Conte em algumas linhas o que você fez no mês (pelo menos 50 letras).' });
      const valor = P[S().eu.papel].bolsa;
      await U().ocupado(form, async () => {
        await S().api.solicitarPagamento('bolsa', mes + '-01', valor ? Math.round(valor * 100) / 100 : null, rel, [], {});
        await recarregar(); U().toast('Bolsa de ' + nomeMes(mes) + ' solicitada. Agora vai para o aval.');
      });
    }
    if (tipo === 'pag-aval') {
      const ok = form.dataset.ok !== '0'; const obs = String(fd.get('obs') || '').trim();
      const vtxt = String(fd.get('valor') || '').trim(); const valor = vtxt === '' ? null : Number(vtxt.replace(/\./g, '').replace(',', '.'));
      if (!ok && obs.length < 5) return U().mostrarErros(form, { obs: 'Escreva o que precisa ser corrigido.' });
      if (ok && valor != null && !(valor >= 0)) return U().mostrarErros(form, { valor: 'Valor inválido.' });
      await U().ocupado(form, async () => {
        await S().api.avalizarPagamento(form.dataset.id, ok, obs, ok ? valor : null);
        await recarregar(); U().fecharPainel(); U().toast(ok ? 'Aval registrado. A solicitação foi para o auxiliar lançar no Arlo.' : 'Solicitação devolvida. A pessoa vê o motivo e pode corrigir.');
      });
    }
    if (tipo === 'pag-arlo') {
      await U().ocupado(form, async () => {
        await S().api.registrarNoArlo(form.dataset.id, String(fd.get('protocolo') || '').trim());
        await recarregar(); U().fecharPainel(); U().toast('Registrado: lançado no Arlo.');
      });
    }
  }

  MQ.pagUI = { secaoMinha, abaCoord, secaoAuxiliar, painel, clique, enviar,
    contaAval: () => { const eu = S().eu; return lista().filter(s => s.situacao === 'solicitada' && s.equipe_id !== eu.id && quemAvaliza(s.tipo, pessoa(s.equipe_id).papel) === eu.papel).length; } };
})();
