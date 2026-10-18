/* Mulheres & Quintais — guia de seções dos formulários longos (18/10/2026, auditoria de UX).
   O diagnóstico tem 13 seções e 11 mil pixels no celular; a ficha e a avaliação também passam de 4 mil. Quem preenche no
   quintal não sabia onde estava nem o que faltava, e voltar a uma seção era rolar no escuro.
   Aqui, todo formulário de painel com 4 ou mais seções (fieldset com legenda) ganha no topo, preso ao rolar:
   - "Seção 3 de 13 · O quintal e a água" (onde a pessoa está agora);
   - uma barra com quantas seções estão completas;
   - um botão por seção, com o estado: completa (✓), começada (•), com erro (!) ou vazia; tocar leva até ela.
   "Completa" = tem algo preenchido e nenhum item obrigatório (marcado com * pelo teclado.js) em branco.
   Não muda campo, regra nem gravação: só lê o formulário. Roda sozinho a cada painel aberto (MutationObserver). */
window.MQ = window.MQ || {};
(function () {
  const MIN_SECOES = 4;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // seções = fieldsets com legenda que não estão dentro de outro fieldset (o plano do quintal fica num bloco à parte)
  const secoesDe = form => [...form.querySelectorAll('fieldset')].filter(f => f.querySelector(':scope > legend') && !f.parentElement.closest('fieldset') && f.closest('form') === form);
  const titulo = fs => fs.querySelector(':scope > legend').textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const curto = t => t.replace(/^\d+[a-z]?(\s*e\s*\d+[a-z]?)?\.\s*/, '').replace(/\s*\(.*\)$/, '');   // "2. Termo de consentimento (leia…)" → "Termo de consentimento"

  function preenchido(c) {
    if (c.disabled) return false;
    if (c.type === 'checkbox' || c.type === 'radio') return c.checked;
    if (c.type === 'file') {   // a foto já enviada aparece só na dica do campo ("Já tem foto", "Foto pronta")
      const d = c.id && document.getElementById(c.id + '-dica');
      return !!(c.files && c.files.length) || !!(d && /já tem foto|foto pronta/i.test(d.textContent));
    }
    if (c.type === 'hidden') return false;
    return String(c.value || '').trim() !== '';
  }
  function estado(fs) {
    const vis = c => c.type !== 'hidden' && !c.closest('[hidden]');
    const campos = [...fs.querySelectorAll('input, select, textarea')].filter(vis);
    if (fs.querySelector('[aria-invalid="true"], .campo.erro, .erro-campo')) return 'erro';
    // fotos e linhas dinâmicas contam como preenchimento (miniatura enviada, pessoa da família etc.)
    const temAlgo = campos.some(preenchido) || !!fs.querySelector('img[src^="blob:"], img[src^="data:"], .foto-ok, .linha-din');
    if (!temAlgo) return 'vazia';
    const obrig = [...fs.querySelectorAll('[aria-required="true"]')].filter(vis);
    const falta = obrig.some(g => {
      if (g.matches('input, select, textarea')) return !preenchido(g);
      return ![...g.querySelectorAll('input')].some(preenchido);   // grupo Sim/Não
    });
    return falta ? 'comecada' : 'completa';
  }
  const SIMB = { completa: '✓', comecada: '•', erro: '!', vazia: '' };
  const TXT = { completa: 'completa', comecada: 'começada, falta item obrigatório ou opcional', erro: 'com erro para corrigir', vazia: 'ainda vazia' };

  function montar(form) {
    const secoes = secoesDe(form);
    if (secoes.length < MIN_SECOES) return;
    form.dataset.guia = '1';
    secoes.forEach((fs, i) => { if (!fs.id) fs.id = 'gf-' + (form.dataset.form || 'f') + '-' + i; fs.setAttribute('tabindex', '-1'); });
    const nav = document.createElement('nav');
    nav.className = 'guia-form'; nav.setAttribute('aria-label', 'Seções do formulário');
    nav.innerHTML = `<div class="gf-topo"><span class="gf-pos" aria-live="polite"></span><span class="gf-conta"></span></div>
      <div class="gf-barra" aria-hidden="true"><span></span></div>
      <ol class="gf-lista">${secoes.map((fs, i) => `<li><button type="button" data-gf="${i}"><span class="gf-n">${i + 1}</span><span class="gf-t">${esc(curto(titulo(fs)) || titulo(fs))}</span><span class="gf-e" aria-hidden="true"></span></button></li>`).join('')}</ol>`;
    const legenda = form.querySelector(':scope > .obr-legenda');
    form.insertBefore(nav, legenda ? legenda.nextSibling : form.firstChild);
    const corpo = form.closest('.painel-corpo') || document.scrollingElement;
    let atual = -1;

    function atualizarEstados() {
      let ok = 0;
      secoes.forEach((fs, i) => {
        const e = estado(fs); if (e === 'completa') ok++;
        const b = nav.querySelector(`[data-gf="${i}"]`); b.dataset.estado = e;
        b.querySelector('.gf-e').textContent = SIMB[e];
        b.setAttribute('aria-label', `Seção ${i + 1}: ${titulo(fs)}, ${TXT[e]}`);
      });
      nav.querySelector('.gf-conta').textContent = `${ok} de ${secoes.length} completas`;
      nav.querySelector('.gf-barra > span').style.width = Math.round(100 * ok / secoes.length) + '%';
    }
    function marcarAtual() {
      const topo = corpo.getBoundingClientRect ? (corpo === document.scrollingElement ? 0 : corpo.getBoundingClientRect().top) : 0;
      const limite = topo + nav.offsetHeight + 24;
      let i = 0;
      secoes.forEach((fs, k) => { if (fs.getBoundingClientRect().top <= limite) i = k; });
      // chegou ao fim do formulário: a última seção é a atual mesmo se for curta
      if (corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 4) i = secoes.length - 1;
      if (i === atual) return; atual = i;
      nav.querySelector('.gf-pos').innerHTML = `Seção <b>${i + 1}</b> de ${secoes.length} · ${esc(curto(titulo(secoes[i])) || titulo(secoes[i]))}`;
      nav.querySelectorAll('[data-gf]').forEach(b => b.removeAttribute('aria-current'));
      const b = nav.querySelector(`[data-gf="${i}"]`); b.setAttribute('aria-current', 'step');
      // mantém o botão da seção atual à vista na faixa (rola só a faixa, nunca a página)
      const l = nav.querySelector('.gf-lista');
      if (l.scrollWidth > l.clientWidth) { const x = b.parentElement.offsetLeft - l.clientWidth / 2 + b.parentElement.offsetWidth / 2; l.scrollTo ? l.scrollTo({ left: Math.max(0, x), behavior: 'smooth' }) : (l.scrollLeft = x); }
    }
    let agendado = false;
    const tique = () => { if (agendado) return; agendado = true; requestAnimationFrame(() => { agendado = false; if (!nav.isConnected) return; marcarAtual(); }); };
    corpo.addEventListener('scroll', tique, { passive: true });
    let t = null; const recontar = () => { clearTimeout(t); t = setTimeout(() => nav.isConnected && atualizarEstados(), 150); };
    form.addEventListener('input', recontar); form.addEventListener('change', recontar);
    // erros da validação, linhas novas, fotos: o formulário muda sem 'input'
    if (typeof MutationObserver !== 'undefined') new MutationObserver(recontar).observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-invalid', 'class', 'src', 'hidden'] });
    nav.addEventListener('click', ev => {
      const b = ev.target.closest('[data-gf]'); if (!b) return;
      const fs = secoes[+b.dataset.gf];
      const y = fs.getBoundingClientRect().top - (corpo === document.scrollingElement ? 0 : corpo.getBoundingClientRect().top) + corpo.scrollTop - nav.offsetHeight - 8;
      const suave = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      corpo.scrollTo ? corpo.scrollTo({ top: y, behavior: suave ? 'smooth' : 'auto' }) : (corpo.scrollTop = y);
      try { fs.focus({ preventScroll: true }); } catch (e) {}
    });
    atualizarEstados(); marcarAtual();
  }
  function varrer() { document.querySelectorAll('#painel form.f:not([data-guia])').forEach(montar); }
  /* campo que só faz sentido com certa resposta: <div data-mostra-se="pergunta=valor1,valor2">. Some quando a resposta é
     outra e o campo está vazio (nunca esconde o que já foi escrito). Ex.: "Por que não está produzindo?" na avaliação. */
  function condicionais(form) {
    form.querySelectorAll('[data-mostra-se]').forEach(el => {
      const [nome, vals] = el.dataset.mostraSe.split('='); const ok = vals.split(',');
      const marcado = form.querySelector(`[name="${nome}"]:checked`) || form.querySelector(`select[name="${nome}"]`);
      const resp = marcado ? marcado.value : '';
      const temTexto = [...el.querySelectorAll('input, textarea, select')].some(c => String(c.value || '').trim());
      el.hidden = !(ok.includes(resp) || temTexto);
    });
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('change', ev => { const f = ev.target.closest && ev.target.closest('form'); if (f && f.querySelector('[data-mostra-se]')) condicionais(f); });
    // matrícula do FIC: escrever o número já marca a pessoa (antes dava para escrever numa linha desmarcada e o número se perdia)
    document.addEventListener('input', ev => {
      const n = ev.target.closest && ev.target.closest('.fm-num'); if (!n || !n.value.trim()) return;
      const c = n.closest('.fm-l') && n.closest('.fm-l').querySelector('input[type=checkbox]'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }
  /* teclado do celular aberto: o guia deixa de ficar preso no topo (sobra pouca tela entre o teclado e o topo) */
  function teclado() {
    const vv = window.visualViewport; if (!vv) return;
    document.documentElement.classList.toggle('teclado-aberto', vv.height < window.innerHeight * 0.72);
  }
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement && document.documentElement.nodeType) {
    let p = false;
    new MutationObserver(() => { if (p) return; p = true; requestAnimationFrame(() => { p = false; varrer(); }); }).observe(document.documentElement, { childList: true, subtree: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', teclado);
    /* sem internet: a barra de salvar dos registros de campo avisa que vai para o aparelho (antes nada mudava dentro do formulário) */
    const rede = () => document.documentElement.classList.toggle('sem-rede', navigator.onLine === false);
    window.addEventListener('online', rede); window.addEventListener('offline', rede); rede();
    /* girou o aparelho no meio do formulário: o campo em que a pessoa estava volta para o meio da tela (antes ia parar a 1.500 px) */
    let giro = null;
    const voltarAoCampo = () => { clearTimeout(giro); giro = setTimeout(() => {
      const a = document.activeElement; if (!a || !a.closest || !a.closest('#painel')) return;
      const alvo = a.closest('.campo, .criterio, fieldset') || a; try { alvo.scrollIntoView({ block: 'center' }); } catch (e) {} }, 250); };
    window.addEventListener('orientationchange', voltarAoCampo);
    if (window.matchMedia) { const m = matchMedia('(orientation: portrait)'); m.addEventListener ? m.addEventListener('change', voltarAoCampo) : m.addListener && m.addListener(voltarAoCampo); }
  }
  MQ.guiaForm = { montar, estado, varrer, curto, condicionais };
})();
