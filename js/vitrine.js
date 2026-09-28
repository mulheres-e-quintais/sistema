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
    t.porUF = k => Object.fromEntries((d.por_uf || []).map(u => [u.uf, +u[k] || 0]));
    t.equipe = (d.equipe || {}).bolsistas + (d.equipe || {}).agentes || 0;
    return t;
  }
  function etapa(t) {
    if (t.acompanhamentos) return { n: 4, nome: 'Acompanhamento dos quintais', txt: 'Quintais implantados recebem visitas técnicas de acompanhamento.' };
    if (t.implantados) return { n: 3, nome: 'Implantação dos quintais', txt: 'Os kits chegam e os quintais são montados com cada mulher.' };
    if (t.diagnosticos) return { n: 2, nome: 'Diagnóstico e plano de cada quintal', txt: 'Na primeira visita, cada mulher monta com a equipe o plano do seu quintal.' };
    return { n: 1, nome: 'Seleção das mulheres', txt: 'As equipes estaduais visitam as comunidades e indicam as mulheres pelos critérios do edital.' };
  }
  function tiles(t) {
    const lista = [
      { v: t.selecionadas, de: 200, l: 'mulheres selecionadas', sempre: true },
      { v: t.diagnosticos, l: 'quintais com diagnóstico e plano' },
      { v: t.implantados, l: 'quintais implantados' },
      { v: t.acompanhamentos, l: 'visitas de acompanhamento' },
      { v: t.equipe, l: 'pessoas na equipe de campo', sempre: true },
      { v: 5, l: 'estados do Nordeste', sempre: true }];
    return lista.filter(x => x.sempre || x.v > 0).slice(0, 4);
  }
  const tile = x => `<div class="vt"><span class="vt-n num">${fmt(x.v)}${x.de ? `<small> de ${x.de}</small>` : ''}</span><span class="vt-l">${E(x.l)}</span></div>`;
  const quando = () => V.em ? new Date(V.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  /* ---------- fotos ---------- */
  function foto(d, i, cls) {
    const fs = d.fotos || []; if (!fs.length) return '';
    const f = fs[((i % fs.length) + fs.length) % fs.length];
    return `<figure class="${cls}"><img src="${E(f.url)}" alt="${E(f.legenda)}" loading="lazy" decoding="async"><figcaption>${E(f.legenda)} <span>· ${E(f.uf)}</span></figcaption></figure>`;
  }
  function girar() {
    clearInterval(V.timer);
    const d = V.dados; if (!d || (d.fotos || []).length < 2) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    V.timer = setInterval(() => {
      const box = $('#vit-foto'); if (!box) { clearInterval(V.timer); return; }
      V.foto++; box.innerHTML = foto(d, V.foto, 'vit-foto');
    }, 7000);
  }

  /* ---------- faixa da tela de entrada ---------- */
  function entrada() {
    setTimeout(async () => { await buscar(); desenharEntrada(); }, 0);
    return `<aside class="vitrine" id="vitrine" aria-labelledby="vit-t">${V.dados ? corpoEntrada(V.dados) : esqueleto()}</aside>`;
  }
  const esqueleto = () => `<span class="eyebrow">O projeto agora</span><h2 id="vit-t" class="serif">Mulheres &amp; Quintais em números</h2>
    <div class="vts">${'<div class="vt esq"><span class="vt-n">&nbsp;</span><span class="vt-l">&nbsp;</span></div>'.repeat(4)}</div>`;
  function corpoEntrada(d) {
    const t = totais(d); const et = etapa(t);
    return `<span class="eyebrow">O projeto agora</span>
      <h2 id="vit-t" class="serif">Mulheres &amp; Quintais em números</h2>
      <p class="vit-etapa"><span class="vit-passo">Etapa ${et.n} de 4</span> ${E(et.nome)}</p>
      <div class="vts">${tiles(t).map(tile).join('')}</div>
      <div class="vit-duo">
        <div class="vit-mapa">${MQ.painelUI.mapaUFs(t.porUF('selecionadas'), 'mulheres selecionadas')}<span class="vit-leg">Mulheres selecionadas por estado</span></div>
        <div id="vit-foto">${foto(d, V.foto, 'vit-foto') || `<div class="vit-sem-foto"><span>As fotos dos quintais aparecem aqui quando a coordenação aprovar, só de quem autorizou.</span></div>`}</div>
      </div>
      <p class="vit-rodape"><a href="#numeros" class="vit-link">Ver o projeto em números →</a><span>Totais sem nomes nem endereços${quando() ? ' · atualizado ' + quando() : ''}</span></p>`;
  }
  function desenharEntrada() {
    const el = $('#vitrine'); if (!el) return;
    if (V.dados) { el.innerHTML = corpoEntrada(V.dados); girar(); }
    else { const m = el.parentElement; el.remove(); if (m) m.classList.remove('entrada'); }   // sem números (servidor sem a etapa 4 ou sem internet): só o login
  }

  /* ---------- página pública "O projeto em números" ---------- */
  function pagina() {
    setTimeout(async () => { await buscar(true); const el = $('#numeros'); if (el) el.innerHTML = V.dados ? corpoPagina(V.dados) : '<div class="login"><h1>Números indisponíveis</h1><p class="muted">Não foi possível carregar os números agora. Tente mais tarde.</p><a class="btn" href="#">Voltar</a></div>'; }, 0);
    return `<main class="wrap publico" id="numeros">${V.dados ? corpoPagina(V.dados) : '<p class="carregando">Carregando os números…</p>'}</main>`;
  }
  function corpoPagina(d) {
    const t = totais(d); const et = etapa(t);
    const linhas = [['selecionadas', 'Selecionadas', 40], ['diagnosticos', 'Diagnósticos', 40], ['implantados', 'Implantados', 40], ['acompanhamentos', 'Acompanhamentos', 80]];
    const passos = ['Seleção', 'Diagnóstico e plano', 'Implantação', 'Acompanhamento'];
    return `<section class="hero-pub">
        <a href="#" class="vit-link voltar">← Entrar no sistema</a>
        <span class="eyebrow">Projeto Quintais Produtivos para Mulheres Rurais · IFRN · MDA</span>
        <h1 class="serif">O projeto em números</h1>
        <p class="lead">200 quintais agroecológicos de mulheres rurais em Alagoas, Bahia, Pernambuco, Piauí e Sergipe, de setembro de 2026 a setembro de 2027. Os números abaixo saem direto dos registros de campo.</p>
        <ol class="passos" aria-label="Etapas do projeto">${passos.map((p, i) => `<li class="${i + 1 < et.n ? 'feito' : i + 1 === et.n ? 'agora' : ''}"><span>${i + 1}</span>${p}</li>`).join('')}</ol>
      </section>
      <div class="vts grande">${[
        { v: t.selecionadas, de: 200, l: 'mulheres selecionadas' }, { v: t.diagnosticos, de: 200, l: 'quintais com diagnóstico' },
        { v: t.implantados, de: 200, l: 'quintais implantados' }, { v: t.acompanhamentos, de: 400, l: 'visitas de acompanhamento' }].map(tile).join('')}</div>
      <section class="secao duas-col perfil-cols">
        <div class="bloco"><h2 class="serif">Por estado</h2><p class="small muted">Meta de 40 quintais em cada estado.</p>
          <div class="pub-tab" role="table">
            <div class="pub-l cab" role="row"><span role="columnheader">Estado</span>${linhas.map(l => `<span role="columnheader">${l[1]}</span>`).join('')}</div>
            ${(d.por_uf || []).map(u => `<div class="pub-l" role="row"><span role="cell"><b>${E(U().nomeUF(u.uf))}</b></span>${linhas.map(([k, rot, alvo]) =>
              `<span role="cell" class="pub-c" data-rot="${E(rot)}"><span class="num">${fmt(u[k])}</span><span class="barra-mini" aria-hidden="true"><i style="width:${Math.min(100, (+u[k] || 0) / alvo * 100)}%"></i></span></span>`).join('')}</div>`).join('')}
          </div></div>
        <div class="bloco"><h2 class="serif">Onde</h2>${MQ.painelUI.mapaUFs(t.porUF('selecionadas'), 'mulheres selecionadas')}
          <p class="small muted">Mulheres selecionadas por estado. O mapa não mostra onde cada uma mora.</p></div>
      </section>
      ${(d.fotos || []).length ? `<section class="secao"><h2 class="serif">Nos quintais</h2><div class="galeria">${d.fotos.map((f, i) => foto(d, i, 'gal-item')).join('')}</div></section>` : ''}
      <section class="secao nota-pub"><h2 class="serif">Como os dados são tratados</h2>
        <p>Esta página mostra só totais por estado. Nomes, endereços, CPF e a localização dos quintais ficam no sistema, com acesso só da equipe do projeto (Lei nº 13.709/2018). As fotos são escolhidas pela coordenação entre mulheres que autorizaram o uso de imagem.</p>
        <p class="small muted">${quando() ? 'Atualizado em ' + quando() + '. ' : ''}Execução: IFRN Campus Apodi, com recursos do Ministério do Desenvolvimento Agrário e Agricultura Familiar (MDA), em parceria com o MPA e a FUNCERN.</p></section>`;
  }

  /* ---------- coordenação: publicar e retirar fotos ---------- */
  function blocoPublicar(f, dg) {
    const eu = S().eu; if (!eu || !/^coord/.test(eu.papel)) return '';
    const fotos = (dg.fotos || []).filter(x => x === 'exemplo' || /\/diag_(geral|plantio|agua)/.test(x));
    if (!fotos.length) return '';
    if (!f.consent_imagem) return `<div class="bloco"><h3>Vitrine pública</h3><p class="small muted">Esta mulher não autorizou uso de imagem: as fotos dela não podem ir para a vitrine.</p></div>`;
    const nome = p => p === 'exemplo' ? 'Foto de exemplo' : { geral: 'Visão geral', plantio: 'Área de plantio', agua: 'Fonte de água' }[(p.match(/diag_(\w+)/) || [])[1]] || 'Foto';
    return `<form class="bloco" data-form="vit-publicar" data-ficha="${E(f.id)}" novalidate><h3>Publicar na vitrine pública</h3>
      <p class="small muted">A foto aparece na tela de entrada e na página pública, sem o nome dela. Olhe a foto antes: nada de rosto de criança${f.consent_criancas ? ' (ela autorizou crianças, mas evite)' : ''}, placa, número da casa ou documento.</p>
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
      <div id="vit-coord">${V.lista ? corpoCoord() : '<p class="muted">Carregando…</p>'}</div></section>`;
  }
  function corpoCoord() {
    if (V.erroLista && /vitrine_fotos|PGRST205|does not exist|schema cache/i.test(V.erroLista))
      return '<div class="aviso">A vitrine ainda não foi instalada no servidor: a coordenação geral precisa rodar o arquivo 04_vitrine_e_custos.sql no Supabase.</div>';
    if (!V.lista.length) return '<p class="muted">Nenhuma foto publicada.</p>';
    return `<div class="galeria">${V.lista.map(v => `<figure class="gal-item"><img src="${E(v.url)}" alt="${E(v.legenda)}" loading="lazy">
      <figcaption>${E(v.legenda)} <span>· ${E(v.uf)} · ${R.fmtData(String(v.publicada_em).slice(0, 10))}</span>
      <button class="link perigo" data-acao="vit-retirar" data-id="${E(v.id)}" data-path="${E(v.path)}">Retirar</button></figcaption></figure>`).join('')}</div>`;
  }

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
