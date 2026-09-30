/* Mulheres & Quintais — lembrete no topo de cada perfil (30/09/2026).
   Um quadro só, com no máximo duas linhas, nesta ordem:
   1) um prazo da própria pessoa que está chegando;
   2) uma data comemorativa ligada ao projeto, com sugestão de roda de conversa (quem faz campo e a coordenação técnica);
   3) se não houver nada disso, um número real do projeto (nunca frase genérica).
   Lista fixa: não há cadastro de datas (decisão da coordenação geral, 30/09/2026). */
(function () {
  const S = () => MQ.ui.S; const R = MQ.regras; const E = s => MQ.ui.esc(s);

  /* datas oficiais (ONU/FAO/leis federais) ligadas ao projeto; mês-dia, valem todo ano */
  const DATAS = [
    { md: '10-15', nome: 'Dia Internacional das Mulheres Rurais', roda: 'O que o quintal já mudou na renda e na autonomia de vocês? Cada uma traz um alimento do quintal para a roda.' },
    { md: '10-16', nome: 'Dia Mundial da Alimentação', roda: 'De onde vem a comida da nossa mesa? Comparar o que se compra com o que o quintal pode dar.' },
    { md: '11-25', nome: 'Dia Internacional pela Eliminação da Violência contra a Mulher', roda: 'Rede de apoio: onde buscar ajuda no município (CRAS, CREAS, Ligue 180).', cuidado: 'Tema delicado: combine antes com a coordenação técnica e convide alguém da rede de proteção para conduzir.' },
    { md: '12-05', nome: 'Dia Mundial do Solo', roda: 'Solo vivo: cobertura morta, compostagem e o que cada uma já faz no quintal.' },
    { md: '03-08', nome: 'Dia Internacional da Mulher', roda: 'O trabalho que não aparece: como se dividem as tarefas da casa e do quintal.' },
    { md: '03-22', nome: 'Dia Mundial da Água', roda: 'Cada gota conta: reúso da água da casa, cisterna e rega na hora certa.' },
    { md: '04-17', nome: 'Dia Internacional da Luta Camponesa', roda: 'Memória e terra: histórias das famílias e da comunidade.' },
    { md: '06-05', nome: 'Dia Mundial do Meio Ambiente', roda: 'Sementes crioulas: troca de sementes entre as participantes.' },
    { md: '06-17', nome: 'Dia Mundial de Combate à Desertificação e à Seca', roda: 'Conviver com o semiárido: plantas que aguentam a seca e como guardar água no solo.' },
    { md: '07-25', nome: 'Dia Internacional da Mulher Negra Latino-Americana e Caribenha e Dia Nacional de Tereza de Benguela', roda: 'Mulheres negras do campo: histórias de quem veio antes, na família e na comunidade.' },
    { md: '07-28', nome: 'Dia do Agricultor', roda: 'Visita a um quintal que está dando certo: o que dá para levar para o seu.' },
    { md: '09-21', nome: 'Dia da Árvore', roda: 'Árvores no quintal: sombra, fruta e quebra-vento.' }
  ];
  const ANTES_DATA = 21;   // mostra a data a partir de 3 semanas antes (tempo de organizar a roda)
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const quando = n => n === 0 ? 'hoje' : n === 1 ? 'amanhã' : 'faltam ' + n + ' dias';

  /* próxima ocorrência de cada data dentro da vigência do projeto */
  function proximaData(hoje) {
    const ano = +hoje.slice(0, 4); let melhor = null;
    for (const d of DATAS) for (const a of [ano, ano + 1]) {
      const dia = a + '-' + d.md; const n = R.diasAte(dia);
      if (n < 0 || n > ANTES_DATA || dia > MQ.PROJETO.vigencia.fim) continue;
      if (!melhor || n < melhor.n) melhor = Object.assign({ dia, n }, d);
    }
    return melhor;
  }

  /* 1) prazos da própria pessoa */
  function prazos(eu, hoje) {
    const P = MQ.PROJETO; const out = [];
    const nInd = R.diasAte(P.prazoIndicacao);
    if (eu.papel === 'coord_geral' && nInd >= 0 && nInd <= 14) {
      const eq = (S().equipe || []).filter(m => m.status === 'ativa');
      const tec = eq.some(m => m.papel === 'coord_tecnico'), bols = eq.filter(m => R.ehBolsista(m.papel)).length;
      if (!tec || bols < 10) out.push({ id: 'indicacao', t: `Prazo para o MPA indicar a coordenação técnica e as 10 bolsistas: <b>${R.fmtData(P.prazoIndicacao)}</b> (${quando(nInd)}).`,
        d: `Cadastradas até agora: ${tec ? 'coordenação técnica e ' : 'sem coordenação técnica; '}${bols} de 10 bolsistas.` });
    }
    if (eu.papel === 'coord_geral' && !S().execSemBanco && +hoje.slice(8, 10) >= 20) {   // planilha de gastos: pelo menos uma por mês
      const doMes = (S().execPlanilhas || []).some(p => String(p.enviado_em).slice(0, 7) === hoje.slice(0, 7));
      if (!doMes) out.push({ id: 'planilha-' + hoje.slice(0, 7), t: `Envie a <b>planilha de gastos de ${MESES[+hoje.slice(5, 7) - 1]}</b>.`, d: 'Na aba Execução. Sem ela, o executado do painel fica parado na planilha anterior.' });
    }
    const nDiag = R.diasAte(P.inicioDiagnosticos);
    if ((R.ehCampo(eu.papel) || R.decideCampo(eu.papel)) && nDiag >= 0 && nDiag <= 14)
      out.push({ id: 'diagnosticos', t: `Os diagnósticos nos quintais começam em <b>${R.fmtData(P.inicioDiagnosticos)}</b> (${quando(nDiag)}).`, d: R.ehCampo(eu.papel) ? 'Confira na ajuda o roteiro da visita e leve o celular carregado para registrar a localização no quintal.' : '' });
    if (R.ehCampo(eu.papel)) {
      const prox = (S().visitas || []).filter(v => v.executor_id === eu.id && !['realizada', 'cancelada'].includes(v.situacao) && v.data_prevista && R.diasAte(v.data_prevista) >= 0 && R.diasAte(v.data_prevista) <= 7)
        .sort((a, b) => String(a.data_prevista).localeCompare(String(b.data_prevista)));
      if (prox.length) { const f = (S().fichas || []).find(x => x.id === prox[0].ficha_id) || {};
        out.push({ id: 'visitas', t: `Você tem <b>${prox.length} visita${prox.length > 1 ? 's' : ''}</b> nos próximos 7 dias.`, d: `A próxima: ${R.fmtData(prox[0].data_prevista)}${f.municipio ? ' em ' + E(f.municipio) : ''}.` }); }
    }
    const recebeBolsa = ['coord_tecnico', 'articulacao', 'apoio', 'professor_fic', 'auxiliar_adm'].includes(eu.papel);
    if (recebeBolsa && R.habilitado(eu) && +hoje.slice(8, 10) >= 20) {
      const mes = hoje.slice(0, 7) + '-01'; const ini = String(eu.data_inicio || '').slice(0, 7);
      const pediu = (S().solic || []).some(s => s.equipe_id === eu.id && s.tipo === 'bolsa' && String(s.mes).slice(0, 7) === mes.slice(0, 7) && s.situacao !== 'devolvida');
      if (!pediu && (!ini || ini <= mes.slice(0, 7)))
        out.push({ id: 'bolsa-' + mes.slice(0, 7), t: `Você ainda não pediu a bolsa de <b>${MESES[+hoje.slice(5, 7) - 1]}</b>.`, d: 'Quem pede no mês recebe o mês todo. O pedido fica em Pagamentos.' });
    }
    return out;
  }

  /* 3) um número real do projeto, quando não há prazo nem data */
  function numero(eu) {
    const s = S(); const apr = (s.diagnosticos || []).filter(d => d.situacao === 'aprovado');
    if (R.ehCampo(eu.papel) && eu.uf) { const n = apr.filter(d => d.uf === eu.uf).length; const nome = MQ.ui.nomeUF ? MQ.ui.nomeUF(eu.uf) : eu.uf;
      return n ? `${nome}: <b>${n}</b> ${n === 1 ? 'quintal já tem' : 'quintais já têm'} diagnóstico aprovado, de ${MQ.META_UF.diagnosticos} previstos no estado.` : ''; }
    if (R.decideCampo(eu.papel)) { const n = apr.length; return n ? `<b>${n}</b> ${n === 1 ? 'quintal já tem' : 'quintais já têm'} diagnóstico aprovado, de ${MQ.META_UF.diagnosticos * MQ.UFS.length} no projeto.` : ''; }
    if (eu.papel === 'professor_fic') { const n = (s.matriculas || []).filter(m => !m.cancelada_em).length; return n ? `<b>${n}</b> ${n === 1 ? 'pessoa matriculada' : 'pessoas matriculadas'} no curso FIC.` : ''; }
    if (eu.papel === 'auxiliar_adm') { const n = (s.solic || []).filter(x => x.situacao === 'lancada').length; return n ? `<b>${n}</b> ${n === 1 ? 'pagamento lançado' : 'pagamentos lançados'} no Arlo.` : ''; }
    return '';
  }

  /* dispensar: esconde aquele lembrete neste aparelho (volta quando vier outro) */
  const CH = 'mq-lembretes-dispensados';
  const dispensados = () => { try { return JSON.parse(localStorage.getItem(CH) || '[]'); } catch (e) { return []; } };
  function dispensar(id) { try { const l = dispensados().filter(x => x !== id).concat([id]).slice(-40); localStorage.setItem(CH, JSON.stringify(l)); } catch (e) { /* sem armazenamento: só some até recarregar */ } }

  function itens() {
    const eu = S().eu; if (!eu) return [];
    const hoje = R.hoje(); const fora = dispensados();
    const l = prazos(eu, hoje).filter(i => !fora.includes(i.id)).slice(0, 1);   // o prazo mais importante
    if (R.ehCampo(eu.papel) || eu.papel === 'coord_tecnico') {
      const d = proximaData(hoje);
      if (d && !fora.includes('data-' + d.dia)) l.push({ id: 'data-' + d.dia, data: true,
        t: `<b>${R.fmtData(d.dia).slice(0, 5)} · ${E(d.nome)}</b> (${quando(d.n)}).`,
        d: `${eu.papel === 'coord_tecnico' ? 'Sugestão para as bolsistas levarem às comunidades' : 'Sugestão de roda de conversa'}: ${E(d.roda)}${d.cuidado ? ' <b>' + E(d.cuidado) + '</b>' : ''}` });
    }
    if (!l.length) { const n = numero(eu); if (n) l.push({ id: 'numero', t: n, num: true }); }
    return l.slice(0, 2);
  }

  function quadro() {
    const l = itens(); if (!l.length) return '';
    return `<div class="lembrete" role="note" aria-label="Lembrete"><div class="lembrete-in">
      <span class="lembrete-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2.4-5-6-5 0 3 2.4 5 6 5z"/></svg></span>
      <ul>${l.map(i => `<li${i.data ? ' class="lb-data"' : ''}><div class="lb-txt">${i.d ? `<details><summary><span>${i.t}</span> <span class="lb-mais small">${i.data ? 'Ver sugestão de roda' : 'Ver mais'}</span></summary><p class="small">${i.d}</p></details>` : `<p>${i.t}</p>`}</div>${i.num ? '' : `<button type="button" class="link small" data-acao="lembrete-ok" data-id="${E(i.id)}">Entendi</button>`}</li>`).join('')}</ul>
    </div></div>`;
  }

  MQ.lembreteUI = { quadro, itens, dispensar, proximaData, DATAS };
})();
