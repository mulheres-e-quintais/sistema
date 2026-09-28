/* Mulheres & Quintais — link de cadastro: a própria pessoa preenche os dados; quem cadastra confere e aprova.
   Rota pública: #convite=CÓDIGO (sem login). */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const R = MQ.regras; const P = MQ.PAPEIS;
  const $ = s => document.querySelector(s);
  const C = { links: {} };   // links gerados nesta sessão, por vaga

  const endereco = token => location.origin + location.pathname + '#convite=' + encodeURIComponent(token);
  const funcao = (papel, uf) => P[papel].nome + (uf ? ' · ' + U().nomeUF(uf) : '');

  /* ---------- dados pessoais complementares (mesmos campos no link e no cadastro pela coordenação) ---------- */
  const ESCOLARIDADE = ['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Técnico', 'Superior incompleto', 'Superior completo', 'Pós-graduação'];
  const RACA = ['Preta', 'Parda', 'Branca', 'Amarela', 'Indígena', 'Prefiro não informar'];
  function camposPessoais(d, pub) {
    d = d || {}; const en = d.endereco || {}; const se = d.socioeconomico || null; const v = x => E(x == null ? '' : x);
    const op = (lista, sel) => '<option value="">Selecione…</option>' + lista.map(x => `<option ${x === sel ? 'selected' : ''}>${E(x)}</option>`).join('');
    return `<fieldset><legend>Mais dados pessoais</legend><div class="campos">
        <div class="campo"><label for="dp-soc">Nome social <span class="muted">(se usar)</span></label><input id="dp-soc" name="nome_social" value="${v(d.nome_social)}" placeholder="Como prefere ser chamada"></div>
        <div class="campo"><label for="dp-nasc">Data de nascimento</label><input id="dp-nasc" name="data_nascimento" type="date" value="${v(d.data_nascimento)}" max="${R.hoje()}" ${pub ? 'required' : ''}></div>
        <div class="campo inteiro"><label for="dp-nis">PIS/NIS/PASEP <span class="muted">(se tiver)</span></label><input id="dp-nis" name="nis" inputmode="numeric" value="${v(d.nis)}" placeholder="000.00000.00-0"></div>
      </div></fieldset>
      <fieldset><legend>Endereço</legend>
        <p class="small muted" style="margin-top:-6px">Usado para calcular a ajuda de custo das visitas (distância até os quintais) e para a FUNCERN.</p>
        <div class="campos">
        <div class="campo"><label for="dp-cep">CEP</label><input id="dp-cep" name="cep" inputmode="numeric" value="${v(en.cep)}" placeholder="00000-000" data-cep><span class="dica" id="dp-cep-dica">Preenche o resto sozinho quando há internet.</span></div>
        <div class="campo"><label for="dp-num">Número</label><input id="dp-num" name="numero" value="${v(en.numero)}" placeholder="s/n se não tiver"></div>
        <div class="campo inteiro"><label for="dp-log">Logradouro (rua, sítio, estrada)</label><input id="dp-log" name="logradouro" value="${v(en.logradouro)}"></div>
        <div class="campo"><label for="dp-comp">Complemento</label><input id="dp-comp" name="complemento" value="${v(en.complemento)}"></div>
        <div class="campo"><label for="dp-bai">Bairro ou comunidade</label><input id="dp-bai" name="bairro" value="${v(en.bairro)}"></div>
        <div class="campo"><label for="dp-cid">Cidade</label><input id="dp-cid" name="cidade" value="${v(en.cidade)}"></div>
        <div class="campo"><label for="dp-uf">Estado</label><select id="dp-uf" name="uf_end">${op(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE', 'Outro'], en.uf)}</select></div>
      </div></fieldset>
      <fieldset><legend>Questionário socioeconômico (opcional)</legend>
        <label class="check"><input type="checkbox" name="tem_socio" ${se ? 'checked' : ''} data-socio> <span>Responder. Os dados servem só para o perfil da equipe nos relatórios, sem nome.</span></label>
        <div class="campos" data-socio-campos ${se ? '' : 'hidden'}>
          <div class="campo"><label for="dp-esc">Escolaridade</label><select id="dp-esc" name="escolaridade">${op(ESCOLARIDADE, se && se.escolaridade)}</select></div>
          <div class="campo"><label for="dp-raca">Raça/cor</label><select id="dp-raca" name="raca_etnia">${op(RACA, se && se.raca_etnia)}</select></div>
          <div class="campo"><label for="dp-renda">Renda familiar por mês (R$)</label><input id="dp-renda" name="renda_familiar" type="number" min="0" inputmode="numeric" value="${v(se && se.renda_familiar)}"></div>
          <div class="campo"><label for="dp-pess">Pessoas na casa</label><input id="dp-pess" name="pessoas_casa" type="number" min="1" max="30" inputmode="numeric" value="${v(se && se.pessoas_casa)}"></div>
        </div></fieldset>`;
  }
  function lerPessoais(fd) {
    const t = k => String(fd.get(k) || '').trim();
    const endereco = { cep: R.soDigitos(t('cep')), logradouro: t('logradouro'), numero: t('numero'), complemento: t('complemento'), bairro: t('bairro'), cidade: t('cidade'), uf: t('uf_end') };
    Object.keys(endereco).forEach(k => { if (!endereco[k]) delete endereco[k]; });
    const socio = fd.get('tem_socio') ? { escolaridade: t('escolaridade') || null, raca_etnia: t('raca_etnia') || null,
      renda_familiar: t('renda_familiar') === '' ? null : +t('renda_familiar'), pessoas_casa: t('pessoas_casa') === '' ? null : +t('pessoas_casa') } : null;
    return { nome_social: t('nome_social') || null, data_nascimento: t('data_nascimento') || null, nis: R.soDigitos(t('nis')) || null, endereco, socioeconomico: socio };
  }
  function validarPessoais(d, pub) {
    const e = {};
    if (pub && !d.data_nascimento) e.data_nascimento = 'Informe a data de nascimento.';
    if (d.data_nascimento && (d.data_nascimento > R.hoje() || R.idade(d.data_nascimento) < 16)) e.data_nascimento = 'Data de nascimento inválida.';
    if (d.nis && d.nis.length !== 11) e.nis = 'O PIS/NIS tem 11 números.';
    if (d.endereco.cep && d.endereco.cep.length !== 8) e.cep = 'O CEP tem 8 números.';
    if (d.socioeconomico && (!d.socioeconomico.raca_etnia || d.socioeconomico.renda_familiar == null || !d.socioeconomico.pessoas_casa)) {
      if (!d.socioeconomico.raca_etnia) e.raca_etnia = 'Escolha uma opção (ou "Prefiro não informar").';
      if (d.socioeconomico.renda_familiar == null) e.renda_familiar = 'Informe a renda (0 se não tiver).';
      if (!d.socioeconomico.pessoas_casa) e.pessoas_casa = 'Informe quantas pessoas.';
    }
    return e;
  }
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches && t.matches('[data-socio]')) { const c = t.closest('fieldset').querySelector('[data-socio-campos]'); if (c) c.hidden = !t.checked; }
  });
  document.addEventListener('input', async ev => {
    const t = ev.target; if (!t.matches || !t.matches('[data-cep]')) return;
    const cep = R.soDigitos(t.value); t.value = cep.length > 5 ? cep.slice(0, 5) + '-' + cep.slice(5, 8) : cep;
    if (cep.length !== 8) return;
    const f = t.form; const dica = document.getElementById('dp-cep-dica');
    try {
      const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/'); const j = await r.json();
      if (j.erro) { if (dica) dica.textContent = 'CEP não encontrado. Preencha o endereço à mão.'; return; }
      [['logradouro', j.logradouro], ['bairro', j.bairro], ['cidade', j.localidade]].forEach(([k, val]) => { if (val && !f[k].value) f[k].value = val; });
      if (j.uf && f.uf_end) f.uf_end.value = [...f.uf_end.options].some(o => o.value === j.uf) ? j.uf : 'Outro';
      if (dica) dica.textContent = 'Endereço preenchido pelo CEP. Confira.';
    } catch (e) { if (dica) dica.textContent = 'Sem internet para buscar o CEP. Preencha à mão.'; }
  });

  /* dados pessoais já guardados de alguém da equipe (só coordenação e a própria pessoa conseguem ler) */
  const privCache = {};
  function privado(id) {
    if (id in privCache) return privCache[id];
    privCache[id] = undefined;
    if (S().api.lerPrivado) S().api.lerPrivado(id).then(d => { privCache[id] = d || null; if (S().painel) U().render(); }).catch(() => { privCache[id] = null; });
    return undefined;
  }
  const esquecerPrivado = id => { delete privCache[id]; };

  /* ---------- no formulário de cadastro: gerar o link ---------- */
  function blocoLink(p) {
    const chave = [p.papel, p.uf || '', p.subst || ''].join('|'); const tk = C.links[chave];
    if (!tk) return `<div class="bloco conv-bloco"><div><b>Prefere que ela mesma preencha?</b>
        <p class="small muted">Gere um link e mande por WhatsApp ou e-mail. Ela preenche os próprios dados e aceita o termo; você confere, completa e aprova. O link vale 7 dias e só pode ser usado uma vez.</p></div>
        <div class="acoes"><button class="btn" data-acao="conv-gerar" data-papel="${E(p.papel)}" data-uf="${E(p.uf || '')}" data-subst="${E(p.subst || '')}">Gerar link de cadastro</button></div></div>`;
    const url = endereco(tk);
    const msg = `Olá! Este é o link para você preencher o seu cadastro no sistema do projeto Mulheres & Quintais (${funcao(p.papel, p.uf)}). Vale por 7 dias: ${url}`;
    return `<div class="bloco conv-bloco ok"><div><b>Link pronto</b><p class="small muted">Mande para a pessoa. Quando ela enviar, o cadastro aparece na aba Equipe em "Cadastros enviados pelo link".</p></div>
      <div class="conv-link"><input readonly value="${E(url)}" aria-label="Link de cadastro" onclick="this.select()">
        <button class="btn peq" data-acao="conv-copiar" data-url="${E(url)}">Copiar</button>
        <a class="btn peq" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a></div></div>`;
  }

  /* ---------- aba Equipe: pré-cadastros aguardando ---------- */
  function secaoPendentes() {
    const lista = S().pre || [];
    if (!lista.length) return '';
    return `<section class="secao" aria-labelledby="t-pre"><div class="secao-cab"><div><h2 id="t-pre">Cadastros enviados pelo link <span class="conta-t">${lista.length}</span></h2>
        <p>Confira os dados, complete o que falta e aprove. Só depois de aprovada a pessoa entra na equipe e pode fazer o primeiro acesso.</p></div></div>
      <div class="lista-fichas">${lista.map(x => `<button class="vagabtn ficha-linha pre-linha" data-acao="conv-ver" data-id="${E(x.id)}">
          <span class="nm">${E(x.nome)}</span><span class="small muted">${E(funcao(x.papel, x.uf))} · enviado em ${R.fmtData(String(x.enviado_em).slice(0, 10))}</span>
          <span><span class="chip pend">Aguardando conferência</span></span></button>`).join('')}</div></section>`;
  }
  function painel(p) {
    const x = (S().pre || []).find(y => y.id === p.id); if (!x) return '<div class="painel-corpo"><p>Pré-cadastro não encontrado.</p></div>';
    const dl = [['Nome', x.nome], ['CPF', R.fmtCPF(x.cpf)], ['E-mail', x.email], ['Celular', x.telefone], ['Município', x.municipio], ['Organização', x.organizacao],
      ['Nome social', x.nome_social], ['Nascimento', x.data_nascimento && R.fmtData(x.data_nascimento)], ['PIS/NIS', x.nis],
      ['Endereço', textoEndereco(x.endereco)], ['Socioeconômico', x.socioeconomico ? 'Respondido' : 'Não respondeu'],
      ['Termo de dados (LGPD)', 'Aceito por ela no envio'], ['Enviado em', new Date(x.enviado_em).toLocaleString('pt-BR')]].filter(l => l[1]);
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Cadastro enviado pelo link</span><h2 id="painel-t">${E(x.nome)}</h2>
        <span class="small muted">${E(funcao(x.papel, x.uf))}</span></div><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        <div class="bloco"><h3>O que ela preencheu</h3><dl class="dl">${dl.map(([k, v]) => `<dt>${k}</dt><dd>${E(v)}</dd>`).join('')}</dl></div>
        <div class="acoes"><button class="btn pri" data-acao="conv-aprovar" data-id="${E(x.id)}">Conferir e cadastrar</button></div>
        <form class="bloco" data-form="conv-recusar" data-id="${E(x.id)}" novalidate><h3>Recusar</h3>
          <p class="small muted">Use se não for a pessoa indicada ou se os dados estiverem errados. Para corrigir, é melhor aprovar e editar depois.</p>
          <div class="campo"><label for="cr-obs">Motivo</label><textarea id="cr-obs" name="obs"></textarea></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes"><button class="btn perigo" type="submit">Recusar cadastro</button></div></form>
      </div>`;
  }
  function textoEndereco(en) {
    en = en || {}; const l1 = [en.logradouro, en.numero].filter(Boolean).join(', '); const l2 = [en.complemento, en.bairro].filter(Boolean).join(' · ');
    const l3 = [en.cidade, en.uf].filter(Boolean).join('/'); const t = [l1, l2, l3, en.cep && 'CEP ' + en.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')].filter(Boolean).join(' · ');
    return t || null;
  }
  // dados do pré-cadastro para preencher o formulário de cadastro
  function dadosPre(id) {
    const x = (S().pre || []).find(y => y.id === id); if (!x) return null;
    return { nome: x.nome, nome_social: x.nome_social, cpf: x.cpf, email: x.email, telefone: x.telefone, municipio: x.municipio || (x.endereco || {}).cidade, organizacao: x.organizacao,
      consentimento_lgpd: true, _pre: x, _priv: { data_nascimento: x.data_nascimento, nis: x.nis, endereco: x.endereco || {}, socioeconomico: x.socioeconomico } };
  }

  /* ---------- página pública do link ---------- */
  const PUB = { token: null, conv: null, enviado: false };
  function pagina(token) {
    if (PUB.token !== token) { PUB.token = token; PUB.conv = null; PUB.enviado = false;
      setTimeout(async () => { try { PUB.conv = await S().api.verConvite(token); } catch (e) { PUB.conv = { valido: false, motivo: 'erro', erro: e.message }; } desenhar(); }, 0); }
    return `<main class="wrap" id="convite">${corpo()}</main>`;
  }
  function desenhar() { const el = $('#convite'); if (el) el.innerHTML = corpo(); }
  function corpo() {
    const c = PUB.conv;
    if (!c) return '<p class="carregando">Abrindo o link…</p>';
    if (PUB.enviado) return `<div class="login"><div class="login-marca"><img src="assets/isotipo.svg" alt="" width="40" height="58"><span class="eyebrow">Cadastro recebido</span></div>
      <h1>Obrigada!</h1><p>Seus dados foram enviados para a coordenação do projeto conferir.</p>
      <div class="aviso"><b>Próximo passo:</b> quando a coordenação aprovar, entre em <a href="${E(location.origin + location.pathname)}">${E(location.host + location.pathname)}</a>, escolha <b>Primeiro acesso</b> e crie a sua senha com o e-mail que você informou.</div></div>`;
    if (!c.valido) {
      const msg = { usado: 'Este link já foi usado.', vencido: 'Este link venceu (vale 7 dias).', cancelado: 'Este link foi cancelado.', inexistente: 'Link não encontrado. Confira se copiou inteiro.' }[c.motivo] || ('Não foi possível abrir o link. ' + (c.erro || ''));
      return `<div class="login"><h1>Link sem validade</h1><p>${E(msg)} Peça um novo à coordenação do projeto.</p></div>`;
    }
    const munis = c.uf ? (MQ.MUNICIPIOS[c.uf] || []) : [];
    return `<form class="login conv-form" data-form="conv-enviar" novalidate>
      <div class="login-marca"><img src="assets/isotipo.svg" alt="" width="40" height="58"><span class="eyebrow">Cadastro na equipe</span></div>
      <div><h1>Seus dados</h1><p class="muted" style="margin-top:6px">Você foi indicada para <b>${E(funcao(c.papel, c.uf))}</b> no projeto Quintais Produtivos para Mulheres Rurais. Preencha e envie; a coordenação confere antes de liberar o acesso.</p></div>
      <div class="campo"><label for="cv-nome">Nome completo</label><input id="cv-nome" name="nome" autocomplete="name" required></div>
      <div class="campos">
        <div class="campo"><label for="cv-cpf">CPF</label><input id="cv-cpf" name="cpf" inputmode="numeric" autocomplete="off" required></div>
        <div class="campo"><label for="cv-tel">Celular (WhatsApp)</label><input id="cv-tel" name="telefone" inputmode="tel" autocomplete="tel"></div></div>
      <div class="campo"><label for="cv-email">E-mail</label><input id="cv-email" name="email" type="email" autocomplete="email" required>
        <span class="dica">É com este e-mail que você vai entrar no sistema. Use um que você acessa sempre.</span></div>
      <div class="campos">
        <div class="campo inteiro"><label for="cv-org">Organização ou movimento</label><input id="cv-org" name="organizacao" placeholder="Ex.: MPA, associação, sindicato"></div></div>
      ${camposPessoais({}, true)}
      <label class="check"><input type="checkbox" name="consentimento_lgpd"> <span>Autorizo o projeto (IFRN, MDA, MPA e FUNCERN) a usar estes dados para o meu cadastro na equipe, o pagamento e a prestação de contas, conforme a Lei nº 13.709/2018. Posso pedir correção a qualquer momento.</span></label>
      <div class="aviso erro" data-erro hidden></div>
      <button class="btn pri" type="submit">Enviar meus dados</button>
      <p class="nota">Não pedimos conta bancária nem Pix aqui: isso é entregue direto à FUNCERN.</p></form>`;
  }

  /* ---------- ações ---------- */
  async function clique(a, el) {
    if (a === 'conv-gerar') {
      const tk = await S().api.criarConvite(el.dataset.papel, el.dataset.uf || null, el.dataset.subst || null);
      C.links[[el.dataset.papel, el.dataset.uf || '', el.dataset.subst || ''].join('|')] = tk;
      const box = el.closest('.conv-bloco'); if (box) box.outerHTML = blocoLink({ papel: el.dataset.papel, uf: el.dataset.uf, subst: el.dataset.subst });
    } else if (a === 'conv-copiar') {
      try { await navigator.clipboard.writeText(el.dataset.url); U().toast('Link copiado.'); }
      catch (e) { const i = el.parentElement.querySelector('input'); i.select(); U().toast('Selecione e copie o link.'); }
    } else if (a === 'conv-ver') U().abrirPainel({ tipo: 'pre-ver', id: el.dataset.id });
    else if (a === 'conv-aprovar') {
      const x = (S().pre || []).find(y => y.id === el.dataset.id);
      U().abrirPainel({ tipo: 'cadastro', papel: x.papel, uf: x.uf, subst: x.substitui_id, pre: x.id });
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo === 'conv-enviar') {
      const d = { nome: String(fd.get('nome') || '').trim().replace(/\s+/g, ' '), cpf: R.soDigitos(fd.get('cpf')), email: String(fd.get('email') || '').trim().toLowerCase(),
        telefone: String(fd.get('telefone') || '').trim(), municipio: String(fd.get('municipio') || '').trim(), organizacao: String(fd.get('organizacao') || '').trim(),
        consentimento_lgpd: !!fd.get('consentimento_lgpd') };
      Object.assign(d, lerPessoais(fd)); d.municipio = d.endereco.cidade || '';
      const erros = validarPessoais(d, true);
      if (d.nome.split(' ').length < 2 || d.nome.length < 5) erros.nome = 'Escreva o nome completo.';
      if (!R.cpfValido(d.cpf)) erros.cpf = 'CPF inválido. Confira os números.';
      if (!R.emailValido(d.email)) erros.email = 'E-mail inválido.';
      if (!d.consentimento_lgpd) erros.consentimento_lgpd = 'É preciso autorizar para enviar.';
      if (Object.keys(erros).length) return U().mostrarErros(form, erros);
      await U().ocupado(form, async () => { await S().api.enviarPreCadastro(PUB.token, d); PUB.enviado = true; desenhar(); window.scrollTo(0, 0); });
    } else if (tipo === 'conv-recusar') {
      const obs = String(fd.get('obs') || '').trim();
      if (obs.length < 5) return U().mostrarErros(form, { obs: 'Escreva o motivo.' });
      await U().ocupado(form, async () => { await S().api.decidirPreCadastro(form.dataset.id, 'recusado', obs); await U().carregar(); U().fecharPainel(); U().render(); U().toast('Cadastro recusado.'); });
    }
  }

  MQ.convitesUI = { blocoLink, secaoPendentes, painel, dadosPre, pagina, clique, enviar, camposPessoais, lerPessoais, validarPessoais, privado, esquecerPrivado, textoEndereco };
})();
