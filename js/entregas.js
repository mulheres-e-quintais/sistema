/* Mulheres & Quintais — entregas do mês, ciência do Guia e guia das agentes.
   Conteúdo do "Guia das bolsistas" levado para o momento em que cada pessoa precisa dele.
   O que o sistema sabe sozinho (fotos, fichas, relatório, metas) é calculado; a lista de presença
   é marcada pela bolsista e o acesso ao AVA é confirmado pelo professor do FIC (19_entregas_do_mes.sql). */
(function () {
  const R = MQ.regras, P = MQ.PAPEIS;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const G = { mes: null, avaMes: null };

  const mesDe = d => String(d || '').slice(0, 7);
  const mesAtual = () => R.hoje().slice(0, 7);
  const somaMes = (m, n) => { const [a, b] = m.split('-').map(Number); const d = new Date(a, b - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const nomeMes = m => { const [a, b] = m.split('-').map(Number); const t = new Date(a, b - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const marcada = (id, m, item) => (S().entregas || []).find(x => x.equipe_id === id && String(x.mes).slice(0, 7) === m && x.item === item);
  const pessoa = id => (S().equipe || []).find(x => x.id === id);
  const nomeDe = m => (m && (m.nome_social || m.nome)) || '—';
  const semBanco = () => S().entregasSemBanco;

  /* as 6 entregas do Guia (item 7) para uma bolsista num mês */
  function itens(m, mes) {
    const vs = (S().visitas || []).filter(v => v.executor_id === m.id);
    const feitas = vs.filter(v => v.situacao === 'realizada' && mesDe(v.data_realizada) === mes);
    const comFoto = feitas.filter(v => (Array.isArray(v.fotos) && v.fotos.length) || (S().diagnosticos || []).some(d => d.visita_id === v.id && d.fotos && Object.keys(d.fotos).length));
    const comRelato = feitas.filter(v => String(v.relato || '').trim() || (S().diagnosticos || []).some(d => d.visita_id === v.id));
    const previstas = vs.filter(v => v.situacao !== 'cancelada' && mesDe(v.data_prevista) === mes);
    const prevFeitas = previstas.filter(v => v.situacao === 'realizada');
    const bolsa = (S().solic || []).find(s => s.equipe_id === m.id && s.tipo === 'bolsa' && mesDe(s.mes) === mes && s.situacao !== 'devolvida');
    const pres = marcada(m.id, mes, 'presenca'), ava = marcada(m.id, mes, 'ava');
    const n = (k, t) => k + ' ' + t + (k === 1 ? '' : 's');
    return [
      { id: 'fotos', t: 'Fotos', o: 'De cada visita, oficina e atividade realizada.',
        e: !feitas.length ? 'info' : comFoto.length === feitas.length ? 'ok' : 'falta',
        d: !feitas.length ? 'Nenhuma visita feita no mês. Fotos de oficinas e reuniões: guarde e apresente à coordenação técnica.' : `${comFoto.length} de ${n(feitas.length, 'visita')} com foto no sistema.` },
      { id: 'presenca', t: 'Lista de presença', o: 'Assinada em toda atividade coletiva.', e: pres ? 'ok' : 'falta', marcar: true,
        d: pres ? 'Você marcou que entregou as listas do mês.' : 'Marque quando entregar as listas assinadas à coordenação técnica.' },
      { id: 'relatorio', t: 'Relatório', o: 'O que foi feito no mês e o que ficou pendente.', e: bolsa && String(bolsa.relatorio || '').trim() ? 'ok' : 'falta',
        d: bolsa ? 'Enviado junto com o pedido da bolsa do mês.' : 'Vai junto com o pedido da bolsa, em Solicitar pagamento.' },
      { id: 'fichas', t: 'Ficha do quintal', o: 'Uma por mulher atendida, atualizada a cada visita.',
        e: !feitas.length ? 'info' : comRelato.length === feitas.length ? 'ok' : 'falta',
        d: !feitas.length ? 'Sem visitas no mês.' : `${comRelato.length} de ${n(feitas.length, 'visita')} com o registro do quintal.` },
      { id: 'ava', t: 'Acesso ao AVA', o: 'Entrar no curso pelo menos uma vez no mês e fazer as atividades.', e: ava ? 'ok' : 'pend',
        d: ava ? `Confirmado pelo professor do FIC em ${new Date(ava.marcado_em).toLocaleDateString('pt-BR')}.` : 'O professor do FIC confirma quando você acessar.' },
      { id: 'metas', t: 'Metas do mês', o: 'Andamento do que estava previsto no calendário.',
        e: !previstas.length ? 'info' : prevFeitas.length === previstas.length ? 'ok' : 'pend',
        d: !previstas.length ? 'Nenhuma visita prevista para você neste mês.' : `${prevFeitas.length} de ${n(previstas.length, 'visita')} prevista${previstas.length === 1 ? '' : 's'} feita${prevFeitas.length === 1 ? '' : 's'}.` }
    ];
  }
  const ICONE = { ok: '✓', falta: '!', pend: '…', info: '–' };
  function lista(m, mes, editavel) {
    return `<ul class="entm-lista">${itens(m, mes).map(i => `<li class="entm-${i.e}"><span class="entm-ic" aria-hidden="true">${ICONE[i.e]}</span>
      <span class="entm-t"><b>${E(i.t)}</b><span class="small muted">${E(i.o)}</span><span class="small">${E(i.d)}</span></span>
      ${i.marcar && editavel ? `<button class="btn peq${i.e === 'ok' ? '' : ' pri'}" data-acao="ent-presenca" data-mes="${mes}" data-on="${i.e === 'ok' ? '0' : '1'}">${i.e === 'ok' ? 'Desmarcar' : 'Entreguei'}</button>` : ''}</li>`).join('')}</ul>`;
  }

  /* cartão na tela da bolsista */
  function cartaoBolsista() {
    const eu = S().eu; if (!R.ehBolsista(eu.papel) || semBanco()) return '';
    const m = Object.assign({}, eu, pessoa(eu.id) || {});
    const mes = G.mes || mesAtual();
    const its = itens(m, mes); const ok = its.filter(i => i.e === 'ok').length;
    return `<section class="secao entm" aria-labelledby="t-ent"><div class="secao-cab"><div><h2 id="t-ent">Entregas do mês</h2>
        <p>Cada mês só é pago depois que estas entregas forem apresentadas e conferidas: o projeto presta contas ao MDA.</p></div>
        <span class="seg"><button type="button" data-acao="ent-mes" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" data-acao="ent-mes" data-n="0">${nomeMes(mes)}</button><button type="button" data-acao="ent-mes" data-n="1" aria-label="Próximo mês" ${mes >= mesAtual() ? 'disabled' : ''}>›</button></span></div>
      <div class="bloco"><p class="entm-cont"><b class="num">${ok}</b> de 6 entregas em dia</p>${lista(m, mes, true)}</div></section>`;
  }

  /* resumo para quem dá o aval da bolsa */
  function resumoAval(s) {
    if (semBanco() || s.tipo !== 'bolsa') return '';
    const m = pessoa(s.equipe_id); if (!m || !R.ehBolsista(m.papel)) return '';
    const mes = mesDe(s.mes); const its = itens(m, mes);
    return `<div class="bloco"><h3>Entregas de ${E(nomeMes(mes))}</h3><p class="small muted">${its.filter(i => i.e === 'ok').length} de 6 em dia. Confira antes de dar o aval.</p>${lista(m, mes, false)}</div>`;
  }

  /* professor do FIC (ou coordenação geral): confirma o acesso ao AVA no mês */
  function secaoAva() {
    if (semBanco() || !['professor_fic', 'coord_geral'].includes(S().eu.papel)) return '';
    const mes = G.avaMes || mesAtual();
    const alunas = (S().equipe || []).filter(x => x.status === 'ativa' && R.matriculaFIC(x.papel) && x.matricula_fic_em)
      .sort((a, b) => String(a.uf).localeCompare(String(b.uf)) || nomeDe(a).localeCompare(nomeDe(b)));
    const n = alunas.filter(x => marcada(x.id, mes, 'ava')).length;
    return `<section class="secao" aria-labelledby="t-ava"><div class="secao-cab"><div><h2 id="t-ava">Acesso ao AVA no mês</h2>
        <p>Marque quem entrou no curso e fez as atividades. É uma das entregas mensais das bolsistas: sem ela, a bolsa do mês não é conferida.</p></div>
        <span class="seg"><button type="button" data-acao="ent-avames" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" data-acao="ent-avames" data-n="0">${nomeMes(mes)}</button><button type="button" data-acao="ent-avames" data-n="1" aria-label="Próximo mês" ${mes >= mesAtual() ? 'disabled' : ''}>›</button></span></div>
      ${alunas.length ? `<p class="small muted">${n} de ${alunas.length} confirmada${alunas.length === 1 ? '' : 's'} em ${E(nomeMes(mes).toLowerCase())}.</p>
        <div class="fic-lista">${alunas.map(x => { const k = marcada(x.id, mes, 'ava');
          return `<div class="fic-pessoa">${U().avatar(x, 36)}<span class="fp-t"><b>${E(nomeDe(x))}</b><span class="small muted">${E(P[x.papel].nome)}${x.uf ? ' · ' + E(x.uf) : ''}</span></span>
            <label class="check ava-check"><input type="checkbox" data-acao="ent-ava" data-id="${E(x.id)}" data-mes="${mes}" ${k ? 'checked' : ''}> <span>${k ? 'Acessou' : 'Não confirmado'}</span></label></div>`; }).join('')}</div>`
        : '<div class="vazio"><span>Ninguém matriculado no FIC ainda.</span></div>'}</section>`;
  }

  /* "Li e entendi": os pontos importantes do Guia, uma vez só, com registro */
  const IMPORTANTE = {
    guia_bolsista: { t: 'Antes de começar: o que é importante saber', l: [
      'A bolsa não gera vínculo empregatício com o IFRN, a FUNCERN ou o MDA.',
      'A bolsa é paga uma vez por mês, pela FUNCERN, na conta ou chave Pix no seu nome.',
      'Sem as entregas do mês, o pagamento não pode ser feito, porque o projeto presta contas ao MDA.',
      'A matrícula no curso FIC precisa ficar ativa durante todo o período da bolsa.',
      'Se você já recebe outra bolsa, avise a coordenação.'] },
    guia_agente: { t: 'Antes de começar: como funciona para a agente de campo', l: [
      'Você não recebe bolsa: recebe ajuda de custo pelos dias de campo, calculada pela distância até os quintais.',
      'A ajuda de custo não gera vínculo empregatício com o IFRN, a FUNCERN ou o MDA.',
      'Só é paga a visita registrada no sistema, com fotos, localização e o relato do que foi feito.',
      'Antes da primeira visita paga, você precisa estar matriculada no curso FIC e cadastrada na FUNCERN, com o termo assinado.',
      'Os dados das mulheres são protegidos por lei: não fotografe telas nem repasse informações.'] }
  };
  const docDe = papel => R.ehBolsista(papel) ? 'guia_bolsista' : papel === 'agente' ? 'guia_agente' : null;
  function blocoCiencia() {
    const eu = S().eu; const doc = docDe(eu.papel);
    if (!doc || semBanco() || (S().ciencias || []).some(c => c.equipe_id === eu.id && c.documento === doc)) return '';
    const x = IMPORTANTE[doc];
    return `<div class="bloco ciencia"><h2>${E(x.t)}</h2><ul class="perfil-lista">${x.l.map(t => `<li>${E(t)}</li>`).join('')}</ul>
      <div class="acoes"><button class="btn pri" data-acao="ent-ciencia" data-doc="${doc}">Li e entendi</button>
      <button class="btn" data-acao="ajuda" data-k="${doc}">Ver o guia completo</button></div>
      <p class="small muted">Fica registrado que você leu, com data e hora.</p></div>`;
  }
  function cienciaDe(id, papel) {   // para a ficha da pessoa (coordenação)
    const doc = docDe(papel); if (!doc) return null;
    const c = (S().ciencias || []).find(x => x.equipe_id === id && x.documento === doc);
    return c ? 'Leu e entendeu em ' + new Date(c.em).toLocaleString('pt-BR') : 'Ainda não confirmou a leitura';
  }

  async function clique(a, el) {
    const eu = S().eu;
    if (a === 'ent-mes') { const n = +el.dataset.n; G.mes = n ? somaMes(G.mes || mesAtual(), n) : mesAtual(); U().render(); return; }
    if (a === 'ent-avames') { const n = +el.dataset.n; G.avaMes = n ? somaMes(G.avaMes || mesAtual(), n) : mesAtual(); U().render(); return; }
    if (a === 'ent-presenca' || a === 'ent-ava') {
      const id = a === 'ent-ava' ? el.dataset.id : eu.id; const item = a === 'ent-ava' ? 'ava' : 'presenca';
      const on = a === 'ent-ava' ? el.checked : el.dataset.on === '1'; const mes = el.dataset.mes + '-01';
      el.disabled = true;
      try {
        await S().api.marcarEntrega(id, mes, item, on);
        S().entregas = (S().entregas || []).filter(x => !(x.equipe_id === id && String(x.mes).slice(0, 7) === el.dataset.mes && x.item === item));
        if (on) S().entregas.push({ equipe_id: id, mes, item, marcado_por: eu.id, marcado_em: new Date().toISOString() });
        U().toast(item === 'ava' ? (on ? 'Acesso ao AVA confirmado.' : 'Confirmação retirada.') : (on ? 'Lista de presença marcada como entregue.' : 'Marcação retirada.'));
      } catch (e) { U().toast(e.message || String(e)); if (a === 'ent-ava') el.checked = !on; }
      U().render(); return;
    }
    if (a === 'ent-ciencia') {
      el.disabled = true;
      try { await S().api.darCiencia(eu.id, el.dataset.doc); S().ciencias = (S().ciencias || []).concat([{ equipe_id: eu.id, documento: el.dataset.doc, em: new Date().toISOString() }]); U().toast('Obrigada! Leitura registrada.'); }
      catch (e) { el.disabled = false; U().toast(e.message || String(e)); }
      U().render();
    }
  }

  MQ.entregasUI = { cartaoBolsista, resumoAval, secaoAva, blocoCiencia, cienciaDe, clique, itens };
})();
