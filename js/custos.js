/* Mulheres & Quintais — ajuda de custo por visita: horas de trabalho + combustível (ida e volta) + 1 refeição.
   Distância: km conferido pela coordenação; sem ele, estimativa em linha reta × fator de estrada
   entre o município de quem visita e o quintal (GPS do diagnóstico, da ficha ou centro do município). */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const R = MQ.regras;
  const $ = s => document.querySelector(s);
  const C = { par: null, km: null, mes: null, carregado: false, erro: null };
  const brl = v => (Math.round((+v || 0) * 100) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const norm = t => String(t || '').split('/')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const mesDe = d => String(d || '').slice(0, 7);
  const mesHoje = () => R.hoje().slice(0, 7);
  const nomeMes = m => { const [a, b] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+b - 1] + '/' + a; };
  const somaMes = (m, n) => { const [a, b] = m.split('-').map(Number); const d = new Date(a, b - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  async function carregar() {
    try {
      const [par, km] = await Promise.all([S().api.lerParametros('custo_visita'), S().api.listarCustos()]);
      C.par = Object.assign({}, MQ.CUSTO_PADRAO, par || {}, { horas: Object.assign({}, MQ.CUSTO_PADRAO.horas, (par || {}).horas) });
      C.km = Object.fromEntries((km || []).map(k => [k.visita_id, +k.km_ida]));
      C.erro = null;
    } catch (e) {
      C.par = C.par || Object.assign({}, MQ.CUSTO_PADRAO); C.km = C.km || {};
      C.erro = /parametros|custos_visita|PGRST205|does not exist|schema cache/i.test(e.message)
        ? 'O cálculo ainda não foi instalado no servidor: rode o arquivo 04_vitrine_e_custos.sql no Supabase. Até lá, os valores abaixo são uma simulação e o km não fica salvo.'
        : e.message;
    }
    C.carregado = true;
  }

  /* ---------- distância ---------- */
  const memoMun = {};   // nome normalizado → coordenadas (a lista de municípios é grande: não procura de novo a cada visita)
  function coordMun(uf, municipio) {
    const chave = uf + '|' + norm(municipio);
    if (!(chave in memoMun)) { const muns = (MQ.GEO.mun || {})[uf] || {}; const k = Object.keys(muns).find(m => norm(m) === norm(municipio));
      memoMun[chave] = k ? { lon: muns[k][0], lat: muns[k][1], como: 'centro de ' + k } : null; }
    return memoMun[chave] ? Object.assign({}, memoMun[chave]) : null;
  }
  function destino(v) {
    const dg = (S().diagnosticos || []).find(x => x.ficha_id === v.ficha_id && x.latitude != null);
    if (dg) return { lat: +dg.latitude, lon: +dg.longitude, como: 'GPS do quintal' };
    const f = (S().fichas || []).find(x => x.id === v.ficha_id);
    if (!f) return null;
    if (f.latitude != null) return { lat: +f.latitude, lon: +f.longitude, como: 'GPS da ficha' };
    return coordMun(f.uf, f.municipio);
  }
  function linhaReta(a, b) {
    const rad = x => x * Math.PI / 180, R0 = 6371;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R0 * Math.asin(Math.sqrt(h));
  }
  function kmIda(v) {
    if (C.km && C.km[v.id] != null) return { km: C.km[v.id], fonte: 'conferido' };
    const p = U().porId(v.executor_id); const o = p && coordMun(p.uf || v.uf, p.municipio); const d = destino(v);
    if (!o || !d) return { km: null, fonte: !o ? 'sem município de partida conhecido' : 'sem localização do quintal' };
    return { km: Math.round(linhaReta(o, d) * C.par.fator_estrada), fonte: 'estimado' };
  }

  /* ---------- cálculo ---------- */
  function calcular(etapa, km) {
    const p = C.par; const horas = +(p.horas[etapa] || 0);
    const trabalho = horas * p.valor_hora;
    const combustivel = km == null ? null : (2 * km / p.km_por_litro) * p.preco_litro;
    const refeicao = +p.refeicao || 0;
    return { horas, trabalho, combustivel, refeicao, total: trabalho + (combustivel || 0) + refeicao, completo: km != null };
  }

  /* ---------- tela ---------- */
  function aba() {
    const souCoord = /^coord/.test(S().eu.papel);
    const vis = C.visao || 'mes';
    const nav = `<div class="seg custo-nav" role="tablist" aria-label="Visão"><button type="button" role="tab" data-acao="custo-visao" data-v="mes" aria-selected="${vis === 'mes'}">Pagamento do mês</button><button type="button" role="tab" data-acao="custo-visao" data-v="plano" aria-selected="${vis === 'plano'}">Proposta de roteiro</button></div>`;
    if (!C.carregado) {
      if (!C.carregando) C.carregando = carregar().then(() => U().render());
      // mesmo cabeçalho da página pronta, para nada pular quando os valores chegarem
      return `<div class="cab"><div><span class="eyebrow">Ajuda de custo</span><h1>Custo das visitas</h1><p class="carregando">${MQ.ampulheta(true)}</p></div></div>${nav}<div class="custo-esqueleto" aria-hidden="true"></div>`;
    }
    // o seletor de visão vem logo abaixo do título, como nas outras páginas (o título fica sempre no mesmo lugar)
    if (vis === 'plano') return planoHTML().replace('<!--nav-->', nav);
    C.mes = C.mes || mesHoje();
    const vs = (S().visitas || []).filter(v => v.situacao !== 'cancelada' && mesDe(v.data_realizada || v.data_prevista) === C.mes)
      .sort((a, b) => String(a.data_realizada || a.data_prevista).localeCompare(String(b.data_realizada || b.data_prevista)));
    const linhas = vs.map(v => { const k = kmIda(v); return { v, k, c: calcular(v.etapa, k.km), p: U().porId(v.executor_id) || {} }; });
    const feitas = linhas.filter(l => l.v.situacao === 'realizada'), prev = linhas.filter(l => l.v.situacao !== 'realizada');
    const soma = ls => ls.reduce((s, l) => s + l.c.total, 0);
    const porPessoa = {}; feitas.forEach(l => { const id = l.v.executor_id; (porPessoa[id] = porPessoa[id] || { p: l.p, n: 0, total: 0, falta: 0 }); porPessoa[id].n++; porPessoa[id].total += l.c.total; if (!l.c.completo) porPessoa[id].falta++; });
    const semKm = feitas.filter(l => !l.c.completo).length;
    const p = C.par;
    return `<div class="cab"><div><span class="eyebrow">Ajuda de custo</span><h1>Custo das visitas</h1>
        <p>Cada visita paga as horas de trabalho, o combustível de ida e volta e uma refeição. Confira o km de cada visita antes de pagar: sem km conferido o sistema usa uma estimativa.</p></div>
        <span class="seg" role="group" aria-label="Mês"><button type="button" data-acao="custo-mes" data-n="-1" aria-label="Mês anterior">‹</button><button type="button" aria-pressed="true">${nomeMes(C.mes)}</button><button type="button" data-acao="custo-mes" data-n="1" aria-label="Próximo mês">›</button></span></div>
      ${nav}
      ${C.erro ? `<div class="aviso">${E(C.erro)}</div>` : ''}
      <div class="aviso erro"><b>Confirme com a FUNCERN antes de pagar.</b> Bolsistas já recebem bolsa mensal: pagar também as horas de visita a elas pode ser entendido como pagamento em dobro pela mesma atividade.</div>
      <div class="resumo">
        <div><span class="v num">${brl(soma(feitas))}</span><span class="l">visitas feitas em ${nomeMes(C.mes)} (${feitas.length})</span></div>
        <div><span class="v num">${brl(soma(prev))}</span><span class="l">previstas no roteiro (${prev.length})</span></div>
        <div><span class="v num">${Object.keys(porPessoa).length}</span><span class="l">pessoas a receber</span></div>
        <div><span class="v num">${semKm}</span><span class="l">visitas feitas sem km (não somam combustível)</span></div></div>
      <div class="duas-col">
        <section class="secao"><div class="secao-cab"><h2>Por pessoa · visitas feitas</h2>${feitas.length ? '<button class="btn peq" data-acao="custo-csv">Baixar CSV</button>' : ''}</div>
          ${Object.keys(porPessoa).length ? `<div class="bloco"><table class="tab-uf"><thead><tr><th>Pessoa</th><th>Visitas</th><th style="text-align:right">A pagar</th></tr></thead><tbody>
            ${Object.values(porPessoa).sort((a, b) => b.total - a.total).map(x => `<tr><td><b>${E(x.p.nome || '—')}</b><br><span class="small muted">${E((MQ.PAPEIS[x.p.papel] || {}).nome || '')} · ${E(x.p.uf || '')}${x.falta ? ` · <span class="crit-txt">${x.falta} sem km</span>` : ''}</span></td>
              <td class="num">${x.n}</td><td class="num" style="text-align:right"><b>${brl(x.total)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhuma visita feita neste mês.</p>'}
          <h2 style="margin-top:12px">Visitas do mês</h2>
          ${linhas.length ? `<div class="lista-custo">${linhas.map(linha).join('')}</div>` : '<p class="muted">Nenhuma visita neste mês.</p>'}
        </section>
        <aside class="secao">
          <form class="bloco" data-form="custo-sim" novalidate><h2>Simular uma visita</h2>
            <div class="campos"><div class="campo"><label for="cs-e">Tipo</label><select id="cs-e" name="etapa">${Object.entries(MQ.ETAPAS_CUSTO).map(([k, t]) => `<option value="${k}">${t} (${p.horas[k]} h)</option>`).join('')}</select></div>
              <div class="campo"><label for="cs-k">Km só de ida</label><input id="cs-k" name="km" type="number" min="0" max="999" inputmode="decimal" value="30"></div></div>
            <div id="cs-res">${quadro(calcular('diagnostico', 30))}</div></form>
          <form class="bloco" data-form="custo-par" novalidate><h2>Valores usados</h2>
            <p class="small muted">Valem para todas as visitas${souCoord ? '. Alterações ficam registradas no histórico' : ''}.</p>
            <div class="campos">
              ${num('valor_hora', 'Valor da hora (R$)', p.valor_hora, 1)}${num('refeicao', 'Refeição por visita (R$)', p.refeicao, 0.5)}
              ${num('h_diagnostico', 'Horas · diagnóstico', p.horas.diagnostico, 0.5)}${num('h_implantacao', 'Horas · implantação', p.horas.implantacao, 0.5)}
              ${num('h_acompanhamento', 'Horas · acompanhamento', p.horas.acompanhamento, 0.5)}${num('h_avaliacao', 'Horas · avaliação', p.horas.avaliacao, 0.5)}
              ${num('km_por_litro', 'Carro: km por litro', p.km_por_litro, 0.5)}${num('preco_litro', 'Gasolina: R$ por litro', p.preco_litro, 0.01)}
              ${num('fator_estrada', 'Fator estrada (sobre a linha reta)', p.fator_estrada, 0.05)}${num('teto', 'Teto das ajudas de custo no projeto (R$)', p.teto || MQ.CUSTO_PADRAO.teto, 100)}</div>
            <p class="nota">Preço de referência: média da gasolina no país em set/2026 ficou perto de R$ 6,52 (ANP). Confira o preço do mês no estado.</p>
            <div class="aviso erro" data-erro hidden></div>
            ${souCoord ? '<div class="acoes"><button class="btn pri" type="submit">Salvar</button></div>' : ''}</form>
        </aside></div>`;
  }
  const num = (k, rot, v, passo) => `<div class="campo"><label for="cp-${k}">${rot}</label><input id="cp-${k}" name="${k}" type="number" min="0" step="${passo}" inputmode="decimal" value="${E(v)}"></div>`;
  function quadro(c) {
    return `<dl class="dl conta-dl"><dt>Trabalho</dt><dd class="num">${c.horas} h × ${brl(C.par.valor_hora)} = <b>${brl(c.trabalho)}</b></dd>
      <dt>Combustível</dt><dd class="num">${c.combustivel == null ? 'informe o km' : `ida e volta = <b>${brl(c.combustivel)}</b>`}</dd>
      <dt>Refeição</dt><dd class="num"><b>${brl(c.refeicao)}</b></dd>
      <dt class="tot">Total</dt><dd class="num tot"><b>${brl(c.total)}</b></dd></dl>`;
  }
  function linha({ v, k, c, p }) {
    const f = (S().fichas || []).find(x => x.id === v.ficha_id) || {};
    const feita = v.situacao === 'realizada';
    return `<div class="custo-l${feita ? '' : ' prev'}">
      <div class="cl-q"><b>${E(p.nome || '—')}</b> <span class="pil ${feita ? 'feito' : 'prev'}">${E(MQ.ETAPAS_CUSTO[v.etapa] || v.etapa)} · ${R.fmtData(v.data_realizada || v.data_prevista)}${feita ? '' : ' (prevista)'}</span>
        <span class="small muted">${E(p.municipio || 'município não informado')} → ${E(f.municipio || '')}/${E(v.uf)} · ${E(f.nome || '')}</span></div>
      <label class="cl-km"><span class="small muted">Km ida${k.fonte !== 'conferido' ? ` <i>(${E(k.fonte)})</i>` : ' <i>(conferido)</i>'}</span>
        <input type="number" min="0" max="999" inputmode="decimal" value="${k.fonte === 'conferido' ? k.km : ''}" placeholder="${k.km != null ? k.km : 'km'}" data-km="${E(v.id)}" aria-label="Km de ida da visita de ${E(p.nome || '')}" ${/^coord/.test(S().eu.papel) ? '' : 'disabled'}></label>
      <div class="cl-v num"><b>${brl(c.total)}</b><span class="small muted">${brl(c.trabalho)} + ${c.combustivel == null ? '—' : brl(c.combustivel)} + ${brl(c.refeicao)}</span></div></div>`;
  }

  function csv() {
    const vs = (S().visitas || []).filter(v => v.situacao === 'realizada' && mesDe(v.data_realizada) === C.mes);
    const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
    const n = x => x == null ? '' : String(Math.round(x * 100) / 100).replace('.', ',');
    const cab = ['Data', 'Pessoa', 'CPF', 'Papel', 'UF', 'Etapa', 'Município de partida', 'Município do quintal', 'Km ida', 'Origem do km', 'Horas', 'Trabalho (R$)', 'Combustível (R$)', 'Refeição (R$)', 'Total (R$)'];
    const linhas = vs.map(v => { const p = U().porId(v.executor_id) || {}; const f = (S().fichas || []).find(x => x.id === v.ficha_id) || {}; const k = kmIda(v); const c = calcular(v.etapa, k.km);
      return [R.fmtData(v.data_realizada), p.nome, R.fmtCPF(p.cpf || ''), (MQ.PAPEIS[p.papel] || {}).nome, v.uf, MQ.ETAPAS_CUSTO[v.etapa], p.municipio, f.municipio, k.km, k.fonte, c.horas, n(c.trabalho), n(c.combustivel), n(c.refeicao), n(c.total)].map(q).join(';'); });
    const blob = new Blob(['﻿' + [cab.map(q).join(';')].concat(linhas).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ajuda-de-custo-' + C.mes + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function clique(a, el) {
    if (a === 'custo-visao') { C.visao = el.dataset.v; C.plano = null; C.planoAtual = null; U().render(); return; }
    if (a === 'custo-plano-uf') { C.planoUF = el.dataset.uf; U().render(); return; }
    if (a === 'custo-plano-tudo') { C.planoTudo = el.dataset.v === '1'; C.plano = null; C.planoAtual = null; U().render(); return; }
    if (a === 'custo-medida') { C.medidas = Object.assign({}, C.medidas); const k = el.dataset.m;
      if (k === 'locais') C.medidas.locais = C.medidas.locais ? null : (C.teto && C.teto.longe); else C.medidas[k] = !C.medidas[k];
      C.plano = null; C.planoAtual = null; C.teto = null; U().render(); return; }
    if (a === 'custo-plano-csv') { csvPlano(); return; }
    if (a === 'custo-mes') { C.mes = somaMes(C.mes || mesHoje(), +el.dataset.n); U().render(); }
    else if (a === 'custo-csv') csv();
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'custo-par') {
      const v = k => Number(String(fd.get(k)).replace(',', '.'));
      const novo = { valor_hora: v('valor_hora'), refeicao: v('refeicao'), km_por_litro: v('km_por_litro'), preco_litro: v('preco_litro'), fator_estrada: v('fator_estrada'), teto: v('teto'),
        horas: { diagnostico: v('h_diagnostico'), implantacao: v('h_implantacao'), acompanhamento: v('h_acompanhamento'), avaliacao: v('h_avaliacao') } };
      const erros = {};
      [['valor_hora', 0, 500], ['refeicao', 0, 200], ['km_por_litro', 1, 60], ['preco_litro', 1, 20], ['fator_estrada', 1, 2], ['teto', 1000, 10000000]].forEach(([k, a, b]) => { if (!(novo[k] >= a && novo[k] <= b)) erros[k] = `Entre ${a} e ${b}.`; });
      Object.keys(novo.horas).forEach(k => { if (!(novo.horas[k] > 0 && novo.horas[k] <= 12)) erros['h_' + k] = 'Entre 0,5 e 12 horas.'; });
      if (Object.keys(erros).length) return U().mostrarErros(form, erros);
      await U().ocupado(form, async () => { C.par = Object.assign({}, MQ.CUSTO_PADRAO, await S().api.salvarParametros('custo_visita', novo)); C.plano = null; C.planoAtual = null; C.teto = null; U().render(); U().toast('Valores salvos.'); });
    }
  }
  // simulação e km: reagem ao digitar, sem recarregar a tela
  document.addEventListener('input', ev => {
    const f = ev.target.closest('form[data-form=custo-sim]');
    if (f) { const km = Number(String(f.km.value).replace(',', '.')); const box = $('#cs-res'); if (box) box.innerHTML = quadro(calcular(f.etapa.value, f.km.value === '' || !(km >= 0) ? null : km)); }
  });
  document.addEventListener('change', async ev => {
    const inp = ev.target.closest('input[data-km]'); if (!inp) return;
    const txt = String(inp.value).replace(',', '.').trim(); const km = txt === '' ? null : Number(txt);
    if (km != null && !(km >= 0 && km < 1000)) { U().toast('Distância inválida (0 a 999 km).'); return; }
    try {
      if (C.erro && /04_vitrine/.test(C.erro)) { C.km[inp.dataset.km] = km; if (km == null) delete C.km[inp.dataset.km]; }
      else { await S().api.salvarKm(inp.dataset.km, km); if (km == null) delete C.km[inp.dataset.km]; else C.km[inp.dataset.km] = km; }
      const y = window.scrollY; U().render(); window.scrollTo(0, y);
      U().toast(km == null ? 'Km apagado: volta a estimativa.' : 'Km conferido salvo.');
    } catch (e) { U().toast(e.message); }
  });


  /* =====================================================================
     Proposta de roteiro: quem visita cada quintal e em que viagens, para gastar menos.
     1. Cada quintal fica com a pessoa habilitada do estado que mora mais perto (com limite de carga,
        para ninguém ficar com o estado inteiro).
     2. As visitas da mesma etapa são agrupadas em viagens de um dia: sai de casa, passa por
        quintais vizinhos e volta, sem passar de 8 horas (visitas + deslocamento a 50 km/h).
     3. Compara com fazer cada visita numa viagem separada.
     ===================================================================== */
  const JORNADA_H = 8, KMH = 50;
  const ETAPAS_PLANO = [['diagnostico', 1], ['implantacao', 1], ['acompanhamento', 2], ['avaliacao', 1]];
  const JANELA = { diagnostico: [2, 5], implantacao: [5, 10], acompanhamento: [6, 12], avaliacao: [11, 13] };   // meses do projeto (1 = set/26), como nas metas
  const MESES_PROJ = ['set/26', 'out/26', 'nov/26', 'dez/26', 'jan/27', 'fev/27', 'mar/27', 'abr/27', 'mai/27', 'jun/27', 'jul/27', 'ago/27', 'set/27'];
  function origemDe(p) { return coordMun(p.uf, p.municipio); }
  const dist = (a, b) => linhaReta(a, b) * C.par.fator_estrada;
  // agente a contratar (simulação): mora na sede do município, mas as comunidades ficam longe dela; pelo menos 15 km por trecho
  const KM_MIN_LOCAL = 15;
  const dp = (p, x) => p.virtual ? Math.max(KM_MIN_LOCAL, dist(p.o, x)) : dist(p.o, x);

  /* medidas para caber no teto: 1 refeição por dia, avaliação com 1 hora, agente morando nos municípios distantes */
  C.medidas = C.medidas || {};
  function planejar(op) {
    op = op || { tudo: !!C.planoTudo, cont: !C.planoTudo };
    const med = op.medidas || C.medidas;
    const par = C.par; const fichas = S().fichas || []; const equipe = (S().equipe || []).filter(m => m.status === 'ativa' && R.habilitado(m) && R.ehCampo(m.papel));
    // feitas ou já marcadas no roteiro de campo: não entram de novo na proposta
    // índice das visitas por quintal (antes: cada consulta varria todas as visitas; com 1.000 visitas a aba travava)
    const visPorFicha = {}; (S().visitas || []).forEach(v => { if (v.situacao !== 'cancelada') (visPorFicha[v.ficha_id] = visPorFicha[v.ficha_id] || []).push(v); });
    const contaFeitas = (fid, et) => op.tudo ? 0 : (visPorFicha[fid] || []).filter(v => v.etapa === et).length;
    const semAgua = new Set((S().diagnosticos || []).filter(d => d.sem_agua).map(d => d.ficha_id));
    const mesAgora = (() => { const [a, m] = R.hoje().slice(0, 7).split('-').map(Number); return Math.max(1, (a - 2026) * 12 + m - 8); })();
    const res = { ufs: {}, semOrigem: [], semLocal: 0 };
    for (const { uf } of MQ.UFS) {
      const pessoas = equipe.filter(m => m.uf === uf).map(m => ({ m, o: origemDe(m), carga: 0 })).filter(x => { if (!x.o) res.semOrigem.push(x.m); return !!x.o; });
      // simulação: uma agente a contratar morando em cada município distante
      if (med.locais && med.locais[uf]) med.locais[uf].forEach(mun => { const o = coordMun(uf, mun);
        if (o) pessoas.push({ m: { id: 'local-' + uf + '-' + mun, nome: 'Agente a contratar em ' + mun, papel: 'agente', uf, municipio: mun }, o, carga: 0, virtual: true }); });
      const quintais = fichas.filter(f => f.uf === uf && f.resultado === 'selecionada' && f.situacao === 'aprovada').map(f => ({ f, d: destino({ ficha_id: f.id }) })).filter(q => { if (!q.d) res.semLocal++; return !!q.d; });
      const R0 = { uf, pessoas, quintais: quintais.length, viagens: [], visitas: 0, base: { km: 0, comb: 0, ref: 0, horas: 0 }, prop: { km: 0, comb: 0, ref: 0, horas: 0 }, porMes: {}, porPessoa: {} };
      res.ufs[uf] = R0;
      if (!pessoas.length || !quintais.length) continue;
      // 1. atribuição: mais perto, com teto de carga
      const teto = Math.ceil(quintais.length / pessoas.length * 1.6);
      const pares = []; quintais.forEach((q, qi) => pessoas.forEach((p, pi) => pares.push([dp(p, q.d), qi, pi])));
      pares.sort((a, b) => a[0] - b[0]); const dono = {};
      // quem já visitou (ou já tem visita marcada) continua com o mesmo quintal: a mulher conhece a pessoa
      if (op.cont) quintais.forEach((q, qi) => { const ult = (visPorFicha[q.f.id] || []).filter(v => v.executor_id)
          .sort((a, b) => String(b.data_realizada || b.data_prevista).localeCompare(String(a.data_realizada || a.data_prevista)))[0];
        const pi = ult ? pessoas.findIndex(p => p.m.id === ult.executor_id) : -1;
        if (pi >= 0) { dono[qi] = pi; pessoas[pi].carga++; R0.continua = (R0.continua || 0) + 1; } });
      for (const [, qi, pi] of pares) { if (dono[qi] != null || pessoas[pi].carga >= teto) continue; dono[qi] = pi; pessoas[pi].carga++; }
      R0.longe = {};   // municípios cujos quintais ficam longe de quem visita
      quintais.forEach((q, qi) => { if (dono[qi] == null) return; const km = dp(pessoas[dono[qi]], q.d); const k = q.f.municipio;
        (R0.longe[k] = R0.longe[k] || { mun: k, n: 0, km: 0 }); R0.longe[k].n++; R0.longe[k].km += km; });
      // 2. viagens por pessoa e etapa
      pessoas.forEach((p, pi) => {
        const meus = quintais.filter((q, qi) => dono[qi] === pi);
        R0.porPessoa[p.m.id] = { m: p.m, quintais: meus.length, viagens: 0, total: 0 };
        for (const [et, vezes] of ETAPAS_PLANO) for (let k = 0; k < vezes; k++) {
          let pend = meus.filter(q => contaFeitas(q.f.id, et) <= k && !(et !== 'diagnostico' && semAgua.has(q.f.id)));
          const h = et === 'avaliacao' && med.avalUmaHora ? 1 : +(par.horas[et] || 2);
          // linha de base: uma viagem por visita
          pend.forEach(q => { const km = 2 * dp(p, q.d); R0.base.km += km; R0.base.comb += km / par.km_por_litro * par.preco_litro; R0.base.ref += +par.refeicao; R0.base.horas += h; });
          // proposta: vizinho mais próximo, enquanto couber no dia
          while (pend.length) {
            let atual = p.o, horasDia = 0, kmDia = 0; const parada = [];
            while (pend.length) {
              let mi = 0, md = Infinity; pend.forEach((q, i) => { const dd = parada.length ? dist(atual, q.d) : dp(p, q.d); if (dd < md) { md = dd; mi = i; } });
              const volta = dp(p, pend[mi].d);
              const horasSe = horasDia + h + (kmDia + md + volta) / KMH;
              if (parada.length && horasSe > JORNADA_H) break;
              kmDia += md; horasDia += h; atual = pend[mi].d; parada.push(pend[mi]); pend.splice(mi, 1);
            }
            kmDia += dp(p, atual);
            const comb = kmDia / par.km_por_litro * par.preco_litro;
            const ref = med.refeicaoDia ? +par.refeicao : +par.refeicao * parada.length;
            const horasPag = parada.length * h;
            const v = { uf, pessoa: p.m, etapa: et, n: parada.length, quintais: parada.map(q => q.f), km: kmDia, comb, ref, horas: horasPag, total: comb + ref + horasPag * par.valor_hora };
            R0.viagens.push(v); R0.visitas += parada.length;
            R0.prop.km += kmDia; R0.prop.comb += comb; R0.prop.ref += ref; R0.prop.horas += horasPag;
            R0.porPessoa[p.m.id].viagens++; R0.porPessoa[p.m.id].total += v.total;
          }
        }
      });
      // 3. meses: espalha as viagens de cada etapa pela janela prevista nas metas
      for (const [et] of ETAPAS_PLANO) {
        const vs = R0.viagens.filter(v => v.etapa === et); const fim = Math.max(JANELA[et][1], mesAgora); const ini = Math.min(Math.max(JANELA[et][0], mesAgora), fim); const nM = fim - ini + 1;
        vs.forEach((v, i) => { const mes = ini + Math.floor(i * nM / vs.length); v.mes = mes; R0.porMes[mes] = (R0.porMes[mes] || 0) + v.total; });
      }
      R0.base.total = R0.base.comb + R0.base.ref + R0.base.horas * par.valor_hora;
      R0.prop.total = R0.prop.comb + R0.prop.ref + R0.prop.horas * par.valor_hora;
    }
    return res;
  }

  function planoHTML() {
    if (!C.par) return '<p class="carregando">' + MQ.ampulheta(true) + '</p>';
    const r = C.plano || (C.plano = planejar());
    const ufs = Object.values(r.ufs);
    const tot = k => ufs.reduce((s, u) => s + ((u[k] && u[k].total) || 0), 0);   // estado sem equipe ou sem quintal: conta 0
    const base = tot('base'), prop = tot('prop'), eco = base - prop;
    const nQ = ufs.reduce((s, u) => s + u.quintais, 0), nV = ufs.reduce((s, u) => s + u.visitas, 0), nT = ufs.reduce((s, u) => s + u.viagens.length, 0);
    const meses = {}; ufs.forEach(u => Object.entries(u.porMes).forEach(([m, v]) => { meses[m] = (meses[m] || 0) + v; }));
    const maxMes = Math.max(1, ...Object.values(meses));
    const uf = C.planoUF || (ufs.find(u => u.viagens.length) || {}).uf || 'PI'; const U0 = r.ufs[uf];
    return `<div class="cab"><div><span class="eyebrow">Planejamento</span><h1>Proposta de roteiro</h1>
        <p>Cada quintal fica com a pessoa habilitada do estado que mora mais perto, e as visitas da mesma etapa são juntadas em viagens de um dia (até ${JORNADA_H} horas contando o deslocamento). É uma proposta: a bolsista ajusta ao agendar.</p>
        <p class="small muted">Lê do sistema: equipe habilitada e município onde mora, fichas selecionadas e aprovadas (com GPS do diagnóstico quando houver), o roteiro de campo, os diagnósticos sem água (só recebem o diagnóstico) e os valores da aba Pagamento. Nenhum mês que já passou recebe custo.</p></div></div><!--nav-->
      ${r.semOrigem.length ? `<div class="aviso">Sem município de moradia conhecido, fora do cálculo: ${r.semOrigem.map(m => E(m.nome_social || m.nome)).join(', ')}. Corrija o município no cadastro.</div>` : ''}
      ${r.semLocal ? `<div class="aviso">${r.semLocal} quintal(is) sem localização (nem GPS, nem município do mapa) ficaram fora.</div>` : ''}
      <div class="escolha" role="group" aria-label="O que calcular">
        <button type="button" data-acao="custo-plano-tudo" data-v="0" aria-pressed="${!C.planoTudo}"><b>Só o que falta agendar</b><span>Visitas que ainda não estão no roteiro de campo. Quem já visita um quintal continua com ele.</span></button>
        <button type="button" data-acao="custo-plano-tudo" data-v="1" aria-pressed="${!!C.planoTudo}"><b>Projeto inteiro</b><span>As 5 visitas de todos os quintais aprovados (com a avaliação final), do zero: o custo total planejado.</span></button>
      </div>
      ${(() => { if (!C.planoTudo) return ''; const at = C.planoAtual || (C.planoAtual = planejar({ tudo: true, cont: true }));
        const va = Object.values(at.ufs).reduce((s, u) => s + (u.prop.total || 0), 0); const n = Object.values(at.ufs).reduce((s, u) => s + (u.continua || 0), 0);
        if (!n || va - prop < 1) return '';
        return `<div class="aviso"><b>Quem visita hoje custa mais.</b> Mantendo a pessoa que já visita cada quintal (${n} quintais), o projeto inteiro sai por <b>${brl(va)}</b>, ${brl(va - prop)} a mais que redistribuindo por proximidade. Trocar quem visita tem custo humano (a mulher já conhece a pessoa); vale ao menos nos casos mais distantes.</div>`; })()}
      ${!C.planoTudo && !nV && nQ ? '<div class="aviso">Todas as visitas dos quintais aprovados já estão feitas ou marcadas no roteiro de campo. Veja <b>Projeto inteiro</b> para o custo total planejado.</div>' : ''}
      <div class="resumo">
        <div><span class="v num">${brl(prop)}</span><span class="l">custo previsto com a proposta (${nV} visitas em ${nT} viagens)</span></div>
        <div><span class="v num">${brl(base)}</span><span class="l">se cada visita fosse uma viagem</span></div>
        <div><span class="v num" style="color:var(--ok)">${brl(eco)}</span><span class="l">economia (${base ? Math.round(eco / base * 100) : 0}%)</span></div>
        <div><span class="v num">${nQ ? brl(prop / nQ) : '—'}</span><span class="l">por quintal, nas ${ETAPAS_PLANO.reduce((s, e) => s + e[1], 0)} visitas</span></div></div>
      ${blocoTeto()}
      <div class="acoes">        <button class="btn peq" data-acao="custo-plano-csv">Baixar CSV</button></div>
      <section class="secao"><h2>Por estado</h2><div class="quadro-scroll" style="display:block"><table class="quadro tab-plano"><thead><tr>
          <th>Estado</th><th>Quintais</th><th>Visitas</th><th>Viagens</th><th>Km</th><th>Combustível</th><th>Refeição</th><th>Horas pagas</th><th>Total</th><th>Sem agrupar</th></tr></thead><tbody>
        ${ufs.map(u => `<tr class="${u.visitas ? '' : 'vazia'}"><td><button class="link" data-acao="custo-plano-uf" data-uf="${u.uf}"><span class="so-largo">${E(U().nomeUF(u.uf))}</span><span class="so-cel">${u.uf}</span></button></td><td>${u.quintais}</td><td>${u.visitas}</td><td>${u.viagens.length}</td>
          <td>${fmtN(u.prop.km)}</td><td>${brl(u.prop.comb)}</td><td>${brl(u.prop.ref)}</td><td>${brl(u.prop.horas * C.par.valor_hora)}</td>
          <td><b>${brl(u.prop.total || 0)}</b></td><td class="muted">${brl(u.base.total || 0)}</td></tr>`).join('')}
        <tr class="tot"><td><b>Total</b></td><td>${nQ}</td><td>${nV}</td><td>${nT}</td><td>${fmtN(ufs.reduce((s, u) => s + u.prop.km, 0))}</td>
          <td>${brl(ufs.reduce((s, u) => s + u.prop.comb, 0))}</td><td>${brl(ufs.reduce((s, u) => s + u.prop.ref, 0))}</td><td>${brl(ufs.reduce((s, u) => s + u.prop.horas, 0) * C.par.valor_hora)}</td>
          <td><b>${brl(prop)}</b></td><td class="muted">${brl(base)}</td></tr></tbody></table></div><p class="dica-cols">No celular aparecem só as colunas principais. A tabela completa aparece no computador ou com o celular deitado.</p></section>
      <section class="secao"><h2>Por mês</h2><p class="small muted">As viagens de cada etapa espalhadas pelo período das metas: diagnóstico out–jan, implantação jan–jun, acompanhamentos fev–ago, avaliação final jul–set.</p>
        <div class="barras-mes">${MESES_PROJ.map((nm, i) => { const v = meses[i + 1] || 0; return `<div class="bm"><span class="bm-v num">${v ? brl(v).replace(',00', '') : ''}</span><span class="bm-b"><i style="height:${Math.round(v / maxMes * 100)}%"></i></span><span class="bm-l">${nm}</span></div>`; }).join('')}</div></section>
      <section class="secao"><div class="secao-cab"><h2>${E(U().nomeUF(uf))}: quem visita e as viagens</h2>
          <span class="seg" role="group">${MQ.UFS.map(u => `<button type="button" data-acao="custo-plano-uf" data-uf="${u.uf}" aria-pressed="${u.uf === uf}">${u.uf}</button>`).join('')}</span></div>
        ${U0 && U0.pessoas.length ? `<div class="grade-uf">${Object.values(U0.porPessoa).map(x => `<div class="bloco"><b>${E(x.m.nome_social || x.m.nome)}</b>
            <span class="small muted">${E((MQ.PAPEIS[x.m.papel] || {}).nome)} · mora em ${E(x.m.municipio || '—')}</span>
            <span>${x.quintais} quintais · ${x.viagens} viagens · <b>${brl(x.total)}</b></span></div>`).join('')}</div>
          ${(() => { const l = Object.values(U0.longe || {}).map(x => Object.assign(x, { med: x.km / x.n })).filter(x => x.med > 50).sort((a, b) => b.med - a.med);
              return l.length ? `<div class="aviso"><b>Onde vale ter alguém morando perto:</b> ${l.map(x => `${E(x.mun)} (${x.n} quintais, ${fmtN(x.med)} km de quem visita)`).join(' · ')}.
                Cada ida e volta a mais de 50 km custa, por visita, cerca de ${brl(2 * 50 / C.par.km_por_litro * C.par.preco_litro)} ou mais só de combustível. Uma agente de campo desses municípios reduziria o custo.</div>` : ''; })()}
          <details class="hist"><summary>Ver as ${U0.viagens.length} viagens</summary><ol class="viagens">${U0.viagens.slice().sort((a, b) => a.mes - b.mes).map(v =>
            `<li><span class="small muted">${MESES_PROJ[v.mes - 1]} · ${E(MQ.ETAPAS_CUSTO[v.etapa])}</span><b>${E(v.pessoa.nome_social || v.pessoa.nome)}</b>: ${v.n} quinta${v.n > 1 ? 'is' : 'l'} (${E([...new Set(v.quintais.map(f => f.municipio))].join(', '))}) · ${fmtN(v.km)} km · ${brl(v.total)}</li>`).join('')}</ol></details>`
          : '<p class="muted">Sem pessoas habilitadas com município conhecido, ou sem quintais selecionados neste estado.</p>'}</section>
      <p class="nota">Estimativa: distância em linha reta × ${String(C.par.fator_estrada).replace('.', ',')} a partir do município onde a pessoa mora (o endereço completo ainda não entra no cálculo), ${KMH} km/h de média, carro a ${String(C.par.km_por_litro).replace('.', ',')} km/L e gasolina a ${brl(C.par.preco_litro)}. Horas pagas iguais nas duas contas; o deslocamento não é pago como hora.</p>`;
  }
  const fmtN = n => Math.round(n).toLocaleString('pt-BR');
  /* ---------- caber no teto do orçamento (sempre sobre o projeto inteiro) ---------- */
  function blocoTeto() {
    const teto = +(C.par.teto || MQ.CUSTO_PADRAO.teto);
    const tot = r => Object.values(r.ufs).reduce((s, u) => s + ((u.prop && u.prop.total) || 0), 0);
    if (!C.teto) {
      const base = planejar({ tudo: true, cont: false, medidas: {} });
      const longe = {}; Object.values(base.ufs).forEach(u => { const l = Object.values(u.longe || {}).filter(x => x.km / x.n > 50).map(x => x.mun); if (l.length) longe[u.uf] = l; });
      const nLonge = Object.values(longe).reduce((s, l) => s + l.length, 0);
      const com = m => tot(planejar({ tudo: true, cont: false, medidas: m }));
      const t0 = tot(base);
      const escolha = { refeicaoDia: !!C.medidas.refeicaoDia, avalUmaHora: !!C.medidas.avalUmaHora, locais: C.medidas.locais ? longe : null };
      C.teto = { t0, longe, nLonge,
        med: [['refeicaoDia', 'Pagar 1 refeição por dia de viagem, não por visita', com({ refeicaoDia: true }), 'Muda a regra de pagamento: combinar com a equipe antes.'],
          ['avalUmaHora', 'Avaliação final com 1 hora, não 2', com({ avalUmaHora: true }), 'O questionário leva cerca de 1 hora com a equipe treinada.'],
          ['locais', `Agente de campo morando nos ${nLonge} município${nLonge === 1 ? '' : 's'} mais distante${nLonge === 1 ? '' : 's'}`, nLonge ? com({ locais: longe }) : t0,
            nLonge ? 'Conta com pelo menos 15 km por trecho até a comunidade. Recrutar e formar no FIC agentes em: ' + Object.entries(longe).map(([uf, l]) => l.join(', ') + ' (' + uf + ')').join('; ') + '.' : 'Nenhum município com quintais a mais de 50 km de quem visita.']],
        todas: com({ refeicaoDia: true, avalUmaHora: true, locais: nLonge ? longe : null }),
        escolhidas: Object.values(escolha).some(Boolean) ? com(escolha) : t0 };
    }
    const T = C.teto; const ok = v => v <= teto;
    const st = v => ok(v) ? `<span class="chip ok">dentro do teto · sobram ${brl(teto - v)}</span>` : `<span class="chip crit">acima do teto em ${brl(v - teto)}</span>`;
    return `<div class="bloco teto"><div class="teto-cab"><div><h3>Caber no orçamento</h3><p class="small muted">Projeto inteiro (5 visitas por quintal). Teto: <b>${brl(teto)}</b>, ajustável em Pagamento do mês → Valores usados.</p></div>
        <div class="teto-v"><span class="num">${brl(T.escolhidas)}</span>${st(T.escolhidas)}</div></div>
      <p class="small">Sem nenhuma medida: <b>${brl(T.t0)}</b>. Marque as medidas para ver o efeito (a proposta abaixo passa a usá-las):</p>
      <div class="teto-med">${T.med.map(([k, t, v, obs]) => `<label class="tm"><input type="checkbox" data-acao="custo-medida" data-m="${k}" ${C.medidas[k] ? 'checked' : ''} ${k === 'locais' && !T.nLonge ? 'disabled' : ''}>
          <span><b>${E(t)}</b><span class="small muted">${E(obs)}</span></span><span class="num tm-v">− ${brl(Math.max(0, T.t0 - v))}</span></label>`).join('')}</div>
      <p class="small">As três juntas: <b>${brl(T.todas)}</b> ${st(T.todas)}</p>
      <p class="nota">Distâncias estimadas pelo município de quem visita. Com a equipe real cadastrada (cidade de cada uma), o valor muda: refaça a conta depois dos cadastros.</p></div>`;
  }

  function csvPlano() {
    const r = C.plano || (C.plano = planejar());
    const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; const n = x => String(Math.round(x * 100) / 100).replace('.', ',');
    const cab = ['Estado', 'Mês', 'Etapa', 'Pessoa', 'Função', 'Quintais na viagem', 'Municípios', 'Km', 'Combustível (R$)', 'Refeição (R$)', 'Horas (R$)', 'Total (R$)'];
    const linhas = Object.values(r.ufs).flatMap(u => u.viagens.map(v => [u.uf, MESES_PROJ[v.mes - 1], MQ.ETAPAS_CUSTO[v.etapa], v.pessoa.nome, (MQ.PAPEIS[v.pessoa.papel] || {}).nome, v.n,
      [...new Set(v.quintais.map(f => f.municipio))].join(', '), n(v.km), n(v.comb), n(v.ref), n(v.horas * C.par.valor_hora), n(v.total)].map(q).join(';')));
    const blob = new Blob(['﻿' + [cab.map(q).join(';')].concat(linhas).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'proposta-roteiro.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  MQ.custosUI = { aba, clique, enviar, calcular: (etapa, km) => { C.par = C.par || Object.assign({}, MQ.CUSTO_PADRAO); return calcular(etapa, km); },
    // usados na solicitação de pagamento (mesmo cálculo do Pagamento do mês)
    garantir: async () => { if (!C.carregado) await carregar(); },
    pronto: () => C.carregado,
    custoVisita: v => { C.par = C.par || Object.assign({}, MQ.CUSTO_PADRAO); C.km = C.km || {}; const k = kmIda(v); return Object.assign(calcular(v.etapa, k.km), { km: k.km, fonte: k.fonte }); } };
})();
