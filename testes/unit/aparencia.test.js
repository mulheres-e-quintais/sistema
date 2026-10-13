/* v261: aparência da tela — modo sol (campo, sol forte) e tema claro/escuro/automático, guardados no aparelho. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { montar, texto } = require('./telas');
const css = fs.readFileSync(path.join(__dirname, '..', '..', 'css', 'app.css'), 'utf8');

const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contraste = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const bloco = sel => { const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, 'bloco ' + sel); return css.slice(i, css.indexOf('}', i)); };
const cor = (b, v) => { const m = b.match(new RegExp('--' + v + ':\\s*(#[0-9A-Fa-f]{6})')); assert.ok(m, v); return m[1]; };

describe('Aparência da tela', () => {
  test('padrão: segue o celular, sem modo sol; preferência estragada volta ao padrão', async () => {
    const t = await montar('bolsista'); const A = t.MQ.aparencia;
    assert.deepEqual({ ...A.ler() }, { tema: 'auto', sol: false });
    t.janela.localStorage.setItem(A.CHAVE, '{lixo'); assert.deepEqual({ ...A.ler() }, { tema: 'auto', sol: false });
    t.janela.localStorage.setItem(A.CHAVE, JSON.stringify({ tema: 'roxo', sol: 'sim' })); assert.deepEqual({ ...A.ler() }, { tema: 'auto', sol: false });
  });
  test('ligar o modo sol e escolher o tema ficam guardados no aparelho', async () => {
    const t = await montar('bolsista'); const A = t.MQ.aparencia;
    A.mudar('sol', true); assert.equal(A.ler().sol, true);
    A.mudar('tema', 'escuro'); assert.deepEqual({ ...A.ler() }, { tema: 'escuro', sol: true });
    assert.deepEqual(JSON.parse(t.janela.localStorage.getItem('mq-aparencia')), { tema: 'escuro', sol: true });
  });
  test('o botão do sol aparece na barra de cima e abre o painel com a chave e os três temas', async () => {
    const t = await montar('bolsista');
    assert.match(t.aba(), /data-acao="aparencia"/);
    const h = t.painel({ tipo: 'aparencia' });
    assert.match(h, /Aparência da tela/); assert.match(h, /role="switch" aria-checked="false"/);
    for (const k of ['auto', 'claro', 'escuro']) assert.match(h, new RegExp(`data-acao="aparencia-tema" data-v="${k}"`));
    t.MQ.aparencia.mudar('sol', true);
    const h2 = t.painel({ tipo: 'aparencia' });
    assert.match(h2, /aria-checked="true"/); assert.match(texto(h2), /modo sol ligado a tela fica sempre clara/i);
    assert.equal((h2.match(/data-acao="aparencia-tema"[^>]*disabled/g) || []).length, 3, 'com sol, o tema não se escolhe');
  });
  test('modo sol: texto e bordas com contraste para luz forte', () => {
    const b = bloco(':root[data-sol]'); const fundo = cor(b, 'bg');
    assert.equal(fundo.toUpperCase(), '#FFFFFF');
    for (const v of ['ink', 'ink-2', 'muted', 'accent']) assert.ok(contraste(cor(b, v), fundo) >= 7, v + ' ≥ 7:1 (nível mais alto de acessibilidade)');
    for (const [t, f] of [['ok', 'ok-bg'], ['pend', 'pend-bg'], ['crit', 'crit-bg'], ['off', 'off-bg']]) assert.ok(contraste(cor(b, t), cor(b, f)) >= 7, t + ' na etiqueta ≥ 7:1');
    assert.ok(contraste(cor(b, 'line'), fundo) >= 3, 'bordas ≥ 3:1');
    assert.ok(contraste(cor(b, 'campo-borda'), fundo) >= 7, 'borda dos campos bem marcada');
  });
  test('tema normal reforçado: texto secundário ≥ 7:1 e apagado ≥ 6,5:1', () => {
    const b = bloco(':root'); const fundo = cor(b, 'bg');
    assert.ok(contraste(cor(b, 'ink-2'), fundo) >= 7);
    assert.ok(contraste(cor(b, 'muted'), fundo) >= 6.5);
    assert.ok(contraste(cor(b, 'ok'), cor(b, 'ok-bg')) >= 6);
  });
});
