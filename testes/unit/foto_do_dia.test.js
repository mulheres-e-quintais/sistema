/* 12/10/2026: foto do quintal só vale se foi tirada no dia da visita (EXIF) ou pela câmera do sistema. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');

/* JPEG mínimo com EXIF (II, little endian ou MM, big endian): IFD0 com ponteiro para o IFD do EXIF e DateTimeOriginal */
function jpegComData(data, le = true, tag = 0x9003) {
  const b = []; const u16 = n => le ? [n & 255, n >> 8] : [n >> 8, n & 255]; const u32 = n => le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];
  const txt = [...Buffer.from(data + '\0', 'latin1')];
  const tiff = [...(le ? [0x49, 0x49] : [0x4D, 0x4D]), ...u16(42), ...u32(8),
    ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0),      // IFD0: 1 entrada (ponteiro EXIF → 26)
    ...u16(1), ...u16(tag), ...u16(2), ...u32(txt.length), ...u32(44), ...u32(0), // IFD EXIF em 26: data em 44
    ...txt];
  const app1 = [...Buffer.from('Exif\0\0', 'latin1'), ...tiff];
  b.push(0xFF, 0xD8, 0xFF, 0xE1, ...[(app1.length + 2) >> 8, (app1.length + 2) & 255], ...app1, 0xFF, 0xD9);
  return new Blob([Buffer.from(b)], { type: 'image/jpeg' });
}

describe('Foto do quintal: data de dentro do arquivo', () => {
  test('lê a data em que a foto foi tirada (Android e iPhone gravam em ordens de bytes diferentes)', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    assert.equal(await F.lerDataExif(jpegComData('2026:10:12 08:15:03', true)), '2026-10-12');
    assert.equal(await F.lerDataExif(jpegComData('2026:03:01 17:00:00', false)), '2026-03-01');
    assert.equal(await F.lerDataExif(jpegComData('2026:10:12 08:15:03', true, 0x9004)), '2026-10-12', 'data de digitalização também vale');
  });
  test('sem data no arquivo (WhatsApp, captura de tela, PNG, lixo) → null, sem erro', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    assert.equal(await F.lerDataExif(new Blob([Buffer.from([0xFF, 0xD8, 0xFF, 0xD9])])), null);
    assert.equal(await F.lerDataExif(new Blob([Buffer.from('\x89PNG\r\n\x1a\n')])), null);
    assert.equal(await F.lerDataExif(new Blob([Buffer.from('não é imagem')])), null);
    assert.equal(await F.lerDataExif(jpegComData('0000:00:00 00:00:00')), null);
  });
  test('regra: vale só a foto do dia da visita; foto antiga, sem data ou com data no futuro é recusada com o motivo', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia; const hoje = t.MQ.regras.hoje();
    assert.equal(F.conferir(hoje, hoje), null);
    assert.match(F.conferir('2026-03-01', hoje), /Esta foto é de 01\/03\/2026 e a visita é de .* Só vale foto tirada no dia da visita/);
    assert.match(F.conferir(null, hoje), /Não deu para confirmar quando esta foto foi tirada/);
    assert.match(F.conferir('2099-01-01', '2099-01-01'), /no futuro/);
  });
});
