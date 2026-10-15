/* v264 (60_planilha_e_mpa.sql): planilha das fichas com duas opções e registro no Histórico; tela do MPA com equipe
   habilitada e diagnósticos esperando; "professor do curso FIC". */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { carregar } = require('./ambiente');

const limparFiltro = F => { F.filtro.uf = ''; F.filtro.situacao = ''; F.filtro.busca = ''; };

describe('Planilha das fichas', () => {
  test('o botão se chama "Baixar planilha" e oferece sem documentos e completa', async () => {
    const t = await montar('coord_tecnico'); limparFiltro(t.MQ.fichasUI);
    const h = t.aba('selecao');
    assert.match(texto(h), /Baixar planilha/); assert.doesNotMatch(texto(h), /CSV/);
    assert.match(h, /data-acao="ficha-csv" data-tipo="sem_documentos"/); assert.match(h, /data-acao="ficha-csv" data-tipo="completa"/);
  });
  test('sem documentos: sai sem CPF, NIS, CAF e data de nascimento; a completa tem tudo', async () => {
    const t = await montar('coord_tecnico'); const F = t.MQ.fichasUI; limparFiltro(F);
    const cab = r => r.texto.replace(/^﻿/, '').split('\n')[0];
    const sem = F.montarCSV('sem_documentos'), comp = F.montarCSV('completa');
    for (const c of ['"CPF"', '"NIS"', '"CAF"', '"Data de nascimento"']) { assert.ok(!cab(sem).includes(c), 'sem documentos tem ' + c); assert.ok(cab(comp).includes(c), 'completa sem ' + c); }
    for (const c of ['"Nome"', '"Celular"', '"Endereço"', '"Município"', '"Situação"']) assert.ok(cab(sem).includes(c), 'sem documentos perdeu ' + c);
    assert.match(sem.nome, /_sem_documentos_/); assert.doesNotMatch(comp.nome, /sem_documentos/);
    const cpf = t.S.fichas[0].cpf; assert.ok(!sem.texto.includes(cpf), 'o CPF apareceu na planilha sem documentos');
    assert.equal(sem.n, comp.n);
  });
  test('cada planilha baixada fica no Histórico: quem, qual, quantas fichas e o filtro', async () => {
    const t = await montar('coord_geral'); const F = t.MQ.fichasUI; limparFiltro(F); F.filtro.uf = 'PI';
    await t.api.registrarPlanilha('sem_documentos', 7, 'Estado PI');
    const hist = async () => { t.aba('historico'); await t.MQ.ui.carregarDaAba(); return texto(t.aba('historico')); };   // o histórico é buscado quando a aba abre
    const h = await hist();
    assert.match(h, /baixou a planilha das fichas sem documentos \(7 fichas\) · filtro: Estado PI/);
    await t.api.registrarPlanilha('completa', 1, '');
    assert.match(await hist(), /baixou a planilha completa das fichas \(com CPF, NIS e CAF\) \(1 ficha\)\./);
    await t.api.registrarPlanilha('copia_dados', 420, null);
    assert.match(await hist(), /baixou a cópia dos dados do projeto \(420 registros\)/);
  });
  test('bolsista não registra planilha (igual ao banco)', async () => {
    const t = await montar('bolsista');
    await assert.rejects(t.api.registrarPlanilha('completa', 1, null), /Só a coordenação/);
  });
});

describe('Tela do MPA', () => {
  const MQ = carregar(['dados.js', 'regras.js', 'acompanhamento.js'], { ui: { S: {}, esc: s => String(s) } }).MQ;
  const hab = { matricula_fic_em: '2026-10-01', docs_funcern_em: '2026-10-02', termo_assinado_em: '2026-10-03' };
  const dados = () => ({
    fichas: [{ id: 'f1', uf: 'PI', municipio: 'Picos', comunidade: 'A', resultado: 'selecionada', situacao: 'aprovada' }, { id: 'f2', uf: 'PI', municipio: 'Picos', comunidade: 'A', resultado: 'selecionada', situacao: 'aprovada' },
      { id: 'f3', uf: 'BA', municipio: 'Itiúba', comunidade: 'B', resultado: 'selecionada', situacao: 'aprovada' }],
    visitas: [], avaliacoes: [],
    diagnosticos: [{ ficha_id: 'f1', uf: 'PI', situacao: 'aguardando' }, { ficha_id: 'f2', uf: 'PI', situacao: 'devolvido' }, { ficha_id: 'f3', uf: 'BA', situacao: 'aprovado' }],
    equipe: [Object.assign({ id: 'e1', status: 'ativa', papel: 'articulacao', uf: 'PI' }, hab), { id: 'e2', status: 'ativa', papel: 'agente', uf: 'PI' },
      Object.assign({ id: 'e3', status: 'desligada', papel: 'apoio', uf: 'PI' }, hab), Object.assign({ id: 'e4', status: 'ativa', papel: 'coord_tecnico', uf: null }, hab)] });
  test('por estado: equipe de campo, habilitadas e diagnósticos esperando ou devolvidos (só contagens)', () => {
    const a = MQ.acomp.calcular(dados(), 'mpa', '2026-11-10'); const pi = a.por_uf.find(u => u.uf === 'PI'), ba = a.por_uf.find(u => u.uf === 'BA');
    assert.deepEqual([pi.equipe_campo, pi.habilitadas, pi.diag_aguardando, pi.diag_devolvidos], [2, 1, 1, 1]);
    assert.deepEqual([ba.equipe_campo, ba.habilitadas, ba.diag_aguardando, ba.diag_devolvidos], [0, 0, 0, 0]);
  });
  test('a tela do MPA mostra quem está pronta para trabalhar e o que espera a coordenação', async () => {
    const t = await montar('obs_mpa'); t.S.acomp = await t.api.dadosAcompanhamento(); t.S.acAba = 'equipe'; t.MQ.ui.render(); const h = texto(t.html());
    assert.match(h, /Andamento no território/);
    assert.match(h, /Habilitadas para o campo \d+ de \d+/);
    t.S.acAba = 'resumo'; t.MQ.ui.render(); assert.match(texto(t.html()), /O que pede atenção/);
  });
});

describe('Professor do curso FIC', () => {
  test('mensagem antiga do banco ("professor do FIC") chega com o nome certo', async () => {
    const amb = carregar(['dados.js', 'regras.js', 'api-supabase.js']);
    amb.janela.supabase = { createClient: () => ({ rpc: async nome => nome === 'registrar_planilha' ? { data: null, error: { message: 'O projeto tem no máximo 2 professores do FIC ativos. Desligue um antes de cadastrar outro.' } } : { data: { id: 'e1', papel: 'coord_geral', nome: 'Geral' }, error: null },
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } }) };
    amb.MQ.CONFIG = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' };
    await amb.MQ.apiSupabase.iniciar().catch(() => {});
    await assert.rejects(amb.MQ.apiSupabase.registrarPlanilha('completa', 1, null), e => /no máximo 2 professores do curso FIC ativos/.test(e.message));
  });
  test('nenhuma tela, ajuda ou manual usa mais "professor do FIC"', () => {
    const fs = require('fs'), path = require('path'); const raiz = path.join(__dirname, '..', '..');
    const arqs = fs.readdirSync(path.join(raiz, 'js')).filter(f => f.endsWith('.js') && f !== 'tudo.js').map(f => path.join(raiz, 'js', f))
      .concat(['gerar.py', 'novo.py', 'extras.py'].map(f => path.join(raiz, 'ferramentas', 'manuais', f)));
    for (const a of arqs) {
      const t = fs.readFileSync(a, 'utf8').replace(/\/\[Pp\]rofessor[^/]*\/g/g, '').replace(/"professor do FIC"/g, '');   // a própria correção e o comentário dela
      assert.doesNotMatch(t, /[Pp]rofessor(es|a)? do FIC|Professor FIC/, path.basename(a));
    }
  });
});
