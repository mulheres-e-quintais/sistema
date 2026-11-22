/* Mulheres & Quintais — simulação em ESCALA (21/11/2026, pedido do usuário: "simulação com 20.000 quintais em todo o Nordeste,
   para mostrar o sistema atual com capacidade de 20.000"). Só na página simulacao.html com ?escala=20000; nunca no sistema de verdade.
   Multiplica os dados da simulação (MQ.SIM_FIM, 200 quintais em 5 estados) em blocos de 40 quintais pelos nove estados do Nordeste,
   repartidos pela ÁREA de cada estado (pedido do usuário, 21/11/2026: "faça proporcionalidade por tamanho do estado"; área do IBGE,
   referência 2025): cada bloco leva os 60 cadastros de um estado do plano (40 quintais), as visitas, diagnósticos, avaliações, custos,
   orientações de venda, pedidos de pagamento e entregas, com duas agentes de campo novas; cada estado tem uma articulação e um apoio.
   As metas, o orçamento e as vagas de cada estado acompanham. Tudo inventado e marcado como exemplo. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search); const N = +q.get('escala');
  /* só as escalas da faixa (auditoria de 22/11/2026: escala=10000000 derrubava a aba de quem abrisse o link; negativo virava 200 "em escala") */
  if (![1000, 5000, 10000, 20000].includes(N) || !window.MQ || !MQ.SIM_FIM) return;
  const K = Math.max(1, Math.round(N / 200));
  const NE = [['AL', 'Alagoas'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['MA', 'Maranhão'], ['PB', 'Paraíba'], ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RN', 'Rio Grande do Norte'], ['SE', 'Sergipe']];
  /* municípios dos quatro estados que não estão no plano, com o ponto aproximado da sede (lon, lat) para o mapa */
  const PONTOS = {
    CE: { 'Russas': [-37.976, -4.940], 'Limoeiro do Norte': [-38.098, -5.146], 'Quixadá': [-39.015, -4.971], 'Crateús': [-40.678, -5.178],
      'Iguatu': [-39.299, -6.359], 'Tauá': [-40.293, -6.003], 'Aracati': [-37.770, -4.562], 'Itapipoca': [-39.578, -3.494] },
    MA: { 'Codó': [-43.886, -4.455], 'Caxias': [-43.356, -4.859], 'Bacabal': [-44.780, -4.225], 'Pedreiras': [-44.600, -4.570],
      'Chapadinha': [-43.354, -3.742], 'Barra do Corda': [-45.243, -5.506], 'Grajaú': [-46.139, -5.819], 'Itapecuru Mirim': [-44.359, -3.392] },
    PB: { 'Sousa': [-38.229, -6.759], 'Cajazeiras': [-38.558, -6.889], 'Patos': [-37.280, -7.025], 'Pombal': [-37.801, -6.770],
      'Catolé do Rocha': [-37.746, -6.344], 'Monteiro': [-37.120, -7.889], 'Princesa Isabel': [-37.993, -7.737], 'Esperança': [-35.858, -7.023] },
    RN: { 'Apodi': [-37.799, -5.664], 'Caraúbas': [-37.556, -5.784], 'Pau dos Ferros': [-38.204, -6.109], 'Umarizal': [-37.818, -5.982],
      'Caicó': [-37.097, -6.458], 'Currais Novos': [-36.517, -6.260], 'Assu': [-36.909, -5.577], 'João Câmara': [-35.820, -5.537] } };
  const MUN = Object.fromEntries(Object.entries(PONTOS).map(([uf, o]) => [uf, Object.keys(o)]));
  /* o mapa (js/geo.js, depois deste arquivo) recebe esses pontos: MQ.GEO passa por um guardião que acrescenta os quatro estados */
  { let g; Object.defineProperty(MQ, 'GEO', { configurable: true, enumerable: true, get: () => g,
    set: x => { g = x; if (x && x.mun) for (const [uf, o] of Object.entries(PONTOS)) x.mun[uf] = Object.assign({}, o, x.mun[uf] || {}); } }); }
  const d = MQ.SIM_FIM; const UFS0 = ['AL', 'BA', 'PE', 'PI', 'SE'];
  /* id novo: troca 4 letras do meio por "c" e o número da cópia. O original tem ali 8, 9, a ou b (variante do uuid), então a cópia
     nunca repete o original (auditoria de 22/11/2026: com "8" + número, a cópia nº 251 de um código "80fb…" repetia o original) */
  const nid = (id, c) => c ? id.slice(0, 19) + 'c' + c.toString(16).padStart(3, '0') + id.slice(23) : id;
  const dv = s => { let t = 0; for (let i = 0; i < s.length; i++) t += +s[i] * (s.length + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  const cpf = n => { let s = String(n).padStart(9, '0').slice(-9); s += dv(s); return s + dv(s); };
  const ativo = m => m.status === 'ativa';
  /* área de cada estado em km² (IBGE, Área territorial, referência 2025) e quantos blocos de 40 quintais cabem a cada um (maiores restos) */
  const AREA = { AL: 27830.661, BA: 564760.429, CE: 148894.444, MA: 329651.478, PB: 56467.242, PE: 98067.879, PI: 251755.499, RN: 52809.599, SE: 21938.188 };
  const B = K * 5, somaA = Object.values(AREA).reduce((a, b) => a + b, 0);
  const cota = Object.entries(AREA).map(([uf, a]) => ({ uf, q: B * a / somaA })).map(x => Object.assign(x, { n: Math.max(1, Math.floor(x.q)) }));
  for (let falta = B - cota.reduce((t, x) => t + x.n, 0); falta > 0; falta--) cota.sort((a, b) => (b.q - b.n) - (a.q - a.n))[0].n++;
  const blocos = Object.fromEntries(cota.map(x => [x.uf, x.n]));
  const bols = {}; d.equipe.filter(m => ativo(m) && (m.papel === 'articulacao' || m.papel === 'apoio')).forEach(m => { bols[m.papel + m.uf] = m; });
  const novos = { equipe: [], fichas: [], visitas: [], diagnosticos: [], avaliacoes: [], custos: [], orientacoesVenda: [], solicitacoes: [], entregas: [], privado: {}, solic_visitas: {} };
  let kcpf = 0;
  /* nos cinco estados do plano, os municípios do próprio plano (as fichas da simulação), para não amontoar tudo em poucos */
  const munPlano = uf => [...new Set(d.fichas.filter(f => f.uf === uf && f.municipio).map(f => f.municipio))];
  const ponto = (uf, nome) => (PONTOS[uf] && PONTOS[uf][nome]) || null;
  /* o que cada estado do plano tem (a fonte de cada bloco) */
  const visDe = {}; d.visitas.forEach(v => { (visDe[v.uf] = visDe[v.uf] || new Set()).add(v.id); });
  const ag = new Set(d.equipe.filter(m => m.papel === 'agente').map(m => m.id));
  const agUf = {}; d.equipe.filter(m => m.papel === 'agente').forEach(m => { agUf[m.id] = m.uf; });
  /* a lista dos blocos novos: os cinco estados do plano já têm um (os dados de verdade da simulação) */
  const lista = []; for (const [uf] of NE) for (let k = UFS0.includes(uf) ? 1 : 0; k < blocos[uf]; k++) lista.push(uf);
  lista.forEach((uf, b) => {
    const c = b + 1, uf0 = UFS0[b % 5], mapa = new Map();
    for (const papel of ['articulacao', 'apoio']) {   /* bolsistas do estado: as de verdade nos cinco do plano; nos outros quatro, uma vez */
      const o = bols[papel + uf0]; if (!o) continue;
      if (!bols[papel + uf]) { const n = Object.assign({}, o, { id: nid(o.id, c), uf, nome: o.nome.split(' ')[0] + ' ' + (papel === 'apoio' ? 'Apoio' : 'Articulação') + ' ' + uf + ' (exemplo)',
        cpf: cpf(610000000 + (++kcpf)), email: papel + '.' + uf.toLowerCase() + '@exemplo.invalid', user_id: null, exemplo: true });
        bols[papel + uf] = n; novos.equipe.push(n); }
      mapa.set(o.id, bols[papel + uf].id);
    }
    d.equipe.filter(m => m.papel === 'agente' && m.uf === uf0).forEach((m, j) => {
      const n = Object.assign({}, m, { id: nid(m.id, c), uf, cpf: cpf(620000000 + (++kcpf)), email: 'agente' + c + '.' + j + '.' + uf.toLowerCase() + '@exemplo.invalid',
        nome: m.nome.split(' ')[0] + ' ' + (m.nome.split(' ').slice(-1)[0]) + ' ' + uf + '-' + c, user_id: null, exemplo: true });
      mapa.set(m.id, n.id); novos.equipe.push(n); if (d.privado && d.privado[m.id]) novos.privado[n.id] = Object.assign({}, d.privado[m.id], { equipe_id: n.id });
    });
    const id = x => (x && mapa.get(x)) || x;
    const daFonte = x => x.uf === uf0;
    d.fichas.filter(daFonte).forEach((f, i) => { const n = Object.assign({}, f, { id: nid(f.id, c), uf, cpf: cpf(800000000 + c * 1000 + i),
      nome: f.nome.replace(/\s*\(.*\)$/, '') + ' ' + uf + '-' + c, bolsista_id: id(f.bolsista_id), criado_por: id(f.criado_por), exemplo: true });
      const ms = MUN[uf] || munPlano(uf); if (ms.length) n.municipio = ms[(i + c * 3) % ms.length];
      const pt = ponto(uf, n.municipio); if (pt && n.latitude != null) { n.latitude = +(pt[1] + ((i * 37 + c * 11) % 21 - 10) * 0.004).toFixed(5); n.longitude = +(pt[0] + ((i * 23 + c * 7) % 21 - 10) * 0.004).toFixed(5); }
      mapa.set(f.id, n.id); novos.fichas.push(n); });
    d.visitas.filter(daFonte).forEach(v => { const n = Object.assign({}, v, { id: nid(v.id, c), ficha_id: id(v.ficha_id), uf, executor_id: id(v.executor_id), criado_por: id(v.criado_por) });
      mapa.set(v.id, n.id); novos.visitas.push(n); });
    d.diagnosticos.filter(daFonte).forEach(x => novos.diagnosticos.push(Object.assign({}, x, { id: nid(x.id, c), ficha_id: id(x.ficha_id), visita_id: id(x.visita_id), uf, executor_id: id(x.executor_id),
      codigo_quintal: x.codigo_quintal ? uf + '-' + c + '-' + x.codigo_quintal.split('-').pop() : x.codigo_quintal })));
    d.avaliacoes.filter(daFonte).forEach(x => novos.avaliacoes.push(Object.assign({}, x, { id: nid(x.id, c), ficha_id: id(x.ficha_id), visita_id: id(x.visita_id), uf, executor_id: id(x.executor_id) })));
    d.custos.filter(x => visDe[uf0] && visDe[uf0].has(x.visita_id)).forEach(x => novos.custos.push(Object.assign({}, x, { visita_id: id(x.visita_id) })));
    (d.orientacoesVenda || []).filter(daFonte).forEach(x => novos.orientacoesVenda.push(Object.assign({}, x, { id: nid(x.id, c), ficha_id: id(x.ficha_id), uf, feito_por: id(x.feito_por) })));
    /* pagamentos e entregas: só os das agentes da fonte (as bolsistas são as mesmas em todos os blocos do estado) */
    const daAgente = x => ag.has(x.equipe_id) && agUf[x.equipe_id] === uf0;
    (d.solicitacoes || []).filter(daAgente).forEach(x => { const n = Object.assign({}, x, { id: nid(x.id, c), equipe_id: id(x.equipe_id) }); mapa.set(x.id, n.id); novos.solicitacoes.push(n); });
    for (const [v, sl] of Object.entries(d.solic_visitas || {})) if (mapa.has(sl)) novos.solic_visitas[id(v)] = id(sl);   /* visita → pedido de pagamento */
    (d.entregas || []).filter(daAgente).forEach(x => novos.entregas.push(Object.assign({}, x, { equipe_id: id(x.equipe_id) })));
  });
  for (const k of Object.keys(novos)) { if (Array.isArray(novos[k])) d[k] = (d[k] || []).concat(novos[k]); else d[k] = Object.assign(d[k] || {}, novos[k]); }

  /* plano na mesma proporção: nove estados, metas, orçamento e rubricas × K. Este arquivo roda antes do tudo.js, que define o plano
     (js/dados.js): cada valor fica num "guardião" — a lista de estados e as metas por estado são as da escala, e as metas e o
     orçamento que o dados.js grava passam pela multiplicação */
  /* vagas de cada estado: os blocos dele × 40 (MQ.vagas(uf), no js/dados.js, lê daqui) */
  const vagasPorUf = Object.fromEntries(Object.entries(blocos).map(([uf, n]) => [uf, n * 40]));
  const porUf = Math.round(K * 200 / 9);
  const vezes = o => { if (Array.isArray(o)) o.forEach(vezes); else if (o && typeof o === 'object') for (const k of Object.keys(o)) {
    if (typeof o[k] === 'number' && /^(total|valor|alvo|previsto|qtd|quantidade)$/.test(k)) o[k] *= K; else if (typeof o[k] === 'object') vezes(o[k]); } };
  const fixo = (nome, v) => Object.defineProperty(MQ, nome, { configurable: true, enumerable: true, get: () => v, set: () => {} });
  /* as metas que dependem do número de quintais (diagnósticos, implantação, visitas) crescem; as outras (meses de equipe, eventos,
     intercâmbio, missões, relatório) ficam como no plano, porque os dados delas não foram multiplicados */
  const multiplicado = (nome, so) => { const mult = x => { if (so && Array.isArray(x)) x.filter(so).forEach(vezes); else vezes(x); };
    let v = MQ[nome]; if (v) mult(v); Object.defineProperty(MQ, nome, { configurable: true, enumerable: true, get: () => v, set: x => { mult(x); v = x; } }); };
  fixo('UFS', NE.map(([uf, nome]) => ({ uf, nome })));
  fixo('META_UF', { diagnosticos: porUf, quintais: porUf, visitas: porUf * 2 });
  fixo('VAGAS_UF', porUf); fixo('DIAS_CAMPO_UF', porUf * 5); fixo('VAGAS_POR_UF', vagasPorUf);
  multiplicado('METAS', m => ['diagnostico', 'implantacao', 'visitas'].includes(m.fonte));
  /* orçamento (pedidos do usuário, 21/11/2026: "é 10 mil por quintal" e "aumente valores das rubricas por proporcionalidade"): o plano
     custa R$ 2 milhões para 200 quintais (R$ 10.000 por quintal); na escala, cada item e cada rubrica crescem na mesma proporção (× K),
     o total fica em R$ 10.000 por quintal e o item quintais continua R$ 5.000 por quintal. Repasses, cronograma mensal e a planilha de
     gastos da simulação acompanham. A memória de cálculo de cada item diz que foi multiplicada. */
  const ajustar = o => { if (!o || !Array.isArray(o.rubricas) || o._escala) return;
    o.rubricas.forEach(rb => { rb.itens.forEach(i => { i.total = Math.round(i.total * K * 100) / 100; if (i.calc) i.calc += ` · × ${K} na simulação`; });
      if (typeof rb.total === 'number') rb.total = rb.itens.reduce((t, i) => t + i.total, 0); });
    o.total = Math.round(o.rubricas.reduce((t, rb) => t + rb.itens.reduce((u, i) => u + i.total, 0), 0) * 100) / 100;
    (o.repasses || []).forEach(x => { x.valor = Math.round(x.valor * K * 100) / 100; });
    if (o.cronograma && Array.isArray(o.cronograma.meses)) o.cronograma.meses = o.cronograma.meses.map(v => Math.round(v * K * 100) / 100);
    (d.execPlanilhas || []).forEach(pl => { (pl.linhas || []).forEach(l => { l.valor = Math.round((+l.valor || 0) * K * 100) / 100; });
      pl.total_gasto = Math.round(pl.linhas.filter(l => l.item !== 'repasse_mda').reduce((t, l) => t + l.valor, 0) * 100) / 100;
      pl.total_recebido = Math.round(pl.linhas.filter(l => l.item === 'repasse_mda').reduce((t, l) => t + l.valor, 0) * 100) / 100; });
    Object.defineProperty(o, '_escala', { value: true }); };
  { let v = MQ.ORCAMENTO; ajustar(v); Object.defineProperty(MQ, 'ORCAMENTO', { configurable: true, enumerable: true, get: () => v, set: x => { ajustar(x); v = x; } }); }
  MQ.ESCALA = { quintais: K * 200, estados: 9, fator: K, porArea: true, vagas: vagasPorUf };
})();
