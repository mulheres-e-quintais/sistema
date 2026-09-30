/* Mulheres & Quintais — encontros do curso FIC, lista de presença e relatório do professor (30/09/2026).
   O professor registra cada encontro e marca quem estava presente (entre as pessoas matriculadas na turma);
   cada pessoa marcada como presente confirma, no próprio acesso, que participou.
   Ao pedir a bolsa, o relatório do mês leva os encontros com a presença e as confirmações (gravado pelo banco).
   Mesmas regras do supabase/38_fic_encontros.sql. */
(function () {
  const R = MQ.regras, P = MQ.PAPEIS;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const MOD = { presencial: 'Presencial', online: 'Online ao vivo', ava: 'Atividade no AVA' };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = ym => MESES[+String(ym).slice(5, 7) - 1] + ' de ' + String(ym).slice(0, 4);
  const pessoa = id => (S().equipe || []).find(m => m.id === id);
  const nomeDe = m => (m && (m.nome_social || m.nome)) || '—';
  const encontros = () => (S().encontros || []).slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const turma = id => (S().turmas || []).find(t => t.id === id) || {};
  const matriculados = tid => (S().matriculas || []).filter(m => m.turma_id === tid && !m.cancelada_em).map(m => pessoa(m.equipe_id)).filter(Boolean)
    .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b)));
  const fmtH = h => String(+h).replace('.', ',') + ' h';
  const conta = e => { const ps = e.presencas || []; const pr = ps.filter(p => p.presente); return { total: ps.length, presentes: pr.length, confirmados: pr.filter(p => p.confirmado_em).length }; };

  /* ---------- professor: seção "Encontros do curso" ---------- */
  function secaoProfessor() {
    if (S().encSemBanco) return `<section class="secao" id="t-encontros"><h2>Encontros do curso</h2><div class="aviso">Os encontros e a lista de presença ainda não estão instalados no servidor. A coordenação geral roda o arquivo <b>38_fic_encontros.sql</b> no Supabase.</div></section>`;
    const l = encontros(); const porMes = {};
    l.forEach(e => { const k = String(e.data).slice(0, 7); (porMes[k] = porMes[k] || []).push(e); });
    const semTurma = !(S().turmas || []).length;
    return `<section class="secao" id="t-encontros" aria-labelledby="t-enc"><div class="secao-cab"><div><h2 id="t-enc">Encontros do curso e lista de presença</h2>
        <p>Registre cada encontro (aula presencial, online ou atividade no AVA) e marque quem participou. Cada pessoa confirma no próprio acesso. Os encontros do mês entram no relatório da sua bolsa.</p></div></div>
      ${semTurma ? '<p class="muted">Crie uma turma e matricule as pessoas antes de registrar encontros.</p>' : `<div class="viag-botoes"><button type="button" class="cad-modo" data-acao="enc-novo"><b>Registrar encontro</b><span>Data, carga horária, o que foi trabalhado e a lista de presença.</span></button></div>`}
      ${Object.keys(porMes).length ? Object.entries(porMes).map(([ym, xs]) => `<h3 class="viag-sub">${nomeMes(ym)} · ${xs.length} encontro${xs.length > 1 ? 's' : ''} · ${fmtH(xs.reduce((t, e) => t + (+e.carga_horaria || 0), 0))}</h3>
        <div class="pag-lista">${xs.map(linha).join('')}</div>`).join('') : (semTurma ? '' : '<p class="muted">Nenhum encontro registrado ainda.</p>')}
    </section>`;
  }
  function linha(e) {
    const c = conta(e);
    return `<button class="vagabtn ficha-linha" data-acao="enc-editar" data-id="${E(e.id)}">
      <span class="nm">${R.fmtData(e.data)} · ${E(turma(e.turma_id).nome || 'Turma')}</span>
      <span class="small muted">${E(MOD[e.modalidade] || e.modalidade)} · ${fmtH(e.carga_horaria)} · presentes ${c.presentes} de ${c.total} · confirmaram ${c.confirmados}</span>
      <span class="small">${E(String(e.conteudo).slice(0, 140))}${String(e.conteudo).length > 140 ? '…' : ''}</span></button>`;
  }
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function painel(p) {
    const e = p.id ? (S().encontros || []).find(x => x.id === p.id) : null;
    const ts = S().turmas || []; const minhas = ts.filter(t => t.professor_id === (S().eu || {}).id);
    const tid = (e && e.turma_id) || p.turma || (ts.length === 1 ? ts[0].id : minhas.length ? minhas[minhas.length - 1].id : '');   // várias turmas: a mais recente do professor
    const presentes = new Set(((e && e.presencas) || []).filter(x => x.presente).map(x => x.equipe_id));
    const confirmados = new Set(((e && e.presencas) || []).filter(x => x.confirmado_em).map(x => x.equipe_id));
    const listas = ts.map(t => { const ms = matriculados(t.id);
      return `<fieldset class="enc-lista" data-turma-lista="${E(t.id)}" ${t.id === tid ? '' : 'hidden'}><legend>Lista de presença · ${E(t.nome)} (${ms.length})</legend>
        ${ms.length ? ms.map(m => `<label class="check"><input type="checkbox" name="presente_${E(t.id)}" value="${E(m.id)}" ${presentes.has(m.id) ? 'checked' : ''} ${confirmados.has(m.id) ? 'disabled data-confirmado' : ''}>
          <span>${E(nomeDe(m))} <span class="small muted">· ${E(P[m.papel] ? P[m.papel].curto : '')}${m.uf ? ' · ' + E(m.uf) : ''}${confirmados.has(m.id) ? ' · <b>confirmou a presença</b>' : ''}</span></span></label>`).join('')
          : '<p class="small muted">Ninguém matriculado nesta turma.</p>'}
        ${ms.length ? `<button type="button" class="link small" data-acao="enc-todos" data-turma="${E(t.id)}">Marcar todos</button>` : ''}</fieldset>`; }).join('');
    return cab('Curso FIC', e ? 'Encontro de ' + R.fmtData(e.data) : 'Registrar encontro') + `<div class="painel-corpo"><form class="f" data-form="enc-salvar" ${e ? `data-id="${E(e.id)}"` : ''} novalidate><div class="campos">
        <div class="campo inteiro"><label for="en-turma">Turma</label><select id="en-turma" name="turma_id" data-enc-turma>${ts.length > 1 ? '<option value="">Selecione…</option>' : ''}${ts.map(t => `<option value="${E(t.id)}" ${t.id === tid ? 'selected' : ''}>${E(t.nome)}</option>`).join('')}</select></div>
        <div class="campo"><label for="en-data">Data</label><input id="en-data" name="data" type="date" min="2026-09-01" max="${R.hoje()}" value="${E(e ? e.data : R.hoje())}"></div>
        <div class="campo"><label for="en-ch">Carga horária (horas)</label><input id="en-ch" name="carga_horaria" inputmode="decimal" placeholder="Ex.: 4" value="${e ? String(e.carga_horaria).replace('.', ',') : ''}"></div>
        <div class="campo inteiro"><label for="en-mod">Modalidade</label><select id="en-mod" name="modalidade">${Object.entries(MOD).map(([k, t]) => `<option value="${k}" ${(e ? e.modalidade : 'presencial') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo inteiro"><label for="en-cont">O que foi trabalhado</label><textarea id="en-cont" name="conteudo" rows="4" maxlength="2000" placeholder="Ex.: Planejamento do quintal: calendário de plantio, adubação com esterco curtido e cuidado com a água.">${E(e ? e.conteudo : '')}</textarea></div>
      </div>
      ${listas}
      <p class="small muted">Quem já confirmou a presença não pode ser desmarcado. Depois que a bolsa do mês tiver aval, os encontros daquele mês não mudam mais.</p>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">${e ? 'Salvar alterações' : 'Registrar encontro'}</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }

  /* ---------- quem participou: confirmar a presença ---------- */
  const paraConfirmar = () => { const eu = S().eu; return eu ? (S().encontros || []).filter(e => (e.presencas || []).some(p => p.equipe_id === eu.id && p.presente && !p.confirmado_em)) : []; };
  function blocoConfirmar() {
    const eu = S().eu; if (!eu || !R.matriculaFIC(eu.papel) || S().encSemBanco) return '';
    const l = paraConfirmar().sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const meus = (S().encontros || []).filter(e => (e.presencas || []).some(p => p.equipe_id === eu.id));
    if (!meus.length) return '';
    const feitos = meus.filter(e => (e.presencas || []).some(p => p.equipe_id === eu.id && p.confirmado_em)).length;
    return `<section class="bloco enc-confirmar" id="t-presenca" aria-labelledby="t-pres"><h2 id="t-pres">Curso FIC: presença nos encontros</h2>
      ${l.length ? `<p>O professor marcou você como presente ${l.length === 1 ? 'neste encontro' : 'nestes encontros'}. Confirme se você participou:</p>
        <div class="pag-lista">${l.map(e => `<div class="exec-lanc"><span class="nm">${R.fmtData(e.data)} · ${E(turma(e.turma_id).nome || 'Curso FIC')}</span><b class="num">${fmtH(e.carga_horaria)}</b>
          <span class="small muted">${E(MOD[e.modalidade] || '')} · ${E(String(e.conteudo).slice(0, 160))}</span>
          <button type="button" class="btn pri peq" data-acao="enc-confirmar" data-id="${E(e.id)}">Confirmo que participei</button></div>`).join('')}</div>
        <p class="small muted">Não participou? Não confirme e avise o professor para corrigir a lista.</p>`
      : `<p class="small muted">Tudo confirmado: ${feitos} encontro${feitos === 1 ? '' : 's'} com a sua presença.</p>`}</section>`;
  }

  /* ---------- relatório do professor (pedido de bolsa) ---------- */
  function doMes(profId, ym) {   // encontros do mês ainda não enviados (tela do pedido)
    return (S().encontros || []).filter(e => e.professor_id === profId && String(e.data).slice(0, 7) === ym).sort((a, b) => String(a.data).localeCompare(String(b.data)))
      .map(e => ({ data: e.data, turma: turma(e.turma_id).nome, carga_horaria: e.carga_horaria, modalidade: e.modalidade, conteudo: e.conteudo,
        presencas: (e.presencas || []).map(p => { const q = pessoa(p.equipe_id) || {}; return { nome: nomeDe(q), papel: q.papel, uf: q.uf, presente: p.presente, confirmado_em: p.confirmado_em }; }) }));
  }
  function tabelaEncontros(encs, completo) {
    if (!encs.length) return '<p class="muted">Nenhum encontro registrado neste mês.</p>';
    return encs.map(e => { const pres = (e.presencas || []).filter(p => p.presente); const aus = (e.presencas || []).filter(p => !p.presente);
      return `<div class="enc-rel"><p><b>${R.fmtData(e.data)}</b> · ${E(e.turma || '')} · ${E(MOD[e.modalidade] || e.modalidade)} · ${fmtH(e.carga_horaria)}</p>
        <p>${E(e.conteudo)}</p>
        <table class="quadro enc-tab"><thead><tr><th scope="col">Presentes (${pres.length})</th><th scope="col">Função</th><th scope="col">Confirmação</th></tr></thead><tbody>
          ${pres.map(p => `<tr><td>${E(p.nome)}</td><td>${E(P[p.papel] ? P[p.papel].curto : '')}${p.uf ? ' · ' + E(p.uf) : ''}</td><td>${p.confirmado_em ? '✓ confirmou em ' + new Date(p.confirmado_em).toLocaleDateString('pt-BR') : '<span class="muted">aguardando</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Ninguém marcado como presente.</td></tr>'}
        </tbody></table>${completo && aus.length ? `<p class="small muted">Ausentes: ${aus.map(p => E(p.nome)).join(', ')}.</p>` : ''}</div>`; }).join('');
  }
  function resumoMes(encs) {
    const ch = encs.reduce((t, e) => t + (+e.carga_horaria || 0), 0);
    const pres = encs.flatMap(e => (e.presencas || []).filter(p => p.presente)); const conf = pres.filter(p => p.confirmado_em).length;
    return { n: encs.length, ch, presencas: pres.length, confirmadas: conf };
  }
  /* bloco dentro do formulário de pedido de bolsa do professor */
  function blocoPedido(profId, ym) {
    const encs = doMes(profId, ym); const r = resumoMes(encs);
    return `<div class="enc-pedido"><h4>Encontros de ${nomeMes(ym)}</h4>
      <p class="small">${r.n ? `${r.n} encontro${r.n > 1 ? 's' : ''} · ${fmtH(r.ch)} · ${r.confirmadas} de ${r.presencas} presenças confirmadas pelas pessoas` : 'Nenhum encontro registrado neste mês.'}
        ${r.presencas > r.confirmadas ? ' <span class="muted">(quem ainda não confirmou aparece como "aguardando" no relatório)</span>' : ''}</p>
      ${r.n ? `<details><summary class="small">Ver os encontros e a lista de presença</summary>${tabelaEncontros(encs)}</details>`
        : `<div class="campo"><label for="pb-just-${ym}">Por que não houve encontro neste mês?</label><textarea id="pb-just-${ym}" name="justificativa_sem_encontro" rows="3" placeholder="Ex.: mês de preparação: montagem do plano de curso e do material do AVA."></textarea></div>`}
      <p class="small muted">Os encontros e a presença entram sozinhos no relatório. Para incluir ou corrigir, use <b>Encontros do curso</b> antes de pedir.</p></div>`;
  }
  /* relatório gravado no pedido (painel do aval e impressão) */
  function relatorioHTML(s, completo) {
    const d = s.detalhe || {}; const encs = d.fic_encontros || []; const r = resumoMes(encs); const pe = pessoa(s.equipe_id);
    return `<article class="rel enc-relatorio"><header><p class="rel-sobre">${E(MQ.PROJETO.nome)} · Processo ${E(MQ.PROJETO.processo)}</p>
        <h1>Relatório mensal do professor do curso FIC</h1>
        <p>${E(nomeDe(pe))} · ${nomeMes(String(s.mes).slice(0, 7))}${s.solicitada_em ? ' · enviado em ' + new Date(s.solicitada_em).toLocaleDateString('pt-BR') : ''}</p></header>
      <h2>Resumo</h2><p>${r.n} encontro${r.n === 1 ? '' : 's'} · ${fmtH(r.ch)} de carga horária · ${r.confirmadas} de ${r.presencas} presenças confirmadas pelas pessoas.</p>
      <h2>Ações realizadas</h2><p style="white-space:pre-wrap">${E(s.relatorio || '')}</p>
      ${d.justificativa_sem_encontro ? `<h2>Mês sem encontro: justificativa</h2><p style="white-space:pre-wrap">${E(d.justificativa_sem_encontro)}</p>` : ''}
      <h2>Encontros e lista de presença</h2>${tabelaEncontros(encs, completo)}
      ${d.fic_gerado_em ? `<p class="small muted">Encontros e presença registrados pelo sistema em ${new Date(d.fic_gerado_em).toLocaleString('pt-BR')}.</p>` : ''}</article>`;
  }
  function imprimir(s) {
    const doc = MQ.docsUI && MQ.docsUI.documentoCompleto ? MQ.docsUI.documentoCompleto(relatorioHTML(s, true)) : '<!doctype html><meta charset="utf-8">' + relatorioHTML(s, true);
    const f = document.createElement('iframe'); f.style.position = 'fixed'; f.style.width = f.style.height = '0'; f.style.border = '0'; f.setAttribute('aria-hidden', 'true');
    document.body.appendChild(f); f.contentDocument.open(); f.contentDocument.write(doc); f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 250);
  }

  /* ---------- ações ---------- */
  async function clique(a, el) {
    if (a === 'enc-novo') U().abrirPainel({ tipo: 'enc-editar' });
    else if (a === 'enc-editar') U().abrirPainel({ tipo: 'enc-editar', id: el.dataset.id });
    else if (a === 'enc-todos') { const fs = el.closest('fieldset'); if (fs) fs.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; }); }
    else if (a === 'enc-imprimir') { const s = (S().solic || []).find(x => x.id === el.dataset.id); if (s) imprimir(s); }
    else if (a === 'enc-confirmar') {
      el.disabled = true;
      try { await S().api.confirmarPresencaFic(el.dataset.id); await U().carregar(); U().render(); U().toast('Presença confirmada. Obrigado!'); }
      catch (e) { el.disabled = false; U().toast(e.message); }
    }
  }
  const numBR = t => { const x = String(t || '').trim().replace(',', '.'); return x === '' ? null : +x; };
  async function enviar(tipo, form, fd) {
    if (tipo !== 'enc-salvar') return;
    const tid = String(fd.get('turma_id') || '');
    const x = { id: form.dataset.id || null, turma_id: tid, data: String(fd.get('data') || ''), carga_horaria: numBR(fd.get('carga_horaria')), modalidade: String(fd.get('modalidade') || ''),
      conteudo: String(fd.get('conteudo') || '').trim(), presentes: [...form.querySelectorAll(`input[name="presente_${tid}"]`)].filter(c => c.checked).map(c => c.value) };
    const e = {};
    if (!tid) e.turma_id = 'Escolha a turma.';
    if (!x.data) e.data = 'Informe a data.'; else if (x.data > R.hoje()) e.data = 'A data não pode ser no futuro.';
    if (!(x.carga_horaria > 0 && x.carga_horaria <= 12)) e.carga_horaria = 'Informe a carga horária (até 12 horas).';
    if (x.conteudo.length < 10) e.conteudo = 'Escreva o que foi trabalhado (pelo menos 10 letras).';
    if (Object.keys(e).length) return U().mostrarErros(form, e);
    await U().ocupado(form, async () => { await S().api.salvarEncontroFic(x); await U().carregar(); U().fecharPainel(); U().render(); U().toast(x.id ? 'Encontro atualizado.' : 'Encontro registrado.'); });
  }
  if (typeof document !== 'undefined') document.addEventListener('change', ev => {   // trocar a turma mostra a lista de presença dela
    const s = ev.target && ev.target.matches && ev.target.matches('[data-enc-turma]') ? ev.target : null; if (!s) return;
    s.form.querySelectorAll('[data-turma-lista]').forEach(f => { f.hidden = f.dataset.turmaLista !== s.value; });
  });
  MQ.encUI = { secaoProfessor, painel, blocoConfirmar, paraConfirmar, blocoPedido, relatorioHTML, doMes, clique, enviar, MOD };
})();
