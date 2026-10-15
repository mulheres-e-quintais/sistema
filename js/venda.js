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
  const CSS_PAPEL = `@page { size: A4; margin: 16mm; } body { font: 12pt/1.5 Manrope, system-ui, Arial, sans-serif; color: #2E1D15; margin: 0; }
    .tela { padding: 10px; display: flex; gap: 8px; } .tela button { font: inherit; padding: 8px 14px; } @media print { .tela { display: none; } }
    .vd-folha { max-width: 170mm; margin: 0 auto; } .vd-proj { font-size: 9pt; color: #634F43; margin: 0; letter-spacing: .04em; } h3 { font: 600 18pt/1.2 Manrope, system-ui, Arial, sans-serif; margin: 4px 0 2px; }
    .vd-quem { margin: 0 0 12px; color: #634F43; } h4 { font-size: 12pt; margin: 14px 0 4px; border-bottom: 1px solid #CDB79D; padding-bottom: 2px; }
    .vd-dest, .vd-aviso { background: #F1E7DB; padding: 8px 10px; border-radius: 4px; } ol, ul { margin: 4px 0; padding-left: 20px; } .vd-cam > li { margin-bottom: 8px; break-inside: avoid; } .vd-cam p { margin: 2px 0; }
    .vd-tipo { font-size: 9pt; color: #634F43; } .vd-cont { font-size: 10pt; } footer { margin-top: 16px; font-size: 8.5pt; color: #634F43; border-top: 1px solid #E2D3C1; padding-top: 6px; }`;
  function imprimir(html) {
    const pag = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Como vender o que sobra do quintal · Mulheres & Quintais</title>${MQ.FONTES_LINK || ''}<style>${CSS_PAPEL}</style></head>
      <body><div class="tela"><button type="button" data-jan="fechar">Fechar</button><button type="button" data-jan="imprimir">Imprimir</button></div>${html}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(pag); w.document.close(); MQ.ligarJanela(w); w.onload = () => { try { w.focus(); w.print(); } catch (e) {} }; return; }
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0'; fr.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fr); fr.contentDocument.open(); fr.contentDocument.write(pag); fr.contentDocument.close();
    setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 2000); }, 400);
  }

  /* ---------- seção: canais de venda (bolsista: o estado dela; coordenação: todos) ---------- */
  /* 15/10/2026: "Onde vender" mais visual: um ícone por tipo de canal com a contagem, a semana das feiras (que dia tem feira)
     e a cobertura (municípios com mulher selecionada que ainda não têm canal). A lista completa continua na dobra, em cartões. */
  const IC = {
    feira: '<path d="M3 10h18M4 10l2-5h12l2 5M5 10v9h14v-9M9 19v-5h6v5"/><path d="M4 10c0 1.4 1.1 2 2.3 2S8.7 11.4 8.7 10c0 1.4 1.1 2 2.3 2s2.3-.6 2.3-2c0 1.4 1.1 2 2.3 2s2.4-.6 2.4-2"/>',
    grupo: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5M13.5 15.2c.9-.8 1.9-1.2 3-1.2 2.3 0 4.2 1.5 4.6 4.5"/>',
    merenda: '<path d="M12 7c-1-2.5-3.5-3-5-2.5C4.5 5.3 3.5 8 4 11c.6 4 3.5 8 6 8 .8 0 1.3-.4 2-.4s1.2.4 2 .4c2.5 0 5.4-4 6-8 .5-3-.5-5.7-3-6.5-1.5-.5-4 0-5 2.5z"/><path d="M12 7c0-2 1-3.5 2.5-4"/>',
    paa: '<path d="M3 9h18l-2 10H5L3 9z"/><path d="M8 9l3-5M16 9l-3-5M9 13v3M12 13v3M15 13v3"/>',
    comprador: '<path d="M4 9.5L5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5h16"/><path d="M9.5 20v-5h5v5"/>',
    outro: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>'
  };
  const icone = (t, tam) => `<svg viewBox="0 0 24 24" width="${tam || 22}" height="${tam || 22}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[t] || IC.outro}</svg>`;
  /* 66: dia da semana lido só do DETALHE do canal, palavra inteira ("quinta" não casa com "Quintais"; "São Domingos" não é domingo),
     com abreviações (seg, ter, qua, qui, sex, sáb, dom, 2ª) e intervalo ("segunda a sexta", "seg-sex"). "segunda quinzena" não conta. */
  const DIAS = [['seg', 'Seg', /\b(segundas?(-feiras?)?|seg|2a(-feira)?)\b(?!\s+quinzena)/], ['ter', 'Ter', /\b(tercas?(-feiras?)?|ter|3a(-feira)?)\b/], ['qua', 'Qua', /\b(quartas?(-feiras?)?|qua|4a(-feira)?)\b/],
    ['qui', 'Qui', /\b(quintas?(-feiras?)?|qui|5a(-feira)?)\b/], ['sex', 'Sex', /\b(sextas?(-feiras?)?|sex|6a(-feira)?)\b/], ['sab', 'Sáb', /\b(sabados?|sab)\b/], ['dom', 'Dom', /(?<!sao )\b(domingos?|dom)\b/]];
  function diasDe(texto) {
    const t = norm(texto).replace(/[ºª°]/g, 'a').replace(/\s+/g, ' ');
    const marc = DIAS.map(([, , re]) => re.test(t));
    // intervalo: "segunda a sexta", "seg-sex", "de terça até sábado"
    const nomes = DIAS.map(([, , re]) => new RegExp(re.source));
    const m = t.match(/[a-z0-9]+(?:-feiras?)?(?:\s+(?:ate|a)\s+|\s*-\s*(?!feira))[a-z0-9]+/g) || [];
    m.forEach(par => { const [a, b] = par.split(/\s+(?:ate|a)\s+|\s*-\s*(?!feira)/); const ia = nomes.findIndex(r => r.test(a || '')), ib = nomes.findIndex(r => r.test(b || ''));
      if (ia >= 0 && ib > ia) for (let i = ia; i <= ib; i++) marc[i] = true; });
    return marc;
  }
  function secaoCanais(ufFixo) {
    if (S().vendaSemBanco) return `<section class="secao" aria-labelledby="t-venda"><h2 id="t-venda">Onde vender</h2>
      <p class="aviso">A orientação de venda ainda não está instalada no servidor. A coordenação geral roda o arquivo <b>44_venda.sql</b> no Supabase.</p></section>`;
    const l = canais().filter(c => !ufFixo || c.uf === ufFixo); const porMun = {};
    l.forEach(c => { const k = c.uf + '|' + norm(c.municipio); (porMun[k] = porMun[k] || []).push(c); });
    const chaves = Object.keys(porMun).sort((a, b) => a.localeCompare(b));
    const ativos = l.filter(c => c.ativo); const munAtivos = new Set(ativos.map(c => c.uf + '|' + norm(c.municipio))).size;
    // 1. tipos de canal, com ícone e contagem (feira, merenda e PAA aparecem mesmo zerados: são os caminhos principais)
    const cont = {}; ativos.forEach(c => { cont[c.tipo] = (cont[c.tipo] || 0) + 1; });
    const tipos = TIPOS.filter(([k]) => cont[k] || ['feira', 'merenda', 'paa'].includes(k));
    const blocoTipos = `<ul class="vd2-tipos">${tipos.map(([k, t]) => `<li class="vd2-t t-${k}${cont[k] ? '' : ' zero'}"><span class="vd2-ic">${icone(k)}</span><b class="num">${cont[k] || 0}</b><span>${E(t)}</span></li>`).join('')}</ul>`;
    // 2. semana das feiras: em que dia há feira (lido do detalhe: "Sábados, 5h às 11h")
    const feiras = ativos.filter(c => c.tipo === 'feira'); const dd = feiras.map(c => diasDe(c.detalhe || ''));
    const porDia = DIAS.map((_, i) => dd.filter(x => x[i]).length), semDia = dd.filter(x => !x.some(Boolean)).length;
    const maxDia = Math.max(1, ...porDia);
    const blocoSemana = feiras.length ? `<div class="vd2-semana"><h3>Semana das feiras</h3><ol class="vd2-dias">${DIAS.map(([k, nm], i) => `<li class="${porDia[i] ? 'tem' : ''}" style="--n:${(porDia[i] / maxDia).toFixed(2)}"><span class="vd2-bola num" aria-hidden="true">${porDia[i] || ''}</span><span class="vd2-dia">${nm}</span><span class="so-leitor">: ${porDia[i]} feira${porDia[i] === 1 ? '' : 's'}</span></li>`).join('')}</ol>
      ${semDia ? `<p class="small muted">${semDia} feira${semDia === 1 ? '' : 's'} sem o dia no detalhe: escreva o dia (ex.: "Sábados, 5h às 11h") para aparecer aqui.</p>` : ''}</div>` : '';
    // 3. cobertura: municípios com mulher selecionada × municípios com canal ativo
    const comCanal = new Set(ativos.map(c => c.uf + '|' + norm(c.municipio)));
    const munSel = {}; (S().fichas || []).filter(f => f.resultado === 'selecionada' && f.situacao === 'aprovada' && (!ufFixo || f.uf === ufFixo)).forEach(f => { const k = f.uf + '|' + norm(f.municipio); munSel[k] = munSel[k] || { uf: f.uf, nome: f.municipio, n: 0 }; munSel[k].n++; });
    const listaSel = Object.entries(munSel); const semCanal = listaSel.filter(([k]) => !comCanal.has(k)).map(([, v]) => v).sort((a, b) => b.n - a.n);
    const cob = listaSel.length ? Math.round((listaSel.length - semCanal.length) / listaSel.length * 100) : 0;
    const blocoCob = listaSel.length ? `<div class="vd2-cob"><h3>Municípios com canal de venda</h3>
      <p class="vd2-cob-n"><b class="num">${listaSel.length - semCanal.length}</b> de ${listaSel.length} municípios com mulheres selecionadas</p>
      <span class="vd2-barra" role="img" aria-label="${cob}% dos municípios com canal"><i class="${cob >= 100 ? 'cheio' : ''}" style="width:${cob}%"></i></span>
      ${semCanal.length ? `<p class="small">Sem canal ainda:</p><ul class="vd2-falta">${semCanal.slice(0, 12).map(m => `<li>${E(m.nome)}${ufFixo ? '' : '/' + E(m.uf)} <span class="muted">· ${m.n}</span></li>`).join('')}${semCanal.length > 12 ? `<li class="muted">e mais ${semCanal.length - 12}</li>` : ''}</ul>`
        : '<p class="vd2-ok small">Todo município com mulher selecionada tem pelo menos um canal.</p>'}</div>` : '';
    const conteudo = `${podeCanal() ? `<div class="acoes"><button type="button" class="btn pri peq" data-acao="venda-canal-novo"${ufFixo ? ` data-uf="${E(ufFixo)}"` : ''}>+ Cadastrar canal</button></div>` : ''}
      ${chaves.length ? `<div class="vd2-muns">${chaves.map(k => { const uf = k.split('|')[0], mun = porMun[k][0].municipio; return `<div class="vd-mun vd2-mun"><h3><span class="etq etq-uf">${E(uf)}</span> ${E(mun)}</h3>
        <ul class="vd-lista">${porMun[k].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome)).map(c => `<li class="vd2-c t-${E(c.tipo)}${c.ativo ? '' : ' inativo'}"><span class="vd2-ic peq" title="${E(nomeTipo(c.tipo))}">${icone(c.tipo, 18)}</span><span class="vd2-c-txt">
          <span class="vd-l1"><b>${E(c.nome)}</b> <span class="etq">${E(nomeTipo(c.tipo))}</span>${c.ativo ? '' : ' <span class="etq">Desativado</span>'}</span>
          ${c.detalhe ? `<span class="small">${E(c.detalhe)}</span>` : ''}${c.contato ? `<span class="small muted">Contato: ${E(c.contato)}</span>` : ''}
          ${podeCanal() && (!ufFixo || c.uf === ufFixo) ? `<button type="button" class="link small" data-acao="venda-canal-editar" data-id="${E(c.id)}">Editar</button>` : ''}</span></li>`).join('')}</ul></div>`; }).join('')}</div>`
        : `<p class="muted">Nenhum canal cadastrado${ufFixo ? ' no estado' : ''} ainda. Sem os canais do município, a folha de orientação sai só com as dicas gerais.</p>`}
      <p class="nota">Feira (dia e local), grupo ou cooperativa, contato da merenda escolar, quem opera o PAA, compradores. O contato é o da pessoa de referência do canal.</p>`;
    return `<section class="secao vd2" aria-labelledby="t-venda"><div class="secao-cab"><div><h2 id="t-venda">Onde vender${ufFixo ? ' · ' + E(U().nomeUF(ufFixo)) : ''}</h2>
      <p>Canais de venda de cada município. Entram na folha de orientação que a mulher recebe na visita.</p></div></div>
      ${ativos.length || listaSel.length ? `<div class="vd2-painel">${blocoTipos}<div class="vd2-duas">${blocoSemana}${blocoCob}</div></div>` : ''}
      ${U().dobra('venda-canais', `<span><b>${ativos.length} cana${ativos.length === 1 ? 'l' : 'is'} em ${munAtivos} município${munAtivos === 1 ? '' : 's'}</b> <span class="small muted">· ver e cadastrar</span></span>`, conteudo)}</section>`;
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
  MQ.vendaUI = { orientar, folhaHTML, folhaTexto, secaoCanais, botaoOrientar, painel, clique, enviar, TIPOS, REVISADO, diasDe };
})();
