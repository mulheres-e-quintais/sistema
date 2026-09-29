/* Mulheres & Quintais — pedidos de passagem aérea e de estrutura de evento (Guia "Viagens, ajuda de custo e eventos").
   Caminho: a bolsista de articulação estadual pede → a coordenação técnica confere (ou devolve)
   → a coordenação geral autoriza e manda para a FUNCERN (ou recusa ou devolve).
   Só estes três perfis veem os pedidos (supabase/22_passagens_eventos.sql). */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const PRAZO = { passagem: 40, evento: 45 };
  const PREVISTO = { intercambio: 25, pedagogico: 8, evento: 5 };
  const FIM_PROJETO = '2027-09-30';
  const FINALIDADE = { intercambio: 'Intercâmbio entre as beneficiárias', pedagogico: 'Acompanhamento pedagógico' };
  const TIPO = { passagem: 'Passagem aérea', evento: 'Estrutura de evento' };
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
  const chip = p => `<span class="chip ${SIT[p.situacao][0]}">${SIT[p.situacao][1]}</span>`;
  const podeVer = papel => ['articulacao', 'coord_tecnico', 'coord_geral'].includes(papel);
  const semBanco = () => '<div class="aviso">Os pedidos de passagem e de evento ainda não estão instalados no servidor. A coordenação geral roda o arquivo <b>22_passagens_eventos.sql</b> no Supabase.</div>';
  const diasAte = d => Math.round((new Date(d + 'T12:00:00') - new Date(R.hoje() + 'T12:00:00')) / 864e5);
  const minhaVez = p => { const papel = S().eu.papel; return (papel === 'coord_tecnico' && p.situacao === 'enviado') || (papel === 'coord_geral' && p.situacao === 'conferido'); };
  const nPass = p => p.tipo === 'passagem' ? ((p.dados && p.dados.passageiros) || []).length : 0;

  /* ---------- bolsista de articulação ---------- */
  function secaoBolsista() {
    const eu = S().eu; if (!eu || eu.papel !== 'articulacao') return '';
    if (S().pedSemBanco) return `<section class="secao"><h2>Passagens aéreas e eventos</h2>${semBanco()}</section>`;
    const meus = lista().filter(p => p.solicitante_id === eu.id);
    const dev = meus.filter(p => p.situacao === 'devolvido');
    return `<section class="secao viag" aria-labelledby="t-viag">
      <div class="secao-cab"><div><h2 id="t-viag">Passagens aéreas e eventos</h2>
        <p>Você pede, a coordenação técnica confere e a coordenação geral autoriza e manda para a FUNCERN. <b>Nunca compre, contrate ou pague nada por conta própria:</b> despesa sem autorização não é reembolsada.</p></div></div>
      ${dev.length ? `<div class="aviso erro"><b>${dev.length} pedido${dev.length > 1 ? 's' : ''} devolvido${dev.length > 1 ? 's' : ''} para corrigir.</b> Abra, veja o motivo e reenvie.</div>` : ''}
      <div class="viag-botoes">
        <button type="button" class="cad-modo" data-acao="viag-nova" data-t="passagem"><b>Pedir passagem aérea</b><span>Intercâmbio ou acompanhamento pedagógico. Envie <b>${PRAZO.passagem} dias antes</b> da viagem.</span></button>
        <button type="button" class="cad-modo" data-acao="viag-nova" data-t="evento"><b>Pedir estrutura de evento</b><span>Espaço, cadeiras, tenda, som, alimentação. Envie <b>${PRAZO.evento} dias antes</b> do evento.</span></button>
      </div>
      ${meus.length ? `<h3 class="viag-sub">Meus pedidos (${meus.length})</h3><div class="pag-lista">${meus.map(p => linha(p, false)).join('')}</div>` : '<p class="small muted">Você ainda não fez nenhum pedido.</p>'}
    </section>`;
  }

  function linha(p, comPessoa) {
    const d = diasAte(p.data_ref);
    const quando = p.tipo === 'passagem' ? 'Ida ' + R.fmtData(p.data_ref) : 'Evento ' + R.fmtData(p.data_ref);
    const extra = p.tipo === 'passagem' ? ` · ${nPass(p)} passageira${nPass(p) === 1 ? '' : 's'}` : '';
    const alerta = ['enviado', 'conferido'].includes(p.situacao) && d < 30 ? ` · <b style="color:var(--crit)">faltam ${d} dias</b>` : '';
    return `<button class="vagabtn ficha-linha viag-linha" data-acao="viag-ver" data-id="${E(p.id)}">
      <span class="nm">${E(TIPO[p.tipo])} · ${E(p.uf)}</span>
      <span class="small muted">${comPessoa ? E(nomeDe(pessoa(p.solicitante_id))) + ' · ' : ''}${quando}${extra}${alerta}</span>
      <span class="small">${E(p.titulo)}</span>
      <span>${chip(p)}</span></button>`;
  }

  /* ---------- coordenação: aba Viagens e eventos ---------- */
  function abaCoord() {
    if (S().pedSemBanco) return `<div class="cab"><div><span class="eyebrow">Viagens e eventos</span><h1>Passagens e eventos</h1></div></div>${semBanco()}`;
    const souGeral = S().eu.papel === 'coord_geral';
    const l = lista();
    const vez = l.filter(minhaVez);
    const outros = l.filter(p => ['enviado', 'conferido'].includes(p.situacao) && !minhaVez(p));
    const dev = l.filter(p => p.situacao === 'devolvido'), aut = l.filter(p => p.situacao === 'autorizado'), fim = l.filter(p => ['recusado', 'cancelado'].includes(p.situacao));
    const usados = f => aut.filter(p => p.tipo === 'passagem' && (p.dados || {}).finalidade === f).reduce((t, p) => t + nPass(p), 0);
    const ufsEvento = new Set(aut.filter(p => p.tipo === 'evento').map(p => p.uf));
    const bloco = (t, xs, vazio) => `<section class="secao"><div class="secao-cab"><h2>${t} <span class="conta-t${xs.length ? '' : ' zero'}">${xs.length}</span></h2></div>
      ${xs.length ? `<div class="pag-lista">${xs.map(p => linha(p, true)).join('')}</div>` : `<p class="muted">${vazio}</p>`}</section>`;
    return `<div class="cab"><div><span class="eyebrow">Viagens e eventos</span><h1>Passagens e eventos</h1>
        <p>A bolsista de articulação estadual pede; ${souGeral ? 'a coordenação técnica confere; você autoriza e manda para a FUNCERN, que compra ou contrata.' : 'você confere e manda para a coordenação geral, que autoriza e manda para a FUNCERN.'}
        Prazos: passagem ${PRAZO.passagem} dias antes da viagem (a FUNCERN exige 30); evento ${PRAZO.evento} dias antes.</p></div></div>
      <div class="resumo">
        <div><span class="v num" ${vez.length ? 'style="color:var(--crit)"' : ''}>${vez.length}</span><span class="l">esperando você</span></div>
        <div><span class="v num">${usados('intercambio')}<small> de ${PREVISTO.intercambio}</small></span><span class="l">passagens de intercâmbio autorizadas</span></div>
        <div><span class="v num">${usados('pedagogico')}<small> de ${PREVISTO.pedagogico}</small></span><span class="l">passagens de acompanhamento pedagógico</span></div>
        <div><span class="v num">${ufsEvento.size}<small> de ${PREVISTO.evento}</small></span><span class="l">estados com evento autorizado</span></div></div>
      <p class="small muted">Passagens contadas por pessoa (ida e volta). ${[...ufsEvento].length ? 'Evento autorizado em: ' + [...ufsEvento].join(', ') + '.' : ''}</p>
      ${bloco(souGeral ? 'Esperando a sua autorização' : 'Esperando a sua conferência', vez, 'Nada esperando você.')}
      ${outros.length ? bloco(souGeral ? 'Com a coordenação técnica (você pode conferir se ela não puder)' : 'Com a coordenação geral', outros, '') : ''}
      ${dev.length ? bloco('Devolvidos para a bolsista corrigir', dev, '') : ''}
      <details class="hist"><summary>Autorizados (${aut.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${aut.map(p => linha(p, true)).join('') || '<p class="muted">Nenhum ainda.</p>'}</div></details>
      ${fim.length ? `<details class="hist"><summary>Recusados e cancelados (${fim.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${fim.map(p => linha(p, true)).join('')}</div></details>` : ''}`;
  }

  /* ---------- formulário ---------- */
  function passBloco(i, x) {
    x = x || {}; const v = k => E(x[k] == null ? '' : x[k]);
    return `<fieldset class="viag-pass" data-pass>
      <legend>Passageira ou passageiro <span data-n>${i + 1}</span></legend>
      <div class="campos">
        <div class="campo inteiro"><label>Nome completo (igual ao documento)</label><input name="ps_nome" value="${v('nome')}" autocomplete="off"></div>
        <div class="campo"><label>CPF</label><input name="ps_cpf" data-mascara="cpf" inputmode="numeric" value="${v('cpf')}"></div>
        <div class="campo"><label>Data de nascimento</label><input name="ps_nasc" type="date" max="${R.hoje()}" value="${v('nascimento')}"></div>
        <div class="campo"><label>RG</label><input name="ps_rg" value="${v('rg')}"></div>
        <div class="campo"><label>Órgão expedidor</label><input name="ps_org" value="${v('rg_orgao')}" placeholder="Ex.: SSP/PI"></div>
        <div class="campo"><label>Sexo</label><select name="ps_sexo"><option value="">Selecione…</option>${Object.entries(SEXO).map(([k, t]) => `<option value="${k}" ${x.sexo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo"><label>Celular</label><input name="ps_cel" data-mascara="tel" inputmode="tel" value="${v('celular')}"></div>
        <div class="campo inteiro"><label>E-mail</label><input name="ps_email" type="email" value="${v('email')}"></div>
        <div class="campo inteiro"><label>Endereço <span class="muted">(opcional)</span></label><input name="ps_end" value="${v('endereco')}"></div>
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
      <div class="acoes"><button class="btn pri" type="submit">${x ? 'Reenviar pedido' : 'Enviar para a coordenação técnica'}</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
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
    if (p.justificativa_prazo) L.push(`Justificativa do prazo: ${p.justificativa_prazo}`);
    return L.join('\n');
  }
  function painelVer(p) {
    const x = lista().find(y => y.id === p.id); if (!x) return '<div class="painel-corpo"><p>Pedido não encontrado.</p></div>';
    const eu = S().eu; const souDono = x.solicitante_id === eu.id; const papel = eu.papel; const d = x.dados || {};
    const dias = diasAte(x.data_ref);
    const dl = [['Situação', chip(x)], ['Estado', E(x.uf)], ['Quem pediu', E(nomeDe(pessoa(x.solicitante_id)))],
      [x.tipo === 'passagem' ? 'Ida' : 'Dia do evento', `${R.fmtData(x.data_ref)}${['enviado', 'conferido'].includes(x.situacao) ? ` · faltam ${dias} dias${dias < PRAZO[x.tipo] ? ' <b style="color:var(--crit)">(fora do prazo)</b>' : ''}` : ''}`],
      ['Enviado em', new Date(x.enviado_em).toLocaleString('pt-BR')],
      x.conferido_em ? ['Conferido', `${new Date(x.conferido_em).toLocaleString('pt-BR')} por ${E(nomeDe(pessoa(x.conferido_por)))}`] : null,
      x.decidido_em && x.situacao !== 'enviado' ? [{ autorizado: 'Autorizado', recusado: 'Recusado', devolvido: 'Devolvido', cancelado: 'Cancelado' }[x.situacao] || 'Decidido', `${new Date(x.decidido_em).toLocaleString('pt-BR')} por ${E(nomeDe(pessoa(x.decidido_por)))}`] : null,
      x.obs ? ['Observação', E(x.obs)] : null, x.funcern_protocolo ? ['Protocolo FUNCERN', E(x.funcern_protocolo)] : null,
      x.justificativa_prazo ? ['Justificativa do prazo', E(x.justificativa_prazo)] : null].filter(Boolean);
    const acoes = [];
    if (souDono && x.situacao === 'devolvido') acoes.push(`<div class="acoes"><button class="btn pri" data-acao="viag-nova" data-t="${x.tipo}" data-id="${E(x.id)}">Corrigir e reenviar</button></div>`);
    if (souDono && ['enviado', 'devolvido'].includes(x.situacao)) acoes.push(formMover(x, 'Cancelar este pedido', [['cancelar', 'Cancelar o pedido', 'perigo']], 'Motivo (opcional)'));
    if (!souDono && papel === 'coord_tecnico' && x.situacao === 'enviado') acoes.push(formMover(x, 'Conferência', [['conferir', 'Conferido: mandar para a coordenação geral', 'pri'], ['devolver', 'Devolver para corrigir', 'perigo']], 'Observação (obrigatória para devolver)'));
    if (papel === 'coord_geral' && x.situacao === 'enviado') acoes.push(formMover(x, 'Conferir no lugar da coordenação técnica', [['conferir', 'Conferido', ''], ['devolver', 'Devolver para corrigir', 'perigo'], ['recusar', 'Recusar', 'perigo']], 'Observação (obrigatória para devolver ou recusar)'));
    if (papel === 'coord_geral' && x.situacao === 'conferido') acoes.push(formMover(x, 'Autorizar e mandar para a FUNCERN', [['autorizar', 'Autorizar', 'pri'], ['devolver', 'Devolver para corrigir', 'perigo'], ['recusar', 'Recusar', 'perigo']], 'Observação (obrigatória para devolver ou recusar)', true));
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
  function formMover(x, titulo, botoes, rotObs, protocolo) {
    return `<form class="bloco" data-form="viag-mover" data-id="${E(x.id)}" novalidate><h3>${titulo}</h3>
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
    const t = k => String(fd.get(k) || '').trim(); const n = k => t(k) === '' ? null : Math.max(0, parseInt(t(k), 10) || 0);
    if (tipo === 'passagem') {
      const col = k => fd.getAll(k).map(x => String(x || '').trim());
      const nomes = col('ps_nome'), cpfs = col('ps_cpf'), nasc = col('ps_nasc'), rg = col('ps_rg'), org = col('ps_org'), sexo = col('ps_sexo'), cel = col('ps_cel'), em = col('ps_email'), end = col('ps_end');
      const passageiros = nomes.map((x, i) => ({ nome: x.replace(/\s+/g, ' '), cpf: R.soDigitos(cpfs[i]), nascimento: nasc[i], rg: rg[i], rg_orgao: org[i], sexo: sexo[i], celular: cel[i], email: em[i].toLowerCase(), endereco: end[i] || null }));
      return { finalidade: t('finalidade'), origem: t('origem'), destino: t('destino'), volta: t('volta') || null, volta_para: t('volta_para') || null, sugestao: t('sugestao'), bagagem: t('bagagem'), passageiros };
    }
    const estrutura = {}; ESTRUTURA.forEach(([k]) => { estrutura[k] = !!fd.get('est_' + k); }); estrutura.cadeiras = n('cadeiras'); estrutura.mesas = n('mesas');
    return { hora: t('hora'), duracao: t('duracao'), local: t('local'), referencia: t('referencia'),
      participantes: { mulheres: n('p_mulheres'), equipe: n('p_equipe'), convidados: n('p_convidados') }, estrutura,
      alimentacao: { lanche: n('lanche'), almoco: n('almoco'), servico: t('servico') || null, descartaveis: !!fd.get('descartaveis') },
      responsavel: { nome: t('resp_nome'), celular: t('resp_cel') }, fornecedores: t('fornecedores') || null, orcamento: t('orcamento') || null };
  }
  function validar(tipo, titulo, data, just, d) {
    const e = {};
    if (titulo.length < 5) e.titulo = tipo === 'passagem' ? 'Escreva o objetivo e a atividade.' : 'Escreva o nome do evento e a atividade.';
    if (!data) e.data_ref = 'Informe a data.'; else if (data < R.hoje()) e.data_ref = 'Esta data já passou.'; else if (data > FIM_PROJETO) e.data_ref = 'Passa do fim do projeto (setembro de 2027).';
    else if (diasAte(data) < PRAZO[tipo] && just.length < 15) e.justificativa = `Fora do prazo (${PRAZO[tipo]} dias antes): explique por quê.`;
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
        if (!x.nascimento) m('ps_nasc', 'Informe a data.');
        if (!x.rg) m('ps_rg', 'Informe o RG.');
        if (!x.rg_orgao) m('ps_org', 'Informe o órgão.');
        if (!x.sexo) m('ps_sexo', 'Escolha.');
        if (R.soDigitos(x.celular).length < 10) m('ps_cel', 'Celular com DDD.');
        if (!R.emailValido(x.email)) m('ps_email', 'E-mail inválido.');
      });
      const cpfs = d.passageiros.map(x => x.cpf).filter(Boolean);
      if (new Set(cpfs).size !== cpfs.length) e._geral = 'A mesma pessoa aparece duas vezes.';
      if (lp.length) e._pass = lp;
    } else {
      if (!d.local) e.local = 'Informe o endereço.';
      if (!d.hora) e.hora = 'Informe a hora.';
      const pa = d.participantes; if (!((pa.mulheres || 0) + (pa.equipe || 0) + (pa.convidados || 0))) e.p_mulheres = 'Quantas pessoas?';
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
      const d = lerForm(t, fd);
      const e = validar(t, titulo, data, just, d);
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
        U().toast((form.dataset.id ? 'Pedido reenviado' : 'Pedido enviado') + ' para a coordenação técnica conferir.');
      });
    }
    if (tipo === 'viag-mover') {
      const acao = form.dataset.acao; const obs = String(fd.get('obs') || '').trim(); const prot = String(fd.get('protocolo') || '').trim();
      if (['devolver', 'recusar'].includes(acao) && obs.length < 5) return U().mostrarErros(form, { obs: acao === 'devolver' ? 'Escreva o que precisa ser corrigido.' : 'Escreva o motivo da recusa.' });
      await U().ocupado(form, async () => {
        await S().api.moverPedido(form.dataset.id, acao, obs || null, prot || null);
        await recarregar(); if (acao !== 'protocolo') U().fecharPainel();
        U().toast({ conferir: 'Conferido. Foi para a coordenação geral autorizar.', devolver: 'Devolvido. A bolsista vê o motivo e pode corrigir.', autorizar: 'Autorizado. Mande o pedido para a FUNCERN (use "Copiar texto").',
          recusar: 'Pedido recusado.', cancelar: 'Pedido cancelado.', protocolo: 'Protocolo salvo.' }[acao]);
      });
    }
  }

  MQ.viagUI = { secaoBolsista, abaCoord, painel, clique, enviar, podeVer, contaMinha: () => lista().filter(minhaVez).length, textoFuncern };
})();
