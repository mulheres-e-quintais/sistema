/* Aba Documentos (js/documentos.js) e as regras do modo demonstração que espelham supabase/24_documentos.sql:
   validação do anexo, arquivamento, relatório da ação e quem pode ver (só a coordenação geral). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar, diaMais, simples } = require('./ambiente');
const { montar, abasDe, texto } = require('./telas');

const docs = () => carregar(['dados.js', 'regras.js', 'documentos.js'], { ui: { S: {}, esc: s => String(s), nomeUF: u => u } }).MQ.docsUI;
const arq = (nome, size = 1000) => ({ name: nome, size, type: '' });
const base = (o = {}) => Object.assign({ tipo: 'ata', titulo: 'Ata da reunião com o MPA', data_documento: diaMais(-1), uf: null, descricao: null }, o);

describe('validarDocumento', () => {
  test('documento completo não tem erro', () => assert.deepEqual(simples(docs().validarDocumento(base(), arq('ata.pdf'))), {}));
  test('tudo vazio: tipo, título, data e arquivo', () =>
    assert.deepEqual(simples(Object.keys(docs().validarDocumento({}, null)).sort()), ['arquivo', 'data_documento', 'tipo', 'titulo']));
  test('tipo inventado e título curto são recusados', () => {
    const e = docs().validarDocumento(base({ tipo: 'meme', titulo: 'Ata' }), arq('a.pdf'));
    assert.ok(e.tipo); assert.ok(e.titulo);
  });
  test('data de hoje aceita; amanhã recusada', () => {
    assert.equal(docs().validarDocumento(base({ data_documento: diaMais(0) }), arq('a.pdf')).data_documento, undefined);
    assert.ok(docs().validarDocumento(base({ data_documento: diaMais(1) }), arq('a.pdf')).data_documento);
  });
  test('extensões aceitas (maiúsculas também) e recusadas', () => {
    ['a.pdf', 'b.DOCX', 'c.xlsx', 'd.odt', 'e.JPG', 'f.png'].forEach(n => assert.equal(docs().validarDocumento(base(), arq(n)).arquivo, undefined, n));
    ['a.exe', 'b.zip', 'c.html', 'semextensao'].forEach(n => assert.ok(docs().validarDocumento(base(), arq(n)).arquivo, n));
  });
  test('tamanho: 20 MB exatos aceitos; 1 byte a mais e arquivo vazio recusados', () => {
    const D = docs(); const MB20 = 20 * 1024 * 1024;
    assert.equal(D.validarDocumento(base(), arq('a.pdf', MB20)).arquivo, undefined);
    assert.match(D.validarDocumento(base(), arq('a.pdf', MB20 + 1)).arquivo, /20 MB/);
    assert.match(D.validarDocumento(base(), arq('a.pdf', 0)).arquivo, /vazio/);
  });
  test('estado inválido e descrição com mais de 2.000 letras são recusados', () => {
    const e = docs().validarDocumento(base({ uf: 'CE', descricao: 'x'.repeat(2001) }), arq('a.pdf'));
    assert.ok(e.uf); assert.ok(e.descricao);
  });
});

describe('dados do relatório', () => {
  const S = () => ({
    equipe: [
      { id: 'g', papel: 'coord_geral', status: 'ativa' },
      { id: 't', papel: 'coord_tecnico', status: 'ativa', matricula_fic_em: '2026-09-20', docs_funcern_em: 'x', termo_assinado_em: 'x' },
      { id: 'a', papel: 'articulacao', uf: 'PI', status: 'ativa' },
      { id: 'b', papel: 'apoio', uf: 'BA', status: 'ativa', matricula_fic_em: '2026-09-21' },
      { id: 'c', papel: 'agente', uf: 'PI', status: 'desligada', data_fim: '2026-09-25' }],
    fichas: [
      { uf: 'PI', resultado: 'selecionada', situacao: 'aprovada', nome: 'Maria Secreta Silva' },
      { uf: 'PI', resultado: 'lista_espera', situacao: 'aprovada' },
      { uf: 'BA', resultado: 'sem_agua', situacao: 'aguardando' }],
    visitas: [
      { uf: 'PI', etapa: 'diagnostico', situacao: 'realizada', data_realizada: '2026-10-10' },
      { uf: 'PI', etapa: 'diagnostico', situacao: 'realizada', data_realizada: '2027-01-10' },   // fora do período
      { uf: 'BA', etapa: 'implantacao', situacao: 'prevista', data_prevista: '2026-10-11' }],
    solic: [{ situacao: 'lancada', valor_avalizado: 1100, solicitada_em: '2026-10-05T10:00:00Z' }, { situacao: 'solicitada', valor_solicitado: 50, solicitada_em: '2026-10-06T10:00:00Z' }],
    pedidos: [{ tipo: 'passagem', uf: 'PI', situacao: 'autorizado', enviado_em: '2026-10-02T10:00:00Z', dados: { passageiros: [{}, {}] } }],
    documentos: [{ tipo: 'ata', titulo: 'Ata 1', data_documento: '2026-10-01' }, { tipo: 'ata', titulo: 'Ata arquivada', data_documento: '2026-10-01', arquivado_em: 'x' }],
    turmas: [{}]
  });
  const f = { de: '2026-09-14', ate: '2026-12-31' };
  test('conta equipe ativa (sem a coordenação geral), habilitadas e desligamentos no período', () => {
    const r = docs().dadosRelatorio(S(), f);
    assert.equal(r.equipe.ativos, 3); assert.equal(r.equipe.habilitados, 1); assert.equal(r.equipe.desligados, 1);
  });
  test('seleção por estado e total de selecionadas aprovadas', () => {
    const r = docs().dadosRelatorio(S(), f); const pi = r.selecao.find(x => x.uf === 'PI');
    assert.equal(pi.lancadas, 2); assert.equal(pi.selecionadas, 1); assert.equal(pi.espera, 1); assert.equal(r.totalSelecionadas, 1);
  });
  test('campo conta só visitas feitas dentro do período', () => {
    const r = docs().dadosRelatorio(S(), f);
    assert.equal(r.visitasFeitas, 1); assert.equal(r.campo.find(x => x.etapa === 'diagnostico').n, 1);
  });
  test('FIC conta quem faz o curso (inclui a coordenação técnica) e quem já tem matrícula', () => {
    const r = docs().dadosRelatorio(S(), f);
    assert.equal(r.fic.fazem, 3); assert.equal(r.fic.matriculadas, 2);
  });
  test('pagamentos lançados, passagens por pessoa e documentos não arquivados', () => {
    const r = docs().dadosRelatorio(S(), f);
    assert.equal(r.pagamentos.lancados, 1); assert.equal(r.pagamentos.valorLancado, 1100);
    assert.equal(r.viagens.passagens, 2);
    assert.deepEqual(simples(r.documentos.map(d => d.titulo)), ['Ata 1']);
  });
  test('filtro por estado (BA) deixa de fora o Piauí', () => {
    const r = docs().dadosRelatorio(S(), Object.assign({ uf: 'BA' }, f));
    assert.deepEqual(simples(r.selecao.map(x => x.uf)), ['BA']); assert.equal(r.visitasFeitas, 0); assert.equal(r.viagens.pedidos, 0);
  });
  test('sistema vazio não quebra: tudo zero', () => {
    const r = docs().dadosRelatorio({}, {});
    assert.equal(r.equipe.ativos, 0); assert.equal(r.visitasFeitas, 0); assert.equal(r.documentos.length, 0);
    assert.equal(r.periodo.de, '2026-09-14');   // sem período: do início da vigência até hoje
  });
  test('o texto do relatório tem as 7 partes e nunca o nome das mulheres', () => {
    const D = docs(); const h = D.htmlRelatorio(D.dadosRelatorio(S(), f), 'Cleone Lima');
    ['1. Equipe', '2. Seleção', '3. Trabalho de campo', '4. Curso FIC', '5. Pagamentos', '6. Viagens', '7. Documentos'].forEach(x => assert.ok(h.includes(x), x));
    assert.ok(!h.includes('Maria Secreta Silva'));
    assert.ok(/R\$\s?1\.100,00/.test(h));
  });
});

describe('modo demonstração: só a coordenação geral', () => {
  const doc = () => ({ name: 'ata.pdf', size: 10, type: 'application/pdf' });
  test('coordenação geral anexa, lista e arquiva com motivo; arquivado não se arquiva de novo', async () => {
    const t = await montar('coord_geral');
    const d = await t.api.enviarDocumento(base(), doc());
    assert.equal((await t.api.listarDocumentos()).length, 1);
    await assert.rejects(t.api.arquivarDocumento(d.id, 'ab'), /motivo/);
    await t.api.arquivarDocumento(d.id, 'Versão errada');
    await assert.rejects(t.api.arquivarDocumento(d.id, 'De novo'), /já está arquivado/);
  });
  test('anexo inválido é recusado também no servidor da demonstração', async () => {
    const t = await montar('coord_geral');
    await assert.rejects(t.api.enviarDocumento(base({ titulo: 'Ata' }), doc()), /título/);
  });
  for (const p of ['coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) test(`${p}: não anexa, não lista e não tem a aba`, async () => {
    const t = await montar('coord_geral'); await t.api.enviarDocumento(base(), doc());
    await t.trocar(p);
    await assert.rejects(t.api.enviarDocumento(base(), doc()), /Só a coordenação geral/);
    assert.equal((await t.api.listarDocumentos()).length, 0);
    const h = t.aba('documentos');
    assert.ok(!abasDe(h).includes('documentos')); assert.ok(!texto(h).includes('Documentos do projeto'));
  });
  test('coordenação geral: a aba mostra anexar e gerar relatório', async () => {
    const t = await montar('coord_geral'); const antes = t.aba('documentos');
    assert.ok(antes.includes('data-carregando-aba'), 'os documentos só são buscados quando a aba abre');
    await t.MQ.ui.carregarDaAba(); const h = t.aba('documentos');
    assert.ok(abasDe(h).includes('documentos'));
    assert.ok(h.includes('data-acao="doc-novo"')); assert.ok(h.includes('data-acao="doc-relatorio"'));
    const rel = t.painel({ tipo: 'doc-relatorio' });
    assert.ok(texto(rel).includes('Relatório da ação do projeto')); assert.ok(rel.includes('data-acao="doc-rel-word"'));
  });
});
