/* Mulheres & Quintais — prontidão para o campo, registros parados nos celulares e cópia dos dados (12/10/2026).
   1. Registros parados: o que é salvo sem internet fica só no celular. Quando o celular tem internet, ele avisa ao
      servidor só a CONTAGEM do que guarda (quantos, desde quando, quantos recusados), nunca o conteúdo
      (58_fila_nos_celulares.sql). A coordenação vê quem tem registro esperando e desde quando.
   2. Prontidão: por estado, quem da equipe de campo está cadastrada, já entrou e está habilitada; fichas aprovadas;
      diagnósticos; visitas dos próximos 7 dias; registros parados.
   3. Cópia dos dados: a coordenação geral baixa uma planilha (.xlsx) com o que o sistema tem, sem conta bancária,
      para guardar como cópia de segurança e para a prestação de contas. Feita no próprio navegador. */
(function () {
  const R = MQ.regras;
  const S = () => MQ.ui.S;
  const E = s => MQ.ui.esc(s);
  const CAMPO = ['articulacao', 'apoio', 'agente'];
  const DIAS_ALERTA = 2;   // registro guardado há mais de 2 dias no celular: aviso em destaque

  /* ---------- 1. registros parados nos celulares ---------- */
  /* resumo da fila deste aparelho para o servidor (só números) */
  function resumoFila(fila) {
    const l = (fila || []).filter(i => i && i.tipo);
    const datas = l.map(i => +i.criado || 0).filter(Boolean);
    return { qtd: l.length, recusados: l.filter(i => i.erro).length, mais_antigo: datas.length ? new Date(Math.min(...datas)).toISOString() : null };
  }
  const nomeDe = m => (m && (m.nome_social || m.nome)) || 'Pessoa';
  const papelDe = m => ((MQ.PAPEIS[m && m.papel] || {}).curto || (MQ.PAPEIS[m && m.papel] || {}).nome || '');
  const diasDesde = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 0;
  const quando = iso => { if (!iso) return ''; const d = new Date(iso); return R.fmtData(iso) + ' ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0'); };
  function parados() {
    const eq = new Map((S().equipe || []).map(m => [m.id, m]));
    return (S().filaCelular || []).filter(f => f.qtd > 0 && eq.has(f.equipe_id) && eq.get(f.equipe_id).status === 'ativa')
      .map(f => Object.assign({ pessoa: eq.get(f.equipe_id) }, f))
      .sort((a, b) => String(a.mais_antigo || '').localeCompare(String(b.mais_antigo || '')));
  }
  function blocoFila() {
    const cab = '<h3>Registros parados nos celulares</h3>';
    if (S().filaCelularSemBanco) return `<div class="bloco">${cab}<p class="small muted">Para ver quem tem visita, diagnóstico ou avaliação guardada no celular sem enviar, rode no Supabase o arquivo 58_fila_nos_celulares.sql.</p></div>`;
    const l = parados();
    const linha = f => { const dd = diasDesde(f.mais_antigo), alerta = dd >= DIAS_ALERTA || f.recusados;
      return `<li class="${alerta ? 'fila-alerta' : ''}"><b>${E(nomeDe(f.pessoa))}</b> <span class="muted">(${E(papelDe(f.pessoa))}${f.pessoa.uf ? ' · ' + E(f.pessoa.uf) : ''})</span>:
        ${f.qtd} registro${f.qtd > 1 ? 's' : ''} guardado${f.qtd > 1 ? 's' : ''} no celular desde ${R.fmtData(f.mais_antigo)}${dd ? ' (' + dd + ' dia' + (dd > 1 ? 's' : '') + ')' : ''}${f.recusados ? ` · <b>${f.recusados} recusado${f.recusados > 1 ? 's' : ''} pelo servidor</b>` : ''}
        <br><span class="small muted">Último contato com internet: ${E(quando(f.visto_em))}</span></li>`; };
    return `<div class="bloco fila-cel">${cab}
      <p class="small muted">O que é salvo sem internet só chega ao servidor quando o celular conecta. Cada celular avisa quantos registros guarda sempre que tem internet (só a contagem, nunca o conteúdo).${l.length ? ' Se o registro está parado há dias, fale com a pessoa: ela precisa abrir o sistema com internet e tocar em "Enviar agora".' : ''}</p>
      ${l.length ? `<ul class="fila-cel-lista">${l.map(linha).join('')}</ul>` : '<p>Nenhum registro parado nos celulares da equipe.</p>'}</div>`;
  }

  /* ---------- 2. prontidão para o campo ---------- */
  function porUF(uf) {
    const eq = (S().equipe || []).filter(m => m.status === 'ativa' && m.uf === uf && CAMPO.includes(m.papel));
    const demo = !S().api || S().api.modo !== 'supabase';
    const entraram = demo ? eq.length : eq.filter(m => m.user_id).length;
    const hab = eq.filter(m => R.habilitado(m)).length;
    const fichas = (S().fichas || []).filter(f => f.uf === uf && f.resultado === 'selecionada' && f.situacao === 'aprovada').length;
    const dgs = (S().diagnosticos || []).filter(d => d.uf === uf).length;
    const hoje = R.hoje(), fim = new Date(Date.now() + 7 * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const prox = (S().visitas || []).filter(v => v.uf === uf && v.situacao === 'prevista' && v.data_prevista >= hoje && v.data_prevista <= fim).length;
    const ids = new Set(eq.map(m => m.id));
    const fila = (S().filaCelular || []).filter(f => ids.has(f.equipe_id)).reduce((t, f) => t + (+f.qtd || 0), 0);
    return { eq: eq.length, entraram, hab, fichas, dgs, prox, fila };
  }
  function coordenacao() {   // quem não é de um estado: só para a coordenação geral
    const eq = (S().equipe || []).filter(m => m.status === 'ativa');
    const demo = !S().api || S().api.modo !== 'supabase';
    const st = m => !m ? 'vaga aberta' : !R.habilitado(m) ? 'falta habilitar' : (demo || m.user_id) ? 'pronta' : 'ainda não entrou';
    const tec = eq.find(m => m.papel === 'coord_tecnico'), aux = eq.find(m => m.papel === 'auxiliar_adm');
    const profs = eq.filter(m => m.papel === 'professor_fic'), profsHab = profs.filter(m => R.habilitado(m)).length;
    return `<p class="small pront-coord"><b>Coordenação técnica:</b> ${st(tec)} · <b>Auxiliar:</b> ${st(aux)} · <b>Professores do FIC:</b> ${profs.length ? profsHab + ' de ' + profs.length + ' habilitado' + (profs.length > 1 ? 's' : '') : 'nenhum cadastrado (sem professor habilitado, ninguém da equipe de campo pode ser cadastrado)'}</p>`;
  }
  function secao() {
    const eu = S().eu || {}; if (!/^coord/.test(eu.papel)) return '';
    const n = (x, de) => `<span class="num"><b>${x}</b>${de != null ? ` <span class="muted">de ${de}</span>` : ''}</span>`;
    const linha = u => { const d = porUF(u.uf);
      const eqTxt = d.eq ? `${n(d.hab, d.eq)} <span class="small muted">habilitada${d.hab === 1 ? '' : 's'} · ${d.entraram} já entr${d.entraram === 1 ? 'ou' : 'aram'}</span>` : '<span class="muted">ninguém cadastrado</span>';
      return `<tr><td class="uf"><span class="sigla">${u.uf}</span><span class="nomeuf">${u.nome}</span></td>
        <td class="pr-eq" data-rot="Equipe de campo">${eqTxt}</td>
        <td class="num c" data-rot="Fichas aprovadas">${n(d.fichas, MQ.VAGAS_UF)}</td>
        <td class="num c" data-rot="Diagnósticos">${n(d.dgs, MQ.META_UF.diagnosticos)}</td>
        <td class="num c" data-rot="Visitas nos próximos 7 dias">${d.prox}</td>
        <td class="num c" data-rot="Registros parados nos celulares">${d.fila ? `<b class="fila-alerta-n">${d.fila}</b>` : '0'}</td></tr>`; };
    return `<section class="secao prontidao" aria-labelledby="t-pront">
      <div class="secao-cab"><div><h2 id="t-pront">Prontidão para o campo</h2><p>Por estado: quem da equipe de campo está habilitada e já entrou no sistema, o que está aprovado e o que está agendado para a semana.</p></div></div>
      <div class="quadro-scroll" style="display:block"><table class="quadro tab-pront"><thead><tr><th>Estado</th><th>Equipe de campo</th><th class="c">Fichas aprovadas</th><th class="c">Diagnósticos</th><th class="c">Visitas em 7 dias</th><th class="c">Parados no celular</th></tr></thead>
        <tbody>${MQ.UFS.map(linha).join('')}</tbody></table></div>
      ${eu.papel === 'coord_geral' ? coordenacao() : ''}
      ${blocoFila()}
    </section>`;
  }

  /* ---------- 3. cópia dos dados (.xlsx feito aqui mesmo, sem biblioteca) ---------- */
  const FORA = /^(_|banco|agencia|agência|conta|pix|digito|tipo_conta|senha|token|codigo|código|marca$)/i;   // nada de conta bancária nem segredo
  const LIM_CELULA = 32000;   // o Excel aceita até 32.767 caracteres por célula
  function tabela(lista) {
    const l = (lista || []).filter(x => x && typeof x === 'object');
    const cols = []; l.forEach(o => Object.keys(o).forEach(k => { if (!FORA.test(k) && !cols.includes(k)) cols.push(k); }));
    const PRIMEIRO = ['nome', 'nome_social', 'papel', 'tipo', 'etapa', 'uf', 'municipio', 'comunidade', 'situacao', 'status', 'mes', 'data_prevista', 'data_realizada', 'data_visita'];
    cols.sort((a, b) => { const ia = PRIMEIRO.indexOf(a), ib = PRIMEIRO.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });   // o que se lê primeiro, à esquerda; o resto na ordem em que veio
    const cel = v => v == null ? '' : typeof v === 'number' || typeof v === 'boolean' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return [cols].concat(l.map(o => cols.map(k => cel(o[k]))));
  }
  function abasDaCopia() {
    const s = S();
    return [['Equipe', s.equipe], ['Fichas', s.fichas], ['Visitas', s.visitas], ['Diagnosticos', s.diagnosticos], ['Avaliacoes', s.avaliacoes],
      ['Pagamentos', s.solic], ['Turmas FIC', s.turmas], ['Matriculas FIC', s.matriculas], ['Encontros FIC', s.encontros], ['Entregas', s.entregas],
      ['Pedidos viagem', s.pedidos], ['Documentos', s.documentos]].map(([nome, l]) => [nome, tabela(l)]);
  }
  const xml = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colunaLetra = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  function folhaXml(linhas) {
    const rows = linhas.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => { const ref = colunaLetra(j) + (i + 1);
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
      const t = String(v); if (!t) return '';
      return `<c r="${ref}" t="inlineStr"${i === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(t.length > LIM_CELULA ? t.slice(0, LIM_CELULA) + '…' : t)}</t></is></c>`; }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows}</sheetData></worksheet>`;
  }
  /* zip sem compressão (método "store"): basta para a planilha abrir no Excel, LibreOffice e Google Planilhas */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(arquivos) {   // [[nome, texto]]
    const enc = new TextEncoder(), partes = [], centrais = []; let pos = 0;
    const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    arquivos.forEach(([nome, texto]) => {
      const dados = enc.encode(texto), nm = enc.encode(nome), c = crc32(dados);
      const cab = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(dados.length), ...u32(dados.length), ...u16(nm.length), ...u16(0)]);
      partes.push(cab, nm, dados);
      centrais.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(dados.length), ...u32(dados.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), nm);
      pos += cab.length + nm.length + dados.length;
    });
    const tamCentral = centrais.reduce((t, p) => t + p.length, 0);
    const fim = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
    const tudo = new Uint8Array(pos + tamCentral + fim.length); let o = 0;
    partes.concat(centrais, [fim]).forEach(p => { tudo.set(p, o); o += p.length; });
    return tudo;
  }
  function montarXlsx(abas) {   // [[nome, linhas]]
    const nomes = abas.map(([n], i) => xml(String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Aba ' + (i + 1)));
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + abas.map((a, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + abas.map((a, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
    ].concat(abas.map(([, linhas], i) => [`xl/worksheets/sheet${i + 1}.xml`, folhaXml(linhas)])));
  }
  async function baixarCopia() {
    if ((S().eu || {}).papel !== 'coord_geral') return;
    if (MQ.ui.carregar) { try { await MQ.ui.carregar(); } catch (e) { /* sem internet: copia o que está na tela */ } }
    const abas = abasDaCopia();
    const bytes = montarXlsx(abas);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = 'copia_mulheres_e_quintais_' + R.hoje() + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    const total = abas.reduce((t, [, l]) => t + Math.max(0, l.length - 1), 0);
    if (MQ.ui.toast) MQ.ui.toast('Cópia baixada: ' + total + ' registros em ' + abas.length + ' abas. Ela tem CPF e endereço: guarde num lugar seguro.');
  }

  MQ.prontidaoUI = { resumoFila, blocoFila, secao, porUF, parados, tabela, montarXlsx, zip, crc32, baixarCopia, abasDaCopia };
})();
