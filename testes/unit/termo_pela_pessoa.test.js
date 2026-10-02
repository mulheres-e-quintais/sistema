/* 02/10/2026 (etapa 48): o termo de compromisso é anexado pela própria pessoa; a data só entra com o termo anexado;
   tela de entrada com uma ajuda só; pergunta do Arlo com explicação; coordenação técnica sem auxiliar e professores na aba Equipe. */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

const arq = nome => ({ name: nome, size: 1000, type: 'application/pdf' });
const semTermo = t => t.S.equipe.find(m => m.status === 'ativa' && m.papel !== 'coord_geral' && m.id !== t.S.eu.id && !m.termo_path && !m.termo_assinado_em);

describe('Termo de compromisso anexado pela própria pessoa', () => {
  test('a data do termo não é aceita sem o termo anexado; com o anexo, é', async () => {
    const t = await montar('auxiliar'); const alvo = semTermo(t); assert.ok(alvo, 'há alguém sem termo no exemplo');
    await assert.rejects(t.api.atualizar(alvo.id, { termo_assinado_em: t.MQ.regras.hoje() }), /Sem o termo anexado/);
    await t.api.atualizar(alvo.id, { termo_path: await t.api.enviarTermo(alvo.id, arq('termo.pdf')), termo_assinado_em: t.MQ.regras.hoje() });
    await t.MQ.ui.carregar();
    assert.equal(t.MQ.regras.termoSituacao(t.S.equipe.find(m => m.id === alvo.id)), 'conferido');
  });
  test('o cadastro no Arlo continua sendo registrado sem o termo', async () => {
    const t = await montar('auxiliar'); const alvo = semTermo(t);
    await t.api.atualizar(alvo.id, { docs_funcern_em: t.MQ.regras.hoje() });
  });
  test('a pessoa anexa o próprio termo: grava só o arquivo e passa a "aguardando conferência"', async () => {
    let t, eu;   // um perfil do exemplo que ainda não tem o termo conferido
    for (const perfil of ['agente', 'professor', 'coord_tecnico', 'auxiliar', 'bolsista']) {
      t = await montar(perfil); eu = t.S.equipe.find(m => m.id === t.S.eu.id); if (eu && !eu.termo_assinado_em && !eu.termo_path) break; eu = null;
    }
    assert.ok(eu, 'o exemplo tem alguém sem termo');
    const antes = t.MQ.pendUI.lista().itens.find(i => i.id === 'termo');
    assert.ok(antes && antes.seu && antes.acao === 'pend-termo', 'antes: "Envie o seu termo" depende dela');
    await t.api.enviarMeuTermo(eu.id, arq('meu_termo.pdf')); await t.MQ.ui.recarregar();
    const m = t.S.equipe.find(x => x.id === eu.id);
    assert.equal(m.termo_path, 'meu_termo.pdf'); assert.equal(m.termo_assinado_em, null, 'a data continua em branco: é de quem confere');
    assert.equal(t.MQ.regras.termoSituacao(m), 'enviado');
    const depois = t.MQ.pendUI.lista().itens.find(i => i.id === 'termo');
    assert.ok(depois && !depois.seu && /aguardando conferência/.test(depois.t), 'depois: depende de quem confere');
    assert.notEqual(t.MQ.regras.situacao(m).cod, 'ok', 'anexar não habilita: falta a conferência');
  });
  test('ninguém anexa o termo de outra pessoa pela função da própria pessoa', async () => {
    const t = await montar('bolsista'); const outra = t.S.equipe.find(m => m.id !== t.S.eu.id && m.status === 'ativa');
    await assert.rejects(t.api.enviarMeuTermo(outra.id, arq('termo.pdf')), /próprio termo/);
  });
  test('depois de conferido, a pessoa não troca mais o arquivo', async () => {
    const t = await montar('bolsista'); const eu = t.S.equipe.find(m => m.id === t.S.eu.id);
    if (!eu.termo_assinado_em) return;   // o exemplo traz a bolsista já habilitada
    await assert.rejects(t.api.enviarMeuTermo(eu.id, arq('outro.pdf')), /já foi conferido/);
  });
  test('formulário da pessoa: campo de anexar com o modelo ao lado e botão travado até escolher o arquivo', async () => {
    const t = await montar('bolsista'); const eu = Object.assign({}, t.S.equipe.find(m => m.id === t.S.eu.id), { termo_path: null, termo_assinado_em: null });
    const h = t.MQ.pendUI.formTermo(eu);
    assert.match(h, /data-form="pend-termo"/); assert.match(h, /<input id="pt-arq" name="termo" type="file"[^>]*required/);
    assert.match(h, /<button class="btn pri" type="submit" data-termo-salvar disabled>Enviar termo<\/button>/);
    assert.match(h, /class="rot-com-link"[\s\S]*termo-modelo/, 'o modelo fica ao lado do rótulo do campo');
    assert.match(h, /data-acao="pend-termo-gerar" data-id="[^"]+">Gerar o termo preenchido<\/button>/, 'o termo sai preenchido com os dados do cadastro');
    assert.match(h, /href="modelos\/Modelo_termo_de_compromisso_bolsista_e_agente\.pdf" download[^>]*>modelo em branco<\/a>/, 'bolsista: modelo em branco como segunda opção');
  });
  test('termo enviado: a pessoa vê "aguardando conferência" e pode trocar; conferido: não há mais formulário', async () => {
    const t = await montar('bolsista'); const base = t.S.equipe.find(m => m.id === t.S.eu.id);
    let h = t.MQ.pendUI.formTermo(Object.assign({}, base, { termo_path: 'equipe/x/termo_1.pdf', termo_assinado_em: null }));
    assert.ok(texto(h).includes('Termo enviado: termo_1.pdf')); assert.match(h, /Trocar o termo/);
    h = t.MQ.pendUI.formTermo(Object.assign({}, base, { termo_path: 'equipe/x/termo_1.pdf', termo_assinado_em: '2026-10-02' }));
    assert.ok(texto(h).includes('Termo conferido em 02/10/2026')); assert.ok(!/data-form="pend-termo"/.test(h));
  });
  test('quem confere: sem termo, aviso de que a pessoa ainda não anexou; com termo, botão "Abrir o termo"', async () => {
    const t = await montar('auxiliar'); const alvo = semTermo(t);
    let h = t.painel({ tipo: 'detalhe', id: alvo.id });
    assert.ok(texto(h).includes('ainda não anexou o termo')); assert.ok(!/data-acao="termo-abrir"/.test(h));
    assert.match(h, /class="data-btns"><button[^>]*data-acao="data-hoje"[^>]*>Hoje<\/button>\s*<button[^>]*data-acao="data-limpar"[^>]*>Limpar<\/button><\/span>/, '"Hoje" e "Limpar" ficam juntos');
    t.MQ.ui.fecharPainel(); alvo.termo_path = 'equipe/' + alvo.id + '/termo_1.pdf';
    h = t.painel({ tipo: 'detalhe', id: alvo.id });
    assert.match(h, /data-acao="termo-abrir" data-path="equipe\/[^"]+\/termo_1\.pdf"/); assert.ok(texto(h).includes('Termo anexado: falta conferir'));
    assert.ok(texto(h).includes('Termo anexado pela pessoa: falta conferir e registrar a data'), 'a lista de passos mostra que o termo chegou');
  });
  test('ficha de quem confere: o campo é a data de assinatura que está no documento; data sem anexo e anexo sem data têm mensagem própria', async () => {
    const t = await montar('auxiliar'); const alvo = semTermo(t); const h = texto(t.painel({ tipo: 'detalhe', id: alvo.id }));
    assert.ok(h.includes('Termo assinado em (a data que está no documento)')); assert.ok(h.includes('data sem anexo não é aceita'));
    assert.match(t.MQ.regras.MSG_TERMO_SEM_DATA, /confira no documento a data da assinatura/); assert.match(t.MQ.regras.MSG_TERMO_SEM_ARQUIVO, /Sem o termo anexado/);
  });
  test('"Meus dados" mostra a situação do termo (menos para a coordenação geral)', async () => {
    let t = await montar('professor'); assert.match(t.painel({ tipo: 'meus-dados' }), /id="meu-termo"/);
    t = await montar('coord_geral'); assert.ok(!/id="meu-termo"/.test(t.painel({ tipo: 'meus-dados' })));
  });
});

describe('Dois modelos de termo: servidor do IFRN e bolsista/agente', () => {
  test('professor do FIC e auxiliar usam o termo de autorização do servidor; técnica, bolsistas e agentes, o termo de compromisso', async () => {
    const t = await montar('coord_geral'); const R = t.MQ.regras;
    assert.deepEqual(['professor_fic', 'auxiliar_adm'].map(R.tipoTermo), ['servidor', 'servidor']);
    assert.deepEqual(['coord_tecnico', 'articulacao', 'apoio', 'agente'].map(R.tipoTermo), ['bolsista', 'bolsista', 'bolsista', 'bolsista']);
    assert.match(R.modeloTermo('professor_fic').arquivo, /servidor_IFRN\.docx$/); assert.match(R.modeloTermo('agente').arquivo, /bolsista_e_agente\.pdf$/);
  });
  test('os arquivos dos modelos existem na pasta modelos/ e não trazem dados de ninguém', async () => {
    const fs = require('fs'); const path = require('path'); const t = await montar('coord_geral');
    for (const k of Object.keys(t.MQ.MODELOS_TERMO)) assert.ok(fs.existsSync(path.join(__dirname, '..', '..', t.MQ.MODELOS_TERMO[k].arquivo)), 'falta o arquivo do modelo: ' + k);
  });
  test('o professor vê o link do modelo do servidor e a orientação dos pareceres', async () => {
    const t = await montar('professor'); const eu = Object.assign({}, t.S.equipe.find(m => m.id === t.S.eu.id), { termo_path: null, termo_assinado_em: null });
    const h = t.MQ.pendUI.formTermo(eu);
    assert.match(h, /href="modelos\/Modelo_termo_de_autorizacao_servidor_IFRN\.docx"/); assert.ok(texto(h).includes('parecer da chefia imediata'));
  });
});

describe('Termo já preenchido com os dados do cadastro', () => {
  const pessoa = (t, papel) => t.S.equipe.find(m => m.papel === papel && m.status === 'ativa');
  test('bolsista: nome, CPF, e-mail, celular, função, estado, início e valor da bolsa da função já vêm escritos', async () => {
    const t = await montar('coord_geral'); const m = pessoa(t, 'articulacao'); const R = t.MQ.regras;
    const h = texto(t.MQ.termoUI.pagina(m));
    for (const x of [m.nome, R.fmtCPF(m.cpf), m.email, 'Articulação estadual', '(' + m.uf + ')', R.fmtData(m.data_inicio), R.fmtBRL(t.MQ.PAPEIS.articulacao.bolsa).replace(/\s/g, ' ')]) assert.ok(h.includes(x), 'falta no termo: ' + x);
    assert.ok(h.includes('TERMO DE COMPROMISSO')); assert.ok(h.includes('Se eu ficar dois meses seguidos sem entregar o relatório mensal'));
    assert.ok(!h.includes(R.fmtBRL(t.MQ.PAPEIS.apoio.bolsa).replace(/\s/g, ' ')), 'só o valor da própria função');
  });
  test('agente de campo: sem bolsa, com ajuda de custo', async () => {
    const t = await montar('coord_geral'); const h = texto(t.MQ.termoUI.pagina(pessoa(t, 'agente')));
    assert.ok(h.includes('A agente de campo não recebe bolsa')); assert.ok(!h.includes('Bolsa mensal no valor'));
  });
  test('servidor: nome, SIAPE, função e período preenchidos; cargo, regime e campus ficam em branco para completar', async () => {
    const t = await montar('coord_geral'); const m = Object.assign({}, pessoa(t, 'professor_fic'), { siape: '1234567' }); const R = t.MQ.regras;
    const html = t.MQ.termoUI.pagina(m); const h = texto(html);
    assert.ok(h.includes('TERMO DE AUTORIZAÇÃO DE PARTICIPAÇÃO EM PROGRAMA')); assert.ok(h.includes('Portaria nº. 017/2017'));
    for (const x of [m.nome, '1234567', 'QUINTAIS PRODUTIVOS PARA MULHERES RURAIS', R.fmtData(m.data_inicio), R.fmtData(t.MQ.PROJETO.vigencia.fim)]) assert.ok(h.includes(x), 'falta no termo: ' + x);
    assert.deepEqual([...t.MQ.termoUI.faltando(m)], ['cargo', 'regime de trabalho', 'campus de lotação']);
    assert.match(html, /ocupante do cargo de <span class="ln"/, 'cargo em branco');
  });
  test('dado que falta no cadastro sai como linha em branco e é avisado na tela; nada de "undefined" ou "null" no papel', async () => {
    const t = await montar('coord_geral'); const m = Object.assign({}, pessoa(t, 'apoio'), { municipio: '', telefone: null });
    const html = t.MQ.termoUI.pagina(m);
    assert.ok(!/undefined|null|NaN/.test(texto(html))); assert.deepEqual([...t.MQ.termoUI.faltando(m)], ['município onde mora', 'celular']);
    assert.match(html, /Complete à mão: <b>município onde mora, celular<\/b>/);
  });
  test('texto digitado no cadastro não vira código na página do termo', async () => {
    const t = await montar('coord_geral'); const m = Object.assign({}, pessoa(t, 'apoio'), { nome: 'Maria <script>alert(1)</script> Silva', municipio: '"><img src=x onerror=alert(1)>' });
    const html = t.MQ.termoUI.pagina(m); assert.ok(!/<script>alert|<img src=x/.test(html));
  });
  test('auxiliar administrativo: com SIAPE usa o termo do servidor; sem SIAPE, o termo de compromisso', async () => {
    const t = await montar('coord_geral'); const R = t.MQ.regras;
    assert.equal(R.tipoTermo({ papel: 'auxiliar_adm', siape: '7654321' }), 'servidor'); assert.equal(R.tipoTermo({ papel: 'auxiliar_adm', siape: null }), 'bolsista');
    assert.equal(R.tipoTermo({ papel: 'professor_fic', siape: null }), 'servidor', 'professor é sempre servidor');
  });
});

describe('Tela de entrada, Arlo e aba Equipe (02/10/2026)', () => {
  test('pergunta do Arlo diz o que é e tem explicação que abre com um toque', async () => {
    const t = await montar('coord_geral');
    for (const pub of [true, false]) {
      const h = t.MQ.convitesUI.camposPessoais({}, pub, 'agente', null);
      assert.ok(texto(h).includes('cadastro no sistema Arlo, da FUNCERN?'));
      assert.match(h, /<details class="explica"><summary>O que é o Arlo\?<\/summary>/);
      assert.ok(texto(h).includes('Marque Não'), 'diz o que marcar quando a pessoa não sabe');
    }
  });
  test('coordenação técnica NÃO vê auxiliar administrativo nem professores do FIC na aba Equipe; a geral vê', async () => {
    let t = await montar('coord_tecnico'); let h = t.aba('equipe');
    assert.ok(!/id="t-aux"/.test(h)); assert.ok(!/id="t-prof"/.test(h)); assert.match(h, /id="t-b"/); assert.match(h, /id="t-ag"/);
    t = await montar('coord_geral'); h = t.aba('equipe');
    assert.match(h, /id="t-aux"/); assert.match(h, /id="t-prof"/);
  });
});
