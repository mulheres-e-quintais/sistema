/* Mulheres & Quintais — aparência da tela (12/10/2026, v261).
   O sistema é usado no campo, muitas vezes no sol do meio-dia. Duas escolhas, guardadas NESTE aparelho
   (valem para quem usar o celular; não vão para o servidor e não somem ao sair da conta):
   1. Modo sol: texto quase preto em fundo branco, bordas escuras e grossas, etiquetas contornadas e letra
      um pouco maior. É o que se lê melhor com muita luz (fundo escuro vira espelho no sol).
   2. Tema: Automático (segue o celular), Claro ou Escuro. O escuro serve à noite e poupa bateria em telas AMOLED.
   O modo sol vale por cima do tema: ligado, a tela fica sempre clara.
   Roda logo no começo do tudo.js, antes da primeira tela, para não piscar. */
window.MQ = window.MQ || {};
(function () {
  const CHAVE = 'mq-aparencia';
  const TEMAS = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };
  function ler() {
    let v = null; try { v = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { v = null; }
    v = v && typeof v === 'object' ? v : {};
    return { tema: TEMAS[v.tema] ? v.tema : 'auto', sol: v.sol === true };
  }
  function gravar(v) { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) {} }
  function aplicar(v) {
    v = v || ler(); const raiz = typeof document !== 'undefined' && document.documentElement; if (!raiz || !raiz.setAttribute) return v;
    const tema = v.sol ? 'light' : v.tema === 'claro' ? 'light' : v.tema === 'escuro' ? 'dark' : null;
    if (tema) raiz.setAttribute('data-theme', tema); else raiz.removeAttribute('data-theme');
    if (v.sol) raiz.setAttribute('data-sol', ''); else raiz.removeAttribute('data-sol');
    void raiz.offsetHeight;   // força o navegador a recalcular as cores agora
    return v;
  }
  function mudar(campo, valor) { const v = ler(); v[campo] = valor; gravar(v); aplicar(v); return v; }

  const ICONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  // botão da barra de cima (aparece logado e na tela de entrada)
  function botao() {
    const v = ler();
    return `<button class="btn-ajuda btn-aparencia${v.sol ? ' ligado' : ''}" data-acao="aparencia" title="Aparência da tela (modo sol, claro ou escuro)" aria-label="Aparência da tela: modo sol, claro ou escuro${v.sol ? ' (modo sol ligado)' : ''}">${ICONE}</button>`;
  }
  // na tela de entrada (que não tem a barra de cima): pílula no canto do cartão de acesso
  function botaoEntrada() {
    const v = ler();
    return `<button type="button" class="ent-aparencia${v.sol ? ' ligado' : ''}" data-acao="aparencia" aria-label="Aparência da tela: modo sol, claro ou escuro${v.sol ? ' (modo sol ligado)' : ''}">${ICONE}<span>Modo sol</span>${v.sol ? '<b class="ent-ap-ok" aria-hidden="true">✓</b>' : ''}</button>`;
  }
  function painel() {
    const v = ler();
    const opc = k => `<button type="button" data-acao="aparencia-tema" data-v="${k}" aria-pressed="${v.tema === k}"${v.sol ? ' disabled' : ''}>${TEMAS[k]}</button>`;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Neste aparelho</span><h2 id="painel-t">Aparência da tela</h2></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        <div class="ap-sol">
          <button type="button" class="ap-chave" data-acao="aparencia-sol" role="switch" aria-checked="${v.sol}">
            <span class="ap-ic" aria-hidden="true">${ICONE}</span>
            <span class="ap-txt"><b>Modo sol</b><small>Para usar no campo, com sol forte: letra preta em fundo branco, bordas escuras e letra maior.</small></span>
            <span class="ap-trilho" aria-hidden="true"><span></span></span>
          </button>
        </div>
        <div class="bloco">
          <h3>Tema</h3>
          <span class="seg ap-temas" role="group" aria-label="Tema">${Object.keys(TEMAS).map(opc).join('')}</span>
          <p class="small muted">${v.sol ? 'Com o modo sol ligado a tela fica sempre clara. Desligue o modo sol para escolher o tema.'
            : 'Automático segue o celular (claro de dia, escuro se o celular estiver no modo escuro). O escuro é bom à noite e gasta menos bateria em alguns celulares, mas no sol é difícil de ler.'}</p>
        </div>
        <p class="nota">A escolha fica guardada neste aparelho e continua valendo depois de sair do sistema. Dica: no sol, deixe também o brilho do celular no máximo.</p>
      </div>`;
  }
  aplicar();
  MQ.aparencia = { ler, aplicar, mudar, botao, botaoEntrada, painel, TEMAS, CHAVE };
})();
