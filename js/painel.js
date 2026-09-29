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
      atual = d.aptas.length; alvo = 11; un = 'pessoas habilitadas';
      nota = `${d.pagaveis.length} de 11 cadastradas (1 coordenação técnica e 10 bolsistas). Meta: ${meta.alvo} ${meta.un}.`;
    } else if (meta.fonte === 'diagnostico') {
      const dg = S.diagnosticos || [];
      atual = dg.length;
      const aprov = dg.filter(x => x.situacao === 'aprovado').length, seca = dg.filter(x => x.sem_agua).length;
      nota = `${aprov} com plano aprovado pela coordenação técnica${seca ? ` · ${seca} sem água na seca (encaminhadas, sem kit)` : ''}.`;
    } else if (meta.fonte === 'implantacao' || meta.fonte === 'visitas') {
      const etapa = meta.fonte === 'implantacao' ? 'implantacao' : 'acompanhamento';
      const vs = (S.visitas || []).filter(v => v.etapa === etapa);
      atual = vs.filter(v => v.situacao === 'realizada').length;
      const prevs = vs.filter(v => v.situacao === 'prevista').length;
      nota = `Visitas de ${etapa === 'implantacao' ? 'implantação' : 'acompanhamento'} marcadas como feitas no roteiro${prevs ? ` · ${prevs} agendada${prevs > 1 ? 's' : ''}` : ''}. O relatório de visita ainda é em papel.`;
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
    else if (atual >= alvo) st = { cls: 'ok', t: 'Concluída' };
    else if (mes - 1 < meta.ini) st = { cls: 'off', t: atual ? 'Adiantada' : 'Começa em ' + MESES[meta.ini - 1] };
    else st = atual >= prev ? { cls: 'ok', t: 'No ritmo' } : { cls: 'crit', t: 'Abaixo do previsto' };
    return `<div class="meta-linha">
      <div class="meta-cab"><span class="meta-id">${meta.id}</span><span class="meta-nome">${E(meta.nome)}</span><span class="chip ${st.cls}">${E(st.t)}</span></div>
      <div class="medidor" role="img" aria-label="${atual == null ? 'sem registro' : atual + ' de ' + alvo}${pctPrev != null ? ', previsto até agora ' + prev : ''}">
        <i style="width:${pctAtual}%"></i>${pctPrev != null && prev > 0 ? `<b class="previsto" style="left:${pctPrev}%"></b>` : ''}</div>
      <div class="meta-num"><span class="num"><b>${atual == null ? '—' : atual}</b> de ${alvo} ${E(un)}</span>
        ${pctPrev != null && mes - 1 >= meta.ini ? `<span class="muted num">previsto até ${MESES[Math.max(0, mes - 2)]}: ${prev}</span>` : ''}</div>
      <p class="nota">${E(nota)} <span class="muted">Período: ${MESES[meta.ini - 1]} a ${MESES[meta.fim - 1]}.</span></p>
    </div>`;
  }


  /* ---------- mapa dos quintais (SVG próprio: funciona sem internet e sem serviço de mapas) ---------- */
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
    const dg = (MQ.ui && MQ.ui.S.diagnosticos || []).find(x => x.ficha_id === f.id && x.latitude != null);
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
  function mapa(S, d) {
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
      return `<path d="${g.r.map(path).join('')}" class="${destaque ? 'uf-proj' : 'uf-viz'} uf-clic" data-acao="mapa-uf" data-uf="${uf}" stroke-width="${esc * 0.25}"><title>${U.nomeUF(uf)}</title></path>`;
    }).join('');
    const rotulos = foco ? '' : Object.entries(MQ.GEO.uf).filter(([uf]) => ufsProj.includes(uf)).map(([uf, g]) => {
      const [x, y] = px(g.c); return `<text x="${x}" y="${y}" class="uf-rot" font-size="${esc * 3.2}" text-anchor="middle">${uf}</text>`;
    }).join('');
    // agrupa por município (evita pontos empilhados)
    const grupos = {};
    todos.forEach(x => { const k = x.f.uf + '|' + norm(x.f.municipio); (grupos[k] = grupos[k] || { k, uf: x.f.uf, mun: x.f.municipio, itens: [] }).itens.push(x); });
    const lista = Object.values(grupos).sort((a, b) => b.itens.length - a.itens.length);
    ULTIMO.grupos = grupos; ULTIMO.foco = foco; ULTIMO.geo = {};
    const baseDe = g => { const muns = MQ.GEO.mun[g.uf] || {}; const chave = Object.keys(muns).find(m => norm(m) === norm(g.mun));
      return { base: chave ? muns[chave] : (MQ.GEO.uf[g.uf] || {}).c, nome: chave || g.mun }; };
    const resumo = g => ordem.slice().reverse().map(id => [id, g.itens.filter(x => x.cat === id).length]).filter(([, q]) => q);
    let marcas;
    if (!focoMun) {
      marcas = lista.map(g => {
        const { base, nome } = baseDe(g); if (!base) return '';
        const [cx, cy] = px(base); const n = g.itens.length; const R = esc * ((foco ? 0.9 : 0.6) + (foco ? 0.38 : 0.33) * Math.sqrt(n));
        ULTIMO.geo[g.k] = { cx, cy, R };
        const por = resumo(g);
        let ang = -Math.PI / 2; const fatias = por.length === 1
          ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${CATS.find(k => k.id === por[0][0]).cor}"/>`
          : por.map(([id, q]) => { const a0 = ang, a1 = ang + 2 * Math.PI * q / n; ang = a1;
              const p0 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)], p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
              return `<path d="M${cx},${cy}L${p0[0]},${p0[1]}A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1[0]},${p1[1]}Z" fill="${CATS.find(k => k.id === id).cor}"/>`; }).join('');
        const txt = `${nome}/${g.uf} · ${n} mulher${n > 1 ? 'es' : ''} com ficha: ${por.map(([id, q]) => q + ' ' + CATS.find(k => k.id === id).nome.toLowerCase()).join(', ')} · clique para ver ${foco ? 'cada quintal' : 'o estado'}`;
        return `<g class="q-pt q-grupo" data-acao="mapa-info" data-uf="${g.uf}" data-mun="${E(g.k)}" data-dica="${E(txt)}">${fatias}<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--surface)" stroke-width="${esc * 0.3}"/>
          ${n > 1 ? `<text x="${cx}" y="${cy + R * 0.34}" text-anchor="middle" font-size="${Math.min(R * 1.05, esc * 3)}" class="q-num">${n}</text>` : ''}<title>${E(txt)}</title></g>`;
      }).join('');
    } else {
      const r = esc * 1.4;
      marcas = pts.map(({ f, cat, p }) => {
        const c = CATS.find(k => k.id === cat).cor; const [x, y] = p.xy;
        const txt = `${f.municipio}/${f.uf} · ${(MQ.RESULTADOS[f.resultado] || {}).nome}${f.situacao !== 'aprovada' ? ' (' + (MQ.SITUACOES[f.situacao] || {}).nome + ')' : ''}${p.exato ? '' : ' · posição aproximada'} · clique para abrir a ficha`;
        return p.exato
          ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="var(--surface)" stroke-width="${r * 0.45}" class="q-pt" data-acao="mapa-info" data-id="${E(f.id)}" data-dica="${E(txt)}"><title>${E(txt)}</title></circle>`
          : `<circle cx="${x}" cy="${y}" r="${r * 0.85}" fill="var(--surface)" stroke="${c}" stroke-width="${r * 0.55}" class="q-pt" data-acao="mapa-info" data-id="${E(f.id)}" data-dica="${E(txt)}"><title>${E(txt)}</title></circle>`;
      }).join('');
    }
    const cont = {}; pts.forEach(x => { cont[x.cat] = (cont[x.cat] || 0) + 1; });
    const naoAtende = d.fichas.filter(f => f.resultado === 'nao_atende' && (!foco || f.uf === foco) && (!focoMun || f.uf + '|' + norm(f.municipio) === focoMun)).length;
    const btn = (uf, t) => `<button type="button" data-acao="mapa-uf" data-uf="${uf}" aria-pressed="${foco === uf && !focoMun}">${t}</button>`;
    const nomeMun = focoMun && grupos[focoMun] ? baseDe(grupos[focoMun]).nome : '';
    const onde = focoMun ? E(nomeMun) + '/' + foco : foco ? E(U.nomeUF(foco)) : 'nos 5 estados';
    const munLista = !focoMun && lista.length ? `<div class="mun-lista"><span class="small muted">${foco ? 'Municípios' : 'Municípios com mais fichas'}</span>
        ${lista.slice(0, foco ? 20 : 8).map(g => `<button type="button" class="link" data-acao="mapa-mun" data-uf="${g.uf}" data-mun="${E(g.k)}">${E(baseDe(g).nome)}${foco ? '' : '/' + g.uf} <b class="num">${g.itens.length}</b></button>`).join('')}</div>` : '';
    return `<section class="secao" aria-labelledby="t-mapa">
      <div class="secao-cab"><div><h2 id="t-mapa">Quintais no mapa</h2>
        <p>${pts.length ? `${pts.length} mulher${pts.length > 1 ? 'es' : ''} com ficha ${onde}${focoMun ? ` · ${exatos} com localização do GPS, ${pts.length - exatos} aproximada${pts.length - exatos === 1 ? '' : 's'}` : ' · círculo = município, número = fichas; clique para aproximar'}` : 'Cada ficha lançada aparece aqui.'}</p></div>
        <span class="seg" role="group" aria-label="Estado no mapa">${btn('', 'Todos')}${MQ.UFS.map(u => btn(u.uf, u.uf)).join('')}</span></div>
      ${foco ? `<nav class="migalha" aria-label="Onde você está no mapa">
        <button type="button" data-acao="mapa-uf" data-uf=""><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>5 estados</button>
        ${focoMun ? `<span aria-hidden="true">›</span><button type="button" data-acao="mapa-uf" data-uf="${foco}">${E(U.nomeUF(foco))}</button><span aria-hidden="true">›</span><b aria-current="page">${E(nomeMun)}</b>`
          : `<span aria-hidden="true">›</span><b aria-current="page">${E(U.nomeUF(foco))}</b>`}</nav>` : ''}
      <div class="mapa-caixa">
        <svg class="mapa" viewBox="${vb.join(' ')}" role="img" aria-label="Mapa com ${pts.length} quintais ${onde}" preserveAspectRatio="xMidYMid meet">
          ${estados}${rotulos}${marcas}
        </svg>
        <div class="mapa-dica" id="mapa-dica" hidden></div>
        <div class="mapa-cartao" id="mapa-cartao" role="dialog" aria-label="Informações do ponto" hidden></div>
        <div style="display:grid;gap:14px;align-content:start">
        <ul class="legenda">${CATS.map(k => `<li><span class="lg-pt" style="background:${k.cor}"></span>${E(k.nome)} <b class="num">${cont[k.id] || 0}</b></li>`).join('')}
          ${focoMun ? '<li><span class="lg-pt oco"></span>Contorno vazio: posição aproximada (sem GPS)</li>' : ''}
          ${naoAtende ? `<li class="muted">${naoAtende} que não atende${naoAtende > 1 ? 'm' : ''} aos critérios fica${naoAtende > 1 ? 'm' : ''} fora do mapa</li>` : ''}</ul>
        ${munLista}</div>
      </div>
      <p class="nota">O mapa mostra onde moram as mulheres: use só dentro do sistema. Em relatórios e divulgação, mostre números por município.</p>
    </section>`;
  }

  /* ---------- perfil das mulheres (recorte) e linha de base de renda ---------- */
  function perfil(S, d) {
    const base = d.selAprov.length ? d.selAprov : d.fichas.filter(f => f.resultado === 'selecionada');
    const rotBase = d.selAprov.length ? 'das ' + base.length + ' selecionadas e aprovadas' : 'das ' + base.length + ' fichas marcadas como selecionadas (ainda sem aprovação)';
    const itens = [
      ['p_cadunico', 'Família no CadÚnico'], ['p_sustento', 'Principal responsável pelo sustento'], ['p_sem_ater', 'Sem assistência técnica (ATER)'],
      ['p_grupo', 'Participa de grupo, associação ou MPA'], ['p_raca_povo', 'Negra, indígena, quilombola ou de comunidade tradicional'],
      ['p_caf', 'Com CAF'], ['p_jovem', 'Jovem de 18 a 29 anos']
    ];
    const barras = base.length ? itens.map(([k, t]) => {
      const n = base.filter(f => f[k]).length, pct = Math.round(n / base.length * 100);
      return `<li><span class="pf-rot">${E(t)}</span><span class="pf-bar"><i style="width:${pct}%"></i></span><span class="num pf-v"><b>${pct}%</b> <span class="muted">(${n})</span></span></li>`;
    }).join('') : '';
    const diags = (S.diagnosticos || []).filter(x => x.renda_quintal != null || x.renda_familiar != null);
    const mediana = arr => { const a = arr.filter(v => v != null && !isNaN(v)).map(Number).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const mq = mediana(diags.map(x => x.renda_quintal)), mf = mediana(diags.map(x => x.renda_familiar));
    const semRenda = diags.filter(x => !(+x.renda_quintal > 0)).length;
    // linha de base (bloco 4b do diagnóstico) e, quando houver, a avaliação final
    // com avaliações, as duas colunas usam só os quintais medidos duas vezes (comparar grupos diferentes engana)
    const avs = S.avaliacoes || [];
    const pares = avs.map(a => { const dg = (S.diagnosticos || []).find(x => x.ficha_id === a.ficha_id); const i0 = dg && dg.dados && dg.dados.impacto, i1 = a.dados && a.dados.impacto;
      return i0 && i1 && i0.ebia_nivel && i1.ebia_nivel ? [i0, i1] : null; }).filter(Boolean);
    const temDepois = pares.length > 0;
    const imps = temDepois ? pares.map(x => x[0]) : (S.diagnosticos || []).map(x => x.dados && x.dados.impacto).filter(x => x && x.ebia_nivel);
    const impsD = pares.map(x => x[1]);
    const nImp = imps.length, nAv = pares.length;
    const pc = (l, fn) => l.length ? Math.round(l.filter(fn).length / l.length * 100) + '%' : null;
    const md = (l, k) => { const v = l.map(x => x[k]).filter(x => x != null); return v.length ? (Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10).toLocaleString('pt-BR') : null; };
    const avPar = avs.filter(a => (S.diagnosticos || []).some(x => x.ficha_id === a.ficha_id && x.renda_quintal != null) && a.dados && a.dados.renda_quintal != null);
    const mqD = avPar.length ? mediana(avPar.map(a => a.dados.renda_quintal)) : null;
    const mqA = avPar.length ? mediana(avPar.map(a => (S.diagnosticos.find(x => x.ficha_id === a.ficha_id) || {}).renda_quintal)) : null;
    const razoes = diags.filter(x => +x.renda_familiar > 0 && x.renda_quintal != null).map(x => x.renda_quintal / x.renda_familiar);
    const pesoQ = razoes.length ? Math.round(mediana(razoes) * 100) : null;
    const semAgua = (S.diagnosticos || []).length ? Math.round((S.diagnosticos || []).filter(x => x.sem_agua).length / S.diagnosticos.length * 100) + '%' : null;
    const linhasPP = [
      nImp ? ['Em insegurança alimentar (EBIA)', pc(imps, x => x.ebia_nivel !== 'seguranca'), pc(impsD, x => x.ebia_nivel !== 'seguranca')] : null,
      nImp ? ['Com fome (insegurança moderada ou grave)', pc(imps, x => ['moderada', 'grave'].includes(x.ebia_nivel)), pc(impsD, x => ['moderada', 'grave'].includes(x.ebia_nivel))] : null,
      nImp ? ['Dias por semana comendo do quintal', md(imps, 'dias_consumo'), md(impsD, 'dias_consumo')] : null,
      nImp ? ['Vendem ou trocam o que produzem', pc(imps, x => x.vende), pc(impsD, x => x.vende)] : null,
      nImp ? ['Decidem sobre o dinheiro da venda', pc(imps, x => ['ela', 'ela_e_outro'].includes(x.decide)), pc(impsD, x => ['ela', 'ela_e_outro'].includes(x.decide))] : null,
      semAgua ? ['Sem água que dure na seca (demanda de cisterna)', semAgua, null] : null
    ].filter(Boolean);
    return `<section class="secao" aria-labelledby="t-perfil">
      <div class="secao-cab"><div><h2 id="t-perfil">Quem são as mulheres</h2><p>${base.length ? 'Percentual ' + rotBase + ', pelos critérios de prioridade da ficha.' : 'Aparece quando houver mulheres selecionadas.'}</p></div></div>
      <div class="duas-col perfil-cols">
        <div class="bloco">${base.length ? `<ul class="perfil">${barras}</ul>
          <p class="nota">"Negra, indígena, quilombola ou de comunidade tradicional" é um único campo na ficha v2: não dá para separar quilombolas.</p>` : '<p class="muted">Sem dados ainda.</p>'}</div>
        <div class="bloco"><h3>Ponto de partida${temDepois ? ' e hoje' : ''}</h3>
          ${diags.length ? `<div class="resumo r2">
              <div><span class="v num">${R.fmtBRL(mq || 0).replace(',00', '')}</span><span class="l">mediana por mês com vendas do quintal${mqD != null ? ` · nos ${avPar.length} avaliados: ${R.fmtBRL(mqA || 0).replace(',00', '')} → <b>${R.fmtBRL(mqD).replace(',00', '')}</b>` : ''}</span></div>
              <div><span class="v num">${R.fmtBRL(mf || 0).replace(',00', '')}</span><span class="l">mediana da renda familiar por mês${pesoQ != null ? ` · o quintal é ${pesoQ}% dela` : ''}</span></div></div>
            <ul class="pp">${linhasPP.map(([t, a1, d1]) => `<li><span>${E(t)}</span><b class="num">${a1}</b>${temDepois ? `<span class="num pp-d">${d1 == null ? '—' : '→ ' + d1}</span>` : ''}</li>`).join('')}</ul>
            <p class="nota">${temDepois ? `Início → hoje nos ${nAv} quinta${nAv > 1 ? 'is' : 'l'} já avaliado${nAv > 1 ? 's' : ''} (os mesmos nas duas colunas). Detalhe por estado na aba Campo.`
              : nImp ? `Linha de base de ${nImp} diagnóstico${nImp > 1 ? 's' : ''}. O "hoje" aparece quando as avaliações finais (5ª visita) forem registradas.` : 'As medidas de fome, consumo e autonomia aparecem quando os diagnósticos tiverem o bloco "4b".'}</p>`
            : '<p class="small muted">Vem do diagnóstico (1ª visita): renda, fome (EBIA), consumo do quintal, venda e água. Aparece quando os diagnósticos forem registrados.</p>'}</div>
      </div></section>`;
  }

  /* equipe de execução: quem são e de onde partem (perfil no campo do cadastro) */
  function equipeExec(S) {
    const P = MQ.PAPEIS;
    const ativos = (S.equipe || []).filter(m => m.status === 'ativa' && m.papel !== 'coord_geral');
    const campo = ativos.filter(m => ['coord_tecnico', 'articulacao', 'apoio', 'agente'].includes(m.papel));
    const conta = p => ativos.filter(m => m.papel === p).length;
    const bols = conta('articulacao') + conta('apoio');
    const habil = ativos.filter(m => R.habilitado(m)).length;
    const perfis = new Map((S.perfisEquipe || []).filter(x => x.perfil).map(x => [x.equipe_id, x.perfil]));
    const resp = campo.filter(m => perfis.has(m.id)).map(m => perfis.get(m.id));
    const pc = (fn) => { const v = resp.filter(p => fn(p) != null); return v.length ? Math.round(v.filter(p => fn(p) === true).length / v.length * 100) + '%' : '—'; };
    const leram = ativos.filter(m => ['articulacao', 'apoio', 'agente'].includes(m.papel));
    const nLeram = leram.filter(m => (S.ciencias || []).some(c => c.equipe_id === m.id)).length;
    const linhas = [
      ['São agricultoras', pc(p => p.agricultora)],
      ['Atuam junto às mulheres rurais do território', pc(p => p.atua_mulheres)],
      ['Moram na zona rural', pc(p => p.mora_rural)],
      ['Mais de 5 anos com agricultura familiar ou agroecologia', pc(p => p.experiencia ? p.experiencia === 'mais5' : null)],
      ['Têm celular com internet', pc(p => p.internet)],
      ['Já recebem outra bolsa (conferir acúmulo)', pc(p => p.outra_bolsa)]
    ];
    return `<section class="secao" aria-labelledby="t-exec">
      <div class="secao-cab"><div><h2 id="t-exec">Quem é a equipe de execução</h2><p>Pessoas ativas no projeto, sem a coordenação geral. O perfil no campo vem do cadastro (coordenação técnica, bolsistas e agentes).</p></div></div>
      <div class="duas-col perfil-cols">
        <div class="bloco"><h3>Composição</h3>
          <div class="resumo r2">
            <div><span class="v num">${ativos.length}</span><span class="l">pessoas na equipe</span></div>
            <div><span class="v num">${habil}<small> de ${ativos.length}</small></span><span class="l">habilitadas (todas as funções, com agentes e professores)</span></div></div>
          <ul class="pp">
            <li><span>Coordenação técnica</span><b class="num">${conta('coord_tecnico')}</b></li>
            <li><span>Bolsistas (articulação e apoio estadual)</span><b class="num">${bols}<small class="muted"> de 10</small></b></li>
            <li><span>Agentes de campo</span><b class="num">${conta('agente')}</b></li>
            <li><span>Professores do FIC</span><b class="num">${conta('professor_fic')}</b></li>
            <li><span>Auxiliar administrativo</span><b class="num">${conta('auxiliar_adm')}</b></li>
            ${leram.length ? `<li><span>Bolsistas e agentes que leram o guia</span><b class="num">${nLeram}<small class="muted"> de ${leram.length}</small></b></li>` : ''}
          </ul></div>
        <div class="bloco"><h3>Ponto de partida da equipe</h3>
          ${resp.length ? `<ul class="pp">${linhas.map(([t, v]) => `<li><span>${E(t)}</span><b class="num">${v}</b></li>`).join('')}</ul>
            <p class="nota">Entre ${resp.length} de ${campo.length} pessoa${campo.length > 1 ? 's' : ''} que responderam o perfil no campo. O Guia pede bolsistas mulheres, de preferência agricultoras ou com atuação junto às mulheres do território.</p>`
            : `<p class="small muted">${S.perfisSemBanco ? 'O perfil no campo ainda não está instalado no servidor (rode o 19_entregas_do_mes.sql).' : 'Aparece quando a coordenação técnica, as bolsistas e as agentes responderem o perfil no campo no cadastro (pelo link é obrigatório).'}</p>`}</div>
      </div></section>`;
  }

  function visaoGeral(S) {
    const d = dados(S);
    const mes = mesDoProjeto();
    const diasFim = R.diasAte(MQ.PROJETO.vigencia.fim);
    const al = alertas(S, d);
    const marcos = MQ.MARCOS.filter(m => R.diasAte(m.d) >= -7).slice(0, 4);
    const selPct = Math.min(100, d.selAprov.length / 200 * 100);
    const aguard = d.fichas.filter(f => f.situacao === 'aguardando').length;
    const svg = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const icone = n => n === 'crit' ? svg('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>')
      : n === 'pend' ? svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') : svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>');
    const NOME_ABA = { equipe: 'Equipe', selecao: 'Seleção', campo: 'Campo', custos: 'Custos', historico: 'Histórico', visao: 'Visão geral' };
    const rotNivel = { crit: 'Crítico', pend: 'Atenção', info: 'Informação' };
    return `
      <div class="cab"><div><span class="eyebrow">Visão geral</span><h1>Mulheres &amp; Quintais</h1>
        <p>Vigência até ${R.fmtData(MQ.PROJETO.vigencia.fim)} · ${diasFim > 0 ? 'faltam ' + diasFim + ' dias' : 'encerrada'}.</p></div>
        <div class="cab-lado">
          <div class="ltm"><span class="small muted"><b>Mês ${Math.min(Math.max(mes, 1), MESES.length)} de ${MESES.length}</b> do projeto (${MESES[Math.min(Math.max(mes, 1), MESES.length) - 1]})</span>
          <div class="linha-tempo-mini" role="img" aria-label="Mês ${mes} de ${MESES.length} do projeto">${MESES.map((m, i) => `<span class="${i + 1 < mes ? 'passou' : i + 1 === mes ? 'agora' : ''}" title="${m}"></span>`).join('')}</div></div>
          ${(MQ.ui.S.eu || {}).papel === 'coord_geral' ? `          <a class="atalho" href="${E(MQ.PAINEL_FINANCEIRO)}" target="_blank" rel="noopener">
            <span class="atalho-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>
            <span><b>Financeiro e entregas</b><span class="small muted">Recursos, rubricas e metas físicas</span></span>
            <span class="atalho-seta" aria-hidden="true">↗</span></a>` : ''}
        </div></div>

      <div class="resumo" aria-label="Números do projeto">
        <div><span class="v num">${d.pagaveis.length}<small> de 11</small></span><span class="l">na equipe (coordenação técnica e bolsistas)</span></div>
        <div><span class="v num">${d.aptas.length}<small> de 11</small></span><span class="l">habilitadas (FIC, FUNCERN e termo)</span></div>
        <div><span class="v num">${d.fichas.length}</span><span class="l">fichas de indicação lançadas${aguard ? ` · <b>${aguard}</b> aguardando` : ''}</span></div>
        <div><span class="v num">${d.selAprov.length}<small> de 200</small></span><span class="l">mulheres selecionadas e aprovadas</span></div>
      </div>

      <section class="secao" aria-labelledby="t-alertas">
        <h2 id="t-alertas">O que pede atenção</h2>
        ${al.length ? `<ul class="alertas">${al.map(x => `<li class="al-${x.nivel}"><span class="al-ic" aria-hidden="true">${icone(x.nivel)}</span>
          <span><span class="sr">${rotNivel[x.nivel]}: </span><b>${E(x.texto)}</b><br><span class="small muted">${E(x.det)}</span></span>
          ${x.aba ? `<button class="al-ir" data-acao="aba" data-aba="${x.aba}" title="Resolver na aba ${NOME_ABA[x.aba] || x.aba}" aria-label="Resolver na aba ${NOME_ABA[x.aba] || x.aba}"><span>${NOME_ABA[x.aba] || x.aba}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>` : ''}</li>`).join('')}</ul>`
          : '<p class="aviso" style="background:var(--ok-bg)">Nada pendente nos dados do sistema.</p>'}
      </section>

      ${MQ.GEO ? mapa(S, d) : ''}

      ${perfil(S, d)}
      ${equipeExec(S)}

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
        ['Comunidade', f.comunidade], ['Prioridade', (f.pontos ?? '—') + ' pontos'], ['Indicada por', b ? b.nome_social || b.nome : null],
        ['Diagnóstico', dg ? (dg.situacao === 'aprovado' ? 'plano aprovado' : 'feito, ' + (dg.situacao === 'devolvido' ? 'devolvido' : 'aguardando aprovação')) : 'ainda não'],
        ['Visitas feitas', String(vs)], ['Local', el.getAttribute('fill') === 'var(--surface)' ? 'aproximado (sem GPS)' : 'GPS']].filter(l => l[1]);
      html = `<div class="mc-cab"><b>Quintal em ${E(f.municipio)}/${f.uf}</b><button class="fechar" data-acao="mapa-cartao-fechar" aria-label="Fechar">×</button></div>
        <dl class="dl mc-dl">${lin.map(([k, v]) => `<dt>${k}</dt><dd>${E(v)}</dd>`).join('')}</dl>
        <div class="acoes"><button class="btn peq pri" data-acao="ficha-ver" data-id="${E(f.id)}">Abrir a ficha</button></div>`;
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
  function mapaUFs(valores, rotulo) {
    const ufsProj = MQ.UFS.map(u => u.uf);
    const vb = caixa(ufsProj); const esc = Math.max(vb[2], vb[3]) / 100;
    const max = Math.max(1, ...ufsProj.map(u => valores[u] || 0));
    const tom = v => !v ? 'var(--mapa-0)' : `color-mix(in oklab, var(--mapa-1) ${Math.round(25 + 75 * v / max)}%, var(--mapa-0))`;
    const path = anel => 'M' + anel.map(p => px(p).map(v => v.toFixed(3)).join(',')).join('L') + 'Z';
    const estados = Object.entries(MQ.GEO.uf).filter(([uf]) => ufsProj.includes(uf)).map(([uf, g]) => {
      const proj = true;
      return `<path d="${g.r.map(path).join('')}" class="${proj ? 'uf-pub' : 'uf-viz'}" ${proj ? `style="fill:${tom(valores[uf])}"` : ''} stroke-width="${esc * 0.25}"><title>${proj ? `${U.nomeUF(uf)}: ${valores[uf] || 0} ${rotulo}` : uf}</title></path>`;
    }).join('');
    const ordem = ufsProj.slice().sort((x, y) => (valores[y] || 0) - (valores[x] || 0) || x.localeCompare(y));
    return `<svg class="mapa mapa-pub" viewBox="${vb.join(' ')}" role="img" aria-label="${E(rotulo)} por estado: ${ufsProj.map(u => u + ' ' + (valores[u] || 0)).join(', ')}" preserveAspectRatio="xMidYMid meet">${estados}</svg>
      <ul class="mapa-lista">${ordem.map(uf => `<li><span class="lg-q" style="background:${tom(valores[uf])}"></span>${uf} <b class="num">${valores[uf] || 0}</b></li>`).join('')}</ul>`;
  }

  MQ.painelUI = { visaoGeral, mesDoProjeto, mapaUFs };
})();
