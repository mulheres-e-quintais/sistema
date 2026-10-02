/* QA 01/10/2026 — js/fichas.js: busca sem acento, CPF só com termo numérico, contagem, CSV (filtro, cabeçalho, datas, fórmulas), limites de texto. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const limparFiltro = F => { F.filtro.uf = ''; F.filtro.situacao = ''; F.filtro.busca = ''; };

test('busca: "antonia" acha "Antônia"; maiúsculas e espaços repetidos não atrapalham', async () => {
  const { MQ } = await montar('coord_tecnico'); const casa = MQ.fichasUI.casaBusca;
  const f = { nome: 'Antônia  Conceição da Silva', cpf: '12345678901' };
  for (const t of ['antonia', 'ANTÔNIA', 'antonia conceicao', 'Antônia   Conceição', '  silva  ', 'conceição da', '']) assert.equal(casa(f, t), true, JSON.stringify(t));
  assert.equal(casa(f, 'antonio'), false);
});
test('busca: só compara com o CPF quando o termo é só número/pontuação de CPF com 3 dígitos ou mais', async () => {
  const { MQ } = await montar('coord_tecnico'); const casa = MQ.fichasUI.casaBusca;
  const f = { nome: 'Maria das Dores', cpf: '12345678901' };
  assert.equal(casa(f, 'Inexistente 2'), false); assert.equal(casa(f, 'Inexistente 123'), false);
  assert.equal(casa(f, '2'), false); assert.equal(casa(f, '12'), false);
  assert.equal(casa(f, '123'), true); assert.equal(casa(f, '123.456.789-01'), true); assert.equal(casa(f, '456.789'), true); assert.equal(casa(f, '999'), false);
  assert.equal(casa({ nome: 'Lote 12 Maria', cpf: null }, '12'), true, 'número que está no nome continua achando');
});
test('tela da coordenação: a busca filtra a lista e o contador mostra "X de N"', async () => {
  const T = await montar('coord_tecnico'); const F = T.MQ.fichasUI; limparFiltro(F);
  const n = T.S.fichas.length; T.S.fichas[0].nome = 'Antônia Zuleide Xavier';
  assert.match(texto(F.secaoCoord()), new RegExp('Todas as fichas \\(' + n + '\\)'));
  F.filtro.busca = 'antonia  zuleide';
  const h = F.secaoCoord();
  assert.match(texto(h), new RegExp('Todas as fichas \\(1 de ' + n + '\\)')); assert.match(h, /Antônia Zuleide Xavier/);
  assert.match(texto(h), new RegExp('Baixar CSV \\(1 de ' + n + '\\)'));
  F.filtro.busca = 'Inexistente 2';
  assert.match(texto(F.secaoCoord()), new RegExp('Todas as fichas \\(0 de ' + n + '\\)'));
  limparFiltro(F);
});
test('contagem: ficha com situação vazia não conta como aprovada (fica em "para aprovar") e a linha continua somando o total', async () => {
  const { MQ } = await montar('coord_tecnico'); const contar = MQ.fichasUI.contar;
  const l = [{ uf: 'PI', situacao: null, resultado: 'selecionada' }, { uf: 'PI', resultado: 'lista_espera' }, { uf: 'PI', situacao: 'aprovada', resultado: 'selecionada' },
    { uf: 'PI', situacao: 'aprovada', resultado: 'sem_agua' }, { uf: 'PI', situacao: 'devolvida', resultado: 'selecionada' }, { uf: 'PI', situacao: 'aguardando', resultado: 'nao_atende' }];
  const c = contar(l, 'PI');
  assert.equal(c.aprovadas, 1); assert.equal(c.espera, 0); assert.equal(c.aguardando, 3); assert.equal(c.devolvidas, 1); assert.equal(c.sem_agua, 1);
  assert.equal(c.aprovadas + c.espera + c.sem_agua + c.nao_atende + c.aguardando + c.devolvidas, c.total);
});
test('CSV: cabeçalho legível, datas em dd/mm/aaaa e células protegidas contra fórmula', async () => {
  const T = await montar('coord_tecnico'); const F = T.MQ.fichasUI; limparFiltro(F);
  Object.assign(T.S.fichas[0], { nome: '=HYPERLINK("http://x";"clique")', comunidade: '+55 Sítio', endereco: '@casa', indicada_por: '-fulana', data_nascimento: '1984-11-20', data_ficha: '2026-10-01', aprovada_em: '2026-10-02T01:30:00Z' });
  const r = F.montarCSV(); const linhas = r.texto.replace(/^﻿/, '').split('\n');
  assert.equal(r.n, T.S.fichas.length); assert.equal(r.filtrado, false); assert.match(r.nome, /^fichas_mulheres_e_quintais_\d{4}-\d{2}-\d{2}\.csv$/);
  const cab = linhas[0];
  for (const c of ['"Estado"', '"Município"', '"Nome"', '"CPF"', '"Data de nascimento"', '"Data da ficha"', '"Tem 18 anos ou mais"', '"Pontos de prioridade"', '"Situação"', '"Aprovada em"', '"Autoriza uso de imagem"']) assert.ok(cab.includes(c), c);
  assert.doesNotMatch(cab, /data_nascimento|c_maior18|consent_imagem|posicao_espera/);
  const lin = linhas.find(x => x.includes('HYPERLINK'));
  assert.ok(lin.includes('"\'=HYPERLINK(""http://x"";""clique"")"')); assert.ok(lin.includes('"\'+55 Sítio"')); assert.ok(lin.includes('"\'@casa"')); assert.ok(lin.includes('"\'-fulana"'));
  assert.ok(lin.includes('"20/11/1984"')); assert.ok(lin.includes('"01/10/2026"'), 'data da ficha e aprovada em (01:30Z de 02/10 ainda é 01/10 em Fortaleza)');
  assert.doesNotMatch(lin, /1984-11-20|2026-10-0/);
  for (const l of linhas.slice(1)) for (const cel of l.split('";"')) assert.doesNotMatch(cel.replace(/^"/, ''), /^[=+@]/, cel);
});
test('CSV respeita o filtro da tela e o nome do arquivo diz qual foi', async () => {
  const T = await montar('coord_tecnico'); const F = T.MQ.fichasUI; limparFiltro(F);
  const total = T.S.fichas.length; const pi = T.S.fichas.filter(f => f.uf === 'PI').length; assert.ok(pi > 0 && pi < total);
  F.filtro.uf = 'PI';
  let r = F.montarCSV();
  assert.equal(r.n, pi); assert.equal(r.total, total); assert.equal(r.filtrado, true); assert.equal(r.texto.split('\n').length, pi + 1);
  assert.match(r.nome, /^fichas_mulheres_e_quintais_filtro_PI_\d{4}/);
  F.filtro.situacao = 'aprovada'; F.filtro.busca = 'a';
  r = F.montarCSV(); assert.match(r.nome, /filtro_PI_aprovada_busca_/); assert.ok(r.n <= pi);
  limparFiltro(F);
});
test('ficha: nome com mais de 120 caracteres e justificativa com mais de 2.000 são recusados com mensagem', async () => {
  const T = await montar('bolsista'); let visto = null; T.MQ.ui.mostrarErros = (f, e, g) => { visto = g; };
  const campos = { nome: 'Maria ' + 'a'.repeat(120), justificativa: 'j'.repeat(2001) };
  const form = Object.assign(campos, { dataset: { id: 'fx' }, querySelector: () => null, querySelectorAll: () => [] });
  await T.MQ.fichasUI.enviar('ficha', form, null);
  assert.match(visto, /Nome: texto muito longo \(máximo 120 caracteres\)/);
  const curto = Object.assign({ nome: 'Maria da Silva', justificativa: 'j'.repeat(2001) }, { dataset: { id: 'fx' }, querySelector: () => null, querySelectorAll: () => [] });
  let erros = null; const orig = T.MQ.regras.validarFicha; T.MQ.regras.validarFicha = () => ({});
  T.MQ.ui.mostrarErros = (f, e, g) => { erros = g; };
  await T.MQ.fichasUI.enviar('ficha', curto, null); T.MQ.regras.validarFicha = orig;
  assert.match(erros, /Justificativa: texto muito longo \(máximo 2\.000 caracteres\)/);
});
