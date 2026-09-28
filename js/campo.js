/* Mulheres & Quintais — trabalho de campo: agente de campo, visitas (roteiro e dias de campo)
   e diagnóstico + plano do quintal (modelo 3, feito na 1ª visita). Funciona sem internet. */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui;
  const S = () => MQ.ui.S;
  const E = s => MQ.ui.esc(s);
  const $ = s => document.querySelector(s);
  const fotosTemp = {};
  let mesRoteiro = null;          // 'AAAA-MM'
  let ufRoteiro = '';

  /* ---------- dados combinados: servidor + fila do aparelho ---------- */
  function visitas() {
    const m = new Map((S().visitas || []).map(v => [v.id, Object.assign({}, v)]));
    S().fila.filter(i => i.tipo === 'visita').forEach(i => m.set(i.id, Object.assign({}, m.get(i.id) || {}, i.dados, { _fila: true, _erro: i.erro })));
    // diagnóstico ainda na fila marca a visita como feita (para quem está sem internet)
    S().fila.filter(i => i.tipo === 'diagnostico').forEach(i => { const v = m.get(i.dados.visita_id); if (v) { v.situacao = 'realizada'; v.data_realizada = i.dados.data_visita; } });
    return [...m.values()];
  }
  function diagnosticos() {
    const m = new Map((S().diagnosticos || []).map(d => [d.id, Object.assign({}, d)]));
    S().fila.filter(i => i.tipo === 'diagnostico').forEach(i => m.set(i.id, Object.assign({}, m.get(i.id) || {}, i.dados, { _fila: true, _erro: i.erro, situacao: (m.get(i.id) || {}).situacao || 'aguardando' })));
    return [...m.values()];
  }
  const ficha = id => (S().fichas || []).find(f => f.id === id);
  const pessoa = id => (S().equipe || []).find(p => p.id === id);
  const primeiroNome = n => String(n || '').split(' ')[0];
  const pessoasCampo = uf => (S().equipe || []).filter(p => p.status === 'ativa' && R.ehCampo(p.papel) && p.uf === uf)
    .sort((a, b) => (a.papel === 'agente') - (b.papel === 'agente') || a.nome.localeCompare(b.nome));
  const selecionadas = uf => (S().fichas || []).filter(f => f.uf === uf && f.resultado === 'selecionada' && f.situacao === 'aprovada')
    .sort((a, b) => a.municipio.localeCompare(b.municipio) || a.nome.localeCompare(b.nome));
  const ativasDe = (fid, etapa) => visitas().filter(v => v.ficha_id === fid && v.etapa === etapa && v.situacao !== 'cancelada')
    .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)));
  const diasUsados = uf => visitas().filter(v => v.uf === uf && v.situacao !== 'cancelada').length;
  const mesAtual = () => R.hoje().slice(0, 7);
  const nomeMes = m => { const [a, b] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+b - 1] + '/' + a; };
  const mesMais = (m, n) => { const [a, b] = m.split('-').map(Number); const d = new Date(a, b - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const codigoQuintal = f => f.uf + '-' + String(f.id).replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase();
  const podeAgendar = uf => S().eu.papel === 'coord_tecnico' || (R.ehBolsista(S().eu.papel) && S().eu.uf === uf);

  /* etapa de cada quintal, em forma de "pílulas" */
  function pilulas(f) {
    const dg = diagnosticos().find(d => d.ficha_id === f.id);
    const p = (rot, vs, extra) => {
      const v = vs[0];
      if (!v) return `<span class="pil">${rot}</span>`;
      if (v.situacao === 'realizada') return `<span class="pil feito" title="Feita em ${R.fmtData(v.data_realizada)}">${rot} ✓</span>`;
      return `<span class="pil prev" title="Prevista para ${R.fmtData(v.data_prevista)} com ${E((pessoa(v.executor_id) || {}).nome || '')}">${rot} ${R.fmtData(v.data_prevista).slice(0, 5)}</span>`;
    };
    const ac = ativasDe(f.id, 'acompanhamento');
    return `<span class="pils">${p('Diagnóstico', ativasDe(f.id, 'diagnostico'))}
      ${dg ? `<span class="pil ${dg.sem_agua ? 'crit' : dg.situacao === 'aprovado' ? 'feito' : dg.situacao === 'devolvido' ? 'crit' : 'prev'}">${dg.sem_agua ? 'Sem água' : 'Plano ' + (dg.situacao === 'aprovado' ? 'aprovado' : dg.situacao === 'devolvido' ? 'devolvido' : 'em análise')}</span>` : ''}
      ${p('Implantação', ativasDe(f.id, 'implantacao'))}${p('Acomp. 1', ac.slice(0, 1))}${p('Acomp. 2', ac.slice(1, 2))}</span>`;
  }

  /* ---------- roteiro do mês (é o pedido de ajuda de custo) ---------- */
  function roteiro(uf, podeMudar) {
    const m = mesRoteiro || mesAtual();
    const vs = visitas().filter(v => (!uf || v.uf === uf) && v.situacao !== 'cancelada' && String(v.situacao === 'realizada' ? v.data_realizada : v.data_prevista).slice(0, 7) === m)
      .sort((a, b) => String(a.data_realizada || a.data_prevista).localeCompare(String(b.data_realizada || b.data_prevista)));
    const porPessoa = {};
    vs.forEach(v => { const k = v.executor_id; porPessoa[k] = porPessoa[k] || { prev: 0, feitas: 0 }; porPessoa[k][v.situacao === 'realizada' ? 'feitas' : 'prev']++; });
    return `<div class="bloco roteiro">
      <div class="secao-cab"><h3>Roteiro de campo · ${nomeMes(m)}</h3>
        <span class="seg"><button type="button" data-acao="campo-mes" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" data-acao="campo-mes" data-n="0">Este mês</button><button type="button" data-acao="campo-mes" data-n="1" aria-label="Próximo mês">›</button></span></div>
      <p class="small muted">Cada visita a um quintal é 1 dia de campo de quem visita, e é a base da ajuda de custo. O roteiro do mês seguinte fica fechado até o dia 20.</p>
      ${vs.length ? `<div class="quadro-scroll" style="display:block"><table class="quadro tab-rot"><thead><tr><th>Data</th>${uf ? '' : '<th>UF</th>'}<th>Mulher</th><th>Etapa</th><th>Quem visita</th><th>Situação</th></tr></thead><tbody>
        ${vs.map(v => { const f = ficha(v.ficha_id) || {}; const q = pessoa(v.executor_id) || {};
          return `<tr><td class="num">${R.fmtData(v.data_realizada || v.data_prevista)}</td>${uf ? '' : `<td>${E(v.uf)}</td>`}<td>${E(f.nome || '—')}<br><span class="small muted">${E(f.municipio || '')}</span></td>
            <td>${E(MQ.ETAPAS[v.etapa].nome)}</td><td>${E(q.nome || '—')}<br><span class="small muted">${E((MQ.PAPEIS[q.papel] || {}).curto || '')}</span></td>
            <td>${v.situacao === 'realizada' ? '<span class="chip ok">Feita</span>' : v._fila ? '<span class="chip pend">No aparelho</span>' : '<span class="chip pend">Prevista</span>'}
              ${podeMudar && v.situacao === 'prevista' ? ` <button class="link small" data-acao="campo-visita-editar" data-id="${E(v.id)}">Mudar</button>` : ''}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="dias-pessoa">${Object.entries(porPessoa).map(([id, c]) => `<span><b>${E(primeiroNome((pessoa(id) || {}).nome))}</b> ${c.feitas + c.prev} dia${c.feitas + c.prev > 1 ? 's' : ''} <span class="muted">(${c.feitas} feita${c.feitas === 1 ? '' : 's'})</span></span>`).join('')}</div>`
        : '<p class="muted">Nenhuma visita neste mês.</p>'}
    </div>`;
  }

  /* ---------- tela da bolsista: trabalho de campo do estado ---------- */
  const semBanco = () => `<section class="secao"><div class="secao-cab"><h2>Trabalho de campo</h2></div><div class="aviso"><b>Ainda não instalado no servidor.</b> A coordenação geral precisa rodar o arquivo 03_campo.sql no Supabase. Até lá, use os modelos em papel.</div></section>`;
  function secaoBolsista() {
    if (S().campoSemBanco) return semBanco();
    const uf = S().eu.uf;
    const sel = selecionadas(uf);
    const dg = diagnosticos().filter(d => d.uf === uf);
    const usados = diasUsados(uf);
    const pend = S().fila.filter(i => i.tipo === 'visita' || i.tipo === 'diagnostico');
    return `<section class="secao" aria-labelledby="t-campo">
      <div class="secao-cab"><div><h2 id="t-campo">Trabalho de campo · ${E(U().nomeUF(uf))}</h2>
        <p>Diagnóstico com plano do quintal na 1ª visita, depois implantação e 2 acompanhamentos. Quem visita pode ser você, a outra bolsista ou uma agente de campo habilitada.</p></div>
        ${sel.length ? '<button class="btn pri" data-acao="campo-visita-nova">+ Agendar visita</button>' : ''}</div>
      <div class="resumo">
        <div><span class="v num">${usados}<small> de ${MQ.DIAS_CAMPO_UF}</small></span><span class="l">dias de campo usados no estado</span></div>
        <div><span class="v num">${dg.length}<small> de ${MQ.VAGAS_UF}</small></span><span class="l">diagnósticos registrados</span></div>
        <div><span class="v num">${dg.filter(d => d.situacao === 'aprovado').length}</span><span class="l">planos aprovados</span></div>
        <div><span class="v num">${dg.filter(d => d.sem_agua).length}</span><span class="l">sem água na seca</span></div>
      </div>
      ${pend.length ? `<div class="aviso${pend.some(i => i.erro) ? ' erro' : ''}"><b>${pend.length} registro${pend.length > 1 ? 's' : ''} de campo neste aparelho</b>${pend.some(i => i.erro) ? ': ' + E(pend.find(i => i.erro).erro) : ', aguardando internet para enviar.'}
        ${navigator.onLine ? ' <button class="link" data-acao="ficha-enviar">Enviar agora</button>' : ''}</div>` : ''}
      ${sel.length ? `<div class="lista-fichas">${sel.map(f => {
          const temDiag = diagnosticos().some(d => d.ficha_id === f.id);
          return `<div class="quintal"><div><b>${E(f.nome)}</b><br><span class="small muted">${E(f.municipio)} · ${E(f.comunidade)} · ${codigoQuintal(f)}</span></div>
            ${pilulas(f)}
            <div class="acoes">${temDiag ? `<button class="btn peq" data-acao="campo-diag-ver" data-ficha="${E(f.id)}">Ver diagnóstico</button>`
              : `<button class="btn peq pri" data-acao="campo-diag-novo" data-ficha="${E(f.id)}">Registrar diagnóstico</button>`}</div></div>`; }).join('')}</div>`
        : '<div class="vazio"><span>As visitas começam quando a coordenação técnica aprovar as primeiras fichas como "selecionada".</span></div>'}
      ${roteiro(uf, true)}
    </section>`;
  }

  /* ---------- tela da agente de campo ---------- */
  function telaAgente() {
    const eu = S().eu; const s = R.situacao(eu);
    const minhas = visitas().filter(v => v.executor_id === eu.id && v.situacao !== 'cancelada')
      .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)));
    const prox = minhas.filter(v => v.situacao !== 'realizada'), feitas = minhas.filter(v => v.situacao === 'realizada');
    const linha = v => { const f = ficha(v.ficha_id) || {}; const dg = diagnosticos().find(d => d.visita_id === v.id);
      return `<div class="quintal"><div><b>${E(f.nome || 'Quintal')}</b><br><span class="small muted">${E(f.municipio || '')} · ${E(f.comunidade || '')} · ${f.id ? codigoQuintal(f) : ''}</span></div>
        <span class="pils"><span class="pil ${v.situacao === 'realizada' ? 'feito' : 'prev'}">${E(MQ.ETAPAS[v.etapa].nome)} · ${R.fmtData(v.data_realizada || v.data_prevista)}</span>
          ${dg && dg.situacao === 'devolvido' ? '<span class="pil crit">Devolvido para corrigir</span>' : ''}</span>
        <div class="acoes">${v.etapa === 'diagnostico' ? (dg ? `<button class="btn peq" data-acao="campo-diag-ver" data-ficha="${E(v.ficha_id)}">Ver diagnóstico</button>`
          : `<button class="btn peq pri" data-acao="campo-diag-novo" data-ficha="${E(v.ficha_id)}" data-visita="${E(v.id)}">Registrar diagnóstico</button>`)
          : '<span class="small muted">Formulário desta etapa em preparação: use o modelo em papel.</span>'}</div></div>`; };
    const porMes = {}; feitas.forEach(v => { const m = String(v.data_realizada).slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; });
    const pend = S().fila.filter(i => i.tipo === 'diagnostico');
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">Agente de campo · ${E(U().nomeUF(eu.uf))}</span><h1>Olá, ${E(primeiroNome(eu.nome))}</h1>
        <p>${E(MQ.PAPEIS.agente.faz)}</p></div><span class="chip ${s.cod}" style="font-size:13px;padding:4px 12px">${E(s.rot)}</span></div>
      ${!R.habilitado(eu) ? `<div class="aviso erro"><b>Você ainda não pode receber visitas no roteiro.</b> Faltam passos da habilitação (matrícula no FIC, documentos na FUNCERN e termo). Sem eles, a ajuda de custo não pode ser paga.</div>` : ''}
      ${pend.length ? `<div class="aviso">${pend.length} diagnóstico${pend.length > 1 ? 's' : ''} guardado${pend.length > 1 ? 's' : ''} neste aparelho, aguardando internet.${navigator.onLine ? ' <button class="link" data-acao="ficha-enviar">Enviar agora</button>' : ''}</div>` : ''}
      <section class="secao"><div class="secao-cab"><h2>Próximas visitas</h2><span class="muted small">${prox.length} prevista${prox.length === 1 ? '' : 's'}</span></div>
        ${prox.length ? `<div class="lista-fichas">${prox.map(linha).join('')}</div>` : '<div class="vazio"><span>Nenhuma visita atribuída a você. Quem agenda é a bolsista do estado ou a coordenação técnica.</span></div>'}</section>
      <section class="secao"><div class="secao-cab"><h2>Visitas feitas</h2><span class="small">${Object.entries(porMes).map(([m, n]) => `<b>${nomeMes(m)}</b>: ${n} dia${n > 1 ? 's' : ''} de campo`).join(' · ') || ''}</span></div>
        ${feitas.length ? `<div class="lista-fichas">${feitas.map(linha).join('')}</div>` : '<p class="muted">Nenhuma ainda.</p>'}</section>
      ${MQ.bancoUI ? MQ.bancoUI.secaoMinha() : ''}
      <p class="nota">Você vê apenas as mulheres das visitas atribuídas a você. Os dados delas são protegidos pela LGPD: não fotografe telas nem repasse informações.</p>
    </main>`;
  }

  /* ---------- aba "Campo" da coordenação ---------- */
  function abaCoord() {
    if (S().campoSemBanco) return semBanco();
    const souTec = S().eu.papel === 'coord_tecnico';
    const dgs = diagnosticos();
    const aguard = dgs.filter(d => d.situacao === 'aguardando').sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
    const linhaUF = u => { const vs = visitas().filter(v => v.uf === u.uf && v.situacao !== 'cancelada');
      const feitas = vs.filter(v => v.situacao === 'realizada').length; const d = dgs.filter(x => x.uf === u.uf);
      const pct = Math.min(100, vs.length / MQ.DIAS_CAMPO_UF * 100), pctF = Math.min(100, feitas / MQ.DIAS_CAMPO_UF * 100);
      return `<tr><td class="uf"><span class="sigla">${u.uf}</span><span class="nomeuf">${u.nome}</span></td>
        <td><div style="display:grid;gap:4px"><span class="num"><b>${feitas}</b> feitos · ${vs.length - feitas} previstos · <span class="muted">de ${MQ.DIAS_CAMPO_UF}</span></span>
          <span class="medidor"><i style="width:${pct}%;opacity:.35"></i><i style="width:${pctF}%"></i></span></div></td>
        <td class="num">${d.length} <span class="muted">de 40</span></td><td class="num">${d.filter(x => x.situacao === 'aprovado').length}</td><td class="num">${d.filter(x => x.sem_agua).length}</td>
        <td class="num">${pessoasCampo(u.uf).filter(p => p.papel === 'agente').length}</td></tr>`; };
    return `<div class="cab"><div><span class="eyebrow">Trabalho de campo</span><h1 style="font-size:24px">Visitas, diagnósticos e planos</h1>
        <p>${souTec ? 'Você aprova ou devolve o plano de cada quintal antes da compra do kit.' : 'A aprovação dos planos é da coordenação técnica.'} Dias de campo: 160 por estado (40 quintais × 4 visitas).</p></div></div>
      <div class="quadro-scroll" style="display:block"><table class="quadro"><thead><tr><th>Estado</th><th>Dias de campo</th><th>Diagnósticos</th><th>Planos aprovados</th><th>Sem água</th><th>Agentes</th></tr></thead>
        <tbody>${MQ.UFS.map(linhaUF).join('')}</tbody></table></div>
      ${aguard.length ? `<div class="bloco"><h3>${souTec ? 'Planos para você aprovar' : 'Planos aguardando a coordenação técnica'} (${aguard.length})</h3><div class="lista-fichas">
        ${aguard.map(d => { const f = ficha(d.ficha_id) || {}; return `<button class="vagabtn ficha-linha" data-acao="campo-diag-ver" data-ficha="${E(d.ficha_id)}"><span class="nm">${E(f.nome || '—')}</span>
          <span style="display:flex;gap:6px;flex-wrap:wrap">${d.sem_agua ? '<span class="chip crit">Sem água: sem plano</span>' : `<span class="chip pend">Lote ${d.lote}</span>`}<span class="chip off">${E((d.dados && d.dados.kit || []).filter(k => k.item).length)} itens no kit</span></span>
          <span class="sub">${E(d.uf)} · ${E(f.municipio || '')} · visita em ${R.fmtData(d.data_visita)} por ${E((pessoa(d.executor_id) || {}).nome || '—')}</span></button>`; }).join('')}</div></div>` : ''}
      <div class="secao-cab"><h2>Roteiro</h2><span class="seg">${['', ...MQ.UFS.map(u => u.uf)].map(u => `<button type="button" data-acao="campo-uf" data-uf="${u}" aria-pressed="${ufRoteiro === u}">${u || 'Todos'}</button>`).join('')}</span></div>
      ${roteiro(ufRoteiro, souTec)}`;
  }

  /* ---------- painel: agendar / mudar visita ---------- */
  function painelVisita(p) {
    const eu = S().eu;
    const v = p.id ? visitas().find(x => x.id === p.id) : { id: MQ.novoId(), ficha_id: p.ficha || '', etapa: p.etapa || 'diagnostico', executor_id: '', data_prevista: '', situacao: 'prevista' };
    const f0 = v.ficha_id && ficha(v.ficha_id);
    const uf = f0 ? f0.uf : (eu.uf || p.uf || 'PI');
    const opF = selecionadas(uf).map(f => `<option value="${E(f.id)}" ${f.id === v.ficha_id ? 'selected' : ''}>${E(f.nome)} · ${E(f.municipio)}</option>`).join('');
    const opP = pessoasCampo(uf).map(q => { const h = R.habilitado(q);
      return `<option value="${E(q.id)}" ${q.id === v.executor_id ? 'selected' : ''} ${h ? '' : 'disabled'}>${E(q.nome)} · ${E(MQ.PAPEIS[q.papel].curto)}${h ? '' : ' (sem habilitação)'}</option>`; }).join('');
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${p.id ? 'Mudar visita' : 'Agendar visita'} · ${E(U().nomeUF(uf))}</span><h2 id="painel-t">Roteiro de campo</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="visita" data-id="${E(v.id)}" novalidate>
        <div class="campos">
          <div class="campo inteiro"><label for="vi-f">Mulher (quintal)</label><select id="vi-f" name="ficha_id" ${p.id ? 'disabled' : ''}><option value="">Escolha…</option>${opF}</select></div>
          <div class="campo"><label for="vi-e">Etapa</label><select id="vi-e" name="etapa" ${p.id ? 'disabled' : ''}>${Object.entries(MQ.ETAPAS).map(([k, e]) => `<option value="${k}" ${k === v.etapa ? 'selected' : ''}>${E(e.nome)}</option>`).join('')}</select></div>
          <div class="campo"><label for="vi-d">Data prevista</label><input id="vi-d" name="data_prevista" type="date" value="${E(v.data_prevista || '')}" min="${MQ.PROJETO.inicioDiagnosticos}" max="${MQ.PROJETO.vigencia.fim}"></div>
          <div class="campo inteiro"><label for="vi-p">Quem faz a visita</label><select id="vi-p" name="executor_id"><option value="">Escolha…</option>${opP}</select>
            <span class="dica">Só aparece quem está habilitada (FIC, FUNCERN e termo). Sem isso, o dia de campo não pode ser pago.</span></div>
          <div class="campo inteiro"><label for="vi-o">Observação</label><input id="vi-o" name="obs" value="${E(v.obs || '')}"></div>
        </div>
        <p class="small muted">Dias de campo no estado: <b class="num">${diasUsados(uf)}</b> de ${MQ.DIAS_CAMPO_UF}.</p>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">${p.id ? 'Salvar' : 'Agendar'}</button>
          ${p.id ? '<button class="btn perigo" type="button" data-acao="campo-visita-cancelar">Cancelar esta visita</button>' : ''}
          <button class="btn" type="button" data-acao="fechar">Fechar</button></div>
      </form></div>`;
  }

  /* ---------- painel: diagnóstico e plano do quintal ---------- */
  const chk = (nome, lista, marcados) => `<div class="chips-sel">${lista.map(([k, t]) => `<label class="sn${(marcados || []).includes(k) ? ' on' : ''}"><input type="checkbox" name="${nome}" value="${k}" ${(marcados || []).includes(k) ? 'checked' : ''}>${E(t)}</label>`).join('')}</div>`;
  const rad = (nome, ops, val) => `<span class="sn-par" style="flex-wrap:wrap">${ops.map(([k, t]) => `<label class="sn${val === k ? ' on' : ''}"><input type="radio" name="${nome}" value="${k}" ${val === k ? 'checked' : ''}>${E(t)}</label>`).join('')}</span>`;
  const linhaFamilia = (x = {}) => `<div class="linha-din" data-linha="familia">
    <input name="fam_nome" placeholder="Nome" value="${E(x.nome || '')}" aria-label="Nome"><input name="fam_idade" type="number" min="0" max="120" inputmode="numeric" placeholder="Idade" value="${E(x.idade ?? '')}" aria-label="Idade">
    <select name="fam_par" aria-label="Parentesco">${MQ.DIAG.parentesco.map(p => `<option ${x.parentesco === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
    <input name="fam_ocup" placeholder="Estuda / trabalha?" value="${E(x.ocupacao || '')}" aria-label="Estuda ou trabalha">
    <label class="mini-chk"><input type="checkbox" name="fam_ajuda" ${x.ajuda ? 'checked' : ''}>Ajuda no quintal</label>
    <button type="button" class="fechar" data-acao="campo-linha-rem" aria-label="Remover">×</button></div>`;
  const linhaKit = (x = {}) => `<div class="linha-din kit" data-linha="kit">
    <input name="kit_item" placeholder="Item (da lista aprovada)" value="${E(x.item || '')}" aria-label="Item"><input name="kit_qtd" placeholder="Qtd." value="${E(x.qtd || '')}" aria-label="Quantidade">
    <input name="kit_para" placeholder="Para quê" value="${E(x.para || '')}" aria-label="Para quê"><button type="button" class="fechar" data-acao="campo-linha-rem" aria-label="Remover">×</button></div>`;
  const linhaCron = (x = {}) => `<div class="linha-din kit" data-linha="cron">
    <input name="cr_oque" placeholder="O que fazer" value="${E(x.oque || '')}" aria-label="O que fazer"><input name="cr_ini" placeholder="Mês início" value="${E(x.inicio || '')}" aria-label="Mês de início">
    <input name="cr_fim" placeholder="Mês fim" value="${E(x.fim || '')}" aria-label="Mês de fim"><input name="cr_quem" placeholder="Quem faz" value="${E(x.quem || '')}" aria-label="Quem faz">
    <button type="button" class="fechar" data-acao="campo-linha-rem" aria-label="Remover">×</button></div>`;

  function painelDiag(p) {
    const f = ficha(p.ficha); if (!f) return '<div class="painel-corpo"><p>Ficha não encontrada.</p></div>';
    const atual = diagnosticos().find(d => d.ficha_id === f.id);
    const d = atual ? Object.assign({}, atual, atual.dados || {}) : { id: MQ.novoId(), ficha_id: f.id, visita_id: p.visita || '', data_visita: R.hoje(),
      latitude: f.latitude ?? null, longitude: f.longitude ?? null, familia: [{ nome: primeiroNome(f.nome), parentesco: 'Ela mesma', ajuda: true }], kit: [{}, {}, {}], cronograma: [{}, {}] };
    const v = k => E(d[k] == null ? '' : d[k]);
    const prod = d.producao || {};
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${atual ? 'Corrigir diagnóstico' : '1ª visita'} · ${E(f.uf)} · ${codigoQuintal(f)}</span>
        <h2 id="painel-t">Diagnóstico e plano do quintal</h2><span class="small">${E(f.nome)} · ${E(f.municipio)} · ${E(f.comunidade)}</span>
        ${atual && atual.situacao === 'devolvido' && atual.obs_coordenacao ? `<div class="aviso erro" style="margin-top:6px"><b>Devolvido pela coordenação técnica:</b> ${E(atual.obs_coordenacao)}</div>` : ''}</div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="diag" data-id="${E(d.id)}" data-ficha="${E(f.id)}" data-visita="${E(d.visita_id || '')}" novalidate>
        ${!f.consent_imagem ? '<div class="aviso"><b>Ela não autorizou uso de imagem:</b> fotografe o quintal sem que ela apareça.</div>' : ''}
        <fieldset><legend>Visita</legend><div class="campos">
          <div class="campo"><label for="dg-data">Data da visita</label><input id="dg-data" name="data_visita" type="date" value="${v('data_visita')}" max="${R.hoje()}"></div>
          <div class="campo"><label>Localização do quintal</label><button type="button" class="btn peq" data-acao="campo-gps">${d.latitude ? 'Localização registrada ✓' : 'Registrar localização'}</button>
            <input type="hidden" name="latitude" value="${v('latitude')}"><input type="hidden" name="longitude" value="${v('longitude')}"><span class="dica" id="dg-gps-dica">${d.latitude ? E(d.latitude + ', ' + d.longitude) : 'Registre em pé, no quintal.'}</span></div>
          <div class="campo inteiro" id="w-sem_gps_motivo"><label for="dg-semgps">Sem localização? Explique</label><input id="dg-semgps" name="sem_gps_motivo" value="${v('sem_gps_motivo')}" placeholder="Ex.: celular sem GPS; ela preferiu não registrar"></div>
        </div></fieldset>

        <fieldset><legend>1. Família</legend><div id="w-familia" class="linhas">${(d.familia || []).map(linhaFamilia).join('')}</div>
          <button type="button" class="link" data-acao="campo-linha-add" data-tipo="familia">+ Pessoa</button></fieldset>

        <fieldset><legend>2. Renda e políticas públicas</legend>
          ${chk('politicas', MQ.DIAG.politicas, d.politicas)}
          <div class="campos">
            <div class="campo"><label for="dg-rf">Renda da família por mês (R$)</label><input id="dg-rf" name="renda_familiar" type="number" min="0" step="10" inputmode="numeric" value="${v('renda_familiar')}"></div>
            <div class="campo"><label for="dg-fr">De onde vem a maior parte</label><input id="dg-fr" name="fonte_renda" value="${v('fonte_renda')}"></div>
          </div></fieldset>

        <fieldset><legend>3. O quintal e a água</legend><div class="campos">
          <div class="campo"><label for="dg-area">Área aproximada (m²)</label><input id="dg-area" name="area_m2" type="number" min="1" inputmode="numeric" value="${v('area_m2')}"></div>
          <div class="campo"><label>A terra é</label>${rad('terra', [['propria', 'Própria'], ['cedida', 'Cedida'], ['outra', 'Outra']], d.terra)}</div>
          <div class="campo"><label>Cercado?</label>${rad('cercado', [['sim', 'Sim'], ['nao', 'Não'], ['em_parte', 'Em parte']], d.cercado)}</div>
          <div class="campo inteiro" id="w-fontes_agua"><label>Fontes de água</label>${chk('fontes_agua', MQ.DIAG.fontes_agua, d.fontes_agua)}</div>
          <div class="campo inteiro" id="w-agua_seca"><label>A água dá para o quintal no período seco?</label>${rad('agua_seca', [['sim', 'Sim'], ['as_vezes', 'Às vezes'], ['nao', 'Não']], d.agua_seca)}</div>
          <div class="campo"><label for="dg-cap">Capacidade da fonte (litros)</label><input id="dg-cap" name="capacidade_litros" type="number" min="0" inputmode="numeric" value="${v('capacidade_litros')}"></div>
          <div class="campo"><label for="dg-meses">Meses que a água dura na seca</label><input id="dg-meses" name="meses_seca" type="number" min="0" max="12" inputmode="numeric" value="${v('meses_seca')}"></div>
          <div class="campo"><label for="dg-dist">Distância da fonte ao quintal (m)</label><input id="dg-dist" name="distancia_m" type="number" min="0" inputmode="numeric" value="${v('distancia_m')}"></div>
          <div class="campo"><label>Água de pia/tanque/banho reaproveitável?</label>${rad('reuso', [['sim', 'Sim'], ['nao', 'Não']], d.reuso === true ? 'sim' : d.reuso === false ? 'nao' : '')}</div>
          <div class="campo"><label>Irrigação</label>${rad('irrigacao', [['nao', 'Não tem'], ['regador', 'Regador/balde'], ['gotejamento', 'Gotejamento'], ['outra', 'Outra']], d.irrigacao)}</div>
          <div class="campo"><label>Solo</label>${rad('solo', [['arenoso', 'Arenoso'], ['argiloso', 'Argiloso'], ['pedregoso', 'Pedregoso'], ['nao_sabe', 'Não sabe']], d.solo)}</div>
          <div class="campo inteiro"><label for="dg-chuva">Meses em que costuma chover</label><input id="dg-chuva" name="meses_chuva" value="${v('meses_chuva')}" placeholder="Ex.: janeiro a abril"></div>
        </div><div id="dg-alerta-agua"></div></fieldset>

        <fieldset><legend>4. O que produz hoje</legend>
          <div class="prod">${MQ.DIAG.producao.map(([k, t]) => { const x = prod[k] || {};
            return `<div class="prod-l"><b>${E(t)}</b><input name="pr_${k}_qtd" placeholder="Quantidade (pés, canteiros, cabeças)" value="${E(x.qtd || '')}" aria-label="${E(t)}: quantidade">
              <label class="mini-chk"><input type="checkbox" name="pr_${k}_consumo" ${x.consumo ? 'checked' : ''}>Consumo</label><label class="mini-chk"><input type="checkbox" name="pr_${k}_venda" ${x.venda ? 'checked' : ''}>Venda/troca</label>
              <input name="pr_${k}_onde" placeholder="Onde vende" value="${E(x.onde || '')}" aria-label="${E(t)}: onde vende"></div>`; }).join('')}</div>
          <div class="campo"><label for="dg-rq">Quanto ganha com vendas do quintal por mês (R$)</label><input id="dg-rq" name="renda_quintal" type="number" min="0" step="10" inputmode="numeric" value="${v('renda_quintal')}"><span class="dica">Zero se não vende. É a linha de base: a visita final vai perguntar a mesma coisa.</span></div>
        </fieldset>

        <fieldset><legend>5 e 6. Práticas, trabalho e organização</legend>
          ${chk('praticas', MQ.DIAG.praticas, d.praticas)}
          <div class="campos"><div class="campo"><label for="dg-horas">Horas por dia no quintal</label><input id="dg-horas" name="horas_dia" type="number" min="0" max="16" step="0.5" inputmode="decimal" value="${v('horas_dia')}"></div></div>
          <label class="small muted">Participa de</label>${chk('participa', MQ.DIAG.participa, d.participa)}
        </fieldset>

        <fieldset><legend>7. Problemas e sonhos</legend><div class="campos">
          <div class="campo inteiro"><label for="dg-dif">Maiores dificuldades do quintal</label><textarea id="dg-dif" name="dificuldades">${v('dificuldades')}</textarea></div>
          <div class="campo inteiro"><label for="dg-son">O que ela quer produzir ou melhorar</label><textarea id="dg-son" name="sonhos">${v('sonhos')}</textarea></div>
        </div></fieldset>

        <fieldset id="w-fotos"><legend>8. Fotos e croqui</legend>
          <div class="campos">${MQ.DIAG.fotos.map(([k, t]) => { const tem = (d.fotos || []).some(x => new RegExp('diag_' + k).test(x)) || (atual && atual.exemplo);
            return `<div class="campo ${k === 'croqui' ? 'inteiro' : ''}"><label for="dg-f-${k}">${E(t)}${k === 'croqui' ? '' : ' *'}</label><input id="dg-f-${k}" name="foto_${k}" data-foto="${k}" type="file" accept="image/*" capture="environment">
              <span class="dica" id="dg-f-${k}-dica">${tem ? 'Já tem foto. Envie outra só para trocar.' : k === 'croqui' ? 'Desenhe no papel e fotografe.' : 'Obrigatória.'}</span></div>`; }).join('')}</div>
        </fieldset>

        <div data-parteb>
        <fieldset><legend>9. Plano do quintal: objetivo</legend>
          <div id="w-objetivos">${chk('objetivos', MQ.DIAG.objetivos, d.objetivos)}</div>
          <div class="campo"><label for="dg-frase">Em uma frase, o que ela quer alcançar em 12 meses</label><input id="dg-frase" name="frase_objetivo" value="${v('frase_objetivo')}"></div>
        </fieldset>
        <fieldset><legend>10. Kit escolhido</legend>
          <p class="small muted" style="margin-top:-6px">Só itens da lista aprovada pela coordenação, sem passar do valor por quintal. Sem irrigação, comece pelos itens de água (caixa d’água, gotejamento) e pela cobertura do solo.</p>
          <div id="w-kit" class="linhas">${(d.kit && d.kit.length ? d.kit : [{}]).map(linhaKit).join('')}</div>
          <button type="button" class="link" data-acao="campo-linha-add" data-tipo="kit">+ Item</button></fieldset>
        <fieldset><legend>11. Cronograma</legend>
          <div class="linhas">${(d.cronograma && d.cronograma.length ? d.cronograma : [{}]).map(linhaCron).join('')}</div>
          <button type="button" class="link" data-acao="campo-linha-add" data-tipo="cron">+ Atividade</button>
          <div class="campos">
            <div class="campo" id="w-lote"><label>Lote de implantação</label>${rad('lote', [['1', 'Lote 1 (jan–abr)'], ['2', 'Lote 2 (mai–jul)']], d.lote ? String(d.lote) : '')}</div>
            <div class="campo"><label for="dg-mes">Mês previsto</label><input id="dg-mes" name="mes_implantacao" value="${v('mes_implantacao')}" placeholder="No início das chuvas ou com água garantida"></div>
          </div></fieldset>
        <fieldset><legend>12. Compromissos</legend>
          <label class="check" id="w-compromissos"><input type="checkbox" name="compromissos" ${d.compromissos ? 'checked' : ''}><span>Ela concorda em usar o kit no quintal, cuidar da produção, receber as visitas, participar das formações e avisar a equipe se deixar de usar o quintal.</span></label>
        </fieldset>
        </div>
        <input type="hidden" name="fotos_existentes" value="${E((d.fotos || []).join('|'))}">
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Salvar diagnóstico</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
      </form></div>`;
  }

  function lerDiag(form) {
    const fd = new FormData(form);
    const txt = k => { const x = String(fd.get(k) || '').trim(); return x || null; };
    const num = k => { const x = String(fd.get(k) || '').trim(); return x === '' ? null : Number(x); };
    const todos = k => fd.getAll(k).map(String);
    const linhas = (tipo, campos) => [...form.querySelectorAll(`[data-linha="${tipo}"]`)].map(l => {
      const o = {}; campos.forEach(([k, n, t]) => { const el = l.querySelector(`[name="${n}"]`); o[k] = t === 'chk' ? el.checked : t === 'num' ? (el.value === '' ? null : Number(el.value)) : el.value.trim(); }); return o; });
    const producao = {};
    MQ.DIAG.producao.forEach(([k]) => { const q = txt('pr_' + k + '_qtd'), c = !!fd.get('pr_' + k + '_consumo'), v = !!fd.get('pr_' + k + '_venda'), o = txt('pr_' + k + '_onde');
      if (q || c || v || o) producao[k] = { qtd: q, consumo: c, venda: v, onde: o }; });
    const d = {
      data_visita: txt('data_visita'), latitude: num('latitude'), longitude: num('longitude'), sem_gps_motivo: txt('sem_gps_motivo'),
      familia: linhas('familia', [['nome', 'fam_nome'], ['idade', 'fam_idade', 'num'], ['parentesco', 'fam_par'], ['ocupacao', 'fam_ocup'], ['ajuda', 'fam_ajuda', 'chk']]).filter(x => x.nome),
      politicas: todos('politicas'), renda_familiar: num('renda_familiar'), fonte_renda: txt('fonte_renda'),
      area_m2: num('area_m2'), terra: txt('terra'), cercado: txt('cercado'), fontes_agua: todos('fontes_agua'), agua_seca: txt('agua_seca'),
      capacidade_litros: num('capacidade_litros'), meses_seca: num('meses_seca'), distancia_m: num('distancia_m'),
      reuso: fd.get('reuso') === 'sim' ? true : fd.get('reuso') === 'nao' ? false : null, irrigacao: txt('irrigacao'), solo: txt('solo'), meses_chuva: txt('meses_chuva'),
      producao, renda_quintal: num('renda_quintal'), praticas: todos('praticas'), horas_dia: num('horas_dia'), participa: todos('participa'),
      dificuldades: txt('dificuldades'), sonhos: txt('sonhos'),
      objetivos: todos('objetivos'), frase_objetivo: txt('frase_objetivo'),
      kit: linhas('kit', [['item', 'kit_item'], ['qtd', 'kit_qtd'], ['para', 'kit_para']]).filter(x => x.item),
      cronograma: linhas('cron', [['oque', 'cr_oque'], ['inicio', 'cr_ini'], ['fim', 'cr_fim'], ['quem', 'cr_quem']]).filter(x => x.oque),
      lote: num('lote'), mes_implantacao: txt('mes_implantacao'), compromissos: !!fd.get('compromissos')
    };
    const existentes = String(fd.get('fotos_existentes') || '').split('|').filter(Boolean);
    d.fotos_ok = ['geral', 'agua', 'plantio'].filter(k => fotosTemp[k] || existentes.some(x => new RegExp('diag_' + k).test(x)) || existentes.includes('exemplo')).length;
    d.fotos = existentes;
    return d;
  }

  function atualizarDiag(form) {
    const d = lerDiag(form);
    const sem = R.semAgua(d);
    form.querySelector('[data-parteb]').hidden = sem;
    form.querySelector('#dg-alerta-agua').innerHTML = sem
      ? '<div class="aviso erro"><b>Sem água que dure na seca.</b> Avise a coordenação técnica. A visita termina aqui: ela não recebe o kit agora e entra na lista de encaminhamento a programas de cisternas. O plano do quintal não é preenchido.</div>'
      : d.agua_seca === 'as_vezes' ? '<div class="aviso">Água só às vezes na seca: comece o kit pelos itens de armazenamento e irrigação.</div>' : '';
    form.querySelectorAll('.sn').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
  }

  function painelDiagVer(p) {
    const f = ficha(p.ficha); const dg = diagnosticos().find(d => d.ficha_id === p.ficha);
    if (!f || !dg) return '<div class="painel-corpo"><p>Diagnóstico não encontrado.</p></div>';
    const d = Object.assign({}, dg, dg.dados || {});
    const eu = S().eu; const souTec = eu.papel === 'coord_tecnico';
    const podeCorrigir = dg.situacao !== 'aprovado' && ((R.ehBolsista(eu.papel) && eu.uf === dg.uf) || dg.executor_id === eu.id);
    const rot = (lista, k) => (lista.find(x => x[0] === k) || [0, k])[1];
    const dl = linhas => `<dl class="dl">${linhas.filter(l => l && l[1] != null && l[1] !== '' && !(Array.isArray(l[1]) && !l[1].length)).map(([k, v]) => `<dt>${k}</dt><dd>${E(v)}</dd>`).join('')}</dl>`;
    const sit = dg.sem_agua ? '<span class="chip crit">Sem água: encaminhar</span>' : dg.situacao === 'aprovado' ? '<span class="chip ok">Plano aprovado</span>' : dg.situacao === 'devolvido' ? '<span class="chip crit">Devolvido</span>' : '<span class="chip pend">Plano em análise</span>';
    const tab = (cab, linhas) => linhas.length ? `<div class="quadro-scroll" style="display:block"><table class="quadro"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${E(c ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted small">—</p>';
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Diagnóstico · ${E(f.uf)} · ${codigoQuintal(f)}</span><h2 id="painel-t">${E(f.nome)}</h2>
        <span style="display:flex;gap:6px;flex-wrap:wrap">${sit}${dg._fila ? '<span class="chip pend">No aparelho</span>' : ''}</span></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        ${dg.situacao === 'devolvido' && dg.obs_coordenacao ? `<div class="aviso erro"><b>Devolvido:</b> ${E(dg.obs_coordenacao)}</div>` : ''}
        ${podeCorrigir ? `<div class="acoes"><button class="btn pri" data-acao="campo-diag-novo" data-ficha="${E(f.id)}">Corrigir diagnóstico</button></div>` : ''}
        <div class="resumo" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div><span class="v num">${d.area_m2 ?? '—'}<small> m²</small></span><span class="l">área do quintal</span></div>
          <div><span class="v num">${d.renda_quintal != null ? R.fmtBRL(+d.renda_quintal).replace(',00', '') : '—'}</span><span class="l">vendas do quintal por mês</span></div>
          <div><span class="v">${{ sim: 'Sim', as_vezes: 'Às vezes', nao: 'Não' }[d.agua_seca] || '—'}</span><span class="l">água dura na seca</span></div></div>
        <div class="bloco"><h3>Visita</h3>${dl([['Data', R.fmtData(d.data_visita)], ['Quem visitou', (pessoa(dg.executor_id) || {}).nome], ['Localização', d.latitude ? d.latitude + ', ' + d.longitude : 'Sem GPS: ' + (d.sem_gps_motivo || '')]])}</div>
        <div class="bloco"><h3>Família (${(d.familia || []).length})</h3>${tab(['Nome', 'Idade', 'Parentesco', 'Estuda/trabalha', 'Ajuda'], (d.familia || []).map(x => [x.nome, x.idade, x.parentesco, x.ocupacao, x.ajuda ? 'Sim' : 'Não']))}
          ${dl([['Políticas', (d.politicas || []).map(k => rot(MQ.DIAG.politicas, k)).join(', ')], ['Renda da família', d.renda_familiar != null ? R.fmtBRL(+d.renda_familiar) : null], ['Maior fonte', d.fonte_renda]])}</div>
        <div class="bloco"><h3>Quintal e água</h3>${dl([['Terra', { propria: 'Própria', cedida: 'Cedida', outra: 'Outra' }[d.terra]], ['Cercado', { sim: 'Sim', nao: 'Não', em_parte: 'Em parte' }[d.cercado]],
          ['Fontes de água', (d.fontes_agua || []).map(k => rot(MQ.DIAG.fontes_agua, k)).join(', ')], ['Capacidade', d.capacidade_litros ? d.capacidade_litros + ' L' : null],
          ['Dura na seca', d.meses_seca != null ? d.meses_seca + ' meses' : null], ['Distância', d.distancia_m != null ? d.distancia_m + ' m' : null], ['Irrigação', d.irrigacao], ['Solo', d.solo], ['Chuvas', d.meses_chuva]])}</div>
        <div class="bloco"><h3>Produção hoje</h3>${tab(['O quê', 'Quantidade', 'Uso', 'Onde vende'], Object.entries(d.producao || {}).map(([k, x]) => [rot(MQ.DIAG.producao, k), x.qtd, [x.consumo && 'consumo', x.venda && 'venda'].filter(Boolean).join(' e '), x.onde]))}
          ${dl([['Práticas', (d.praticas || []).map(k => rot(MQ.DIAG.praticas, k)).join(', ')], ['Horas por dia', d.horas_dia], ['Participa de', (d.participa || []).map(k => rot(MQ.DIAG.participa, k)).join(', ')], ['Dificuldades', d.dificuldades], ['Quer', d.sonhos]])}</div>
        ${dg.sem_agua ? '<div class="aviso erro">Sem água que dure na seca: não há plano nem kit. Encaminhar para programa de cisternas.</div>' : `
        <div class="bloco"><h3>Plano do quintal</h3>${dl([['Objetivo', (d.objetivos || []).map(k => rot(MQ.DIAG.objetivos, k)).join(', ')], ['Em 12 meses', d.frase_objetivo], ['Lote', d.lote ? 'Lote ' + d.lote : null], ['Mês previsto', d.mes_implantacao]])}
          <h3 style="margin-top:8px">Kit</h3>${tab(['Item', 'Qtd.', 'Para quê'], (d.kit || []).map(x => [x.item, x.qtd, x.para]))}
          <h3 style="margin-top:8px">Cronograma</h3>${tab(['O que', 'Início', 'Fim', 'Quem'], (d.cronograma || []).map(x => [x.oque, x.inicio, x.fim, x.quem]))}</div>`}
        <div class="bloco"><h3>Fotos</h3><div class="acoes">${(dg.fotos || []).map((x, i) => `<button class="btn peq" data-acao="ficha-foto" data-path="${E(x)}">${x === 'exemplo' ? 'Foto de exemplo' : 'Foto ' + (i + 1)}</button>`).join('') || '<span class="muted small">Sem fotos enviadas.</span>'}</div><div id="fi-foto-vista"></div></div>
        ${MQ.sugestaoUI && !dg._fila ? MQ.sugestaoUI.bloco(f, dg) : ''}
        ${MQ.vitrineUI && !dg._fila ? MQ.vitrineUI.blocoPublicar(f, dg) : ''}
        ${souTec && !dg._fila ? `<form class="bloco" data-form="diag-decisao" data-id="${E(dg.id)}" novalidate><h3>Decisão da coordenação técnica</h3>
          <p class="small muted">${dg.sem_agua ? 'Confirme o encaminhamento por falta de água.' : 'Aprove se o kit está na lista aprovada e cabe no valor por quintal, e se o cronograma é viável.'}</p>
          <div class="campo"><label for="dd-obs">Observação</label><textarea id="dd-obs" name="obs">${E(dg.obs_coordenacao || '')}</textarea></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes">${dg.situacao !== 'aprovado' ? `<button class="btn pri" type="submit" name="decisao" value="aprovado">${dg.sem_agua ? 'Confirmar encaminhamento' : 'Aprovar plano'}</button>` : ''}
            <button class="btn perigo" type="submit" name="decisao" value="devolvido">${dg.situacao === 'aprovado' ? 'Reabrir: devolver' : 'Devolver para correção'}</button></div></form>` : ''}
      </div>`;
  }

  function painel(p) {
    if (p.tipo === 'visita-form') return painelVisita(p);
    if (p.tipo === 'diag-form') return painelDiag(p);
    return painelDiagVer(p);
  }

  /* ---------- ações ---------- */
  async function clique(a, el) {
    const eu = S().eu;
    if (a === 'campo-visita-nova') U().abrirPainel({ tipo: 'visita-form', uf: eu.uf });
    else if (a === 'campo-visita-editar') U().abrirPainel({ tipo: 'visita-form', id: el.dataset.id });
    else if (a === 'campo-mes') { const n = +el.dataset.n; mesRoteiro = n === 0 ? mesAtual() : mesMais(mesRoteiro || mesAtual(), n); U().render(); }
    else if (a === 'campo-uf') { ufRoteiro = el.dataset.uf; U().render(); }
    else if (a === 'campo-diag-ver') U().abrirPainel({ tipo: 'diag-ver', ficha: el.dataset.ficha });
    else if (a === 'campo-diag-novo') {
      Object.keys(fotosTemp).forEach(k => delete fotosTemp[k]);
      const naFila = (S().fila || []).find(it => it.tipo === 'diagnostico' && it.dados && it.dados.ficha_id === el.dataset.ficha);
      if (naFila && naFila.fotos) Object.assign(fotosTemp, naFila.fotos);   // correção de item não enviado mantém as fotos
      const vid = el.dataset.visita || (ativasDe(el.dataset.ficha, 'diagnostico')[0] || {}).id || '';
      U().abrirPainel({ tipo: 'diag-form', ficha: el.dataset.ficha, visita: vid });
      setTimeout(() => { const fm = $('form[data-form=diag]'); if (fm) atualizarDiag(fm); }, 0);
    }
    else if (a === 'campo-linha-add') {
      const alvo = el.previousElementSibling; const html = el.dataset.tipo === 'familia' ? linhaFamilia() : el.dataset.tipo === 'kit' ? linhaKit() : linhaCron();
      alvo.insertAdjacentHTML('beforeend', html); const n = alvo.lastElementChild.querySelector('input'); if (n) n.focus();
    }
    else if (a === 'campo-linha-rem') { const l = el.closest('.linha-din'); if (l && l.parentElement.children.length > 1) l.remove(); else if (l) l.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }); }
    else if (a === 'campo-gps') {
      const dica = $('#dg-gps-dica');
      if (!navigator.geolocation) { dica.textContent = 'Este aparelho não informa a localização. Explique no campo abaixo.'; return; }
      dica.textContent = 'Buscando localização…';
      navigator.geolocation.getCurrentPosition(pos => {
        const fm = $('form[data-form=diag]'); if (!fm) return;
        fm.latitude.value = pos.coords.latitude.toFixed(6); fm.longitude.value = pos.coords.longitude.toFixed(6);
        dica.textContent = fm.latitude.value + ', ' + fm.longitude.value + ' (precisão de ' + Math.round(pos.coords.accuracy) + ' m)'; el.textContent = 'Localização registrada ✓';
      }, err => { dica.textContent = err.code === 1 ? 'Permissão negada. Explique no campo abaixo.' : 'Não foi possível agora. Tente de novo ou explique abaixo.'; },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    }
    else if (a === 'campo-visita-cancelar') {
      const fm = $('form[data-form=visita]'); const v = visitas().find(x => x.id === fm.dataset.id);
      if (!fm.dataset.confirmar) { fm.dataset.confirmar = '1'; el.textContent = 'Confirmar cancelamento'; return; }
      await U().ocupado(fm, async () => { await guardar('visita', Object.assign({}, v, { situacao: 'cancelada' })); U().fecharPainel(); U().render(); U().toast('Visita cancelada. O dia de campo volta para o saldo do estado.'); });
    }
  }

  async function guardar(tipo, dados, fotos) {
    const s = S();
    const limpo = Object.assign({}, dados); ['_fila', '_erro'].forEach(k => delete limpo[k]);
    await MQ.fila.salvar({ id: limpo.id, dono: s.eu.id, tipo, dados: limpo, fotos: fotos || null, erro: null });
    s.fila = await MQ.fila.listar(s.eu.id);
    if (navigator.onLine) await U().sincronizar(false);
    const resta = s.fila.find(i => i.id === limpo.id);
    if (resta && resta.erro) throw new Error(resta.erro);
    return !resta;   // true = enviado
  }

  async function enviar(tipo, form, fd) {
    const eu = S().eu;
    if (tipo === 'visita') {
      const v0 = visitas().find(x => x.id === form.dataset.id);
      const v = Object.assign({}, v0 || { id: form.dataset.id, situacao: 'prevista' }, {
        ficha_id: v0 ? v0.ficha_id : String(fd.get('ficha_id') || ''), etapa: v0 ? v0.etapa : String(fd.get('etapa') || ''),
        executor_id: String(fd.get('executor_id') || ''), data_prevista: String(fd.get('data_prevista') || ''), obs: String(fd.get('obs') || '').trim() || null });
      const e = {};
      if (!v.ficha_id) e.ficha_id = 'Escolha a mulher.';
      if (!v.executor_id) e.executor_id = 'Escolha quem faz a visita.';
      if (!v.data_prevista) e.data_prevista = 'Informe a data.';
      if (!v0 && v.ficha_id) {
        if (ativasDe(v.ficha_id, v.etapa).length >= MQ.ETAPAS[v.etapa].max) e.etapa = v.etapa === 'acompanhamento' ? 'Este quintal já tem as 2 visitas de acompanhamento.' : 'Este quintal já tem essa visita agendada ou feita.';
        else if (v.etapa !== 'diagnostico' && !ativasDe(v.ficha_id, 'diagnostico').some(x => x.situacao === 'realizada')) e.etapa = 'Primeiro o diagnóstico.';
        const f = ficha(v.ficha_id); if (f && diasUsados(f.uf) >= MQ.DIAS_CAMPO_UF) e.ficha_id = 'O estado já usou os 160 dias de campo.';
      }
      if (Object.keys(e).length) return U().mostrarErros(form, e);
      await U().ocupado(form, async () => {
        const enviado = await guardar('visita', v);
        U().fecharPainel(); U().render();
        U().toast(enviado ? (v0 ? 'Visita atualizada.' : 'Visita agendada no roteiro.') : 'Visita guardada no aparelho. Será enviada quando houver internet.');
      });
    }
    if (tipo === 'diag') {
      const f = ficha(form.dataset.ficha);
      const d = lerDiag(form);
      const erros = R.validarDiagnostico(d);
      if (Object.keys(erros).length) {
        Object.keys(erros).forEach(k => { const w = form.querySelector('#w-' + k); if (w) w.classList.add('tem-erro'); });
        const alvo = {}; Object.entries(erros).forEach(([k, m]) => { if (form.querySelector(`[name="${k}"]`) && !form.querySelector('#w-' + k)) alvo[k] = m; });
        U().mostrarErros(form, alvo, Object.keys(erros).length > 1 ? 'Faltam ' + Object.keys(erros).length + ' itens: ' + Object.values(erros).slice(0, 3).join(' · ') : Object.values(erros)[0]);
        const p = form.querySelector('.tem-erro'); if (p) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      await U().ocupado(form, async () => {
        const sem = R.semAgua(d);
        // bolsista registrando sem visita agendada: cria a visita de diagnóstico (conta 1 dia de campo dela)
        let visitaId = form.dataset.visita;
        if (!visitaId) {
          if (!R.habilitado(eu)) throw new Error('Você ainda não está habilitada (FIC, FUNCERN e termo): a visita não poderia ser paga.');
          visitaId = MQ.novoId();
          await guardar('visita', { id: visitaId, ficha_id: f.id, uf: f.uf, etapa: 'diagnostico', executor_id: eu.id, data_prevista: d.data_visita, situacao: 'prevista' });
        }
        const campos = ['data_visita', 'latitude', 'longitude', 'sem_gps_motivo', 'area_m2', 'renda_familiar', 'renda_quintal', 'agua_seca', 'lote', 'mes_implantacao'];
        const reg = { id: form.dataset.id, ficha_id: f.id, visita_id: visitaId, uf: f.uf, codigo_quintal: codigoQuintal(f), sem_agua: sem, fotos: d.fotos.filter(x => x !== 'exemplo') };
        campos.forEach(k => { reg[k] = d[k]; });
        if (sem) { reg.lote = null; reg.mes_implantacao = null; }
        const extra = Object.assign({}, d); campos.concat(['fotos', 'fotos_ok']).forEach(k => delete extra[k]);
        if (sem) ['objetivos', 'frase_objetivo', 'kit', 'cronograma', 'compromissos'].forEach(k => delete extra[k]);
        reg.dados = extra;
        const fotos = Object.assign({}, fotosTemp);
        const enviado = await guardar('diagnostico', reg, fotos);
        Object.keys(fotosTemp).forEach(k => delete fotosTemp[k]);
        U().fecharPainel(); U().render();
        U().toast(enviado ? (sem ? 'Diagnóstico enviado. Sem água: a coordenação técnica foi avisada.' : 'Diagnóstico enviado. O plano vai para aprovação da coordenação técnica.') : 'Diagnóstico guardado no aparelho. Será enviado quando houver internet.');
      });
    }
    if (tipo === 'diag-decisao') {
      const dec = form.dataset.decisao || 'aprovado'; const obs = String(fd.get('obs') || '').trim();
      if (dec === 'devolvido' && obs.length < 5) return U().mostrarErros(form, { obs: 'Escreva o que precisa ser corrigido.' });
      await U().ocupado(form, async () => {
        await S().api.decidirDiagnostico(form.dataset.id, dec, obs);
        await U().carregar(); U().fecharPainel(); U().render();
        U().toast(dec === 'aprovado' ? 'Plano aprovado.' : 'Diagnóstico devolvido para correção.');
      });
    }
  }

  /* reatividade */
  document.addEventListener('change', async ev => {
    const form = ev.target.closest('form[data-form=diag]');
    if (!form) return;
    if (ev.target.type === 'file' && ev.target.files[0]) {
      const k = ev.target.dataset.foto; const dica = form.querySelector('#dg-f-' + k + '-dica');
      if (ev.target.files[0].size > 15 * 1024 * 1024) { dica.textContent = 'Arquivo muito grande (máx. 15 MB).'; ev.target.value = ''; return; }
      dica.textContent = 'Preparando foto…'; fotosTemp[k] = await MQ.comprimirFoto(ev.target.files[0]);
      dica.textContent = 'Foto pronta (' + Math.round(fotosTemp[k].size / 1024) + ' KB).';
      const w = form.querySelector('#w-fotos'); if (w) w.classList.remove('tem-erro');
    }
    atualizarDiag(form);
    const w = ev.target.closest('[id^="w-"]'); if (w) w.classList.remove('tem-erro');
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('form[data-form=diag-decisao] button[name=decisao]'); if (b) b.form.dataset.decisao = b.value;
  }, true);

  MQ.campoUI = { secaoBolsista, telaAgente, abaCoord, painel, clique, enviar, diagnosticos, visitas };
})();
