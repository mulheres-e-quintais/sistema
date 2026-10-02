/* Mulheres & Quintais — termo já preenchido com os dados que estão no sistema (02/10/2026).
   A pessoa não digita de novo o que já informou no cadastro: o sistema monta o termo dela, pronto para imprimir
   (ou salvar em PDF), conferir, assinar e anexar. O que o sistema não tem sai como linha em branco.
   Dois termos, conforme R.tipoTermo: servidor do IFRN (Anexo I da Portaria 017/2017 – SUP/FUNCERN) e
   bolsista/agente (termo de compromisso do projeto). O texto é o mesmo dos modelos em branco da pasta modelos/. */
(function () {
  const R = MQ.regras;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = () => MQ.PROJETO;
  /* valor preenchido (em negrito) ou linha em branco do tamanho pedido */
  const v = (x, mm) => x ? `<b class="pre">${E(x)}</b>` : `<span class="ln" style="width:${mm || 50}mm"></span>`;
  const ufNome = uf => ((MQ.UFS || []).find(u => u.uf === uf) || {}).nome || uf;

  const CSS = `@page { size: A4; margin: 18mm 18mm 16mm 22mm; }
    * { box-sizing: border-box; } html, body { margin: 0; background: #fff; color: #111; }
    body { font: 11pt/1.5 "Times New Roman", Georgia, serif; }
    .tela { position: sticky; top: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: flex-end; padding: 10px 14px; background: #F3EBE1; border-bottom: 1px solid #CDB79D; font: 10.5pt "Public Sans", Arial, sans-serif; }
    .tela span { margin-right: auto; color: #452B1A; max-width: 60ch; }
    .tela button { font: 600 11pt "Public Sans", Arial, sans-serif; padding: 9px 16px; border-radius: 999px; border: 1px solid #CDB79D; background: #FFFCF8; color: #2E1D15; cursor: pointer; }
    .tela button.pri { background: #A44934; border-color: #A44934; color: #FFFCF8; }
    main { max-width: 172mm; margin: 0 auto; padding: 14px 14px 28px; }
    h1 { font-size: 13pt; text-align: center; margin: 0 0 2px; } .c { text-align: center; margin: 0 0 3px; } .peq { font-size: 9.5pt; }
    h2 { font-size: 11pt; margin: 12px 0 4px; break-after: avoid; }
    p { margin: 0 0 6px; } .j { text-align: justify; } .rec { text-indent: 12mm; }
    dl { margin: 0; } dl div { display: flex; gap: 6px; align-items: baseline; margin: 0 0 3px; } dt { white-space: nowrap; } dd { margin: 0; flex: 1; }
    ol { margin: 0 0 4px; padding-left: 7mm; list-style: lower-alpha; } li { margin: 0 0 3px; text-align: justify; padding-left: 1mm; }
    .ln { display: inline-block; border-bottom: 1px solid #333; height: 1.1em; vertical-align: baseline; max-width: 100%; }
    .pre { font-weight: 700; }
    .assina { display: grid; gap: 6mm 8mm; margin-top: 14mm; break-inside: avoid; } .assina.tres { grid-template-columns: repeat(3, 1fr); } .assina.duas { grid-template-columns: 1fr 1fr; margin-top: 8mm; }
    .assina div { text-align: center; font-size: 10pt; } .assina .ln { display: block; width: 100%; height: 11mm; } .assina small { display: block; font-size: 9pt; }
    .um { width: 80mm; margin: 14mm auto 0; text-align: center; break-inside: avoid; } .um .ln { display: block; width: 100%; height: 11mm; }
    .pe { margin-top: 8mm; font-size: 8pt; color: #555; border-top: 1px solid #bbb; padding-top: 4px; text-align: center; }
    @media print { .tela { display: none; } main { padding: 0; max-width: none; } }`;

  /* ---------- bolsista e agente de campo (não servidores) ---------- */
  function corpoBolsista(m) {
    const papel = MQ.PAPEIS[m.papel] || {}; const agente = m.papel === 'agente';
    const onde = m.uf ? ufNome(m.uf) + ' (' + m.uf + ')' : m.papel === 'coord_tecnico' ? 'os cinco estados (AL, BA, PE, PI e SE)' : '';
    return `<h1>TERMO DE COMPROMISSO</h1><p class="c"><b>${agente ? 'AGENTE DE CAMPO' : 'BOLSISTA'}</b></p>
      <p class="c">Projeto ${E(P().nome)}: Fortalecimento da Produção Agroecológica e da Inclusão Produtiva no Nordeste Brasileiro (${E(P().marca)})</p>
      <p class="c peq">Execução: IFRN Campus Apodi · Parceria: MPA · Gestão administrativa e financeira: FUNCERN · Recursos: MDA</p>
      <h2>1. Quem assina este termo</h2>
      <dl><div><dt>Nome completo:</dt><dd>${v(m.nome, 120)}</dd></div>
        <div><dt>CPF:</dt><dd>${v(m.cpf && R.fmtCPF(m.cpf), 45)} &nbsp; Celular: ${v(m.telefone, 45)}</dd></div>
        <div><dt>E-mail:</dt><dd>${v(m.email, 120)}</dd></div>
        <div><dt>Município onde mora:</dt><dd>${v(m.municipio, 90)}</dd></div>
        <div><dt>Função no projeto:</dt><dd>${v(papel.nome, 70)}</dd></div>
        <div><dt>Estado de atuação:</dt><dd>${v(onde, 70)}</dd></div>
        <div><dt>Início das atividades:</dt><dd>${v(m.data_inicio && R.fmtData(m.data_inicio), 35)}</dd></div></dl>
      <h2>2. O que eu vou receber</h2>
      <ol>${agente
        ? '<li><b>A agente de campo não recebe bolsa</b>: recebe ajuda de custo pelas visitas feitas e registradas no sistema do projeto, calculada pelas regras do projeto.</li>'
        : `<li><b>Bolsa mensal</b> no valor previsto no plano de trabalho do projeto para a minha função: ${papel.bolsa ? '<b class="pre">' + E(R.fmtBRL(papel.bolsa)) + '</b>' : v('', 30)}.</li>
           <li>As visitas de campo que eu fizer e registrar no sistema são pagas por ajuda de custo, calculada pelas regras do projeto.</li>`}
        <li>O pagamento é feito pela FUNCERN, uma vez por mês, em conta bancária ou chave Pix no meu nome.</li>
        <li>A bolsa e a ajuda de custo não geram vínculo empregatício com o IFRN, a FUNCERN ou o MDA.</li></ol>
      <h2>3. O que eu me comprometo a fazer</h2>
      <ol><li>Cumprir as atividades da minha função e o plano de trabalho combinado com a coordenação técnica.</li>
        ${R.fazFIC(m.papel) ? '<li>Manter ativa a minha matrícula no curso FIC do IFRN durante toda a participação e entrar no ambiente do curso (AVA) pelo menos uma vez por mês.</li>' : ''}
        <li>Entregar todo mês as comprovações do que foi feito: fotos das visitas e atividades, listas de presença assinadas, relatório do mês, fichas dos quintais e andamento das metas.</li>
        <li>Registrar o meu trabalho no sistema do projeto. Visita de campo só é paga se estiver registrada, com fotos, localização e o relato do que foi feito.</li>
        <li>Dar informações verdadeiras e manter atualizados os meus dados e a minha conta bancária.</li>
        <li>Avisar a coordenação se eu receber ou passar a receber outra bolsa.</li>
        <li>Proteger os dados das mulheres atendidas: usar só para o projeto, não repassar a terceiros e não divulgar imagem sem autorização (Lei nº 13.709/2018, LGPD).</li>
        <li>Avisar a coordenação técnica com antecedência se eu precisar sair do projeto.</li></ol>
      <h2>4. O que eu sei</h2>
      <ol><li>Cada mês só é pago depois que as entregas daquele mês forem apresentadas e conferidas, porque o projeto presta contas ao MDA.</li>
        <li>Minha participação vale da data de início das atividades até a minha saída ou até o fim do projeto (${E(R.fmtData(P().vigencia.fim))}), o que acontecer primeiro.</li>
        <li>Autorizo o uso dos meus dados pessoais pelo IFRN, pelo MPA e pela FUNCERN para a execução do projeto, o pagamento e a prestação de contas.</li></ol>
      <h2>5. Quando a bolsa ou a participação é cancelada</h2>
      <ol><li>A meu pedido.</li><li>Se eu descumprir o plano de trabalho.</li><li>Se eu ficar dois meses seguidos sem entregar o relatório mensal.</li><li>Se eu der informação falsa.</li><li>No encerramento do projeto.</li></ol>
      <p style="margin-top:8px">Declaro que li este termo, entendi e concordo com ele.</p>
      <p>${v('', 70)}, ____ / ____ / ________ <span class="peq">(local e data)</span></p>
      <div class="assina ${m.papel === 'coord_tecnico' ? 'duas' : 'tres'}" style="margin-top:14mm"><div><span class="ln"></span>${E(m.nome || 'Bolsista ou agente de campo')}<small>${E(papel.nome || '')}</small></div>
        ${m.papel === 'coord_tecnico' ? '' : '<div><span class="ln"></span>Coordenação técnica<small>MPA</small></div>'}<div><span class="ln"></span>Coordenação geral<small>IFRN Campus Apodi</small></div></div>
      <p class="pe">${E(P().nome)} · ${E(P().ted)} · Processo ${E(P().processo)}</p>`;
  }

  /* ---------- servidor do IFRN: Anexo I da Portaria 017/2017 – SUP/FUNCERN ---------- */
  function corpoServidor(m) {
    const papel = MQ.PAPEIS[m.papel] || {};
    return `<p class="c"><b><u>ANEXO I</u></b></p><p class="c"><b>(Portaria nº. 017/2017 – SUP/FUNCERN de 24/11/2017)</b></p>
      <h1 style="margin-top:8mm">TERMO DE AUTORIZAÇÃO DE PARTICIPAÇÃO EM PROGRAMA<br>GERENCIADO PELA FUNCERN – FUNDAÇÃO DE APOIO AO IFRN</h1>
      <p class="rec" style="margin-top:8mm">Sr(a). Diretor(a)-Geral do <i>Campus</i> ${v('', 45)} do IFRN,</p>
      <p class="j rec" style="line-height:1.8">Eu, ${v(m.nome, 90)}, Matrícula SIAPE nº ${v(m.siape, 28)}, ocupante do cargo de ${v('', 55)}, com Regime de Trabalho de ${v('', 45)}, lotado(a) no <i>Campus</i> ${v('', 45)}
        do Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte, fui convidado(a) a participar do PROJETO ${E(String(P().nome).toUpperCase())}, na condição de ${v(papel.nome, 50)},
        a ser desenvolvido pela <b>Fundação de Apoio à Educação e ao Desenvolvimento Tecnológico do RN – FUNCERN</b>, com a anuência da Superintendência desta, em consonância com o artigo 21, § 4º, da Lei nº. 12.772/2012
        e o artigo 14, § 1º, alínea “d”, do Decreto 94.664/87 (<i>regime de dedicação exclusiva</i>), com a Lei nº. 8.958/94, regulamentada através do Decreto nº. 7.423/2010, e a Lei nº. 13.243/2016, Lei da Inovação Tecnológica no ambiente produtivo.</p>
      <p class="j rec" style="line-height:1.8">Nestes termos, solicito a Vossa Senhoria autorizar a minha participação no projeto supracitado, com espeque nos artigos 26 e 27, da Resolução 53/2021 - CONSUP/IFRN, o qual será desenvolvido no período de
        ${v(m.data_inicio && R.fmtData(m.data_inicio), 30)} a ${v(R.fmtData(P().vigencia.fim), 30)}, sem prejuízo de minhas atribuições funcionais.</p>
      <p class="c" style="margin-top:8mm">Em ____ / ____ / ________.</p>
      <div class="um"><span class="ln"></span>Assinatura do(a) Requerente</div>
      <div class="assina duas"><div><b>Parecer da Chefia Imediata:</b><br>APROVO ( &nbsp; ) &nbsp; NÃO APROVO ( &nbsp; )<span class="ln" style="margin-top:6mm"></span>Assinatura e carimbo</div>
        <div><b>Parecer do(a) Diretor(a)-Geral:</b><br>APROVO ( &nbsp; ) &nbsp; NÃO APROVO ( &nbsp; )<span class="ln" style="margin-top:6mm"></span>Assinatura e carimbo</div></div>`;
  }

  /* o que o sistema não tem e a pessoa completa à mão (aparece só na tela, não sai no papel) */
  function faltando(m) {
    const f = [];
    if (R.tipoTermo(m) === 'servidor') { if (!m.siape) f.push('matrícula SIAPE'); f.push('cargo', 'regime de trabalho', 'campus de lotação'); }
    else { if (!m.municipio) f.push('município onde mora'); if (!m.telefone) f.push('celular'); }
    if (!m.data_inicio) f.push('data de início');
    return f;
  }
  function pagina(m) {
    const serv = R.tipoTermo(m) === 'servidor'; const f = faltando(m);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${serv ? 'Termo de autorização' : 'Termo de compromisso'} · ${E(m.nome || '')}</title><style>${CSS}</style></head>
      <body><div class="tela"><span>Confira os dados. ${f.length ? 'Complete à mão: <b>' + E(f.join(', ')) + '</b>. ' : ''}Depois imprima (ou salve em PDF), assine e anexe no sistema.</span>
        <button type="button" onclick="window.close()">Fechar</button><button type="button" class="pri" onclick="window.print()">Imprimir ou salvar em PDF</button></div>
      <main>${serv ? corpoServidor(m) : corpoBolsista(m)}</main></body></html>`;
  }
  /* abre em outra aba (funciona também no celular); sem aba, imprime por um quadro escondido */
  function abrir(m) {
    const html = pagina(m);
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); return true; }
    const q = document.createElement('iframe'); q.style.position = 'fixed'; q.style.width = q.style.height = '0'; q.style.border = '0'; q.setAttribute('aria-hidden', 'true');
    document.body.appendChild(q); q.contentDocument.open(); q.contentDocument.write(html); q.contentDocument.close();
    setTimeout(() => { q.contentWindow.focus(); q.contentWindow.print(); setTimeout(() => q.remove(), 2000); }, 400);
    return true;
  }
  MQ.termoUI = { pagina, abrir, faltando };
})();
