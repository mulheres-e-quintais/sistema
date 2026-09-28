/* Modo produção: Supabase (login por link no e-mail, dados no banco com RLS). */
(function () {
  const R = MQ.regras;
  let sb = null;
  let euCache = null;

  const erro = e => {
    const x = new Error(R.mensagemErro(e)); x.original = e;
    x.semRede = !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network/i.test(String((e && e.message) || e));
    return x;
  };
  const lerEuGuardado = () => { try { return JSON.parse(localStorage.getItem('mq-eu') || 'null'); } catch (e) { return null; } };
  const CAMPOS = ['papel', 'uf', 'nome', 'cpf', 'email', 'telefone', 'municipio', 'organizacao', 'data_inicio',
    'meta_diagnosticos', 'meta_quintais', 'meta_visitas', 'matricula_fic_em', 'matricula_fic_numero', 'docs_funcern_em',
    'termo_path', 'termo_assinado_em', 'obs_habilitacao', 'consentimento_lgpd', 'substitui_id', 'status', 'data_fim', 'motivo_desligamento'];
  const limpar = o => { const r = {}; CAMPOS.forEach(k => { if (k in o) r[k] = o[k] === '' ? null : o[k]; }); return r; };

  MQ.apiSupabase = {
    modo: 'supabase',
    async iniciar() {
      sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, detectSessionInUrl: true }
      });
      let sessao = null;
      try { sessao = (await sb.auth.getSession()).data.session; } catch (e) { /* sem rede */ }
      const guardado = lerEuGuardado();
      if (!sessao) {
        // Sem internet, a sessão pode não ser renovada: usa o perfil guardado para trabalhar offline
        if (!navigator.onLine && guardado) { this.temSessao = true; this.offline = true; euCache = guardado; return guardado; }
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
    async criarSenha(email, senha) {
      const { data, error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha });
      if (error) {
        const msg = String(error.message || '');
        if (/não cadastrado|Database error/i.test(msg)) throw erro('Este e-mail não está cadastrado no projeto. Fale com a coordenação.');
        if (/already registered|already exists/i.test(msg)) throw erro('Este e-mail já tem senha. Use "Entrar". Se esqueceu a senha, peça à coordenação geral para liberar um novo primeiro acesso.');
        if (/password/i.test(msg)) throw erro('Senha fraca: use pelo menos 8 caracteres, misturando letras e números.');
        if (error.status === 429) throw erro('Muitas tentativas seguidas. Espere 1 minuto e tente de novo.');
        throw erro(error);
      }
      if (!data.session) throw erro('Senha criada, mas o servidor ainda exige confirmação por e-mail. Avise a coordenação geral.');
      this.temSessao = true;
      return this.eu(true);
    },
    /* ---------- Fichas de indicação ---------- */
    async listarFichas() {
      const { data, error } = await sb.from('fichas').select('*').order('criado_em', { ascending: false });
      if (error) throw erro(error);
      return data;
    },
    async salvarFicha(dados, fotos) {
      const f = Object.assign({}, dados);
      for (const [campo, blob] of Object.entries(fotos || {})) {
        if (!blob) continue;
        const ext = /pdf/.test(blob.type) ? 'pdf' : 'jpg';
        const path = f.uf + '/' + f.id + '/' + campo + '.' + ext;
        const { error } = await sb.storage.from('fichas').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (error) throw erro(error);
        f['foto_' + campo + '_path'] = path;
      }
      ['tem_foto_ficha', 'tem_foto_termo', 'pontos', 'situacao', 'aprovada_por', 'aprovada_em', 'obs_coordenacao', 'bolsista_id', 'criado_em', 'atualizado_em']
        .forEach(k => delete f[k]);
      const { data, error } = await sb.from('fichas').upsert(f, { onConflict: 'id' }).select().single();
      if (error) throw erro(error);
      return data;
    },
    async decidirFicha(id, situacao, obs) {
      const { data, error } = await sb.from('fichas').update({ situacao, obs_coordenacao: obs || null }).eq('id', id).select().single();
      if (error) throw erro(error);
      return data;
    },
    /* ---------- Visitas e diagnósticos ---------- */
    async listarVisitas() {
      const { data, error } = await sb.from('visitas').select('*').order('data_prevista');
      if (error) throw erro(error); return data;
    },
    async salvarVisita(v) {
      const r = Object.assign({}, v); ['criado_por', 'criado_em', 'atualizado_em'].forEach(k => delete r[k]);
      const { data, error } = await sb.from('visitas').upsert(r, { onConflict: 'id' }).select().single();
      if (error) throw erro(error); return data;
    },
    async listarDiagnosticos() {
      const { data, error } = await sb.from('diagnosticos').select('*').order('data_visita', { ascending: false });
      if (error) throw erro(error); return data;
    },
    async salvarDiagnostico(dados, fotos) {
      const d = Object.assign({}, dados);
      const caminhos = new Set(d.fotos || []);
      for (const [campo, blob] of Object.entries(fotos || {})) {
        if (!blob) continue;
        const path = d.uf + '/' + d.ficha_id + '/diag_' + campo + '.jpg';
        const { error } = await sb.storage.from('campo').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (error) throw erro(error);
        caminhos.add(path);
      }
      d.fotos = [...caminhos];
      ['situacao', 'aprovado_por', 'aprovado_em', 'obs_coordenacao', 'executor_id', 'criado_em', 'atualizado_em'].forEach(k => delete d[k]);
      const { data, error } = await sb.from('diagnosticos').upsert(d, { onConflict: 'id' }).select().single();
      if (error) throw erro(error); return data;
    },
    async decidirDiagnostico(id, situacao, obs) {
      const { data, error } = await sb.from('diagnosticos').update({ situacao, obs_coordenacao: obs || null }).eq('id', id).select().single();
      if (error) throw erro(error); return data;
    },
    async linkFoto(path) {
      const balde = /\/diag_/.test(path) ? 'campo' : 'fichas';
      const { data, error } = await sb.storage.from(balde).createSignedUrl(path, 600);
      if (error) throw erro(error);
      return data.signedUrl;
    },

    async sair() { euCache = null; this.temSessao = false; try { localStorage.removeItem('mq-eu'); } catch (e) {} await sb.auth.signOut(); },

    async listarEquipe() {
      const { data, error } = await sb.from('equipe').select('*').order('criado_em');
      if (error) throw erro(error);
      return data;
    },
    async auditoria() {
      const { data, error } = await sb.from('auditoria').select('*').order('em', { ascending: false }).limit(200);
      if (error) throw erro(error);
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
    async desligar(id, data_fim, motivo) {
      return this.atualizar(id, { status: 'desligada', data_fim, motivo_desligamento: motivo });
    },
    async enviarTermo(id, arquivo) {
      const ext = (arquivo.name.split('.').pop() || 'pdf').toLowerCase();
      const path = 'equipe/' + id + '/termo_' + Date.now() + '.' + ext;
      const { error } = await sb.storage.from('termos').upload(path, arquivo, { upsert: false });
      if (error) throw erro(error);
      return path;
    },
    async linkTermo(path) {
      const { data, error } = await sb.storage.from('termos').createSignedUrl(path, 300);
      if (error) throw erro(error);
      return data.signedUrl;
    }
  };
})();
