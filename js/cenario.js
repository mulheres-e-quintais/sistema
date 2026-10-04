/* Mulheres & Quintais — CENÁRIO "PROJETO AMPLIADO" (só no modo demonstração)
   Simula a ação 5 vezes maior e perto do fim: 1.000 quintais, 200 por estado, com as metas do plano também
   multiplicadas por 5. Serve para mostrar o sistema cheio. Nunca vale em produção (exige supabaseUrl vazio).
   Entra com ?cenario=ampliado no endereço; sai com ?cenario=normal. Vale enquanto a aba do navegador estiver aberta.
   Os dados são gerados na hora, sempre iguais, e NÃO são guardados no aparelho: o que for mudado some ao recarregar. */
(function () {
  const R = MQ.regras, K = 5, CH = 'mq-cenario', MESES_ATRAS = 10;
  function ativo() {
    try {
      if (MQ.CONFIG && MQ.CONFIG.supabaseUrl) return false;   // produção: nunca
      const q = new URLSearchParams(location.search).get('cenario');
      if (q === 'ampliado') sessionStorage.setItem(CH, 'ampliado'); else if (q) sessionStorage.removeItem(CH);
      return sessionStorage.getItem(CH) === 'ampliado';
    } catch (e) { return false; }
  }
  const recuar = (iso, meses) => { const [a, m, d] = String(iso).split('-').map(Number); const x = new Date(Date.UTC(a, m - 1 - meses, d || 1)); return x.toISOString().slice(0, d ? 10 : 7); };
  /* metas, vagas, tetos e orçamento × 5; o calendário do projeto recua 10 meses (hoje cai perto do fim da vigência) */
  let aplicado = false;
  function aplicar() {
    if (aplicado) return; aplicado = true;
    Object.keys(MQ.META_UF).forEach(k => { MQ.META_UF[k] *= K; });
    MQ.VAGAS_UF *= K; MQ.DIAS_CAMPO_UF *= K;
    MQ.METAS.forEach(m => { if (['M2', 'M3', 'M4'].includes(m.id)) m.alvo *= K; if (m.valor) m.valor *= K; });
    Object.keys(MQ.TETOS).forEach(k => { MQ.TETOS[k] *= K; });
    const O = MQ.ORCAMENTO; O.total *= K; O.repasses.forEach(r => { r.valor *= K; r.mes = recuar(r.mes, MESES_ATRAS); });
    O.cronograma.inicio = recuar(O.cronograma.inicio, MESES_ATRAS); O.cronograma.meses = O.cronograma.meses.map(v => v * K);
    O.rubricas.forEach(r => (r.itens || []).forEach(i => { i.total *= K; if (i.unitario && typeof i.unitario.qtd === 'number') i.unitario.qtd *= K; }));
    const P = MQ.PROJETO; P.vigencia.inicio = recuar(P.vigencia.inicio, MESES_ATRAS); P.vigencia.fim = recuar(P.vigencia.fim, MESES_ATRAS);
    ['inicioBolsas', 'prazoIndicacao', 'inicioDiagnosticos'].forEach(k => { P[k] = recuar(P[k], MESES_ATRAS); });
    MQ.MARCOS.forEach(m => { m.d = recuar(m.d, MESES_ATRAS); });
    if (R.LIM) R.LIM.visitaMin = '2025-01-01';
    if (MQ.calendarioProjeto) MQ.calendarioProjeto();
  }
  /* sorteio com semente fixa: o cenário sai sempre igual */
  function sorteio(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const NOMES = ['Maria', 'Francisca', 'Antônia', 'Josefa', 'Raimunda', 'Luzia', 'Cícera', 'Rita', 'Ana', 'Rosa', 'Edilene', 'Ivonete', 'Marlene', 'Socorro', 'Damiana', 'Severina', 'Joana', 'Tereza', 'Lúcia', 'Zefinha', 'Neide', 'Aparecida', 'Valdete', 'Cleide', 'Edna', 'Geralda', 'Irene', 'Jacira', 'Lindalva', 'Quitéria'];
  const MEIO = ['Maria', 'das Graças', 'de Fátima', 'do Carmo', 'da Conceição', 'de Lourdes', 'Aparecida', 'do Socorro', 'de Jesus', 'das Dores', ''];
  const SOBRE = ['Silva', 'Souza', 'Santos', 'Oliveira', 'Lima', 'Pereira', 'Ferreira', 'Alves', 'Ribeiro', 'Gomes', 'Barbosa', 'Rodrigues', 'Nunes', 'Reis', 'Araújo', 'Bezerra', 'Cavalcante', 'Moura', 'Nascimento', 'Batista'];
  const COMUN = ['Lagoa do Mato', 'Barra', 'Caldeirão', 'Novo Horizonte', 'Sítio Baixio', 'Riacho Seco', 'Serra Branca', 'Umburana', 'Poço Dantas', 'Boa Vista', 'Malhada', 'Olho d’Água', 'Várzea Grande', 'Juazeiro', 'Angico'];
  const DDD = { AL: '82', BA: '74', PE: '87', PI: '89', SE: '79' };

  function ampliar(mem, util) {
    aplicar();
    const rnd = sorteio(20261004), pick = l => l[Math.floor(rnd() * l.length)], entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const hoje = R.hoje(), dia = n => R.somaDias(hoje, -n), hora = (d, h) => d + 'T' + String(h).padStart(2, '0') + ':00:00.000Z';
    const cg = mem.equipe.find(m => m.papel === 'coord_geral'), ct = mem.equipe.find(m => m.papel === 'coord_tecnico');
    const modeloB = mem.equipe.find(m => m.id === mem.eu.bolsista), modeloA = mem.equipe.find(m => m.id === mem.eu.agente) || modeloB;
    const fichaM = mem.fichas.find(f => f.resultado === 'selecionada' && f.situacao === 'aprovada'), visM = mem.visitas[0], diagM = mem.diagnosticos[0];
    let cpfN = 300000000; const cpf = () => util.gerarCPF(cpfN += 7919);
    const pessoa = (modelo, o) => Object.assign({}, modelo, { id: util.uid(), user_id: null, cpf: cpf(), foto_path: 'exemplo', foto_url: 'assets/exemplo/pessoa-' + pick([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17]) + '.svg',
      data_inicio: MQ.PROJETO.inicioBolsas, criado_em: hora(dia(305), 12), atualizado_em: hora(dia(300), 12), exemplo: true }, o);
    const nomeDe = () => { const m = pick(MEIO); return pick(NOMES) + (m ? ' ' + m : '') + ' ' + pick(SOBRE) + (rnd() < .5 ? ' ' + pick(SOBRE) : ''); };
    // datas da equipe que já existia recuam com o calendário
    mem.equipe.forEach(m => { if (m.papel !== 'coord_geral') { m.data_inicio = MQ.PROJETO.inicioBolsas; ['matricula_fic_em', 'docs_funcern_em', 'termo_assinado_em'].forEach(k => { if (m[k]) m[k] = dia(295); }); } });
    const fichas = [], visitas = [], diagnosticos = [], avaliacoes = [];
    MQ.UFS.forEach((U, iu) => { const uf = U.uf || U[0] || U, munis = MQ.MUNICIPIOS[uf] || ['Sede'];
      // equipe do estado: 2 bolsistas e 8 agentes de campo (aproveita quem já existe)
      const daUF = p => mem.equipe.filter(m => m.uf === uf && m.status === 'ativa' && p(m));
      const bols = daUF(m => R.ehBolsista(m.papel));
      ['articulacao', 'apoio'].forEach(papel => { if (!bols.some(b => b.papel === papel)) { const n = nomeDe(); const b = pessoa(modeloB, { papel, uf, nome: n + ' (exemplo)', email: 'bolsista.' + uf.toLowerCase() + bols.length + '@exemplo.invalid', telefone: '(' + DDD[uf] + ') 99' + entre(100, 999) + '-' + entre(1000, 9999), municipio: munis[0],
        meta_diagnosticos: 100, meta_quintais: 100, meta_visitas: 200, criado_por: ct.id }); mem.equipe.push(b); bols.push(b); } });
      bols.forEach(b => { b.meta_diagnosticos = 100; b.meta_quintais = 100; b.meta_visitas = 200; });
      const agentes = daUF(m => m.papel === 'agente');
      while (agentes.length < 8) { const a = pessoa(modeloA, { papel: 'agente', uf, nome: nomeDe() + ' (exemplo)', email: 'agente.' + uf.toLowerCase() + agentes.length + '@exemplo.invalid', telefone: '(' + DDD[uf] + ') 98' + entre(100, 999) + '-' + entre(1000, 9999),
        municipio: munis[agentes.length % munis.length], meta_diagnosticos: null, meta_quintais: null, meta_visitas: null, criado_por: bols[0].id }); mem.equipe.push(a); agentes.push(a); }
      const campo = bols.concat(agentes);
      const ficha = (i, o) => { const mun = munis[i % munis.length], com = COMUN[(i * 7 + iu) % COMUN.length], dF = dia(entre(235, 298));
        const f = Object.assign({}, fichaM, { id: 'fa' + uf + String(i).padStart(4, '0'), uf, municipio: mun, comunidade: (/^Sítio/.test(com) ? '' : 'Comunidade ') + com, nome: nomeDe() + ' (exemplo)', cpf: cpf(),
          data_nascimento: entre(1960, 2002) + '-' + String(entre(1, 12)).padStart(2, '0') + '-' + String(entre(1, 28)).padStart(2, '0'), celular: '(' + DDD[uf] + ') 99' + entre(100, 999) + '-' + entre(1000, 9999),
          endereco: 'Sítio ' + com + ', casa ' + (i + 1) + ', ' + mun, pessoas_familia: entre(2, 7), indicada_por: pick(['Associação de Mulheres', 'MPA', 'Sindicato dos Trabalhadores Rurais', 'Agente de saúde']) + ' de ' + mun,
          p_sustento: rnd() < .45, p_cadunico: rnd() < .8, p_sem_ater: rnd() < .7, p_raca_povo: rnd() < .35, p_jovem: rnd() < .15, p_grupo: rnd() < .6, p_caf: rnd() < .3,
          latitude: null, longitude: null, bolsista_id: bols[i % bols.length].id, data_ficha: dF, criado_em: hora(dF, 13), aprovada_por: ct.id, aprovada_em: hora(R.somaDias(dF, 2), 14), atualizado_em: hora(R.somaDias(dF, 2), 14),
          resultado: 'selecionada', situacao: 'aprovada', posicao_espera: null, obs_coordenacao: null, exemplo: true }, o);
        f.pontos = R.pontosFicha(f); return f; };
      const visita = (f, etapa, quem, prev, feita, n) => ({ ...visM, id: 'va' + f.id.slice(2) + etapa.slice(0, 2) + (n || ''), ficha_id: f.id, uf, etapa, executor_id: quem.id, data_prevista: prev, data_realizada: feita ? prev : null,
        situacao: feita ? 'realizada' : 'prevista', obs: null, relato: feita && etapa !== 'diagnostico' ? 'Visita feita com a família; quintal conferido e orientações registradas.' : null, criado_por: bols[0].id, criado_em: hora(R.somaDias(prev, -6), 15), atualizado_em: hora(prev, 20) });
      for (let i = 0; i < 200; i++) { const f = ficha(i); fichas.push(f); const quem = campo[i % campo.length];
        const dD = R.somaDias(f.data_ficha, entre(15, 35)); const vD = visita(f, 'diagnostico', quem, dD, true); visitas.push(vD);
        diagnosticos.push(Object.assign({}, diagM, { id: 'da' + f.id.slice(2), ficha_id: f.id, visita_id: vD.id, uf, executor_id: quem.id, data_visita: dD, codigo_quintal: uf + '-' + String(i + 1).padStart(4, '0'),
          latitude: null, longitude: null, sem_gps_motivo: 'Sem sinal de GPS no local', area_m2: entre(12, 60) * 10, renda_familiar: entre(6, 22) * 100, renda_quintal: entre(0, 6) * 50, agua_seca: pick(['sim', 'sim', 'as_vezes', 'nao']), sem_agua: false,
          lote: 1 + (i % 5), situacao: 'aprovado', aprovado_por: ct.id, aprovado_em: hora(R.somaDias(dD, 4), 14), obs_coordenacao: null, criado_em: hora(dD, 20), atualizado_em: hora(R.somaDias(dD, 4), 14), exemplo: true }));
        const implantou = rnd() < .97, dI = dia(entre(140, 200)); visitas.push(visita(f, 'implantacao', quem, implantou ? dI : R.somaDias(hoje, entre(3, 20)), implantou));
        if (!implantou) continue;
        const a1 = rnd() < .96, d1 = R.somaDias(dI, entre(40, 60)); visitas.push(visita(f, 'acompanhamento', quem, a1 ? d1 : R.somaDias(hoje, entre(2, 15)), a1, 1));
        const a2 = a1 && rnd() < .9, d2 = R.somaDias(d1, entre(35, 50)); if (a1) visitas.push(visita(f, 'acompanhamento', quem, a2 ? d2 : R.somaDias(hoje, entre(2, 25)), a2, 2));
        if (!a2) continue;
        const av = rnd() < .55, dA = dia(entre(1, 30)); const vA = visita(f, 'avaliacao', quem, av ? dA : R.somaDias(hoje, entre(3, 40)), av); visitas.push(vA);
        if (av) { const antes = diagnosticos[diagnosticos.length - 1].renda_quintal, depois = antes + entre(2, 9) * 50; const ebia = pick([0, 0, 0, 1, 2, 3]);
          avaliacoes.push({ id: 'aa' + f.id.slice(2), ficha_id: f.id, visita_id: vA.id, uf, executor_id: quem.id, data_visita: dA, latitude: null, longitude: null, sem_gps_motivo: 'Sem sinal de GPS no local', quintal_produz: pick(['sim', 'sim', 'sim', 'sim', 'em_parte', 'nao']),
            ebia_pontos: ebia, ebia_nivel: ebia === 0 ? 'seguranca' : ebia <= 3 ? 'leve' : 'moderada', fotos: ['exemplo'], criado_em: hora(dA, 20), atualizado_em: hora(dA, 20), exemplo: true,
            dados: { motivo: null, renda_quintal: depois, horas_dia: entre(2, 5), agua: pick(['sim', 'sim', 'sim', 'as_vezes']), alimentacao: pick(['melhorou', 'melhorou', 'melhorou', 'igual']), encaminhamentos: '', fala: pick(['Hoje tem verdura na mesa todo dia.', 'Já vendo na feira toda semana.', 'O quintal mudou a vida aqui de casa.', 'Aprendi a guardar a água para a seca.']),
              impacto: { ebia_pontos: ebia, ebia_nivel: ebia === 0 ? 'seguranca' : 'leve', renda_antes: antes, renda_depois: depois } } }); }
      }
      for (let i = 0; i < 12; i++) fichas.push(ficha(200 + i, { resultado: 'lista_espera', posicao_espera: i + 1 }));
      for (let i = 0; i < 2; i++) { const dF = dia(entre(1, 6)); fichas.push(ficha(212 + i, { situacao: 'aguardando', aprovada_por: null, aprovada_em: null, data_ficha: dF, criado_em: hora(dF, 12), atualizado_em: hora(dF, 12), resultado: 'lista_espera', posicao_espera: 13 + i })); }
    });
    mem.fichas = fichas; mem.visitas = visitas; mem.diagnosticos = diagnosticos; mem.avaliacoes = avaliacoes; mem.ampliado = true;
    return mem;
  }
  MQ.cenario = { ativo, aplicar, ampliar, K, rotulo: 'Cenário ampliado: 1.000 quintais, 200 por estado (5 vezes o plano de trabalho)' };
})();
