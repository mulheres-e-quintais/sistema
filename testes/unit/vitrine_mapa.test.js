/* 30/09/2026: mapa da página pública e da entrada (municípios, Apodi, rotas, cores) e mosaico de retratos. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const MUNICIPIOS = { AL: 3, SE: 3, PI: 10, BA: 8, PE: 5 };   // tabela dos territórios do MPA
test('mapa: os 29 municípios, Apodi (sede) e uma rota de Apodi até cada município', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs({ PI: 3 }, 'mulheres selecionadas');
  assert.equal((h.match(/class="mun-pt"/g) || []).length, 29);
  assert.equal((h.match(/class="rota"/g) || []).length, 29);
  assert.ok(/sede-pt/.test(h) && /Apodi\/RN/.test(h));
  for (const [uf, n] of Object.entries(MUNICIPIOS)) assert.ok(new RegExp(`${uf} <span class="lg-mun">${n} municípios</span>`).test(h), uf + ' com ' + n);
  assert.ok(/RN <span class="muted">sede \(Apodi\)<\/span>/.test(h));
});
test('mapa: cada estado com a sua cor e a sigla escrita; legenda sem contagem de mulheres', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs({ PI: 3, BA: 1 }, 'mulheres selecionadas');
  for (const uf of ['PI', 'PE', 'BA', 'SE', 'AL']) { assert.ok(h.includes(`fill:var(--uf-${uf})`)); assert.ok(new RegExp(`class="uf-sigla"[^>]*>${uf}<`).test(h)); }
  const leg = h.slice(h.indexOf('<ul class="mapa-lista">'));
  assert.ok(!/mulher/.test(leg), 'legenda sem "mulheres"');
  assert.ok(!/Cor do estado|a partir de Apodi/.test(h));
});
test('mapa: nenhum estado cortado (o quadro contém o PI, a BA, os outros e o RN inteiros)', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs({}, 'x');
  const [x, y, w, hh] = /viewBox="([^"]+)"/.exec(h)[1].split(' ').map(Number);
  const K = Math.cos(9.5 * Math.PI / 180);
  for (const uf of ['PI', 'PE', 'BA', 'SE', 'AL', 'RN']) t.MQ.GEO.uf[uf].r.forEach(anel => anel.forEach(([lon, lat]) => {
    const px = lon * K, py = -lat; assert.ok(px >= x - 1e-6 && px <= x + w + 1e-6 && py >= y - 1e-6 && py <= y + hh + 1e-6, uf + ' fora do quadro em ' + lon + ',' + lat); }));
});
