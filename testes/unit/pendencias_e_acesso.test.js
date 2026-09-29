/* 29/09/2026: número de pendências nas abas e nos atalhos de cada perfil; "Esqueci a senha" pela tela de entrada. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const { diaMais } = require('./ambiente');

const numeroDaAba = (html, aba) => { const m = new RegExp(`data-aba="${aba}"[^>]*>[\\s\\S]*?</button>`).exec(html); const c = m && /class="conta"[^>]*>(\d+)</.exec(m[0]); return c ? +c[1] : 0; };
const numeroDoAtalho = (html, alvo) => { const m = new RegExp(`data-alvo="${alvo}"[^>]*>[\\s\\S]*?</button>`).exec(html); const c = m && /class="conta"[^>]*>(\d+)</.exec(m[0]); return c ? +c[1] : 0; };

describe('Esqueci a senha', () => {
  test('pedido de e-mail da equipe vira pedido para a coordenação geral; pedir de novo não duplica', async () => {
    const t = await montar('coord_geral'); const m = t.S.equipe.find(x => x.papel === 'articulacao' && x.status === 'ativa');
    await t.api.pedirNovoAcesso(m.email.toUpperCase() + ' '); await t.api.pedirNovoAcesso(m.email);
    const l = await t.api.listarPedidosAcesso(); assert.equal(l.length, 1); assert.equal(l[0].vezes, 2); assert.equal(l[0].equipe_id, m.id);
  });
  test('e-mail desconhecido ou inválido: nada é guardado e não dá erro (não revela quem está cadastrado)', async () => {
    const t = await montar('coord_geral');
    await t.api.pedirNovoAcesso('ninguem@naoexiste.com'); await t.api.pedirNovoAcesso('isso não é email');
    assert.equal((await t.api.listarPedidosAcesso()).length, 0);
  });
  test('aparece na aba Equipe com número; na ficha aparece o aviso; gerar o código atende o pedido', async () => {
    const t = await montar('coord_geral'); const m = t.S.equipe.find(x => x.papel === 'articulacao' && x.status === 'ativa');
    await t.api.pedirNovoAcesso(m.email); await t.MQ.ui.carregar();
    const h = t.aba('visao'); assert.equal(numeroDaAba(h, 'equipe'), (t.S.pre || []).length + 1);
    assert.ok(texto(t.aba('equipe')).includes('Pedidos de novo acesso'));
    await t.api.gerarCodigoAcesso(m.id); await t.MQ.ui.carregar();
    assert.equal(t.S.pedidosAcesso.length, 0); assert.ok(!texto(t.aba('equipe')).includes('Pedidos de novo acesso'));
  });
  test('descartar tira da lista; só a coordenação geral vê ou descarta', async () => {
    const t = await montar('coord_geral'); const m = t.S.equipe.find(x => x.papel === 'agente' && x.status === 'ativa');
    await t.api.pedirNovoAcesso(m.email); const [p] = await t.api.listarPedidosAcesso();
    await t.trocar('coord_tecnico'); assert.equal((await t.api.listarPedidosAcesso()).length, 0);
    await assert.rejects(t.api.descartarPedidoAcesso(p.id));
    await t.trocar('coord_geral'); await t.api.descartarPedidoAcesso(p.id); assert.equal((await t.api.listarPedidosAcesso()).length, 0);
    await assert.rejects(t.api.descartarPedidoAcesso(p.id), /já foi resolvido|não encontrado/);
  });
  test('tela de entrada: link "Esqueci a senha" abre o pedido; resposta sempre igual', async () => {
    const t = await montar('coord_geral'); t.S.verEntrada = true; t.S.modoLogin = 'entrar';
    let h = t.aba(null); assert.ok(/data-m="esqueci"/.test(h)); assert.ok(!/Esqueceu a senha\? A coordenação geral libera/.test(h));
    t.S.modoLogin = 'esqueci'; h = t.aba(null); assert.ok(/data-form="esqueci"/.test(h));
    t.S.esqueciEnviado = true; h = texto(t.aba(null)); assert.ok(h.includes('Se este e-mail estiver cadastrado')); assert.ok(h.includes('Já recebi o código'));
  });
});

describe('Número de pendências nas abas', () => {
  test('coordenação técnica: Seleção conta fichas aguardando; aba sem pendência não tem número', async () => {
    const t = await montar('coord_tecnico'); const h = t.aba(null);
    assert.equal(numeroDaAba(h, 'selecao'), t.S.fichas.filter(f => f.situacao === 'aguardando').length);
    assert.equal(numeroDaAba(h, 'custos'), 0);
  });
  test('leitor de tela ouve "esperando você"', async () => {
    const t = await montar('coord_tecnico'); assert.ok(/so-leitor"> \(\d+ esperando você\)/.test(t.aba(null)));
  });
  test('celular: seletor de seção mostra o total das outras seções', async () => {
    const t = await montar('coord_geral'); const h = t.aba('custos');
    const soma = ['equipe', 'selecao', 'campo', 'pagamentos', 'viagens'].reduce((s, a) => s + numeroDaAba(h, a), 0);
    const m = /abas-m-pend"[^>]*>(\d+)</.exec(h); assert.equal(m ? +m[1] : 0, soma);
  });
});

describe('Número nos atalhos das telas pessoais', () => {
  test('auxiliar: "Cadastrar no Arlo" conta quem falta cadastrar', async () => {
    const t = await montar('auxiliar'); const h = t.aba(null);
    const falta = t.S.equipe.filter(m => m.status === 'ativa' && m.papel !== 'coord_geral' && m.id !== t.S.eu.id && !m.docs_funcern_em).length;
    assert.equal(numeroDoAtalho(h, '#t-arlo'), falta);
  });
  test('pagamento devolvido aparece no atalho "Pedir pagamento" da bolsista', async () => {
    const t = await montar('bolsista'); const mes = diaMais(0).slice(0, 7) + '-01';
    const id = await t.api.solicitarPagamento('bolsa', mes, 1000, 'Neste mês visitei os quintais do território e organizei as listas de presença.', [], {});
    await t.trocar('coord_tecnico'); await t.api.avalizarPagamento(id, false, 'Falta o relatório de presença.', null);
    await t.trocar('bolsista'); assert.equal(numeroDoAtalho(t.aba(null), '#t-pag'), 1);
  });
  test('agente: visita da data de hoje ainda não registrada conta em "Minhas próximas visitas"', async () => {
    const t = await montar('agente'); const eu = t.S.eu;
    const n0 = t.MQ.campoUI.contaAFazer();
    t.S.visitas = t.S.visitas.concat([{ id: 'vteste', ficha_id: 'x', executor_id: eu.id, etapa: 'acompanhamento', situacao: 'prevista', data_prevista: diaMais(0), uf: eu.uf }]);
    assert.equal(t.MQ.campoUI.contaAFazer(), n0 + 1);
    t.S.visitas = t.S.visitas.concat([{ id: 'vfutura', ficha_id: 'x', executor_id: eu.id, etapa: 'acompanhamento', situacao: 'prevista', data_prevista: diaMais(5), uf: eu.uf }]);
    assert.equal(t.MQ.campoUI.contaAFazer(), n0 + 1, 'visita futura não conta');
  });
});

describe('Rodapé', () => {
  test('botão "Ajuda desta página" (não mais o link solto)', async () => {
    const t = await montar('bolsista'); const h = t.aba(null);
    assert.ok(/class="rodape-ajuda" data-acao="ajuda"/.test(h)); assert.ok(texto(h).includes('Ajuda desta página'));
  });
});
