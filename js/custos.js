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
  function coordMun(uf, municipio) {
    const muns = (MQ.GEO.mun || {})[uf] || {};
    const k = Object.keys(muns).find(m => norm(m) === norm(municipio));
    return k ? { lon: muns[k][0], lat: muns[k][1], como: 'centro de ' + k } : null;
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
    if (!C.carregado) { setTimeout(async () => { await carregar(); U().render(); }, 0); return '<p class="carregando">Carregando…</p>'; }
    const souCoord = /^coord/.test(S().eu.papel);
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
      ${C.erro ? `<div class="aviso">${E(C.erro)}</div>` : ''}
      <div class="aviso erro"><b>Confirme com a FUNCERN antes de pagar.</b> Bolsistas já recebem bolsa mensal: pagar também as horas de visita a elas pode ser entendido como pagamento em dobro pela mesma atividade.</div>
      <div class="resumo">
        <div><span class="v num">${brl(soma(feitas))}</span><span class="l">visitas feitas em ${nomeMes(C.mes)} (${feitas.length})</span></div>
        <div><span class="v num">${brl(soma(prev))}</span><span class="l">previstas no roteiro (${prev.length})</span></div>
        <div><span class="v num">${Object.keys(porPessoa).length}</span><span class="l">pessoas a receber</span></div>
        <div><span class="v num">${semKm}</span><span class="l">visitas feitas sem km (não somam combustível)</span></div></div>
      <div class="duas-col">
        <section class="secao"><div class="secao-cab"><h2>Por pessoa · visitas feitas</h2>${feitas.length ? '<button class="btn peq" data-acao="custo-csv">Baixar planilha (CSV)</button>' : ''}</div>
          ${Object.keys(porPessoa).length ? `<div class="bloco"><table class="tab-uf"><thead><tr><th>Pessoa</th><th>Visitas</th><th style="text-align:right">A pagar</th></tr></thead><tbody>
            ${Object.values(porPessoa).sort((a, b) => b.total - a.total).map(x => `<tr><td><b>${E(x.p.nome || '—')}</b><br><span class="small muted">${E((MQ.PAPEIS[x.p.papel] || {}).nome || '')} · ${E(x.p.uf || '')}${x.falta ? ` · <span class="crit-txt">${x.falta} sem km</span>` : ''}</span></td>
              <td class="num">${x.n}</td><td class="num" style="text-align:right"><b>${brl(x.total)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhuma visita feita neste mês.</p>'}
          <h2 style="margin-top:12px">Visitas do mês</h2>
          ${linhas.length ? `<div class="lista-custo">${linhas.map(linha).join('')}</div>` : '<p class="muted">Nenhuma visita neste mês.</p>'}
        </section>
        <aside class="secao">
          <form class="bloco" data-form="custo-sim" novalidate><h2>Simular uma visita</h2>
            <div class="campos"><div class="campo"><label for="cs-e">Tipo</label><select id="cs-e" name="etapa">${Object.entries(MQ.ETAPAS_CUSTO).map(([k, t]) => `<option value="${k}">${t} (${p.horas[k]} h)${k === 'avaliacao' ? ' · ainda não agendável' : ''}</option>`).join('')}</select></div>
              <div class="campo"><label for="cs-k">Km só de ida</label><input id="cs-k" name="km" type="number" min="0" max="999" inputmode="decimal" value="30"></div></div>
            <div id="cs-res">${quadro(calcular('diagnostico', 30))}</div></form>
          <form class="bloco" data-form="custo-par" novalidate><h2>Valores usados</h2>
            <p class="small muted">Valem para todas as visitas${souCoord ? '. Alterações ficam registradas no histórico' : ''}.</p>
            <div class="campos">
              ${num('valor_hora', 'Valor da hora (R$)', p.valor_hora, 1)}${num('refeicao', 'Refeição por visita (R$)', p.refeicao, 0.5)}
              ${num('h_diagnostico', 'Horas · diagnóstico', p.horas.diagnostico, 0.5)}${num('h_implantacao', 'Horas · implantação', p.horas.implantacao, 0.5)}
              ${num('h_acompanhamento', 'Horas · acompanhamento', p.horas.acompanhamento, 0.5)}${num('h_avaliacao', 'Horas · avaliação', p.horas.avaliacao, 0.5)}
              ${num('km_por_litro', 'Carro: km por litro', p.km_por_litro, 0.5)}${num('preco_litro', 'Gasolina: R$ por litro', p.preco_litro, 0.01)}
              ${num('fator_estrada', 'Fator estrada (sobre a linha reta)', p.fator_estrada, 0.05)}</div>
            <p class="nota">Preço de referência: média da gasolina no país em set/2026 ficou perto de R$ 6,52 (ANP). Confira o preço do mês no estado.</p>
            <div class="aviso erro" data-erro hidden></div>
            ${souCoord ? '<div class="acoes"><button class="btn pri" type="submit">Salvar valores</button></div>' : ''}</form>
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
    if (a === 'custo-mes') { C.mes = somaMes(C.mes || mesHoje(), +el.dataset.n); U().render(); }
    else if (a === 'custo-csv') csv();
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'custo-par') {
      const v = k => Number(String(fd.get(k)).replace(',', '.'));
      const novo = { valor_hora: v('valor_hora'), refeicao: v('refeicao'), km_por_litro: v('km_por_litro'), preco_litro: v('preco_litro'), fator_estrada: v('fator_estrada'),
        horas: { diagnostico: v('h_diagnostico'), implantacao: v('h_implantacao'), acompanhamento: v('h_acompanhamento'), avaliacao: v('h_avaliacao') } };
      const erros = {};
      [['valor_hora', 0, 500], ['refeicao', 0, 200], ['km_por_litro', 1, 60], ['preco_litro', 1, 20], ['fator_estrada', 1, 2]].forEach(([k, a, b]) => { if (!(novo[k] >= a && novo[k] <= b)) erros[k] = `Entre ${a} e ${b}.`; });
      Object.keys(novo.horas).forEach(k => { if (!(novo.horas[k] > 0 && novo.horas[k] <= 12)) erros['h_' + k] = 'Entre 0,5 e 12 horas.'; });
      if (Object.keys(erros).length) return U().mostrarErros(form, erros);
      await U().ocupado(form, async () => { C.par = Object.assign({}, MQ.CUSTO_PADRAO, await S().api.salvarParametros('custo_visita', novo)); U().render(); U().toast('Valores salvos.'); });
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

  MQ.custosUI = { aba, clique, enviar, calcular: (etapa, km) => { C.par = C.par || Object.assign({}, MQ.CUSTO_PADRAO); return calcular(etapa, km); } };
})();
