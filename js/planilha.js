/* Mulheres & Quintais — leitor de planilha (.xlsx e .csv) sem biblioteca externa (30/09/2026).
   O .xlsx é um zip com XML dentro: o navegador descompacta (DecompressionStream) e aqui só se lê
   a primeira aba (ou a aba "Gastos"), célula por célula. Fórmulas valem pelo último valor salvo.
   Depois, interpretar() acha o cabeçalho (Data, Item, Descrição, Documento, Valor), pula linhas de
   total e liga cada linha a um item do orçamento (MQ.ORCAMENTO). */
(function () {
  const LIMITE_ARQUIVO = 10 * 1024 * 1024;   // 10 MB
  const LIMITE_LINHAS = 5000;

  /* ---------- zip ---------- */
  async function inflar(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function abrirZip(buf) {
    const u = new Uint8Array(buf); const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let fim = -1; for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    if (fim < 0) throw new Error('O arquivo não é uma planilha .xlsx válida.');
    const n = dv.getUint16(fim + 10, true); let p = dv.getUint32(fim + 16, true); const arq = {};
    const td = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('O arquivo .xlsx está corrompido.');
      const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const nome = td.decode(u.subarray(p + 46, p + 46 + nl));
      arq[nome] = { metodo, tam, off }; p += 46 + nl + xl + cl;
    }
    return async nome => {
      const e = arq[nome]; if (!e) return null;
      const ini = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
      const dados = u.subarray(ini, ini + e.tam);
      const bruto = e.metodo === 0 ? dados : e.metodo === 8 ? await inflar(dados) : null;
      if (!bruto) throw new Error('Compressão do .xlsx não suportada.');
      return new TextDecoder().decode(bruto);
    };
  }
  const ent = s => String(s).replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-f]+));/gi, (m, n, d, h) => d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[n.toLowerCase()]);
  const textoDe = xml => [...String(xml).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => ent(m[1])).join('');
  const colIdx = ref => { const l = ref.replace(/\d+/g, ''); let n = 0; for (const c of l) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };

  async function lerXlsx(buf) {
    const ler = await abrirZip(buf);
    const wb = await ler('xl/workbook.xml'); if (!wb) throw new Error('O arquivo não é uma planilha .xlsx válida.');
    const rels = (await ler('xl/_rels/workbook.xml.rels')) || '';
    const abas = [...wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"[^>]*\br:id="([^"]*)"/g)].map(m => ({ nome: ent(m[1]), rid: m[2] }));
    if (!abas.length) throw new Error('A planilha não tem abas.');
    const aba = abas.find(a => /gasto|despesa|execu/i.test(a.nome)) || abas[0];
    const alvo = (new RegExp(`<Relationship\\b[^>]*\\bId="${aba.rid}"[^>]*\\bTarget="([^"]*)"`).exec(rels) || new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]*)"[^>]*\\bId="${aba.rid}"`).exec(rels) || [])[1];
    const caminho = alvo ? (alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo.replace(/^\.\//, '')) : 'xl/worksheets/sheet1.xml';
    const ss = (await ler('xl/sharedStrings.xml')) || '';
    const comp = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoDe(m[1]));
    const xml = await ler(caminho); if (!xml) throw new Error('Não achei a aba "' + aba.nome + '" dentro do arquivo.');
    const linhas = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cel = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1]; const ref = (/\br="([A-Z]+\d+)"/.exec(at) || [])[1]; const t = (/\bt="(\w+)"/.exec(at) || [])[1]; const corpo = c[2] || '';
        const v = (/<v>([\s\S]*?)<\/v>/.exec(corpo) || [])[1];
        let val = null;
        if (t === 's') val = comp[+v] != null ? comp[+v] : '';
        else if (t === 'inlineStr') val = textoDe(corpo);
        else if (t === 'str' || t === 'e') val = v != null ? ent(v) : '';
        else if (t === 'b') val = v === '1';
        else if (v != null) val = +v;
        const i = ref ? colIdx(ref) : cel.length; cel[i] = val;
      }
      linhas.push(Array.from(cel, x => x === undefined ? null : x));
      if (linhas.length > LIMITE_LINHAS + 50) throw new Error(`A planilha tem mais de ${LIMITE_LINHAS} linhas.`);
    }
    return { aba: aba.nome, linhas };
  }

  /* ---------- csv ---------- */
  function lerCsv(buf) {
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);   // Excel brasileiro salva CSV em ANSI
    txt = txt.replace(/^﻿/, '');
    const prim = txt.split(/\r?\n/, 1)[0] || ''; const sep = (prim.match(/;/g) || []).length >= (prim.match(/,/g) || []).length ? ';' : ',';
    const linhas = []; let lin = [], cel = '', aspas = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (aspas) { if (ch === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else aspas = false; } else cel += ch; }
      else if (ch === '"') aspas = true;
      else if (ch === sep) { lin.push(cel); cel = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; lin.push(cel); linhas.push(lin); lin = []; cel = ''; }
      else cel += ch;
    }
    if (cel !== '' || lin.length) { lin.push(cel); linhas.push(lin); }
    return { aba: 'CSV', linhas: linhas.map(l => l.map(x => x.trim() === '' ? null : x.trim())) };
  }

  async function ler(arquivo) {
    if (!arquivo) throw new Error('Escolha o arquivo da planilha.');
    if (arquivo.size > LIMITE_ARQUIVO) throw new Error('Arquivo grande demais (até 10 MB).');
    const nome = String(arquivo.name || '').toLowerCase(); const buf = await arquivo.arrayBuffer();
    if (/\.xlsx$/.test(nome)) return lerXlsx(buf);
    if (/\.csv$/.test(nome)) return lerCsv(buf);
    if (/\.(xls|ods)$/.test(nome)) throw new Error('Salve a planilha como .xlsx (Arquivo > Salvar como > Pasta de Trabalho do Excel) e envie de novo.');
    throw new Error('Envie a planilha em .xlsx ou .csv.');
  }

  /* ---------- interpretar ---------- */
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function numeroBR(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null; let s = String(v).trim(); if (!s) return null;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
    s = s.replace(/[^\d,.]/g, ''); if (!s) return null;
    const n = /,\d{1,2}$/.test(s) ? +s.replace(/\./g, '').replace(',', '.') : /\.\d{1,2}$/.test(s) && !/,/.test(s) ? +s : +s.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
    return isFinite(n) ? (neg ? -n : n) : null;
  }
  function dataDe(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && v > 30000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);   // número de série do Excel
    const s = String(v).trim(); let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
    if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s))) { const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return null;
  }
  const COL = {
    valor: /^(valor|vlr|total|montante|valor pago|valor r|valor total)( r)?$|valor/,
    item: /^item|item do orcamento|^rubrica|categoria|natureza|elemento|classificacao/,
    data: /^data|^dt\b|pagamento|competencia/,
    descricao: /descri|historico|objeto|favorecido|fornecedor|beneficiario/,
    documento: /documento|^doc\b|nota fiscal|^nf\b|n doc|comprovante|ordem bancaria/
  };
  function acharCabecalho(linhas) {
    for (let i = 0; i < Math.min(linhas.length, 20); i++) {
      const cab = (linhas[i] || []).map(norm); const col = {};
      cab.forEach((c, j) => { if (!c) return;
        for (const k of ['item', 'data', 'documento', 'descricao', 'valor']) if (col[k] == null && COL[k].test(c) && !(k === 'valor' && /data/.test(c))) { col[k] = j; break; } });
      if (col.valor != null && col.item != null) return { i, col };
    }
    return null;
  }
  function tabelaItens() {
    const O = MQ.ORCAMENTO; const t = [];
    O.rubricas.forEach(r => r.itens.forEach(i => t.push({ id: i.id, rubrica: r.id, chaves: [norm(i.id.replace(/_/g, ' ')), norm(i.nome), norm(i.nome.replace(/\s*\(.*?\)\s*/g, ' '))] })));
    return t;
  }
  function classificar(texto) {
    const n = norm(texto); if (!n) return { item: null, rubrica: null };
    if (/repasse|receita|nota de credito|transferencia do mda|recurso recebido|credito recebido/.test(n)) return { item: 'repasse_mda', rubrica: null };
    const T = tabelaItens();
    let x = T.find(t => t.chaves.includes(n)); if (x) return { item: x.id, rubrica: x.rubrica };
    x = T.find(t => t.chaves.some(k => k.length >= 6 && (n.includes(k) || k.includes(n) && n.length >= 8))); if (x) return { item: x.id, rubrica: x.rubrica };
    const r = MQ.ORCAMENTO.rubricas.find(r => { const k = norm(r.nome.replace(/\s*\(.*?\)\s*/g, ' ')); return k === n || n.includes(k) || (k.includes(n) && n.length >= 6); });
    if (r) return r.itens.length === 1 ? { item: r.itens[0].id, rubrica: r.id } : { item: null, rubrica: r.id };
    return { item: null, rubrica: null };
  }
  /* devolve { linhas: [{linha, data, texto, item, rubrica, descricao, documento, valor}], avisos, ignoradas } */
  function interpretar(tab) {
    const c = acharCabecalho(tab.linhas);
    if (!c) throw new Error('Não achei o cabeçalho. A planilha precisa ter as colunas "Item" (ou "Rubrica") e "Valor". Use o modelo.');
    const out = []; let ignoradas = 0; const avisos = [];
    for (let i = c.i + 1; i < tab.linhas.length; i++) {
      const l = tab.linhas[i] || []; const pega = k => c.col[k] == null ? null : l[c.col[k]];
      const texto = pega('item'); const valor = numeroBR(pega('valor'));
      if ((texto == null || String(texto).trim() === '') && valor == null) continue;   // linha em branco
      if (/^(sub ?)?total|^soma|^saldo/.test(norm(texto))) { ignoradas++; continue; }   // linha de total: não entra (contaria duas vezes)
      if (valor == null || valor === 0) { ignoradas++; continue; }
      const cls = classificar(texto);
      out.push({ linha: i + 1, data: dataDe(pega('data')), texto: String(texto == null ? '' : texto).slice(0, 120), item: cls.item, rubrica: cls.rubrica,
        descricao: pega('descricao') == null ? null : String(pega('descricao')).slice(0, 200), documento: pega('documento') == null ? null : String(pega('documento')).slice(0, 80), valor: Math.round(valor * 100) / 100 });
      if (out.length > LIMITE_LINHAS) throw new Error(`A planilha tem mais de ${LIMITE_LINHAS} lançamentos.`);
    }
    if (!out.length) throw new Error('A planilha não tem nenhuma linha com valor.');
    const semData = out.filter(x => !x.data).length; if (semData) avisos.push(`${semData} linha${semData > 1 ? 's' : ''} sem data: entram no mês da planilha.`);
    if (c.col.data == null) avisos.push('A planilha não tem coluna de data: o gráfico do ritmo usa o mês da planilha para todos os gastos.');
    return { linhas: out, avisos, ignoradas, aba: tab.aba };
  }
  const resumo = r => {
    const gasto = r.linhas.filter(l => l.item !== 'repasse_mda').reduce((t, l) => t + l.valor, 0);
    const recebido = r.linhas.filter(l => l.item === 'repasse_mda').reduce((t, l) => t + l.valor, 0);
    const nao = r.linhas.filter(l => l.item !== 'repasse_mda' && !l.rubrica);
    const ultima = r.linhas.map(l => l.data).filter(Boolean).sort().pop() || null;
    return { gasto: Math.round(gasto * 100) / 100, recebido: Math.round(recebido * 100) / 100, naoClassificadas: nao, ultimaData: ultima };
  };

  MQ.planilha = { ler, lerXlsx, lerCsv, interpretar, resumo, classificar, numeroBR, dataDe, norm };
})();
