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
  test('23/10: "Restaurar como estava antes" pede confirmação, mostra o que volta (sem dado protegido) e grava a versão antiga', async () => {
    const t = await montar('coord_geral'); const S = t.S; const eu = S.eu;
    const f = S.fichas[0]; const antes = Object.assign({}, f);
    { const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); const x = d.fichas.find(y => y.id === f.id); const ant = JSON.parse(JSON.stringify(x)); x.comunidade = 'Comunidade Errada';   // uma alteração feita por outra pessoa
      d.auditoria.push({ id: d.auditoria.length + 1, tabela: 'fichas', registro_id: x.id, acao: 'UPDATE', por: eu.id, em: new Date().toISOString(), antes: ant, depois: JSON.parse(JSON.stringify(x)) }); t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await t.api.reler(); }
    S.aud = await t.api.auditoria(); S.veio = { de: eu.id, aud: true };
    const a = S.aud.find(x => x.tabela === 'fichas' && x.acao === 'UPDATE' && x.registro_id === f.id); assert.ok(a, 'a alteração está no histórico');
    let h = t.aba('historico'); assert.match(h, new RegExp(`data-acao="hist-restaurar" data-id="${a.id}"`));
    assert.ok(!S.aud.filter(x => x.tabela === 'equipe').some(x => h.includes(`data-acao="hist-restaurar" data-id="${x.id}"`)), 'equipe não tem restaurar');
    S.histRest = { id: String(a.id), conflito: false }; h = texto(t.aba('historico'));
    assert.match(h, /Vai voltar:.*comunidade\s*:?\s*Comunidade Errada\s*→\s*/); assert.match(h, /Confirmar/);
    const r = await t.api.restaurarVersao(a.id); assert.ok(r.ok);
    const aud2 = await t.api.auditoria(); const rest = aud2.find(x => x.obs && x.registro_id === f.id); assert.ok(rest, 'a restauração fica no histórico, marcada');
    assert.equal(rest.depois.comunidade, antes.comunidade, 'a comunidade voltou');
    await assert.rejects(() => t.api.restaurarVersao(S.aud.find(x => x.tabela === 'equipe').id), /não se restaura/);
    S.histRest = null;
  });
  test('o download da planilha do Histórico fica registrado (só a coordenação geral)', async () => {
    const t = await montar('coord_geral');
    await t.api.registrarPlanilha('historico', 3, 'assunto: Campo');
    const a = await t.api.auditoria(); assert.ok(a.some(x => x.tabela === 'planilhas' && x.depois && x.depois.tipo === 'historico'));
    const t2 = await montar('coord_tecnico');
    await assert.rejects(() => t2.api.registrarPlanilha('historico', 1, ''), /coordenação geral/);
  });
});
