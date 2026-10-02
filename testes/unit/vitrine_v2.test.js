/* 01/10/2026: vitrine 2.0 — 3 indicadores, círculos por município (com proteção), narrativa da página pública, login */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

test('vitrine por município: só totais; menos de 3 sem o número; nenhuma situação individual', async () => {
  const t = await montar('coord_geral'); const d = await t.api.vitrine();
  assert.ok(Array.isArray(d.municipios) && d.municipios.length > 0);
  for (const m of d.municipios) { assert.deepEqual(Object.keys(m).sort().join(), 'menos_de_3,municipio,n,uf'); if (m.menos_de_3) assert.equal(m.n, null); else assert.ok(m.n >= 3); }
  assert.ok(!JSON.stringify(d.municipios).match(/nome|cpf|lista_espera|sem_agua|selecionada/), 'sem nome nem situação');
});
test('mapa público: círculo proporcional por município, vazado onde ainda não há cadastro, legenda do tamanho', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.painelUI;
  const h = P.mapaUFs({ entrada: true, municipios: [{ uf: 'PI', municipio: 'Paulistana', n: 7, menos_de_3: false }, { uf: 'PI', municipio: 'Pio IX', n: null, menos_de_3: true }] });
  assert.match(h, /Paulistana\/PI · 7 mulheres cadastradas/); assert.match(h, /Pio IX\/PI · menos de 3 mulheres cadastradas/);
  assert.match(h, /class="mun-n">7</); assert.ok(!/class="mun-n">2</.test(h), 'menos de 3 não mostra número');
  assert.equal((h.match(/class="mun-pt mun-q"/g) || []).length, 2); assert.equal((h.match(/class="mun-pt mun-prev"/g) || []).length, 27, 'os outros 27 municípios previstos');
  assert.match(h, /Cada círculo representa um município\. O tamanho indica o número de mulheres cadastradas\./); assert.match(h, /Município previsto, ainda sem cadastro/);
  assert.match(P.mapaUFs({ entrada: true }), /Cada ponto representa 1 município atendido/, 'servidor sem o script 40: volta aos pontos');
});
test('login: no mapa da entrada todos os municípios são pontos fixos e iguais, com ou sem cadastro (02/10/2026)', async () => {
  const t = await montar('coord_geral'); t.S.verEntrada = true; t.S.modoLogin = 'entrar'; t.MQ.ui.render(); await new Promise(r => setTimeout(r, 60)); const h = t.html();
  const mapa = h.slice(h.indexOf('class="mapa mapa-pub'), h.indexOf('</svg>', h.indexOf('class="mapa mapa-pub')));
  assert.equal((mapa.match(/class="mun-pt"/g) || []).length, 29, 'os 29 municípios do projeto');
  assert.ok(!/mun-q|mun-prev|mun-vazio|class="mun-n"/.test(mapa), 'sem círculo por número de cadastradas e sem ponto vazado');
  assert.ok(!/O tamanho indica o número de mulheres cadastradas/.test(h)); assert.match(h, /Cada ponto representa 1 município atendido/);
});
test('login: frase do projeto mantida e mensagem curta', async () => {
  const t = await montar('coord_geral'); t.S.verEntrada = true; t.S.modoLogin = 'entrar'; t.MQ.ui.render(); const x = texto(t.html());
  assert.match(x, /O quintal\s*nunca\s*foi pouco/); assert.match(x, /É onde produção, renda e autonomia começam/); assert.match(x, /Mulheres rurais de cinco estados do Nordeste/);
});
test('página pública: narrativa em ordem (números, onde, estados, mulheres, informações, instituições)', async () => {
  const t = await montar('coord_geral'); t.MQ.vitrineUI.pagina(); await new Promise(r => setTimeout(r, 50));
  const h = t.MQ.vitrineUI.pagina(); const x = texto(h);
  assert.equal((h.match(/class="vt-l"/g) || []).length, 3, 'três indicadores');
  const ordem = ['O projeto em números', 'Onde estão os quintais', 'Distribuição por estado', 'Como o projeto anda', 'Instituições'].map(s => x.indexOf(s));
  assert.ok(ordem.every(i => i >= 0), JSON.stringify(ordem)); assert.ok(ordem.every((v, i) => !i || v > ordem[i - 1]), 'ordem ' + JSON.stringify(ordem));
});
