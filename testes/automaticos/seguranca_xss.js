// SEGURANÇA: todo texto livre gravado no banco é envenenado com código (HTML/JS).
// Percorre todas as telas de todos os perfis, abre os detalhes dos itens e a página pública (#numeros).
// Se algum código rodar, diz em qual campo estava. Uso: node seguranca_xss.js <caminho do playwright>
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
// campos que são código interno (não texto digitado): trocar quebraria a lógica, não testa XSS
const INTERNO = /(^id$|_id$|^ids?$|^uf$|papel|situacao|status|^tipo|etapa|resultado|categoria|path|^cor$|chave|_em$|^data|cpf|^mes|sexo|bagagem|_tipo$|acao|tabela|^aba$|^nivel$|cep$|^fone|celular|telefone|^valor|^ano$|^cid|^ibge|^lat|^lon|gps|numero$|^modo$|^turno$|^cat$|^nis$|^rg$|siape|banco$|agencia|^conta$|pix|^token|codigo|^hash$|^perfil$|email)/i;
const DATA = /^\d{4}-\d{2}(-\d{2})?(T.*)?$/;
let n = 0; const campos = {};
function envenenar(o, trilha) {
  if (Array.isArray(o)) return o.map((x, i) => envenenar(x, trilha));
  if (trilha === '.eu' || trilha === '.perfil') return o;   // mapa perfil → id da demonstração
  if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = typeof v === 'string' && !INTERNO.test(k) && !DATA.test(v) && v.length > 1 && !/^[a-z_]+$/.test(v) ? marcar(v, trilha + '.' + k) : envenenar(v, trilha + '.' + k); return r; }
  return o;
}
function marcar(v, onde) { const i = n++; campos[i] = onde; return v + `<img src=x onerror="(window.__xss=window.__xss||[]).push(${i})"><svg onload="(window.__xss=window.__xss||[]).push(${i})"></svg>`; }
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true })   // sem a política de conteúdo: aqui se testa a 1ª barreira (o texto escapado); a 2ª (CSP) é testada em politica_conteudo.js
  ;; const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => { errs.push(e.message); if (process.env.DEBUG) console.log('STACK', e.stack.split('\n').slice(0, 5).join(' / ')); }); p.on('dialog', d => { errs.push('ALERTA: ' + d.message()); d.dismiss(); });
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('main');
  // entra uma vez em cada perfil para a demonstração criar todos os dados; depois envenena
  for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar'])
    await p.evaluate(pf => { MQ.ui.S.verEntrada = false; const bt = document.querySelector(`button[data-p=${pf}]`); if (bt) bt.click(); }, pf).catch(() => {});
  await p.waitForTimeout(400);
  const bruto = await p.evaluate(() => localStorage.getItem('mq-demo-v4'));
  const dados = JSON.parse(bruto);
  // tabelas que a demonstração começa vazias: cria linhas em todas as situações para o texto aparecer nas listas
  const pes = papel => (dados.equipe.find(e => e.papel === papel) || dados.equipe[0]);
  const art = pes('articulacao'), tec = pes('coord_tecnico'), ger = pes('coord_geral'), ag = pes('agente');
  const hoje = new Date().toISOString().slice(0, 10), mes = hoje.slice(0, 8) + '01', agora = new Date().toISOString();
  dados.pedidos = ['enviado', 'conferido', 'autorizado', 'devolvido', 'recusado', 'cancelado'].flatMap((sit, i) => ['passagem', 'evento'].map(tipo => ({
    id: `x-ped-${tipo}-${i}`, tipo, uf: art.uf, solicitante_id: art.id, criado_em: agora, titulo: 'Reunião regional', data_ref: '2027-03-10',
    dados: { valor_estimado: 1000, origem: 'Teresina', destino: 'Brasília', volta_para: 'Teresina', sugestao: 'Voo da manhã', local: 'Salão da associação', publico: 'Mulheres do território',
      programacao: 'Abertura e oficinas', itens: 'Tenda e som', passageiros: [{ nome: 'Maria Passageira', cpf: '52998224725', rg: '123', rg_orgao: 'SSP', nascimento: '1980-01-01', sexo: 'f', celular: '86999999999' }] },
    justificativa_prazo: 'Evento marcado em cima da hora pelo território', situacao: sit, obs_conferencia: 'Conferido com cuidado', obs_decisao: 'Decisão registrada', motivo: 'Faltou documento',
    enviado_em: agora, valor_autorizado: sit === 'autorizado' ? 900 : null })));
  dados.documentos = [0, 1].map(i => ({ id: 'x-doc-' + i, tipo: 'ata', titulo: 'Ata da reunião', descricao: 'Reunião com o MPA', uf: i ? art.uf : null, data_documento: hoje,
    arquivo_path: '2026/x_ata.pdf', arquivo_nome: 'ata da reunião.pdf', tamanho: 1000, mime: 'application/pdf', enviado_por: ger.id, enviado_em: agora,
    arquivado_em: i ? agora : null, arquivado_por: i ? ger.id : null, motivo_arquivo: i ? 'Versão substituída por outra' : null }));
  dados.solicitacoes = [[tec, 'bolsa', 'solicitada'], [art, 'bolsa', 'avalizada'], [ag, 'ajuda_custo', 'devolvida'], [art, 'bolsa', 'lancada']].map(([p, tipo, sit], i) => ({
    id: 'x-sol-' + i, tipo, equipe_id: p.id, mes, situacao: sit, valor_solicitado: 100, valor_avalizado: sit === 'solicitada' ? null : 100,
    relatorio: 'Relatório de atividades do mês com visitas, reuniões e articulação no território.', detalhe: { obs: 'Detalhe do mês' },
    obs_aval: 'Aval com observação', motivo_devolucao: 'Faltou detalhar', protocolo_arlo: 'ARLO-123', solicitada_em: agora }));
  dados.execPlanilhas = [{ id: 'x-p-0', posicao_em: hoje, arquivo_path: '2026/x_gastos.xlsx', arquivo_nome: 'gastos de setembro.xlsx', obs: 'Planilha da FUNCERN', total_gasto: 5000, total_recebido: 1000000, nao_classificadas: 1,
    enviado_por: ger.id, enviado_em: agora, linhas: [{ linha: 2, data: hoje, texto: 'Repasse do MDA', item: 'repasse_mda', rubrica: null, descricao: 'Nota de crédito', documento: 'NC 14', valor: 1000000 },
      { linha: 3, data: hoje, texto: 'Implantação dos quintais', item: 'quintais', rubrica: 'r7', descricao: 'Kit do quintal', documento: 'NF 1', valor: 5000 },
      { linha: 4, data: hoje, texto: 'Coffee break da reunião', item: null, rubrica: null, descricao: 'Lanche da reunião', documento: 'NF 2', valor: 300 }] }];
  const tur = (dados.turmas || [])[0]; const prof = pes('professor_fic');
  if (tur) { dados.ficEncontros = [{ id: 'x-e-0', turma_id: tur.id, professor_id: prof.id, data: hoje, carga_horaria: 4, modalidade: 'presencial', conteudo: 'Planejamento do quintal e plantio', criado_em: agora, atualizado_em: agora }];
    dados.ficPresencas = dados.equipe.filter(m => ['articulacao', 'apoio', 'agente', 'coord_tecnico'].includes(m.papel)).map((m, i) => ({ id: 'x-p' + i, encontro_id: 'x-e-0', equipe_id: m.id, presente: true, marcado_por: prof.id, marcado_em: agora, confirmado_em: i % 2 ? agora : null })); }
  dados.solicitacoes.push({ id: 'x-sol-prof', tipo: 'bolsa', equipe_id: prof.id, mes, situacao: 'solicitada', valor_solicitado: 2200, relatorio: 'Aulas do curso e acompanhamento da turma.', solicitada_em: agora,
    detalhe: { justificativa_sem_encontro: 'Mês de preparação do curso', fic_carga_horaria: 4, fic_gerado_em: agora, fic_encontros: [{ data: hoje, turma: 'Turma do Piauí', carga_horaria: 4, modalidade: 'presencial', conteudo: 'Planejamento do quintal',
      presencas: [{ nome: 'Maria Participante', papel: 'articulacao', uf: 'PI', presente: true, confirmado_em: agora }, { nome: 'Joana Ausente', papel: 'apoio', uf: 'PI', presente: false, confirmado_em: null }] }] } });
  const env = envenenar(dados, '');
  const porTabela = {}; Object.values(campos).forEach(c => { const t = c.split('.')[1]; porTabela[t] = (porTabela[t] || 0) + 1; });
  await p.evaluate(s => localStorage.setItem('mq-demo-v4', s), JSON.stringify(env));
  await p.reload(); await p.waitForSelector('main');
  const exec = new Set(); let telas = 0, cliques = 0; const semAbas = [];
  const colher = async () => { const x = await p.evaluate(() => { const r = window.__xss || []; window.__xss = []; return r; }); x.forEach(i => exec.add(i)); };
  const perfil = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); MQ.ui.S.verEntrada = false; const bt = document.querySelector(`button[data-p=${pf}]`); if (bt) bt.click(); }, pf); await p.waitForTimeout(350); await p.evaluate(() => MQ.ui.fecharPainel()); };
  // controle positivo: se o teste não pegar uma injeção proposital, o resultado não vale nada
  const canario = marcar('canário', 'controle positivo (proposital)');
  await p.evaluate(h => { const d = document.createElement('div'); d.hidden = true; d.innerHTML = h; document.body.appendChild(d); }, canario); await p.waitForTimeout(300);
  const pegou = (await p.evaluate(() => { const r = window.__xss || []; window.__xss = []; return r; })).length > 0;
  if (!pegou) { console.log('TESTE INVÁLIDO: não detectou a injeção proposital'); console.log('TOTAL 1 FALHAS 1'); process.exit(1); }
  await p.evaluate(() => { MQ.ui.S.verEntrada = true; MQ.ui.render(); }); await p.waitForTimeout(600); await colher(); telas++;
  for (const pf of ['coord_geral', 'coord_tecnico', 'bolsista', 'agente', 'professor', 'auxiliar']) {
    await perfil(pf); const abas = await p.evaluate(() => [...document.querySelectorAll('nav.abas [data-aba]')].map(x => x.dataset.aba));
    if (!abas.length) semAbas.push(pf);
    for (const a of (abas.length ? abas : [null])) {
      if (a) await p.evaluate(a => document.querySelector(`[data-aba=${a}]`).click(), a);
      await p.waitForTimeout(200); await colher(); telas++;
      // abre os detalhes dos itens (até 25 por aba): tudo que tem data-acao e data-id e não é destrutivo
      const alvos = await p.evaluate(() => [...document.querySelectorAll('main [data-acao][data-id]')]
        .filter(e => !/apagar|excluir|desligar|cancel|sair|arquiv|recus|remov|tirar/.test(e.dataset.acao)).slice(0, 25).map((e, i) => { e.setAttribute('data-xss-alvo', i); return i; }));
      for (const i of alvos) {
        const ok = await p.evaluate(i => { const e = document.querySelector(`[data-xss-alvo="${i}"]`); if (!e) return false; e.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }, i);
        if (!ok) continue; cliques++; await p.waitForTimeout(120); await colher();
        await p.evaluate(() => MQ.ui.fecharPainel()); if (a) await p.evaluate(a => { const x = document.querySelector(`[data-aba=${a}]`); if (x && !x.matches('[aria-current],[aria-selected=true],.ativa')) x.click(); }, a);
      }
    }
    for (const t of ['meus-dados', 'ajuda']) { await p.evaluate(t => MQ.ui.abrirPainel({ tipo: t }), t).catch(() => {}); await p.waitForTimeout(200); await colher(); await p.evaluate(() => MQ.ui.fecharPainel()); telas++; }
  }
  // página pública
  await p.evaluate(() => { location.hash = '#numeros'; }); await p.waitForTimeout(800); await colher(); telas++;
  await p.evaluate(() => { location.hash = ''; }); await p.waitForTimeout(300);
  const R = [];
  R.push(`Campos envenenados: ${n} (${Object.entries(porTabela).map(([k, v]) => k + ' ' + v).join(', ')})`);
  R.push('Controle positivo: injeção proposital detectada (o teste enxerga falhas)');
  R.push(`Telas percorridas: ${telas} · detalhes abertos: ${cliques}`);
  if (semAbas.length) R.push('perfis de tela única (sem abas): ' + semAbas.join(', '));
  if (exec.size) { R.push(`FALHA: código executou em ${exec.size} campo(s):`); [...exec].forEach(i => R.push('   ' + campos[i])); }
  else R.push('OK: nenhum código executou em nenhuma tela');
  const alertas = errs.filter(e => /ALERTA/.test(e)); if (alertas.length) R.push('alertas abertos: ' + alertas.length);
  const outros = [...new Set(errs.filter(e => !/ALERTA/.test(e)))]; if (outros.length) R.push('erros de página (com dados envenenados): ' + outros.slice(0, 8).join(' || '));
  console.log(R.join('\n')); console.log(`TOTAL 1 FALHAS ${exec.size ? 1 : 0}`);
  await b.close(); process.exit(exec.size ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
