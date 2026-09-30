/* 30/09/2026: mapa da página pública e da entrada (municípios, Apodi, rotas, cores) e mosaico de retratos. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const MUNICIPIOS = { AL: 3, SE: 3, PI: 10, BA: 8, PE: 5 };   // tabela dos territórios do MPA
test('mapa: os 29 municípios, Apodi (sede) e uma rota de Apodi até cada município', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs();
  assert.equal((h.match(/class="mun-pt"/g) || []).length, 29);
  assert.equal((h.match(/class="rota"/g) || []).length, 29);
  assert.ok(/sede-pt/.test(h) && /Apodi\/RN/.test(h));
  for (const [uf, n] of Object.entries(MUNICIPIOS)) assert.ok(new RegExp(`${uf} <span class="lg-mun">${n} municípios</span>`).test(h), uf + ' com ' + n);
  assert.ok(/RN <span class="muted">sede \(Apodi\)<\/span>/.test(h));
});
test('mapa: cada estado com a sua cor e a sigla escrita; legenda sem contagem de mulheres', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs();
  for (const uf of ['PI', 'PE', 'BA', 'SE', 'AL']) { assert.ok(h.includes(`fill:var(--uf-${uf})`)); assert.ok(new RegExp(`class="uf-sigla"[^>]*>${uf}<`).test(h)); }
  const leg = h.slice(h.indexOf('<ul class="mapa-lista">'));
  assert.ok(!/mulher/.test(leg), 'legenda sem "mulheres"');
  assert.ok(!/Cor do estado|a partir de Apodi/.test(h));
});
test('mapa: nenhum estado cortado (o quadro contém o PI, a BA, os outros e o RN inteiros)', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs();
  const [x, y, w, hh] = /viewBox="([^"]+)"/.exec(h)[1].split(' ').map(Number);
  const K = Math.cos(9.5 * Math.PI / 180);
  for (const uf of ['PI', 'PE', 'BA', 'SE', 'AL', 'RN']) t.MQ.GEO.uf[uf].r.forEach(anel => anel.forEach(([lon, lat]) => {
    const px = lon * K, py = -lat; assert.ok(px >= x - 1e-6 && px <= x + w + 1e-6 && py >= y - 1e-6 && py <= y + hh + 1e-6, uf + ' fora do quadro em ' + lon + ',' + lat); }));
});

test('mapa: nem a dica do estado nem o leitor de tela falam em mulheres; legenda em ordem fixa (mais municípios primeiro)', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs();
  assert.ok(!/mulher/i.test(h), 'o mapa não fala em mulheres (nem em <title> nem em aria-label)');
  assert.ok(/<title>Piauí: 10 municípios<\/title>/.test(h), 'dica do PI mostra os municípios');
  assert.ok(/aria-label="Mapa dos estados do projeto: [^"]*PI 10 municípios/.test(h));
  const ordem = [...h.matchAll(/<li><span class="lg-q" style="background:var\(--uf-(\w\w)\)/g)].map(m => m[1]);
  assert.deepEqual(ordem, ['PI', 'BA', 'PE', 'AL', 'SE']);
});

test('situação que o sistema ainda não conhece não derruba a tela (viagens e pagamentos)', async () => {
  const t = await montar('coord_geral'); const S = t.MQ.ui.S;
  S.pedidos = [{ id: 'p1', tipo: 'passagem', uf: 'PI', solicitante_id: S.eu.id, titulo: 'Reunião', data_ref: '2027-03-10', dados: { valor_estimado: 1 }, situacao: 'situacao_nova<b>' }];
  S.solicitacoes = [{ id: 's1', tipo: 'bolsa', equipe_id: S.eu.id, mes: '2026-10-01', situacao: 'outra_nova', valor_solicitado: 1 }];
  let hv, hp; assert.doesNotThrow(() => { hv = t.MQ.viagUI.abaCoord(); });
  assert.doesNotThrow(() => { hp = t.MQ.pagUI.abaCoord(); });
  assert.ok(!/situacao_nova<b>/.test(hv + hp), 'nada entra cru na tela');
  const b = await montar('bolsista'); b.MQ.ui.S.pedidos = [Object.assign({}, S.pedidos[0], { solicitante_id: b.MQ.ui.S.eu.id, uf: b.MQ.ui.S.eu.uf })];
  let hb; assert.doesNotThrow(() => { hb = b.MQ.viagUI.secaoBolsista(); });
  assert.ok(/situacao_nova&lt;b&gt;/.test(hb), 'na lista de quem pediu aparece a situação crua, escapada');
});

test('carregando: mulher regando (sem a palavra na tela, mas o leitor de tela ouve "Carregando"); RN com sigla própria', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.ampulheta(); const g = t.MQ.ampulheta(true);
  assert.ok(/role="status"/.test(h) && /aria-label="Carregando"/.test(h));
  assert.equal((h.match(/class="gota/g) || []).length, 3, 'três gotas caindo');
  assert.ok(!/>\s*Carregando/.test(h), 'sem a palavra visível');
  assert.ok(/class="ampulheta grande"/.test(g));
  assert.ok(/class="uf-sigla sigla-sede"[^>]*>RN</.test(t.MQ.painelUI.mapaUFs()));
});

test('o carregando da abertura (index.html) é o mesmo desenho do sistema: sem cópia antiga esquecida', async () => {
  const t = await montar('coord_geral');
  const h = require('fs').readFileSync(require('path').join(__dirname, '../../index.html'), 'utf8');
  assert.ok(h.includes(t.MQ.ampulheta(true)), 'index.html precisa ter exatamente MQ.ampulheta(true)');
});

test('mapa da tela de entrada: sem legenda, número de cidades em cada estado, rotas marcadas para sair de Apodi', async () => {
  const t = await montar('coord_geral'); const h = t.MQ.painelUI.mapaUFs({ entrada: true, animar: true });
  assert.ok(!/mapa-lista/.test(h), 'sem legenda');
  for (const [uf, n] of Object.entries({ PI: 10, BA: 8, PE: 5, AL: 3, SE: 3 })) assert.ok(new RegExp(`class="uf-sigla uf-num[^"]*"[^>]*>${n} cidades<`).test(h), uf + ' com ' + n + ' cidades');
  assert.ok(/class="mapa mapa-pub saindo"/.test(h)); assert.equal((h.match(/--len:\d/g) || []).length, 29, 'comprimento de cada rota para desenhar');
  const pub = t.MQ.painelUI.mapaUFs(); assert.ok(/mapa-lista/.test(pub) && !/uf-num/.test(pub) && !/saindo/.test(pub), 'página pública continua com a legenda');
});
