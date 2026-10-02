/* Mulheres & Quintais — pedidos de passagem aérea e de estrutura de evento (Guia "Viagens, ajuda de custo e eventos").
   Caminho: a bolsista de articulação estadual pede → a coordenação técnica confere (ou devolve)
   → a coordenação geral autoriza e manda para a FUNCERN (ou recusa ou devolve).
   Sem coordenação técnica ativa, quem confere é o auxiliar administrativo; sem os dois, a geral
   (26_conferencia_auxiliar.sql). Quem conferiu não autoriza o mesmo pedido: sempre duas pessoas. */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const PRAZO = { passagem: 40, evento: 45 };
  const PREVISTO = { intercambio: 25, pedagogico: 8, evento: 5 };
  const FIM_PROJETO = '2027-09-30';
  const FINALIDADE = { intercambio: 'Intercâmbio entre as beneficiárias', pedagogico: 'Acompanhamento pedagógico' };
  const TIPO = { passagem: 'Passagem aérea', evento: 'Estrutura de evento' };
  const NOME_CONF = { coord_tecnico: 'a coordenação técnica', auxiliar_adm: 'o auxiliar administrativo', coord_geral: 'a coordenação geral' };
  const conf = () => S().quemConfere || 'coord_tecnico';            // quem confere agora
  const legado = () => !S().quemConfere;                            // 26 ainda não instalado: regra antiga
  const nomeConf = () => NOME_CONF[conf()];
  const souConferente = () => !!(S().eu && S().eu.papel === conf());
  const SIT = {
    enviado: ['pend', 'Com a coordenação técnica'], devolvido: ['crit', 'Devolvido para corrigir'], conferido: ['pend', 'Com a coordenação geral'],
    autorizado: ['ok', 'Autorizado · enviado à FUNCERN'], recusado: ['crit', 'Recusado'], cancelado: ['', 'Cancelado']
  };
  const BAGAGEM = { mao: 'Só bagagem de mão (até 10 kg)', despachada: 'Bagagem despachada (até 23 kg)' };
  const SEXO = { F: 'Feminino', M: 'Masculino', O: 'Outro' };
  const ESTRUTURA = [['espaco', 'Espaço'], ['tenda', 'Tenda'], ['som', 'Som'], ['projetor', 'Projetor'], ['banheiro', 'Banheiro'], ['energia', 'Energia / gerador']];
  const lista = () => S().pedidos || [];
  const pessoa = id => U().porId(id) || {};
  const nomeDe = m => (m && (m.nome_social || m.nome)) || '—';
  const sit = p => SIT[p.situacao] || ['', E(p.situacao || '—')];   // situação nova no banco não derruba a tela
  const rotSit = p => p.situacao === 'enviado' ? 'Com ' + nomeConf() : sit(p)[1];
  const chip = p => `<span class="chip ${sit(p)[0]}">${rotSit(p)}</span>`;
  const podeVer = papel => ['articulacao', 'coord_tecnico', 'coord_geral'].includes(papel);
  /* ---------- tetos: R$ 6.000 por estado para eventos; R$ 70.000 para passagens (35_tetos_passagens_eventos.sql) ---------- */
  const brl = v => R.fmtBRL(+v || 0);
  /* valor digitado: "-500" e "(500)" continuam negativos (antes o sinal era jogado fora e virava +500) para a tela recusar */
  const valorBR = t => { const txt = String(t || '').replace(/\u2212/g, '-').trim(); const neg = /^(R\$)?\s*\(?\s*-/.test(txt) || /^\(.*\)$/.test(txt) || /-$/.test(txt);
    const n = R.valorBR(txt.replace(/[^\d,.]/g, '')); return isNaN(n) ? null : neg ? -n : n; };
  const MAX_JUSTIFICATIVA = 2000, MAX_PARTICIPANTES = 5000;
  /* data de nascimento de passageira: AAAA-MM-DD que existe no calendário, de 1900 até hoje */
  const erroNascimento = v => { const t = String(v || ''); if (!t) return 'Informe a data.';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!m || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return 'Data de nascimento inválida.';
    if (t > R.hoje()) return 'A data de nascimento não pode ser no futuro.';
    if (t < '1900-01-01') return 'Data de nascimento inválida: confira o ano.';
    return null; };
  let seqPass = 0;   // número único de cada bloco de passageira, para ligar cada rótulo (label for) ao seu campo
  function saldo(tipo, uf, semId) {
    const teto = MQ.TETOS[tipo]; const sd = S().saldoPed;
    let usado;
    if (sd && !semId) usado = tipo === 'passagem' ? +sd.passagem_usado || 0 : +((sd.evento_usado || {})[uf]) || 0;
    else usado = lista().filter(p => p.situacao === 'autorizado' && p.tipo === tipo && (tipo === 'passagem' || p.uf === uf) && p.id !== semId).reduce((t, p) => t + (+p.valor_autorizado || 0), 0);
    return { teto, usado, livre: Math.max(0, teto - usado) };
  }
  const rotSaldo = (tipo, uf) => { const x = saldo(tipo, uf); return tipo === 'evento' ? `Teto de eventos de ${uf}: ${brl(x.teto)} · já autorizado ${brl(x.usado)} · saldo <b>${brl(x.livre)}</b>` : `Teto de passagens do projeto: ${brl(x.teto)} · já autorizado ${brl(x.usado)} · saldo <b>${brl(x.livre)}</b>`; };
  const semBanco = () => '<div class="aviso">Os pedidos de passagem e de evento ainda não estão instalados no servidor. A coordenação geral roda o arquivo <b>22_passagens_eventos.sql</b> no Supabase.</div>';
  const diasAte = R.diasAte;
  const minhaVez = p => { const eu = S().eu;
    return (souConferente() && p.situacao === 'enviado' && p.solicitante_id !== eu.id) || (eu.papel === 'coord_geral' && p.situacao === 'conferido'); };
  const nPass = p => p.tipo === 'passagem' ? ((p.dados && p.dados.passageiros) || []).length : 0;

  /* ---------- bolsista de articulação ---------- */
  function secaoBolsista() {
    const eu = S().eu; if (!eu || eu.papel !== 'articulacao') return '';
    if (S().pedSemBanco) return `<section class="secao"><h2>Passagens aéreas e eventos</h2>${semBanco()}</section>`;
    const meus = lista().filter(p => p.solicitante_id === eu.id);
    const dev = meus.filter(p => p.situacao === 'devolvido');
    return `<section class="secao viag" aria-labelledby="t-viag">
      <div class="secao-cab"><div><h2 id="t-viag">Passagens aéreas e eventos</h2>
        <p>Você pede, ${nomeConf()} confere e a coordenação geral autoriza e manda para a FUNCERN. <b>Nunca compre, contrate ou pague nada por conta própria:</b> despesa sem autorização não é reembolsada.</p></div></div>
      ${dev.length ? `<div class="aviso erro"><b>${dev.length} pedido${dev.length > 1 ? 's' : ''} devolvido${dev.length > 1 ? 's' : ''} para corrigir.</b> Abra, veja o motivo e reenvie.</div>` : ''}
      <div class="acoes-pag">${MQ.acaoComDica({ acao: 'viag-nova', icone: 'aviao', texto: 'Pedir passagem aérea', curto: 'Pedir passagem', attrs: 'data-t="passagem"' }, `Intercâmbio ou acompanhamento pedagógico. Envie <b>${PRAZO.passagem} dias antes</b> da viagem.`)}
        ${MQ.acaoComDica({ acao: 'viag-nova', icone: 'tenda', texto: 'Pedir estrutura de evento', curto: 'Pedir evento', sec: true, attrs: 'data-t="evento"' }, `Espaço, cadeiras, tenda, som, alimentação. Envie <b>${PRAZO.evento} dias antes</b> do evento.`)}</div>
      ${['passagem', 'evento'].map(tipo => { const xs = meus.filter(p => p.tipo === tipo);
        return `<div class="viag-meus"><h3 class="viag-sub">Meus pedidos de ${tipo === 'passagem' ? 'passagem aérea' : 'evento'} (${xs.length})</h3>
          <p class="small muted">${rotSaldo(tipo, eu.uf)}</p>
          ${xs.length ? `<div class="pag-lista">${xs.map(p => linha(p, false)).join('')}</div>` : `<p class="small muted">Nenhum pedido de ${tipo === 'passagem' ? 'passagem' : 'evento'} ainda.</p>`}</div>`; }).join('')}
    </section>`;
  }

  function linha(p, comPessoa) {
    const d = diasAte(p.data_ref);
    const quando = p.tipo === 'passagem' ? 'Ida ' + R.fmtData(p.data_ref) : 'Evento ' + R.fmtData(p.data_ref);
    const extra = p.tipo === 'passagem' ? ` · ${nPass(p)} passageira${nPass(p) === 1 ? '' : 's'}` : '';
    const alerta = ['enviado', 'conferido'].includes(p.situacao) && d < 30 ? ` · <b style="color:var(--crit)">${d < 0 ? 'a data já passou' : d === 0 ? 'é hoje' : 'faltam ' + d + ' dia' + (d > 1 ? 's' : '')}</b>` : '';
    return `<button class="vagabtn ficha-linha viag-linha" data-acao="viag-ver" data-id="${E(p.id)}">
      <span class="nm">${E(TIPO[p.tipo])} · ${E(p.uf)}</span>
      <span class="small muted">${comPessoa ? E(nomeDe(pessoa(p.solicitante_id))) + ' · ' : ''}${quando}${extra}${alerta}</span>
      <span class="small">${E(p.titulo)}</span>
      <span>${chip(p)}</span></button>`;
  }

  /* ---------- gastos separados: passagens (teto do projeto) e eventos (teto por estado) ---------- */
  const EM_ANALISE = ['enviado', 'conferido', 'devolvido'];
  const estimado = p => +((p.dados || {}).valor_estimado) || 0;
  function gastos(tipo, uf) {   // autorizado = valor da coordenação; em análise = valor estimado de quem pediu
    const xs = lista().filter(p => p.tipo === tipo && (!uf || p.uf === uf));
    const x = saldo(tipo, uf);
    const analise = xs.filter(p => EM_ANALISE.includes(p.situacao)).reduce((t, p) => t + estimado(p), 0);
    return { teto: x.teto, usado: x.usado, livre: x.livre, analise, estoura: x.usado + analise > x.teto };
  }
  const medidor = g => `<span class="medidor" title="autorizado e em análise"><i style="width:${Math.min(100, (g.usado + g.analise) / g.teto * 100)}%;opacity:.35"></i><i style="width:${Math.min(100, g.usado / g.teto * 100)}%"></i></span>`;
  const usoTeto = g => { const p = g.teto ? Math.round(g.usado / g.teto * 1000) / 10 : 0; return `<span class="fin-exe"><span class="medidor fino" aria-hidden="true"><i class="${g.usado > 0 ? 'st-ok' : ''}" style="width:${Math.min(100, p)}%"></i></span><b class="num">${p.toLocaleString('pt-BR')}%</b></span>`; };
  function cartaoGasto(g, rot) {
    return `<div class="viag-gasto">
      <div class="vg-lin"><span>${rot}</span><b class="num">${brl(g.usado)}<small class="muted"> de ${brl(g.teto)}</small></b></div>
      ${medidor(g)}
      <div class="vg-lin small"><span class="muted">Em análise (valor estimado): ${brl(g.analise)}</span><span>Saldo <b class="num">${brl(g.livre)}</b></span></div>
      ${g.estoura ? '<p class="small" style="color:var(--crit);margin:4px 0 0">Autorizado + em análise passa do teto: nem todos os pedidos cabem.</p>' : ''}</div>`;
  }

  /* ---------- coordenação: aba Viagens e eventos ---------- */
  function abaCoord() {
    if (S().pedSemBanco) return `<div class="cab"><div><span class="eyebrow">Viagens e eventos</span><h1>Passagens e eventos</h1></div></div>${semBanco()}`;
    const souGeral = S().eu.papel === 'coord_geral';
    const l = lista();
    const vezTodos = l.filter(minhaVez);
    const aut = l.filter(p => p.situacao === 'autorizado');
    const usados = f => aut.filter(p => p.tipo === 'passagem' && (p.dados || {}).finalidade === f).reduce((t, p) => t + nPass(p), 0);
    const ufsEvento = new Set(aut.filter(p => p.tipo === 'evento').map(p => p.uf));
    const tituloVez = souGeral ? (conf() === 'coord_geral' ? 'Esperando você (conferir ou autorizar)' : 'Esperando a sua autorização') : 'Esperando a sua conferência';
    const bloco = (t, xs, vazio) => `<div class="viag-bloco"><h3>${t} <span class="conta-t${xs.length ? '' : ' zero'}">${xs.length}</span></h3>
      ${xs.length ? `<div class="pag-lista">${xs.map(p => linha(p, true)).join('')}</div>` : `<p class="muted small">${vazio}</p>`}</div>`;
    const listas = tipo => { const t = l.filter(p => p.tipo === tipo);
      const vez = t.filter(minhaVez), outros = t.filter(p => ['enviado', 'conferido'].includes(p.situacao) && !minhaVez(p));
      const dev = t.filter(p => p.situacao === 'devolvido'), au = t.filter(p => p.situacao === 'autorizado'), fim = t.filter(p => ['recusado', 'cancelado'].includes(p.situacao));
      return `${bloco(tituloVez, vez, 'Nada esperando você.')}
        ${outros.length ? bloco(souGeral ? 'Com ' + nomeConf() + (legado() ? ' (você pode conferir se ela não puder)' : '') : 'Com a coordenação geral', outros, '') : ''}
        ${dev.length ? bloco('Devolvidos para a bolsista corrigir', dev, '') : ''}
        <details class="hist"><summary>Autorizados (${au.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${au.map(p => linha(p, true)).join('') || '<p class="muted">Nenhum ainda.</p>'}</div></details>
        ${fim.length ? `<details class="hist"><summary>Recusados e cancelados (${fim.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${fim.map(p => linha(p, true)).join('')}</div></details>` : ''}`; };
    const gp = gastos('passagem');
    const ge = MQ.UFS.map(u => Object.assign({ uf: u.uf, nome: u.nome }, gastos('evento', u.uf)));
    const somaE = k => ge.reduce((t, g) => t + g[k], 0);
    const nVez = tipo => vezTodos.filter(p => p.tipo === tipo).length;
    return `<div class="cab"><div><span class="eyebrow">Viagens e eventos</span><h1>Passagens e eventos</h1>
        <p>A bolsista de articulação estadual pede; ${souGeral ? (conf() === 'coord_geral' ? 'você confere e autoriza' : nomeConf() + ' confere; você autoriza') + ' e manda para a FUNCERN, que compra ou contrata.' : 'você confere e manda para a coordenação geral, que autoriza e manda para a FUNCERN.'}
        Prazos: passagem ${PRAZO.passagem} dias antes da viagem (a FUNCERN exige 30); evento ${PRAZO.evento} dias antes. <b>Os gastos são separados:</b> passagens têm um teto para o projeto todo; eventos, um teto por estado.</p></div></div>
      <div class="resumo">
        <div><span class="v num" ${vezTodos.length ? 'style="color:var(--crit)"' : ''}>${vezTodos.length}</span><span class="l">esperando você</span></div>
        <div><span class="v num">${brl(gp.usado)}</span><span class="l">gasto com passagens</span></div>
        <div><span class="v num">${brl(somaE('usado'))}</span><span class="l">gasto com eventos</span></div></div>
      <nav class="viag-ir small" aria-label="Ir para"><a href="#viag-passagens">Passagens aéreas${nVez('passagem') ? ` (${nVez('passagem')} esperando)` : ''}</a><a href="#viag-eventos">Eventos${nVez('evento') ? ` (${nVez('evento')} esperando)` : ''}</a></nav>
      ${souGeral && conf() === 'auxiliar_adm' ? '<div class="aviso">Sem coordenação técnica ativa: quem confere os pedidos é o auxiliar administrativo; você autoriza. Assim cada pedido passa por duas pessoas. Quando a técnica for cadastrada, ela volta a conferir.</div>' : ''}
      ${souGeral && conf() === 'coord_geral' && !legado() ? '<div class="aviso erro">Sem coordenação técnica e sem auxiliar administrativo: você confere e autoriza sozinho (fica registrado). Cadastre a técnica ou o auxiliar para voltar a ter duas pessoas em cada pedido.</div>' : ''}
      <section class="secao viag-tipo" id="viag-passagens" aria-labelledby="t-vp"><div class="secao-cab"><div><h2 id="t-vp">Passagens aéreas</h2>
          <p class="small muted">Teto de ${brl(MQ.TETOS.passagem)} para o projeto todo, somando os 5 estados. Passagens contadas por pessoa (ida e volta).</p></div></div>
        <div class="bloco viag-tetos"><h3>Tetos de gasto · passagens</h3>${cartaoGasto(gp, 'Autorizado em passagens')}
          <ul class="pp"><li><span>Intercâmbio entre as beneficiárias</span><b class="num">${usados('intercambio')}<small class="muted"> de ${PREVISTO.intercambio} passagens</small></b></li>
            <li><span>Acompanhamento pedagógico</span><b class="num">${usados('pedagogico')}<small class="muted"> de ${PREVISTO.pedagogico} passagens</small></b></li></ul></div>
        ${listas('passagem')}</section>
      <section class="secao viag-tipo" id="viag-eventos" aria-labelledby="t-ve"><div class="secao-cab"><div><h2 id="t-ve">Eventos</h2>
          <p class="small muted">Teto de ${brl(MQ.TETOS.evento)} por estado (o saldo de um estado não passa para outro). ${ufsEvento.size} de ${PREVISTO.evento} estados com evento autorizado.</p></div></div>
        <div class="bloco viag-tetos"><h3>Tetos de gasto · eventos</h3>
          <div class="fin-wrap"><table class="fin viag-fin"><thead><tr><th scope="col">Estado</th><th scope="col">Teto</th><th scope="col">Autorizado</th><th scope="col">Em análise</th><th scope="col">Saldo</th><th scope="col">Uso do teto</th></tr></thead><tbody>
            ${ge.map(g => `<tr class="fin-item"><th scope="row"><span class="fin-nome sem">${E(g.nome)}</span></th><td class="num" data-rot="Teto">${brl(g.teto)}</td><td class="num" data-rot="Autorizado"><span class="${g.usado > 0 ? 'fin-exec' : 'fin-zero'}">${brl(g.usado)}</span></td><td class="num" data-rot="Em análise"><span class="${g.analise > 0 ? 'fin-comp' : 'fin-zero'}">${brl(g.analise)}</span></td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(g.livre)}</b>${g.estoura ? ' <span class="crit-txt" title="autorizado + em análise passa do teto">!</span>' : ''}</td><td data-rot="Uso do teto">${usoTeto(g)}</td></tr>`).join('')}</tbody>
            <tfoot><tr class="fin-tot"><th scope="row">Total</th><td class="num" data-rot="Teto"><b>${brl(MQ.TETOS.evento * MQ.UFS.length)}</b></td><td class="num" data-rot="Autorizado">${brl(somaE('usado'))}</td><td class="num" data-rot="Em análise">${brl(somaE('analise'))}</td><td class="num fin-saldo" data-rot="Saldo"><b>${brl(somaE('livre'))}</b></td><td data-rot="Uso do teto">${usoTeto({ teto: MQ.TETOS.evento * MQ.UFS.length, usado: somaE('usado'), analise: somaE('analise') })}</td></tr></tfoot>
          </table></div></div>
        ${listas('evento')}</section>`;
  }

  /* ---------- formulário ---------- */
  function passBloco(i, x) {
    x = x || {}; const v = k => E(x[k] == null ? '' : x[k]); const k = ++seqPass; const id = c => 'ps-' + c + '-' + k;
    return `<fieldset class="viag-pass" data-pass>
      <legend>Passageira ou passageiro <span data-n>${i + 1}</span></legend>
      <div class="campos">
        <div class="campo inteiro"><label for="${id('nome')}">Nome completo (igual ao documento)</label><input id="${id('nome')}" name="ps_nome" value="${v('nome')}" autocomplete="off"></div>
        <div class="campo"><label for="${id('cpf')}">CPF</label><input id="${id('cpf')}" name="ps_cpf" data-mascara="cpf" inputmode="numeric" value="${v('cpf')}"></div>
        <div class="campo"><label for="${id('nasc')}">Data de nascimento</label><input id="${id('nasc')}" name="ps_nasc" type="date" min="1900-01-01" max="${R.hoje()}" value="${v('nascimento')}"></div>
        <div class="campo"><label for="${id('rg')}">RG</label><input id="${id('rg')}" name="ps_rg" value="${v('rg')}"></div>
        <div class="campo"><label for="${id('org')}">Órgão expedidor</label><input id="${id('org')}" name="ps_org" value="${v('rg_orgao')}" placeholder="Ex.: SSP/PI"></div>
        <div class="campo"><label for="${id('sexo')}">Sexo</label><select id="${id('sexo')}" name="ps_sexo"><option value="">Selecione…</option>${Object.entries(SEXO).map(([k, t]) => `<option value="${k}" ${x.sexo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo"><label for="${id('cel')}">Celular</label><input id="${id('cel')}" name="ps_cel" data-mascara="tel" inputmode="tel" value="${v('celular')}"></div>
        <div class="campo inteiro"><label for="${id('email')}">E-mail</label><input id="${id('email')}" name="ps_email" type="email" value="${v('email')}"></div>
        <div class="campo inteiro"><label for="${id('end')}">Endereço <span class="muted">(opcional)</span></label><input id="${id('end')}" name="ps_end" value="${v('endereco')}"></div>
      </div>
      <button type="button" class="btn peq" data-acao="viag-rem-pass" ${i === 0 ? 'hidden' : ''}>Tirar esta pessoa</button>
    </fieldset>`;
  }
  function form(p) {
    const tipo = p.t; const x = p.id ? lista().find(y => y.id === p.id) : null; const d = (x && x.dados) || {};
    const v = k => E(d[k] == null ? '' : d[k]);
    const est = d.estrutura || {}, ali = d.alimentacao || {}, part = d.participantes || {}, resp = d.responsavel || {};
    const cab = `<div class="painel-cab"><div class="t"><span class="eyebrow">${x ? 'Corrigir e reenviar' : 'Novo pedido'}</span><h2 id="painel-t">${TIPO[tipo]}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
    const prazo = `<div class="aviso viag-prazo" data-prazo>Envie ${PRAZO[tipo]} dias antes ${tipo === 'passagem' ? 'da viagem' : 'do evento'}. Pedido fora do prazo precisa de justificativa e pode não ser atendido.</div>`;
    const comum = `<div class="campo inteiro"><label for="vg-tit">${tipo === 'passagem' ? 'Objetivo da viagem e atividade do projeto' : 'Nome do evento e atividade do projeto'}</label>
        <input id="vg-tit" name="titulo" value="${E(x ? x.titulo : '')}" maxlength="200" placeholder="${tipo === 'passagem' ? 'Ex.: intercâmbio das agricultoras de Picos com o território de Juazeiro' : 'Ex.: encontro de troca de conhecimentos das mulheres do Piauí'}"></div>`;
    const just = `<div class="campo inteiro" data-just><label for="vg-just">Justificativa <span class="muted">(obrigatória se faltar menos de ${PRAZO[tipo]} dias)</span></label>
        <textarea id="vg-just" name="justificativa">${E(x ? x.justificativa_prazo || '' : '')}</textarea></div>`;
    let corpo;
    if (tipo === 'passagem') {
      const ps = (d.passageiros && d.passageiros.length) ? d.passageiros : [{}];
      corpo = `<fieldset><legend>Viagem</legend><div class="campos">${comum}
          <div class="campo inteiro"><label for="vg-fin">Para quê</label><select id="vg-fin" name="finalidade"><option value="">Selecione…</option>${Object.entries(FINALIDADE).map(([k, t]) => `<option value="${k}" ${d.finalidade === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="campo"><label for="vg-ori">Cidade de origem</label><input id="vg-ori" name="origem" value="${v('origem')}" placeholder="Ex.: Teresina/PI"></div>
          <div class="campo"><label for="vg-des">Cidade de destino</label><input id="vg-des" name="destino" value="${v('destino')}" placeholder="Ex.: Salvador/BA"></div>
          <div class="campo"><label for="vg-ida">Data de ida</label><input id="vg-ida" name="data_ref" type="date" min="${R.hoje()}" max="${FIM_PROJETO}" value="${E(x ? x.data_ref : '')}"></div>
          <div class="campo"><label for="vg-vol">Data de volta</label><input id="vg-vol" name="volta" type="date" min="${R.hoje()}" max="${FIM_PROJETO}" value="${v('volta')}"></div>
          <div class="campo inteiro"><label for="vg-vpara">A volta é para outra cidade? <span class="muted">(se for, qual)</span></label><input id="vg-vpara" name="volta_para" value="${v('volta_para')}"></div>
          <div class="campo inteiro"><label for="vg-sug">Sugestão de voo, ou turno e horário em que precisa chegar</label><input id="vg-sug" name="sugestao" value="${v('sugestao')}" placeholder="Ex.: chegar até 12h do dia da ida"></div>
          <div class="campo inteiro"><label for="vg-bag">Bagagem</label><select id="vg-bag" name="bagagem"><option value="">Selecione…</option>${Object.entries(BAGAGEM).map(([k, t]) => `<option value="${k}" ${d.bagagem === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          ${just}</div></fieldset>
        ${prazo}
        <fieldset><legend>Valor</legend><div class="campos"><div class="campo"><label for="vg-valor">Valor estimado (R$)</label><input id="vg-valor" name="valor_estimado" inputmode="decimal" value="${E(d.valor_estimado != null ? String(d.valor_estimado).replace('.', ',') : '')}" placeholder="Ex.: 1.800,00">
          <span class="dica">${tipo === 'passagem' ? 'Some as passagens de todas as pessoas, ida e volta (pesquise o preço no dia).' : 'Espaço, estrutura e alimentação (use o orçamento de referência, se tiver).'}</span></div></div>
          <p class="small muted">${rotSaldo(tipo, S().eu.uf)}</p></fieldset>
        <div data-passageiros>${ps.map((y, i) => passBloco(i, y)).join('')}</div>
        <button type="button" class="btn-add" data-acao="viag-add-pass"><span aria-hidden="true">+</span> Outra pessoa</button>
        <div class="aviso"><b>Depois de emitida:</b> o voo pode mudar (depende da vaga e do preço no dia) e remarcar ou cancelar gera custo. Confira datas e nomes antes de enviar. Guarde os cartões de embarque de ida e volta.</div>`;
    } else {
      const ck = (k, t) => `<label class="check"><input type="checkbox" name="est_${k}" ${est[k] ? 'checked' : ''}> <span>${t}</span></label>`;
      corpo = `<fieldset><legend>Data e local</legend><div class="campos">${comum}
          <div class="campo"><label for="vg-dia">Dia do evento</label><input id="vg-dia" name="data_ref" type="date" min="${R.hoje()}" max="${FIM_PROJETO}" value="${E(x ? x.data_ref : '')}"></div>
          <div class="campo"><label for="vg-hora">Hora de início</label><input id="vg-hora" name="hora" type="time" value="${v('hora')}"></div>
          <div class="campo"><label for="vg-dur">Duração</label><input id="vg-dur" name="duracao" value="${v('duracao')}" placeholder="Ex.: 6 horas"></div>
          <div class="campo inteiro"><label for="vg-loc">Local: endereço completo</label><input id="vg-loc" name="local" value="${v('local')}"></div>
          <div class="campo inteiro"><label for="vg-ref">Ponto de referência</label><input id="vg-ref" name="referencia" value="${v('referencia')}"></div>
          ${just}</div></fieldset>
        ${prazo}
        <fieldset><legend>Valor</legend><div class="campos"><div class="campo"><label for="vg-valor">Valor estimado (R$)</label><input id="vg-valor" name="valor_estimado" inputmode="decimal" value="${E(d.valor_estimado != null ? String(d.valor_estimado).replace('.', ',') : '')}" placeholder="Ex.: 1.800,00">
          <span class="dica">${tipo === 'passagem' ? 'Some as passagens de todas as pessoas, ida e volta (pesquise o preço no dia).' : 'Espaço, estrutura e alimentação (use o orçamento de referência, se tiver).'}</span></div></div>
          <p class="small muted">${rotSaldo(tipo, S().eu.uf)}</p></fieldset>
        <fieldset><legend>Participantes</legend><div class="campos" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="campo"><label for="vg-pm">Mulheres</label><input id="vg-pm" name="p_mulheres" type="number" min="0" inputmode="numeric" value="${E(part.mulheres == null ? '' : part.mulheres)}"></div>
          <div class="campo"><label for="vg-pe">Equipe</label><input id="vg-pe" name="p_equipe" type="number" min="0" inputmode="numeric" value="${E(part.equipe == null ? '' : part.equipe)}"></div>
          <div class="campo"><label for="vg-pc">Convidados</label><input id="vg-pc" name="p_convidados" type="number" min="0" inputmode="numeric" value="${E(part.convidados == null ? '' : part.convidados)}"></div></div></fieldset>
        <fieldset><legend>Estrutura</legend>
          <div class="viag-checks">${ESTRUTURA.map(([k, t]) => ck(k, t)).join('')}</div>
          <div class="campos"><div class="campo"><label for="vg-cad">Cadeiras</label><input id="vg-cad" name="cadeiras" type="number" min="0" inputmode="numeric" value="${E(est.cadeiras == null ? '' : est.cadeiras)}"></div>
            <div class="campo"><label for="vg-mes">Mesas</label><input id="vg-mes" name="mesas" type="number" min="0" inputmode="numeric" value="${E(est.mesas == null ? '' : est.mesas)}"></div></div></fieldset>
        <fieldset><legend>Alimentação</legend><div class="campos">
          <div class="campo"><label for="vg-lan">Lanche: quantas pessoas</label><input id="vg-lan" name="lanche" type="number" min="0" inputmode="numeric" value="${E(ali.lanche == null ? '' : ali.lanche)}"></div>
          <div class="campo"><label for="vg-alm">Almoço: quantas pessoas</label><input id="vg-alm" name="almoco" type="number" min="0" inputmode="numeric" value="${E(ali.almoco == null ? '' : ali.almoco)}"></div>
          <div class="campo"><label for="vg-srv">Serviço</label><select id="vg-srv" name="servico"><option value="">Selecione…</option><option value="entrega" ${ali.servico === 'entrega' ? 'selected' : ''}>Só entrega</option><option value="servico" ${ali.servico === 'servico' ? 'selected' : ''}>Com serviço (garçom)</option></select></div>
          <div class="campo"><label class="check" style="margin-top:26px"><input type="checkbox" name="descartaveis" ${ali.descartaveis ? 'checked' : ''}> <span>Com descartáveis</span></label></div></div>
          <div class="aviso"><b>Um serviço, um pedido.</b> Almoço para 60 pessoas é um pedido só, nunca três de 20: dividir o mesmo serviço é proibido e pode anular a compra.</div></fieldset>
        <fieldset><legend>Responsável no local e fornecedores</legend><div class="campos">
          <div class="campo"><label for="vg-rn">Quem recebe o serviço</label><input id="vg-rn" name="resp_nome" value="${E(resp.nome || '')}"></div>
          <div class="campo"><label for="vg-rc">Celular</label><input id="vg-rc" name="resp_cel" data-mascara="tel" inputmode="tel" value="${E(resp.celular || '')}"></div>
          <div class="campo inteiro"><label for="vg-for">Fornecedores da região <span class="muted">(nome e telefone, se souber)</span></label><textarea id="vg-for" name="fornecedores">${v('fornecedores')}</textarea>
            <span class="dica">A escolha é da FUNCERN (menor preço entre 3 orçamentos). Não pode ser empresa ou pessoa parente da coordenação do projeto.</span></div>
          <div class="campo inteiro"><label for="vg-orc">Orçamento de referência <span class="muted">(se tiver: fornecedor e valor)</span></label><textarea id="vg-orc" name="orcamento">${v('orcamento')}</textarea></div></div></fieldset>`;
    }
    return cab + `<div class="painel-corpo"><form class="f" data-form="viag-salvar" data-t="${tipo}" ${x ? `data-id="${E(x.id)}"` : ''} novalidate>
      ${x && x.obs ? `<div class="aviso erro"><b>O que corrigir:</b> ${E(x.obs)}</div>` : ''}
      ${corpo}
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">${x ? 'Reenviar pedido' : 'Enviar para ' + nomeConf()}</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
    </form></div>`;
  }

  /* ---------- ver pedido ---------- */
  function textoFuncern(p) {
    const d = p.dados || {}; const L = [];
    L.push(`PEDIDO DE ${TIPO[p.tipo].toUpperCase()} · Projeto Quintais Produtivos para Mulheres Rurais`);
    L.push(`Estado: ${p.uf} · Solicitante: ${nomeDe(pessoa(p.solicitante_id))}`);
    L.push(`${p.tipo === 'passagem' ? 'Objetivo' : 'Evento'}: ${p.titulo}`);
    if (p.tipo === 'passagem') {
      L.push(`Finalidade: ${FINALIDADE[d.finalidade] || '—'}`);
      L.push(`Trecho: ${d.origem || '—'} → ${d.destino || '—'}${d.volta_para ? ' · volta para ' + d.volta_para : ''}`);
      L.push(`Ida: ${R.fmtData(p.data_ref)} · Volta: ${d.volta ? R.fmtData(d.volta) : '—'}`);
      L.push(`Voo/horário: ${d.sugestao || '—'} · Bagagem: ${BAGAGEM[d.bagagem] || '—'}`);
      (d.passageiros || []).forEach((x, i) => L.push(`${i + 1}) ${x.nome} · CPF ${R.fmtCPF(x.cpf || '')} · RG ${x.rg || ''} ${x.rg_orgao || ''} · nasc. ${R.fmtData(x.nascimento)} · ${SEXO[x.sexo] || ''} · ${x.celular || ''} · ${x.email || ''}${x.endereco ? ' · ' + x.endereco : ''}`));
    } else {
      const e = d.estrutura || {}, a = d.alimentacao || {}, pa = d.participantes || {}, r = d.responsavel || {};
      L.push(`Data: ${R.fmtData(p.data_ref)} · Início: ${d.hora || '—'} · Duração: ${d.duracao || '—'}`);
      L.push(`Local: ${d.local || '—'}${d.referencia ? ' (ref.: ' + d.referencia + ')' : ''}`);
      L.push(`Participantes: ${pa.mulheres || 0} mulheres, ${pa.equipe || 0} equipe, ${pa.convidados || 0} convidados`);
      L.push(`Estrutura: ${ESTRUTURA.filter(([k]) => e[k]).map(([, t]) => t).join(', ') || '—'} · Cadeiras: ${e.cadeiras || 0} · Mesas: ${e.mesas || 0}`);
      L.push(`Alimentação: lanche ${a.lanche || 0} pessoas, almoço ${a.almoco || 0} pessoas · ${a.servico === 'servico' ? 'com serviço' : a.servico === 'entrega' ? 'só entrega' : '—'}${a.descartaveis ? ' · com descartáveis' : ''}`);
      L.push(`Responsável no local: ${r.nome || '—'} · ${r.celular || ''}`);
      if (d.fornecedores) L.push(`Fornecedores sugeridos: ${d.fornecedores}`);
      if (d.orcamento) L.push(`Orçamento de referência: ${d.orcamento}`);
    }
    if (p.valor_autorizado || d.valor_estimado) L.push(p.valor_autorizado ? `Valor autorizado: ${brl(p.valor_autorizado)}` : `Valor estimado: ${brl(d.valor_estimado)}`);
    if (p.justificativa_prazo) L.push(`Justificativa do prazo: ${p.justificativa_prazo}`);
    return L.join('\n');
  }
  function painelVer(p) {
    const x = lista().find(y => y.id === p.id); if (!x) return '<div class="painel-corpo"><p>Pedido não encontrado.</p></div>';
    const eu = S().eu; const souDono = x.solicitante_id === eu.id; const papel = eu.papel; const d = x.dados || {};
    const dias = diasAte(x.data_ref);
    const dl = [['Situação', chip(x)], ['Estado', E(x.uf)], ['Quem pediu', E(nomeDe(pessoa(x.solicitante_id)))],
      [x.tipo === 'passagem' ? 'Ida' : 'Dia do evento', `${R.fmtData(x.data_ref)}${['enviado', 'conferido'].includes(x.situacao) ? (dias < 0 ? ' · <b style="color:var(--crit)">a data já passou</b>' : ` · faltam ${dias} dia${dias === 1 ? '' : 's'}${dias < PRAZO[x.tipo] ? ' <b style="color:var(--crit)">(fora do prazo)</b>' : ''}`) : ''}`],
      ['Valor estimado', d.valor_estimado ? brl(d.valor_estimado) : '<span class="muted">não informado</span>'],
      x.valor_autorizado ? ['Valor autorizado', '<b>' + brl(x.valor_autorizado) + '</b>'] : null,
      ['Enviado em', new Date(x.enviado_em).toLocaleString('pt-BR')],
      x.conferido_em ? ['Conferido', `${new Date(x.conferido_em).toLocaleString('pt-BR')} por ${E(nomeDe(pessoa(x.conferido_por)))}`] : null,
      x.decidido_em && x.situacao !== 'enviado' ? [{ autorizado: 'Autorizado', recusado: 'Recusado', devolvido: 'Devolvido', cancelado: 'Cancelado' }[x.situacao] || 'Decidido', `${new Date(x.decidido_em).toLocaleString('pt-BR')} por ${E(nomeDe(pessoa(x.decidido_por)))}`] : null,
      x.obs ? ['Observação', E(x.obs)] : null, x.funcern_protocolo ? ['Protocolo FUNCERN', E(x.funcern_protocolo)] : null,
      x.justificativa_prazo ? ['Justificativa do prazo', E(x.justificativa_prazo)] : null].filter(Boolean);
    const acoes = [];
    if (souDono && x.situacao === 'devolvido') acoes.push(`<div class="acoes"><button class="btn pri" data-acao="viag-nova" data-t="${x.tipo}" data-id="${E(x.id)}">Corrigir e reenviar</button></div>`);
    if (souDono && ['enviado', 'devolvido'].includes(x.situacao)) acoes.push(formMover(x, 'Cancelar este pedido', [['cancelar', 'Cancelar o pedido', 'perigo']], 'Motivo (opcional)'));
    const geral = papel === 'coord_geral';
    if (!souDono && papel !== 'coord_geral' && souConferente() && x.situacao === 'enviado') acoes.push(formMover(x, 'Conferência', [['conferir', 'Conferido', 'pri'], ['devolver', 'Devolver para correção', 'perigo']], 'Observação (obrigatória para devolver)'));
    if (geral && x.situacao === 'enviado') {
      if (souConferente()) acoes.push(formMover(x, 'Conferência (sem coordenação técnica e sem auxiliar)', [['conferir', 'Conferido', 'pri'], ['devolver', 'Devolver para correção', 'perigo'], ['recusar', 'Recusar', 'perigo']], 'Observação (obrigatória para devolver ou recusar)'));
      else if (legado()) acoes.push(formMover(x, 'Conferir no lugar da coordenação técnica', [['conferir', 'Conferido', ''], ['devolver', 'Devolver para correção', 'perigo'], ['recusar', 'Recusar', 'perigo']], 'Observação (obrigatória para devolver ou recusar)'));
      else acoes.push(`<div class="aviso">Quem confere este pedido é ${nomeConf()}. Depois da conferência, ele volta para você autorizar.</div>` + formMover(x, 'Recusar sem esperar a conferência', [['recusar', 'Recusar', 'perigo']], 'Motivo da recusa (obrigatório)'));
    }
    if (geral && x.situacao === 'conferido') {
      const mesmo = x.conferido_por === eu.id && conf() !== 'coord_geral' && !legado();
      if (mesmo) acoes.push(`<div class="aviso erro">Você conferiu este pedido, então não pode autorizá-lo: cada pedido passa por duas pessoas. Devolva para ${nomeConf()} conferir.</div>` + formMover(x, 'Devolver ou recusar', [['devolver', 'Devolver para correção', 'perigo'], ['recusar', 'Recusar', 'perigo']], 'Observação (obrigatória)'));
      else acoes.push(formMover(x, 'Autorizar e mandar para a FUNCERN', [['autorizar', 'Autorizar', 'pri'], ['devolver', 'Devolver para correção', 'perigo'], ['recusar', 'Recusar', 'perigo']], 'Observação (obrigatória para devolver ou recusar)', true, true));
    }
    if (papel === 'coord_geral' && x.situacao === 'autorizado') acoes.push(formMover(x, 'Protocolo da FUNCERN', [['protocolo', 'Salvar protocolo', 'pri']], null, true));
    const ver = x.tipo === 'passagem' ? `<div class="bloco"><h3>Viagem</h3><dl class="dl">
        <dt>Para quê</dt><dd>${E(FINALIDADE[d.finalidade] || '—')}</dd><dt>Trecho</dt><dd>${E(d.origem || '—')} → ${E(d.destino || '—')}${d.volta_para ? ' · volta para ' + E(d.volta_para) : ''}</dd>
        <dt>Volta</dt><dd>${d.volta ? R.fmtData(d.volta) : '—'}</dd><dt>Voo ou horário</dt><dd>${E(d.sugestao || '—')}</dd><dt>Bagagem</dt><dd>${E(BAGAGEM[d.bagagem] || '—')}</dd></dl></div>
      <div class="bloco"><h3>Passageiras e passageiros (${nPass(x)})</h3>${(d.passageiros || []).map(y => `<dl class="dl viag-pdl"><dt>Nome</dt><dd><b>${E(y.nome)}</b></dd><dt>CPF</dt><dd>${E(R.fmtCPF(y.cpf || ''))}</dd><dt>RG</dt><dd>${E(y.rg || '')} ${E(y.rg_orgao || '')}</dd>
        <dt>Nascimento</dt><dd>${R.fmtData(y.nascimento)} · ${E(SEXO[y.sexo] || '')}</dd><dt>Contato</dt><dd>${E(y.celular || '')} · ${E(y.email || '')}</dd>${y.endereco ? `<dt>Endereço</dt><dd>${E(y.endereco)}</dd>` : ''}</dl>`).join('')}</div>`
      : `<div class="bloco"><h3>Evento</h3><pre class="viag-txt">${E(textoFuncern(x).split('\n').slice(3).join('\n'))}</pre></div>`;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${TIPO[x.tipo]}</span><h2 id="painel-t">${E(x.titulo)}</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        <div class="bloco"><dl class="dl">${dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
        ${ver}
        ${/^coord/.test(papel) && ['conferido', 'autorizado'].includes(x.situacao) ? `<div class="bloco"><h3>Texto para mandar à FUNCERN</h3><textarea readonly rows="8" class="viag-copia">${E(textoFuncern(x))}</textarea>
          <div class="acoes"><button class="btn" data-acao="copiar-texto">Copiar texto</button></div></div>` : ''}
        ${acoes.join('')}
      </div>`;
  }
  function formMover(x, titulo, botoes, rotObs, protocolo, valor) {
    const vl = +x.valor_autorizado || +(x.dados || {}).valor_estimado || '';
    return `<form class="bloco" data-form="viag-mover" data-id="${E(x.id)}" data-tipo="${E(x.tipo)}" data-uf="${E(x.uf)}" novalidate><h3>${titulo}</h3>
      ${valor ? `<div class="campo"><label for="vm-valor">Valor autorizado (R$)</label><input id="vm-valor" name="valor" inputmode="decimal" value="${E(vl ? String(vl).replace('.', ',') : '')}">
        <span class="dica">Vem o estimado pela bolsista; ajuste pelo orçamento da FUNCERN, se tiver.</span></div><p class="small muted">${rotSaldo(x.tipo, x.uf)}</p>` : ''}
      ${protocolo ? `<div class="campo"><label for="vm-prot">Protocolo ou número do pedido na FUNCERN <span class="muted">(se já tiver)</span></label><input id="vm-prot" name="protocolo" value="${E(x.funcern_protocolo || '')}"></div>` : ''}
      ${rotObs ? `<div class="campo"><label for="vm-obs-${E(x.id)}">${rotObs}</label><textarea id="vm-obs-${E(x.id)}" name="obs"></textarea></div>` : ''}
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes">${botoes.map(([a, t, c]) => `<button class="btn ${c}" type="submit" name="acao" value="${a}">${t}</button>`).join('')}</div></form>`;
  }

  function painel(p) { return p.tipo === 'viag-nova' ? form(p) : painelVer(p); }

  /* ---------- ações ---------- */
  function renumerar(box) { box.querySelectorAll('[data-pass]').forEach((f, i) => { f.querySelector('[data-n]').textContent = i + 1; f.querySelector('[data-acao=viag-rem-pass]').hidden = i === 0; }); }
  async function clique(a, el) {
    if (a === 'viag-nova') U().abrirPainel({ tipo: 'viag-nova', t: el.dataset.t, id: el.dataset.id || null });
    else if (a === 'viag-ver') U().abrirPainel({ tipo: 'viag-ver', id: el.dataset.id });
    else if (a === 'viag-add-pass') { const box = el.previousElementSibling; const n = box.querySelectorAll('[data-pass]').length;
      box.insertAdjacentHTML('beforeend', passBloco(n)); renumerar(box); const f = box.lastElementChild.querySelector('input'); if (f) f.focus(); }
    else if (a === 'viag-rem-pass') { const box = el.closest('[data-passageiros]'); el.closest('[data-pass]').remove(); renumerar(box); }
  }
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('form[data-form=viag-mover] button[name=acao]'); if (b) b.form.dataset.acao = b.value; }, true);
  // prazo ao escolher a data
  document.addEventListener('change', ev => {
    const t = ev.target; if (!t.matches || !t.matches('form[data-form=viag-salvar] [name=data_ref]')) return;
    const f = t.form; const box = f.querySelector('[data-prazo]'); if (!box || !t.value) return;
    const tipo = f.dataset.t; const d = diasAte(t.value);
    box.className = 'aviso viag-prazo ' + (d < 30 ? 'erro' : d < PRAZO[tipo] ? 'erro' : 'ok');
    box.innerHTML = d < PRAZO[tipo] ? `<b>Faltam ${d} dias: fora do prazo de ${PRAZO[tipo]} dias.</b> Escreva a justificativa.${tipo === 'passagem' && d < 30 ? ' Com menos de 30 dias a FUNCERN pode não conseguir comprar.' : ''}` : `Faltam ${d} dias: dentro do prazo.`;
  });

  function lerForm(tipo, fd) {
    const t = k => String(fd.get(k) || '').trim(); const negativos = [];   // número negativo continua virando 0 no pedido, mas fica anotado para validar() recusar com mensagem (antes sumia em silêncio)
    const n = k => { if (t(k) === '') return null; const v = parseInt(t(k), 10) || 0; if (v < 0) negativos.push(k); return Math.max(0, v); };
    if (tipo === 'passagem') {
      const col = k => fd.getAll(k).map(x => String(x || '').trim());
      const nomes = col('ps_nome'), cpfs = col('ps_cpf'), nasc = col('ps_nasc'), rg = col('ps_rg'), org = col('ps_org'), sexo = col('ps_sexo'), cel = col('ps_cel'), em = col('ps_email'), end = col('ps_end');
      const passageiros = nomes.map((x, i) => ({ nome: x.replace(/\s+/g, ' '), cpf: R.soDigitos(cpfs[i]), nascimento: nasc[i], rg: rg[i], rg_orgao: org[i], sexo: sexo[i], celular: cel[i], email: em[i].toLowerCase(), endereco: end[i] || null }));
      return { finalidade: t('finalidade'), origem: t('origem'), destino: t('destino'), volta: t('volta') || null, volta_para: t('volta_para') || null, sugestao: t('sugestao'), bagagem: t('bagagem'), passageiros };
    }
    const estrutura = {}; ESTRUTURA.forEach(([k]) => { estrutura[k] = !!fd.get('est_' + k); }); estrutura.cadeiras = n('cadeiras'); estrutura.mesas = n('mesas');
    return Object.defineProperty({ hora: t('hora'), duracao: t('duracao'), local: t('local'), referencia: t('referencia'),
      participantes: { mulheres: n('p_mulheres'), equipe: n('p_equipe'), convidados: n('p_convidados') }, estrutura,
      alimentacao: { lanche: n('lanche'), almoco: n('almoco'), servico: t('servico') || null, descartaveis: !!fd.get('descartaveis') },
      responsavel: { nome: t('resp_nome'), celular: t('resp_cel') }, fornecedores: t('fornecedores') || null, orcamento: t('orcamento') || null },
      '_negativos', { value: negativos, enumerable: false });   // não enumerável: não vai para o servidor
  }
  function validar(tipo, titulo, data, just, d) {
    const e = {};
    if (titulo.length < 5) e.titulo = tipo === 'passagem' ? 'Escreva o objetivo e a atividade.' : 'Escreva o nome do evento e a atividade.';
    if (!data) e.data_ref = 'Informe a data.'; else if (data < R.hoje()) e.data_ref = 'Esta data já passou.'; else if (data > FIM_PROJETO) e.data_ref = 'Passa do fim do projeto (setembro de 2027).';
    else if (diasAte(data) < PRAZO[tipo] && just.length < 15) e.justificativa = `Fora do prazo (${PRAZO[tipo]} dias antes): explique por quê.`;
    if (just.length > MAX_JUSTIFICATIVA) e.justificativa = 'Texto muito longo (máximo 2.000 caracteres).';
    if (tipo === 'passagem') {
      if (!d.finalidade) e.finalidade = 'Escolha para quê.';
      if (!d.origem) e.origem = 'Informe a cidade de origem.';
      if (!d.destino) e.destino = 'Informe a cidade de destino.';
      if (!d.volta) e.volta = 'Informe a data de volta.'; else if (data && d.volta < data) e.volta = 'A volta é antes da ida.';
      if (!d.bagagem) e.bagagem = 'Escolha o tipo de bagagem.';
      // erros das passageiras: marcados no bloco de cada uma depois do mostrarErros
      const lp = [];
      d.passageiros.forEach((x, i) => {
        const m = (nm, msg) => lp.push([i, nm, msg]);
        if (x.nome.split(' ').length < 2) m('ps_nome', 'Nome completo, igual ao documento.');
        if (!R.cpfValido(x.cpf)) m('ps_cpf', 'CPF inválido.');
        const en = erroNascimento(x.nascimento); if (en) m('ps_nasc', en);
        if (!x.rg) m('ps_rg', 'Informe o RG.');
        if (!x.rg_orgao) m('ps_org', 'Informe o órgão.');
        if (!x.sexo) m('ps_sexo', 'Escolha.');
        if (R.soDigitos(x.celular).length < 10) m('ps_cel', 'Celular com DDD.');
        if (!R.emailValido(x.email)) m('ps_email', 'E-mail inválido.');
      });
      const cpfs = d.passageiros.map(x => x.cpf).filter(Boolean);
      if (new Set(cpfs).size !== cpfs.length) e._geral = 'A mesma pessoa aparece duas vezes.';
      if (!d.passageiros.length) e._geral = 'Inclua pelo menos uma passageira ou passageiro.';
      if (lp.length) e._pass = lp;
    } else {
      if (!d.local) e.local = 'Informe o endereço.';
      if (!d.hora) e.hora = 'Informe a hora.';
      const pa = d.participantes; const totPa = (pa.mulheres || 0) + (pa.equipe || 0) + (pa.convidados || 0);
      [['p_mulheres', pa.mulheres], ['p_equipe', pa.equipe], ['p_convidados', pa.convidados], ['cadeiras', d.estrutura.cadeiras], ['mesas', d.estrutura.mesas], ['lanche', d.alimentacao.lanche], ['almoco', d.alimentacao.almoco]]
        .forEach(([k, v]) => { if (v < 0 || (d._negativos || []).includes(k)) e[k] = 'Não pode ser negativo.'; });
      if (!e.p_mulheres && !e.p_equipe && !e.p_convidados) { if (!totPa) e.p_mulheres = 'Quantas pessoas?'; else if (totPa > MAX_PARTICIPANTES) e.p_mulheres = 'Participantes: de 1 a 5.000 pessoas no total.'; }
      const temAlgo = ESTRUTURA.some(([k]) => d.estrutura[k]) || d.estrutura.cadeiras || d.estrutura.mesas || d.alimentacao.lanche || d.alimentacao.almoco;
      if (!temAlgo) e._geral = 'Marque pelo menos um item de estrutura ou de alimentação.';
      if ((d.alimentacao.lanche || d.alimentacao.almoco) && !d.alimentacao.servico) e.servico = 'Só entrega ou com serviço?';
      if (!d.responsavel.nome) e.resp_nome = 'Quem recebe o serviço no local?';
      if (R.soDigitos(d.responsavel.celular).length < 10) e.resp_cel = 'Celular com DDD.';
    }
    return e;
  }
  async function recarregar() { await U().carregar(); U().render(); }
  async function enviar(tipo, form, fd) {
    if (tipo === 'viag-salvar') {
      const t = form.dataset.t; const titulo = String(fd.get('titulo') || '').trim().replace(/\s+/g, ' ');
      const data = String(fd.get('data_ref') || ''); const just = String(fd.get('justificativa') || '').trim();
      const d = lerForm(t, fd); d.valor_estimado = valorBR(fd.get('valor_estimado'));
      const e = validar(t, titulo, data, just, d);
      if (d.valor_estimado < 0) e.valor_estimado = 'O valor não pode ser negativo.';
      else if (!(d.valor_estimado > 0)) e.valor_estimado = 'Informe o valor estimado (R$).';
      else { const sd = saldo(t, S().eu.uf); if (d.valor_estimado > sd.livre) e.valor_estimado = 'Passa do saldo: restam ' + brl(sd.livre) + (t === 'evento' ? ' para eventos em ' + S().eu.uf : ' para passagens no projeto') + '.'; }
      const lp = e._pass || []; const geral = e._geral; delete e._pass; delete e._geral;
      if (Object.keys(e).length || lp.length || geral) {
        const total = Object.keys(e).length + lp.length;
        U().mostrarErros(form, e, geral || (total > 1 ? 'Corrija os ' + total + ' campos marcados.' : Object.values(e)[0] || lp[0][2]));
        const blocos = form.querySelectorAll('[data-pass]');
        lp.forEach(([i, nm, msg]) => { const c = blocos[i].querySelector(`[name=${nm}]`).closest('.campo'); c.classList.add('tem-erro'); const sp = document.createElement('span'); sp.className = 'erro'; sp.textContent = msg; c.appendChild(sp); });
        if (lp.length && !Object.keys(e).length) { const c = form.querySelector('[data-pass] .tem-erro input, [data-pass] .tem-erro select'); if (c) c.focus(); }
        return;
      }
      await U().ocupado(form, async () => {
        await S().api.salvarPedido(form.dataset.id || null, t, titulo, data, d, just || null);
        await recarregar(); U().fecharPainel();
        U().toast((form.dataset.id ? 'Pedido reenviado' : 'Pedido enviado') + ' para ' + nomeConf() + ' conferir.');
      });
    }
    if (tipo === 'viag-mover') {
      const acao = form.dataset.acao; const obs = String(fd.get('obs') || '').trim(); const prot = String(fd.get('protocolo') || '').trim();
      if (['devolver', 'recusar'].includes(acao) && obs.length < 5) return U().mostrarErros(form, { obs: acao === 'devolver' ? 'Escreva o que precisa ser corrigido.' : 'Escreva o motivo da recusa.' });
      const valor = acao === 'autorizar' && form.querySelector('[name=valor]') ? valorBR(fd.get('valor')) : null;
      if (acao === 'autorizar' && form.querySelector('[name=valor]')) {
        if (valor < 0) return U().mostrarErros(form, { valor: 'O valor não pode ser negativo.' });
        if (!(valor > 0)) return U().mostrarErros(form, { valor: 'Informe o valor para autorizar.' });
        const sd = saldo(form.dataset.tipo, form.dataset.uf);
        if (valor > sd.livre) return U().mostrarErros(form, { valor: 'Passa do teto: o saldo é ' + brl(sd.livre) + '. Ajuste o valor, devolva ou recuse.' });
      }
      await U().ocupado(form, async () => {
        if (valor && S().api.definirValorPedido) await S().api.definirValorPedido(form.dataset.id, valor);
        await S().api.moverPedido(form.dataset.id, acao, obs || null, prot || null);
        await recarregar(); if (acao !== 'protocolo') U().fecharPainel();
        U().toast({ conferir: S().eu.papel === 'coord_geral' ? 'Conferido. Agora você pode autorizar.' : 'Conferido. Foi para a coordenação geral autorizar.', devolver: 'Devolvido. A bolsista vê o motivo e pode corrigir.', autorizar: 'Autorizado. Mande o pedido para a FUNCERN (use "Copiar texto").',
          recusar: 'Pedido recusado.', cancelar: 'Pedido cancelado.', protocolo: 'Protocolo salvo.' }[acao]);
      });
    }
  }

  /* ---------- auxiliar administrativo: confere só enquanto não há coordenação técnica ativa ---------- */
  function secaoConferente() {
    const eu = S().eu; if (!eu || eu.papel !== 'auxiliar_adm' || S().quemConfere !== 'auxiliar_adm') return '';
    const vez = lista().filter(minhaVez);
    const meus = lista().filter(p => p.conferido_por === eu.id);
    return `<section class="secao viag" aria-labelledby="t-conf">
      <div class="secao-cab"><div><h2 id="t-conf">Passagens e eventos para conferir <span class="conta-t${vez.length ? '' : ' zero'}">${vez.length}</span></h2>
        <p>Enquanto o projeto está sem coordenação técnica, você confere os pedidos das bolsistas de articulação e a coordenação geral autoriza. Assim cada pedido passa por duas pessoas. Quando a técnica for cadastrada, os pedidos voltam para ela e somem desta tela.</p></div></div>
      <p class="small muted">Confira: prazo (passagem ${PRAZO.passagem} dias, evento ${PRAZO.evento} dias antes, ou justificativa), finalidade, trecho e datas, e se os dados das passageiras estão completos e iguais aos documentos. Os dados pessoais são só para a conferência: não copie nem repasse.</p>
      ${vez.length ? `<div class="pag-lista">${vez.map(p => linha(p, true)).join('')}</div>` : '<p class="muted">Nenhum pedido esperando conferência.</p>'}
      ${meus.length ? `<details class="hist"><summary>Conferidos por você (${meus.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${meus.map(p => linha(p, true)).join('')}</div></details>` : ''}
    </section>`;
  }

  MQ.viagUI = { validar, lerForm, passBloco, valorBR, contaDevolvidos: () => lista().filter(p => p.solicitante_id === S().eu.id && p.situacao === 'devolvido').length, secaoBolsista, secaoConferente, souConferente, abaCoord, painel, clique, enviar, podeVer, contaMinha: () => lista().filter(minhaVez).length, textoFuncern,
    validar, lerForm };   // validar e lerForm expostos para os testes unitários (testes/unit)
})();
