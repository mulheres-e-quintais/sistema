/* Mulheres & Quintais — ditado por voz nos campos de texto (relato, observações, relatório…).
   Usa o reconhecimento de fala do navegador (Chrome/Android e Safari/iPhone), em português.
   O texto vai aparecendo no campo enquanto a pessoa fala; ela revisa e corrige antes de salvar.
   Sem suporte no navegador, o botão não aparece (o microfone do teclado do celular continua valendo). */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { MQ.voz = { suportado: false }; return; }

  const ICONE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';
  let ativo = null;   // { rec, ta, btn, base, finais }

  /* comandos falados simples: "vírgula", "ponto final", "nova linha" */
  function ajustar(t) {
    return t.replace(/\s*\bv[íi]rgula\b/gi, ',').replace(/\s*\bponto final\b/gi, '.').replace(/\s*\bponto de interroga[çc][ãa]o\b/gi, '?')
      .replace(/\s*\b(nova linha|pr[óo]xima linha|par[áa]grafo)\b\s*/gi, '\n');
  }
  const maiuscula = (antes, t) => { t = t.replace(/([.!?]\s+|\n\s*)(\p{Ll})/gu, (m, p, c) => p + c.toUpperCase());
    return (!antes.trim() || /[.!?\n]\s*$/.test(antes)) ? t.replace(/^(\s*)(\S)/, (m, e, c) => e + c.toUpperCase()) : t; };
  const juntar = (a, b) => !a ? b : (/[\s\n]$/.test(a) || /^[,.?\n]/.test(b)) ? a + b : a + ' ' + b;

  function escrever() {
    const a = ativo; if (!a) return;
    a.ta.value = juntar(a.base, a.finais + (a.parcial ? (a.finais ? ' ' : '') + a.parcial : '')).replace(/ +\n/g, '\n');
    a.ta.dispatchEvent(new Event('input', { bubbles: true }));
    a.ta.scrollTop = a.ta.scrollHeight;
  }

  function parar(msg) {
    const a = ativo; if (!a) return; ativo = null;
    a.parcial = ''; a.ta.value = juntar(a.base, a.finais).replace(/ +\n/g, '\n').replace(/[ ]+$/, '');
    if (a.ta.value && !/[.!?]\s*$/.test(a.ta.value) && a.finais) a.ta.value += '.';
    a.ta.dispatchEvent(new Event('input', { bubbles: true }));
    try { a.rec.stop(); } catch (e) {}
    a.btn.classList.remove('gravando'); a.btn.innerHTML = ICONE + '<span>Falar</span>'; a.btn.setAttribute('aria-pressed', 'false');
    a.ta.closest('.voz-caixa') && a.ta.closest('.voz-caixa').classList.remove('ouvindo');
    if (msg && MQ.ui) MQ.ui.toast(msg);
  }

  function comecar(ta, btn) {
    if (ativo) { const mesmo = ativo.ta === ta; parar(); if (mesmo) return; }
    const rec = new SR(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true;
    const a = ativo = { rec, ta, btn, base: ta.value, finais: '', parcial: '', erro: null };
    rec.onresult = ev => {
      let parcial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ajustar(ev.results[i][0].transcript);
        if (ev.results[i].isFinal) a.finais = juntar(a.finais, maiuscula(juntar(a.base, a.finais), t.replace(/^ +| +$/g, '')));
        else parcial += t;
      }
      a.parcial = parcial.trim(); escrever();
    };
    rec.onerror = ev => { a.erro = ev.error; };
    rec.onend = () => {
      if (ativo !== a) return;
      // o navegador para sozinho depois de um silêncio: continua ouvindo até a pessoa tocar em Parar
      if (!a.erro) { try { rec.start(); return; } catch (e) {} }
      const m = { 'not-allowed': 'O microfone está bloqueado. Libere o microfone para este site nas permissões do navegador.',
        'service-not-allowed': 'O microfone está bloqueado. Libere o microfone para este site nas permissões do navegador.',
        network: 'Para ditar, o navegador precisa de internet. Sem internet, use o microfone do teclado do celular.',
        'audio-capture': 'Não achei o microfone do aparelho.' }[a.erro];
      parar(m || (a.erro && a.erro !== 'no-speech' && a.erro !== 'aborted' ? 'O ditado parou. Toque em Falar para continuar.' : null));
    };
    try { rec.start(); } catch (e) { ativo = null; return; }
    btn.classList.add('gravando'); btn.innerHTML = '<i class="voz-ponto" aria-hidden="true"></i><span>Parar</span>'; btn.setAttribute('aria-pressed', 'true');
    ta.closest('.voz-caixa') && ta.closest('.voz-caixa').classList.add('ouvindo');
    ta.focus();
  }

  /* coloca o botão em todo campo de texto longo que a pessoa pode editar */
  function preparar(raiz) {
    (raiz || document).querySelectorAll('textarea:not([readonly]):not([disabled]):not([data-voz-ok]):not([data-sem-voz])').forEach(ta => {
      ta.dataset.vozOk = '1';
      const caixa = document.createElement('div'); caixa.className = 'voz-caixa';
      ta.parentNode.insertBefore(caixa, ta); caixa.appendChild(ta);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-voz'; btn.setAttribute('aria-pressed', 'false');
      btn.title = 'Falar em vez de digitar'; btn.innerHTML = ICONE + '<span>Falar</span>';
      btn.addEventListener('click', () => comecar(ta, btn));
      caixa.appendChild(btn);
    });
  }
  new MutationObserver(ms => {
    if (ativo && !document.body.contains(ativo.ta)) parar();   // a tela mudou no meio do ditado
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { preparar(n.tagName === 'TEXTAREA' ? n.parentNode : n); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => preparar());
  document.addEventListener('submit', () => { if (ativo) parar(); }, true);

  MQ.voz = { suportado: true, parar, preparar };
})();
