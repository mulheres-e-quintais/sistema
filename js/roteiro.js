/* Mulheres & Quintais — roteiro de testes por perfil.
   A pessoa faz no próprio celular, uma de cada vez, as tarefas do seu perfil e diz se deu certo.
   Linguagem do dia a dia; se alguém não consegue, o problema é do sistema, não da pessoa.
   Abre pelo link .../sistema/#teste ou pela Ajuda (?). Respostas: 21_roteiro_testes.sql. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);

  /* ---------- roteiros (t = tarefa, p = como fazer, v = o que deve acontecer) ---------- */
  const G = { convite: null };
  const R = {
    bolsista: { nome: 'Bolsista (articulação ou apoio)', tarefas: [
      { t: 'Entrar no sistema', p: ['Você já entrou usando o e-mail, o código que chegou pelo WhatsApp e a senha que criou.'], v: 'Você está vendo a sua tela, com o seu nome em cima.', pergunta: 'Foi fácil entrar pela primeira vez?' },
      { t: 'Ler o aviso "Antes de começar"', p: ['Na sua tela, procure o quadro "Antes de começar".', 'Leia os pontos.', 'Toque no botão "Li e entendi".'], v: 'O quadro some e não aparece de novo.' },
      { t: 'Abrir os seus dados', p: ['Toque na sua foto ou nas suas iniciais, no alto da tela, à direita.'], v: 'Abre a tela "Meus dados", com seu celular e endereço.' },
      { t: 'Fazer uma ficha de indicação', p: ['Toque em "+ Nova ficha".', 'Preencha com dados inventados (nunca de uma mulher de verdade).', 'Tire as fotos de qualquer papel, só para testar.', 'Toque em "Salvar ficha".'], v: 'A ficha aparece na lista com "Aguardando aprovação".' },
      { t: 'Marcar a localização', p: ['Numa ficha nova, toque em "Registrar localização".', 'Se o celular perguntar, toque em "Permitir".'], v: 'Aparece "Localização registrada ✓" com uns números embaixo.' },
      { t: 'Fazer uma ficha sem internet', p: ['Ligue o modo avião do celular.', 'Faça outra ficha com dados inventados e salve.', 'Desligue o modo avião e espere um pouco.'], v: 'Sem internet aparece "guardado neste aparelho". Com a internet de volta, a ficha sobe sozinha (ou toque em "Enviar agora").' },
      { t: 'Falar em vez de digitar', p: ['Com internet, abra uma ficha nova e vá até "Justificativa / observações".', 'Toque em "Falar" e diga uma frase. No fim, diga "ponto final".', 'Toque em "Parar".'], v: 'O que você falou aparece escrito no campo.' },
      { t: 'Ver as entregas do mês', p: ['Na sua tela, procure "Entregas do mês".', 'Na linha "Lista de presença", toque em "Entreguei".'], v: 'A lista de presença fica com o sinal ✓.' },
      { t: 'Achar uma visita para fazer', p: ['Procure "Trabalho de campo" e depois "Para fazer agora".', 'Se tiver uma visita, toque no botão dela (por exemplo, "Registrar diagnóstico").'], v: 'Abre o formulário da visita. Se não houver visita marcada, responda "Deu certo" e escreva "sem visita".' },
      { t: 'Achar ajuda', p: ['Toque no "?" no alto da tela.', 'Procure como pedir o pagamento da bolsa.'], v: 'A ajuda explica onde pedir a bolsa.' }
    ] },
    agente: { nome: 'Agente de campo', tarefas: [
      { t: 'Entrar no sistema', p: ['Você já entrou usando o e-mail, o código que chegou pelo WhatsApp e a senha que criou.'], v: 'Você está vendo a sua tela, com o seu nome em cima.', pergunta: 'Foi fácil entrar pela primeira vez?' },
      { t: 'Ler o aviso "Antes de começar"', p: ['Na sua tela, procure o quadro "Antes de começar".', 'Leia e toque em "Li e entendi".'], v: 'O quadro some e não aparece de novo.' },
      { t: 'Ver as suas visitas', p: ['Procure "Próximas visitas".'], v: 'Aparecem os quintais e as datas marcadas para você. Se não houver nenhuma, responda "Deu certo" e escreva "sem visita".' },
      { t: 'Registrar um diagnóstico', p: ['Numa visita de diagnóstico, toque em "Registrar diagnóstico".', 'Tire as 3 fotos pedidas (de qualquer coisa, só para testar).', 'Toque em "Registrar localização".', 'Preencha o resto com dados inventados e salve.'], v: 'O diagnóstico é salvo e a visita muda de situação.' },
      { t: 'Registrar sem internet', p: ['Ligue o modo avião.', 'Registre uma visita e salve.', 'Desligue o modo avião e espere um pouco.'], v: 'Sem internet aparece "guardado neste aparelho". Com a internet de volta, sobe sozinho.' },
      { t: 'Falar em vez de digitar', p: ['Com internet, num campo de texto, toque em "Falar" e diga uma frase.', 'Toque em "Parar".'], v: 'O que você falou aparece escrito.' },
      { t: 'Achar ajuda', p: ['Toque no "?" no alto da tela.', 'Procure como pedir a ajuda de custo.'], v: 'A ajuda explica onde pedir.' }
    ] },
    professor: { nome: 'Professor(a) do curso FIC', tarefas: [
      { t: 'Entrar no sistema', p: ['Você já entrou usando o e-mail, o código de acesso e a senha que criou.'], v: 'Você está vendo a tela do professor, com a aba do curso FIC.', pergunta: 'Foi fácil entrar pela primeira vez?' },
      { t: 'Criar uma turma', p: ['Toque em "+ Nova turma".', 'Preencha o nome e o período e salve.'], v: 'A turma aparece em "Suas turmas".' },
      { t: 'Matricular uma pessoa', p: ['Na turma, toque em "+ Matricular".', 'Escolha uma bolsista ou agente, digite um número de matrícula inventado e a data, e salve.'], v: 'A pessoa aparece na lista da turma.' },
      { t: 'Confirmar o acesso ao AVA', p: ['Procure "Acesso ao AVA no mês".', 'Marque uma pessoa.'], v: 'Ao lado do nome aparece "Acessou".' },
      { t: 'Achar ajuda', p: ['Toque no "?" no alto da tela.'], v: 'Abre a ajuda da sua tela.' }
    ] },
    auxiliar: { nome: 'Auxiliar administrativo', tarefas: [
      { t: 'Entrar no sistema', p: ['Você já entrou usando o e-mail, o código de acesso e a senha que criou.'], v: 'Você está vendo a sua tela.', pergunta: 'Foi fácil entrar pela primeira vez?' },
      { t: 'Achar quem falta cadastrar no Arlo', p: ['Procure a lista "Falta cadastrar no Arlo".'], v: 'Aparecem as pessoas que ainda não têm a data do Arlo.' },
      { t: 'Registrar Arlo e termo', p: ['Toque numa pessoa da lista.', 'Em "Registrar passos da habilitação", toque em "Hoje" nas duas datas.', 'Anexe um arquivo qualquer como termo e toque em "Salvar habilitação".'], v: 'A pessoa sai da lista de pendentes.' },
      { t: 'Ver uma conta bancária', p: ['Numa pessoa que informou a conta, toque em "Ver conta e Pix".'], v: 'Aparece a conta. (Essa consulta fica registrada no histórico.)' },
      { t: 'Achar ajuda', p: ['Toque no "?" no alto da tela.'], v: 'Abre a ajuda da sua tela.' }
    ] },
    tecnica: { nome: 'Coordenação técnica', tarefas: [
      { t: 'Entrar no sistema', p: ['Você já entrou usando o e-mail, o código de acesso e a senha que criou.'], v: 'Aparecem 5 abas: Seleção, Equipe, Campo, Pagamentos e Custos.', pergunta: 'Foi fácil entrar pela primeira vez?' },
      { t: 'Mandar um link de cadastro', p: ['Na aba Equipe, toque numa vaga aberta de bolsista.', 'Toque em "Gerar link de cadastro".', 'Mande o link para o seu próprio WhatsApp.'], v: 'Aparece "Link pronto" e o WhatsApp abre com a mensagem.' },
      { t: 'Preencher o link como se fosse a bolsista', p: ['Abra o link que chegou no seu WhatsApp.', 'Preencha com dados inventados e envie.'], v: 'Aparece "Pronto, recebemos".' },
      { t: 'Aprovar o cadastro recebido', p: ['Na aba Equipe, abra "Cadastros enviados pelo link".', 'Confira e toque em salvar.'], v: 'A pessoa aparece na vaga.' },
      { t: 'Gerar o código de acesso', p: ['Abra a ficha da pessoa que você acabou de aprovar.', 'Toque em "Gerar código de acesso".'], v: 'Aparece um código de 8 letras e números e a mensagem pronta para o WhatsApp.' },
      { t: 'Aprovar ou devolver uma ficha', p: ['Na aba Seleção, abra uma ficha que está aguardando.', 'Devolva dizendo o que corrigir.'], v: 'A ficha fica como devolvida, com o seu motivo.' },
      { t: 'Marcar uma visita', p: ['Na aba Campo, no roteiro, marque uma visita para uma bolsista ou agente.'], v: 'A visita aparece no roteiro com a data.' },
      { t: 'Aprovar um plano de quintal', p: ['Na aba Campo, abra "Planos para você aprovar".', 'Abra um plano e aprove ou devolva.'], v: 'O plano sai da lista de espera. Se não houver plano, responda "Deu certo" e escreva "sem plano".' },
      { t: 'Achar ajuda', p: ['Toque no "?" no alto da tela.'], v: 'Abre a ajuda da aba em que você está.' }
    ] },
    geral: { nome: 'Coordenação geral', tarefas: [
      { t: 'Cadastrar a coordenação técnica', p: ['Na aba Equipe, toque em "Cadastrar coordenação técnica".', 'Toque em "Digitar os dados agora" e preencha com dados inventados.'], v: 'A pessoa aparece na Equipe.' },
      { t: 'Liberar novo acesso (esqueceu a senha)', p: ['Abra a ficha de alguém que já entrou.', 'Toque em "Liberar novo primeiro acesso" e confirme.'], v: 'Aparece um código novo para mandar à pessoa.' },
      { t: 'Ver a equipe na visão geral', p: ['Abra a aba Visão geral e procure "Quem é a equipe de execução".'], v: 'Os números batem com a aba Equipe.' },
      { t: 'Ver o histórico', p: ['Abra a aba Histórico.'], v: 'Aparecem as ações feitas nos testes, com nome e hora.' }
    ] }
  };
  const grupoDe = papel => ['articulacao', 'apoio'].includes(papel) ? 'bolsista' : papel === 'agente' ? 'agente' : papel === 'professor_fic' ? 'professor'
    : papel === 'auxiliar_adm' ? 'auxiliar' : papel === 'coord_tecnico' ? 'tecnica' : papel === 'coord_geral' ? 'geral' : null;
  const idDe = (g, i) => g + '-' + String(i + 1).padStart(2, '0');

  /* ---------- estado (o modo teste fica ligado neste aparelho) ---------- */
  const chave = () => 'mq-teste-' + (S().eu && S().eu.id);
  const ler = () => { try { return JSON.parse(localStorage.getItem(chave()) || 'null'); } catch (e) { return null; } };
  const gravar = v => { try { if (v) localStorage.setItem(chave(), JSON.stringify(v)); else localStorage.removeItem(chave()); } catch (e) {} };
  const minhas = () => new Map((S().testes || []).filter(r => r.equipe_id === S().eu.id).map(r => [r.tarefa, r]));
  const aparelho = () => { const u = navigator.userAgent; const so = /iPhone|iPad/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Outro';
    const nav = /CriOS|Chrome/.test(u) && !/Edg/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : /Edg/.test(u) ? 'Edge' : 'navegador'; return so + ' · ' + nav + ' · ' + window.innerWidth + 'px'; };

  function ativo() { const st = ler(); return !!(st && st.ativo && S().eu && grupoDe(S().eu.papel) && !S().testesSemBanco); }
  function atual() { const g = grupoDe(S().eu.papel); const n = R[g].tarefas.length; const st = ler() || {}; return { g, n, i: Math.min(Math.max(st.i || 0, 0), n) }; }

  /* barra fixa embaixo enquanto o teste está ligado: a pessoa usa o sistema e volta à tarefa */
  function barra() {
    if (!ativo()) { document.body.classList.remove('com-teste'); return ''; }
    document.body.classList.add('com-teste');
    const { g, n, i } = atual();
    const txt = i >= n ? 'Todas as tarefas respondidas' : `Tarefa ${i + 1} de ${n}: ${R[g].tarefas[i].t}`;
    return `<div class="teste-barra" role="region" aria-label="Teste do sistema"><span class="tb-selo">Teste</span><span class="tb-t">${E(txt)}</span>
      <button class="btn pri peq" data-acao="rot-abrir">Ver tarefa</button></div>`;
  }

  function painel(p) {
    const eu = S().eu; const g = grupoDe(eu.papel);
    if (S().testesSemBanco) return cab('Teste do sistema') + `<div class="painel-corpo"><div class="aviso">O roteiro de testes ainda não foi instalado no servidor. A coordenação geral roda o arquivo <b>21_roteiro_testes.sql</b> no Supabase.</div></div>`;
    if (!g) return cab('Teste do sistema') + '<div class="painel-corpo"><p>Não há roteiro para o seu perfil.</p></div>';
    if (p.ver === 'resultados' && eu.papel === 'coord_geral') return resultados();
    const st = ler();
    const { n, i } = atual(); const m = minhas();
    const topo = eu.papel === 'coord_geral' ? `<div class="rot-abas"><button class="btn peq pri" type="button">Meu roteiro</button><button class="btn peq" type="button" data-acao="rot-resultados">Resultados de todos</button></div>` : '';
    if (!st || !st.ativo) return cab('Teste do sistema') + `<div class="painel-corpo rot">${topo}
      <div class="rot-intro"><h3>Ajude a testar o sistema</h3>
        <p>São <b>${n} tarefas</b> curtas, uma de cada vez, para o perfil <b>${E(R[g].nome)}</b>. Em cada uma, você faz o que está escrito e diz se deu certo.</p>
        <ul class="perfil-lista"><li>Não existe resposta errada. Se você não conseguir, o problema é do sistema, e é isso que queremos descobrir.</li>
          <li>Use só dados inventados. Nunca o nome, o CPF ou a foto de uma pessoa de verdade.</li>
          <li>Se travar, conte em poucas palavras o que aconteceu. Pode falar em vez de digitar.</li>
          <li>Leva uns 20 a 30 minutos. Dá para parar e continuar depois.</li></ul>
        <div class="acoes"><button class="btn pri" data-acao="rot-comecar">Começar</button></div></div></div>`;
    if (i >= n) {
      const ok = [...m.values()].filter(r => r.resultado === 'ok').length, nao = [...m.values()].filter(r => r.resultado === 'nao').length;
      return cab('Teste do sistema') + `<div class="painel-corpo rot">${topo}<div class="rot-fim"><span class="rot-fim-ic" aria-hidden="true">✓</span><h3>Pronto, obrigada!</h3>
        <p>Você respondeu as ${n} tarefas: <b>${ok}</b> deram certo${nao ? ` e <b>${nao}</b> não deram` : ''}. A coordenação vai olhar cada resposta.</p>
        <div class="acoes"><button class="btn pri" data-acao="rot-sair">Sair do modo teste</button><button class="btn" data-acao="rot-ir" data-i="0">Rever as tarefas</button></div></div>${lista(g, n, i, m)}</div>`;
    }
    const tf = R[g].tarefas[i]; const resp = m.get(idDe(g, i));
    return cab('Tarefa ' + (i + 1) + ' de ' + n) + `<div class="painel-corpo rot">${topo}
      <div class="rot-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${i}"><i style="width:${Math.round(i / n * 100)}%"></i></div>
      <h3 class="rot-t">${E(tf.t)}</h3>
      <div class="rot-bloco"><span class="eyebrow">Como fazer</span><ol class="rot-passos">${tf.p.map(x => `<li>${E(x)}</li>`).join('')}</ol></div>
      <div class="rot-bloco rot-ver"><span class="eyebrow">O que deve acontecer</span><p>${E(tf.v)}</p></div>
      ${resp ? `<p class="small muted">Você já respondeu: <b>${resp.resultado === 'ok' ? 'Deu certo' : resp.resultado === 'nao' ? 'Não deu certo' : 'Pulou'}</b>. Pode responder de novo.</p>` : ''}
      <div class="rot-acoes">
        <button class="btn" data-acao="rot-fazer">Fazer agora no sistema</button>
        <button class="btn rot-ok" data-acao="rot-ok">Deu certo</button>
        <button class="btn rot-nao" data-acao="rot-nao">Não deu certo</button></div>
      <form class="rot-conte" data-form="rot-nao" ${p.nao ? '' : 'hidden'} novalidate>
        <label for="rot-com">${E(tf.pergunta ? tf.pergunta + ' Conte o que aconteceu:' : 'O que aconteceu? Onde você travou?')}</label>
        <textarea id="rot-com" name="comentario" rows="4" placeholder="Ex.: não achei o botão; apareceu uma mensagem de erro; demorou muito">${E(resp && resp.comentario || '')}</textarea>
        <div class="acoes"><button class="btn pri" type="submit">Enviar e ir para a próxima</button></div></form>
      ${tf.pergunta ? `<p class="small muted">${E(tf.pergunta)} Se foi difícil, toque em "Não deu certo" e conte.</p>` : ''}
      <button class="link small" data-acao="rot-pular">Pular esta tarefa</button>
      ${lista(g, n, i, m)}</div>`;
  }
  const cab = t => `<div class="painel-cab"><div class="t"><span class="eyebrow">Teste do sistema</span><h2 id="painel-t">${E(t)}</h2></div>
      <button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  function lista(g, n, i, m) {
    return `<details class="hist rot-lista"><summary>Todas as tarefas (${[...m.keys()].filter(k => k.startsWith(g + '-')).length} de ${n} respondidas)</summary><ol>
      ${R[g].tarefas.map((tf, k) => { const r = m.get(idDe(g, k)); const c = r ? (r.resultado === 'ok' ? 'ok' : r.resultado === 'nao' ? 'nao' : 'pulou') : '';
        return `<li class="${c}${k === i ? ' agora' : ''}"><button class="link" data-acao="rot-ir" data-i="${k}">${E(tf.t)}</button><span class="small muted">${r ? (c === 'ok' ? 'deu certo' : c === 'nao' ? 'não deu certo' : 'pulou') : ''}</span></li>`; }).join('')}</ol></details>`;
  }

  /* coordenação geral: tudo o que a equipe respondeu, tarefa por tarefa */
  function resultados() {
    const todos = S().testes || []; const pessoa = id => (S().equipe || []).find(x => x.id === id) || {};
    const blocos = Object.entries(R).map(([g, r]) => {
      const linhas = r.tarefas.map((tf, k) => {
        const rs = todos.filter(x => x.tarefa === idDe(g, k));
        const ok = rs.filter(x => x.resultado === 'ok').length, nao = rs.filter(x => x.resultado === 'nao'), pul = rs.filter(x => x.resultado === 'pulou').length;
        const coms = rs.filter(x => x.comentario);
        return `<li class="${nao.length ? 'nao' : rs.length ? 'ok' : ''}"><div class="rr-l"><b>${E(tf.t)}</b><span class="small"><span class="chip ok">${ok} deu certo</span> <span class="chip ${nao.length ? 'crit' : 'off'}">${nao.length} não deu</span>${pul ? ` <span class="chip off">${pul} pulou</span>` : ''}</span></div>
          ${coms.length ? `<ul class="rr-com">${coms.map(x => { const pe = pessoa(x.equipe_id); return `<li><span class="small muted">${E((pe.nome_social || pe.nome || 'Alguém').split(' ')[0])} · ${E(x.aparelho || '')} · ${new Date(x.em).toLocaleDateString('pt-BR')}</span><span>${E(x.comentario)}</span></li>`; }).join('')}</ul>` : ''}</li>`;
      }).join('');
      const resp = new Set(todos.filter(x => x.tarefa.startsWith(g + '-')).map(x => x.equipe_id)).size;
      return `<details class="hist" ${todos.some(x => x.tarefa.startsWith(g + '-')) ? 'open' : ''}><summary>${E(r.nome)} · ${resp} pessoa${resp === 1 ? '' : 's'} respondeu${resp === 1 ? '' : 'ram'}</summary><ul class="rr">${linhas}</ul></details>`;
    }).join('');
    const nNao = todos.filter(x => x.resultado === 'nao').length;
    const gente = (S().equipe || []).filter(x => x.status === 'ativa' && x.papel !== 'coord_geral' && grupoDe(x.papel))
      .sort((a, b) => String(a.papel).localeCompare(String(b.papel)) || String(a.nome).localeCompare(String(b.nome)));
    const conv = G.convite;
    const convites = `<details class="hist" ${conv ? 'open' : ''}><summary>Convidar para o teste (dados de acesso)</summary><div class="dobra-in">
      <p class="small muted">Gere o convite de cada pessoa: ele traz o link do teste, o e-mail de entrada e, para quem ainda não entrou, o código de acesso. Mande pelo WhatsApp. Quem já tem senha entra com a própria senha.</p>
      <div class="fic-lista">${gente.map(x => `<div class="fic-pessoa">${U().avatar(x, 32)}<span class="fp-t"><b>${E(x.nome_social || x.nome)}</b><span class="small muted">${E(MQ.PAPEIS[x.papel].nome)}${x.uf ? ' · ' + E(x.uf) : ''} · ${E(x.email)} · ${x.user_id ? 'já tem senha' : 'ainda não entrou'}</span></span>
        <button class="btn peq${conv && conv.id === x.id ? ' pri' : ''}" data-acao="rot-convite" data-id="${E(x.id)}">Gerar convite</button></div>
        ${conv && conv.id === x.id ? `<div class="bloco aviso-acesso rot-conv">${conv.cod ? `<div class="cod-acesso"><span class="small muted">Código de acesso</span><b class="num">${E(conv.cod)}</b><span class="small muted">vale 7 dias</span></div>` : ''}
          <textarea readonly rows="10" aria-label="Mensagem do convite" onclick="this.select()">${E(conv.msg)}</textarea>
          <div class="acoes"><a class="btn pri" target="_blank" rel="noopener" href="${E(conv.wa)}">Mandar por WhatsApp</a><button class="btn" type="button" data-acao="copiar-texto">Copiar</button></div></div>` : ''}`).join('') || '<p class="muted">Ninguém cadastrado ainda.</p>'}</div></div></details>`;
    return cab('Resultados do teste') + `<div class="painel-corpo rot"><div class="rot-abas"><button class="btn peq" data-acao="rot-abrir">Meu roteiro</button><button class="btn peq pri" type="button">Resultados de todos</button></div>
      <p>${todos.length} resposta${todos.length === 1 ? '' : 's'} · <b>${nNao}</b> "não deu certo". Para convidar, mande o link <b>${E(location.origin + location.pathname)}#teste</b>: a pessoa entra e o roteiro do perfil dela abre sozinho.</p>
      ${convites}${blocos}</div>`;
  }

  async function responder(resultado, comentario) {
    const { g, i, n } = atual(); if (i >= n) return;
    const reg = { equipe_id: S().eu.id, tarefa: idDe(g, i), resultado, comentario: comentario || null, aparelho: aparelho() };
    await S().api.salvarTeste(reg);
    S().testes = (S().testes || []).filter(x => !(x.equipe_id === reg.equipe_id && x.tarefa === reg.tarefa)).concat([Object.assign({ em: new Date().toISOString() }, reg)]);
    gravar(Object.assign({}, ler(), { ativo: true, i: i + 1 }));
    U().toast(resultado === 'ok' ? 'Anotado: deu certo.' : resultado === 'nao' ? 'Obrigada! Anotamos o problema.' : 'Tarefa pulada.');
    U().abrirPainel({ tipo: 'roteiro' }); U().render();
  }

  async function clique(a, el) {
    if (a === 'rot-abrir') { U().abrirPainel({ tipo: 'roteiro' }); return; }
    if (a === 'rot-resultados') { U().abrirPainel({ tipo: 'roteiro', ver: 'resultados' }); return; }
    if (a === 'rot-comecar') { gravar({ ativo: true, i: 0 }); U().render(); U().abrirPainel({ tipo: 'roteiro' }); return; }
    if (a === 'rot-sair') { gravar(null); U().fecharPainel(); U().render(); U().toast('Modo teste desligado. Obrigada!'); return; }
    if (a === 'rot-ir') { gravar(Object.assign({}, ler(), { ativo: true, i: +el.dataset.i })); U().abrirPainel({ tipo: 'roteiro' }); U().render(); return; }
    if (a === 'rot-convite') {
      const x = (S().equipe || []).find(m => m.id === el.dataset.id); if (!x) return;
      el.disabled = true;
      try {
        let cod = null;
        if (!x.user_id) cod = await S().api.gerarCodigoAcesso(x.id);
        const url = location.origin + location.pathname + '#teste'; const nome = (x.nome_social || x.nome).split(' ')[0];
        const msg = `Olá, ${nome}! Você foi convidada para testar o sistema do projeto Mulheres & Quintais.\n\n1) Abra este link no Chrome (Android) ou no Safari (iPhone):\n${url}\n` +
          (cod ? `2) Toque em "Primeiro acesso"\n3) E-mail: ${x.email}\n4) Código de acesso: ${cod} (vale 7 dias, uma vez só)\n5) Crie uma senha com letras e números\n`
               : `2) Toque em "Já tenho senha"\n3) Entre com o e-mail ${x.email} e a sua senha\n`) +
          `\nDepois de entrar, o roteiro do teste abre sozinho. São tarefas curtas, uma de cada vez. Use só dados inventados. Se travar em alguma, conte o que aconteceu: o problema é do sistema, não seu.`;
        const fone = String(x.telefone || '').replace(/\D/g, '');
        G.convite = { id: x.id, cod, msg, wa: 'https://wa.me/' + (fone.length >= 10 ? '55' + fone : '') + '?text=' + encodeURIComponent(msg) };
        if (cod && S().codigos) S().codigos[x.id] = cod;
        U().abrirPainel({ tipo: 'roteiro', ver: 'resultados' });
      } catch (e) { el.disabled = false; U().toast(e.message || String(e)); }
      return;
    }
    if (a === 'rot-fazer') { U().fecharPainel(); U().toast('Faça a tarefa. Depois toque em "Ver tarefa", lá embaixo, para responder.'); return; }
    if (a === 'rot-nao') { U().abrirPainel({ tipo: 'roteiro', nao: true }); setTimeout(() => { const t = document.getElementById('rot-com'); if (t) t.focus(); }, 50); return; }
    try {
      el.disabled = true;
      if (a === 'rot-ok') await responder('ok');
      else if (a === 'rot-pular') await responder('pulou');
    } catch (e) { el.disabled = false; U().toast(e.message || String(e)); }
  }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'rot-nao') return;
    await U().ocupado(form, async () => { await responder('nao', String(fd.get('comentario') || '').trim()); });
  }

  /* o link .../#teste liga o modo teste e abre o roteiro depois de entrar */
  function verificarLink() {
    if (location.hash !== '#teste' || !S().eu) return;
    history.replaceState(null, '', location.pathname + location.search);
    const st = ler(); if (!st || !st.ativo) gravar({ ativo: false, i: 0 });
    setTimeout(() => U().abrirPainel({ tipo: 'roteiro' }), 300);
  }

  MQ.roteiroUI = { barra, painel, clique, enviar, verificarLink, ativo, grupoDe, R };
})();
