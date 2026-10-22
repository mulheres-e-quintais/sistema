/* 22/10/2026: na Visão geral, quadro sem dado nenhum não aparece (evita poluição visual); volta sozinho quando houver dado. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('sem fichas, diagnósticos, equipe, água, pendências e registros parados: os quadros vazios somem', async () => {
  const t = await montar('coord_geral'); const S = t.S;
  S.fichas = []; S.diagnosticos = []; S.visitas = []; S.agua = []; S.filaCelular = []; S.pre = []; S.pedidosAcesso = [];
  S.equipe = S.equipe.filter(m => m.papel === 'coord_geral');
  const h = t.aba('visao'); const x = texto(h);
  assert.doesNotMatch(x, /Onde estão os quintais produtivos/, 'mapa sem nenhuma ficha');
  assert.doesNotMatch(x, /Quem são as mulheres/, 'perfil sem selecionadas nem diagnóstico');
  assert.doesNotMatch(x, /Quem é a equipe de execução/, 'equipe sem ninguém ativo');
  assert.doesNotMatch(x, /Acesso à água/, 'água sem ninguém com necessidade');
  assert.doesNotMatch(x, /Nenhum registro esperando envio/, 'registros parados: nada');
  assert.match(x, /Execução do projeto/); assert.match(x, /Metas do plano de trabalho/); assert.match(x, /Cronograma físico/);
});
test('com dados, os quadros aparecem', async () => {
  const t = await montar('coord_geral'); const x = texto(t.aba('visao'));
  assert.match(x, /Quem é a equipe de execução/); assert.match(x, /O que pede atenção/);
  if ((t.S.fichas || []).length) assert.match(x, /Onde estão os quintais produtivos/);
});
