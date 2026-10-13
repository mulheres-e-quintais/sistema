/* 12/10/2026: registros parados nos celulares (58), prontidão para o campo e cópia dos dados (.xlsx). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const { montar, texto } = require('./telas');

describe('Registros parados nos celulares', () => {
  test('o celular informa só a contagem: quantos, desde quando, quantos recusados', async () => {
    const t = await montar('agente'); const P = t.MQ.prontidaoUI;
    const r = P.resumoFila([{ tipo: 'visita', criado: Date.parse('2026-10-10T12:00:00Z'), dados: { relato: 'segredo' } }, { tipo: 'diagnostico', criado: Date.parse('2026-10-11T12:00:00Z'), erro: 'recusado' }]);
    assert.deepEqual(JSON.parse(JSON.stringify(r)), { qtd: 2, recusados: 1, mais_antigo: '2026-10-10T12:00:00.000Z' });
    assert.doesNotMatch(JSON.stringify(r), /segredo/, 'nada do conteúdo sai do celular');
    assert.deepEqual(JSON.parse(JSON.stringify(P.resumoFila([]))), { qtd: 0, recusados: 0, mais_antigo: null });
  });
  test('a coordenação vê quem tem registro parado e desde quando; a técnica vê a equipe de campo', async () => {
    const t = await montar('agente'); const ag = t.S.eu;
    await t.api.informarFila({ qtd: 3, recusados: 1, mais_antigo: new Date(Date.now() - 4 * 864e5).toISOString() });
    await t.trocar('coord_geral');
    const h = texto(t.aba('visao'));
    assert.match(h, /Situação do campo em cada estado/);
    assert.match(h, new RegExp(ag.nome.split(' ')[0] + '.*3 registros guardados no celular desde'));
    assert.match(h, /1 recusado pelo servidor/); assert.match(h, /Último contato com internet/);
    await t.trocar('coord_tecnico');
    assert.match(texto(t.aba('campo')), /Registros que ainda não foram enviados/);
    await t.trocar('bolsista'); assert.equal((await t.api.listarFilaCelular()).length, 0, 'bolsista não vê a fila dos outros');
  });
  test('sem o script 58 no banco, a tela pede para rodar (nunca diz "nenhum parado" sem saber)', async () => {
    const t = await montar('coord_geral'); t.S.filaCelularSemBanco = true;
    assert.match(texto(t.aba('visao')), /rode no Supabase o arquivo 58_fila_nos_celulares\.sql/);
    assert.doesNotMatch(texto(t.aba("visao")), /Nenhum registro esperando envio/);
  });
});

describe('Prontidão para o campo', () => {
  test('por estado: equipe habilitada, fichas aprovadas, diagnósticos e visitas da semana', async () => {
    const t = await montar('coord_geral'); const P = t.MQ.prontidaoUI;
    const uf = t.S.equipe.find(m => m.papel === 'agente' && m.status === 'ativa').uf;
    const d = P.porUF(uf);
    assert.ok(d.eq >= 1 && d.hab <= d.eq && d.fichas >= 0 && d.prox >= 0);
    const h = texto(t.aba('visao'));
    assert.match(h, /Coordenação técnica:/); assert.match(h, /Professores do FIC:/);
  });
  test('a técnica não vê a linha da coordenação (só a geral)', async () => {
    const t = await montar('coord_tecnico');
    assert.doesNotMatch(texto(t.aba('campo')), /Professores do FIC:/);
  });
});

describe('Cópia dos dados (.xlsx)', () => {
  test('planilha sem conta bancária nem segredos; uma aba por assunto', async () => {
    const t = await montar('coord_geral'); const P = t.MQ.prontidaoUI;
    const tab = P.tabela([{ nome: 'Ana', banco: '001', agencia: '1234', conta: '9-9', pix: 'x', senha: 'y', _fila: true, dados: { a: 1 }, n: 5 }]);
    assert.deepEqual(JSON.parse(JSON.stringify(tab[0])), ['nome', 'dados', 'n']);
    assert.deepEqual(JSON.parse(JSON.stringify(tab[1])), ['Ana', '{"a":1}', 5]);
    const abas = P.abasDaCopia().map(a => a[0]);
    for (const n of ['Equipe', 'Fichas', 'Visitas', 'Diagnosticos', 'Avaliacoes', 'Pagamentos']) assert.ok(abas.includes(n), n);
  });
  test('o arquivo é um .xlsx válido (zip com as partes da planilha e CRC certo)', async () => {
    const t = await montar('coord_geral'); const P = t.MQ.prontidaoUI;
    const bytes = Buffer.from(P.montarXlsx([['Teste', [['nome', 'valor'], ['Ação & <teste>', 12.5], ['', true]]]]));
    assert.equal(bytes.readUInt32LE(0), 0x04034b50, 'começa como zip');
    const s = bytes.toString('latin1');
    for (const parte of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(s.includes(parte), parte);
    assert.equal(P.crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'CRC-32 padrão');
    fs.writeFileSync(path.join(os.tmpdir(), 'mq_copia_teste.xlsx'), bytes);   // conferido também com o openpyxl (Python) na revisão
  });
});
