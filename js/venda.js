/* Mulheres & Quintais — orientação de venda do excedente do quintal (01/10/2026). Banco: supabase/44_venda.sql.
   1) Canais de venda por município (feira, grupo, merenda escolar, PAA, comprador): a coordenação e as bolsistas cadastram.
   2) Na visita, quem acompanha o quintal marca o que está sobrando e o sistema monta uma folha simples para a mulher,
      com os caminhos que servem para ela NAQUELE município. A folha sai impressa ou em texto para o WhatsApp.
   Princípios: primeiro a comida da casa (com fome em casa, a folha não fala em venda); sem preço sugerido;
   textos poucos e revisados (data em REVISADO); tom neutro, sem marca de governo. */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui; const S = () => MQ.ui.S;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REVISADO = '2026-10-01';
  const TIPOS = [['feira', 'Feira'], ['grupo', 'Grupo, associação ou cooperativa'], ['merenda', 'Merenda escolar (PNAE)'], ['paa', 'PAA (compra pública de alimentos)'],
    ['comprador', 'Comprador local'], ['outro', 'Outro']];
  const nomeTipo = t => (TIPOS.find(x => x[0] === t) || [, t])[1];
  const ANIMAL = ['galinhas', 'animais'];
  const PRODUTOS = () => MQ.DIAG.producao;
  const nomeProd = k => (PRODUTOS().find(x => x[0] === k) || [, k])[1];
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const eu = () => S().eu || {};
  const podeCanal = () => ['coord_geral', 'coord_tecnico', 'articulacao', 'apoio'].includes(eu().papel);
  const canais = () => S().canaisVenda || [];
  const canaisDe = (uf, municipio) => canais().filter(c => c.ativo && c.uf === uf && norm(c.municipio) === norm(municipio));

  /* ---------- as regras da orientação (função pura: os testes conferem cada caso) ---------- */
  function orientar(x) {
    const sobra = (x.sobra || []).filter(s => s && s.produto);
    const cs = x.canais || []; const de = t => cs.filter(c => c.tipo === t);
    const r = { bloqueio: null, caminhos: [], falta: [], avisos: [], lembretes: [] };
    if (x.ebia === 'grave') {
      r.bloqueio = 'Hoje o mais importante é a comida da casa. O que o quintal produz deve ficar primeiro para a família. Quando a mesa estiver garantida, conversamos sobre vender o que sobrar.';
      return r;
    }
    if (!sobra.length) {
      r.avisos.push('Hoje não está sobrando produção. Tudo bem: o quintal é primeiro para a família comer bem. Quando começar a sobrar, avise na próxima visita.');
      return r;
    }
    const vegetal = sobra.filter(s => !ANIMAL.includes(s.produto)); const animal = sobra.filter(s => ANIMAL.includes(s.produto));
    const regular = vegetal.some(s => s.regular);
    r.caminhos.push({ id: 'perto', titulo: 'Vender perto de casa', texto: 'Vizinhança, comunidade, igreja, encomendas pelo WhatsApp. É o caminho mais simples para começar: avise o que tem e em que dia colhe.', canais: de('comprador').concat(de('outro')) });
    if (de('feira').length || sobra.length >= 2 || sobra.some(s => s.regular))
      r.caminhos.push({ id: 'feira', titulo: 'Vender na feira', texto: de('feira').length ? 'Há feira no município. Leve produto fresco, limpo e separado por tipo; combine com outras mulheres para dividir a banca e o transporte.'
        : 'Ainda não temos feira cadastrada neste município. Pergunte na comunidade ou à bolsista se há feira da agricultura familiar por perto.', canais: de('feira') });
    if (regular) {
      r.caminhos.push({ id: 'grupo', titulo: 'Vender em grupo para a merenda escolar e o PAA', texto: 'As escolas públicas e o PAA compram da agricultura familiar. Uma família sozinha quase nunca tem quantidade para atender: a venda é feita em grupo, por associação ou cooperativa, com entrega combinada.',
        canais: de('grupo').concat(de('merenda'), de('paa')) });
      if (x.caf !== 'sim') r.falta.push(x.caf === 'nao' ? 'Tirar o CAF (Cadastro Nacional da Agricultura Familiar): é o documento que permite vender para a merenda escolar e o PAA. Procure o sindicato de trabalhadoras e trabalhadores rurais, o órgão de assistência técnica do estado ou a secretaria de agricultura do município.'
        : 'Conferir se a família tem CAF ou DAP válida: sem esse documento não dá para vender para a merenda escolar nem para o PAA.');
      if (!x.grupo) r.falta.push('Entrar em um grupo, associação ou cooperativa (ou formar um grupo com as outras mulheres do projeto no município): é o grupo que apresenta a proposta de venda.');
    } else if (vegetal.length) {
      r.lembretes.push('Quando a sobra for certa toda semana, vale conversar sobre vender em grupo para a merenda escolar e o PAA.');
    }
    if (animal.length) r.avisos.push('Ovos, carne, leite e queijo: para vender a escola, mercado ou programa público, produto de origem animal precisa de inspeção sanitária. Pergunte na secretaria de agricultura do município como funciona antes de combinar a venda.');
    r.lembretes.push('Venda só o que sobra: primeiro a comida da família.', 'Anote o que vendeu e por quanto: ajuda a saber se está valendo a pena.', 'Combine o preço olhando o que se cobra na feira e na comunidade.');
    return r;
  }

  /* ---------- folha (tela, papel e WhatsApp) ---------- */
  const linhaCanal = c => `<li><b>${E(c.nome)}</b> <span class="vd-tipo">${E(nomeTipo(c.tipo))}</span>${c.detalhe ? `<br>${E(c.detalhe)}` : ''}${c.contato ? `<br><span class="vd-cont">Contato: ${E(c.contato)}</span>` : ''}</li>`;
  function folhaHTML(f, x, r) {
    const prods = (x.sobra || []).map(s => nomeProd(s.produto) + (s.regular ? ' (toda semana)' : ' (de vez em quando)'));
    return `<article class="vd-folha">
      <header><p class="vd-proj">Mulheres &amp; Quintais · Quintais Produtivos para Mulheres Rurais</p>
        <h3>Como vender o que sobra do quintal</h3>
        <p class="vd-quem">${E(f.nome_social || f.nome || '')} · ${E(f.municipio || '')}/${E(f.uf || '')} · ${R.fmtData(R.hoje())}</p></header>
      ${r.bloqueio ? `<p class="vd-dest">${E(r.bloqueio)}</p>` : ''}
      ${prods.length && !r.bloqueio ? `<p><b>O que está sobrando:</b> ${E(prods.join(', '))}.</p>` : ''}
      ${r.avisos.map(a => `<p class="vd-aviso">${E(a)}</p>`).join('')}
      ${r.caminhos.length ? `<h4>Caminhos para vender</h4><ol class="vd-cam">${r.caminhos.map(c => `<li><b>${E(c.titulo)}</b><p>${E(c.texto)}</p>${c.canais.length ? `<ul class="vd-canais">${c.canais.map(linhaCanal).join('')}</ul>` : ''}</li>`).join('')}</ol>` : ''}
      ${r.falta.length ? `<h4>O que falta resolver</h4><ul class="vd-falta">${r.falta.map(t => `<li>${E(t)}</li>`).join('')}</ul>` : ''}
      ${r.lembretes.length ? `<h4>Para lembrar</h4><ul>${r.lembretes.map(t => `<li>${E(t)}</li>`).join('')}</ul>` : ''}
      <footer>Orientação geral, revisada em ${R.fmtData(REVISADO)}. As regras dos programas e da vigilância sanitária mudam: confirme no município antes de combinar a venda. Orientou: ${E(eu().nome_social || eu().nome || '')}.</footer>
    </article>`;
  }
  function folhaTexto(f, x, r) {
    const L = ['*Como vender o que sobra do quintal*', `${f.nome_social || f.nome || ''} · ${f.municipio || ''}/${f.uf || ''}`, ''];
    if (r.bloqueio) L.push(r.bloqueio, '');
    r.avisos.forEach(a => L.push(a, ''));
    r.caminhos.forEach((c, i) => { L.push(`*${i + 1}. ${c.titulo}*`, c.texto); c.canais.forEach(k => L.push(`• ${k.nome} (${nomeTipo(k.tipo)})${k.detalhe ? ': ' + k.detalhe : ''}${k.contato ? ' — contato: ' + k.contato : ''}`)); L.push(''); });
    if (r.falta.length) { L.push('*O que falta resolver*'); r.falta.forEach(t => L.push('• ' + t)); L.push(''); }
    if (r.lembretes.length) { L.push('*Para lembrar*'); r.lembretes.forEach(t => L.push('• ' + t)); L.push(''); }
    L.push('Mulheres & Quintais');
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  const CSS_PAPEL = `@page { size: A4; margin: 16mm; } body { font: 12pt/1.5 system-ui, Arial, sans-serif; color: #2E1D15; margin: 0; }
    .tela { padding: 10px; display: flex; gap: 8px; } .tela button { font: inherit; padding: 8px 14px; } @media print { .tela { display: none; } }
    .vd-folha { max-width: 170mm; margin: 0 auto; } .vd-proj { font-size: 9pt; color: #634F43; margin: 0; letter-spacing: .04em; } h3 { font: 600 18pt/1.2 Georgia, serif; margin: 4px 0 2px; }
    .vd-quem { margin: 0 0 12px; color: #634F43; } h4 { font-size: 12pt; margin: 14px 0 4px; border-bottom: 1px solid #CDB79D; padding-bottom: 2px; }
    .vd-dest, .vd-aviso { background: #F1E7DB; padding: 8px 10px; border-radius: 4px; } ol, ul { margin: 4px 0; padding-left: 20px; } .vd-cam > li { margin-bottom: 8px; break-inside: avoid; } .vd-cam p { margin: 2px 0; }
    .vd-tipo { font-size: 9pt; color: #634F43; } .vd-cont { font-size: 10pt; } footer { margin-top: 16px; font-size: 8.5pt; color: #634F43; border-top: 1px solid #E2D3C1; padding-top: 6px; }`;
  function imprimir(html) {
    const pag = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Como vender o que sobra do quintal · Mulheres & Quintais</title><style>${CSS_PAPEL}</style></head>
      <body><div class="tela"><button type="button" onclick="window.close()">Fechar</button><button type="button" onclick="window.print()">Imprimir</button></div>${html}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(pag); w.document.close(); w.onload = () => { try { w.focus(); w.print(); } catch (e) {} }; return; }
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fr); fr.contentDocument.open(); fr.contentDocument.write(pag); fr.contentDocument.close();
    setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 2000); }, 400);
  }

  /* ---------- seção: canais de venda (bolsista: o estado dela; coordenação: todos) ---------- */
  function secaoCanais(ufFixo) {
    if (S().vendaSemBanco) return `<section class="secao" aria-labelledby="t-venda"><h2 id="t-venda">Onde vender</h2>
      <p class="aviso">A orientação de venda ainda não está instalada no servidor. A coordenação geral roda o arquivo <b>44_venda.sql</b> no Supabase.</p></section>`;
    const l = canais().filter(c => !ufFixo || c.uf === ufFixo); const porMun = {};
    l.forEach(c => { const k = c.uf + '|' + c.municipio; (porMun[k] = porMun[k] || []).push(c); });
    const chaves = Object.keys(porMun).sort((a, b) => a.localeCompare(b));
    const conteudo = `${podeCanal() ? `<div class="acoes"><button type="button" class="btn pri peq" data-acao="venda-canal-novo"${ufFixo ? ` data-uf="${E(ufFixo)}"` : ''}>+ Cadastrar canal</button></div>` : ''}
      ${chaves.length ? chaves.map(k => { const [uf, mun] = k.split('|'); return `<div class="vd-mun"><h3><span class="etq etq-uf">${E(uf)}</span> ${E(mun)}</h3>
        <ul class="vd-lista">${porMun[k].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome)).map(c => `<li class="${c.ativo ? '' : 'inativo'}">
          <span class="vd-l1"><b>${E(c.nome)}</b> <span class="etq">${E(nomeTipo(c.tipo))}</span>${c.ativo ? '' : ' <span class="etq">Desativado</span>'}</span>
          ${c.detalhe ? `<span class="small">${E(c.detalhe)}</span>` : ''}${c.contato ? `<span class="small muted">Contato: ${E(c.contato)}</span>` : ''}
          ${podeCanal() && (!ufFixo || c.uf === ufFixo) ? `<button type="button" class="link small" data-acao="venda-canal-editar" data-id="${E(c.id)}">Editar</button>` : ''}</li>`).join('')}</ul></div>`; }).join('')
        : `<p class="muted">Nenhum canal cadastrado${ufFixo ? ' no estado' : ''} ainda. Sem os canais do município, a folha de orientação sai só com as dicas gerais.</p>`}
      <p class="nota">Feira (dia e local), grupo ou cooperativa, contato da merenda escolar, quem opera o PAA, compradores. O contato é o da pessoa de referência do canal.</p>`;
    return `<section class="secao" aria-labelledby="t-venda"><div class="secao-cab"><div><h2 id="t-venda">Onde vender${ufFixo ? ' · ' + E(U().nomeUF(ufFixo)) : ''}</h2>
      <p>Canais de venda de cada município. Entram na folha de orientação que a mulher recebe na visita.</p></div></div>
      ${U().dobra('venda-canais', `<span><b>${l.filter(c => c.ativo).length} cana${l.filter(c => c.ativo).length === 1 ? 'l' : 'is'} em ${chaves.length} município${chaves.length === 1 ? '' : 's'}</b> <span class="small muted">· ver e cadastrar</span></span>`, conteudo)}</section>`;
  }
  const botaoOrientar = fid => S().vendaSemBanco ? '' : `<button type="button" class="btn peq" data-acao="venda-orientar" data-ficha="${E(fid)}">Orientação de venda</button>`;

  /* ---------- painéis ---------- */
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function painelCanal(p) {
    const c = p.id ? canais().find(x => x.id === p.id) || {} : {}; const bols = R.ehBolsista(eu().papel); const uf = c.uf || p.uf || (bols ? eu().uf : '');
    const muns = Object.keys(((MQ.GEO || {}).mun || {})[uf] || {}).sort();
    return cab('Onde vender', p.id ? 'Editar canal' : 'Cadastrar canal') + `<div class="painel-corpo"><form class="f" data-form="venda-canal" ${p.id ? `data-id="${E(p.id)}"` : ''} novalidate><div class="campos">
        <div class="campo"><label for="vc-uf">Estado</label><select id="vc-uf" name="uf" ${bols || p.id ? 'disabled' : ''}><option value="">Escolha</option>${MQ.UFS.map(u => `<option value="${u.uf}" ${u.uf === uf ? 'selected' : ''}>${E(u.nome)}</option>`).join('')}</select>${bols || p.id ? `<input type="hidden" name="uf" value="${E(uf)}">` : ''}</div>
        <div class="campo"><label for="vc-mun">Município</label><input id="vc-mun" name="municipio" list="vc-muns" value="${E(c.municipio || '')}" autocomplete="off" maxlength="80"><datalist id="vc-muns">${muns.map(m => `<option value="${E(m)}">`).join('')}</datalist></div>
        <div class="campo inteiro"><label for="vc-tipo">Tipo de canal</label><select id="vc-tipo" name="tipo"><option value="">Escolha</option>${TIPOS.map(([k, t]) => `<option value="${k}" ${c.tipo === k ? 'selected' : ''}>${E(t)}</option>`).join('')}</select></div>
        <div class="campo inteiro"><label for="vc-nome">Nome</label><input id="vc-nome" name="nome" value="${E(c.nome || '')}" maxlength="120" placeholder="Ex.: Feira da agricultura familiar de Paulistana"></div>
        <div class="campo inteiro"><label for="vc-det">Como funciona</label><textarea id="vc-det" name="detalhe" rows="3" maxlength="400" placeholder="Dia, horário e local; o que compram; como participar.">${E(c.detalhe || '')}</textarea></div>
        <div class="campo inteiro"><label for="vc-cont">Contato</label><input id="vc-cont" name="contato" value="${E(c.contato || '')}" maxlength="160" placeholder="Nome e telefone de quem atende"><span class="dica">Pessoa de referência do canal (não é dado das mulheres do projeto).</span></div>
        ${p.id ? `<label class="check inteiro"><input type="checkbox" name="ativo" ${c.ativo !== false ? 'checked' : ''}> Canal ativo (desmarque se acabou; ele sai das folhas, mas continua guardado)</label>` : ''}
      </div><div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }
  function painelOrientar(p) {
    const f = (S().fichas || []).find(x => x.id === p.ficha); if (!f) return cab('Orientação de venda', 'Não encontrada') + '<div class="painel-corpo"><p class="muted">Quintal não encontrado.</p></div>';
    const dg = (MQ.campoUI ? MQ.campoUI.diagnosticos() : S().diagnosticos || []).find(d => d.ficha_id === f.id) || {}; const prod = (dg.dados && dg.dados.producao) || dg.producao || {};
    const ant = (S().orientacoesVenda || []).filter(o => o.ficha_id === f.id).sort((a, b) => String(b.feito_em).localeCompare(String(a.feito_em)));
    const ult = ant[0] ? ant[0].dados || {} : {}; const marc = k => (ult.sobra || []).find(s => s.produto === k);
    const nCanais = canaisDe(f.uf, f.municipio).length;
    return cab(`Orientação de venda · ${E(f.uf)} · ${E(f.municipio || '')}`, E(f.nome_social || f.nome || 'Quintal')) + `<div class="painel-corpo">
      <p>Converse com ela sobre o que está <b>sobrando</b> depois que a família come. O sistema monta uma folha simples com os caminhos de venda no município${nCanais ? ` (${nCanais} cana${nCanais === 1 ? 'l cadastrado' : 'is cadastrados'})` : ' (nenhum canal cadastrado ainda: a folha sai só com as dicas gerais)'}.</p>
      ${ant.length ? `<p class="small muted">Última orientação registrada em ${R.fmtData(ant[0].feito_em)}.</p>` : ''}
      <form class="f" data-form="venda-orientar" data-ficha="${E(f.id)}" novalidate>
        <fieldset><legend>O que está sobrando</legend><div class="vd-sobra">${PRODUTOS().map(([k, t]) => { const m = marc(k); const on = m ? true : !ant.length && !!(prod[k] && prod[k].venda);
          return `<div class="vd-s"><label class="mini-chk"><input type="checkbox" name="sobra_${k}" ${on ? 'checked' : ''}><b>${E(t)}</b></label>
            <span class="vd-reg"><label class="mini-chk"><input type="radio" name="reg_${k}" value="s" ${m && m.regular ? 'checked' : ''}>Toda semana</label><label class="mini-chk"><input type="radio" name="reg_${k}" value="n" ${!(m && m.regular) ? 'checked' : ''}>De vez em quando</label></span></div>`; }).join('')}</div>
          <span class="dica">Nada marcado: a folha diz que hoje não sobra e que a prioridade é a família.</span></fieldset>
        <div class="campos">
          <div class="campo"><label for="vo-caf">A família tem CAF ou DAP?</label><select id="vo-caf" name="caf"><option value="">Escolha</option>${[['sim', 'Sim'], ['nao', 'Não'], ['nao_sabe', 'Não sabe']].map(([k, t]) => `<option value="${k}" ${ult.caf === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <span class="dica">Documento da agricultura familiar. Sem ele não se vende para a merenda escolar nem para o PAA.</span></div>
          <div class="campo"><label for="vo-grupo">Participa de grupo, associação ou cooperativa?</label><select id="vo-grupo" name="grupo"><option value="n" ${ult.grupo ? '' : 'selected'}>Não</option><option value="s" ${ult.grupo ? 'selected' : ''}>Sim</option></select></div>
          <div class="campo inteiro"><label for="vo-obs">Observação (opcional)</label><textarea id="vo-obs" name="obs" rows="2" maxlength="300" placeholder="Ex.: já vende ovos na vizinhança; quer entrar na feira de sábado."></textarea></div>
        </div><div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Gerar a folha</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }
  function painelFolha(p) {
    const v = S().vendaFolha; if (!v) return cab('Orientação de venda', 'Folha') + '<div class="painel-corpo"><p class="muted">Gere a folha de novo.</p></div>';
    return cab('Orientação de venda', 'Folha para entregar') + `<div class="painel-corpo">
      ${v.gravada ? '<div class="aviso ok-aviso">Orientação registrada.</div>' : `<div class="aviso">${E(v.erro || 'Sem internet: a folha foi montada, mas o registro ainda não foi gravado.')} <button type="button" class="link" data-acao="venda-gravar">Tentar gravar de novo</button></div>`}
      <div class="acoes"><button type="button" class="btn pri" data-acao="venda-imprimir">Imprimir</button><button type="button" class="btn" data-acao="venda-copiar">Copiar texto para o WhatsApp</button><button type="button" class="btn" data-acao="fechar">Fechar</button></div>
      <div class="vd-previa">${v.html}</div></div>`;
  }
  function painel(p) { return p.tipo === 'venda-canal' ? painelCanal(p) : p.tipo === 'venda-orientar' ? painelOrientar(p) : p.tipo === 'venda-folha' ? painelFolha(p) : ''; }

  async function gravar() {
    const v = S().vendaFolha; if (!v || v.gravada) return;
    try { await S().api.registrarOrientacaoVenda(v.ficha_id, v.dados); v.gravada = true; v.erro = null; await U().carregar(); }
    catch (e) { v.erro = /fetch|network|internet|offline/i.test(String(e && e.message)) || (typeof navigator !== 'undefined' && navigator.onLine === false) ? null : String((e && e.message) || e); }
  }
  async function clique(a, el) {
    if (a === 'venda-canal-novo') U().abrirPainel({ tipo: 'venda-canal', uf: el.dataset.uf || '' });
    else if (a === 'venda-canal-editar') U().abrirPainel({ tipo: 'venda-canal', id: el.dataset.id });
    else if (a === 'venda-orientar') U().abrirPainel({ tipo: 'venda-orientar', ficha: el.dataset.ficha });
    else if (a === 'venda-imprimir') { const v = S().vendaFolha; if (v) imprimir(v.html); }
    else if (a === 'venda-copiar') { const v = S().vendaFolha; if (!v) return;
      try { await navigator.clipboard.writeText(v.texto); U().toast('Texto copiado. Cole no WhatsApp.'); } catch (e) { U().toast('Não deu para copiar neste aparelho. Use Imprimir.'); } }
    else if (a === 'venda-gravar') { await gravar(); U().abrirPainel({ tipo: 'venda-folha' }); }
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'venda-canal') {
      const x = { id: form.dataset.id || null, uf: String(fd.get('uf') || ''), municipio: String(fd.get('municipio') || '').trim(), tipo: String(fd.get('tipo') || ''), nome: String(fd.get('nome') || '').trim(),
        detalhe: String(fd.get('detalhe') || '').trim(), contato: String(fd.get('contato') || '').trim(), ativo: form.dataset.id ? !!fd.get('ativo') : true };
      const e = {};
      if (!x.uf) e.uf = 'Escolha o estado.';
      if (x.municipio.length < 2) e.municipio = 'Informe o município.';
      if (!x.tipo) e.tipo = 'Escolha o tipo de canal.';
      if (x.nome.length < 3) e.nome = 'Dê um nome ao canal (pelo menos 3 letras).';
      if (Object.keys(e).length) return U().mostrarErros(form, e);
      return U().ocupado(form, async () => { await S().api.salvarCanalVenda(x); await U().carregar(); U().fecharPainel(); U().render(); U().toast(x.id ? 'Canal atualizado.' : 'Canal cadastrado.'); });
    }
    if (tipo === 'venda-orientar') {
      const f = (S().fichas || []).find(y => y.id === form.dataset.ficha); if (!f) return;
      const sobra = PRODUTOS().filter(([k]) => fd.get('sobra_' + k)).map(([k]) => ({ produto: k, regular: fd.get('reg_' + k) === 's' }));
      const caf = String(fd.get('caf') || '');
      if (!caf) return U().mostrarErros(form, { caf: 'Responda se a família tem CAF ou DAP.' });
      const dados = { sobra, caf, grupo: fd.get('grupo') === 's', obs: String(fd.get('obs') || '').trim() || undefined };
      const dg = (MQ.campoUI ? MQ.campoUI.diagnosticos() : S().diagnosticos || []).find(d => d.ficha_id === f.id) || {};
      const im = (dg.dados && dg.dados.impacto) || dg.impacto || {};
      const r = orientar({ sobra, caf, grupo: dados.grupo, ebia: im.ebia_nivel, canais: canaisDe(f.uf, f.municipio) });
      S().vendaFolha = { ficha_id: f.id, dados, html: folhaHTML(f, dados, r), texto: folhaTexto(f, dados, r), gravada: false };
      await U().ocupado(form, async () => { await gravar(); U().abrirPainel({ tipo: 'venda-folha' }); });
    }
  }
  MQ.vendaUI = { orientar, folhaHTML, folhaTexto, secaoCanais, botaoOrientar, painel, clique, enviar, TIPOS, REVISADO };
})();
