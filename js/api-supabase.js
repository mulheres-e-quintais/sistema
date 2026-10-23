/* Modo produção: Supabase (login com e-mail e senha, dados no banco com RLS). */
(function () {
  const R = MQ.regras;
  let sb = null;
  let euCache = null;
  const marcas = { fichas: {}, diagnosticos: {} };   // "atualizado_em" de cada registro na última leitura (item: aprovar o que foi lido)

  /* Listas inteiras, em partes. O Supabase devolve no máximo 1.000 linhas por pedido (configuração "Max rows") e corta o resto sem avisar:
     aqui o sistema pede de 1.000 em 1.000 até chegar ao total que o próprio banco informa. `montar` devolve a consulta já com filtros e ordem
     (a ordem termina na chave da tabela, para as partes não se repetirem nem pularem linha). Devolve { data, error }, como uma consulta comum. */
  const PARTE = 1000, CT = { count: 'exact' };
  async function todas(montar) {
    let tudo = [];
    for (let de = 0; de < 200000;) {   // teto de segurança: 200 partes
      const { data, error, count } = await montar().range(de, de + PARTE - 1);
      if (error) return { data: null, error };
      const l = data || []; tudo = tudo.concat(l); de += l.length;
      if (!l.length || (count == null ? l.length < PARTE : tudo.length >= count)) break;
    }
    return { data: tudo, error: null };
  }
  // 70: servidor ainda sem a tabela do questionário socioeconômico (equipe_socio)
  const semTabelaSocio = e => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /Could not find the table|relation .*equipe_socio.* does not exist/i.test(String(e.message || '')));
  const erro = e => {
    // mensagens do banco já instalado ainda dizem "professor do FIC": o nome certo é "professor do curso FIC" (12/10/2026)
    const x = new Error(String(R.mensagemErro(e)).replace(/([Pp]rofessor(?:es|a)?) do FIC/g, '$1 do curso FIC')); x.original = e;
    x.semRede = !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network/i.test(String((e && e.message) || e));
    // auditoria 2 (12/10/2026): prazo estourado não é "sem internet": é falha daquele envio (a fila passa para o próximo)
    x.prazoEsgotado = /o servidor não respondeu em/.test(String((e && e.message) || e));
    return x;
  };
  const lerEuGuardado = () => { try { return JSON.parse(localStorage.getItem('mq-eu') || 'null'); } catch (e) { return null; } };
  const CAMPOS = ['papel', 'uf', 'nome', 'cpf', 'email', 'telefone', 'municipio', 'organizacao', 'data_inicio',
    'meta_diagnosticos', 'meta_quintais', 'meta_visitas', 'matricula_fic_em', 'matricula_fic_numero', 'docs_funcern_em',
    'termo_path', 'termo_assinado_em', 'obs_habilitacao', 'foto_path', 'nome_social', 'cadastro_arlo', 'siape', 'consentimento_lgpd', 'substitui_id', 'status', 'data_fim', 'motivo_desligamento'];
  const limpar = o => { const r = {}; CAMPOS.forEach(k => { if (k in o) r[k] = o[k] === '' ? null : o[k]; }); return r; };

  /* Grava com UPDATE quando o registro já existe e INSERT só quando é novo.
     (upsert dispara o gatilho de inclusão mesmo ao editar, e as travas de inclusão bloqueariam a edição) */
  /* 47 (versão do registro): "marca" é o atualizado_em que a tela leu, como TEXTO, igual ao que veio do banco (nunca passa
     por Date: perderia os microssegundos). Vai junto no UPDATE; se o registro mudou depois da leitura, o banco recusa com
     "Este registro foi alterado por outra pessoa…". Sem marca (registro novo, banco sem o 47), grava como antes. */
  async function gravar(tabela, reg, marca) {
    const muda = marca ? Object.assign({}, reg, { atualizado_em: marca }) : reg;
    const { data: up, error: e1 } = await sb.from(tabela).update(muda).eq('id', reg.id).select();
    if (e1) throw erro(e1);
    if (up && up.length) return up[0];
    // 18/10/2026 (auditoria independente): com marca, o registro existia quando a pessoa leu. Se o UPDATE não achou a linha, ele saiu do
    // alcance dela (visita passada para outra pessoa, quintal fora da lista): antes tentava incluir e a mensagem era "sem permissão"
    if (marca) throw erro({ code: 'P0001', message: 'Este registro não está mais com você: foi passado para outra pessoa ou saiu da sua lista. Fale com a bolsista do estado ou com a coordenação.' });
    const { data, error } = await sb.from(tabela).insert(reg).select().single();
    if (error) throw erro(error);
    return data;
  }
  /* antes de subir foto: se o registro já mudou no servidor, para aqui (a foto nova não fica por cima da de outra pessoa) */
  async function conferirMarca(tabela, id, marca) {
    if (!marca) return;
    const { data, error } = await sb.from(tabela).select('atualizado_em').eq('id', id).maybeSingle();
    if (error) throw erro(error);
    if (data && data.atualizado_em !== marca) throw erro({ code: 'P0001', message: R.MSG_CONFLITO });
  }
  const temFoto = fotos => Object.values(fotos || {}).some(Boolean);
  /* Recodifica a imagem no navegador: tira metadados (EXIF com GPS, modelo do celular) antes de publicar */
  function limparImagem(blob, max = 1600) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob); const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error('Não foi possível preparar a foto.')), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Arquivo de foto inválido.')); };
      img.src = url;
    });
  }

  /* 17 (auditoria de 12/10/2026): com sinal que engana (rede "conectada" que não responde), a chamada esperava para
     sempre e o botão ficava em "Salvando…". Agora cada chamada tem prazo: 30 s para dados, 120 s para enviar arquivo
     (foto, termo). Passou do prazo, conta como falta de internet: o registro fica na fila e é enviado depois. */
  MQ.prazoRede = { dados: 30000, arquivo: 120000 };
  function fetchComPrazo(url, op) {
    const ehArquivo = /\/storage\/v1\/object/.test(String(url && url.url || url)) && op && op.method && op.method !== 'GET';
    // arquivo: no mínimo 2 minutos, e mais tempo quanto maior ele for (calculado para ~20 KB por segundo, internet fraca)
    const tam = ehArquivo && op && op.body && typeof op.body.size === 'number' ? op.body.size : 0;
    const prazo = ehArquivo ? Math.max(MQ.prazoRede.arquivo, Math.ceil(tam / 20000) * 1000) : MQ.prazoRede.dados;
    if (typeof AbortController === 'undefined') return fetch(url, op);
    const ctl = new AbortController(); let esgotou = false;
    const t = setTimeout(() => { esgotou = true; ctl.abort(); }, prazo);
    // quem chamou também pode cancelar (o sinal de quem chamou continua valendo)
    if (op && op.signal) { if (op.signal.aborted) ctl.abort(); else op.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    return fetch(url, Object.assign({}, op, { signal: ctl.signal }))
      .catch(e => { if (esgotou) throw new TypeError('Failed to fetch: o servidor não respondeu em ' + Math.round(prazo / 1000) + ' segundos'); throw e; })
      .finally(() => clearTimeout(t));
  }
  MQ.fetchComPrazo = fetchComPrazo;
  const opcoesCliente = extra => ({ global: { fetch: fetchComPrazo }, auth: Object.assign({ persistSession: true }, extra || {}) });

  /* fotos da equipe: link temporário (1 h) guardado e reaproveitado até faltarem 10 min para vencer (13/10/2026, auditoria):
     antes cada atualização de 2 em 2 minutos gerava links novos, a tela "mudava" sem nada mudar e as fotos eram baixadas de novo */
  const linksFoto = new Map();
  async function linksDasFotos(lista) {
    const agora = Date.now();
    lista.forEach(m => { const g = m.foto_path && !m.foto_url && linksFoto.get(m.foto_path); if (g && g.vence - agora > 600000) m.foto_url = g.url; });
    const com = lista.filter(m => m.foto_path && !m.foto_url);
    if (!com.length) return;
    try {
      const caminhos = [...new Set(com.map(m => m.foto_path))];
      const { data: urls } = await sb.storage.from('equipe').createSignedUrls(caminhos, 3600);
      (urls || []).forEach((u, i) => { if (u && u.signedUrl) linksFoto.set(caminhos[i], { url: u.signedUrl, vence: agora + 3600000 }); });
      com.forEach(m => { const g = linksFoto.get(m.foto_path); if (g) m.foto_url = g.url; });
    } catch (e) { /* sem foto: ficam as iniciais */ }
  }
  MQ.apiSupabase = {
    modo: 'supabase',
    async iniciar() {
      sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, opcoesCliente({ detectSessionInUrl: true }));
      // 13/10/2026 (auditoria): saiu em outra aba (ou a sessão foi encerrada no servidor): esta aba também sai, sem apagar a fila
      try { sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') { this.temSessao = false; if (MQ.ui && MQ.ui.sessaoEncerrada) MQ.ui.sessaoEncerrada(); } }); } catch (e) {}
      let sessao = null, prazo = false;
      const guardado = lerEuGuardado();
      // 13/10/2026 (auditoria): com o login vencido e sem servidor, a renovação demorava ~30 s; com perfil guardado, espera no máximo 6 s
      try { const r = await (guardado ? Promise.race([sb.auth.getSession(), new Promise(ok => setTimeout(() => { prazo = true; ok(null); }, 6000))]) : sb.auth.getSession());
        sessao = r && r.data ? r.data.session : null; } catch (e) { /* sem rede */ }
      // a sessão ainda está guardada no aparelho (a renovação falhou por falta de servidor, não porque saiu)
      const tokenGuardado = (() => { try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)); } catch (e) { return false; } })();
      if (!sessao) {
        // Sem internet (ou "sinal que engana": o celular diz que tem rede, mas o servidor não responde), a sessão não é renovada:
        // usa o perfil guardado para trabalhar sem internet. Saiu de verdade (token apagado): vai para a entrada.
        if (guardado && (!navigator.onLine || prazo || tokenGuardado)) { this.temSessao = true; this.offline = true; euCache = guardado; return guardado; }
        this.temSessao = false; return null;
      }
      this.temSessao = true;
      try { return await this.eu(true); }
      catch (e) { if (guardado && (e.semRede || !navigator.onLine)) { this.offline = true; euCache = guardado; return guardado; } throw e; }
    },
    async eu(forcar) {
      if (euCache && !forcar) return euCache;
      const { data, error } = await sb.rpc('vincular_conta');
      if (error) throw erro(error);
      euCache = data && data.id ? data : null;
      if (!euCache) {   // não é da equipe: pode ser de acompanhamento (52_acompanhamento.sql); sem a função no banco, segue como "sem cadastro"
        try { const r = await sb.rpc('acompanhamento_eu'); const o = r && !r.error ? r.data : null;
          if (o && o.id) euCache = { id: o.id, nome: o.nome, cargo: o.cargo || null, orgao: o.orgao, papel: 'obs_' + o.orgao, observador: true, status: 'ativa' }; } catch (e) {}
      }
      try { if (euCache) localStorage.setItem('mq-eu', JSON.stringify(euCache)); else localStorage.removeItem('mq-eu'); } catch (e) {}
      this.offline = false;
      return euCache;
    },
    async entrar(email) {
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (error) {
        const msg = String(error.message || '');
        if (/não cadastrado|Database error/i.test(msg)) throw erro('Este e-mail não está cadastrado no projeto. Fale com a coordenação.');
        if (error.status === 429 || /rate limit|security purposes/i.test(msg)) throw erro('Muitas tentativas seguidas. Espere 1 minuto e tente de novo.');
        if (/sending|smtp|email/i.test(msg)) throw erro('O servidor não conseguiu enviar o e-mail. Avise a coordenação. (' + msg + ')');
        throw erro(error);
      }
    },
    /* Login com senha (não depende de servidor de e-mail).
       Exige "Confirm email" DESLIGADO no Supabase (Authentication > Sign In / Providers > Email). */
    /* troca a própria senha: confere a atual antes (quem pegou o celular desbloqueado não troca sem saber a senha) */
    async trocarSenha(atual, nova) {
      const { data: u, error: e0 } = await sb.auth.getUser(); if (e0 || !u || !u.user) throw erro('Entre de novo no sistema para trocar a senha.');
      const { error: e1 } = await sb.auth.signInWithPassword({ email: u.user.email, password: atual });
      if (e1) throw erro(/invalid|credentials/i.test(e1.message) ? 'A senha atual não confere.' : e1);
      const { error: e2 } = await sb.auth.updateUser({ password: nova });
      if (e2) throw erro(/different|same/i.test(e2.message) ? 'A nova senha precisa ser diferente da atual.' : /weak|short|characters/i.test(e2.message) ? 'Senha fraca: use pelo menos 8 caracteres, com letras e números.' : e2);
    },
    async entrarSenha(email, senha) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      if (error) {
        const msg = String(error.message || '');
        if (/Invalid login credentials/i.test(msg)) throw erro('E-mail ou senha incorretos. Se é seu primeiro acesso, use "Primeiro acesso".');
        if (/not confirmed/i.test(msg)) throw erro('Conta ainda não liberada. Avise a coordenação geral (confirmação de e-mail ligada no servidor).');
        if (error.status === 429) throw erro('Muitas tentativas seguidas. Espere 1 minuto e tente de novo.');
        throw erro(error);
      }
      this.temSessao = !!data.session;
      return this.eu(true);
    },
    async criarSenha(email, senha, codigo) {
      const { data, error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { data: { codigo: codigo || '' } } });
      if (error) {
        const msg = String(error.message || '');
        if (/não cadastrado|Database error|código/i.test(msg)) throw erro('Não deu certo: confira o e-mail e o código de acesso. O código vale 7 dias e uma vez só; se venceu, peça um novo a quem cadastrou você.');
        if (/already registered|already exists/i.test(msg)) throw erro('Este e-mail já tem senha. Use "Entrar". Se esqueceu a senha, peça à coordenação geral para liberar um novo primeiro acesso.');
        if (/password/i.test(msg)) throw erro('Senha fraca: use pelo menos 8 caracteres, misturando letras e números.');
        if (error.status === 429) throw erro('Muitas tentativas seguidas. Espere 1 minuto e tente de novo.');
        throw erro(error);
      }
      if (!data.session) throw erro('Senha criada, mas o servidor ainda exige confirmação por e-mail. Avise a coordenação geral.');
      this.temSessao = true;
      return this.eu(true);
    },
    /* "Organizar o texto": Edge Function organizar-texto (20_organizar_texto.sql + chave da API no Supabase) */
    async organizarTexto(texto, tipo) {
      const { data, error } = await sb.functions.invoke('organizar-texto', { body: { texto, tipo } });
      if (error) {
        let msg = '';
        try { const j = await error.context.json(); msg = j && j.erro; } catch (e) {}
        const st = error.context && error.context.status;
        if (!msg && (st === 404 || /not found|Failed to send/i.test(String(error.message)))) msg = 'A organização de texto ainda não foi instalada no servidor. Avise a coordenação geral.';
        throw erro(msg || 'Não foi possível organizar o texto agora. Tente de novo.');
      }
      if (!data || !data.proposta) throw erro((data && data.erro) || 'Não veio texto. Tente de novo.');
      return data.proposta;
    },
    async listarPerfisEquipe() { const { data, error } = await todas(() => sb.from('equipe_privado').select('equipe_id, perfil', CT).order('equipe_id')); if (error) throw erro(error); return data; },
    /* roteiro de testes (21_roteiro_testes.sql) */
    async listarTestes() { const { data, error } = await todas(() => sb.from('testes_resultados').select('*', CT).order('equipe_id').order('tarefa')); if (error) throw erro(error); return data; },
    async salvarTeste(r) { const { error } = await sb.from('testes_resultados').upsert(r, { onConflict: 'equipe_id,tarefa' }); if (error) throw erro(error); },
    /* entregas do mês (19_entregas_do_mes.sql) */
    async listarEntregas() { const { data, error } = await todas(() => sb.from('entregas_mes').select('*', CT).order('equipe_id').order('mes').order('item')); if (error) throw erro(error); return data; },
    async marcarEntrega(equipe_id, mes, item, marcar) {
      const q = marcar ? sb.from('entregas_mes').insert({ equipe_id, mes, item })
        : sb.from('entregas_mes').delete().match({ equipe_id, mes, item });
      const { error } = await q; if (error && !(marcar && error.code === '23505')) throw erro(error);
    },
    async listarCiencias() { const { data, error } = await todas(() => sb.from('ciencias').select('*', CT).order('equipe_id').order('documento')); if (error) throw erro(error); return data; },
    async darCiencia(equipe_id, documento) {
      const { error } = await sb.from('ciencias').insert({ equipe_id, documento }); if (error && error.code !== '23505') throw erro(error);
    },
    /* ---------- "Esqueci a senha" (28_pedido_novo_acesso.sql) ---------- */
    async pedirNovoAcesso(email) {   // sem login; a resposta é sempre a mesma
      if (!sb) sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, opcoesCliente());
      const { error } = await sb.rpc('pedir_novo_acesso', { p_email: email });
      if (error) throw erro(/pedir_novo_acesso|PGRST202/.test(error.message) ? 'O pedido de novo acesso ainda não está instalado. Fale direto com a coordenação geral.' : error);
    },
    async listarPedidosAcesso() {
      const { data, error } = await todas(() => sb.from('pedidos_novo_acesso').select('*', CT).eq('situacao', 'aguardando').order('pedido_em').order('id')); if (error) throw erro(error); return data;
    },
    async descartarPedidoAcesso(id) {
      const { data, error } = await sb.from('pedidos_novo_acesso').update({ situacao: 'descartado' }).eq('id', id).select('id'); if (error) throw erro(error);
      if (!data || !data.length) throw erro('Pedido não encontrado.');
    },
    /* ---------- Últimos acessos (30_ultimos_acessos.sql) ---------- */
    async registrarAcesso(tipo, aparelho) {   // nunca atrapalha: sem o script 30, só não registra
      if (!sb) return;
      try { await sb.rpc('registrar_acesso', { p_tipo: tipo, p_aparelho: aparelho || null }); } catch (e) {}
    },
    async listarAcessos() {
      const { data, error } = await sb.from('acessos').select('*').order('em', { ascending: false }).limit(500); if (error) throw erro(error); return data;
    },
    async gerarCodigoAcesso(id) { const { data, error } = await sb.rpc('gerar_codigo_acesso', { p_equipe: id }); if (error) throw erro(error); return data; },
    /* ---------- Fichas de indicação ---------- */
    async listarFichas() {
      const { data, error } = await todas(() => sb.from('fichas').select('*', CT).order('criado_em', { ascending: false }).order('id'));
      if (error) throw erro(error);
      (data || []).forEach(f => { marcas.fichas[f.id] = f.atualizado_em; });   // o que a coordenação leu (confere ao aprovar)
      return data;
    },
    async salvarFicha(dados, fotos, op) {
      const f = Object.assign({}, dados); const marca = (op && op.marca) || null;
      if (temFoto(fotos)) await conferirMarca('fichas', f.id, marca);
      for (const [campo, blob] of Object.entries(fotos || {})) {
        if (!blob) continue;
        const ext = /pdf/.test(blob.type) ? 'pdf' : 'jpg';
        const path = f.uf + '/' + f.id + '/' + campo + '.' + ext;
        const { error } = await sb.storage.from('fichas').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        // 57: ficha aprovada não troca arquivo (o banco recusa): a mensagem diz o que fazer
        if (error) throw erro(/row-level security|policy|unauthorized|not authorized/i.test(error.message || '') ? 'Ficha já aprovada pela coordenação técnica: a foto e o termo não se trocam mais. Para corrigir, peça que ela devolva a ficha.' : error);
        f['foto_' + campo + '_path'] = path;
      }
      ['tem_foto_ficha', 'tem_foto_termo', 'pontos', 'situacao', 'aprovada_por', 'aprovada_em', 'obs_coordenacao', 'bolsista_id', 'criado_em', 'atualizado_em']
        .forEach(k => delete f[k]);
      { const g = await gravar('fichas', f, marca); marcas.fichas[g.id] = g.atualizado_em; return g; }
    },
    // marca = "atualizado_em" do registro que a coordenação leu: se a ficha mudou depois disso, o servidor recusa a aprovação
    async decidirFicha(id, situacao, obs, marca) {
      const muda = { situacao, obs_coordenacao: obs || null }; const m = marca || marcas.fichas[id];
      if (m) muda.atualizado_em = m;   // 14/10/2026 (BD-5): também na devolução, senão ela passava por cima da correção que chegou antes
      const { data, error } = await sb.from('fichas').update(muda).eq('id', id).select().single();
      if (error) throw erro(error);
      marcas.fichas[id] = data.atualizado_em;
      return data;
    },
    /* ---------- Visitas e diagnósticos ---------- */
    async listarVisitas() {
      const { data, error } = await todas(() => sb.from('visitas').select('*', CT).order('data_prevista').order('id'));
      if (error) throw erro(error); return data;
    },
    async salvarVisita(v, fotos, op) {
      const r = Object.assign({}, v); ['criado_por', 'criado_em', 'atualizado_em'].forEach(k => delete r[k]); const marca = (op && op.marca) || null;
      if (temFoto(fotos)) await conferirMarca('visitas', r.id, marca);
      // fotos da visita feita (implantação/acompanhamento): <UF>/<ficha>/visita_<id>_<n>.jpg no bucket "campo"
      const caminhos = new Set(r.fotos || []);
      for (const [k, blob] of Object.entries(fotos || {})) {
        if (!blob) continue;
        const path = r.uf + '/' + r.ficha_id + '/visita_' + r.id + '_' + k + '.jpg';
        const { error } = await sb.storage.from('campo').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (error) throw erro(error);
        caminhos.add(path);
      }
      if (caminhos.size || 'fotos' in r) r.fotos = [...caminhos];
      return gravar('visitas', r, marca);
    },
    async listarDiagnosticos() {
      const { data, error } = await todas(() => sb.from('diagnosticos').select('*', CT).order('data_visita', { ascending: false }).order('id'));
      if (error) throw erro(error); (data || []).forEach(d => { marcas.diagnosticos[d.id] = d.atualizado_em; }); return data;
    },
    async salvarDiagnostico(dados, fotos, op) {
      const d = Object.assign({}, dados); const marca = (op && op.marca) || null;
      if (temFoto(fotos)) await conferirMarca('diagnosticos', d.id, marca);
      const caminhos = new Set(d.fotos || []);
      for (const [campo, blob] of Object.entries(fotos || {})) {
        if (!blob) continue;
        const path = d.uf + '/' + d.ficha_id + '/diag_' + campo + '.jpg';
        const { error } = await sb.storage.from('campo').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (error) throw erro(error);
        caminhos.add(path);
      }
      d.fotos = [...caminhos];
      ['situacao', 'aprovado_por', 'aprovado_em', 'obs_coordenacao', 'executor_id', 'criado_em', 'atualizado_em', 'conteudo_alterado_por', 'conteudo_alterado_em'].forEach(k => delete d[k]);
      { const g = await gravar('diagnosticos', d, marca); marcas.diagnosticos[g.id] = g.atualizado_em; return g; }
    },
    async listarAvaliacoes() {
      const { data, error } = await todas(() => sb.from('avaliacoes').select('*', CT).order('data_visita', { ascending: false }).order('id')); if (error) throw erro(error); return data;
    },
    async salvarAvaliacao(dados, fotos, op) {
      const d = Object.assign({}, dados); const caminhos = new Set(d.fotos || []); const marca = (op && op.marca) || null;
      if (temFoto(fotos)) await conferirMarca('avaliacoes', d.id, marca);
      for (const [k, blob] of Object.entries(fotos || {})) {
        if (!blob) continue;
        const path = d.uf + '/' + d.ficha_id + '/aval_' + k + '.jpg';
        const { error } = await sb.storage.from('campo').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (error) throw erro(error);
        caminhos.add(path);
      }
      d.fotos = [...caminhos]; ['executor_id', 'criado_em', 'atualizado_em'].forEach(k => delete d[k]);
      return gravar('avaliacoes', d, marca);
    },
    async decidirDiagnostico(id, situacao, obs, marca) {
      const muda = { situacao, obs_coordenacao: obs || null }; const m = marca || marcas.diagnosticos[id];
      if (m) muda.atualizado_em = m;   // 14/10/2026 (BD-5): também na devolução
      const { data, error } = await sb.from('diagnosticos').update(muda).eq('id', id).select().single();
      if (error) throw erro(error); marcas.diagnosticos[id] = data.atualizado_em; return data;
    },
    async linkFoto(path) {
      const balde = /\/(diag_|visita_|aval_)/.test(path) ? 'campo' : 'fichas';
      const { data, error } = await sb.storage.from(balde).createSignedUrl(path, 600);
      if (error) throw erro(error);
      return data.signedUrl;
    },

    /* ---------- Link de cadastro (a pessoa preenche, a coordenação valida) ---------- */
    async criarConvite(papel, uf, subst) {
      const { data, error } = await sb.rpc('criar_convite', { p_papel: papel, p_uf: uf || null, p_substitui: subst || null });
      if (error) throw erro(/criar_convite|PGRST202/.test(error.message) ? 'O link de cadastro ainda não foi instalado no servidor: rode o arquivo 08_convites.sql no Supabase.' : /perfil/.test(error.message) ? 'Falta instalar o perfil no campo no servidor: rode o arquivo 19_entregas_do_mes.sql no Supabase.' : error);
      return data;
    },
    async verConvite(token) {
      if (!sb) sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, opcoesCliente());
      const { data, error } = await sb.rpc('ver_convite', { p_token: token });
      if (error) throw erro(error); return data;
    },
    async enviarPreCadastro(token, dados) {
      const { error } = await sb.rpc('enviar_pre_cadastro', { p_token: token, p_dados: dados });
      if (error) throw erro(error);
    },
    /* 14/10/2026 (auditoria E2E-1): a fila confere se o que ela ia mandar já está no servidor (a resposta se perdeu na queda de rede) */
    async registroAtual(tabela, id) {
      if (!['visitas', 'diagnosticos', 'avaliacoes', 'fichas'].includes(tabela) || !id) return null;
      const { data, error } = await sb.from(tabela).select('*').eq('id', id).maybeSingle(); if (error) throw erro(error); return data || null;
    },
    async lerPrivado(id) {
      const { data, error } = await sb.from('equipe_privado').select('*').eq('equipe_id', id).maybeSingle();
      if (error) throw erro(error);
      // 70: o questionário socioeconômico fica à parte; só a própria pessoa e a coordenação geral recebem (para as outras volta vazio)
      const r = await sb.from('equipe_socio').select('socioeconomico').eq('equipe_id', id).maybeSingle();
      if (r.error) return semTabelaSocio(r.error) ? data : Object.assign({ equipe_id: id }, data || {}, { socioeconomico: undefined, _socioErro: true });   // auditoria 22/10: falhou a leitura: o questionário não aparece (e não é apagado ao salvar)
      if (!data && !r.data) return null;
      return Object.assign({ equipe_id: id }, data || {}, { socioeconomico: r.data ? r.data.socioeconomico : null });
    },
    async salvarPrivado(id, d) {
      const reg = { equipe_id: id, data_nascimento: d.data_nascimento || null, nis: d.nis || null, endereco: d.endereco || {}, atualizado_em: new Date().toISOString() };
      if ('perfil' in d) reg.perfil = d.perfil || null;   // 19_entregas_do_mes.sql
      const { error } = await sb.from('equipe_privado').upsert(reg, { onConflict: 'equipe_id' });
      if (error) throw erro(/equipe_privado|PGRST205/.test(error.message) ? 'Os dados pessoais complementares ainda não foram instalados no servidor: rode o arquivo 08_convites.sql no Supabase.' : error);
      if (d.socioeconomico === undefined) return;   // 70: a tela não mostrou o questionário (quem não vê as respostas): não mexe
      const r = d.socioeconomico ? await sb.from('equipe_socio').upsert({ equipe_id: id, socioeconomico: d.socioeconomico, atualizado_em: new Date().toISOString() }, { onConflict: 'equipe_id' })
        : await sb.from('equipe_socio').delete().eq('equipe_id', id);
      if (!r.error) return;
      if (!semTabelaSocio(r.error)) throw erro(r.error);
      const v = await sb.from('equipe_privado').update({ socioeconomico: d.socioeconomico || null }).eq('equipe_id', id);   // servidor ainda sem o 70
      if (v.error) throw erro(v.error);
    },
    /* ---------- Dados bancários (só por funções do banco; nunca entram no cache do aparelho) ---------- */
    async meusDadosBancarios() { const { data, error } = await sb.rpc('meus_dados_bancarios'); if (error) throw erro(error); return data; },
    async salvarMeusDadosBancarios(d) {
      const { error } = await sb.rpc('salvar_meus_dados_bancarios', { p: d });
      if (error) throw erro(/salvar_meus_dados_bancarios|PGRST202/.test(error.message) ? 'Os dados bancários ainda não foram instalados no servidor: a coordenação geral precisa rodar o arquivo 09_dados_bancarios.sql.' : error);
    },
    async verContaArlo(id) { const { data, error } = await sb.rpc('ver_conta_para_arlo', { p_equipe: id }); if (error) throw erro(error); return data; },
    async situacaoBancaria() { const { data, error } = await sb.rpc('situacao_bancaria'); if (error) throw erro(error); return data; },
    async listarAPL() {
      const { data, error } = await todas(() => sb.from('apl_municipios').select('*', CT).order('uf').order('municipio')); if (error) throw erro(error); return data;
    },
    async salvarAPL(uf, municipio, apls, obs) {
      const { error } = await sb.from('apl_municipios').upsert({ uf, municipio, apls, obs }, { onConflict: 'uf,municipio' });
      if (error) throw erro(/apl_municipios|PGRST205/.test(error.message) ? 'O cadastro de APL ainda não foi instalado no servidor: rode o arquivo 10_apl.sql.' : error);
    },
    async listarPreCadastros() {
      const { data, error } = await todas(() => sb.from('pre_cadastros').select('*', CT).eq('situacao', 'aguardando').order('enviado_em').order('id'));
      if (error) throw erro(error); return data;
    },
    async decidirPreCadastro(id, situacao, obs, equipe_id) {
      const { error } = await sb.from('pre_cadastros').update({ situacao, obs: obs || null, equipe_id: equipe_id || null }).eq('id', id);
      if (error) throw erro(error);
    },
    /* 47: aprovar o cadastro vindo do link numa operação só (pessoa na equipe + dados pessoais + cadastro enviado aprovado: tudo ou nada).
       Banco sem o 47: o erro vem com "semFuncao" e a tela usa as três gravações de antes. */
    async aprovarPreCadastro(pre, m, priv) {
      const r = limpar(Object.assign({}, m, { cpf: R.soDigitos(m.cpf), email: m.email.trim().toLowerCase() })); delete r.status;
      const { data, error } = await sb.rpc('aprovar_pre_cadastro', { p_pre: pre, p_equipe: r, p_privado: priv || null });
      if (error) {
        if (error.code === 'PGRST202' || /Could not find the function|aprovar_pre_cadastro.*(does not exist|schema cache)/i.test(String(error.message || ''))) {
          const x = new Error('A aprovação em uma operação só ainda não foi instalada no servidor: rode o arquivo 47_auditoria_bd.sql no Supabase.'); x.semFuncao = true; x.original = error; throw x;
        }
        throw erro(error);
      }
      return data;
    },
    async contarExemplo() {
      const { count, error } = await sb.from('exemplo').select('id', { count: 'exact', head: true });
      if (error) throw erro(error); return count || 0;
    },
    /* ---------- Ajuda de custo por visita ---------- */
    async lerParametros(chave) {
      const { data, error } = await sb.from('parametros').select('valor, atualizado_em').eq('chave', chave).maybeSingle();
      if (error) throw erro(error); return data ? data.valor : null;
    },
    async salvarParametros(chave, valor) {
      const { data, error } = await sb.from('parametros').upsert({ chave, valor }, { onConflict: 'chave' }).select('valor').single();
      if (error) throw erro(error); return data.valor;
    },
    async listarCustos() {
      const { data, error } = await todas(() => sb.from('custos_visita').select('visita_id, km_ida, obs, definido_em', CT).order('visita_id'));
      if (error) throw erro(error); return data;
    },
    async salvarKm(visita_id, km_ida) {
      if (km_ida == null) { const { error } = await sb.from('custos_visita').delete().eq('visita_id', visita_id); if (error) throw erro(error); return null; }
      const { data, error } = await sb.from('custos_visita').upsert({ visita_id, km_ida }, { onConflict: 'visita_id' }).select().single();
      if (error) throw erro(error); return data;
    },

    /* ---------- Vitrine pública (só totais e fotos aprovadas; funciona sem login) ---------- */
    /* 56: a pasta da vitrine é privada; cada foto abre por um link assinado de 1 hora, que o servidor só dá enquanto a
       autorização de imagem da mulher continuar valendo. Antes do 56 instalado (pasta ainda pública), usa o endereço público. */
    async urlsVitrine(fotos) {
      const l = (fotos || []).filter(f => f && f.path); if (!l.length) return;
      try {
        const { data, error } = await sb.storage.from('vitrine').createSignedUrls(l.map(f => f.path), 3600);
        if (!error && Array.isArray(data)) {
          data.forEach((u, i) => { if (u && u.signedUrl && !u.error) l[i].url = u.signedUrl; });
          l.forEach(f => { if (!f.url) f.semLink = true; });
          if (l.some(f => f.url)) { l.forEach(f => { f.url = f.url || ''; }); return; }
        }
      } catch (e) { /* sem resposta: tenta o endereço público abaixo */ }
      // antes do script 56 a pasta ainda é pública; sem link nenhum, a foto fica de fora (a página não quebra)
      l.forEach(f => { try { f.url = sb.storage.from('vitrine').getPublicUrl(f.path).data.publicUrl || ''; } catch (e) { f.url = ''; } });
    },
    async vitrine() {
      if (!sb) sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, opcoesCliente());
      const { data, error } = await sb.rpc('vitrine');
      if (error) throw erro(error);
      if (!data) return { fotos: [] };   // resposta vazia do servidor: a página pública abre sem fotos, não quebra
      await this.urlsVitrine(data.fotos); data.fotos = (data.fotos || []).filter(f => f.url);
      try { const r = await sb.rpc('vitrine_municipios'); if (!r.error) data.municipios = r.data; } catch (e) {}   // 40: sem o script, o mapa mostra só os municípios previstos
      return data;
    },
    async listarVitrine() {
      const { data, error } = await todas(() => sb.from('vitrine_fotos').select('*', CT).order('publicada_em', { ascending: false }).order('id'));
      if (error) throw erro(error);
      await this.urlsVitrine(data);
      return data;
    },
    /* Copia uma foto de campo (privada) para o bucket público, com nome aleatório, e registra.
       O banco confere a autorização de imagem, crianças e nome na legenda. */
    async publicarFoto({ ficha_id, origem, legenda, sem_criancas }) {
      if (!/\/diag_/.test(origem)) throw erro('Só fotos do diagnóstico podem ir para a vitrine.');
      const { data: bruto, error: e1 } = await sb.storage.from('campo').download(origem);
      if (e1) throw erro(e1);
      const blob = await limparImagem(bruto);
      const path = MQ.novoId() + '.jpg';
      const { error: e2 } = await sb.storage.from('vitrine').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (e2) throw erro(e2);
      const { data, error } = await sb.from('vitrine_fotos').insert({ path, ficha_id, uf: 'XX', legenda, sem_criancas: !!sem_criancas }).select().single();
      if (error) { await sb.storage.from('vitrine').remove([path]); throw erro(error); }
      return data;
    },
    async retirarFoto(id, path) {
      const { error: e1 } = await sb.storage.from('vitrine').remove([path]);   // primeiro o arquivo público
      if (e1) throw erro(e1);
      const { error } = await sb.from('vitrine_fotos').delete().eq('id', id);
      if (error) throw erro(error);
    },
    /* Fotos cuja autorização foi retirada: o banco já tirou da vitrine; aqui apaga o arquivo público */
    async limparVitrinePendente() {
      const { data, error } = await todas(() => sb.from('vitrine_remover').select('path', CT).order('path'));
      if (error || !data || !data.length) return 0;
      const paths = data.map(x => x.path);
      const { error: e1 } = await sb.storage.from('vitrine').remove(paths);
      if (e1) return 0;
      await sb.from('vitrine_remover').delete().in('path', paths);
      return paths.length;
    },

    async sair() {
      linksFoto.clear();   // links de foto da equipe não ficam para a próxima pessoa
      euCache = null; this.temSessao = false;
      // tira do aparelho a cópia dos dados (nomes, CPF, endereços); o que não foi enviado continua na fila para a próxima entrada
      try { Object.keys(localStorage).filter(k => k === 'mq-eu' || k.startsWith('mq-cache-')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      try { await sb.auth.signOut(); } catch (e) { /* sem internet */ }
      // sem internet o signOut pode falhar antes de apagar a sessão: apaga a chave de login do aparelho de qualquer jeito
      try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    },

    async listarEquipe() {
      const { data, error } = await todas(() => sb.from('equipe').select('*', CT).order('criado_em').order('id'));
      if (error) throw erro(error);
      // 43_lgpd_equipe.sql: a bolsista vê as colegas do estado só com os dados de trabalho (sem CPF, e-mail, SIAPE)
      try { const r = await sb.rpc('equipe_do_estado'); if (!r.error && Array.isArray(r.data)) { const ja = new Set(data.map(m => m.id)); r.data.forEach(m => { if (!ja.has(m.id)) data.push(m); }); } } catch (e) { /* 43 ainda não instalado */ }
      // fotos: links temporários (1 h) de uma vez só; se a etapa 7 não foi instalada, segue com as iniciais
      data.forEach(m => { const x = /^exemplo:(\d+)$/.exec(m.foto_path || ''); if (x) m.foto_url = 'assets/exemplo/pessoa-' + x[1] + '.svg'; });   // ilustrações dos dados de exemplo
      await linksDasFotos(data);
      return data;
    },
    async enviarFotoEquipe(id, blob) {
      const path = id + '/foto_' + Date.now() + '.jpg';
      const { error: e1 } = await sb.storage.from('equipe').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (e1) throw erro(/bucket|not found/i.test(e1.message) ? 'A foto da equipe ainda não foi instalada no servidor: rode o arquivo 07_fotos_equipe.sql no Supabase.' : e1);
      const souEu = euCache && euCache.id === id;
      if (souEu) {
        const { error } = await sb.rpc('definir_minha_foto', { p_path: path }); if (error) throw erro(error);
      } else {
        const { data, error } = await sb.from('equipe').update({ foto_path: path }).eq('id', id).select('id'); if (error) throw erro(error);
        if (!data || !data.length) throw erro('Você não pode trocar a foto desta pessoa.');
      }
      return path;
    },
    /* ---------- Solicitação de pagamento (12_pagamentos.sql) ---------- */
    async listarSolicitacoes() {
      const { data, error } = await todas(() => sb.from('solicitacoes_pagamento').select('*', CT).order('solicitada_em', { ascending: false }).order('id')); if (error) throw erro(error);
      const { data: vs, error: e2 } = await todas(() => sb.from('solicitacao_visitas').select('*', CT).order('visita_id')); if (e2) throw erro(e2);
      return { lista: data, vinculos: Object.fromEntries((vs || []).map(x => [x.visita_id, x.solicitacao_id])) };
    },
    async solicitarPagamento(tipo, mes, valor, relatorio, visitas, detalhe) {
      const { data, error } = await sb.rpc('solicitar_pagamento', { p_tipo: tipo, p_mes: mes, p_valor: valor, p_relatorio: relatorio || null, p_visitas: visitas && visitas.length ? visitas : null, p_detalhe: detalhe || {} });
      if (error) throw erro(error); return data;
    },
    async avalizarPagamento(id, ok, obs, valor) { const { error } = await sb.rpc('avalizar_pagamento', { p_id: id, p_ok: ok, p_obs: obs || null, p_valor: valor }); if (error) throw erro(error); },
    async registrarNoArlo(id, protocolo) { const { error } = await sb.rpc('registrar_no_arlo', { p_id: id, p_protocolo: protocolo || null }); if (error) throw erro(error); },
    /* 69: cancelar o pedido (a própria pessoa sem aval; a coordenação com motivo) */
    async cancelarPagamento(id, motivo) {
      const { error } = await sb.rpc('cancelar_pagamento', { p_id: id, p_motivo: motivo || null });
      if (error) throw erro(/cancelar_pagamento|PGRST202/.test(error.message) ? 'O cancelamento de pedidos ainda não foi instalado: a coordenação geral roda o arquivo 69_cancelamentos.sql no Supabase.' : error);
    },

    /* ---------- Documentos do projeto (24_documentos.sql): só a coordenação geral ---------- */
    /* execução (37): planilha de gastos do mês; só a coordenação geral; sem update nem delete */
    /* acesso à água (39): coordenação lê e registra; sem update nem delete */
    async listarCanaisVenda() { const { data, error } = await todas(() => sb.from('canais_venda').select('*', CT).order('uf').order('municipio').order('id')); if (error) throw erro(error); return data; },
    async salvarCanalVenda(x) { const { data, error } = await sb.rpc('salvar_canal_venda', { p_id: x.id || null, p_uf: x.uf, p_municipio: x.municipio, p_tipo: x.tipo, p_nome: x.nome, p_detalhe: x.detalhe || null, p_contato: x.contato || null, p_ativo: x.ativo !== false }); if (error) throw erro(error); return data; },
    async listarOrientacoesVenda() { const { data, error } = await todas(() => sb.from('orientacoes_venda').select('*', CT).order('feito_em', { ascending: false }).order('id')); if (error) throw erro(error); return data; },
    async registrarOrientacaoVenda(ficha_id, dados) { const { data, error } = await sb.rpc('registrar_orientacao_venda', { p_ficha: ficha_id, p_dados: dados }); if (error) throw erro(error); return data; },
    /* perfis de acompanhamento, MDA e MPA (52_acompanhamento.sql): só contagens */
    async dadosAcompanhamento(orgao) {
      const { data, error } = await sb.rpc('acompanhamento_dados', { p_orgao: orgao || null }); if (error) throw erro(error);
      // 60: na tela do MPA, equipe habilitada e diagnósticos esperando, por estado (sem o script, a tela segue sem esses números)
      if (data) {   // 61: formação sem matrículas e encontros cancelados (65: os dois órgãos)
        try { const f = await sb.rpc('acompanhamento_formacao', { p_orgao: orgao || null }); if (!f.error && f.data) data.formacao = f.data; } catch (e) {}
      }
      if (data && Array.isArray(data.por_uf)) {
        try { const r = await sb.rpc('acompanhamento_equipe_uf', { p_orgao: orgao || null });
          if (!r.error && Array.isArray(r.data)) r.data.forEach(x => { const u = data.por_uf.find(y => y.uf === x.uf); if (u) Object.assign(u, { equipe_campo: x.equipe_campo, habilitadas: x.habilitadas, diag_aguardando: x.diag_aguardando, diag_devolvidos: x.diag_devolvidos }); });
        } catch (e) {}
      }
      // 65: atividades (eventos, intercâmbio, missões), canais de venda, água, curso FIC, documentos e, para o MDA, o resumo financeiro
      if (data) { try { const x = await sb.rpc('acompanhamento_extra', { p_orgao: orgao || null }); if (!x.error && x.data) data.extra = x.data; else data.extraSemBanco = true; } catch (e) { data.extraSemBanco = true; } }
      return data;
    },
    // 60: planilha das fichas ou cópia dos dados baixada → Histórico
    async registrarPlanilha(tipo, qtd, filtro) { const { error } = await sb.rpc('registrar_planilha', { p_tipo: tipo, p_qtd: qtd, p_filtro: filtro || null }); if (error) throw erro(error); },
    async relatarProblema(x) { const { data, error } = await sb.rpc('relatar_problema', { p_texto: x.texto, p_tela: x.tela || null, p_versao: x.versao || null, p_aparelho: x.aparelho || null }); if (error) throw erro(error); return data; },
    async listarRelatos() { const { data, error } = await sb.rpc('listar_relatos'); if (error) throw erro(error); return data || []; },
    /* 58: só a contagem do que este celular guarda sem enviar (nunca atrapalha: sem o script, só não informa) */
    async informarFila(r) {
      if (!sb || !r || !(r.qtd >= 0)) return;
      try { await sb.rpc('informar_fila', { p_qtd: r.qtd, p_recusados: r.recusados || 0, p_mais_antigo: r.mais_antigo || null }); } catch (e) { /* nada */ }
    },
    async listarFilaCelular() { const { data, error } = await sb.rpc('listar_fila_celular'); if (error) throw erro(error); return data || []; },
    async resolverRelato(id, nota, reabrir) { const { error } = await sb.rpc('resolver_relato', { p_id: id, p_nota: nota || null, p_reabrir: !!reabrir }); if (error) throw erro(error); },
    async listarObservadores() { const { data, error } = await sb.rpc('listar_observadores'); if (error) throw erro(error); return data || []; },
    async salvarObservador(x) { const { data, error } = await sb.rpc('salvar_observador', { p_id: x.id || null, p_nome: x.nome, p_email: x.email, p_orgao: x.orgao, p_cargo: x.cargo || null, p_ativo: x.ativo !== false }); if (error) throw erro(error); return data; },
    async gerarCodigoObservador(id) { const { data, error } = await sb.rpc('gerar_codigo_observador', { p_id: id }); if (error) throw erro(error); return data; },
    /* itens do kit com preço de referência (51_kit_itens.sql) */
    /* preços do kit: só a coordenação geral lê a tabela; os outros perfis recebem só nome e unidade (função kit_itens_nomes do 51) */
    async listarKitItens() {
      if (euCache && euCache.papel !== 'coord_geral') {
        const r = await sb.rpc('kit_itens_nomes');
        if (!r.error) return (r.data || []).map(k => ({ id: k.id, item: k.item, unidade: k.unidade, ativo: k.ativo }));
        if (!/PGRST202|42883|Could not find the function|does not exist/i.test(String(r.error.code) + ' ' + String(r.error.message))) throw erro(r.error);
      }   // banco ainda com o 51 antigo: lê a tabela e tira o preço antes de entregar à tela
      const { data, error } = await todas(() => sb.from('kit_itens').select('*', CT).order('item').order('id')); if (error) throw erro(error);
      return euCache && euCache.papel !== 'coord_geral' ? data.map(k => ({ id: k.id, item: k.item, unidade: k.unidade, ativo: k.ativo })) : data;
    },
    async salvarKitItem(x) { const { data, error } = await sb.rpc('salvar_kit_item', { p_id: x.id || null, p_item: x.item, p_unidade: x.unidade, p_valor: x.valor_ref, p_fonte: x.fonte || null, p_preliminar: !!x.preliminar, p_ativo: x.ativo !== false }); if (error) throw erro(error); return data; },
    async listarAgua() { const { data, error } = await todas(() => sb.from('agua_situacoes').select('*', CT).order('registrado_em', { ascending: true }).order('id')); if (error) throw erro(error); return data; },
    async registrarSituacaoAgua(ficha_id, situacao, obs) { const { data, error } = await sb.rpc('registrar_situacao_agua', { p_ficha: ficha_id, p_situacao: situacao, p_obs: obs }); if (error) throw erro(error); return data; },
    async listarPlanilhasExec() {
      const { data, error } = await todas(() => sb.from('execucao_planilhas').select('*', CT).order('posicao_em', { ascending: false }).order('enviado_em', { ascending: false }).order('id')); if (error) throw erro(error); return data;
    },
    async enviarPlanilhaExec(d, arquivo) {
      const limpo = String(arquivo.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
      const path = String(d.posicao_em).slice(0, 4) + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '_' + limpo;
      const { error: e1 } = await sb.storage.from('execucao').upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined });
      if (e1) throw erro(e1);
      const { data, error } = await sb.from('execucao_planilhas').insert({ posicao_em: d.posicao_em, arquivo_path: path, arquivo_nome: d.arquivo_nome, linhas: d.linhas,
        total_gasto: d.total_gasto, total_recebido: d.total_recebido, nao_classificadas: d.nao_classificadas, obs: d.obs }).select().single();
      if (error) throw erro(error); return data;
    },
    /* 72: descartar planilha enviada por engano (o registro fica; o arquivo sai da pasta privada) */
    async descartarPlanilhaExec(id, motivo) {
      const { data: pl } = await sb.from('execucao_planilhas').select('arquivo_path').eq('id', id).maybeSingle();
      const { error } = await sb.rpc('descartar_planilha_exec', { p_id: id, p_motivo: motivo });
      if (error) throw erro(/descartar_planilha_exec|PGRST202/.test(error.message) ? 'O descarte de planilha ainda não foi instalado: a coordenação geral roda o arquivo 72_descartar_planilha.sql no Supabase.' : error);
      let arquivoFicou = false;
      if (pl && pl.arquivo_path) { const r = await sb.storage.from('execucao').remove([pl.arquivo_path]).catch(e => ({ error: e })); arquivoFicou = !!(r && r.error); }
      return { arquivoFicou };
    },
    async linkPlanilhaExec(path) { const { data, error } = await sb.storage.from('execucao').createSignedUrl(path, 600); if (error) throw erro(error); return data.signedUrl; },
    async listarDocumentos() {
      const { data, error } = await todas(() => sb.from('documentos_projeto').select('*', CT).order('data_documento', { ascending: false }).order('id')); if (error) throw erro(error); return data;
    },
    async enviarDocumento(d, arquivo) {
      const limpo = String(arquivo.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
      const path = String(d.data_documento).slice(0, 4) + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '_' + limpo;
      const { error: e1 } = await sb.storage.from('documentos').upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined });
      if (e1) throw erro(/Bucket not found|not found/i.test(e1.message) ? 'A pasta de documentos ainda não foi criada: rode o arquivo 24_documentos.sql no Supabase.' : e1);
      const { data, error } = await sb.from('documentos_projeto').insert({ tipo: d.tipo, titulo: d.titulo, data_documento: d.data_documento, uf: d.uf || null,
        descricao: d.descricao || null, arquivo_path: path, arquivo_nome: arquivo.name, tamanho: arquivo.size, mime: arquivo.type || null }).select();
      if (error) throw erro(error);   // o arquivo fica na pasta sem registro: não apagamos (a pasta não permite apagar)
      if (data && data.length) return data[0];
      // 47: envio repetido (rede caiu e a tela mandou de novo em menos de 2 minutos): o banco não grava a cópia; devolve o que já estava anexado
      const { data: ja, error: e2 } = await sb.from('documentos_projeto').select('*').eq('tipo', d.tipo).eq('titulo', d.titulo).eq('data_documento', d.data_documento)
        .is('arquivado_em', null).order('enviado_em', { ascending: false }).limit(1);
      if (e2) throw erro(e2);
      if (ja && ja.length) return ja[0];
      throw erro('O documento não foi gravado. Tente de novo.');
    },
    async linkDocumento(path) {
      const { data, error } = await sb.storage.from('documentos').createSignedUrl(path, 300); if (error) throw erro(error); return data.signedUrl;
    },
    async arquivarDocumento(id, motivo) {
      const { error } = await sb.from('documentos_projeto').update({ arquivado_em: new Date().toISOString(), motivo_arquivo: motivo }).eq('id', id); if (error) throw erro(error);
    },

    /* ---------- Pedidos de passagem aérea e de estrutura de evento (22_passagens_eventos.sql) ---------- */
    async quemConferePedidos() {
      const { data, error } = await sb.rpc('quem_confere_pedidos');
      if (error) { if (/quem_confere_pedidos|PGRST202/.test(error.message)) return null; throw erro(error); }   // sem o 26: regra antiga
      return data;
    },
    async listarPedidos() {
      const { data, error } = await todas(() => sb.from('pedidos_apoio').select('*', CT).order('enviado_em', { ascending: false }).order('id')); if (error) throw erro(error); return data;
    },
    async salvarPedido(id, tipo, titulo, data, dados, justificativa) {
      const { data: r, error } = await sb.rpc('salvar_pedido_apoio', { p_id: id || null, p_tipo: tipo, p_titulo: titulo, p_data: data, p_dados: dados, p_justificativa: justificativa || null });
      if (error) throw erro(/salvar_pedido_apoio|PGRST202/.test(error.message) ? 'Os pedidos de passagem e evento ainda não foram instalados: a coordenação geral roda o arquivo 22_passagens_eventos.sql no Supabase.' : error);
      return r;
    },
    /* tetos: R$ 6.000 por estado para eventos, R$ 70.000 para passagens (35_tetos_passagens_eventos.sql) */
    async definirValorPedido(id, valor) {
      const { error } = await sb.rpc('definir_valor_pedido', { p_id: id, p_valor: valor });
      if (error) { if (/definir_valor_pedido|PGRST202/.test(error.message)) return; throw erro(error); }   // sem o 35: segue sem valor
    },
    async saldoPedidos() {
      const { data, error } = await sb.rpc('saldo_passagens_eventos'); if (error) throw erro(error); return data;
    },
    async moverPedido(id, acao, obs, protocolo) {
      const { error } = await sb.rpc('mover_pedido_apoio', { p_id: id, p_acao: acao, p_obs: obs || null, p_protocolo: protocolo || null }); if (error) throw erro(error);
    },
    /* 69: pedido já autorizado: só a coordenação geral cancela ou ajusta o valor, com motivo */
    async cancelarPedidoAutorizado(id, motivo) {
      const { error } = await sb.rpc('cancelar_pedido_autorizado', { p_id: id, p_motivo: motivo || null });
      if (error) throw erro(/cancelar_pedido_autorizado|PGRST202/.test(error.message) ? 'O cancelamento de pedido autorizado ainda não foi instalado: rode o arquivo 69_cancelamentos.sql no Supabase.' : error);
    },
    async ajustarValorPedido(id, valor, motivo) {
      const { error } = await sb.rpc('ajustar_valor_pedido', { p_id: id, p_valor: valor, p_motivo: motivo || null });
      if (error) throw erro(/ajustar_valor_pedido|PGRST202/.test(error.message) ? 'O ajuste de valor de pedido autorizado ainda não foi instalado: rode o arquivo 69_cancelamentos.sql no Supabase.' : error);
    },

    /* ---------- Curso FIC: turmas e matrículas (11_fic.sql) ---------- */
    async listarEquipeFic() {
      const { data: lido, error } = await sb.rpc('equipe_para_fic'); if (error) throw erro(error);
      const data = lido || [];
      data.forEach(m => { const x = /^exemplo:(\d+)$/.exec(m.foto_path || ''); if (x) m.foto_url = 'assets/exemplo/pessoa-' + x[1] + '.svg'; });
      await linksDasFotos(data);
      return data;
    },
    /* encontros do FIC e lista de presença (38) */
    async listarEncontrosFic() {
      const { data, error } = await todas(() => sb.from('fic_encontros').select('*, presencas:fic_presencas(*)', CT).order('data', { ascending: false }).order('id')); if (error) throw erro(error); return data;
    },
    async salvarEncontroFic(x) {
      const { data, error } = await sb.rpc('registrar_encontro_fic', { p_id: x.id || null, p_turma: x.turma_id, p_data: x.data, p_carga: +x.carga_horaria, p_modalidade: x.modalidade,
        p_conteudo: x.conteudo, p_presentes: x.presentes || [] });
      if (error) throw erro(error); return data;
    },
    async cancelarEncontroFic(id, motivo) { const { error } = await sb.rpc('cancelar_encontro_fic', { p_id: id, p_motivo: motivo }); if (error) throw erro(error); },
    async confirmarPresencaFic(encontro_id) { const { error } = await sb.rpc('confirmar_presenca_fic', { p_encontro: encontro_id }); if (error) throw erro(error); },
    async listarTurmas() { const { data, error } = await todas(() => sb.from('turmas_fic').select('*', CT).order('criado_em').order('id')); if (error) throw erro(error); return data; },
    async listarMatriculas() { const { data, error } = await todas(() => sb.from('matriculas_fic').select('*', CT).is('cancelada_em', null).order('criado_em').order('id')); if (error) throw erro(error); return data; },
    async salvarTurma(t) {
      const reg = { id: t.id || crypto.randomUUID(), nome: t.nome, uf: t.uf || null, municipio: t.municipio || null, inicio: t.inicio || null, fim: t.fim || null, professor_id: t.professor_id, obs: t.obs || null };
      return gravar('turmas_fic', reg);
    },
    async matricular(turma_id, equipe_id, numero, data) {
      const { data: id, error } = await sb.rpc('matricular_fic', { p_turma: turma_id, p_equipe: equipe_id, p_numero: numero, p_data: data }); if (error) throw erro(error); return id;
    },
    async cancelarMatricula(id, motivo) { const { error } = await sb.rpc('cancelar_matricula_fic', { p_id: id, p_motivo: motivo }); if (error) throw erro(error); },

    async auditoria(antesDe, antesId) {   // 200 por vez; "antesDe" busca os mais antigos que isso (13/10/2026: antes só os 200 últimos)
      // 14/10/2026 (auditoria BD-1): várias linhas da mesma transação têm o mesmo "em"; a página seguinte vai por (em, id), senão o empate da borda sumia
      let q = sb.from('auditoria').select('*').order('em', { ascending: false }).order('id', { ascending: false }).limit(200);
      if (antesDe && antesId != null) q = q.or(`em.lt."${antesDe}",and(em.eq."${antesDe}",id.lt.${antesId})`);
      else if (antesDe) q = q.lt('em', antesDe);
      const { data, error } = await q;
      if (error) throw erro(error);
      return data;
    },
    /* 74 (23/10/2026): Histórico, "Restaurar como estava antes". Devolve {ok} ou {conflito: true} (mudou de novo depois daquela versão) */
    async restaurarVersao(audId, forcar) {
      const { data, error } = await sb.rpc('restaurar_versao', { p_aud: +audId, p_forcar: !!forcar });
      if (error) {
        if (error.code === 'PGRST202' || /Could not find the function|restaurar_versao.*(does not exist|schema cache)/i.test(String(error.message || ''))) {
          const x = new Error('Restaurar pelo histórico ainda não foi instalado no servidor: rode o arquivo 74_restaurar_versao.sql no Supabase.'); x.semFuncao = true; x.original = error; throw x;
        }
        throw erro(error);
      }
      return data;
    },
    async criar(m) {
      const r = limpar(Object.assign({}, m, { cpf: R.soDigitos(m.cpf), email: m.email.trim().toLowerCase() }));
      delete r.status;
      const { data, error } = await sb.from('equipe').insert(r).select().single();
      if (error) throw erro(error);
      return data;
    },
    async atualizar(id, patch) {
      const { data, error } = await sb.from('equipe').update(limpar(patch)).eq('id', id).select().single();
      if (error) throw erro(error);
      return data;
    },
    async desligar(id, data_fim, motivo, semPedido) {
      // 57: com pagamento a pedir, só a coordenação geral desliga, justificando (desligar_sem_pedido grava no histórico)
      if (semPedido != null) { const { error } = await sb.rpc('desligar_sem_pedido', { p_equipe: id, p_data: data_fim, p_motivo: motivo, p_justificativa: semPedido }); if (error) throw erro(error); return; }
      return this.atualizar(id, { status: 'desligada', data_fim, motivo_desligamento: motivo });
    },
    /* 61: quem confere registra a data só do arquivo que abriu (se a pessoa trocou o termo enquanto isso, o banco recusa).
       Sem o script 61, grava a data como antes. */
    async conferirTermo(id, pathVisto, data) {
      const { error } = await sb.rpc('conferir_termo', { p_equipe: id, p_path: pathVisto, p_data: data });
      if (!error) return;
      if (/conferir_termo/.test(error.message || '') && /not find|does not exist|schema cache/i.test(error.message || '')) return void (await this.atualizar(id, { termo_assinado_em: data }));
      throw erro(error);
    },
    async enviarTermo(id, arquivo) {
      const ext = (arquivo.name.split('.').pop() || 'pdf').toLowerCase();
      const path = 'equipe/' + id + '/termo_' + Date.now() + '.' + ext;
      const { error } = await sb.storage.from('termos').upload(path, arquivo, { upsert: false });
      if (error) throw erro(error);
      return path;
    },
    /* 48: a própria pessoa anexa o termo (pasta com o id dela) e o banco grava só o arquivo; a data é de quem confere */
    async enviarMeuTermo(id, arquivo) {
      const ext = (arquivo.name.split('.').pop() || 'pdf').toLowerCase();
      const path = 'equipe/' + id + '/termo_' + Date.now() + '.' + ext;
      const { error: e1 } = await sb.storage.from('termos').upload(path, arquivo, { upsert: false });
      if (e1) throw erro(/row-level security|policy|permission|not authorized|unauthorized/i.test(e1.message || '') ? 'O envio do termo pela própria pessoa ainda não foi instalado no servidor: rode o arquivo 48_termo_pela_pessoa.sql no Supabase.' : e1);
      const { error } = await sb.rpc('enviar_meu_termo', { p_path: path });
      if (error) throw erro(/enviar_meu_termo/.test(error.message || '') && /not find|does not exist|schema cache/i.test(error.message || '') ? 'O envio do termo pela própria pessoa ainda não foi instalado no servidor: rode o arquivo 48_termo_pela_pessoa.sql no Supabase.' : error);
      return path;
    },
    async linkTermo(path) {
      const { data, error } = await sb.storage.from('termos').createSignedUrl(path, 300);
      if (error) throw erro(error);
      return data.signedUrl;
    }
  };
})();
