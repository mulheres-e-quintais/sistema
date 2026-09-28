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
  function mapa(S, d) {
    const foco = S.mapaUF || '';
    const ufsProj = MQ.UFS.map(u => u.uf);
    const vb = caixa(foco ? [foco] : ufsProj);
    const esc = Math.max(vb[2], vb[3]) / 100;                // unidade de desenho proporcional ao zoom
    const pts = d.fichas.map(f => ({ f, cat: catDe(f), p: pontoDaFicha(f) })).filter(x => x.cat && x.p && (!foco || x.f.uf === foco));
    const exatos = pts.filter(x => x.p.exato).length;
    const ordem = ['sem_agua', 'aguardando', 'espera', 'aprovada'];
    pts.sort((a, b) => ordem.indexOf(a.cat) - ordem.indexOf(b.cat));
    const path = anel => 'M' + anel.map(p => px(p).map(v => v.toFixed(3)).join(',')).join('L') + 'Z';
    const estados = Object.entries(MQ.GEO.uf).map(([uf, g]) => {
      const proj = ufsProj.includes(uf);
      const destaque = foco ? uf === foco : proj;
      return `<path d="${g.r.map(path).join('')}" class="${destaque ? 'uf-proj' : 'uf-viz'}${proj ? ' uf-clic' : ''}" ${proj ? `data-acao="mapa-uf" data-uf="${uf}"` : ''} stroke-width="${esc * 0.25}"><title>${uf}</title></path>`;
    }).join('');
    const rotulos = Object.entries(MQ.GEO.uf).filter(([uf]) => ufsProj.includes(uf) && !foco).map(([uf, g]) => {
      const [x, y] = px(g.c); return `<text x="${x}" y="${y}" class="uf-rot" font-size="${esc * 3.2}" text-anchor="middle">${uf}</text>`;
    }).join('');
    // municípios do projeto: ponto sempre; nome só onde há ficha (evita nomes sobrepostos)
    const comFicha = new Set(d.fichas.filter(f => f.uf === foco).map(f => norm(f.municipio)));
    const muns = foco ? Object.entries(MQ.GEO.mun[foco] || {}).map(([n, c]) => { const [x, y] = px(c);
      return `<circle cx="${x}" cy="${y}" r="${esc * 0.35}" class="mun-pt"><title>${E(n)}</title></circle>${comFicha.has(norm(n)) ? `<text x="${x + esc * 2.6}" y="${y + esc * 0.6}" class="mun-rot" font-size="${esc * 1.8}">${E(n)}</text>` : ''}`; }).join('') : '';
    const r = esc * (foco ? 1.25 : 1.0);
    const bolas = pts.map(({ f, cat, p }) => {
      const c = CATS.find(k => k.id === cat).cor; const [x, y] = p.xy;
      const txt = `${f.municipio}/${f.uf} · ${(MQ.RESULTADOS[f.resultado] || {}).nome}${f.situacao !== 'aprovada' ? ' (' + (MQ.SITUACOES[f.situacao] || {}).nome + ')' : ''}${p.exato ? '' : ' · posição aproximada'} · clique para abrir a ficha`;
      return p.exato
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="var(--surface)" stroke-width="${r * 0.45}" class="q-pt" data-acao="ficha-ver" data-id="${E(f.id)}" data-dica="${E(txt)}"><title>${E(txt)}</title></circle>`
        : `<circle cx="${x}" cy="${y}" r="${r * 0.85}" fill="var(--surface)" stroke="${c}" stroke-width="${r * 0.55}" class="q-pt" data-acao="ficha-ver" data-id="${E(f.id)}" data-dica="${E(txt)}"><title>${E(txt)}</title></circle>`;
    }).join('');
    const cont = {}; pts.forEach(x => { cont[x.cat] = (cont[x.cat] || 0) + 1; });
    const naoAtende = d.fichas.filter(f => f.resultado === 'nao_atende' && (!foco || f.uf === foco)).length;
    const btn = (uf, t) => `<button type="button" data-acao="mapa-uf" data-uf="${uf}" aria-pressed="${foco === uf}">${t}</button>`;
    return `<section class="secao" aria-labelledby="t-mapa">
      <div class="secao-cab"><div><h2 id="t-mapa">Quintais no mapa</h2>
        <p>${pts.length ? `${pts.length} mulher${pts.length > 1 ? 'es' : ''} com ficha${foco ? ' em ' + E(U.nomeUF(foco)) : ''} · ${exatos} com localização do GPS, ${pts.length - exatos} no município (aproximada)` : 'Cada ficha lançada aparece aqui.'}</p></div>
        <span class="seg" role="group" aria-label="Estado no mapa">${btn('', 'Todos')}${MQ.UFS.map(u => btn(u.uf, u.uf)).join('')}</span></div>
      <div class="mapa-caixa">
        <svg class="mapa" viewBox="${vb.join(' ')}" role="img" aria-label="Mapa com ${pts.length} quintais${foco ? ' em ' + foco : ' nos 5 estados'}" preserveAspectRatio="xMidYMid meet">
          ${estados}${rotulos}${muns}${bolas}
        </svg>
        <div class="mapa-dica" id="mapa-dica" hidden></div>
        <ul class="legenda">${CATS.map(k => `<li><span class="lg-pt" style="background:${k.cor}"></span>${E(k.nome)} <b class="num">${cont[k.id] || 0}</b></li>`).join('')}
          <li><span class="lg-pt oco"></span>Contorno vazio: posição aproximada (sem GPS)</li>
          ${naoAtende ? `<li class="muted">${naoAtende} que não atende${naoAtende > 1 ? 'm' : ''} aos critérios fica${naoAtende > 1 ? 'm' : ''} fora do mapa</li>` : ''}</ul>
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
    return `<section class="secao" aria-labelledby="t-perfil">
      <div class="secao-cab"><div><h2 id="t-perfil">Quem são as mulheres</h2><p>${base.length ? 'Percentual ' + rotBase + ', pelos critérios de prioridade da ficha.' : 'Aparece quando houver mulheres selecionadas.'}</p></div></div>
      <div class="duas-col perfil-cols">
        <div class="bloco">${base.length ? `<ul class="perfil">${barras}</ul>
          <p class="nota">"Negra, indígena, quilombola ou de comunidade tradicional" é um único campo na ficha v2: não dá para separar quilombolas.</p>` : '<p class="muted">Sem dados ainda.</p>'}</div>
        <div class="bloco"><h3>Renda com o quintal: linha de base</h3>
          ${diags.length ? `<div class="resumo r2">
              <div><span class="v num">${R.fmtBRL(mq || 0).replace(',00', '')}</span><span class="l">mediana por mês com vendas do quintal</span></div>
              <div><span class="v num">${R.fmtBRL(mf || 0).replace(',00', '')}</span><span class="l">mediana da renda familiar por mês</span></div></div>
            <p class="small">${semRenda} de ${diags.length} mulheres (${Math.round(semRenda / diags.length * 100)}%) não tinham renda de vendas do quintal no diagnóstico.</p>`
            : '<p class="small muted">Vem do diagnóstico (1ª visita). Quando os diagnósticos forem registrados, aparecem aqui a mediana de renda do quintal e da família.</p>'}
          <p class="nota">O "depois" só será comparável se a visita final perguntar a mesma coisa, do mesmo jeito. Sem isso, não há "renda antes × depois".</p></div>
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

      ${MQ.GEO ? mapa(S, d) : ''}

      ${perfil(S, d)}

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
    const b = ev.target.closest('[data-acao="mapa-uf"]'); if (!b) return;
    const S = MQ.ui.S; S.mapaUF = S.mapaUF === b.dataset.uf && b.tagName !== 'BUTTON' ? '' : b.dataset.uf; MQ.ui.render();
  });
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
    const estados = Object.entries(MQ.GEO.uf).map(([uf, g]) => {
      const proj = ufsProj.includes(uf);
      return `<path d="${g.r.map(path).join('')}" class="${proj ? 'uf-pub' : 'uf-viz'}" ${proj ? `style="fill:${tom(valores[uf])}"` : ''} stroke-width="${esc * 0.25}"><title>${proj ? `${U.nomeUF(uf)}: ${valores[uf] || 0} ${rotulo}` : uf}</title></path>`;
    }).join('');
    const ordem = ufsProj.slice().sort((x, y) => (valores[y] || 0) - (valores[x] || 0) || x.localeCompare(y));
    return `<svg class="mapa mapa-pub" viewBox="${vb.join(' ')}" role="img" aria-label="${E(rotulo)} por estado: ${ufsProj.map(u => u + ' ' + (valores[u] || 0)).join(', ')}" preserveAspectRatio="xMidYMid meet">${estados}</svg>
      <ul class="mapa-lista">${ordem.map(uf => `<li><span class="lg-q" style="background:${tom(valores[uf])}"></span>${uf} <b class="num">${valores[uf] || 0}</b></li>`).join('')}</ul>`;
  }

  MQ.painelUI = { visaoGeral, mesDoProjeto, mapaUFs };
})();
