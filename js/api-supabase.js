/* Modo produção: Supabase (login com e-mail e senha, dados no banco com RLS). */
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
    'termo_path', 'termo_assinado_em', 'obs_habilitacao', 'foto_path', 'nome_social', 'cadastro_arlo', 'consentimento_lgpd', 'substitui_id', 'status', 'data_fim', 'motivo_desligamento'];
  const limpar = o => { const r = {}; CAMPOS.forEach(k => { if (k in o) r[k] = o[k] === '' ? null : o[k]; }); return r; };

  /* Grava com UPDATE quando o registro já existe e INSERT só quando é novo.
     (upsert dispara o gatilho de inclusão mesmo ao editar, e as travas de inclusão bloqueariam a edição) */
  async function gravar(tabela, reg) {
    const { data: up, error: e1 } = await sb.from(tabela).update(reg).eq('id', reg.id).select();
    if (e1) throw erro(e1);
    if (up && up.length) return up[0];
    const { data, error } = await sb.from(tabela).insert(reg).select().single();
    if (error) throw erro(error);
    return data;
  }
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
      return gravar('fichas', f);
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
    async salvarVisita(v, fotos) {
      const r = Object.assign({}, v); ['criado_por', 'criado_em', 'atualizado_em'].forEach(k => delete r[k]);
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
      return gravar('visitas', r);
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
      return gravar('diagnosticos', d);
    },
    async decidirDiagnostico(id, situacao, obs) {
      const { data, error } = await sb.from('diagnosticos').update({ situacao, obs_coordenacao: obs || null }).eq('id', id).select().single();
      if (error) throw erro(error); return data;
    },
    async linkFoto(path) {
      const balde = /\/(diag_|visita_)/.test(path) ? 'campo' : 'fichas';
      const { data, error } = await sb.storage.from(balde).createSignedUrl(path, 600);
      if (error) throw erro(error);
      return data.signedUrl;
    },

    /* ---------- Link de cadastro (a pessoa preenche, a coordenação valida) ---------- */
    async criarConvite(papel, uf, subst) {
      const { data, error } = await sb.rpc('criar_convite', { p_papel: papel, p_uf: uf || null, p_substitui: subst || null });
      if (error) throw erro(/criar_convite|PGRST202/.test(error.message) ? 'O link de cadastro ainda não foi instalado no servidor: rode o arquivo 08_convites.sql no Supabase.' : error);
      return data;
    },
    async verConvite(token) {
      if (!sb) sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, { auth: { persistSession: true } });
      const { data, error } = await sb.rpc('ver_convite', { p_token: token });
      if (error) throw erro(error); return data;
    },
    async enviarPreCadastro(token, dados) {
      const { error } = await sb.rpc('enviar_pre_cadastro', { p_token: token, p_dados: dados });
      if (error) throw erro(error);
    },
    async lerPrivado(id) {
      const { data, error } = await sb.from('equipe_privado').select('*').eq('equipe_id', id).maybeSingle();
      if (error) throw erro(error); return data;
    },
    async salvarPrivado(id, d) {
      const reg = { equipe_id: id, data_nascimento: d.data_nascimento || null, nis: d.nis || null, endereco: d.endereco || {}, socioeconomico: d.socioeconomico || null, atualizado_em: new Date().toISOString() };
      const { error } = await sb.from('equipe_privado').upsert(reg, { onConflict: 'equipe_id' });
      if (error) throw erro(/equipe_privado|PGRST205/.test(error.message) ? 'Os dados pessoais complementares ainda não foram instalados no servidor: rode o arquivo 08_convites.sql no Supabase.' : error);
    },
    /* ---------- Dados bancários (só por funções do banco; nunca entram no cache do aparelho) ---------- */
    async meusDadosBancarios() { const { data, error } = await sb.rpc('meus_dados_bancarios'); if (error) throw erro(error); return data; },
    async salvarMeusDadosBancarios(d) {
      const { error } = await sb.rpc('salvar_meus_dados_bancarios', { p: d });
      if (error) throw erro(/salvar_meus_dados_bancarios|PGRST202/.test(error.message) ? 'Os dados bancários ainda não foram instalados no servidor: a coordenação geral precisa rodar o arquivo 09_dados_bancarios.sql.' : error);
    },
    async verContaArlo(id) { const { data, error } = await sb.rpc('ver_conta_para_arlo', { p_equipe: id }); if (error) throw erro(error); return data; },
    async situacaoBancaria() { const { data, error } = await sb.rpc('situacao_bancaria'); if (error) throw erro(error); return data; },
    async exportarDadosBancarios() { const { data, error } = await sb.rpc('exportar_dados_bancarios'); if (error) throw erro(error); return data; },
    async listarAPL() {
      const { data, error } = await sb.from('apl_municipios').select('*'); if (error) throw erro(error); return data;
    },
    async salvarAPL(uf, municipio, apls, obs) {
      const { error } = await sb.from('apl_municipios').upsert({ uf, municipio, apls, obs }, { onConflict: 'uf,municipio' });
      if (error) throw erro(/apl_municipios|PGRST205/.test(error.message) ? 'O cadastro de APL ainda não foi instalado no servidor: rode o arquivo 10_apl.sql.' : error);
    },
    async listarPreCadastros() {
      const { data, error } = await sb.from('pre_cadastros').select('*').eq('situacao', 'aguardando').order('enviado_em');
      if (error) throw erro(error); return data;
    },
    async decidirPreCadastro(id, situacao, obs, equipe_id) {
      const { error } = await sb.from('pre_cadastros').update({ situacao, obs: obs || null, equipe_id: equipe_id || null }).eq('id', id);
      if (error) throw erro(error);
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
      const { data, error } = await sb.from('custos_visita').select('visita_id, km_ida, obs, definido_em');
      if (error) throw erro(error); return data;
    },
    async salvarKm(visita_id, km_ida) {
      if (km_ida == null) { const { error } = await sb.from('custos_visita').delete().eq('visita_id', visita_id); if (error) throw erro(error); return null; }
      const { data, error } = await sb.from('custos_visita').upsert({ visita_id, km_ida }, { onConflict: 'visita_id' }).select().single();
      if (error) throw erro(error); return data;
    },

    /* ---------- Vitrine pública (só totais e fotos aprovadas; funciona sem login) ---------- */
    async vitrine() {
      if (!sb) sb = window.supabase.createClient(MQ.CONFIG.supabaseUrl, MQ.CONFIG.supabaseAnonKey, { auth: { persistSession: true } });
      const { data, error } = await sb.rpc('vitrine');
      if (error) throw erro(error);
      (data.fotos || []).forEach(f => { f.url = sb.storage.from('vitrine').getPublicUrl(f.path).data.publicUrl; });
      return data;
    },
    async listarVitrine() {
      const { data, error } = await sb.from('vitrine_fotos').select('*').order('publicada_em', { ascending: false });
      if (error) throw erro(error);
      data.forEach(f => { f.url = sb.storage.from('vitrine').getPublicUrl(f.path).data.publicUrl; });
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
      const { data, error } = await sb.from('vitrine_remover').select('path');
      if (error || !data || !data.length) return 0;
      const paths = data.map(x => x.path);
      const { error: e1 } = await sb.storage.from('vitrine').remove(paths);
      if (e1) return 0;
      await sb.from('vitrine_remover').delete().in('path', paths);
      return paths.length;
    },

    async sair() {
      euCache = null; this.temSessao = false;
      // tira do aparelho a cópia dos dados (nomes, CPF, endereços); o que não foi enviado continua na fila para a próxima entrada
      try { Object.keys(localStorage).filter(k => k === 'mq-eu' || k.startsWith('mq-cache-')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      await sb.auth.signOut();
    },

    async listarEquipe() {
      const { data, error } = await sb.from('equipe').select('*').order('criado_em');
      if (error) throw erro(error);
      // fotos: links temporários (1 h) de uma vez só; se a etapa 7 não foi instalada, segue com as iniciais
      data.forEach(m => { const x = /^exemplo:(\d+)$/.exec(m.foto_path || ''); if (x) m.foto_url = 'assets/exemplo/pessoa-' + x[1] + '.svg'; });   // ilustrações dos dados de exemplo
      const com = data.filter(m => m.foto_path && !m.foto_url);
      if (com.length) {
        try {
          const { data: urls } = await sb.storage.from('equipe').createSignedUrls(com.map(m => m.foto_path), 3600);
          (urls || []).forEach((u, i) => { if (u && u.signedUrl) com[i].foto_url = u.signedUrl; });
        } catch (e) { /* sem foto */ }
      }
      return data;
    },
    async enviarFotoEquipe(id, blob) {
      const path = id + '/foto_' + Date.now() + '.jpg';
      const { error: e1 } = await sb.storage.from('equipe').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (e1) throw erro(/bucket|not found/i.test(e1.message) ? 'A foto da equipe ainda não foi instalada no servidor: rode o arquivo 07_fotos_equipe.sql no Supabase.' : e1);
      const souEu = euCache && euCache.id === id;
      if (souEu && !/^coord/.test(euCache.papel)) {
        const { error } = await sb.rpc('definir_minha_foto', { p_path: path }); if (error) throw erro(error);
      } else {
        const { error } = await sb.from('equipe').update({ foto_path: path }).eq('id', id); if (error) throw erro(error);
      }
      return path;
    },
    /* ---------- Solicitação de pagamento (12_pagamentos.sql) ---------- */
    async listarSolicitacoes() {
      const { data, error } = await sb.from('solicitacoes_pagamento').select('*').order('solicitada_em', { ascending: false }); if (error) throw erro(error);
      const { data: vs, error: e2 } = await sb.from('solicitacao_visitas').select('*'); if (e2) throw erro(e2);
      return { lista: data, vinculos: Object.fromEntries((vs || []).map(x => [x.visita_id, x.solicitacao_id])) };
    },
    async solicitarPagamento(tipo, mes, valor, relatorio, visitas, detalhe) {
      const { data, error } = await sb.rpc('solicitar_pagamento', { p_tipo: tipo, p_mes: mes, p_valor: valor, p_relatorio: relatorio || null, p_visitas: visitas && visitas.length ? visitas : null, p_detalhe: detalhe || {} });
      if (error) throw erro(error); return data;
    },
    async avalizarPagamento(id, ok, obs, valor) { const { error } = await sb.rpc('avalizar_pagamento', { p_id: id, p_ok: ok, p_obs: obs || null, p_valor: valor }); if (error) throw erro(error); },
    async registrarNoArlo(id, protocolo) { const { error } = await sb.rpc('registrar_no_arlo', { p_id: id, p_protocolo: protocolo || null }); if (error) throw erro(error); },

    /* ---------- Curso FIC: turmas e matrículas (11_fic.sql) ---------- */
    async listarEquipeFic() {
      const { data, error } = await sb.rpc('equipe_para_fic'); if (error) throw erro(error);
      data.forEach(m => { const x = /^exemplo:(\d+)$/.exec(m.foto_path || ''); if (x) m.foto_url = 'assets/exemplo/pessoa-' + x[1] + '.svg'; });
      const com = data.filter(m => m.foto_path && !m.foto_url);
      if (com.length) { try { const { data: urls } = await sb.storage.from('equipe').createSignedUrls(com.map(m => m.foto_path), 3600);
        (urls || []).forEach((u, i) => { if (u && u.signedUrl) com[i].foto_url = u.signedUrl; }); } catch (e) { /* sem foto */ } }
      return data;
    },
    async listarTurmas() { const { data, error } = await sb.from('turmas_fic').select('*').order('criado_em'); if (error) throw erro(error); return data; },
    async listarMatriculas() { const { data, error } = await sb.from('matriculas_fic').select('*').is('cancelada_em', null).order('criado_em'); if (error) throw erro(error); return data; },
    async salvarTurma(t) {
      const reg = { id: t.id || crypto.randomUUID(), nome: t.nome, uf: t.uf || null, municipio: t.municipio || null, inicio: t.inicio || null, fim: t.fim || null, professor_id: t.professor_id, obs: t.obs || null };
      return gravar('turmas_fic', reg);
    },
    async matricular(turma_id, equipe_id, numero, data) {
      const { data: id, error } = await sb.rpc('matricular_fic', { p_turma: turma_id, p_equipe: equipe_id, p_numero: numero, p_data: data }); if (error) throw erro(error); return id;
    },
    async cancelarMatricula(id, motivo) { const { error } = await sb.rpc('cancelar_matricula_fic', { p_id: id, p_motivo: motivo }); if (error) throw erro(error); },

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
