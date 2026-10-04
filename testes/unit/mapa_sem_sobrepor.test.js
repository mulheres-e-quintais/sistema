/* Mapa "Onde estão os quintais": com muitas fichas os círculos encolhem juntos e não ficam um por cima do outro;
   com o volume do plano de trabalho (200 quintais) o tamanho é o de sempre. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');

const sobrepostos = (ps, raio) => { let n = 0; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (raio(ps[i].n) + raio(ps[j].n) > Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) + 1e-9) n++; return n; };

describe('tamanho dos círculos do mapa', () => {
  test('poucas fichas: o raio é o de sempre (base + 0,5 × √n)', async () => {
    const { MQ } = await montar('coord_geral'); const esc = 0.1;
    const ps = [{ x: 0, y: 0, n: 7 }, { x: 5, y: 0, n: 2 }, { x: 0, y: 6, n: 1 }]; const r = MQ.painelUI.escalaRaios(ps, esc, 1.0, 0.5, 5.5);
    for (const n of [1, 2, 7, 20]) assert.ok(Math.abs(r(n) - esc * (1 + 0.5 * Math.sqrt(n))) < 1e-9, 'n=' + n);
  });
  test('muitas fichas: o maior círculo respeita o teto e a área continua proporcional', async () => {
    const { MQ } = await montar('coord_geral'); const esc = 0.1;
    const ps = [{ x: 0, y: 0, n: 200 }, { x: 30, y: 0, n: 50 }, { x: 0, y: 30, n: 8 }]; const r = MQ.painelUI.escalaRaios(ps, esc, 1.0, 0.5, 5.5);
    assert.ok(r(200) <= esc * 5.5 + 1e-9); assert.ok(r(200) > r(50) && r(50) > r(8), 'quem tem mais continua maior');
    assert.ok(Math.abs((r(200) - esc) / (r(50) - esc) - 2) < 1e-6, 'a parte variável cresce com a raiz do número');
  });
  const posicao = (ps, raio) => { let n = 0; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (ps[i].r + ps[j].r > Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) + 1e-9) n++; return n; };
  test('municípios vizinhos com muitas fichas: depois de afastados, nenhum círculo cobre o outro', async () => {
    const { MQ } = await montar('coord_geral'); const esc = 0.1;
    const ps = [{ x: 0, y: 0, n: 140 }, { x: 0.45, y: 0.1, n: 140 }, { x: 0.9, y: 0, n: 139 }, { x: 3, y: 2, n: 67 }, { x: 3.4, y: 2.2, n: 66 }, { x: 3, y: 2, n: 5 }];
    assert.ok(sobrepostos(ps, n => esc * (1 + 0.5 * Math.sqrt(n))) >= 3, 'com a regra antiga havia sobreposição');
    const r = MQ.painelUI.escalaRaios(ps, esc, 1.0, 0.5, 5.5); const l = MQ.painelUI.espalhar(ps, r, esc);
    assert.equal(posicao(l), 0); assert.equal(l.length, ps.length);
    assert.ok(l.every((p, i) => p.x0 === ps[i].x && p.y0 === ps[i].y), 'guarda o lugar verdadeiro de cada município');
    assert.ok(l.some(p => p.movido), 'quem saiu do lugar é marcado (ganha o traço)');
    assert.ok(l.every(p => Math.hypot(p.x - p.x0, p.y - p.y0) < esc * 25), 'ninguém vai parar longe do seu lugar');
  });
  test('município isolado não sai do lugar', async () => {
    const { MQ } = await montar('coord_geral'); const esc = 0.1; const ps = [{ x: 0, y: 0, n: 30 }, { x: 40, y: 40, n: 30 }];
    const l = MQ.painelUI.espalhar(ps, MQ.painelUI.escalaRaios(ps, esc, 1.0, 0.5, 5.5), esc);
    assert.ok(l.every(p => !p.movido && Math.abs(p.x - p.x0) < 1e-9 && Math.abs(p.y - p.y0) < 1e-9));
  });
  test('os municípios reais do projeto com 279 fichas por estado: zero sobreposição no mapa dos 5 estados', async () => {
    const { MQ } = await montar('coord_geral'); const ps = []; const sem = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [uf, muns] of Object.entries(MQ.MUNICIPIOS)) { const c = Object.entries((MQ.GEO.mun || {})[uf] || {}).filter(([nome]) => muns.some(m => sem(m) === sem(nome)));
      c.forEach(([, xy]) => ps.push({ x: xy[0], y: -xy[1], n: Math.round(279 / c.length) })); }
    assert.ok(ps.length >= 25, 'achou os municípios: ' + ps.length);
    const xs = ps.map(p => p.x), ys = ps.map(p => p.y), esc = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 100;
    const r = MQ.painelUI.escalaRaios(ps, esc, 1.0, 0.5, 5.5);
    assert.ok(sobrepostos(ps, r) > 0, 'só encolher não resolve: os municípios são vizinhos');
    assert.equal(posicao(MQ.painelUI.espalhar(ps, r, esc)), 0);
  });
  test('legenda de tamanho: 5, 10 e 20 com poucas fichas; valores redondos conforme o maior município', async () => {
    const { MQ } = await montar('coord_geral');
    assert.deepEqual([...MQ.painelUI.marcasTamanho(12)], [5, 10, 20]); assert.deepEqual([...MQ.painelUI.marcasTamanho(140)], [10, 50, 100]); assert.deepEqual([...MQ.painelUI.marcasTamanho(67)], [5, 20, 50]);
  });
  test('sem nenhuma ficha, a função não quebra', async () => {
    const { MQ } = await montar('coord_geral'); assert.ok(MQ.painelUI.escalaRaios([], 0.1, 1, 0.5, 5.5)(4) > 0);
  });
});
