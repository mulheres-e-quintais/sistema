/* Mulheres & Quintais — simulação em ESCALA (21/11/2026, pedido do usuário: "simulação com 20.000 quintais em todo o Nordeste,
   para mostrar o sistema atual com capacidade de 20.000"). Só na página simulacao.html com ?escala=20000; nunca no sistema de verdade.
   Multiplica os dados da simulação (MQ.SIM_FIM, 200 quintais em 5 estados) por 100, espalhados pelos nove estados do Nordeste:
   cada cópia leva os 60 cadastros de um estado (40 quintais), as visitas, diagnósticos, avaliações, custos, orientações de venda,
   pedidos de pagamento e entregas, com duas agentes de campo novas; cada estado tem uma articulação e um apoio. As metas, o
   orçamento e as bolsas do plano são multiplicados na mesma proporção. Tudo inventado e marcado como exemplo. */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search); const N = +q.get('escala');
  if (!N || !window.MQ || !MQ.SIM_FIM) return;
  const K = Math.max(1, Math.round(N / 200));
  const NE = [['AL', 'Alagoas'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['MA', 'Maranhão'], ['PB', 'Paraíba'], ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RN', 'Rio Grande do Norte'], ['SE', 'Sergipe']];
  const MUN = { CE: ['Russas', 'Limoeiro do Norte', 'Quixadá', 'Crateús', 'Iguatu', 'Tauá', 'Aracati', 'Itapipoca'],
    MA: ['Codó', 'Caxias', 'Bacabal', 'Pedreiras', 'Chapadinha', 'Barra do Corda', 'Grajaú', 'Itapecuru Mirim'],
    PB: ['Sousa', 'Cajazeiras', 'Patos', 'Pombal', 'Catolé do Rocha', 'Monteiro', 'Princesa Isabel', 'Esperança'],
    RN: ['Apodi', 'Caraúbas', 'Pau dos Ferros', 'Umarizal', 'Caicó', 'Currais Novos', 'Assu', 'João Câmara'] };
  const d = MQ.SIM_FIM; const UFS0 = ['AL', 'BA', 'PE', 'PI', 'SE'];
  /* id novo: troca 4 letras do meio pelo número da cópia (continua no formato uuid, sem repetir) */
  const nid = (id, c) => c ? id.slice(0, 19) + (c + 0x8000).toString(16).slice(-4) + id.slice(23) : id;
  const dv = s => { let t = 0; for (let i = 0; i < s.length; i++) t += +s[i] * (s.length + 1 - i); const r = (t * 10) % 11; return r === 10 ? 0 : r; };
  const cpf = n => { let s = String(n).padStart(9, '0').slice(-9); s += dv(s); return s + dv(s); };
  const ativo = m => m.status === 'ativa';
  /* estado de cada cópia: a cópia c do estado j vai para NE[(j + 5c) % 9] (a cópia 0 é a de verdade) */
  const ufDe = (uf0, c) => c ? NE[(UFS0.indexOf(uf0) + 5 * c) % 9][0] : uf0;
  const bols = {}; d.equipe.filter(m => ativo(m) && (m.papel === 'articulacao' || m.papel === 'apoio')).forEach(m => { bols[m.papel + m.uf] = m; });
  const novos = { equipe: [], fichas: [], visitas: [], diagnosticos: [], avaliacoes: [], custos: [], orientacoesVenda: [], solicitacoes: [], entregas: [], privado: {}, solic_visitas: {} };
  let kcpf = 0;
  for (let c = 1; c < K; c++) {
    const mapa = new Map();
    for (const uf0 of UFS0) {
      const uf = ufDe(uf0, c);
      /* bolsistas do estado: as de verdade nos cinco estados; nos outros quatro, copiadas uma vez */
      for (const papel of ['articulacao', 'apoio']) {
        const o = bols[papel + uf0];
        if (!o) continue;
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
    }
    const id = x => (x && mapa.get(x)) || x;
    const doEstado = x => UFS0.includes(x.uf);
    d.fichas.filter(doEstado).forEach((f, i) => { const uf = ufDe(f.uf, c); const n = Object.assign({}, f, { id: nid(f.id, c), uf, cpf: cpf(800000000 + c * 1000 + i),
      nome: f.nome.replace(/\s*\(.*\)$/, '') + ' ' + uf + '-' + c, bolsista_id: id(f.bolsista_id), criado_por: id(f.criado_por), exemplo: true });
      if (MUN[uf]) n.municipio = MUN[uf][i % 8]; mapa.set(f.id, n.id); novos.fichas.push(n); });
    const uf = x => ufDe(x.uf, c);
    d.visitas.forEach(v => { const n = Object.assign({}, v, { id: nid(v.id, c), ficha_id: id(v.ficha_id), uf: uf(v), executor_id: id(v.executor_id), criado_por: id(v.criado_por) });
      mapa.set(v.id, n.id); novos.visitas.push(n); });
    d.diagnosticos.forEach(x => novos.diagnosticos.push(Object.assign({}, x, { id: nid(x.id, c), ficha_id: id(x.ficha_id), visita_id: id(x.visita_id), uf: uf(x), executor_id: id(x.executor_id),
      codigo_quintal: x.codigo_quintal ? uf(x) + '-' + c + '-' + x.codigo_quintal.split('-').pop() : x.codigo_quintal })));
    d.avaliacoes.forEach(x => novos.avaliacoes.push(Object.assign({}, x, { id: nid(x.id, c), ficha_id: id(x.ficha_id), visita_id: id(x.visita_id), uf: uf(x), executor_id: id(x.executor_id) })));
    d.custos.forEach(x => novos.custos.push(Object.assign({}, x, { visita_id: id(x.visita_id) })));
    (d.orientacoesVenda || []).forEach(x => novos.orientacoesVenda.push(Object.assign({}, x, { id: nid(x.id, c), ficha_id: id(x.ficha_id), uf: uf(x), feito_por: id(x.feito_por) })));
    /* pagamentos e entregas: só os das agentes (as bolsistas são as mesmas em todas as cópias) */
    const ag = new Set(d.equipe.filter(m => m.papel === 'agente').map(m => m.id));
    (d.solicitacoes || []).filter(x => ag.has(x.equipe_id)).forEach(x => { const n = Object.assign({}, x, { id: nid(x.id, c), equipe_id: id(x.equipe_id) }); mapa.set(x.id, n.id); novos.solicitacoes.push(n); });
    /* visita → pedido de pagamento em que entrou */
    for (const [v, s] of Object.entries(d.solic_visitas || {})) if (mapa.has(s)) novos.solic_visitas[id(v)] = id(s);
    (d.entregas || []).filter(x => ag.has(x.equipe_id)).forEach(x => novos.entregas.push(Object.assign({}, x, { equipe_id: id(x.equipe_id) })));
  }
  for (const k of Object.keys(novos)) { if (Array.isArray(novos[k])) d[k] = (d[k] || []).concat(novos[k]); else d[k] = Object.assign(d[k] || {}, novos[k]); }

  /* plano na mesma proporção: nove estados, metas, orçamento e rubricas × K. Este arquivo roda antes do tudo.js, que define o plano
     (js/dados.js): cada valor fica num "guardião" — a lista de estados e as metas por estado são as da escala, e as metas e o
     orçamento que o dados.js grava passam pela multiplicação */
  /* as cópias são blocos de 40 quintais: cinco estados ficam com um bloco a mais; a vaga por estado é a do menor (os outros passam) */
  const porUf = Math.floor(K * 5 / 9) * 40;
  const vezes = o => { if (Array.isArray(o)) o.forEach(vezes); else if (o && typeof o === 'object') for (const k of Object.keys(o)) {
    if (typeof o[k] === 'number' && /^(total|valor|alvo|previsto|qtd|quantidade)$/.test(k)) o[k] *= K; else if (typeof o[k] === 'object') vezes(o[k]); } };
  const fixo = (nome, v) => Object.defineProperty(MQ, nome, { configurable: true, enumerable: true, get: () => v, set: () => {} });
  /* as metas que dependem do número de quintais (diagnósticos, implantação, visitas) crescem; as outras (meses de equipe, eventos,
     intercâmbio, missões, relatório) ficam como no plano, porque os dados delas não foram multiplicados */
  const multiplicado = (nome, so) => { const mult = x => { if (so && Array.isArray(x)) x.filter(so).forEach(vezes); else vezes(x); };
    let v = MQ[nome]; if (v) mult(v); Object.defineProperty(MQ, nome, { configurable: true, enumerable: true, get: () => v, set: x => { mult(x); v = x; } }); };
  fixo('UFS', NE.map(([uf, nome]) => ({ uf, nome })));
  fixo('META_UF', { diagnosticos: porUf, quintais: porUf, visitas: porUf * 2 });
  fixo('VAGAS_UF', porUf); fixo('DIAS_CAMPO_UF', porUf * 5);
  multiplicado('METAS', m => ['diagnostico', 'implantacao', 'visitas'].includes(m.fonte)); multiplicado('ORCAMENTO');
  MQ.ESCALA = { quintais: K * 200, estados: 9, fator: K };
})();
