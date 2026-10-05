/* Mulheres & Quintais — perfis de ACOMPANHAMENTO (52_acompanhamento.sql): quem acompanha o projeto de fora.
   mda: o ministério que financia. Vê o projeto inteiro em números (alcance, etapas, mapa, evolução, perfil das
        beneficiárias e impacto). Nada de parte financeira.
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
        bolsistas: equipe.filter(m => m.uf === uf && (m.papel === 'articulacao' || m.papel === 'apoio')).length, agentes: equipe.filter(m => m.uf === uf && m.papel === 'agente').length };
    });
    const impl = new Set(vs.filter(v => v.etapa === 'implantacao' && v.situacao === 'realizada').map(v => v.ficha_id));
    const gm = {}; sel.forEach(f => { const k = f.uf + '|' + semAcento(f.municipio); const x = gm[k] || (gm[k] = { uf: f.uf, municipio: String(f.municipio).replace(/\s+/g, ' ').trim(), n: 0, implantados: 0 }); x.n++; if (impl.has(f.id)) x.implantados++; });
    const municipios = Object.values(gm).sort((a, b) => a.uf.localeCompare(b.uf) || a.municipio.localeCompare(b.municipio, 'pt-BR'));
    const mm = {}; vs.filter(v => v.situacao === 'realizada' && v.data_realizada).forEach(v => { const k = String(v.data_realizada).slice(0, 7); const x = mm[k] || (mm[k] = { mes: k, diagnostico: 0, implantacao: 0, acompanhamento: 0, avaliacao: 0 });
      x[['diagnostico', 'implantacao', 'acompanhamento'].includes(v.etapa) ? v.etapa : 'avaliacao']++; });
    const mensal = Object.values(mm).sort((a, b) => a.mes.localeCompare(b.mes));
    const r = { orgao, gerado_em: new Date().toISOString(), hoje, por_uf, municipios, mensal };
    if (orgao === 'mda') {
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
    } else {
      r.formacao = { turmas: (d.turmas || []).length, matriculas: (d.matriculas || []).length, encontros: (d.encontros || d.ficEncontros || []).length };
    }
    return r;
  }
  const total = (a, k) => (a.por_uf || []).reduce((t, u) => t + (+u[k] || 0), 0);

  /* ---------- peças de tela ---------- */
  const numeroGrande = (v, rot, sub) => `<div class="ac-kpi"><b class="num">${v}</b><span class="l">${E(rot)}</span>${sub ? `<small>${E(sub)}</small>` : ''}</div>`;
  // barra de progresso com o número ao lado (o valor nunca depende só da cor)
  function barra(rot, feito, alvo, nota) {
    const p = alvo ? Math.min(100, feito / alvo * 100) : 0;
    return `<div class="ac-barra"><div class="ac-barra-t"><span>${E(rot)}</span><b class="num">${n(feito)}${alvo ? `<small> de ${n(alvo)}</small>` : ''}</b></div>
      <span class="medidor" role="img" aria-label="${E(rot)}: ${n(feito)}${alvo ? ' de ' + n(alvo) + ' (' + Math.round(p) + '%)' : ''}"><i style="width:${p.toFixed(1)}%"></i></span>${nota ? `<small class="muted">${E(nota)}</small>` : ''}</div>`;
  }
  /* metas físicas: a mesma conta e a mesma situação que a coordenação vê na Visão geral */
  function metas(a) {
    if (!MQ.painelUI || !MQ.painelUI.infoMeta) return '';
    const feitas = (k, etapa) => Array.from({ length: total(a, k) }, () => ({ etapa, situacao: 'realizada' }));
    const falso = { diagnosticos: Array.from({ length: total(a, 'diagnosticos') }, (_, i) => ({ situacao: i < total(a, 'planos') ? 'aprovado' : 'aguardando' })),
      visitas: feitas('implantados', 'implantacao').concat(feitas('acompanhamentos', 'acompanhamento')) };
    const mes = MQ.painelUI.mesDoProjeto(new Date(String(a.hoje || MQ.regras.hoje()) + 'T12:00:00'));
    return MQ.METAS.filter(m => ['diagnostico', 'implantacao', 'visitas'].includes(m.fonte)).map(m => { const i = MQ.painelUI.infoMeta(m, falso, { aptas: [], pagaveis: [] }, mes);
      return `<div class="ac-meta"><div class="ac-meta-t"><span class="eyebrow">Meta ${E(m.id.slice(1))}</span><b>${E(m.nome)}</b>${MQ.painelUI.chipStatus(i.st)}</div>
        <div class="ac-meta-n"><b class="num">${n(i.atual)}</b><span> de ${n(i.alvo)} ${E(i.un)}</span></div>
        <span class="medidor" role="img" aria-label="${Math.round(i.pct)}% da meta"><i class="${MQ.painelUI.STATUS[i.st] ? MQ.painelUI.STATUS[i.st].cls : ''}" style="width:${i.pct.toFixed(1)}%"></i></span>
        <small class="muted">Previsto no plano de trabalho: do mês ${m.ini} ao mês ${m.fim} do projeto.</small></div>`; }).join('');
  }
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
    const svg = MQ.painelUI && MQ.painelUI.mapaUFs ? MQ.painelUI.mapaUFs({ entrada: true, municipios: mun }) : '';
    const top = (a.municipios || []).slice().sort((x, y) => y.n - x.n).slice(0, 8);
    return `<div class="ac-duo"><div class="ac-mapa vit-mapa vit-info" aria-hidden="true">${svg}</div>
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
        <p class="ac-frase"><b class="num">${n(i.base_n)}</b> famílias com diagnóstico feito${i.renda_quintal_media != null ? `. Venda média do quintal antes do projeto: <b class="num">${MQ.regras.fmtBRL(i.renda_quintal_media)}</b> por mês.` : '.'}</p>
        <p class="small muted">O diagnóstico registra produção, renda e alimentação da família antes da implantação. É a referência para medir o que mudou.</p></div>
      <div class="bloco"><h3>Depois do quintal (avaliação final)</h3>
        ${i.final_n ? `<p class="ac-frase"><b class="num">${n(i.final_n)}</b> quintais já avaliados na 5ª visita.</p>
          <dl class="dl">${Object.entries(PROD).map(([k, t]) => `<dt>${t}</dt><dd>${mostra((i.produz || {})[k] || 0)}</dd>`).join('')}${Object.entries(NIV).map(([k, t]) => `<dt>${t}</dt><dd>${mostra((i.ebia_final || {})[k] || 0)}</dd>`).join('')}</dl>
          <p class="small muted">Situação alimentar pela Escala Brasileira de Insegurança Alimentar (EBIA).</p>`
          : '<p class="muted">A avaliação final é a 5ª visita a cada quintal. Os resultados aparecem aqui quando as primeiras forem feitas.</p>'}</div></div>`;
  }
  function funil(a) {
    return `<div class="ac-funil">${barra('Mulheres indicadas pelas comunidades', total(a, 'indicadas'), 0)}${barra('Selecionadas e aprovadas', total(a, 'selecionadas'), ALVO.selecionadas)}
      ${barra('Diagnósticos feitos', total(a, 'diagnosticos'), ALVO.diagnosticos)}${barra('Planos de quintal aprovados', total(a, 'planos'), ALVO.diagnosticos)}
      ${barra('Quintais implantados', total(a, 'implantados'), ALVO.implantados)}${barra('Visitas de acompanhamento', total(a, 'acompanhamentos'), ALVO.acompanhamentos)}${barra('Avaliações finais', total(a, 'avaliacoes'), ALVO.avaliacoes)}</div>`;
  }
  function estados(a) {
    return `<div class="ac-ufs">${a.por_uf.map(u => `<section class="bloco ac-uf" aria-label="${E(U().nomeUF ? U().nomeUF(u.uf) : u.uf)}"><h3>${E(U().nomeUF ? U().nomeUF(u.uf) : u.uf)}${u.atrasadas ? ` <span class="chip crit">${n(u.atrasadas)} visita${u.atrasadas > 1 ? 's' : ''} atrasada${u.atrasadas > 1 ? 's' : ''}</span>` : ' <span class="chip ok">Visitas em dia</span>'}</h3>
        ${barra('Selecionadas', u.selecionadas, ALVO_UF.selecionadas)}${barra('Diagnósticos', u.diagnosticos, ALVO_UF.diagnosticos)}${barra('Quintais implantados', u.implantados, ALVO_UF.implantados)}${barra('Acompanhamentos', u.acompanhamentos, ALVO_UF.acompanhamentos)}
        <dl class="dl ac-dl"><dt>Equipe no estado</dt><dd>${n(u.bolsistas)} bolsista${u.bolsistas === 1 ? '' : 's'} e ${n(u.agentes)} agente${u.agentes === 1 ? '' : 's'} de campo</dd>
          <dt>Comunidades</dt><dd>${n(u.comunidades)} em ${n(u.municipios)} município${u.municipios === 1 ? '' : 's'}</dd><dt>Visitas agendadas</dt><dd>${n(u.agendadas)}</dd>
          <dt>Lista de espera</dt><dd>${n(u.espera)}</dd><dt>Sem água na seca</dt><dd>${n(u.sem_agua + u.diag_sem_agua)}</dd></dl></section>`).join('')}</div>`;
  }
  function parados(a) {
    const atr = total(a, 'atrasadas'), agua = total(a, 'sem_agua') + total(a, 'diag_sem_agua'), esp = total(a, 'espera');
    const semEq = a.por_uf.filter(u => u.bolsistas < 2).map(u => u.uf);
    const it = [];
    if (atr) it.push(`<li><b>${n(atr)} visita${atr > 1 ? 's' : ''} com a data vencida</b> e ainda sem registro: ${a.por_uf.filter(u => u.atrasadas).map(u => u.uf + ' ' + u.atrasadas).join(', ')}.</li>`);
    if (semEq.length) it.push(`<li><b>Equipe incompleta</b> (menos de 2 bolsistas) em: ${semEq.join(', ')}.</li>`);
    if (agua) it.push(`<li><b>${n(agua)} mulher${agua > 1 ? 'es' : ''} sem água que dure na seca</b>: não recebem o kit até haver solução (cisterna ou outro programa).</li>`);
    if (esp) it.push(`<li><b>${n(esp)} na lista de espera</b>, para o caso de alguma vaga abrir.</li>`);
    return it.length ? `<ul class="ac-lista">${it.join('')}</ul>` : '<p class="muted">Nada parado no momento.</p>';
  }

  function corpo(a) {
    const kp = a.orgao === 'mda'
      ? numeroGrande(n(total(a, 'selecionadas')), 'mulheres selecionadas', 'de 200 previstas') + numeroGrande(n(total(a, 'pessoas')), 'pessoas nas famílias') + numeroGrande(n(total(a, 'implantados')), 'quintais implantados', 'de 200 previstos')
        + numeroGrande(n(total(a, 'municipios')), 'municípios') + numeroGrande(n(total(a, 'comunidades')), 'comunidades rurais') + numeroGrande(n(total(a, 'visitas_feitas')), 'visitas de campo feitas', 'de 1.000 previstas')
      : numeroGrande(n(total(a, 'selecionadas')), 'mulheres selecionadas', 'de 200 previstas') + numeroGrande(n(total(a, 'comunidades')), 'comunidades', 'em ' + n(total(a, 'municipios')) + ' municípios') + numeroGrande(n(total(a, 'bolsistas') + total(a, 'agentes')), 'pessoas da equipe de campo')
        + numeroGrande(n(total(a, 'visitas_feitas')), 'visitas feitas') + numeroGrande(n(total(a, 'agendadas')), 'visitas agendadas') + numeroGrande(n(total(a, 'atrasadas')), 'visitas atrasadas');
    const sec = (id, t, sub, h) => `<section class="ac-sec" id="ac-${id}" aria-labelledby="ac-${id}-t"><h2 id="ac-${id}-t">${t}</h2>${sub ? `<p class="ac-sub">${sub}</p>` : ''}${h}</section>`;
    const area = total(a, 'area_m2');
    return `<div class="ac-kpis" aria-label="Resumo">${kp}</div>`
      + (a.orgao === 'mda'
        ? sec('caminho', 'O caminho de cada quintal', 'Da indicação da mulher pela comunidade até a avaliação final, cada etapa é registrada no sistema, com data, local e foto.', funil(a))
          + sec('metas', 'Metas físicas do plano de trabalho', 'O número de cada meta vem dos próprios registros de campo.', `<div class="ac-metas">${metas(a)}</div>`)
          + sec('mapa', 'Onde o projeto está', `${n(total(a, 'municipios'))} municípios em 5 estados do Nordeste${area ? `, com ${n(area)} m² de quintais diagnosticados` : ''}.`, mapa(a) + tabelaUF(a, false))
          + sec('evolucao', 'Evolução do trabalho de campo', 'Visitas feitas em cada mês.', evolucao(a))
          + sec('perfil', 'Quem são as mulheres', 'As prioridades de seleção do projeto, em números. Sem nome nem dado pessoal.', perfil(a))
          + sec('impacto', 'O que muda na vida das famílias', 'As mesmas perguntas são feitas antes da implantação e na avaliação final.', impacto(a))
        : sec('estados', 'Estado por estado', 'Metas por estado: 40 mulheres, 40 diagnósticos, 40 quintais e 80 visitas de acompanhamento.', estados(a))
          + sec('parado', 'O que pede atenção', 'O que está atrasado ou esperando solução no território.', parados(a))
          + sec('formacao', 'Formação da equipe', 'Curso de formação das bolsistas e agentes de campo.', `<div class="ac-kpis ac-kpis-3">${numeroGrande(n((a.formacao || {}).turmas), 'turmas')}${numeroGrande(n((a.formacao || {}).matriculas), 'matrículas')}${numeroGrande(n((a.formacao || {}).encontros), 'encontros registrados')}</div>`)
          + sec('mapa', 'Onde o projeto está', `${n(total(a, 'comunidades'))} comunidades em ${n(total(a, 'municipios'))} municípios.`, mapa(a) + tabelaUF(a, true))
          + sec('evolucao', 'Evolução do trabalho de campo', 'Visitas feitas em cada mês.', evolucao(a)))
      + `<p class="ac-nota small muted">Números ao vivo, tirados dos registros feitos pela equipe do projeto. Esta área é só de leitura e mostra apenas contagens: não traz nome, CPF, endereço, foto nem dado bancário de ninguém. Dados de exemplo usados em testes ficam fora das contas.</p>`;
  }
  const quando = a => { const d = new Date(a.gerado_em || Date.now()); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  /* ---------- tela inteira de quem acompanha (cabeçalho próprio: nada da tela da equipe aparece aqui) ---------- */
  function pagina() {
    const s = S(), eu = s.eu, a = s.acomp, o = ORG[eu.orgao] || ORG.mda;
    return `<header class="barra"><div class="barra-in"><div class="marca"><img class="emb" src="assets/isotipo.svg" alt="" width="36" height="52"><img src="assets/logo-claro.svg" alt="Mulheres &amp; Quintais" width="112" height="36"><span class="sep" aria-hidden="true"></span>
        <span class="sis"><b>Acompanhamento do projeto</b>Quintais Produtivos para Mulheres Rurais</span></div>
        <div class="quem"><span><span class="nome">${E(eu.nome)}</span><br><span class="papel">Acompanhamento · ${o.sigla}</span></span>
        ${s.api.modo === 'supabase' ? '<button class="btn-ajuda btn-sair" data-acao="sair" title="Sair do sistema" aria-label="Sair do sistema"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3"/><path d="M4 12h11"/><path d="M11 8l4 4-4 4"/></svg></button>' : ''}</div></div></header>
      <main class="wrap ac" id="conteudo"><div class="cab ac-cab"><div><span class="eyebrow">${o.sigla} · ${E(o.sub)}</span><h1>${E(o.titulo)}</h1>
          <p class="ac-vivo" role="status">${a ? `<span class="ac-pulso" aria-hidden="true"></span>Dados ao vivo · atualizado em ${quando(a)}` : s.acompErro ? '' : 'Carregando os números…'}</p></div>
          <div class="acoes ac-acoes"><button class="btn" data-acao="acomp-atualizar">Atualizar agora</button><button class="btn" data-acao="acomp-imprimir">Imprimir ou salvar em PDF</button>
            <a class="btn" href="manuais/guia-${o.manual}.pdf" target="_blank" rel="noopener">Como ler este painel</a></div></div>
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
  const painelAberto = () => { const p = S().painel; return !!(p && p.tipo === 'acomp-form'); };
  function blocoCoord() {
    const s = S(); if (s.eu.papel !== 'coord_geral') return '';
    const l = s.observadores || []; const pv = s.acompPrevia;
    const abre = `<section class="secao ac-coord" id="ac-coord" aria-labelledby="t-ac"><div class="secao-cab"><div><h2 id="t-ac">Acompanhamento externo (MDA e MPA)</h2>
      <p>Área própria, só de leitura e só com números · não vê nome, CPF, endereço, pagamento nem a equipe · o MDA vê o projeto inteiro, sem parte financeira · o MPA vê o andamento em cada estado · só você cadastra e gera o código</p></div></div>`;
    if (s.obsSemBanco) return `${abre}<div class="bloco"><p class="nota">Para liberar o acesso de quem acompanha o projeto, rode o arquivo <b>52_acompanhamento.sql</b> no Supabase.</p></div></section>`;
    const linha = o => { const g = l.filter(x => x.orgao === o), n = g.filter(x => x.status === 'ativo').length;
      return `<div class="ag-tr" role="group" aria-label="${ORG[o].sigla}: ${n} ${n === 1 ? 'pessoa' : 'pessoas'}"><div class="ag-uf"><span class="sigla ac-sigla">${ORG[o].sigla}</span><span class="ag-nome"><b>${o === 'mda' ? 'Ministério' : 'Movimento parceiro'}</b>${g.length ? `<small>${n} ${n === 1 ? 'pessoa' : 'pessoas'}</small>` : ''}</span></div>
        <div class="ag-lista">${g.map(x => { const st = situacaoDe(x); return `<button class="vagabtn com-foto${x.status !== 'ativo' ? ' apagado' : ''}" data-acao="acomp-editar" data-id="${E(x.id)}">${avatarDe(x)}<span class="vb-t"><span class="nm">${E(x.nome)}</span><span><span class="chip ${st[0]}">${st[1]}</span></span><span class="sub">${E(x.cargo || x.email)}</span></span></button>`; }).join('') || `<p class="ag-vazio">Ninguém cadastrado ainda.</p>`}</div>
        <div class="ag-acao">${MQ.botaoAcao({ acao: 'acomp-novo', icone: 'pessoa_mais', texto: 'Adicionar pessoa', rotulo: 'Adicionar pessoa do ' + ORG[o].sigla, sec: true, peq: true, attrs: `data-o="${o}"` })}</div></div>`; };
    const ver = (o, icone) => MQ.botaoAcao({ acao: 'acomp-previa', icone, texto: o === 'mda' ? 'Ver como o MDA vê' : 'Ver como o MPA vê', sec: true, peq: true, attrs: `data-o="${o}" aria-pressed="${!!(pv && pv.orgao === o)}"` });
    return `${abre}<div class="ag-quadro"><div class="ag-th" aria-hidden="true"><span>Órgão</span><span>Quem acompanha</span><span></span></div>${linha('mda')}${linha('mpa')}</div>
      ${avisosCodigo()}
      <div class="acoes ac-ver">${ver('mda', 'ver')}${ver('mpa', 'ver')}${pv ? '<button class="btn" data-acao="acomp-previa-fechar">Fechar a prévia</button>' : ''}</div>
      ${pv ? `<div class="ac ac-previa" aria-label="Prévia da tela de acompanhamento"><p class="nota">Prévia: é isto que ${ORG[pv.orgao].sigla === 'MDA' ? 'o MDA' : 'o MPA'} vê, com os números de agora. Dados de exemplo não entram na conta de quem acompanha.</p>${corpo(pv.dados)}</div>` : ''}</section>`;
  }
  /* Cadastro e alteração no painel lateral, como os demais cadastros da aba Equipe */
  function painel(p) {
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
        <div class="acoes"><button class="btn pri" type="submit">Gravar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button>${x && x.status === 'ativo' ? `<button class="btn" type="button" data-acao="acomp-codigo" data-id="${E(x.id)}">${x.tem_senha ? 'Novo primeiro acesso' : 'Gerar código'}</button>` : ''}</div></form></div>`;
  }
  // o aviso de confirmação e o código saem no bloco da aba (o painel fecha): o código fica à vista até a pessoa sair da tela
  const redesenhar = () => { if (painelAberto()) U().fecharPainel(); U().render(); const a = document.querySelector('#ac-coord > .aviso'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'center' }); };
  async function clique(acao, el) {
    const s = S();
    const msg = e => U().toast((MQ.regras.mensagemErro ? MQ.regras.mensagemErro(e) : '') || (e && e.message) || 'Não deu certo. Tente de novo.');
    if (acao === 'acomp-atualizar') { el.disabled = true; await carregar(); U().render(); if (!s.acompErro) U().toast('Números atualizados.'); }
    else if (acao === 'acomp-imprimir') { window.print(); }
    else if (acao === 'acomp-previa') { el.disabled = true; try { s.acompPrevia = { orgao: el.dataset.o, dados: await s.api.dadosAcompanhamento(el.dataset.o) }; } catch (e) { msg(e); } U().render(); }
    else if (acao === 'acomp-previa-fechar') { s.acompPrevia = null; U().render(); }
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

  MQ.acomp = { calcular, pequeno, ORG };
  MQ.acompUI = { pagina, corpo, carregar, vigiar, blocoCoord, painel, clique, enviar };
})();
