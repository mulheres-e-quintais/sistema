/* Mulheres & Quintais — ficha de indicação e seleção + termo de consentimento
   (modelos 1 e 2, versão 2, set/2026). Funciona sem internet: a ficha vai para a fila do aparelho
   e é enviada quando houver conexão. */
(function () {
  const R = MQ.regras;
  const U = () => MQ.ui;
  const $ = s => document.querySelector(s);
  const E = s => MQ.ui.esc(s);
  const fotosTemp = { ficha: null, termo: null };
  const filtro = { uf: '', situacao: '', busca: '' };

  /* ---------- dados combinados: servidor + fila do aparelho ---------- */
  function todas() {
    const S = U().S;
    const porId = new Map(S.fichas.map(f => [f.id, Object.assign({}, f)]));
    S.fila.filter(it => !it.tipo || it.tipo === 'ficha').forEach(it => {
      const base = porId.get(it.id) || {};
      porId.set(it.id, Object.assign({}, base, it.dados, { _fila: true, _erro: it.erro || null, situacao: base.situacao || 'aguardando' }));
    });
    return [...porId.values()].sort((a, b) => String(b.data_ficha || '').localeCompare(String(a.data_ficha || '')) || String(a.nome).localeCompare(String(b.nome)));
  }
  const contar = (lista, uf) => {
    const l = lista.filter(f => !uf || f.uf === uf);
    const c = { total: l.length, aprovadas: 0, aguardando: 0, devolvidas: 0, espera: 0, sem_agua: 0, nao_atende: 0, selecionadas: 0 };
    /* Cada ficha cai em UMA coluna só, para a linha somar o total:
       primeiro a situação (ainda com a coordenação técnica?), depois o resultado das já aprovadas. */
    l.forEach(f => {
      if (f.resultado === 'selecionada') c.selecionadas++;
      if (f.situacao === 'aguardando') c.aguardando++;
      else if (f.situacao === 'devolvida') c.devolvidas++;
      else if (f.resultado === 'selecionada') c.aprovadas++;
      else if (f.resultado === 'lista_espera') c.espera++;
      else if (f.resultado === 'sem_agua') c.sem_agua++;
      else if (f.resultado === 'nao_atende') c.nao_atende++;
    });
    return c;
  };
  const chipRes = f => { const r = MQ.RESULTADOS[f.resultado] || {}; return `<span class="chip ${r.cls || 'off'}">${E(r.nome || '—')}${f.resultado === 'lista_espera' && f.posicao_espera ? ' · ' + f.posicao_espera + 'ª' : ''}</span>`; };
  const chipSit = f => {
    if (f._fila) return f._erro ? '<span class="chip crit">Não enviada: corrigir</span>' : '<span class="chip pend">Guardada no aparelho</span>';
    const s = MQ.SITUACOES[f.situacao] || {}; return `<span class="chip ${s.cls}">${E(s.nome)}</span>`;
  };

  function linhaFicha(f, mostrarUF) {
    const casas = R.casasParecidas(f, todas());
    return `<button class="vagabtn ficha-linha" data-acao="ficha-ver" data-id="${E(f.id)}">
      <span class="nm">${E(f.nome)}${f.exemplo ? '' : ''}</span>
      <span style="display:flex;gap:6px;flex-wrap:wrap">${chipRes(f)}${chipSit(f)}${casas.length ? '<span class="chip crit">Mesma casa?</span>' : ''}</span>
      <span class="sub">${mostrarUF ? E(f.uf) + ' · ' : ''}${E(f.municipio)} · ${E(f.comunidade)} · <span class="num">${R.pontosFicha(f)}</span> ponto${R.pontosFicha(f) === 1 ? '' : 's'} de prioridade${f._erro ? ' · <b style="color:var(--crit)">' + E(f._erro) + '</b>' : ''}</span></button>`;
  }

  /* ---------- tela da bolsista ---------- */
  function secaoBolsista() {
    const S = U().S; const uf = S.eu.uf;
    const lista = todas().filter(f => f.uf === uf);
    const c = contar(lista, uf);
    const filaF = S.fila.filter(i => !i.tipo || i.tipo === 'ficha'); const pend = filaF.length, comErro = filaF.filter(i => i.erro).length;
    const busca = filtro.busca.trim().toLowerCase();
    const vis = lista;
    const devolvidas = vis.filter(f => f.situacao === 'devolvida' || f._erro);
    const resto = vis.filter(f => !(f.situacao === 'devolvida' || f._erro));
    return `<section class="secao" aria-labelledby="t-fichas">
      <div class="secao-cab"><div><h2 id="t-fichas">Seleção das mulheres · ${E(U().nomeUF(uf))}</h2>
        <p>Para cada mulher indicada pela comunidade você preenche uma <b>ficha de indicação</b>: dados dela, critérios do edital e o termo de consentimento assinado. A coordenação técnica aprova; as ${MQ.VAGAS_UF} primeiras aprovadas recebem o quintal e as outras ficam na lista de espera.</p></div>
        <button class="btn pri" data-acao="ficha-nova">+ Nova ficha</button></div>
      <div class="resumo">
        <div><span class="v num">${c.aprovadas}<small> de ${MQ.VAGAS_UF}</small></span><span class="l">selecionadas aprovadas no estado</span></div>
        <div><span class="v num">${c.aguardando}</span><span class="l">aguardando aprovação</span></div>
        <div><span class="v num">${c.espera}</span><span class="l">na lista de espera</span></div>
        <div><span class="v num">${c.sem_agua}</span><span class="l">sem água: encaminhadas</span></div>
      </div>
      ${pend ? `<div class="aviso${comErro ? ' erro' : ''}" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <span><b>${pend} ficha${pend > 1 ? 's' : ''} guardada${pend > 1 ? 's' : ''} neste aparelho</b>${comErro ? `, ${comErro} com problema para corrigir` : ', aguardando internet para enviar'}.</span>
        ${navigator.onLine ? '<button class="btn peq" data-acao="ficha-enviar">Enviar agora</button>' : ''}</div>` : ''}
      ${devolvidas.length ? `<div class="bloco" style="border-color:var(--crit)"><h3>Para corrigir (${devolvidas.length})</h3><div class="lista-fichas">${devolvidas.map(f => linhaFicha(f)).join('')}</div></div>` : ''}
      ${resto.length ? U().dobra('fichas-todas', `<span><b>Ver as ${resto.length} fichas</b> <span class="small muted">· procurar por nome ou CPF</span></span>`,
          `${resto.length > 6 ? `<div class="campo"><label for="f-busca">Procurar por nome ou CPF</label><input id="f-busca" data-procura="lista-fichas-uf" autocomplete="off"></div>` : ''}
           <div class="lista-fichas" id="lista-fichas-uf">${resto.map(f => linhaFicha(f)).join('')}</div>`)
        : (lista.length ? '' : '<div class="vazio"><span>Nenhuma ficha ainda. Toque em <b>+ Nova ficha</b> quando estiver com a mulher indicada.</span></div>')}
    </section>`;
  }

  /* ---------- tela da coordenação ---------- */
  function secaoCoord() {
    const S = U().S; const souTec = R.decideCampo(S.eu.papel);
    const lista = todas();
    const tot = contar(lista);
    const linha = (uf, nome) => {
      const c = contar(lista, uf);
      const pct = Math.min(100, Math.round(c.aprovadas / MQ.VAGAS_UF * 100));
      return `<tr><td class="uf"><span class="sigla">${uf}</span><span class="nomeuf">${E(nome)}</span></td>
        <td class="num">${c.total}</td>
        <td class="sep c"><div style="display:grid;gap:4px;text-align:center"><span class="num"><b>${c.aprovadas}</b> de ${MQ.VAGAS_UF}</span><span class="bar"><i class="${c.aprovadas >= MQ.VAGAS_UF ? 'cheio' : ''}" style="width:${pct}%"></i></span></div></td>
        <td class="num sep">${c.espera}</td><td class="num">${c.sem_agua}</td><td class="num">${c.nao_atende}</td>
        <td class="num sep">${c.aguardando ? `<b>${c.aguardando}</b>` : 0}</td><td class="num">${c.devolvidas}</td></tr>`;
    };
    const aguardando = lista.filter(f => f.situacao === 'aguardando').sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
    const busca = filtro.busca.trim().toLowerCase();
    const filtradas = lista.filter(f => (!filtro.uf || f.uf === filtro.uf) && (!filtro.situacao || f.situacao === filtro.situacao || f.resultado === filtro.situacao)
      && (!busca || f.nome.toLowerCase().includes(busca) || f.cpf.includes(R.soDigitos(busca) || '#')));
    const op = (v, t, atual) => `<option value="${v}" ${v === atual ? 'selected' : ''}>${t}</option>`;
    return `<section class="secao" aria-labelledby="t-sel">
      <div class="cab"><div><span class="eyebrow">Seleção das mulheres</span><h1 id="t-sel">Seleção das beneficiárias</h1>
        <p>Fichas de indicação dos 5 estados. ${souTec ? 'Você aprova ou devolve cada ficha antes do diagnóstico.' : 'A aprovação é da coordenação técnica.'} O sistema impede CPF repetido e mais de ${MQ.VAGAS_UF} selecionadas aprovadas por estado.</p></div>
        <button class="btn" data-acao="ficha-csv">Baixar planilha (CSV)</button></div>
      ${(() => { const u = MQ.UFS.find(x => contar(lista, x.uf).total); if (!u) return ''; const c = contar(lista, u.uf);
        const partes = [[c.aprovadas, 'selecionada'], [c.espera, 'na lista de espera'], [c.sem_agua, 'sem água'], [c.nao_atende, 'que não atende'], [c.aguardando, 'para aprovar'], [c.devolvidas, 'devolvida']].filter(x => x[0]).map(x => x[0] + ' ' + x[1]);
        return `<div class="aviso" style="margin:0"><b>Como ler:</b> a coluna <b>Fichas</b> é o total de mulheres indicadas no estado, e as colunas ao lado repartem esse total (cada mulher aparece numa só). As <b>${MQ.VAGAS_UF} vagas</b> são só a coluna <b>Selecionadas</b>; as outras não ocupam vaga.
          Ex.: ${E(u.nome)} tem ${c.total} fichas = ${partes.join(' + ')}.</div>`; })()}
      <div class="quadro-scroll" style="display:block"><table class="quadro quadro-sel" style="min-width:820px"><thead>
        <tr class="grupo"><th></th><th></th><th class="sep">Ocupam vaga</th><th colspan="3" class="sep">Não ocupam vaga</th><th colspan="2" class="sep">Sem decisão ainda</th></tr>
        <tr><th>Estado</th><th>Fichas (total)</th><th class="sep">Selecionadas (vagas)</th><th class="sep">Lista de espera</th><th>Sem água</th><th>Não atendem</th><th class="sep">Para aprovar</th><th>Devolvidas</th></tr></thead>
        <tbody>${MQ.UFS.map(u => linha(u.uf, u.nome)).join('')}
        <tr><td class="uf"><b>Total</b></td><td class="num"><b>${tot.total}</b></td><td class="num sep"><b>${tot.aprovadas}</b> de ${MQ.VAGAS_UF * 5}</td><td class="num sep">${tot.espera}</td><td class="num">${tot.sem_agua}</td><td class="num">${tot.nao_atende}</td><td class="num sep"><b>${tot.aguardando}</b></td><td class="num">${tot.devolvidas}</td></tr>
        </tbody></table></div><p class="dica-cols">No celular aparecem só as colunas principais. A tabela completa aparece no computador ou com o celular deitado.</p>
      ${aguardando.length ? `<div class="bloco"><h3>${souTec ? 'Para você aprovar' : 'Aguardando a coordenação técnica'} (${aguardando.length})</h3>
        <div class="lista-fichas">${aguardando.slice(0, 30).map(f => linhaFicha(f, true)).join('')}</div></div>` : ''}
      <details class="hist"><summary>Todas as fichas (${lista.length})</summary><div style="padding:0 18px 16px;display:grid;gap:12px">
        <div class="campos" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="campo"><label for="ff-uf">Estado</label><select id="ff-uf" data-filtro="uf">${op('', 'Todos', filtro.uf)}${MQ.UFS.map(u => op(u.uf, u.nome, filtro.uf)).join('')}</select></div>
          <div class="campo"><label for="ff-sit">Situação</label><select id="ff-sit" data-filtro="situacao">${op('', 'Todas', filtro.situacao)}
            ${Object.entries(MQ.SITUACOES).map(([k, v]) => op(k, v.nome, filtro.situacao)).join('')}${Object.entries(MQ.RESULTADOS).map(([k, v]) => op(k, v.nome, filtro.situacao)).join('')}</select></div>
          <div class="campo"><label for="ff-busca">Nome ou CPF</label><input id="ff-busca" data-filtro="busca" value="${E(filtro.busca)}" autocomplete="off"></div>
        </div>
        <div class="lista-fichas">${filtradas.slice(0, 200).map(f => linhaFicha(f, true)).join('') || '<p class="muted">Nenhuma ficha com esses filtros.</p>'}</div>
      </div></details>
    </section>`;
  }

  /* ---------- painéis ---------- */
  function painel(p) { return p.tipo === 'ficha-form' ? painelForm(p) : painelVer(p); }

  function simNao(nome, valor, rotulo) {
    const r = (v, t) => `<label class="sn${valor === v ? ' on' : ''}"><input type="radio" name="${nome}" value="${v}" ${valor === v ? 'checked' : ''}>${t}</label>`;
    return `<div class="criterio" id="w-${nome}"><span>${E(rotulo)}</span><span class="sn-par">${r('sim', 'Sim')}${r('nao', 'Não')}</span></div>`;
  }
  const valSN = v => v === true ? 'sim' : v === false ? 'nao' : '';

  function painelForm(p) {
    const S = U().S;
    const f = p.dados || { id: MQ.novoId(), uf: S.eu.uf, data_ficha: R.hoje(), consent_dados: null, assinatura: 'assinatura', situacao: 'aguardando' };
    const v = k => E(f[k] == null ? '' : f[k]);
    const munis = MQ.MUNICIPIOS[f.uf] || [];
    const autorizo = (nome, val, txt) => `<div class="criterio" id="w-${nome}"><span>${txt}</span><span class="sn-par">
      <label class="sn${val === true ? ' on' : ''}"><input type="radio" name="${nome}" value="sim" ${val === true ? 'checked' : ''}>Autorizo</label>
      <label class="sn${val === false ? ' on' : ''}"><input type="radio" name="${nome}" value="nao" ${val === false ? 'checked' : ''}>Não autorizo</label></span></div>`;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">${p.dados && p.dados.nome ? 'Corrigir ficha' : 'Nova ficha'} · ${E(U().nomeUF(f.uf))}</span>
        <h2 id="painel-t">Ficha de indicação e seleção</h2>
        ${f.obs_coordenacao && f.situacao === 'devolvida' ? `<div class="aviso erro" style="margin-top:6px"><b>Devolvida pela coordenação técnica:</b> ${E(f.obs_coordenacao)}</div>` : ''}</div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="ficha" data-id="${E(f.id)}" data-resultado="${E(f.resultado || '')}" novalidate>
        <p class="small muted">Preencha com a mulher, no papel e aqui. Sem internet, a ficha fica guardada neste aparelho e é enviada depois.</p>

        <fieldset><legend>1. Identificação</legend><div class="campos">
          <div class="campo inteiro"><label for="fi-nome">Nome completo</label><input id="fi-nome" name="nome" value="${v('nome')}" autocomplete="off" required></div>
          <div class="campo"><label for="fi-cpf">CPF</label><input id="fi-cpf" name="cpf" inputmode="numeric" value="${E(R.fmtCPF(f.cpf || ''))}" placeholder="000.000.000-00"></div>
          <div class="campo"><label for="fi-nasc">Data de nascimento</label><input id="fi-nasc" name="data_nascimento" type="date" value="${v('data_nascimento')}" max="${R.hoje()}"></div>
          <div class="campo"><label for="fi-cel">Celular / WhatsApp</label><input id="fi-cel" name="celular" inputmode="tel" value="${v('celular')}"></div>
          <div class="campo"><label for="fi-pess">Nº de pessoas na família</label><input id="fi-pess" name="pessoas_familia" type="number" min="1" max="30" inputmode="numeric" value="${v('pessoas_familia')}"></div>
          <div class="campo"><label for="fi-mun">Município</label><input id="fi-mun" name="municipio" list="fi-lista-mun" value="${v('municipio')}"><datalist id="fi-lista-mun">${munis.map(m => `<option value="${E(m)}">`).join('')}</datalist></div>
          <div class="campo"><label for="fi-com">Comunidade / assentamento</label><input id="fi-com" name="comunidade" value="${v('comunidade')}"></div>
          <div class="campo inteiro"><label for="fi-end">Endereço (rua, sítio, nº)</label><input id="fi-end" name="endereco" value="${v('endereco')}"><span class="dica">Escreva do jeito mais completo possível: é por ele que o sistema confere se já há alguém da mesma casa.</span></div>
          <div class="campo inteiro"><label for="fi-ref">Ponto de referência</label><input id="fi-ref" name="ponto_referencia" value="${v('ponto_referencia')}"></div>
          <div class="campo"><label for="fi-nis">NIS (CadÚnico)</label><input id="fi-nis" name="nis" inputmode="numeric" value="${v('nis')}" placeholder="Se tiver"></div>
          <div class="campo"><label for="fi-caf">CAF nº</label><input id="fi-caf" name="caf" value="${v('caf')}" placeholder="Se tiver"></div>
          <div class="campo inteiro"><label for="fi-ind">Quem indicou (organização / liderança)</label><input id="fi-ind" name="indicada_por" value="${v('indicada_por')}"></div>
          <div class="campo"><label for="fi-data">Data da ficha</label><input id="fi-data" name="data_ficha" type="date" value="${v('data_ficha')}" max="${R.hoje()}"></div>
          <div class="campo"><label>Localização</label><button type="button" class="btn peq" data-acao="ficha-gps">${f.latitude ? 'Localização registrada ✓' : 'Registrar localização'}</button>
            <input type="hidden" name="latitude" value="${v('latitude')}"><input type="hidden" name="longitude" value="${v('longitude')}"><span class="dica" id="fi-gps-dica">${f.latitude ? E(f.latitude + ', ' + f.longitude) : 'Opcional. Use na casa da mulher.'}</span></div>
          <div id="fi-conf" class="inteiro"></div>
        </div></fieldset>

        <fieldset><legend>2. Termo de consentimento (leia em voz alta)</legend>
          <div class="fixo" style="gap:8px"><span>${E(MQ.TERMO.finalidade)}</span><span>${E(MQ.TERMO.direitos)}</span></div>
          ${autorizo('consent_dados', f.consent_dados, 'Uso dos dados pessoais para os fins acima')}
          ${autorizo('consent_imagem', f.consent_imagem == null ? null : f.consent_imagem, 'Uso da imagem e voz (fotos e vídeos) em relatórios e divulgação, sem uso comercial')}
          ${autorizo('consent_criancas', f.consent_criancas == null ? null : f.consent_criancas, 'Crianças e adolescentes sob sua responsabilidade nas fotos, só em atividades do projeto')}
          <div class="campos">
            <div class="campo inteiro"><label for="fi-ass">Como assinou</label><select id="fi-ass" name="assinatura">
              <option value="assinatura" ${f.assinatura !== 'digital' ? 'selected' : ''}>Assinou o nome</option>
              <option value="digital" ${f.assinatura === 'digital' ? 'selected' : ''}>Impressão digital + testemunha</option></select></div>
            <div class="campo" data-so-digital><label for="fi-tn">Testemunha: nome</label><input id="fi-tn" name="testemunha_nome" value="${v('testemunha_nome')}"></div>
            <div class="campo" data-so-digital><label for="fi-tc">Testemunha: CPF</label><input id="fi-tc" name="testemunha_cpf" inputmode="numeric" value="${E(R.fmtCPF(f.testemunha_cpf || ''))}"></div>
            <div class="campo inteiro"><label for="fi-ft">Foto do termo assinado</label><input id="fi-ft" name="foto_termo" type="file" accept="image/*" capture="environment">
              <span class="dica" id="fi-ft-dica">${f.foto_termo_path ? 'Já tem foto. Envie outra só se quiser trocar.' : 'Fotografe o papel inteiro, com as assinaturas legíveis.'}</span></div>
          </div>
        </fieldset>

        <fieldset><legend>3. Critérios obrigatórios</legend>
          <p class="small muted" style="margin-top:-6px">Se algum for "não", a mulher não pode ser selecionada.</p>
          ${MQ.CRITERIOS.map(([k, t]) => simNao(k, valSN(f[k]), t)).join('')}
          <label class="check" id="w-autodeclaracao"><input type="checkbox" name="autodeclaracao" ${f.autodeclaracao ? 'checked' : ''}>
            <span><b>Autodeclaração assinada (item 3 da ficha):</b> não é parente até o 3º grau da equipe, ninguém da casa foi selecionado e as informações são verdadeiras.</span></label>
        </fieldset>

        <fieldset><legend>4. Prioridade (só para desempate)</legend>
          ${MQ.PRIORIDADES.map(([k, t, pt]) => `<label class="check"><input type="checkbox" name="${k}" ${f[k] ? 'checked' : ''}><span>${E(t)} <b class="num">(${pt} ponto${pt > 1 ? 's' : ''})</b></span></label>`).join('')}
          <p class="fixo"><span class="small muted">Total de pontos</span><b class="num" id="fi-pontos">${R.pontosFicha(f)}</b></p>
        </fieldset>

        <fieldset><legend>5. Resultado</legend><div id="fi-resultado"></div>
          <div class="campos">
            <div class="campo" data-so="lista_espera"><label for="fi-pos">Posição na lista de espera</label><input id="fi-pos" name="posicao_espera" type="number" min="1" inputmode="numeric" value="${v('posicao_espera')}"></div>
            <div class="campo inteiro" data-so="sem_agua"><label for="fi-enc">Encaminhada para (programa de cisternas / órgão)</label><input id="fi-enc" name="encaminhada_para" value="${v('encaminhada_para')}"></div>
            <div class="campo inteiro"><label for="fi-just">Justificativa / observações</label><textarea id="fi-just" name="justificativa">${v('justificativa')}</textarea></div>
            <div class="campo inteiro"><label for="fi-ff">Foto da ficha em papel assinada</label><input id="fi-ff" name="foto_ficha" type="file" accept="image/*,application/pdf" capture="environment">
              <span class="dica" id="fi-ff-dica">${f.foto_ficha_path ? 'Já tem foto. Envie outra só se quiser trocar.' : 'As duas páginas, com as assinaturas da mulher e da bolsista.'}</span></div>
          </div>
        </fieldset>
        <input type="hidden" name="foto_termo_path" value="${v('foto_termo_path')}"><input type="hidden" name="foto_ficha_path" value="${v('foto_ficha_path')}">
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Salvar ficha</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div>
      </form></div>`;
  }

  function lerForm(form) {
    const fd = new FormData(form); const S = U().S;
    const sn = k => fd.get(k) === 'sim' ? true : fd.get(k) === 'nao' ? false : null;
    const num = k => { const x = String(fd.get(k) || '').trim(); return x === '' ? null : Number(x); };
    const txt = k => { const x = String(fd.get(k) || '').trim(); return x || null; };
    const f = {
      id: form.dataset.id, uf: S.eu.uf,
      nome: String(fd.get('nome') || '').trim().replace(/\s+/g, ' '), cpf: R.soDigitos(fd.get('cpf')),
      data_nascimento: txt('data_nascimento'), celular: txt('celular'), pessoas_familia: num('pessoas_familia'),
      municipio: String(fd.get('municipio') || '').trim(), comunidade: String(fd.get('comunidade') || '').trim(),
      endereco: String(fd.get('endereco') || '').trim(), ponto_referencia: txt('ponto_referencia'),
      nis: R.soDigitos(fd.get('nis')) || null, caf: txt('caf'), indicada_por: txt('indicada_por'), data_ficha: txt('data_ficha'),
      latitude: num('latitude'), longitude: num('longitude'),
      consent_dados: sn('consent_dados'), consent_imagem: sn('consent_imagem') === true, consent_criancas: sn('consent_criancas') === true,
      assinatura: fd.get('assinatura') === 'digital' ? 'digital' : 'assinatura',
      testemunha_nome: fd.get('assinatura') === 'digital' ? txt('testemunha_nome') : null,
      testemunha_cpf: fd.get('assinatura') === 'digital' ? (R.soDigitos(fd.get('testemunha_cpf')) || null) : null,
      autodeclaracao: !!fd.get('autodeclaracao'),
      resultado: txt('resultado') || (form.querySelector('input[name=resultado]') ? null : (form.dataset.resultado || null)), posicao_espera: num('posicao_espera'), encaminhada_para: txt('encaminhada_para'), justificativa: txt('justificativa'),
      foto_termo_path: txt('foto_termo_path'), foto_ficha_path: txt('foto_ficha_path')
    };
    MQ.CRITERIOS.forEach(([k]) => { f[k] = sn(k); });
    MQ.PRIORIDADES.forEach(([k]) => { f[k] = !!fd.get(k); });
    if (f.resultado !== 'lista_espera') f.posicao_espera = null;
    if (f.resultado !== 'sem_agua') f.encaminhada_para = null;
    f.tem_foto_termo = !!(f.foto_termo_path || fotosTemp.termo);
    f.tem_foto_ficha = !!(f.foto_ficha_path || fotosTemp.ficha);
    return f;
  }

  /* Atualiza a parte "viva" do formulário: resultado possível, pontos, alertas, campos condicionais */
  function atualizarForm(form) {
    const f = lerForm(form);
    const possiveis = R.resultadosPossiveis(f);
    const criteriosMarcados = MQ.CRITERIOS.every(([k]) => f[k] !== null);
    if (f.resultado && !possiveis.includes(f.resultado)) f.resultado = null;
    form.dataset.resultado = f.resultado || '';
    const box = form.querySelector('#fi-resultado');
    const faltaAuto = R.criteriosOk(f) && !f.autodeclaracao;
    box.innerHTML = `${!criteriosMarcados ? '<p class="small muted">Marque todos os critérios obrigatórios para ver os resultados possíveis.</p>' : ''}
      ${faltaAuto ? '<div class="aviso">Todos os critérios estão "sim", mas falta a autodeclaração assinada. Sem ela, a mulher não pode ser selecionada.</div>' : ''}
      ${f.c_agua === false ? '<div class="aviso">Sem água que dure na seca, ela não recebe o kit agora: registre para onde foi encaminhada (programa de cisternas).</div>' : ''}
      <div class="sn-par" role="radiogroup" aria-label="Resultado" style="flex-wrap:wrap">${Object.entries(MQ.RESULTADOS).map(([k, r]) => {
        const pode = criteriosMarcados && possiveis.includes(k);
        return `<label class="sn${f.resultado === k ? ' on' : ''}${pode ? '' : ' off'}"><input type="radio" name="resultado" value="${k}" ${f.resultado === k ? 'checked' : ''} ${pode ? '' : 'disabled'}>${E(r.nome)}</label>`;
      }).join('')}</div>`;
    form.querySelectorAll('[data-so]').forEach(el => { el.hidden = el.dataset.so !== f.resultado; });
    form.querySelectorAll('[data-so-digital]').forEach(el => { el.hidden = f.assinatura !== 'digital'; });
    form.querySelectorAll('.sn').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    const pt = form.querySelector('#fi-pontos'); if (pt) pt.textContent = R.pontosFicha(f);
    // conferência automática (substitui a planilha única)
    const outras = todas();
    const conf = [];
    if (R.cpfValido(f.cpf)) {
      const dup = outras.find(x => x.id !== f.id && x.cpf === f.cpf);
      conf.push(dup ? `<div class="aviso erro">CPF já tem ficha: <b>${E(dup.nome)}</b> (${E(dup.municipio)}). Uma mulher só pode ter uma ficha.</div>` : '<div class="aviso" style="background:var(--ok-bg)">CPF conferido: nenhuma outra ficha com este CPF neste estado.</div>');
    }
    const casas = f.endereco ? R.casasParecidas(f, outras) : [];
    if (casas.length) conf.push(`<div class="aviso erro">Mesmo endereço de: <b>${casas.map(c => E(c.nome)).join(', ')}</b>. Duas pessoas da mesma casa não podem ser selecionadas. Confira antes de marcar o critério "Ninguém da mesma casa".</div>`);
    const i = R.idade(f.data_nascimento, f.data_ficha);
    if (i != null && i >= 0) conf.push(`<p class="small muted">Idade na data da ficha: <b>${i} anos</b>${i >= 18 && i <= 29 ? ' (conta como jovem para prioridade)' : ''}.</p>`);
    form.querySelector('#fi-conf').innerHTML = conf.join('');
  }

  function painelVer(p) {
    const S = U().S;
    const f = todas().find(x => x.id === p.id); if (!f) return '<div class="painel-corpo"><p>Ficha não encontrada.</p></div>';
    const souTec = R.decideCampo(S.eu.papel);
    const souBolsista = R.ehBolsista(S.eu.papel);
    const bolsista = f.bolsista_id && U().porId(f.bolsista_id);
    const aprovador = f.aprovada_por && U().porId(f.aprovada_por);
    const casas = R.casasParecidas(f, todas());
    const dl = linhas => `<dl class="dl">${linhas.filter(l => l && l[1] != null && l[1] !== '').map(([k, v]) => `<dt>${k}</dt><dd>${E(v)}</dd>`).join('')}</dl>`;
    const sim = b => b ? '✓' : '✗';
    const podeCorrigir = souBolsista && f.situacao !== 'aprovada';
    const podeDecidir = souTec && !f._fila;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Ficha de indicação · ${E(f.uf)} · ${E(f.municipio)}</span>
        <h2 id="painel-t">${E(f.nome)}</h2><span style="display:flex;gap:6px;flex-wrap:wrap">${chipRes(f)}${chipSit(f)}</span></div>
        <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo">
        ${f._erro ? `<div class="aviso erro"><b>Não foi enviada:</b> ${E(f._erro)}</div>` : ''}
        ${f.situacao === 'devolvida' && f.obs_coordenacao ? `<div class="aviso erro"><b>Devolvida pela coordenação técnica:</b> ${E(f.obs_coordenacao)}</div>` : ''}
        ${casas.length ? `<div class="aviso erro"><b>Mesmo endereço</b> de ${casas.map(c => E(c.nome) + ' (' + E((MQ.RESULTADOS[c.resultado] || {}).nome || '') + ')').join(', ')}. Confira se são da mesma casa antes de aprovar.</div>` : ''}
        ${podeCorrigir ? `<div class="acoes"><button class="btn pri" data-acao="ficha-corrigir" data-id="${E(f.id)}">Corrigir ficha</button></div>` : ''}
        <div class="bloco"><h3>Identificação</h3>${dl([
          ['CPF', R.fmtCPF(f.cpf)], ['Nascimento', R.fmtData(f.data_nascimento) + (f.data_nascimento ? ' (' + R.idade(f.data_nascimento, f.data_ficha) + ' anos)' : '')],
          ['Celular', f.celular], ['Comunidade', f.comunidade], ['Endereço', f.endereco], ['Referência', f.ponto_referencia],
          ['NIS', f.nis], ['CAF', f.caf], ['Pessoas na família', f.pessoas_familia], ['Indicada por', f.indicada_por],
          ['Data da ficha', R.fmtData(f.data_ficha)], ['Bolsista', bolsista ? bolsista.nome : null],
          ['Localização', f.latitude ? f.latitude + ', ' + f.longitude : null]])}</div>
        <div class="bloco"><h3>Termo de consentimento</h3>${dl([
          ['Dados pessoais', f.consent_dados ? 'Autorizou' : 'Não autorizou'], ['Imagem e voz', f.consent_imagem ? 'Autorizou' : 'Não autorizou'],
          ['Crianças nas fotos', f.consent_criancas ? 'Autorizou' : 'Não autorizou'],
          ['Assinatura', f.assinatura === 'digital' ? 'Digital, testemunha ' + (f.testemunha_nome || '') + ' (' + R.fmtCPF(f.testemunha_cpf || '') + ')' : 'Assinou o nome']])}
          ${!f.consent_imagem ? '<p class="nota"><b>Não fotografe esta mulher</b> para divulgação. Fotos do quintal sem ela aparecer continuam permitidas nos relatórios.</p>' : ''}</div>
        <div class="bloco"><h3>Critérios obrigatórios</h3><ul class="passos">${MQ.CRITERIOS.map(([k, t]) => `<li class="${f[k] ? 'feito' : ''}"><span class="mk" aria-hidden="true">${sim(f[k])}</span><span>${E(t)}<br><span class="q">${f[k] ? 'Sim' : 'Não'}</span></span></li>`).join('')}
          <li class="${f.autodeclaracao ? 'feito' : ''}"><span class="mk">${sim(f.autodeclaracao)}</span><span>Autodeclaração assinada</span></li></ul></div>
        <div class="bloco"><h3>Prioridade: <span class="num">${R.pontosFicha(f)}</span> ponto${R.pontosFicha(f) === 1 ? '' : 's'}</h3>
          <p class="small">${MQ.PRIORIDADES.filter(([k]) => f[k]).map(([, t, pt]) => E(t) + ' (' + pt + ')').join(' · ') || 'Nenhum critério de prioridade.'}</p></div>
        <div class="bloco"><h3>Resultado</h3>${dl([['Resultado', (MQ.RESULTADOS[f.resultado] || {}).nome], ['Posição na espera', f.posicao_espera],
          ['Encaminhada para', f.encaminhada_para], ['Observações', f.justificativa],
          ['Aprovada por', aprovador ? aprovador.nome + ' em ' + new Date(f.aprovada_em).toLocaleDateString('pt-BR') : null]])}
          <div class="acoes">${f.foto_termo_path ? `<button class="btn peq" data-acao="ficha-foto" data-path="${E(f.foto_termo_path)}">Ver termo assinado</button>` : ''}
            ${f.foto_ficha_path ? `<button class="btn peq" data-acao="ficha-foto" data-path="${E(f.foto_ficha_path)}">Ver ficha em papel</button>` : ''}</div>
          <div id="fi-foto-vista"></div></div>
        ${podeDecidir ? `<form class="bloco" data-form="ficha-decisao" data-id="${E(f.id)}" novalidate><h3>Decisão da coordenação</h3>
          <p class="small muted">Aprove se os papéis fotografados conferem com a ficha e os critérios foram aplicados como aprovado em ata. Para devolver, diga o que corrigir.</p>
          <div class="campo"><label for="fd-obs">Observação para a bolsista</label><textarea id="fd-obs" name="obs">${E(f.obs_coordenacao || '')}</textarea></div>
          <div class="aviso erro" data-erro hidden></div>
          <div class="acoes">${f.situacao !== 'aprovada' ? '<button class="btn pri" type="submit" name="decisao" value="aprovada">Aprovar</button>' : ''}
            <button class="btn perigo" type="submit" name="decisao" value="devolvida">${f.situacao === 'aprovada' ? 'Reabrir: devolver para correção' : 'Devolver para correção'}</button></div></form>` : ''}
      </div>`;
  }

  /* ---------- ações ---------- */
  async function clique(a, el) {
    const S = U().S;
    if (a === 'ficha-nova') { fotosTemp.ficha = fotosTemp.termo = null; U().abrirPainel({ tipo: 'ficha-form' }); setTimeout(() => { const fm = $('form[data-form=ficha]'); if (fm) atualizarForm(fm); }, 0); }
    else if (a === 'ficha-ver') U().abrirPainel({ tipo: 'ficha-ver', id: el.dataset.id });
    else if (a === 'ficha-corrigir') {
      fotosTemp.ficha = fotosTemp.termo = null;
      const naFila = (S.fila || []).find(it => it.id === el.dataset.id && (!it.tipo || it.tipo === 'ficha'));
      if (naFila && naFila.fotos) Object.assign(fotosTemp, naFila.fotos);   // não obriga a fotografar de novo
      const f = todas().find(x => x.id === el.dataset.id);
      U().abrirPainel({ tipo: 'ficha-form', dados: f }); setTimeout(() => { const fm = $('form[data-form=ficha]'); if (fm) atualizarForm(fm); }, 0);
    }
    else if (a === 'ficha-enviar') {
      for (const it of S.fila) if (it.erro) { it.reenviar = true; await MQ.fila.salvar(it); }
      await U().sincronizar(true);
    }
    else if (a === 'ficha-gps') {
      const dica = $('#fi-gps-dica');
      if (!navigator.geolocation) { dica.textContent = 'Este aparelho não informa a localização.'; return; }
      dica.textContent = 'Buscando localização…';
      navigator.geolocation.getCurrentPosition(pos => {
        const fm = $('form[data-form=ficha]'); if (!fm) return;
        fm.latitude.value = pos.coords.latitude.toFixed(6); fm.longitude.value = pos.coords.longitude.toFixed(6);
        dica.textContent = fm.latitude.value + ', ' + fm.longitude.value + ' (precisão de ' + Math.round(pos.coords.accuracy) + ' m)';
        el.textContent = 'Localização registrada ✓';
      }, err => { dica.textContent = MQ.dicaGPS(err, 'Se não der, pode seguir sem ela.'); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    }
    else if (a === 'ficha-foto') {
      const box = $('#fi-foto-vista');
      if (el.dataset.path === 'exemplo') { box.innerHTML = '<p class="nota">Ficha de exemplo: não há foto.</p>'; return; }
      try {
        const url = await S.api.linkFoto(el.dataset.path);
        box.innerHTML = url ? (/\.pdf$/.test(el.dataset.path) ? `<a class="btn peq" href="${E(url)}" target="_blank" rel="noopener">Abrir PDF</a>` : `<a href="${E(url)}" target="_blank" rel="noopener"><img src="${E(url)}" alt="Documento fotografado" style="border-radius:8px;border:1px solid var(--line);margin-top:8px"></a>`)
          : '<p class="nota">A foto ainda está só no aparelho de quem preencheu.</p>';
      } catch (e) { box.innerHTML = `<p class="nota">${E(e.message)}</p>`; }
    }
    else if (a === 'ficha-csv') baixarCSV();
  }

  async function enviar(tipo, form, fd) {
    const S = U().S;
    if (tipo === 'ficha') {
      const f = lerForm(form);
      const erros = R.validarFicha(f, todas());
      // "Não autorizo" no uso dos dados: a ficha não é guardada
      if (Object.keys(erros).length) {
        const m = {}; Object.entries(erros).forEach(([k, v]) => { m[k] = v; });
        marcarErros(form, m); return;
      }
      await U().ocupado(form, async () => {
        const dados = Object.assign({}, f); delete dados.tem_foto_ficha; delete dados.tem_foto_termo;
        await MQ.fila.salvar({ id: f.id, dono: S.eu.id, tipo: 'ficha', dados, fotos: { ficha: fotosTemp.ficha, termo: fotosTemp.termo }, erro: null });
        fotosTemp.ficha = fotosTemp.termo = null;
        S.fila = await MQ.fila.listar(S.eu.id);
        U().fecharPainel(); U().render();
        if (navigator.onLine) await U().sincronizar(false);
        const ainda = S.fila.find(i => i.id === f.id);
        U().toast(ainda ? (ainda.erro ? 'Ficha guardada, mas não enviada: ' + ainda.erro : 'Ficha guardada no aparelho. Será enviada quando houver internet.') : 'Ficha enviada para aprovação da coordenação técnica.');
      });
    }
    if (tipo === 'ficha-decisao') {
      const decisao = form.dataset.decisao || 'aprovada';
      const obs = String(fd.get('obs') || '').trim();
      if (decisao === 'devolvida' && obs.length < 5) return U().mostrarErros(form, { obs: 'Escreva o que a bolsista precisa corrigir.' });
      await U().ocupado(form, async () => {
        await S.api.decidirFicha(form.dataset.id, decisao, obs);
        await U().carregar(); U().fecharPainel(); U().render();
        U().toast(decisao === 'aprovada' ? 'Ficha aprovada.' : 'Ficha devolvida para a bolsista corrigir.');
      });
    }
  }

  function marcarErros(form, erros) {
    // critérios e autorizações usam grupos de opções: marca o bloco inteiro
    const alvo = {};
    Object.entries(erros).forEach(([k, v]) => {
      const w = form.querySelector('#w-' + k);
      if (w) { w.classList.add('tem-erro'); w.setAttribute('title', v); }
      else if (k === 'foto_termo' || k === 'foto_ficha' || form.querySelector(`[name="${k}"]`)) alvo[k] = v;
    });
    form.querySelectorAll('.criterio, .check').forEach(w => { if (!erros[w.id.replace('w-', '')]) w.classList.remove('tem-erro'); });
    const n = Object.keys(erros).length;
    U().mostrarErros(form, alvo, n > 1 ? 'Faltam ' + n + ' itens: ' + Object.values(erros).slice(0, 3).join(' · ') + (n > 3 ? ' …' : '') : Object.values(erros)[0]);
    const primeiro = form.querySelector('.tem-erro'); if (primeiro) primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function baixarCSV() {
    const S = U().S;
    const col = ['uf', 'municipio', 'comunidade', 'nome', 'cpf', 'data_nascimento', 'celular', 'endereco', 'ponto_referencia', 'nis', 'caf', 'pessoas_familia', 'indicada_por', 'data_ficha',
      ...MQ.CRITERIOS.map(c => c[0]), 'autodeclaracao', 'pontos', 'resultado', 'posicao_espera', 'encaminhada_para', 'situacao', 'aprovada_em', 'bolsista', 'consent_imagem'];
    const linhas = todas().map(f => col.map(c => {
      let v = c === 'pontos' ? R.pontosFicha(f) : c === 'bolsista' ? ((U().porId(f.bolsista_id) || {}).nome || '') : f[c];
      if (v === true) v = 'Sim'; if (v === false) v = 'Não';
      if (c === 'resultado') v = (MQ.RESULTADOS[v] || {}).nome || v;
      if (c === 'situacao') v = (MQ.SITUACOES[v] || {}).nome || v;
      return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    }).join(';'));
    const csv = '﻿' + col.join(';') + '\n' + linhas.join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'fichas_mulheres_e_quintais_' + R.hoje() + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    U().toast('Planilha gerada. Ela tem dados pessoais: guarde em pasta restrita.');
  }

  /* reatividade do formulário e dos filtros */
  document.addEventListener('change', async ev => {
    const form = ev.target.closest('form[data-form=ficha]');
    if (form) {
      if (ev.target.type === 'file' && ev.target.files[0]) {
        const campo = ev.target.name === 'foto_termo' ? 'termo' : 'ficha';
        const arq = ev.target.files[0];
        const dica = form.querySelector('#fi-' + (campo === 'termo' ? 'ft' : 'ff') + '-dica');
        if (arq.size > 15 * 1024 * 1024) { dica.textContent = 'Arquivo muito grande (máx. 15 MB).'; ev.target.value = ''; return; }
        dica.textContent = 'Preparando foto…';
        fotosTemp[campo] = await MQ.comprimirFoto(arq);
        dica.textContent = 'Foto pronta (' + Math.round(fotosTemp[campo].size / 1024) + ' KB). Fica no aparelho até enviar.';
      }
      atualizarForm(form);
      const w = ev.target.closest('.criterio, .check'); if (w) w.classList.remove('tem-erro');
      const c = ev.target.closest('.campo'); if (c) { c.classList.remove('tem-erro'); c.querySelectorAll('.erro').forEach(x => x.remove()); }
    }
    const flt = ev.target.closest('[data-filtro]');
    if (flt && flt.tagName === 'SELECT') { filtro[flt.dataset.filtro] = flt.value; U().render(); }
  });
  document.addEventListener('input', ev => {
    const form = ev.target.closest('form[data-form=ficha]');
    if (form) {
      if (ev.target.name === 'testemunha_cpf') ev.target.value = R.fmtCPF(ev.target.value);
      if (ev.target.name === 'celular') ev.target.value = R.fmtFone(ev.target.value);
      if (['cpf', 'endereco', 'municipio', 'data_nascimento'].includes(ev.target.name)) atualizarForm(form);
      const c = ev.target.closest('.campo'); if (c && c.classList.contains('tem-erro')) { c.classList.remove('tem-erro'); c.querySelectorAll('.erro').forEach(x => x.remove()); }
    }
    const flt = ev.target.closest('input[data-filtro]');
    if (flt) {
      filtro[flt.dataset.filtro] = flt.value; const id = flt.id, pos = flt.selectionStart;
      clearTimeout(flt._t); flt._t = setTimeout(() => { U().render(); const n = document.getElementById(id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
    }
  });
  // botão que enviou o formulário de decisão
  document.addEventListener('click', ev => {
    const b = ev.target.closest('form[data-form=ficha-decisao] button[name=decisao]');
    if (b) b.form.dataset.decisao = b.value;
  }, true);

  MQ.fichasUI = { secaoBolsista, secaoCoord, painel, clique, enviar };
})();
