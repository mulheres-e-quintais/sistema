/* Correções da auditoria de 12/10/2026 (itens 1 a 15): fila do campo, bolsa no valor da função, rascunho do convite
   sem CPF e regra da foto do dia (madrugada, HEIC, foto que volta da fila). */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');
const igual = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);   // objetos vêm de outro contexto (vm)

/* bloco TIFF com DateTimeOriginal, como o EXIF guarda (little endian) */
function tiff(data) {
  const u16 = n => [n & 255, n >> 8], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
  const txt = [...Buffer.from(data + '\0', 'latin1')];
  return [0x49, 0x49, ...u16(42), ...u32(8), ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0),
    ...u16(1), ...u16(0x9003), ...u16(2), ...u32(txt.length), ...u32(44), ...u32(0), ...txt];
}
/* HEIC do iPhone: caixa ftyp, outras caixas e, mais adiante, o item Exif (deslocamento + "Exif\0\0" + TIFF) */
const heic = data => new Blob([Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0, ...Buffer.from('mif1heic'), ...new Array(300).fill(7),
  0, 0, 0, 6, ...Buffer.from('Exif\0\0', 'latin1'), ...tiff(data)])], { type: 'image/heic' });

describe('Foto do dia: buracos da regra (item 15)', () => {
  test('HEIC (iPhone) e PNG com EXIF: a data é lida em vez de recusar sempre', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    igual(await F.lerMomentoExif(heic('2026:10:12 07:40:00')), { dia: '2026-10-12', hora: 7 });
    assert.equal(await F.lerDataExif(heic('2026:10:12 07:40:00')), '2026-10-12');
    const png = new Blob([Buffer.from([0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10, 0, 0, 0, 40, ...Buffer.from('eXIf'), ...tiff('2026:09:30 18:05:00')])]);
    assert.equal(await F.lerDataExif(png), '2026-09-30');
    assert.equal(await F.lerDataExif(new Blob([Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic'), ...new Array(50).fill(0)])])), null, 'HEIC sem EXIF continua sem data');
  });
  test('visita que passa da meia-noite: foto do dia seguinte até as 4h vale; depois das 4h, não', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    assert.equal(F.conferir('2026-10-11', '2026-10-10', 1), null);
    assert.equal(F.conferir('2026-02-01', '2026-01-31', 3), null, 'virada de mês');
    assert.match(F.conferir('2026-10-11', '2026-10-10', 9), /Só vale foto tirada no dia da visita/);
    assert.match(F.conferir('2026-10-11', '2026-10-10', null), /Só vale foto/, 'sem hora não há tolerância');
    assert.match(F.conferir('2026-10-09', '2026-10-10', 1), /Só vale foto/, 'dia anterior nunca');
  });
  test('foto que volta da fila guarda a data e é conferida de novo se a data da visita mudar', async () => {
    const t = await montar('bolsista'); const F = t.MQ.fotoDia;
    const mapa = { geral: { size: 10 } }; F.registrarMapa('aval', mapa, () => null);
    F.marcarDias('avaliacao', { ficha_id: 'f9' }, { geral: { dia: '2026-10-10', hora: 9 } });
    igual(F.diasDe('avaliacao', { ficha_id: 'f9' }, mapa), { geral: { dia: '2026-10-10', hora: 9 } });
    const form = data => ({ dataset: { form: 'aval', ficha: 'f9', id: 'a1' }, closest: () => null, querySelector: () => ({ value: data }) });
    assert.equal(F.fotoForaDoDia(form('2026-10-10')), null);
    igual(F.fotoForaDoDia(form('2026-10-08')), { dia: '2026-10-10', hora: 9 });
    F.marcarDias('avaliacao', { ficha_id: 'f9' }, null);   // registro antigo da fila, sem datas: passa
    assert.equal(F.fotoForaDoDia(form('2026-10-08')), null);
  });
});

describe('Fila do campo (itens 1, 3 e 4)', () => {
  test('falha passageira (internet, servidor fora, sessão vencida) é tentada de novo; recusa de regra não', async () => {
    const t = await montar('bolsista'); const P = t.MQ.falhaPassageira;
    assert.equal(P({ semRede: true }), true);
    assert.equal(P({ status: 503 }), true);
    assert.equal(P({ message: 'JWT expired' }), true);
    assert.equal(P(new Error('Failed to fetch')), true);
    assert.equal(P({ status: 400, message: 'A visita é agendada primeiro e marcada como feita depois' }), false);
  });
  test('registro recusado ou tentando de novo aparece para a agente, com o motivo', async () => {
    const t = await montar('bolsista');
    t.S.fila = [
      { id: 'x1', tipo: 'visita', dados: { data_realizada: '2026-10-10' }, erro: 'Conte em poucas linhas o que foi feito.' },
      { id: 'x2', tipo: 'diagnostico', dados: {}, erro: null, tentativas: 2, ultimaFalha: 'Servidor fora do ar' },
      { id: 'x3', tipo: 'avaliacao', dados: {}, erro: null }];
    const h = texto(t.aba(null));
    assert.match(h, /3 registros de campo guardados neste aparelho/);
    assert.match(h, /Não foi aceito: Conte em poucas linhas/);
    assert.match(h, /Tentando enviar de novo \(2 tentativas\)\. Último motivo: Servidor fora do ar/);
  });
  test('memória cheia: mensagem clara, não trava o salvar', async () => {
    const t = await montar('bolsista');
    assert.match(t.MQ.MSG_MEMORIA_CHEIA, /memória do celular está cheia/);
  });
});

describe('Bolsa no valor da função (item 6)', () => {
  test('valor de cada função vem do plano de trabalho; coordenação geral não recebe', async () => {
    const t = await montar('bolsista'); const R = t.MQ.regras;
    assert.equal(R.valorBolsa('articulacao'), 2200); assert.equal(R.valorBolsa('coord_tecnico'), 4700);
    assert.equal(R.valorBolsa('apoio'), 1600); assert.equal(R.valorBolsa('auxiliar_adm'), 1200); assert.equal(R.valorBolsa('coord_geral'), null);
  });
  test('pedido com outro valor é recusado; aval não passa do valor da função', async () => {
    const t = await montar('bolsista'); const rel = 'Relatório do mês com as visitas, os encontros e o que foi feito no campo.';
    const mes = t.MQ.regras.hoje().slice(0, 7) + '-01';
    await assert.rejects(t.api.solicitarPagamento('bolsa', mes, 5000, rel, [], {}), /2\.200,00 por mês/);
    const id = await t.api.solicitarPagamento('bolsa', mes, 2200, rel, [], {});
    await t.trocar('coord_tecnico');
    await assert.rejects(t.api.avalizarPagamento(id, true, null, 2300), /passa do valor pedido|valor da função/);
  });
});

describe('Rascunho do convite sem dados pessoais (item 11)', () => {
  test('CPF, NIS, nascimento, endereço, renda e raça nunca vão para o rascunho do convite', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/convites.js'), 'utf8');
    for (const k of ['cpf', 'nis', 'data_nascimento', 'cep', 'logradouro', 'renda_familiar', 'raca_etnia', 'siape']) assert.ok(new RegExp("NAO_GUARDA = \\[[^\\]]*'" + k + "'").test(src), k + ' não vai para o rascunho');
    assert.match(src, /r\.v !== 2 \|\| !\(Date\.now\(\) - \(r\.em \|\| 0\) < RASC_CONV_VALIDADE\)\) localStorage\.removeItem/, 'rascunho antigo (com CPF) ou vencido sai do aparelho');
  });
});

describe('Itens 10, 12, 13 e 14 (script 57)', () => {
  test('12. bolsa só de outubro de 2026 a setembro de 2027', async () => {
    const t = await montar('bolsista'); const R = t.MQ.regras;
    assert.equal(R.mesBolsaOk('2026-10-01'), true); assert.equal(R.mesBolsaOk('2027-09'), true);
    assert.equal(R.mesBolsaOk('2026-09-01'), false); assert.equal(R.mesBolsaOk('2027-10'), false);
  });
  test('14. visita só dentro da vigência do TED (14/09/2026 a 30/09/2027)', async () => {
    const t = await montar('bolsista'); const R = t.MQ.regras;
    assert.equal(R.LIM.visitaMin, '2026-09-14'); assert.equal(R.LIM.visitaMax, '2027-09-30');
    assert.match(R.erroDataFeita('2026-09-13'), /vigência/); assert.match(R.erroDataPrevista('2027-10-01'), /30\/09\/2027/);
  });
  test('13. pendências de pagamento: visita feita sem pedido (ou só em pedido devolvido) e pedido devolvido', async () => {
    const t = await montar('bolsista'); const R = t.MQ.regras;
    const vs = [{ id: 'v1', executor_id: 'a', situacao: 'realizada' }, { id: 'v2', executor_id: 'a', situacao: 'realizada' }, { id: 'v3', executor_id: 'a', situacao: 'realizada' }, { id: 'v4', executor_id: 'a', situacao: 'prevista' }];
    const sol = [{ id: 's1', equipe_id: 'a', situacao: 'lancada' }, { id: 's2', equipe_id: 'a', situacao: 'devolvida' }];
    igual(R.pendenciasPagamento('a', vs, { v1: 's1', v2: 's2' }, sol), { visitas: 2, devolvidos: 1, total: 3 });
    igual(R.pendenciasPagamento('b', vs, {}, sol), { visitas: 0, devolvidos: 0, total: 0 });
  });
  test('13. com visita sem pedido não se desliga; só a coordenação geral desliga assim mesmo, justificando', async () => {
    const t = await montar('coord_geral');
    const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4'));
    const ag = d.equipe.find(m => m.papel === 'agente' && m.status === 'ativa');
    const f = d.fichas.find(x => x.uf === ag.uf) || d.fichas[0];
    d.visitas.forEach(v => { if (v.executor_id === ag.id && v.situacao === 'prevista') v.situacao = 'cancelada'; });
    d.diagnosticos.forEach(x => { if (x.executor_id === ag.id && x.situacao === 'devolvido') x.situacao = 'aprovado'; });
    d.visitas.push({ id: 'v-sem-pedido', ficha_id: f.id, uf: ag.uf, etapa: 'acompanhamento', executor_id: ag.id, data_prevista: t.MQ.regras.hoje(), data_realizada: t.MQ.regras.hoje(), situacao: 'realizada', relato: 'Visita feita no quintal.' });
    t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await t.api.reler(); await t.MQ.ui.carregar();
    await assert.rejects(t.api.desligar(ag.id, t.MQ.regras.hoje(), 'Pediu para sair'), /Não dá para desligar ainda: \d+ visita\(s\) feita\(s\) sem pedido/);
    const h = texto(t.painel({ tipo: 'ver', id: ag.id }));
    assert.match(h, /Ainda não dá para desligar: \d+ visitas? feitas? sem pedido de ajuda de custo/);
    assert.match(h, /desligar assim mesmo/);
    await assert.rejects(t.api.desligar(ag.id, t.MQ.regras.hoje(), 'Abandono', 'sumiu'), /pelo menos 20 letras/);
    await t.api.desligar(ag.id, t.MQ.regras.hoje(), 'Abandono', 'Não responde há 30 dias, mensagens e ligações sem retorno.');
    const d2 = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4'));
    assert.equal(d2.equipe.find(m => m.id === ag.id).status, 'desligada');
    assert.ok(d2.auditoria.some(a => a.acao === 'DESLIGAR_COM_PENDENCIA' && a.registro_id === ag.id));
  });
  test('13. a coordenação técnica vê o bloqueio, sem o "desligar assim mesmo"', async () => {
    const t = await montar('coord_tecnico');
    const ag = t.S.equipe.find(m => m.papel === 'agente' && m.status === 'ativa');
    t.S.visitas = (t.S.visitas || []).concat([{ id: 'v-x', executor_id: ag.id, situacao: 'realizada', ficha_id: 'f', uf: ag.uf, etapa: 'acompanhamento' }]);
    const h = texto(t.painel({ tipo: 'ver', id: ag.id }));
    assert.match(h, /Ainda não dá para desligar/); assert.doesNotMatch(h, /desligar assim mesmo\. Explique/);
    assert.match(h, /só a coordenação geral desliga assim mesmo/);
  });
});

describe('Itens 16 e 17', () => {
  test('17. chamada ao servidor sem resposta: desiste no prazo e conta como falta de internet (vai para a fila)', async () => {
    const t = await montar('bolsista'); const M = t.MQ;
    M.prazoRede.dados = 50; M.prazoRede.arquivo = 200;
    let sinal = null;
    t.janela.fetch = (url, op) => new Promise((res, rej) => { sinal = op.signal; op.signal.addEventListener('abort', () => rej(new Error('The operation was aborted.'))); });
    const ini = Date.now();
    await assert.rejects(M.fetchComPrazo('https://x.supabase.co/rest/v1/visitas', { method: 'POST' }), e => /Failed to fetch/.test(e.message) && /30|0 segundos|segundos/.test(e.message));
    assert.ok(Date.now() - ini < 1000, 'desistiu no prazo'); assert.equal(sinal.aborted, true);
    // envio de arquivo tem prazo maior
    const ini2 = Date.now();
    await assert.rejects(M.fetchComPrazo('https://x.supabase.co/storage/v1/object/campo/a.jpg', { method: 'POST' }), /Failed to fetch/);
    assert.ok(Date.now() - ini2 >= 150, 'arquivo espera mais');
    assert.equal(M.falhaPassageira(new Error('Failed to fetch: o servidor não respondeu em 30 segundos')), true, 'tenta de novo sozinho');
    // resposta que chega a tempo passa normal
    t.janela.fetch = async () => ({ ok: true, status: 200 });
    assert.equal((await M.fetchComPrazo('https://x.supabase.co/rest/v1/visitas', {})).status, 200);
  });
  test('16. avaliação na fila: a visita aparece feita, "Ver avaliação" abre com o aviso e a correção mantém as fotos', async () => {
    const t = await montar('bolsista'); const S = t.S;
    const v = (S.visitas || []).find(x => x.etapa === 'avaliacao' && x.situacao === 'prevista' && x.uf === S.eu.uf) || (S.visitas || []).find(x => x.situacao === 'prevista' && x.uf === S.eu.uf);
    assert.ok(v, 'há visita prevista no exemplo');
    S.visitas = S.visitas.map(x => x.id === v.id ? Object.assign({}, x, { etapa: 'avaliacao' }) : x);
    const foto = { size: 1234, type: 'image/jpeg' };
    S.fila = [{ id: 'av-fila', tipo: 'avaliacao', dados: { id: 'av-fila', ficha_id: v.ficha_id, visita_id: v.id, uf: v.uf, data_visita: t.MQ.regras.hoje(), quintal_produz: 'sim', dados: {} }, fotos: { geral: foto }, erro: null }];
    assert.equal(t.MQ.campoUI.visitas().find(x => x.id === v.id).situacao, 'realizada', 'visita aparece feita');
    const h = texto(t.painel({ tipo: 'aval-ver', ficha: v.ficha_id }));
    assert.match(h, /Guardada neste aparelho/); assert.match(h, /Corrigir/);
    await t.MQ.impactoUI.clique('aval-novo', { dataset: { ficha: v.ficha_id } });
    const hf = texto(t.painel({ tipo: 'aval-form', ficha: v.ficha_id, visita: v.id }));
    assert.match(hf, /Foto pronta \(guardada neste aparelho\)/, 'a foto da fila voltou para a correção');
  });
});
