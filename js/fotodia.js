/* Mulheres & Quintais — foto do quintal tem de ser do DIA DA VISITA (12/10/2026).
   Para não aceitar foto antiga guardada no celular (galeria, WhatsApp), a foto escolhida passa por esta conferência:
   - a data em que a foto foi TIRADA vem de dentro do arquivo (EXIF, gravado pela câmera do celular);
   - a foto só vale se essa data for o dia da visita informado no formulário;
   - sem data dentro do arquivo (foto encaminhada pelo WhatsApp, captura de tela, imagem baixada), a foto é recusada
     e o sistema oferece a própria câmera: a foto tirada por ela é sempre de agora.
   - visita que passa da meia-noite: vale também foto do dia seguinte tirada até as 4h da manhã;
   - foto recusada não apaga a foto boa que já estava no campo;
   - as fotos escolhidas ficam guardadas NESTE aparelho (IndexedDB) até o formulário ser salvo: se o sistema sair
     sozinho (15 minutos sem uso) ou o celular fechar a página, elas voltam ao abrir o mesmo formulário. Saem do
     aparelho ao salvar, ao sair da conta pelo botão Sair e depois de 3 dias;
   - a data de cada foto vai junto com o registro guardado sem internet, e é conferida de novo ao corrigir e salvar.
   Limite conhecido: ninguém impede fotografar, hoje, uma foto antiga impressa ou mostrada em outra tela. */
(function () {
  const R = MQ.regras;
  const FORMS = ['diag', 'visita-feita', 'aval'];   // diagnóstico, registro de visita e avaliação final
  const formDoQuintal = el => { const f = el && el.closest && el.closest('form[data-form]'); return f && FORMS.includes(f.dataset.form) ? f : null; };
  const diaDaVisita = form => { const i = form && form.querySelector('input[name="data_visita"], input[name="data_realizada"]'); return (i && i.value) || R.hoje(); };
  const hojeLocal = () => R.hoje();

  /* momento em que a foto foi tirada, lido do EXIF: DateTimeOriginal (0x9003), senão DateTimeDigitized (0x9004),
     senão DateTime (0x0132). Devolve { dia: 'AAAA-MM-DD', hora: 0..23 } ou null. Nunca lança erro.
     JPEG: segmento APP1 "Exif". HEIC (iPhone), PNG e WebP guardam o mesmo bloco TIFF em outro lugar do arquivo:
     procura o cabeçalho TIFF ("II*\0" ou "MM\0*") no começo do arquivo e, se não achar, no arquivo inteiro. */
  async function lerMomentoExif(arquivo) {
    try {
      const ini = await arquivo.slice(0, 512 * 1024).arrayBuffer(); const v = new DataView(ini);
      if (v.byteLength >= 4 && v.getUint16(0) === 0xFFD8) {
        let p = 2;
        while (p + 4 <= v.byteLength) {
          if (v.getUint8(p) !== 0xFF) break;
          const marca = v.getUint8(p + 1), tam = v.getUint16(p + 2);
          if (marca === 0xE1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966) { const r = lerTiff(v, p + 10, Math.min(v.byteLength, p + 2 + tam)); if (r) return r; break; }
          if (marca === 0xDA || marca === 0xD9) break;
          p += 2 + tam;
        }
        return null;   // JPEG sem EXIF (WhatsApp, captura de tela): não adianta procurar no resto
      }
      const r = procurarTiff(v); if (r || arquivo.size <= ini.byteLength) return r;
      return procurarTiff(new DataView(await arquivo.slice(0, 16 * 1024 * 1024).arrayBuffer()));
    } catch (e) { return null; }
  }
  async function lerDataExif(arquivo) { const m = await lerMomentoExif(arquivo); return m ? m.dia : null; }
  function procurarTiff(v) {
    const n = v.byteLength - 8;
    for (let i = 0; i < n; i++) {
      const a = v.getUint8(i);
      if ((a === 0x49 && v.getUint8(i + 1) === 0x49 && v.getUint8(i + 2) === 0x2A && v.getUint8(i + 3) === 0)
        || (a === 0x4D && v.getUint8(i + 1) === 0x4D && v.getUint8(i + 2) === 0 && v.getUint8(i + 3) === 0x2A)) {
        let r = null; try { r = lerTiff(v, i, v.byteLength); } catch (e) { r = null; }
        if (r) return r;
      }
    }
    return null;
  }
  function lerTiff(v, t, fim) {
    if (t + 8 > fim) return null;
    const le = v.getUint16(t) === 0x4949; const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
    if (u16(t + 2) !== 42) return null;
    const ifd = off => { const base = t + off; if (off < 8 || base + 2 > fim) return []; const n = u16(base); const l = [];
      for (let i = 0; i < n && i < 500; i++) { const e = base + 2 + i * 12; if (e + 12 > fim) break; l.push({ tag: u16(e), tipo: u16(e + 2), qtd: u32(e + 4), val: u32(e + 8), e }); } return l; };
    const texto = x => { if (!x || x.tipo !== 2 || x.qtd < 19) return null; const o = x.qtd > 4 ? t + x.val : x.e + 8; if (o + 19 > fim) return null;
      let s = ''; for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };
    const ifd0 = ifd(u32(t + 4)); const ptr = ifd0.find(x => x.tag === 0x8769);
    const exif = ptr ? ifd(ptr.val) : [];
    const bruto = texto(exif.find(x => x.tag === 0x9003)) || texto(exif.find(x => x.tag === 0x9004)) || texto(ifd0.find(x => x.tag === 0x0132));
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):\d{2}:\d{2}$/.exec(bruto || '');
    if (!m || m[1] === '0000') return null;
    return { dia: m[1] + '-' + m[2] + '-' + m[3], hora: +m[4] };
  }

  /* regra: devolve null (vale) ou a mensagem que explica por que não vale */
  const MSG_SEM_DATA = 'Não deu para confirmar quando esta foto foi tirada (foto da galeria encaminhada pelo WhatsApp, captura de tela ou imagem baixada). Tire a foto agora.';
  const HORA_MADRUGADA = 4;   // visita que passou da meia-noite: foto do dia seguinte até as 4h ainda é da visita
  const diaSeguinte = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  function conferir(diaFoto, diaVisita, hora) {
    if (!diaFoto) return MSG_SEM_DATA;
    if (diaFoto > hojeLocal()) return 'A data desta foto está no futuro (' + R.fmtData(diaFoto) + '). Confira a data do celular e tire a foto de novo.';
    if (diaFoto === diaSeguinte(diaVisita) && hora != null && hora < HORA_MADRUGADA) return null;
    if (diaFoto !== diaVisita) return 'Esta foto é de ' + R.fmtData(diaFoto) + ' e a visita é de ' + R.fmtData(diaVisita) + '. Só vale foto tirada no dia da visita: tire a foto de novo ou corrija a data da visita.';
    return null;
  }

  /* chamada por campo.js antes de preparar a foto. Devolve { ok, dia, msg, semData } */
  async function checar(inp) {
    const form = formDoQuintal(inp); if (!form) return { ok: true };
    const arq = inp.files && inp.files[0]; if (!arq) return { ok: false, msg: MSG_SEM_DATA, semData: true };
    const daCamera = inp.dataset.camApp === '1' && arq.name && /^quintal_\d+\.jpg$/.test(arq.name);
    delete inp.dataset.camApp;   // vale uma vez só: a próxima escolha de arquivo é conferida de novo
    const m = daCamera ? { dia: hojeLocal(), hora: new Date().getHours() } : await lerMomentoExif(arq);
    const dia = m && m.dia, hora = m ? m.hora : null;
    const msg = conferir(dia, diaDaVisita(form), hora);
    if (msg) { delete inp.dataset.diaFoto; delete inp.dataset.horaFoto; return { ok: false, msg, semData: !dia }; }
    inp.dataset.diaFoto = dia; inp.dataset.horaFoto = hora == null ? '' : String(hora); return { ok: true, dia, hora };
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
    /* na hora de enviar: toda foto do formulário (escolhida agora, recuperada deste aparelho ou que voltou da fila
       sem internet) tem de ser do dia da visita, mesmo que a data da visita tenha mudado depois */
    document.addEventListener('submit', ev => {
      const form = ev.target; if (!form || !form.matches || !formDoQuintal(form)) return;
      const ruim = fotoForaDoDia(form); if (!ruim) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const box = form.querySelector('[data-erro]');
      const msg = 'Há foto de ' + R.fmtData(ruim.dia) + ', mas a visita está com a data de ' + R.fmtData(diaDaVisita(form)) + '. Só vale foto tirada no dia da visita: corrija a data ou tire a foto de novo.';
      if (box) { box.textContent = msg; box.hidden = false; box.scrollIntoView && box.scrollIntoView({ block: 'center' }); } else MQ.ui.toast(msg);
    }, true);
  }

  /* ---------- fotos do formulário aberto: data de cada uma e cópia guardada no aparelho ----------
     Cada tela registra o seu "mapa" de fotos (campo → foto pronta). A chave do formulário é estável entre aberturas:
     diagnóstico e avaliação pela mulher (ficha), registro de visita feita pela visita. */
  const mapas = {};   // nome do form → { mapa, dica(campo) → elemento, depois(form) }
  const dias = {};    // chave do form → { campo: { dia, hora } }
  const chaveDe = form => form.dataset.form + ':' + (form.dataset.form === 'visita-feita' ? form.dataset.id : (form.dataset.ficha || form.dataset.id));
  const chaveDoRegistro = (tipo, d) => tipo === 'diagnostico' ? 'diag:' + d.ficha_id : tipo === 'avaliacao' ? 'aval:' + d.ficha_id : tipo === 'visita' ? 'visita-feita:' + d.id : null;
  const campoDe = inp => inp.dataset.foto || inp.dataset.fotoVis || inp.dataset.fotoAv || null;
  function registrarMapa(nome, mapa, dica, depois) { mapas[nome] = { mapa, dica, depois }; }
  function fotoForaDoDia(form) {
    const m = mapas[form.dataset.form]; if (!m) return null;
    const visita = diaDaVisita(form), reg = dias[chaveDe(form)] || {};
    for (const campo of Object.keys(m.mapa)) {
      const info = m.mapa[campo] && reg[campo];
      if (info && conferir(info.dia, visita, info.hora)) return info;   // foto sem data registrada: veio de antes desta regra (fila antiga) e passa
    }
    return null;
  }
  /* datas das fotos que vão para a fila sem internet, e de volta ao abrir o registro da fila */
  function diasDe(tipo, dados, fotos) {
    const reg = dias[chaveDoRegistro(tipo, dados || {})] || {}; const r = {};
    Object.keys(fotos || {}).forEach(c => { if (reg[c]) r[c] = reg[c]; });
    return Object.keys(r).length ? r : null;
  }
  function marcarDias(tipo, dados, fd) { const k = chaveDoRegistro(tipo, dados || {}); if (k) dias[k] = Object.assign({}, fd || {}); }

  /* cópia no aparelho (IndexedDB "mq-fotos-rascunho"): sem IndexedDB (navegação privada antiga) segue sem cópia */
  const BD = 'mq-fotos-rascunho', LOJA = 'fotos', VALIDADE = 3 * 24 * 60 * 60 * 1000;
  let bdP = null;
  function abrirBD() {
    if (bdP) return bdP;
    bdP = new Promise(res => {
      try {
        if (typeof indexedDB === 'undefined' || !indexedDB) return res(null);
        const r = indexedDB.open(BD, 1);
        r.onupgradeneeded = () => { const os = r.result.createObjectStore(LOJA, { keyPath: 'id' }); os.createIndex('chave', 'chave'); };
        r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return bdP;
  }
  async function op(modo, fn) {
    const db = await abrirBD(); if (!db) return null;
    return new Promise(res => {
      try { const t = db.transaction(LOJA, modo); const os = t.objectStore(LOJA); let out = null;
        const r = fn(os); if (r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => res(out); t.onerror = () => res(null); t.onabort = () => res(null);
      } catch (e) { res(null); }
    });
  }
  const dono = () => { const S = MQ.ui && MQ.ui.S; return (S && S.eu && S.eu.id) || ''; };
  /* chamada por campo.js quando a foto ficou pronta: registra a data e guarda a cópia */
  async function aceitar(inp, blob) {
    const form = formDoQuintal(inp), campo = campoDe(inp); if (!form || !campo) return;
    const k = chaveDe(form); const info = { dia: inp.dataset.diaFoto || null, hora: inp.dataset.horaFoto === '' || inp.dataset.horaFoto == null ? null : +inp.dataset.horaFoto };
    if (info.dia) (dias[k] = dias[k] || {})[campo] = info;
    const d = dono(); if (!d || !blob) return;
    await op('readwrite', os => os.put({ id: d + '|' + k + '|' + campo, dono: d, chave: d + '|' + k, campo, blob, dia: info.dia, hora: info.hora, em: Date.now() }));
  }
  async function guardadas(k) {
    const d = dono(); if (!d) return [];
    const l = await op('readonly', os => os.index('chave').getAll(d + '|' + k)) || [];
    return l.filter(x => x && x.blob && Date.now() - x.em < VALIDADE);
  }
  /* depois de salvar (enviado ou na fila): a cópia não é mais necessária */
  async function limparRegistro(tipo, dados) {
    const k = chaveDoRegistro(tipo, dados || {}); if (!k) return; delete dias[k];
    const l = await guardadas(k); if (!l.length) return;
    await op('readwrite', os => { l.forEach(x => os.delete(x.id)); return null; });
  }
  /* saiu da conta pelo botão Sair (LGPD) ou cópia vencida: apaga */
  async function limparAparelho(tudo) {
    Object.keys(dias).forEach(k => delete dias[k]);
    await op('readwrite', os => { const r = os.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return;
      if (tudo || !c.value || Date.now() - c.value.em >= VALIDADE) c.delete(); c.continue(); }; return null; });
  }
  /* o formulário apareceu na tela: as fotos guardadas deste formulário voltam (as mais novas valem sobre as da fila) */
  const vistos = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  async function recuperar(form) {
    if (!vistos || vistos.has(form)) return; vistos.add(form);
    const m = mapas[form.dataset.form]; if (!m) return;
    const k = chaveDe(form); const l = await guardadas(k); if (!l.length || !form.isConnected) return;
    l.forEach(x => {
      m.mapa[x.campo] = x.blob; if (x.dia) (dias[k] = dias[k] || {})[x.campo] = { dia: x.dia, hora: x.hora };
      const dica = m.dica(x.campo, form);
      if (dica) { dica.classList.remove('erro-foto'); dica.textContent = 'Foto recuperada deste aparelho' + (x.dia ? ' (tirada em ' + R.fmtData(x.dia) + ')' : '') + '. Confira e salve.'; }
    });
    if (m.depois) m.depois(form);
  }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && document.documentElement) {
    new MutationObserver(() => { FORMS.forEach(n => document.querySelectorAll('form[data-form="' + n + '"]').forEach(f => { recuperar(f); })); })
      .observe(document.documentElement, { childList: true, subtree: true });
    limparAparelho(false);
  }

  /* auditoria 2 (12/10/2026): a foto leva 1 a 2 s para ficar pronta. Se nesse meio-tempo a pessoa fechou o formulário
     e abriu o de outra mulher, a foto NÃO pode cair no formulário novo. aindaAberto(chave) diz se o formulário que
     pediu a foto continua na tela (a foto fica guardada como cópia dele e volta quando ele for aberto de novo). */
  function chaveDoInput(inp) { const f = formDoQuintal(inp); return f ? chaveDe(f) : null; }
  function aindaAberto(chave) {
    if (!chave || typeof document === 'undefined') return true;
    const nome = chave.split(':')[0];
    return [...document.querySelectorAll('form[data-form="' + nome + '"]')].some(f => chaveDe(f) === chave);
  }
  /* registro que volta da fila em conflito: as fotos dele vão para a cópia do aparelho antes de ele sair da fila */
  async function guardarCopia(tipo, dados, fotos, fd) {
    const k = chaveDoRegistro(tipo, dados || {}); const d = dono(); if (!k || !d || !fotos) return;
    for (const campo of Object.keys(fotos)) { const blob = fotos[campo]; if (!blob) continue; const info = (fd || {})[campo] || {};
      await op('readwrite', os => os.put({ id: d + '|' + k + '|' + campo, dono: d, chave: d + '|' + k, campo, blob, dia: info.dia || null, hora: info.hora == null ? null : info.hora, em: Date.now() })); }
  }
  const fotosDoForm = nome => Object.keys((mapas[nome] || {}).mapa || {}).filter(k => mapas[nome].mapa[k]);   // quais campos do formulário aberto têm foto (para conferência e testes)
  MQ.fotoDia = { fotosDoForm, chaveDoInput, aindaAberto, guardarCopia, lerDataExif, lerMomentoExif, conferir, checar, abrirCamera, MSG_SEM_DATA, registrarMapa, aceitar, diasDe, marcarDias, limparRegistro, limparAparelho, fotoForaDoDia, chaveDe, recuperar };
})();
