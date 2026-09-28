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
    if (!db) return fn(null);
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
      item.criado = item.criado || Date.now();
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
            await api.salvarFicha(it.dados, it.fotos || {});
            await F.remover(it.id); enviados++;
          } catch (e) {
            if (e.semRede) break;
            it.erro = e.message; it.reenviar = false; await F.salvar(it);
          }
        }
      } finally { F.enviando = false; }
      return { enviados };
    }
  });

  /* Reduz a foto antes de guardar: papel fotografado em 1600px continua legível e ocupa ~300 KB */
  MQ.comprimirFoto = function (arquivo, max = 1600, qualidade = 0.8) {
    return new Promise(res => {
      if (!arquivo || !/^image\//.test(arquivo.type)) return res(arquivo);
      const img = new Image(); const url = URL.createObjectURL(arquivo);
      img.onload = () => {
        const esc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => res(b && b.size < arquivo.size ? b : arquivo), 'image/jpeg', qualidade);
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(arquivo); };
      img.src = url;
    });
  };

  MQ.novoId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
})();
