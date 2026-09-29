/* Mulheres & Quintais — ditado por voz nos campos de texto (relato, observações, relatório…).
   Usa o reconhecimento de fala do navegador (Chrome/Android e Safari/iPhone), em português.
   O texto vai aparecendo no campo enquanto a pessoa fala; ela revisa e corrige antes de salvar.
   Sem suporte no navegador, o botão não aparece (o microfone do teclado do celular continua valendo). */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

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
    a.btn.classList.remove('gravando'); atualizarOrg(a.ta); a.btn.innerHTML = ICONE + '<span>Falar</span>'; a.btn.setAttribute('aria-pressed', 'false');
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

  /* ---------- "Organizar o texto": proposta da IA para a pessoa conferir ---------- */
  const IC_ORG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9Zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5ZM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15Z"/></svg>';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tipoDe = ta => /relato/.test(ta.name) ? 'relato' : /relatorio/.test(ta.name) ? 'relatorio' : /obs/.test(ta.name) ? 'observacao' : 'geral';
  /* primeira barreira de privacidade: troca nomes completos conhecidos, CPF, telefone e e-mail antes de sair do aparelho */
  function semNomes(t) {
    const S = MQ.ui && MQ.ui.S; if (!S) return t;
    const nomes = [];
    (S.fichas || []).forEach(f => f.nome && nomes.push([f.nome, 'a agricultora']));
    (S.equipe || []).forEach(m => { if (m.nome) nomes.push([m.nome, 'a colega da equipe']); if (m.nome_social) nomes.push([m.nome_social, 'a colega da equipe']); });
    const ex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    nomes.forEach(([n, por]) => {
      const p = String(n).replace(/\s*\(.*?\)\s*/g, ' ').trim().split(/\s+/); if (p.length < 2) return;
      [p.join(' '), p[0] + ' ' + p[p.length - 1]].forEach(v => { t = t.replace(new RegExp('(?<!\\p{L})' + ex(v) + '(?!\\p{L})', 'giu'), por); });
    });
    return t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]').replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[telefone]').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]');
  }
  const podeOrganizar = () => { const S = MQ.ui && MQ.ui.S; return !!(S && S.api && S.api.organizarTexto && S.eu); };
  function atualizarOrg(ta) {
    const b = ta.closest('.voz-caixa') && ta.closest('.voz-caixa').querySelector('.btn-org'); if (!b) return;
    b.hidden = !podeOrganizar(); b.disabled = ta.value.trim().length < 40 || b.dataset.ocupado === '1';
  }
  async function organizar(ta, b) {
    const caixa = ta.closest('.voz-caixa'); if (ativo && ativo.ta === ta) parar();
    if (!navigator.onLine) { MQ.ui && MQ.ui.toast('Sem internet agora. Organize o texto quando a conexão voltar.'); return; }
    const velho = caixa.querySelector('.voz-proposta'); if (velho) velho.remove();
    b.dataset.ocupado = '1'; b.disabled = true; b.innerHTML = '<i class="voz-gira" aria-hidden="true"></i><span>Organizando…</span>';
    try {
      const prop = await MQ.ui.S.api.organizarTexto(semNomes(ta.value.trim()), tipoDe(ta));
      const box = document.createElement('div'); box.className = 'voz-proposta'; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Texto proposto');
      box.innerHTML = `<span class="eyebrow">Proposta do sistema · confira antes de usar</span><p class="vp-texto">${esc(prop).replace(/\n/g, '<br>')}</p>
        <p class="small muted">O sistema só reorganiza o que você falou ou escreveu. Se algo estiver errado ou faltando, mantenha o seu texto ou corrija depois de usar.</p>
        <div class="acoes"><button type="button" class="btn pri peq" data-vp="usar">Usar este texto</button><button type="button" class="btn peq" data-vp="manter">Manter o meu</button></div>`;
      box.addEventListener('click', ev => {
        const k = ev.target.closest('[data-vp]'); if (!k) return;
        if (k.dataset.vp === 'usar') {
          const original = ta.value; ta.value = prop; ta.dispatchEvent(new Event('input', { bubbles: true }));
          box.innerHTML = '<p class="small">Texto do sistema aplicado. Revise e salve. <button type="button" class="link" data-vp="desfazer">Voltar ao meu texto</button></p>';
          box.dataset.original = original; box.classList.add('aplicado');
        } else if (k.dataset.vp === 'desfazer') { ta.value = box.dataset.original || ta.value; ta.dispatchEvent(new Event('input', { bubbles: true })); box.remove(); }
        else box.remove();
      });
      caixa.appendChild(box); box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) { MQ.ui && MQ.ui.toast(e.message || String(e)); }
    b.dataset.ocupado = ''; b.innerHTML = IC_ORG + '<span>Organizar o texto</span>'; atualizarOrg(ta);
  }

  /* coloca os botões em todo campo de texto longo que a pessoa pode editar */
  function preparar(raiz) {
    (raiz || document).querySelectorAll('textarea:not([readonly]):not([disabled]):not([data-voz-ok]):not([data-sem-voz])').forEach(ta => {
      ta.dataset.vozOk = '1';
      const caixa = document.createElement('div'); caixa.className = 'voz-caixa';
      ta.parentNode.insertBefore(caixa, ta); caixa.appendChild(ta);
      const barra = document.createElement('div'); barra.className = 'voz-barra';
      if (SR) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-voz'; btn.setAttribute('aria-pressed', 'false');
        btn.title = 'Falar em vez de digitar'; btn.innerHTML = ICONE + '<span>Falar</span>';
        btn.addEventListener('click', () => comecar(ta, btn));
        barra.appendChild(btn);
      }
      const org = document.createElement('button'); org.type = 'button'; org.className = 'btn-voz btn-org';
      org.title = 'O sistema propõe um texto organizado a partir do que foi falado ou escrito; você confere e decide'; org.innerHTML = IC_ORG + '<span>Organizar o texto</span>';
      org.addEventListener('click', () => organizar(ta, org));
      barra.appendChild(org);
      caixa.appendChild(barra);
      ta.addEventListener('input', () => atualizarOrg(ta));
      atualizarOrg(ta);
    });
  }
  new MutationObserver(ms => {
    if (ativo && !document.body.contains(ativo.ta)) parar();   // a tela mudou no meio do ditado
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { preparar(n.tagName === 'TEXTAREA' ? n.parentNode : n); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => preparar());
  document.addEventListener('submit', () => { if (ativo) parar(); }, true);

  MQ.voz = { suportado: !!SR, parar, preparar, semNomes };
})();
