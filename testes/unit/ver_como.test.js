/* v268 — "Ver como o MDA vê" / "Ver como o MPA vê" em tela inteira (14/10/2026, modelo do Saberes que Cultivam) */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

describe('Ver como o MDA/MPA vê', () => {
  test('a tela de quem acompanha ganha a faixa da prévia, sem o botão de sair, com o nome da prévia', async () => {
    const t = await montar('coord_geral');
    t.S.verComo = { orgao: 'mda', dados: await t.api.dadosAcompanhamento('mda') };
    const h = t.MQ.acompUI.pagina();
    assert.match(h, /class="ac-faixa-previa"/);
    assert.match(texto(h), /É assim que o MDA vê o sistema/);
    assert.match(h, /data-acao="acomp-voltar"/); assert.match(h, /data-acao="acomp-previa" data-o="mpa"/);
    assert.doesNotMatch(h, /btn-sair/);
    assert.match(texto(h), /O projeto em números/); assert.match(texto(h), /Prévia da coordenação/);
  });
  test('sem a prévia, a tela de quem acompanha não tem a faixa', async () => {
    const t = await montar('obs_mpa');
    assert.doesNotMatch(t.MQ.acompUI.pagina(), /ac-faixa-previa/);
  });
});
