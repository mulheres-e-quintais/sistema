/* QA2 02/10/2026 — defeitos de tela da reauditoria (v176): filtros sem resultado, fila do aparelho na lista da bolsista,
   ficha alterada em outra tela, limites dos dados pessoais e do arranjo produtivo, rascunho do painel. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

test('Seleção: filtro sem resultado mostra a mensagem e o botão "Limpar filtros"; limpar devolve a lista', async () => {
  const T = await montar('coord_tecnico'); const F = T.MQ.fichasUI; F.filtro.uf = ''; F.filtro.situacao = ''; F.filtro.busca = '';
  assert.doesNotMatch(F.secaoCoord(), /ficha-limpar-filtros/, 'sem filtro não há o que limpar');
  F.filtro.busca = 'zzz-nao-existe';
  let h = F.secaoCoord(); assert.match(texto(h), /Nenhuma ficha com esses filtros\./); assert.match(h, /data-acao="ficha-limpar-filtros"[^>]*>Limpar filtros</);
  F.filtro.busca = ''; F.filtro.uf = T.S.fichas[0].uf;
  h = F.secaoCoord(); assert.match(texto(h), /Mostrando \d+ de \d+ fichas\./); assert.match(h, /ficha-limpar-filtros/);
  await F.clique('ficha-limpar-filtros', { dataset: {} });
  assert.deepEqual([F.filtro.uf, F.filtro.situacao, F.filtro.busca], ['', '', '']);
});
test('Bolsista: ficha guardada no aparelho aparece no topo com a etiqueta; recusada mostra o motivo e "Corrigir"', async () => {
  const T = await montar('bolsista'); const F = T.MQ.fichasUI; const uf = T.S.eu.uf;
  T.S.fila = [{ id: 'fila-1', dono: T.S.eu.id, tipo: 'ficha', dados: { id: 'fila-1', uf, nome: 'Guardada No Aparelho', municipio: 'Paulistana', comunidade: 'Serra' }, erro: null },
    { id: 'fila-2', dono: T.S.eu.id, tipo: 'ficha', dados: { id: 'fila-2', uf, nome: 'Recusada <b>Pelo</b> Servidor', municipio: 'Jaicós', comunidade: 'Baixa' }, erro: 'Já existe ficha com este CPF.' }];
  const h = F.secaoBolsista(); const t = texto(h);
  assert.match(t, /2 fichas guardadas neste aparelho\s*, 1 com problema para corrigir/);
  assert.match(t, /Guardada No Aparelho\s+No aparelho: envia quando tiver internet/);
  assert.match(t, /Motivo: Já existe ficha com este CPF\./);
  assert.match(h, /data-acao="ficha-corrigir" data-id="fila-2"/); assert.doesNotMatch(h, /data-acao="ficha-corrigir" data-id="fila-1"/);
  assert.doesNotMatch(h, /<b>Pelo<\/b>/, 'o nome vai escapado');
  assert.ok(h.indexOf('fila-aparelho') < h.indexOf('lista-fichas-uf') || h.indexOf('lista-fichas-uf') < 0, 'o bloco do aparelho vem antes da lista');
  assert.equal((h.match(/Guardada No Aparelho/g) || []).length, 2, 'aparece uma vez só (nome + rótulo do botão), não repetida na lista de baixo');
});
test('Duas abas: a "versão" da ficha muda quando a situação, o resultado ou a observação mudam', async () => {
  const T = await montar('coord_tecnico'); const v = T.MQ.fichasUI.versaoDe; const f = Object.assign({}, T.S.fichas.find(x => x.situacao === 'aguardando'));
  const antes = v(f);
  assert.equal(v(Object.assign({}, f)), antes);
  assert.notEqual(v(Object.assign({}, f, { situacao: 'aprovada' })), antes);
  assert.notEqual(v(Object.assign({}, f, { resultado: 'lista_espera' })), antes);
  assert.notEqual(v(Object.assign({}, f, { obs_coordenacao: 'corrigir o CPF' })), antes);
  assert.match(T.painel({ tipo: 'ficha-ver', id: f.id }), /data-form="ficha-decisao"[^>]*data-ver="/);
  assert.match(texto(T.painel({ tipo: 'ficha-ver', id: f.id, aviso: T.MQ.fichasUI.MSG_MUDOU })), /Esta ficha foi alterada em outra tela\. Atualizamos os dados: confira antes de decidir\./);
});
test('Dados pessoais (pendências): nascimento de 1900 até hoje menos 16 anos e textos com tamanho máximo', async () => {
  const T = await montar('bolsista'); const R = T.MQ.regras;
  if (T.MQ.convitesUI.privado(T.S.eu.id) === undefined) await new Promise(r => setTimeout(r, 30));
  const h = T.painel({ tipo: 'pend-dados' }); const hoje = R.hoje(); const max = (+hoje.slice(0, 4) - 16) + hoje.slice(4);
  if (/name="data_nascimento"/.test(h)) assert.match(h, new RegExp('name="data_nascimento" type="date" value="[^"]*" min="1900-01-01" max="' + max + '"'));
  for (const [k, n] of [['logradouro', 120], ['complemento', 120], ['bairro', 120]]) if (new RegExp('name="' + k + '"').test(h)) assert.match(h, new RegExp('name="' + k + '"[^>]*maxlength="' + n + '"'), k);
  assert.match(h, /name="cidade"[^>]*maxlength="120"/);
});
test('Cadastro (campos pessoais): mesmos limites de nascimento e de endereço', async () => {
  const T = await montar('coord_geral'); const R = T.MQ.regras; const hoje = R.hoje(); const max = (+hoje.slice(0, 4) - 16) + hoje.slice(4);
  const h = T.MQ.convitesUI.camposPessoais({}, true, 'articulacao', null);
  assert.match(h, new RegExp('name="data_nascimento"[^>]*min="1900-01-01" max="' + max + '"'));
  for (const k of ['logradouro', 'complemento', 'bairro', 'cidade']) assert.match(h, new RegExp('name="' + k + '"[^>]*maxlength="120"'), k);
});
test('Arranjo produtivo: limites declarados (80 letras por item, 30 itens)', async () => {
  const T = await montar('coord_tecnico'); assert.equal(T.MQ.sugestaoUI.APL_MAX_ITEM, 80); assert.equal(T.MQ.sugestaoUI.APL_MAX_ITENS, 30);
});
test('Equipe: o botão da vaga traz o nome completo também no celular (sem versão curta "Cadastrar")', async () => {
  const T = await montar('coord_tecnico'); const h = T.aba('equipe');
  const vagas = h.match(/<div class="vaga-slot">[\s\S]*?<\/button>/g) || [];
  assert.ok(vagas.length > 0, 'há vaga aberta no exemplo');
  for (const v of vagas) { assert.match(texto(v), /Cadastrar (substituta|articulação|apoio)/); assert.doesNotMatch(v, /class="ba-c"/); }
});
test('Mensagens neutras: "Leitura registrada."', async () => {
  const fs = require('fs'); const path = require('path'); const src = fs.readFileSync(path.join(__dirname, '../../js/entregas.js'), 'utf8');
  assert.match(src, /toast\('Leitura registrada\.'\)/); assert.doesNotMatch(src, /Obrigada! Leitura registrada/);
});
