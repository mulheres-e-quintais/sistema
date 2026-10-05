/* Decisão de 04/10/2026: a compra do kit é feita por empresa contratada; o preço é só referência
   e aparece só para a coordenação geral. Os outros perfis escolhem item, quantidade e para quê. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar } = require('./telas');
const { montarApi } = require('./servidor_simulado');

const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const diagDe = T => T.S.diagnosticos[0];

describe('quem vê preço e projeção do kit', () => {
  for (const p of ['bolsista', 'agente', 'coord_tecnico']) test(p + ': o plano mostra os itens, sem preço e sem projeção', async () => {
    const T = await montar(p === 'agente' ? 'bolsista' : p); const d = diagDe(T); assert.ok(d, 'há um diagnóstico de exemplo');
    if (p === 'agente') { await T.trocar('agente'); if (!T.S.diagnosticos.length) return; }   // a agente só vê os diagnósticos dela
    const h = T.painel({ tipo: 'diag-ver', ficha: d.ficha_id });
    assert.match(texto(h), /Caixa d[’']água/); assert.doesNotMatch(texto(h), /Projeção do investimento|R\$ unid\.|Subtotal|\(ref\.\)|502,84/);
  });
  test('coordenação geral: o plano mostra preço de referência, subtotal e projeção', async () => {
    const T = await montar('coord_geral'); const h = T.painel({ tipo: 'diag-ver', ficha: diagDe(T).ficha_id });
    assert.match(texto(h), /Projeção do investimento no quintal/); assert.match(texto(h), /R\$ unid\./); assert.match(texto(h), /502,84/);
  });
  test('formulário do diagnóstico (bolsista): sem campo de valor visível, sem projeção e sem preço na lista de itens', async () => {
    const T = await montar('bolsista'); const d = diagDe(T); const h = T.painel({ tipo: 'diag-form', ficha: d.ficha_id, visita: d.visita_id });
    assert.match(h, /name="kit_item"/); assert.doesNotMatch(h, /id="kit-proj"/); assert.doesNotMatch(texto(h), /R\$ unid\.|preço de referência entra sozinho/);
    assert.ok(!/<input name="kit_valor"/.test(h), 'o campo de valor não aparece'); assert.match(h, /<input type="hidden" name="kit_valor"/, 'o valor já gravado segue escondido, para não se perder');
    const lista = (h.match(/<datalist id="kit-lista">.*?<\/datalist>/s) || [''])[0]; assert.ok(lista.length > 50); assert.doesNotMatch(lista, /R\$/);
    assert.match(texto(h), /Não é preciso informar preço/);
  });
  test('aba Campo: a lista de itens com preços só existe para a coordenação geral', async () => {
    const G = await montar('coord_geral'); const g = G.aba('campo');
    assert.doesNotMatch(texto(g), /Itens do kit e preços de referência/); assert.doesNotMatch(g, /campo-kit-editar/);   // 04/10/2026: o quadro de itens e preços saiu da tela (o código fica, desligado: S.verKitItens)
    const T = await montar('coord_tecnico'); const t = T.aba('campo');
    assert.doesNotMatch(texto(t), /Itens do kit e preços de referência|planos? com valores|projetados/); assert.doesNotMatch(t, /campo-kit-editar|data-form="diag-kit-item"/);
    assert.match(texto(t), /aparecem só para a coordenação geral/);
  });
  test('folha impressa do plano: com preços só para a coordenação geral', async () => {
    const G = await montar('coord_geral'); const d = diagDe(G); const f = G.S.fichas.find(x => x.id === d.ficha_id);
    assert.match(G.MQ.campoUI.htmlPlano(f, d, null), /Projeção do investimento no quintal/);
    const T = await montar('coord_tecnico'); const h = T.MQ.campoUI.htmlPlano(f, d, null);
    assert.doesNotMatch(h, /Projeção do investimento|R\$ unid\.|Subtotal/); assert.match(h, /<h2>Kit<\/h2>/); assert.match(h, /Caixa d/);
  });
});

describe('dados: o preço não chega a quem não é da coordenação geral', () => {
  test('demonstração: bolsista e coordenação técnica recebem só nome e unidade; a geral recebe o preço', async () => {
    const T = await montar('bolsista'); let l = await T.api.listarKitItens();
    assert.ok(l.length >= 9); assert.ok(l.every(k => k.item && k.unidade && !('valor_ref' in k) && !('fonte' in k)));
    await T.trocar('coord_tecnico'); l = await T.api.listarKitItens(); assert.ok(l.every(k => !('valor_ref' in k)));
    await T.trocar('coord_geral'); l = await T.api.listarKitItens(); assert.ok(l.every(k => k.valor_ref > 0 && k.fonte));
  });
  test('demonstração: só a coordenação geral altera a lista', async () => {
    const T = await montar('coord_tecnico');
    await assert.rejects(T.api.salvarKitItem({ item: 'Arame liso', unidade: 'm', valor_ref: 2 }), /coordenação geral/);
    await T.trocar('coord_geral'); await assert.doesNotReject(T.api.salvarKitItem({ item: 'Arame liso', unidade: 'm', valor_ref: 2 }));
  });
  test('produção: quem não é da coordenação geral pede só os nomes (função kit_itens_nomes), nunca a tabela', async () => {
    const t = await montarApi({ eu: { id: 'e1', papel: 'apoio', nome: 'Ana', status: 'ativa' }, rpc: { kit_itens_nomes: [{ id: 'k1', item: 'Regador', unidade: 'un', ativo: true, valor_ref: 99 }] } });
    const l = await t.api.listarKitItens();
    assert.deepEqual(JSON.parse(JSON.stringify(l)), [{ id: 'k1', item: 'Regador', unidade: 'un', ativo: true }]); assert.ok(!t.chamadas.some(c => c.nome === 'kit_itens'));
  });
  test('produção com o banco ainda no 51 antigo: lê a tabela, mas tira o preço antes de entregar à tela', async () => {
    const t = await montarApi({ eu: { id: 'e1', papel: 'coord_tecnico', nome: 'Joana', status: 'ativa' }, rpc: { kit_itens_nomes: { error: { code: 'PGRST202', message: 'Could not find the function public.kit_itens_nomes' } } },
      tabelas: { kit_itens: [{ id: 'k1', item: 'Regador', unidade: 'un', ativo: true, valor_ref: 31.84, fonte: 'x', preliminar: true }] } });
    assert.deepEqual(JSON.parse(JSON.stringify(await t.api.listarKitItens())), [{ id: 'k1', item: 'Regador', unidade: 'un', ativo: true }]);
  });
  test('produção: a coordenação geral lê a tabela com preço e fonte', async () => {
    const t = await montarApi({ tabelas: { kit_itens: [{ id: 'k1', item: 'Regador', unidade: 'un', ativo: true, valor_ref: 31.84, fonte: 'Ferpam', preliminar: true }] } });
    const l = await t.api.listarKitItens(); assert.equal(l[0].valor_ref, 31.84); assert.ok(!t.chamadas.some(c => c.nome === 'kit_itens_nomes'));
  });
});
