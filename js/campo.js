/* Mulheres & Quintais — trabalho de campo: agente de campo, visitas (roteiro e dias de campo)
   e diagnóstico + plano do quintal (modelo 3, feito na 1ª visita). Funciona sem internet. */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui;
  const S = () => MQ.ui.S;
  const E = s => MQ.ui.esc(s);
  const $ = s => document.querySelector(s);
  const fotosTemp = {};

  /* ---------- onde o diagnóstico foi registrado (31_validacao_diagnostico.sql) ---------- */
  const MOTIVOS_SEM_GPS = ['O celular não achou o sinal de GPS no quintal', 'O celular não tem GPS ou a localização está bloqueada',
    'A mulher não autorizou registrar a localização', 'Aplicado no papel: a localização não foi registrada na hora', 'Outro motivo'];
  const LONGE_KM = 40;   // mais longe que isso do centro do município da ficha: a coordenação confere
  const normMun = t => String(t || '').split('/')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  function centroMun(uf, mun) {
    const muns = ((MQ.GEO || {}).mun || {})[uf] || {}; const k = Object.keys(muns).find(m => normMun(m) === normMun(mun));
    return k ? { lat: +muns[k][1], lon: +muns[k][0], nome: k } : null;
  }
  function kmEntre(a, b) {
    const r = x => x * Math.PI / 180; const dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* o que a coordenação precisa saber sobre a localização de um diagnóstico */
  function localDiag(dg, f) {
    f = f || {}; const d = dg.dados || {};
    if (dg.latitude == null || dg.latitude === '') return { sem: true, alerta: !dg.sem_agua, motivo: dg.sem_gps_motivo || '' };
    const p = { lat: +dg.latitude, lon: +dg.longitude };
    const c = centroMun(dg.uf || f.uf, f.municipio); const km = c ? kmEntre(p, c) : null;
    const pf = f.latitude != null && f.latitude !== '' ? { lat: +f.latitude, lon: +f.longitude } : null;
    const noEstado = MQ.GEO && MQ.GEO.uf && MQ.GEO.uf[dg.uf || f.uf] ? dentroUF(p, MQ.GEO.uf[dg.uf || f.uf].r) : true;
    return { sem: false, p, centro: c, km, kmFicha: pf ? kmEntre(p, pf) : null, precisao: d.gps_precisao != null ? +d.gps_precisao : null,
      noEstado, alerta: (km != null && km > LONGE_KM) || !noEstado };
  }
  function dentroUF(p, aneis) {   // ponto dentro do contorno do estado (qualquer anel)
    return (aneis || []).some(anel => { let dentro = false;
      for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) { const [xi, yi] = anel[i], [xj, yj] = anel[j];
        if ((yi > p.lat) !== (yj > p.lat) && p.lon < (xj - xi) * (p.lat - yi) / (yj - yi) + xi) dentro = !dentro; }
      return dentro; });
  }
  const chipLocal = l => l.sem ? (l.alerta ? '<span class="chip crit">Sem localização</span>' : '') : !l.noEstado ? '<span class="chip crit">Fora do estado</span>'
    : l.alerta ? `<span class="chip crit">${Math.round(l.km)} km do município</span>` : '';
  /* mapinha do estado: centro do município da ficha (círculo) e onde o GPS foi registrado (ponto). Nada sai do sistema. */
  function mapaLocal(uf, l) {
    const g = MQ.GEO && MQ.GEO.uf && MQ.GEO.uf[uf]; if (!g || l.sem) return '';
    const pts = g.r.flat(); const lons = pts.map(x => x[0]), lats = pts.map(x => x[1]);
    const K = Math.cos((Math.max(...lats) + Math.min(...lats)) / 2 * Math.PI / 180);
    const xy = ([lon, lat]) => [lon * K, -lat];
    const bx = [Math.min(...lons) * K, -Math.max(...lats), (Math.max(...lons) - Math.min(...lons)) * K, Math.max(...lats) - Math.min(...lats)];
    const m = Math.max(bx[2], bx[3]) * 0.06; const vb = [bx[0] - m, bx[1] - m, bx[2] + 2 * m, bx[3] + 2 * m]; const e = Math.max(vb[2], vb[3]) / 100;
    const path = anel => 'M' + anel.map(q => xy(q).map(v => v.toFixed(3)).join(',')).join('L') + 'Z';
    const [gx, gy] = xy([l.p.lon, l.p.lat]); const c = l.centro && xy([l.centro.lon, l.centro.lat]);
    return `<svg class="mapa mapa-local" viewBox="${vb.join(' ')}" role="img" aria-label="Mapa de ${E(uf)}: ${c ? 'círculo no centro de ' + E(l.centro.nome) + ', ' : ''}ponto onde a localização foi registrada" preserveAspectRatio="xMidYMid meet">
      <path d="${g.r.map(path).join('')}" class="uf-proj" stroke-width="${e * 0.3}"></path>
      ${c ? `<line x1="${c[0]}" y1="${c[1]}" x2="${gx}" y2="${gy}" class="ml-linha" stroke-width="${e * 0.4}"></line><circle cx="${c[0]}" cy="${c[1]}" r="${e * 2.2}" class="ml-mun" stroke-width="${e * 0.6}"></circle>` : ''}
      <circle cx="${gx}" cy="${gy}" r="${e * 1.8}" class="ml-gps${l.alerta ? ' ml-alerta' : ''}"></circle></svg>`;
  }
  function blocoLocal(dg, f) {
    const l = localDiag(dg, f); const fmtKm = k => k < 1 ? Math.round(k * 1000) + ' m' : (k < 10 ? k.toFixed(1).replace('.', ',') : Math.round(k)) + ' km';
    if (l.sem) return `<div class="bloco bloco-local"><h3>Onde foi registrado</h3>
      <div class="aviso${l.alerta ? ' erro' : ''}"><b>Sem localização.</b> ${E(l.motivo || 'Sem explicação.')}${l.alerta ? '<br>Para aprovar, escreva na observação como você confirmou que a visita aconteceu (ligação para a mulher, foto com referência do lugar, relato da bolsista).' : ''}</div></div>`;
    const linhas = [
      ['Coordenadas', l.p.lat.toFixed(5) + ', ' + l.p.lon.toFixed(5) + (l.precisao != null ? ' (precisão de ' + Math.round(l.precisao) + ' m)' : '')],
      l.centro ? ['Distância do centro de ' + l.centro.nome, fmtKm(l.km)] : ['Município da ficha', 'não encontrado no mapa do projeto'],
      l.kmFicha != null ? ['Distância do ponto da ficha', fmtKm(l.kmFicha)] : null].filter(Boolean);
    return `<div class="bloco bloco-local"><h3>Onde foi registrado</h3>
      ${!l.noEstado ? `<div class="aviso erro"><b>A localização está fora de ${E(U().nomeUF(dg.uf))}.</b> Confira com quem aplicou antes de aprovar.</div>`
        : l.alerta ? `<div class="aviso erro"><b>Registrado a ${fmtKm(l.km)} do centro de ${E(l.centro.nome)}.</b> Municípios grandes podem ter comunidades longe do centro, mas confira antes de aprovar e diga na observação como conferiu.</div>` : ''}
      <div class="local-grade">${mapaLocal(dg.uf, l)}<dl class="dl">${linhas.map(([k, v]) => `<dt>${E(k)}</dt><dd>${E(v)}</dd>`).join('')}</dl></div>
      <p class="small muted">Círculo: centro do município da ficha. Ponto: onde o celular registrou a localização. O mapa é desenhado aqui mesmo, sem mandar a localização para outro site.</p></div>`;
  }
  let mesRoteiro = null;          // 'AAAA-MM'
  let ufRoteiro = '';
  const ROT_PASSO = 60; let limRot = ROT_PASSO;   // o roteiro desenha as primeiras linhas e o resto sob pedido: com o mês cheio a tela ficava lenta

  /* ---------- dados combinados: servidor + fila do aparelho ---------- */
  /* visitas() e diagnosticos() são chamadas várias vezes por quintal em cada tela: calcula UMA vez por mudança
     de dados (servidor ou fila do aparelho) e devolve uma cópia da lista (quem ordena não mexe na guardada) */
  const memo = {};
  const lembrar = (nome, fonte, calc) => { const f = S().fila; const c = memo[nome];
    if (!c || c.fonte !== fonte || c.fila !== f) memo[nome] = { fonte, fila: f, lista: calc() };
    return memo[nome].lista.slice(); };
  function visitas() { return lembrar('v', S().visitas, visitasCalc); }
  function diagnosticos() { return lembrar('d', S().diagnosticos, diagnosticosCalc); }
  function visitasCalc() {
    const m = new Map((S().visitas || []).map(v => [v.id, Object.assign({}, v)]));
    S().fila.filter(i => i.tipo === 'visita').forEach(i => m.set(i.id, Object.assign(MQ.juntarFila(m.get(i.id), i), { _fila: true, _erro: i.erro })));
    // diagnóstico ainda na fila marca a visita como feita (para quem está sem internet)
    S().fila.filter(i => i.tipo === 'diagnostico').forEach(i => { const v = m.get(i.dados.visita_id); if (v) { v.situacao = 'realizada'; v.data_realizada = i.dados.data_visita; } });
    return [...m.values()];
  }
  function diagnosticosCalc() {
    const m = new Map((S().diagnosticos || []).map(d => [d.id, Object.assign({}, d)]));
    S().fila.filter(i => i.tipo === 'diagnostico').forEach(i => m.set(i.id, Object.assign(MQ.juntarFila(m.get(i.id), i), { _fila: true, _erro: i.erro, situacao: (m.get(i.id) || {}).situacao || 'aguardando' })));
    return [...m.values()];
  }
  // índices refeitos só quando a lista muda (com 1.000 visitas, procurar uma a uma deixava a aba lenta)
  const memoIdx = new WeakMap();
  const indice = (arr, chave) => { let m = memoIdx.get(arr); if (!m) { m = {}; memoIdx.set(arr, m); }
    if (!m[chave]) { const x = new Map(); arr.forEach(o => { const k = o[chave]; if (!x.has(k)) x.set(k, []); x.get(k).push(o); }); m[chave] = x; } return m[chave]; };
  const ficha = id => (S().fichas || []).find(f => f.id === id);
  const pessoa = id => (S().equipe || []).find(p => p.id === id);
  const primeiroNome = n => String(n || '').split(' ')[0];
  const pessoasCampo = uf => (S().equipe || []).filter(p => p.status === 'ativa' && R.ehCampo(p.papel) && p.uf === uf)
    .sort((a, b) => (a.papel === 'agente') - (b.papel === 'agente') || a.nome.localeCompare(b.nome));
  const selecionadas = uf => (S().fichas || []).filter(f => f.uf === uf && f.resultado === 'selecionada' && f.situacao === 'aprovada')
    .sort((a, b) => a.municipio.localeCompare(b.municipio) || a.nome.localeCompare(b.nome));
  const ativasDe = (fid, etapa) => (visitas(), indice(memo.v.lista, 'ficha_id').get(fid) || []).filter(v => v.etapa === etapa && v.situacao !== 'cancelada')
    .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)));
  /* por que esta etapa ainda não pode ser registrada neste quintal (null = pode). A mesma regra vale no servidor. */
  const motivoEtapa = (v, op) => MQ.etapaMotivo(v.etapa, v.ficha_id, { visitas: visitas(), diagnosticos: diagnosticos() },
    Object.assign({ visitaId: v.id, veTudo: (S().eu || {}).papel !== 'agente' }, op || {}));
  const botaoFeita = v => { const m = motivoEtapa(v);
    return m ? `<span class="small muted" data-etapa-trava>${E(m)}</span>` : `<button class="btn peq pri" data-acao="campo-feita" data-id="${E(v.id)}">Registrar visita feita</button>`; };
  const diasUsados = uf => visitas().filter(v => v.uf === uf && v.situacao !== 'cancelada').length;
  const mesAtual = () => R.hoje().slice(0, 7);
  const nomeMes = m => { const [a, b] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+b - 1] + '/' + a; };
  const mesMais = (m, n) => { const [a, b] = m.split('-').map(Number); const d = new Date(a, b - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const codigoQuintal = f => f.uf + '-' + String(f.id).replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase();

  /* etapa de cada quintal, em forma de "pílulas" */
  function pilulas(f) {
    const dg = (diagnosticos(), indice(memo.d.lista, 'ficha_id').get(f.id) || [])[0];
    const p = (rot, vs, extra) => {
      const v = vs[0];
      if (!v) return `<span class="pil">${rot}</span>`;
      if (v.situacao === 'realizada') return `<span class="pil feito" title="Feita em ${R.fmtData(v.data_realizada)}">${rot} ✓</span>`;
      return `<span class="pil prev" title="Prevista para ${R.fmtData(v.data_prevista)} com ${E((pessoa(v.executor_id) || {}).nome || '')}">${rot} ${R.fmtData(v.data_prevista).slice(0, 5)}</span>`;
    };
    const ac = ativasDe(f.id, 'acompanhamento');
    return `<span class="pils">${p('Diagnóstico', ativasDe(f.id, 'diagnostico'))}
      ${dg ? `<span class="pil ${dg.sem_agua ? 'crit' : dg.situacao === 'aprovado' ? 'feito' : dg.situacao === 'devolvido' ? 'crit' : 'prev'}">${dg.sem_agua ? 'Sem água' : 'Plano ' + (dg.situacao === 'aprovado' ? 'aprovado' : dg.situacao === 'devolvido' ? 'devolvido' : 'em análise')}</span>` : ''}
      ${p('Implantação', ativasDe(f.id, 'implantacao'))}${p('Acomp. 1', ac.slice(0, 1))}${p('Acomp. 2', ac.slice(1, 2))}${p('Avaliação', ativasDe(f.id, 'avaliacao'))}</span>`;
  }

  /* ---------- roteiro do mês (é o pedido de ajuda de custo) ---------- */
  function roteiro(uf, podeMudar) {
    const m = mesRoteiro || mesAtual();
    const vs = visitas().filter(v => (!uf || v.uf === uf) && v.situacao !== 'cancelada' && String(v.situacao === 'realizada' ? v.data_realizada : v.data_prevista).slice(0, 7) === m)
      .sort((a, b) => String(a.data_realizada || a.data_prevista).localeCompare(String(b.data_realizada || b.data_prevista)));
    const porPessoa = {};
    vs.forEach(v => { const k = v.executor_id; porPessoa[k] = porPessoa[k] || { prev: 0, feitas: 0 }; porPessoa[k][v.situacao === 'realizada' ? 'feitas' : 'prev']++; });
    const mostra = vs.slice(0, limRot); const dgFichas = new Set(diagnosticos().map(d => d.ficha_id)); const hoje = R.hoje();
    return `<div class="bloco roteiro">
      <div class="secao-cab"><h3>Roteiro de campo · ${nomeMes(m)}</h3>
        <span class="seg"><button type="button" data-acao="campo-mes" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" data-acao="campo-mes" data-n="0">Este mês</button><button type="button" data-acao="campo-mes" data-n="1" aria-label="Próximo mês">›</button></span></div>
      <p class="small muted">Cada visita a um quintal é 1 dia de campo de quem visita, e é a base da ajuda de custo. O roteiro do mês seguinte fica fechado até o dia 20.</p>
      ${vs.length ? `<div class="quadro-scroll" style="display:block"><table class="quadro tab-rot"><thead><tr><th>Data</th>${uf ? '' : '<th>UF</th>'}<th>Mulher</th><th>Etapa</th><th>Quem visita</th><th>Situação</th><th>O que fazer</th></tr></thead><tbody>
        ${mostra.map(v => { const f = ficha(v.ficha_id) || {}; const q = pessoa(v.executor_id) || {};
          const feita = v.situacao === 'realizada'; const temDg = dgFichas.has(v.ficha_id);
          const b = (acao, txt, pri, extra) => `<button class="btn peq${pri ? ' pri' : ''}" data-acao="${acao}" data-ficha="${E(v.ficha_id)}" data-visita="${E(v.id)}" data-id="${E(v.id)}"${extra || ''}>${txt}</button>`;
          const acoes = v._fila ? '<span class="small muted">Aguardando internet</span>'
            : v.etapa === 'avaliacao' ? (feita ? b('aval-ver', 'Ver avaliação') : podeMudar ? b('aval-novo', 'Registrar avaliação', true) : '')
            : v.etapa === 'diagnostico' ? (temDg ? b('campo-diag-ver', 'Ver diagnóstico') : podeMudar ? b('campo-diag-novo', 'Registrar diagnóstico', true) : '')
            : feita ? (v.relato ? `<span class="small muted" title="${E(v.relato)}">${E(String(v.relato).slice(0, 60))}${String(v.relato).length > 60 ? '…' : ''}</span>` : '')
            : podeMudar ? botaoFeita(v) : '';
          return `<tr class="rt-s-${feita ? 'ok' : v._fila ? 'pend' : v.data_prevista < hoje ? 'crit' : 'pend'}"><td class="num rt-data">${R.fmtData(v.data_realizada || v.data_prevista)}</td>${uf ? '' : `<td class="rt-uf">${E(v.uf)}</td>`}<td class="rt-mulher">${E(f.nome || '—')}<br><span class="small muted">${E(f.municipio || '')}${uf ? '' : `<span class="rt-ufm"> · ${E(v.uf)}</span>`}</span></td>
            <td class="rt-etapa">${E(MQ.ETAPAS[v.etapa].nome)}</td><td class="rt-quem">${E(q.nome || '—')}<br><span class="small muted">${E((MQ.PAPEIS[q.papel] || {}).curto || '')}</span></td>
            <td class="rt-sit">${feita ? '<span class="chip ok">Feita</span>' : v._fila ? '<span class="chip pend">No aparelho</span>' : v.data_prevista < hoje ? '<span class="chip crit">Atrasada</span>' : '<span class="chip pend">Prevista</span>'}</td>
            <td class="rt-acao"><div class="rot-acoes">${acoes}${podeMudar && v.situacao === 'prevista' && !v._fila ? `<button class="link small" data-acao="campo-visita-editar" data-id="${E(v.id)}">Mudar data ou pessoa</button>` : ''}</div></td></tr>`; }).join('')}
        </tbody></table></div>
        ${vs.length > mostra.length ? `<p class="mais-linhas"><button type="button" class="btn peq" data-acao="campo-rot-mais">Mostrar mais ${Math.min(ROT_PASSO, vs.length - mostra.length)}</button><button type="button" class="link small" data-acao="campo-rot-todas">Mostrar todas</button><span class="small muted">Mostrando ${mostra.length} de ${vs.length} visitas do mês</span></p>` : ''}
        <div class="dias-pessoa">${Object.entries(porPessoa).map(([id, c]) => `<span><b>${E(primeiroNome((pessoa(id) || {}).nome))}</b> ${c.feitas + c.prev} dia${c.feitas + c.prev > 1 ? 's' : ''} <span class="muted">(${c.feitas} feita${c.feitas === 1 ? '' : 's'})</span></span>`).join('')}</div>`
        : '<p class="muted">Nenhuma visita neste mês.</p>'}
    </div>`;
  }

  /* ---------- tela da bolsista: trabalho de campo do estado ---------- */
  const semBanco = () => `<section class="secao"><div class="secao-cab"><h2>Trabalho de campo</h2></div><div class="aviso"><b>Ainda não instalado no servidor.</b> A coordenação geral precisa rodar o arquivo 03_campo.sql no Supabase. Até lá, use os modelos em papel.</div></section>`;
  /* o que precisa de ação agora: atrasadas, próximos 7 dias, planos devolvidos e quintais sem diagnóstico agendado */
  function paraFazer(uf, sel) {
    const hoje = R.hoje(); const em7 = R.somaDias(hoje, 7);
    const itens = [];
    diagnosticos().filter(d => d.uf === uf && d.situacao === 'devolvido').forEach(d => { const f = ficha(d.ficha_id) || {};
      itens.push({ o: 0, t: `<b>${E(f.nome || '—')}</b> · plano devolvido pela coordenação`, sub: E(d.obs_coordenacao || ''), b: `<button class="btn peq pri" data-acao="campo-diag-ver" data-ficha="${E(d.ficha_id)}">Corrigir</button>` }); });
    visitas().filter(v => v.uf === uf && v.situacao === 'prevista' && v.data_prevista <= em7).sort((a, b) => a.data_prevista.localeCompare(b.data_prevista)).forEach(v => {
      const f = ficha(v.ficha_id) || {}; const atras = v.data_prevista < hoje;
      const acao = v.etapa === 'diagnostico' ? `<button class="btn peq pri" data-acao="campo-diag-novo" data-ficha="${E(v.ficha_id)}" data-visita="${E(v.id)}">Registrar diagnóstico</button>`
        : v.etapa === 'avaliacao' ? `<button class="btn peq pri" data-acao="aval-novo" data-ficha="${E(v.ficha_id)}" data-visita="${E(v.id)}">Registrar avaliação</button>`
        : botaoFeita(v);
      itens.push({ o: atras ? 1 : 2, t: `<b>${E(f.nome || '—')}</b> · ${E(MQ.ETAPAS[v.etapa].nome)} ${atras ? `<span class="chip crit">atrasada desde ${R.fmtData(v.data_prevista)}</span>` : 'em ' + R.fmtData(v.data_prevista)}`,
        sub: E(((pessoa(v.executor_id) || {}).nome || '')), b: acao }); });
    const semAgenda = sel.filter(f => !diagnosticos().some(d => d.ficha_id === f.id) && !ativasDe(f.id, 'diagnostico').length);
    if (semAgenda.length) itens.push({ o: 3, t: `<b>${semAgenda.length} quintal${semAgenda.length > 1 ? 'is' : ''} sem diagnóstico agendado</b>`, sub: semAgenda.slice(0, 3).map(f => E(f.nome)).join(', ') + (semAgenda.length > 3 ? '…' : ''), b: '<button class="btn peq pri" data-acao="campo-visita-nova">Agendar</button>' });
    itens.sort((a, b) => a.o - b.o);
    const mostra = itens.slice(0, 8);
    return `<div class="bloco"><h3>Para fazer agora${itens.length ? ` (${itens.length})` : ''}</h3>
      ${mostra.length ? `<ul class="fazer">${mostra.map(i => `<li><div>${i.t}${i.sub ? `<br><span class="small muted">${i.sub}</span>` : ''}</div>${i.b}</li>`).join('')}</ul>
        ${itens.length > mostra.length ? `<p class="small muted">E mais ${itens.length - mostra.length}. Veja tudo no roteiro abaixo.</p>` : ''}` : '<p class="muted">Nada pendente para os próximos 7 dias.</p>'}</div>`;
  }

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
      ${avisoConflitos()}
      ${pend.length ? `<div class="aviso${pend.some(i => i.erro) ? ' erro' : ''}"><b>${pend.length} registro${pend.length > 1 ? 's' : ''} de campo neste aparelho</b>${pend.some(i => i.erro) ? ': ' + E(pend.find(i => i.erro).erro) : ', aguardando internet para enviar.'}
        ${navigator.onLine ? ' <button class="link" data-acao="ficha-enviar">Enviar agora</button>' : ''}</div>` : ''}
      ${sel.length ? paraFazer(uf, sel) : '<div class="vazio"><span>As visitas começam quando a coordenação técnica aprovar as primeiras fichas como "selecionada".</span></div>'}
      ${U().dobra('campo-roteiro', '<span><b>Roteiro do mês</b> <span class="small muted">· todas as visitas e o que falta registrar</span></span>', roteiro(uf, true))}
      ${sel.length ? U().dobra('campo-quintais', `<span><b>Ver os ${sel.length} quintais</b> <span class="small muted">· etapa de cada um</span></span>`,
        `${sel.length > 6 ? '<div class="campo"><label for="q-busca">Procurar pelo nome</label><input id="q-busca" data-procura="lista-quintais" autocomplete="off"></div>' : ''}
        <div class="lista-fichas" id="lista-quintais">${sel.map(f => {
          const temDiag = diagnosticos().some(d => d.ficha_id === f.id);
          return `<div class="quintal"><div><b>${E(f.nome)}</b><br><span class="small muted">${E(f.municipio)} · ${E(f.comunidade)} · ${codigoQuintal(f)}</span></div>
            ${pilulas(f)}
            <div class="acoes">${temDiag ? `<button class="btn peq" data-acao="campo-diag-ver" data-ficha="${E(f.id)}">Ver diagnóstico</button>${MQ.vendaUI ? MQ.vendaUI.botaoOrientar(f.id) : ''}`
              : `<button class="btn peq pri" data-acao="campo-diag-novo" data-ficha="${E(f.id)}">Registrar diagnóstico</button>`}</div></div>`; }).join('')}</div>`) : ''}
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
          : v.etapa === 'avaliacao' ? (v.situacao === 'realizada' ? `<button class="btn peq" data-acao="aval-ver" data-ficha="${E(v.ficha_id)}">Ver avaliação</button>`
            : `<button class="btn peq pri" data-acao="aval-novo" data-ficha="${E(v.ficha_id)}" data-visita="${E(v.id)}">Registrar avaliação</button>`)
          : v.situacao === 'realizada' ? `<span class="small muted">${E(String(v.relato || '').slice(0, 90))}${String(v.relato || '').length > 90 ? '…' : ''}</span>${MQ.vendaUI ? MQ.vendaUI.botaoOrientar(v.ficha_id) : ''}`
          : botaoFeita(v)}</div></div>`; };
    const porMes = {}; feitas.forEach(v => { const m = String(v.data_realizada).slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; });
    const pend = S().fila.filter(i => i.tipo === 'diagnostico');
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">Agente de campo · ${E(U().nomeUF(eu.uf))}</span><h1>Olá, ${E(primeiroNome(eu.nome))}</h1>
        <p>${E(MQ.PAPEIS.agente.faz)}</p></div><span class="chip chip-lg ${s.cod}">${E(s.rot)}</span></div>
      ${MQ.atalhos ? MQ.atalhos([['Minhas próximas visitas', '#t-prox', true, contaAFazer()], ['Visitas feitas', '#t-feitas'], ['Pedir ajuda de custo', '#t-pag', false, MQ.pagUI ? MQ.pagUI.contaDevolvidas() : 0]]) : ''}
      ${MQ.entregasUI ? MQ.entregasUI.blocoCiencia() : ''}
      ${MQ.encUI ? MQ.encUI.blocoConfirmar() : ''}
      ${!R.habilitado(eu) ? `<div class="aviso erro"><b>Você ainda não pode receber visitas no roteiro.</b> Faltam passos da habilitação (matrícula no FIC, documentos na FUNCERN e termo). Sem eles, a ajuda de custo não pode ser paga.</div>` : ''}
      ${avisoConflitos()}
      ${pend.length ? `<div class="aviso">${pend.length} diagnóstico${pend.length > 1 ? 's' : ''} guardado${pend.length > 1 ? 's' : ''} neste aparelho, aguardando internet.${navigator.onLine ? ' <button class="link" data-acao="ficha-enviar">Enviar agora</button>' : ''}</div>` : ''}
      <section class="secao"><div class="secao-cab"><h2 id="t-prox">Próximas visitas</h2><span class="muted small">${prox.length} prevista${prox.length === 1 ? '' : 's'}</span></div>
        ${prox.length ? `<div class="lista-fichas">${prox.map(linha).join('')}</div>` : '<div class="vazio"><span>Nenhuma visita atribuída a você. Quem agenda é a bolsista do estado ou a coordenação técnica.</span></div>'}</section>
      <section class="secao"><div class="secao-cab"><h2 id="t-feitas">Visitas feitas</h2><span class="small">${Object.entries(porMes).map(([m, n]) => `<b>${nomeMes(m)}</b>: ${n} dia${n > 1 ? 's' : ''} de campo`).join(' · ') || ''}</span></div>
        ${feitas.length ? `<div class="lista-fichas">${feitas.map(linha).join('')}</div>` : '<p class="muted">Nenhuma ainda.</p>'}</section>
      ${MQ.pagUI ? MQ.pagUI.secaoMinha() : ''}
      <p class="nota">Você vê apenas as mulheres das visitas atribuídas a você. Os dados delas são protegidos pela LGPD: não fotografe telas nem repasse informações.</p>
    </main>`;
  }

  /* ---------- aba "Campo" da coordenação ---------- */
  function abaCoord() {
    if (S().campoSemBanco) return semBanco();
    const souTec = R.decideCampo(S().eu.papel);
    const dgs = diagnosticos();
    const aguard = dgs.filter(d => d.situacao === 'aguardando').sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
    const linhaUF = u => { const vs = visitas().filter(v => v.uf === u.uf && v.situacao !== 'cancelada');
      const feitas = vs.filter(v => v.situacao === 'realizada').length; const d = dgs.filter(x => x.uf === u.uf);
      const pct = Math.min(100, vs.length / MQ.DIAS_CAMPO_UF * 100), pctF = Math.min(100, feitas / MQ.DIAS_CAMPO_UF * 100);
      return `<tr><td class="uf"><span class="sigla">${u.uf}</span><span class="nomeuf">${u.nome}</span></td>
        <td class="cu-dias" data-rot="Dias de campo"><div class="dias-cel"><span class="num"><b>${feitas}</b> feitos <span class="muted">de ${MQ.DIAS_CAMPO_UF}</span></span>
          <span class="medidor"><i style="width:${pct}%;opacity:.35"></i><i style="width:${pctF}%"></i></span><span class="small muted">${vs.length - feitas} previsto${vs.length - feitas === 1 ? '' : 's'} no roteiro</span></div></td>
        <td class="num c" data-rot="Diagnósticos">${d.length} <span class="muted">de 40</span></td><td class="num c" data-rot="Planos aprovados">${d.filter(x => x.situacao === 'aprovado').length}</td><td class="num c" data-rot="Sem água na seca">${(n => n ? `<b style="color:var(--crit)">${n}</b>` : 0)(d.filter(x => x.sem_agua).length)}</td>
        <td class="num c" data-rot="Agentes de campo">${pessoasCampo(u.uf).filter(p => p.papel === 'agente').length}</td></tr>`; };
    return `<div class="cab"><div><span class="eyebrow">Trabalho de campo</span><h1>Visitas, diagnósticos e planos</h1>
        <p>${souTec ? 'Você aprova ou devolve o plano de cada quintal antes da compra do kit.' : 'A aprovação dos planos é da coordenação técnica.'} Dias de campo: ${MQ.DIAS_CAMPO_UF} por estado (40 quintais × 5 visitas: diagnóstico, implantação, 2 acompanhamentos e avaliação final).</p></div></div>
      <div class="quadro-scroll" style="display:block"><table class="quadro tab-campo-uf"><thead><tr><th>Estado</th><th>Dias de campo</th><th class="c">Diagnósticos</th><th class="c">Planos aprovados</th><th class="c">Sem água na seca</th><th class="c">Agentes de campo</th></tr></thead>
        <tbody>${MQ.UFS.map(linhaUF).join('')}</tbody></table></div>
      <p class="small muted" style="margin:6px 2px 0"><b>Sem água na seca:</b> diagnósticos em que a água não dura no período seco. Essa mulher não recebe o kit (é encaminhada a programa de cisternas) e a vaga dela precisa ser preenchida pela lista de espera. Acima de 30% no estado é sinal de alerta.</p><p class="dica-cols">No celular aparecem só as colunas principais. A tabela completa aparece no computador ou com o celular deitado.</p>
      ${blocoKitPar()}
      ${MQ.impactoUI ? MQ.impactoUI.secaoCoord() : ''}
      ${aguard.length ? `<div class="bloco${MQ.sit(souTec ? 1 : 0)}"><h3>${souTec ? 'Planos para você aprovar' : 'Planos aguardando a coordenação técnica'} (${aguard.length})</h3><div class="lista-fichas">
        ${aguard.map(d => { const f = ficha(d.ficha_id) || {}; return `<button class="vagabtn ficha-linha" data-acao="campo-diag-ver" data-ficha="${E(d.ficha_id)}"><span class="nm">${E(f.nome || '—')}</span>
          <span style="display:flex;gap:6px;flex-wrap:wrap">${chipLocal(localDiag(d, f))}${d.sem_agua ? '<span class="chip crit">Sem água: sem plano</span>' : `<span class="chip pend">Lote ${d.lote}</span>`}<span class="chip off">${E((d.dados && d.dados.kit || []).filter(k => k.item).length)} itens no kit${totalKit(d.dados && d.dados.kit) ? ' · ' + brl(totalKit(d.dados && d.dados.kit)) : ''}</span></span>
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
          <div class="campo"><label for="vi-d">Data prevista</label><input id="vi-d" name="data_prevista" type="date" value="${E(v.data_prevista || '')}" min="${R.hoje()}" max="${R.LIM.visitaMax}"></div>
          <div class="campo inteiro"><label for="vi-p">Quem faz a visita</label><select id="vi-p" name="executor_id"><option value="">Escolha…</option>${opP}</select>
            <span class="dica">Só aparece quem está habilitada (FIC, FUNCERN e termo). Sem isso, o dia de campo não pode ser pago.</span></div>
          <div class="campo inteiro"><label for="vi-o">Observação</label><input id="vi-o" name="obs" value="${E(v.obs || '')}" maxlength="300"></div>
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
    <input name="fam_nome" placeholder="Nome" value="${E(x.nome || '')}" aria-label="Nome" maxlength="120"><input name="fam_idade" type="number" min="0" max="120" inputmode="numeric" placeholder="Idade" value="${E(x.idade ?? '')}" aria-label="Idade">
    <select name="fam_par" aria-label="Parentesco">${MQ.DIAG.parentesco.map(p => `<option ${x.parentesco === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
    <input name="fam_ocup" placeholder="Estuda / trabalha?" value="${E(x.ocupacao || '')}" aria-label="Estuda ou trabalha" maxlength="120">
    <label class="mini-chk"><input type="checkbox" name="fam_ajuda" ${x.ajuda ? 'checked' : ''}>Ajuda no quintal</label>
    <button type="button" class="fechar" data-acao="campo-linha-rem" aria-label="Remover">×</button></div>`;
  const linhaKit = (x = {}) => `<div class="linha-din kit kit5" data-linha="kit">
    <input name="kit_item" placeholder="Item (da lista aprovada)" value="${E(x.item || '')}" aria-label="Item" maxlength="120"><input name="kit_qtd" placeholder="Qtd." inputmode="decimal" value="${E(x.qtd_txt || x.qtd || '')}" aria-label="Quantidade" maxlength="40">
    <input name="kit_valor" placeholder="R$ unid." inputmode="decimal" value="${E(x.valor != null ? String(x.valor).replace('.', ',') : '')}" aria-label="Valor estimado de cada unidade (R$)" maxlength="20">
    <input name="kit_para" placeholder="Para quê" value="${E(x.para || '')}" aria-label="Para quê" maxlength="200"><button type="button" class="fechar" data-acao="campo-linha-rem" aria-label="Remover">×</button></div>`;
  /* coordenação: valor do kit por quintal e o total projetado pelos planos */
  function blocoKitPar() {
    const lim = +((S().kitPar || {}).valor_quintal) || 0;
    const planos = diagnosticos().filter(d => !d.sem_agua && d.situacao !== 'devolvido');
    const tots = planos.map(d => totalKit(d.dados && d.dados.kit)).filter(v => v > 0);
    const soma = tots.reduce((a, b) => a + b, 0); const acima = lim ? tots.filter(v => v > lim).length : 0;
    return `<div class="bloco kit-par"><div><h3>Investimento nos quintais (kits)</h3>
        <p class="kit-valor"><span class="small muted">Valor do kit por quintal</span><b class="num">${brl(lim)}</b><span class="small muted">definido no plano de trabalho · ${brl(lim * 200)} para os 200 quintais</span></p>
        <p class="small muted">${tots.length ? `${tots.length} plano${tots.length > 1 ? 's' : ''} com valores: <b>${brl(soma)}</b> projetados · média ${brl(soma / tots.length)} por quintal${acima ? ` · <b style="color:var(--crit)">${acima} acima do valor por quintal</b>` : ''}.` : 'Nenhum plano com valores ainda.'}
        Quem faz o diagnóstico vê a projeção do kit e o quanto falta ou passa deste valor.</p></div></div>`;
  }
  /* projeção do investimento no quintal: soma de quantidade × valor estimado de cada item */
  const numBR = t => R.numBR(t);   // 1.250,50 → 1250.5 · 1.250 → 1250 · 12.50 → 12.5
  const totalKit = kit => R.totalKit(kit);   // item com quantidade ou valor negativo não abate o total (regras.js)
  const FMT_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });   // criado uma vez: toLocaleString monta um novo a cada chamada
  const brl = v => FMT_BRL.format(+v || 0);
  function projKit(kit) {
    const tot = totalKit(kit); const lim = +((S().kitPar || {}).valor_quintal) || 0;
    const semValor = (kit || []).filter(x => x.item && (x.valor == null || !(+x.valor > 0))).length;
    const semQtd = (kit || []).filter(x => x.item && +x.valor > 0 && !(numBR(x.qtd) > 0));   // o banco recusa item com valor e sem quantidade: avisa já
    const pct = lim ? Math.min(100, Math.round(tot / lim * 100)) : 0;
    return `<div class="kit-proj ${lim && tot > lim ? 'passou' : ''}"><div class="kp-l"><span class="small muted">Projeção do investimento no quintal</span><b class="num">${brl(tot)}</b></div>
      ${lim ? `<span class="bar" role="img" aria-label="${pct}% do valor por quintal"><i class="${tot > lim ? 'cheio' : ''}" style="width:${pct}%"></i></span>
        <span class="small">${tot > lim ? `<b>Passa ${brl(tot - lim)}</b> do valor por quintal (${brl(lim)}). Tire ou troque itens.` : `Valor por quintal: ${brl(lim)} · sobram ${brl(lim - tot)}`}</span>`
        : '<span class="small muted">A coordenação ainda não definiu o valor por quintal (aba Campo).</span>'}
      ${semValor ? `<span class="small">${semValor === 1 ? '1 item sem valor' : semValor + ' itens sem valor'}: informe o preço estimado de cada unidade.</span>` : ''}
      ${semQtd.length ? `<span class="small kit-sem-qtd">Informe a quantidade de ${E(semQtd.slice(0, 3).map(x => x.item).join(', '))}${semQtd.length > 3 ? ' e de mais ' + (semQtd.length - 3) : ''} (um número maior que zero).</span>` : ''}</div>`;
  }
  const linhaCron = (x = {}) => `<div class="linha-din kit" data-linha="cron">
    <input name="cr_oque" placeholder="O que fazer" value="${E(x.oque || '')}" aria-label="O que fazer" maxlength="200"><input name="cr_ini" placeholder="Mês início" value="${E(x.inicio || '')}" aria-label="Mês de início" maxlength="40">
    <input name="cr_fim" placeholder="Mês fim" value="${E(x.fim || '')}" aria-label="Mês de fim" maxlength="40"><input name="cr_quem" placeholder="Quem faz" value="${E(x.quem || '')}" aria-label="Quem faz" maxlength="120">
    <button type="button" class="fechar" data-acao="campo-linha-rem" aria-label="Remover">×</button></div>`;

  function painelDiag(p) {
    const f = ficha(p.ficha); if (!f) return '<div class="painel-corpo"><p>Ficha não encontrada.</p></div>';
    const atual = diagnosticos().find(d => d.ficha_id === f.id);
    const d = atual ? Object.assign({}, atual, atual.dados || {}) : { id: MQ.novoId(), ficha_id: f.id, visita_id: p.visita || '', data_visita: R.hoje(),
      latitude: null, longitude: null, familia: [{ nome: primeiroNome(f.nome), parentesco: 'Ela mesma', ajuda: true }], kit: [{}, {}, {}], cronograma: [{}, {}] };
    const v = k => E(d[k] == null ? '' : d[k]);
    const prod = d.producao || {};
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${atual ? 'Corrigir diagnóstico' : '1ª visita'} · ${E(f.uf)} · ${codigoQuintal(f)}</span>
        <h2 id="painel-t">Diagnóstico e plano do quintal</h2><span class="small">${E(f.nome)} · ${E(f.municipio)} · ${E(f.comunidade)}</span>
        ${atual && atual.situacao === 'devolvido' && atual.obs_coordenacao ? `<div class="aviso erro" style="margin-top:6px"><b>Devolvido pela coordenação técnica:</b> ${E(atual.obs_coordenacao)}</div>` : ''}</div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="diag" data-id="${E(d.id)}" data-ficha="${E(f.id)}" data-visita="${E(d.visita_id || '')}" novalidate>
        ${!f.consent_imagem ? '<div class="aviso"><b>Ela não autorizou uso de imagem:</b> fotografe o quintal sem que ela apareça.</div>' : ''}
        <fieldset><legend>Visita</legend><div class="campos">
          <div class="campo"><label for="dg-data">Data da visita</label><input id="dg-data" name="data_visita" type="date" value="${v('data_visita')}" min="${R.LIM.visitaMin}" max="${R.hoje()}"></div>
          <div class="campo"><label>Localização do quintal</label><button type="button" class="btn peq" data-acao="campo-gps">${d.latitude ? 'Localização registrada ✓' : 'Registrar localização'}</button>
            <input type="hidden" name="latitude" value="${v('latitude')}"><input type="hidden" name="longitude" value="${v('longitude')}">
            <input type="hidden" name="gps_precisao" value="${v('gps_precisao')}"><input type="hidden" name="gps_em" value="${v('gps_em')}">
            <span class="dica" id="dg-gps-dica">${d.latitude ? E(d.latitude + ', ' + d.longitude) : 'Registre em pé, no quintal, durante a visita.'}</span></div>
          ${(() => { const mt = String(d.sem_gps_motivo || ''); const tipo = MOTIVOS_SEM_GPS.find(x => mt.startsWith(x + '. ')) || ''; const det = tipo ? mt.slice(tipo.length + 2) : mt;
            return `<div class="campo inteiro sem-gps" id="w-sem_gps_motivo"><label for="dg-semgps-tipo">Sem localização? Por quê</label>
              <select id="dg-semgps-tipo" name="sem_gps_tipo"><option value="">Escolha, se não conseguiu registrar…</option>${MOTIVOS_SEM_GPS.map(x => `<option${x === tipo ? ' selected' : ''}>${E(x)}</option>`).join('')}</select>
              <label for="dg-semgps" class="so-leitor">Explique com suas palavras</label>
              <input id="dg-semgps" name="sem_gps_detalhe" value="${E(det)}" maxlength="500" placeholder="Explique com suas palavras: onde fica o quintal e o que aconteceu">
              <span class="dica">Sem localização, a coordenação só aprova depois de confirmar a visita de outro jeito.</span></div>`; })()}
        </div></fieldset>

        <fieldset><legend>1. Família</legend><div id="w-familia" class="linhas">${(d.familia || []).map(linhaFamilia).join('')}</div>
          <button type="button" class="btn-add" data-acao="campo-linha-add" data-tipo="familia"><span aria-hidden="true">+</span> Pessoa</button></fieldset>

        <fieldset><legend>2. Renda e políticas públicas</legend>
          ${chk('politicas', MQ.DIAG.politicas, d.politicas)}
          <div class="campos">
            <div class="campo"><label for="dg-rf">Renda da família por mês (R$)</label><input id="dg-rf" name="renda_familiar" type="number" min="0" max="${R.LIM.rendaMax}" step="10" inputmode="numeric" value="${v('renda_familiar')}"></div>
            <div class="campo"><label for="dg-fr">De onde vem a maior parte</label><input id="dg-fr" name="fonte_renda" value="${v('fonte_renda')}" maxlength="200"></div>
          </div></fieldset>

        <fieldset><legend>3. O quintal e a água</legend><div class="campos">
          <div class="campo"><label for="dg-area">Área aproximada (m²)</label><input id="dg-area" name="area_m2" type="number" min="1" max="${R.LIM.areaMax}" inputmode="numeric" value="${v('area_m2')}"></div>
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
          <div class="campo inteiro"><label for="dg-chuva">Meses em que costuma chover</label><input id="dg-chuva" name="meses_chuva" value="${v('meses_chuva')}" maxlength="120" placeholder="Ex.: janeiro a abril"></div>
        </div><div id="dg-alerta-agua"></div></fieldset>

        <fieldset><legend>4. O que produz hoje</legend>
          <div class="prod">${MQ.DIAG.producao.map(([k, t]) => { const x = prod[k] || {};
            return `<div class="prod-l"><b>${E(t)}</b><input name="pr_${k}_qtd" placeholder="Quantidade (pés, canteiros, cabeças)" value="${E(x.qtd || '')}" aria-label="${E(t)}: quantidade" maxlength="120">
              <span class="prod-usos"><label class="mini-chk"><input type="checkbox" name="pr_${k}_consumo" ${x.consumo ? 'checked' : ''}>Consumo</label><label class="mini-chk"><input type="checkbox" name="pr_${k}_venda" ${x.venda ? 'checked' : ''}>Venda/troca</label></span>
              <input name="pr_${k}_onde" placeholder="Onde vende" value="${E(x.onde || '')}" aria-label="${E(t)}: onde vende" maxlength="120"></div>`; }).join('')}</div>
          <div class="campo"><label for="dg-rq">Quanto ganha com vendas do quintal por mês (R$)</label><input id="dg-rq" name="renda_quintal" type="number" min="0" max="${R.LIM.rendaMax}" step="10" inputmode="numeric" value="${v('renda_quintal')}"><span class="dica">Zero se não vende. É a linha de base: a visita final vai perguntar a mesma coisa.</span></div>
        </fieldset>

        ${MQ.impactoUI ? MQ.impactoUI.bloco(d.impacto, '4b. Medidas para comparar no fim (linha de base)', MQ.impactoUI.menorDaFamilia(d.familia)) : ''}

        <fieldset><legend>5 e 6. Práticas, trabalho e organização</legend>
          ${chk('praticas', MQ.DIAG.praticas, d.praticas)}
          <div class="campos"><div class="campo"><label for="dg-horas">Horas por dia no quintal</label><input id="dg-horas" name="horas_dia" type="number" min="0" max="16" step="0.5" inputmode="decimal" value="${v('horas_dia')}"></div></div>
          <label class="small muted">Participa de</label>${chk('participa', MQ.DIAG.participa, d.participa)}
        </fieldset>

        <fieldset><legend>7. Problemas e sonhos</legend><div class="campos">
          <div class="campo inteiro"><label for="dg-dif">Maiores dificuldades do quintal</label><textarea id="dg-dif" name="dificuldades" maxlength="2000">${v('dificuldades')}</textarea></div>
          <div class="campo inteiro"><label for="dg-son">O que ela quer produzir ou melhorar</label><textarea id="dg-son" name="sonhos" maxlength="2000">${v('sonhos')}</textarea></div>
        </div></fieldset>

        <fieldset id="w-fotos"><legend>8. Fotos e croqui</legend>
          <div class="campos">${MQ.DIAG.fotos.filter(([k]) => k !== 'mulher' || f.consent_imagem).map(([k, t]) => { const tem = (d.fotos || []).some(x => new RegExp('diag_' + k).test(x)) || (atual && atual.exemplo && k !== 'mulher');
            const opc = k === 'croqui' || k === 'mulher';
            return `<div class="campo ${opc ? 'inteiro' : ''}"><label for="dg-f-${k}">${E(t)}${opc ? '' : ' *'}</label><input id="dg-f-${k}" name="foto_${k}" data-foto="${k}" type="file" accept="image/*" capture="environment">
              <span class="dica" id="dg-f-${k}-dica">${tem ? 'Já tem foto. Envie outra só para trocar.' : k === 'croqui' ? 'Desenhe no papel e fotografe.' : k === 'mulher' ? 'Só se ela quiser. Foto do rosto, de frente, com o celular em pé e o quintal ao fundo. Pode ir para o mosaico da página pública, sem o nome dela.' : 'Obrigatória.'}</span></div>`; }).join('')}</div>
        </fieldset>

        <div data-parteb>
        <fieldset><legend>9. Plano do quintal: objetivo</legend>
          <div id="w-objetivos">${chk('objetivos', MQ.DIAG.objetivos, d.objetivos)}</div>
          <div class="campo"><label for="dg-frase">Em uma frase, o que ela quer alcançar em 12 meses</label><input id="dg-frase" name="frase_objetivo" value="${v('frase_objetivo')}" maxlength="300"></div>
        </fieldset>
        <fieldset><legend>10. Kit escolhido</legend>
          <p class="small muted" style="margin-top:-6px">Só itens da lista aprovada pela coordenação, sem passar do valor por quintal. Sem irrigação, comece pelos itens de água (caixa d’água, gotejamento) e pela cobertura do solo.</p>
          <div class="kit-cab" aria-hidden="true"><span>Item</span><span>Qtd.</span><span>R$ unid.</span><span>Para quê</span></div>
          <div id="w-kit" class="linhas">${(d.kit && d.kit.length ? d.kit : [{}]).map(linhaKit).join('')}</div>
          <button type="button" class="btn-add" data-acao="campo-linha-add" data-tipo="kit"><span aria-hidden="true">+</span> Item</button>
          <div id="kit-proj">${projKit(d.kit)}</div></fieldset>
        <fieldset><legend>11. Cronograma</legend>
          <div class="linhas">${(d.cronograma && d.cronograma.length ? d.cronograma : [{}]).map(linhaCron).join('')}</div>
          <button type="button" class="btn-add" data-acao="campo-linha-add" data-tipo="cron"><span aria-hidden="true">+</span> Atividade</button>
          <div class="campos">
            <div class="campo" id="w-lote"><label>Lote de implantação</label>${rad('lote', [['1', 'Lote 1 (jan–abr)'], ['2', 'Lote 2 (mai–jul)']], d.lote ? String(d.lote) : '')}</div>
            <div class="campo"><label for="dg-mes">Mês previsto</label><input id="dg-mes" name="mes_implantacao" value="${v('mes_implantacao')}" maxlength="120" placeholder="No início das chuvas ou com água garantida"></div>
          </div></fieldset>
        <fieldset><legend>12. Compromissos</legend>
          <label class="check" id="w-compromissos"><input type="checkbox" name="compromissos" ${d.compromissos ? 'checked' : ''}><span>Ela concorda em usar o kit no quintal, cuidar da produção, receber as visitas, participar das formações e avisar a equipe se deixar de usar o quintal.</span></label>
        </fieldset>
        </div>
        <input type="hidden" name="fotos_existentes" value="${E((d.fotos || []).join('|'))}">
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
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
      data_visita: txt('data_visita'), latitude: num('latitude'), longitude: num('longitude'), sem_gps_motivo: [txt('sem_gps_tipo'), txt('sem_gps_detalhe')].filter(Boolean).join('. '), sem_gps_tipo: txt('sem_gps_tipo'), sem_gps_detalhe: txt('sem_gps_detalhe'),
      gps_precisao: num('gps_precisao'), gps_em: txt('gps_em') || null,
      familia: linhas('familia', [['nome', 'fam_nome'], ['idade', 'fam_idade', 'num'], ['parentesco', 'fam_par'], ['ocupacao', 'fam_ocup'], ['ajuda', 'fam_ajuda', 'chk']]).filter(x => x.nome),
      politicas: todos('politicas'), renda_familiar: num('renda_familiar'), fonte_renda: txt('fonte_renda'),
      area_m2: num('area_m2'), terra: txt('terra'), cercado: txt('cercado'), fontes_agua: todos('fontes_agua'), agua_seca: txt('agua_seca'),
      capacidade_litros: num('capacidade_litros'), meses_seca: num('meses_seca'), distancia_m: num('distancia_m'),
      reuso: fd.get('reuso') === 'sim' ? true : fd.get('reuso') === 'nao' ? false : null, irrigacao: txt('irrigacao'), solo: txt('solo'), meses_chuva: txt('meses_chuva'),
      producao, renda_quintal: num('renda_quintal'), praticas: todos('praticas'), horas_dia: num('horas_dia'), participa: todos('participa'),
      dificuldades: txt('dificuldades'), sonhos: txt('sonhos'),
      objetivos: todos('objetivos'), frase_objetivo: txt('frase_objetivo'),
      kit: linhas('kit', [['item', 'kit_item'], ['qtd', 'kit_qtd'], ['valor', 'kit_valor'], ['para', 'kit_para']]).filter(x => x.item)
        .map(x => { const q = numBR(x.qtd), o = Object.assign(x, { valor: numBR(x.valor) });
          // "1/2", "2 de 500 ml", "3 a 4": a tela lê o primeiro número (0,5 · 2 · 3); o banco colaria os números (12 · 2500 · 34).
          // Para os dois lerem igual, a quantidade vai como número e o texto digitado fica guardado em qtd_txt.
          if (q != null && q !== R.numBanco(x.qtd)) { o.qtd_txt = x.qtd; o.qtd = String(q).replace('.', ','); }
          return o; }),
      cronograma: linhas('cron', [['oque', 'cr_oque'], ['inicio', 'cr_ini'], ['fim', 'cr_fim'], ['quem', 'cr_quem']]).filter(x => x.oque),
      lote: num('lote'), mes_implantacao: txt('mes_implantacao'), compromissos: !!fd.get('compromissos'),
      impacto: MQ.impactoUI && form.querySelector('fieldset.impacto') ? MQ.impactoUI.ler(form) : undefined
    };
    const existentes = String(fd.get('fotos_existentes') || '').split('|').filter(Boolean);
    d.fotos_ok = ['geral', 'agua', 'plantio'].filter(k => fotosTemp[k] || existentes.some(x => new RegExp('diag_' + k).test(x)) || existentes.includes('exemplo')).length;
    d.fotos = existentes;
    d.kit_total = totalKit(d.kit);
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
    const eu = S().eu; const souTec = R.decideCampo(eu.papel);
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
        ${podeCorrigir ? `<div class="acoes"><button class="btn pri" data-acao="campo-diag-novo" data-ficha="${E(f.id)}">Corrigir</button></div>` : ''}
        <div class="resumo" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div><span class="v num">${d.area_m2 ?? '—'}<small> m²</small></span><span class="l">área do quintal</span></div>
          <div><span class="v num">${d.renda_quintal != null ? R.fmtBRL(+d.renda_quintal).replace(',00', '') : '—'}</span><span class="l">vendas do quintal por mês</span></div>
          <div><span class="v">${{ sim: 'Sim', as_vezes: 'Às vezes', nao: 'Não' }[d.agua_seca] || '—'}</span><span class="l">água dura na seca</span></div></div>
        <div class="bloco"><h3>Visita</h3>${dl([['Data', R.fmtData(d.data_visita)], ['Quem visitou', (pessoa(dg.executor_id) || {}).nome]])}</div>
        ${blocoLocal(dg, f)}
        <div class="bloco"><h3>Família (${(d.familia || []).length})</h3>${tab(['Nome', 'Idade', 'Parentesco', 'Estuda/trabalha', 'Ajuda'], (d.familia || []).map(x => [x.nome, x.idade, x.parentesco, x.ocupacao, x.ajuda ? 'Sim' : 'Não']))}
          ${dl([['Políticas', (d.politicas || []).map(k => rot(MQ.DIAG.politicas, k)).join(', ')], ['Renda da família', d.renda_familiar != null ? R.fmtBRL(+d.renda_familiar) : null], ['Maior fonte', d.fonte_renda]])}</div>
        <div class="bloco"><h3>Quintal e água</h3>${dl([['Terra', { propria: 'Própria', cedida: 'Cedida', outra: 'Outra' }[d.terra]], ['Cercado', { sim: 'Sim', nao: 'Não', em_parte: 'Em parte' }[d.cercado]],
          ['Fontes de água', (d.fontes_agua || []).map(k => rot(MQ.DIAG.fontes_agua, k)).join(', ')], ['Capacidade', d.capacidade_litros ? d.capacidade_litros + ' L' : null],
          ['Dura na seca', d.meses_seca != null ? d.meses_seca + ' meses' : null], ['Distância', d.distancia_m != null ? d.distancia_m + ' m' : null], ['Irrigação', d.irrigacao], ['Solo', d.solo], ['Chuvas', d.meses_chuva]])}</div>
        <div class="bloco"><h3>Produção hoje</h3>${tab(['O quê', 'Quantidade', 'Uso', 'Onde vende'], Object.entries(d.producao || {}).map(([k, x]) => [rot(MQ.DIAG.producao, k), x.qtd, [x.consumo && 'consumo', x.venda && 'venda'].filter(Boolean).join(' e '), x.onde]))}
          ${dl([['Práticas', (d.praticas || []).map(k => rot(MQ.DIAG.praticas, k)).join(', ')], ['Horas por dia', d.horas_dia], ['Participa de', (d.participa || []).map(k => rot(MQ.DIAG.participa, k)).join(', ')], ['Dificuldades', d.dificuldades], ['Quer', d.sonhos]])}</div>
        ${dg.sem_agua ? '<div class="aviso erro">Sem água que dure na seca: não há plano nem kit. Encaminhar para programa de cisternas.</div>' : `
        <div class="bloco"><h3>Plano do quintal</h3>${dl([['Objetivo', (d.objetivos || []).map(k => rot(MQ.DIAG.objetivos, k)).join(', ')], ['Em 12 meses', d.frase_objetivo], ['Lote', d.lote ? 'Lote ' + d.lote : null], ['Mês previsto', d.mes_implantacao]])}
          <h3 style="margin-top:8px">Kit</h3>${tab(['Item', 'Qtd.', 'R$ unid.', 'Subtotal', 'Para quê'], (d.kit || []).map(x => [x.item, x.qtd_txt || x.qtd, x.valor != null ? brl(x.valor) : '—', x.valor != null ? brl(totalKit([x])) : '—', x.para]))}
          ${projKit(d.kit)}
          <h3 style="margin-top:8px">Cronograma</h3>${tab(['O que', 'Início', 'Fim', 'Quem'], (d.cronograma || []).map(x => [x.oque, x.inicio, x.fim, x.quem]))}</div>`}
        <div class="bloco"><h3>Fotos</h3><div class="acoes">${(dg.fotos || []).map((x, i) => `<button class="btn peq" data-acao="ficha-foto" data-path="${E(x)}">${x === 'exemplo' ? 'Foto de exemplo' : 'Foto ' + (i + 1)}</button>`).join('') || '<span class="muted small">Sem fotos enviadas.</span>'}</div><div id="fi-foto-vista"></div></div>
        ${MQ.sugestaoUI && !dg._fila ? MQ.sugestaoUI.bloco(f, dg) : ''}
        ${MQ.vitrineUI && !dg._fila ? MQ.vitrineUI.blocoPublicar(f, dg) : ''}
        ${souTec && !dg._fila ? (() => { const loc = localDiag(dg, f); const alterei = dg.conteudo_alterado_por && dg.conteudo_alterado_por === eu.id;
          return `<form class="bloco" data-form="diag-decisao" data-id="${E(dg.id)}" data-marca="${E(dg.atualizado_em || '')}" data-conferir="${loc.alerta ? '1' : ''}" novalidate><h3>Decisão da coordenação</h3>
          <p class="small muted">${dg.sem_agua ? 'Confirme o encaminhamento por falta de água.' : 'Aprove se o kit está na lista aprovada e cabe no valor por quintal, e se o cronograma é viável.'}</p>
          ${alterei && dg.situacao !== 'aprovado' ? '<div class="aviso"><b>Você alterou este diagnóstico, então não aprova.</b> Quem aprova é a coordenação técnica. Sem técnica, devolva para quem aplicou corrigir: depois da correção dela, você pode aprovar.</div>' : ''}
          <div class="campo"><label for="dd-obs">${loc.alerta && dg.situacao !== 'aprovado' ? 'Observação: como você confirmou que a visita aconteceu?' : 'Observação'}</label><textarea id="dd-obs" name="obs" maxlength="2000">${dg.situacao === 'aprovado' ? E(dg.obs_coordenacao || '') : ''}</textarea>
            ${dg.situacao !== 'aprovado' && dg.obs_coordenacao ? `<span class="dica">Observação anterior: ${E(dg.obs_coordenacao)}</span>` : ''}</div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes">${dg.situacao !== 'aprovado' && !alterei ? `<button class="btn pri" type="submit" name="decisao" value="aprovado">${dg.sem_agua ? 'Confirmar encaminhamento' : 'Aprovar plano'}</button>` : ''}
            <button class="btn perigo" type="submit" name="decisao" value="devolvido">${dg.situacao === 'aprovado' ? 'Reabrir: devolver' : 'Devolver para correção'}</button></div></form>`; })() : ''}
      </div>`;
  }

  /* ---------- implantação e acompanhamento: registrar a visita feita ---------- */
  const fotosVis = {};
  function painelFeita(p) {
    const v = visitas().find(x => x.id === p.id); if (!v) return '';
    const f = ficha(v.ficha_id) || {}; const q = pessoa(v.executor_id) || {};
    const foto = n => `<div class="campo"><label for="vf-f${n}">Foto ${n}${n === 1 ? '' : ' <span class="muted">(opcional)</span>'}</label><input id="vf-f${n}" type="file" accept="image/*" capture="environment" data-foto-vis="${n}"><span class="dica" id="vf-f${n}-dica">${fotosVis[n] ? 'Foto pronta.' : n === 1 ? 'Do que foi feito no quintal.' : ''}</span></div>`;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${E(MQ.ETAPAS[v.etapa].nome)} · prevista para ${R.fmtData(v.data_prevista)}</span><h2 id="painel-t">${E(f.nome || 'Quintal')}</h2>
        <span class="small muted">${E(f.municipio || '')} · quem visita: ${E(q.nome || '—')}</span></div><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="visita-feita" data-id="${E(v.id)}" novalidate>
        <p class="small muted">Registrar a visita feita é o que permite solicitar a ajuda de custo dela. Depois de solicitada, ela não muda mais.</p>
        <div class="campos">
          <div class="campo"><label for="vf-data">Dia em que foi feita</label><input id="vf-data" name="data_realizada" type="date" min="${R.LIM.visitaMin}" max="${R.hoje()}" value="${v.data_realizada || (v.data_prevista <= R.hoje() ? v.data_prevista : R.hoje())}" required></div>
          <div class="campo inteiro"><label for="vf-rel">O que foi feito</label><textarea id="vf-rel" name="relato" rows="4" maxlength="2000" placeholder="${v.etapa === 'implantacao' ? 'Ex.: entregue a caixa d’água e o kit de gotejamento; montados 3 canteiros com a família; combinada a próxima visita.' : 'Ex.: canteiros produzindo alface e coentro; gotejamento com vazamento consertado; orientei a compostagem.'}">${E(v.relato || '')}</textarea></div>
          ${foto(1)}${foto(2)}${foto(3)}
        </div>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Registrar visita feita</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }
  document.addEventListener('change', async ev => {
    const inp = ev.target.closest && ev.target.closest('input[data-foto-vis]'); if (!inp || !inp.files[0]) return;
    const n = inp.dataset.fotoVis; const dica = document.getElementById('vf-f' + n + '-dica');
    if (inp.files[0].size > 15 * 1024 * 1024) { dica.textContent = 'Arquivo muito grande (máx. 15 MB).'; inp.value = ''; return; }
    dica.textContent = 'Preparando foto…';
    const foto = await prepararFoto(inp, dica); if (!foto) { delete fotosVis[n]; return; }
    fotosVis[n] = foto; dica.textContent = 'Foto pronta (' + Math.round(fotosVis[n].size / 1024) + ' KB).';
  });
  /* Só aceita foto de verdade (imagem, com tamanho e que o aparelho consiga abrir). Arquivo que não é foto
     (texto, PDF, arquivo vazio ou renomeado para .jpg) é recusado na hora, com o aviso embaixo do campo.
     A conferência é a de MQ.comprimirFoto (fila.js); aqui a tela mostra o motivo e limpa o campo. */
  const MSG_NAO_FOTO = 'Este arquivo não é uma foto.';
  async function prepararFoto(inp, dica) {
    const arq = inp.files[0];
    const recusar = () => { inp.value = ''; if (dica) { dica.textContent = MSG_NAO_FOTO + ' Tire a foto de novo ou escolha outra imagem.'; dica.classList.add('erro-foto'); } return null; };
    if (!arq || !/^image\//.test(String(arq.type || '')) || !(arq.size > 0)) return recusar();
    if (dica) dica.classList.remove('erro-foto');
    try { const b = await MQ.comprimirFoto(arq, undefined, undefined, { semAviso: true }); return b && b.size > 0 ? b : recusar(); }
    catch (e) { return recusar(); }
  }

  /* 47: registros deste aparelho que o servidor recusou porque outra pessoa alterou antes. Não são descartados:
     "Abrir e conferir" mostra o registro como está agora, com o que a pessoa tinha mudado por cima, para ela salvar de novo. */
  function avisoConflitos() {
    const its = (S().fila || []).filter(i => i.conflito && /^(visita|diagnostico|avaliacao)$/.test(i.tipo || ''));
    if (!its.length) return '';
    const nome = i => { const f = ficha(i.dados && i.dados.ficha_id) || {}; return (i.tipo === 'visita' ? 'Visita' : i.tipo === 'diagnostico' ? 'Diagnóstico' : 'Avaliação') + (f.nome ? ' · ' + f.nome : ''); };
    return `<div class="aviso erro" role="status"><b>${its.length > 1 ? its.length + ' registros não foram enviados' : '1 registro não foi enviado'}: outra pessoa alterou antes.</b> O que você preencheu continua guardado neste aparelho.
      ${its.map(i => `<div style="margin-top:6px">${E(nome(i))} <button class="btn peq" data-acao="campo-conferir" data-id="${E(i.id)}">Abrir e conferir</button></div>`).join('')}</div>`;
  }
  function painel(p) {
    if (p.tipo === 'visita-feita') return painelFeita(p);
    if (p.tipo === 'visita-form') return painelVisita(p);
    if (p.tipo === 'diag-form') return painelDiag(p);
    return painelDiagVer(p);
  }

  /* ---------- ações ---------- */
  async function clique(a, el) {
    const eu = S().eu;
    if (a === 'campo-conferir') {
      const it = (S().fila || []).find(i => i.id === el.dataset.id); if (!it) return;
      const d = it.dados || {};
      if (it.tipo === 'visita' && d.situacao === 'realizada') { Object.keys(fotosVis).forEach(k => delete fotosVis[k]); Object.assign(fotosVis, it.fotos || {}); U().abrirPainel({ tipo: 'visita-feita', id: it.id }); }
      else if (it.tipo === 'visita') U().abrirPainel({ tipo: 'visita-form', id: it.id });
      else if (it.tipo === 'diagnostico') { Object.keys(fotosTemp).forEach(k => delete fotosTemp[k]); Object.assign(fotosTemp, it.fotos || {});
        U().abrirPainel({ tipo: 'diag-form', ficha: d.ficha_id, visita: d.visita_id || '' }); setTimeout(() => { const fm = $('form[data-form=diag]'); if (fm) atualizarDiag(fm); }, 0); }
      else if (it.tipo === 'avaliacao' && MQ.impactoUI) MQ.impactoUI.conferir(it);
      const p = document.getElementById('painel'), f0 = p && p.querySelector('form[data-form]');
      if (f0 && !p.querySelector('.rascunho-volta')) { const n = document.createElement('p'); n.className = 'aviso rascunho-volta'; n.setAttribute('role', 'status');
        n.textContent = R.MSG_CONFLITO + ' Já mostramos o registro como está agora, com o que você tinha preenchido por cima: confira e salve de novo.'; f0.prepend(n); }
    }
    else if (a === 'campo-visita-nova') U().abrirPainel({ tipo: 'visita-form', uf: eu.uf });
    else if (a === 'campo-visita-editar') U().abrirPainel({ tipo: 'visita-form', id: el.dataset.id });
    else if (a === 'campo-feita') { Object.keys(fotosVis).forEach(k => delete fotosVis[k]); U().abrirPainel({ tipo: 'visita-feita', id: el.dataset.id }); }
    else if (a === 'campo-mes') { const n = +el.dataset.n; mesRoteiro = n === 0 ? mesAtual() : mesMais(mesRoteiro || mesAtual(), n); limRot = ROT_PASSO; U().render(); }
    else if (a === 'campo-uf') { ufRoteiro = el.dataset.uf; limRot = ROT_PASSO; U().render(); }
    else if (a === 'campo-rot-mais' || a === 'campo-rot-todas') { limRot = a === 'campo-rot-todas' ? Infinity : limRot + ROT_PASSO; S().rolarPara = window.scrollY; U().render(); }
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
        fm.gps_precisao.value = Math.round(pos.coords.accuracy); fm.gps_em.value = new Date().toISOString();
        dica.textContent = fm.latitude.value + ', ' + fm.longitude.value + ' (precisão de ' + Math.round(pos.coords.accuracy) + ' m)'; el.textContent = 'Localização registrada ✓';
      }, err => { dica.textContent = MQ.dicaGPS(err, 'Se não der, explique no campo abaixo.'); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    }
    else if (a === 'campo-visita-cancelar') {
      const fm = $('form[data-form=visita]'); const v = visitas().find(x => x.id === fm.dataset.id);
      if (!fm.dataset.confirmar) { fm.dataset.confirmar = '1'; el.textContent = 'Confirmar cancelamento'; return; }
      await U().ocupado(fm, async () => { await guardar('visita', Object.assign({}, v, { situacao: 'cancelada' })); U().fecharPainel(); U().render(); U().toast('Visita cancelada. O dia de campo volta para o saldo do estado.'); }, { semConferir: true });
    }
  }

  async function guardar(tipo, dados, fotos) {
    const s = S();
    const limpo = Object.assign({}, dados); ['_fila', '_erro', '_conflito'].forEach(k => delete limpo[k]);
    // 47: a versão que a pessoa leu (atualizado_em de quando o formulário abriu) vai com o envio e fica na fila se estiver sem internet
    const vista = U().vista(), lista = { visita: 'visitas', diagnostico: 'diagnosticos', avaliacao: 'avaliacoes' }[tipo];
    const antes = (vista.fila || []).find(i => i.id === limpo.id && i.tipo === tipo), noServ = ((vista[lista]) || []).find(x => x.id === limpo.id);
    await MQ.fila.salvar({ id: limpo.id, dono: s.eu.id, tipo, dados: limpo, fotos: fotos || null, erro: null,
      marca: U().marcaAberta(tipo, limpo.id), mud: MQ.camposMudados(limpo, noServ, antes && antes.mud) });
    s.fila = await MQ.fila.listar(s.eu.id);
    if (navigator.onLine) await U().sincronizar(false);
    const resta = s.fila.find(i => i.id === limpo.id);
    if (resta && resta.erro) {
      const e = new Error(resta.erro);
      // outra pessoa alterou o registro: o formulário reabre com o dado novo e o que ela tinha digitado volta por cima (nada se perde)
      if (resta.conflito && U().reabrirComConflito) { await MQ.fila.remover(resta.id); s.fila = await MQ.fila.listar(s.eu.id); if (U().reabrirComConflito(resta.erro)) e.jaAvisado = true; }
      throw e;
    }
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
      // de hoje até 31/12/2027 (o banco recusa 2019 ou 2099); a data que já estava gravada e não mudou não trava
      { const ed = R.erroDataPrevista(v.data_prevista, v0 && v0.data_prevista); if (ed) e.data_prevista = ed; }
      if (v.obs && v.obs.length > 300) e.obs = 'Texto muito longo (máximo 300 caracteres).';
      if (!v0 && v.ficha_id) {
        if (ativasDe(v.ficha_id, v.etapa).length >= MQ.ETAPAS[v.etapa].max) e.etapa = v.etapa === 'acompanhamento' ? 'Este quintal já tem as 2 visitas de acompanhamento.' : 'Este quintal já tem essa visita agendada ou feita.';
        else if (v.etapa !== 'diagnostico' && !ativasDe(v.ficha_id, 'diagnostico').some(x => x.situacao === 'realizada')) e.etapa = 'Primeiro o diagnóstico.';
        const f = ficha(v.ficha_id); if (f && diasUsados(f.uf) >= MQ.DIAS_CAMPO_UF) e.ficha_id = 'O estado já usou os ' + MQ.DIAS_CAMPO_UF + ' dias de campo.';
        if (v.etapa === 'avaliacao' && !ativasDe(v.ficha_id, 'implantacao').some(x => x.situacao === 'realizada')) e.etapa = 'A avaliação é feita depois da implantação.';
        // implantação só com o plano aprovado e com água; acompanhamento só depois da implantação feita
        if (!e.etapa) { const m = motivoEtapa(v); if (m) e.etapa = m; }
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
        form.querySelectorAll('[id^="w-"].tem-erro').forEach(w => w.classList.remove('tem-erro'));   // marcas do envio anterior
        // mostrarErros (app.js) marca o campo ou o bloco "w-<nome>" de cada erro e lista todos na caixa
        U().mostrarErros(form, erros, Object.keys(erros).length > 1 ? 'Faltam ' + Object.keys(erros).length + ' itens: ' + Object.values(erros).join(' · ') : Object.values(erros)[0]);
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
        const extra = Object.assign({}, d); campos.concat(['fotos', 'fotos_ok', 'sem_gps_tipo', 'sem_gps_detalhe']).forEach(k => delete extra[k]);
        if (sem) ['objetivos', 'frase_objetivo', 'kit', 'cronograma', 'compromissos'].forEach(k => delete extra[k]);
        reg.dados = extra;
        const fotos = Object.assign({}, fotosTemp);
        const enviado = await guardar('diagnostico', reg, fotos);
        Object.keys(fotosTemp).forEach(k => delete fotosTemp[k]);
        U().fecharPainel(); U().render();
        U().toast(enviado ? (sem ? 'Diagnóstico enviado. Sem água: a coordenação técnica foi avisada.' : 'Diagnóstico enviado. O plano vai para aprovação da coordenação técnica.') : 'Diagnóstico guardado no aparelho. Será enviado quando houver internet.');
      });
    }
    if (tipo === 'visita-feita') {
      const v0 = visitas().find(x => x.id === form.dataset.id);
      const data = String(fd.get('data_realizada') || ''), relato = String(fd.get('relato') || '').trim();
      const e = {};
      { const ed = R.erroDataFeita(data); if (ed) e.data_realizada = ed; }   // de 01/01/2026 até hoje
      if (relato.length < 20) e.relato = 'Conte em poucas linhas o que foi feito (pelo menos 20 letras).';
      else if (relato.length > 2000) e.relato = 'Texto muito longo (máximo 2.000 caracteres).';
      if (!fotosVis[1]) e.foto = 'Faça pelo menos 1 foto do que foi feito.';
      if (v0 && !e.data_realizada) { const m = motivoEtapa(v0, { data }); if (m) e.data_realizada = m; }   // etapa na ordem e data depois da etapa anterior
      if (Object.keys(e).length) { const geral = e.foto; delete e.foto; return U().mostrarErros(form, e, geral && !Object.keys(e).length ? geral : undefined); }
      await U().ocupado(form, async () => {
        const v = Object.assign({}, v0, { situacao: 'realizada', data_realizada: data, relato });
        const enviado = await guardar('visita', v, Object.assign({}, fotosVis));
        Object.keys(fotosVis).forEach(k => delete fotosVis[k]);
        U().fecharPainel(); U().render();
        U().toast(enviado ? 'Visita registrada como feita. Já pode entrar na solicitação de ajuda de custo do mês.' : 'Visita guardada no aparelho. Será enviada quando houver internet.');
      });
    }
    if (tipo === 'diag-decisao') {
      const dec = form.dataset.decisao || 'aprovado'; const obs = String(fd.get('obs') || '').trim();
      if (dec === 'devolvido' && obs.length < 5) return U().mostrarErros(form, { obs: 'Escreva o que precisa ser corrigido.' });
      if (dec === 'aprovado' && form.dataset.conferir && obs.length < 10) return U().mostrarErros(form, { obs: 'Escreva como você confirmou que a visita aconteceu (pelo menos 10 letras).' });
      await U().ocupado(form, async () => {
        // a marca diz o que a coordenação leu: se o diagnóstico mudou depois, o servidor recusa a aprovação
        await S().api.decidirDiagnostico(form.dataset.id, dec, obs, form.dataset.marca || undefined);
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
      dica.textContent = 'Preparando foto…';
      const foto = await prepararFoto(ev.target, dica); if (!foto) { delete fotosTemp[k]; atualizarDiag(form); return; }
      fotosTemp[k] = foto;
      dica.textContent = 'Foto pronta (' + Math.round(fotosTemp[k].size / 1024) + ' KB).';
      const w = form.querySelector('#w-fotos'); if (w) w.classList.remove('tem-erro');
    }
    atualizarDiag(form);
    const w = ev.target.closest('[id^="w-"]'); if (w) w.classList.remove('tem-erro');
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('form[data-form=diag-decisao] button[name=decisao]'); if (b) b.form.dataset.decisao = b.value;
  }, true);

  document.addEventListener('input', ev => {
    const t = ev.target; if (!t.matches || !t.matches('[name=kit_qtd],[name=kit_valor],[name=kit_item]')) return;
    const f = t.form; const box = f && f.querySelector('#kit-proj'); if (!box) return;
    const kit = [...f.querySelectorAll('[data-linha="kit"]')].map(l => ({ item: l.querySelector('[name=kit_item]').value.trim(), qtd: l.querySelector('[name=kit_qtd]').value, valor: numBR(l.querySelector('[name=kit_valor]').value) })).filter(x => x.item);
    box.innerHTML = projKit(kit);
  });
  /* o que espera a pessoa no campo: visita dela com data que já chegou e ainda não registrada,
     e diagnóstico devolvido para corrigir (da agente: os dela; da bolsista: os do estado) */
  function contaAFazer() {
    const eu = S().eu; const hoje = R.hoje();
    const vencidas = visitas().filter(v => v.executor_id === eu.id && v.situacao === 'prevista' && String(v.data_prevista) <= hoje).length;
    const devolvidos = diagnosticos().filter(d => d.situacao === 'devolvido' && (eu.papel === 'agente' ? (visitas().find(v => v.id === d.visita_id) || {}).executor_id === eu.id : d.uf === eu.uf)).length;
    return vencidas + devolvidos;
  }
  MQ.campoUI = { contaAFazer, secaoBolsista, telaAgente, abaCoord, painel, clique, enviar, diagnosticos, visitas, guardar, numBR, totalKit, prepararFoto, localDiag, kmEntre, centroMun, MOTIVOS_SEM_GPS };
})();
