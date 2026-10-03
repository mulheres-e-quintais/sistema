/* Perfis de acompanhamento no modo produção (js/api-supabase.js) com um Supabase simulado:
   quem não é da equipe pode ser de acompanhamento; se não for, fica sem cadastro; e as chamadas vão com os nomes certos. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./ambiente');

function montar(resp) {
  const amb = carregar(['dados.js', 'regras.js', 'api-supabase.js']);
  const chamadas = [];
  amb.janela.supabase = { createClient: () => ({
    rpc: async (nome, args) => { chamadas.push([nome, args]); const r = resp[nome]; if (r instanceof Error) throw r; return r === undefined ? { data: null, error: null } : r; },
    auth: { getSession: async () => ({ data: { session: resp.sessao === false ? null : { user: { id: 'u1' } } } }) } }) };
  amb.MQ.CONFIG = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' };
  return { api: amb.MQ.apiSupabase, chamadas, janela: amb.janela };
}
const OBS = { data: { id: 'o1', nome: 'Marta Observadora', orgao: 'mda', cargo: 'Analista' }, error: null };

describe('quem entra: equipe, acompanhamento ou ninguém', () => {
  test('pessoa da equipe continua entrando como equipe, sem consultar o acompanhamento', async () => {
    const { api, chamadas } = montar({ vincular_conta: { data: { id: 'e1', papel: 'apoio', nome: 'Ana' }, error: null }, acompanhamento_eu: OBS });
    const eu = await api.iniciar();
    assert.equal(eu.papel, 'apoio'); assert.equal(eu.observador, undefined);
    assert.ok(!chamadas.some(c => c[0] === 'acompanhamento_eu'));
  });
  test('quem não é da equipe e é de acompanhamento entra com o perfil do órgão', async () => {
    const { api } = montar({ acompanhamento_eu: OBS });
    const eu = await api.iniciar();
    assert.equal(eu.observador, true); assert.equal(eu.papel, 'obs_mda'); assert.equal(eu.orgao, 'mda'); assert.equal(eu.nome, 'Marta Observadora'); assert.equal(eu.id, 'o1');
    assert.equal(eu.cpf, undefined); assert.equal(eu.uf, undefined);
  });
  test('MPA recebe o perfil do MPA', async () => {
    const { api } = montar({ acompanhamento_eu: { data: { id: 'o2', nome: 'Paulo Parceiro', orgao: 'mpa' }, error: null } });
    assert.equal((await api.iniciar()).papel, 'obs_mpa');
  });
  test('nem equipe nem acompanhamento: fica sem cadastro', async () => {
    const { api } = montar({ acompanhamento_eu: { data: null, error: null } });
    assert.equal(await api.iniciar(), null); assert.equal(api.temSessao, true);
  });
  test('banco sem o 52 (função não existe): segue como sem cadastro, sem erro', async () => {
    const { api } = montar({ acompanhamento_eu: { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.acompanhamento_eu' } } });
    assert.equal(await api.iniciar(), null);
  });
  test('falha de rede ao consultar o acompanhamento não derruba a entrada', async () => {
    const { api } = montar({ acompanhamento_eu: new Error('Failed to fetch') });
    assert.equal(await api.iniciar(), null);
  });
  test('resposta estranha do servidor (sem id) não vira perfil', async () => {
    const { api } = montar({ acompanhamento_eu: { data: { nome: 'Sem Id', orgao: 'mda' }, error: null } });
    assert.equal(await api.iniciar(), null);
  });
  test('sem sessão, nada é consultado', async () => {
    const { api, chamadas } = montar({ sessao: false, acompanhamento_eu: OBS });
    assert.equal(await api.iniciar(), null); assert.equal(chamadas.length, 0);
  });
});

describe('chamadas ao banco', () => {
  test('os números: quem acompanha não manda órgão; a coordenação manda o órgão da prévia', async () => {
    const { api, chamadas } = montar({ acompanhamento_eu: OBS, acompanhamento_dados: { data: { orgao: 'mda', por_uf: [] }, error: null } });
    await api.iniciar();
    assert.equal((await api.dadosAcompanhamento()).orgao, 'mda'); assert.equal(chamadas.at(-1)[0], 'acompanhamento_dados'); assert.equal(chamadas.at(-1)[1].p_orgao, null);
    await api.dadosAcompanhamento('mpa'); assert.equal(chamadas.at(-1)[1].p_orgao, 'mpa');
  });
  test('recusa do banco vira erro com a mensagem do sistema', async () => {
    const { api } = montar({ acompanhamento_eu: OBS, acompanhamento_dados: { data: null, error: { message: 'Acesso restrito ao acompanhamento do projeto.' } } });
    await api.iniciar(); await assert.rejects(api.dadosAcompanhamento(), /Acesso restrito/);
  });
  test('cadastro: manda nome, e-mail, órgão, cargo e ativo com os nomes que a função espera', async () => {
    const { api, chamadas } = montar({ vincular_conta: { data: { id: 'e1', papel: 'coord_geral', nome: 'Geral' }, error: null }, salvar_observador: { data: 'novo-id', error: null } });
    await api.iniciar();
    assert.equal(await api.salvarObservador({ nome: 'Marta', email: 'm@x.br', orgao: 'mda', cargo: '', ativo: false }), 'novo-id');
    assert.deepEqual(JSON.parse(JSON.stringify(chamadas.at(-1))), ['salvar_observador', { p_id: null, p_nome: 'Marta', p_email: 'm@x.br', p_orgao: 'mda', p_cargo: null, p_ativo: false }]);
    await api.salvarObservador({ id: 'o9', nome: 'Marta', email: 'm@x.br', orgao: 'mpa' });
    assert.equal(chamadas.at(-1)[1].p_id, 'o9'); assert.equal(chamadas.at(-1)[1].p_ativo, true);
  });
  test('lista vazia vem como lista; código vem como texto', async () => {
    const { api, chamadas } = montar({ vincular_conta: { data: { id: 'e1', papel: 'coord_geral', nome: 'Geral' }, error: null }, listar_observadores: { data: null, error: null }, gerar_codigo_observador: { data: 'ABCD-2345', error: null } });
    await api.iniciar();
    assert.equal((await api.listarObservadores()).length, 0);
    assert.equal(await api.gerarCodigoObservador('o1'), 'ABCD-2345'); assert.equal(chamadas.at(-1)[1].p_id, 'o1');
  });
});
