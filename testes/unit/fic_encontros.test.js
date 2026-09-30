/* 30/09/2026: encontros do curso FIC, lista de presença com confirmação de quem participou e relatório do professor na bolsa. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montar, texto } = require('./telas');

async function cenario() {
  const t = await montar('professor'); const hoje = t.MQ.regras.hoje();
  const prof = t.S.eu;
  await t.api.salvarTurma({ nome: 'Turma Piauí 1', professor_id: prof.id, uf: 'PI', inicio: '2026-09-01' });
  const turma = (await t.api.listarTurmas()).find(x => x.nome === 'Turma Piauí 1');
  const bol = t.S.equipe.find(m => m.papel === 'articulacao' && m.status === 'ativa');
  const tec = t.S.equipe.find(m => m.papel === 'coord_tecnico' && m.status === 'ativa');
  for (const m of [bol, tec]) { const ja = (await t.api.listarMatriculas()).find(x => x.equipe_id === m.id); if (!ja) await t.api.matricular(turma.id, m.id, 'SUAP' + m.id.slice(0, 5), hoje); }
  const mats = await t.api.listarMatriculas(); for (const m of mats.filter(x => [bol.id, tec.id].includes(x.equipe_id))) m.turma_id = turma.id;   // garante a mesma turma
  const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); d.matriculas.forEach(m => { if ([bol.id, tec.id].includes(m.equipe_id) && !m.cancelada_em) m.turma_id = turma.id; });
  t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await t.api.reler(); await t.trocar('professor');
  return { t, turma, bol, tec, hoje, prof };
}

test('professor registra encontro com a lista de presença; regras de data, conteúdo e matrícula', async () => {
  const { t, turma, bol, tec, hoje } = await cenario();
  await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: '2099-01-01', carga_horaria: 2, modalidade: 'presencial', conteudo: 'Aula sobre quintais', presentes: [] }), /futuro/);
  await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 2, modalidade: 'presencial', conteudo: 'curto', presentes: [] }), /trabalhado/);
  const outro = t.S.equipe.find(m => m.papel === 'agente');
  await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 2, modalidade: 'presencial', conteudo: 'Aula sobre quintais', presentes: [outro.id] }), /matriculado/);
  await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] });
  await t.trocar('professor');
  const e = t.S.encontros[0]; assert.equal(e.presencas.length, 2, 'todos os matriculados entram na lista');
  assert.equal(e.presencas.find(p => p.equipe_id === bol.id).presente, true); assert.equal(e.presencas.find(p => p.equipe_id === tec.id).presente, false);
  const h = texto(t.aba()); assert.match(h, /Encontros do curso e lista de presença/); assert.match(h, /presentes 1 de 2 · confirmaram 0/);
});

test('só o professor (e a coordenação geral) registram; a bolsista confirma e não desmarcam mais', async () => {
  const { t, turma, bol, hoje } = await cenario();
  await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] });
  const id = (await t.api.listarEncontrosFic())[0].id;
  await t.trocar('bolsista'); if (t.S.eu.id !== bol.id) { t.S.eu = await t.api.trocarPerfil('bolsista'); }
  await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 1, modalidade: 'ava', conteudo: 'Tentando registrar', presentes: [] }), /professor do FIC/);
  const eu = t.S.eu;
  assert.equal(eu.id, bol.id, 'o perfil bolsista da demonstração é a bolsista matriculada'); {
    const h = texto(t.aba()); assert.match(h, /Curso FIC: presença nos encontros/); assert.match(h, /Confirmo que participei/);
    assert.ok(t.MQ.lembreteUI.itens().some(i => /^presenca-/.test(i.id)), 'lembrete para confirmar');
    await t.api.confirmarPresencaFic(id); await assert.rejects(t.api.confirmarPresencaFic(id), /já está confirmada/);
    await t.trocar('bolsista'); assert.match(texto(t.aba()), /Tudo confirmado: 1 encontro/);
    await t.trocar('professor');
    await assert.rejects(t.api.salvarEncontroFic({ id, turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [] }), /já confirmou/);
  }
});

test('bolsa do professor: relatório com os encontros e a presença; mês sem encontro pede justificativa', async () => {
  const { t, turma, bol, hoje } = await cenario(); const mes = hoje.slice(0, 7);
  // sem encontro: sem justificativa recusa; a tela mostra o campo
  const form = texto(t.aba()); assert.match(form, /Por que não houve encontro neste mês\?/); assert.match(form, /Ações realizadas no mês/);
  await assert.rejects(t.api.solicitarPagamento('bolsa', mes + '-01', 2200, 'Planejamento das aulas e preparação do material do curso FIC no mês.', [], {}), /Nenhum encontro/);
  await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 4, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] });
  await t.trocar('professor');
  { const hh = texto(t.aba()); const k = hh.indexOf('Encontros de'); assert.match(hh, /1 encontro · 4 h · 0 de 1 presenças confirmadas/, hh.slice(k, k + 200)); }
  const id = await t.api.solicitarPagamento('bolsa', mes + '-01', 2200, 'Aulas do curso FIC, acompanhamento da turma e preparação das atividades no AVA.', [], {});
  const s = (await t.api.listarSolicitacoes()).lista.find(x => x.id === id);
  assert.equal(s.detalhe.fic_encontros.length, 1); assert.equal(s.detalhe.fic_carga_horaria, 4);
  assert.equal(s.detalhe.fic_encontros[0].presencas.find(p => p.presente).nome, t.S.equipe.find(m => m.id === bol.id).nome_social || t.S.equipe.find(m => m.id === bol.id).nome);
  // a coordenação vê o relatório e o valor da bolsa pelo perfil já no aval
  await t.trocar('coord_geral');
  const p = texto(t.painel({ tipo: 'pag-ver', id }));
  assert.match(p, /Relatório mensal do professor do curso FIC/); assert.match(p, /Encontros e lista de presença/); assert.match(p, /aguardando/);
  assert.match(p, /Bolsa do perfil\s*R\$\s?2\.200,00/); assert.match(p, /Imprimir ou salvar em PDF/);
  assert.match(t.painel({ tipo: 'pag-ver', id }), /name="valor"[^>]*value="2200,00"/, 'valor do perfil já preenchido no aval');
});

test('valor da bolsa pelo perfil: professor e auxiliar agora têm valor (planilha do TED)', async () => {
  const t = await montar('coord_geral'); const P = t.MQ.PAPEIS;
  assert.equal(P.professor_fic.bolsa, 2200); assert.equal(P.auxiliar_adm.bolsa, 1200);
  assert.equal(P.coord_tecnico.bolsa, 4700); assert.equal(Math.round(P.articulacao.bolsa), 2200); assert.equal(Math.round(P.apoio.bolsa), 1600);
});

test('antes do mês de início, o pedido não aparece (só o aviso de quando começa)', async () => {
  const t = await montar('professor'); const eu = t.S.equipe.find(m => m.id === t.S.eu.id);
  eu.data_inicio = '2099-01-01'; t.S.eu.data_inicio = '2099-01-01';
  const h = t.aba(); assert.match(texto(h), /Você começa no projeto em jan\/2099/); assert.ok(!/data-form="pag-bolsa"/.test(h), 'sem formulário de pedido antes do início');
});
