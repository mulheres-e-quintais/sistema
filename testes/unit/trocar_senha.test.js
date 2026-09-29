/* Trocar a própria senha (js/api-supabase.js) com um Supabase simulado: confere a senha atual antes de trocar. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');

function montar(resp) {
  const amb = carregar(['dados.js', 'regras.js', 'api-supabase.js']);
  const chamadas = [];
  amb.janela.supabase = { createClient: () => ({
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getUser: async () => ({ data: { user: { email: 'cleone.lima@ifrn.edu.br' } }, error: null }),
      signInWithPassword: async a => { chamadas.push(['entrar', a]); return { error: resp.entrar || null }; },
      updateUser: async a => { chamadas.push(['trocar', a]); return { error: resp.trocar || null }; }
    } }) };
  amb.MQ.CONFIG = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' };
  return { api: amb.MQ.apiSupabase, chamadas };
}

describe('trocar senha (servidor)', () => {
  test('confere a senha atual com o e-mail da sessão e depois troca', async () => {
    const { api, chamadas } = montar({}); await api.verConvite('x');   // cria o cliente
    await api.trocarSenha('velha123', 'nova4567');
    assert.equal(chamadas[0][0], 'entrar'); assert.equal(chamadas[0][1].email, 'cleone.lima@ifrn.edu.br'); assert.equal(chamadas[0][1].password, 'velha123');
    assert.equal(chamadas[1][0], 'trocar'); assert.equal(chamadas[1][1].password, 'nova4567');
  });
  test('senha atual errada: não troca e avisa em português', async () => {
    const { api, chamadas } = montar({ entrar: { message: 'Invalid login credentials' } }); await api.verConvite('x');
    await assert.rejects(api.trocarSenha('errada1', 'nova4567'), /senha atual não confere/);
    assert.ok(!chamadas.some(c => c[0] === 'trocar'));
  });
  test('nova igual à antiga: mensagem clara', async () => {
    const { api } = montar({ trocar: { message: 'New password should be different from the old password.' } }); await api.verConvite('x');
    await assert.rejects(api.trocarSenha('velha123', 'velha123'), /diferente da atual/);
  });
});
