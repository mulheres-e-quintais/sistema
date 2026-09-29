/* Mulheres & Quintais — desconexão depois de 15 minutos sem uso, em todos os perfis.
   Aos 13 minutos aparece um aviso com contagem; aos 15, o sistema sai sozinho. O último uso fica
   guardado no aparelho, então vale entre abas do navegador e também ao reabrir o sistema depois.
   O que estava guardado na fila (preenchido sem internet) não se perde: sobe na próxima entrada. */
(function () {
  const LIMITE = 15 * 60 * 1000;   // 15 minutos
  const AVISO = 2 * 60 * 1000;     // avisa 2 minutos antes
  const CHAVE = 'mq-ultimo-uso';
  let memoria = 0, ultimaGravacao = 0, timer = null, cfg = null, caixa = null;

  const agora = () => Date.now();
  function ultimo() { try { const v = +localStorage.getItem(CHAVE); return v || memoria; } catch (e) { return memoria; } }
  function tocar(forcar) {
    const t = agora(); memoria = t;
    if (!forcar && t - ultimaGravacao < 5000) return;   // grava no máximo a cada 5 s
    ultimaGravacao = t; try { localStorage.setItem(CHAVE, String(t)); } catch (e) {}
  }
  function esquecer() { memoria = 0; ultimaGravacao = 0; try { localStorage.removeItem(CHAVE); } catch (e) {} }
  /* regras puras (usadas também nos testes) */
  const venceu = (ult, t = agora(), limite = LIMITE) => !!ult && t - ult >= limite;
  const falta = (ult, t = agora(), limite = LIMITE) => ult ? Math.max(0, limite - (t - ult)) : limite;
  const fmt = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function mostrarAviso(ms) {
    if (!caixa) {
      caixa = document.createElement('div'); caixa.className = 'sessao-aviso'; caixa.setAttribute('role', 'alertdialog'); caixa.setAttribute('aria-live', 'assertive');
      document.body.appendChild(caixa);
    }
    caixa.innerHTML = `<div class="sessao-in"><b>Você está sem usar o sistema.</b>
      <span>Por segurança, ele sai sozinho em <b class="num">${fmt(ms)}</b>. O que estiver guardado no celular não se perde.</span>
      <button type="button" class="btn pri" data-acao="sessao-continuar">Continuar usando</button></div>`;
  }
  function esconderAviso() { if (caixa) { caixa.remove(); caixa = null; } }

  function conferir() {
    if (!cfg || !cfg.ativo()) { esconderAviso(); return; }
    const f = falta(ultimo());
    if (f <= 0) { esconderAviso(); parar(); cfg.aoVencer(); }
    else if (f <= AVISO) mostrarAviso(f);
    else esconderAviso();
  }
  function parar() { if (timer) clearInterval(timer); timer = null; }
  /* cfg: { ativo(): há alguém logado?, aoVencer(): sai do sistema } */
  function iniciar(c) {
    cfg = c; parar(); timer = setInterval(conferir, 1000);
    if (timer && typeof timer === 'object' && timer.unref) timer.unref();   // só no Node (testes); no navegador é número
  }
  // qualquer uso conta: toque, clique, tecla, rolagem, digitação
  ['pointerdown', 'keydown', 'touchstart', 'input', 'scroll', 'wheel'].forEach(ev =>
    document.addEventListener(ev, () => { if (cfg && cfg.ativo()) { tocar(); if (caixa) esconderAviso(); } }, { passive: true, capture: true }));
  // o celular pausa o relógio com a tela apagada: ao voltar, confere na hora
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir(); });
  document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-acao="sessao-continuar"]'); if (b) { tocar(true); esconderAviso(); } });

  MQ.sessao = { LIMITE, AVISO, iniciar, parar, tocar, esquecer, ultimo, venceu, falta, conferir, fmt };
})();
