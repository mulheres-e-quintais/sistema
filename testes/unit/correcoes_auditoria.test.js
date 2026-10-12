/* Correções da auditoria de 12/10/2026 (itens 1 a 15): fila do campo, bolsa no valor da função, rascunho do convite
   sem CPF e regra da foto do dia (madrugada, HEIC, foto que volta da fila). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const igual = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);   // objetos vêm de outro contexto (vm)

/* bloco TIFF com DateTimeOriginal, como o EXIF guarda (little endian) */
function tiff(data) {
  const u16 = n => [n & 255, n >> 8], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
  const txt = [...Buffer.from(data + '\0', 'latin1')];
  return [0x49, 0x49, ...u16(42), ...u32(8), ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0),
    ...u16(1), ...u16(0x9003), ...u16(2), ...u32(txt.length), ...u32(44), ...u32(0), ...txt];
}
/* HEIC do iPhone: caixa ftyp, outras caixas e, mais adiante, o item Exif (deslocamento + "Exif\0\0" + TIFF) */
const heic = data => new Blob([Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0, ...Buffer.from('mif1heic'), ...new Array(300).fill(7),
  0, 0, 0, 6, ...Buffer.from('Exif\0\0', 'latin1'), ...tiff(data)])], { type: 'image/heic' });

describe('Foto do dia: buracos da regra (item 15)', () => {
  test('HEIC (iPhone) e PNG com EXIF: a data é lida em vez de recusar sempre', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    igual(await F.lerMomentoExif(heic('2026:10:12 07:40:00')), { dia: '2026-10-12', hora: 7 });
    assert.equal(await F.lerDataExif(heic('2026:10:12 07:40:00')), '2026-10-12');
    const png = new Blob([Buffer.from([0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10, 0, 0, 0, 40, ...Buffer.from('eXIf'), ...tiff('2026:09:30 18:05:00')])]);
    assert.equal(await F.lerDataExif(png), '2026-09-30');
    assert.equal(await F.lerDataExif(new Blob([Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic'), ...new Array(50).fill(0)])])), null, 'HEIC sem EXIF continua sem data');
  });
  test('visita que passa da meia-noite: foto do dia seguinte até as 4h vale; depois das 4h, não', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    assert.equal(F.conferir('2026-10-11', '2026-10-10', 1), null);
    assert.equal(F.conferir('2026-02-01', '2026-01-31', 3), null, 'virada de mês');
    assert.match(F.conferir('2026-10-11', '2026-10-10', 9), /Só vale foto tirada no dia da visita/);
    assert.match(F.conferir('2026-10-11', '2026-10-10', null), /Só vale foto/, 'sem hora não há tolerância');
    assert.match(F.conferir('2026-10-09', '2026-10-10', 1), /Só vale foto/, 'dia anterior nunca');
  });
  test('foto que volta da fila guarda a data e é conferida de novo se a data da visita mudar', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    const mapa = { geral: { size: 10 } }; F.registrarMapa('aval', mapa, () => null);
    F.marcarDias('avaliacao', { ficha_id: 'f9' }, { geral: { dia: '2026-10-10', hora: 9 } });
    igual(F.diasDe('avaliacao', { ficha_id: 'f9' }, mapa), { geral: { dia: '2026-10-10', hora: 9 } });
    const form = data => ({ dataset: { form: 'aval', ficha: 'f9', id: 'a1' }, closest: () => null, querySelector: () => ({ value: data }) });
    assert.equal(F.fotoForaDoDia(form('2026-10-10')), null);
    igual(F.fotoForaDoDia(form('2026-10-08')), { dia: '2026-10-10', hora: 9 });
    F.marcarDias('avaliacao', { ficha_id: 'f9' }, null);   // registro antigo da fila, sem datas: passa
    assert.equal(F.fotoForaDoDia(form('2026-10-08')), null);
  });
});

describe('Fila do campo (itens 1, 3 e 4)', () => {
  test('falha passageira (internet, servidor fora, sessão vencida) é tentada de novo; recusa de regra não', async () => {
    const t = await montar('bolsista'); const P = t.MQ.falhaPassageira;
    assert.equal(P({ semRede: true }), true);
    assert.equal(P({ status: 503 }), true);
    assert.equal(P({ message: 'JWT expired' }), true);
    assert.equal(P(new Error('Failed to fetch')), true);
    assert.equal(P({ status: 400, message: 'A visita é agendada primeiro e marcada como feita depois' }), false);
  });
  test('registro recusado ou tentando de novo aparece para a agente, com o motivo', async () => {
    const t = await montar('bolsista');
    t.S.fila = [
      { id: 'x1', tipo: 'visita', dados: { data_realizada: '2026-10-10' }, erro: 'Conte em poucas linhas o que foi feito.' },
      { id: 'x2', tipo: 'diagnostico', dados: {}, erro: null, tentativas: 2, ultimaFalha: 'Servidor fora do ar' },
      { id: 'x3', tipo: 'avaliacao', dados: {}, erro: null }];
    const h = texto(t.aba(null));
    assert.match(h, /3 registros de campo guardados neste aparelho/);
    assert.match(h, /Não foi aceito: Conte em poucas linhas/);
    assert.match(h, /Tentando enviar de novo \(2 tentativas\)\. Último motivo: Servidor fora do ar/);
  });
  test('memória cheia: mensagem clara, não trava o salvar', async () => {
    const t = await montar('bolsista');
    assert.match(t.MQ.MSG_MEMORIA_CHEIA, /memória do celular está cheia/);
  });
});

describe('Bolsa no valor da função (item 6)', () => {
  test('valor de cada função vem do plano de trabalho; coordenação geral não recebe', async () => {
    const t = await montar('bolsista'); const R = t.MQ.regras;
    assert.equal(R.valorBolsa('articulacao'), 2200); assert.equal(R.valorBolsa('coord_tecnico'), 4700);
    assert.equal(R.valorBolsa('apoio'), 1600); assert.equal(R.valorBolsa('auxiliar_adm'), 1200); assert.equal(R.valorBolsa('coord_geral'), null);
  });
  test('pedido com outro valor é recusado; aval não passa do valor da função', async () => {
    const t = await montar('bolsista'); const rel = 'Relatório do mês com as visitas, os encontros e o que foi feito no campo.';
    const mes = t.MQ.regras.hoje().slice(0, 7) + '-01';
    await assert.rejects(t.api.solicitarPagamento('bolsa', mes, 5000, rel, [], {}), /2\.200,00 por mês/);
    const id = await t.api.solicitarPagamento('bolsa', mes, 2200, rel, [], {});
    await t.trocar('coord_tecnico');
    await assert.rejects(t.api.avalizarPagamento(id, true, null, 2300), /passa do valor pedido|valor da função/);
  });
});

describe('Rascunho do convite sem dados pessoais (item 11)', () => {
  test('CPF, NIS, nascimento, endereço, renda e raça nunca vão para o rascunho do convite', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/convites.js'), 'utf8');
    for (const k of ['cpf', 'nis', 'data_nascimento', 'cep', 'logradouro', 'renda_familiar', 'raca_etnia', 'siape']) assert.ok(new RegExp("NAO_GUARDA = \\[[^\\]]*'" + k + "'").test(src), k + ' não vai para o rascunho');
    assert.match(src, /r\.v !== 2 \|\| !\(Date\.now\(\) - \(r\.em \|\| 0\) < RASC_CONV_VALIDADE\)\) localStorage\.removeItem/, 'rascunho antigo (com CPF) ou vencido sai do aparelho');
  });
});
