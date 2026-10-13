/* Mulheres & Quintais — todo bloco de conteúdo alcançável pelo teclado (12/10/2026, v261).
   Quem navega com Tab só parava em botões e campos: um quadro só de leitura (ex.: "Situação do campo em cada estado")
   era pulado. Aqui cada bloco de conteúdo — seção, cartão, aviso, quadro — vira uma parada do Tab, com o contorno de
   foco, SEM cara de link (não sublinha, não muda o cursor, não faz nada ao apertar Enter).
   O leitor de tela anuncia o bloco pelo título dele (aria-labelledby) ou como grupo.
   Roda sozinho a cada mudança na tela (MutationObserver), então vale para todas as telas e painéis. */
window.MQ = window.MQ || {};
(function () {
  // blocos que viram parada do Tab (dentro da tela principal e dos painéis)
  const BLOCOS = ['section.secao', '.bloco', '.cartao', '.pessoa', '.vazio', '.aviso', '.resumo', '.fc-item', '.passo-fic', '.ent-hero']
    .map(s => `main ${s}, #painel ${s}`).join(', ');
  const INTERATIVO = 'a[href], button, input, select, textarea, summary, label, [contenteditable="true"]';
  let n = 0;
  function rotular(el) {
    if (el.hasAttribute('aria-labelledby') || el.hasAttribute('aria-label')) return;
    const h = el.querySelector('h1, h2, h3, h4, legend, .fn, b');
    if (h && /^(H\d|LEGEND)$/.test(h.tagName)) { if (!h.id) h.id = 'tb-' + (++n); el.setAttribute('aria-labelledby', h.id); }
  }
  function marcar(raiz) {
    const r = raiz || document;
    if (!r.querySelectorAll) return 0;
    let k = 0;
    r.querySelectorAll(BLOCOS).forEach(el => {
      if (el.hasAttribute('tabindex') || el.matches(INTERATIVO) || el.closest('[hidden], [inert], form')) return;   // dentro de formulário, o Tab segue de campo em campo
      el.setAttribute('tabindex', '0'); el.setAttribute('data-tab-bloco', '');
      if (!el.hasAttribute('role') && el.tagName !== 'SECTION') el.setAttribute('role', 'group');
      rotular(el); k++;
    });
    // quadro mais largo que a tela: o teclado também precisa rolar para o lado
    r.querySelectorAll('main .quadro-scroll, #painel .quadro-scroll').forEach(el => {
      if (el.hasAttribute('tabindex') || (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)) return;
      el.setAttribute('tabindex', '0'); el.setAttribute('data-tab-bloco', ''); if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Quadro (use as setas para rolar para o lado)'); k++;
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
  MQ.teclado = { marcar, BLOCOS };
})();
