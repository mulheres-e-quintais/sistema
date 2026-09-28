/* Modo produção: Supabase (login por link no e-mail, dados no banco com RLS). */
(function () {
  const R = MQ.regras;
  let sb = null;
  let euCache = null;

  const erro = e => { const x = new Error(R.mensagemErro(e)); x.original = e; return x; };
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
      const { data } = await sb.auth.getSession();
      this.temSessao = !!data.session;
      if (!data.session) return null;
      return this.eu(true);
    },
    async eu(forcar) {
      if (euCache && !forcar) return euCache;
      const { data, error } = await sb.rpc('vincular_conta');
      if (error) throw erro(error);
      euCache = data && data.id ? data : null;
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
    async sair() { euCache = null; this.temSessao = false; await sb.auth.signOut(); },

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
