/* Perfis de acompanhamento no MODO PRODUÇÃO, com um servidor Supabase simulado dentro do navegador:
   primeiro acesso com código, entrada com senha, o que o app pede ao servidor (nenhuma tabela), saída, cadastro desativado.
   Uso: node acompanhamento_producao.js <caminho do playwright>   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'https://simulado.supabase.co',supabaseAnonKey:'chave-de-teste',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push(!!c); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d !== '' ? ' | ' + String(d).slice(0, 220) : '')); };
// servidor simulado: guarda contas, sessão e tudo o que o app pediu
const FALSO = () => {
  const B = window.__srv = window.__srv || { pedidos: [], contas: {}, sessao: null, obs: { 'marta@mda.exemplo': { id: 'o-mda', nome: 'Marta Observadora', orgao: 'mda', cargo: 'Analista', ativo: true, codigo: 'ABCD2345' }, 'paulo@mpa.exemplo': { id: 'o-mpa', nome: 'Paulo Parceiro', orgao: 'mpa', ativo: true, codigo: 'WXYZ6789' } } };
  try { const s = sessionStorage.getItem('srv'); if (s) Object.assign(B, JSON.parse(s)); } catch (e) {}
  const salvar = () => { try { sessionStorage.setItem('srv', JSON.stringify({ contas: B.contas, sessao: B.sessao, obs: B.obs, pedidos: B.pedidos })); } catch (e) {} };
  const quem = () => (B.sessao && B.obs[B.sessao] && B.obs[B.sessao].ativo && B.contas[B.sessao]) ? B.obs[B.sessao] : null;
  const numeros = org => ({ orgao: org, gerado_em: new Date().toISOString(), hoje: '2026-12-15',
    por_uf: ['AL', 'BA', 'PE', 'PI', 'SE'].map((uf, i) => ({ uf, indicadas: 50, selecionadas: 30 + i, espera: 4, sem_agua: 1, municipios: 3, comunidades: 7, pessoas: 120, diagnosticos: 25, planos: 20, diag_sem_agua: 1, area_m2: 6000, implantados: 12, acompanhamentos: 6, avaliacoes: 0, visitas_feitas: 43, agendadas: 5, atrasadas: i === 2 ? 3 : 0, bolsistas: 2, agentes: 3 })),
    municipios: [{ uf: 'PI', municipio: 'Paulistana', n: 12, implantados: 4 }], mensal: [{ mes: '2026-11', diagnostico: 80, implantacao: 20, acompanhamento: 0, avaliacao: 0 }, { mes: '2026-12', diagnostico: 45, implantacao: 40, acompanhamento: 30, avaliacao: 0 }],
    ...(org === 'mda' ? { perfil: { base: 160, sustento: 90, cadunico: 120, sem_ater: 70, raca_povo: 60, jovem: 22, grupo: 100, caf: 80, faixas: { '18 a 29': 22, '30 a 44': 70, '45 a 59': 50, '60 ou mais': 18 } }, impacto: { base_n: 125, renda_quintal_media: 140, final_n: 0, produz: { sim: 0, em_parte: 0, nao: 0 }, ebia_final: { seguranca: 0, leve: 0, moderada: 0, grave: 0 } } } : { formacao: { turmas: 5, matriculas: 22, encontros: 14 } }) });
  const rpc = async (nome, args) => { B.pedidos.push('rpc:' + nome); salvar(); const o = quem();
    if (nome === 'vincular_conta') return { data: null, error: null };
    if (nome === 'acompanhamento_eu') return { data: o ? { id: o.id, nome: o.nome, orgao: o.orgao, cargo: o.cargo || null } : null, error: null };
    if (nome === 'acompanhamento_dados') return o ? { data: numeros(o.orgao), error: null } : { data: null, error: { message: 'Acesso restrito ao acompanhamento do projeto.' } };
    return { data: null, error: { code: '42501', message: 'permission denied for function ' + nome } }; };
  const tabela = nome => { B.pedidos.push('tabela:' + nome); salvar(); const q = { select: () => q, order: () => q, eq: () => q, in: () => q, range: async () => ({ data: [], error: null, count: 0 }), then: (ok) => ok({ data: [], error: null }) }; return q; };
  const auth = {
    getSession: async () => ({ data: { session: B.sessao ? { user: { email: B.sessao } } : null } }),
    getUser: async () => ({ data: { user: B.sessao ? { email: B.sessao } : null }, error: null }),
    signUp: async ({ email, password, options }) => { B.pedidos.push('auth:signUp'); const o = B.obs[email]; const cod = String(((options || {}).data || {}).codigo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (!o || !o.ativo || B.contas[email]) { salvar(); return { data: {}, error: { message: 'Database error saving new user: E-mail não cadastrado no projeto.' } }; }
      if (!o.codigo || o.codigo !== cod) { salvar(); return { data: {}, error: { message: 'Database error saving new user: Código de acesso errado.' } }; }
      B.contas[email] = password; o.codigo = null; B.sessao = email; salvar(); return { data: { session: { user: { email } }, user: { email } }, error: null }; },
    signInWithPassword: async ({ email, password }) => { B.pedidos.push('auth:signIn'); if (B.contas[email] && B.contas[email] === password) { B.sessao = email; salvar(); return { data: { session: { user: { email } } }, error: null }; } salvar(); return { data: {}, error: { message: 'Invalid login credentials' } }; },
    signOut: async () => { B.pedidos.push('auth:signOut'); B.sessao = null; salvar(); return { error: null }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) };
  const cliente = { rpc, from: tabela, auth, storage: { from: n => { B.pedidos.push('arquivos:' + n); salvar(); return { createSignedUrl: async () => ({ data: null, error: { message: 'negado' } }), createSignedUrls: async () => ({ data: [], error: null }) }; } }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
  Object.defineProperty(window, 'supabase', { configurable: true, get: () => ({ createClient: () => cliente }), set: () => {} });
};
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && /Content Security|Refused|Erro na ação|TypeError/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort()); await ctx.route('**/simulado.supabase.co/**', r => r.abort());
  await ctx.addInitScript(FALSO);
  const txt = sel => p.evaluate(sel => (document.querySelector(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' '), sel);
  const pedidos = () => p.evaluate(() => window.__srv.pedidos.slice()); const limpar = () => p.evaluate(() => { window.__srv.pedidos.length = 0; });
  await p.goto('http://localhost:8766/'); await p.waitForSelector('form[data-form=login]');
  ok('sem sessão: aparece a tela de entrada', await p.locator('#l-email').count() === 1);
  const primeiro = async (email, cod, senha) => { await p.click('[data-acao=modo-login][data-m=primeiro]'); await p.waitForSelector('#l-cod'); await p.fill('#l-email', email); await p.fill('#l-cod', cod); await p.fill('#l-senha', senha); await p.fill('[name=senha2]', senha);
    await p.click('form[data-form=login] button[type=submit]'); await p.waitForTimeout(1200); };
  await primeiro('marta@mda.exemplo', 'ZZZZ-9999', 'Senha12345');
  ok('primeiro acesso com código errado: recusa com mensagem clara e não entra', /confira o e-mail e o código/i.test(await txt('#app')) && await p.locator('.ac-kpis').count() === 0, (await txt('form[data-form=login]')).slice(0, 160));
  await primeiro('estranho@fora.exemplo', 'ABCD-2345', 'Senha12345');
  ok('e-mail que não é de ninguém: recusa e não entra', await p.locator('.ac-kpis').count() === 0 && await p.locator('#l-email').count() === 1);
  await limpar(); await primeiro('marta@mda.exemplo', 'abcd 2345', 'Senha12345');
  await p.waitForSelector('.ac-kpis', { timeout: 5000 }).catch(() => {});
  ok('primeiro acesso com o código certo (em minúsculas e com espaço): entra direto na área do MDA', /O projeto em números/.test(await txt('main h1')) && /Acompanhamento · MDA/.test(await txt('header')), (await txt('#app')).slice(0, 160));
  let ped = await pedidos();
  ok('na entrada, o app não pede NENHUMA tabela nem arquivo ao servidor', !ped.some(x => /^(tabela|arquivos):/.test(x)), ped.filter(x => /^(tabela|arquivos):/.test(x)).join(','));
  ok('só chama as funções da entrada e dos números', ped.filter(x => /^rpc:/.test(x)).every(x => ['rpc:vincular_conta', 'rpc:acompanhamento_eu', 'rpc:acompanhamento_dados', 'rpc:registrar_acesso', 'rpc:vitrine', 'rpc:vitrine_municipios'].includes(x))   /* vitrine: os números públicos da tela de entrada, abertos a qualquer visitante */ && ped.includes('rpc:acompanhamento_dados'), [...new Set(ped)].join(','));
  ok('os números do servidor aparecem na tela (160 selecionadas, 215 visitas)', /^160mulheres selecionadas/.test((await txt('.ac-kpis')).replace(/\s/g, '').replace('mulheresselecionadas', 'mulheres selecionadas')) || /160/.test(await txt('.ac-kpis')) && /215/.test(await txt('.ac-kpis')), (await txt('.ac-kpis')).slice(0, 120));
  ok('perfil das beneficiárias aparece em percentuais (120 de 160 = 75%)', /Inscritas no CadÚnico\s*120 · 75%/.test(await txt('#ac-perfil')));
  ok('há botão Sair no modo produção e nenhum botão de Meus dados ou de ajuda da equipe', await p.locator('[data-acao=sair]').count() === 1 && await p.locator('[data-acao=meus-dados], [data-acao=ajuda]').count() === 0);
  ok('nada da equipe fica guardado no aparelho (só o perfil de quem entrou)', await p.evaluate(() => { const eu = JSON.parse(localStorage.getItem('mq-eu') || 'null'); return !!eu && eu.observador === true && !eu.cpf && !Object.keys(localStorage).some(k => /^mq-cache-/.test(k)); }));
  // recarregar a página: continua dentro, de novo sem pedir tabela
  await limpar(); await p.reload(); await p.waitForSelector('.ac-kpis'); ped = await pedidos();
  ok('recarregar a página: continua na área de acompanhamento, sem pedir tabela', !ped.some(x => /^(tabela|arquivos):/.test(x)) && /O projeto em números/.test(await txt('main h1')), [...new Set(ped)].join(','));
  // tentar abrir as telas da equipe por dentro
  const forca = await p.evaluate(async () => { const S = MQ.ui.S; const r = {}; S.aba = 'pagamentos'; MQ.ui.render(); r.aba = !!document.querySelector('.ac-kpis') && !document.querySelector('.abas');
    try { MQ.ui.abrirPainel({ tipo: 'meus-dados' }); } catch (e) {} await new Promise(x => setTimeout(x, 300)); MQ.ui.render(); r.painel = !document.querySelector('#painel'); location.hash = '#x'; await new Promise(x => setTimeout(x, 200)); r.tela = !!document.querySelector('.ac-kpis'); return r; });
  ok('forçar outra aba ou painel não mostra tela da equipe', forca.aba && forca.painel && forca.tela, JSON.stringify(forca));
  // sair
  await limpar(); await p.click('[data-acao=sair]'); await p.waitForSelector('#l-email', { timeout: 6000 }).catch(() => {});
  ok('Sair volta à tela de entrada e apaga o perfil guardado', await p.locator('#l-email').count() === 1 && await p.evaluate(() => !localStorage.getItem('mq-eu') && !MQ.ui.S.acomp && !MQ.ui.S.eu));
  ok('depois de sair, os números não ficam na memória da página', await p.evaluate(() => !MQ.ui.S.eu && !(document.body.textContent || '').includes('160')));
  // entrar com senha
  const entrar = async (email, senha) => { if (await p.locator('[data-acao=modo-login][data-m=entrar]').count()) await p.click('[data-acao=modo-login][data-m=entrar]'); await p.fill('#l-email', email); await p.fill('#l-senha', senha); await p.click('form[data-form=login] button[type=submit]'); await p.waitForTimeout(1200); };
  await entrar('marta@mda.exemplo', 'SenhaErrada1'); ok('senha errada: não entra', await p.locator('.ac-kpis').count() === 0 && /incorretos/.test(await txt('#app')));
  await entrar('marta@mda.exemplo', 'Senha12345'); await p.waitForSelector('.ac-kpis', { timeout: 5000 }).catch(() => {}); ok('senha certa: entra na área do MDA', /O projeto em números/.test(await txt('main h1')));
  ok('o código de primeiro acesso não serve de novo', await p.evaluate(() => window.__srv.obs['marta@mda.exemplo'].codigo === null));
  // cadastro desativado pela coordenação com a pessoa dentro
  await p.evaluate(() => { window.__srv.obs['marta@mda.exemplo'].ativo = false; sessionStorage.setItem('srv', JSON.stringify({ contas: window.__srv.contas, sessao: window.__srv.sessao, obs: window.__srv.obs, pedidos: [] })); });
  await p.click('[data-acao=acomp-atualizar]'); await p.waitForTimeout(800);
  ok('acesso desativado com a pessoa dentro: Atualizar mostra a recusa', /Acesso restrito/.test(await txt('main')));
  await p.reload(); await p.waitForTimeout(1500);
  ok('e ao reabrir, não entra mais na área de acompanhamento', await p.locator('.ac-kpis').count() === 0 && !/O projeto em números/.test(await txt('#app')), (await txt('#app')).slice(0, 140));
  // MPA
  await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); delete window.__srv; }); await p.reload(); await p.waitForSelector('#l-email');
  await primeiro('paulo@mpa.exemplo', 'WXYZ-6789', 'Senha12345'); await p.waitForSelector('.ac-kpis', { timeout: 5000 }).catch(() => {});
  ok('MPA: primeiro acesso entra na área do território, com 5 estados e a formação', /Andamento no território/.test(await txt('main h1')) && await p.locator('.ac-uf').count() === 5 && /22\s*matrículas/.test(await txt('#ac-formacao')));
  ok('MPA: o estado com visitas atrasadas aparece marcado', /3 visitas atrasadas/.test(await txt('.ac-ufs')) && /3 visitas com a data vencida/.test(await txt('#ac-parado')));
  ped = await pedidos(); ok('MPA: também não pede nenhuma tabela', !ped.some(x => /^(tabela|arquivos):/.test(x)), ped.filter(x => /^(tabela|arquivos):/.test(x)).join(','));
  ok('nenhum erro de página nem bloqueio da política de conteúdo', errs.length === 0, errs.join(' | '));
  console.log('\n' + R.filter(Boolean).length + ' passou, ' + R.filter(x => !x).length + ' falhou'); await b.close(); process.exit(R.some(x => !x) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
