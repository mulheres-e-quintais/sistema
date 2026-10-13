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
    return k;
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
