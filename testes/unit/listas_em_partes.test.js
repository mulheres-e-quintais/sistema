/* Listas inteiras do banco, em partes (js/api-supabase.js).
   O Supabase devolve no máximo 1.000 linhas por pedido e corta o resto sem avisar; o sistema pede de 1.000 em 1.000 até o total. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { carregar } = require('./ambiente');

/* banco de mentira com o mesmo corte do Supabase: no máximo `teto` linhas por pedido, na ordem pedida */
function bancoFalso(tabelas, teto = 1000) {
  const pedidos = [];
  const consulta = (nome, opc) => { const q = { ordem: [], de: 0, ate: Infinity, filtros: [] };
    const api = {
      eq(c, v) { q.filtros.push(x => x[c] === v); return api; }, is(c, v) { q.filtros.push(x => (x[c] == null ? null : x[c]) === v); return api; },
      order(c, o) { q.ordem.push([c, !o || o.ascending !== false]); return api; }, range(a, b) { q.de = a; q.ate = b; return api; },
      then(ok, falha) { pedidos.push({ nome, de: q.de, ate: q.ate, ordem: q.ordem.map(x => x[0]) });
        let l = (tabelas[nome] || []).filter(x => q.filtros.every(f => f(x)));
        l = l.slice().sort((x, y) => { for (const [c, asc] of q.ordem) { if (x[c] < y[c]) return asc ? -1 : 1; if (x[c] > y[c]) return asc ? 1 : -1; } return 0; });
        const total = l.length; l = l.slice(q.de, Math.min(q.ate + 1, q.de + teto));
        return Promise.resolve({ data: l, error: null, count: opc && opc.count ? total : null }).then(ok, falha); } };
    return api; };
  return { pedidos, cliente: { from: nome => ({ select: (cols, opc) => consulta(nome, opc) }), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } } } };
}
async function api(tabelas, teto) {
  const amb = carregar(['dados.js', 'regras.js', 'api-supabase.js']); const b = bancoFalso(tabelas, teto);
  amb.janela.supabase = { createClient: () => b.cliente }; amb.MQ.CONFIG = { supabaseUrl: 'https://x.test', supabaseAnonKey: 'k' };
  try { await amb.MQ.apiSupabase.iniciar(); } catch (e) { /* sem sessão: só precisamos do cliente criado */ }
  return { a: amb.MQ.apiSupabase, pedidos: b.pedidos };
}
const visitas = n => Array.from({ length: n }, (_, i) => ({ id: 'v' + String(i).padStart(5, '0'), data_prevista: '2026-' + String(1 + (i % 12)).padStart(2, '0') + '-10', situacao: 'prevista' }));

describe('listas em partes', () => {
  test('2.500 visitas chegam inteiras, sem repetir nem pular', async () => {
    const { a, pedidos } = await api({ visitas: visitas(2500) });
    const l = await a.listarVisitas();
    assert.equal(l.length, 2500); assert.equal(new Set(l.map(x => x.id)).size, 2500);
    assert.deepEqual(pedidos.filter(p => p.nome === 'visitas').map(p => p.de), [0, 1000, 2000]);
  });
  test('a ordem das partes termina na chave da tabela (várias visitas no mesmo dia)', async () => {
    const { a, pedidos } = await api({ visitas: visitas(1200) });
    await a.listarVisitas();
    assert.deepEqual(pedidos[0].ordem, ['data_prevista', 'id']);
  });
  test('lista pequena faz um pedido só', async () => {
    const { a, pedidos } = await api({ visitas: visitas(37) });
    assert.equal((await a.listarVisitas()).length, 37); assert.equal(pedidos.length, 1);
  });
  test('exatamente 1.000 linhas: um pedido só e nada cortado', async () => {
    const { a, pedidos } = await api({ visitas: visitas(1000) });
    assert.equal((await a.listarVisitas()).length, 1000); assert.equal(pedidos.length, 1);
  });
  test('lista vazia devolve lista vazia', async () => {
    const { a } = await api({ visitas: [] });
    assert.equal((await a.listarVisitas()).length, 0);
  });
  test('se o banco estiver configurado com teto menor (500), ainda assim vem tudo', async () => {
    const { a } = await api({ visitas: visitas(1730) }, 500);
    const l = await a.listarVisitas(); assert.equal(l.length, 1730); assert.equal(new Set(l.map(x => x.id)).size, 1730);
  });
  test('nenhuma lista do banco é pedida sem partes', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../js/api-supabase.js'), 'utf8');
    const soltas = src.split('\n').filter(l => /await sb\.from\('[a-z_]+'\)\.select\(/.test(l) && !/single\(|maybeSingle\(|\.limit\(|head: true|\.eq\('(tipo|chave|equipe_id)'/.test(l) && !/\.(insert|update|upsert|delete)\(/.test(l));
    assert.deepEqual(soltas.map(l => l.trim().slice(0, 90)), []);
  });
});
