// injeta no modo demonstração o volume do FIM do projeto: 25 pessoas, 200 fichas, 1.000 visitas, 200 diagnósticos, 700 pagamentos, 1.500 registros de histórico
module.exports = async function volume(p) {
  await p.evaluate(async () => { await MQ.apiDemo.recomecar(); });
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('mq-demo-v4'));
    const UFS = ['AL', 'BA', 'PE', 'PI', 'SE']; const uid = () => crypto.randomUUID(); const hoje = new Date();
    const dia = n => new Date(hoje.getTime() + n * 864e5).toISOString().slice(0, 10);
    const f0 = d.fichas[0], v0 = d.visitas[0], g0 = d.diagnosticos[0] || null;
    const ag = d.equipe.filter(m => m.papel === 'agente'); const exec = uf => (d.equipe.find(m => m.uf === uf && ['agente', 'articulacao', 'apoio'].includes(m.papel)) || ag[0] || d.equipe[0]).id;
    d.fichas = []; d.visitas = []; d.diagnosticos = []; d.solicitacoes = d.solicitacoes || [];
    for (let i = 0; i < 200; i++) {
      const uf = UFS[i % 5]; const id = uid();
      d.fichas.push(Object.assign({}, f0, { id, uf, nome: 'Mulher Teste ' + i + ' da Silva', cpf: String(10000000000 + i * 7919).slice(0, 11), endereco: 'Sítio Volume ' + (i % 170), municipio: f0.municipio,
        comunidade: 'Comunidade ' + (i % 23), situacao: i % 10 === 0 ? 'aguardando' : 'aprovada', resultado: i % 7 === 0 ? 'lista_espera' : 'selecionada', data_ficha: dia(-60 + (i % 50)), criado_em: dia(-60) }));
      const etapas = ['diagnostico', 'implantacao', 'acompanhamento', 'acompanhamento', 'avaliacao'];
      etapas.forEach((e, k) => { const vid = uid(); const feita = k < 2 || (k < 4 && i % 2);
        d.visitas.push(Object.assign({}, v0, { id: vid, ficha_id: id, uf, etapa: e, executor_id: exec(uf), situacao: feita ? 'realizada' : 'prevista', data_prevista: dia(-40 + k * 20 + (i % 9)),
          data_realizada: feita ? dia(-40 + k * 20) : null, relato: feita ? 'Visita feita, plantio conferido e orientações passadas.' : null }));
        if (k === 0 && g0) d.diagnosticos.push(Object.assign({}, g0, { id: uid(), ficha_id: id, visita_id: vid, uf, situacao: i % 5 ? 'aprovado' : 'aguardando', executor_id: exec(uf) })); });
    }
    const base = d.solicitacoes[0];
    if (base) { const pes = d.equipe.filter(m => m.status === 'ativa' && m.papel !== 'coord_geral'); d.solicitacoes = [];
      for (let i = 0; i < 700; i++) { const m = pes[i % pes.length]; d.solicitacoes.push(Object.assign({}, base, { id: uid(), equipe_id: m.id, tipo: m.papel === 'agente' ? 'ajuda_custo' : 'bolsa',
        mes: dia(-330 + (i % 12) * 30).slice(0, 7) + '-01', situacao: ['lancada', 'lancada', 'avalizada', 'solicitada', 'devolvida'][i % 5] })); } }
    const a0 = d.auditoria[0]; if (a0) { for (let i = 0; i < 1500; i++) d.auditoria.push(Object.assign({}, a0, { id: 100000 + i })); }
    localStorage.setItem('mq-demo-v4', JSON.stringify(d));
  });
  await p.reload(); await p.waitForSelector('main');
  return p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mq-demo-v4')); return { fichas: d.fichas.length, visitas: d.visitas.length, diag: d.diagnosticos.length, pag: (d.solicitacoes || []).length, hist: d.auditoria.length, kb: Math.round(localStorage.getItem('mq-demo-v4').length / 1024) }; });
};
