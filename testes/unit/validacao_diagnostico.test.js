/* 29/09/2026: validação do diagnóstico (31_validacao_diagnostico.sql) e município único no cadastro. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const primeiro = t => { const d = t.S.diagnosticos[0]; return { d, f: t.S.fichas.find(x => x.id === d.ficha_id) }; };

describe('Quem alterou não aprova', () => {
  test('geral que alterou o diagnóstico não aprova; a técnica aprova', async () => {
    const t = await montar('coord_geral'); const { d } = primeiro(t);
    const dd = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); dd.diagnosticos[0].conteudo_alterado_por = t.S.eu.id; t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(dd));
    await t.api.reler();
    await assert.rejects(t.api.decidirDiagnostico(d.id, 'aprovado', ''), /Você alterou/);
    await t.MQ.ui.carregar(); const h = texto(t.painel({ tipo: 'diag-ver', ficha: d.ficha_id }));
    assert.ok(h.includes('Você alterou este diagnóstico, então não aprova')); assert.ok(!h.includes('Aprovar plano'));
    await t.trocar('coord_tecnico'); await t.api.decidirDiagnostico(d.id, 'aprovado', '');
  });
  test('quem aplica ao salvar vira quem alterou', async () => {
    const t = await montar('bolsista'); const { d } = primeiro(t);
    await t.api.salvarDiagnostico(Object.assign({}, d, { area_m2: 310 }), {});
    await t.trocar('coord_geral'); const n = (await t.api.listarDiagnosticos()).find(x => x.id === d.id);
    assert.equal(n.conteudo_alterado_por, (await t.api.listarEquipe()).find(m => m.papel === 'articulacao' && m.uf === 'PI' && m.status === 'ativa').id);
  });
});

describe('Localização do diagnóstico', () => {
  test('sem GPS: exige motivo escolhido e explicação de 15 letras', async () => {
    const R = (await montar('bolsista')).MQ.regras; const base = { data_visita: '2026-10-01', latitude: null, familia: [{ nome: 'A' }], agua_seca: 'sim', fontes_agua: ['x'], fotos_ok: 3 };
    assert.ok(R.validarDiagnostico(Object.assign({}, base, { sem_gps_tipo: '', sem_gps_detalhe: 'uma explicação bem longa aqui' })).sem_gps_motivo);
    assert.ok(R.validarDiagnostico(Object.assign({}, base, { sem_gps_tipo: 'Outro motivo', sem_gps_detalhe: 'curto' })).sem_gps_motivo);
    assert.ok(!R.validarDiagnostico(Object.assign({}, base, { sem_gps_tipo: 'Outro motivo', sem_gps_detalhe: 'fica no fundo do vale, sem sinal' })).sem_gps_motivo);
  });
  test('sem GPS: aprovar exige observação nova dizendo como confirmou', async () => {
    const t = await montar('coord_tecnico'); const { d } = primeiro(t);
    const dd = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); Object.assign(dd.diagnosticos[0], { latitude: null, longitude: null, sem_gps_motivo: 'Outro motivo. fica no fundo do vale', obs_coordenacao: 'Confirmar localização' });
    t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(dd)); await t.api.reler(); await t.MQ.ui.carregar();
    await assert.rejects(t.api.decidirDiagnostico(d.id, 'aprovado', ''), /sem localização/);
    await assert.rejects(t.api.decidirDiagnostico(d.id, 'aprovado', 'Confirmar localização'), /sem localização/);
    const h = texto(t.painel({ tipo: 'diag-ver', ficha: d.ficha_id }));
    assert.ok(h.includes('Sem localização.')); assert.ok(h.includes('como você confirmou que a visita aconteceu'));
    assert.ok(texto(t.aba('campo')).includes('Sem localização'));
    await t.api.decidirDiagnostico(d.id, 'aprovado', 'Liguei para ela e confirmei a visita');
  });
  test('com GPS: mostra mapa, distância do centro do município e sem alerta quando perto', async () => {
    const t = await montar('coord_tecnico'); const { d } = primeiro(t);
    const html = t.painel({ tipo: 'diag-ver', ficha: d.ficha_id }); const h = texto(html);
    assert.ok(/<svg class="mapa mapa-local"/.test(html)); assert.ok(/Distância do centro de Paulistana/.test(h)); assert.ok(!/km do município/.test(texto(t.aba('campo'))));
  });
  test('GPS longe do município ou fora do estado gera alerta', async () => {
    const t = await montar('coord_tecnico'); const C = t.MQ.campoUI;
    const f = { uf: 'PI', municipio: 'Paulistana' };
    const longe = C.localDiag({ uf: 'PI', latitude: -7.3, longitude: -41.1, dados: {} }, f); assert.ok(longe.alerta); assert.ok(longe.km > 40);
    const fora = C.localDiag({ uf: 'PI', latitude: -5.6, longitude: -37.8, dados: {} }, f); assert.equal(fora.noEstado, false); assert.ok(fora.alerta);
    const perto = C.localDiag({ uf: 'PI', latitude: -8.12, longitude: -41.13, dados: { gps_precisao: 12 } }, f); assert.ok(!perto.alerta); assert.equal(perto.precisao, 12);
  });
  test('diagnóstico novo não herda o GPS da ficha', async () => {
    const t = await montar('bolsista'); const f = t.S.fichas.find(x => x.uf === 'PI' && x.resultado === 'selecionada' && x.situacao === 'aprovada' && !t.S.diagnosticos.some(d => d.ficha_id === x.id));
    f.latitude = -8.1; f.longitude = -41.1;
    const html = t.painel({ tipo: 'diag-form', ficha: f.id });
    assert.ok(/name="latitude" value=""/.test(html)); assert.ok(/Registrar localização/.test(html));
  });
});

describe('Cadastro: um campo só para o município', () => {
  test('formulário da coordenação pede "Município onde mora" uma vez, dentro do endereço', async () => {
    const t = await montar('coord_geral'); await new Promise(r => setTimeout(r, 30));
    const h2 = t.painel({ tipo: 'cadastro', papel: 'articulacao', uf: 'PI', modo: 'manual' });
    assert.equal((h2.match(/Município onde mora/g) || []).length, 1, 'aparece uma vez'); assert.ok(!/>Cidade</.test(h2)); assert.ok(/list="lista-mun"/.test(h2));
  });
});
