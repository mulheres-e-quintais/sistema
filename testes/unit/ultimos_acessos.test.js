/* 29/09/2026: quadro "Últimos acessos" (só a coordenação geral; 30_ultimos_acessos.sql). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

describe('Últimos acessos', () => {
  test('o registro fica em nome de quem está logado; só a coordenação geral lê', async () => {
    const t = await montar('bolsista'); const eu = t.S.eu.id;
    await t.api.registrarAcesso('entrada', 'Android · Chrome');
    assert.equal((await t.api.listarAcessos()).length, 0, 'bolsista não lê');
    await t.trocar('coord_tecnico'); assert.equal((await t.api.listarAcessos()).length, 0, 'técnica não lê');
    await t.trocar('coord_geral'); const l = await t.api.listarAcessos();
    const meu = l.find(a => a.equipe_id === eu); assert.ok(meu); assert.equal(meu.tipo, 'entrada'); assert.equal(meu.aparelho, 'Android · Chrome');
  });
  test('tipo inventado não é gravado; aparelho longo é cortado em 80 letras', async () => {
    const t = await montar('coord_geral'); const antes = (await t.api.listarAcessos()).length;
    await t.api.registrarAcesso('hackear', 'x'); assert.equal((await t.api.listarAcessos()).length, antes);
    await t.api.registrarAcesso('saida', 'y'.repeat(300)); const [ult] = await t.api.listarAcessos(); assert.equal(ult.aparelho.length, 80);
  });
  test('registros com mais de 6 meses são apagados sozinhos', async () => {
    const t = await montar('coord_geral');
    const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4'));
    d.acessos = [{ id: 1, equipe_id: t.S.eu.id, em: new Date(Date.now() - 200 * 864e5).toISOString(), tipo: 'entrada' }];
    t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d));
    await t.api.reler(); await t.api.registrarAcesso('abriu', null);
    const l = await t.api.listarAcessos(); assert.equal(l.length, 1); assert.equal(l[0].tipo, 'abriu');
  });
  test('aba Histórico da geral mostra o quadro com a última entrada de cada pessoa', async () => {
    const t = await montar('bolsista'); const nome = t.S.eu.nome;
    await t.api.registrarAcesso('entrada', 'iPhone · Safari');
    await t.trocar('coord_geral');
    const h = texto(t.aba('historico'));
    assert.ok(h.includes('Últimos acessos')); assert.ok(h.includes(nome.split(' ')[0])); assert.ok(h.includes('iPhone · Safari'));
    assert.ok(/entrou nos últimos 7 dias/.test(h));
  });
  test('na ficha da pessoa aparece o último acesso (só para a geral)', async () => {
    const t = await montar('bolsista'); const id = t.S.eu.id;
    await t.api.registrarAcesso('entrada', 'Windows · Edge');
    await t.trocar('coord_geral'); assert.ok(texto(t.painel({ tipo: 'detalhe', id })).includes('Último acesso'));
    await t.trocar('coord_tecnico'); assert.ok(!texto(t.painel({ tipo: 'detalhe', id })).includes('Último acesso'));
  });
  test('sem o script 30 no banco: aviso para rodar, e nada quebra', async () => {
    const t = await montar('coord_geral'); t.S.acessosSemBanco = true;
    assert.ok(texto(t.aba('historico')).includes('30_ultimos_acessos.sql'));
    t.api.registrarAcesso = async () => { throw new Error('function registrar_acesso does not exist'); };
    await t.MQ.ui.sair();   // sair não trava nem quebra se o registro falhar
    assert.equal(t.S.verEntrada, true);
  });
  test('sair pelo botão e por inatividade ficam registrados antes de encerrar', async () => {
    const t = await montar('coord_geral'); const tipos = [];
    const orig = t.api.registrarAcesso.bind(t.api); t.api.registrarAcesso = async (tp, ap) => { tipos.push(tp); return orig(tp, ap); };
    await t.MQ.ui.sair(); t.S.verEntrada = false; await t.MQ.ui.sair('15 minutos');
    assert.deepEqual(tipos, ['saida', 'saida_inatividade']);
  });
  test('aparelho em poucas palavras; IP pela metade', async () => {
    const t = await montar('coord_geral');
    t.janela.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
    assert.equal(t.MQ.ui.aparelho(), 'Android · Chrome');
    t.janela.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    assert.equal(t.MQ.ui.aparelho(), 'iPhone · Safari');
    t.janela.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
    assert.equal(t.MQ.ui.aparelho(), 'Windows · Edge');
    assert.equal(t.MQ.ui.ipCurto('177.12.34.56'), '177.12.•.•');
    assert.equal(t.MQ.ui.ipCurto('2804:14c:5b:1234::1'), '2804:14c:…');
    assert.equal(t.MQ.ui.ipCurto(null), '');
  });
});
