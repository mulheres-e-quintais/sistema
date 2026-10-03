/* Mulheres & Quintais — vitrine pública: faixa na tela de entrada e página "O projeto em números".
   Só mostra totais por estado e fotos aprovadas pela coordenação. Nada individual. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const R = MQ.regras;
  const $ = s => document.querySelector(s);
  const CHAVE = 'mq-vitrine';
  const V = { dados: null, em: 0, buscando: null, foto: 0, timer: null, lista: null };
  const fmt = n => Number(n || 0).toLocaleString('pt-BR');

  function guardado() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  async function buscar(forcar) {
    if (!V.dados) { const g = guardado(); if (g) { V.dados = g.dados; V.em = g.em; } }
    if (V.buscando) return V.buscando;
    if (!forcar && V.dados && Date.now() - V.em < 60000) return V.dados;
    if (!S().api || !S().api.vitrine) return V.dados;
    V.buscando = S().api.vitrine().then(d => {
      V.dados = d; V.em = Date.now();
      try { localStorage.setItem(CHAVE, JSON.stringify({ dados: d, em: V.em })); } catch (e) {}
      return d;
    }).catch(() => V.dados).finally(() => { V.buscando = null; });
    return V.buscando;
  }

  /* ---------- totais ---------- */
  function totais(d) {
    const t = { fichas: 0, selecionadas: 0, diagnosticos: 0, planos: 0, implantados: 0, acompanhamentos: 0 };
    (d.por_uf || []).forEach(u => Object.keys(t).forEach(k => { t[k] += +u[k] || 0; }));
    t.equipe = (d.equipe || {}).bolsistas + (d.equipe || {}).agentes || 0;
    return t;
  }
  function etapa(t) {
    if (t.acompanhamentos) return { n: 4, nome: 'Acompanhamento dos quintais', txt: 'Quintais implantados recebem visitas técnicas de acompanhamento.' };
    if (t.implantados) return { n: 3, nome: 'Implantação dos quintais', txt: 'Os kits chegam e os quintais são montados com cada mulher.' };
    if (t.diagnosticos) return { n: 2, nome: 'Diagnóstico e plano de cada quintal', txt: 'Na primeira visita, cada mulher monta com a equipe o plano do seu quintal.' };
    return { n: 1, nome: 'Seleção das mulheres', txt: 'As equipes estaduais visitam as comunidades e indicam as mulheres pelos critérios do edital.' };
  }
  function tiles(t, entrada) {
    // três indicadores; o primeiro nunca fica em zero quando há dado real: antes da seleção mostra as indicadas, antes disso a meta
    const mulheres = t.selecionadas ? { v: t.selecionadas, de: 200, l: 'mulheres selecionadas' } : t.fichas ? { v: t.fichas, l: 'mulheres indicadas pelo MPA' } : { v: 200, l: 'quintais previstos no projeto' };
    // tela de entrada: no lugar da equipe, o alcance (de Apodi ao município mais distante, em linha reta, arredondado para baixo)
    if (entrada && alcanceKm() >= 100) return [mulheres, { v: 5, l: 'estados do Nordeste' }, { v: alcanceKm(), pre: 'mais de ', un: ' km', l: 'de Apodi ao quintal mais distante' }];
    return [mulheres, { v: t.equipe, l: 'pessoas na equipe de campo' }, { v: 5, l: 'estados do Nordeste' }].filter((x, i) => i !== 1 || x.v > 0);
  }
  const APODI = [-37.7989, -5.6649];
  function alcanceKm() {
    const rad = x => x * Math.PI / 180; let max = 0;
    Object.values((MQ.GEO && MQ.GEO.mun) || {}).forEach(ms => Object.values(ms).forEach(c => {
      const h = Math.sin(rad(c[1] - APODI[1]) / 2) ** 2 + Math.cos(rad(APODI[1])) * Math.cos(rad(c[1])) * Math.sin(rad(c[0] - APODI[0]) / 2) ** 2;
      max = Math.max(max, 2 * 6371 * Math.asin(Math.sqrt(h))); }));
    return Math.floor(max / 100) * 100;
  }
  const tile = x => `<div class="vt${x.pre ? ' vt-alc' : ''}"><span class="vt-n num">${x.pre ? `<small>${E(x.pre)}</small>` : ''}${fmt(x.v)}${x.un ? `<small>${E(x.un)}</small>` : ''}${x.de ? `<small> de ${x.de}</small>` : ''}</span><span class="vt-l">${E(x.l)}</span></div>`;
  const quando = () => V.em ? new Date(V.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  /* ---------- ilustrações: enquanto nenhuma foto real foi publicada, o mosaico mostra desenhos
     (marcados como ilustração). Não são fotos de pessoas: somem sozinhas quando a primeira foto real entrar. ---------- */
  const ILUS = [['Hortaliças no canteiro', 'regador'], ['Colheita do dia', 'cesto'], ['Galinhas no terreiro', 'galinha'], ['Água guardada na cisterna', 'cisterna'],
    ['Mudas de frutíferas', 'arvore'], ['Canteiros no sertão', 'regador'], ['Feira da agricultura familiar', 'cesto'], ['Plantio de feijão e milho', 'milho'],
    ['Quintal produtivo', 'arvore'], ['Cuidando das mudas', 'regador']];
  function desenho(i, tema) {
    const pele = ['#8D5A3B', '#6B4128', '#B07A52', '#9A6440', '#5A3520'][i % 5], cabelo = ['#2A1B12', '#3B2416', '#1E140E'][i % 3];
    const roupa = ['#A44934', '#2E6B45', '#C98B2B', '#5B6FA6', '#8A4E7A'][(i * 3) % 5], lenco = ['#E7B04A', '#D9725A', '#6A9F5E'][i % 3];
    const ceu = ['#DCE7D6', '#F2E3C6', '#D8E4EC'][i % 3], terra = ['#B98B5E', '#A87B50', '#C69C6D'][i % 3];
    const x = 150 + (i % 3) * 30;   // onde ela fica
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${ceu}"/><circle cx="${330 - (i % 4) * 20}" cy="48" r="24" fill="#E7B04A"/>`;
    s += `<path d="M0 150 Q100 ${130 + (i % 3) * 8} 200 150 T400 145 V300 H0Z" fill="#E9E2CF"/>`;
    for (let r = 0; r < 4; r++) { const y = 185 + r * 28; s += `<rect x="${10 + r * 6}" y="${y}" width="${380 - r * 12}" height="18" rx="9" fill="${terra}"/>`;
      for (let j = 0; j < 11; j++) s += `<circle cx="${28 + j * 34 + r * 4}" cy="${y + 4}" r="${6 + ((i + r + j) % 3) * 2}" fill="${['#2E6B45', '#3C7D4F', '#4F8F5A', '#6A9F5E'][(i + r + j) % 4]}"/>`; }
    // elemento do tema
    if (tema === 'cisterna') s += `<g transform="translate(40 92)"><rect width="78" height="70" rx="6" fill="#E4E0D6" stroke="#9B9588" stroke-width="3"/><path d="M-6 4 Q39 -22 84 4" fill="#CFC9BC" stroke="#9B9588" stroke-width="3"/><rect x="30" y="30" width="18" height="10" rx="2" fill="#7FA7C2"/></g>`;
    if (tema === 'arvore') s += `<g transform="translate(300 60)"><rect x="18" y="60" width="12" height="70" fill="#7A5230"/><circle cx="24" cy="50" r="42" fill="#3C7D4F"/><circle cx="8" cy="52" r="5" fill="#E7B04A"/><circle cx="40" cy="40" r="5" fill="#E7B04A"/><circle cx="28" cy="70" r="5" fill="#E7B04A"/></g>`;
    if (tema === 'galinha') for (let g = 0; g < 3; g++) s += `<g transform="translate(${250 + g * 40} ${150 + (g % 2) * 12})"><ellipse cx="0" cy="0" rx="16" ry="12" fill="${['#F3EDE2', '#B5673A', '#3B2A20'][g]}"/><circle cx="14" cy="-10" r="7" fill="${['#F3EDE2', '#B5673A', '#3B2A20'][g]}"/><path d="M20 -10 l6 2 -6 2z" fill="#E7B04A"/><path d="M12 -18 l2 -5 3 5z" fill="#C0392B"/><path d="M-4 12 v8 M4 12 v8" stroke="#C98B2B" stroke-width="2"/></g>`;
    if (tema === 'milho') for (let g = 0; g < 5; g++) s += `<g transform="translate(${255 + g * 26} 120)"><path d="M0 60 V0" stroke="#4F8F5A" stroke-width="4"/><path d="M0 30 q-14 -6 -18 -20 M0 20 q14 -6 18 -18" stroke="#6A9F5E" stroke-width="3" fill="none"/><ellipse cx="4" cy="12" rx="4" ry="9" fill="#E7B04A"/></g>`;
    // ela
    s += `<g transform="translate(${x} 88)">`;
    s += `<path d="M-30 150 Q-26 70 0 62 Q26 70 30 150Z" fill="${roupa}"/>`;                        // vestido
    s += `<path d="M-22 78 Q-40 100 -34 122" stroke="${pele}" stroke-width="9" stroke-linecap="round" fill="none"/>`;   // braço
    s += `<path d="M22 78 Q40 96 44 112" stroke="${pele}" stroke-width="9" stroke-linecap="round" fill="none"/>`;
    s += `<rect x="-6" y="44" width="12" height="16" fill="${pele}"/><circle cx="0" cy="34" r="20" fill="${pele}"/>`;  // pescoço e rosto (sem feições)
    s += i % 2 ? `<path d="M-21 32 Q-22 8 0 9 Q22 8 21 32 Q14 18 0 18 Q-14 18 -21 32Z" fill="${cabelo}"/>` : `<path d="M-22 30 Q-20 6 0 8 Q20 6 22 30 L22 18 Q0 4 -22 18Z" fill="${lenco}"/>`;
    if (tema === 'regador') s += `<g transform="translate(40 104)"><rect x="0" y="0" width="30" height="22" rx="4" fill="#5B6FA6"/><path d="M30 6 l22 -12" stroke="#5B6FA6" stroke-width="5" stroke-linecap="round"/><path d="M56 -12 l6 8 M58 -6 l8 6" stroke="#7FA7C2" stroke-width="2"/></g>`;
    if (tema === 'cesto') s += `<g transform="translate(-58 110)"><path d="M0 0 h40 l-5 24 h-30z" fill="#C69C6D" stroke="#8C6A45" stroke-width="2"/><circle cx="10" cy="-2" r="6" fill="#C0392B"/><circle cx="22" cy="-4" r="6" fill="#E7B04A"/><circle cx="32" cy="-1" r="6" fill="#4F8F5A"/></g>`;
    s += `</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  const ilustracoes = () => ILUS.map(([leg, tema], i) => ({ url: desenho(i, tema), legenda: leg, uf: MQ.UFS[i % MQ.UFS.length].uf, ilustracao: true }));

  /* ---------- fotos ---------- */
  // sem foto real publicada: o destaque também mostra as ilustrações (com o selo)
  const fotosOuIlus = d => (d && (d.fotos || []).length) ? d.fotos : ilustracoes();

  /* mosaico pequeno da tela de entrada: painel fixo com 7 fotos em tamanhos diferentes; o desenho não muda,
     só as fotos trocam a cada 8 s (se houver mais de 7). Passar o mouse aproxima a foto. */
  // quadros em pé (retrato), para não cortar o rosto: grande à esquerda, dois altos e uma fileira de pequenos
  const PADROES = [['g', 'n', 'n']];   // 01/10/2026: uma imagem principal e duas menores (o mapa é o destaque)
  function miniMosaico(d, passo) {
    const fs = fotosOuIlus(d); if (!fs.length) return '';
    const ilus = !!fs[0].ilustracao; const pad = PADROES[0];
    const itens = pad.map((t, k) => fs[(passo * 3 + k) % fs.length]);
    return `<div class="mini-mos" role="img" aria-label="${ilus ? 'Ilustrações de mulheres nos quintais' : 'Fotos de mulheres nos quintais'}">${itens.map((f, k) =>
      `<span class="mm-${pad[k]}"><img src="${E(f.url)}" alt="" decoding="async">${pad[k] === 'g' ? `<i class="mm-leg">${E(f.legenda)}${f.ilustracao ? '' : ' · ' + E(f.uf)}</i>` : ''}</span>`).join('')}
      ${ilus ? '<span class="mos-selo">Ilustração</span>' : ''}</div>`;
  }
  function girar() {
    clearInterval(V.timer);
    const d = V.dados; if (fotosOuIlus(d).length <= 3) return;   // até 3 fotos: painel parado
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    V.timer = setInterval(() => {
      const box = $('#vit-foto'); if (!box) { clearInterval(V.timer); return; }
      V.foto++; const novo = document.createElement('div'); novo.innerHTML = miniMosaico(d, V.foto);
      // troca só as imagens e a legenda: o painel fica no mesmo lugar
      const imgs = novo.querySelectorAll('img'), atuais = box.querySelectorAll('img');
      atuais.forEach((im, k) => { if (imgs[k] && im.src !== imgs[k].src) { im.classList.remove('troca'); void im.offsetWidth; im.src = imgs[k].src; im.classList.add('troca'); } });
      const lg = box.querySelector('.mm-leg'), lg2 = novo.querySelector('.mm-leg'); if (lg && lg2) lg.textContent = lg2.textContent;
    }, 8000);
  }

  /* ---------- faixa da tela de entrada ---------- */
  function entrada() {
    setTimeout(async () => { await buscar(); desenharEntrada(); }, 0);
    return `<aside class="vitrine" id="vitrine" aria-labelledby="vit-t">${V.dados ? corpoEntrada(V.dados) : esqueleto()}</aside>`;
  }
  /* esqueleto com a MESMA altura do conteúdo final (números, mapa vazio, espaço da foto e rodapé):
     quando os números chegam, nada na tela de entrada sai do lugar */
  const esqueleto = () => `<span class="eyebrow">O projeto agora</span><h2 id="vit-t" class="serif">Mulheres &amp; Quintais em números</h2>
    <div class="vts">${'<div class="vt esq"><span class="vt-n">&nbsp;</span><span class="vt-l">&nbsp;</span></div>'.repeat(3)}</div>
    <div class="vit-duo" aria-hidden="true"><div class="vit-mapa vit-info">${MQ.painelUI && MQ.painelUI.mapaUFs ? MQ.painelUI.mapaUFs({ entrada: true }) : ''}</div>
      <div id="vit-foto"><div class="vit-sem-foto"><span>&nbsp;</span></div></div></div>
    <p class="vit-rodape vit-rodape-fim"><span>&nbsp;</span></p>`;
  /* rotas saindo de Apodi: só na primeira vez que o mapa da entrada aparece; depois voltam ao tracejado em movimento */
  function rotasSaindo() {
    if (V.mapaSaiu) return false; V.mapaSaiu = true;
    setTimeout(() => { if (typeof document !== 'undefined') document.querySelectorAll('.mapa-pub.saindo').forEach(x => x.classList.remove('saindo')); }, 3400);
    return true;
  }
  function corpoEntrada(d) {
    const t = totais(d);
    return `<span class="eyebrow">O projeto agora</span>
      <h2 id="vit-t" class="serif">Mulheres &amp; Quintais em números</h2>
      <div class="vts">${tiles(t, true).map(tile).join('')}</div>
      <div class="vit-duo">
        <div class="vit-mapa vit-info">${/* tela de entrada (02/10/2026): pontos FIXOS, um por município que terá quintais (os mesmos do mapa da Visão geral, MQ.GEO.mun), todos iguais, tenha ou não cadastro; o círculo pelo número de cadastradas fica só na página pública */ MQ.painelUI.mapaUFs({ entrada: true, animar: rotasSaindo() })}</div>
        <div id="vit-foto">${miniMosaico(d, V.foto) || `<div class="vit-sem-foto"><span>As fotos dos quintais aparecem aqui quando a coordenação aprovar, só de quem autorizou.</span></div>`}</div>
      </div>
      <p class="vit-rodape vit-rodape-fim"><span>${quando() ? 'atualizado ' + quando() : ''}</span></p>`;
  }
  function desenharEntrada() {
    const el = $('#vitrine'); if (!el) return;
    if (V.dados) { el.innerHTML = corpoEntrada(V.dados); girar(); }
    else { const m = el.parentElement; el.remove(); if (m) m.classList.remove('entrada'); }   // sem números (servidor sem a etapa 4 ou sem internet): só o login
  }

  /* ---------- página pública "O projeto em números" ---------- */
  function pagina() {
    setTimeout(async () => { await buscar(true); const el = $('#numeros'); if (el) el.innerHTML = V.dados ? corpoPagina(V.dados) : '<div class="login"><h1>Números indisponíveis</h1><p class="muted">Não foi possível carregar os números agora. Tente mais tarde.</p><a class="btn" href="#">Voltar</a></div>'; }, 0);
    return `<main class="wrap publico" id="numeros">${V.dados ? corpoPagina(V.dados) : '<p class="carregando">' + MQ.ampulheta(true) + '</p>'}</main>`;
  }
  function corpoPagina(d) {
    // narrativa: o projeto → números → onde estão os quintais → por estado → mulheres e produção → informações → parceiros
    const t = totais(d); const et = etapa(t);
    const linhas = [['selecionadas', 'Selecionadas', 40], ['diagnosticos', 'Diagnósticos', 40], ['implantados', 'Implantados', 40], ['acompanhamentos', 'Acompanhamentos', 80]];
    const passos = ['Seleção', 'Diagnóstico e plano', 'Implantação', 'Acompanhamento'];
    const fs = fotosOuIlus(d).slice(0, 3); const ilus = fs.length && fs[0].ilustracao;
    const nMun = Object.values(MQ.GEO && MQ.GEO.mun || {}).reduce((x, m) => x + Object.keys(m).length, 0);
    return `<section class="hero-pub">
        <a href="#" class="vit-link voltar">← Entrar no sistema</a>
        <span class="eyebrow">Projeto Quintais Produtivos para Mulheres Rurais</span>
        <h1 class="serif">O projeto em números</h1>
        <p class="lead">200 quintais agroecológicos de mulheres rurais em Alagoas, Bahia, Pernambuco, Piauí e Sergipe, de setembro de 2026 a setembro de 2027. Os números saem direto dos registros de campo.</p>
      </section>
      <div class="vts grande vts-3">${tiles(t).map(tile).join('')}</div>
      <section class="secao pub-mapa" aria-labelledby="t-pub-onde">
        <div class="secao-cab"><div><h2 id="t-pub-onde" class="serif">Onde estão os quintais</h2><p>${nMun} municípios em 5 estados do Nordeste, com a equipe saindo do IFRN Campus Apodi (RN).</p></div></div>
        <div class="vit-mapa vit-info pub-mapa-caixa">${MQ.painelUI.mapaUFs({ entrada: true, municipios: d.municipios })}</div>
        <p class="small muted">O mapa mostra totais por município, não onde cada mulher mora. Município com menos de 3 mulheres aparece sem o número.</p>
      </section>
      <section class="secao" aria-labelledby="t-pub-uf">
        <div class="secao-cab"><div><h2 id="t-pub-uf" class="serif">Distribuição por estado</h2><p>Meta de 40 quintais em cada estado.</p></div></div>
        <div class="pub-tab" role="table">
          <div class="pub-l cab" role="row"><span role="columnheader">Estado</span>${linhas.map(l => `<span role="columnheader">${l[1]}</span>`).join('')}</div>
          ${(d.por_uf || []).map(u => `<div class="pub-l" role="row"><span role="cell"><b>${E(U().nomeUF(u.uf))}</b></span>${linhas.map(([k, rot, alvo]) =>
            `<span role="cell" class="pub-c" data-rot="${E(rot)}"><span class="num">${fmt(u[k])}</span><span class="barra-mini" aria-hidden="true"><i style="width:${Math.min(100, (+u[k] || 0) / alvo * 100)}%"></i></span></span>`).join('')}</div>`).join('')}
        </div>
      </section>
      ${fs.length ? `<section class="secao" aria-labelledby="t-pub-mul"><div class="secao-cab"><div><h2 id="t-pub-mul" class="serif">Mulheres e produção</h2></div></div>
        <div class="pub-fotos n-${fs.length}">${fs.map((f, i) => f.ilustracao
          ? `<figure class="pf-${i ? 'sec' : 'prin'}" role="img" aria-label="Ilustração: ${E(f.legenda)}"><img src="${E(f.url)}" alt="" loading="lazy" decoding="async"><span class="mos-selo">Ilustração</span><figcaption>${E(f.legenda)}</figcaption></figure>`
          : `<button type="button" class="pf-${i ? 'sec' : 'prin'}" data-acao="vit-ampliar" data-i="${i}" aria-label="${E(f.legenda)} · ${E(f.uf)}"><img src="${E(f.url)}" alt="" loading="lazy" decoding="async"><span class="mos-leg">${E(f.legenda)} · ${E(f.uf)}</span></button>`).join('')}</div>
        <p class="small muted">${ilus ? 'Ilustrações. As fotos das mulheres entram aqui quando a coordenação publicar, só de quem autorizou o uso da imagem.' : 'Fotos de mulheres que autorizaram o uso da imagem. Toque para ampliar.'}</p></section>` : ''}
      <section class="secao pub-info" aria-labelledby="t-pub-info">
        <h2 id="t-pub-info" class="serif">Como o projeto anda</h2>
        <ol class="passos" aria-label="Etapas do projeto">${passos.map((p, i) => `<li class="${i + 1 < et.n ? 'feito' : i + 1 === et.n ? 'agora' : ''}"><span>${i + 1}</span>${p}</li>`).join('')}</ol>
        <p class="small">Esta página mostra só totais. Nomes, endereços, CPF e a localização dos quintais ficam no sistema, com acesso só da equipe do projeto (Lei nº 13.709/2018). As fotos são escolhidas pela coordenação entre mulheres que autorizaram o uso de imagem.</p>
      </section>
      <section class="secao pub-parceiros" aria-labelledby="t-pub-parc">
        <h2 id="t-pub-parc" class="serif">Instituições</h2>
        <ul class="parceiros"><li><b>IFRN Campus Apodi</b><span>execução</span></li><li><b>MDA</b><span>recursos (Ministério do Desenvolvimento Agrário e Agricultura Familiar)</span></li><li><b>MPA</b><span>parceria e indicação da equipe</span></li><li><b>FUNCERN</b><span>gestão financeira</span></li></ul>
        <p class="small muted">${quando() ? 'Atualizado em ' + quando() + '.' : ''}</p>
      </section>`;
  }

  /* ---------- coordenação: publicar e retirar fotos ---------- */
  function blocoPublicar(f, dg) {
    const eu = S().eu; if (!eu || !/^coord/.test(eu.papel)) return '';
    const fotos = (dg.fotos || []).filter(x => x === 'exemplo' || /\/diag_(mulher|geral|plantio|agua)/.test(x))
      .sort((a, b) => /diag_mulher/.test(b) - /diag_mulher/.test(a));   // a foto dela vem primeiro
    if (!fotos.length) return '';
    if (!f.consent_imagem) return `<div class="bloco"><h3>Vitrine pública</h3><p class="small muted">Esta mulher não autorizou uso de imagem: as fotos dela não podem ir para a vitrine.</p></div>`;
    const nome = p => p === 'exemplo' ? 'Foto de exemplo' : { mulher: 'Retrato dela', geral: 'Visão geral', plantio: 'Área de plantio', agua: 'Fonte de água' }[(p.match(/diag_(\w+)/) || [])[1]] || 'Foto';
    return `<form class="bloco" data-form="vit-publicar" data-ficha="${E(f.id)}" novalidate><h3>Publicar na vitrine pública</h3>
      <p class="small muted">A foto aparece na tela de entrada e no mosaico da página pública, sem o nome dela. Ela autorizou o uso da imagem. Olhe a foto antes: nada de rosto de criança${f.consent_criancas ? ' (ela autorizou crianças, mas evite)' : ''}, placa, número da casa ou documento.</p>
      <div class="campo"><label>Foto</label><span class="chips-sel">${fotos.map((p, i) => `<label class="sn${i ? '' : ' on'}"><input type="radio" name="origem" value="${E(p)}" ${i ? '' : 'checked'}>${nome(p)}</label>`).join('')}</span></div>
      <div class="campo"><label for="vp-leg">Legenda (sem o nome dela)</label><input id="vp-leg" name="legenda" maxlength="140" placeholder="Ex.: Canteiros de hortaliças no sertão do Piauí"></div>
      ${f.consent_criancas ? '' : '<label class="check"><input type="checkbox" name="sem_criancas"> Conferi: nenhuma criança aparece na foto</label>'}
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn" type="submit">Publicar foto</button></div></form>`;
  }
  function secaoCoord() {
    setTimeout(async () => {
      try { if (S().api.limparVitrinePendente) await S().api.limparVitrinePendente(); V.lista = await S().api.listarVitrine(); } catch (e) { V.lista = V.lista || []; V.erroLista = e.message; }
      const el = $('#vit-coord'); if (el) el.innerHTML = corpoCoord();
    }, 0);
    return `<section class="secao" aria-labelledby="t-vit"><div class="secao-cab"><div><h2 id="t-vit">Vitrine pública</h2>
      <p>Fotos que aparecem na tela de entrada e em <a href="#numeros">O projeto em números</a>. Para publicar, abra um diagnóstico e use "Publicar na vitrine".</p></div></div>
      <div id="vit-coord">${V.lista ? corpoCoord() : '<p class="muted">' + MQ.ampulheta() + '</p>'}</div></section>`;
  }
  function corpoCoord() {
    if (V.erroLista && /vitrine_fotos|PGRST205|does not exist|schema cache/i.test(V.erroLista))
      return '<div class="aviso">A vitrine ainda não foi instalada no servidor: a coordenação geral precisa rodar o arquivo 04_vitrine_e_custos.sql no Supabase.</div>';
    if (!V.lista.length) return '<p class="muted">Nenhuma foto publicada.</p>';
    return `<div class="galeria">${V.lista.map(v => `<figure class="gal-item"><img src="${E(v.url)}" alt="${E(v.legenda)}" loading="lazy">
      <figcaption>${E(v.legenda)} <span>· ${E(v.uf)} · ${R.fmtData(v.publicada_em)}</span>
      <button class="link perigo" data-acao="vit-retirar" data-id="${E(v.id)}" data-path="${E(v.path)}">Retirar</button></figcaption></figure>`).join('')}</div>`;
  }

  /* foto ampliada do mosaico (fecha com Esc, tocando fora ou no ×) */
  function ampliar(i) {
    const fs = (V.dados && V.dados.fotos) || []; const f = fs[i]; if (!f) return;
    let box = document.getElementById('vit-amplia');
    if (!box) { box = document.createElement('div'); box.id = 'vit-amplia'; box.className = 'vit-amplia'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); document.body.appendChild(box);
      box.addEventListener('click', ev => { if (ev.target === box || ev.target.closest('[data-fechar]')) fecharAmplia(); });
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharAmplia(); }); }
    box.innerHTML = `<figure><img src="${E(f.url)}" alt="${E(f.legenda)}"><figcaption>${E(f.legenda)} <span>· ${E(f.uf)}</span></figcaption>
      <button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></figure>`;
    box.hidden = false; const b = box.querySelector('[data-fechar]'); if (b) b.focus();
  }
  function fecharAmplia() { const box = document.getElementById('vit-amplia'); if (box) box.hidden = true; }
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-acao="vit-ampliar"]'); if (b) ampliar(+b.dataset.i); });

  async function clique(a, el) {
    if (a === 'vit-retirar') {
      if (!el.dataset.conf) { el.dataset.conf = '1'; el.textContent = 'Confirmar: retirar'; return; }
      await S().api.retirarFoto(el.dataset.id, el.dataset.path);
      V.lista = (V.lista || []).filter(v => v.id !== el.dataset.id); V.em = 0;
      const box = $('#vit-coord'); if (box) box.innerHTML = corpoCoord();
      U().toast('Foto retirada da vitrine.');
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'vit-publicar') return;
    const leg = String(fd.get('legenda') || '').trim(); const erros = {};
    if (leg.length < 5) erros.legenda = 'Escreva uma legenda (mínimo 5 letras).';
    const cc = form.querySelector('[name=sem_criancas]');
    if (cc && !cc.checked) erros.sem_criancas = 'Confira a foto e marque.';
    if (Object.keys(erros).length) return U().mostrarErros(form, erros);
    await U().ocupado(form, async () => {
      await S().api.publicarFoto({ ficha_id: form.dataset.ficha, origem: String(fd.get('origem')), legenda: leg, sem_criancas: cc ? cc.checked : false });
      V.lista = null; V.em = 0;
      form.outerHTML = '<div class="aviso ok">Foto publicada na vitrine. Para retirar, use a seção Vitrine pública na aba Campo.</div>';
      U().toast('Foto publicada na vitrine.');
    });
  }

  MQ.vitrineUI = { entrada, pagina, blocoPublicar, secaoCoord, clique, enviar, buscar };
})();
