/* Dados que só uma aba usa são buscados quando ela abre; e a tabela de rotas dos cliques e formulários. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { montar } = require('./telas');

const contar = (S, nomes) => { const n = {}; nomes.forEach(k => { const f = S.api[k]; n[k] = 0; S.api[k] = async (...a) => { n[k]++; return f.apply(S.api, a); }; }); return n; };

describe('histórico e documentos: lidos só com a aba aberta', () => {
  test('entrada da coordenação geral (Visão geral): nem o histórico nem os documentos são pedidos', async () => {
    const T = await montar('coord_geral'); const n = contar(T.S, ['auditoria', 'listarDocumentos', 'listarFichas']);
    T.S.aba = null; await T.MQ.ui.carregar();
    assert.deepEqual(n, { auditoria: 0, listarDocumentos: 0, listarFichas: 1 });
  });
  test('abrir a aba Histórico: mostra "Carregando…", busca e desenha os registros; nunca "Nada registrado" antes de ler', async () => {
    const T = await montar('coord_tecnico');
    await T.api.criar({ papel: 'agente', uf: 'SE', nome: 'Agente Sob Demanda', cpf: '47602436075', email: 'sd@gmail.com', telefone: '(79) 99999-0000', data_inicio: new Date().toISOString().slice(0, 10), consentimento_lgpd: true });
    await T.trocar('coord_geral'); const n = contar(T.S, ['auditoria']);
    const antes = T.aba('historico'); assert.match(antes, /data-carregando-aba/); assert.doesNotMatch(antes, /Nada registrado ainda/);
    await new Promise(r => setTimeout(r, 30));   // a própria tela dispara a busca, sem ninguém chamar
    assert.equal(n.auditoria, 1);
    const h = T.html(); assert.doesNotMatch(h, /data-carregando-aba/); assert.match(h, /Agente Sob Demanda/);
  });
  test('com a aba aberta, a atualização de fundo relê o histórico; ao sair da aba, para de reler e o que veio continua guardado', async () => {
    const T = await montar('coord_geral'); const n = contar(T.S, ['auditoria']);
    T.S.aba = 'historico'; await T.MQ.ui.carregar(); assert.equal(n.auditoria, 1); const tinha = T.S.aud.length;
    T.S.aba = 'visao'; await T.MQ.ui.carregar(); assert.equal(n.auditoria, 1); assert.equal(T.S.aud.length, tinha);
    assert.doesNotMatch(T.aba('historico'), /data-carregando-aba/, 'voltou à aba: mostra o que já tinha enquanto relê');
  });
  test('falha ao abrir a aba: aviso "Parte dos dados não carregou" com tentar de novo, e a aba não fica presa em "Carregando…"', async () => {
    const T = await montar('coord_geral'); const boa = T.S.api.auditoria;
    T.S.api.auditoria = async () => { throw Object.assign(new Error('x'), { original: { code: '500', message: 'Internal Server Error' } }); };
    T.aba('historico'); await T.MQ.ui.carregarDaAba();
    assert.deepEqual([...T.S.cargaParcial], ['histórico']); assert.doesNotMatch(T.aba('historico'), /data-carregando-aba/);
    T.S.api.auditoria = boa; await T.MQ.ui.carregar(); assert.equal(T.S.cargaParcial, null);
  });
  test('sem internet: não fica em "Carregando…" (vale a cópia do aparelho)', async () => {
    const T = await montar('coord_geral'); T.S.semRede = true;
    assert.doesNotMatch(T.aba('historico'), /data-carregando-aba/); T.S.semRede = false;
  });
  test('saiu do sistema no meio da leitura: o histórico da pessoa anterior não entra na memória', async () => {
    const T = await montar('coord_geral'); let soltar; T.S.aud = [];
    T.S.api.auditoria = () => new Promise(r => { soltar = () => r([{ id: 1, em: new Date().toISOString(), acao: 'x' }]); });
    T.aba('historico'); const p = T.MQ.ui.carregarDaAba(); const eu = T.S.eu; T.S.eu = null; soltar(); await p;
    assert.equal(T.S.aud.length, 0); T.S.eu = eu;
  });
  for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) test(p + ': nunca pede histórico nem documentos', async () => {
    const T = await montar(p); const n = contar(T.S, ['auditoria', 'listarDocumentos']);
    T.S.aba = 'historico'; await T.MQ.ui.carregar(); await T.MQ.ui.carregarDaAba(); T.S.aba = 'documentos'; await T.MQ.ui.carregar(); await T.MQ.ui.carregarDaAba();
    assert.deepEqual(n, { auditoria: 0, listarDocumentos: 0 });
  });
});

describe('tabela de rotas: cada ação e cada formulário têm um módulo que atende', () => {
  const raiz = path.join(__dirname, '..', '..', 'js');
  const fontes = fs.readdirSync(raiz).filter(f => f.endsWith('.js') && f !== 'tudo.js').map(f => [f, fs.readFileSync(path.join(raiz, f), 'utf8')]);
  test('todos os módulos da tabela existem e têm clique()/enviar()', async () => {
    const { MQ } = await montar('coord_geral');
    for (const [re, ui] of MQ.rotas.clique) { assert.ok(MQ[ui], ui + ' não carregou (' + re + ')'); assert.equal(typeof MQ[ui].clique, 'function', ui + '.clique'); }
    for (const [re, ui] of MQ.rotas.form) { assert.ok(MQ[ui], ui + ' (' + re + ')'); assert.equal(typeof MQ[ui].enviar, 'function', ui + '.enviar'); }
  });
  test('nenhuma ação é disputada por dois módulos (a ordem da tabela não muda o resultado)', async () => {
    const { MQ } = await montar('coord_geral'); const acoes = new Set();
    fontes.forEach(([, s]) => { for (const m of s.matchAll(/data-acao="([a-z][a-z0-9-]*)"/g)) acoes.add(m[1]); for (const m of s.matchAll(/acao: '([a-z][a-z0-9-]*)'/g)) acoes.add(m[1]); });
    assert.ok(acoes.size > 150, 'achou as ações do sistema: ' + acoes.size);
    const disputa = [...acoes].map(a => [a, MQ.rotas.clique.filter(([re]) => re.test(a)).map(r => r[1])]).filter(([, l]) => l.length > 1);
    assert.deepEqual(disputa, []);
  });
  test('cada ação com prefixo de módulo cai no módulo que a trata', async () => {
    const { MQ } = await montar('coord_geral');
    const esperado = { 'ficha-nova': 'fichasUI', 'fic-turma': 'ficUI', 'pag-pedir': 'pagUI', 'enc-novo': 'encUI', 'exec-enviar': 'execUI', 'agua-registrar': 'aguaUI', 'venda-canal': 'vendaUI', 'doc-novo': 'docsUI',
      'viag-novo': 'viagUI', 'aval-abrir': 'impactoUI', 'imp-abrir': 'impactoUI', 'vit-publicar': 'vitrineUI', 'ent-marcar': 'entregasUI', 'rot-abrir': 'roteiroUI', 'campo-plano-imprimir': 'campoUI', 'acomp-atualizar': 'acompUI',
      'pend-abrir': 'pendUI', 'conv-novo': 'convitesUI', 'custo-km': 'custosUI', 'banco-ver': 'bancoUI', 'apl-abrir': 'sugestaoUI' };
    for (const [a, ui] of Object.entries(esperado)) assert.equal((MQ.rotas.doClique(a) || [])[1], ui, a);
    for (const a of ['ver', 'novo', 'editar', 'aba', 'sair', 'fechar', 'ir', 'desligar-abrir']) assert.equal(MQ.rotas.doClique(a), undefined, a + ' é do próprio app.js');
  });
  test('foco de volta ao fechar o painel: regra de cada módulo preservada', async () => {
    const { MQ } = await montar('coord_geral'); const f = a => { const r = MQ.rotas.doClique(a)[2]; return typeof r === 'function' ? r(a) : r; };
    assert.equal(f('ficha-nova'), true); assert.equal(f('enc-novo'), true); assert.equal(f('enc-editar'), true); assert.equal(f('enc-cancelar'), false);
    assert.equal(f('doc-novo'), true); assert.equal(f('doc-rel-word'), false); assert.equal(f('viag-novo'), true); assert.equal(f('viag-pass'), false);
    assert.equal(f('rot-abrir'), null, 'roteiro: o módulo decide'); assert.equal(f('conv-novo'), undefined, 'convites: não mexe no foco');
  });
  test('formulários: cada data-form do sistema tem destino (módulo da tabela ou o próprio app.js)', async () => {
    const { MQ } = await montar('coord_geral'); const forms = new Set();
    fontes.forEach(([, s]) => { for (const m of s.matchAll(/data-form="?([a-z][a-z0-9-]*)/g)) forms.add(m[1]); });
    const app = fontes.find(([f]) => f === 'app.js')[1];
    const orfaos = [...forms].filter(t => !MQ.rotas.form.some(([re]) => re.test(t)) && !new RegExp("tipo === '" + t + "'").test(app));
    assert.deepEqual(orfaos, []);
    const dobro = [...forms].map(t => [t, MQ.rotas.form.filter(([re]) => re.test(t)).length]).filter(([, n]) => n > 1); assert.deepEqual(dobro, []);
  });
});
