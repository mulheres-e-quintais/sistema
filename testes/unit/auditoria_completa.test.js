/* v265 — auditoria completa (13/10/2026): regras novas da tela. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

describe('Desligamento: bolsa de mês já começado e sem pedido', () => {
  test('lista os meses do início até hoje que não têm pedido de bolsa (só para quem recebe bolsa)', async () => {
    const t = await montar('coord_geral'); const R = t.MQ.regras;
    const hoje = R.hoje().slice(0, 7);
    const m = { id: 'x1', papel: 'apoio', data_inicio: '2026-09-15' };
    const ms = R.mesesBolsaSemPedido(m, []);
    assert.equal(ms[0], '2026-10', 'começa em outubro/2026 (setembro não tem bolsa)'); assert.equal(ms[ms.length - 1], hoje < '2027-09' ? hoje : '2027-09');
    assert.deepEqual(R.mesesBolsaSemPedido(m, [{ equipe_id: 'x1', tipo: 'bolsa', mes: '2026-10-01' }]).includes('2026-10'), false, 'mês pedido sai da lista');
    assert.equal(JSON.stringify(R.mesesBolsaSemPedido({ id: 'a', papel: 'agente', data_inicio: '2026-09-15' }, [])), '[]', 'agente não tem bolsa');
  });
  test('o formulário de desligar avisa (sem bloquear)', async () => {
    const t = await montar('coord_geral');
    const m = t.S.equipe.find(x => x.papel === 'apoio' && x.status === 'ativa');
    t.S.solic = (t.S.solic || []).filter(s => !(s.equipe_id === m.id && s.tipo === 'bolsa'));   // nenhum pedido de bolsa dela
    const h = t.painel({ tipo: 'detalhe', id: m.id });   // o formulário de desligar fica no cadastro dela
    assert.match(h, /data-form="desligar"/);
    const temPedido = (t.S.solic || []).some(s => s.equipe_id === m.id && s.tipo === 'bolsa' && String(s.mes).slice(0, 7) === t.MQ.regras.hoje().slice(0, 7));
    if (!temPedido) assert.match(h, /data-bolsa-sem-pedido/);
  });
});

describe('Pagamentos: lançamento que só a coordenação geral pode fazer', () => {
  test('a bolsa do próprio auxiliar com aval entra no número da aba da coordenação geral', async () => {
    const t = await montar('coord_geral'); const S = t.S;
    const aux = S.equipe.find(x => x.papel === 'auxiliar_adm' && x.status === 'ativa'); if (!aux || !t.MQ.pagUI) return;
    const antes = t.MQ.pagUI.contaAval();
    (S.solic = S.solic || []).push({ id: 'pg-aux-1', tipo: 'bolsa', equipe_id: aux.id, mes: '2026-10-01', situacao: 'avalizada', valor_solicitado: 1200, valor_avalizado: 1200 });
    assert.equal(t.MQ.pagUI.contaAval(), antes + 1);
    assert.match(texto(t.aba('pagamentos')), /Bolsa do auxiliar: com aval, esperando você lançar no Arlo/);
  });
});

describe('Histórico: 200 por vez, com "carregar mais antigos"', () => {
  test('a demonstração devolve só os anteriores à data pedida', async () => {
    const t = await montar('coord_geral');
    const tudo = await t.api.auditoria(); if (tudo.length < 2) return;
    const corte = tudo[0].em; const antigos = await t.api.auditoria(corte);
    assert.ok(antigos.every(a => String(a.em) < String(corte)));
  });
});
