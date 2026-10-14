/* v267 — cronograma físico do plano de trabalho na Visão geral (14/10/2026) */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

describe('Visão geral: cronograma físico', () => {
  test('uma linha por meta, com período, número, situação e o traço de hoje', async () => {
    const t = await montar('coord_geral');
    const h = t.aba('visao');
    assert.match(h, /Cronograma físico do plano de trabalho/);
    assert.equal((h.match(/class="cg-linha /g) || []).length, t.MQ.METAS.length);
    for (const m of t.MQ.METAS) assert.match(h, new RegExp(`class="cg-nome" data-meta-ir="${m.id}"`));
    assert.match(h, /--cg-hoje:\d/);
    const tx = texto(h);
    for (const l of ['período da meta', 'já registrado', 'ainda não começou', 'prazo vencido', 'hoje']) assert.ok(tx.includes(l), l);
  });
  test('o leitor de tela ouve a meta inteira por extenso, e a barra é só desenho', async () => {
    const t = await montar('coord_geral');
    const h = t.aba('visao');
    assert.match(h, /aria-label="Meta 2, Diagnósticos socioeconômicos e ambientais: de outubro de 2026 a janeiro de 2027\. /);
    assert.match(h, /class="cg-trilho" aria-hidden="true"/);
  });
  test('meta que ainda não começou fica tracejada; meta fora do sistema não inventa número', async () => {
    const t = await montar('coord_geral');
    const h = t.MQ.painelUI.cronograma(t.S, { aptas: [], pagaveis: [], fichas: [], selAprov: [] }, 2);
    assert.match(h, /cg-linha cg-futuro[\s\S]*?data-meta-ir="M8"/);
    assert.match(h, /data-meta-ir="M5"[\s\S]*?<b>—<\/b> de 5/);
  });
});
