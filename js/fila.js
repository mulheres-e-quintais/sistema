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

  /* 47: o que a pessoa MUDOU em relação ao registro que ela leu (lista de campos). Num conflito, a tela mostra o registro
     como está no servidor e, por cima, só estes campos: dado velho não volta por cima de dado novo. */
  MQ.camposMudados = (dados, base, jaMudados) => {
    const fora = /^(_|atualizado_em$|criado_em$)/; const m = new Set(jaMudados || []);
    Object.keys(dados || {}).forEach(k => { if (fora.test(k)) return;
      if (!base || JSON.stringify(dados[k] == null ? null : dados[k]) !== JSON.stringify(base[k] == null ? null : base[k])) m.add(k); });
    return [...m];
  };
  /* o registro como a tela deve mostrar: servidor + fila. Em conflito, só os campos mudados vêm da fila. */
  MQ.juntarFila = (base, it) => {
    if (!(it.conflito && base && it.mud)) return Object.assign({}, base || {}, it.dados);
    const r = Object.assign({}, base); it.mud.forEach(k => { if (k in it.dados) r[k] = it.dados[k]; }); return r;
  };
  /* marca para o envio: a do item que já está na fila (edição sobre edição, ainda não enviada) ou o atualizado_em do registro lido.
     "vista" = as listas como estavam quando o formulário abriu; "agora" = as de agora. */
  MQ.marcaDe = (tipo, id, vista, agora) => {
    const lista = { ficha: 'fichas', visita: 'visitas', diagnostico: 'diagnosticos', avaliacao: 'avaliacoes' }[tipo];
    const doTipo = i => i.id === id && (i.tipo || 'ficha') === tipo;
    const reg = b => ((b && b[lista]) || []).find(x => x.id === id);
    const it = ((vista && vista.fila) || []).find(doTipo);
    if (it && !it.conflito && 'marca' in it) {
      if (it.marca) return it.marca;
      // era registro novo na fila; se já foi enviado enquanto o formulário estava aberto, vale a marca do que subiu
      const subiu = !((agora && agora.fila) || []).some(doTipo) && reg(agora);
      return subiu ? subiu.atualizado_em || null : null;
    }
    const r = reg(vista); return r ? r.atualizado_em || null : null;
  };

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
            // 47: a marca (versão do registro que a pessoa leu) vai junto; se o registro mudou no servidor, o envio é recusado
            const op = { marca: it.marca || null };
            if (it.tipo === 'visita') await api.salvarVisita(it.dados, it.fotos || {}, op);
            else if (it.tipo === 'diagnostico') await api.salvarDiagnostico(it.dados, it.fotos || {}, op);
            else if (it.tipo === 'avaliacao') await api.salvarAvaliacao(it.dados, it.fotos || {}, op);
            else await api.salvarFicha(it.dados, it.fotos || {}, op);
            await F.remover(it.id); enviados++;
          } catch (e) {
            if (e.semRede) break;
            it.erro = (MQ.regras && MQ.regras.mensagemErro ? MQ.regras.mensagemErro(e) : e.message) || 'Não foi possível enviar. Tente de novo.'; it.reenviar = false;   // mensagem já traduzida, não o texto cru do servidor
            // recusado porque outra pessoa alterou: o item NÃO é descartado (o que foi digitado fica); a tela reabre com o dado novo e só o que ela mudou
            it.conflito = !!(MQ.regras && MQ.regras.ehConflito && (MQ.regras.ehConflito(e) || MQ.regras.ehConflito(it.erro)));
            await F.salvar(it);
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

  /* ---------- o arquivo é o que o nome diz? (confere pelo CONTEÚDO, não pela extensão nem pelo tipo que o navegador informa) ----------
     Cada tipo de arquivo começa sempre com os mesmos bytes (a "assinatura"): PDF "%PDF-", JPEG FF D8 FF, PNG 89 50 4E 47,
     Word/Excel novos e LibreOffice "PK" (são um zip), Word/Excel antigos D0 CF 11 E0. HTML ou programa renomeado para .pdf não passa.
     MQ.arquivoConfere(arquivo, extensõesAceitas) devolve '' quando está certo, ou a mensagem para a tela. */
  const FAMILIA = { pdf: 'pdf', jpg: 'jpg', jpeg: 'jpg', png: 'png', webp: 'webp', heic: 'heic', heif: 'heic', docx: 'zip', xlsx: 'zip', odt: 'zip', ods: 'zip', doc: 'ole', xls: 'ole' };
  const NOME_TIPO = { pdf: ['um PDF', 'Gere o PDF de novo.'], jpg: ['uma foto', 'Tire a foto de novo ou escolha outra imagem.'], png: ['uma foto', 'Tire a foto de novo ou escolha outra imagem.'],
    webp: ['uma foto', 'Tire a foto de novo ou escolha outra imagem.'], heic: ['uma foto', 'Tire a foto de novo ou escolha outra imagem.'],
    docx: ['um documento do Word', 'Salve o documento de novo.'], doc: ['um documento do Word', 'Salve o documento de novo.'], odt: ['um documento de texto', 'Salve o documento de novo.'],
    xlsx: ['uma planilha', 'Salve a planilha de novo.'], xls: ['uma planilha', 'Salve a planilha de novo.'], ods: ['uma planilha', 'Salve a planilha de novo.'] };
  const extDe = nome => { const p = String(nome || '').toLowerCase().split('.'); return p.length > 1 ? p.pop() : ''; };
  /* família do conteúdo pelos primeiros bytes: 'pdf', 'jpg', 'png', 'webp', 'heic', 'zip', 'ole' ou '' (não reconhecido) */
  MQ.assinaturaDe = bytes => {
    const b = bytes || []; const eh = (...x) => x.every((v, i) => b[i] === v); const t = (i, n) => String.fromCharCode(...Array.from(b).slice(i, i + n));
    if (t(0, 5) === '%PDF-') return 'pdf';
    if (eh(0xFF, 0xD8, 0xFF)) return 'jpg';
    if (eh(0x89, 0x50, 0x4E, 0x47)) return 'png';
    if (eh(0x50, 0x4B, 0x03, 0x04)) return 'zip';
    if (eh(0xD0, 0xCF, 0x11, 0xE0)) return 'ole';
    if (t(0, 4) === 'RIFF' && t(8, 4) === 'WEBP') return 'webp';
    if (t(4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(t(8, 4))) return 'heic';
    return '';
  };
  MQ.MSG_ARQ_VAZIO = 'O arquivo está vazio. Escolha outro.';
  MQ.msgArquivoFalso = ext => { const n = NOME_TIPO[ext] || ['do tipo que o nome diz', 'Escolha outro arquivo.']; return 'Este arquivo não é ' + n[0] + ' de verdade (ou está corrompido). ' + n[1]; };
  MQ.arquivoConfere = async function (arquivo, aceitos, op) {
    op = op || {};
    if (!arquivo || !arquivo.name) return 'Escolha o arquivo.';
    const ext = extDe(arquivo.name); const lista = (aceitos || Object.keys(FAMILIA)).map(x => String(x).toLowerCase().replace(/^\./, ''));
    if (!lista.includes(ext) || !FAMILIA[ext]) return 'Tipo de arquivo não aceito. Use ' + (op.rotulo || 'PDF ou foto (JPG, PNG)') + '.';
    if (!(arquivo.size > 0)) return MQ.MSG_ARQ_VAZIO;
    let bytes;
    try { bytes = new Uint8Array(await arquivo.slice(0, 1024).arrayBuffer()); } catch (e) { return 'Não foi possível ler o arquivo. Escolha de novo.'; }
    let fam = MQ.assinaturaDe(bytes); const quer = FAMILIA[ext];
    const txt = String.fromCharCode(...Array.from(bytes)); const FOTO = ['jpg', 'png', 'webp', 'heic'];
    // tolerâncias para arquivo legítimo: PDF de scanner/impressora com bytes antes de "%PDF-"; foto com a extensão trocada
    // (PNG chamado .jpg); .doc salvo como RTF; .xls/.doc que na verdade é o formato novo (zip)
    if (!fam && quer === 'pdf' && txt.indexOf('%PDF-') > 0) fam = 'pdf';
    if (FOTO.includes(quer) && FOTO.includes(fam)) return '';
    if (quer === 'ole' && (fam === 'zip' || (ext === 'doc' && /^\s*\{\\rtf/.test(txt)))) return '';
    return fam === quer ? '' : MQ.msgArquivoFalso(ext);
  };

  MQ.novoId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
})();
