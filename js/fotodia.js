/* Mulheres & Quintais — foto do quintal tem de ser do DIA DA VISITA (12/10/2026).
   Para não aceitar foto antiga guardada no celular (galeria, WhatsApp), a foto escolhida passa por esta conferência:
   - a data em que a foto foi TIRADA vem de dentro do arquivo (EXIF, gravado pela câmera do celular);
   - a foto só vale se essa data for o dia da visita informado no formulário;
   - sem data dentro do arquivo (foto encaminhada pelo WhatsApp, captura de tela, imagem baixada), a foto é recusada
     e o sistema oferece a própria câmera: a foto tirada por ela é sempre de agora.
   Limite conhecido: ninguém impede fotografar, hoje, uma foto antiga impressa ou mostrada em outra tela. */
(function () {
  const R = MQ.regras;
  const FORMS = ['diag', 'visita-feita', 'aval'];   // diagnóstico, registro de visita e avaliação final
  const formDoQuintal = el => { const f = el && el.closest && el.closest('form[data-form]'); return f && FORMS.includes(f.dataset.form) ? f : null; };
  const diaDaVisita = form => { const i = form && form.querySelector('input[name="data_visita"], input[name="data_realizada"]'); return (i && i.value) || R.hoje(); };
  const hojeLocal = () => R.hoje();

  /* data em que a foto foi tirada, lida do EXIF de um JPEG: DateTimeOriginal (0x9003), senão DateTimeDigitized (0x9004),
     senão DateTime (0x0132). Devolve 'AAAA-MM-DD' ou null (sem EXIF, HEIC, PNG, arquivo estranho). Nunca lança erro. */
  async function lerDataExif(arquivo) {
    try {
      const buf = await arquivo.slice(0, 256 * 1024).arrayBuffer(); const v = new DataView(buf);
      if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
      let p = 2;
      while (p + 4 <= v.byteLength) {
        if (v.getUint8(p) !== 0xFF) return null;
        const marca = v.getUint8(p + 1), tam = v.getUint16(p + 2);
        if (marca === 0xE1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966) return lerTiff(v, p + 10, Math.min(v.byteLength, p + 2 + tam));
        if (marca === 0xDA || marca === 0xD9) return null;
        p += 2 + tam;
      }
      return null;
    } catch (e) { return null; }
  }
  function lerTiff(v, t, fim) {
    const le = v.getUint16(t) === 0x4949; const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
    if (u16(t + 2) !== 42) return null;
    const ifd = off => { const base = t + off; if (base + 2 > fim) return []; const n = u16(base); const l = [];
      for (let i = 0; i < n; i++) { const e = base + 2 + i * 12; if (e + 12 > fim) break; l.push({ tag: u16(e), tipo: u16(e + 2), qtd: u32(e + 4), val: u32(e + 8), e }); } return l; };
    const texto = x => { if (!x || x.tipo !== 2 || x.qtd < 19) return null; const o = x.qtd > 4 ? t + x.val : x.e + 8; if (o + 19 > fim) return null;
      let s = ''; for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };
    const ifd0 = ifd(u32(t + 4)); const ptr = ifd0.find(x => x.tag === 0x8769);
    const exif = ptr ? ifd(ptr.val) : [];
    const bruto = texto(exif.find(x => x.tag === 0x9003)) || texto(exif.find(x => x.tag === 0x9004)) || texto(ifd0.find(x => x.tag === 0x0132));
    const m = /^(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}$/.exec(bruto || '');
    if (!m || m[1] === '0000') return null;
    return m[1] + '-' + m[2] + '-' + m[3];
  }

  /* regra: devolve null (vale) ou a mensagem que explica por que não vale */
  const MSG_SEM_DATA = 'Não deu para confirmar quando esta foto foi tirada (foto da galeria encaminhada pelo WhatsApp, captura de tela ou imagem baixada). Tire a foto agora.';
  function conferir(diaFoto, diaVisita) {
    if (!diaFoto) return MSG_SEM_DATA;
    if (diaFoto > hojeLocal()) return 'A data desta foto está no futuro (' + R.fmtData(diaFoto) + '). Confira a data do celular e tire a foto de novo.';
    if (diaFoto !== diaVisita) return 'Esta foto é de ' + R.fmtData(diaFoto) + ' e a visita é de ' + R.fmtData(diaVisita) + '. Só vale foto tirada no dia da visita: tire a foto de novo ou corrija a data da visita.';
    return null;
  }

  /* chamada por campo.js antes de preparar a foto. Devolve { ok, dia, msg, semData } */
  async function checar(inp) {
    const form = formDoQuintal(inp); if (!form) return { ok: true };
    const arq = inp.files && inp.files[0]; if (!arq) return { ok: false, msg: MSG_SEM_DATA, semData: true };
    const daCamera = inp.dataset.camApp === '1' && arq.name && /^quintal_\d+\.jpg$/.test(arq.name);
    delete inp.dataset.camApp;   // vale uma vez só: a próxima escolha de arquivo é conferida de novo
    const dia = daCamera ? hojeLocal() : await lerDataExif(arq);
    const msg = conferir(dia, diaDaVisita(form));
    if (msg) { delete inp.dataset.diaFoto; return { ok: false, msg, semData: !dia }; }
    inp.dataset.diaFoto = dia; return { ok: true, dia };
  }

  /* câmera do próprio sistema (traseira): a foto é tirada agora, não vem de arquivo guardado */
  async function abrirCamera(inp) {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { MQ.ui.toast('Este navegador não abre a câmera pelo sistema. Use o Chrome (Android) ou o Safari (iPhone) atualizados.'); return; }
    let fluxo;
    try { fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false }); }
    catch (e) { MQ.ui.toast('Não foi possível abrir a câmera. Permita o uso da câmera para este site nas configurações do navegador e tente de novo.'); return; }
    const j = document.createElement('div'); j.className = 'cam-janela'; j.setAttribute('role', 'dialog'); j.setAttribute('aria-modal', 'true'); j.setAttribute('aria-label', 'Tirar foto do quintal');
    j.innerHTML = '<div class="cam-caixa cam-quintal"><video autoplay playsinline muted></video><p class="small muted">Enquadre e toque em Tirar foto. A foto fica com a data e a hora de agora.</p><div class="acoes"><button type="button" class="btn pri" data-cam="tirar">Tirar foto</button><button type="button" class="btn" data-cam="cancelar">Cancelar</button></div></div>';
    const video = j.querySelector('video'); video.srcObject = fluxo; document.body.appendChild(j); j.querySelector('[data-cam=tirar]').focus();
    const fechar = () => { fluxo.getTracks().forEach(t => t.stop()); j.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = ev => { if (ev.key === 'Escape') fechar(); }; document.addEventListener('keydown', tecla);
    j.addEventListener('click', ev => {
      const b = ev.target.closest('[data-cam]'); if (!b) { if (ev.target === j) fechar(); return; }
      if (b.dataset.cam === 'cancelar') { fechar(); return; }
      if (!video.videoWidth) return;
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0);
      b.disabled = true; b.textContent = 'Preparando…';
      c.toBlob(blob => {
        fechar(); if (!blob) { MQ.ui.toast('A foto não saiu. Tente de novo.'); return; }
        try {
          const dt = new DataTransfer(); dt.items.add(new File([blob], 'quintal_' + Date.now() + '.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
          inp.files = dt.files; inp.dataset.camApp = '1';
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) { MQ.ui.toast('Este navegador não deixa usar a foto da câmera do sistema. Atualize o navegador.'); }
      }, 'image/jpeg', 0.9);
    });
  }

  /* botão "Tirar foto agora" (aparece embaixo do campo quando a foto foi recusada) */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-acao="foto-agora"]'); if (!b) return;
      const inp = document.getElementById(b.dataset.alvo); if (inp) abrirCamera(inp);
    });
    /* na hora de enviar: foto escolhida antes de a data da visita mudar também tem de ser do dia da visita */
    document.addEventListener('submit', ev => {
      const form = ev.target; if (!form || !form.matches || !FORMS.some(f => form.matches('form[data-form="' + f + '"]'))) return;
      const dia = diaDaVisita(form);
      const errada = [...form.querySelectorAll('input[type=file]')].find(i => i.files && i.files.length && i.dataset.diaFoto && i.dataset.diaFoto !== dia);
      if (!errada) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const box = form.querySelector('[data-erro]');
      const msg = 'Há foto de ' + R.fmtData(errada.dataset.diaFoto) + ', mas a visita está com a data de ' + R.fmtData(dia) + '. Só vale foto tirada no dia da visita: corrija a data ou tire a foto de novo.';
      if (box) { box.textContent = msg; box.hidden = false; box.scrollIntoView && box.scrollIntoView({ block: 'center' }); } else MQ.ui.toast(msg);
    }, true);
  }

  MQ.fotoDia = { lerDataExif, conferir, checar, abrirCamera, MSG_SEM_DATA };
})();
