/* Mulheres & Quintais — pendências do próprio cadastro.
   Ao entrar, a pessoa vê o que falta no cadastro dela (e o que depende dela ou de outra pessoa).
   A faixa fica no topo enquanto houver pendência; o quadro abre sozinho uma vez por sessão. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const R = MQ.regras;
  const CHAVE = 'mq-pend-visto-';
  /* limites dos dados pessoais (os mesmos do cadastro pelo link, em convites.js): nascimento de 1900 até hoje menos 16 anos; textos com tamanho máximo */
  const NASC_MIN = '1900-01-01';
  const nascMax = () => { const h = R.hoje(); return (+h.slice(0, 4) - 16) + h.slice(4); };
  const LIM = { logradouro: 120, bairro: 120, complemento: 120, cidade: 120, numero: 20, cep: 9, nis: 14 };
  const ROT = { logradouro: 'Logradouro', bairro: 'Bairro', complemento: 'Complemento', cidade: 'Cidade', numero: 'Número' };

  function eu() {
    const s = S(); if (!s.eu || s.eu.papel === 'coord_geral') return null;
    return Object.assign({}, s.eu, (s.equipe || []).find(x => x.id === s.eu.id) || {});
  }
  function nomeDe(papel) { const p = (S().equipe || []).find(x => x.papel === papel && x.status === 'ativa'); return p ? (p.nome_social || p.nome).split(' ')[0] : ''; }

  /* { itens: [...], carregando } ou null (coordenação geral / sem login) */
  function lista() {
    const m = eu(); if (!m) return null;
    if (m.status !== 'ativa') return { itens: [], carregando: false, m };
    const itens = []; let carregando = false;
    const campo = R.ehCampo(m.papel);
    const pv = MQ.convitesUI && S().api.lerPrivado ? MQ.convitesUI.privado(m.id) : null;
    if (pv === undefined) carregando = true;
    const en = (pv && pv.endereco) || {};
    const agente = m.papel === 'agente';
    const oQue = agente ? 'a ajuda de custo das visitas' : 'a bolsa';

    // o que a própria pessoa resolve aqui mesmo
    if (!m.cadastro_arlo) {
      if (pv !== undefined) {
        const falta = [];
        if (!pv || !pv.data_nascimento) falta.push('data de nascimento');
        if (!en.logradouro || !en.cidade) falta.push('endereço');
        if (falta.length) itens.push({ id: 'dados', seu: true, t: 'Complete os seus dados pessoais',
          d: 'Falta: ' + falta.join(' e ') + '. ' + (m.papel === 'auxiliar_adm' ? 'A coordenação geral precisa' : 'O auxiliar administrativo precisa') + ' deles para o seu cadastro no Arlo (FUNCERN).', acao: 'pend-dados', btn: 'Completar agora' });
      }
      const b = MQ.bancoUI ? MQ.bancoUI.estado() : { erro: 1 };
      if (b === null) carregando = true;
      else if (b === false) itens.push({ id: 'banco', seu: true, t: 'Informe a sua conta bancária',
        d: 'Sem a conta, a FUNCERN não consegue pagar ' + oQue + '. A conta precisa estar no seu nome.', acao: 'pend-banco', btn: 'Informar conta' });
    } else if (campo && pv !== undefined && !en.cidade) {
      itens.push({ id: 'cidade', seu: true, t: 'Informe a cidade onde mora',
        d: 'O sistema calcula a ajuda de custo das visitas pela distância da sua cidade até os quintais.', acao: 'pend-dados', btn: 'Informar cidade' });
    }

    // o que depende de outra pessoa (a pessoa precisa cobrar)
    const aux = nomeDe('auxiliar_adm');
    const quemHab = ['auxiliar_adm'].includes(m.papel) ? 'a coordenação geral' : 'o auxiliar administrativo' + (aux ? ' (' + aux + ')' : '');
    R.passosHabilitacao(m).filter(p => !p.feito && p.id !== 'dados').forEach(p => {
      if (p.id === 'fic') itens.push({ id: 'fic', t: 'Matrícula no curso FIC ainda não registrada',
        d: 'Procure os professores do curso FIC para fazer a matrícula e receber o acesso ao AVA.' });
      if (p.id === 'funcern') itens.push({ id: 'arlo', t: 'Cadastro no Arlo (FUNCERN) ainda não registrado',
        d: (m.cadastro_arlo ? 'Você informou que já tem cadastro no Arlo: ' + quemHab + ' precisa conferir e registrar.' : 'Quem faz o seu cadastro no Arlo é ' + quemHab + ', com os seus dados e a sua conta.') + ' Se pedirem algum documento, envie logo.' });
      // 48: o termo é anexado pela própria pessoa (modelo preenchido e assinado); quem confere abre o arquivo e registra a data
      if (p.id === 'termo') itens.push(p.enviado
        ? { id: 'termo', t: 'Termo de compromisso enviado: aguardando conferência',
            d: 'Você anexou o termo. Agora ' + quemHab + ' abre o arquivo, confere se está preenchido e assinado e registra a data.', acao: 'pend-termo', btn: 'Ver ou trocar' }
        : { id: 'termo', seu: true, t: 'Envie o seu termo de compromisso',
            d: 'Baixe o modelo, preencha com os seus dados, assine e anexe aqui. Depois ' + quemHab + ' confere.', acao: 'pend-termo', btn: 'Enviar termo' });
    });
    return { itens, carregando, m };
  }

  function consequencia(l) {
    const hab = l.itens.some(i => ['fic', 'arlo', 'termo', 'banco', 'dados'].includes(i.id));
    if (!hab) return '';
    return l.m.papel === 'agente'
      ? 'Enquanto isso não for resolvido, você não pode ser escalada para visitas nem receber a ajuda de custo.'
      : 'Enquanto isso não for resolvido, a FUNCERN não paga ' + (l.m.papel === 'coord_tecnico' || l.m.papel === 'professor_fic' || R.ehBolsista(l.m.papel) ? 'a sua bolsa.' : 'o que é devido a você.');
  }

  /* faixa no topo de todas as telas */
  function faixa() {
    const l = lista(); if (!l || !l.itens.length) return '';
    const seus = l.itens.filter(i => i.seu).length;
    return `<div class="pend-faixa" role="status"><div class="pend-in">
      <span class="pend-ic" aria-hidden="true">!</span>
      <span><b>Seu cadastro tem ${l.itens.length} pendência${l.itens.length > 1 ? 's' : ''}.</b> ${seus ? `${seus === 1 ? 'Uma depende' : seus + ' dependem'} só de você.` : 'Cobre quem precisa resolver.'} <span class="pend-cons">${E(consequencia(l))}</span></span>
      ${MQ.botaoAcao({ acao: 'pend-ver', texto: 'Resolver', icone: 'resolver', mini: true })}</div></div>`;
  }

  /* abre o quadro sozinho uma vez por sessão, quando tudo já carregou */
  function cobrar() {
    const l = lista(); if (!l || l.carregando || !l.itens.length || S().painel) return;
    const k = CHAVE + l.m.id;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { if (S().pendVisto) return; }
    S().pendVisto = true;
    // abre sozinho: ao fechar, o foco vai para o botão "Resolver" da faixa (não fica solto na página)
    const quem = document.querySelector('.pend-faixa [data-acao="pend-ver"]'); if (quem) S().acionador = quem;
    try { U().abrirPainel({ tipo: 'pend' }); } finally { if (S().acionador === quem) S().acionador = null; }
  }

  function painel(p) {
    const l = lista() || { itens: [] };
    const cab = t => `<div class="painel-cab"><div class="t"><span class="eyebrow">Seu cadastro</span><h2 id="painel-t">${t}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
    if (p.tipo === 'pend-banco') return cab('Conta bancária') + `<div class="painel-corpo">${MQ.bancoUI.secaoMinha(true)}
      <div class="acoes"><button class="btn" type="button" data-acao="pend-ver">Voltar</button></div></div>`;
    if (p.tipo === 'pend-termo') return cab('Termo de compromisso') + `<div class="painel-corpo">${formTermo(l.m || eu())}</div>`;
    if (p.tipo === 'pend-dados') return cab(l.m && l.m.cadastro_arlo ? 'Cidade onde mora' : 'Dados pessoais') + `<div class="painel-corpo">${formDados(l.m)}</div>`;
    if (!l.itens.length) return cab('Tudo em dia') + `<div class="painel-corpo"><p>Nenhuma pendência no seu cadastro.</p>
      <div class="acoes"><button class="btn pri" data-acao="fechar">Fechar</button></div></div>`;
    const seus = l.itens.filter(i => i.seu), outros = l.itens.filter(i => !i.seu);
    const item = i => `<li class="pend-item ${i.seu ? 'seu' : ''}"><div><b>${E(i.t)}</b><p class="small">${E(i.d)}</p></div>
      ${i.acao ? `<button class="btn pri peq" data-acao="${i.acao}">${E(i.btn)}</button>` : ''}</li>`;
    return cab('Pendências no seu cadastro') + `<div class="painel-corpo">
      ${consequencia(l) ? `<div class="aviso erro">${E(consequencia(l))}</div>` : ''}
      ${seus.length ? `<h3>Resolva agora</h3><ul class="pend-lista">${seus.map(item).join('')}</ul>` : ''}
      ${outros.length ? `<h3>Depende de outra pessoa: cobre</h3><ul class="pend-lista">${outros.map(item).join('')}</ul>` : ''}
      <div class="acoes"><button class="btn" data-acao="fechar">Lembrar depois</button></div>
      <p class="small muted">Este aviso aparece toda vez que você entra, até tudo ficar em dia.</p></div>`;
  }

  function formDados(m) {
    const pv = MQ.convitesUI.privado(m.id) || {}; const en = pv.endereco || {};
    const v = x => E(x == null ? '' : x);
    const op = sel => '<option value="">Selecione…</option>' + ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE', 'Outro'].map(x => `<option ${x === sel ? 'selected' : ''}>${x}</option>`).join('');
    const arlo = !!m.cadastro_arlo;
    return `<form class="f" data-form="pend-dados" novalidate>
      ${arlo ? '<p class="small muted">Você tem cadastro no Arlo: os outros dados ficam lá. Aqui só a cidade, para calcular a ajuda de custo das visitas.</p>' : `<div class="campos">
        <div class="campo"><label for="dp-nasc">Data de nascimento</label><input id="dp-nasc" name="data_nascimento" type="date" value="${v(pv.data_nascimento)}" min="${NASC_MIN}" max="${nascMax()}" required></div>
        <div class="campo"><label for="dp-nis">PIS/NIS/PASEP <span class="muted">(se tiver)</span></label><input id="dp-nis" name="nis" inputmode="numeric" value="${v(pv.nis)}" maxlength="${LIM.nis}"></div></div>`}
      <div class="campos">
        ${arlo ? '' : `<div class="campo"><label for="dp-cep">CEP</label><input id="dp-cep" name="cep" inputmode="numeric" value="${v(en.cep)}" placeholder="00000-000" maxlength="${LIM.cep}" data-cep><span class="dica" id="dp-cep-dica">Preenche o resto sozinho quando há internet.</span></div>
        <div class="campo"><label for="dp-num">Número</label><input id="dp-num" name="numero" value="${v(en.numero)}" maxlength="${LIM.numero}" placeholder="s/n se não tiver"></div>
        <div class="campo inteiro"><label for="dp-log">Logradouro (rua, sítio, estrada)</label><input id="dp-log" name="logradouro" value="${v(en.logradouro)}" maxlength="${LIM.logradouro}" required></div>
        <div class="campo"><label for="dp-comp">Complemento</label><input id="dp-comp" name="complemento" value="${v(en.complemento)}" maxlength="${LIM.complemento}"></div>
        <div class="campo"><label for="dp-bai">Bairro ou comunidade</label><input id="dp-bai" name="bairro" value="${v(en.bairro)}" maxlength="${LIM.bairro}"></div>`}
        <div class="campo"><label for="dp-cid">Cidade</label><input id="dp-cid" name="cidade" value="${v(en.cidade)}" maxlength="${LIM.cidade}" required></div>
        <div class="campo"><label for="dp-uf">Estado</label><select id="dp-uf" name="uf_end">${op(en.uf)}</select></div>
      </div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="pend-ver">Voltar</button></div></form>`;
  }

  /* ---------- termo de compromisso: a própria pessoa anexa (48) ---------- */
  const quemConfere = m => m && m.papel === 'auxiliar_adm' ? 'a coordenação geral' : 'o auxiliar administrativo';
  /* link do modelo (fica ao lado do campo de anexar); sem arquivo configurado em dados.js, orienta a pedir */
  function linkModelo(m) {
    const mod = m ? R.modeloTermo(m) : null;
    // o termo já sai preenchido com os dados do cadastro; o modelo em branco fica como segunda opção
    if (m && MQ.termoUI) return `<span class="termo-modelo termo-acoes"><button type="button" class="btn peq pri" data-acao="pend-termo-gerar" data-id="${E(m.id)}">Gerar o termo preenchido</button>${mod ? `<a class="link small" href="${E(mod.arquivo)}" download target="_blank" rel="noopener">modelo em branco</a>` : ''}</span>`;
    return mod
      ? `<a class="btn peq termo-modelo" href="${E(mod.arquivo)}" download target="_blank" rel="noopener" title="Modelo: ${E(mod.nome)}">Baixar o modelo do termo</a>`
      : `<span class="small muted termo-modelo">Peça o modelo do termo ${m ? quemConfere(m).replace(/^a /, 'à ').replace(/^o /, 'ao ') : 'à coordenação'}.</span>`;
  }
  function formTermo(m) {
    if (!m) return '';
    const sit = R.termoSituacao(m);
    if (sit === 'conferido') return `<div class="aviso ok"><b>Termo conferido em ${R.fmtData(m.termo_assinado_em)}.</b> Não há mais nada a fazer aqui.</div>
      <p class="small muted">Arquivo: ${E(R.nomeArquivo(m.termo_path) || 'registrado sem arquivo')}. Para trocar, fale com ${quemConfere(m)}.</p>
      <div class="acoes"><button class="btn" type="button" data-acao="pend-ver">Voltar</button></div>`;
    return `<form class="f" data-form="pend-termo" novalidate>
      ${sit === 'enviado' ? `<div class="aviso ok" role="status"><b>Termo enviado: ${E(R.nomeArquivo(m.termo_path))}.</b> Falta ${quemConfere(m)} conferir. Se mandou o arquivo errado, anexe outro: ele substitui o anterior.</div>` : ''}
      <ol class="conv-passos termo-passos">
        <li><span><b>Gere o seu termo</b> (${E((R.modeloTermo(m) || { nome: 'termo de compromisso' }).nome)}): ele já sai com os dados do seu cadastro.</span></li>
        <li><span><b>Confira, imprima e assine.</b> ${R.tipoTermo(m) === 'servidor' ? 'Complete o cargo, o regime de trabalho e o campus e colha o parecer da chefia imediata e da direção-geral do seu campus.' : 'Se algum dado estiver errado, peça a correção do cadastro antes de assinar. Sem impressora, peça uma cópia à coordenação técnica.'}</span></li>
        <li><span><b>Anexe aqui</b> o termo preenchido e assinado, em PDF ou foto do papel inteiro.</span></li></ol>
      <div class="campo" id="w-termo"><div class="rot-com-link"><label for="pt-arq">Termo preenchido e assinado (PDF ou foto)</label>${linkModelo(m)}</div>
        <input id="pt-arq" name="termo" type="file" accept="application/pdf,image/*" data-termo-arq required>
        <span class="dica">Até 10 MB. Em foto, pegue a folha inteira, com a assinatura legível.</span></div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit" data-termo-salvar disabled>${sit === 'enviado' ? 'Trocar o termo' : 'Enviar termo'}</button><button class="btn" type="button" data-acao="pend-ver">Voltar</button></div>
      <p class="small muted" data-termo-nota>O botão libera quando você escolher o arquivo.</p></form>`;
  }
  /* bloco em "Meus dados": situação do termo e o caminho para anexar */
  function secaoTermo() {
    const m = eu(); if (!m || m.status !== 'ativa') return '';
    const sit = R.termoSituacao(m);
    const chip = sit === 'conferido' ? ['ok', 'Conferido'] : sit === 'enviado' ? ['pend', 'Aguardando conferência'] : ['pend', 'Falta enviar'];
    return `<div class="bloco" id="meu-termo"><div class="banco-cab"><h3>Termo de compromisso</h3><span class="chip ${chip[0]}">${chip[1]}</span></div>
      <p class="small muted">${sit === 'conferido' ? 'Conferido em ' + R.fmtData(m.termo_assinado_em) + '.' : sit === 'enviado' ? 'Você anexou ' + E(R.nomeArquivo(m.termo_path)) + '. Falta ' + quemConfere(m) + ' conferir.' : 'Baixe o modelo, preencha com os seus dados, assine e anexe. Sem o termo conferido, a FUNCERN não paga.'}</p>
      ${sit === 'conferido' ? '' : `<div class="acoes">${sit === 'falta' ? linkModelo(m) : ''}<button class="btn ${sit === 'falta' ? 'pri' : ''} peq" type="button" data-acao="pend-termo">${sit === 'falta' ? 'Enviar termo' : 'Ver ou trocar'}</button></div>`}</div>`;
  }
  async function enviarTermo(form, fd) {
    const m = eu(); const arq = fd.get('termo'); const e = {};
    if (!arq || !arq.name) e.termo = 'Anexe o termo preenchido e assinado: sem o arquivo não dá para enviar.';
    else if (arq.size > 10 * 1024 * 1024) e.termo = 'Arquivo acima de 10 MB. Envie um PDF menor ou uma foto.';
    else if (MQ.arquivoConfere) { const falso = await MQ.arquivoConfere(arq, R.TERMO_EXT, { rotulo: 'PDF ou foto (JPG, PNG)' }); if (falso) e.termo = falso; }
    if (Object.keys(e).length) return U().mostrarErros(form, e);
    await U().ocupado(form, async () => {
      await S().api.enviarMeuTermo(m.id, arq);
      await U().recarregar();
      U().toast('Termo enviado. Falta ' + quemConfere(m) + ' conferir.');
      U().abrirPainel({ tipo: 'pend' });
    });
  }
  // o botão de enviar só libera com o arquivo escolhido
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('change', ev => {
    const t = ev.target; if (!t || !t.matches || !t.matches('[data-termo-arq]')) return;
    const f = t.closest('form'); if (!f) return; const tem = !!(t.files && t.files.length);
    const b = f.querySelector('[data-termo-salvar]'); if (b) b.disabled = !tem;
    const n = f.querySelector('[data-termo-nota]'); if (n) n.hidden = tem;
  });

  async function enviar(tipo, form, fd) {
    if (tipo === 'pend-termo') return enviarTermo(form, fd);
    if (tipo !== 'pend-dados') return;
    const m = eu(); const arlo = !!m.cadastro_arlo;
    const t = k => String(fd.get(k) || '').trim();
    const pv = MQ.convitesUI.privado(m.id) || {};
    const en = Object.assign({}, pv.endereco || {}, arlo ? { cidade: t('cidade'), uf: t('uf_end') }
      : { cep: R.soDigitos(t('cep')), logradouro: t('logradouro'), numero: t('numero'), complemento: t('complemento'), bairro: t('bairro'), cidade: t('cidade'), uf: t('uf_end') });
    Object.keys(en).forEach(k => { if (!en[k]) delete en[k]; });
    const d = { data_nascimento: arlo ? pv.data_nascimento || null : t('data_nascimento') || null, nis: arlo ? pv.nis || null : R.soDigitos(t('nis')) || null,
      endereco: en, socioeconomico: pv.socioeconomico || null };
    const e = {};
    if (!arlo && !d.data_nascimento) e.data_nascimento = 'Informe a data de nascimento.';
    else if (!arlo && d.data_nascimento !== (pv.data_nascimento || null)) {   // data antiga que não mudou não trava
      if (!R.dataValida(d.data_nascimento) || d.data_nascimento > R.hoje()) e.data_nascimento = 'Data de nascimento inválida.';
      else if (d.data_nascimento < NASC_MIN) e.data_nascimento = 'Confira o ano: a data de nascimento não pode ser antes de 1900.';
      else if (d.data_nascimento > nascMax()) e.data_nascimento = 'Confira o ano: é preciso ter pelo menos 16 anos.';
    }
    // tamanho dos textos do endereço (o que já estava gravado e não mudou não trava)
    Object.keys(ROT).forEach(k => { const antes = (pv.endereco || {})[k] || ''; if (en[k] && en[k] !== antes && String(en[k]).length > LIM[k]) e[k] = ROT[k] + ': texto muito longo (máximo ' + LIM[k] + ' caracteres).'; });
    if (d.nis && d.nis.length !== 11) e.nis = 'O PIS/NIS tem 11 números.';
    if (en.cep && en.cep.length !== 8) e.cep = 'O CEP tem 8 números.';
    if (!arlo && !en.logradouro) e.logradouro = 'Informe a rua, sítio ou estrada.';
    if (!en.cidade) e.cidade = 'Informe a cidade.';
    if (Object.keys(e).length) return U().mostrarErros(form, e);
    await U().ocupado(form, async () => {
      await S().api.salvarPrivado(m.id, d);
      MQ.convitesUI.esquecerPrivado(m.id);
      U().toast('Dados salvos.');
      U().abrirPainel({ tipo: 'pend' });
    });
  }

  async function clique(a, el) {
    if (a === 'pend-ver') U().abrirPainel({ tipo: 'pend' });
    else if (a === 'pend-dados') U().abrirPainel({ tipo: 'pend-dados' });
    else if (a === 'pend-banco') U().abrirPainel({ tipo: 'pend-banco' });
    else if (a === 'pend-termo') U().abrirPainel({ tipo: 'pend-termo' });
    else if (a === 'pend-termo-gerar' && MQ.termoUI) {   // a própria pessoa, ou quem confere (para entregar impresso a quem não tem como imprimir)
      const id = el && el.dataset.id; const m = id && id !== (S().eu || {}).id ? (S().equipe || []).find(x => x.id === id) : eu();
      if (m) MQ.termoUI.abrir(m); else U().toast('Não foi possível montar o termo: dados do cadastro não encontrados.');
    }
  }

  MQ.pendUI = { lista, faixa, cobrar, painel, clique, enviar, secaoTermo, linkModelo, formTermo };
})();
