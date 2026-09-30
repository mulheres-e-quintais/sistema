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

test('coordenação geral registra encontro no lugar do professor: fica em nome do professor da turma (entra no relatório dele)', async () => {
  const { t, turma, bol, hoje, prof } = await cenario();
  await t.trocar('coord_geral');
  await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 2, modalidade: 'ava', conteudo: 'Atividade no AVA sobre compostagem', presentes: [bol.id] });
  const e = (await t.api.listarEncontrosFic()).find(x => x.conteudo === 'Atividade no AVA sobre compostagem');
  assert.equal(e.professor_id, prof.id);
});

/* revisão 01/10/2026: dono da turma, turma fixa, matrícula na data, duplicidade, cancelamento e mês fechado ao pedir a bolsa */
async function comoOutraProfessora(t) {
  const d = JSON.parse(t.janela.localStorage.getItem('mq-demo-v4')); const outra = d.equipe.find(m => m.papel === 'professor_fic' && m.id !== d.eu.professor);
  d.eu.professor = outra.id; t.janela.localStorage.setItem('mq-demo-v4', JSON.stringify(d)); await t.api.reler(); await t.trocar('professor'); return outra;
}
test('outro professor não registra, não altera e não cancela encontro de turma que não é dele (e não vê na tela)', async () => {
  const { t, turma, bol, hoje } = await cenario();
  await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] });
  const id = (await t.api.listarEncontrosFic())[0].id;
  await comoOutraProfessora(t);
  await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 2, modalidade: 'ava', conteudo: 'Aula na turma alheia', presentes: [] }), /outro\(a\) professor/);
  await assert.rejects(t.api.salvarEncontroFic({ id, turma_id: turma.id, data: hoje, carga_horaria: 11, modalidade: 'ava', conteudo: 'Alterando o encontro alheio', presentes: [] }), /outro\(a\) professor/);
  await assert.rejects(t.api.cancelarEncontroFic(id, 'Cancelando encontro de outra pessoa'), /outro\(a\) professor/);
  const h = texto(t.aba()); assert.ok(!/Planejamento do quintal e calendário/.test(h), 'a lista da outra professora não mostra encontro alheio');
});
test('a turma não muda; clique duplo não duplica; quem se matriculou depois da data fica fora da lista', async () => {
  const { t, turma, bol, hoje, prof } = await cenario();
  await t.api.salvarTurma({ nome: 'Turma Piauí 2', professor_id: prof.id, uf: 'PI', inicio: '2026-09-01' });
  const t2 = (await t.api.listarTurmas()).find(x => x.nome === 'Turma Piauí 2');
  const x = { turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] };
  const id = await t.api.salvarEncontroFic(x);
  await assert.rejects(t.api.salvarEncontroFic(x), /já está registrado/);
  await assert.rejects(t.api.salvarEncontroFic(Object.assign({}, x, { id, turma_id: t2.id, presentes: [] })), /turma de um encontro não muda/);
  const antes = '2026-09-01' < hoje ? '2026-09-01' : null;
  if (antes) {   // matrícula de hoje: no encontro de 01/09 ninguém estava matriculado
    await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: antes, carga_horaria: 2, modalidade: 'ava', conteudo: 'Encontro antes da matrícula', presentes: [bol.id] }), /na data do encontro/);
    const v = await t.api.salvarEncontroFic({ turma_id: turma.id, data: antes, carga_horaria: 2, modalidade: 'ava', conteudo: 'Encontro antes da matrícula', presentes: [] });
    assert.equal((await t.api.listarEncontrosFic()).find(e => e.id === v).presencas.length, 0);
  }
  await assert.rejects(t.api.salvarEncontroFic(Object.assign({}, x, { conteudo: 'Outro encontro no mesmo dia', carga_horaria: 0.04 })), /carga horária/);
});
test('encontro cancelado (com motivo) fica guardado, sai do relatório e não se confirma', async () => {
  const { t, turma, bol, hoje } = await cenario(); const mes = hoje.slice(0, 7);
  const id = await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'online', conteudo: 'Oficina lançada por engano no sistema', presentes: [bol.id] });
  await assert.rejects(t.api.cancelarEncontroFic(id, 'x'), /motivo/);
  await t.api.cancelarEncontroFic(id, 'Lançado por engano, duplicado');
  await assert.rejects(t.api.cancelarEncontroFic(id, 'Lançado por engano, duplicado'), /já foi cancelado/);
  await assert.rejects(t.api.salvarEncontroFic({ id, turma_id: turma.id, data: hoje, carga_horaria: 3, modalidade: 'online', conteudo: 'Oficina lançada por engano no sistema', presentes: [bol.id] }), /cancelado/);
  await t.trocar('professor'); const h = texto(t.aba()); assert.match(h, /cancelado/); assert.match(h, /0 encontros · 0 h/);
  await t.trocar('bolsista'); await assert.rejects(t.api.confirmarPresencaFic(id), /cancelado/); assert.equal(t.MQ.encUI.paraConfirmar().length, 0);
  await t.trocar('professor');
  await assert.rejects(t.api.solicitarPagamento('bolsa', mes + '-01', 2200, 'Aulas do curso FIC, acompanhamento da turma e preparação das atividades no AVA.', [], {}), /Nenhum encontro/);
});
test('bolsa pedida fecha o mês (como as visitas): não inclui nem altera encontro; devolvida reabre', async () => {
  const { t, turma, bol, hoje } = await cenario(); const mes = hoje.slice(0, 7);
  const id = await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 4, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] });
  const sid = await t.api.solicitarPagamento('bolsa', mes + '-01', 2200, 'Aulas do curso FIC, acompanhamento da turma e preparação das atividades no AVA.', [], {});
  await assert.rejects(t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 2, modalidade: 'ava', conteudo: 'Encontro depois do pedido', presentes: [] }), /já foi pedida/);
  await assert.rejects(t.api.salvarEncontroFic({ id, turma_id: turma.id, data: hoje, carga_horaria: 12, modalidade: 'presencial', conteudo: 'Planejamento do quintal e calendário de plantio', presentes: [bol.id] }), /já foi pedida/);
  await t.trocar('coord_geral'); await t.api.avalizarPagamento(sid, false, 'Faltou detalhar as atividades do mês.');
  await t.trocar('professor');
  await t.api.salvarEncontroFic({ turma_id: turma.id, data: hoje, carga_horaria: 2, modalidade: 'ava', conteudo: 'Encontro depois da devolução', presentes: [] });
});
test('lembrete da planilha: envio às 22 h de Brasília (já é outro dia em UTC) conta no mês local', async () => {
  const t = await montar('coord_geral'); const R = t.MQ.regras;
  const iso = new Date(new Date(R.hoje() + 'T22:30:00').getTime()).toISOString();
  assert.equal(R.diaLocal(iso), R.hoje()); assert.equal(R.diaLocal('2026-09-30'), '2026-09-30'); assert.equal(R.diaLocal(null), null);
});
