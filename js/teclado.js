/* Mulheres & Quintais — todo bloco de conteúdo alcançável pelo teclado (12/10/2026, v261; revisto em 13/10/2026).
   Quem navega com Tab só parava em botões e campos: um quadro só de leitura (ex.: "Situação do campo em cada estado")
   era pulado. Aqui cada bloco de conteúdo — seção, cartão, aviso — vira uma parada do Tab, com o contorno de foco,
   SEM cara de link (não sublinha, não muda o cursor, não faz nada ao apertar Enter).
   13/10/2026 (auditoria de telas): sem paradas repetidas. Bloco que só embrulha outros blocos (ou os números de um resumo)
   não vira parada: o Tab vai direto aos de dentro. Grupo sem título repetido (o leitor lia o título duas vezes).
   Quadro mais largo que a tela vira parada (para rolar com as setas), com o nome da seção (antes eram todos iguais).
   Roda sozinho a cada mudança na tela (MutationObserver), então vale para todas as telas e painéis. */
window.MQ = window.MQ || {};
(function () {
  // blocos que viram parada do Tab (dentro da tela principal e dos painéis)
  const BASE = ['section.secao', '.bloco', '.cartao', '.pessoa', '.vazio', '.aviso', '.fc-item', '.passo-fic', '.ent-hero'];
  const BLOCOS = BASE.map(s => `main ${s}, #painel ${s}`).join(', ');
  const DENTRO = BASE.join(', ') + ', .dx-exec, .dx-kpi, .eq-kpi, .resumo > div';   // o que já é parada por conta própria
  const INTERATIVO = 'a[href], button, input, select, textarea, summary, label, [contenteditable="true"]';
  let n = 0;
  function rotularSecao(el) {
    if (el.hasAttribute('aria-labelledby') || el.hasAttribute('aria-label')) return;
    const h = el.querySelector('h1, h2, h3'); if (!h) return;
    if (!h.id) h.id = 'tb-' + (++n); el.setAttribute('aria-labelledby', h.id);
  }
  const embrulha = el => !el.matches('section.secao') && !!el.querySelector(DENTRO);
  function nomeDoQuadro(el) {
    const t = el.querySelector('caption, h1, h2, h3') || (el.closest('section, .bloco, .ac-sec') || document).querySelector('h2, h3');
    const nome = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    return (nome ? nome + ': quadro' : 'Quadro') + ' (use as setas para rolar para o lado)';
  }
  function marcar(raiz) {
    const r = raiz || document;
    if (!r.querySelectorAll) return 0;
    let k = 0;
    r.querySelectorAll(BLOCOS).forEach(el => {
      if (el.hasAttribute('tabindex') || el.matches(INTERATIVO) || el.closest('[hidden], [inert], form')) return;   // dentro de formulário, o Tab segue de campo em campo
      if (embrulha(el)) return;
      el.setAttribute('tabindex', '0'); el.setAttribute('data-tab-bloco', '');
      if (el.tagName === 'SECTION') rotularSecao(el); else if (!el.hasAttribute('role')) el.setAttribute('role', 'group');
      k++;
    });
    // quadro mais largo (ou mais alto) que o espaço: o teclado precisa parar nele para rolar. Com botão dentro, o Tab já entra.
    r.querySelectorAll('main .quadro-scroll, #painel .quadro-scroll, main .rel-previa, #painel .rel-previa, main .eg-caixa').forEach(el => {
      if (el.hasAttribute('tabindex') || (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)) return;
      if (el.querySelector('a[href], button:not([disabled]), input, select, textarea, [tabindex]')) return;
      el.setAttribute('tabindex', '0'); el.setAttribute('data-tab-bloco', ''); if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
      if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', nomeDoQuadro(el));
      k++;
    });
    rotularGrupos(r); marcarObrigatorios(r);
    return k;
  }
  /* 14/10/2026 (auditoria ACE-1): grupo de Sim/Não (e de outras opções) ganha a pergunta como nome. O leitor de tela lia só
     "Sim, botão de opção, 1 de 2", sem dizer de que pergunta era. A pergunta é o texto que vem logo antes do grupo. */
  function rotularGrupos(r) {
    r.querySelectorAll('.sn-par:not([role])').forEach(g => {
      if (!g.querySelector('input[type=radio]')) return;
      let t = g.previousElementSibling;
      if (!t || !/^(SPAN|LABEL|P|B|STRONG|LEGEND|H3|H4)$/.test(t.tagName) || t.querySelector('input, select, textarea')) return;
      if (!t.id) t.id = 'tq-' + (++n);
      g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-labelledby', t.id);
    });
  }
  /* (ACE-2) campos que a validação exige, marcados ANTES do envio: asterisco no rótulo e aria-required no campo */
  const OBRIG = {
    ficha: () => ['nome', 'cpf', 'data_nascimento', 'municipio', 'comunidade', 'endereco', 'data_ficha', 'consent_dados', 'resultado', 'foto_termo', 'foto_ficha'].concat((MQ.CRITERIOS || []).map(c => c[0])),
    diag: () => ['data_visita', 'familia', 'agua_seca', 'fontes_agua', 'fotos', 'objetivos', 'kit'],
    aval: () => ['data_visita', 'quintal_produz', 'renda_quintal', 'agua', 'alimentacao']   // 18/10/2026: a avaliação não marcava nada
  };
  function rotuloDe(form, nome) {
    const w = form.querySelector('#w-' + nome); const c = form.querySelector('[name="' + nome + '"]');
    if (c && c.id) { const l = form.querySelector('label[for="' + c.id + '"]'); if (l) return [l, c]; }
    if (c && (c.type === 'radio' || c.type === 'checkbox')) { const g = c.closest('.sn-par, .chips-sel'); const t = g && g.previousElementSibling; if (t && !t.querySelector('input')) return [t, g]; }
    if (w) { const t = w.querySelector(':scope > legend, :scope > label, :scope > span:first-child, :scope > h3, :scope > b') || (w.previousElementSibling && /^(LEGEND|LABEL|H3)$/.test(w.previousElementSibling.tagName) ? w.previousElementSibling : null); if (t) return [t, c || w]; }
    if (c) { const cp = c.closest('.campo'); const l = cp && cp.querySelector(':scope > label'); if (l) return [l, c]; }
    return [null, c];
  }
  function marcarObrigatorios(r) {
    // qualquer formulário dos painéis: campo com required ganha o asterisco no rótulo (ex.: as senhas em Meus dados)
    r.querySelectorAll('#painel form [required]').forEach(c => {
      const l = (c.id && document.querySelector('label[for="' + c.id + '"]')) || (c.closest('.campo') && c.closest('.campo').querySelector(':scope > label'));
      if (l && !l.querySelector('.obr, .ac-obr') && !/obrigat/i.test(l.textContent)) l.insertAdjacentHTML('beforeend', '<span class="obr" aria-hidden="true"> *</span>');
    });
    r.querySelectorAll('form[data-form="ficha"], form[data-form="diag"], form[data-form="aval"]').forEach(form => {
      if (form.dataset.obrMarcado) return; form.dataset.obrMarcado = '1';
      OBRIG[form.dataset.form]().forEach(nome => {
        const [rot, alvo] = rotuloDe(form, nome);
        if (rot && !rot.querySelector('.obr')) rot.insertAdjacentHTML('beforeend', '<span class="obr" aria-hidden="true"> *</span>');
        if (alvo && alvo.setAttribute && /^(INPUT|SELECT|TEXTAREA)$/.test(alvo.tagName) && !(alvo.type === 'radio' || alvo.type === 'checkbox' || alvo.type === 'file')) alvo.setAttribute('aria-required', 'true');   // só onde a ARIA aceita
        const g = alvo && alvo.closest && alvo.closest('.sn-par'); if (g) g.setAttribute('aria-required', 'true');
      });
      if (!form.querySelector('.obr-legenda')) form.insertAdjacentHTML('afterbegin', '<p class="obr-legenda small muted"><span aria-hidden="true">*</span> Obrigatório: o sistema só grava com estes itens preenchidos.</p>');
    });
  }
  let pendente = false;
  function agendar() {
    if (pendente) return; pendente = true;
    (window.requestAnimationFrame || (f => setTimeout(f, 16)))(() => { pendente = false; marcar(document); });
  }
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement && document.documentElement.nodeType) {
    // também quando algo abre ou aparece (details, abas, classes) e quando a tela muda de tamanho (o quadro pode passar a rolar)
    new MutationObserver(agendar).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class'] });
    window.addEventListener('resize', agendar); window.addEventListener('load', agendar);
    agendar();
  }
  // "Pular para o conteúdo": primeiro item do Tab em todas as telas (fica escondido até receber o foco)
  function pular() {
    const m = document.querySelector('main'); if (!m) return;
    if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1');
    m.focus(); try { m.scrollIntoView({ block: 'start' }); } catch (e) {}
  }
  MQ.teclado = { marcar, BLOCOS, pular };
})();
