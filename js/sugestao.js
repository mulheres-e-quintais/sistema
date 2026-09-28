/* Mulheres & Quintais — proposta sugerida para o quintal (para a coordenação analisar o diagnóstico).
   Regras simples e explicadas, a partir das respostas do diagnóstico, da localização e do arranjo produtivo local (APL).
   Não lê as fotos e não substitui o olhar técnico: aponta o que conferir. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const $ = s => document.querySelector(s);
  // referência: gotejamento com cobertura do solo no semiárido gasta cerca de 5 litros por m² de canteiro por dia na seca
  const L_M2_DIA = 5;
  const M2_POR_HORA = 15;   // canteiro que uma pessoa cuida com 1 hora por dia (ordem de grandeza)
  const A = { lista: null, carregando: false };
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const fmt = n => Math.round(n).toLocaleString('pt-BR');

  function carregarAPL() {
    if (A.lista || A.carregando || !S().api.listarAPL) return;
    A.carregando = true;
    S().api.listarAPL().then(l => { A.lista = l || []; A.carregando = false; if (S().painel) U().render(); }).catch(() => { A.lista = []; A.carregando = false; A.erro = true; });
  }
  const aplDe = (uf, mun) => (A.lista || []).find(x => x.uf === uf && norm(x.municipio) === norm(mun));

  /* ---------- as regras ---------- */
  function sugerir(dg, f) {
    const d = Object.assign({}, dg, dg.dados || {});
    const fontes = d.fontes_agua || [];
    const produtivas = fontes.filter(x => ['cisterna_producao', 'poco', 'acude', 'rede'].includes(x));
    const itens = [], alertas = [];
    const add = (prio, titulo, por, chave) => itens.push({ prio, titulo, por, chave });
    // água na seca
    let litrosDia = null, areaAgua = null;
    if (d.agua_seca === 'nao') litrosDia = 0;
    else if (produtivas.length && d.capacidade_litros && d.meses_seca) litrosDia = d.capacidade_litros / (d.meses_seca * 30);
    if (litrosDia != null) areaAgua = litrosDia / L_M2_DIA;
    if (!produtivas.length && fontes.includes('cisterna_consumo'))
      alertas.push('Só há cisterna de consumo: essa água é para beber e cozinhar. A horta precisa de outra fonte (cisterna de produção, poço, barreiro ou reúso de água cinza).');
    if (fontes.includes('carro_pipa') && !produtivas.length) alertas.push('Depende de carro-pipa: não dá para garantir irrigação na seca.');
    const areaMao = d.horas_dia ? d.horas_dia * M2_POR_HORA : null;
    const areaTerreno = d.area_m2 ? d.area_m2 * 0.4 : null;
    const limites = [areaAgua, areaMao, areaTerreno].filter(x => x != null);
    const areaHorta = limites.length ? Math.max(0, Math.min(...limites)) : null;
    const limitante = areaHorta == null ? null : areaHorta === areaAgua ? 'água' : areaHorta === areaMao ? 'tempo disponível' : 'tamanho do quintal';

    // horta
    if (areaHorta != null && areaHorta >= 6) add(1, `Horta em canteiros: cerca de ${fmt(Math.min(areaHorta, 60))} m²`,
      `Limitada pelo ${limitante}. ${litrosDia != null ? `A água que dura na seca dá uns ${fmt(litrosDia)} litros por dia.` : ''}`, 'horta');
    else if (areaHorta != null) add(1, 'Horta pequena só no período de chuva, e guardar água antes de ampliar',
      `Na seca, a água não sustenta canteiros (${litrosDia != null ? fmt(litrosDia) + ' L/dia' : 'sem informação de volume'}). Priorizar captação/reúso.`, 'horta-chuva');
    // irrigação e água
    if (produtivas.length && ['nao', 'nao_tem', 'regador', ''].includes(d.irrigacao || ''))
      add(1, 'Kit de gotejamento com caixa d\'água', 'Com regador se gasta mais água e tempo; o gotejamento rende a mesma água em mais canteiro.', 'gotejamento');
    if ((litrosDia != null && litrosDia < 40) || !produtivas.length)
      add(1, 'Reúso de água cinza (filtro tipo bioágua)', 'A água da pia e do banho, filtrada, rega frutíferas e canteiros na seca.', 'reuso');
    if ((d.distancia_m || 0) > 50) alertas.push(`A fonte de água fica a ${d.distancia_m} m do quintal: prever mangueira ou mudar os canteiros para perto da água.`);
    // solo e manejo
    if (!(d.praticas || []).includes('cobertura')) add(1, 'Cobertura do solo (palha, folhas)', 'Segura a umidade e reduz a rega; é a medida mais barata para a seca.', 'cobertura');
    if (!(d.praticas || []).includes('compostagem')) add(2, 'Composteira', 'Transforma resto de comida e esterco em adubo; melhora o solo ' + (d.solo === 'arenoso' ? 'arenoso, que segura pouca água.' : d.solo === 'pedregoso' ? 'pedregoso (usar canteiros elevados).' : 'e diminui compra de adubo.'), 'compostagem');
    if ((d.praticas || []).includes('veneno') || (d.praticas || []).includes('adubo_quimico'))
      alertas.push('Usa veneno ou adubo químico: incluir no plano a transição (caldas e biofertilizantes) e orientação nas visitas.');
    if (!(d.praticas || []).includes('sementes')) add(3, 'Guardar sementes crioulas', 'Reduz a compra de sementes e mantém variedades adaptadas à região.', 'sementes');
    // cerca
    if (d.cercado !== 'sim') add(1, 'Cerca ou tela no quintal', d.cercado === 'em_parte' ? 'O quintal é cercado só em parte: animais soltos podem acabar com os canteiros.' : 'Sem cerca, galinhas e bichos soltos comem o que for plantado.', 'cerca');
    // animais
    const temGalinha = !!(d.producao || {}).galinhas;
    const objetivos = d.objetivos || [];
    if (objetivos.includes('animais') || temGalinha) add(2, 'Galinheiro para 10 a 15 aves', temGalinha ? 'Já cria galinhas: melhorar o abrigo aumenta os ovos e protege a horta.' : 'Objetivo de criação: ovos para a casa e venda do excedente.', 'galinhas');
    // frutíferas
    if (litrosDia != null && litrosDia >= 40) add(2, 'Frutíferas (acerola, goiaba, mamão) perto da água', 'Há água para frutíferas que pedem rega.', 'frutiferas');
    else add(2, 'Frutíferas resistentes à seca (umbu, caju, pinha)', 'Pouca água na seca: plantas nativas ou adaptadas.', 'frutiferas-seca');
    if (objetivos.includes('medicinais')) add(3, 'Canteiro de plantas medicinais', 'Objetivo marcado no diagnóstico; ocupa pouca área e pouca água.', 'medicinais');
    // venda
    const vende = objetivos.includes('venda') || (d.renda_quintal || 0) > 0;
    if (vende) {
      const org = (d.participa || []).length;
      add(2, 'Plano de venda do excedente', org ? 'Participa de organização: caminho para feira, PAA ou PNAE em grupo.' : 'Não participa de grupo: aproximar de associação ou feira para vender com regularidade.', 'venda');
    }
    const n = (d.familia || []).length;
    if (n >= 5 && areaHorta != null && areaHorta < 15) alertas.push(`Família com ${n} pessoas e pouca área de horta possível: priorizar alimentação da casa antes da venda.`);
    return { d, litrosDia, areaAgua, areaHorta, limitante, itens: itens.sort((a, b) => a.prio - b.prio), alertas };
  }

  // compara com o kit e o plano que a equipe escreveu
  function divergencias(r) {
    const kit = (r.d.kit || []).map(x => norm(x.item + ' ' + (x.para || ''))).join(' | ');
    const tem = re => re.test(kit);
    const out = [];
    const chaves = new Set(r.itens.map(i => i.chave));
    if (chaves.has('gotejamento') && !tem(/gotej/)) out.push('A sugestão indica gotejamento, e o kit escolhido não tem.');
    if (!chaves.has('gotejamento') && tem(/gotej/) && r.litrosDia === 0) out.push('O kit tem gotejamento, mas a água não dura na seca.');
    if (chaves.has('cerca') && !tem(/cerca|tela/)) out.push('O quintal não é todo cercado, e o kit não tem cerca ou tela.');
    if (tem(/galinh|galinheiro/) && !chaves.has('galinhas')) out.push('O kit tem itens para galinhas, mas o diagnóstico não marca criação como objetivo.');
    if (tem(/caixa/) && r.litrosDia != null && r.litrosDia < 20) out.push('O kit tem caixa d\'água, mas há pouca água para enchê-la na seca: confirmar de onde vem a água.');
    if (!tem(/semente|muda/)) out.push('O kit não tem sementes nem mudas.');
    return out;
  }

  /* ---------- o cartão ---------- */
  function bloco(f, dg) {
    const eu = S().eu; if (!eu || !/^coord/.test(eu.papel) || !dg || dg.sem_agua) return '';
    carregarAPL();
    const r = sugerir(dg, f); const div = divergencias(r); const apl = aplDe(f.uf, f.municipio);
    const prio = { 1: ['crit', 'Essencial'], 2: ['pend', 'Recomendado'], 3: ['off', 'Se couber'] };
    const loc = dg.latitude != null ? `GPS ${(+dg.latitude).toFixed(4)}, ${(+dg.longitude).toFixed(4)}` : 'sem GPS';
    return `<section class="bloco sug" aria-labelledby="t-sug">
      <div class="sug-cab"><div><span class="eyebrow">Para a análise da coordenação</span><h3 id="t-sug">Proposta sugerida para o quintal</h3></div></div>
      <p class="small muted">Sugestão automática a partir das respostas do diagnóstico, da localização (${E(f.municipio)}/${E(f.uf)}, ${loc}) e do arranjo produtivo local. As fotos não entram no cálculo: confira-as antes de aprovar. Não substitui o olhar técnico.</p>
      <div class="sug-agua">
        <div><span class="v num">${r.litrosDia == null ? '—' : fmt(r.litrosDia) + ' L'}</span><span class="l">de água por dia na seca</span></div>
        <div><span class="v num">${r.areaHorta == null ? '—' : fmt(Math.min(r.areaHorta, 60)) + ' m²'}</span><span class="l">de canteiro possível${r.limitante ? ' · limite: ' + r.limitante : ''}</span></div>
        <div><span class="v num">${r.d.area_m2 ? fmt(r.d.area_m2) + ' m²' : '—'}</span><span class="l">área do quintal</span></div></div>
      ${r.alertas.length ? `<ul class="sug-alertas">${r.alertas.map(a => `<li>${E(a)}</li>`).join('')}</ul>` : ''}
      <h4>O que o sistema sugere</h4>
      <ul class="sug-itens">${r.itens.map(i => `<li><span class="chip ${prio[i.prio][0]}">${prio[i.prio][1]}</span><div><b>${E(i.titulo)}</b><span class="small muted">${E(i.por)}</span></div></li>`).join('')}</ul>
      <h4>Arranjo produtivo local · ${E(f.municipio)}</h4>
      ${A.lista == null ? '<p class="small muted">Carregando…</p>' : apl && apl.apls.length
        ? `<p><span class="chips-sel">${apl.apls.map(x => `<span class="chip off">${E(x)}</span>`).join(' ')}</span></p>${apl.obs ? `<p class="small">${E(apl.obs)}</p>` : ''}
           <p class="small muted">Prefira no plano o que tem comprador ou apoio no município. <button class="link" data-acao="apl-editar" data-uf="${E(f.uf)}" data-mun="${E(f.municipio)}">Alterar</button></p>`
        : `<p class="small muted">Nenhum APL cadastrado para este município. ${A.erro ? 'O cadastro de APL ainda não foi instalado no servidor (arquivo 10_apl.sql).' : `<button class="link" data-acao="apl-editar" data-uf="${E(f.uf)}" data-mun="${E(f.municipio)}">Cadastrar o que existe aqui</button> (ex.: apicultura, caprinocultura, feira agroecológica, PAA/PNAE).`}</p>`}
      <div id="apl-form"></div>
      <h4>Comparação com o plano da equipe</h4>
      ${div.length ? `<ul class="sug-div">${div.map(x => `<li>${E(x)}</li>`).join('')}</ul>` : '<p class="small">Nada destoa entre a sugestão e o kit escolhido.</p>'}
    </section>`;
  }

  async function clique(a, el) {
    if (a === 'apl-editar') {
      const x = aplDe(el.dataset.uf, el.dataset.mun) || { apls: [], obs: '' };
      const box = $('#apl-form'); if (!box) return;
      box.innerHTML = `<form class="f" data-form="apl" data-uf="${E(el.dataset.uf)}" data-mun="${E(el.dataset.mun)}" novalidate>
        <div class="campo"><label for="apl-l">Arranjos produtivos de ${E(el.dataset.mun)} (separe por vírgula)</label><input id="apl-l" name="apls" value="${E(x.apls.join(', '))}" placeholder="apicultura, caprinocultura, feira agroecológica"></div>
        <div class="campo"><label for="apl-o">Compradores, feiras, cooperativas, PAA/PNAE</label><textarea id="apl-o" name="obs">${E(x.obs || '')}</textarea></div>
        <div class="aviso erro" data-erro hidden></div><div class="acoes"><button class="btn pri" type="submit">Salvar APL</button></div></form>`;
      box.querySelector('input').focus();
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'apl') return;
    const apls = String(fd.get('apls') || '').split(',').map(x => x.trim()).filter(Boolean);
    await U().ocupado(form, async () => {
      await S().api.salvarAPL(form.dataset.uf, form.dataset.mun, apls, String(fd.get('obs') || '').trim() || null);
      A.lista = null; carregarAPL(); U().toast('Arranjo produtivo salvo para ' + form.dataset.mun + '.');
    });
  }

  MQ.sugestaoUI = { bloco, sugerir, clique, enviar };
})();
