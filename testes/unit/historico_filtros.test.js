/* v270 — Histórico mesclado com o do Saberes que Cultivam (14/10/2026): filtros, "ver o que mudou" com campos protegidos, planilha */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

describe('Histórico: filtros e o que mudou', () => {
  test('a alteração mostra campo a campo o que mudou, mas esconde CPF, conta e telefone', async () => {
    const t = await montar('coord_geral'); const S = t.S; const eu = S.eu; S.veio = { de: eu.id, aud: true };
    S.aud = [{ id: 'h1', em: new Date().toISOString(), por: eu.id, tabela: 'fichas', acao: 'UPDATE', registro_id: 'f1',
      antes: { id: 'f1', nome: 'Maria', comunidade: 'Sítio Velho', cpf: '11122233344', telefone: '84999990000', atualizado_em: 'a' },
      depois: { id: 'f1', nome: 'Maria', comunidade: 'Sítio Novo', cpf: '55566677788', telefone: '84988887777', atualizado_em: 'b' } }];
    const h = t.aba('historico');
    assert.match(h, /O que mudou \(3\)/);
    assert.match(texto(h), /comunidade\s*:?\s*Sítio Velho\s*→\s*Sítio Novo/);
    assert.doesNotMatch(h, /11122233344|55566677788|84999990000|84988887777/);
    assert.match(texto(h), /cpf\s*:?\s*alterado \(dado protegido/);
    assert.doesNotMatch(texto(h), /atualizado em/);
  });
  test('filtro por assunto e por pessoa', async () => {
    const t = await montar('coord_geral'); const S = t.S; const eu = S.eu; S.veio = { de: eu.id, aud: true }; const outro = S.equipe.find(m => m.id !== eu.id);
    const agora = Date.now();
    S.aud = [{ id: 'a', em: new Date(agora).toISOString(), por: eu.id, tabela: 'fichas', acao: 'INSERT', depois: { id: 'f', nome: 'Ana', uf: 'PI' } },
      { id: 'b', em: new Date(agora - 1000).toISOString(), por: outro.id, tabela: 'visitas', acao: 'INSERT', depois: { ficha_id: 'f', etapa: 'diagnostico' } }];
    S.histF = { quem: '', grupo: 'campo', busca: '' };
    let tx = texto(t.aba('historico')); assert.match(tx, /2 registros carregados.*mostrando 1/); assert.match(tx, /agendou a visita/); assert.doesNotMatch(tx, /registrou a ficha/);
    S.histF = { quem: eu.id, grupo: '', busca: '' };
    tx = texto(t.aba('historico')); assert.match(tx, /registrou a ficha/); assert.doesNotMatch(tx, /agendou a visita/);
    S.histF = { quem: '', grupo: '', busca: 'nada-disso' };
    assert.match(texto(t.aba('historico')), /Nenhum registro com este filtro/);
    S.histF = { quem: '', grupo: '', busca: '' };
  });
  test('23/10: sem "Restaurar como estava antes" (a correção de ficha e visita é pela devolução)', async () => {
    const t = await montar('coord_geral'); const S = t.S; const eu = S.eu;
    S.aud = [{ id: 9, em: new Date().toISOString(), por: eu.id, tabela: 'fichas', acao: 'UPDATE', registro_id: 'f1', antes: { id: 'f1', comunidade: 'A' }, depois: { id: 'f1', comunidade: 'B' } }]; S.veio = { de: eu.id, aud: true };
    const h = t.aba('historico'); assert.match(h, /O que mudou \(1\)/); assert.doesNotMatch(h, /Restaurar|hist-restaurar/);
    assert.equal(t.api.restaurarVersao, undefined);
  });
  test('o download da planilha do Histórico fica registrado (só a coordenação geral)', async () => {
    const t = await montar('coord_geral');
    await t.api.registrarPlanilha('historico', 3, 'assunto: Campo');
    const a = await t.api.auditoria(); assert.ok(a.some(x => x.tabela === 'planilhas' && x.depois && x.depois.tipo === 'historico'));
    const t2 = await montar('coord_tecnico');
    await assert.rejects(() => t2.api.registrarPlanilha('historico', 1, ''), /coordenação geral/);
  });
});
