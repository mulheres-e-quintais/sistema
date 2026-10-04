/* Supabase de mentira para testar js/api-supabase.js sem internet.
   modo: 'ok' (responde vazio), 'erro' (o banco recusa) ou 'rede' (sem internet). Guarda tudo o que foi pedido em `chamadas`. */
const { carregar } = require('./ambiente');

function servidor(opc) {
  const o = Object.assign({ modo: 'ok', tabelas: {}, rpc: {}, sessao: true, eu: { id: 'e1', papel: 'coord_geral', nome: 'Geral', status: 'ativa' } }, opc || {});
  const chamadas = [];
  const REDE = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' };
  const ERRO = { code: '42501', message: 'permission denied for table x' };
  const responde = (tipo, nome, passos) => {
    if (o.modo === 'rede') return { data: null, error: REDE, count: null };   // o supabase-js não lança: devolve o erro de rede no campo error
    if (o.modo === 'erro' && !(tipo === 'rpc' && nome === 'vincular_conta')) return { data: null, error: ERRO, count: null };
    const fonte = tipo === 'rpc' ? o.rpc : o.tabelas;
    let v = fonte[nome]; if (typeof v === 'function') v = v(passos);
    if (v && v.error) return { data: null, error: v.error, count: null };
    const unico = passos.some(p => p[0] === 'single' || p[0] === 'maybeSingle');
    if (tipo === 'rpc') return { data: v === undefined ? null : v, error: null };
    const linhas = v === undefined ? [] : v;
    const escreve = passos.some(p => /^(insert|update|upsert|delete)$/.test(p[0]));
    if (unico) return { data: Array.isArray(linhas) ? (linhas[0] || (escreve ? Object.assign({ id: 'novo' }, (passos.find(p => /^(insert|upsert|update)$/.test(p[0])) || [0, [{}]])[1][0]) : null)) : linhas, error: null };
    const r = passos.find(p => p[0] === 'range'); const fatia = r && Array.isArray(linhas) ? linhas.slice(r[1][0], r[1][1] + 1) : linhas;
    return { data: fatia, error: null, count: Array.isArray(linhas) ? linhas.length : null };
  };
  /* consulta encadeável: cada .eq(), .order() etc. devolve a mesma consulta; "await" entrega a resposta */
  const consulta = (tipo, nome, args) => {
    const passos = []; const reg = { tipo, nome, args, passos }; chamadas.push(reg);
    const q = new Proxy(function () {}, {
      get(_, k) {
        if (k === 'then') return (ok, falha) => new Promise(r => r(responde(tipo, nome, passos))).then(ok, falha);
        if (k === 'catch' || k === 'finally' || typeof k === 'symbol') return undefined;
        return (...a) => { passos.push([k, a]); return q; };
      }
    });
    return q;
  };
  const arquivo = balde => ({
    upload: async (caminho, corpo, op) => { chamadas.push({ tipo: 'arquivo', nome: balde, acao: 'upload', caminho, op }); if (o.modo === 'rede') return { data: null, error: REDE }; return o.modo === 'erro' ? { data: null, error: ERRO } : { data: { path: caminho }, error: null }; },
    createSignedUrl: async (caminho, seg) => { chamadas.push({ tipo: 'arquivo', nome: balde, acao: 'link', caminho, seg }); if (o.modo === 'rede') return { data: null, error: REDE }; return o.modo === 'erro' ? { data: null, error: ERRO } : { data: { signedUrl: 'https://x/' + caminho }, error: null }; },
    remove: async caminhos => { chamadas.push({ tipo: 'arquivo', nome: balde, acao: 'remove', caminhos }); return { data: [], error: null }; }
  });
  const sb = {
    from: t => consulta('tabela', t), rpc: (n, a) => consulta('rpc', n, a), storage: { from: arquivo },
    auth: { getSession: async () => ({ data: { session: o.sessao ? { user: { id: 'u1', email: 'a@b.br' } } : null } }), getUser: async () => ({ data: { user: o.sessao ? { id: 'u1', email: 'a@b.br' } : null } }),
      signOut: async () => ({ error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async c => { chamadas.push({ tipo: 'auth', nome: 'entrar', args: c }); return o.modo === 'erro' ? { data: null, error: { message: 'Invalid login credentials' } } : { data: { session: {} }, error: null }; },
      updateUser: async c => { chamadas.push({ tipo: 'auth', nome: 'atualizar', args: c }); return { data: {}, error: null }; } }
  };
  return { sb, chamadas, opc: o };
}
/* carrega a camada de produção ligada ao servidor de mentira e já "entra" como a pessoa indicada */
async function montarApi(opc) {
  const s = servidor(Object.assign({}, opc, { modo: 'ok' }));
  s.opc.rpc = Object.assign({ vincular_conta: s.opc.eu }, s.opc.rpc);
  const amb = carregar(['dados.js', 'regras.js', 'api-supabase.js']);
  amb.janela.supabase = { createClient: () => s.sb };
  amb.MQ.CONFIG = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' };
  const api = amb.MQ.apiSupabase; const eu = await api.iniciar();
  s.opc.modo = (opc && opc.modo) || 'ok'; s.chamadas.length = 0;
  return { api, eu, chamadas: s.chamadas, opc: s.opc, MQ: amb.MQ, janela: amb.janela };
}
module.exports = { servidor, montarApi };
