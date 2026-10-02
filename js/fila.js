/* Fila de envio: guarda no aparelho o que foi preenchido sem internet e envia depois.
   Usa IndexedDB (aguenta fotos); se o navegador não permitir, guarda só na memória. */
(function () {
  const BANCO = 'mulheres-quintais', LOJA = 'fila';
  let dbp = null, memoria = new Map();

  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise(res => {
      try {
        const req = indexedDB.open(BANCO, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'id' });
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  async function tx(modo, fn) {
    const db = await abrir();
    if (!db) { const r = fn(null); return r && typeof r === 'object' && 'result' in r ? r.result : r; }
    return new Promise((res, rej) => {
      const t = db.transaction(LOJA, modo); const loja = t.objectStore(LOJA);
      const r = fn(loja);
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : r);
      t.onerror = () => rej(t.error);
    });
  }

  const F = (MQ.fila = {
    async listar(dono) {
      const todos = await tx('readonly', l => l ? l.getAll() : { result: [...memoria.values()] });
      return (todos || []).filter(x => !dono || x.dono === dono).sort((a, b) => a.criado - b.criado);
    },
    async salvar(item) {
      // regravar (corrigir um item que já estava na fila) mantém a data original: a ordem de envio não muda
      if (!item.criado) { const antes = await tx('readonly', l => l ? l.get(item.id) : { result: memoria.get(item.id) }); item.criado = (antes && antes.criado) || Date.now(); }
      await tx('readwrite', l => { if (l) l.put(item); else memoria.set(item.id, item); });
      return item;
    },
    async remover(id) { await tx('readwrite', l => { if (l) l.delete(id); else memoria.delete(id); }); },

    /* Envia o que estiver pendente. Erros de regra ficam marcados no item para a bolsista corrigir;
       falta de rede só deixa para depois. */
    enviando: false,
    async sincronizar(api, dono) {
      if (F.enviando) return { enviados: 0 };
      F.enviando = true; let enviados = 0;
      try {
        for (const it of await F.listar(dono)) {
          if (it.erro && !it.reenviar) continue;
          try {
            if (it.tipo === 'visita') await api.salvarVisita(it.dados, it.fotos || {});
            else if (it.tipo === 'diagnostico') await api.salvarDiagnostico(it.dados, it.fotos || {});
            else if (it.tipo === 'avaliacao') await api.salvarAvaliacao(it.dados, it.fotos || {});
            else await api.salvarFicha(it.dados, it.fotos || {});
            await F.remover(it.id); enviados++;
          } catch (e) {
            if (e.semRede) break;
            it.erro = (MQ.regras && MQ.regras.mensagemErro ? MQ.regras.mensagemErro(e) : e.message) || 'Não foi possível enviar. Tente de novo.'; it.reenviar = false; await F.salvar(it);   // mensagem já traduzida, não o texto cru do servidor
          }
        }
      } finally { F.enviando = false; }
      return { enviados };
    }
  });

  /* Reduz a foto antes de guardar: papel fotografado em 1600px continua legível e ocupa ~300 KB.
     Só aceita foto de verdade: tipo de imagem (JPEG, PNG, WebP, HEIC), tamanho maior que zero e que o navegador consiga abrir.
     Arquivo que não é foto (txt renomeado para .png, vazio, .exe) é RECUSADO: a promessa falha com a mensagem para a tela. */
  MQ.MSG_NAO_E_FOTO = 'Este arquivo não é uma foto. Tire a foto de novo ou escolha outra imagem.';
  const TIPO_FOTO = /^image\/(jpeg|png|webp|heic|heif)$/i;
  MQ.fotoValida = arquivo => !!(arquivo && TIPO_FOTO.test(String(arquivo.type || '')) && arquivo.size > 0);
  // HEIC de verdade (iPhone) que este navegador não sabe abrir: confere a assinatura do arquivo ("ftyp" + marca) antes de aceitar o original
  async function ehHeic(arquivo) {
    try { const b = new Uint8Array(await arquivo.slice(0, 12).arrayBuffer()); const t = String.fromCharCode(...b);
      return t.slice(4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(t.slice(8, 12)); } catch (e) { return false; }
  }
  MQ.comprimirFoto = function (arquivo, max = 1600, qualidade = 0.8, op) {
    return new Promise((res, rej) => {
      const recusar = () => { const e = new Error(MQ.MSG_NAO_E_FOTO); e.naoEhFoto = true;
        if (!(op && op.semAviso) && MQ.ui && MQ.ui.toast) { try { MQ.ui.toast(e.message); } catch (x) { /* sem tela */ } }
        rej(e); };
      if (!MQ.fotoValida(arquivo)) return recusar();
      let url; const soltar = () => { try { URL.revokeObjectURL(url); } catch (e) { /* nada */ } };
      try {
        const img = new Image(); url = URL.createObjectURL(arquivo);
        img.onload = () => {
          try {
            if (!(img.width > 0 && img.height > 0)) { soltar(); return recusar(); }
            const esc = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            soltar();
            c.toBlob(b => { if (!b || !(b.size > 0)) return recusar(); res(b.size < arquivo.size ? b : arquivo); }, 'image/jpeg', qualidade);
          } catch (e) { soltar(); recusar(); }
        };
        img.onerror = () => { soltar();
          if (/hei[cf]$/i.test(arquivo.type)) ehHeic(arquivo).then(ok => ok ? res(arquivo) : recusar()); else recusar(); };
        img.src = url;
      } catch (e) { soltar(); recusar(); }
    });
  };

  MQ.novoId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
})();
