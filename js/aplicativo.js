/* Página "o sistema no celular" (aplicativo.html, desde a versão 437): escolhe perfil, momento e quantidade de quintais e abre a simulação
   dentro da moldura. Entra no perfil apertando o mesmo botão "Entrar como…" da simulação (a página e a moldura são da mesma origem). */
(function () {
  "use strict";
  const sel = { perfil: "bolsista", data: "2027-04-15", escala: "200" };
  const ifr = document.getElementById("sim"),
    carr = document.getElementById("carr"),
    abrir = document.getElementById("abrir");
  const endereco = () =>
    "simulacao.html?data=" +
    sel.data +
    (sel.escala !== "200" ? "&escala=" + sel.escala : "");
  let tentativa = 0;
  function entrar() {
    const n = ++tentativa;
    let vezes = 0;
    const tenta = () => {
      if (n !== tentativa) return;
      let doc = null;
      try {
        doc = ifr.contentDocument;
      } catch (e) {
        doc = null;
      }
      const bt =
        doc &&
        doc.querySelector(
          'button[data-acao="perfil"][data-p="' + sel.perfil + '"]',
        );
      if (bt) {
        bt.click();
        setTimeout(() => {
          carr.hidden = true;
        }, 600);
        return;
      }
      if (++vezes < 120) setTimeout(tenta, 250);
      else carr.hidden = true;
    };
    tenta();
  }
  function carregar() {
    carr.hidden = false;
    abrir.href = endereco();
    ifr.src = endereco();
  }
  /* dentro da moldura, a faixa da simulação fica só com o aviso de dados fictícios: data, quantidade e perfil se escolhem ao lado */
  function enxugar() {
    try {
      const d = ifr.contentDocument;
      if (!d || d.getElementById("ap-enxuto")) return;
      const st = d.createElement("style");
      st.id = "ap-enxuto";
      st.textContent =
        ".demo .demo-dias, .demo .demo-ver, .demo .demo-mais { display: none !important; }";
      d.head.appendChild(st);
    } catch (e) {
      /* sem acesso */
    }
  }
  ifr.addEventListener("load", () => {
    enxugar();
    entrar();
  });
  document.querySelectorAll(".op").forEach((g) =>
    g.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-v]");
      if (!b) return;
      const k = g.dataset.grupo;
      if (sel[k] === b.dataset.v) return;
      sel[k] = b.dataset.v;
      g.querySelectorAll("button").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
      if (k === "perfil") {
        carr.hidden = false;
        tentativa++;
        try {
          const s = ifr.contentWindow.sessionStorage;
          Object.keys(s).forEach((x) => {
            if (/^mq-sim/.test(x)) s.removeItem(x);
          });
        } catch (e) {
          /* sem acesso */
        }
        ifr.src = endereco();
        return;
      }
      carregar();
    }),
  );
})();
