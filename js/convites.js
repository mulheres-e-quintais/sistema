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
  /* papel: quem vai a campo (articulação, apoio, agente) informa a cidade mesmo com Arlo (cálculo da ajuda de custo) */
  /* perfil no campo (Guia das bolsistas, item 3): coordenação técnica, bolsistas e agentes */
  const PERFIL_Q = [
    ['agricultora', 'É agricultora? (produz alimento em quintal, roça ou lote)'],
    ['atua_mulheres', 'Atua junto às mulheres rurais do território?'],
    ['mora_rural', 'Mora na zona rural?'],
    ['internet', 'Tem celular com internet?'],
    ['outra_bolsa', 'Recebe hoje outra bolsa, de qualquer instituição?']
  ];
  const EXPERIENCIA = [['nenhuma', 'Nenhuma'], ['ate2', 'Até 2 anos'], ['3a5', '3 a 5 anos'], ['mais5', 'Mais de 5 anos']];
  const temPerfil = papel => ['coord_tecnico', 'articulacao', 'apoio', 'agente'].includes(papel);
  function camposPerfil(pf, pub) {
    pf = pf || {};
    const sn = (k, val, t) => `<label class="sn${pf[k] === val ? ' on' : ''}"><input type="radio" name="pf_${k}" value="${val ? 'sim' : 'nao'}" ${pf[k] === val ? 'checked' : ''}>${t}</label>`;
    return `<fieldset class="perfil-campo"><legend>Perfil no campo</legend>
      <p class="small muted" style="margin-top:-6px">${pub ? 'Ajuda a coordenação a conhecer a equipe' : 'Se souber, marque'}: o projeto busca pessoas ligadas ao campo e às mulheres rurais.</p>
      ${PERFIL_Q.map(([k, t]) => `<div class="criterio" id="w-pf_${k}"><span>${E(t)}</span><span class="sn-par">${sn(k, true, 'Sim')}${sn(k, false, 'Não')}</span></div>`).join('')}
      <div class="campos"><div class="campo"><label for="pf-exp">Experiência com agricultura familiar ou agroecologia</label>
        <select id="pf-exp" name="pf_experiencia"><option value="">Selecione…</option>${EXPERIENCIA.map(([v, t]) => `<option value="${v}" ${pf.experiencia === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
</div>
    </fieldset>`;
  }
  function lerPerfil(fd) {
    const pf = {}; let algum = false;
    PERFIL_Q.forEach(([k]) => { const v = fd.get('pf_' + k); if (v) { pf[k] = v === 'sim'; algum = true; } });
    const x = String(fd.get('pf_experiencia') || ''); if (x) { pf.experiencia = x; algum = true; }
    return algum ? pf : null;
  }
  /* resumo curto para a coordenação: "Agricultora · atua com mulheres rurais · MPA · 3 a 5 anos" */
  function resumoPerfil(pf) {
    if (!pf) return null;
    const p = [];
    if (pf.agricultora === true) p.push('agricultora'); else if (pf.agricultora === false) p.push('não é agricultora');
    if (pf.atua_mulheres === true) p.push('atua com mulheres rurais');
    if (pf.mora_rural === true) p.push('mora na zona rural'); else if (pf.mora_rural === false) p.push('mora na cidade');
    if (pf.experiencia) p.push('experiência: ' + (EXPERIENCIA.find(e => e[0] === pf.experiencia) || [0, pf.experiencia])[1].toLowerCase());
    if (pf.internet === false) p.push('sem celular com internet');
    if (pf.outra_bolsa === true) p.push('já recebe outra bolsa');
    const t = p.join(' · '); return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
  }
  function camposPessoais(d, pub, papel, munis) {   // munis: municípios do projeto no estado (lista de sugestões)
    const campo = R.ehCampo(papel);
    d = d || {}; const en = d.endereco || {}; const se = d.socioeconomico || null; const v = x => E(x == null ? '' : x);
    const op = (lista, sel) => '<option value="">Selecione…</option>' + lista.map(x => `<option ${x === sel ? 'selected' : ''}>${E(x)}</option>`).join('');
    const arlo = d.cadastro_arlo === true;   // sem resposta ainda: nenhuma opção marcada
    const sn = (val, t) => `<label class="sn${d.cadastro_arlo === val ? ' on' : ''}"><input type="radio" name="cadastro_arlo" value="${val ? 'sim' : 'nao'}" ${d.cadastro_arlo === val ? 'checked' : ''} data-arlo>${t}</label>`;
    return `${temPerfil(papel) ? camposPerfil(d.perfil, pub) : ''}<fieldset><legend>Cadastro no Arlo</legend>
        <div class="criterio" id="w-cadastro_arlo"><span>${pub ? 'Você já tem' : 'A pessoa já tem'} cadastro no Arlo?</span><span class="sn-par">${sn(true, 'Sim')}${sn(false, 'Não')}</span></div>
        <p class="small muted" data-arlo-nota ${arlo ? '' : 'hidden'}>Então bastam os dados básicos: nome, CPF, celular e e-mail${campo ? ', mais o município onde mora (o sistema não lê o Arlo e calcula a ajuda de custo das visitas pela distância do município até os quintais)' : ''}. Nascimento, NIS, endereço e conta bancária ficam no Arlo.</p>
      </fieldset>
      <div data-arlo-opc ${arlo ? 'hidden' : ''}><fieldset><legend>Mais dados pessoais</legend><div class="campos">
        <div class="campo"><label for="dp-soc">Nome social <span class="muted">(se usar)</span></label><input id="dp-soc" name="nome_social" value="${v(d.nome_social)}" placeholder="Como prefere ser chamada"></div>
        <div class="campo"><label for="dp-nasc">Data de nascimento</label><input id="dp-nasc" name="data_nascimento" type="date" value="${v(d.data_nascimento)}" max="${R.hoje()}"></div>
        <div class="campo inteiro"><label for="dp-nis">PIS/NIS/PASEP <span class="muted">(se tiver)</span></label><input id="dp-nis" name="nis" inputmode="numeric" value="${v(d.nis)}" placeholder="000.00000.00-0"></div>
      </div></fieldset></div>
      ${campo ? '<input type="hidden" name="_campo" value="1">' : ''}<fieldset ${campo ? '' : `data-arlo-opc ${arlo ? 'hidden' : ''}`} data-endereco><legend data-arlo-opc ${arlo ? 'hidden' : ''}>Endereço</legend>
        ${campo ? `<legend data-arlo-so ${arlo ? '' : 'hidden'}>Município onde mora</legend>` : ''}
        <p class="small muted" style="margin-top:-6px" data-arlo-opc ${arlo ? 'hidden' : ''}>Usado para calcular a ajuda de custo das visitas (distância até os quintais) e para a FUNCERN.</p>
        ${campo ? `<p class="small muted" style="margin-top:-6px" data-arlo-so ${arlo ? '' : 'hidden'}>O endereço e a conta ficam no Arlo. Só o município fica aqui: é dele que o sistema calcula a distância até os quintais e a ajuda de custo das visitas.</p>` : ''}
        <div class="campos">
        <div class="campo" data-arlo-opc ${arlo ? 'hidden' : ''}><label for="dp-cep">CEP</label><input id="dp-cep" name="cep" inputmode="numeric" value="${v(en.cep)}" placeholder="00000-000" data-cep><span class="dica" id="dp-cep-dica">Preenche o resto sozinho quando há internet.</span></div>
        <div data-arlo-opc ${arlo ? 'hidden' : ''} class="campo"><label for="dp-num">Número</label><input id="dp-num" name="numero" value="${v(en.numero)}" placeholder="s/n se não tiver"></div>
        <div data-arlo-opc ${arlo ? 'hidden' : ''} class="campo inteiro"><label for="dp-log">Logradouro (rua, sítio, estrada)</label><input id="dp-log" name="logradouro" value="${v(en.logradouro)}"></div>
        <div data-arlo-opc ${arlo ? 'hidden' : ''} class="campo"><label for="dp-comp">Complemento</label><input id="dp-comp" name="complemento" value="${v(en.complemento)}"></div>
        <div data-arlo-opc ${arlo ? 'hidden' : ''} class="campo"><label for="dp-bai">Bairro ou comunidade</label><input id="dp-bai" name="bairro" value="${v(en.bairro)}"></div>
        <div class="campo"><label for="dp-cid">Município onde mora</label><input id="dp-cid" name="cidade" value="${v(en.cidade || d.municipio)}" ${munis && munis.length ? 'list="lista-mun"' : ''} autocomplete="address-level2">
          ${munis && munis.length ? `<datalist id="lista-mun">${munis.map(x => `<option value="${E(x)}">`).join('')}</datalist><span class="dica">A lista traz os municípios do projeto no estado.</span>` : ''}</div>
        <div class="campo" data-arlo-opc ${arlo ? 'hidden' : ''}><label for="dp-uf">Estado</label><select id="dp-uf" name="uf_end">${op(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE', 'Outro'], en.uf)}</select></div>
      </div></fieldset>
      <fieldset data-arlo-opc ${arlo ? 'hidden' : ''}><legend>Questionário socioeconômico (opcional)</legend>
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
    const arlo = fd.get('cadastro_arlo') === 'sim';
    if (arlo) {   // no Arlo: endereço e conta ficam lá. Quem vai a campo informa só o município (cálculo da ajuda de custo)
      ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'uf'].forEach(k => delete endereco[k]);
      if (!fd.get('_campo')) delete endereco.cidade;
      return { cadastro_arlo: true, _arlo_resp: fd.get('cadastro_arlo'), nome_social: t('nome_social') || null, data_nascimento: null, nis: null, endereco, socioeconomico: null, perfil: lerPerfil(fd) };
    }
    return { cadastro_arlo: false, _arlo_resp: fd.get('cadastro_arlo'), nome_social: t('nome_social') || null, data_nascimento: t('data_nascimento') || null, nis: R.soDigitos(t('nis')) || null, endereco, socioeconomico: socio, perfil: lerPerfil(fd) };
  }
  /* a data existe no calendário? ("2026-02-30" não existe, mas o navegador lê como 2 de março) */
  const dataExiste = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); if (!m) return false; const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3]; };
  function validarPessoais(d, pub) {
    const e = {};
    if (!d._arlo_resp) e.cadastro_arlo = 'Responda se já tem cadastro no Arlo.';
    if (pub && !d.cadastro_arlo && !d.data_nascimento) e.data_nascimento = 'Informe a data de nascimento.';
    if (pub && d.cadastro_arlo && d._campo && !d.endereco.cidade) e.cidade = 'Informe o município onde mora (usado no cálculo da ajuda de custo).';
    if (d.data_nascimento && (!dataExiste(d.data_nascimento) || d.data_nascimento < '1900-01-01' || d.data_nascimento > R.hoje() || R.idade(d.data_nascimento) < 16)) e.data_nascimento = 'Data de nascimento inválida.';   // 30/02 e 1800 não passam
    if (d.nis && d.nis.length !== 11) e.nis = 'O PIS/NIS tem 11 números.';
    if (pub && d._perfil) { const pf = d.perfil || {};
      PERFIL_Q.forEach(([k]) => { if (typeof pf[k] !== 'boolean') e['pf_' + k] = 'Responda sim ou não.'; });
      if (!pf.experiencia) e.pf_experiencia = 'Escolha uma opção.'; }
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
    if (t.matches && t.matches('[data-arlo]')) {
      const f = t.form; const sim = t.value === 'sim';
      f.querySelectorAll('[data-arlo-opc]').forEach(x => { x.hidden = sim; }); f.querySelectorAll('[data-arlo-so]').forEach(x => { x.hidden = !sim; });
      const n = f.querySelector('[data-arlo-nota]'); if (n) n.hidden = !sim;
      t.closest('.sn-par').querySelectorAll('.sn').forEach(l => l.classList.toggle('on', l.contains(t)));
    }
    if (t.matches && t.matches('input[type=radio][name^="pf_"]')) t.closest('.sn-par').querySelectorAll('.sn').forEach(l => l.classList.toggle('on', l.contains(t)));
    if (t.matches && t.matches('[data-socio]')) { const c = t.closest('fieldset').querySelector('[data-socio-campos]'); if (c) c.hidden = !t.checked; }
  });
  document.addEventListener('input', async ev => {
    const t = ev.target; if (!t.matches || !t.matches('[data-cep]')) return;
    const cep = R.soDigitos(t.value); t.value = cep.length > 5 ? cep.slice(0, 5) + '-' + cep.slice(5, 8) : cep;
    if (cep.length !== 8) return;
    const f = t.form; const dica = document.getElementById('dp-cep-dica');
    try {
      const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/'); const j = await r.json();
      if (j.erro) { if (dica) dica.textContent = 'CEP não encontrado. Confira os números ou preencha o endereço.'; return; }
      [['logradouro', j.logradouro], ['bairro', j.bairro], ['cidade', j.localidade]].forEach(([k, val]) => { if (val && !f[k].value) f[k].value = val; });
      if (j.uf && f.uf_end) f.uf_end.value = [...f.uf_end.options].some(o => o.value === j.uf) ? j.uf : 'Outro';
      if (dica) dica.textContent = j.logradouro ? 'Endereço preenchido pelo CEP. Confira e informe o número.' : 'Este CEP é da cidade toda: cidade e estado preenchidos. Digite a rua, o sítio ou a comunidade.';
      const prox = j.logradouro ? f.numero : f.logradouro; if (prox && !prox.value) prox.focus();
    } catch (e) { if (dica) dica.textContent = 'Sem internet para buscar o CEP. Preencha o endereço.'; }
  });

  /* dados pessoais já guardados de alguém da equipe (só coordenação e a própria pessoa conseguem ler) */
  const privCache = {};
  function privado(id) {
    if (id in privCache) return privCache[id];
    privCache[id] = undefined;
    if (S().api.lerPrivado) S().api.lerPrivado(id).then(d => { privCache[id] = d || null; U().render(); }).catch(() => { privCache[id] = null; });
    return undefined;
  }
  const esquecerPrivado = id => { delete privCache[id]; };

  /* ---------- no formulário de cadastro: o link, gerado ao escolher "Gerar link" ---------- */
  const chaveLink = p => [p.papel, p.uf || '', p.subst || ''].join('|');
  async function gerarLink(p) {
    const k = chaveLink(p); if (C.links[k]) return C.links[k];
    C.links[k] = await S().api.criarConvite(p.papel, p.uf || null, p.subst || null);
    return C.links[k];
  }
  function blocoLink(p) {
    const tk = C.links[chaveLink(p)];
    if (!tk) return `<div class="cad-modo conv-pronto"><p class="carregando">Gerando o link…</p></div>`;
    const url = endereco(tk);
    const msg = `Olá! Este é o link para você preencher o seu cadastro no sistema do projeto Mulheres & Quintais (${funcao(p.papel, p.uf)}). Vale por 7 dias: ${url}`;
    return `<div class="cad-modo conv-pronto">
      <span class="conv-selo"><span aria-hidden="true">✓</span> Link pronto</span>
      <b>Mande para a pessoa</b>
      <span>Ela preenche os próprios dados pelo celular e aceita o termo. O cadastro aparece na aba Equipe, em "Cadastros enviados pelo link", para você conferir e aprovar.</span>
      <div class="conv-url"><input readonly value="${E(url)}" aria-label="Link de cadastro" onclick="this.select()"></div>
      <div class="conv-botoes">
        <a class="btn pri" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar pelo WhatsApp</a>
        <button class="btn" type="button" data-acao="conv-copiar" data-url="${E(url)}">Copiar link</button>
      </div>
      <span class="small muted">Vale 7 dias e só pode ser usado uma vez.</span></div>`;
  }

  /* ---------- aba Equipe: pré-cadastros aguardando ---------- */
  function secaoPendentes() {
    const lista = S().pre || [];
    if (!lista.length) return '';
    return `<section class="secao" aria-labelledby="t-pre"><div class="secao-cab"><div><h2 id="t-pre">Cadastros enviados pelo link <span class="conta-t">${lista.length}</span></h2>
        <p>Confira os dados, complete o que falta e aprove. Só depois de aprovada a pessoa entra na equipe e pode fazer o primeiro acesso.</p></div></div>
      <div class="lista-fichas">${lista.map(x => `<button class="vagabtn ficha-linha pre-linha" data-acao="conv-ver" data-id="${E(x.id)}">
          <span class="nm">${E(x.nome)}</span><span class="small muted">${E(funcao(x.papel, x.uf))} · enviado em ${R.fmtData(x.enviado_em)}</span>
          <span><span class="chip pend">Aguardando conferência</span></span></button>`).join('')}</div></section>`;
  }
  function painel(p) {
    const x = (S().pre || []).find(y => y.id === p.id); if (!x) return '<div class="painel-corpo"><p>Pré-cadastro não encontrado.</p></div>';
    const dl = [['Nome', x.nome], ['CPF', R.fmtCPF(x.cpf)], ['E-mail', x.email], ['Celular', x.telefone], ['Município', x.municipio], ['Organização', x.organizacao],
      ['Cadastro no Arlo', x.cadastro_arlo ? 'Sim: dados completos e conta no Arlo' : 'Não'], ['Matrícula SIAPE', x.siape], ['Nome social', x.nome_social], ['Nascimento', x.data_nascimento && R.fmtData(x.data_nascimento)], ['PIS/NIS', x.nis],
      ['Endereço', textoEndereco(x.endereco)], ['Socioeconômico', x.socioeconomico ? 'Respondido' : 'Não respondeu'], temPerfil(x.papel) ? ['Perfil no campo', resumoPerfil(x.perfil) || 'Não respondeu'] : null,
      ['Termo de dados (LGPD)', 'Aceito por ela no envio'], ['Enviado em', new Date(x.enviado_em).toLocaleString('pt-BR')]].filter(l => l && l[1]);
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
    return { nome: x.nome, nome_social: x.nome_social, siape: x.siape || null, cpf: x.cpf, email: x.email, telefone: x.telefone, municipio: x.municipio || (x.endereco || {}).cidade, organizacao: x.organizacao,
      consentimento_lgpd: true, _pre: x, cadastro_arlo: !!x.cadastro_arlo, _priv: { cadastro_arlo: !!x.cadastro_arlo, data_nascimento: x.data_nascimento, nis: x.nis, endereco: x.endereco || {}, socioeconomico: x.socioeconomico, perfil: x.perfil || null } };
  }

  /* ---------- página pública do link ---------- */
  const PUB = { token: null, conv: null, enviado: false };
  function pagina(token) {
    if (PUB.token !== token) { PUB.token = token; PUB.conv = null; PUB.enviado = false;
      setTimeout(async () => { try { PUB.conv = await S().api.verConvite(token); } catch (e) { PUB.conv = { valido: false, motivo: 'erro', erro: e.message }; } desenhar(); }, 0); }
    return `<main class="ent ent-conv"><div class="ent-fundo" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
      <div id="convite" class="conv-miolo">${corpo()}</div></main>`;
  }
  function desenhar() { const el = $('#convite'); if (el) { el.innerHTML = corpo(); rascunho.restaurar(PUB.token); } }
  /* rascunho no próprio celular: se a página recarregar (trocou de aplicativo, a tela apagou), nada do que foi digitado se perde */
  const rascunho = {
    chave: t => 'mq-rascunho-conv-' + t,
    salvar(form) {
      if (!PUB.token || PUB.enviado) return; const o = {};
      new FormData(form).forEach((v, k) => { if (typeof v === 'string' && v !== '') o[k] = v; });
      try { localStorage.setItem(this.chave(PUB.token), JSON.stringify(o)); } catch (e) {}
    },
    apagar(t) { try { localStorage.removeItem(this.chave(t)); } catch (e) {} },
    restaurar(t) {
      const f = document.querySelector('form[data-form=conv-enviar]'); if (!f || !t) return;
      let o = null; try { o = JSON.parse(localStorage.getItem(this.chave(t)) || 'null'); } catch (e) {}
      if (!o || !Object.keys(o).length) return;
      Object.entries(o).forEach(([k, v]) => {
        f.querySelectorAll(`[name="${k}"]`).forEach(el => {
          if (el.type === 'radio') { el.checked = el.value === v; if (el.checked) el.dispatchEvent(new Event('change', { bubbles: true })); }
          else if (el.type === 'checkbox') { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
          else el.value = v;
        });
      });
      f.insertAdjacentHTML('afterbegin', '<div class="aviso ok conv-rasc">Recuperamos o que você já tinha preenchido neste celular. Confira e continue.</div>');
    }
  };
  document.addEventListener('input', ev => { const f = ev.target.closest && ev.target.closest('form[data-form=conv-enviar]'); if (f) rascunho.salvar(f); });
  document.addEventListener('change', ev => { const f = ev.target.closest && ev.target.closest('form[data-form=conv-enviar]'); if (f) rascunho.salvar(f); });
  function corpo() {
    const c = PUB.conv;
    if (!c) return '<div class="login ent-card"><p class="carregando">Abrindo o link…</p></div>';
    if (PUB.enviado) return `<div class="conv-boas"><h1 class="ent-t serif">Pronto, <em>recebemos</em>.</h1>
        <p class="ent-s">Seus dados foram enviados para a coordenação do projeto conferir.</p>
        <ol class="conv-etapas"><li class="feito"><b>✓</b> Seus dados</li><li class="on"><b>2</b> Coordenação confere</li><li><b>3</b> Você cria a senha</li></ol></div>
      <div class="login ent-card conv-fim">
        <span class="eyebrow">Próximo passo</span>
        <h2 class="serif">Quando a coordenação aprovar</h2>
        <ol class="conv-passos">
          <li><span>Abra o sistema pelo botão abaixo (no Chrome ou no Safari).</span></li>
          <li><span>Toque em <b>Primeiro acesso</b>.</span></li>
          <li><span>Use o e-mail que você informou e o <b>código de acesso</b> que a coordenação vai mandar pelo WhatsApp, e crie a sua senha.</span></li>
        </ol>
        ${PUB.email ? `<p class="conv-email">Seu e-mail de entrada: <b>${E(PUB.email)}</b><span class="small muted">Se estiver errado, avise quem mandou o link.</span></p>` : ''}
        <a class="btn pri ent-btn" href="${E(location.origin + location.pathname)}">Ir para o sistema <span aria-hidden="true">→</span></a>
        <p class="small muted">Guarde este endereço: <b>${E(location.host + location.pathname)}</b>. Se tiver dúvida, fale com quem mandou o link.</p></div>`;
    if (!c.valido) {
      const msg = { usado: 'Este link já foi usado.', vencido: 'Este link venceu (vale 7 dias).', cancelado: 'Este link foi cancelado.', inexistente: 'Link não encontrado. Confira se copiou inteiro.' }[c.motivo] || ('Não foi possível abrir o link. ' + (c.erro || ''));
      return `<div class="login ent-card"><span class="eyebrow">Cadastro na equipe</span><h2 class="serif">Link sem validade</h2><p>${E(msg)} Peça um novo à coordenação do projeto.</p></div>`;
    }
    const munis = c.uf ? (MQ.MUNICIPIOS[c.uf] || []) : [];
    return `<div class="conv-boas"><h1 class="ent-t serif">Boas-vindas <em>à equipe</em>.</h1>
        <p class="ent-s">Você foi indicad${c.papel === 'professor_fic' ? 'o(a)' : 'a'} para <b>${E(funcao(c.papel, c.uf))}</b>. Preencha seus dados uma vez só; a coordenação confere e libera o seu acesso.</p>
        <ol class="conv-etapas"><li class="on"><b>1</b> Seus dados</li><li><b>2</b> Coordenação confere</li><li><b>3</b> Você cria a senha</li></ol></div>
      <form class="login ent-card conv-form" data-form="conv-enviar" novalidate>
      <div><span class="eyebrow">Cadastro na equipe</span><h2 class="serif">Seus dados</h2></div>
      <div class="campo"><label for="cv-nome">Nome completo</label><input id="cv-nome" name="nome" autocomplete="name" required></div>
      <div class="campos">
        <div class="campo"><label for="cv-cpf">CPF</label><input id="cv-cpf" name="cpf" inputmode="numeric" autocomplete="off" required></div>
        <div class="campo"><label for="cv-tel">Celular (WhatsApp)</label><input id="cv-tel" name="telefone" inputmode="tel" autocomplete="tel" required></div></div>
      <div class="campo"><label for="cv-email">E-mail</label><input id="cv-email" name="email" type="email" autocomplete="email" required>
        <span class="dica">É com este e-mail que você vai entrar no sistema. Use um que você acessa sempre.</span></div>
      <div class="campos">
        <div class="campo"><label for="cv-org">Organização ou movimento</label><input id="cv-org" name="organizacao" placeholder="Ex.: MPA, associação, sindicato"></div>
        <div class="campo"><label for="cv-siape">Matrícula SIAPE <span class="muted">(só se for servidor(a) federal)</span></label><input id="cv-siape" name="siape" inputmode="numeric" placeholder="Deixe vazio se não for"></div></div>
      ${camposPessoais({}, true, c.papel)}
      <label class="check"><input type="checkbox" name="consentimento_lgpd"> <span>Autorizo o projeto (IFRN, MDA, MPA e FUNCERN) a usar estes dados para o meu cadastro na equipe, o pagamento e a prestação de contas, conforme a Lei nº 13.709/2018. Posso pedir correção a qualquer momento.</span></label>
      <div class="aviso erro" data-erro hidden></div>
      <button class="btn pri" type="submit">Enviar meus dados</button>
      <p class="nota">A conta bancária não é pedida aqui: você informa depois, dentro do sistema, com segurança.</p></form>`;
  }

  /* ---------- ações ---------- */
  async function clique(a, el) {
    if (a === 'conv-copiar') {
      try { await navigator.clipboard.writeText(el.dataset.url); U().toast('Link copiado.'); }
      catch (e) {   // área de transferência negada ou inexistente: deixa o link selecionado para a pessoa copiar à mão
        const caixa = (el.closest && el.closest('.conv-pronto')) || el.parentElement; const i = caixa && caixa.querySelector ? caixa.querySelector('.conv-url input, input[readonly]') : null;
        if (i) { try { i.focus(); i.select(); } catch (x) { /* campo sem seleção */ } }
        U().toast('Não deu para copiar. Selecione o link e copie.');
      }
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
        consentimento_lgpd: !!fd.get('consentimento_lgpd'), siape: R.soDigitos(fd.get('siape')) || null };
      Object.assign(d, lerPessoais(fd)); d.municipio = d.endereco.cidade || '';
      d._campo = R.ehCampo(PUB.conv && PUB.conv.papel); d._perfil = temPerfil(PUB.conv && PUB.conv.papel);
      const erros = validarPessoais(d, true); delete d._arlo_resp; delete d._campo; delete d._perfil;
      if (d.nome.split(' ').length < 2 || d.nome.length < 5) erros.nome = 'Escreva o nome completo.';
      if (!R.cpfValido(d.cpf)) erros.cpf = 'CPF inválido. Confira os números.';
      if (!R.emailValido(d.email)) erros.email = 'E-mail inválido.';
      if (R.soDigitos(d.telefone).length < 10) erros.telefone = 'Informe o celular com DDD: é por ele que chega o código de acesso.';
      if (!d.consentimento_lgpd) erros.consentimento_lgpd = 'É preciso autorizar para enviar.';
      if (d.siape && !/^\d{5,8}$/.test(d.siape)) erros.siape = 'A matrícula SIAPE tem de 5 a 8 números.';
      if (Object.keys(erros).length) return U().mostrarErros(form, erros);
      await U().ocupado(form, async () => { await S().api.enviarPreCadastro(PUB.token, d); PUB.enviado = true; PUB.email = d.email; rascunho.apagar(PUB.token); desenhar(); window.scrollTo(0, 0); });
    } else if (tipo === 'conv-recusar') {
      const obs = String(fd.get('obs') || '').trim();
      if (obs.length < 5) return U().mostrarErros(form, { obs: 'Escreva o motivo.' });
      await U().ocupado(form, async () => { await S().api.decidirPreCadastro(form.dataset.id, 'recusado', obs); await U().carregar(); U().fecharPainel(); U().render(); U().toast('Cadastro recusado.'); });
    }
  }

  MQ.convitesUI = { resumoPerfil, temPerfil, gerarLink, blocoLink, secaoPendentes, painel, dadosPre, pagina, clique, enviar, camposPessoais, lerPessoais, validarPessoais, privado, esquecerPrivado, textoEndereco, limparCache: () => { Object.keys(privCache).forEach(k => delete privCache[k]); } };
})();
