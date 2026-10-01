/* Mulheres & Quintais — aba Documentos (só a coordenação geral): anexar atas, ofícios e outros documentos
   do projeto e gerar o relatório da ação a partir dos dados do sistema (supabase/24_documentos.sql).
   Documento não é apagado: é arquivado com motivo. O relatório não traz nome nem CPF das mulheres. */
(function () {
  const R = MQ.regras, P = MQ.PAPEIS;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const TIPOS = { ata: 'Ata', oficio: 'Ofício', relatorio: 'Relatório', contrato: 'Contrato ou termo', plano: 'Plano ou projeto', lista_presenca: 'Lista de presença', foto: 'Foto', outro: 'Outro' };
  const EXT = ['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'jpg', 'jpeg', 'png'];
  const MAX = 20 * 1024 * 1024;   // 20 MB
  const G = { mostrarArq: false };
  const lista = () => S().documentos || [];
  const nomeDe = m => (m && (m.nome_social || m.nome)) || '—';
  const tam = n => n == null ? '' : n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  const semBanco = () => '<div class="aviso">A aba Documentos ainda não está instalada no servidor. Rode o arquivo <b>24_documentos.sql</b> no Supabase.</div>';
  const ext = nome => String(nome || '').toLowerCase().split('.').pop();

  /* ---------- regras (usadas pela tela e pelos testes) ---------- */
  function validarDocumento(d, arquivo) {
    const e = {};
    if (!TIPOS[d.tipo]) e.tipo = 'Escolha o tipo do documento.';
    if (String(d.titulo || '').trim().length < 5) e.titulo = 'Escreva um título (pelo menos 5 letras).';
    if (!d.data_documento) e.data_documento = 'Informe a data do documento.';
    else if (d.data_documento > R.hoje()) e.data_documento = 'A data do documento não pode ser no futuro.';
    if (d.uf && !MQ.UFS.some(u => u.uf === d.uf)) e.uf = 'Estado inválido.';
    if (String(d.descricao || '').length > 2000) e.descricao = 'No máximo 2.000 letras.';
    if (!arquivo || !arquivo.name) e.arquivo = 'Escolha o arquivo.';
    else if (!EXT.includes(ext(arquivo.name))) e.arquivo = 'Tipo de arquivo não aceito. Use PDF, Word, planilha ou foto (JPG, PNG).';
    else if (!(arquivo.size > 0)) e.arquivo = 'O arquivo está vazio.';
    else if (arquivo.size > MAX) e.arquivo = 'O arquivo passa de 20 MB. Diminua (salve o PDF com qualidade menor) ou divida.';
    return e;
  }

  /* números do relatório, a partir do que o sistema já tem (sem nome nem CPF das mulheres) */
  function dadosRelatorio(s, f) {
    const de = f.de || MQ.PROJETO.vigencia.inicio, ate = f.ate || R.hoje(), uf = f.uf || null;
    const noPeriodo = d => { const x = String(R.diaLocal(d) || '').slice(0, 10); return !!x && x >= de && x <= ate; };
    const daUF = x => !uf || x.uf === uf;
    const ufs = uf ? MQ.UFS.filter(u => u.uf === uf) : MQ.UFS;
    const equipe = (s.equipe || []).filter(m => m.papel !== 'coord_geral' && (!uf || !m.uf || m.uf === uf));
    const ativos = equipe.filter(m => m.status === 'ativa');
    const porFuncao = Object.keys(P).filter(p => p !== 'coord_geral').map(p => ({ papel: p, nome: P[p].nome, n: ativos.filter(m => m.papel === p).length })).filter(x => x.n);
    const fichas = (s.fichas || []).filter(daUF);
    const selecao = ufs.map(u => { const l = fichas.filter(x => x.uf === u.uf);
      return { uf: u.uf, lancadas: l.length, selecionadas: l.filter(x => x.resultado === 'selecionada' && x.situacao === 'aprovada').length,
        espera: l.filter(x => x.resultado === 'lista_espera').length, sem_agua: l.filter(x => x.resultado === 'sem_agua').length, nao_atende: l.filter(x => x.resultado === 'nao_atende').length }; });
    const visitas = (s.visitas || []).filter(v => daUF(v) && v.situacao === 'realizada' && noPeriodo(v.data_realizada));
    const campo = Object.keys(MQ.ETAPAS).map(k => ({ etapa: k, nome: MQ.ETAPAS[k].nome, n: visitas.filter(v => v.etapa === k).length }));
    const diag = (s.diagnosticos || []).filter(d => daUF(d) || !d.uf);
    const faz = ativos.filter(m => R.matriculaFIC(m.papel));
    const pag = (s.solic || []).filter(x => noPeriodo(x.solicitada_em));
    const valor = l => Math.round(l.reduce((t, x) => t + (+(x.valor_avalizado != null ? x.valor_avalizado : x.valor_solicitado) || 0), 0) * 100) / 100;
    const ped = (s.pedidos || []).filter(p => daUF(p) && noPeriodo(p.enviado_em));
    const docs = (s.documentos || []).filter(d => !d.arquivado_em && noPeriodo(d.data_documento) && (!uf || !d.uf || d.uf === uf));
    return {
      periodo: { de, ate, uf, geradoEm: new Date().toISOString() },
      equipe: { ativos: ativos.length, habilitados: ativos.filter(m => R.situacao(m).cod === 'ok').length, porFuncao,
        desligados: equipe.filter(m => m.status === 'desligada' && noPeriodo(m.data_fim)).length },
      selecao, totalSelecionadas: selecao.reduce((t, x) => t + x.selecionadas, 0),
      campo, visitasFeitas: visitas.length,
      diagnosticos: { enviados: diag.filter(d => noPeriodo(d.criado_em || d.data_visita)).length, aprovados: diag.filter(d => d.situacao === 'aprovado').length },
      fic: { fazem: faz.length, matriculadas: faz.filter(m => m.matricula_fic_em).length, turmas: (s.turmas || []).length },
      pagamentos: { pedidos: pag.length, lancados: pag.filter(x => x.situacao === 'lancada').length, valorLancado: valor(pag.filter(x => x.situacao === 'lancada')) },
      viagens: { pedidos: ped.length, autorizados: ped.filter(p => p.situacao === 'autorizado').length,
        passagens: ped.filter(p => p.tipo === 'passagem' && p.situacao === 'autorizado').reduce((t, p) => t + (((p.dados || {}).passageiros) || []).length, 0),
        eventos: ped.filter(p => p.tipo === 'evento' && p.situacao === 'autorizado').length },
      documentos: docs.map(d => ({ tipo: TIPOS[d.tipo] || d.tipo, titulo: d.titulo, data: d.data_documento, uf: d.uf }))
    };
  }

  /* HTML do relatório (serve para a tela, para imprimir/PDF e para o arquivo do Word) */
  function htmlRelatorio(r, autor) {
    const f = R.fmtData, br = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const t = (cab, linhas) => `<table><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const onde = r.periodo.uf ? E(U().nomeUF(r.periodo.uf)) : 'Alagoas, Bahia, Pernambuco, Piauí e Sergipe';
    return `<article class="rel">
      <header><p class="rel-sobre">${E(MQ.PROJETO.nome)} · Processo ${E(MQ.PROJETO.processo)}</p>
        <h1>Relatório da ação do projeto</h1>
        <p>Período: <b>${f(r.periodo.de)} a ${f(r.periodo.ate)}</b> · Estados: ${onde}<br>Gerado em ${new Date(r.periodo.geradoEm).toLocaleString('pt-BR')}${autor ? ' por ' + E(autor) : ''}, com os dados registrados no sistema.</p></header>
      <h2>1. Equipe</h2>
      <p>${r.equipe.ativos} pessoas ativas na equipe de execução, das quais ${r.equipe.habilitados} habilitadas para receber (matrícula no FIC, cadastro no Arlo e termo de compromisso)${r.equipe.desligados ? `; ${r.equipe.desligados} desligamento${r.equipe.desligados > 1 ? 's' : ''} no período` : ''}.</p>
      ${r.equipe.porFuncao.length ? t(['Função', 'Pessoas ativas'], r.equipe.porFuncao.map(x => [E(x.nome), x.n])) : ''}
      <h2>2. Seleção das mulheres</h2>
      <p>${r.totalSelecionadas} mulheres selecionadas e aprovadas (meta: 40 por estado).</p>
      ${t(['Estado', 'Fichas lançadas', 'Selecionadas aprovadas', 'Lista de espera', 'Sem água', 'Não atendem'], r.selecao.map(x => [x.uf, x.lancadas, x.selecionadas, x.espera, x.sem_agua, x.nao_atende]))}
      <h2>3. Trabalho de campo</h2>
      <p>${r.visitasFeitas} visita${r.visitasFeitas === 1 ? '' : 's'} feita${r.visitasFeitas === 1 ? '' : 's'} no período; ${r.diagnosticos.aprovados} plano${r.diagnosticos.aprovados === 1 ? '' : 's'} de quintal aprovado${r.diagnosticos.aprovados === 1 ? '' : 's'} no total.</p>
      ${t(['Etapa', 'Visitas feitas no período'], r.campo.map(x => [E(x.nome), x.n]))}
      <h2>4. Curso FIC</h2>
      <p>${r.fic.matriculadas} de ${r.fic.fazem} pessoas que fazem o curso estão matriculadas, em ${r.fic.turmas} turma${r.fic.turmas === 1 ? '' : 's'}.</p>
      <h2>5. Pagamentos</h2>
      <p>${r.pagamentos.pedidos} pedido${r.pagamentos.pedidos === 1 ? '' : 's'} de pagamento no período; ${r.pagamentos.lancados} lançado${r.pagamentos.lancados === 1 ? '' : 's'} no Arlo, somando ${br(r.pagamentos.valorLancado)}.</p>
      <h2>6. Viagens e eventos</h2>
      <p>${r.viagens.pedidos} pedido${r.viagens.pedidos === 1 ? '' : 's'} no período; ${r.viagens.autorizados} autorizado${r.viagens.autorizados === 1 ? '' : 's'} (${r.viagens.passagens} passage${r.viagens.passagens === 1 ? 'm' : 'ns'} por pessoa e ${r.viagens.eventos} evento${r.viagens.eventos === 1 ? '' : 's'}).</p>
      <h2>7. Documentos do período</h2>
      ${r.documentos.length ? t(['Data', 'Tipo', 'Título', 'Estado'], r.documentos.map(d => [f(d.data), E(d.tipo), E(d.titulo), d.uf || 'Todos'])) : '<p>Nenhum documento anexado no período.</p>'}
      <p class="rel-nota">Números a partir dos registros do sistema Mulheres &amp; Quintais. Não contém nome, CPF ou endereço das beneficiárias (LGPD).</p>
    </article>`;
  }
  const CSS_REL = `body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:32px;font-size:12pt}h1{font-size:18pt;margin:4px 0 8px}h2{font-size:13pt;margin:20px 0 6px}
    table{border-collapse:collapse;width:100%;margin:6px 0 10px}th,td{border:1px solid #999;padding:4px 8px;text-align:left;font-size:10.5pt}th{background:#eee}
    .rel-sobre{font-size:9.5pt;color:#555;margin:0}.rel-nota{font-size:9pt;color:#555;margin-top:18px}`;
  const documentoCompleto = corpo => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório da ação do projeto</title><style>${CSS_REL}</style></head><body>${corpo}</body></html>`;

  /* ---------- tela ---------- */
  function aba() {
    if (S().docSemBanco) return `<div class="cab"><div><span class="eyebrow">Documentos</span><h1>Documentos do projeto</h1></div></div>${semBanco()}`;
    const ativos = lista().filter(d => !d.arquivado_em), arq = lista().filter(d => d.arquivado_em);
    const linha = d => `<button class="vagabtn ficha-linha doc-linha" data-acao="doc-ver" data-id="${E(d.id)}">
        <span class="nm">${E(d.titulo)}</span>
        <span class="small muted">${E(TIPOS[d.tipo] || d.tipo)} · ${R.fmtData(d.data_documento)}${d.uf ? ' · ' + E(d.uf) : ''} · ${E(d.arquivo_nome)}${d.tamanho ? ' · ' + tam(d.tamanho) : ''}</span></button>`;
    const porTipo = Object.keys(TIPOS).map(k => [k, ativos.filter(d => d.tipo === k).length]).filter(x => x[1]);
    return `<div class="cab"><div><span class="eyebrow">Documentos</span><h1>Documentos do projeto</h1>
        <p>Atas, ofícios, relatórios e outros documentos da ação, guardados numa pasta que só a coordenação geral acessa. E o relatório da ação do projeto, gerado com os dados do sistema.</p></div></div>
      <div class="acoes-pag">${MQ.acaoComDica({ acao: 'doc-novo', icone: 'anexo', texto: 'Anexar documento' }, 'PDF, Word, planilha ou foto, até 20 MB. Ata, ofício, lista de presença…')}
        ${MQ.acaoComDica({ acao: 'doc-relatorio', icone: 'relatorio', texto: 'Gerar relatório da ação', curto: 'Gerar relatório', sec: true }, 'Equipe, seleção, campo, FIC, pagamentos, viagens e documentos, por período e estado.')}</div>
      <div class="resumo">
        <div><span class="v num">${ativos.length}</span><span class="l">documentos anexados</span></div>
        ${porTipo.slice(0, 3).map(([k, n]) => `<div><span class="v num">${n}</span><span class="l">${E(TIPOS[k].toLowerCase())}${n > 1 && !/s$/.test(TIPOS[k]) ? 's' : ''}</span></div>`).join('')}
      </div>
      <section class="secao" aria-labelledby="t-docs"><div class="secao-cab"><h2 id="t-docs">Documentos <span class="conta-t${ativos.length ? '' : ' zero'}">${ativos.length}</span></h2>
          ${ativos.length > 5 ? '<input class="procura" type="search" placeholder="Procurar por título ou tipo" data-procura="lista-docs" aria-label="Procurar documento">' : ''}</div>
        ${ativos.length ? `<div class="pag-lista" id="lista-docs">${ativos.map(linha).join('')}</div>` : '<p class="muted">Nenhum documento anexado ainda.</p>'}</section>
      ${arq.length ? `<details class="hist"><summary>Arquivados (${arq.length})</summary><div class="pag-lista" style="padding:0 18px 16px">${arq.map(linha).join('')}</div></details>` : ''}`;
  }
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function painel(p) {
    if (p.tipo === 'doc-novo') return cab('Documentos', 'Anexar documento') + `<div class="painel-corpo"><form class="f" data-form="doc-enviar" novalidate>
        <div class="campos">
          <div class="campo"><label for="dc-tipo">Tipo</label><select id="dc-tipo" name="tipo"><option value="">Selecione…</option>${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
          <div class="campo"><label for="dc-data">Data do documento</label><input id="dc-data" name="data_documento" type="date" max="${R.hoje()}" value="${R.hoje()}"></div>
          <div class="campo inteiro"><label for="dc-tit">Título</label><input id="dc-tit" name="titulo" maxlength="200" placeholder="Ex.: Ata da reunião com o MPA sobre as bolsistas"></div>
          <div class="campo"><label for="dc-uf">Estado</label><select id="dc-uf" name="uf"><option value="">Projeto todo</option>${MQ.UFS.map(u => `<option value="${u.uf}">${u.nome}</option>`).join('')}</select></div>
          <div class="campo inteiro"><label for="dc-desc">Descrição <span class="muted">(opcional)</span></label><textarea id="dc-desc" name="descricao" maxlength="2000"></textarea></div>
          <div class="campo inteiro"><label for="dc-arq">Arquivo</label><input id="dc-arq" name="arquivo" type="file" accept="${EXT.map(x => '.' + x).join(',')}">
            <span class="dica">PDF, Word, planilha ou foto, até 20 MB. Não anexe documento com CPF ou dado bancário que não precise estar aqui.</span></div>
        </div>
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Anexar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
      </form></div>`;
    if (p.tipo === 'doc-relatorio') {
      const f = G.rel || { de: MQ.PROJETO.vigencia.inicio, ate: R.hoje(), uf: '' };
      const r = dadosRelatorio(S(), f);
      return cab('Relatório', 'Relatório da ação do projeto') + `<div class="painel-corpo">
        <form class="f rel-filtro" data-form="doc-rel-filtro" novalidate><div class="campos">
          <div class="campo"><label for="rl-de">De</label><input id="rl-de" name="de" type="date" min="${MQ.PROJETO.vigencia.inicio}" max="${R.hoje()}" value="${E(f.de)}"></div>
          <div class="campo"><label for="rl-ate">Até</label><input id="rl-ate" name="ate" type="date" min="${MQ.PROJETO.vigencia.inicio}" max="${R.hoje()}" value="${E(f.ate)}"></div>
          <div class="campo"><label for="rl-uf">Estado</label><select id="rl-uf" name="uf"><option value="">Todos</option>${MQ.UFS.map(u => `<option value="${u.uf}" ${f.uf === u.uf ? 'selected' : ''}>${u.nome}</option>`).join('')}</select></div>
        </div><div class="aviso erro" data-erro hidden></div><div class="acoes"><button class="btn" type="submit">Atualizar o relatório</button></div></form>
        <div class="acoes"><button class="btn pri" type="button" data-acao="doc-rel-imprimir">Imprimir</button><button class="btn" type="button" data-acao="doc-rel-word">Baixar para o Word</button></div>
        <div class="bloco rel-previa">${htmlRelatorio(r, nomeDe(U().porId(S().eu.id)))}</div></div>`;
    }
    const d = lista().find(x => x.id === p.id); if (!d) return '<div class="painel-corpo"><p>Documento não encontrado.</p></div>';
    const quem = id => nomeDe(U().porId(id));
    return cab(E(TIPOS[d.tipo] || d.tipo), E(d.titulo)) + `<div class="painel-corpo">
      <div class="bloco"><dl class="dl"><dt>Data</dt><dd>${R.fmtData(d.data_documento)}</dd><dt>Estado</dt><dd>${d.uf ? E(U().nomeUF(d.uf)) : 'Projeto todo'}</dd>
        <dt>Arquivo</dt><dd>${E(d.arquivo_nome)}${d.tamanho ? ' · ' + tam(d.tamanho) : ''}</dd><dt>Anexado</dt><dd>${new Date(d.enviado_em).toLocaleString('pt-BR')} por ${E(quem(d.enviado_por))}</dd>
        ${d.descricao ? `<dt>Descrição</dt><dd>${E(d.descricao)}</dd>` : ''}
        ${d.arquivado_em ? `<dt>Arquivado</dt><dd>${new Date(d.arquivado_em).toLocaleString('pt-BR')} por ${E(quem(d.arquivado_por))}: ${E(d.motivo_arquivo)}</dd>` : ''}</dl>
        <div class="acoes"><button class="btn pri" type="button" data-acao="doc-abrir" data-id="${E(d.id)}">Abrir o arquivo</button></div></div>
      ${d.arquivado_em ? '' : `<form class="bloco" data-form="doc-arquivar" data-id="${E(d.id)}" novalidate><h3>Arquivar</h3>
        <p class="small muted">O documento sai da lista, mas não é apagado: fica em "Arquivados" e no histórico. Para trocar um arquivo errado, arquive e anexe o certo.</p>
        <div class="campo"><label for="da-mot">Motivo</label><textarea id="da-mot" name="motivo" placeholder="Ex.: versão errada; substituída pela ata assinada"></textarea></div>
        <div class="aviso erro" data-erro hidden></div><div class="acoes"><button class="btn perigo" type="submit">Arquivar</button></div></form>`}
    </div>`;
  }

  /* ---------- ações ---------- */
  function baixar(nome, conteudo, tipo) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function relatorioAtual() { return htmlRelatorio(dadosRelatorio(S(), G.rel || {}), nomeDe(U().porId(S().eu.id))); }
  async function clique(a, el) {
    if (a === 'doc-novo') U().abrirPainel({ tipo: 'doc-novo' });
    else if (a === 'doc-ver') U().abrirPainel({ tipo: 'doc-ver', id: el.dataset.id });
    else if (a === 'doc-relatorio') { G.rel = null; U().abrirPainel({ tipo: 'doc-relatorio' }); }
    else if (a === 'doc-abrir') { const d = lista().find(x => x.id === el.dataset.id); const url = await S().api.linkDocumento(d.arquivo_path); if (url) window.open(url, '_blank', 'noopener'); else U().toast('No modo demonstração o arquivo não fica guardado.'); }
    else if (a === 'doc-rel-word') baixar('relatorio_mulheres_e_quintais_' + R.hoje() + '.doc', '﻿' + documentoCompleto(relatorioAtual()), 'application/msword');
    else if (a === 'doc-rel-imprimir') {
      const f = document.createElement('iframe'); f.style.position = 'fixed'; f.style.width = f.style.height = '0'; f.style.border = '0'; f.setAttribute('aria-hidden', 'true');
      document.body.appendChild(f); f.contentDocument.open(); f.contentDocument.write(documentoCompleto(relatorioAtual())); f.contentDocument.close();
      setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 250);
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'doc-enviar') {
      const d = { tipo: String(fd.get('tipo') || ''), titulo: String(fd.get('titulo') || '').trim().replace(/\s+/g, ' '), data_documento: String(fd.get('data_documento') || ''),
        uf: String(fd.get('uf') || '') || null, descricao: String(fd.get('descricao') || '').trim() || null };
      const arq = fd.get('arquivo'); const arquivo = arq && arq.name ? arq : null;
      const e = validarDocumento(d, arquivo); if (Object.keys(e).length) return U().mostrarErros(form, e);
      await U().ocupado(form, async () => { await S().api.enviarDocumento(d, arquivo); await U().carregar(); U().fecharPainel(); U().render(); U().toast('Documento anexado.'); });
    }
    if (tipo === 'doc-arquivar') {
      const m = String(fd.get('motivo') || '').trim();
      if (m.length < 5) return U().mostrarErros(form, { motivo: 'Escreva o motivo (pelo menos 5 letras).' });
      await U().ocupado(form, async () => { await S().api.arquivarDocumento(form.dataset.id, m); await U().carregar(); U().fecharPainel(); U().render(); U().toast('Documento arquivado.'); });
    }
    if (tipo === 'doc-rel-filtro') {
      const f = { de: String(fd.get('de') || ''), ate: String(fd.get('ate') || ''), uf: String(fd.get('uf') || '') };
      if (!f.de || !f.ate) return U().mostrarErros(form, Object.assign({}, f.de ? {} : { de: 'Informe o início.' }, f.ate ? {} : { ate: 'Informe o fim.' }));
      if (f.ate < f.de) return U().mostrarErros(form, { ate: 'O fim é antes do início.' });
      G.rel = f; U().abrirPainel({ tipo: 'doc-relatorio' });
    }
  }

  MQ.docsUI = { aba, painel, clique, enviar, validarDocumento, dadosRelatorio, htmlRelatorio, documentoCompleto, TIPOS };
})();
