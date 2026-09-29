/* Saída do sistema depois de 15 minutos sem uso (js/sessao.js e o início do app), para todos os perfis. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');
const { abrirComoApp, texto } = require('./telas');

const MIN = 60 * 1000;
const sessao = () => { const amb = carregar(['sessao.js']); return { S: amb.MQ.sessao, amb }; };

describe('regras do tempo', () => {
  test('limite de 15 minutos e aviso 2 minutos antes', () => {
    const { S } = sessao(); assert.equal(S.LIMITE, 15 * MIN); assert.equal(S.AVISO, 2 * MIN);
  });
  test('venceu: 14min59s não; 15min exatos sim; muito tempo sim', () => {
    const { S } = sessao(); const t = 1_000_000_000;
    assert.equal(S.venceu(t - (15 * MIN - 1000), t), false);
    assert.equal(S.venceu(t - 15 * MIN, t), true);
    assert.equal(S.venceu(t - 24 * 60 * MIN, t), true);
  });
  test('sem uso registrado (primeira vez) não conta como vencido', () => {
    const { S } = sessao(); assert.equal(S.venceu(0), false); assert.equal(S.venceu(null), false); assert.equal(S.falta(0), 15 * MIN);
  });
  test('falta: quanto resta, nunca negativo', () => {
    const { S } = sessao(); const t = 1_000_000_000;
    assert.equal(S.falta(t - 13 * MIN, t), 2 * MIN); assert.equal(S.falta(t - 20 * MIN, t), 0);
  });
  test('fmt mostra minutos e segundos', () => {
    const { S } = sessao(); assert.equal(S.fmt(2 * MIN), '2:00'); assert.equal(S.fmt(61 * 1000), '1:01'); assert.equal(S.fmt(500), '0:01');
  });
});

describe('uso e contagem', () => {
  test('tocar grava o último uso no aparelho; esquecer apaga', () => {
    const { S, amb } = sessao();
    S.tocar(true); assert.ok(+amb.janela.localStorage.getItem('mq-ultimo-uso') > 0);
    S.esquecer(); assert.equal(amb.janela.localStorage.getItem('mq-ultimo-uso'), null);
  });
  test('qualquer toque ou tecla conta como uso (outra aba também vê)', () => {
    const { S, amb } = sessao(); S.iniciar({ ativo: () => true, aoVencer() {} }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 10 * MIN));
    amb.ouvintes.pointerdown.forEach(fn => fn({}));
    assert.ok(Date.now() - S.ultimo() < 1000);
  });
  test('aos 13 minutos aparece o aviso com "Continuar usando"; aos 15 sai', () => {
    const { S, amb } = sessao(); let saiu = 0; let caixa = null;
    amb.janela.document.body.appendChild = el => { caixa = el; };
    S.iniciar({ ativo: () => true, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 13.5 * MIN)); S.conferir();
    assert.ok(caixa && /Continuar usando/.test(caixa.innerHTML)); assert.equal(saiu, 0);
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 15 * MIN)); S.conferir();
    assert.equal(saiu, 1);
  });
  test('ninguém logado: não avisa nem sai', () => {
    const { S, amb } = sessao(); let saiu = 0;
    S.iniciar({ ativo: () => false, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 60 * MIN)); S.conferir();
    assert.equal(saiu, 0);
  });
});

describe('no sistema, para cada perfil', () => {
  for (const p of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    test(`${p}: reabrir depois de 16 minutos sem uso sai e avisa na entrada`, async () => {
      const a = await abrirComoApp(p, 16 * MIN);
      assert.equal(a.S.verEntrada, true);   // no modo demonstração, sair = voltar para a tela de entrada
      assert.match(texto(a.html()), /15 minutos sem uso/);
      assert.equal(a.janela.localStorage.getItem('mq-ultimo-uso'), null);
      a.MQ.sessao.parar();
    });
    test(`${p}: reabrir com 10 minutos continua dentro`, async () => {
      const a = await abrirComoApp(p, 10 * MIN);
      assert.ok(!a.S.verEntrada); assert.doesNotMatch(texto(a.html()), /15 minutos sem uso/);
      a.MQ.sessao.parar();
    });
  }
  test('no meio do uso: passou de 15 minutos, sai sozinho', async () => {
    const a = await abrirComoApp('bolsista', 1 * MIN);
    a.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 15 * MIN - 1000));
    a.MQ.sessao.conferir(); await new Promise(r => setTimeout(r, 20));
    assert.equal(a.S.verEntrada, true); assert.match(texto(a.html()), /15 minutos sem uso/);
    a.MQ.sessao.parar();
  });
});

/* Opção 1 (decisão da coordenação): com internet sai aos 15 minutos; sem internet NÃO sai, porque para
   entrar de novo é preciso conexão e a agente ficaria travada no campo. Quando o sinal volta, se ela
   continua parada há 15 minutos ou mais, aí sai. */
describe('sem internet não sai; sai quando o sinal volta', () => {
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  test('sem rede: passou de 15 minutos, não avisa nem sai', async () => {
    const { S, amb } = sessao(); let saiu = 0, caixa = null;
    amb.janela.document.body.appendChild = el => { caixa = el; };
    amb.janela.navigator.onLine = false;
    S.iniciar({ ativo: () => true, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 13.5 * MIN)); await S.conferir();
    assert.equal(caixa, null, 'sem rede não mostra o aviso de saída');
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 60 * MIN)); await S.conferir();
    assert.equal(saiu, 0);
  });
  test('o sinal volta e ela continua parada: sai', async () => {
    const { S, amb } = sessao(); let saiu = 0;
    amb.janela.navigator.onLine = false;
    S.iniciar({ ativo: () => true, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 40 * MIN)); await S.conferir();
    assert.equal(saiu, 0);
    amb.janela.navigator.onLine = true; (amb.ouvintesJanela.online || []).forEach(fn => fn()); await esperar(5);
    assert.equal(saiu, 1);
  });
  test('o sinal volta mas ela estava usando (sem internet): continua dentro', async () => {
    const { S, amb } = sessao(); let saiu = 0;
    amb.janela.navigator.onLine = false;
    S.iniciar({ ativo: () => true, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 40 * MIN));
    amb.ouvintes.pointerdown.forEach(fn => fn({}));   // preencheu ficha sem sinal
    amb.janela.navigator.onLine = true; await S.conferir();
    assert.equal(saiu, 0);
  });
  test('sinal fraco (diz que tem rede, servidor não responde): não sai e tenta de novo depois', async () => {
    const { S, amb } = sessao(); let saiu = 0, perguntas = 0, responde = false;
    S.iniciar({ ativo: () => true, temConexao: async () => { perguntas++; return responde; }, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 20 * MIN));
    await S.conferir(); assert.equal(saiu, 0); assert.equal(perguntas, 1);
    await S.conferir(); assert.equal(perguntas, 1, 'espera 30 segundos antes de perguntar de novo');
    responde = true; (amb.ouvintesJanela.online || []).forEach(fn => fn()); await esperar(5);   // voltou de verdade
    assert.equal(saiu, 1);
  });
  test('usou enquanto o sistema conferia a conexão: não sai', async () => {
    const { S, amb } = sessao(); let saiu = 0;
    S.iniciar({ ativo: () => true, temConexao: async () => { amb.ouvintes.keydown.forEach(fn => fn({})); return true; }, aoVencer: () => { saiu++; } }); S.parar();
    amb.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 20 * MIN));
    await S.conferir(); assert.equal(saiu, 0);
  });
  for (const p of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    test(`${p}: reabrir sem internet depois de 40 minutos entra normalmente`, async () => {
      const a = await abrirComoApp(p, 40 * MIN, { semRede: true });
      try {
        assert.ok(!a.S.verEntrada); assert.doesNotMatch(texto(a.html()), /15 minutos sem uso/);
        assert.ok(Date.now() - a.MQ.sessao.ultimo() < 2000, 'abrir o sistema conta como uso');
      } finally { a.MQ.sessao.parar(); }
    });
  }
});

/* LGPD: ao sair (botão ou 15 minutos), a cópia dos dados some do aparelho; a fila do que não foi enviado fica */
describe('ao sair, a cópia dos dados não fica no aparelho', () => {
  test('saída por inatividade apaga a cópia offline de quem saiu', async () => {
    const a = await abrirComoApp('bolsista', 1 * MIN);
    try {
      const chave = 'mq-cache-' + a.S.eu.id;
      assert.ok(a.janela.localStorage.getItem(chave), 'cópia criada ao entrar');
      a.janela.localStorage.setItem('mq-ultimo-uso', String(Date.now() - 15 * MIN - 1000));
      a.MQ.sessao.conferir(); await new Promise(r => setTimeout(r, 20));
      assert.equal(a.S.verEntrada, true); assert.equal(a.janela.localStorage.getItem(chave), null);
    } finally { a.MQ.sessao.parar(); }
  });
});
