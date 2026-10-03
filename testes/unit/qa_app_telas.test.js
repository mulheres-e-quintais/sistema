/* QA 01/10/2026 — js/app.js, campo.js e painel.js no navegador falso: duplo envio, carga parcial, avisos sem texto técnico,
   habilitação sem data sugerida, desenho em segundo plano sem refazer o painel, pontos do mapa, o que os campos declaram. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais } = require('./ambiente');
const { texto } = require('./telas');

const ARQUIVOS = ['dados.js', 'regras.js', 'api-demo.js', 'api-supabase.js', 'fila.js', 'fichas.js', 'geo.js', 'painel.js', 'campo.js', 'vitrine.js', 'custos.js',
  'fic.js', 'encontros.js', 'agua.js', 'venda.js', 'pagamentos.js', 'viagens.js', 'documentos.js', 'planilha.js', 'execucao.js', 'entregas.js', 'roteiro.js', 'impacto.js', 'convites.js', 'banco.js', 'pendencias.js', 'lembretes.js', 'ajuda.js', 'mascaras.js', 'voz.js',
  'sugestao.js', 'sessao.js', 'imprimir.js', 'app.js'];
const GENERICA = 'Não deu certo. Tente de novo; se continuar, avise a coordenação.';
const TECNICO = /Cannot read|is not a function|undefined|null|\[object|violates|constraint|duplicate key|JWT|syntax|TypeError|PGRST/;

async function montar(perfil) {
  const a = carregar(ARQUIVOS); const { MQ } = a; MQ.CONFIG = { supabaseUrl: '', supabaseAnonKey: '', semServiceWorker: true };
  const S = MQ.ui.S; S.api = MQ.apiDemo; await S.api.iniciar(); S.eu = await S.api.trocarPerfil(perfil); await MQ.ui.carregar();
  const T = { MQ, S, api: S.api, janela: a.janela, ouvintes: a.ouvintes, ouvintesJanela: a.ouvintesJanela, html: () => a.app(), painelHTML: () => a.painel() };
  // captura o aviso (toast)
  const corpo = a.janela.document.body; const orig = corpo.appendChild;
  corpo.appendChild = el => { if (el.id === 'toast') T._toast = el; return orig.call(corpo, el); };
  a.janela.document.querySelector = (q => sel => sel === '#toast' ? (T._toast || null) : q(sel))(a.janela.document.querySelector);
  T.toast = () => (T._toast ? String(T._toast.textContent) : '');
  T.clicar = async el => { for (const fn of a.ouvintes.click) await fn({ target: el, preventDefault() {}, stopPropagation() {} }); };
  T.enviar = async form => { for (const fn of a.ouvintes.submit) await fn({ target: form, preventDefault() {} }); };
  return T;
}
const botao = (acao, extra = {}) => { const el = { dataset: Object.assign({ acao }, extra), disabled: false, textContent: '', isConnected: true }; el.closest = sel => sel === '[data-acao]' ? el : null; return el; };
/* formulário de mentira: os campos são propriedades (o FormData falso lê assim) */
function formFalso(tipo, dataset, campos, nBotoes = 1) {
  const bs = Array.from({ length: nBotoes }, (_, i) => ({ textContent: 'Botão ' + i, disabled: false, type: 'submit' }));
  const caixa = { textContent: '', hidden: true, setAttribute() {}, removeAttribute() {} };
  const f = Object.assign({ dataset: Object.assign({ form: tipo }, dataset), botoes: bs, caixa,
    querySelector(sel) { if (/type=submit/.test(sel)) return bs[0] || null; if (/data-erro/.test(sel)) return caixa; const m = /\[name="([\w-]+)"\]/.exec(sel); return m && m[1] in campos ? { type: 'text', closest: () => null, setAttribute() {} } : null; },
    querySelectorAll(sel) { return /type=submit/.test(sel) ? bs : []; }, reset() {} }, campos);
  f.closest = () => f; return f;
}

describe('duplo envio e duplo clique', () => {
  test('"ocupado": durante a gravação, TODOS os botões de enviar ficam travados e depois voltam ao que eram', async () => {
    const T = await montar('coord_tecnico'); const f = formFalso('x', {}, {}, 2); f.botoes[0].textContent = 'Dar aval';
    T.janela.document.body.contains = () => true;
    let durante = null, soltar; const espera = new Promise(r => { soltar = r; });
    const p = T.MQ.ui.ocupado(f, async () => { durante = f.botoes.map(b => b.disabled); await espera; });
    assert.equal(f.botoes[0].disabled, true, 'travado no mesmo instante'); assert.equal(f.botoes[0].textContent, 'Salvando…');
    soltar(); await p;
    assert.deepEqual(durante, [true, true]); assert.deepEqual(f.botoes.map(b => b.disabled), [false, false]); assert.equal(f.botoes[0].textContent, 'Dar aval');
  });
  test('"ocupado": segundo envio enquanto o primeiro grava é ignorado (uma gravação só)', async () => {
    const T = await montar('coord_tecnico'); const f = formFalso('x', {}, {}); let n = 0;
    const fn = async () => { n++; await new Promise(r => setTimeout(r, 15)); };
    await Promise.all([T.MQ.ui.ocupado(f, fn), T.MQ.ui.ocupado(f, fn)]);
    assert.equal(n, 1);
    await T.MQ.ui.ocupado(f, fn); assert.equal(n, 2, 'depois de terminar, grava de novo normalmente');
  });
  test('"ocupado": formulário sem botão de enviar não quebra; depois de erro o botão volta', async () => {
    const T = await montar('coord_tecnico'); let fez = false; T.janela.document.body.contains = () => true;
    await T.MQ.ui.ocupado(formFalso('x', {}, {}, 0), async () => { fez = true; }); assert.equal(fez, true);
    const f = formFalso('x', {}, {}); f.botoes[0].textContent = 'Salvar';
    await assert.rejects(() => T.MQ.ui.ocupado(f, async () => { throw new Error('x'); }));
    assert.equal(f.botoes[0].disabled, false); assert.equal(f.botoes[0].textContent, 'Salvar');
    await T.MQ.ui.ocupado(f, async () => { fez = 'de novo'; }); assert.equal(fez, 'de novo', 'não fica preso em "ocupado" depois do erro');
  });
  test('descartar pedido de novo acesso: pede confirmação antes; toque duplo não confirma; uma chamada só', async () => {
    const T = await montar('coord_geral'); let n = 0;
    T.S.api.descartarPedidoAcesso = async () => { n++; await new Promise(r => setTimeout(r, 15)); };
    T.MQ.ui.carregar = async () => {};
    const el = botao('acesso-descartar', { id: 'x' }); el.textContent = 'Descartar';
    await Promise.all([T.clicar(el), T.clicar(el)]);                    // toque duplo
    assert.equal(n, 0, 'nada apagado sem confirmar'); assert.equal(el.textContent, 'Descartar mesmo?'); assert.match(T.toast(), /Descartar apaga este pedido/);
    el.dataset.okEm = String(Date.now() - 1000);                         // a pessoa leu e tocou de novo
    await Promise.all([T.clicar(el), T.clicar(el)]);                    // e tocou duas vezes
    assert.equal(n, 1, n + ' chamadas'); assert.match(T.toast(), /Pedido descartado/);
  });
  test('um botão de ação que ainda está gravando não começa de novo (vale para qualquer [data-acao])', async () => {
    const T = await montar('coord_geral'); let n = 0;
    T.S.api.gerarCodigoAcesso = async () => { n++; await new Promise(r => setTimeout(r, 15)); return 'ABCD-2345'; };
    const m = T.S.equipe.find(x => x.status === 'ativa' && !x.user_id && x.papel !== 'coord_geral') || T.S.equipe.find(x => x.papel === 'apoio'); m.user_id = null;
    const el = botao('gerar-codigo', { id: m.id });
    await Promise.all([T.clicar(el), T.clicar(el), T.clicar(el)]);
    assert.equal(n, 1, n + ' chamadas');
  });
});

describe('carga inicial: uma leitura que falha não derruba as outras', () => {
  const erro500 = () => Object.assign(new Error('x'), { original: { code: '500', message: 'Internal Server Error' } });
  test('falha só no histórico: o resto carrega, a tela avisa "Parte dos dados não carregou" e tentar de novo resolve', async () => {
    const T = await montar('coord_geral'); const { S, MQ } = T; const aud = S.api.auditoria; const fichas = S.fichas.length;
    S.api.auditoria = async () => { throw erro500(); };
    await assert.doesNotReject(() => MQ.ui.carregar());
    assert.deepEqual([...S.cargaParcial], ['histórico']); assert.equal(S.fichas.length, fichas); assert.ok(S.equipe.length > 1);
    MQ.ui.render(); assert.match(texto(T.html()), /Parte dos dados não carregou\. Toque para tentar de novo\./); assert.match(T.html(), /data-acao="carga-tentar"/);
    S.api.auditoria = aud;
    await T.clicar(botao('carga-tentar'));
    assert.equal(S.cargaParcial, null); assert.doesNotMatch(T.html(), /Parte dos dados não carregou/); assert.match(T.toast(), /Dados carregados/);
  });
  test('falha em várias leituras secundárias: mantém o que já estava na tela (não zera as listas)', async () => {
    const T = await montar('coord_geral'); const { S, MQ } = T; const nFichas = S.fichas.length, nVis = S.visitas.length;
    S.api.listarFichas = async () => { throw erro500(); }; S.api.listarVisitas = async () => { throw erro500(); }; S.api.listarSolicitacoes = async () => { throw erro500(); };
    await MQ.ui.carregar();
    assert.equal(S.fichas.length, nFichas); assert.equal(S.visitas.length, nVis); assert.equal(S.pagSemBanco, false, 'não vira "banco sem o script de pagamentos"');
    assert.deepEqual([...S.cargaParcial].sort(), ['fichas', 'pagamentos', 'visitas']);
    const c = JSON.parse(T.janela.localStorage.getItem('mq-cache-' + S.eu.id) || 'null');
    assert.ok(!c || c.fichas.length === nFichas, 'a cópia do aparelho não é trocada por uma carga incompleta');
  });
  test('a equipe é indispensável: se ela falha, a carga falha (como antes); sem internet continua valendo a cópia do aparelho', async () => {
    const T = await montar('coord_geral'); const { S, MQ } = T;
    S.api.listarEquipe = async () => { throw erro500(); };
    await assert.rejects(() => MQ.ui.carregar());
    S.api.listarEquipe = async () => { throw Object.assign(new Error('Sem internet'), { semRede: true }); };
    await assert.doesNotReject(() => MQ.ui.carregar()); assert.equal(S.semRede, true);
  });
});

describe('avisos: nunca texto técnico, "undefined" ou "[object Object]"', () => {
  test('toast com undefined, null, objeto ou texto vazio mostra a mensagem simples', async () => {
    const T = await montar('coord_geral');
    for (const v of [undefined, null, '', 'undefined', 'null', {}, { code: '500' }, '[object Object]', NaN]) { T.MQ.ui.toast(v); assert.equal(T.toast(), GENERICA, String(v)); }
    T.MQ.ui.toast('Foto salva.'); assert.equal(T.toast(), 'Foto salva.');
    T.MQ.ui.toast(Object.assign(new Error('Você já solicitou este mês.'), { original: {} })); assert.equal(T.toast(), 'Você já solicitou este mês.');
  });
  test('erro de programação num clique: aviso simples (o detalhe vai para o console)', async () => {
    const T = await montar('coord_geral'); const visto = []; const ce = T.janela.console; T.janela.console = Object.assign({}, ce, { error: (...a) => visto.push(a) });
    T.S.api.gerarCodigoAcesso = async () => { throw new TypeError("Cannot read properties of undefined (reading 'id')"); };
    const m = T.S.equipe.find(x => x.papel === 'apoio'); m.user_id = null;
    await T.clicar(botao('gerar-codigo', { id: m.id }));
    assert.equal(T.toast(), GENERICA);
  });
  test('rejeição que não é Error (objeto só com código) num clique: aviso simples', async () => {
    const T = await montar('coord_geral'); T.S.api.descartarPedidoAcesso = async () => { throw { code: '500' }; };
    const el = botao('acesso-descartar', { id: 'x', ok: '1', okEm: String(Date.now() - 1000) });
    await T.clicar(el); assert.equal(T.toast(), GENERICA); assert.equal(el.disabled, false, 'o botão volta a funcionar depois do erro');
  });
  test('erro técnico ao salvar um formulário: a caixa mostra a mensagem simples; regra do projeto passa como veio', async () => {
    const T = await montar('coord_geral'); const m = T.S.equipe.find(x => x.papel === 'apoio');
    const f = () => formFalso('hab', { id: m.id }, { docs_funcern_em: '', termo_assinado_em: '', obs_habilitacao: 'obs ' + Math.random() });
    T.S.api.atualizar = async () => { throw new TypeError('x.y is not a function'); };
    let fm = f(); await T.enviar(fm); assert.equal(fm.caixa.textContent, GENERICA);
    T.S.api.atualizar = async () => { throw Object.assign(new Error('Algum campo está com valor que o sistema não aceita. Confira e tente de novo.'), { original: { code: '23514', message: 'violates check constraint' } }); };
    fm = f(); await T.enviar(fm); assert.doesNotMatch(fm.caixa.textContent, TECNICO); assert.match(fm.caixa.textContent, /valor que o sistema não aceita/);
    T.S.api.atualizar = async () => { throw Object.assign(new Error('Você não pode registrar a própria habilitação.'), { regra: true }); };
    fm = f(); await T.enviar(fm); assert.equal(fm.caixa.textContent, 'Você não pode registrar a própria habilitação.');
  });
  test('há tratador global (window "error" e "unhandledrejection") que avisa sem texto técnico', async () => {
    const T = await montar('coord_geral'); const ce = T.janela.console; T.janela.console = Object.assign({}, ce, { error() {} });
    assert.ok((T.ouvintesJanela.error || []).length >= 1); assert.ok((T.ouvintesJanela.unhandledrejection || []).length >= 1);
    for (const fn of T.ouvintesJanela.unhandledrejection) fn({ reason: new TypeError("Cannot read properties of null (reading 'x')") });
    assert.equal(T.toast(), GENERICA);
  });
  test('"Entrar" com senha na demonstração: mensagem clara, não "is not a function"', async () => {
    const T = await montar('coord_geral'); T.S.verEntrada = true;
    const fm = formFalso('login', {}, { email: 'ana@exemplo.org', senha: 'senha1234' }); await T.enviar(fm);
    assert.match(fm.caixa.textContent, /demonstração/); assert.match(fm.caixa.textContent, /perfil/); assert.doesNotMatch(fm.caixa.textContent, TECNICO);
  });
});

describe('habilitação: nada gravado sem a pessoa escolher', () => {
  test('passo ainda não feito: a data vem em branco, com botão "Hoje" (antes vinha "Sugerido: hoje")', async () => {
    const T = await montar('coord_geral'); const m = T.S.equipe.find(x => x.status === 'ativa' && x.papel !== 'coord_geral' && !x.docs_funcern_em && !x.termo_assinado_em);
    assert.ok(m, 'há pessoa sem Arlo nem termo nos dados de exemplo');
    T.MQ.ui.abrirPainel({ tipo: 'detalhe', id: m.id }); const h = T.painelHTML();
    assert.match(h, /<input id="h-fun" name="docs_funcern_em" type="date"[^>]* value="">/); assert.match(h, /<input id="h-ter" name="termo_assinado_em" type="date"[^>]* value="">/);
    assert.match(h, /data-acao="data-hoje" data-alvo="h-fun"/); assert.doesNotMatch(h, /Sugerido: hoje|data-sugerido/);
  });
  test('salvar só a observação grava só a observação (não grava "cadastrado no Arlo" nem "termo assinado")', async () => {
    const T = await montar('coord_geral'); const m = T.S.equipe.find(x => x.status === 'ativa' && x.papel !== 'coord_geral' && !x.docs_funcern_em && !x.termo_assinado_em);
    let patch = null; const orig = T.S.api.atualizar.bind(T.S.api); T.S.api.atualizar = async (id, p) => { patch = p; return orig(id, p); };
    await T.enviar(formFalso('hab', { id: m.id }, { docs_funcern_em: '', termo_assinado_em: '', obs_habilitacao: 'Falta o comprovante de conta.' }));
    assert.deepEqual(Object.keys(patch), ['obs_habilitacao']);
    const d = T.S.equipe.find(x => x.id === m.id); assert.ok(!d.docs_funcern_em && !d.termo_assinado_em);
  });
  test('data de 2019 ou no futuro é recusada na tela (o banco recusaria)', async () => {
    const T = await montar('coord_geral'); const m = T.S.equipe.find(x => x.status === 'ativa' && x.papel !== 'coord_geral' && !x.docs_funcern_em);
    let chamou = 0; T.S.api.atualizar = async () => { chamou++; };
    for (const d of ['2019-05-10', diaMais(1)]) { const fm = formFalso('hab', { id: m.id }, { docs_funcern_em: d, termo_assinado_em: '', obs_habilitacao: '' }); await T.enviar(fm); assert.ok(fm.caixa.textContent, d); }
    assert.equal(chamou, 0);
  });
});

describe('desenho em segundo plano não refaz o painel aberto', () => {
  test('renderFundo (rede, sincronização, atualização automática) deixa o painel como está; o desenho normal refaz', async () => {
    const T = await montar('bolsista'); const { MQ, janela } = T;
    MQ.ui.abrirPainel({ tipo: 'ajuda' }); const el = janela.document.querySelector('#painel');   // a ajuda não busca nada depois de abrir
    await new Promise(r => setTimeout(r, 30));
    el.innerHTML = 'O QUE A PESSOA DIGITOU';
    MQ.ui.renderFundo(); assert.equal(T.painelHTML(), 'O QUE A PESSOA DIGITOU');
    for (const fn of T.ouvintesJanela.offline || []) fn();
    assert.equal(T.painelHTML(), 'O QUE A PESSOA DIGITOU', 'o sinal caiu: o painel não é refeito');
    T.S.fila = []; await MQ.fila.salvar({ id: 'x1', dono: T.S.eu.id, tipo: 'ficha', dados: { id: 'x1' }, erro: 'recusada', reenviar: false });   // fila com item: sincronizar redesenha o fundo
    let desenhos = 0; const app = janela.document.querySelector('#app'); let h = app.innerHTML;
    Object.defineProperty(app, 'innerHTML', { get: () => h, set: v => { h = v; desenhos++; }, configurable: true });
    el.innerHTML = 'O QUE A PESSOA DIGITOU'; await MQ.ui.sincronizar(false);
    assert.ok(desenhos >= 1, 'o fundo foi redesenhado'); assert.equal(T.painelHTML(), 'O QUE A PESSOA DIGITOU', 'sincronizar a fila: o painel não é refeito');
    MQ.ui.render(); assert.notEqual(T.painelHTML(), 'O QUE A PESSOA DIGITOU');
  });
  test('sem internet, o fundo mostra o aviso mesmo com painel aberto', async () => {
    const T = await montar('bolsista'); const { MQ, janela } = T;
    MQ.ui.abrirPainel({ tipo: 'meus-dados' }); janela.navigator.onLine = false;
    for (const fn of T.ouvintesJanela.offline || []) fn();
    assert.match(T.html(), /data-rede/); assert.match(texto(T.html()), /Sem internet\./);
  });
});

describe('o que os campos declaram (required, maxlength, min, max) é conferido em JavaScript', () => {
  const campo = o => Object.assign({ tagName: 'INPUT', type: 'text', name: 'x', value: '', defaultValue: '', disabled: false, required: false, offsetWidth: 10, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, attrs: {} }, o);
  const form = campos => ({ querySelectorAll: sel => /input,select,textarea/.test(sel) ? campos : [] });
  test('texto acima do maxlength, número e data fora de min/max: mensagem em português', async () => {
    const T = await montar('coord_geral'); const D = T.MQ.ui.declarados;
    const e = D(form([campo({ name: 'nome', value: 'a'.repeat(121), attrs: { maxlength: '120' } }), campo({ name: 'obs', value: 'b'.repeat(2001), attrs: { maxlength: '2000' } }),
      campo({ name: 'idade', type: 'number', value: '130', attrs: { min: '0', max: '120' } }), campo({ name: 'renda', type: 'number', value: '-5', attrs: { min: '0' } }),
      campo({ name: 'dia', type: 'date', value: '2019-01-01', attrs: { min: '2026-01-01', max: '2027-12-31' } }), campo({ name: 'fim', type: 'date', value: '2099-01-01', attrs: { min: '2026-01-01', max: '2027-12-31' } }),
      campo({ name: 'ok', value: 'tudo certo', attrs: { maxlength: '120' } }), campo({ name: 'ok2', type: 'number', value: '120', attrs: { min: '0', max: '120' } })]), true);
    assert.equal(e.nome, 'Texto muito longo (máximo 120 caracteres).'); assert.equal(e.obs, 'Texto muito longo (máximo 2.000 caracteres).');
    assert.equal(e.idade, 'O maior valor aceito é 120.'); assert.equal(e.renda, 'O menor valor aceito é 0.');
    assert.equal(e.dia, 'A data não pode ser antes de 01/01/2026.'); assert.equal(e.fim, 'A data não pode ser depois de 31/12/2027.');
    assert.equal(e.ok, undefined); assert.equal(e.ok2, undefined);
  });
  test('"required" vazio só é cobrado na hora de gravar; campo escondido, desabilitado ou que não mudou não é cobrado', async () => {
    const T = await montar('coord_geral'); const D = T.MQ.ui.declarados;
    const l = [campo({ name: 'email', required: true }), campo({ name: 'motivo', tagName: 'SELECT', type: 'select-one', required: true }), campo({ name: 'ciente', type: 'checkbox', required: true, checked: false }),
      campo({ name: 'escondido', required: true, offsetWidth: 0, offsetHeight: 0 }), campo({ name: 'travado', required: true, disabled: true }),
      campo({ name: 'antigo', type: 'date', value: '2019-01-01', defaultValue: '2019-01-01', attrs: { min: '2026-01-01' } })];
    assert.deepEqual(Object.assign({}, D(form(l), true)), { email: 'Preencha este campo.', motivo: 'Escolha uma opção.', ciente: 'Marque esta opção.' });
    assert.deepEqual(Object.assign({}, D(form(l), false)), {});
  });
  test('"ocupado" não grava enquanto um campo declarado está inválido', async () => {
    const T = await montar('coord_geral'); let gravou = 0;
    const f = formFalso('x', {}, {}); const cx = { classList: { add() {}, remove() {} }, appendChild() {}, querySelectorAll: () => [] };
    const ruim = campo({ name: 'nome', value: 'a'.repeat(200), attrs: { maxlength: '120' }, closest: () => cx, setAttribute() {}, focus() {} });
    f.querySelectorAll = sel => /^input,select,textarea$/.test(sel) ? [ruim] : /type=submit/.test(sel) ? f.botoes : [];
    f.querySelector = sel => /type=submit/.test(sel) ? f.botoes[0] : /data-erro/.test(sel) ? f.caixa : /name="nome"/.test(sel) ? ruim : null;
    await T.MQ.ui.ocupado(f, async () => { gravou++; });
    assert.equal(gravou, 0); assert.match(f.caixa.textContent, /Texto muito longo \(máximo 120 caracteres\)/);
    ruim.value = 'Maria da Silva'; await T.MQ.ui.ocupado(f, async () => { gravou++; }); assert.equal(gravou, 1);
  });
  test('os formulários de app.js e campo.js declaram os limites: nomes 120, observações e relatos 2.000', async () => {
    const T = await montar('coord_geral'); const m = T.S.equipe.find(x => x.papel === 'apoio');
    T.MQ.ui.abrirPainel({ tipo: 'cadastro', id: m.id }); let h = T.painelHTML();
    assert.match(h, /id="c-nome"[^>]*maxlength="120"/); assert.match(h, /id="c-email"[^>]*maxlength="254"/);
    assert.match(h, /id="c-ini"[^>]*min="2025-01-01"/);
    T.MQ.ui.abrirPainel({ tipo: 'detalhe', id: m.id }); h = T.painelHTML();
    assert.match(h, /id="h-obs"[^>]*maxlength="2000"/); assert.match(h, /id="d-det"[^>]*maxlength="2000"/); assert.match(h, new RegExp('id="d-data"[^>]*max="' + diaMais(0) + '"'));
    const v = T.S.visitas.find(x => x.situacao === 'prevista');
    if (v) { T.MQ.ui.abrirPainel({ tipo: 'visita-feita', id: v.id }); h = T.painelHTML(); assert.match(h, /id="vf-rel"[^>]*maxlength="2000"/); assert.match(h, /id="vf-data"[^>]*min="2026-01-01"/);
      T.MQ.ui.abrirPainel({ tipo: 'visita-form', id: v.id }); h = T.painelHTML(); assert.match(h, new RegExp('id="vi-d"[^>]*min="' + diaMais(0) + '" max="2027-12-31"')); }
  });
});

describe('entrada e mapa', () => {
  test('"Primeiro acesso" leva o e-mail já digitado (como "Esqueci a senha")', async () => {
    const T = await montar('coord_geral'); T.S.verEntrada = true; T.MQ.ui.render();
    T.janela.document.querySelector = (q => sel => sel === '#l-email' ? { value: ' ana@exemplo.org ', focus() {} } : q(sel))(T.janela.document.querySelector);
    await T.clicar(botao('modo-login', { m: 'primeiro' }));
    assert.match(T.html(), /Primeiro acesso/); assert.match(T.html(), /id="l-email"[^>]*value="ana@exemplo\.org"/);
  });
  test('pontos do mapa: cada um com nome para o leitor de tela; fora do Tab na entrada, dentro do Tab na página pública', async () => {
    const T = await montar('coord_geral'); const mapa = () => T.MQ.painelUI.mapaUFs({ entrada: true });
    let h = mapa(); const pontos = h.match(/<g class="mun-pt[^>]*>/g) || [];
    assert.ok(pontos.length >= 20, pontos.length + ' pontos');
    for (const g of pontos) { assert.match(g, /role="img"/); assert.match(g, /aria-label="[^"]+\/[A-Z]{2}[^"]*"/); assert.match(g, /tabindex="-1"/); }
    assert.match(h, /aria-label="Apodi\/RN: IFRN Campus Apodi/);
    T.janela.location.hash = '#numeros'; h = mapa();
    for (const g of h.match(/<g class="mun-pt[^>]*>/g)) assert.match(g, /tabindex="0"/);
    assert.match(T.MQ.painelUI.mapaUFs({ entrada: true, tab: -1 }), /tabindex="-1"/);
  });
});
