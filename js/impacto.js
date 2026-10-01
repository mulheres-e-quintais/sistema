/* Mulheres & Quintais — medida de impacto: as mesmas perguntas no diagnóstico (linha de base)
   e na visita de avaliação (5ª visita), para comparar antes × depois.
   EBIA: Escala Brasileira de Insegurança Alimentar (14 perguntas de sim/não, últimos 3 meses;
   cortes do Estudo Técnico MDS 01/2014). Texto das perguntas como na PNAD: conferir antes de aplicar. */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);

  MQ.EBIA = [
    'Os moradores tiveram a preocupação de que a comida acabasse antes que tivessem dinheiro para comprar mais?',
    'A comida acabou antes que os moradores tivessem dinheiro para comprar mais?',
    'Os moradores ficaram sem dinheiro para ter uma alimentação saudável e variada?',
    'Os moradores comeram apenas alguns poucos tipos de alimentos que ainda tinham, porque o dinheiro acabou?',
    'Algum morador de 18 anos ou mais deixou de fazer alguma refeição porque não havia dinheiro para comprar comida?',
    'Algum morador de 18 anos ou mais comeu menos do que achou que devia porque não havia dinheiro para comprar comida?',
    'Algum morador de 18 anos ou mais sentiu fome, mas não comeu, porque não havia dinheiro para comprar comida?',
    'Algum morador de 18 anos ou mais ficou um dia inteiro sem comer ou teve apenas uma refeição ao dia, porque não havia dinheiro para comprar comida?',
    'Os moradores com menos de 18 anos não puderam ter uma alimentação saudável e variada porque não havia dinheiro para comprar comida?',
    'Os moradores com menos de 18 anos não comeram quantidade suficiente de comida porque não havia dinheiro para comprar comida?',
    'Foi diminuída a quantidade de alimentos das refeições de algum morador com menos de 18 anos, porque não havia dinheiro para comprar comida?',
    'Algum morador com menos de 18 anos deixou de fazer alguma refeição porque não havia dinheiro para comprar comida?',
    'Algum morador com menos de 18 anos sentiu fome, mas não comeu, porque não havia dinheiro para comprar comida?',
    'Algum morador com menos de 18 anos ficou um dia inteiro sem comer ou teve apenas uma refeição ao dia, porque não havia dinheiro para comprar comida?'
  ];
  const NIVEL = { seguranca: 'Segurança alimentar', leve: 'Insegurança leve', moderada: 'Insegurança moderada', grave: 'Insegurança grave' };
  MQ.EBIA_NIVEL = NIVEL;
  // cortes MDS (2014): com menores de 18 (14 itens) 0 | 1–5 | 6–9 | 10–14; sem menores (8 itens) 0 | 1–3 | 4–5 | 6–8
  const classificar = (pontos, menor) => pontos == null ? null : pontos === 0 ? 'seguranca'
    : menor ? (pontos <= 5 ? 'leve' : pontos <= 9 ? 'moderada' : 'grave') : (pontos <= 3 ? 'leve' : pontos <= 5 ? 'moderada' : 'grave');
  const ONDE = [['feira', 'Feira'], ['comunidade', 'Vizinhança / comunidade'], ['paa', 'PAA'], ['pnae', 'PNAE (escola)'], ['atravessador', 'Atravessador'], ['outro', 'Outro']];
  const DECIDE = [['ela', 'Ela mesma'], ['ela_e_outro', 'Ela junto com outra pessoa'], ['outra', 'Outra pessoa'], ['nao_vende', 'Não vende']];
  const ENCAMINHA = [['cisterna', 'Cisterna'], ['caf', 'CAF emitida'], ['paa', 'Venda ao PAA'], ['pnae', 'Venda ao PNAE'], ['feira', 'Espaço em feira'], ['credito', 'Crédito (Pronaf)'], ['ater', 'Assistência técnica']];

  const rad = (nome, ops, val) => `<span class="sn-par" style="flex-wrap:wrap">${ops.map(([k, t]) => `<label class="sn${val === k ? ' on' : ''}"><input type="radio" name="${nome}" value="${k}" ${val === k ? 'checked' : ''}>${E(t)}</label>`).join('')}</span>`;
  const chk = (nome, ops, marc) => `<div class="chips-sel">${ops.map(([k, t]) => `<label class="sn${(marc || []).includes(k) ? ' on' : ''}"><input type="checkbox" name="${nome}" value="${k}" ${(marc || []).includes(k) ? 'checked' : ''}>${E(t)}</label>`).join('')}</div>`;

  /* ---------- bloco de perguntas (diagnóstico e avaliação) ---------- */
  function bloco(im, titulo, menorPadrao) {
    im = im || {}; const menor = im.menor != null ? im.menor : menorPadrao;
    const sn = (i, val) => rad('ebia_' + i, [['s', 'Sim'], ['n', 'Não']], val === true ? 's' : val === false ? 'n' : '');
    return `<fieldset class="impacto"><legend>${E(titulo)}</legend>
      <p class="small muted" style="margin-top:-6px">As mesmas perguntas são feitas no diagnóstico e na visita de avaliação: é assim que o projeto mostra o que mudou. Leia as perguntas como estão escritas.</p>
      <div class="campo" id="w-im_menor"><label>Mora alguém com menos de 18 anos na casa?</label>${rad('im_menor', [['s', 'Sim'], ['n', 'Não']], menor === true ? 's' : menor === false ? 'n' : '')}</div>
      <div id="w-ebia" class="ebia"><p class="small"><b>Nos últimos 3 meses…</b></p>
        ${MQ.EBIA.map((q, i) => `<div class="criterio" data-ebia="${i}" ${i >= 8 && menor !== true ? 'hidden' : ''}><span><b class="num">${i + 1}.</b> ${E(q)}</span>${sn(i, (im.ebia || [])[i])}</div>`).join('')}</div>
      <div class="campos">
        <div class="campo"><label for="im-dias">Nos últimos 7 dias, em quantos dias a família comeu algo produzido no quintal?</label><input id="im-dias" name="im_dias" type="number" min="0" max="7" inputmode="numeric" value="${E(im.dias_consumo ?? '')}"></div>
        <div class="campo"><label for="im-esp">Quantos tipos de planta de comer o quintal tem hoje?</label><input id="im-esp" name="im_especies" type="number" min="0" max="200" inputmode="numeric" value="${E(im.especies ?? '')}"><span class="dica">Hortaliças, frutas, temperos, raízes, grãos. Conte cada tipo uma vez.</span></div>
        <div class="campo"><label for="im-cri">Quantos tipos de criação?</label><input id="im-cri" name="im_criacoes" type="number" min="0" max="30" inputmode="numeric" value="${E(im.criacoes ?? '')}"><span class="dica">Galinha, porco, cabra, abelha…</span></div>
        <div class="campo inteiro" id="w-im_vende"><label>Vende ou troca o que produz no quintal?</label>${rad('im_vende', [['s', 'Sim'], ['n', 'Não']], im.vende === true ? 's' : im.vende === false ? 'n' : '')}</div>
        <div class="campo inteiro"><label>Onde vende</label>${chk('im_onde', ONDE, im.onde_vende)}</div>
        <div class="campo inteiro" id="w-im_decide"><label>Quem decide o que fazer com o dinheiro da venda do quintal?</label>${rad('im_decide', DECIDE, im.decide)}</div>
        <div class="campo inteiro" id="w-im_caf"><label>Tem CAF (antiga DAP)?</label>${rad('im_caf', [['s', 'Sim'], ['n', 'Não'], ['ns', 'Não sabe']], im.caf)}</div>
      </div></fieldset>`;
  }
  function ler(form) {
    const fd = new FormData(form);
    const g = k => fd.get(k); const num = k => { const x = String(g(k) || '').trim(); return x === '' ? null : Number(x); };
    const menor = g('im_menor') === 's' ? true : g('im_menor') === 'n' ? false : null;
    const n = menor ? 14 : 8;
    const ebia = MQ.EBIA.map((_, i) => i >= n ? null : g('ebia_' + i) === 's' ? true : g('ebia_' + i) === 'n' ? false : null);
    const respondidas = ebia.slice(0, n).filter(x => x != null).length;
    const pontos = menor == null || respondidas < n ? null : ebia.slice(0, n).filter(Boolean).length;
    const vende = g('im_vende') === 's' ? true : g('im_vende') === 'n' ? false : null;
    return { menor, ebia, ebia_pontos: pontos, ebia_nivel: classificar(pontos, menor), dias_consumo: num('im_dias'), especies: num('im_especies'), criacoes: num('im_criacoes'),
      vende, onde_vende: vende ? fd.getAll('im_onde') : [], decide: g('im_decide') || null, caf: g('im_caf') || null };
  }
  function validar(im) {
    const e = {};
    if (im.menor == null) e.im_menor = 'Responda se mora alguém com menos de 18 anos.';
    else if (im.ebia_pontos == null) e.ebia = 'Responda todas as perguntas de alimentação (sim ou não).';
    if (im.dias_consumo == null || im.dias_consumo < 0 || im.dias_consumo > 7) e.im_dias = 'De 0 a 7 dias.';
    if (im.especies == null || im.especies < 0) e.im_especies = 'Informe quantos tipos (0 se nenhum).';
    if (im.criacoes == null || im.criacoes < 0) e.im_criacoes = 'Informe quantos tipos (0 se nenhum).';
    if (im.vende == null) e.im_vende = 'Responda se vende ou troca.';
    if (!im.decide) e.im_decide = 'Escolha quem decide.';
    if (!im.caf) e.im_caf = 'Responda sobre a CAF.';
    return e;
  }
  // reatividade: mostrar as perguntas de menores só quando há menores; marcar botões
  document.addEventListener('change', ev => {
    const t = ev.target; const f = t.closest && t.closest('form'); if (!f || !f.querySelector('fieldset.impacto')) return;
    if (t.name === 'im_menor') f.querySelectorAll('[data-ebia]').forEach(x => { if (+x.dataset.ebia >= 8) x.hidden = t.value !== 's'; });
    if (t.type === 'radio' || t.type === 'checkbox') { const par = t.closest('.sn-par, .chips-sel'); if (par) par.querySelectorAll('.sn').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); }
  });
  const menorDaFamilia = fam => (fam || []).some(x => x.idade != null && +x.idade < 18) ? true : (fam || []).length ? null : null;

  /* ---------- visita de avaliação ---------- */
  const avaliacoes = () => S().avaliacoes || [];
  const fotosAv = {};
  function painelForm(p) {
    const f = (S().fichas || []).find(x => x.id === p.ficha); if (!f) return '<div class="painel-corpo"><p>Ficha não encontrada.</p></div>';
    const atual = avaliacoes().find(a => a.ficha_id === f.id);
    const dg = (S().diagnosticos || []).find(x => x.ficha_id === f.id);
    const base = dg && dg.dados && dg.dados.impacto;
    const a = atual ? Object.assign({}, atual, atual.dados || {}) : { id: MQ.novoId(), data_visita: R.hoje(), latitude: dg ? dg.latitude : null, longitude: dg ? dg.longitude : null };
    const v = k => E(a[k] == null ? '' : a[k]);
    const foto = (k, t) => `<div class="campo"><label for="av-f-${k}">${t}${k === 'geral' ? ' *' : ''}</label><input id="av-f-${k}" type="file" accept="image/*" capture="environment" data-foto-av="${k}"><span class="dica" id="av-f-${k}-dica">${(a.fotos || []).some(x => new RegExp('aval_' + k).test(x)) ? 'Já tem foto. Envie outra só para trocar.' : k === 'geral' ? 'Obrigatória.' : ''}</span></div>`;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Avaliação final · ${E(f.uf)}</span><h2 id="painel-t">${E(f.nome)}</h2><span class="small">${E(f.municipio)} · ${E(f.comunidade || '')}</span></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="aval" data-id="${E(a.id)}" data-ficha="${E(f.id)}" data-visita="${E(p.visita || a.visita_id || '')}" novalidate>
        ${base ? '' : '<div class="aviso">Este quintal não tem as medidas de linha de base no diagnóstico (feito antes desta pergunta existir): a avaliação vale, mas não entra na comparação antes × depois.</div>'}
        <fieldset><legend>Visita</legend><div class="campos">
          <div class="campo"><label for="av-data">Data da visita</label><input id="av-data" name="data_visita" type="date" value="${v('data_visita')}" max="${R.hoje()}"></div>
          <div class="campo"><label>Localização</label><button type="button" class="btn peq" data-acao="aval-gps">${a.latitude ? 'Localização registrada ✓' : 'Registrar localização'}</button>
            <input type="hidden" name="latitude" value="${v('latitude')}"><input type="hidden" name="longitude" value="${v('longitude')}"><span class="dica" id="av-gps-dica">${a.latitude ? E(a.latitude + ', ' + a.longitude) : 'Registre em pé, no quintal.'}</span></div>
          <div class="campo inteiro"><label for="av-semgps">Sem localização? Explique</label><input id="av-semgps" name="sem_gps_motivo" value="${v('sem_gps_motivo')}"></div>
        </div></fieldset>
        <fieldset><legend>O quintal hoje</legend><div class="campos">
          <div class="campo inteiro" id="w-quintal_produz"><label>O quintal está produzindo?</label>${rad('quintal_produz', [['sim', 'Sim'], ['em_parte', 'Em parte'], ['nao', 'Não']], a.quintal_produz)}</div>
          <div class="campo inteiro"><label for="av-mot">Se não ou em parte: por quê?</label><input id="av-mot" name="motivo" value="${v('motivo')}" placeholder="Ex.: faltou água em setembro; a tela estragou; ela adoeceu"></div>
          <div class="campo"><label for="av-rq">Quanto ganha com vendas do quintal por mês (R$)</label><input id="av-rq" name="renda_quintal" type="number" min="0" step="10" inputmode="numeric" value="${v('renda_quintal')}"><span class="dica">A mesma pergunta do diagnóstico. Zero se não vende.</span></div>
          <div class="campo"><label for="av-h">Horas por dia no quintal</label><input id="av-h" name="horas_dia" type="number" min="0" max="16" step="0.5" inputmode="decimal" value="${v('horas_dia')}"></div>
          <div class="campo inteiro" id="w-agua"><label>A água deu para o quintal no último período seco?</label>${rad('agua', [['sim', 'Sim'], ['as_vezes', 'Às vezes'], ['nao', 'Não']], a.agua)}</div>
          <div class="campo inteiro" id="w-alimentacao"><label>Com o quintal, a alimentação da família…</label>${rad('alimentacao', [['melhorou', 'Melhorou'], ['igual', 'Ficou igual'], ['piorou', 'Piorou']], a.alimentacao)}</div>
          <div class="campo inteiro"><label>Durante o projeto, ela conseguiu</label>${chk('encaminhamentos', ENCAMINHA, a.encaminhamentos)}</div>
        </div></fieldset>
        ${bloco(a.impacto, 'Medidas de impacto (as mesmas do diagnóstico)', base ? base.menor : null)}
        <fieldset id="w-fotos_av"><legend>Fotos</legend><div class="campos">${foto('geral', 'Visão geral do quintal')}${foto('producao', 'Produção')}${foto('agua', 'Água / irrigação')}</div></fieldset>
        <div class="campo"><label for="av-obs">O que ela diz do quintal (em poucas palavras)</label><textarea id="av-obs" name="fala" placeholder="Registre com as palavras dela.">${v('fala')}</textarea></div>
        <input type="hidden" name="fotos_existentes" value="${E((a.fotos || []).join('|'))}">
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
      </form></div>`;
  }
  document.addEventListener('change', async ev => {
    const inp = ev.target.closest && ev.target.closest('input[data-foto-av]'); if (!inp || !inp.files[0]) return;
    const k = inp.dataset.fotoAv; const dica = document.getElementById('av-f-' + k + '-dica');
    if (inp.files[0].size > 15 * 1024 * 1024) { dica.textContent = 'Arquivo muito grande (máx. 15 MB).'; inp.value = ''; return; }
    dica.textContent = 'Preparando foto…'; fotosAv[k] = await MQ.comprimirFoto(inp.files[0]); dica.textContent = 'Foto pronta (' + Math.round(fotosAv[k].size / 1024) + ' KB).';
  });

  /* ---------- antes × depois ---------- */
  function pares(uf) {
    return avaliacoes().filter(a => !uf || a.uf === uf).map(a => {
      const dg = (S().diagnosticos || []).find(x => x.ficha_id === a.ficha_id);
      const antes = dg && dg.dados && dg.dados.impacto; const depois = a.dados && a.dados.impacto;
      return antes && depois && antes.ebia_nivel && depois.ebia_nivel ? { a, dg, antes, depois } : null;
    }).filter(Boolean);
  }
  const media = l => l.length ? l.reduce((s, x) => s + x, 0) / l.length : null;
  const pct = (l, fn) => l.length ? Math.round(l.filter(fn).length / l.length * 100) : null;
  const fmt = (x, d = 1) => x == null ? '—' : (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('pt-BR');
  function indicadores(uf) {
    const ps = pares(uf);
    const ins = x => x.ebia_nivel && x.ebia_nivel !== 'seguranca', mg = x => ['moderada', 'grave'].includes(x.ebia_nivel);
    const rq = (lado, p) => lado === 'antes' ? (p.dg.renda_quintal != null ? +p.dg.renda_quintal : null) : (p.a.dados && p.a.dados.renda_quintal != null ? +p.a.dados.renda_quintal : null);
    const linhas = [
      ['Famílias em insegurança alimentar', pct(ps.map(p => p.antes), ins), pct(ps.map(p => p.depois), ins), '%', 'menos'],
      ['Insegurança moderada ou grave (fome)', pct(ps.map(p => p.antes), mg), pct(ps.map(p => p.depois), mg), '%', 'menos'],
      ['Dias por semana comendo do quintal', media(ps.map(p => p.antes.dias_consumo).filter(x => x != null)), media(ps.map(p => p.depois.dias_consumo).filter(x => x != null)), ' dias', 'mais'],
      ['Tipos de plantas de comer no quintal', media(ps.map(p => p.antes.especies).filter(x => x != null)), media(ps.map(p => p.depois.especies).filter(x => x != null)), '', 'mais'],
      ['Vendas do quintal por mês (média)', media(ps.map(p => rq('antes', p)).filter(x => x != null)), media(ps.map(p => rq('depois', p)).filter(x => x != null)), 'R$', 'mais'],
      ['Mulheres que vendem ou trocam', pct(ps.map(p => p.antes), x => x.vende), pct(ps.map(p => p.depois), x => x.vende), '%', 'mais'],
      ['Ela decide sobre o dinheiro da venda (sozinha ou junto)', pct(ps.map(p => p.antes), x => ['ela', 'ela_e_outro'].includes(x.decide)), pct(ps.map(p => p.depois), x => ['ela', 'ela_e_outro'].includes(x.decide)), '%', 'mais'],
      ['Com CAF', pct(ps.map(p => p.antes), x => x.caf === 's'), pct(ps.map(p => p.depois), x => x.caf === 's'), '%', 'mais']
    ];
    const av = avaliacoes().filter(a => !uf || a.uf === uf);
    return { n: ps.length, total: av.length, linhas, produzindo: pct(av, a => a.quintal_produz === 'sim'), emParte: pct(av, a => a.quintal_produz === 'em_parte'), melhorou: pct(av, a => a.dados && a.dados.alimentacao === 'melhorou') };
  }
  function secaoCoord() {
    if (S().avalSemBanco) return '';
    const uf = G.uf || ''; const r = indicadores(uf);
    const val = (x, u) => x == null ? '—' : u === 'R$' ? R.fmtBRL(x).replace(',00', '') : fmt(x) + u;
    const seta = (a, d, bom) => a == null || d == null || Math.abs(d - a) < 0.05 ? '<span class="muted">=</span>' : ((d > a) === (bom === 'mais') ? `<span class="imp-bom">${d > a ? '▲' : '▼'}</span>` : `<span class="imp-ruim">${d > a ? '▲' : '▼'}</span>`);
    return `<section class="secao" aria-labelledby="t-imp"><div class="secao-cab"><div><h2 id="t-imp">Impacto: antes × depois</h2>
        <p>Mesmas perguntas no diagnóstico e na avaliação final (5ª visita). Só entram os quintais com as duas medidas.</p></div>
        <span class="seg">${['', ...MQ.UFS.map(u => u.uf)].map(u => `<button type="button" data-acao="imp-uf" data-uf="${u}" aria-pressed="${uf === u}">${u || 'Todos'}</button>`).join('')}</span></div>
      ${r.total ? `<div class="resumo">
        <div><span class="v num">${r.total}</span><span class="l">avaliações feitas${r.n < r.total ? ` · ${r.n} com linha de base` : ''}</span></div>
        <div><span class="v num">${r.produzindo == null ? '—' : r.produzindo + '%'}</span><span class="l">quintais produzindo${r.emParte ? ` (+${r.emParte}% em parte)` : ''}</span></div>
        <div><span class="v num">${r.melhorou == null ? '—' : r.melhorou + '%'}</span><span class="l">dizem que a alimentação melhorou</span></div></div>
        ${r.n ? `<div class="quadro-scroll" style="display:block"><table class="quadro tab-imp"><thead><tr><th>Indicador</th><th>Antes</th><th>Depois</th><th></th></tr></thead><tbody>
          ${r.linhas.map(([t, a, d, u, bom]) => `<tr><td>${E(t)}</td><td class="num">${val(a, u)}</td><td class="num"><b>${val(d, u)}</b></td><td>${seta(a, d, bom)}</td></tr>`).join('')}</tbody></table></div>
          <p class="small muted">${r.n} quint${r.n === 1 ? 'al' : 'ais'} com as duas medidas. Com poucos casos, a diferença pode ser acaso: leia junto com os relatos. Insegurança alimentar pela EBIA (MDS, 2014).</p>` : '<p class="muted">Ainda não há quintal com diagnóstico e avaliação medidos do mesmo jeito.</p>'}`
        : '<div class="vazio"><span>As avaliações começam depois das implantações. Agende a visita de avaliação no roteiro (etapa "Avaliação final").</span></div>'}
    </section>`;
  }
  const G = { uf: '' };

  function painelVer(p) {
    const a = avaliacoes().find(x => x.ficha_id === p.ficha); const f = (S().fichas || []).find(x => x.id === p.ficha);
    if (!a || !f) return '<div class="painel-corpo"><p>Avaliação não encontrada.</p></div>';
    const d = a.dados || {}; const dg = (S().diagnosticos || []).find(x => x.ficha_id === f.id); const b = dg && dg.dados && dg.dados.impacto; const im = d.impacto || {};
    const lin = (t, x, y) => `<tr><td>${E(t)}</td><td>${E(x ?? '—')}</td><td><b>${E(y ?? '—')}</b></td></tr>`;
    const eu = S().eu; const pode = (R.ehBolsista(eu.papel) && eu.uf === a.uf) || a.executor_id === eu.id;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Avaliação final · ${E(f.uf)}</span><h2 id="painel-t">${E(f.nome)}</h2>
        <span class="small">${R.fmtData(a.data_visita)} · quintal ${({ sim: 'produzindo', em_parte: 'produzindo em parte', nao: 'sem produzir' })[a.quintal_produz]}</span></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        ${pode ? `<div class="acoes"><button class="btn" data-acao="aval-novo" data-ficha="${E(f.id)}">Corrigir</button></div>` : ''}
        <div class="bloco"><h3>Antes × depois</h3><table class="tab-uf"><thead><tr><th>Medida</th><th>Diagnóstico</th><th>Avaliação</th></tr></thead><tbody>
          ${lin('Alimentação (EBIA)', b && NIVEL[b.ebia_nivel], NIVEL[im.ebia_nivel])}
          ${lin('Dias por semana comendo do quintal', b && b.dias_consumo, im.dias_consumo)}
          ${lin('Tipos de plantas de comer', b && b.especies, im.especies)}
          ${lin('Tipos de criação', b && b.criacoes, im.criacoes)}
          ${lin('Vendas do quintal por mês', dg && dg.renda_quintal != null ? R.fmtBRL(+dg.renda_quintal) : null, d.renda_quintal != null ? R.fmtBRL(+d.renda_quintal) : null)}
          ${lin('Vende ou troca', b ? (b.vende ? 'Sim' : 'Não') : null, im.vende == null ? null : im.vende ? 'Sim' : 'Não')}
          ${lin('Quem decide o dinheiro', b && (DECIDE.find(x => x[0] === b.decide) || [])[1], (DECIDE.find(x => x[0] === im.decide) || [])[1])}
          ${lin('CAF', b && ({ s: 'Sim', n: 'Não', ns: 'Não sabe' })[b.caf], ({ s: 'Sim', n: 'Não', ns: 'Não sabe' })[im.caf])}
        </tbody></table>${b ? '' : '<p class="small muted">Sem linha de base no diagnóstico.</p>'}</div>
        <div class="bloco"><h3>Na avaliação</h3><dl class="dl">
          <dt>Alimentação da família</dt><dd>${E(({ melhorou: 'Melhorou', igual: 'Ficou igual', piorou: 'Piorou' })[d.alimentacao] || '—')}</dd>
          <dt>Água na seca</dt><dd>${E(({ sim: 'Deu', as_vezes: 'Às vezes', nao: 'Não deu' })[d.agua] || '—')}</dd>
          ${d.motivo ? `<dt>Por que não produz</dt><dd>${E(d.motivo)}</dd>` : ''}
          <dt>Conseguiu</dt><dd>${E((d.encaminhamentos || []).map(k => (ENCAMINHA.find(x => x[0] === k) || [0, k])[1]).join(', ') || '—')}</dd>
          ${d.fala ? `<dt>O que ela diz</dt><dd>“${E(d.fala)}”</dd>` : ''}</dl></div>
        <div class="bloco"><h3>Fotos</h3><div class="acoes">${(a.fotos || []).map((x, i) => `<button class="btn peq" data-acao="ficha-foto" data-path="${E(x)}">Foto ${i + 1}</button>`).join('') || '<span class="muted small">Sem fotos.</span>'}</div><div id="fi-foto-vista"></div></div>
      </div>`;
  }

  async function clique(a, el) {
    if (a === 'imp-uf') { G.uf = el.dataset.uf; U().render(); return; }
    if (a === 'aval-novo') { Object.keys(fotosAv).forEach(k => delete fotosAv[k]); U().abrirPainel({ tipo: 'aval-form', ficha: el.dataset.ficha, visita: el.dataset.visita }); return; }
    if (a === 'aval-ver') { U().abrirPainel({ tipo: 'aval-ver', ficha: el.dataset.ficha }); return; }
    if (a === 'aval-gps') {
      const dica = document.getElementById('av-gps-dica'); const fm = document.querySelector('form[data-form=aval]');
      if (!navigator.geolocation) { dica.textContent = 'Este aparelho não informa a localização. Explique no campo abaixo.'; return; }
      dica.textContent = 'Buscando localização…';
      navigator.geolocation.getCurrentPosition(pos => { fm.latitude.value = pos.coords.latitude.toFixed(6); fm.longitude.value = pos.coords.longitude.toFixed(6);
        dica.textContent = fm.latitude.value + ', ' + fm.longitude.value; el.textContent = 'Localização registrada ✓'; },
      err => { dica.textContent = MQ.dicaGPS(err, 'Se não der, explique no campo abaixo.'); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'aval') return;
    const txt = k => { const x = String(fd.get(k) || '').trim(); return x || null; }; const num = k => { const x = String(fd.get(k) || '').trim(); return x === '' ? null : Number(x); };
    const im = ler(form);
    const existentes = String(fd.get('fotos_existentes') || '').split('|').filter(Boolean);
    const d = { data_visita: txt('data_visita'), latitude: num('latitude'), longitude: num('longitude'), sem_gps_motivo: txt('sem_gps_motivo'), quintal_produz: txt('quintal_produz'),
      motivo: txt('motivo'), renda_quintal: num('renda_quintal'), horas_dia: num('horas_dia'), agua: txt('agua'), alimentacao: txt('alimentacao'), encaminhamentos: fd.getAll('encaminhamentos'), fala: txt('fala') };
    const e = validar(im);
    if (!d.data_visita) e.data_visita = 'Informe a data.'; else if (d.data_visita > R.hoje()) e.data_visita = 'Data no futuro.';
    if (d.latitude == null && String(d.sem_gps_motivo || '').length < 5) e.sem_gps_motivo = 'Registre a localização ou explique por que não foi possível.';
    if (!d.quintal_produz) e.quintal_produz = 'Responda se o quintal está produzindo.';
    if (d.quintal_produz && d.quintal_produz !== 'sim' && !d.motivo) e.motivo = 'Explique por que não está produzindo.';
    if (d.renda_quintal == null) e.renda_quintal = 'Informe (0 se não vende).';
    if (!d.agua) e.agua = 'Responda sobre a água.';
    if (!d.alimentacao) e.alimentacao = 'Responda sobre a alimentação.';
    if (!fotosAv.geral && !existentes.some(x => /aval_geral/.test(x))) e.fotos_av = 'Faça ao menos a foto da visão geral do quintal.';
    if (Object.keys(e).length) {
      Object.keys(e).forEach(k => { const w = form.querySelector('#w-' + k); if (w) w.classList.add('tem-erro'); });
      const alvo = {}; Object.entries(e).forEach(([k, m]) => { if (form.querySelector(`[name="${k}"]`) && !form.querySelector('#w-' + k)) alvo[k] = m; });
      U().mostrarErros(form, alvo, Object.keys(e).length > 1 ? 'Faltam ' + Object.keys(e).length + ' itens: ' + Object.values(e).slice(0, 3).join(' · ') : Object.values(e)[0]);
      const p = form.querySelector('.tem-erro'); if (p) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    await U().ocupado(form, async () => {
      const f = (S().fichas || []).find(x => x.id === form.dataset.ficha);
      const visitaId = form.dataset.visita || ((S().visitas || []).find(v => v.ficha_id === f.id && v.etapa === 'avaliacao' && v.situacao !== 'cancelada') || {}).id;
      if (!visitaId) throw new Error('Agende antes a visita de avaliação no roteiro de campo.');
      const reg = { id: form.dataset.id, ficha_id: f.id, visita_id: visitaId, uf: f.uf, data_visita: d.data_visita, latitude: d.latitude, longitude: d.longitude, sem_gps_motivo: d.sem_gps_motivo,
        quintal_produz: d.quintal_produz, ebia_pontos: im.ebia_pontos, ebia_nivel: im.ebia_nivel, fotos: existentes,
        dados: { motivo: d.motivo, renda_quintal: d.renda_quintal, horas_dia: d.horas_dia, agua: d.agua, alimentacao: d.alimentacao, encaminhamentos: d.encaminhamentos, fala: d.fala, impacto: im } };
      const enviado = await MQ.campoUI.guardar('avaliacao', reg, Object.assign({}, fotosAv));
      Object.keys(fotosAv).forEach(k => delete fotosAv[k]);
      U().fecharPainel(); U().render();
      U().toast(enviado ? 'Avaliação registrada. A visita conta como feita e pode entrar na ajuda de custo.' : 'Avaliação guardada no aparelho. Será enviada quando houver internet.');
    });
  }
  function painel(p) { return p.tipo === 'aval-ver' ? painelVer(p) : painelForm(p); }

  MQ.impactoUI = { bloco, ler, validar, classificar, menorDaFamilia, secaoCoord, painel, clique, enviar, indicadores, avaliacoes };
})();
