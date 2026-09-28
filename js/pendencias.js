/* Mulheres & Quintais — pendências do próprio cadastro.
   Ao entrar, a pessoa vê o que falta no cadastro dela (e o que depende dela ou de outra pessoa).
   A faixa fica no topo enquanto houver pendência; o quadro abre sozinho uma vez por sessão. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const R = MQ.regras;
  const CHAVE = 'mq-pend-visto-';

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
      if (p.id === 'termo') itens.push({ id: 'termo', t: 'Termo de compromisso ainda não assinado',
        d: 'Assine o termo de compromisso e entregue a ' + quemHab + ', que registra no sistema.' });
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
      <button class="btn peq pri" data-acao="pend-ver">Ver e resolver</button></div></div>`;
  }

  /* abre o quadro sozinho uma vez por sessão, quando tudo já carregou */
  function cobrar() {
    const l = lista(); if (!l || l.carregando || !l.itens.length || S().painel) return;
    const k = CHAVE + l.m.id;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { if (S().pendVisto) return; }
    S().pendVisto = true;
    U().abrirPainel({ tipo: 'pend' });
  }

  function painel(p) {
    const l = lista() || { itens: [] };
    const cab = t => `<div class="painel-cab"><div class="t"><span class="eyebrow">Seu cadastro</span><h2 id="painel-t">${t}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
    if (p.tipo === 'pend-banco') return cab('Conta bancária') + `<div class="painel-corpo">${MQ.bancoUI.secaoMinha()}
      <div class="acoes"><button class="btn" data-acao="pend-ver">Voltar às pendências</button></div></div>`;
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
        <div class="campo"><label for="dp-nasc">Data de nascimento</label><input id="dp-nasc" name="data_nascimento" type="date" value="${v(pv.data_nascimento)}" max="${R.hoje()}" required></div>
        <div class="campo"><label for="dp-nis">PIS/NIS/PASEP <span class="muted">(se tiver)</span></label><input id="dp-nis" name="nis" inputmode="numeric" value="${v(pv.nis)}"></div></div>`}
      <div class="campos">
        ${arlo ? '' : `<div class="campo"><label for="dp-cep">CEP</label><input id="dp-cep" name="cep" inputmode="numeric" value="${v(en.cep)}" placeholder="00000-000" data-cep><span class="dica" id="dp-cep-dica">Preenche o resto sozinho quando há internet.</span></div>
        <div class="campo"><label for="dp-num">Número</label><input id="dp-num" name="numero" value="${v(en.numero)}" placeholder="s/n se não tiver"></div>
        <div class="campo inteiro"><label for="dp-log">Logradouro (rua, sítio, estrada)</label><input id="dp-log" name="logradouro" value="${v(en.logradouro)}" required></div>
        <div class="campo"><label for="dp-comp">Complemento</label><input id="dp-comp" name="complemento" value="${v(en.complemento)}"></div>
        <div class="campo"><label for="dp-bai">Bairro ou comunidade</label><input id="dp-bai" name="bairro" value="${v(en.bairro)}"></div>`}
        <div class="campo"><label for="dp-cid">Cidade</label><input id="dp-cid" name="cidade" value="${v(en.cidade)}" required></div>
        <div class="campo"><label for="dp-uf">Estado</label><select id="dp-uf" name="uf_end">${op(en.uf)}</select></div>
      </div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="pend-ver">Voltar</button></div></form>`;
  }

  async function enviar(tipo, form, fd) {
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
    else if (!arlo && (d.data_nascimento > R.hoje() || R.idade(d.data_nascimento) < 16)) e.data_nascimento = 'Data de nascimento inválida.';
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

  async function clique(a) {
    if (a === 'pend-ver') U().abrirPainel({ tipo: 'pend' });
    else if (a === 'pend-dados') U().abrirPainel({ tipo: 'pend-dados' });
    else if (a === 'pend-banco') {
      // a tela da pessoa já tem o bloco da conta: vai direto a ele (evita dois formulários iguais)
      const sec = document.querySelector('main #banco-meu');
      if (sec) { U().fecharPainel(); sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); const f = sec.querySelector('select, input, button'); if (f) f.focus({ preventScroll: true }); }
      else U().abrirPainel({ tipo: 'pend-banco' });
    }
  }

  MQ.pendUI = { lista, faixa, cobrar, painel, clique, enviar };
})();
