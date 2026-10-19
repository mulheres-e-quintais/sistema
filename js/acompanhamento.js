/* Mulheres & Quintais — perfis de ACOMPANHAMENTO (52_acompanhamento.sql): quem acompanha o projeto de fora.
   mda: o ministério que financia. Vê o projeto inteiro em números (alcance, etapas, mapa, evolução, perfil das
        beneficiárias e impacto). Recursos (65): só quando o parâmetro acomp_mda_financeiro liberar.
   mpa: o movimento parceiro. Vê o andamento no território: cada estado, equipe, formação e o que está parado.
   Só leitura e só contagens: nenhum nome, CPF, endereço, foto ou dado bancário chega a esta tela.
   No perfil e no impacto, contagem de 1 a 4 pessoas vem como -1 e aparece "menos de 5". */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const ORG = {
    mda: { sigla: 'MDA', titulo: 'O projeto em números', sub: 'Acompanhamento da execução física pelo ministério', manual: 'mda' },
    mpa: { sigla: 'MPA', titulo: 'Andamento no território', sub: 'Acompanhamento da execução pelo movimento parceiro', manual: 'mpa' }
  };
  const ALVO = { selecionadas: 200, diagnosticos: 200, implantados: 200, acompanhamentos: 400, avaliacoes: 200 };
  const ALVO_UF = { selecionadas: 40, diagnosticos: 40, implantados: 40, acompanhamentos: 80, avaliacoes: 40 };
  const FMT = new Intl.NumberFormat('pt-BR');
  const n = v => FMT.format(Math.round(+v || 0));
  const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const pequeno = q => (q >= 1 && q <= 4 ? -1 : q);   // a mesma regra do banco (acomp_n)
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeMes = ym => { const [a, m] = String(ym).split('-').map(Number); return MESES[(m || 1) - 1] + '/' + String(a).slice(2); };

  /* ---------- a conta (mesma forma do que a função acompanhamento_dados devolve): usada pelo modo demonstração e pelos testes ---------- */
  function calcular(d, orgao, hoje) {
    const fichas = d.fichas || [], visitas = (d.visitas || []).filter(v => v.situacao !== 'cancelada'), diags = d.diagnosticos || [], avals = d.avaliacoes || [];
    const equipe = (d.equipe || []).filter(m => m.status === 'ativa');
    const sel = fichas.filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada');
    const idsF = new Set(fichas.map(f => f.id));
    const vs = visitas.filter(v => idsF.has(v.ficha_id)), dg = diags.filter(x => idsF.has(x.ficha_id)), av = avals.filter(x => idsF.has(x.ficha_id));
    const dist = l => new Set(l).size;
    const por_uf = MQ.UFS.map(u => u.uf).sort().map(uf => {
      const f = fichas.filter(x => x.uf === uf), s = sel.filter(x => x.uf === uf), v = vs.filter(x => x.uf === uf), g = dg.filter(x => x.uf === uf);
      return { uf, indicadas: f.length, selecionadas: s.length, espera: f.filter(x => x.resultado === 'lista_espera').length, sem_agua: f.filter(x => x.resultado === 'sem_agua').length,
        municipios: dist(s.map(x => semAcento(x.municipio))), comunidades: dist(s.map(x => semAcento(x.municipio) + '|' + semAcento(x.comunidade))),
        pessoas: s.reduce((t, x) => t + (+x.pessoas_familia || 0), 0),
        diagnosticos: g.length, planos: g.filter(x => x.situacao === 'aprovado' && !x.sem_agua).length, diag_sem_agua: g.filter(x => x.sem_agua).length,
        area_m2: g.filter(x => !x.sem_agua).reduce((t, x) => t + (+x.area_m2 || 0), 0),
        implantados: v.filter(x => x.etapa === 'implantacao' && x.situacao === 'realizada').length,
        acompanhamentos: v.filter(x => x.etapa === 'acompanhamento' && x.situacao === 'realizada').length,
        avaliacoes: av.filter(x => x.uf === uf).length, visitas_feitas: v.filter(x => x.situacao === 'realizada').length,
        agendadas: v.filter(x => x.situacao === 'prevista' && String(x.data_prevista) >= hoje).length, atrasadas: v.filter(x => x.situacao === 'prevista' && String(x.data_prevista) < hoje).length,
        bolsistas: equipe.filter(m => m.uf === uf && (m.papel === 'articulacao' || m.papel === 'apoio')).length, agentes: equipe.filter(m => m.uf === uf && m.papel === 'agente').length,
        // 60: equipe de campo habilitada e diagnósticos esperando a coordenação (a mesma conta de acompanhamento_equipe_uf)
        equipe_campo: equipe.filter(m => m.uf === uf && ['articulacao', 'apoio', 'agente'].includes(m.papel)).length,
        habilitadas: equipe.filter(m => m.uf === uf && ['articulacao', 'apoio', 'agente'].includes(m.papel) && MQ.regras.habilitado(m)).length,
        diag_aguardando: g.filter(x => x.situacao === 'aguardando').length, diag_devolvidos: g.filter(x => x.situacao === 'devolvido').length };
    });
    const impl = new Set(vs.filter(v => v.etapa === 'implantacao' && v.situacao === 'realizada').map(v => v.ficha_id));
    const gm = {}; sel.forEach(f => { const k = f.uf + '|' + semAcento(f.municipio); const x = gm[k] || (gm[k] = { uf: f.uf, municipio: String(f.municipio).replace(/\s+/g, ' ').trim(), n: 0, implantados: 0 }); x.n++; if (impl.has(f.id)) x.implantados++; });
    const municipios = Object.values(gm).sort((a, b) => a.uf.localeCompare(b.uf) || a.municipio.localeCompare(b.municipio, 'pt-BR'));
    const mm = {}; vs.filter(v => v.situacao === 'realizada' && v.data_realizada).forEach(v => { const k = String(v.data_realizada).slice(0, 7); const x = mm[k] || (mm[k] = { mes: k, diagnostico: 0, implantacao: 0, acompanhamento: 0, avaliacao: 0 });
      x[['diagnostico', 'implantacao', 'acompanhamento'].includes(v.etapa) ? v.etapa : 'avaliacao']++; });
    const mensal = Object.values(mm).sort((a, b) => a.mes.localeCompare(b.mes));
    const r = { orgao, gerado_em: new Date().toISOString(), hoje, por_uf, municipios, mensal };
    {   // 65: os dois órgãos recebem perfil, impacto e formação
      const c = k => pequeno(sel.filter(x => x[k]).length);
      const idade = f => { const [a, m, dd] = String(f.data_nascimento || '').split('-').map(Number), [ha, hm, hd] = hoje.split('-').map(Number); return a ? ha - a - (hm < m || (hm === m && hd < dd) ? 1 : 0) : null; };
      const ids = sel.map(idade).filter(x => x != null);
      const dgc = dg.filter(x => !x.sem_agua), comRenda = dgc.filter(x => x.renda_quintal != null);
      const q = (l, f) => pequeno(l.filter(f).length);
      r.perfil = { base: sel.length, sustento: c('p_sustento'), cadunico: c('p_cadunico'), sem_ater: c('p_sem_ater'), raca_povo: c('p_raca_povo'), jovem: c('p_jovem'), grupo: c('p_grupo'), caf: c('p_caf'),
        faixas: { '18 a 29': q(ids, x => x < 30), '30 a 44': q(ids, x => x >= 30 && x <= 44), '45 a 59': q(ids, x => x >= 45 && x <= 59), '60 ou mais': q(ids, x => x >= 60) } };
      r.impacto = { base_n: dgc.length, renda_quintal_media: comRenda.length >= 5 ? Math.round(comRenda.reduce((t, x) => t + (+x.renda_quintal || 0), 0) / comRenda.length * 100) / 100 : null,
        final_n: av.length, produz: { sim: q(av, x => x.quintal_produz === 'sim'), em_parte: q(av, x => x.quintal_produz === 'em_parte'), nao: q(av, x => x.quintal_produz === 'nao') },
        ebia_final: { seguranca: q(av, x => x.ebia_nivel === 'seguranca'), leve: q(av, x => x.ebia_nivel === 'leve'), moderada: q(av, x => x.ebia_nivel === 'moderada'), grave: q(av, x => x.ebia_nivel === 'grave') } };
    }
    {
      // 67 (18/10/2026): matriculadas = pessoas com a matrícula registrada, como na coordenação (antes contava só as feitas numa turma)
      const fazFIC = equipe.filter(m => MQ.regras.matriculaFIC(m.papel));
      r.formacao = { turmas: (d.turmas || []).length, pessoas: fazFIC.length, matriculas: fazFIC.filter(m => m.matricula_fic_em).length, encontros: (d.encontros || d.ficEncontros || []).filter(x => !x.cancelado_em).length };   // 13/10/2026: sem as canceladas
    }
    return r;
  }
  /* 65: a mesma conta da função acompanhamento_extra (modo demonstração e testes) */
  function calcularExtra(d, orgao, previa, hoje) {
    const p = d.pedidos || [], pend = x => ['enviado', 'conferido', 'devolvido'].includes(x.situacao), ped = x => (x.dados || {}).finalidade === 'pedagogico';
    const cont = (l, k) => l.reduce((o, x) => { o[x[k]] = (o[x[k]] || 0) + 1; return o; }, {});
    const c = (d.canaisVenda || []).filter(x => x.ativo !== false);
    const ult = {}; (d.aguaSituacoes || []).forEach(x => { if (!ult[x.ficha_id] || String(x.registrado_em) > String(ult[x.ficha_id].registrado_em)) ult[x.ficha_id] = x; });
    const en = (d.ficEncontros || d.encontros || []).filter(x => !x.cancelado_em), ids = new Set(en.map(x => x.id)), pr = (d.ficPresencas || []).filter(x => ids.has(x.encontro_id));
    const dc = (d.documentos || []).filter(x => !x.arquivado_em);
    const r = { orgao,
      atividades: { eventos: { autorizados: p.filter(x => x.tipo === 'evento' && x.situacao === 'autorizado').length, pedidos: p.filter(x => x.tipo === 'evento' && pend(x)).length, realizados: p.filter(x => x.tipo === 'evento' && x.situacao === 'autorizado' && String(x.data_ref) < hoje).length },
        intercambio: { autorizados: p.filter(x => x.tipo === 'passagem' && x.situacao === 'autorizado' && !ped(x)).length, pedidos: p.filter(x => x.tipo === 'passagem' && pend(x) && !ped(x)).length,
          viagens_feitas: new Set(p.filter(x => x.tipo === 'passagem' && x.situacao === 'autorizado' && !ped(x) && String(x.data_ref) < hoje).map(x => x.data_ref)).size },
        pedagogico: { autorizados: p.filter(x => x.tipo === 'passagem' && x.situacao === 'autorizado' && ped(x)).length, pedidos: p.filter(x => x.tipo === 'passagem' && pend(x) && ped(x)).length,
          viagens_feitas: new Set(p.filter(x => x.tipo === 'passagem' && x.situacao === 'autorizado' && ped(x) && String(x.data_ref) < hoje).map(x => x.data_ref)).size } },
      canais: { por_tipo: cont(c, 'tipo'), municipios: new Set(c.map(x => x.uf + '|' + semAcento(x.municipio))).size },
      agua: cont(Object.values(ult), 'situacao'),
      fic: { encontros: en.length, horas: en.reduce((t, x) => t + (+x.carga_horaria || 0), 0), horas_feitas: en.filter(x => String(x.data) <= hoje).reduce((t, x) => t + (+x.carga_horaria || 0), 0), feitos: en.filter(x => String(x.data) <= hoje).length, presencas: pr.filter(x => x.presente).length, marcacoes: pr.length },
      documentos: { por_tipo: cont(dc, 'tipo'), ultima_data: dc.reduce((o, x) => { if (!o[x.tipo] || String(x.data_documento) > o[x.tipo]) o[x.tipo] = String(x.data_documento); return o; }, {}) } };
    if (orgao === 'mda' && previa) {   // na demonstração, o padrão do banco: o resumo financeiro aparece só na prévia
      const pl = (d.execPlanilhas || []).slice().sort((a, b) => String(b.posicao_em).localeCompare(String(a.posicao_em)))[0];
      if (!pl) r.financeiro = { liberado: 'previa', sem_planilha: true };
      else { const pi = {}, pm = {}; (pl.linhas || []).forEach(l => { const k = (l.item || '') + '|' + (l.rubrica || ''); const vl = typeof l.valor === 'number' ? l.valor : 0; pi[k] = (pi[k] || 0) + vl;
          const m = /^\d{4}-\d{2}/.test(String(l.data || '')) ? String(l.data).slice(0, 7) : String(pl.posicao_em).slice(0, 7); pm[m] = pm[m] || { mes: m, gasto: 0, recebido: 0 }; pm[m][l.item === 'repasse_mda' ? 'recebido' : 'gasto'] += vl; });
        r.financeiro = { liberado: 'previa', posicao_em: pl.posicao_em, enviado_em: pl.enviado_em, por_item: Object.entries(pi).map(([k, v]) => ({ item: k.split('|')[0] || null, rubrica: k.split('|')[1] || null, valor: Math.round(v * 100) / 100 })),
          por_mes: Object.values(pm).sort((a, b) => a.mes.localeCompare(b.mes)) }; }
    }
    return r;
  }
  const total = (a, k) => (a.por_uf || []).reduce((t, u) => t + (+u[k] || 0), 0);

  /* ---------- peças de tela ---------- */
  const numeroGrande = (v, rot, sub) => `<div class="ac-kpi"><b class="num">${v}</b><span class="l">${E(rot)}</span>${sub ? `<small>${E(sub)}</small>` : ''}</div>`;

  /* evolução por mês: colunas com o total em cima; a tabela ao lado traz cada etapa (leitor de tela lê a tabela) */
  function evolucao(a) {
    const l = a.mensal || []; if (!l.length) return '<p class="muted">As visitas feitas aparecem aqui, mês a mês, assim que forem registradas.</p>';
    const tot = x => x.diagnostico + x.implantacao + x.acompanhamento + x.avaliacao; const max = Math.max(1, ...l.map(tot));
    const W = Math.max(280, l.length * 56), H = 150, b = 28, larg = Math.min(34, (W - 16) / l.length - 12);
    const col = l.map((x, i) => { const cx = 8 + (i + .5) * ((W - 16) / l.length), h = Math.max(2, tot(x) / max * (H - b - 22));
      return `<g><title>${nomeMes(x.mes)}: ${tot(x)} visitas feitas</title><path d="M${(cx - larg / 2).toFixed(1)} ${H - b} v${(-h + 4).toFixed(1)} q0 -4 4 -4 h${(larg - 8).toFixed(1)} q4 0 4 4 v${(h - 4).toFixed(1)} z" class="ac-col"/>
        <text x="${cx.toFixed(1)}" y="${(H - b - h - 6).toFixed(1)}" text-anchor="middle" class="ac-col-n">${tot(x)}</text><text x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle" class="ac-col-m">${nomeMes(x.mes)}</text></g>`; }).join('');
    return `<div class="ac-evo"><div class="quadro-scroll" style="display:block"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Visitas feitas por mês: ${l.map(x => nomeMes(x.mes) + ' ' + tot(x)).join(', ')}" class="ac-svg"><line x1="4" x2="${W - 4}" y1="${H - b}" y2="${H - b}" class="ac-eixo"/>${col}</svg></div>
      <div class="quadro-scroll" style="display:block"><table class="quadro ac-tab"><thead><tr><th>Mês</th><th class="num">Diagnóstico</th><th class="num">Implantação</th><th class="num">Acompanhamento</th><th class="num">Avaliação final</th><th class="num">Total</th></tr></thead>
        <tbody>${l.map(x => `<tr><td data-rot="Mês">${nomeMes(x.mes)}</td><td class="num" data-rot="Diagnóstico">${x.diagnostico}</td><td class="num" data-rot="Implantação">${x.implantacao}</td><td class="num" data-rot="Acompanhamento">${x.acompanhamento}</td><td class="num" data-rot="Avaliação final">${x.avaliacao}</td><td class="num" data-rot="Total"><b>${tot(x)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function mapa(a) {
    const mun = (a.municipios || []).map(m => ({ uf: m.uf, municipio: m.municipio, n: m.n }));
    // o mesmo mapa da aba Visão geral (círculo por município, tamanho pelo número), alimentado só com totais
    const svg = MQ.painelUI && MQ.painelUI.mapaResumo ? MQ.painelUI.mapaResumo(mun) : '';
    const top = (a.municipios || []).slice().sort((x, y) => y.n - x.n).slice(0, 8);
    return `<div class="ac-duo"><div class="ac-mapa">${svg}</div>
      <div><h3>Municípios com mais quintais</h3>${top.length ? `<div class="quadro-scroll" style="display:block"><table class="quadro ac-tab"><thead><tr><th>Município</th><th class="num">Selecionadas</th><th class="num">Implantados</th></tr></thead>
        <tbody>${top.map(m => `<tr><td data-rot="Município">${E(m.municipio)}/${E(m.uf)}</td><td class="num" data-rot="Selecionadas">${n(m.n)}</td><td class="num" data-rot="Implantados">${n(m.implantados)}</td></tr>`).join('')}</tbody></table></div>
        ${(a.municipios || []).length > top.length ? `<p class="small muted">E mais ${(a.municipios || []).length - top.length} municípios.</p>` : ''}` : '<p class="muted">Os municípios aparecem aqui quando as primeiras mulheres forem selecionadas.</p>'}</div></div>`;
  }
  function tabelaUF(a, comEquipe) {
    const c = (k, t) => `<td class="num" data-rot="${t}">${n(k)}</td>`;
    return `<div class="quadro-scroll" style="display:block"><table class="quadro ac-tab"><thead><tr><th>Estado</th><th class="num">Selecionadas</th><th class="num">Diagnósticos</th><th class="num">Planos aprovados</th><th class="num">Quintais implantados</th><th class="num">Acompanhamentos</th><th class="num">Avaliações finais</th>${comEquipe ? '<th class="num">Bolsistas</th><th class="num">Agentes</th>' : '<th class="num">Municípios</th>'}</tr></thead>
      <tbody>${a.por_uf.map(u => `<tr><td data-rot="Estado"><b>${E(U().nomeUF ? U().nomeUF(u.uf) : u.uf)}</b></td>${c(u.selecionadas, 'Selecionadas')}${c(u.diagnosticos, 'Diagnósticos')}${c(u.planos, 'Planos aprovados')}${c(u.implantados, 'Quintais implantados')}${c(u.acompanhamentos, 'Acompanhamentos')}${c(u.avaliacoes, 'Avaliações finais')}${comEquipe ? c(u.bolsistas, 'Bolsistas') + c(u.agentes, 'Agentes') : c(u.municipios, 'Municípios')}</tr>`).join('')}</tbody>
      <tfoot><tr><td><b>Total</b></td>${['selecionadas', 'diagnosticos', 'planos', 'implantados', 'acompanhamentos', 'avaliacoes'].concat(comEquipe ? ['bolsistas', 'agentes'] : ['municipios']).map(k => `<td class="num"><b>${n(total(a, k))}</b></td>`).join('')}</tr></tfoot></table></div>`;
  }
  // parcela das selecionadas: barra + número + percentual; contagem pequena aparece como "menos de 5"
  function parcela(rot, q, base) {
    if (q === -1) return `<div class="ac-barra"><div class="ac-barra-t"><span>${E(rot)}</span><b>menos de 5</b></div><span class="medidor" aria-hidden="true"><i style="width:0"></i></span></div>`;
    const p = base ? q / base * 100 : 0;
    return `<div class="ac-barra"><div class="ac-barra-t"><span>${E(rot)}</span><b class="num">${n(q)}<small> · ${Math.round(p)}%</small></b></div><span class="medidor" role="img" aria-label="${E(rot)}: ${n(q)} de ${n(base)} (${Math.round(p)}%)"><i style="width:${p.toFixed(1)}%"></i></span></div>`;
  }
  function perfil(a) {
    const p = a.perfil; if (!p) return '';
    if (!p.base) return '<p class="muted">O perfil das beneficiárias aparece aqui quando as primeiras mulheres forem selecionadas.</p>';
    if (p.base < 5) return '<p class="muted">Ainda há menos de 5 mulheres selecionadas. O perfil aparece a partir de 5, para ninguém ser identificada.</p>';
    return `<div class="ac-duo"><div><h3>Prioridades do projeto</h3>
        ${parcela('Responsáveis pelo sustento da família', p.sustento, p.base)}${parcela('Inscritas no CadÚnico', p.cadunico, p.base)}${parcela('Nunca tiveram assistência técnica', p.sem_ater, p.base)}
        ${parcela('Negras, indígenas, quilombolas ou de povo tradicional', p.raca_povo, p.base)}${parcela('Jovens (18 a 29 anos)', p.jovem, p.base)}${parcela('Participam de grupo ou associação', p.grupo, p.base)}${parcela('Têm CAF', p.caf, p.base)}</div>
      <div><h3>Idade</h3>${Object.entries(p.faixas || {}).map(([k, v]) => parcela(k + ' anos', v, p.base)).join('')}
        <p class="small muted">Sobre ${n(p.base)} mulheres selecionadas. Uma mesma mulher pode estar em mais de uma prioridade. Grupo com 1 a 4 pessoas aparece como "menos de 5".</p></div></div>`;
  }
  function impacto(a) {
    const i = a.impacto; if (!i) return '';
    const mostra = v => v === -1 ? 'menos de 5' : n(v);
    const NIV = { seguranca: 'Segurança alimentar', leve: 'Insegurança leve', moderada: 'Insegurança moderada', grave: 'Insegurança grave' };
    const PROD = { sim: 'Produzindo', em_parte: 'Produzindo em parte', nao: 'Sem produzir' };
    return `<div class="ac-duo"><div class="bloco"><h3>Antes do quintal (linha de base)</h3>
        <p class="ac-frase"><b class="num">${n(i.base_n)}</b> ${i.base_n === 1 ? 'família' : 'famílias'} com diagnóstico feito${i.renda_quintal_media != null ? `. Venda média do quintal antes do projeto: <b class="num">${MQ.regras.fmtBRL(i.renda_quintal_media)}</b> por mês.` : '.'}</p>
        <p class="small muted">O diagnóstico registra produção, renda e alimentação da família antes da implantação. É a referência para medir o que mudou.</p></div>
      <div class="bloco"><h3>Depois do quintal (avaliação final)</h3>
        ${i.final_n ? `<p class="ac-frase"><b class="num">${n(i.final_n)}</b> quintais já avaliados na 5ª visita.</p>
          <dl class="dl">${Object.entries(PROD).map(([k, t]) => `<dt>${t}</dt><dd>${mostra((i.produz || {})[k] || 0)}</dd>`).join('')}${Object.entries(NIV).map(([k, t]) => `<dt>${t}</dt><dd>${mostra((i.ebia_final || {})[k] || 0)}</dd>`).join('')}</dl>
          <p class="small muted">Situação alimentar pela Escala Brasileira de Insegurança Alimentar (EBIA).</p>`
          : '<p class="muted">A avaliação final é a 5ª visita a cada quintal. Os resultados aparecem aqui quando as primeiras forem feitas.</p>'}</div></div>`;
  }
  function parados(a) {
    const atr = total(a, 'atrasadas'), agua = total(a, 'sem_agua') + total(a, 'diag_sem_agua'), esp = total(a, 'espera');
    const semEq = a.por_uf.filter(u => u.bolsistas < 2).map(u => u.uf);
    const it = [];
    if (atr) it.push(`<li><b>${n(atr)} visita${atr > 1 ? 's' : ''} com a data vencida</b> e ainda sem registro: ${a.por_uf.filter(u => u.atrasadas).map(u => u.uf + ' ' + u.atrasadas).join(', ')}.</li>`);
    if (semEq.length) it.push(`<li><b>Equipe incompleta</b> (menos de 2 bolsistas) em: ${semEq.join(', ')}.</li>`);
    const semHab = a.por_uf.filter(u => u.habilitadas != null && u.equipe_campo > u.habilitadas);
    if (semHab.length) it.push(`<li><b>Equipe sem habilitação completa</b> (ainda não pode trabalhar no campo): ${semHab.map(u => { const q = u.equipe_campo - u.habilitadas; return (U().nomeUF ? U().nomeUF(u.uf) : u.uf) + ', ' + q + (q === 1 ? ' pessoa' : ' pessoas'); }).join('; ')}.</li>`);
    const dgEsp = total(a, 'diag_aguardando'), dgDev = total(a, 'diag_devolvidos');
    if (dgEsp) it.push(`<li><b>${n(dgEsp)} diagnóstico${dgEsp > 1 ? 's' : ''} esperando a aprovação da coordenação</b>: o quintal só é implantado depois do plano aprovado. ${a.por_uf.filter(u => u.diag_aguardando).map(u => u.uf + ' ' + u.diag_aguardando).join(', ')}.</li>`);
    if (dgDev) it.push(`<li><b>${n(dgDev)} diagnóstico${dgDev > 1 ? 's' : ''} devolvido${dgDev > 1 ? 's' : ''} para correção</b>: ${a.por_uf.filter(u => u.diag_devolvidos).map(u => u.uf + ' ' + u.diag_devolvidos).join(', ')}.</li>`);
    if (agua) it.push(`<li><b>${n(agua)} mulher${agua > 1 ? 'es' : ''} sem água que dure na seca</b>: ${agua > 1 ? 'não recebem' : 'não recebe'} o kit até haver solução (cisterna ou outro programa).</li>`);
    if (esp) it.push(`<li><b>${n(esp)} na lista de espera</b>, para o caso de alguma vaga abrir.</li>`);
    return it.length ? `<ul class="ac-lista">${it.join('')}</ul>` : '<p class="muted">Nada parado no momento.</p>';
  }

  /* ---------- 15/10/2026: a tela de quem acompanha em abas, leve: uma ideia por aba, números grandes, pouco texto ---------- */
  const ABAS = [['resumo', 'Resumo'], ['metas', 'Metas e cronograma'], ['recursos', 'Recursos'], ['territorio', 'Território'], ['mulheres', 'Mulheres e impacto'], ['equipe', 'Equipe e formação']];
  const pl = (v, um, varios) => (+v === 1 ? um : varios);
  const pc = (v, de) => de ? Math.max(0, Math.min(100, v / de * 100)) : 0;
  const brl = v => MQ.regras.fmtBRL ? MQ.regras.fmtBRL(+v || 0).replace(/,00$/, '') : 'R$ ' + n(v);
  const anel = (v, de, rot) => { const p = pc(v, de), C = 2 * Math.PI * 26;
    return `<span class="ac2-anel" role="img" aria-label="${E(rot)}: ${Math.round(p)}%"><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="26" class="tr"/><circle cx="32" cy="32" r="26" class="pg${p >= 100 ? ' cheio' : ''}" stroke-dasharray="${(C * p / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/></svg><b class="num">${Math.round(p)}%</b></span>`; };
  const destaque = (v, rot, sub, de) => `<div class="ac2-kpi">${de ? anel(v, de, rot) : ''}<div><span class="ac2-kv"><b class="num">${n(v)}</b>${de ? `<small> de ${n(de)}</small>` : ''}</span><span>${E(rot)}</span>${sub ? `<em>${E(sub)}</em>` : ''}</div></div>`;
  const kpiTxt = (v, rot, sub) => `<div class="ac2-kpi"><div><b class="num">${v}</b><span>${E(rot)}</span>${sub ? `<em>${E(sub)}</em>` : ''}</div></div>`;
  const cartao = (t, h, cls) => `<section class="ac2-cartao${cls ? ' ' + cls : ''}">${t ? `<h2>${t}</h2>` : ''}${h}</section>`;
  const linhaMeta = (rot, v, de, sub) => { const p = pc(v, de); return `<div class="ac2-linha"><div class="ac2-linha-t"><span>${E(rot)}</span><b class="num">${v == null ? '—' : n(v)}${de ? `<small> de ${n(de)}</small>` : ''}</b></div>${de ? `<span class="ac2-barra" aria-hidden="true"><i class="${p >= 100 ? 'cheio' : ''}" style="width:${p.toFixed(1)}%"></i></span>` : ''}${sub ? `<small class="ac2-sub">${sub}</small>` : ''}</div>`; };

  /* o caminho de cada quintal: uma linha de etapas, cada bolinha com o número e a parte da meta */
  function caminho(a) {
    const et = [['Indicadas', total(a, 'indicadas'), 0], ['Selecionadas', total(a, 'selecionadas'), ALVO.selecionadas], ['Diagnóstico', total(a, 'diagnosticos'), ALVO.diagnosticos],
      ['Plano aprovado', total(a, 'planos'), ALVO.diagnosticos], ['Implantado', total(a, 'implantados'), ALVO.implantados], ['Acompanhamentos', total(a, 'acompanhamentos'), ALVO.acompanhamentos], ['Avaliação final', total(a, 'avaliacoes'), ALVO.avaliacoes]];
    return `<ol class="ac2-caminho">${et.map(([t, v, de]) => { const p = pc(v, de); return `<li class="${de && v >= de ? 'ok' : v ? 'and' : ''}" style="--p:${p.toFixed(0)}"><span class="ac2-pt" aria-hidden="true"></span><b class="num">${n(v)}</b><span class="ac2-et">${t}</span>${de ? `<small>${Math.round(p)}% de ${n(de)}</small>` : '<small>pelas comunidades</small>'}</li>`; }).join('')}</ol>`;
  }
  function abaResumo(a) {
    const x = a.extra || {};
    return `<div class="ac2-kpis">${destaque(total(a, 'selecionadas'), 'mulheres selecionadas', 'em ' + n(total(a, 'municipios')) + ' ' + pl(total(a, 'municipios'), 'município', 'municípios'), ALVO.selecionadas)}${destaque(total(a, 'implantados'), 'quintais implantados', '', ALVO.implantados)}
        ${destaque(total(a, 'visitas_feitas'), pl(total(a, 'visitas_feitas'), 'visita de campo feita', 'visitas de campo feitas'), 'todas as etapas: diagnóstico, implantação, acompanhamento e avaliação')}${destaque(total(a, 'pessoas'), 'pessoas nas famílias', 'das mulheres selecionadas')}</div>
      ${cartao('O caminho de cada quintal', caminho(a) + '<p class="ac2-nota">Da indicação pela comunidade até a avaliação final: cada etapa é registrada no sistema, com data, local e foto.</p>')}
      ${cartao('O que pede atenção', parados(a))}${cartao('Visitas feitas por mês', evolucao(a))}`;
  }
  /* metas e cronograma: cada meta com o número, a barra e a faixa do período no ano do projeto */
  /* 66: a situação de cada meta usa a mesma regra da coordenação (MQ.painelUI.infoMeta / previsto): o MDA e a coordenação veem o mesmo */
  function situacaoMetas(a) {
    const x = a.extra || {}, at = x.atividades || {}, P = MQ.painelUI || {};
    const mes = P.mesDoProjeto ? P.mesDoProjeto(new Date(String(a.hoje || MQ.regras.hoje()) + 'T12:00:00')) : 1;
    const feitas = (k, etapa) => Array.from({ length: total(a, k) }, () => ({ etapa, situacao: 'realizada' }));
    const falso = { diagnosticos: Array.from({ length: total(a, 'diagnosticos') }, (_, i) => ({ situacao: i < total(a, 'planos') ? 'aprovado' : 'aguardando' })),
      visitas: feitas('implantados', 'implantacao').concat(feitas('acompanhamentos', 'acompanhamento')) };
    const regra = (m, v, alvo) => { const prev = P.previsto ? Math.round(P.previsto(m, mes) * alvo / m.alvo) : 0, antes = mes - 1 < m.ini, depois = mes - 1 >= m.fim;
      return v >= alvo ? 'concluida' : antes ? (v > 0 ? 'andamento' : 'nao') : depois ? 'atrasada' : v >= prev ? 'andamento' : v >= prev * 0.7 ? 'atencao' : 'atrasada'; };
    return { mes, metas: MQ.METAS.map(m => {
      if (['diagnostico', 'implantacao', 'visitas'].includes(m.fonte) && P.infoMeta) { const i = P.infoMeta(m, falso, { aptas: [], pagaveis: [] }, mes); return { m, v: i.atual, alvo: i.alvo, un: i.un, st: i.st }; }
      if (m.id === 'M1') {   // equipe: as 10 bolsistas cadastradas; nunca "concluída" antes do fim do projeto (a meta é ter equipe os 12 meses)
        const v = total(a, 'bolsistas'); const st = v >= 10 ? (mes >= 13 ? 'concluida' : 'andamento') : (MQ.regras.diasAte(MQ.PROJETO.prazoIndicacao) < 0 ? 'atrasada' : 'atencao');
        return { m, v, alvo: 10, un: 'bolsistas no projeto (meta: equipe ativa os 12 meses)', st }; }
      if (m.id === 'M5') { const v = +(at.eventos || {}).realizados || 0; return { m, v, alvo: 5, un: 'eventos feitos', sub: n((at.eventos || {}).autorizados) + ' ' + pl((at.eventos || {}).autorizados, 'autorizado', 'autorizados'), st: regra(m, v, 5) }; }
      if (m.id === 'M6') { const viag = +(at.intercambio || {}).viagens_feitas || 0, v = Math.min(1, viag); return { m, v, alvo: 1, un: 'intercâmbio feito', sub: n((at.intercambio || {}).autorizados) + ' ' + pl((at.intercambio || {}).autorizados, 'passagem autorizada', 'passagens autorizadas'), st: regra(m, v, 1) }; }
      if (m.id === 'M7') { const v = +(at.pedagogico || {}).viagens_feitas || 0; return { m, v, alvo: 8, un: 'missões feitas', sub: n((at.pedagogico || {}).autorizados) + ' ' + pl((at.pedagogico || {}).autorizados, 'passagem autorizada', 'passagens autorizadas'), st: regra(m, v, 8) }; }
      return { m, v: null, alvo: m.alvo, un: m.un, sub: 'registrado fora do sistema', st: mes - 1 < m.ini ? 'nao' : 'fora' };
    }) };
  }
  const ST_TXT = { concluida: ['ok', 'Concluída'], andamento: ['and', 'Em andamento'], atencao: ['aten', 'Atenção'], atrasada: ['crit', 'Atrasada'], nao: ['nao', 'Não iniciada'], fora: ['nao', 'Fora do sistema'] };
  function abaMetas(a) {
    const { mes, metas } = situacaoMetas(a);
    const meses = 13, MES = ['set', 'out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
    const linhas = metas.map(({ m, v, alvo, un, sub, st }) => { const p = v == null ? 0 : pc(v, alvo); const [cls, txt] = ST_TXT[st] || ST_TXT.nao;
      return `<li class="ac2-meta"><div class="ac2-meta-t"><span class="ac2-mid">${m.id}</span><b>${E(m.nome)}</b><span class="ac2-st ${cls}">${txt}</span></div>
        <div class="ac2-meta-n">${v == null ? '<b class="num">—</b>' : `<b class="num">${n(v)}</b> de ${n(alvo)}`} <span>${E(un)}</span>${sub ? ` <small>· ${E(sub)}</small>` : ''}</div>
        <div class="ac2-gantt" aria-hidden="true">${Array.from({ length: meses }, (_, i) => `<i class="${i + 1 >= m.ini && i + 1 <= m.fim ? 'per' : ''}${i + 1 === mes ? ' hoje' : ''}"></i>`).join('')}<span class="ac2-gantt-p" style="left:${((m.ini - 1) / meses * 100).toFixed(1)}%;width:${(((m.fim - m.ini + 1) / meses) * p).toFixed(1)}%"></span></div></li>`; }).join('');
    const feito = { equipe: total(a, 'bolsistas') >= 10, diagnostico_inicio: total(a, 'diagnosticos') > 0, M2: total(a, 'diagnosticos') >= 200 };
    const marcos = (MQ.MARCOS || []).filter(k => k.d >= String(a.hoje || '') && !(k.feito && feito[k.feito])).slice(0, 4);
    return `${cartao('As 8 metas do plano de trabalho', `<div class="ac2-gantt-cab" aria-hidden="true"><span></span>${MES.map((t, i) => `<span class="${i + 1 === mes ? 'hoje' : ''}" data-m="${t[0]}">${t}</span>`).join('')}</div><ol class="ac2-metas">${linhas}</ol>
        <p class="ac2-nota">A faixa clara é o período previsto de cada meta (set/2026 a set/2027); a parte escura é o que já foi feito; a coluna marcada é o mês atual (mês ${mes} de 13). A situação segue a mesma regra que a coordenação usa: compara o feito com o previsto até o mês passado.</p>`)}
      ${marcos.length ? cartao('Próximos marcos', `<ol class="ac2-marcos">${marcos.map(k => `<li><b class="num">${MQ.regras.fmtData(k.d)}</b><span>${E(k.t)}</span>${k.meta ? `<small>${k.meta}</small>` : ''}</li>`).join('')}</ol>`) : ''}`;
  }
  /* recursos: só para o MDA, e só quando o parâmetro libera (padrão: só na prévia da coordenação) */
  function abaRecursos(a) {
    const fx = (a.extra || {}).financeiro; if (!fx) return '';
    const aviso = fx.liberado !== 'sim' ? '<p class="ac2-previa">Só você vê esta aba, na prévia. O MDA de verdade ainda não vê os recursos. Para liberar, a coordenação muda o parâmetro <b>acomp_mda_financeiro</b> para "sim" (ver o arquivo 65 do banco).</p>' : '';
    if (fx.sem_planilha) return aviso + cartao('Recursos', '<p class="muted">Os números de recursos aparecem quando a primeira planilha de gastos for enviada na aba Financeiro.</p>');
    const O = MQ.ORCAMENTO; const it = fx.por_item || [];
    const recebido = it.filter(l => l.item === 'repasse_mda').reduce((t, l) => t + +l.valor, 0), gasto = it.filter(l => l.item !== 'repasse_mda').reduce((t, l) => t + +l.valor, 0);
    const V = MQ.PROJETO.vigencia, dia = d => new Date(String(d).slice(0, 10) + 'T12:00:00').getTime(), tempo = pc(dia(a.hoje || MQ.regras.hoje()) - dia(V.inicio), dia(V.fim) - dia(V.inicio));
    const conhecido = new Set(O.rubricas.flatMap(r => r.itens.map(i => i.id))), rubIds = new Set(O.rubricas.map(r => r.id));
    const gastoL = it.filter(l => l.item !== 'repasse_mda');
    const porRub = O.rubricas.map(r => { const ids = new Set(r.itens.map(i => i.id)); const ex = gastoL.filter(l => ids.has(l.item) || (!conhecido.has(l.item) && l.rubrica === r.id)).reduce((t, l) => t + +l.valor, 0);
      return { nome: r.nome, prev: r.itens.reduce((t, i) => t + i.total, 0), ex }; });
    const naoClass = gastoL.filter(l => !conhecido.has(l.item) && !rubIds.has(l.rubrica)).reduce((t, l) => t + +l.valor, 0);
    if (naoClass) porRub.push({ nome: 'Não classificado (linha sem item nem rubrica do orçamento)', prev: 0, ex: naoClass });
    // por meta: a mesma divisão da aba Financeiro da coordenação (item com meta; ajuda de custo dividida 25/25/50; o resto em "comum")
    const partes = i => !i.meta ? { _comum: 1 } : typeof i.meta === 'string' ? { [i.meta]: 1 } : i.meta;
    const G = {}; MQ.METAS.forEach(m => { G[m.id] = { nome: m.id + ' · ' + m.nome, prev: 0, ex: 0 }; }); G._comum = { nome: 'Comum a todas as metas', prev: 0, ex: 0 };
    O.rubricas.forEach(r => r.itens.forEach(i => { const ex = gastoL.filter(l => l.item === i.id).reduce((t, l) => t + +l.valor, 0);
      Object.entries(partes(i)).forEach(([k, f]) => { if (G[k]) { G[k].prev += i.total * f; G[k].ex += ex * f; } }); }));
    G._comum.ex += gastoL.filter(l => !conhecido.has(l.item)).reduce((t, l) => t + +l.valor, 0);
    const porMeta = Object.values(G).filter(g => g.prev || g.ex);
    const bar = (rot, ex, prev) => `<div class="ac2-linha"><div class="ac2-linha-t"><span>${E(rot)}</span><b class="num">${brl(ex)}<small> de ${brl(prev)}</small></b></div><span class="ac2-barra" aria-hidden="true"><i style="width:${pc(ex, prev).toFixed(1)}%"></i></span></div>`;
    return `${aviso}<div class="ac2-kpis">${kpiTxt(brl(O.total), 'valor do projeto (TED)')}${kpiTxt(brl(recebido), 'recebido do MDA')}${kpiTxt(brl(gasto), 'executado', Math.round(pc(gasto, O.total)) + '% do projeto')}${kpiTxt(recebido ? brl(recebido - gasto) : '—', 'em caixa', recebido ? '' : 'sem repasse na planilha')}</div>
      ${cartao('Execução e tempo', `<div class="ac2-tempo">${linhaMeta('Recursos executados', Math.round(pc(gasto, O.total)), 100).replace(/<small> de 100<\/small>/, '%')}${linhaMeta('Tempo do projeto já passado', Math.round(tempo), 100).replace(/<small> de 100<\/small>/, '%')}</div><p class="ac2-nota">Posição da planilha de gastos de ${MQ.regras.fmtData(fx.posicao_em)}. Somas por item do orçamento: nenhuma despesa individual nem favorecido aparece aqui.</p>`)}
      <div class="ac2-duas">${cartao('Por meta', porMeta.map(x => bar(x.nome, x.ex, x.prev)).join(''))}${cartao('Por rubrica', porRub.map(x => bar(x.nome, x.ex, x.prev)).join(''))}</div>`;
  }
  function abaTerritorio(a) {
    const x = a.extra || {}, c = (x.canais || {}).por_tipo || {}, ag = x.agua || {};
    const TIP = [['feira', 'feiras', 'feira'], ['merenda', 'merenda escolar', 'merenda escolar'], ['paa', 'PAA', 'PAA'], ['grupo', 'grupos e cooperativas', 'grupo ou cooperativa'], ['comprador', 'compradores', 'comprador']];   // [chave, plural, singular]
    const AG = [['sem_solucao', 'sem solução', 'sem solução'], ['encaminhada', 'encaminhadas', 'encaminhada'], ['em_andamento', 'em andamento', 'em andamento'], ['concluida', 'resolvidas', 'resolvida']];
    const semAgua = total(a, 'sem_agua') + total(a, 'diag_sem_agua');
    return `${cartao('Onde o projeto está', mapa(a))}
      ${cartao('Estado por estado', `<div class="ac2-ufs">${(a.por_uf || []).map(u => `<div class="ac2-uf"><div class="ac2-uf-t"><span class="ac2-sigla">${u.uf}</span><b>${E(U().nomeUF ? U().nomeUF(u.uf) : u.uf)}</b><small>${n(u.municipios)} ${pl(u.municipios, 'município', 'municípios')} · ${n(u.comunidades)} ${pl(u.comunidades, 'comunidade', 'comunidades')}</small></div>${u.atrasadas ? `<span class="ac2-st crit ac2-atr">${n(u.atrasadas)} ${pl(u.atrasadas, 'visita atrasada', 'visitas atrasadas')}</span>` : ''}
          ${linhaMeta('Selecionadas', u.selecionadas, ALVO_UF.selecionadas)}${linhaMeta('Diagnósticos', u.diagnosticos, ALVO_UF.diagnosticos)}${linhaMeta('Implantados', u.implantados, ALVO_UF.implantados)}${linhaMeta('Acompanhamentos', u.acompanhamentos, ALVO_UF.acompanhamentos)}</div>`).join('')}</div>`)}
      <div class="ac2-duas">${cartao('Onde vender', x.canais ? `<ul class="ac2-chips">${TIP.filter(([k]) => c[k]).map(([k, t, t1]) => `<li><b class="num">${n(c[k])}</b> ${pl(c[k], t1, t)}</li>`).join('') || '<li class="muted">Nenhum canal cadastrado ainda</li>'}</ul><p class="ac2-nota">${n((x.canais || {}).municipios)} ${pl((x.canais || {}).municipios, 'município', 'municípios')} com canal de venda cadastrado: feiras, merenda escolar (PNAE), PAA, grupos e compradores.</p>` : '<p class="muted">Aparece com o arquivo 65 instalado no banco.</p>')}
        ${cartao('Água para produzir', `<p class="ac2-frase"><b class="num">${n(semAgua)}</b> ${pl(semAgua, 'mulher', 'mulheres')} sem água que dure na seca</p>${Object.keys(ag).length ? `<ul class="ac2-chips">${AG.filter(([k]) => ag[k]).map(([k, t, t1]) => `<li class="ag-${k}"><b class="num">${n(ag[k])}</b> ${pl(ag[k], t1, t)}</li>`).join('')}</ul>` : ''}<p class="ac2-nota">Sem água garantida, o kit não é entregue: a equipe encaminha para cisterna ou outro programa.</p>`)}</div>`;
  }
  function abaMulheres(a) { return `${cartao('Quem são as mulheres', perfil(a) || '<p class="muted">Aparece quando houver mulheres selecionadas.</p>')}${cartao('O que muda na vida das famílias', impacto(a) || '<p class="muted">Aparece com os primeiros diagnósticos.</p>')}`; }
  function abaEquipe(a) {
    const x = a.extra || {}, f = x.fic || {}, fo = a.formacao || {}, d = x.documentos || {};
    const TDP = { ata: ['ata', 'atas'], relatorio: ['relatório', 'relatórios'], plano: ['plano', 'planos'], oficio: ['ofício', 'ofícios'], contrato: ['contrato ou termo', 'contratos ou termos'], lista_presenca: ['lista de presença', 'listas de presença'], foto: ['foto', 'fotos'], outro: ['outro', 'outros'] };
    const pres = f.marcacoes ? Math.round(f.presencas / f.marcacoes * 100) : null;
    return `${cartao('Equipe de campo por estado', `<div class="ac2-ufs">${(a.por_uf || []).map(u => `<div class="ac2-uf"><div class="ac2-uf-t"><span class="ac2-sigla">${u.uf}</span><b>${E(U().nomeUF ? U().nomeUF(u.uf) : u.uf)}</b></div>
        ${linhaMeta('Bolsistas', u.bolsistas, 2)}<p class="ac2-mini"><b class="num">${n(u.agentes)}</b> agente${u.agentes === 1 ? '' : 's'} de campo</p>${u.habilitadas != null ? linhaMeta('Bolsistas e agentes habilitadas', u.habilitadas, u.equipe_campo || 0) : ''}</div>`).join('')}</div>`)}
      ${cartao('Curso de formação (FIC)', `<div class="ac2-kpis peq">${destaque(fo.turmas || 0, pl(fo.turmas, 'turma', 'turmas'))}${destaque(fo.matriculas || 0, fo.pessoas != null ? 'matriculadas (coordenação técnica, bolsistas e agentes)' : pl(fo.matriculas, 'pessoa matriculada', 'pessoas matriculadas'), '', fo.pessoas || 0)}${destaque(f.feitos || 0, pl(f.feitos, 'encontro feito', 'encontros feitos'), 'de ' + n(f.encontros || fo.encontros || 0) + ' ' + pl(f.encontros || fo.encontros || 0, 'marcado', 'marcados'))}${destaque(Math.round(f.horas_feitas != null ? f.horas_feitas : f.horas || 0), 'horas de curso já dadas', 'de ' + n(Math.round(f.horas || 0)) + ' programadas')}</div>
        ${pres != null ? linhaMeta('Presença nos encontros', pres, 100).replace(/<small> de 100<\/small>/, '%') : ''}`)}
      ${cartao('Documentos do projeto', Object.keys(d.por_tipo || {}).length ? `<ul class="ac2-chips">${Object.entries(d.por_tipo).sort((x, y) => y[1] - x[1]).map(([k, q]) => `<li><b class="num">${n(q)}</b> ${E(TDP[k] ? (q === 1 ? TDP[k][0] : TDP[k][1]) : k)}${(d.ultima_data || {})[k] ? ` <small>· último em ${MQ.regras.fmtData((d.ultima_data || {})[k])}</small>` : ''}</li>`).join('')}</ul><p class="ac2-nota">Atas, relatórios, planos, ofícios, contratos e outros registros do projeto. Os arquivos e os títulos ficam com a coordenação.</p>` : '<p class="muted">Nenhum documento registrado ainda.</p>')}`;
  }
  function corpo(a) {
    const s = S(); const temFin = !!(a.extra && a.extra.financeiro);
    const abas = ABAS.filter(([k]) => k !== 'recursos' || temFin);
    let at = s.acAba && abas.some(([k]) => k === s.acAba) ? s.acAba : 'resumo';
    const conteudo = { resumo: abaResumo, metas: abaMetas, recursos: abaRecursos, territorio: abaTerritorio, mulheres: abaMulheres, equipe: abaEquipe }[at](a);
    return `<nav class="ac2-abas" role="tablist" aria-label="Partes do painel">${abas.map(([k, t]) => `<button type="button" role="tab" id="ac2-t-${k}" aria-selected="${k === at}" aria-controls="ac2-p" tabindex="${k === at ? 0 : -1}" data-acao="acomp-aba" data-a="${k}">${t}</button>`).join('')}</nav>
      <div class="ac2-painel" id="ac2-p" role="tabpanel" aria-labelledby="ac2-t-${at}" tabindex="0">${conteudo}${['resumo', 'metas', 'territorio', 'equipe'].includes(at) ? '<p class="leg-cores"><i class="lc-ok" aria-hidden="true"></i>verde: meta cumprida <i class="lc-falta" aria-hidden="true"></i>cinza: ainda falta · as situações "Atrasada" e "Atenção" comparam o feito com o previsto até o mês passado</p>' : ''}</div>
      ${a.extraSemBanco ? '<p class="ac-nota small muted">Parte dos números (eventos, canais de venda, água, curso e documentos) aparece quando a coordenação rodar o arquivo 65 no banco.</p>' : ''}
      <p class="ac-nota small muted">Números ao vivo, tirados dos registros feitos pela equipe do projeto. Esta área é só de leitura e mostra apenas contagens: não traz nome, CPF, endereço, foto nem dado bancário de ninguém.</p>`;
  }
  const quando = a => { const d = new Date(a.gerado_em || Date.now()); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  /* ---------- tela inteira de quem acompanha (cabeçalho próprio: nada da tela da equipe aparece aqui) ---------- */
  /* "Ver como o MDA vê" e "Ver como o MPA vê" (14/10/2026, no modelo do Saberes que Cultivam): a coordenação geral passa a ver a TELA
     INTEIRA de quem acompanha, com os números que o servidor entrega a esse órgão (a mesma função, com o mesmo corte), e uma faixa no
     alto para voltar. Continua com a própria conta; nada se grava nesse modo. Antes era uma janela no meio da tela. */
  const ver = () => S().verComo || null;
  function faixaPrevia() {
    const v = ver(); if (!v) return ''; const o = ORG[v.orgao], outro = v.orgao === 'mda' ? 'mpa' : 'mda';
    return `<div class="ac-faixa-previa" role="region" aria-label="Pré-visualização"><div class="ac-faixa-in">
      <p><b>Pré-visualização.</b> É assim que o ${o.sigla} vê o sistema: só leitura, só números, sem nome nem dado pessoal e sem a equipe. Você continua com a sua conta.</p>
      <span class="acoes"><button type="button" class="btn peq" data-acao="acomp-previa" data-o="${outro}">Ver como o ${ORG[outro].sigla} vê</button><button type="button" class="btn peq pri" data-acao="acomp-voltar" id="ac-voltar">Voltar à minha visão</button></span></div></div>`;
  }
  function pagina() {
    const s = S(), v = ver(), eu = v ? { nome: 'Prévia da coordenação', orgao: v.orgao } : s.eu, a = v ? v.dados : s.acomp, o = ORG[eu.orgao] || ORG.mda;
    return `${faixaPrevia()}<header class="barra"><div class="barra-in"><div class="marca"><img class="emb" src="assets/isotipo.svg" alt="" width="36" height="52"><img src="assets/logo-claro.svg" alt="Mulheres &amp; Quintais" width="112" height="36"><span class="sep" aria-hidden="true"></span>
        <span class="sis"><b>Acompanhamento do projeto</b>Quintais Produtivos para Mulheres Rurais</span></div>
        <div class="quem"><span><span class="nome">${E(eu.nome)}</span><br><span class="papel">Acompanhamento · ${o.sigla}</span></span>
        ${s.api.modo === 'supabase' && !v ? '<button class="btn-ajuda btn-sair" data-acao="sair" title="Sair do sistema" aria-label="Sair do sistema">' + (MQ.ICONES || {}).sair + '</button>' : ''}</div></div></header>
      <main class="wrap ac" id="conteudo"><div class="cab ac-cab"><div><span class="eyebrow">${o.sigla} · ${E(o.sub)}</span><h1>${E(o.titulo)}</h1>
          <p class="ac-vivo" role="status">${a ? `<span class="ac-pulso" aria-hidden="true"></span>Dados ao vivo · atualizado em ${quando(a)}` : s.acompErro ? '' : 'Carregando os números…'}</p></div>
          <div class="acoes ac-acoes foto-acoes">${(() => { const I = n => (MQ.ICONES || {})[n] || '';   // 18/10/2026: mesmo formato (pílula com ícone) dos botões de Meus dados
            return `<button class="btn foto-btn" data-acao="acomp-atualizar">${I('trocar')}<span>Atualizar agora</span></button><button class="btn foto-btn" data-acao="acomp-imprimir">${I('impressora')}<span>Imprimir ou salvar em PDF</span></button>
            <a class="btn foto-btn" href="manuais/guia-${o.manual}.pdf" target="_blank" rel="noopener">${I('guia')}<span>Como ler este painel</span></a>`; })()}</div></div>
        ${s.acompErro ? `<div class="aviso erro" role="alert"><b>Não foi possível carregar os números.</b> ${E(s.acompErro)} <button class="link" data-acao="acomp-atualizar">Tentar de novo</button></div>` : ''}
        ${a ? corpo(a) : ''}</main>
      <footer class="rodape"><div class="rodape-in"><div class="rodape-marca"><img src="assets/isotipo.svg" alt="" width="26" height="37"><span><b>Mulheres &amp; Quintais</b><small>Quintais Produtivos para Mulheres Rurais</small></span></div>
        <p class="rodape-org">IFRN Campus Apodi · MPA · FUNCERN</p><div class="rodape-lgpd"><p>Área só de leitura, com números agregados. Dados protegidos pela LGPD (Lei nº 13.709/2018).</p></div></div></footer>`;
  }
  async function carregar() {
    const s = S();
    try { s.acomp = await s.api.dadosAcompanhamento(); s.acompErro = null; s.semRede = false; }
    catch (e) { s.acompErro = e && e.semRede ? 'Sem internet no momento.' : (MQ.regras.mensagemErro ? MQ.regras.mensagemErro(e) : '') || (e && e.message) || 'Tente de novo em instantes.'; }
  }
  // ao vivo: busca de novo a cada 5 minutos enquanto a tela está aberta e visível
  let relogio = null;
  function vigiar() {
    if (relogio || typeof setInterval === 'undefined') return;
    relogio = setInterval(async () => { const s = S(); if (!s.eu || !s.eu.observador) { clearInterval(relogio); relogio = null; return; }
      if (typeof document !== 'undefined' && document.hidden) return; await carregar(); U().render(); }, 5 * 60 * 1000);
    if (relogio && relogio.unref) relogio.unref();
  }

  /* ---------- coordenação geral: quem acompanha, código de acesso e prévia das duas telas ---------- */
  /* Bloco da coordenação geral na aba Equipe, no mesmo modelo de "Agentes de campo": título da seção, um quadro com uma
     linha por órgão, as pessoas em cartões e o botão que abre o cadastro no painel lateral (04/10/2026). */
  const CORES = ['#3F6B66', '#6B7A3F', '#5C4A7A', '#7A5A44', '#8A4B3A', '#3F5F7A'];
  function avatarDe(x) {
    const p = String(x.nome || '?').trim().split(/\s+/).filter(k => k && !/^(d[aeo]s?|e)$/i.test(k));
    const ini = ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    let h = 0; for (const c of String(x.id || x.nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="av" style="--av:44px;--avc:${CORES[h % CORES.length]}" aria-hidden="true">${E(ini)}</span>`;
  }
  const situacaoDe = x => x.status !== 'ativo' ? ['off', 'Desativado'] : x.tem_senha ? ['ok', 'Já entrou'] : x.codigo_vale_ate ? ['pend', 'Código gerado'] : ['pend', 'Sem código'];
  const avisosCodigo = () => { const s = S(), l = s.observadores || [];
    return `${s.acompConfirma && l.some(x => x.id === s.acompConfirma) ? `<div class="aviso" role="alert"><b>Liberar um novo primeiro acesso para ${E(l.find(x => x.id === s.acompConfirma).nome)}?</b> Esta pessoa já tem senha. Ao gerar um novo código, a senha atual deixa de valer e ela cria outra.
        <span class="acoes"><button class="btn peq pri" data-acao="acomp-codigo" data-id="${E(s.acompConfirma)}" data-confirmado="1">Gerar novo código</button><button class="btn peq" data-acao="acomp-codigo-nao">Cancelar</button></span></div>` : ''}
      ${s.acompCodigo ? `<div class="aviso" role="status"><b>Código de primeiro acesso de ${E(s.acompCodigo.nome)}: <span class="num ac-cod">${E(s.acompCodigo.codigo)}</span></b><br>Vale 7 dias e uma vez só. Passe à pessoa junto com o e-mail cadastrado: na tela de entrada, ela toca em <b>Primeiro acesso</b>, informa o e-mail, o código e cria a senha. Este código não aparece de novo.</div>` : ''}`; };
  const painelAberto = () => { const p = S().painel; return !!(p && /^acomp-/.test(p.tipo)); };
  function blocoCoord() {
    const s = S(); if (s.eu.papel !== 'coord_geral') return '';
    const l = s.observadores || []; const pv = s.acompPrevia;
    const abre = `<section class="secao ac-coord" id="ac-coord" aria-labelledby="t-ac"><div class="secao-cab"><div><h2 id="t-ac">Acompanhamento externo (MDA e MPA)</h2>
      <p>Área própria, só de leitura e só com números · não vê nome, CPF, endereço, pagamento nem a equipe · os dois veem o projeto em abas · recursos só para o MDA, quando você liberar · só você cadastra e gera o código</p></div></div>`;
    if (s.obsSemBanco) return `${abre}<div class="bloco"><p class="nota">Para liberar o acesso de quem acompanha o projeto, rode o arquivo <b>52_acompanhamento.sql</b> no Supabase.</p></div></section>`;
    const linha = o => { const g = l.filter(x => x.orgao === o), n = g.filter(x => x.status === 'ativo').length;
      return `<div class="ag-tr" role="group" aria-label="${ORG[o].sigla}: ${n} ${n === 1 ? 'pessoa' : 'pessoas'}"><div class="ag-uf"><span class="sigla ac-sigla">${ORG[o].sigla}</span><span class="ag-nome"><b>${o === 'mda' ? 'Ministério' : 'Movimento parceiro'}</b>${g.length ? `<small>${n} ${n === 1 ? 'pessoa' : 'pessoas'}</small>` : ''}</span></div>
        <div class="ag-lista">${g.map(x => { const st = situacaoDe(x); return `<button class="vagabtn com-foto${x.status !== 'ativo' ? ' apagado' : ''}" data-acao="acomp-editar" data-id="${E(x.id)}">${avatarDe(x)}<span class="vb-t"><span class="nm">${E(x.nome)}</span><span><span class="chip ${st[0]}">${st[1]}</span></span><span class="sub">${E(x.cargo || x.email)}</span></span></button>`; }).join('') || `<p class="ag-vazio">Ninguém cadastrado ainda.</p>`}</div>
        <div class="ag-acao ac-acao">${MQ.botaoAcao({ acao: 'acomp-novo', icone: 'pessoa_mais', texto: 'Adicionar pessoa', rotulo: 'Adicionar pessoa do ' + ORG[o].sigla, sec: true, peq: true, attrs: `data-o="${o}"` })}${MQ.botaoAcao({ acao: 'acomp-previa', icone: 'ver', texto: o === 'mda' ? 'Ver como o MDA vê' : 'Ver como o MPA vê', sec: true, peq: true, attrs: `data-o="${o}"` })}</div></div>`; };
    return `${abre}<div class="ag-quadro"><div class="ag-th" aria-hidden="true"><span>Órgão</span><span>Quem acompanha</span><span></span></div>${linha('mda')}${linha('mpa')}</div>
      ${avisosCodigo()}</section>`;
  }
  /* Cadastro e alteração no painel lateral, como os demais cadastros da aba Equipe */
  function painel(p) {
    if (p.tipo === 'acomp-previa') { const pv = S().acompPrevia || {}, sg = (ORG[pv.orgao] || {}).sigla || '';
      return `<div class="painel-cab"><div class="t"><span class="eyebrow">Prévia · só você vê esta janela</span><h2 id="painel-t">Como o ${sg} vê o projeto</h2></div><button class="fechar" data-acao="fechar" aria-label="Fechar" autofocus>×</button></div>
        <div class="painel-corpo"><div class="ac ac-previa"><p class="nota">É isto que o ${sg} vê, com os números de agora. Aqui na prévia entram também os dados de exemplo e de simulação; o ${sg} de verdade não os vê.</p>${pv.dados ? corpo(pv.dados) : ''}</div></div>`; }
    const x = p.id ? (S().observadores || []).find(k => k.id === p.id) : null; const o = x ? x.orgao : (p.orgao || '');
    const obr = '<span class="ac-obr" aria-hidden="true">*</span>'; const st = x ? situacaoDe(x) : null;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${x ? 'Alterar cadastro' : 'Novo cadastro'}</span><h2 id="painel-t">Acompanhamento externo${ORG[o] ? ' · ' + ORG[o].sigla : ''}</h2>${st ? `<span><span class="chip ${st[0]}">${st[1]}</span></span>` : ''}</div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="acomp-pessoa" novalidate><input type="hidden" name="id" value="${x ? E(x.id) : ''}">
        <div class="fixo"><span class="small muted">Acesso</span><b>Só leitura, só números</b><span class="small">Entra numa área própria: não vê nome, CPF, endereço, pagamento nem a equipe.</span></div>
        <div class="campos"><div class="campo inteiro"><label for="ac-nome">Nome completo ${obr}</label><input id="ac-nome" name="nome" maxlength="120" autocomplete="off" value="${x ? E(x.nome) : ''}" required${x ? '' : ' autofocus'}></div>
          <div class="campo inteiro"><label for="ac-email">E-mail ${obr}</label><input id="ac-email" name="email" type="email" maxlength="160" autocomplete="off" value="${x ? E(x.email) : ''}" required></div>
          <div class="campo"><label for="ac-orgao">Órgão ${obr}</label><select id="ac-orgao" name="orgao" required><option value="">Escolha…</option><option value="mda"${o === 'mda' ? ' selected' : ''}>MDA (ministério)</option><option value="mpa"${o === 'mpa' ? ' selected' : ''}>MPA (movimento parceiro)</option></select></div>
          <div class="campo"><label for="ac-cargo">Cargo ou função (opcional)</label><input id="ac-cargo" name="cargo" maxlength="120" autocomplete="off" value="${x ? E(x.cargo || '') : ''}"></div></div>
        <label class="check"><input type="checkbox" name="ativo"${!x || x.status === 'ativo' ? ' checked' : ''}> Acesso ativo (desmarque para tirar o acesso desta pessoa)</label>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button>${x && x.status === 'ativo' ? `<button class="btn" type="button" data-acao="acomp-codigo" data-id="${E(x.id)}">${x.tem_senha ? 'Novo primeiro acesso' : 'Gerar código'}</button>` : ''}</div></form></div>`;
  }
  // o aviso de confirmação e o código saem no bloco da aba (o painel fecha): o código fica à vista até a pessoa sair da tela
  const redesenhar = () => { if (painelAberto()) U().fecharPainel(); U().render(); const a = document.querySelector('#ac-coord > .aviso'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'center' }); };
  async function clique(acao, el) {
    const s = S();
    const msg = e => U().toast((MQ.regras.mensagemErro ? MQ.regras.mensagemErro(e) : '') || (e && e.message) || 'Não deu certo. Tente de novo.');
    if (acao === 'acomp-atualizar' && s.verComo) { el.disabled = true; try { s.verComo = { orgao: s.verComo.orgao, dados: await s.api.dadosAcompanhamento(s.verComo.orgao) }; U().render(); U().toast('Números atualizados.'); } catch (e) { msg(e); el.disabled = false; } }
    else if (acao === 'acomp-atualizar') { el.disabled = true; await carregar(); U().render(); if (!s.acompErro) U().toast('Números atualizados.'); }
    else if (acao === 'acomp-imprimir') { window.print(); }
    else if (acao === 'acomp-aba') { s.acAba = el.dataset.a; U().render(); const b = document.getElementById('ac2-t-' + el.dataset.a); if (b) { b.focus({ preventScroll: true }); if (b.scrollIntoView) b.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } }
    else if (acao === 'acomp-previa') {
      if (s.eu.papel !== 'coord_geral') return;
      el.disabled = true;
      try {
        const dados = await s.api.dadosAcompanhamento(el.dataset.o);
        if (!s.verComo) { s.verComoVolta = { aba: s.aba, y: Math.round(window.scrollY || 0) }; if (U().previaNoHistorico) U().previaNoHistorico(true); }   // para voltar ao mesmo lugar (e o Voltar do navegador sair da prévia)
        if (U().fecharPainel && s.painel) U().fecharPainel({ semFoco: true, semHistorico: true });
        s.verComo = { orgao: el.dataset.o, dados }; s.acAba = 'resumo'; U().render(); window.scrollTo(0, 0);
        const b = document.getElementById('ac-voltar'); if (b) b.focus({ preventScroll: true });
      } catch (e) { msg(e); el.disabled = false; }
    }
    else if (acao === 'acomp-voltar') { sairPrevia(); }
    else if (acao === 'acomp-novo') { s.acompCodigo = null; s.acompConfirma = null; U().abrirPainel({ tipo: 'acomp-form', orgao: el.dataset.o }); }
    else if (acao === 'acomp-editar') { if (!(s.observadores || []).some(k => k.id === el.dataset.id)) return; s.acompCodigo = null; s.acompConfirma = null; U().abrirPainel({ tipo: 'acomp-form', id: el.dataset.id }); }
    else if (acao === 'acomp-codigo-nao') { s.acompConfirma = null; redesenhar(); }
    else if (acao === 'acomp-codigo') {
      const x = (s.observadores || []).find(k => k.id === el.dataset.id); if (!x) return;
      // quem já tem senha: o primeiro toque só avisa; o segundo (no aviso) gera o código e a senha antiga deixa de valer
      if (x.tem_senha && el.dataset.confirmado !== '1') { s.acompConfirma = x.id; s.acompCodigo = null; redesenhar(); return; }
      el.disabled = true;
      try { const codigo = await s.api.gerarCodigoObservador(x.id); s.observadores = await s.api.listarObservadores(); s.acompCodigo = { nome: x.nome, codigo }; s.acompConfirma = null; } catch (e) { msg(e); }
      redesenhar();
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'acomp-pessoa') return;
    const x = { id: String(fd.get('id') || '') || null, nome: String(fd.get('nome') || '').replace(/\s+/g, ' ').trim(), email: String(fd.get('email') || '').trim().toLowerCase(), orgao: String(fd.get('orgao') || ''), cargo: String(fd.get('cargo') || '').trim(), ativo: !!fd.get('ativo') };
    const e = {};
    if (x.nome.length < 5) e.nome = 'Escreva o nome completo.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) e.email = 'Confira o e-mail.';
    else if ((S().equipe || []).some(m => String(m.email || '').toLowerCase() === x.email)) e.email = 'Este e-mail já é de uma pessoa da equipe.';
    if (!ORG[x.orgao]) e.orgao = 'Escolha o órgão.';
    if (Object.keys(e).length) return U().mostrarErros(form, e);
    await U().ocupado(form, async () => { await S().api.salvarObservador(x); S().observadores = await S().api.listarObservadores(); S().acompCodigo = null; U().fecharPainel(); U().render(); U().toast('Cadastro de acompanhamento gravado.'); });
  }

  // abas do painel: setas esquerda/direita, Home e End trocam de aba (padrão de abas acessíveis)
  if (typeof document !== 'undefined') document.addEventListener('keydown', ev => {
    const t = ev.target; if (!t || !t.closest || !t.closest('.ac2-abas') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    const l = [...t.closest('.ac2-abas').querySelectorAll('[role=tab]')]; let i = l.indexOf(t);
    i = ev.key === 'Home' ? 0 : ev.key === 'End' ? l.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + l.length) % l.length;
    ev.preventDefault(); l[i].click();
  });
  MQ.acomp = { calcular, calcularExtra, pequeno, ORG, situacaoMetas, corpo };
  function sairPrevia(peloNavegador) {
    const s = S(); if (!s.verComo) return; const volta = s.verComoVolta || {}; s.verComo = null; s.verComoVolta = null;
    if (!peloNavegador && U().previaNoHistorico) U().previaNoHistorico(false);   // tira a entrada da prévia do histórico do navegador
    if (volta.aba) s.aba = volta.aba; U().render();
    window.scrollTo(0, volta.y || 0);
    const b = document.querySelector('#ac-coord [data-acao="acomp-previa"]'); if (b) b.focus({ preventScroll: true });
  }
  MQ.acompUI = { pagina, corpo, carregar, vigiar, blocoCoord, painel, clique, enviar, sairPrevia };
})();
